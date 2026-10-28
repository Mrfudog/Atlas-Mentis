/**
 * **Schreibrechte je Ebene** (T-098, E-001): eigene Ebenen anlegen, sehen,
 * in welchen Ebenen man schreibt, und — als Besitzerin einer Ebene oder
 * als Verwaltung — sagen, wer sonst darin schreibt.
 *
 * Die Regel steht in CLAUDE.md und wird hier nur angewandt:
 *
 *  - **Eigene Ebenen legt jedes Konto an** und schreibt darin alles; wer
 *    eine Ebene anlegt, besitzt sie (`app_user_layer.owner`).
 *  - **Wer in welcher Ebene schreibt, steht neben dem Konto**, nicht an
 *    der Ebene (REQ-199). Ändern dürfen die Verwaltung und wer die Ebene
 *    besitzt.
 *  - **Die Ebene der Kampagne schreiben `gm` und `co-gm` von selbst**, aus
 *    ihrer Rolle; dafür gibt es keine Zeile.
 *
 * Eine eigene Ebene wirkt, sobald eine Kampagne sie aufschaltet — vorher
 * ist, was darin liegt, für niemanden im Spiel (E2). Aufschalten tut die
 * Leitung auf der Kampagnenseite.
 */

import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  ACTIVATES_RELATION,
  CAMPAIGN_TYPE,
  LAYER_COMPONENT,
  LAYER_RELATION,
  GROUP_RELATION,
  currentCampaign,
  entityName,
  isGroupLayer,
  publisherGroups,
  publisherInfo,
  nextId,
  primaryInterface,
  validateEntity,
  WRITE_LAYER_PREF,
  type Entity,
  isLayer,
} from '@nw/model';
import type { Repository } from './repo.js';
import { foldName, type User } from './auth.js';
import { spielerEbenen } from './spielerebene.js';
import { mitWahl } from './schreibebene.js';

/**
 * **Die Ebenen, die hier angelegt wurden** (T-109): jede, die nicht aus
 * einer Einfuhr kommt. Was der Importer für 5e.tools anlegt, trägt Pegs
 * mit `e5_` (`Werkbank.anlegen`, `buchEbeneId` …) — daran halten sich
 * auch die Migrationen 026, 034, 037 und 044. Ohne Herausgeber-Gruppe
 * heissen diese Homebrew, die eingelesenen „Unknown" (`publisherInfo`).
 * Ein Konto, eine Kampagne oder ein Besitz daran wäre die schwächere
 * Frage: eine Kampagnenebene, die zwei Runden teilen, ist niemandes
 * Kampagnenebene und trotzdem hier entstanden.
 */
const IMPORTIERT = /^e5_/;
export function eigeneEbenen(map: Map<string, Entity>): Set<string> {
  return new Set(
    [...map.values()].filter((e) => isLayer(e) && !IMPORTIERT.test(e.id)).map((e) => e.id),
  );
}

interface Deps {
  repo: Repository;
  viewerOf(request: FastifyRequest): Promise<User | null>;
  schreibEbenen(user: User | null, map: Map<string, Entity>): Promise<Set<string>>;
  zielEbenen(user: User | null, map: Map<string, Entity>, kampagne: Entity | null): Promise<Entity[]>;
  /** Wohin geschrieben werden darf, auch ausserhalb des Stapels (T-418). */
  schreibZiele(user: User | null, map: Map<string, Entity>, kampagne: Entity | null): Promise<Array<{ layer: Entity; inPlay: boolean }>>;
  kampagnenEbene(map: Map<string, Entity>, kampagne: Entity | null): Promise<Entity | null>;
  vorgabeEbene(user: User | null, map: Map<string, Entity>, kampagne: Entity | null): Promise<Entity | null>;
  schreibEbene(
    user: User | null,
    map: Map<string, Entity>,
    kampagne: Entity | null,
  ): Promise<{ layer: Entity | null; grund: Entity | null; chosen: string | null; dropped: string | null }>;
}

/** An einer Spielerebene (T-164): für welche Kampagne, und ob es die eigene ist. */
function spielerVon(
  map: Map<string, Entity>,
  spieler: Map<string, { userId: string; campaign: string }>,
  id: string,
  userId: string,
): { player?: { campaign: { id: string; name: string }; mine: boolean } } {
  const s = spieler.get(id);
  if (!s) return {};
  const k = map.get(s.campaign);
  return { player: { campaign: { id: s.campaign, name: k ? entityName(k) : s.campaign }, mine: s.userId === userId } };
}

/** Wie lang ein Ebenenname sein darf — er steht in Listen und Kopfzeilen. */
const NAME_MAX = 80;

export function registerEbenenrechte(
  app: FastifyInstance,
  { repo, viewerOf, schreibEbenen, zielEbenen, schreibZiele, kampagnenEbene, vorgabeEbene, schreibEbene }: Deps,
): void {
  const nein = (reply: FastifyReply, code: number, error: string) => reply.code(code).send({ error });
  const bestand = async () => new Map((await repo.listEntities()).map((e) => [e.id, e]));
  const istEbene = (e: Entity | undefined): e is Entity => !!e && isLayer(e);

  /** Darf dieses Konto sagen, wer in dieser Ebene schreibt? */
  const verwaltet = (user: User, layerId: string) => user.isAdmin || (user.ownedLayerIds ?? []).includes(layerId);

  /** Wer in einer Ebene schreibt, mit Namen — aus `app_user_layer`. */
  async function schreiberVon(layerId: string): Promise<{ id: string; name: string; owner: boolean }[]> {
    const namen = new Map((await repo.listUsers()).map((u) => [u.id, u.name]));
    return (await repo.layerGrants())
      .filter((g) => g.layerId === layerId && namen.has(g.userId))
      .map((g) => ({ id: g.userId, name: namen.get(g.userId)!, owner: g.owner }))
      .sort((a, b) => Number(b.owner) - Number(a.owner) || a.name.localeCompare(b.name, 'de'));
  }

  /**
   * **Die Ebenen, in denen ich schreibe** — für die Seite „Account": je
   * Ebene, warum (besessen, zugeteilt, als Leitung einer Kampagne), ob sie
   * in der laufenden Kampagne im Spiel ist, und bei einer, die ich
   * besitze, wer sonst darin schreibt.
   */
  app.get('/api/layers/mine', async (request, reply) => {
    const user = await viewerOf(request);
    if (!user) return nein(reply, 401, 'Nicht angemeldet.');
    const map = await bestand();
    const kampagne = currentCampaign(map, (await repo.getRegistry()).settings ?? null);
    const schreibt = await schreibEbenen(user, map);
    const imSpiel = new Set((await zielEbenen(user, map, kampagne)).map((l) => l.id));
    const vorgabe = (await vorgabeEbene(user, map, kampagne))?.id ?? null;
    /* Die eigenen Spielerebenen (T-164), mit ihrer Kampagne. */
    const spieler = spielerEbenen(await repo.layerGrants());
    /* Als Leitung: welche Kampagne welche Ebene bringt. */
    const alsLeitung = new Map<string, { id: string; name: string; role: string }[]>();
    for (const [c, role] of Object.entries(user.roles ?? {})) {
      if (role !== 'gm' && role !== 'co-gm') continue;
      const k = map.get(c);
      if (!k || primaryInterface(k) !== CAMPAIGN_TYPE) continue;
      const l = await kampagnenEbene(map, k);
      if (!l) continue;
      const liste = alsLeitung.get(l.id) ?? [];
      liste.push({ id: c, name: entityName(k), role });
      alsLeitung.set(l.id, liste);
    }
    const layers = [];
    for (const id of schreibt) {
      const l = map.get(id);
      if (!istEbene(l)) continue;
      const owner = (user.ownedLayerIds ?? []).includes(id);
      layers.push({
        id,
        name: entityName(l),
        owner,
        granted: (user.layerIds ?? []).includes(id),
        campaigns: alsLeitung.get(id) ?? [],
        inPlay: imSpiel.has(id),
        default: id === vorgabe,
        ...(spielerVon(map, spieler, id, user.id)),
        ...(verwaltet(user, id) ? { editors: await schreiberVon(id) } : {}),
      });
    }
    layers.sort((a, b) => Number(b.inPlay) - Number(a.inPlay) || a.name.localeCompare(b.name, 'de'));
    /* Die Vorgabe kann die Ebene der Kampagne sein, in der eine Spielerin
       nicht schreibt — darum steht sie für sich und nicht nur in der Liste. */
    const v = vorgabe ? map.get(vorgabe) : undefined;
    return {
      layers,
      campaign: kampagne ? { id: kampagne.id, name: entityName(kampagne) } : null,
      default: v ? { id: v.id, name: entityName(v) } : null,
    };
  });

  /**
   * **Die Vorgabe-Schreibebene** (T-164, für T-161): wohin dieses Konto in
   * der laufenden Kampagne anlegt, wenn es keine Ebene nennt — als
   * `player` die eigene Spielerebene. `layer: null`: hier legt es nicht an.
   */
  app.get('/api/layers/default', async (request, reply) => {
    const user = await viewerOf(request);
    if (!user) return nein(reply, 401, 'Nicht angemeldet.');
    const map = await bestand();
    const kampagne = currentCampaign(map, (await repo.getRegistry()).settings ?? null);
    const l = await vorgabeEbene(user, map, kampagne);
    const spieler = l ? spielerEbenen(await repo.layerGrants()).get(l.id) : undefined;
    return {
      layer: l ? { id: l.id, name: entityName(l), player: spieler?.userId === user.id } : null,
      campaign: kampagne ? { id: kampagne.id, name: entityName(kampagne) } : null,
    };
  });

  /**
   * **Die Schreibebene** (T-161): wohin dieses Konto in der laufenden
   * Kampagne anlegt, ob gewählt oder Vorgabe, eine Wahl, die gerade nicht
   * gilt (`dropped`), und die Ebenen zur Wahl — je mit Grund, und ob sie
   * wählbar ist: nur die Zielebenen (`zielEbenen`), keine Gruppe, keine,
   * die hier nicht aufgeschaltet ist. Die Verwaltung legt ohne Wahl
   * ausserhalb jeder Ebene an (`none`).
   */
  async function schreibStand(user: User) {
    const map = await bestand();
    const kampagne = currentCampaign(map, (await repo.getRegistry()).settings ?? null);
    const s = await schreibEbene(user, map, kampagne);
    /* Auch Ebenen ausserhalb des Stapels (T-418): wählbar, mit `inPlay: false`. */
    const ziele = await schreibZiele(user, map, kampagne);
    const zielIds = ziele.map((x) => x.layer.id);
    const imSpiel = new Set(ziele.filter((x) => x.inPlay).map((x) => x.layer.id));
    const kurz = (l: Entity | null | undefined) => (l ? { id: l.id, name: entityName(l) } : null);
    const kEbene = await kampagnenEbene(map, kampagne);
    const spieler = spielerEbenen(await repo.layerGrants());
    const namen = new Map((await repo.listUsers()).map((u) => [u.id, u.name]));
    const rolle = kampagne ? user.roles?.[kampagne.id] : undefined;
    const ids = [...new Set([...zielIds, ...(await schreibEbenen(user, map))])];
    const options = ids
      .map((id) => map.get(id))
      .filter(istEbene)
      .map((l) => {
        const sp = spieler.get(l.id);
        const reason =
          sp && sp.userId === user.id
            ? 'player'
            : sp
              ? 'playerOf'
              : (user.ownedLayerIds ?? []).includes(l.id)
                ? 'owner'
                : (user.layerIds ?? []).includes(l.id)
                  ? 'granted'
                  : l.id === kEbene?.id && (rolle === 'gm' || rolle === 'co-gm')
                    ? rolle
                    : user.isAdmin
                      ? 'admin'
                      : 'gm';
        const selectable = zielIds.includes(l.id);
        const inPlay = imSpiel.has(l.id);
        const why = !selectable
          ? isGroupLayer(l)
            ? 'A group of layers — articles go into one layer.'
            : 'Not switched on in this campaign.'
          : !inPlay
            ? 'Not switched on in this campaign — what you put there does not show here until the campaign turns it on.'
            : undefined;
        return {
          id: l.id,
          name: entityName(l),
          reason,
          ...(sp && sp.userId !== user.id ? { player: namen.get(sp.userId) ?? sp.userId } : {}),
          selectable,
          inPlay,
          ...(why ? { why } : {}),
        };
      })
      .sort(
        (a, b) =>
          Number(b.selectable) - Number(a.selectable) ||
          Number(b.inPlay) - Number(a.inPlay) ||
          (zielIds.indexOf(a.id) + 1 || 1e9) - (zielIds.indexOf(b.id) + 1 || 1e9) ||
          a.name.localeCompare(b.name, 'de'),
      );
    /* Die Verwaltung legt ohne Wahl ausserhalb jeder Ebene an (wie bisher). */
    const ohne = user.isAdmin && (!s.chosen || !!s.dropped);
    return {
      campaign: kurz(kampagne),
      layer: ohne ? null : kurz(s.layer),
      default: user.isAdmin ? null : kurz(s.grund),
      chosen: !!s.chosen && !s.dropped,
      dropped: s.dropped ? (kurz(map.get(s.dropped)) ?? { id: s.dropped, name: s.dropped }) : null,
      none: ohne,
      options,
    };
  }

  app.get('/api/layers/write', async (request, reply) => {
    const user = await viewerOf(request);
    if (!user) return nein(reply, 401, 'Nicht angemeldet.');
    return schreibStand(user);
  });

  /** **Die Schreibebene wählen** (T-161) — `{ layer: null }` heisst: wieder die Vorgabe. */
  app.put<{ Body: { layer?: unknown } | null }>('/api/layers/write', async (request, reply) => {
    const user = await viewerOf(request);
    if (!user || user.disabledAt) return nein(reply, 401, 'Nicht angemeldet.');
    const map = await bestand();
    const kampagne = currentCampaign(map, (await repo.getRegistry()).settings ?? null);
    if (!kampagne) return nein(reply, 409, 'Es läuft keine Kampagne.');
    const roh = request.body?.layer;
    const layer = typeof roh === 'string' && roh ? roh : null;
    if (layer && !(await schreibZiele(user, map, kampagne)).some((x) => x.layer.id === layer)) {
      return nein(reply, 403, 'You do not write in this layer. Choose one of the layers listed under “Writes to”.');
    }
    await repo.putPref(user.id, WRITE_LAYER_PREF, mitWahl(await repo.getPrefs(user.id), kampagne.id, layer));
    return schreibStand(user);
  });

  /**
   * **Die Schreibebene wählen** (T-176, für T-161): wohin dieses Konto in
   * der laufenden Kampagne anlegt, wenn es keine Ebene nennt. Gewählt
   * werden kann nur eine Ebene, in der es schreibt und die im Spiel ist
   * (`zielEbenen`) — sonst gälte, was dort entsteht, nirgends. Die
   * Verwaltung wählt auch für ein anderes Konto (`{ user }`), etwa die
   * Testebene der Leitung. `DELETE` nimmt die Wahl zurück.
   */
  async function wahlZiel(request: FastifyRequest, reply: FastifyReply, userId: unknown): Promise<User | null> {
    const user = await viewerOf(request);
    if (!user || user.disabledAt) {
      nein(reply, 401, 'Nicht angemeldet.');
      return null;
    }
    if (userId === undefined || userId === user.id) return user;
    if (!user.isAdmin) {
      nein(reply, 403, 'Die Schreibebene eines anderen Kontos wählt die Verwaltung.');
      return null;
    }
    const ziel = await repo.getUser(String(userId));
    if (!ziel || ziel.disabledAt) {
      nein(reply, 404, 'Dieses Konto gibt es nicht.');
      return null;
    }
    return ziel;
  }
  app.put<{ Params: { layer: string }; Body: { user?: unknown } | null }>('/api/layers/:layer/default', async (request, reply) => {
    const ziel = await wahlZiel(request, reply, request.body?.user);
    if (!ziel) return reply;
    const map = await bestand();
    const kampagne = currentCampaign(map, (await repo.getRegistry()).settings ?? null);
    if (!kampagne) return nein(reply, 409, 'Es läuft keine Kampagne.');
    const l = map.get(request.params.layer);
    if (!istEbene(l)) return nein(reply, 404, 'Diese Ebene gibt es nicht.');
    if (!(await schreibZiele(ziel, map, kampagne)).some((x) => x.layer.id === l.id)) {
      return nein(reply, 409, `${ziel.name} does not write in “${entityName(l)}”. Give the account the layer first (Account › Layers).`);
    }
    const wahl = (await repo.getPrefs(ziel.id))[WRITE_LAYER_PREF];
    await repo.putPref(ziel.id, WRITE_LAYER_PREF, { ...(wahl && typeof wahl === 'object' ? wahl : {}), [kampagne.id]: l.id });
    await repo.appendEvent('layer.default', ziel.id, { layer: l.id, campaign: kampagne.id, by: (await viewerOf(request))?.id });
    return { layer: { id: l.id, name: entityName(l) }, campaign: { id: kampagne.id, name: entityName(kampagne) } };
  });
  app.delete<{ Querystring: { user?: string } }>('/api/layers/default', async (request, reply) => {
    const ziel = await wahlZiel(request, reply, request.query.user);
    if (!ziel) return reply;
    const map = await bestand();
    const kampagne = currentCampaign(map, (await repo.getRegistry()).settings ?? null);
    const wahl = (await repo.getPrefs(ziel.id))[WRITE_LAYER_PREF];
    if (kampagne && wahl && typeof wahl === 'object' && kampagne.id in wahl) {
      const { [kampagne.id]: _weg, ...rest } = wahl as Record<string, unknown>;
      await repo.putPref(ziel.id, WRITE_LAYER_PREF, Object.keys(rest).length ? rest : null);
    }
    return { ok: true };
  });

  /**
   * **Eine Spielerebene übernehmen** (T-164): wenn ihr Konto in der Kampagne
   * nicht mehr mitspielt, holt die Leitung (oder die Verwaltung) ihren
   * Inhalt in die Ebene der Kampagne und löscht die leere Ebene. Was nicht
   * durch `validateEntity` geht, bleibt liegen — dann bleibt auch die
   * Ebene, und die Antwort zählt es auf. Nichts geht verloren.
   */
  app.post<{ Params: { layer: string } }>('/api/layers/:layer/takeover', async (request, reply) => {
    const user = await viewerOf(request);
    if (!user || user.disabledAt) return nein(reply, 401, 'Nicht angemeldet.');
    const map = await bestand();
    const l = map.get(request.params.layer);
    if (!istEbene(l)) return nein(reply, 404, 'Diese Ebene gibt es nicht.');
    const s = spielerEbenen(await repo.layerGrants()).get(l.id);
    if (!s) return nein(reply, 400, 'Keine Spielerebene.');
    const rolle = user.roles?.[s.campaign];
    if (!user.isAdmin && rolle !== 'gm' && rolle !== 'co-gm') {
      return nein(reply, 403, 'Eine Spielerebene übernimmt die Leitung ihrer Kampagne.');
    }
    if ((await repo.getUser(s.userId))?.roles?.[s.campaign] === 'player') {
      return nein(reply, 409, 'Ihr Konto spielt in dieser Kampagne noch mit.');
    }
    const kampagne = map.get(s.campaign) ?? null;
    /* In die Schreibebene der Leitung, wenn sie gewählt ist und keine
       Spielerebene ist (T-161); sonst in die Ebene der Kampagne. */
    const wahl = await schreibEbene(user, map, kampagne);
    const gewaehlt = wahl.chosen && !wahl.dropped && wahl.layer && !spielerEbenen(await repo.layerGrants()).has(wahl.layer.id) ? wahl.layer : null;
    const ziel = gewaehlt ?? (await kampagnenEbene(map, kampagne));
    if (!kampagne || !ziel) return nein(reply, 409, 'Die Kampagne hat keine eigene Ebene, die den Inhalt aufnimmt.');
    const registry = await repo.getRegistry();
    const known = new Map([...map.values()].map((e) => [e.id, e.interfaces?.[0] ?? ''] as const));
    const geholt: { id: string; name: string }[] = [];
    const liegen: { id: string; name: string }[] = [];
    for (const e of map.values()) {
      if (e.id === l.id || !(e.relations ?? []).some((r) => r.type === LAYER_RELATION && r.to === l.id)) continue;
      const schon = (e.relations ?? []).some((r) => r.type === LAYER_RELATION && r.to === ziel.id);
      const neu: Entity = {
        ...e,
        relations: (e.relations ?? []).flatMap((r) =>
          r.type === LAYER_RELATION && r.to === l.id ? (schon ? [] : [{ ...r, to: ziel.id }]) : [r],
        ),
      };
      if (validateEntity(registry, neu, { knownTypes: known }).length) {
        liegen.push({ id: e.id, name: entityName(e) });
        continue;
      }
      await repo.putEntity(neu);
      geholt.push({ id: e.id, name: entityName(e) });
    }
    if (!liegen.length) {
      /* Die leere Ebene geht, mit ihrer Kante an jeder Kampagne. */
      for (const k of map.values()) {
        if (primaryInterface(k) !== CAMPAIGN_TYPE) continue;
        const rest = (k.relations ?? []).filter((r) => !(r.type === ACTIVATES_RELATION && r.to === l.id));
        if (rest.length !== (k.relations ?? []).length) await repo.putEntity({ ...k, relations: rest });
      }
      await repo.deleteEntity(l.id);
      for (const g of await repo.layerGrants()) if (g.layerId === l.id) await repo.revokeLayer(g.userId, g.layerId);
    }
    await repo.appendEvent('layer.takeover', l.id, { into: ziel.id, moved: geholt.map((x) => x.id), kept: liegen.map((x) => x.id), by: user.id });
    return { into: { id: ziel.id, name: entityName(ziel) }, moved: geholt, kept: liegen, deleted: !liegen.length };
  });

  /**
   * **Eine eigene Ebene anlegen** — jedes Konto (E-001). Ein Artikel der
   * Art `Layer` wie jeder andere, also über `validateEntity`; wer anlegt,
   * besitzt sie. Ihr Stand ist `ready`: eine Ebene ist ein Ort und kein
   * Inhalt, und was darin liegt, trägt seinen eigenen Stand. Die
   * Spezifität 50 legt sie über die Bücher und unter die Ebene der
   * Kampagne (100), wenn die Leitung sie aufschaltet.
   */
  app.post<{ Body: { name?: unknown } | null }>('/api/layers', async (request, reply) => {
    const user = await viewerOf(request);
    if (!user || user.disabledAt) return nein(reply, 401, 'Nicht angemeldet.');
    const name = String(request.body?.name ?? '').trim().slice(0, NAME_MAX);
    if (!name) return nein(reply, 400, 'Wie heisst sie?');
    const alle = await repo.listEntities();
    const vergeben = new Set(alle.map((e) => e.id));
    let id = `ly_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
    while (vergeben.has(id)) id = `ly_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const entity: Entity = {
      id,
      interfaces: [LAYER_COMPONENT],
      name,
      components: {
        Identity: { name, id: nextId(alle, LAYER_COMPONENT), aliases: [] },
        Status: { status: 'ready' },
        Layer: { kind: 'pack', order: 50 },
      },
      relations: [],
    };
    const issues = validateEntity(await repo.getRegistry(), entity, {});
    if (issues.length) return reply.code(422).send({ error: 'Validierung fehlgeschlagen', issues });
    await repo.putEntity(entity);
    await repo.grantLayer(user.id, id, true);
    await repo.appendEvent('layer.created', id, { by: user.id });
    return reply.code(201).send({ id, name });
  });

  /** Wer in dieser Ebene schreibt — für die Verwaltung und wer sie besitzt. */
  app.get<{ Params: { layer: string } }>('/api/layers/:layer/editors', async (request, reply) => {
    const user = await viewerOf(request);
    if (!user) return nein(reply, 401, 'Nicht angemeldet.');
    const l = (await bestand()).get(request.params.layer);
    if (!istEbene(l)) return nein(reply, 404, 'Diese Ebene gibt es nicht.');
    if (!verwaltet(user, l.id)) return nein(reply, 403, 'Wer darin schreibt, sagen die Verwaltung und wer die Ebene besitzt.');
    return { layer: { id: l.id, name: entityName(l) }, editors: await schreiberVon(l.id) };
  });

  /**
   * **Jemanden in einer Ebene schreiben lassen** — beim Namen, oder (für
   * die Verwaltung aus der Kontoliste) bei der Id. `owner: true` macht ihn
   * zum Mitbesitzer: dann sagt auch er, wer darin schreibt.
   */
  app.post<{ Params: { layer: string }; Body: { name?: unknown; user?: unknown; owner?: unknown } | null }>(
    '/api/layers/:layer/editors',
    async (request, reply) => {
      const user = await viewerOf(request);
      if (!user) return nein(reply, 401, 'Nicht angemeldet.');
      const l = (await bestand()).get(request.params.layer);
      if (!istEbene(l)) return nein(reply, 404, 'Diese Ebene gibt es nicht.');
      if (!verwaltet(user, l.id)) return nein(reply, 403, 'Wer darin schreibt, sagen die Verwaltung und wer die Ebene besitzt.');
      const b = request.body ?? {};
      /* Bei der Id nur die Verwaltung: sie sieht die Kontoliste. */
      const ziel =
        b.user !== undefined && user.isAdmin
          ? await repo.getUser(String(b.user))
          : await repo.findUserByName(foldName(String(b.name ?? '')));
      if (!ziel || ziel.disabledAt) return nein(reply, 404, 'Kein Konto mit diesem Namen.');
      /* Wer schon besitzt, bleibt Besitzer — dazunehmen nimmt nichts weg. */
      const schon = (await repo.layerGrants()).find((g) => g.layerId === l.id && g.userId === ziel.id);
      const owner = b.owner === true || !!schon?.owner;
      await repo.grantLayer(ziel.id, l.id, owner);
      await repo.appendEvent('layer.editor', ziel.id, { layer: l.id, owner, by: user.id });
      return reply.code(201).send({ id: ziel.id, name: ziel.name, owner });
    },
  );

  /** Aus einer Ebene nehmen. Wer sie besitzt, nimmt sich nicht selbst
   *  heraus — sonst gehörte sie niemandem mehr; das kann die Verwaltung. */
  app.delete<{ Params: { layer: string; user: string } }>('/api/layers/:layer/editors/:user', async (request, reply) => {
    const user = await viewerOf(request);
    if (!user) return nein(reply, 401, 'Nicht angemeldet.');
    const { layer, user: zielId } = request.params;
    if (!verwaltet(user, layer)) return nein(reply, 403, 'Wer darin schreibt, sagen die Verwaltung und wer die Ebene besitzt.');
    if (zielId === user.id && !user.isAdmin) return nein(reply, 403, 'Die eigene Ebene gibt die Verwaltung ab.');
    if (!(await repo.revokeLayer(zielId, layer))) return nein(reply, 404, 'Schreibt nicht in dieser Ebene.');
    await repo.appendEvent('layer.editor', zielId, { layer, owner: null, by: user.id });
    return { ok: true };
  });

  /**
   * **Der Herausgeber einer Ebene** (T-109, REQ-249): gerechnet aus den
   * Herausgeber-Gruppen, an denen sie mit `partOf` hängt, mit dem Satz,
   * warum — und die Gruppen, unter die sie gehängt werden kann. Ändern
   * dürfen die Verwaltung und wer die Ebene besitzt (`canChange`).
   */
  app.get<{ Params: { layer: string } }>('/api/layers/:layer/publisher', async (request, reply) => {
    const user = await viewerOf(request);
    if (!user) return nein(reply, 401, 'Nicht angemeldet.');
    const map = await bestand();
    const l = map.get(request.params.layer);
    if (!istEbene(l)) return nein(reply, 404, 'Diese Ebene gibt es nicht.');
    if (isGroupLayer(l)) return { name: '', why: '', groups: [], options: [], canChange: false };
    return {
      ...publisherInfo(map, l, eigeneEbenen(map)),
      options: publisherGroups(map).map((g) => ({ id: g.id, name: entityName(g) })),
      canChange: verwaltet(user, l.id),
    };
  });

  /**
   * **Den Herausgeber ändern** (T-109): `{ groups: [...] }` sind die
   * Herausgeber-Gruppen, an denen die Ebene danach hängt — die Kanten
   * `partOf` zu anderen Herausgeber-Gruppen gehen, die zu Kategorien
   * bleiben. Ein Feld dafür gibt es nicht (D8); leer heisst: an keiner.
   */
  app.put<{ Params: { layer: string }; Body: { groups?: unknown } | null }>('/api/layers/:layer/publisher', async (request, reply) => {
    const user = await viewerOf(request);
    if (!user) return nein(reply, 401, 'Nicht angemeldet.');
    const map = await bestand();
    const l = map.get(request.params.layer);
    if (!istEbene(l)) return nein(reply, 404, 'Diese Ebene gibt es nicht.');
    if (isGroupLayer(l)) return nein(reply, 400, 'Eine Gruppe hat keinen Herausgeber.');
    if (!verwaltet(user, l.id)) return nein(reply, 403, 'Den Herausgeber ändern die Verwaltung und wer die Ebene besitzt.');
    const roh = request.body?.groups;
    if (!Array.isArray(roh) || !roh.every((x) => typeof x === 'string')) return nein(reply, 400, 'groups: eine Liste von Gruppen-Ids.');
    const erlaubt = new Set(publisherGroups(map).map((g) => g.id));
    const ziel = [...new Set(roh as string[])];
    const fremd = ziel.find((g) => !erlaubt.has(g));
    if (fremd) return nein(reply, 400, `Keine Herausgeber-Gruppe: ${fremd}`);
    const bleiben = (l.relations ?? []).filter((r) => !(r.type === GROUP_RELATION && erlaubt.has(r.to)));
    const neu: Entity = {
      ...l,
      relations: [
        ...bleiben,
        ...ziel.map((g) => ((l.relations ?? []).find((r) => r.type === GROUP_RELATION && r.to === g) ?? {
          id: `${l.id}~partOf-${g}`,
          type: GROUP_RELATION,
          to: g,
        })),
      ],
    };
    const issues = validateEntity(await repo.getRegistry(), neu, {});
    if (issues.length) return reply.code(422).send({ error: 'Validierung fehlgeschlagen', issues });
    await repo.putEntity(neu);
    await repo.appendEvent('layer.publisher', l.id, { groups: ziel, by: user.id });
    map.set(l.id, neu);
    return publisherInfo(map, neu, eigeneEbenen(map));
  });
}

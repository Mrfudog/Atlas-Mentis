/**
 * Verwaltung (W3): Kampagnen, ihre Mitglieder, die Figuren eines Kontos und
 * die Konten der Installation.
 *
 * Bis hierher setzte die Rollen nur die Kommandozeile (`user role`), und die
 * Leitung fragte zu Recht, wo sie Spieler einlädt. Die Regel steht in
 * CLAUDE.md und wird hier nur angewandt:
 *
 *  - **Die Rolle am Tisch steht am Konto, je Kampagne** (`campaign_member`),
 *    welche Figuren ein Konto führt, daneben (`app_user_actor`).
 *  - **Ändern** dürfen die Verwaltung der Installation (`is_admin`) und die
 *    Leitung dieser Kampagne (`gm`). Ein Mitleiter (`co-gm`) **sieht**
 *    dieselbe Liste und ändert sie nicht — das trennt `gm` und `co-gm`.
 *  - **Die Kontoliste der Installation** sieht nur die Verwaltung. Eine
 *    Leitung lädt ein oder nimmt ein Konto beim Namen dazu; durch alle
 *    Konten blättern, auch die anderer Runden, geht sie nichts an.
 *
 * Die Wache in `app.ts` lässt Schreibwege hierher durch; jede Route prüft
 * selbst, denn das Recht hängt an der Kampagne im Pfad.
 */

import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  CAMPAIGN_TYPE,
  CAMPAIGN_SETTING,
  LAYER_COMPONENT,
  LAYER_RELATION,
  activeStack,
  campaignsActivating,
  activatingIndex,
  groupMembers,
  isGroupLayer,
  layersInGroup,
  groupingOf,
  publisherInfo,
  offLayers,
  resolvedStack,
  withOff,
  groupSwitched,
  GROUP_RELATION,
  campaignsOf,
  currentCampaign,
  playStack,
  filterOf,
  withFilter,
  areaOf,
  ACTIVATES_RELATION,
  READING_TYPES,
  resolveArticle,
  entityName,
  isTableRole,
  nextId,
  validateEntity,
  withStack,
  withCompare,
  compareLayers,
  type Entity,
  type TableRole,
} from '@nw/model';
import type { Repository, StoredUser } from './repo.js';
import { sorgeSpielerEbene } from './spielerebene.js';
import { foldName, hashToken, mayViewAs, newInviteCode, type Invite, type User } from './auth.js';
import { inDieGruppe, neueGruppe } from './gruppe.js';
import { eigeneEbenen } from './ebenenrechte.js';

/** Was ein Konto an einer Kampagne darf: ändern, nur sehen, oder nichts. */
export type Recht = 'manage' | 'see' | null;


export function rechtAn(user: User | null, campaignId: string): Recht {
  if (!user || user.disabledAt) return null;
  if (user.isAdmin) return 'manage';
  const rolle = user.roles?.[campaignId];
  if (rolle === 'gm') return 'manage';
  if (rolle === 'co-gm') return 'see';
  return null;
}

/**
 * **Darf dieses Konto die Ebene in dieser Kampagne aufschalten?** (T-069)
 * Die Verwaltung immer. Die Leitung, solange die Ebene nicht genau einer
 * **anderen** Kampagne gehört: eine Ebene, die genau eine Kampagne
 * aufschaltet, gehört ihr (`campaignsOf`). Schaltete die Leitung der
 * einen Runde sie dazu, wäre sie gemeinsam, und die Leitung sähe, was in
 * der anderen nur deren Leitung sieht. Eine schon gemeinsame Ebene oder
 * eine, die niemand aufschaltet, darf sie nehmen.
 */
export function mayActivate(
  user: User | null,
  alle: Map<string, Entity>,
  layerId: string,
  campaignId: string,
  members?: Map<string, string[]>,
  /** Ebene → Kampagnen (`activatingIndex`), wer viele Ebenen fragt (T-143). */
  aktiv?: ReadonlyMap<string, readonly string[]>,
): boolean {
  if (rechtAn(user, campaignId) !== 'manage') return false;
  if (user?.isAdmin) return true;
  const frei = (id: string) => {
    const laufen = campaignsActivating(alle, id, aktiv);
    return laufen.includes(campaignId) || laufen.length !== 1;
  };
  if (!frei(layerId)) return false;
  /* Eine Gruppe bringt ihre Mitglieder (T-088): sie aufschalten darf nur,
     wer jedes davon aufschalten dürfte — sonst käme die Ebene einer
     anderen Runde über die Gruppe herein. */
  if (!isGroupLayer(alle.get(layerId))) return true;
  return layersInGroup(alle, layerId, members).every(frei);
}

/** Was jede Ebene enthält und wem sie gehört — einmal je Bestand (T-143). */
function zaehle(alle: Map<string, Entity>) {
  const ebenen = [...alle.values()].filter((e) => (e.interfaces ?? [])[0] === LAYER_COMPONENT);
  const zahl = new Map<string, number>();
  /* Was eine Ebene enthält, je Art — gerechnet, nie gespeichert (D8, T-088). */
  const inhalt = new Map<string, Record<string, number>>();
  /* Ebenen mit Text (T-091): nur an ihnen steht „Read". */
  const text = new Set<string>();
  for (const e of alle.values()) {
    const art = (e.interfaces ?? [])[0] ?? '';
    const lesbar = READING_TYPES.includes(art);
    for (const r of e.relations ?? []) {
      if (r.type !== LAYER_RELATION || (r.props as { mode?: unknown } | undefined)?.mode === 'removes') continue;
      zahl.set(r.to, (zahl.get(r.to) ?? 0) + 1);
      const je = inhalt.get(r.to) ?? {};
      je[art] = (je[art] ?? 0) + 1;
      inhalt.set(r.to, je);
      if (lesbar) text.add(r.to);
    }
  }
  const mitglieder = groupMembers(alle);
  const eigene = eigeneEbenen(alle);
  const aktiv = activatingIndex(alle);
  const verlage = new Map(ebenen.map((e) => [e.id, publisherInfo(alle, e, eigene)]));
  const verlag = (e: Entity) => verlage.get(e.id) ?? publisherInfo(alle, e, eigene);
  return { ebenen, zahl, inhalt, text, mitglieder, aktiv, verlag };
}

interface Deps {
  repo: Repository;
  viewerOf(request: FastifyRequest): Promise<User | null>;
}

export function registerVerwaltung(app: FastifyInstance, { repo, viewerOf }: Deps): void {
  const nein = (reply: FastifyReply, code: number, error: string) => reply.code(code).send({ error });

  const kampagnen = async (): Promise<Map<string, Entity>> =>
    new Map(
      (await repo.listEntities())
        .filter((e) => (e.interfaces ?? [])[0] === CAMPAIGN_TYPE)
        .map((e) => [e.id, e]),
    );

  /**
   * **Darf diese Kampagne diese Figur vergeben?** Ja, wenn der Artikel da
   * ist und keiner anderen Runde gehört: eine Ebene, die genau eine andere
   * Kampagne aufschaltet, macht ihn zu deren Figur (`campaignsOf`). Ohne
   * Ebenenkante gehört er niemandem besonders — heute der Normalfall.
   *
   * Das ist mehr als Ordnung: wer eine Figur führt, darf sie schreiben
   * (`mayWrite`). Ohne die Prüfung gäbe die Leitung der einen Runde ihrem
   * Spieler die Feder für die Figur einer anderen.
   */
  function vergebbar(alle: Map<string, Entity>, actorId: string, campaignId: string): boolean {
    const figur = alle.get(actorId);
    if (!figur) return false;
    const besitzer = campaignsOf(alle, figur);
    return !besitzer || besitzer.size === 0 || besitzer.has(campaignId);
  }

  const figurenMitNamen = (alle: Map<string, Entity>, ids: string[]) =>
    ids.map((id) => ({ id, name: alle.has(id) ? entityName(alle.get(id)) : null }));

  // ---------------------------------------------------------- Kampagnen

  /** Die Kampagnen, an denen dieser Betrachter etwas verwaltet oder sieht.
   *  Spielende bekommen eine leere Liste — die Kopfleiste zeigt den
   *  Eintrag dann nicht. */
  app.get('/api/campaigns', async (request, reply) => {
    const user = await viewerOf(request);
    if (!user) return nein(reply, 401, 'Nicht angemeldet.');
    const da = await kampagnen();
    const laufend = currentCampaign(da, (await repo.getRegistry()).settings ?? null);
    const ids = new Set<string>(user.isAdmin ? da.keys() : []);
    for (const [c, r] of Object.entries(user.roles ?? {})) if (r === 'gm' || r === 'co-gm') ids.add(c);
    return {
      campaigns: [...ids]
        .map((id) => ({
          id,
          /* Eine Rolle an einer Kampagne, die es (noch) nicht als Artikel
             gibt, steht trotzdem da — mit ihrer Id und dem Hinweis. Sie zu
             verschweigen hiesse, eine Rolle zu haben, die niemand sieht. */
          name: da.has(id) ? entityName(da.get(id)) : id,
          exists: da.has(id),
          role: user.roles?.[id] ?? null,
          may: rechtAn(user, id),
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'de')),
      /* Anlegen ist ein Artikel, und Artikel ohne Figur schreibt nur die
         Verwaltung (`mayWrite`). */
      canCreate: user.isAdmin,
      isAdmin: user.isAdmin,
      /* **Die laufende Kampagne** (T-143) — sie steht in der Kopfleiste,
         für jeden am Tisch. Ihr Name ist kein Geheimnis: ihr Inhalt ist,
         was jeder ohnehin sieht. `role` sagt, was man an ihr ist. */
      current: laufend
        ? {
            id: laufend.id,
            name: entityName(laufend),
            role: user.roles?.[laufend.id] ?? null,
            may: rechtAn(user, laufend.id),
            /* Wie viele Ebenen Inhalt bringen — Gruppen aufgelöst, ohne sie selbst. */
            layers: resolvedStack(await bestandAls(await repo.version()), laufend).filter((l) => !isGroupLayer(l)).length,
          }
        : null,
    };
  });

  /**
   * **Die laufende Kampagne wechseln** (T-143) — die Einstellung
   * `campaign` im Register. Sie gilt für die ganze Installation (offen in
   * CLAUDE.md: „die laufende Kampagne ist eine globale Einstellung"), also
   * wechselt sie nur die Verwaltung; der Kampagnenmanager (T-141) übernimmt.
   */
  app.put<{ Body: { id?: unknown } }>('/api/campaigns/current', async (request, reply) => {
    const user = await viewerOf(request);
    if (!user?.isAdmin) return nein(reply, 403, 'Die laufende Kampagne wechselt die Verwaltung; sie gilt für alle.');
    const id = request.body?.id;
    if (typeof id !== 'string' || !(await kampagnen()).has(id)) return nein(reply, 400, 'Diese Kampagne gibt es nicht als Artikel.');
    const registry = await repo.getRegistry();
    await repo.putRegistryPart('settings', { ...(registry.settings ?? {}), [CAMPAIGN_SETTING]: id });
    await repo.appendEvent('registry.written', undefined, { part: 'settings', campaign: id, by: user.id });
    return { ok: true, current: id };
  });

  /** Eine Kampagne anlegen — wenn es noch keine gibt, kann sonst niemand
   *  eingeladen werden. Ein Artikel wie jeder andere, also über
   *  `validateEntity`. Wer anlegt, leitet sie, wenn er das sagt.
   *
   *  **Sie bekommt gleich ihre Ebene** (T-098, E-001): `ly_<kampagne>`,
   *  aufgeschaltet und spezifischer als alles andere (100). Darin schreiben
   *  `gm` und `co-gm`, dorthin legen Spielende an, und dort liegt eine
   *  Fassung aus einer anderen Ebene. Dieselbe Ebene legt Migration 035
   *  für jede Kampagne an, die noch keine hatte.
   *
   *  **Und ihre Gruppe** (T-100, E-007): eine Party mit `partyOf`, in
   *  dieser Ebene. Wer als `player` eine Figur zugeteilt bekommt, kommt
   *  mit ihr hinein (`inDieGruppe`). */
  app.post<{ Body: { name?: string; lead?: boolean } }>('/api/campaigns', async (request, reply) => {
    const user = await viewerOf(request);
    if (!user?.isAdmin) return nein(reply, 403, 'Eine Kampagne legt die Verwaltung an.');
    const name = String(request.body?.name ?? '').trim();
    if (!name) return nein(reply, 400, 'Wie heisst sie?');
    const alle = await repo.listEntities();
    const id = randomUUID();
    const ebeneId = `ly_${id}`;
    const ebene: Entity = {
      id: ebeneId,
      interfaces: [LAYER_COMPONENT],
      name,
      components: {
        Identity: { name, id: nextId(alle, LAYER_COMPONENT), aliases: [] },
        Status: { status: 'ready' },
        Layer: { kind: 'campaign', order: 100 },
      },
      relations: [],
    };
    const entity: Entity = {
      id,
      interfaces: [CAMPAIGN_TYPE],
      name,
      components: { Identity: { name, id: nextId(alle, CAMPAIGN_TYPE), aliases: [] } },
      relations: [{ id: `${id}~activates-${ebeneId}`, type: 'activates', to: ebeneId, props: { order: 100 } }],
    };
    const gruppe = neueGruppe(alle, entity, ebeneId);
    const registry = await repo.getRegistry();
    const known = new Map([
      ...alle.map((e) => [e.id, e.interfaces?.[0] ?? ''] as const),
      [ebeneId, LAYER_COMPONENT] as const,
      [id, CAMPAIGN_TYPE] as const,
    ]);
    const issues = [
      ...validateEntity(registry, ebene, {}),
      ...validateEntity(registry, entity, { knownTypes: known }),
      ...validateEntity(registry, gruppe, { knownTypes: known }),
    ];
    if (issues.length) return reply.code(422).send({ error: 'Validierung fehlgeschlagen', issues });
    await repo.putEntity(ebene);
    await repo.putEntity(entity);
    await repo.putEntity(gruppe);
    await repo.appendEvent('entity.written', entity.id, { interfaces: entity.interfaces, cards: ['Identity'], layer: ebeneId });
    if (request.body?.lead === true) {
      const ich = await repo.getUser(user.id);
      if (ich) await repo.putUser({ ...ich, roles: { ...(ich.roles ?? {}), [entity.id]: 'gm' } });
      await repo.appendEvent('member.role', user.id, { campaign: entity.id, role: 'gm', by: user.id });
    }
    return reply.code(201).send({ id: entity.id, name });
  });

  // ---------------------------------------------------------- Ebenen

  /**
   * **Der Bestand und was jede Ebene enthält, je Stempel** (T-143). Die
   * Ebenenseite zählte bei jedem Abruf den ganzen Bestand durch und fragte
   * je Ebene alle Artikel nach Kampagnen — mit 174 Ebenen und gut 150 000
   * Artikeln eine halbe Sekunde auf dev, und das Popup in der Kopfleiste
   * fragt nach jedem Häkchen. Nichts davon hängt an der Kampagne oder am
   * Betrachter; ändert sich ein Artikel, ändert sich der Stempel.
   */
  let gehalten: { stempel: string; alle: Map<string, Entity> } | null = null;
  const bestandAls = async (stempel: string): Promise<Map<string, Entity>> => {
    if (gehalten?.stempel !== stempel) gehalten = { stempel, alle: new Map((await repo.listEntities()).map((e) => [e.id, e])) };
    return gehalten.alle;
  };
  let gezaehlt: { stempel: string; alle: Map<string, Entity>; z: ReturnType<typeof zaehle> } | null = null;
  const zaehlung = async (stempel: string, alle: Map<string, Entity>) => {
    if (gezaehlt?.stempel === stempel && gezaehlt.alle === alle) return gezaehlt.z;
    /* Hat sich seither nur eine Kampagne geändert — das Häkchen im Popup —,
       bleibt die Zählung: sie hängt an Ebenen und Inhalt, nicht am Stapel.
       Neu ist dann nur, wer was aufschaltet. Der gehaltene Bestand teilt
       die unveränderten Artikel (`PgRepository`), also reicht der
       Vergleich der Objekte. */
    const vorher = gezaehlt;
    const nurKampagne = (e: Entity | undefined) =>
      !e || ((e.interfaces ?? [])[0] === CAMPAIGN_TYPE && !(e.relations ?? []).some((r) => r.type === LAYER_RELATION));
    let gleich = !!vorher && vorher.alle.size === alle.size;
    if (vorher && gleich) {
      for (const [id, e] of alle) {
        const alt = vorher.alle.get(id);
        if (alt !== e && !(nurKampagne(alt) && nurKampagne(e) && alt)) {
          gleich = false;
          break;
        }
      }
    }
    gezaehlt = { stempel, alle, z: vorher && gleich ? { ...vorher.z, aktiv: activatingIndex(alle) } : zaehle(alle) };
    return gezaehlt.z;
  };


  /**
   * **Die Ebenen einer Kampagne** (T-069, E-008): alle Ebenen des
   * Bestands, die aufgeschalteten von unten nach oben, darunter die
   * übrigen. Was eine Kampagne zeigt, ist ihre wichtigste Einstellung —
   * die Kante `activates` hiess in der Maske „runs on", und die Leitung
   * fand sie nicht. Sehen dürfen Verwaltung, Leitung und Mitleitung;
   * ändern die Verwaltung und die Leitung (`rechtAn`).
   */
  app.get<{ Params: { c: string } }>('/api/campaigns/:c/layers', async (request, reply) => {
    const user = await viewerOf(request);
    const c = request.params.c;
    const recht = rechtAn(user, c);
    if (!user || !recht) return nein(reply, 403, 'Nicht für dich.');
    const sicht = await ebenenSicht(user, c, recht);
    if (!sicht) return nein(reply, 404, 'Diese Kampagne gibt es nicht als Artikel.');
    return sicht;
  });

  /** Was `GET …/layers` antwortet — auch nach jedem Schreiben am Stapel
   *  mitgeschickt (`state`, T-143), damit das Popup nicht noch einmal fragt. */
  async function ebenenSicht(user: User, c: string, recht: Recht) {
    const stempel = await repo.version();
    const alle = await bestandAls(stempel);
    const kampagne = alle.get(c);
    if (!kampagne || (kampagne.interfaces ?? [])[0] !== CAMPAIGN_TYPE) return null;
    const { ebenen, zahl, inhalt, text, mitglieder, aktiv, verlag } = await zaehlung(stempel, alle);
    const stapel = activeStack(alle, kampagne).map((x) => x.layer.id);
    /* Im Spiel ist auch, was eine aufgeschaltete Gruppe bringt (E-022 b). */
    const imSpiel = new Set(resolvedStack(alle, kampagne, mitglieder).map((l) => l.id));
    const abgeschaltet = offLayers(kampagne);
    const vergleich = compareLayers(alle, kampagne).map((x) => x.id);
    const auswahl = new Map(
      (kampagne.relations ?? [])
        .filter((r) => r.type === ACTIVATES_RELATION && (r.props as { mode?: unknown } | undefined)?.mode !== 'off')
        .map((r) => [r.to, filterOf(r)] as const),
    );
    const zeile = (e: Entity) => {
      const andere = campaignsActivating(alle, e.id, aktiv)
        .filter((k) => k !== c)
        .map((k) => entityName(alle.get(k)));
      const karte = (e.components?.[LAYER_COMPONENT] as Record<string, unknown> | undefined) ?? {};
      const wort = (k: string) => (typeof karte[k] === 'string' || typeof karte[k] === 'number' ? String(karte[k]) : '');
      const beschreibung = (e.components?.['Description'] as { description?: unknown } | undefined)?.description;
      const gruppe = isGroupLayer(e);
      const verlag_ = verlag(e);
      return {
        id: e.id,
        name: entityName(e),
        kind: wort('kind'),
        /* Wer sie herausgibt, gerechnet (T-094, E10), und warum (T-109); bei einer Gruppe, wonach sie ordnet. */
        publisher: verlag_.name,
        publisherWhy: verlag_.why,
        ...(gruppe ? { groupBy: groupingOf(e) } : {}),
        /* Die Gruppen, an denen sie hängt, und bei einer Gruppe ihre Mitglieder (T-088). */
        groups: (e.relations ?? []).filter((r) => r.type === GROUP_RELATION && isGroupLayer(alle.get(r.to))).map((r) => r.to),
        ...(gruppe ? { members: mitglieder.get(e.id) ?? [] } : {}),
        articles: zahl.get(e.id) ?? 0,
        content: inhalt.get(e.id) ?? {},
        about: {
          abbreviation: wort('abbreviation'),
          published: wort('published'),
          author: wort('author'),
          version: wort('version'),
          levels: wort('levels'),
          storyline: wort('storyline'),
          description: typeof beschreibung === 'string' ? beschreibung : '',
        },
        readable: text.has(e.id),
        active: stapel.includes(e.id),
        inPlay: imSpiel.has(e.id),
        off: abgeschaltet.has(e.id),
        compare: vergleich.includes(e.id),
        /* Was sie bringt (T-105): die Auswahl an ihrer eigenen Kante; ohne
           Kante (nur über eine Gruppe) gilt die der Gruppe. */
        ...(auswahl.get(e.id) ? { only: auswahl.get(e.id)! } : {}),
        alsoIn: andere,
        canActivate: mayActivate(user, alle, e.id, c, mitglieder, aktiv),
      };
    };
    const an = stapel.map((id) => alle.get(id)!).map(zeile);
    const aus = ebenen
      .filter((e) => !stapel.includes(e.id))
      .map(zeile)
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));
    const compareFor = (kampagne.components?.[CAMPAIGN_TYPE] as { compareFor?: unknown } | undefined)?.compareFor;
    return {
      campaign: { id: c, name: entityName(kampagne) },
      may: recht,
      layers: [...an, ...aus],
      /* Wer die Vergleichsebenen sieht (T-092): `gm` (Vorgabe) oder `players`. */
      compareFor: compareFor === 'players' ? ('players' as const) : ('gm' as const),
    };
  }

  /** Die Kanten `activates` schreiben — der ganze Stapel, von unten nach
   *  oben. Was fehlt, ist danach abgeschaltet; gelöscht wird nichts. */
  async function stapelSchreiben(
    request: FastifyRequest<{ Params: { c: string } }>,
    reply: FastifyReply,
    neu: (alle: Map<string, Entity>, kampagne: Entity) => string[] | string | { layers: string[]; off: string[] },
    abgeschaltetVorgabe?: string[],
  ): Promise<unknown> {
    const user = await viewerOf(request);
    const c = request.params.c;
    const recht = rechtAn(user, c);
    if (!user || !recht) return nein(reply, 403, 'Nicht für dich.');
    if (recht !== 'manage') return nein(reply, 403, 'Die Ebenen schaltet die Leitung auf; ein Mitleiter sieht sie nur.');
    const alle = new Map((await repo.listEntities()).map((e) => [e.id, e]));
    const kampagne = alle.get(c);
    if (!kampagne || (kampagne.interfaces ?? [])[0] !== CAMPAIGN_TYPE) {
      return nein(reply, 404, 'Diese Kampagne gibt es nicht als Artikel.');
    }
    const roh = neu(alle, kampagne);
    if (typeof roh === 'string') return nein(reply, 400, roh);
    const ids = Array.isArray(roh) ? roh : roh.layers;
    const abgeschaltet = Array.isArray(roh) ? abgeschaltetVorgabe : roh.off;
    const vorher = new Set(activeStack(alle, kampagne).map((x) => x.layer.id));
    const mitglieder = groupMembers(alle);
    const aktiv = activatingIndex(alle);
    for (const id of ids) {
      if ((alle.get(id)?.interfaces ?? [])[0] !== LAYER_COMPONENT) return nein(reply, 400, `Keine Ebene: ${id}`);
      if (!vorher.has(id) && !mayActivate(user, alle, id, c, mitglieder, aktiv)) {
        return nein(reply, 403, `„${entityName(alle.get(id))}" gehört einer anderen Kampagne; aufschalten kann sie die Verwaltung.`);
      }
    }
    /* Abschalten (T-088) darf die Leitung jede Ebene: aus nimmt nur weg. */
    for (const id of abgeschaltet ?? []) {
      if ((alle.get(id)?.interfaces ?? [])[0] !== LAYER_COMPONENT) return nein(reply, 400, `Keine Ebene: ${id}`);
    }
    let geschrieben = withStack(kampagne, ids);
    if (abgeschaltet) geschrieben = withOff(geschrieben, abgeschaltet);
    const issues = validateEntity(await repo.getRegistry(), geschrieben, {});
    if (issues.length) return reply.code(422).send({ error: 'Validierung fehlgeschlagen', issues });
    await repo.putEntity(geschrieben);
    await repo.appendEvent('campaign.layers', c, { layers: ids, ...(abgeschaltet ? { off: abgeschaltet } : {}), by: user.id });
    return { ok: true, layers: ids, ...(abgeschaltet ? { off: [...offLayers(geschrieben)] } : {}), state: await ebenenSicht(user, c, recht) };
  }

  /** `{ layers, off? }` — `off` (T-088): die Ebenen, die aus sind, obwohl
   *  eine aufgeschaltete Gruppe sie brächte. Ohne `off` bleiben die
   *  Abschaltungen, wie sie sind. */
  app.put<{ Params: { c: string }; Body: { layers?: unknown; off?: unknown } }>('/api/campaigns/:c/layers', (request, reply) => {
    const off = request.body?.off;
    if (off !== undefined && (!Array.isArray(off) || !off.every((x) => typeof x === 'string'))) {
      return nein(reply, 400, 'off: eine Liste von Ebenen-Ids.');
    }
    return stapelSchreiben(
      request,
      reply,
      () => {
        const l = request.body?.layers;
        if (!Array.isArray(l) || !l.every((x) => typeof x === 'string')) return 'layers: eine Liste von Ebenen-Ids.';
        return l as string[];
      },
      off as string[] | undefined,
    );
  });

  /** Eine Ebene dazuschalten — der Knopf im Hinweis der Listen. Sie kommt
   *  an die Stelle, die ihre eigene Spezifität (`Layer.order`) sagt: ein
   *  Regelwerk nach unten, eine Kampagnenebene nach oben. */
  app.post<{ Params: { c: string; layer: string } }>('/api/campaigns/:c/layers/:layer', (request, reply) =>
    stapelSchreiben(request, reply, (alle, kampagne) => {
      const stapel = activeStack(alle, kampagne);
      const id = request.params.layer;
      if (stapel.some((x) => x.layer.id === id)) return stapel.map((x) => x.layer.id);
      const roh = (alle.get(id)?.components?.[LAYER_COMPONENT] as { order?: unknown } | undefined)?.order;
      const eigene = roh != null && Number.isFinite(Number(roh)) ? Number(roh) : 10;
      const spez = (e: Entity) => {
        const o = (e.components?.[LAYER_COMPONENT] as { order?: unknown } | undefined)?.order;
        return o != null && Number.isFinite(Number(o)) ? Number(o) : 10;
      };
      const ids = stapel.map((x) => x.layer.id);
      const bei = stapel.findIndex((x) => spez(x.layer) > eigene);
      ids.splice(bei < 0 ? ids.length : bei, 0, id);
      return ids;
    }),
  );

  /**
   * **Eine ganze Gruppe an oder aus** (T-185): `{ on }`. Alles darin geht
   * mit, auch Bücher, die einzeln aufgeschaltet oder abgeschaltet waren —
   * keine alte Teilwahl kommt zurück (`groupSwitched`).
   */
  app.put<{ Params: { c: string; layer: string }; Body: { on?: unknown } }>('/api/campaigns/:c/layers/:layer/group', (request, reply) =>
    stapelSchreiben(request, reply, (alle, kampagne) => {
      const on = request.body?.on;
      if (typeof on !== 'boolean') return 'on: true oder false.';
      const g = alle.get(request.params.layer);
      if (!isGroupLayer(g)) return 'Keine Gruppe.';
      return groupSwitched(alle, kampagne, g!.id, on);
    }),
  );

  /**
   * **Was eine Ebene bringt** (T-105, REQ-255): `{ areas?, types? }` an
   * ihrer Kante `activates` — aufgeschaltet, als Gruppe oder zum Vergleich.
   * Beide leer oder fehlend (`null`) heisst wieder alles. Bereiche sind die
   * `area` der Arten im Register, Arten seine Typen; Unbekanntes lehnt die
   * Route ab, denn ein Tippfehler nähme still ein ganzes Buch heraus.
   */
  app.put<{ Params: { c: string; layer: string }; Body: { areas?: unknown; types?: unknown } }>(
    '/api/campaigns/:c/layers/:layer/only',
    async (request, reply) => {
      const user = await viewerOf(request);
      const c = request.params.c;
      const recht = rechtAn(user, c);
      if (!user || !recht) return nein(reply, 403, 'Nicht für dich.');
      if (recht !== 'manage') return nein(reply, 403, 'Was eine Ebene bringt, wählt die Leitung; ein Mitleiter sieht es nur.');
      const alle = new Map((await repo.listEntities()).map((e) => [e.id, e]));
      const kampagne = alle.get(c);
      if (!kampagne || (kampagne.interfaces ?? [])[0] !== CAMPAIGN_TYPE) {
        return nein(reply, 404, 'Diese Kampagne gibt es nicht als Artikel.');
      }
      const registry = await repo.getRegistry();
      const liste = (x: unknown, name: string): string[] | undefined | string => {
        if (x === undefined || x === null) return undefined;
        if (!Array.isArray(x) || !x.every((y) => typeof y === 'string')) return `${name}: eine Liste von Wörtern.`;
        return x as string[];
      };
      const areas = liste(request.body?.areas, 'areas');
      const types = liste(request.body?.types, 'types');
      if (typeof areas === 'string') return nein(reply, 400, areas);
      if (typeof types === 'string') return nein(reply, 400, types);
      const bereiche = new Set(Object.keys(registry.interfaces).map((t) => areaOf(registry, t)).filter(Boolean));
      const fremd = [...(areas ?? []).filter((a) => !bereiche.has(a)), ...(types ?? []).filter((t) => !registry.interfaces[t])];
      if (fremd.length) return nein(reply, 400, `Unbekannt: ${fremd.join(', ')}`);
      const filter = areas === undefined && types === undefined ? null : { ...(areas ? { areas } : {}), ...(types ? { types } : {}) };
      const geschrieben = withFilter(kampagne, request.params.layer, filter);
      if (!geschrieben) {
        return nein(reply, 409, 'Diese Ebene schaltet die Kampagne nicht selbst auf; sie bringt, was ihre Gruppe bringt.');
      }
      const issues = validateEntity(registry, geschrieben, {});
      if (issues.length) return reply.code(422).send({ error: 'Validierung fehlgeschlagen', issues });
      await repo.putEntity(geschrieben);
      await repo.appendEvent('campaign.layers', c, { layer: request.params.layer, only: filter, by: user.id });
      return { ok: true, only: filter, state: await ebenenSicht(user, c, recht) };
    },
  );

  /**
   * **Die Vergleichsebenen schreiben** (T-092, E-021 d): `{ layers, players? }`
   * — die Ebenen, deren Fassungen auf Wunsch an den Feldern stehen, ohne
   * im Spiel zu sein (`activates` mit `mode: 'compare'`). `players` sagt,
   * ob auch die Spielenden sie sehen (`Campaign.compareFor`); Vorgabe ist
   * nur die Leitung. Dieselben Rechte wie der Stapel: die Leitung ändert,
   * ein Mitleiter sieht; eine Ebene, die einer anderen Kampagne gehört,
   * nimmt nur die Verwaltung — ihr Inhalt ist die Arbeit einer anderen Runde.
   */
  app.put<{ Params: { c: string }; Body: { layers?: unknown; players?: unknown } }>(
    '/api/campaigns/:c/compare',
    async (request, reply) => {
      const user = await viewerOf(request);
      const c = request.params.c;
      const recht = rechtAn(user, c);
      if (!user || !recht) return nein(reply, 403, 'Nicht für dich.');
      if (recht !== 'manage') return nein(reply, 403, 'Die Vergleichsebenen wählt die Leitung; ein Mitleiter sieht sie nur.');
      const alle = new Map((await repo.listEntities()).map((e) => [e.id, e]));
      const kampagne = alle.get(c);
      if (!kampagne || (kampagne.interfaces ?? [])[0] !== CAMPAIGN_TYPE) {
        return nein(reply, 404, 'Diese Kampagne gibt es nicht als Artikel.');
      }
      const l = request.body?.layers;
      if (l !== undefined && (!Array.isArray(l) || !l.every((x) => typeof x === 'string'))) {
        return nein(reply, 400, 'layers: eine Liste von Ebenen-Ids.');
      }
      const ids = (l as string[] | undefined) ?? compareLayers(alle, kampagne).map((x) => x.id);
      const vorher = new Set(compareLayers(alle, kampagne).map((x) => x.id));
      const mitglieder = groupMembers(alle);
      const aktiv = activatingIndex(alle);
      for (const id of ids) {
        if ((alle.get(id)?.interfaces ?? [])[0] !== LAYER_COMPONENT) return nein(reply, 400, `Keine Ebene: ${id}`);
        if (!vorher.has(id) && !mayActivate(user, alle, id, c, mitglieder, aktiv)) {
          return nein(reply, 403, `„${entityName(alle.get(id))}" gehört einer anderen Kampagne; vergleichen kann damit die Verwaltung.`);
        }
      }
      let geschrieben = withCompare(kampagne, ids);
      const players = request.body?.players;
      if (players !== undefined) {
        if (typeof players !== 'boolean') return nein(reply, 400, 'players: ja oder nein.');
        const karte = { ...((geschrieben.components?.[CAMPAIGN_TYPE] ?? {}) as Record<string, unknown>) };
        karte['compareFor'] = players ? 'players' : 'gm';
        geschrieben = { ...geschrieben, components: { ...geschrieben.components, [CAMPAIGN_TYPE]: karte } };
      }
      const issues = validateEntity(await repo.getRegistry(), geschrieben, {});
      if (issues.length) return reply.code(422).send({ error: 'Validierung fehlgeschlagen', issues });
      await repo.putEntity(geschrieben);
      await repo.appendEvent('campaign.compare', c, { layers: ids, ...(players !== undefined ? { players } : {}), by: user.id });
      alle.set(c, geschrieben);
      return {
        ok: true,
        layers: compareLayers(alle, geschrieben).map((x) => x.id),
        state: await ebenenSicht(user, c, recht),
      };
    },
  );

  /**
   * **Die Geschichte der Kampagne** (T-082, REQ-240): ihre eigenen
   * Geschichtsartikel (`partOf` die Kampagne) und, je aufgeschaltetes
   * Abenteuer, dessen Kapitel (`Arc`, E-026) — in der Fassung, die in **dieser** Kampagne
   * gilt (`resolveArticle`, E-018): ein angepasstes Kapitel steht als ihre
   * Fassung da. Ein Abenteuer ist eine `Story` mit `kind: 'adventure'` in
   * einer aufgeschalteten Ebene; meist ist es eine Abenteuerebene, manchmal
   * ein Quellenbuch, das eines enthält. Sehen dürfen es wie die Ebenen
   * Verwaltung, Leitung und Mitleitung.
   */
  app.get<{ Params: { c: string } }>('/api/campaigns/:c/story', async (request, reply) => {
    const user = await viewerOf(request);
    const c = request.params.c;
    if (!user || !rechtAn(user, c)) return nein(reply, 403, 'Nicht für dich.');
    const alle = new Map((await repo.listEntities()).map((e) => [e.id, e]));
    const kampagne = alle.get(c);
    if (!kampagne || (kampagne.interfaces ?? [])[0] !== CAMPAIGN_TYPE) {
      return nein(reply, 404, 'Diese Kampagne gibt es nicht als Artikel.');
    }
    const registry = await repo.getRegistry();
    const ebenen = new Set(activeStack(alle, kampagne).map((x) => x.layer.id));
    const art = (e: Entity) => (e.interfaces ?? [])[0] ?? '';
    const sorte = (e: Entity) => String((e.components?.['Story'] as { kind?: unknown } | undefined)?.kind ?? '');
    const nummer = (e: Entity) => String((e.components?.['Identity'] as { id?: unknown } | undefined)?.id ?? '');
    const nachNummer = (a: Entity, b: Entity) => nummer(a).localeCompare(nummer(b), 'en', { numeric: true });
    const teilVon = (e: Entity, ziel: string) => (e.relations ?? []).some((r) => r.type === 'partOf' && r.to === ziel);
    const zeile = (e: Entity) => {
      const gilt = resolveArticle(alle, e, kampagne, registry);
      /* Angepasst ist, was eine Fassung ist — ob sie hier über das Original
         oder für sich in die Liste kam. */
      const adapted = (gilt.relations ?? []).some((r) => r.type === 'overrides');
      return { id: gilt.id, name: entityName(gilt), type: art(gilt), kind: sorte(gilt), adapted };
    };
    /* Der Stapel einmal, mit der Bereichsauswahl der Ebenen (T-086, T-105). */
    const stapel = playStack(alle, kampagne, registry);
    const geschichte = [...alle.values()].filter((e) => stapel.inStack(e));
    const eigene = geschichte.filter((e) => teilVon(e, c) && stapel.inPlay(e)).sort(nachNummer).map(zeile);
    const abenteuer = geschichte
      .filter((e) => art(e) === 'Story' && sorte(e) === 'adventure' && (e.relations ?? []).some((r) => r.type === LAYER_RELATION && ebenen.has(r.to)))
      .sort((a, b) => entityName(a).localeCompare(entityName(b), 'en'))
      .map((a) => ({
        ...zeile(a),
        layer: (a.relations ?? []).find((r) => r.type === LAYER_RELATION && ebenen.has(r.to))?.to ?? '',
        chapters: geschichte
          /* Die Originale, nach ihrer Nummer — eine Fassung steht an der
             Stelle dessen, was sie ersetzt (`zeile`), nicht am Ende. */
          /* Ein Kapitel ist ein Arc (E-026). */
          .filter((k) => art(k) === 'Arc' && teilVon(k, a.id) && !(k.relations ?? []).some((r) => r.type === 'overrides'))
          .sort(nachNummer)
          .map(zeile),
      }));
    return { campaign: c, own: eigene, adventures: abenteuer };
  });

  // ---------------------------------------------------------- Mitglieder

  app.get<{ Params: { c: string } }>('/api/campaigns/:c/members', async (request, reply) => {
    const user = await viewerOf(request);
    const c = request.params.c;
    const recht = rechtAn(user, c);
    if (!user || !recht) return nein(reply, 403, 'Nicht für dich.');
    const alle = new Map((await repo.listEntities()).map((e) => [e.id, e]));
    const kampagne = alle.get(c);
    /* „View as" nur in der laufenden Kampagne (REQ-241): gerechnet wird mit
       ihrem Stapel, und eine andere zu zeigen hiesse, etwas anderes zu
       zeigen, als der Spieler sieht. Der Server sagt es je Mitglied. */
    const laufend = currentCampaign(alle, (await repo.getRegistry()).settings ?? null)?.id ?? null;
    const members = (await repo.listUsers())
      .filter((u) => isTableRole(u.roles?.[c]))
      .map((u) => ({
        viewAs: laufend === c && u.id !== user.id && mayViewAs(user, u, laufend),
        id: u.id,
        name: u.name,
        role: u.roles[c] as TableRole,
        isAdmin: u.isAdmin,
        disabled: !!u.disabledAt,
        self: u.id === user.id,
        actors: figurenMitNamen(alle, u.actorIds ?? []),
      }))
      .sort((a, b) => ORDNUNG[a.role] - ORDNUNG[b.role] || a.name.localeCompare(b.name, 'de'));
    /* Die Figuren, die diese Kampagne vergeben darf — für die Auswahl beim
       Zuteilen und beim Einladen. Nur Spielerfiguren: bei vierundzwanzig-
       tausend Kreaturen aus 5e.tools wäre die Liste keine Auswahl mehr. */
    const characters =
      recht === 'manage'
        ? [...alle.values()]
            .filter((e) => (e.interfaces ?? [])[0] === 'PlayerCharacter' && vergebbar(alle, e.id, c))
            .map((e) => ({ id: e.id, name: entityName(e) }))
            .sort((a, b) => a.name.localeCompare(b.name, 'de'))
        : [];
    return {
      campaign: { id: c, name: kampagne ? entityName(kampagne) : c, exists: !!kampagne },
      may: recht,
      members,
      characters,
    };
  });

  /** Wer ändert, und an wem. Ein Konto, das nicht Verwaltung ist, ändert
   *  **sich selbst** hier nicht: eine Leitung, die sich zum Zuschauer macht,
   *  hat sich ausgesperrt, und zurück käme sie nur über die Verwaltung. */
  async function aendern(
    request: FastifyRequest<{ Params: { c: string; u?: string } }>,
    reply: FastifyReply,
    zielId?: string,
  ): Promise<{ user: User; ziel?: StoredUser } | null> {
    const user = await viewerOf(request);
    const c = request.params.c;
    const recht = rechtAn(user, c);
    if (!user || !recht) {
      await nein(reply, 403, 'Nicht für dich.');
      return null;
    }
    if (recht !== 'manage') {
      await nein(reply, 403, 'Die Mitglieder ändert die Leitung; ein Mitleiter sieht sie nur.');
      return null;
    }
    if (zielId === undefined) return { user };
    const ziel = await repo.getUser(zielId);
    if (!ziel) {
      await nein(reply, 404, 'Kein solches Konto.');
      return null;
    }
    if (ziel.id === user.id && !user.isAdmin) {
      await nein(reply, 403, 'Die eigene Rolle ändert die Verwaltung.');
      return null;
    }
    return { user, ziel };
  }

  /** Ein Konto dazunehmen, das es schon gibt — beim Namen, oder (für die
   *  Verwaltung aus der Kontoliste) bei der Id. */
  app.post<{ Params: { c: string }; Body: { name?: string; user?: string; role?: string } }>(
    '/api/campaigns/:c/members',
    async (request, reply) => {
      const ok = await aendern(request, reply);
      if (!ok) return reply;
      const role = request.body?.role ?? 'player';
      if (!isTableRole(role)) return nein(reply, 400, 'Rolle: gm, co-gm, player oder spectator.');
      const ziel = request.body?.user
        ? await repo.getUser(String(request.body.user))
        : await repo.findUserByName(foldName(String(request.body?.name ?? '')));
      if (!ziel) return nein(reply, 404, 'Kein Konto mit diesem Namen.');
      if (ziel.id === ok.user.id && !ok.user.isAdmin) {
        return nein(reply, 403, 'Die eigene Rolle ändert die Verwaltung.');
      }
      const c = request.params.c;
      await repo.putUser({ ...ziel, roles: { ...(ziel.roles ?? {}), [c]: role } });
      await repo.appendEvent('member.role', ziel.id, { campaign: c, role, by: ok.user.id });
      /* Wer mitspielt, bekommt seine Spielerebene (T-164). */
      if (role === 'player') await sorgeSpielerEbene(repo, ziel.id, c, ok.user.id);
      return reply.code(201).send({ id: ziel.id, name: ziel.name, role });
    },
  );

  app.put<{ Params: { c: string; u: string }; Body: { role?: string } }>(
    '/api/campaigns/:c/members/:u',
    async (request, reply) => {
      const ok = await aendern(request, reply, request.params.u);
      if (!ok?.ziel) return reply;
      const role = request.body?.role;
      if (!isTableRole(role)) return nein(reply, 400, 'Rolle: gm, co-gm, player oder spectator.');
      const c = request.params.c;
      await repo.putUser({ ...ok.ziel, roles: { ...(ok.ziel.roles ?? {}), [c]: role } });
      await repo.appendEvent('member.role', ok.ziel.id, { campaign: c, role, by: ok.user.id });
      if (role === 'player') await sorgeSpielerEbene(repo, ok.ziel.id, c, ok.user.id);
      return { id: ok.ziel.id, role };
    },
  );

  /** Aus der Kampagne nehmen. Das Konto bleibt, seine Figuren auch — die
   *  hängen am Konto und nicht an der Runde. */
  app.delete<{ Params: { c: string; u: string } }>(
    '/api/campaigns/:c/members/:u',
    async (request, reply) => {
      const ok = await aendern(request, reply, request.params.u);
      if (!ok?.ziel) return reply;
      const c = request.params.c;
      if (!ok.ziel.roles?.[c]) return nein(reply, 404, 'Nicht in dieser Kampagne.');
      const roles = { ...ok.ziel.roles };
      delete roles[c];
      await repo.putUser({ ...ok.ziel, roles });
      await repo.appendEvent('member.role', ok.ziel.id, { campaign: c, role: null, by: ok.user.id });
      return { ok: true };
    },
  );

  /**
   * Welche Figuren ein Mitglied führt. Gesetzt wird die ganze Liste; geändert
   * wird nur, was diese Kampagne vergeben darf (`vergebbar`) — eine Figur
   * einer anderen Runde bleibt, wo sie ist, auch wenn sie in der Liste fehlt.
   *
   * **Eine neue Figur eines Spielers kommt in die Gruppe** (T-100, E-007),
   * ausser die Leitung sagt `party: false`. Wer eine Figur abgibt, bleibt
   * mit ihr, wo er ist: die Gruppe ist Fiktion, nicht das Konto — und eine
   * Kante, die man wegnimmt, nimmt man an der Figur weg.
   */
  app.put<{ Params: { c: string; u: string }; Body: { actorIds?: unknown; party?: unknown } }>(
    '/api/campaigns/:c/members/:u/actors',
    async (request, reply) => {
      const ok = await aendern(request, reply, request.params.u);
      if (!ok?.ziel) return reply;
      const c = request.params.c;
      if (!ok.ziel.roles?.[c]) return nein(reply, 404, 'Nicht in dieser Kampagne.');
      const roh = request.body?.actorIds;
      if (!Array.isArray(roh) || roh.some((x) => typeof x !== 'string')) {
        return nein(reply, 400, 'actorIds: eine Liste von Artikel-Ids.');
      }
      const gewollt = new Set(roh as string[]);
      const alle = new Map((await repo.listEntities()).map((e) => [e.id, e]));
      const bisher = ok.ziel.actorIds ?? [];
      const admin = ok.user.isAdmin;
      for (const id of gewollt) {
        if (bisher.includes(id)) continue;
        if (!alle.has(id)) return nein(reply, 404, `Keine Figur ${id}.`);
        if (!admin && !vergebbar(alle, id, c)) {
          return nein(reply, 403, `${entityName(alle.get(id))} gehört einer anderen Kampagne.`);
        }
      }
      /* Weggenommen wird nur, was diese Kampagne vergeben darf — oder was
         es als Artikel nicht mehr gibt: eine Bindung an nichts ist keine. */
      const bleibt = bisher.filter(
        (id) => gewollt.has(id) || (!admin && alle.has(id) && !vergebbar(alle, id, c)),
      );
      const neu = [...bleibt, ...[...gewollt].filter((id) => !bisher.includes(id))];
      await repo.putUser({ ...ok.ziel, actorIds: neu });
      await repo.appendEvent('member.actors', ok.ziel.id, { campaign: c, actors: neu, by: ok.user.id });
      const party =
        ok.ziel.roles[c] === 'player' && request.body?.party !== false
          ? await inDieGruppe(repo, c, neu.filter((id) => !bisher.includes(id)), ok.user.id)
          : [];
      return { id: ok.ziel.id, actors: figurenMitNamen(alle, neu), party };
    },
  );

  // ---------------------------------------------------- Konten (Verwaltung)

  /** Alle Konten der Installation — nur für die Verwaltung. Der Hash bleibt
   *  hier, wie überall. */
  app.get('/api/users', async (request, reply) => {
    const user = await viewerOf(request);
    if (!user?.isAdmin) return nein(reply, 403, 'Die Kontoliste sieht die Verwaltung.');
    const alle = new Map((await repo.listEntities()).map((e) => [e.id, e]));
    const da = await kampagnen();
    return (await repo.listUsers()).map((u) => ({
      id: u.id,
      name: u.name,
      isAdmin: u.isAdmin,
      disabled: !!u.disabledAt,
      self: u.id === user.id,
      actors: figurenMitNamen(alle, u.actorIds ?? []),
      /* In welchen Ebenen es schreibt (T-098) — ohne die der Kampagnen,
         die es leitet: die kommen aus der Rolle. */
      layers: (u.layerIds ?? []).map((id) => ({
        id,
        name: alle.has(id) ? entityName(alle.get(id)) : null,
        owner: (u.ownedLayerIds ?? []).includes(id),
      })),
      roles: Object.entries(u.roles ?? {}).map(([id, role]) => ({
        campaign: id,
        name: da.has(id) ? entityName(da.get(id)) : id,
        role,
      })),
    }));
  });

  // ---------------------------------------------------------- Einladungen

  /**
   * Einladungen sehen: die Verwaltung alle, Leitung und Mitleitung die ihrer
   * Kampagnen. Der Code steht **genau einmal** in der Antwort auf das
   * Anlegen: gespeichert ist nur sein Hash.
   */
  app.get('/api/invites', async (request, reply) => {
    const user = await viewerOf(request);
    if (!user) return nein(reply, 401, 'Nicht angemeldet.');
    const leitet = Object.values(user.roles ?? {}).some((r) => r === 'gm' || r === 'co-gm');
    if (!user.isAdmin && !leitet) return nein(reply, 403, 'Nicht für dich.');
    const alle = new Map((await repo.listEntities()).map((e) => [e.id, e]));
    return (await repo.listInvites())
      .filter((i) => user.isAdmin || (i.campaignId && rechtAn(user, i.campaignId)))
      .map((i) => ({
        label: i.label ?? null,
        isAdmin: i.isAdmin,
        actorId: i.actorId ?? null,
        actorName: i.actorId && alle.has(i.actorId) ? entityName(alle.get(i.actorId)) : null,
        campaignId: i.campaignId ?? null,
        role: i.role ?? null,
        usesLeft: i.usesLeft ?? null,
        expiresAt: i.expiresAt ?? null,
        createdAt: i.createdAt ?? null,
        may: user.isAdmin ? 'manage' : rechtAn(user, i.campaignId ?? ''),
        /* Der Hash geht mit, damit sich eine Einladung zurücknehmen lässt.
           Aus ihm kommt man nicht auf den Code zurück. */
        handle: i.codeHash,
      }));
  });

  app.post<{
    Body: {
      label?: string;
      admin?: boolean;
      actorId?: string;
      uses?: number;
      days?: number;
      campaignId?: string;
      role?: string;
    };
  }>('/api/invites', async (request, reply) => {
    const user = await viewerOf(request);
    if (!user) return nein(reply, 401, 'Nicht angemeldet.');
    const b = request.body ?? {};
    const c = b.campaignId?.trim() || undefined;
    /* Ohne Kampagne lädt nur die Verwaltung ein — eine Einladung ins
       Nirgendwo ist eine in die Installation. Die Leitung lädt in **ihre**
       Kampagne ein, und Verwaltungskonten vergibt sie nie. */
    if (!user.isAdmin) {
      if (!c || rechtAn(user, c) !== 'manage') return nein(reply, 403, 'Nicht für dich.');
      if (b.admin === true) return nein(reply, 403, 'Verwaltungskonten lädt die Verwaltung ein.');
    }
    const role = b.role ?? (c ? 'player' : undefined);
    if (role !== undefined && !isTableRole(role)) {
      return nein(reply, 400, 'Rolle: gm, co-gm, player oder spectator.');
    }
    if (role && !c) return nein(reply, 400, 'Eine Rolle gilt in einer Kampagne.');
    const actorId = b.actorId?.trim() || undefined;
    if (actorId && !user.isAdmin) {
      const alle = new Map((await repo.listEntities()).map((e) => [e.id, e]));
      if (!c || !vergebbar(alle, actorId, c)) {
        return nein(reply, 403, 'Diese Figur vergibt diese Kampagne nicht.');
      }
    }
    const code = newInviteCode();
    const uses = b.uses == null ? undefined : Math.max(1, Math.floor(Number(b.uses) || 1));
    const days = b.days == null ? undefined : Math.max(1, Math.floor(Number(b.days) || 1));
    const invite: Invite = {
      codeHash: hashToken(code),
      label: b.label?.trim() || undefined,
      isAdmin: b.admin === true,
      actorId,
      usesLeft: uses,
      expiresAt: days ? new Date(Date.now() + days * 86400000).toISOString() : undefined,
      createdBy: user.id,
      campaignId: c,
      role,
    };
    await repo.putInvite(invite);
    await repo.appendEvent('invite.created', user.id, { label: invite.label ?? null, campaign: c ?? null });
    /* Einmal und nie wieder. */
    return reply.code(201).send({ code, handle: invite.codeHash });
  });

  app.delete<{ Params: { handle: string } }>('/api/invites/:handle', async (request, reply) => {
    const user = await viewerOf(request);
    if (!user) return nein(reply, 401, 'Nicht angemeldet.');
    const invite = await repo.getInvite(request.params.handle);
    /* Eine fremde Einladung beantwortet dieselbe Frage wie eine, die es nicht
       gibt — dass da eine ist, geht die Leitung einer anderen Runde nichts
       an. */
    const recht = user.isAdmin ? 'manage' : invite?.campaignId ? rechtAn(user, invite.campaignId) : null;
    if (!invite || !recht) return nein(reply, 404, 'Nicht gefunden');
    if (recht !== 'manage') return nein(reply, 403, 'Einladungen nimmt die Leitung zurück.');
    await repo.dropInvite(invite.codeHash);
    await repo.appendEvent('invite.dropped', user.id, { label: invite.label ?? null });
    return { ok: true };
  });
}

/** Die Leitung zuerst, dann wer mitspielt, dann wer zuschaut. */
const ORDNUNG: Record<TableRole, number> = { gm: 0, 'co-gm': 1, player: 2, spectator: 3 };

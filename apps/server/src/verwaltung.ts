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
  LAYER_COMPONENT,
  LAYER_RELATION,
  activeStack,
  campaignsActivating,
  campaignsOf,
  inStack,
  isOverridden,
  READING_TYPES,
  resolveArticle,
  entityName,
  isTableRole,
  nextId,
  validateEntity,
  withStack,
  type Entity,
  type TableRole,
} from '@nw/model';
import type { Repository, StoredUser } from './repo.js';
import { foldName, hashToken, newInviteCode, type Invite, type User } from './auth.js';

/** Was ein Konto an einer Kampagne darf: ändern, nur sehen, oder nichts. */
export type Recht = 'manage' | 'see' | null;

/** Die Gruppen der Bücher auf der Kampagnenseite, in dieser Reihenfolge (T-081). */
export const BUCHGRUPPEN = ['core', 'sourcebook', 'adventure'];

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
): boolean {
  if (rechtAn(user, campaignId) !== 'manage') return false;
  if (user?.isAdmin) return true;
  const laufen = campaignsActivating(alle, layerId);
  if (laufen.includes(campaignId)) return true;
  return laufen.length !== 1;
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
    };
  });

  /** Eine Kampagne anlegen — wenn es noch keine gibt, kann sonst niemand
   *  eingeladen werden. Ein Artikel wie jeder andere, also über
   *  `validateEntity`. Wer anlegt, leitet sie, wenn er das sagt. */
  app.post<{ Body: { name?: string; lead?: boolean } }>('/api/campaigns', async (request, reply) => {
    const user = await viewerOf(request);
    if (!user?.isAdmin) return nein(reply, 403, 'Eine Kampagne legt die Verwaltung an.');
    const name = String(request.body?.name ?? '').trim();
    if (!name) return nein(reply, 400, 'Wie heisst sie?');
    const alle = await repo.listEntities();
    const entity: Entity = {
      id: randomUUID(),
      interfaces: [CAMPAIGN_TYPE],
      name,
      components: { Identity: { name, id: nextId(alle, CAMPAIGN_TYPE), aliases: [] } },
      relations: [],
    };
    const registry = await repo.getRegistry();
    const issues = validateEntity(registry, entity, {});
    if (issues.length) return reply.code(422).send({ error: 'Validierung fehlgeschlagen', issues });
    await repo.putEntity(entity);
    await repo.appendEvent('entity.written', entity.id, { interfaces: entity.interfaces, cards: ['Identity'] });
    if (request.body?.lead === true) {
      const ich = await repo.getUser(user.id);
      if (ich) await repo.putUser({ ...ich, roles: { ...(ich.roles ?? {}), [entity.id]: 'gm' } });
      await repo.appendEvent('member.role', user.id, { campaign: entity.id, role: 'gm', by: user.id });
    }
    return reply.code(201).send({ id: entity.id, name });
  });

  // ---------------------------------------------------------- Ebenen

  /**
   * Unter welcher Gruppe ein Buch auf der Kampagnenseite steht (T-081):
   * die Marke, die der Importer und die Migration setzen (`core`,
   * `sourcebook`, `adventure`). Nur für `kind: 'book'` und `'adventure'`
   * (T-082) — ein Abenteuer steht immer unter den Abenteuern; eine andere
   * Ebene steht im Stapel und hat keine Gruppe. Beschreibung, keine Regel.
   */
  const buchGruppe = (e: Entity): string => {
    const kind = (e.components?.[LAYER_COMPONENT] as { kind?: unknown } | undefined)?.kind;
    if (kind === 'adventure') return 'adventure';
    if (kind !== 'book') return '';
    const marken = (e.components?.['Tags'] as { tags?: unknown } | undefined)?.tags;
    const g = Array.isArray(marken) ? marken.find((m) => BUCHGRUPPEN.includes(m as string)) : undefined;
    return typeof g === 'string' ? g : 'sourcebook';
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
    const alle = new Map((await repo.listEntities()).map((e) => [e.id, e]));
    const kampagne = alle.get(c);
    if (!kampagne || (kampagne.interfaces ?? [])[0] !== CAMPAIGN_TYPE) {
      return nein(reply, 404, 'Diese Kampagne gibt es nicht als Artikel.');
    }
    const ebenen = [...alle.values()].filter((e) => (e.interfaces ?? [])[0] === LAYER_COMPONENT);
    const zahl = new Map<string, number>();
    /* Ebenen mit Text (T-091): nur an ihnen steht „Read". */
    const text = new Set<string>();
    for (const e of alle.values()) {
      const lesbar = READING_TYPES.includes((e.interfaces ?? [])[0] ?? '');
      for (const r of e.relations ?? []) {
        if (r.type !== LAYER_RELATION || (r.props as { mode?: unknown } | undefined)?.mode === 'removes') continue;
        zahl.set(r.to, (zahl.get(r.to) ?? 0) + 1);
        if (lesbar) text.add(r.to);
      }
    }
    const stapel = activeStack(alle, kampagne).map((x) => x.layer.id);
    const zeile = (e: Entity) => {
      const andere = campaignsActivating(alle, e.id)
        .filter((k) => k !== c)
        .map((k) => entityName(alle.get(k)));
      return {
        id: e.id,
        name: entityName(e),
        kind: String((e.components?.[LAYER_COMPONENT] as { kind?: unknown } | undefined)?.kind ?? ''),
        group: buchGruppe(e),
        articles: zahl.get(e.id) ?? 0,
        readable: text.has(e.id),
        active: stapel.includes(e.id),
        alsoIn: andere,
        canActivate: mayActivate(user, alle, e.id, c),
      };
    };
    const an = stapel.map((id) => alle.get(id)!).map(zeile);
    const aus = ebenen
      .filter((e) => !stapel.includes(e.id))
      .map(zeile)
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));
    return { campaign: { id: c, name: entityName(kampagne) }, may: recht, layers: [...an, ...aus] };
  });

  /** Die Kanten `activates` schreiben — der ganze Stapel, von unten nach
   *  oben. Was fehlt, ist danach abgeschaltet; gelöscht wird nichts. */
  async function stapelSchreiben(
    request: FastifyRequest<{ Params: { c: string } }>,
    reply: FastifyReply,
    neu: (alle: Map<string, Entity>, kampagne: Entity) => string[] | string,
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
    const ids = neu(alle, kampagne);
    if (typeof ids === 'string') return nein(reply, 400, ids);
    const vorher = new Set(activeStack(alle, kampagne).map((x) => x.layer.id));
    for (const id of ids) {
      if ((alle.get(id)?.interfaces ?? [])[0] !== LAYER_COMPONENT) return nein(reply, 400, `Keine Ebene: ${id}`);
      if (!vorher.has(id) && !mayActivate(user, alle, id, c)) {
        return nein(reply, 403, `„${entityName(alle.get(id))}" gehört einer anderen Kampagne; aufschalten kann sie die Verwaltung.`);
      }
    }
    const geschrieben = withStack(kampagne, ids);
    const issues = validateEntity(await repo.getRegistry(), geschrieben, {});
    if (issues.length) return reply.code(422).send({ error: 'Validierung fehlgeschlagen', issues });
    await repo.putEntity(geschrieben);
    await repo.appendEvent('campaign.layers', c, { layers: ids, by: user.id });
    return { ok: true, layers: ids };
  }

  app.put<{ Params: { c: string }; Body: { layers?: unknown } }>('/api/campaigns/:c/layers', (request, reply) =>
    stapelSchreiben(request, reply, () => {
      const l = request.body?.layers;
      if (!Array.isArray(l) || !l.every((x) => typeof x === 'string')) return 'layers: eine Liste von Ebenen-Ids.';
      return l as string[];
    }),
  );

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
   * **Die Geschichte der Kampagne** (T-082, REQ-240): ihre eigenen
   * Geschichtsartikel (`partOf` die Kampagne) und, je aufgeschaltetes
   * Abenteuer, dessen Kapitel — in der Fassung, die in **dieser** Kampagne
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
    const ebenen = new Set(activeStack(alle, kampagne).map((x) => x.layer.id));
    const art = (e: Entity) => (e.interfaces ?? [])[0] ?? '';
    const sorte = (e: Entity) => String((e.components?.['Story'] as { kind?: unknown } | undefined)?.kind ?? '');
    const nummer = (e: Entity) => String((e.components?.['Identity'] as { id?: unknown } | undefined)?.id ?? '');
    const nachNummer = (a: Entity, b: Entity) => nummer(a).localeCompare(nummer(b), 'en', { numeric: true });
    const teilVon = (e: Entity, ziel: string) => (e.relations ?? []).some((r) => r.type === 'partOf' && r.to === ziel);
    const zeile = (e: Entity) => {
      const gilt = resolveArticle(alle, e, kampagne);
      /* Angepasst ist, was eine Fassung ist — ob sie hier über das Original
         oder für sich in die Liste kam. */
      const adapted = (gilt.relations ?? []).some((r) => r.type === 'overrides');
      return { id: gilt.id, name: entityName(gilt), type: art(gilt), kind: sorte(gilt), adapted };
    };
    const geschichte = [...alle.values()].filter((e) => inStack(alle, e, kampagne));
    const eigene = geschichte.filter((e) => teilVon(e, c) && !isOverridden(alle, e, kampagne)).sort(nachNummer).map(zeile);
    const abenteuer = geschichte
      .filter((e) => art(e) === 'Story' && sorte(e) === 'adventure' && (e.relations ?? []).some((r) => r.type === LAYER_RELATION && ebenen.has(r.to)))
      .sort((a, b) => entityName(a).localeCompare(entityName(b), 'en'))
      .map((a) => ({
        ...zeile(a),
        layer: (a.relations ?? []).find((r) => r.type === LAYER_RELATION && ebenen.has(r.to))?.to ?? '',
        chapters: geschichte
          /* Die Originale, nach ihrer Nummer — eine Fassung steht an der
             Stelle dessen, was sie ersetzt (`zeile`), nicht am Ende. */
          .filter((k) => art(k) === 'Story' && teilVon(k, a.id) && !(k.relations ?? []).some((r) => r.type === 'overrides'))
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
    const members = (await repo.listUsers())
      .filter((u) => isTableRole(u.roles?.[c]))
      .map((u) => ({
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
   */
  app.put<{ Params: { c: string; u: string }; Body: { actorIds?: unknown } }>(
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
      return { id: ok.ziel.id, actors: figurenMitNamen(alle, neu) };
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

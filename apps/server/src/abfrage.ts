/**
 * **Die Abfrage-Kachel am Board** (T-340): was eine Kachel mit Quelle
 * bringt, und das Ziehen ohne Zurücklegen.
 *
 *   GET  /api/boards/:board/query/:rel        — die Artikel der Kachel, gesiebt
 *   POST /api/boards/:board/query/:rel/draw   — einen ziehen (wer das Board schreibt)
 *   POST /api/boards/:board/query/:rel/reset  — alles zurücklegen
 *
 * **Gerechnet wird je Betrachter** (CLAUDE.md, „Zurückgehalten wird am
 * Server"): die Kachel nennt nur die Frage (`placed.props.query`), die
 * Antwort ist das, was dieser Betrachter sehen darf — im Stapel, sichtbar,
 * mit dem Wissen gesiebt. Spielende bekommen vom Gezogenen nur, was sie
 * sehen; eine Kachel, die die Leitung zurückhält (`hidden`), gibt es für
 * sie nicht.
 *
 * **Der Stand des Ziehens steht an der Kante** (`drawn`) und gehört diesen
 * Routen — der `PUT` des Boards behält ihn (`keepDrawState`). Gezogen wird
 * aus dem, was der Ziehende sieht: wer leitet, zieht aus allem.
 *
 * **Beim Ziehen freigeben** (`reveal`): das Gezogene wird Wissen der
 * Gruppe — `knownBy` an der gezogenen Information oder an den
 * Informationen des gezogenen Artikels (T-285, T-286), und sieht die
 * Gruppe den Artikel selbst noch nicht, kommt sie in `revealedTo`. Was
 * der Ziehende nicht schreibt, bleibt, wie es ist, und wird genannt.
 */
import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  articleDimensions,
  articleVisible,
  BOARD_TYPE,
  currentCampaign,
  drawNext,
  entityName,
  informationsOf,
  INFO_COMPONENT,
  KNOWN_BY_RELATION,
  partiesOf,
  primaryInterface,
  queryPool,
  queryTileOf,
  QUERY_LIMIT,
  type Entity,
  type Relation,
  type validateEntity,
} from '@nw/model';
import type { User } from './auth.js';
import { RevisionConflict, type Repository } from './repo.js';

interface Stand {
  alle: Entity[];
  map: Map<string, Entity>;
}

export interface AbfrageDeps {
  repo: Repository;
  viewerOf: (request: FastifyRequest) => Promise<User | null>;
  roh: () => Promise<Stand>;
  sieve: (request: FastifyRequest, entities: Entity[], bestand?: Map<string, Entity>) => Promise<Entity[]>;
  schreibeGeprueft: (
    entity: Entity,
    erwartet?: number | null,
  ) => Promise<{ stored: Entity } | { issues: ReturnType<typeof validateEntity> }>;
  darfSchreiben: (request: FastifyRequest, id: string) => Promise<boolean>;
}

const KNOWLEDGE_TYPE = 'Knowledge';
const kante = (von: string, art: string) => `${von}~${art}-${randomUUID().slice(0, 8)}`;

export function registerAbfrage(app: FastifyInstance, deps: AbfrageDeps): void {
  const { repo, viewerOf, roh, sieve, schreibeGeprueft, darfSchreiben } = deps;

  const nein = (reply: FastifyReply, code: number, error: string) => reply.code(code).send({ error });

  /**
   * Das Board, wie dieser Betrachter es sieht, und die Kachel darauf —
   * `null` mit Antwort, wenn es eines davon für ihn nicht gibt.
   */
  async function kachelVon(
    request: FastifyRequest,
    reply: FastifyReply,
    boardId: string,
    relId: string,
  ): Promise<{ stand: Stand; board: Entity; rel: Relation } | null> {
    if (!(await viewerOf(request))) {
      void nein(reply, 401, 'Nicht angemeldet.');
      return null;
    }
    const stand = await roh();
    const roher = stand.map.get(boardId);
    const [board] = roher && primaryInterface(roher) === BOARD_TYPE ? await sieve(request, [roher], stand.map) : [];
    const rel = board?.relations?.find((r) => r.id === relId);
    if (!board || !rel || !queryTileOf(rel)) {
      void nein(reply, 404, 'Diese Abfrage-Kachel gibt es nicht — oder nicht für dich.');
      return null;
    }
    return { stand, board, rel };
  }

  /**
   * **Was die Abfrage diesem Betrachter bringt.** Zuerst über den rohen
   * Bestand eingegrenzt (billig), dann nur diese gesiebt und noch einmal
   * gefragt: das Wissen kann eine Marke wegnehmen, und dann gehört der
   * Artikel für diesen Betrachter nicht dazu.
   */
  async function antwort(request: FastifyRequest, stand: Stand, board: Entity, rel: Relation) {
    const tile = queryTileOf(rel)!;
    const registry = await repo.getRegistry();
    const name = (id: string) => entityName(stand.map.get(id)) || id;
    const dims = articleDimensions(registry, { layerName: name });
    const grob = queryPool(registry, tile.query, stand.alle, dims, { exclude: board.id, limit: Infinity });
    const gesiebt = await sieve(request, grob.rows, stand.map);
    return { tile, pool: queryPool(registry, tile.query, gesiebt, dims, { exclude: board.id, limit: Infinity }) };
  }

  app.get<{ Params: { board: string; rel: string } }>('/api/boards/:board/query/:rel', async (request, reply) => {
    const k = await kachelVon(request, reply, request.params.board, request.params.rel);
    if (!k) return;
    const { tile, pool } = await antwort(request, k.stand, k.board, k.rel);
    const ids = new Set(pool.rows.map((e) => e.id));
    /* Gezogen steht nur, was dieser Betrachter in der Abfrage sieht. */
    const drawn = tile.drawn.filter((id) => ids.has(id));
    const nachId = new Map(pool.rows.map((e) => [e.id, e]));
    /* Die Liste zeigt die ersten `QUERY_LIMIT`; was gezogen ist, kommt
       immer mit, auch wenn es dahinter steht. */
    const zeigen = [...pool.rows.slice(0, QUERY_LIMIT)];
    for (const id of drawn) if (!zeigen.some((e) => e.id === id)) zeigen.push(nachId.get(id)!);
    return {
      title: tile.title,
      display: tile.display,
      interval: tile.interval,
      reveal: tile.reveal,
      view: tile.view,
      items: zeigen,
      total: pool.total,
      drawn,
      remaining: pool.rows.filter((e) => !tile.drawn.includes(e.id)).length,
      unknown: pool.unknown,
      mayDraw: await darfSchreiben(request, k.board.id),
    };
  });

  /** Die Kante neu schreiben, gegen die gelesene Revision — kommt etwas dazwischen, einmal neu. */
  async function kanteSetzen(
    boardId: string,
    relId: string,
    aendern: (props: Record<string, unknown>) => Record<string, unknown> | null,
  ): Promise<{ ok: true; props: Record<string, unknown> } | { ok: false; code: number; error: string }> {
    for (let versuch = 0; versuch < 2; versuch++) {
      const b = await repo.getEntity(boardId);
      const r = b?.relations?.find((x) => x.id === relId);
      if (!b || !r) return { ok: false, code: 404, error: 'Die Kachel gibt es nicht mehr.' };
      const neu = aendern({ ...(r.props ?? {}) });
      if (!neu) return { ok: true, props: r.props ?? {} };
      const board = { ...b, relations: (b.relations ?? []).map((x) => (x.id === relId ? { ...x, props: neu } : x)) };
      try {
        const e = await schreibeGeprueft(board, b.revision ?? null);
        if ('issues' in e) return { ok: false, code: 422, error: e.issues.map((i) => i.message).join('; ') };
        return { ok: true, props: neu };
      } catch (error) {
        if (!(error instanceof RevisionConflict) || versuch) throw error;
      }
    }
    return { ok: false, code: 409, error: 'Das Board wurde gerade geändert.' };
  }

  app.post<{ Params: { board: string; rel: string } }>('/api/boards/:board/query/:rel/draw', async (request, reply) => {
    const k = await kachelVon(request, reply, request.params.board, request.params.rel);
    if (!k) return;
    if (!(await darfSchreiben(request, k.board.id))) return nein(reply, 403, 'Ziehen darf, wer das Board schreibt.');
    const { tile, pool } = await antwort(request, k.stand, k.board, k.rel);
    const ids = pool.rows.map((e) => e.id);
    let gezogen: string | null = null;
    const r = await kanteSetzen(k.board.id, k.rel.id, (props) => {
      /* Gegen den gespeicherten Stand gezogen, nicht gegen den gelesenen:
         zwei Klicks kurz nacheinander ziehen zwei verschiedene. */
      const schon = queryTileOf({ ...k.rel, props })?.drawn ?? [];
      gezogen = drawNext(ids, schon);
      return gezogen ? { ...props, drawn: [...schon, gezogen] } : null;
    });
    if (!r.ok) return nein(reply, r.code, r.error);
    if (!gezogen) return { drawn: null, remaining: 0 };
    const id: string = gezogen;
    await repo.appendEvent('board.drawn', k.board.id, { tile: k.rel.id, drawn: id });
    const revealed = tile.reveal ? await freigeben(request, id, tile.party) : null;
    const [item] = await sieve(request, [(await roh()).map.get(id)!].filter(Boolean));
    return {
      drawn: id,
      item: item ?? null,
      remaining: ids.filter((x) => !((r.props['drawn'] as string[]) ?? []).includes(x)).length,
      ...(revealed ? { revealed } : {}),
    };
  });

  app.post<{ Params: { board: string; rel: string } }>('/api/boards/:board/query/:rel/reset', async (request, reply) => {
    const k = await kachelVon(request, reply, request.params.board, request.params.rel);
    if (!k) return;
    if (!(await darfSchreiben(request, k.board.id))) return nein(reply, 403, 'Zurücksetzen darf, wer das Board schreibt.');
    const r = await kanteSetzen(k.board.id, k.rel.id, (props) => {
      if (!('drawn' in props)) return null;
      const neu = { ...props };
      delete neu['drawn'];
      return neu;
    });
    if (!r.ok) return nein(reply, r.code, r.error);
    await repo.appendEvent('board.reset', k.board.id, { tile: k.rel.id });
    return { drawn: [] };
  });

  /**
   * **Das Gezogene wird Wissen der Gruppe** (T-340, T-285/T-286). Eine
   * Information oder ein Bündel bekommt `knownBy` auf die Gruppe; ein
   * anderer Artikel gibt seine Informationen frei, und sieht die Gruppe
   * ihn selbst noch nicht, kommt sie in `revealedTo`. Schreiben geht wie
   * immer durch `validateEntity`; was der Ziehende nicht schreibt, bleibt.
   */
  async function freigeben(request: FastifyRequest, id: string, partyWahl: string) {
    const stand = await roh();
    const registry = await repo.getRegistry();
    const kampagne = currentCampaign(stand.map, registry.settings ?? null);
    const party = partyWahl && stand.map.get(partyWahl) ? stand.map.get(partyWahl)! : kampagne ? partiesOf(stand.map, kampagne.id)[0] : undefined;
    if (!party) return { party: null, known: 0, visible: false, skipped: [] as string[] };
    const artikel = stand.map.get(id);
    if (!artikel) return { party: party.id, known: 0, visible: false, skipped: [] as string[] };
    const skipped: string[] = [];
    let known = 0;

    const typ = primaryInterface(artikel);
    const traeger = typ === INFO_COMPONENT || typ === KNOWLEDGE_TYPE ? [artikel] : informationsOf(stand.map, artikel, registry);
    for (const t of traeger) {
      const frisch = await repo.getEntity(t.id);
      if (!frisch) continue;
      if ((frisch.relations ?? []).some((r) => r.type === KNOWN_BY_RELATION && r.to === party.id)) {
        known++;
        continue;
      }
      if (!(await darfSchreiben(request, t.id))) {
        skipped.push(entityName(t));
        continue;
      }
      const e = await schreibeGeprueft(
        { ...frisch, relations: [...(frisch.relations ?? []), { id: kante(frisch.id, KNOWN_BY_RELATION), type: KNOWN_BY_RELATION, to: party.id, props: {} }] },
        frisch.revision ?? null,
      );
      if ('issues' in e) skipped.push(entityName(t));
      else known++;
    }

    /* Sieht die Gruppe den Artikel selbst? Gefragt wie für eine Spielerin
       mit einer Figur in der Gruppe — die Gruppe ist ihr Träger. */
    const rolle = kampagne ? { [kampagne.id]: 'player' as const } : {};
    const sieht = (e: Entity) => articleVisible(stand.map, e, { actors: [party.id], roles: rolle });
    let visible = sieht(artikel);
    if (!visible) {
      const frisch = await repo.getEntity(id);
      if (frisch && (await darfSchreiben(request, id))) {
        const vis = (frisch.components?.['Visibility'] ?? {}) as Record<string, unknown>;
        const liste = Array.isArray(vis['revealedTo']) ? (vis['revealedTo'] as string[]) : [];
        const neu: Entity = {
          ...frisch,
          components: { ...frisch.components, Visibility: { ...vis, revealedTo: [...new Set([...liste, party.id])] } },
        };
        const e = await schreibeGeprueft(neu, frisch.revision ?? null);
        if ('issues' in e) skipped.push(entityName(artikel));
        else visible = sieht(e.stored);
      } else skipped.push(entityName(artikel));
    }
    await repo.appendEvent('board.revealed', id, { party: party.id, known, visible });
    return { party: party.id, known, visible, skipped: [...new Set(skipped)] };
  }
}

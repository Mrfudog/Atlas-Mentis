/**
 * **Wegwerfen und Verkaufen direkt am Stück** (T-407, REQ-404).
 *
 * - `POST /api/inventories/:id/discard` mit `{ edge, qty }` nimmt Stück vom
 *   Stapel (`discardPiece`). Ist er ganz weg, **geht seine Instanz mit** —
 *   eine Instanz, die niemand hält, stünde in keiner Liste und wäre nicht
 *   mehr zu finden. Protokolliert als `inventory.discarded`, samt der
 *   alten Kante und der gelöschten Instanz: daraus wird zurückgelegt.
 * - `POST /api/inventories/:id/discard/:event/undo` legt zurück — einmal,
 *   und nur, solange das Inventar noch so steht, wie das Wegwerfen es
 *   hinterliess (Revision). Danach hätte jemand anders etwas getan, und
 *   ein stilles Zurücklegen schöbe sich darunter.
 * - `GET /api/inventories/:id/sell-offers?edge=` nennt die sichtbaren
 *   Läden mit ihrem Ankaufspreis für dieses Stück (`buybackFor`, E-045 b,
 *   E-175), die am Ort der Szene im Spiel zuerst (`shopsHere`). Verkauft
 *   wird dann über die Route des Ladens (`laden.ts`), damit Preis,
 *   Sperre und Protokoll an einer Stelle stehen. Gerechnet wird in der
 *   Grundwährung (Kupfer); Münzsorten warten auf E-129/E-130.
 *
 * Rechte wie beim Inventar (D74): wer es schreibt, und die Leitung jedes.
 * Verkaufen darf die Figur, der es gehört, oder ein Mitglied der Gruppe,
 * deren Truhe es ist; die Münzen gehen ins Inventar, aus dem verkauft wird.
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  buybackFor,
  currentCampaign,
  discardPiece,
  entityName,
  primaryInterface,
  shopsHere,
  SHOP_TYPE,
  tableRole,
  typeChain,
  undoDiscard,
  withVersionPrices,
  type DiscardRefusal,
  type Entity,
  type Relation,
  type validateEntity,
} from '@nw/model';
import type { User } from './auth.js';
import { inventareDerFigur } from './laden.js';
import { RevisionConflict, type Repository } from './repo.js';
import { reservierteSperre } from './reservierung.js';

interface Stand {
  alle: Entity[];
  map: Map<string, Entity>;
}

export interface WegwerfenDeps {
  repo: Repository;
  viewerOf: (request: FastifyRequest) => Promise<User | null>;
  roh: () => Promise<Stand>;
  sieve: (request: FastifyRequest, entities: Entity[], bestand?: Map<string, Entity>) => Promise<Entity[]>;
  schreibeGeprueft: (entity: Entity, erwartet?: number | null) => Promise<{ stored: Entity } | { issues: ReturnType<typeof validateEntity> }>;
  /** Darf dieses Konto den Artikel schreiben (wie an `PUT`)? */
  darfSchreiben: (request: FastifyRequest, id: string) => Promise<boolean>;
}

const GRUND: Record<DiscardRefusal, string> = {
  missing: 'Dieses Stück liegt hier nicht (mehr).',
  reserved: 'Das Stück ist für einen Handwerksauftrag reserviert — erst freigeben.',
  notEmpty: 'Im Behälter liegt noch etwas — erst ausräumen.',
  tooFew: 'So viele sind nicht da.',
};

const ITEM_TYPE = 'Item';

/**
 * **Wem ein Inventar gehört** (T-407): wer es trägt (`carries`) — direkt
 * oder als Behälter darin. Ein Gegenstand trägt sein eigenes Inventar und
 * ist damit nie der Eigentümer; gefragt wird über ihn hinaus.
 */
export function eigentuemerDesInventars(invId: string, map: ReadonlyMap<string, Entity>, registry: Parameters<typeof typeChain>[0]): Entity | undefined {
  for (const x of map.values()) {
    if (!(x.relations ?? []).some((r) => r.type === 'carries')) continue;
    if (typeChain(registry, primaryInterface(x)).includes(ITEM_TYPE)) continue;
    if (inventareDerFigur(x, map).includes(invId)) return x;
  }
  return undefined;
}

/** Ist `traeger` eine Figur des Kontos oder eine Gruppe, in der eine davon steht (`memberOfParty`)? */
export function handeltFuer(user: User, traeger: Entity, map: ReadonlyMap<string, Entity>): boolean {
  const eigene = user.actorIds ?? [];
  if (eigene.includes(traeger.id)) return true;
  return eigene.some((a) => (map.get(a)?.relations ?? []).some((r) => r.type === 'memberOfParty' && r.to === traeger.id));
}

export function registerWegwerfen(app: FastifyInstance, deps: WegwerfenDeps): void {
  const { repo, viewerOf, roh, sieve, schreibeGeprueft, darfSchreiben } = deps;

  /** Angemeldet, das Inventar sichtbar, und ob die Leitung fragt. */
  async function vorbereiten(request: FastifyRequest<{ Params: { id: string } }>) {
    const user = await viewerOf(request);
    if (!user) return { fehler: { code: 401, error: 'Nicht angemeldet' } } as const;
    const stand = await roh();
    const registry = await repo.getRegistry();
    const roherInv = stand.map.get(request.params.id);
    const [sichtbar] = roherInv ? await sieve(request, [roherInv], stand.map) : [];
    if (!roherInv || !sichtbar || primaryInterface(roherInv) !== 'Inventory') return { fehler: { code: 404, error: 'Kein Inventar.' } } as const;
    const kampagne = currentCampaign(stand.map, registry.settings ?? null);
    const rolle = kampagne ? tableRole({ roles: user.roles ?? {} }, kampagne.id) : null;
    const leitet = user.isAdmin || rolle === 'gm' || rolle === 'co-gm';
    return { user, stand, registry, kampagne, leitet, roherInv } as const;
  }

  app.post<{ Params: { id: string }; Body: { edge?: unknown; qty?: unknown } | null }>(
    '/api/inventories/:id/discard',
    async (request, reply) => {
      const v = await vorbereiten(request);
      if ('fehler' in v) return reply.code(v.fehler!.code).send({ error: v.fehler!.error });
      const { user, stand, leitet, roherInv } = v;
      if (!leitet && !(await darfSchreiben(request, roherInv.id))) return reply.code(403).send({ error: 'Das gehört dir nicht.' });
      /* Frisch gelesen: gegen diese Revision wird geschrieben. */
      const inventar = (await repo.getEntity(roherInv.id)) ?? roherInv;
      const qty = Number(request.body?.qty ?? 1);
      const r = discardPiece(inventar, String(request.body?.edge ?? ''), Number.isFinite(qty) ? qty : 1, new Map(stand.map).set(inventar.id, inventar));
      if ('refused' in r) return reply.code(409).send({ error: GRUND[r.refused], refused: r.refused });
      /* Dieselbe Sperre wie an jedem `PUT` (T-134) — die Regel steht an einer Stelle. */
      const gesperrt = await reservierteSperre(repo, user, inventar, r.inventory);
      if (gesperrt) return reply.code(409).send({ error: gesperrt, refused: 'reserved' });
      let geschrieben: Entity;
      try {
        const w = await schreibeGeprueft(r.inventory, inventar.revision ?? null);
        if ('issues' in w) return reply.code(422).send({ error: 'Validierung fehlgeschlagen', issues: w.issues });
        geschrieben = w.stored;
      } catch (fehler) {
        if (fehler instanceof RevisionConflict) return reply.code(409).send({ error: 'Inzwischen hat sich etwas geändert — noch einmal versuchen.' });
        throw fehler;
      }
      /* Die Instanz geht mit — vorher festgehalten, damit Rückgängig sie zurücklegt. */
      let instanz: Entity | undefined;
      let autoren: string[] = [];
      if (r.orphan) {
        instanz = await repo.getEntity(r.orphan);
        autoren = await repo.authorsOf(r.orphan);
        await repo.deleteEntity(r.orphan);
      }
      const item = stand.map.get(r.item);
      const undo = await repo.appendEvent('inventory.discarded', inventar.id, {
        item: r.item,
        qty: r.qty,
        edge: r.edge,
        revision: geschrieben.revision ?? null,
        ...(instanz ? { instance: instanz, authors: autoren } : {}),
        by: user.id,
      });
      return { item: { id: r.item, name: entityName(item) }, qty: r.qty, removed: !!r.orphan || !(r.inventory.relations ?? []).some((x) => x.id === r.edge.id), undo };
    },
  );

  app.post<{ Params: { id: string; event: string } }>(
    '/api/inventories/:id/discard/:event/undo',
    async (request, reply) => {
      const v = await vorbereiten(request);
      if ('fehler' in v) return reply.code(v.fehler!.code).send({ error: v.fehler!.error });
      const { user, leitet, roherInv } = v;
      const ev = await repo.getEvent(request.params.event);
      if (!ev || ev.name !== 'inventory.discarded' || ev.subject !== roherInv.id) return reply.code(404).send({ error: 'Nichts zum Zurücklegen.' });
      const p = ev.payload as { edge: Relation; qty: number; revision: number | null; instance?: Entity; authors?: string[]; by: string };
      /* Zurücklegen darf, wer weggeworfen hat — und die Leitung. */
      if (!leitet && p.by !== user.id) return reply.code(403).send({ error: 'Das hast nicht du weggeworfen.' });
      const schon = await repo.listEvents({ name: 'inventory.discard-undone', subject: roherInv.id, limit: 50 });
      if (schon.some((x) => (x.payload as { of?: string }).of === ev.id)) return reply.code(409).send({ error: 'Schon zurückgelegt.' });
      const inventar = (await repo.getEntity(roherInv.id)) ?? roherInv;
      if ((inventar.revision ?? null) !== p.revision) {
        return reply.code(409).send({ error: 'Das Inventar hat sich seither geändert — von Hand zurücklegen.' });
      }
      if (p.instance && !(await repo.getEntity(p.instance.id))) {
        const { revision: _r, ...rein } = p.instance;
        const w = await schreibeGeprueft(rein as Entity, null);
        if ('issues' in w) return reply.code(422).send({ error: 'Validierung fehlgeschlagen', issues: w.issues });
        for (const a of p.authors ?? []) await repo.addAuthored(a, p.instance.id);
      }
      try {
        const w = await schreibeGeprueft(undoDiscard(inventar, { edge: p.edge, qty: p.qty }), inventar.revision ?? null);
        if ('issues' in w) return reply.code(422).send({ error: 'Validierung fehlgeschlagen', issues: w.issues });
      } catch (fehler) {
        if (fehler instanceof RevisionConflict) return reply.code(409).send({ error: 'Inzwischen hat sich etwas geändert — noch einmal versuchen.' });
        throw fehler;
      }
      await repo.appendEvent('inventory.discard-undone', roherInv.id, { of: ev.id, by: user.id });
      return { ok: true };
    },
  );

  app.get<{ Params: { id: string }; Querystring: { edge?: string } }>(
    '/api/inventories/:id/sell-offers',
    async (request, reply) => {
      const v = await vorbereiten(request);
      if ('fehler' in v) return reply.code(v.fehler!.code).send({ error: v.fehler!.error });
      const { user, stand, registry, kampagne, leitet, roherInv } = v;
      const traeger = eigentuemerDesInventars(roherInv.id, stand.map, registry);
      if (!traeger) return reply.code(409).send({ error: 'Dieses Inventar trägt niemand — verkaufen kann nur eine Figur oder Gruppe.' });
      if (!leitet && !handeltFuer(user, traeger, stand.map)) return reply.code(403).send({ error: 'Das gehört dir nicht.' });
      const kante = (roherInv.relations ?? []).find((r) => r.type === 'holds' && r.id === String(request.query.edge ?? ''));
      if (!kante) return reply.code(404).send({ error: GRUND.missing });
      const preise = withVersionPrices(stand.map, kampagne, registry);
      const item = preise.get(kante.to);
      const laeden = stand.alle.filter((x) => typeChain(registry, primaryInterface(x)).includes(SHOP_TYPE));
      const sichtbar = await sieve(request, laeden, stand.map);
      const hier = shopsHere(registry, stand.map, kampagne?.id ?? null);
      const offers = sichtbar
        .map((laden) => {
          const a = buybackFor(laden, item, preise, registry);
          return {
            shop: laden.id,
            name: entityName(laden),
            here: hier.has(laden.id),
            ...('refused' in a ? { refused: a.refused } : { unit: a.unit, rate: a.rate, from: a.from }),
          };
        })
        .sort((a, b) => Number(b.here) - Number(a.here) || a.name.localeCompare(b.name));
      return {
        actor: traeger.id,
        qty: Math.max(1, Math.trunc(Number(kante.props?.['qty'])) || 1),
        ...(kante.props?.['reservedFor'] ? { refused: 'reserved', error: GRUND.reserved } : {}),
        offers,
      };
    },
  );
}

/**
 * **Wegwerfen und die Läden in der Nähe** (T-407, REQ-404).
 *
 * Wegwerfen nimmt `qty` Stück vom Stapel einer `holds`-Kante. Ist der
 * Stapel ganz weg und war das Stück eine **Instanz** (T-150), die sonst
 * niemand hält, nennt `orphan` sie — der Aufrufer löscht sie mit. Sonst
 * bliebe ein Stück zurück, das in keinem Inventar liegt und in keiner
 * Liste steht (die T-133-Notiz). Ein Grundartikel geht nie mit: auf ihn
 * zeigt die Kante nur in alten Beständen, und er gehört dem Kompendium.
 *
 * Was nicht geht, sagt der Grund: ein reserviertes Stück (T-128, T-134),
 * ein Behälter, in dem noch etwas liegt (sein Inhalt ginge sonst mit),
 * mehr, als da sind. Dieselben Gründe wie beim Verkauf (`sellPiece`).
 *
 * **Rückgängig** (`undoDiscard`) legt die alte Kante samt Lage zurück
 * oder zählt den Teil auf den Stapel, der noch da ist. Ob das Inventar
 * inzwischen anders aussieht, fragt der Server an der Revision.
 */
import { sessionsOf } from './campaignboard.js';
import { primaryInterface, typeChain } from './entity.js';
import { isInstance } from './instance.js';
import { sessionState } from './maplist.js';
import { SHOP_TYPE } from './shop.js';
import type { Entity, EntityId, Registry, Relation } from './types.js';

export type DiscardRefusal = 'missing' | 'reserved' | 'notEmpty' | 'tooFew';

const stueck = (n: unknown): number => Math.max(1, Math.trunc(Number(n) || 1));

/** Hält irgendein Inventar ausser `ausser` (diese Kante) das Stück noch? */
function nochGehalten(entities: ReadonlyMap<EntityId, Entity>, item: EntityId, ausser: Relation): boolean {
  for (const x of entities.values()) {
    for (const r of x.relations ?? []) if (r.type === 'holds' && r.to === item && r.id !== ausser.id) return true;
  }
  return false;
}

export function discardPiece(
  inventory: Entity,
  edgeId: string,
  qty: number,
  entities: ReadonlyMap<EntityId, Entity>,
): { inventory: Entity; item: EntityId; qty: number; edge: Relation; orphan?: EntityId } | { refused: DiscardRefusal } {
  const kante = (inventory.relations ?? []).find((r) => r.id === edgeId && r.type === 'holds');
  if (!kante) return { refused: 'missing' };
  if (kante.props?.['reservedFor']) return { refused: 'reserved' };
  const item = entities.get(kante.to);
  const voll = (item?.relations ?? []).some(
    (c) => c.type === 'carries' && (entities.get(c.to)?.relations ?? []).some((h) => h.type === 'holds'),
  );
  if (voll) return { refused: 'notEmpty' };
  const alle = stueck(kante.props?.['qty']);
  const n = stueck(qty);
  if (n > alle) return { refused: 'tooFew' };
  const weg = n >= alle;
  const relations = (inventory.relations ?? []).flatMap((r) => {
    if (r !== kante) return [r];
    return weg ? [] : [{ ...r, props: { ...(r.props ?? {}), qty: alle - n } }];
  });
  const waise = weg && item && isInstance(item) && !nochGehalten(entities, item.id, kante);
  return { inventory: { ...inventory, relations }, item: kante.to, qty: n, edge: kante, ...(waise ? { orphan: item.id } : {}) };
}

/** Die Kante, wie sie vor dem Wegwerfen stand, und wie viele weggingen. */
export interface DiscardRecord {
  edge: Relation;
  qty: number;
}

export function undoDiscard(inventory: Entity, record: DiscardRecord): Entity {
  const da = (inventory.relations ?? []).find((r) => r.id === record.edge.id);
  if (!da) return { ...inventory, relations: [...(inventory.relations ?? []), record.edge] };
  const relations = (inventory.relations ?? []).map((r) =>
    r === da ? { ...r, props: { ...(r.props ?? {}), qty: stueck(r.props?.['qty']) + stueck(record.qty) } } : r,
  );
  return { ...inventory, relations };
}

/**
 * **Welche Läden die Figur gerade erreicht** (REQ-404): die am Ort dessen,
 * was an der laufenden Sitzung im Spiel steht — Szene und Karte
 * (`activeScene`, `activeMap`). Ein Laden zählt, wenn er mit ihnen eine
 * Kante teilt (in einer der beiden Richtungen) oder `partOf` in einem Ort
 * liegt, den sie nennen oder der sie nennt. Weiter nicht: ein Viertel
 * enthält eine Stadt voller Läden, und „in der Nähe" hiesse dann „überall".
 * Eine Figur hat keinen eigenen Standort im Modell; wo die Gruppe ist, sagt
 * der Tisch. Steht nichts im Spiel, ist die Menge leer, und die Maske
 * bietet alle sichtbaren Läden an.
 */
export function shopsHere(
  registry: Pick<Registry, 'interfaces'>,
  entities: ReadonlyMap<EntityId, Entity>,
  campaignId: EntityId | null,
): Set<EntityId> {
  const raus = new Set<EntityId>();
  if (!campaignId) return raus;
  const { current } = sessionsOf(entities as Map<EntityId, Entity>, campaignId);
  if (!current) return raus;
  const st = sessionState(current);
  const spots = [st['activeScene'], st['activeMap']].filter((v): v is string => typeof v === 'string' && v !== '');
  if (!spots.length) return raus;
  const nah = new Set<EntityId>(spots);
  for (const s of spots) for (const r of entities.get(s)?.relations ?? []) nah.add(r.to);
  for (const x of entities.values()) if ((x.relations ?? []).some((r) => spots.includes(r.to))) nah.add(x.id);
  for (const x of entities.values()) {
    if (!typeChain(registry, primaryInterface(x)).includes(SHOP_TYPE)) continue;
    if (nah.has(x.id) || (x.relations ?? []).some((r) => r.type === 'partOf' && nah.has(r.to))) raus.add(x.id);
  }
  return raus;
}

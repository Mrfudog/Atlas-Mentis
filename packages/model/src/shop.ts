/**
 * **Ein Laden und seine Preise** (T-129).
 *
 * Ein Laden (`Shop`) ist ein Ort. Was er führt, steht an der Kante `sells`
 * zum Gegenstand — mit Menge (`qty`), einem eigenen Preis statt des
 * Listenpreises (`price`, in Kupfer wie `Item.copperPrice`), einem Abschlag
 * nur für diese Ware (`mod`) und ob sie gerade zu haben ist (`available`).
 * Dieselbe Fackel kostet im einen Laden mehr als im anderen, und ein Feld
 * am Gegenstand könnte nur eine der beiden Wahrheiten tragen.
 *
 * **Ein Abschlag ist ein Wort** (`−10 gp`, `−10 %`, `+5 sp`): absolut in
 * Münzen oder relativ in Prozent. Was sich nicht lesen lässt, gilt nicht
 * und steht trotzdem in der Herkunft (`invalid`) — ein still verschluckter
 * Rabatt sähe aus wie ein Laden ohne Rabatt.
 *
 * **Der Preis wird beim Lesen gerechnet, nie gespeichert** (D8), und er
 * sagt, woher jeder Abschlag kommt (`steps`). Gelesen werden:
 *  1. `Shop.priceMod` — der Laden für alle;
 *  2. `sells.props.mod` — diese Ware;
 *  3. `discount` von einem **Geber** an einen **Empfänger**: Geber sind der
 *     Laden selbst, die Fraktionen, die ihn kontrollieren (`controls`), und
 *     seine Ladenhalter (`shopkeeper`). Empfänger ist die kaufende Figur,
 *     eine ihrer Gruppen (`memberOfParty`) oder eine ihrer Fraktionen
 *     (`memberOf`) — dort ab dem Rang an der Kante (`props.rank`, ein Wort
 *     aus `Faction.ranks`, A7). Ein Rang, der nicht in der Leiter steht,
 *     gewährt nichts: ein Tippfehler darf nichts aufschliessen.
 *
 * **Was einer vom anderen hält, rechnet nicht mit.** `regards` bleibt eine
 * Kante mit Marken (REQ-081); ein Ladenhalter, der Rook etwas schuldet,
 * gibt ihm einen `discount`. Ob Marken einmal Preise bewegen, ist offen
 * (E-043).
 *
 * **Prozent rechnen auf den Grundpreis**, nicht aufeinander: −10 % und
 * −10 % sind −20 %, gleich in welcher Reihenfolge die Kanten stehen. Jeder
 * Schritt wird auf Kupfer gerundet, und der Preis fällt nicht unter null.
 */

import { entityName } from './entity.js';
import { itemPrice } from './equipment.js';
import { factionRanks } from './knowledge.js';
import type { Entity, EntityId } from './types.js';

export const SHOP_TYPE = 'Shop';

/** Münzen in Kupfer, wie 5e sie zählt. */
const MUENZE: Readonly<Record<string, number>> = { pp: 1000, gp: 100, ep: 50, sp: 10, cp: 1 };

export type PriceMod = { kind: 'flat'; cp: number } | { kind: 'pct'; pct: number };

/**
 * Liest einen Abschlag: `−10 gp`, `-10%`, `+5 sp`, `10 %`. Ohne Vorzeichen
 * ist er ein Aufschlag. Eine Zahl ohne Einheit ist keiner — `−10` könnte
 * Gold oder Prozent meinen, und geraten wird nicht.
 */
export function parsePriceMod(raw: unknown): PriceMod | null {
  if (typeof raw !== 'string') return null;
  const m = /^\s*([+\-−–])?\s*(\d+(?:[.,]\d+)?)\s*(%|pp|gp|ep|sp|cp)\s*$/i.exec(raw);
  if (!m) return null;
  const n = Number(m[2]!.replace(',', '.')) * (m[1] && m[1] !== '+' ? -1 : 1);
  if (!Number.isFinite(n)) return null;
  const unit = m[3]!.toLowerCase();
  return unit === '%' ? { kind: 'pct', pct: n } : { kind: 'flat', cp: Math.round(n * MUENZE[unit]!) };
}

/** Woher ein Abschlag kommt. */
export interface PriceStep {
  by: 'shop' | 'ware' | 'discount';
  /** Wer ihn gibt: der Laden, eine Fraktion, ein Ladenhalter. */
  giver?: EntityId;
  /** An wen er geht: die Figur, ihre Gruppe, ihre Fraktion. */
  target?: EntityId;
  /** Der verlangte Mindestrang (`discount` an eine Fraktion). */
  rank?: string;
  /** Das Wort, wie es dasteht. */
  mod: string;
  /** Was er am Preis ändert, in Kupfer; 0, wenn er sich nicht lesen lässt. */
  delta: number;
  invalid?: boolean;
}

export interface WareOffer {
  /** Die Id der `sells`-Kante. */
  edge: string;
  item: EntityId;
  name: string;
  /** Leer heisst: so viele, wie man will. */
  qty?: number;
  available: boolean;
  /** Der Listenpreis des Gegenstands. */
  list?: number;
  /** Was der Laden verlangt, bevor Abschläge greifen. */
  base?: number;
  /** Nach allen Abschlägen; fehlt, wenn es keinen Grundpreis gibt. */
  price?: number;
  steps: PriceStep[];
}

export interface ShopContext {
  entities: ReadonlyMap<EntityId, Entity>;
  /** Wer kauft: eine Figur oder eine Gruppe. Ohne: der Preis am Tisch. */
  buyer?: Entity;
}

const zahl = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const kanten = (e: Entity | undefined, type: string) => (e?.relations ?? []).filter((r) => r.type === type);

/** Wer an diesem Laden Rabatte gibt: er selbst, wer ihn kontrolliert, wer ihn hält. */
export function shopGivers(shop: Entity, entities: ReadonlyMap<EntityId, Entity>): Entity[] {
  const out: Entity[] = [shop];
  for (const e of entities.values()) {
    if (e.id !== shop.id && kanten(e, 'controls').some((r) => r.to === shop.id)) out.push(e);
  }
  for (const r of kanten(shop, 'shopkeeper')) {
    const k = entities.get(r.to);
    if (k && !out.includes(k)) out.push(k);
  }
  return out;
}

/** Ab welcher Sprosse der Käufer in dieser Fraktion steht: `-1` ohne Rang, `null` kein Mitglied. */
function sprosse(buyer: Entity, factionId: EntityId, entities: ReadonlyMap<EntityId, Entity>): number | null {
  const leiter = factionRanks(entities.get(factionId));
  let best: number | null = null;
  for (const r of kanten(buyer, 'memberOf')) {
    if (r.to !== factionId) continue;
    const rank = typeof r.props?.['rank'] === 'string' ? (r.props['rank'] as string) : '';
    const idx = rank ? leiter.indexOf(rank) : -1;
    if (best === null || idx > best) best = idx;
  }
  return best;
}

/** Gilt ein Rabatt an `target` (mit Mindestrang) für diesen Käufer? */
function trifft(buyer: Entity, target: EntityId, rank: string | undefined, entities: ReadonlyMap<EntityId, Entity>): boolean {
  /* Ein Rang zählt nur an einer Fraktion; an Figur und Gruppe gibt es keine Leiter. */
  if (target === buyer.id) return true;
  if (kanten(buyer, 'memberOfParty').some((r) => r.to === target)) return true;
  const hat = sprosse(buyer, target, entities);
  if (hat === null) return false;
  if (!rank) return true;
  const braucht = factionRanks(entities.get(target)).indexOf(rank);
  return braucht >= 0 && hat >= braucht;
}

/** Die Abschläge, die nicht an einer Ware hängen: der Laden und die Rabatte seiner Geber. */
function ladenAbschlaege(shop: Entity, ctx: ShopContext): Omit<PriceStep, 'delta'>[] {
  const out: Omit<PriceStep, 'delta'>[] = [];
  const eigen = shop.components?.[SHOP_TYPE]?.['priceMod'];
  if (typeof eigen === 'string' && eigen.trim()) out.push({ by: 'shop', giver: shop.id, mod: eigen.trim() });
  const buyer = ctx.buyer;
  if (!buyer) return out;
  for (const g of shopGivers(shop, ctx.entities)) {
    for (const r of kanten(g, 'discount')) {
      const mod = typeof r.props?.['mod'] === 'string' ? (r.props['mod'] as string).trim() : '';
      const rank = typeof r.props?.['rank'] === 'string' && r.props['rank'] ? (r.props['rank'] as string) : undefined;
      if (mod && trifft(buyer, r.to, rank, ctx.entities)) {
        out.push({ by: 'discount', giver: g.id, target: r.to, ...(rank ? { rank } : {}), mod });
      }
    }
  }
  return out;
}

/** Rechnet die Abschläge auf einen Grundpreis — Prozent auf den Grundpreis, nie unter null. */
export function applyPriceMods(base: number | undefined, mods: readonly Omit<PriceStep, 'delta'>[]): { price?: number; steps: PriceStep[] } {
  const steps: PriceStep[] = mods.map((m) => {
    const p = parsePriceMod(m.mod);
    if (!p) return { ...m, delta: 0, invalid: true };
    const delta = p.kind === 'flat' ? p.cp : base === undefined ? 0 : Math.round((base * p.pct) / 100);
    return { ...m, delta };
  });
  if (base === undefined) return { steps };
  const price = Math.max(0, base + steps.reduce((s, x) => s + x.delta, 0));
  return { price, steps };
}

/** Die Waren eines Ladens mit ihren Preisen für diesen Käufer — in Reihenfolge der Kanten. */
export function shopWares(shop: Entity, ctx: ShopContext): WareOffer[] {
  const laden = ladenAbschlaege(shop, ctx);
  const out: WareOffer[] = [];
  for (const r of kanten(shop, 'sells')) {
    const item = ctx.entities.get(r.to);
    if (!item) continue;
    const list = itemPrice(item);
    const eigen = zahl(r.props?.['price']);
    const base = eigen !== undefined && eigen >= 0 ? eigen : list;
    const ware = typeof r.props?.['mod'] === 'string' && (r.props['mod'] as string).trim()
      ? [{ by: 'ware' as const, mod: (r.props['mod'] as string).trim() }]
      : [];
    const { price, steps } = applyPriceMods(base, [...laden, ...ware]);
    const qty = zahl(r.props?.['qty']);
    out.push({
      edge: r.id,
      item: item.id,
      name: entityName(item),
      ...(qty !== undefined ? { qty } : {}),
      available: r.props?.['available'] !== false && qty !== 0,
      ...(list !== undefined ? { list } : {}),
      ...(base !== undefined ? { base } : {}),
      ...(price !== undefined ? { price } : {}),
      steps,
    });
  }
  return out;
}

// ------------------------------------------------------------ Kaufen und Verkaufen (T-133)

/**
 * Warum ein Handel nicht zustande kommt. `soldOut` ist eine gezählte Ware
 * bei null, `unavailable` eine, die der Laden gerade nicht hergibt,
 * `tooFew` mehr verlangt als da ist, `noPrice` eine Ware ohne Grundpreis
 * — verschenkt wird nichts, nur weil niemand einen Preis eingetragen hat.
 */
export type TradeRefusal = 'missing' | 'unavailable' | 'soldOut' | 'tooFew' | 'noPrice' | 'tooPoor' | 'reserved' | 'notEmpty';

const INVENTORY = 'Inventory';
const kupferIn = (inv: Entity): number => Math.max(0, Math.trunc(Number(inv.components?.[INVENTORY]?.['copper']) || 0));
const mitKupfer = (inv: Entity, copper: number): Entity => ({
  ...inv,
  components: { ...(inv.components ?? {}), [INVENTORY]: { ...(inv.components?.[INVENTORY] ?? {}), copper } },
});
const stueck = (n: unknown): number => Math.max(1, Math.trunc(Number(n) || 1));

/** Ein loser Stapel desselben Gegenstands: nicht reserviert, nirgends hingelegt. */
const loseGleich = (item: EntityId) => (r: { type: string; to: string; props?: Record<string, unknown> }) =>
  r.type === 'holds' && r.to === item && !r.props?.['reservedFor'] && ['gx', 'gy', 'rot', 'slot'].every((k) => r.props?.[k] === undefined || r.props?.[k] === null);

/**
 * **Kaufen** (T-133): `qty` Stück der Ware `offer` — mit dem Preis, den
 * `shopWares` für diese Figur gerechnet hat (am Server, nie aus der
 * Maske). Die gezählte Menge an `sells` sinkt (leer bleibt unbegrenzt),
 * der Gegenstand kommt per `holds` ins Inventar — auf einen losen Stapel
 * desselben, wenn einer daliegt —, und `Inventory.copper` sinkt um den
 * Preis mal Menge. Laden und Inventar kommen neu zurück; die alten bleiben
 * unberührt.
 */
export function buyWare(
  shop: Entity,
  inventory: Entity,
  offer: WareOffer,
  qty: number,
  newId: string,
): { shop: Entity; inventory: Entity; unit: number; total: number } | { refused: TradeRefusal } {
  const kante = kanten(shop, 'sells').find((r) => r.id === offer.edge);
  if (!kante) return { refused: 'missing' };
  if (offer.qty === 0) return { refused: 'soldOut' };
  if (!offer.available) return { refused: 'unavailable' };
  const n = stueck(qty);
  if (offer.qty !== undefined && n > offer.qty) return { refused: 'tooFew' };
  if (offer.price === undefined) return { refused: 'noPrice' };
  const total = offer.price * n;
  const hat = kupferIn(inventory);
  if (total > hat) return { refused: 'tooPoor' };
  const neuerLaden: Entity =
    offer.qty === undefined
      ? shop
      : { ...shop, relations: (shop.relations ?? []).map((r) => (r === kante ? { ...r, props: { ...(r.props ?? {}), qty: offer.qty! - n } } : r)) };
  const liste = inventory.relations ?? [];
  const da = liste.find(loseGleich(offer.item));
  const relations = da
    ? liste.map((r) => (r === da ? { ...r, props: { ...(r.props ?? {}), qty: stueck(r.props?.['qty']) + n } } : r))
    : [...liste, { id: newId, type: 'holds', to: offer.item, props: { qty: n, tier: 'pack' } }];
  return { shop: neuerLaden, inventory: mitKupfer({ ...inventory, relations }, hat - total), unit: offer.price, total };
}

/**
 * **Was ein Laden für ein Stück zahlt** (T-133): die Hälfte des
 * Listenpreises, abgerundet auf Kupfer — die Regel aus 5e. Rabatte gelten
 * beim Kaufen, nicht hier. Ob ein Laden einen eigenen Satz trägt, ist
 * offen (E-045); diese Stelle ist die eine, die es dann rechnet.
 */
export function buybackPrice(item: Entity | undefined): number | undefined {
  const list = itemPrice(item);
  return list === undefined ? undefined : Math.floor(list / 2);
}

/**
 * **Verkaufen** (T-133): `qty` Stück vom Stapel `edgeId` aus dem Inventar
 * an den Laden, zum Ankaufspreis (`buybackPrice`). Ein reserviertes Stück
 * (`reservedFor`, T-128) bleibt, wo es ist, und ein Behälter, in dem noch
 * etwas liegt, auch — sein Inhalt ginge sonst mit über den Tresen. Führt
 * der Laden den Gegenstand schon mit gezählter Menge, steigt sie; sonst
 * nimmt er ihn nicht ins Sortiment.
 */
export function sellPiece(
  shop: Entity,
  inventory: Entity,
  edgeId: string,
  qty: number,
  entities: ReadonlyMap<EntityId, Entity>,
): { shop: Entity; inventory: Entity; item: EntityId; qty: number; unit: number; total: number } | { refused: TradeRefusal } {
  const kante = (inventory.relations ?? []).find((r) => r.id === edgeId && r.type === 'holds');
  if (!kante) return { refused: 'missing' };
  if (kante.props?.['reservedFor']) return { refused: 'reserved' };
  const item = entities.get(kante.to);
  const voll = kanten(item, 'carries').some((c) => kanten(entities.get(c.to), 'holds').length > 0);
  if (voll) return { refused: 'notEmpty' };
  const unit = buybackPrice(item);
  if (unit === undefined) return { refused: 'noPrice' };
  const alle = stueck(kante.props?.['qty']);
  const n = stueck(qty);
  if (n > alle) return { refused: 'tooFew' };
  const relations = (inventory.relations ?? []).flatMap((r) => {
    if (r !== kante) return [r];
    return n < alle ? [{ ...r, props: { ...(r.props ?? {}), qty: alle - n } }] : [];
  });
  const total = unit * n;
  const ware = kanten(shop, 'sells').find((r) => r.to === kante.to && zahl(r.props?.['qty']) !== undefined);
  const neuerLaden: Entity = ware
    ? { ...shop, relations: (shop.relations ?? []).map((r) => (r === ware ? { ...r, props: { ...(r.props ?? {}), qty: zahl(r.props?.['qty'])! + n } } : r)) }
    : shop;
  return { shop: neuerLaden, inventory: mitKupfer({ ...inventory, relations }, kupferIn(inventory) + total), item: kante.to, qty: n, unit, total };
}

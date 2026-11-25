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
 * **Der Listenpreis kommt aus der geltenden Fassung** (T-139): die Kante
 * `sells` zeigt aufs Original, und eine aufgeschaltete Ebene darf es
 * überschreiben — etwa „AI generated prices" mit einem geschätzten Preis.
 * Der Server reicht dafür eine **Preissicht** herein (`withVersionPrices`):
 * jedes Original trägt Preis und Herkunft seiner geltenden Fassung, sonst
 * bleibt alles, wie es ist — Ids, Kanten, Instanzen. So rechnen Kaufen,
 * Verkaufen und Ankauf (T-133) mit demselben Preis, ohne dass jede Stelle
 * den Stapel kennt. Woher der Preis kommt, reitet als `listNote` mit
 * (`Item.priceNote`) — ein geschätzter soll als solcher dastehen.
 *
 * **Prozent rechnen auf den Grundpreis**, nicht aufeinander: −10 % und
 * −10 % sind −20 %, gleich in welcher Reihenfolge die Kanten stehen. Jeder
 * Schritt wird auf Kupfer gerundet, und der Preis fällt nicht unter null.
 */

import { collectionMemberIds } from './collection.js';
import { entityName, primaryInterface, typeChain } from './entity.js';
import { itemPrice } from './equipment.js';
import { factionRanks } from './knowledge.js';
import { followsTemplate, isInstance, resolveInstance, templateOf } from './instance.js';
import { piecePrice, type ItemPricing } from './enhancement.js';
import { overridersIndex, resolveArticle } from './stack.js';
import type { Entity, EntityId, Registry } from './types.js';

export const SHOP_TYPE = 'Shop';
/** Die Art, deren Artikel ein Laden als Kategorie verkauft oder ankauft (E-174, E-175). */
const COLLECTION_TYPE = 'Collection';
/** Der Ankaufssatz, wenn der Laden keinen nennt: die Hälfte, die Regel aus 5e (E-045 b). */
export const DEFAULT_BUY_RATE = 50;

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
  by: 'shop' | 'ware' | 'collection' | 'discount';
  /** Wer ihn gibt: der Laden, eine Fraktion, ein Ladenhalter — oder die Collection, über die die Ware kommt. */
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
  /** Die Id der `sells`-Kante — bei einer Collection teilen sich ihre Mitglieder eine. */
  edge: string;
  item: EntityId;
  /** Über welche Collection die Ware kommt (REQ-439); fehlt bei einer Kante auf den Gegenstand. */
  via?: EntityId;
  name: string;
  /** Leer heisst: so viele, wie man will. */
  qty?: number;
  available: boolean;
  /** Der Listenpreis des Gegenstands (aus der geltenden Fassung, T-139). */
  list?: number;
  /** Woher der Listenpreis kommt (`Item.priceNote`), etwa „estimated: …". */
  listNote?: string;
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
  /** Für Collections (`sells` auf eine Kategorie): ihre Regel gilt die `extends`-Kette hoch. */
  registry?: Pick<Registry, 'interfaces'>;
}

const zahl = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const kanten = (e: Entity | undefined, type: string) => (e?.relations ?? []).filter((r) => r.type === type);
const OHNE_REGISTER: Pick<Registry, 'interfaces'> = { interfaces: {} };

/** Ist dieser Artikel eine Collection (oder ein Untertyp wie die Materialgruppe)? */
function istSammlung(e: Entity, registry: Pick<Registry, 'interfaces'>): boolean {
  const typ = primaryInterface(e);
  const kette = typeChain(registry, typ);
  return (kette.length ? kette : [typ]).includes(COLLECTION_TYPE) || !!e.components?.[COLLECTION_TYPE];
}

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

/**
 * **Die Preissicht** (T-139): der Bestand, in dem jeder Gegenstand Preis
 * und Herkunft (`copperPrice`, `priceNote`) der Fassung trägt, die in
 * dieser Kampagne gilt (`resolveArticle`). Sonst bleibt jeder Artikel, wie
 * er ist — die Ids an `sells` und `holds` treffen weiter. Nur zum Rechnen:
 * geschrieben wird nie aus dieser Sicht.
 */
export function withVersionPrices(
  entities: ReadonlyMap<EntityId, Entity>,
  campaign: Entity | null,
  registry?: Pick<Registry, 'interfaces'>,
): Map<EntityId, Entity> {
  const out = new Map(entities);
  if (!campaign) return out;
  const alle = entities instanceof Map ? (entities as Map<EntityId, Entity>) : new Map(entities);
  const index = overridersIndex(alle.values());
  for (const id of index.keys()) {
    const e = alle.get(id);
    if (!e?.components?.['Item']) continue;
    const g = resolveArticle(alle, e, campaign, registry, index);
    if (g === e) continue;
    const { copperPrice: _p, priceNote: _n, ...rest } = e.components['Item'] as Record<string, unknown>;
    const gi = (g.components?.['Item'] ?? {}) as Record<string, unknown>;
    const item = { ...rest, ...(gi['copperPrice'] !== undefined ? { copperPrice: gi['copperPrice'] } : {}), ...(gi['priceNote'] !== undefined ? { priceNote: gi['priceNote'] } : {}) };
    out.set(id, { ...e, components: { ...e.components, Item: item } });
  }
  return out;
}

/**
 * Die Waren eines Ladens mit ihren Preisen für diesen Käufer — in
 * Reihenfolge der Kanten. **Eine Kante auf eine Collection** (REQ-439,
 * E-175) steht für ihre Mitglieder (`collectionMemberIds`, nach Name),
 * mit der Collection als Herkunft (`via`): ihr Abschlag gilt für jede, ihr
 * `available` auch. Eine Menge oder einen eigenen Preis trägt sie nicht —
 * eine Zahl für vierzig Waffen wäre keine. **Eine einzelne Kante schlägt
 * die Collection**, gleich wo sie steht, und von zwei Collections mit
 * demselben Mitglied gilt die erste.
 */
export function shopWares(shop: Entity, ctx: ShopContext): WareOffer[] {
  const laden = ladenAbschlaege(shop, ctx);
  const registry = ctx.registry ?? OHNE_REGISTER;
  const alle = kanten(shop, 'sells');
  const einzeln = new Set(alle.filter((r) => { const z = ctx.entities.get(r.to); return z && !istSammlung(z, registry); }).map((r) => r.to));
  const gesehen = new Set<EntityId>();
  const out: WareOffer[] = [];
  const ware = (r: (typeof alle)[number], item: Entity, sammlung?: Entity) => {
    /* Ein angekauftes Stück mit Eigenem ist eine Instanz (T-133): ihr Preis steht an der Vorlage. */
    const list = itemPrice(resolveInstance(ctx.entities, item));
    const note = (resolveInstance(ctx.entities, item).components?.['Item'] ?? {})['priceNote'];
    const listNote = list !== undefined && typeof note === 'string' && note.trim() ? note.trim() : undefined;
    const eigen = sammlung ? undefined : zahl(r.props?.['price']);
    const base = eigen !== undefined && eigen >= 0 ? eigen : list;
    const mod = typeof r.props?.['mod'] === 'string' ? (r.props['mod'] as string).trim() : '';
    const wareMod = mod ? [sammlung ? { by: 'collection' as const, giver: sammlung.id, mod } : { by: 'ware' as const, mod }] : [];
    const { price, steps } = applyPriceMods(base, [...laden, ...wareMod]);
    const qty = sammlung ? undefined : zahl(r.props?.['qty']);
    out.push({
      edge: r.id,
      item: item.id,
      ...(sammlung ? { via: sammlung.id } : {}),
      name: entityName(item),
      ...(qty !== undefined ? { qty } : {}),
      available: r.props?.['available'] !== false && qty !== 0,
      ...(list !== undefined ? { list } : {}),
      ...(listNote ? { listNote } : {}),
      ...(base !== undefined ? { base } : {}),
      ...(price !== undefined ? { price } : {}),
      steps,
    });
  };
  for (const r of alle) {
    const ziel = ctx.entities.get(r.to);
    if (!ziel) continue;
    if (!istSammlung(ziel, registry)) {
      ware(r, ziel);
      continue;
    }
    for (const id of collectionMemberIds(registry, ziel, ctx.entities)) {
      const item = ctx.entities.get(id);
      /* Nur Gegenstände: eine Collection darf auch Zauber sammeln, verkauft wird davon nichts. */
      if (!item?.components?.['Item'] || einzeln.has(id) || gesehen.has(id)) continue;
      gesehen.add(id);
      ware(r, item, ziel);
    }
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
export type TradeRefusal = 'missing' | 'unavailable' | 'soldOut' | 'tooFew' | 'noPrice' | 'tooPoor' | 'reserved' | 'notEmpty' | 'notBought';

const INVENTORY = 'Inventory';
const kupferIn = (inv: Entity): number => Math.max(0, Math.trunc(Number(inv.components?.[INVENTORY]?.['copper']) || 0));
const mitKupfer = (inv: Entity, copper: number): Entity => ({
  ...inv,
  components: { ...(inv.components ?? {}), [INVENTORY]: { ...(inv.components?.[INVENTORY] ?? {}), copper } },
});
const stueck = (n: unknown): number => Math.max(1, Math.trunc(Number(n) || 1));

/**
 * Ein loser Stapel desselben Gegenstands: nicht reserviert, nirgends
 * hingelegt, und entweder der Gegenstand selbst (aus der Zeit vor den
 * Instanzen) oder eine Instanz davon, die in nichts abweicht
 * (`followsTemplate`) — auf eine gravierte Klinge kommt keine zweite.
 */
const loseGleich = (item: EntityId, entities: ReadonlyMap<EntityId, Entity>) => (r: { type: string; to: string; props?: Record<string, unknown> }) => {
  if (r.type !== 'holds' || r.props?.['reservedFor'] || !['gx', 'gy', 'rot', 'slot'].every((k) => r.props?.[k] === undefined || r.props?.[k] === null)) return false;
  if (r.to === item) return true;
  const stueck = entities.get(r.to);
  return !!stueck && templateOf(entities, stueck)?.id === item && followsTemplate(entities, stueck);
};

/**
 * **Ein Stück kommt ins Inventar** (T-150) — gekauft, erbeutet, gefertigt,
 * geschenkt, eine Funktion für alle Wege: liegt ein loser Stapel desselben
 * Grundartikels da (`loseGleich`), wächst er um `qty`; sonst kommt eine
 * neue Kante `piece.edge` auf `piece.to`, und `created` sagt dem Aufrufer,
 * dass er das Stück anlegen muss (`newInstance`). Ist `item` selbst schon
 * ein Stück (eine Instanz, die jemand weitergibt), zeigt `piece.to` darauf
 * und angelegt wird nichts — das entscheidet der Aufrufer, hier wird nur
 * gestapelt. Das Inventar kommt neu zurück.
 */
export function receivePiece(
  inventory: Entity,
  item: EntityId,
  qty: number,
  piece: { edge: string; to: EntityId },
  entities: ReadonlyMap<EntityId, Entity>,
): { inventory: Entity; piece: EntityId; created: boolean } {
  const n = stueck(qty);
  const liste = inventory.relations ?? [];
  const da = liste.find(loseGleich(item, entities));
  const relations = da
    ? liste.map((r) => (r === da ? { ...r, props: { ...(r.props ?? {}), qty: stueck(r.props?.['qty']) + n } } : r))
    : [...liste, { id: piece.edge, type: 'holds', to: piece.to, props: { qty: n, tier: 'pack' } }];
  return { inventory: { ...inventory, relations }, piece: da ? da.to : piece.to, created: !da };
}

/**
 * **Kaufen** (T-133): `qty` Stück der Ware `offer` — mit dem Preis, den
 * `shopWares` für diese Figur gerechnet hat (am Server, nie aus der
 * Maske). Die gezählte Menge an `sells` sinkt (leer bleibt unbegrenzt),
 * und `Inventory.copper` sinkt um den Preis mal Menge. Ins Inventar kommt
 * **eine Instanz** des Gegenstands (`newInstance`, T-150): `piece` nennt
 * die Kante und das neue Stück, das der Aufrufer anlegt, wenn `created`
 * zurückkommt — liegt schon ein loser Stapel desselben da, wächst der, und
 * es entsteht nichts. Laden und Inventar kommen neu zurück; die alten
 * bleiben unberührt.
 */
export function buyWare(
  shop: Entity,
  inventory: Entity,
  offer: WareOffer,
  qty: number,
  piece: { edge: string; to: EntityId },
  entities: ReadonlyMap<EntityId, Entity>,
): { shop: Entity; inventory: Entity; unit: number; total: number; piece: EntityId; created: boolean } | { refused: TradeRefusal } {
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
  const r = receivePiece(inventory, offer.item, n, piece, entities);
  return {
    shop: neuerLaden,
    inventory: mitKupfer(r.inventory, hat - total),
    unit: offer.price,
    total,
    piece: r.piece,
    created: r.created,
  };
}

/**
 * **Was ein Laden für ein Stück zahlt** (T-133): die Hälfte des
 * Listenpreises, abgerundet auf Kupfer — die Regel aus 5e. Rabatte gelten
 * beim Kaufen, nicht hier. Ein Laden mit eigenem Satz oder `buys`-Kanten
 * rechnet mit `buybackFor` (E-045 b, E-175); das hier ist dessen Vorgabe. Eine
 * Instanz zählt mit dem Preis ihrer Vorlage, solange sie keinen eigenen hat.
 */
export function buybackPrice(
  item: Entity | undefined,
  entities?: ReadonlyMap<EntityId, Entity>,
  pricing: ItemPricing = 'combined',
): number | undefined {
  /* Ein Stück mit Enhancements zählt mit seinem gerechneten Preis (T-300). */
  const list = item && entities ? piecePrice(entities, item, pricing) : itemPrice(item);
  return list === undefined ? undefined : Math.floor(list / 2);
}

/**
 * **Woher ein Ankaufspreis kommt** (E-175 a): eine `buys`-Kante auf den
 * Gegenstand (`edge`), eine auf eine Collection, in der er steht
 * (`collection`), oder — ohne jede `buys`-Kante — der Satz des Ladens
 * (`shop`).
 */
export type BuybackSource = 'edge' | 'collection' | 'shop';

export interface BuybackOffer {
  /** Was der Laden je Stück zahlt, in Kupfer. */
  unit: number;
  /** Der Satz in Prozent des Listenpreises. */
  rate: number;
  from: BuybackSource;
  /** Die Kante zielt hierhin: der Gegenstand oder die Collection. */
  via?: EntityId;
  /** Ein Abschlag an der `buys`-Kante (`+1 gp`, `−10 %`), mit Herkunft. */
  steps: PriceStep[];
}

const satz = (v: unknown): number | undefined => {
  const n = zahl(v);
  return n !== undefined && n >= 0 ? n : undefined;
};

/**
 * **Was ein Laden für ein Stück zahlt** (T-425, REQ-439, E-175 a). Ohne
 * `buys`-Kante kauft er alles zu `Shop.buyRate` (leer 50 %, E-045 b). Mit
 * `buys`-Kanten kauft er nur das Genannte: eine Kante auf den Gegenstand
 * (oder bei einem Stück auf seinen Grundartikel) schlägt eine auf eine
 * Collection, von mehreren Collections gilt die erste. Der Satz steht an
 * der Kante (`props.rate`), sonst gilt der des Ladens; `props.mod`
 * schlägt danach ab oder auf. Abgerundet auf Kupfer, nie unter null.
 * Rabatte gelten beim Kaufen, nicht hier.
 */
export function buybackFor(
  shop: Entity,
  item: Entity | undefined,
  entities: ReadonlyMap<EntityId, Entity>,
  registry: Pick<Registry, 'interfaces'> = OHNE_REGISTER,
  pricing: ItemPricing = 'combined',
): BuybackOffer | { refused: 'noPrice' | 'notBought' } {
  if (!item) return { refused: 'noPrice' };
  /* Ein Stück mit Enhancements zählt mit seinem gerechneten Preis (T-300). */
  const list = piecePrice(entities, item, pricing);
  if (list === undefined) return { refused: 'noPrice' };
  const laden = satz(shop.components?.[SHOP_TYPE]?.['buyRate']) ?? DEFAULT_BUY_RATE;
  const buys = kanten(shop, 'buys');
  const rechne = (rate: number, from: BuybackSource, via?: EntityId, mod?: unknown): BuybackOffer => {
    const roh = Math.floor((list * rate) / 100);
    const m = typeof mod === 'string' && mod.trim() ? [{ by: 'ware' as const, mod: mod.trim() }] : [];
    const { price, steps } = applyPriceMods(roh, m);
    return { unit: Math.max(0, Math.floor(price ?? roh)), rate, from, ...(via ? { via } : {}), steps };
  };
  if (!buys.length) return rechne(laden, 'shop');
  const grund = (isInstance(item) ? templateOf(entities, item)?.id : undefined) ?? item.id;
  const direkt = buys.find((r) => r.to === grund || r.to === item.id);
  if (direkt) return rechne(satz(direkt.props?.['rate']) ?? laden, 'edge', direkt.to, direkt.props?.['mod']);
  for (const r of buys) {
    const ziel = entities.get(r.to);
    if (!ziel || !istSammlung(ziel, registry)) continue;
    if (collectionMemberIds(registry, ziel, entities).includes(grund)) return rechne(satz(r.props?.['rate']) ?? laden, 'collection', ziel.id, r.props?.['mod']);
  }
  return { refused: 'notBought' };
}

/**
 * **Verkaufen** (T-133): `qty` Stück vom Stapel `edgeId` aus dem Inventar
 * an den Laden, zum Ankaufspreis des Ladens (`buybackFor`: seine `buys`-Kanten,
 * sonst `Shop.buyRate`; kauft er es nicht, `notBought`). Ein reserviertes Stück
 * (`reservedFor`, T-128) bleibt, wo es ist, und ein Behälter, in dem noch
 * etwas liegt, auch — sein Inhalt ginge sonst mit über den Tresen.
 *
 * Ein Stück ist meist eine Instanz (T-150). **Weicht sie nicht ab**, ist
 * sie ein beliebiges Stück des Grundartikels: führt der Laden ihn mit
 * gezählter Menge, steigt sie, und ist der Stapel ganz verkauft, nennt
 * `orphan` die Instanz, die niemand mehr hält — der Aufrufer löscht sie.
 * **Weicht sie ab** (eine Gravur, ein eigener Name), geht genau dieses
 * Stück über den Tresen: der Laden führt es danach selbst (`sells` auf die
 * Instanz), statt dass die Gravur verschwindet.
 */
export function sellPiece(
  shop: Entity,
  inventory: Entity,
  edgeId: string,
  qty: number,
  entities: ReadonlyMap<EntityId, Entity>,
  registry?: Pick<Registry, 'interfaces'>,
):
  | { shop: Entity; inventory: Entity; item: EntityId; qty: number; unit: number; total: number; rate: number; from: BuybackSource; via?: EntityId; orphan?: EntityId }
  | { refused: TradeRefusal } {
  const kante = (inventory.relations ?? []).find((r) => r.id === edgeId && r.type === 'holds');
  if (!kante) return { refused: 'missing' };
  if (kante.props?.['reservedFor']) return { refused: 'reserved' };
  const item = entities.get(kante.to);
  const voll = kanten(item, 'carries').some((c) => kanten(entities.get(c.to), 'holds').length > 0);
  if (voll) return { refused: 'notEmpty' };
  const angebot = buybackFor(shop, item, entities, registry);
  if ('refused' in angebot) return angebot;
  const unit = angebot.unit;
  const alle = stueck(kante.props?.['qty']);
  const n = stueck(qty);
  if (n > alle) return { refused: 'tooFew' };
  const relations = (inventory.relations ?? []).flatMap((r) => {
    if (r !== kante) return [r];
    return n < alle ? [{ ...r, props: { ...(r.props ?? {}), qty: alle - n } }] : [];
  });
  const total = unit * n;
  const instanz = item && isInstance(item) ? item : undefined;
  const beliebig = !instanz || followsTemplate(entities, instanz);
  /* Ein beliebiges Stück zählt beim Laden als der Grundartikel; ein eigenes bleibt es selbst. */
  const ware = beliebig ? (instanz ? (templateOf(entities, instanz)?.id ?? kante.to) : kante.to) : kante.to;
  const gefuehrt = kanten(shop, 'sells').find((r) => r.to === ware && zahl(r.props?.['qty']) !== undefined);
  const weg = n >= alle;
  let neuerLaden: Entity = shop;
  if (gefuehrt) {
    neuerLaden = { ...shop, relations: (shop.relations ?? []).map((r) => (r === gefuehrt ? { ...r, props: { ...(r.props ?? {}), qty: zahl(r.props?.['qty'])! + n } } : r)) };
  } else if (!beliebig) {
    neuerLaden = { ...shop, relations: [...(shop.relations ?? []), { id: `${shop.id}~sells-${kante.to}`, type: 'sells', to: kante.to, props: { qty: n } }] };
  }
  return {
    shop: neuerLaden,
    inventory: mitKupfer({ ...inventory, relations }, kupferIn(inventory) + total),
    item: ware,
    qty: n,
    unit,
    total,
    rate: angebot.rate,
    from: angebot.from,
    ...(angebot.via ? { via: angebot.via } : {}),
    ...(instanz && beliebig && weg ? { orphan: instanz.id } : {}),
  };
}

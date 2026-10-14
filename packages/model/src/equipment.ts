/**
 * **Startausrüstung nach Kampagnenregel** (REQ-250, T-096). Wie Spielende
 * zu ihrer ersten Ausrüstung kommen, steht — wie die Attributsverfahren
 * (E-016 a) — in Artikeln der Art `EquipmentMethod`, die die Leitung
 * selbst anlegt. Drei Arten:
 *
 *  - `rules`: was Klasse und Hintergrund geben — das Feste und die
 *    Varianten (a)/(b) aus ihren Wahlen (`Choices`, E-015 a).
 *  - `gold`: ein Betrag, fest oder gewürfelt (`gold`, etwa `5d4×10`);
 *    ohne Angabe der der Klasse (`Class.startingGold`). Damit wird
 *    eingekauft.
 *  - `free`: ein Budget (`budget`) mit eigenen Grenzen — höchstens so
 *    viele magische Gegenstände je Seltenheit (`magic`), nur diese
 *    Gegenstandsarten (`itemTypes`).
 *
 * Die Kampagne nennt die erlaubten über `allowsEquipment`; nennt sie
 * keines, gelten „Klasse und Hintergrund" und „Startgold je Klasse".
 * Gewürfelt und geprüft wird am Server; hier liegt, was beide Seiten
 * gleich rechnen müssen.
 */

import { choicesOf, choiceSources, chosenResult, type Choice } from './choices.js';
import { rollDice, rollText } from './dice.js';
import { entityName } from './entity.js';
import type { Entity, EntityId } from './types.js';

export type EquipmentMethodKind = 'rules' | 'gold' | 'free';

export interface EquipmentMethod {
  /** Die Artikel-Id, bei den Vorgaben ein fester Schlüssel. */
  id: string;
  name: string;
  method: EquipmentMethodKind;
  /** `gold`: der Betrag in gp, fest (`100`) oder gewürfelt (`5d4×10`); leer heisst: der der Klasse. */
  gold?: string;
  /** `free`: das Budget in gp; ohne Angabe ohne Grenze. */
  budget?: number;
  /**
   * Höchstens so viele magische Gegenstände je Seltenheit
   * (`{"uncommon": 1}`); eine Seltenheit, die fehlt, heisst keiner. Ohne
   * Angabe gilt für magische Gegenstände dasselbe wie für jeden: nur, was
   * einen Preis hat.
   */
  magic?: Record<string, number>;
  /** Nur diese Gegenstandsarten (`Item.itemType`); leer heisst alle. */
  itemTypes?: string[];
  /** Eine Vorgabe aus dem Code, kein Artikel. */
  builtIn?: true;
}

/**
 * **Die Vorgabe, wenn die Kampagne nichts nennt**: wie im Spielerhandbuch
 * — die Ausrüstung von Klasse und Hintergrund oder stattdessen das
 * Startgold der Klasse.
 */
export const DEFAULT_EQUIPMENT_METHODS: readonly EquipmentMethod[] = [
  { id: 'class-and-background', name: 'Class and background', method: 'rules', builtIn: true },
  { id: 'starting-gold', name: 'Starting gold', method: 'gold', builtIn: true },
];

/** Was eine Seltenheit **nicht** magisch macht. */
const NICHT_MAGISCH = new Set(['', 'none', 'unknown']);

/** Ein Artikel `EquipmentMethod`, gelesen — `undefined`, wenn er keiner ist. */
export function equipmentMethodOf(e: Entity | undefined): EquipmentMethod | undefined {
  const k = e?.components?.['EquipmentMethod'];
  if (!e || !k) return undefined;
  const method = k['method'];
  if (method !== 'rules' && method !== 'gold' && method !== 'free') return undefined;
  const magic: Record<string, number> = {};
  const rohMagic = k['magic'];
  if (rohMagic && typeof rohMagic === 'object' && !Array.isArray(rohMagic)) {
    for (const [r, n] of Object.entries(rohMagic as Record<string, unknown>)) {
      if (Number.isFinite(Number(n)) && Number(n) >= 0) magic[r.toLowerCase()] = Math.floor(Number(n));
    }
  }
  const typen = Array.isArray(k['itemTypes']) ? (k['itemTypes'] as unknown[]).map(String).filter(Boolean) : [];
  const gold = typeof k['gold'] === 'string' ? k['gold'].trim() : typeof k['gold'] === 'number' ? String(k['gold']) : '';
  const budget = Number(k['budget']);
  return {
    id: e.id,
    name: entityName(e),
    method,
    ...(gold ? { gold } : {}),
    ...(k['budget'] !== undefined && k['budget'] !== null && Number.isFinite(budget) ? { budget } : {}),
    ...(rohMagic && typeof rohMagic === 'object' ? { magic } : {}),
    ...(typen.length ? { itemTypes: typen } : {}),
  };
}

/**
 * **Was die Kampagne erlaubt**: die Ziele ihrer Kanten `allowsEquipment`,
 * die es gibt und die ein Verfahren sind. Ohne eine einzige: die Vorgabe.
 */
export function allowedEquipmentMethods(campaign: Entity | undefined, byId: ReadonlyMap<EntityId, Entity>): EquipmentMethod[] {
  const raus: EquipmentMethod[] = [];
  for (const r of campaign?.relations ?? []) {
    if (r.type !== 'allowsEquipment') continue;
    const m = equipmentMethodOf(byId.get(r.to));
    if (m && !raus.some((x) => x.id === m.id)) raus.push(m);
  }
  return raus.length ? raus : DEFAULT_EQUIPMENT_METHODS.map((m) => ({ ...m }));
}

// ------------------------------------------------------------ nach Regeln

/** Ein Stück: ein Gegenstand und wie viele davon. */
export interface EquipmentItem {
  id: EntityId;
  qty: number;
}

/** Was eine Möglichkeit oder ein Paket gibt. */
export interface EquipmentContents {
  items: EquipmentItem[];
  /** Geld in Kupfer — „15 gp" und „a pouch containing 10 gp". */
  copper: number;
  /** Was kein Artikel ist („one simple weapon of your choice"), als Text. */
  rest: string[];
}

/** Eine Möglichkeit einer Ausrüstungswahl (`from.options`), mit dem, was sie gibt. */
export interface EquipmentOption {
  key: string;
  label: string;
  /** Die Stücke, ausdrücklich; ohne Angabe aus den Verweisen im Text gelesen. */
  items?: EquipmentItem[];
  /** Geld in gp, ausdrücklich. */
  gold?: number;
}

const ZAHLWORT: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50,
};
const KUPFER: Record<string, number> = { cp: 1, sp: 10, ep: 50, gp: 100, pp: 1000 };
const VERWEIS = /\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g;

/** Geldbeträge in einem Satz, in Kupfer. */
function geldIn(text: string): number {
  let cp = 0;
  for (const m of text.matchAll(/(\d+(?:[.,]\d+)?)\s*(cp|sp|ep|gp|pp)\b/gi)) {
    cp += Math.round(Number(m[1]!.replace(',', '.')) * (KUPFER[m[2]!.toLowerCase()] ?? 0));
  }
  return cp;
}

/**
 * **Was ein Satz an Ausrüstung nennt** — so, wie der Importer ihn schreibt:
 * Verweise auf Gegenstände (`[[item-0042|rope kit]] (2)`, „four javelins"
 * im Verweis), Geld (`15 gp`, „containing 10 gp") und der Rest als Text.
 * Gelesen, nicht gespeichert: eine Klasse aus 5e.tools trägt keine Liste,
 * und sie neu einzulesen verlöre, was die Leitung an ihr geändert hat.
 */
export function equipmentFromText(text: string): EquipmentContents {
  const items: EquipmentItem[] = [];
  let copper = 0;
  const rest: string[] = [];
  for (const teil of String(text ?? '').split(/,(?![^[]*\]\])|\band\b(?![^[]*\]\])/)) {
    const t = teil.trim().replace(/^(?:and|or)\s+/i, '');
    if (!t) continue;
    const verweise = [...t.matchAll(VERWEIS)];
    if (!verweise.length) {
      const geld = geldIn(t);
      if (geld) copper += geld;
      else if (t.replace(/[.\s]/g, '')) rest.push(t.replace(/\.$/, ''));
      continue;
    }
    const v = verweise[0]!;
    const nach = t.slice(v.index! + v[0].length);
    const anzeige = (v[2] ?? '').trim();
    const vor = t.slice(0, v.index!).trim().toLowerCase();
    const klammer = /^\s*\((\d+)\)/.exec(nach)?.[1];
    const zahl = (w: string | undefined): number | undefined => (w ? (ZAHLWORT[w] ?? (Number(w) || undefined)) : undefined);
    const qty = klammer
      ? Number(klammer)
      : (zahl(/^(\d+|[a-z]+)\s/.exec(anzeige.toLowerCase())?.[1]) ?? zahl(/(\d+|[a-z]+)$/.exec(vor)?.[1]) ?? 1);
    items.push({ id: v[1]!.trim(), qty: Math.max(1, qty) });
    copper += geldIn(nach);
  }
  return { items, copper, rest };
}

/** Was eine Möglichkeit gibt: ausdrücklich, sonst aus ihrem Text. */
export function optionContents(o: EquipmentOption): EquipmentContents {
  const aus = equipmentFromText(o.label);
  const items = Array.isArray(o.items) ? o.items.filter((i) => i && typeof i.id === 'string').map((i) => ({ id: i.id, qty: Math.max(1, Number(i.qty) || 1) })) : aus.items;
  const copper = Number.isFinite(Number(o.gold)) && o.gold !== undefined ? Math.round(Number(o.gold) * 100) : aus.copper;
  return { items, copper, rest: Array.isArray(o.items) ? [] : aus.rest };
}

/** Stücke zusammenlegen: derselbe Gegenstand zweimal ist einer mit mehr. */
function dazu(ziel: EquipmentContents, q: EquipmentContents): void {
  for (const i of q.items) {
    const da = ziel.items.find((x) => x.id === i.id);
    if (da) da.qty += i.qty;
    else ziel.items.push({ ...i });
  }
  ziel.copper += q.copper;
  ziel.rest.push(...q.rest);
}

/** Die Ausrüstungswahlen eines Artikels. */
const ausruestungswahlen = (e: Entity): Choice[] => choicesOf(e).filter((c) => c.kind === 'equipment');

/**
 * **Das Feste ohne eigene Wahl**: Klassen und Hintergründe, die vor T-096
 * eingelesen wurden, tragen das Feste nur im Text von `startingEquipment`
 * (`- an explorer's pack, four javelins`). Gelesen werden die Zeilen, die
 * keine Varianten nennen; „Alternatively, … gp" ist das Startgold und
 * keine Zeile. Wer eine Wahl mit genau einer Möglichkeit trägt, sagt das
 * Feste selbst, und der Text zählt nicht.
 */
function festeZeilen(e: Entity, art: 'Class' | 'Background'): string[] {
  if (ausruestungswahlen(e).some((c) => (c.from?.options?.length ?? 0) === 1)) return [];
  const text = e.components?.[art]?.['startingEquipment'];
  if (typeof text !== 'string') return [];
  return text
    .split('\n')
    .map((z) => /^\s*[-*]\s+(.*)$/.exec(z)?.[1] ?? '')
    .filter((z) => z && !/\([a-z]\)/i.test(z));
}

/** Die Quellen der Startausrüstung: der Hintergrund und die erste Klasse. */
function ausruestungsQuellen(character: Entity, byId: ReadonlyMap<EntityId, Entity>): { entity: Entity; art: 'Class' | 'Background' }[] {
  const raus: { entity: Entity; art: 'Class' | 'Background' }[] = [];
  for (const q of choiceSources(character, byId)) {
    if (q.via === 'hasBackground') raus.push({ entity: q.entity, art: 'Background' });
    else if (q.via === 'hasClass' && q.start) raus.push({ entity: q.entity, art: 'Class' });
  }
  return raus;
}

/**
 * **Was ohne Wahl dazukommt**, als Sätze — für die Anzeige im Assistenten:
 * die Wahlen mit genau einer Möglichkeit und die festen Zeilen im Text.
 */
export function fixedEquipmentLines(character: Entity, byId: ReadonlyMap<EntityId, Entity>): { source: EntityId; text: string }[] {
  const raus: { source: EntityId; text: string }[] = [];
  for (const q of ausruestungsQuellen(character, byId)) {
    for (const z of festeZeilen(q.entity, q.art)) raus.push({ source: q.entity.id, text: plainEquipmentText(z) });
    for (const c of ausruestungswahlen(q.entity)) {
      const o = c.from?.options;
      if (o?.length === 1 && (c.level ?? 1) <= 1 && (c.when !== 'multiclass')) raus.push({ source: q.entity.id, text: plainEquipmentText(o[0]!.label) });
    }
  }
  return raus;
}

/**
 * **Was Klasse und Hintergrund dieser Figur geben** (`rules`): die
 * Möglichkeiten, die sie gewählt hat (die Kante `chose`, auch eine Wahl
 * ohne Spielraum), und das Feste. Die Klasse zählt nur als erste — wer
 * eine zweite dazunimmt, bekommt ihre Ausrüstung nicht (`when: 'start'`).
 */
export function startingBundle(character: Entity, byId: ReadonlyMap<EntityId, Entity>): EquipmentContents {
  const raus: EquipmentContents = { items: [], copper: 0, rest: [] };
  for (const q of ausruestungsQuellen(character, byId)) for (const z of festeZeilen(q.entity, q.art)) dazu(raus, equipmentFromText(z));
  for (const g of chosenResult(character, byId).equipment) {
    const quelle = byId.get(g.source);
    const wahl = ausruestungswahlen(quelle ?? ({} as Entity)).find((c) => c.id === g.choice);
    const opt = (wahl?.from?.options as EquipmentOption[] | undefined)?.find((o) => o.key === g.key);
    if (opt) dazu(raus, optionContents(opt));
  }
  return raus;
}

/**
 * **Verweise auflösen**: ein Stück nennt seinen Gegenstand mit der Nummer
 * (`item-0042`), wie ein Verweis im Text (M11); die Kante `holds` braucht
 * die Peg-Id. Was weder das eine noch das andere ist, fällt weg und steht
 * in `missing`.
 */
export function resolveEquipment(
  c: EquipmentContents,
  entities: Iterable<Entity>,
): EquipmentContents & { missing: string[] } {
  const peg = new Map<string, EntityId>();
  for (const e of entities) {
    peg.set(e.id, e.id);
    const nr = e.components?.['Identity']?.['id'];
    if (typeof nr === 'string' && nr && !peg.has(nr)) peg.set(nr, e.id);
  }
  const raus: EquipmentContents & { missing: string[] } = { items: [], copper: c.copper, rest: [...c.rest], missing: [] };
  for (const i of c.items) {
    const id = peg.get(i.id);
    if (!id) raus.missing.push(i.id);
    else dazu(raus, { items: [{ id, qty: i.qty }], copper: 0, rest: [] });
  }
  return raus;
}

/** Ein Satz Ausrüstung ohne Verweise — für eine Auswahl, die nur Text zeigt. */
export function plainEquipmentText(text: string): string {
  return String(text ?? '').replace(VERWEIS, (_m, id: string, anzeige?: string) => (anzeige || id).trim());
}

// ------------------------------------------------------------ Gold

/** Die erste Klasse der Figur — die, deren Startgold gilt. */
export function startClassOf(character: Entity): EntityId | undefined {
  return (character.relations ?? []).find((r) => r.type === 'hasClass')?.to;
}

/**
 * **Das Startgold einer Klasse**: `Class.startingGold` (`5d4×10`), sonst
 * aus dem Text, den der Importer vor T-096 schrieb („Alternatively,
 * {{5d4 × 10}} gp to buy your own equipment").
 */
export function startingGoldOf(cls: Entity | undefined): string | undefined {
  const feld = cls?.components?.['Class']?.['startingGold'];
  if (typeof feld === 'string' && feld.trim()) return feld.trim();
  if (typeof feld === 'number' && Number.isFinite(feld)) return String(feld);
  const text = cls?.components?.['Class']?.['startingEquipment'];
  if (typeof text !== 'string') return undefined;
  const m = /Alternatively,\s*(?:\{\{)?\s*([^{}]+?)\s*(?:\}\})?\s*gp\b/i.exec(text);
  return m ? m[1]!.trim() : undefined;
}

/** Ein Betrag in gp: fest oder gewürfelt, mit `×10` am Ende. */
export interface GoldRoll {
  gp: number;
  /** Der Wurf, wie das Protokoll ihn nennt; leer bei einem festen Betrag. */
  roll: string;
}

/** Einen Ausdruck wie `5d4×10`, `4d4 x 10` oder `150` auswerten; `null`, wenn er keiner ist. */
export function rollGold(expr: string, random: () => number = Math.random): GoldRoll | null {
  const txt = String(expr ?? '').trim();
  if (!txt) return null;
  if (/^\d+(?:\.\d+)?$/.test(txt)) return { gp: Number(txt), roll: '' };
  const m = /^(.*?)\s*[×x*]\s*(\d+)$/i.exec(txt);
  const wuerfel = (m ? m[1]! : txt).trim();
  const faktor = m ? Number(m[2]) : 1;
  const r = rollDice(wuerfel, random);
  if (!r) return null;
  return { gp: r.total * faktor, roll: `${rollText(r)}${faktor !== 1 ? ` × ${faktor}` : ''}` };
}

/** Ist der Betrag fest — dann wird nicht gewürfelt? */
export const fixedGold = (expr: string | undefined): number | undefined =>
  expr && /^\d+(?:\.\d+)?$/.test(expr.trim()) ? Number(expr.trim()) : undefined;

// ------------------------------------------------------------ Einkauf

/** Was eingekauft werden soll. */
export interface Purchase {
  id: EntityId;
  qty: number;
}

/** Der Preis eines Gegenstands in Kupfer, oder `undefined`. */
export function itemPrice(item: Entity | undefined): number | undefined {
  const p = item?.components?.['Item']?.['copperPrice'];
  return typeof p === 'number' && Number.isFinite(p) && p >= 0 ? p : undefined;
}

/** Die Seltenheit, wenn der Gegenstand magisch ist. */
export function magicRarity(item: Entity | undefined): string | undefined {
  const r = String(item?.components?.['Item']?.['rarity'] ?? '').toLowerCase();
  return NICHT_MAGISCH.has(r) ? undefined : r;
}

export interface PurchaseCheck {
  /** Was nicht stimmt, oder `null`. */
  problem: string | null;
  /** Was der Einkauf kostet, in Kupfer. */
  spent: number;
  /** Wie viele magische Gegenstände je Seltenheit. */
  magic: Record<string, number>;
}

/**
 * **Prüft einen Einkauf gegen das Verfahren** — am Server, und in der
 * Maske für die laufende Anzeige. `items` hält die Gegenstände, die der
 * Käufer sehen darf; `budget` ist das Geld in Kupfer (ohne Angabe: ohne
 * Grenze).
 *
 * Ein Gegenstand braucht einen Preis — ausser er ist magisch und das
 * Verfahren zählt magische Gegenstände je Seltenheit (`magic`): dann gilt
 * die Zahl, und ein Preis wird bezahlt, wenn es einen gibt. So kauft
 * „Startgold" nur, was einen Preis hat, und „frei" verteilt seltene
 * Gegenstände, die keiner kaufen kann.
 */
export function checkPurchase(
  purchases: readonly Purchase[],
  items: ReadonlyMap<EntityId, Entity>,
  m: EquipmentMethod,
  budget?: number,
): PurchaseCheck {
  let spent = 0;
  const magic: Record<string, number> = {};
  const raus = (problem: string | null): PurchaseCheck => ({ problem, spent, magic });
  if (m.method === 'rules') return raus(purchases.length ? 'This method buys nothing.' : null);
  for (const p of purchases) {
    const qty = Number(p.qty);
    if (!Number.isInteger(qty) || qty < 1) return raus('Each quantity must be a whole number of at least 1.');
    const item = items.get(p.id);
    if (!item || !item.components?.['Item']) return raus(`Not an item you can choose: ${p.id}`);
    const name = entityName(item);
    const typ = String(item.components['Item']['itemType'] ?? '');
    if (m.itemTypes?.length && !m.itemTypes.includes(typ)) return raus(`${name}: ${typ || 'this kind'} is not allowed here.`);
    const selten = magicRarity(item);
    const preis = itemPrice(item);
    if (selten && m.magic) {
      magic[selten] = (magic[selten] ?? 0) + qty;
      const erlaubt = m.magic[selten] ?? 0;
      if (magic[selten]! > erlaubt) return raus(erlaubt ? `At most ${erlaubt} ${selten} magic item${erlaubt === 1 ? '' : 's'}.` : `No ${selten} magic items here.`);
      spent += (preis ?? 0) * qty;
      continue;
    }
    if (preis === undefined) return raus(`${name} has no price.`);
    spent += preis * qty;
  }
  if (budget !== undefined && spent > budget) return raus(`That costs ${formatCopper(spent)} of ${formatCopper(budget)}.`);
  return raus(null);
}

/** Kupfer als gp, sp, cp — „12 gp 5 sp". */
export function formatCopper(cp: number): string {
  const n = Math.max(0, Math.round(cp));
  const gp = Math.floor(n / 100);
  const sp = Math.floor((n % 100) / 10);
  const c = n % 10;
  const teile = [gp ? `${gp} gp` : '', sp ? `${sp} sp` : '', c ? `${c} cp` : ''].filter(Boolean);
  return teile.length ? teile.join(' ') : '0 gp';
}

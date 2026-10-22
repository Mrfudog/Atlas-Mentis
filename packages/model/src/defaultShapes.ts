/**
 * **Die Vorgabeformen des Inventars** (T-394, E-165, E-075 b, REQ-333):
 * das Untermodul „Default shapes“ trägt **Gruppen** (Form, Stapel,
 * tragbar, Referenzgegenstand, Formauswahl nach Preis) und **Werte je
 * Gegenstand** (Schlüssel: Artikel-Id — Gruppe, Referenz, eigene Form,
 * Stapel). Gespeichert wird nichts am Gegenstand: Form und Stapel werden
 * beim Lesen gerechnet (D8), wie die Sichtbarkeit je Gruppe (E-098). Eine
 * Korrektur an der Gruppe erreicht so jeden Gegenstand, der nichts Eigenes
 * sagt, und die Bücher bleiben unberührt (E-125).
 *
 * Vorrang, der erste Treffer gilt:
 * 1. `Item.rows`/`Item.stackSize` **am Gegenstand** — die eigene Angabe;
 * 2. die **eigene Form im Untermodul** (Wert je Gegenstand, auch „keine“);
 * 3. der **Referenzgegenstand** (Kette, höchstens sechs Schritte, kein Kreis);
 * 4. eine Gruppe, deren Gegenstände **nicht getragen** werden (Tiere, Dienste) — keine Form;
 * 5. die **Zufallsform nach Preis** (Kunstgegenstände: je Preisstufe Gewichte,
 *    deterministisch aus der Id — dieselbe Statue liegt immer gleich);
 * 6. die Form der **Gruppe** — die ihres Referenzgegenstands, wenn er eine eigene hat.
 *
 * Ein Stapel am Gegenstand oder im Untermodul gilt über jeder Form, die
 * von weiter unten kommt.
 */

import { resolvedStack } from './stack.js';
import type { Entity, EntityId } from './types.js';

/** Eine Form in einer Auswahl nach Preis: Gewicht je Preisstufe. */
export interface ShapeChoice {
  rows: string[];
  /** Gewicht je Stufe aus `ShapeGroup.tiers`; 0 heisst: auf dieser Stufe nie. */
  weights: number[];
}

/** Eine Gruppe von Gegenständen mit gemeinsamer Form (E-075 b). */
export interface ShapeGroup {
  /** Kurzzeichen der Gruppe (`W4`), stabil — die Gegenstände nennen es. */
  id: string;
  name: string;
  /** Der Abschnitt der Übersicht (Weapons, Armor …), nur zum Ordnen. */
  section?: string;
  /** Die Form; leer heisst keine. */
  rows?: string[] | null;
  stackSize?: number | null;
  /** `false`: Gegenstände dieser Gruppe liegen nicht im Inventar (Reittier, Dienstleistung). */
  carryable?: boolean;
  /** Der Referenzgegenstand: hat er eine eigene Form, ist sie die der Gruppe. */
  ref?: EntityId | null;
  /** Wonach Gegenstände in diese Gruppe kommen — ein Satz für die Leitung, keine Regel im Code. */
  rule?: string;
  /** Eine Notiz der Leitung zur Gruppe. */
  note?: string;
  /** Reihenfolge in der Übersicht. */
  rank?: number;
  /** Zufallsform nach Preis (Kunstgegenstände). */
  shapes?: ShapeChoice[];
  /** Preisstufen in Gold: ab `tiers[i]` gilt Gewicht `i`. */
  tiers?: number[];
}

/** Was das Untermodul über einen Gegenstand sagt. */
export interface ShapeItem {
  /** Die Artikel-Id des Gegenstands. */
  id: EntityId;
  group?: string | null;
  /** Der Referenzgegenstand; `null` heisst ausdrücklich keiner. */
  ref?: EntityId | null;
  /** Die eigene Form; `null` heisst ausdrücklich keine. */
  rows?: string[] | null;
  stackSize?: number | null;
}

export interface ShapeDefaults {
  groups: ShapeGroup[];
  items: ShapeItem[];
}

/** Woher die geltende Form kommt (REQ-333): die Seite sagt es dazu. */
export type ShapeSource =
  /** `Item.rows` am Gegenstand. */
  | 'item'
  /** Die eigene Form im Untermodul. */
  | 'own'
  /** Vom Referenzgegenstand geerbt. */
  | 'reference'
  /** Zufallsform nach Preis aus der Gruppe. */
  | 'random'
  /** Die Form der Gruppe. */
  | 'group'
  /** Die Gruppe trägt nicht: keine Form. */
  | 'none'
  /** Nichts sagt etwas — im Raster ein Feld, wie bisher. */
  | 'unset';

export interface DefaultShape {
  rows: string[] | null;
  stackSize: number | null;
  source: ShapeSource;
  /** Die Gruppe des Gegenstands, wenn er eine hat. */
  group?: string;
  /** Der Referenzgegenstand, von dem die Form kommt (bei `reference`) oder den die Gruppe nennt. */
  ref?: EntityId;
  /** Woher der Stapel kommt, wenn nicht von derselben Stelle wie die Form. */
  stackSource?: 'item' | 'own';
}

/** Die Karte, die das Untermodul trägt. */
export const SHAPE_DEFAULTS_CARD = 'ShapeDefaults';

const MAX_TIEFE = 6;

function form(roh: unknown): string[] | null {
  if (typeof roh === 'string') {
    const z = roh.split(/[/\n,]/).map((s) => s.trim()).filter(Boolean);
    return z.length ? z : null;
  }
  if (Array.isArray(roh)) {
    const z = roh.filter((s): s is string => typeof s === 'string' && s.trim() !== '').map((s) => s.trim());
    return z.length ? z : null;
  }
  return null;
}

function zahl(roh: unknown): number | null {
  const n = typeof roh === 'number' ? roh : typeof roh === 'string' && roh.trim() !== '' ? Number(roh) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function gruppeLesen(roh: unknown): ShapeGroup | null {
  if (!roh || typeof roh !== 'object') return null;
  const o = roh as Record<string, unknown>;
  if (typeof o['id'] !== 'string' || !o['id']) return null;
  const g: ShapeGroup = { id: o['id'], name: typeof o['name'] === 'string' ? o['name'] : o['id'] };
  if (typeof o['section'] === 'string') g.section = o['section'];
  if ('rows' in o) g.rows = form(o['rows']);
  if ('stackSize' in o) g.stackSize = zahl(o['stackSize']);
  if (typeof o['carryable'] === 'boolean') g.carryable = o['carryable'];
  if (typeof o['ref'] === 'string' && o['ref']) g.ref = o['ref'];
  if (typeof o['rule'] === 'string') g.rule = o['rule'];
  if (typeof o['note'] === 'string' && o['note']) g.note = o['note'];
  if (typeof o['rank'] === 'number') g.rank = o['rank'];
  if (Array.isArray(o['shapes'])) {
    g.shapes = o['shapes'].flatMap((s): ShapeChoice[] => {
      const r = form((s as Record<string, unknown> | null)?.['rows']);
      const w = (s as Record<string, unknown> | null)?.['weights'];
      return r ? [{ rows: r, weights: Array.isArray(w) ? w.map((x) => Math.max(0, Number(x) || 0)) : [] }] : [];
    });
  }
  if (Array.isArray(o['tiers'])) g.tiers = o['tiers'].map((x) => Number(x) || 0);
  return g;
}

function eintragLesen(roh: unknown): ShapeItem | null {
  if (!roh || typeof roh !== 'object') return null;
  const o = roh as Record<string, unknown>;
  if (typeof o['id'] !== 'string' || !o['id']) return null;
  const e: ShapeItem = { id: o['id'] };
  if (typeof o['group'] === 'string' && o['group']) e.group = o['group'];
  if (o['ref'] === null) e.ref = null;
  else if (typeof o['ref'] === 'string' && o['ref']) e.ref = o['ref'];
  if (o['rows'] === null) e.rows = null;
  else if ('rows' in o) {
    const r = form(o['rows']);
    if (r) e.rows = r;
  }
  if ('stackSize' in o) {
    const s = zahl(o['stackSize']);
    if (s !== null) e.stackSize = s;
  }
  return e;
}

/** Die Karte `ShapeDefaults` einer Ebene, gelesen; Unlesbares fällt still weg. */
export function shapeDefaultsOf(layer: Entity | null | undefined): ShapeDefaults {
  const k = layer?.components?.[SHAPE_DEFAULTS_CARD] as Record<string, unknown> | undefined;
  const groups = Array.isArray(k?.['shapeGroups']) ? k['shapeGroups'].map(gruppeLesen).filter((g): g is ShapeGroup => !!g) : [];
  const items = Array.isArray(k?.['shapeItems']) ? k['shapeItems'].map(eintragLesen).filter((e): e is ShapeItem => !!e) : [];
  return { groups, items };
}

/**
 * **Mehrere Ebenen, eine Vorgabe**: die spätere gewinnt Feld für Feld, je
 * Gruppe und je Gegenstand — wie Ergänzungen (T-142). So kann eine
 * Kampagnenebene eine Gruppe der Hausregel ändern, ohne sie abzuschreiben.
 * Reihenfolge: niedrigste Ebene zuerst.
 */
export function mergeShapeDefaults(layers: readonly ShapeDefaults[]): ShapeDefaults {
  const groups = new Map<string, ShapeGroup>();
  const items = new Map<EntityId, ShapeItem>();
  for (const l of layers) {
    for (const g of l.groups) groups.set(g.id, { ...(groups.get(g.id) ?? {}), ...g });
    for (const e of l.items) items.set(e.id, { ...(items.get(e.id) ?? {}), ...e });
  }
  return { groups: [...groups.values()], items: [...items.values()] };
}

/** FNV-1a über die Id, auf [0, 1) — dieselbe Rechnung wie die Vorlage der Leitung. */
export function shapeHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

/** Die Preisstufe: die höchste Schwelle, die der Preis erreicht (0 darunter). */
export function priceTier(tiers: readonly number[] | undefined, gp: number): number {
  let t = 0;
  (tiers ?? []).forEach((s, i) => {
    if (gp >= s) t = i;
  });
  return t;
}

/** Die Zufallsform eines Gegenstands nach Preis, oder `null`, wenn die Gruppe keine Auswahl hat oder der Preis fehlt. */
export function randomShape(group: ShapeGroup, id: EntityId, gp: number | null): string[] | null {
  const fs = group.shapes ?? [];
  if (!fs.length || gp === null) return null;
  const t = priceTier(group.tiers, gp);
  const ws = fs.map((f) => Math.max(0, f.weights[t] ?? 0));
  const sum = ws.reduce((a, b) => a + b, 0);
  if (!sum) return null;
  let x = shapeHash(id) * sum;
  for (let i = 0; i < fs.length; i += 1) {
    x -= ws[i]!;
    if (x < 0) return fs[i]!.rows;
  }
  return fs[fs.length - 1]!.rows;
}

/** Was die Auflösung über einen Gegenstand wissen muss: seine Karte `Item`. */
export interface ShapeLookup {
  /** Der Gegenstand zu einer Id (für Referenzen), wie er gilt. */
  item(id: EntityId): Entity | undefined;
}

export interface ShapeIndex {
  groups: Map<string, ShapeGroup>;
  items: Map<EntityId, ShapeItem>;
}

export function indexShapeDefaults(d: ShapeDefaults): ShapeIndex {
  return { groups: new Map(d.groups.map((g) => [g.id, g])), items: new Map(d.items.map((e) => [e.id, e])) };
}

function itemKarte(e: Entity | undefined): Record<string, unknown> {
  return (e?.components?.['Item'] as Record<string, unknown> | undefined) ?? {};
}

/** Der Preis in Gold, aus `Item.copperPrice`. */
function gold(e: Entity | undefined): number | null {
  const c = itemKarte(e)['copperPrice'];
  return typeof c === 'number' && Number.isFinite(c) ? c / 100 : null;
}

/**
 * **Die Form eines Gegenstands nach dem Untermodul** — siehe den Vorrang
 * oben. `entity` ist der Gegenstand, wie er gilt (Fassungen und
 * Ergänzungen schon darübergelegt).
 */
export function defaultShapeOf(entity: Entity, idx: ShapeIndex, lookup: ShapeLookup): DefaultShape {
  return aufloesen(entity, idx, lookup, 0, new Set());
}

function aufloesen(entity: Entity, idx: ShapeIndex, lookup: ShapeLookup, tiefe: number, gesehen: Set<EntityId>): DefaultShape {
  gesehen.add(entity.id);
  const karte = itemKarte(entity);
  const eintrag = idx.items.get(entity.id);
  const gid = eintrag?.group ?? undefined;
  const g = gid ? idx.groups.get(gid) : undefined;
  const gruppe = gid ? { group: gid } : {};
  /* Der Stapel: am Gegenstand, sonst im Untermodul, sonst von der Form. */
  const stapelHier = zahl(karte['stackSize']);
  const stapelEintrag = eintrag?.stackSize ?? null;
  const stapel = (vonForm: number | null): { stackSize: number | null; stackSource?: 'item' | 'own' } =>
    stapelHier !== null
      ? { stackSize: stapelHier, stackSource: 'item' }
      : stapelEintrag !== null
        ? { stackSize: stapelEintrag, stackSource: 'own' }
        : { stackSize: vonForm };

  const eigen = form(karte['rows']);
  if (eigen) return { rows: eigen, ...stapel(1), source: 'item', ...gruppe };
  if (eintrag && eintrag.rows !== undefined) {
    return eintrag.rows ? { rows: eintrag.rows, ...stapel(1), source: 'own', ...gruppe } : { rows: null, stackSize: null, source: 'none', ...gruppe };
  }
  const refId = eintrag?.ref;
  if (refId && tiefe < MAX_TIEFE && !gesehen.has(refId)) {
    const ref = lookup.item(refId);
    if (ref) {
      const geerbt = aufloesen(ref, idx, lookup, tiefe + 1, gesehen);
      if (geerbt.source !== 'unset') {
        const { stackSource: _s, ...rest } = geerbt;
        return { ...rest, ...stapel(geerbt.stackSize), source: geerbt.rows ? 'reference' : geerbt.source, ref: refId, ...gruppe };
      }
    }
  }
  if (!g) return { rows: null, stackSize: stapelHier ?? stapelEintrag, source: 'unset' };
  if (g.carryable === false) return { rows: null, stackSize: null, source: 'none', ...gruppe };
  const zufall = randomShape(g, entity.id, gold(entity));
  if (zufall) return { rows: zufall, ...stapel(g.stackSize ?? 1), source: 'random', ...gruppe };
  /* Die Form der Gruppe ist die ihres Referenzgegenstands, wenn er eine eigene trägt. */
  if (g.ref && g.ref !== entity.id) {
    const r = lookup.item(g.ref);
    const rEintrag = idx.items.get(g.ref);
    const rForm = form(itemKarte(r)['rows']) ?? rEintrag?.rows ?? null;
    if (rForm) {
      const rStapel = zahl(itemKarte(r)['stackSize']) ?? rEintrag?.stackSize ?? g.stackSize ?? 1;
      return { rows: rForm, ...stapel(rStapel), source: 'group', ref: g.ref, ...gruppe };
    }
  }
  return g.rows ? { rows: g.rows, ...stapel(g.stackSize ?? 1), source: 'group', ...gruppe } : { rows: null, stackSize: null, source: 'none', ...gruppe };
}

/**
 * **Der Gegenstand mit seiner Vorgabeform**, für jeden, der `Item.rows`
 * liest (Raster, Element Shape, Slots): fehlt die Form am Gegenstand, steht
 * die gerechnete darin; ebenso der Stapel. Gespeichert wird das nie (D8);
 * die Herkunft gibt die Antwort mit (`shape`).
 */
export function withDefaultShape(entity: Entity, idx: ShapeIndex, lookup: ShapeLookup): { entity: Entity; shape: DefaultShape } {
  const shape = defaultShapeOf(entity, idx, lookup);
  const karte = itemKarte(entity);
  const neu: Record<string, unknown> = { ...karte };
  let geaendert = false;
  if (shape.rows && !form(karte['rows'])) {
    neu['rows'] = shape.rows;
    geaendert = true;
  }
  if (shape.stackSize !== null && zahl(karte['stackSize']) === null) {
    neu['stackSize'] = shape.stackSize;
    geaendert = true;
  }
  if (!geaendert) return { entity, shape };
  return { entity: { ...entity, components: { ...(entity.components ?? {}), Item: neu } } as Entity, shape };
}

/**
 * **Die Vorgabeformen einer Kampagne**: jede aufgeschaltete Ebene, die die
 * Karte `ShapeDefaults` trägt, in der Reihenfolge des Stapels — die
 * spezifischere gewinnt Feld für Feld. Was nicht aufgeschaltet ist, sagt
 * nichts (E2): ohne das Untermodul gilt die Form der Bücher (keine).
 */
export function campaignShapeDefaults(entities: Map<EntityId, Entity>, campaign: Entity | null | undefined): ShapeDefaults {
  if (!campaign) return { groups: [], items: [] };
  const ebenen = resolvedStack(entities, campaign).filter(isShapesLayer);
  return mergeShapeDefaults(ebenen.map(shapeDefaultsOf));
}

/** Eine Ebene mit Vorgabeformen: sie trägt die Karte, oder sie ist die Mechanik `shapes` (E-166), auch noch leer. */
export function isShapesLayer(l: Entity): boolean {
  return !!l.components?.[SHAPE_DEFAULTS_CARD] || (l.components?.['RuleMechanic'] as { method?: unknown } | undefined)?.method === 'shapes';
}

/** Sagt das Untermodul überhaupt etwas? Sonst lohnt keine Rechnung. */
export function hasShapeDefaults(idx: ShapeIndex): boolean {
  return idx.groups.size > 0 || idx.items.size > 0;
}

/**
 * **Gerechnetes wird nicht gespeichert** (D8): schickt die Maske Form oder
 * Stapel zurück, die nur aus dem Untermodul kamen (am gespeicherten
 * Gegenstand fehlen sie, und sie stehen gleich der Vorgabe), fallen sie
 * weg. Wer dieselbe Form wie die Vorgabe malt, folgt also der Vorgabe —
 * wie eine Instanz, die gleich der Vorlage steht.
 */
export function stripDefaultShape(sent: Entity, stored: Entity | null | undefined, shape: DefaultShape): Entity {
  const k = itemKarte(sent);
  const vorher = itemKarte(stored ?? undefined);
  const neu: Record<string, unknown> = { ...k };
  let geaendert = false;
  const gleich = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  if (shape.rows && 'rows' in k && !form(vorher['rows']) && gleich(form(k['rows']), shape.rows)) {
    delete neu['rows'];
    geaendert = true;
  }
  if (shape.stackSize !== null && 'stackSize' in k && zahl(vorher['stackSize']) === null && zahl(k['stackSize']) === shape.stackSize) {
    delete neu['stackSize'];
    geaendert = true;
  }
  if (!geaendert) return sent;
  return { ...sent, components: { ...(sent.components ?? {}), Item: neu } } as Entity;
}

/** Eine Änderung an einem Eintrag: ein Wert setzt, `null` nimmt das Feld heraus, fehlend lässt es stehen. */
export type ShapePatch<T> = { [K in keyof T]?: T[K] | null };

function flicken<T extends { id: string }>(liste: readonly T[], id: string, patch: Record<string, unknown>, grund: Record<string, unknown>): T[] {
  const alt = liste.find((x) => x.id === id);
  const neu: Record<string, unknown> = { ...(alt ?? grund) };
  for (const [k, v] of Object.entries(patch)) {
    if (k === 'id' || v === undefined) continue;
    if (v === null) delete neu[k];
    else neu[k] = v;
  }
  const leer = Object.keys(neu).every((k) => k === 'id' || (k === 'name' && !alt));
  const rest = liste.filter((x) => x.id !== id);
  return leer ? rest : alt ? liste.map((x) => (x.id === id ? (neu as T) : x)) : [...rest, neu as T];
}

/**
 * **Einen Gegenstand im Untermodul ändern** (T-394): Gruppe, Referenz,
 * eigene Form, Stapel. Ein Eintrag ohne Angabe fällt weg — dann folgt der
 * Gegenstand wieder ganz seiner Gruppe. Für „ausdrücklich keine Form“ steht
 * `rows: []`, das als `null` gespeichert wird.
 */
export function withShapeItem(card: Record<string, unknown> | undefined, id: EntityId, patch: ShapePatch<Omit<ShapeItem, 'id'>>): Record<string, unknown> {
  const k = card ?? {};
  const items = Array.isArray(k['shapeItems']) ? (k['shapeItems'] as ShapeItem[]) : [];
  /* `rows: []` heisst „ausdrücklich keine Form“ und wird `null` gespeichert;
     `rows: null` nimmt die eigene Form heraus. */
  const keine = Array.isArray(patch.rows) && patch.rows.length === 0;
  const { rows: _r, ...rest } = patch;
  let neu = flicken(items, id, keine ? rest : (patch as Record<string, unknown>), { id });
  if (keine) {
    const da = neu.some((e) => e.id === id);
    neu = da ? neu.map((e) => (e.id === id ? { ...e, rows: null } : e)) : [...neu, { id, rows: null }];
  }
  return { ...k, shapeGroups: Array.isArray(k['shapeGroups']) ? k['shapeGroups'] : [], shapeItems: neu };
}

/** **Eine Gruppe ändern oder anlegen** (T-394); ohne Namen keine neue Gruppe. */
export function withShapeGroup(card: Record<string, unknown> | undefined, id: string, patch: ShapePatch<Omit<ShapeGroup, 'id'>>): Record<string, unknown> {
  const k = card ?? {};
  const gruppen = Array.isArray(k['shapeGroups']) ? (k['shapeGroups'] as ShapeGroup[]) : [];
  if (!gruppen.some((g) => g.id === id) && !patch.name) return { ...k };
  return { ...k, shapeGroups: flicken(gruppen, id, patch as Record<string, unknown>, { id }), shapeItems: Array.isArray(k['shapeItems']) ? k['shapeItems'] : [] };
}

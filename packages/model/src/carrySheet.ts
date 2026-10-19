/**
 * **Das Tragblatt aus Bausteinen** (REQ-356, D54).
 *
 * Basils Blatt war ein Grundquadrat je Grösse und ein Zusatzquadrat nach
 * Stärke, mit Zonen je Spalte. Jetzt ist es eine Liste von **Bausteinen**:
 * jeder hat eine gemalte Form, eigene **Zonen** (Felder mit einer Dauer
 * aus `DrawTime`) und **Bedingungen** auf Felder des Statblocks — Grösse,
 * Stärke oder jedes andere. Was für eine Kreatur gilt, wird **aneinander­
 * gefügt**, links nach rechts in der Reihenfolge der Liste, oben bündig:
 * eine kleine Kreatur mit viel Stärke hat ein Raster, nicht zwei mit einer
 * Lücke dazwischen.
 *
 * Gespeichert als Einstellung `carrySheet` (JSON); fehlt sie, wird das
 * Blatt aus den älteren Einstellungen `carrySquares` und `carryZones`
 * gerechnet (`legacyCarrySheet`) — ohne Migration, ohne Verlust.
 */

import { derivedValue } from './calc.js';
import { parseCarrySquares, zonesByColumn } from './inventory.js';
import type { ComponentValue, Registry, Relation } from './types.js';

/** Eine Zone: Felder eines Bausteins (`x,y`), die dieselbe Zeit kosten. */
export interface CarryZone {
  id: string;
  label?: string;
  /** Ein Wert aus `DrawTime`. */
  draw: string;
  cells: string[];
}

/**
 * Wann ein Baustein gilt: ein Feld des Statblocks (`Statblock.size`,
 * `Statblock.carryExtra`, `Abilities.str` …), dazu eine Liste erlaubter
 * Werte (`is`) oder eine Spanne (`min`/`max`, je einschliesslich).
 */
export interface CarryCondition {
  field: string;
  is?: string[];
  min?: number;
  max?: number;
}

export interface CarryBlock {
  id: string;
  label: string;
  /** Alle müssen gelten; leer heisst: gilt immer. */
  when: CarryCondition[];
  /** Ein Zeichen je Feld, `.` ist gesperrt — wie `Inventory.grid`. */
  rows: string[];
  zones: CarryZone[];
}

export interface CarrySheet {
  blocks: CarryBlock[];
}

/** Das zusammengefügte Tragraster einer Kreatur. */
export interface AssembledCarry {
  rows: string[];
  /** Zone je Feld (`x,y` → Dauer), wie `Inventory.zones`. */
  zones: Record<string, string>;
  /** Wo jeder Baustein liegt — für die Vorschau. */
  parts: { id: string; label: string; x: number; w: number; h: number }[];
}

/** Wie `EMPTY` im Inventar: diese Zeichen sind kein Feld. */
const FREI = new Set(['0', '.', ' ', '_', '']);

function istOffen(rows: readonly string[], x: number, y: number): boolean {
  return !FREI.has(rows[y]?.charAt(x) ?? '');
}

export function blockWidth(rows: readonly string[]): number {
  return rows.reduce((m, r) => Math.max(m, r.length), 0);
}

/** Ein Quadrat oder Rechteck, ganz offen. */
export function openRows(w: number, h: number): string[] {
  return Array.from({ length: Math.max(0, h) }, () => '#'.repeat(Math.max(0, w)));
}

/**
 * Zone je Feld aus der Zonenliste. Liegt ein Feld in zwei Zonen, gilt die
 * spätere — der Editor lässt das nicht zu, eine von Hand geschriebene
 * Einstellung vielleicht schon. Gesperrte Felder haben keine Zone.
 */
export function zoneMap(rows: readonly string[], zones: readonly CarryZone[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const z of zones) {
    if (!z.draw) continue;
    for (const c of z.cells) {
      const [x, y] = c.split(',').map(Number);
      if (Number.isInteger(x) && Number.isInteger(y) && istOffen(rows, x!, y!)) out[`${x},${y}`] = z.draw;
    }
  }
  return out;
}

/** Die Gegenrichtung: Felder mit derselben Dauer werden eine Zone. */
export function zonesFromMap(map: Readonly<Record<string, string>>, prefix = 'z'): CarryZone[] {
  const je = new Map<string, string[]>();
  for (const [c, d] of Object.entries(map)) {
    if (!d) continue;
    je.set(d, [...(je.get(d) ?? []), c]);
  }
  return [...je.entries()].map(([draw, cells], i) => ({ id: `${prefix}${i + 1}`, draw, cells }));
}

/** Gilt die Bedingung für diesen Wert? Ohne Wert gilt keine. */
export function conditionHolds(c: CarryCondition, value: unknown): boolean {
  if (value === undefined || value === null || value === '') return false;
  if (c.is?.length) {
    const v = String(value).trim().toLowerCase();
    if (!c.is.some((w) => String(w).trim().toLowerCase() === v)) return false;
  }
  if (typeof c.min === 'number' || typeof c.max === 'number') {
    const n = Number(value);
    if (!Number.isFinite(n)) return false;
    if (typeof c.min === 'number' && n < c.min) return false;
    if (typeof c.max === 'number' && n > c.max) return false;
  }
  return true;
}

export function blockApplies(b: CarryBlock, valueOf: (field: string) => unknown): boolean {
  return b.when.every((c) => conditionHolds(c, valueOf(c.field)));
}

/**
 * **Die Bausteine aneinanderfügen:** was gilt, links nach rechts, oben
 * bündig. Gilt keiner, gibt es kein Tragraster (`null`) — dann bleibt das
 * Rechteck der Einstellungen, wie bei einer Grösse, die das Blatt nicht kennt.
 */
export function assembleCarry(sheet: CarrySheet | null | undefined, valueOf: (field: string) => unknown): AssembledCarry | null {
  const gelten = (sheet?.blocks ?? []).filter((b) => b.rows.length && blockApplies(b, valueOf));
  if (!gelten.length) return null;
  const hoehe = Math.max(...gelten.map((b) => b.rows.length));
  const rows: string[] = Array.from({ length: hoehe }, () => '');
  const zones: Record<string, string> = {};
  const parts: AssembledCarry['parts'] = [];
  let x0 = 0;
  for (const b of gelten) {
    const w = blockWidth(b.rows);
    for (let y = 0; y < hoehe; y++) rows[y] += (b.rows[y] ?? '').padEnd(w, '.').slice(0, w);
    for (const [c, d] of Object.entries(zoneMap(b.rows, b.zones))) {
      const [x, y] = c.split(',').map(Number);
      zones[`${x! + x0},${y}`] = d;
    }
    parts.push({ id: b.id, label: b.label, x: x0, w, h: b.rows.length });
    x0 += w;
  }
  return { rows, zones, parts };
}

/** Die Felder, nach denen die Bausteine fragen — für die Vorschau. */
export function sheetFields(sheet: CarrySheet | null | undefined): string[] {
  return [...new Set((sheet?.blocks ?? []).flatMap((b) => b.when.map((c) => c.field)))];
}

/**
 * Der Wert eines Feldes (`Statblock.size`, `Statblock.carryExtra`) aus den
 * Karten eines Statblocks — ein gerechnetes Feld wird gerechnet und auf
 * seine Spanne geklemmt: das Zusatzquadrat reicht bis 5, auch bei STR 24.
 */
export function carryFieldValue(
  registry: Pick<Registry, 'interfaces'>,
  cards: Record<string, ComponentValue | undefined>,
  relations: readonly Relation[] = [],
): (field: string) => unknown {
  return (field) => {
    const [comp, name] = field.split('.');
    if (!comp || !name) return undefined;
    const pd = registry.interfaces[comp]?.schema?.properties?.[name];
    if (!pd?.derived) return cards[comp]?.[name];
    const v = derivedValue(pd, cards[comp], cards, relations);
    if (typeof v !== 'number') return v;
    const lo = typeof pd.min === 'number' ? pd.min : -Infinity;
    const hi = typeof pd.max === 'number' ? pd.max : Infinity;
    return Math.max(lo, Math.min(hi, v));
  };
}

// ------------------------------------------------------------ lesen und schreiben

function alsZone(roh: unknown, i: number): CarryZone | null {
  if (!roh || typeof roh !== 'object') return null;
  const z = roh as Record<string, unknown>;
  const cells = Array.isArray(z['cells']) ? z['cells'].map(String) : [];
  const draw = typeof z['draw'] === 'string' ? z['draw'] : '';
  return { id: typeof z['id'] === 'string' && z['id'] ? z['id'] : `z${i + 1}`, ...(typeof z['label'] === 'string' && z['label'] ? { label: z['label'] } : {}), draw, cells };
}

function alsBedingung(roh: unknown): CarryCondition | null {
  if (!roh || typeof roh !== 'object') return null;
  const c = roh as Record<string, unknown>;
  if (typeof c['field'] !== 'string' || !c['field']) return null;
  return {
    field: c['field'],
    ...(Array.isArray(c['is']) && c['is'].length ? { is: c['is'].map(String) } : {}),
    ...(typeof c['min'] === 'number' ? { min: c['min'] } : {}),
    ...(typeof c['max'] === 'number' ? { max: c['max'] } : {}),
  };
}

/** Die Einstellung `carrySheet` lesen; Unlesbares heisst: kein Blatt. */
export function parseCarrySheet(spec: string | undefined | null): CarrySheet | null {
  if (!spec || !String(spec).trim()) return null;
  let roh: unknown;
  try {
    roh = JSON.parse(String(spec));
  } catch {
    return null;
  }
  const bl = (roh as { blocks?: unknown })?.blocks;
  if (!Array.isArray(bl)) return null;
  const blocks: CarryBlock[] = [];
  bl.forEach((b, i) => {
    if (!b || typeof b !== 'object') return;
    const o = b as Record<string, unknown>;
    const rows = Array.isArray(o['rows']) ? o['rows'].map(String).filter((r) => r !== '') : [];
    blocks.push({
      id: typeof o['id'] === 'string' && o['id'] ? o['id'] : `b${i + 1}`,
      label: typeof o['label'] === 'string' ? o['label'] : '',
      when: (Array.isArray(o['when']) ? o['when'] : []).map(alsBedingung).filter((c): c is CarryCondition => !!c),
      rows,
      zones: (Array.isArray(o['zones']) ? o['zones'] : []).map(alsZone).filter((z): z is CarryZone => !!z),
    });
  });
  return { blocks };
}

export function formatCarrySheet(sheet: CarrySheet): string {
  return JSON.stringify(sheet);
}

/**
 * **Das Blatt aus den älteren Einstellungen** (`carrySquares`,
 * `carryZones`): je Grösse ein Quadrat, je Stufe des Zusatzquadrats
 * (`Statblock.carryExtra`, 1 bis `extraMax`) eines. Die Zonen kommen aus
 * den Spalten, wie sie bisher galten — das Zusatzquadrat stand rechts vom
 * grössten Grundquadrat und las dessen Spalten weiter.
 */
export function legacyCarrySheet(settings: Readonly<Record<string, string>> | null | undefined, extraMax = 5): CarrySheet | null {
  const groessen = parseCarrySquares(settings?.['carrySquares']);
  const namen = Object.keys(groessen);
  if (!namen.length) return null;
  const spalten = zonesByColumn(settings?.['carryZones']);
  const links = Math.max(...Object.values(groessen));
  const zonenAb = (n: number, ab: number, prefix: string): CarryZone[] => {
    const map: Record<string, string> = {};
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (spalten[ab + x]) map[`${x},${y}`] = spalten[ab + x]!;
    return zonesFromMap(map, prefix);
  };
  const blocks: CarryBlock[] = namen.map((g) => ({
    id: `size-${g}`,
    label: `Size: ${g}`,
    when: [{ field: 'Statblock.size', is: [g] }],
    rows: openRows(groessen[g]!, groessen[g]!),
    zones: zonenAb(groessen[g]!, 0, `${g}-`),
  }));
  for (let e = 1; e <= Math.max(0, Math.trunc(extraMax)); e++) {
    blocks.push({
      id: `strength-${e}`,
      label: `Strength +${e}`,
      when: [{ field: 'Statblock.carryExtra', min: e, max: e }],
      rows: openRows(e, e),
      zones: zonenAb(e, links, `str${e}-`),
    });
  }
  return { blocks };
}

/** Das Blatt, das gilt: `carrySheet`, sonst aus den älteren Einstellungen. */
export function carrySheetOf(settings: Readonly<Record<string, string>> | null | undefined, extraMax = 5): CarrySheet | null {
  return parseCarrySheet(settings?.['carrySheet']) ?? legacyCarrySheet(settings, extraMax);
}

// ------------------------------------------------------------ Behältervorlagen

export interface ContainerTemplate {
  rows: string[];
  zones: CarryZone[];
}

/**
 * Eine Behältervorlage `container:<Name>`: JSON (`{"rows": […], "zones":
 * […]}`, Zonen wie an einem Baustein) oder die ältere Form
 * `.###../######/.###.. | 0-1:action` mit Zonen nach Spalten.
 */
export function parseContainerTemplate(spec: string | undefined | null): ContainerTemplate | null {
  const s = String(spec ?? '').trim();
  if (!s) return null;
  if (s.startsWith('{')) {
    try {
      const o = JSON.parse(s) as Record<string, unknown>;
      const rows = Array.isArray(o['rows']) ? o['rows'].map(String).filter((r) => r !== '') : [];
      if (!rows.length) return null;
      return { rows, zones: (Array.isArray(o['zones']) ? o['zones'] : []).map(alsZone).filter((z): z is CarryZone => !!z) };
    } catch {
      return null;
    }
  }
  const [form, zonen] = s.split('|');
  const rows = String(form ?? '').split('/').map((r) => r.trim()).filter((r) => r !== '');
  if (!rows.length) return null;
  const spalten = zonesByColumn(zonen);
  const map: Record<string, string> = {};
  rows.forEach((r, y) => {
    for (let x = 0; x < r.length; x++) if (!FREI.has(r.charAt(x)) && spalten[x]) map[`${x},${y}`] = spalten[x]!;
  });
  return { rows, zones: zonesFromMap(map) };
}

export function formatContainerTemplate(t: ContainerTemplate): string {
  return JSON.stringify({ rows: t.rows, zones: t.zones });
}

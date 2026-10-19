/**
 * **Die Zeilen einer Tabelle zum Würfeln** (T-310): was das Element
 * `table` zeichnet — der Würfel, die Spalten und je Zeile ihre Spanne.
 *
 * Eine Nachschlagetabelle nennt die Spanne in ihrer ersten Zelle („1",
 * „2–3", „01–05", „00"); ein Würfeltopf ohne Spalten hat nur Gewichte, und
 * die Spanne wird aus ihnen gezählt. Gespeichert wird nichts davon (D8):
 * die Zeilen bleiben, wie sie in `Table.rows` stehen.
 */

import type { Entity } from './types.js';

export interface RollTableRow {
  /** Die Zellen, wie sie dastehen — Text mit `[[Verweisen]]` und `{{Würfeln}}`. */
  cells: string[];
  lo: number | null;
  hi: number | null;
}

export interface RollTable {
  die: string;
  /** Die Kopfzeile; die erste ist die Würfelspalte. */
  columns: string[];
  rows: RollTableRow[];
  /** Die Würfelspalte wurde aus den Gewichten gezählt und steht nicht in den Zeilen. */
  counted: boolean;
}

interface RohZeile {
  cells?: unknown[];
  text?: unknown;
  weight?: unknown;
}

const alsText = (x: unknown): string => (x === null || x === undefined ? '' : typeof x === 'object' ? '' : String(x));

/** Eine Zahl der Würfelspalte; „00" ist 100. */
function zahl(s: string): number | null {
  if (!/^\d+$/.test(s)) return null;
  return /^0+$/.test(s) && s.length > 1 ? 100 : Number(s);
}

/** **Die Spanne einer Zelle:** „3" → 3–3, „2–3" → 2–3, „96–00" → 96–100, „11+" → 11–∞. */
export function rowRange(cell: string): { lo: number; hi: number } | null {
  const t = cell.trim();
  const plus = /^(\d+)\s*\+$/.exec(t);
  if (plus) {
    const lo = zahl(plus[1]!);
    return lo === null ? null : { lo, hi: Number.POSITIVE_INFINITY };
  }
  const m = /^(\d+)(?:\s*[-–—]\s*(\d+))?$/.exec(t);
  if (!m) return null;
  const lo = zahl(m[1]!);
  const hi = m[2] === undefined ? lo : zahl(m[2]);
  return lo === null || hi === null ? null : { lo, hi };
}

/** Die Spanne als Text: 3 oder 2–3. */
export function rangeText(lo: number | null, hi: number | null): string {
  if (lo === null) return '';
  if (hi === null || hi === lo) return String(lo);
  return hi === Number.POSITIVE_INFINITY ? `${lo}+` : `${lo}–${hi}`;
}

/** **Die Tabelle eines Artikels**, oder `null`, wenn er keine Zeilen hat. */
export function rollTableOf(entity: Pick<Entity, 'components'>): RollTable | null {
  const karte = entity.components?.['Table'] as { die?: unknown; columns?: unknown; rows?: unknown } | undefined;
  const roh = Array.isArray(karte?.rows) ? (karte.rows as RohZeile[]).filter((z) => z && typeof z === 'object') : [];
  if (!roh.length) return null;
  const die = alsText(karte?.die) || '1d100';
  const spalten = Array.isArray(karte?.columns) ? karte.columns.map(alsText) : [];
  const zellen = roh.map((z) => (Array.isArray(z.cells) && z.cells.length ? z.cells.map(alsText) : [alsText(z.text)]));
  /* Nennt jede Zeile ihre Spanne vorn, ist die erste Spalte die Würfelspalte. */
  const spannen = zellen.map((c) => rowRange(c[0] ?? ''));
  if (spannen.every(Boolean)) {
    return {
      die,
      columns: spalten.length ? spalten : [die.replace(/^1(?=d)/, ''), ''],
      rows: zellen.map((cells, i) => ({ cells, lo: spannen[i]!.lo, hi: spannen[i]!.hi })),
      counted: false,
    };
  }
  /* Sonst zählen die Gewichte (fehlt eins, zählt es 1). */
  let stand = 0;
  const rows = zellen.map((cells, i) => {
    const w = Number(roh[i]!.weight);
    const gewicht = Number.isFinite(w) && w > 0 ? Math.round(w) : 1;
    const lo = stand + 1;
    stand += gewicht;
    return { cells, lo, hi: stand };
  });
  return { die, columns: [die.replace(/^1(?=d)/, ''), ...(spalten.length ? spalten : [''])], rows, counted: true };
}

/** **Welche Zeile ein Wurf trifft** — ihr Index, oder -1. */
export function rowForRoll(table: Pick<RollTable, 'rows'>, total: number): number {
  return table.rows.findIndex((z) => z.lo !== null && z.hi !== null && total >= z.lo && total <= z.hi);
}

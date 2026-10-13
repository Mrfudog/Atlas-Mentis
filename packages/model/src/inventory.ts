/**
 * **Das Inventar nach Basils Blatt** (REQ-214 bis 217, D54).
 *
 * Drei Rechnungen, alle beim Lesen (D8) und keine davon gespeichert:
 *
 *  - **Das Tragraster** einer Kreatur, deren Inventar keine eigene Form
 *    hat: links ein Grundquadrat nach Grösse (Tiny 3 … Large 6), rechts ein
 *    Zusatzquadrat 0 … 5, das der Statblock rechnet (`Statblock.carryExtra`,
 *    eine Rechnung wie der Zauber-SG). Wie gross welche Grösse ist und
 *    welche Spalte welche Zone hat, steht als Einstellung — eine Kampagne
 *    mit einem anderen Blatt ist eine andere Zeile, kein Codewechsel.
 *  - **Die Zonen nach Spalten** (`0-1:bonus action, 2-4:action`): dieselbe
 *    Schreibweise für das Tragraster und für die Vorlagen der Behälter.
 *  - **Die Ziehstufe die Kette hinauf**: ein Stück in einem Behälter
 *    braucht das Langsamere aus seiner Zone und der Stufe des Behälters
 *    + 1. Ein Behälter an einem Körperplatz nimmt die Stufe des Platzes
 *    (Einstellung `slotDraw`).
 *
 * Kein Framework, keine Entitäten: wer die Kette baut (Server, Prototyp),
 * reicht die Plätze herein. So bleibt die Regel an einer Stelle.
 */

/** Ein Zeichen, das kein Feld ist — wie in `Item.rows` und `Inventory.grid`. */
const EMPTY = new Set(['0', '.', ' ', '_']);

/**
 * Eine Liste `schlüssel:wert, schlüssel:wert` lesen. Leere Teile und Teile
 * ohne Doppelpunkt fallen weg — eine halb getippte Einstellung soll den
 * Rest nicht mitnehmen.
 */
export function parsePairs(spec: string | undefined | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const teil of String(spec ?? '').split(',')) {
    const i = teil.indexOf(':');
    if (i <= 0) continue;
    const k = teil.slice(0, i).trim();
    const v = teil.slice(i + 1).trim();
    if (k && v) out[k] = v;
  }
  return out;
}

/** `tiny:3, small:4, medium:5, large:6` → Seitenlänge je Grösse. */
export function parseCarrySquares(spec: string | undefined | null): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(parsePairs(spec))) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) out[k.toLowerCase()] = Math.floor(n);
  }
  return out;
}

/** Eine Zahl auf eine Spanne klemmen; keine Zahl heisst die Untergrenze. */
export function clampExtra(n: unknown, min = 0, max = 5): number {
  const z = Number(n);
  if (!Number.isFinite(z)) return min;
  return Math.max(min, Math.min(max, Math.trunc(z)));
}

export interface CarryGrid {
  /** Die Form, wie `Inventory.grid` sie schreibt: `#` ist ein Feld. */
  rows: string[];
  /** Seitenlänge des Grundquadrats (aus der Grösse). */
  base: number;
  /** Seitenlänge des Zusatzquadrats (aus dem Statblock). */
  extra: number;
  /** Ab welcher Spalte das Zusatzquadrat steht. */
  extraAt: number;
}

/**
 * **Das Tragraster aus Grösse und Statblock** (REQ-215).
 *
 * Wie auf dem Blatt: das Grundquadrat links oben, so breit wie das grösste
 * Grundquadrat der Einstellung (also 6), daneben das Zusatzquadrat, so
 * breit wie sein Höchstwert (5) — 11 × 6. Was ausserhalb der beiden
 * Quadrate liegt, ist gesperrt (`.`), damit die Spalten und damit die
 * Zonen bei jeder Grösse dieselben bleiben.
 *
 * Eine Grösse, die die Einstellung nicht kennt (huge, gargantuan, oder gar
 * keine), gibt **kein** Raster — dann gilt das Rechteck wie bisher.
 */
export function carryGrid(
  size: string | undefined | null,
  extra: unknown,
  squares: Record<string, number>,
  extraMax = 5,
): CarryGrid | null {
  const base = squares[String(size ?? '').toLowerCase()];
  if (!base) return null;
  const links = Math.max(...Object.values(squares));
  const rechtsMax = Math.max(0, Math.trunc(extraMax));
  const zusatz = clampExtra(extra, 0, rechtsMax);
  const breite = links + rechtsMax;
  const hoehe = Math.max(links, rechtsMax);
  const rows: string[] = [];
  for (let y = 0; y < hoehe; y++) {
    let r = '';
    for (let x = 0; x < breite; x++) {
      const inBasis = x < base && y < base;
      const inZusatz = x >= links && x - links < zusatz && y < zusatz;
      r += inBasis || inZusatz ? '#' : '.';
    }
    rows.push(r);
  }
  return { rows, base, extra: zusatz, extraAt: links };
}

/**
 * **Zonen nach Spalten** (`0-1:bonus action, 2-4:action`) für eine Form.
 * Gesperrte Felder bekommen keine Zone: ein Feld, auf dem nichts liegen
 * kann, kostet nichts.
 */
export function columnZones(spec: string | undefined | null, rows: readonly string[]): Record<string, string> {
  const spalte: Record<number, string> = {};
  for (const [k, v] of Object.entries(parsePairs(spec))) {
    const m = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(k);
    if (!m) continue;
    const von = Number(m[1]);
    const bis = m[2] === undefined ? von : Number(m[2]);
    for (let x = Math.min(von, bis); x <= Math.max(von, bis); x++) spalte[x] = v;
  }
  const out: Record<string, string> = {};
  rows.forEach((r, y) => {
    for (let x = 0; x < r.length; x++) {
      if (EMPTY.has(r.charAt(x))) continue;
      const z = spalte[x];
      if (z) out[`${x},${y}`] = z;
    }
  });
  return out;
}

/**
 * Eine Behältervorlage aus einer Einstellung `container:<Name>`:
 * `.###../######/.###.. | 0-1:action, 2-3:turn`. Zeilen mit `/`, nach dem
 * Strich die Zonen nach Spalten (darf fehlen).
 */
export function parseContainerPreset(spec: string | undefined | null): { grid: string[]; zones: Record<string, string> } | null {
  const [form, zonen] = String(spec ?? '').split('|');
  const grid = String(form ?? '').split('/').map((r) => r.trim()).filter((r) => r !== '');
  if (!grid.length) return null;
  return { grid, zones: columnZones(zonen, grid) };
}

/** Das Langsamere zweier Stufen auf der Leiter; eine unbekannte zählt nicht. */
export function slowerDraw(a: string | null | undefined, b: string | null | undefined, ladder: readonly string[]): string | null {
  const ia = a ? ladder.indexOf(a) : -1;
  const ib = b ? ladder.indexOf(b) : -1;
  if (ia < 0 && ib < 0) return null;
  return ladder[Math.max(ia, ib)] ?? null;
}

/** Eine Stufe weiter; die letzte bleibt die letzte. */
export function nextDraw(a: string | null | undefined, ladder: readonly string[]): string | null {
  const i = a ? ladder.indexOf(a) : -1;
  if (i < 0) return null;
  return ladder[Math.min(i + 1, ladder.length - 1)] ?? null;
}

/** Wo ein Stück liegt: in welchem Behälter, auf welcher Zone oder an welchem Platz. */
export interface Placement {
  /** Der Behälter (Name oder Id) — nur für den Weg, gerechnet wird nicht damit. */
  via: string;
  /** Die langsamste Zone, die das Stück im Behälter bedeckt. */
  zone?: string | null;
  /** Der Körperplatz, nur im äussersten Behälter (dem der Kreatur). */
  slot?: string | null;
}

export interface DrawStep extends Placement {
  /** Die Stufe nach diesem Schritt. */
  stage: string | null;
}

/**
 * **Die Ziehstufe die Kette hinauf** (REQ-216, D54).
 *
 * `chain[0]` ist der äusserste Platz (im Inventar der Kreatur), der letzte
 * der des Stücks selbst. Aussen gilt der Platz (`slotDraw`) oder die Zone;
 * jeder Behälter weiter innen gibt eine Stufe dazu: das Langsamere aus der
 * eigenen Zone und der Stufe des Behälters + 1.
 *
 * Kennt ein Schritt keine Stufe (nicht ins Raster gelegt, kein Platz, eine
 * Zone, die die Leiter nicht kennt), ist das Ergebnis `null` — eine
 * geschätzte Stufe sähe aus wie eine, die stimmt.
 */
export function drawStage(
  chain: readonly Placement[],
  ladder: readonly string[],
  slotDraw: Record<string, string>,
): { stage: string | null; steps: DrawStep[] } {
  const steps: DrawStep[] = [];
  let stufe: string | null = null;
  chain.forEach((p, i) => {
    if (i === 0) {
      const amPlatz = p.slot ? slotDraw[p.slot] : undefined;
      stufe = amPlatz && ladder.includes(amPlatz) ? amPlatz
        : p.zone && ladder.includes(p.zone) ? p.zone : null;
    } else if (stufe !== null) {
      const zone = p.zone && ladder.includes(p.zone) ? p.zone : null;
      /* Ohne Zone im inneren Behälter zählt nur die Stufe des Behälters + 1:
         eine Bag of Holding hat auf dem Blatt keine Zonen, und was darin
         liegt, ist trotzdem eine Stufe weiter weg. */
      stufe = slowerDraw(zone, nextDraw(stufe, ladder), ladder);
    }
    steps.push({ ...p, stage: stufe });
  });
  return { stage: stufe, steps };
}

/**
 * Die Hände (REQ-225, D58): was an diesen Plätzen liegt, ist „in der Hand“
 * und kann fallen gelassen oder verstaut werden. Ein Stück ohne Platz mit
 * `tier: 'held'` zählt auch — so stand es vor dem Blatt.
 */
export const HAND_SLOTS: readonly string[] = ['mainHand', 'offHand'];

export function inHand(p: { slot?: string | null; tier?: string | null }): boolean {
  return p.slot ? HAND_SLOTS.includes(p.slot) : p.tier === 'held';
}

/**
 * Was Fallenlassen und Verstauen kosten (REQ-225, D58), aus der
 * Einstellung `handActions` (`drop:free action, stow:bonus action`). Ein
 * Wert, der nicht auf der Leiter (`DrawTime`) steht, gilt nicht — dann
 * steht die Handlung am Bogen nicht, statt auf einer erfundenen Stufe.
 */
export function handActions(
  spec: string | undefined | null,
  ladder: readonly string[],
): { drop: string | null; stow: string | null } {
  const p = parsePairs(spec);
  const auf = (v: string | undefined): string | null => (v && ladder.includes(v) ? v : null);
  return { drop: auf(p['drop']), stow: auf(p['stow']) };
}

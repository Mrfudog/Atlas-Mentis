/**
 * **Der Bewegungsrechner der Karte** (REQ-206, 207, D52, D56).
 *
 * Gerechnet wird auf dem Quadratraster, in Fuss, mit der Diagonalregel
 * 5-10-5: die erste Diagonale kostet ein Feld, die zweite zwei, die dritte
 * wieder eins. Gezählt wird **je Kreatur und Zug** — die Parität (ist die
 * nächste Diagonale die teure?) gehört zum Suchzustand und nicht zum Feld:
 * dasselbe Feld kostet über einen Weg mit einer Diagonale etwas anderes als
 * über einen mit zwei. Deshalb sucht Dijkstra über (Feld, Parität) und
 * nicht über das Feld allein; wer das weglässt, findet einen Weg, der in
 * Wahrheit fünf Fuss teurer ist.
 *
 * Die Parität läuft **über Wegpunkte weiter** und **über die Züge einer
 * Runde hinweg nicht**: mit jedem Zug beginnt die Zählung neu (D52). Was
 * verbraucht ist, steht im Sitzungszustand (`SessionState.moves`) und nicht
 * am Artikel — eine Kreatur ist nicht „schon 20 Fuss gelaufen", nur ihr
 * Zug in dieser Sitzung ist es.
 *
 * Kein Framework, keine Karte: was hereinkommt, ist ein Raster mit Wänden
 * in Feldeinheiten (Feld (0,0) reicht von 0 bis 1), Kosten je Feld und die
 * Felder, die besetzt sind. Wie man aus einer Karte dahin kommt, weiss der
 * Aufrufer.
 */

/** Ein Feld im Raster: Spalte und Zeile. */
export interface Cell {
  x: number;
  y: number;
}

/** Eine Strecke in Feldeinheiten — eine Wand, eine Sichtlinie. */
export interface Seg {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** 0: die nächste Diagonale kostet ein Feld; 1: sie kostet zwei. */
export type Parity = 0 | 1;

type CellSet = ReadonlySet<string> | readonly string[];

export interface MoveGrid {
  cols: number;
  rows: number;
  /** Was den Schritt hält (`blocksMove`), in Feldeinheiten. */
  walls: readonly Seg[];
  /**
   * Kosten je Feld als Faktor, Schlüssel `x,y` (`cellKey`). Fehlt einer,
   * gilt 1; schwieriges Gelände ist 2. `Infinity` heisst: nicht betretbar.
   * Der Faktor gilt für das Feld, das man **betritt** — so zählt die Regel
   * („jeder Fuss kostet einen mehr“), und so kostet auch der Schritt aus
   * dem Schlamm heraus nichts extra.
   */
  cost?: Readonly<Record<string, number>>;
  /** Felder, durch die man nicht kommt (Gegner). */
  blocked?: CellSet;
  /** Felder, durch die man darf, auf denen man aber nicht stehen bleibt (Verbündete). */
  noStop?: CellSet;
  /**
   * Felder, die der Weg meidet, wenn es geht — Gefahren, die Reichweite von
   * Gegnern (REQ-207). Gemieden heisst: ein Weg mit weniger solchen Feldern
   * gewinnt, auch wenn er länger ist. Die Fuss zählen trotzdem ehrlich.
   */
  avoid?: CellSet;
  /** Fuss je Feld; die Regel rechnet mit 5. */
  square?: number;
}

export interface PathResult {
  /** Die Felder des Weges, Start eingeschlossen. */
  cells: Cell[];
  /** Was der Weg kostet, in Fuss. */
  feet: number;
  /** Die Parität am Ende — der nächste Weg in diesem Zug fängt damit an. */
  parity: Parity;
  /** Wie viele gemiedene Felder der Weg trotzdem betritt. */
  avoided: number;
}

export const cellKey = (c: Cell): string => `${c.x},${c.y}`;

function asSet(s: CellSet | undefined): ReadonlySet<string> {
  if (!s) return new Set();
  return s instanceof Set ? s : new Set(s as readonly string[]);
}

/**
 * Was ein Schritt kostet (D52). Orthogonal ein Feld, diagonal ein oder zwei
 * Felder je nach Parität; mal dem Faktor des Feldes, das man betritt.
 */
export function stepFeet(
  diagonal: boolean,
  parity: Parity,
  factor = 1,
  square = 5,
): { feet: number; parity: Parity } {
  const f = Number.isFinite(factor) && factor > 0 ? factor : 1;
  if (!diagonal) return { feet: square * f, parity };
  return parity === 0
    ? { feet: square * f, parity: 1 }
    : { feet: 2 * square * f, parity: 0 };
}

const EPS = 1e-9;

/** Schneiden sich die Strecken a–b und w? Berührung zählt (eine Ecke hält). */
export function segmentsCross(ax: number, ay: number, bx: number, by: number, w: Seg): boolean {
  const rx = bx - ax, ry = by - ay;
  const sx = w.x2 - w.x1, sy = w.y2 - w.y1;
  const den = rx * sy - ry * sx;
  const qx = w.x1 - ax, qy = w.y1 - ay;
  if (Math.abs(den) < EPS) {
    // Parallel: nur wenn kollinear und überlappend.
    if (Math.abs(qx * ry - qy * rx) > EPS) return false;
    const len = rx * rx + ry * ry;
    if (len < EPS) return false;
    const t0 = (qx * rx + qy * ry) / len;
    const t1 = ((w.x2 - ax) * rx + (w.y2 - ay) * ry) / len;
    return Math.max(t0, t1) >= -EPS && Math.min(t0, t1) <= 1 + EPS;
  }
  const t = (qx * sy - qy * sx) / den;
  const u = (qx * ry - qy * rx) / den;
  return t >= -EPS && t <= 1 + EPS && u >= -EPS && u <= 1 + EPS;
}

/** Hält eine Wand den Schritt von Feldmitte zu Feldmitte? */
export function stepBlocked(a: Cell, b: Cell, walls: readonly Seg[]): boolean {
  const ax = a.x + 0.5, ay = a.y + 0.5, bx = b.x + 0.5, by = b.y + 0.5;
  for (const w of walls) if (segmentsCross(ax, ay, bx, by, w)) return true;
  return false;
}

/* Erst die geraden Nachbarn: bei gleichen Kosten gewinnt der Weg ohne
   Diagonale, und der sieht am Tisch so aus, wie man ihn zählen würde. */
const NEIGHBOURS: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1],
];

/** Eine kleine Halde über Zahlen (Index) mit Schlüsseln (Rang). */
class Heap {
  private items: Array<[number, number, number]> = [];
  push(pen: number, feet: number, idx: number): void {
    const a = this.items;
    a.push([pen, feet, idx]);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!less(a[i]!, a[p]!)) break;
      [a[i], a[p]] = [a[p]!, a[i]!];
      i = p;
    }
  }
  pop(): [number, number, number] | undefined {
    const a = this.items;
    if (!a.length) return undefined;
    const top = a[0]!;
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && less(a[l]!, a[m]!)) m = l;
        if (r < a.length && less(a[r]!, a[m]!)) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m]!, a[i]!];
        i = m;
      }
    }
    return top;
  }
  get size(): number {
    return this.items.length;
  }
}
function less(a: [number, number, number], b: [number, number, number]): boolean {
  return a[0] !== b[0] ? a[0] < b[0] : a[1] < b[1];
}

interface Search {
  pen: Float64Array;
  feet: Float64Array;
  prev: Int32Array;
}

/**
 * Dijkstra über (Feld, Parität). Rang: zuerst gemiedene Felder (wenn
 * `avoid` gilt), dann Fuss. `budget` bricht ab, was teurer wird.
 */
function search(
  g: MoveGrid,
  from: Cell,
  parity: Parity,
  opts: { avoid: boolean; budget?: number; target?: Cell },
): Search {
  const { cols, rows } = g;
  const square = g.square ?? 5;
  const n = cols * rows * 2;
  const pen = new Float64Array(n).fill(Infinity);
  const feet = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const blocked = asSet(g.blocked);
  const avoid = opts.avoid ? asSet(g.avoid) : new Set<string>();
  const cost = g.cost ?? {};
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < cols && y < rows;
  if (!inside(from.x, from.y)) return { pen, feet, prev };
  const start = (from.y * cols + from.x) * 2 + parity;
  pen[start] = 0;
  feet[start] = 0;
  const heap = new Heap();
  heap.push(0, 0, start);
  const wallCache = new Map<number, boolean>();
  while (heap.size) {
    const [p, f, idx] = heap.pop()!;
    if (p !== pen[idx] || f !== feet[idx]) continue;
    const cell = idx >> 1, par = (idx & 1) as Parity;
    const x = cell % cols, y = (cell - x) / cols;
    if (opts.target && x === opts.target.x && y === opts.target.y) break;
    for (const [dx, dy] of NEIGHBOURS) {
      const nx = x + dx, ny = y + dy;
      if (!inside(nx, ny)) continue;
      const k = `${nx},${ny}`;
      if (blocked.has(k)) continue;
      const factor = cost[k] ?? 1;
      if (factor === Infinity) continue;
      const ncell = ny * cols + nx;
      const ck = cell < ncell ? cell * cols * rows + ncell : ncell * cols * rows + cell;
      let wall = wallCache.get(ck);
      if (wall === undefined) {
        wall = stepBlocked({ x, y }, { x: nx, y: ny }, g.walls);
        wallCache.set(ck, wall);
      }
      if (wall) continue;
      const st = stepFeet(dx !== 0 && dy !== 0, par, factor, square);
      const nf = f + st.feet;
      if (opts.budget !== undefined && nf > opts.budget + EPS) continue;
      const np = p + (avoid.has(k) ? 1 : 0);
      const ni = ncell * 2 + st.parity;
      if (np < pen[ni]! || (np === pen[ni] && nf < feet[ni]!)) {
        pen[ni] = np;
        feet[ni] = nf;
        prev[ni] = idx;
        heap.push(np, nf, ni);
      }
    }
  }
  return { pen, feet, prev };
}

/**
 * Der günstigste Weg von einem Feld zu einem anderen (REQ-206). `null`,
 * wenn keiner hinführt oder das Ziel besetzt ist. Mit `avoid` meidet er,
 * was `grid.avoid` nennt — die Fuss zählt er trotzdem ehrlich.
 */
export function cheapestPath(
  g: MoveGrid,
  from: Cell,
  to: Cell,
  parity: Parity = 0,
  opts: { avoid?: boolean } = {},
): PathResult | null {
  const { cols, rows } = g;
  if (to.x < 0 || to.y < 0 || to.x >= cols || to.y >= rows) return null;
  const tk = cellKey(to);
  if (from.x === to.x && from.y === to.y) return { cells: [{ ...from }], feet: 0, parity, avoided: 0 };
  if (asSet(g.blocked).has(tk) || asSet(g.noStop).has(tk)) return null;
  const s = search(g, from, parity, { avoid: !!opts.avoid, target: to });
  const base = (to.y * cols + to.x) * 2;
  let best = -1;
  for (const i of [base, base + 1]) {
    if (s.feet[i] === Infinity) continue;
    if (best < 0 || less([s.pen[i]!, s.feet[i]!, 0], [s.pen[best]!, s.feet[best]!, 0])) best = i;
  }
  if (best < 0) return null;
  const cells: Cell[] = [];
  for (let i = best; i >= 0; i = s.prev[i]!) {
    const c = i >> 1;
    cells.push({ x: c % cols, y: Math.floor(c / cols) });
  }
  cells.reverse();
  return { cells, feet: s.feet[best]!, parity: (best & 1) as Parity, avoided: s.pen[best]! };
}

/**
 * Ein Weg über Wegpunkte (REQ-207): zwischen je zwei Punkten der
 * günstigste, und die Diagonalenzählung läuft über die Punkte weiter.
 * `null`, wenn ein Stück nicht geht — `failedLeg` sagt dann, welches.
 */
export function pathVia(
  g: MoveGrid,
  from: Cell,
  points: readonly Cell[],
  parity: Parity = 0,
  opts: { avoid?: boolean } = {},
): (PathResult & { legs: number[] }) | { failedLeg: number } {
  let at = from, par = parity, feet = 0, avoided = 0;
  const cells: Cell[] = [{ ...from }];
  const legs: number[] = [];
  for (let i = 0; i < points.length; i++) {
    const r = cheapestPath(g, at, points[i]!, par, opts);
    if (!r) return { failedLeg: i };
    cells.push(...r.cells.slice(1));
    feet += r.feet;
    avoided += r.avoided;
    par = r.parity;
    legs.push(r.feet);
    at = points[i]!;
  }
  return { cells, feet, parity: par, avoided, legs };
}

/**
 * Wie weit es reicht (Modus „grösste Reichweite“): je erreichbarem Feld,
 * was es mindestens kostet. Felder, auf denen man nicht stehen bleibt,
 * fehlen — man kommt durch, aber nicht an.
 */
export function reachable(
  g: MoveGrid,
  from: Cell,
  budget: number,
  parity: Parity = 0,
): Record<string, number> {
  const s = search(g, from, parity, { avoid: false, budget });
  const noStop = asSet(g.noStop);
  const out: Record<string, number> = {};
  for (let c = 0; c < g.cols * g.rows; c++) {
    const f = Math.min(s.feet[2 * c]!, s.feet[2 * c + 1]!);
    if (f === Infinity) continue;
    const k = `${c % g.cols},${Math.floor(c / g.cols)}`;
    if (noStop.has(k) && f > 0) continue;
    out[k] = f;
  }
  return out;
}

/* ---------- Der Zug: Tempo, Verbrauch, Parität (Sitzungszustand) ---------- */

/**
 * Was ein Token in diesem Zug schon gelaufen ist (`SessionState.moves`).
 * `turn` sagt, welcher Zug das war — stimmt er nicht mit dem laufenden
 * überein, ist der Eintrag alt, und es gilt ein frischer (D52: mit jedem
 * Zug neu). Ein Zähler, den jemand zurücksetzen muss, wird vergessen.
 */
export interface TurnMove {
  token: string;
  turn: string;
  speed: number;
  used: number;
  parity: Parity;
}

export function currentMove(
  entries: readonly Partial<TurnMove>[] | undefined,
  token: string,
  turn: string,
  baseSpeed: number,
): TurnMove {
  const hit = (entries ?? []).find((m) => m.token === token);
  if (!hit || hit.turn !== turn) return { token, turn, speed: baseSpeed, used: 0, parity: 0 };
  return {
    token,
    turn,
    speed: Number.isFinite(Number(hit.speed)) ? Number(hit.speed) : baseSpeed,
    used: Number(hit.used) || 0,
    parity: hit.parity === 1 ? 1 : 0,
  };
}

/** Den Eintrag eines Tokens ersetzen; die übrigen bleiben, wie sie sind. */
export function putMove(entries: readonly Partial<TurnMove>[] | undefined, m: TurnMove): TurnMove[] {
  return [...((entries ?? []).filter((x) => x.token !== m.token) as TurnMove[]), m];
}

/* ---------- Tempo aus dem Statblock ---------- */

const FT_PER_M = 1 / 0.3048;

/**
 * Die Bewegungsarten eines Tempos: „30 ft., climb 20 ft., fly 60 ft.
 * (hover)“ wird `{walk: 30, climb: 20, fly: 60}`. Eine Zahl ohne Namen ist
 * das Gehen; eine ohne Einheit Fuss (das Ausgangsmass des Feldes). Meter
 * werden auf ganze fünf Fuss gerundet — gerechnet wird in Feldern.
 */
export function speedModes(text: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (text == null) return out;
  if (typeof text === 'number') return Number.isFinite(text) ? { walk: text } : out;
  for (const part of String(text).split(/[,;]/)) {
    const m = /^\s*([a-z]+)?\s*(\d+(?:[.,]\d+)?)\s*(ft\.?|feet|foot|m\b|meters?|metres?)?/i.exec(part);
    if (!m) continue;
    let n = Number(m[2]!.replace(',', '.'));
    if (m[3] && /^m/i.test(m[3])) n = Math.round((n * FT_PER_M) / 5) * 5;
    const mode = (m[1] ?? 'walk').toLowerCase();
    if (!(mode in out)) out[mode] = n;
  }
  return out;
}

export interface SpeedPreset {
  key: string;
  label: string;
  feet: number;
}

/**
 * Die Kurzwahl für das Tempo des Zuges (D52: eine Zahl statt eines
 * Spurt-Schalters). Grundtempo, Spurt ×2, Klettern und Schwimmen mit dem
 * eigenen Tempo, wenn der Statblock eines nennt, sonst die Hälfte; Fliegen
 * und Graben nur, wenn es da steht. Jede weitere Ausnahme ist eine andere
 * Zahl, die man eintippt — keine Regel im Code.
 */
export function speedPresets(modes: Readonly<Record<string, number>>): SpeedPreset[] {
  const walk = modes.walk ?? 30;
  const half = Math.floor(walk / 2);
  const out: SpeedPreset[] = [
    { key: 'walk', label: 'Speed', feet: walk },
    { key: 'dash', label: 'Dash ×2', feet: walk * 2 },
    { key: 'climb', label: modes.climb != null ? 'Climb' : 'Climb ½', feet: modes.climb ?? half },
    { key: 'swim', label: modes.swim != null ? 'Swim' : 'Swim ½', feet: modes.swim ?? half },
  ];
  for (const k of ['fly', 'burrow']) {
    const v = modes[k];
    if (v != null) out.push({ key: k, label: k === 'fly' ? 'Fly' : 'Burrow', feet: v });
  }
  return out;
}

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
 * **Der Platz einer Kreatur** (REQ-224, D58): ein Token nimmt nach der
 * Grösse seines Statblocks (Regeln 2014) ein Quadrat von `span` × `span`
 * Feldern ein — tiny, small, medium eins, large zwei, huge drei,
 * gargantuan vier. Gesucht wird dann über die **Ecke oben links** des
 * Platzes (den Anker): der ganze Platz muss passen, eine Wand hält den
 * Schritt, wenn sie ihn für irgendein Feld des Platzes hält, und ein
 * Schritt kostet nach dem teuersten Feld, das er neu betritt.
 *
 * Kein Framework, keine Karte: was hereinkommt, ist ein Raster mit Wänden
 * in Feldeinheiten (Feld (0,0) reicht von 0 bis 1), Kosten je Feld und die
 * Felder, die besetzt sind. Wie man aus einer Karte dahin kommt, weiss der
 * Aufrufer.
 */

import type { Entity, EntityId } from './types.js';
import { resolveInstance } from './instance.js';

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
  /**
   * Wie viele Felder breit der Platz dessen ist, der sich bewegt (REQ-224,
   * `sizeSpan`). Fehlt es, ein Feld. Mit mehr als einem Feld sind alle
   * Zellen, die hereinkommen und herausgehen, **Anker** — die Ecke oben
   * links des Platzes.
   */
  span?: number;
  /**
   * Darf auf `noStop` stehen bleiben — eine winzige Kreatur teilt sich ein
   * Feld (D58).
   */
  share?: boolean;
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

/* ---------- Der Platz nach Grösse (REQ-224, D58) ---------- */

/** Die Grössen der Zeile `Size`, englisch wie das Regelwerk. */
export type CreatureSize = 'tiny' | 'small' | 'medium' | 'large' | 'huge' | 'gargantuan';

/** Felder je Seite nach den Regeln 2014; tiny teilt sich sein Feld. */
export const SIZE_SPAN: Readonly<Record<CreatureSize, number>> = {
  tiny: 1, small: 1, medium: 1, large: 2, huge: 3, gargantuan: 4,
};

/**
 * Wie breit der Platz zu einer Grösse ist. Was keine bekannte Grösse ist —
 * kein Statblock, ein leeres Feld, ein Tippfehler —, nimmt ein Feld: ein
 * Token ohne Zahlen steht trotzdem auf der Karte.
 */
export function sizeSpan(size: unknown): number {
  const k = String(size ?? '').trim().toLowerCase() as CreatureSize;
  return SIZE_SPAN[k] ?? 1;
}

/**
 * Die Grösse eines Statblocks, **beim Lesen** (D8): eine Instanz liest sie
 * über ihre Vorlage (`resolveInstance`). Am Token steht sie nicht — eine
 * zweite Stelle dafür wäre die, an der der Oger auf der Karte noch medium
 * ist, nachdem jemand den Statblock korrigiert hat. Ohne Statblock `null`.
 */
export function statblockSize(entities: ReadonlyMap<EntityId, Entity>, statblock: Entity | null | undefined): string | null {
  if (!statblock) return null;
  const v = resolveInstance(entities, statblock).components?.Statblock?.size;
  return typeof v === 'string' && v ? v : null;
}

/** Darf sich ein Feld mit anderen teilen (D58: nur tiny). */
export function sharesSquare(size: unknown): boolean {
  return String(size ?? '').trim().toLowerCase() === 'tiny';
}

/** Die Felder eines Platzes, Anker oben links. */
export function footprint(anchor: Cell, span = 1): Cell[] {
  const out: Cell[] = [];
  for (let dy = 0; dy < span; dy++) for (let dx = 0; dx < span; dx++) out.push({ x: anchor.x + dx, y: anchor.y + dy });
  return out;
}

/**
 * Die Felder um einen Platz herum, `reach` Felder weit (Schachbrettmass),
 * ohne den Platz selbst — die Reichweite einer Kreatur geht vom ganzen
 * Platz aus, nicht von seiner Ecke (REQ-224).
 */
export function footprintRing(anchor: Cell, span = 1, reach = 1): Cell[] {
  const out: Cell[] = [];
  for (let y = anchor.y - reach; y < anchor.y + span + reach; y++) {
    for (let x = anchor.x - reach; x < anchor.x + span + reach; x++) {
      if (x >= anchor.x && x < anchor.x + span && y >= anchor.y && y < anchor.y + span) continue;
      out.push({ x, y });
    }
  }
  return out;
}

/**
 * **Was die gespeicherte Position meint** (D58): die **Mitte** des Platzes
 * in Feldeinheiten. Bei einem Feld ist das die Feldmitte wie bisher, bei
 * 2 × 2 eine Rasterecke. Gerechnet wird über den Anker; beides geht
 * eindeutig ineinander über, und ein Token, das von Hand neben das Raster
 * gezogen wurde, rastet auf den nächsten Anker ein.
 */
export function footprintCentre(anchor: Cell, span = 1): { x: number; y: number } {
  return { x: anchor.x + span / 2, y: anchor.y + span / 2 };
}

/**
 * Der Anker zu einer Mitte; mit `cols`/`rows` so geklemmt, dass der Platz
 * im Raster liegt. Gerundet wird `Mitte − span/2`: an den Stellen, an
 * denen ein Token richtig steht, ist das eine ganze Zahl, und ein
 * Rechenrest wie 2.9999 kippt nicht zum Nachbarn.
 */
export function anchorAt(centre: { x: number; y: number }, span = 1, cols?: number, rows?: number): Cell {
  const clamp = (v: number, n?: number) => (n === undefined ? v : Math.max(0, Math.min(n - span, v)));
  return {
    x: clamp(Math.round(centre.x - span / 2), cols),
    y: clamp(Math.round(centre.y - span / 2), rows),
  };
}

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
 * Das Gelände für einen Platz von `span` Feldern (REQ-224): ob ein Anker
 * passt, ob eine Wand einen Schritt hält, was er kostet und wie viele
 * gemiedene Felder er neu betritt. Ein Feld ist der Sonderfall `span` 1 —
 * dieselbe Rechnung, nicht eine zweite.
 */
function terrain(g: MoveGrid) {
  const { cols, rows } = g;
  const span = Math.max(1, Math.floor(g.span ?? 1));
  const blocked = asSet(g.blocked);
  const cost = g.cost ?? {};
  const wallCache = new Map<number, boolean>();
  const fitCache = new Map<number, boolean>();
  const n = cols * rows;
  /* Hält eine Wand den Schritt von Feld a nach Feld b (Mitte zu Mitte)? */
  const wallBetween = (ax: number, ay: number, bx: number, by: number): boolean => {
    const ca = ay * cols + ax, cb = by * cols + bx;
    const key = ca < cb ? ca * n + cb : cb * n + ca;
    let w = wallCache.get(key);
    if (w === undefined) {
      w = stepBlocked({ x: ax, y: ay }, { x: bx, y: by }, g.walls);
      wallCache.set(key, w);
    }
    return w;
  };
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x + span <= cols && y + span <= rows;
  /* Passt der ganze Platz? Kein Feld gesperrt oder unbetretbar, und keine
     Wand quer durch ihn — sonst stünde ein Oger mit einer Wand im Bauch. */
  const fits = (x: number, y: number): boolean => {
    if (!inside(x, y)) return false;
    const k = y * cols + x;
    let ok = fitCache.get(k);
    if (ok !== undefined) return ok;
    ok = true;
    for (let dy = 0; dy < span && ok; dy++) {
      for (let dx = 0; dx < span && ok; dx++) {
        const cx = x + dx, cy = y + dy, ck = `${cx},${cy}`;
        if (blocked.has(ck) || (cost[ck] ?? 1) === Infinity) ok = false;
        else if (dx + 1 < span && wallBetween(cx, cy, cx + 1, cy)) ok = false;
        else if (dy + 1 < span && wallBetween(cx, cy, cx, cy + 1)) ok = false;
      }
    }
    fitCache.set(k, ok);
    return ok;
  };
  /* Ein Schritt um (dx, dy): jedes Feld des Platzes geht denselben Schritt,
     und hält eine Wand einen davon, hält sie den Platz. */
  const stepWall = (x: number, y: number, dx: number, dy: number): boolean => {
    for (let oy = 0; oy < span; oy++) {
      for (let ox = 0; ox < span; ox++) {
        if (wallBetween(x + ox, y + oy, x + ox + dx, y + oy + dy)) return true;
      }
    }
    return false;
  };
  /* Die Felder, die der Schritt **neu** betritt: im neuen Platz, nicht im alten. */
  const entered = (x: number, y: number, dx: number, dy: number): string[] => {
    const out: string[] = [];
    const nx = x + dx, ny = y + dy;
    for (let oy = 0; oy < span; oy++) {
      for (let ox = 0; ox < span; ox++) {
        const cx = nx + ox, cy = ny + oy;
        if (cx >= x && cx < x + span && cy >= y && cy < y + span) continue;
        out.push(`${cx},${cy}`);
      }
    }
    return out;
  };
  /* D58: der Faktor des **teuersten** neu betretenen Feldes. Ein Schritt
     ist eine Bewegung eines Körpers — steht ein Fuss im Schlamm, ist der
     Schritt langsam, aber nicht viermal so langsam, weil der Körper vier
     Felder breit ist. Was der Platz schon belegt, betritt er nicht neu:
     aus dem Schlamm heraus kostet nichts extra, wie bei einem Feld. */
  const factor = (keys: readonly string[]): number => {
    let f = 1;
    for (const k of keys) {
      const c = cost[k] ?? 1;
      if (Number.isFinite(c) && c > f) f = c;
    }
    return f;
  };
  const touches = (x: number, y: number, set: ReadonlySet<string>): boolean => {
    if (!set.size) return false;
    for (let dy = 0; dy < span; dy++) for (let dx = 0; dx < span; dx++) if (set.has(`${x + dx},${y + dy}`)) return true;
    return false;
  };
  return { span, inside, fits, stepWall, entered, factor, touches };
}

/**
 * Dijkstra über (Anker, Parität). Rang: zuerst gemiedene Felder (wenn
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
  const avoid = opts.avoid ? asSet(g.avoid) : new Set<string>();
  const t = terrain(g);
  if (!t.inside(from.x, from.y)) return { pen, feet, prev };
  const start = (from.y * cols + from.x) * 2 + parity;
  pen[start] = 0;
  feet[start] = 0;
  const heap = new Heap();
  heap.push(0, 0, start);
  while (heap.size) {
    const [p, f, idx] = heap.pop()!;
    if (p !== pen[idx] || f !== feet[idx]) continue;
    const cell = idx >> 1, par = (idx & 1) as Parity;
    const x = cell % cols, y = (cell - x) / cols;
    if (opts.target && x === opts.target.x && y === opts.target.y) break;
    for (const [dx, dy] of NEIGHBOURS) {
      const nx = x + dx, ny = y + dy;
      if (!t.fits(nx, ny)) continue;
      if (t.stepWall(x, y, dx, dy)) continue;
      const neu = t.entered(x, y, dx, dy);
      const st = stepFeet(dx !== 0 && dy !== 0, par, t.factor(neu), square);
      const nf = f + st.feet;
      if (opts.budget !== undefined && nf > opts.budget + EPS) continue;
      let np = p;
      for (const k of neu) if (avoid.has(k)) np++;
      const ni = (ny * cols + nx) * 2 + st.parity;
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
 * was `grid.avoid` nennt — die Fuss zählt er trotzdem ehrlich. Mit `span`
 * sind `from`, `to` und die Felder des Weges Anker (REQ-224).
 */
export function cheapestPath(
  g: MoveGrid,
  from: Cell,
  to: Cell,
  parity: Parity = 0,
  opts: { avoid?: boolean } = {},
): PathResult | null {
  const { cols } = g;
  const t = terrain(g);
  if (!t.inside(to.x, to.y)) return null;
  if (from.x === to.x && from.y === to.y) return { cells: [{ ...from }], feet: 0, parity, avoided: 0 };
  if (!t.fits(to.x, to.y)) return null;
  if (!g.share && t.touches(to.x, to.y, asSet(g.noStop))) return null;
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
 * **Was ein gegebener Weg kostet** (T-349) — für den, der ihn nicht selbst
 * gesucht hat: der Server rechnet so den Weg eines Plans nach, statt die
 * Fuss zu glauben, die mitkommen. `null`, wenn der Weg nicht geht: ein
 * Sprung statt eines Schritts, ein Feld, das nicht passt, eine Wand, oder
 * das Ende auf einem Feld, auf dem man nicht stehen bleibt. Gemiedene
 * Felder zählt er mit, wie `cheapestPath`.
 */
export function pathFeet(g: MoveGrid, cells: readonly Cell[], parity: Parity = 0): PathResult | null {
  const t = terrain(g);
  const square = g.square ?? 5;
  const avoid = asSet(g.avoid);
  const [erster] = cells;
  if (!erster || !t.inside(erster.x, erster.y)) return null;
  let feet = 0, par = parity, avoided = 0;
  for (let i = 1; i < cells.length; i++) {
    const a = cells[i - 1]!, b = cells[i]!;
    const dx = b.x - a.x, dy = b.y - a.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== 1) return null;
    if (!t.fits(b.x, b.y) || t.stepWall(a.x, a.y, dx, dy)) return null;
    const neu = t.entered(a.x, a.y, dx, dy);
    const st = stepFeet(dx !== 0 && dy !== 0, par, t.factor(neu), square);
    feet += st.feet;
    par = st.parity;
    for (const k of neu) if (avoid.has(k)) avoided++;
  }
  const ende = cells[cells.length - 1]!;
  if (cells.length > 1 && !g.share && t.touches(ende.x, ende.y, asSet(g.noStop))) return null;
  return { cells: cells.map((c) => ({ ...c })), feet, parity: par, avoided };
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
 * Wie weit es reicht (Modus „grösste Reichweite“): je erreichbarem Anker,
 * was er mindestens kostet. Anker, auf denen man nicht stehen bleibt,
 * fehlen — man kommt durch, aber nicht an.
 */
export function reachable(
  g: MoveGrid,
  from: Cell,
  budget: number,
  parity: Parity = 0,
): Record<string, number> {
  const s = search(g, from, parity, { avoid: false, budget });
  const noStop = g.share ? new Set<string>() : asSet(g.noStop);
  const t = terrain(g);
  const out: Record<string, number> = {};
  for (let c = 0; c < g.cols * g.rows; c++) {
    const f = Math.min(s.feet[2 * c]!, s.feet[2 * c + 1]!);
    if (f === Infinity) continue;
    const x = c % g.cols, y = Math.floor(c / g.cols);
    if (f > 0 && t.touches(x, y, noStop)) continue;
    out[`${x},${y}`] = f;
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

/**
 * **Sperren auf der Karte** (T-118, docs/Karten.md › Sperren): Wand, Tür,
 * Geheimtür, Fenster, Abgrund, unsichtbare Wand — und was man durch sie
 * sieht (das Sichtpolygon).
 *
 * **Eine Liste, die Art an der Sperre** (`Map.walls`, je Eintrag `kind`):
 * wer eine Tür zur Wand macht, ändert ein Feld und nicht den Ort des
 * Eintrags. Was eine Art hält — Schritt, Blick, Licht —, steht als Daten in
 * `WALL_KINDS` und nicht in Abfragen, die je Art etwas anderes fragen
 * (Vorbild Foundry: jede Sperre hält Bewegung, Sicht und Licht je einzeln).
 * Ein Eintrag ohne `kind` ist eine Wand; ein unbekanntes Wort auch — eine
 * Sperre, die man nicht versteht, hält lieber zu viel als zu wenig.
 *
 * **Alles in Anteilen der Karte** wie Marker und Nebel (x von 0 bis 1 der
 * Breite, y von 0 bis 1 der Höhe). Gerechnet wird aber in einem Raum mit
 * gleichen Achsen (y mal `ar`, Höhe durch Breite) — sonst wäre ein Blick
 * schräg über eine breite Karte ein anderer als auf dem Bild.
 *
 * Kein Framework, kein DOM: die Seite zeichnet, das Modell rechnet.
 */

import type { Seg } from './movement.js';
import type { Pt } from './sight.js';
import type { Entity } from './types.js';

export type WallKind = 'wall' | 'door' | 'secret' | 'window' | 'chasm' | 'invisible';
/** Der Zustand einer Tür. Verschlossen ist zu, und Spielende bekommen sie nicht auf. */
export type DoorState = 'closed' | 'open' | 'locked';

/** Was eine Sperre hält. */
export interface WallBlocks {
  move: boolean;
  sight: boolean;
  light: boolean;
}

export interface WallKindDef {
  key: WallKind;
  label: string;
  /** Was die Art hält, solange sie zu ist (eine offene Tür hält nichts). */
  blocks: WallBlocks;
  /** Eine Tür lässt sich öffnen. */
  door: boolean;
  /** Was die Hilfe und der Tooltip sagen. */
  does: string;
}

/**
 * **Die Arten** (T-118). Fenster und Abgrund halten den Schritt und nicht
 * den Blick; die unsichtbare Wand dasselbe, aber gezeichnet wird sie nur
 * für die Leitung gestrichelt — am Tisch ist sie eine Grenze, die man
 * nicht sieht. Die Geheimtür ist für Spielende eine Wand, bis sie offen
 * ist (`redactWalls`).
 */
export const WALL_KINDS: readonly WallKindDef[] = [
  { key: 'wall', label: 'Wall', blocks: { move: true, sight: true, light: true }, door: false, does: 'Blocks movement, sight and light.' },
  { key: 'door', label: 'Door', blocks: { move: true, sight: true, light: true }, door: true, does: 'Like a wall while closed; open, it blocks nothing.' },
  {
    key: 'secret',
    label: 'Secret door',
    blocks: { move: true, sight: true, light: true },
    door: true,
    does: 'A door the players see as a wall until it is opened.',
  },
  { key: 'window', label: 'Window', blocks: { move: true, sight: false, light: false }, door: false, does: 'Blocks movement; sight and light pass.' },
  { key: 'chasm', label: 'Obstacle', blocks: { move: true, sight: false, light: false }, door: false, does: 'A chasm, a fence, rubble: blocks movement, not sight.' },
  {
    key: 'invisible',
    label: 'Invisible wall',
    blocks: { move: true, sight: false, light: false },
    door: false,
    does: 'Blocks movement and is not drawn for the players.',
  },
];

const ARTEN = new Map(WALL_KINDS.map((k) => [k.key, k]));

/** Eine Sperre, wie sie gelesen wird. */
export interface MapWall {
  id: string;
  kind: WallKind;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Nur an Türen (`door`, `secret`); sonst fehlt es. */
  state?: DoorState;
}

function zahl(v: unknown): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v.replace(',', '.')) : NaN;
  return Number.isFinite(n) ? n : NaN;
}

export function wallKind(kind: unknown): WallKindDef {
  return ARTEN.get(kind as WallKind) ?? ARTEN.get('wall')!;
}

/** Ist diese Sperre eine Tür (auch eine geheime)? */
export function isDoor(w: Pick<MapWall, 'kind'>): boolean {
  return wallKind(w.kind).door;
}

/** Was die Sperre jetzt hält: eine offene Tür nichts, sonst ihre Art. */
export function wallBlocks(w: Pick<MapWall, 'kind' | 'state'>): WallBlocks {
  if (isDoor(w) && w.state === 'open') return { move: false, sight: false, light: false };
  return wallKind(w.kind).blocks;
}

/** Ein Eintrag aus `Map.walls`; Unlesbares gibt `null`. */
function sperreAus(x: unknown, i: number): MapWall | null {
  if (!x || typeof x !== 'object') return null;
  const s = x as Record<string, unknown>;
  const [x1, y1, x2, y2] = [zahl(s['x1']), zahl(s['y1']), zahl(s['x2']), zahl(s['y2'])];
  if (![x1, y1, x2, y2].every(Number.isFinite)) return null;
  if (x1 === x2 && y1 === y2) return null;
  const art = wallKind(s['kind']);
  const w: MapWall = { id: typeof s['id'] === 'string' && s['id'] ? s['id'] : `w-${i + 1}`, kind: art.key, x1, y1, x2, y2 };
  if (art.door) {
    /* Der Prototyp schrieb `open: true`; gelesen wird beides. */
    const st = s['state'];
    w.state = st === 'open' || st === 'locked' ? st : st === 'closed' ? 'closed' : s['open'] === true ? 'open' : 'closed';
  }
  return w;
}

function rohWalls(e: Entity): unknown[] {
  const roh = (e.components?.['Map'] as { walls?: unknown } | undefined)?.walls;
  return Array.isArray(roh) ? roh : [];
}

/** Die Sperren der Karte (`Map.walls`); Unlesbares fällt weg. */
export function mapWalls(e: Entity): MapWall[] {
  return rohWalls(e).flatMap((x, i) => sperreAus(x, i) ?? []);
}

const r4 = (v: number): number => Math.round(v * 10000) / 10000;

/** Eine Sperre, wie sie gespeichert wird: gerundet, `state` nur an Türen. */
function roh(w: MapWall): Record<string, unknown> {
  const out: Record<string, unknown> = { id: w.id, kind: w.kind, x1: r4(w.x1), y1: r4(w.y1), x2: r4(w.x2), y2: r4(w.y2) };
  if (isDoor(w)) out['state'] = w.state ?? 'closed';
  return out;
}

function mitWalls(e: Entity, walls: unknown[]): Entity {
  const karte = { ...((e.components?.['Map'] ?? {}) as Record<string, unknown>), walls };
  return { ...e, components: { ...e.components, Map: karte } };
}

/** Sperren dazu — ein gezogener Linienzug sind mehrere. Strecken ohne Länge fallen weg. */
export function addWalls(e: Entity, walls: readonly MapWall[]): Entity {
  const neu = walls.filter((w) => w.x1 !== w.x2 || w.y1 !== w.y2).map(roh);
  return neu.length ? mitWalls(e, [...rohWalls(e), ...neu]) : e;
}

/** Eine Sperre weg. */
export function removeWall(e: Entity, id: string): Entity {
  return mitWalls(
    e,
    rohWalls(e).filter((x, i) => sperreAus(x, i)?.id !== id),
  );
}

/** Eine Sperre ändern (Art oder Türzustand); was nicht gilt, fällt weg (`state` an einer Wand). */
function aendern(e: Entity, id: string, f: (w: MapWall) => MapWall): Entity {
  let gefunden = false;
  const walls = rohWalls(e).map((x, i) => {
    const w = sperreAus(x, i);
    if (!w || w.id !== id) return x;
    gefunden = true;
    return roh(f(w));
  });
  return gefunden ? mitWalls(e, walls) : e;
}

/** Die Art einer Sperre wechseln. Eine neue Tür ist zu. */
export function setWallKind(e: Entity, id: string, kind: WallKind): Entity {
  return aendern(e, id, (w) => {
    const { state, ...rest } = w;
    return wallKind(kind).door ? { ...rest, kind, state: state ?? 'closed' } : { ...rest, kind };
  });
}

/** Eine Tür öffnen, schliessen oder verschliessen. An einer Wand tut es nichts. */
export function setDoorState(e: Entity, id: string, state: DoorState): Entity {
  return aendern(e, id, (w) => (isDoor(w) ? { ...w, state } : w));
}

/** Die Mitte einer Sperre — dort steht ihr Türsymbol, danach fragt der Nebel. */
export function wallMid(w: Pick<MapWall, 'x1' | 'y1' | 'x2' | 'y2'>): Pt {
  return { x: (w.x1 + w.x2) / 2, y: (w.y1 + w.y2) / 2 };
}

/**
 * Die Strecken, die `was` halten, im Raum mit gleichen Achsen (y mal `ar`).
 * Das ist die Eingabe für `visionPolygon` und `lineOfSight`.
 */
export function wallSegs(walls: readonly MapWall[], was: keyof WallBlocks, ar: number): Seg[] {
  return walls.filter((w) => wallBlocks(w)[was]).map((w) => ({ x1: w.x1, y1: w.y1 * ar, x2: w.x2, y2: w.y2 * ar }));
}

/** Hält auf dieser Karte irgendetwas den Blick? Ohne das deckt ein Zug weiter mit dem Pinsel auf. */
export function hasSightWalls(e: Entity): boolean {
  return mapWalls(e).some((w) => wallKind(w.kind).blocks.sight);
}

/** Abstand eines Punktes zu einer Strecke. */
export function segDistance(p: Pt, s: Seg): number {
  const dx = s.x2 - s.x1;
  const dy = s.y2 - s.y1;
  const l = dx * dx + dy * dy;
  const t = l ? Math.min(1, Math.max(0, ((p.x - s.x1) * dx + (p.y - s.y1) * dy) / l)) : 0;
  return Math.hypot(p.x - (s.x1 + t * dx), p.y - (s.y1 + t * dy));
}

/**
 * Die Sperre am nächsten bei `p` (Anteile), wenn sie näher als `max` liegt
 * (in Anteilen der Breite) — für das Antippen einer Tür oder Wand.
 */
export function nearestWall(walls: readonly MapWall[], p: Pt, ar: number, max: number, nur?: (w: MapWall) => boolean): MapWall | null {
  let best: MapWall | null = null;
  let d = max;
  for (const w of walls) {
    if (nur && !nur(w)) continue;
    const x = segDistance({ x: p.x, y: p.y * ar }, { x1: w.x1, y1: w.y1 * ar, x2: w.x2, y2: w.y2 * ar });
    if (x <= d) {
      d = x;
      best = w;
    }
  }
  return best;
}

/**
 * **An das Gitter einrasten** (T-118): auf die nächste Ecke eines Feldes,
 * wenn sie näher liegt als ein Viertelfeld — sonst bleibt der Punkt. Wände
 * stehen auf den Linien des Gitters, nicht in den Feldern.
 */
export function snapToGrid(p: Pt, geo: { size: number; ox: number; oy: number; w: number; h: number } | null): Pt {
  if (!geo || geo.w <= 0 || geo.h <= 0) return p;
  const px = p.x * geo.w;
  const py = p.y * geo.h;
  const gx = geo.ox + Math.round((px - geo.ox) / geo.size) * geo.size;
  const gy = geo.oy + Math.round((py - geo.oy) / geo.size) * geo.size;
  if (Math.hypot(gx - px, gy - py) > geo.size / 4) return p;
  return { x: Math.min(1, Math.max(0, gx / geo.w)), y: Math.min(1, Math.max(0, gy / geo.h)) };
}

// ------------------------------------------------------------ Sichtpolygon

/** Wie weit ein Strahl ab `o` in Richtung `d` reicht, bis er eine der Strecken trifft. */
function strahl(ox: number, oy: number, dx: number, dy: number, segs: readonly Seg[], max: number): number {
  let t = max;
  for (const s of segs) {
    const sx = s.x2 - s.x1;
    const sy = s.y2 - s.y1;
    const den = dx * sy - dy * sx;
    if (Math.abs(den) < 1e-12) continue;
    const qx = s.x1 - ox;
    const qy = s.y1 - oy;
    const tt = (qx * sy - qy * sx) / den;
    const u = (qx * dy - qy * dx) / den;
    if (tt >= 0 && u >= -1e-9 && u <= 1 + 1e-9 && tt < t) t = tt;
  }
  return t;
}

/** Fast auf einer Geraden mit den Nachbarn: fällt weg — ein Polygon an einer Wand entlang ist sonst hundert Punkte. */
function ausduennen(pts: Array<[number, number]>): Array<[number, number]> {
  if (pts.length <= 3) return pts;
  const out: Array<[number, number]> = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = out.length ? out[out.length - 1]! : pts[(i - 1 + n) % n]!;
    const b = pts[i]!;
    const c = pts[(i + 1) % n]!;
    const kreuz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const lang = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1;
    if (Math.abs(kreuz) / lang > 1e-5) out.push(b);
  }
  return out.length >= 3 ? out : pts;
}

/**
 * **Das Sichtpolygon** (T-118): was man von `o` aus sieht, bis die nächste
 * Strecke den Blick hält, im Kasten `0…w × 0…h` (Raum mit gleichen Achsen,
 * also `h = ar` bei `w = 1`), höchstens `radius` weit.
 *
 * Gerechnet mit Strahlen: je Ecke einer Strecke drei (knapp davor, genau,
 * knapp dahinter — so findet der Blick an einer Ecke vorbei die Wand
 * dahinter), dazu gleichmässig verteilte für den Rand des Kreises. Das ist
 * nicht die schnellste Rechnung, aber eine, die man nachprüfen kann; mit
 * hundert Wänden sind es einige zehntausend Schnitte.
 */
export function visionPolygon(
  o: Pt,
  segs: readonly Seg[],
  box: { w: number; h: number },
  radius = Number.POSITIVE_INFINITY,
): Array<[number, number]> {
  const ox = Math.min(box.w, Math.max(0, o.x));
  const oy = Math.min(box.h, Math.max(0, o.y));
  const rand: Seg[] = [
    { x1: 0, y1: 0, x2: box.w, y2: 0 },
    { x1: box.w, y1: 0, x2: box.w, y2: box.h },
    { x1: box.w, y1: box.h, x2: 0, y2: box.h },
    { x1: 0, y1: box.h, x2: 0, y2: 0 },
  ];
  const r = Number.isFinite(radius) && radius > 0 ? radius : Number.POSITIVE_INFINITY;
  const nah = segs.filter((s) => !Number.isFinite(r) || segDistance({ x: ox, y: oy }, s) <= r);
  const alle = [...nah, ...rand];
  const winkel: number[] = [];
  const EPS = 1e-4;
  for (const s of alle) {
    for (const [x, y] of [
      [s.x1, s.y1],
      [s.x2, s.y2],
    ] as const) {
      const a = Math.atan2(y - oy, x - ox);
      winkel.push(a - EPS, a, a + EPS);
    }
  }
  if (Number.isFinite(r)) for (let k = 0; k < 64; k++) winkel.push(-Math.PI + (k * 2 * Math.PI) / 64);
  const sortiert = [...new Set(winkel.map((a) => (a <= -Math.PI ? a + 2 * Math.PI : a > Math.PI ? a - 2 * Math.PI : a)))].sort((a, b) => a - b);
  const pts: Array<[number, number]> = [];
  for (const a of sortiert) {
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const t = strahl(ox, oy, dx, dy, alle, Number.isFinite(r) ? r : 1e9);
    pts.push([ox + dx * t, oy + dy * t]);
  }
  return ausduennen(pts);
}

/**
 * Das Sichtpolygon in **Anteilen der Karte** (y zurück durch `ar`), fertig
 * für `Map.reveal` als Form `poly`. `radius` in Anteilen der Breite.
 */
export function sightPolygon(walls: readonly MapWall[], from: Pt, ar: number, radius?: number): Array<[number, number]> {
  const a = ar > 0 ? ar : 1;
  return visionPolygon({ x: from.x, y: from.y * a }, wallSegs(walls, 'sight', a), { w: 1, h: a }, radius).map(
    ([x, y]) => [r4(x), r4(y / a)] as [number, number],
  );
}

/** Ist die Strecke a–b (Anteile) frei von dem, was `was` hält? */
export function wallsClear(walls: readonly MapWall[], a: Pt, b: Pt, ar: number, was: keyof WallBlocks = 'sight'): boolean {
  const segs = wallSegs(walls, was, ar);
  const ax = a.x;
  const ay = a.y * ar;
  const bx = b.x;
  const by = b.y * ar;
  for (const s of segs) {
    const rx = bx - ax;
    const ry = by - ay;
    const sx = s.x2 - s.x1;
    const sy = s.y2 - s.y1;
    const den = rx * sy - ry * sx;
    if (Math.abs(den) < 1e-12) continue;
    const qx = s.x1 - ax;
    const qy = s.y1 - ay;
    const t = (qx * sy - qy * sx) / den;
    const u = (qx * ry - qy * rx) / den;
    /* Das Ende einer Sperre hält mit (u 0 oder 1): zwei Strecken eines
       Linienzugs stossen an einem Punkt zusammen, und ein schräger Schritt
       über eine Gitterecke ginge sonst genau dort hindurch. Anfang und Ende
       des Weges selbst zählen nicht — ein Token, das an der Wand steht,
       sieht trotzdem von ihr weg. */
    if (t > 1e-9 && t < 1 - 1e-9 && u >= -1e-9 && u <= 1 + 1e-9) return false;
  }
  return true;
}

/**
 * **Was Spielende von den Sperren bekommen** (T-118; zurückgehalten wird am
 * Server): die Sperren am Rand dessen, was sie sehen — Anfang, Mitte oder
 * Ende im Aufgedeckten. Was im Verdeckten liegt, fällt weg: eine Wand dort
 * zeichnete den Grundriss eines Raums, den noch niemand betreten hat. Die
 * übrigen braucht ihr Zugplan, damit ein Weg nicht durch eine Mauer führt.
 *
 * Eine geschlossene Geheimtür ist für sie eine **Wand**, eine offene eine
 * gewöhnliche Tür; verschlossen heisst für sie zu — dass sie klemmt, merken
 * sie beim Versuch. Gezeichnet werden für Spielende ohnehin nur die Türen
 * (an ihnen klicken sie); die Wände sind der Grund, warum es dahinter dunkel
 * ist, und sonst nichts.
 */
export function redactWalls(e: Entity, zu: (p: Pt) => boolean): Entity {
  const karte = e.components?.['Map'] as Record<string, unknown> | undefined;
  if (!karte || !Array.isArray(karte['walls'])) return e;
  const bleibt = mapWalls(e).flatMap((w): Array<Record<string, unknown>> => {
    if (zu({ x: w.x1, y: w.y1 }) && zu(wallMid(w)) && zu({ x: w.x2, y: w.y2 })) return [];
    if (w.kind === 'secret' && w.state !== 'open') {
      const { state: _s, ...rest } = w;
      return [roh({ ...rest, kind: 'wall' })];
    }
    if (isDoor(w)) return [{ ...roh({ ...w, kind: 'door' }), state: w.state === 'open' ? 'open' : 'closed' }];
    return [roh(w)];
  });
  return { ...e, components: { ...e.components, Map: { ...karte, walls: bleibt } } };
}

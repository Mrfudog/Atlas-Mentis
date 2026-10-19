/**
 * **Der Karteneditor** (T-304, REQ-130, REQ-133, docs/Karten.md › Zeichnen):
 * Formen aus Sperren, Türen als Viereck, Einrasten mit Stärke, Schneiden
 * und das Gitter, auf der Karte gesetzt.
 *
 * **Eine Form ist eine Folge von Sperren und sonst nichts.** Ein Rechteck,
 * ein Kreis, ein Polygon werden beim Fertigstellen zu Strecken in
 * `Map.walls` — Sicht, Licht und Schritt (`lineOfSight`, `lightPolygon`,
 * `planGrid`) lesen dieselbe Liste wie bisher und müssen von Formen nichts
 * wissen. Eine Form als eigener Eintrag wäre eine zweite Sorte Sperre, die
 * jede Rechnung zweimal fragen müsste.
 *
 * Alles in Anteilen der Karte wie in `walls.ts`; Abstände werden im Raum mit
 * gleichen Achsen gerechnet (y mal `ar`), sonst wäre ein Fangradius auf
 * einer breiten Karte waagrecht ein anderer als senkrecht.
 *
 * Kein Framework, kein DOM: die Seite zeichnet, das Modell rechnet.
 */

import type { MapSettings, Size } from "./map.js";
import type { Pt } from "./sight.js";
import type { Entity } from "./types.js";
import {
  isDoor,
  mapWalls,
  setWalls,
  wallKind,
  type MapWall,
  type WallKind,
} from "./walls.js";

// ------------------------------------------------------------------ Formen

export type DrawShape = "line" | "polyline" | "polygon" | "rect" | "ellipse";

export interface DrawShapeDef {
  key: DrawShape;
  label: string;
  /** Wie viele Punkte die Form fertig machen; `null`: so viele, wie man tippt. */
  points: 2 | null;
  /** `toggle`: der Schalter „Closed“ entscheidet; sonst steht es fest. */
  closed: "always" | "never" | "toggle";
  does: string;
}

/**
 * **Die Formen** (T-304). Linie und Rechteck und Ellipse sind nach zwei
 * Punkten fertig; Linienzug und Polygon nach „Finish“. Der Linienzug
 * schliesst, wenn der Schalter es sagt — das Polygon immer, darum steht es
 * als eigene Form da: wer einen Raum umfährt, soll nicht erst schalten.
 */
export const DRAW_SHAPES: readonly DrawShapeDef[] = [
  {
    key: "polyline",
    label: "Polyline",
    points: null,
    closed: "toggle",
    does: "Point after point; Closed joins the last point to the first.",
  },
  {
    key: "line",
    label: "Line",
    points: 2,
    closed: "never",
    does: "One straight line between two points.",
  },
  {
    key: "rect",
    label: "Rectangle",
    points: 2,
    closed: "always",
    does: "Two opposite corners; always closed.",
  },
  {
    key: "ellipse",
    label: "Ellipse",
    points: 2,
    closed: "always",
    does: "Two corners of the box around it; stored as a closed polygon.",
  },
  {
    key: "polygon",
    label: "Polygon",
    points: null,
    closed: "always",
    does: "Point after point; Finish always closes it.",
  },
];

const FORMEN = new Map(DRAW_SHAPES.map((f) => [f.key, f]));

export function drawShape(key: unknown): DrawShapeDef {
  return FORMEN.get(key as DrawShape) ?? FORMEN.get("polyline")!;
}

/** Ob die Form geschlossen wird — fest an der Form oder nach dem Schalter. */
export function shapeClosed(shape: DrawShape, toggle: boolean): boolean {
  const f = drawShape(shape);
  return f.closed === "always" || (f.closed === "toggle" && toggle);
}

/** Wie viele Ecken eine Ellipse bekommt: genug für einen runden Raum, wenig genug für das Sichtpolygon. */
export const ELLIPSE_STEPS = 24;

/**
 * **Die Umrisspunkte einer Form** aus den getippten Punkten. Ein Rechteck
 * steht achsparallel auf der Karte; eine Ellipse ist ein Polygon mit
 * `ELLIPSE_STEPS` Ecken in ihrem Kasten. Zu wenig Punkte geben eine leere
 * Liste.
 */
export function shapeOutline(
  shape: DrawShape,
  pts: readonly Pt[],
  closedToggle = false,
): { pts: Pt[]; closed: boolean } {
  const closed = shapeClosed(shape, closedToggle);
  if (shape === "line")
    return { pts: pts.length >= 2 ? [pts[0]!, pts[1]!] : [], closed: false };
  if (shape === "rect" || shape === "ellipse") {
    if (pts.length < 2) return { pts: [], closed };
    const [a, b] = [pts[0]!, pts[1]!];
    const [x0, x1] = [Math.min(a.x, b.x), Math.max(a.x, b.x)];
    const [y0, y1] = [Math.min(a.y, b.y), Math.max(a.y, b.y)];
    if (x1 - x0 <= 0 || y1 - y0 <= 0) return { pts: [], closed };
    if (shape === "rect")
      return {
        pts: [
          { x: x0, y: y0 },
          { x: x1, y: y0 },
          { x: x1, y: y1 },
          { x: x0, y: y1 },
        ],
        closed,
      };
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const out: Pt[] = [];
    for (let k = 0; k < ELLIPSE_STEPS; k++) {
      const t = (k * 2 * Math.PI) / ELLIPSE_STEPS;
      out.push({
        x: cx + ((x1 - x0) / 2) * Math.cos(t),
        y: cy + ((y1 - y0) / 2) * Math.sin(t),
      });
    }
    return { pts: out, closed };
  }
  return {
    pts: pts.length >= 2 ? [...pts] : [],
    closed: closed && pts.length >= 3,
  };
}

/**
 * **Aus dem Umriss die Sperren:** je Strecke eine der gewählten Art,
 * geschlossen auch die letzte zurück zum ersten Punkt. Strecken ohne Länge
 * fallen weg. Eine Tür bekommt `state: 'closed'` und ihre Dicke.
 */
export function outlineWalls(
  outline: { pts: readonly Pt[]; closed: boolean },
  kind: WallKind,
  newId: () => string,
  doorWidth?: number,
): MapWall[] {
  const p = outline.pts;
  if (p.length < 2) return [];
  const paare: Array<[Pt, Pt]> = p.slice(1).map((b, i) => [p[i]!, b]);
  if (outline.closed && p.length >= 3) paare.push([p[p.length - 1]!, p[0]!]);
  const tuer = wallKind(kind).door;
  return paare
    .filter(([a, b]) => a.x !== b.x || a.y !== b.y)
    .map(([a, b]) => ({
      id: newId(),
      kind,
      x1: a.x,
      y1: a.y,
      x2: b.x,
      y2: b.y,
      ...(tuer
        ? {
            state: "closed" as const,
            ...(doorWidth && doorWidth > 0 ? { width: doorWidth } : {}),
          }
        : {}),
    }));
}

// ------------------------------------------------------------ Türviereck

/**
 * **Das Viereck einer Tür** (T-304): die Mittellinie, nach beiden Seiten um
 * die halbe Dicke verbreitert — in Anteilen der Karte, fertig zum Zeichnen.
 * Geklickt wird das Viereck, gerechnet die Linie.
 */
export function doorRect(
  w: Pick<MapWall, "x1" | "y1" | "x2" | "y2" | "width">,
  ar: number,
  fallback: number,
): Pt[] {
  const a = ar > 0 ? ar : 1;
  const dx = w.x2 - w.x1;
  const dy = (w.y2 - w.y1) * a;
  const l = Math.hypot(dx, dy) || 1;
  const h = (w.width && w.width > 0 ? w.width : fallback) / 2;
  /* Die Senkrechte im Raum mit gleichen Achsen, zurück in Anteile. */
  const nx = (-dy / l) * h;
  const ny = ((dx / l) * h) / a;
  return [
    { x: w.x1 + nx, y: w.y1 + ny },
    { x: w.x2 + nx, y: w.y2 + ny },
    { x: w.x2 - nx, y: w.y2 - ny },
    { x: w.x1 - nx, y: w.y1 - ny },
  ];
}

// ------------------------------------------------------------- Einrasten

/** Woran ein Punkt einrastet. */
export interface SnapTargets {
  /** Das Gitter in Bildpunkten (wie `gridGeometry`); nur Quadrate haben Ecken, an denen Wände stehen. */
  grid?: {
    shape: "square" | "hex";
    size: number;
    ox: number;
    oy: number;
    w: number;
    h: number;
  } | null;
  /** Vorhandene Punkte (Enden von Sperren, Punkte des Entwurfs). */
  points?: readonly Pt[];
  /** Vorhandene Sperren: ein Punkt rastet auf ihre Linie. */
  walls?: readonly MapWall[];
}

export interface Snapped {
  pt: Pt;
  /** Woran er eingerastet ist; `null`: er blieb, wo er war. */
  to: "point" | "grid" | "line" | null;
}

const abstand = (a: Pt, b: Pt, ar: number): number =>
  Math.hypot(a.x - b.x, (a.y - b.y) * ar);

/**
 * **Einrasten mit Stärke** (T-304): `radius` ist der Fangradius in Anteilen
 * der Kartenbreite — die Seite rechnet ihn aus Bildschirmpunkten, damit die
 * Stärke beim Zoomen dieselbe bleibt. Ein vorhandener Punkt geht vor einer
 * Gitterecke, die Ecke vor einer Linie: wer an eine Ecke einer Wand
 * anschliesst, will genau diese Ecke, und eine Gitterecke ist genauer als
 * irgendeine Stelle auf einer Linie. Radius 0 heisst: kein Einrasten.
 */
export function snapPoint(
  p: Pt,
  t: SnapTargets,
  radius: number,
  ar: number,
): Snapped {
  const a = ar > 0 ? ar : 1;
  if (!(radius > 0)) return { pt: p, to: null };
  let best: Pt | null = null;
  let d = radius;
  for (const q of t.points ?? []) {
    const x = abstand(p, q, a);
    if (x <= d) {
      d = x;
      best = q;
    }
  }
  if (best) return { pt: { x: best.x, y: best.y }, to: "point" };
  const g = t.grid;
  if (g && g.shape === "square" && g.w > 0 && g.h > 0 && g.size > 0) {
    const px = p.x * g.w;
    const py = p.y * g.h;
    const gx = g.ox + Math.round((px - g.ox) / g.size) * g.size;
    const gy = g.oy + Math.round((py - g.oy) / g.size) * g.size;
    const q = {
      x: Math.min(1, Math.max(0, gx / g.w)),
      y: Math.min(1, Math.max(0, gy / g.h)),
    };
    if (abstand(p, q, a) <= radius) return { pt: q, to: "grid" };
  }
  let linie: Pt | null = null;
  d = radius;
  for (const w of t.walls ?? []) {
    const q = aufLinie(p, w, a);
    const x = abstand(p, q, a);
    if (x <= d) {
      d = x;
      linie = q;
    }
  }
  return linie ? { pt: linie, to: "line" } : { pt: p, to: null };
}

/** Der Fusspunkt von `p` auf der Strecke `w` (Anteile). */
function aufLinie(
  p: Pt,
  w: Pick<MapWall, "x1" | "y1" | "x2" | "y2">,
  ar: number,
): Pt {
  const t = param(p, w, ar);
  const u = Math.min(1, Math.max(0, t));
  return { x: w.x1 + u * (w.x2 - w.x1), y: w.y1 + u * (w.y2 - w.y1) };
}

/** Wo `p` auf der Geraden durch `w` liegt: 0 am Anfang, 1 am Ende. */
function param(
  p: Pt,
  w: Pick<MapWall, "x1" | "y1" | "x2" | "y2">,
  ar: number,
): number {
  const dx = w.x2 - w.x1;
  const dy = (w.y2 - w.y1) * ar;
  const l = dx * dx + dy * dy;
  return l ? ((p.x - w.x1) * dx + (p.y - w.y1) * ar * dy) / l : 0;
}

// ------------------------------------------------------------------ Punkte

/** Die Enden aller Sperren, je Stelle einmal — die Punkte, die der Editor zeigt und ziehen lässt. */
export function wallPoints(
  walls: readonly MapWall[],
  ar: number,
  tol = 1e-6,
): Pt[] {
  const out: Pt[] = [];
  for (const w of walls) {
    for (const q of [
      { x: w.x1, y: w.y1 },
      { x: w.x2, y: w.y2 },
    ]) {
      if (!out.some((o) => abstand(o, q, ar) <= tol)) out.push(q);
    }
  }
  return out;
}

/** Der Punkt am nächsten bei `p`, wenn er näher als `max` liegt (Anteile der Breite). */
export function nearestPoint(
  points: readonly Pt[],
  p: Pt,
  ar: number,
  max: number,
): Pt | null {
  let best: Pt | null = null;
  let d = max;
  for (const q of points) {
    const x = abstand(p, q, ar);
    if (x <= d) {
      d = x;
      best = q;
    }
  }
  return best;
}

/**
 * **Einen Punkt verschieben** (T-304): jedes Ende, das an `from` liegt,
 * wandert nach `to` — zwei Wände, die sich an einer Ecke treffen, bleiben
 * verbunden. Wird eine Sperre dabei zum Punkt, fällt sie weg.
 */
export function moveWallPoint(
  e: Entity,
  from: Pt,
  to: Pt,
  ar: number,
  tol = 1e-6,
): Entity {
  const walls = mapWalls(e);
  let bewegt = false;
  const neu = walls.map((w) => {
    const n = { ...w };
    if (abstand({ x: w.x1, y: w.y1 }, from, ar) <= tol) {
      n.x1 = to.x;
      n.y1 = to.y;
      bewegt = true;
    }
    if (abstand({ x: w.x2, y: w.y2 }, from, ar) <= tol) {
      n.x2 = to.x;
      n.y2 = to.y;
      bewegt = true;
    }
    return n;
  });
  return bewegt ? setWalls(e, neu) : e;
}

// --------------------------------------------------------------- Schneiden

/** Welche Arten eine Wand darunter schneiden: was eine Öffnung ist — Türen und Fenster. */
export function cutsWalls(kind: WallKind): boolean {
  return wallKind(kind).door || kind === "window";
}

/** Was geschnitten wird: alles, was keine Öffnung ist. Eine Tür in einer Tür schneidet nicht. */
function wirdGeschnitten(w: MapWall): boolean {
  return !cutsWalls(w.kind);
}

/** Liegt `c` auf der Geraden von `w` (beide Enden näher als `tol`)? */
function aufGerader(
  c: Pick<MapWall, "x1" | "y1" | "x2" | "y2">,
  w: MapWall,
  ar: number,
  tol: number,
): boolean {
  /* Die Gerade, nicht nur die Strecke: eine Tür, die über das Ende einer Wand hinausragt, schneidet sie trotzdem. */
  const auf = (p: Pt): boolean => {
    const t = param(p, w, ar);
    const q = { x: w.x1 + t * (w.x2 - w.x1), y: w.y1 + t * (w.y2 - w.y1) };
    return abstand(p, q, ar) <= tol;
  };
  return auf({ x: c.x1, y: c.y1 }) && auf({ x: c.x2, y: c.y2 });
}

/**
 * **Schneiden** (T-304): eine Tür oder ein Fenster über einer Wand teilt die
 * Wand und lässt sie an den Rändern der Öffnung enden. Getroffen ist eine
 * Wand, auf deren Gerade beide Enden der Öffnung liegen (näher als `tol`,
 * Anteile der Breite) und die sich mit ihr überlappt. Die Teile enden
 * **genau** an den Enden der Öffnung — so findet `joinAround` sie wieder.
 * Das erste Teil behält die Id der Wand, ein zweites bekommt eine neue.
 */
export function cutWalls(
  walls: readonly MapWall[],
  cutter: Pick<MapWall, "id" | "kind" | "x1" | "y1" | "x2" | "y2">,
  ar: number,
  tol: number,
  newId: () => string,
): { walls: MapWall[]; cut: number } {
  const a = ar > 0 ? ar : 1;
  const EPS = 1e-6;
  let cut = 0;
  const out: MapWall[] = [];
  for (const w of walls) {
    if (
      w.id === cutter.id ||
      !wirdGeschnitten(w) ||
      !aufGerader(cutter, w, a, tol)
    ) {
      out.push(w);
      continue;
    }
    let t0 = param({ x: cutter.x1, y: cutter.y1 }, w, a);
    let t1 = param({ x: cutter.x2, y: cutter.y2 }, w, a);
    let p0: Pt = { x: cutter.x1, y: cutter.y1 };
    let p1: Pt = { x: cutter.x2, y: cutter.y2 };
    if (t0 > t1) {
      [t0, t1] = [t1, t0];
      [p0, p1] = [p1, p0];
    }
    if (t1 <= EPS || t0 >= 1 - EPS) {
      out.push(w);
      continue;
    }
    cut++;
    const laenge = Math.hypot(w.x2 - w.x1, (w.y2 - w.y1) * a);
    const teile: MapWall[] = [];
    if (t0 * laenge > tol) teile.push({ ...w, x2: p0.x, y2: p0.y });
    if ((1 - t1) * laenge > tol)
      teile.push({
        ...w,
        id: teile.length ? newId() : w.id,
        x1: p1.x,
        y1: p1.y,
      });
    out.push(...teile);
  }
  return { walls: out, cut };
}

/**
 * **Wieder zusammenfügen** (T-304), wenn die Tür geht: die Wände, die an
 * ihren Enden anstossen und auf ihrer Geraden liegen, werden eine — oder
 * die eine, die es gibt, reicht wieder über die Öffnung. Angeboten wird
 * das, nicht still getan: vielleicht war die Öffnung gewollt.
 * Die Tür selbst nimmt `joinAround` nicht weg.
 */
export function joinAround(
  walls: readonly MapWall[],
  door: Pick<MapWall, "id" | "x1" | "y1" | "x2" | "y2">,
  ar: number,
  tol: number,
): { walls: MapWall[]; joined: boolean } {
  const a = ar > 0 ? ar : 1;
  const A: Pt = { x: door.x1, y: door.y1 };
  const B: Pt = { x: door.x2, y: door.y2 };
  /** Eine Wand, die mit einem Ende an `p` stösst und auf der Geraden der Tür liegt; dazu ihr anderes Ende. */
  const anstoss = (p: Pt, ohne?: string): { w: MapWall; fern: Pt } | null => {
    for (const w of walls) {
      if (w.id === door.id || w.id === ohne || !wirdGeschnitten(w)) continue;
      const e1 = { x: w.x1, y: w.y1 };
      const e2 = { x: w.x2, y: w.y2 };
      const fern =
        abstand(e1, p, a) <= tol ? e2 : abstand(e2, p, a) <= tol ? e1 : null;
      if (!fern || !aufGerader(door, w, a, tol)) continue;
      return { w, fern };
    }
    return null;
  };
  const wa = anstoss(A);
  const wb = anstoss(B, wa?.w.id);
  if (!wa && !wb) return { walls: [...walls], joined: false };
  if (wa && wb && wa.w.kind === wb.w.kind) {
    const eins: MapWall = {
      ...wa.w,
      x1: wa.fern.x,
      y1: wa.fern.y,
      x2: wb.fern.x,
      y2: wb.fern.y,
    };
    return {
      walls: walls.flatMap((w) =>
        w.id === wa.w.id ? [eins] : w.id === wb.w.id ? [] : [w],
      ),
      joined: true,
    };
  }
  const ein = wa ?? wb!;
  const ziel = ein === wa ? B : A;
  const laenger: MapWall = {
    ...ein.w,
    x1: ein.fern.x,
    y1: ein.fern.y,
    x2: ziel.x,
    y2: ziel.y,
  };
  return {
    walls: walls.map((w) => (w.id === ein.w.id ? laenger : w)),
    joined: true,
  };
}

/** Sperren dazu und, wenn `cut`, mit jeder neuen Öffnung die Wände darunter schneiden. */
export function addWallsCut(
  e: Entity,
  neu: readonly MapWall[],
  opts: { cut: boolean; ar: number; tol: number; newId: () => string },
): { entity: Entity; cut: number } {
  let walls = mapWalls(e);
  let cut = 0;
  for (const w of neu) {
    if (opts.cut && cutsWalls(w.kind)) {
      const r = cutWalls(walls, w, opts.ar, opts.tol, opts.newId);
      walls = r.walls;
      cut += r.cut;
    }
    walls.push(w);
  }
  return { entity: setWalls(e, walls), cut };
}

/** Kann das Wegnehmen dieser Sperre eine Wand wieder zusammenfügen? (Dann fragt die Seite.) */
export function canJoinAround(
  e: Entity,
  id: string,
  ar: number,
  tol: number,
): boolean {
  const walls = mapWalls(e);
  const d = walls.find((w) => w.id === id);
  if (!d || !(isDoor(d) || d.kind === "window")) return false;
  return joinAround(walls, d, ar, tol).joined;
}

/** Eine Öffnung wegnehmen und die Wand darum wieder zusammenfügen. */
export function removeJoined(
  e: Entity,
  id: string,
  ar: number,
  tol: number,
): Entity {
  const walls = mapWalls(e);
  const d = walls.find((w) => w.id === id);
  if (!d) return e;
  const r = joinAround(walls, d, ar, tol);
  return setWalls(
    e,
    r.walls.filter((w) => w.id !== id),
  );
}

// ------------------------------------------------------------------ Gitter

export type GridPatch = Partial<
  Pick<MapSettings, "gridShape" | "gridSize" | "gridOffsetX" | "gridOffsetY">
>;

const r2 = (v: number): number => Math.round(v * 100) / 100;

/**
 * **Die Zellgrösse an zwei Ecken abgreifen** (T-304): zwei gegenüberliegende
 * Ecken eines Feldes auf dem Bild, und das Gitter steht darauf. Die Grösse
 * ist das Mittel aus Breite und Höhe (ein Feld ist quadratisch, ein Klick
 * nicht ganz genau); der Versatz legt eine Linie auf die erste Ecke.
 * Kleiner als 4 Bildpunkte gibt `null` — das wäre ein Doppelklick.
 */
export function gridFromCell(a: Pt, b: Pt, nat: Size): GridPatch | null {
  if (!(nat.w > 0) || !(nat.h > 0)) return null;
  const dx = Math.abs(b.x - a.x) * nat.w;
  const dy = Math.abs(b.y - a.y) * nat.h;
  const size = dx > 0 && dy > 0 ? (dx + dy) / 2 : Math.max(dx, dy);
  if (!(size >= 4)) return null;
  const ox = Math.min(a.x, b.x) * nat.w;
  const oy = Math.min(a.y, b.y) * nat.h;
  return {
    gridSize: r2(size),
    gridOffsetX: r2(((ox % size) + size) % size),
    gridOffsetY: r2(((oy % size) + size) % size),
  };
}

/** Den Ursprung des Gitters auf einen Punkt legen: dort kreuzen sich zwei Linien. */
export function gridOrigin(p: Pt, nat: Size, size: number): GridPatch {
  const g = size > 0 ? size : 70;
  const ox = p.x * nat.w;
  const oy = p.y * nat.h;
  return {
    gridOffsetX: r2(((ox % g) + g) % g),
    gridOffsetY: r2(((oy % g) + g) % g),
  };
}

/** Die Gittereinstellungen der Karte ändern (`Map.gridShape` …); was die Vorschau zeigt, schreibt dasselbe. */
export function setGrid(e: Entity, patch: GridPatch): Entity {
  const karte = {
    ...((e.components?.["Map"] ?? {}) as Record<string, unknown>),
  };
  if (patch.gridShape) karte["gridShape"] = patch.gridShape;
  if (patch.gridSize !== undefined && Number.isFinite(patch.gridSize))
    karte["gridSize"] = Math.max(4, r2(patch.gridSize));
  if (patch.gridOffsetX !== undefined && Number.isFinite(patch.gridOffsetX))
    karte["gridOffsetX"] = r2(patch.gridOffsetX);
  if (patch.gridOffsetY !== undefined && Number.isFinite(patch.gridOffsetY))
    karte["gridOffsetY"] = r2(patch.gridOffsetY);
  return { ...e, components: { ...e.components, Map: karte } };
}

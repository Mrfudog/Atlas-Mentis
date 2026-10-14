/**
 * **Karten** (REQ-130 bis 136, docs/Karten.md) — was Server, Oberfläche und
 * Prototyp gleich rechnen: Blätter, Gitter, Messen, Unterkartenrahmen, der
 * Schritt hinein und hinaus, das Gruppen-Token und was ein Spieler von einer
 * Karte nicht bekommt.
 *
 * **Alles in Anteilen, nie in Bildpunkten** (0–1 je Achse): Marker, Rahmen
 * und Punkte. Ein Bild darf ersetzt, verkleinert oder neu ausgeschnitten
 * werden, ohne dass jede Stelle wandert, und dieselbe Karte trägt auf dem
 * Telefon und am Beamer dieselben Stellen. Nur das Gitter steht in
 * Bildpunkten des Kartenbildes — man misst es am Bild.
 *
 * Kein Framework, kein DOM: die Seite misst, das Modell rechnet.
 */

import type { Pt } from './sight.js';
import type { Entity, EntityId, Relation } from './types.js';

export const MAP_TYPE = 'Map';
/** Die Karte, die `MapInfo` trägt — benannt nach der Art, die die Felder erklärt. */
export const MAP_COMPONENT = 'Map';
/** Karte → Artikel, an einem Punkt (REQ-133). */
export const MARKER_RELATION = 'marker';
/** Unterkarte → Karte, mit Rahmen (REQ-131). Gespeichert wird nur vorwärts. */
export const INSIDE_MAP_RELATION = 'insideMap';
/** Karte → Ort oder Geschichte, die sie zeigt. */
export const MAP_OF_RELATION = 'mapOf';

/**
 * Ab diesem Anteil des Sichtfensters — in **beiden** Richtungen — sagt ein
 * Unterkartenrahmen an, dass der nächste Zoomschritt ihn betritt. Erst der
 * Schritt danach betritt ihn: eine Schwelle allein wäre ein Sprung, den
 * niemand kommen sieht (docs/Karten.md, „Hineinzoomen").
 */
export const MAP_NEAR = 0.55;
export const MAP_ZOOM_MIN = 0.25;
export const MAP_ZOOM_MAX = 8;
/** Ein Zoomschritt: mal 1,25 hinein, mal 0,8 hinaus. */
export const MAP_ZOOM_STEP = 1.25;
/** Ein Rahmen ohne Grösse bekommt diese — wie im Prototyp. */
const RAHMEN_VORGABE = 0.12;
/** Eine Kette von Unterkarten ist kurz; ein Kreis hört hier auf. */
const HOECHSTENS = 12;

export type GridShape = 'none' | 'square' | 'hex';
export type MarkerKind = 'static' | 'scenery' | 'party' | 'quest' | 'play';
export const MARKER_KINDS: readonly MarkerKind[] = ['static', 'scenery', 'party', 'quest', 'play'];

export interface Frame {
  x: number;
  y: number;
  w: number;
  h: number;
}
/** Die natürliche Grösse des Kartenbildes in Bildpunkten. */
export interface Size {
  w: number;
  h: number;
}

function zahl(v: unknown, sonst: number): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v.replace(',', '.')) : NaN;
  return Number.isFinite(n) ? n : sonst;
}
const zwischen = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

// ------------------------------------------------------------------ Karte

export interface MapSettings {
  gridShape: GridShape;
  /** Breite eines Feldes in Bildpunkten des Kartenbildes (mindestens 4). */
  gridSize: number;
  gridOffsetX: number;
  gridOffsetY: number;
  /** „1,5 m" — was ein Feld in der Welt ist. */
  scale: string;
  baseHidden: boolean;
  baseGmOnly: boolean;
}

export function isMap(e: Entity | undefined): boolean {
  return (e?.interfaces ?? [])[0] === MAP_TYPE;
}

/** Die Einstellungen der Karte, mit den Vorgaben des Registers, wo nichts steht. */
export function mapSettings(e: Entity): MapSettings {
  const k = (e.components?.[MAP_COMPONENT] ?? {}) as Record<string, unknown>;
  const form = k['gridShape'];
  return {
    gridShape: form === 'square' || form === 'hex' ? form : 'none',
    gridSize: Math.max(4, zahl(k['gridSize'], 70)),
    gridOffsetX: zahl(k['gridOffsetX'], 0),
    gridOffsetY: zahl(k['gridOffsetY'], 0),
    scale: typeof k['scale'] === 'string' && k['scale'].trim() ? k['scale'].trim() : '1,5 m',
    baseHidden: k['baseHidden'] === true,
    baseGmOnly: k['baseGmOnly'] === true,
  };
}

/**
 * **Das Bild der Karte ist `Image.image`** und steht nicht noch einmal an
 * `Map` (die Id eines Asset-Artikels, T-114, oder eine Adresse). Eine
 * Karte *hat* ein Bild wie jeder Artikel, und genau dieses ist das unterste
 * Blatt.
 */
export function mapImage(e: Entity): string {
  const v = (e.components?.['Image'] as { image?: unknown } | undefined)?.image;
  return typeof v === 'string' ? v.trim() : '';
}

/** Ein Blatt der Karte. Das unterste (`base`) ist das Kartenbild selbst. */
export interface MapSheet {
  id: string;
  name: string;
  image: string;
  opacity: number;
  visible: boolean;
  gmOnly: boolean;
  base: boolean;
}

export const BASE_SHEET = '__base';

/**
 * Die Blätter von unten nach oben, das Kartenbild zuerst. Die Leiste zeigt
 * sie umgekehrt — oben, was obenauf liegt.
 */
export function mapSheets(e: Entity): MapSheet[] {
  const s = mapSettings(e);
  const out: MapSheet[] = [
    { id: BASE_SHEET, name: 'Base map', image: mapImage(e), opacity: 1, visible: !s.baseHidden, gmOnly: s.baseGmOnly, base: true },
  ];
  const roh = (e.components?.[MAP_COMPONENT] as { sheets?: unknown } | undefined)?.sheets;
  (Array.isArray(roh) ? roh : []).forEach((x, i) => {
    if (!x || typeof x !== 'object') return;
    const b = x as Record<string, unknown>;
    out.push({
      id: typeof b['id'] === 'string' && b['id'] ? b['id'] : `sheet-${i + 1}`,
      name: typeof b['name'] === 'string' && b['name'] ? b['name'] : 'Layer',
      image: typeof b['image'] === 'string' ? b['image'].trim() : '',
      opacity: zwischen(zahl(b['opacity'], 1), 0, 1),
      visible: b['visible'] !== false,
      gmOnly: b['gmOnly'] === true,
      base: false,
    });
  });
  return out;
}

/**
 * Was gezeichnet wird: mit Bild, sichtbar (oder vom Betrachter für sich
 * eingeschaltet, `shown`) und für Spielende ohne die Blätter der Leitung.
 * Am Server sind die schon weg (`redactMap`); hier gilt es für die
 * Spieleransicht der Leitung.
 *
 * **Das Kartenbild bleibt im Fluss**, auch ausgeblendet: an ihm hängt die
 * Grösse der Karte. Ausgeblendet heisst durchsichtig, nicht weg — das sagt
 * `hidden` am Ergebnis.
 */
export function drawnSheets(
  e: Entity,
  gm: boolean,
  shown?: Readonly<Record<string, boolean>>,
): Array<MapSheet & { hidden: boolean }> {
  return mapSheets(e)
    .filter((s) => s.image && (gm || !s.gmOnly))
    .map((s) => ({ ...s, hidden: !(shown?.[s.id] ?? s.visible) }))
    .filter((s) => s.base || !s.hidden);
}

// ----------------------------------------------------------------- Marker

export interface MapMarker {
  rel: Relation;
  to: EntityId;
  x: number;
  y: number;
  kind: MarkerKind;
  /** Breite in Feldern. */
  size: number;
  rot: number;
  /** Höhe durch Breite — nur ein Möbel ist nicht rund. */
  ratio: number;
  note: string;
  hidden: boolean;
}

export function markerOf(rel: Relation): MapMarker {
  const p = (rel.props ?? {}) as Record<string, unknown>;
  const kind = MARKER_KINDS.includes(p['kind'] as MarkerKind) ? (p['kind'] as MarkerKind) : 'static';
  return {
    rel,
    to: rel.to,
    x: zwischen(zahl(p['x'], 0.5), 0, 1),
    y: zwischen(zahl(p['y'], 0.5), 0, 1),
    kind,
    size: Math.max(0.25, zahl(p['size'], 1)),
    rot: zahl(p['rot'], 0),
    ratio: zahl(p['ratio'], 1) > 0 ? zahl(p['ratio'], 1) : 1,
    note: typeof p['note'] === 'string' ? p['note'] : '',
    hidden: p['hidden'] === true,
  };
}

export function markersOf(map: Entity): MapMarker[] {
  return (map.relations ?? []).filter((r) => r.type === MARKER_RELATION && r.to).map(markerOf);
}

/**
 * Ein Marker an eine neue Stelle — die Kante bekommt neue `x`/`y`, alles
 * andere an ihr bleibt. Gerundet auf vier Stellen: ein Zehntausendstel ist
 * auf jeder Karte weniger als ein Bildpunkt.
 */
export function moveMarker(map: Entity, relId: string, to: Pt): Entity {
  const r4 = (v: number) => Math.round(zwischen(v, 0, 1) * 10000) / 10000;
  return {
    ...map,
    relations: (map.relations ?? []).map((r) =>
      r.id === relId && r.type === MARKER_RELATION ? { ...r, props: { ...(r.props ?? {}), x: r4(to.x), y: r4(to.y) } } : r,
    ),
  };
}

/** Ein neuer Marker auf einen Artikel, an einem Punkt. */
export function addMarker(map: Entity, to: EntityId, at: Pt, id: string, kind: MarkerKind = 'static'): Entity {
  const r4 = (v: number) => Math.round(zwischen(v, 0, 1) * 10000) / 10000;
  return {
    ...map,
    relations: [...(map.relations ?? []), { id, type: MARKER_RELATION, to, props: { x: r4(at.x), y: r4(at.y), kind } }],
  };
}

// ------------------------------------------------------------- Unterkarten

/** Der Rahmen an einer `insideMap`-Kante; ohne `x`/`y` ist es keiner. */
export function frameOf(rel: Relation | undefined): Frame | null {
  const p = (rel?.props ?? {}) as Record<string, unknown>;
  if (p['x'] == null || p['y'] == null) return null;
  const x = zwischen(zahl(p['x'], 0), 0, 1);
  const y = zwischen(zahl(p['y'], 0), 0, 1);
  const w = zwischen(zahl(p['w'], RAHMEN_VORGABE), 0.001, 1);
  const h = zwischen(zahl(p['h'], RAHMEN_VORGABE), 0.001, 1);
  return { x, y, w, h };
}

/** Die Kante zur Karte darüber, wenn es eine gibt. */
export function parentMapRelation(map: Entity): Relation | undefined {
  return (map.relations ?? []).find((r) => r.type === INSIDE_MAP_RELATION && r.to);
}

/**
 * Die Karten über dieser, die äusserste zuerst — die Brotkrumen. Ein Kreis
 * oder eine Karte, die der Betrachter nicht hat, beendet die Kette.
 */
export function mapAncestors(byId: ReadonlyMap<EntityId, Entity>, map: Entity): Entity[] {
  const out: Entity[] = [];
  const gesehen = new Set([map.id]);
  let jetzt: Entity | undefined = map;
  while (jetzt && out.length < HOECHSTENS) {
    const oben = parentMapRelation(jetzt)?.to;
    if (!oben || gesehen.has(oben)) break;
    gesehen.add(oben);
    const e = byId.get(oben);
    if (!e) break;
    out.unshift(e);
    jetzt = e;
  }
  return out;
}

/** Ein Punkt der Unterkarte, auf der Karte darüber. */
export function liftPoint(p: Pt, frame: Frame): Pt {
  return { x: frame.x + p.x * frame.w, y: frame.y + p.y * frame.h };
}

/** Ein Punkt der Karte darüber, in der Unterkarte — ausserhalb des Rahmens ausserhalb von 0–1. */
export function lowerPoint(p: Pt, frame: Frame): Pt {
  return { x: (p.x - frame.x) / frame.w, y: (p.y - frame.y) / frame.h };
}

/**
 * **Wie viel des Sichtfensters ein Rahmen füllt** — das Kleinere der beiden
 * Richtungen; ein Rahmen, der nur quer voll ist, ist ein Streifen und kein
 * Ziel.
 *
 * Gemessen wird das Fenster, **gerechnet** das Bild: es ist bei Zoom 1 so
 * breit wie das Fenster, also `zoom × Fenster` breit. **Eine fehlende
 * Messung ist keine Messung von null:** fehlt die Höhe des Fensters (die
 * Bühne hängt noch nicht, das Bild lädt), zählt die Breite allein.
 */
export function frameShare(frame: Frame, nat: Size | null, zoom: number, viewport: Size): number {
  if (!viewport.w || !nat || !(nat.w > 0) || !(nat.h > 0)) return 0;
  const bw = viewport.w * (zoom || 1);
  const bh = bw * (nat.h / nat.w);
  const quer = (frame.w * bw) / viewport.w;
  if (!viewport.h) return quer;
  return Math.min(quer, (frame.h * bh) / viewport.h);
}

export interface ChildMap {
  id: EntityId;
  frame: Frame;
}

export type ZoomStep =
  | { kind: 'zoom'; zoom: number }
  | { kind: 'enter'; id: EntityId }
  | { kind: 'leave'; id: EntityId };

/**
 * **Was ein Zoomschritt tut** (REQ-131). Hinein: füllt ein Rahmen den Blick
 * schon (`MAP_NEAR`), wird er betreten — geprüft **vor** dem Zoomen, damit
 * der Schritt näher und der Schritt hinein nicht derselbe sind. Hinaus:
 * ganz draussen und noch weiter heisst die Karte darüber.
 *
 * Füllen mehrere Rahmen den Blick, gewinnt der, der ihn am meisten füllt.
 */
export function zoomStep(opts: {
  zoom: number;
  direction: 1 | -1;
  children: readonly ChildMap[];
  parent?: EntityId;
  nat: Size | null;
  viewport: Size;
  /** Der Ausschnitt in Kartenanteilen — nur Rahmen darin zählen. */
  visible?: Frame;
}): ZoomStep {
  const { zoom, direction } = opts;
  if (direction > 0) {
    let beste: { id: EntityId; anteil: number } | null = null;
    for (const k of opts.children) {
      if (opts.visible && !overlaps(k.frame, opts.visible)) continue;
      const anteil = frameShare(k.frame, opts.nat, zoom, opts.viewport);
      if (anteil >= MAP_NEAR && (!beste || anteil > beste.anteil)) beste = { id: k.id, anteil };
    }
    if (beste) return { kind: 'enter', id: beste.id };
    return { kind: 'zoom', zoom: Math.min(MAP_ZOOM_MAX, zoom * MAP_ZOOM_STEP) };
  }
  const neu = Math.max(MAP_ZOOM_MIN, zoom / MAP_ZOOM_STEP);
  if (neu >= zoom && opts.parent) return { kind: 'leave', id: opts.parent };
  return { kind: 'zoom', zoom: neu };
}

/** Steht der Rahmen nahe genug, dass der nächste Schritt ihn betritt? */
export function frameNear(frame: Frame, nat: Size | null, zoom: number, viewport: Size): boolean {
  return frameShare(frame, nat, zoom, viewport) >= MAP_NEAR;
}

function overlaps(a: Frame, b: Frame): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

// ------------------------------------------------------------------ Gitter

export interface GridGeometry {
  shape: 'square' | 'hex';
  /** Feldbreite in Bildpunkten. */
  size: number;
  /** Bei Hex: Höhe eines Feldes (`size · 2/√3`); bei Quadraten gleich `size`. */
  rowHeight: number;
  ox: number;
  oy: number;
  w: number;
  h: number;
}

/**
 * Das Gitter in Bildpunkten des Kartenbildes. Ohne Bildgrösse oder ohne
 * Gitter keines — dann misst die Karte auch nicht in Feldern.
 */
export function gridGeometry(s: MapSettings, nat: Size | null): GridGeometry | null {
  if (s.gridShape === 'none' || !nat || !(nat.w > 0) || !(nat.h > 0)) return null;
  const g = s.gridSize;
  return {
    shape: s.gridShape,
    size: g,
    rowHeight: s.gridShape === 'hex' ? (g * 2) / Math.sqrt(3) : g,
    ox: ((s.gridOffsetX % g) + g) % g,
    oy: ((s.gridOffsetY % g) + g) % g,
    w: nat.w,
    h: nat.h,
  };
}

/**
 * **Das Hexmuster** als eine Kachel, die sich wiederholt — spitze Seite
 * oben, die zweite Reihe um eine halbe Breite versetzt. Ein Pfad mit
 * `viewBox` 0 0 100 173.2, gezeichnet in `size × 1.5·rowHeight`. Ein
 * Muster statt einzeln gezeichneter Felder: sonst hinge die Zahl der Knoten
 * an der Bildgrösse.
 */
export const HEX_TILE_PATH =
  'M50 0 L100 28.9 L100 86.6 L50 115.5 L0 86.6 L0 28.9 Z M100 86.6 L100 144.3 M0 86.6 L0 144.3 M50 115.5 L50 173.2';

/** Hex in axialen Koordinaten (q, r): spitze Seite oben, Reihe r. */
interface Hex {
  q: number;
  r: number;
}

function hexRound(q: number, r: number): Hex {
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  const rs = Math.round(s);
  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  return { q: rq + 0, r: rr + 0 };
}

/** Das Feld unter einem Punkt (in Anteilen). Quadrat: Spalte/Zeile; Hex: axial. */
export function cellAt(geo: GridGeometry, p: Pt): { x: number; y: number } {
  const px = p.x * geo.w - geo.ox;
  const py = p.y * geo.h - geo.oy;
  if (geo.shape === 'square') return { x: Math.floor(px / geo.size), y: Math.floor(py / geo.size) };
  /* Mitte des Feldes (0,0) bei einer halben Breite und Höhe; Kantenlänge
     = halbe Höhe. */
  const s = geo.rowHeight / 2;
  const x = px - geo.size / 2;
  const y = py - geo.rowHeight / 2;
  const h = hexRound(((Math.sqrt(3) / 3) * x - y / 3) / s, ((2 / 3) * y) / s);
  return { x: h.q, y: h.r };
}

/** Die Mitte eines Feldes, in Anteilen. */
export function cellCentre(geo: GridGeometry, c: { x: number; y: number }): Pt {
  if (geo.shape === 'square') {
    return { x: (geo.ox + (c.x + 0.5) * geo.size) / geo.w, y: (geo.oy + (c.y + 0.5) * geo.size) / geo.h };
  }
  const s = geo.rowHeight / 2;
  const x = geo.size / 2 + s * Math.sqrt(3) * (c.x + c.y / 2);
  const y = geo.rowHeight / 2 + s * 1.5 * c.y;
  return { x: (geo.ox + x) / geo.w, y: (geo.oy + y) / geo.h };
}

/**
 * Felder zwischen zwei Feldern. Quadrat nach der Regel aus `movement.ts`
 * (jede zweite Diagonale zählt doppelt — 5, 10, 5 Fuss); Hex die
 * gewöhnliche Hexdistanz.
 */
export function cellDistance(geo: GridGeometry, a: { x: number; y: number }, b: { x: number; y: number }): number {
  if (geo.shape === 'square') {
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    const gerade = Math.max(dx, dy);
    const schraeg = Math.min(dx, dy);
    return gerade + Math.floor(schraeg / 2);
  }
  const dq = a.x - b.x;
  const dr = a.y - b.y;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

/** „1,5 m" → 1.5 und „m". Ohne Zahl kein Massstab. */
export function parseScale(scale: string): { value: number; unit: string } | null {
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*([^\d\s].*)?$/.exec(scale);
  if (!m) return null;
  const value = Number(m[1]!.replace(',', '.'));
  if (!(value > 0)) return null;
  return { value, unit: (m[2] ?? '').trim() };
}

export interface Measurement {
  /** Felder, wenn ein Gitter da ist. */
  cells: number | null;
  /** Die Strecke in der Einheit des Massstabs. */
  distance: number | null;
  unit: string;
  /** „4 squares · 6 m" — fertig zum Anzeigen. */
  text: string;
}

function rund(n: number): string {
  return (Math.round(n * 100) / 100).toLocaleString('de-CH', { maximumFractionDigits: 2 });
}

/**
 * **Eine Strecke messen** (REQ-130): mit Gitter in Feldern und über den
 * Massstab in der Welt; ohne Gitter, aber mit Massstab, über die Feldgrösse
 * gerade gerechnet; ohne Bildgrösse gar nicht.
 */
export function measure(s: MapSettings, nat: Size | null, a: Pt, b: Pt): Measurement {
  const massstab = parseScale(s.scale);
  const unit = massstab?.unit ?? '';
  if (!nat || !(nat.w > 0)) return { cells: null, distance: null, unit, text: '' };
  const geo = gridGeometry(s, nat);
  let cells: number;
  if (geo) {
    cells = cellDistance(geo, cellAt(geo, a), cellAt(geo, b));
  } else {
    const px = Math.hypot((a.x - b.x) * nat.w, (a.y - b.y) * nat.h);
    cells = px / s.gridSize;
  }
  const distance = massstab ? cells * massstab.value : null;
  const feld = geo ? `${cells} ${cells === 1 ? (geo.shape === 'hex' ? 'hex' : 'square') : geo.shape === 'hex' ? 'hexes' : 'squares'}` : '';
  const welt = distance !== null ? `${rund(distance)}${unit ? ` ${unit}` : ''}` : '';
  return { cells: geo ? cells : null, distance, unit, text: [feld, welt].filter(Boolean).join(' · ') };
}

// ------------------------------------------------------------- Gruppe

export interface PartyPosition {
  /** Wo das Token wirklich steht. */
  mapId: EntityId;
  /** Auf der gefragten Karte, in Anteilen. */
  x: number;
  y: number;
  /** Steht es auf dieser Karte selbst oder auf einer darin? */
  direct: boolean;
}

/**
 * **Wo die Gruppe ist** (REQ-136, Abgleich A6). Es gibt genau eine Stelle
 * dafür: ein Marker `kind: 'party'` auf die Gruppe oder eine ihrer Figuren.
 * Auf jeder gröberen Karte wird er durch die Rahmen der Unterkarten
 * abgebildet. Steht er auf mehreren Karten, gilt die feinste — die mit den
 * meisten Rahmen bis hierher; gleich fein entscheidet die Id, damit zwei
 * Geräte dasselbe zeigen.
 */
export function partyPosition(
  maps: ReadonlyMap<EntityId, Entity>,
  map: Entity,
  partyIds: ReadonlySet<EntityId>,
): PartyPosition | null {
  let beste: (PartyPosition & { tiefe: number }) | null = null;
  const kandidaten = [...maps.values()].filter(isMap).sort((a, b) => a.id.localeCompare(b.id));
  for (const k of kandidaten) {
    const m = markersOf(k).find((x) => x.kind === 'party' && partyIds.has(x.to));
    if (!m) continue;
    let p: Pt = { x: m.x, y: m.y };
    let jetzt: Entity | undefined = k;
    let tiefe = 0;
    const gesehen = new Set<EntityId>();
    while (jetzt && jetzt.id !== map.id && tiefe < HOECHSTENS) {
      gesehen.add(jetzt.id);
      const rel = parentMapRelation(jetzt);
      const rahmen = frameOf(rel);
      if (!rel || !rahmen || gesehen.has(rel.to)) {
        jetzt = undefined;
        break;
      }
      p = liftPoint(p, rahmen);
      jetzt = maps.get(rel.to);
      tiefe += 1;
    }
    if (!jetzt || jetzt.id !== map.id) continue;
    if (!beste || tiefe > beste.tiefe) beste = { mapId: k.id, x: p.x, y: p.y, direct: tiefe === 0, tiefe };
  }
  if (!beste) return null;
  const { tiefe: _t, ...ohne } = beste;
  return ohne;
}

// ------------------------------------------------------------------ Nebel

/**
 * **Eine aufgedeckte Form** (REQ-139, `Map.reveal`). Alles in Anteilen der
 * Karte; Kreis und Pinselstrich messen ihren Halbmesser `r` in Anteilen der
 * **Breite** und tragen das Seitenverhältnis `ar` (Höhe durch Breite), mit
 * dem sie gezogen wurden. Ohne `ar` wäre ein Kreis auf einer breiten Karte
 * ein Ei, und der Server — der die Bildgrösse nicht kennt — könnte nicht
 * sagen, ob ein Marker darin steht.
 *
 * - `rect` — aufgezogen (Werkzeug *Reveal*);
 * - `circle` — ein Fleck;
 * - `poly` — ein Sichtpolygon (der Prototyp deckt beim Ziehen damit auf);
 * - `path` — ein **Pinselstrich**: die Fläche um einen Linienzug, `r` weit.
 */
export type RevealShape =
  | { id: string; kind: 'rect'; x: number; y: number; w: number; h: number }
  | { id: string; kind: 'circle'; x: number; y: number; r: number; ar: number }
  | { id: string; kind: 'poly'; pts: Array<[number, number]> }
  | { id: string; kind: 'path'; pts: Array<[number, number]>; r: number; ar: number };

/** Ist auf dieser Karte der Nebel an? */
export function fogOn(e: Entity): boolean {
  return (e.components?.[MAP_COMPONENT] as { fog?: unknown } | undefined)?.fog === true;
}

function punkte(v: unknown): Array<[number, number]> {
  if (!Array.isArray(v)) return [];
  return v.flatMap((p) => {
    if (!Array.isArray(p) || p.length < 2) return [];
    const x = zahl(p[0], NaN);
    const y = zahl(p[1], NaN);
    return Number.isFinite(x) && Number.isFinite(y) ? [[x, y] as [number, number]] : [];
  });
}

/** Eine Form aus `Map.reveal` gelesen; Unlesbares gibt `null`. */
function formAus(x: unknown, i: number): RevealShape | null {
  if (!x || typeof x !== 'object') return null;
  const s = x as Record<string, unknown>;
  const id = typeof s['id'] === 'string' && s['id'] ? s['id'] : `s-${i + 1}`;
  const ar = zahl(s['ar'], 1) > 0 ? zahl(s['ar'], 1) : 1;
  if (s['kind'] === 'circle') return { id, kind: 'circle', x: zahl(s['x'], 0), y: zahl(s['y'], 0), r: Math.max(0, zahl(s['r'], 0.05)), ar };
  if (s['kind'] === 'poly') {
    const pts = punkte(s['pts']);
    return pts.length > 2 ? { id, kind: 'poly', pts } : null;
  }
  if (s['kind'] === 'path') {
    const pts = punkte(s['pts']);
    return pts.length ? { id, kind: 'path', pts, r: Math.max(0, zahl(s['r'], 0.03)), ar } : null;
  }
  /* Ein Rechteck darf mit negativer Breite stehen (von rechts nach links
     gezogen) — gelesen wird es wie gezeichnet. */
  const x0 = zahl(s['x'], 0);
  const y0 = zahl(s['y'], 0);
  const w = zahl(s['w'], 0);
  const h = zahl(s['h'], 0);
  return { id, kind: 'rect', x: Math.min(x0, x0 + w), y: Math.min(y0, y0 + h), w: Math.abs(w), h: Math.abs(h) };
}

/** Die aufgedeckten Formen, wie sie in `Map.reveal` stehen; Unlesbares fällt weg. */
export function revealShapes(e: Entity): RevealShape[] {
  return rohReveal(e).flatMap((x, i) => formAus(x, i) ?? []);
}

/** Abstand eines Punktes zu einer Strecke, alles in einem Raum mit gleichen Achsen. */
function streckenAbstand(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const l = dx * dx + dy * dy;
  const t = l ? zwischen(((px - ax) * dx + (py - ay) * dy) / l, 0, 1) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * Liegt der Punkt in der Form? Kreis und Strich rechnen in einem Raum, in
 * dem ein Schritt nach unten so lang ist wie einer nach rechts (y mal `ar`).
 */
export function inShape(s: RevealShape, p: Pt): boolean {
  if (s.kind === 'rect') return p.x >= s.x && p.x <= s.x + s.w && p.y >= s.y && p.y <= s.y + s.h;
  if (s.kind === 'circle') return Math.hypot(p.x - s.x, (p.y - s.y) * s.ar) <= s.r;
  if (s.kind === 'path') {
    const [erster] = s.pts;
    if (s.pts.length === 1) return Math.hypot(p.x - erster![0], (p.y - erster![1]) * s.ar) <= s.r;
    for (let i = 1; i < s.pts.length; i++) {
      const a = s.pts[i - 1]!;
      const b = s.pts[i]!;
      if (streckenAbstand(p.x, p.y * s.ar, a[0], a[1] * s.ar, b[0], b[1] * s.ar) <= s.r) return true;
    }
    return false;
  }
  let drin = false;
  const q = s.pts;
  for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
    const [xi, yi] = q[i]!;
    const [xj, yj] = q[j]!;
    if (yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi + 1e-12) + xi) drin = !drin;
  }
  return drin;
}

/** Sieht man diese Stelle durch den Nebel? Ohne Nebel jede. */
export function isRevealed(e: Entity, p: Pt): boolean {
  if (!fogOn(e)) return true;
  return revealShapes(e).some((s) => inShape(s, p));
}

/** Liegt irgendein Teil des Rahmens im Aufgedeckten — die Mitte oder eine Ecke? */
export function frameRevealed(e: Entity, f: Frame): boolean {
  if (!fogOn(e)) return true;
  const proben: Pt[] = [
    { x: f.x + f.w / 2, y: f.y + f.h / 2 },
    { x: f.x, y: f.y },
    { x: f.x + f.w, y: f.y },
    { x: f.x, y: f.y + f.h },
    { x: f.x + f.w, y: f.y + f.h },
  ];
  return proben.some((p) => isRevealed(e, p));
}

const r4 = (v: number): number => Math.round(v * 10000) / 10000;

function mitReveal(e: Entity, reveal: unknown[], fog?: boolean): Entity {
  const karte: Record<string, unknown> = { ...((e.components?.[MAP_COMPONENT] ?? {}) as Record<string, unknown>), reveal };
  if (fog !== undefined) karte['fog'] = fog;
  return { ...e, components: { ...e.components, [MAP_COMPONENT]: karte } };
}

function rohReveal(e: Entity): unknown[] {
  const roh = (e.components?.[MAP_COMPONENT] as { reveal?: unknown } | undefined)?.reveal;
  return Array.isArray(roh) ? roh : [];
}

/**
 * **Aufdecken** (REQ-139): eine Form dazu, gerundet auf vier Stellen. Wer
 * aufdeckt, will Nebel — also schaltet es ihn ein, wie im Prototyp.
 */
export function revealArea(e: Entity, s: RevealShape): Entity {
  let form: Record<string, unknown>;
  if (s.kind === 'rect') form = { id: s.id, kind: 'rect', x: r4(s.x), y: r4(s.y), w: r4(s.w), h: r4(s.h) };
  else if (s.kind === 'circle') form = { id: s.id, kind: 'circle', x: r4(s.x), y: r4(s.y), r: r4(s.r), ar: r4(s.ar) };
  else {
    const pts = s.pts.map(([x, y]) => [r4(x), r4(y)]);
    form = s.kind === 'poly' ? { id: s.id, kind: 'poly', pts } : { id: s.id, kind: 'path', pts, r: r4(s.r), ar: r4(s.ar) };
  }
  return mitReveal(e, [...rohReveal(e), form], true);
}

/** Die Mitte einer Form — danach fragt das Zudecken. */
function mitteVon(s: RevealShape): Pt {
  if (s.kind === 'rect') return { x: s.x + s.w / 2, y: s.y + s.h / 2 };
  if (s.kind === 'circle') return { x: s.x, y: s.y };
  const xs = s.pts.map((p) => p[0]);
  const ys = s.pts.map((p) => p[1]);
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
}

/**
 * **Zudecken** heisst: was mit seiner Mitte in diesem Kasten liegt, gilt
 * nicht mehr als aufgedeckt (wie im Prototyp). Ein Loch in eine Form zu
 * schneiden ginge auch, wäre aber eine Form, die niemand mehr von Hand
 * versteht.
 */
export function coverArea(e: Entity, f: Frame): Entity {
  const kasten: RevealShape = { id: '', kind: 'rect', x: f.x, y: f.y, w: f.w, h: f.h };
  return mitReveal(
    e,
    rohReveal(e).filter((x, i) => {
      const s = formAus(x, i);
      return !s || !inShape(kasten, mitteVon(s));
    }),
  );
}

/** Alles auf: eine Form über die ganze Karte. Der Nebel bleibt an — zudecken geht weiter. */
export function revealAll(e: Entity, id: string): Entity {
  return mitReveal(e, [{ id, kind: 'rect', x: 0, y: 0, w: 1, h: 1 }], true);
}

/** Alles zu: keine Form mehr, Nebel an. */
export function coverAll(e: Entity): Entity {
  return mitReveal(e, [], true);
}

/** Nebel an oder aus, ohne das Aufgedeckte zu verlieren. */
export function setFog(e: Entity, an: boolean): Entity {
  return mitReveal(e, rohReveal(e), an);
}

// ------------------------------------------------------------ Zurückhalten

/**
 * **Was ein Spieler von einer Karte nicht bekommt** (docs/Karten.md;
 * CLAUDE.md: zurückgehalten wird am Server). Für die Leitung bleibt alles.
 *
 * - Marker mit `hidden` (REQ-209) und Marker auf Artikel, die der
 *   Betrachter nicht sieht — eine Kante auf etwas Verborgenes verriete,
 *   dass dort etwas ist.
 * - Die Kante zur Karte darüber, wenn er die nicht sieht.
 * - Blätter mit `gmOnly`, und das Kartenbild selbst, wenn es `baseGmOnly`
 *   ist. Die Grösse der Karte nimmt die Seite dann vom ersten Blatt, das
 *   ihm bleibt.
 *
 * - **Unter dem Nebel** (REQ-139): Marker, deren Punkt nicht aufgedeckt
 *   ist. Ausgenommen sind die eigenen — das Gruppen-Token (`party`) und
 *   was `keep` nennt (die Figuren der Gruppe): wer im Dunkeln steht, steht
 *   trotzdem auf der Karte. Das Bild selbst geht ganz hinaus und wird im
 *   Browser zugedeckt (E-041).
 *
 * Gefragt wird beim Lesen (D8); gespeichert bleibt die Karte, wie sie ist.
 */
export function redactMap(
  map: Entity,
  opts: { gm: boolean; sees: (id: EntityId) => boolean; keep?: (id: EntityId) => boolean },
): Entity {
  if (opts.gm || !isMap(map)) return map;
  const nebel = fogOn(map);
  const relations = (map.relations ?? []).filter((r) => {
    if (r.type === MARKER_RELATION) {
      const m = markerOf(r);
      if (m.hidden || !opts.sees(r.to)) return false;
      if (!nebel || m.kind === 'party' || opts.keep?.(r.to)) return true;
      return isRevealed(map, m);
    }
    if (r.type === INSIDE_MAP_RELATION) return opts.sees(r.to);
    return true;
  });
  const components = { ...map.components };
  const karte = components[MAP_COMPONENT] as Record<string, unknown> | undefined;
  if (karte && Array.isArray(karte['sheets'])) {
    components[MAP_COMPONENT] = {
      ...karte,
      sheets: (karte['sheets'] as unknown[]).filter(
        (s) => !(s && typeof s === 'object' && (s as { gmOnly?: unknown }).gmOnly === true),
      ),
    };
  }
  if (karte?.['baseGmOnly'] === true && components['Image']) {
    const { image: _weg, ...rest } = components['Image'] as Record<string, unknown>;
    if (Object.keys(rest).length) components['Image'] = rest;
    else delete components['Image'];
  }
  return { ...map, components, relations };
}

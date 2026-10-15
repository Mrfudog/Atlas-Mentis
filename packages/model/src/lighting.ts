/**
 * **Licht und Dunkelsicht auf der Karte** (T-216, REQ-140; docs/Karten.md ›
 * Licht und Dunkelsicht).
 *
 * - **Die Karte sagt, wie hell es ist** (`Map.lighting`: bright, dim,
 *   dark). Ohne Angabe hell — so war jede Karte vorher.
 * - **Ein Licht ist ein Marker mit Radius** (`marker.props.light`/`dim`, in
 *   Feldern): eine Laterne auf der Karte, oder die Figur mit der Fackel.
 *   Kein eigener Artikel — dieselbe Laterne leuchtet auf der Stadtkarte
 *   anders weit als auf der Kampfkarte, also steht der Radius an der Kante.
 *   Was ein Licht erreicht, rechnet dasselbe Polygon wie die Sicht, nur
 *   gegen die Sperren, die Licht halten (`WALL_KINDS`, Spalte `light`).
 * - **Die Dunkelsicht steht am Statblock** (`senses`, „darkvision 60 ft.")
 *   und wird beim Lesen gezogen (`darkvisionFor`, D8) — gespeichert wird sie
 *   an keiner zweiten Stelle.
 * - **Was eine Figur sieht** (`figureView`): auf einer hellen oder
 *   dämmrigen Karte bis zur nächsten Sperre; im Dunkeln so weit ihre
 *   Dunkelsicht reicht, dazu von jedem Licht der Teil, in den sie
 *   hineinsieht — auch durch eine Tür in einen Raum, dessen Laterne hinter
 *   der Wand steht.
 *
 * **Die Schnittmenge wird nicht ausgerechnet:** „beleuchtet und gesehen"
 * ist das Lichtpolygon mit dem Sichtpolygon als Klammer (`within`). Zwei
 * beliebige Polygone zu schneiden wäre eine Rechnung mit vielen
 * Sonderfällen; eine Klammer prüft `inShape` mit zwei Fragen, und die
 * Leinwand zeichnet sie mit `clip()`.
 *
 * Kein Framework, kein DOM: die Seite zeichnet, das Modell rechnet.
 */

import { primaryInterface } from './entity.js';
import { resolveInstance } from './instance.js';
import { statblockFor } from './initiative.js';
import { partyMembers } from './kartenseite.js';
import {
  inPolygon,
  MAP_COMPONENT,
  mapSettings,
  markersOf,
  parseScale,
  revealAlong,
  revealArea,
  revealShapes,
  type MapSettings,
  type Size,
} from './map.js';
import { darkvisionOf, type LightLevel, type Pt } from './sight.js';
import type { Entity, EntityId } from './types.js';
import { mapWalls, sightPolygon, visionPolygon, wallSegs, type MapWall } from './walls.js';

type Lookup = ReadonlyMap<EntityId, Entity>;
type Poly = Array<[number, number]>;

export const LIGHTING_LEVELS: readonly LightLevel[] = ['bright', 'dim', 'dark'];

/** Wie hell die Karte ist (`Map.lighting`); ohne Angabe hell. */
export function mapLighting(e: Entity): LightLevel {
  const v = (e.components?.[MAP_COMPONENT] as { lighting?: unknown } | undefined)?.lighting;
  return v === 'dim' || v === 'dark' ? v : 'bright';
}

/** Die Karte mit anderer Helligkeit. */
export function setLighting(e: Entity, level: LightLevel): Entity {
  const karte = { ...((e.components?.[MAP_COMPONENT] ?? {}) as Record<string, unknown>), lighting: level };
  return { ...e, components: { ...e.components, [MAP_COMPONENT]: karte } };
}

/** Ein Licht auf der Karte, Radien in Anteilen der Breite. */
export interface MapLight {
  /** Die Id der Markerkante. */
  id: string;
  to: EntityId;
  x: number;
  y: number;
  bright: number;
  /** Der ganze Radius, bis wohin es dämmert (mindestens `bright`). */
  dim: number;
}

const feld = (v: unknown): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v.replace(',', '.')) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** Ein Feld in Anteilen der Breite. */
function feldBreite(s: MapSettings, nat: Size): number {
  return nat.w > 0 ? s.gridSize / nat.w : 0;
}

/**
 * **Die Lichter der Karte** (REQ-140): jeder Marker mit `light` oder `dim`
 * (in Feldern). `dim` ist der ganze Radius — wer nur `light` sagt, hat
 * keine Dämmerung darum.
 */
export function mapLights(map: Entity, nat: Size): MapLight[] {
  const f = feldBreite(mapSettings(map), nat);
  if (!(f > 0)) return [];
  return markersOf(map).flatMap((m) => {
    const p = (m.rel.props ?? {}) as Record<string, unknown>;
    const hell = feld(p['light']);
    const matt = Math.max(feld(p['dim']), hell);
    if (!matt) return [];
    return [{ id: m.rel.id, to: m.to, x: m.x, y: m.y, bright: hell * f, dim: matt * f }];
  });
}

const r4 = (v: number): number => Math.round(v * 10000) / 10000;

/** Was ein Licht von `from` aus erreicht, in Anteilen der Karte — wie `sightPolygon`, gegen die Sperren, die Licht halten. */
export function lightPolygon(walls: readonly MapWall[], from: Pt, ar: number, radius: number): Poly {
  const a = ar > 0 ? ar : 1;
  if (!(radius > 0)) return [];
  return visionPolygon({ x: from.x, y: from.y * a }, wallSegs(walls, 'light', a), { w: 1, h: a }, radius).map(
    ([x, y]) => [r4(x), r4(y / a)] as [number, number],
  );
}

/** Die beleuchteten Flächen je Licht: hell und dämmrig, fertig zum Zeichnen. */
export interface LitArea {
  id: string;
  bright: Poly;
  dim: Poly;
}

export function litAreas(map: Entity, nat: Size): LitArea[] {
  const ar = nat.w > 0 ? nat.h / nat.w : 1;
  const walls = mapWalls(map);
  return mapLights(map, nat).map((l) => ({
    id: l.id,
    bright: lightPolygon(walls, l, ar, l.bright),
    dim: lightPolygon(walls, l, ar, l.dim),
  }));
}

/**
 * **Fuss je Feld** aus dem Massstab der Karte: „1,5 m" sind fünf Fuss (die
 * Regel rechnet ein Feld als 5 ft. und schreibt 1,5 m dafür, nicht 4,92),
 * „10 ft" zehn. Ohne lesbaren Massstab gilt das Feld als 5 ft.
 */
export function feetPerSquare(s: MapSettings): number {
  const m = parseScale(s.scale);
  if (!m) return 5;
  const u = m.unit.toLowerCase().replace(/\.$/, '');
  if (u === 'ft' || u === 'feet' || u === 'foot' || u === 'fuss') return m.value;
  if (u === 'm' || u === 'meter' || u === 'metre') return (m.value / 1.5) * 5;
  if (u === 'km') return ((m.value * 1000) / 1.5) * 5;
  if (u === 'mi' || u === 'mile' || u === 'miles') return m.value * 5280;
  return 5;
}

/** Eine Strecke in Fuss als Radius in Anteilen der Breite. */
export function feetToFraction(map: Entity, nat: Size, feet: number): number {
  const s = mapSettings(map);
  const f = feldBreite(s, nat);
  const fps = feetPerSquare(s);
  return feet > 0 && f > 0 && fps > 0 ? (feet / fps) * f : 0;
}

/**
 * **Die Dunkelsicht einer Figur** aus den Sinnen ihres Statblocks (aufgelöst
 * gegen seine Vorlage). Eine **Gruppe** sieht so weit wie die Figur in ihr,
 * die am weitesten sieht — das Gruppen-Token steht für alle.
 */
export function darkvisionFor(entities: Lookup, id: EntityId): number {
  const e = entities.get(id);
  if (!e) return 0;
  if (primaryInterface(e) === 'Party') {
    return partyMembers(entities, id).reduce((best, m) => Math.max(best, darkvisionFor(entities, m.id)), 0);
  }
  const sb = statblockFor(entities, e);
  if (!sb) return 0;
  const karte = (resolveInstance(entities, sb).components ?? {})['Statblock'] as { senses?: unknown } | undefined;
  return darkvisionOf(karte?.senses);
}

/** Eine gesehene Fläche: ein Polygon, und wo nötig die Klammer, in der es gilt. */
export interface SeenArea {
  pts: Poly;
  within?: Poly;
}

/** Was eine Figur von einer Stelle aus sieht. */
export interface FigureView {
  /** Gesehen, in Anteilen der Karte — was ein Zug aufdeckt und was die laufende Sicht hell zeichnet. */
  seen: SeenArea[];
  /** Nur im Dunkeln: was die Dunkelsicht reicht (wird wie Dämmerlicht gezeichnet). */
  darkvision: Poly | null;
  /** Die Lichter, in deren Fläche die Figur hineinsieht. */
  lights: string[];
}

/**
 * Berühren sich zwei Polygone? Eine Ecke des einen im anderen — für
 * Lichtflächen und Sicht genau genug. Die Ecken rücken dabei ein wenig zu
 * ihrer Mitte (beide Polygone sind sternförmig um sie): zwei Flächen, die
 * sich nur an derselben Wand berühren, überlappen nicht.
 */
function beruehren(a: Poly, ma: Pt, b: Poly, mb: Pt): boolean {
  const innen = (q: readonly [number, number], m: Pt): Pt => ({ x: q[0] + (m.x - q[0]) * 0.01, y: q[1] + (m.y - q[1]) * 0.01 });
  return inPolygon(b, ma) || a.some((q) => inPolygon(b, innen(q, ma))) || b.some((q) => inPolygon(a, innen(q, mb)));
}

/**
 * **Was eine Figur sieht** (T-216): hell oder dämmrig bis zur nächsten
 * Sperre; im Dunkeln so weit wie ihre Dunkelsicht (`darkvisionFeet`), dazu
 * von jedem Licht der Teil, der auch in ihrem Sichtpolygon liegt.
 */
export function figureView(map: Entity, from: Pt, nat: Size, darkvisionFeet = 0): FigureView {
  const ar = nat.w > 0 ? nat.h / nat.w : 1;
  const walls = mapWalls(map);
  const sicht = sightPolygon(walls, from, ar);
  if (mapLighting(map) !== 'dark') return { seen: sicht.length > 2 ? [{ pts: sicht }] : [], darkvision: null, lights: [] };
  const seen: SeenArea[] = [];
  const r = feetToFraction(map, nat, darkvisionFeet);
  const dv = r > 0 ? sightPolygon(walls, from, ar, r) : [];
  if (dv.length > 2) seen.push({ pts: dv });
  const lights: string[] = [];
  if (sicht.length > 2) {
    for (const l of mapLights(map, nat)) {
      const p = lightPolygon(walls, l, ar, l.dim);
      if (p.length < 3 || !beruehren(p, l, sicht, from)) continue;
      seen.push({ pts: p, within: sicht });
      lights.push(l.id);
    }
  }
  return { seen, darkvision: dv.length > 2 ? dv : null, lights };
}

/** Steht diese Fläche (für dieselbe Figur) schon aufgedeckt da? Dann nicht noch einmal. */
function schonDa(map: Entity, a: SeenArea, fuer: EntityId | null | undefined): boolean {
  const k = JSON.stringify([a.pts, a.within ?? null]);
  return revealShapes(map).some(
    (s) => s.kind === 'poly' && (s.for ?? null) === (fuer ?? null) && JSON.stringify([s.pts, s.within ?? null]) === k,
  );
}

/** Aufdecken, was die Figur von `from` aus sieht (`figureView`), mit `for` auf sie. */
export function revealView(
  map: Entity,
  from: Pt,
  nat: Size,
  newId: () => string,
  fuer?: EntityId | null,
  darkvisionFeet = 0,
): Entity {
  let neu = map;
  for (const a of figureView(map, from, nat, darkvisionFeet).seen) {
    if (schonDa(neu, a, fuer)) continue;
    neu = revealArea(neu, { id: newId(), kind: 'poly', pts: a.pts, ...(a.within ? { within: a.within } : {}), ...(fuer ? { for: fuer } : {}) });
  }
  return neu;
}

/**
 * **Einen Weg aufdecken, mit Licht** (T-216): auf einer hellen oder
 * dämmrigen Karte wie bisher (`revealAlong`: Sichtpolygone, ohne Sperren
 * ein Pinselstrich). Im Dunkeln deckt jeder Punkt — höchstens sechs, der
 * letzte immer — auf, was die Figur dort sieht (`figureView`); ohne
 * Dunkelsicht und ohne Licht nichts.
 */
export function revealSeenAlong(
  map: Entity,
  pts: readonly Pt[],
  nat: Size,
  newId: () => string,
  fuer?: EntityId | null,
  darkvisionFeet = 0,
): Entity {
  if (!pts.length) return map;
  if (mapLighting(map) !== 'dark') return revealAlong(map, pts, nat, newId, fuer);
  const schritt = Math.max(1, Math.ceil((pts.length - 1) / 5));
  let neu = map;
  pts.forEach((p, i) => {
    if (i % schritt === 0 || i === pts.length - 1) neu = revealView(neu, p, nat, newId, fuer, darkvisionFeet);
  });
  return neu;
}

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
 * **Lichter, die etwas trägt** (T-305, REQ-140): ein Gegenstand sagt, wie
 * weit er leuchtet (`Item.lightBright`, `Item.lightDim` in Fuss, wie die
 * Regel es schreibt — „hell 20 ft, dämmrig weitere 20"). Liegt er als
 * Marker auf der Karte (der Fackelhalter, die Laterne als Kulisse), leuchtet
 * der Marker; hält eine Figur ihn **in der Hand** (`inHand`), leuchtet ihr
 * Token, die Gruppe so hell wie ihr hellstes Mitglied. Gerechnet beim Lesen
 * (`carriedLights`, D8) — wer die Fackel verstaut, löscht sie. Ein Radius
 * an der Markerkante schlägt den des Gegenstands, und `lightOff` an der
 * Kante macht jedes Licht des Markers aus (an/aus in Play).
 *
 * Kein Framework, kein DOM: die Seite zeichnet, das Modell rechnet.
 */

import { primaryInterface } from './entity.js';
import { inHand } from './inventory.js';
import { resolveInstance } from './instance.js';
import { statblockFor } from './initiative.js';
import { partyMembers } from './kartenseite.js';
import { floorView, hasFloors, mapFloors, withFloorView } from './floors.js';
import {
  assetWalls,
  inPolygon,
  MAP_COMPONENT,
  MARKER_RELATION,
  mapSettings,
  markersOf,
  parseScale,
  revealAlong,
  scaleFeet,
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

/** Ein Licht in Fuss, wie es ein Gegenstand trägt: `dim` ist der ganze Radius. */
export interface FeetLight {
  bright: number;
  dim: number;
}

/** Ein Mass in Fuss aus einem Feld (`"20"`, `"20 ft"`, `"6 m"`); Unlesbares 0. */
function fussAus(v: unknown): number {
  if (typeof v === 'number') return v > 0 ? v : 0;
  const m = parseScale(String(v ?? ''));
  if (!m) return 0;
  const u = m.unit.toLowerCase().replace(/\.$/, '');
  if (!u || u === 'ft' || u === 'feet' || u === 'foot' || u === 'fuss') return m.value;
  if (u === 'm' || u === 'meter' || u === 'metre') return (m.value / 1.5) * 5;
  return 0;
}

/**
 * **Wie weit ein Gegenstand leuchtet** (T-305): `Item.lightBright` hell,
 * `Item.lightDim` dämmrig **darüber hinaus** (so schreibt es die Regel),
 * aufgelöst gegen seine Vorlage — ein Stück im Inventar ist eine Instanz.
 */
export function itemLight(entities: Lookup, id: EntityId): FeetLight | null {
  const e = entities.get(id);
  if (!e) return null;
  const k = (resolveInstance(entities, e).components ?? {})['Item'] as { lightBright?: unknown; lightDim?: unknown } | undefined;
  const hell = fussAus(k?.lightBright);
  const weiter = fussAus(k?.lightDim);
  return hell || weiter ? { bright: hell, dim: hell + weiter } : null;
}

function heller(a: FeetLight | null, b: FeetLight | null): FeetLight | null {
  if (!a) return b;
  if (!b) return a;
  return { bright: Math.max(a.bright, b.bright), dim: Math.max(a.dim, b.dim) };
}

/**
 * **Was eine Figur in der Hand leuchten lässt** (T-305): die Gegenstände an
 * den Händen ihres Inventars (`carries` → `holds` mit `inHand`), das
 * Hellste davon. Eine Gruppe leuchtet wie ihr hellstes Mitglied — ihr Token
 * steht für alle, wie bei der Dunkelsicht.
 */
export function carriedLight(entities: Lookup, id: EntityId): FeetLight | null {
  const e = entities.get(id);
  if (!e) return null;
  if (primaryInterface(e) === 'Party') {
    return partyMembers(entities, id).reduce<FeetLight | null>((best, m) => heller(best, carriedLight(entities, m.id)), null);
  }
  let best: FeetLight | null = null;
  for (const c of e.relations ?? []) {
    if (c.type !== 'carries') continue;
    for (const h of entities.get(c.to)?.relations ?? []) {
      if (h.type !== 'holds' || !inHand((h.props ?? {}) as { slot?: string; tier?: string })) continue;
      best = heller(best, itemLight(entities, h.to));
    }
  }
  return best;
}

/**
 * **Die getragenen Lichter einer Karte** (T-305), je Ziel eines Markers:
 * ein Gegenstand als Marker leuchtet selbst, eine Figur oder Gruppe mit
 * dem, was sie in der Hand hält. Der Server rechnet es (er hat den Bestand)
 * und gibt es der Seite mit; beide zeichnen damit dasselbe.
 */
export function carriedLights(entities: Lookup, map: Entity): Record<EntityId, FeetLight> {
  const out: Record<EntityId, FeetLight> = {};
  for (const m of markersOf(map)) {
    if (out[m.to]) continue;
    const l = m.kind === 'play' || m.kind === 'party' ? heller(carriedLight(entities, m.to), itemLight(entities, m.to)) : itemLight(entities, m.to);
    if (l) out[m.to] = l;
  }
  return out;
}

/** Ist das Licht dieses Markers ausgemacht (`marker.props.lightOff`, an/aus in Play)? */
export function lightIsOff(props: Record<string, unknown> | undefined): boolean {
  return props?.['lightOff'] === true;
}

/**
 * **Die Lichter der Karte** (REQ-140): jeder Marker mit `light` oder `dim`
 * (in Feldern). `dim` ist der ganze Radius — wer nur `light` sagt, hat
 * keine Dämmerung darum. Ohne Radius an der Kante leuchtet, was das Ziel
 * trägt (`carried`, in Fuss, T-305); `lightOff` macht beides aus.
 */
export function mapLights(map: Entity, nat: Size, carried: Readonly<Record<EntityId, FeetLight>> = {}): MapLight[] {
  const f = feldBreite(mapSettings(map), nat);
  if (!(f > 0)) return [];
  return markersOf(map).flatMap((m) => {
    const p = (m.rel.props ?? {}) as Record<string, unknown>;
    if (lightIsOff(p)) return [];
    const hell = feld(p['light']);
    const matt = Math.max(feld(p['dim']), hell);
    if (matt) return [{ id: m.rel.id, to: m.to, x: m.x, y: m.y, bright: hell * f, dim: matt * f }];
    const t = carried[m.to];
    if (!t) return [];
    const b = feetToFraction(map, nat, t.bright);
    const d = Math.max(feetToFraction(map, nat, t.dim), b);
    return d > 0 ? [{ id: m.rel.id, to: m.to, x: m.x, y: m.y, bright: b, dim: d }] : [];
  });
}

/**
 * **Ein Licht frei auf die Karte** (T-320): ein Marker `light`, der auf
 * die Karte selbst zeigt — ein Licht braucht keinen Artikel, und eine
 * Fackel an der Wand ist keiner. Radien in Feldern wie an jedem Marker.
 */
export function addLight(map: Entity, at: Pt, id: string, bright: number, dim: number): Entity {
  const r = (v: number): number => Math.round(Math.min(1, Math.max(0, v)) * 10000) / 10000;
  const props: Record<string, unknown> = { x: r(at.x), y: r(at.y), kind: 'light' };
  if (bright > 0) props['light'] = bright;
  if (Math.max(dim, bright) > 0) props['dim'] = Math.max(dim, bright);
  return { ...map, relations: [...(map.relations ?? []), { id, type: MARKER_RELATION, to: map.id, props }] };
}

/** Einen Marker leuchten lassen oder ausmachen (`lightOff`) — an der Kante, die Radien bleiben. */
export function setLightOff(map: Entity, relId: string, off: boolean): Entity {
  const relations = (map.relations ?? []).map((r) => {
    if (r.id !== relId) return r;
    const { lightOff: _o, ...rest } = (r.props ?? {}) as Record<string, unknown>;
    return { ...r, props: off ? { ...rest, lightOff: true } : rest };
  });
  return { ...map, relations };
}

/** Leuchtet dieser Marker überhaupt (an der Kante oder durch sein Ziel), ob an oder aus? */
export function markerHasLight(m: { to: EntityId; rel: { props?: Record<string, unknown> } }, carried: Readonly<Record<EntityId, FeetLight>> = {}): boolean {
  const p = m.rel.props ?? {};
  return feld(p['light']) > 0 || feld(p['dim']) > 0 || !!carried[m.to];
}

const r4 = (v: number): number => Math.round(v * 10000) / 10000;

/**
 * **Zwischengespeicherte Lichtflächen** (T-305, Leistung): ein Licht, das
 * nicht wandert, erreicht dasselbe, solange die Sperren dieselben sind —
 * beim Ziehen eines Tokens ändert sich nur die Markerkante, `Map.walls`
 * bleibt dasselbe Objekt. Der Schlüssel ist diese Liste (schwach gehalten,
 * sie geht mit der Karte), darin Ort, Radius und Seitenverhältnis.
 */
const LICHT_SPEICHER = new WeakMap<readonly MapWall[], Map<string, Poly>>();
const WALLS_ROH = new WeakMap<object, MapWall[]>();

/** Die Sperren einer Karte, je rohe Liste nur einmal gelesen — so trifft der Zwischenspeicher. */
function gezeichneteSperren(map: Entity): MapWall[] {
  const roh = (map.components?.[MAP_COMPONENT] as { walls?: unknown } | undefined)?.walls;
  if (!roh || typeof roh !== 'object') return mapWalls(map);
  let w = WALLS_ROH.get(roh);
  if (!w) {
    w = mapWalls(map);
    WALLS_ROH.set(roh, w);
  }
  return w;
}

/** Je gezeichneter Liste die mit den Umrissen der Assets — an den Markerkanten, also neu, sobald eine Kiste wandert. */
const MIT_ASSETS = new WeakMap<readonly MapWall[], WeakMap<object, { k: string; w: MapWall[] }>>();
/** Je Liste die ohne ein Asset (die Laterne leuchtet aus ihrem eigenen Umriss heraus). */
const OHNE = new WeakMap<readonly MapWall[], Map<string, MapWall[]>>();

/**
 * **Die Sperren, die gelten** (T-306): die gezeichneten und die Umrisse der
 * Assets, die etwas halten (`assetWalls`). Ohne Asset mit Sperre ist es
 * dieselbe Liste wie vorher — der Zwischenspeicher der Lichter trifft weiter.
 */
function sperrenVon(map: Entity, nat?: Size): MapWall[] {
  const basis = gezeichneteSperren(map);
  const rels = map.relations;
  if (!nat || !rels?.length) return basis;
  let je = MIT_ASSETS.get(basis);
  if (!je) {
    je = new WeakMap();
    MIT_ASSETS.set(basis, je);
  }
  const k = `${nat.w}x${nat.h}:${mapSettings(map).gridSize}`;
  const da = je.get(rels);
  if (da && da.k === k) return da.w;
  const a = assetWalls(map, nat);
  const w = a.length ? [...basis, ...a] : basis;
  je.set(rels, { k, w });
  return w;
}

/** Die Sperren ohne die des Assets `relId` — dieselbe Liste, wenn es keine hat. */
function ohneAsset(walls: MapWall[], relId: string): MapWall[] {
  const p = `asset:${relId}:`;
  if (!walls.some((w) => w.id.startsWith(p))) return walls;
  let m = OHNE.get(walls);
  if (!m) {
    m = new Map();
    OHNE.set(walls, m);
  }
  let w = m.get(relId);
  if (!w) {
    w = walls.filter((x) => !x.id.startsWith(p));
    m.set(relId, w);
  }
  return w;
}

/** Was ein Licht von `from` aus erreicht, in Anteilen der Karte — wie `sightPolygon`, gegen die Sperren, die Licht halten. */
export function lightPolygon(walls: readonly MapWall[], from: Pt, ar: number, radius: number): Poly {
  const a = ar > 0 ? ar : 1;
  if (!(radius > 0)) return [];
  let speicher = LICHT_SPEICHER.get(walls);
  if (!speicher) {
    speicher = new Map();
    LICHT_SPEICHER.set(walls, speicher);
  }
  const k = `${from.x},${from.y},${a},${radius}`;
  const da = speicher.get(k);
  if (da) return da;
  const p = lichtRechnen(walls, from, a, radius);
  if (speicher.size > 500) speicher.clear();
  speicher.set(k, p);
  return p;
}

function lichtRechnen(walls: readonly MapWall[], from: Pt, a: number, radius: number): Poly {
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

export function litAreas(map: Entity, nat: Size, carried: Readonly<Record<EntityId, FeetLight>> = {}): LitArea[] {
  const ar = nat.w > 0 ? nat.h / nat.w : 1;
  const walls = sperrenVon(map, nat);
  return mapLights(map, nat, carried).map((l) => ({
    id: l.id,
    bright: lightPolygon(ohneAsset(walls, l.id), l, ar, l.bright),
    dim: lightPolygon(ohneAsset(walls, l.id), l, ar, l.dim),
  }));
}

/**
 * **Fuss je Feld** aus dem Massstab der Karte (`scaleFeet`, T-321): „1,5 m"
 * sind fünf Fuss (die Regel rechnet ein Feld als 5 ft. und schreibt 1,5 m
 * dafür, nicht 4,92), „10 ft" zehn, „1 mi" 5280. Ohne lesbaren Massstab
 * gilt das Feld als 5 ft.
 */
export function feetPerSquare(s: MapSettings): number {
  return scaleFeet(s.scale) ?? 5;
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
export function figureView(
  map: Entity,
  from: Pt,
  nat: Size,
  darkvisionFeet = 0,
  carried: Readonly<Record<EntityId, FeetLight>> = {},
): FigureView {
  const ar = nat.w > 0 ? nat.h / nat.w : 1;
  const walls = sperrenVon(map, nat);
  const sicht = sightPolygon(walls, from, ar);
  if (mapLighting(map) !== 'dark') return { seen: sicht.length > 2 ? [{ pts: sicht }] : [], darkvision: null, lights: [] };
  const seen: SeenArea[] = [];
  const r = feetToFraction(map, nat, darkvisionFeet);
  const dv = r > 0 ? sightPolygon(walls, from, ar, r) : [];
  if (dv.length > 2) seen.push({ pts: dv });
  const lights: string[] = [];
  if (sicht.length > 2) {
    for (const l of mapLights(map, nat, carried)) {
      const p = lightPolygon(ohneAsset(walls, l.id), l, ar, l.dim);
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
  carried: Readonly<Record<EntityId, FeetLight>> = {},
): Entity {
  let neu = map;
  for (const a of figureView(map, from, nat, darkvisionFeet, carried).seen) {
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
  carried: Readonly<Record<EntityId, FeetLight>> = {},
): Entity {
  if (!pts.length) return map;
  if (mapLighting(map) !== 'dark') return revealAlong(map, pts, nat, newId, fuer);
  const schritt = Math.max(1, Math.ceil((pts.length - 1) / 5));
  let neu = map;
  pts.forEach((p, i) => {
    if (i % schritt === 0 || i === pts.length - 1) neu = revealView(neu, p, nat, newId, fuer, darkvisionFeet, carried);
  });
  return neu;
}

// ---------------------------------------------------- Tokens im Dunkeln (T-219)

export interface RedactDarkOptions {
  /** Die Bildgrösse einer Ebene (`mapNatOf` an ihrer Projektion — jede Ebene hat ihr Bild); ohne sie rechnet keine Sicht, und nichts fällt weg. */
  nat: (view: Entity) => Size | null;
  /** Wessen Augen zählen: die Figuren des Betrachters und ihre Gruppe. */
  eyes: (id: EntityId) => boolean;
  darkvision: (id: EntityId) => number;
  /** Die getragenen Lichter (`carriedLights`) — erst gefragt, wenn eine Ebene dunkel ist. */
  carried: () => Readonly<Record<EntityId, FeetLight>>;
  /** Was immer bleibt (die Figuren der Gruppe), wie in `redactMap`. */
  keep?: (id: EntityId) => boolean;
}

/** Liegt der Punkt in einer gesehenen Fläche (samt ihrer Klammer)? */
function gesehen(seen: readonly SeenArea[], p: Pt): boolean {
  return seen.some((a) => inPolygon(a.pts, p) && (!a.within || inPolygon(a.within, p)));
}

/** Eine Ebene (oder eine Karte ohne weitere) im Dunkeln sieben. */
function dunkelSieben(map: Entity, o: RedactDarkOptions): Entity {
  if (mapLighting(map) !== 'dark') return map;
  const nat = o.nat(map);
  if (!nat || !(nat.w > 0) || !(nat.h > 0)) return map;
  const marker = markersOf(map);
  const augen = marker.filter((m) => !m.hidden && o.eyes(m.to) && (m.kind === 'play' || m.kind === 'party'));
  if (!augen.length) return map;
  const getragen = o.carried();
  const seen = augen.flatMap((m) => figureView(map, m, nat, o.darkvision(m.to), getragen).seen);
  const weg = new Set(
    marker.filter((m) => m.kind === 'play' && !o.eyes(m.to) && !o.keep?.(m.to) && !gesehen(seen, m)).map((m) => m.rel.id),
  );
  if (!weg.size) return map;
  return { ...map, relations: (map.relations ?? []).filter((r) => !weg.has(r.id)) };
}

/**
 * **Tokens im Dunkeln zurückhalten** (T-219, Rest von T-216): auf einer
 * dunklen Karte bekommt eine Spielerin ein Spiel-Token nur, wenn eine ihrer
 * Figuren (oder ihre Gruppe) es sieht — mit Dunkelsicht oder weil es in
 * einem Licht steht, in das die Figur hineinsieht (`figureView`, dieselbe
 * Rechnung wie die laufende Sicht im Browser). Bis dahin hielt nur der
 * Nebel zurück: wer im Dunkeln wartete, stand für jeden auf der Karte,
 * und die Seite deckte ihn bloss mit Schwarz zu.
 *
 * Gerechnet je Ebene mit den Figuren **auf ihr**. Steht dort keine eigene
 * Figur, bleibt die Ebene, wie sie ist — ohne Augen gibt es keine Sicht,
 * und eine leere Karte verriete nur, dass jemand zurückhält; der Nebel
 * gilt dort weiter. Lichter, Assets, Übergänge und das Gruppen-Token
 * bleiben stehen: sie sind Karte, keine Wesen.
 */
export function redactDark(map: Entity, o: RedactDarkOptions): Entity {
  if (!hasFloors(map)) return dunkelSieben(map, o);
  let e = map;
  for (const f of mapFloors(map)) e = withFloorView(e, f.id, dunkelSieben(floorView(e, f.id), o));
  return e;
}

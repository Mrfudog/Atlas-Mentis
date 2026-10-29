/**
 * **Flächen auf der Karte** (T-219, REQ-193, REQ-208, docs/Karten.md ›
 * Zonen und Gebiete): die Kanten `zone` (eine Regel, die dort gilt —
 * schwieriges Gelände, magische Dunkelheit) und `territory` (wem ein Stück
 * Karte gehört). Beide sind eine Form in Anteilen der Karte, die auf einen
 * Artikel zeigt; die Regel bzw. der Herrscher steht am Artikel, die Form
 * an der Kante.
 *
 * **Gezeichnet wird aufs Gitter gerastert**: am Tisch zählt, welche Felder
 * Eis sind, nicht wo die Linie genau verläuft. Ein Feld gehört zur Fläche,
 * wenn seine Mitte darin liegt — dieselbe Regel wie `terrainCosts` für den
 * Zugplan (T-349), sonst zeigte die Karte anderes Eis, als der Plan
 * rechnet. Ohne Gitter steht die Form selbst da.
 *
 * Kein Framework, kein DOM: die Seite zeichnet, das Modell rechnet.
 */

import { cellAt, cellCentre, inShape, shapeBox, shapeOf, type GridGeometry, type RevealShape } from './map.js';
import type { Pt } from './sight.js';
import type { Entity, EntityId, Relation } from './types.js';

export const ZONE_RELATION = 'zone';
export const TERRITORY_RELATION = 'territory';
/** Die Kantenarten, die eine Fläche auf die Karte legen. */
export const AREA_RELATIONS: readonly string[] = [ZONE_RELATION, TERRITORY_RELATION];

export function isAreaRelation(r: Pick<Relation, 'type'>): boolean {
  return r.type === ZONE_RELATION || r.type === TERRITORY_RELATION;
}

export interface MapArea {
  /** Die Id der Kante. */
  id: string;
  type: 'zone' | 'territory';
  /** Die Zonenart bzw. wem das Gebiet gehört. */
  to: EntityId;
  shape: RevealShape;
  /** Eigene Farbe der Kante (`territory.color`), sonst `null`. */
  color: string | null;
  /** Deckkraft der Füllung, 0–1. */
  opacity: number;
  /** Eine versteckte Zone ist gefunden (`zone.found`). */
  found: boolean;
  note: string;
}

const zahl = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/** Die Flächen einer Karte (oder einer Ebene, `floorView`), in der Reihenfolge der Kanten; Unlesbares fällt weg. */
export function mapAreas(map: Entity): MapArea[] {
  const out: MapArea[] = [];
  for (const r of map.relations ?? []) {
    if (!isAreaRelation(r)) continue;
    const p = (r.props ?? {}) as Record<string, unknown>;
    const shape = shapeOf({ ...p, id: r.id });
    if (!shape) continue;
    const color = typeof p['color'] === 'string' && p['color'] ? p['color'] : null;
    out.push({
      id: r.id,
      type: r.type as MapArea['type'],
      to: r.to,
      shape,
      color,
      opacity: Math.min(1, Math.max(0, zahl(p['opacity'], r.type === TERRITORY_RELATION ? 0.18 : 0.3))),
      found: p['found'] === true,
      note: typeof p['note'] === 'string' ? p['note'] : '',
    });
  }
  return out;
}

export interface AreaCell {
  /** Spalte/Zeile (Quadrat) bzw. axial q/r (Hex), wie `cellAt`. */
  x: number;
  y: number;
}

/** Mehr Felder rastert keine Fläche: eine Fläche über einer ganzen Weltkarte mit feinem Gitter wäre sonst eine Million Knoten. */
export const AREA_CELL_LIMIT = 4000;

/**
 * **Die Felder einer Form** — die, deren Mitte darin liegt (wie
 * `terrainCosts`). Gesucht wird nur im Kasten der Form; über
 * `AREA_CELL_LIMIT` hinaus `null`: dann zeichnet die Seite die Form selbst.
 */
export function areaCells(geo: GridGeometry, shape: RevealShape): AreaCell[] | null {
  const b = shapeBox(shape);
  const a = cellAt(geo, { x: b.x, y: b.y });
  const z = cellAt(geo, { x: b.x + b.w, y: b.y + b.h });
  const out: AreaCell[] = [];
  if (geo.shape === 'square') {
    const n = (z.x - a.x + 1) * (z.y - a.y + 1);
    if (n > AREA_CELL_LIMIT * 4) return null;
    for (let y = a.y; y <= z.y; y++) {
      for (let x = a.x; x <= z.x; x++) {
        if (inShape(shape, cellCentre(geo, { x, y }))) out.push({ x, y });
        if (out.length > AREA_CELL_LIMIT) return null;
      }
    }
    return out;
  }
  /* Hex (axial, spitze Seite oben): je Reihe r verschiebt sich q um r/2 —
     der Kasten ist in q also schief, und gesucht wird je Reihe um ihre
     Verschiebung. */
  const r0 = Math.min(a.y, z.y) - 1;
  const r1 = Math.max(a.y, z.y) + 1;
  const ecken = [a, z, cellAt(geo, { x: b.x + b.w, y: b.y }), cellAt(geo, { x: b.x, y: b.y + b.h })];
  const spalten = ecken.map((c) => c.x + c.y / 2);
  const c0 = Math.floor(Math.min(...spalten)) - 1;
  const c1 = Math.ceil(Math.max(...spalten)) + 1;
  if ((r1 - r0 + 1) * (c1 - c0 + 1) > AREA_CELL_LIMIT * 4) return null;
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const q = Math.round(c - r / 2);
      if (inShape(shape, cellCentre(geo, { x: q, y: r }))) out.push({ x: q, y: r });
      if (out.length > AREA_CELL_LIMIT) return null;
    }
  }
  /* Die Rundung kann ein Feld zweimal treffen. */
  const seen = new Set<string>();
  return out.filter((c) => {
    const k = `${c.x},${c.y}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Die Ecken eines Feldes, in Anteilen — Quadrat vier, Hex sechs (spitze Seite oben). */
export function cellCorners(geo: GridGeometry, c: AreaCell): Pt[] {
  if (geo.shape === 'square') {
    const x0 = (geo.ox + c.x * geo.size) / geo.w;
    const y0 = (geo.oy + c.y * geo.size) / geo.h;
    const x1 = (geo.ox + (c.x + 1) * geo.size) / geo.w;
    const y1 = (geo.oy + (c.y + 1) * geo.size) / geo.h;
    return [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x1, y: y1 },
      { x: x0, y: y1 },
    ];
  }
  const m = cellCentre(geo, c);
  const hw = geo.size / 2 / geo.w;
  const s = geo.rowHeight / 2 / geo.h;
  return [
    { x: m.x, y: m.y - s },
    { x: m.x + hw, y: m.y - s / 2 },
    { x: m.x + hw, y: m.y + s / 2 },
    { x: m.x, y: m.y + s },
    { x: m.x - hw, y: m.y + s / 2 },
    { x: m.x - hw, y: m.y - s / 2 },
  ];
}

/**
 * **Was eine Zonenart der Seite verrät** (T-219): genug, um sie zu färben
 * und zu beschriften, nicht ihr ganzer Artikel. Gelesen am Server aus
 * `ZoneKind`, an Spielende nur, wenn sie die Art sehen.
 */
export interface ZoneRuleSummary {
  moveCost?: number;
  light?: string;
  obscured?: string;
  damage?: string;
  hidden?: boolean;
}

export function zoneRuleSummary(kind: Entity | undefined): ZoneRuleSummary {
  const k = (kind?.components?.['ZoneKind'] ?? {}) as Record<string, unknown>;
  const out: ZoneRuleSummary = {};
  const cost = Number(k['moveCost']);
  if (Number.isFinite(cost) && cost > 1) out.moveCost = Math.min(10, cost);
  if (typeof k['light'] === 'string' && k['light']) out.light = k['light'];
  if (typeof k['obscured'] === 'string' && k['obscured'] && k['obscured'] !== 'none') out.obscured = k['obscured'];
  if (typeof k['damage'] === 'string' && k['damage']) out.damage = k['damage'];
  if (Number(k['hiddenUntil']) > 0) out.hidden = true;
  return out;
}

/** Ist diese Zone vor Spielenden versteckt — eine Art mit `hiddenUntil`, an dieser Stelle noch nicht gefunden? */
export function zoneHidden(r: Pick<Relation, 'type' | 'props'>, kind: Entity | undefined): boolean {
  if (r.type !== ZONE_RELATION) return false;
  return !!zoneRuleSummary(kind).hidden && (r.props as Record<string, unknown> | undefined)?.['found'] !== true;
}

/**
 * **Die Farbe einer Fläche** (T-219): eine eigene an der Kante gilt; sonst
 * sagt die Regel einer Zone, wie sie aussieht — Dunkelheit schiefergrau,
 * Schaden rot, schwieriges Gelände erdfarben wie im Zugplan, Licht gelb.
 * Ein Gebiet ohne Farbe bekommt einen Farbton aus der Id seines Herrn:
 * zwei Fraktionen nebeneinander sind dann zwei Farben, und dieselbe
 * Fraktion ist auf jeder Karte dieselbe.
 */
export function areaColor(a: Pick<MapArea, 'type' | 'to' | 'color'>, rule: ZoneRuleSummary = {}): string {
  if (a.color) return a.color;
  if (a.type === ZONE_RELATION) {
    if (rule.light === 'dark' || rule.obscured === 'heavy') return '#3b4250';
    if (rule.damage) return '#c0392b';
    if (rule.moveCost) return '#8b5a2b';
    if (rule.light === 'bright') return '#e5c04b';
    if (rule.obscured) return '#7f8c8d';
    return '#2e86ab';
  }
  let h = 0;
  for (const ch of a.to) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 55% 45%)`;
}

/** Was die Regel einer Zone in einer Zeile sagt — für den Titel über der Fläche. */
export function zoneRuleText(rule: ZoneRuleSummary): string {
  const teile: string[] = [];
  if (rule.moveCost) teile.push(rule.moveCost === 2 ? 'difficult terrain' : `movement ×${rule.moveCost}`);
  if (rule.light) teile.push(`${rule.light} light`);
  if (rule.obscured) teile.push(`${rule.obscured}ly obscured`);
  if (rule.damage) teile.push(`damage ${rule.damage}`);
  return teile.join(' · ');
}

// ----------------------------------------------------------- Ziehen (T-219)

/** Eine neue Fläche: Rechteck aus zwei Ecken oder Vieleck (eine Ellipse kommt als Vieleck, `shapeOutline`). */
export type NewAreaShape = { kind: 'rect'; x: number; y: number; w: number; h: number } | { kind: 'poly'; pts: Array<[number, number]> };

const r4 = (v: number): number => Math.round(v * 10000) / 10000;

/**
 * **Eine Fläche anlegen** (T-219): eine Kante `zone` oder `territory` an
 * der Karte (oder der Ebene, `withFloorView` gibt ihr die Ebene). Ein
 * Rechteck wird gerade gestellt, gezogen von rechts nach links wie von
 * links nach rechts.
 */
export function addArea(map: Entity, a: { id: string; type: MapArea['type']; to: EntityId; shape: NewAreaShape; color?: string }): Entity {
  const s = a.shape;
  const form: Record<string, unknown> =
    s.kind === 'rect'
      ? { kind: 'rect', x: r4(Math.min(s.x, s.x + s.w)), y: r4(Math.min(s.y, s.y + s.h)), w: r4(Math.abs(s.w)), h: r4(Math.abs(s.h)) }
      : { kind: 'poly', pts: s.pts.map(([x, y]) => [r4(x), r4(y)]) };
  const rel: Relation = { id: a.id, type: a.type, to: a.to, props: { ...form, ...(a.color ? { color: a.color } : {}) } };
  return { ...map, relations: [...(map.relations ?? []), rel] };
}

/** Die oberste Fläche an einem Punkt — die zuletzt gezeichnete liegt oben. */
export function areaAt(map: Entity, p: Pt): MapArea | null {
  const alle = mapAreas(map);
  for (let i = alle.length - 1; i >= 0; i--) if (inShape(alle[i]!.shape, p)) return alle[i]!;
  return null;
}

/** Eine Fläche wegnehmen; der Artikel, auf den sie zeigt, bleibt. */
export function removeArea(map: Entity, id: string): Entity {
  return { ...map, relations: (map.relations ?? []).filter((r) => !(r.id === id && isAreaRelation(r))) };
}

/**
 * **Eine Zone gefunden** (T-219): `found` an der Kante. Eine Zonenart mit
 * `hiddenUntil` ist dann an dieser Stelle für Spielende da — an den
 * anderen Stellen, wo dieselbe Falle liegt, nicht. Ein Gebiet ist nie
 * versteckt und bleibt, wie es ist.
 */
export function setAreaFound(map: Entity, id: string, found: boolean): Entity {
  const r = (map.relations ?? []).find((x) => x.id === id && x.type === ZONE_RELATION);
  if (!r) return map;
  const { found: _alt, ...rest } = (r.props ?? {}) as Record<string, unknown>;
  const props = found ? { ...rest, found: true } : rest;
  return { ...map, relations: (map.relations ?? []).map((x) => (x === r ? { ...x, props } : x)) };
}

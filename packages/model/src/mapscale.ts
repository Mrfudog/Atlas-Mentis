/**
 * **Gitter über den Massstab verbinden** (T-329, REQ-131) — eine Unterkarte
 * an Raster und Massstab der Karte darüber ausrichten, und Strecken über
 * Karten hinweg in eine Einheit bringen.
 *
 * **Ausrichten** ist ein Schalter an der Kante `insideMap` der Unterkarte
 * (`align: true`). Mit ihm folgt die **Grösse** des Bereichs aus beiden
 * Massstäben: eine Stadtkarte, 1 Feld = 50 ft, in einer Regionskarte,
 * 1 Hex = 1 mi, ist so breit, wie ihre Felder zusammen Fuss sind — in
 * Hexen der Regionskarte. Die **Lage** rastet am Raster der Karte darüber
 * ein: bei Quadraten die linke obere Ecke an einer Gitterecke, bei Hexen
 * die Mitte des Bereichs in der Mitte eines Hexes (eine Stadt liegt *in*
 * einem Hex, nicht auf seiner Kante).
 *
 * **Gerechnet beim Lesen** (D8): gespeichert bleiben `x`/`y`/`w`/`h` wie
 * bisher — `x`/`y` als ungefähre Lage, `w`/`h` als die freie Grösse, die
 * wieder gilt, wenn der Schalter fällt. Eine zweite, ausgerichtete Grösse
 * wird nirgends abgelegt. Ohne Schalter bleibt jede Verknüpfung, wie sie
 * war.
 *
 * Gerechnet wird in **Fuss je Bildpunkt** (`feetPerPixel`): Massstab durch
 * Feldbreite. Das braucht die Bildgrösse beider Karten (am Server aus
 * `Asset.width`/`height`, `mapNatOf`) und zwei Massstäbe mit einer
 * **Länge** — „1 day" ist eine Reisezeit und keine Strecke; dann sagt
 * `alignLink` den Grund, und die Seite sperrt den Schalter mit Hinweis.
 *
 * Alles hier ist eine reine Funktion: T-328 (Marker zwischen Kartenstufen)
 * rechnet mit derselben Umrechnung. Kein Framework, kein DOM.
 */

import type { Entity, EntityId, Relation } from './types.js';
import { gridGeometry, mapImage, mapSettings, parseScale, scaleFeet, type Frame, type MapSettings, type Size, type UnitTable } from './map.js';
import { mapLinkOf, type MapLink } from './maplinks.js';
import type { Poly } from './floors.js';
import type { Pt } from './sight.js';

/** Eine Karte, so weit das Ausrichten sie braucht: Einstellungen und Bildgrösse. */
export interface ScaledMap {
  settings: Pick<MapSettings, 'gridShape' | 'gridSize' | 'gridOffsetX' | 'gridOffsetY' | 'scale'>;
  nat: Size | null;
}

/**
 * Warum nicht ausgerichtet werden kann: `units` — ein Massstab ist keine
 * Länge („1 day") oder fehlt; `size` — die Bildgrösse einer der beiden
 * Karten ist unbekannt.
 */
export type AlignIssue = 'units' | 'size';
export const ALIGN_ISSUE_TEXT: Record<AlignIssue, string> = {
  units: 'Both maps need a scale in a length (ft, mi, m, km) — a scale like “1 day” is a travel time, not a distance.',
  size: 'The size of a map image is not known yet — upload it again or open the map once.',
};

/** Liegt der Schalter an der Kante? Nur ein ausdrückliches `true`. */
export function alignOn(rel: Relation | undefined): boolean {
  return (rel?.props as Record<string, unknown> | undefined)?.['align'] === true;
}

/** **Fuss je Bildpunkt** einer Karte — Massstab durch Feldbreite; ohne Länge `null`. */
export function feetPerPixel(s: ScaledMap['settings'], units?: UnitTable): number | null {
  const f = scaleFeet(s.scale, units);
  return f !== null && s.gridSize > 0 ? f / s.gridSize : null;
}

/** **Fuss je Einheit des Massstabs** („1 mi" → 5280, „1,5 m" → 3⅓); ohne Länge `null`. */
export function feetPerScaleUnit(scale: string, units?: UnitTable): number | null {
  const m = parseScale(scale);
  const f = scaleFeet(scale, units);
  return m && f !== null ? f / m.value : null;
}

/** Eine Strecke in Fuss, in der Einheit eines Massstabs („1 mi": 2640 ft → 0,5). */
export function feetToScaleUnit(feet: number, scale: string, units?: UnitTable): number | null {
  const f = feetPerScaleUnit(scale, units);
  return f ? feet / f : null;
}

/**
 * **Eine Strecke von einer Karte in die Einheit einer anderen** — `distance`
 * in der Einheit des Massstabs `from` („50 ft"), zurück in der von `to`
 * („1 mi"). Ohne Länge an einer Seite `null`.
 */
export function convertDistance(distance: number, from: string, to: string, units?: UnitTable): number | null {
  const a = feetPerScaleUnit(from, units);
  const b = feetPerScaleUnit(to, units);
  return a && b ? (distance * a) / b : null;
}

/**
 * **Die Grösse des Bereichs aus beiden Massstäben**, in Anteilen der Karte
 * darüber: die Unterkarte ist `nat.w · fpp(Kind)` Fuss breit, das sind
 * `/ fpp(Eltern)` Bildpunkte der Karte darüber.
 */
export function alignedSize(parent: ScaledMap, child: ScaledMap, units?: UnitTable): { w: number; h: number } | AlignIssue {
  const fp = feetPerPixel(parent.settings, units);
  const fc = feetPerPixel(child.settings, units);
  if (fp === null || fc === null) return 'units';
  const pn = parent.nat;
  const cn = child.nat;
  if (!pn || !cn || !(pn.w > 0 && pn.h > 0 && cn.w > 0 && cn.h > 0)) return 'size';
  const k = fc / fp;
  return { w: (cn.w * k) / pn.w, h: (cn.h * k) / pn.h };
}

/**
 * **Die Lage am Raster der Karte darüber** — ein Bereich der Grösse `w`×`h`,
 * der ungefähr bei `x`/`y` lag. Quadrat: die linke obere Ecke an die
 * nächste Gitterecke; Hex: die Mitte an die Mitte des nächsten Hexes;
 * ohne Gitter bleibt die Lage.
 */
export function snapToParentGrid(frame: Frame, parent: ScaledMap): Frame {
  const geo = gridGeometry(parent.settings as MapSettings, parent.nat);
  if (!geo) return frame;
  if (geo.shape === 'square') {
    const sx = (v: number) => (geo.ox + Math.round((v * geo.w - geo.ox) / geo.size) * geo.size) / geo.w;
    const sy = (v: number) => (geo.oy + Math.round((v * geo.h - geo.oy) / geo.size) * geo.size) / geo.h;
    return { ...frame, x: sx(frame.x), y: sy(frame.y) };
  }
  /* Hex, spitze Seite oben: Reihen im Abstand ¾ Hexhöhe, jede zweite um eine halbe Breite versetzt. */
  const mx = (frame.x + frame.w / 2) * geo.w - geo.ox - geo.size / 2;
  const my = (frame.y + frame.h / 2) * geo.h - geo.oy - geo.rowHeight / 2;
  const reihe = geo.rowHeight * 0.75;
  const r = Math.round(my / reihe);
  const versatz = ((r % 2) + 2) % 2 === 1 ? geo.size / 2 : 0;
  const q = Math.round((mx - versatz) / geo.size);
  const cx = geo.ox + geo.size / 2 + q * geo.size + versatz;
  const cy = geo.oy + geo.rowHeight / 2 + r * reihe;
  return { ...frame, x: cx / geo.w - frame.w / 2, y: cy / geo.h - frame.h / 2 };
}

/**
 * **Das Gitter der Unterkarte in der Karte darüber** — so zeichnet die
 * Seite beide Raster übereinander: Feldbreite und Versatz in Anteilen des
 * Bereichs (0–1 über `frame.w`).
 */
export interface ChildGrid {
  shape: 'square' | 'hex';
  /** Feldbreite als Anteil der Breite des Bereichs. */
  cell: number;
  /** Versatz als Anteil von Breite bzw. Höhe des Bereichs. */
  ox: number;
  oy: number;
}

export function childGridOf(child: ScaledMap): ChildGrid | null {
  const geo = gridGeometry(child.settings as MapSettings, child.nat);
  if (!geo) return null;
  return { shape: geo.shape, cell: geo.size / geo.w, ox: geo.ox / geo.w, oy: geo.oy / geo.h };
}

/** Ein Vieleck von einem Kasten in einen anderen — die Form bleibt, sie wird nur verschoben und gestreckt. */
function polyInto(area: Poly, from: Frame, to: Frame): Poly {
  const r = (v: number) => Math.round(v * 10000) / 10000;
  return area.map(([x, y]) => [r(to.x + ((x - from.x) / from.w) * to.w), r(to.y + ((y - from.y) / from.h) * to.h)] as [number, number]);
}

/** Eine Verknüpfung, ausgerichtet gelesen. */
export interface AlignedLink extends MapLink {
  /** Liegt der Schalter? */
  align: boolean;
  /** Ausgerichtet ist sie nur, wenn kein Grund dagegen spricht; dann gilt die freie Grösse. */
  alignIssue?: AlignIssue;
  /** Das Gitter der Unterkarte im Bereich, wenn ausgerichtet. */
  childGrid?: ChildGrid;
}

/**
 * **Die Verknüpfung, wie sie gilt** (T-329): ohne Schalter unverändert;
 * mit ihm Grösse aus den Massstäben und Lage am Raster — eine Form wird
 * mitgenommen (in den neuen Kasten gestreckt). Geht es nicht, bleibt die
 * freie Grösse und `alignIssue` sagt warum.
 */
export function alignLink(link: MapLink, rel: Relation | undefined, parent: ScaledMap, child: ScaledMap, units?: UnitTable): AlignedLink {
  if (!alignOn(rel)) return { ...link, align: false };
  const g = alignedSize(parent, child, units);
  if (typeof g === 'string') return { ...link, align: true, alignIssue: g };
  const mitte = { x: link.frame.x + link.frame.w / 2, y: link.frame.y + link.frame.h / 2 };
  const roh: Frame = { x: mitte.x - g.w / 2, y: mitte.y - g.h / 2, w: g.w, h: g.h };
  const frame = snapToParentGrid(roh, parent);
  const r = (v: number) => Math.round(v * 1e6) / 1e6;
  const fest: Frame = { x: r(frame.x), y: r(frame.y), w: r(frame.w), h: r(frame.h) };
  const cg = childGridOf(child);
  return {
    ...link,
    frame: fest,
    area: link.area ? polyInto(link.area, link.frame, fest) : null,
    align: true,
    ...(cg ? { childGrid: cg } : {}),
  };
}

/**
 * **Die Bildgrösse einer Karte aus ihrem Asset** (`Asset.width`/`height`,
 * beim Hochladen gesetzt) — so rechnet der Server, der kein Bild lädt.
 * Ohne Asset oder ohne Angabe `null`.
 */
export function mapNatOf(byId: ReadonlyMap<EntityId, Entity>, map: Entity): Size | null {
  const a = byId.get(mapImage(map))?.components?.['Asset'] as { width?: unknown; height?: unknown } | undefined;
  const w = Number(a?.width);
  const h = Number(a?.height);
  return w > 0 && h > 0 ? { w, h } : null;
}

/** Eine Karte aus dem Bestand als `ScaledMap` — ihr erstes Stockwerk, die Bildgrösse vom Asset. */
export function scaledMapOf(byId: ReadonlyMap<EntityId, Entity>, map: Entity): ScaledMap {
  return { settings: mapSettings(map), nat: mapNatOf(byId, map) };
}

/**
 * **Die Verknüpfung einer Unterkarte, wie sie gilt** — gelesen und
 * ausgerichtet, aus dem Bestand: `parent` ist die Karte, auf die die Kante
 * zeigt (oder, bei einer Karte im Spiel, die Instanz an ihrer Stelle).
 */
export function effectiveMapLink(
  byId: ReadonlyMap<EntityId, Entity>,
  child: Entity,
  rel: Relation | undefined,
  parent: Entity | undefined,
  units?: UnitTable,
): AlignedLink | null {
  const link = mapLinkOf(rel);
  if (!link) return null;
  if (!parent || !alignOn(rel)) return { ...link, align: alignOn(rel) };
  return alignLink(link, rel, scaledMapOf(byId, parent), scaledMapOf(byId, child), units);
}

// ---------------------------------------------------------- Strecken

/**
 * **Ein Stück eines Weges** auf einer Karte: die Punkte in Anteilen der
 * Karte, mit ihren Einstellungen und ihrer Bildgrösse.
 */
export interface RouteLeg extends ScaledMap {
  points: readonly Pt[];
}

/** Die Länge eines Stücks in Fuss, gerade von Punkt zu Punkt; ohne Länge im Massstab `null`. */
export function legFeet(leg: RouteLeg, units?: UnitTable): number | null {
  const f = feetPerPixel(leg.settings, units);
  const n = leg.nat;
  if (f === null || !n || !(n.w > 0 && n.h > 0)) return null;
  let px = 0;
  for (let i = 1; i < leg.points.length; i++) {
    const a = leg.points[i - 1]!;
    const b = leg.points[i]!;
    px += Math.hypot((b.x - a.x) * n.w, (b.y - a.y) * n.h);
  }
  return px * f;
}

/**
 * **Die Gesamtstrecke eines Weges über mehrere Karten** (T-329, Grundlage
 * für Reisen, T-177): jedes Stück in Fuss, zusammengezählt. Ein Stück ohne
 * Länge im Massstab zählt nicht und wird in `skipped` genannt — eine
 * stille 0 sähe aus wie ein kurzer Weg.
 */
export function routeFeet(legs: readonly RouteLeg[], units?: UnitTable): { feet: number; skipped: number[] } {
  let feet = 0;
  const skipped: number[] = [];
  legs.forEach((l, i) => {
    const f = legFeet(l, units);
    if (f === null) skipped.push(i);
    else feet += f;
  });
  return { feet, skipped };
}

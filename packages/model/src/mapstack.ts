/**
 * **Marker und Tokens zwischen Kartenstufen** (T-328, REQ-131): was auf
 * einer Unterkarte steht, zeigt die Karte darüber mit; was auf der Karte
 * darüber in den Bereich einer Unterkarte gesetzt wird, ist dort ein
 * Vorschlag zum Platzieren.
 *
 * - **Tief → hoch, gelesen und nicht kopiert** (D8, Kanten nur vorwärts):
 *   die Marker der Unterkarte werden mit ihrer Verknüpfung
 *   (`effectiveMapLink`, T-327/T-329) auf die Karte darüber gehoben
 *   (`liftPoint`). Gespeichert wird nichts davon. Sind es mehr als
 *   `LIFT_SINGLES`, steht an ihrer Stelle ein Bündel mit Zahl in der Mitte
 *   des Bereichs — ein Dorf voller Händler ist auf der Regionskarte ein
 *   Punkt.
 * - **Hoch → tief, als Vorschlag:** ein Marker der Karte darüber im
 *   Bereich einer Unterkarte bleibt, wo er steht — **das ist der
 *   gespeicherte Vorschlag**; die Unterkarte rechnet daraus beim Lesen die
 *   Liste „To place" mit der umgerechneten Lage (`lowerPoint`). Erst wenn
 *   die Leitung bestätigt (an dieser Lage oder verschoben), **wandert** der
 *   Marker hinunter: die Kante an der Karte darüber geht weg, eine an der
 *   Unterkarte kommt (`confirmPlacement`) — so gibt es ihn einmal, und die
 *   Karte darüber zeigt ihn wieder, gehoben. „Keep here" (`props.stay`)
 *   sagt, dass er oben gemeint ist; dann schlägt ihn keine Unterkarte vor.
 *
 * Gehoben und vorgeschlagen werden Marker für Orte, Personen und Dinge
 * (`static`, `quest`) und Spiel-Tokens (`play`). Nicht: das Gruppen-Token
 * (es steht schon über `partyPosition` auf jeder Stufe), Assets, Übergänge
 * und freie Lichter — die gehören zum Bild ihrer Karte.
 *
 * Gehoben und vorgeschlagen wird auf der **ersten Ebene** beider Karten
 * (T-307): ein Keller liegt nicht auf der Regionskarte.
 *
 * Eine Stufe weit: gehoben wird von der Unterkarte, nicht von deren
 * Unterkarten — sonst stünde auf der Weltkarte jede Kiste jedes Kellers.
 *
 * Gesiebt wird am Server, nicht hier: die Unterkarte kommt so, wie der
 * Betrachter sie bekommt (`redactMap`: Nebel, Freigabe, `hidden`,
 * Sichtbarkeit des Ziels), und ein gehobener Punkt unter dem Nebel der
 * Karte darüber fällt ebenso weg (`isRevealed`).
 */

import type { Entity, EntityId, Relation } from './types.js';
import { MARKER_RELATION, liftPoint, lowerPoint, markersOf, type MapMarker, type MarkerKind } from './map.js';
import { inMapLink, linkCentre, type MapLink } from './maplinks.js';
import type { Pt } from './sight.js';
import { GROUND_FLOOR, floorView } from './floors.js';

/** Was zwischen Kartenstufen wandert: Orte, Aufträge und Spiel-Tokens. */
export const LIFT_KINDS: readonly MarkerKind[] = ['static', 'quest', 'play'];

/** So viele gehobene Marker stehen einzeln; mehr werden ein Bündel mit Zahl. */
export const LIFT_SINGLES = 6;

/** Wandert dieser Marker zwischen Kartenstufen? */
export function liftable(m: Pick<MapMarker, 'kind'>): boolean {
  return LIFT_KINDS.includes(m.kind);
}

/** Bleibt der Marker auf seiner Karte (`props.stay`, „Keep here")? */
export function stays(rel: Relation): boolean {
  return (rel.props as Record<string, unknown> | undefined)?.['stay'] === true;
}

/** Ein Marker der Unterkarte, auf der Karte darüber. */
export interface LiftedMarker {
  /** Die Kante an der Unterkarte. */
  rel: string;
  to: EntityId;
  kind: MarkerKind;
  /** Die Lage in Anteilen der Karte darüber. */
  x: number;
  y: number;
}

/** Die gehobenen Marker einer Unterkarte — einzeln, oder als Bündel. */
export interface LiftedGroup {
  /** Die Unterkarte (bei einer Karte im Spiel die Instanz, in die man zoomt). */
  map: EntityId;
  items: LiftedMarker[];
  /** Die Mitte des Bereichs — dort steht das Bündel. */
  centre: Pt;
  /** Mehr als `LIFT_SINGLES`: ein Punkt mit Zahl (`items.length`) statt der einzelnen. */
  bundled: boolean;
}

/**
 * **Die Marker einer Unterkarte auf der Karte darüber** (tief → hoch).
 * `skip` nennt Ziele, die auf der Karte darüber schon selbst einen Marker
 * haben — die stünden sonst zweimal da. Ohne gehobene Marker `null`.
 */
export function liftMarkers(
  child: Entity,
  link: Pick<MapLink, 'frame' | 'area'>,
  opts: { skip?: ReadonlySet<EntityId> } = {},
): LiftedGroup | null {
  const items = markersOf(floorView(child, GROUND_FLOOR))
    .filter((m) => liftable(m) && m.to !== child.id && !opts.skip?.has(m.to))
    .map((m) => {
      const p = liftPoint(m, link.frame);
      return { rel: m.rel.id, to: m.to, kind: m.kind, x: r6(p.x), y: r6(p.y) };
    });
  const c = linkCentre(link);
  return keepLifted({ map: child.id, items, centre: { x: r6(c.x), y: r6(c.y) }, bundled: false }, () => true);
}

/**
 * **Gehobene Marker nachsieben** — was der Server danach weglässt (unter
 * dem Nebel dieser Karte, ein Ziel, das der Betrachter nicht sieht); das
 * Bündel zählt, was bleibt. Bleibt nichts, `null`.
 */
export function keepLifted(g: LiftedGroup, keep: (m: LiftedMarker) => boolean, singles = LIFT_SINGLES): LiftedGroup | null {
  const items = g.items.filter(keep);
  return items.length ? { ...g, items, bundled: items.length > singles } : null;
}

/** Ein offener Vorschlag an der Unterkarte (hoch → tief). */
export interface PlacementSuggestion {
  /** Die Kante an der Karte darüber — sie ist der gespeicherte Vorschlag. */
  rel: string;
  /** Die Karte darüber. */
  from: EntityId;
  to: EntityId;
  kind: MarkerKind;
  /** Die vorgeschlagene Lage in Anteilen der Unterkarte. */
  x: number;
  y: number;
}

/**
 * **Die Liste „To place" einer Unterkarte**: die Marker der Karte darüber
 * im Bereich der Verknüpfung, umgerechnet. Nicht vorgeschlagen wird, was
 * oben bleiben soll (`stay`) und was auf der Unterkarte schon steht.
 */
export function placementSuggestions(parent: Entity, link: Pick<MapLink, 'frame' | 'area'>, child: Entity): PlacementSuggestion[] {
  const schonDa = new Set(markersOf(child).map((m) => m.to));
  return markersOf(floorView(parent, GROUND_FLOOR))
    .filter((m) => liftable(m) && !stays(m.rel) && m.to !== child.id && !schonDa.has(m.to) && inMapLink(link, m))
    .map((m) => {
      const p = lowerPoint(m, link.frame);
      return { rel: m.rel.id, from: parent.id, to: m.to, kind: m.kind, x: r4(zwischen(p.x)), y: r4(zwischen(p.y)) };
    });
}

/**
 * **Einen Vorschlag bestätigen**: der Marker wandert von der Karte darüber
 * an die Unterkarte, an die Lage `at` (die vorgeschlagene oder eine
 * verschobene). Was die Kante sonst trägt (Art, Grösse, Notiz,
 * `hidden`), geht mit; `stay` nicht. Steht die Kante oben nicht (mehr),
 * bleiben beide Karten, wie sie sind.
 */
export function confirmPlacement(parent: Entity, child: Entity, relId: string, at: Pt, id: string): { parent: Entity; child: Entity } {
  const rel = (parent.relations ?? []).find((r) => r.id === relId && r.type === MARKER_RELATION);
  if (!rel) return { parent, child };
  const { stay: _s, x: _x, y: _y, floor: _f, ...rest } = (rel.props ?? {}) as Record<string, unknown>;
  const neu: Relation = { id, type: MARKER_RELATION, to: rel.to, props: { ...rest, x: r4(zwischen(at.x)), y: r4(zwischen(at.y)) } };
  return {
    parent: { ...parent, relations: (parent.relations ?? []).filter((r) => r.id !== relId) },
    child: { ...child, relations: [...(child.relations ?? []), neu] },
  };
}

/** **„Keep here"**: der Marker ist auf der Karte darüber gemeint; keine Unterkarte schlägt ihn mehr vor. */
export function keepOnMap(map: Entity, relId: string, keep = true): Entity {
  return {
    ...map,
    relations: (map.relations ?? []).map((r) => {
      if (r.id !== relId || r.type !== MARKER_RELATION) return r;
      const { stay: _s, ...rest } = (r.props ?? {}) as Record<string, unknown>;
      return { ...r, props: keep ? { ...rest, stay: true } : rest };
    }),
  };
}

const zwischen = (v: number) => Math.min(1, Math.max(0, v));
const r4 = (v: number) => Math.round(v * 10000) / 10000;
const r6 = (v: number) => Math.round(v * 1e6) / 1e6;

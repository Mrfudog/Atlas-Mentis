/**
 * **Kartenverknüpfungen** (T-327, REQ-131): wie eine Unterkarte in der
 * Karte darüber liegt, wann man hineinzoomt, wie die Verknüpfung
 * gezeichnet wird, und was die Unterkarte von der Karte darüber zeigt.
 *
 * Alles steht an der Kante `insideMap` der Unterkarte (Kanten nur
 * vorwärts) — `x`, `y`, `w`, `h` wie bisher, dazu:
 *
 * - `area`: ein Vieleck in Anteilen der Karte darüber (`[[x, y], …]`, wie
 *   die Fläche eines Übergangs, T-326). Ohne `area` ist der Bereich das
 *   Rechteck. **Das Rechteck bleibt der Kasten** des Vielecks: auf ihn
 *   wird das Bild der Unterkarte gelegt, mit ihm wird gerechnet
 *   (`liftPoint`, `frameShare`) — die Form sagt nur, wo die Verknüpfung
 *   gezeichnet wird und wo ein Klick sie trifft.
 * - `near`: ab welchem Anteil des Blicks der nächste Zoomschritt
 *   hineinführt; ohne Angabe `MAP_NEAR` (0,55) wie bisher.
 * - `show` / `showPlayers`: wie die Leitung bzw. die Spielenden die
 *   Verknüpfung sehen; ohne Angabe die Vorgabe der Kampagne
 *   (`Campaign.mapLinkShow`, `mapLinkShowPlayers`), sonst `jump` wie bisher.
 * - `outer`: ob die Unterkarte ausserhalb ihres Bereichs die Karte
 *   darüber blass zeigt; ohne Angabe die Kampagne (`Campaign.mapLinkOuter`),
 *   sonst nicht — bestehende Verknüpfungen bleiben, wie sie waren.
 *
 * Gerechnet wird beim Lesen (D8): die Lage der Karte darüber in der
 * Unterkarte folgt aus dem Kasten, nichts davon wird gespeichert.
 */

import type { Entity, Relation } from './types.js';
import { MAP_NEAR, frameOf, type Frame } from './map.js';
import { inPoly, polyBox, polyOf, type Poly } from './floors.js';
import type { Pt } from './sight.js';

/**
 * **Wie eine Verknüpfung gezeichnet wird.**
 * `jump`: Rahmen mit Namen, ein Klick springt hinein (wie bis T-327).
 * `frame`: nur die Umrandung, ohne Klick — hinein geht es mit Zoomen.
 * `icon`: ein Symbol in der Mitte, ein Klick springt hinein.
 * `hidden`: nichts zu sehen — nur Zoomen führt hinein.
 */
export type MapLinkShow = 'jump' | 'frame' | 'icon' | 'hidden';
export const MAP_LINK_SHOWS: readonly MapLinkShow[] = ['jump', 'frame', 'icon', 'hidden'];
export const MAP_LINK_SHOW_LABELS: Record<MapLinkShow, string> = {
  jump: 'Click to jump',
  frame: 'Frame only',
  icon: 'Icon',
  hidden: 'Hidden (zoom only)',
};

/** Die Karte darüber als Rand: `faded` blass zeigen, `none` nicht. */
export type MapLinkOuter = 'faded' | 'none';
export const MAP_LINK_OUTERS: readonly MapLinkOuter[] = ['faded', 'none'];

/** Die Grenzen der Zoomtiefe: ein Zehntel des Blicks bis der ganze. */
export const LINK_NEAR_MIN = 0.1;
export const LINK_NEAR_MAX = 1;

/** Eine Verknüpfung, gelesen — der Kasten, die Form, und was sie selbst sagt. */
export interface MapLink {
  frame: Frame;
  /** Das Vieleck des Bereichs; ohne `null`, dann ist es der Kasten. */
  area: Poly | null;
  /** Die Zoomtiefe, die gilt (eigene Angabe, sonst `MAP_NEAR`). */
  near: number;
  /** Was die Kante selbst sagt — ohne Angabe gilt die Kampagne. */
  own: { near?: number; show?: MapLinkShow; showPlayers?: MapLinkShow; outer?: MapLinkOuter };
}

const wahl = <T extends string>(werte: readonly T[], v: unknown): T | undefined =>
  typeof v === 'string' && (werte as readonly string[]).includes(v) ? (v as T) : undefined;

/** Eine Zoomtiefe in den Grenzen; Unsinn heisst keine Angabe. */
export function linkNearOf(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v.replace(',', '.')) : NaN;
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.min(LINK_NEAR_MAX, Math.max(LINK_NEAR_MIN, n));
}

/**
 * **Die Verknüpfung an einer `insideMap`-Kante.** Mit `area` ist der
 * Kasten der des Vielecks — auch wenn `x`/`y`/`w`/`h` etwas anderes sagen,
 * denn die Form ist das, was die Leitung gezeichnet hat. Ohne Rahmen und
 * ohne Form keine.
 */
export function mapLinkOf(rel: Relation | undefined): MapLink | null {
  const p = (rel?.props ?? {}) as Record<string, unknown>;
  const area = polyOf(p['area']);
  let frame: Frame | null;
  if (area) {
    const b = polyBox(area);
    const r = (v: number) => Math.round(v * 10000) / 10000;
    frame = b.w > 0 && b.h > 0 ? { x: r(b.x), y: r(b.y), w: r(b.w), h: r(b.h) } : null;
  } else frame = frameOf(rel);
  if (!frame) return null;
  const own: MapLink['own'] = {};
  const near = linkNearOf(p['near']);
  if (near !== undefined) own.near = near;
  const show = wahl(MAP_LINK_SHOWS, p['show']);
  if (show) own.show = show;
  const showPlayers = wahl(MAP_LINK_SHOWS, p['showPlayers']);
  if (showPlayers) own.showPlayers = showPlayers;
  const outer = wahl(MAP_LINK_OUTERS, p['outer']);
  if (outer) own.outer = outer;
  return { frame, area: area ?? null, near: near ?? MAP_NEAR, own };
}

/** Die Vorgaben der Kampagne für Verknüpfungen. */
export interface MapLinkDefaults {
  show: MapLinkShow;
  showPlayers: MapLinkShow;
  outer: MapLinkOuter;
}

/** Die Vorgabe der Kampagne; ohne Angabe, was vor T-327 galt: Rahmen mit Klick, kein Rand. */
export function mapLinkDefaultsOf(campaign: Entity | null | undefined): MapLinkDefaults {
  const k = (campaign?.components?.['Campaign'] ?? {}) as Record<string, unknown>;
  return {
    show: wahl(MAP_LINK_SHOWS, k['mapLinkShow']) ?? 'jump',
    showPlayers: wahl(MAP_LINK_SHOWS, k['mapLinkShowPlayers']) ?? 'jump',
    outer: wahl(MAP_LINK_OUTERS, k['mapLinkOuter']) ?? 'none',
  };
}

/** **Was ein Betrachter von der Verknüpfung sieht** — die Leitung und die Spielenden getrennt. */
export function linkShowFor(link: Pick<MapLink, 'own'>, defaults: MapLinkDefaults, gm: boolean): MapLinkShow {
  return gm ? (link.own.show ?? defaults.show) : (link.own.showPlayers ?? defaults.showPlayers);
}

/** Zeigt die Unterkarte die Karte darüber als Rand? */
export function linkOuterOn(link: Pick<MapLink, 'own'>, defaults: MapLinkDefaults): boolean {
  return (link.own.outer ?? defaults.outer) === 'faded';
}

/** Liegt ein Punkt der Karte darüber im Bereich der Verknüpfung? */
export function inMapLink(link: Pick<MapLink, 'frame' | 'area'>, p: Pt): boolean {
  if (link.area) return inPoly(link.area, p);
  const f = link.frame;
  return p.x >= f.x && p.x <= f.x + f.w && p.y >= f.y && p.y <= f.y + f.h;
}

/** Der Schwerpunkt der Ecken — wo das Symbol einer Verknüpfung als Marker steht. */
export function linkCentre(link: Pick<MapLink, 'frame' | 'area'>): Pt {
  const a = link.area;
  if (!a?.length) return { x: link.frame.x + link.frame.w / 2, y: link.frame.y + link.frame.h / 2 };
  const m = { x: a.reduce((s, c) => s + c[0], 0) / a.length, y: a.reduce((s, c) => s + c[1], 0) / a.length };
  /* Bei einer hohlen Form kann der Schwerpunkt draussen liegen; dann die Mitte des Kastens. */
  return inPoly(a, m) ? m : { x: link.frame.x + link.frame.w / 2, y: link.frame.y + link.frame.h / 2 };
}

/**
 * **Die Form im Kasten**, in Anteilen des Kastens (0–1) — so zeichnet die
 * Seite sie in den Rahmen, ohne ihn neu zu rechnen.
 */
export function areaInFrame(link: Pick<MapLink, 'frame' | 'area'>): Poly | null {
  const a = link.area;
  if (!a) return null;
  const f = link.frame;
  return a.map(([x, y]) => [(x - f.x) / f.w, (y - f.y) / f.h] as [number, number]);
}

/**
 * **Die Lage der Karte darüber in der Unterkarte** (T-327), in Anteilen der
 * Unterkarte: das Bild der Unterkarte füllt den Kasten, also steht die
 * Karte darüber um `1/w` grösser und um `x/w` nach links verschoben. Die
 * Seite legt damit das Bild der Karte darüber blass hinter die Unterkarte.
 */
export function outerPlacement(frame: Frame): Frame {
  return { x: -frame.x / frame.w, y: -frame.y / frame.h, w: 1 / frame.w, h: 1 / frame.h };
}

/**
 * **Wohin es von einer Karte aus geht** — die Pfeile am Rand. Heute nur
 * hinaus zur Karte darüber; eine Nachbarkarte (E-121) kommt als
 * `kind: 'neighbour'` mit der Seite dazu, an der sie anschliesst.
 */
export type MapExitSide = 'n' | 'e' | 's' | 'w';
export interface MapExit {
  kind: 'parent' | 'neighbour';
  id: string;
  name: string;
  /** Bei einer Nachbarkarte die Seite; die Karte darüber hat keine. */
  side?: MapExitSide;
}

/**
 * Die Ausgänge einer Karte für diesen Betrachter: nur, wo es ein Ziel gibt
 * und er es sehen darf — die Liste der Karten darüber hat der Server schon
 * gesiebt (Freigabe, `mapNavigation`).
 */
export function mapExits(parents: readonly { id: string; name: string }[]): MapExit[] {
  const oben = parents.at(-1);
  return oben ? [{ kind: 'parent', id: oben.id, name: oben.name }] : [];
}

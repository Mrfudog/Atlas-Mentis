/**
 * Boards (REQ-111, 157 bis 166, 205) — eine Leinwand, auf der Artikel frei
 * liegen.
 *
 * **Was darauf liegt, sind Kanten** (`placed`, Board → Artikel) mit Ort,
 * Grösse, Ebene und — wenn sie will — der Ansicht. Damit beantwortet „wo
 * liegt dieser NSC überall?" derselbe Rückbezug wie überall sonst. Wozu
 * ein Board gehört, sagt `partOf` auf einen Geschichtsartikel (REQ-205);
 * ohne die Kante ist es ein Regel-Board.
 *
 * Hier stehen nur die Fragen, die Prototyp und Oberfläche gleich
 * beantworten müssen: welche Ansicht eine Kachel zeichnet, wohin eine neue
 * Karte kommt, wie ein Zug am Raster einrastet. Gezeichnet wird anderswo.
 */

import { typeChain } from './entity.js';
import type { Entity, Registry, Relation } from './types.js';

export const BOARD_TYPE = 'Board';
export const PLACED_RELATION = 'placed';

/** Die Vorgaben stehen an der Kante im Register; das hier ist ihr Rückfall. */
export const PLACEMENT_DEFAULTS = { w: 260, h: 180 } as const;
/** Kleiner wird eine Kachel nicht — darunter liest man nicht einmal den Namen. */
export const PLACEMENT_MIN = { w: 120, h: 60 } as const;

/**
 * Bis zu dieser Höhe (in px auf der Leinwand) ist eine Kachel eine Zeile:
 * Name und ein Satz, also `overview`. Darüber hat sie Platz für eine Karte.
 */
export const OVERVIEW_MAX_HEIGHT = 110;

export interface BoardPlacement {
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  view?: string;
  locked?: boolean;
  note?: string;
}

export interface BoardCard {
  width: number;
  height: number;
  snap: number;
  rules: Record<string, string>;
}

function zahl(v: unknown, sonst: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : sonst;
}

/** Die Karte `Board` mit ihren Vorgaben (`BoardInfo`). */
export function boardCard(board: Entity): BoardCard {
  const c = (board.components?.[BOARD_TYPE] ?? {}) as Record<string, unknown>;
  const rules = c['rules'];
  return {
    width: Math.max(400, zahl(c['width'], 2400)),
    height: Math.max(300, zahl(c['height'], 1500)),
    snap: Math.max(1, zahl(c['snap'], 10)),
    rules:
      rules && typeof rules === 'object' && !Array.isArray(rules)
        ? (rules as Record<string, string>)
        : {},
  };
}

/** Die Platzierung einer Kante, mit den Vorgaben für das, was fehlt. */
export function placementOf(rel: Relation): BoardPlacement {
  const p = (rel.props ?? {}) as Record<string, unknown>;
  const out: BoardPlacement = {
    x: zahl(p['x'], 0),
    y: zahl(p['y'], 0),
    w: zahl(p['w'], PLACEMENT_DEFAULTS.w),
    h: zahl(p['h'], PLACEMENT_DEFAULTS.h),
    z: zahl(p['z'], 0),
  };
  if (typeof p['view'] === 'string' && p['view']) out.view = p['view'];
  if (p['locked'] === true) out.locked = true;
  if (typeof p['note'] === 'string' && p['note']) out.note = p['note'];
  return out;
}

/** Was auf dem Board liegt, von unten nach oben (`z`, dann Reihenfolge). */
export function placementsOf(board: Entity): Relation[] {
  return (board.relations ?? [])
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.type === PLACED_RELATION)
    .sort((a, b) => placementOf(a.r).z - placementOf(b.r).z || a.i - b.i)
    .map(({ r }) => r);
}

/**
 * Welche Ansicht zeichnet diese Kachel (REQ-161)?
 *
 * Erst die Platzierung (*dieser* Statblock hier voll), dann die Regel des
 * Boards je Art, die `extends`-Kette hoch — und sagt keiner etwas, **wählt
 * die Grösse der Kachel** (CLAUDE.md, „Drei Ansichten"): eine flache Kachel
 * ist eine Zeile und zeigt `overview`, eine höhere ist eine Karte und zeigt
 * `quick`. Wer die Kachel grösser zieht, bekommt die Karte, ohne irgendwo
 * etwas auszuwählen.
 */
export function placementView(
  registry: Pick<Registry, 'interfaces' | 'views'>,
  board: Entity,
  rel: Relation,
  targetType: string,
): string {
  const p = placementOf(rel);
  if (p.view && registry.views[p.view]) return p.view;
  const rules = boardCard(board).rules;
  for (const t of typeChain(registry, targetType)) {
    const v = rules[t];
    if (v && registry.views[v]) return v;
  }
  return viewForSize(registry, p.h);
}

/** Die Ansicht, die eine Kachel dieser Höhe von sich aus zeigt. */
export function viewForSize(registry: Pick<Registry, 'views'>, height: number): string {
  if (height <= OVERVIEW_MAX_HEIGHT && registry.views['overview']) return 'overview';
  if (registry.views['quick']) return 'quick';
  return Object.keys(registry.views)[0] ?? 'quick';
}

/** Auf das Raster des Boards, nie links oder oberhalb der Leinwand. */
export function snapTo(value: number, snap: number, min = 0): number {
  const s = Math.max(1, snap);
  return Math.max(min, Math.round(value / s) * s);
}

/**
 * Wohin eine neue Karte kommt: in die erste freie Zelle eines Rasters aus
 * Kachelgrössen, Zeile für Zeile — nicht auf eine schon liegende. `sichtbar`
 * ist die Breite, die man gerade sieht (in px der Leinwand): eine neue Karte
 * rechts ausserhalb des Schirms ist eine, die man nicht hingelegt zu haben
 * glaubt.
 */
export function nextPlacement(
  board: Entity,
  w: number = PLACEMENT_DEFAULTS.w,
  h: number = PLACEMENT_DEFAULTS.h,
  sichtbar?: number,
): BoardPlacement {
  const liegt = placementsOf(board).map(placementOf);
  const width = Math.min(boardCard(board).width, sichtbar ?? Infinity);
  const rand = 40;
  const spalten = Math.max(1, Math.floor((width - rand) / (w + 20)));
  const frei = (x: number, y: number) =>
    !liegt.some((p) => x < p.x + p.w && p.x < x + w && y < p.y + p.h && p.y < y + h);
  const z = liegt.reduce((m, p) => Math.max(m, p.z), -1) + 1;
  for (let i = 0; i < 500; i++) {
    const x = rand + (i % spalten) * (w + 20);
    const y = rand + Math.floor(i / spalten) * (h + 20);
    if (frei(x, y)) return { x, y, w, h, z };
  }
  return { x: rand, y: rand, w, h, z };
}

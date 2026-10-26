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
  /** Nur für die Leitung (T-339): die Kachel geht an Spielende nicht hinaus (`redactBoard`). */
  hidden?: boolean;
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

/** Eine verkleinerte Tafel (T-425): die Fläche und je Kachel ein Rechteck mit Namen. */
export interface BoardSketch {
  width: number;
  height: number;
  background?: string;
  cards: { id: string; x: number; y: number; w: number; h: number; name: string }[];
}

/**
 * **Die Skizze eines Boards** für seine Kurzansicht (T-425): die Fläche,
 * ihre Farbe und was darauf liegt, von unten nach oben — was über den Rand
 * ragt, vergrössert die Fläche. Gezeichnet wird klein, also keine Inhalte,
 * nur Lage und Name; was für Spielende verborgen ist, hat der Server schon
 * weggenommen (`redactBoard`).
 */
export function boardSketch(board: Entity, name: (id: string) => string | undefined): BoardSketch {
  const karte = boardCard(board);
  const c = (board.components?.[BOARD_TYPE] ?? {}) as Record<string, unknown>;
  const cards = placementsOf(board).map((r) => {
    const p = placementOf(r);
    return { id: r.to, x: p.x, y: p.y, w: p.w, h: p.h, name: name(r.to) ?? '' };
  });
  const width = Math.max(karte.width, ...cards.map((k) => k.x + k.w));
  const height = Math.max(karte.height, ...cards.map((k) => k.y + k.h));
  const farbe = c['backgroundColor'];
  return { width, height, ...(typeof farbe === 'string' && farbe ? { background: farbe } : {}), cards };
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
  if (p['hidden'] === true) out.hidden = true;
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
 *
 * **Für Spielende ist die Vorgabe der Handzettel** (T-339, E-123 a): wer
 * nicht leitet, bekommt auf einer Kachel ohne eigene Wahl `handout`, wo es
 * ihn gibt — keine eigene Stufe „board“, sondern die Ansicht, die für den
 * Tisch gemacht ist. Gewählt wird je Kachel weiter jede Ansicht, auch `full`
 * und eine gestaltete; was die Leitung wählt, gilt für alle.
 */
export function placementView(
  registry: Pick<Registry, 'interfaces' | 'views'>,
  board: Entity,
  rel: Relation,
  targetType: string,
  opts: { player?: boolean } = {},
): string {
  const p = placementOf(rel);
  if (p.view && registry.views[p.view]) return p.view;
  const rules = boardCard(board).rules;
  for (const t of typeChain(registry, targetType)) {
    const v = rules[t];
    if (v && registry.views[v]) return v;
  }
  if (opts.player && p.h > OVERVIEW_MAX_HEIGHT && registry.views['handout']) return 'handout';
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

/**
 * Ein Anker (REQ-159, T-073): eine benannte Stelle auf der Leinwand. Mit
 * Breite und Höhe ist er ein **Bereich** — ein Rechteck, zu dem man über
 * einen Reiter springt und das man einklappen kann. Ohne sie bleibt er ein
 * Punkt, wie der Prototyp ihn anlegt (`x`, `y`, `zoom`).
 *
 * Bereich ist kein neues Feld: `Board.anchors` gab es schon, und ein
 * Bereich ist ein Anker, der seine Grösse kennt. Eine Form mit Namen
 * (`shapes`) wäre Zeichnung — sie springt nirgends hin.
 */
export interface BoardAnchor {
  id: string;
  name: string;
  x: number;
  y: number;
  /** Nur ein Bereich hat sie. */
  w?: number;
  h?: number;
  zoom?: number;
}

/** Ein Bereich unter dieser Grösse ist ein Versehen beim Ziehen, kein Rechteck. */
export const AREA_MIN = { w: 80, h: 40 } as const;

/** Die Anker eines Boards, wie sie gespeichert sind — unbrauchbare fallen weg. */
export function anchorsOf(board: Entity): BoardAnchor[] {
  const c = (board.components?.[BOARD_TYPE] ?? {}) as Record<string, unknown>;
  const roh = Array.isArray(c['anchors']) ? (c['anchors'] as unknown[]) : [];
  const out: BoardAnchor[] = [];
  for (const a of roh) {
    if (!a || typeof a !== 'object') continue;
    const o = a as Record<string, unknown>;
    if (typeof o['id'] !== 'string' || !o['id']) continue;
    const anker: BoardAnchor = {
      id: o['id'],
      name: typeof o['name'] === 'string' && o['name'].trim() ? o['name'] : o['id'],
      x: zahl(o['x'], 0),
      y: zahl(o['y'], 0),
    };
    const w = zahl(o['w'], 0);
    const h = zahl(o['h'], 0);
    if (w > 0 && h > 0) {
      anker.w = w;
      anker.h = h;
    }
    if (typeof o['zoom'] === 'number' && o['zoom'] > 0) anker.zoom = o['zoom'];
    out.push(anker);
  }
  return out;
}

/** Ist dieser Anker ein Bereich (hat er ein Rechteck)? */
export function isArea(a: BoardAnchor): a is BoardAnchor & { w: number; h: number } {
  return (a.w ?? 0) > 0 && (a.h ?? 0) > 0;
}

/**
 * Gehört eine Karte zu einem Bereich? **Die Lage entscheidet** (T-073):
 * ihre Mitte liegt im Rechteck. Eine Kante dafür gäbe es zweimal — einmal
 * gespeichert und einmal so, wie es aussieht —, und beim ersten Verschieben
 * stimmte eins davon nicht mehr. Liegt die Mitte in mehreren, gehört sie zum
 * kleinsten: das ist der, den man darübergelegt hat.
 */
export function anchorAreaOf(anchors: readonly BoardAnchor[], p: BoardPlacement): string | null {
  const mx = p.x + p.w / 2;
  const my = p.y + p.h / 2;
  let best: BoardAnchor | null = null;
  for (const a of anchors) {
    if (!isArea(a)) continue;
    if (mx < a.x || mx > a.x + a.w || my < a.y || my > a.y + a.h) continue;
    if (!best || a.w * a.h < (best.w ?? 0) * (best.h ?? 0)) best = a;
  }
  return best?.id ?? null;
}

/**
 * Das Board mit diesen Ankern. Was an einem gespeicherten Anker sonst noch
 * steht (ein Feld, das der Prototyp kennt und die Seite nicht), bleibt.
 */
export function withAnchors(board: Entity, anchors: readonly BoardAnchor[]): Entity {
  const c = (board.components?.[BOARD_TYPE] ?? {}) as Record<string, unknown>;
  const alt = new Map<string, Record<string, unknown>>();
  for (const a of Array.isArray(c['anchors']) ? (c['anchors'] as unknown[]) : []) {
    if (a && typeof a === 'object' && typeof (a as { id?: unknown }).id === 'string') {
      alt.set((a as { id: string }).id, a as Record<string, unknown>);
    }
  }
  const neu = anchors.map((a) => {
    const o: Record<string, unknown> = { ...(alt.get(a.id) ?? {}), ...a };
    if (!isArea(a)) {
      delete o['w'];
      delete o['h'];
    }
    return o;
  });
  return {
    ...board,
    components: { ...board.components, [BOARD_TYPE]: { ...c, anchors: neu } },
  };
}

// ------------------------------------------------- Formen auf dem Board (T-339)

/**
 * **Was auf dem Board liegt und kein Artikel ist** (T-339): Text, Bild und
 * Zeichnung. Sie stehen in `Board.shapes` am Board selbst — sie gehören
 * keinem anderen Artikel, springen nirgends hin und haben keine
 * Gegenrichtung. Ein Artikel auf dem Board bleibt eine Kante (`placed`).
 *
 * **Ein Text ist Markdown** (M10) mit `[[Verweisen]]` und `{VAR}` wie
 * überall: gespeichert wird die Vorlage, eingesetzt wird beim Zeichnen
 * (`inline.ts`). Überschrift, Absatz, Liste und Zitat sind Markdown und
 * kein eigenes Feld — `# ` macht die Überschrift.
 *
 * Erweiterbar: eine neue Art ist ein neues Wort in `BOARD_SHAPE_KINDS`;
 * was eine Seite nicht kennt, bleibt beim Schreiben unverändert stehen
 * (`withShapes`), statt zu verschwinden.
 */
export const BOARD_SHAPE_KINDS = ['text', 'image', 'pen', 'line', 'arrow', 'rect', 'ellipse'] as const;
export type BoardShapeKind = (typeof BOARD_SHAPE_KINDS)[number];
/** Die Zeichnungen — was das Werkzeug „Draw“ legt. */
export const BOARD_DRAW_KINDS: readonly BoardShapeKind[] = ['pen', 'line', 'arrow', 'rect', 'ellipse'];

export interface BoardShape {
  id: string;
  kind: BoardShapeKind;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  /** Drehung in Grad um die Mitte. */
  rot: number;
  /** Strichfarbe (Zeichnung) bzw. Textfarbe; leer: die Tinte der Seite. */
  color: string;
  /** Füllung einer Fläche (Rechteck, Ellipse, Text); leer: keine. */
  fill: string;
  /** Strichstärke in px. */
  stroke: number;
  /** Text: Markdown, nie eingesetzt gespeichert. */
  text: string;
  /** Bild: die Id eines Asset-Artikels oder eine Adresse (T-114). */
  asset: string;
  /**
   * Freihand, Linie, Pfeil: die Punkte **relativ zur Lage** (`x`, `y`) —
   * so verschiebt ein Zug nur zwei Zahlen und nicht jeden Punkt.
   */
  points: [number, number][];
  /** Nur für die Leitung: geht an Spielende gar nicht erst hinaus (`redactBoard`). */
  hidden: boolean;
}

export const SHAPE_MIN = { w: 8, h: 8 } as const;

function text(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/** Die Formen eines Boards, von unten nach oben; unbrauchbare fallen weg. */
export function shapesOf(board: Entity): BoardShape[] {
  const c = (board.components?.[BOARD_TYPE] ?? {}) as Record<string, unknown>;
  const roh = Array.isArray(c['shapes']) ? (c['shapes'] as unknown[]) : [];
  const out: { s: BoardShape; i: number }[] = [];
  roh.forEach((x, i) => {
    if (!x || typeof x !== 'object') return;
    const o = x as Record<string, unknown>;
    if (typeof o['id'] !== 'string' || !o['id']) return;
    if (!BOARD_SHAPE_KINDS.includes(o['kind'] as BoardShapeKind)) return;
    const punkte = Array.isArray(o['points'])
      ? (o['points'] as unknown[]).filter(
          (p): p is [number, number] =>
            Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === 'number' && Number.isFinite(n)),
        )
      : [];
    out.push({
      i,
      s: {
        id: o['id'],
        kind: o['kind'] as BoardShapeKind,
        x: zahl(o['x'], 0),
        y: zahl(o['y'], 0),
        w: Math.max(0, zahl(o['w'], 0)),
        h: Math.max(0, zahl(o['h'], 0)),
        z: zahl(o['z'], 0),
        rot: zahl(o['rot'], 0),
        color: text(o['color']),
        fill: text(o['fill']),
        stroke: Math.max(1, zahl(o['stroke'], 3)),
        text: text(o['text']),
        asset: text(o['asset']).trim(),
        points: punkte,
        hidden: o['hidden'] === true,
      },
    });
  });
  return out.sort((a, b) => a.s.z - b.s.z || a.i - b.i).map((x) => x.s);
}

/**
 * Das Board mit diesen Formen. Was an einer gespeicherten Form sonst noch
 * steht, bleibt; Vorgaben (leere Farbe, keine Drehung …) werden nicht
 * gespeichert, und Formen einer Art, die diese Seite nicht kennt, bleiben.
 */
export function withShapes(board: Entity, shapes: readonly BoardShape[]): Entity {
  const c = (board.components?.[BOARD_TYPE] ?? {}) as Record<string, unknown>;
  const roh = Array.isArray(c['shapes']) ? (c['shapes'] as unknown[]) : [];
  const alt = new Map<string, Record<string, unknown>>();
  const fremd: unknown[] = [];
  for (const a of roh) {
    const o = a && typeof a === 'object' ? (a as Record<string, unknown>) : null;
    if (o && typeof o['id'] === 'string' && BOARD_SHAPE_KINDS.includes(o['kind'] as BoardShapeKind)) alt.set(o['id'], o);
    else fremd.push(a);
  }
  const neu = shapes.map((s) => {
    const o: Record<string, unknown> = { ...(alt.get(s.id) ?? {}), id: s.id, kind: s.kind, x: s.x, y: s.y, w: s.w, h: s.h };
    const setze = (k: string, v: unknown, leer: boolean) => {
      if (leer) delete o[k];
      else o[k] = v;
    };
    setze('z', s.z, !s.z);
    setze('rot', s.rot, !s.rot);
    setze('color', s.color, !s.color);
    setze('fill', s.fill, !s.fill);
    setze('stroke', s.stroke, s.stroke === 3 || !BOARD_DRAW_KINDS.includes(s.kind));
    setze('text', s.text, s.kind !== 'text');
    setze('asset', s.asset, s.kind !== 'image' || !s.asset);
    setze('points', s.points, !s.points.length);
    setze('hidden', true, !s.hidden);
    return o;
  });
  return {
    ...board,
    components: { ...board.components, [BOARD_TYPE]: { ...c, shapes: [...fremd, ...neu] } },
  };
}

/** Eine neue Form mit den Vorgaben — die Seite setzt nur, was das Werkzeug sagt. */
export function newShape(kind: BoardShapeKind, at: Partial<BoardShape> & { id: string }): BoardShape {
  return {
    kind,
    x: 0,
    y: 0,
    w: kind === 'text' ? 320 : 200,
    h: kind === 'text' ? 120 : 140,
    z: 0,
    rot: 0,
    color: '',
    fill: '',
    stroke: 3,
    text: '',
    asset: '',
    points: [],
    hidden: false,
    ...at,
  };
}

/**
 * Das Rechteck, das eine Linie oder Freihand aus ihren Punkten umschliesst
 * — mit den Punkten danach relativ zu seiner Ecke. Gerechnet beim Fertig-
 * zeichnen, damit Auswahl und Ausdehnung des Boards eine Lage kennen.
 */
export function fitPoints(absolute: readonly [number, number][]): { x: number; y: number; w: number; h: number; points: [number, number][] } {
  if (!absolute.length) return { x: 0, y: 0, w: 0, h: 0, points: [] };
  const xs = absolute.map((p) => p[0]);
  const ys = absolute.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return {
    x,
    y,
    w: Math.max(...xs) - x,
    h: Math.max(...ys) - y,
    points: absolute.map(([px, py]) => [Math.round(px - x), Math.round(py - y)] as [number, number]),
  };
}

// ------------------------------------------------------------ Hintergrund

export const BACKGROUND_FITS = ['tile', 'stretch', 'fixed'] as const;
export type BackgroundFit = (typeof BACKGROUND_FITS)[number];

export interface BoardBackground {
  /** Ein Bild (Asset-Id oder Adresse); leer: keines. */
  image: string;
  /** Eine Farbe; leer: das Papier der Seite. */
  color: string;
  /** Wie das Bild liegt: gekachelt, auf die Leinwand gestreckt, einmal oben links. */
  fit: BackgroundFit;
  /** Eine Karte als Hintergrund (Id eines `Map`-Artikels); leer: keine. */
  map: string;
}

/** Der Hintergrund des Boards (`Board.background`, `backgroundColor`, `backgroundFit`, `backgroundMap`). */
export function boardBackground(board: Entity): BoardBackground {
  const c = (board.components?.[BOARD_TYPE] ?? {}) as Record<string, unknown>;
  const fit = BACKGROUND_FITS.includes(c['backgroundFit'] as BackgroundFit) ? (c['backgroundFit'] as BackgroundFit) : 'stretch';
  return {
    image: text(c['background']).trim(),
    color: text(c['backgroundColor']).trim(),
    fit,
    map: text(c['backgroundMap']).trim(),
  };
}

/** Das Board mit diesem Hintergrund; was leer ist, fällt aus der Karte. */
export function withBackground(board: Entity, bg: Partial<BoardBackground>): Entity {
  const c = { ...((board.components?.[BOARD_TYPE] ?? {}) as Record<string, unknown>) };
  const felder: [keyof BoardBackground, string][] = [
    ['image', 'background'],
    ['color', 'backgroundColor'],
    ['fit', 'backgroundFit'],
    ['map', 'backgroundMap'],
  ];
  for (const [k, feld] of felder) {
    if (!(k in bg)) continue;
    const v = bg[k];
    if (!v || (k === 'fit' && v === 'stretch')) delete c[feld];
    else c[feld] = v;
  }
  return { ...board, components: { ...board.components, [BOARD_TYPE]: c } };
}

// ---------------------------------------------------- Unendliche Leinwand

/** Wie viel Platz hinter dem Äussersten bleibt — dorthin zieht man weiter. */
export const BOARD_MARGIN = 600;

/**
 * **Wie gross die Leinwand ist** (T-339), gerechnet beim Lesen (D8): so
 * gross wie `width`/`height` sagen (die Vorgabe 2400 × 1500) — und
 * grösser, sobald etwas weiter draussen liegt, mit einem Rand dahinter.
 * `width` und `height` sind damit keine Grenze mehr, sondern die
 * Mindestgrösse; ein Board, auf dem alles innerhalb liegt, sieht aus wie
 * vorher. Links und oben bleibt die Leinwand bei 0 (`snapTo`).
 */
export function boardExtent(
  board: Entity,
  extra: readonly { x: number; y: number; w: number; h: number }[] = [],
): { width: number; height: number } {
  const c = boardCard(board);
  let rechts = 0;
  let unten = 0;
  const nimm = (r: { x: number; y: number; w?: number; h?: number }) => {
    rechts = Math.max(rechts, r.x + (r.w ?? 0));
    unten = Math.max(unten, r.y + (r.h ?? 0));
  };
  for (const r of placementsOf(board)) nimm(placementOf(r));
  for (const a of anchorsOf(board)) nimm(a);
  for (const s of shapesOf(board)) nimm(s);
  for (const r of extra) nimm(r);
  return {
    width: Math.max(c.width, rechts ? Math.ceil(rechts + BOARD_MARGIN) : 0),
    height: Math.max(c.height, unten ? Math.ceil(unten + BOARD_MARGIN) : 0),
  };
}

/** Das Rechteck um alles, was auf dem Board liegt — für „Fit all“; `null` auf einem leeren Board. */
export function boardContentBounds(board: Entity): { x: number; y: number; w: number; h: number } | null {
  const alles = [
    ...placementsOf(board).map(placementOf),
    ...anchorsOf(board).map((a) => ({ x: a.x, y: a.y, w: a.w ?? 0, h: a.h ?? 0 })),
    ...shapesOf(board),
  ];
  if (!alles.length) return null;
  const x = Math.min(...alles.map((r) => r.x));
  const y = Math.min(...alles.map((r) => r.y));
  return {
    x,
    y,
    w: Math.max(...alles.map((r) => r.x + r.w)) - x,
    h: Math.max(...alles.map((r) => r.y + r.h)) - y,
  };
}

// ------------------------------------------------------------- Zurückhalten

/**
 * **Was Spielende vom Board bekommen** (T-339): ohne die Formen und
 * Kacheln, die die Leitung zurückhält (`hidden`). Gerufen am Server für
 * jeden, der den Arbeitsstand nicht sieht — wer das Board schreibt,
 * bekommt es ganz, sonst schriebe er beim nächsten Griff ein gekürztes
 * zurück. Ob der Artikel auf einer Kachel überhaupt an jemanden geht,
 * entscheidet weiter dessen eigene Sichtbarkeit.
 */
export function redactBoard(board: Entity): Entity {
  const c = board.components?.[BOARD_TYPE] as Record<string, unknown> | undefined;
  const shapes = Array.isArray(c?.['shapes']) ? (c['shapes'] as unknown[]) : null;
  const ohne = shapes?.filter((s) => !(s && typeof s === 'object' && (s as { hidden?: unknown }).hidden === true));
  const kanten = (board.relations ?? []).filter((r) => !(r.type === PLACED_RELATION && r.props?.['hidden'] === true));
  return {
    ...board,
    ...(c && ohne && ohne.length !== shapes!.length
      ? { components: { ...board.components, [BOARD_TYPE]: { ...c, shapes: ohne } } }
      : {}),
    relations: kanten,
  };
}

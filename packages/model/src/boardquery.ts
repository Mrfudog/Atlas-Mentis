/**
 * **Die Abfrage-Kachel** (T-340): eine Kachel auf dem Board, die nicht
 * einen Artikel zeigt, sondern eine Auswahl — Gerüchte, Informationen,
 * die offenen Aufträge. Die Leitung sagt, *woher* (Arten, einzelne
 * Artikel, Marken, Ebenen, eine Filterkette aus T-253), und die Kachel
 * zeigt sie als Liste, zieht zufällig ohne Zurücklegen oder läuft als
 * Slideshow.
 *
 * **Die Quelle ist Daten an der Kachel-Kante** (`placed.props.query`):
 * eine Kachel ist eine Kante, und eine Abfrage-Kachel ist eine, deren
 * Ziel das Board selbst ist — so verschiebt, vergrössert, sperrt und
 * verbirgt sie dieselbe Rechnung wie jede Kachel (`placementOf`), und
 * keine zweite Liste von Dingen auf dem Board entsteht. Als Rückbezug
 * „liegt auf" zählt sie nicht (`isQueryPlacement`).
 *
 * **Gerechnet wird am Server, je Betrachter** (CLAUDE.md, „Zurückgehalten
 * wird am Server"): die Kachel nennt nur die Frage; welche Artikel
 * herauskommen, rechnet `queryPool` über den Bestand, den der Betrachter
 * sehen darf. Was gezogen ist, steht an der Kante (`drawn`) und gehört
 * den Routen — ein `PUT` des Boards behält den Stand, den der Server hat
 * (`keepDrawState`).
 *
 * Allgemein gehalten, weil dieselbe Kachel später die Live-Bereiche des
 * Kampagnenboards trägt (T-342: Quests, Gruppe, aktueller Arc): eine
 * Quelle ist eine Frage an den Bestand und nichts sonst.
 */

import { entityName, primaryInterface, typeChain } from './entity.js';
import { isInstance } from './instance.js';
import { isBookPart } from './parts.js';
import { applyTransform, stepsFromString, stepsToString, type Dimension, type TransformStep } from './transform.js';
import type { Entity, Registry, Relation } from './types.js';
import { layersOf } from './versions.js';
import { BOARD_TYPE, PLACED_RELATION } from './board.js';

/** Wie die Kachel zeigt, was die Abfrage bringt. */
export const QUERY_DISPLAYS = ['list', 'draw', 'slideshow'] as const;
export type QueryDisplay = (typeof QUERY_DISPLAYS)[number];

/** Mehr zeigt eine Kachel nicht — eine Abfrage über alles ist ein Versehen, keine Auswahl. */
export const QUERY_LIMIT = 200;
/** Die Vorgabe der Slideshow in Sekunden, und ihre Grenzen. */
export const SLIDE_INTERVAL = { default: 8, min: 2, max: 600 } as const;

/**
 * **Woher die Artikel kommen.** Arten, Marken und Ebenen engen gemeinsam
 * ein (eine Art *und* eine Marke), innerhalb einer Angabe genügt eine
 * (Gerücht *oder* Information); einzelne Artikel kommen in jedem Fall
 * dazu. Die Kette (`steps`, als Wort wie in der Adresse) filtert und
 * sortiert danach — gruppieren tut eine Kachel nicht.
 */
export interface BoardQuery {
  /** Artikelarten, mit ihren Untertypen. */
  types: string[];
  /** Einzelne Artikel, immer dabei (sofern sichtbar). */
  articles: string[];
  /** Marken (`Tags.tags`). */
  tags: string[];
  /** Ebenen, in denen ein Artikel liegt. */
  layers: string[];
  /** Die Filterkette (T-253), `filter:status=ready,sort:name`. */
  steps: string;
}

/** Eine Abfrage-Kachel, wie sie an der Kante steht — mit den Vorgaben für das, was fehlt. */
export interface QueryTile {
  title: string;
  query: BoardQuery;
  display: QueryDisplay;
  /** Gezogen, in der Reihenfolge des Ziehens (nur `draw`). */
  drawn: string[];
  /** Sekunden je Bild der Slideshow. */
  interval: number;
  /** Beim Ziehen freigeben: das Gezogene wird Wissen der Gruppe (`knownBy`). */
  reveal: boolean;
  /** Die Gruppe, an die freigegeben wird; leer: die erste der laufenden Kampagne. */
  party: string;
  /** Die Ansicht eines Artikels in Ziehen und Slideshow; leer: wie jede Kachel. */
  view: string;
}

function woerter(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean))];
}

function text(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** Ist diese Kante eine Abfrage-Kachel (und kein Artikel auf dem Board)? */
export function isQueryPlacement(rel: Pick<Relation, 'type' | 'props'>): boolean {
  const q = rel.props?.['query'];
  return rel.type === PLACED_RELATION && !!q && typeof q === 'object' && !Array.isArray(q);
}

/** Die Quelle, wie sie gespeichert ist; Unbrauchbares fällt weg. */
export function boardQueryOf(raw: unknown): BoardQuery {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    types: woerter(o['types']),
    articles: woerter(o['articles']),
    tags: woerter(o['tags']),
    layers: woerter(o['layers']),
    steps: stepsToString(stepsFromString(text(o['steps']))),
  };
}

/** Die Abfrage-Kachel einer Kante, oder `null`, wenn sie keine ist. */
export function queryTileOf(rel: Relation): QueryTile | null {
  if (!isQueryPlacement(rel)) return null;
  const p = (rel.props ?? {}) as Record<string, unknown>;
  const display = QUERY_DISPLAYS.includes(p['display'] as QueryDisplay) ? (p['display'] as QueryDisplay) : 'list';
  const iv = typeof p['interval'] === 'number' && Number.isFinite(p['interval']) ? p['interval'] : SLIDE_INTERVAL.default;
  return {
    title: text(p['title']),
    query: boardQueryOf(p['query']),
    display,
    drawn: woerter(p['drawn']),
    interval: Math.min(SLIDE_INTERVAL.max, Math.max(SLIDE_INTERVAL.min, Math.round(iv))),
    reveal: p['reveal'] === true,
    party: text(p['party']),
    view: text(p['view']),
  };
}

/** Sagt die Quelle überhaupt etwas? Eine leere bringt nichts — nicht das ganze Kompendium. */
export function queryIsEmpty(q: BoardQuery): boolean {
  const kette = stepsFromString(q.steps).some((s) => 'filter' in s);
  return !q.types.length && !q.articles.length && !q.tags.length && !q.layers.length && !kette;
}

/**
 * Die gespeicherte Form einer Quelle: leere Angaben fallen weg, damit die
 * Kante nur sagt, was gemeint ist.
 */
export function storedQuery(q: Partial<BoardQuery>): Record<string, unknown> {
  const n = boardQueryOf(q);
  const out: Record<string, unknown> = {};
  for (const k of ['types', 'articles', 'tags', 'layers'] as const) if (n[k].length) out[k] = n[k];
  if (n.steps) out['steps'] = n.steps;
  return out;
}

/** Marken eines Artikels. */
function markenVon(e: Entity): string[] {
  const t = (e.components?.['Tags'] as { tags?: unknown } | undefined)?.tags;
  return Array.isArray(t) ? t.filter((x): x is string => typeof x === 'string') : [];
}

/**
 * **Was die Abfrage bringt** — aus `rows`, dem Bestand, den der Betrachter
 * sehen darf (gesiebt hat der Aufrufer, am Server). Instanzen und Teile
 * eines Buchs stehen in keiner Liste und auch hier nicht; ein Board nicht
 * auf sich selbst. Ohne Sortierschritt stehen die Artikel nach Namen.
 *
 * `dims` sind die Dimensionen der Kette (`articleDimensions`); was die
 * Kette nennt und keiner kennt, steht in `unknown`.
 */
export function queryPool(
  registry: Pick<Registry, 'interfaces'>,
  query: BoardQuery,
  rows: readonly Entity[],
  dims: readonly Dimension<Entity>[],
  opts: { exclude?: string; limit?: number } = {},
): { rows: Entity[]; total: number; unknown: string[] } {
  if (queryIsEmpty(query)) return { rows: [], total: 0, unknown: [] };
  const typen = new Set(query.types);
  const marken = new Set(query.tags);
  const ebenen = new Set(query.layers);
  const einzeln = new Set(query.articles);
  const engt = typen.size || marken.size || ebenen.size;
  const kette: TransformStep[] = stepsFromString(query.steps);
  /* Nur eine Kette, keine Angabe sonst: sie filtert dann den ganzen Bestand. */
  const nurKette = !engt && kette.some((s) => 'filter' in s);
  const passt = (e: Entity): boolean => {
    if (typen.size && !typeChain(registry, primaryInterface(e)).some((t) => typen.has(t))) return false;
    if (marken.size && !markenVon(e).some((t) => marken.has(t))) return false;
    if (ebenen.size && !layersOf(e).some((l) => ebenen.has(l))) return false;
    return true;
  };
  const kandidaten = rows.filter(
    (e) =>
      e.id !== opts.exclude &&
      !isInstance(e) &&
      !isBookPart(e) &&
      !(primaryInterface(e) === BOARD_TYPE && !einzeln.has(e.id)) &&
      ((engt || nurKette ? passt(e) : false) || einzeln.has(e.id)),
  );
  /* Die einzeln genannten gehen durch die Kette nicht verloren: wer einen
     Artikel ausdrücklich nennt, will ihn sehen. Gefiltert wird der Rest. */
  const filterKette = kette.filter((s) => 'filter' in s);
  const sortKette = kette.filter((s) => 'sort' in s);
  const gefiltert = new Set(applyTransform(kandidaten.filter((e) => !einzeln.has(e.id)), filterKette, dims).rows.map((e) => e.id));
  const behalten = kandidaten.filter((e) => einzeln.has(e.id) || gefiltert.has(e.id));
  const sortiert = sortKette.length
    ? applyTransform(behalten, sortKette, dims).rows
    : /* Nach dem Namen, wie er dasteht — `e.name` ist an eingelesenen Artikeln leer. */
      [...behalten].sort((a, b) => entityName(a).localeCompare(entityName(b), 'en', { numeric: true, sensitivity: 'base' }));
  const unknown = applyTransform([], kette, dims).unknown;
  const limit = opts.limit ?? QUERY_LIMIT;
  return { rows: sortiert.slice(0, limit), total: sortiert.length, unknown };
}

/**
 * **Ziehen ohne Zurücklegen**: einer aus dem, was die Abfrage bringt und
 * noch nicht gezogen ist — `null`, wenn alles gezogen ist. `random` liefert
 * eine Zahl in [0, 1), am Server `Math.random`, im Test fest.
 */
export function drawNext(pool: readonly string[], drawn: readonly string[], random: () => number = Math.random): string | null {
  const schon = new Set(drawn);
  const offen = pool.filter((id) => !schon.has(id));
  if (!offen.length) return null;
  const i = Math.min(offen.length - 1, Math.floor(random() * offen.length));
  return offen[i] ?? null;
}

/**
 * **Der Stand des Ziehens gehört dem Server** (T-340): ein Board, das die
 * Oberfläche nach einem Griff ganz zurückschreibt, trüge ihren letzten
 * Stand von `drawn` mit — und machte einen Zug rückgängig, den sie noch
 * nicht gesehen hat. Also nimmt der `PUT` das `drawn` jeder Abfrage-Kachel
 * aus dem gespeicherten Board; geändert wird es nur über Ziehen und
 * Zurücksetzen. Eine neue Kachel fängt leer an.
 */
export function keepDrawState(stored: Entity | undefined, next: Entity): Entity {
  const alt = new Map((stored?.relations ?? []).filter(isQueryPlacement).map((r) => [r.id, r.props?.['drawn']]));
  let geaendert = false;
  const relations = (next.relations ?? []).map((r) => {
    if (!isQueryPlacement(r)) return r;
    const war = alt.get(r.id);
    const ist = r.props?.['drawn'];
    if (JSON.stringify(war ?? null) === JSON.stringify(ist ?? null)) return r;
    geaendert = true;
    const props: Record<string, unknown> = { ...(r.props ?? {}) };
    if (war === undefined) delete props['drawn'];
    else props['drawn'] = war;
    return { ...r, props };
  });
  return geaendert ? { ...next, relations } : next;
}

/**
 * **Was Spielende von einer Abfrage-Kachel bekommen**: die Frage ohne die
 * einzeln genannten Artikel, die sie nicht sehen, und vom Gezogenen nur,
 * was sie sehen. Eine Id ist kein Name, aber auch keine Auskunft, die sie
 * brauchen — die Kachel holt ihre Artikel ohnehin gesiebt vom Server.
 */
export function redactQueryTiles(board: Entity, sees: (id: string) => boolean): Entity {
  let geaendert = false;
  const relations = (board.relations ?? []).map((r) => {
    if (!isQueryPlacement(r)) return r;
    const t = queryTileOf(r)!;
    const artikel = t.query.articles.filter(sees);
    const drawn = t.drawn.filter(sees);
    if (artikel.length === t.query.articles.length && drawn.length === t.drawn.length) return r;
    geaendert = true;
    const props: Record<string, unknown> = { ...(r.props ?? {}), query: storedQuery({ ...t.query, articles: artikel }) };
    if (drawn.length) props['drawn'] = drawn;
    else delete props['drawn'];
    return { ...r, props };
  });
  return geaendert ? { ...board, relations } : board;
}

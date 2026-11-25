/**
 * **Die Sichtbarkeit je Artikel an der Kampagne** (T-387, REQ-368): die
 * Liste unter Layers und Visibility der Kampagnenseite zeigt jeden Artikel
 * mit seiner Ebene und lässt einzeln — oder für eine Auswahl — sagen, wer
 * ihn sieht. Hier stehen die reinen Teile: was eine Änderung aus dem Feld
 * `Visibility` macht, und wie die Zeilen gefiltert und sortiert werden.
 *
 * Geschrieben wird ins **eigene Feld** des Artikels (`audience`,
 * `revealedTo`, `hiddenFrom`) — dasselbe, das die Maske schreibt und das
 * jede Regel der Kampagne schlägt (E-098). Wo die Leitung den Artikel nicht
 * schreibt (eine geteilte Ebene), bleibt er, wie er ist; wo das hingehört,
 * ist offen (E-162).
 */

import type { Audience, AudienceSource } from './visibility.js';
import type { EntityId } from './types.js';

/** Die Stufen in ihrer Reihenfolge von aussen nach innen. */
export const AUDIENCE_ORDER: readonly Audience[] = ['public', 'campaign', 'players', 'gm'];

/** Das Feld `Visibility`, so weit es hier zählt; anderes darin bleibt. */
export interface VisibilityFields {
  audience?: Audience;
  revealedTo?: EntityId[];
  hiddenFrom?: EntityId[];
  [rest: string]: unknown;
}

/**
 * Eine Änderung: eine Stufe (`null` heisst „der Gruppe folgen“, das Feld
 * geht weg), oder je Spielende/r zeigen, verbergen oder der Stufe folgen —
 * `bearers` sind ihre Figuren, wie in der Übersicht je Gruppe.
 */
export type VisibilityChange =
  | { audience: Audience | null }
  | { player: { bearers: readonly EntityId[]; mode: 'show' | 'hide' | 'follow' } }
  /** Alles Eigene weg: Stufe, Freigaben, Verbote (wie „Follow the group“). */
  | { follow: true };

/** Was der Artikel für diese Spielende/n selbst sagt: verborgen schlägt freigegeben. */
export function playerSetting(v: VisibilityFields | undefined, bearers: readonly EntityId[]): 'show' | 'hide' | null {
  if (!v || !bearers.length) return null;
  if (bearers.some((b) => v.hiddenFrom?.includes(b))) return 'hide';
  if (bearers.some((b) => v.revealedTo?.includes(b))) return 'show';
  return null;
}

/**
 * **Das Feld nach der Änderung.** `null`, wenn danach nichts mehr darin
 * steht — dann geht die Karte weg, statt leer stehen zu bleiben. Listen
 * bleiben ohne Doppel und in der Reihenfolge, in der sie standen.
 */
export function applyVisibilityChange(v: VisibilityFields | undefined, change: VisibilityChange): VisibilityFields | null {
  const neu: VisibilityFields = { ...(v ?? {}) };
  if ('follow' in change) {
    delete neu.audience;
    delete neu.revealedTo;
    delete neu.hiddenFrom;
  } else if ('audience' in change) {
    if (change.audience === null) delete neu.audience;
    else neu.audience = change.audience;
  } else {
    const b = new Set(change.player.bearers);
    const ohne = (l: EntityId[] | undefined) => (l ?? []).filter((x) => !b.has(x));
    const dazu = (l: EntityId[]) => [...l, ...[...b].filter((x) => !l.includes(x))];
    let zeigen = ohne(neu.revealedTo);
    let verbergen = ohne(neu.hiddenFrom);
    if (change.player.mode === 'show') zeigen = dazu(zeigen);
    if (change.player.mode === 'hide') verbergen = dazu(verbergen);
    if (zeigen.length) neu.revealedTo = zeigen;
    else delete neu.revealedTo;
    if (verbergen.length) neu.hiddenFrom = verbergen;
    else delete neu.hiddenFrom;
  }
  return Object.keys(neu).length ? neu : null;
}

/** Was in einer Zeile der Liste steht — was Filter und Sortierung lesen. */
export interface ArticleVisibilityRow {
  id: EntityId;
  name: string;
  type: string;
  typeLabel: string;
  /** Die Ebenen des Artikels, mit Namen; leer heisst „ohne Ebene". */
  layers: { id: EntityId; name: string }[];
  audience: Audience;
  source: AudienceSource;
}

export interface ArticleVisibilityQuery {
  /** Ebene; `none` heisst: ohne Ebene. */
  layer?: string;
  type?: string;
  level?: Audience;
  source?: AudienceSource;
  /** Teil des Namens, ohne Gross/klein. */
  q?: string;
  sort?: 'name' | 'layer' | 'type' | 'level';
  dir?: 'asc' | 'desc';
}

const vergleich = new Intl.Collator('de', { sensitivity: 'base', numeric: true });

/** Der Name, nach dem die Ebene sortiert: die erste, ohne Ebene zuletzt. */
function ebenenName(r: ArticleVisibilityRow): string {
  return r.layers.map((l) => l.name).sort(vergleich.compare)[0] ?? '￿';
}

/**
 * **Filtern und sortieren.** Gleichstand geht nach Name, dann Id — die
 * Reihenfolge bleibt dieselbe, wenn man zwischen zwei Seiten blättert.
 */
export function filterArticleRows<R extends ArticleVisibilityRow>(rows: readonly R[], q: ArticleVisibilityQuery): R[] {
  const text = q.q?.trim().toLocaleLowerCase('de') ?? '';
  const aus = rows.filter(
    (r) =>
      (!q.layer || (q.layer === 'none' ? !r.layers.length : r.layers.some((l) => l.id === q.layer))) &&
      (!q.type || r.type === q.type) &&
      (!q.level || r.audience === q.level) &&
      (!q.source || r.source === q.source) &&
      (!text || r.name.toLocaleLowerCase('de').includes(text)),
  );
  const schluessel: Record<NonNullable<ArticleVisibilityQuery['sort']>, (a: R, b: R) => number> = {
    name: () => 0,
    layer: (a, b) => vergleich.compare(ebenenName(a), ebenenName(b)),
    type: (a, b) => vergleich.compare(a.typeLabel, b.typeLabel),
    level: (a, b) => AUDIENCE_ORDER.indexOf(a.audience) - AUDIENCE_ORDER.indexOf(b.audience),
  };
  const erst = schluessel[q.sort ?? 'name'] ?? schluessel.name;
  const richtung = q.dir === 'desc' ? -1 : 1;
  return aus.sort((a, b) => richtung * (erst(a, b) || vergleich.compare(a.name, b.name) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)));
}

/**
 * **Eine Sammlung in einer Ansicht** (T-425, REQ-430, E-142, E-172).
 *
 * Das Element `collection` zeigt die Artikel am Ende seines Pfads — die
 * Szenen und Begegnungen einer Session über `← partOf` —, jeden in der
 * Ansicht **seiner eigenen** Art. Die Views werden wiederverwendet: wer die
 * Kurzansicht der Szene ändert, ändert die Kacheln auf der Session mit.
 * Eine Sonderseite je Art gibt es nicht.
 *
 * Hier steht, **was** gezeigt wird und **in welcher Ordnung**; gezeichnet
 * wird in `nw-ansichtsbaum`. Gesiebt hat der Server: `get` liefert nur, was
 * der Betrachter bekommen hat, und was fehlt, fällt weg.
 */

import { articleId, entityName, primaryInterface, typeChain } from './entity.js';
import { followPath, type IncomingEdge, type PathHit } from './viewScope.js';
import type { Entity, LayoutElement, Registry } from './types.js';

type Ctx = {
  get: (id: string) => Entity | undefined;
  incoming: (id: string) => readonly IncomingEdge[];
  /** Quelle Filter: was der Server auf `collectionQuery` geantwortet hat (gesiebt). */
  found?: readonly Entity[];
};

/** Was eine Sammlung mit Quelle Filter fragt — `GET /api/list` wie im Kompendium; `null` für eine verknüpfte. */
export interface CollectionQuery {
  of?: string[];
  tag?: string[];
  f?: string[];
  q?: string;
  limit: number;
}

/**
 * **Die Frage einer Filter-Sammlung** (T-425, E-142): Arten mit ihren
 * Untertypen, Marken, Feldbedingungen, Suchtext — dieselben Angaben wie die
 * Filter des Kompendiums, gesiebt am Server. Ohne Grenze 24: eine Sammlung
 * auf einer Seite ist keine Liste von allem.
 */
export function collectionQuery(el: LayoutElement): CollectionQuery | null {
  if (el.source !== 'filter') return null;
  return {
    ...(el.types?.length ? { of: [...el.types] } : {}),
    ...(el.filter?.tags?.length ? { tag: [...el.filter.tags] } : {}),
    ...(el.filter?.fields?.length ? { f: [...el.filter.fields] } : {}),
    ...(el.filter?.q?.trim() ? { q: el.filter.q.trim() } : {}),
    limit: el.limit ?? 24,
  };
}

/**
 * **Die Treffer einer Sammlung**: dem Pfad folgen, auf die genannten Arten
 * einengen (die `extends`-Kette hoch), ordnen. Ohne Pfad ist sie leer —
 * eine Sammlung des Artikels selbst wäre er allein, und das zeigt die
 * Seite schon.
 *
 * Geordnet wird nach `Time.sort` (ohne Zeit dahinter), dann nach Nummer —
 * wie `looseParts` die Liste „Contains" ordnete (T-422) —, oder nach Name,
 * Nummer oder einem Feld (`Typ.feld`). Ein Wert, der fehlt, steht hinten,
 * auch absteigend: eine Szene ohne Zeit ist keine, die zuerst kommt.
 */
export function collectionHits(registry: Pick<Registry, 'interfaces'>, entity: Entity, el: LayoutElement, ctx: Ctx): PathHit[] {
  const filter = el.source === 'filter';
  if (!filter && !el.path?.length) return [];
  const arten = el.types?.length ? el.types : null;
  const roh: PathHit[] = filter ? (ctx.found ?? []).map((e) => ({ entity: e, props: {} })) : followPath(registry, entity, el.path, ctx);
  const hits = roh.filter(
    (h) =>
      h.entity.id !== entity.id &&
      (!arten || arten.some((t) => typeChain(registry, primaryInterface(h.entity)).includes(t))) &&
      /* Mit Rang steht ein Teil im Lesefluss (`parts`); `unranked` zeigt, was dort nicht steht (T-422). */
      (!el.unranked || h.props['rank'] === undefined),
  );
  const by = el.sort?.by ?? 'Time.sort';
  const richtung = el.sort?.desc ? -1 : 1;
  const nummer = (a: Entity, b: Entity) => articleId(a).localeCompare(articleId(b), 'en', { numeric: true });
  return hits.sort((x, y) => {
    const a = x.entity;
    const b = y.entity;
    if (by === 'name') return richtung * entityName(a).localeCompare(entityName(b), 'en', { numeric: true }) || nummer(a, b);
    if (by === 'id') return richtung * nummer(a, b);
    const va = feldWert(a, by);
    const vb = feldWert(b, by);
    if (va === undefined || vb === undefined) return (va === undefined ? 1 : 0) - (vb === undefined ? 1 : 0) || nummer(a, b);
    const c = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'en', { numeric: true });
    return richtung * c || nummer(a, b);
  });
}

/** Ein Feld `Typ.feld` als Sortierwert; Zahlen bleiben Zahlen, leer ist keiner. */
function feldWert(e: Entity, ref: string): number | string | undefined {
  const [typ = '', key = ''] = ref.split('.');
  const v = (e.components?.[typ] as Record<string, unknown> | undefined)?.[key];
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  const n = Number(v);
  return typeof v === 'string' && v.trim() !== '' && Number.isFinite(n) ? n : String(v);
}

/** Eine Gruppe einer Sammlung: ohne Gruppierung eine ohne Überschrift. */
export interface CollectionGroup {
  key: string;
  label: string;
  hits: PathHit[];
}

/**
 * **Nach Art gruppiert** (`groupBy: 'type'`): je Art eine Gruppe, in der
 * Reihenfolge, in der ihr erster Treffer steht, beschriftet wie die Art im
 * Register. Die Ordnung der Treffer bleibt in jeder Gruppe erhalten.
 */
export function collectionGroups(registry: Pick<Registry, 'interfaces'>, hits: readonly PathHit[], el: LayoutElement): CollectionGroup[] {
  if (el.groupBy !== 'type') return [{ key: '', label: '', hits: [...hits] }];
  const raus = new Map<string, CollectionGroup>();
  for (const h of hits) {
    const typ = primaryInterface(h.entity);
    const g = raus.get(typ) ?? { key: typ, label: registry.interfaces[typ]?.label ?? typ, hits: [] };
    g.hits.push(h);
    raus.set(typ, g);
  }
  return [...raus.values()];
}

/**
 * **In welcher Ansicht ein Treffer steht** (E-172: das Element wählt, nicht
 * die Kante). Zuerst die Wahl für seine Art (`viewByType`, die Kette hoch,
 * die genaueste zuerst), dann die des Elements, sonst der Ort: Kacheln
 * sind Karten (`quick`), eine Liste besteht aus Verweisen (`overview`).
 */
export function collectionView(registry: Pick<Registry, 'interfaces'>, el: LayoutElement, type: string): string {
  if (el.viewByType) {
    for (const t of typeChain(registry, type)) {
      const v = el.viewByType[t];
      if (v) return v;
    }
  }
  return el.view || (el.show === 'list' || el.show === 'table' ? 'overview' : 'quick');
}

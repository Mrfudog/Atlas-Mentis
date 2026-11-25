/**
 * **Bücher aus Teilen** (T-108, E-028, E-029): ein Kapitel (`Chapter`) ist
 * die Lesestruktur eines Buchs oder Abenteuers und besteht aus **Teilen** —
 * Überschriften, Absätzen, Vorlesetexten, Verweisen auf Artikel, die für
 * sich stehen, Bildern (`Illustration`, T-210) und (im Abenteuer) Szenen. Jeder Teil ist ein eigener
 * Artikel, damit man ihn wiederverwendet: einen Vorlesetext in die eigene
 * Szene holen heisst, den Artikel zu nehmen (oder eine Fassung davon).
 *
 * - **Die Reihenfolge steht an der Kante** (`partOf.props.rank`): derselbe
 *   Teil darf in einem Kapitel an dritter und in einem Arc an erster
 *   Stelle stehen. Eine Kante ohne `rank` hängt etwas an (eine Begegnung
 *   an ihre Szene) und gehört nicht in den Lesefluss.
 * - **Teile stehen in keiner Liste und sind kein Verweisziel nach Namen**
 *   (`isBookPart`): ein Absatz heisst nach seinen ersten Worten, eine
 *   Überschrift „Surprise" wie die Regel — beides machte jeden `[[Verweis]]`
 *   mehrdeutig. Die Nummer bleibt ein Ziel.
 *
 * Ohne Framework, damit Server, Importer und Oberfläche dieselbe
 * Reihenfolge rechnen.
 */

import type { Entity, EntityId } from './types.js';

type Rel = NonNullable<Entity['relations']>[number];

/* Ohne Import aus `entity.ts`: das liest `isBookPart`, und ein Kreis
   zwischen den beiden Modulen hinge an der Ladereihenfolge. */
const primaryInterface = (e: Entity): string => e.interfaces?.[0] ?? '';
const articleId = (e: Entity): string => {
  const wert = (e.components?.['Identity'] as { id?: unknown } | undefined)?.id;
  return typeof wert === 'string' ? wert : '';
};

/** Die Art eines Kapitels. */
export const CHAPTER_TYPE = 'Chapter';

/** Die Teil-Arten: was nur als Teil eines Kapitels (oder einer Szene) Sinn hat. */
export const BOOK_PART_TYPES: readonly string[] = ['Heading', 'Paragraph', 'ReadAloudText', 'Embed', 'Illustration'];

/** Die Kante, über die ein Teil an seinem Ganzen hängt. */
export const PART_EDGE = 'partOf';

/** Ist der Artikel ein Teil (keine Liste, kein Namensziel)? */
export function isBookPart(e: Entity): boolean {
  return BOOK_PART_TYPES.includes(primaryInterface(e));
}

/** Der Rang an einer `partOf`-Kante, wenn sie im Lesefluss steht. */
export function partRank(r: Pick<Rel, 'type' | 'props'>): number | undefined {
  if (r.type !== PART_EDGE) return undefined;
  const rank = (r.props as { rank?: unknown } | undefined)?.rank;
  return typeof rank === 'number' && Number.isFinite(rank) ? rank : undefined;
}

/** Die Stufe einer Überschrift (1–6), sonst `undefined`. */
export function headingLevel(e: Entity): number | undefined {
  if (primaryInterface(e) !== 'Heading') return undefined;
  const l = Number((e.components?.['Heading'] as { level?: unknown } | undefined)?.level);
  return Number.isFinite(l) ? Math.min(6, Math.max(1, Math.round(l))) : 2;
}

/** Ein Teil an seiner Stelle. */
export interface RankedPart {
  entity: Entity;
  rank: number;
}

/**
 * Je Ganzem seine Teile in Lesereihenfolge: nach Rang, bei gleichem Rang
 * nach Nummer. Ein Teil, der zweimal am selben Ganzen hängt, steht einmal
 * (am kleineren Rang).
 */
export function partsIndex(all: Iterable<Entity>): Map<EntityId, RankedPart[]> {
  const out = new Map<EntityId, RankedPart[]>();
  for (const e of all) {
    const gesehen = new Map<EntityId, number>();
    for (const r of e.relations ?? []) {
      const rank = partRank(r);
      if (rank === undefined || !r.to || r.to === e.id) continue;
      const alt = gesehen.get(r.to);
      if (alt === undefined || rank < alt) gesehen.set(r.to, rank);
    }
    for (const [to, rank] of gesehen) (out.get(to) ?? out.set(to, []).get(to)!).push({ entity: e, rank });
  }
  for (const l of out.values()) {
    l.sort((a, b) => a.rank - b.rank || articleId(a.entity).localeCompare(articleId(b.entity), 'en', { numeric: true }));
  }
  return out;
}

/**
 * **Was ohne Rang an einem Ganzen hängt** (T-422, REQ-427): die Szenen
 * eines Arcs, die Begegnungen einer Szene oder Session — `partOf` ohne
 * `rank`. Es steht nicht im Lesefluss (`partsIndex`), wird an seinem
 * Ganzen aber aufgezählt: nach `Time.sort`, ohne Zeit dahinter, dann nach
 * Nummer. Welche Arten dort stehen, entscheidet der Aufrufer.
 */
export function looseParts(all: Iterable<Entity>, whole: EntityId): Entity[] {
  const out: Entity[] = [];
  for (const e of all) {
    if (e.id === whole) continue;
    if ((e.relations ?? []).some((r) => r.type === PART_EDGE && r.to === whole && partRank(r) === undefined)) out.push(e);
  }
  const zeit = (e: Entity): number => {
    const v = Number((e.components?.['Time'] as { sort?: unknown } | undefined)?.sort);
    return Number.isFinite(v) ? v : Number.POSITIVE_INFINITY;
  };
  return out.sort((a, b) => zeit(a) - zeit(b) || articleId(a).localeCompare(articleId(b), 'en', { numeric: true }));
}

/** Der nächste freie Rang an einem Ganzen: hinter dem letzten Teil. */
export function nextRank(index: ReadonlyMap<EntityId, RankedPart[]>, whole: EntityId): number {
  const l = index.get(whole);
  return l?.length ? Math.floor(l[l.length - 1]!.rank) + 1 : 1;
}

/**
 * Ein Name für einen Absatz: seine ersten Worte, ohne Markdown. Er steht in
 * keiner Liste, aber in der Kopfzeile seiner Artikelseite und im
 * Inhaltsverzeichnis einer Fassung.
 */
export function partName(text: string, max = 60): string {
  const klar = text
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\{\{([^}]+)\}\}/g, '$1')
    .replace(/[*_#>|`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (klar.length <= max) return klar;
  const schnitt = klar.slice(0, max);
  const wort = schnitt.lastIndexOf(' ');
  return `${(wort > max / 2 ? schnitt.slice(0, wort) : schnitt).replace(/[,;:.\s]+$/, '')}…`;
}

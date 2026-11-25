/**
 * **Eine Ebene als Buch lesen** (T-091, REQ-247): welche Artikel einer
 * Ebene der Text sind, in welcher Reihenfolge und wie tief.
 *
 * Der Text eines Abenteuers (T-082) ist ein Baum über `partOf`: das
 * Abenteuer (`Story`, `kind: 'adventure'`), seine Kapitel (`Arc`, E-026), darin die
 * Abschnitte (`Scene`), darin Räume. Hier steht, wie man ihn liest — ohne
 * Framework, damit Server und Prüfungen dieselbe Reihenfolge rechnen.
 *
 * - **Textknoten** sind Artikel der Ebene (`inLayer`) von einer Leseart
 *   (`READING_TYPES`). Eine Begegnung oder eine Karte gehört zum Text,
 *   ist aber keiner: sie wird an ihrem Abschnitt eingebettet.
 * - **Wurzeln** sind Textknoten ohne Eltern unter den Textknoten derselben
 *   Ebene. Ein Abschnitt, dessen Kapitel in einer anderen Ebene liegt,
 *   wird damit selbst eine Wurzel und geht nicht verloren.
 * - **Reihenfolge** unter Geschwistern ist die Nummer (`Identity.id`), wie
 *   auf der Kampagnenseite (T-082): der Importer vergibt sie in der
 *   Reihenfolge des Buchs.
 * - **Ein Stück** (`unit`) ist, was die Leseansicht am Stück zeigt: ein
 *   Kapitel samt allem darunter. Hat die Ebene genau eine Wurzel (das
 *   Abenteuer selbst), ist sie die Titelseite — ihr eigener Text ein
 *   Stück, jedes Kind ein weiteres. Sonst ist jede Wurzel ein Stück.
 *
 * **Hat die Ebene Kapitel** (`Chapter`, T-108, eigene und keine geholte
 * Fassung), liest sie sich aus ihnen:
 * jedes Kapitel ist eine Wurzel und ein Stück, darunter seine Teile in der
 * Reihenfolge von `partOf.rank` (`partsIndex`) — Überschriften, Absätze,
 * Vorlesetexte, Verweise, Szenen und deren Teile. Der Baum aus Story, Arc
 * und Szene gilt dann nicht: er ist die Geschichtssicht desselben Texts,
 * und beide zeigen auf dieselben Szenen (E-029). Ins Inhaltsverzeichnis
 * gehören Kapitel, Szenen und Überschriften (`toc`), nicht die Absätze;
 * eine Überschrift steht so tief, wie ihre Stufe sagt.
 *
 * Gesiebt wird hier nichts: wer was sehen darf, fragt der Server danach
 * (`articleVisible`, `redactEntity`), und eine Fassung (E-018) setzt er an
 * die Stelle ihres Originals — der Baum bleibt der des Originals.
 */

import { articleId, primaryInterface } from './entity.js';
import { CHAPTER_TYPE, headingLevel, isBookPart, partRank, partsIndex } from './parts.js';
import type { Entity } from './types.js';

/** Die Arten, deren Artikel Text eines Buchs sind — ein Kapitel (T-108) und die Sprossen der Geschichte. */
export const READING_TYPES: readonly string[] = ['Chapter', 'Story', 'Arc', 'Scene'];

/** Ein Eintrag im Inhaltsverzeichnis. */
export interface ReadingNode {
  id: string;
  /** 0 für eine Wurzel. */
  depth: number;
  /** Der Textknoten darüber, wenn es einen gibt. */
  parent?: string;
  /** Das Stück, in dem er gezeigt wird (die Id seines Kapitels). */
  unit: string;
  /**
   * Steht er im Inhaltsverzeichnis? Kapitel, Szenen, Überschriften ja,
   * Absätze, Vorlesetexte und Verweise nicht (T-108). Fehlt die Angabe,
   * steht er dort.
   */
  toc?: boolean;
}

const LAYER_EDGE = 'inLayer';
const PART_EDGE = 'partOf';

/** Liegt der Artikel in dieser Ebene? */
export function inLayerOf(e: Entity, layer: string): boolean {
  return (e.relations ?? []).some((r) => r.type === LAYER_EDGE && r.to === layer);
}

/** Ist er ein Textknoten dieser Ebene? */
export function isReadingNode(e: Entity, layer: string): boolean {
  return (READING_TYPES.includes(primaryInterface(e)) || isBookPart(e)) && inLayerOf(e, layer);
}

/** Nach der Nummer, mit Zahlen als Zahlen: `scene-0010` nach `scene-0009`. */
export function byNumber(a: Entity, b: Entity): number {
  return articleId(a).localeCompare(articleId(b), 'en', { numeric: true }) || a.id.localeCompare(b.id);
}

/**
 * Das Inhaltsverzeichnis einer Ebene, in Lesereihenfolge (Tiefe zuerst).
 * Ein Kreis über `partOf` läuft nicht endlos; seine Knoten stehen am Ende.
 */
export function readingOrder(all: Iterable<Entity>, layer: string): ReadingNode[] {
  const liste = [...all];
  /* Ein geholtes Kapitel (eine Fassung in der Kampagnenebene, E-026)
     macht die Kampagne nicht zum Buch: es steht im Baum ihrer Geschichte,
     an dem Arc, an den es geholt wurde. */
  const istBuch = liste.some(
    (e) => primaryInterface(e) === CHAPTER_TYPE && inLayerOf(e, layer) && !(e.relations ?? []).some((r) => r.type === 'overrides'),
  );
  if (istBuch) return chapterOrder(liste, layer);
  const nodes = new Map<string, Entity>();
  for (const e of liste) if (isReadingNode(e, layer)) nodes.set(e.id, e);
  const parentOf = (e: Entity): string | undefined =>
    (e.relations ?? []).find((r) => r.type === PART_EDGE && r.to !== e.id && nodes.has(r.to))?.to;
  const children = new Map<string, Entity[]>();
  const roots: Entity[] = [];
  for (const e of nodes.values()) {
    const p = parentOf(e);
    if (p) (children.get(p) ?? children.set(p, []).get(p)!).push(e);
    else roots.push(e);
  }
  roots.sort(byNumber);
  /* Mit Rang (T-108) gilt der Rang — ein Vorlesetext, den die Leitung in
     ihren Arc holte, steht dort, wo sie ihn hinstellte —, sonst die Nummer. */
  const rangAn = (e: Entity, p: string) => {
    for (const r of e.relations ?? []) if (r.to === p && partRank(r) !== undefined) return partRank(r)!;
    return Number.POSITIVE_INFINITY;
  };
  for (const [p, l] of children) l.sort((a, b) => (rangAn(a, p) - rangAn(b, p)) || byNumber(a, b));

  const out: ReadingNode[] = [];
  const seen = new Set<string>();
  const titlePage = roots.length === 1;
  const walk = (e: Entity, depth: number, unit: string, parent?: string): void => {
    if (seen.has(e.id)) return;
    seen.add(e.id);
    out.push({ id: e.id, depth, unit, ...(parent ? { parent } : {}), ...(isBookPart(e) && headingLevel(e) === undefined ? { toc: false } : {}) });
    for (const k of children.get(e.id) ?? []) {
      /* Unter der Titelseite ist jedes Kind ein eigenes Stück. */
      walk(k, depth + 1, titlePage && depth === 0 ? k.id : unit, e.id);
    }
  };
  for (const r of roots) walk(r, 0, r.id);
  /* Was in einem Kreis hängt, hat keine Wurzel — es steht dann am Ende,
     statt still zu fehlen. */
  for (const e of [...nodes.values()].sort(byNumber)) walk(e, 0, e.id);
  return out;
}

/**
 * **Die Lesereihenfolge aus Kapiteln** (T-108): Wurzeln sind die Kapitel
 * der Ebene, die an keinem anderen Kapitel der Ebene hängen (nach Nummer);
 * darunter, Tiefe zuerst, was mit Rang an ihnen hängt, und was mit Rang an
 * diesen Teilen hängt (Räume einer Szene, deren Absätze). Gezählt wird nur,
 * was in derselben Ebene liegt — ein Teil aus einer fremden Ebene ist dort
 * ein Verweis (`Embed`), keine Kante.
 */
function chapterOrder(all: Entity[], layer: string): ReadingNode[] {
  const hier = all.filter((e) => inLayerOf(e, layer));
  const teile = partsIndex(hier);
  const kapitel = hier.filter((e) => primaryInterface(e) === CHAPTER_TYPE);
  const imKapitel = new Set(kapitel.map((k) => k.id));
  const roots = kapitel
    .filter((k) => !(k.relations ?? []).some((r) => partRank(r) !== undefined && imKapitel.has(r.to) && r.to !== k.id))
    .sort(byNumber);
  const out: ReadingNode[] = [];
  const seen = new Set<string>();
  const tiefeVon = new Map<string, number>();
  const walk = (e: Entity, depth: number, unit: string, parent?: string): void => {
    if (seen.has(e.id)) return;
    seen.add(e.id);
    const level = headingLevel(e);
    /* Eine Überschrift steht so tief, wie ihre Stufe sagt: „##" unter dem
       Kapitel eine Stufe, „###" zwei. Unter ihr hängt nichts — sie gliedert
       den Fluss, sie enthält ihn nicht. */
    const tiefe = level !== undefined && parent ? (tiefeVon.get(parent) ?? 0) + Math.max(1, level - 1) : depth;
    tiefeVon.set(e.id, tiefe);
    const toc = !isBookPart(e) || level !== undefined;
    out.push({ id: e.id, depth: tiefe, unit, ...(parent ? { parent } : {}), ...(toc ? {} : { toc: false }) });
    for (const t of teile.get(e.id) ?? []) walk(t.entity, depth + 1, unit, e.id);
  };
  for (const r of roots) walk(r, 0, r.id);
  /* Was in einem Kreis hängt, steht am Ende, statt still zu fehlen. */
  for (const k of [...kapitel].sort(byNumber)) walk(k, 0, k.id);
  return out;
}

/**
 * Der Abschnitt zu einer Seitenzahl („XGE p. 12", T-091): der letzte in
 * Lesereihenfolge, dessen Seite nicht hinter der gesuchten liegt. Seiten,
 * die keine Zahl sind, zählen nicht.
 */
export function nodeAtPage(order: readonly { id: string; page?: string | number | undefined }[], page: number): string | undefined {
  let best: { id: string; page: number } | undefined;
  for (const n of order) {
    const p = Number(n.page);
    if (!Number.isFinite(p) || p > page) continue;
    if (!best || p > best.page) best = { id: n.id, page: p };
  }
  return best?.id ?? order.find((n) => Number.isFinite(Number(n.page)))?.id;
}

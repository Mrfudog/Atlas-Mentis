/**
 * **Eine Ebene als Buch lesen** (T-091, REQ-247): welche Artikel einer
 * Ebene der Text sind, in welcher Reihenfolge und wie tief.
 *
 * Der Text eines Abenteuers (T-082) ist ein Baum über `partOf`: das
 * Abenteuer (`Story`, `kind: 'adventure'`), seine Kapitel, darin die
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
 * Gesiebt wird hier nichts: wer was sehen darf, fragt der Server danach
 * (`articleVisible`, `redactEntity`), und eine Fassung (E-018) setzt er an
 * die Stelle ihres Originals — der Baum bleibt der des Originals.
 */

import { articleId, primaryInterface } from './entity.js';
import type { Entity } from './types.js';

/** Die Arten, deren Artikel Text eines Buchs sind. */
export const READING_TYPES: readonly string[] = ['Story', 'Scene'];

/** Ein Eintrag im Inhaltsverzeichnis. */
export interface ReadingNode {
  id: string;
  /** 0 für eine Wurzel. */
  depth: number;
  /** Der Textknoten darüber, wenn es einen gibt. */
  parent?: string;
  /** Das Stück, in dem er gezeigt wird (die Id seines Kapitels). */
  unit: string;
}

const LAYER_EDGE = 'inLayer';
const PART_EDGE = 'partOf';

/** Liegt der Artikel in dieser Ebene? */
export function inLayerOf(e: Entity, layer: string): boolean {
  return (e.relations ?? []).some((r) => r.type === LAYER_EDGE && r.to === layer);
}

/** Ist er ein Textknoten dieser Ebene? */
export function isReadingNode(e: Entity, layer: string): boolean {
  return READING_TYPES.includes(primaryInterface(e)) && inLayerOf(e, layer);
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
  const nodes = new Map<string, Entity>();
  for (const e of all) if (isReadingNode(e, layer)) nodes.set(e.id, e);
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
  for (const l of children.values()) l.sort(byNumber);

  const out: ReadingNode[] = [];
  const seen = new Set<string>();
  const titlePage = roots.length === 1;
  const walk = (e: Entity, depth: number, unit: string, parent?: string): void => {
    if (seen.has(e.id)) return;
    seen.add(e.id);
    out.push({ id: e.id, depth, unit, ...(parent ? { parent } : {}) });
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

/**
 * **Die Ebene eines Artikels wechseln** (T-383): im Bearbeiten steht sie
 * als erstes Feld, und gespeichert wird sie als das, was sie ist — die
 * Kante `inLayer` vom Artikel zur Ebene. Kein Feld daneben: eine zweite
 * Stelle für dieselbe Angabe liefe beim ersten Import auseinander.
 *
 * Gezählt werden nur Kanten, die etwas **bringen**; eine mit
 * `mode: 'removes'` nimmt etwas aus dem Stapel und ist keine Herkunft —
 * sie bleibt, wie sie ist, und wird in der Kantenliste bearbeitet.
 */
import type { Entity, Relation } from './types.js';
import { LAYER_RELATION } from './visibility.js';

type Kante = Pick<Relation, 'id' | 'type' | 'to'> & { props?: Record<string, unknown> };

/** Bringt diese Kante den Artikel in eine Ebene (und nimmt ihn nicht heraus)? */
export function bringsIntoLayer(r: Kante): boolean {
  return r.type === LAYER_RELATION && (r.props as { mode?: unknown } | undefined)?.mode !== 'removes';
}

/** Die Ebenen, in denen ein Artikel liegt, in der Reihenfolge seiner Kanten. */
export function homeLayers(relations: readonly Kante[] | undefined): string[] {
  const raus: string[] = [];
  for (const r of relations ?? []) if (bringsIntoLayer(r) && r.to && !raus.includes(r.to)) raus.push(r.to);
  return raus;
}

/**
 * **Die Kanten, nachdem der Artikel in `layer` liegt** — alle bringenden
 * `inLayer`-Kanten fallen weg, eine auf `layer` kommt dazu (sie behält die
 * Id der ersten, die es gab, damit ein Vergleich keine neue Kante sieht).
 * `null`: in keiner Ebene (das darf nur die Verwaltung, am Server
 * geprüft). Steht er schon genau dort, bleibt die Liste, wie sie war.
 */
export function withHomeLayer<K extends Kante>(relations: readonly K[], layer: string | null, entityId: string): (K | Kante)[] {
  const jetzt = homeLayers(relations);
  if (layer ? jetzt.length === 1 && jetzt[0] === layer : jetzt.length === 0) return [...relations];
  const erste = relations.find(bringsIntoLayer);
  const rest = relations.filter((r) => !bringsIntoLayer(r));
  if (!layer) return rest;
  return [...rest, { id: erste?.id ?? `${entityId}~${LAYER_RELATION}-1`, type: LAYER_RELATION, to: layer, props: {} }];
}

/**
 * **Was ein Schreiben an den Ebenen ändert** (T-383): welche Ebenen
 * dazukommen, welche wegfallen, und ob der Artikel danach in keiner mehr
 * liegt. Der Server prüft damit, ob das Konto in jede neue Ebene schreibt.
 * Gezählt werden auch Kanten mit `mode: 'removes'` — auch sie wirken in
 * der Ebene, auf die sie zeigen.
 */
export function layerChange(
  before: Pick<Entity, 'relations'> | null | undefined,
  after: Pick<Entity, 'relations'>,
): { added: string[]; removed: string[]; homeless: boolean } {
  const alle = (rs: readonly Kante[] | undefined) =>
    new Set((rs ?? []).filter((r) => r.type === LAYER_RELATION && r.to).map((r) => r.to));
  const vorher = alle(before?.relations);
  const nachher = alle(after.relations);
  return {
    added: [...nachher].filter((l) => !vorher.has(l)),
    removed: [...vorher].filter((l) => !nachher.has(l)),
    homeless: homeLayers(before?.relations).length > 0 && homeLayers(after.relations).length === 0,
  };
}

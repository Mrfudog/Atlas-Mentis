/**
 * **Eine Karte im Spiel für Tests** (E-1): Spielende sehen nur Karten im
 * Spiel — eine Vorlage nie. Wer in einem Test eine Karte für Spielende
 * braucht, legt sie damit als freigegebene Instanz einer leeren Vorlage an:
 * die Karte behält ihre Id und alles, was an ihr steht, die Vorlage heisst
 * `<id>__vorlage` und liegt in denselben Ebenen.
 */
import { INSTANCE_RELATION, LAYER_RELATION, type Entity } from '@nw/model';

export function imSpiel(karte: Entity): Entity[] {
  const vorlageId = `${karte.id}__vorlage`;
  const name = String((karte.components?.['Identity'] as { name?: unknown } | undefined)?.name ?? karte.name ?? karte.id);
  const vorlage: Entity = {
    id: vorlageId,
    interfaces: [...karte.interfaces],
    name,
    components: { Identity: { name, id: `${String((karte.components?.['Identity'] as { id?: unknown } | undefined)?.id ?? 'map')}-v`, aliases: [] } },
    relations: (karte.relations ?? [])
      .filter((r) => r.type === LAYER_RELATION)
      .map((r) => ({ ...r, id: `${r.id}~v` })),
  };
  const map = (karte.components?.['Map'] ?? {}) as Record<string, unknown>;
  const instanz: Entity = {
    ...karte,
    components: { ...karte.components, Map: { ...map, released: true } },
    relations: [...(karte.relations ?? []), { id: `${karte.id}~instanceOf`, type: INSTANCE_RELATION, to: vorlageId, props: {} }],
  };
  return [vorlage, instanz];
}

/** Jede Karte eines Testbestands als Karte im Spiel (`imSpiel`), alles andere, wie es ist. */
export function kartenImSpiel(bestand: Entity[]): Entity[] {
  return bestand.flatMap((e) => ((e.interfaces ?? [])[0] === 'Map' ? imSpiel(e) : [e]));
}

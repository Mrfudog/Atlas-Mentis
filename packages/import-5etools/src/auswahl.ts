/**
 * **Nur bestimmte Arten ausgeben** (`--types Place`, T-175). Ein Lauf
 * `only-new` mit `--sources` legt alles an, was der Bestand nicht kennt —
 * auch geteilte Merkmale, die ein Lauf über wenige Quellen anders teilt als
 * der über alle, und die dann als Waisen daneben stünden. Wer eine neue
 * Art nachträgt (die Orte aus dem Buchtext), nimmt nur sie; die Ebenen
 * bleiben dabei, damit jede `inLayer`-Kante ihr Ziel in der Datei hat.
 */

import type { Entity } from '@nw/model';

/** Die Artikel der genannten Arten (erste Art eines Artikels) und alle Ebenen. */
export function nurArten<T extends { entities: Entity[] }>(datei: T, arten: string[]): T {
  const nimm = new Set([...arten, 'Layer']);
  return { ...datei, entities: datei.entities.filter((e) => nimm.has(e.interfaces[0] ?? '')) };
}

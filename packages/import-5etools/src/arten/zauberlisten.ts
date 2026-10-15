/**
 * **Die Zauberlisten** (T-212): welche Klasse und Unterklasse welchen
 * Zauber auf ihrer Liste hat. 5e.tools hält das nicht an der Klasse und
 * nicht am Zauber, sondern in einer Nachschlagedatei
 * (`generated/gendata-spell-source-lookup.json`):
 *
 *     { <zauberquelle>: { <zaubername>: {
 *         class:        { <klassenquelle>: { <Klasse>: true } },
 *         classVariant: { <klassenquelle>: { <Klasse>: { definedInSources } } },
 *         subclass:     { <klassenquelle>: { <Klasse>: { <uk-quelle>: { <Kurzname>: { name } } } } },
 *         … } } }
 *
 * Daraus wird je Paar eine Kante `spellList` an der Klasse (nicht `grants`:
 * dessen Ziele brächten ihre Wirkungen ohne Bedingung an die Figur,
 * `effectsAt`). `classVariant` sind die optionalen Ergänzungen (Tasha's) —
 * die Kante sagt es mit `optional`. Was nicht hereinkam (Quelle gesiebt),
 * zählt der Bericht und bleibt weg.
 *
 * Neben den Kanten der **Plan** (`zauberlistenPlan`): auf einem Server, der
 * die Klassen schon hat, bringt `--only-new` keine neue Kante an einen
 * bestehenden Artikel — dafür liest `scripts/zauberlisten-5etools.mjs` den
 * Plan und schreibt die Kanten als Massenänderung (wie der Bildplan, T-144).
 */

import type { Entity } from '@nw/model';
import type { Knoten } from '../copy.js';
import type { Werkbank } from '../werkbank.js';
import { zaehle } from '../werkbank.js';

const objekt = (x: unknown): Knoten => (x && typeof x === 'object' && !Array.isArray(x) ? (x as Knoten) : {});

/** Die Kanten aus der Nachschlagedatei; zählt Gefundenes und Fehlendes in den Bericht. */
export function zauberlisten(wb: Werkbank, lookup: Knoten | undefined): void {
  if (!lookup) return;
  const b = wb.artBericht('spellSourceLookup');
  /* Je Klasse und Zauber eine Kante; „pflicht" schlägt „optional". */
  const kanten = new Map<Entity, Map<string, boolean>>();
  const dazu = (klasse: Entity | undefined, was: string, zauber: Entity, optional: boolean) => {
    if (!klasse) {
      zaehle(b.notizen, `${was} nicht hereingekommen`);
      return;
    }
    const m = kanten.get(klasse) ?? kanten.set(klasse, new Map()).get(klasse)!;
    m.set(zauber.id, (m.get(zauber.id) ?? true) && optional);
  };
  for (const [zQuelle, zauberJe] of Object.entries(objekt(lookup))) {
    for (const [zName, eintrag] of Object.entries(objekt(zauberJe))) {
      b.gelesen += 1;
      const zauber = wb.finde('spell', [zName, zQuelle]);
      if (!zauber) {
        zaehle(b.notizen, 'Zauber nicht hereingekommen');
        continue;
      }
      const e = objekt(eintrag);
      for (const [kQuelle, klassen] of Object.entries(objekt(e['class']))) {
        for (const k of Object.keys(objekt(klassen))) dazu(wb.finde('class', [k, kQuelle]), 'Klasse', zauber, false);
      }
      for (const [kQuelle, klassen] of Object.entries(objekt(e['classVariant']))) {
        for (const k of Object.keys(objekt(klassen))) dazu(wb.finde('class', [k, kQuelle]), 'Klasse', zauber, true);
      }
      for (const [kQuelle, klassen] of Object.entries(objekt(e['subclass']))) {
        for (const [k, quellen] of Object.entries(objekt(klassen))) {
          for (const [uQuelle, unter] of Object.entries(objekt(quellen))) {
            for (const kurz of Object.keys(objekt(unter))) dazu(wb.finde('subclass', [kurz, k, kQuelle, uQuelle]), 'Unterklasse', zauber, false);
          }
        }
      }
    }
  }
  for (const [klasse, zauber] of kanten) {
    for (const [id, optional] of zauber) {
      if ((klasse.relations ?? []).some((r) => r.type === 'spellList' && r.to === id)) continue;
      wb.kante(klasse, 'spellList', id, optional ? { optional: true } : undefined);
    }
    zaehle(b.artikel, klasse.interfaces[0] ?? 'Class', zauber.size);
  }
}

/** Eine Zauberliste im Plan: die Klasse und ihre Zauber, mit den Peg-Ids des Laufs. */
export interface ZauberlistenEintrag {
  /** Peg-Id der Klasse oder Unterklasse. */
  von: string;
  nummer: string;
  name: string;
  art: 'Class' | 'Subclass';
  quelle: string;
  zauber: { to: string; optional?: true }[];
}

export interface ZauberlistenPlan {
  format: 'atlas-zauberlisten/1';
  listen: ZauberlistenEintrag[];
}

/** Der Plan aus dem fertigen Bestand — nach Doppeln und Fassungen, mit den Ids, die der Server kennt. */
export function zauberlistenPlan(entities: readonly Entity[]): ZauberlistenPlan {
  const listen: ZauberlistenEintrag[] = [];
  for (const e of entities) {
    const art = e.interfaces[0];
    if (art !== 'Class' && art !== 'Subclass') continue;
    const zauber = (e.relations ?? [])
      .filter((r) => r.type === 'spellList')
      .map((r) => (r.props?.['optional'] === true ? { to: r.to, optional: true as const } : { to: r.to }));
    if (!zauber.length) continue;
    listen.push({
      von: e.id,
      nummer: String((e.components['Identity'] as { id?: string } | undefined)?.id ?? ''),
      name: e.name,
      art,
      quelle: String((e.components['Source'] as { publication?: string } | undefined)?.publication ?? ''),
      zauber,
    });
  }
  return { format: 'atlas-zauberlisten/1', listen };
}

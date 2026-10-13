/**
 * **Zusammenführen statt still gewinnen** (REQ-192).
 *
 * Zwei Geräte bearbeiten denselben Artikel. Der zweite Schreiber wird am
 * Server abgewiesen (die Revision stimmt nicht mehr), bekommt den neuen
 * Stand und führt hier drei Fassungen zusammen: die, von der er ausging
 * (`base`), seine eigene (`mine`) und die, die inzwischen gilt
 * (`theirs`). Verglichen wird je Feld (`Karte.feld`), je Kante (nach ihrer
 * Id), dazu Name, Arten und die freien Felder als Ganzes:
 *
 * - beide gleich → das
 * - nur ich geändert → meins
 * - nur die anderen geändert → ihres
 * - beide verschieden geändert → **Konflikt**; gewählt wird, was `prefer`
 *   für diesen Schlüssel sagt, sonst meins — die Maske fragt nach.
 *
 * „Nicht da" ist ein Wert wie jeder andere: wer ein Feld leert, hat es
 * geändert. Die Revision des Ergebnisses ist die der geltenden Fassung,
 * denn gegen sie wird als Nächstes geschrieben.
 */

import { stableJson } from './checks.js';
import type { Entity, Relation } from './types.js';

export type MergeSide = 'mine' | 'theirs';

export interface MergeConflict {
  /** `Karte.feld`, `edge:<id>`, `card:<Karte>`, `name`, `interfaces` oder `adhoc`. */
  key: string;
  kind: 'field' | 'card' | 'edge' | 'name' | 'interfaces' | 'adhoc';
  base: unknown;
  mine: unknown;
  theirs: unknown;
}

export interface MergeResult {
  merged: Entity;
  conflicts: MergeConflict[];
  /** Schlüssel, die nur die anderen geändert haben — sie sind übernommen. */
  taken: string[];
}

const gleich = (a: unknown, b: unknown): boolean => stableJson(a) === stableJson(b);

/** Ein Schlüssel, drei Fassungen: was gilt, und ob es ein Konflikt war. */
function waehle(
  key: string,
  base: unknown,
  mine: unknown,
  theirs: unknown,
  prefer: Readonly<Record<string, MergeSide>>,
): { wert: unknown; konflikt: boolean; uebernommen: boolean } {
  if (gleich(mine, theirs)) return { wert: mine, konflikt: false, uebernommen: false };
  if (gleich(mine, base)) return { wert: theirs, konflikt: false, uebernommen: true };
  if (gleich(theirs, base)) return { wert: mine, konflikt: false, uebernommen: false };
  return { wert: prefer[key] === 'theirs' ? theirs : mine, konflikt: true, uebernommen: false };
}

/** Schlüssel in der Reihenfolge der geltenden Fassung, die neuen dahinter. */
function reihe(...listen: string[][]): string[] {
  const out: string[] = [];
  const da = new Set<string>();
  for (const l of listen) {
    for (const k of l) {
      if (da.has(k)) continue;
      da.add(k);
      out.push(k);
    }
  }
  return out;
}

export function mergeEntity(
  base: Entity,
  mine: Entity,
  theirs: Entity,
  prefer: Readonly<Record<string, MergeSide>> = {},
): MergeResult {
  const conflicts: MergeConflict[] = [];
  const taken: string[] = [];
  const nimm = (
    key: string,
    kind: MergeConflict['kind'],
    b: unknown,
    m: unknown,
    t: unknown,
  ): unknown => {
    const r = waehle(key, b, m, t, prefer);
    if (r.konflikt) conflicts.push({ key, kind, base: b, mine: m, theirs: t });
    if (r.uebernommen) taken.push(key);
    return r.wert;
  };

  const name = nimm('name', 'name', base.name, mine.name, theirs.name) as string;
  const interfaces = nimm('interfaces', 'interfaces', base.interfaces, mine.interfaces, theirs.interfaces) as string[];
  const adhoc = nimm('adhoc', 'adhoc', base.adhoc ?? [], mine.adhoc ?? [], theirs.adhoc ?? []) as Entity['adhoc'];

  const bc = base.components ?? {};
  const mc = mine.components ?? {};
  const tc = theirs.components ?? {};
  const components: Entity['components'] = {};
  for (const karte of reihe(Object.keys(tc), Object.keys(mc), Object.keys(bc))) {
    const b = bc[karte];
    const m = mc[karte];
    const t = tc[karte];
    /* Ob die Karte überhaupt da ist, ist eine eigene Frage: eine leere
       Pflichtkarte ist etwas anderes als keine. */
    const da = nimm(`card:${karte}`, 'card', b !== undefined, m !== undefined, t !== undefined);
    const karteNeu: Record<string, unknown> = {};
    for (const feld of reihe(Object.keys(t ?? {}), Object.keys(m ?? {}), Object.keys(b ?? {}))) {
      const wert = nimm(`${karte}.${feld}`, 'field', b?.[feld], m?.[feld], t?.[feld]);
      if (wert !== undefined) karteNeu[feld] = wert;
    }
    if (da || Object.keys(karteNeu).length) components[karte] = karteNeu;
  }

  const kanten = (e: Entity): Map<string, Relation> => new Map((e.relations ?? []).map((r) => [r.id, r]));
  const br = kanten(base);
  const mr = kanten(mine);
  const tr = kanten(theirs);
  const relations: Relation[] = [];
  for (const id of reihe([...tr.keys()], [...mr.keys()], [...br.keys()])) {
    const kante = nimm(`edge:${id}`, 'edge', br.get(id), mr.get(id), tr.get(id)) as Relation | undefined;
    if (kante) relations.push(kante);
  }

  const merged: Entity = { ...theirs, name, interfaces, components, relations };
  if (adhoc?.length || theirs.adhoc) merged.adhoc = adhoc ?? [];
  if (theirs.revision !== undefined) merged.revision = theirs.revision;
  return { merged, conflicts, taken };
}

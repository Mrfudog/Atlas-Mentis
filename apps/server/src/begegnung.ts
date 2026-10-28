/**
 * **Was eine Begegnung über ihre Beteiligten weiss** (T-215, REQ-085):
 * die Haltung jedes Beteiligten zur Gruppe und welche Hinweise schon
 * freigegeben sind. Beides ist eine Abfrage beim Lesen (D8) und kommt als
 * `refs.encounter` mit dem Artikel — nichts davon wird gespeichert.
 *
 * - **Haltung:** die Ziele der `features`-Kanten, die ein Gegenüber sein
 *   können (`Creature`, `Faction`), gesiebt wie jeder Artikel, mit ihren
 *   `regards`-Kanten auf die Gruppen der laufenden Kampagne (Marken und
 *   Grund). Eine Haltung zu einer anderen Gruppe gehört nicht hierher. Ein
 *   Beteiligter ohne Haltung steht trotzdem da — „noch nichts gesagt“ ist
 *   eine Auskunft.
 * - **Freigegebene Hinweise** (nur für die Leitung): die Einträge von
 *   `Encounter.hint`, die eine Information über diese Begegnung nennt und
 *   die einer Gruppe zugeteilt ist (direkt oder über ein Bündel).
 */

import {
  bundlesWith,
  entityName,
  infoApplies,
  informationsOf,
  INFO_COMPONENT,
  KNOWN_BY_RELATION,
  partiesOf,
  primaryInterface,
  typeChain,
  type Entity,
  type Registry,
} from '@nw/model';

const ENCOUNTER = 'Encounter';
/** Wer an einer Begegnung eine Haltung haben kann — dieselben wie `regards.from` ohne die Gruppe. */
const GEGENUEBER = ['Creature', 'Faction'];

export interface Haltung {
  id: string;
  name: string;
  type: string;
  /** Je Gruppe der Kampagne, was dieser Beteiligte von ihr hält. */
  toward: { id: string; name: string; tags: string[]; note?: string }[];
}

export interface BegegnungsBezug {
  stances: Haltung[];
  /** `Encounter.hint#id`, die eine Gruppe schon kennt — nur für die Leitung. */
  revealed?: string[];
}

/** Ist das eine Begegnung (oder ein Untertyp davon)? */
export function istBegegnung(registry: Registry, e: Entity): boolean {
  return typeChain(registry, primaryInterface(e)).includes(ENCOUNTER);
}

/**
 * Die Haltungen der Beteiligten. `sichtbar` sind die Beteiligten, wie der
 * Betrachter sie bekommt (gesiebt, also mit seinen Kanten und Namen).
 */
export function haltungen(registry: Registry, map: ReadonlyMap<string, Entity>, sichtbar: readonly Entity[], kampagne: Entity | null): Haltung[] {
  const gruppen = kampagne ? partiesOf(map as Map<string, Entity>, kampagne.id) : [];
  const gruppenIds = new Set(gruppen.map((g) => g.id));
  return sichtbar
    .filter((e) => typeChain(registry, primaryInterface(e)).some((t) => GEGENUEBER.includes(t)))
    .map((e) => ({
      id: e.id,
      name: entityName(e),
      type: primaryInterface(e),
      toward: (e.relations ?? [])
        .filter((r) => r.type === 'regards' && gruppenIds.has(r.to))
        .map((r) => {
          const p = (r.props ?? {}) as { tags?: unknown; note?: unknown };
          const note = typeof p.note === 'string' && p.note.trim() ? p.note.trim() : undefined;
          return {
            id: r.to,
            name: entityName(map.get(r.to)),
            tags: Array.isArray(p.tags) ? p.tags.filter((t): t is string => typeof t === 'string') : [],
            ...(note ? { note } : {}),
          };
        }),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'));
}

/** Die Hinweise dieser Begegnung, die einer Gruppe schon zugeteilt sind. */
export function freigegebeneHinweise(registry: Registry, map: ReadonlyMap<string, Entity>, begegnung: Entity): string[] {
  const m = map as Map<string, Entity>;
  const istGruppe = (id: string) => {
    const g = m.get(id);
    return !!g && primaryInterface(g) === 'Party';
  };
  const bekannt = (x: Entity) => (x.relations ?? []).some((r) => r.type === KNOWN_BY_RELATION && istGruppe(r.to));
  const raus = new Set<string>();
  for (const info of informationsOf(m, begegnung, registry)) {
    if (infoApplies(info)?.article !== begegnung.id) continue;
    if (!bekannt(info) && !bundlesWith(m, info.id).some(bekannt)) continue;
    const fields = (info.components?.[INFO_COMPONENT] as { fields?: unknown } | undefined)?.fields;
    for (const f of Array.isArray(fields) ? fields : []) {
      if (typeof f === 'string' && f.startsWith(`${ENCOUNTER}.hint#`)) raus.add(f);
    }
  }
  return [...raus].sort();
}

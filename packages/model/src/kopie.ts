/**
 * **Fassung, Variante oder Kopie in einer anderen Ebene** (T-405, REQ-400,
 * E-162): wo Speichern nicht erlaubt ist — ein Artikel aus einem geteilten
 * Regelwerk —, und als Aktion an jedem Artikel. Drei Wege, je mit der
 * Zielebene:
 *
 *  - **Fassung** (`overrides`): tritt in der Kampagne an die Stelle des
 *    Originals, wie „Edit" an einem fremden Artikel (`adaptedVersion`).
 *  - **Variante** (`variantOf`): steht neben dem Original, mit Herkunft,
 *    und liest nichts nach.
 *  - **Kopie**: ein neuer, eigenständiger Artikel („(copy)" im Namen,
 *    damit zwei gleichnamige nicht wie Fassungen derselben Sache aussehen).
 *
 * Die Mitläufer (Teile, Statblock, Inventar — `layerMovePlan`, wie beim
 * Ebenenwechsel) gehen auf demselben Weg mit, und ihre Kanten, die auf
 * einen mitkopierten Artikel zeigen, zeigen danach auf dessen Kopie: das
 * Zimmer der Kopie hängt am kopierten Haus, nicht am Original. Kanten nach
 * draussen bleiben, wie sie sind. Ob eine Kopie dem Original folgt
 * (`copyOf`, E-167), ist ein zweiter Schritt.
 */
import type { Entity, EntityId, Relation } from './types.js';
import { LAYER_RELATION } from './visibility.js';
import { OVERRIDES_RELATION } from './stack.js';
import { VARIANT_RELATION } from './versions.js';

export type CopyMode = 'version' | 'variant' | 'copy';
export const COPY_MODES: readonly CopyMode[] = ['version', 'variant', 'copy'];

/** Kanten, die zum Original als Artikel gehören und an der Kopie neu entstehen. Eine Instanz bleibt Instanz. */
const NICHT_MIT = new Set([LAYER_RELATION, OVERRIDES_RELATION, VARIANT_RELATION]);

export function copyArticles(
  raw: ReadonlyMap<EntityId, Entity>,
  /** Der Artikel zuerst, dann seine Mitläufer. */
  ids: readonly EntityId[],
  opts: { mode: CopyMode; layer: EntityId; newId: () => EntityId; number: (type: string) => string },
): { from: EntityId; entity: Entity }[] {
  const kopie = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
  const quellen = [...new Set(ids)].map((id) => raw.get(id)).filter((e): e is Entity => !!e);
  const neu = new Map(quellen.map((e) => [e.id, opts.newId()]));
  return quellen.map((e, i) => {
    const id = neu.get(e.id)!;
    const typ = e.interfaces?.[0] ?? '';
    const components = kopie(e.components ?? {});
    const name = String(components['Identity']?.['name'] ?? e.name ?? '');
    /* Nur der Artikel selbst heisst „(copy)" — seine Teile sind Teile der Kopie. */
    const neuerName = opts.mode === 'copy' && i === 0 && name ? `${name} (copy)` : name;
    components['Identity'] = { ...(components['Identity'] ?? {}), id: opts.number(typ), ...(neuerName ? { name: neuerName } : {}) };
    const mit = (e.relations ?? []).filter((r) => !NICHT_MIT.has(r.type));
    const relations: Relation[] = [
      ...mit.map((r, k) => ({ ...kopie(r), id: `${id}~${r.type}-${k + 1}`, to: neu.get(r.to) ?? r.to })),
      { id: `${id}~${LAYER_RELATION}`, type: LAYER_RELATION, to: opts.layer, props: {} },
    ];
    if (opts.mode === 'version') relations.push({ id: `${id}~${OVERRIDES_RELATION}`, type: OVERRIDES_RELATION, to: e.id, props: {} });
    if (opts.mode === 'variant') relations.push({ id: `${id}~${VARIANT_RELATION}`, type: VARIANT_RELATION, to: e.id, props: {} });
    return {
      from: e.id,
      entity: { id, interfaces: [...(e.interfaces ?? [])], ...(neuerName ? { name: neuerName } : e.name ? { name: e.name } : {}), components, relations } as Entity,
    };
  });
}

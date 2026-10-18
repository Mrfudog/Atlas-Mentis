/**
 * **Die Sichtbarkeit je Gruppe einer Kampagne** (T-252, E-098): ihre
 * Regeln samt den Dimensionen, gegen die deren Schlüssel prüfen. Eine
 * Stelle für Server und Übersicht — prüften beide mit eigenen
 * Dimensionen, träfe dieselbe Regel hier etwas anderes als dort.
 *
 * Eigenes Modul, weil es die Transformationen (T-253) braucht und diese
 * über die Ebenen von der Sichtbarkeit abhängen.
 */

import { entityName } from './entity.js';
import { GROUP_RELATION } from './stack.js';
import { articleDimensions } from './transform.js';
import type { Dimension } from './transformkeys.js';
import type { Entity, EntityId, Registry } from './types.js';
import { visibilityRulesOf, type CampaignVisibility } from './visibility.js';

/**
 * Die Dimensionen, nach denen die Sichtbarkeit gruppiert: Ebene (mit
 * Namen), Ebenengruppe (`partOf` der Ebene, E-022 b), Art, Bereich,
 * Marke, Status, Sichtbarkeit. Das Regelmodul kommt mit T-222.
 */
export function visibilityDimensions(
  entities: Map<EntityId, Entity>,
  registry: Pick<Registry, 'interfaces'>,
): Dimension<Entity>[] {
  const gruppen = new Map<EntityId, EntityId[]>();
  return articleDimensions(registry, {
    layerName: (id) => entityName(entities.get(id)),
    groupName: (id) => entityName(entities.get(id)),
    layerGroups: (l) => {
      let g = gruppen.get(l);
      if (!g) {
        g = (entities.get(l)?.relations ?? []).filter((r) => r.type === GROUP_RELATION).map((r) => r.to);
        gruppen.set(l, g);
      }
      return g;
    },
  });
}

/** Die Regeln dieser Kampagne für `Viewer.campaignRules`; ohne Regeln `undefined`. */
export function campaignVisibility(
  entities: Map<EntityId, Entity>,
  registry: Pick<Registry, 'interfaces'>,
  campaign: Entity | null | undefined,
): CampaignVisibility | undefined {
  if (!campaign) return undefined;
  const rules = visibilityRulesOf(campaign);
  if (!rules.length) return undefined;
  return { campaign: campaign.id, rules, dims: visibilityDimensions(entities, registry) };
}

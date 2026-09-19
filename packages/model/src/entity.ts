/**
 * Reading the registry: what an interface allows, what a relation may target,
 * and what points back at an entity.
 *
 * Interface inheritance unions `requires`, `allows` and `relations` from
 * `extends`. For `blockTypes`, a `+x` entry adds to the inherited set and a
 * bare list replaces it.
 */

import type {
  Backlink,
  Entity,
  EntityId,
  InterfaceDef,
  Registry,
  RelationDef,
} from './types.js';

export function entityName(entity: Entity | undefined): string {
  if (!entity) return 'Ohne Namen';
  const fromComponent = entity.components?.['Name']?.['text'];
  return entity.name || (typeof fromComponent === 'string' ? fromComponent : '') || 'Ohne Namen';
}

export function primaryInterface(entity: Entity): string {
  return entity.interfaces?.[0] ?? '';
}

function walk<T>(
  registry: Pick<Registry, 'interfaces'>,
  name: string,
  pick: (def: InterfaceDef) => T[] | undefined,
  seen = new Set<string>(),
): T[] {
  const def = registry.interfaces[name];
  if (!def || seen.has(name)) return [];
  seen.add(name);
  const inherited = (def.extends ?? []).flatMap((parent) => walk(registry, parent, pick, seen));
  return [...inherited, ...(pick(def) ?? [])];
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

/** Components this interface requires. */
export function requiredComponents(registry: Pick<Registry, 'interfaces'>, name: string): string[] {
  return unique(walk(registry, name, (d) => d.requires));
}

/** Components this interface may carry: requires ∪ allows, inherited included. */
export function allowedComponents(
  registry: Pick<Registry, 'interfaces' | 'components'>,
  name: string,
): string[] {
  const all = unique([
    ...walk(registry, name, (d) => d.requires),
    ...walk(registry, name, (d) => d.allows),
  ]);
  return all.filter((c) => registry.components[c]);
}

/** Block types this interface accepts, resolving `+x` additions. */
export function blockTypesFor(registry: Pick<Registry, 'interfaces'>, name: string): string[] {
  const raw = walk(registry, name, (d) => d.blockTypes);
  const out: string[] = [];
  for (const entry of raw) {
    out.push(entry.startsWith('+') ? entry.slice(1) : entry);
  }
  return unique(out.length ? out : ['paragraph']);
}

/** Relation definitions whose source may be this interface. */
export function relationsFrom(
  registry: Pick<Registry, 'relations'>,
  interfaceName: string,
): RelationDef[] {
  return Object.values(registry.relations).filter((def) => {
    const from = def.from ?? ['*'];
    return from.includes('*') || from.includes(interfaceName);
  });
}

/** May this relation point at that entity? `same` means the source's own interface. */
export function relationAccepts(
  def: RelationDef,
  sourceInterface: string,
  targetInterface: string,
): boolean {
  const to = def.to ?? ['*'];
  if (to.includes('*')) return true;
  if (to.includes('same') && targetInterface === sourceInterface) return true;
  return to.includes(targetInterface);
}

export function relationDef(
  registry: Pick<Registry, 'relations'>,
  type: string,
): RelationDef {
  return (
    registry.relations[type] ?? {
      type,
      label: type,
      inverseLabel: `← ${type}`,
      to: ['*'],
    }
  );
}

/**
 * Everything pointing at `id`. Forward edges are the only stored form, so the
 * reverse direction is always this query — which is why a relation can never
 * be half-orphaned the way a mirrored pair can.
 */
export function backlinks(
  registry: Pick<Registry, 'relations'>,
  entities: Iterable<Entity>,
  id: EntityId,
): Backlink[] {
  const found: Backlink[] = [];
  for (const entity of entities) {
    for (const relation of entity.relations ?? []) {
      if (relation.to === id) {
        found.push({ from: entity, relation, def: relationDef(registry, relation.type) });
      }
    }
  }
  return found;
}

/** Outgoing edges, split into composition sections and plain references. */
export function splitRelations(
  registry: Pick<Registry, 'relations'>,
  entity: Entity,
): { sections: Record<string, typeof entity.relations>; plain: NonNullable<typeof entity.relations> } {
  const sections: Record<string, NonNullable<typeof entity.relations>> = {};
  const plain: NonNullable<typeof entity.relations> = [];
  for (const relation of entity.relations ?? []) {
    const def = registry.relations[relation.type];
    if (def?.section) {
      (sections[def.section] ??= []).push(relation);
    } else {
      plain.push(relation);
    }
  }
  return { sections, plain };
}

/** Resolve a name or alias to an entity id — the Registry engine's job (REQ-013). */
export function findByName(entities: Iterable<Entity>, name: string): Entity | undefined {
  const needle = String(name ?? '').trim().toLowerCase();
  if (!needle) return undefined;
  for (const entity of entities) {
    if (entityName(entity).toLowerCase() === needle) return entity;
    const aliases = entity.components?.['Identity']?.['aliases'];
    if (Array.isArray(aliases) && aliases.some((a) => String(a).toLowerCase() === needle)) {
      return entity;
    }
  }
  return undefined;
}

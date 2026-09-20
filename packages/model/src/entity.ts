/**
 * Reading the registry: which fields a type carries, what a relation may
 * target, and what points back at an entity.
 *
 * Vererbung vereinigt Felder und Kanten über `extends`. Bei `blockTypes`
 * ergänzt ein `+x` die geerbte Menge, eine blosse Liste ersetzt sie.
 */

import type {
  Backlink,
  Entity,
  EntityId,
  InterfaceDef,
  PropertySchema,
  Registry,
  RelationDef,
} from './types.js';

export function entityName(entity: Entity | undefined): string {
  if (!entity) return 'Ohne Namen';
  const ausKarte = entity.components?.['Identity']?.['name'];
  return entity.name || (typeof ausKarte === 'string' ? ausKarte : '') || 'Ohne Namen';
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

/**
 * Die Arten, deren Felder hier gelten: diese und alle Obertypen.
 *
 * Das ist zugleich die Liste der Karten, die ein Artikel dieser Art tragen
 * darf — eine Karte heisst nach der Art, die ihre Felder erklärt.
 */
export function typeChain(registry: Pick<Registry, 'interfaces'>, name: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const offen = [name];
  while (offen.length) {
    const at = offen.shift() as string;
    if (seen.has(at) || !registry.interfaces[at]) continue;
    seen.add(at);
    out.push(at);
    for (const p of registry.interfaces[at]?.extends ?? []) offen.push(p);
  }
  return out;
}

/** The fields of one type — its own only, not the inherited ones. */
export function ownFields(
  registry: Pick<Registry, 'interfaces'>,
  name: string,
): Record<string, PropertySchema> {
  return registry.interfaces[name]?.schema?.properties ?? {};
}

/**
 * Ein Feld mitsamt der Art, die es erklärt. Heisst nicht `FieldRef`, weil das
 * im Wissensteil schon eine Zeichenkette ist (`Type.field`) — zwei Namen für
 * zwei Sachen sind besser als ein Name für beide.
 */
export interface TypedField {
  type: string;
  key: string;
  prop: PropertySchema;
}

/**
 * Every field an article of this type may carry, own ones first and the
 * inherited ones behind them, each with the type that declares it.
 */
export function fieldsOf(registry: Pick<Registry, 'interfaces'>, name: string): TypedField[] {
  const out: TypedField[] = [];
  for (const t of typeChain(registry, name)) {
    for (const [key, prop] of Object.entries(ownFields(registry, t))) out.push({ type: t, key, prop });
  }
  return out;
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

/**
 * Is this interface in that list — directly, as `*`, or through one of its
 * ancestors?
 *
 * Matching the name literally means an edge anchored on an abstract parent
 * reaches none of its subtypes: `from: ['Creature']` would be offered on
 * nothing, because every creature is a subtype and none *is* `Creature`.
 * The walk goes upward only — `from: ['NPC']` stays an NPC edge and does not
 * leak onto everything that happens to be a creature.
 */
function interfaceInList(
  registry: Pick<Registry, 'interfaces'>,
  list: readonly string[] | undefined,
  interfaceName: string,
): boolean {
  if (!list || list.length === 0 || list.includes('*')) return true;
  /* **Alle** Obertypen, nicht nur der erste. `extends` ist ein Array, und
     eine Art, die von zweien erbt, erbt von beiden — dass der Code bisher
     nur `[0]` las, hiess: die zweite Herkunft galt für die Felder (dort
     wird schon `flatMap` gelaufen), aber nicht für die Kanten. Zwei
     Antworten auf dieselbe Frage, und die eine war still falsch. */
  const seen = new Set<string>();
  const offen: string[] = [interfaceName];
  while (offen.length) {
    const at = offen.pop() as string;
    if (seen.has(at)) continue;
    if (list.includes(at)) return true;
    seen.add(at);
    for (const p of registry.interfaces[at]?.extends ?? []) offen.push(p);
  }
  return false;
}

/** Relation definitions whose source may be this interface. */
export function relationsFrom(
  registry: Pick<Registry, 'relations' | 'interfaces'>,
  interfaceName: string,
): RelationDef[] {
  return Object.values(registry.relations).filter((def) =>
    interfaceInList(registry, def.from, interfaceName),
  );
}

/** May this relation point at that entity? `same` means the source's own interface. */
export function relationAccepts(
  def: RelationDef,
  sourceInterface: string,
  targetInterface: string,
  registry?: Pick<Registry, 'interfaces'>,
): boolean {
  const to = def.to ?? ['*'];
  if (to.includes('*')) return true;
  if (to.includes('same') && targetInterface === sourceInterface) return true;
  if (registry) return interfaceInList(registry, to, targetInterface);
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

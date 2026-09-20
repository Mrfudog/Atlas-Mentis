/**
 * The Validation engine.
 *
 * On write: read the asserted type, walk its chain, and check that every card
 * names a type in that chain and that every required field is filled. Strict
 * by default (D2) unless the caller opts into expert mode.
 *
 * Zod guards the shape of registry rows and entities at the storage boundary —
 * the place where a malformed document would otherwise become a silent
 * corruption that only surfaces months later.
 */

import { z } from 'zod';
import { typeChain } from './entity.js';
import type { Entity, LayoutElement, Registry } from './types.js';

const propertyType = z.enum(['string', 'number', 'integer', 'boolean', 'array', 'object']);

const propertySchema = z.object({
  type: propertyType,
  title: z.string().optional(),
  enum: z.array(z.string()).optional(),
  format: z.string().optional(),
  items: z.object({ type: propertyType }).optional(),
  derived: z.string().optional(),
  of: z.string().optional(),
  unit: z.string().optional(),
  many: z.boolean().optional(),
  readOnly: z.boolean().optional(),
  default: z.unknown().optional(),
});

const objectSchema = z.object({
  type: z.literal('object'),
  required: z.array(z.string()).optional(),
  properties: z.record(z.string(), propertySchema),
  additionalProperties: z.boolean().optional(),
});

/* Ein Reiter enthält ein Layout, und ein Layout kann Reiter enthalten —
   also ist das Schema rekursiv. `z.lazy` ist dafür da; die Tiefe begrenzt
   niemand, weil Reiter in Reitern niemand baut und eine Grenze, die nie
   greift, nur eine Zahl ist, die jemand erklären muss. */
const LayoutElementSchema: z.ZodType<LayoutElement> = z.lazy(() =>
  z.object({
    id: z.string(),
    el: z.enum(['heading', 'text', 'fields', 'prose', 'description', 'composed', 'relations', 'image', 'knowledge', 'map', 'sheet', 'inventory', 'crafting', 'board', 'initiative', 'quests', 'timeline', 'live', 'table', 'prep', 'crawl', 'stack', 'standing', 'tabs']),
    text: z.string().optional(),
    fields: z.union([z.literal('all'), z.array(z.string())]).optional(),
    except: z.array(z.string()).optional(),
    columns: z.number().optional(),
    tabs: z
      .array(
        z.object({
          id: z.string(),
          label: z.string(),
          layout: z.array(LayoutElementSchema),
        }),
      )
      .optional(),
  }),
);

export const InterfaceDefSchema = z.object({
  name: z.string(),
  label: z.string().optional(),
  abstract: z.boolean().optional(),
  extends: z.array(z.string()).optional(),
  schema: objectSchema.optional(),
  area: z.enum(['world', 'history', 'rules', 'play']).optional(),
  views: z.record(z.string(), z.array(LayoutElementSchema)).optional(),
  units: z.enum(['imperial', 'metric', 'both']).optional(),
  /* `Typ.feld` → Beschriftung. Eine Beschriftung und keine Feldliste. */
  titles: z.record(z.string(), z.string()).optional(),
});

export const UnitDefSchema = z.object({
  code: z.string(),
  label: z.string(),
  quantity: z.string(),
  system: z.enum(['imperial', 'metric']),
  base: z.number(),
  aliases: z.array(z.string()).optional(),
  decimals: z.number().optional(),
});

export const RelationDefSchema = z.object({
  type: z.string(),
  label: z.string(),
  inverseLabel: z.string(),
  from: z.array(z.string()).optional(),
  to: z.array(z.string()).optional(),
  owned: z.boolean().optional(),
  cardinality: z.enum(['one', 'many']).optional(),
  section: z.string().optional(),
  props: objectSchema.optional(),
});

export const ViewDefSchema = z.object({
  label: z.string(),
  order: z.number().optional(),
  fields: z.union([z.literal('all'), z.literal('none'), z.array(z.string())]),
  description: z.boolean().optional(),
  composed: z.boolean().optional(),
  relations: z.boolean().optional(),
  bindings: z.boolean().optional(),
  image: z.boolean().optional(),
  layout: z.array(LayoutElementSchema).optional(),
});

export const RegistrySchema = z.object({
  interfaces: z.record(z.string(), InterfaceDefSchema),
  relations: z.record(z.string(), RelationDefSchema),
  views: z.record(z.string(), ViewDefSchema),
  units: z.record(z.string(), UnitDefSchema),
  vars: z.record(z.string(), z.string()),
  settings: z.record(z.string(), z.string()).optional(),
});


export const RelationSchema = z.object({
  id: z.string(),
  type: z.string(),
  to: z.string(),
  props: z.record(z.string(), z.unknown()).optional(),
});

export const EntitySchema = z.object({
  id: z.string().min(1),
  interfaces: z.array(z.string()).min(1),
  name: z.string(),
  components: z.record(z.string(), z.record(z.string(), z.unknown())),
  adhoc: z
    .array(z.object({ key: z.string(), label: z.string(), type: z.string(), value: z.unknown() }))
    .optional(),
  relations: z.array(RelationSchema).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export interface ValidationIssue {
  code:
    | 'unknown_interface'
    | 'card_not_inherited'
    | 'unknown_card'
    | 'missing_property'
    | 'dangling_relation'
    | 'unknown_relation';
  message: string;
  /** Die Art, deren Karte es betrifft. */
  component?: string;
  property?: string;
  relation?: string;
}

export interface ValidateOptions {
  /** D2: when true, cards outside the type's chain are tolerated. */
  expertMode?: boolean;
  /** Ids that exist, so dangling edges can be reported. Omit to skip that check. */
  knownIds?: ReadonlySet<string>;
}

/** Check one entity against the registry. An empty array means it is valid. */
export function validateEntity(
  registry: Registry,
  entity: Entity,
  options: ValidateOptions = {},
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const name = entity.interfaces?.[0];

  if (!name || !registry.interfaces[name]) {
    issues.push({
      code: 'unknown_interface',
      message: `Unknown interface: ${name ?? '(none)'}`,
    });
    return issues;
  }

  const kette = typeChain(registry, name);
  const erlaubt = new Set(kette);

  /* Eine Karte, die keine Art des Artikels nennt, ist kein Tippfehler im
     Register, sondern ein Wert ohne Erklärung: es gibt kein Feld, das ihn
     beschreibt, und keine Ansicht, die ihn zeigt. */
  for (const card of Object.keys(entity.components ?? {})) {
    if (!registry.interfaces[card]) {
      issues.push({
        code: 'unknown_card',
        component: card,
        message: `${card} is not a type in the registry`,
      });
      continue;
    }
    if (!erlaubt.has(card) && !options.expertMode) {
      issues.push({
        code: 'card_not_inherited',
        component: card,
        message: `${name} does not inherit from ${card}`,
      });
    }
  }

  /* Pflichtfelder gelten für die ganze Kette, auch wenn die Karte gar nicht
     da ist: eine fehlende Karte ist kein leerer Wert, sondern derselbe. */
  for (const type of kette) {
    const schema = registry.interfaces[type]?.schema;
    if (!schema) continue;
    const card = entity.components?.[type];
    for (const property of schema.required ?? []) {
      const prop = schema.properties[property];
      if (prop?.derived) continue; // derived values are never stored
      if (card?.[property] === undefined || card[property] === '') {
        issues.push({
          code: 'missing_property',
          component: type,
          property,
          message: `${type}.${property} is required`,
        });
      }
    }
  }

  for (const relation of entity.relations ?? []) {
    if (!registry.relations[relation.type]) {
      issues.push({
        code: 'unknown_relation',
        relation: relation.type,
        message: `Relation type ${relation.type} is not in the registry`,
      });
    }
    if (options.knownIds && !options.knownIds.has(relation.to)) {
      issues.push({
        code: 'dangling_relation',
        relation: relation.type,
        message: `${relation.type} points at ${relation.to}, which does not exist`,
      });
    }
  }

  return issues;
}

/**
 * The Validation engine.
 *
 * On write: read the asserted interfaces, load their definitions, and check
 * that every required component is present and that no component outside
 * requires ∪ allows is carried. `allows` is strict (D2) unless the caller
 * opts into expert mode.
 *
 * Zod guards the shape of registry rows and entities at the storage boundary —
 * the place where a malformed document would otherwise become a silent
 * corruption that only surfaces months later.
 */

import { z } from 'zod';
import { allowedComponents, requiredComponents } from './entity.js';
import type { Entity, Registry } from './types.js';

const propertyType = z.enum(['string', 'number', 'integer', 'boolean', 'array', 'object']);

const propertySchema = z.object({
  type: propertyType,
  title: z.string().optional(),
  enum: z.array(z.string()).optional(),
  format: z.string().optional(),
  items: z.object({ type: propertyType }).optional(),
  derived: z.string().optional(),
  of: z.string().optional(),
  default: z.unknown().optional(),
});

const objectSchema = z.object({
  type: z.literal('object'),
  required: z.array(z.string()).optional(),
  properties: z.record(z.string(), propertySchema),
  additionalProperties: z.boolean().optional(),
});

export const ComponentDefSchema = z.object({
  name: z.string(),
  label: z.string().optional(),
  engine: z.string().nullable(),
  schema: objectSchema,
});

export const InterfaceDefSchema = z.object({
  name: z.string(),
  label: z.string().optional(),
  abstract: z.boolean().optional(),
  extends: z.array(z.string()).optional(),
  requires: z.array(z.string()).optional(),
  allows: z.array(z.string()).optional(),
  blockTypes: z.array(z.string()).optional(),
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

const LayoutElementSchema = z.object({
  id: z.string(),
  el: z.enum(['heading', 'text', 'fields', 'blocks', 'description', 'composed', 'relations', 'image', 'knowledge']),
  text: z.string().optional(),
  fields: z.union([z.literal('all'), z.array(z.string())]).optional(),
  columns: z.number().optional(),
  blocks: z.union([z.literal('all'), z.array(z.string())]).optional(),
});

export const ViewDefSchema = z.object({
  label: z.string(),
  order: z.number().optional(),
  fields: z.union([z.literal('all'), z.literal('none'), z.array(z.string())]),
  blocks: z.union([z.literal('all'), z.array(z.string())]),
  description: z.boolean().optional(),
  composed: z.boolean().optional(),
  relations: z.boolean().optional(),
  bindings: z.boolean().optional(),
  image: z.boolean().optional(),
  layout: z.array(LayoutElementSchema).optional(),
  byInterface: z.record(z.string(), z.array(LayoutElementSchema)).optional(),
});

export const RegistrySchema = z.object({
  components: z.record(z.string(), ComponentDefSchema),
  interfaces: z.record(z.string(), InterfaceDefSchema),
  relations: z.record(z.string(), RelationDefSchema),
  views: z.record(z.string(), ViewDefSchema),
  vars: z.record(z.string(), z.string()),
});

export const BlockSchema = z.object({
  id: z.string(),
  blockType: z.string(),
  body: z.string(),
  order: z.number(),
  anchor: z.string().optional(),
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
  tags: z.array(z.string()),
  components: z.record(z.string(), z.record(z.string(), z.unknown())),
  adhoc: z
    .array(z.object({ key: z.string(), label: z.string(), type: z.string(), value: z.unknown() }))
    .optional(),
  blocks: z.array(BlockSchema).optional(),
  relations: z.array(RelationSchema).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export interface ValidationIssue {
  code: 'unknown_interface' | 'missing_component' | 'component_not_allowed' | 'unknown_component' | 'missing_property' | 'dangling_relation' | 'unknown_relation';
  message: string;
  component?: string;
  property?: string;
  relation?: string;
}

export interface ValidateOptions {
  /** D2: when true, components outside requires ∪ allows are tolerated. */
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

  const required = requiredComponents(registry, name);
  const allowed = new Set(allowedComponents(registry, name));

  for (const component of required) {
    if (!entity.components?.[component]) {
      issues.push({
        code: 'missing_component',
        component,
        message: `${name} requires the component ${component}`,
      });
    }
  }

  for (const component of Object.keys(entity.components ?? {})) {
    if (!registry.components[component]) {
      issues.push({
        code: 'unknown_component',
        component,
        message: `Component ${component} is not in the registry`,
      });
      continue;
    }
    if (!allowed.has(component) && !options.expertMode) {
      issues.push({
        code: 'component_not_allowed',
        component,
        message: `${name} does not allow the component ${component}`,
      });
    }
  }

  for (const [component, value] of Object.entries(entity.components ?? {})) {
    const def = registry.components[component];
    if (!def) continue;
    for (const property of def.schema.required ?? []) {
      const prop = def.schema.properties[property];
      if (prop?.derived) continue; // derived values are never stored
      if (value?.[property] === undefined || value[property] === '') {
        issues.push({
          code: 'missing_property',
          component,
          property,
          message: `${component}.${property} is required`,
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

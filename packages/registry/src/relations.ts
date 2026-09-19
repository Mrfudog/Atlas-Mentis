import type { RelationDef } from '@nw/model';

/**
 * `relation_def` rows. Every edge is stored once, in one direction;
 * `inverseLabel` is how it reads from the other end (REQ-182), so there is
 * no mirrored second edge to fall out of step.
 *
 * `section` turns an edge into a composition heading on the source article —
 * that is how a statblock is built from pooled rules rather than copies.
 */
export const relations: Record<string, RelationDef> = {
  composedOf: {
    type: 'composedOf',
    label: 'composed of',
    inverseLabel: 'used in',
    from: ['Statblock'],
    to: ['Rule'],
    section: 'Actions & traits',
    props: {
      type: 'object',
      properties: { vars: { type: 'object', title: 'Variable bindings' } },
    },
  },

  /**
   * The creature link, stored on the STATBLOCK side.
   *
   * `Schemas.md` puts it the other way round (`Creature.hasStatblock`), but
   * the vault writes `kreatur:` in the statblock's frontmatter, so that is
   * where the edge exists in the data we actually have. One edge, one
   * direction; the creature reads it through `inverseLabel`.
   */
  belongsTo: {
    type: 'belongsTo',
    label: 'belongs to',
    inverseLabel: 'statblock of',
    from: ['Statblock'],
    to: ['NPC'],
    cardinality: 'one',
  },

  /** Weapon properties are pooled rules, referenced rather than copied. */
  hasProperty: {
    type: 'hasProperty',
    label: 'has property',
    inverseLabel: 'property of',
    from: ['Weapon', 'Item', 'Armor'],
    to: ['Rule'],
  },

  owes: {
    type: 'owes',
    label: 'owes',
    inverseLabel: 'creditor of',
    from: ['NPC'],
    to: ['NPC'],
  },

  memberOf: {
    type: 'memberOf',
    label: 'member of',
    inverseLabel: 'members',
    from: ['NPC'],
    to: ['Faction'],
  },

  livesIn: {
    type: 'livesIn',
    label: 'lives in',
    inverseLabel: 'residents',
    from: ['NPC'],
    to: ['Place'],
  },

  partOf: {
    type: 'partOf',
    label: 'part of',
    inverseLabel: 'contains',
    from: ['Place'],
    to: ['Place'],
  },

  controls: {
    type: 'controls',
    label: 'controls',
    inverseLabel: 'controlled by',
    from: ['Faction'],
    to: ['Place'],
  },

  describedIn: {
    type: 'describedIn',
    label: 'described in',
    inverseLabel: 'describes',
    from: ['*'],
    to: ['Article'],
  },
};

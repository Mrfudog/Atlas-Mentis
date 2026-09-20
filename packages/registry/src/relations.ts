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

  /**
   * One containment edge for everything that nests, rather than a second
   * hierarchy beside it: a chapter sits in an arc the way a room sits in a
   * building, and a quest hangs off the story it belongs to. Widening the
   * ends of an existing edge keeps one set of backlinks, one `contains`.
   */
  partOf: {
    type: 'partOf',
    label: 'part of',
    inverseLabel: 'contains',
    from: ['Place', 'Story', 'Quest'],
    to: ['Place', 'Story'],
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

  // ------------------------------------------------------ players & party

  /** The one edge that leaves the fiction: who at the table runs this one. */
  playedBy: {
    type: 'playedBy',
    label: 'played by',
    inverseLabel: 'plays',
    from: ['PlayerCharacter'],
    to: ['*'],
    cardinality: 'one',
  },

  memberOfParty: {
    type: 'memberOfParty',
    label: 'in the party',
    inverseLabel: 'members',
    from: ['Creature'],
    to: ['Party'],
  },

  carries: {
    type: 'carries',
    label: 'carries',
    inverseLabel: 'carried by',
    from: ['Creature', 'Party'],
    to: ['Inventory'],
    cardinality: 'one',
  },

  holds: {
    type: 'holds',
    label: 'holds',
    inverseLabel: 'held in',
    from: ['Inventory'],
    to: ['Item'],
  },

  // ---------------------------------------------------------------- story

  followsFrom: {
    type: 'followsFrom',
    label: 'follows',
    inverseLabel: 'followed by',
    from: ['Story'],
    to: ['Story'],
    cardinality: 'one',
  },

  questGiver: {
    type: 'questGiver',
    label: 'given by',
    inverseLabel: 'gives',
    from: ['Quest'],
    to: ['Creature', 'Faction'],
  },

  questAbout: {
    type: 'questAbout',
    label: 'concerns',
    inverseLabel: 'concerned by',
    from: ['Quest'],
    to: ['*'],
  },

  happensAt: {
    type: 'happensAt',
    label: 'happens at',
    inverseLabel: 'scenes here',
    from: ['Story'],
    to: ['Place'],
  },

  features: {
    type: 'features',
    label: 'features',
    inverseLabel: 'appears in',
    from: ['Story'],
    to: ['Creature', 'NPC', 'Statblock', 'Faction'],
  },

  // ------------------------------------------------------------- knowledge

  /**
   * Der Artikel trägt die Kante zu seinen Informationen, nicht umgekehrt:
   * so steht die Liste dort, wo das Seitenpanel sie bearbeitet, und `owned`
   * lässt die Bündel mit dem Artikel sterben statt verwaist zurückzubleiben.
   */
  knowledge: {
    type: 'knowledge',
    label: 'knowledge about it',
    inverseLabel: 'about',
    from: ['*'],
    to: ['Information'],
    owned: true,
  },

  /**
   * Die Zuteilung. Ein Ziel, drei Sorten Empfänger — Figur, Gruppe oder
   * Wissensstand — und die Auflösung ist immer dieselbe Abfrage.
   */
  knownBy: {
    type: 'knownBy',
    label: 'known by',
    inverseLabel: 'knows',
    from: ['Information'],
    to: ['Creature', 'Party', 'KnowledgeLevel'],
  },

  atLevel: {
    type: 'atLevel',
    label: 'knows as',
    inverseLabel: 'known to',
    from: ['Creature', 'Party'],
    to: ['KnowledgeLevel'],
  },
};

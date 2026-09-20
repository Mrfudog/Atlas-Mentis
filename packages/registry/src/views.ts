import type { ViewDef } from '@nw/model';

/**
 * Darstellungsstufen (facets, REQ-164). A view names either a whole
 * component or a single field, so Kampf can take the armour class without
 * dragging in the ability scores.
 *
 * `player` is the shape player access will take: it excludes `secret`
 * blocks and the DM-only components. It is not yet an access control —
 * that is enforced server-side when player links land.
 */
export const views: Record<string, ViewDef> = {
  quick: {
    label: 'Quick',
    order: 1,
    fields: 'none',
    blocks: ['paragraph', 'readaloud'],
    description: true,
    composed: false,
    relations: true,
    bindings: false,
    image: false,
  },

  full: {
    label: 'Full',
    order: 2,
    fields: 'all',
    blocks: 'all',
    description: true,
    composed: true,
    relations: true,
    bindings: true,
    image: true,
  },

  combat: {
    label: 'Combat',
    order: 3,
    fields: [
      'StatblockInfo.ac',
      'StatblockInfo.hp',
      'StatblockInfo.speed',
      'StatblockInfo.initiative',
      'StatblockInfo.passivePerception',
      'StatblockInfo.cr',
      'StatblockInfo.combatRole',
      'StatblockInfo.resistances',
      'StatblockInfo.immunities',
      'CreatureInfo.attitude',
      'RuleInfo.kind',
    ],
    blocks: ['tactics'],
    description: false,
    composed: true,
    relations: true,
    bindings: false,
    image: false,
  },

  image: {
    label: 'Image',
    order: 4,
    fields: 'none',
    blocks: [],
    description: false,
    composed: false,
    relations: false,
    bindings: false,
    image: true,
  },

  player: {
    label: 'Player',
    order: 5,
    fields: ['CreatureInfo', 'LocationInfo', 'FactionInfo'],
    blocks: ['paragraph', 'readaloud', 'lore', 'appearance', 'fact'],
    description: true,
    composed: false,
    relations: false,
    bindings: false,
    image: true,
  },

  stats: {
    label: 'Stats',
    order: 6,
    fields: ['StatblockInfo'],
    blocks: [],
    description: false,
    composed: false,
    relations: false,
    bindings: false,
    image: false,
  },
};

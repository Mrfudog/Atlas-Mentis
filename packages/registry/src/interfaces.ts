import type { InterfaceDef } from '@nw/model';

/**
 * `interface` rows. Membership is asserted with `Typed` and verified by
 * Validation (D5) — it is never inferred from which components happen to
 * be present. Adding a kind of thing is a row here, not a code change.
 */
export const interfaces: Record<string, InterfaceDef> = {
  Base: {
    name: 'Base',
    label: 'Base',
    abstract: true,
    requires: ['Name', 'Identity'],
    allows: ['Status', 'Description', 'Visibility', 'Image', 'RawContent'],
    blockTypes: ['paragraph', 'note'],
  },

  NPC: {
    name: 'NPC',
    label: 'Creature',
    extends: ['Base'],
    allows: ['CreatureInfo', 'Vars'],
    blockTypes: ['+appearance', '+personality', '+lore', '+fact', '+secret', '+readaloud'],
  },

  Place: {
    name: 'Place',
    label: 'Place',
    extends: ['Base'],
    allows: ['LocationInfo'],
    blockTypes: ['+lore', '+readaloud', '+secret'],
  },

  Faction: {
    name: 'Faction',
    label: 'Faction',
    extends: ['Base'],
    allows: ['FactionInfo'],
    blockTypes: ['+lore', '+secret'],
  },

  Article: {
    name: 'Article',
    label: 'Article',
    extends: ['Base'],
    blockTypes: ['+lore', '+secret', '+poem', '+song'],
  },

  /** The reuse pool: traits, actions, conditions, feats — all one interface. */
  Rule: {
    name: 'Rule',
    label: 'Rule Element',
    extends: ['Base'],
    requires: ['RuleInfo'],
    allows: ['Vars'],
  },

  /** An entity of its own (D4), referenced by creatures, never embedded. */
  Statblock: {
    name: 'Statblock',
    label: 'Statblock',
    extends: ['Base'],
    requires: ['StatblockInfo'],
    allows: ['Vars'],
    blockTypes: ['+tactics'],
  },

  /**
   * Items. `Gegenstandstyp` in the vault maps onto these: a weapon, armour
   * and a material differ by which component they carry, which is exactly
   * what interfaces are for.
   */
  Item: {
    name: 'Item',
    label: 'Item',
    extends: ['Base'],
    allows: ['ItemInfo', 'Footprint'],
    blockTypes: ['+lore', '+secret', '+fact'],
  },

  Weapon: {
    name: 'Weapon',
    label: 'Weapon',
    extends: ['Item'],
    allows: ['WeaponInfo'],
  },

  Armor: {
    name: 'Armor',
    label: 'Armor',
    extends: ['Item'],
    allows: ['ArmorInfo'],
  },

  Material: {
    name: 'Material',
    label: 'Material',
    extends: ['Item'],
    allows: ['MaterialInfo'],
  },

  Consumable: {
    name: 'Consumable',
    label: 'Consumable',
    extends: ['Item'],
  },
};

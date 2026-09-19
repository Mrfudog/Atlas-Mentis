import type { InterfaceDef } from '@nw/model';

/**
 * `interface` rows. Membership is asserted with `Typed` and verified by
 * Validation (D5) — it is never inferred from which components happen to
 * be present. Adding a kind of thing is a row here, not a code change.
 */
export const interfaces: Record<string, InterfaceDef> = {
  Base: {
    name: 'Base',
    label: 'Basis',
    abstract: true,
    requires: ['Name', 'Identity'],
    allows: ['Status', 'Description', 'Visibility', 'Bild', 'RawContent'],
    blockTypes: ['paragraph', 'note'],
  },

  NPC: {
    name: 'NPC',
    label: 'Geschöpf',
    extends: ['Base'],
    allows: ['CreatureInfo', 'Vars'],
    blockTypes: ['+appearance', '+personality', '+lore', '+fact', '+secret', '+readaloud'],
  },

  Ort: {
    name: 'Ort',
    label: 'Ort',
    extends: ['Base'],
    allows: ['LocationInfo'],
    blockTypes: ['+lore', '+readaloud', '+secret'],
  },

  Fraktion: {
    name: 'Fraktion',
    label: 'Fraktion',
    extends: ['Base'],
    allows: ['FactionInfo'],
    blockTypes: ['+lore', '+secret'],
  },

  Artikel: {
    name: 'Artikel',
    label: 'Wissensartikel',
    extends: ['Base'],
    blockTypes: ['+lore', '+secret', '+poem', '+song'],
  },

  /** The reuse pool: traits, actions, conditions, feats — all one interface. */
  Regel: {
    name: 'Regel',
    label: 'Regelbaustein',
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
};

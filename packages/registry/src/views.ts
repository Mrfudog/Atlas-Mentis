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

  /**
   * Wissen (A6). Ein Layout aus genau einem Element: die Felder, nach
   * Informationen gruppiert, und was offen liegt zuoberst. Die Gruppierung
   * ordnet nur, was die Ansicht ohnehin zeigt — sie holt nichts hervor.
   */
  knowledge: {
    label: 'Knowledge',
    order: 7,
    fields: 'all',
    blocks: 'all',
    description: true,
    composed: false,
    relations: true,
    bindings: false,
    image: false,
    layout: [
      { id: 'k-desc', el: 'description' },
      { id: 'k-know', el: 'knowledge', fields: 'all', blocks: 'all' },
    ],
  },

  /** Die Karte gross, und darunter, was auf ihr liegt. */
  map: {
    label: 'Map',
    order: 8,
    fields: ['MapInfo'],
    blocks: ['note', 'readaloud'],
    description: true,
    composed: false,
    relations: true,
    bindings: false,
    image: false,
    layout: [
      { id: 'm-map', el: 'map' },
      { id: 'm-desc', el: 'description' },
      { id: 'm-f', el: 'fields', fields: ['MapInfo'], columns: 3 },
      { id: 'm-b', el: 'blocks', blocks: ['note', 'readaloud'] },
    ],
  },

  /**
   * Der Charakterbogen. Ein Layout aus einem Element, weil der Bogen als
   * Ganzes gelesen wird: Vitalwerte oben und immer sichtbar, darunter, was
   * man seltener braucht.
   */
  sheet: {
    label: 'Sheet',
    order: 9,
    fields: 'all',
    blocks: ['backstory', 'personality', 'note'],
    description: true,
    composed: true,
    relations: true,
    bindings: false,
    image: true,
    layout: [
      { id: 's-sheet', el: 'sheet' },
      { id: 's-desc', el: 'description' },
      { id: 's-b', el: 'blocks', blocks: ['backstory', 'personality', 'note'] },
      { id: 's-c', el: 'composed' },
    ],
  },

  /** Das Inventar in drei Darstellungen über denselben Daten (REQ-064, 065). */
  gear: {
    label: 'Gear',
    order: 10,
    fields: ['InventoryInfo'],
    blocks: [],
    description: false,
    composed: false,
    relations: true,
    bindings: false,
    image: false,
    layout: [
      { id: 'g-inv', el: 'inventory' },
      { id: 'g-f', el: 'fields', fields: ['InventoryInfo'], columns: 2 },
    ],
  },

  /** Die Werkbank: was aus dem vorhandenen Material herstellbar ist. */
  craft: {
    label: 'Crafting',
    order: 11,
    fields: ['RecipeInfo'],
    blocks: ['note', 'lore'],
    description: true,
    composed: false,
    relations: true,
    bindings: false,
    image: false,
    layout: [
      { id: 'c-craft', el: 'crafting' },
      { id: 'c-desc', el: 'description' },
      { id: 'c-b', el: 'blocks', blocks: ['note', 'lore'] },
    ],
  },

  /** Die Leinwand, sonst nichts — alles andere liegt darauf. */
  board: {
    label: 'Board',
    order: 12,
    fields: 'none',
    blocks: [],
    description: false,
    composed: false,
    relations: false,
    bindings: false,
    image: false,
    layout: [{ id: 'b-canvas', el: 'board' }],
  },

  /** Der Kampf: Reihenfolge, Karte, Taktik. */
  fight: {
    label: 'Fight',
    order: 13,
    fields: ['EncounterInfo'],
    blocks: ['tactics', 'readaloud', 'note'],
    description: true,
    composed: false,
    relations: true,
    bindings: false,
    image: false,
    layout: [
      { id: 'f-init', el: 'initiative' },
      { id: 'f-desc', el: 'description' },
      { id: 'f-b', el: 'blocks', blocks: ['readaloud', 'tactics', 'note'] },
    ],
  },

  /** Das Questbrett: was offen ist, was läuft, was erledigt ist. */
  quests: {
    label: 'Quests',
    order: 14,
    fields: ['QuestInfo'],
    blocks: ['lore', 'secret'],
    description: true,
    composed: false,
    relations: true,
    bindings: false,
    image: false,
    layout: [
      { id: 'q-board', el: 'quests' },
      { id: 'q-desc', el: 'description' },
      { id: 'q-b', el: 'blocks', blocks: ['lore', 'secret'] },
    ],
  },

  /** Die Zeitleiste, nach Weltdatum sortiert. */
  timeline: {
    label: 'Timeline',
    order: 15,
    fields: ['WorldDate'],
    blocks: ['lore'],
    description: true,
    composed: false,
    relations: true,
    bindings: false,
    image: false,
    layout: [
      { id: 't-line', el: 'timeline' },
      { id: 't-desc', el: 'description' },
    ],
  },

  /** Was gerade läuft, und wer gerade zusieht. */
  live: {
    label: 'Live',
    order: 16,
    fields: ['SessionState'],
    blocks: ['note', 'recap'],
    description: true,
    composed: false,
    relations: true,
    bindings: false,
    image: false,
    layout: [
      { id: 'l-live', el: 'live' },
      { id: 'l-desc', el: 'description' },
      { id: 'l-b', el: 'blocks', blocks: ['note', 'recap'] },
    ],
  },

  /** Die Tabelle mit ihren Bereichen — und einem Knopf, der sie auswürfelt. */
  table: {
    label: 'Table',
    order: 17,
    fields: ['TableInfo'],
    blocks: ['note', 'secret'],
    description: true,
    composed: false,
    relations: true,
    bindings: false,
    image: false,
    layout: [
      { id: 'tb-table', el: 'table' },
      { id: 'tb-desc', el: 'description' },
      { id: 'tb-b', el: 'blocks', blocks: ['note', 'secret'] },
    ],
  },

  /** Das Cockpit: was ansteht, was offen ist, was noch Idee ist. */
  prep: {
    label: 'Prep',
    order: 18,
    fields: 'none',
    blocks: ['note'],
    description: true,
    composed: false,
    relations: true,
    bindings: false,
    image: false,
    layout: [
      { id: 'p-prep', el: 'prep' },
      { id: 'p-desc', el: 'description' },
      { id: 'p-b', el: 'blocks', blocks: ['note'] },
    ],
  },

  /** Die Punktreise: wo die Gruppe steht und wohin es von dort geht. */
  crawl: {
    label: 'Travel',
    order: 19,
    fields: ['LocationInfo', 'Explored'],
    blocks: ['readaloud', 'lore'],
    description: true,
    composed: false,
    relations: true,
    bindings: false,
    image: false,
    layout: [
      { id: 'cr-crawl', el: 'crawl' },
      { id: 'cr-desc', el: 'description' },
      { id: 'cr-b', el: 'blocks', blocks: ['readaloud', 'lore'] },
    ],
  },
};

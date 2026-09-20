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
    /* `Status` is required, not allowed: every article has a standing, and
       leaving it optional made it a card that half the articles lacked. */
    requires: ['Name', 'Identity', 'Status'],
    allows: ['Description', 'Visibility', 'Image', 'RawContent', 'SourceRef', 'WorldDate'],
    blockTypes: ['paragraph', 'note'],
  },

  /**
   * Abstract, and the reason the rows below are short: everything that walks
   * shares the same components, block types and edges, so they are declared
   * once here and every creature under it inherits them unchanged.
   */
  Creature: {
    name: 'Creature',
    label: 'Creature',
    abstract: true,
    extends: ['Base'],
    allows: ['CreatureInfo', 'Vars'],
    blockTypes: ['+appearance', '+personality', '+lore', '+fact', '+secret', '+readaloud'],
  },

  NPC: {
    name: 'NPC',
    label: 'NPC',
    extends: ['Creature'],
  },

  PlayerCharacter: {
    name: 'PlayerCharacter',
    label: 'Player character',
    extends: ['Creature'],
    requires: ['CharacterInfo'],
    blockTypes: ['+backstory'],
  },

  Companion: {
    name: 'Companion',
    label: 'Companion',
    extends: ['Creature'],
  },

  Retainer: {
    name: 'Retainer',
    label: 'Retainer',
    extends: ['Creature'],
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

  Party: {
    name: 'Party',
    label: 'Party',
    extends: ['Base'],
    allows: ['PartyInfo'],
    blockTypes: ['+lore', '+note'],
  },

  Inventory: {
    name: 'Inventory',
    label: 'Inventory',
    extends: ['Base'],
    allows: ['InventoryInfo'],
    blockTypes: ['+note'],
  },

  /**
   * Abstract for the same reason as `Creature`: campaign, arc, chapter,
   * session and scene differ in grain, not in kind. Declaring the edges and
   * the shown fields once here keeps every rung of the ladder in step.
   */
  Story: {
    name: 'Story',
    label: 'Story',
    abstract: true,
    extends: ['Base'],
    allows: ['StoryInfo'],
    blockTypes: ['+lore', '+secret', '+readaloud', '+note'],
  },

  Campaign: {
    name: 'Campaign',
    label: 'Campaign',
    extends: ['Story'],
  },

  Arc: {
    name: 'Arc',
    label: 'Arc',
    extends: ['Story'],
  },

  Chapter: {
    name: 'Chapter',
    label: 'Chapter',
    extends: ['Story'],
  },

  Session: {
    name: 'Session',
    label: 'Session',
    extends: ['Story'],
    blockTypes: ['+recap'],
  },

  Scene: {
    name: 'Scene',
    label: 'Scene / Encounter',
    extends: ['Story'],
    allows: ['SceneInfo'],
    blockTypes: ['+tactics'],
  },

  /**
   * Its own thing, not a rung of the story ladder: a quest outlives the
   * session it was handed out in, and nests through `partOf` like the rest.
   */
  Quest: {
    name: 'Quest',
    label: 'Quest',
    extends: ['Base'],
    requires: ['QuestInfo'],
    blockTypes: ['+lore', '+secret'],
  },

  /**
   * Wissen (A6). Eine Information ist ein eigener Artikel, kein Feldattribut:
   * nur ein Peg trägt Kanten, und „wer weiss davon?" soll ein Rückbezug sein
   * wie jeder andere. Sie hängt über `knowledge` am Artikel, den sie betrifft,
   * und zeigt über `knownBy` auf ihre Empfänger.
   */
  Information: {
    name: 'Information',
    label: 'Information',
    extends: ['Base'],
    requires: ['Info'],
    blockTypes: ['+secret', '+fact'],
  },

  /**
   * Ein benannter Wissensstand — „Allgemeinwissen", „Gildenwissen". Figuren
   * gehören ihm über `atLevel` an; eine Information an den Stand zu hängen
   * erreicht damit alle darin, ohne dass jemand eine Liste pflegt.
   */
  KnowledgeLevel: {
    name: 'KnowledgeLevel',
    label: 'Knowledge level',
    extends: ['Base'],
    requires: ['KnowledgeInfo'],
  },

  /**
   * Ein Asset ist ein Artikel, kein blosser Anhang: so trägt es Marken, eine
   * Quellenangabe und eine Sichtbarkeit, und dieselbe Datei kann von zwei
   * Karten benutzt werden, ohne zweimal dazuliegen.
   */
  Asset: {
    name: 'Asset',
    label: 'Asset',
    extends: ['Base'],
    requires: ['AssetInfo'],
    allows: ['SourceRef'],
  },

  /**
   * Eine Karte ist ein Artikel wie jeder andere — sie trägt Marken, einen
   * Stand und Wissen. Was sie darstellt, sagt die Kante `mapOf`; was auf ihr
   * liegt, sagen die `marker`-Kanten. Eine Karte, die ihre Marken als Feld
   * trüge, könnte keinen Rückbezug beantworten: „auf welchen Karten kommt
   * der Baron vor?" ist so eine Abfrage wie jede andere.
   */
  Map: {
    name: 'Map',
    label: 'Map',
    extends: ['Base'],
    requires: ['MapInfo'],
    blockTypes: ['+note', '+secret', '+readaloud'],
  },
};

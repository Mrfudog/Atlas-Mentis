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
    allows: ['Description', 'Visibility', 'Image', 'RawContent', 'SourceRef', 'WorldDate', 'Todos'],
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
    /* `StatblockInfo` darf hier direkt liegen: ein Spielercharakter trägt
       seine Zahlen selbst, ein NSC borgt sie meist von einem Statblock über
       `belongsTo`. Der Bogen liest beides — erst die eigene Karte, dann die
       geborgte — statt eine der beiden Formen zu verbieten. */
    allows: ['CreatureInfo', 'Vars', 'StatblockInfo', 'Vitals', 'Skills', 'Access'],
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
    allows: ['LocationInfo', 'Explored'],
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
    allows: ['PartyInfo', 'Access', 'TravelInfo'],
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
    allows: ['SessionState'],
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

  /**
   * Ein Rezept ist ein Artikel — und damit gilt für es alles, was für
   * Artikel gilt: es trägt einen Stand, Marken, eine Beschreibung. Vor allem
   * aber kann es über eine Information *zugeteilt* werden: ein Rezept, das
   * jemand kennt, ist Wissen, und Wissen hat dieses Modell schon (A6).
   * Ein Feld „bekannt von" am Rezept wäre ein zweites, schwächeres
   * Wissensmodell neben dem vorhandenen.
   */
  Recipe: {
    name: 'Recipe',
    label: 'Recipe',
    extends: ['Base'],
    requires: ['RecipeInfo'],
    blockTypes: ['+note', '+secret', '+lore'],
  },

  /**
   * Ein Board ist ein Artikel, und was darauf liegt, sind Kanten. Damit
   * beantwortet „wo liegt dieser NSC überall?" derselbe Rückbezug wie
   * überall sonst — und ein Board kann geteilt, versioniert und mit Wissen
   * belegt werden, ohne dass dafür etwas Neues erfunden wird.
   */
  Board: {
    name: 'Board',
    label: 'Board',
    extends: ['Base'],
    requires: ['BoardInfo'],
    blockTypes: ['+note'],
  },

  /**
   * Eine Begegnung hängt über `partOf` an irgendeiner Stufe der Geschichte —
   * an einer Szene, einem Kapitel, einer Kampagne. Sie ist keine eigene
   * Stufe der Leiter, denn dieselbe Begegnung kann in zwei Sitzungen
   * auftauchen, und eine Stufe kann das nicht.
   */
  Encounter: {
    name: 'Encounter',
    label: 'Encounter',
    extends: ['Base'],
    requires: ['EncounterInfo'],
    blockTypes: ['+tactics', '+readaloud', '+note', '+secret'],
  },

  /**
   * Ein Ereignis in der Weltzeit (REQ-106). Es verlangt ein Weltdatum —
   * ohne das ist es kein Ereignis, sondern eine Notiz. Sortiert wird nach
   * `WorldDate.sort`, gelesen wird `WorldDate.display`.
   */
  Event: {
    name: 'Event',
    label: 'Event',
    extends: ['Base'],
    requires: ['WorldDate'],
    blockTypes: ['+lore', '+secret', '+readaloud'],
  },

  /**
   * Eine Tabelle ist ein Artikel: sie trägt Marken, einen Stand und Wissen,
   * und sie kann in einer anderen Tabelle stehen. Verschachtelung ist eine
   * Kante auf eine Tabelle, nicht ein Sonderfeld — deshalb braucht sie
   * einen Zyklusschutz und sonst nichts.
   */
  Table: {
    name: 'Table',
    label: 'Table',
    extends: ['Base'],
    requires: ['TableInfo'],
    blockTypes: ['+note', '+secret'],
  },

  /**
   * Eine Ebene ist ein Artikel (REQ-004). Was zu ihr gehört, sagen Kanten —
   * `inLayer` von der Sache zur Ebene, nicht umgekehrt: eine Liste an der
   * Ebene müsste bei jedem neuen Artikel angefasst werden, und wer sie
   * vergisst, hat einen Artikel, den niemand findet.
   */
  Layer: {
    name: 'Layer',
    label: 'Layer',
    extends: ['Base'],
    requires: ['LayerInfo'],
    blockTypes: ['+note'],
  },

  /**
   * Eine Tat (REQ-030). Sie ist ein Artikel, weil sie sich beschreiben,
   * datieren, auf die Zeitleiste legen und verbergen lässt — als Zeile in
   * einer Liste könnte sie nichts davon.
   */
  Deed: {
    name: 'Deed',
    label: 'Deed',
    extends: ['Base'],
    requires: ['DeedInfo'],
    blockTypes: ['+lore', '+secret', '+readaloud'],
  },
};

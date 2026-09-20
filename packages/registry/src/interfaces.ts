import type { InterfaceDef, ObjectSchema } from '@nw/model';
import { fieldGroups as g } from './fieldgroups.js';

/**
 * `interface` rows — **die einzige Registerzeile für eine Artikelart.**
 * Membership is asserted with `Typed` and verified by Validation (D5); it is
 * never inferred from which fields happen to be filled. Adding a kind of
 * thing is a row here, not a code change.
 *
 * Jede Art trägt ihre Felder selbst. Was mehrere Arten teilen, ist ein
 * Obertyp — `Vars`, `StatblockInfo`, `Access`, `Vitals`, `Skills` — und
 * behält damit seine eigene Karte am Artikel. Genau das hält `hp` an der
 * Kreatur von `hp` am Statblock auseinander.
 *
 * Der **erste** Eintrag in `extends` ist der, an dem der Artenbaum zeichnet;
 * weitere sind Beimischungen. Deshalb steht dort nie eine Beimischung
 * zuerst — sonst hinge die halbe Kampagne unter „Quellenangabe".
 */

/** Feldgruppen zu einem Schema zusammenlegen. Pflichtfelder wandern mit. */
function merge(...gruppen: { schema: ObjectSchema }[]): ObjectSchema {
  const properties: ObjectSchema['properties'] = {};
  const required: string[] = [];
  for (const { schema } of gruppen) {
    Object.assign(properties, schema.properties);
    required.push(...(schema.required ?? []));
  }
  return required.length
    ? { type: 'object', required, properties }
    : { type: 'object', properties };
}
export const interfaces: Record<string, InterfaceDef> = {
  /* Die Arten, die mehrere andere teilen. Sie waren Komponenten, weil eine
     Kreatur nun einmal Statblockzahlen trägt und eine Regel Variablen; jetzt
     sind sie Obertypen, und ihre Karte bleibt ihre Karte. Abstrakt, weil
     niemand einen Artikel „Zugriff" anlegt. */
  Vars: {
    name: 'Vars',
    label: 'Variables',
    abstract: true,
    schema: g.Vars.schema,
  },

  /* Die Zahlen eines Statblocks. Sie heissen weiter `StatblockInfo` und
     nicht `Statline`, weil jede Karte in den Daten so heisst und ein
     hübscherer Name eine Wanderung wert sein müsste. */
  StatblockInfo: {
    name: 'StatblockInfo',
    label: 'Statblock numbers',
    abstract: true,
    schema: g.StatblockInfo.schema,
  },

  Access: {
    name: 'Access',
    label: 'Access',
    abstract: true,
    schema: g.Access.schema,
  },

  /* Zwei weitere, die keine Kreatur mit einer anderen teilt und die trotzdem
     eigene Arten bleiben: eine Ansicht nennt sie als Ganzes. Der Bogen oben
     zeichnet die Werte schon, also nimmt die Feldtabelle `except: ['Vitals']`
     — und das ist genau der Verweis, der verschwände, legte man die Felder zu
     `Creature` dazu. Dann stünde dort eine Aufzählung von vierzehn Namen, und
     die wäre am Tag des fünfzehnten falsch.

     Sachlich stimmt es auch: was eine Kreatur *ist*, ändert sich selten; was
     sie gerade *aushält*, ändert sich jede Runde. */
  Vitals: {
    name: 'Vitals',
    label: 'Vitals',
    abstract: true,
    schema: g.Vitals.schema,
  },

  Skills: {
    name: 'Skills',
    label: 'Skills',
    abstract: true,
    schema: g.Skills.schema,
  },

  /* ---------- Basistypen ----------
     Jeder erklärt Felder und erbt nichts. Was eine Artikelart braucht,
     nimmt sie dazu — deshalb trägt ein Ereignis kein Bild, und zwar nicht,
     weil jemand ein Feld ausgeblendet hat, sondern weil es keins hat.

     Vorher stand das alles in einem Sammeltyp `Base`, den jede Art erbte:
     28 Felder, von denen 17 in keinem einzigen der 73 Artikel belegt waren.
     Ein Ereignis schleppte Bildunterschrift, Alt-Text und Seitenzahl mit. */

  /** Wer der Artikel ist. Das erbt jede Artikelart. */
  Identity: {
    name: 'Identity',
    label: 'Identity',
    abstract: true,
    schema: g.Identity.schema,
    /* Die Blockarten, die überall gelten. Sie stehen hier, weil `Identity`
       der einzige Typ ist, den wirklich jede Art erbt. */
    blockTypes: ['paragraph', 'note'],
  },

  Status: {
    name: 'Status',
    label: 'Status',
    abstract: true,
    schema: g.Status.schema,
  },

  Description: {
    name: 'Description',
    label: 'Description',
    abstract: true,
    schema: g.Description.schema,
  },

  Visibility: {
    name: 'Visibility',
    label: 'Visibility',
    abstract: true,
    schema: g.Visibility.schema,
  },

  /** Marken — ein Bestandteil und keine Eigenschaft der Entität. */
  Tags: {
    name: 'Tags',
    label: 'Tags',
    abstract: true,
    schema: g.Tags.schema,
  },

  /** Wann etwas in der Welt steht: `sort` ordnet, `display` wird gelesen. */
  Time: {
    name: 'Time',
    label: 'Time',
    abstract: true,
    schema: g.Time.schema,
  },

  Image: {
    name: 'Image',
    label: 'Image',
    abstract: true,
    schema: g.Image.schema,
  },

  /** Woher es stammt: Buch, Seite, Anker, Adresse. */
  Source: {
    name: 'Source',
    label: 'Source',
    abstract: true,
    schema: g.Source.schema,
  },

  /** Der Wortlaut, wie er aus dem Vault kam (REQ-019). */
  Imported: {
    name: 'Imported',
    label: 'Imported',
    abstract: true,
    schema: g.Imported.schema,
  },

  Todos: {
    name: 'Todos',
    label: 'Todos',
    abstract: true,
    schema: g.Todos.schema,
  },


  /**
   * Abstract, and the reason the rows below are short: everything that walks
   * shares the same components, block types and edges, so they are declared
   * once here and every creature under it inherits them unchanged.
   */
  Creature: {
    name: 'Creature',
    area: 'world',
    label: 'Creature',
    abstract: true,
    extends: ['Identity', 'Status', 'Description', 'Visibility', 'Tags', 'Image', 'Imported', 'Source', 'Vars', 'StatblockInfo', 'Access', 'Vitals', 'Skills'],
    schema: g.CreatureInfo.schema,
    /* `StatblockInfo` darf hier direkt liegen: ein Spielercharakter trägt
       seine Zahlen selbst, ein NSC borgt sie meist von einem Statblock über
       `belongsTo`. Der Bogen liest beides — erst die eigene Karte, dann die
       geborgte — statt eine der beiden Formen zu verbieten. */
    blockTypes: ['+appearance', '+personality', '+lore', '+fact', '+secret', '+readaloud'],
  },

  NPC: {
    name: 'NPC',
    area: 'world',
    label: 'NPC',
    extends: ['Creature'],
  },

  PlayerCharacter: {
    name: 'PlayerCharacter',
    area: 'world',
    label: 'Player character',
    extends: ['Creature'],
    schema: merge(g.CharacterInfo),
    blockTypes: ['+backstory'],
  },

  Companion: {
    name: 'Companion',
    area: 'world',
    label: 'Companion',
    extends: ['Creature'],
  },

  Retainer: {
    name: 'Retainer',
    area: 'world',
    label: 'Retainer',
    extends: ['Creature'],
  },

  Place: {
    name: 'Place',
    area: 'world',
    label: 'Place',
    extends: ['Identity', 'Status', 'Description', 'Visibility', 'Tags', 'Image', 'Imported'],
    schema: merge(g.LocationInfo, g.Explored),
    blockTypes: ['+lore', '+readaloud', '+secret'],
  },

  Faction: {
    name: 'Faction',
    area: 'world',
    label: 'Faction',
    extends: ['Identity', 'Status', 'Description', 'Visibility', 'Tags', 'Image'],
    schema: merge(g.FactionInfo),
    blockTypes: ['+lore', '+secret'],
  },

  Article: {
    name: 'Article',
    area: 'world',
    label: 'Article',
    extends: ['Identity', 'Status', 'Description', 'Visibility', 'Tags', 'Imported', 'Source', 'Todos'],
    blockTypes: ['+lore', '+secret', '+poem', '+song'],
  },

  /** The reuse pool: traits, actions, conditions, feats — all one interface. */
  Rule: {
    name: 'Rule',
    area: 'rules',
    label: 'Rule Element',
    extends: ['Identity', 'Status', 'Description', 'Visibility', 'Tags', 'Source', 'Imported', 'Vars'],
    schema: merge(g.RuleInfo),
  },

  /**
   * Talent und Fertigkeit sind eigene Arten und nicht nur zwei Werte in
   * `RuleInfo.kind`, weil Beute auf sie zeigen darf und auf eine Lauernde
   * Aktion nicht. Eine Kante nennt Arten, keine Aufzählungswerte — und was
   * eine Kante unterscheiden muss, gehört in eine Art.
   */
  Feat: {
    name: 'Feat',
    area: 'rules',
    label: 'Feat',
    extends: ['Rule'],
    schema: merge(g.FeatInfo),
  },

  Skill: {
    name: 'Skill',
    area: 'rules',
    label: 'Skill',
    extends: ['Rule'],
    schema: merge(g.SkillInfo),
  },

  /** An entity of its own (D4), referenced by creatures, never embedded. */
  Statblock: {
    name: 'Statblock',
    area: 'rules',
    label: 'Statblock',
    extends: ['Identity', 'Status', 'Description', 'Visibility', 'Tags', 'Source', 'Imported', 'StatblockInfo', 'Vars'],
    blockTypes: ['+tactics'],
  },

  /**
   * Items. `Gegenstandstyp` in the vault maps onto these: a weapon, armour
   * and a material differ by which component they carry, which is exactly
   * what interfaces are for.
   */
  Item: {
    name: 'Item',
    area: 'world',
    label: 'Item',
    extends: ['Identity', 'Status', 'Description', 'Visibility', 'Tags', 'Image', 'Imported', 'Source'],
    schema: merge(g.ItemInfo, g.Footprint),
    blockTypes: ['+lore', '+secret', '+fact'],
  },

  Weapon: {
    name: 'Weapon',
    area: 'world',
    label: 'Weapon',
    extends: ['Item'],
    schema: merge(g.WeaponInfo),
  },

  Armor: {
    name: 'Armor',
    area: 'world',
    label: 'Armor',
    extends: ['Item'],
    schema: merge(g.ArmorInfo),
  },

  Material: {
    name: 'Material',
    area: 'world',
    label: 'Material',
    extends: ['Item'],
    schema: merge(g.MaterialInfo),
  },

  Consumable: {
    name: 'Consumable',
    area: 'world',
    label: 'Consumable',
    extends: ['Item'],
  },

  Party: {
    name: 'Party',
    area: 'world',
    label: 'Party',
    extends: ['Identity', 'Status', 'Description', 'Visibility', 'Tags', 'Image', 'Access'],
    schema: merge(g.PartyInfo, g.TravelInfo),
    blockTypes: ['+lore', '+note'],
  },

  Inventory: {
    name: 'Inventory',
    area: 'rules',
    label: 'Inventory',
    extends: ['Identity', 'Status', 'Description', 'Visibility', 'Tags'],
    schema: merge(g.InventoryInfo),
    blockTypes: ['+note'],
  },

  /**
   * Abstract for the same reason as `Creature`: campaign, arc, chapter,
   * session and scene differ in grain, not in kind. Declaring the edges and
   * the shown fields once here keeps every rung of the ladder in step.
   */
  Story: {
    name: 'Story',
    area: 'history',
    label: 'Story',
    abstract: true,
    extends: ['Identity', 'Status', 'Description', 'Visibility', 'Tags', 'Todos', 'Time'],
    schema: merge(g.StoryInfo),
    blockTypes: ['+lore', '+secret', '+readaloud', '+note'],
  },

  Campaign: {
    name: 'Campaign',
    area: 'history',
    label: 'Campaign',
    extends: ['Story'],
  },

  Arc: {
    name: 'Arc',
    area: 'history',
    label: 'Arc',
    extends: ['Story'],
  },

  Chapter: {
    name: 'Chapter',
    area: 'history',
    label: 'Chapter',
    extends: ['Story'],
  },

  Session: {
    name: 'Session',
    area: 'history',
    label: 'Session',
    extends: ['Story'],
    schema: merge(g.SessionState),
    blockTypes: ['+recap'],
  },

  Scene: {
    name: 'Scene',
    area: 'history',
    label: 'Scene / Encounter',
    extends: ['Story'],
    schema: merge(g.SceneInfo),
    blockTypes: ['+tactics'],
  },

  /**
   * Its own thing, not a rung of the story ladder: a quest outlives the
   * session it was handed out in, and nests through `partOf` like the rest.
   */
  Quest: {
    name: 'Quest',
    area: 'history',
    label: 'Quest',
    extends: ['Identity', 'Status', 'Description', 'Visibility', 'Tags', 'Todos', 'Time'],
    schema: merge(g.QuestInfo),
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
    area: 'rules',
    label: 'Information',
    extends: ['Identity', 'Status', 'Description', 'Visibility', 'Tags'],
    schema: merge(g.Info),
    blockTypes: ['+secret', '+fact'],
  },

  /**
   * Ein benannter Wissensstand — „Allgemeinwissen", „Gildenwissen". Figuren
   * gehören ihm über `atLevel` an; eine Information an den Stand zu hängen
   * erreicht damit alle darin, ohne dass jemand eine Liste pflegt.
   */
  KnowledgeLevel: {
    name: 'KnowledgeLevel',
    area: 'rules',
    label: 'Knowledge level',
    extends: ['Identity', 'Status', 'Description', 'Visibility', 'Tags'],
    schema: merge(g.KnowledgeInfo),
  },

  /**
   * Ein Asset ist ein Artikel, kein blosser Anhang: so trägt es Marken, eine
   * Quellenangabe und eine Sichtbarkeit, und dieselbe Datei kann von zwei
   * Karten benutzt werden, ohne zweimal dazuliegen.
   */
  Asset: {
    name: 'Asset',
    label: 'Asset',
    extends: ['Identity', 'Status', 'Description', 'Visibility', 'Tags', 'Image', 'Source'],
    schema: merge(g.AssetInfo),
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
    area: 'play',
    label: 'Map',
    extends: ['Identity', 'Status', 'Description', 'Visibility', 'Tags', 'Image'],
    schema: merge(g.MapInfo),
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
    area: 'rules',
    label: 'Recipe',
    extends: ['Identity', 'Status', 'Description', 'Visibility', 'Tags', 'Source', 'Imported'],
    schema: merge(g.RecipeInfo),
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
    area: 'play',
    label: 'Board',
    extends: ['Identity', 'Status', 'Description', 'Visibility', 'Tags'],
    schema: merge(g.BoardInfo),
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
    area: 'play',
    label: 'Encounter',
    extends: ['Identity', 'Status', 'Description', 'Visibility', 'Tags', 'Todos'],
    schema: merge(g.EncounterInfo),
    blockTypes: ['+tactics', '+readaloud', '+note', '+secret'],
  },

  /**
   * Ein Ereignis in der Weltzeit (REQ-106). Es verlangt ein Weltdatum —
   * ohne das ist es kein Ereignis, sondern eine Notiz. Sortiert wird nach
   * `Time.sort`, gelesen wird `Time.display`.
   */
  Event: {
    name: 'Event',
    area: 'history',
    label: 'Event',
    extends: ['Identity', 'Status', 'Description', 'Visibility', 'Tags', 'Time'],
    blockTypes: ['+lore', '+secret', '+readaloud'],
  },

  /* ---------- Weltgeschichte ----------
     `Story` ist die Geschichte des *Spiels* — Kampagne, Arc, Kapitel,
     Sitzung, Szene. Was der Welt widerfuhr, bevor jemand sie bespielte,
     hängt dagegen an `Event`: eine Ära dauert Jahrhunderte, ein Kataklysmus
     Tage, ein Meilenstein einen Nachmittag. Drei Zeilen, keine Codeänderung
     — genau das ist die Behauptung, die das Rückgrat macht. */
  Era: {
    name: 'Era',
    area: 'history',
    label: 'Era',
    extends: ['Event'],
  },

  Cataclysm: {
    name: 'Cataclysm',
    area: 'history',
    label: 'Cataclysm',
    extends: ['Event'],
  },

  Milestone: {
    name: 'Milestone',
    area: 'history',
    label: 'Milestone',
    extends: ['Event'],
  },

  /**
   * Eine Tabelle ist ein Artikel: sie trägt Marken, einen Stand und Wissen,
   * und sie kann in einer anderen Tabelle stehen. Verschachtelung ist eine
   * Kante auf eine Tabelle, nicht ein Sonderfeld — deshalb braucht sie
   * einen Zyklusschutz und sonst nichts.
   */
  Table: {
    name: 'Table',
    area: 'rules',
    label: 'Table',
    extends: ['Identity', 'Status', 'Description', 'Visibility', 'Tags', 'Source'],
    schema: merge(g.TableInfo),
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
    extends: ['Identity', 'Status', 'Description', 'Visibility', 'Tags'],
    schema: merge(g.LayerInfo),
    blockTypes: ['+note'],
  },

  /**
   * Eine Gruppe von Menschen. Sie trägt kein Blatt, keine Werte und keine
   * Ausrüstung — sie ist da, damit Wissen einen Empfänger hat, der grösser
   * ist als eine Figur und anders als eine Party.
   *
   * Bereich `game`: sie gehört zur Einrichtung der Runde und nicht in die
   * Welt. Eine Gruppe im Kompendium neben den Fraktionen zu führen hiesse,
   * sie für Kampagneninhalt zu halten.
   */
  Group: {
    name: 'Group',
    area: 'play',
    label: 'Group',
    extends: ['Identity', 'Status', 'Description', 'Visibility', 'Tags'],
    schema: merge(g.GroupInfo),
    blockTypes: ['+note'],
  },
};

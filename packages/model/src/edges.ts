/**
 * **Was eine Kante bewirkt** (T-111, REQ-257).
 *
 * Eine Kantenart sagt im Register, was sie **bedeutet** (`RelationDef.means`).
 * Was sie **bewirkt**, sagt sie nicht selbst: das entscheidet der Code, der
 * sie liest. Hier steht deshalb ein Verzeichnis der **Auswerter** — je
 * Auswerter, welche Kanten er in welcher Datei liest —, und die Wirkung
 * einer Kantenart wird daraus gerechnet (`edgeEffects`).
 *
 * Damit das Verzeichnis nicht behauptet, sondern abschreibt, liest der Test
 * (`edges.test.ts`) die genannten Dateien: jede Kantenart, die dort als
 * Zeichenkette oder über eine Konstante (`LAYER_RELATION`) vorkommt, muss
 * hier stehen, und was hier steht, muss dort vorkommen. Liest ein neuer
 * Auswerter eine Kante, schlägt der Test fehl, bis er eingetragen ist.
 *
 * Dazu kommen drei Wirkungen, die nicht im Code einer Art stehen, sondern
 * aus der Zeile selbst folgen und darum hier gerechnet werden: `section`
 * (die Ziele werden in den Artikel komponiert), `asField` (am einen Ende
 * liest sich das andere wie ein Feld) und gerechnete Felder, deren Rechnung
 * die Kante nennt (`sum(hasClass.level)`).
 *
 * Was nichts davon trifft, ist **nur Anzeige**: es steht unter „Relations"
 * und „Linked here", und sonst liest es niemand. Verspricht eine solche
 * Kante eine Wirkung (`affects` mit `effect`), sagt das `intended` — und die
 * Oberfläche sagt „not evaluated yet".
 */

import type { Registry, RelationDef } from './types.js';

/** Wofür ein Auswerter die Kante braucht — die Gruppen der Wirkungstabelle. */
export type EdgeArea =
  | 'stack'
  | 'visibility'
  | 'character'
  | 'play'
  | 'reading'
  | 'versions'
  | 'rights'
  | 'checks'
  | 'transfer'
  | 'display';

export const EDGE_AREAS: Readonly<Record<EdgeArea, string>> = {
  stack: 'Layers in play',
  visibility: 'Visibility & knowledge',
  character: 'Character values',
  play: 'Play',
  reading: 'Reading & timelines',
  versions: 'Versions & templates',
  rights: 'Who may write',
  checks: 'Checks',
  transfer: 'Import & export',
  display: 'Display',
};

/** Wirkungen, die aus der Zeile selbst folgen. */
export type EdgeShape = 'section' | 'asField' | 'derived';

export const EDGE_SHAPES: Readonly<Record<EdgeShape, string>> = {
  section: 'Composed into the article',
  asField: 'Reads as a field',
  derived: 'Calculation',
};

/** Ein Teil des Codes, der Kanten liest — und welche, je Datei. */
export interface EdgeReader {
  key: string;
  label: string;
  area: EdgeArea;
  /** Was er mit diesen Kanten tut, ein Satz, so dass er vor dem Anlegen taugt. */
  does: string;
  /** Datei (vom Repo aus) → die Kantenarten, die er dort liest oder schreibt. */
  uses: Readonly<Record<string, readonly string[]>>;
}

const M = 'packages/model/src/';
const S = 'apps/server/src/';
const W = 'apps/web/src/app/';

/**
 * **Die Auswerter.** Geprüft gegen den Quelltext (`edges.test.ts`): je
 * Datei ist die Vereinigung der Einträge genau das, was dort an Kanten
 * steht, abzüglich `NOT_EDGE_WORDS`.
 */
export const EDGE_READERS: readonly EdgeReader[] = [
  {
    key: 'stack',
    label: 'Layers in play',
    area: 'stack',
    does: 'decides whether an article is in play at all — what the campaign’s layers bring, what a group layer brings with its members, what a type rule lets every layer of a group bring, which single articles the campaign enables, which publisher a layer counts under, which version replaces another',
    uses: {
      [M + 'visibility.ts']: ['activates', 'inLayer'],
      [M + 'stack.ts']: ['activates', 'enables', 'inLayer', 'layerRule', 'overrides', 'partOf'],
      /* Die Ebene eines Artikels wechseln (T-383). */
      [M + 'layermove.ts']: ['inLayer'],
      [S + 'verwaltung.ts']: ['activates', 'inLayer'],
      [S + 'ebenenrechte.ts']: ['activates', 'inLayer', 'partOf'],
      /* Die Spielerebene: von ihrer Kampagne aufgeschaltet (T-164). */
      [S + 'spielerebene.ts']: ['activates'],
      /* Der Inhalt einer Quelle mit dem Stand in der Kampagne (T-189). */
      [S + 'quelleninhalt.ts']: ['activates', 'inLayer'],
    },
  },
  {
    key: 'visibilityByGroup',
    label: 'Visibility by group',
    area: 'visibility',
    does: 'groups articles by their layer and the layer’s group, so a campaign’s visibility rule for a group (T-252) and the default of a layer reach the articles in it',
    uses: {
      [M + 'groupvisibility.ts']: ['partOf'],
    },
  },
  {
    key: 'take',
    label: 'Take into your story',
    area: 'stack',
    does: 'copies a chapter, a scene or a single part with everything under it into the campaign layer as versions, and leaves layer, template and replacement edges behind — or uses a part as it is, through a link',
    uses: {
      [M + 'stack.ts']: ['inLayer', 'instanceOf', 'mapOf', 'overrides', 'partOf', 'variantOf'],
      [S + 'verwaltung.ts']: ['overrides', 'partOf'],
      [S + 'app.ts']: ['partOf'],
    },
  },
  {
    key: 'versions',
    label: 'Versions and templates',
    area: 'versions',
    does: 'finds the versions of the same thing and reads an instance through its template, field by field',
    uses: {
      [M + 'instance.ts']: ['belongsTo', 'carries', 'inLayer', 'instanceOf', 'overrides', 'variantOf'],
      [M + 'versions.ts']: ['inLayer', 'instanceOf', 'overrides', 'variantOf'],
      /* Anlegen aus einer Vorlage prüft die Vorlage und dünnt aus (T-125). */
      [S + 'app.ts']: ['inLayer', 'instanceOf', 'overrides', 'variantOf'],
      [W + 'artikel/artikel.ts']: ['overrides'],
      /* Nebeneinander (T-173): Ebene und Herkunft zählen als Name, nicht als Sache. */
      [W + 'artikel/vergleich.ts']: ['inLayer', 'overrides', 'variantOf'],
    },
  },
  {
    key: 'images',
    label: 'Image versions and uses',
    area: 'versions',
    does: 'finds where an image is shown — in a field, on a map sheet or through an edge —, makes a new version of an image that keeps its class, tags, visibility and layer, puts an image on the statblock of a creature as its token, and shows the image of its statblock on a creature that has none of its own',
    uses: {
      /* T-119: eine Fassung zeigt das Bild nicht, sie stammt davon ab. */
      [M + 'assets.ts']: ['belongsTo', 'inLayer', 'variantOf'],
      /* T-211: das Vorschaubild einer Kreatur kommt aus ihrem Statblock. */
      [S + 'liste.ts']: ['belongsTo'],
      /* T-201: „Use as token" sucht den Statblock der Kreatur über `belongsTo`. */
      [S + 'bilder.ts']: ['belongsTo', 'inLayer', 'variantOf'],
      /* „Replace › as a new version" schickt das alte Bild mit. */
      [W + 'kern/api.ts']: ['variantOf'],
    },
  },
  {
    key: 'knowledge',
    label: 'Knowledge',
    area: 'visibility',
    does: 'decides which fields a viewer learns — what a creature, its party or its faction (from a rank) knows, and what its ancestry, background, class, subclass or chosen feat knows (T-285); information that holds for a group of articles counts at each of them; and which combatants players may see',
    uses: {
      [M + 'knowledge.ts']: ['chose', 'hasAncestry', 'hasBackground', 'hasClass', 'includes', 'knowledge', 'knownBy', 'memberOf', 'memberOfParty', 'participates', 'partyOf'],
      /* Der Kasten Knowledge (T-286): Informationen eines Artikels, ihre Bündel, neu in der Ebene der Kampagne. */
      [S + 'wissen.ts']: ['inLayer', 'includes', 'knowledge', 'knownBy'],
    },
  },
  {
    key: 'party',
    label: 'The campaign’s party',
    area: 'visibility',
    does: 'gives every campaign its party and puts a character assigned to a player into it',
    uses: {
      [S + 'gruppe.ts']: ['inLayer', 'memberOfParty', 'partyOf'],
      [W + 'figur/assistent.ts']: ['memberOfParty'],
    },
  },
  {
    key: 'rights',
    label: 'Own character and writing',
    area: 'rights',
    does: 'decides who may write: a player manages their own character with its statblock and inventory, and creates into the layers they write',
    uses: {
      [S + 'app.ts']: ['belongsTo', 'carries', 'crafting', 'holds', 'inLayer'],
      /* Ein Bild aus einem Artikel heraus geht in dessen Ebene (T-114). */
      [S + 'bilder.ts']: ['inLayer'],
    },
  },
  {
    key: 'rollLog',
    label: 'Log of rolls',
    area: 'character',
    does: 'shows a creature’s rolls together with the rolls on its statblock, and credits a roll on a statblock to the character it belongs to (T-172)',
    uses: {
      [S + 'wuerfe.ts']: ['belongsTo'],
    },
  },
  {
    key: 'craftCheck',
    label: 'Crafting check',
    area: 'character',
    does: 'decides the tool, ability and DC a creature crafts a recipe with — the recipe’s own default, changed by its campaign, its party or itself for one recipe or for every recipe of a tool',
    uses: {
      [M + 'crafting.ts']: ['craftsWith', 'memberOfParty'],
    },
  },
  {
    key: 'craftingOrder',
    label: 'Crafting order',
    area: 'character',
    does: 'runs a crafting order — an instance of a recipe: which blueprints a character knows by the campaign’s rule (all, taught, or up to a rarity of what it yields, T-280), who crafts it, which materials in the crafter’s and the party’s inventory are reserved for it (and locked on the server while it runs), the checks, and on the end what is used up, what comes back and what the recipe yields',
    uses: {
      /* Die Seltenheit einer Blaupause ist die ihres Ertrags (T-280). */
      [M + 'crafting.ts']: ['crafting', 'holds', 'knowledge', 'yields'],
      [S + 'handwerk.ts']: ['carries', 'crafting', 'holds', 'inLayer', 'instanceOf', 'memberOfParty', 'needs', 'partyOf', 'yields'],
      [S + 'reservierung.ts']: ['holds'],
    },
  },
  {
    key: 'craftMaterials',
    label: 'Crafting materials',
    area: 'character',
    does: 'decides which pieces a crafter may use for a recipe’s material when crafting starts — the item it names, any piece of a material group whose type, rarity and tags fit, or a substitute by a rule the campaign plays — and says why a piece does not fit (T-197)',
    uses: {
      [M + 'substitutes.ts']: ['allowsSubstitution'],
    },
  },
  {
    key: 'glossary',
    label: 'Glossary',
    area: 'display',
    does: 'shows what a glossary term explains — the condition, property or rule it points to — in the glossary sidebar, and finds the term of a condition or property so that Ctrl/⌘+click opens it (T-242)',
    uses: {
      [M + 'glossary.ts']: ['explains'],
      [S + 'glossar.ts']: ['explains'],
    },
  },
  {
    key: 'craftOverview',
    label: 'Crafting overview',
    area: 'display',
    does: 'shows what can be made: a trade lists its recipes and the materials they need, a tool the recipes of its trades, a character the recipes of the tools it is proficient in — learned or not (T-196)',
    uses: {
      [M + 'crafting.ts']: ['needs'],
      [S + 'handwerk.ts']: ['belongsTo', 'instanceOf', 'needs', 'yields'],
    },
  },
  {
    key: 'shopPrice',
    label: 'Shop prices',
    area: 'character',
    does: 'prices a shop’s wares for a buyer — the ware’s own price and mark-down, the shop’s, and the discounts of the shop, the factions controlling it and its shopkeepers to the buyer, their party or their faction from a rank',
    uses: {
      [M + 'shop.ts']: ['controls', 'discount', 'memberOf', 'memberOfParty', 'sells', 'shopkeeper'],
      /* Was der Betrachter vom Laden sehen darf: die Waren und wer ihn kontrolliert. */
      [S + 'app.ts']: ['controls', 'sells'],
    },
  },
  {
    key: 'enhancements',
    label: 'Enhancements',
    area: 'character',
    does: 'works out the name, price, rarity and bonuses of a piece from its base item and the enhancements on it (+1, silvered …), checks each against what it applies to, and lets the GM add or remove them (T-300)',
    uses: {
      [M + 'enhancement.ts']: ['enchantedWith'],
      /* Lesen mit gerechnetem Namen und Preis, und das Schreiben prüft, wer anhängt. */
      [S + 'app.ts']: ['enchantedWith'],
      /* Anhängen und abnehmen; Spielende an Stücken in einem Inventar, das sie schreiben. */
      [S + 'aufwertung.ts']: ['enchantedWith', 'holds'],
    },
  },
  {
    key: 'shopTrade',
    label: 'Buying and selling',
    area: 'character',
    does: 'buys a ware into the inventory the character carries and sells a piece from it or a container inside — the counted quantity on the shop falls or rises, a loose stack of the same item grows, and a reserved piece or a container holding something stays (T-133)',
    uses: {
      [M + 'shop.ts']: ['carries', 'holds', 'sells'],
      [S + 'laden.ts']: ['carries', 'holds'],
    },
  },
  {
    key: 'builder',
    label: 'Character builder and sheet',
    area: 'character',
    does: 'builds a character — class levels, ancestry (with the base of a sub-ancestry), background, the choices they ask, the effects of each option, ability and equipment methods, the hit points each class level brought (T-194) — and shows the answers by their class',
    uses: {
      [M + 'builder.ts']: ['chose', 'grants', 'hasAncestry', 'hasBackground', 'hasClass'],
      [M + 'hitpoints.ts']: ['hasClass'],
      /* Stufen je Klasse, Mehrklassen nach D&D (T-319). */
      [M + 'multiclass.ts']: ['hasClass'],
      [M + 'choices.ts']: ['chose', 'grants', 'hasAncestry', 'hasBackground', 'hasClass', 'subraceOf'],
      /* Was die Figur schon hat, wählt sie nicht noch einmal (T-299). */
      [M + 'duplicates.ts']: ['chose', 'grants', 'hasAncestry', 'hasBackground', 'hasClass', 'holds'],
      [M + 'abilities.ts']: ['abilityPool', 'allowsMethod'],
      [M + 'equipment.ts']: ['allowsEquipment', 'hasBackground', 'hasClass'],
      [S + 'app.ts']: ['abilityPool', 'allowsEquipment', 'allowsMethod', 'carries', 'chose', 'holds'],
      [W + 'figur/assistent.ts']: ['belongsTo', 'chose', 'grants', 'hasAncestry', 'hasBackground', 'hasClass', 'subraceOf'],
      [W + 'artikel/klasseneintrag.ts']: ['chose', 'hasAncestry', 'hasBackground', 'hasClass'],
      [W + 'artikel/artikel.ts']: ['chose', 'hasAncestry', 'hasClass'],
    },
  },
  {
    key: 'ruleOptions',
    label: 'Rules & options of a campaign',
    area: 'character',
    does: 'shows, per system, the options a campaign plays by — taken from rule articles hung together with partOf (option → rule → system), among them the ability and equipment methods and the material substitutions it allows (T-190, T-197, T-270)',
    uses: {
      [M + 'ruleOptions.ts']: ['allowsEquipment', 'allowsMethod', 'allowsSubstitution', 'partOf'],
      [S + 'regeloptionen.ts']: ['allowsEquipment', 'allowsMethod', 'allowsSubstitution'],
    },
  },
  {
    key: 'ruleBuilder',
    label: 'Rule builder',
    area: 'character',
    does: 'groups the rule articles by system — a rule hangs on its system with partOf — and writes a rule’s system back as that edge (T-270)',
    uses: {
      [M + 'ruleGraph.ts']: ['partOf'],
      [W + 'lab/regel-builder.ts']: ['partOf'],
    },
  },
  {
    key: 'rulesAtTable',
    label: 'Rules at the table',
    area: 'character',
    does: 'tells a rule graph in the turn plan what a creature knows by name — its spells, choices, actions, class and origin, and what those grant (REQ-357)',
    uses: {
      [M + 'ruleTable.ts']: ['casts', 'chose', 'composedOf', 'grants', 'hasAncestry', 'hasBackground', 'hasClass'],
    },
  },
  {
    key: 'effects',
    label: 'Effects on the numbers',
    area: 'character',
    does: 'applies the effects of granted features (from their level), of carried items, of what a statblock has equipped and of the creature’s conditions to its numbers (T-275)',
    uses: {
      [M + 'effects.ts']: ['carries', 'equips', 'grants', 'holds'],
    },
  },
  {
    key: 'rest',
    label: 'Rests',
    area: 'character',
    does: 'a long rest takes one level of exhaustion away by swapping the condition for the stage below it; short and long rests reset hit points, hit dice and spell slots (T-352)',
    uses: {
      [M + 'rest.ts']: ['stageOf'],
      [W + 'bogen/kopf.ts']: ['stageOf'],
    },
  },
  {
    key: 'proficiencies',
    label: 'Proficiencies of a character',
    area: 'character',
    does: 'gathers every proficiency, expertise and saving throw of a character with where it comes from — the statblock by hand, the first class (later classes only their multiclass list), subclass, origin with its base, background, what they grant on their level, chosen feats, answered choices and items that grant proficiency (T-239)',
    uses: {
      [M + 'proficiency.ts']: ['chose', 'equips', 'grants', 'hasAncestry', 'hasBackground', 'hasClass', 'holds'],
    },
  },
  {
    key: 'characterStats',
    label: 'Numbers of a character',
    area: 'character',
    does: 'computes the numbers of a character with their parts — ability scores from the statblock’s base plus origin and chosen bonuses and items, proficiency bonus from the level, hit points from the class levels and CON, AC from the armor worn, initiative, every speed, senses, resistances and immunities, the critical-hit threshold — and the statblock as it reads with them (T-272, T-275)',
    uses: {
      [M + 'stats.ts']: ['belongsTo', 'hasAncestry', 'hasClass', 'holds'],
      /* Im Full edit der Figur: der Hinweis auf ihren Statblock (T-272). */
      [W + 'artikel/artikel.ts']: ['belongsTo'],
    },
  },
  {
    key: 'usableBy',
    label: 'Usable by a character',
    area: 'character',
    does: 'checks a prerequisite (feat, attunement, multiclassing) against a character — class levels, ancestry with its base, the statblock’s scores and proficiencies, spellcasting, what it was granted or chose (T-180) — and whether a spell is on the list of one of its classes, up to the level it casts there (T-212)',
    uses: {
      [M + 'requirements.ts']: ['belongsTo', 'grants', 'hasAncestry', 'hasClass', 'spellList'],
      [S + 'liste.ts']: ['spellList'],
      [S + 'app.ts']: ['belongsTo', 'grants', 'hasAncestry', 'hasBackground', 'hasClass', 'subraceOf'],
    },
  },
  {
    key: 'inventory',
    label: 'Inventory',
    area: 'character',
    does: 'draws and changes what a character, a party or a container holds — grid, rotation, zones, weight or slots by the campaign’s rules — and moves stacks between them, except those reserved for something',
    uses: {
      [M + 'inventory.ts']: ['carries', 'holds'],
      [W + 'artikel/inventar.ts']: ['carries', 'holds'],
      /* Die Gruppen der Kampagne mit ihren Figuren und Inventaren (T-127),
         und wer das Gruppeninventar schreibt. */
      [S + 'app.ts']: ['carries', 'memberOfParty', 'partyOf'],
    },
  },
  {
    key: 'leftBehind',
    label: 'Left behind',
    area: 'play',
    does: 'marks what arrives in an inventory as not stowed yet; by the campaign’s rule, what is still unstowed when the session ends (or the table moves on) leaves the party’s and characters’ inventories and is kept at the session, from where it can be picked up again',
    uses: {
      [M + 'stowing.ts']: ['holds', 'leftBehind'],
      [S + 'liegen.ts']: ['holds', 'leftBehind', 'memberOfParty'],
      [W + 'artikel/liegen.ts']: ['leftBehind'],
    },
  },
  {
    key: 'classes',
    label: 'Class pages',
    area: 'character',
    does: 'builds a class page — features by level, subclasses, the class table',
    uses: {
      [M + 'classes.ts']: ['grants', 'subclassOf', 'subraceOf', 'tableFor'],
      [W + 'klassen/klasse.ts']: ['tableFor'],
    },
  },
  {
    key: 'origins',
    label: 'Ancestry and background pages',
    area: 'character',
    does: 'builds an ancestry or background page — traits, variants to compare, dice tables (T-166)',
    uses: {
      [W + 'klassen/herkuenfte.ts']: ['subraceOf'],
    },
  },
  {
    key: 'initiative',
    label: 'Initiative',
    area: 'play',
    does: 'orders the combatants of an encounter, with the party’s members and each creature’s statblock; the tracker moves turns, counts effects down and lists the statblock’s actions and spells (T-022, T-334)',
    uses: {
      [M + 'initiative.ts']: ['belongsTo', 'memberOfParty', 'participates'],
      /* Der Tracker (T-022): Züge und Effekte an den Teilnehmern, die Aktionen vom Statblock, aufgeklappt auch die Zauber (T-334). */
      [M + 'tracker.ts']: ['casts', 'composedOf', 'participates'],
      /* Die Route siebt die Zauber eines Teilnehmers für Spielende (T-334). */
      [S + 'initiative.ts']: ['casts'],
    },
  },
  {
    key: 'boards',
    label: 'Boards',
    area: 'play',
    does: 'lays the article out as a card on the board, hangs a board under its story, and lets a query card list, draw or show articles — and reveal what is drawn to the party (T-340); a campaign gets its board, and its cards read the scene in play, the party and the open quests (T-342); a structure card draws a faction, place or family as an organisation chart or relationship web (T-341)',
    uses: {
      [M + 'board.ts']: ['placed'],
      /* Die Abfrage-Kachel (T-340): eine `placed`-Kante des Boards auf sich selbst. */
      [M + 'boardquery.ts']: ['placed'],
      /* Beim Ziehen freigeben: das Gezogene wird Wissen der Gruppe (T-340). */
      [S + 'abfrage.ts']: ['knownBy'],
      /* Das Kampagnenboard (T-342): an der Kampagne, in ihrer Ebene, und
         die laufenden Quellen (Szene über `partOf`, Gruppe). */
      [M + 'campaignboard.ts']: ['inLayer', 'memberOfParty', 'partOf', 'placed'],
      [S + 'kampagnenboard.ts']: ['memberOfParty'],
      /* Die Struktur-Kachel und das Element `structure` (T-341): Organigramm
         und Beziehungsnetz aus diesen Kanten, in beide Richtungen. */
      [M + 'structure.ts']: ['controls', 'livesIn', 'memberOf', 'partOf', 'placed', 'regards'],
      [W + 'boards/board.ts']: ['inLayer', 'instanceOf', 'partOf', 'placed'],
      [W + 'boards/boards.ts']: ['partOf'],
      [W + 'boards/brett.ts']: ['partOf'],
    },
  },
  {
    key: 'maps',
    label: 'Maps',
    area: 'play',
    does: 'draws the map with its markers and the frames of its sub-maps, zooms through them, shows where the party stands, puts the combatants of the encounter fought there on it and rings whose turn it is, keeps markers, walls and fog per floor and leads tokens through stairs and portals (T-307), shows the markers of a sub-map on the map above and suggests markers set above to place below (T-328), lists the party and the session’s encounters beside it (T-203) — and keeps hidden markers, markers on unseen articles and markers under the fog from players (T-115, T-117)',
    uses: {
      [M + 'map.ts']: ['insideMap', 'mapOf', 'marker', 'onMap', 'participates'],
      [S + 'karten.ts']: ['belongsTo', 'insideMap', 'instanceOf', 'memberOfParty', 'participates'],
      /* Unterkarten verlinken (T-320): die Karte schreibt die Kante `insideMap` an der Unterkarte. */
      [W + 'karten/karte.ts']: ['insideMap', 'instanceOf', 'marker'],
      /* Die Seitenleiste (T-203): die Gruppe und die Begegnungen der Sitzung — im Spiel die Instanzen (T-289). */
      [M + 'kartenseite.ts']: ['instanceOf', 'memberOfParty', 'onMap', 'partOf', 'participates'],
      /* Getragene Lichter (T-305): die Fackel in der Hand einer Figur leuchtet auf der Karte. */
      [M + 'lighting.ts']: ['carries', 'holds', 'marker'],
      /* Ebenen und Übergänge (T-307): Marker je Ebene, ein Übergang ist ein Marker auf die Zielkarte. */
      [M + 'floors.ts']: ['marker'],
      /* Marker zwischen Kartenstufen (T-328): gehoben auf die Karte darüber, oben gesetzt als Vorschlag unten. */
      [M + 'mapstack.ts']: ['marker'],
      /* Eine Begegnung beginnen (T-203): ihre Karte, wenn keine genannt ist. */
      [S + 'kampfstart.ts']: ['onMap'],
    },
  },
  {
    key: 'playInstances',
    label: 'Maps in play',
    area: 'play',
    does: 'takes a map or encounter into play as an instance of its template — tokens, fog and the fight live there, players see the map only once the GM releases it — and lists the played states on the template (T-289)',
    uses: {
      [M + 'playinstance.ts']: ['instanceOf', 'onMap'],
      [S + 'spielinstanz.ts']: ['inLayer', 'onMap'],
    },
  },
  {
    key: 'mapList',
    label: 'Map list',
    area: 'play',
    does: 'lists the maps under Play › Maps with their sub-maps indented and their layers, groups them by the place they show and the places above it (T-330), and says on a map where it is used — sessions, scenes and fights on it, and what it depicts (T-202)',
    uses: {
      [M + 'maplist.ts']: ['insideMap', 'mapOf', 'marker'],
      [M + 'location.ts']: ['insideMap', 'mapOf', 'partOf'],
      [S + 'kartenliste.ts']: ['inLayer'],
      [W + 'karten/kartenpanel.ts']: ['mapOf', 'onMap'],
    },
  },
  {
    key: 'turnplan',
    label: 'Turn planner',
    area: 'play',
    does: 'builds the action bar of a creature on the map from the actions of its statblock, moves its token when the GM confirms a planned turn, and asks for an opportunity attack when the path leaves the reach of a creature on the other side (party members and allies of the encounter against the rest) (T-198)',
    uses: {
      [S + 'zugplan.ts']: ['belongsTo', 'composedOf', 'memberOfParty', 'participates'],
    },
  },
  {
    key: 'doors',
    label: 'Doors',
    area: 'play',
    does: 'opens a door on the map when a player stands next to it, and reveals what the party members who see the door can now see through it (T-118)',
    uses: {
      [S + 'tueren.ts']: ['memberOfParty'],
    },
  },
  {
    key: 'reading',
    label: 'Reading view',
    area: 'reading',
    does: 'reads a layer as a book — chapters and their parts in rank order, maps, fights and the places a section describes in place (T-175)',
    uses: {
      [M + 'reading.ts']: ['inLayer', 'overrides', 'partOf'],
      [M + 'parts.ts']: ['partOf'],
      [S + 'lesen.ts']: ['chapterOf', 'describedIn', 'inLayer', 'mapOf', 'overrides', 'partOf'],
      [W + 'lesen/lesen.ts']: ['participates'],
      [W + 'artikel/artikel.ts']: ['partOf'],
    },
  },
  {
    key: 'timeline',
    label: 'Timelines',
    area: 'reading',
    does: 'puts an article on the timeline of the nearest span it is part of',
    uses: {
      [M + 'timeline.ts']: ['partOf'],
    },
  },
  {
    key: 'checks',
    label: 'Validation and workbench',
    area: 'checks',
    does: 'checks it when saving and on the workbench — stages of a condition, conditions in a fight, a replacement of the same type, templates and copies, and what goes along when a bulk change deletes',
    uses: {
      [M + 'validate.ts']: ['overrides', 'participates', 'stageOf'],
      [M + 'checks.ts']: ['instanceOf', 'variantOf'],
      [M + 'bulk.ts']: ['holds', 'inLayer', 'instanceOf', 'variantOf'],
    },
  },
  {
    key: 'transfer',
    label: 'Import and export',
    area: 'transfer',
    does: 'carries the layer and its group along when importing or exporting',
    uses: {
      [S + 'import.ts']: ['inLayer', 'instanceOf', 'partOf'],
      [S + 'ausfuhr.ts']: ['activates', 'inLayer'],
    },
  },
  {
    key: 'handover',
    label: 'Transfer between installations',
    area: 'transfer',
    does: 'brings what belongs to an article along when it moves between dev and prod — its statblock, inventory and content, its parts, its template — and groups the preview by layer (T-130)',
    uses: {
      [M + 'uebernahme.ts']: ['belongsTo', 'carries', 'holds', 'inLayer', 'instanceOf', 'partOf'],
      [S + 'uebernahme.ts']: ['inLayer'],
    },
  },
  {
    key: 'display',
    label: 'Where it is from',
    area: 'display',
    does: 'shows where an article comes from — its layer, its template, what it is part of — in lists, in the quick view and on the page, where the layer stands under the title with the layers of its other versions (T-251)',
    uses: {
      [M + 'summary.ts']: ['inLayer', 'instanceOf', 'partOf'],
      [S + 'liste.ts']: ['inLayer'],
      /* Die Facetten lassen die Ebenenkante aus — dafür steht „Where from“ (T-174). */
      [M + 'facets.ts']: ['inLayer'],
      /* Der Filter nach Beziehungen lässt sie ebenso aus (T-389). */
      [M + 'relationfilter.ts']: ['inLayer'],
      [M + 'listcolumns.ts']: ['inLayer'],
      [W + 'artikel/artikel.ts']: ['inLayer'],
      /* Die Ebene im Kopf jeder Artikelseite und in der Kurzansicht (T-251). */
      [W + 'artikel/ebenen-marke.ts']: ['inLayer'],
      [W + 'artikel/vorschau.ts']: ['inLayer'],
      /* Der Druck lässt die Ebene aus der Kantenliste — sie steht im Kopf (T-110). */
      [W + 'artikel/blatt.ts']: ['inLayer'],
      /* Schnell anlegen schlägt die Ebene des Ausgangsartikels vor (T-131). */
      [W + 'artikel/schnell.ts']: ['inLayer'],
      /* „New article" nennt eine andere Ebene als die Schreibebene (T-161). */
      [W + 'artikel/anlegen.ts']: ['inLayer'],
      /* Die Ebene, die „New article" dem Assistenten mitgibt (T-095). */
      [W + 'figur/assistent.ts']: ['inLayer'],
      /* Was über eine asField-Kante hängt, am Ort des lesenden Artikels
         (T-125): welche Kanten, sagt `linkedTypes`; genannt werden nur die
         Vorlage einer neuen Instanz und ihre Ebene — das Inventar zeichnet
         `inventar.ts` (T-127). */
      [W + 'artikel/verlinkt.ts']: ['inLayer', 'instanceOf'],
    },
  },
  {
    key: 'sheet',
    label: 'Player sheet',
    area: 'play',
    does: 'draws the header of a character — hit dice from its classes, gold from its inventory and its party’s, spellcasting from its classes and every source that casts (T-309), handouts it knows — and blocks what its hands do not allow: spells without a free hand, an untrained shield, an off-hand attack without a light weapon',
    uses: {
      /* T-247: die Trefferwürfel je Klassenstufe. */
      [M + 'sheet.ts']: ['hasClass'],
      /* T-309: Zauber und Plätze aus Klasse, Herkunft, Talenten, Gegenständen und Wahlen. */
      [M + 'spellcasting.ts']: ['carries', 'casts', 'chose', 'grants', 'hasAncestry', 'hasBackground', 'hasClass', 'holds'],
      [W + 'bogen/daten.ts']: ['carries', 'composedOf', 'hasClass', 'hasProperty', 'holds', 'memberOfParty'],
      /* Die Zauberlisten der eigenen Klassen (T-246). */
      [W + 'bogen/zauberliste.ts']: ['hasClass'],
      /* Handouts: Wissen, das an der Figur oder ihrer Gruppe hängt (T-247). */
      [W + 'bogen/kampagne.ts']: ['knownBy', 'memberOfParty'],
    },
  },
];

/**
 * Wörter in einer Datei, die wie eine Kantenart heissen und keine sind: die
 * Layout-Elemente `knowledge` und `crafting` (auch in der Anordnung der
 * Artikelseite), die CSS-Klasse `holds`, das
 * Verb „carries" in einem Satz, die Herkunft `discount` eines Preisschritts.
 */
export const NOT_EDGE_WORDS: Readonly<Record<string, readonly string[]>> = {
  [M + 'types.ts']: ['crafting', 'knowledge'],
  [M + 'validate.ts']: ['crafting', 'knowledge'],
  [W + 'register/typ.ts']: ['carries', 'holds'],
  [W + 'register/arbeit.ts']: ['carries'],
  [W + 'artikel/anordnung.ts']: ['crafting'],
  [W + 'ansichten/palette.ts']: ['crafting'],
  /* Die Sorte „crafting" der Regeloptionen (T-190), wie das Modul in T-132 heissen wird. */
  [M + 'ruleOptions.ts']: ['crafting'],
  /* Die Herkunft eines Preisschritts heisst wie die Kante, aus der er kommt (T-129). */
  [W + 'kern/api.ts']: ['discount'],
};

/** Die Auswerter, die diese Kantenart lesen. */
export function edgeReaders(type: string): EdgeReader[] {
  return EDGE_READERS.filter((r) => Object.values(r.uses).some((l) => l.includes(type)));
}

/** Was eine Kantenart bedeutet und bewirkt — gerechnet, nicht behauptet. */
export interface EdgeEffects {
  type: string;
  /** Der Satz aus dem Register, sonst einer aus den Beschriftungen. */
  means: string;
  /** Die Auswerter, die sie lesen. */
  readers: { key: string; label: string; area: EdgeArea; does: string }[];
  /** Was aus der Zeile selbst folgt: Komposition, Feld am anderen Ende, Rechnungen. */
  shape: { kind: EdgeShape; text: string }[];
  /** Liest sie irgendetwas ausser der Anzeige? */
  evaluated: boolean;
  /** Was sie bewirken soll und noch nicht bewirkt — nur, wenn nichts sie liest. */
  intended?: string;
}

function typLabel(reg: Pick<Registry, 'interfaces'>, t: string): string {
  if (t === '*') return 'any article';
  if (t === 'same') return 'its own type';
  return reg.interfaces[t]?.label ?? t;
}

function enden(reg: Pick<Registry, 'interfaces'>, l: string[] | undefined): string {
  return (l?.length ? l : ['*']).map((t) => typLabel(reg, t)).join(' or ');
}

/** Ein Satz aus den Beschriftungen, wo das Register keinen hat. */
export function edgeMeaning(reg: Pick<Registry, 'interfaces'>, def: RelationDef): string {
  if (def.means) return def.means;
  return `${enden(reg, def.from)} — ${def.label} → ${enden(reg, def.to)}; from the other end it reads “${def.inverseLabel}”.`;
}

/**
 * Gerechnete Felder, deren Rechnung diese Kante nennt (`sum(hasClass.level)`).
 * Gesucht wird das Wort vor einem Punkt; eine Kante, die in einer Rechnung
 * steht, ist eine, deren Anlegen eine Zahl ändert.
 */
function rechnungen(reg: Pick<Registry, 'interfaces'>, type: string): EdgeEffects['shape'] {
  const muster = new RegExp(`\\b${type}\\.`);
  const raus: EdgeEffects['shape'] = [];
  for (const [name, def] of Object.entries(reg.interfaces)) {
    for (const [feld, p] of Object.entries(def.schema?.properties ?? {})) {
      if (typeof p.derived === 'string' && muster.test(p.derived)) {
        raus.push({ kind: 'derived', text: `calculates ${def.label ?? name} › ${p.title ?? feld} = ${p.derived}` });
      }
    }
  }
  return raus;
}

export function edgeEffects(reg: Pick<Registry, 'interfaces' | 'relations'>, type: string): EdgeEffects {
  const def: RelationDef = reg.relations[type] ?? { type, label: type, inverseLabel: `← ${type}` };
  const shape: EdgeEffects['shape'] = [];
  if (def.section) shape.push({ kind: 'section', text: `composes the target into the ${enden(reg, def.from)} under “${def.section}”` });
  if (def.asField) {
    const hier = def.asField === 'to' ? def.to : def.from;
    const dort = def.asField === 'to' ? def.from : def.to;
    shape.push({ kind: 'asField', text: `lets the ${enden(reg, hier)} show and edit the ${enden(reg, dort)}’s fields as its own` });
  }
  shape.push(...rechnungen(reg, type));
  const readers = edgeReaders(type).map(({ key, label, area, does }) => ({ key, label, area, does }));
  const evaluated = readers.length > 0 || shape.length > 0;
  return {
    type,
    means: edgeMeaning(reg, def),
    readers,
    shape,
    evaluated,
    ...(!evaluated && def.intended ? { intended: def.intended } : {}),
  };
}

/**
 * Ein Satz für die Auswahl und den Tooltip: „Adding this: …". Ohne Leser:
 * „Shown under Relations; nothing else reads it", und was sie bewirken
 * soll, wenn sie es verspricht.
 */
export function edgeEffectText(e: EdgeEffects): string {
  if (!e.evaluated) {
    return e.intended
      ? `Not evaluated yet — shown under Relations only. Meant to: ${e.intended}`
      : 'Display only — shown under Relations on both ends; nothing else reads it.';
  }
  const teile = [...e.shape.map((s) => s.text), ...e.readers.map((r) => `${r.label}: ${r.does}`)];
  return `Adding this: ${teile.join('; ')}.`;
}

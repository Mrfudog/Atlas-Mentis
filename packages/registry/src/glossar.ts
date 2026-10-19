/**
 * **Die Wörter der App** (T-242, T-225): der Startbestand des Glossars, der
 * zum Code gehört und darum hier steht — nicht in einer Datenbank, aus der
 * er nach einem Umbau verschwindet, und nicht in einem Text, den niemand
 * prüft. Das Handbuch zeigt ihn neben den Glossarartikeln (`GlossaryTerm`)
 * aus dem Stapel.
 *
 * **Spielbegriffe stehen hier nicht** (Zustände, Waffeneigenschaften,
 * Aktionsarten): sie sind Inhalt eines Regelwerks und liegen als Artikel in
 * dessen Ebene. Das Repository ist öffentlich.
 *
 * Erzwungen wird das Nachziehen von `test/glossar.test.ts`: jede anlegbare
 * Art steht in genau einem Eintrag (`types`), jedes der neun Wörter aus
 * `docs/Begriffe.md` hat einen, und kein Name kommt zweimal vor. Fehlt
 * einer, nennt der Test ihn.
 *
 * Sichtbarer Text englisch, Übersetzung deutsch (Schweizer Schreibung).
 */

import type { GlossarySort } from '@nw/model';

export interface AppTerm {
  term: string;
  aliases?: string[];
  /** `app` für Begriffe der App, `type` für eine Artikelart. */
  sort: Extract<GlossarySort, 'app' | 'type'>;
  definition: string;
  /** Was es in der Arbeit mit der App ändert (beim Spielbegriff: am Tisch). */
  effect?: string;
  example?: string;
  /** Übersetzungen je Sprachkürzel. */
  translations?: Record<string, string>;
  /** Die Artikelarten, die dieser Eintrag erklärt (Registername). */
  types?: string[];
  /** Ein Abschnitt des Handbuchs oder eine Seite, die weiterführt. */
  see?: string;
}

/** Die Wörter, mit denen die App über sich selbst spricht. */
const APP: AppTerm[] = [
  {
    term: 'Type',
    aliases: ['Article type', 'Kind of article'],
    sort: 'app',
    definition: 'A row in the registry that says what fields an article has, which other types it takes in, and how it is drawn.',
    effect: 'A new kind of thing is a new row in Registry › Types — no code change.',
    example: 'Creature is a type; “Volo” is an article of that type.',
    translations: { de: 'Typ' },
    see: '/registry',
  },
  {
    term: 'Part',
    aliases: ['Component'],
    sort: 'app',
    definition: 'A type that another type is made of; it keeps its own card on the article.',
    effect: 'Change a field on the part and every type that takes it in changes with it.',
    example: 'Every article type takes in Identity (name, number, aliases).',
    translations: { de: 'Bestandteil' },
  },
  {
    term: 'Field',
    sort: 'app',
    definition: 'One fact an article records: a name, a number, a list, a long text.',
    effect: 'In edit mode required and filled fields show; the rest come in with “+ Add field”.',
    example: 'Armor Class is a field of the statblock.',
    translations: { de: 'Feld' },
  },
  {
    term: 'Identifier',
    aliases: ['ID', 'Number'],
    sort: 'app',
    definition: 'The number an article gets when it is created, such as npc-0042. It never changes, even when the name does.',
    effect: 'Links in text name the identifier, so renaming an article never breaks them.',
    translations: { de: 'Bezeichner' },
  },
  {
    term: 'Article',
    aliases: ['Entry'],
    sort: 'app',
    definition: 'One thing in the campaign or the rules: a character, a place, a spell, a map.',
    effect: 'Everything you create, link, reveal or put on a board is an article.',
    translations: { de: 'Artikel' },
    see: '/compendium',
  },
  {
    term: 'View',
    sort: 'app',
    definition: 'How an article is drawn in a place: overview in a list or link, quick on a card or popup, full on its page, print on paper, search under a search hit.',
    effect: 'The place picks the view; you never choose a “player view” — players see the same view with less in it.',
    translations: { de: 'Ansicht' },
  },
  {
    term: 'Applies to',
    aliases: ['View scope'],
    sort: 'app',
    definition: 'Which articles a designed view is for: types (with their subtypes), conditions on field values or edges, or exactly one article.',
    effect: 'Where one view is needed, the most specific that applies wins — only this article, then a condition, then a type, then every article. Where you pick (a board card, the View row on an article), every view that applies is offered.',
    example: 'The view “Shop” applies to creatures that are the shopkeeper of a shop.',
    translations: { de: 'Geltung' },
  },
  {
    term: 'View designer',
    sort: 'app',
    aliases: ['View editor'],
    definition: 'The one editor for views: a view as a tree of elements — sections, columns, tabs, tile groups, carousels, collapsibles, quotes, badges, tables from edges, the page elements — each with its values, also from linked articles.',
    effect: 'Registry › Views, “Design” on a type’s page, or “Design this view” on an article. Saving asks where the change goes: every article, the whole type (own or adjusted), one article, or a new view with a condition.',
    translations: { de: 'Ansichtsdesigner' },
  },
  {
    term: 'Adjusted arrangement',
    aliases: ['Adjusted'],
    sort: 'app',
    definition: 'What a type says for a view as a difference to what it inherits: elements left out, fields an element adds, elements only here, another order, fields never shown.',
    effect: 'New elements and fields of the view still reach the type; an own arrangement replaces the view and keeps what it was. The view designer saves an adjustment when “adjusted” is ticked under “the whole type”.',
    translations: { de: 'Anpassung' },
  },
  {
    term: 'Value path',
    sort: 'app',
    definition: 'Where an element of a view takes its values: the article itself, or the articles at the end of one or more edges.',
    example: 'shopkeeper › Shop › sells › Item shows the wares of the shop a creature keeps.',
    translations: { de: 'Wertepfad' },
  },
  {
    term: 'Block',
    aliases: ['Layout element'],
    sort: 'app',
    definition: 'One piece of a view: a field table, a text, a statblock, an inventory, a map.',
    translations: { de: 'Block' },
  },
  {
    term: 'Edge',
    aliases: ['Link', 'Relation'],
    sort: 'app',
    definition: 'A typed, directed connection from one article to another, such as “member of” or “lies in”. It may carry its own values.',
    effect: 'The other direction is always a question, never a second copy — so it cannot go stale.',
    example: 'A character is a member of a faction, with rank “Initiate” on the edge.',
    translations: { de: 'Kante' },
  },
  {
    term: 'Unit',
    sort: 'app',
    definition: 'How a measure is written and converted, such as feet or metres. Values are stored as written and converted when shown.',
    effect: 'The campaign setting Units decides whether you see 30 ft or 9 m.',
    translations: { de: 'Einheit' },
  },
  {
    term: 'Layer',
    aliases: ['Book', 'Source layer'],
    sort: 'app',
    definition: 'A collection of articles that comes from one place: a rulebook, a homebrew collection, the campaign, a player.',
    effect: 'A campaign switches layers on and off; what no switched-on layer brings is not there. Every article names its layer under its title, with the layers of its other versions and why you see it: in play, from a compare layer, enabled as extra content, or in no layer.',
    translations: { de: 'Ebene' },
    see: '/campaign',
  },
  {
    term: 'View as',
    aliases: ['Viewing as'],
    sort: 'app',
    definition: 'The GM, a co-GM or the administration sees the site as one member of the running campaign — read only, on every page.',
    effect: 'The server filters as it would for that member, so lists, articles, maps and the player page show exactly what they would see. Switch with “View as ▾” in the header (Alt+Shift+V); the band at the top leads back.',
    translations: { de: 'Ansicht als' },
    see: '/campaign',
  },
  {
    term: 'Layer stack',
    aliases: ['Stack'],
    sort: 'app',
    definition: 'The layers a campaign has switched on, in order. A more specific layer may override or remove what a general one brings.',
    effect: 'Changing the stack changes what everyone at the table can find — set it in the layers popup of the header.',
    translations: { de: 'Stapel' },
  },
  {
    term: 'Layer group',
    sort: 'app',
    definition: 'A layer that contains layers, such as all books of one publisher. Switched on, it brings all its members.',
    translations: { de: 'Ebenengruppe' },
  },
  {
    term: 'Campaign layer',
    sort: 'app',
    definition: 'The layer that belongs to a campaign. Its GM and co-GMs write in it.',
    translations: { de: 'Kampagnenebene' },
  },
  {
    term: 'Player layer',
    sort: 'app',
    definition: 'Each player’s own layer in a campaign; what they create goes there unless they choose another.',
    translations: { de: 'Spielerebene' },
  },
  {
    term: 'Write layer',
    sort: 'app',
    definition: 'The layer new articles go into. Each account chooses it in the layers popup; otherwise a default applies.',
    translations: { de: 'Schreibebene' },
  },
  {
    term: 'Adapted version',
    aliases: ['Version'],
    sort: 'app',
    definition: 'Your own copy of an article you may not write, kept in one of your layers; in play it takes the place of the original.',
    effect: 'Edit on an article you cannot write makes an adapted version instead.',
    translations: { de: 'Fassung' },
  },
  {
    term: 'Template and instance',
    aliases: ['Instance', 'Template'],
    sort: 'app',
    definition: 'An instance reads everything from its template and stores only what differs. Thirty guards from one template are thirty instances.',
    effect: 'A correction to the template reaches every instance that did not set that field itself.',
    translations: { de: 'Vorlage und Instanz' },
  },
  {
    term: 'Status',
    aliases: ['Idea', 'Prepared', 'Ready'],
    sort: 'app',
    definition: 'How far an article is prepared: idea, prepared or ready. Players see only what is ready, apart from their own.',
    translations: { de: 'Status' },
  },
  {
    term: 'Audience',
    aliases: ['Visibility', 'Revealed to', 'Hidden from'],
    sort: 'app',
    definition: 'Who may see an article at all: public, campaign, players or GM — and lists of characters, parties or factions it is revealed to or hidden from.',
    effect: 'Hidden from beats revealed to beats the article’s own audience; without one, the campaign’s rule for its group counts, then the default of its layer, then public.',
    translations: { de: 'Sichtbarkeit' },
  },
  {
    term: 'Role',
    aliases: ['GM', 'Co-GM', 'Player', 'Spectator'],
    sort: 'app',
    definition: 'What an account is at the table of one campaign: gm, co-gm, player or spectator. It belongs to the account, not to any article.',
    translations: { de: 'Rolle' },
    see: '/campaign',
  },
  {
    term: 'Area',
    aliases: ['World', 'Story', 'Rules', 'Play'],
    sort: 'app',
    definition: 'Where a kind of article lives in the header: world, story, rules or play. It is set on the type.',
    translations: { de: 'Bereich' },
  },
  {
    term: 'Registry',
    sort: 'app',
    definition: 'The page where types, edges, lists and views are created and changed.',
    translations: { de: 'Register' },
    see: '/registry',
  },
  {
    term: 'Compendium',
    sort: 'app',
    definition: 'The list of all articles in the stack, across all areas, with filters.',
    translations: { de: 'Kompendium' },
    see: '/compendium',
  },
  {
    term: 'Workbench',
    sort: 'app',
    definition: 'Checks and bulk changes over many articles at once, with preview and undo — for the GM and the administration.',
    translations: { de: 'Werkbank' },
    see: '/werkbank',
  },
  {
    term: 'Rule option',
    aliases: ['Rules & options', 'House rule'],
    sort: 'app',
    definition: 'A choice a campaign makes about how it plays, such as how ability scores are rolled or how inventory is counted.',
    effect: 'Set on the campaign page under Rules & options; each option says what it does.',
    translations: { de: 'Regeloption' },
    see: '/handbook#rules',
  },
  {
    term: 'Handout',
    sort: 'app',
    definition: 'A view for printing or showing one article to the players, set up in Registry › Views. On a character’s Campaign tab, the handouts are the pictures, letters, maps and knowledge the character was given.',
    translations: { de: 'Handzettel' },
  },
  {
    term: 'Character sheet',
    aliases: ['Sheet header', 'Status row'],
    sort: 'app',
    definition: 'The header of a character above its tabs: hit points with an amount for damage, healing and temporary hit points, vitals and spellcasting, hit dice, slots, inspiration, gold, abilities, and the status row with concentration and conditions. Collapses with “▴ Less”.',
    translations: { de: 'Charakterbogen' },
  },
  {
    term: 'Your turn',
    sort: 'app',
    definition: 'The list of everything a character can do on its turn, by action type, with what is used this turn. What the hands block stays visible with the reason.',
    translations: { de: 'Dein Zug' },
  },
  {
    term: 'Floating toolbar',
    sort: 'app',
    definition: 'The bar at the bottom while something is selected: its actions, undo and done; on a phone compact, with details as a sheet from below.',
    translations: { de: 'Schwebende Werkzeugleiste' },
  },
  {
    term: 'Quick view',
    aliases: ['Popup'],
    sort: 'app',
    definition: 'The small card that opens when you click a named article; “Open article” leads to its page.',
    translations: { de: 'Kurzansicht' },
  },
  {
    term: 'Filter group',
    sort: 'app',
    definition: 'A saved filter of a page, shown as a tab. The campaign’s are kept by the GM, your own by you.',
    translations: { de: 'Filtergruppe' },
  },
  {
    term: 'Visibility by group',
    aliases: ['Layer default', 'Visibility rule'],
    sort: 'app',
    definition: 'Who sees a group of articles in a campaign — all of a layer, a type, an area, a tag. The layer sets the default, the campaign overrides it per group, and an article’s own setting wins over both.',
    effect: 'Set on the campaign page under Visibility; it also holds for articles added later.',
    translations: { de: 'Sichtbarkeit je Gruppe' },
  },
  {
    term: 'Transformation',
    sort: 'app',
    definition: 'A chain of steps — group by, filter, sort — that turns a list into a tree with a count on every node, as in Jira Structure. Steps can be reordered, saved under a name and shared as a link.',
    translations: { de: 'Transformation' },
  },
  {
    term: 'Glossary',
    sort: 'app',
    definition: 'Terms with definition, effect at the table, examples and translations. Terms are spotted in text — hover for a preview, Ctrl/⌘+click to open the entry.',
    translations: { de: 'Glossar' },
    see: '/handbook#glossary',
  },
  {
    term: 'Handbook',
    aliases: ['Help'],
    sort: 'app',
    definition: 'One page with everything the app explains: first steps, the help of each page, rules and options, the article types and the glossary.',
    effect: 'The “?” in the header opens the part of the handbook for the page you are on.',
    translations: { de: 'Handbuch' },
    see: '/handbook',
  },
];

/** Eine Zeile je anlegbarer Art. */
const TYPES: AppTerm[] = [
  { term: 'Creature', aliases: ['NPC', 'Monster'], sort: 'type', types: ['Creature'], definition: 'A being in the world: a non-player character, a monster, a companion, a pet. Its numbers live on its statblock.', translations: { de: 'Kreatur' } },
  { term: 'Player character', aliases: ['PC', 'Character'], sort: 'type', types: ['PlayerCharacter'], definition: 'A creature a player plays. The player manages it fully, including statblock and inventory.', translations: { de: 'Spielercharakter' } },
  { term: 'Statblock', sort: 'type', types: ['Statblock'], definition: 'The numbers of a creature: armor class, hit points, speed, abilities, proficiencies. A creature has one; many can come from one template.', translations: { de: 'Werteblock' } },
  { term: 'Party', sort: 'type', types: ['Party'], definition: 'The characters of one campaign’s table. Each campaign has one.', translations: { de: 'Gruppe' } },
  { term: 'Faction', sort: 'type', types: ['Faction'], definition: 'An organisation with ranks; its members know what it knows, from the rank given.', translations: { de: 'Fraktion' } },
  { term: 'Deity', sort: 'type', types: ['Deity'], definition: 'A god or power that creatures worship.', translations: { de: 'Gottheit' } },
  { term: 'Place', aliases: ['Location'], sort: 'type', types: ['Place'], definition: 'A location: a region, a city, a building, a room. Places lie in places.', translations: { de: 'Ort' } },
  { term: 'Shop', sort: 'type', types: ['Shop'], definition: 'A place that sells wares and gives discounts.', translations: { de: 'Laden' } },
  { term: 'Lore article', aliases: ['General article'], sort: 'type', types: ['Article'], definition: 'A free article about anything that has no type of its own.', translations: { de: 'Artikel (frei)' } },
  { term: 'World', sort: 'type', types: ['World'], definition: 'The world campaigns play in; it carries the calendar.', translations: { de: 'Welt' } },
  { term: 'Event', sort: 'type', types: ['Event'], definition: 'Something that happened at a date in the world’s history.', translations: { de: 'Ereignis' } },
  { term: 'Campaign', sort: 'type', types: ['Campaign'], definition: 'A running game: its layers, its rule options, its party and its sessions.', translations: { de: 'Kampagne' }, see: '/campaign' },
  { term: 'Story', aliases: ['Adventure'], sort: 'type', types: ['Story'], definition: 'The story of the game: an adventure, a prologue — with arcs, scenes and quests below it.', translations: { de: 'Geschichte' } },
  { term: 'Arc', aliases: ['Chapter of an adventure'], sort: 'type', types: ['Arc'], definition: 'A part of a story with stages, a hook and an outcome. A chapter of an adventure is an arc.', translations: { de: 'Handlungsbogen' } },
  { term: 'Scene', sort: 'type', types: ['Scene'], definition: 'A scene of a story; a map always belongs to one.', translations: { de: 'Szene' } },
  { term: 'Encounter', sort: 'type', types: ['Encounter'], definition: 'A meeting with combat, conversation, a puzzle or a hazard, with its participants and their initiative.', translations: { de: 'Begegnung' } },
  { term: 'Session', sort: 'type', types: ['Session'], definition: 'One evening of play: who sits at the table, which map, encounter and scene are running.', translations: { de: 'Sitzung' } },
  { term: 'Quest', sort: 'type', types: ['Quest'], definition: 'A task the party pursues, with its progress.', translations: { de: 'Auftrag' } },
  { term: 'Information', sort: 'type', types: ['Information'], definition: 'Some fields of one article — or of every article in a group, like all orcs — that someone knows; given to a character, party, faction, or to everyone with an ancestry, background, class or feat.', translations: { de: 'Information' } },
  { term: 'Knowledge', sort: 'type', types: ['Knowledge'], definition: 'A bundle of pieces of information, given out together — to characters, or to everyone with an ancestry, background, class or feat.', translations: { de: 'Wissen' } },
  { term: 'Map', sort: 'type', types: ['Map'], definition: 'A map with grid, markers, walls, fog and light, used on Play.', translations: { de: 'Karte' }, see: '/play' },
  { term: 'Board', sort: 'type', types: ['Board'], definition: 'A canvas of cards for a story article; what lies on it are edges.', translations: { de: 'Board' } },
  { term: 'Table', aliases: ['Random table', 'Deck'], sort: 'type', types: ['Table'], definition: 'A table to roll on, or a deck of cards; tables may nest.', translations: { de: 'Tabelle' } },
  { term: 'Rule element', aliases: ['Rule'], sort: 'type', types: ['Rule'], definition: 'A piece of rules text: a rule, an upgrade, a facility, a card.', translations: { de: 'Regelelement' } },
  { term: 'Feat', sort: 'type', types: ['Feat'], definition: 'A talent a character takes; it may ask choices and have effects.', translations: { de: 'Talent' } },
  { term: 'Skill', sort: 'type', types: ['Skill'], definition: 'A skill and the ability it rolls on.', translations: { de: 'Fertigkeit' } },
  { term: 'Language', sort: 'type', types: ['Language'], definition: 'A language one can be proficient in.', translations: { de: 'Sprache' } },
  { term: 'Class', sort: 'type', types: ['Class'], definition: 'A character class, with what it grants at which level and its spell list.', translations: { de: 'Klasse' } },
  { term: 'Subclass', sort: 'type', types: ['Subclass'], definition: 'A specialisation of a class.', translations: { de: 'Unterklasse' } },
  { term: 'Ancestry', aliases: ['Race', 'Species'], sort: 'type', types: ['Ancestry'], definition: 'Where a character comes from by birth, with what that grants.', translations: { de: 'Abstammung' } },
  { term: 'Background', sort: 'type', types: ['Background'], definition: 'What a character did before the adventure, with what that grants.', translations: { de: 'Hintergrund' } },
  { term: 'Ability score method', sort: 'type', types: ['AbilityMethod'], definition: 'A way to arrive at the six ability scores (roll, array, point buy); a campaign allows some.', translations: { de: 'Attributsmethode' }, see: '/handbook#rules' },
  { term: 'Starting equipment method', sort: 'type', types: ['EquipmentMethod'], definition: 'A way a new character gets its equipment; a campaign allows some.', translations: { de: 'Startausrüstungsmethode' }, see: '/handbook#rules' },
  { term: 'Condition article', sort: 'type', types: ['Condition'], definition: 'A condition a creature can have, such as a stage of exhaustion. The glossary term explains it in a sentence.', translations: { de: 'Zustand' } },
  { term: 'Disease', sort: 'type', types: ['Disease'], definition: 'A disease, assigned like a condition.', translations: { de: 'Krankheit' } },
  { term: 'Action type article', sort: 'type', types: ['ActionType'], definition: 'A kind of action: action, bonus action, reaction, movement.', translations: { de: 'Aktionsart' } },
  { term: 'Action', sort: 'type', types: ['Action'], definition: 'Something a creature can do, with its action type.', translations: { de: 'Aktion' } },
  { term: 'Feature', sort: 'type', types: ['Feature'], definition: 'Anything lasting a class, ancestry, monster or region gives.', translations: { de: 'Merkmal' } },
  { term: 'Item property', sort: 'type', types: ['ItemProperty'], definition: 'A property of a weapon or item, such as a reach or a two-handed grip.', translations: { de: 'Gegenstandseigenschaft' } },
  { term: 'Spell', sort: 'type', types: ['Spell'], definition: 'A spell with level, school, casting time, range, components and duration.', translations: { de: 'Zauber' } },
  { term: 'Hazard', aliases: ['Trap'], sort: 'type', types: ['Hazard'], definition: 'A trap or hazard; placed on a map as a marker.', translations: { de: 'Gefahr' } },
  { term: 'Zone kind', sort: 'type', types: ['ZoneKind'], definition: 'A rule that applies at places on a map, such as difficult terrain.', translations: { de: 'Zonenart' } },
  { term: 'Item', sort: 'type', types: ['Item'], definition: 'A thing one can carry: gear, a tool, a magic item. In an inventory it is a piece of its own.', translations: { de: 'Gegenstand' } },
  { term: 'Weapon', sort: 'type', types: ['Weapon'], definition: 'An item to attack with, with its category, damage and properties.', translations: { de: 'Waffe' } },
  { term: 'Armor', sort: 'type', types: ['Armor'], definition: 'An item worn for protection, with its armor type and class.', translations: { de: 'Rüstung' } },
  { term: 'Material', sort: 'type', types: ['Material'], definition: 'An item used up in crafting, with its material type.', translations: { de: 'Material' } },
  { term: 'Material group', sort: 'type', types: ['MaterialGroup'], definition: 'Any material with certain properties; a recipe may ask for one, and the piece is chosen at the start.', translations: { de: 'Materialgruppe' } },
  { term: 'Material substitution', sort: 'type', types: ['Substitution'], definition: 'A rule which materials may stand in for others; a campaign allows some.', translations: { de: 'Ersatzregel' } },
  { term: 'Inventory', aliases: ['Container', 'Bag'], sort: 'type', types: ['Inventory'], definition: 'A container with its own shape and zones that holds pieces.', translations: { de: 'Inventar' } },
  { term: 'Recipe', sort: 'type', types: ['Recipe'], definition: 'What it takes to make an item: tool, check, time and materials.', translations: { de: 'Rezept' } },
  { term: 'Trade', aliases: ['Profession'], sort: 'type', types: ['Trade'], definition: 'A craft with its tools; its page lists what it can make.', translations: { de: 'Beruf' } },
  { term: 'Crafting order', sort: 'type', types: ['CraftingOrder'], definition: 'One run of a recipe: its progress, its checks and the materials it holds reserved.', translations: { de: 'Fertigungsauftrag' } },
  { term: 'Chapter', sort: 'type', types: ['Chapter'], definition: 'A chapter of a book, made of parts in order; read in the reader.', translations: { de: 'Kapitel' } },
  {
    term: 'Book part',
    aliases: ['Heading', 'Paragraph', 'Read-aloud text', 'Embedded article'],
    sort: 'type',
    types: ['Heading', 'Paragraph', 'ReadAloudText', 'Embed'],
    definition: 'A piece of a chapter: a heading, a paragraph, a read-aloud text or an embedded article. Each can be taken into your own story on its own.',
    translations: { de: 'Buchteil' },
  },
  { term: 'Asset', aliases: ['Image', 'File'], sort: 'type', types: ['Asset'], definition: 'An image or file as an article, with tags, source and visibility.', translations: { de: 'Datei' } },
  { term: 'Layer article', sort: 'type', types: ['Layer'], definition: 'A layer as an article: a book, homebrew, the campaign’s own or a player’s.', translations: { de: 'Ebene (Artikel)' } },
  { term: 'Glossary term', sort: 'type', types: ['GlossaryTerm'], definition: 'An article in the glossary: a term with definition, effect, examples and translations, explaining a rule article.', translations: { de: 'Glossarbegriff' }, see: '/handbook#glossary' },
];

export const APP_TERMS: readonly AppTerm[] = [...APP, ...TYPES];

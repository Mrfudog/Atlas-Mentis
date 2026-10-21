/**
 * **Die Regeloptionen einer Kampagne, auffindbar** (T-190, Schritt 1 von
 * T-132/E-044 c): was heute an verschiedenen Stellen steht — Felder an der
 * Kampagne, Kanten auf Verfahren, Einstellungen der Installation —, nach
 * **Sorte** gruppiert, je Option ein Satz, was sie bewirkt, und je
 * Variante der Regelartikel, der sie erklärt.
 *
 * Die Sorten sind dieselben, die T-132 als Module baut (`inventory`,
 * `crafting`, `abilities`, `equipment`, `character`, `travel`, `units`,
 * `map` (T-204), `combat` (T-022), dazu `table` für das, was keine Spielregel, aber Tischregel ist). Kommt
 * das Modul, ändert sich nur, **woher** `ruleOptionsOf` den Wert nimmt —
 * die Seite bleibt.
 *
 * Gelesen wird hier nichts Neues: jede Option geht über die Funktion, die
 * ihr Teilsystem ohnehin liest (`inventoryRulesOf`, `craftRulesOf`,
 * `allowedMethods` …), damit die Seite nie etwas anderes sagt, als gilt.
 *
 * **Seit T-270 kommt die Auswahl aus Regelartikeln:** je System, Regel
 * und Option ein Artikel (`Rule.kind`, `Rule.key`, `partOf`), mit Namen und
 * Text. Der Katalog hier sagt nur, was die Laufzeit ausführen kann und
 * woher der Wert kommt; seine Sätze sind der Anfang, mit dem die Einfuhr
 * fehlende Artikel anlegt (`missingRuleArticles`). Buchtext steht hier
 * keiner — nur eigene kurze Sätze (T-190).
 */

import { allowedMethods, type AbilityMethod } from './abilities.js';
import { craftRulesOf } from './crafting.js';
import { allowedEquipmentMethods, type EquipmentMethod } from './equipment.js';
import { hitPointRuleOf } from './hitpoints.js';
import { enhancementsByOf, itemPricingOf } from './enhancement.js';
import { inventoryRulesOf } from './inventory.js';
import { MAP_KINDS, kindMarkerViewOf, mapRulesOf, mapToolTable } from './map.js';
import { stowingRuleOf } from './stowing.js';
import { initiativeRulesOf } from './tracker.js';
import { turnPlannerOf } from './zugplan.js';
import { passageRulesOf } from './passages.js';
import { mapLinkDefaultsOf } from './maplinks.js';
import { substitutionsOf, substitutionText } from './substitutes.js';
import { entityName } from './entity.js';
import { playerStartOf } from './campaignboard.js';
import type { Entity, EntityId } from './types.js';

export type RuleSortKey = 'inventory' | 'items' | 'crafting' | 'abilities' | 'equipment' | 'character' | 'travel' | 'units' | 'map' | 'combat' | 'table';

export interface RuleSortDef {
  key: RuleSortKey;
  label: string;
  does: string;
}

/** Die Sorten in der Reihenfolge der Seite. */
export const RULE_SORTS: readonly RuleSortDef[] = [
  { key: 'abilities', label: 'Ability scores', does: 'How players arrive at their six ability scores.' },
  { key: 'equipment', label: 'Starting equipment', does: 'What a new character starts the game with.' },
  { key: 'character', label: 'Character options', does: 'What a character may pick beyond class, ancestry and background.' },
  { key: 'inventory', label: 'Inventory', does: 'How the table counts what characters carry, and how fast they get it out.' },
  { key: 'items', label: 'Items', does: 'How pieces with enhancements such as +1 or silvered are priced, and who may enhance them.' },
  { key: 'crafting', label: 'Crafting', does: 'What a crafting check does when it succeeds, fails or rolls a natural 20 or 1.' },
  { key: 'travel', label: 'Travel', does: 'What travel costs in food, light and watches.' },
  { key: 'units', label: 'Units', does: 'In which measures distances and weights are shown.' },
  { key: 'map', label: 'On the map', does: 'What the fog of war hides from whom, and how tokens move outside an encounter.' },
  { key: 'combat', label: 'Combat', does: 'Whether the initiative tracker runs, what players see of it, and how much they plan of a turn.' },
  { key: 'table', label: 'At the table', does: 'Who sees what during play.' },
];

/** Eine Variante einer Option: ein Wert, mit dem, was er tut. */
export interface RuleVariantDef {
  key: string;
  label: string;
  does: string;
  /** Buchartikel, auf denen diese Option beruht (Namen) — der Artikel der Option verweist darauf (T-270). */
  rules?: string[];
  /** Der Glossarbegriff, der sie erklärt (T-347, wie `PropertySchema.glossary`). */
  glossary?: string;
}

export type RuleOptionSource =
  /** Ein Feld an der Kampagne, `Campaign.<feld>`. */
  | { field: string }
  /** Kanten von der Kampagne auf Artikel, die das Verfahren tragen. */
  | { edge: 'allowsMethod' | 'allowsEquipment' | 'allowsSubstitution' }
  /** Einstellungen der Installation (`registry.settings`), bis T-132 sie ins Modul holt. */
  | { settings: string[] };

export interface RuleOptionDef {
  key: string;
  sort: RuleSortKey;
  label: string;
  does: string;
  source: RuleOptionSource;
  variants?: readonly RuleVariantDef[];
  /** Buchartikel, auf denen die Regel beruht (Namen) — ihr Artikel verweist darauf (T-270). */
  rules?: string[];
  /**
   * **Der Glossarbegriff, der sie erklärt** (T-347, T-225): Handbuch und
   * Rules & options zeigen dann seinen Eintrag statt `does` — der Satz
   * bleibt für die Einfuhr der Regelartikel und wo es den Begriff nicht gibt.
   */
  glossary?: string;
  /**
   * **Gilt nur unter einer Variante einer anderen Option** (T-248): Basils
   * Raster, Zonen und Körperplätze sagen nichts, wenn die Kampagne nach
   * Gewicht oder Slots zählt — dann steht die Option nicht da. Gelesen wird
   * der Wert über dieselbe Funktion wie sonst (`feldwert`).
   */
  when?: { field: string; is: readonly string[] };
}

/**
 * **Der Katalog.** Eine neue Option eines Teilsystems kommt hier dazu —
 * und mit T-132 wandert dieser Katalog in die Felder der Modulsorten.
 * Die Feldwerte sind die Aufzählungen am Register (`CampaignInfo`); die
 * Prüfung `ruleOptions.test.ts` hält beide zusammen.
 */
export const RULE_OPTIONS: readonly RuleOptionDef[] = [
  {
    key: 'abilityMethods',
    sort: 'abilities',
    label: 'Ability score methods',
    does: 'The methods the character builder offers. Without a choice, the standard array and point buy apply.',
    source: { edge: 'allowsMethod' },
    rules: ['Customizing Ability Scores', 'Ability Scores'],
  },
  {
    key: 'equipmentMethods',
    sort: 'equipment',
    label: 'Starting equipment methods',
    does: 'The ways a new character may equip. Without a choice, class and background packages or starting gold apply.',
    source: { edge: 'allowsEquipment' },
    rules: ['Starting Equipment', 'Starting Wealth'],
  },
  {
    key: 'feats',
    sort: 'character',
    label: 'Feats',
    does: 'Whether a feat may be taken in place of an ability score improvement.',
    source: { field: 'feats' },
    rules: ['Feats'],
    variants: [
      { key: 'true', label: 'Allowed', does: 'Where a class grants an ability score improvement, a feat may be taken instead.', rules: ['Feats'] },
      { key: 'false', label: 'Not allowed', does: 'Ability score improvements stay improvements; the builder does not offer feats.' },
    ],
  },
  {
    /* Trefferpunkte ab Stufe 2 (T-194): die Kampagne sagt, was der Assistent anbietet. */
    key: 'hitPoints',
    glossary: 'Hit points',
    sort: 'character',
    label: 'Hit points per level',
    does: 'How a level beyond the first adds hit points in the character builder.',
    source: { field: 'hitPoints' },
    rules: ['Hit Points'],
    variants: [
      { key: 'either', label: 'Roll or average', does: 'Each player chooses per level: roll the hit die or take its average.', rules: ['Hit Points'] },
      { key: 'average', label: 'Average', does: 'Every level adds the average of the hit die; nobody rolls.', rules: ['Hit Points'] },
      { key: 'roll', label: 'Roll', does: 'Every level rolls the hit die.', rules: ['Hit Points'] },
    ],
  },
  {
    key: 'languages',
    sort: 'character',
    label: 'Languages in play',
    does: 'Which languages the builder offers when a character picks one. Empty means every language.',
    source: { field: 'languages' },
  },
  {
    key: 'inventory',
    sort: 'inventory',
    label: 'Inventory rules',
    does: 'How carrying capacity is counted.',
    source: { field: 'inventory' },
    rules: ['Carrying Capacity', 'Encumbrance'],
    variants: [
      {
        key: 'grid',
        label: "Grid (Basil's sheet)",
        does: 'Items take squares on a carrying grid sized by the creature; the column an item lies in decides how long it takes to draw.',
        rules: ['Grid Inventory'],
      },
      {
        key: 'weight',
        label: 'Weight',
        does: 'Items count by weight against Strength; above the thresholds a character is encumbered and slows down.',
        rules: ['Variant: Encumbrance', 'Encumbrance'],
      },
      { key: 'slots', label: 'Slots', does: 'Every item fills one or more slots; capacity counts slots, not pounds.' },
    ],
  },
  {
    key: 'stowing',
    sort: 'inventory',
    label: 'Unstowed items',
    does: 'How long a newly received item may lie unstowed in front of a character.',
    source: { field: 'stowing' },
    rules: ['Carrying Capacity'],
    variants: [
      { key: 'anytime', label: 'Any time', does: 'Loot and purchases wait until someone stows them.' },
      { key: 'bySessionEnd', label: 'By the end of the session', does: 'Whatever is still unstowed when the session ends is left behind.' },
      { key: 'immediately', label: 'Immediately', does: 'Whatever is unstowed when the scene, fight or map changes is left behind.' },
    ],
  },
  {
    key: 'carrying',
    glossary: 'Carrying capacity',
    sort: 'inventory',
    label: "Basil's sheet: grid, zones and body slots",
    does: 'The carry blocks — grids with zones for a size, a strength or any other statblock field, joined into one grid —, the draw time per body slot, what dropping and stowing cost, and the container templates.',
    source: { settings: ['carrySheet', 'carrySquares', 'carryZones', 'slotDraw', 'handActions', 'inventoryCols', 'inventoryRows', 'container:*'] },
    rules: ['Grid Inventory'],
    when: { field: 'inventory', is: ['grid'] },
  },
  {
    key: 'itemPricing',
    sort: 'items',
    label: 'Item prices',
    does: 'How the price of a piece with enhancements is worked out.',
    source: { field: 'itemPricing' },
    rules: ['Magic Item Rarity', 'Buying a Magic Item'],
    variants: [
      { key: 'combined', label: 'Combined', does: 'Base price, times any price factor, plus every surcharge: a dagger with +1 and silvered costs the dagger, the +1 and the silvering.' },
      { key: 'base', label: 'Base price', does: 'A piece costs what its base item costs; enhancements add nothing.' },
      { key: 'none', label: 'Not calculated', does: 'No price is worked out for a piece with enhancements; the GM sets one by hand.' },
    ],
  },
  {
    key: 'enhancementsBy',
    sort: 'items',
    label: 'Enhancements added by',
    does: 'Who may put an enhancement on a piece.',
    source: { field: 'enhancementsBy' },
    variants: [
      { key: 'gm', label: 'The GM', does: 'Only the GM adds or removes enhancements, in the inventory or on the piece.' },
      { key: 'players', label: 'Players too', does: 'Players may enhance their own pieces as well — prepared for crafting, which does not offer it yet.' },
    ],
  },
  {
    key: 'craftFailure',
    sort: 'crafting',
    label: 'On a failed check',
    does: 'What a failed crafting check costs.',
    source: { field: 'craftFailure' },
    rules: ['Downtime Activity: Crafting an Item', 'Downtime Activity: Crafting'],
    variants: [
      { key: 'noProgress', label: 'No progress', does: 'The check simply does not count.' },
      { key: 'progressLost', label: 'Progress lost', does: 'All progress so far is lost.' },
      { key: 'materialsLost', label: 'Materials lost', does: 'The work fails and the materials are lost.' },
      { key: 'halfLost', label: 'Half the materials lost', does: 'The work fails and half the materials are lost.' },
      { key: 'nothingLost', label: 'Nothing lost', does: 'The work fails, the materials come back.' },
      { key: 'custom', label: 'GM decides', does: 'The work stops and the GM decides what happens.' },
    ],
  },
  {
    key: 'craftCritSuccess',
    sort: 'crafting',
    label: 'On a natural 20',
    does: 'What a natural 20 on a crafting check does.',
    source: { field: 'craftCritSuccess' },
    rules: ['Downtime Activity: Crafting an Item', 'Downtime Activity: Crafting'],
    variants: [
      { key: 'asSuccess', label: 'A success', does: 'A natural 20 counts like any success.' },
      { key: 'double', label: 'Double progress', does: 'A natural 20 makes twice the progress.' },
    ],
  },
  {
    key: 'craftCritFailure',
    sort: 'crafting',
    label: 'On a natural 1',
    does: 'What a natural 1 on a crafting check does.',
    source: { field: 'craftCritFailure' },
    rules: ['Downtime Activity: Crafting an Item', 'Downtime Activity: Crafting'],
    variants: [
      { key: 'asFailure', label: 'A failure', does: 'A natural 1 counts like any failure.' },
      { key: 'progressLost', label: 'Progress lost', does: 'A natural 1 loses all progress so far.' },
      { key: 'materialsLost', label: 'Materials lost', does: 'A natural 1 loses the materials.' },
    ],
  },
  {
    key: 'craftConfirm',
    sort: 'crafting',
    label: 'Player checks count',
    does: 'Whether a crafting check rolled by a player counts at once or after the GM confirms it.',
    source: { field: 'craftConfirm' },
    rules: ['Downtime Activity: Crafting an Item', 'Downtime Activity: Crafting'],
    variants: [
      { key: 'gm', label: 'After the GM confirms', does: 'A player’s check waits for the GM.' },
      { key: 'player', label: 'At once', does: 'A player’s check counts as soon as it is rolled.' },
    ],
  },
  {
    /* Wie Blaupausen gelernt werden (T-280, REQ-349). */
    key: 'craftLearning',
    sort: 'crafting',
    label: 'Known blueprints',
    does: 'Which blueprints a character knows — and so may start on the workbench.',
    source: { field: 'craftLearning' },
    rules: ['Downtime Activity: Crafting an Item', 'Downtime Activity: Crafting'],
    variants: [
      { key: 'all', label: 'All', does: 'Every blueprint is known from the start (Kibbles).' },
      { key: 'taught', label: 'Only taught', does: 'Only what was taught: an information on the recipe the character knows.' },
      {
        key: 'rarity',
        label: 'By rarity',
        does: 'Every blueprint up to a rarity (Blueprints up to) for a tool the character is proficient in, and whatever was taught.',
      },
    ],
  },
  {
    key: 'craftLearnRarity',
    sort: 'crafting',
    label: 'Blueprints up to',
    does: 'With “By rarity”: the highest rarity a character knows without being taught. Common to start; raise it as the campaign goes on.',
    source: { field: 'craftLearnRarity' },
    variants: [
      { key: 'none', label: 'Mundane', does: 'Only blueprints for items without a rarity.' },
      { key: 'common', label: 'Common', does: 'Mundane and common blueprints.' },
      { key: 'uncommon', label: 'Uncommon', does: 'Up to uncommon.' },
      { key: 'rare', label: 'Rare', does: 'Up to rare.' },
      { key: 'very rare', label: 'Very rare', does: 'Up to very rare.' },
      { key: 'legendary', label: 'Legendary', does: 'Up to legendary.' },
    ],
    when: { field: 'craftLearning', is: ['rarity'] },
  },
  {
    /* Ersatzmaterialien (T-197): Regelartikel `Substitution`, die die Kampagne nennt. */
    key: 'substitutions',
    sort: 'crafting',
    label: 'Material substitutions',
    does: 'Which materials may stand in for the ones a recipe names, chosen when crafting starts. Without a rule, only what the recipe names counts.',
    source: { edge: 'allowsSubstitution' },
  },
  {
    key: 'travel',
    sort: 'travel',
    label: 'Rations, light and watches',
    does: 'After how many travel steps a ration and a light source are used up, and how many watches make a day. Zero turns the count off.',
    source: { settings: ['travelRationEvery', 'travelLightEvery', 'travelWatchesPerDay'] },
  },
  {
    key: 'units',
    sort: 'units',
    label: 'Units shown',
    does: 'Whether distances and weights are shown imperial, metric or both. Stored values stay as written; they are converted when read.',
    source: { settings: ['units'] },
  },
  {
    /* Die Karte am Tisch (T-204), gelesen über `mapRulesOf`. */
    key: 'fog',
    sort: 'map',
    label: 'Fog of war',
    does: 'Who shares what is revealed on a fogged map. The GM always sees everything.',
    source: { field: 'fog' },
    variants: [
      { key: 'party', label: 'Shared by the party', does: 'Whatever is revealed, every player sees.' },
      {
        key: 'player',
        label: 'Per character',
        rules: ['Fog of War per Character'],
        does: 'Each character sees what it revealed itself, what its party revealed, and what the GM revealed for everyone. The GM sees all of it, or picks a character.',
      },
    ],
  },
  {
    key: 'moves',
    sort: 'map',
    label: 'Player moves',
    does: 'How players move their own tokens outside an encounter. In an encounter, the turn plan applies.',
    source: { field: 'moves' },
    variants: [
      { key: 'free', label: 'Free', does: 'A player drags their own token, and it moves.' },
      { key: 'confirm', label: 'GM confirms', does: 'A dragged token leaves a dashed proposal; it moves once the GM confirms it.' },
    ],
  },
  {
    /* Wer zieht (T-290, E-040), gelesen über `mapRulesOf` und `mayMoveToken`. */
    key: 'tokenMove',
    sort: 'map',
    label: 'Who moves tokens',
    does: 'Which tokens players may drag on a map. The GM always moves every token; whether a move waits for the GM is “Player moves”. In an encounter, the same tokens move through the turn plan.',
    source: { field: 'tokenMove' },
    variants: [
      { key: 'none', label: 'Only the GM', does: 'Players move no token, not even their own.' },
      { key: 'own', label: 'Own characters', does: 'A player moves the characters they play.' },
      { key: 'party', label: 'The party', does: 'A player moves every member of the party, and the party token.' },
      { key: 'allies', label: 'Party and allies', does: 'As the party, plus whoever an encounter lists on the party’s side (Ally).' },
      { key: 'all', label: 'Every token', does: 'A player moves every token they can see on the map.' },
    ],
  },
  {
    /* Werkzeuge je Kartentyp (T-320), gelesen über `mapToolsOf`; eine Tabelle statt Varianten. */
    key: 'mapTools',
    sort: 'map',
    label: 'Map tools',
    does: 'Which tools a map offers, by map kind: walls, fog and light belong on battle maps, linking sub-maps on world and region maps. A kind left unchanged keeps the default.',
    source: { field: 'mapTools' },
  },
  {
    /* Markeransicht je Kartentyp (T-214), gelesen über `kindMarkerViewOf`; eine Tabelle statt Varianten. */
    key: 'markerViews',
    sort: 'map',
    label: 'Marker view by map kind',
    does: 'How markers stand on maps of each kind: as a symbol, a symbol with its name, an image or a quick card. A kind left on “by type” follows the article type; a map or a single marker can say otherwise.',
    source: { field: 'markerViews' },
  },
  {
    /* Kartenverknüpfungen (T-327), gelesen über `mapLinkDefaultsOf`; je Verknüpfung überschreibbar. */
    key: 'mapLinkShow',
    sort: 'map',
    label: 'Sub-map links: shown to the GM',
    does: 'How a linked sub-map appears on the map above for the GM. A link can say otherwise (Sub-maps › Link settings).',
    source: { field: 'mapLinkShow' },
    variants: [
      { key: 'jump', label: 'Click to jump', does: 'A frame with the name; a click opens the sub-map.' },
      { key: 'frame', label: 'Frame only', does: 'Only the outline; zoom in to enter.' },
      { key: 'icon', label: 'Icon', does: 'A small symbol in the middle; a click opens the sub-map.' },
      { key: 'hidden', label: 'Hidden', does: 'Nothing to see; zooming in still enters the sub-map.' },
    ],
  },
  {
    key: 'mapLinkShowPlayers',
    sort: 'map',
    label: 'Sub-map links: shown to players',
    does: 'How a linked sub-map appears on the map above for players, where they may change maps at all. A link can say otherwise.',
    source: { field: 'mapLinkShowPlayers' },
    variants: [
      { key: 'jump', label: 'Click to jump', does: 'A frame with the name; a click opens the sub-map.' },
      { key: 'frame', label: 'Frame only', does: 'Only the outline; zoom in to enter.' },
      { key: 'icon', label: 'Icon', does: 'A small symbol in the middle; a click opens the sub-map.' },
      { key: 'hidden', label: 'Hidden', does: 'Nothing to see; zooming in still enters the sub-map.' },
    ],
  },
  {
    key: 'mapLinkOuter',
    sort: 'map',
    label: 'Sub-map links: map above as border',
    does: 'Whether a sub-map shows the map above, faded, around its own image, placed by the link’s frame. Fog and release of the map above apply there too.',
    source: { field: 'mapLinkOuter' },
    variants: [
      { key: 'none', label: 'No', does: 'Around the sub-map is empty, as before.' },
      { key: 'faded', label: 'Faded', does: 'The map above shows around it, pale; zoom out or use the arrow to go up.' },
    ],
  },
  {
    key: 'revealOnMove',
    sort: 'map',
    label: 'Moves reveal the way',
    does: 'Whether a move on a fogged map uncovers the way the token went, two squares wide. A map may say otherwise.',
    source: { field: 'revealOnMove' },
    variants: [
      { key: 'true', label: 'Yes', does: 'Moving uncovers the way at once — for the character that moved, if fog is per character.' },
      { key: 'false', label: 'No', does: 'Moving uncovers nothing; the GM reveals afterwards. Movement is spent either way.' },
    ],
  },
  {
    /* Türen auf der Karte (T-118), gelesen über `mapRulesOf`. */
    key: 'doors',
    sort: 'map',
    label: 'Doors',
    does: 'Who opens and closes doors on the map. Locked doors stay shut for players either way; the GM opens everything.',
    source: { field: 'doors' },
    variants: [
      { key: 'players', label: 'Players', does: 'A player taps a door next to their own token to open or close it.' },
      { key: 'gm', label: 'GM only', does: 'Only the GM opens and closes doors.' },
    ],
  },
  {
    /* Platz eines Tokens (T-317), gelesen über `mapRulesOf` und `tokenSpan`. */
    key: 'tokenSizes',
    sort: 'map',
    label: 'Token sizes',
    does: 'How many squares a token covers by the size on its statblock. A token can set its own size (Tokens › Size), half squares included.',
    source: { field: 'tokenSizes' },
    variants: [
      { key: 'rules', label: 'As the rules', does: 'Tiny, small and medium one square, large 2×2, huge 3×3, gargantuan 4×4.' },
      { key: 'tinyHalf', label: 'Tiny half a square', does: 'As the rules, but a tiny creature covers half a square, so four fit in one.' },
    ],
  },
  {
    /* Übergänge (T-326), gelesen über `passageRulesOf`; je Übergang überschreibbar. */
    key: 'passageTrigger',
    sort: 'map',
    label: 'Passages: who sends tokens through',
    does: 'Who moves tokens through stairs, ladders and portals. A passage can say otherwise in its own settings.',
    source: { field: 'passageTrigger' },
    variants: [
      { key: 'both', label: 'GM and players', does: 'The GM sends every token in the passage through; a player sends their own token standing in it.' },
      { key: 'gm', label: 'GM only', does: 'Only the GM sends tokens through.' },
      { key: 'players', label: 'Players only', does: 'Players take the passage with their own tokens; the GM moves tokens by hand.' },
    ],
  },
  {
    key: 'passageWhen',
    sort: 'map',
    label: 'Passages: when in an encounter',
    does: 'During an encounter, when a player may take a passage. Outside an encounter there are no turns, so any time.',
    source: { field: 'passageWhen' },
    variants: [
      { key: 'any', label: 'Any time', does: 'Whenever the player’s token stands in the passage.' },
      { key: 'turn', label: 'Own turn', does: 'Only while the character is the one whose turn it is in the tracker.' },
      { key: 'roundEnd', label: 'End of round', does: 'Only during the last turn of the round.' },
    ],
  },
  {
    key: 'passageMove',
    sort: 'map',
    label: 'Passages: movement it costs',
    does: 'During an encounter, the movement a passage takes from the turn. It counts against the speed in the turn planner.',
    source: { field: 'passageMove' },
    variants: [
      { key: 'none', label: 'None', does: 'Going through costs no movement.' },
      { key: 'square', label: 'One square', does: 'Going through costs one square of movement.' },
      { key: 'half', label: 'Half speed', does: 'Going through costs half the character’s speed.' },
      { key: 'all', label: 'All movement', does: 'Going through costs the whole speed of the turn.' },
    ],
  },
  {
    key: 'passageAction',
    sort: 'map',
    label: 'Passages: action it costs',
    does: 'During an encounter, whether a passage takes an action or a bonus action.',
    source: { field: 'passageAction' },
    variants: [
      { key: 'none', label: 'None', does: 'Going through takes no action.' },
      { key: 'action', label: 'Action', does: 'Going through takes the action of the turn.', glossary: 'Action' },
      { key: 'bonus', label: 'Bonus action', does: 'Going through takes the bonus action of the turn.', glossary: 'Bonus action' },
    ],
  },
  {
    key: 'passageConfirm',
    sort: 'map',
    label: 'Passages: GM confirms',
    does: 'Whether a player going through waits for the GM.',
    source: { field: 'passageConfirm' },
    variants: [
      { key: 'moves', label: 'Like moves', does: 'As Player moves says: free moves go through at once, confirmed moves wait.' },
      { key: 'always', label: 'Always', does: 'Every passage a player takes waits for the GM to confirm it.' },
      { key: 'never', label: 'Never', does: 'A player goes through at once.' },
    ],
  },
  {
    /* Der Initiative-Tracker (T-022) als eigenes Regelsystem (T-334, E-100):
       `on` ist das System „D&D 5e (standard)", gelesen über `initiativeRulesOf`. */
    key: 'combat',
    glossary: 'Initiative',
    sort: 'combat',
    label: 'Initiative',
    does: 'Which initiative system runs encounters in the tracker in Play: order, turns, rounds and effects with a duration. The settings below belong to it.',
    source: { field: 'combat' },
    rules: ['Initiative', 'Combat'],
    variants: [
      { key: 'on', label: 'D&D 5e (standard)', does: 'Highest initiative first, one turn each per round; effects count down at the start or end of a turn. No delaying — the basic rules have none.', rules: ['Initiative'] },
      { key: 'off', label: 'Off', does: 'No tracker. Encounters still start and roll initiative; the table keeps the order itself.' },
    ],
  },
  {
    /* Der Zugplan (T-198, T-325), gelesen über `turnPlannerOf`. */
    key: 'turnPlanner',
    sort: 'combat',
    label: 'Turn planner',
    does: 'What a player plans in “Plan turn” on the map during an encounter: nothing, only movement, movement and actions, or everything with reactions. Players plan only for the characters they play; the GM confirms every turn.',
    source: { field: 'turnPlanner' },
    variants: [
      { key: 'off', label: 'Off', does: 'No “Plan turn” on the map; the GM moves tokens in an encounter.' },
      { key: 'move', label: 'Movement only', does: 'A player plans where their character moves; actions are said at the table.' },
      { key: 'actions', label: 'Movement and actions', does: 'Movement, actions and bonus actions with targets and hit chances. Nobody is asked to react.' },
      { key: 'full', label: 'Full', does: 'As movement and actions, plus reactions: leaving a foe’s reach asks for an opportunity attack, and the campaign’s rules may offer theirs.', glossary: 'Opportunity attack' },
    ],
  },
  {
    key: 'initNames',
    sort: 'combat',
    label: 'Unidentified foes shown as',
    does: 'What players read for a foe they have not identified. Identified foes show their name either way.',
    source: { field: 'initNames' },
    variants: [
      { key: 'cover', label: 'Cover name', does: 'The cover name of the creature (“Robed figure”), numbered when several share it.' },
      { key: 'real', label: 'Name at the table', does: 'The name the GM gave the combatant, or the creature’s name.' },
    ],
    when: { field: 'combat', is: ['on'] },
  },
  {
    key: 'initHealth',
    sort: 'combat',
    label: 'Foes’ health shown to players',
    does: 'How precisely players see the hit points of anyone outside the party. The party always sees its own numbers.',
    source: { field: 'initHealth' },
    variants: [
      { key: 'none', label: 'Nothing', does: 'Players see no health of foes.' },
      { key: 'coarse', label: 'Coarse', does: 'A word: unhurt, bloodied (below the maximum) or down.' },
      { key: 'exact', label: 'Exact', does: 'Hit points and maximum as numbers.' },
    ],
    when: { field: 'combat', is: ['on'] },
  },
  {
    key: 'initEffects',
    sort: 'combat',
    label: 'Effects shown to players',
    does: 'Which conditions and notes with a duration players see in the tracker. Effects the GM marks hidden never show.',
    source: { field: 'initEffects' },
    variants: [
      { key: 'all', label: 'All', does: 'The effects of every combatant players see.' },
      { key: 'party', label: 'Party and allies', does: 'Only the effects on the party and its allies.' },
      { key: 'none', label: 'None', does: 'No effects in the players’ view of the tracker.' },
    ],
    when: { field: 'combat', is: ['on'] },
  },
  {
    key: 'initActions',
    sort: 'combat',
    label: 'Foes’ actions shown to players',
    does: 'Whether players see the names of the actions and traits on a foe’s statblock, once its turn has come. Needs the Actions column.',
    source: { field: 'initActions' },
    variants: [
      { key: 'hidden', label: 'Only the GM', does: 'The GM sees every combatant’s actions; players only their own.' },
      { key: 'shown', label: 'Players too', does: 'Players see the action names of every foe that has shown up in the order.' },
    ],
    when: { field: 'combat', is: ['on'] },
  },
  {
    key: 'initColumns',
    sort: 'combat',
    label: 'Tracker columns',
    does: 'Which columns the tracker shows: initiative, armour class, hit points, effects, actions. Changed under “Change options”.',
    source: { field: 'initColumns' },
    when: { field: 'combat', is: ['on'] },
  },
  {
    key: 'initQuickActions',
    sort: 'combat',
    label: 'Tracker quick actions',
    does: 'Which buttons the GM has on each row: damage, heal, add effect, reroll, remove. Changed under “Change options”.',
    source: { field: 'initQuickActions' },
    when: { field: 'combat', is: ['on'] },
  },
  {
    key: 'playerRolls',
    sort: 'table',
    label: 'Player rolls visible to',
    does: 'Who sees the rolls of players.',
    source: { field: 'playerRolls' },
    variants: [
      { key: 'table', label: 'The table', does: 'Everyone at the table sees a player’s roll.' },
      { key: 'gm', label: 'Only the GM', does: 'Every player roll is hidden, like a hidden roll of the GM.' },
    ],
  },
  {
    /* Regeln am Tisch (REQ-357): die Graphen der Regelartikel im Zugplan,
       gelesen über `ruleGraphsOn`. An heisst auch: die Gelegenheitsattacke
       kommt aus ihrer Regel und nicht aus dem Code. */
    key: 'ruleGraphs',
    sort: 'table',
    label: 'Rules from graphs',
    does: 'Whether the rule graphs of the rules in play react to the turn plan: they offer reactions like Shield or an opportunity attack, and note what else follows. Edited in the rule builder.',
    source: { field: 'ruleGraphs' },
    variants: [
      { key: 'off', label: 'Off', does: 'Graphs run only in the rule builder. Opportunity attacks come from the built-in rule.' },
      { key: 'on', label: 'At the table', does: 'Graphs run in the turn plan and lead: an opportunity attack comes from its rule article, not from the built-in rule.' },
    ],
  },
  {
    key: 'compareFor',
    sort: 'table',
    label: 'Compare layers visible to',
    does: 'Who sees the versions of an article from compare layers that are not in play.',
    source: { field: 'compareFor' },
    variants: [
      { key: 'gm', label: 'Only the GM', does: 'Players see only the version that applies at this table.' },
      { key: 'players', label: 'Players too', does: 'Players may look at other versions next to the one that applies.' },
    ],
  },
  /* Wo Spielende nach der Anmeldung landen (T-342): auf dem Kampagnenboard
     oder wie die Leitung im Kompendium. Die Leitung behält ihren Start. */
  {
    key: 'playerStart',
    sort: 'table',
    label: 'Players start on',
    does: 'Where players of this campaign land after signing in. The GM keeps their own start.',
    source: { field: 'playerStart' },
    variants: [
      { key: 'board', label: 'Campaign board', does: 'Players land on the campaign board, with a bar back to it, their character, maps, search and knowledge.' },
      { key: 'compendium', label: 'Compendium', does: 'Players land on the compendium, like everyone else.' },
    ],
  },
];

/** Felder, deren Varianten `true`/`false` heissen, aber als Wahrheitswert stehen. */
const WAHRHEITSFELDER = new Set(['feats', 'revealOnMove']);

/**
 * **Eine Variante direkt wählen** (Rules & options): gibt die Kampagne mit
 * dem neuen Wert zurück — geschrieben wird sie wie jede andere über
 * `PUT /api/entities/:id`, also durch `validateEntity` und das Schreibrecht
 * am Server. `null`, wo die Option kein Feld mit Varianten ist (Kanten,
 * Einstellungen der Installation) oder die Variante nicht dazugehört.
 */
export function withRuleVariant(campaign: Entity, optionKey: string, variantKey: string): Entity | null {
  const o = RULE_OPTIONS.find((x) => x.key === optionKey);
  if (!o || !('field' in o.source) || !o.variants?.some((v) => v.key === variantKey)) return null;
  const feld = o.source.field;
  const wert: unknown = WAHRHEITSFELDER.has(feld) ? variantKey === 'true' : variantKey;
  return {
    ...campaign,
    components: { ...campaign.components, Campaign: { ...(campaign.components?.['Campaign'] ?? {}), [feld]: wert } },
  };
}

/* ------------------------------------------------------------ Regelartikel */

export type RuleArticleKind = 'system' | 'rule' | 'option';

/** Was ein Regelartikel ist (`Rule.kind`), wenn er für die Laufzeit steht. */
export function ruleArticleKind(e: Entity): RuleArticleKind | undefined {
  const k = e.components?.['Rule']?.['kind'];
  return k === 'system' || k === 'rule' || k === 'option' ? k : undefined;
}

/** Der Schlüssel, unter dem die Laufzeit einen Regelartikel kennt (`Rule.key`). */
export function ruleArticleKey(e: Entity): string | undefined {
  const k = e.components?.['Rule']?.['key'];
  return typeof k === 'string' && k.trim() ? k.trim() : undefined;
}

/** Die Regelartikel nach Schlüssel: Optionen als `regel:option`, weil `gm` an mehreren Regeln eine Option ist. */
export interface RuleArticleIndex {
  systems: Map<string, Entity>;
  rules: Map<string, Entity>;
  options: Map<string, Entity>;
}

const elternVon = (e: Entity): string[] => (e.relations ?? []).filter((r) => r.type === 'partOf').map((r) => r.to);

/**
 * **Die Regelartikel geordnet** (T-270): ein Artikel steht für ein System,
 * eine Regel oder eine Option, `key` sagt welche, `partOf` hängt die Option
 * an ihre Regel. Gibt es zu einem Schlüssel zwei (zwei Ebenen), gilt der
 * erste in Nummernfolge — stabil statt nach Ladereihenfolge.
 */
export function indexRuleArticles(articles: Iterable<Entity>): RuleArticleIndex {
  const alle = [...articles].filter((e) => ruleArticleKind(e) && ruleArticleKey(e)).sort((a, z) => a.id.localeCompare(z.id));
  const idx: RuleArticleIndex = { systems: new Map(), rules: new Map(), options: new Map() };
  const regelNachId = new Map<string, string>();
  for (const e of alle) {
    const key = ruleArticleKey(e)!;
    if (ruleArticleKind(e) === 'system' && !idx.systems.has(key)) idx.systems.set(key, e);
    if (ruleArticleKind(e) === 'rule') {
      if (!idx.rules.has(key)) idx.rules.set(key, e);
      regelNachId.set(e.id, key);
    }
  }
  for (const e of alle) {
    if (ruleArticleKind(e) !== 'option') continue;
    for (const eltern of elternVon(e)) {
      const regel = regelNachId.get(eltern);
      const k = regel ? `${regel}:${ruleArticleKey(e)}` : undefined;
      if (k && !idx.options.has(k)) idx.options.set(k, e);
    }
  }
  return idx;
}

/** Was die Laufzeit kennt und noch keinen Artikel hat — für die Einfuhr und den Hinweis. */
export interface MissingRuleArticle {
  kind: RuleArticleKind;
  key: string;
  /** Bei einer Regel das System, bei einer Option die Regel. */
  parent?: string;
  label: string;
  does: string;
  /** Buchartikel, auf denen sie beruht (Namen), wenn es welche gibt. */
  basedOn: string[];
}

export function missingRuleArticles(articles: Iterable<Entity>): MissingRuleArticle[] {
  const idx = indexRuleArticles(articles);
  const raus: MissingRuleArticle[] = [];
  for (const s of RULE_SORTS) {
    if (!idx.systems.has(s.key)) raus.push({ kind: 'system', key: s.key, label: s.label, does: s.does, basedOn: [] });
  }
  for (const o of RULE_OPTIONS) {
    if (!idx.rules.has(o.key)) raus.push({ kind: 'rule', key: o.key, parent: o.sort, label: o.label, does: o.does, basedOn: [...(o.rules ?? [])] });
    for (const v of o.variants ?? []) {
      if (!idx.options.has(`${o.key}:${v.key}`)) raus.push({ kind: 'option', key: v.key, parent: o.key, label: v.label, does: v.does, basedOn: [...(v.rules ?? [])] });
    }
  }
  return raus;
}

const refVon = (e: Entity): RuleRef => ({ id: e.id, name: entityName(e) });
const textVon = (e: Entity | undefined, sonst: string): string => {
  const d = e?.components?.['Description']?.['description'];
  return typeof d === 'string' && d.trim() ? d.trim() : sonst;
};

/** Ein gefundener Regelartikel. */
export interface RuleRef {
  id: EntityId;
  name: string;
}

export interface RuleVariantState {
  key: string;
  label: string;
  does: string;
  chosen: boolean;
  /** Der Artikel dieser Option (T-270). Fehlt er, steht die Option nur da, wenn sie gewählt ist. */
  rule?: RuleRef;
  /** Der Glossarbegriff, der sie erklärt (T-347). */
  glossary?: string;
}

/** Ein gewähltes Verfahren (Attribute, Ausrüstung): ein Artikel oder eine Vorgabe aus dem Code. */
export interface RuleMethodState {
  id: string;
  name: string;
  does: string;
  /** Eine Vorgabe aus dem Code, kein Artikel. */
  builtIn: boolean;
}

export interface RuleOptionState {
  key: string;
  label: string;
  does: string;
  /** `installation`: eine Einstellung, die für jede Kampagne gilt (bis T-132). */
  scope: 'campaign' | 'installation';
  /** Wo es geändert wird: `Campaign.<feld>`, eine Kante, oder Einstellungen. */
  field?: string;
  relation?: string;
  /** Der Wert in Worten (Feld ohne Varianten, Einstellungen). */
  value?: string[];
  variants?: RuleVariantState[];
  methods?: RuleMethodState[];
  /** Der Artikel dieser Regel (T-270). */
  rule?: RuleRef;
  /** Der Glossarbegriff, der sie erklärt (T-347). */
  glossary?: string;
}

export interface RuleSortState extends RuleSortDef {
  options: RuleOptionState[];
  /** Der Artikel des Systems (T-270). */
  rule?: RuleRef;
}

export interface RuleOptionsContext {
  byId: ReadonlyMap<EntityId, Entity>;
  settings: Readonly<Record<string, string>> | null | undefined;
  /** Die Regelartikel mit Schlüssel, die im Stapel stehen und der Betrachter sieht (T-270). */
  articles: readonly Entity[];
}

/** Was ein Attributsverfahren tut, in einem Satz. */
export function abilityMethodText(m: AbilityMethod): string {
  const wem = m.scope === 'party' ? ' once for the whole party' : '';
  if (m.method === 'array') return `Assign the fixed scores ${(m.scores ?? []).join(', ')}${wem}.`;
  if (m.method === 'pointBuy') return `Buy scores with ${m.budget ?? 0} points${wem}.`;
  return `Roll ${m.count}× ${m.dice ?? '4d6kh3'}${wem}.`;
}

/** Was ein Ausrüstungsverfahren tut, in einem Satz. */
export function equipmentMethodText(m: EquipmentMethod): string {
  if (m.method === 'rules') return 'Take the equipment class and background offer.';
  if (m.method === 'gold') return m.gold ? `Start with ${m.gold} gp and buy.` : 'Start with the gold of the class and buy.';
  return m.budget !== undefined ? `Pick freely for up to ${m.budget} gp.` : 'Pick freely.';
}

/** Der Wert eines Kampagnenfelds, wie das Teilsystem ihn liest. */
function feldwert(campaign: Entity | null | undefined, feld: string): unknown {
  switch (feld) {
    case 'inventory':
      return inventoryRulesOf(campaign);
    case 'stowing':
      return stowingRuleOf(campaign);
    case 'itemPricing':
      return itemPricingOf(campaign);
    case 'enhancementsBy':
      return enhancementsByOf(campaign);
    case 'craftFailure':
      return craftRulesOf(campaign).failure;
    case 'craftCritSuccess':
      return craftRulesOf(campaign).critSuccess;
    case 'craftCritFailure':
      return craftRulesOf(campaign).critFailure;
    case 'craftConfirm':
      return craftRulesOf(campaign).confirm;
    case 'craftLearning':
      return craftRulesOf(campaign).learning;
    case 'craftLearnRarity':
      return craftRulesOf(campaign).learnRarity;
    case 'hitPoints':
      return hitPointRuleOf(campaign ?? undefined);
    case 'fog':
      return mapRulesOf(campaign).fog;
    case 'moves':
      return mapRulesOf(campaign).moves;
    case 'tokenMove':
      return mapRulesOf(campaign).tokenMove;
    case 'revealOnMove':
      return mapRulesOf(campaign).revealOnMove;
    case 'doors':
      return mapRulesOf(campaign).doors;
    case 'passageTrigger':
      return passageRulesOf(campaign).trigger;
    case 'passageWhen':
      return passageRulesOf(campaign).when;
    case 'passageMove':
      return passageRulesOf(campaign).move;
    case 'passageAction':
      return passageRulesOf(campaign).action;
    case 'passageConfirm':
      return passageRulesOf(campaign).confirm;
    case 'mapLinkShow':
      return mapLinkDefaultsOf(campaign).show;
    case 'mapLinkShowPlayers':
      return mapLinkDefaultsOf(campaign).showPlayers;
    case 'mapLinkOuter':
      return mapLinkDefaultsOf(campaign).outer;
    case 'mapTools':
      return Object.entries(mapToolTable(campaign)).map(([k, g]) => `${k}: ${g.length ? g.join(', ') : 'none'}`);
    case 'markerViews':
      return MAP_KINDS.flatMap((k) => {
        const v = kindMarkerViewOf(campaign, k);
        return v ? [`${k}: ${v}`] : [];
      });
    case 'combat':
      return initiativeRulesOf(campaign).combat;
    case 'turnPlanner':
      return turnPlannerOf(campaign);
    case 'initNames':
      return initiativeRulesOf(campaign).names;
    case 'initHealth':
      return initiativeRulesOf(campaign).health;
    case 'initEffects':
      return initiativeRulesOf(campaign).effects;
    case 'initActions':
      return initiativeRulesOf(campaign).enemyActions;
    case 'initColumns':
      return initiativeRulesOf(campaign).columns;
    case 'initQuickActions':
      return initiativeRulesOf(campaign).quickActions;
    case 'playerStart':
      return playerStartOf(campaign);
    default: {
      const roh = campaign?.components?.['Campaign']?.[feld];
      /* Die übrigen Vorgaben stehen am Register (`CampaignInfo`): Talente ja, Würfe für den Tisch. */
      if (roh !== undefined && roh !== null && roh !== '') return roh;
      return feld === 'feats' ? true : feld === 'playerRolls' ? 'table' : feld === 'compareFor' ? 'gm' : feld === 'ruleGraphs' ? 'off' : undefined;
    }
  }
}

/** Die Einstellungen einer Option, ausgeschrieben (`container:*` nennt jede Vorlage). */
function einstellungen(keys: readonly string[], settings: Readonly<Record<string, string>>): string[] {
  const raus: string[] = [];
  for (const k of keys) {
    if (k.endsWith('*')) {
      const vor = k.slice(0, -1);
      for (const [s, v] of Object.entries(settings)) if (s.startsWith(vor)) raus.push(`${s.slice(vor.length)}: ${v}`);
    } else if (settings[k] !== undefined && settings[k] !== '') {
      raus.push(`${k}: ${settings[k]}`);
    }
  }
  return raus;
}

/**
 * **Die Regeloptionen einer Kampagne**, nach Sorte — **aus den
 * Regelartikeln** (T-270): ein System, eine Regel, eine Option steht da,
 * wenn ein Artikel für sie steht, mit dessen Namen und Text. Der Katalog im
 * Code sagt nur noch, was die Laufzeit ausführen kann und woher der Wert
 * kommt. Eine gewählte Option ohne Artikel steht trotzdem da — sonst sähe
 * niemand, was gilt.
 */
export function ruleOptionsOf(campaign: Entity | null | undefined, ctx: RuleOptionsContext): RuleSortState[] {
  const settings = ctx.settings ?? {};
  const idx = indexRuleArticles(ctx.articles);
  return RULE_SORTS.filter((sort) => idx.systems.has(sort.key)).map((sort) => {
    const sys = idx.systems.get(sort.key)!;
    return {
    key: sort.key,
    label: entityName(sys),
    does: textVon(sys, sort.does),
    rule: refVon(sys),
    /* Was unter der gewählten Variante nichts sagt, steht nicht da (T-248). */
    options: RULE_OPTIONS.filter((o) => o.sort === sort.key && idx.rules.has(o.key) && (!o.when || o.when.is.includes(String(feldwert(campaign, o.when.field))))).map((o): RuleOptionState => {
      const art = idx.rules.get(o.key)!;
      const raus: RuleOptionState = {
        key: o.key,
        label: entityName(art),
        does: textVon(art, o.does),
        scope: 'settings' in o.source ? 'installation' : 'campaign',
        rule: refVon(art),
        ...(o.glossary ? { glossary: o.glossary } : {}),
      };
      const src = o.source;
      if ('field' in src) {
        raus.field = `Campaign.${src.field}`;
        const wert = feldwert(campaign, src.field);
        if (o.variants) {
          raus.variants = o.variants.flatMap((v): RuleVariantState[] => {
            const a = idx.options.get(`${o.key}:${v.key}`);
            const chosen = String(wert) === v.key;
            if (!a && !chosen) return [];
            return [{ key: v.key, label: a ? entityName(a) : v.label, does: textVon(a, v.does), chosen, ...(a ? { rule: refVon(a) } : {}), ...(v.glossary ? { glossary: v.glossary } : {}) }];
          });
        } else {
          raus.value = Array.isArray(wert) ? wert.map(String) : wert === undefined ? [] : [String(wert)];
        }
      } else if ('edge' in src) {
        raus.relation = src.edge;
        if (src.edge === 'allowsSubstitution') {
          raus.methods = substitutionsOf(campaign, (id) => ctx.byId.get(id)).map((r) => ({
            id: r.id,
            name: r.name,
            builtIn: false,
            does: substitutionText(r),
          }));
          return raus;
        }
        const methoden: (AbilityMethod | EquipmentMethod)[] =
          src.edge === 'allowsMethod' ? allowedMethods(campaign ?? undefined, ctx.byId) : allowedEquipmentMethods(campaign ?? undefined, ctx.byId);
        raus.methods = methoden.map((m) => ({
          id: m.id,
          name: m.name,
          builtIn: !!m.builtIn,
          does: src.edge === 'allowsMethod' ? abilityMethodText(m as AbilityMethod) : equipmentMethodText(m as EquipmentMethod),
        }));
      } else {
        raus.value = einstellungen(src.settings, settings);
      }
      return raus;
    }),
    };
  });
}

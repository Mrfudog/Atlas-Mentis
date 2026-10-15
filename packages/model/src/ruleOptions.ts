/**
 * **Die Regeloptionen einer Kampagne, auffindbar** (T-190, Schritt 1 von
 * T-132/E-044 c): was heute an verschiedenen Stellen steht — Felder an der
 * Kampagne, Kanten auf Verfahren, Einstellungen der Installation —, nach
 * **Sorte** gruppiert, je Option ein Satz, was sie bewirkt, und je
 * Variante der Regelartikel, der sie erklärt.
 *
 * Die Sorten sind dieselben, die T-132 als Module baut (`inventory`,
 * `crafting`, `abilities`, `equipment`, `character`, `travel`, `units`,
 * `map` (T-204), dazu `table` für das, was keine Spielregel, aber Tischregel ist). Kommt
 * das Modul, ändert sich nur, **woher** `ruleOptionsOf` den Wert nimmt —
 * die Seite bleibt.
 *
 * Gelesen wird hier nichts Neues: jede Option geht über die Funktion, die
 * ihr Teilsystem ohnehin liest (`inventoryRulesOf`, `craftRulesOf`,
 * `allowedMethods` …), damit die Seite nie etwas anderes sagt, als gilt.
 *
 * **Regelartikel** werden nach Namen gesucht: die importierten heissen,
 * wie das Regelwerk sie nennt („Encumbrance"), und eine eigene Erklärung
 * hat den Namen, den `ownRuleName` vorschlägt. Was gefunden wird, entscheidet
 * der Server (im Stapel, sichtbar); hier stehen nur die Namen. Buchtext
 * steht hier keiner — nur eigene kurze Sätze (T-190).
 */

import { allowedMethods, type AbilityMethod } from './abilities.js';
import { craftRulesOf } from './crafting.js';
import { allowedEquipmentMethods, type EquipmentMethod } from './equipment.js';
import { hitPointRuleOf } from './hitpoints.js';
import { inventoryRulesOf } from './inventory.js';
import { mapRulesOf } from './map.js';
import { stowingRuleOf } from './stowing.js';
import { substitutionsOf, substitutionText } from './substitutes.js';
import type { Entity, EntityId } from './types.js';

export type RuleSortKey = 'inventory' | 'crafting' | 'abilities' | 'equipment' | 'character' | 'travel' | 'units' | 'map' | 'table';

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
  { key: 'crafting', label: 'Crafting', does: 'What a crafting check does when it succeeds, fails or rolls a natural 20 or 1.' },
  { key: 'travel', label: 'Travel', does: 'What travel costs in food, light and watches.' },
  { key: 'units', label: 'Units', does: 'In which measures distances and weights are shown.' },
  { key: 'map', label: 'On the map', does: 'What the fog of war hides from whom, and how tokens move outside an encounter.' },
  { key: 'table', label: 'At the table', does: 'Who sees what during play.' },
];

/** Eine Variante einer Option: ein Wert, mit dem, was er tut. */
export interface RuleVariantDef {
  key: string;
  label: string;
  does: string;
  /** Namen importierter Regelartikel, die diese Variante erklären — der erste, der da ist, gilt. */
  rules?: string[];
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
  /** Regelartikel zur Option als Ganzes. */
  rules?: string[];
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
    variants: [
      { key: 'true', label: 'Allowed', does: 'Where a class grants an ability score improvement, a feat may be taken instead.', rules: ['Feats'] },
      { key: 'false', label: 'Not allowed', does: 'Ability score improvements stay improvements; the builder does not offer feats.' },
    ],
  },
  {
    /* Trefferpunkte ab Stufe 2 (T-194): die Kampagne sagt, was der Assistent anbietet. */
    key: 'hitPoints',
    sort: 'character',
    label: 'Hit points per level',
    does: 'How a level beyond the first adds hit points in the character builder.',
    source: { field: 'hitPoints' },
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
    variants: [
      {
        key: 'grid',
        label: "Grid (Basil's sheet)",
        does: 'Items take squares on a carrying grid sized by the creature; the column an item lies in decides how long it takes to draw.',
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
    variants: [
      { key: 'anytime', label: 'Any time', does: 'Loot and purchases wait until someone stows them.' },
      { key: 'bySessionEnd', label: 'By the end of the session', does: 'Whatever is still unstowed when the session ends is left behind.' },
      { key: 'immediately', label: 'Immediately', does: 'Whatever is unstowed when the scene, fight or map changes is left behind.' },
    ],
  },
  {
    key: 'carrying',
    sort: 'inventory',
    label: "Basil's sheet: grid, zones and body slots",
    does: 'The grid size per creature size, the draw time per grid column and per body slot, what dropping and stowing cost, and the container templates.',
    source: { settings: ['carrySquares', 'carryZones', 'slotDraw', 'handActions', 'inventoryCols', 'inventoryRows', 'container:*'] },
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
    variants: [
      { key: 'gm', label: 'After the GM confirms', does: 'A player’s check waits for the GM.' },
      { key: 'player', label: 'At once', does: 'A player’s check counts as soon as it is rolled.' },
    ],
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
];

/**
 * **Der Name einer eigenen Erklärung**: so heisst ein Regelartikel, den
 * die Leitung für eine Variante schreibt, und so wird er wiedergefunden.
 */
export function ownRuleName(option: Pick<RuleOptionDef, 'label'>, variant?: Pick<RuleVariantDef, 'label'>): string {
  return variant ? `${option.label}: ${variant.label}` : option.label;
}

/** Alle Namen, nach denen gesucht wird — der Server sucht sie einmal. */
export function ruleOptionRuleNames(): string[] {
  const raus = new Set<string>();
  for (const o of RULE_OPTIONS) {
    for (const n of o.rules ?? []) raus.add(n);
    if (!o.variants) raus.add(ownRuleName(o));
    for (const v of o.variants ?? []) {
      for (const n of v.rules ?? []) raus.add(n);
      raus.add(ownRuleName(o, v));
    }
  }
  return [...raus];
}

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
  /** Der erklärende Regelartikel, wenn es einen gibt. */
  rule?: RuleRef;
  /** Unter diesem Namen schriebe die Leitung eine eigene Erklärung. */
  ownName: string;
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
  /** Regelartikel zur Option als Ganzes. */
  rule?: RuleRef;
  ownName: string;
}

export interface RuleSortState extends RuleSortDef {
  options: RuleOptionState[];
}

export interface RuleOptionsContext {
  byId: ReadonlyMap<EntityId, Entity>;
  settings: Readonly<Record<string, string>> | null | undefined;
  /** Der erste Regelartikel dieser Namen, der im Stapel und sichtbar ist. */
  ruleNamed: (names: readonly string[]) => RuleRef | undefined;
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
    case 'craftFailure':
      return craftRulesOf(campaign).failure;
    case 'craftCritSuccess':
      return craftRulesOf(campaign).critSuccess;
    case 'craftCritFailure':
      return craftRulesOf(campaign).critFailure;
    case 'craftConfirm':
      return craftRulesOf(campaign).confirm;
    case 'hitPoints':
      return hitPointRuleOf(campaign ?? undefined);
    case 'fog':
      return mapRulesOf(campaign).fog;
    case 'moves':
      return mapRulesOf(campaign).moves;
    case 'revealOnMove':
      return mapRulesOf(campaign).revealOnMove;
    default: {
      const roh = campaign?.components?.['Campaign']?.[feld];
      /* Die übrigen Vorgaben stehen am Register (`CampaignInfo`): Talente ja, Würfe für den Tisch. */
      if (roh !== undefined && roh !== null && roh !== '') return roh;
      return feld === 'feats' ? true : feld === 'playerRolls' ? 'table' : feld === 'compareFor' ? 'gm' : undefined;
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
 * **Die Regeloptionen einer Kampagne**, nach Sorte. Ohne Kampagne stehen
 * die Vorgaben da — die Seite zeigt sie trotzdem, denn das ist, was gilt.
 */
export function ruleOptionsOf(campaign: Entity | null | undefined, ctx: RuleOptionsContext): RuleSortState[] {
  const settings = ctx.settings ?? {};
  return RULE_SORTS.map((sort) => ({
    ...sort,
    options: RULE_OPTIONS.filter((o) => o.sort === sort.key).map((o): RuleOptionState => {
      const raus: RuleOptionState = {
        key: o.key,
        label: o.label,
        does: o.does,
        scope: 'settings' in o.source ? 'installation' : 'campaign',
        ownName: ownRuleName(o),
      };
      const rule = ctx.ruleNamed([...(o.rules ?? []), ...(o.variants ? [] : [ownRuleName(o)])]);
      if (rule) raus.rule = rule;
      const src = o.source;
      if ('field' in src) {
        raus.field = `Campaign.${src.field}`;
        const wert = feldwert(campaign, src.field);
        if (o.variants) {
          raus.variants = o.variants.map((v) => {
            const r = ctx.ruleNamed([...(v.rules ?? []), ownRuleName(o, v)]);
            return {
              key: v.key,
              label: v.label,
              does: v.does,
              chosen: String(wert) === v.key,
              ownName: ownRuleName(o, v),
              ...(r ? { rule: r } : {}),
            };
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
  }));
}

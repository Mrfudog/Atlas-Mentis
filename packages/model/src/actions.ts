/**
 * **Die allgemeinen Aktionen, einmal** (T-275, Punkt 3). Es gab zwei
 * Kataloge — „Your turn" am Bogen (`RULE_ACTIONS`, zwölf) und den Zugplan
 * (`COMMON_ACTIONS`, fünf) — und zwei Kostenleser (`turnTypeOf`, `costOf`),
 * die bei „Legendary", „Use an object" und einer Minute Verschiedenes
 * sagten. Jetzt steht jede Aktion hier, mit ihrer Art, ihrem Satz und dem,
 * was sie **an Zahlen ändert**: Dodge gibt Angriffen gegen einen Nachteil,
 * Help dem Verbündeten Vorteil, Hide dem eigenen nächsten Angriff Vorteil.
 *
 * Was eine Aktion bewirkt, ist eine Wirkung (`Effect`, wie an Gegenstand
 * und Zustand) auf einem Eintrag der Initiative (`TimedEntry.action`) mit
 * der Dauer, die die Regel sagt — keine eigene Engine (E-102): eine spätere
 * Automation liest dieselben Einträge.
 */

import type { Effect } from './effects.js';

/** Die Aktionsarten in der Reihenfolge des Bogens. */
export const TURN_TYPES = ['action', 'bonus', 'reaction', 'free', 'trigger'] as const;
export type TurnType = (typeof TURN_TYPES)[number];

/**
 * **Die Aktionsart aus dem Namen ihres Artikels** (`ActionType`: „Action",
 * „Bonus Action", „Reaction", „Free Action"), der eine Kostenleser für
 * Bogen und Zugplan. „Legendary Action" zählt als Aktion (am Tisch kein
 * eigener Zug), „Object Interaction" als frei. Was nicht passt — eine
 * Minute, eine Stunde — steht nicht im Zug und gibt `null`.
 */
export function turnTypeOf(actionTypeName: string | null | undefined): TurnType | null {
  const n = String(actionTypeName ?? '').toLowerCase().trim();
  if (!n) return null;
  if (n.includes('bonus')) return 'bonus';
  if (n.includes('reaction')) return 'reaction';
  if (n.includes('free') || n.includes('object')) return 'free';
  if (n.includes('trigger') || n.includes('special')) return 'trigger';
  if (n.includes('legendary') || n === 'action' || n.endsWith(' action')) return 'action';
  return null;
}

/** Wo eine Aktion wirkt: an dem, der sie nimmt, oder an ihrem Ziel. */
export type ActionOn = 'self' | 'target';

/**
 * Was eine Aktion an Zahlen ändert: Wirkungen auf einem Eintrag der
 * Initiative, der so lange gilt, wie die Regel sagt. `rounds` und `at`
 * wie bei jedem Eintrag (D53): 1 und `start` heisst „bis zum Anfang deines
 * nächsten Zugs" — auch am Ziel, denn der Anker ist der Handelnde.
 * `spent` sagt, wann er vorher verbraucht ist (`attack`: beim nächsten
 * eigenen Angriffswurf).
 */
export interface ActionRule {
  on: ActionOn;
  /** Der Eintrag, wie er in der Initiative heisst („Dodging"). */
  label: string;
  effects: Effect[];
  rounds?: number;
  at?: 'start' | 'end';
  spent?: 'attack';
}

/** Eine allgemeine Aktion. */
export interface CommonAction {
  /** Unveränderlich: `dash` — der Bogen nennt sie `rule:dash`, der Zugplan `std:dash`. */
  key: string;
  name: string;
  type: TurnType;
  /** Was sie tut, ein Satz. */
  hint: string;
  /** Im Zugplan wählbar (dort sind nur Aktionen, die ein Zug plant). */
  planned?: boolean;
  /** Braucht ein Ziel (Help: wem). */
  targeted?: boolean;
  /** Was sie sperren kann, wie im Bogen. */
  needs?: 'hand' | 'offhand';
  /** Was sie an Zahlen ändert. */
  rule?: ActionRule;
  /** Eine Probe am Server (Hide: Geschicklichkeit (Heimlichkeit)). */
  check?: { ability: string; skill: string };
}

const VORTEIL = (target: 'attack' | 'attacked', value: 'advantage' | 'disadvantage', id: string): Effect => ({ id, target, op: 'grant', value });

/** **Die allgemeinen Aktionen** des Spielerhandbuchs (Kapitel 9), die jede Kreatur hat. */
export const COMMON_ACTION_CATALOGUE: readonly CommonAction[] = [
  { key: 'dash', name: 'Dash', type: 'action', planned: true, hint: 'Gain extra movement equal to your speed.' },
  { key: 'disengage', name: 'Disengage', type: 'action', planned: true, hint: 'Your movement does not provoke opportunity attacks.' },
  {
    key: 'dodge',
    name: 'Dodge',
    type: 'action',
    planned: true,
    hint: 'Attacks against you have disadvantage until your next turn.',
    rule: { on: 'self', label: 'Dodging', effects: [VORTEIL('attacked', 'disadvantage', 'dodge')], rounds: 1, at: 'start' },
  },
  {
    key: 'help',
    name: 'Help',
    type: 'action',
    planned: true,
    targeted: true,
    hint: 'An ally gains advantage on their next attack before your next turn.',
    rule: { on: 'target', label: 'Helped', effects: [VORTEIL('attack', 'advantage', 'help')], rounds: 1, at: 'start', spent: 'attack' },
  },
  {
    key: 'hide',
    name: 'Hide',
    type: 'action',
    planned: true,
    hint: 'Make a Dexterity (Stealth) check; while hidden, your next attack has advantage.',
    check: { ability: 'dex', skill: 'Stealth' },
    rule: { on: 'self', label: 'Hidden', effects: [VORTEIL('attack', 'advantage', 'hidden')], spent: 'attack' },
  },
  {
    key: 'ready',
    name: 'Ready',
    type: 'action',
    planned: true,
    hint: 'Prepare an action for a trigger; it uses your reaction when it comes.',
    rule: { on: 'self', label: 'Readied', effects: [], rounds: 1, at: 'start' },
  },
  { key: 'search', name: 'Search', type: 'action', planned: true, hint: 'Make a Wisdom (Perception) or Intelligence (Investigation) check.' },
  { key: 'use', name: 'Use an object', type: 'action', planned: true, needs: 'hand', hint: 'Use an object that takes an action.' },
  { key: 'offhand', name: 'Off-hand attack', type: 'bonus', needs: 'offhand', hint: 'Attack with a light weapon in the other hand.' },
  { key: 'opportunity', name: 'Opportunity attack', type: 'reaction', hint: 'Strike a creature that leaves your reach.' },
  { key: 'draw', name: 'Draw or stow a weapon', type: 'free', hint: 'One object interaction per turn' },
  { key: 'drop', name: 'Drop an item', type: 'free', hint: 'Let go of what you hold.' },
  { key: 'stand', name: 'Stand up', type: 'free', hint: 'Costs half your speed' },
];

/** Eine Aktion nach Schlüssel, auch mit Vorsilbe (`std:dodge`, `rule:dodge`). */
export function commonAction(key: string | null | undefined): CommonAction | undefined {
  const k = String(key ?? '').replace(/^(std|rule):/, '');
  return COMMON_ACTION_CATALOGUE.find((a) => a.key === k);
}

/** Die Wirkungen der Aktionen, auf die Einträge der Initiative zeigen (`TimedEntry.action`). */
export function actionEffects(keys: readonly string[]): { key: string; effects: Effect[] }[] {
  return keys.flatMap((k) => {
    const a = commonAction(k);
    return a?.rule?.effects.length ? [{ key: `std:${a.key}`, effects: a.rule.effects }] : [];
  });
}

/**
 * **Vorteil, Nachteil oder keins** (PHB „Advantage and Disadvantage"): je
 * mindestens eine Quelle heben sich auf, wie viele es auch sind.
 */
export function rollMode(advantage: boolean, disadvantage: boolean): 'adv' | 'dis' | undefined {
  if (advantage && !disadvantage) return 'adv';
  if (disadvantage && !advantage) return 'dis';
  return undefined;
}

/** Bis wohin ein Angriff „aus der Nähe" kommt (Prone, T-351): 5 ft. */
export const NEAR_FEET = 5;

/**
 * **Wie ein Angriff gewürfelt wird** (T-351): Vorteil und Nachteil aus den
 * Wirkungen beider Seiten — `attack` am Angreifer, `attacked` am Ziel, dazu
 * `attacked.near` bzw. `attacked.far` nach dem Abstand (Prone) — und
 * Nachteil auf **langer Reichweite**. `why` sagt, woher, fürs Protokoll
 * und die Vorschau. Ohne bekannten Abstand gilt weder nah noch fern.
 */
export function attackRollMode(
  attacker: Readonly<Record<string, readonly string[]>>,
  target: Readonly<Record<string, readonly string[]>>,
  opts: { feet?: number | null; long?: boolean } = {},
): { mode: 'adv' | 'dis' | undefined; why: string[] } {
  const feet = opts.feet ?? null;
  const naehe = feet === null ? null : feet <= NEAR_FEET ? 'attacked.near' : 'attacked.far';
  const quellen: [string, readonly string[]][] = [
    ['attacker', attacker['attack'] ?? []],
    ['target', target['attacked'] ?? []],
    ...(naehe ? ([[naehe === 'attacked.near' ? 'target, within 5 ft.' : 'target, beyond 5 ft.', target[naehe] ?? []]] as [string, readonly string[]][]) : []),
  ];
  let vor = false;
  let nach = !!opts.long;
  const why: string[] = opts.long ? ['long range'] : [];
  for (const [wer, w] of quellen) {
    if (w.includes('advantage')) {
      vor = true;
      why.push(`advantage (${wer})`);
    }
    if (w.includes('disadvantage')) {
      nach = true;
      why.push(`disadvantage (${wer})`);
    }
  }
  return { mode: rollMode(vor, nach), why };
}

/**
 * **Die Spielerseite rechnet hier** (T-247, T-246; REQ-051, REQ-063,
 * REQ-066, REQ-067): Schaden und Heilung, zeitweilige Trefferpunkte, die
 * Konzentrationsprobe, die Hände und was sie sperren, und „Your turn" als
 * eine Liste nach Aktionsart. Keine Logik in der Maske — die Maske fragt
 * hier und zeichnet.
 *
 * Was gehalten wird, liest sich heute aus `holds.props.slot`
 * (`mainHand`/`offHand`, REQ-225). Das Ausrüsten mit Tragplätzen und
 * Verdrängen (T-244) wartet auf die Entscheide E-074 … E-094; dann speist
 * das Inventar dieselbe Funktion (`handState`) — die Sperren hier bleiben.
 */

import { keyStats, signedBook, type StatblockContext } from './book.js';
import { abilityMod, derivedValue } from './calc.js';
import { hitPointLevels } from './hitpoints.js';
import type { Entity, EntityId, Registry } from './types.js';

// ------------------------------------------------------------ Trefferpunkte

/** Der Stand am Tisch: Trefferpunkte und zeitweilige (`Vitals.hp`, `hpTemp`). */
export interface HitPointState {
  hp: number;
  temp: number;
}

/** Ein Betrag ist eine ganze Zahl ab 0; Unsinn ist 0. */
export function cleanAmount(v: unknown): number {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * **Schaden geht zuerst von den zeitweiligen Trefferpunkten** (5e, PHB
 * „Temporary Hit Points"), der Rest von den Trefferpunkten, nie unter 0.
 * `taken` ist der ganze Betrag — die Konzentrationsprobe rechnet mit ihm,
 * auch mit dem Teil, den die zeitweiligen schluckten.
 */
export function applyDamage(s: HitPointState, amount: number): HitPointState & { fromTemp: number; taken: number } {
  const a = cleanAmount(amount);
  const temp = Math.max(0, s.temp);
  const fromTemp = Math.min(temp, a);
  return { hp: Math.max(0, s.hp - (a - fromTemp)), temp: temp - fromTemp, fromTemp, taken: a };
}

/** Heilen bis zum Maximum; ohne bekanntes Maximum ohne Deckel. */
export function applyHeal(s: HitPointState, amount: number, max: number | null | undefined): HitPointState {
  const hp = Math.max(0, s.hp) + cleanAmount(amount);
  return { hp: max != null && Number.isFinite(max) ? Math.min(max, hp) : hp, temp: s.temp };
}

/** **Zeitweilige addieren sich nicht** — der höhere Wert bleibt (PHB). */
export function grantTemp(s: HitPointState, amount: number): HitPointState {
  return { hp: s.hp, temp: Math.max(Math.max(0, s.temp), cleanAmount(amount)) };
}

/** Der Betrag am Mausrad: hoch +1, runter −1, nie unter 1. */
export function wheelAmount(amount: number, deltaY: number): number {
  return Math.max(1, cleanAmount(amount) + (deltaY < 0 ? 1 : -1));
}

/**
 * **Die Konzentrationsprobe nach Schaden** (PHB „Concentration"): KON-
 * Rettungswurf gegen SG 10 oder den halben Schaden, abgerundet — was
 * höher ist.
 */
export function concentrationDc(damage: number): number {
  return Math.max(10, Math.floor(cleanAmount(damage) / 2));
}

// ------------------------------------------------------------ Hände (T-244 speist später)

/** Ein gehaltenes Stück, wie die Sperren es brauchen. */
export interface HeldItem {
  id: string;
  name: string;
  /** `mainHand`, `offHand` oder `both` (beidhändig gegriffen). */
  slot: 'mainHand' | 'offHand' | 'both';
  /** Die Namen seiner Eigenschaften (`hasProperty`-Ziele), klein geschrieben. */
  properties: readonly string[];
  /** Ein Schild (`Armor.armorType: shield`). */
  shield?: boolean;
  /** Ein Zauberfokus oder Komponentenbeutel in der Hand. */
  focus?: boolean;
  /** Geübt (Rüstungsgruppe, Waffengruppe oder die Waffe selbst). */
  proficient?: boolean;
  /** Schaden, und mit zwei Händen (vielseitig). */
  damage?: string;
  damage2?: string;
}

/** Was die Hände gerade tun. */
export interface HandState {
  main: HeldItem | null;
  off: HeldItem | null;
  /** Ein Stück in beiden Händen. */
  both: boolean;
  /** Mindestens eine Hand frei. */
  freeHand: boolean;
  /** Ein Schild in der Hand. */
  shield: HeldItem | null;
  /** Ein Schild ohne Übung (kein RK-Bonus, Nachteil, kein Zaubern). */
  shieldUntrained: boolean;
  /** Ein Fokus in der Hand (Material und Somatik mit derselben Hand). */
  focus: boolean;
}

const hat = (it: HeldItem | null, p: string): boolean => !!it && it.properties.some((x) => x.toLowerCase() === p);

/**
 * **Die Hände aus dem, was gehalten wird.** Eine zweihändige Waffe belegt
 * beide, auch wenn sie nur an einem Platz liegt; eine vielseitige nur mit
 * `slot: 'both'`.
 */
export function handState(held: readonly HeldItem[]): HandState {
  const both = held.find((h) => h.slot === 'both' || (h.slot !== 'offHand' && hat(h, 'two-handed'))) ?? null;
  const main = both ?? held.find((h) => h.slot === 'mainHand') ?? null;
  const off = both ? null : held.find((h) => h.slot === 'offHand') ?? null;
  const shield = [main, off].find((h) => h?.shield) ?? null;
  return {
    main,
    off,
    both: !!both,
    freeHand: !both && (!main || !off),
    shield,
    shieldUntrained: !!shield && shield.proficient === false,
    focus: [main, off].some((h) => h?.focus),
  };
}

/** Komponenten eines Zaubers (`Spell.components`). */
export interface SpellNeeds {
  somatic?: boolean;
  material?: boolean;
}

/**
 * **Warum dieser Zauber gerade nicht geht** — leer, wenn er geht.
 *
 * Ein Schild ohne Übung verbietet jedes Zaubern (PHB „Armor
 * Proficiency"). Somatik und Material brauchen eine freie Hand — oder die
 * Hand, die den Fokus hält (PHB „Components"). Ein Zauber nur mit V geht
 * immer.
 */
export function castBlock(hands: HandState, needs: SpellNeeds = { somatic: true }): string {
  if (hands.shieldUntrained) return 'shield without training — no spellcasting';
  if (!needs.somatic && !needs.material) return '';
  if (hands.freeHand || hands.focus) return '';
  return 'no free hand for somatic components — stow or drop something first (free)';
}

/** Braucht eine freie Hand (einen Trank trinken, etwas aufheben). */
export function handBlock(hands: HandState): string {
  return hands.freeHand ? '' : 'needs a free hand — stow or drop something first (free)';
}

/** Die Nebenhand-Attacke braucht eine leichte Waffe in der Nebenhand (PHB „Two-Weapon Fighting"). */
export function offhandBlock(hands: HandState): string {
  return hat(hands.off, 'light') ? '' : 'needs a light weapon in the off hand';
}

/** Der Schaden des Griffs: vielseitig mit beiden Händen den zweiten Würfel. */
export function gripDamage(item: HeldItem, both: boolean): string {
  return both && hat(item, 'versatile') && item.damage2 ? item.damage2 : item.damage ?? '';
}

// ------------------------------------------------------------ Your turn

/** Die Aktionsarten in der Reihenfolge des Bogens. */
export const TURN_TYPES = ['action', 'bonus', 'reaction', 'free', 'trigger'] as const;
export type TurnType = (typeof TURN_TYPES)[number];

/** Nur diese drei werden je Zug als verbraucht markiert. */
export const TRACKED_TURN_TYPES: readonly TurnType[] = ['action', 'bonus', 'reaction'];

/**
 * **Die Aktionsart aus dem Namen ihres Artikels** (`ActionType`: „Action",
 * „Bonus Action", „Reaction", „Free Action"). Was nicht passt — eine
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

/** Was eine Sperre braucht: Zauber (Komponenten), eine Hand, die leichte Nebenhand. */
export type TurnNeed = 'cast' | 'hand' | 'offhand';

/** Eine Zeile in „Your turn". */
export interface TurnAction {
  id: string;
  name: string;
  type: TurnType;
  /** Die Quelle — eine Klasse, ein Talent, ein Gegenstand, `rules`, `spells`. */
  source: string;
  sourceLabel: string;
  /** Rechts in der Zeile: Schaden, Platz, „once per turn". */
  meta?: string;
  /** Was sie tut, ein Satz. */
  does?: string;
  /** Wofür gesperrt werden kann. */
  needs?: TurnNeed;
  /** Komponenten, wenn `needs: 'cast'`. */
  components?: SpellNeeds;
  /** Ein verlinkter Artikel. */
  article?: string;
}

/** Eine Zeile mit ihrer Sperre — leer heisst frei. */
export interface TurnRow extends TurnAction {
  lock: string;
}

/** **Die Sperre einer Zeile**: gesperrte bleiben sichtbar, mit Grund (T-247). */
export function lockOf(a: TurnAction, hands: HandState): string {
  if (a.needs === 'cast') return castBlock(hands, a.components ?? { somatic: true });
  if (a.needs === 'hand') return handBlock(hands);
  if (a.needs === 'offhand') return offhandBlock(hands);
  return '';
}

/**
 * **Die allgemeinen Aktionen** jeder Figur (PHB Kapitel 9). Die Namen
 * sind Regelwörter; was sie tun, sagt das Glossar.
 */
export const RULE_ACTIONS: readonly TurnAction[] = [
  { id: 'rule:dash', name: 'Dash', type: 'action', source: 'rules', sourceLabel: 'Rules' },
  { id: 'rule:disengage', name: 'Disengage', type: 'action', source: 'rules', sourceLabel: 'Rules' },
  { id: 'rule:dodge', name: 'Dodge', type: 'action', source: 'rules', sourceLabel: 'Rules' },
  { id: 'rule:help', name: 'Help', type: 'action', source: 'rules', sourceLabel: 'Rules' },
  { id: 'rule:hide', name: 'Hide', type: 'action', source: 'rules', sourceLabel: 'Rules' },
  { id: 'rule:search', name: 'Search', type: 'action', source: 'rules', sourceLabel: 'Rules' },
  { id: 'rule:use', name: 'Use an object', type: 'action', source: 'rules', sourceLabel: 'Rules', needs: 'hand' },
  { id: 'rule:offhand', name: 'Off-hand attack', type: 'bonus', source: 'rules', sourceLabel: 'Rules', needs: 'offhand' },
  { id: 'rule:opportunity', name: 'Opportunity attack', type: 'reaction', source: 'rules', sourceLabel: 'Rules' },
  { id: 'rule:draw', name: 'Draw or stow a weapon', type: 'free', source: 'rules', sourceLabel: 'Rules', does: 'One object interaction per turn' },
  { id: 'rule:drop', name: 'Drop an item', type: 'free', source: 'rules', sourceLabel: 'Rules' },
  { id: 'rule:stand', name: 'Stand up', type: 'free', source: 'rules', sourceLabel: 'Rules', does: 'Costs half your speed' },
];

/** Jede Zeile mit ihrer Sperre. */
export function turnRows(actions: readonly TurnAction[], hands: HandState): TurnRow[] {
  return actions.map((a) => ({ ...a, lock: lockOf(a, hands) }));
}

/** Die Quellen mit ihrer Anzahl, in der Reihenfolge des ersten Auftretens. */
export function turnSources(actions: readonly TurnAction[]): { id: string; label: string; count: number }[] {
  const m = new Map<string, { id: string; label: string; count: number }>();
  for (const a of actions) {
    const q = m.get(a.source) ?? { id: a.source, label: a.sourceLabel, count: 0 };
    q.count++;
    m.set(a.source, q);
  }
  return [...m.values()];
}

/** Gefiltert nach Quellen (`off`: abgewählte) und Aktionsart (`all` für alle). */
export function filterTurn<T extends TurnAction>(actions: readonly T[], off: ReadonlySet<string>, type: TurnType | 'all'): T[] {
  return actions.filter((a) => !off.has(a.source) && (type === 'all' || a.type === type));
}

/** Die Anzahl je Aktionsart (und `all`) nach dem Quellenfilter. */
export function turnCounts(actions: readonly TurnAction[], off: ReadonlySet<string>): Record<TurnType | 'all', number> {
  const drin = actions.filter((a) => !off.has(a.source));
  const raus = { all: drin.length } as Record<TurnType | 'all', number>;
  for (const t of TURN_TYPES) raus[t] = drin.filter((a) => a.type === t).length;
  return raus;
}

/** Je Aktionsart die Zeilen, in der Reihenfolge von `TURN_TYPES`. */
export function groupTurn<T extends TurnAction>(actions: readonly T[]): { type: TurnType; rows: T[] }[] {
  return TURN_TYPES.map((type) => ({ type, rows: actions.filter((a) => a.type === type) }));
}

/** „Used" je Zug: was verbraucht ist, als Liste (`Vitals.turnUsed`). */
export function toggleUsed(used: readonly string[], type: TurnType): string[] {
  if (!TRACKED_TURN_TYPES.includes(type)) return [...used];
  return used.includes(type) ? used.filter((u) => u !== type) : [...used, type];
}

// ------------------------------------------------------------ Der Kopf

/** Eine Zelle im Karussell: Wert gross, darunter woher. */
export interface SheetCell {
  key: string;
  label: string;
  value: string;
  why?: string;
}

/** Ein Attribut in der Reihe: Modifikator gross, Wert, Rettungswurf. */
export interface SheetAbility {
  key: string;
  label: string;
  score: number | null;
  mod: number | null;
  save: number | null;
  saveProficient: boolean;
}

/** Plätze eines Grades: wie viele, wie viele verbraucht (`Vitals.slotsUsed`). */
export interface SlotLevel {
  level: number;
  max: number;
  used: number;
}

/** Alles, was der Kopf der Spielerseite zeigt — gerechnet beim Lesen (D8). */
export interface SheetHeader {
  hp: number | null;
  max: number | null;
  temp: number;
  /** Vitals: RK, Initiative, Tempo, Übung, passive Wahrnehmung. */
  vitals: SheetCell[];
  /** Spellcasting: Attribut, Angriff, SG, Plätze, Zaubertricks, bekannt — `null` ohne Zauberwirken. */
  casting: SheetCell[] | null;
  /** Trefferwürfel: „d8" oder „d10 · d8", wie viele, wie viele übrig. */
  hitDice: { die: string; max: number; left: number } | null;
  slots: SlotLevel[];
  inspiration: boolean;
  abilities: SheetAbility[];
}

const SHEET_ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;

function zahl(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function liste(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

/** Die Zauber an der Figur (`casts`), mit ihrem Grad, wo der Artikel da ist. */
export interface KnownSpell {
  id: EntityId;
  level: number | null;
  mode: string;
}

/**
 * **Der Kopf der Spielerseite** (T-247, T-246). Die Zahlen kommen vom
 * Statblock (`belongsTo`), der Stand von der Figur (`Vitals`) — wie bei
 * `keyStats`, dessen Kacheln hier mitlaufen. Ohne Statblock steht nur der
 * Stand da.
 */
export function sheetHeader(
  registry: Pick<Registry, 'interfaces' | 'relations' | 'units' | 'settings'>,
  character: Entity,
  statblock: Entity | undefined,
  byId: ReadonlyMap<EntityId, Entity>,
  ctx: StatblockContext & { spells?: readonly KnownSpell[] } = {},
): SheetHeader {
  const v = (character.components?.['Vitals'] ?? {}) as Record<string, unknown>;
  const sb = (statblock?.components?.['Statblock'] ?? {}) as Record<string, unknown>;
  const ab = (statblock?.components?.['Abilities'] ?? {}) as Record<string, unknown>;
  const pr = (statblock?.components?.['Proficiencies'] ?? {}) as Record<string, unknown>;
  /* Das Zauberwirken ist in die Statblock-Karte gemischt (`StatblockCore`
     + `Spellcasting`, Z5): `Statblock.spellSlots`, nicht eine eigene Karte. */
  const sc = sb['spellAbility'] !== undefined || sb['spellSlots'] !== undefined ? sb : undefined;
  const bonuses = (sb['bonuses'] && typeof sb['bonuses'] === 'object' ? sb['bonuses'] : {}) as Record<string, unknown>;

  /* Der Übungsbonus: am Statblock gegeben, sonst aus der Stufe der Figur. */
  const charProp = registry.interfaces['PlayerCharacter']?.schema?.properties?.['proficiency'];
  const levelProf = charProp && (character.relations ?? []).some((r) => r.type === 'hasClass')
    ? derivedValue(charProp, character.components?.['PlayerCharacter'] ?? {}, character.components, character.relations) ?? null
    : null;
  const prof = zahl(sb['prof']) ?? levelProf;

  const ks = keyStats(registry, statblock, character, ctx);
  const tile = (k: string) => ks.tiles.find((t) => t.key === k);
  const vitals: SheetCell[] = [];
  const ac = tile('ac');
  if (ac) vitals.push({ key: 'ac', label: 'AC', value: ac.value, ...(ac.note ? { why: ac.note } : {}) });
  const init = tile('initiative');
  if (init) vitals.push({ key: 'init', label: 'Init', value: init.value, why: 'DEX' });
  const speed = tile('speed');
  if (speed) vitals.push({ key: 'speed', label: 'Speed', value: speed.value });
  if (prof !== null) vitals.push({ key: 'prof', label: 'Prof', value: signedBook(prof) });
  const pp = tile('passivePerception');
  if (pp) vitals.push({ key: 'passive', label: 'Passive', value: pp.value, why: 'Perception' });

  const modOf = (a: string): number | null => {
    const s = zahl(ab[a]);
    return s === null ? null : abilityMod(s);
  };
  const saves = new Set(liste(pr['saves']));
  const abilities: SheetAbility[] = SHEET_ABILITIES.map((key) => {
    const score = zahl(ab[key]);
    const mod = modOf(key);
    const fest = zahl(bonuses[key]);
    const geuebt = saves.has(key);
    const save = fest ?? (mod === null ? null : mod + (geuebt && prof !== null ? prof : 0));
    return { key, label: key.toUpperCase(), score, mod, save, saveProficient: geuebt };
  });

  /* Plätze: die Festlegung am Statblock, der Stand an der Figur. */
  const maxSlots = Array.isArray(sc?.['spellSlots']) ? (sc!['spellSlots'] as unknown[]).map((x) => zahl(x) ?? 0) : [];
  const usedSlots = Array.isArray(v['slotsUsed']) ? (v['slotsUsed'] as unknown[]).map((x) => zahl(x) ?? 0) : [];
  const slots: SlotLevel[] = maxSlots
    .map((max, i) => ({ level: i + 1, max, used: Math.min(max, Math.max(0, usedSlots[i] ?? 0)) }))
    .filter((s) => s.max > 0);

  let casting: SheetCell[] | null = null;
  const spells = ctx.spells ?? [];
  if (sc || spells.length) {
    const scProps = registry.interfaces['Statblock']?.schema?.properties ?? {};
    const abil = typeof sc?.['spellAbility'] === 'string' ? (sc['spellAbility'] as string) : '';
    const dc = scProps['spellDc'] ? derivedValue(scProps['spellDc'], sb, statblock?.components) : undefined;
    const atk = scProps['spellAttack'] ? derivedValue(scProps['spellAttack'], sb, statblock?.components) : undefined;
    const am = abil ? modOf(abil.toLowerCase()) : null;
    casting = [
      { key: 'ability', label: 'Ability', value: abil ? abil.toUpperCase() : '—' },
      { key: 'attack', label: 'Spell attack', value: atk === undefined ? '—' : signedBook(atk), ...(am !== null && prof !== null ? { why: `${abil.toUpperCase()} ${signedBook(am)} · prof ${signedBook(prof)}` } : {}) },
      { key: 'dc', label: 'Save DC', value: dc === undefined ? '—' : String(dc), why: '8 + ability + prof' },
    ];
    for (const s of slots) casting.push({ key: `slots${s.level}`, label: `Slots ${ordinalShort(s.level)}`, value: `${s.max - s.used} / ${s.max}`, why: 'back on a long rest' });
    const cantrips = spells.filter((s) => s.level === 0).length;
    const known = spells.filter((s) => (s.level ?? 1) > 0).length;
    casting.push({ key: 'cantrips', label: 'Cantrips', value: String(cantrips) });
    casting.push({ key: 'known', label: 'Spells', value: String(known), why: 'known or prepared' });
  }

  /* Trefferwürfel: je Klassenstufe einer, der Würfel aus der Klasse. */
  const stufen = hitPointLevels(character, byId);
  const wuerfel = [...new Set(stufen.map((l) => l.die).filter((d): d is number => d !== undefined))];
  const hdLeft = zahl(v['hitDiceLeft']);
  const hitDice = stufen.length
    ? { die: wuerfel.length ? wuerfel.map((d) => `d${d}`).join(' · ') : 'd?', max: stufen.length, left: Math.max(0, Math.min(stufen.length, hdLeft ?? stufen.length)) }
    : null;

  return {
    hp: zahl(v['hp']) ?? zahl(sb['hp']),
    max: zahl(sb['hp']),
    temp: Math.max(0, zahl(v['hpTemp']) ?? 0),
    vitals,
    casting,
    hitDice,
    slots,
    inspiration: v['inspiration'] === true,
    abilities,
  };
}

/** 1st, 2nd, 3rd, 4th … */
export function ordinalShort(n: number): string {
  const r100 = n % 100;
  if (r100 >= 11 && r100 <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

/** Ein Platz an- oder abhaken: `used` ist die Anzahl verbrauchter, ein Klick auf Platz `i` setzt sie. */
export function pipToggle(used: number, i: number): number {
  return i < used ? i : i + 1;
}

/** `slotsUsed` mit einem neuen Stand für einen Grad (1-basiert); Lücken werden 0. */
export function setSlotsUsed(slotsUsed: unknown, level: number, used: number): number[] {
  const roh = Array.isArray(slotsUsed) ? slotsUsed.map((x) => zahl(x) ?? 0) : [];
  while (roh.length < level) roh.push(0);
  roh[level - 1] = Math.max(0, used);
  return roh;
}

// ------------------------------------------------------------ Gold (nur Anzeige, T-245 baut weiter)

/**
 * **Das Gold der Figur**, nur gelesen: was sie in ihrem Inventar trägt
 * (`Inventory.copper`, in Kupfer) und was die Gruppe trägt. Gold an einem
 * Ort (Bank, Versteck) wartet auf T-245 und die Entscheide E-074/E-083 —
 * bis dahin steht hier nichts dafür.
 */
export function goldText(copperOnYou: number | null, copperParty: number | null): { onYou: string; party: string | null } {
  const gp = (c: number) => {
    const g = Math.floor(c / 100);
    const rest = c % 100;
    return rest ? `${g} gp ${rest} cp` : `${g} gp`;
  };
  return { onYou: gp(Math.max(0, copperOnYou ?? 0)), party: copperParty ? gp(copperParty) : null };
}

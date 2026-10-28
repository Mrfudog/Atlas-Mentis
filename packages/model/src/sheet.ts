/**
 * **Die Spielerseite rechnet hier** (T-247, T-246; REQ-051, REQ-063,
 * REQ-066, REQ-067): Schaden und Heilung, zeitweilige Trefferpunkte, die
 * Konzentrationsprobe, die Hände und was sie sperren, und „Your turn" als
 * eine Liste nach Aktionsart. Keine Logik in der Maske — die Maske fragt
 * hier und zeichnet.
 *
 * Was gehalten wird, liest sich aus `holds.props.slot` (`mainHand`/
 * `offHand`, REQ-225) und `holds.props.grip` (beide Hände, T-244). Das
 * Ausrüsten mit Verdrängen steht in `wield.ts` und speist dieselbe
 * Funktion (`handState`) — die Sperren hier bleiben.
 */

import { COMMON_ACTION_CATALOGUE, TURN_TYPES, turnTypeOf, type TurnType } from './actions.js';
import { keyStats, signedBook, type StatblockContext } from './book.js';
import { abilityMod, derivedValue } from './calc.js';
import { effectsAt, effectTotals } from './effects.js';
import { hitPointLevels } from './hitpoints.js';
import { proficienciesOf, proficiencyNames } from './proficiency.js';
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

// ------------------------------------------------------------ Hände (das Ausrüsten: wield.ts, T-244)

/** Ein gehaltenes Stück, wie die Sperren es brauchen. */
export interface HeldItem {
  /** Wer es ist: die `holds`-Kante (zwei Dolche sind zwei Stücke) oder der Gegenstand. */
  id: string;
  /** Der Gegenstand, wenn `id` die Kante ist — für den Link in „Your turn" (T-244). */
  article?: string;
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
  /** Eine Fernkampfwaffe (`Item.itemType: ranged weapon`) — für den hinterhältigen Angriff (T-244). */
  ranged?: boolean;
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

/* Aktionsarten und der Kostenleser stehen mit dem Katalog der allgemeinen
   Aktionen in `actions.ts` (T-275, Punkt 3). */

/** Nur diese drei werden je Zug als verbraucht markiert. */
export const TRACKED_TURN_TYPES: readonly TurnType[] = ['action', 'bonus', 'reaction'];

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
 * **Die allgemeinen Aktionen** jeder Figur (PHB Kapitel 9) — aus dem einen
 * Katalog (`COMMON_ACTION_CATALOGUE`, T-275), den auch der Zugplan liest.
 */
export const RULE_ACTIONS: readonly TurnAction[] = COMMON_ACTION_CATALOGUE.map((a) => ({
  id: `rule:${a.key}`,
  name: a.name,
  type: a.type,
  source: 'rules',
  sourceLabel: 'Rules',
  does: a.hint,
  ...(a.needs ? { needs: a.needs } : {}),
}));

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
  /** `Typ.feld`, woher der Wert kommt — für den Glossarbegriff am Namen (T-347). */
  ref?: string;
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

  /* **Die Wirkungen an der Figur** (T-355): Merkmale, Zustände, getragene
     Stücke — `save`, `save.<attr>`, `spellSaveDc`, `spellAttack`, `check`
     wirken hier, wie `saveBonus` sie für die Konzentration liest. */
  const add = ctx.effects ?? effectTotals(effectsAt(character, byId, statblock ? { statblock } : {})).add;
  const wirkung = (...ziele: string[]) => ziele.reduce((n, k) => n + (add[k] ?? 0), 0);
  const ks = keyStats(registry, statblock, character, { ...ctx, effects: add });
  const tile = (k: string) => ks.tiles.find((t) => t.key === k);
  const vitals: SheetCell[] = [];
  const ac = tile('ac');
  if (ac) vitals.push({ key: 'ac', label: 'AC', value: ac.value, ref: 'Statblock.ac', ...(ac.note ? { why: ac.note } : {}) });
  const init = tile('initiative');
  if (init) vitals.push({ key: 'init', label: 'Init', value: init.value, why: 'DEX', ref: 'Abilities.initiative' });
  const speed = tile('speed');
  if (speed) vitals.push({ key: 'speed', label: 'Speed', value: speed.value, ref: 'Statblock.speed' });
  if (prof !== null) vitals.push({ key: 'prof', label: 'Prof', value: signedBook(prof), ref: 'Statblock.prof' });
  const pp = tile('passivePerception');
  if (pp) vitals.push({ key: 'passive', label: 'Passive', value: pp.value, why: 'Perception' });

  const modOf = (a: string): number | null => {
    const s = zahl(ab[a]);
    return s === null ? null : abilityMod(s);
  };
  /* Rettungswürfe aus allen Quellen, die erste Klasse eingeschlossen (T-239). */
  const saves = new Set(proficiencyNames(proficienciesOf(character, statblock, byId), 'saves').map((x) => x.toLowerCase()));
  const abilities: SheetAbility[] = SHEET_ABILITIES.map((key) => {
    const score = zahl(ab[key]);
    const mod = modOf(key);
    const fest = zahl(bonuses[key]);
    const geuebt = saves.has(key);
    const roh = fest ?? (mod === null ? null : mod + (geuebt && prof !== null ? prof : 0));
    const save = roh === null ? null : roh + wirkung('save', `save.${key}`);
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
    const dcRoh = scProps['spellDc'] ? derivedValue(scProps['spellDc'], sb, statblock?.components) : undefined;
    const atkRoh = scProps['spellAttack'] ? derivedValue(scProps['spellAttack'], sb, statblock?.components) : undefined;
    const dc = dcRoh === undefined ? undefined : dcRoh + wirkung('spellSaveDc');
    const atk = atkRoh === undefined ? undefined : atkRoh + wirkung('spellAttack');
    const am = abil ? modOf(abil.toLowerCase()) : null;
    casting = [
      { key: 'ability', label: 'Ability', value: abil ? abil.toUpperCase() : '—' },
      { key: 'attack', label: 'Spell attack', value: atk === undefined ? '—' : signedBook(atk), ...(am !== null && prof !== null ? { why: `${abil.toUpperCase()} ${signedBook(am)} · prof ${signedBook(prof)}${wirkung('spellAttack') ? ` · effects ${signedBook(wirkung('spellAttack'))}` : ''}` } : {}) },
      { key: 'dc', label: 'Save DC', value: dc === undefined ? '—' : String(dc), why: `8 + ability + prof${wirkung('spellSaveDc') ? ` · effects ${signedBook(wirkung('spellSaveDc'))}` : ''}` },
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

// ------------------------------------------------------------ Your turn zusammenstellen

/** Eine Aktion des Statblocks (`composedOf` → `Action`), mit dem Namen ihrer Art. */
export interface StatblockAction {
  id: string;
  name: string;
  actionTypeName: string | null;
  meta?: string;
}

/** Ein Zauber der Figur (`casts`), wie „Your turn" ihn braucht. */
export interface TurnSpell {
  id: string;
  name: string;
  level: number | null;
  /** Der Name der Aktionsart der Wirkzeit (`castingAction`); ohne: eine Minute oder mehr. */
  actionTypeName: string | null;
  components: readonly string[];
  /** Wann eine Reaktion ausgelöst wird (`castingCondition`). */
  trigger?: string;
}

/**
 * **„Your turn" aus allem, was die Figur hat** (T-247): die allgemeinen
 * Aktionen, der Angriff mit dem, was die Hände halten, die Aktionen des
 * Statblocks, die Zauber nach ihrer Wirkzeit, und was man trinken oder
 * benutzen kann. Jede Quelle bringt ihre eigene Zeile; eine Zauberwirkzeit
 * von einer Minute steht nicht im Zug.
 */
export function turnActions(o: {
  hands: HandState;
  actions?: readonly StatblockAction[];
  spells?: readonly TurnSpell[];
  /** Tränke und anderes, das man mit einer Aktion benutzt. */
  consumables?: readonly { id: string; name: string }[];
}): TurnAction[] {
  const out: TurnAction[] = [];
  const { main, off, both } = o.hands;
  out.push({
    id: 'rule:attack',
    name: 'Attack',
    type: 'action',
    source: 'rules',
    sourceLabel: 'Rules',
    meta: main && !main.shield ? `${main.name}${gripDamage(main, both) ? ` ${gripDamage(main, both)}` : ''}` : 'unarmed',
    /* Ein Schild ohne Übung: Nachteil auf STR- und DEX-Würfe (PHB „Armor Proficiency"), T-244. */
    does: o.hands.shieldUntrained ? 'With what you hold — disadvantage: shield without training' : 'With what you hold',
    ...(main && !main.shield ? { article: main.article ?? main.id } : {}),
  });
  for (const a of RULE_ACTIONS) {
    out.push(a.id === 'rule:offhand' && off && !off.shield ? { ...a, meta: `${off.name}${off.damage ? ` ${off.damage}` : ''}` } : a);
  }
  for (const a of o.actions ?? []) {
    const type = turnTypeOf(a.actionTypeName);
    if (!type) continue;
    out.push({ id: a.id, name: a.name, type, source: 'statblock', sourceLabel: 'Features', article: a.id, ...(a.meta ? { meta: a.meta } : {}) });
  }
  for (const s of o.spells ?? []) {
    const type = s.trigger ? 'reaction' : turnTypeOf(s.actionTypeName);
    if (!type) continue;
    const c = new Set(s.components.map((x) => x.toLowerCase()));
    out.push({
      id: s.id,
      name: s.name,
      type,
      source: 'spells',
      sourceLabel: 'Spells',
      meta: s.level === 0 ? 'cantrip' : s.level ? `${ordinalShort(s.level)}-level slot` : '',
      needs: 'cast',
      components: { somatic: c.has('s'), material: c.has('m') },
      article: s.id,
      ...(s.trigger ? { does: s.trigger } : {}),
    });
  }
  for (const k of o.consumables ?? []) {
    out.push({ id: `use:${k.id}`, name: `Use ${k.name}`, type: 'action', source: 'items', sourceLabel: 'Items', needs: 'hand', article: k.id });
  }
  return out;
}

// ------------------------------------------------------------ Zaubern (T-246)

/**
 * **Mit welchem Platz gewirkt wird**: der kleinste freie ab dem Grad des
 * Zaubers (höher wirken geht immer). Ein Zaubertrick braucht keinen
 * (`0`); ist keiner frei, `null`.
 */
export function slotFor(level: number | null, slots: readonly SlotLevel[]): number | null {
  if (!level) return 0;
  const frei = slots.filter((s) => s.level >= level && s.used < s.max).sort((a, b) => a.level - b.level)[0];
  return frei ? frei.level : null;
}

/**
 * **Warum dieser Zauber gerade nicht geht** — die Hände zuerst, dann der
 * Platz. Ein Ritual geht ohne Platz (es dauert zehn Minuten länger), also
 * sperrt der fehlende Platz es nicht.
 */
export function spellLock(
  hands: HandState,
  spell: { level: number | null; components: readonly string[]; ritual?: boolean },
  slots: readonly SlotLevel[],
): string {
  const c = new Set(spell.components.map((x) => x.toLowerCase()));
  const hand = castBlock(hands, { somatic: c.has('s'), material: c.has('m') });
  if (hand) return hand;
  if (spell.level && slotFor(spell.level, slots) === null && !spell.ritual) return `no ${ordinalShort(spell.level)}-level slot or higher left — back on a long rest`;
  return '';
}

/** Die Zauber nach Grad, Zaubertricks zuerst, darin nach Namen. */
export function spellsByLevel<T extends { level: number | null; name: string }>(spells: readonly T[]): { level: number; rows: T[] }[] {
  const grade = [...new Set(spells.map((s) => s.level ?? 0))].sort((a, b) => a - b);
  return grade.map((level) => ({ level, rows: spells.filter((s) => (s.level ?? 0) === level).sort((a, b) => a.name.localeCompare(b.name)) }));
}

/**
 * **Wie diese Figur Zauber lernt**, aus ihren `casts`-Kanten (`mode`):
 * vorbereitet, bekannt, angeboren, aus einem Gegenstand. Der eigene Weg
 * steht offen, die übrigen der Kampagne zugeklappt (Rückmeldung der
 * Leitung, T-246). Die Mechaniken selbst werden Regelartikel mit Ablauf
 * (T-241, T-249) — bis dahin ein Satz je Weg.
 */
export const LEARNING_PATHS: readonly { mode: string; label: string; text: string }[] = [
  { mode: 'known', label: 'Spells known', text: 'You know a fixed number of spells. On a new level you learn the spells your class table gives and may swap one you know for another from your list.' },
  { mode: 'prepared', label: 'Prepared from the list', text: 'After a long rest you choose which spells from your list you have ready — as many as your class allows.' },
  { mode: 'innate', label: 'Innate', text: 'Your ancestry, feat or gift lets you cast these, often a number of times per day, without learning them.' },
  { mode: 'item', label: 'From an item', text: 'An item casts these with its charges while you carry it — or attune to it, if it asks.' },
];

export function learningPaths(modes: readonly string[]): { own: typeof LEARNING_PATHS[number][]; other: typeof LEARNING_PATHS[number][] } {
  const m = new Set(modes);
  return { own: LEARNING_PATHS.filter((p) => m.has(p.mode)), other: LEARNING_PATHS.filter((p) => !m.has(p.mode)) };
}

// ------------------------------------------------------------ Blaupausen (T-247, auf T-128/T-197)

/** Wie es um eine Blaupause steht, aus Sicht der Figur. */
export type BlueprintState = 'busy' | 'unlearned' | 'ready' | 'missing';

/**
 * **Was fehlt** — je Bestandteil, was die Figur und ihre Gruppe frei haben,
 * nach Grundartikel. Eine Materialgruppe oder ein Ersatz nach einer Regel
 * der Kampagne (T-197) zählt hier nicht: das entscheidet die Werkbank beim
 * Start. „Fehlt" ist darum eine Obergrenze, „bereit" stimmt.
 */
export function blueprintMissing(needs: readonly { item: string; qty: number }[], stock: Readonly<Record<string, { qty: number }>>): number {
  return needs.reduce((n, b) => n + Math.max(0, b.qty - (stock[b.item]?.qty ?? 0)), 0);
}

export function blueprintState(
  r: { id: string; learned?: boolean; needs: readonly { item: string; qty: number }[] },
  stock: Readonly<Record<string, { qty: number }>>,
  busy: ReadonlySet<string>,
): { state: BlueprintState; missing: number } {
  const missing = blueprintMissing(r.needs, stock);
  if (busy.has(r.id)) return { state: 'busy', missing };
  if (r.learned === false) return { state: 'unlearned', missing };
  return { state: missing ? 'missing' : 'ready', missing };
}

/** Die Filter des Reiters: gelernt/alle, bereit/fast (1–2 fehlen), Werkzeug. */
export function filterBlueprints<T extends { id: string; learned?: boolean; tools: readonly string[]; needs: readonly { item: string; qty: number }[] }>(
  rows: readonly T[],
  stock: Readonly<Record<string, { qty: number }>>,
  f: { scope: 'known' | 'all'; can: 'all' | 'ready' | 'almost'; tool: string },
): T[] {
  return rows.filter((r) => {
    if (f.scope === 'known' && r.learned === false) return false;
    if (f.tool && !r.tools.some((w) => w.toLowerCase() === f.tool.toLowerCase())) return false;
    if (f.can === 'all') return true;
    const m = blueprintMissing(r.needs, stock);
    return r.learned !== false && (f.can === 'ready' ? m === 0 : m > 0 && m <= 2);
  });
}

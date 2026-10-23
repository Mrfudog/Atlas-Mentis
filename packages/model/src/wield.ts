/**
 * **Ausrüsten in die Hände** (T-244; REQ-323, REQ-324, REQ-334): ein
 * Gegenstand kommt aus dem Raster in die Haupt- oder Nebenhand oder in
 * beide; was dort war, wird verdrängt — verstaut oder fallen gelassen —,
 * und was die Hände danach sperren, rechnet `handState` (T-247) wie
 * bisher. Hier steht nur, **wer wohin darf und wer dafür weichen muss**,
 * und wie die Kanten danach aussehen. Keine Logik in der Maske.
 *
 * Die Eigenschaften kommen aus dem Gegenstand (`hasProperty`-Ziele, ihre
 * Namen klein) und aus `Item.itemType` — keine Liste von Waffen im Code.
 * Der Griff mit beiden Händen steht an der Kante (`holds.props.grip`),
 * wie die Drehung: dieselbe Waffe liegt hier in einer Hand und dort in
 * zweien.
 */

import { firstFreeSpot, type GridPiece, type Shape } from './inventory.js';
import { castBlock, handBlock, offhandBlock, type HandState, type HeldItem } from './sheet.js';
import type { Entity, Relation } from './types.js';

/** Die drei Griffe: Haupthand, Nebenhand, beide Hände. */
export type HandPlace = HeldItem['slot'];
export const HAND_PLACES: readonly HandPlace[] = ['mainHand', 'offHand', 'both'];

/** Ein Gegenstand, wie das Ausrüsten ihn braucht — ein `HeldItem` ohne Platz. */
export type WieldItem = Omit<HeldItem, 'slot'> & {
  /** Eine Rüstung: getragen, nicht gehalten. */
  worn?: boolean;
};

/** Gegenstandsarten, die als Zauberfokus in der Hand gelten (PHB „Spellcasting Focus"). */
export const FOCUS_ITEM_TYPES: readonly string[] = ['spellcasting focus', 'staff', 'rod', 'wand'];
const RUESTUNG = new Set(['light armor', 'medium armor', 'heavy armor']);

const hat = (it: { properties: readonly string[] }, p: string): boolean => it.properties.some((x) => x.toLowerCase() === p);

/** Zweihändig: belegt immer beide Hände, wo es auch liegt. */
export function isTwoHanded(it: { properties: readonly string[] }): boolean {
  return hat(it, 'two-handed');
}

/** Vielseitig: eine oder zwei Hände, der Griff wählt den Schadenswürfel. */
export function isVersatile(it: { properties: readonly string[] }): boolean {
  return hat(it, 'versatile');
}

/**
 * **Ein Gegenstand fürs Ausrüsten**, aus seinem Artikel. `propertyNames`
 * sind die Namen seiner `hasProperty`-Ziele, `proficient` fragt die
 * Übungen der Figur (Waffengruppe, Waffe selbst, `shield`).
 */
export function wieldItemOf(
  item: Entity | undefined,
  o: { id: string; name: string; propertyNames: readonly string[]; proficient: (what: string) => boolean; article?: string },
): WieldItem {
  const it = (item?.components?.['Item'] ?? {}) as Record<string, unknown>;
  const weapon = item?.components?.['Weapon'] as Record<string, unknown> | undefined;
  const armor = (item?.components?.['Armor'] ?? {}) as Record<string, unknown>;
  const art = String(it['itemType'] ?? '').toLowerCase();
  const shield = armor['armorType'] === 'shield' || art === 'shield';
  const name = o.name;
  const proficient = shield
    ? o.proficient('shield')
    : !weapon || o.proficient(String(weapon['category'] ?? '')) || o.proficient(name);
  return {
    id: o.id,
    ...(o.article ? { article: o.article } : {}),
    name,
    properties: o.propertyNames.map((p) => p.toLowerCase()).filter(Boolean),
    shield,
    focus: FOCUS_ITEM_TYPES.includes(art),
    proficient,
    ...(RUESTUNG.has(art) || (armor['armorType'] && !shield) ? { worn: true } : {}),
    ...(art === 'ranged weapon' ? { ranged: true } : {}),
    ...(typeof weapon?.['damage'] === 'string' ? { damage: weapon['damage'] as string } : {}),
    ...(typeof weapon?.['damage2'] === 'string' ? { damage2: weapon['damage2'] as string } : {}),
  };
}

/**
 * **In welcher Hand ein Stück liegt**, aus seiner Kante: `slot` mit
 * `grip: 'two'` ist „beide Hände"; ein altes `tier: 'held'` ohne Platz
 * ist die Haupthand. Nicht in der Hand: `null`.
 */
export function heldPlaceOf(props: Record<string, unknown> | null | undefined): HandPlace | null {
  const p = props ?? {};
  if (p['slot'] === 'offHand') return 'offHand';
  if (p['slot'] === 'mainHand' || (!p['slot'] && p['tier'] === 'held')) return p['grip'] === 'two' ? 'both' : 'mainHand';
  return null;
}

/**
 * **Darf dieser Gegenstand an diesen Griff?** Leer heisst ja, sonst der
 * Grund — als Satz, den die Maske neben ✗ schreibt.
 */
export function handRule(item: WieldItem, place: HandPlace): string {
  if (item.worn) return 'is worn, not held';
  if (item.shield) return place === 'offHand' ? '' : 'a shield goes on the off hand';
  if (place === 'both') return isTwoHanded(item) || isVersatile(item) ? '' : 'only two-handed or versatile items';
  if (place === 'offHand' && isTwoHanded(item)) return 'two-handed — it takes both hands';
  return '';
}

/** Welche Hände ein Griff belegt. */
function haende(place: HandPlace, item: { properties: readonly string[] }): ('main' | 'off')[] {
  if (place === 'both' || (place === 'mainHand' && isTwoHanded(item))) return ['main', 'off'];
  return place === 'offHand' ? ['off'] : ['main'];
}

/** Was ein Griff kostet und wer dafür weichen muss. */
export interface WieldPlan {
  /** Leer heisst: geht. */
  why: string;
  /** Der Griff, der gilt: eine zweihändige Waffe in der Haupthand liegt in beiden. */
  place: HandPlace;
  /** Was verdrängt wird — verstaut oder fallen gelassen. */
  displaced: HeldItem[];
  /**
   * Was nur den Griff wechselt: eine vielseitige Waffe in beiden Händen
   * rückt in die Haupthand, wenn die Nebenhand gebraucht wird (Runde 8).
   */
  regrip: HeldItem | null;
}

/**
 * **Wer weichen muss** (T-244): das Stück selbst wird zuerst aus den
 * Händen genommen (es wechselt nur die Hand), dann belegt der neue Griff
 * seine Hände, und jedes Stück, das eine davon hält, geht. Braucht die
 * Nebenhand ein Stück, das eine vielseitige Waffe beidhändig hält, wechselt
 * die Waffe auf eine Hand, statt zu gehen.
 */
export function wieldPlan(held: readonly HeldItem[], item: WieldItem, place: HandPlace): WieldPlan {
  const why = handRule(item, place);
  const gilt: HandPlace = place === 'mainHand' && isTwoHanded(item) ? 'both' : place;
  if (why) return { why, place: gilt, displaced: [], regrip: null };
  const braucht = new Set(haende(gilt, item));
  const displaced: HeldItem[] = [];
  let regrip: HeldItem | null = null;
  for (const h of held) {
    if (h.id === item.id) continue;
    const belegt = haende(h.slot, h);
    if (!belegt.some((x) => braucht.has(x))) continue;
    if (h.slot === 'both' && !isTwoHanded(h) && !braucht.has('main')) regrip = h;
    else displaced.push(h);
  }
  return { why: '', place: gilt, displaced, regrip };
}

/** Wohin ein verdrängtes Stück geht. */
export type DisplaceTo = 'stow' | 'ground';

/** Ein freier Platz im Raster für ein verstautes Stück, oder keiner. */
export type StowSpot = { gx: number; gy: number; rot: number } | null;

/**
 * **Freie Plätze für mehrere Stücke nacheinander** — das erste belegt
 * seinen Platz, bevor das nächste sucht. `leaving` sind Stücke, die das
 * Raster verlassen (der Gegenstand, der in die Hand geht) und Platz frei
 * machen.
 */
export function stowSpots(
  box: Shape,
  pieces: readonly (GridPiece & { key: string })[],
  stow: readonly (GridPiece & { key: string })[],
  leaving: readonly string[] = [],
): Record<string, StowSpot> {
  const liegt = pieces.filter((p) => !leaving.includes(p.key) && !stow.some((s) => s.key === p.key));
  const raus: Record<string, StowSpot> = {};
  for (const s of stow) {
    const spot = firstFreeSpot(box, liegt, { ...s, gx: null, gy: null });
    raus[s.key] = spot;
    if (spot) liegt.push({ ...s, ...spot });
  }
  return raus;
}

/** Was eine Kante beim Verlassen der Hand oder des Rasters verliert. */
const LAGE = ['slot', 'grip', 'gx', 'gy'] as const;

function ohne(props: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  const p = { ...props };
  for (const k of keys) delete p[k];
  return p;
}

/**
 * **Ein Stück verstauen**: aus der Hand an einen freien Platz im Raster;
 * ohne Platz liegt es unter „Not stowed" (T-140). Ohne Raster
 * (Gewicht, Slots) kommt es einfach in die Sachen.
 */
export function stowProps(props: Record<string, unknown>, spot: StowSpot, grid: boolean): Record<string, unknown> {
  const p = ohne(props, LAGE);
  p['tier'] = 'pack';
  if (!grid) return p;
  if (spot) {
    delete p['unstowed'];
    return { ...p, gx: spot.gx, gy: spot.gy, rot: spot.rot };
  }
  return { ...p, unstowed: true };
}

/** **Fallen lassen** (REQ-225): liegt zu Füssen, gehört weiter dazu, ohne Platz und Raster. */
export function dropProps(props: Record<string, unknown>): Record<string, unknown> {
  return { ...ohne(props, [...LAGE, 'unstowed']), tier: 'ground' };
}

/**
 * **Die Kanten nach dem Griff.** `edgeId` ist der Stapel, aus dem das
 * Stück kommt; liegen mehrere darauf, geht eines in die Hand (eine neue
 * Kante `newId`) und der Rest bleibt, wo er lag. Verdrängtes geht nach
 * `displacedTo` (verstaut an `spots`, sonst unter „Not stowed"), ein
 * Griffwechsel verliert nur `grip`. Die Kanten der verdrängten Stücke
 * nennt `edgeOf` (HeldItem.id → Kanten-Id).
 */
export function applyWield(
  relations: readonly Relation[],
  o: {
    edgeId: string;
    plan: WieldPlan;
    newId: string;
    displacedTo: DisplaceTo;
    edgeOf: (heldId: string) => string;
    spots?: Readonly<Record<string, StowSpot>>;
    grid: boolean;
  },
): Relation[] {
  if (o.plan.why) return [...relations];
  const weg = new Map(o.plan.displaced.map((h) => [o.edgeOf(h.id), h]));
  const umgreifen = o.plan.regrip ? o.edgeOf(o.plan.regrip.id) : null;
  const handProps = (p: Record<string, unknown>) => {
    const neu = ohne(p, ['gx', 'gy', 'unstowed', 'grip']);
    neu['slot'] = o.plan.place === 'offHand' ? 'offHand' : 'mainHand';
    neu['tier'] = 'held';
    if (o.plan.place === 'both') neu['grip'] = 'two';
    return neu;
  };
  const raus: Relation[] = [];
  for (const r of relations) {
    const props = (r.props ?? {}) as Record<string, unknown>;
    if (r.id === o.edgeId) {
      const qty = Math.max(1, Number(props['qty']) || 1);
      if (qty > 1 && heldPlaceOf(props) === null) {
        raus.push({ ...r, props: { ...props, qty: qty - 1 } });
        raus.push({ id: o.newId, type: r.type, to: r.to, props: handProps({ ...ohne(props, ['reservedFor', 'forNeed']), qty: 1 }) });
      } else {
        raus.push({ ...r, props: handProps(props) });
      }
    } else if (weg.has(r.id)) {
      raus.push({ ...r, props: o.displacedTo === 'ground' ? dropProps(props) : stowProps(props, o.spots?.[r.id] ?? null, o.grid) });
    } else if (r.id === umgreifen) {
      raus.push({ ...r, props: { ...ohne(props, ['grip']), slot: 'mainHand' } });
    } else {
      raus.push(r);
    }
  }
  return raus;
}

// ------------------------------------------------------------ Wohin es kann

/** Ein Ziel in der Liste „Where it can go". */
export type WieldTarget = HandPlace | 'stow' | 'aside' | 'ground';

export interface WieldOption {
  target: WieldTarget;
  /** Liegt es schon da? */
  here: boolean;
  ok: boolean;
  /** Warum nicht — oder leer. */
  why: string;
  /** Wer dafür weichen muss (Namen). */
  displaces: string[];
  /** Wer nur den Griff wechselt. */
  regrips: string | null;
}

/**
 * **Alle Ziele eines Stücks** mit ✓ (geht), ⚠ (verdrängt) oder ✗ (Grund):
 * die drei Griffe, verstauen, beiseitelegen, fallen lassen. `now` sagt,
 * wo es liegt; `room` ob im Raster Platz ist (`null`: kein Raster).
 */
export function wieldOptions(
  held: readonly HeldItem[],
  item: WieldItem,
  now: { hand: HandPlace | null; inGrid: boolean; unstowed: boolean; ground: boolean },
  room: boolean | null,
): WieldOption[] {
  const raus: WieldOption[] = HAND_PLACES.map((place) => {
    const plan = wieldPlan(held, item, place);
    const here = now.hand === place;
    return {
      target: place,
      here,
      ok: !plan.why && !here,
      why: plan.why,
      displaces: plan.displaced.map((h) => h.name),
      regrips: plan.regrip?.name ?? null,
    };
  });
  const stowHere = room === null ? !now.hand && !now.unstowed && !now.ground : now.inGrid;
  raus.push({
    target: 'stow',
    here: stowHere,
    ok: !stowHere && room !== false,
    why: room === false && !stowHere ? 'no room in the grid — rearrange it first' : '',
    displaces: [],
    regrips: null,
  });
  raus.push({ target: 'aside', here: now.unstowed, ok: !now.unstowed, why: '', displaces: [], regrips: null });
  raus.push({ target: 'ground', here: now.ground, ok: !now.ground, why: '', displaces: [], regrips: null });
  return raus;
}

/** Wie die Ziele heissen und was sie kosten (Einstellung `handActions`, Leiter `DrawTime`). */
export function wieldTargetLabel(t: WieldTarget): string {
  return { mainHand: 'Main hand', offHand: 'Off hand', both: 'Both hands', stow: 'Stow in the grid', aside: 'Not stowed', ground: 'Drop' }[t];
}

// ------------------------------------------------------------ Was die Hände erlauben

export interface HandCheck {
  key: string;
  /** `ok` ✓, `warn` ⚠, `no` ✗. */
  state: 'ok' | 'warn' | 'no';
  text: string;
}

/**
 * **Was die Hände gerade erlauben** — unter den Händen, als ✓/⚠/✗ mit
 * Grund (Runde 8): Zaubern, der Schild, ein Trank, die Nebenhand und,
 * wo die Figur ihn hat, der hinterhältige Angriff (Finesse oder
 * Fernkampf). Dieselben Sperren wie in „Your turn" (`castBlock`,
 * `handBlock`, `offhandBlock`).
 */
export function handChecks(h: HandState, o: { sneakAttack?: boolean } = {}): HandCheck[] {
  const raus: HandCheck[] = [];
  const zauber = castBlock(h);
  raus.push(zauber
    ? { key: 'cast', state: 'no', text: `Spellcasting blocked: ${zauber}.` }
    : { key: 'cast', state: 'ok', text: h.focus && !h.freeHand ? 'Spellcasting: the focus in your hand covers somatic and material components.' : 'Spellcasting: a hand is free for somatic and material components.' });
  if (h.shield) {
    raus.push(h.shieldUntrained
      ? { key: 'shield', state: 'no', text: `${h.shield.name} without training: no AC bonus, disadvantage on STR and DEX checks, saves and attacks, no spellcasting.` }
      : { key: 'shield', state: 'ok', text: `${h.shield.name}: its AC bonus counts. Donning or doffing takes an action.` });
  }
  const hand = handBlock(h);
  raus.push(hand ? { key: 'hand', state: 'no', text: 'Potions and picking things up need a free hand.' } : { key: 'hand', state: 'ok', text: 'A hand is free to drink a potion or pick something up.' });
  if (h.off && !h.off.shield && !h.off.focus) {
    const off = offhandBlock(h);
    raus.push(off ? { key: 'offhand', state: 'warn', text: `Off-hand attack: ${h.off.name} is not light.` } : { key: 'offhand', state: 'ok', text: `Off-hand attack with ${h.off.name} (bonus action).` });
  }
  if (o.sneakAttack) {
    const w = h.main && !h.main.shield ? h.main : null;
    const geht = !!w && (hat(w, 'finesse') || !!w.ranged);
    raus.push(geht
      ? { key: 'sneak', state: 'ok', text: `Sneak Attack: ${w!.name} is a ${hat(w!, 'finesse') ? 'finesse' : 'ranged'} weapon.` }
      : { key: 'sneak', state: 'no', text: 'Sneak Attack needs a finesse or ranged weapon in hand.' });
  }
  return raus;
}

// ------------------------------------------------------------ Was am Platz steht

/**
 * **Die Zeile unter einem gehaltenen Stück**: der Schaden des Griffs
 * (vielseitig mit dem zweiten Würfel in beiden Händen), was ein Schild
 * ohne Übung kostet, was ein Fokus deckt.
 */
export function heldDetail(item: HeldItem, both: boolean): string {
  if (item.shield) return item.proficient === false ? 'no training: no AC bonus, no spellcasting' : 'AC bonus · an action to don or doff';
  if (item.focus && !item.damage) return 'spellcasting focus — covers somatic and material components';
  if (isVersatile(item) && item.damage2) {
    return both ? `${item.damage2} · two hands` : `${item.damage ?? '—'} · one hand (two: ${item.damage2})`;
  }
  if (isTwoHanded(item)) return [item.damage, 'two-handed'].filter(Boolean).join(' · ');
  return [item.damage, ...item.properties.filter((p) => p === 'light' || p === 'finesse')].filter(Boolean).join(' · ');
}

/** Was der Griff an einem Platz kostet — ein Schild an- oder ablegen ist eine Aktion (PHB). */
export function handCost(item: HeldItem | null): string {
  return item?.shield ? 'shield: an action to don or doff' : 'draw or stow: object interaction';
}

/** Die Zeile über den Händen. */
export function handSummary(h: HandState): string {
  if (h.both && h.main) return `Both hands on the ${h.main.name}`;
  if (!h.main && !h.off) return 'Both hands free';
  return h.freeHand ? 'One hand free' : 'Both hands full';
}

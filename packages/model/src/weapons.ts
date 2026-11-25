/**
 * **Waffen in der Hand sind Angriffe** (T-354, aus T-275 Punkt 12; REQ-357).
 *
 * Ein Statblock nennt seine Angriffe als Aktionen (`composedOf`, D51); eine
 * Spielerfigur hat ihren Angriff aber in der Hand — das Langschwert im
 * Inventar, nicht als Aktion am Statblock. Bisher hatte sie im Zugplan nur
 * den waffenlosen Schlag. Jetzt wird aus jeder Waffe in der Hand eine
 * Angriffskachel, gerechnet wie jeder Angriff (`attackNumbers`):
 *
 *   Treffer = Übung (wenn geübt) + Mod(STR, DEX bei Finesse/Fernkampf)
 *   Schaden = Würfel (zweihändig vielseitig: der grössere) + Mod
 *
 * Dazu die Wirkungen der Figur (`weapon.attack`, `weapon.damage`, `weapon`,
 * T-355) und **die der Waffe selbst** (`when: self`, die +1-Waffe) — die
 * stehen am Gegenstand und gelten nur für Angriffe mit ihm.
 *
 * **Zwei Waffen** (PHB, Two-Weapon Fighting): hält die Figur in beiden
 * Händen eine leichte Nahkampfwaffe, kommt ein Angriff mit der Nebenhand
 * als Bonusaktion dazu — ohne positiven Modifikator beim Schaden.
 *
 * Rechnung, keine Engine (E-102): die Zahl ist dieselbe, die eine spätere
 * Automation rechnen würde, mit denselben Eingaben.
 */

import { attackNumbers, withEffectBonuses } from './attack.js';
import { itemFeaturesOf } from './enhancement.js';
import { effectsOf } from './effects.js';
import { primaryInterface } from './entity.js';
import { hasProficiency, type ProficiencyList } from './proficiency.js';
import type { Entity, EntityId } from './types.js';
import { heldPlaceOf, type HandPlace } from './wield.js';
import { tileFromAction, type PlanTile } from './zugplan.js';

type Card = Record<string, unknown>;
type Lookup = ReadonlyMap<EntityId, Entity>;

/** Eine Waffe in der Hand: die `holds`-Kante, der Gegenstand, die Hand. */
export interface HeldWeapon {
  edge: string;
  item: Entity;
  place: HandPlace;
}

/** Ist dieser Gegenstand eine Waffe (Karte `Weapon` oder Art `… weapon`)? */
export function isWeapon(item: Entity | undefined): boolean {
  if (!item) return false;
  if (item.components?.['Weapon']) return true;
  const art = String(item.components?.['Item']?.['itemType'] ?? '').toLowerCase();
  return art === 'melee weapon' || art === 'ranged weapon' || primaryInterface(item) === 'Weapon';
}

/**
 * **Die Waffen in den Händen** einer Figur: über `carries` → Inventar →
 * `holds` mit einem Handplatz (`heldPlaceOf`). Nur das eigene Inventar —
 * was in einem Behälter liegt, hält niemand.
 */
export function heldWeapons(creature: Entity, byId: Lookup): HeldWeapon[] {
  const raus: HeldWeapon[] = [];
  for (const c of creature.relations ?? []) {
    if (c.type !== 'carries') continue;
    const inv = byId.get(c.to);
    for (const h of inv?.relations ?? []) {
      if (h.type !== 'holds') continue;
      const place = heldPlaceOf(h.props as Card | undefined);
      const item = byId.get(h.to);
      if (place && item && isWeapon(item)) raus.push({ edge: h.id, item, place });
    }
  }
  return raus;
}

/** Was an der Waffe selbst steht (`when: self`): `weapon`, `weapon.attack`, `weapon.damage`. */
export function selfWeaponBonuses(item: Entity): Record<string, number> {
  const raus: Record<string, number> = {};
  for (const e of effectsOf(item)) {
    if (e.when !== 'self' || e.op !== 'add') continue;
    if (e.target !== 'weapon' && e.target !== 'weapon.attack' && e.target !== 'weapon.damage') continue;
    const n = Number(e.value);
    if (Number.isFinite(n)) raus[e.target] = (raus[e.target] ?? 0) + n;
  }
  return raus;
}

const zahl = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

/**
 * **Die Kachel einer Waffe.** `stats` sind die Karten des Statblocks als
 * eine (`Abilities` und `Statblock`), `add` die Wirkungssummen der Figur.
 * `offHand`: der Angriff der Nebenhand (Bonusaktion, kein positiver Mod).
 */
export function weaponTile(
  w: HeldWeapon,
  o: {
    stats: Card;
    proficient: boolean;
    lookup: (id: EntityId) => Entity | undefined;
    add?: Readonly<Record<string, number>>;
    offHand?: boolean;
  },
): PlanTile | null {
  const wp = (w.item.components?.['Weapon'] ?? {}) as Card;
  const it = (w.item.components?.['Item'] ?? {}) as Card;
  const merkmale = itemFeaturesOf(w.item, o.lookup);
  /* Reichweite und Wurf sind (noch) keine `mechanics` der Eigenschaft; ihr Name sagt es (Reach, Thrown). */
  const namen = (w.item.relations ?? []).filter((r) => r.type === 'hasProperty').map((r) => String(o.lookup(r.to)?.name ?? '').toLowerCase());
  const m = new Set([...merkmale.mechanics.map((x) => x.toLowerCase()), ...namen.filter((n) => n === 'reach' || n === 'thrown')]);
  const fern = String(it['itemType'] ?? '').toLowerCase() === 'ranged weapon';
  const range = typeof wp['range'] === 'string' || typeof wp['range'] === 'number' ? String(wp['range']) : '';
  const kinds = fern ? ['ranged weapon'] : m.has('thrown') && range ? ['melee weapon', 'ranged weapon'] : ['melee weapon'];
  const beide = w.place === 'both' && m.has('versatile');
  const wuerfel = beide ? merkmale.versatileDamage ?? (typeof wp['damage2'] === 'string' ? wp['damage2'] : '') : '';
  const action: Card = {
    attack: kinds,
    ...(m.has('finesse') ? { ability: 'finesse' } : {}),
    damageDice: wuerfel || String(wp['damage'] ?? ''),
    damageType: String(wp['damageType'] ?? ''),
    ...(range ? { range } : {}),
    ...(m.has('reach') ? { reach: 10 } : {}),
  };
  /* Ohne Übung kein Übungsbonus — die Regel, nicht „keine Kachel". */
  const stats = o.proficient ? o.stats : { ...o.stats, prof: zahl(o.stats['prof']) === null ? null : 0 };
  let n = attackNumbers(action, stats);
  if (!n) return null;
  if (o.offHand && n.damageBonus !== null && n.damageBonus > 0) {
    n = { ...n, damageBonus: 0, damage: n.damageDice, average: n.average === null ? null : n.average - (n.damageBonus ?? 0) };
  }
  const add: Record<string, number> = { ...(o.add ?? {}) };
  for (const [k, v] of Object.entries(selfWeaponBonuses(w.item))) add[k] = (add[k] ?? 0) + v;
  const name = w.item.name || String(w.item.components?.['Identity']?.['name'] ?? '') || w.item.id;
  const tile = tileFromAction(o.offHand ? `held:${w.edge}:off` : `held:${w.edge}`, o.offHand ? `${name} (off hand)` : name, o.offHand ? 'Bonus Action' : 'Action', withEffectBonuses(n, add));
  return { ...tile, hint: [beide ? 'two hands' : '', o.proficient ? '' : 'not proficient', tile.hint].filter(Boolean).join(' · ') };
}

/**
 * **Die Kacheln aller Waffen in der Hand**, mit dem Nebenhand-Angriff, wenn
 * beide Hände eine leichte Nahkampfwaffe halten. `proficiencies` sind die
 * Übungen der Figur (`proficienciesOf`): geübt ist, wer die Waffengruppe
 * (`simple`, `martial`) oder die Waffe beim Namen kann.
 */
export function heldWeaponTiles(
  creature: Entity,
  byId: Lookup,
  o: { stats: Card; proficiencies: ProficiencyList; add?: Readonly<Record<string, number>> },
): PlanTile[] {
  const lookup = (id: EntityId) => byId.get(id);
  const waffen = heldWeapons(creature, byId);
  const geuebt = (w: HeldWeapon) => {
    const kat = String((w.item.components?.['Weapon'] ?? {})['category'] ?? '');
    return (!!kat && hasProficiency(o.proficiencies, kat)) || hasProficiency(o.proficiencies, w.item.name ?? '');
  };
  const raus: PlanTile[] = [];
  for (const w of waffen) {
    const t = weaponTile(w, { stats: o.stats, proficient: geuebt(w), lookup, add: o.add });
    if (t) raus.push(t);
  }
  const leicht = (w: HeldWeapon | undefined) =>
    !!w && itemFeaturesOf(w.item, lookup).mechanics.some((x) => x.toLowerCase() === 'light') &&
    String(w.item.components?.['Item']?.['itemType'] ?? '').toLowerCase() !== 'ranged weapon';
  const haupt = waffen.find((w) => w.place === 'mainHand');
  const neben = waffen.find((w) => w.place === 'offHand');
  if (haupt && neben && leicht(haupt) && leicht(neben)) {
    const t = weaponTile(neben, { stats: o.stats, proficient: geuebt(neben), lookup, add: o.add, offHand: true });
    if (t) raus.push(t);
  }
  return raus;
}

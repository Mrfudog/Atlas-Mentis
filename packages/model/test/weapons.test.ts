/**
 * **Waffen in der Hand sind Angriffe** (T-354): aus jeder Waffe in der
 * Hand eine Kachel mit Treffer und Schaden wie jeder Angriff — Übung nur,
 * wenn geübt; Finesse nimmt das bessere von STR und DEX; vielseitig mit
 * zwei Händen der grössere Würfel; die +1 an der Waffe selbst zählt; zwei
 * leichte Waffen geben den Nebenhand-Angriff als Bonusaktion ohne Mod beim
 * Schaden. Erfundene Artikel.
 */
import { describe, expect, it } from 'vitest';
import { heldWeaponTiles, heldWeapons, selfWeaponBonuses, type Entity, type ProficiencyList } from '../src/index.js';

const merkmal = (id: string, name: string, mechanics: string[] = []): Entity => ({ id, name, interfaces: ['ItemFeature'], components: { ItemFeature: { mechanics } }, relations: [] });
const waffe = (id: string, name: string, weapon: Record<string, unknown>, props: string[] = [], extra: Partial<Entity> = {}): Entity => ({
  id, name, interfaces: ['Weapon'],
  components: { Item: { itemType: 'melee weapon' }, Weapon: weapon, ...(extra.components ?? {}) },
  relations: props.map((p, i) => ({ id: `${id}_p${i}`, type: 'hasProperty', to: p, props: p === 'f_vers' ? { damage: '1d10' } : {} })),
});

const finesse = merkmal('f_fin', 'Finesse', ['finesse']);
const leicht = merkmal('f_light', 'Light', ['light']);
const vielseitig = merkmal('f_vers', 'Versatile', ['versatile']);
const langschwert = waffe('w_long', 'Longsword', { category: 'martial', damage: '1d8', damageType: 'slashing' }, ['f_vers']);
const rapier = waffe('w_rap', 'Rapier', { category: 'martial', damage: '1d8', damageType: 'piercing' }, ['f_fin'], {
  components: { Effects: { effects: [{ id: 'plus1', target: 'weapon', op: 'add', value: 1, when: 'self' }] } },
});
const dolch = waffe('w_dag', 'Dagger', { category: 'simple', damage: '1d4', damageType: 'piercing' }, ['f_fin', 'f_light']);
const kurz = waffe('w_short', 'Shortsword', { category: 'martial', damage: '1d6', damageType: 'piercing' }, ['f_fin', 'f_light']);

function figur(halten: { to: string; slot: string; grip?: string }[]) {
  const inv: Entity = {
    id: 'inv', name: 'Pack', interfaces: ['Inventory'], components: {},
    relations: halten.map((h, i) => ({ id: `h${i}`, type: 'holds', to: h.to, props: { slot: h.slot, ...(h.grip ? { grip: h.grip } : {}) } })),
  };
  const pc: Entity = { id: 'pc', name: 'Rook', interfaces: ['PlayerCharacter'], components: {}, relations: [{ id: 'c', type: 'carries', to: 'inv', props: {} }] };
  const byId = new Map([pc, inv, finesse, leicht, vielseitig, langschwert, rapier, dolch, kurz].map((e) => [e.id, e]));
  return { pc, byId };
}

const STATS = { str: 16, dex: 14, prof: 2 };
const geuebt = (namen: string[]): ProficiencyList => ({ entries: namen.map((name) => ({ name, kind: 'proficient' as const, sources: [] })), missing: [] });

describe('T-354: Waffen in der Hand', () => {
  it('nur was in der Hand liegt, und nur Waffen', () => {
    const { pc, byId } = figur([{ to: 'w_long', slot: 'mainHand' }, { to: 'w_dag', slot: 'belt' }]);
    expect(heldWeapons(pc, byId).map((w) => [w.item.id, w.place])).toEqual([['w_long', 'mainHand']]);
  });

  it('Langschwert, geübt: STR + Übung; mit zwei Händen der vielseitige Würfel', () => {
    const eine = figur([{ to: 'w_long', slot: 'mainHand' }]);
    const [t] = heldWeaponTiles(eine.pc, eine.byId, { stats: STATS, proficiencies: geuebt(['martial']) });
    expect(t).toMatchObject({ id: 'held:h0', name: 'Longsword', cost: 'action', group: 'attack', toHit: 5, damage: '1d8 + 3', damageType: 'slashing', range: 5 });
    const zwei = figur([{ to: 'w_long', slot: 'mainHand', grip: 'two' }]);
    const [u] = heldWeaponTiles(zwei.pc, zwei.byId, { stats: STATS, proficiencies: geuebt(['martial']) });
    expect(u).toMatchObject({ damage: '1d10 + 3', hint: 'two hands' });
  });

  it('ohne Übung kein Übungsbonus, aber eine Kachel', () => {
    const { pc, byId } = figur([{ to: 'w_long', slot: 'mainHand' }]);
    const [t] = heldWeaponTiles(pc, byId, { stats: STATS, proficiencies: geuebt([]) });
    expect(t).toMatchObject({ toHit: 3, hint: 'not proficient' });
  });

  it('Finesse nimmt das bessere Attribut; die +1 an der Waffe zählt nur für sie; Wirkungen der Figur dazu', () => {
    const { pc, byId } = figur([{ to: 'w_rap', slot: 'mainHand' }]);
    expect(selfWeaponBonuses(rapier)).toEqual({ weapon: 1 });
    const [t] = heldWeaponTiles(pc, byId, { stats: { str: 8, dex: 18, prof: 3 }, proficiencies: geuebt(['Rapier']), add: { 'weapon.attack': 1 } });
    expect(t).toMatchObject({ toHit: 3 + 4 + 1 + 1, damage: '1d8 + 5' });
  });

  it('zwei leichte Waffen: Nebenhand als Bonusaktion, ohne positiven Mod beim Schaden', () => {
    const { pc, byId } = figur([{ to: 'w_short', slot: 'mainHand' }, { to: 'w_dag', slot: 'offHand' }]);
    const t = heldWeaponTiles(pc, byId, { stats: STATS, proficiencies: geuebt(['simple', 'martial']) });
    expect(t.map((x) => [x.id, x.cost, x.damage])).toEqual([
      ['held:h0', 'action', '1d6 + 3'],
      ['held:h1', 'action', '1d4 + 3'],
      ['held:h1:off', 'bonus', '1d4'],
    ]);
  });

  it('eine schwere Waffe in der Haupthand gibt keinen Nebenhand-Angriff', () => {
    const { pc, byId } = figur([{ to: 'w_long', slot: 'mainHand' }, { to: 'w_dag', slot: 'offHand' }]);
    expect(heldWeaponTiles(pc, byId, { stats: STATS, proficiencies: geuebt(['simple', 'martial']) }).some((x) => x.id.endsWith(':off'))).toBe(false);
  });
});

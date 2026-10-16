import { describe, expect, it } from 'vitest';
import {
  applyDamage,
  applyHeal,
  castBlock,
  concentrationDc,
  filterTurn,
  grantTemp,
  gripDamage,
  groupTurn,
  handState,
  lockOf,
  RULE_ACTIONS,
  toggleUsed,
  turnCounts,
  turnSources,
  turnTypeOf,
  wheelAmount,
  sheetHeader,
  pipToggle,
  setSlotsUsed,
  type Entity,
  type Registry,
  type HeldItem,
  type TurnAction,
} from '../src/index.js';

const waffe = (id: string, slot: HeldItem['slot'], properties: string[] = [], mehr: Partial<HeldItem> = {}): HeldItem => ({
  id, name: id, slot, properties, ...mehr,
});

describe('hit points at the table (T-247)', () => {
  it('takes damage from temporary hit points first', () => {
    expect(applyDamage({ hp: 18, temp: 3 }, 5)).toEqual({ hp: 16, temp: 0, fromTemp: 3, taken: 5 });
    expect(applyDamage({ hp: 18, temp: 6 }, 4)).toEqual({ hp: 18, temp: 2, fromTemp: 4, taken: 4 });
  });
  it('never drops below zero and ignores nonsense', () => {
    expect(applyDamage({ hp: 3, temp: 0 }, 10).hp).toBe(0);
    expect(applyDamage({ hp: 3, temp: 0 }, Number.NaN).hp).toBe(3);
  });
  it('heals up to the maximum, or without a cap when none is known', () => {
    expect(applyHeal({ hp: 18, temp: 2 }, 10, 22)).toEqual({ hp: 22, temp: 2 });
    expect(applyHeal({ hp: 18, temp: 0 }, 10, null).hp).toBe(28);
  });
  it('keeps the higher temporary value instead of adding', () => {
    expect(grantTemp({ hp: 10, temp: 5 }, 3).temp).toBe(5);
    expect(grantTemp({ hp: 10, temp: 2 }, 3).temp).toBe(3);
  });
  it('steps the amount with the wheel, never below 1', () => {
    expect(wheelAmount(4, -100)).toBe(5);
    expect(wheelAmount(1, 100)).toBe(1);
  });
  it('asks for DC 10 or half the damage', () => {
    expect(concentrationDc(4)).toBe(10);
    expect(concentrationDc(25)).toBe(12);
  });
});

describe('hands and what they block (T-247, T-244)', () => {
  it('keeps casting open with a free hand', () => {
    const h = handState([waffe('rapier', 'mainHand', ['finesse'])]);
    expect(h.freeHand).toBe(true);
    expect(castBlock(h)).toBe('');
  });
  it('blocks somatic spells with both hands full, but not a verbal-only one', () => {
    const h = handState([waffe('rapier', 'mainHand'), waffe('dagger', 'offHand', ['light'])]);
    expect(castBlock(h, { somatic: true })).toMatch(/no free hand/);
    expect(castBlock(h, {})).toBe('');
  });
  it('lets a focus in hand do the work of a free hand', () => {
    const h = handState([waffe('rapier', 'mainHand'), waffe('staff', 'offHand', [], { focus: true })]);
    expect(castBlock(h, { somatic: true, material: true })).toBe('');
  });
  it('lets a two-handed weapon fill both hands', () => {
    const h = handState([waffe('greatsword', 'mainHand', ['two-handed'])]);
    expect(h.both).toBe(true);
    expect(h.freeHand).toBe(false);
  });
  it('blocks every spell behind a shield without training', () => {
    const h = handState([waffe('shield', 'offHand', [], { shield: true, proficient: false })]);
    expect(h.shieldUntrained).toBe(true);
    expect(castBlock(h, {})).toMatch(/shield without training/);
  });
  it('picks the two-handed die for a versatile weapon held in both hands', () => {
    const ls = waffe('longsword', 'both', ['versatile'], { damage: '1d8', damage2: '1d10' });
    expect(gripDamage(ls, true)).toBe('1d10');
    expect(gripDamage(ls, false)).toBe('1d8');
  });
  it('locks the off-hand attack without a light weapon there', () => {
    const off = RULE_ACTIONS.find((a) => a.id === 'rule:offhand')!;
    expect(lockOf(off, handState([]))).toMatch(/light weapon/);
    expect(lockOf(off, handState([waffe('dagger', 'offHand', ['Light'])]))).toBe('');
  });
});

describe('your turn as one list (T-247)', () => {
  const zauber: TurnAction = { id: 's1', name: 'Spell', type: 'action', source: 'spells', sourceLabel: 'Spells', needs: 'cast', components: { somatic: true } };
  const alle = [...RULE_ACTIONS, zauber];
  it('reads the action type from the name of its article', () => {
    expect(turnTypeOf('Bonus Action')).toBe('bonus');
    expect(turnTypeOf('Reaction')).toBe('reaction');
    expect(turnTypeOf('Action')).toBe('action');
    expect(turnTypeOf('minute')).toBeNull();
  });
  it('counts by type after the source filter', () => {
    const c = turnCounts(alle, new Set(['rules']));
    expect(c.all).toBe(1);
    expect(c.action).toBe(1);
    expect(c.bonus).toBe(0);
  });
  it('lists sources with their counts and filters by source and type', () => {
    expect(turnSources(alle).map((q) => q.id)).toEqual(['rules', 'spells']);
    expect(filterTurn(alle, new Set(), 'reaction').map((a) => a.id)).toEqual(['rule:opportunity']);
  });
  it('groups in the order Action, Bonus, Reaction, Free, Trigger', () => {
    expect(groupTurn(alle).map((g) => g.type)).toEqual(['action', 'bonus', 'reaction', 'free', 'trigger']);
  });
  it('marks only action, bonus and reaction as used', () => {
    expect(toggleUsed([], 'bonus')).toEqual(['bonus']);
    expect(toggleUsed(['bonus'], 'bonus')).toEqual([]);
    expect(toggleUsed([], 'free')).toEqual([]);
  });
});

describe('the sheet header (T-247)', () => {
  const reg = {
    interfaces: {
      PlayerCharacter: { name: 'PlayerCharacter', schema: { type: 'object', properties: { proficiency: { type: 'number', derived: '2+(sum(hasClass.level)-1)/4' } } } },
      Statblock: {
        name: 'Statblock',
        schema: { type: 'object', properties: { spellDc: { type: 'number', derived: '8+prof+modOf(spellAbility)' }, spellAttack: { type: 'number', derived: 'prof+modOf(spellAbility)' } } },
      },
    },
    relations: {},
    units: {},
    settings: {},
  } as unknown as Registry;
  const klasse: Entity = { id: 'k', interfaces: ['Class'], name: 'K', components: { Class: { hitDie: 8 } }, relations: [] };
  const figur: Entity = {
    id: 'pc', interfaces: ['PlayerCharacter'], name: 'Pc',
    components: { Vitals: { hp: 15, hpTemp: 2, hitDiceLeft: 2, slotsUsed: [1], inspiration: true } },
    relations: [{ id: 'r1', type: 'hasClass', from: 'pc', to: 'k', props: { level: 3 } }],
  };
  const sb: Entity = {
    id: 'sb', interfaces: ['Statblock'], name: 'Sb',
    components: {
      Statblock: { ac: 15, hp: 22, prof: 2, spellAbility: 'int', spellSlots: [2] },
      Abilities: { str: 8, dex: 18, con: 12, int: 14, wis: 10, cha: 14 },
      Proficiencies: { saves: ['dex', 'int'] },
    },
    relations: [],
  };
  it('reads numbers from the statblock and the state from the character', () => {
    const k = sheetHeader(reg, figur, sb, new Map([['k', klasse]]));
    expect([k.hp, k.max, k.temp]).toEqual([15, 22, 2]);
    expect(k.hitDice).toEqual({ die: 'd8', max: 3, left: 2 });
    expect(k.slots).toEqual([{ level: 1, max: 2, used: 1 }]);
    expect(k.inspiration).toBe(true);
    const dex = k.abilities.find((a) => a.key === 'dex')!;
    expect([dex.mod, dex.save, dex.saveProficient]).toEqual([4, 6, true]);
    expect(k.abilities.find((a) => a.key === 'str')!.save).toBe(-1);
  });
  it('computes the spellcasting slide', () => {
    const k = sheetHeader(reg, figur, sb, new Map([['k', klasse]]), { spells: [{ id: 'a', level: 0, mode: 'known' }, { id: 'b', level: 1, mode: 'known' }] });
    const c = Object.fromEntries((k.casting ?? []).map((x) => [x.key, x.value]));
    expect(c).toMatchObject({ ability: 'INT', attack: '+4', dc: '12', slots1: '1 / 2', cantrips: '1', known: '1' });
  });
  it('shows the state without a statblock and no casting slide', () => {
    const k = sheetHeader(reg, figur, undefined, new Map());
    expect(k.hp).toBe(15);
    expect(k.casting).toBeNull();
  });
  it('toggles pips by count and writes slots per level', () => {
    expect(pipToggle(1, 0)).toBe(0);
    expect(pipToggle(1, 1)).toBe(2);
    expect(setSlotsUsed(undefined, 2, 1)).toEqual([0, 1]);
  });
});

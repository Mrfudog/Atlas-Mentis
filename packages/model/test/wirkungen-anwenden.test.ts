/**
 * **Gesammelte Wirkungen wirken** (T-355, Punkt 3 und 4): `save`,
 * `save.<attr>`, `spellSaveDc`, `spellAttack`, `check` am Bogen;
 * `spellAttack`, `spellDamage`, `weapon.*` in den Kacheln des Zugplans;
 * Unarmored Defense als RK-Basis (`ac.base`, `ac.base.noShield`).
 * Die Wirkungen kommen hier von einem Zustand an der Figur — derselbe Weg
 * wie ein Merkmal oder ein Ring (`effectsAt`). Erfundene Artikel.
 */
import { describe, expect, it } from 'vitest';
import { creatureStats, sheetHeader, tilesFor, type Entity, type Registry } from '../src/index.js';

const reg = {
  interfaces: {
    Statblock: {
      name: 'Statblock',
      schema: { type: 'object', properties: { spellDc: { type: 'number', derived: '8+prof+modOf(spellAbility)' }, spellAttack: { type: 'number', derived: 'prof+modOf(spellAbility)' } } },
    },
  },
  relations: {},
  units: {},
  settings: {},
} as unknown as Registry;

const segen = (effects: object[]): Entity => ({ id: 'cd', interfaces: ['Condition'], name: 'Blessed', components: { Effects: { effects } }, relations: [] });
const figur = (mehr: Record<string, unknown> = {}): Entity => ({
  id: 'pc', interfaces: ['PlayerCharacter'], name: 'Pc', components: { Vitals: { hp: 10, conditions: ['cd'] }, ...mehr }, relations: [],
});
const sb = (mehr: Record<string, unknown> = {}): Entity => ({
  id: 'sb', interfaces: ['Statblock'], name: 'Sb',
  components: {
    Statblock: { hp: 22, prof: 2, spellAbility: 'int', ...mehr },
    Abilities: { str: 8, dex: 14, con: 16, int: 14, wis: 12, cha: 10 },
    Proficiencies: { saves: ['dex'], proficient: ['Perception'] },
  },
  relations: [{ id: 'b', type: 'belongsTo', to: 'pc', props: {} }],
});

describe('T-355 Punkt 3: Rettungswürfe, Zauber-SG und Proben am Bogen', () => {
  const wirk = segen([
    { id: 's', target: 'save', op: 'add', value: 1 },
    { id: 'sd', target: 'save.dex', op: 'add', value: 2 },
    { id: 'dc', target: 'spellSaveDc', op: 'add', value: 1 },
    { id: 'at', target: 'spellAttack', op: 'add', value: 2 },
    { id: 'c', target: 'check', op: 'add', value: 1 },
  ]);
  const k = sheetHeader(reg, figur(), sb(), new Map([['cd', wirk], ['pc', figur()]]));

  it('jeder Rettungswurf mit `save`, die DEX dazu mit `save.dex`', () => {
    const save = Object.fromEntries(k.abilities.map((a) => [a.key, a.save]));
    /* DEX +2, geübt +2, save +1, save.dex +2; STR −1 + 1. */
    expect(save).toMatchObject({ dex: 7, str: 0 });
  });

  it('Zauber-SG und Zauberangriff mit ihren Wirkungen', () => {
    const c = Object.fromEntries((k.casting ?? []).map((x) => [x.key, x.value]));
    /* 8 + 2 + 2 = 12, +1; Angriff 2 + 2 = 4, +2. */
    expect(c).toMatchObject({ dc: '13', attack: '+6' });
  });

  it('die passive Wahrnehmung zählt `check` mit', () => {
    /* 10 + WIS +1 + geübt 2 + check 1 */
    expect(k.vitals.find((v) => v.key === 'passive')?.value).toBe('14');
  });
});

describe('T-355 Punkt 3: Kacheln des Zugplans', () => {
  const stats = { str: 8, dex: 14, int: 14, prof: 2 };
  const zauber = { id: 'fb', name: 'Fire Bolt', actionTypeName: 'Action', action: { attack: ['ranged spell'], ability: 'int', damageDice: '1d10', damageType: 'fire', range: '120' } };
  const bogen = { id: 'sbw', name: 'Shortbow', actionTypeName: 'Action', action: { attack: ['ranged weapon'], ability: 'dex', damageDice: '1d6', damageType: 'piercing', range: '80/320' } };

  it('ohne Wirkungen wie bisher', () => {
    const [z, b] = tilesFor(stats, [zauber, bogen]);
    expect([z!.toHit, z!.damage, b!.toHit, b!.damage]).toEqual([4, '1d10 + 2', 4, '1d6 + 2']);
  });

  it('spellAttack und spellDamage am Zauber, weapon.* an der Waffe', () => {
    const add = { spellAttack: 1, spellDamage: 3, 'weapon.attack': 2, 'weapon.damage': 1, weapon: 1 };
    const [z, b] = tilesFor(stats, [zauber, bogen], add);
    expect([z!.toHit, z!.damage, z!.average]).toEqual([5, '1d10 + 5', 10]);
    expect([b!.toHit, b!.damage, b!.average]).toEqual([7, '1d6 + 4', 7]);
  });
});

describe('T-355 Punkt 4: Unarmored Defense als RK-Basis', () => {
  const barbar = segen([{ id: 'ud', target: 'ac.base', op: 'set', value: '10 + mod(dex) + mod(con)' }]);
  const moench = segen([{ id: 'ud', target: 'ac.base.noShield', op: 'set', value: '10+mod(dex)+mod(wis)' }]);
  const schild: Entity = { id: 'sh', interfaces: ['Armor'], name: 'Shield', components: { Armor: { armorType: 'shield', ac: 2 } }, relations: [] };
  const leder: Entity = { id: 'la', interfaces: ['Armor'], name: 'Scale mail', components: { Armor: { armorType: 'medium', ac: 14 } }, relations: [] };
  /* Getragen heisst: im Inventar der Figur, `tier: worn`. */
  const rk = (wirk: Entity, halten: string[] = []) => {
    const f = { ...figur(), relations: [{ id: 'ca', type: 'carries', to: 'inv', props: {} }] };
    const inv: Entity = { id: 'inv', interfaces: ['Inventory'], name: 'Pack', components: {}, relations: halten.map((id) => ({ id: `h-${id}`, type: 'holds', to: id, props: { tier: 'worn' } })) };
    const alle = new Map([wirk, schild, leder, inv, sb(), f].map((e) => [e.id, e]));
    return creatureStats(f, alle).ac;
  };

  it('Barbar: 10 + DEX + CON ohne Rüstung, mit Schild dazu', () => {
    expect(rk(barbar).value).toBe(15);
    expect(rk(barbar).parts[0]).toMatchObject({ kind: 'base', value: 15, source: 'cd', note: 'unarmored defense' });
    expect(rk(barbar, ['sh']).value).toBe(17);
  });

  it('mit Rüstung gilt die Rüstung', () => {
    expect(rk(barbar, ['la']).value).toBe(16);
  });

  it('Mönch: ohne Schild 10 + DEX + WIS, mit Schild nicht', () => {
    expect(rk(moench).value).toBe(13);
    expect(rk(moench, ['sh']).value).toBe(14);
  });
});

import { describe, expect, it } from 'vitest';
import { derivedValue, fieldsOf, relationAccepts, typeChain, validateEntity } from '@nw/model';
import type { Entity } from '@nw/model';
import { seedRegistry } from '../src/index.js';

/**
 * P3 (M2, M4): Zauber, wer sie wirkt, und was ein Gegenstand trägt.
 *
 * Die zwei Artikel unten sind „Fireball" (PHB) und „Wand of Magic
 * Missiles" (DMG) aus 5e.tools, in unsere Form gebracht — so, wie der
 * Importer (P5) sie schreiben soll. Steht hier etwas, das die Prüfung
 * ablehnt, kann der Importer es auch nicht schreiben.
 */

const aktion: Entity = {
  id: 'actiontype-0001',
  interfaces: ['ActionType'],
  name: 'Action',
  components: { Identity: { name: 'Action', id: 'actiontype-0001' } },
};

const feuerball: Entity = {
  id: 'spell-0001',
  interfaces: ['Spell'],
  name: 'Fireball',
  components: {
    Identity: { name: 'Fireball', id: 'spell-0001' },
    Spell: {
      level: 3,
      school: 'evocation',
      castingTime: 1,
      castingAction: 'actiontype-0001',
      rangeKind: 'point',
      range: 150,
      components: ['v', 's', 'm'],
      material: 'a tiny ball of bat guano and sulfur',
      duration: 'instant',
      higherLevels:
        'When you cast this spell using a spell slot of 4th level or higher, the damage '
        + 'increases by {{1d6}} for each slot level above 3rd.',
      save: ['dex'],
      damageTypes: ['fire'],
    },
    Source: { publication: 'PHB', page: '241', srd: true },
  },
};

const zauberstab: Entity = {
  id: 'item-0001',
  interfaces: ['Item'],
  name: 'Wand of Magic Missiles',
  components: {
    Identity: { name: 'Wand of Magic Missiles', id: 'item-0001' },
    Item: {
      itemType: 'wand',
      tier: 'major',
      rarity: 'uncommon',
      weight: 1,
      charges: 7,
      recharge: 'dawn',
      rechargeAmount: '1d6+1',
    },
    Source: { publication: 'DMG', page: '211', srd: true },
  },
  /* `attachedSpells.charges` wird eine Kante mit dem Preis je Wirken. */
  relations: [
    { type: 'casts', to: 'spell-0002', props: { mode: 'item', charges: 1, level: 1 } },
  ],
};

/* Was es gibt, und als was; „Magic Missile" (`spell-0002`) steht nur als
   Ziel der Kante da. */
const bekannt = new Map<string, string>([
  ...[aktion, feuerball, zauberstab].map((e) => [e.id, e.interfaces[0]!] as [string, string]),
  ['spell-0002', 'Spell'],
]);

describe('a spell is a rule with its own fields (M2)', () => {
  it('sits below Rule, in the rules area', () => {
    expect(typeChain(seedRegistry, 'Spell')).toContain('Rule');
    expect(seedRegistry.interfaces['Spell']?.area).toBe('rules');
  });

  it('takes Fireball as 5e.tools writes it, and nothing is refused', () => {
    expect(validateEntity(seedRegistry, feuerball, { knownTypes: bekannt })).toEqual([]);
  });

  /* Die Wirkzeit nennt die Aktionsart aus P2 und kein Wort: „1 action",
     „1 bonus action" und `Action.actionType` wären sonst drei Schreibweisen. */
  it('names the action type it is cast as, and refuses anything else there', () => {
    const p = fieldsOf(seedRegistry, 'Spell').find((f) => f.key === 'castingAction');
    expect(p?.prop.target?.interfaces).toEqual(['ActionType']);
    const falsch = structuredClone(feuerball);
    (falsch.components!['Spell'] as Record<string, unknown>)['castingAction'] = 'item-0001';
    const codes = validateEntity(seedRegistry, falsch, { knownTypes: bekannt }).map((i) => i.code);
    expect(codes).toContain('link_wrong_type');
  });

  it('holds the level to 0–9 and the components to v, s, m', () => {
    const falsch = structuredClone(feuerball);
    const karte = falsch.components!['Spell'] as Record<string, unknown>;
    karte['level'] = 10;
    karte['components'] = ['v', 'x'];
    const codes = validateEntity(seedRegistry, falsch).map((i) => i.code);
    expect(codes).toContain('value_out_of_range');
    expect(codes).toContain('value_not_allowed');
  });

  /* Welche Zustände ein Zauber bewirkt, sagt `affects` (D49), kein Feld. */
  it('has no condition field next to the affects edge', () => {
    expect(fieldsOf(seedRegistry, 'Spell').map((f) => f.key)).not.toContain('conditions');
    expect(relationAccepts(seedRegistry.relations['affects']!, 'Spell', 'Condition', seedRegistry)).toBe(true);
  });
});

describe('who casts a spell is an edge (M2)', () => {
  const casts = seedRegistry.relations['casts']!;

  it('goes from a statblock, a player character or an item to a spell', () => {
    expect(casts.from).toEqual(['Statblock', 'PlayerCharacter', 'Item']);
    expect(relationAccepts(casts, 'Statblock', 'Spell', seedRegistry)).toBe(true);
    expect(relationAccepts(casts, 'Statblock', 'Feature', seedRegistry)).toBe(false);
    expect(Object.keys(casts.props?.properties ?? {})).toEqual(['mode', 'uses', 'level', 'charges']);
  });

  it('is stored forward only, and is not a field at either end', () => {
    expect(casts.asField).toBeUndefined();
    expect(casts.section).toBeUndefined();
  });
});

describe('spellcasting on the statblock (M2)', () => {
  const dc = fieldsOf(seedRegistry, 'Statblock').find((f) => f.key === 'spellDc');
  const atk = fieldsOf(seedRegistry, 'Statblock').find((f) => f.key === 'spellAttack');

  it('declares ability, level and slots, and calculates DC and attack (D8)', () => {
    const eigen = fieldsOf(seedRegistry, 'Statblock')
      .filter((f) => f.type === 'Statblock')
      .map((f) => f.key);
    expect(eigen).toEqual(expect.arrayContaining(['spellAbility', 'casterLevel', 'spellSlots', 'spellDc', 'spellAttack']));
    expect(dc?.prop.derived).toBe('8+prof+modOf(spellAbility)');
    expect(atk?.prop.derived).toBe('prof+modOf(spellAbility)');
  });

  /* Der Magier aus dem Monster Manual: INT 17, Übung +3 → SG 14, +6. */
  it('reads the proficiency from its own card and the score from Abilities', () => {
    const statblock = { prof: 3, spellAbility: 'int', casterLevel: 9, spellSlots: [4, 3, 3, 3, 1] };
    const karten = { Statblock: statblock, Abilities: { int: 17 } };
    expect(derivedValue(dc!.prop, statblock, karten)).toBe(14);
    expect(derivedValue(atk!.prop, statblock, karten)).toBe(6);
  });

  it('keeps what is used at the table on the state, not on the statblock', () => {
    expect(fieldsOf(seedRegistry, 'Creature').find((f) => f.key === 'slotsUsed')?.type).toBe('Vitals');
  });
});

describe('an item grows (M4)', () => {
  it('takes the wand as 5e.tools writes it, edge included', () => {
    expect(validateEntity(seedRegistry, zauberstab, { knownTypes: bekannt })).toEqual([]);
  });

  /* E3: englisch wie das Original; `none` für das Seil, das nicht magisch ist. */
  it('spells rarity and item type in English, and refuses the old words', () => {
    const falsch = structuredClone(zauberstab);
    (falsch.components!['Item'] as Record<string, unknown>)['rarity'] = 'selten';
    (falsch.components!['Item'] as Record<string, unknown>)['itemType'] = 'Trank';
    const wo = validateEntity(seedRegistry, falsch)
      .filter((i) => i.code === 'value_not_allowed')
      .map((i) => i.property);
    expect(wo.sort()).toEqual(['itemType', 'rarity']);
  });

  it('gives weapons and armour what the base items carry', () => {
    const waffe = fieldsOf(seedRegistry, 'Weapon').map((f) => f.key);
    expect(waffe).toEqual(expect.arrayContaining(['category', 'damage2', 'ammoType']));
    const ruestung = fieldsOf(seedRegistry, 'Armor').map((f) => f.key);
    expect(ruestung).toEqual(expect.arrayContaining(['armorType', 'strength', 'stealthDisadvantage']));
  });

  it('may be a container, and an item at the table may be an instance of one in the book', () => {
    expect(relationAccepts(seedRegistry.relations['carries']!, 'Item', 'Inventory', seedRegistry)).toBe(true);
    const inst = seedRegistry.relations['instanceOf']!;
    expect(relationAccepts(inst, 'Weapon', 'Weapon', seedRegistry)).toBe(true);
    expect(relationAccepts(inst, 'Statblock', 'Item', seedRegistry)).toBe(false);
  });
});

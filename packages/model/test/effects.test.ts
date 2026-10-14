import { describe, expect, it } from 'vitest';
import {
  abilityWithEffects,
  effectId,
  effectText,
  effectTotals,
  effectsAt,
  effectsOf,
  storedEffects,
  type Entity,
} from '../src/index.js';

const art = (id: string, typ: string, components: Entity['components'] = {}, relations: Entity['relations'] = []): Entity => ({
  id, interfaces: [typ], name: id, components, relations,
});

const handschuhe = art('item-1', 'Item', {
  Item: { attunement: true },
  Effects: { effects: [{ id: 'ability-str', target: 'ability.str', op: 'set', value: 19 }] },
});
const ring = art('item-2', 'Item', {
  Effects: { effects: [{ id: 'resist-fire', target: 'resist', op: 'grant', value: 'fire' }] },
});
const schild = art('item-3', 'Armor', { Item: { bonusAc: 1 }, Armor: { ac: 2, armorType: 'shield' } });
const stein = art('item-4', 'Item', {
  Effects: { effects: [{ id: 'speed-walk', target: 'speed.walk', op: 'add', value: 10, when: 'carried' }] },
});
const beutel = art('item-5', 'Item', {}, [{ id: 'c', type: 'carries', to: 'inv-2' }]);
const imBeutel = art('inv-2', 'Inventory', {}, [{ id: 'h', type: 'holds', to: 'item-4' }]);
const zwerg = art('ancestry-1', 'Ancestry', {
  Effects: { effects: [{ id: 'resist-poison', target: 'resist', op: 'grant', value: 'poison' }] },
});

const figur = (): Entity => art('pc-1', 'PlayerCharacter', {}, [
  { id: 'r1', type: 'carries', to: 'inv-1' },
  { id: 'r2', type: 'hasAncestry', to: 'ancestry-1' },
]);
const inventar = (holds: [string, Record<string, unknown>][]) =>
  art('inv-1', 'Inventory', {}, holds.map(([to, props], i) => ({ id: `h${i}`, type: 'holds', to, props })));

const bestand = (holds: [string, Record<string, unknown>][]) =>
  new Map([handschuhe, ring, schild, stein, beutel, imBeutel, zwerg, inventar(holds), figur()].map((e) => [e.id, e]));

const am = (holds: [string, Record<string, unknown>][]) => {
  const b = bestand(holds);
  return effectsAt(b.get('pc-1')!, b);
};

describe('effects as a field (REQ-238, E-025 a)', () => {
  it('counts gauntlets only while attuned and worn, and a set score only when it is higher', () => {
    expect(am([['item-1', { tier: 'worn' }]]).map((x) => x.source)).toEqual(['ancestry-1']);
    expect(am([['item-1', { tier: 'pack', attuned: true }]]).map((x) => x.source)).toEqual(['ancestry-1']);
    const t = effectTotals(am([['item-1', { tier: 'worn', attuned: true }]]));
    expect(abilityWithEffects(10, 'str', t)).toBe(19);
    expect(abilityWithEffects(18, 'str', t, 2)).toBe(20);
    expect(abilityWithEffects(12, 'dex', t)).toBe(12);
  });

  it('takes a ring on a body slot as worn, and nothing from home or the ground', () => {
    expect(effectTotals(am([['item-2', { slot: 'ringR1', tier: 'worn' }]])).grants).toEqual({ resist: ['fire', 'poison'] });
    expect(effectTotals(am([['item-2', { tier: 'stored', slot: 'ringR1' }]])).grants).toEqual({ resist: ['poison'] });
  });

  it('reads the old bonus fields as effects, and a carried effect from inside a bag', () => {
    expect(effectsOf(schild)).toEqual([{ id: 'bonusAc', target: 'ac', op: 'add', value: 1 }]);
    expect(storedEffects(schild)).toEqual([]);
    const t = effectTotals(am([['item-3', { tier: 'held' }], ['item-5', { tier: 'worn' }]]));
    expect(t.add).toEqual({ ac: 1, 'speed.walk': 10 });
    expect(effectTotals(am([['item-5', { tier: 'stored' }]])).add).toEqual({});
  });

  it('keeps the lowest critical threshold and a word for a speed', () => {
    const t = effectTotals([
      { effect: { id: 'a', target: 'critThreshold', op: 'set', value: 19 }, source: 'x', via: 'holds' },
      { effect: { id: 'b', target: 'critThreshold', op: 'set', value: 18 }, source: 'y', via: 'holds' },
      { effect: { id: 'c', target: 'speed.fly', op: 'set', value: 'walk' }, source: 'y', via: 'holds' },
    ]);
    expect(t.set).toEqual({ critThreshold: 18, 'speed.fly': 'walk' });
  });

  it('writes an effect as a sentence and an id from the text', () => {
    expect(effectText({ id: 'x', target: 'ability.str', op: 'set', value: 19 })).toBe('Strength becomes 19');
    expect(effectText({ id: 'x', target: 'ac', op: 'add', value: 1 })).toBe('+1 AC');
    expect(effectText({ id: 'x', target: 'resist', op: 'grant', value: 'fire', when: 'attuned' })).toBe('resistance to fire (while attuned)');
    expect(effectText({ id: 'x', target: 'speed.fly', op: 'set', value: 'walk' })).toBe('flying speed equal to walking speed');
    expect(effectText({ id: 'x', target: 'critThreshold', op: 'set', value: 19 })).toBe('critical hit on 19–20');
    expect(effectId('speed.*', 5, ['speed-all'])).toBe('speed-all-2');
    expect(effectId('resist', 'fire')).toBe('resist-fire');
  });
});

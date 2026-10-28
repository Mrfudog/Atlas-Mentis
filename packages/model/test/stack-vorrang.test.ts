/** Vorrang je Artikel oder Art an der Kampagne (T-403, E-111 a): die Kante `prefers`. */
import { describe, expect, it } from 'vitest';
import { PREFERS_RELATION, playStack, preferencesOf, withPreference } from '../src/stack.js';
import type { Entity } from '../src/types.js';

const ebene = (id: string): Entity => ({ id, interfaces: ['Layer'], components: { Identity: { name: id } }, relations: [] }) as Entity;
const art = (id: string, type: string, layer: string, extra: Entity['relations'] = []): Entity =>
  ({
    id,
    interfaces: [type],
    components: { Identity: { name: id } },
    relations: [{ id: `${id}~l`, type: 'inLayer', to: layer, props: {} }, ...(extra ?? [])],
  }) as Entity;

function aufbau(prefers: Entity['relations'] = []) {
  const kampagne = {
    id: 'camp',
    interfaces: ['Campaign'],
    components: { Identity: { name: 'Camp' } },
    relations: [
      { id: 'a1', type: 'activates', to: 'ly_14', props: { order: 10 } },
      { id: 'a2', type: 'activates', to: 'ly_24', props: { order: 20 } },
      { id: 'a3', type: 'activates', to: 'ly_hb', props: { order: 30 } },
      ...(prefers ?? []),
    ],
  } as Entity;
  const es = [
    kampagne,
    ebene('ly_14'),
    ebene('ly_24'),
    ebene('ly_hb'),
    ebene('ly_aus'),
    art('d14', 'Weapon', 'ly_14'),
    art('d24', 'Weapon', 'ly_24', [{ id: 'v', type: 'variantOf', to: 'd14', props: {} }]),
    art('ort14', 'Place', 'ly_14'),
    art('hb', 'Weapon', 'ly_hb'),
    art('aus', 'Weapon', 'ly_aus'),
  ];
  const map = new Map(es.map((e) => [e.id, e]));
  return { map, kampagne, stapel: playStack(map, kampagne) };
}

describe('prefers (T-403)', () => {
  it('without a preference, the higher layer ranks higher', () => {
    const { map, stapel } = aufbau();
    expect(stapel.rank(map.get('d24')!)).toBeGreaterThan(stapel.rank(map.get('d14')!));
  });

  it('a preferred article ranks above every layer, or just above `over`', () => {
    const a = aufbau([{ id: 'p', type: PREFERS_RELATION, to: 'd14', props: {} }]);
    expect(a.stapel.rank(a.map.get('d14')!)).toBeGreaterThan(a.stapel.rank(a.map.get('hb')!));
    const b = aufbau([{ id: 'p', type: PREFERS_RELATION, to: 'd14', props: { over: 'd24' } }]);
    const r = b.stapel.rank(b.map.get('d14')!);
    expect(r).toBeGreaterThan(b.stapel.rank(b.map.get('d24')!));
    expect(r).toBeLessThan(b.stapel.rank(b.map.get('hb')!));
  });

  it('a layer preferred for a type lifts only articles of that type', () => {
    const { map, stapel } = aufbau([{ id: 'p', type: PREFERS_RELATION, to: 'ly_14', props: { types: ['Weapon'], over: 'ly_24' } }]);
    expect(stapel.rank(map.get('d14')!)).toBeGreaterThan(stapel.rank(map.get('d24')!));
    expect(stapel.rank(map.get('ort14')!)).toBe(1);
  });

  it('an article preference beats a type preference', () => {
    const { map, stapel } = aufbau([
      { id: 'p1', type: PREFERS_RELATION, to: 'ly_14', props: { types: ['Weapon'] } },
      { id: 'p2', type: PREFERS_RELATION, to: 'd24', props: {} },
    ]);
    expect(stapel.rank(map.get('d24')!)).toBeGreaterThan(stapel.rank(map.get('d14')!));
  });

  it('never brings an article into play', () => {
    const { map, stapel } = aufbau([{ id: 'p', type: PREFERS_RELATION, to: 'aus', props: {} }]);
    expect(stapel.rank(map.get('aus')!)).toBe(0);
    expect(stapel.inPlay(map.get('aus')!)).toBe(false);
  });
});

describe('withPreference / preferencesOf', () => {
  it('sets, merges types and removes a preference', () => {
    const { kampagne } = aufbau();
    let k = withPreference(kampagne, 'd14', { over: 'd24' });
    expect(preferencesOf(k)).toEqual([{ to: 'd14', over: 'd24', types: [] }]);
    k = withPreference(k, 'ly_14', { types: ['Weapon'] });
    k = withPreference(k, 'ly_14', { types: ['Armor'] });
    expect(preferencesOf(k).find((p) => p.to === 'ly_14')?.types).toEqual(['Weapon', 'Armor']);
    k = withPreference(k, 'ly_14', null, 'Weapon');
    expect(preferencesOf(k).find((p) => p.to === 'ly_14')?.types).toEqual(['Armor']);
    k = withPreference(k, 'ly_14', null, 'Armor');
    k = withPreference(k, 'd14', null);
    expect(preferencesOf(k)).toEqual([]);
    expect(k.relations?.filter((r) => r.type === 'activates')).toHaveLength(3);
  });
});

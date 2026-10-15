import { describe, expect, it } from 'vitest';
import {
  enabledArticles,
  inPlay,
  inStack,
  layerRules,
  playStack,
  resolveArticle,
  resolvedEntries,
  ruleFor,
  shownLayers,
  withEnabled,
  withExempt,
  withRule,
  withStack,
} from '../src/stack.js';
import type { Entity, EntityId } from '../src/types.js';

/* T-187: Typ-Regeln über viele Quellen und einzeln freigegebene Artikel.
   Zwei Abenteuer in der Gruppe „Adventures" (die selbst in „Official"
   steht), ein Grundregelwerk, ein drittes Abenteuer zum Vergleich. */
const registry = {
  interfaces: {
    Place: { area: 'world' },
    Item: { area: 'rules' },
    Spell: { area: 'rules' },
    Rule: { area: 'rules' },
    Scene: { area: 'story' },
    Layer: {},
  },
} as never;
const A = (id: string, type: string, layer: string, more: Entity['relations'] = []): Entity => ({
  id, name: id, interfaces: [type], relations: [{ id: `${id}~l`, type: 'inLayer', to: layer }, ...more],
});
const L = (id: string, kind: string, partOf: string[] = []): Entity => ({
  id, name: id, interfaces: ['Layer'], components: { Layer: { kind } },
  relations: partOf.map((to, i) => ({ id: `${id}~p${i}`, type: 'partOf', to })),
});
const basis: Entity[] = [
  L('g_off', 'group'),
  L('g_adv', 'group', ['g_off']),
  L('adv1', 'adventure', ['g_adv']),
  L('adv2', 'adventure', ['g_adv']),
  L('adv3', 'adventure', ['g_adv']),
  L('phb', 'book', ['g_off']),
  A('ort1', 'Place', 'adv1'),
  A('szene1', 'Scene', 'adv1'),
  A('item1', 'Item', 'adv1'),
  A('spell2', 'Spell', 'adv2'),
  A('ort2', 'Place', 'adv2'),
  A('regel', 'Rule', 'phb'),
  A('item3', 'Item', 'adv3'),
  A('ort3', 'Place', 'adv3'),
  /* Eine Fassung der Grundregel im Vergleichsabenteuer. */
  A('regel3', 'Rule', 'adv3', [{ id: 'r3~o', type: 'overrides', to: 'regel' }]),
  /* Das Grundregelwerk nimmt einen Ort aus adv3 heraus. */
  A('weg3', 'Place', 'adv3', [{ id: 'w3~r', type: 'inLayer', to: 'phb', props: { mode: 'removes' } }]),
];
const K = (relations: Entity['relations']): Entity => ({ id: 'camp', name: 'Kampagne', interfaces: ['Campaign'], relations });
const welt = (k: Entity) => new Map<EntityId, Entity>([...basis, k].map((e) => [e.id, e]));
const an = (to: string, props: Record<string, unknown> = {}) => ({ id: `a_${to}`, type: 'activates', to, props });
const da = (w: Map<EntityId, Entity>, k: Entity) => {
  const s = playStack(w, k, registry);
  return [...w.values()]
    .filter((e) => e.interfaces?.[0] !== 'Layer' && e.interfaces?.[0] !== 'Campaign' && s.inPlay(e))
    .map((e) => e.id)
    .sort();
};
const stapel = [an('phb', { order: 10 }), an('adv1', { order: 20 }), an('adv2', { order: 30 })];

describe('type rules over many sources (T-187)', () => {
  it('apply to every layer in the group that says nothing itself', () => {
    const k = withRule(K(stapel), 'g_adv', { areas: ['rules'] });
    const w = welt(k);
    expect(layerRules(k).get('g_adv')).toEqual({ areas: ['rules'] });
    expect(da(w, k)).toEqual(['item1', 'regel', 'spell2']);
    const e = resolvedEntries(w, k);
    expect(e.find((x) => x.layer.id === 'adv1')).toMatchObject({ filter: { areas: ['rules'] }, ruleFrom: 'g_adv' });
    /* Das Grundregelwerk steht nicht in „Adventures": es bringt alles. */
    expect(e.find((x) => x.layer.id === 'phb')?.ruleFrom).toBeUndefined();
    /* Die Einzelfragen rechnen gleich. */
    expect(inStack(w, w.get('ort1')!, k, registry)).toBe(false);
    expect(inPlay(w, w.get('item1')!, k, registry)).toBe(true);
  });

  it('give way to the layer’s own choice and to an exemption', () => {
    const eigene = withRule(K([an('phb', { order: 10 }), an('adv1', { order: 20, types: ['Scene'] }), an('adv2', { order: 30 })]), 'g_adv', {
      areas: ['rules'],
    });
    expect(da(welt(eigene), eigene)).toEqual(['regel', 'spell2', 'szene1']);
    const frei = withExempt(withRule(K(stapel), 'g_adv', { areas: ['rules'] }), 'adv2', true)!;
    expect(da(welt(frei), frei)).toEqual(['item1', 'ort2', 'regel', 'spell2']);
    /* Zurück: die Regel gilt wieder. */
    const zurueck = withExempt(frei, 'adv2', false)!;
    expect(da(welt(zurueck), zurueck)).toEqual(['item1', 'regel', 'spell2']);
    /* Ohne eigene Kante gibt es nichts auszunehmen. */
    expect(withExempt(K(stapel), 'adv3', true)).toBeNull();
  });

  it('take the nearest group, and the stack keeps the exemption', () => {
    const k = withRule(withRule(K(stapel), 'g_off', { types: ['Place'] }), 'g_adv', { types: ['Spell'] });
    const w = welt(k);
    /* adv1/adv2 hängen an „Adventures" — die nähere Regel gilt; phb an „Official". */
    expect(da(w, k)).toEqual(['spell2']);
    const eltern = new Map([['adv1', ['g_adv']], ['g_adv', ['g_off']]]);
    expect(ruleFor('adv1', layerRules(k), eltern)?.group).toBe('g_adv');
    /* Den Stapel neu schreiben behält Regel und Ausnahme. */
    const neu = withStack(withExempt(k, 'adv1', true)!, ['phb', 'adv1']);
    expect(layerRules(neu).size).toBe(2);
    expect(da(welt(neu), neu)).toEqual(['item1', 'ort1', 'szene1']);
  });

  it('do not reach a layer brought by a group with its own choice', () => {
    const k = withRule(K([an('g_adv', { order: 10, types: ['Place'] })]), 'g_adv', { areas: ['rules'] });
    expect(da(welt(k), k)).toEqual(['ort1', 'ort2', 'ort3', 'weg3']);
  });

  it('go away with null', () => {
    const k = withRule(withRule(K(stapel), 'g_adv', { areas: ['rules'] }), 'g_adv', null);
    expect(layerRules(k).size).toBe(0);
    expect(da(welt(k), k)).toContain('ort1');
  });
});

describe('single articles enabled from a layer not in play (T-187)', () => {
  const vergleich = { id: 'c_adv3', type: 'activates', to: 'adv3', props: { mode: 'compare' } };

  it('are in play although their layer is not, and only they', () => {
    const k = withEnabled(K([...stapel, vergleich]), 'item3', true);
    const w = welt(k);
    expect(enabledArticles(k)).toEqual(new Set(['item3']));
    const s = playStack(w, k, registry);
    expect(s.inPlay(w.get('item3')!)).toBe(true);
    expect(s.enabled(w.get('item3')!)).toBe(true);
    expect(s.unactivated(w.get('item3')!)).toEqual([]);
    expect(s.inPlay(w.get('ort3')!)).toBe(false);
    expect(inPlay(w, w.get('item3')!, k, registry)).toBe(true);
    /* Ihre Ebene bleibt, was sie war: nur zum Vergleich genannt. */
    expect(shownLayers(w, k, false)?.has('adv3')).toBe(false);
  });

  it('lose to a removal from a layer in play', () => {
    const k = withEnabled(K(stapel), 'weg3', true);
    expect(playStack(welt(k), k, registry).inPlay(welt(k).get('weg3')!)).toBe(false);
  });

  it('replace what they override, below every layer in play', () => {
    const k = withEnabled(K(stapel), 'regel3', true);
    const w = welt(k);
    expect(da(w, k)).not.toContain('regel');
    expect(resolveArticle(w, w.get('regel')!, k, registry).id).toBe('regel3');
    expect(playStack(w, k, registry).resolve(w.get('regel')!, new Map([['regel', [w.get('regel3')!]]])).id).toBe('regel3');
  });

  it('go back at the same place', () => {
    const k = withEnabled(withEnabled(K(stapel), 'item3', true), 'item3', false);
    expect(enabledArticles(k).size).toBe(0);
    expect(playStack(welt(k), k, registry).inPlay(welt(k).get('item3')!)).toBe(false);
  });
});

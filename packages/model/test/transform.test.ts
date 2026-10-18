import { describe, expect, it } from 'vitest';
import {
  applyTransform,
  articleDimensions,
  keyMatches,
  keyParts,
  mostSpecific,
  stepsFromString,
  stepsToString,
  type Dimension,
  type Entity,
  type TransformStep,
} from '../src/index.js';

/* T-253: die Kette als Daten, der Baum mit Zählern. */
interface Zeile { id: string; layer: string; type: string; tags: string[]; name: string }
const Z: Zeile[] = [
  { id: '1', layer: 'dnd', type: 'Spell', tags: ['fire'], name: 'Fireball' },
  { id: '2', layer: 'dnd', type: 'Spell', tags: ['fire', 'aoe'], name: 'Burning hands' },
  { id: '3', layer: 'dnd', type: 'Item', tags: [], name: 'Rope' },
  { id: '4', layer: 'basil', type: 'Rule', tags: ['inventory'], name: 'Grid' },
];
const D: Dimension<Zeile>[] = [
  { key: 'layer', label: 'Layer', values: (z) => [z.layer], valueLabel: (v) => (v === 'dnd' ? 'D&D 5e' : 'Basil') },
  { key: 'type', label: 'Type', values: (z) => [z.type] },
  { key: 'tag', label: 'Tag', values: (z) => z.tags },
  { key: 'name', label: 'Name', values: (z) => [z.name] },
];

describe('applyTransform', () => {
  it('schachtelt Gruppen in ihrer Reihenfolge und zählt', () => {
    const t = applyTransform(Z, [{ group: 'layer' }, { group: 'type' }], D);
    expect(t.nodes.map((n) => [n.label, n.count])).toEqual([['Basil', 1], ['D&D 5e', 3]]);
    const dnd = t.nodes[1]!;
    expect(dnd.children.map((n) => [n.key, n.count])).toEqual([['layer:dnd|type:Item', 1], ['layer:dnd|type:Spell', 2]]);
    expect(dnd.children[0]!.depth).toBe(1);
  });

  it('stellt eine Zeile mit mehreren Werten unter jeden, ohne Wert unter „(none)" zuletzt', () => {
    const t = applyTransform(Z, [{ group: 'tag' }], D);
    expect(t.nodes.map((n) => [n.label, n.count])).toEqual([['aoe', 1], ['fire', 2], ['inventory', 1], ['(none)', 1]]);
  });

  it('filtert, wo der Filter auch steht, und lässt leere Knoten weg', () => {
    const steps: TransformStep[] = [{ group: 'layer' }, { filter: 'type', values: ['Spell'] }];
    const t = applyTransform(Z, steps, D);
    expect(t.rows.map((z) => z.id)).toEqual(['1', '2']);
    expect(t.nodes.map((n) => n.value)).toEqual(['dnd']);
    expect(applyTransform(Z, [{ filter: 'type', values: ['Spell'], not: true }], D).rows.map((z) => z.id)).toEqual(['3', '4']);
  });

  it('sortiert die Zeilen in jedem Knoten', () => {
    const t = applyTransform(Z, [{ group: 'layer' }, { sort: 'name' }], D);
    expect(t.nodes[1]!.rows.map((z) => z.name)).toEqual(['Burning hands', 'Fireball', 'Rope']);
    expect(applyTransform(Z, [{ sort: 'name', desc: true }], D).rows[0]!.name).toBe('Rope');
  });

  it('sagt, welche Dimension es nicht gibt, statt still nichts zu tun', () => {
    const t = applyTransform(Z, [{ group: 'module' }, { group: 'layer' }], D);
    expect(t.unknown).toEqual(['module']);
    expect(t.nodes).toHaveLength(2);
  });
});

describe('Schlüssel', () => {
  it('trifft, wenn jedes Glied passt; Unbekanntes trifft nie', () => {
    expect(keyMatches('layer:dnd|type:Spell', Z[0]!, D)).toBe(true);
    expect(keyMatches('layer:dnd|type:Item', Z[0]!, D)).toBe(false);
    expect(keyMatches('tag:aoe', Z[1]!, D)).toBe(true);
    const z = { ...Z[0]!, tags: ['a:b|c'] };
    const k = applyTransform([z], [{ group: 'tag' }], D).nodes[0]!.key;
    expect(keyParts(k)).toEqual([['tag', 'a:b|c']]);
    expect(keyMatches(k, z, D)).toBe(true);
    expect(keyMatches('module:Inventory', Z[3]!, D)).toBe(false);
    expect(keyMatches('', Z[0]!, D)).toBe(true);
  });

  it('der genaueste gewinnt (E-098)', () => {
    expect(mostSpecific(['layer:dnd', 'layer:dnd|type:Spell', 'type:Spell'], Z[0]!, D)).toBe('layer:dnd|type:Spell');
    expect(mostSpecific(['layer:dnd', 'layer:dnd|type:Spell'], Z[2]!, D)).toBe('layer:dnd');
    expect(mostSpecific(['layer:basil'], Z[2]!, D)).toBeNull();
  });
});

describe('Kette als Wort', () => {
  it('hin und zurück', () => {
    const steps: TransformStep[] = [
      { group: 'layer' },
      { group: 'field.Item.rarity' },
      { filter: 'status', values: ['ready', 'a,b+c'] },
      { filter: 'type', values: ['Spell'], not: true },
      { sort: 'name', desc: true },
    ];
    expect(stepsFromString(stepsToString(steps))).toEqual(steps);
    expect(stepsFromString('group:,sort:name,unsinn,filter:x')).toEqual([{ sort: 'name' }]);
    expect(stepsFromString(null)).toEqual([]);
  });
});

describe('articleDimensions', () => {
  const reg = { interfaces: { Spell: { name: 'Spell', label: 'Spell', area: 'rules', schema: { type: 'object', properties: { level: { type: 'integer', title: 'Level' } } } } } } as never;
  const e = (id: string, c: Entity['components'], layer?: string): Entity => ({
    id, name: id, interfaces: ['Spell'], components: c,
    relations: layer ? [{ type: 'inLayer', from: id, to: layer }] : [],
  } as Entity);

  it('liest Ebene, Art, Bereich, Vorgaben für Status und Sichtbarkeit, und Feldwerte', () => {
    const dims = articleDimensions(reg, { fields: ['Spell.level'], layerGroups: (l) => (l === 'dnd' ? ['wotc'] : []) });
    const a = e('a', { Spell: { level: 3 }, Visibility: { audience: 'gm' } }, 'dnd');
    const b = e('b', { Status: { status: 'idea' } });
    const t = applyTransform([a, b], [{ group: 'audience' }], dims);
    expect(t.nodes.map((n) => n.value)).toEqual(['gm', 'public']);
    expect(applyTransform([a, b], [{ group: 'status' }], dims).nodes.map((n) => n.value)).toEqual(['idea', 'ready']);
    expect(keyMatches('layerGroup:wotc|area:rules|field.Spell.level:3', a, dims)).toBe(true);
    expect(dims.find((d) => d.key === 'field.Spell.level')!.label).toBe('Spell › Level');
  });
});

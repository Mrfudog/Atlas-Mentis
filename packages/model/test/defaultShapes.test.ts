import { describe, expect, it } from 'vitest';
import {
  campaignShapeDefaults,
  defaultShapeOf,
  hasShapeDefaults,
  stripDefaultShape,
  indexShapeDefaults,
  mergeShapeDefaults,
  priceTier,
  randomShape,
  shapeDefaultsOf,
  shapeHash,
  withDefaultShape,
  type Entity,
  type ShapeDefaults,
} from '../src/index.js';

/* Vorgabeformen im Inventarmodul (T-394, E-165). Erfundene Gegenstände und Gruppen. */

const item = (id: string, karte: Record<string, unknown> = {}): Entity => ({ id, interfaces: ['Item'], components: { Item: karte } });

const DATEN: ShapeDefaults = {
  groups: [
    { id: 'BL', name: 'Blades', rows: ['.#.', '###', '.#.'], stackSize: 1, ref: 'blade' },
    { id: 'AM', name: 'Ammunition', rows: ['#', '#'], stackSize: 32 },
    { id: 'MT', name: 'Mounts', rows: null, carryable: false },
    {
      id: 'AR',
      name: 'Art',
      rows: ['#'],
      stackSize: 1,
      tiers: [25, 250],
      shapes: [
        { rows: ['#'], weights: [100, 0] },
        { rows: ['##', '##'], weights: [0, 100] },
      ],
    },
    { id: 'EM', name: 'Empty' },
  ],
  items: [
    { id: 'blade', group: 'BL', rows: ['#', '#', '#'] },
    { id: 'blade+1', group: 'BL', ref: 'blade' },
    { id: 'sword', group: 'BL' },
    { id: 'arrow', group: 'AM' },
    { id: 'arrow-own', group: 'AM', rows: ['#'], stackSize: 64 },
    { id: 'nothing', group: 'AM', rows: null },
    { id: 'horse', group: 'MT' },
    { id: 'cheap', group: 'AR' },
    { id: 'dear', group: 'AR' },
    { id: 'empty', group: 'EM' },
    { id: 'loop-a', ref: 'loop-b' },
    { id: 'loop-b', ref: 'loop-a', group: 'AM' },
    { id: 'missing-ref', group: 'AM', ref: 'gone' },
    { id: 'heavy+1', ref: 'blade+1', stackSize: 3 },
  ],
};

const alle = new Map<string, Entity>(
  [
    item('blade'),
    item('blade+1'),
    item('sword'),
    item('arrow'),
    item('arrow-own'),
    item('nothing'),
    item('horse'),
    item('cheap', { copperPrice: 1000 }),
    item('dear', { copperPrice: 100000 }),
    item('empty'),
    item('loop-a'),
    item('loop-b'),
    item('missing-ref'),
    item('heavy+1'),
    item('stray'),
  ].map((e) => [e.id, e]),
);
const lookup = { item: (id: string) => alle.get(id) };
const idx = indexShapeDefaults(DATEN);
const von = (id: string, e: Entity = alle.get(id)!) => defaultShapeOf(e, idx, lookup);

describe('defaultShapeOf — Vorrang', () => {
  it('1. die Form am Gegenstand gilt vor allem anderen', () => {
    const s = von('sword', item('sword', { rows: ['##'], stackSize: 2 }));
    expect(s).toMatchObject({ rows: ['##'], stackSize: 2, source: 'item', group: 'BL', stackSource: 'item' });
  });

  it('1. ohne Stapel am Gegenstand nimmt die eigene Form den des Untermoduls, sonst 1', () => {
    expect(von('arrow-own', item('arrow-own', { rows: ['#'] }))).toMatchObject({ stackSize: 64, stackSource: 'own' });
    expect(von('sword', item('sword', { rows: ['#'] })).stackSize).toBe(1);
  });

  it('2. die eigene Form im Untermodul, mit ihrem Stapel', () => {
    expect(von('arrow-own')).toMatchObject({ rows: ['#'], stackSize: 64, source: 'own', group: 'AM' });
  });

  it('2. „keine Form“ im Untermodul ist eine Angabe und kein Fehlen', () => {
    expect(von('nothing')).toMatchObject({ rows: null, stackSize: null, source: 'none' });
  });

  it('3. der Referenzgegenstand vererbt seine Form, über eine Kette', () => {
    expect(von('blade+1')).toMatchObject({ rows: ['#', '#', '#'], source: 'reference', ref: 'blade', group: 'BL' });
    /* Zwei Schritte: heavy+1 → blade+1 → blade; der eigene Stapel gilt darüber. */
    expect(von('heavy+1')).toMatchObject({ rows: ['#', '#', '#'], stackSize: 3, source: 'reference', ref: 'blade+1' });
  });

  it('3. ein Kreis bricht ab und fällt auf die Gruppe', () => {
    expect(von('loop-b')).toMatchObject({ rows: ['#', '#'], source: 'group', group: 'AM' });
  });

  it('3. ein fehlender Referenzgegenstand fällt auf die Gruppe', () => {
    expect(von('missing-ref')).toMatchObject({ rows: ['#', '#'], stackSize: 32, source: 'group' });
  });

  it('4. eine Gruppe, die nicht getragen wird, gibt keine Form', () => {
    expect(von('horse')).toMatchObject({ rows: null, stackSize: null, source: 'none', group: 'MT' });
  });

  it('5. Zufallsform nach Preisstufe, immer dieselbe', () => {
    expect(von('cheap')).toMatchObject({ rows: ['#'], source: 'random' });
    expect(von('dear')).toMatchObject({ rows: ['##', '##'], source: 'random' });
    expect(von('dear')).toEqual(von('dear'));
  });

  it('5. ohne Preis keine Zufallsform, sondern die Gruppe', () => {
    expect(von('cheap', item('cheap'))).toMatchObject({ rows: ['#'], source: 'group' });
  });

  it('6. die Gruppe nimmt die eigene Form ihres Referenzgegenstands', () => {
    expect(von('sword')).toMatchObject({ rows: ['#', '#', '#'], stackSize: 1, source: 'group', ref: 'blade' });
  });

  it('6. der Referenzgegenstand selbst bekommt seine eigene Form, nicht die der Gruppe', () => {
    expect(von('blade')).toMatchObject({ rows: ['#', '#', '#'], source: 'own' });
  });

  it('6. eine Gruppe ohne Form gibt keine', () => {
    expect(von('empty')).toMatchObject({ rows: null, source: 'none', group: 'EM' });
  });

  it('ohne Eintrag sagt niemand etwas', () => {
    expect(von('stray')).toEqual({ rows: null, stackSize: null, source: 'unset' });
  });
});

describe('withDefaultShape', () => {
  it('legt Form und Stapel in die Karte, ohne das Original zu ändern', () => {
    const e = alle.get('arrow')!;
    const { entity, shape } = withDefaultShape(e, idx, lookup);
    expect(entity.components?.['Item']).toMatchObject({ rows: ['#', '#'], stackSize: 32 });
    expect(shape.source).toBe('group');
    expect(e.components?.['Item']).toEqual({});
  });

  it('lässt einen Gegenstand mit eigener Form, wie er ist', () => {
    const e = item('sword', { rows: ['##'], stackSize: 2 });
    expect(withDefaultShape(e, idx, lookup).entity).toBe(e);
  });

  it('füllt nur den Stapel, wenn die Form am Gegenstand steht', () => {
    const e = item('arrow-own', { rows: ['#'] });
    expect(withDefaultShape(e, idx, lookup).entity.components?.['Item']).toEqual({ rows: ['#'], stackSize: 64 });
  });

  it('ohne Vorgabe bleibt der Gegenstand derselbe', () => {
    const e = alle.get('stray')!;
    expect(withDefaultShape(e, idx, lookup).entity).toBe(e);
  });
});

describe('shapeDefaultsOf', () => {
  it('liest die Karte und lässt Unlesbares weg', () => {
    const ebene: Entity = {
      id: 'ly',
      interfaces: ['Layer'],
      components: {
        ShapeDefaults: {
          shapeGroups: [{ id: 'X', name: 'X', rows: '##/##', stackSize: '4', carryable: true }, { name: 'ohne Id' }, null],
          shapeItems: [{ id: 'a', group: 'X', ref: null, rows: null }, { id: 'b', rows: ['#'], stackSize: 0 }, 7],
        },
      },
    };
    const d = shapeDefaultsOf(ebene);
    expect(d.groups).toEqual([{ id: 'X', name: 'X', rows: ['##', '##'], stackSize: 4, carryable: true }]);
    expect(d.items).toEqual([{ id: 'a', group: 'X', ref: null, rows: null }, { id: 'b', rows: ['#'] }]);
  });

  it('ohne Karte leer', () => {
    expect(shapeDefaultsOf(undefined)).toEqual({ groups: [], items: [] });
    expect(shapeDefaultsOf({ id: 'x', interfaces: [], components: {} })).toEqual({ groups: [], items: [] });
  });
});

describe('mergeShapeDefaults', () => {
  it('die spätere Ebene gewinnt Feld für Feld', () => {
    const m = mergeShapeDefaults([
      { groups: [{ id: 'A', name: 'A', rows: ['#'], stackSize: 4 }], items: [{ id: 'i', group: 'A', stackSize: 2 }] },
      { groups: [{ id: 'A', name: 'A', stackSize: 8 }], items: [{ id: 'i', rows: ['##'] }] },
    ]);
    expect(m.groups).toEqual([{ id: 'A', name: 'A', rows: ['#'], stackSize: 8 }]);
    expect(m.items).toEqual([{ id: 'i', group: 'A', stackSize: 2, rows: ['##'] }]);
  });
});

describe('Zufallsform', () => {
  it('shapeHash ist FNV-1a auf [0,1)', () => {
    expect(shapeHash('')).toBeCloseTo(2166136261 / 4294967296);
    const h = shapeHash('item-0001');
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(1);
  });

  it('priceTier nimmt die höchste erreichte Schwelle, darunter 0', () => {
    expect(priceTier([25, 250, 750], 10)).toBe(0);
    expect(priceTier([25, 250, 750], 250)).toBe(1);
    expect(priceTier([25, 250, 750], 9999)).toBe(2);
    expect(priceTier(undefined, 5)).toBe(0);
  });

  it('randomShape: ohne Auswahl, ohne Preis oder ohne Gewicht keine', () => {
    const g = { id: 'G', name: 'G', tiers: [0], shapes: [{ rows: ['#'], weights: [0] }] };
    expect(randomShape({ id: 'G', name: 'G' }, 'x', 10)).toBeNull();
    expect(randomShape(g, 'x', null)).toBeNull();
    expect(randomShape(g, 'x', 10)).toBeNull();
  });
});

describe('stripDefaultShape (D8)', () => {
  const shape = { rows: ['#', '#'], stackSize: 32, source: 'group' as const };
  it('lässt weg, was nur aus der Vorgabe kam', () => {
    const sent = item('arrow', { rows: ['#', '#'], stackSize: 32, weight: 1 });
    expect(stripDefaultShape(sent, item('arrow', { weight: 1 }), shape).components?.['Item']).toEqual({ weight: 1 });
  });
  it('behält eine Abweichung', () => {
    const sent = item('arrow', { rows: ['###'], stackSize: 16 });
    expect(stripDefaultShape(sent, item('arrow'), shape)).toBe(sent);
  });
  it('behält, was schon gespeichert war', () => {
    const sent = item('arrow', { rows: ['#', '#'], stackSize: 32 });
    expect(stripDefaultShape(sent, item('arrow', { rows: ['#'], stackSize: 8 }), shape)).toBe(sent);
  });
  it('ohne Vorgabe ändert sich nichts', () => {
    const sent = item('arrow', { rows: ['#'] });
    expect(stripDefaultShape(sent, undefined, { rows: null, stackSize: null, source: 'unset' })).toBe(sent);
  });
});

describe('campaignShapeDefaults', () => {
  const ebene = (id: string, d: unknown): Entity => ({ id, interfaces: ['Layer'], components: { ShapeDefaults: d as Record<string, unknown> } });
  const unten = ebene('ly_a', { shapeGroups: [{ id: 'A', name: 'A', rows: '#', stackSize: 4 }] });
  const oben = ebene('ly_b', { shapeGroups: [{ id: 'A', name: 'A', stackSize: 8 }] });
  const aus = ebene('ly_c', { shapeGroups: [{ id: 'A', name: 'A', stackSize: 99 }] });
  const kampagne = (order: [string, number][]): Entity => ({
    id: 'camp',
    interfaces: ['Campaign'],
    components: {},
    relations: order.map(([to, o], i) => ({ id: `a${i}`, type: 'activates', to, props: { order: o } })),
  });
  const alle = new Map([unten, oben, aus].map((e) => [e.id, e]));
  it('nur aufgeschaltete Ebenen, die spezifischere gewinnt', () => {
    const d = campaignShapeDefaults(alle, kampagne([['ly_a', 10], ['ly_b', 20]]));
    expect(d.groups).toEqual([{ id: 'A', name: 'A', rows: ['#'], stackSize: 8 }]);
    expect(campaignShapeDefaults(alle, kampagne([['ly_b', 10], ['ly_a', 20]])).groups[0]?.stackSize).toBe(4);
  });
  it('ohne Kampagne oder Untermodul nichts', () => {
    expect(campaignShapeDefaults(alle, null)).toEqual({ groups: [], items: [] });
    expect(hasShapeDefaults(indexShapeDefaults(campaignShapeDefaults(alle, kampagne([]))))).toBe(false);
  });
});

describe('withShapeItem / withShapeGroup (T-394)', () => {
  it('setzt, ändert und nimmt Felder eines Gegenstands heraus', async () => {
    const { withShapeItem } = await import('../src/index.js');
    let k = withShapeItem(undefined, 'a', { group: 'W4', ref: 'b' });
    expect(k['shapeItems']).toEqual([{ id: 'a', group: 'W4', ref: 'b' }]);
    k = withShapeItem(k, 'a', { ref: null, stackSize: 4 });
    expect(k['shapeItems']).toEqual([{ id: 'a', group: 'W4', stackSize: 4 }]);
    k = withShapeItem(k, 'a', { rows: [] });
    expect(k['shapeItems']).toEqual([{ id: 'a', group: 'W4', stackSize: 4, rows: null }]);
    k = withShapeItem(k, 'a', { rows: null, group: null, stackSize: null });
    expect(k['shapeItems']).toEqual([]);
    expect(k['shapeGroups']).toEqual([]);
  });
  it('„keine Form“ legt einen Eintrag an, wenn es keinen gibt', async () => {
    const { withShapeItem } = await import('../src/index.js');
    expect(withShapeItem({ shapeItems: [] }, 'x', { rows: [] })['shapeItems']).toEqual([{ id: 'x', rows: null }]);
  });
  it('eine Gruppe braucht zum Anlegen einen Namen, danach genügt die Änderung', async () => {
    const { withShapeGroup } = await import('../src/index.js');
    expect(withShapeGroup({}, 'G', { rows: ['#'] })['shapeGroups']).toBeUndefined();
    let k = withShapeGroup({}, 'G', { name: 'Gems', rows: ['#'], stackSize: 16 });
    expect(k['shapeGroups']).toEqual([{ id: 'G', name: 'Gems', rows: ['#'], stackSize: 16 }]);
    k = withShapeGroup(k, 'G', { stackSize: 8, rows: null });
    expect(k['shapeGroups']).toEqual([{ id: 'G', name: 'Gems', stackSize: 8 }]);
  });
});

import { describe, expect, it } from 'vitest';
import { areaCells, areaColor, cellCorners, mapAreas, zoneHidden, zoneRuleSummary, zoneRuleText } from '../src/areas.js';
import { addFloor, floorView, withFloorView } from '../src/floors.js';
import { gridGeometry, mapSettings, redactMap } from '../src/map.js';
import { mapTerrain, terrainCosts } from '../src/zugplan.js';
import type { Entity, Relation } from '../src/types.js';

/** Eine Karte 400 × 400 mit Feldern zu 40 — zehn mal zehn. */
function karte(rel: Relation[], map: Record<string, unknown> = {}): Entity {
  return {
    id: 'map-1',
    interfaces: ['Map'],
    components: { Map: { gridShape: 'square', gridSize: 40, ...map }, Image: { image: 'asset-1' } },
    relations: rel,
  };
}
const NAT = { w: 400, h: 400 };
const geo = (e: Entity) => gridGeometry(mapSettings(e), NAT)!;

const eis: Relation = { id: 'z1', type: 'zone', to: 'zk-ice', props: { kind: 'rect', x: 0.1, y: 0.1, w: 0.2, h: 0.1 } };
const reich: Relation = { id: 't1', type: 'territory', to: 'fac-1', props: { kind: 'circle', x: 0.5, y: 0.5, r: 0.15 } };

describe('Flächen auf der Karte (T-219)', () => {
  it('liest Zonen und Gebiete aus den Kanten', () => {
    const a = mapAreas(karte([eis, reich, { id: 'm', type: 'marker', to: 'npc-1', props: { x: 0.5, y: 0.5 } }]));
    expect(a.map((x) => [x.id, x.type, x.to, x.shape.kind])).toEqual([
      ['z1', 'zone', 'zk-ice', 'rect'],
      ['t1', 'territory', 'fac-1', 'circle'],
    ]);
    expect(a[1]!.opacity).toBe(0.18);
  });

  it('rastert aufs Gitter: ein Feld zählt, wenn seine Mitte in der Form liegt', () => {
    const e = karte([eis]);
    const z = mapAreas(e)[0]!;
    /* x 40–120, y 40–80: Mitten bei 60 und 100 (Spalten 1, 2), Zeile 1. */
    expect(areaCells(geo(e), z.shape)).toEqual([
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ]);
  });

  it('rastert gleich wie das Gelände des Zugplans (T-349)', () => {
    const e = karte([{ ...eis, props: { kind: 'poly', pts: [[0.05, 0.05], [0.55, 0.1], [0.3, 0.6]] } }]);
    const zellen = areaCells(geo(e), mapAreas(e)[0]!.shape)!;
    const kosten = terrainCosts(geo(e), 10, 10, mapTerrain(e, new Map([['zk-ice', { id: 'zk-ice', interfaces: ['ZoneKind'], components: { ZoneKind: { moveCost: 2 } } }]])));
    expect(zellen.map((c) => `${c.x},${c.y}`).sort()).toEqual(Object.keys(kosten).sort());
  });

  it('rastert auch ein Hexgitter', () => {
    const e = karte([reich], { gridShape: 'hex' });
    const g = geo(e);
    const zellen = areaCells(g, mapAreas(e)[0]!.shape)!;
    expect(zellen.length).toBeGreaterThan(3);
    /* Jedes Feld nur einmal, und jede Mitte liegt im Kreis. */
    expect(new Set(zellen.map((c) => `${c.x},${c.y}`)).size).toBe(zellen.length);
    expect(cellCorners(g, zellen[0]!)).toHaveLength(6);
  });

  it('zu viele Felder: die Form selbst statt einer Million Rechtecke', () => {
    const e = karte([{ ...eis, props: { kind: 'rect', x: 0, y: 0, w: 1, h: 1 } }], { gridSize: 2 });
    expect(areaCells(geo(e), mapAreas(e)[0]!.shape)).toBeNull();
  });

  it('färbt nach der Regel, ein Gebiet nach seinem Herrn', () => {
    expect(areaColor({ type: 'zone', to: 'x', color: null }, { light: 'dark' })).toBe('#3b4250');
    expect(areaColor({ type: 'zone', to: 'x', color: null }, { moveCost: 2 })).toBe('#8b5a2b');
    expect(areaColor({ type: 'zone', to: 'x', color: '#ff0000' }, { moveCost: 2 })).toBe('#ff0000');
    const a = areaColor({ type: 'territory', to: 'fac-1', color: null });
    expect(a).toBe(areaColor({ type: 'territory', to: 'fac-1', color: null }));
    expect(a).not.toBe(areaColor({ type: 'territory', to: 'fac-2', color: null }));
    expect(zoneRuleText({ moveCost: 2, light: 'dark' })).toBe('difficult terrain · dark light');
  });

  it('eine versteckte Zone ist versteckt, bis sie gefunden ist', () => {
    const falle: Entity = { id: 'zk-trap', interfaces: ['ZoneKind'], components: { ZoneKind: { hiddenUntil: 15 } } };
    expect(zoneRuleSummary(falle)).toEqual({ hidden: true });
    expect(zoneHidden(eis, falle)).toBe(true);
    expect(zoneHidden({ ...eis, props: { ...eis.props, found: true } }, falle)).toBe(false);
    expect(zoneHidden(reich, falle)).toBe(false);
  });
});

describe('Flächen zurückhalten (T-219)', () => {
  const sees = () => true;
  it('ohne Sicht auf den Artikel und versteckte Zonen gehen nicht hinaus', () => {
    const e = karte([eis, reich]);
    const r = redactMap(e, { gm: false, sees: (id) => id !== 'fac-1', hideZone: (x) => x.id === 'z1' });
    expect(mapAreas(r)).toEqual([]);
    expect(mapAreas(redactMap(e, { gm: true, sees: () => false }))).toHaveLength(2);
  });

  it('unter dem Nebel nur, was davon aufgedeckt ist', () => {
    const e = karte([eis, reich], { fog: true, reveal: [{ id: 'r1', kind: 'rect', x: 0, y: 0, w: 0.25, h: 0.25 }] });
    expect(mapAreas(redactMap(e, { gm: false, sees })).map((a) => a.id)).toEqual(['z1']);
  });

  it('gehört einer Ebene: Schlamm im Keller ist nicht im Obergeschoss', () => {
    let e = addFloor(karte([eis]), 'up', { name: 'Upper' });
    expect(mapAreas(floorView(e, 'up'))).toEqual([]);
    expect(mapAreas(floorView(e, null))).toHaveLength(1);
    /* Eine neue Fläche auf der oberen Ebene bekommt ihre Ebene mit. */
    const oben = floorView(e, 'up');
    e = withFloorView(e, 'up', { ...oben, relations: [...(oben.relations ?? []), reich] });
    expect(e.relations?.find((r) => r.id === 't1')?.props?.['floor']).toBe('up');
    expect(mapAreas(floorView(e, 'up')).map((a) => a.id)).toEqual(['t1']);
    expect(mapAreas(floorView(e, null)).map((a) => a.id)).toEqual(['z1']);
  });
});

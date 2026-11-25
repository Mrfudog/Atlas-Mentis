import { describe, expect, it } from 'vitest';
import {
  GROUND_FLOOR,
  addFloor,
  elevationsOverlap,
  floorGroups,
  floorOfWall,
  floorView,
  goThrough,
  mapFloors,
  passageAt,
  passageEnds,
  redactFloors,
  removeFloor,
  setFloorReleased,
  sightInto,
  updateFloor,
  withFloorView,
} from '../src/floors.js';
import { gridGeometry, mapSettings, markersOf, redactMap, revealArea, isRevealed } from '../src/map.js';
import { mapWalls } from '../src/walls.js';
import type { Entity, Relation } from '../src/types.js';

/** Ein Turm: Erdgeschoss mit Treppe nach oben, ein Obergeschoss mit anderem Massstab. */
function turm(rel: Relation[] = []): Entity {
  let e: Entity = {
    id: 'map-1',
    interfaces: ['Map'],
    components: {
      Map: { gridShape: 'square', gridSize: 70, scale: '1,5 m', walls: [{ id: 'w0', kind: 'wall', x1: 0, y1: 0, x2: 1, y2: 0 }], fog: true },
      Image: { image: 'asset-ground' },
    },
    relations: [
      { id: 't1', type: 'marker', to: 'npc-1', props: { kind: 'play', x: 0.2, y: 0.2 } },
      ...rel,
    ],
  };
  e = addFloor(e, 'up', { name: 'Upper floor', structure: 'Tower', elevation: { from: 10, to: 20 } });
  return e;
}

describe('Ebenen einer Karte (T-307, E-108)', () => {
  it('eine Karte ohne floors hat genau eine Ebene „Ground" — die Karte selbst', () => {
    const e: Entity = { id: 'm', interfaces: ['Map'], components: { Map: {}, Image: { image: 'a' } } };
    expect(mapFloors(e)).toEqual([expect.objectContaining({ id: GROUND_FLOOR, name: 'Ground', ground: true, image: 'a' })]);
    expect(floorView(e, 'ground')).toBe(e);
  });

  it('eine neue Ebene übernimmt das Gitter der ersten als Anfang, nicht ihre Sperren', () => {
    const e = turm();
    const up = floorView(e, 'up');
    expect(mapSettings(up).gridSize).toBe(70);
    expect(mapWalls(up)).toEqual([]);
    expect(mapWalls(floorView(e, GROUND_FLOOR))).toHaveLength(1);
    expect((up.components?.['Image'] as { image: string }).image).toBe('');
  });

  it('eigener Massstab je Ebene: ein Gitter am Obergeschoss ändert das Erdgeschoss nicht', () => {
    let e = turm();
    const up = floorView(e, 'up');
    e = withFloorView(e, 'up', { ...up, components: { ...up.components, Map: { ...(up.components!['Map'] as object), gridSize: 35, scale: '3 m' } } });
    expect(mapSettings(floorView(e, 'up')).gridSize).toBe(35);
    expect(mapSettings(floorView(e, 'up')).scale).toBe('3 m');
    expect(mapSettings(floorView(e, GROUND_FLOOR)).gridSize).toBe(70);
    expect(gridGeometry(mapSettings(floorView(e, 'up')), { w: 700, h: 700 })?.size).toBe(35);
  });

  it('Marker und Nebel je Ebene; neue Marker bekommen die Ebene', () => {
    let e = turm();
    const up = floorView(e, 'up');
    expect(markersOf(up)).toEqual([]);
    const neu = { ...up, relations: [...(up.relations ?? []), { id: 't2', type: 'marker', to: 'npc-2', props: { kind: 'play', x: 0.5, y: 0.5 } }] };
    e = withFloorView(e, 'up', revealArea(neu, { id: 'r1', kind: 'rect', x: 0.4, y: 0.4, w: 0.2, h: 0.2 }));
    expect(markersOf(floorView(e, 'up')).map((m) => m.to)).toEqual(['npc-2']);
    expect(markersOf(floorView(e, GROUND_FLOOR)).map((m) => m.to)).toEqual(['npc-1']);
    expect((e.relations ?? []).find((r) => r.id === 't2')?.props?.['floor']).toBe('up');
    expect(isRevealed(floorView(e, 'up'), { x: 0.5, y: 0.5 })).toBe(true);
    expect(isRevealed(floorView(e, GROUND_FLOOR), { x: 0.5, y: 0.5 })).toBe(false);
    /* Der Nebel steht nicht in der Ebene, sondern als Stand am Tisch daneben. */
    expect((e.components?.['Map'] as { floorReveal: Record<string, unknown[]> }).floorReveal['up']).toHaveLength(1);
  });

  it('eine Sperre findet ihre Ebene', () => {
    let e = turm();
    e = withFloorView(e, 'up', { ...floorView(e, 'up'), components: { ...floorView(e, 'up').components, Map: { ...(floorView(e, 'up').components!['Map'] as object), walls: [{ id: 'w9', kind: 'door', x1: 0, y1: 0.5, x2: 1, y2: 0.5 }] } } });
    expect(floorOfWall(e, 'w9')).toBe('up');
    expect(floorOfWall(e, 'w0')).toBe(GROUND_FLOOR);
  });

  it('die Leiste gruppiert nach Gebäudeteil und sortiert nach Höhe: zwei ungleich hohe Türme', () => {
    let e = turm();
    e = updateFloor(e, GROUND_FLOOR, { name: 'Hall', elevation: { from: 0, to: 10 } });
    e = addFloor(e, 'w1', { name: 'West 1', structure: 'West tower', elevation: { from: 0, to: 20 } });
    e = addFloor(e, 'o2', { name: 'East 2', structure: 'East tower', elevation: { from: 10, to: 20 } });
    e = addFloor(e, 'o1', { name: 'East 1', structure: 'East tower', elevation: { from: 0, to: 10 } });
    const g = floorGroups(mapFloors(e));
    expect(g.map((x) => x.structure)).toEqual(['', 'West tower', 'East tower', 'Tower']);
    expect(g[2]!.floors.map((f) => f.name)).toEqual(['East 1', 'East 2']);
    const fl = Object.fromEntries(mapFloors(e).map((f) => [f.id, f]));
    expect(elevationsOverlap(fl['w1']!.elevation, fl['o2']!.elevation)).toBe(true);
    expect(elevationsOverlap(fl['o1']!.elevation, fl['o2']!.elevation)).toBe(false);
  });

  it('eine Ebene weg nimmt ihre Marker und die Übergänge dorthin mit; die erste bleibt', () => {
    const e = turm([{ id: 'p1', type: 'marker', to: 'map-1', props: { kind: 'passage', passage: 'stairs', x: 0.8, y: 0.8, toFloor: 'up', toX: 0.1, toY: 0.1 } }]);
    const f = removeFloor(e, 'up');
    expect(mapFloors(f).map((x) => x.id)).toEqual([GROUND_FLOOR]);
    expect((f.relations ?? []).map((r) => r.id)).toEqual(['t1']);
    expect(removeFloor(e, GROUND_FLOOR)).toBe(e);
  });
});

describe('Übergänge (T-307)', () => {
  const treppe: Relation = {
    id: 'p1',
    type: 'marker',
    to: 'map-1',
    props: { kind: 'passage', passage: 'stairs', x: 0.8, y: 0.8, toFloor: 'up', toX: 0.1, toY: 0.1 },
  };

  it('eine Treppe in beide Richtungen hat oben ein gespiegeltes Ende', () => {
    const e = turm([treppe]);
    expect(passageEnds(e, GROUND_FLOOR)).toEqual([expect.objectContaining({ relId: 'p1', toFloor: 'up', mirrored: false })]);
    expect(passageEnds(e, 'up')).toEqual([expect.objectContaining({ relId: 'p1', toFloor: GROUND_FLOOR, at: { x: 0.1, y: 0.1 }, mirrored: true })]);
  });

  it('durchgehen versetzt das Token auf Zielebene und Zielpunkt, und zurück', () => {
    let e = turm([treppe]);
    e = { ...e, relations: (e.relations ?? []).map((r) => (r.id === 't1' ? { ...r, props: { ...r.props, x: 0.8, y: 0.8 } } : r)) };
    const ende = passageAt(e, GROUND_FLOOR, { x: 0.8, y: 0.8 })!;
    const oben = goThrough(e, 't1', ende)!;
    expect(markersOf(floorView(oben, 'up')).map((m) => [m.to, m.x, m.y])).toEqual([['npc-1', 0.1, 0.1]]);
    expect(markersOf(floorView(oben, GROUND_FLOOR)).filter((m) => m.kind === 'play')).toEqual([]);
    const zurueck = goThrough(oben, 't1', passageAt(oben, 'up', { x: 0.1, y: 0.1 })!)!;
    expect(markersOf(floorView(zurueck, GROUND_FLOOR)).find((m) => m.to === 'npc-1')).toMatchObject({ x: 0.8, y: 0.8 });
  });

  it('Einbahn: kein Ende auf der Gegenseite, also kein Weg zurück', () => {
    const e = turm([{ ...treppe, props: { ...treppe.props, passage: 'portal', oneWay: true } }]);
    expect(passageEnds(e, 'up')).toEqual([]);
    expect(passageAt(e, 'up', { x: 0.1, y: 0.1 })).toBeNull();
  });

  it('ein Portal auf eine andere Karte versetzt hier nichts', () => {
    const e = turm([{ ...treppe, to: 'map-2', props: { ...treppe.props, passage: 'portal' } }]);
    const ende = passageAt(e, GROUND_FLOOR, { x: 0.8, y: 0.8 })!;
    expect(ende.toMap).toBe('map-2');
    expect(goThrough(e, 't1', ende)).toBeNull();
    expect(passageEnds(e, 'up')).toEqual([]);
  });

  it('Sicht über die Treppe: wer unten auf ihr steht, sieht oben ab dem Gegenstück', () => {
    let e = turm([treppe]);
    e = { ...e, relations: (e.relations ?? []).map((r) => (r.id === 't1' ? { ...r, props: { ...r.props, x: 0.8, y: 0.8 } } : r)) };
    expect(sightInto(e, 'up')).toEqual([expect.objectContaining({ to: 'npc-1', from: { x: 0.1, y: 0.1 } })]);
    /* Oben angekommen sieht es auch hinunter. */
    const oben = goThrough(e, 't1', passageAt(e, GROUND_FLOOR, { x: 0.8, y: 0.8 })!)!;
    expect(sightInto(oben, GROUND_FLOOR)).toEqual([expect.objectContaining({ to: 'npc-1', from: { x: 0.8, y: 0.8 } })]);
  });

  it('nur durchgehen: ein Portal ohne Sicht zeigt die andere Seite nicht', () => {
    let e = turm([{ ...treppe, props: { ...treppe.props, passage: 'portal', sight: 'none' } }]);
    e = { ...e, relations: (e.relations ?? []).map((r) => (r.id === 't1' ? { ...r, props: { ...r.props, x: 0.8, y: 0.8 } } : r)) };
    expect(sightInto(e, 'up')).toEqual([]);
  });

  it('Einbahn mit Sicht: hinein ja, vom Ziel zurück nicht', () => {
    let e = turm([{ ...treppe, props: { ...treppe.props, passage: 'portal', oneWay: true } }]);
    e = { ...e, relations: (e.relations ?? []).map((r) => (r.id === 't1' ? { ...r, props: { ...r.props, x: 0.8, y: 0.8 } } : r)) };
    expect(sightInto(e, 'up')).toHaveLength(1);
    const oben = goThrough(e, 't1', passageAt(e, GROUND_FLOOR, { x: 0.8, y: 0.8 })!)!;
    expect(sightInto(oben, GROUND_FLOOR)).toEqual([]);
  });
});

describe('Zurückhalten je Ebene (T-307)', () => {
  const treppe: Relation = {
    id: 'p1',
    type: 'marker',
    to: 'map-1',
    props: { kind: 'passage', passage: 'stairs', x: 0.8, y: 0.8, toFloor: 'up', toX: 0.1, toY: 0.1 },
  };

  it('eine Ebene der Leitung geht samt Markern und Treppe dorthin nicht hinaus', () => {
    let e = updateFloor(turm([treppe]), 'up', { gmOnly: true });
    e = withFloorView(e, 'up', { ...floorView(e, 'up'), relations: [{ id: 't9', type: 'marker', to: 'npc-9', props: { kind: 'play', x: 0.5, y: 0.5 } }] });
    const r = redactFloors(e);
    expect(mapFloors(r).map((f) => f.id)).toEqual([GROUND_FLOOR]);
    expect((r.relations ?? []).map((x) => x.id)).toEqual(['t1']);
  });

  it('zurückgehalten, bis die Leitung freigibt', () => {
    const e = setFloorReleased(turm(), 'up', false);
    expect(mapFloors(e).find((f) => f.id === 'up')?.released).toBe(false);
    expect(mapFloors(redactFloors(e)).map((f) => f.id)).toEqual([GROUND_FLOOR]);
    expect(mapFloors(redactFloors(setFloorReleased(e, 'up', true))).map((f) => f.id)).toEqual([GROUND_FLOOR, 'up']);
  });

  it('der Nebel siebt je Ebene: oben aufgedeckt heisst unten nicht', () => {
    let e = turm();
    e = withFloorView(e, 'up', revealArea({ ...floorView(e, 'up'), relations: [{ id: 't2', type: 'marker', to: 'npc-2', props: { kind: 'play', x: 0.5, y: 0.5 } }] }, { id: 'r', kind: 'rect', x: 0.4, y: 0.4, w: 0.2, h: 0.2 }));
    e = { ...e, relations: (e.relations ?? []).map((r) => (r.id === 't1' ? { ...r, props: { ...r.props, x: 0.5, y: 0.5 } } : r)) };
    const r = redactMap(e, { gm: false, sees: () => true });
    expect(markersOf(floorView(r, 'up')).map((m) => m.to)).toEqual(['npc-2']);
    expect(markersOf(floorView(r, GROUND_FLOOR))).toEqual([]);
  });
});

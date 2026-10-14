import { describe, expect, it } from 'vitest';
import {
  cellAt,
  cellCentre,
  cellDistance,
  drawnSheets,
  frameShare,
  gridGeometry,
  liftPoint,
  lowerPoint,
  mapAncestors,
  mapSettings,
  mapSheets,
  markersOf,
  measure,
  moveMarker,
  parseScale,
  partyPosition,
  redactMap,
  zoomStep,
  MAP_NEAR,
} from '../src/map.js';
import type { Entity, Relation } from '../src/types.js';

const karte = (id: string, map: Record<string, unknown> = {}, relations: Relation[] = [], image = 'as-1'): Entity => ({
  id,
  interfaces: ['Map'],
  name: id,
  components: { Identity: { name: id }, Map: map, Image: { image } },
  relations,
});
const marker = (id: string, to: string, props: Record<string, unknown>): Relation => ({ id, type: 'marker', to, props });
const drin = (to: string, props: Record<string, unknown>): Relation => ({ id: `in-${to}`, type: 'insideMap', to, props });

describe('sheets (REQ-130)', () => {
  it('keeps the base image first and hides it without dropping it', () => {
    const e = karte('m', { baseHidden: true, sheets: [{ id: 's1', name: 'Snow', image: 'as-2', opacity: 0.5 }] });
    expect(mapSheets(e).map((s) => s.id)).toEqual(['__base', 's1']);
    const gezeichnet = drawnSheets(e, true);
    expect(gezeichnet[0]).toMatchObject({ base: true, hidden: true });
    expect(gezeichnet[1]).toMatchObject({ id: 's1', opacity: 0.5, hidden: false });
  });
  it('leaves GM sheets out for players and lets a viewer switch a sheet off', () => {
    const e = karte('m', { sheets: [{ id: 'gm', image: 'as-2', gmOnly: true }, { id: 'p', image: 'as-3' }] });
    expect(drawnSheets(e, false).map((s) => s.id)).toEqual(['__base', 'p']);
    expect(drawnSheets(e, true, { p: false }).map((s) => s.id)).toEqual(['__base', 'gm']);
  });
});

describe('grid and measuring', () => {
  const nat = { w: 700, h: 700 };
  it('counts squares with every second diagonal double', () => {
    const s = mapSettings(karte('m', { gridShape: 'square', gridSize: 70, scale: '1,5 m' }));
    const geo = gridGeometry(s, nat)!;
    expect(cellAt(geo, { x: 0.05, y: 0.05 })).toEqual({ x: 0, y: 0 });
    expect(cellDistance(geo, { x: 0, y: 0 }, { x: 3, y: 3 })).toBe(4);
    const m = measure(s, nat, { x: 0.05, y: 0.05 }, { x: 0.45, y: 0.05 });
    expect(m).toMatchObject({ cells: 4, distance: 6, unit: 'm' });
    expect(m.text).toBe('4 squares · 6 m');
  });
  it('respects the offset', () => {
    const s = mapSettings(karte('m', { gridShape: 'square', gridSize: 70, gridOffsetX: 35 }));
    const geo = gridGeometry(s, nat)!;
    expect(cellAt(geo, { x: 0.06, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(cellAt(geo, { x: 0.04, y: 0 })).toEqual({ x: -1, y: 0 });
    expect(cellAt(geo, { x: 0.16, y: 0 })).toEqual({ x: 1, y: 0 });
  });
  it('finds hexes and their centres', () => {
    const s = mapSettings(karte('m', { gridShape: 'hex', gridSize: 70 }));
    const geo = gridGeometry(s, { w: 1000, h: 1000 })!;
    for (const c of [{ x: 0, y: 0 }, { x: 2, y: 1 }, { x: 1, y: 3 }, { x: -1, y: 4 }]) {
      expect(cellAt(geo, cellCentre(geo, c))).toEqual(c);
    }
    expect(cellDistance(geo, { x: 0, y: 0 }, { x: 2, y: 1 })).toBe(3);
  });
  it('measures straight without a grid, and nothing without a size', () => {
    const s = mapSettings(karte('m', { gridSize: 100, scale: '5 ft' }));
    expect(measure(s, { w: 1000, h: 500 }, { x: 0, y: 0 }, { x: 0.3, y: 0 })).toMatchObject({ cells: null, distance: 15, unit: 'ft' });
    expect(measure(s, null, { x: 0, y: 0 }, { x: 1, y: 1 }).text).toBe('');
  });
  it('reads a scale with a comma', () => {
    expect(parseScale('1,5 m')).toEqual({ value: 1.5, unit: 'm' });
    expect(parseScale('one league')).toBeNull();
  });
});

describe('sub-maps (REQ-131)', () => {
  const frame = { x: 0.5, y: 0.25, w: 0.2, h: 0.4 };
  it('lifts and lowers points through a frame', () => {
    const p = liftPoint({ x: 0.5, y: 0.5 }, frame);
    expect(p.x).toBeCloseTo(0.6);
    expect(p.y).toBeCloseTo(0.45);
    const q = lowerPoint(p, frame);
    expect(q.x).toBeCloseTo(0.5);
    expect(q.y).toBeCloseTo(0.5);
  });
  it('counts a missing viewport height as no measurement, not as zero', () => {
    const nat = { w: 1000, h: 1000 };
    expect(frameShare(frame, nat, 4, { w: 800, h: 0 })).toBeCloseTo(0.8);
    expect(frameShare(frame, nat, 4, { w: 800, h: 800 })).toBeCloseTo(0.8);
    expect(frameShare(frame, nat, 4, { w: 800, h: 2000 })).toBeCloseTo(0.64);
  });
  it('announces first and enters on the step after', () => {
    const nat = { w: 1000, h: 1000 };
    const viewport = { w: 800, h: 800 };
    const kinder = [{ id: 'k', frame: { x: 0.4, y: 0.4, w: 0.2, h: 0.2 } }];
    let zoom = 1;
    const schritte: string[] = [];
    for (let i = 0; i < 12; i += 1) {
      const s = zoomStep({ zoom, direction: 1, children: kinder, nat, viewport });
      if (s.kind === 'enter') {
        schritte.push('enter');
        break;
      }
      if (s.kind === 'zoom') zoom = s.zoom;
      schritte.push(frameShare(kinder[0]!.frame, nat, zoom, viewport) >= MAP_NEAR ? 'near' : 'zoom');
    }
    expect(schritte.at(-1)).toBe('enter');
    expect(schritte.at(-2)).toBe('near');
  });
  it('leaves for the map above when fully out', () => {
    expect(zoomStep({ zoom: 0.25, direction: -1, children: [], parent: 'p', nat: null, viewport: { w: 1, h: 1 } })).toEqual({ kind: 'leave', id: 'p' });
    expect(zoomStep({ zoom: 0.25, direction: -1, children: [], nat: null, viewport: { w: 1, h: 1 } })).toEqual({ kind: 'zoom', zoom: 0.25 });
  });
  it('walks up to the outermost map and stops at a circle', () => {
    const welt = karte('welt');
    const land = karte('land', {}, [drin('welt', { x: 0, y: 0 })]);
    const stadt = karte('stadt', {}, [drin('land', { x: 0, y: 0 })]);
    const byId = new Map([welt, land, stadt].map((e) => [e.id, e]));
    expect(mapAncestors(byId, stadt).map((e) => e.id)).toEqual(['welt', 'land']);
    const a = karte('a', {}, [drin('b', { x: 0, y: 0 })]);
    const b = karte('b', {}, [drin('a', { x: 0, y: 0 })]);
    expect(mapAncestors(new Map([[a.id, a], [b.id, b]]), a).map((e) => e.id)).toEqual(['b']);
  });
});

describe('party token (REQ-136)', () => {
  it('shows the finest token, lifted through the frames', () => {
    const welt = karte('welt');
    const stadt = karte('stadt', {}, [drin('welt', { x: 0.5, y: 0.5, w: 0.1, h: 0.1 }), marker('t', 'pc-1', { x: 0.5, y: 0.5, kind: 'party' })]);
    const alt = karte('alt', {}, [marker('t2', 'pt-1', { x: 0.1, y: 0.1, kind: 'party' })]);
    const maps = new Map([welt, stadt, alt].map((e) => [e.id, e]));
    const p = partyPosition(maps, welt, new Set(['pt-1', 'pc-1']))!;
    expect(p.mapId).toBe('stadt');
    expect(p.direct).toBe(false);
    expect(p.x).toBeCloseTo(0.55);
    expect(partyPosition(maps, stadt, new Set(['pc-1']))).toMatchObject({ direct: true, x: 0.5 });
    expect(partyPosition(maps, welt, new Set(['niemand']))).toBeNull();
  });
});

describe('redactMap', () => {
  const e = karte(
    'm',
    { baseGmOnly: true, sheets: [{ id: 'gm', image: 'a', gmOnly: true }, { id: 'p', image: 'b' }] },
    [
      marker('offen', 'npc-1', { x: 0.1, y: 0.1 }),
      marker('versteckt', 'npc-1', { x: 0.2, y: 0.2, hidden: true }),
      marker('geheim', 'npc-2', { x: 0.3, y: 0.3 }),
      drin('oben', { x: 0, y: 0 }),
    ],
  );
  it('keeps everything for the GM', () => {
    expect(redactMap(e, { gm: true, sees: () => false })).toBe(e);
  });
  it('drops hidden markers, markers on unseen articles, GM sheets and the GM base image', () => {
    const r = redactMap(e, { gm: false, sees: (id) => id === 'npc-1' });
    expect(markersOf(r).map((m) => m.rel.id)).toEqual(['offen']);
    expect(r.relations!.some((x) => x.type === 'insideMap')).toBe(false);
    expect(mapSheets(r).map((s) => s.id)).toEqual(['__base', 'p']);
    expect(r.components['Image']).toBeUndefined();
  });
  it('moves a marker without touching its other props', () => {
    const m = moveMarker(e, 'offen', { x: 0.123456, y: 2 });
    expect(markersOf(m)[0]!.rel.props).toMatchObject({ x: 0.1235, y: 1 });
  });
});

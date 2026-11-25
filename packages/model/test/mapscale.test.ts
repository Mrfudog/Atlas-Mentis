import { describe, expect, it } from 'vitest';
import { cellAt, cellCentre, gridGeometry, mapSettings, partyPosition, type MapSettings } from '../src/map.js';
import { mapLinkOf } from '../src/maplinks.js';
import {
  alignLink,
  alignedSize,
  convertDistance,
  feetPerPixel,
  feetToScaleUnit,
  mapNatOf,
  routeFeet,
  snapToParentGrid,
  type ScaledMap,
} from '../src/mapscale.js';
import type { Entity, Relation } from '../src/types.js';

const einst = (s: Partial<MapSettings>): ScaledMap['settings'] => ({ gridShape: 'square', gridSize: 100, gridOffsetX: 0, gridOffsetY: 0, scale: '5 ft', ...s });
const kante = (props: Record<string, unknown>): Relation => ({ id: 'r', type: 'insideMap', to: 'oben', props }) as Relation;

/* Regionskarte: 2000×1000 px, Hex 100 px breit = 1 mi. Stadtkarte: 1000×800 px, Quadrat 50 px = 50 ft. */
const region: ScaledMap = { settings: einst({ gridShape: 'hex', gridSize: 100, scale: '1 mi' }), nat: { w: 2000, h: 1000 } };
const stadt: ScaledMap = { settings: einst({ gridSize: 50, scale: '50 ft' }), nat: { w: 1000, h: 800 } };

describe('Gitter über den Massstab (T-329)', () => {
  it('rechnet Fuss je Bildpunkt und Strecken zwischen Einheiten', () => {
    expect(feetPerPixel(region.settings)).toBeCloseTo(52.8);
    expect(feetPerPixel(stadt.settings)).toBe(1);
    expect(feetToScaleUnit(2640, '1 mi')).toBeCloseTo(0.5);
    expect(convertDistance(1000, '50 ft', '1 mi')).toBeCloseTo(1000 / 5280);
    expect(convertDistance(1, '1 mi', '5 ft')).toBeCloseTo(5280);
    /* Tischregel: 1,5 m sind 5 ft. */
    expect(convertDistance(3, '1,5 m', '5 ft')).toBeCloseTo(10);
    expect(convertDistance(1, '1 day', '1 mi')).toBeNull();
  });

  it('Hex über Quadrat: Grösse aus beiden Massstäben, Mitte in der Mitte eines Hexes', () => {
    const g = alignedSize(region, stadt);
    if (typeof g === 'string') throw new Error(g);
    /* 1000 ft Stadt = 1000/52,8 px Region ≈ 18,94 px von 2000. */
    expect(g.w).toBeCloseTo(1000 / 52.8 / 2000);
    expect(g.h).toBeCloseTo(800 / 52.8 / 1000);
    const l = alignLink(mapLinkOf(kante({ x: 0.31, y: 0.42, w: 0.2, h: 0.2, align: true }))!, kante({ align: true }), region, stadt);
    expect(l.align).toBe(true);
    expect(l.alignIssue).toBeUndefined();
    expect(l.frame.w).toBeCloseTo(g.w, 5);
    const geo = gridGeometry(region.settings as MapSettings, region.nat)!;
    const mitte = { x: l.frame.x + l.frame.w / 2, y: l.frame.y + l.frame.h / 2 };
    const c = cellCentre(geo, cellAt(geo, mitte));
    expect(mitte.x).toBeCloseTo(c.x, 5);
    expect(mitte.y).toBeCloseTo(c.y, 5);
    expect(l.childGrid).toEqual({ shape: 'square', cell: 0.05, ox: 0, oy: 0 });
  });

  it('Quadrat über Quadrat: linke obere Ecke an der Gitterecke, auch mit Versatz', () => {
    const oben: ScaledMap = { settings: einst({ gridSize: 100, gridOffsetX: 30, gridOffsetY: 10, scale: '50 ft' }), nat: { w: 1000, h: 1000 } };
    const unten: ScaledMap = { settings: einst({ gridSize: 70, scale: '5 ft' }), nat: { w: 700, h: 1400 } };
    /* 10×20 Felder à 5 ft = 50×100 ft = 1×2 Felder oben = 0,1×0,2. */
    const l = alignLink(mapLinkOf(kante({ x: 0.4, y: 0.4, w: 0.3, h: 0.3 }))!, kante({ align: true }), oben, unten);
    expect(l.frame.w).toBeCloseTo(0.1);
    expect(l.frame.h).toBeCloseTo(0.2);
    expect(((l.frame.x * 1000 - 30) / 100) % 1).toBeCloseTo(0);
    expect(((l.frame.y * 1000 - 10) / 100) % 1).toBeCloseTo(0);
    /* Die Mitte bleibt in der Nähe: höchstens ein halbes Feld daneben. */
    expect(Math.abs(l.frame.x + 0.05 - 0.55)).toBeLessThanOrEqual(0.05 + 1e-9);
  });

  it('nimmt eine Form mit: das Vieleck wird in den neuen Kasten gestreckt', () => {
    const oben: ScaledMap = { settings: einst({ gridSize: 100, scale: '50 ft' }), nat: { w: 1000, h: 1000 } };
    const unten: ScaledMap = { settings: einst({ gridSize: 70, scale: '5 ft' }), nat: { w: 700, h: 700 } };
    const area = [
      [0.2, 0.2],
      [0.6, 0.2],
      [0.4, 0.6],
    ];
    const rel = kante({ area, align: true });
    const l = alignLink(mapLinkOf(rel)!, rel, oben, unten);
    expect(l.frame).toEqual({ x: 0.4, y: 0.4, w: 0.1, h: 0.1 });
    expect(l.area).toEqual([
      [0.4, 0.4],
      [0.5, 0.4],
      [0.45, 0.5],
    ]);
  });

  it('ohne Schalter unverändert; mit „1 day" oder ohne Bildgrösse die freie Grösse und der Grund', () => {
    const roh = mapLinkOf(kante({ x: 0.1, y: 0.1, w: 0.3, h: 0.2 }))!;
    expect(alignLink(roh, kante({}), region, stadt)).toEqual({ ...roh, align: false });
    const tag = alignLink(roh, kante({ align: true }), { ...region, settings: einst({ gridShape: 'hex', scale: '1 day' }) }, stadt);
    expect(tag.alignIssue).toBe('units');
    expect(tag.frame).toEqual(roh.frame);
    expect(alignLink(roh, kante({ align: true }), region, { ...stadt, nat: null }).alignIssue).toBe('size');
  });

  it('rastet ohne Gitter nicht ein', () => {
    const f = { x: 0.123, y: 0.456, w: 0.1, h: 0.1 };
    expect(snapToParentGrid(f, { settings: einst({ gridShape: 'none' }), nat: { w: 100, h: 100 } })).toEqual(f);
  });

  it('zählt einen Weg über zwei Karten zusammen und nennt das Stück ohne Länge', () => {
    const r = routeFeet([
      { ...stadt, points: [{ x: 0, y: 0 }, { x: 0.5, y: 0 }] },
      { ...region, points: [{ x: 0, y: 0 }, { x: 0.05, y: 0 }] },
      { settings: einst({ scale: '1 day' }), nat: { w: 10, h: 10 }, points: [{ x: 0, y: 0 }, { x: 1, y: 0 }] },
    ]);
    /* 500 ft in der Stadt, 100 px · 52,8 = 1 mi in der Region. */
    expect(r.feet).toBeCloseTo(500 + 5280);
    expect(r.skipped).toEqual([2]);
  });

  it('liest die Bildgrösse am Asset und rechnet die Gruppe durch den ausgerichteten Rahmen', () => {
    const asset = { id: 'a', interfaces: ['Asset'], components: { Asset: { width: 1000, height: 1000 } } } as unknown as Entity;
    const oben = { id: 'oben', interfaces: ['Map'], components: { Image: { image: 'a' }, Map: { gridShape: 'square', gridSize: 100, scale: '50 ft' } } } as unknown as Entity;
    const asset2 = { id: 'b', interfaces: ['Asset'], components: { Asset: { width: 700, height: 700 } } } as unknown as Entity;
    const unten = {
      id: 'unten',
      interfaces: ['Map'],
      components: { Image: { image: 'b' }, Map: { gridShape: 'square', gridSize: 70, scale: '5 ft' } },
      relations: [
        { id: 'k', type: 'insideMap', to: 'oben', props: { x: 0.4, y: 0.4, w: 0.5, h: 0.5, align: true } },
        { id: 'm', type: 'marker', to: 'p', props: { x: 0.5, y: 0.5, kind: 'party' } },
      ],
    } as unknown as Entity;
    const byId = new Map([asset, asset2, oben, unten].map((e) => [e.id, e]));
    expect(mapNatOf(byId, oben)).toEqual({ w: 1000, h: 1000 });
    const frei = partyPosition(byId, oben, new Set(['p']))!;
    expect(frei.x).toBeCloseTo(0.65);
    const sm = (e: Entity): ScaledMap => ({ settings: mapSettings(e), nat: mapNatOf(byId, e) });
    const ausgerichtet = partyPosition(byId, oben, new Set(['p']), (c, rel) => {
      const p = byId.get(rel.to)!;
      return alignLink(mapLinkOf(rel)!, rel, sm(p), sm(c)).frame;
    })!;
    /* Mitte 0,65 → Kasten 0,1 breit um 0,65, eingerastet bei 0,6 (oder 0,7) → Mitte 0,65 (0,75). */
    expect([0.65, 0.75].some((v) => Math.abs(ausgerichtet.x - v) < 1e-6)).toBe(true);
  });
});

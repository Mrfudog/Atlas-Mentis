/**
 * **Das Raster des Zugplans** (T-349): Verbündete sind passierbar, aber
 * kein Halt; schwieriges Gelände aus den Zonen der Karte kostet doppelt;
 * und ein eingereichter Weg lässt sich nachrechnen. Erfundene Artikel.
 */
import { describe, expect, it } from 'vitest';
import {
  gridGeometry,
  mapTerrain,
  markerOf,
  pathFeet,
  planGrid,
  planPath,
  planReach,
  terrainCosts,
  type Entity,
} from '../src/index.js';

/* Zehn mal zehn Felder zu 10 px. */
const geo = gridGeometry({ gridShape: 'square', gridSize: 10, gridOffsetX: 0, gridOffsetY: 0, scale: '5 ft', baseHidden: false, baseGmOnly: false }, { w: 100, h: 100 })!;
const feld = (x: number, y: number) => ({ x: (x + 0.5) / 10, y: (y + 0.5) / 10 });
const token = (rel: string, to: string, x: number, y: number) => markerOf({ id: rel, type: 'marker', to, props: feld(x, y) });

/* Ein Gang, eine Reihe hoch: die Wände halten oben und unten. */
const gang = [
  { x1: 0, y1: 0, x2: 10, y2: 0 },
  { x1: 0, y1: 1, x2: 10, y2: 1 },
];

describe('T-349: Verbündete sind passierbar', () => {
  const ich = token('m1', 'pc', 0, 0);
  const freund = token('m2', 'ally', 1, 0);

  it('ohne Angabe sperrt jedes andere Token, wie bisher', () => {
    const grid = { ...planGrid(geo, [ich, freund], 'm1')!, walls: gang };
    expect(planPath(grid, { x: 0, y: 0 }, { x: 3, y: 0 }, 30)).toBeNull();
  });

  it('durch einen Verbündeten geht der Weg, stehen bleiben darf man auf ihm nicht', () => {
    const grid = { ...planGrid(geo, [ich, freund], 'm1', [], { passable: ['m2'] })!, walls: gang };
    const weg = planPath(grid, { x: 0, y: 0 }, { x: 3, y: 0 }, 30)!;
    expect(weg.feet).toBe(15);
    expect(weg.path).toContainEqual({ x: 1, y: 0 });
    expect(planPath(grid, { x: 0, y: 0 }, { x: 1, y: 0 }, 30)).toBeNull();
    expect('1,0' in planReach(grid, { x: 0, y: 0 }, 30)).toBe(false);
  });
});

describe('T-349: schwieriges Gelände aus den Zonen der Karte', () => {
  const schlamm: Entity = { id: 'zk_mud', name: 'Mud', interfaces: ['ZoneKind'], components: { ZoneKind: { moveCost: 2 } }, relations: [] };
  const licht: Entity = { id: 'zk_dark', name: 'Dark', interfaces: ['ZoneKind'], components: { ZoneKind: { light: 'dark' } }, relations: [] };
  const falle: Entity = { id: 'zk_tar', name: 'Tar', interfaces: ['ZoneKind'], components: { ZoneKind: { moveCost: 3, hiddenUntil: 15 } }, relations: [] };
  const arten = new Map([schlamm, licht, falle].map((e) => [e.id, e]));
  /* Felder 2 und 3 der ersten Reihe Schlamm, 0–9 dunkel, 5 versteckter Teer. */
  const karte: Entity = {
    id: 'map', name: 'Map', interfaces: ['Map'], components: {},
    relations: [
      { id: 'z1', type: 'zone', to: 'zk_mud', props: { kind: 'rect', x: 0.2, y: 0, w: 0.2, h: 0.1 } },
      { id: 'z2', type: 'zone', to: 'zk_dark', props: { kind: 'rect', x: 0, y: 0, w: 1, h: 0.1 } },
      { id: 'z3', type: 'zone', to: 'zk_tar', props: { kind: 'rect', x: 0.5, y: 0, w: 0.1, h: 0.1 } },
    ],
  };

  it('nimmt nur Zonen mit Kosten über 1, versteckte nur für die Leitung', () => {
    expect(mapTerrain(karte, arten).map((t) => t.cost)).toEqual([2]);
    expect(mapTerrain(karte, arten, { hidden: true }).map((t) => t.cost)).toEqual([2, 3]);
    expect(mapTerrain({ ...karte, relations: [{ ...karte.relations![2]!, props: { ...karte.relations![2]!.props, found: true } }] }, arten).map((t) => t.cost)).toEqual([3]);
  });

  it('rastert sie aufs Gitter: das teuerste Feld zählt', () => {
    const c = terrainCosts(geo, 10, 10, mapTerrain(karte, arten, { hidden: true }));
    expect(c).toEqual({ '2,0': 2, '3,0': 2, '5,0': 3 });
  });

  it('ein Weg durch Schlamm kostet doppelt', () => {
    const ich = token('m1', 'pc', 0, 0);
    const grid = { ...planGrid(geo, [ich], 'm1', [], { terrain: mapTerrain(karte, arten) })!, walls: gang };
    /* 5 + 10 + 10 + 5 */
    expect(planPath(grid, { x: 0, y: 0 }, { x: 4, y: 0 }, 60)!.feet).toBe(30);
    expect(planPath(grid, { x: 0, y: 0 }, { x: 4, y: 0 }, 25)).toBeNull();
  });
});

describe('T-349: ein eingereichter Weg wird nachgerechnet', () => {
  const ich = token('m1', 'pc', 0, 0);
  const feind = token('m2', 'gob', 2, 0);
  const freund = token('m3', 'ally', 1, 1);
  const grid = planGrid(geo, [ich, feind, freund], 'm1', [], { passable: ['m3'], terrain: [{ shape: { id: 'z', kind: 'rect', x: 0, y: 0.2, w: 1, h: 0.1 }, cost: 2 }] })!;

  it('zählt die Fuss nach Gelände und Diagonalen', () => {
    expect(pathFeet(grid, [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }])?.feet).toBe(15);
    expect(pathFeet(grid, [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }])?.feet).toBe(5 + 20);
  });

  it('lehnt einen Weg durch einen Gegner, durch eine Wand oder mit Ende auf einem Verbündeten ab', () => {
    expect(pathFeet(grid, [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }])).toBeNull();
    expect(pathFeet(grid, [{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBeNull();
    expect(pathFeet(grid, [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }])?.feet).toBe(10);
    expect(pathFeet({ ...grid, walls: gang }, [{ x: 0, y: 0 }, { x: 0, y: 1 }])).toBeNull();
    expect(pathFeet(grid, [{ x: 0, y: 0 }, { x: 2, y: 0 }])).toBeNull();
  });
});

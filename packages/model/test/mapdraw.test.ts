import { describe, expect, it } from 'vitest';
import {
  addWallsCut,
  canJoinAround,
  cutWalls,
  doorRect,
  gridFromCell,
  gridOrigin,
  joinAround,
  mapSettings,
  mapWalls,
  moveWallPoint,
  outlineWalls,
  removeJoined,
  setGrid,
  shapeClosed,
  shapeOutline,
  snapPoint,
  wallPoints,
  ELLIPSE_STEPS,
  gridStroke,
  markersOf,
  setMarkerSize,
  snapTokenCentre,
  tokenSpan,
  type MapWall,
} from '../src/index.js';
import type { Entity } from '../src/types.js';

const karte = (walls: unknown[] = []): Entity => ({
  id: 'k1',
  interfaces: ['Map'],
  components: {
    Map: { gridShape: 'square', gridSize: 100, walls },
    Image: { image: 'as-1' },
  },
  relations: [],
});

let n = 0;
const id = (): string => `n${++n}`;

describe('Formen (T-304)', () => {
  it('Linienzug schliesst nur mit dem Schalter, Polygon und Rechteck immer', () => {
    expect(shapeClosed('polyline', false)).toBe(false);
    expect(shapeClosed('polyline', true)).toBe(true);
    expect(shapeClosed('polygon', false)).toBe(true);
    expect(shapeClosed('rect', false)).toBe(true);
    expect(shapeClosed('line', true)).toBe(false);
  });

  it('ein geschlossener Linienzug bekommt die Strecke zurück zum Anfang', () => {
    const pts = [
      { x: 0.1, y: 0.1 },
      { x: 0.5, y: 0.1 },
      { x: 0.5, y: 0.5 },
    ];
    expect(outlineWalls(shapeOutline('polyline', pts, false), 'wall', id)).toHaveLength(2);
    const zu = outlineWalls(shapeOutline('polyline', pts, true), 'wall', id);
    expect(zu).toHaveLength(3);
    expect(zu[2]).toMatchObject({ x1: 0.5, y1: 0.5, x2: 0.1, y2: 0.1 });
  });

  it('ein Rechteck aus zwei Ecken ist vier Wände, eine Ellipse ein Polygon', () => {
    const r = outlineWalls(
      shapeOutline('rect', [
        { x: 0.6, y: 0.6 },
        { x: 0.2, y: 0.3 },
      ]),
      'wall',
      id,
    );
    expect(r).toHaveLength(4);
    expect(r[0]).toMatchObject({ x1: 0.2, y1: 0.3, x2: 0.6, y2: 0.3 });
    const el = shapeOutline('ellipse', [
      { x: 0.2, y: 0.2 },
      { x: 0.4, y: 0.6 },
    ]);
    expect(el.pts).toHaveLength(ELLIPSE_STEPS);
    expect(el.closed).toBe(true);
    expect(outlineWalls(el, 'wall', id)).toHaveLength(ELLIPSE_STEPS);
    expect(
      shapeOutline('rect', [
        { x: 0.2, y: 0.2 },
        { x: 0.2, y: 0.6 },
      ]).pts,
    ).toEqual([]);
  });

  it('eine Tür kommt zu und mit ihrer Dicke; gespeichert und wieder gelesen', () => {
    const [t] = outlineWalls(
      shapeOutline('line', [
        { x: 0.1, y: 0.5 },
        { x: 0.2, y: 0.5 },
      ]),
      'door',
      id,
      0.02,
    );
    expect(t).toMatchObject({ kind: 'door', state: 'closed', width: 0.02 });
    const { entity } = addWallsCut(karte(), [t!], {
      cut: false,
      ar: 1,
      tol: 0.001,
      newId: id,
    });
    expect(mapWalls(entity)[0]!.width).toBe(0.02);
  });

  it('das Türviereck liegt quer zur Linie, halb nach jeder Seite', () => {
    const r = doorRect({ x1: 0.1, y1: 0.5, x2: 0.3, y2: 0.5, width: 0.02 }, 1, 0.01);
    expect(r.map((p) => p.y.toFixed(3))).toEqual(['0.510', '0.510', '0.490', '0.490']);
    /* Auf einer Karte halb so hoch wie breit ist dieselbe Dicke in Anteilen der Höhe doppelt. */
    const s = doorRect({ x1: 0.1, y1: 0.5, x2: 0.3, y2: 0.5 }, 0.5, 0.02);
    expect(s[0]!.y - s[3]!.y).toBeCloseTo(0.04);
  });
});

describe('Einrasten mit Stärke (T-304)', () => {
  const grid = {
    shape: 'square' as const,
    size: 100,
    ox: 0,
    oy: 0,
    w: 1000,
    h: 1000,
  };

  it('rastet innerhalb des Radius an der Gitterecke, ausserhalb nicht', () => {
    expect(snapPoint({ x: 0.205, y: 0.298 }, { grid }, 0.01, 1)).toEqual({
      pt: { x: 0.2, y: 0.3 },
      to: 'grid',
    });
    expect(snapPoint({ x: 0.23, y: 0.3 }, { grid }, 0.01, 1).to).toBeNull();
    expect(snapPoint({ x: 0.23, y: 0.3 }, { grid }, 0.05, 1).to).toBe('grid');
    expect(snapPoint({ x: 0.205, y: 0.3 }, { grid }, 0, 1).to).toBeNull();
  });

  it('ein vorhandener Punkt geht vor der Gitterecke, die Ecke vor der Linie', () => {
    const p = { x: 0.207, y: 0.3 };
    expect(snapPoint({ x: 0.205, y: 0.3 }, { grid, points: [p] }, 0.01, 1)).toEqual({ pt: p, to: 'point' });
    const w: MapWall = {
      id: 'w',
      kind: 'wall',
      x1: 0.25,
      y1: 0,
      x2: 0.25,
      y2: 1,
    };
    expect(snapPoint({ x: 0.248, y: 0.31 }, { grid, walls: [w] }, 0.01, 1)).toEqual({ pt: { x: 0.25, y: 0.31 }, to: 'line' });
  });

  it('der Radius gilt im Raum mit gleichen Achsen', () => {
    /* Halb so hoch wie breit: 0.02 in y sind 0.01 in Breitenanteilen. */
    const q = { x: 0.5, y: 0.52 };
    expect(snapPoint({ x: 0.5, y: 0.5 }, { points: [q] }, 0.011, 0.5).to).toBe('point');
    expect(snapPoint({ x: 0.5, y: 0.5 }, { points: [q] }, 0.011, 1).to).toBeNull();
  });
});

describe('Punkte (T-304)', () => {
  it('zeigt jede Ecke einmal und verschiebt verbundene Enden zusammen', () => {
    const e = karte([
      { id: 'a', kind: 'wall', x1: 0.1, y1: 0.1, x2: 0.5, y2: 0.1 },
      { id: 'b', kind: 'wall', x1: 0.5, y1: 0.1, x2: 0.5, y2: 0.5 },
    ]);
    expect(wallPoints(mapWalls(e), 1)).toHaveLength(3);
    const neu = mapWalls(moveWallPoint(e, { x: 0.5, y: 0.1 }, { x: 0.6, y: 0.2 }, 1));
    expect(neu[0]).toMatchObject({ x2: 0.6, y2: 0.2 });
    expect(neu[1]).toMatchObject({ x1: 0.6, y1: 0.2 });
  });

  it('eine Sperre, die zum Punkt wird, fällt weg', () => {
    const e = karte([{ id: 'a', kind: 'wall', x1: 0.1, y1: 0.1, x2: 0.5, y2: 0.1 }]);
    expect(mapWalls(moveWallPoint(e, { x: 0.5, y: 0.1 }, { x: 0.1, y: 0.1 }, 1))).toHaveLength(0);
  });
});

describe('Schneiden und Zusammenfügen (T-304)', () => {
  const wand: MapWall = {
    id: 'w',
    kind: 'wall',
    x1: 0.1,
    y1: 0.5,
    x2: 0.9,
    y2: 0.5,
  };
  const tuer: MapWall = {
    id: 't',
    kind: 'door',
    x1: 0.4,
    y1: 0.5,
    x2: 0.5,
    y2: 0.5,
    state: 'closed',
  };

  it('eine Tür teilt die Wand und lässt sie genau an ihren Rändern enden', () => {
    const r = cutWalls([wand], tuer, 1, 0.002, () => 'w2');
    expect(r.cut).toBe(1);
    expect(r.walls).toEqual([
      { ...wand, x2: 0.4, y2: 0.5 },
      { ...wand, id: 'w2', x1: 0.5, y1: 0.5 },
    ]);
  });

  it('verkehrt gezogen, am Rand oder knapp daneben: gleich', () => {
    const verkehrt = { ...tuer, x1: 0.5, x2: 0.4 };
    expect(cutWalls([wand], verkehrt, 1, 0.002, () => 'w2').walls[0]).toMatchObject({ x2: 0.4 });
    const amRand = { ...tuer, x1: 0.1, x2: 0.2 };
    expect(cutWalls([wand], amRand, 1, 0.002, id).walls).toEqual([{ ...wand, x1: 0.2 }]);
    const knapp = { ...tuer, y1: 0.501, y2: 0.501 };
    expect(cutWalls([wand], knapp, 1, 0.002, id).cut).toBe(1);
  });

  it('schneidet nicht, was nicht auf der Geraden liegt, und keine andere Tür', () => {
    expect(cutWalls([wand], { ...tuer, y1: 0.45, y2: 0.55 }, 1, 0.002, id).cut).toBe(0);
    expect(cutWalls([wand], { ...tuer, y1: 0.52, y2: 0.52 }, 1, 0.002, id).cut).toBe(0);
    expect(cutWalls([{ ...tuer, id: 'alt' }], tuer, 1, 0.002, id).cut).toBe(0);
    expect(cutWalls([wand], { ...tuer, x1: 0.95, x2: 0.99 }, 1, 0.002, id).cut).toBe(0);
  });

  it('nimmt man die Tür weg, wird die Wand wieder eine', () => {
    const { entity } = addWallsCut(karte([wand]), [tuer], {
      cut: true,
      ar: 1,
      tol: 0.002,
      newId: () => 'w2',
    });
    expect(mapWalls(entity)).toHaveLength(3);
    expect(canJoinAround(entity, 't', 1, 0.002)).toBe(true);
    const zurueck = mapWalls(removeJoined(entity, 't', 1, 0.002));
    expect(zurueck).toEqual([{ ...wand }]);
  });

  it('mit einem Teil reicht es wieder über die Öffnung; ohne Teil nichts', () => {
    const r = joinAround([{ ...wand, x2: 0.4 }, tuer], tuer, 1, 0.002);
    expect(r.joined).toBe(true);
    expect(r.walls[0]).toMatchObject({ x1: 0.1, x2: 0.5 });
    expect(joinAround([tuer], tuer, 1, 0.002).joined).toBe(false);
  });

  it('ohne Schalter bleibt die Wand ganz', () => {
    const { entity, cut } = addWallsCut(karte([wand]), [tuer], {
      cut: false,
      ar: 1,
      tol: 0.002,
      newId: id,
    });
    expect(cut).toBe(0);
    expect(mapWalls(entity)).toHaveLength(2);
  });

  it('Unlesbares in der Liste bleibt stehen', () => {
    const e = karte([{ kaputt: true }, wand]);
    const { entity } = addWallsCut(e, [tuer], {
      cut: true,
      ar: 1,
      tol: 0.002,
      newId: id,
    });
    expect((entity.components['Map'] as { walls: unknown[] }).walls[0]).toEqual({ kaputt: true });
  });
});

describe('Gitter auf der Karte setzen (T-304)', () => {
  const nat = { w: 1000, h: 500 };
  it('zwei Ecken eines Feldes geben Grösse und Versatz', () => {
    expect(gridFromCell({ x: 0.25, y: 0.3 }, { x: 0.3, y: 0.4 }, nat)).toEqual({
      gridSize: 50,
      gridOffsetX: 0,
      gridOffsetY: 0,
    });
    expect(gridFromCell({ x: 0.263, y: 0.33 }, { x: 0.313, y: 0.43 }, nat)).toEqual({ gridSize: 50, gridOffsetX: 13, gridOffsetY: 15 });
    expect(gridFromCell({ x: 0.2, y: 0.2 }, { x: 0.201, y: 0.2 }, nat)).toBeNull();
  });

  it('der Ursprung legt zwei Linien auf den Punkt; setGrid schreibt die Einstellungen', () => {
    expect(gridOrigin({ x: 0.123, y: 0.5 }, nat, 70)).toEqual({
      gridOffsetX: 53,
      gridOffsetY: 40,
    });
    const s = mapSettings(setGrid(karte(), { gridShape: 'hex', gridSize: 2, gridOffsetX: 12.345 }));
    expect(s).toMatchObject({
      gridShape: 'hex',
      gridSize: 4,
      gridOffsetX: 12.35,
    });
  });
});

describe('Gitter gestalten (T-314)', () => {
  it('liest Farbe, Deckkraft, Ausblenden und Einrasten mit Vorgaben', () => {
    const s = mapSettings(karte());
    expect(s).toMatchObject({ gridColor: '', gridOpacity: 0.5, gridHidden: false, snapTokens: true });
    expect(gridStroke(s)).toBe('rgba(60, 40, 20, 0.5)');
    const t = mapSettings(setGrid(karte(), { gridColor: '#FF0000', gridOpacity: 1.7, gridHidden: true, snapTokens: false }));
    expect(t).toMatchObject({ gridColor: '#ff0000', gridOpacity: 1, gridHidden: true, snapTokens: false });
    expect(gridStroke(t)).toBeNull();
    expect(gridStroke({ ...t, gridHidden: false })).toBe('rgba(255, 0, 0, 1)');
    expect(mapSettings(setGrid(setGrid(karte(), { gridColor: '#00ff00' }), { gridColor: '' })).gridColor).toBe('');
  });
});

describe('Tokens am Gitter (T-317)', () => {
  const geo = { shape: 'square' as const, size: 100, rowHeight: 100, cellFeet: 5, ox: 0, oy: 0, w: 1000, h: 1000 };

  it('der Platz: am Token, sonst nach Statblock und Kampagne, sonst ein Feld', () => {
    expect(tokenSpan(1.5, 'huge')).toBe(1.5);
    expect(tokenSpan(null, 'Large')).toBe(2);
    expect(tokenSpan(null, 'tiny')).toBe(1);
    expect(tokenSpan(null, 'tiny', 'tinyHalf')).toBe(0.5);
    expect(tokenSpan(null, null)).toBe(1);
  });

  it('rastet ein Feld in die Mitte, zwei auf die Ecke, ein halbes ins Viertel', () => {
    expect(snapTokenCentre({ x: 0.23, y: 0.31 }, geo, 1)).toEqual({ x: 0.25, y: 0.35 });
    expect(snapTokenCentre({ x: 0.23, y: 0.31 }, geo, 2)).toEqual({ x: 0.2, y: 0.3 });
    expect(snapTokenCentre({ x: 0.23, y: 0.31 }, geo, 3)).toEqual({ x: 0.25, y: 0.35 });
    expect(snapTokenCentre({ x: 0.23, y: 0.31 }, geo, 0.5)).toEqual({ x: 0.225, y: 0.325 });
    expect(snapTokenCentre({ x: 0.23, y: 0.31 }, geo, 1.5)).toEqual({ x: 0.225, y: 0.325 });
    expect(snapTokenCentre({ x: 0.23, y: 0.31 }, null, 1)).toEqual({ x: 0.23, y: 0.31 });
  });

  it('auf Hex in die Mitte des Feldes', () => {
    const hex = { ...geo, shape: 'hex' as const, rowHeight: (100 * 2) / Math.sqrt(3) };
    const p = snapTokenCentre({ x: 0.052, y: 0.06 }, hex, 1);
    expect(p.x).toBeCloseTo(0.05);
    expect(p.y).toBeCloseTo(hex.rowHeight / 2 / 1000);
  });

  it('setzt und nimmt die Grösse am Token', () => {
    const e: Entity = { ...karte(), relations: [{ id: 'm1', type: 'marker', to: 'x', props: { x: 0.5, y: 0.5 } }] };
    expect(markersOf(e)[0]!.ownSize).toBeNull();
    const g = setMarkerSize(e, 'm1', 0.5);
    expect(markersOf(g)[0]!.ownSize).toBe(0.5);
    expect(markersOf(setMarkerSize(g, 'm1', null))[0]!.ownSize).toBeNull();
  });
});

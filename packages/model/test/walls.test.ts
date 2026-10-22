import { describe, expect, it } from 'vitest';
import {
  addWalls,
  hasSightWalls,
  inShape,
  mapWalls,
  nearestWall,
  planGrid,
  redactMap,
  revealAlong,
  revealShapes,
  removeWall,
  setDoorState,
  setWallKind,
  sightPolygon,
  sightReveal,
  snapToGrid,
  visionPolygon,
  wallBlocks,
  wallsClear,
  gridGeometry,
  mapSettings,
  stepBlocked,
  type MapWall,
} from '../src/index.js';
import type { Entity } from '../src/types.js';

const karte = (map: Record<string, unknown> = {}): Entity => ({
  id: 'k1',
  interfaces: ['Map'],
  components: { Map: { gridShape: 'square', gridSize: 100, ...map }, Image: { image: 'as-1' } },
  relations: [],
});

/** Eine Wand senkrecht in der Mitte, von oben bis knapp über den Boden. */
const mitte: MapWall = { id: 'w1', kind: 'wall', x1: 0.5, y1: 0, x2: 0.5, y2: 0.8 };

describe('Sperren lesen und schreiben', () => {
  it('liest Arten, Türzustand und den alten Schalter `open`', () => {
    const e = karte({
      walls: [
        { id: 'a', x1: 0, y1: 0, x2: 1, y2: 0 },
        { id: 'b', kind: 'door', x1: 0, y1: 0, x2: 0, y2: 1, open: true },
        { id: 'c', kind: 'secret', x1: 0, y1: 0, x2: 0.2, y2: 0 },
        { id: 'd', kind: 'unbekannt', x1: 0, y1: 0, x2: 0.3, y2: 0 },
        { id: 'e', kind: 'window', x1: 0.1, y1: 0.1, x2: 0.1, y2: 0.1 },
        'Unsinn',
      ],
    });
    const w = mapWalls(e);
    expect(w.map((x) => [x.id, x.kind, x.state])).toEqual([
      ['a', 'wall', undefined],
      ['b', 'door', 'open'],
      ['c', 'secret', 'closed'],
      ['d', 'wall', undefined],
    ]);
  });

  it('hält je Art Bewegung, Sicht, Licht — eine offene Tür nichts', () => {
    expect(wallBlocks({ kind: 'wall' })).toEqual({ move: true, sight: true, light: true });
    expect(wallBlocks({ kind: 'window' })).toEqual({ move: true, sight: false, light: false });
    expect(wallBlocks({ kind: 'chasm' }).sight).toBe(false);
    expect(wallBlocks({ kind: 'invisible' }).move).toBe(true);
    expect(wallBlocks({ kind: 'door', state: 'open' })).toEqual({ move: false, sight: false, light: false });
    expect(wallBlocks({ kind: 'door', state: 'locked' }).move).toBe(true);
  });

  it('legt an, schaltet, wechselt die Art und nimmt weg', () => {
    let e = addWalls(karte(), [{ ...mitte, kind: 'door', x1: 0.123456 }]);
    expect((e.components!['Map'] as { walls: unknown[] }).walls).toEqual([{ id: 'w1', kind: 'door', x1: 0.1235, y1: 0, x2: 0.5, y2: 0.8, state: 'closed' }]);
    e = setDoorState(e, 'w1', 'locked');
    expect(mapWalls(e)[0]!.state).toBe('locked');
    e = setWallKind(e, 'w1', 'window');
    expect(mapWalls(e)[0]).toEqual({ id: 'w1', kind: 'window', x1: 0.1235, y1: 0, x2: 0.5, y2: 0.8 });
    expect(setDoorState(e, 'w1', 'open')).toEqual(e);
    expect(mapWalls(removeWall(e, 'w1'))).toEqual([]);
  });

  it('findet die nächste Sperre und rastet ans Gitter', () => {
    const w = [mitte, { id: 'w2', kind: 'door' as const, x1: 0, y1: 0.5, x2: 0.2, y2: 0.5, state: 'closed' as const }];
    expect(nearestWall(w, { x: 0.51, y: 0.4 }, 1, 0.05)?.id).toBe('w1');
    expect(nearestWall(w, { x: 0.3, y: 0.4 }, 1, 0.05)).toBeNull();
    expect(nearestWall(w, { x: 0.3, y: 0.45 }, 1, 0.2, (x) => x.kind === 'door')?.id).toBe('w2');
    const geo = { size: 100, ox: 0, oy: 0, w: 1000, h: 500 };
    expect(snapToGrid({ x: 0.198, y: 0.41 }, geo)).toEqual({ x: 0.2, y: 0.4 });
    expect(snapToGrid({ x: 0.15, y: 0.45 }, geo)).toEqual({ x: 0.15, y: 0.45 });
  });
});

describe('Sichtpolygon', () => {
  it('ohne Sperren: der ganze Kasten', () => {
    const p = visionPolygon({ x: 0.5, y: 0.5 }, [], { w: 1, h: 1 });
    expect(p).toHaveLength(4);
    const poly = { id: 'p', kind: 'poly' as const, pts: p };
    expect(inShape(poly, { x: 0.01, y: 0.99 })).toBe(true);
  });

  it('hinter der Wand ist es dunkel, um ihr Ende herum nicht', () => {
    const pts = sightPolygon([mitte], { x: 0.25, y: 0.5 }, 1);
    const poly = { id: 'p', kind: 'poly' as const, pts };
    expect(inShape(poly, { x: 0.1, y: 0.1 })).toBe(true);
    expect(inShape(poly, { x: 0.75, y: 0.3 })).toBe(false);
    /* Unter dem Ende der Wand vorbei: knapp über dem Boden auf der anderen Seite. */
    expect(inShape(poly, { x: 0.6, y: 0.97 })).toBe(true);
  });

  it('eine offene Tür und ein Fenster lassen den Blick durch', () => {
    for (const w of [{ ...mitte, kind: 'door' as const, state: 'open' as const }, { ...mitte, kind: 'window' as const }]) {
      const poly = { id: 'p', kind: 'poly' as const, pts: sightPolygon([w], { x: 0.25, y: 0.5 }, 1) };
      expect(inShape(poly, { x: 0.75, y: 0.3 })).toBe(true);
    }
  });

  it('rechnet auf breiten Karten mit gleichen Achsen', () => {
    /* Karte doppelt so breit wie hoch: ar = 0.5. Eine Wand schräg; was hinter ihr liegt, bleibt dunkel. */
    const w: MapWall = { id: 'w', kind: 'wall', x1: 0.4, y1: 0.2, x2: 0.6, y2: 0.2 };
    const poly = { id: 'p', kind: 'poly' as const, pts: sightPolygon([w], { x: 0.5, y: 0.9 }, 0.5) };
    expect(inShape(poly, { x: 0.5, y: 0.1 })).toBe(false);
    expect(inShape(poly, { x: 0.5, y: 0.5 })).toBe(true);
  });

  it('hält eine Wand, deren Ecken vor dem ersten gebogenen Strahl liegen (Schiessscharte)', () => {
    /* Ein Raum, oben eine Wand mit einem V und einer schmalen Lücke in seiner
       Spitze, links eine Tür, rechts eine Wand — nachgestellt nach einer
       Karte auf dev (22.10.). Das Ausdünnen verglich jeden Punkt mit seinem
       rohen Vorgänger, solange noch keiner behalten war; je Ecke gibt es drei
       fast gleiche Strahlen, also fiel alles bis zum ersten Strahl durch die
       Lücke weg — die Tür, die Wand oben links und der linke Arm des V. */
    const raum: MapWall[] = [
      { id: 'oben-links', kind: 'wall', x1: 0.1551, y1: 0.2787, x2: 0.0732, y2: 0.2797 },
      { id: 'v-links', kind: 'wall', x1: 0.1656, y1: 0.2904, x2: 0.1551, y2: 0.2787 },
      { id: 'v-rechts', kind: 'wall', x1: 0.1837, y1: 0.2771, x2: 0.1678, y2: 0.2906 },
      { id: 'oben-rechts', kind: 'wall', x1: 0.2286, y1: 0.279, x2: 0.1837, y2: 0.2771 },
      { id: 'rechts', kind: 'wall', x1: 0.1837, y1: 0.2771, x2: 0.1835, y2: 0.4284 },
      { id: 'unten', kind: 'wall', x1: 0.2115, y1: 0.4728, x2: 0.1371, y2: 0.4712 },
      { id: 'links-unten', kind: 'wall', x1: 0.1371, y1: 0.4712, x2: 0.1382, y2: 0.343 },
      { id: 'tuer', kind: 'door', state: 'closed', x1: 0.1382, y1: 0.343, x2: 0.138, y2: 0.2886 },
      { id: 'links-oben', kind: 'wall', x1: 0.1386, y1: 0.2789, x2: 0.138, y2: 0.2886 },
    ];
    const ar = 2223 / 3035;
    const poly = { id: 'p', kind: 'poly' as const, pts: sightPolygon(raum, { x: 0.1561, y: 0.3094 }, ar) };
    /* Im Raum: ja. Hinter der oberen Wand links der Lücke und hinter der Tür: nein. */
    expect(inShape(poly, { x: 0.16, y: 0.38 })).toBe(true);
    expect(inShape(poly, { x: 0.145, y: 0.2 })).toBe(false);
    expect(inShape(poly, { x: 0.12, y: 0.3 })).toBe(false);
    /* Die Ecken der Wand oben links stehen im Polygon. */
    const nah = (x: number, y: number) => poly.pts.some(([a, b]) => Math.hypot(a - x, b - y) < 0.002);
    expect(nah(0.1551, 0.2787)).toBe(true);
    expect(nah(0.138, 0.2886)).toBe(true);
    /* Durch die Lücke ein schmaler Keil nach oben, nicht mehr. */
    expect(inShape(poly, { x: 0.195, y: 0.24 })).toBe(true);
    expect(inShape(poly, { x: 0.172, y: 0.24 })).toBe(false);
  });

  it('mit Halbmesser: nicht weiter als der Kreis', () => {
    const p = visionPolygon({ x: 0.5, y: 0.5 }, [], { w: 1, h: 1 }, 0.1);
    expect(Math.max(...p.map(([x, y]) => Math.hypot(x - 0.5, y - 0.5)))).toBeLessThanOrEqual(0.1 + 1e-9);
  });

  it('eine Sichtlinie an einer Türzarge vorbei hält nicht', () => {
    expect(wallsClear([mitte], { x: 0.25, y: 0.5 }, { x: 0.75, y: 0.5 }, 1)).toBe(false);
    expect(wallsClear([mitte], { x: 0.25, y: 0.9 }, { x: 0.75, y: 0.9 }, 1)).toBe(true);
    expect(wallsClear([{ ...mitte, kind: 'window' }], { x: 0.25, y: 0.5 }, { x: 0.75, y: 0.5 }, 1)).toBe(true);
    expect(wallsClear([{ ...mitte, kind: 'window' }], { x: 0.25, y: 0.5 }, { x: 0.75, y: 0.5 }, 1, 'move')).toBe(false);
    /* Zwei Strecken eines Linienzugs: durch ihren Stoss geht kein Weg. */
    const zug: MapWall[] = [
      { id: 'a', kind: 'wall', x1: 0.5, y1: 0, x2: 0.5, y2: 0.5 },
      { id: 'b', kind: 'wall', x1: 0.5, y1: 0.5, x2: 0.5, y2: 1 },
    ];
    expect(wallsClear(zug, { x: 0.4, y: 0.4 }, { x: 0.6, y: 0.6 }, 1, 'move')).toBe(false);
  });
});

describe('Aufdecken nach Sicht', () => {
  const nat = { w: 1000, h: 1000 };
  let n = 0;
  const id = () => `s-${++n}`;

  it('ohne Sperren deckt ein Weg mit dem Pinsel auf', () => {
    const e = revealAlong(karte({ fog: true }), [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.1 }], nat, id, 'pc-1');
    expect(hasSightWalls(e)).toBe(false);
    expect(revealShapes(e).map((s) => [s.kind, s.for])).toEqual([['path', 'pc-1']]);
  });

  it('mit Sperren das Sichtpolygon — höchstens sechs, der letzte Punkt immer', () => {
    const e0 = karte({ fog: true, walls: [mitte] });
    const weg = Array.from({ length: 20 }, (_, i) => ({ x: 0.05 + i * 0.01, y: 0.5 }));
    const e = revealAlong(e0, weg, nat, id, 'pc-1');
    const formen = revealShapes(e);
    expect(formen.length).toBeLessThanOrEqual(6);
    expect(formen.every((s) => s.kind === 'poly' && s.for === 'pc-1')).toBe(true);
    const letzte = formen.at(-1)!;
    expect(inShape(letzte, { x: 0.24, y: 0.5 })).toBe(true);
    expect(inShape(letzte, { x: 0.75, y: 0.3 })).toBe(false);
    expect(sightReveal(e0, { x: 0.25, y: 0.5 }, nat, 'x')).not.toBe(e0);
  });
});

describe('Zurückhalten und Bewegung', () => {
  it('Spielende bekommen die Sperren am Aufgedeckten; eine geschlossene Geheimtür als Wand', () => {
    const e = karte({
      fog: true,
      reveal: [{ id: 'r', kind: 'rect', x: 0, y: 0, w: 0.5, h: 1 }],
      walls: [
        mitte,
        { id: 'd1', kind: 'door', x1: 0.1, y1: 0.5, x2: 0.2, y2: 0.5, state: 'locked' },
        { id: 'd2', kind: 'door', x1: 0.7, y1: 0.5, x2: 0.8, y2: 0.5, state: 'closed' },
        { id: 's1', kind: 'secret', x1: 0.1, y1: 0.2, x2: 0.2, y2: 0.2, state: 'closed' },
        { id: 's2', kind: 'secret', x1: 0.1, y1: 0.3, x2: 0.2, y2: 0.3, state: 'open' },
      ],
    });
    const sp = redactMap(e, { gm: false, sees: () => true });
    expect((sp.components!['Map'] as { walls: unknown[] }).walls).toEqual([
      { id: 'w1', kind: 'wall', x1: 0.5, y1: 0, x2: 0.5, y2: 0.8 },
      { id: 'd1', kind: 'door', x1: 0.1, y1: 0.5, x2: 0.2, y2: 0.5, state: 'closed' },
      { id: 's1', kind: 'wall', x1: 0.1, y1: 0.2, x2: 0.2, y2: 0.2 },
      { id: 's2', kind: 'door', x1: 0.1, y1: 0.3, x2: 0.2, y2: 0.3, state: 'open' },
    ]);
    expect(redactMap(e, { gm: true, sees: () => true })).toBe(e);
  });

  it('das Raster des Zugplans kennt, was den Schritt hält', () => {
    const e = karte({ walls: [{ id: 'w', kind: 'window', x1: 0.2, y1: 0, x2: 0.2, y2: 1 }] });
    const geo = gridGeometry(mapSettings(e), { w: 1000, h: 1000 })!;
    const g = planGrid(geo, [], 'x', mapWalls(e))!;
    expect(stepBlocked({ x: 1, y: 3 }, { x: 2, y: 3 }, g.walls)).toBe(true);
    expect(stepBlocked({ x: 2, y: 3 }, { x: 3, y: 3 }, g.walls)).toBe(false);
    const offen = planGrid(geo, [], 'x', [{ id: 'd', kind: 'door', state: 'open', x1: 0.2, y1: 0, x2: 0.2, y2: 1 }])!;
    expect(offen.walls).toEqual([]);
  });
});

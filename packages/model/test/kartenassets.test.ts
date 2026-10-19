import { describe, expect, it } from 'vitest';
import {
  assetCorners,
  assetWalls,
  blockingWalls,
  figureView,
  litAreas,
  markerMovable,
  markersOf,
  mayMoveAsset,
  setAssetProps,
  sightReveal,
  wallsClear,
} from '../src/index.js';
import type { Entity, Relation } from '../src/types.js';

/* Assets auf der Karte (T-306): fix als Vorgabe, verschiebbar auf Wunsch,
   und was ihr Umriss hält — als Sperren einer Art, gerechnet beim Lesen. */

const nat = { w: 1000, h: 1000 };
const marker = (id: string, to: string, x: number, y: number, props: Record<string, unknown> = {}): Relation => ({
  id,
  type: 'marker',
  from: 'k1',
  to,
  props: { x, y, ...props },
});
const karte = (relations: Relation[] = [], map: Record<string, unknown> = {}): Entity => ({
  id: 'k1',
  interfaces: ['Map'],
  components: { Map: { gridShape: 'square', gridSize: 100, ...map } },
  relations,
});

describe('Assets auf der Karte (T-306)', () => {
  it('ein Asset ist fix, bis `movable` es sagt; ein Token ist immer verschiebbar', () => {
    const k = karte([marker('a', 'kiste', 0.5, 0.5, { kind: 'scenery' }), marker('b', 'kiste', 0.2, 0.2, { kind: 'scenery', movable: true }), marker('t', 'rook', 0.1, 0.1, { kind: 'play' })]);
    const [a, b, t] = markersOf(k);
    expect([a!.movable, markerMovable(a!)]).toEqual([false, false]);
    expect(markerMovable(b!)).toBe(true);
    expect(markerMovable(t!)).toBe(true);
  });

  it('Spielende schieben ein verschiebbares Asset nur, wenn sie mehr als die eigene Figur ziehen und nicht bestätigt wird', () => {
    expect(mayMoveAsset({ tokenMove: 'own', moves: 'free' })).toBe(false);
    expect(mayMoveAsset({ tokenMove: 'none', moves: 'free' })).toBe(false);
    expect(mayMoveAsset({ tokenMove: 'party', moves: 'free' })).toBe(true);
    expect(mayMoveAsset({ tokenMove: 'all', moves: 'free' })).toBe(true);
    expect(mayMoveAsset({ tokenMove: 'all', moves: 'confirm' })).toBe(false);
  });

  it('der Umriss: Grösse in Feldern, Seitenverhältnis, gedreht um die Mitte', () => {
    const c = assetCorners({ x: 0.5, y: 0.5, size: 2, ratio: 0.5, rot: 0 }, 100, nat);
    expect(c.map((p) => [+p.x.toFixed(3), +p.y.toFixed(3)])).toEqual([[0.4, 0.45], [0.6, 0.45], [0.6, 0.55], [0.4, 0.55]]);
    const q = assetCorners({ x: 0.5, y: 0.5, size: 2, ratio: 0.5, rot: 90 }, 100, nat);
    expect(+q[0]!.x.toFixed(3)).toBe(0.55);
    expect(+q[0]!.y.toFixed(3)).toBe(0.4);
  });

  it('nur ein Asset mit `blocks` wird zur Sperre — und nichts davon steht in `Map.walls`', () => {
    const k = karte([marker('a', 'kiste', 0.5, 0.5, { kind: 'scenery', blocks: 'chasm' }), marker('b', 'tisch', 0.2, 0.2, { kind: 'scenery' }), marker('t', 'rook', 0.5, 0.5, { kind: 'play', blocks: 'wall' })]);
    const w = assetWalls(k, nat);
    expect(w).toHaveLength(4);
    expect(new Set(w.map((x) => x.kind))).toEqual(new Set(['chasm']));
    expect((k.components!['Map'] as { walls?: unknown }).walls).toBeUndefined();
    expect(assetWalls(k, null)).toEqual([]);
    expect(assetWalls(k, nat, 'a')).toEqual([]);
    /* Eine Tür kann ein Asset nicht sein. */
    expect(markersOf(karte([marker('d', 'x', 0.5, 0.5, { kind: 'scenery', blocks: 'door' })]))[0]!.blocks).toBe('');
  });

  it('eine Kiste hält den Schritt, nicht den Blick; ein Schrank beides', () => {
    const kiste = karte([marker('a', 'kiste', 0.5, 0.5, { kind: 'scenery', blocks: 'chasm' })]);
    const w = blockingWalls(kiste, nat);
    expect(wallsClear(w, { x: 0.3, y: 0.5 }, { x: 0.7, y: 0.5 }, 1, 'move')).toBe(false);
    expect(wallsClear(w, { x: 0.3, y: 0.5 }, { x: 0.7, y: 0.5 }, 1, 'sight')).toBe(true);
    const schrank = karte([marker('a', 'schrank', 0.5, 0.5, { kind: 'scenery', blocks: 'wall' })]);
    expect(wallsClear(blockingWalls(schrank, nat), { x: 0.3, y: 0.5 }, { x: 0.7, y: 0.5 }, 1, 'sight')).toBe(false);
  });

  it('die Sicht einer Figur endet am Schrank; aufgedeckt wird nicht dahinter', () => {
    const k = karte([marker('a', 'schrank', 0.5, 0.5, { kind: 'scenery', blocks: 'wall', size: 2 })], { lighting: 'bright' });
    const v = figureView(k, { x: 0.2, y: 0.5 }, nat);
    const pts = v.seen[0]!.pts;
    /* Kein Punkt des Sichtpolygons liegt hinter dem Schrank auf der Geraden. */
    expect(pts.some(([x, y]) => x > 0.62 && Math.abs(y - 0.5) < 0.02)).toBe(false);
    const auf = sightReveal(k, { x: 0.2, y: 0.5 }, nat, 'r1');
    expect(JSON.stringify(auf.components!['Map'])).toContain('"poly"');
  });

  it('eine Laterne, die als Schrank sperrt, leuchtet trotzdem aus sich heraus', () => {
    const k = karte([marker('a', 'laterne', 0.5, 0.5, { kind: 'scenery', blocks: 'wall', light: 2, dim: 4 })]);
    const [l] = litAreas(k, nat);
    expect(l!.dim.length).toBeGreaterThan(2);
    const weit = Math.max(...l!.dim.map(([x]) => x));
    expect(weit).toBeGreaterThan(0.85);
  });

  it('`setAssetProps` setzt und nimmt weg — nur an Assets', () => {
    const k = karte([marker('a', 'kiste', 0.5, 0.5, { kind: 'scenery' }), marker('t', 'rook', 0.1, 0.1, { kind: 'play' })]);
    let n = setAssetProps(k, 'a', { movable: true, blocks: 'chasm', rot: 45 });
    expect(markersOf(n)[0]).toMatchObject({ movable: true, blocks: 'chasm', rot: 45 });
    n = setAssetProps(n, 'a', { movable: false, blocks: null });
    expect(n.relations![0]!.props).toEqual({ x: 0.5, y: 0.5, kind: 'scenery', rot: 45 });
    expect(setAssetProps(k, 't', { movable: true }).relations![1]).toBe(k.relations![1]);
  });
});

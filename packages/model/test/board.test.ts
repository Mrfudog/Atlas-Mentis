import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import {
  anchorAreaOf,
  anchorsOf,
  boardCard,
  isArea,
  withAnchors,
  nextPlacement,
  placementOf,
  placementsOf,
  placementView,
  snapTo,
} from '../src/board.js';
import { relationAccepts, relationDef } from '../src/entity.js';
import type { Entity, Relation } from '../src/types.js';

const brett = (relations: Relation[], board: Record<string, unknown> = {}): Entity => ({
  id: 'b1',
  interfaces: ['Board'],
  name: 'Session board',
  components: { Identity: { name: 'Session board', id: 'brd-0001' }, Board: board },
  relations,
});
const platz = (id: string, props: Record<string, unknown>): Relation => ({
  id,
  type: 'placed',
  to: `e-${id}`,
  props,
});

describe('placementView (REQ-161)', () => {
  it('lets the size of the tile choose when nobody else does', () => {
    const b = brett([]);
    expect(placementView(seedRegistry, b, platz('a', { h: 80 }), 'Creature')).toBe('overview');
    expect(placementView(seedRegistry, b, platz('a', { h: 180 }), 'Creature')).toBe('quick');
    /* Ohne Höhe gilt die Vorgabe der Kante — eine Karte. */
    expect(placementView(seedRegistry, b, platz('a', {}), 'Creature')).toBe('quick');
  });

  it('takes the placement first, then the board rule up the extends chain', () => {
    const b = brett([], { rules: { Story: 'overview' } });
    /* Eine Sitzung ist eine Story: die Regel greift die Kette hoch. */
    expect(placementView(seedRegistry, b, platz('a', { h: 300 }), 'Session')).toBe('overview');
    expect(placementView(seedRegistry, b, platz('a', { h: 300, view: 'quick' }), 'Session')).toBe(
      'quick',
    );
    /* Eine Ansicht, die es nicht gibt, ist keine Wahl. */
    expect(placementView(seedRegistry, b, platz('a', { h: 300, view: 'gibts' }), 'Place')).toBe(
      'quick',
    );
  });
});

describe('placements', () => {
  it('reads defaults for what the edge leaves out, and stacks by z', () => {
    expect(placementOf(platz('a', { x: 10 }))).toEqual({ x: 10, y: 0, w: 260, h: 180, z: 0 });
    const b = brett([platz('oben', { z: 2 }), platz('unten', { z: 0 }), { id: 'x', type: 'partOf', to: 's' }]);
    expect(placementsOf(b).map((r) => r.id)).toEqual(['unten', 'oben']);
  });

  it('puts a new card into the first free cell, not onto another one', () => {
    const b = brett([platz('a', { x: 40, y: 40, w: 260, h: 180, z: 3 })]);
    const n = nextPlacement(b);
    expect(n).toMatchObject({ y: 40, z: 4 });
    expect(n.x).toBeGreaterThanOrEqual(300);
  });

  it('keeps new cards inside the width one can see', () => {
    const b = brett([platz('a', { x: 40, y: 40, w: 260, h: 180 })]);
    /* 500 px sichtbar: neben der ersten ist kein Platz, also die nächste Reihe. */
    expect(nextPlacement(b, 260, 180, 500)).toMatchObject({ x: 40, y: 240 });
  });

  it('snaps to the grid and never off the canvas', () => {
    expect(snapTo(47, 10)).toBe(50);
    expect(snapTo(-30, 10)).toBe(0);
    expect(snapTo(30, 10, 60)).toBe(60);
    expect(boardCard(brett([], { snap: 0 })).snap).toBe(1);
  });
});

describe('a board belongs to a story article (REQ-205)', () => {
  it('hangs off a session or campaign through partOf, the same chain as the story', () => {
    const def = relationDef(seedRegistry, 'partOf');
    expect(relationAccepts(def, 'Board', 'Session', seedRegistry)).toBe(true);
    expect(relationAccepts(def, 'Board', 'Campaign', seedRegistry)).toBe(true);
  });
});

describe('Bereiche (T-073)', () => {
  const b = brett([], {
    anchors: [
      { id: 'a1', name: 'Conditions', x: 0, y: 0, w: 600, h: 400, extra: 'bleibt' },
      { id: 'a2', name: 'Inner', x: 100, y: 100, w: 200, h: 200 },
      { id: 'a3', name: 'Alley', x: 900, y: 50, zoom: 0.5 },
      { name: 'ohne Id' },
    ],
  });

  it('reads anchors and tells areas from points', () => {
    const a = anchorsOf(b);
    expect(a.map((x) => x.id)).toEqual(['a1', 'a2', 'a3']);
    expect(a.filter(isArea).map((x) => x.id)).toEqual(['a1', 'a2']);
    expect(a[2]).toEqual({ id: 'a3', name: 'Alley', x: 900, y: 50, zoom: 0.5 });
  });

  it('puts a card in the smallest area that holds its middle', () => {
    const a = anchorsOf(b);
    expect(anchorAreaOf(a, { x: 150, y: 150, w: 100, h: 100, z: 0 })).toBe('a2');
    expect(anchorAreaOf(a, { x: 400, y: 250, w: 100, h: 100, z: 0 })).toBe('a1');
    expect(anchorAreaOf(a, { x: 550, y: 350, w: 200, h: 200, z: 0 })).toBeNull();
  });

  it('writes anchors back and keeps what it does not know', () => {
    const a = anchorsOf(b).map((x) => (x.id === 'a1' ? { ...x, name: 'Zustände' } : x));
    const neu = withAnchors(b, a.filter((x) => x.id !== 'a2'));
    const roh = (neu.components['Board'] as { anchors: Record<string, unknown>[] }).anchors;
    expect(roh).toEqual([
      { id: 'a1', name: 'Zustände', x: 0, y: 0, w: 600, h: 400, extra: 'bleibt' },
      { id: 'a3', name: 'Alley', x: 900, y: 50, zoom: 0.5 },
    ]);
  });
});

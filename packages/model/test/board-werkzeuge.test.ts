import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import {
  boardBackground,
  boardContentBounds,
  boardExtent,
  fitPoints,
  newShape,
  placementView,
  redactBoard,
  shapesOf,
  withBackground,
  withShapes,
} from '../src/board.js';
import type { Entity, Relation } from '../src/types.js';

const brett = (board: Record<string, unknown> = {}, relations: Relation[] = []): Entity => ({
  id: 'b1',
  interfaces: ['Board'],
  name: 'Board',
  components: { Identity: { name: 'Board', id: 'brd-0001' }, Board: board },
  relations,
});

describe('Formen auf dem Board (T-339)', () => {
  it('liest Text, Bild und Zeichnung und lässt Unbrauchbares weg', () => {
    const b = brett({
      shapes: [
        { id: 't', kind: 'text', x: 10, y: 20, w: 300, h: 80, text: '# Hello [[npc-0001|Volo]] {TOWN}' },
        { id: 'p', kind: 'pen', x: 0, y: 0, w: 10, h: 10, points: [[0, 0], [10, 10], ['x', 1]], z: -1 },
        { id: 'k', kind: 'blob' },
        { kind: 'rect' },
      ],
    });
    const s = shapesOf(b);
    expect(s.map((x) => x.id)).toEqual(['p', 't']);
    expect(s[0]!.points).toEqual([[0, 0], [10, 10]]);
    /* Die Vorlage bleibt die Vorlage: nichts wird eingesetzt. */
    expect(s[1]!.text).toBe('# Hello [[npc-0001|Volo]] {TOWN}');
  });

  it('schreibt ohne Vorgaben und behält, was diese Seite nicht kennt', () => {
    const b = brett({ shapes: [{ id: 'x', kind: 'sticker', foo: 1 }, { id: 'r', kind: 'rect', x: 1, y: 1, w: 5, h: 5, extra: 'bleibt' }] });
    const r = shapesOf(b)[0]!;
    const neu = withShapes(b, [{ ...r, x: 40 }, newShape('text', { id: 't', x: 5, y: 5, text: 'Hi' })]);
    const roh = (neu.components!['Board'] as { shapes: Record<string, unknown>[] }).shapes;
    expect(roh[0]).toEqual({ id: 'x', kind: 'sticker', foo: 1 });
    expect(roh[1]).toEqual({ id: 'r', kind: 'rect', x: 40, y: 1, w: 5, h: 5, extra: 'bleibt' });
    expect(roh[2]).toEqual({ id: 't', kind: 'text', x: 5, y: 5, w: 320, h: 120, text: 'Hi' });
  });

  it('rechnet Punkte relativ zur Ecke', () => {
    expect(fitPoints([[100, 50], [140, 20], [120, 90]])).toEqual({
      x: 100,
      y: 20,
      w: 40,
      h: 70,
      points: [[0, 30], [40, 0], [20, 70]],
    });
  });
});

describe('Hintergrund', () => {
  it('liest Bild, Farbe, Lage und Karte; leer fällt weg', () => {
    const b = withBackground(brett({ background: 'ast-1' }), { color: '#222', fit: 'tile', map: 'm1' });
    expect(boardBackground(b)).toEqual({ image: 'ast-1', color: '#222', fit: 'tile', map: 'm1' });
    const ohne = withBackground(b, { image: '', fit: 'stretch', map: '' });
    expect(ohne.components!['Board']).toEqual({ backgroundColor: '#222' });
    expect(boardBackground(brett()).fit).toBe('stretch');
  });
});

describe('Unendliche Leinwand', () => {
  const platz = (x: number, y: number): Relation => ({ id: `r${x}`, type: 'placed', to: 'e', props: { x, y, w: 260, h: 180 } });

  it('ein Board mit allem innerhalb bleibt so gross wie vorher', () => {
    expect(boardExtent(brett({}, [platz(100, 100)]))).toEqual({ width: 2400, height: 1500 });
    expect(boardExtent(brett({ width: 3000 }))).toEqual({ width: 3000, height: 1500 });
  });

  it('wächst mit dem Äussersten, mit Rand dahinter', () => {
    const b = brett({ shapes: [{ id: 's', kind: 'rect', x: 4000, y: 10, w: 100, h: 100 }] }, [platz(100, 2000)]);
    expect(boardExtent(b)).toEqual({ width: 4700, height: 2780 });
    expect(boardExtent(brett(), [{ x: 0, y: 0, w: 5000, h: 10 }]).width).toBe(5600);
  });

  it('kennt das Rechteck um den Inhalt', () => {
    expect(boardContentBounds(brett())).toBeNull();
    expect(boardContentBounds(brett({ anchors: [{ id: 'a', name: 'A', x: 50, y: 60, w: 100, h: 100 }] }, [platz(300, 300)]))).toEqual({
      x: 50,
      y: 60,
      w: 510,
      h: 420,
    });
  });
});

describe('Zurückhalten und Ansicht für Spielende', () => {
  it('nimmt versteckte Formen und Kacheln heraus', () => {
    const b = brett(
      { shapes: [{ id: 'a', kind: 'text', hidden: true }, { id: 'b', kind: 'text' }] },
      [
        { id: 'r1', type: 'placed', to: 'x', props: { hidden: true } },
        { id: 'r2', type: 'placed', to: 'y' },
        { id: 'r3', type: 'partOf', to: 's' },
      ],
    );
    const r = redactBoard(b);
    expect(shapesOf(r).map((s) => s.id)).toEqual(['b']);
    expect(r.relations!.map((x) => x.id)).toEqual(['r2', 'r3']);
  });

  it('gibt Spielenden ohne Wahl den Handzettel, die Wahl der Kachel gilt für alle', () => {
    const r = seedRegistry;
    const b = brett();
    const kante = (props: Record<string, unknown>): Relation => ({ id: 'r', type: 'placed', to: 'x', props });
    expect(placementView(r, b, kante({ h: 300 }), 'Creature')).toBe('quick');
    expect(placementView(r, b, kante({ h: 300 }), 'Creature', { player: true })).toBe('handout');
    expect(placementView(r, b, kante({ h: 80 }), 'Creature', { player: true })).toBe('overview');
    expect(placementView(r, b, kante({ h: 300, view: 'full' }), 'Creature', { player: true })).toBe('full');
  });
});

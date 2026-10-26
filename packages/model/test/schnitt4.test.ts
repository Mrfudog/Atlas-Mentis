import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import { boardSketch } from '../src/board.js';
import { applyAdjust } from '../src/views.js';
import { drawnByTree, pickView } from '../src/viewScope.js';
import type { Entity, LayoutElement } from '../src/types.js';

/**
 * **T-425, Schnitt 4:** „Linked article" mit Kante und Ansicht, die
 * Kurzansicht eines Boards als Skizze, und eine Art darf ein Element, das
 * sie erbt, an Ort und Stelle anders einstellen.
 */
const ids = (l: readonly LayoutElement[]) => l.map((e) => e.id);
const art = (typ: string): Entity => ({ id: 'x', interfaces: [typ], name: 'x', components: {} });

describe('Linked article (T-425, E-172)', () => {
  it('ohne Pfad zeichnet die Seite (asField, bearbeitbar), mit Pfad der Baum', () => {
    expect(drawnByTree({ el: 'linked' })).toBe(false);
    expect(drawnByTree({ el: 'linked', path: [{ relation: 'happensAt' }] })).toBe(true);
  });
});

describe('applyAdjust: ein Element gleicher Id stellt um, statt zu verdoppeln', () => {
  it('extra mit vorhandener Id ersetzt an Ort und Stelle', () => {
    const l: LayoutElement[] = [
      { id: 'a', el: 'text', text: 'A' },
      { id: 'b', el: 'text', text: 'B' },
    ];
    expect(applyAdjust(l, { extra: [{ id: 'a', el: 'text', text: 'A!' }] })).toEqual([{ id: 'a', el: 'text', text: 'A!' }, l[1]]);
  });
  it('eine Szene zeigt ihre Begegnungen als Liste, ein Arc als Kacheln', () => {
    const c = (typ: string) => pickView(art(typ), seedRegistry, 'full').layout.filter((e) => e.id === 'st-contains');
    expect(c('Scene')).toEqual([expect.objectContaining({ show: 'list' })]);
    expect(c('Arc')).toEqual([expect.objectContaining({ show: 'tiles' })]);
  });
});

describe('Kurzansicht eines Boards (T-425)', () => {
  const board: Entity = {
    id: 'brd',
    interfaces: ['Board'],
    name: 'Session board',
    components: { Board: { width: 1000, height: 500, backgroundColor: '#efe' } },
    relations: [
      { type: 'placed', to: 'sc_1', props: { x: 100, y: 50, w: 200, h: 100, z: 1 } },
      { type: 'placed', to: 'sc_2', props: { x: 400, y: 200, z: 0 } },
      { type: 'partOf', to: 'ses_1' },
    ],
  };
  it('boardSketch: die Fläche, ihre Farbe und je Kachel ein Rechteck mit Namen, von unten nach oben', () => {
    const s = boardSketch(board, (id) => ({ sc_1: 'The old man', sc_2: 'The mine' })[id]);
    expect(s).toEqual({
      width: 1000,
      height: 500,
      background: '#efe',
      cards: [
        { id: 'sc_2', x: 400, y: 200, w: 260, h: 180, name: 'The mine' },
        { id: 'sc_1', x: 100, y: 50, w: 200, h: 100, name: 'The old man' },
      ],
    });
  });
  it('was über den Rand ragt, vergrössert die Fläche; ohne Namen steht keiner', () => {
    const s = boardSketch({ ...board, relations: [{ type: 'placed', to: 'z', props: { x: 1900, y: 10 } }] }, () => undefined);
    expect(s.width).toBe(2160);
    expect(s.cards[0]!.name).toBe('');
  });
  it('die Kurzansicht des Boards zeigt die Skizze', () => {
    expect(ids(pickView(art('Board'), seedRegistry, 'quick').layout)).toContain('bq-board');
  });
  it('eine Karte zeigt in der Kurzansicht ihr Bild', () => {
    expect(pickView(art('Map'), seedRegistry, 'quick').layout.some((e) => e.el === 'image')).toBe(true);
  });
});

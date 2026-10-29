import { describe, expect, it } from 'vitest';
import { addDrawingSheet, addStroke, removeStroke, setSheetGmOnly, strokeAt, strokePath } from '../src/strokes.js';
import { drawnSheets, mapSheets, redactMap } from '../src/map.js';
import type { Entity } from '../src/types.js';

/** Zeichnen auf der Karte (T-219, REQ-142): Striche liegen auf einem eigenen Blatt. */
const karte = (map: Record<string, unknown> = {}): Entity => ({ id: 'map-1', interfaces: ['Map'], components: { Map: { ...map }, Image: { image: 'a' } }, relations: [] });

describe('Zeichnen auf der Karte (T-219)', () => {
  it('legt eine Zeichenebene an und zeichnet darauf', () => {
    const { map, id } = addDrawingSheet(karte(), 'Ink', 'sh-1');
    let e = addStroke(map, id, { id: 'st-1', kind: 'path', pts: [[0.1, 0.1], [0.2, 0.15], [0.3, 0.1]], color: '#123456', width: 0.005 });
    e = addStroke(e, id, { id: 'st-2', kind: 'rect', pts: [[0.5, 0.5], [0.6, 0.7]], color: '#ff0000', width: 0.002 });
    const blatt = mapSheets(e).find((s) => s.id === id)!;
    expect(blatt).toMatchObject({ name: 'Ink', image: '', gmOnly: false });
    expect(blatt.strokes.map((s) => s.id)).toEqual(['st-1', 'st-2']);
    /* Ein Blatt ohne Bild wird gezeichnet, sobald etwas darauf steht. */
    expect(drawnSheets(e, false).map((s) => s.id)).toEqual(['__base', id]);
    expect(drawnSheets(map, false).map((s) => s.id)).toEqual(['__base']);
  });

  it('findet den Strich unter dem Finger und radiert ihn weg', () => {
    const { map, id } = addDrawingSheet(karte(), 'Ink', 'sh-1');
    let e = addStroke(map, id, { id: 'st-1', kind: 'line', pts: [[0.1, 0.1], [0.5, 0.1]], color: '#000', width: 0.004 });
    e = addStroke(e, id, { id: 'st-2', kind: 'ellipse', pts: [[0.6, 0.6], [0.8, 0.8]], color: '#000', width: 0.004 });
    expect(strokeAt(e, { x: 0.3, y: 0.105 }, 1, 0.01)).toEqual({ sheet: id, stroke: 'st-1' });
    /* Die Ellipse trifft man am Rand, nicht in der Mitte. */
    expect(strokeAt(e, { x: 0.7, y: 0.7 }, 1, 0.01)).toBeNull();
    expect(strokeAt(e, { x: 0.8, y: 0.7 }, 1, 0.01)).toEqual({ sheet: id, stroke: 'st-2' });
    e = removeStroke(e, id, 'st-1');
    expect(mapSheets(e).find((s) => s.id === id)!.strokes.map((s) => s.id)).toEqual(['st-2']);
  });

  it('zeichnet einen Pfad im Raum mit gleichen Achsen', () => {
    expect(strokePath({ id: 's', kind: 'line', pts: [[0, 0], [1, 1]], color: '#000', width: 0.01 }, 0.5)).toBe('M0 0 L1 0.5');
    expect(strokePath({ id: 's', kind: 'rect', pts: [[0.1, 0.2], [0.3, 0.6]], color: '#000', width: 0.01 }, 1)).toBe('M0.1 0.2 L0.3 0.2 L0.3 0.6 L0.1 0.6 Z');
  });

  it('ein Blatt der Leitung geht nicht an Spielende', () => {
    const { map, id } = addDrawingSheet(karte(), 'Traps', 'sh-1');
    const e = setSheetGmOnly(addStroke(map, id, { id: 'st-1', kind: 'line', pts: [[0, 0], [1, 1]], color: '#000', width: 0.01 }), id, true);
    expect(mapSheets(redactMap(e, { gm: false, sees: () => true })).map((s) => s.id)).toEqual(['__base']);
    expect(mapSheets(setSheetGmOnly(e, id, false)).find((s) => s.id === id)!.gmOnly).toBe(false);
  });
});

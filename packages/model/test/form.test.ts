import { describe, expect, it } from 'vitest';
import {
  cellsOf,
  fitsAt,
  flipGrid,
  inventoryFrame,
  inventoryImageOf,
  itemShape,
  sameShape,
  shapeChiral,
  shapeFromVault,
  trimShape,
} from '../src/inventory.js';
import type { Entity } from '../src/types.js';

describe('Gegenstandsformen (T-142)', () => {
  it('schneidet leere Ränder ab und schreibt # und .', () => {
    expect(trimShape(['.....', '..#..', '.##..', '.....', '.....'])).toEqual(['.#', '##']);
    expect(trimShape(['X0', 'XX'])).toEqual(['#.', '##']);
    expect(trimShape(['...', '...'])).toEqual([]);
    expect(trimShape([])).toEqual([]);
  });

  it('liest den Formfaktor aus dem Vault: X belegt, 0 frei', () => {
    expect(shapeFromVault(['0X0', 'XXX'])).toEqual(['.#.', '###']);
    expect(shapeFromVault(['000', '0X0', '000'])).toEqual(['#']);
    expect(shapeFromVault('XX,X0')).toEqual(['##', '#.']);
    expect(shapeFromVault(42)).toEqual([]);
  });

  it('spiegelt vor dem Drehen', () => {
    expect(flipGrid(['#.', '##'])).toEqual(['.#', '##']);
    /* L, gespiegelt, dann eine Vierteldrehung im Uhrzeigersinn. */
    expect(itemShape(['#.', '#.', '##'], 90, true).rows).toEqual(['#..', '###']);
    expect(itemShape(['#.', '#.', '##'], 0, true).rows).toEqual(['.#', '.#', '##']);
  });

  it('bietet Spiegeln nur, wo es etwas ändert', () => {
    expect(shapeChiral(['###'])).toBe(false);
    expect(shapeChiral(['##', '##'])).toBe(false);
    expect(shapeChiral(['###', '.#.'])).toBe(false);
    expect(shapeChiral(['#.', '#.', '##'])).toBe(true);
    expect(shapeChiral(['.##', '##.'])).toBe(true);
    expect(shapeChiral([])).toBe(false);
  });

  it('vergleicht Formen ohne Ränder', () => {
    expect(sameShape(['..', '.#'], ['#'])).toBe(true);
    expect(sameShape(['##'], ['#', '#'])).toBe(false);
  });

  it('rechnet Felder und Platz mit der Spiegelung an der Kante', () => {
    const box = itemShape(['###', '###', '###']);
    const l = { key: 'a', rows: ['#.', '#.', '##'], gx: 0, gy: 0, rot: 0, flip: true };
    expect(cellsOf(l).sort()).toEqual(['0,2', '1,0', '1,1', '1,2'].sort());
    const andere = { key: 'b', rows: ['#'], gx: 0, gy: 0 };
    expect(fitsAt(box, [andere], l, 0, 0)).toBe(true);
    expect(fitsAt(box, [andere], { ...l, flip: false }, 0, 0)).toBe(false);
  });

  it('hält den Bildausschnitt in seinen Grenzen', () => {
    expect(inventoryFrame(null)).toEqual({ zoom: 1, x: 0, y: 0, rot: 0, fit: 'cover' });
    expect(inventoryFrame({ zoom: 99, x: -500, y: 3, rot: 450, fit: 'contain' })).toEqual({ zoom: 4, x: -100, y: 3, rot: 90, fit: 'contain' });
    expect(inventoryFrame({ rot: -90 }).rot).toBe(270);
  });

  it('nimmt das eigene Inventarbild vor dem Bild des Gegenstands', () => {
    const e = (item: Record<string, unknown>, image?: string): Entity =>
      ({ id: 'x', components: { Item: item, ...(image ? { Image: { image } } : {}) } }) as unknown as Entity;
    expect(inventoryImageOf(e({}, 'as-1'))).toEqual({ asset: 'as-1', frame: inventoryFrame(null), own: false });
    expect(inventoryImageOf(e({ inventoryImage: 'as-2', inventoryFrame: { fit: 'contain' } }, 'as-1'))?.asset).toBe('as-2');
    expect(inventoryImageOf(e({}))).toBeNull();
  });
});

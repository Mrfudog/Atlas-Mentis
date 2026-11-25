import { describe, expect, it } from 'vitest';
import { grabAnchor, defaultAnchor, placeByAnchor } from '../src/index.js';

/* Die Ankerzelle im Rasterinventar (REQ-402, T-406). */

const T = ['.#.', '###'];

describe('defaultAnchor', () => {
  it('ist das erste belegte Feld der obersten Zeile', () => {
    expect(defaultAnchor(T)).toEqual({ x: 1, y: 0 });
    expect(defaultAnchor(['##', '##'])).toEqual({ x: 0, y: 0 });
  });
  it('gilt in der Form, wie sie liegt (gedreht)', () => {
    /* T um 90° gedreht: #. / ## / #. — oben links belegt. */
    expect(defaultAnchor(T, 90)).toEqual({ x: 0, y: 0 });
  });
  it('ohne Form ein Feld, der Anker oben links', () => {
    expect(defaultAnchor(undefined)).toEqual({ x: 0, y: 0 });
    expect(defaultAnchor([])).toEqual({ x: 0, y: 0 });
  });
});

describe('grabAnchor', () => {
  it('rechnet die angefasste Rasterzelle in die Form um', () => {
    expect(grabAnchor(T, 0, false, 3, 2, 5, 3)).toEqual({ x: 2, y: 1 });
    expect(grabAnchor(T, 0, false, 3, 2, 4, 2)).toEqual({ x: 1, y: 0 });
  });
  it('eine Zelle ausserhalb oder ein leeres Feld der Form ist kein Anker', () => {
    expect(grabAnchor(T, 0, false, 3, 2, 3, 2)).toBeNull();
    expect(grabAnchor(T, 0, false, 3, 2, 9, 9)).toBeNull();
    expect(grabAnchor(T, 0, false, 3, 2, 2, 2)).toBeNull();
  });
});

describe('placeByAnchor', () => {
  it('legt so ab, dass die Ankerzelle auf dem Zielfeld liegt', () => {
    expect(placeByAnchor(4, 4, { x: 1, y: 0 })).toEqual({ gx: 3, gy: 4 });
    expect(placeByAnchor(0, 0, { x: 2, y: 1 })).toEqual({ gx: -2, gy: -1 });
  });
});

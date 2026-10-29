/**
 * Reichweite bis zum nächsten belegten Feld (T-391): ein grosses Token
 * steht so weit weg wie sein nächstes Feld, nicht wie seine Mitte.
 * 10 × 10 Felder zu 100 px, je 5 ft.
 */
import { describe, expect, it } from 'vitest';
import { feetBetween, feetBetweenTokens, gridGeometry, mapSettings, tokenCells, type Entity } from '../src/index.js';

const g = gridGeometry({ ...mapSettings({ id: 'k', interfaces: ['Map'], components: {} } as Entity), gridShape: 'square', gridSize: 100 }, { w: 1000, h: 1000 })!;
/** Mitte des Feldes (x, y) und eines Platzes n × n ab (x, y), als Anteil. */
const feld = (x: number, y: number) => ({ x: (x + 0.5) / 10, y: (y + 0.5) / 10 });
const platz = (x: number, y: number, n: number) => ({ x: (x + n / 2) / 10, y: (y + n / 2) / 10 });

describe('range to the nearest occupied square (T-391)', () => {
  it('lists the squares of a big token from its centre', () => {
    expect(tokenCells(g, platz(3, 0, 3), 3)).toHaveLength(9);
    expect(tokenCells(g, platz(3, 0, 3), 3)[0]).toEqual({ x: 3, y: 0 });
    expect(tokenCells(g, feld(2, 1))).toEqual([{ x: 2, y: 1 }]);
  });

  it('a 3 × 3 dragon touching Kira is 5 ft away, not 10 to its centre', () => {
    expect(feetBetween(g, feld(2, 1), platz(3, 0, 3))).toBe(10);
    expect(feetBetweenTokens(g, feld(2, 1), 1, platz(3, 0, 3), 3)).toBe(5);
  });

  it('counts the attacker’s own place too, and the 5-10-5 rule', () => {
    /* Ein Oger 2 × 2 auf (0, 0)–(1, 1), das Ziel auf (3, 1): zwei Felder bis zu seinem Rand. */
    expect(feetBetweenTokens(g, platz(0, 0, 2), 2, feld(3, 1), 1)).toBe(10);
    /* Diagonal 2 × 2 Felder: 5 + 10. */
    expect(feetBetweenTokens(g, feld(0, 0), 1, feld(2, 2), 1)).toBe(15);
  });
});

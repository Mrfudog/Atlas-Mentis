import { describe, expect, it } from 'vitest';
import {
  carryGrid, clampExtra, columnZones, drawStage, nextDraw, parseCarrySquares,
  parseContainerPreset, parsePairs, slowerDraw,
} from '../src/inventory.js';
import { derivedValue } from '../src/calc.js';

const LEITER = ['free action', 'bonus action', 'action', 'turn', 'round'];
const GROESSEN = parseCarrySquares('tiny:3, small:4, medium:5, large:6');
const ZONEN = '0-1:bonus action, 2-4:action, 5-8:turn, 9-10:round';

describe('Das Tragraster aus Grösse und Statblock (REQ-215, D54)', () => {
  it('liest die Grössen aus der Einstellung', () => {
    expect(GROESSEN).toEqual({ tiny: 3, small: 4, medium: 5, large: 6 });
    expect(parsePairs('a:1,, b , c: 2')).toEqual({ a: '1', c: '2' });
  });

  it('legt Grund- und Zusatzquadrat nebeneinander, 11 × 6 wie das Blatt', () => {
    const g = carryGrid('Medium', 3, GROESSEN)!;
    expect(g).toMatchObject({ base: 5, extra: 3, extraAt: 6 });
    expect(g.rows).toEqual([
      '#####.###..',
      '#####.###..',
      '#####.###..',
      '#####......',
      '#####......',
      '...........',
    ]);
  });

  it('klemmt das Zusatzquadrat auf 0 … 5', () => {
    expect(carryGrid('large', 9, GROESSEN)!.extra).toBe(5);
    expect(carryGrid('tiny', -2, GROESSEN)!.extra).toBe(0);
    expect(clampExtra(undefined)).toBe(0);
  });

  it('gibt ohne bekannte Grösse kein Raster — dann gilt das Rechteck', () => {
    expect(carryGrid('huge', 2, GROESSEN)).toBeNull();
    expect(carryGrid(undefined, 2, GROESSEN)).toBeNull();
  });

  it('rechnet das Zusatzquadrat am Statblock wie den Zauber-SG', () => {
    const feld = { type: 'number' as const, derived: 'mod(str)', min: 0, max: 5 };
    const karten = { Statblock: { size: 'medium' }, Abilities: { str: 16 } };
    expect(derivedValue(feld, karten.Statblock, karten)).toBe(3);
  });
});

describe('Zonen nach Spalten', () => {
  it('gibt jedem freien Feld die Zone seiner Spalte', () => {
    const g = carryGrid('small', 1, GROESSEN)!;
    const z = columnZones(ZONEN, g.rows);
    expect(z['0,0']).toBe('bonus action');
    expect(z['3,3']).toBe('action');
    expect(z['6,0']).toBe('turn');
    expect(z['5,0']).toBeUndefined(); // gesperrt
    expect(z['4,0']).toBeUndefined(); // ausserhalb des Grundquadrats
  });

  it('liest eine Behältervorlage mit Form und Zonen', () => {
    const p = parseContainerPreset('.###../######/######/######/.###.. | 0-1:action, 2-3:turn, 4-5:round')!;
    expect(p.grid).toHaveLength(5);
    expect(p.zones['0,0']).toBeUndefined();
    expect(p.zones['0,1']).toBe('action');
    expect(p.zones['3,0']).toBe('turn');
    expect(p.zones['5,2']).toBe('round');
    expect(parseContainerPreset('####/####')!.zones).toEqual({});
    expect(parseContainerPreset('')).toBeNull();
  });
});

describe('Die Ziehstufe die Kette hinauf (REQ-216, D54)', () => {
  const PLAETZE = { mainHand: 'free action', shoulders: 'bonus action' };

  it('nimmt aussen die Zone oder den Platz', () => {
    expect(drawStage([{ via: 'gear', zone: 'action' }], LEITER, PLAETZE).stage).toBe('action');
    expect(drawStage([{ via: 'gear', slot: 'mainHand', zone: 'round' }], LEITER, PLAETZE).stage).toBe('free action');
  });

  it('gibt je Behälter eine Stufe dazu', () => {
    /* Eine Bag of Holding im Aktionsbereich: was darin liegt, braucht einen Zug. */
    const r = drawStage([{ via: 'gear', zone: 'action' }, { via: 'Bag of Holding' }], LEITER, PLAETZE);
    expect(r.stage).toBe('turn');
    expect(r.steps.map((s) => s.stage)).toEqual(['action', 'turn']);
  });

  it('nimmt das Langsamere aus Zone und Behälter + 1', () => {
    const rucksack = { via: 'gear', slot: 'shoulders' };
    expect(drawStage([rucksack, { via: 'Backpack', zone: 'action' }], LEITER, PLAETZE).stage).toBe('action');
    expect(drawStage([rucksack, { via: 'Backpack', zone: 'round' }], LEITER, PLAETZE).stage).toBe('round');
    expect(drawStage([rucksack, { via: 'Backpack', zone: 'turn' }, { via: 'Bag' }], LEITER, PLAETZE).stage).toBe('round');
  });

  it('bleibt auf der letzten Stufe und sagt nichts, wo es nichts weiss', () => {
    expect(nextDraw('round', LEITER)).toBe('round');
    expect(slowerDraw('nope', null, LEITER)).toBeNull();
    expect(drawStage([{ via: 'gear' }, { via: 'Bag', zone: 'action' }], LEITER, PLAETZE).stage).toBeNull();
  });
});

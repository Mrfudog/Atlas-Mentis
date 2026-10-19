import { describe, expect, it } from 'vitest';
import {
  carryGrid, clampExtra, columnZones, drawStage, handActions, inHand, nextDraw, parseCarrySquares,
  parseContainerPreset, parsePairs, slowerDraw, zonesByColumn, formatColumnZones, formatPairs, formatContainerPreset,
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

describe('Die Einstellungen zurückschreiben (REQ-355)', () => {
  it('fasst benachbarte Spalten zu Spannen zusammen und liest sich zurück', () => {
    const z = zonesByColumn(ZONEN);
    expect(z[0]).toBe('bonus action');
    expect(z[10]).toBe('round');
    expect(formatColumnZones(z)).toBe(ZONEN);
    expect(formatColumnZones({ 0: 'action', 1: 'turn', 2: 'action', 4: 'action' })).toBe('0:action, 1:turn, 2:action, 4:action');
    expect(formatColumnZones({})).toBe('');
  });

  it('schreibt Paare und Behältervorlagen so, wie sie gelesen werden', () => {
    expect(formatPairs({ tiny: 3, small: '4', huge: '' })).toBe('tiny:3, small:4');
    expect(parseCarrySquares(formatPairs({ tiny: 3, medium: 5 }))).toEqual({ tiny: 3, medium: 5 });
    const spec = formatContainerPreset(['.##.', '####'], { 0: 'action', 1: 'action', 2: 'turn', 3: 'turn' });
    expect(spec).toBe('.##./#### | 0-1:action, 2-3:turn');
    expect(parseContainerPreset(spec)!.zones['0,1']).toBe('action');
    expect(formatContainerPreset(['##'], {})).toBe('##');
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

describe('Fallenlassen und Verstauen (REQ-225, D58)', () => {
  const leiter = ['free action', 'bonus action', 'action', 'turn', 'round'];
  it('liest die Kosten aus der Einstellung', () => {
    expect(handActions('drop:free action, stow:bonus action', leiter)).toEqual({ drop: 'free action', stow: 'bonus action' });
  });
  it('ein Wert ausserhalb der Leiter gilt nicht', () => {
    expect(handActions('drop:sneeze, stow:bonus action', leiter)).toEqual({ drop: null, stow: 'bonus action' });
    expect(handActions(undefined, leiter)).toEqual({ drop: null, stow: null });
  });
  it('in der Hand ist, was an einer Hand liegt — oder ohne Platz „held“', () => {
    expect(inHand({ slot: 'mainHand' })).toBe(true);
    expect(inHand({ slot: 'belt', tier: 'held' })).toBe(false);
    expect(inHand({ tier: 'held' })).toBe(true);
    expect(inHand({ tier: 'pack' })).toBe(false);
  });
});

import {
  coins, containerShape, firstFreeSpot, fitsAt, pieceInShape, insideOf, inventoryRulesOf, itemShape, loadStage,
  moveHeld, pieceZone, reservationBreaches, reserve, reservedFor, slotsUsed, totalWeight, turnGrid,
} from '../src/inventory.js';
import type { Entity, Relation } from '../src/types.js';

describe('Das Raster (T-127)', () => {
  it('dreht eine Form im Uhrzeigersinn', () => {
    expect(turnGrid(['##', '#.'], 1)).toEqual(['##', '.#']);
    expect(itemShape(['###'], 90)).toMatchObject({ w: 1, h: 3 });
    expect(itemShape(undefined)).toEqual({ rows: ['#'], w: 1, h: 1 });
  });

  it('nimmt die eigene Form vor Tragraster vor Rechteck', () => {
    expect(containerShape(['#.', '##'], ['###'], 4, 2).rows).toEqual(['#.', '##']);
    expect(containerShape([], ['###'], 4, 2).rows).toEqual(['###']);
    expect(containerShape(undefined, null, 3, 2).rows).toEqual(['###', '###']);
  });

  it('prüft Rand, gesperrte und belegte Felder, und findet den ersten freien Platz', () => {
    const box = containerShape(['##.', '###'], null);
    const bogen = { key: 'a', rows: ['##'] };
    expect(fitsAt(box, [], bogen, 0, 0)).toBe(true);
    expect(fitsAt(box, [], bogen, 1, 0)).toBe(false); // gesperrt
    expect(fitsAt(box, [], bogen, 2, 1)).toBe(false); // Rand
    const liegt = [{ key: 'b', rows: ['#'], gx: 0, gy: 0 }];
    expect(firstFreeSpot(box, liegt, bogen)).toEqual({ gx: 0, gy: 1, rot: 0 });
    const lang = { key: 'c', rows: ['##'] };
    expect(firstFreeSpot(containerShape(['#', '#'], null), [], lang)).toEqual({ gx: 0, gy: 0, rot: 90 });
    expect(pieceInShape(containerShape(['#'], null), { key: 'd', rows: ['##'], gx: 0, gy: 0 })).toBe(false);
  });

  it('gibt einem Stück die langsamste Zone, die es bedeckt', () => {
    const zonen = { '0,0': 'bonus action', '1,0': 'turn' };
    expect(pieceZone(zonen, { key: 'a', rows: ['##'], gx: 0, gy: 0 }, LEITER)).toBe('turn');
    expect(pieceZone(zonen, { key: 'a', rows: ['#'] }, LEITER)).toBeNull();
  });
});

describe('Regelset, Gewicht, Slots, Münzen (T-127)', () => {
  it('liest das Regelset der Kampagne, ohne Angabe das Raster', () => {
    const k = (v: unknown) => ({ id: 'k', interfaces: ['Campaign'], components: { Campaign: { inventory: v } } }) as unknown as Entity;
    expect(inventoryRulesOf(k('weight'))).toBe('weight');
    expect(inventoryRulesOf(k('quatsch'))).toBe('grid');
    expect(inventoryRulesOf(null)).toBe('grid');
  });

  it('rechnet Gewicht, Tragestufe und Slots', () => {
    expect(totalWeight([{ qty: 2, weight: 1.5 }, { qty: 1 }])).toBe(3);
    expect(loadStage(80, 15)?.stage).toBe('encumbered');
    expect(loadStage(240, 15)?.stage).toBe('over');
    expect(loadStage(10, 15, 2)?.max).toBe(450);
    expect(loadStage(10, undefined)).toBeNull();
    expect(slotsUsed([{ qty: 25, stackSize: 20 }, { qty: 1 }])).toBe(3);
    expect(coins(1234)).toEqual({ pp: 1, gp: 2, sp: 3, cp: 4 });
  });
});

describe('Verschieben und Reservieren (T-127, T-128)', () => {
  const inv = (id: string, rel: Entity['relations'] = []) => ({ id, interfaces: ['Inventory'], components: {}, relations: rel }) as Entity;
  const a = inv('a', [{ id: 'h1', type: 'holds', to: 'seil', props: { qty: 3, gx: 1, gy: 2, rot: 90, tier: 'pack' } }]);

  it('verschiebt einen Teil des Stapels und lässt die Lage zurück', () => {
    const r = moveHeld(a, inv('b'), 'h1', { qty: 2, newId: 'n1' });
    if ('refused' in r) throw new Error(r.refused);
    expect(r.from.relations?.[0]?.props).toMatchObject({ qty: 1, gx: 1 });
    expect(r.to.relations?.[0]).toMatchObject({ id: 'n1', to: 'seil', props: { qty: 2, tier: 'pack' } });
    expect(r.to.relations?.[0]?.props).not.toHaveProperty('gx');
    expect(a.relations?.[0]?.props?.['qty']).toBe(3);
  });

  it('legt zu einem losen Stapel desselben Gegenstands', () => {
    const b = inv('b', [{ id: 'x', type: 'holds', to: 'seil', props: { qty: 1 } }]);
    const r = moveHeld(a, b, 'h1', { newId: 'n1' });
    if ('refused' in r) throw new Error(r.refused);
    expect(r.from.relations).toEqual([]);
    expect(r.to.relations).toHaveLength(1);
    expect(r.to.relations?.[0]?.props?.['qty']).toBe(4);
  });

  it('verweigert Reserviertes, dasselbe Ziel und den Rucksack in sich selbst', () => {
    const res = inv('a', [reserve({ id: 'h1', type: 'holds', to: 'seil', props: { qty: 1 } }, 'auftrag-1')]);
    expect(reservedFor(res.relations?.[0])).toBe('auftrag-1');
    expect(reservedFor(reserve(res.relations![0]!, null))).toBeNull();
    expect(moveHeld(res, inv('b'), 'h1', { newId: 'n' })).toEqual({ refused: 'reserved' });
    expect(moveHeld(a, a, 'h1', { newId: 'n' })).toEqual({ refused: 'same' });
    const map = new Map<string, Entity>([
      ['sack', { id: 'sack', interfaces: ['Item'], components: {}, relations: [{ id: 'c', type: 'carries', to: 'sackinv' }] } as Entity],
      ['sackinv', inv('sackinv', [{ id: 'h', type: 'holds', to: 'beutel' }])],
      ['beutel', { id: 'beutel', interfaces: ['Item'], components: {}, relations: [{ id: 'c2', type: 'carries', to: 'beutelinv' }] } as Entity],
    ]);
    expect([...insideOf('sack', map)]).toEqual(['sackinv', 'beutelinv']);
    const b = inv('a', [{ id: 'h1', type: 'holds', to: 'sack' }]);
    expect(moveHeld(b, inv('beutelinv'), 'h1', { newId: 'n', inside: insideOf('sack', map) })).toEqual({ refused: 'cycle' });
  });
});

describe('Die Sperre (T-134)', () => {
  const vorher: Pick<Entity, 'relations'> = {
    relations: [
      { id: 'h1', type: 'holds', to: 'kraut', props: { qty: 2, tier: 'pack', reservedFor: 'o1' } },
      { id: 'h2', type: 'holds', to: 'kraut', props: { qty: 3, tier: 'pack' } },
    ],
  };
  const laeuft = (o: string) => o === 'o1';
  const mit = (h1: Relation | null) => ({ relations: [...(h1 ? [h1] : []), vorher.relations![1]!] });

  it('ein reserviertes Stück bleibt: weg, andere Menge oder frei gemacht sperrt', () => {
    expect(reservationBreaches(vorher, mit(null), laeuft)).toEqual([{ edge: 'h1', item: 'kraut', order: 'o1', change: 'removed' }]);
    expect(reservationBreaches(vorher, mit({ ...vorher.relations![0]!, props: { qty: 1, tier: 'pack', reservedFor: 'o1' } }), laeuft)[0]?.change).toBe('changed');
    expect(reservationBreaches(vorher, mit({ ...vorher.relations![0]!, props: { qty: 2, tier: 'pack' } }), laeuft)[0]?.change).toBe('changed');
    expect(reservationBreaches(vorher, null, laeuft)).toHaveLength(1);
  });

  it('umräumen im selben Behälter und das Freie ändern geht', () => {
    const umgeraeumt = { ...vorher.relations![0]!, props: { qty: 2, tier: 'pack', reservedFor: 'o1', gx: 1, gy: 0, rot: 90 } };
    expect(reservationBreaches(vorher, { relations: [umgeraeumt] }, laeuft)).toEqual([]);
  });

  it('eine Reservierung setzt keine Schreibung, und ohne laufenden Auftrag sperrt keine', () => {
    const erfunden = { relations: [vorher.relations![0]!, { ...vorher.relations![1]!, props: { qty: 3, tier: 'pack', reservedFor: 'o1' } }] };
    expect(reservationBreaches(vorher, erfunden, laeuft)).toEqual([{ edge: 'h2', item: 'kraut', order: 'o1', change: 'added' }]);
    expect(reservationBreaches(vorher, null, () => false)).toEqual([]);
  });
});

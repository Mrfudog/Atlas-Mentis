import { describe, expect, it } from 'vitest';
import {
  assembleCarry, carrySheetOf, conditionHolds, formatCarrySheet, formatContainerTemplate, legacyCarrySheet,
  parseCarrySheet, parseContainerTemplate, zoneMap, zonesFromMap, type CarrySheet,
} from '../src/carrySheet.js';

const ALT = { carrySquares: 'tiny:3, small:4, medium:5, large:6', carryZones: '0-1:bonus action, 2-4:action, 5-8:turn, 9-10:round' };
const werte = (v: Record<string, unknown>) => (f: string) => v[f];

describe('Das Tragblatt aus Bausteinen (REQ-356)', () => {
  it('fügt Grösse und Stärke aneinander, ohne Lücke', () => {
    const blatt = legacyCarrySheet(ALT)!;
    const t = assembleCarry(blatt, werte({ 'Statblock.size': 'Small', 'Statblock.carryExtra': 3 }))!;
    expect(t.rows).toEqual(['#######', '#######', '#######', '####...']);
    expect(t.parts.map((p) => [p.id, p.x, p.w])).toEqual([['size-small', 0, 4], ['strength-3', 4, 3]]);
  });

  it('behält die Zonen, die bisher galten — das Zusatzquadrat liest die Spalten ab dem grössten Grundquadrat', () => {
    const t = assembleCarry(legacyCarrySheet(ALT), werte({ 'Statblock.size': 'small', 'Statblock.carryExtra': 4 }))!;
    expect(t.zones['0,0']).toBe('bonus action');
    expect(t.zones['3,3']).toBe('action');
    /* Spalte 4 ist das Zusatzquadrat: früher Spalte 6 des Blatts, „turn". */
    expect(t.zones['4,0']).toBe('turn');
    expect(t.zones['7,0']).toBe('round');
  });

  it('gibt ohne passenden Baustein kein Raster', () => {
    expect(assembleCarry(legacyCarrySheet(ALT), werte({ 'Statblock.size': 'huge', 'Statblock.carryExtra': 0 }))).toBeNull();
    expect(assembleCarry(null, werte({}))).toBeNull();
  });

  it('prüft Werte und Spannen; ohne Wert gilt keine Bedingung', () => {
    expect(conditionHolds({ field: 'f', is: ['Medium'] }, 'medium')).toBe(true);
    expect(conditionHolds({ field: 'f', min: 1, max: 2 }, 3)).toBe(false);
    expect(conditionHolds({ field: 'f', min: 1 }, '2')).toBe(true);
    expect(conditionHolds({ field: 'f' }, undefined)).toBe(false);
    /* Eine Bedingung ohne Werte ist nicht fertig gesagt: sie gilt für niemanden. */
    expect(conditionHolds({ field: 'f' }, 'medium')).toBe(false);
  });

  it('nimmt eine Zone als Felder mit einer Dauer; gesperrte Felder haben keine', () => {
    const rows = ['##', '#.'];
    const z = zoneMap(rows, [{ id: 'a', draw: 'action', cells: ['0,0', '1,1'] }, { id: 'b', draw: 'turn', cells: ['1,0'] }]);
    expect(z).toEqual({ '0,0': 'action', '1,0': 'turn' });
    expect(zonesFromMap(z).map((x) => x.draw).sort()).toEqual(['action', 'turn']);
  });

  it('liest sich so zurück, wie es geschrieben wurde; die Einstellung geht den alten vor', () => {
    const blatt: CarrySheet = {
      blocks: [{ id: 'b', label: 'Orc', when: [{ field: 'Statblock.size', is: ['medium'] }, { field: 'Abilities.str', min: 18 }], rows: ['###'], zones: [{ id: 'z', draw: 'free action', cells: ['0,0'] }] }],
    };
    const s = formatCarrySheet(blatt);
    expect(parseCarrySheet(s)).toEqual(blatt);
    expect(carrySheetOf({ ...ALT, carrySheet: s })).toEqual(blatt);
    expect(carrySheetOf(ALT)!.blocks).toHaveLength(9);
    expect(parseCarrySheet('kein json')).toBeNull();
  });
});

describe('Behältervorlagen mit Zonen (REQ-356)', () => {
  it('liest die ältere Form nach Spalten und die neue mit Zonen', () => {
    const alt = parseContainerTemplate('.###../######/######/######/.###.. | 0-1:action, 2-3:turn, 4-5:round')!;
    const map = zoneMap(alt.rows, alt.zones);
    expect(map['0,0']).toBeUndefined();
    expect(map['0,1']).toBe('action');
    expect(map['5,2']).toBe('round');
    const neu = parseContainerTemplate(formatContainerTemplate({ rows: ['##'], zones: [{ id: 'z', draw: 'turn', cells: ['1,0'] }] }))!;
    expect(zoneMap(neu.rows, neu.zones)).toEqual({ '1,0': 'turn' });
    expect(parseContainerTemplate('')).toBeNull();
  });
});

describe('Werte aus dem Statblock (REQ-356)', () => {
  it('rechnet ein gerechnetes Feld und klemmt es auf seine Spanne', async () => {
    const { carryFieldValue } = await import('../src/carrySheet.js');
    const registry = {
      interfaces: {
        Statblock: { name: 'Statblock', schema: { properties: { size: { type: 'string' as const }, carryExtra: { type: 'number' as const, derived: 'mod(str)', min: 0, max: 5 } } } },
      },
    } as never;
    const wert = carryFieldValue(registry, { Statblock: { size: 'small' }, Abilities: { str: 24 } });
    expect(wert('Statblock.size')).toBe('small');
    expect(wert('Statblock.carryExtra')).toBe(5);
    expect(carryFieldValue(registry, { Statblock: {}, Abilities: { str: 6 } })('Statblock.carryExtra')).toBe(0);
  });
});

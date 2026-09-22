import { describe, expect, it } from 'vitest';
import { convert, convertText, formatMeasure, unitByCode, unitsFor } from '../src/units.js';
import type { Registry } from '../src/types.js';
import { seedRegistry } from '../../registry/src/index.js';

/**
 * Einheiten sind Zeilen, nicht Code. Geprüft wird deshalb nicht, ob die
 * Zahlen stimmen — das tut der Taschenrechner —, sondern ob die Auflösung
 * das Richtige tut: die passende Grössenordnung wählt, Unbekanntes in Ruhe
 * lässt und sich die Zuständigkeit die `extends`-Kette hoch holt.
 */
describe('units', () => {
  it('knows a unit by its code and by how the vault spells it', () => {
    expect(unitByCode(seedRegistry, 'ft')?.quantity).toBe('length');
    expect(unitByCode(seedRegistry, 'feet')?.code).toBe('ft');
    expect(unitByCode(seedRegistry, 'Fuss')?.code).toBe('ft');
    expect(unitByCode(seedRegistry, 'zorp')).toBeUndefined();
  });

  /* Drei Meilen sind knapp fünf Kilometer und nicht 4828 Meter. Ohne die
     Wahl nach Grössenordnung bräuchte jede Entfernung ein Feld dafür, in
     welcher Einheit sie gemeint ist. */
  it('picks the unit that reads, not the base one', () => {
    expect(convert(seedRegistry, 40, 'ft', 'metric')?.unit.code).toBe('m');
    expect(convert(seedRegistry, 3, 'mi', 'metric')?.unit.code).toBe('km');
    expect(convert(seedRegistry, 6, 'in', 'metric')?.unit.code).toBe('cm');
    expect(convert(seedRegistry, 30, 'lb', 'metric')?.unit.code).toBe('kg');
  });

  it('shows one system, or both with the stored one first', () => {
    expect(formatMeasure(seedRegistry, 40, 'ft', 'imperial')).toMatch(/40.*ft/);
    expect(formatMeasure(seedRegistry, 40, 'ft', 'metric')).toMatch(/12\.2.*m/);
    const beide = formatMeasure(seedRegistry, 40, 'ft', 'both');
    expect(beide.indexOf('ft')).toBeLessThan(beide.indexOf('('));
    expect(beide).toMatch(/12\.2/);
  });

  /* Die Geschwindigkeit einer Kreatur heisst im Vault „40 ft, climb 20 ft"
     und ist keine Zahl. Ein Umschreiben, das auch nur manchmal danebengreift,
     wäre schlimmer als gar keines — man sähe es dem Ergebnis nicht an. */
  it('converts measures inside prose and leaves the prose alone', () => {
    const t = convertText(seedRegistry, '40 ft, climb 20 ft', 'metric');
    expect(t).toMatch(/climb/);
    expect(t).not.toMatch(/ft/);
    expect(convertText(seedRegistry, '7 zorp of nothing', 'metric')).toBe('7 zorp of nothing');
    expect(convertText(seedRegistry, '', 'metric')).toBe('');
  });

  /* **Das Ausgangsmass des Feldes** springt nur ein, wo keine Zahl ihre
     Einheit nennen kann: „40" und „30/120" sind Fuss, „7 zorp" bleibt
     sieben Zorp. Alles andere wäre geraten — in „climb 20" könnte „climb"
     eine Einheit sein, die diese Kampagne kennt und der Code nicht. */
  it('assumes the field unit for a text with no word in it', () => {
    expect(convertText(seedRegistry, '40', 'metric', 'ft')).toMatch(/12\.2.*m/);
    const bereich = convertText(seedRegistry, '30/120', 'metric', 'ft');
    expect(bereich).toMatch(/9\.1/);
    expect(bereich).toMatch(/36\.6/);
    expect(bereich).toMatch(/\//);
    /* Ohne Annahme bleibt eine nackte Zahl eine nackte Zahl. */
    expect(convertText(seedRegistry, '40', 'metric')).toBe('40');
    /* Steht ein Wort im Text, gilt wieder nur, was seine Einheit nennt. */
    expect(convertText(seedRegistry, '7 zorp', 'metric', 'ft')).toBe('7 zorp');
    expect(convertText(seedRegistry, '40 ft, climb 20', 'metric', 'ft')).toMatch(/climb 20$/);
    /* Eine Annahme, die keine Zeile im Register hat, ist keine. */
    expect(convertText(seedRegistry, '40', 'metric', 'zorp')).toBe('40');
  });

  /* Eine Kreatur darf imperial bleiben, weil ihre Zahlen aus dem Regelwerk
     kommen, während der Rest der Kampagne metrisch dasteht. */
  it('takes the system from the type, then the campaign, then both', () => {
    const reg: Registry = {
      ...seedRegistry,
      interfaces: {
        ...seedRegistry.interfaces,
        Creature: { ...seedRegistry.interfaces['Creature']!, units: 'imperial' },
      },
      settings: { ...seedRegistry.settings, units: 'metric' },
    };
    expect(unitsFor(reg, 'PlayerCharacter')).toBe('imperial'); // geerbt von Creature
    expect(unitsFor(reg, 'Place')).toBe('metric'); // aus der Einstellung
    expect(unitsFor({ interfaces: {}, settings: {} }, 'Nothing')).toBe('both');
  });
});

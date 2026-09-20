/**
 * Welche Eingabe ein Feld bekommt — und was aus ihr zurückkommt.
 *
 * Das ist die Stelle, an der eine Oberfläche still Daten verdirbt: ein
 * Tippfehler wird zu 0, ein leeres Feld zu "", eine Liste zu einem String.
 * Nichts davon fällt beim Klicken auf, und alles davon steht danach in der
 * Datenbank.
 */

import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import { ausEingabe, eingabeArt, inEingabe } from '../src/app/artikel/felder';

describe('eingabeArt', () => {
  it('reads the kind out of the registry, not out of the field name', () => {
    const map = seedRegistry.components.MapInfo.schema.properties ?? {};
    expect(eingabeArt(map['kind'])).toBe('auswahl'); // hat ein enum
    expect(eingabeArt(map['gridSize'])).toBe('zahl');
    expect(eingabeArt(map['fog'])).toBe('jaNein');
    expect(eingabeArt(map['reveal'])).toBe('liste');
    expect(eingabeArt(map['scale'])).toBe('text');
    const beschr = seedRegistry.components.Description.schema.properties ?? {};
    expect(eingabeArt(beschr['raw'])).toBe('lang'); // format: long
  });

  it('falls back to plain text rather than guessing', () => {
    expect(eingabeArt(undefined)).toBe('text');
  });
});

describe('ausEingabe', () => {
  const zahl = { type: 'number' as const, title: 'n' };
  const liste = { type: 'array' as const, title: 'l' };
  const ja = { type: 'boolean' as const, title: 'b' };

  /* Unsinn wird nicht zu 0. Eine Zahl, die aus einem Tippfehler entsteht,
     ist schlimmer als ein leeres Feld — dasselbe Argument wie beim
     Rechenwerk, und derselbe Fehler, den man dort schon gemacht hat. */
  it('turns nonsense into nothing, never into zero', () => {
    expect(ausEingabe(zahl, 'zwölf')).toBeUndefined();
    expect(ausEingabe(zahl, '')).toBeUndefined();
    expect(ausEingabe(zahl, '0')).toBe(0);
    expect(ausEingabe(zahl, '12')).toBe(12);
  });

  /* Ein Komma ist auf einer Schweizer Tastatur das, was man tippt. */
  it('takes a comma for a decimal point', () => {
    expect(ausEingabe(zahl, '1,5')).toBe(1.5);
  });

  it('splits a list and drops the empty pieces', () => {
    expect(ausEingabe(liste, 'a, b ,, c')).toEqual(['a', 'b', 'c']);
    expect(ausEingabe(liste, '   ')).toBeUndefined();
  });

  it('keeps a checkbox a boolean', () => {
    expect(ausEingabe(ja, true)).toBe(true);
    expect(ausEingabe(ja, false)).toBe(false);
  });

  /* Ein leeres Textfeld ist kein leerer String: der Unterschied zwischen
     „nichts gesetzt" und „auf leer gesetzt" ist im Modell der zwischen
     „Komponente fehlt" und „Komponente mit leerem Feld". */
  it('turns an empty text field into nothing, not into an empty string', () => {
    expect(ausEingabe(undefined, '')).toBeUndefined();
    expect(ausEingabe(undefined, 'Volo')).toBe('Volo');
  });
});

describe('inEingabe', () => {
  it('never shows the word undefined', () => {
    expect(inEingabe(undefined)).toBe('');
    expect(inEingabe(null)).toBe('');
    expect(inEingabe(0)).toBe('0');
    expect(inEingabe(false)).toBe('false');
    expect(inEingabe(['a', 'b'])).toBe('a, b');
  });
});

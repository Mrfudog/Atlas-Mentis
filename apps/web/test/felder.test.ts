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
import { parseMarkdown } from '@nw/model';
import {
  anzeigeWert,
  ausEingabe,
  eingabeArt,
  inEingabe,
  kantenAusEntwurf,
  sindZeilen,
  tabelleAlsText,
} from '../src/app/artikel/felder';

describe('eingabeArt', () => {
  it('reads the kind out of the registry, not out of the field name', () => {
    const map = seedRegistry.interfaces.Map.schema?.properties ?? {};
    expect(eingabeArt(map['kind'])).toBe('auswahl'); // hat ein enum
    expect(eingabeArt(map['gridSize'])).toBe('zahl');
    expect(eingabeArt(map['fog'])).toBe('jaNein');
    expect(eingabeArt(map['reveal'])).toBe('json'); // Liste von Objekten (W1)
    expect(eingabeArt(map['scale'])).toBe('text');
    const beschr = seedRegistry.interfaces.Description.schema?.properties ?? {};
    expect(eingabeArt(beschr['description'])).toBe('lang'); // format: long
  });

  /* Übungen halten mehrere Namen (M6) — ein `select` schrieb ein Wort in
     ein Feld, das eine Liste hält. */
  it('gives a list, not a single choice, to a field that holds several values', () => {
    const prof = seedRegistry.interfaces.Proficiencies.schema?.properties ?? {};
    expect(eingabeArt(prof['proficient'])).toBe('liste');
    expect(eingabeArt(prof['saves'])).toBe('liste');
    expect(ausEingabe(prof['saves'], 'str, con')).toEqual(['str', 'con']);
  });

  /* Ein Verweisfeld hält eine Id; gewählt wird über die Suche (W7). */
  it('picks an article for a link field, and writes its id back as text', () => {
    const aktion = seedRegistry.interfaces.Action.schema?.properties ?? {};
    expect(eingabeArt(aktion['actionType'])).toBe('verweis');
    expect(ausEingabe(aktion['actionType'], 'e5_123')).toBe('e5_123');
    expect(ausEingabe(aktion['actionType'], '')).toBeUndefined();
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

describe('kantenAusEntwurf', () => {
  /* „Zeigt auf nichts" ist im Modell kein Zustand, den eine Kante haben
     darf — dafür gibt es das Feld. Eine halbfertige Zeile in der Maske ist
     kein Grund, eine kaputte Kante zu schreiben. */
  it('drops an edge that points at nothing instead of writing it empty', () => {
    const raus = kantenAusEntwurf([
      { id: 'r1', type: 'livesIn', to: 'o_kerzengasse', props: {} },
      { id: 'r2', type: 'livesIn', to: '', props: {} },
      { id: 'r3', type: '', to: 'o_markt', props: {} },
    ]);
    expect(raus.map((k) => k.id)).toEqual(['r1']);
  });

  it('carries the edge’s own properties along', () => {
    const raus = kantenAusEntwurf([
      { id: 'r1', type: 'holds', to: 'it_seil', props: { qty: 2, tier: 'pack' } },
    ]);
    expect(raus[0]?.props).toEqual({ qty: 2, tier: 'pack' });
  });

  /* Kopiert, nicht durchgereicht: sonst änderte ein späterer Tastendruck in
     der Maske noch das, was gerade geschrieben wird. */
  it('copies the properties rather than handing the draft through', () => {
    const entwurf = [{ id: 'r1', type: 'holds', to: 'it_seil', props: { qty: 2 } }];
    const raus = kantenAusEntwurf(entwurf);
    entwurf[0]!.props['qty'] = 99;
    expect(raus[0]?.props['qty']).toBe(2);
  });
});

/* W1: was als „[object Object]" in der Feldtabelle stand. */
describe('anzeigeWert', () => {
  it('writes an object as its entries, a number with its sign', () => {
    expect(anzeigeWert({ str: 2, cha: 1 })).toBe('str +2, cha +1');
    expect(anzeigeWert({ int: 5, History: -1 })).toBe('int +5, History -1');
    expect(anzeigeWert({ CREATURE: 'the creature' })).toBe('CREATURE: the creature');
  });

  it('keeps lists and plain values as they were', () => {
    expect(anzeigeWert(['Common', 'Draconic'])).toBe('Common, Draconic');
    expect(anzeigeWert(30)).toBe('30');
    expect(anzeigeWert([{ a: 1 }, { b: 'x' }])).toBe('a +1; b: x');
    expect(anzeigeWert(undefined)).toBe('');
  });

  it('never prints [object Object]', () => {
    expect(anzeigeWert({ nested: { deep: [1, { x: 2 }] } })).not.toContain('[object Object]');
  });
});

describe('tabelleAlsText', () => {
  const zeilen = [
    { cells: ['1', '[[item-0263|Black opal]] (dark green)'], text: '…', weight: 1 },
    { cells: ['2', 'A | B'] },
    { cells: ['3'] },
  ];

  it('recognises table rows and nothing else', () => {
    expect(sindZeilen(zeilen)).toBe(true);
    expect(sindZeilen(['a', 'b'])).toBe(false);
    expect(sindZeilen([])).toBe(false);
  });

  it('reads back through parseMarkdown with the link whole and the bar in the text escaped', () => {
    const [b] = parseMarkdown(tabelleAlsText(['d8', 'Stone Description'], zeilen));
    expect(b).toMatchObject({
      kind: 'table',
      head: ['d8', 'Stone Description'],
      rows: [
        ['1', '[[item-0263|Black opal]] (dark green)'],
        ['2', 'A | B'],
        ['3', ''],
      ],
    });
  });

  it('keeps a row wider than the head', () => {
    const [b] = parseMarkdown(tabelleAlsText(['d6'], [{ cells: ['1', 'extra'] }]));
    expect(b).toMatchObject({ kind: 'table', rows: [['1', 'extra']] });
  });
});

/* W1: ein Objekt in der Maske hiess „[object Object]" und wurde so gespeichert. */
describe('Objektfelder in der Maske', () => {
  const ancestry = seedRegistry.interfaces.Ancestry?.schema?.properties ?? {};
  const table = seedRegistry.interfaces.Table?.schema?.properties ?? {};

  it('offers JSON for an object or a list of objects', () => {
    expect(eingabeArt(ancestry['abilityBonus'])).toBe('json');
    expect(eingabeArt(table['rows'])).toBe('json');
    expect(eingabeArt(table['columns'])).toBe('liste');
  });

  it('round-trips the value instead of writing [object Object]', () => {
    const bonus = { str: 2, cha: 1 };
    expect(ausEingabe(ancestry['abilityBonus'], inEingabe(bonus))).toEqual(bonus);
    const zeilen = [{ cells: ['1', '[[item-0263|Black opal]]'], weight: 1 }];
    expect(ausEingabe(table['rows'], inEingabe(zeilen))).toEqual(zeilen);
    expect(inEingabe(['a', 'b'])).toBe('a, b');
  });

  it('keeps unreadable JSON as text so validation can say so', () => {
    expect(ausEingabe(ancestry['abilityBonus'], '{str: 2')).toBe('{str: 2');
    expect(ausEingabe(ancestry['abilityBonus'], '  ')).toBeUndefined();
  });
});

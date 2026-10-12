import { describe, expect, it } from 'vitest';
import { KOPIE_VON, loeseKopien, profAusCr } from '../src/copy.js';
import type { Knoten } from '../src/copy.js';

const schluessel = (e: Knoten) => `${String(e['name']).toLowerCase()}|${String(e['source']).toLowerCase()}`;

const ogre: Knoten = {
  name: 'Ogre',
  source: 'MM',
  page: 237,
  srd: true,
  cr: '2',
  str: 19,
  senses: ['darkvision 60 ft.'],
  trait: [{ name: 'Big', entries: ['The ogre is big.'] }],
  action: [
    { name: 'Greatclub', entries: ['{@atk mw} {@hit 6} to hit. The ogre swings.'] },
    { name: 'Javelin', entries: ['{@atk rw} {@hit 6} to hit.'] },
  ],
};

describe('_copy auflösen (Abgleich §4.2, Schritt 3)', () => {
  it('übernimmt, was die Kopie nicht setzt, und lässt die Fundstelle der Vorlage weg', () => {
    const [, kopie] = loeseKopien([ogre, { name: 'Half-Ogre', source: 'MM', _copy: { name: 'Ogre', source: 'MM' }, str: 17 }], schluessel, () => {});
    expect(kopie!['str']).toBe(17);
    expect(kopie!['cr']).toBe('2');
    expect(kopie!['page']).toBeUndefined();
    expect(kopie!['srd']).toBeUndefined();
    expect(kopie![KOPIE_VON]).toBe('ogre|mm');
  });

  it('nimmt mit `_preserve` auch die Fundstelle mit', () => {
    const [, kopie] = loeseKopien([ogre, { name: 'B', source: 'MM', _copy: { name: 'Ogre', source: 'MM', _preserve: { page: true } } }], schluessel, () => {});
    expect(kopie!['page']).toBe(237);
  });

  it('wendet die Bearbeitungsschritte an — Text, Listen, Wurzel', () => {
    const [, kopie] = loeseKopien(
      [
        ogre,
        {
          name: 'Ogre Chieftain',
          source: 'MM',
          _copy: {
            name: 'Ogre',
            source: 'MM',
            _mod: {
              '*': { mode: 'replaceTxt', replace: 'the ogre', with: 'the chieftain', flags: 'i' },
              action: [
                { mode: 'removeArr', names: 'Javelin' },
                { mode: 'appendArr', items: { name: 'Roar', entries: ['Loud.'] } },
              ],
              trait: { mode: 'replaceArr', replace: 'Big', items: { name: 'Bigger', entries: ['Bigger.'] } },
              _: [
                { mode: 'addSenses', senses: [{ type: 'darkvision', range: 120 }] },
                { mode: 'scalarAddHit', scalar: 2 },
              ],
            },
          },
        },
      ],
      schluessel,
      () => {},
    );
    const aktionen = kopie!['action'] as Knoten[];
    expect(aktionen.map((a) => a['name'])).toEqual(['Greatclub', 'Roar']);
    expect((aktionen[0]!['entries'] as string[])[0]).toBe('{@atk mw} {@hit 8} to hit. The chieftain swings.');
    expect((kopie!['trait'] as Knoten[])[0]!['name']).toBe('Bigger');
    expect(kopie!['senses']).toEqual(['darkvision 120 ft.']);
    /* Die Vorlage bleibt, wie sie war. */
    expect((ogre['action'] as Knoten[]).length).toBe(2);
  });

  it('löst eine Kopie einer Kopie und einen Pfad als Schlüssel', () => {
    const liste = loeseKopien(
      [
        { name: 'C', source: 'X', _copy: { name: 'B', source: 'X', _mod: { 'inherits.rarity': { mode: 'setProp', value: 'rare' } } } },
        { name: 'B', source: 'X', _copy: { name: 'A', source: 'X' } },
        { name: 'A', source: 'X', inherits: { rarity: 'common', bonusWeapon: '+1' } },
      ],
      schluessel,
      () => {},
    );
    expect(liste[0]!['inherits']).toEqual({ rarity: 'rare', bonusWeapon: '+1' });
    expect(liste[1]!['inherits']).toEqual({ rarity: 'common', bonusWeapon: '+1' });
  });

  it('meldet eine Kopie ohne Vorlage, statt still zu raten', () => {
    const meldungen: string[] = [];
    loeseKopien([{ name: 'X', source: 'Y', _copy: { name: 'Nope', source: 'Y' } }], schluessel, (m) => meldungen.push(m));
    expect(meldungen).toEqual(['_copy ohne Vorlage']);
  });
});

describe('Übungsbonus aus dem Herausforderungsgrad', () => {
  it('folgt der Tabelle des Monster Manual', () => {
    expect([profAusCr('1/4'), profAusCr('4'), profAusCr('5'), profAusCr('8'), profAusCr('9'), profAusCr({ cr: '17' }), profAusCr('30')]).toEqual([2, 2, 3, 3, 4, 6, 9]);
  });
});

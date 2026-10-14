import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { Entity } from '@nw/model';
import type { Knoten } from '../src/copy.js';
import type { Datenstand } from '../src/lesen.js';
import { lauf } from '../src/lauf.js';
import { kreaturenMitAnzahl } from '../src/arten/abenteuer.js';
import { buchEbeneId } from '../src/werkbank.js';

/**
 * Ein erfundenes Abenteuer in der Form von 5e.tools (T-082) — keine Daten
 * von dort: ein Kapitel mit einer Höhle und zwei Räumen, Vorlesetext,
 * einer Karte und Kreaturen mit und ohne Anzahl.
 */
function datenstand(): Datenstand {
  const arten = new Map<string, Knoten[]>();
  arten.set('monster', [
    { name: 'Goblin', source: 'MM', cr: '1/4', dex: 14 },
    { name: 'Wolf', source: 'MM', cr: '1/4', dex: 15 },
    { name: 'Tamsin Reedfoot', source: 'TST', cr: '1', dex: 12 },
  ]);
  arten.set('spell', [{ name: 'Sleep', source: 'PHB', level: 1, school: 'E', entries: ['Zzz.'] }]);
  const daten: Knoten[] = [
    {
      type: 'section', name: 'Introduction', id: '000', page: 1,
      entries: ['The heroes are hired by {@creature Tamsin Reedfoot|TST}.', { type: 'entries', name: 'Background', id: '001', entries: ['Long ago.'] }],
    },
    {
      type: 'section', name: 'The Reed Caves', id: '002', page: 3,
      entries: [
        'A short chapter.',
        { type: 'image', href: { type: 'internal', path: 'adventure/TST/Marsh.webp' }, imageType: 'map', title: 'The Marsh', grid: { type: 'hexRowsOdd' } },
        {
          type: 'section', name: 'Reed Cave', id: '003', page: 4,
          entries: [
            'Muddy.',
            { type: 'gallery', images: [
              { type: 'image', href: { type: 'internal', path: 'adventure/TST/Reed Cave.webp' }, imageType: 'map', title: 'Reed Cave', credit: 'Someone', grid: { type: 'square', size: 70, offsetX: 3 } },
              { type: 'image', href: { type: 'internal', path: 'adventure/TST/Reed Cave (Player).webp' }, imageType: 'mapPlayer', title: 'Player Version' },
            ] },
            { type: 'entries', name: 'General Features', id: '004', entries: ['Wet walls.'] },
            {
              type: 'entries', name: '1. Mouth', id: '005', page: 4,
              entries: [
                { type: 'insetReadaloud', id: '006', entries: ['Water drips from the reeds.'] },
                'Two {@creature goblin||goblins} and a {@creature wolf} wait here. They cast {@spell sleep} sometimes. See {@area 2|007}.',
              ],
            },
            { type: 'entries', name: '2. Den', id: '007', entries: ['The {@creature goblin} boss is away. Back to {@area 1|005}.'] },
          ],
        },
      ],
    },
    { type: 'section', name: 'Credits', id: '008', entries: ['Thanks.'] },
  ];
  return {
    arten,
    quellen: new Map([
      ['mm', { id: 'MM', name: 'Monster Manual', published: '2014-09-30', art: 'book' }],
      ['phb', { id: 'PHB', name: "Player's Handbook", published: '2014-08-19', art: 'book' }],
      ['tst', { id: 'TST', name: 'The Sunken Test', published: '2015-01-01', art: 'adventure', storyline: 'Reeds', level: { start: 1, end: 3 } }],
    ]),
    abenteuer: new Map([
      ['tst', {
        id: 'TST',
        kopf: {
          name: 'The Sunken Test', id: 'TST', source: 'TST', published: '2015-01-01', level: { start: 1, end: 3 },
          contents: [{ name: 'Introduction' }, { name: 'The Reed Caves', ordinal: { type: 'chapter', identifier: 1 } }, { name: 'Credits' }],
        },
        daten,
      }],
    ]),
  };
}

const art = (e: Entity) => e.interfaces[0];
const finde = (es: Entity[], typ: string, name: string) => es.find((e) => art(e) === typ && e.name === name)!;
const kanten = (e: Entity, typ: string) => (e.relations ?? []).filter((r) => r.type === typ);

describe('Abenteuer als Ebene (T-082)', () => {
  const { datei, bericht } = lauf(datenstand());
  const es = datei.entities;
  const ebene = es.find((e) => e.id === buchEbeneId('TST'))!;

  it('legt je Abenteuer eine Ebene mit kind adventure an', () => {
    expect(ebene.components['Layer']).toMatchObject({ kind: 'adventure', abbreviation: 'TST', levels: '1–3', storyline: 'Reeds' });
    /* In der Gruppe der Abenteuer (T-088) und bei seinem Herausgeber (T-094). */
    /* Dazu die Gruppe der 2014-Regeln (T-109). */
    expect(kanten(ebene, 'partOf').map((r) => r.to)).toEqual(['e5_group_adventure', 'e5_publisher_official', 'e5_367c46d7f4ff']);
    expect(es.find((e) => e.id === buchEbeneId('MM'))!.components['Layer']).toMatchObject({ kind: 'book' });
  });

  it('baut Abenteuer → Kapitel → Abschnitte als Story, Arc und Scene mit partOf', () => {
    const ganz = finde(es, 'Story', 'The Sunken Test');
    expect(ganz.components['Story']).toEqual({ kind: 'adventure' });
    /* Ein Kapitel ist ein Arc (E-026), ohne `kind` — die Art sagt es. */
    const kapitel = finde(es, 'Arc', 'Chapter 1: The Reed Caves');
    expect(kapitel.components['Story']).toBeUndefined();
    expect(es.some((e) => art(e) === 'Story' && e.name === 'Chapter 1: The Reed Caves')).toBe(false);
    expect(kanten(kapitel, 'partOf').map((r) => r.to)).toEqual([ganz.id]);
    const hoehle = finde(es, 'Scene', 'Reed Cave');
    expect(kanten(hoehle, 'partOf').map((r) => r.to)).toEqual([kapitel.id]);
    /* Räume werden eigene Szenen, „General Features" bleibt Text der Höhle. */
    const mund = finde(es, 'Scene', '1. Mouth');
    expect(kanten(mund, 'partOf').map((r) => r.to)).toEqual([hoehle.id]);
    expect(es.some((e) => e.name === 'General Features')).toBe(false);
    expect(JSON.stringify(hoehle.components['Prose'])).toContain('Wet walls.');
    /* Alles liegt in der Ebene des Abenteuers, und die Leitung sieht es. */
    for (const e of [ganz, kapitel, hoehle, mund]) {
      expect(kanten(e, 'inLayer').map((r) => r.to)).toEqual([ebene.id]);
      expect(e.components['Visibility']).toEqual({ audience: 'gm' });
    }
  });

  it('lässt die Danksagung weg und zählt sie', () => {
    expect(es.some((e) => e.name === 'Credits')).toBe(false);
    expect(bericht.arten.get('adventureData')!.notizen.get('Kapitel weggelassen: Credits')).toBe(1);
  });

  it('trennt Vorlesetext und Prosa; Kreaturen, Zauber und Abschnitte werden Verweise', () => {
    const mund = finde(es, 'Scene', '1. Mouth');
    expect(mund.components['ReadAloud']).toEqual({ readaloud: [{ id: 'read', value: 'Water drips from the reeds.' }] });
    const text = (mund.components['Prose'] as { paragraph: { value: string }[] }).paragraph[0]!.value;
    const nr = (e: Entity) => (e.components['Identity'] as { id: string }).id;
    expect(text).toContain(`[[${nr(finde(es, 'Statblock', 'Goblin'))}|goblins]]`);
    expect(text).toContain(`[[${nr(finde(es, 'Spell', 'Sleep'))}|sleep]]`);
    expect(text).toContain(`[[${nr(finde(es, 'Scene', '2. Den'))}|2]]`);
    expect(text).not.toContain('Water drips');
  });

  it('macht aus Kreaturen mit Anzahl eine Begegnung mit je einer Kante pro Teilnehmer', () => {
    const mund = finde(es, 'Scene', '1. Mouth');
    const kampf = finde(es, 'Encounter', '1. Mouth');
    expect(kanten(kampf, 'partOf').map((r) => r.to)).toEqual([mund.id]);
    expect(mund.components['Scene']).toEqual({ mode: 'encounter' });
    const goblin = finde(es, 'Statblock', 'Goblin');
    const wolf = finde(es, 'Statblock', 'Wolf');
    expect(kanten(kampf, 'participates').map((r) => [r.to, r.props?.['label']])).toEqual([
      [goblin.id, 'Goblin 1'],
      [goblin.id, 'Goblin 2'],
      [wolf.id, 'Wolf'],
    ]);
    /* „The goblin boss is away" nennt keine Anzahl — keine Begegnung. */
    expect(es.some((e) => art(e) === 'Encounter' && e.name === '2. Den')).toBe(false);
  });

  it('legt Karten mit Bildadresse und Raster an, ohne Spielerfassung', () => {
    const karte = finde(es, 'Map', 'Reed Cave');
    expect(karte.components['Image']).toMatchObject({ image: 'https://5e.tools/img/adventure/TST/Reed%20Cave.webp' });
    expect(karte.components['Map']).toMatchObject({ gridShape: 'square', gridSize: 70, gridOffsetX: 3, kind: 'battle' });
    expect(kanten(karte, 'mapOf').map((r) => r.to)).toEqual([finde(es, 'Scene', 'Reed Cave').id]);
    expect(es.some((e) => art(e) === 'Map' && e.name === 'Player Version')).toBe(false);
  });

  it('eine Karte im Text des Kapitels bekommt ihre eigene Szene (E-026)', () => {
    const kapitel = finde(es, 'Arc', 'Chapter 1: The Reed Caves');
    const karte = finde(es, 'Map', 'The Marsh');
    const szene = finde(es, 'Scene', 'The Marsh');
    expect(szene.id).toBe(`${karte.id}_scene`);
    expect(szene.components['Scene']).toEqual({ mode: 'exploration' });
    expect(kanten(szene, 'partOf').map((r) => r.to)).toEqual([kapitel.id]);
    expect(kanten(karte, 'mapOf').map((r) => r.to)).toEqual([szene.id]);
    expect(szene.components['Visibility']).toEqual({ audience: 'gm' });
  });

  it('ein Kapitel behält die Peg-Id, die es als Story hatte (Migration 041)', () => {
    const kapitel = finde(es, 'Arc', 'Chapter 1: The Reed Caves');
    const alt = `e5_${createHash('sha1').update('Story|adventure|tst|the reed caves').digest('hex').slice(0, 12)}`;
    expect(kapitel.id).toBe(alt);
  });

  it('die NSC des Abenteuers liegen in seiner Ebene', () => {
    const tamsin = finde(es, 'Statblock', 'Tamsin Reedfoot');
    expect(kanten(tamsin, 'inLayer').map((r) => r.to)).toEqual([ebene.id]);
  });

  it('gibt bei zwei Läufen dieselben Ids', () => {
    const zwei = lauf(datenstand()).datei.entities.map((e) => e.id);
    expect(zwei).toEqual(es.map((e) => e.id));
  });

  it('siebt nach Quelle: ohne TST kein Abenteuer', () => {
    const ohne = lauf(datenstand(), { quellen: ['MM', 'PHB'] }).datei.entities;
    expect(ohne.some((e) => art(e) === 'Scene')).toBe(false);
  });
});

describe('kreaturenMitAnzahl', () => {
  it('liest Zahlwörter und Ziffern und zählt gleiche zusammen', () => {
    expect(
      kreaturenMitAnzahl([
        'Three {@creature goblin||goblins} and 2 {@creature wolf|MM}.',
        'a pair of {@creature goblin} more; the {@creature Tamsin Reedfoot|TST} watches.',
      ]),
    ).toEqual([
      { name: 'goblin', quelle: '', anzahl: 5 },
      { name: 'wolf', quelle: 'MM', anzahl: 2 },
    ]);
  });
});

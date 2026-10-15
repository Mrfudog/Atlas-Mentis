import { describe, expect, it } from 'vitest';
import type { Entity } from '@nw/model';
import type { Knoten } from '../src/copy.js';
import type { Datenstand } from '../src/lesen.js';
import { lauf } from '../src/lauf.js';
import { kartenTitel, klartext, ortAusKarte, ortAusText, ortBefund } from '../src/orte.js';
import { buchEbeneId } from '../src/werkbank.js';
import { nurArten } from '../src/auswahl.js';

/**
 * Orte aus dem Buchtext (T-175) — mit erfundenen Beispielen, keine Daten
 * von 5e.tools: ein Settingbuch mit einem Reich, einer Stadt darin und
 * einer Gottheit, die nur „in a city" wohnt; ein Abenteuer mit einer
 * Burg, zwei Räumen mit Schlüssel und einer Karte.
 */
function datenstand(): Datenstand {
  const buch: Knoten[] = [
    {
      type: 'section', name: 'Gazetteer', id: '000', page: 5,
      entries: [
        'The lands described here.',
        {
          type: 'entries', name: 'Kingdom of Velm', id: '001', page: 6,
          entries: [
            'The Kingdom of Velm is a small kingdom of rivers and reeds.',
            {
              type: 'entries', name: 'Ravensgate', id: '002', page: 7,
              entries: [
                'Ravensgate, a walled {@b city} on the Velm, trades in salt.',
                { type: 'entries', name: 'Saltmarket', entries: ['The Saltmarket is a noisy district by the docks.'] },
              ],
            },
            { type: 'entries', name: 'Reedfolk', entries: ['The Reedfolk, a quiet river people, fish here.'] },
            { type: 'entries', name: 'Old Quarrel', id: '003', entries: ['Old Quarrel is a grudge between two families.'] },
          ],
        },
        { type: 'entries', name: 'Mother Ash', id: '004', entries: ['Her priests live in a city far to the south.'] },
      ],
    },
  ];
  const abenteuer: Knoten[] = [
    {
      type: 'section', name: 'The Keep', id: '010', page: 10,
      entries: [
        'The heroes arrive.',
        {
          type: 'section', name: 'Castle Grimmore', id: '011', page: 11,
          entries: [
            'Grey stones.',
            { type: 'image', href: { type: 'internal', path: 'adventure/TKP/Grimmore.webp' }, imageType: 'map', title: 'Castle Grimmore' },
            { type: 'entries', name: 'G1. Gate', id: '012', entries: [{ type: 'insetReadaloud', entries: ['A rusted portcullis.'] }, 'Nobody guards it.'] },
            { type: 'entries', name: 'G2. Hall', id: '013', entries: ['Dust.'] },
          ],
        },
        { type: 'section', name: 'Rumours', id: '014', entries: ['People talk.'] },
      ],
    },
  ];
  return {
    arten: new Map(),
    quellen: new Map([
      ['tgz', { id: 'TGZ', name: 'The Gazetteer', published: '2015-01-01', art: 'book' }],
      ['tkp', { id: 'TKP', name: 'The Keep', published: '2015-01-01', art: 'adventure' }],
    ]),
    buecher: new Map([['tgz', { id: 'TGZ', kopf: { name: 'The Gazetteer', id: 'TGZ', source: 'TGZ', contents: [{ name: 'Gazetteer' }] }, daten: buch }]]),
    abenteuer: new Map([['tkp', { id: 'TKP', kopf: { name: 'The Keep', id: 'TKP', source: 'TKP', contents: [{ name: 'The Keep' }] }, daten: abenteuer }]]),
  };
}

const art = (e: Entity) => e.interfaces[0];
const kanten = (e: Entity, typ: string) => (e.relations ?? []).filter((r) => r.type === typ).map((r) => r.to);

describe('Orte erkennen (T-175)', () => {
  it('liest den ersten Satz: Subjekt ist der Name, danach ein Ortswort', () => {
    expect(ortAusText('Ravensgate', 'Ravensgate is a walled city on the coast.')).toEqual({ ort: true, kind: 'Stadt' });
    expect(ortAusText('Ravensgate', 'Ravensgate, a walled city on the coast, trades.')).toEqual({ ort: true, kind: 'Stadt' });
    expect(ortAusText('The Mirewood', 'The Mirewood is an ancient forest.')).toEqual({ ort: true, kind: 'Wildnis' });
    expect(ortAusText('Mirewood', 'The Mirewood is an old haunted forest.')).toEqual({ ort: true, kind: 'Wildnis' });
    expect(ortAusText('Brennhold', 'Brennhold is a ruined dungeon.')).toEqual({ ort: true });
  });

  it('erfindet nichts: eine Gottheit „of the city" ist kein Ort, ein Ortswort anderswo nur ein Kandidat', () => {
    expect(ortAusText('Mother Ash', 'Mother Ash is a goddess of the city.').ort).toBe(false);
    expect(ortAusText('Mother Ash', 'Her priests live in a city far away.')).toEqual({ ort: false, kandidat: true });
    expect(ortAusText('Old Quarrel', 'Old Quarrel is a grudge between families.')).toEqual({ ort: false });
  });

  it('ein Raum mit Schlüssel ist ein Raum; eine Karte benennt den Ort; Räume allein sind eine Liste', () => {
    expect(ortBefund('G1. Gate', [])).toEqual({ ort: true, kind: 'Raum' });
    expect(ortBefund('1. Choose a Thing', [], { schluessel: false })).toEqual({ ort: false });
    expect(ortBefund('Areas of the Village', ['Grey.'], { raeume: true })).toEqual({ ort: false, kandidat: true });
    expect(ortBefund('Areas of the Village', ['Grey.'], { karte: 'Village of Grimm' })).toEqual({ ort: true, karte: true, name: 'Village of Grimm' });
    expect(ortBefund('Grimm', ['Grey.'], { karte: 'Grimm' })).toEqual({ ort: true, karte: true });
    expect(kartenTitel([{ type: 'image', imageType: 'map', title: 'A' }, { type: 'entries', name: '1. Room', entries: [{ type: 'image', imageType: 'map', title: 'B' }] }])).toEqual(['A']);
  });

  it('liest den Ortsnamen aus dem Kartentitel', () => {
    expect(ortAusKarte('Map 5.1: Grimm (Area N)')).toBe('Grimm');
    expect(ortAusKarte('Map 3.2: Old Mill (Area O) - Upper Floor')).toBe('Old Mill');
    expect(ortAusKarte('Map 11: Cellars & Map 12: Crypts')).toBe('Cellars');
    expect(ortAusKarte('Crypts (Battlemap; DM Version)')).toBe('Crypts');
    expect(ortAusKarte('Map: Traps in Area K9')).toBeUndefined();
  });

  it('das Ortswort muss das Hauptwort sein', () => {
    expect(ortAusText('Reedfolk', 'The Reedfolk, a quiet forest people, fish here.').ort).toBe(false);
    expect(ortAusText('Velm', 'Velm is a forest of birches.')).toEqual({ ort: true, kind: 'Wildnis' });
    expect(ortAusText('Thalos', 'Thalos is the realm of the sea god.')).toEqual({ ort: true });
  });

  it('nimmt Marken aus dem Text', () => {
    expect(klartext('a {@b walled} {@creature goblin|MM|goblins} camp')).toBe('a walled goblins camp');
  });
});

describe('Orte aus Büchern und Abenteuern (T-175)', () => {
  const { datei } = lauf(datenstand());
  const es = datei.entities;
  const finde = (typ: string, name: string) => es.find((e) => art(e) === typ && e.name === name);

  it('legt im Settingbuch Reich und Stadt an, in der Ebene des Buchs, mit Hierarchie und Abschnitt', () => {
    const reich = finde('Place', 'Kingdom of Velm')!;
    const stadt = finde('Place', 'Ravensgate')!;
    expect(reich.components['Place']).toEqual({ kind: 'Reich' });
    expect(stadt.components['Place']).toEqual({ kind: 'Stadt' });
    expect(kanten(stadt, 'partOf')).toEqual([reich.id]);
    expect(kanten(reich, 'partOf')).toEqual([]);
    expect(kanten(stadt, 'inLayer')).toEqual([buchEbeneId('TGZ')]);
    const ueberschrift = finde('Heading', 'Ravensgate')!;
    expect(kanten(stadt, 'describedIn')).toEqual([ueberschrift.id]);
    /* Tiefer als Stufe 3 gibt es keine Überschrift: der Ort zeigt auf den Absatz mit seinem Namen. */
    const markt = finde('Place', 'Saltmarket')!;
    expect(markt.components['Place']).toEqual({ kind: 'Distrikt' });
    expect(kanten(markt, 'partOf')).toEqual([stadt.id]);
    const absatz = es.find((e) => e.id === kanten(markt, 'describedIn')[0])!;
    expect(art(absatz)).toBe('Paragraph');
    expect(stadt.components['Source']).toMatchObject({ publication: 'TGZ', page: '7' });
  });

  it('legt nicht an, was kein Ort ist', () => {
    expect(finde('Place', 'Old Quarrel')).toBeUndefined();
    expect(finde('Place', 'Mother Ash')).toBeUndefined();
    expect(finde('Place', 'Reedfolk')).toBeUndefined();
    expect(finde('Place', 'Gazetteer')).toBeUndefined();
  });

  it('im Abenteuer: Burg mit Karte, Räume darin, Szene happensAt, Karte mapOf', () => {
    const burg = finde('Place', 'Castle Grimmore')!;
    const tor = finde('Place', 'G1. Gate')!;
    const szene = finde('Scene', 'Castle Grimmore')!;
    const torSzene = finde('Scene', 'G1. Gate')!;
    expect(burg.components['Place']).toBeUndefined();
    expect(tor.components['Place']).toEqual({ kind: 'Raum' });
    expect(kanten(tor, 'partOf')).toEqual([burg.id]);
    expect(kanten(burg, 'describedIn')).toEqual([szene.id]);
    expect(kanten(torSzene, 'happensAt')).toEqual([tor.id]);
    expect(kanten(szene, 'happensAt')).toEqual([burg.id]);
    const karte = finde('Map', 'Castle Grimmore')!;
    expect(kanten(karte, 'mapOf')).toEqual([szene.id, burg.id]);
    /* Leitungstext wie alles im Abenteuer; der Vorlesetext wird nicht kopiert. */
    expect(tor.components['Visibility']).toEqual({ audience: 'gm' });
    expect(tor.components['Place']).not.toHaveProperty('arrival');
    expect(finde('Place', 'Rumours')).toBeUndefined();
  });

  it('gibt bei zwei Läufen dieselben Orte', () => {
    const zweiter = lauf(datenstand()).datei.entities.filter((e) => art(e) === 'Place').map((e) => e.id);
    expect(zweiter).toEqual(es.filter((e) => art(e) === 'Place').map((e) => e.id));
  });
});

describe('nur bestimmte Arten ausgeben (T-175)', () => {
  it('behält die genannten Arten und die Ebenen', () => {
    const { datei } = lauf(datenstand());
    const nur = nurArten(datei, ['Place']);
    expect(new Set(nur.entities.map(art))).toEqual(new Set(['Place', 'Layer']));
    expect(nur.entities.filter((e) => art(e) === 'Place')).toHaveLength(datei.entities.filter((e) => art(e) === 'Place').length);
  });
});

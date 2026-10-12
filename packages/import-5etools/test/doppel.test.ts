import { describe, expect, it } from 'vitest';
import type { Entity } from '@nw/model';
import type { Knoten } from '../src/copy.js';
import type { Datenstand, Quelle } from '../src/lesen.js';
import { lauf } from '../src/lauf.js';
import { geltendeFassung } from '../src/doppel.js';

const buch = (id: string, published: string): [string, Quelle] => [id.toLowerCase(), { id, name: id, published, art: 'book' }];
const QUELLEN = new Map([
  buch('PHB', '2014-08-19'), buch('MM', '2014-09-30'), buch('DMG', '2014-12-09'), buch('VGM', '2016-11-15'),
  buch('MTF', '2018-05-29'), buch('ERLW', '2019-11-19'), buch('MPMM', '2022-01-18'),
]);

function datenstand(): Datenstand {
  const arten = new Map<string, Knoten[]>();
  const add = (art: string, ...e: Knoten[]) => arten.set(art, [...(arten.get(art) ?? []), ...e]);
  const asi = (klasse: string, level: number): Knoten => ({
    name: 'Ability Score Improvement', source: 'PHB', className: klasse, classSource: 'PHB', level,
    entries: [`When you reach ${level}th level, you can increase one ability score.`],
  });
  add('classFeature', asi('Fighter', 4), asi('Fighter', 6), asi('Wizard', 4), asi('Wizard', 8));
  const klasse = (name: string, stufen: number[]): Knoten => ({
    name, source: 'PHB', hd: { number: 1, faces: 8 },
    classFeatures: stufen.map((l) => `Ability Score Improvement|${name}||${l}`),
  });
  add('class', klasse('Fighter', [4, 6]), klasse('Wizard', [4, 8]));
  add('monster',
    { name: 'Wolf', source: 'MM', cr: '1/4', trait: [{ name: 'Pack Tactics', entries: ['The wolf has advantage if an ally of the wolf is near.'] }] },
    { name: 'Giant Rat', source: 'MM', cr: '1/8', trait: [{ name: 'Pack Tactics', entries: ['The rat has advantage if an ally of the rat is near.'] }] },
    { name: 'Kobold Inventor', source: 'VGM', cr: '1/4', reprintedAs: ['Kobold Inventor|MPMM'], trait: [{ name: 'Sunlight Sensitivity', entries: ['Old text.'] }] },
    { name: 'Kobold Inventor', source: 'MPMM', cr: '1/4', trait: [{ name: 'Sunlight Sensitivity', entries: ['New text.'] }] },
    { name: 'Goblin Boss', source: 'MM', cr: '1', trait: [{ name: 'Redirect', entries: ['The goblin swaps places; the boss stays.'] }] },
  );
  add('language',
    { name: 'Common', source: 'ERLW', type: 'standard', entries: ['Eberron.'] },
    { name: 'Common', source: 'PHB', type: 'standard', entries: ['Everyone.'] },
  );
  return { arten, quellen: QUELLEN };
}

const alle = (es: Entity[], name: string) => es.filter((e) => e.name === name);
const quelle = (e: Entity) => (e.components['Source'] as { publication?: string }).publication;

describe('Doppel nach dem Füllen (Entscheidung 12.10.2026)', () => {
  const { datei, bericht } = lauf(datenstand());
  const es = datei.entities;

  it('vereint ein Klassenmerkmal mit gleichem Text über Klassen, die Stufen bleiben an den Kanten', () => {
    const asi = alle(es, 'Ability Score Improvement');
    expect(asi).toHaveLength(1);
    const stufen = es
      .filter((e) => e.interfaces[0] === 'Class')
      .map((k) => `${k.name} ${(k.relations ?? []).filter((r) => r.to === asi[0]!.id).map((r) => r.props?.['level']).join(',')}`);
    expect(stufen.sort()).toEqual(['Fighter 4,6', 'Wizard 4,8']);
    expect(bericht.vereint.get('Feature')).toBe(1);
    expect(bericht.typen.get('Feature')).toBe(es.filter((e) => e.interfaces[0] === 'Feature').length);
  });

  it('erkennt die Kreatur am kurzen Namen und teilt das Merkmal; gelesen wird jeder Text wie im Buch', () => {
    const pack = alle(es, 'Pack Tactics');
    expect(pack).toHaveLength(1);
    const namen = es.flatMap((e) => (e.relations ?? []).filter((r) => r.to === pack[0]!.id).map((r) => r.props?.vars?.['CREATURE']));
    expect(namen.sort()).toEqual(['rat', 'wolf']);
  });

  it('setzt je Text nur einen Namen ein — zwei verschiedene unter einem Platzhalter läsen falsch', () => {
    const redirect = alle(es, 'Redirect')[0]!;
    const text = ((redirect.components['Prose']?.['paragraph'] as { value: string }[])[0])!.value;
    expect(text).toBe('The {CREATURE} swaps places; the boss stays.');
    const kante = es.flatMap((e) => e.relations ?? []).find((r) => r.to === redirect.id)!;
    expect(kante.props?.vars).toEqual({ CREATURE: 'goblin' });
  });

  it('macht ältere Fassungen zu Varianten mit dem Buch im Namen', () => {
    const neu = es.find((e) => e.name === 'Kobold Inventor')!;
    const alt = es.find((e) => e.name === 'Kobold Inventor (VGM)')!;
    expect(quelle(neu)).toBe('MPMM');
    expect(alt.relations?.find((r) => r.type === 'variantOf')?.to).toBe(neu.id);
    expect((alt.components['Identity'] as { name: string }).name).toBe('Kobold Inventor (VGM)');
    expect(quelle(es.find((e) => e.name === 'Common')!)).toBe('PHB');
    expect(es.some((e) => e.name === 'Common (ERLW)')).toBe(true);
    expect(bericht.fassungen.get('Statblock')).toBe(1);
    expect(bericht.fassungen.get('Language')).toBe(1);
  });
});

describe('Welche Fassung gilt', () => {
  const fassung = (q: string): Entity => ({ id: q, interfaces: ['Statblock'], name: 'X', components: { Source: { publication: q } } });
  /* Was 5e.tools als Nachdruck führt: Volo und Mordenkainen nach MPMM,
     Mordenkainen hat einmal aus OotA nachgedruckt. */
  const NACH: Record<string, string[]> = { VGM: ['MPMM'], MTF: ['MPMM'], OotA: ['MTF'] };
  const gilt = (...qs: string[]) => quelle(geltendeFassung(qs.map(fassung), { quellen: QUELLEN }, (e) => NACH[quelle(e)!] ?? []));

  it('ein Nachdruck vor dem, was er nachdruckt', () => expect(gilt('VGM', 'MPMM')).toBe('MPMM'));
  it('sonst ein Kernbuch vor dem Setting', () => expect(gilt('ERLW', 'PHB', 'MTF')).toBe('PHB'));
  it('sonst die neuste', () => expect(gilt('VGM', 'ERLW')).toBe('ERLW'));
  it('der Nachdruck auch dann, wenn ein Kernbuch dabei ist', () => expect(gilt('DMG', 'VGM', 'MPMM')).toBe('MPMM'));
  it('über eine Kette das Ende', () => expect(gilt('OotA', 'MTF', 'MPMM')).toBe('MPMM'));
  it('ohne Angabe kein Nachdruck — MPMM ist dann nur das neuste Buch', () => {
    expect(quelle(geltendeFassung(['MM', 'MPMM'].map(fassung), { quellen: QUELLEN }))).toBe('MM');
  });
});

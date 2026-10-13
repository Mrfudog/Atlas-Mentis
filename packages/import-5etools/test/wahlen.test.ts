import { describe, expect, it } from 'vitest';
import type { Choice, Entity } from '@nw/model';
import { validateEntity } from '@nw/model';
import { seedRegistry } from '@nw/registry';
import type { Knoten } from '../src/copy.js';
import type { Datenstand } from '../src/lesen.js';
import { lauf } from '../src/lauf.js';

/* Ein erfundener Datenstand in der Form von 5e.tools: je eine Klasse,
   Abstammung, ein Hintergrund und ein Talent, mit jeder Art Wahl, die der
   Importer kennt (REQ-238). Keine Texte aus den Büchern. */
function datenstand(): Datenstand {
  const arten = new Map<string, Knoten[]>();
  const add = (art: string, ...e: Knoten[]) => arten.set(art, [...(arten.get(art) ?? []), ...e]);
  add('skill', { name: 'Athletics', source: 'PHB', ability: 'str', entries: ['Climb.'] }, { name: 'Perception', source: 'PHB', ability: 'wis', entries: ['Look.'] });
  add('language', { name: 'Common', source: 'PHB', type: 'standard', entries: [] });
  add('item', { name: 'Rope Kit', source: 'PHB', type: 'G', entries: [] });
  add('feat', { name: 'Steady', source: 'PHB', category: 'O', ability: [{ con: 1 }], entries: ['Stand firm.'] });
  add('feat', { name: 'Keen', source: 'PHB', ability: [{ choose: { from: ['int', 'wis'], amount: 1 } }], skillProficiencies: [{ choose: { from: ['perception', 'athletics'] } }], entries: ['Notice.'] });
  add('optionalfeature', { name: 'Trick Step', source: 'PHB', featureType: ['MV:B'], entries: ['Step.'] });
  add('classFeature', { name: 'Path Choice', source: 'PHB', className: 'Ranger', classSource: 'PHB', level: 3, entries: ['Choose a path.'] });
  add('class', {
    name: 'Ranger', source: 'PHB', hd: { number: 1, faces: 10 }, proficiency: ['str', 'dex'],
    startingProficiencies: { skills: [{ choose: { from: ['athletics', 'perception', 'swimming'], count: 2 } }] },
    multiclassing: { proficienciesGained: { skills: [{ choose: { from: ['athletics', 'perception'], count: 1 } }] } },
    startingEquipment: { default: ['(a) rope or (b) a kit'], defaultData: [{ a: ['rope kit|phb'], b: [{ special: 'a kit' }] }] },
    classFeatures: [{ classFeature: 'Path Choice|Ranger||3', gainSubclassFeature: true }],
    subclassTitle: 'Ranger Path',
    featProgression: [{ name: 'Fighting Style', category: ['FS'], progression: { 2: 1 } }],
    optionalfeatureProgression: [{ name: 'Tricks', featureType: ['MV:B'], progression: [0, 0, 2, 2, 2, 2, 3] }],
  });
  add('race', {
    name: 'Fen Folk', source: 'PHB', size: ['M'], speed: 30,
    ability: [{ dex: 2, choose: { from: ['int', 'wis'], count: 1 } }],
    languageProficiencies: [{ common: true, anyStandard: 1 }],
    feats: [{ any: 1 }],
    entries: [],
  });
  add('background', {
    name: 'Wanderer', source: 'PHB',
    skillProficiencies: [{ athletics: true }],
    ability: [{ choose: { weighted: { from: ['str', 'dex', 'con'], weights: [2, 1] } } }, { choose: { weighted: { from: ['str', 'dex', 'con'], weights: [1, 1, 1] } } }],
    feats: [{ 'steady|phb': true }],
    startingEquipment: [{ _: ['rope kit|phb'] }, { a: ['rope kit|phb'], b: [{ value: 1500 }] }],
    entries: [],
  });
  return { arten, quellen: new Map([['phb', { id: 'PHB', name: "Player's Handbook", published: '2014-08-19', art: 'book' }]]) };
}

describe('Wahlen beim Einlesen (REQ-238, E-015 a)', () => {
  const { datei, bericht } = lauf(datenstand());
  const es = datei.entities;
  const finde = (typ: string, name: string) => es.find((e) => e.interfaces[0] === typ && e.name === name)!;
  const wahlen = (e: Entity) => (e.components['Choices']?.['choices'] as Choice[] | undefined) ?? [];
  const arten = new Map(es.map((e) => [e.id, e.interfaces[0]!] as const));

  it('besteht die Prüfung', () => {
    for (const typ of ['Class', 'Ancestry', 'Background', 'Feat']) {
      for (const e of es.filter((x) => x.interfaces[0] === typ)) expect(validateEntity(seedRegistry, e, { knownTypes: arten })).toEqual([]);
    }
  });

  it('eine Klasse: Fertigkeiten, Mehrklassen-Einstieg, Ausrüstung, Unterklasse, Fortschritte', () => {
    const ranger = finde('Class', 'Ranger');
    expect(wahlen(ranger)).toEqual([
      { id: 'skills', kind: 'proficiency', when: 'start', count: 2, from: { values: ['Athletics', 'Perception', 'Swimming'] } },
      { id: 'equipment', kind: 'equipment', when: 'start', from: { options: [{ key: 'a', label: expect.stringMatching(/^\[\[item-\d+\|rope kit\]\]$/) }, { key: 'b', label: 'a kit' }] } },
      { id: 'multiclass-skills', kind: 'proficiency', when: 'multiclass', count: 1, from: { values: ['Athletics', 'Perception'] } },
      { id: 'ranger-path', kind: 'subclass', level: 3, from: { interfaces: ['Subclass'], edge: { type: 'subclassOf', to: ranger.id } } },
      { id: 'fighting-style-2', kind: 'feat', level: 2, count: 1, from: { interfaces: ['Feat'], tags: ['fighting style'] }, note: 'Fighting Style' },
      { id: 'tricks-3', kind: 'feature', level: 3, count: 2, from: { interfaces: ['Feature'], where: { component: 'Feature', property: 'featureType', value: 'Maneuver, Battle Master' } }, note: 'Tricks' },
      { id: 'tricks-7', kind: 'feature', level: 7, count: 1, from: { interfaces: ['Feature'], where: { component: 'Feature', property: 'featureType', value: 'Maneuver, Battle Master' } }, note: 'Tricks' },
    ]);
  });

  it('eine Abstammung: fester Bonus bleibt Feld, die Wahl wird eine', () => {
    const fen = finde('Ancestry', 'Fen Folk');
    expect(fen.components['Ancestry']).toMatchObject({ abilityBonus: { dex: 2 } });
    expect(fen.components['Ancestry']?.['abilityNote']).toBeUndefined();
    expect(wahlen(fen)).toEqual([
      { id: 'ability-scores', kind: 'ability', count: 1, bonus: [1], from: { values: ['int', 'wis'] } },
      { id: 'languages', kind: 'proficiency', count: 1, from: { enumRef: ['Language'] }, note: '1 any standard language of your choice' },
      { id: 'feat', kind: 'feat', count: 1, from: { interfaces: ['Feat'] } },
    ]);
  });

  it('ein Hintergrund: gewichtete Wahl mit Alternative, festes Talent als Kante, Ausrüstung a/b', () => {
    const w = finde('Background', 'Wanderer');
    expect(wahlen(w)).toEqual([
      { id: 'equipment', kind: 'equipment', from: { options: [{ key: 'a', label: expect.stringContaining('rope kit') }, { key: 'b', label: '15 gp' }] } },
      { id: 'ability-scores', kind: 'ability', count: 2, bonus: [2, 1], from: { values: ['str', 'dex', 'con'] }, note: 'or instead: +1/+1/+1 from str, dex, con' },
    ]);
    expect(w.relations?.some((r) => r.type === 'grants' && r.to === finde('Feat', 'Steady').id)).toBe(true);
    expect(bericht.arten.get('background')?.notizen.get('Attributswahl mit Alternativen (erste als Wahl, Rest als Notiz)')).toBe(1);
  });

  it('ein Talent: fester Bonus beantwortet sich selbst, Kategorie wird Marke', () => {
    const steady = finde('Feat', 'Steady');
    expect(wahlen(steady)).toEqual([{ id: 'con-increase', kind: 'ability', count: 1, bonus: [1], from: { values: ['con'] } }]);
    expect(steady.components['Tags']?.['tags']).toContain('origin');
    expect(wahlen(finde('Feat', 'Keen'))).toEqual([
      { id: 'ability-scores', kind: 'ability', count: 1, bonus: [1], from: { values: ['int', 'wis'] } },
      { id: 'skills', kind: 'proficiency', count: 1, from: { values: ['Perception', 'Athletics'] } },
    ]);
  });
});

import { describe, expect, it } from 'vitest';
import type { Choice } from '@nw/model';
import { validateEntity } from '@nw/model';
import { seedRegistry } from '@nw/registry';
import type { Knoten } from '../src/copy.js';
import type { Datenstand } from '../src/lesen.js';
import { lauf } from '../src/lauf.js';
import { ASI_WAHLEN } from '../src/arten/charakterbau.js';

/* T-107, E-027: die Attributssteigerung trägt ihre Wahl am Merkmal. Ein
   erfundener Datenstand in der Form von 5e.tools; die Sätze sind eigene. */
function datenstand(): Datenstand {
  const arten = new Map<string, Knoten[]>();
  const add = (art: string, ...e: Knoten[]) => arten.set(art, [...(arten.get(art) ?? []), ...e]);
  for (const level of [4, 8]) {
    add('classFeature', {
      name: 'Ability Score Improvement', source: 'PHB', className: 'Warden', classSource: 'PHB', level,
      entries: [`At ${level}th level you can increase one ability score of your choice by 2, or two by 1.`],
    });
  }
  /* Ein Gefolgsmann sagt es in der dritten Person (T-095). */
  add('classFeature', {
    name: 'Ability Score Improvement', source: 'TCE', className: 'Squire', classSource: 'TCE', level: 4,
    entries: ['At this level the squire increases one ability score of your choice by 2, or two by 1.'],
  });
  /* Ein Merkmal ohne „by 2" (wie die Fassung 2024) fragt nicht. */
  add('classFeature', { name: 'Steady Watch', source: 'PHB', className: 'Warden', classSource: 'PHB', level: 2, entries: ['You gain a feat of your choice.'] });
  add('class', {
    name: 'Warden', source: 'PHB', hd: { number: 1, faces: 8 }, proficiency: ['con'],
    classFeatures: ['Steady Watch|Warden||2', 'Ability Score Improvement|Warden||4', 'Ability Score Improvement|Warden||8'],
  });
  add('class', { name: 'Squire', source: 'TCE', hd: { number: 1, faces: 8 }, proficiency: ['con'], classFeatures: ['Ability Score Improvement|Squire|TCE|4'] });
  return {
    arten,
    quellen: new Map([
      ['phb', { id: 'PHB', name: "Player's Handbook", published: '2014-08-19', art: 'book' }],
      ['tce', { id: 'TCE', name: "Tasha's Cauldron", published: '2020-11-17', art: 'book' }],
    ]),
  };
}

describe('Die Attributssteigerung als Merkmal (T-107)', () => {
  const { datei } = lauf(datenstand());
  const es = datei.entities;
  const arten = new Map(es.map((e) => [e.id, e.interfaces[0]!] as const));
  const merkmale = es.filter((e) => e.interfaces[0] === 'Feature' && e.name === 'Ability Score Improvement');

  it('ein Merkmal je Klasse, zwei Kanten mit Stufe', () => {
    const warden = es.find((e) => e.interfaces[0] === 'Class' && e.name === 'Warden')!;
    const nach2014 = merkmale.find((e) => (e.components['Choices']?.['choices'] as Choice[] | undefined)?.length)!;
    expect(warden.relations?.filter((r) => r.type === 'grants' && r.to === nach2014.id).map((r) => r.props?.['level'])).toEqual([4, 8]);
  });

  it('die Fassung nach 2014 fragt: Steigerung oder Talent, dasselbe Attribut zweimal erlaubt', () => {
    const mitWahl = merkmale.filter((e) => e.components['Choices'] && e.relations?.some((r) => r.type === 'inLayer' && /phb/i.test(r.to)));
    expect(mitWahl).toHaveLength(1);
    expect(mitWahl[0]!.components['Choices']?.['choices']).toEqual(ASI_WAHLEN);
    expect(validateEntity(seedRegistry, mitWahl[0]!, { knownTypes: arten })).toEqual([]);
  });

  it('auch der Gefolgsmann fragt, obwohl er „increases" sagt (T-095)', () => {
    const squire = es.find((e) => e.interfaces[0] === 'Class' && e.name === 'Squire')!;
    const ziel = squire.relations?.find((r) => r.type === 'grants')?.to;
    const m = es.find((e) => e.id === ziel)!;
    expect(m.components['Choices']?.['choices']).toEqual(ASI_WAHLEN);
  });

  it('ein anderes Merkmal nicht', () => {
    const steady = es.find((e) => e.interfaces[0] === 'Feature' && e.name === 'Steady Watch')!;
    expect(steady.components['Choices']).toBeUndefined();
  });
});

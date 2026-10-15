import { describe, expect, it } from 'vitest';
import type { Knoten } from '../src/copy.js';
import type { Datenstand } from '../src/lesen.js';
import { lauf } from '../src/lauf.js';

/* Die Zauberlisten (T-212): ein erfundener Datenstand in der Form von
   5e.tools — zwei Klassen, eine Unterklasse, drei Zauber und die
   Nachschlagedatei dazu. Keine Texte aus den Büchern. */
function datenstand(): Datenstand {
  const arten = new Map<string, Knoten[]>();
  const add = (art: string, ...e: Knoten[]) => arten.set(art, [...(arten.get(art) ?? []), ...e]);
  const zauber = (name: string, level: number) => ({ name, source: 'PHB', level, school: 'V', entries: ['Zap.'] });
  add('spell', zauber('Spark', 0), zauber('Glow', 1), zauber('Blast', 3));
  add('class', { name: 'Mage', source: 'PHB', hd: { number: 1, faces: 6 }, casterProgression: 'full', classFeatures: [] });
  add('class', { name: 'Knight', source: 'PHB', hd: { number: 1, faces: 10 }, classFeatures: [] });
  add('subclass', { name: 'Spell Knight', shortName: 'Spell', className: 'Knight', classSource: 'PHB', source: 'PHB', casterProgression: '1/3', subclassFeatures: [] });
  const zauberlisten: Knoten = {
    phb: {
      spark: { class: { PHB: { Mage: true } }, subclass: { PHB: { Knight: { PHB: { Spell: { name: 'Spell Knight' } } } } } },
      glow: { class: { PHB: { Mage: true, Bard: true } }, classVariant: { PHB: { Knight: { definedInSources: ['TCE'] } } } },
      blast: { class: { PHB: { Mage: true } }, classVariant: { PHB: { Mage: { definedInSources: ['TCE'] } } } },
      nothing: { class: { PHB: { Mage: true } } },
    },
  };
  return { arten, quellen: new Map([['phb', { id: 'PHB', name: "Player's Handbook", published: '2014-08-19', art: 'book' }]]), zauberlisten };
}

describe('Zauberlisten beim Einlesen (T-212)', () => {
  const { datei, bericht, zauberlisten } = lauf(datenstand());
  const es = datei.entities;
  const finde = (typ: string, name: string) => es.find((e) => e.interfaces[0] === typ && e.name === name)!;
  const liste = (typ: string, name: string) =>
    (finde(typ, name).relations ?? []).filter((r) => r.type === 'spellList').map((r) => [es.find((x) => x.id === r.to)?.name, r.props?.['optional'] ?? false]);

  it('hängt die Zauber als spellList an Klasse und Unterklasse — optional, was nur eine Ergänzung ist', () => {
    /* Pflicht schlägt optional: Blast steht fest auf der Liste des Magiers. */
    expect(liste('Class', 'Mage')).toEqual([['Spark', false], ['Glow', false], ['Blast', false]]);
    expect(liste('Class', 'Knight')).toEqual([['Glow', true]]);
    expect(liste('Subclass', 'Spell Knight')).toEqual([['Spark', false]]);
  });

  it('zählt, was nicht hereinkam, und schreibt den Plan mit den Peg-Ids des Laufs', () => {
    const b = bericht.arten.get('spellSourceLookup')!;
    expect(b.notizen.get('Zauber nicht hereingekommen')).toBe(1);
    expect(b.notizen.get('Klasse nicht hereingekommen')).toBe(1);
    expect(zauberlisten?.format).toBe('atlas-zauberlisten/1');
    const knight = zauberlisten!.listen.find((l) => l.name === 'Knight')!;
    expect(knight).toMatchObject({ von: finde('Class', 'Knight').id, art: 'Class', quelle: 'PHB', zauber: [{ to: finde('Spell', 'Glow').id, optional: true }] });
    expect(zauberlisten!.listen.map((l) => l.name).sort()).toEqual(['Knight', 'Mage', 'Spell Knight']);
  });
});

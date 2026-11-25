import { describe, expect, it } from 'vitest';
import { glossaryEntryNamed, glossaryEntryOf, glossaryFieldRefs, mentionsTerm, runChecks, spotTerms, termIndex, type Entity, type GlossaryEntry, type Registry } from '../src/index';

/* T-242: Begriffe im Text erkennen und Nennungen zählen. Erfundene Wörter. */
const e = (id: string, term: string, aliases: string[] = [], mehr: Partial<GlossaryEntry> = {}): GlossaryEntry => ({
  id, term, aliases, sort: 'rule', definition: '', examples: [], translations: [], explains: [], autolink: true, article: true, ...mehr,
});

describe('spotTerms (T-242)', () => {
  it('erkennt ganze Wörter, die längste Fassung zuerst, ohne Gross und Klein', () => {
    const idx = termIndex([e('a', 'Glum'), e('b', 'Glum Fog', ['mist'])]);
    expect(spotTerms('A glum fog and mist, glummer and Glum.', idx)).toEqual([
      { kind: 'text', text: 'A ' },
      { kind: 'term', text: 'glum fog', id: 'b' },
      { kind: 'text', text: ' and ' },
      { kind: 'term', text: 'mist', id: 'b' },
      { kind: 'text', text: ', glummer and ' },
      { kind: 'term', text: 'Glum', id: 'a' },
      { kind: 'text', text: '.' },
    ]);
  });

  it('lässt mehrdeutige Namen, Wörter der App und abgeschaltete stehen', () => {
    const idx = termIndex([e('a', 'Hush'), e('b', 'Hush'), e('c', 'Layer', [], { article: false }), e('d', 'Calm', [], { autolink: false })]);
    expect(spotTerms('Hush, layer, calm.', idx)).toEqual([{ kind: 'text', text: 'Hush, layer, calm.' }]);
  });
});

describe('glossaryEntryOf und mentionsTerm (T-242)', () => {
  const artikel = {
    id: 'g1',
    interfaces: ['GlossaryTerm'],
    components: {
      Identity: { name: 'Glum', id: 'glossaryterm-0001', aliases: ['Gloomy'] },
      Description: { description: 'Feeling low.' },
      GlossaryTerm: { sort: 'condition', effect: 'Sighs.', example: [{ id: 'x', value: 'The bard is glum.' }], translations: [{ id: 'de', lang: 'de', term: 'Trübsinnig' }] },
      Rule: { autolink: false },
    },
    relations: [{ id: 'r', type: 'explains', to: 'c1', props: {} }, { id: 's', type: 'explains', to: 'c2', props: {} }],
  };

  it('liest den Artikel als Eintrag; ein unsichtbares Ziel fällt weg', () => {
    expect(glossaryEntryOf(artikel, (id) => (id === 'c1' ? 'Glum' : undefined))).toEqual({
      id: 'g1', number: 'glossaryterm-0001', term: 'Glum', aliases: ['Gloomy'], sort: 'condition', definition: 'Feeling low.', effect: 'Sighs.',
      examples: ['The bard is glum.'], translations: [{ lang: 'de', term: 'Trübsinnig' }], explains: [{ id: 'c1', name: 'Glum' }], autolink: false, article: true,
    });
  });

  it('zählt Wort, Alias und Verweis auf die Nummer, nicht den Namen allein', () => {
    const eintrag = glossaryEntryOf(artikel, () => undefined);
    const mit = (text: string, name = 'X') => ({ id: 'n', components: { Identity: { name }, Description: { description: text } } });
    expect(mentionsTerm(mit('So gloomy.'), eintrag)).toBe(true);
    expect(mentionsTerm(mit('See [[glossaryterm-0001|it]].'), eintrag)).toBe(true);
    expect(mentionsTerm(mit('Glummer.'), eintrag)).toBe(false);
    expect(mentionsTerm(mit('Nothing.', 'Glum'), eintrag)).toBe(false);
    expect(mentionsTerm({ ...artikel }, eintrag)).toBe(false);
  });
});

describe('Felder nennen ihren Begriff (T-347)', () => {
  it('findet den Glossarartikel vor dem Wort der App, dann einen Alias — nur eindeutig', () => {
    const eintraege = [
      e('app:zorp', 'Zorp', [], { article: false, sort: 'type' }),
      e('g1', 'Zorp'),
      e('g2', 'Flarn', ['Flarning']),
      e('g3', 'Quib', ['Mox']),
      e('g4', 'Wopp', ['Mox']),
    ];
    expect(glossaryEntryNamed(eintraege, 'zorp')?.id).toBe('g1');
    expect(glossaryEntryNamed(eintraege, 'Flarning')?.id).toBe('g2');
    expect(glossaryEntryNamed(eintraege, 'Mox')).toBeNull();
    expect(glossaryEntryNamed(eintraege, '')).toBeNull();
    expect(glossaryEntryNamed(eintraege, 'Nichts')).toBeNull();
  });

  it('die Werkbank nennt Felder, deren Begriff die Installation nicht hat', () => {
    const registry = {
      interfaces: {
        Probe: { name: 'Probe', schema: { type: 'object', properties: { a: { type: 'number', glossary: 'Flarn' }, b: { type: 'number', glossary: 'Zorp' } } } },
        GlossaryTerm: { name: 'GlossaryTerm', schema: { type: 'object', properties: {} } },
      },
      relations: {}, views: {}, units: {}, vars: {},
    } as unknown as Registry;
    expect(glossaryFieldRefs(registry)).toEqual([
      { ref: 'Probe.a', name: 'Flarn' },
      { ref: 'Probe.b', name: 'Zorp' },
    ]);
    const begriff = { id: 'g1', interfaces: ['GlossaryTerm'], components: { Identity: { name: 'Glorb', aliases: ['flarn'] } } } as unknown as Entity;
    const [r] = runChecks({ registry, entities: [begriff], exists: new Map() }, { only: ['missingGlossaryTerms'] });
    expect(r!.hits.filter((h) => h.type === 'field').map((h) => h.name)).toEqual(['Probe.b']);
  });
});

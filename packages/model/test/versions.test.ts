/**
 * Fassungen derselben Sache und Vergleichsebenen (T-092, E-021 d).
 */

import { describe, expect, it } from 'vitest';
import type { Entity, Registry } from '../src/types.js';
import {
  activeStack,
  campaignsActivating,
  compareLayers,
  inPlay,
  playStack,
  withCompare,
  withStack,
} from '../src/stack.js';
import {
  compareRows,
  layerShort,
  lineDiff,
  linesDiff,
  sameThing,
  sectionDiff,
  textSections,
  versionDiff,
  versionInPlay,
  versionGroups,
  versionName,
  versionsOf,
  versionSummary,
} from '../src/versions.js';
import { campaignsOf } from '../src/visibility.js';

const ebene = (id: string, name: string): Entity => ({
  id,
  name,
  interfaces: ['Layer'],
  components: { Identity: { name, id: `layer-${id}`, aliases: [] }, Layer: { kind: 'book', order: 0 } },
  relations: [],
});
const zauber = (id: string, name: string, buch: string, ly: string, felder: Record<string, unknown> = {}, rel: Entity['relations'] = []): Entity => ({
  id,
  name,
  interfaces: ['Spell'],
  components: {
    Identity: { name, id: `spell-${id}`, aliases: [] },
    Source: { publication: buch },
    Spell: { level: 3, ...felder },
  },
  relations: [{ id: `${id}_in`, type: 'inLayer', to: ly, props: {} }, ...(rel ?? [])],
});

const PHB = ebene('e5_book_phb', "Player's Handbook");
const XPHB = ebene('e5_book_xphb', "Player's Handbook (2024)");
const XGE = ebene('e5_book_xge', "Xanathar's Guide");
const kampagne: Entity = {
  id: 'camp',
  name: 'Aus Nebel wacht',
  interfaces: ['Campaign'],
  components: { Identity: { name: 'Aus Nebel wacht', id: 'campaign-0001', aliases: [] } },
  relations: [
    { id: 'a1', type: 'activates', to: PHB.id, props: { order: 10 } },
    { id: 'a2', type: 'activates', to: XGE.id, props: { order: 20 } },
    { id: 'c1', type: 'activates', to: XPHB.id, props: { mode: 'compare', order: 10 } },
  ],
};
const f14 = zauber('f14', 'Fireball', 'PHB', PHB.id, { range: 150 });
const f24 = zauber('f24', 'Fireball', 'XPHB', XPHB.id, { range: 150, higherLevels: 'Each slot above 3 adds 1d6.' }, [
  { id: 'v1', type: 'variantOf', to: 'f14', props: {} },
]);
const fXge = zauber('fx', 'Fireball (XGE)', 'XGE', XGE.id, { range: 120 }, [{ id: 'v2', type: 'variantOf', to: 'f14', props: {} }]);
/* Kein Fassung: ein anderer Name über `variantOf` (Grundgegenstand, Kopie). */
const anders = zauber('fb', 'Delayed Blast Fireball', 'PHB', PHB.id, {}, [{ id: 'v3', type: 'variantOf', to: 'f14', props: {} }]);

const alle = new Map([PHB, XPHB, XGE, kampagne, f14, f24, fXge, anders].map((e) => [e.id, e]));

describe('compare layers (T-092)', () => {
  it('are not in play; inPlay stays as it was', () => {
    expect(activeStack(alle, kampagne).map((x) => x.layer.id)).toEqual([PHB.id, XGE.id]);
    expect(compareLayers(alle, kampagne).map((x) => x.id)).toEqual([XPHB.id]);
    const s = playStack(alle, kampagne);
    expect(s.inPlay(f24)).toBe(false);
    expect(inPlay(alle, f24, kampagne)).toBe(false);
    expect(s.inCompare(f24)).toBe(true);
    expect(s.inCompare(f14)).toBe(false);
    expect(s.inPlay(f14)).toBe(true);
    expect(s.rank(fXge)).toBe(2);
    expect(s.rank(f24)).toBe(0);
  });

  it('do not make a layer shared or owned', () => {
    expect(campaignsActivating(alle, XPHB.id)).toEqual([]);
    expect(campaignsOf(alle, f24)?.size).toBe(0);
  });

  it('survive writing the stack, and drop out when the layer comes into play', () => {
    const neu = withStack(kampagne, [PHB.id]);
    expect(compareLayers(alle, neu).map((x) => x.id)).toEqual([XPHB.id]);
    const imSpiel = withStack(kampagne, [PHB.id, XPHB.id]);
    expect(compareLayers(alle, imSpiel)).toEqual([]);
    expect((imSpiel.relations ?? []).filter((r) => r.to === XPHB.id)).toHaveLength(1);
  });

  it('are written apart from the stack', () => {
    const neu = withCompare(kampagne, [XGE.id, XPHB.id]);
    /* XGE ist im Spiel und wird nicht noch einmal Vergleich. */
    expect(compareLayers(alle, neu).map((x) => x.id)).toEqual([XPHB.id]);
    expect(activeStack(alle, neu).map((x) => x.layer.id)).toEqual([PHB.id, XGE.id]);
    expect(compareLayers(alle, withCompare(kampagne, []))).toEqual([]);
  });
});

describe('versions of one thing (T-092)', () => {
  it('are the same type and name, with the own book cut off', () => {
    expect(versionName(fXge)).toBe('fireball');
    expect(sameThing(f14, fXge)).toBe(true);
    expect(sameThing(f14, anders)).toBe(false);
  });

  it('group over variantOf in both directions, without the base item kind', () => {
    expect(versionsOf(alle, 'f14').map((e) => e.id).sort()).toEqual(['f24', 'fx']);
    expect(versionsOf(alle, 'f24').map((e) => e.id).sort()).toEqual(['f14', 'fx']);
    expect(versionsOf(alle, 'fb')).toEqual([]);
    const g = versionGroups(alle.values());
    expect(g.get('f14')).toBe(g.get('f24'));
    expect(g.get('fx')).toBe(g.get('f14'));
    expect(g.has('fb')).toBe(false);
  });

  it('count an override as a version', () => {
    const kopie: Entity = { ...f24, id: 'k', name: 'Fireball', relations: [{ id: 'o', type: 'overrides', to: 'f14', props: {} }] };
    expect(versionsOf(new Map([...alle, ['k', kopie]]), 'k').map((e) => e.id).sort()).toEqual(['f14', 'f24', 'fx']);
  });

  it('say what differs, field by field, and nothing that is the same', () => {
    const reg = { interfaces: { Spell: { name: 'Spell', schema: { type: 'object', properties: { higherLevels: { type: 'string', format: 'long' } } } } } } as unknown as Registry;
    const d = versionDiff(reg, f14, f24);
    expect(d.fields).toEqual([{ ref: 'Spell.higherLevels', type: 'Spell', key: 'higherLevels', value: 'Each slot above 3 adds 1d6.', long: true }]);
    expect(versionDiff(reg, f14, fXge).fields.map((f) => [f.ref, f.value])).toEqual([['Spell.range', 120]]);
    /* Ebenen- und Fassungskanten zählen nicht; andere schon. */
    const mit = { ...fXge, relations: [...(fXge.relations ?? []), { id: 'x', type: 'availableTo', to: 'wiz', props: {} }] };
    expect(versionDiff(reg, f14, mit).relations).toEqual([{ type: 'availableTo', only: ['wiz'], missing: [] }]);
  });

  it('abbreviate layers', () => {
    expect(layerShort(XPHB)).toBe('XPHB');
    expect(layerShort(ebene('ly', 'Homebrew Rules'))).toBe('HR');
    expect(layerShort(ebene('ly', 'Unearthed Arcana 2023'))).toBe('UA 23');
  });
});

/* T-103: die Leitung sah an Aasimar die abweichende Grösse unter
   „Languages" — der Text war als Ganzes verglichen, und die andere Fassung
   hing am Ende des letzten Abschnitts. */
describe('sections of a long text (T-103)', () => {
  const mpmm = '## Size\n\nYou are Medium or Small. You choose the size when you select this race.';
  const vgm =
    '## Age\n\nAasimar mature at the same rate as humans, but they can live up to 160 years.\n\n' +
    '## Size\n\nAasimar have the same range of height and weight as humans.\n\n' +
    '## Languages\n\nYou can speak, read, and write Common and Celestial.';

  it('splits at headings and keeps the text before the first one', () => {
    const s = textSections(`Intro line.\n\n${vgm}`);
    expect(s.map((x) => x.key)).toEqual(['', 'age', 'size', 'languages']);
    expect(s[2]!.text).toBe('## Size\n\nAasimar have the same range of height and weight as humans.');
    expect(s[2]!.body).toBe('Aasimar have the same range of height and weight as humans.');
    expect(textSections('')).toEqual([]);
  });

  it('counts a repeated heading, so the second one does not meet the first', () => {
    expect(textSections('## A\n\nx\n\n## A\n\ny').map((x) => x.key)).toEqual(['a', 'a#2']);
  });

  it('puts the other size under Size, not under the last heading', () => {
    const d = sectionDiff(mpmm, vgm);
    const size = d.find((x) => x.key === 'size');
    expect(size).toMatchObject({ heading: 'Size', onlyThere: false });
    expect(size!.value).toBe('Aasimar have the same range of height and weight as humans.');
    /* Was nur VGM hat, steht für sich, unter seiner eigenen Überschrift. */
    expect(d.filter((x) => x.onlyThere).map((x) => x.heading)).toEqual(['Age', 'Languages']);
    /* Andersherum: was VGM hat und MPMM nicht, heisst „dort fehlt er". */
    const zurueck = sectionDiff(vgm, mpmm);
    expect(zurueck.find((x) => x.key === 'languages')).toMatchObject({ value: undefined, onlyThere: false });
    expect(zurueck.find((x) => x.key === 'size')!.value).toContain('Medium or Small');
  });

  it('says nothing where both say the same, whitespace aside', () => {
    expect(sectionDiff(vgm, vgm.replace(/\n\n/g, '\n\n\n'))).toEqual([]);
  });

  it('compares book lines by their label', () => {
    const d = linesDiff(
      [
        { label: 'Armor Class', text: '15 (leather armor, shield)' },
        { label: 'Hit Points', text: '7 (2d6)' },
      ],
      [
        { label: 'Hit Points', text: '7 (2d6)' },
        { label: 'Armor Class', text: '15 (leather armor)' },
        { label: 'Senses', text: 'darkvision 60 ft.' },
      ],
    );
    expect(d).toEqual([
      { key: 'armor class', heading: 'Armor Class', value: '15 (leather armor)', onlyThere: false },
      { key: 'senses', heading: 'Senses', value: 'darkvision 60 ft.', onlyThere: true },
    ]);
  });
});

/* T-173: „Bei +1 Waffe sehe ich den Unterschied der Versionen nirgends."
   Der einzige Unterschied war ein Feld, das die andere Fassung nicht setzt. */
describe('versions side by side (T-173)', () => {
  const reg = {
    interfaces: {
      Item: { name: 'Item', schema: { type: 'object' as const, properties: { tier: { type: 'string' as const, title: 'Tier' }, text: { type: 'string' as const, format: 'long' } } } },
    },
    relations: { availableTo: { name: 'availableTo', label: 'available to', from: ['*'], to: ['*'], cardinality: 'many' } },
  } as unknown as Registry;
  const DMG = ebene('e5_book_dmg', "Dungeon Master's Guide");
  const XDMG = ebene('e5_book_xdmg', "Dungeon Master's Guide (2024)");
  const ding = (id: string, name: string, buch: string, seite: string, ly: string, felder: Record<string, unknown>, rel: Entity['relations'] = []): Entity => ({
    id,
    name,
    interfaces: ['Item'],
    components: { Identity: { name, id: `item-${id}`, aliases: [] }, Source: { publication: buch, page: seite }, Item: felder },
    relations: [{ id: `${id}_in`, type: 'inLayer', to: ly, props: {} }, ...rel],
  });
  const alt = ding('w14', '+1 Weapon', 'DMG', '213', DMG.id, { tier: 'major', text: 'You have a +1 bonus.' });
  const neu = ding('w24', '+1 Weapon (XDMG)', 'XDMG', '324', XDMG.id, { text: 'You have a +1 bonus.' }, [
    { id: 'v', type: 'variantOf', to: 'w14', props: {} },
  ]);

  it('names a field the other version leaves empty', () => {
    const s = versionSummary(reg, alt, neu);
    expect(s).toEqual({ same: false, fields: ['Tier'], relations: [], notThere: ['Tier'], source: 'XDMG p. 324' });
  });

  it('says when only the source differs', () => {
    const gleich = { ...neu, components: { ...neu.components, Item: { tier: 'major', text: 'You have a +1 bonus.' } } };
    expect(versionSummary(reg, alt, gleich)).toEqual({ same: true, fields: [], relations: [], notThere: [], source: 'XDMG p. 324' });
  });

  it('lists every field, same ones too', () => {
    const z = compareRows(reg, alt, neu);
    const nach = Object.fromEntries(z.fields.map((f) => [f.ref, [f.state, f.meta]]));
    expect(nach['Item.tier']).toEqual(['onlyLeft', false]);
    expect(nach['Item.text']).toEqual(['same', false]);
    expect(nach['Source.page']).toEqual(['changed', true]);
    expect(z.relations.find((r) => r.type === 'variantOf')).toMatchObject({ state: 'onlyRight', right: ['w14'] });
    expect(z.relations.find((r) => r.type === 'inLayer')?.state).toBe('changed');
  });

  it('picks the version from the topmost layer in play', () => {
    const ranks = new Map([
      [DMG.id, 1],
      [XDMG.id, 2],
    ]);
    expect(versionInPlay([alt, neu], ranks)?.entity.id).toBe('w24');
    expect(versionInPlay([alt, neu], new Map([[DMG.id, 1]]))?.entity.id).toBe('w14');
    expect(versionInPlay([alt, neu], new Map())).toBeNull();
  });

  it('diffs lines like git', () => {
    expect(lineDiff('a\nb\nc', 'a\nx\nc')).toEqual([
      { op: 'same', text: 'a' },
      { op: 'del', text: 'b' },
      { op: 'add', text: 'x' },
      { op: 'same', text: 'c' },
    ]);
    expect(lineDiff('a\nb', 'a\nb\nc').map((l) => l.op)).toEqual(['same', 'same', 'add']);
    expect(lineDiff('', 'x').map((l) => l.op)).toEqual(['del', 'add']);
    expect(lineDiff('same  ', 'same')).toEqual([{ op: 'same', text: 'same  ' }]);
  });
});

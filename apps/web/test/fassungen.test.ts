/**
 * Fassungen an jedem Feld, an der richtigen Stelle (T-103, E-021 d).
 *
 * Die Leitung sah an Aasimar (14.10.) die abweichende Grösse unter
 * „Languages": der Prosatext war als Ganzes verglichen, und die andere
 * Fassung stand am Ende seines letzten Abschnitts. Hier wird je Feld,
 * Abschnitt und Buchzeile geprüft, dass eine Abweichung genau dort steht,
 * wo sie hingehört.
 */

import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import type { Entity, Registry } from '@nw/model';
import {
  abweichungen,
  prosaVergleich,
  textVergleich,
  zeilenVergleich,
  type Vergleichsfassung,
} from '../src/app/artikel/fassungen';

const r = seedRegistry as unknown as Registry;

const aasimar = (
  id: string,
  name: string,
  buch: string,
  ancestry: Record<string, unknown>,
  text: string,
): Entity => ({
  id,
  name,
  interfaces: ['Ancestry'],
  components: {
    Identity: { id: `ancestry-${id}`, name },
    Source: { publication: buch },
    Ancestry: ancestry,
    Prose: { paragraph: [{ id: 'text', value: text }] },
  },
  relations: [],
});

const MPMM = aasimar(
  'mpmm',
  'Aasimar',
  'MPMM',
  { size: ['small', 'medium'], abilityNote: 'lineage: VRGR' },
  '## Size\n\nYou are Medium or Small. You choose the size when you select this race.',
);
const VGM = aasimar(
  'vgm',
  'Aasimar (VGM)',
  'VGM',
  { size: ['medium'], abilityBonus: { cha: 2 } },
  '## Age\n\nAasimar mature at the same rate as humans, but they can live up to 160 years.\n\n' +
    '## Size\n\nAasimar have the same range of height and weight as humans.\n\n' +
    '## Languages\n\nYou can speak, read, and write Common and Celestial.',
);
const fassung = (e: Entity, kuerzel: string): Vergleichsfassung => ({
  id: e.id,
  kuerzel,
  titel: kuerzel,
  compare: false,
  entity: e,
});

describe('a version difference stands at its own field (T-103)', () => {
  it('keys every field difference by its own field', () => {
    const { felder } = abweichungen(r, MPMM, [fassung(VGM, 'VGM')], () => undefined);
    expect(felder.get('Ancestry.size')?.map((a) => a.text)).toEqual(['medium']);
    /* Was nur VGM füllt, steht ebenso an seinem Feld — „hier —, VGM: cha +2". */
    expect(felder.get('Ancestry.abilityBonus')?.[0]?.text).toContain('cha');
    /* Was nur hier steht: dort leer. */
    expect(felder.get('Ancestry.abilityNote')?.[0]?.text).toBe('');
  });

  it('puts the other size under Size in the text, not under Languages', () => {
    const vgl = prosaVergleich(
      'Prose',
      'paragraph',
      [
        {
          id: 'text',
          value:
            '## Size\n\nYou are Medium or Small. You choose the size when you select this race.',
        },
      ],
      [fassung(VGM, 'VGM')],
    );
    const v = vgl.get('text')!;
    expect(v.abschnitte.map((s) => s.key)).toEqual(['size']);
    expect(v.abschnitte[0]!.abw.map((a) => a.text)).toEqual([
      'Aasimar have the same range of height and weight as humans.',
    ]);
    expect(v.nurDort.map((n) => n.heading)).toEqual(['Age', 'Languages']);
    expect(v.ganz).toHaveLength(1);
  });

  it('and the other way round: Size is compared at Size, Languages says “nothing here”', () => {
    const basis = (VGM.components!['Prose'] as { paragraph: { id: string; value: string }[] })
      .paragraph;
    const v = prosaVergleich('Prose', 'paragraph', basis, [fassung(MPMM, 'MPMM')]).get('text')!;
    const an = Object.fromEntries(v.abschnitte.map((s) => [s.key, s.abw.map((a) => a.text)]));
    expect(an['size']).toEqual([
      'You are Medium or Small. You choose the size when you select this race.',
    ]);
    expect(an['languages']).toEqual(['']);
    expect(an['age']).toEqual(['']);
    expect(v.nurDort).toEqual([]);
  });

  it('gives an empty entry a place when only the other version has text', () => {
    const v = prosaVergleich(
      'Lore',
      'lore',
      [],
      [
        fassung(VGM, 'VGM'),
        fassung(
          {
            ...VGM,
            id: 'x',
            components: {
              ...VGM.components,
              Lore: { lore: [{ id: 'lore', value: 'Born of light.' }] },
            },
          },
          'X',
        ),
      ],
    );
    expect([...v.keys()]).toEqual(['']);
    expect(v.get('')!.nurDort.map((n) => n.abw.text)).toEqual(['Born of light.']);
  });

  it('does not count two features of the same name as a difference', () => {
    const mit = (e: Entity, ziele: string[]): Entity => ({
      ...e,
      relations: ziele.map((to, i) => ({ id: `${e.id}-g${i}`, type: 'grants', to, props: {} })),
    });
    const namen: Record<string, string> = {
      a1: 'Darkvision',
      b1: 'Darkvision',
      a2: 'Healing Hands',
      b3: 'Light Bearer',
    };
    const { kanten } = abweichungen(
      r,
      mit(MPMM, ['a1', 'a2']),
      [fassung(mit(VGM, ['b1', 'b3']), 'VGM')],
      (id) => namen[id],
    );
    expect(kanten).toEqual([
      expect.objectContaining({ type: 'grants', dazu: ['Light Bearer'], weg: ['Healing Hands'] }),
    ]);
  });

  it('says “nothing here” once when the other version has no text at all', () => {
    const v = textVergleich('## A\n\nOne.\n\n## B\n\nTwo.', [{ f: fassung(VGM, 'VGM'), text: '' }]);
    expect(v.abschnitte.map((s) => s.abw.length)).toEqual([1, 0]);
  });

  it('says nothing where the text is the same', () => {
    const v = textVergleich('## A\n\nSame.', [{ f: fassung(VGM, 'VGM'), text: '## A\n\nSame.' }]);
    expect(v.ganz).toEqual([]);
    expect(v.abschnitte[0]!.abw).toEqual([]);
  });

  it('compares book lines by their label and collects lines only there', () => {
    const v = zeilenVergleich(
      [
        { label: 'Armor Class', text: '15' },
        { label: 'Hit Points', text: '7 (2d6)' },
      ],
      [
        {
          f: fassung(VGM, 'A'),
          zeilen: [
            { label: 'Armor Class', text: '13' },
            { label: 'Hit Points', text: '7 (2d6)' },
            { label: 'Senses', text: 'darkvision 60 ft.' },
          ],
        },
        {
          f: fassung(MPMM, 'B'),
          zeilen: [
            { label: 'Armor Class', text: '15' },
            { label: 'Senses', text: 'blindsight 10 ft.' },
          ],
        },
      ],
    );
    expect(v.an.get('armor class')?.map((a) => `${a.kuerzel} ${a.text}`)).toEqual(['A 13']);
    /* B hat keine Trefferpunkte: „—" an der Zeile. */
    expect(v.an.get('hit points')?.map((a) => `${a.kuerzel} ${a.text}`)).toEqual(['B ']);
    expect(v.nurDort).toHaveLength(1);
    expect(v.nurDort[0]!.abw.map((a) => `${a.kuerzel} ${a.text}`)).toEqual([
      'A darkvision 60 ft.',
      'B blindsight 10 ft.',
    ]);
  });
});

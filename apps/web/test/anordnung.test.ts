/**
 * Was eine Ansicht von einem Artikel zeichnet (T-110): die Zuteilung der
 * Felder an die Elemente, der Rest am Ende nur, wo die Ansicht ihn will,
 * und leere Felder nur auf Wunsch.
 *
 * Die Zuteilung stand in der Artikelseite und zeichnet jetzt auch den Druck
 * und die Vorschau im Register — einmal falsch, an drei Orten falsch.
 */

import { describe, expect, it } from 'vitest';
import type { Entity, LayoutElement, Registry } from '@nw/model';
import { anordnen, feldZellen, mitLeeren, prosaVon } from '../src/app/artikel/anordnung';
import { eintragText, freieId } from '../src/app/register/anordnung';

const reg = {
  interfaces: {
    Spell: {
      name: 'Spell',
      schema: {
        type: 'object',
        properties: {
          level: { type: 'number', title: 'Spell level' },
          school: { type: 'string', title: 'School' },
          ritual: { type: 'boolean', title: 'Ritual' },
          dc: { type: 'number', derived: '8+level' },
          text: { type: 'string', many: true, format: 'long', title: 'Text' },
        },
      },
    },
  },
  relations: {},
  views: {},
  units: {},
  vars: {},
} as unknown as Registry;

const e: Entity = {
  id: 'e1',
  interfaces: ['Spell'],
  components: { Spell: { level: 3, school: 'evocation', text: [{ id: 'a', value: 'Boom.' }] } },
};

describe('anordnen', () => {
  const zellen = feldZellen(reg, e, () => undefined);
  const prosa = prosaVon(reg, e);
  const nurLevel: LayoutElement[] = [{ id: 'f', el: 'fields', fields: ['Spell.level'] }];

  it('gibt jedem Element, was es nimmt — der Rest nur, wenn die Ansicht ihn will', () => {
    const ohne = anordnen(nurLevel, zellen, prosa, { beschreibung: null, rest: false });
    expect(ohne.map((s) => s.id)).toEqual(['f']);
    expect(ohne[0]!.zellen!.map((z) => z.ref)).toEqual(['Spell.level']);

    const mit = anordnen(nurLevel, zellen, prosa, { beschreibung: null, rest: true });
    expect(mit.map((s) => s.id)).toEqual(['f', 'rest-f', 'rest-p']);
    expect(mit[1]!.zellen!.map((z) => z.ref)).toEqual(['Spell.school']);
  });

  it('lässt Bildunterschrift und Alternativtext aus dem Rest, wenn kein Bild gezeichnet wird (T-090)', () => {
    const mitBild = {
      ...reg,
      interfaces: {
        Spell: { ...reg.interfaces['Spell']!, extends: ['Image'] },
        Image: {
          name: 'Image',
          schema: { type: 'object', properties: { caption: { type: 'string', title: 'Caption' }, alt: { type: 'string', title: 'Alt text' } } },
        },
      },
    } as unknown as Registry;
    const b: Entity = { ...e, components: { ...e.components, Image: { caption: 'Unter dem Bild', alt: 'Ein Bild' } } };
    const rest = anordnen(nurLevel, feldZellen(mitBild, b, () => undefined), prosaVon(mitBild, b), { beschreibung: null, rest: true });
    expect(rest.find((s) => s.id === 'rest-f')!.zellen!.map((z) => z.ref)).toEqual(['Spell.school']);
    const alle = anordnen([{ id: 'f', el: 'fields', fields: 'all' }], feldZellen(mitBild, b, () => undefined), [], { beschreibung: null, rest: false });
    expect(alle[0]!.zellen!.map((z) => z.ref)).toEqual(['Spell.level', 'Spell.school']);
    const genannt = anordnen([{ id: 'f', el: 'fields', fields: ['Image.caption'] }], feldZellen(mitBild, b, () => undefined), [], { beschreibung: null, rest: false });
    expect(genannt[0]!.zellen!.map((z) => z.ref)).toEqual(['Image.caption']);
  });

  it('ein Feld steht im ersten Element, das es nimmt', () => {
    const zwei: LayoutElement[] = [
      { id: 'a', el: 'fields', fields: ['Spell'] },
      { id: 'b', el: 'fields', fields: ['Spell.level'] },
    ];
    expect(anordnen(zwei, zellen, prosa, { beschreibung: null, rest: false }).map((s) => s.id)).toEqual(['a']);
  });

  it('zeigt leere Felder als „—", aber nichts Gerechnetes und keine Prosa', () => {
    const alle = mitLeeren(reg, e, zellen);
    expect(alle.map((z) => z.ref)).toEqual(['Spell.level', 'Spell.school', 'Spell.ritual']);
    expect(alle[2]).toMatchObject({ wert: '—', fehlt: true, label: 'Ritual' });
  });
});

describe('Editor-Helfer', () => {
  it('vergibt eine freie Id, auch über Reiter und geerbte Elemente hinweg', () => {
    const l: LayoutElement[] = [
      { id: 'fields-1', el: 'fields' },
      { id: 't', el: 'tabs', tabs: [{ id: 'x', label: 'X', layout: [{ id: 'fields-2', el: 'fields' }] }] },
    ];
    expect(freieId(l, 'fields')).toBe('fields-3');
    expect(freieId([], 'fields', ['fields-1'])).toBe('fields-2');
  });

  it('liest einen Eintrag als Typ und Feld', () => {
    expect(eintragText(reg, 'Spell.level')).toBe('Spell › Spell level');
    expect(eintragText(reg, 'Spell')).toBe('Spell (all fields)');
  });
});

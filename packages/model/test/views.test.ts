import { describe, expect, it } from 'vitest';
import {
  attachedDerived,
  componentVisible,
  forArticle,
  resolveView,
  showField,
  viewKeys,
  whenHolds,
} from '../src/views.js';
import type { LayoutElement, ObjectSchema, Registry, ViewDef } from '../src/types.js';

const statblockInfo: ObjectSchema = {
  type: 'object',
  properties: {
    ac: { type: 'number', title: 'Rüstungsklasse' },
    tp: { type: 'number', title: 'Trefferpunkte' },
    str: { type: 'number', title: 'STÄ' },
    strMod: { type: 'number', derived: 'mod(str)', of: 'str', format: 'signed' },
    initiative: { type: 'number', derived: 'mod(dex)', format: 'signed' },
  },
};

const combat: ViewDef = {
  label: 'Combat',
  order: 3,
  fields: ['StatblockInfo.ac', 'StatblockInfo.tp'],
};

describe('showField', () => {
  it('takes a single field when named with a dot', () => {
    expect(showField(combat, 'StatblockInfo', 'ac')).toBe(true);
    expect(showField(combat, 'StatblockInfo', 'str')).toBe(false);
  });

  it('takes every field when the bare component is named', () => {
    const stats: ViewDef = { label: 'Werte', fields: ['StatblockInfo'] };
    expect(showField(stats, 'StatblockInfo', 'ac')).toBe(true);
    expect(showField(stats, 'StatblockInfo', 'str')).toBe(true);
    expect(showField(stats, 'CreatureInfo', 'rolle')).toBe(false);
  });

  it('honours the two keywords', () => {
    expect(showField({ label: 'A', fields: 'all' }, 'X', 'y')).toBe(true);
    expect(showField({ label: 'B', fields: 'none' }, 'X', 'y')).toBe(false);
  });
});

describe('componentVisible', () => {
  it('is false when no property of the component survives', () => {
    const image: ViewDef = { label: 'Image', fields: 'none' };
    expect(componentVisible(combat, 'StatblockInfo', statblockInfo)).toBe(true);
    expect(componentVisible(image, 'StatblockInfo', statblockInfo)).toBe(false);
  });
});

describe('attachedDerived', () => {
  it('rides a derived value in its base field unless the view names it', () => {
    const full: ViewDef = { label: 'Full', fields: 'all' };
    // fields: 'all' shows strMod in its own right, so nothing is attached.
    expect(attachedDerived(full, 'StatblockInfo', statblockInfo)).toEqual({});

    const nurStr: ViewDef = { label: 'X', fields: ['StatblockInfo.str'] };
    expect(attachedDerived(nurStr, 'StatblockInfo', statblockInfo)).toEqual({ str: ['strMod'] });
  });

  it('never attaches a derived value that has no base field', () => {
    const nurInit: ViewDef = { label: 'X', fields: ['StatblockInfo.initiative'] };
    expect(attachedDerived(nurInit, 'StatblockInfo', statblockInfo)).toEqual({});
  });
});

describe('view ordering', () => {
  const registry: Pick<Registry, 'views'> = {
    views: {
      full: { label: 'Full', order: 2, fields: 'all' },
      quick: { label: 'Quick', order: 1, fields: 'none' },
      combat,
    },
  };

  it('sorts by order', () => {
    expect(viewKeys(registry)).toEqual(['quick', 'full', 'combat']);
  });

  it('falls back to the first view for an unknown key', () => {
    expect(resolveView(registry, 'gibtsnicht').label).toBe('Quick');
    expect(resolveView({ views: {} }, 'egal').label).toBe('Full');
  });
});

describe('listColumns', () => {
  const reg = {
    interfaces: {
      Rule: { name: 'Rule', schema: { type: 'object', properties: { kind: { type: 'string' } } } },
      Spell: {
        name: 'Spell',
        extends: ['Rule'],
        schema: {
          type: 'object',
          properties: {
            level: { type: 'number', min: 0, max: 9 },
            school: { type: 'string', enum: ['Evocation', 'Illusion'] },
            dc: { type: 'number', derived: '8+level' },
          },
        },
        views: {
          overview: [{ id: 'o', el: 'fields', fields: ['Spell.level', 'Spell.dc', 'Rule', 'Spell.school', 'Other.x'] }],
        },
      },
      Cantrip: { name: 'Cantrip', extends: ['Spell'] },
    },
    views: { overview: { label: 'Overview', layout: [{ id: 'x', el: 'fields', fields: [] }] } },
  } as unknown as Registry;

  it('reads the overview layout in order, drops derived and foreign fields', async () => {
    const { listColumns } = await import('../src/views.js');
    expect(listColumns(reg, 'Spell').map((c) => c.ref)).toEqual(['Spell.level', 'Rule.kind', 'Spell.school']);
  });

  it('inherits the layout up the chain and gives nothing without one', async () => {
    const { listColumns } = await import('../src/views.js');
    expect(listColumns(reg, 'Cantrip').map((c) => c.ref)).toEqual(['Spell.level', 'Rule.kind', 'Spell.school']);
    expect(listColumns(reg, 'Rule')).toEqual([]);
  });
});

describe('Anpassungen je Art (T-110)', () => {
  const basis = [
    { id: 'img', el: 'image' as const },
    { id: 'desc', el: 'description' as const },
    { id: 'f', el: 'fields' as const, fields: ['Spell.level'] },
    { id: 'p', el: 'prose' as const, fields: 'all' as const },
  ];
  const reg = {
    interfaces: {
      Rule: { name: 'Rule', schema: { type: 'object', properties: { kind: { type: 'string' } } } },
      Spell: {
        name: 'Spell',
        extends: ['Rule'],
        schema: {
          type: 'object',
          properties: {
            level: { type: 'number' },
            school: { type: 'string' },
            text: { type: 'string', many: true, format: 'long' },
          },
        },
        views: { quick: { adjust: { drop: ['img'], add: { f: ['Spell.school'] }, order: ['f'] } } },
      },
      Cantrip: {
        name: 'Cantrip',
        extends: ['Spell'],
        views: { quick: { adjust: { hide: ['Spell.level'] } } },
      },
      Ritual: { name: 'Ritual', extends: ['Spell'], views: { quick: [{ id: 'eigen', el: 'description' }] } },
    },
    views: { quick: { label: 'Quick', fields: 'none', layout: basis } },
  } as unknown as Registry;

  it('passt die Anordnung der Ansicht an, ohne sie zu ändern', async () => {
    const { layoutFor } = await import('../src/views.js');
    const r = layoutFor(reg, 'quick', 'Spell');
    expect(r.mode).toBe('adjusted');
    expect(r.from).toBe('Spell');
    expect(r.layout.map((e) => e.id)).toEqual(['f', 'desc', 'p']);
    expect(r.layout[0]!.fields).toEqual(['Spell.level', 'Spell.school']);
    expect(basis[2]!.fields).toEqual(['Spell.level']);
  });

  it('stapelt Anpassungen die Kette hoch, die allgemeinste zuerst', async () => {
    const { layoutFor } = await import('../src/views.js');
    const r = layoutFor(reg, 'quick', 'Cantrip');
    expect(r.mode).toBe('adjusted');
    expect(r.from).toBe('Cantrip');
    expect(r.layout.map((e) => e.id)).toEqual(['f', 'desc', 'p']);
    expect(r.layout[0]!.fields).toEqual(['Spell.school']);
    expect(r.layout[2]!.except).toEqual(['Spell.level']);
  });

  it('eine eigene Liste ersetzt, die Ansicht gilt ohne Angabe', async () => {
    const { layoutFor } = await import('../src/views.js');
    expect(layoutFor(reg, 'quick', 'Ritual')).toEqual({ layout: [{ id: 'eigen', el: 'description' }], from: 'Ritual', mode: 'own' });
    expect(layoutFor(reg, 'quick', 'Rule').mode).toBe('view');
  });

  it('viewFields sagt je Element, welche Felder es nimmt, und was übrig bleibt', async () => {
    const { viewFields } = await import('../src/views.js');
    const v = viewFields(reg, 'quick', 'Spell');
    expect(v.elements).toEqual([
      { id: 'f', el: 'fields', fields: ['Spell.level', 'Spell.school'] },
      { id: 'p', el: 'prose', fields: ['Spell.text'] },
    ]);
    expect(v.rest).toEqual(['Rule.kind']);
  });

  it('elementTakes: except schlägt fields, ohne fields nimmt es alles', async () => {
    const { elementTakes } = await import('../src/views.js');
    expect(elementTakes({ id: 'a', el: 'prose' }, 'X', 'y')).toBe(true);
    expect(elementTakes({ id: 'a', el: 'fields', fields: ['X'], except: ['X.y'] }, 'X', 'y')).toBe(false);
    expect(elementTakes({ id: 'a', el: 'fields', fields: ['X'], except: ['X.y'] }, 'X', 'z')).toBe(true);
  });
});

/* Anzeige je Art (T-184): ein Element mit `when` steht nur an Artikeln,
   auf die es zutrifft. */
describe('whenHolds / forArticle', () => {
  const init = { field: 'Encounter.kind', has: ['combat'], empty: true, relation: 'participates' };
  const art = (kind: unknown, relations: { id: string; type: string; to: string }[] = []) => ({
    components: kind === undefined ? {} : { Encounter: { kind } },
    relations,
  });

  it('ohne Bedingung gilt das Element immer', () => {
    expect(whenHolds(undefined, art(['puzzle']))).toBe(true);
    expect(whenHolds({}, art(['puzzle']))).toBe(true);
  });

  it('liest mehrere Werte, einen Wert und „nicht gesagt“', () => {
    expect(whenHolds(init, art(['social', 'combat']))).toBe(true);
    expect(whenHolds(init, art(['puzzle']))).toBe(false);
    expect(whenHolds(init, art(undefined))).toBe(true);
    expect(whenHolds(init, art([]))).toBe(true);
    expect(whenHolds({ field: 'Encounter.kind', has: ['puzzle'] }, art([]))).toBe(false);
    expect(whenHolds({ field: 'Encounter.kind', has: ['puzzle'] }, art('puzzle'))).toBe(true);
  });

  it('eine Kante genügt: wer mitkämpft, hat eine Initiative', () => {
    expect(whenHolds(init, art(['puzzle'], [{ id: 'r', type: 'participates', to: 'x' }]))).toBe(true);
  });

  it('nimmt auch in Reitern heraus und lässt die Eingabe stehen', () => {
    const layout: LayoutElement[] = [
      { id: 'i', el: 'initiative', when: init },
      { id: 't', el: 'tabs', tabs: [{ id: 'a', label: 'A', layout: [{ id: 'p', el: 'fields', when: { field: 'Encounter.kind', has: ['puzzle'] } }] }] },
      { id: 'f', el: 'fields', fields: 'all' },
    ];
    const raus = forArticle(layout, art(['social']));
    expect(raus.map((x) => x.id)).toEqual(['t', 'f']);
    expect(raus[0]!.tabs![0]!.layout).toEqual([]);
    expect(layout[1]!.tabs![0]!.layout).toHaveLength(1);
    expect(forArticle(layout, art(['puzzle'])).map((x) => x.id)).toEqual(['t', 'f']);
    expect(forArticle(layout, art(['puzzle']))[0]!.tabs![0]!.layout).toHaveLength(1);
  });
});

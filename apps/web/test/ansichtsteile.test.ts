/**
 * Was in einer Ansicht gilt (T-318): die allgemeine, je Typ mit Eigenem
 * (angepasst oder eigene Anordnung), die gestalteten ihrer Gruppe — und
 * welche Ansichten oben zur Wahl stehen.
 */

import { describe, expect, it } from 'vitest';
import type { Registry } from '@nw/model';
import { ansichtsTeile, wahlAnsichten } from '../src/app/ansichten/uebersicht';

const reg = {
  interfaces: {
    Identity: { name: 'Identity', abstract: true },
    Table: { name: 'Table', label: 'Table', extends: ['Identity'], views: { quick: { adjust: { extra: [{ id: 't', el: 'table' }] } } } },
    Creature: { name: 'Creature', label: 'Creature', extends: ['Identity'], views: { quick: [{ id: 'd', el: 'description' }] } },
    Spell: { name: 'Spell', label: 'Spell', extends: ['Identity'], views: { quick: { adjust: {} } } },
  },
  views: {
    quick: { label: 'Quick', order: 2, layout: [{ id: 'd', el: 'description' }] },
    full: { label: 'Full', order: 3, layout: [] },
    shop: { label: 'Shop', order: 9, group: 'quick', applies: { types: ['Creature'], where: [{ incoming: 'shopkeeper' }] }, layout: [] },
  },
  relations: {},
  enums: {},
  units: {},
  vars: {},
} as unknown as Registry;

describe('ansichtsTeile', () => {
  it('names the general view, each type that says its own, and the designed views of the group', () => {
    const t = ansichtsTeile(reg, 'quick');
    expect(t.map((x) => [x.art, x.label, x.wie])).toEqual([
      ['general', 'Quick', 'every article, unless its type says otherwise'],
      ['type', 'Creature', 'own arrangement'],
      ['type', 'Table', 'adjusted'],
      ['designed', 'Shop', expect.any(String)],
    ]);
    expect(t[2]).toMatchObject({ view: 'quick', type: 'Table' });
  });
  it('an empty adjustment is nothing of its own', () => {
    expect(ansichtsTeile(reg, 'quick').some((x) => x.type === 'Spell')).toBe(false);
  });
});

describe('wahlAnsichten', () => {
  it('offers the views at the top, without designed views of another view', () => {
    expect(wahlAnsichten(reg).map((v) => v.key)).toEqual(['quick', 'full']);
  });
});

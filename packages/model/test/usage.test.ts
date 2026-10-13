/**
 * Was der Bestand an einer Registerzeile trägt — gezählt, bevor das
 * Register sie ändert. Eine falsche Null hiesse: „löschen, es steht ja
 * nichts drin", und weg wäre es.
 */

import { describe, expect, it } from 'vitest';
import { articlesTaking, registryUsage, typeList } from '../src/index.js';
import type { Entity, Registry } from '../src/index.js';

const reg: Pick<Registry, 'interfaces'> = {
  interfaces: {
    Thing: { name: 'Thing', label: 'Thing', abstract: true, schema: { type: 'object', properties: { note: { type: 'string' } } } },
    Blade: {
      name: 'Blade', label: 'Blade', extends: ['Thing'],
      schema: { type: 'object', properties: { edge: { type: 'string', enum: ['keen', 'dull'] }, tags: { type: 'array' } } },
    },
    Axe: { name: 'Axe', label: 'Axe', extends: ['Blade'] },
  },
};
const art = (id: string, typ: string, components: Entity['components']): Entity =>
  ({ id, interfaces: [typ], name: id, components, relations: [{ id: `r${id}`, type: 'near', to: 'x', props: {} }] });

describe('registryUsage', () => {
  const u = registryUsage(reg, [
    art('a', 'Blade', { Blade: { edge: 'keen', tags: [] }, Thing: { note: '' } }),
    art('b', 'Axe', { Blade: { edge: 'dull' } }),
    art('c', 'Axe', { Blade: { edge: [{ id: 'x', value: 'keen' }] } }),
  ]);

  it('counts a field only where something stands in it', () => {
    expect(u.cards.Blade?.fields).toEqual({ edge: 3 });
    expect(u.cards.Thing?.articles).toBe(0);
  });
  it('counts each value of a list that holds, also inside entries', () => {
    expect(u.values['Blade.edge']).toEqual({ keen: 2, dull: 1 });
  });
  it('counts types, their takers and the edges', () => {
    expect(u.types).toEqual({ Blade: 1, Axe: 2 });
    expect(articlesTaking(reg, u, 'Blade')).toBe(3);
    expect(articlesTaking(reg, u, 'Axe')).toBe(2);
    expect(u.relations.near).toBe(3);
  });
});

describe('typeList', () => {
  it('is flat and sorted by label', () => {
    expect(typeList(reg)).toEqual(['Axe', 'Blade', 'Thing']);
  });
});

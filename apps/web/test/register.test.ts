/**
 * Das Register (W5): was es an seinen Zeilen ändert, ohne etwas zu
 * zeichnen. Geprüft wird, was man nicht sieht — dass ein Schlüssel überall
 * mitwandert, wo das Register ihn nennt, dass ein Herausnehmen sagt, welche
 * Typen dabei aus der Kette fallen, und dass ein Typ, den etwas nennt, als
 * genannt gilt.
 */

import { describe, expect, it } from 'vitest';
import type { Registry } from '@nw/model';
import { routes } from '../src/app/app.routes';
import {
  droppedBy,
  fieldKind,
  fieldMentions,
  mentionsOf,
  removeField,
  renameField,
  setFieldKind,
  techName,
  viaOf,
  wouldCycle,
} from '../src/app/register/regeln';

function reg(): Registry {
  return {
    interfaces: {
      Named: { name: 'Named', abstract: true, schema: { type: 'object', properties: { alias: { type: 'string' } } } },
      Stats: {
        name: 'Stats', abstract: true, extends: ['Named'],
        schema: {
          type: 'object', required: ['dex'],
          properties: { dex: { type: 'integer' }, dexMod: { type: 'integer', derived: 'mod(dex)', of: 'dex' } },
        },
      },
      Beast: {
        name: 'Beast', label: 'Beast', extends: ['Stats'], titles: { 'Stats.dex': 'Agility' },
        views: { full: [{ id: 'f', el: 'fields', fields: ['Stats.dex'] }] },
        schema: { type: 'object', properties: { pack: { type: 'string', target: { interfaces: ['Named'] } } } },
      },
    },
    relations: { hunts: { type: 'hunts', label: 'hunts', inverseLabel: 'hunted by', from: ['Beast'], to: ['*'] } },
    views: { full: { label: 'Full', fields: 'all' } },
    units: {},
    vars: {},
  };
}

describe('the registry page', () => {
  it('has its route', () => {
    expect(routes.some((r) => r.path === 'registry')).toBe(true);
  });

  it('reads a field kind back from its schema and keeps the label through a change', () => {
    expect(fieldKind({ type: 'string', format: 'link' })).toBe('link');
    expect(fieldKind({ type: 'array', enumRef: 'Ability' })).toBe('choices');
    const neu = setFieldKind({ type: 'string', title: 'Pack', enum: ['a'], derived: 'x' }, 'number');
    expect(neu).toEqual({ type: 'number', title: 'Pack', derived: 'x' });
  });

  it('renames a key wherever the registry names it', () => {
    const r = reg();
    expect(renameField(r.interfaces, 'Stats', 'dex', 'agi')).toBeUndefined();
    const s = r.interfaces['Stats']!.schema!;
    expect(Object.keys(s.properties)).toEqual(['agi', 'dexMod']); // Reihenfolge bleibt
    expect(s.required).toEqual(['agi']);
    expect(s.properties['dexMod']).toMatchObject({ derived: 'mod(agi)', of: 'agi' });
    expect(r.interfaces['Beast']!.titles).toEqual({ 'Stats.agi': 'Agility' });
    expect(r.interfaces['Beast']!.views!['full']![0]!.fields).toEqual(['Stats.agi']);
    expect(renameField(r.interfaces, 'Stats', 'agi', 'dexMod')).toMatch(/already/);
  });

  it('says who else names a field before it goes, and takes it out of required and titles', () => {
    const r = reg();
    const nennen = fieldMentions(r, 'Stats', 'dex');
    expect(nennen).toContain('dexMod is shown in its cell');
    expect(nennen).toContain('Beast renames it');
    expect(nennen).toContain('Beast arranges it in a view');
    removeField(r.interfaces, 'Stats', 'dex');
    expect(r.interfaces['Stats']!.schema!.required).toBeUndefined();
    expect(r.interfaces['Beast']!.titles).toBeUndefined();
  });

  it('knows what leaves the chain, what comes in via another, and what would turn in a circle', () => {
    const r = reg();
    expect(droppedBy(r, 'Beast', 'Stats')).toEqual(['Stats', 'Named']);
    expect(viaOf(r, 'Beast', 'Named')).toBe('Stats');
    expect(viaOf(r, 'Beast', 'Stats')).toBeNull();
    expect(wouldCycle(r, 'Named', 'Beast')).toBe(true);
    expect(wouldCycle(r, 'Beast', 'Named')).toBe(false);
  });

  it('counts a type as named when a link, an edge or a renaming points at it', () => {
    const r = reg();
    expect(mentionsOf(r, 'Named')).toContain('field Beast.pack links to it');
    expect(mentionsOf(r, 'Beast')).toContain('edge hunts');
    expect(mentionsOf(r, 'Stats')).toContain('Beast renames one of its fields');
  });

  it('makes a row name from a label', () => {
    expect(techName('Sky ship', { SkyShip: {} })).toBe('SkyShip2');
    expect(techName('owes a favour to', {}, true)).toBe('owesAFavourTo');
  });
});

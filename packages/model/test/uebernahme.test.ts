import { describe, expect, it } from 'vitest';
import type { Entity } from '../src/types.js';
import {
  assignNumbers,
  compareThree,
  mergeTransfer,
  registryItem,
  transferItem,
  withDependencies,
  yieldNumbers,
} from '../src/uebernahme.js';
import { repoint } from '../src/bulk.js';

/* Übernahme (T-130): Dreiwege-Vergleich wie in git, Nummern von prod. */

const npc = (id: string, nr: string, felder: Record<string, unknown> = {}, rel: Entity['relations'] = []): Entity => ({
  id,
  interfaces: ['Creature'],
  name: 'Volo',
  components: { Identity: { name: 'Volo', id: nr }, Creature: { kind: 'npc', ...felder } },
  relations: rel,
});

describe('compareThree', () => {
  it('knows who changed what since the base', () => {
    const base = npc('e1', 'creature-0001', { mood: 'calm', age: 40 });
    const dev = npc('e1', 'creature-0001', { mood: 'angry', age: 40, note: 'x' });
    const prod = npc('e1', 'creature-0001', { mood: 'calm', age: 41 });
    const f = Object.fromEntries(compareThree(base, dev, prod).map((x) => [x.key, x.state]));
    expect(f['Creature.mood']).toBe('source');
    expect(f['Creature.age']).toBe('target');
    expect(f['Creature.note']).toBe('source');
    expect(f['Creature.kind']).toBe('same');
    expect(f['Identity.id']).toBeUndefined();
  });

  it('calls both sides changing the same field a conflict', () => {
    const base = npc('e1', 'creature-0001', { mood: 'calm' });
    const item = transferItem(base, npc('e1', 'creature-0001', { mood: 'angry' }), npc('e1', 'creature-0001', { mood: 'sad' }), (x) => x);
    expect(item.status).toBe('conflict');
    expect(item.fields).toEqual([{ key: 'Creature.mood', kind: 'field', base: 'calm', source: 'angry', target: 'sad', state: 'conflict' }]);
  });

  it('without a base, every difference is a conflict — nothing is overwritten silently', () => {
    const item = transferItem(undefined, npc('e1', 'c-1', { mood: 'angry' }), npc('e1', 'c-1', { mood: 'sad', age: 3 }), (x) => x);
    expect(item.status).toBe('conflict');
    expect(item.fields.map((f) => [f.key, f.state])).toEqual([
      ['Creature.age', 'target'],
      ['Creature.mood', 'conflict'],
    ]);
  });

  it('compares edges one by one', () => {
    const base = npc('e1', 'c-1', {}, [{ id: 'r1', type: 'knows', to: 'e2' }]);
    const dev = npc('e1', 'c-1', {}, [{ id: 'r1', type: 'knows', to: 'e2' }, { id: 'r2', type: 'knows', to: 'e3' }]);
    const prod = npc('e1', 'c-1', {}, []);
    const f = compareThree(base, dev, prod).filter((x) => x.kind === 'edge');
    expect(f.map((x) => [x.key, x.state])).toEqual([
      ['edge:r1', 'target'],
      ['edge:r2', 'source'],
    ]);
  });
});

describe('mergeTransfer', () => {
  it('takes each side where it changed and asks for conflicts', () => {
    const base = npc('e1', 'c-1', { mood: 'calm', age: 40 }, [{ id: 'r1', type: 'knows', to: 'e2' }]);
    const dev = npc('e1', 'c-1', { mood: 'angry', age: 40 }, [{ id: 'r1', type: 'knows', to: 'e2' }, { id: 'r2', type: 'knows', to: 'e3' }]);
    const prod = npc('e1', 'c-9', { mood: 'sad', age: 41 }, []);
    expect(mergeTransfer(base, dev, prod).unresolved).toEqual(['Creature.mood']);
    const { entity, unresolved } = mergeTransfer(base, dev, prod, { 'Creature.mood': { value: 'grim' } });
    expect(unresolved).toEqual([]);
    expect(entity.components['Creature']).toEqual({ kind: 'npc', mood: 'grim', age: 41 });
    expect(entity.relations).toEqual([{ id: 'r2', type: 'knows', to: 'e3' }]);
    /* Die Nummer bleibt die des Ziels. */
    expect(entity.components['Identity']?.['id']).toBe('c-9');
  });

  it('a new article is the source as it is', () => {
    const dev = npc('e1', 'c-1', { mood: 'calm' }, [{ id: 'r1', type: 'knows', to: 'e2', props: { since: 3 } }]);
    const { entity } = mergeTransfer(undefined, dev, undefined);
    expect(entity).toEqual({ ...dev, name: 'Volo' });
  });
});

describe('numbers — prod is the master', () => {
  it('keeps a free number and gives the next one when it is taken', () => {
    const prod = [npc('p1', 'creature-0001'), npc('p2', 'creature-0002')];
    const neu = [npc('d1', 'creature-0002'), npc('d2', 'creature-0005'), npc('p1', 'creature-0001')];
    /* Gezählt wird ab der höchsten, wie `nextId` — die mitgebrachte 0005 zählt mit. */
    expect([...assignNumbers(prod, neu)]).toEqual([['d1', 'creature-0006']]);
  });

  it('dev yields when it pulls an article with a number dev uses otherwise', () => {
    const dev = [npc('d1', 'creature-0001'), npc('d2', 'creature-0002')];
    const kommt = [npc('p9', 'creature-0002')];
    expect([...yieldNumbers(dev, kommt)]).toEqual([['d2', 'creature-0003']]);
  });

  it('repoint moves [[number]] links without pegs', () => {
    const text: Entity = { id: 'x', interfaces: ['Rule'], name: 'R', components: { Description: { description: 'See [[creature-0002|Volo]].' } }, relations: [] };
    const neu = repoint([text], new Map(), new Map([['creature-0002', 'creature-0003']]));
    expect(neu.get('x')?.components['Description']?.['description']).toBe('See [[creature-0003|Volo]].');
  });
});

describe('withDependencies', () => {
  it('brings statblock, inventory and its content whole, edge targets one step', () => {
    const all = new Map<string, Entity>(
      [
        npc('c', 'c-1', { portrait: 'img' }, [{ id: 'c1', type: 'carries', to: 'inv' }, { id: 'c2', type: 'knows', to: 'other' }]),
        { id: 'sb', interfaces: ['Statblock'], name: 'SB', components: {}, relations: [{ id: 's1', type: 'belongsTo', to: 'c' }, { id: 's2', type: 'instanceOf', to: 'tpl' }] },
        { id: 'tpl', interfaces: ['Statblock'], name: 'T', components: {}, relations: [] },
        { id: 'inv', interfaces: ['Inventory'], name: 'I', components: {}, relations: [{ id: 'i1', type: 'holds', to: 'sword' }] },
        { id: 'sword', interfaces: ['Item'], name: 'S', components: {}, relations: [{ id: 'w1', type: 'knows', to: 'far' }] },
        { id: 'other', interfaces: ['Creature'], name: 'O', components: {}, relations: [{ id: 'o1', type: 'knows', to: 'far' }] },
        { id: 'img', interfaces: ['Asset'], name: 'P', components: {}, relations: [] },
        { id: 'far', interfaces: ['Creature'], name: 'F', components: {}, relations: [] },
      ].map((e) => [e.id, e] as const),
    );
    const ids = withDependencies(all, ['c']).sort();
    expect(ids).toEqual(['c', 'far', 'img', 'inv', 'other', 'sb', 'sword', 'tpl']);
    /* `far` kam über das Schwert (das zum Ganzen gehört), nicht über `other`. */
  });
});

describe('registryItem', () => {
  it('treats a row as one field', () => {
    expect(registryItem('interfaces:Spell', { a: 1 }, { a: 2 }, { a: 1 }).status).toBe('changed');
    expect(registryItem('interfaces:Spell', undefined, { a: 2 }, undefined).status).toBe('new');
    expect(registryItem('views:quick', { a: 1 }, { a: 2 }, { a: 3 }).status).toBe('conflict');
  });
});

import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import { CHECKS, runChecks } from '../src/checks.js';
import { BulkRequestSchema, planBulk, repoint, selectEntities, storedKey } from '../src/bulk.js';
import { linkCandidates, linkIndex } from '../src/entity.js';
import type { Entity } from '../src/types.js';

/* Werkbank (W9): Prüfungen und Massenänderungen sind reine Funktionen über
   einen Bestand — hier ein kleiner, der jede Prüfung einmal auslöst. */

const ident = (name: string, id: string) => ({ Identity: { name, id, aliases: [] as string[] } });
const merkmal = (peg: string, nr: string, text: string, extra: Partial<Entity> = {}): Entity => ({
  id: peg,
  interfaces: ['Feature'],
  name: 'Amphibious',
  components: { ...ident('Amphibious', nr), Description: { description: text } },
  relations: [],
  ...extra,
});
const statblock = (peg: string, nr: string, name: string, werte: Record<string, unknown>, relations: Entity['relations'] = []): Entity => ({
  id: peg,
  interfaces: ['Statblock'],
  name,
  components: { ...ident(name, nr), Statblock: werte },
  relations,
});

const amph1 = merkmal('f1', 'feature-0001', '{CREATURE} can breathe air and water.');
const amph2 = merkmal('f2', 'feature-0002', '{CREATURE} can breathe air and water.');
const amph3 = merkmal('f3', 'feature-0003', '{CREATURE} breathes air and water, mostly.');
const ogre = statblock('s1', 'statblock-0001', 'Ogre', { ac: 11, hp: 59 }, [
  { id: 's1~composedOf-1', type: 'composedOf', to: 'f2' },
]);
const halbOgre = statblock('s2', 'statblock-0002', 'Half-Ogre', { ac: 12, hp: 30 }, [
  { id: 's2~composedOf-1', type: 'composedOf', to: 'f1' },
]);
const leer = statblock('s3', 'statblock-0003', 'Nothing', { creatureType: 'ooze' });
const kaputt: Entity = {
  id: 'r1',
  interfaces: ['Rule'],
  name: 'Broken',
  components: {
    ...ident('Broken', 'rule-0001'),
    Description: { description: 'Roll on [object Object]. See [[feature-0002|Amphibious]], [[Nowhere]] and [[Amphibious]].' },
  },
  relations: [{ id: 'r1~x', type: 'variantOf', to: 'gone' }],
};
const waise = statblock('s4', 'statblock-0004', 'Orphan', { ac: 10 }, [{ id: 's4~i', type: 'instanceOf', to: 'gone' }]);
const ohneName: Entity = { id: 'n1', interfaces: ['Feature'], name: '', components: { Identity: { name: '  ', id: 'feature-0009' } }, relations: [] };

const bestand = [amph1, amph2, amph3, ogre, halbOgre, leer, kaputt, waise, ohneName];
const exists = new Map(bestand.map((e) => [e.id, e.interfaces[0]!] as const));
const ctx = { registry: seedRegistry, entities: bestand, exists };
const treffer = (key: string) => runChecks(ctx, { only: [key], limit: 100 })[0]!;

describe('checks', () => {
  it('has a key, label and description for each check', () => {
    expect(new Set(CHECKS.map((c) => c.key)).size).toBe(CHECKS.length);
    for (const c of CHECKS) expect(c.label && c.description).toBeTruthy();
  });

  it('finds what validateEntity refuses', () => {
    const r = treffer('invalid');
    /* Ein Name aus Leerraum besteht validateEntity — darum gibt es
       `emptyRequired` daneben. */
    expect(r.hits.map((h) => h.id).sort()).toEqual(['r1', 's4']);
    expect(r.hits.find((h) => h.id === 'r1')!.reason).toMatch(/gone/);
  });

  it('finds [object Object] and names the field', () => {
    const r = treffer('objectObject');
    expect(r.hits).toEqual([expect.objectContaining({ id: 'r1', reason: 'Description.description' })]);
  });

  it('counts a blank required field as empty', () => {
    expect(treffer('emptyRequired').hits.map((h) => [h.id, h.reason])).toEqual([['n1', 'Identity.name']]);
  });

  it('groups same name and type, oldest first, with similarity', () => {
    const r = treffer('duplicates');
    expect(r.count).toBe(1);
    expect(r.hits[0]!.group).toEqual(['f1', 'f2', 'f3']);
    expect(r.hits[0]!.reason).toMatch(/^3 articles · 2 identical · similarity/);
  });

  it('leaves declared variants out of the duplicates', () => {
    const variante = merkmal('f4', 'feature-0004', 'x', { relations: [{ id: 'v', type: 'variantOf', to: 'f1' }] });
    const r = runChecks({ ...ctx, entities: [amph1, variante] }, { only: ['duplicates'] })[0]!;
    expect(r.count).toBe(0);
  });

  it('finds dangling edges, statblocks without numbers and orphaned instances', () => {
    expect(treffer('danglingEdges').hits.map((h) => h.id)).toEqual(['r1', 's4']);
    expect(treffer('statblockWithoutStats').hits.map((h) => h.id)).toEqual(['s3']);
    expect(treffer('instanceWithoutTemplate').hits.map((h) => [h.id, h.reason])).toEqual([['s4', 'template gone does not exist']]);
  });

  it('finds links that hit nothing and links that hit several', () => {
    expect(treffer('brokenLinks').hits.map((h) => [h.id, h.reason])).toEqual([['r1', 'Nowhere']]);
    expect(treffer('ambiguousLinks').hits.map((h) => [h.id, h.reason])).toEqual([['r1', 'Amphibious']]);
  });

  it('counts everything and hands back only the limit', () => {
    const [r] = runChecks(ctx, { only: ['invalid'], limit: 1 });
    expect(r!.count).toBe(2);
    expect(r!.hits).toHaveLength(1);
  });
});

describe('linkIndex', () => {
  it('answers like linkCandidates', () => {
    const finde = linkIndex(bestand);
    for (const ziel of ['feature-0002', 'f3', 'Amphibious', 'ogre', 'Nowhere', 'FEATURE-0001', '']) {
      expect(finde(ziel).map((e) => e.id)).toEqual(linkCandidates(bestand, ziel).map((e) => e.id));
    }
  });
});

describe('bulk', () => {
  const raw = new Map(bestand.map((e) => [e.id, e]));

  it('reads the request shape', () => {
    expect(BulkRequestSchema.safeParse({ select: {}, ops: [{ op: 'set', field: 'Statblock.combatRole', value: 'Brute' }] }).success).toBe(true);
    expect(BulkRequestSchema.safeParse({ select: {}, ops: [] }).success).toBe(false);
    expect(BulkRequestSchema.safeParse({ select: {}, ops: [{ op: 'explode' }] }).success).toBe(false);
  });

  it('selects by type and a name condition, case-insensitive', () => {
    const t = selectEntities(seedRegistry, bestand, {
      types: ['Statblock'],
      where: [{ field: 'name', op: 'endsWith', value: 'ogre' }],
    });
    expect(t.map((e) => e.id)).toEqual(['s1', 's2']);
    expect(selectEntities(seedRegistry, bestand, { ids: ['statblock-0003', 'f1'] }).map((e) => e.id)).toEqual(['f1', 's3']);
    expect(selectEntities(seedRegistry, bestand, { where: [{ field: 'Statblock.ac', op: 'empty' }], types: ['Statblock'] }).map((e) => e.id)).toEqual(['s3']);
  });

  it('sets a field and leaves the stock untouched', () => {
    const vorher = storedKey(ogre);
    const plan = planBulk(seedRegistry, raw, ['s1', 's2'], [{ op: 'set', field: 'Statblock.combatRole', value: 'Brute' }]);
    expect(plan.changes.map((c) => c.id)).toEqual(['s1', 's2']);
    expect(plan.changes[0]!.after!.components['Statblock']!['combatRole']).toBe('Brute');
    expect(plan.changes[0]!.summary).toEqual(['Statblock.combatRole: — → "Brute"']);
    expect(storedKey(ogre)).toBe(vorher);
  });

  it('changes nothing where nothing changes', () => {
    const plan = planBulk(seedRegistry, raw, ['s1'], [{ op: 'set', field: 'Statblock.ac', value: '11' }]);
    expect(plan.changes).toEqual([]);
  });

  it('empties a field and drops the card when nothing is left', () => {
    const plan = planBulk(seedRegistry, raw, ['s3'], [{ op: 'unset', field: 'Statblock.creatureType' }]);
    expect(plan.changes[0]!.after!.components['Statblock']).toBeUndefined();
  });

  it('adds and removes tags and edges', () => {
    const plan = planBulk(seedRegistry, raw, ['s1'], [
      { op: 'addTag', tag: 'giant' },
      { op: 'addRelation', type: 'composedOf', to: 'feature-0003' },
      { op: 'removeRelation', type: 'composedOf', to: 'f2' },
    ]);
    const after = plan.changes[0]!.after!;
    expect(after.components['Tags']).toEqual({ tags: ['giant'] });
    expect(after.relations).toEqual([{ id: 's1~composedOf-2', type: 'composedOf', to: 'f3' }]);
    expect(plan.changes[0]!.summary).toEqual(['+ tag giant', '+ composedOf → f3', '− composedOf → f2']);
  });

  it('gives a new edge an id no other edge carries', () => {
    const plan = planBulk(seedRegistry, raw, ['s2'], [{ op: 'addRelation', type: 'composedOf', to: 'f3' }]);
    expect(plan.changes[0]!.after!.relations!.map((r) => r.id)).toEqual(['s2~composedOf-1', 's2~composedOf-2']);
  });

  it('merges identical features as variants', () => {
    const plan = planBulk(seedRegistry, raw, ['f1', 'f2', 'f3'], [{ op: 'merge', mode: 'variant', by: 'content' }]);
    expect(plan.changes.map((c) => c.id)).toEqual(['f2']);
    expect(plan.changes[0]!.after!.relations).toEqual([{ id: 'f2~variantOf-1', type: 'variantOf', to: 'f1' }]);
  });

  it('merges by deleting and repoints edges and links onto the one that stays', () => {
    const plan = planBulk(seedRegistry, raw, ['f1', 'f2', 'f3'], [{ op: 'merge', mode: 'delete', by: 'content' }]);
    const nach = new Map(plan.changes.map((c) => [c.id, c]));
    expect(nach.get('f2')!.after).toBeNull();
    expect(nach.get('f2')!.summary[0]).toMatch(/merged into Amphibious \(feature-0001\)/);
    expect(nach.get('s1')!.after!.relations).toEqual([{ id: 's1~composedOf-1', type: 'composedOf', to: 'f1' }]);
    expect(String(nach.get('r1')!.after!.components['Description']!['description'])).toContain('[[feature-0001|Amphibious]]');
    expect(nach.has('f3')).toBe(false);
  });

  it('keeps the one it is told to keep', () => {
    const plan = planBulk(seedRegistry, raw, ['f1', 'f2'], [{ op: 'merge', mode: 'delete', keep: 'feature-0002' }]);
    expect(plan.changes.find((c) => c.after === null)!.id).toBe('f1');
  });

  it('repoint folds edges that become equal into one', () => {
    const doppelt = statblock('s9', 'statblock-0009', 'Two', {}, [
      { id: 'a', type: 'composedOf', to: 'f1' },
      { id: 'b', type: 'composedOf', to: 'f2' },
    ]);
    const neu = repoint([doppelt], new Map([['f2', 'f1']]), new Map());
    expect(neu.get('s9')!.relations).toEqual([{ id: 'a', type: 'composedOf', to: 'f1' }]);
  });
});

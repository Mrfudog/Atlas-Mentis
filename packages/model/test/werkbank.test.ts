import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import { CHECKS, runChecks } from '../src/checks.js';
import { BulkRequestSchema, planBulk, repoint, selectEntities, storedKey } from '../src/bulk.js';
import { linkCandidates, linkFinder } from '../src/entity.js';
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

describe('linkFinder', () => {
  it('answers like linkCandidates', () => {
    const finde = linkFinder(bestand);
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
    expect(BulkRequestSchema.safeParse({ select: {}, ops: [{ op: 'set', field: 'Statblock.token', values: { s1: 'as_1' } }] }).success).toBe(true);
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

  it('sets a value per article and leaves out who is not named (T-144)', () => {
    const plan = planBulk(seedRegistry, raw, ['s1', 's2', 's3'], [
      { op: 'set', field: 'Statblock.token', values: { s1: 'as_1', 'statblock-0003': 'as_3' } },
    ]);
    expect(plan.changes.map((c) => [c.id, c.after!.components['Statblock']!['token']])).toEqual([
      ['s1', 'as_1'],
      ['s3', 'as_3'],
    ]);
  });

  it('refuses a set without value or values', () => {
    const plan = planBulk(seedRegistry, raw, ['s1'], [{ op: 'set', field: 'Statblock.ac' }]);
    expect(plan.changes).toEqual([]);
    expect(plan.skipped.map((p) => p.reason)).toEqual(['Statblock.ac: set needs a value or values']);
  });

  it('with ifEmpty keeps what is already there', () => {
    const plan = planBulk(seedRegistry, raw, ['s1', 's3'], [{ op: 'set', field: 'Statblock.ac', value: '15', ifEmpty: true }]);
    expect(plan.changes.map((c) => c.id)).toEqual(['s3']);
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

  it('adds edges with targets of their own per article (T-212)', () => {
    const plan = planBulk(seedRegistry, raw, ['s1', 's2', 's3'], [
      {
        op: 'addRelation',
        type: 'composedOf',
        targets: { s1: ['feature-0003', 'f2'], 'statblock-0002': [{ to: 'f3', props: { note: 'only here' } }], s4: ['f1'] },
      },
    ]);
    const nach = new Map(plan.changes.map((c) => [c.id, c.after!.relations]));
    /* Was schon steht, kommt nicht doppelt; wer fehlt, bleibt unberührt. */
    expect(nach.get('s1')).toEqual([
      { id: 's1~composedOf-1', type: 'composedOf', to: 'f2' },
      { id: 's1~composedOf-2', type: 'composedOf', to: 'f3' },
    ]);
    expect(nach.get('s2')!.at(-1)).toEqual({ id: 's2~composedOf-2', type: 'composedOf', to: 'f3', props: { note: 'only here' } });
    expect(nach.has('s3')).toBe(false);
    const fehlt = planBulk(seedRegistry, raw, ['s3'], [{ op: 'addRelation', type: 'composedOf', targets: { s3: ['nowhere'] } }]);
    expect(fehlt.skipped.map((x) => x.reason)).toEqual(['composedOf → nowhere: no such article']);
    const beides = planBulk(seedRegistry, raw, ['s3'], [{ op: 'addRelation', type: 'composedOf' }]);
    expect(beides.skipped[0]?.reason).toMatch(/either to or targets/);
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

describe('bulk delete (T-176)', () => {
  const e = (id: string, typ: string, relations: Entity['relations'] = [], components: Entity['components'] = {}): Entity => ({
    id,
    interfaces: [typ],
    name: id,
    components: { ...ident(id, `${typ.toLowerCase()}-${id}`), ...components },
    relations,
  });
  const bestand = new Map(
    [
      e('figur', 'Creature', [{ id: 'figur~c', type: 'carries', to: 'inv' }]),
      e('inv', 'Inventory', [
        { id: 'inv~h1', type: 'holds', to: 'stueck' },
        { id: 'inv~h2', type: 'holds', to: 'seil' },
      ]),
      /* Ein Stück (Instanz) geht mit seinem Inventar, der Grundartikel bleibt. */
      e('stueck', 'Item', [{ id: 'stueck~i', type: 'instanceOf', to: 'seil' }]),
      e('seil', 'Item'),
      /* Eine Instanz der gehenden Vorlage, die bleibt, wird vorher gelöst. */
      e('vorlage', 'Statblock', [], { Statblock: { ac: 12 } }),
      e('wache', 'Statblock', [{ id: 'wache~i', type: 'instanceOf', to: 'vorlage' }], { Statblock: { hp: 9 } }),
      e('board', 'Board', [
        { id: 'board~p1', type: 'placed', to: 'figur', props: { x: 0, y: 0 } },
        { id: 'board~p2', type: 'placed', to: 'seil', props: { x: 1, y: 0 } },
      ]),
    ].map((x) => [x.id, x]),
  );

  it('takes inventory and pieces along, detaches instances, and drops edges into what goes', () => {
    const plan = planBulk(seedRegistry, bestand, ['figur', 'vorlage'], [{ op: 'delete' }]);
    const weg = plan.changes.filter((c) => !c.after).map((c) => c.id).sort();
    expect(weg).toEqual(['figur', 'inv', 'stueck', 'vorlage']);
    expect(plan.changes.find((c) => c.id === 'inv')!.summary).toEqual(['deleted — part of figur (creature-figur)']);
    const nach = new Map(plan.changes.filter((c) => c.after).map((c) => [c.id, c.after!]));
    expect([...nach.keys()].sort()).toEqual(['board', 'wache']);
    expect(nach.get('board')!.relations!.map((r) => r.to)).toEqual(['seil']);
    expect(nach.get('wache')!.relations!.some((r) => r.type === 'instanceOf')).toBe(false);
    expect(nach.get('wache')!.components['Statblock']).toEqual({ ac: 12, hp: 9 });
  });

  it('parses as an op of its own', () => {
    expect(BulkRequestSchema.safeParse({ select: { layer: 'ly' }, ops: [{ op: 'delete' }] }).success).toBe(true);
  });
});

/* T-169: zu jedem benannten Statblock seine Kreatur — erfundene Namen. */
describe('addLinked', () => {
  const ebene: Entity = { id: 'L1', interfaces: ['Layer'], name: 'Book', components: ident('Book', 'layer-0001'), relations: [] };
  const benannt = statblock('sb1', 'statblock-0011', 'Morwen Ashgrove (Wraith Form)', { ac: 14 }, [
    { id: 'sb1~inLayer-1', type: 'inLayer', to: 'L1' },
  ]);
  benannt.components['Source'] = { publication: 'XYZ', page: '12', srd: false };
  benannt.components['Status'] = { status: 'ready' };
  const kreatur: Entity = { id: 'c9', interfaces: ['Creature'], name: 'Tobin', components: ident('Tobin', 'creature-0007'), relations: [] };
  const vergeben = statblock('sb2', 'statblock-0012', 'Tobin', { ac: 10 }, [{ id: 'sb2~belongsTo-1', type: 'belongsTo', to: 'c9' }]);
  const raw = new Map([ebene, benannt, kreatur, vergeben].map((e) => [e.id, e] as const));
  const op = {
    op: 'addLinked' as const,
    type: 'Creature',
    relation: 'belongsTo',
    fields: { 'Creature.kind': 'npc' },
    copy: ['Source', 'Status'],
    stripBracket: true,
  };

  it('legt die Kreatur in derselben Ebene an und hängt den Statblock an sie', () => {
    expect(BulkRequestSchema.safeParse({ select: { tag: 'named' }, ops: [op] }).success).toBe(true);
    const plan = planBulk(seedRegistry, raw, ['sb1'], [op, { op: 'addTag', tag: 'named' }]);
    const neu = plan.changes.find((c) => c.before === null)!.after!;
    expect(neu.id).toBe('sb1-creature');
    expect(neu.name).toBe('Morwen Ashgrove');
    expect(neu.components['Identity']).toEqual({ name: 'Morwen Ashgrove', id: 'creature-0008' });
    expect(neu.components['Creature']).toEqual({ kind: 'npc' });
    expect(neu.components['Source']).toEqual({ publication: 'XYZ', page: '12', srd: false });
    expect(neu.relations).toEqual([{ id: 'sb1-creature~inLayer-1', type: 'inLayer', to: 'L1' }]);
    const sb = plan.changes.find((c) => c.id === 'sb1')!.after!;
    expect(sb.relations?.find((r) => r.type === 'belongsTo')?.to).toBe('sb1-creature');
    expect(sb.components['Tags']).toEqual({ tags: ['named'] });
  });

  it('lässt einen Statblock, der schon einer Kreatur gehört, stehen', () => {
    const plan = planBulk(seedRegistry, raw, ['sb2'], [op]);
    expect(plan.changes).toEqual([]);
    expect(plan.skipped[0]?.reason).toMatch(/already has a belongsTo \(Tobin/);
  });

  it('zählt die Nummern innerhalb eines Laufs weiter', () => {
    const zweiter = statblock('sb3', 'statblock-0013', 'Ilse', {}, []);
    const r2 = new Map([...raw, ['sb3', zweiter] as const]);
    const plan = planBulk(seedRegistry, r2, ['sb1', 'sb3'], [op]);
    const nummern = plan.changes.filter((c) => c.before === null).map((c) => (c.after!.components['Identity'] as { id: string }).id);
    expect(nummern.sort()).toEqual(['creature-0008', 'creature-0009']);
  });
});

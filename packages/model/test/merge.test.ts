import { describe, expect, it } from 'vitest';
import { mergeEntity } from '../src/merge.js';
import type { Entity } from '../src/types.js';

/* REQ-192: zwei Geräte, ein Artikel. Was nur eine Seite geändert hat,
   kommt zusammen; was beide verschieden geändert haben, ist ein Konflikt. */

const basis: Entity = {
  id: 'p1',
  interfaces: ['Place'],
  name: 'Kerzengasse',
  components: {
    Identity: { name: 'Kerzengasse', id: 'place-0001', aliases: [] },
    Description: { description: 'Eine Gasse.' },
    Status: { status: 'idea' },
  },
  relations: [{ id: 'r1', type: 'inLayer', to: 'ly', props: {} }],
  revision: 3,
};
const mit = (aenderung: (e: Entity) => void, revision?: number): Entity => {
  const e = structuredClone(basis);
  aenderung(e);
  if (revision !== undefined) e.revision = revision;
  return e;
};

describe('mergeEntity', () => {
  it('nimmt verschiedene Felder von beiden Seiten', () => {
    const meins = mit((e) => {
      e.components['Description']!['description'] = 'Eine enge Gasse.';
    });
    const ihres = mit((e) => {
      e.components['Status']!['status'] = 'prepared';
    }, 4);
    const r = mergeEntity(basis, meins, ihres);
    expect(r.conflicts).toEqual([]);
    expect(r.taken).toEqual(['Status.status']);
    expect(r.merged.components['Description']!['description']).toBe('Eine enge Gasse.');
    expect(r.merged.components['Status']!['status']).toBe('prepared');
    expect(r.merged.revision).toBe(4);
  });

  it('meldet dasselbe Feld, verschieden geändert, als Konflikt — und nimmt sonst meins', () => {
    const meins = mit((e) => {
      e.components['Description']!['description'] = 'Meins.';
    });
    const ihres = mit((e) => {
      e.components['Description']!['description'] = 'Ihres.';
    }, 4);
    const r = mergeEntity(basis, meins, ihres);
    expect(r.conflicts.map((c) => c.key)).toEqual(['Description.description']);
    expect(r.conflicts[0]).toMatchObject({ base: 'Eine Gasse.', mine: 'Meins.', theirs: 'Ihres.' });
    expect(r.merged.components['Description']!['description']).toBe('Meins.');
    const gewaehlt = mergeEntity(basis, meins, ihres, { 'Description.description': 'theirs' });
    expect(gewaehlt.merged.components['Description']!['description']).toBe('Ihres.');
  });

  it('gleich geändert ist kein Konflikt', () => {
    const beide = (e: Entity) => {
      e.name = 'Kerzengasse, neu';
    };
    const r = mergeEntity(basis, mit(beide), mit(beide, 4));
    expect(r.conflicts).toEqual([]);
    expect(r.merged.name).toBe('Kerzengasse, neu');
  });

  it('ein geleertes Feld ist eine Änderung', () => {
    const meins = mit((e) => {
      delete e.components['Description']!['description'];
    });
    const r = mergeEntity(basis, meins, mit(() => undefined, 4));
    expect(r.merged.components['Description']).toEqual({});
    const ihres = mit((e) => {
      e.components['Description']!['description'] = 'Ihres.';
    }, 4);
    expect(mergeEntity(basis, meins, ihres).conflicts.map((c) => c.key)).toEqual(['Description.description']);
  });

  it('führt Kanten nach ihrer Id zusammen', () => {
    const meins = mit((e) => {
      e.relations!.push({ id: 'r2', type: 'locatedIn', to: 'stadt', props: {} });
    });
    const ihres = mit((e) => {
      e.relations = [{ id: 'r3', type: 'mentions', to: 'npc', props: {} }];
    }, 4);
    const r = mergeEntity(basis, meins, ihres);
    expect(r.conflicts).toEqual([]);
    expect(r.merged.relations!.map((k) => k.id)).toEqual(['r3', 'r2']);
  });
});

import { describe, expect, it } from 'vitest';
import {
  backlinks,
  findByName,
  relationAccepts,
  relationDef,
  setTags,
  splitRelations,
  tagsOf,
} from '../src/entity.js';
import { validateEntity } from '../src/validate.js';
import type { Entity, Registry } from '../src/types.js';

const registry: Registry = {
  interfaces: {
    Identity: {
      name: 'Identity',
      abstract: true,
      schema: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          key: { type: 'string' },
          aliases: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    NPC: {
      name: 'NPC',
      extends: ['Identity'],
      schema: { type: 'object', properties: { rolle: { type: 'string' } } },
    },
    /* Eigener Obertyp, damit `StatblockInfo` eine Karte bleibt — dieselbe
       Form wie im echten Register. */
    StatblockInfo: {
      name: 'StatblockInfo',
      abstract: true,
      schema: {
        type: 'object',
        required: ['system'],
        properties: { system: { type: 'string' }, ac: { type: 'number' } },
      },
    },
    Statblock: { name: 'Statblock', extends: ['Identity', 'StatblockInfo'] },
  },
  relations: {
    schuldet: { type: 'schuldet', label: 'schuldet', inverseLabel: 'Gläubiger von', from: ['NPC'], to: ['NPC'] },
    composedOf: { type: 'composedOf', label: 'besteht aus', inverseLabel: 'verwendet in', from: ['Statblock'], to: ['*'], section: 'Aktionen' },
  },
  views: {},
  vars: {},
};

const volo: Entity = {
  id: 'n_volo',
  interfaces: ['NPC'],
  name: 'Volo Geddarm',
  components: {
    Identity: { name: 'Volo Geddarm', key: 'npc/volo', aliases: ['Volothamp Geddarm', 'Der Dicke'] },
  },
  relations: [{ id: 'r1', type: 'schuldet', to: 'n_floon', props: { note: '80 Drachen' } }],
};

const floon: Entity = {
  id: 'n_floon',
  interfaces: ['NPC'],
  name: 'Floon Blagmaar',
  components: { Identity: { name: 'Floon Blagmaar' } },
};

describe('backlinks', () => {
  it('derives the reverse direction with the inverse label', () => {
    const found = backlinks(registry, [volo, floon], 'n_floon');
    expect(found).toHaveLength(1);
    expect(found[0]!.from.id).toBe('n_volo');
    expect(found[0]!.def.inverseLabel).toBe('Gläubiger von');
  });

  it('is empty when nothing points at the entity', () => {
    expect(backlinks(registry, [volo, floon], 'n_volo')).toEqual([]);
  });

  it('cannot go stale, because only one direction is stored', () => {
    // Floon carries no edge of its own; the relationship exists once, on Volo.
    expect(floon.relations ?? []).toEqual([]);
    expect(backlinks(registry, [volo, floon], 'n_floon')).toHaveLength(1);
  });
});

describe('findByName', () => {
  it('matches the name and every alias, case-insensitively', () => {
    expect(findByName([volo, floon], 'volo geddarm')?.id).toBe('n_volo');
    expect(findByName([volo, floon], 'Der Dicke')?.id).toBe('n_volo');
    expect(findByName([volo, floon], 'niemand')).toBeUndefined();
    expect(findByName([volo, floon], '')).toBeUndefined();
  });
});

describe('relationAccepts', () => {
  it('honours explicit targets, wildcards and `same`', () => {
    expect(relationAccepts(registry.relations['schuldet']!, 'NPC', 'NPC')).toBe(true);
    expect(relationAccepts(registry.relations['schuldet']!, 'NPC', 'Statblock')).toBe(false);
    expect(relationAccepts(registry.relations['composedOf']!, 'Statblock', 'NPC')).toBe(true);
    expect(relationAccepts({ type: 'x', label: 'x', inverseLabel: 'y', to: ['same'] }, 'Ort', 'Ort')).toBe(true);
    expect(relationAccepts({ type: 'x', label: 'x', inverseLabel: 'y', to: ['same'] }, 'Ort', 'NPC')).toBe(false);
  });
});

describe('relationDef', () => {
  it('invents a readable fallback for an unregistered type', () => {
    const def = relationDef(registry, 'gibtsnicht');
    expect(def.label).toBe('gibtsnicht');
    expect(def.inverseLabel).toContain('gibtsnicht');
  });
});

describe('splitRelations', () => {
  it('separates composition sections from plain references', () => {
    const statblock: Entity = {
      id: 'sb', interfaces: ['Statblock'], name: 'Schleim',
      components: { Identity: { name: 'Schleim' }, StatblockInfo: { system: 'dnd5e' } },
      relations: [
        { id: 'a', type: 'composedOf', to: 'r_amorph' },
        { id: 'b', type: 'schuldet', to: 'n_floon' },
      ],
    };
    const { sections, plain } = splitRelations(registry, statblock);
    expect(Object.keys(sections)).toEqual(['Aktionen']);
    expect(plain.map((r) => r.id)).toEqual(['b']);
  });
});

describe('validateEntity', () => {
  it('accepts a well-formed entity', () => {
    expect(validateEntity(registry, volo)).toEqual([]);
  });

  /* Eine fehlende Karte ist kein eigener Fall mehr: wo sie fehlt, fehlen
     ihre Pflichtfelder, und genau das steht da. */
  it('reports the required fields of a card that is not there at all', () => {
    const broken: Entity = { ...volo, interfaces: ['Statblock'], components: { Identity: { name: 'x' } } };
    const issue = validateEntity(registry, broken).find((i) => i.code === 'missing_property');
    expect(issue?.component).toBe('StatblockInfo');
    expect(issue?.property).toBe('system');
  });

  it('reports a missing required property', () => {
    const broken: Entity = {
      id: 'sb', interfaces: ['Statblock'], name: 'x',
      components: { Identity: { name: 'x' }, StatblockInfo: {} },
    };
    const issue = validateEntity(registry, broken).find((i) => i.code === 'missing_property');
    expect(issue?.property).toBe('system');
  });

  it('refuses a card whose type this article does not inherit, and relents in expert mode (D2)', () => {
    const odd: Entity = {
      ...volo,
      components: { ...volo.components, StatblockInfo: { system: 'dnd5e' } },
    };
    expect(validateEntity(registry, odd).map((i) => i.code)).toContain('card_not_inherited');
    expect(validateEntity(registry, odd, { expertMode: true }).map((i) => i.code)).not.toContain(
      'card_not_inherited',
    );
  });

  it('reports an edge pointing at nothing', () => {
    const known = new Set(['n_volo']);
    const codes = validateEntity(registry, volo, { knownIds: known }).map((i) => i.code);
    expect(codes).toContain('dangling_relation');
  });

  it('reports an unknown interface instead of throwing', () => {
    const alien: Entity = { ...volo, interfaces: ['Vogelscheuche'] };
    expect(validateEntity(registry, alien)).toEqual([
      expect.objectContaining({ code: 'unknown_interface' }),
    ]);
  });
});

/* Marken waren die einzige Eigenschaft, die keiner Art gehörte — und damit
   die einzige, die man nirgends weglassen konnte. Jetzt ist es ein
   Bestandteil, und `abwesend` heisst „trägt keine Marken", nicht „hat
   gerade keine". */
describe('tagsOf / setTags', () => {
  it('reads the tags from the card and never throws on an article without one', () => {
    expect(tagsOf({ id: 'x', interfaces: ['NPC'], name: 'x', components: {} })).toEqual([]);
    expect(tagsOf(undefined)).toEqual([]);
    expect(
      tagsOf({
        id: 'x', interfaces: ['NPC'], name: 'x',
        components: { Tags: { tags: ['händler', 'stadt'] } },
      }),
    ).toEqual(['händler', 'stadt']);
  });

  it('writes them back, trims them, and drops the card when nothing is left', () => {
    const e: Entity = { id: 'x', interfaces: ['NPC'], name: 'x', components: {} };
    setTags(e, [' händler ', '', 'stadt']);
    expect(e.components['Tags']).toEqual({ tags: ['händler', 'stadt'] });
    setTags(e, []);
    expect(e.components['Tags']).toBeUndefined();
  });
});

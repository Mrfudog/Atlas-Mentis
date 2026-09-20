import { describe, expect, it } from 'vitest';
import {
  covers,
  informationsOf,
  knowledgeGroups,
  knowledgeHolders,
  knows,
  visibleFields,
} from '../src/knowledge.js';
import type { Entity, EntityId, Registry } from '../src/types.js';

const registry: Pick<Registry, 'interfaces'> = {
  interfaces: {
    Base: { name: 'Base', abstract: true },
    NPC: { name: 'NPC', extends: ['Base'] },
    PlayerCharacter: { name: 'PlayerCharacter', extends: ['Base'] },
    Party: { name: 'Party', extends: ['Base'] },
    KnowledgeLevel: { name: 'KnowledgeLevel', extends: ['Base'] },
    Information: { name: 'Information', extends: ['Base'] },
  },
};

function entity(id: string, name: string, extra: Partial<Entity> = {}): Entity {
  return {
    id,
    interfaces: ['NPC'],
    name,
    tags: [],
    components: { Base: { text: name } },
    ...extra,
  };
}

/** Der Baron: ein offenes Feld, ein Gerücht, ein Geheimnis. */
const trueName = entity('i_name', 'Sein wahrer Name', {
  interfaces: ['Information'],
  components: {
    Base: { text: 'Sein wahrer Name' },
    Information: { fields: ['Base.aliases'], tier: 'secret' },
  },
  relations: [{ id: 'r1', type: 'knownBy', to: 'pc_mara' }],
});

const rumour = entity('i_debt', 'Seine Schulden', {
  interfaces: ['Information'],
  components: {
    Base: { text: 'Seine Schulden' },
    Information: { fields: ['Creature'], blocks: ['b_secret'], tier: 'rumour' },
  },
  relations: [{ id: 'r2', type: 'knownBy', to: 'kl_street' }],
});

const baron = entity('n_baron', 'Der Baron', {
  blocks: [
    { id: 'b_open', blockType: 'paragraph', body: 'Er trägt Grau.', order: 1 },
    { id: 'b_secret', blockType: 'secret', body: 'Er schuldet der Gilde.', order: 2 },
  ],
  relations: [
    { id: 'r3', type: 'knowledge', to: 'i_name' },
    { id: 'r4', type: 'knowledge', to: 'i_debt' },
  ],
});

const mara = entity('pc_mara', 'Mara', {
  interfaces: ['PlayerCharacter'],
  relations: [{ id: 'r5', type: 'memberOfParty', to: 'p_wacht' }],
});
const torn = entity('pc_torn', 'Torn', {
  interfaces: ['PlayerCharacter'],
  relations: [{ id: 'r6', type: 'atLevel', to: 'kl_street' }],
});
const party = entity('p_wacht', 'Die Wacht', { interfaces: ['Party'] });
const street = entity('kl_street', 'Gassenwissen', { interfaces: ['KnowledgeLevel'] });

const entities = new Map<EntityId, Entity>(
  [baron, trueName, rumour, mara, torn, party, street].map((e) => [e.id, e]),
);

const ALL = ['Base.key', 'Base.aliases', 'Creature.attitude', 'StatblockInfo.ac'];

describe('knowledge', () => {
  it('findet die Informationen am Artikel', () => {
    expect(informationsOf(entities, baron).map((i) => i.id)).toEqual(['i_name', 'i_debt']);
  });

  it('beansprucht ein Feld einzeln und eine Art ganz', () => {
    expect(covers(trueName, 'Base', 'aliases')).toBe(true);
    expect(covers(trueName, 'Base', 'key')).toBe(false);
    /* `Creature` ohne Punkt nimmt jedes Feld, das diese Art erklärt. */
    expect(covers(rumour, 'Creature', 'attitude')).toBe(true);
  });

  it('zählt Gruppe und Wissensstand zum Betrachter', () => {
    expect([...knowledgeHolders(entities, 'pc_mara')].sort()).toEqual(['p_wacht', 'pc_mara']);
    expect([...knowledgeHolders(entities, 'pc_torn')].sort()).toEqual(['kl_street', 'pc_torn']);
  });

  it('kennt direkt und über den Wissensstand', () => {
    expect(knows(entities, trueName, 'pc_mara')).toBe(true);
    expect(knows(entities, trueName, 'pc_torn')).toBe(false);
    expect(knows(entities, rumour, 'pc_torn')).toBe(true);
    /* Ohne Betrachter ist es die Spielleitung. */
    expect(knows(entities, trueName)).toBe(true);
  });

  it('stellt das Offene voran und beansprucht den Rest', () => {
    const groups = knowledgeGroups(registry, entities, baron, ALL);
    expect(groups[0]?.open).toBe(true);
    expect(groups[0]?.fields).toEqual(['Base.key', 'StatblockInfo.ac']);
    expect(groups[0]?.blocks).toEqual(['b_open']);
    expect(groups.map((g) => g.label)).toEqual(['Open', 'Sein wahrer Name', 'Seine Schulden']);
    expect(groups[2]?.blocks).toEqual(['b_secret']);
  });

  it('zeigt einem Betrachter das Offene plus sein Wissen', () => {
    expect(visibleFields(registry, entities, baron, ALL, 'pc_mara')).toEqual([
      'Base.key',
      'Base.aliases',
      'StatblockInfo.ac',
    ]);
    expect(visibleFields(registry, entities, baron, ALL, 'pc_torn')).toEqual([
      'Base.key',
      'Creature.attitude',
      'StatblockInfo.ac',
    ]);
    /* Ein Fremder sieht nur, was keine Information beansprucht. */
    expect(visibleFields(registry, entities, baron, ALL, 'pc_niemand')).toEqual([
      'Base.key',
      'StatblockInfo.ac',
    ]);
    /* Und die Spielleitung alles. */
    expect(visibleFields(registry, entities, baron, ALL)).toEqual(ALL);
  });
});

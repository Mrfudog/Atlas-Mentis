import { describe, expect, it } from 'vitest';
import { summaryFields, summaryOf } from '../src/summary.js';
import type { Entity, Registry } from '../src/types.js';

/* Eine Auswahl, die eine Art nennt und nach einem Feld filtert (M6): das
   Feld muss in der Kurzfassung stehen, sonst bietet die Maske nichts an. */
const registry = {
  interfaces: {
    Recipe: {
      name: 'Recipe',
      schema: {
        type: 'object',
        properties: {
          tool: { type: 'string', enumRef: 'Item', enumWhere: { Item: { itemType: ['tool'] } } },
        },
      },
    },
  },
} as unknown as Pick<Registry, 'interfaces'>;

const hammer: Entity = {
  id: 'e1',
  interfaces: ['Item'],
  name: 'Hammer',
  components: {
    Identity: { name: 'Hammer', id: 'itm-0001', aliases: ['Klopfer'] },
    Item: { itemType: 'tool', weight: 3, rows: ['##'] },
    Description: { description: 'lang' },
  },
  relations: [
    { id: 'r1', type: 'instanceOf', to: 'e0', props: {} },
    { id: 'r2', type: 'inLayer', to: 'ly', props: {} },
  ],
};

describe('summaryOf', () => {
  it('reads the filter fields from the registry', () => {
    expect([...summaryFields(registry)]).toEqual(['itemType']);
  });

  it('keeps identity, the filter fields and instanceOf, and nothing else', () => {
    const k = summaryOf(hammer, summaryFields(registry));
    expect(k.components).toEqual({
      Identity: { name: 'Hammer', id: 'itm-0001', aliases: ['Klopfer'] },
      Item: { itemType: 'tool' },
    });
    expect(k.relations?.map((r) => r.type)).toEqual(['instanceOf']);
  });
});

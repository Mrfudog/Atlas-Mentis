import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import { CHECKS } from '../src/checks.js';
import { UNASSIGNED_LAYER, UNKNOWN_PUBLISHER } from '../src/stack.js';
import type { Entity } from '../src/types.js';

/* T-425, E-182, E-186: die Werkbank führt, was in „Unassigned“ liegt oder gar keine Ebene hat. */
const art = (id: string, typ: string, layers: string[] = [], mehr: Partial<Entity> = {}): Entity => ({
  id, name: id, interfaces: [typ], components: {}, relations: layers.map((l, i) => ({ id: `${id}~in${i}`, type: 'inLayer', to: l })), ...mehr,
});

describe('Werkbank: Unassigned', () => {
  const c = CHECKS.find((x) => x.key === 'unassigned')!;
  it('listet Artikel in Unassigned und ohne Ebene, nicht Ebenen, Regelsysteme und Instanzen', () => {
    const treffer = c.run({
      registry: seedRegistry,
      entities: [
        art('geparkt', 'Creature', [UNASSIGNED_LAYER]),
        art('heimatlos', 'Asset'),
        art('richtig', 'Creature', ['ly_a']),
        art('ebene', 'Layer'),
        art('system', 'RuleSystem'),
        art(UNASSIGNED_LAYER, 'Layer'),
        art('stueck', 'Item', [], { relations: [{ id: 'i', type: 'instanceOf', to: 'richtig' }] }),
      ],
      exists: new Map(),
    } as never);
    expect(treffer.map((t) => [t.id, t.reason])).toEqual([
      ['geparkt', 'in Unassigned'],
      ['heimatlos', 'no layer'],
    ]);
  });
  it('der Herausgeber ohne Gruppe heisst Unknown, nicht mehr Unassigned', () => {
    expect(UNKNOWN_PUBLISHER).toBe('Unknown');
  });
});

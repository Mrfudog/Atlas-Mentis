import { describe, expect, it } from 'vitest';
import {
  hasEdgeChoices,
  hasFieldAllowed,
  hasFieldChoices,
  hasTermText,
  matchesHas,
  parseHasTerm,
  type HasFacts,
  type Registry,
} from '../src/index.js';

/* Ein kleines Register: ein Gegenstand mit Form, eine Kreatur, eine Fraktion. */
const reg = {
  interfaces: {
    Identity: { name: 'Identity', schema: { type: 'object', properties: { name: { type: 'string' }, aliases: { type: 'string', many: true } } } },
    Item: {
      name: 'Item',
      extends: ['Identity'],
      schema: {
        type: 'object',
        properties: {
          rows: { type: 'string', format: 'grid', title: 'Shape' },
          weight: { type: 'number' },
          total: { type: 'number', derived: 'weight * 2' },
        },
      },
    },
    Weapon: { name: 'Weapon', extends: ['Item'], schema: { type: 'object', properties: { damage: { type: 'string' } } } },
    Creature: { name: 'Creature', extends: ['Identity'], schema: { type: 'object', properties: { kind: { type: 'string' } } } },
    Faction: { name: 'Faction', extends: ['Identity'], schema: { type: 'object', properties: {} } },
  },
  relations: {
    memberOf: { type: 'memberOf', label: 'member of', inverseLabel: 'members', from: ['Creature'], to: ['Faction'] },
    carries: { type: 'carries', label: 'carries', inverseLabel: 'carried by', from: ['Creature'], to: ['Item'] },
    overrides: { type: 'overrides', label: 'replaces', inverseLabel: 'replaced by', from: ['*'], to: ['*'] },
    inLayer: { type: 'inLayer', label: 'in layer', inverseLabel: 'contains', from: ['*'], to: ['Layer'] },
  },
} as unknown as Registry;

function fakten(kanten: Record<string, string[]>, felder: string[] = []): HasFacts {
  return {
    edges: (dir, type) => kanten[`${dir}.${type}`] ?? [],
    field: (type, key) => felder.includes(`${type}.${key}`),
  };
}

describe('parseHasTerm (T-389)', () => {
  it('liest hat, hat nicht, Ziel und Anzahl', () => {
    expect(parseHasTerm('out.memberOf')).toEqual({ ref: 'out.memberOf', not: false });
    expect(parseHasTerm('!in.carries')).toEqual({ ref: 'in.carries', not: true });
    expect(parseHasTerm('out.memberOf=fac-1')).toEqual({ ref: 'out.memberOf', not: false, to: 'fac-1' });
    expect(parseHasTerm('out.carries>=3')).toEqual({ ref: 'out.carries', not: false, min: 3 });
    expect(parseHasTerm('out.carries<=0')).toEqual({ ref: 'out.carries', not: false, max: 0 });
    expect(parseHasTerm('Item.rows')).toEqual({ ref: 'Item.rows', not: false });
    expect(parseHasTerm('!Item.rows')).toEqual({ ref: 'Item.rows', not: true });
  });

  it('Unsinn gilt nicht', () => {
    for (const s of ['', '!', 'memberOf', 'out.', 'out.carries>=x', 'out.carries>=', 'Item.rows=3', 'Item.rows>=1', 'a.b.c']) {
      expect(parseHasTerm(s), s).toBeNull();
    }
  });

  it('geht hin und zurück', () => {
    for (const s of ['out.memberOf', '!in.carries', 'out.memberOf=fac-1', 'out.carries>=3', 'out.carries<=2', '!Item.rows']) {
      expect(hasTermText(parseHasTerm(s)!)).toBe(s);
    }
  });
});

describe('matchesHas (T-389)', () => {
  const f = fakten({ 'out.memberOf': ['fac-1'], 'out.carries': ['it-1', 'it-2', 'it-1'] }, ['Item.rows']);

  it('hat / hat nicht', () => {
    expect(matchesHas(parseHasTerm('out.memberOf')!, f)).toBe(true);
    expect(matchesHas(parseHasTerm('!out.memberOf')!, f)).toBe(false);
    expect(matchesHas(parseHasTerm('in.memberOf')!, f)).toBe(false);
    expect(matchesHas(parseHasTerm('!in.memberOf')!, f)).toBe(true);
  });

  it('zu einem bestimmten Artikel', () => {
    expect(matchesHas(parseHasTerm('out.memberOf=fac-1')!, f)).toBe(true);
    expect(matchesHas(parseHasTerm('out.memberOf=fac-2')!, f)).toBe(false);
    expect(matchesHas(parseHasTerm('!out.memberOf=fac-2')!, f)).toBe(true);
  });

  it('mindestens und höchstens — gezählt werden Kanten, nicht Ziele', () => {
    expect(matchesHas(parseHasTerm('out.carries>=3')!, f)).toBe(true);
    expect(matchesHas(parseHasTerm('out.carries>=4')!, f)).toBe(false);
    expect(matchesHas(parseHasTerm('out.carries<=2')!, f)).toBe(false);
    expect(matchesHas(parseHasTerm('out.memberOf<=0')!, fakten({}))).toBe(true);
  });

  it('ein Feld', () => {
    expect(matchesHas(parseHasTerm('Item.rows')!, f)).toBe(true);
    expect(matchesHas(parseHasTerm('Item.weight')!, f)).toBe(false);
    expect(matchesHas(parseHasTerm('!Item.weight')!, f)).toBe(true);
  });
});

describe('hasEdgeChoices (T-389)', () => {
  it('nur die Kanten, die für die Art gelten, in beide Richtungen, ohne Ebenenkante', () => {
    expect(hasEdgeChoices(reg, ['Creature']).map((c) => c.ref)).toEqual(['out.memberOf', 'out.carries', 'out.overrides', 'in.overrides']);
    /* Die Waffe ist ein Gegenstand (extends). */
    expect(hasEdgeChoices(reg, ['Weapon']).map((c) => c.ref)).toEqual(['in.carries', 'out.overrides', 'in.overrides']);
    expect(hasEdgeChoices(reg, ['Faction']).find((c) => c.ref === 'in.memberOf')?.label).toBe('members');
  });

  it('mehrere Arten: was für alle gilt; ohne Art alle', () => {
    expect(hasEdgeChoices(reg, ['Creature', 'Faction']).map((c) => c.ref)).toEqual(['out.overrides', 'in.overrides']);
    expect(hasEdgeChoices(reg, []).map((c) => c.ref)).toContain('in.memberOf');
    expect(hasEdgeChoices(reg, []).map((c) => c.ref)).not.toContain('out.inLayer');
  });
});

describe('hasFieldChoices (T-389)', () => {
  it('ohne gerechnete, ohne many, ohne den Namen; geerbte mit', () => {
    expect(hasFieldChoices(reg, ['Weapon']).map((c) => c.ref)).toEqual(['Weapon.damage', 'Item.rows', 'Item.weight']);
    expect(hasFieldChoices(reg, ['Item']).find((c) => c.ref === 'Item.rows')?.label).toBe('Shape');
  });

  it('mehrere Arten: die gemeinsamen; keine Art: keine', () => {
    expect(hasFieldChoices(reg, ['Weapon', 'Item']).map((c) => c.ref)).toEqual(['Item.rows', 'Item.weight']);
    expect(hasFieldChoices(reg, [])).toEqual([]);
  });

  it('der Server prüft dieselbe Regel', () => {
    expect(hasFieldAllowed(reg, 'Item', 'rows')).toBe(true);
    expect(hasFieldAllowed(reg, 'Item', 'total')).toBe(false);
    expect(hasFieldAllowed(reg, 'Identity', 'aliases')).toBe(false);
    expect(hasFieldAllowed(reg, 'Item', 'nope')).toBe(false);
  });
});

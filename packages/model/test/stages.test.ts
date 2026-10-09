import { describe, expect, it } from 'vitest';
import { stageBases, validateEntity } from '../src/validate.js';
import type { Entity, Registry } from '../src/types.js';

/* D48: höchstens eine Stufe je Grundzustand; M9: ein Override bleibt in
   seiner Art. */
const registry: Registry = {
  interfaces: {
    Condition: { name: 'Condition', schema: { type: 'object', properties: {} } },
    Creature: {
      name: 'Creature',
      schema: {
        type: 'object',
        properties: {
          conditions: {
            type: 'array', format: 'link', items: { type: 'string' },
            target: { interfaces: ['Condition'] },
          },
        },
      },
    },
    Encounter: { name: 'Encounter', schema: { type: 'object', properties: {} } },
    Spell: { name: 'Spell', schema: { type: 'object', properties: {} } },
  },
  relations: {
    stageOf: { type: 'stageOf', from: ['Condition'], to: ['Condition'] },
    participates: { type: 'participates', from: ['Encounter'], to: ['Creature'] },
    overrides: { type: 'overrides', from: ['*'], to: ['*'] },
  },
  views: {},
  units: {},
  enums: {},
  vars: {},
  settings: {},
} as unknown as Registry;

const e = (id: string, type: string, extra: Partial<Entity> = {}): Entity =>
  ({ id, interfaces: [type], components: {}, ...extra }) as Entity;

const stage = (id: string, base: string) =>
  e(id, 'Condition', { relations: [{ type: 'stageOf', to: base }] as Entity['relations'] });

const bestand = [
  e('c-exh', 'Condition'), stage('c-exh2', 'c-exh'), stage('c-exh3', 'c-exh'),
  e('c-prone', 'Condition'),
];
const known = new Map(bestand.map((x) => [x.id, x.interfaces![0]] as const));
const stageOf = stageBases(bestand);

const creature = (conditions: string[]) =>
  e('npc-1', 'Creature', { components: { Creature: { conditions } } });

describe('höchstens eine Stufe je Grundzustand', () => {
  it('sammelt die Stufen aus den Kanten', () => {
    expect(stageOf.get('c-exh3')).toBe('c-exh');
    expect(stageOf.has('c-prone')).toBe(false);
  });

  it('lässt eine Stufe und einen anderen Zustand zu', () => {
    const issues = validateEntity(registry, creature(['c-exh2', 'c-prone']), { knownTypes: known, stageOf });
    expect(issues.map((i) => i.code)).not.toContain('condition_stage_twice');
  });

  it('lehnt zwei Stufen desselben Grundzustands ab', () => {
    const issues = validateEntity(registry, creature(['c-exh2', 'c-exh3']), { knownTypes: known, stageOf });
    expect(issues.map((i) => i.code)).toContain('condition_stage_twice');
  });

  it('prüft auch die Zustände einer Teilnahme am Kampf', () => {
    const kampf = e('enc-1', 'Encounter', {
      relations: [{
        type: 'participates', to: 'npc-1',
        props: { conditions: [{ rule: 'c-exh2' }, { rule: 'c-exh3' }] },
      }] as Entity['relations'],
    });
    const issues = validateEntity(registry, kampf, {
      knownTypes: new Map([...known, ['npc-1', 'Creature']]), stageOf,
    });
    expect(issues.map((i) => i.code)).toContain('condition_stage_twice');
  });

  it('lässt die Regel ruhen, wenn niemand die Stufen mitgibt', () => {
    const issues = validateEntity(registry, creature(['c-exh2', 'c-exh3']), { knownTypes: known });
    expect(issues.map((i) => i.code)).not.toContain('condition_stage_twice');
  });
});

describe('overrides bleibt in einer Art', () => {
  const k = new Map([['sp-a', 'Spell'], ['sp-b', 'Spell'], ['c-1', 'Condition']]);
  const ueber = (to: string) =>
    e('sp-b', 'Spell', { relations: [{ type: 'overrides', to }] as Entity['relations'] });

  it('nimmt dieselbe Art', () => {
    expect(validateEntity(registry, ueber('sp-a'), { knownTypes: k }).map((i) => i.code))
      .not.toContain('overrides_other_type');
  });

  it('lehnt eine andere Art ab', () => {
    expect(validateEntity(registry, ueber('c-1'), { knownTypes: k }).map((i) => i.code))
      .toContain('overrides_other_type');
  });
});

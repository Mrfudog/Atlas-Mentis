import { describe, expect, it } from 'vitest';
import { redactEntity } from '../src/knowledge.js';
import type { Entity, EntityId, Registry } from '../src/types.js';

/* Rätsel einer Begegnung (T-184): Lösung und Hinweise gehören der Leitung
   (`gmFields`), ein Hinweis geht einzeln an den Tisch, sobald eine
   bekannte Information ihn nennt. */
const registry: Pick<Registry, 'interfaces'> = {
  interfaces: {
    Identity: { name: 'Identity', abstract: true },
    Encounter: {
      name: 'Encounter',
      extends: ['Identity'],
      schema: {
        type: 'object',
        properties: {
          kind: { type: 'array', items: { type: 'string' } },
          solution: { type: 'string', format: 'long' },
          hint: { type: 'string', format: 'long', many: true },
        },
      },
    },
    Information: { name: 'Information', extends: ['Identity'] },
    PlayerCharacter: { name: 'PlayerCharacter', extends: ['Identity'] },
  },
};

const raetsel: Entity = {
  id: 'enc-1',
  interfaces: ['Encounter'],
  components: {
    Identity: { name: 'The singing door' },
    Encounter: {
      kind: ['puzzle'],
      solution: 'Hum the lullaby backwards.',
      hint: [
        { id: 'h_lied', value: 'The innkeeper hums a strange tune.' },
        { id: 'h_rueck', value: 'The mural is painted in mirror image.' },
      ],
    },
  },
  relations: [{ id: 'k1', type: 'knowledge', to: 'i-1' }],
};
const info: Entity = {
  id: 'i-1',
  interfaces: ['Information'],
  components: { Identity: { name: 'Tune' }, Information: { fields: ['Encounter.hint#h_lied'] } },
  relations: [{ id: 'kb', type: 'knownBy', to: 'pc-1' }],
};
const pc: Entity = { id: 'pc-1', interfaces: ['PlayerCharacter'], components: { Identity: { name: 'Mara' } } };
const bestand = new Map<EntityId, Entity>([raetsel, info, pc].map((e) => [e.id, e]));

describe('Rätsel: Lösung und Hinweise', () => {
  it('ohne Freigabe sieht der Tisch weder Lösung noch Hinweise', () => {
    const ohne = new Map(bestand);
    ohne.delete('i-1');
    const karte = redactEntity(registry, ohne, { ...raetsel, relations: [] }, 'pc-1').components?.['Encounter'] as Record<string, unknown>;
    expect(karte['kind']).toEqual(['puzzle']);
    expect(karte['solution']).toBeUndefined();
    expect(karte['hint'] ?? []).toEqual([]);
  });

  it('ein freigegebener Hinweis kommt einzeln, die Lösung nicht', () => {
    const karte = redactEntity(registry, bestand, raetsel, 'pc-1').components?.['Encounter'] as Record<string, unknown>;
    expect(karte['solution']).toBeUndefined();
    expect((karte['hint'] as { id: string }[]).map((h) => h.id)).toEqual(['h_lied']);
  });
});

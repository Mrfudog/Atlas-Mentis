import { describe, expect, it } from 'vitest';
import { redactEntity } from '../src/knowledge.js';
import type { Entity, EntityId } from '../src/types.js';

/* Ohne Betrachter geht der Artikel ganz hinaus (Verwaltung, Leitung der
   Kampagne — T-447, T-455). Nur der bequeme Name oben wird aus der Karte
   gefüllt: aus Postgres kommt er leer, und bis T-447 füllte ihn das Sieb
   nur für Betrachter. Erfundene Artikel. */
const registry = { interfaces: {} };
const ohneNamen: Entity = {
  id: 'n_1',
  interfaces: ['Creature'],
  name: '',
  components: { Identity: { name: 'Reeve Ansel', id: 'creature-0001', aliases: [], cover: 'a man in a grey cloak' }, Secrets: { secret: [{ id: 's-1', value: 'paid by the guild' }] } },
  relations: [{ id: 'n_1~p', type: 'participates', to: 'x', props: { initiative: 3 } }],
};
const entities = new Map<EntityId, Entity>([[ohneNamen.id, ohneNamen]]);

describe('redactEntity without a viewer (T-447)', () => {
  it('returns the article whole and fills the convenient name from Identity', () => {
    const r = redactEntity(registry, entities, ohneNamen);
    expect(r.name).toBe('Reeve Ansel');
    expect(r.components).toBe(ohneNamen.components);
    expect(r.relations).toBe(ohneNamen.relations);
  });

  it('leaves the article untouched when the name already stands or Identity says nothing', () => {
    const mit = { ...ohneNamen, name: 'Reeve Ansel' };
    expect(redactEntity(registry, entities, mit)).toBe(mit);
    const ohneKarte: Entity = { ...ohneNamen, components: {} };
    expect(redactEntity(registry, entities, ohneKarte)).toBe(ohneKarte);
  });

  it('still sieves a viewer: the cover name and no secret', () => {
    const r = redactEntity(registry, entities, ohneNamen, ['pc_x'], undefined, undefined, true);
    expect(r.name).toBe('a man in a grey cloak');
    expect(r.components?.['Secrets']).toBeUndefined();
  });
});

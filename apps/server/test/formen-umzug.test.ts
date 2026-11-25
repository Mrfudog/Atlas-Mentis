/**
 * Nach dem Umzug (T-394, Migration 141): die Formebene ist eine
 * Regelmechanik mit der Karte ShapeDefaults, und die Formen gelten weiter
 * in der Kampagne, die sie aufschaltete — ohne Ergänzungsartikel, für
 * Leitung und Spielerin. Der Zustand wie nach der Migration, erfundene
 * Gegenstände (die SQL selbst prüft der Durchstich).
 */

import { describe, expect, it } from 'vitest';
import { validateEntity, type Entity } from '@nw/model';
import { regelsystemeNachziehen } from '../src/regelsysteme.js';
import { tisch } from './hilfen/tisch.js';

const ident = (name: string, id: string) => ({ Identity: { name, id, aliases: [] }, Status: { status: 'ready' } });

const formebene: Entity = {
  id: 'ly_shapes_bh',
  name: 'Item shapes (Homebrew)',
  interfaces: ['RuleMechanic'],
  components: {
    ...ident('Item shapes (Homebrew)', 'layer-0222'),
    Layer: { kind: 'pack', order: 50 },
    RuleMechanic: { method: 'shapes' },
    ShapeDefaults: { shapeGroups: [], shapeItems: [{ id: 'sword', rows: ['.#.', '###'], stackSize: 1 }, { id: 'arrow', rows: ['#', '#'], stackSize: 32 }] },
  },
  relations: [
    { id: 'ly_shapes_bh~partOf-ly_rs_inventory', type: 'partOf', to: 'ly_rs_inventory', props: {} },
    { id: 'ly_shapes_bh~compatibleWith-ly_rm_grid', type: 'compatibleWith', to: 'ly_rm_grid', props: {} },
  ],
};
const ding = (id: string, name: string, n: number): Entity => ({ id, name, interfaces: ['Item'], components: { ...ident(name, `item-000${n}`), Item: { weight: 1 } }, relations: [] });

async function aufbau(aufgeschaltet: boolean) {
  const t = await tisch({
    kampagne: 'camp',
    artikel: [
      formebene,
      ding('sword', 'Sword', 1),
      ding('arrow', 'Arrow', 2),
      {
        id: 'camp',
        interfaces: ['Campaign'],
        components: ident('Runde', 'campaign-0001'),
        relations: aufgeschaltet ? [{ id: 'a1', type: 'activates', to: 'ly_shapes_bh', props: { order: 30 } }] : [],
      },
    ],
    konten: { Mira: { roles: { camp: 'gm' } }, Sela: { roles: { camp: 'player' } } },
  });
  await regelsystemeNachziehen(t.repo);
  return t;
}

describe('Formen nach dem Umzug (T-394)', () => {
  it('die umgebaute Ebene ist eine gültige Regelmechanik von Inventory', async () => {
    const t = await aufbau(true);
    expect(validateEntity(await t.repo.getRegistry(), (await t.repo.getEntity('ly_shapes_bh'))!)).toEqual([]);
  });

  it('die Formen gelten weiter, wo die Ebene aufgeschaltet ist — mit Herkunft, ohne Ergänzung', async () => {
    const t = await aufbau(true);
    for (const wer of ['Mira', 'Sela']) {
      const e = await t.json<Entity & { refs?: { shape?: unknown; supplied?: unknown } }>(wer, 'GET', '/api/entities/sword');
      expect(e.components?.['Item']).toMatchObject({ rows: ['.#.', '###'], stackSize: 1, weight: 1 });
      expect(e.refs?.shape).toMatchObject({ source: 'own' });
      expect(e.refs?.supplied).toBeUndefined();
    }
  });

  it('und nicht, wo sie es nicht ist', async () => {
    const t = await aufbau(false);
    const e = await t.json<Entity>('Mira', 'GET', '/api/entities/arrow');
    expect(e.components?.['Item']?.['rows']).toBeUndefined();
  });
});

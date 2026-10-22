/**
 * Regelsysteme und Regelmechaniken als Ebenen (E-166, T-394): der Start
 * legt Inventory mit Weight, Slots, Grid und Default shapes an; eine
 * Kampagne, die Inventory aufschaltet, bringt die Mechaniken, und die
 * Vorgabeformen aus Default shapes gelten. Erfundene Gegenstände.
 */

import { describe, expect, it } from 'vitest';
import { compatibleMechanics, validateEntity, type Entity } from '@nw/model';
import { regelsystemeNachziehen } from '../src/regelsysteme.js';
import { tisch } from './hilfen/tisch.js';

const ident = (name: string, id: string) => ({ Identity: { name, id, aliases: [] }, Status: { status: 'ready' } });
const kampagne = (mitInventar: boolean): Entity => ({
  id: 'camp',
  interfaces: ['Campaign'],
  components: ident('Runde', 'campaign-0001'),
  relations: mitInventar ? [{ id: 'a1', type: 'activates', to: 'ly_rs_inventory', props: { order: 10 } }] : [],
});
const pfeil: Entity = { id: 'arrow', interfaces: ['Item'], components: { ...ident('Arrow', 'item-0001'), Item: { weight: 0.05 } }, relations: [] };

async function aufbau(mitInventar = true) {
  const t = await tisch({
    kampagne: 'camp',
    artikel: [kampagne(mitInventar), pfeil],
    konten: { Mira: { roles: { camp: 'gm' } }, Sela: { roles: { camp: 'player' } }, Admin: { admin: true } },
  });
  await regelsystemeNachziehen(t.repo);
  return t;
}

describe('Regelsysteme beim Start (E-166)', () => {
  it('legt Inventory und seine Mechaniken an, gültig und mit Nummer', async () => {
    const t = await aufbau();
    const reg = await t.repo.getRegistry();
    for (const id of ['ly_rs_inventory', 'ly_rm_weight', 'ly_rm_slots', 'ly_rm_grid', 'ly_rm_shapes']) {
      const e = await t.repo.getEntity(id);
      expect(e, id).toBeTruthy();
      expect(validateEntity(reg, e!), id).toEqual([]);
    }
    expect((await t.repo.getEntity('ly_rs_inventory'))?.components?.['Identity']).toMatchObject({ name: 'Inventory', id: 'rulesystem-0001' });
    expect((await t.repo.getEntity('ly_rm_shapes'))?.components?.['Identity']).toMatchObject({ id: 'rulemechanic-0004' });
  });

  it('legt nichts doppelt an und lässt Geändertes stehen', async () => {
    const t = await aufbau();
    const grid = (await t.repo.getEntity('ly_rm_grid'))!;
    await t.repo.putEntity({ ...grid, components: { ...grid.components, Description: { description: 'Unser Raster' } } });
    expect(await regelsystemeNachziehen(t.repo)).toEqual([]);
    expect((await t.repo.getEntity('ly_rm_grid'))?.components?.['Description']).toEqual({ description: 'Unser Raster' });
  });

  it('Grid gilt mit Weight, in beide Richtungen gelesen', async () => {
    const t = await aufbau();
    const alle = new Map((await t.repo.listEntities()).map((e) => [e.id, e]));
    expect(compatibleMechanics(alle, 'ly_rm_weight')).toEqual(['ly_rm_grid']);
    expect(compatibleMechanics(alle, 'ly_rm_grid').sort()).toEqual(['ly_rm_shapes', 'ly_rm_weight']);
  });

  it('die Mechaniken sind Ebenen: sichtbar für Leitung und Spielerin', async () => {
    const t = await aufbau();
    for (const wer of ['Mira', 'Sela']) {
      const e = await t.json<Entity>(wer, 'GET', '/api/entities/ly_rm_grid');
      expect(e.interfaces?.[0]).toBe('RuleMechanic');
    }
  });

  it('Inventory aufgeschaltet: die Vorgabeformen aus Default shapes gelten', async () => {
    const t = await aufbau();
    const formen = (await t.repo.getEntity('ly_rm_shapes'))!;
    await t.repo.putEntity({
      ...formen,
      components: { ...formen.components, ShapeDefaults: { shapeGroups: [{ id: 'AM', name: 'Ammunition', rows: ['#', '#'], stackSize: 32 }], shapeItems: [{ id: 'arrow', group: 'AM' }] } },
    });
    expect(validateEntity(await t.repo.getRegistry(), (await t.repo.getEntity('ly_rm_shapes'))!)).toEqual([]);
    for (const wer of ['Mira', 'Sela']) {
      const e = await t.json<Entity & { refs?: { shape?: unknown } }>(wer, 'GET', '/api/entities/arrow');
      expect(e.components?.['Item']).toMatchObject({ rows: ['#', '#'], stackSize: 32 });
      expect(e.refs?.shape).toMatchObject({ source: 'group', group: 'AM' });
    }
  });

  it('ohne Inventory in der Kampagne gilt keine Vorgabe', async () => {
    const t = await aufbau(false);
    const formen = (await t.repo.getEntity('ly_rm_shapes'))!;
    await t.repo.putEntity({ ...formen, components: { ...formen.components, ShapeDefaults: { shapeGroups: [{ id: 'AM', name: 'A', rows: ['#'] }], shapeItems: [{ id: 'arrow', group: 'AM' }] } } });
    const e = await t.json<Entity>('Mira', 'GET', '/api/entities/arrow');
    expect(e.components?.['Item']?.['rows']).toBeUndefined();
  });
});

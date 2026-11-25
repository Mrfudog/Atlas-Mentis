/**
 * Der Tisch für Integrationstests (T-356) — und an ihm gleich die
 * Siebung der Grundrouten: dieselbe Anfrage als Leitung und als
 * Spielerin, `audience: 'gm'` und `idea` bleiben bei der Leitung (D72).
 */
import { describe, expect, it } from 'vitest';
import type { Entity } from '@nw/model';
import { tisch } from './hilfen/tisch.js';

const ebene: Entity = {
  id: 'ly_nebel',
  interfaces: ['Layer'],
  name: 'Nebel',
  components: { Identity: { name: 'Nebel', id: 'layer-0001', aliases: [] } },
  relations: [],
};
const runde: Entity = {
  id: 'camp_nebel',
  interfaces: ['Campaign'],
  name: 'Nebelwacht',
  components: { Identity: { name: 'Nebelwacht', id: 'campaign-0001', aliases: [] } },
  relations: [{ id: 'a1', type: 'activates', to: 'ly_nebel', props: { order: 5 } }],
};
const ort = (id: string, name: string, extra: Record<string, unknown> = {}): Entity => ({
  id,
  interfaces: ['Place'],
  name,
  components: { Identity: { name, id: `place-${id}`, aliases: [] }, ...extra },
  relations: [{ id: `${id}~l`, type: 'inLayer', to: 'ly_nebel', props: {} }],
});

const aufbau = () =>
  tisch({
    kampagne: 'camp_nebel',
    artikel: [ebene, runde, ort('p_markt', 'Market'), ort('p_gruft', 'Crypt', { Visibility: { audience: 'gm' } }), ort('p_idee', 'Harbour', { Status: { status: 'idea' } })],
    konten: { Mira: { roles: { camp_nebel: 'gm' } }, Sela: { roles: { camp_nebel: 'player' } } },
  });

describe('tisch (T-356)', () => {
  it('asks the same route as GM and as player', async () => {
    const t = await aufbau();
    for (const id of ['p_markt', 'p_gruft', 'p_idee']) {
      expect((await t.als('Mira', 'GET', `/api/entities/${id}`)).statusCode).toBe(200);
    }
    expect((await t.als('Sela', 'GET', '/api/entities/p_markt')).statusCode).toBe(200);
    expect((await t.als('Sela', 'GET', '/api/entities/p_gruft')).statusCode).toBe(404);
    expect((await t.als('Sela', 'GET', '/api/entities/p_idee')).statusCode).toBe(404);
  });

  it('sieves the list the same way', async () => {
    const t = await aufbau();
    const ids = async (wer: string) =>
      (await t.json<{ rows: { id: string }[] }>(wer, 'GET', '/api/list?type=Place&limit=50')).rows.map((r) => r.id).sort();
    expect(await ids('Mira')).toEqual(['p_gruft', 'p_idee', 'p_markt']);
    expect(await ids('Sela')).toEqual(['p_markt']);
  });

  it('without a session there is nothing, and an unknown name is a mistake in the test', async () => {
    const t = await aufbau();
    expect((await t.als(null, 'GET', '/api/entities/p_markt')).statusCode).toBe(401);
    expect(() => t.als('Niemand', 'GET', '/api/me')).toThrow(/Niemand/);
  });
});

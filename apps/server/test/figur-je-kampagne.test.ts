/**
 * Figuren je Kampagne (T-412, Entscheid der Leitung 23.10.): eine Figur,
 * die einem Konto in Runde A zugeteilt ist, ist in Runde B nicht „seine" —
 * weder in `/api/me` noch in der Mitgliederliste von B —, und eine
 * Zuteilung in B nimmt ihm die aus A nicht weg. Eine Zuteilung ohne
 * bekannte Kampagne (Bestand, den Migration 156 nicht zuordnen konnte)
 * gilt wie bisher überall.
 */

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import type { Entity } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';
import { figurDazu, figurenIn, mitFiguren } from '../src/figurenzuteilung.js';

const PASSWORT = 'nebel-wacht-am-tor';
const ident = (name: string, id: string) => ({ Identity: { name, id, aliases: [] }, Status: { status: 'ready' } });
const ebene = (id: string, n: string): Entity => ({ id, name: id, interfaces: ['Layer'], components: { ...ident(id, `layer-000${n}`), Layer: { kind: 'campaign', order: 50 } }, relations: [] });
const kampagne = (id: string, name: string, n: string): Entity => ({
  id, name, interfaces: ['Campaign'], components: ident(name, `campaign-000${n}`),
  relations: [{ id: `${id}_ac`, type: 'activates', to: `ly_${id}`, props: {} }],
});
const figur = (id: string, name: string, n: string, layer: string): Entity => ({
  id, name, interfaces: ['PlayerCharacter'], components: { ...ident(name, `playercharacter-000${n}`), PlayerCharacter: { level: 1 } },
  relations: [{ id: `${id}_in`, type: 'inLayer', to: layer, props: {} }],
});
const BESTAND: Entity[] = [
  ebene('ly_camp_a', '1'), ebene('ly_camp_b', '2'),
  kampagne('camp_a', 'Runde A', '1'), kampagne('camp_b', 'Runde B', '2'),
  figur('pc_barbar', 'Test Barbar', '1', 'ly_camp_a'),
  figur('pc_wren', 'Wren', '2', 'ly_camp_b'),
  figur('pc_alt', 'Alt', '3', 'ly_camp_a'),
];

async function aufbau(laufend: string) {
  const registry = { ...seedRegistry, settings: { ...(seedRegistry.settings ?? {}), campaign: laufend } };
  const repo = new InMemoryRepository(registry, BESTAND);
  const app = buildApp({ repo });
  const ids: Record<string, string> = {};
  for (const [name, admin, roles] of [
    ['Admin', true, {}],
    ['Basil', false, { camp_a: 'gm', camp_b: 'gm' }],
  ] as const) {
    ids[name] = randomUUID();
    await repo.putUser({ id: ids[name]!, name, passwordHash: await hashPassword(PASSWORT), isAdmin: admin, actorIds: [], roles: { ...roles } });
  }
  const keks = async (name: string) => {
    const res = await app.inject({ method: 'POST', url: '/api/login', payload: { name, password: PASSWORT } });
    return `nw_session=${res.cookies.find((x) => x.name === 'nw_session')?.value ?? ''}`;
  };
  const rufe = async (name: string, method: 'GET' | 'PUT', url: string, payload?: Record<string, unknown>) =>
    app.inject({ method, url, headers: { cookie: await keks(name) }, ...(payload ? { payload } : {}) });
  const meine = async () => ((await rufe('Basil', 'GET', '/api/me')).json() as { user: { actorIds: string[] } }).user.actorIds;
  const mitglied = async (c: string) =>
    ((await rufe('Basil', 'GET', `/api/campaigns/${c}/members`)).json() as { members: { id: string; actors: { id: string }[] }[] }).members
      .find((m) => m.id === ids['Basil'])!.actors.map((a) => a.id);
  return { repo, ids, rufe, meine, mitglied };
}

describe('characters belong to an account per campaign (T-412)', () => {
  it('a character given in one campaign is not mine in another', async () => {
    const { ids, rufe, meine, mitglied } = await aufbau('camp_b');
    const res = await rufe('Admin', 'PUT', `/api/campaigns/camp_a/members/${ids['Basil']}/actors`, { actorIds: ['pc_barbar'] });
    expect(res.statusCode).toBe(200);
    /* Läuft Runde B, ist Test Barbar nicht meine Figur. */
    expect(await meine()).toEqual([]);
    expect(await mitglied('camp_b')).toEqual([]);
    expect(await mitglied('camp_a')).toEqual(['pc_barbar']);
  });

  it('is mine again where it was given, and giving one in B keeps the one in A', async () => {
    const { ids, rufe, repo, meine, mitglied } = await aufbau('camp_a');
    await rufe('Admin', 'PUT', `/api/campaigns/camp_a/members/${ids['Basil']}/actors`, { actorIds: ['pc_barbar'] });
    await rufe('Admin', 'PUT', `/api/campaigns/camp_b/members/${ids['Basil']}/actors`, { actorIds: ['pc_wren'] });
    expect(await meine()).toEqual(['pc_barbar']);
    expect(await mitglied('camp_b')).toEqual(['pc_wren']);
    /* Leeren in B nimmt nur die aus B. */
    await rufe('Admin', 'PUT', `/api/campaigns/camp_b/members/${ids['Basil']}/actors`, { actorIds: [] });
    const basil = await repo.getUser(ids['Basil']!);
    expect(basil?.actorIds).toEqual(['pc_barbar']);
    expect(basil?.actorCampaigns).toEqual({ pc_barbar: 'camp_a' });
  });

  it('keeps a character without a known campaign everywhere, as before', async () => {
    const { ids, repo, meine, mitglied } = await aufbau('camp_b');
    const basil = await repo.getUser(ids['Basil']!);
    await repo.putUser({ ...basil!, actorIds: ['pc_alt'] });
    expect(await meine()).toEqual(['pc_alt']);
    expect(await mitglied('camp_a')).toEqual(['pc_alt']);
    expect(await mitglied('camp_b')).toEqual(['pc_alt']);
  });
});

describe('the helpers (T-412)', () => {
  const u = { actorIds: ['a1', 'b1', 'x'], actorCampaigns: { a1: 'A', b1: 'B' } };
  it('figurenIn counts those of the campaign and those without one', () => {
    expect(figurenIn(u, 'A')).toEqual(['a1', 'x']);
    expect(figurenIn(u, 'B')).toEqual(['b1', 'x']);
    expect(figurenIn(u, null)).toEqual(['a1', 'b1', 'x']);
  });
  it('mitFiguren replaces only within the campaign and claims what it names', () => {
    const n = mitFiguren(u, 'A', ['a2', 'x']);
    expect(n.actorIds).toEqual(['b1', 'x', 'a2']);
    expect(n.actorCampaigns).toEqual({ b1: 'B', a2: 'A', x: 'A' });
  });
  it('figurDazu adds one in its campaign', () => {
    expect(figurDazu(u, 'B', 'b2')).toEqual({ actorIds: ['a1', 'b1', 'x', 'b2'], actorCampaigns: { a1: 'A', b1: 'B', b2: 'B' } });
  });
});

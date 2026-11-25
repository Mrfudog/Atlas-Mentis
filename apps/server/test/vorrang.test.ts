/**
 * Vorrang an der Kampagne (T-403, E-111 a): die Leitung zieht eine Fassung
 * oder eine Ebene für eine Art nach vorn (`prefers`), ohne ein Buch zu
 * beschreiben — Liste, Fassungen und Kampagnenseite folgen; ein Mitleiter
 * sieht es, ändert es nicht; nach dem Entfernen gilt wieder die Reihenfolge.
 */

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import type { Entity } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';

const PASSWORT = 'nebel-wacht-am-tor';
const ident = (name: string, id: string) => ({ Identity: { name, id, aliases: [] }, Status: { status: 'ready' } });
const L = (id: string, name: string): Entity => ({ id, name, interfaces: ['Layer'], components: { ...ident(name, `layer-${id}`), Layer: {} }, relations: [] });
const A = (id: string, type: string, name: string, layer: string, mehr: Entity['relations'] = []): Entity => ({
  id, name, interfaces: [type], components: ident(name, `${type.toLowerCase()}-${id}`),
  relations: [{ id: `${id}_in`, type: 'inLayer', to: layer, props: {} }, ...(mehr ?? [])],
});

async function aufbau() {
  const bestand: Entity[] = [
    L('ly14', 'PHB 2014'),
    L('ly24', 'PHB 2024'),
    { id: 'camp_a', name: 'Runde A', interfaces: ['Campaign'], components: ident('Runde A', 'campaign-0001'),
      relations: [
        { id: 'a1', type: 'activates', to: 'ly24', props: { order: 10 } },
        { id: 'a2', type: 'activates', to: 'ly14', props: { order: 20 } },
      ] },
    A('d14', 'Item', 'Dagger', 'ly14'),
    A('d24', 'Item', 'Dagger', 'ly24', [{ id: 'd24_v', type: 'variantOf', to: 'd14', props: {} }]),
  ];
  const repo = new InMemoryRepository({ ...seedRegistry, settings: { ...(seedRegistry.settings ?? {}), campaign: 'camp_a' } }, bestand);
  const app = buildApp({ repo });
  for (const [name, roles] of [['Basil', { camp_a: 'gm' }], ['Mira', { camp_a: 'co-gm' }], ['Pia', { camp_a: 'player' }]] as const) {
    await repo.putUser({ id: randomUUID(), name, passwordHash: await hashPassword(PASSWORT), isAdmin: false, actorIds: [], roles: { ...roles } });
  }
  const kekse = new Map<string, string>();
  const rufe = async (name: string, method: 'GET' | 'PUT' | 'DELETE', url: string, payload?: unknown) => {
    if (!kekse.has(name)) {
      const res = await app.inject({ method: 'POST', url: '/api/login', payload: { name, password: PASSWORT } });
      kekse.set(name, `nw_session=${res.cookies.find((x) => x.name === 'nw_session')?.value ?? ''}`);
    }
    return app.inject({ method, url, headers: { cookie: kekse.get(name)! }, ...(payload === undefined ? {} : { payload: payload as object }) });
  };
  /** Welche Fassung die Liste als Zeile zeigt. */
  const kopf = async () =>
    ((await rufe('Pia', 'GET', '/api/list?limit=50&versions=1&q=Dagger')).json() as { rows: { id: string }[] }).rows.map((r) => r.id);
  return { repo, rufe, kopf };
}

describe('prefers at the campaign (T-403)', () => {
  it('pulls one version to the front, and the list and the versions follow', async () => {
    const { rufe, kopf, repo } = await aufbau();
    expect(await kopf()).toEqual(['d14']);
    const r = await rufe('Basil', 'PUT', '/api/campaigns/camp_a/prefers', { to: 'd24' });
    expect(r.statusCode).toBe(200);
    expect((await repo.getEntity('camp_a'))?.relations?.find((k) => k.type === 'prefers')).toMatchObject({ to: 'd24' });
    expect(await kopf()).toEqual(['d24']);
    const f = (await rufe('Basil', 'GET', '/api/entities/d14/versions')).json() as { versions: { entity: { id: string }; preferred?: boolean; shown?: boolean }[]; shown?: boolean };
    expect(f.versions.find((v) => v.entity.id === 'd24')).toMatchObject({ preferred: true, shown: true });
    expect(f.shown).toBe(false);
    /* Die Kampagnenseite führt den Vorrang. */
    const s = (await rufe('Mira', 'GET', '/api/campaigns/camp_a/layers')).json() as { preferences: { to: string; name: string }[] };
    expect(s.preferences).toEqual([expect.objectContaining({ to: 'd24', name: 'Dagger' })]);
    expect((await rufe('Basil', 'DELETE', '/api/campaigns/camp_a/prefers/d24')).statusCode).toBe(200);
    expect(await kopf()).toEqual(['d14']);
  });

  it('prefers a layer for one type', async () => {
    const { rufe, kopf } = await aufbau();
    const r = await rufe('Basil', 'PUT', '/api/campaigns/camp_a/prefers', { to: 'ly24', types: ['Item'] });
    expect(r.statusCode).toBe(200);
    expect(await kopf()).toEqual(['d24']);
    expect((await rufe('Basil', 'DELETE', '/api/campaigns/camp_a/prefers/ly24?type=Item')).statusCode).toBe(200);
    expect(await kopf()).toEqual(['d14']);
  });

  it('refuses a co-GM, a player, a layer without types and an article not in play', async () => {
    const { rufe } = await aufbau();
    expect((await rufe('Mira', 'PUT', '/api/campaigns/camp_a/prefers', { to: 'd24' })).statusCode).toBe(403);
    expect((await rufe('Pia', 'PUT', '/api/campaigns/camp_a/prefers', { to: 'd24' })).statusCode).toBe(403);
    expect((await rufe('Basil', 'PUT', '/api/campaigns/camp_a/prefers', { to: 'ly24' })).statusCode).toBe(400);
    expect((await rufe('Basil', 'PUT', '/api/campaigns/camp_a/prefers', { to: 'gibts-nicht' })).statusCode).toBe(404);
    expect((await rufe('Basil', 'PUT', '/api/campaigns/camp_a/prefers', { to: 'ly24', types: ['Unsinn'] })).statusCode).toBe(400);
  });
});

describe('the article list of the campaign (T-403)', () => {
  it('says how many versions there are, which one shows, and which is preferred', async () => {
    const { rufe } = await aufbau();
    const zeilen = async () =>
      ((await rufe('Basil', 'GET', '/api/campaigns/camp_a/visibility/articles?q=Dagger')).json() as { rows: { id: string; versions?: { n: number; shown: boolean; preferred?: boolean } }[] }).rows;
    expect((await zeilen()).find((r) => r.id === 'd14')?.versions).toEqual({ n: 2, shown: true });
    await rufe('Basil', 'PUT', '/api/campaigns/camp_a/prefers', { to: 'd24' });
    const z = await zeilen();
    expect(z.find((r) => r.id === 'd24')?.versions).toEqual({ n: 2, shown: true, preferred: true });
    expect(z.find((r) => r.id === 'd14')?.versions).toEqual({ n: 2, shown: false });
  });
});

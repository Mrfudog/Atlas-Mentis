/**
 * Ebenen teilweise aufschalten (T-105, REQ-255): aus einem Abenteuer nur
 * Regeln und Gegenstände nehmen, nicht dessen Orte und Begegnungen.
 *
 * Geprüft wird: die Leitung setzt die Auswahl an der Kante, die Seite
 * zeigt sie, was nicht passt, ist nicht da — und ein Mitleiter ändert
 * nichts, Unbekanntes lehnt die Route ab.
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
const im = (id: string, layer: string) => [{ id: `${id}_in`, type: 'inLayer', to: layer, props: {} }];
const BESTAND: Entity[] = [
  { id: 'ly_a', name: 'ly_a', interfaces: ['Layer'], components: { ...ident('Ebene A', 'layer-0001'), Layer: { kind: 'campaign', order: 50 } }, relations: [] },
  { id: 'ly_adv', name: 'ly_adv', interfaces: ['Layer'], components: { ...ident('Lost Mine', 'layer-0002'), Layer: { kind: 'adventure' } }, relations: [] },
  { id: 'camp_a', name: 'Runde A', interfaces: ['Campaign'], components: ident('Runde A', 'campaign-0001'),
    relations: [
      { id: 'camp_a_adv', type: 'activates', to: 'ly_adv', props: { order: 10 } },
      { id: 'camp_a_ac', type: 'activates', to: 'ly_a', props: { order: 20 } },
    ] },
  { id: 'ort', name: 'Phandalin', interfaces: ['Place'], components: ident('Phandalin', 'place-0001'), relations: im('ort', 'ly_adv') },
  { id: 'regel', name: 'Mine air', interfaces: ['Rule'], components: ident('Mine air', 'rule-0001'), relations: im('regel', 'ly_adv') },
  { id: 'stab', name: 'Spider staff', interfaces: ['Item'], components: ident('Spider staff', 'item-0001'), relations: im('stab', 'ly_adv') },
];

async function aufbau() {
  const registry = { ...seedRegistry, settings: { ...(seedRegistry.settings ?? {}), campaign: 'camp_a' } };
  const repo = new InMemoryRepository(registry, BESTAND);
  const app = buildApp({ repo });
  const konto = async (name: string, roles: Record<string, 'gm' | 'co-gm'>, admin = false) => {
    await repo.putUser({ id: randomUUID(), name, passwordHash: await hashPassword(PASSWORT), isAdmin: admin, actorIds: [], roles });
  };
  await konto('Admin', {}, true);
  await konto('Basil', { camp_a: 'gm' });
  await konto('Mira', { camp_a: 'co-gm' });
  const keks = async (name: string) => {
    const res = await app.inject({ method: 'POST', url: '/api/login', payload: { name, password: PASSWORT } });
    return `nw_session=${res.cookies.find((x) => x.name === 'nw_session')?.value ?? ''}`;
  };
  const rufe = async (name: string, method: 'GET' | 'PUT', url: string, payload?: unknown) =>
    app.inject({ method, url, headers: { cookie: await keks(name) }, ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }) });
  return { repo, rufe };
}

describe('turning on part of a layer (T-105)', () => {
  it('brings only the rules and the item of an adventure', async () => {
    const { rufe, repo } = await aufbau();
    const res = await rufe('Basil', 'PUT', '/api/campaigns/camp_a/layers/ly_adv/only', { areas: ['rules'], types: ['Item'] });
    expect(res.statusCode).toBe(200);
    const kante = (await repo.getEntity('camp_a'))?.relations?.find((r) => r.to === 'ly_adv');
    expect(kante?.props).toEqual({ order: 10, areas: ['rules'], types: ['Item'] });
    /* Die Seite der Kampagne zeigt die Auswahl. */
    const ebenen = (await rufe('Basil', 'GET', '/api/campaigns/camp_a/layers')).json().layers as { id: string; only?: unknown }[];
    expect(ebenen.find((l) => l.id === 'ly_adv')?.only).toEqual({ areas: ['rules'], types: ['Item'] });
    /* Der Ort ist nicht da, auch für die Verwaltung; Regel und Stab schon. */
    expect((await rufe('Admin', 'GET', '/api/entities/ort')).statusCode).toBe(404);
    expect((await rufe('Admin', 'GET', '/api/entities/regel')).statusCode).toBe(200);
    expect((await rufe('Admin', 'GET', '/api/entities/stab')).statusCode).toBe(200);
    /* Der Stapel neu geschrieben: die Auswahl bleibt an der Kante. */
    expect((await rufe('Basil', 'PUT', '/api/campaigns/camp_a/layers', { layers: ['ly_adv', 'ly_a'] })).statusCode).toBe(200);
    expect((await repo.getEntity('camp_a'))?.relations?.find((r) => r.to === 'ly_adv')?.props).toMatchObject({ areas: ['rules'] });
    /* Zurück auf alles. */
    expect((await rufe('Basil', 'PUT', '/api/campaigns/camp_a/layers/ly_adv/only', {})).statusCode).toBe(200);
    expect((await rufe('Admin', 'GET', '/api/entities/ort')).statusCode).toBe(200);
  });

  it('refuses unknown areas and types, a co-GM, and a layer the campaign does not turn on itself', async () => {
    const { rufe } = await aufbau();
    expect((await rufe('Basil', 'PUT', '/api/campaigns/camp_a/layers/ly_adv/only', { areas: ['rulez'] })).statusCode).toBe(400);
    expect((await rufe('Basil', 'PUT', '/api/campaigns/camp_a/layers/ly_adv/only', { types: ['Nope'] })).statusCode).toBe(400);
    expect((await rufe('Mira', 'PUT', '/api/campaigns/camp_a/layers/ly_adv/only', { areas: ['rules'] })).statusCode).toBe(403);
    expect((await rufe('Basil', 'PUT', '/api/campaigns/camp_a/layers/ly_nope/only', { areas: ['rules'] })).statusCode).toBe(409);
  });
});

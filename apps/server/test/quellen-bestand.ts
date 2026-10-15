/**
 * Der Bestand für die Quellen-Tests (T-187, T-189): drei Abenteuer in einer
 * Gruppe, eine Kampagne mit zweien im Spiel und einem zum Vergleich, dazu
 * Konten mit jeder Rolle. Eine eigene Datei, damit ein Test ihn holen kann,
 * ohne die Tests des anderen mitlaufen zu lassen.
 */

import { randomUUID } from 'node:crypto';
import { seedRegistry } from '@nw/registry';
import type { Entity } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';

const PASSWORT = 'nebel-wacht-am-tor';

const ident = (name: string, id: string) => ({ Identity: { name, id, aliases: [] }, Status: { status: 'ready' } });
const im = (id: string, layer: string) => [{ id: `${id}_in`, type: 'inLayer', to: layer, props: {} }];
const L = (id: string, name: string, kind: string, partOf: string[] = []): Entity => ({
  id, name, interfaces: ['Layer'], components: { ...ident(name, `layer-${id}`), Layer: { kind } },
  relations: partOf.map((to, i) => ({ id: `${id}_p${i}`, type: 'partOf', to, props: {} })),
});
const A = (id: string, type: string, name: string, layer: string): Entity => ({
  id, name, interfaces: [type], components: ident(name, `${type.toLowerCase()}-${id}`), relations: im(id, layer),
});
export const BESTAND: Entity[] = [
  L('g_adv', 'Adventures', 'group'),
  L('ly_eins', 'Lost Mine', 'adventure', ['g_adv']),
  L('ly_zwei', 'Sunless Citadel', 'adventure', ['g_adv']),
  L('ly_drei', 'Tomb of Annihilation', 'adventure', ['g_adv']),
  { id: 'camp_a', name: 'Runde A', interfaces: ['Campaign'], components: ident('Runde A', 'campaign-0001'),
    relations: [
      { id: 'camp_a_1', type: 'activates', to: 'ly_eins', props: { order: 10 } },
      { id: 'camp_a_2', type: 'activates', to: 'ly_zwei', props: { order: 20 } },
      { id: 'camp_a_3', type: 'activates', to: 'ly_drei', props: { mode: 'compare' } },
    ] },
  A('ort1', 'Place', 'Phandalin', 'ly_eins'),
  A('stab1', 'Item', 'Spider staff', 'ly_eins'),
  A('ort2', 'Place', 'Oakhurst', 'ly_zwei'),
  A('regel2', 'Rule', 'Twig blight sap', 'ly_zwei'),
  A('stab3', 'Item', 'Ring of winter', 'ly_drei'),
  A('ort3', 'Place', 'Port Nyanzaru', 'ly_drei'),
];

export async function aufbau() {
  const registry = { ...seedRegistry, settings: { ...(seedRegistry.settings ?? {}), campaign: 'camp_a' } };
  const repo = new InMemoryRepository(registry, BESTAND);
  const app = buildApp({ repo });
  const konto = async (name: string, roles: Record<string, 'gm' | 'co-gm' | 'player'>, admin = false) => {
    await repo.putUser({ id: randomUUID(), name, passwordHash: await hashPassword(PASSWORT), isAdmin: admin, actorIds: [], roles });
  };
  await konto('Admin', {}, true);
  await konto('Basil', { camp_a: 'gm' });
  await konto('Mira', { camp_a: 'co-gm' });
  await konto('Pia', { camp_a: 'player' });
  const keks = async (name: string) => {
    const res = await app.inject({ method: 'POST', url: '/api/login', payload: { name, password: PASSWORT } });
    return `nw_session=${res.cookies.find((x) => x.name === 'nw_session')?.value ?? ''}`;
  };
  const rufe = async (name: string, method: 'GET' | 'PUT' | 'DELETE', url: string, payload?: unknown) =>
    app.inject({ method, url, headers: { cookie: await keks(name) }, ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }) });
  const liste = async (name: string, q = '') =>
    ((await rufe(name, 'GET', `/api/list?limit=100${q}`)).json() as { rows: { id: string }[] }).rows.map((r) => r.id).sort();
  const suche = async (name: string, q: string) =>
    ((await rufe(name, 'GET', `/api/search?q=${encodeURIComponent(q)}`)).json() as { rows: { id: string }[] }).rows.map((r) => r.id);
  return { repo, rufe, liste, suche };
}


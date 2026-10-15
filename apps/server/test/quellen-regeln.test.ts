/**
 * Quellen nach Typen und einzelne Artikel (T-187).
 *
 * Geprüft wird je Endpunkt: eine Typ-Regel an der Gruppe „Adventures"
 * siebt in Liste, Suche und Artikel jedes Abenteuer darin, das selbst
 * nichts sagt; eine Ausnahme bringt wieder alles; ein einzeln
 * freigegebener Artikel aus einer Vergleichsebene steht in Liste, Suche
 * und Artikel — auch für Spielende — und nur er; die Kampagnenseite zeigt
 * Regeln und Extra-Inhalt; ein Mitleiter ändert nichts.
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
const L = (id: string, name: string, kind: string, partOf: string[] = []): Entity => ({
  id, name, interfaces: ['Layer'], components: { ...ident(name, `layer-${id}`), Layer: { kind } },
  relations: partOf.map((to, i) => ({ id: `${id}_p${i}`, type: 'partOf', to, props: {} })),
});
const A = (id: string, type: string, name: string, layer: string): Entity => ({
  id, name, interfaces: [type], components: ident(name, `${type.toLowerCase()}-${id}`), relations: im(id, layer),
});
const BESTAND: Entity[] = [
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

async function aufbau() {
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

const ARTIKEL = new Set(['ort1', 'stab1', 'ort2', 'regel2', 'stab3', 'ort3']);
const nurArtikel = (ids: string[]) => ids.filter((x) => ARTIKEL.has(x));

describe('type rules over many sources (T-187)', () => {
  it('sieve every adventure in the group in list, search and article', async () => {
    const { rufe, repo, liste, suche } = await aufbau();
    expect(nurArtikel(await liste('Basil'))).toEqual(['ort1', 'ort2', 'regel2', 'stab1']);
    const res = await rufe('Basil', 'PUT', '/api/campaigns/camp_a/rules/g_adv', { areas: ['rules'], types: ['Item'] });
    expect(res.statusCode).toBe(200);
    expect((await repo.getEntity('camp_a'))?.relations?.find((r) => r.type === 'layerRule')).toMatchObject({
      to: 'g_adv',
      props: { areas: ['rules'], types: ['Item'] },
    });
    /* Liste, Suche, Artikel — für jeden, auch die Verwaltung. */
    expect(nurArtikel(await liste('Basil'))).toEqual(['regel2', 'stab1']);
    expect(nurArtikel(await liste('Pia'))).toEqual(['regel2', 'stab1']);
    expect(await suche('Admin', 'Phandalin')).toEqual([]);
    expect(await suche('Admin', 'Spider')).toEqual(['stab1']);
    expect((await rufe('Admin', 'GET', '/api/entities/ort1')).statusCode).toBe(404);
    expect((await rufe('Admin', 'GET', '/api/entities/stab1')).statusCode).toBe(200);
    /* Die Kampagnenseite zeigt die Regel an der Gruppe und an jedem Buch, woher. */
    const ebenen = (await rufe('Mira', 'GET', '/api/campaigns/camp_a/layers')).json().layers as {
      id: string;
      rule?: unknown;
      ruleFrom?: { id: string; name: string };
    }[];
    expect(ebenen.find((l) => l.id === 'g_adv')?.rule).toEqual({ areas: ['rules'], types: ['Item'] });
    expect(ebenen.find((l) => l.id === 'ly_eins')?.ruleFrom).toMatchObject({ id: 'g_adv', name: 'Adventures' });
    /* Weg mit der Regel: alles wieder da. */
    expect((await rufe('Basil', 'PUT', '/api/campaigns/camp_a/rules/g_adv', {})).statusCode).toBe(200);
    expect(nurArtikel(await liste('Basil'))).toEqual(['ort1', 'ort2', 'regel2', 'stab1']);
  });

  it('give way to an exemption and to the layer’s own choice', async () => {
    const { rufe, liste } = await aufbau();
    await rufe('Basil', 'PUT', '/api/campaigns/camp_a/rules/g_adv', { areas: ['rules'], types: ['Item'] });
    expect((await rufe('Basil', 'PUT', '/api/campaigns/camp_a/layers/ly_zwei/only', { exempt: true })).statusCode).toBe(200);
    expect(nurArtikel(await liste('Basil'))).toEqual(['ort2', 'regel2', 'stab1']);
    const ebenen = (await rufe('Basil', 'GET', '/api/campaigns/camp_a/layers')).json().layers as { id: string; exempt?: boolean; ruleFrom?: unknown }[];
    expect(ebenen.find((l) => l.id === 'ly_zwei')).toMatchObject({ exempt: true });
    expect(ebenen.find((l) => l.id === 'ly_zwei')?.ruleFrom).toBeUndefined();
    /* Eine eigene Auswahl schlägt die Regel. */
    await rufe('Basil', 'PUT', '/api/campaigns/camp_a/layers/ly_eins/only', { types: ['Place'] });
    expect(nurArtikel(await liste('Basil'))).toEqual(['ort1', 'ort2', 'regel2']);
  });

  it('refuse a co-GM, a layer that is no group, and unknown areas', async () => {
    const { rufe } = await aufbau();
    expect((await rufe('Mira', 'PUT', '/api/campaigns/camp_a/rules/g_adv', { areas: ['rules'] })).statusCode).toBe(403);
    expect((await rufe('Basil', 'PUT', '/api/campaigns/camp_a/rules/ly_eins', { areas: ['rules'] })).statusCode).toBe(400);
    expect((await rufe('Basil', 'PUT', '/api/campaigns/camp_a/rules/g_adv', { areas: ['rulez'] })).statusCode).toBe(400);
    expect((await rufe('Basil', 'PUT', '/api/campaigns/camp_a/layers/ly_eins/only', { exempt: 'ja' })).statusCode).toBe(400);
  });
});

describe('single articles enabled from a compare layer (T-187)', () => {
  it('stand in list, search and article for everyone, and only they', async () => {
    const { rufe, liste, suche } = await aufbau();
    /* Vorher: nur als Fassung zum Vergleich, mit dem Angebot für die Leitung. */
    const vorher = (await rufe('Basil', 'GET', '/api/entities/stab3')).json() as { refs: { compare?: boolean; enable?: { campaign: string } } };
    expect(vorher.refs.compare).toBe(true);
    expect(vorher.refs.enable).toEqual({ campaign: 'camp_a' });
    expect((await rufe('Mira', 'GET', '/api/entities/stab3')).json().refs.enable).toBeUndefined();
    expect((await rufe('Pia', 'GET', '/api/entities/stab3')).statusCode).toBe(404);

    expect((await rufe('Basil', 'PUT', '/api/campaigns/camp_a/enabled/stab3')).statusCode).toBe(200);
    expect(nurArtikel(await liste('Pia'))).toEqual(['ort1', 'ort2', 'regel2', 'stab1', 'stab3']);
    expect(await suche('Pia', 'Ring of winter')).toEqual(['stab3']);
    expect(await suche('Pia', 'Nyanzaru')).toEqual([]);
    expect((await rufe('Pia', 'GET', '/api/entities/stab3')).statusCode).toBe(200);
    const nachher = (await rufe('Basil', 'GET', '/api/entities/stab3')).json() as { refs: { compare?: boolean; enabled?: unknown } };
    expect(nachher.refs.compare).toBeUndefined();
    expect(nachher.refs.enabled).toEqual({ campaign: 'camp_a' });
    /* Die Kampagnenseite führt ihn als Extra-Inhalt. */
    const extra = (await rufe('Mira', 'GET', '/api/campaigns/camp_a/layers')).json().extra as { id: string; layers: string[]; inPlay: boolean }[];
    expect(extra).toEqual([expect.objectContaining({ id: 'stab3', name: 'Ring of winter', type: 'Item', layers: ['Tomb of Annihilation'], inPlay: true })]);

    /* Zurück an derselben Stelle. */
    expect((await rufe('Basil', 'DELETE', '/api/campaigns/camp_a/enabled/stab3')).statusCode).toBe(200);
    expect(nurArtikel(await liste('Pia'))).toEqual(['ort1', 'ort2', 'regel2', 'stab1']);
    expect((await rufe('Pia', 'GET', '/api/entities/stab3')).statusCode).toBe(404);
  });

  it('refuse a co-GM, what is already in play, and what was never enabled', async () => {
    const { rufe } = await aufbau();
    expect((await rufe('Mira', 'PUT', '/api/campaigns/camp_a/enabled/stab3')).statusCode).toBe(403);
    expect((await rufe('Basil', 'PUT', '/api/campaigns/camp_a/enabled/stab1')).statusCode).toBe(409);
    expect((await rufe('Basil', 'DELETE', '/api/campaigns/camp_a/enabled/stab3')).statusCode).toBe(404);
    expect((await rufe('Basil', 'PUT', '/api/campaigns/camp_a/enabled/gibt-es-nicht')).statusCode).toBe(404);
  });
});

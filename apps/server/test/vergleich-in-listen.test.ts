/**
 * Artikel aus Vergleichsebenen in Listen (T-213, Rest von T-187).
 *
 * Geprüft wird je Endpunkt (Liste, Suche): mit `compare=1` stehen die
 * Artikel einer Vergleichsebene als eigener Block mit `notInPlay`, nicht
 * zwischen den Zeilen des Spiels und nicht in dessen Zählung; ein Artikel,
 * von dem eine Fassung im Spiel gilt, steht nicht darin; eine Ebene, die
 * weder im Spiel noch Vergleich ist, auch nicht; Spielende sehen nichts
 * davon, ausser die Kampagne sagt `compareFor: 'players'`; „Enable" bietet
 * nur die Leitung an, und danach steht der Artikel im Spiel.
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
const L = (id: string, name: string): Entity => ({
  id, name, interfaces: ['Layer'], components: { ...ident(name, `layer-${id}`), Layer: { kind: 'book' } }, relations: [],
});
const A = (id: string, name: string, layer: string, extra: NonNullable<Entity['relations']> = []): Entity => ({
  id, name, interfaces: ['Item'], components: ident(name, `item-${id}`),
  relations: [{ id: `${id}_in`, type: 'inLayer', to: layer, props: {} }, ...extra],
});

function bestand(compareFor?: string): Entity[] {
  return [
    L('ly_spiel', 'Basic Rules'),
    L('ly_vgl', 'New Rules'),
    L('ly_aus', 'Old Supplement'),
    { id: 'camp_a', name: 'Runde A', interfaces: ['Campaign'],
      components: { ...ident('Runde A', 'campaign-0001'), ...(compareFor ? { Campaign: { compareFor } } : {}) },
      relations: [
        { id: 'camp_a_1', type: 'activates', to: 'ly_spiel', props: { order: 10 } },
        { id: 'camp_a_2', type: 'activates', to: 'ly_vgl', props: { mode: 'compare' } },
      ] },
    A('schwert', 'Longsword', 'ly_spiel'),
    /* Eine andere Fassung des Langschwerts: Vergleich von Varianten, kein Extra. */
    A('schwert2', 'Longsword', 'ly_vgl', [{ id: 'schwert2_v', type: 'variantOf', to: 'schwert', props: {} }]),
    A('ring', 'Ring of frost', 'ly_vgl'),
    A('stab', 'Frost staff', 'ly_vgl'),
    A('alt', 'Frost cloak', 'ly_aus'),
  ];
}

async function aufbau(compareFor?: string) {
  const registry = { ...seedRegistry, settings: { ...(seedRegistry.settings ?? {}), campaign: 'camp_a' } };
  const repo = new InMemoryRepository(registry, bestand(compareFor));
  const app = buildApp({ repo });
  const konto = async (name: string, roles: Record<string, 'gm' | 'co-gm' | 'player'>) => {
    await repo.putUser({ id: randomUUID(), name, passwordHash: await hashPassword(PASSWORT), isAdmin: false, actorIds: [], roles });
  };
  await konto('Basil', { camp_a: 'gm' });
  await konto('Mira', { camp_a: 'co-gm' });
  await konto('Pia', { camp_a: 'player' });
  const keks = async (name: string) => {
    const res = await app.inject({ method: 'POST', url: '/api/login', payload: { name, password: PASSWORT } });
    return `nw_session=${res.cookies.find((x) => x.name === 'nw_session')?.value ?? ''}`;
  };
  const rufe = async (name: string, method: 'GET' | 'PUT', url: string) =>
    app.inject({ method, url, headers: { cookie: await keks(name) } });
  return { rufe };
}

type Block = { total: number; rows: { id: string; notInPlay: true }[]; canEnable: { campaign: string } | null };
const ids = (b: { rows: { id: string }[] } | undefined) => (b?.rows ?? []).map((r) => r.id).sort();

describe('compare articles in lists (T-213)', () => {
  it('stand apart in the list, only without a version in play, and only for who sees compare layers', async () => {
    const { rufe } = await aufbau();
    const ohne = (await rufe('Basil', 'GET', '/api/list?type=Item&limit=100')).json() as { total: number; compare?: Block };
    expect(ohne.compare).toBeUndefined();
    const mit = (await rufe('Basil', 'GET', '/api/list?type=Item&limit=100&compare=1')).json() as {
      total: number;
      rows: { id: string }[];
      facets: { layers: { id: string }[] };
      compare: Block;
    };
    /* Das Blatt des Spiels bleibt, wie es war — Zeilen, Zahl, Facetten. */
    expect(ids(mit)).toEqual(['schwert']);
    expect(mit.total).toBe(ohne.total);
    expect(mit.facets.layers.map((l) => l.id)).not.toContain('ly_vgl');
    expect(ids(mit.compare)).toEqual(['ring', 'stab']);
    expect(mit.compare.total).toBe(2);
    expect(mit.compare.rows.every((r) => r.notInPlay)).toBe(true);
    expect(mit.compare.canEnable).toEqual({ campaign: 'camp_a' });
    /* Die Ebene steht mit Namen da, wie im Blatt des Spiels. */
    expect((mit.compare.rows[0] as unknown as { layers: string[] }).layers).toEqual(['New Rules']);
    /* Dieselben Filter gelten. */
    const q = (await rufe('Basil', 'GET', '/api/list?type=Item&q=ring&compare=1')).json() as { compare: Block };
    expect(ids(q.compare)).toEqual(['ring']);
    /* Mitleitung sieht, schaltet aber nicht; Spielende sehen nichts. */
    const mira = (await rufe('Mira', 'GET', '/api/list?type=Item&compare=1')).json() as { compare: Block };
    expect(ids(mira.compare)).toEqual(['ring', 'stab']);
    expect(mira.compare.canEnable).toBeNull();
    expect((await rufe('Pia', 'GET', '/api/list?type=Item&compare=1')).json().compare).toBeUndefined();
  });

  it('find compare articles in the search, apart from the hits in play', async () => {
    const { rufe } = await aufbau();
    const s = (await rufe('Basil', 'GET', '/api/search?q=frost&compare=1')).json() as { rows: { id: string }[]; total: number; compare: Block };
    expect(ids(s)).toEqual([]);
    expect(s.total).toBe(0);
    /* Der Mantel liegt in einer Ebene, die weder spielt noch verglichen wird. */
    expect(ids(s.compare)).toEqual(['ring', 'stab']);
    expect((s.compare.rows[0] as unknown as { layers: string[] }).layers).toEqual(['New Rules']);
    const lang = (await rufe('Basil', 'GET', '/api/search?q=longsword&compare=1')).json() as { rows: { id: string }[]; compare: Block };
    expect(ids(lang)).toEqual(['schwert']);
    expect(ids(lang.compare)).toEqual([]);
    expect((await rufe('Basil', 'GET', '/api/search?q=frost')).json().compare).toBeUndefined();
    expect((await rufe('Pia', 'GET', '/api/search?q=frost&compare=1')).json().compare).toBeUndefined();
  });

  it('go into play with “Enable” and leave the compare block', async () => {
    const { rufe } = await aufbau();
    expect((await rufe('Basil', 'PUT', '/api/campaigns/camp_a/enabled/ring')).statusCode).toBe(200);
    const nach = (await rufe('Basil', 'GET', '/api/list?type=Item&limit=100&compare=1')).json() as { rows: { id: string }[]; compare: Block };
    expect(ids(nach)).toEqual(['ring', 'schwert']);
    expect(ids(nach.compare)).toEqual(['stab']);
  });

  it('show players compare articles when the campaign says so, without “Enable”', async () => {
    const { rufe } = await aufbau('players');
    const pia = (await rufe('Pia', 'GET', '/api/list?type=Item&compare=1')).json() as { compare: Block };
    expect(ids(pia.compare)).toEqual(['ring', 'stab']);
    expect(pia.compare.canEnable).toBeNull();
    const k = (await rufe('Pia', 'GET', '/api/campaigns')).json() as { current: { compare: number } };
    expect(k.current.compare).toBe(1);
  });

  it('tell the header how many compare layers there are (none for players)', async () => {
    const { rufe } = await aufbau();
    expect(((await rufe('Basil', 'GET', '/api/campaigns')).json() as { current: { compare: number } }).current.compare).toBe(1);
    expect(((await rufe('Pia', 'GET', '/api/campaigns')).json() as { current: { compare: number } }).current.compare).toBe(0);
  });
});

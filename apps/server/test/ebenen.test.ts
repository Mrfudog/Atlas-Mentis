/**
 * Ausgeblendete Ebenen (T-069): die Listen sagen, was fehlt, weil die
 * laufende Kampagne seine Ebene nicht aufschaltet; die Kampagnenseite
 * schaltet auf; das Register zählt gespeichert und sichtbar.
 *
 * Geprüft wird vor allem das Recht: die Leitung der einen Runde schaltet
 * keine Ebene auf, die genau einer anderen gehört — sonst sähe sie, was
 * dort nur deren Leitung sieht.
 */

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import type { Entity } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';

const PASSWORT = 'nebel-wacht-am-tor';
type Rolle = 'gm' | 'co-gm' | 'player' | 'spectator';

const ident = (name: string, id: string) => ({
  Identity: { name, id, aliases: [] },
  Status: { status: 'ready' },
});
const ebene = (id: string, name: string, n: number, order: number): Entity => ({
  id,
  name,
  interfaces: ['Layer'],
  components: { ...ident(name, `layer-00${n}`), Layer: { kind: 'campaign', order } },
  relations: [],
});
const kampagne = (id: string, name: string, n: number, ly: string): Entity => ({
  id,
  name,
  interfaces: ['Campaign'],
  components: ident(name, `campaign-000${n}`),
  relations: [{ id: `${id}_ac`, type: 'activates', to: ly, props: {} }],
});
const regel = (id: string, n: number, ly?: string): Entity => ({
  id,
  name: id,
  interfaces: ['Rule'],
  components: ident(id, `rule-000${n}`),
  relations: ly ? [{ id: `${id}_in`, type: 'inLayer', to: ly, props: {} }] : [],
});

const BESTAND = [
  ebene('ly_5e', 'D&D 5e (2014)', 1, 0),
  ebene('ly_a', 'Runde A', 2, 50),
  ebene('ly_b', 'Runde B', 3, 50),
  kampagne('camp_a', 'Aus Nebel wacht', 1, 'ly_a'),
  kampagne('camp_b', 'Der Salzpfad', 2, 'ly_b'),
  regel('r_frei', 1),
  regel('r_a', 2, 'ly_a'),
  regel('r_5e_1', 3, 'ly_5e'),
  regel('r_5e_2', 4, 'ly_5e'),
  regel('r_5e_3', 5, 'ly_5e'),
  regel('r_b', 6, 'ly_b'),
];

async function aufbau() {
  const repo = new InMemoryRepository(seedRegistry, BESTAND);
  const app = buildApp({ repo });
  const konto = async (name: string, opts: { admin?: boolean; roles?: Record<string, Rolle> } = {}) => {
    await repo.putUser({
      id: randomUUID(),
      name,
      passwordHash: await hashPassword(PASSWORT),
      isAdmin: opts.admin ?? false,
      actorIds: [],
      roles: opts.roles ?? {},
    });
  };
  await konto('Admin', { admin: true });
  await konto('Basil', { roles: { camp_a: 'gm' } });
  await konto('Mira', { roles: { camp_a: 'co-gm' } });
  await konto('Sela', { roles: { camp_a: 'player' } });
  const kekse = new Map<string, string>();
  const keks = async (name: string) => {
    if (kekse.has(name)) return kekse.get(name)!;
    const res = await app.inject({ method: 'POST', url: '/api/login', payload: { name, password: PASSWORT } });
    const c = `nw_session=${res.cookies.find((x) => x.name === 'nw_session')?.value ?? ''}`;
    kekse.set(name, c);
    return c;
  };
  const rufe = async (name: string, method: 'GET' | 'POST' | 'PUT', url: string, payload?: unknown) =>
    app.inject({
      method,
      url,
      headers: { cookie: await keks(name) },
      ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
    });
  return { repo, rufe };
}

const namen = (l: { rows: { id: string }[] }) => l.rows.map((z) => z.id).sort();

describe('the lists say what a layer that is off hides', () => {
  it('counts per layer, with the running campaign, and offers the switch to who may', async () => {
    const { rufe } = await aufbau();
    const admin = (await rufe('Admin', 'GET', '/api/list?type=Rule')).json();
    expect(namen(admin)).toEqual(['r_a', 'r_frei']);
    expect(admin.unactivated).toEqual({
      campaign: { id: 'camp_a', name: 'Aus Nebel wacht' },
      total: 4,
      layers: [
        { id: 'ly_5e', name: 'D&D 5e (2014)', count: 3, canActivate: true },
        { id: 'ly_b', name: 'Runde B', count: 1, canActivate: true },
      ],
    });
    /* Die Leitung schaltet 5e.tools auf, nicht die Ebene der anderen Runde. */
    const basil = (await rufe('Basil', 'GET', '/api/list?type=Rule')).json();
    expect(basil.unactivated.layers.map((l: { canActivate: boolean }) => l.canActivate)).toEqual([true, false]);
    const sela = (await rufe('Sela', 'GET', '/api/list?type=Rule')).json();
    expect(sela.unactivated.total).toBe(4);
    expect(sela.unactivated.layers.every((l: { canActivate: boolean }) => !l.canActivate)).toBe(true);
  });

  it('follows the filters of the page and stays away from a lookup by ids', async () => {
    const { rufe } = await aufbau();
    const such = (await rufe('Admin', 'GET', '/api/list?type=Rule&q=r_5e_1')).json();
    expect(such.unactivated.total).toBe(1);
    expect((await rufe('Admin', 'GET', '/api/list?q=nichts-dergleichen')).json().unactivated).toBeUndefined();
    expect((await rufe('Admin', 'GET', '/api/list?ids=r_a')).json().unactivated).toBeUndefined();
  });
});

describe('the campaign page switches layers on', () => {
  it('lists every layer, the active ones first, with who else runs it', async () => {
    const { rufe } = await aufbau();
    const res = await rufe('Basil', 'GET', '/api/campaigns/camp_a/layers');
    expect(res.statusCode).toBe(200);
    const l = res.json();
    expect(l.may).toBe('manage');
    expect(l.layers.map((x: { id: string; active: boolean }) => [x.id, x.active])).toEqual([
      ['ly_a', true],
      ['ly_5e', false],
      ['ly_b', false],
    ]);
    expect(l.layers.find((x: { id: string }) => x.id === 'ly_5e')).toMatchObject({ articles: 3, canActivate: true });
    expect(l.layers.find((x: { id: string }) => x.id === 'ly_b')).toMatchObject({
      alsoIn: ['Der Salzpfad'],
      canActivate: false,
    });
    expect((await rufe('Mira', 'GET', '/api/campaigns/camp_a/layers')).json().may).toBe('see');
    expect((await rufe('Sela', 'GET', '/api/campaigns/camp_a/layers')).statusCode).toBe(403);
  });

  it('names the group of a book layer, from its tag (T-081)', async () => {
    const { rufe, repo } = await aufbau();
    const buch = (id: string, name: string, n: number, tags?: string[]): Entity => ({
      ...ebene(id, name, n, 0),
      components: { ...ident(name, `layer-00${n}`), Layer: { kind: 'book', order: 0 }, ...(tags ? { Tags: { tags } } : {}) },
    });
    await repo.putEntity(buch('e5_book_phb', "Player's Handbook", 7, ['core']));
    await repo.putEntity(buch('e5_book_cos', 'Curse of Strahd', 8, ['adventure']));
    await repo.putEntity(buch('e5_book_x', 'X', 9));
    const l = (await rufe('Basil', 'GET', '/api/campaigns/camp_a/layers')).json();
    const gruppe = (id: string) => l.layers.find((x: { id: string }) => x.id === id)?.group;
    expect([gruppe('e5_book_phb'), gruppe('e5_book_cos'), gruppe('e5_book_x'), gruppe('ly_a')]).toEqual(['core', 'adventure', 'sourcebook', '']);
  });

  it('turns one on at the place its own order says, and the articles are back', async () => {
    const { rufe, repo } = await aufbau();
    const res = await rufe('Basil', 'POST', '/api/campaigns/camp_a/layers/ly_5e');
    expect(res.statusCode).toBe(200);
    /* Das Regelwerk (order 0) kommt unter die Kampagnenebene (order 50). */
    expect(res.json().layers).toEqual(['ly_5e', 'ly_a']);
    const c = await repo.getEntity('camp_a');
    expect(c?.relations?.filter((r) => r.type === 'activates').map((r) => [r.to, r.props?.['order']])).toEqual([
      ['ly_5e', 10],
      ['ly_a', 20],
    ]);
    const liste = (await rufe('Basil', 'GET', '/api/list?type=Rule')).json();
    expect(namen(liste)).toEqual(['r_5e_1', 'r_5e_2', 'r_5e_3', 'r_a', 'r_frei']);
    expect(liste.unactivated.layers.map((l: { id: string }) => l.id)).toEqual(['ly_b']);
  });

  it('writes the whole stack in order, and only who manages', async () => {
    const { rufe } = await aufbau();
    expect((await rufe('Basil', 'PUT', '/api/campaigns/camp_a/layers', { layers: ['ly_a', 'ly_5e'] })).json().layers).toEqual([
      'ly_a',
      'ly_5e',
    ]);
    const l = (await rufe('Basil', 'GET', '/api/campaigns/camp_a/layers')).json();
    expect(l.layers.slice(0, 2).map((x: { id: string }) => x.id)).toEqual(['ly_a', 'ly_5e']);
    /* Abschalten löscht nichts: die Artikel fehlen nur in der Liste. */
    expect((await rufe('Basil', 'PUT', '/api/campaigns/camp_a/layers', { layers: [] })).statusCode).toBe(200);
    expect((await rufe('Admin', 'GET', '/api/list?type=Rule')).json().unactivated.total).toBe(5);
    expect((await rufe('Mira', 'PUT', '/api/campaigns/camp_a/layers', { layers: [] })).statusCode).toBe(403);
    expect((await rufe('Sela', 'POST', '/api/campaigns/camp_a/layers/ly_5e')).statusCode).toBe(403);
    expect((await rufe('Basil', 'PUT', '/api/campaigns/camp_a/layers', { layers: ['r_a'] })).statusCode).toBe(400);
  });

  it('keeps a layer of another campaign from the GM, not from the admin', async () => {
    const { rufe } = await aufbau();
    expect((await rufe('Basil', 'POST', '/api/campaigns/camp_a/layers/ly_b')).statusCode).toBe(403);
    expect((await rufe('Basil', 'PUT', '/api/campaigns/camp_a/layers', { layers: ['ly_a', 'ly_b'] })).statusCode).toBe(403);
    expect((await rufe('Admin', 'POST', '/api/campaigns/camp_a/layers/ly_b')).statusCode).toBe(200);
  });
});

describe('the registry counts stored and in play', () => {
  it('gives both numbers per type and names the campaign', async () => {
    const { rufe } = await aufbau();
    const u = (await rufe('Admin', 'GET', '/api/registry/usage')).json();
    expect(u.types['Rule']).toBe(6);
    expect(u.inPlay['Rule']).toBe(2);
    expect(u.campaign).toEqual({ id: 'camp_a', name: 'Aus Nebel wacht' });
  });
});

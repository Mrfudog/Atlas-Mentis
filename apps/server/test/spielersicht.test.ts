/**
 * Die Sicht eines Mitglieds (REQ-241, E-019 a): die Leitung sieht, was ein
 * Spieler sieht — gerechnet am Server als dieses Konto, nur zum Lesen,
 * und protokolliert.
 */

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import type { Entity } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';

const PASSWORT = 'nebel-wacht-am-tor';

const ebene = (id: string): Entity => ({
  id,
  interfaces: ['Layer'],
  name: id,
  components: { Identity: { name: id, id: `layer-${id}`, aliases: [] } },
  relations: [],
});
const runde: Entity = {
  id: 'camp_nebel',
  interfaces: ['Campaign'],
  name: 'Nebelwacht',
  components: { Identity: { name: 'Nebelwacht', id: 'campaign-0001', aliases: [] } },
  relations: [{ id: 'a1', type: 'activates', to: 'ly_nebel', props: { order: 5 } }],
};
const andere: Entity = {
  id: 'camp_salz',
  interfaces: ['Campaign'],
  name: 'Salz',
  components: { Identity: { name: 'Salz', id: 'campaign-0002', aliases: [] } },
  relations: [],
};
const artikel = (id: string, name: string, extra: Record<string, unknown> = {}): Entity => ({
  id,
  interfaces: ['Place'],
  name,
  components: { Identity: { name, id: `place-${id}`, aliases: [] }, ...extra },
  relations: [{ id: `${id}~l`, type: 'inLayer', to: 'ly_nebel', props: {} }],
});

async function aufbau() {
  const repo = new InMemoryRepository(
    { ...seedRegistry, settings: { ...(seedRegistry.settings ?? {}), campaign: 'camp_nebel' } },
    [
      ebene('ly_nebel'),
      runde,
      andere,
      artikel('p_markt', 'Der Markt'),
      artikel('p_idee', 'Der verborgene Hafen', { Status: { status: 'idea' } }),
      artikel('p_geheim', 'Die Gruft', { Visibility: { audience: 'gm' } }),
    ],
  );
  const app = buildApp({ repo });
  const ids = new Map<string, string>();
  const konto = async (name: string, opts: { admin?: boolean; roles?: Record<string, 'gm' | 'co-gm' | 'player' | 'spectator'> }) => {
    const id = `u_${name.toLowerCase()}_${randomUUID().slice(0, 4)}`;
    ids.set(name, id);
    await repo.putUser({
      id,
      name,
      passwordHash: await hashPassword(PASSWORT),
      isAdmin: opts.admin ?? false,
      actorIds: [],
      roles: opts.roles ?? {},
    });
  };
  await konto('Basil', { admin: true, roles: { camp_nebel: 'spectator' } });
  await konto('Mira', { roles: { camp_nebel: 'gm' } });
  await konto('Cora', { roles: { camp_nebel: 'co-gm' } });
  await konto('Sela', { roles: { camp_nebel: 'player' } });
  await konto('Tom', { roles: { camp_nebel: 'player' } });
  await konto('Salzleitung', { roles: { camp_salz: 'gm' } });
  await konto('Fremd', { roles: { camp_salz: 'player' } });

  const kekse = new Map<string, string>();
  const keks = async (name: string): Promise<string> => {
    const da = kekse.get(name);
    if (da) return da;
    const res = await app.inject({ method: 'POST', url: '/api/login', payload: { name, password: PASSWORT } });
    const c = res.cookies.find((x) => x.name === 'nw_session');
    if (!c) throw new Error(`keine Sitzung für ${name}`);
    const k = `nw_session=${c.value}`;
    kekse.set(name, k);
    return k;
  };
  const als = async (
    name: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    opts: { viewAs?: string; payload?: unknown } = {},
  ) =>
    app.inject({
      method,
      url,
      headers: { cookie: await keks(name), ...(opts.viewAs ? { 'x-view-as': ids.get(opts.viewAs) ?? opts.viewAs } : {}) },
      ...(opts.payload !== undefined ? { payload: opts.payload as object } : {}),
    });
  const liste = async (name: string, viewAs?: string) =>
    ((await als(name, 'GET', '/api/list?limit=500', viewAs ? { viewAs } : {})).json() as { rows: { id: string }[] }).rows
      .map((r) => r.id)
      .sort();
  return { repo, app, ids, als, liste };
}

describe('viewing as a member (REQ-241)', () => {
  it('lets the GM see exactly what the player sees — list and single article', async () => {
    const { als, liste } = await aufbau();
    const mira = await liste('Mira');
    expect(mira).toEqual(expect.arrayContaining(['p_geheim', 'p_idee', 'p_markt']));
    const sela = await liste('Sela');
    expect(sela).toContain('p_markt');
    expect(sela).not.toContain('p_geheim');
    expect(sela).not.toContain('p_idee');
    expect(await liste('Mira', 'Sela')).toEqual(sela);
    expect((await als('Mira', 'GET', '/api/entities/p_geheim', { viewAs: 'Sela' })).statusCode).toBe(404);
    const gesehen = await als('Mira', 'GET', '/api/entities/p_markt', { viewAs: 'Sela' });
    expect(gesehen.statusCode).toBe(200);
    expect(gesehen.json()).toEqual((await als('Sela', 'GET', '/api/entities/p_markt')).json());
  });

  it('includes what the player authored, in any status', async () => {
    const { als, liste, repo, ids } = await aufbau();
    const res = await als('Sela', 'POST', '/api/entities', { payload: { type: 'Place', name: 'Selas Dorf' } });
    expect(res.statusCode).toBe(201);
    const id = (res.json() as Entity).id;
    expect(await repo.authorsOf(id)).toEqual([ids.get('Sela')]);
    expect(await liste('Mira', 'Sela')).toContain(id);
    expect(await liste('Mira', 'Tom')).not.toContain(id);
  });

  it('allows co-gm and admin, but not a fellow player, a GM of another campaign, or a non-member target', async () => {
    const { als, liste } = await aufbau();
    expect(await liste('Cora', 'Sela')).toEqual(await liste('Sela'));
    expect(await liste('Basil', 'Sela')).toEqual(await liste('Sela'));
    expect((await als('Tom', 'GET', '/api/list', { viewAs: 'Sela' })).statusCode).toBe(403);
    expect((await als('Salzleitung', 'GET', '/api/list', { viewAs: 'Sela' })).statusCode).toBe(403);
    expect((await als('Mira', 'GET', '/api/list', { viewAs: 'Fremd' })).statusCode).toBe(403);
    expect((await als('Mira', 'GET', '/api/list', { viewAs: 'u_gibtsnicht' })).statusCode).toBe(403);
    /* Die Leitung nimmt keine Verwaltung ein — sie sähe mehr als sich selbst. */
    expect((await als('Mira', 'GET', '/api/list', { viewAs: 'Basil' })).statusCode).toBe(403);
  });

  it('refuses every write in this view', async () => {
    const { als } = await aufbau();
    const neu = await als('Mira', 'POST', '/api/entities', { viewAs: 'Sela', payload: { type: 'Place', name: 'X' } });
    expect(neu.statusCode).toBe(403);
    expect((neu.json() as { code?: string }).code).toBe('view_as_read_only');
    const ready = await als('Basil', 'POST', '/api/entities/p_idee/ready', { viewAs: 'Sela' });
    expect(ready.statusCode).toBe(403);
    expect((await als('Basil', 'DELETE', '/api/entities/p_markt', { viewAs: 'Sela' })).statusCode).toBe(403);
    expect((await als('Mira', 'GET', '/api/tokens', { viewAs: 'Sela' })).statusCode).toBe(403);
  });

  it('tells /api/me who is seen and by whom, and offers nothing to edit', async () => {
    const { als, ids } = await aufbau();
    const me = (await als('Mira', 'GET', '/api/me', { viewAs: 'Sela' })).json() as {
      user: { id: string };
      writable: string[] | null;
      create: boolean;
      ready: boolean;
      registry: boolean;
      viewAs: { id: string; name: string; role: string; by: { name: string } } | null;
    };
    expect(me.user.id).toBe(ids.get('Sela'));
    expect(me.viewAs).toMatchObject({ id: ids.get('Sela'), name: 'Sela', role: 'player', by: { name: 'Mira' } });
    expect(me.writable).toEqual([]);
    expect([me.create, me.ready, me.registry]).toEqual([false, false, false]);
    const ohne = (await als('Mira', 'GET', '/api/me')).json() as { viewAs: unknown };
    expect(ohne.viewAs).toBeNull();
    const verweigert = (await als('Tom', 'GET', '/api/me', { viewAs: 'Sela' })).json() as {
      viewAs: unknown;
      viewAsRefused?: boolean;
    };
    expect(verweigert.viewAs).toBeNull();
    expect(verweigert.viewAsRefused).toBe(true);
  });

  it('logs one line per beginning, not one per request', async () => {
    const { als, repo, ids } = await aufbau();
    await als('Mira', 'GET', '/api/me', { viewAs: 'Sela' });
    await als('Mira', 'GET', '/api/list', { viewAs: 'Sela' });
    await als('Mira', 'GET', '/api/list', { viewAs: 'Tom' });
    const zeilen = await repo.listEvents({ name: 'view_as.start' });
    expect(zeilen.map((z) => [z.subject, (z.payload as { target: string }).target]).reverse()).toEqual([
      [ids.get('Mira'), ids.get('Sela')],
      [ids.get('Mira'), ids.get('Tom')],
    ]);
  });
});

describe('the members list says where "View as" is offered', () => {
  it('marks members of the running campaign the GM may view as, never herself', async () => {
    const { als } = await aufbau();
    const m = (await als('Mira', 'GET', '/api/campaigns/camp_nebel/members')).json() as {
      members: { name: string; viewAs: boolean }[];
    };
    const wo = Object.fromEntries(m.members.map((x) => [x.name, x.viewAs]));
    expect(wo).toMatchObject({ Mira: false, Sela: true, Tom: true, Cora: true, Basil: false });
    /* In einer Kampagne, die nicht läuft, gibt es die Sicht nicht. */
    const salz = (await als('Salzleitung', 'GET', '/api/campaigns/camp_salz/members')).json() as {
      members: { name: string; viewAs: boolean }[];
    };
    expect(salz.members.every((x) => !x.viewAs)).toBe(true);
  });
});

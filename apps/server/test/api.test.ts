import { beforeEach, describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import type { Entity } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';

const volo: Entity = {
  id: '11111111-1111-4111-8111-111111111111',
  interfaces: ['NPC'],
  name: 'Volo Geddarm',
  tags: ['händler'],
  /* Eine Karte je Bestandteil. `name` und `key` sind Pflicht — ohne sie
     weist die Validierung den Artikel mit 422 ab, was sie soll. */
  components: {
    Identity: { name: 'Volo Geddarm', key: 'npc/volo-geddarm', aliases: ['Der Dicke'] },
    Status: { status: 'used' },
  },
  blocks: [],
  relations: [],
};

/**
 * Angemeldet wie ein echter Client. Seit es Zugänge gibt (REQ-031), weist
 * der Server einen Schreibversuch ohne Sitzung ab — und ein Prüfaufbau, der
 * sich daran vorbeimogelt, prüft nichts: er prüft eine Anwendung, die es
 * nicht gibt. Also legt er ein Konto an und meldet sich an, wie jeder
 * andere auch.
 */
async function makeApp(entities: Entity[] = []) {
  const repo = new InMemoryRepository(seedRegistry, entities);
  const app = buildApp({ repo });
  await repo.putUser({
    id: 'u_test',
    name: 'Prüfer',
    passwordHash: await hashPassword('nebel-wacht-am-tor'),
    isGm: true,
  });
  const res = await app.inject({
    method: 'POST',
    url: '/api/login',
    payload: { name: 'Prüfer', password: 'nebel-wacht-am-tor' },
  });
  const keks = res.cookies.find((c) => c.name === 'nw_session');
  const headers = { cookie: `nw_session=${keks?.value ?? ''}` };
  const inject = (opts: Parameters<typeof app.inject>[0]) =>
    app.inject({ ...(opts as object), headers } as Parameters<typeof app.inject>[0]);
  return { app, repo, inject };
}

describe('GET /api/health', () => {
  it('answers', async () => {
    const { inject } = await makeApp();
    const res = await inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });
});

describe('registry', () => {
  it('serves the seed rows', async () => {
    const { inject } = await makeApp();
    const res = await inject({ method: 'GET', url: '/api/registry' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Object.keys(body.interfaces)).toContain('Statblock');
    expect(body.views.player.label).toBe('Player');
  });

  it('accepts a new interface row — adding an article kind is data, not code', async () => {
    const { inject } = await makeApp();
    const current = (await inject({ method: 'GET', url: '/api/registry' })).json();

    const withRezept = {
      ...current.interfaces,
      Rezept: { name: 'Rezept', label: 'Rezept', extends: ['Identity', 'Description'] },
    };
    const put = await inject({
      method: 'PUT',
      url: '/api/registry/interfaces',
      payload: withRezept,
    });
    expect(put.statusCode).toBe(200);

    const after = (await inject({ method: 'GET', url: '/api/registry' })).json();
    expect(after.interfaces.Rezept.label).toBe('Rezept');
  });

  it('refuses a malformed row rather than storing it', async () => {
    const { inject } = await makeApp();
    const res = await inject({
      method: 'PUT',
      url: '/api/registry/interfaces',
      payload: { Kaputt: { label: 'ohne name' } },
    });
    expect(res.statusCode).toBe(400);
  });

  it('404s an unknown registry part', async () => {
    const { inject } = await makeApp();
    const res = await inject({ method: 'PUT', url: '/api/registry/quatsch', payload: {} });
    expect(res.statusCode).toBe(404);
  });
});

describe('entities', () => {
  let ctx: Awaited<ReturnType<typeof makeApp>>;
  beforeEach(async () => {
    ctx = await makeApp();
  });

  it('round-trips a valid article', async () => {
    const put = await ctx.inject({ method: 'PUT', url: `/api/entities/${volo.id}`, payload: volo });
    expect(put.statusCode).toBe(200);
    expect(put.json().updatedAt).toBeTruthy();

    const get = await ctx.inject({ method: 'GET', url: `/api/entities/${volo.id}` });
    expect(get.statusCode).toBe(200);
    expect(get.json().name).toBe('Volo Geddarm');
  });

  it('records every write in the change chain (REQ-003)', async () => {
    await ctx.inject({ method: 'PUT', url: `/api/entities/${volo.id}`, payload: volo });
    expect(ctx.repo.events.map((e) => e.name)).toContain('entity.written');
  });

  /* Pflicht steht je Feld. Eine Regel ohne `kind` ist eine Regel, von der
     niemand weiss, wann sie gilt. */
  it('refuses an article whose type leaves a required field empty', async () => {
    const broken: Entity = {
      ...volo,
      id: '22222222-2222-4222-8222-222222222222',
      interfaces: ['Rule'],
    };
    const res = await ctx.inject({ method: 'PUT', url: `/api/entities/${broken.id}`, payload: broken });
    expect(res.statusCode).toBe(422);
    const issues = res.json().issues as { code: string; component?: string; property?: string }[];
    expect(issues.map((i) => i.code)).toContain('missing_property');
    expect(issues.find((i) => i.property === 'kind')?.component).toBe('Rule');
  });

  /* Und eine Karte, deren Art der Artikel gar nicht ist, ist kein Tippfehler
     im Register, sondern ein Wert ohne Erklärung. */
  it('refuses a card whose type the article does not inherit', async () => {
    const odd: Entity = {
      ...volo,
      id: '33333333-3333-4333-8333-333333333333',
      components: { ...volo.components, Map: { fog: true } },
    };
    const res = await ctx.inject({ method: 'PUT', url: `/api/entities/${odd.id}`, payload: odd });
    expect(res.statusCode).toBe(422);
    expect(res.json().issues.map((i: { code: string }) => i.code)).toContain('card_not_inherited');
  });

  it('refuses an edge pointing at nothing', async () => {
    const dangling: Entity = {
      ...volo,
      relations: [{ id: 'r1', type: 'wohntIn', to: 'gibt-es-nicht' }],
    };
    const res = await ctx.inject({ method: 'PUT', url: `/api/entities/${volo.id}`, payload: dangling });
    expect(res.statusCode).toBe(422);
    expect(res.json().issues.map((i: { code: string }) => i.code)).toContain('dangling_relation');
  });

  it('refuses a body whose id disagrees with the path', async () => {
    const res = await ctx.inject({ method: 'PUT', url: '/api/entities/andere-id', payload: volo });
    expect(res.statusCode).toBe(400);
  });

  it('refuses a body that is not an article at all', async () => {
    const res = await ctx.inject({
      method: 'PUT',
      url: `/api/entities/${volo.id}`,
      payload: { nonsense: true },
    });
    expect(res.statusCode).toBe(400);
  });

  it('404s an unknown id on read and on delete', async () => {
    expect((await ctx.inject({ method: 'GET', url: '/api/entities/weg' })).statusCode).toBe(404);
    expect((await ctx.inject({ method: 'DELETE', url: '/api/entities/weg' })).statusCode).toBe(404);
  });

  it('deletes', async () => {
    await ctx.inject({ method: 'PUT', url: `/api/entities/${volo.id}`, payload: volo });
    expect((await ctx.inject({ method: 'DELETE', url: `/api/entities/${volo.id}` })).statusCode).toBe(200);
    expect((await ctx.inject({ method: 'GET', url: `/api/entities/${volo.id}` })).statusCode).toBe(404);
  });
});

describe('POST /api/validate', () => {
  it('reports the same issues as a write, without writing', async () => {
    const { inject, repo } = await makeApp();
    const broken: Entity = { ...volo, interfaces: ['Rule'] };
    const res = await inject({ method: 'POST', url: '/api/validate', payload: broken });
    expect(res.statusCode).toBe(200);
    expect(res.json().issues.length).toBeGreaterThan(0);
    expect(await repo.listEntities()).toEqual([]);
  });
});

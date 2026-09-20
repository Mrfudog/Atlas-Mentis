import { beforeEach, describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import type { Entity } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';

const volo: Entity = {
  id: '11111111-1111-4111-8111-111111111111',
  interfaces: ['NPC'],
  name: 'Volo Geddarm',
  tags: ['händler'],
  components: {
    Name: { text: 'Volo Geddarm' },
    Identity: { key: 'npc/volo-geddarm', aliases: ['Der Dicke'] },
    /* `Base` verlangt Status. Ohne die Karte weist die Validierung den
       Artikel mit 422 ab — was sie soll; die Vorlage war die veraltete
       Seite, nicht die Regel. */
    Status: { value: 'used' },
  },
  blocks: [],
  relations: [],
};

function makeApp(entities: Entity[] = []) {
  const repo = new InMemoryRepository(seedRegistry, entities);
  return { app: buildApp({ repo }), repo };
}

describe('GET /api/health', () => {
  it('answers', async () => {
    const { app } = makeApp();
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });
});

describe('registry', () => {
  it('serves the seed rows', async () => {
    const { app } = makeApp();
    const res = await app.inject({ method: 'GET', url: '/api/registry' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Object.keys(body.interfaces)).toContain('Statblock');
    expect(body.views.spieler.label).toBe('Spieler');
  });

  it('accepts a new interface row — adding an article kind is data, not code', async () => {
    const { app } = makeApp();
    const current = (await app.inject({ method: 'GET', url: '/api/registry' })).json();

    const withRezept = {
      ...current.interfaces,
      Rezept: { name: 'Rezept', label: 'Rezept', extends: ['Base'], allows: ['Description'] },
    };
    const put = await app.inject({
      method: 'PUT',
      url: '/api/registry/interfaces',
      payload: withRezept,
    });
    expect(put.statusCode).toBe(200);

    const after = (await app.inject({ method: 'GET', url: '/api/registry' })).json();
    expect(after.interfaces.Rezept.label).toBe('Rezept');
  });

  it('refuses a malformed row rather than storing it', async () => {
    const { app } = makeApp();
    const res = await app.inject({
      method: 'PUT',
      url: '/api/registry/interfaces',
      payload: { Kaputt: { label: 'ohne name' } },
    });
    expect(res.statusCode).toBe(400);
  });

  it('404s an unknown registry part', async () => {
    const { app } = makeApp();
    const res = await app.inject({ method: 'PUT', url: '/api/registry/quatsch', payload: {} });
    expect(res.statusCode).toBe(404);
  });
});

describe('entities', () => {
  let ctx: ReturnType<typeof makeApp>;
  beforeEach(() => {
    ctx = makeApp();
  });

  it('round-trips a valid article', async () => {
    const put = await ctx.app.inject({ method: 'PUT', url: `/api/entities/${volo.id}`, payload: volo });
    expect(put.statusCode).toBe(200);
    expect(put.json().updatedAt).toBeTruthy();

    const get = await ctx.app.inject({ method: 'GET', url: `/api/entities/${volo.id}` });
    expect(get.statusCode).toBe(200);
    expect(get.json().name).toBe('Volo Geddarm');
  });

  it('records every write in the change chain (REQ-003)', async () => {
    await ctx.app.inject({ method: 'PUT', url: `/api/entities/${volo.id}`, payload: volo });
    expect(ctx.repo.events.map((e) => e.name)).toContain('entity.written');
  });

  it('refuses an article whose interface requires a missing component', async () => {
    const broken: Entity = { ...volo, id: '22222222-2222-4222-8222-222222222222', interfaces: ['Statblock'] };
    const res = await ctx.app.inject({ method: 'PUT', url: `/api/entities/${broken.id}`, payload: broken });
    expect(res.statusCode).toBe(422);
    expect(res.json().issues.map((i: { code: string }) => i.code)).toContain('missing_component');
  });

  it('refuses an edge pointing at nothing', async () => {
    const dangling: Entity = {
      ...volo,
      relations: [{ id: 'r1', type: 'wohntIn', to: 'gibt-es-nicht' }],
    };
    const res = await ctx.app.inject({ method: 'PUT', url: `/api/entities/${volo.id}`, payload: dangling });
    expect(res.statusCode).toBe(422);
    expect(res.json().issues.map((i: { code: string }) => i.code)).toContain('dangling_relation');
  });

  it('refuses a body whose id disagrees with the path', async () => {
    const res = await ctx.app.inject({ method: 'PUT', url: '/api/entities/andere-id', payload: volo });
    expect(res.statusCode).toBe(400);
  });

  it('refuses a body that is not an article at all', async () => {
    const res = await ctx.app.inject({
      method: 'PUT',
      url: `/api/entities/${volo.id}`,
      payload: { nonsense: true },
    });
    expect(res.statusCode).toBe(400);
  });

  it('404s an unknown id on read and on delete', async () => {
    expect((await ctx.app.inject({ method: 'GET', url: '/api/entities/weg' })).statusCode).toBe(404);
    expect((await ctx.app.inject({ method: 'DELETE', url: '/api/entities/weg' })).statusCode).toBe(404);
  });

  it('deletes', async () => {
    await ctx.app.inject({ method: 'PUT', url: `/api/entities/${volo.id}`, payload: volo });
    expect((await ctx.app.inject({ method: 'DELETE', url: `/api/entities/${volo.id}` })).statusCode).toBe(200);
    expect((await ctx.app.inject({ method: 'GET', url: `/api/entities/${volo.id}` })).statusCode).toBe(404);
  });
});

describe('POST /api/validate', () => {
  it('reports the same issues as a write, without writing', async () => {
    const { app, repo } = makeApp();
    const broken: Entity = { ...volo, interfaces: ['Statblock'] };
    const res = await app.inject({ method: 'POST', url: '/api/validate', payload: broken });
    expect(res.statusCode).toBe(200);
    expect(res.json().issues.length).toBeGreaterThan(0);
    expect(await repo.listEntities()).toEqual([]);
  });
});

/**
 * Vorlage und Instanz am Server.
 *
 * Eine Instanz speichert nur, was von ihrer Vorlage abweicht. Geprüft wird
 * hier, was eine Oberfläche nicht wissen muss: dass sie aufgelöst ankommt,
 * dass ein zurückgeschickter aufgelöster Artikel nicht jeden Wert der
 * Vorlage festschreibt, und dass Löschen keiner Wache ihre Zahlen nimmt.
 */

import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import type { Entity } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';

const ident = (name: string, id: string) => ({
  Identity: { name, id, aliases: [] },
  Status: { status: 'ready' },
});
const vorlage: Entity = {
  id: 'sb_wache',
  interfaces: ['Statblock'],
  name: 'Wache',
  components: { ...ident('Wache', 'statblock-0001'), Statblock: { ac: 16, hp: 11, speed: '30' } },
  relations: [],
};
const kreatur = (id: string): Entity => ({
  id,
  interfaces: ['Creature'],
  name: id,
  components: ident(id, `creature-${id}`),
  relations: [],
});
const instanz = (id: string, fuer: string, eigen: Entity['components'] = {}): Entity => ({
  id,
  interfaces: ['Statblock'],
  name: id,
  components: { ...ident(id, `statblock-${id}`), ...eigen },
  relations: [
    { id: `${id}_i`, type: 'instanceOf', to: 'sb_wache' },
    { id: `${id}_b`, type: 'belongsTo', to: fuer },
  ],
});

async function makeApp() {
  const repo = new InMemoryRepository(seedRegistry, [
    vorlage,
    kreatur('w1'),
    kreatur('w2'),
    instanz('sb_w1', 'w1'),
    instanz('sb_w2', 'w2', { Statblock: { hp: 18 } }),
  ]);
  const app = buildApp({ repo });
  await repo.putUser({
    id: 'u_test',
    name: 'Prüfer',
    passwordHash: await hashPassword('nebel-wacht-am-tor'),
    isAdmin: true,
    actorIds: [],
    roles: {},
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
  return { repo, inject };
}

describe('an instance on the wire', () => {
  it('goes out resolved, saying what came from the template', async () => {
    const { inject } = await makeApp();
    const w2 = (await inject({ method: 'GET', url: '/api/entities/sb_w2' })).json();
    expect(w2.components.Statblock).toEqual({ ac: 16, hp: 18, speed: '30' });
    expect(w2.fromTemplate.template).toBe('sb_wache');
    expect(w2.fromTemplate.fields).toContain('Statblock.ac');
    expect(w2.fromTemplate.fields).not.toContain('Statblock.hp');
  });

  /* Die Maske schickt den aufgelösten Artikel zurück, mit einer Änderung.
     Gespeichert wird genau die — nicht die Rüstung der Vorlage dazu. */
  it('stores only what differs when the resolved article comes back', async () => {
    const { inject, repo } = await makeApp();
    const w1 = (await inject({ method: 'GET', url: '/api/entities/sb_w1' })).json();
    w1.components.Statblock.speed = '40';
    const res = await inject({ method: 'PUT', url: '/api/entities/sb_w1', payload: w1 });
    expect(res.statusCode).toBe(200);
    const roh = await repo.getEntity('sb_w1');
    expect(roh?.components['Statblock']).toEqual({ speed: '40' });
    expect((roh as Entity & { fromTemplate?: unknown }).fromTemplate).toBeUndefined();
  });

  it('follows the template again when its value is sent', async () => {
    const { inject, repo } = await makeApp();
    const w2 = (await inject({ method: 'GET', url: '/api/entities/sb_w2' })).json();
    w2.components.Statblock.hp = 11;
    await inject({ method: 'PUT', url: '/api/entities/sb_w2', payload: w2 });
    expect((await repo.getEntity('sb_w2'))?.components['Statblock']).toBeUndefined();
  });

  it('passes a corrected template on to every instance that did not set the field', async () => {
    const { inject } = await makeApp();
    const t = (await inject({ method: 'GET', url: '/api/entities/sb_wache' })).json();
    t.components.Statblock.ac = 17;
    t.components.Statblock.hp = 12;
    await inject({ method: 'PUT', url: '/api/entities/sb_wache', payload: t });
    const w1 = (await inject({ method: 'GET', url: '/api/entities/sb_w1' })).json();
    const w2 = (await inject({ method: 'GET', url: '/api/entities/sb_w2' })).json();
    expect(w1.components.Statblock).toMatchObject({ ac: 17, hp: 12 });
    expect(w2.components.Statblock).toMatchObject({ ac: 17, hp: 18 });
  });

  it('leaves the instances what they read when the template is deleted', async () => {
    const { inject, repo } = await makeApp();
    expect((await inject({ method: 'DELETE', url: '/api/entities/sb_wache' })).statusCode).toBe(200);
    const w2 = await repo.getEntity('sb_w2');
    expect(w2?.components['Statblock']).toEqual({ ac: 16, hp: 18, speed: '30' });
    expect(w2?.relations?.some((r) => r.type === 'instanceOf')).toBe(false);
  });

  it('takes a creature’s instance along when the creature goes, and nothing else', async () => {
    const { inject, repo } = await makeApp();
    await inject({ method: 'DELETE', url: '/api/entities/w1' });
    expect(await repo.getEntity('sb_w1')).toBeUndefined();
    expect(await repo.getEntity('sb_w2')).toBeDefined();
    expect(await repo.getEntity('sb_wache')).toBeDefined();
  });
});

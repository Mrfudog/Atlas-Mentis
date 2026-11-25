/**
 * **Schichten** (T-425, E-168, E-173): eine Ansichtszeile mit `adjust`
 * legt sich über die Ansicht ihrer Gruppe. Das Register nimmt sie an (mit
 * Priorität und Position), und die Werkbank meldet, wo zwei Schichten
 * dasselbe Element anfassen.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import type { Registry } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';

const PW = 'nebel-wacht-am-tor';
let repo: InMemoryRepository;
let app: ReturnType<typeof buildApp>;

async function konto(name: string, admin: boolean, roles: Record<string, 'gm' | 'player'> = {}) {
  await repo.putUser({ id: `u_${name}`, name, passwordHash: await hashPassword(PW), isAdmin: admin, actorIds: [], roles });
  const res = await app.inject({ method: 'POST', url: '/api/login', payload: { name, password: PW } });
  return { cookie: `nw_session=${res.cookies.find((c) => c.name === 'nw_session')?.value ?? ''}` };
}

const karte = { id: 'map-if-linked', el: 'map', pos: 15, when: { relation: 'onMap' } };
const schichten = {
  fuerAlle: { label: 'Map if linked', fields: 'all', group: 'full', adjust: { extra: [karte] } },
  nurSitzungen: { label: 'No map on sessions', fields: 'all', group: 'full', priority: 2, applies: { types: ['Session'] }, adjust: { drop: ['map-if-linked'] } },
};

beforeEach(() => {
  repo = new InMemoryRepository(seedRegistry, []);
  app = buildApp({ repo });
});

describe('layers in the registry and the workbench (T-425)', () => {
  it('the registry keeps a layer with priority and position, and the workbench lists the conflict', async () => {
    const admin = await konto('basil', true);
    const put = await app.inject({ method: 'PUT', url: '/api/registry/views', headers: admin, payload: { ...seedRegistry.views, ...schichten } });
    expect(put.statusCode).toBe(200);
    const r = (await app.inject({ method: 'GET', url: '/api/registry', headers: admin })).json() as Registry;
    expect(r.views['nurSitzungen']).toMatchObject({ priority: 2, adjust: { drop: ['map-if-linked'] } });
    expect(r.views['fuerAlle']?.adjust?.extra?.[0]).toMatchObject({ pos: 15 });

    const res = (await app.inject({ method: 'GET', url: '/api/checks?check=viewConflicts&limit=all', headers: admin })).json();
    const c = res.checks[0];
    expect(c.key).toBe('viewConflicts');
    expect(c.hits).toContainEqual(expect.objectContaining({ type: 'view', name: 'full › Session', registry: { tab: 'views', view: 'nurSitzungen' } }));
  });

  it('refuses a position that is not a number, and a player cannot write layers', async () => {
    const admin = await konto('basil', true);
    const falsch = { ...seedRegistry.views, x: { label: 'X', fields: 'all', adjust: { extra: [{ ...karte, pos: 'top' }] } } };
    expect((await app.inject({ method: 'PUT', url: '/api/registry/views', headers: admin, payload: falsch })).statusCode).toBe(400);
    const sela = await konto('sela', false, { camp_a: 'player' });
    expect((await app.inject({ method: 'PUT', url: '/api/registry/views', headers: sela, payload: { ...seedRegistry.views, ...schichten } })).statusCode).toBe(403);
  });
});

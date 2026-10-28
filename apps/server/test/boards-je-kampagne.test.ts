/**
 * Boards je Kampagne (T-413): unter Boards stehen nur Boards im Stapel der
 * laufenden Kampagne. Zwei Kampagnen, je mit ihrem Board aus dem Anlegen;
 * die Liste (`/api/list?type=Board`, wie die Seite Boards fragt) zeigt
 * nach dem Wechsel das Board der anderen nicht mehr.
 *
 * Auf dev erschienen „Demo board" und „Testkampagne" in der neuen Kampagne,
 * weil sie gar nicht lief: die Kampagnenseite zeigte sie, die Kopfleiste
 * noch die Testkampagne, die beide Ebenen aufschaltet (T-411).
 */

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';

const PASSWORT = 'nebel-wacht-am-tor';

describe('boards follow the running campaign (T-413)', () => {
  it('lists only the boards in the stack of the running campaign', async () => {
    const repo = new InMemoryRepository(seedRegistry, []);
    const app = buildApp({ repo });
    await repo.putUser({ id: randomUUID(), name: 'Admin', passwordHash: await hashPassword(PASSWORT), isAdmin: true, actorIds: [], roles: {} });
    const login = await app.inject({ method: 'POST', url: '/api/login', payload: { name: 'Admin', password: PASSWORT } });
    const cookie = `nw_session=${login.cookies.find((x) => x.name === 'nw_session')?.value ?? ''}`;
    const rufe = (method: 'GET' | 'POST' | 'PUT', url: string, payload?: Record<string, unknown>) =>
      app.inject({ method, url, headers: { cookie }, ...(payload ? { payload } : {}) });

    const a = (await rufe('POST', '/api/campaigns', { name: 'Demo' })).json().id as string;
    const b = (await rufe('POST', '/api/campaigns', { name: 'Aus Nebel wacht' })).json().id as string;
    const boards = async () =>
      ((await rufe('GET', '/api/list?type=Board&rel=partOf&limit=200')).json() as { rows: { id: string }[] }).rows.map((r) => r.id).sort();

    expect((await rufe('PUT', '/api/campaigns/current', { id: a })).statusCode).toBe(200);
    expect(await boards()).toEqual([`bd_${a}`]);
    expect((await rufe('PUT', '/api/campaigns/current', { id: b })).statusCode).toBe(200);
    expect(await boards()).toEqual([`bd_${b}`]);
  });
});

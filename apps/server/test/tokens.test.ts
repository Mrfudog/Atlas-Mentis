/**
 * **Design-Tokens als Registerteil** (T-425, REQ-437, E-170 a): die Leitung
 * schreibt sie über `PUT /api/registry/tokens`, die Prüfung lehnt eine
 * unbekannte Rolle ab, eine Spielerin schreibt nichts, und die Werkbank
 * meldet einen zu schwachen Kontrast.
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

beforeEach(() => {
  repo = new InMemoryRepository(seedRegistry, []);
  app = buildApp({ repo });
});

describe('design tokens in the registry (T-425)', () => {
  it('the registry carries the seed tokens, and an admin writes a new one', async () => {
    const admin = await konto('basil', true);
    const r = (await app.inject({ method: 'GET', url: '/api/registry', headers: admin })).json() as Registry;
    expect(r.tokens?.['paper']).toMatchObject({ light: '#fdf1dc', dark: '#2a2119' });
    const neu = { ...r.tokens, danger: { label: 'Danger', role: 'accent', light: '#a3241a', dark: '#e08a74' } };
    expect((await app.inject({ method: 'PUT', url: '/api/registry/tokens', headers: admin, payload: neu })).statusCode).toBe(200);
    const nach = (await app.inject({ method: 'GET', url: '/api/registry', headers: admin })).json() as Registry;
    expect(nach.tokens?.['danger']?.label).toBe('Danger');
  });

  it('refuses an unknown role, and a player cannot write tokens', async () => {
    const admin = await konto('basil', true);
    const falsch = { ...seedRegistry.tokens, x: { label: 'X', role: 'loud', light: '#000000', dark: '#000000' } };
    expect((await app.inject({ method: 'PUT', url: '/api/registry/tokens', headers: admin, payload: falsch })).statusCode).toBe(400);
    const sela = await konto('sela', false, { camp_a: 'player' });
    expect((await app.inject({ method: 'PUT', url: '/api/registry/tokens', headers: sela, payload: seedRegistry.tokens })).statusCode).toBe(403);
  });

  it('the workbench lists a token that reads too weak on its surface', async () => {
    const admin = await konto('basil', true);
    const blass = { ...seedRegistry.tokens, pale: { label: 'Pale', role: 'text', on: 'paper', light: '#f0e0c0', dark: '#eadfca' } };
    await app.inject({ method: 'PUT', url: '/api/registry/tokens', headers: admin, payload: blass });
    const res = (await app.inject({ method: 'GET', url: '/api/checks?check=tokenContrast&limit=all', headers: admin })).json();
    expect(res.checks[0].hits).toEqual([expect.objectContaining({ id: 'token:pale:light', type: 'token', registry: { tab: 'tokens', token: 'pale' } })]);
  });
});

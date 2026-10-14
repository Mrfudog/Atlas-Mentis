import { beforeEach, describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import type { Entity } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';
import { runUserCommand } from '../src/user.js';

/* Werkbank (W9): API-Tokens, Prüfungen, Massenänderungen und Rückgängig —
   gegen den Speicher, wie die übrigen Routen. */

const PW = 'nebel-wacht-am-tor';
const ident = (name: string, id: string) => ({ Identity: { name, id, aliases: [] as string[] } });
const sb = (peg: string, nr: string, name: string, rel: Entity['relations'] = []): Entity => ({
  id: peg,
  interfaces: ['Statblock'],
  name,
  components: { ...ident(name, nr), Statblock: { ac: 11, hp: 20 } },
  relations: rel,
});
const amph = (peg: string, nr: string): Entity => ({
  id: peg,
  interfaces: ['Feature'],
  name: 'Amphibious',
  components: { ...ident('Amphibious', nr), Description: { description: '{CREATURE} can breathe air and water.' } },
  relations: [],
});
const pc: Entity = {
  id: 'pc_sela',
  interfaces: ['PlayerCharacter'],
  name: 'Sela',
  components: { ...ident('Sela', 'playercharacter-0001') },
  relations: [],
};

function bestand(): Entity[] {
  return [
    sb('s1', 'statblock-0001', 'Ogre', [{ id: 's1~c1', type: 'composedOf', to: 'f2' }]),
    sb('s2', 'statblock-0002', 'Half-Ogre', [{ id: 's2~c1', type: 'composedOf', to: 'f3' }]),
    sb('s3', 'statblock-0003', 'Ogre Shaman'),
    sb('s4', 'statblock-0004', 'Goblin'),
    amph('f1', 'feature-0001'),
    amph('f2', 'feature-0002'),
    amph('f3', 'feature-0003'),
    {
      id: 'r1',
      interfaces: ['Rule'],
      name: 'Water',
      components: { ...ident('Water', 'rule-0001'), Description: { description: 'See [[feature-0003|Amphibious]].' } },
      relations: [],
    },
    pc,
  ];
}

let repo: InMemoryRepository;
let app: ReturnType<typeof buildApp>;

async function konto(name: string, opts: { admin?: boolean; roles?: Record<string, 'gm' | 'player'>; actors?: string[] } = {}) {
  await repo.putUser({
    id: `u_${name}`,
    name,
    passwordHash: await hashPassword(PW),
    isAdmin: opts.admin ?? false,
    actorIds: opts.actors ?? [],
    roles: opts.roles ?? {},
  });
  const res = await app.inject({ method: 'POST', url: '/api/login', payload: { name, password: PW } });
  return { cookie: `nw_session=${res.cookies.find((c) => c.name === 'nw_session')?.value ?? ''}` };
}

async function token(headers: Record<string, string>, scope: 'read' | 'write', days?: number) {
  const res = await app.inject({ method: 'POST', url: '/api/tokens', headers, payload: { name: `t-${scope}`, scope, days } });
  expect(res.statusCode).toBe(201);
  return { authorization: `Bearer ${res.json().token as string}` };
}

const ogres = { types: ['Statblock'], where: [{ field: 'name', op: 'endsWith', value: 'Ogre' }] };
const brute = { select: ogres, ops: [{ op: 'set', field: 'Statblock.combatRole', value: 'Brute' }] };

beforeEach(() => {
  repo = new InMemoryRepository(seedRegistry, bestand());
  app = buildApp({ repo });
});

describe('API tokens', () => {
  it('shows the plain token once and keeps only its hash', async () => {
    const admin = await konto('basil', { admin: true });
    const res = await app.inject({ method: 'POST', url: '/api/tokens', headers: admin, payload: { name: 'cli', scope: 'read', days: 7 } });
    expect(res.statusCode).toBe(201);
    const { token: klar, expiresAt } = res.json();
    expect(klar).toMatch(/^atm_/);
    expect(new Date(expiresAt).getTime() - Date.now()).toBeGreaterThan(6.9 * 86400000);
    const liste = (await app.inject({ method: 'GET', url: '/api/tokens', headers: admin })).json();
    expect(liste).toEqual([expect.objectContaining({ name: 'cli', scope: 'read' })]);
    expect(JSON.stringify(liste)).not.toContain(klar);
  });

  it('takes an expiry date instead of days, and refuses one that has passed (T-112)', async () => {
    const admin = await konto('basil', { admin: true });
    const tag = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
    const res = await app.inject({ method: 'POST', url: '/api/tokens', headers: admin, payload: { name: 'dev', scope: 'write', expiresAt: tag } });
    expect(res.statusCode).toBe(201);
    expect(res.json().expiresAt).toBe(`${tag}T23:59:59.999Z`);
    const alt = await app.inject({ method: 'POST', url: '/api/tokens', headers: admin, payload: { name: 'alt', expiresAt: '2020-01-01' } });
    expect(alt.statusCode).toBe(400);
    const unsinn = await app.inject({ method: 'POST', url: '/api/tokens', headers: admin, payload: { name: 'x', expiresAt: 'bald' } });
    expect(unsinn.statusCode).toBe(400);
    /* Weiter als 365 Tage wird gekürzt, nicht abgelehnt. */
    const weit = await app.inject({ method: 'POST', url: '/api/tokens', headers: admin, payload: { name: 'weit', expiresAt: '2999-01-01' } });
    expect(new Date(weit.json().expiresAt).getTime() - Date.now()).toBeLessThanOrEqual(365 * 86400000);
  });

  it('acts as its account, limited to its scope', async () => {
    const admin = await konto('basil', { admin: true });
    const lesen = await token(admin, 'read');
    expect((await app.inject({ method: 'GET', url: '/api/entities/s1', headers: lesen })).statusCode).toBe(200);
    const me = (await app.inject({ method: 'GET', url: '/api/me', headers: lesen })).json();
    expect(me.user.name).toBe('basil');
    expect(me.token).toEqual(expect.objectContaining({ scope: 'read' }));
    const put = await app.inject({ method: 'PUT', url: '/api/entities/s4', headers: lesen, payload: bestand()[3] });
    expect(put.statusCode).toBe(403);
    /* Auch nicht dort, wo das Konto eine eigene Regel hat (Register). */
    const reg = await app.inject({ method: 'PUT', url: '/api/registry/vars', headers: lesen, payload: {} });
    expect(reg.statusCode).toBe(403);
    const schreiben = await token(admin, 'write');
    expect((await app.inject({ method: 'PUT', url: '/api/entities/s4', headers: schreiben, payload: bestand()[3] })).statusCode).toBe(200);
  });

  it('never does more than its account', async () => {
    await konto('basil', { admin: true });
    const sela = await konto('sela', { actors: ['pc_sela'] });
    const t = await token(sela, 'write');
    expect((await app.inject({ method: 'PUT', url: '/api/entities/pc_sela', headers: t, payload: pc })).statusCode).toBe(200);
    expect((await app.inject({ method: 'PUT', url: '/api/entities/s4', headers: t, payload: bestand()[3] })).statusCode).toBe(403);
    expect((await app.inject({ method: 'GET', url: '/api/checks', headers: t })).statusCode).toBe(403);
  });

  it('cannot make tokens, and a revoked, expired or foreign one is nobody', async () => {
    const admin = await konto('basil', { admin: true });
    const t = await token(admin, 'write');
    expect((await app.inject({ method: 'POST', url: '/api/tokens', headers: t, payload: { name: 'x', scope: 'write' } })).statusCode).toBe(403);
    const [eintrag] = (await app.inject({ method: 'GET', url: '/api/tokens', headers: admin })).json();
    expect((await app.inject({ method: 'DELETE', url: `/api/tokens/${eintrag.id}`, headers: admin })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/api/entities', headers: t })).statusCode).toBe(401);
    /* Ein falsches Token neben einem gültigen Keks: niemand, nicht der Keks. */
    expect((await app.inject({ method: 'GET', url: '/api/entities', headers: { ...admin, authorization: 'Bearer atm_falsch' } })).statusCode).toBe(401);
    const alt = await token(admin, 'read');
    for (const tok of await repo.listTokens('u_basil')) {
      // ablaufen lassen, ohne zu warten
      const roh = (repo as unknown as { tokens: Map<string, { expiresAt: string }> }).tokens.get(tok.id)!;
      roh.expiresAt = new Date(Date.now() - 1000).toISOString();
    }
    expect((await app.inject({ method: 'GET', url: '/api/entities', headers: alt })).statusCode).toBe(401);
  });

  it('ends with a disabled account', async () => {
    const admin = await konto('basil', { admin: true });
    const t = await token(admin, 'read');
    const u = (await repo.findUserByName('basil'))!;
    await repo.putUser({ ...u, disabledAt: new Date().toISOString() });
    expect((await app.inject({ method: 'GET', url: '/api/entities', headers: t })).statusCode).toBe(401);
  });

  it('is made, listed and revoked from the command line', async () => {
    await konto('werkbank', { admin: true });
    const out = await runUserCommand(repo, ['token', 'werkbank', 'new', 'claude-dev', '--days', '14', '--write']);
    const klar = /atm_[\w-]+/.exec(out)![0];
    expect(out).toMatch(/write/);
    const me = (await app.inject({ method: 'GET', url: '/api/me', headers: { authorization: `Bearer ${klar}` } })).json();
    expect(me.token.name).toBe('claude-dev');
    const liste = await runUserCommand(repo, ['token', 'werkbank', 'list']);
    expect(liste).toMatch(/claude-dev {2}write/);
    const id = /tok_[\w-]+/.exec(liste)![0];
    expect(await runUserCommand(repo, ['token', 'werkbank', 'drop', id])).toBe('Widerrufen.');
  });
});

describe('GET /api/checks', () => {
  it('is for lead and administration only', async () => {
    const sela = await konto('sela', { actors: ['pc_sela'] });
    expect((await app.inject({ method: 'GET', url: '/api/checks', headers: sela })).statusCode).toBe(403);
    const mira = await konto('mira', { roles: { camp_a: 'gm' } });
    expect((await app.inject({ method: 'GET', url: '/api/checks', headers: mira })).statusCode).toBe(200);
  });

  it('counts each check and gives examples, also over a read token', async () => {
    const admin = await konto('basil', { admin: true });
    const t = await token(admin, 'read');
    const res = await app.inject({ method: 'GET', url: '/api/checks?limit=1', headers: t });
    const { total, checks } = res.json();
    expect(total).toBe(9);
    const doppel = checks.find((c: { key: string }) => c.key === 'duplicates');
    expect(doppel.count).toBe(1);
    expect(doppel.hits[0].group).toEqual(['f1', 'f2', 'f3']);
    const nur = (await app.inject({ method: 'GET', url: '/api/checks?check=duplicates&limit=all', headers: t })).json();
    expect(nur.checks.map((c: { key: string }) => c.key)).toEqual(['duplicates']);
  });
});

describe('POST /api/bulk', () => {
  it('previews without writing — also over a read token', async () => {
    const admin = await konto('basil', { admin: true });
    const t = await token(admin, 'read');
    const res = await app.inject({ method: 'POST', url: '/api/bulk', headers: t, payload: { ...brute, dryRun: true } });
    expect(res.statusCode).toBe(200);
    const r = res.json();
    expect(r).toEqual(expect.objectContaining({ dryRun: true, selected: 2, changed: 2, deleted: 0, rejectedCount: 0 }));
    expect(r.examples.map((e: { name: string }) => e.name)).toEqual(['Ogre', 'Half-Ogre']);
    expect((await repo.getEntity('s1'))!.components['Statblock']!['combatRole']).toBeUndefined();
    expect((await app.inject({ method: 'POST', url: '/api/bulk', headers: t, payload: brute })).statusCode).toBe(403);
  });

  it('writes, logs the old versions and undoes', async () => {
    const admin = await konto('basil', { admin: true });
    const res = await app.inject({ method: 'POST', url: '/api/bulk', headers: admin, payload: brute });
    expect(res.statusCode).toBe(200);
    const { id, changed } = res.json();
    expect(changed).toBe(2);
    expect((await repo.getEntity('s1'))!.components['Statblock']!['combatRole']).toBe('Brute');
    expect((await repo.getEntity('s3'))!.components['Statblock']!['combatRole']).toBeUndefined();
    const ereignis = await repo.getEvent(id);
    expect((ereignis!.payload as { changes: unknown[] }).changes).toHaveLength(2);
    const liste = (await app.inject({ method: 'GET', url: '/api/bulk', headers: admin })).json();
    expect(liste[0]).toEqual(expect.objectContaining({ id, undone: false, changed: 2 }));
    expect(liste[0].changes).toBeUndefined();

    const undo = await app.inject({ method: 'POST', url: `/api/bulk/${id}/undo`, headers: admin, payload: {} });
    expect(undo.statusCode).toBe(200);
    expect(undo.json().restored).toBe(2);
    expect((await repo.getEntity('s1'))!.components['Statblock']!['combatRole']).toBeUndefined();
    expect((await app.inject({ method: 'POST', url: `/api/bulk/${id}/undo`, headers: admin, payload: {} })).statusCode).toBe(409);
  });

  it('refuses an undo over a later change unless forced', async () => {
    const admin = await konto('basil', { admin: true });
    const { id } = (await app.inject({ method: 'POST', url: '/api/bulk', headers: admin, payload: brute })).json();
    const s1 = (await repo.getEntity('s1'))!;
    s1.components['Statblock']!['hp'] = 99;
    await repo.putEntity(s1);
    const nein = await app.inject({ method: 'POST', url: `/api/bulk/${id}/undo`, headers: admin, payload: {} });
    expect(nein.statusCode).toBe(409);
    expect(nein.json().conflicts).toEqual([expect.objectContaining({ id: 's1', reason: 'changed since' })]);
    expect((await repo.getEntity('s2'))!.components['Statblock']!['combatRole']).toBe('Brute');
    const ja = await app.inject({ method: 'POST', url: `/api/bulk/${id}/undo`, headers: admin, payload: { force: true } });
    expect(ja.statusCode).toBe(200);
    expect((await repo.getEntity('s1'))!.components['Statblock']!['hp']).toBe(20);
  });

  it('writes nothing when one article fails validation', async () => {
    const admin = await konto('basil', { admin: true });
    const groesse = { select: ogres, ops: [{ op: 'set', field: 'Statblock.size', value: 'Gigantic' }] };
    const vorschau = (await app.inject({ method: 'POST', url: '/api/bulk', headers: admin, payload: { ...groesse, dryRun: true } })).json();
    expect(vorschau.rejectedCount).toBe(2);
    expect(vorschau.rejected[0].issues[0]).toMatch(/Gigantic/);
    const res = await app.inject({ method: 'POST', url: '/api/bulk', headers: admin, payload: groesse });
    expect(res.statusCode).toBe(422);
    expect((await repo.getEntity('s1'))!.components['Statblock']!['size']).toBeUndefined();
  });

  it('refuses a selection without any condition', async () => {
    const admin = await konto('basil', { admin: true });
    const res = await app.inject({ method: 'POST', url: '/api/bulk', headers: admin, payload: { select: {}, ops: brute.ops, dryRun: true } });
    expect(res.statusCode).toBe(400);
  });

  it('merges same features: delete needs a confirmation, repoints and undoes', async () => {
    const admin = await konto('basil', { admin: true });
    const merge = {
      select: { types: ['Feature'], where: [{ field: 'name', op: 'eq', value: 'amphibious' }] },
      ops: [{ op: 'merge', mode: 'delete', by: 'content' }],
    };
    const vorschau = (await app.inject({ method: 'POST', url: '/api/bulk', headers: admin, payload: { ...merge, dryRun: true } })).json();
    expect(vorschau).toEqual(expect.objectContaining({ selected: 3, deleted: 2, changed: 3 }));
    const ohne = await app.inject({ method: 'POST', url: '/api/bulk', headers: admin, payload: merge });
    expect(ohne.statusCode).toBe(409);
    expect(ohne.json().error).toMatch(/confirmDelete": 2/);
    const res = await app.inject({ method: 'POST', url: '/api/bulk', headers: admin, payload: { ...merge, confirmDelete: 2 } });
    expect(res.statusCode).toBe(200);
    expect(await repo.getEntity('f2')).toBeUndefined();
    expect((await repo.getEntity('s1'))!.relations).toEqual([{ id: 's1~c1', type: 'composedOf', to: 'f1' }]);
    expect(String((await repo.getEntity('r1'))!.components['Description']!['description'])).toBe('See [[feature-0001|Amphibious]].');

    const undo = await app.inject({ method: 'POST', url: `/api/bulk/${res.json().id}/undo`, headers: admin, payload: {} });
    expect(undo.statusCode).toBe(200);
    expect((await repo.getEntity('f2'))!.name).toBe('Amphibious');
    expect((await repo.getEntity('s1'))!.relations).toEqual([{ id: 's1~c1', type: 'composedOf', to: 'f2' }]);
  });

  it('lets a lead preview, but write only what the account may write', async () => {
    const mira = await konto('mira', { roles: { camp_a: 'gm' } });
    const vorschau = await app.inject({ method: 'POST', url: '/api/bulk', headers: mira, payload: { ...brute, dryRun: true } });
    expect(vorschau.statusCode).toBe(200);
    expect(vorschau.json().rejectedCount).toBe(2);
    expect((await app.inject({ method: 'POST', url: '/api/bulk', headers: mira, payload: brute })).statusCode).toBe(422);
  });
});

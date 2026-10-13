/**
 * Attributsverfahren als Daten und der Gruppenpool (REQ-238, E-016 a):
 * die Kampagne nennt, was erlaubt ist; gewürfelt wird am Server, jeder
 * Wurf steht im Protokoll, und einen Gruppenpool würfelt nur die Leitung
 * neu.
 */

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import type { Entity } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';

const PASSWORT = 'nebel-wacht-am-tor';

const ident = (id: string, name: string, typ: string) => ({ name, id: `${typ.toLowerCase()}-${id}`, aliases: [] });
const pool: Entity = {
  id: 'm_pool',
  interfaces: ['AbilityMethod'],
  name: 'Group pool',
  components: {
    Identity: ident('1', 'Group pool', 'AbilityMethod'),
    Status: { status: 'ready' },
    AbilityMethod: { method: 'roll', dice: '4d6kh3', count: 6, scope: 'party' },
  },
  relations: [],
};
const runde = (methoden: string[]): Entity => ({
  id: 'camp_nebel',
  interfaces: ['Campaign'],
  name: 'Nebelwacht',
  components: { Identity: ident('1', 'Nebelwacht', 'Campaign') },
  relations: methoden.map((m, i) => ({ id: `am${i}`, type: 'allowsMethod', to: m, props: {} })),
});
const gruppe: Entity = {
  id: 'party_1',
  interfaces: ['Party'],
  name: 'Die Wache',
  components: { Identity: ident('1', 'Die Wache', 'Party'), Status: { status: 'ready' } },
  relations: [{ id: 'po', type: 'partyOf', to: 'camp_nebel', props: {} }],
};

async function aufbau(methoden: string[]) {
  const repo = new InMemoryRepository(
    { ...seedRegistry, settings: { ...(seedRegistry.settings ?? {}), campaign: 'camp_nebel' } },
    [pool, runde(methoden), gruppe],
  );
  const app = buildApp({ repo });
  for (const [name, role] of [['Mira', 'gm'], ['Sela', 'player'], ['Tom', 'player'], ['Gast', 'spectator']] as const) {
    await repo.putUser({
      id: `u_${name.toLowerCase()}_${randomUUID().slice(0, 4)}`,
      name,
      passwordHash: await hashPassword(PASSWORT),
      isAdmin: false,
      actorIds: [],
      roles: { camp_nebel: role },
    });
  }
  const als = async (name: string, method: 'GET' | 'POST', url: string, payload?: object) => {
    const login = await app.inject({ method: 'POST', url: '/api/login', payload: { name, password: PASSWORT } });
    const c = login.cookies.find((x) => x.name === 'nw_session')!;
    return app.inject({ method, url, headers: { cookie: `nw_session=${c.value}` }, ...(payload ? { payload } : {}) });
  };
  return { repo, als };
}

describe('ability score methods and the party pool (E-016 a)', () => {
  it('offers standard array and point buy when the campaign names nothing', async () => {
    const { als } = await aufbau([]);
    const res = (await als('Sela', 'GET', '/api/abilities')).json() as { methods: { id: string }[]; parties: { id: string }[] };
    expect(res.methods.map((m) => m.id)).toEqual(['standard-array', 'point-buy']);
    expect(res.parties.map((p) => p.id)).toEqual(['party_1']);
  });

  it('rolls the party pool once, logs it, and only the GM rolls it again', async () => {
    const { als, repo } = await aufbau(['m_pool']);
    const liste = (await als('Sela', 'GET', '/api/abilities')).json() as { methods: { id: string }[] };
    expect(liste.methods.map((m) => m.id)).toEqual(['m_pool']);

    const erst = await als('Sela', 'POST', '/api/abilities/roll', { method: 'm_pool', party: 'party_1' });
    expect(erst.statusCode).toBe(200);
    const werte = (erst.json() as { values: number[] }).values;
    expect(werte).toHaveLength(6);
    for (const w of werte) expect(w).toBeGreaterThanOrEqual(3);

    /* Tom sieht denselben Pool und würfelt nicht neu. */
    const tom = (await als('Tom', 'GET', '/api/abilities')).json() as { parties: { pools: Record<string, { values: number[] }> }[] };
    expect(tom.parties[0]!.pools['m_pool']!.values).toEqual(werte);
    expect((await als('Tom', 'POST', '/api/abilities/roll', { method: 'm_pool', party: 'party_1' })).statusCode).toBe(409);
    expect((await als('Mira', 'POST', '/api/abilities/roll', { method: 'm_pool', party: 'party_1' })).statusCode).toBe(200);
    expect((await als('Gast', 'POST', '/api/abilities/roll', { method: 'm_pool', party: 'party_1' })).statusCode).toBe(403);

    const protokoll = await repo.listEvents({ name: 'abilities.rolled' });
    expect(protokoll).toHaveLength(2);
    expect(protokoll[1]!.payload).toMatchObject({ method: 'm_pool', scope: 'party', values: werte });
    /* Wer gewürfelt hat, steht im Protokoll und nicht im Artikel (REQ-199). */
    expect(JSON.stringify(await repo.getEntity('party_1'))).not.toMatch(/u_/);
  });

  it('refuses a method the campaign does not allow, and one without dice', async () => {
    const { als } = await aufbau([]);
    const r0 = await als('Sela', 'POST', '/api/abilities/roll', { method: 'm_pool', party: 'party_1' });
    expect(r0.statusCode).toBe(400);
    expect((await als('Sela', 'POST', '/api/abilities/roll', { method: 'standard-array' })).statusCode).toBe(400);
  });
});

describe('a player creates her character from the articles (T-080)', () => {
  it('stores class, ancestry, background, answers and her own ready statblock', async () => {
    const regel = (id: string, typ: string, extra: Entity['components'] = {}): Entity => ({
      id,
      interfaces: [typ],
      name: id,
      components: { Identity: ident(id, id, typ), Status: { status: 'ready' }, ...extra },
      relations: [],
    });
    const klasse = regel('cl_1', 'Class', {
      Choices: { choices: [{ id: 'skills', kind: 'proficiency', count: 1, from: { values: ['Athletics', 'Survival'] } }] },
    });
    const repo = new InMemoryRepository(
      { ...seedRegistry, settings: { ...(seedRegistry.settings ?? {}), campaign: 'camp_nebel' } },
      [runde([]), gruppe, klasse, regel('an_1', 'Ancestry'), regel('bg_1', 'Background')],
    );
    const app = buildApp({ repo });
    await repo.putUser({ id: 'u_sela', name: 'Sela', passwordHash: await hashPassword(PASSWORT), isAdmin: false, actorIds: [], roles: { camp_nebel: 'player' } });
    const login = await app.inject({ method: 'POST', url: '/api/login', payload: { name: 'Sela', password: PASSWORT } });
    const cookie = `nw_session=${login.cookies.find((x) => x.name === 'nw_session')!.value}`;
    const post = (payload: object) => app.inject({ method: 'POST', url: '/api/entities', headers: { cookie }, payload });

    const pc = await post({
      type: 'PlayerCharacter',
      name: 'Ilka',
      fields: { 'Status.status': 'ready' },
      relations: [
        { type: 'hasAncestry', to: 'an_1' },
        { type: 'hasBackground', to: 'bg_1' },
        { type: 'hasClass', to: 'cl_1', props: { level: 1 } },
        { type: 'chose', to: 'cl_1', props: { choice: 'skills', picks: ['Survival'] } },
        { type: 'memberOfParty', to: 'party_1' },
      ],
    });
    expect(pc.statusCode).toBe(201);
    const figur = pc.json() as Entity;
    expect(figur.components?.['Status']).toEqual({ status: 'ready' });
    const sb = await post({
      type: 'Statblock',
      name: 'Ilka',
      fields: { 'Status.status': 'ready', 'Abilities.str': 15, 'Abilities.cha': 8 },
      relations: [{ type: 'belongsTo', to: figur.id }],
    });
    expect(sb.statusCode).toBe(201);
    expect((sb.json() as Entity).components?.['Status']).toEqual({ status: 'ready' });
    /* An einer fremden Kreatur wäre das kein Spielercharakter-Statblock. */
    const fremd = await post({ type: 'Statblock', name: 'X', fields: { 'Status.status': 'ready' }, relations: [{ type: 'belongsTo', to: 'party_1' }] });
    expect(fremd.statusCode).not.toBe(201);
  });
});

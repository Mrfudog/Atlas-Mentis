/**
 * Gleichzeitige Änderungen an der Kampagne (T-449, REQ-192). Zwei
 * Schreiber, verschränkt: der erste hat die Kampagne gelesen und gerechnet,
 * und genau bevor er schreibt, läuft der zweite ganz durch. Ohne Revision
 * überschrieb der erste den zweiten (gefunden bei T-401/T-403); jetzt
 * rechnet er einmal neu, und **beide Änderungen stehen danach**.
 *
 * Mit `If-Match` (der ganze Stapel, die Vergleichsebenen) wird nicht neu
 * gerechnet: ein überholter Stand ist eine 409. Bleibt der Konflikt auch
 * beim zweiten Versuch, ebenfalls 409 — keine 500.
 */

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import type { Entity } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository, type PutOptions } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';

const PASSWORT = 'nebel-wacht-am-tor';
const ident = (name: string, id: string) => ({ Identity: { name, id, aliases: [] }, Status: { status: 'ready' } });
const L = (id: string, name: string, kind = 'source', partOf: string[] = []): Entity => ({
  id, name, interfaces: ['Layer'], components: { ...ident(name, `layer-${id}`), Layer: { kind } },
  relations: partOf.map((to, i) => ({ id: `${id}_p${i}`, type: 'partOf', to, props: {} })),
});
const A = (id: string, type: string, name: string, layer: string, mehr: Entity['relations'] = []): Entity => ({
  id, name, interfaces: [type], components: ident(name, `${type.toLowerCase()}-${id}`),
  relations: [{ id: `${id}_in`, type: 'inLayer', to: layer, props: {} }, ...(mehr ?? [])],
});

/** Vor dem Schreiben der Kampagne läuft, was ansteht — der zweite Schreiber. */
class Verschraenkt extends InMemoryRepository {
  dazwischen: (() => Promise<unknown>)[] = [];
  /** Der zweite Schreiber wird selbst nicht unterbrochen. */
  private drin = false;
  override async putEntity(entity: Entity, options?: PutOptions): Promise<Entity> {
    if (entity.id === 'camp_a' && this.dazwischen.length && !this.drin) {
      this.drin = true;
      try {
        await this.dazwischen.shift()!();
      } finally {
        this.drin = false;
      }
    }
    return super.putEntity(entity, options);
  }
}

async function aufbau() {
  const bestand: Entity[] = [
    L('g_adv', 'Adventures', 'group'),
    L('ly_eins', 'Lost Mine', 'adventure', ['g_adv']),
    L('ly14', 'PHB 2014'),
    L('ly24', 'PHB 2024'),
    L('ly_cmp', 'Tomb'),
    L('ly_x', 'Extras'),
    L('ly_y', 'More extras'),
    { id: 'camp_a', name: 'Runde A', interfaces: ['Campaign'], components: ident('Runde A', 'campaign-0001'),
      relations: [
        { id: 'a0', type: 'activates', to: 'ly_eins', props: { order: 5 } },
        { id: 'a1', type: 'activates', to: 'ly24', props: { order: 10 } },
        { id: 'a2', type: 'activates', to: 'ly14', props: { order: 20 } },
      ] },
    A('d14', 'Item', 'Dagger', 'ly14'),
    A('d24', 'Item', 'Dagger', 'ly24', [{ id: 'd24_v', type: 'variantOf', to: 'd14', props: {} }]),
    A('x1', 'Item', 'Odd ring', 'ly_x'),
  ];
  const repo = new Verschraenkt({ ...seedRegistry, settings: { ...(seedRegistry.settings ?? {}), campaign: 'camp_a' } }, bestand);
  const app = buildApp({ repo });
  await repo.putUser({ id: randomUUID(), name: 'Basil', passwordHash: await hashPassword(PASSWORT), isAdmin: false, actorIds: [], roles: { camp_a: 'gm' } });
  const login = await app.inject({ method: 'POST', url: '/api/login', payload: { name: 'Basil', password: PASSWORT } });
  const cookie = `nw_session=${login.cookies.find((x) => x.name === 'nw_session')?.value ?? ''}`;
  const rufe = (method: 'GET' | 'PUT' | 'POST' | 'DELETE', url: string, payload?: unknown, kopf: Record<string, string> = {}) =>
    app.inject({ method, url, headers: { cookie, ...kopf }, ...(payload === undefined ? {} : { payload: payload as object }) });
  const kampagne = async () => (await repo.getEntity('camp_a'))!;
  const kanten = async (type: string) => ((await kampagne()).relations ?? []).filter((r) => r.type === type);
  return { repo, rufe, kampagne, kanten };
}

type Aufbau = Awaited<ReturnType<typeof aufbau>>;
type Schritt = (a: Aufbau) => ReturnType<Aufbau['rufe']>;

/** Je Route ein Schreiber und ein Nachweis, dass seine Änderung steht. */
const SCHREIBER: Record<string, { tut: Schritt; steht: (a: Aufbau) => Promise<boolean> }> = {
  'PUT prefers': {
    tut: (a) => a.rufe('PUT', '/api/campaigns/camp_a/prefers', { to: 'd24' }),
    steht: async (a) => (await a.kanten('prefers')).some((r) => r.to === 'd24'),
  },
  'PUT enabled': {
    tut: (a) => a.rufe('PUT', '/api/campaigns/camp_a/enabled/x1'),
    steht: async (a) => (await a.kanten('enables')).some((r) => r.to === 'x1'),
  },
  'PUT layers/:layer/only': {
    tut: (a) => a.rufe('PUT', '/api/campaigns/camp_a/layers/ly14/only', { types: ['Item'] }),
    steht: async (a) => JSON.stringify((await a.kanten('activates')).find((r) => r.to === 'ly14')?.props ?? {}).includes('Item'),
  },
  'PUT rules/:group': {
    tut: (a) => a.rufe('PUT', '/api/campaigns/camp_a/rules/g_adv', { types: ['Item'] }),
    steht: async (a) => (await a.kanten('layerRule')).some((r) => r.to === 'g_adv'),
  },
  'POST layers/:layer': {
    tut: (a) => a.rufe('POST', '/api/campaigns/camp_a/layers/ly_y'),
    steht: async (a) => (await a.kanten('activates')).some((r) => r.to === 'ly_y'),
  },
  'PUT compare': {
    tut: (a) => a.rufe('PUT', '/api/campaigns/camp_a/compare', { layers: ['ly_cmp'] }),
    steht: async (a) => (await a.kanten('activates')).some((r) => r.to === 'ly_cmp' && (r.props as { mode?: string })?.mode === 'compare'),
  },
  'PUT visibility/rules': {
    tut: (a) => a.rufe('PUT', '/api/campaigns/camp_a/visibility/rules', { id: 'layer:ly14', audience: 'gm' }),
    steht: async (a) => JSON.stringify((await a.kampagne()).components ?? {}).includes('layer:ly14'),
  },
};

describe('two writers on one campaign (T-449)', () => {
  const namen = Object.keys(SCHREIBER);
  /* Jede Route einmal als erster Schreiber, mit dem nächsten als zweitem
     dazwischen — so ist jede einmal die, die neu rechnen muss. */
  for (const [i, erster] of namen.entries()) {
    const zweiter = namen[(i + 1) % namen.length]!;
    it(`${erster} keeps ${zweiter} that came in between`, async () => {
      const a = await aufbau();
      let antwortZwei: Awaited<ReturnType<Schritt>> | undefined;
      a.repo.dazwischen.push(async () => {
        antwortZwei = await SCHREIBER[zweiter]!.tut(a);
      });
      const antwortEins = await SCHREIBER[erster]!.tut(a);
      expect(antwortZwei?.statusCode, antwortZwei?.body).toBe(200);
      expect(antwortEins.statusCode, antwortEins.body).toBe(200);
      expect(await SCHREIBER[zweiter]!.steht(a)).toBe(true);
      expect(await SCHREIBER[erster]!.steht(a)).toBe(true);
    });
  }

  it('DELETE prefers keeps a freigabe that came in between', async () => {
    const a = await aufbau();
    expect((await SCHREIBER['PUT prefers']!.tut(a)).statusCode).toBe(200);
    a.repo.dazwischen.push(() => SCHREIBER['PUT enabled']!.tut(a));
    expect((await a.rufe('DELETE', '/api/campaigns/camp_a/prefers/d24')).statusCode).toBe(200);
    expect(await a.kanten('prefers')).toEqual([]);
    expect(await SCHREIBER['PUT enabled']!.steht(a)).toBe(true);
  });

  it('DELETE enabled keeps a prefers that came in between', async () => {
    const a = await aufbau();
    expect((await SCHREIBER['PUT enabled']!.tut(a)).statusCode).toBe(200);
    a.repo.dazwischen.push(() => SCHREIBER['PUT prefers']!.tut(a));
    expect((await a.rufe('DELETE', '/api/campaigns/camp_a/enabled/x1')).statusCode).toBe(200);
    expect(await a.kanten('enables')).toEqual([]);
    expect(await SCHREIBER['PUT prefers']!.steht(a)).toBe(true);
  });

  it('PUT layers keeps a vorrang that came in between', async () => {
    const a = await aufbau();
    a.repo.dazwischen.push(() => SCHREIBER['PUT prefers']!.tut(a));
    const r = await a.rufe('PUT', '/api/campaigns/camp_a/layers', { layers: ['ly_eins', 'ly24'] });
    expect(r.statusCode, r.body).toBe(200);
    expect((await a.kanten('activates')).map((k) => k.to)).not.toContain('ly14');
    expect(await SCHREIBER['PUT prefers']!.steht(a)).toBe(true);
  });

  it('PUT visibility/rules keeps another rule set at the same time', async () => {
    const a = await aufbau();
    a.repo.dazwischen.push(() => a.rufe('PUT', '/api/campaigns/camp_a/visibility/rules', { id: 'layer:ly24', audience: 'players' }));
    expect((await SCHREIBER['PUT visibility/rules']!.tut(a)).statusCode).toBe(200);
    const json = JSON.stringify((await a.kampagne()).components ?? {});
    expect(json).toContain('layer:ly24');
    expect(json).toContain('layer:ly14');
  });

  it('If-Match: a whole stack against an old revision is a 409, against the current one it goes through', async () => {
    const a = await aufbau();
    /* Der Bestand im Speicher kommt ohne Revision; einmal geschrieben, hat er eine. */
    expect((await SCHREIBER['PUT enabled']!.tut(a)).statusCode).toBe(200);
    const stand = (await a.rufe('GET', '/api/campaigns/camp_a/layers')).json() as { campaign: { revision: number | null } };
    const rev = stand.campaign.revision;
    expect(typeof rev).toBe('number');
    /* Ein anderes Gerät schaltet dazwischen. */
    expect((await SCHREIBER['PUT prefers']!.tut(a)).statusCode).toBe(200);
    const alt = await a.rufe('PUT', '/api/campaigns/camp_a/layers', { layers: ['ly_eins', 'ly24'] }, { 'if-match': `"${rev}"` });
    expect(alt.statusCode).toBe(409);
    expect(alt.json()).toMatchObject({ conflict: { id: 'camp_a', expected: rev } });
    expect((await a.kanten('activates')).map((k) => k.to)).toContain('ly14');
    const jetzt = (await a.kampagne()).revision;
    const neu = await a.rufe('PUT', '/api/campaigns/camp_a/layers', { layers: ['ly_eins', 'ly24'] }, { 'if-match': `"${jetzt}"` });
    expect(neu.statusCode, neu.body).toBe(200);
    expect(await SCHREIBER['PUT prefers']!.steht(a)).toBe(true);
  });

  it('a conflict that holds through the second attempt is a 409, not a 500', async () => {
    const a = await aufbau();
    a.repo.dazwischen.push(
      () => SCHREIBER['PUT enabled']!.tut(a),
      () => SCHREIBER['PUT visibility/rules']!.tut(a),
    );
    const r = await SCHREIBER['PUT prefers']!.tut(a);
    expect(r.statusCode).toBe(409);
    expect((r.json() as { error: string }).error).toMatch(/Reload/);
    /* Was dazwischen kam, steht; was nicht durchging, nicht halb. */
    expect(await SCHREIBER['PUT enabled']!.steht(a)).toBe(true);
    expect(await SCHREIBER['PUT visibility/rules']!.steht(a)).toBe(true);
    expect(await SCHREIBER['PUT prefers']!.steht(a)).toBe(false);
  });
});

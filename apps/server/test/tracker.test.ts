/**
 * Der Initiative-Tracker (T-022): die Reihe für Leitung und Spielende,
 * gesiebt nach der Einstellung der Kampagne, Züge und Effekte durch die
 * Leitung, der eigene Zug durch die Spielerin, und aus heisst aus.
 */

import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import type { Entity, ParticipantProps, Relation, TrackerView } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';

const PASSWORT = 'nebel-wacht-am-tor';
const imLayer = (id: string): Relation => ({ id: `${id}~l`, type: 'inLayer', to: 'ly_nebel', props: {} });

const art = (id: string, type: string, name: string, extra: Record<string, unknown> = {}, relations: Relation[] = []): Entity => ({
  id,
  interfaces: [type],
  name,
  components: { Identity: { name, id: `${type.toLowerCase()}-${id}`, aliases: [] }, ...extra },
  relations: [imLayer(id), ...relations],
});

const kampagne = (regeln: Record<string, unknown> = {}): Entity => ({
  id: 'camp_nebel',
  interfaces: ['Campaign'],
  name: 'Nebelwacht',
  components: { Identity: { name: 'Nebelwacht', id: 'campaign-0001', aliases: [] }, Campaign: regeln },
  relations: [{ id: 'a1', type: 'activates', to: 'ly_nebel', props: { order: 5 } }],
});

const bestand = (regeln?: Record<string, unknown>): Entity[] => [
  { id: 'ly_nebel', interfaces: ['Layer'], name: 'Nebel', components: { Identity: { name: 'Nebel', id: 'layer-1', aliases: [] } }, relations: [] },
  kampagne(regeln),
  art('pt_1', 'Party', 'Die Wache', {}, [{ id: 'po', type: 'partyOf', to: 'camp_nebel', props: {} }]),
  art('pc_1', 'PlayerCharacter', 'Rook', {}, [{ id: 'mp', type: 'memberOfParty', to: 'pt_1', props: {} }]),
  art('npc_ghul', 'Creature', 'Ghul', { Identity: { name: 'Ghul', id: 'creature-1', aliases: [], cover: 'Pale shape' } }),
  art('sb_ghul', 'Statblock', 'Ghul', { Statblock: { ac: 12, hp: 22 } }, [
    { id: 'bt', type: 'belongsTo', to: 'npc_ghul', props: {} },
    { id: 'co', type: 'composedOf', to: 'rule_biss', props: {} },
  ]),
  art('rule_biss', 'Rule', 'Bite'),
  art('cond_prone', 'Condition', 'Prone'),
  art('enc_1', 'Encounter', 'Ghule', { Encounter: { round: 1, turn: 0, phase: 'running' } }, [
    { id: 'p1', type: 'participates', to: 'pc_1', props: { init: 18, hp: 20 } },
    { id: 'p2', type: 'participates', to: 'npc_ghul', props: { init: 12, revealed: true, hp: 10 } },
  ]),
];

async function aufbau(regeln?: Record<string, unknown>) {
  const repo = new InMemoryRepository(
    { ...seedRegistry, settings: { ...(seedRegistry.settings ?? {}), campaign: 'camp_nebel' } },
    bestand(regeln),
  );
  const app = buildApp({ repo });
  const konto = async (name: string, role: 'gm' | 'player', actorIds: string[] = []) =>
    repo.putUser({ id: `u_${name.toLowerCase()}`, name, passwordHash: await hashPassword(PASSWORT), isAdmin: false, actorIds, roles: { camp_nebel: role } });
  await konto('Mira', 'gm');
  await konto('Sela', 'player', ['pc_1']);
  const kekse = new Map<string, string>();
  const keks = async (name: string) => {
    let k = kekse.get(name);
    if (!k) {
      const res = await app.inject({ method: 'POST', url: '/api/login', payload: { name, password: PASSWORT } });
      k = `nw_session=${res.cookies.find((x) => x.name === 'nw_session')!.value}`;
      kekse.set(name, k);
    }
    return k;
  };
  const sicht = async (name: string) =>
    (await app.inject({ method: 'GET', url: '/api/encounters/enc_1/tracker', headers: { cookie: await keks(name) } })).json() as TrackerView & { off?: boolean };
  const tue = async (name: string, op: Record<string, unknown>) =>
    app.inject({ method: 'POST', url: '/api/encounters/enc_1/tracker', headers: { cookie: await keks(name) }, payload: op });
  return { repo, sicht, tue };
}

describe('the initiative tracker (T-022)', () => {
  it('gives the GM the whole order and players the sieved one', async () => {
    const { sicht } = await aufbau();
    const gm = await sicht('Mira');
    expect(gm.gm).toBe(true);
    expect(gm.rows.map((r) => r.name)).toEqual(['Rook', 'Ghul']);
    expect(gm.rows[0]).toMatchObject({ current: true, party: true, hp: 20 });
    expect(gm.rows[1]).toMatchObject({ ac: 12, hp: 10, hpMax: 22, hpState: 'bloodied' });

    const sp = await sicht('Sela');
    expect(sp.gm).toBe(false);
    /* Der Ghul steht erst, wenn sein Zug kam (D58). */
    expect(sp.rows.map((r) => r.name)).toEqual(['Rook']);
  });

  it('moves the turn, and players see a foe once its turn has come — as the campaign says', async () => {
    const { sicht, tue } = await aufbau({ initHealth: 'none', initNames: 'real' });
    expect((await tue('Mira', { op: 'next' })).statusCode).toBe(200);
    const sp = await sicht('Sela');
    const ghul = sp.rows.find((r) => r.edge === 'p2')!;
    expect(ghul).toMatchObject({ name: 'Ghul', to: '', current: true });
    expect(ghul.hp).toBeUndefined();
    expect(ghul.hpState).toBeUndefined();
    expect(ghul.ac).toBeUndefined();
  });

  it('shows the cover name, health as a word, and actions only when allowed', async () => {
    const { sicht, tue } = await aufbau({ initColumns: ['init', 'hp', 'actions'] });
    await tue('Mira', { op: 'next' });
    const ghul = (await sicht('Sela')).rows.find((r) => r.edge === 'p2')!;
    expect(ghul).toMatchObject({ name: 'Pale shape', hpState: 'bloodied' });
    expect(ghul.actions).toBeUndefined();
    expect((await sicht('Mira')).rows.find((r) => r.edge === 'p2')!.actions).toEqual(['Bite']);

    const offen = await aufbau({ initColumns: ['init', 'hp', 'actions'], initActions: 'shown' });
    await offen.tue('Mira', { op: 'next' });
    expect((await offen.sicht('Sela')).rows.find((r) => r.edge === 'p2')!.actions).toEqual(['Bite']);
  });

  it('counts an effect down at the turn it is tied to and drops it', async () => {
    const { sicht, tue, repo } = await aufbau();
    const eff = await tue('Mira', { op: 'effect', edge: 'p1', entry: { rule: 'cond_prone', rounds: 1, anchor: 'p2', at: 'end' } });
    expect(eff.statusCode, eff.body).toBe(200);
    expect((await sicht('Mira')).rows[0]!.effects[0]).toMatchObject({ name: 'Prone', rounds: 1, expires: { round: 1, who: 'Ghul', at: 'end' } });
    expect((await sicht('Sela')).rows[0]!.effects.map((e) => e.name)).toEqual(['Prone']);
    await tue('Mira', { op: 'next' }); /* Ghul fängt an */
    expect((await sicht('Mira')).rows[0]!.effects).toHaveLength(1);
    await tue('Mira', { op: 'next' }); /* Ghul endet, Runde 2 */
    const gm = await sicht('Mira');
    expect(gm.round).toBe(2);
    expect(gm.rows[0]!.effects).toEqual([]);
    const enc = await repo.getEntity('enc_1');
    expect(((enc!.relations ?? []).find((r) => r.id === 'p1')!.props as ParticipantProps).conditions).toEqual([]);
  });

  it('lets a player end only their own turn', async () => {
    const { sicht, tue } = await aufbau();
    expect((await tue('Sela', { op: 'hp', edge: 'p2', delta: -5 })).statusCode).toBe(403);
    expect((await tue('Sela', { op: 'next' })).statusCode).toBe(200);
    /* Jetzt ist der Ghul dran — nicht ihrer. */
    expect((await tue('Sela', { op: 'next' })).statusCode).toBe(403);
    expect((await sicht('Mira')).rows.find((r) => r.current)!.edge).toBe('p2');
  });

  it('adds, damages, delays and removes', async () => {
    const { sicht, tue } = await aufbau();
    await tue('Mira', { op: 'hp', edge: 'p2', delta: -4 });
    await tue('Mira', { op: 'add', to: 'npc_ghul', init: 15, label: 'Ghul 2' });
    let gm = await sicht('Mira');
    expect(gm.rows.map((r) => r.name)).toEqual(['Rook', 'Ghul 2', 'Ghul']);
    expect(gm.rows[2]!.hp).toBe(6);
    expect(gm.rows[0]!.current).toBe(true);
    await tue('Mira', { op: 'delay' });
    gm = await sicht('Mira');
    expect(gm.rows.map((r) => r.name)).toEqual(['Ghul 2', 'Rook', 'Ghul']);
    expect(gm.rows[0]!.current).toBe(true);
    await tue('Mira', { op: 'remove', edge: gm.rows[0]!.edge });
    gm = await sicht('Mira');
    expect(gm.rows.map((r) => r.name)).toEqual(['Rook', 'Ghul']);
    expect(gm.rows[0]!.current).toBe(true);
  });

  it('is off when the campaign turns it off', async () => {
    const { sicht, tue } = await aufbau({ combat: 'off' });
    const gm = await sicht('Mira');
    expect(gm.off).toBe(true);
    expect(gm.rows).toEqual([]);
    expect((await tue('Mira', { op: 'next' })).statusCode).toBe(409);
  });
});

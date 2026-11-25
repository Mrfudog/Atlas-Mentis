/**
 * Das Kampagnenboard (T-342): einmal angelegt beim ersten Öffnen, nicht
 * wieder nach dem Löschen, Spielende landen darauf, die Leitung behält
 * ihren Start, und die laufenden Kacheln lesen Szene, Arc, Gruppe und
 * Aufträge — gesiebt. Erfundene Artikel.
 */

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import type { Entity } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';

const PASSWORT = 'nebel-wacht-am-tor';
const ident = (name: string, id: string) => ({ Identity: { name, id, aliases: [] }, Status: { status: 'ready' } });
const im = (id: string) => ({ id: `${id}_in`, type: 'inLayer', to: 'ly_camp_a', props: {} });
const teil = (id: string, to: string) => ({ id: `${id}_po`, type: 'partOf', to, props: {} });

function bestand(): Entity[] {
  return [
    { id: 'ly_camp_a', name: 'Ebene', interfaces: ['Layer'], components: { ...ident('Ebene A', 'layer-0001'), Layer: { kind: 'campaign', order: 100 } }, relations: [] },
    { id: 'camp_a', name: 'Runde A', interfaces: ['Campaign'], components: { ...ident('Runde A', 'campaign-0001'), Campaign: {} },
      relations: [{ id: 'camp_a_ac', type: 'activates', to: 'ly_camp_a', props: {} }] },
    { id: 'pt_a', name: 'Party', interfaces: ['Party'], components: ident('Party', 'party-0001'),
      relations: [{ id: 'pt_a_of', type: 'partyOf', to: 'camp_a', props: {} }, im('pt_a')] },
    { id: 'pc_rook', name: 'Rook', interfaces: ['PlayerCharacter'], components: { ...ident('Rook', 'playercharacter-0001'), PlayerCharacter: { level: 1 } },
      relations: [im('pc_rook'), { id: 'pc_rook_m', type: 'memberOfParty', to: 'pt_a', props: {} }] },
    { id: 'arc_1', name: 'The mill', interfaces: ['Arc'], components: ident('The mill', 'arc-0001'), relations: [im('arc_1'), teil('arc_1', 'camp_a')] },
    { id: 'sc_1', name: 'At the wheel', interfaces: ['Scene'], components: ident('At the wheel', 'scene-0001'), relations: [im('sc_1'), teil('sc_1', 'arc_1')] },
    { id: 'se_1', name: 'Evening one', interfaces: ['Session'], components: { ...ident('Evening one', 'session-0001'), Time: { sort: 1 }, Session: { activeScene: 'sc_1' } },
      relations: [im('se_1'), teil('se_1', 'camp_a')] },
    { id: 'se_2', name: 'Evening two', interfaces: ['Session'], components: { ...ident('Evening two', 'session-0002'), Time: { sort: 2 } },
      relations: [im('se_2'), teil('se_2', 'camp_a')] },
    { id: 'q_open', name: 'Find the miller', interfaces: ['Quest'], components: { ...ident('Find the miller', 'quest-0001'), Quest: { progress: 'accepted' } }, relations: [im('q_open')] },
    { id: 'q_secret', name: 'Kill the baron', interfaces: ['Quest'], components: { ...ident('Kill the baron', 'quest-0002'), Quest: { progress: 'offered' }, Visibility: { audience: 'gm' } }, relations: [im('q_secret')] },
    { id: 'q_done', name: 'Old business', interfaces: ['Quest'], components: { ...ident('Old business', 'quest-0003'), Quest: { progress: 'done' } }, relations: [im('q_done')] },
  ];
}

async function aufbau() {
  const registry = { ...seedRegistry, settings: { ...(seedRegistry.settings ?? {}), campaign: 'camp_a' } };
  const repo = new InMemoryRepository(registry, bestand());
  const app = buildApp({ repo });
  const konto = async (name: string, roles: Record<string, 'gm' | 'player'>, actorIds: string[] = [], isAdmin = false) =>
    repo.putUser({ id: randomUUID(), name, passwordHash: await hashPassword(PASSWORT), isAdmin, actorIds, roles });
  await konto('Gwen', { camp_a: 'gm' });
  await konto('Sela', { camp_a: 'player' }, ['pc_rook']);
  await konto('Fremd', {});
  await konto('Admin', {}, [], true);
  const cookies = new Map<string, string>();
  const cookie = async (name: string) => {
    if (!cookies.has(name)) {
      const login = await app.inject({ method: 'POST', url: '/api/login', payload: { name, password: PASSWORT } });
      cookies.set(name, `nw_session=${login.cookies.find((x) => x.name === 'nw_session')?.value ?? ''}`);
    }
    return cookies.get(name)!;
  };
  const get = async (name: string, url: string) => app.inject({ method: 'GET', url, headers: { cookie: await cookie(name) } });
  const post = async (name: string, url: string, payload: object = {}) =>
    app.inject({ method: 'POST', url, payload, headers: { cookie: await cookie(name) } });
  return { repo, get, post };
}

const ids = (r: { json: () => { items: { id: string }[] } }) => r.json().items.map((e) => e.id).sort();

describe('Kampagnenboard (T-342)', () => {
  it('legt das Board beim ersten Öffnen an, einmal, und Spielende landen darauf', async () => {
    const { repo, get } = await aufbau();
    expect(await repo.getEntity('bd_camp_a')).toBeUndefined();
    const sela = (await get('Sela', '/api/home')).json();
    expect(sela.board.id).toBe('bd_camp_a');
    expect(sela.land).toBe('/boards/bd_camp_a');
    expect(sela.role).toBe('player');
    expect(sela.character).toEqual({ id: 'pc_rook', name: 'Rook' });
    const board = (await repo.getEntity('bd_camp_a'))!;
    expect(board.relations?.some((r) => r.type === 'partOf' && r.to === 'camp_a')).toBe(true);
    expect(board.relations?.some((r) => r.type === 'inLayer' && r.to === 'ly_camp_a')).toBe(true);
    /* Die Leitung bekommt dasselbe Board und behält ihren Start. */
    const gwen = (await get('Gwen', '/api/home')).json();
    expect(gwen.board.id).toBe('bd_camp_a');
    expect(gwen.land).toBeNull();
    expect((await repo.listEvents({ name: 'campaign.board', subject: 'camp_a' })).length).toBe(1);
  });

  it('legt es nach dem Löschen nicht wieder an, und wer keine Rolle hat, legt nichts an', async () => {
    const { repo, get } = await aufbau();
    expect((await get('Fremd', '/api/home')).json().board).toBeNull();
    expect(await repo.getEntity('bd_camp_a')).toBeUndefined();
    await get('Gwen', '/api/home');
    await repo.deleteEntity('bd_camp_a');
    const sela = (await get('Sela', '/api/home')).json();
    expect(sela.board).toBeNull();
    expect(sela.land).toBeNull();
    expect(await repo.getEntity('bd_camp_a')).toBeUndefined();
  });

  it('lässt die Leitung den Start der Spielenden wählen', async () => {
    const { repo, get } = await aufbau();
    const k = (await repo.getEntity('camp_a'))!;
    await repo.putEntity({ ...k, components: { ...k.components, Campaign: { playerStart: 'compendium' } } });
    const sela = (await get('Sela', '/api/home')).json();
    expect(sela.playerStart).toBe('compendium');
    expect(sela.land).toBeNull();
    expect(sela.board.id).toBe('bd_camp_a');
  });

  it('liest Szene, Arc, nächste Sitzung, Gruppe und offene Aufträge — gesiebt', async () => {
    const { get } = await aufbau();
    await get('Gwen', '/api/home');
    const q = (wer: string, k: string) => get(wer, `/api/boards/bd_camp_a/query/bd_camp_a~placed-${k}`);
    expect(ids(await q('Sela', 'now'))).toEqual(['arc_1', 'sc_1']);
    expect(ids(await q('Sela', 'next'))).toEqual(['se_2']);
    expect(ids(await q('Sela', 'party'))).toEqual(['pc_rook']);
    expect(ids(await q('Sela', 'quests'))).toEqual(['q_open']);
    expect(ids(await q('Gwen', 'quests'))).toEqual(['q_open', 'q_secret']);
  });

  it('gibt einer neuen Kampagne ihr Board gleich mit', async () => {
    const { repo, post } = await aufbau();
    const r = await post('Admin', '/api/campaigns', { name: 'Runde B' });
    expect(r.statusCode).toBe(201);
    const id = r.json().id as string;
    const board = (await repo.getEntity(`bd_${id}`))!;
    expect(board.interfaces).toEqual(['Board']);
    expect(board.relations?.some((x) => x.type === 'partOf' && x.to === id)).toBe(true);
    expect((await repo.listEvents({ name: 'campaign.board', subject: id })).length).toBe(1);
  });
});

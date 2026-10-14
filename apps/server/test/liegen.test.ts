/**
 * Nicht verstaut, liegengelassen (T-140): `POST /api/sessions/:id/end`,
 * `…/pick-up` und der Szenenwechsel mit `immediately`. Erfundene Artikel.
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
const im = (id: string) => ({ id: `${id}_in`, type: 'inLayer', to: 'ly_a', props: {} });

function bestand(stowing: string): Entity[] {
  return [
    { id: 'ly_a', name: 'ly_a', interfaces: ['Layer'], components: { ...ident('Ebene A', 'layer-0001'), Layer: { kind: 'campaign', order: 50 } }, relations: [] },
    { id: 'camp_a', name: 'Runde A', interfaces: ['Campaign'], components: { ...ident('Runde A', 'campaign-0001'), Campaign: { stowing } },
      relations: [{ id: 'camp_a_ac', type: 'activates', to: 'ly_a', props: {} }] },
    { id: 'pt_a', name: 'Party', interfaces: ['Party'], components: ident('Party', 'party-0001'),
      relations: [{ id: 'pt_a_of', type: 'partyOf', to: 'camp_a', props: {} }, im('pt_a'), { id: 'pt_a_inv', type: 'carries', to: 'inv_pt', props: {} }] },
    { id: 'pc_rook', name: 'Rook', interfaces: ['PlayerCharacter'], components: { ...ident('Rook', 'playercharacter-0001'), PlayerCharacter: { level: 1 } },
      relations: [im('pc_rook'), { id: 'pc_rook_m', type: 'memberOfParty', to: 'pt_a', props: {} }, { id: 'pc_rook_c', type: 'carries', to: 'inv_rook', props: {} }] },
    { id: 'it_seil', name: 'Rope', interfaces: ['Item'], components: ident('Rope', 'item-0001'), relations: [im('it_seil')] },
    { id: 'it_fackel', name: 'Torch', interfaces: ['Item'], components: ident('Torch', 'item-0002'), relations: [im('it_fackel')] },
    { id: 'it_sack', name: 'Sack', interfaces: ['Item'], components: ident('Sack', 'item-0003'),
      relations: [im('it_sack'), { id: 'it_sack_c', type: 'carries', to: 'inv_sack', props: {} }] },
    { id: 'inv_sack', name: 'Sack inside', interfaces: ['Inventory'], components: ident('Sack inside', 'inventory-0003'),
      relations: [im('inv_sack'), { id: 'inv_sack_h', type: 'holds', to: 'it_fackel', props: { qty: 1, unstowed: true } }] },
    { id: 'inv_pt', name: 'Party bag', interfaces: ['Inventory'], components: ident('Party bag', 'inventory-0001'),
      relations: [im('inv_pt'), { id: 'inv_pt_h', type: 'holds', to: 'it_seil', props: { qty: 2, unstowed: true } }] },
    { id: 'inv_rook', name: 'Rook pack', interfaces: ['Inventory'], components: ident('Rook pack', 'inventory-0002'),
      relations: [im('inv_rook'),
        { id: 'inv_rook_s', type: 'holds', to: 'it_sack', props: { qty: 1, gx: 0, gy: 0 } },
        { id: 'inv_rook_f', type: 'holds', to: 'it_fackel', props: { qty: 3 } }] },
    { id: 'sc_1', name: 'Gate', interfaces: ['Scene'], components: ident('Gate', 'scene-0001'), relations: [im('sc_1')] },
    { id: 'sc_2', name: 'Crypt', interfaces: ['Scene'], components: ident('Crypt', 'scene-0002'), relations: [im('sc_2')] },
    { id: 'se_1', name: 'Evening 1', interfaces: ['Session'], components: { ...ident('Evening 1', 'session-0001'), Session: { activeScene: 'sc_1' } },
      relations: [im('se_1')] },
  ];
}

async function aufbau(stowing = 'bySessionEnd') {
  const registry = { ...seedRegistry, settings: { ...(seedRegistry.settings ?? {}), campaign: 'camp_a' } };
  const repo = new InMemoryRepository(registry, bestand(stowing));
  const app = buildApp({ repo });
  const konto = async (name: string, roles: Record<string, 'gm' | 'player' | 'spectator'>, actorIds: string[] = []) =>
    repo.putUser({ id: randomUUID(), name, passwordHash: await hashPassword(PASSWORT), isAdmin: false, actorIds, roles });
  await konto('Gwen', { camp_a: 'gm' });
  await konto('Sela', { camp_a: 'player' }, ['pc_rook']);
  await konto('Zaun', { camp_a: 'spectator' });
  const cookies = new Map<string, string>();
  const cookie = async (name: string) => {
    if (!cookies.has(name)) {
      const login = await app.inject({ method: 'POST', url: '/api/login', payload: { name, password: PASSWORT } });
      cookies.set(name, `nw_session=${login.cookies.find((x) => x.name === 'nw_session')?.value ?? ''}`);
    }
    return cookies.get(name)!;
  };
  const post = async (name: string, url: string, payload: unknown = {}) =>
    app.inject({ method: 'POST', url, payload: payload as object, headers: { cookie: await cookie(name) } });
  const put = async (name: string, e: Entity) =>
    app.inject({ method: 'PUT', url: `/api/entities/${e.id}`, payload: e as object, headers: { cookie: await cookie(name) } });
  const holds = async (id: string) => ((await repo.getEntity(id))?.relations ?? []).filter((r) => r.type === 'holds');
  const liegt = async () => ((await repo.getEntity('se_1'))?.relations ?? []).filter((r) => r.type === 'leftBehind');
  return { repo, post, put, holds, liegt };
}

describe('Sitzungsende (T-140)', () => {
  it('lässt mit bySessionEnd liegen, was unverstaut ist — aus Gruppe, Figur und Behälter; Verstautes bleibt', async () => {
    const { post, holds, liegt } = await aufbau();
    expect((await post('Sela', '/api/sessions/se_1/end')).statusCode).toBe(403);
    const r = await post('Gwen', '/api/sessions/se_1/end');
    expect(r.statusCode).toBe(200);
    expect(r.json().rule).toBe('bySessionEnd');
    expect(r.json().left.map((l: { item: string; qty: number }) => [l.item, l.qty]).sort()).toEqual([['it_fackel', 1], ['it_seil', 2]]);
    expect(await holds('inv_pt')).toEqual([]);
    expect(await holds('inv_sack')).toEqual([]);
    expect((await holds('inv_rook')).map((h) => h.id)).toEqual(['inv_rook_s', 'inv_rook_f']);
    const lb = await liegt();
    expect(lb.map((k) => [k.to, k.props?.['qty'], k.props?.['from']]).sort()).toEqual([['it_fackel', 1, 'inv_sack'], ['it_seil', 2, 'inv_pt']]);
  });

  it('lässt mit anytime alles, wo es ist', async () => {
    const { post, holds, liegt } = await aufbau('anytime');
    const r = await post('Gwen', '/api/sessions/se_1/end');
    expect(r.json()).toEqual({ rule: 'anytime', left: [] });
    expect(await holds('inv_pt')).toHaveLength(1);
    expect(await liegt()).toEqual([]);
  });

  it('hebt auf: wer das Ziel schreibt, bekommt den Stapel unverstaut zurück', async () => {
    const { post, holds, liegt } = await aufbau();
    await post('Gwen', '/api/sessions/se_1/end');
    const seil = (await liegt()).find((k) => k.to === 'it_seil')!;
    expect((await post('Zaun', '/api/sessions/se_1/pick-up', { edge: seil.id, inventory: 'inv_rook' })).statusCode).toBe(403);
    const r = await post('Sela', '/api/sessions/se_1/pick-up', { edge: seil.id, inventory: 'inv_rook' });
    expect(r.statusCode).toBe(200);
    expect((await holds('inv_rook')).find((h) => h.to === 'it_seil')?.props).toMatchObject({ qty: 2, unstowed: true });
    expect((await liegt()).some((k) => k.id === seil.id)).toBe(false);
    expect((await post('Sela', '/api/sessions/se_1/pick-up', { edge: seil.id, inventory: 'inv_rook' })).statusCode).toBe(409);
  });
});

describe('Der Tisch zieht weiter (immediately, T-140)', () => {
  it('lässt beim Wechsel der Szene liegen — nicht bei bySessionEnd', async () => {
    for (const [regel, erwartet] of [['immediately', 2], ['bySessionEnd', 0]] as const) {
      const { repo, put, liegt } = await aufbau(regel);
      const s = (await repo.getEntity('se_1'))!;
      const r = await put('Gwen', { ...s, components: { ...s.components, Session: { activeScene: 'sc_2' } } });
      expect(r.statusCode).toBe(200);
      expect(await liegt()).toHaveLength(erwartet);
      if (erwartet) expect(r.json().relations.filter((k: { type: string }) => k.type === 'leftBehind')).toHaveLength(2);
    }
  });
});

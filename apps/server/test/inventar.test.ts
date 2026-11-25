/**
 * Das Inventar im Web (T-127): das Regelset der Kampagne und das
 * Gruppeninventar, das Spielende schreiben — die Gruppe selbst nicht.
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
const BESTAND: Entity[] = [
  { id: 'ly_a', name: 'ly_a', interfaces: ['Layer'], components: { ...ident('Ebene A', 'layer-0001'), Layer: { kind: 'campaign', order: 50 } }, relations: [] },
  { id: 'camp_a', name: 'Runde A', interfaces: ['Campaign'], components: { ...ident('Runde A', 'campaign-0001'), Campaign: { inventory: 'weight' } },
    relations: [{ id: 'camp_a_ac', type: 'activates', to: 'ly_a', props: {} }] },
  { id: 'pt_a', name: 'Runde A party', interfaces: ['Party'], components: ident('Runde A party', 'party-0001'),
    relations: [{ id: 'pt_a_of', type: 'partyOf', to: 'camp_a', props: {} }, { id: 'pt_a_in', type: 'inLayer', to: 'ly_a', props: {} },
      { id: 'pt_a_inv', type: 'carries', to: 'inv_pt', props: {} }] },
  { id: 'it_sack', name: 'Sack', interfaces: ['Item'], components: ident('Sack', 'item-0001'),
    relations: [{ id: 'it_sack_in', type: 'inLayer', to: 'ly_a', props: {} }, { id: 'it_sack_c', type: 'carries', to: 'inv_sack', props: {} }] },
  { id: 'inv_sack', name: 'Sack inside', interfaces: ['Inventory'], components: ident('Sack inside', 'inventory-0002'),
    relations: [{ id: 'inv_sack_in', type: 'inLayer', to: 'ly_a', props: {} }] },
  { id: 'pc_rook', name: 'Rook', interfaces: ['PlayerCharacter'], components: { ...ident('Rook', 'playercharacter-0001'), PlayerCharacter: { level: 1 } },
    relations: [{ id: 'pc_rook_in', type: 'inLayer', to: 'ly_a', props: {} }, { id: 'pc_rook_m', type: 'memberOfParty', to: 'pt_a', props: {} }] },
  { id: 'inv_pt', name: 'Party bag', interfaces: ['Inventory'], components: ident('Party bag', 'inventory-0001'),
    relations: [{ id: 'inv_pt_in', type: 'inLayer', to: 'ly_a', props: {} }, { id: 'inv_pt_h', type: 'holds', to: 'it_sack', props: {} }] },
];

async function aufbau() {
  const registry = { ...seedRegistry, settings: { ...(seedRegistry.settings ?? {}), campaign: 'camp_a' } };
  const repo = new InMemoryRepository(registry, BESTAND);
  const app = buildApp({ repo });
  const konto = async (name: string, roles: Record<string, 'gm' | 'player' | 'spectator'>) =>
    repo.putUser({ id: randomUUID(), name, passwordHash: await hashPassword(PASSWORT), isAdmin: false, actorIds: [], roles });
  await konto('Sela', { camp_a: 'player' });
  await konto('Zaun', { camp_a: 'spectator' });
  const rufe = async (name: string, url: string) => {
    const login = await app.inject({ method: 'POST', url: '/api/login', payload: { name, password: PASSWORT } });
    const cookie = `nw_session=${login.cookies.find((x) => x.name === 'nw_session')?.value ?? ''}`;
    return app.inject({ method: 'GET', url, headers: { cookie } });
  };
  return { rufe };
}

describe('inventory of the running campaign', () => {
  it('names its rules and the inventory its party carries', async () => {
    const { rufe } = await aufbau();
    const res = await rufe('Sela', '/api/inventory');
    expect(res.json()).toEqual({
      campaign: { id: 'camp_a', name: 'Runde A' },
      rules: 'weight',
      stowing: 'anytime',
      parties: [{ id: 'pt_a', name: 'Runde A party', inventory: 'inv_pt', members: [{ id: 'pc_rook', name: 'Rook', inventory: null }] }],
    });
  });

  it('lets a player write the party inventory, not the party; a spectator neither', async () => {
    const { rufe } = await aufbau();
    const sela = (await rufe('Sela', '/api/me')).json().writable as string[];
    expect(sela).toContain('inv_pt');
    expect(sela).not.toContain('pt_a');
    /* Ein Behälter darin: sein Inventar ja, der Gegenstand selbst nicht. */
    expect(sela).toContain('inv_sack');
    expect(sela).not.toContain('it_sack');
    const zaun = (await rufe('Zaun', '/api/me')).json().writable as string[];
    expect(zaun).not.toContain('inv_pt');
    expect(zaun).not.toContain('inv_sack');
  });
});

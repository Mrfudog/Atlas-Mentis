/**
 * Die Gruppe je Kampagne und die Spieler in der Sichtbarkeit (T-100, E-007).
 *
 * Geprüft wird: eine neue Kampagne bringt ihre Party mit, eine zugeteilte
 * Spielerfigur kommt hinein (abschaltbar), und „Revealed to"/„Hidden
 * from" an der Gruppe oder an der Figur eines Spielers wirken für sein
 * Konto — ohne dass irgendwo eine Konto-Id im Artikel steht (REQ-199).
 */

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import { partiesOf, type Entity } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';

const PASSWORT = 'nebel-wacht-am-tor';
type Rolle = 'gm' | 'co-gm' | 'player' | 'spectator';

const ident = (name: string, id: string) => ({ Identity: { name, id, aliases: [] }, Status: { status: 'ready' } });
const BESTAND: Entity[] = [
  { id: 'ly_a', name: 'ly_a', interfaces: ['Layer'], components: { ...ident('Ebene A', 'layer-0001'), Layer: { kind: 'campaign', order: 50 } }, relations: [] },
  { id: 'camp_a', name: 'Runde A', interfaces: ['Campaign'], components: ident('Runde A', 'campaign-0001'),
    relations: [{ id: 'camp_a_ac', type: 'activates', to: 'ly_a', props: {} }] },
  { id: 'pt_a', name: 'Runde A party', interfaces: ['Party'], components: ident('Runde A party', 'party-0001'),
    relations: [{ id: 'pt_a_of', type: 'partyOf', to: 'camp_a', props: {} }, { id: 'pt_a_in', type: 'inLayer', to: 'ly_a', props: {} }] },
  { id: 'pc_rook', name: 'Rook', interfaces: ['PlayerCharacter'], components: { ...ident('Rook', 'playercharacter-0001'), PlayerCharacter: { level: 1 } },
    relations: [{ id: 'pc_rook_in', type: 'inLayer', to: 'ly_a', props: {} }] },
  { id: 'pc_wren', name: 'Wren', interfaces: ['PlayerCharacter'], components: { ...ident('Wren', 'playercharacter-0002'), PlayerCharacter: { level: 1 } },
    relations: [{ id: 'pc_wren_in', type: 'inLayer', to: 'ly_a', props: {} }] },
  /* Nur der Gruppe gezeigt — die Leitung sonst. */
  { id: 'note_gruppe', name: 'Map of the sewers', interfaces: ['Place'], components: { ...ident('Map of the sewers', 'place-0001'), Visibility: { audience: 'gm', revealedTo: ['pt_a'] } },
    relations: [{ id: 'ng_in', type: 'inLayer', to: 'ly_a', props: {} }] },
  /* Vor Rook verborgen, sonst offen. */
  { id: 'note_nicht_rook', name: 'Surprise party', interfaces: ['Place'], components: { ...ident('Surprise party', 'place-0002'), Visibility: { hiddenFrom: ['pc_rook'] } },
    relations: [{ id: 'nr_in', type: 'inLayer', to: 'ly_a', props: {} }] },
];

async function aufbau() {
  const registry = { ...seedRegistry, settings: { ...(seedRegistry.settings ?? {}), campaign: 'camp_a' } };
  const repo = new InMemoryRepository(registry, BESTAND);
  const app = buildApp({ repo });
  const konten: Record<string, string> = {};
  const konto = async (name: string, opts: { admin?: boolean; roles?: Record<string, Rolle>; actorIds?: string[] } = {}) => {
    const id = randomUUID();
    konten[name] = id;
    await repo.putUser({ id, name, passwordHash: await hashPassword(PASSWORT), isAdmin: opts.admin ?? false, actorIds: opts.actorIds ?? [], roles: opts.roles ?? {} });
  };
  await konto('Admin', { admin: true });
  await konto('Basil', { roles: { camp_a: 'gm' } });
  await konto('Mira', { roles: { camp_a: 'co-gm' } });
  await konto('Sela', { roles: { camp_a: 'player' } });
  await konto('Tam', { roles: { camp_a: 'player' } });
  await konto('Ohne');
  const keks = async (name: string) => {
    const res = await app.inject({ method: 'POST', url: '/api/login', payload: { name, password: PASSWORT } });
    return `nw_session=${res.cookies.find((x) => x.name === 'nw_session')?.value ?? ''}`;
  };
  const rufe = async (name: string, method: 'GET' | 'POST' | 'PUT', url: string, payload?: unknown) =>
    app.inject({ method, url, headers: { cookie: await keks(name) }, ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }) });
  const gruppe = async (id: string) =>
    ((await repo.getEntity(id))?.relations ?? []).filter((r) => r.type === 'memberOfParty').map((r) => r.to);
  return { repo, konten, rufe, gruppe };
}

describe('a party for every campaign', () => {
  it('comes with a new campaign, in its layer', async () => {
    const { rufe, repo } = await aufbau();
    const res = await rufe('Admin', 'POST', '/api/campaigns', { name: 'Kanalgang' });
    expect(res.statusCode).toBe(201);
    const id = res.json().id as string;
    const party = await repo.getEntity(`pt_${id}`);
    expect(party?.interfaces).toEqual(['Party']);
    expect(party?.name).toBe('Kanalgang party');
    expect((party?.components['Identity'] as { id: string }).id).toBe('party-0002');
    expect(party?.relations?.map((r) => [r.type, r.to])).toEqual([['partyOf', id], ['inLayer', `ly_${id}`]]);
    const map = new Map((await repo.listEntities()).map((e) => [e.id, e]));
    expect(partiesOf(map, id).map((p) => p.id)).toEqual([`pt_${id}`]);
  });

  it('takes in the character a player is given, once, unless told not to', async () => {
    const { rufe, konten, gruppe } = await aufbau();
    const res = await rufe('Basil', 'PUT', `/api/campaigns/camp_a/members/${konten['Sela']}/actors`, { actorIds: ['pc_rook'] });
    expect(res.json().party).toEqual(['pc_rook']);
    expect(await gruppe('pc_rook')).toEqual(['pt_a']);
    /* Noch einmal zuteilen nimmt sie nicht zweimal auf. */
    await rufe('Basil', 'PUT', `/api/campaigns/camp_a/members/${konten['Sela']}/actors`, { actorIds: [] });
    await rufe('Basil', 'PUT', `/api/campaigns/camp_a/members/${konten['Sela']}/actors`, { actorIds: ['pc_rook'] });
    expect(await gruppe('pc_rook')).toEqual(['pt_a']);
    /* Abschaltbar. */
    await rufe('Basil', 'PUT', `/api/campaigns/camp_a/members/${konten['Tam']}/actors`, { actorIds: ['pc_wren'], party: false });
    expect(await gruppe('pc_wren')).toEqual([]);
  });

  it('leaves the characters of a co-GM out', async () => {
    const { rufe, konten, gruppe } = await aufbau();
    await rufe('Admin', 'PUT', `/api/campaigns/camp_a/members/${konten['Mira']}/actors`, { actorIds: ['pc_wren'] });
    expect(await gruppe('pc_wren')).toEqual([]);
  });
});

describe('players in visibility', () => {
  it('lists the players of the running campaign with their characters and no account ids', async () => {
    const { rufe, repo, konten } = await aufbau();
    const sela = await repo.getUser(konten['Sela'] ?? '');
    if (sela) await repo.putUser({ ...sela, actorIds: ['pc_rook'] });
    const res = (await rufe('Tam', 'GET', '/api/players')).json();
    expect(res.campaign).toEqual({ id: 'camp_a', name: 'Runde A' });
    expect(res.players).toEqual([{ name: 'Sela', actors: [{ id: 'pc_rook', name: 'Rook' }] }]);
    expect(JSON.stringify(res)).not.toContain(konten['Sela']);
    expect((await rufe('Ohne', 'GET', '/api/players')).json().players).toEqual([]);
  });

  it('shows what is revealed to the party to its members, and hides what is hidden from a character', async () => {
    const { rufe, konten } = await aufbau();
    expect((await rufe('Sela', 'GET', '/api/entities/note_gruppe')).statusCode).toBe(404);
    await rufe('Basil', 'PUT', `/api/campaigns/camp_a/members/${konten['Sela']}/actors`, { actorIds: ['pc_rook'] });
    expect((await rufe('Sela', 'GET', '/api/entities/note_gruppe')).statusCode).toBe(200);
    expect((await rufe('Sela', 'GET', '/api/entities/note_nicht_rook')).statusCode).toBe(404);
    expect((await rufe('Tam', 'GET', '/api/entities/note_nicht_rook')).statusCode).toBe(200);
    expect((await rufe('Tam', 'GET', '/api/entities/note_gruppe')).statusCode).toBe(404);
  });
});

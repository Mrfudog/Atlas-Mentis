/**
 * Verwaltung (W3): Mitglieder, Rollen, Figuren, Einladungen.
 *
 * Geprüft wird vor allem, was man nicht sieht: dass ein Mitleiter die Liste
 * liest und nicht ändert, dass die Leitung der einen Runde nichts an der
 * anderen ändert, dass eine Leitung sich nicht selbst aussperrt und dass
 * sie keine Figur einer fremden Runde vergibt — wer eine Figur führt, darf
 * sie schreiben.
 */

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import type { Entity } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';

const PASSWORT = 'nebel-wacht-am-tor';
type Rolle = 'gm' | 'co-gm' | 'player' | 'spectator';

const ident = (name: string, id: string) => ({
  Identity: { name, id, aliases: [] },
  Status: { status: 'ready' },
});
const ebene = (id: string, n: number): Entity => ({
  id,
  name: id,
  interfaces: ['Layer'],
  components: { ...ident(id, `layer-00${n}`), Layer: { kind: 'campaign', order: 50 } },
  relations: [],
});
const kampagne = (id: string, name: string, n: number, ly: string): Entity => ({
  id,
  name,
  interfaces: ['Campaign'],
  components: ident(name, `campaign-000${n}`),
  relations: [{ id: `${id}_ac`, type: 'activates', to: ly, props: {} }],
});
const figur = (id: string, name: string, n: number, ly?: string): Entity => ({
  id,
  name,
  interfaces: ['PlayerCharacter'],
  components: { ...ident(name, `playercharacter-000${n}`), PlayerCharacter: { level: 1 } },
  relations: ly ? [{ id: `${id}_in`, type: 'inLayer', to: ly, props: {} }] : [],
});

const BESTAND = [
  ebene('ly_a', 1),
  ebene('ly_b', 2),
  kampagne('camp_a', 'Runde A', 1, 'ly_a'),
  kampagne('camp_b', 'Runde B', 2, 'ly_b'),
  figur('pc_a', 'Rook', 1, 'ly_a'),
  figur('pc_b', 'Fremd', 2, 'ly_b'),
  figur('pc_frei', 'Sela', 3),
];

async function aufbau() {
  const repo = new InMemoryRepository(seedRegistry, BESTAND);
  const app = buildApp({ repo });
  const konten: Record<string, string> = {};
  const konto = async (
    name: string,
    opts: { admin?: boolean; roles?: Record<string, Rolle>; actorIds?: string[] } = {},
  ) => {
    const id = randomUUID();
    konten[name] = id;
    await repo.putUser({
      id,
      name,
      passwordHash: await hashPassword(PASSWORT),
      isAdmin: opts.admin ?? false,
      actorIds: opts.actorIds ?? [],
      roles: opts.roles ?? {},
    });
  };
  await konto('Admin', { admin: true });
  await konto('Basil', { roles: { camp_a: 'gm' } });
  await konto('Mira', { roles: { camp_a: 'co-gm' } });
  await konto('Sela', { roles: { camp_a: 'player' } });
  await konto('Brom', { roles: { camp_b: 'gm' } });
  await konto('Ohne');
  const keks = async (name: string) => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/login',
      payload: { name, password: PASSWORT },
    });
    const c = res.cookies.find((x) => x.name === 'nw_session');
    return `nw_session=${c?.value ?? ''}`;
  };
  const rufe = async (
    name: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    payload?: unknown,
  ) =>
    app.inject({
      method,
      url,
      headers: { cookie: await keks(name) },
      ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
    });
  return { app, repo, konten, rufe };
}

describe('campaigns', () => {
  it('lists the campaigns someone leads or co-leads, and none to a player', async () => {
    const { rufe } = await aufbau();
    const basil = (await rufe('Basil', 'GET', '/api/campaigns')).json();
    expect(basil.campaigns.map((c: { id: string }) => c.id)).toEqual(['camp_a']);
    expect(basil.campaigns[0].may).toBe('manage');
    expect((await rufe('Mira', 'GET', '/api/campaigns')).json().campaigns[0].may).toBe('see');
    expect((await rufe('Sela', 'GET', '/api/campaigns')).json().campaigns).toEqual([]);
    const admin = (await rufe('Admin', 'GET', '/api/campaigns')).json();
    expect(admin.campaigns.map((c: { id: string }) => c.id).sort()).toEqual(['camp_a', 'camp_b']);
    expect(admin.canCreate).toBe(true);
  });

  /* Ohne Kampagne kann niemand eingeladen werden — also legt die
     Verwaltung eine an, und nur sie. */
  it('lets the admin create a campaign and lead it, and nobody else', async () => {
    const { rufe, repo, konten } = await aufbau();
    expect((await rufe('Basil', 'POST', '/api/campaigns', { name: 'Neu' })).statusCode).toBe(403);
    const res = await rufe('Admin', 'POST', '/api/campaigns', { name: 'Kanalgang', lead: true });
    expect(res.statusCode).toBe(201);
    const id = res.json().id as string;
    const e = await repo.getEntity(id);
    expect(e?.interfaces).toEqual(['Campaign']);
    expect((e?.components['Identity'] as { id: string }).id).toBe('campaign-0003');
    expect((await repo.getUser(konten['Admin'] ?? ''))?.roles[id]).toBe('gm');
  });
});

describe('members', () => {
  it('shows the GM and the co-GM the same list, with roles and characters', async () => {
    const { rufe, repo, konten } = await aufbau();
    const sela = await repo.getUser(konten['Sela'] ?? '');
    if (sela) await repo.putUser({ ...sela, actorIds: ['pc_a'] });
    const basil = (await rufe('Basil', 'GET', '/api/campaigns/camp_a/members')).json();
    const mira = (await rufe('Mira', 'GET', '/api/campaigns/camp_a/members')).json();
    expect(basil.members.map((m: { name: string }) => m.name)).toEqual(['Basil', 'Mira', 'Sela']);
    /* `self` und `viewAs` hängen am Fragenden (REQ-241), der Rest nicht. */
    const ohneSelbst = (l: { self: boolean; viewAs?: boolean }[]) => l.map(({ self: _s, viewAs: _v, ...m }) => m);
    expect(ohneSelbst(mira.members)).toEqual(ohneSelbst(basil.members));
    expect(basil.members[2].actors).toEqual([{ id: 'pc_a', name: 'Rook' }]);
    expect(basil.may).toBe('manage');
    expect(mira.may).toBe('see');
    /* Vergeben darf A die eigene und die freie Figur, nicht die von B. */
    expect(basil.characters.map((c: { id: string }) => c.id).sort()).toEqual(['pc_a', 'pc_frei']);
  });

  it('keeps the list from players and from the GM of another campaign', async () => {
    const { rufe } = await aufbau();
    expect((await rufe('Sela', 'GET', '/api/campaigns/camp_a/members')).statusCode).toBe(403);
    expect((await rufe('Brom', 'GET', '/api/campaigns/camp_a/members')).statusCode).toBe(403);
  });

  it('lets the GM set and remove a role, and the co-GM neither', async () => {
    const { rufe, repo, konten } = await aufbau();
    const sela = konten['Sela'] ?? '';
    expect((await rufe('Mira', 'PUT', `/api/campaigns/camp_a/members/${sela}`, { role: 'co-gm' })).statusCode)
      .toBe(403);
    expect((await rufe('Basil', 'PUT', `/api/campaigns/camp_a/members/${sela}`, { role: 'spectator' })).statusCode)
      .toBe(200);
    expect((await repo.getUser(sela))?.roles['camp_a']).toBe('spectator');
    expect((await rufe('Mira', 'DELETE', `/api/campaigns/camp_a/members/${sela}`)).statusCode).toBe(403);
    expect((await rufe('Basil', 'DELETE', `/api/campaigns/camp_a/members/${sela}`)).statusCode).toBe(200);
    expect((await repo.getUser(sela))?.roles['camp_a']).toBeUndefined();
  });

  it('refuses a role that is not one', async () => {
    const { rufe, konten } = await aufbau();
    const res = await rufe('Basil', 'PUT', `/api/campaigns/camp_a/members/${konten['Sela']}`, { role: 'king' });
    expect(res.statusCode).toBe(400);
  });

  it('does not let the GM of one campaign touch another', async () => {
    const { rufe, konten } = await aufbau();
    const res = await rufe('Brom', 'PUT', `/api/campaigns/camp_a/members/${konten['Sela']}`, { role: 'gm' });
    expect(res.statusCode).toBe(403);
  });

  /* Eine Leitung, die sich zum Zuschauer macht, hat sich ausgesperrt. */
  it('does not let a GM change their own role; the admin may', async () => {
    const { rufe, konten } = await aufbau();
    const basil = konten['Basil'] ?? '';
    expect((await rufe('Basil', 'PUT', `/api/campaigns/camp_a/members/${basil}`, { role: 'player' })).statusCode)
      .toBe(403);
    expect((await rufe('Admin', 'PUT', `/api/campaigns/camp_a/members/${basil}`, { role: 'co-gm' })).statusCode)
      .toBe(200);
  });

  it('adds an existing account by name', async () => {
    const { rufe, repo, konten } = await aufbau();
    const res = await rufe('Basil', 'POST', '/api/campaigns/camp_a/members', { name: 'ohne', role: 'spectator' });
    expect(res.statusCode).toBe(201);
    expect((await repo.getUser(konten['Ohne'] ?? ''))?.roles['camp_a']).toBe('spectator');
    expect((await rufe('Basil', 'POST', '/api/campaigns/camp_a/members', { name: 'niemand' })).statusCode)
      .toBe(404);
    expect((await rufe('Mira', 'POST', '/api/campaigns/camp_a/members', { name: 'ohne' })).statusCode)
      .toBe(403);
  });
});

describe('characters of an account', () => {
  it('lets the GM hand out a character of their campaign or a free one', async () => {
    const { rufe, repo, konten } = await aufbau();
    const sela = konten['Sela'] ?? '';
    const res = await rufe('Basil', 'PUT', `/api/campaigns/camp_a/members/${sela}/actors`, {
      actorIds: ['pc_a', 'pc_frei'],
    });
    expect(res.statusCode).toBe(200);
    expect((await repo.getUser(sela))?.actorIds).toEqual(['pc_a', 'pc_frei']);
    /* Und die Figur schreibt sie danach — das ist der Sinn der Bindung. */
    const me = (await rufe('Sela', 'GET', '/api/me')).json();
    expect(me.writable).toContain('pc_a');
  });

  /* Sonst gäbe die Leitung der einen Runde ihrem Spieler die Feder für die
     Figur einer anderen. */
  it('refuses a character that belongs to another campaign', async () => {
    const { rufe, konten } = await aufbau();
    const res = await rufe('Basil', 'PUT', `/api/campaigns/camp_a/members/${konten['Sela']}/actors`, {
      actorIds: ['pc_b'],
    });
    expect(res.statusCode).toBe(403);
  });

  it('leaves a character of another campaign in place when the list omits it', async () => {
    const { rufe, repo, konten } = await aufbau();
    const sela = konten['Sela'] ?? '';
    const u = await repo.getUser(sela);
    if (u) await repo.putUser({ ...u, actorIds: ['pc_b', 'pc_a'] });
    await rufe('Basil', 'PUT', `/api/campaigns/camp_a/members/${sela}/actors`, { actorIds: [] });
    expect((await repo.getUser(sela))?.actorIds).toEqual(['pc_b']);
  });

  it('is not the co-GM’s to change, nor the GM’s own', async () => {
    const { rufe, konten } = await aufbau();
    expect((await rufe('Mira', 'PUT', `/api/campaigns/camp_a/members/${konten['Sela']}/actors`, {
      actorIds: ['pc_a'],
    })).statusCode).toBe(403);
    expect((await rufe('Basil', 'PUT', `/api/campaigns/camp_a/members/${konten['Basil']}/actors`, {
      actorIds: ['pc_a'],
    })).statusCode).toBe(403);
  });
});

describe('accounts of the installation', () => {
  it('are listed for the admin only', async () => {
    const { rufe } = await aufbau();
    const res = await rufe('Admin', 'GET', '/api/users');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(6);
    expect(JSON.stringify(res.json())).not.toMatch(/argon2|passwordHash/);
    const basil = res.json().find((u: { name: string }) => u.name === 'Basil');
    expect(basil.roles).toEqual([{ campaign: 'camp_a', name: 'Runde A', role: 'gm' }]);
    expect((await rufe('Basil', 'GET', '/api/users')).statusCode).toBe(403);
  });
});

describe('invitations into a campaign', () => {
  it('lets the GM invite into their campaign; the new account arrives with the role', async () => {
    const { app, rufe } = await aufbau();
    const neu = await rufe('Basil', 'POST', '/api/invites', {
      campaignId: 'camp_a',
      role: 'player',
      actorId: 'pc_frei',
      uses: 1,
      days: 7,
    });
    expect(neu.statusCode).toBe(201);
    const code = neu.json().code as string;
    const reg = await app.inject({
      method: 'POST',
      url: '/api/register',
      payload: { name: 'Gast', password: PASSWORT, invite: code },
    });
    expect(reg.statusCode).toBe(201);
    expect(reg.json().user.roles).toEqual({ camp_a: 'player' });
    expect(reg.json().user.actorIds).toEqual(['pc_frei']);
    const liste = (await rufe('Basil', 'GET', '/api/campaigns/camp_a/members')).json();
    expect(liste.members.map((m: { name: string }) => m.name)).toContain('Gast');
  });

  it('keeps the co-GM to reading, and other campaigns out', async () => {
    const { rufe } = await aufbau();
    expect((await rufe('Mira', 'POST', '/api/invites', { campaignId: 'camp_a' })).statusCode).toBe(403);
    expect((await rufe('Brom', 'POST', '/api/invites', { campaignId: 'camp_a' })).statusCode).toBe(403);
    /* Ohne Kampagne lädt nur die Verwaltung ein, und Verwaltungskonten nie
       die Leitung. */
    expect((await rufe('Basil', 'POST', '/api/invites', {})).statusCode).toBe(403);
    expect((await rufe('Basil', 'POST', '/api/invites', { campaignId: 'camp_a', admin: true })).statusCode)
      .toBe(403);
    expect((await rufe('Basil', 'POST', '/api/invites', { campaignId: 'camp_a', actorId: 'pc_b' })).statusCode)
      .toBe(403);
  });

  it('shows each lead the invitations of their campaigns, and lets only the GM revoke', async () => {
    const { rufe } = await aufbau();
    await rufe('Basil', 'POST', '/api/invites', { campaignId: 'camp_a', label: 'für A' });
    await rufe('Brom', 'POST', '/api/invites', { campaignId: 'camp_b', label: 'für B' });
    const mira = (await rufe('Mira', 'GET', '/api/invites')).json();
    expect(mira.map((i: { label: string }) => i.label)).toEqual(['für A']);
    expect(mira[0].role).toBe('player');
    expect(mira[0].createdAt).toBeTruthy();
    const brom = (await rufe('Brom', 'GET', '/api/invites')).json();
    expect(brom.map((i: { label: string }) => i.label)).toEqual(['für B']);
    expect((await rufe('Admin', 'GET', '/api/invites')).json()).toHaveLength(2);

    const handle = mira[0].handle as string;
    expect((await rufe('Mira', 'DELETE', `/api/invites/${handle}`)).statusCode).toBe(403);
    /* Eine fremde Einladung ist für die andere Leitung keine. */
    expect((await rufe('Brom', 'DELETE', `/api/invites/${handle}`)).statusCode).toBe(404);
    expect((await rufe('Basil', 'DELETE', `/api/invites/${handle}`)).statusCode).toBe(200);
    expect((await rufe('Mira', 'GET', '/api/invites')).json()).toEqual([]);
  });
});

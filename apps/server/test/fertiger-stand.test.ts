/**
 * Teil 2 von T-075 (REQ-237, E-012, E-014 d): die eigene Figur verwaltet
 * ihr Spieler selbst, und ändert eine Spielerin einen fertigen Artikel,
 * fällt er zurück, während für alle anderen der letzte fertige Stand gilt.
 */

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import type { Entity } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';

const PASSWORT = 'nebel-wacht-am-tor';

const ebene = (id: string): Entity => ({
  id,
  interfaces: ['Layer'],
  name: id,
  components: { Identity: { name: id, id: `layer-${id}`, aliases: [] } },
  relations: [],
});
const runde: Entity = {
  id: 'camp_nebel',
  interfaces: ['Campaign'],
  name: 'Nebelwacht',
  components: { Identity: { name: 'Nebelwacht', id: 'campaign-0001', aliases: [] } },
  relations: [{ id: 'a1', type: 'activates', to: 'ly_nebel', props: { order: 5 } }],
};
/* Selas Figur, unfertig, mit Statblock und Inventar — zugeteilt über das Konto. */
const imNebel = (id: string) => ({ id: `${id}~l`, type: 'inLayer', to: 'ly_nebel', props: {} });
const figur: Entity = {
  id: 'pc_ilka',
  interfaces: ['PlayerCharacter'],
  name: 'Ilka',
  components: { Identity: { name: 'Ilka', id: 'pc-0001', aliases: [] }, Status: { status: 'prepared' } },
  relations: [imNebel('pc_ilka'), { id: 'pc_ilka~c', type: 'carries', to: 'inv_ilka', props: {} }],
};
const bogen: Entity = {
  id: 'sb_ilka',
  interfaces: ['Statblock'],
  name: 'Ilka (Statblock)',
  components: { Identity: { name: 'Ilka (Statblock)', id: 'sb-0001', aliases: [] }, Status: { status: 'idea' } },
  relations: [imNebel('sb_ilka'), { id: 'sb_ilka~b', type: 'belongsTo', to: 'pc_ilka', props: {} }],
};
const rucksack: Entity = {
  id: 'inv_ilka',
  interfaces: ['Inventory'],
  name: 'Rucksack',
  components: { Identity: { name: 'Rucksack', id: 'inv-0001', aliases: [] } },
  relations: [imNebel('inv_ilka')],
};

async function aufbau() {
  const repo = new InMemoryRepository(
    { ...seedRegistry, settings: { ...(seedRegistry.settings ?? {}), campaign: 'camp_nebel' } },
    [ebene('ly_nebel'), runde, figur, bogen, rucksack],
  );
  const app = buildApp({ repo });
  const konto = async (name: string, roles: Record<string, 'gm' | 'co-gm' | 'player'>, actorIds: string[] = [], admin = false) =>
    repo.putUser({
      id: `u_${name.toLowerCase()}_${randomUUID().slice(0, 4)}`,
      name,
      passwordHash: await hashPassword(PASSWORT),
      isAdmin: admin,
      actorIds,
      roles,
    });
  await konto('Basil', {}, [], true);
  await konto('Mira', { camp_nebel: 'gm' });
  await konto('Cora', { camp_nebel: 'co-gm' });
  await konto('Sela', { camp_nebel: 'player' }, ['pc_ilka']);
  await konto('Tom', { camp_nebel: 'player' });

  const kekse = new Map<string, string>();
  const keks = async (name: string): Promise<string> => {
    const da = kekse.get(name);
    if (da) return da;
    const res = await app.inject({ method: 'POST', url: '/api/login', payload: { name, password: PASSWORT } });
    const c = res.cookies.find((x) => x.name === 'nw_session');
    if (!c) throw new Error(`keine Sitzung für ${name}`);
    const k = `nw_session=${c.value}`;
    kekse.set(name, k);
    return k;
  };
  const als = async (name: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: unknown) =>
    app.inject({ method, url, headers: { cookie: await keks(name) }, ...(payload !== undefined ? { payload: payload as object } : {}) });
  const lies = async (name: string, id: string, q = '') => {
    const res = await als(name, 'GET', `/api/entities/${id}${q}`);
    return { code: res.statusCode, e: res.json() as Entity & { refs?: { ready?: { at: string; old: boolean } } } };
  };
  const inListe = async (name: string, id: string) => {
    const liste = (await als(name, 'GET', '/api/list?limit=500')).json() as { rows: { id: string; name: string }[] };
    return liste.rows.find((r) => r.id === id)?.name ?? null;
  };
  const stand = (e: Entity) => (e.components?.['Status'] as { status?: string } | undefined)?.status;
  const mit = (e: Entity, aend: { name?: string; status?: string }): Entity => {
    const { refs: _r, updatedAt: _u, ...rest } = e as Entity & { refs?: unknown };
    const name = aend.name ?? rest.name;
    return {
      ...rest,
      name,
      components: {
        ...rest.components,
        Identity: { ...(rest.components?.['Identity'] ?? {}), name },
        ...(aend.status ? { Status: { status: aend.status } } : {}),
      },
    };
  };
  return { repo, als, lies, inListe, stand, mit };
}

describe('the own player character is exempt from the status gate (E-014 d)', () => {
  it('shows her unfinished character, statblock and inventory to fellow players', async () => {
    const { lies } = await aufbau();
    expect((await lies('Tom', 'pc_ilka')).code).toBe(200);
    expect((await lies('Tom', 'sb_ilka')).code).toBe(200);
    expect((await lies('Tom', 'inv_ilka')).code).toBe(200);
  });

  it('lets the player write her statblock and set ready herself, and nothing falls back', async () => {
    const { als, lies, mit, stand, repo } = await aufbau();
    const me = (await als('Sela', 'GET', '/api/me')).json() as { character: string[]; writable: string[] };
    expect(me.character).toEqual(expect.arrayContaining(['pc_ilka', 'sb_ilka', 'inv_ilka']));
    expect(me.writable).toContain('sb_ilka');

    const pc = (await lies('Sela', 'pc_ilka')).e;
    expect((await als('Sela', 'PUT', '/api/entities/pc_ilka', mit(pc, { status: 'ready' }))).statusCode).toBe(200);
    const sb = (await lies('Sela', 'sb_ilka')).e;
    expect((await als('Sela', 'PUT', '/api/entities/sb_ilka', mit(sb, { status: 'ready' }))).statusCode).toBe(200);
    /* Wieder geändert: bleibt fertig, kein alter Stand. */
    const fertig = (await lies('Sela', 'pc_ilka')).e;
    expect((await als('Sela', 'PUT', '/api/entities/pc_ilka', mit(fertig, { name: 'Ilka die Kühne' }))).statusCode).toBe(200);
    const tom = await lies('Tom', 'pc_ilka');
    expect(tom.e.name).toBe('Ilka die Kühne');
    expect(stand(tom.e)).toBe('ready');
    expect((await repo.readyStands()).size).toBe(0);
  });

  it('keeps another player off her character', async () => {
    const { als, lies, mit } = await aufbau();
    const pc = (await lies('Tom', 'pc_ilka')).e;
    expect((await als('Tom', 'PUT', '/api/entities/pc_ilka', mit(pc, { status: 'ready' }))).statusCode).toBe(403);
    expect((await als('Tom', 'POST', '/api/entities/pc_ilka/ready')).statusCode).toBe(403);
  });

  it('lets a player create her character as ready', async () => {
    const { als } = await aufbau();
    const res = await als('Tom', 'POST', '/api/entities', {
      type: 'PlayerCharacter',
      name: 'Bran',
      fields: { 'Status.status': 'ready' },
    });
    expect(res.statusCode).toBe(201);
  });
});

describe('a player edits a ready article: it falls back, the ready version applies (E-012)', () => {
  async function fertigerOrt() {
    const t = await aufbau();
    const neu = (await t.als('Sela', 'POST', '/api/entities', { type: 'Place', name: 'Die Mühle' })).json() as Entity;
    expect((await t.als('Mira', 'POST', `/api/entities/${neu.id}/ready`)).statusCode).toBe(200);
    return { ...t, id: neu.id };
  }

  it('falls back to prepared and keeps the ready version for everyone else', async () => {
    const { als, lies, inListe, mit, stand, id } = await fertigerOrt();
    const vorher = (await lies('Sela', id)).e;
    expect(stand(vorher)).toBe('ready');
    const res = await als('Sela', 'PUT', `/api/entities/${id}`, mit(vorher, { name: 'Die alte Mühle' }));
    expect(res.statusCode).toBe(200);
    expect(stand(res.json() as Entity)).toBe('prepared');

    /* Tom und Basil? Tom sieht den fertigen Stand, in Artikel und Liste. */
    const tom = await lies('Tom', id);
    expect(tom.code).toBe(200);
    expect(tom.e.name).toBe('Die Mühle');
    expect(stand(tom.e)).toBe('ready');
    expect(tom.e.refs?.ready).toBeUndefined();
    expect(await inListe('Tom', id)).toBe('Die Mühle');

    /* Verfasserin und Leitung sehen den neuen, mit dem Datum des alten. */
    for (const wer of ['Sela', 'Mira', 'Cora', 'Basil']) {
      const l = await lies(wer, id);
      expect(l.e.name, wer).toBe('Die alte Mühle');
      expect(l.e.refs?.ready, wer).toMatchObject({ old: false });
      expect(typeof l.e.refs?.ready?.at).toBe('string');
    }
    expect(await inListe('Mira', id)).toBe('Die alte Mühle');
    /* … und können den alten ansehen. */
    const alt = await lies('Sela', id, '?stand=ready');
    expect(alt.e.name).toBe('Die Mühle');
    expect(alt.e.refs?.ready).toMatchObject({ old: true });
  });

  it('keeps the first ready version through further edits', async () => {
    const { als, lies, mit, id } = await fertigerOrt();
    const v = (await lies('Sela', id)).e;
    await als('Sela', 'PUT', `/api/entities/${id}`, mit(v, { name: 'Zweite Fassung' }));
    const w = (await lies('Sela', id)).e;
    expect((await als('Sela', 'PUT', `/api/entities/${id}`, mit(w, { name: 'Dritte Fassung' }))).statusCode).toBe(200);
    expect((await lies('Tom', id)).e.name).toBe('Die Mühle');
    /* `ready` setzt sie auch jetzt nicht selbst. */
    const x = (await lies('Sela', id)).e;
    expect((await als('Sela', 'PUT', `/api/entities/${id}`, mit(x, { status: 'ready' }))).statusCode).toBe(403);
  });

  it('does not fall back on a save without a change', async () => {
    const { als, lies, mit, stand, id } = await fertigerOrt();
    const v = (await lies('Sela', id)).e;
    const res = await als('Sela', 'PUT', `/api/entities/${id}`, mit(v, {}));
    expect(res.statusCode).toBe(200);
    expect(stand(res.json() as Entity)).toBe('ready');
  });

  it('lists what waits for the GM, and ready makes the new version apply', async () => {
    const { als, lies, mit, repo, id } = await fertigerOrt();
    const v = (await lies('Sela', id)).e;
    await als('Sela', 'PUT', `/api/entities/${id}`, mit(v, { name: 'Neue Mühle' }));
    const offen = (await als('Mira', 'GET', '/api/unready')).json() as {
      rows: { id: string; authors: string[]; readyAt: string | null; canReady: boolean }[];
    };
    const zeile = offen.rows.find((r) => r.id === id);
    expect(zeile).toMatchObject({ authors: ['Sela'], canReady: true });
    expect(zeile?.readyAt).toBeTruthy();
    /* Die Figur wartet auf niemanden. */
    expect(offen.rows.some((r) => r.id === 'pc_ilka')).toBe(false);
    /* Der Mitleiter sieht die Liste, ohne Knopf; Spielende sehen sie nicht. */
    const cora = (await als('Cora', 'GET', '/api/unready')).json() as { rows: { id: string; canReady: boolean }[] };
    expect(cora.rows.find((r) => r.id === id)?.canReady).toBe(false);
    expect((await als('Tom', 'GET', '/api/unready')).statusCode).toBe(403);
    expect((await als('Cora', 'POST', `/api/entities/${id}/ready`)).statusCode).toBe(403);

    expect((await als('Mira', 'POST', `/api/entities/${id}/ready`)).statusCode).toBe(200);
    expect((await lies('Tom', id)).e.name).toBe('Neue Mühle');
    expect((await repo.readyStands()).has(id)).toBe(false);
    const danach = (await als('Mira', 'GET', '/api/unready')).json() as { rows: { id: string }[] };
    expect(danach.rows.some((r) => r.id === id)).toBe(false);
  });

  it('lets the GM edit a ready article without anything falling back', async () => {
    const { als, lies, mit, stand, repo, id } = await fertigerOrt();
    const v = (await lies('Mira', id)).e;
    const res = await als('Mira', 'PUT', `/api/entities/${id}`, mit(v, { name: 'Mühle am Bach' }));
    expect(res.statusCode).toBe(200);
    expect(stand(res.json() as Entity)).toBe('ready');
    expect((await lies('Tom', id)).e.name).toBe('Mühle am Bach');
    expect((await repo.readyStands()).size).toBe(0);
  });

  it('removes the ready version with the article', async () => {
    const { als, lies, mit, repo, id } = await fertigerOrt();
    const v = (await lies('Sela', id)).e;
    await als('Sela', 'PUT', `/api/entities/${id}`, mit(v, { name: 'Weg damit' }));
    expect((await repo.readyStands()).has(id)).toBe(true);
    expect((await als('Basil', 'DELETE', `/api/entities/${id}`)).statusCode).toBe(200);
    expect((await repo.readyStands()).has(id)).toBe(false);
  });
});

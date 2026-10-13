/**
 * Spielende legen Artikel an; „ready" setzt die Leitung (REQ-237, E-011,
 * E-012, E-013).
 *
 * Geprüft wird, was man am Tisch nicht sofort merkt: dass ein Entwurf
 * wirklich nur bei Verfasserin und Leitung ankommt — in Liste, Artikel und
 * Auswahl —, dass eine Spielerin ihn nicht selbst fertig nennen kann, und
 * dass ein Artikel ohne Stand weiter für alle da ist.
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
  relations: [
    { id: 'a1', type: 'activates', to: 'ly_regeln', props: { order: 1 } },
    { id: 'a2', type: 'activates', to: 'ly_nebel', props: { order: 5 } },
  ],
};
/* Eine zweite Runde schaltet das Regelwerk auch auf — es ist geteilt, und
   dorthin legt eine Spielerin nichts. */
const andere: Entity = {
  id: 'camp_salz',
  interfaces: ['Campaign'],
  name: 'Salz',
  components: { Identity: { name: 'Salz', id: 'campaign-0002', aliases: [] } },
  relations: [{ id: 'a3', type: 'activates', to: 'ly_regeln', props: {} }],
};
const artikel = (id: string, name: string, status?: string): Entity => ({
  id,
  interfaces: ['Place'],
  name,
  components: {
    Identity: { name, id: `place-${id}`, aliases: [] },
    ...(status ? { Status: { status } } : {}),
  },
  relations: [{ id: `${id}~l`, type: 'inLayer', to: 'ly_nebel', props: {} }],
});

async function aufbau() {
  const repo = new InMemoryRepository(
    { ...seedRegistry, settings: { ...(seedRegistry.settings ?? {}), campaign: 'camp_nebel' } },
    [
      ebene('ly_regeln'),
      ebene('ly_nebel'),
      runde,
      andere,
      artikel('p_idee', 'Der verborgene Hafen', 'idea'),
      artikel('p_fertig', 'Der Markt', 'ready'),
      artikel('p_ohne', 'Die Brücke'),
    ],
  );
  const app = buildApp({ repo });
  const konto = async (name: string, opts: { admin?: boolean; roles?: Record<string, 'gm' | 'co-gm' | 'player' | 'spectator'> }) =>
    repo.putUser({
      id: `u_${name.toLowerCase()}_${randomUUID().slice(0, 4)}`,
      name,
      passwordHash: await hashPassword(PASSWORT),
      isAdmin: opts.admin ?? false,
      actorIds: [],
      roles: opts.roles ?? {},
    });
  await konto('Basil', { admin: true });
  await konto('Mira', { roles: { camp_nebel: 'gm' } });
  await konto('Sela', { roles: { camp_nebel: 'player' } });
  await konto('Tom', { roles: { camp_nebel: 'player' } });
  await konto('Gast', { roles: { camp_nebel: 'spectator' } });

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
  const sieht = async (name: string, id: string) => {
    const einzeln = await als(name, 'GET', `/api/entities/${id}`);
    const liste = (await als(name, 'GET', '/api/list?limit=500')).json() as { rows: { id: string }[] };
    return { code: einzeln.statusCode, inListe: liste.rows.some((r) => r.id === id) };
  };
  return { repo, app, als, sieht };
}

describe('players create articles; ready is set by the GM', () => {
  it('lets a player create an article of any kind, in her campaign layer, unfinished', async () => {
    const { als, repo } = await aufbau();
    const res = await als('Sela', 'POST', '/api/entities', { type: 'Place', name: 'Selas Heimatdorf' });
    expect(res.statusCode).toBe(201);
    const e = res.json() as Entity;
    expect((e.components?.['Status'] as { status?: string }).status).toBe('idea');
    /* Die Ebene der Runde, nicht das geteilte Regelwerk. */
    expect(e.relations?.filter((r) => r.type === 'inLayer').map((r) => r.to)).toEqual(['ly_nebel']);
    /* Wer es angelegt hat, steht neben dem Konto — nicht im Artikel. */
    expect(JSON.stringify(e)).not.toMatch(/u_sela/);
    expect(await repo.authorsOf(e.id)).toEqual([expect.stringMatching(/^u_sela/)]);
  });

  it('ignores a layer the player names and keeps prepared, refuses ready', async () => {
    const { als } = await aufbau();
    const res = await als('Sela', 'POST', '/api/entities', {
      type: 'Place',
      name: 'Vorbereitet',
      fields: { 'Status.status': 'prepared' },
      relations: [{ type: 'inLayer', to: 'ly_regeln' }],
    });
    expect(res.statusCode).toBe(201);
    const e = res.json() as Entity;
    expect((e.components?.['Status'] as { status?: string }).status).toBe('prepared');
    expect(e.relations?.filter((r) => r.type === 'inLayer').map((r) => r.to)).toEqual(['ly_nebel']);
    const fertig = await als('Sela', 'POST', '/api/entities', {
      type: 'Place',
      name: 'Gleich fertig',
      fields: { 'Status.status': 'ready' },
    });
    expect(fertig.statusCode).toBe(403);
  });

  it('assigns a player character she creates to her account', async () => {
    const { als } = await aufbau();
    const res = await als('Sela', 'POST', '/api/entities', { type: 'PlayerCharacter', name: 'Ilka' });
    expect(res.statusCode).toBe(201);
    const id = (res.json() as Entity).id;
    const me = (await als('Sela', 'GET', '/api/me')).json() as { actors: { id: string }[]; writable: string[]; create: boolean };
    expect(me.actors.map((a) => a.id)).toContain(id);
    expect(me.writable).toContain(id);
    expect(me.create).toBe(true);
  });

  it('keeps creating away from spectators and accounts without a seat', async () => {
    const { als } = await aufbau();
    expect((await als('Gast', 'POST', '/api/entities', { type: 'Place', name: 'x' })).statusCode).toBe(403);
    const me = (await als('Gast', 'GET', '/api/me')).json() as { create: boolean; ready: boolean };
    expect(me).toMatchObject({ create: false, ready: false });
  });

  it('shows a draft to its author and the GM, and to no other player — list, article, links', async () => {
    const { als, sieht } = await aufbau();
    const id = ((await als('Sela', 'POST', '/api/entities', { type: 'Place', name: 'Selas Versteck' })).json() as Entity).id;
    expect(await sieht('Sela', id)).toEqual({ code: 200, inListe: true });
    expect(await sieht('Mira', id)).toEqual({ code: 200, inListe: true });
    expect(await sieht('Basil', id)).toEqual({ code: 200, inListe: true });
    expect(await sieht('Tom', id)).toEqual({ code: 404, inListe: false });
    /* Ein Verweis findet ihn für Tom nicht — sonst verriete er, dass es ihn gibt. */
    const links = (await als('Tom', 'POST', '/api/links', { texts: ['[[Selas Versteck]]'] })).json() as { open: string[] };
    expect(links.open).toEqual(['Selas Versteck']);
  });

  it('shows players only ready articles, and an article without a status counts as ready', async () => {
    const { sieht } = await aufbau();
    expect(await sieht('Tom', 'p_idee')).toEqual({ code: 404, inListe: false });
    expect(await sieht('Tom', 'p_fertig')).toEqual({ code: 200, inListe: true });
    expect(await sieht('Tom', 'p_ohne')).toEqual({ code: 200, inListe: true });
    expect(await sieht('Mira', 'p_idee')).toEqual({ code: 200, inListe: true });
  });

  it('lets the author edit her article but not call it ready; the GM can', async () => {
    const { als, sieht } = await aufbau();
    const e = (await als('Sela', 'POST', '/api/entities', { type: 'Place', name: 'Die Mühle' })).json() as Entity;
    const mit = (status: string | null): Entity => {
      const components = { ...e.components };
      if (status === null) delete components['Status'];
      else components['Status'] = { status };
      return { ...e, components };
    };
    expect((await als('Sela', 'PUT', `/api/entities/${e.id}`, mit('prepared'))).statusCode).toBe(200);
    expect((await als('Sela', 'PUT', `/api/entities/${e.id}`, mit('ready'))).statusCode).toBe(403);
    /* Die Karte wegzulassen ist kein Umweg: ohne Stand gilt er als fertig. */
    expect((await als('Sela', 'PUT', `/api/entities/${e.id}`, mit(null))).statusCode).toBe(403);
    /* Ein anderer Spieler schreibt ihn gar nicht. */
    expect((await als('Tom', 'PUT', `/api/entities/${e.id}`, mit('prepared'))).statusCode).toBe(403);

    expect((await als('Mira', 'PUT', `/api/entities/${e.id}`, mit('ready'))).statusCode).toBe(200);
    expect(await sieht('Tom', e.id)).toEqual({ code: 200, inListe: true });
  });

  it('lets the GM write only what players submitted, not everything (E-001 is open)', async () => {
    const { als, repo } = await aufbau();
    const idee = (await repo.getEntity('p_idee'))!;
    const res = await als('Mira', 'PUT', '/api/entities/p_idee', {
      ...idee,
      components: { ...idee.components, Status: { status: 'ready' } },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('what /api/me tells the GM', () => {
  it('lists what players submitted as writable for the GM, so the mask can set ready', async () => {
    const { als } = await aufbau();
    const id = ((await als('Sela', 'POST', '/api/entities', { type: 'Place', name: 'Vorgelegt' })).json() as Entity).id;
    const mira = (await als('Mira', 'GET', '/api/me')).json() as { writable: string[]; ready: boolean; create: boolean };
    expect(mira.writable).toContain(id);
    expect(mira.writable).not.toContain('p_idee');
    expect(mira).toMatchObject({ ready: true, create: false });
    const tom = (await als('Tom', 'GET', '/api/me')).json() as { writable: string[] };
    expect(tom.writable).not.toContain(id);
  });
});

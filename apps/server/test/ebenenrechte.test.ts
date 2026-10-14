/**
 * Schreibrechte je Ebene (T-098, E-001): eigene Ebenen, die Ebene der
 * Kampagne für `gm` und `co-gm`, und Fremdes als Fassung.
 *
 * Geprüft wird die Matrix — wer schreibt was —, und was man am Tisch nicht
 * sofort merkt: dass eine aufgeschaltete eigene Ebene nicht zur Ebene der
 * Kampagne wird, dass ein Artikel, der auch im geteilten Regelwerk liegt,
 * dort nicht mitgeändert wird, und dass die Mitleitung schreibt, aber
 * `ready` weiter bei `gm` bleibt.
 */

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import type { Entity } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';

const PASSWORT = 'nebel-wacht-am-tor';

const ebene = (id: string, order: number): Entity => ({
  id,
  interfaces: ['Layer'],
  name: id,
  components: { Identity: { name: id, id: `layer-${id}`, aliases: [] }, Layer: { order } },
  relations: [],
});
const kampagne = (id: string, name: string, ebenen: string[]): Entity => ({
  id,
  interfaces: ['Campaign'],
  name,
  components: { Identity: { name, id: `campaign-${id}`, aliases: [] } },
  relations: ebenen.map((to, i) => ({ id: `${id}~a${i}`, type: 'activates', to, props: { order: (i + 1) * 10 } })),
});
const ort = (id: string, name: string, ebenen: string[], status = 'ready'): Entity => ({
  id,
  interfaces: ['Place'],
  name,
  components: { Identity: { name, id: `place-${id}`, aliases: [] }, Status: { status } },
  relations: ebenen.map((to, i) => ({ id: `${id}~l${i}`, type: 'inLayer', to, props: {} })),
});

type Rolle = 'gm' | 'co-gm' | 'player' | 'spectator';

async function aufbau() {
  const repo = new InMemoryRepository(
    { ...seedRegistry, settings: { ...(seedRegistry.settings ?? {}), campaign: 'camp_nebel' } },
    [
      ebene('ly_regeln', 1),
      ebene('ly_nebel', 20),
      ebene('ly_salz', 20),
      kampagne('camp_nebel', 'Nebelwacht', ['ly_regeln', 'ly_nebel']),
      kampagne('camp_salz', 'Salzpfad', ['ly_regeln', 'ly_salz']),
      ort('r_regel', 'Regelort', ['ly_regeln']),
      ort('n_ort', 'Der Markt', ['ly_nebel']),
      ort('s_ort', 'Salzhafen', ['ly_salz']),
      ort('beides', 'Die Brücke', ['ly_regeln', 'ly_nebel']),
      ort('lose', 'Ohne Ebene', []),
    ],
  );
  const app = buildApp({ repo });
  const ids = new Map<string, string>();
  const konto = async (name: string, admin: boolean, roles: Record<string, Rolle>) => {
    const id = `u_${name.toLowerCase()}_${randomUUID().slice(0, 4)}`;
    ids.set(name, id);
    await repo.putUser({ id, name, passwordHash: await hashPassword(PASSWORT), isAdmin: admin, actorIds: [], roles });
  };
  await konto('Basil', true, {});
  await konto('Mira', false, { camp_nebel: 'gm' });
  await konto('Cora', false, { camp_nebel: 'co-gm' });
  await konto('Sela', false, { camp_nebel: 'player' });
  await konto('Tom', false, { camp_nebel: 'player' });
  await konto('Gast', false, { camp_nebel: 'spectator' });
  await konto('Rolf', false, { camp_salz: 'gm' });

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
  /** Den Namen ändern, gegen die Revision, die gerade steht. */
  const umbenennen = async (name: string, id: string, neu: string) => {
    const e = (await repo.getEntity(id))!;
    return als(name, 'PUT', `/api/entities/${id}`, { ...e, name: neu, components: { ...e.components, Identity: { ...e.components['Identity'], name: neu } } });
  };
  return { repo, als, umbenennen, ids };
}

describe('who writes what (T-098, E-001)', () => {
  it('lets gm and co-gm write the campaign layer, and nothing shared, other or without a layer', async () => {
    const { umbenennen } = await aufbau();
    const matrix: [string, string, number][] = [
      ['Basil', 'r_regel', 200],
      ['Basil', 'lose', 200],
      ['Mira', 'n_ort', 200],
      ['Mira', 'r_regel', 403],
      ['Mira', 'beides', 403],
      ['Mira', 'lose', 403],
      ['Mira', 's_ort', 403],
      ['Cora', 'n_ort', 200],
      ['Cora', 'r_regel', 403],
      ['Sela', 'n_ort', 403],
      ['Gast', 'n_ort', 403],
      ['Rolf', 'n_ort', 403],
      ['Rolf', 's_ort', 200],
    ];
    const ist: [string, string, number][] = [];
    for (const [wer, id] of matrix) ist.push([wer, id, (await umbenennen(wer, id, `${wer} war hier`)).statusCode]);
    expect(ist).toEqual(matrix);
  });

  it('keeps ready with gm: a change by the co-gm falls back, the players keep the ready state', async () => {
    const { als, umbenennen, repo } = await aufbau();
    expect((await umbenennen('Cora', 'n_ort', 'Der neue Markt')).statusCode).toBe(200);
    expect(((await repo.getEntity('n_ort'))!.components['Status'] as { status: string }).status).toBe('prepared');
    expect((await als('Tom', 'GET', '/api/entities/n_ort')).json().name).toBe('Der Markt');
    expect((await als('Mira', 'POST', '/api/entities/n_ort/ready')).statusCode).toBe(200);
    expect((await als('Tom', 'GET', '/api/entities/n_ort')).json().name).toBe('Der neue Markt');
  });

  it('lets the GM create in the campaign layer, ready if she likes; the co-gm creates unfinished', async () => {
    const { als } = await aufbau();
    const m = await als('Mira', 'POST', '/api/entities', { type: 'Place', name: 'Hafen', fields: { 'Status.status': 'ready' } });
    expect(m.statusCode).toBe(201);
    const e = m.json() as Entity;
    expect(e.relations?.filter((r) => r.type === 'inLayer').map((r) => r.to)).toEqual(['ly_nebel']);
    expect((e.components['Status'] as { status: string }).status).toBe('ready');
    const c = await als('Cora', 'POST', '/api/entities', { type: 'Place', name: 'Kai', relations: [{ type: 'inLayer', to: 'ly_regeln' }] });
    expect(c.statusCode).toBe(201);
    const k = c.json() as Entity;
    /* Nicht ins geteilte Regelwerk, auch wenn die Maske es nennt. */
    expect(k.relations?.filter((r) => r.type === 'inLayer').map((r) => r.to)).toEqual(['ly_nebel']);
    expect((k.components['Status'] as { status: string }).status).toBe('idea');
    expect((await als('Gast', 'POST', '/api/entities', { type: 'Place', name: 'Nein' })).statusCode).toBe(403);
  });
});

describe('own layers', () => {
  it('lets anyone create one; it works once the GM turns it on, and it does not become the campaign layer', async () => {
    const { als, umbenennen } = await aufbau();
    const neu = await als('Sela', 'POST', '/api/layers', { name: 'Selas Notizen' });
    expect(neu.statusCode).toBe(201);
    const ly = (neu.json() as { id: string }).id;
    let mine = (await als('Sela', 'GET', '/api/layers/mine')).json();
    expect(mine.layers).toEqual([expect.objectContaining({ id: ly, owner: true, inPlay: false })]);
    /* Noch nicht im Spiel: angelegt wird wie bisher in die Ebene der Runde. */
    const vorher = (await als('Sela', 'POST', '/api/entities', { type: 'Place', name: 'Früh', relations: [{ type: 'inLayer', to: ly }] })).json() as Entity;
    expect(vorher.relations?.filter((r) => r.type === 'inLayer').map((r) => r.to)).toEqual(['ly_nebel']);

    expect((await als('Mira', 'POST', `/api/campaigns/camp_nebel/layers/${ly}`)).statusCode).toBe(200);
    mine = (await als('Sela', 'GET', '/api/layers/mine')).json();
    expect(mine.layers[0]).toMatchObject({ id: ly, inPlay: true });
    /* Spezifischer als die Kampagnenebene? Gleich — sie gehört Sela und
       wird nicht die Ebene der Kampagne. */
    expect((await umbenennen('Mira', 'n_ort', 'Markt II')).statusCode).toBe(200);
    expect((await als('Mira', 'GET', '/api/layers/mine')).json().layers.map((l: { id: string }) => l.id)).toEqual(['ly_nebel']);

    const drin = await als('Sela', 'POST', '/api/entities', { type: 'Place', name: 'Selas Ort', relations: [{ type: 'inLayer', to: ly }] });
    const e = drin.json() as Entity;
    expect(e.relations?.filter((r) => r.type === 'inLayer').map((r) => r.to)).toEqual([ly]);
    expect((e.components['Status'] as { status: string }).status).toBe('idea');
    expect((await umbenennen('Sela', e.id, 'Selas Ort II')).statusCode).toBe(200);
    expect((await umbenennen('Tom', e.id, 'Toms Ort')).statusCode).toBe(403);
    /* Die Leitung schreibt darin nicht, nennt es aber fertig (`gm` der Kampagne, die die Ebene aufschaltet). */
    expect((await umbenennen('Mira', e.id, 'Miras Ort')).statusCode).toBe(403);
    expect((await als('Mira', 'POST', `/api/entities/${e.id}/ready`)).statusCode).toBe(200);
  });

  it('lets the owner say who else writes in it, and nobody else', async () => {
    const { als, umbenennen, ids } = await aufbau();
    const ly = ((await als('Sela', 'POST', '/api/layers', { name: 'Gemeinsam' })).json() as { id: string }).id;
    await als('Mira', 'POST', `/api/campaigns/camp_nebel/layers/${ly}`);
    const e = (await als('Sela', 'POST', '/api/entities', { type: 'Place', name: 'Ort', relations: [{ type: 'inLayer', to: ly }] })).json() as Entity;
    expect((await umbenennen('Tom', e.id, 'Tom 1')).statusCode).toBe(403);
    expect((await als('Sela', 'POST', `/api/layers/${ly}/editors`, { name: 'Tom' })).statusCode).toBe(201);
    expect((await umbenennen('Tom', e.id, 'Tom 2')).statusCode).toBe(200);
    expect((await als('Tom', 'POST', `/api/layers/${ly}/editors`, { name: 'Gast' })).statusCode).toBe(403);
    expect((await als('Mira', 'GET', `/api/layers/${ly}/editors`)).statusCode).toBe(403);
    const liste = (await als('Sela', 'GET', `/api/layers/${ly}/editors`)).json();
    expect(liste.editors.map((x: { name: string; owner: boolean }) => [x.name, x.owner])).toEqual([['Sela', true], ['Tom', false]]);
    /* Die Verwaltung sieht es je Konto. */
    const konten = (await als('Basil', 'GET', '/api/users')).json() as { name: string; layers: { id: string; owner: boolean }[] }[];
    expect(konten.find((k) => k.name === 'Tom')?.layers).toEqual([{ id: ly, name: 'Gemeinsam', owner: false }]);
    expect((await als('Sela', 'DELETE', `/api/layers/${ly}/editors/${ids.get('Tom')}`)).statusCode).toBe(200);
    expect((await umbenennen('Tom', e.id, 'Tom 3')).statusCode).toBe(403);
    expect((await als('Sela', 'DELETE', `/api/layers/${ly}/editors/${ids.get('Sela')}`)).statusCode).toBe(403);
  });

  it('deletes an empty layer for its owner; one with articles only the admin', async () => {
    const { als } = await aufbau();
    const leer = ((await als('Sela', 'POST', '/api/layers', { name: 'Leer' })).json() as { id: string }).id;
    const voll = ((await als('Sela', 'POST', '/api/layers', { name: 'Voll' })).json() as { id: string }).id;
    await als('Mira', 'POST', `/api/campaigns/camp_nebel/layers/${voll}`);
    await als('Sela', 'POST', '/api/entities', { type: 'Place', name: 'Drin', relations: [{ type: 'inLayer', to: voll }] });
    expect((await als('Sela', 'DELETE', `/api/entities/${voll}`)).statusCode).toBe(409);
    expect((await als('Sela', 'DELETE', `/api/entities/${leer}`)).statusCode).toBe(200);
    expect((await als('Sela', 'GET', '/api/layers/mine')).json().layers.map((l: { id: string }) => l.id)).toEqual([voll]);
  });
});

describe('editing what is not yours makes a version (T-098)', () => {
  it('offers the target layers and lays the version there; the original stays', async () => {
    const { als, repo } = await aufbau();
    /* Für die Leitung: das Regelwerk und was ohne Ebene ist, in die Ebene der Kampagne. */
    expect((await als('Mira', 'GET', '/api/entities/r_regel')).json().refs.adaptTo).toEqual([{ id: 'ly_nebel', name: 'ly_nebel' }]);
    expect((await als('Mira', 'GET', '/api/entities/lose')).json().refs.adaptTo).toEqual([{ id: 'ly_nebel', name: 'ly_nebel' }]);
    /* Was sie schreibt, bekommt keine Fassung. */
    expect((await als('Mira', 'GET', '/api/entities/n_ort')).json().refs.adaptTo).toBeUndefined();
    const r = await als('Mira', 'POST', '/api/entities/lose/adapt');
    expect(r.statusCode).toBe(201);
    const fassung = (await repo.getEntity(r.json().id))!;
    expect(fassung.relations?.map((k) => [k.type, k.to])).toEqual([['inLayer', 'ly_nebel'], ['overrides', 'lose']]);
    expect((await repo.getEntity('lose'))!.relations).toEqual([]);
    /* Wer das Original öffnet, bekommt die Fassung. */
    expect((await als('Tom', 'GET', '/api/entities/lose')).json().id).toBe(fassung.id);
  });

  it('asks which layer when there are several, and refuses one that is not yours', async () => {
    const { als } = await aufbau();
    const ly = ((await als('Mira', 'POST', '/api/layers', { name: 'Miras Werkstatt' })).json() as { id: string }).id;
    await als('Mira', 'POST', `/api/campaigns/camp_nebel/layers/${ly}`);
    const offen = await als('Mira', 'POST', '/api/entities/r_regel/adapt');
    expect(offen.statusCode).toBe(409);
    expect(offen.json().layers.map((l: { id: string }) => l.id)).toEqual(['ly_nebel', ly]);
    expect((await als('Mira', 'POST', '/api/entities/r_regel/adapt', { layer: 'ly_regeln' })).statusCode).toBe(409);
    const gut = await als('Mira', 'POST', '/api/entities/r_regel/adapt', { layer: ly });
    expect(gut.statusCode).toBe(201);
    /* Ein Spieler ohne eigene Ebene im Spiel bekommt keine Fassung. */
    expect((await als('Tom', 'POST', '/api/entities/n_ort/adapt')).statusCode).toBe(403);
  });
});

describe('a new campaign gets its own layer', () => {
  it('creates it, turns it on, and its GM writes in it', async () => {
    const { als } = await aufbau();
    const res = await als('Basil', 'POST', '/api/campaigns', { name: 'Dritte Runde' });
    expect(res.statusCode).toBe(201);
    const c = (res.json() as { id: string }).id;
    const ebenen = (await als('Basil', 'GET', `/api/campaigns/${c}/layers`)).json();
    expect(ebenen.layers.filter((l: { active: boolean }) => l.active)).toEqual([
      expect.objectContaining({ id: `ly_${c}`, name: 'Dritte Runde', kind: 'campaign' }),
    ]);
  });
});

/**
 * Die Spielerebene (T-164): je Konto und Kampagne, in der es `player` ist,
 * eine eigene Ebene als Vorgabe zum Schreiben — unter der Ebene der
 * Kampagne, ohne Fassungen fremder Artikel, und wenn die Rolle geht, bleibt
 * sie stehen, bis die Leitung sie übernimmt.
 */

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import { activeStack, type Entity } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';
import { sorgeSpielerEbene, spielerEbeneVon } from '../src/spielerebene.js';

const PASSWORT = 'nebel-wacht-am-tor';

const ebene = (id: string): Entity => ({
  id,
  interfaces: ['Layer'],
  name: id,
  components: { Identity: { name: id, id: `layer-${id}`, aliases: [] }, Layer: { order: 10 } },
  relations: [],
});
const ort = (id: string, name: string, ebenen: string[]): Entity => ({
  id,
  interfaces: ['Place'],
  name,
  components: { Identity: { name, id: `place-${id}`, aliases: [] }, Status: { status: 'ready' } },
  relations: ebenen.map((to, i) => ({ id: `${id}~l${i}`, type: 'inLayer', to, props: {} })),
});

async function aufbau() {
  const repo = new InMemoryRepository(
    { ...seedRegistry, settings: { ...(seedRegistry.settings ?? {}), campaign: 'camp_nebel' } },
    [
      ebene('ly_regeln'),
      ebene('ly_nebel'),
      {
        id: 'camp_nebel',
        interfaces: ['Campaign'],
        name: 'Nebelwacht',
        components: { Identity: { name: 'Nebelwacht', id: 'campaign-0001', aliases: [] } },
        relations: [
          { id: 'a1', type: 'activates', to: 'ly_regeln', props: { order: 10 } },
          { id: 'a2', type: 'activates', to: 'ly_nebel', props: { order: 20 } },
        ],
      },
      ort('r_regel', 'Regelort', ['ly_regeln']),
      ort('n_ort', 'Der Markt', ['ly_nebel']),
    ],
  );
  const app = buildApp({ repo });
  const ids = new Map<string, string>();
  const konto = async (name: string, roles: Record<string, 'gm' | 'player' | 'spectator'>) => {
    const id = `u_${name.toLowerCase()}_${randomUUID().slice(0, 4)}`;
    ids.set(name, id);
    await repo.putUser({ id, name, passwordHash: await hashPassword(PASSWORT), isAdmin: false, actorIds: [], roles });
  };
  await konto('Mira', { camp_nebel: 'gm' });
  await konto('Sela', {});
  await konto('Tom', { camp_nebel: 'player' });
  const kekse = new Map<string, string>();
  const als = async (name: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: unknown) => {
    let k = kekse.get(name);
    if (!k) {
      const res = await app.inject({ method: 'POST', url: '/api/login', payload: { name, password: PASSWORT } });
      k = `nw_session=${res.cookies.find((x) => x.name === 'nw_session')!.value}`;
      kekse.set(name, k);
    }
    return app.inject({ method, url, headers: { cookie: k }, ...(payload !== undefined ? { payload: payload as object } : {}) });
  };
  const umbenennen = async (name: string, id: string, neu: string) => {
    const e = (await repo.getEntity(id))!;
    return als(name, 'PUT', `/api/entities/${id}`, { ...e, name: neu, components: { ...e.components, Identity: { ...e.components['Identity'], name: neu } } });
  };
  /* Sela wird über die Seite Spielerin — dabei entsteht ihre Ebene. */
  expect((await als('Mira', 'POST', '/api/campaigns/camp_nebel/members', { name: 'Sela', role: 'player' })).statusCode).toBe(201);
  const ly = spielerEbeneVon(await repo.layerGrants(), ids.get('Sela')!, 'camp_nebel')!;
  return { repo, als, umbenennen, ids, ly };
}

describe('player layer (T-164)', () => {
  it('comes with the role: owned by the account, turned on just under the campaign layer', async () => {
    const { repo, ly, ids } = await aufbau();
    expect(ly).toBeTruthy();
    const e = (await repo.getEntity(ly))!;
    expect(e.name).toBe('Sela · Nebelwacht');
    expect(e.components['Layer']).toMatchObject({ kind: 'player' });
    const map = new Map((await repo.listEntities()).map((x) => [x.id, x]));
    expect(activeStack(map, map.get('camp_nebel')!).map((x) => x.layer.id)).toEqual(['ly_regeln', ly, 'ly_nebel']);
    /* Ein zweites Mal legt nichts Neues an. */
    expect(await sorgeSpielerEbene(repo, ids.get('Sela')!, 'camp_nebel')).toBe(ly);
    expect((await repo.listEntities()).filter((x) => x.interfaces?.[0] === 'Layer')).toHaveLength(3);
  });

  it('is where a player creates, and the default the server names; the GM keeps the campaign layer', async () => {
    const { als, umbenennen, ly } = await aufbau();
    expect((await als('Sela', 'GET', '/api/layers/default')).json().layer).toMatchObject({ id: ly, player: true });
    expect((await als('Mira', 'GET', '/api/layers/default')).json().layer).toMatchObject({ id: 'ly_nebel', player: false });
    /* Tom hat (noch) keine: wie bisher die Ebene der Kampagne. */
    expect((await als('Tom', 'GET', '/api/layers/default')).json().layer).toMatchObject({ id: 'ly_nebel' });
    const mine = (await als('Sela', 'GET', '/api/layers/mine')).json();
    expect(mine.default).toEqual({ id: ly, name: 'Sela · Nebelwacht' });
    expect(mine.layers).toEqual([expect.objectContaining({ id: ly, owner: true, default: true, player: expect.objectContaining({ mine: true }) })]);

    const r = await als('Sela', 'POST', '/api/entities', { type: 'Place', name: 'Selas Versteck', fields: { 'Status.status': 'ready' } });
    expect(r.statusCode).toBe(403);
    const n = await als('Sela', 'POST', '/api/entities', { type: 'Place', name: 'Selas Versteck' });
    expect(n.statusCode).toBe(201);
    const e = n.json() as Entity;
    expect(e.relations?.filter((k) => k.type === 'inLayer').map((k) => k.to)).toEqual([ly]);
    expect((e.components['Status'] as { status: string }).status).toBe('idea');
    expect((await umbenennen('Sela', e.id, 'Selas Höhle')).statusCode).toBe(200);
    expect((await umbenennen('Tom', e.id, 'Toms Höhle')).statusCode).toBe(403);
    /* Die Leitung schreibt die Spielerebenen ihrer Runde mit … */
    expect((await umbenennen('Mira', e.id, 'Die Höhle')).statusCode).toBe(200);
    /* … und legt weiter in ihre eigene an. */
    const m = (await als('Mira', 'POST', '/api/entities', { type: 'Place', name: 'Hafen' })).json() as Entity;
    expect(m.relations?.filter((k) => k.type === 'inLayer').map((k) => k.to)).toEqual(['ly_nebel']);
  });

  it('takes no versions of other articles', async () => {
    const { als, ly } = await aufbau();
    expect((await als('Sela', 'GET', '/api/entities/r_regel')).json().refs.adaptTo ?? []).toEqual([]);
    const ziele = ((await als('Mira', 'GET', '/api/entities/r_regel')).json().refs.adaptTo ?? []) as { id: string }[];
    expect(ziele.map((z) => z.id)).toEqual(['ly_nebel']);
    expect(ziele.some((z) => z.id === ly)).toBe(false);
  });

  it('stays when the role goes, is no longer written, and the GM takes it over', async () => {
    const { als, repo, ids, ly } = await aufbau();
    const e = (await als('Sela', 'POST', '/api/entities', { type: 'Place', name: 'Selas Versteck' })).json() as Entity;
    /* Mit Inhalt löscht sie die Leitung nicht — und sieht, was darin liegt. */
    const weg = await als('Mira', 'DELETE', `/api/entities/${ly}`);
    expect(weg.statusCode).toBe(409);
    expect(weg.json().contents).toEqual([{ id: e.id, name: 'Selas Versteck', type: 'Place' }]);
    expect((await als('Mira', 'POST', `/api/layers/${ly}/takeover`)).statusCode).toBe(409);

    expect((await als('Mira', 'PUT', `/api/campaigns/camp_nebel/members/${ids.get('Sela')}`, { role: 'spectator' })).statusCode).toBe(200);
    expect((await als('Sela', 'GET', '/api/layers/mine')).json().layers).toEqual([]);
    expect((await als('Sela', 'POST', '/api/entities', { type: 'Place', name: 'Nein' })).statusCode).toBe(403);
    expect(await repo.getEntity(ly)).toBeTruthy();

    expect((await als('Tom', 'POST', `/api/layers/${ly}/takeover`)).statusCode).toBe(403);
    const r = await als('Mira', 'POST', `/api/layers/${ly}/takeover`);
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ into: { id: 'ly_nebel' }, moved: [{ id: e.id }], kept: [], deleted: true });
    expect((await repo.getEntity(e.id))!.relations?.filter((k) => k.type === 'inLayer').map((k) => k.to)).toEqual(['ly_nebel']);
    expect(await repo.getEntity(ly)).toBeUndefined();
    expect((await repo.getEntity('camp_nebel'))!.relations?.some((k) => k.to === ly)).toBe(false);
    expect((await repo.layerGrants()).some((g) => g.layerId === ly)).toBe(false);
  });
});

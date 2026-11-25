/**
 * Ebene wechseln mit Mitläufern (T-402, E-161 a+c): `POST
 * /api/entities/move-layer` zeigt mit `dryRun` den Plan — Teile, eigener
 * Statblock, Inventar, je mit Häkchen und wo sie sonst noch hängen — und
 * schreibt sonst als eine Massenänderung, die Undo zurücknimmt.
 */

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import { homeLayers, withHomeLayer, type Entity } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';
import { spielerEbeneVon } from '../src/spielerebene.js';

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
      { ...ort('n_stand', 'Ein Stand', ['ly_nebel']), relations: [{ id: 's~l', type: 'inLayer', to: 'ly_nebel', props: {} }, { id: 's~p', type: 'partOf', to: 'n_ort', props: {} }] },
      { ...ort('n_ecke', 'Eine Ecke', ['ly_regeln']), relations: [{ id: 'e~l', type: 'inLayer', to: 'ly_regeln', props: {} }, { id: 'e~p', type: 'partOf', to: 'n_ort', props: {} }] },
      { ...ort('n_brief', 'Ein Brief', ['ly_nebel']), components: { Identity: { name: 'Ein Brief', id: 'place-brief', aliases: [] }, Description: { description: 'Treffpunkt: [[n_stand|der Stand]].' } } },
    ],
  );
  const app = buildApp({ repo });
  const konto = async (name: string, roles: Record<string, 'gm' | 'player'>, isAdmin = false) => {
    const id = `u_${name.toLowerCase()}_${randomUUID().slice(0, 4)}`;
    await repo.putUser({ id, name, passwordHash: await hashPassword(PASSWORT), isAdmin, actorIds: [], roles });
    return id;
  };
  await konto('Mira', { camp_nebel: 'gm' });
  const sela = await konto('Sela', {});
  await konto('Vera', {}, true);
  const kekse = new Map<string, string>();
  const als = async (name: string, method: 'GET' | 'POST' | 'PUT', url: string, payload?: unknown) => {
    let k = kekse.get(name);
    if (!k) {
      const res = await app.inject({ method: 'POST', url: '/api/login', payload: { name, password: PASSWORT } });
      k = `nw_session=${res.cookies.find((x) => x.name === 'nw_session')!.value}`;
      kekse.set(name, k);
    }
    return app.inject({ method, url, headers: { cookie: k }, ...(payload !== undefined ? { payload: payload as object } : {}) });
  };
  expect((await als('Mira', 'POST', '/api/campaigns/camp_nebel/members', { name: 'Sela', role: 'player' })).statusCode).toBe(201);
  const ly = spielerEbeneVon(await repo.layerGrants(), sela, 'camp_nebel')!;
  /** Gelesen, in `layer` gelegt und zurückgeschrieben — wie die Maske. */
  const verschieben = async (wer: string, id: string, layer: string | null) => {
    const e = (await als(wer, 'GET', `/api/entities/${id}`)).json() as Entity & { refs?: unknown };
    return als(wer, 'PUT', `/api/entities/${id}`, { ...e, refs: undefined, relations: withHomeLayer(e.relations ?? [], layer, id) });
  };
  const ebenenVon = async (id: string) => homeLayers((await repo.getEntity(id))!.relations);
  return { repo, als, ly, verschieben, ebenenVon };
}

type Plan = {
  roots: { id: string }[];
  followers: { id: string; via: string; preselected: boolean; sameLayer: boolean; linkedFrom: { id: string; via: string }[] }[];
  target: { id: string; name: string };
};

describe('moving an article with its followers (T-402)', () => {
  it('shows the plan: parts preselected from the same layer, others listed, with where they are linked', async () => {
    const { als, ly } = await aufbau();
    const r = await als('Mira', 'POST', '/api/entities/move-layer', { ids: ['n_ort'], layer: ly, dryRun: true });
    expect(r.statusCode).toBe(200);
    const plan = r.json() as Plan;
    expect(plan.target.id).toBe(ly);
    const f = Object.fromEntries(plan.followers.map((x) => [x.id, x]));
    expect(f['n_stand']).toMatchObject({ via: 'partOf', preselected: true, linkedFrom: [{ id: 'n_brief', via: 'text' }] });
    expect(f['n_ecke']).toMatchObject({ sameLayer: false, preselected: false });
  });

  it('moves the article and the chosen followers as one run, and undo brings them back', async () => {
    const { als, ly, ebenenVon } = await aufbau();
    const r = await als('Mira', 'POST', '/api/entities/move-layer', { ids: ['n_ort'], layer: ly });
    expect(r.statusCode).toBe(200);
    expect(await ebenenVon('n_ort')).toEqual([ly]);
    expect(await ebenenVon('n_stand')).toEqual([ly]);
    expect(await ebenenVon('n_ecke')).toEqual(['ly_regeln']);
    const id = (r.json() as { id: string }).id;
    expect((await als('Mira', 'POST', `/api/bulk/${id}/undo`, {})).statusCode).toBe(200);
    expect(await ebenenVon('n_ort')).toEqual(['ly_nebel']);
    expect(await ebenenVon('n_stand')).toEqual(['ly_nebel']);
  });

  it('leaves deselected followers where they are; `from` names the old layer after the article moved', async () => {
    const { als, ly, ebenenVon, verschieben } = await aufbau();
    expect((await als('Mira', 'POST', '/api/entities/move-layer', { ids: ['n_ort'], layer: ly, include: [] })).statusCode).toBe(200);
    expect(await ebenenVon('n_stand')).toEqual(['ly_nebel']);
    /* Im Bearbeiten: erst gespeichert (PUT), dann die Mitläufer aus der alten Ebene. */
    expect((await verschieben('Mira', 'n_ort', 'ly_nebel')).statusCode).toBe(200);
    expect((await verschieben('Mira', 'n_ort', ly)).statusCode).toBe(200);
    const plan = (await als('Mira', 'POST', '/api/entities/move-layer', { ids: ['n_ort'], layer: ly, from: ['ly_nebel'], dryRun: true })).json() as Plan;
    expect(plan.followers.find((x) => x.id === 'n_stand')?.preselected).toBe(true);
    expect((await als('Mira', 'POST', '/api/entities/move-layer', { ids: ['n_ort'], layer: ly, from: ['ly_nebel'], include: ['n_stand'] })).statusCode).toBe(200);
    expect(await ebenenVon('n_stand')).toEqual([ly]);
  });

  it('refuses a layer the account does not write in, and a player moving what is not hers', async () => {
    const { als, ly, ebenenVon } = await aufbau();
    const nein = await als('Mira', 'POST', '/api/entities/move-layer', { ids: ['n_ort'], layer: 'ly_regeln' });
    expect(nein.statusCode).toBe(403);
    expect(nein.json().error).toContain('Choose one of your write layers');
    const sela = await als('Sela', 'POST', '/api/entities/move-layer', { ids: ['n_ort'], layer: ly });
    expect([403, 422]).toContain(sela.statusCode);
    expect(await ebenenVon('n_ort')).toEqual(['ly_nebel']);
    expect((await als('Mira', 'POST', '/api/entities/move-layer', { ids: [], layer: ly })).statusCode).toBe(400);
  });
});

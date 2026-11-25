/**
 * Die Ebene eines Artikels wechseln (T-383): im Bearbeiten das erste Feld,
 * gespeichert über denselben `PUT` — und dort geprüft: hinein nur in eine
 * Ebene, in der das Konto in der laufenden Kampagne schreibt
 * (`zielEbenen`, wie T-161), aus jeder Ebene heraus nur die Verwaltung.
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

describe('moving an article to another layer (T-383)', () => {
  it('lets the GM move between the campaign layer and a player layer, not into a rulebook', async () => {
    const { ly, verschieben, ebenenVon } = await aufbau();
    expect((await verschieben('Mira', 'n_ort', ly)).statusCode).toBe(200);
    expect(await ebenenVon('n_ort')).toEqual([ly]);
    expect((await verschieben('Mira', 'n_ort', 'ly_nebel')).statusCode).toBe(200);
    expect(await ebenenVon('n_ort')).toEqual(['ly_nebel']);

    const nein = await verschieben('Mira', 'n_ort', 'ly_regeln');
    expect(nein.statusCode).toBe(403);
    expect(nein.json().error).toContain('ly_regeln');
    expect(nein.json().error).toContain('Choose one of your write layers');
    expect(await ebenenVon('n_ort')).toEqual(['ly_nebel']);
  });

  it('lets a player move only into her own write layers, and never out of every layer', async () => {
    const { repo, als, ly, verschieben, ebenenVon } = await aufbau();
    const neu = (await als('Sela', 'POST', '/api/entities', { type: 'Place', name: 'Versteck' })).json() as Entity;
    expect(await ebenenVon(neu.id)).toEqual([ly]);
    /* Die Ebene der Kampagne schreibt sie nicht — anlegen darf sie dort, verschieben nicht. */
    expect((await verschieben('Sela', neu.id, 'ly_nebel')).statusCode).toBe(403);
    expect((await verschieben('Sela', neu.id, null)).statusCode).toBe(403);
    expect(await ebenenVon(neu.id)).toEqual([ly]);

    /* Eine eigene Ebene, aufgeschaltet: dorthin geht es. */
    const eigene = (await als('Sela', 'POST', '/api/layers', { name: 'Selas Notizen' })).json() as { id: string };
    const k = (await repo.getEntity('camp_nebel'))!;
    await repo.putEntity({ ...k, relations: [...(k.relations ?? []), { id: 'a3', type: 'activates', to: eigene.id, props: { order: 30 } }] });
    expect((await verschieben('Sela', neu.id, eigene.id)).statusCode).toBe(200);
    expect(await ebenenVon(neu.id)).toEqual([eigene.id]);
    /* Was sie nicht schreibt, verschiebt sie ohnehin nicht. */
    expect((await verschieben('Sela', 'n_ort', ly)).statusCode).toBe(403);
  });

  it('lets the administration move anywhere — out of every layer means Unassigned (E-182) —, and leaves ordinary saves alone', async () => {
    const { als, verschieben, ebenenVon } = await aufbau();
    expect((await verschieben('Vera', 'r_regel', 'ly_nebel')).statusCode).toBe(200);
    expect((await verschieben('Vera', 'r_regel', null)).statusCode).toBe(200);
    expect(await ebenenVon('r_regel')).toEqual(['ly_unassigned']);

    /* Ein Feld ändern, ohne die Ebene anzufassen, prüft nichts davon. */
    const e = (await als('Mira', 'GET', '/api/entities/n_ort')).json() as Entity;
    const put = await als('Mira', 'PUT', '/api/entities/n_ort', {
      ...e,
      refs: undefined,
      components: { ...e.components, Description: { description: 'Laut.' } },
    });
    expect(put.statusCode).toBe(200);
    expect(await ebenenVon('n_ort')).toEqual(['ly_nebel']);
  });
});

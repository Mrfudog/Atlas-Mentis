/**
 * Die Schreibebene (T-161): wohin ein Konto ohne Nennung anlegt — gewählt
 * im Popup der Kopfleiste, gespeichert je Konto und Kampagne, geprüft
 * gegen die Zielebenen; fällt sie weg, gilt die Vorgabe (T-164).
 */

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import type { Entity } from '@nw/model';
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
  const ids = new Map<string, string>();
  const konto = async (name: string, roles: Record<string, 'gm' | 'player' | 'spectator'>, isAdmin = false) => {
    const id = `u_${name.toLowerCase()}_${randomUUID().slice(0, 4)}`;
    ids.set(name, id);
    await repo.putUser({ id, name, passwordHash: await hashPassword(PASSWORT), isAdmin, actorIds: [], roles });
  };
  await konto('Mira', { camp_nebel: 'gm' });
  await konto('Sela', {});
  await konto('Tom', { camp_nebel: 'player' });
  await konto('Vera', {}, true);
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
  /* Sela wird über die Seite Spielerin — dabei entsteht ihre Ebene. */
  expect((await als('Mira', 'POST', '/api/campaigns/camp_nebel/members', { name: 'Sela', role: 'player' })).statusCode).toBe(201);
  const ly = spielerEbeneVon(await repo.layerGrants(), ids.get('Sela')!, 'camp_nebel')!;
  return { repo, als, ids, ly };
}

/** Eine Ebene in der laufenden Kampagne auf- oder abschalten. */
async function schalten(repo: InMemoryRepository, layer: string, an: boolean) {
  const k = (await repo.getEntity('camp_nebel'))!;
  const rest = (k.relations ?? []).filter((r) => !(r.type === 'activates' && r.to === layer));
  await repo.putEntity({ ...k, relations: an ? [...rest, { id: `a_${layer}`, type: 'activates', to: layer, props: { order: 30 } }] : rest });
}
const ebenenVon = (e: Entity) => (e.relations ?? []).filter((r) => r.type === 'inLayer').map((r) => r.to);

describe('write layer (T-161)', () => {
  it('is the player layer by default, offers own layers also outside play (T-418), and is chosen on the server', async () => {
    const { repo, als, ly } = await aufbau();
    const vorher = (await als('Sela', 'GET', '/api/layers/write')).json();
    expect(vorher).toMatchObject({ layer: { id: ly }, default: { id: ly }, chosen: false, dropped: null, none: false });
    expect(vorher.options).toEqual([expect.objectContaining({ id: ly, reason: 'player', selectable: true })]);

    const eigene = (await als('Sela', 'POST', '/api/layers', { name: 'Selas Notizen' })).json() as { id: string };
    const liste = (await als('Sela', 'GET', '/api/layers/write')).json().options as { id: string; selectable: boolean; why?: string }[];
    /* Wählbar, aber mit Hinweis: was dort entsteht, steht hier erst, wenn die Kampagne sie aufschaltet. */
    expect(liste.find((o) => o.id === eigene.id)).toMatchObject({ selectable: true, inPlay: false });
    expect(liste.find((o) => o.id === eigene.id)?.why).toMatch(/does not show here until/);
    /* Ein Regelwerk, in dem sie nicht schreibt, bleibt gesperrt. */
    expect((await als('Sela', 'PUT', '/api/layers/write', { layer: 'ly_regeln' })).statusCode).toBe(403);
    /* Nur über die eigene Route — die Einstellungen nehmen den Schlüssel nicht. */
    expect((await als('Sela', 'PUT', '/api/me/prefs/writeLayer', { value: { camp_nebel: 'ly_regeln' } })).statusCode).toBe(400);

    await schalten(repo, eigene.id, true);
    const gewaehlt = await als('Sela', 'PUT', '/api/layers/write', { layer: eigene.id });
    expect(gewaehlt.statusCode).toBe(200);
    expect(gewaehlt.json()).toMatchObject({ layer: { id: eigene.id }, default: { id: ly }, chosen: true });
    const neu = (await als('Sela', 'POST', '/api/entities', { type: 'Place', name: 'Versteck' })).json() as Entity;
    expect(ebenenVon(neu)).toEqual([eigene.id]);
    /* Eine im Dialog genannte Ebene geht vor. */
    const genannt = (await als('Sela', 'POST', '/api/entities', { type: 'Place', name: 'Lager', relations: [{ type: 'inLayer', to: ly }] })).json() as Entity;
    expect(ebenenVon(genannt)).toEqual([ly]);

    /* Fällt sie aus dem Stapel, bleibt die Wahl (T-418) — sie ist eine
       eigene Ebene und weiter wählbar; die Option sagt, dass sie hier nicht
       im Spiel ist, und die Kopfleiste zeigt es. */
    await schalten(repo, eigene.id, false);
    const aus = (await als('Sela', 'GET', '/api/layers/write')).json();
    expect(aus).toMatchObject({ layer: { id: eigene.id }, chosen: true, dropped: null });
    expect(aus.options.find((o: { id: string }) => o.id === eigene.id)).toMatchObject({ inPlay: false });
    const danach = (await als('Sela', 'POST', '/api/entities', { type: 'Place', name: 'Brunnen' })).json() as Entity;
    expect(ebenenVon(danach)).toEqual([eigene.id]);

    /* Fällt das Recht weg (die Ebene geht), gilt die Vorgabe — und die Antwort sagt es. */
    await repo.deleteEntity(eigene.id);
    expect((await als('Sela', 'GET', '/api/layers/write')).json()).toMatchObject({
      layer: { id: ly },
      chosen: false,
      dropped: { id: eigene.id },
    });
    /* Zurück zur Vorgabe. */
    expect((await als('Sela', 'PUT', '/api/layers/write', { layer: null })).json()).toMatchObject({ chosen: false, dropped: null });
  });

  it('puts versions into the GM write layer, and the administration writes into the campaign layer until it chooses one', async () => {
    const { repo, als } = await aufbau();
    const mira = (await als('Mira', 'GET', '/api/layers/write')).json();
    expect(mira).toMatchObject({ layer: { id: 'ly_nebel' }, default: { id: 'ly_nebel' } });
    expect(mira.options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'ly_nebel', reason: 'gm', selectable: true }),
        expect.objectContaining({ reason: 'playerOf', player: 'Sela' }),
      ]),
    );
    const test = (await als('Mira', 'POST', '/api/layers', { name: 'Test' })).json() as { id: string };
    await schalten(repo, test.id, true);
    /* Zwei Ziele: ohne Wahl fragt der Server zurück, mit Wahl nimmt sie die Fassung. */
    expect((await als('Mira', 'POST', '/api/entities/r_regel/adapt', {})).statusCode).toBe(409);
    expect((await als('Mira', 'PUT', '/api/layers/write', { layer: test.id })).statusCode).toBe(200);
    expect(((await als('Mira', 'GET', '/api/entities/r_regel')).json().refs.adaptTo as { id: string }[])[0]!.id).toBe(test.id);
    const f = await als('Mira', 'POST', '/api/entities/r_regel/adapt', {});
    expect(f.statusCode).toBe(201);
    expect(ebenenVon((await repo.getEntity(f.json().id))!)).toEqual([test.id]);

    const ohne = (await als('Vera', 'GET', '/api/layers/write')).json();
    expect(ohne).toMatchObject({ layer: null, none: true });
    /* Ohne Wahl die Kampagnenebene (E-182) — eine Ebene hat jeder Artikel. */
    expect(ebenenVon((await als('Vera', 'POST', '/api/entities', { type: 'Place', name: 'Irgendwo' })).json())).toEqual(['ly_nebel']);
    expect((await als('Vera', 'PUT', '/api/layers/write', { layer: 'ly_nebel' })).statusCode).toBe(200);
    expect(ebenenVon((await als('Vera', 'POST', '/api/entities', { type: 'Place', name: 'Dort' })).json())).toEqual(['ly_nebel']);
  });
});

/**
 * Fassung, Variante oder Kopie in einer anderen Ebene (T-405, REQ-400):
 * `POST /api/entities/:id/copy { mode, layer?, include?, dryRun? }` — die
 * Leitung legt aus einem Regelwerk, das sie nicht schreibt, eine Fassung,
 * eine Variante oder eine Kopie in die Ebene der Kampagne, mit den Teilen;
 * die Spielerin nur in ihre eigene Ebene; eine fremde Ebene wird abgelehnt.
 */

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import { homeLayers, type Entity } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';
import { spielerEbeneVon } from '../src/spielerebene.js';

const PASSWORT = 'nebel-wacht-am-tor';
const ebene = (id: string): Entity => ({ id, interfaces: ['Layer'], name: id, components: { Identity: { name: id, id: `layer-${id}`, aliases: [] }, Layer: { order: 10 } }, relations: [] });
const ort = (id: string, name: string, layer: string, mehr: Entity['relations'] = []): Entity => ({
  id, interfaces: ['Place'], name,
  components: { Identity: { name, id: `place-${id}`, aliases: [] }, Status: { status: 'ready' } },
  relations: [{ id: `${id}~l`, type: 'inLayer', to: layer, props: {} }, ...(mehr ?? [])],
});

async function aufbau() {
  const repo = new InMemoryRepository(
    { ...seedRegistry, settings: { ...(seedRegistry.settings ?? {}), campaign: 'camp_nebel' } },
    [
      ebene('ly_regeln'),
      ebene('ly_nebel'),
      ebene('ly_fremd'),
      { id: 'camp_nebel', interfaces: ['Campaign'], name: 'Nebelwacht', components: { Identity: { name: 'Nebelwacht', id: 'campaign-0001', aliases: [] } },
        relations: [
          { id: 'a1', type: 'activates', to: 'ly_regeln', props: { order: 10 } },
          { id: 'a2', type: 'activates', to: 'ly_nebel', props: { order: 20 } },
        ] },
      ort('r_burg', 'Die Burg', 'ly_regeln'),
      ort('r_turm', 'Der Turm', 'ly_regeln', [{ id: 't~p', type: 'partOf', to: 'r_burg', props: {} }]),
    ],
  );
  const app = buildApp({ repo });
  const konto = async (name: string, roles: Record<string, 'gm' | 'player'>) => {
    const id = `u_${name.toLowerCase()}_${randomUUID().slice(0, 4)}`;
    await repo.putUser({ id, name, passwordHash: await hashPassword(PASSWORT), isAdmin: false, actorIds: [], roles });
    return id;
  };
  await konto('Mira', { camp_nebel: 'gm' });
  const sela = await konto('Sela', {});
  const kekse = new Map<string, string>();
  const als = async (name: string, method: 'GET' | 'POST', url: string, payload?: unknown) => {
    if (!kekse.has(name)) {
      const res = await app.inject({ method: 'POST', url: '/api/login', payload: { name, password: PASSWORT } });
      kekse.set(name, `nw_session=${res.cookies.find((x) => x.name === 'nw_session')!.value}`);
    }
    return app.inject({ method, url, headers: { cookie: kekse.get(name)! }, ...(payload !== undefined ? { payload: payload as object } : {}) });
  };
  expect((await als('Mira', 'POST', '/api/campaigns/camp_nebel/members', { name: 'Sela', role: 'player' })).statusCode).toBe(201);
  const ly = spielerEbeneVon(await repo.layerGrants(), sela, 'camp_nebel')!;
  return { repo, als, ly };
}

type Antwort = { id: string; created: { id: string; from: string; name: string }[]; layer: { id: string; name: string } };

describe('a version, a variant or a copy in another layer (T-405)', () => {
  it('shows the parts in the plan and lets the GM make a version with them', async () => {
    const { repo, als } = await aufbau();
    const plan = (await als('Mira', 'POST', '/api/entities/r_burg/copy', { mode: 'version', layer: 'ly_nebel', dryRun: true })).json() as {
      followers: { id: string; preselected: boolean }[];
      layers: { id: string }[];
    };
    expect(plan.followers).toEqual([expect.objectContaining({ id: 'r_turm', preselected: true })]);
    expect(plan.layers.map((l) => l.id)).toContain('ly_nebel');
    const r = await als('Mira', 'POST', '/api/entities/r_burg/copy', { mode: 'version', layer: 'ly_nebel', include: ['r_turm'] });
    expect(r.statusCode).toBe(201);
    const a = r.json() as Antwort;
    expect(a.layer.id).toBe('ly_nebel');
    expect(a.created.map((c) => c.from)).toEqual(['r_burg', 'r_turm']);
    const burg = (await repo.getEntity(a.id))!;
    expect(homeLayers(burg.relations)).toEqual(['ly_nebel']);
    expect(burg.relations).toContainEqual(expect.objectContaining({ type: 'overrides', to: 'r_burg' }));
    const turm = (await repo.getEntity(a.created[1]!.id))!;
    expect(turm.relations).toContainEqual(expect.objectContaining({ type: 'partOf', to: a.id }));
    /* In der Kampagne gilt die Fassung: der Artikel unter der Id des Originals führt dorthin. */
    expect((await repo.getEntity('r_burg'))!.relations).toHaveLength(1);
  });

  it('makes a variant and an independent copy without the parts when unticked', async () => {
    const { repo, als } = await aufbau();
    const v = (await als('Mira', 'POST', '/api/entities/r_burg/copy', { mode: 'variant', layer: 'ly_nebel', include: [] })).json() as Antwort;
    expect(v.created).toHaveLength(1);
    expect((await repo.getEntity(v.id))!.relations).toContainEqual(expect.objectContaining({ type: 'variantOf', to: 'r_burg' }));
    const k = (await als('Mira', 'POST', '/api/entities/r_burg/copy', { mode: 'copy', layer: 'ly_nebel', include: [] })).json() as Antwort;
    const kopie = (await repo.getEntity(k.id))!;
    expect(kopie.components?.['Identity']?.['name']).toBe('Die Burg (copy)');
    expect(kopie.relations?.some((r) => r.type === 'variantOf' || r.type === 'overrides')).toBe(false);
  });

  it('lets a player copy only into her own layer, and refuses a layer nobody writes', async () => {
    const { als, ly } = await aufbau();
    expect((await als('Sela', 'POST', '/api/entities/r_burg/copy', { mode: 'copy', layer: 'ly_nebel' })).statusCode).toBe(403);
    const r = await als('Sela', 'POST', '/api/entities/r_burg/copy', { mode: 'copy', layer: ly });
    expect(r.statusCode).toBe(201);
    expect((await als('Mira', 'POST', '/api/entities/r_burg/copy', { mode: 'copy', layer: 'ly_fremd' })).statusCode).toBe(403);
    expect((await als('Mira', 'POST', '/api/entities/r_burg/copy', { mode: 'nonsense', layer: 'ly_nebel' })).statusCode).toBe(400);
    expect((await als('Mira', 'POST', '/api/entities/gibts-nicht/copy', { mode: 'copy', layer: 'ly_nebel' })).statusCode).toBe(404);
  });
});

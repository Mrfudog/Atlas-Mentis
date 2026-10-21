/**
 * Massenänderung über alle Ebenen (T-182): ein Buch, das keine Runde
 * aufschaltet, bekommt Kanten nur über `allLayers` — und nur von der
 * Verwaltung.
 */

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import type { Entity } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';

const PASSWORT = 'nebel-wacht-am-tor';
const ident = (name: string, id: string) => ({ Identity: { name, id, aliases: [] }, Status: { status: 'ready' } });
const ebene = (id: string, n: number): Entity => ({
  id, name: id, interfaces: ['Layer'], components: { ...ident(id, `layer-00${n}`), Layer: { kind: 'pack', order: n } }, relations: [],
});
const im = (id: string, ly: string) => ({ id: `${id}_in`, type: 'inLayer', to: ly, props: {} });

function bestand(): Entity[] {
  return [
    ebene('ly_an', 1),
    ebene('ly_aus', 2),
    { id: 'camp', name: 'Runde', interfaces: ['Campaign'], components: ident('Runde', 'campaign-0001'), relations: [{ id: 'a1', type: 'activates', to: 'ly_an', props: { order: 10 } }] },
    { id: 'sz', name: 'Hall', interfaces: ['Scene'], components: ident('Hall', 'scene-0001'), relations: [im('sz', 'ly_aus')] },
    { id: 'ort', name: 'Hall', interfaces: ['Place'], components: ident('Hall', 'place-0001'), relations: [im('ort', 'ly_aus'), { id: 'ort_d', type: 'describedIn', to: 'sz', props: {} }] },
  ];
}

async function aufbau(admin: boolean) {
  const repo = new InMemoryRepository(seedRegistry, bestand());
  const app = buildApp({ repo });
  await repo.putUser({ id: randomUUID(), name: 'Wer', passwordHash: await hashPassword(PASSWORT), isAdmin: admin, actorIds: [], roles: admin ? {} : { camp: 'gm' } });
  const login = await app.inject({ method: 'POST', url: '/api/login', payload: { name: 'Wer', password: PASSWORT } });
  const cookie = `nw_session=${login.cookies.find((x) => x.name === 'nw_session')?.value ?? ''}`;
  const bulk = (payload: Record<string, unknown>) => app.inject({ method: 'POST', url: '/api/bulk', headers: { cookie }, payload });
  return { repo, bulk };
}

const auftrag = {
  select: { types: ['Scene'] },
  ops: [{ op: 'addRelation', type: 'happensAt', to: '<-describedIn', toTypes: ['Place'], ifNone: true }],
};

describe('POST /api/bulk mit allLayers (T-182)', () => {
  it('trifft ohne allLayers nur, was im Spiel ist', async () => {
    const { bulk } = await aufbau(true);
    expect((await bulk({ ...auftrag, dryRun: true })).json()).toMatchObject({ selected: 0 });
  });

  it('trifft mit allLayers auch nicht aufgeschaltete Ebenen und schreibt das Ziel aus der Kante', async () => {
    const { bulk, repo } = await aufbau(true);
    const res = await bulk({ ...auftrag, allLayers: true });
    expect(res.json()).toMatchObject({ selected: 1, changed: 1 });
    expect((await repo.getEntity('sz'))!.relations!.filter((r) => r.type === 'happensAt').map((r) => r.to)).toEqual(['ort']);
  });

  it('nur für die Verwaltung', async () => {
    const { bulk } = await aufbau(false);
    expect((await bulk({ ...auftrag, allLayers: true, dryRun: true })).statusCode).toBe(403);
  });
});

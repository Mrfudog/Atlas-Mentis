/**
 * Ergänzungen (T-142, E-125): eine Fassung, die nur einzelne Felder trägt
 * — die Formen aus Basils System neben den geschätzten Preisen.
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
const ebene = (id: string, name: string, n: number, order: number): Entity => ({
  id,
  name,
  interfaces: ['Layer'],
  components: { ...ident(name, `layer-00${n}`), Layer: { kind: 'pack', order } },
  relations: [],
});
const im = (id: string, ly: string) => ({ id: `${id}_in`, type: 'inLayer', to: ly, props: {} });

function bestand(mitFormen: boolean): Entity[] {
  return [
    ebene('ly_buch', 'Book', 1, 0),
    ebene('ly_ai', 'AI generated prices', 2, 50),
    ebene('ly_form', 'Item shapes', 3, 60),
    {
      id: 'camp',
      name: 'Runde',
      interfaces: ['Campaign'],
      components: ident('Runde', 'campaign-0001'),
      relations: [
        { id: 'a1', type: 'activates', to: 'ly_buch', props: { order: 10 } },
        { id: 'a2', type: 'activates', to: 'ly_ai', props: { order: 20 } },
        ...(mitFormen ? [{ id: 'a3', type: 'activates', to: 'ly_form', props: { order: 30 } }] : []),
      ],
    },
    { id: 'bow', name: 'Bow', interfaces: ['Item'], components: { ...ident('Bow', 'item-0001'), Item: { weight: 2 }, Description: { description: 'A bow.' } }, relations: [im('bow', 'ly_buch')] },
    {
      id: 'bow_ai', name: 'Bow', interfaces: ['Item'],
      components: { ...ident('Bow', 'item-0002'), Item: { weight: 2, copperPrice: 2500, priceNote: 'estimated' }, Description: { description: 'A bow.' } },
      relations: [im('bow_ai', 'ly_ai'), { id: 'bow_ai_o', type: 'overrides', to: 'bow', props: {} }],
    },
    {
      id: 'bow_sh', name: 'Bow', interfaces: ['Item'],
      components: { Identity: { name: 'Bow', id: 'item-0003', aliases: [] }, Item: { rows: ['#.', '##'], stackSize: 1 } },
      relations: [im('bow_sh', 'ly_form'), { id: 'bow_sh_o', type: 'overrides', to: 'bow', props: { fields: ['Item.rows', 'Item.stackSize'] } }],
    },
  ];
}

async function aufbau(mitFormen = true) {
  const repo = new InMemoryRepository(seedRegistry, bestand(mitFormen));
  const app = buildApp({ repo });
  await repo.putUser({ id: randomUUID(), name: 'Admin', passwordHash: await hashPassword(PASSWORT), isAdmin: true, actorIds: [], roles: {} });
  const login = await app.inject({ method: 'POST', url: '/api/login', payload: { name: 'Admin', password: PASSWORT } });
  const cookie = `nw_session=${login.cookies.find((x) => x.name === 'nw_session')?.value ?? ''}`;
  const rufe = (method: 'GET' | 'PUT' | 'POST', url: string, payload?: unknown) =>
    app.inject({ method, url, headers: { cookie }, ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }) });
  return { repo, rufe };
}

describe('Ergänzungen (T-142)', () => {
  it('legen ihre Felder über die geltende Fassung, ohne sie zu ersetzen', async () => {
    const { rufe } = await aufbau();
    const e = (await rufe('GET', '/api/entities/bow')).json();
    expect(e.id).toBe('bow_ai');
    expect(e.components.Item).toMatchObject({ copperPrice: 2500, rows: ['#.', '##'], stackSize: 1, weight: 2 });
    expect(e.components.Description.description).toBe('A bow.');
    expect(e.refs.supplied).toEqual({ 'Item.rows': 'bow_sh', 'Item.stackSize': 'bow_sh' });
  });

  it('kommen auch in der Sammelabfrage mit, ohne die Id zu wechseln', async () => {
    const { rufe } = await aufbau();
    /* Das Original steht nicht im Spiel (die Preisfassung ersetzt es) — wie bisher. */
    const liste = (await rufe('GET', '/api/entities?ids=bow,bow_ai')).json() as Entity[];
    expect(liste.map((e) => e.id)).toEqual(['bow_ai']);
    expect(liste[0]?.components?.['Item']).toMatchObject({ rows: ['#.', '##'], copperPrice: 2500 });
  });

  it('stehen für sich in keiner Liste', async () => {
    const { rufe } = await aufbau();
    const liste = (await rufe('GET', '/api/list?type=Item')).json();
    expect(liste.rows.map((r: { id: string }) => r.id)).toEqual(['bow_ai']);
  });

  it('gelten nur aufgeschaltet', async () => {
    const { rufe } = await aufbau(false);
    const e = (await rufe('GET', '/api/entities/bow')).json();
    expect(e.components.Item.rows).toBeUndefined();
    expect(e.refs.supplied).toBeUndefined();
  });

  it('schreiben ihre Felder nicht in den Artikel darunter, sondern in sich', async () => {
    const { rufe, repo } = await aufbau();
    const { refs: _r, ...e } = (await rufe('GET', '/api/entities/bow')).json();
    e.components.Item = { ...e.components.Item, rows: ['###'], weight: 3 };
    const res = await rufe('PUT', '/api/entities/bow_ai', e);
    expect(res.statusCode).toBeLessThan(300);
    const gespeichert = await repo.getEntity('bow_ai');
    expect(gespeichert?.components?.['Item']).toMatchObject({ weight: 3, copperPrice: 2500 });
    expect(gespeichert?.components?.['Item']?.['rows']).toBeUndefined();
    expect(gespeichert?.components?.['Item']?.['stackSize']).toBeUndefined();
    /* Die geänderte Form steht in der Ergänzung, die Stapelgrösse blieb. */
    expect((await repo.getEntity('bow_sh'))?.components?.['Item']).toEqual({ rows: ['###'], stackSize: 1 });
    expect((await rufe('GET', '/api/entities/bow')).json().components.Item.rows).toEqual(['###']);
  });

  it('lassen sich mit einer Massenänderung ihrer Ebene setzen', async () => {
    const { rufe } = await aufbau();
    const res = await rufe('POST', '/api/bulk', { select: { layer: 'ly_form' }, ops: [{ op: 'set', field: 'Item.stackSize', values: { bow_sh: 4 } }], dryRun: true });
    expect(res.json()).toMatchObject({ selected: 1 });
  });

  it('stehen nicht unter den Fassungen', async () => {
    const { rufe } = await aufbau();
    const f = (await rufe('GET', '/api/entities/bow_ai/versions')).json() as { versions: { entity: Entity }[] };
    expect(f.versions.map((v) => v.entity.id)).toContain('bow');
    expect(f.versions.map((v) => v.entity.id)).not.toContain('bow_sh');
  });
});

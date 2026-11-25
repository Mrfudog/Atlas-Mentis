/**
 * Gitter über den Massstab (T-329): eine Unterkarte, am Raster der Karte
 * darüber ausgerichtet, kommt mit gerechneter Lage und Grösse — gespeichert
 * bleibt die freie.
 */

import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import type { Entity, Relation } from '@nw/model';
import { buildApp } from '../src/app.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';

const PASSWORT = 'nebel-wacht-am-tor';
const imLayer = (id: string): Relation => ({ id: `${id}~l`, type: 'inLayer', to: 'ly_nebel', props: {} });
const art = (id: string, type: string, name: string, extra: Record<string, unknown> = {}, relations: Relation[] = []): Entity => ({
  id,
  interfaces: [type],
  name,
  components: { Identity: { name, id: `${type.toLowerCase()}-${id}`, aliases: [] }, ...extra },
  relations: [imLayer(id), ...relations],
});
const bild = (id: string, w: number, h: number): Entity => art(id, 'Asset', id, { Asset: { kind: 'map', width: w, height: h } });

const bestand: Entity[] = [
  { id: 'ly_nebel', interfaces: ['Layer'], name: 'Nebel', components: { Identity: { name: 'Nebel', id: 'layer-1', aliases: [] } }, relations: [] },
  {
    id: 'camp_nebel',
    interfaces: ['Campaign'],
    name: 'Nebelwacht',
    components: { Identity: { name: 'Nebelwacht', id: 'campaign-0001', aliases: [] }, Campaign: {} },
    relations: [{ id: 'a1', type: 'activates', to: 'ly_nebel', props: { order: 5 } }],
  },
  bild('as_region', 2000, 1000),
  bild('as_stadt', 1000, 800),
  art('region', 'Map', 'Region', { Image: { image: 'as_region' }, Map: { gridShape: 'hex', gridSize: 100, scale: '1 mi' } }),
  art('stadt', 'Map', 'Hafenstadt', { Image: { image: 'as_stadt' }, Map: { gridShape: 'square', gridSize: 50, scale: '50 ft' } }, [
    { id: 'in', type: 'insideMap', to: 'region', props: { x: 0.3, y: 0.4, w: 0.2, h: 0.2, align: true } },
  ]),
  art('tage', 'Map', 'Reisekarte', { Image: { image: 'as_region' }, Map: { gridShape: 'hex', gridSize: 100, scale: '1 day' } }),
  art('dorf', 'Map', 'Dorf', { Image: { image: 'as_stadt' }, Map: { gridShape: 'square', gridSize: 50, scale: '50 ft' } }, [
    { id: 'in2', type: 'insideMap', to: 'tage', props: { x: 0.1, y: 0.1, w: 0.2, h: 0.2, align: true } },
  ]),
];

async function aufbau() {
  const repo = new InMemoryRepository({ ...seedRegistry, settings: { ...(seedRegistry.settings ?? {}), campaign: 'camp_nebel' } }, bestand);
  const app = buildApp({ repo });
  await repo.putUser({ id: 'u_mira', name: 'Mira', passwordHash: await hashPassword(PASSWORT), isAdmin: false, actorIds: [], roles: { camp_nebel: 'gm' } });
  const res = await app.inject({ method: 'POST', url: '/api/login', payload: { name: 'Mira', password: PASSWORT } });
  const keks = `nw_session=${res.cookies.find((x) => x.name === 'nw_session')!.value}`;
  return { hole: (url: string) => app.inject({ method: 'GET', url, headers: { cookie: keks } }), repo };
}

describe('Gitter über den Massstab (T-329)', () => {
  it('schickt den ausgerichteten Bereich: Grösse aus beiden Massstäben, das Raster der Unterkarte darin', async () => {
    const { hole, repo } = await aufbau();
    const k = (await hole('/api/maps/region/context')).json().children[0];
    expect(k).toMatchObject({ id: 'stadt', align: true, scale: '50 ft', childGrid: { shape: 'square', cell: 0.05 } });
    expect(k.frame.w).toBeCloseTo(1000 / 52.8 / 2000, 5);
    expect(k.frame.h).toBeCloseTo(800 / 52.8 / 1000, 5);
    /* Gespeichert bleibt die freie Grösse. */
    const roh = (await repo.getEntity('stadt'))!.relations!.find((r) => r.type === 'insideMap')!;
    expect(roh.props).toMatchObject({ w: 0.2, h: 0.2 });
  });

  it('nennt der Unterkarte die Karte darüber mit Massstab', async () => {
    const { hole } = await aufbau();
    expect((await hole('/api/maps/stadt/context')).json().up).toEqual({ id: 'region', name: 'Region', scale: '1 mi', align: true });
  });

  it('richtet an einem Massstab ohne Länge nicht aus und sagt warum', async () => {
    const { hole } = await aufbau();
    const k = (await hole('/api/maps/tage/context')).json().children[0];
    expect(k).toMatchObject({ id: 'dorf', align: true, alignIssue: 'units' });
    expect(k.frame).toEqual({ x: 0.1, y: 0.1, w: 0.2, h: 0.2 });
  });
});

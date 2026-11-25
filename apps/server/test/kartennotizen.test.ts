/**
 * Notizen und Markeransicht auf der Karte (T-214, E-070 a): eine Notiz
 * ist ein Artikel `Note`, ihr Marker zeigt auf sie, und was nur die
 * Leitung sehen soll, kommt bei Spielenden nicht an — weder der Artikel
 * noch sein Marker noch sein Name im Kartenkontext.
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
  components: { Identity: { name, id: `${type.toLowerCase()}-${id}`, aliases: [] }, Status: { status: 'ready' }, ...extra },
  relations: [imLayer(id), ...relations],
});

const bestand: Entity[] = [
  { id: 'ly_nebel', interfaces: ['Layer'], name: 'Nebel', components: { Identity: { name: 'Nebel', id: 'layer-1', aliases: [] } }, relations: [] },
  {
    id: 'camp_nebel',
    interfaces: ['Campaign'],
    name: 'Nebelwacht',
    components: { Identity: { name: 'Nebelwacht', id: 'campaign-0001', aliases: [] }, Campaign: { markerViews: { region: 'name' } } },
    relations: [{ id: 'a1', type: 'activates', to: 'ly_nebel', props: { order: 5 } }],
  },
  art('npc', 'Creature', 'Volo'),
  art('n_gm', 'Note', 'Falle im Keller', { Description: { description: 'Falle im Keller' }, Visibility: { audience: 'gm' } }),
  art('n_alle', 'Note', 'Treffpunkt', { Description: { description: 'Treffpunkt am Brunnen' }, Visibility: { audience: 'players' } }),
  art('stadt', 'Map', 'Hafenstadt', { Map: { kind: 'region' } }, [
    { id: 'm1', type: 'marker', to: 'npc', props: { x: 0.2, y: 0.2 } },
    { id: 'm2', type: 'marker', to: 'n_gm', props: { x: 0.3, y: 0.3 } },
    { id: 'm3', type: 'marker', to: 'n_alle', props: { x: 0.4, y: 0.4, view: 'symbol' } },
  ]),
];

async function aufbau() {
  const repo = new InMemoryRepository({ ...seedRegistry, settings: { ...(seedRegistry.settings ?? {}), campaign: 'camp_nebel' } }, bestand);
  const app = buildApp({ repo });
  const konto = async (name: string, role: 'gm' | 'player') =>
    repo.putUser({ id: `u_${name.toLowerCase()}`, name, passwordHash: await hashPassword(PASSWORT), isAdmin: false, actorIds: [], roles: { camp_nebel: role } });
  await konto('Mira', 'gm');
  await konto('Sela', 'player');
  const kekse = new Map<string, string>();
  const keks = async (name: string) => {
    let k = kekse.get(name);
    if (!k) {
      const res = await app.inject({ method: 'POST', url: '/api/login', payload: { name, password: PASSWORT } });
      k = `nw_session=${res.cookies.find((x) => x.name === 'nw_session')!.value}`;
      kekse.set(name, k);
    }
    return k;
  };
  const hole = async (name: string, url: string) => app.inject({ method: 'GET', url, headers: { cookie: await keks(name) } });
  const schicke = async (name: string, url: string, payload: unknown) =>
    app.inject({ method: 'POST', url, payload: payload as object, headers: { cookie: await keks(name) } });
  return { hole, schicke };
}

const marker = (e: Entity) => (e.relations ?? []).filter((r) => r.type === 'marker').map((r) => r.id);

describe('notes on a map (T-214, E-070 a)', () => {
  it('a GM note reaches only the GM — article, marker and name', async () => {
    const { hole } = await aufbau();
    expect(marker((await hole('Mira', '/api/entities/stadt')).json() as Entity)).toEqual(['m1', 'm2', 'm3']);
    expect(marker((await hole('Sela', '/api/entities/stadt')).json() as Entity)).toEqual(['m1', 'm3']);
    expect((await hole('Sela', '/api/entities/n_gm')).statusCode).toBe(404);
    const k = (await hole('Sela', '/api/maps/stadt/context')).json() as { targets: Record<string, unknown> };
    expect(Object.keys(k.targets).sort()).toEqual(['n_alle', 'npc']);
  });

  it('the context names the view of the type and of the map kind', async () => {
    const { hole } = await aufbau();
    const k = (await hole('Sela', '/api/maps/stadt/context')).json() as { targets: Record<string, { view?: string }>; kindMarkerView: string | null };
    expect(k.targets['n_alle']!.view).toBe('card');
    expect(k.targets['npc']!.view).toBeUndefined();
    expect(k.kindMarkerView).toBe('name');
  });

  it('a GM creates a note as an article', async () => {
    const { schicke } = await aufbau();
    const res = await schicke('Mira', '/api/entities', {
      type: 'Note',
      name: 'Hier lauert etwas',
      fields: { 'Description.description': 'Hier lauert etwas', 'Visibility.audience': 'gm', 'Status.status': 'ready' },
    });
    expect(res.statusCode).toBe(201);
    const n = res.json() as Entity;
    expect(n.interfaces[0]).toBe('Note');
    expect((n.components['Visibility'] as { audience?: string }).audience).toBe('gm');
  });
});

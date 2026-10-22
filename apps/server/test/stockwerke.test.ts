/**
 * Ebenen einer Karte und Übergänge am Server (T-307, E-108): durchgehen
 * über die Route des Zuges, eine Tür auf einer oberen Ebene, und was
 * Spielende von zurückgehaltenen Ebenen nicht bekommen. Erfundene Artikel.
 */

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import { floorView, mapFloors, mapWalls, markersOf, type Entity } from '@nw/model';
import { buildApp } from '../src/app.js';
import { LocalChangeFeed } from '../src/live.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';
import { kartenImSpiel } from './hilfen/imspiel.js';

const PASSWORT = 'ebenen-wacht-am-turm';
const ident = (name: string, id: string) => ({ Identity: { name, id, aliases: [] }, Status: { status: 'ready' } });
const im = (id: string) => ({ id: `${id}_in`, type: 'inLayer', to: 'ly_a', props: {} });

/* Ein Turm: unten Rook auf der Treppe, oben eine Tür neben dem Treppenende, ein Keller nur für die Leitung. */
function bestand(): Entity[] {
  return [
    { id: 'ly_a', name: 'ly_a', interfaces: ['Layer'], components: { ...ident('Ebene A', 'layer-0001'), Layer: { kind: 'campaign', order: 50 } }, relations: [] },
    { id: 'camp_a', name: 'Runde A', interfaces: ['Campaign'], components: { ...ident('Runde A', 'campaign-0001'), Campaign: {} },
      relations: [{ id: 'camp_a_ac', type: 'activates', to: 'ly_a', props: {} }] },
    { id: 'pc_rook', name: 'Rook', interfaces: ['PlayerCharacter'], components: ident('Rook', 'playercharacter-0001'), relations: [im('pc_rook')] },
    { id: 'cr_rat', name: 'Rat', interfaces: ['Creature'], components: ident('Rat', 'creature-0001'), relations: [im('cr_rat')] },
    { id: 'map_1', name: 'Turm', interfaces: ['Map'],
      components: {
        ...ident('Turm', 'map-0001'),
        Map: {
          gridShape: 'square',
          gridSize: 100,
          floors: [
            { id: 'ground', name: 'Hall', elevation: { from: 0, to: 10 } },
            { id: 'up', name: 'Upper', structure: 'Tower', elevation: { from: 10, to: 20 }, gridShape: 'square', gridSize: 50,
              walls: [{ id: 'd-oben', kind: 'door', x1: 0.15, y1: 0.05, x2: 0.15, y2: 0.15, state: 'closed' }] },
            { id: 'keller', name: 'Cellar', gmOnly: true },
          ],
        },
        Image: { image: 'https://example.org/halle.png' },
      },
      relations: [im('map_1'),
        { id: 'mk_rook', type: 'marker', to: 'pc_rook', props: { x: 0.8, y: 0.8, kind: 'play' } },
        { id: 'mk_rat', type: 'marker', to: 'cr_rat', props: { x: 0.5, y: 0.5, kind: 'play', floor: 'keller' } },
        { id: 'p_treppe', type: 'marker', to: 'map_1', props: { kind: 'passage', passage: 'stairs', x: 0.8, y: 0.8, toFloor: 'up', toX: 0.1, toY: 0.1 } },
        { id: 'p_keller', type: 'marker', to: 'map_1', props: { kind: 'passage', passage: 'ladder', x: 0.2, y: 0.8, toFloor: 'keller', toX: 0.5, toY: 0.5 } }] },
  ];
}

async function aufbau() {
  const registry = { ...seedRegistry, settings: { ...(seedRegistry.settings ?? {}), campaign: 'camp_a' } };
  const repo = new InMemoryRepository(registry, kartenImSpiel(bestand()));
  const app = buildApp({ repo, live: new LocalChangeFeed({ flushMs: 1 }) });
  const konto = async (name: string, roles: Record<string, 'gm' | 'player'>, actorIds: string[] = []) => {
    await repo.putUser({ id: randomUUID(), name, passwordHash: await hashPassword(PASSWORT), isAdmin: false, actorIds, roles });
  };
  await konto('Gwen', { camp_a: 'gm' });
  await konto('Sela', { camp_a: 'player' }, ['pc_rook']);
  const cookies = new Map<string, string>();
  const cookie = async (name: string) => {
    if (!cookies.has(name)) {
      const login = await app.inject({ method: 'POST', url: '/api/login', payload: { name, password: PASSWORT } });
      cookies.set(name, `nw_session=${login.cookies.find((x) => x.name === 'nw_session')?.value ?? ''}`);
    }
    return cookies.get(name)!;
  };
  const rufe = async (name: string, url: string, payload: object) => app.inject({ method: 'POST', url, payload, headers: { cookie: await cookie(name) } });
  const karte = async (name: string) =>
    (await app.inject({ method: 'GET', url: '/api/entities/map_1', headers: { cookie: await cookie(name) } })).json() as Entity;
  return { rufe, karte };
}

describe('Ebenen am Server (T-307)', () => {
  it('eine Ebene der Leitung geht samt Marker und Leiter nicht an Spielende', async () => {
    const { karte } = await aufbau();
    const sela = await karte('Sela');
    expect(mapFloors(sela).map((f) => f.id)).toEqual(['ground', 'up']);
    expect((sela.relations ?? []).map((r) => r.id).filter((i) => i.startsWith('mk_') || i.startsWith('p_'))).toEqual(['mk_rook', 'p_treppe']);
    expect(mapFloors(await karte('Gwen')).map((f) => f.id)).toEqual(['ground', 'up', 'keller']);
  });

  it('durchgehen: Rook nimmt die Treppe und steht oben am Gegenstück', async () => {
    const { rufe, karte } = await aufbau();
    const r = await rufe('Sela', '/api/maps/map_1/move', { rel: 'mk_rook', via: 'p_treppe' });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ floor: 'up', to: { x: 0.1, y: 0.1 } });
    const k = await karte('Gwen');
    expect(markersOf(floorView(k, 'up')).map((m) => [m.to, m.x, m.y])).toEqual([['pc_rook', 0.1, 0.1]]);
    /* Eine Leiter, auf der Rook nicht steht, nimmt er nicht. */
    expect((await rufe('Sela', '/api/maps/map_1/move', { rel: 'mk_rook', via: 'p_keller' })).statusCode).toBe(404);
  });

  it('eine Tür oben: daneben steht, wer auf derselben Ebene steht, im Massstab dieser Ebene', async () => {
    const { rufe, karte } = await aufbau();
    const nat = { w: 1000, h: 1000 };
    /* Unten neben der Stelle der Tür zu stehen zählt nicht. */
    expect((await rufe('Sela', '/api/maps/map_1/door', { wall: 'd-oben', state: 'open', nat })).statusCode).toBe(403);
    await rufe('Sela', '/api/maps/map_1/move', { rel: 'mk_rook', via: 'p_treppe' });
    const r = await rufe('Sela', '/api/maps/map_1/door', { wall: 'd-oben', state: 'open', nat });
    expect(r.statusCode).toBe(200);
    expect(mapWalls(floorView(await karte('Gwen'), 'up')).find((w) => w.id === 'd-oben')?.state).toBe('open');
  });
});

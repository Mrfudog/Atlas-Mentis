/**
 * Türen und Wände am Tisch (T-118): wer eine Tür öffnet, was Spielende von
 * den Sperren bekommen, dass eine Wand den Zug hält und dass eine offene
 * Tür aufdeckt, was dahinter liegt. Erfundene Artikel.
 */

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import { mapWalls, markersOf, revealShapes, type Entity } from '@nw/model';
import { buildApp } from '../src/app.js';
import { LocalChangeFeed } from '../src/live.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';
import { kartenImSpiel } from './hilfen/imspiel.js';

const PASSWORT = 'tueren-wacht-am-tor';
const NAT = { w: 1000, h: 1000 };
const ident = (name: string, id: string) => ({ Identity: { name, id, aliases: [] }, Status: { status: 'ready' } });
const im = (id: string) => ({ id: `${id}_in`, type: 'inLayer', to: 'ly_a', props: {} });

/*
 * Eine Wand senkrecht bei x = 0.5, darin eine Tür von y 0.4 bis 0.5; links
 * davon Rook, rechts ein Goblin. Aufgedeckt ist die linke Hälfte.
 */
function bestand(kampagne: Record<string, unknown>): Entity[] {
  return [
    { id: 'ly_a', name: 'ly_a', interfaces: ['Layer'], components: { ...ident('Ebene A', 'layer-0001'), Layer: { kind: 'campaign', order: 50 } }, relations: [] },
    { id: 'camp_a', name: 'Runde A', interfaces: ['Campaign'], components: { ...ident('Runde A', 'campaign-0001'), Campaign: kampagne },
      relations: [{ id: 'camp_a_ac', type: 'activates', to: 'ly_a', props: {} }] },
    { id: 'party_a', name: 'Gruppe', interfaces: ['Party'], components: ident('Gruppe', 'party-0001'), relations: [im('party_a'), { id: 'pa_of', type: 'partyOf', to: 'camp_a', props: {} }] },
    { id: 'pc_rook', name: 'Rook', interfaces: ['PlayerCharacter'], components: ident('Rook', 'playercharacter-0001'),
      relations: [im('pc_rook'), { id: 'rook_party', type: 'memberOfParty', to: 'party_a', props: {} }] },
    { id: 'cr_gob', name: 'Goblin', interfaces: ['Creature'], components: ident('Goblin', 'creature-0001'), relations: [im('cr_gob')] },
    { id: 'map_1', name: 'Halle', interfaces: ['Map'],
      components: {
        ...ident('Halle', 'map-0001'),
        Map: {
          gridShape: 'square',
          gridSize: 100,
          fog: true,
          reveal: [{ id: 's-links', kind: 'rect', x: 0, y: 0, w: 0.5, h: 1 }],
          walls: [
            { id: 'w-oben', kind: 'wall', x1: 0.5, y1: 0, x2: 0.5, y2: 0.4 },
            { id: 'd-1', kind: 'door', x1: 0.5, y1: 0.4, x2: 0.5, y2: 0.5, state: 'closed' },
            { id: 'w-unten', kind: 'wall', x1: 0.5, y1: 0.5, x2: 0.5, y2: 1 },
            { id: 'd-zu', kind: 'door', x1: 0.3, y1: 0.9, x2: 0.4, y2: 0.9, state: 'locked' },
            { id: 'd-geheim', kind: 'secret', x1: 0.1, y1: 0.2, x2: 0.2, y2: 0.2, state: 'closed' },
            { id: 'd-fern', kind: 'door', x1: 0.7, y1: 0.4, x2: 0.8, y2: 0.4, state: 'closed' },
          ],
        },
        Image: { image: 'https://example.org/halle.png' },
      },
      relations: [im('map_1'),
        { id: 'mk_rook', type: 'marker', to: 'pc_rook', props: { x: 0.45, y: 0.45, kind: 'play' } },
        { id: 'mk_gob', type: 'marker', to: 'cr_gob', props: { x: 0.75, y: 0.45, kind: 'play' } }] },
  ];
}

async function aufbau(kampagne: Record<string, unknown> = {}) {
  const registry = { ...seedRegistry, settings: { ...(seedRegistry.settings ?? {}), campaign: 'camp_a' } };
  const repo = new InMemoryRepository(registry, kartenImSpiel(bestand(kampagne)));
  const live = new LocalChangeFeed({ flushMs: 1 });
  const app = buildApp({ repo, live });
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
  const rufe = async (name: string, url: string, payload: object) =>
    app.inject({ method: 'POST', url, payload, headers: { cookie: await cookie(name) } });
  const karte = async (name: string) =>
    (await app.inject({ method: 'GET', url: '/api/entities/map_1', headers: { cookie: await cookie(name) } })).json() as Entity;
  return { repo, rufe, karte };
}

const tuer = (e: Entity, id: string) => mapWalls(e).find((w) => w.id === id);

describe('Sperren für Spielende (T-118)', () => {
  it('Spielende bekommen die Sperren am Aufgedeckten — die Geheimtür als Wand, ohne „verschlossen“', async () => {
    const { karte } = await aufbau();
    const s = mapWalls(await karte('Sela'));
    expect(s.map((w) => [w.id, w.kind, w.state])).toEqual([
      ['w-oben', 'wall', undefined],
      ['d-1', 'door', 'closed'],
      ['w-unten', 'wall', undefined],
      ['d-zu', 'door', 'closed'],
      ['d-geheim', 'wall', undefined],
    ]);
    expect(mapWalls(await karte('Gwen'))).toHaveLength(6);
  });
});

describe('Türen öffnen (T-118)', () => {
  it('die Spielerin öffnet die Tür neben ihrer Figur; eine verschlossene nicht, eine ferne nicht', async () => {
    const { rufe, karte } = await aufbau();
    expect((await rufe('Sela', '/api/maps/map_1/door', { wall: 'd-zu', state: 'open', nat: NAT })).statusCode).toBe(423);
    expect((await rufe('Sela', '/api/maps/map_1/door', { wall: 'd-fern', state: 'open', nat: NAT })).statusCode).toBe(404);
    expect((await rufe('Sela', '/api/maps/map_1/door', { wall: 'd-1', state: 'locked', nat: NAT })).statusCode).toBe(403);
    /* Die Geheimtür ist für sie eine Wand — auch wer ihre Id kennt, öffnet sie nicht. */
    expect((await rufe('Sela', '/api/maps/map_1/door', { wall: 'd-geheim', state: 'open', nat: NAT })).statusCode).toBe(404);
    const r = await rufe('Sela', '/api/maps/map_1/door', { wall: 'd-1', state: 'open', nat: NAT });
    expect(r.statusCode).toBe(200);
    expect(tuer(await karte('Gwen'), 'd-1')?.state).toBe('open');
  });

  it('zu weit weg: nicht', async () => {
    const { rufe, repo } = await aufbau();
    const roh = (await repo.getEntity('map_1'))!;
    await repo.putEntity({
      ...roh,
      relations: (roh.relations ?? []).map((r) => (r.id === 'mk_rook' ? { ...r, props: { ...r.props, x: 0.1, y: 0.45 } } : r)),
    });
    expect((await rufe('Sela', '/api/maps/map_1/door', { wall: 'd-1', state: 'open', nat: NAT })).statusCode).toBe(403);
  });

  it('mit `doors: gm` nur die Leitung — sie auch verschlossene und Geheimtüren', async () => {
    const { rufe, karte } = await aufbau({ doors: 'gm' });
    expect((await rufe('Sela', '/api/maps/map_1/door', { wall: 'd-1', state: 'open', nat: NAT })).statusCode).toBe(403);
    expect((await rufe('Gwen', '/api/maps/map_1/door', { wall: 'd-zu', state: 'open' })).statusCode).toBe(200);
    expect((await rufe('Gwen', '/api/maps/map_1/door', { wall: 'd-geheim', state: 'open' })).statusCode).toBe(200);
    expect((await rufe('Gwen', '/api/maps/map_1/door', { wall: 'w-oben', state: 'open' })).statusCode).toBe(404);
    /* Die offene Geheimtür ist für Spielende jetzt eine Tür. */
    expect(tuer(await karte('Sela'), 'd-geheim')).toMatchObject({ kind: 'door', state: 'open' });
  });

  it('mit `revealOnMove` deckt die offene Tür auf, was die Gruppe dahinter sieht', async () => {
    const { rufe, karte } = await aufbau({ revealOnMove: true });
    expect(markersOf(await karte('Sela')).map((m) => m.to)).toEqual(['pc_rook']);
    await rufe('Sela', '/api/maps/map_1/door', { wall: 'd-1', state: 'open', nat: NAT });
    const neu = revealShapes(await karte('Gwen')).filter((s) => s.id !== 's-links');
    expect(neu).toHaveLength(1);
    expect(neu[0]).toMatchObject({ kind: 'poly', for: 'pc_rook' });
    /* Der Goblin steht im Blick durch die Tür. */
    expect(markersOf(await karte('Sela')).map((m) => m.to).sort()).toEqual(['cr_gob', 'pc_rook']);
  });
});

describe('Wände halten den Zug (T-118)', () => {
  it('durch die Wand nicht, durch die offene Tür schon — die Leitung zieht frei', async () => {
    const { rufe, karte } = await aufbau();
    const zu = await rufe('Sela', '/api/maps/map_1/move', { rel: 'mk_rook', to: { x: 0.6, y: 0.2 }, nat: NAT });
    expect(zu.statusCode).toBe(422);
    expect(zu.json().error).toBe('A wall is in the way.');
    await rufe('Sela', '/api/maps/map_1/door', { wall: 'd-1', state: 'open', nat: NAT });
    expect((await rufe('Sela', '/api/maps/map_1/move', { rel: 'mk_rook', to: { x: 0.6, y: 0.45 }, nat: NAT })).statusCode).toBe(200);
    expect((await rufe('Gwen', '/api/maps/map_1/move', { rel: 'mk_gob', to: { x: 0.3, y: 0.1 }, nat: NAT })).statusCode).toBe(200);
    expect(markersOf(await karte('Gwen')).find((m) => m.to === 'cr_gob')).toMatchObject({ x: 0.3, y: 0.1 });
  });
});

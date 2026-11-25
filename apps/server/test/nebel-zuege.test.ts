/**
 * Nebel je Figur und Züge nach der Kampagne (T-204): `Campaign.fog`
 * entscheidet, ob Aufgedecktes mit `for` nur der Figur gilt; `moves`, ob
 * eine Spielerin ihre Figur ausserhalb eines Kampfes selbst zieht oder
 * einen Vorschlag macht; `revealOnMove`, ob ein Zug den Weg aufdeckt.
 * Erfundene Artikel.
 */

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import { markersOf, revealShapes, type Entity } from '@nw/model';
import { buildApp } from '../src/app.js';
import { LocalChangeFeed } from '../src/live.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';

const PASSWORT = 'nebel-wacht-am-tor';
const ident = (name: string, id: string) => ({ Identity: { name, id, aliases: [] }, Status: { status: 'ready' } });
const im = (id: string) => ({ id: `${id}_in`, type: 'inLayer', to: 'ly_a', props: {} });

function bestand(kampagne: Record<string, unknown>): Entity[] {
  return [
    { id: 'ly_a', name: 'ly_a', interfaces: ['Layer'], components: { ...ident('Ebene A', 'layer-0001'), Layer: { kind: 'campaign', order: 50 } }, relations: [] },
    { id: 'camp_a', name: 'Runde A', interfaces: ['Campaign'], components: { ...ident('Runde A', 'campaign-0001'), Campaign: kampagne },
      relations: [{ id: 'camp_a_ac', type: 'activates', to: 'ly_a', props: {} }] },
    { id: 'pc_rook', name: 'Rook', interfaces: ['PlayerCharacter'], components: ident('Rook', 'playercharacter-0001'), relations: [im('pc_rook')] },
    { id: 'pc_mira', name: 'Mira', interfaces: ['PlayerCharacter'], components: ident('Mira', 'playercharacter-0002'), relations: [im('pc_mira')] },
    { id: 'cr_gob', name: 'Goblin', interfaces: ['Creature'], components: ident('Goblin', 'creature-0001'), relations: [im('cr_gob')] },
    { id: 'map_1', name: 'Cave', interfaces: ['Map'],
      components: {
        ...ident('Cave', 'map-0001'),
        Map: {
          gridShape: 'square',
          gridSize: 70,
          fog: true,
          reveal: [
            { id: 's-alle', kind: 'rect', x: 0, y: 0, w: 0.2, h: 0.2 },
            { id: 's-rook', kind: 'rect', x: 0.4, y: 0.4, w: 0.2, h: 0.2, for: 'pc_rook' },
            { id: 's-mira', kind: 'rect', x: 0.8, y: 0.8, w: 0.2, h: 0.2, for: 'pc_mira' },
          ],
        },
        Image: { image: 'https://example.org/cave.png' },
      },
      relations: [im('map_1'),
        { id: 'mk_rook', type: 'marker', to: 'pc_rook', props: { x: 0.1, y: 0.1, kind: 'play' } },
        { id: 'mk_mira', type: 'marker', to: 'pc_mira', props: { x: 0.9, y: 0.9, kind: 'play' } },
        { id: 'mk_gob', type: 'marker', to: 'cr_gob', props: { x: 0.5, y: 0.5, kind: 'play' } }] },
  ];
}

async function aufbau(kampagne: Record<string, unknown> = {}) {
  const registry = { ...seedRegistry, settings: { ...(seedRegistry.settings ?? {}), campaign: 'camp_a' } };
  const repo = new InMemoryRepository(registry, bestand(kampagne));
  const live = new LocalChangeFeed({ flushMs: 1 });
  const app = buildApp({ repo, live });
  const konto = async (name: string, roles: Record<string, 'gm' | 'player'>, actorIds: string[] = []) => {
    await repo.putUser({ id: randomUUID(), name, passwordHash: await hashPassword(PASSWORT), isAdmin: false, actorIds, roles });
  };
  await konto('Gwen', { camp_a: 'gm' });
  await konto('Sela', { camp_a: 'player' }, ['pc_rook']);
  await konto('Tam', { camp_a: 'player' }, ['pc_mira']);
  const cookies = new Map<string, string>();
  const cookie = async (name: string) => {
    if (!cookies.has(name)) {
      const login = await app.inject({ method: 'POST', url: '/api/login', payload: { name, password: PASSWORT } });
      cookies.set(name, `nw_session=${login.cookies.find((x) => x.name === 'nw_session')?.value ?? ''}`);
    }
    return cookies.get(name)!;
  };
  const rufe = async (name: string, method: 'GET' | 'POST' | 'PUT', url: string, payload?: object) =>
    app.inject({ method, url, ...(payload ? { payload } : {}), headers: { cookie: await cookie(name) } });
  const karte = async (name: string) => (await rufe(name, 'GET', '/api/entities/map_1')).json() as Entity;
  return { repo, rufe, karte };
}

const formen = (e: Entity) => revealShapes(e).map((s) => s.id).sort();
const marker = (e: Entity) => markersOf(e).map((m) => m.to).sort();

describe('Nebel je Gruppe oder je Figur (T-204)', () => {
  it('je Gruppe sieht jede alles Aufgedeckte', async () => {
    const { karte } = await aufbau();
    const s = await karte('Sela');
    expect(formen(s)).toEqual(['s-alle', 's-mira', 's-rook']);
    expect(marker(s)).toEqual(['cr_gob', 'pc_mira', 'pc_rook']);
  });

  it('je Figur sieht jede nur das eigene und das für alle — die Leitung alles', async () => {
    const { karte } = await aufbau({ fog: 'player' });
    const s = await karte('Sela');
    expect(formen(s)).toEqual(['s-alle', 's-rook']);
    /* Mira steht in dem, was nur sie gesehen hat — und gehört hier keiner Gruppe an. */
    expect(marker(s)).toEqual(['cr_gob', 'pc_rook']);
    const t = await karte('Tam');
    expect(formen(t)).toEqual(['s-alle', 's-mira']);
    /* Den Goblin hat nur Rook gesehen; Rook steht im Aufgedeckten für alle. */
    expect(marker(t)).toEqual(['pc_mira', 'pc_rook']);
    expect(formen(await karte('Gwen'))).toEqual(['s-alle', 's-mira', 's-rook']);
  });

  it('der Kontext nennt die Regeln und die eigenen Figuren', async () => {
    const { rufe } = await aufbau({ fog: 'player', moves: 'confirm', revealOnMove: true });
    const k = (await rufe('Sela', 'GET', '/api/maps/map_1/context')).json();
    expect(k.rules).toEqual({ fog: 'player', moves: 'confirm', tokenMove: 'own', revealOnMove: true, doors: 'players', tokenSizes: 'rules' });
    expect(k.own).toEqual(['pc_rook']);
    expect(k.proposals).toEqual([]);
  });
});

describe('Züge ausserhalb eines Kampfes (T-204)', () => {
  it('frei: die Spielerin zieht ihre Figur, auch ohne die Karte zu schreiben — eine fremde nicht', async () => {
    const { rufe, karte } = await aufbau();
    expect((await rufe('Tam', 'POST', '/api/maps/map_1/move', { rel: 'mk_rook', to: { x: 0.3, y: 0.3 } })).statusCode).toBe(403);
    const r = await rufe('Sela', 'POST', '/api/maps/map_1/move', { rel: 'mk_rook', to: { x: 0.3, y: 0.3 }, nat: { w: 1400, h: 840 } });
    expect(r.statusCode).toBe(200);
    const m = markersOf(await karte('Gwen')).find((x) => x.rel.id === 'mk_rook')!;
    expect([m.x, m.y]).toEqual([0.3, 0.3]);
    /* Aufdecken ist aus (Vorgabe): keine neue Form. */
    expect(formen(await karte('Gwen'))).toHaveLength(3);
  });

  it('mit `revealOnMove` deckt der Zug den Weg für die Figur auf; die Karte darf es abschalten', async () => {
    const { rufe, karte, repo } = await aufbau({ revealOnMove: true });
    await rufe('Sela', 'POST', '/api/maps/map_1/move', { rel: 'mk_rook', to: { x: 0.3, y: 0.1 }, nat: { w: 1400, h: 840 } });
    const neu = revealShapes(await karte('Gwen')).filter((s) => !['s-alle', 's-rook', 's-mira'].includes(s.id));
    expect(neu).toHaveLength(1);
    expect(neu[0]).toMatchObject({ kind: 'path', for: 'pc_rook', r: 0.05, pts: [[0.1, 0.1], [0.3, 0.1]] });

    const roh = (await repo.getEntity('map_1'))!;
    await repo.putEntity({ ...roh, components: { ...roh.components, Map: { ...(roh.components!['Map'] as object), revealOnMove: false } } });
    await rufe('Sela', 'POST', '/api/maps/map_1/move', { rel: 'mk_rook', to: { x: 0.35, y: 0.1 }, nat: { w: 1400, h: 840 } });
    expect(revealShapes(await karte('Gwen'))).toHaveLength(4);
  });

  it('mit Bestätigung wird der Zug ein Vorschlag; die Leitung bestätigt, dann zieht und deckt er auf', async () => {
    const { rufe, karte } = await aufbau({ moves: 'confirm', revealOnMove: true });
    const r = await rufe('Sela', 'POST', '/api/maps/map_1/move', { rel: 'mk_rook', to: { x: 0.3, y: 0.1 }, nat: { w: 1400, h: 840 } });
    expect(r.statusCode).toBe(202);
    const plan = r.json().proposal.plan as string;
    expect(markersOf(await karte('Gwen')).find((x) => x.rel.id === 'mk_rook')).toMatchObject({ x: 0.1, y: 0.1 });

    const gm = (await rufe('Gwen', 'GET', '/api/maps/map_1/context')).json();
    expect(gm.proposals).toEqual([{ plan, actor: 'pc_rook', actorName: 'Rook', by: 'Sela', to: { x: 0.3, y: 0.1 } }]);
    expect((await rufe('Sela', 'GET', '/api/maps/map_1/context')).json().proposals).toHaveLength(1);
    /* Seit T-290 sieht den Vorschlag jeder, der das Token sieht — gestrichelt, entschieden wird nicht. */
    expect((await rufe('Tam', 'GET', '/api/maps/map_1/context')).json().proposals).toHaveLength(1);

    /* Ein zweiter Zug ersetzt den offenen Vorschlag, statt einen weiteren anzulegen. */
    const zwei = await rufe('Sela', 'POST', '/api/maps/map_1/move', { rel: 'mk_rook', to: { x: 0.32, y: 0.1 }, nat: { w: 1400, h: 840 } });
    expect(zwei.json().proposal.plan).toBe(plan);

    expect((await rufe('Gwen', 'POST', `/api/maps/map_1/turn-plan/${plan}/decide`, { decision: 'confirm' })).statusCode).toBe(200);
    const nachher = await karte('Gwen');
    expect(markersOf(nachher).find((x) => x.rel.id === 'mk_rook')).toMatchObject({ x: 0.32, y: 0.1 });
    expect(revealShapes(nachher).find((s) => s.for === 'pc_rook' && s.kind === 'path')).toBeTruthy();
    expect((await rufe('Gwen', 'GET', '/api/maps/map_1/context')).json().proposals).toEqual([]);
  });
});

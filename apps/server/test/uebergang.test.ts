/**
 * Übergänge als Fläche am Server (T-326): alle durchschicken, Spielende
 * nach den Regeln der Kampagne und des Übergangs, Bestätigung, ein Portal
 * auf eine andere Karte und der Übergang im Zugplan. Erfundene Artikel.
 */

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import { floorView, markersOf, type Entity } from '@nw/model';
import { buildApp } from '../src/app.js';
import { LocalChangeFeed } from '../src/live.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';
import { kartenImSpiel } from './hilfen/imspiel.js';

const PASSWORT = 'treppe-und-portal-wacht';
const NAT = { w: 1000, h: 1000 };
const ident = (name: string, id: string) => ({ Identity: { name, id, aliases: [] }, Status: { status: 'ready' } });
const im = (id: string) => ({ id: `${id}_in`, type: 'inLayer', to: 'ly_a', props: {} });
const flaeche = (x0: number, y0: number, x1: number, y1: number) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

/*
 * Ein Turm mit Gitter zu 100 auf 1000 Bildpunkten: unten eine Treppe über
 * die Felder (1,1)–(2,2), oben über (6,6)–(7,7); Rook und Mira stehen
 * darin, die Ratte daneben. Ein Portal auf die Höhle.
 */
function bestand(campaign: Record<string, unknown> = {}, treppe: Record<string, unknown> = {}, extra: Entity[] = []): Entity[] {
  return [
    { id: 'ly_a', name: 'ly_a', interfaces: ['Layer'], components: { ...ident('Ebene A', 'layer-0001'), Layer: { kind: 'campaign', order: 50 } }, relations: [] },
    { id: 'camp_a', name: 'Runde A', interfaces: ['Campaign'], components: { ...ident('Runde A', 'campaign-0001'), Campaign: campaign },
      relations: [{ id: 'camp_a_ac', type: 'activates', to: 'ly_a', props: {} }] },
    { id: 'pc_rook', name: 'Rook', interfaces: ['PlayerCharacter'], components: ident('Rook', 'playercharacter-0001'), relations: [im('pc_rook')] },
    { id: 'pc_mira', name: 'Mira', interfaces: ['PlayerCharacter'], components: ident('Mira', 'playercharacter-0002'), relations: [im('pc_mira')] },
    { id: 'cr_rat', name: 'Rat', interfaces: ['Creature'], components: ident('Rat', 'creature-0001'), relations: [im('cr_rat')] },
    { id: 'sb_rook', name: 'Rook stats', interfaces: ['Statblock'],
      components: { ...ident('Rook stats', 'statblock-0001'), Statblock: { ac: 14, hp: 20, speed: '30 ft.', prof: 2 }, Abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } },
      relations: [im('sb_rook'), { id: 'sb_rook_b', type: 'belongsTo', to: 'pc_rook', props: {} }] },
    { id: 'map_1', name: 'Turm', interfaces: ['Map'],
      components: {
        ...ident('Turm', 'map-0001'),
        Map: { gridShape: 'square', gridSize: 100, floors: [{ id: 'ground', name: 'Hall' }, { id: 'up', name: 'Upper', gridShape: 'square', gridSize: 100 }] },
        Image: { image: 'https://example.org/turm.png' },
      },
      relations: [im('map_1'),
        { id: 'mk_rook', type: 'marker', to: 'pc_rook', props: { x: 0.15, y: 0.15, kind: 'play' } },
        { id: 'mk_mira', type: 'marker', to: 'pc_mira', props: { x: 0.25, y: 0.25, kind: 'play' } },
        { id: 'mk_rat', type: 'marker', to: 'cr_rat', props: { x: 0.45, y: 0.45, kind: 'play' } },
        { id: 'p_treppe', type: 'marker', to: 'map_1',
          props: { kind: 'passage', passage: 'stairs', x: 0.2, y: 0.2, toFloor: 'up', toX: 0.7, toY: 0.7, area: flaeche(0.1, 0.1, 0.3, 0.3), toArea: flaeche(0.6, 0.6, 0.8, 0.8), ...treppe } },
        { id: 'p_portal', type: 'marker', to: 'map_2',
          props: { kind: 'passage', passage: 'portal', x: 0.45, y: 0.45, toX: 0.5, toY: 0.5, oneWay: true } }] },
    { id: 'map_2', name: 'Höhle', interfaces: ['Map'],
      components: { ...ident('Höhle', 'map-0002'), Map: { gridShape: 'square', gridSize: 100 }, Image: { image: 'https://example.org/hoehle.png' } },
      relations: [im('map_2')] },
    ...extra,
  ];
}

async function aufbau(...args: Parameters<typeof bestand>) {
  const registry = { ...seedRegistry, settings: { ...(seedRegistry.settings ?? {}), campaign: 'camp_a' } };
  const repo = new InMemoryRepository(registry, kartenImSpiel(bestand(...args)));
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
  const karte = async (id = 'map_1') => (await app.inject({ method: 'GET', url: `/api/entities/${id}`, headers: { cookie: await cookie('Gwen') } })).json() as Entity;
  return { rufe, karte };
}

const stelle = (k: Entity, floor: string) => markersOf(floorView(k, floor)).filter((m) => m.kind === 'play').map((m) => [m.to, m.x, m.y]);

describe('Übergänge als Fläche am Server (T-326)', () => {
  it('die Leitung schickt alle in der Fläche hinauf, auf freie Felder der Zielfläche — die Ratte daneben bleibt', async () => {
    const { rufe, karte } = await aufbau();
    const r = await rufe('Gwen', '/api/maps/map_1/passage', { via: 'p_treppe', floor: 'ground', nat: NAT });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ map: 'map_1', floor: 'up' });
    const k = await karte();
    const oben = stelle(k, 'up');
    expect(oben.map((x) => x[0]).sort()).toEqual(['pc_mira', 'pc_rook']);
    for (const [, x, y] of oben) {
      expect(x).toBeGreaterThan(0.6);
      expect(y).toBeGreaterThan(0.6);
    }
    expect(`${oben[0]![1]},${oben[0]![2]}`).not.toBe(`${oben[1]![1]},${oben[1]![2]}`);
    expect(stelle(k, 'ground')).toEqual([['cr_rat', 0.45, 0.45]]);
    /* Spielende schicken nicht alle. */
    expect((await rufe('Sela', '/api/maps/map_1/passage', { via: 'p_treppe', floor: 'up', nat: NAT })).statusCode).toBe(403);
  });

  it('eine Spielerin geht aus jeder Stelle der Fläche durch — irgendwo daneben nicht', async () => {
    const { rufe, karte } = await aufbau();
    const r = await rufe('Sela', '/api/maps/map_1/move', { rel: 'mk_rook', via: 'p_treppe', nat: NAT });
    expect(r.statusCode).toBe(200);
    expect(stelle(await karte(), 'up').map((x) => x[0])).toEqual(['pc_rook']);
  });

  it('„nur die Leitung“ an der Kampagne hält Spielende auf; der Übergang darf es anders sagen', async () => {
    const zu = await aufbau({ passageTrigger: 'gm' });
    expect((await zu.rufe('Sela', '/api/maps/map_1/move', { rel: 'mk_rook', via: 'p_treppe', nat: NAT })).statusCode).toBe(403);
    const auf = await aufbau({ passageTrigger: 'gm' }, { rules: { trigger: 'players' } });
    expect((await auf.rufe('Sela', '/api/maps/map_1/move', { rel: 'mk_rook', via: 'p_treppe', nat: NAT })).statusCode).toBe(200);
    /* … und dann schickt die Leitung niemanden. */
    expect((await auf.rufe('Gwen', '/api/maps/map_1/passage', { via: 'p_treppe', floor: 'ground', nat: NAT })).statusCode).toBe(403);
  });

  it('mit Bestätigung wird es ein Vorschlag, und die Leitung lässt ihn gelten', async () => {
    const { rufe, karte } = await aufbau({ passageConfirm: 'always' });
    const r = await rufe('Sela', '/api/maps/map_1/move', { rel: 'mk_rook', via: 'p_treppe', nat: NAT });
    expect(r.statusCode).toBe(202);
    const plan = r.json().proposal as { plan: string; text: string };
    expect(plan.text).toBe('Through stairs');
    expect(stelle(await karte(), 'up')).toEqual([]);
    const d = await rufe('Gwen', `/api/maps/map_1/turn-plan/${plan.plan}/decide`, { decision: 'confirm' });
    expect(d.statusCode).toBe(200);
    expect(stelle(await karte(), 'up').map((x) => x[0])).toEqual(['pc_rook']);
  });

  it('ein Portal auf eine andere Karte: die Tokens stehen danach dort', async () => {
    const { rufe, karte } = await aufbau();
    const r = await rufe('Gwen', '/api/maps/map_1/passage', { via: 'p_portal', floor: 'ground', nat: NAT });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ map: 'map_2', floor: 'ground' });
    expect(stelle(await karte('map_2'), 'ground')).toEqual([['cr_rat', 0.5, 0.5]]);
    expect(stelle(await karte(), 'ground').map((x) => x[0])).not.toContain('cr_rat');
  });

  it('im Kampf: nicht frei, sondern im Zugplan — nur im eigenen Zug, und es kostet, was der Übergang sagt', async () => {
    const kampf = (turn: number): Entity => ({
      id: 'enc_1', name: 'Ambush', interfaces: ['Encounter'],
      components: { ...ident('Ambush', 'encounter-0001'), Encounter: { round: 1, turn } },
      relations: [im('enc_1'), { id: 'enc_1_map', type: 'onMap', to: 'map_1', props: {} },
        { id: 'enc_1_p1', type: 'participates', to: 'pc_rook', props: { init: 15 } },
        { id: 'enc_1_p2', type: 'participates', to: 'cr_rat', props: { init: 10 } }],
    });
    const regeln = { passageWhen: 'turn', passageMove: 'half', passageAction: 'bonus' };
    const fremd = await aufbau(regeln, {}, [kampf(1)]);
    expect((await fremd.rufe('Sela', '/api/maps/map_1/move', { rel: 'mk_rook', via: 'p_treppe', nat: NAT })).statusCode).toBe(403);
    const schritt = { id: 's1', kind: 'passage', via: 'p_treppe' };
    const nicht = await fremd.rufe('Sela', '/api/maps/map_1/turn-plan', { actor: 'pc_rook', steps: [schritt], nat: NAT });
    expect(nicht.statusCode).toBe(422);
    expect(nicht.json().error).toMatch(/own turn/);

    const eigen = await aufbau(regeln, {}, [kampf(0)]);
    expect((await eigen.rufe('Sela', '/api/maps/map_1/move', { rel: 'mk_rook', via: 'p_treppe', nat: NAT })).statusCode).toBe(423);
    const r = await eigen.rufe('Sela', '/api/maps/map_1/turn-plan', { actor: 'pc_rook', steps: [schritt], nat: NAT });
    expect(r.statusCode).toBe(200);
    expect(r.json().steps[0]).toMatchObject({ kind: 'passage', feet: 15, cost: 'bonus' });
    /* Zweimal die Bonusaktion geht nicht — ein Schritt nach dem Übergang fällt ohnehin weg. */
    const d = await eigen.rufe('Gwen', `/api/maps/map_1/turn-plan/${r.json().plan}/decide`, { decision: 'confirm' });
    expect(d.statusCode).toBe(200);
    expect(stelle(await eigen.karte(), 'up').map((x) => x[0])).toEqual(['pc_rook']);
  });
});

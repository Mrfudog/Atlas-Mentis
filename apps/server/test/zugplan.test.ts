/**
 * Der Zugplan auf der Karte (T-198): Kacheln aus dem Statblock, Ziele mit
 * Trefferchance, einreichen nur für die eigene Figur, bestätigen nur durch
 * die Leitung — dann wird gewürfelt und das Token wandert. Erfundene
 * Artikel.
 */

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import { markersOf, type Entity } from '@nw/model';
import { buildApp } from '../src/app.js';
import { LocalChangeFeed } from '../src/live.js';
import { InMemoryRepository } from '../src/repo.js';
import { hashPassword } from '../src/auth.js';

const PASSWORT = 'nebel-wacht-am-tor';
const ident = (name: string, id: string) => ({ Identity: { name, id, aliases: [] }, Status: { status: 'ready' } });
const im = (id: string) => ({ id: `${id}_in`, type: 'inLayer', to: 'ly_a', props: {} });

function bestand(): Entity[] {
  return [
    { id: 'ly_a', name: 'ly_a', interfaces: ['Layer'], components: { ...ident('Ebene A', 'layer-0001'), Layer: { kind: 'campaign', order: 50 } }, relations: [] },
    { id: 'camp_a', name: 'Runde A', interfaces: ['Campaign'], components: { ...ident('Runde A', 'campaign-0001'), Campaign: {} },
      relations: [{ id: 'camp_a_ac', type: 'activates', to: 'ly_a', props: {} }] },
    { id: 'at_action', name: 'Action', interfaces: ['ActionType'], components: ident('Action', 'actiontype-0001'), relations: [im('at_action')] },
    { id: 'at_bonus', name: 'Bonus Action', interfaces: ['ActionType'], components: ident('Bonus Action', 'actiontype-0002'), relations: [im('at_bonus')] },
    { id: 'ac_axe', name: 'Handaxe', interfaces: ['Action'],
      components: { ...ident('Handaxe', 'action-0001'), Action: { actionType: 'at_action', attack: ['melee weapon'], ability: 'str', damageDice: '1d6', damageType: 'slashing', reach: 5 } },
      relations: [im('ac_axe')] },
    { id: 'ac_rage', name: 'Rage', interfaces: ['Action'], components: { ...ident('Rage', 'action-0002'), Action: { actionType: 'at_bonus' } }, relations: [im('ac_rage')] },
    { id: 'pc_rook', name: 'Rook', interfaces: ['PlayerCharacter'], components: ident('Rook', 'playercharacter-0001'), relations: [im('pc_rook')] },
    { id: 'sb_rook', name: 'Rook stats', interfaces: ['Statblock'],
      components: { ...ident('Rook stats', 'statblock-0001'), Statblock: { ac: 14, hp: 20, speed: '30 ft.', prof: 2 }, Abilities: { str: 16, dex: 12, con: 14, int: 8, wis: 10, cha: 8 } },
      relations: [im('sb_rook'), { id: 'sb_rook_b', type: 'belongsTo', to: 'pc_rook', props: {} },
        { id: 'sb_rook_c1', type: 'composedOf', to: 'ac_axe', props: {} }, { id: 'sb_rook_c2', type: 'composedOf', to: 'ac_rage', props: {} }] },
    { id: 'cr_gob', name: 'Goblin', interfaces: ['Creature'], components: ident('Goblin', 'creature-0001'), relations: [im('cr_gob')] },
    { id: 'sb_gob', name: 'Goblin stats', interfaces: ['Statblock'],
      components: { ...ident('Goblin stats', 'statblock-0002'), Statblock: { ac: 15, hp: 7, speed: '30 ft.', prof: 2 }, Abilities: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 } },
      relations: [im('sb_gob'), { id: 'sb_gob_b', type: 'belongsTo', to: 'cr_gob', props: {} }] },
    { id: 'map_1', name: 'Cave', interfaces: ['Map'],
      components: { ...ident('Cave', 'map-0001'), Map: { gridShape: 'square', gridSize: 70 }, Image: { image: 'https://example.org/cave.png' } },
      relations: [im('map_1'),
        { id: 'mk_rook', type: 'marker', to: 'pc_rook', props: { x: 0.1, y: 0.1, kind: 'play' } },
        { id: 'mk_gob', type: 'marker', to: 'cr_gob', props: { x: 0.3, y: 0.1, kind: 'play' } }] },
  ];
}

async function aufbau() {
  const registry = { ...seedRegistry, settings: { ...(seedRegistry.settings ?? {}), campaign: 'camp_a' } };
  const repo = new InMemoryRepository(registry, bestand());
  const live = new LocalChangeFeed({ flushMs: 1 });
  const app = buildApp({ repo, live });
  const konto = async (name: string, roles: Record<string, 'gm' | 'player'>, actorIds: string[] = []) =>
    repo.putUser({ id: randomUUID(), name, passwordHash: await hashPassword(PASSWORT), isAdmin: false, actorIds, roles });
  await konto('Gwen', { camp_a: 'gm' });
  await konto('Sela', { camp_a: 'player' }, ['pc_rook']);
  await konto('Tam', { camp_a: 'player' });
  const cookies = new Map<string, string>();
  const cookie = async (name: string) => {
    if (!cookies.has(name)) {
      const login = await app.inject({ method: 'POST', url: '/api/login', payload: { name, password: PASSWORT } });
      cookies.set(name, `nw_session=${login.cookies.find((x) => x.name === 'nw_session')?.value ?? ''}`);
    }
    return cookies.get(name)!;
  };
  const rufe = async (name: string, method: 'GET' | 'POST', url: string, payload?: object) =>
    app.inject({ method, url, ...(payload ? { payload } : {}), headers: { cookie: await cookie(name) } });
  return { repo, live, rufe };
}

const ZUG = [
  { id: 'a', kind: 'move', path: [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }], feet: 10, to: { x: 0.25, y: 0.1 } },
  { id: 'b', kind: 'act', tile: 'ac_axe', name: 'Handaxe', cost: 'action', target: 'cr_gob', targetName: 'Goblin' },
  { id: 'c', kind: 'act', tile: 'ac_rage', name: 'Rage', cost: 'bonus' },
];

describe('Zugplan (T-198)', () => {
  it('gibt der Spielerin die Kacheln ihrer Figur und die Trefferchance, aber nicht die RK', async () => {
    const { rufe } = await aufbau();
    const r = await rufe('Sela', 'GET', '/api/maps/map_1/turn-plan');
    expect(r.statusCode).toBe(200);
    const d = r.json();
    expect(d.leitet).toBe(false);
    expect(d.actor).toMatchObject({ id: 'pc_rook', speed: 30, rel: 'mk_rook' });
    const axt = d.tiles.find((t: { id: string }) => t.id === 'ac_axe');
    expect(axt).toMatchObject({ toHit: 5, damage: '1d6 + 3', cost: 'action', targeted: true, range: 5 });
    expect(d.tiles.find((t: { id: string }) => t.id === 'ac_rage')).toMatchObject({ cost: 'bonus' });
    const gob = d.targets.find((t: { id: string }) => t.id === 'cr_gob');
    expect(gob.chances.ac_axe).toBe(55);
    expect(gob.ac).toBeUndefined();
  });

  it('lässt nur für die eigene Figur einreichen und prüft die Ressourcen', async () => {
    const { rufe } = await aufbau();
    expect((await rufe('Tam', 'POST', '/api/maps/map_1/turn-plan', { actor: 'pc_rook', steps: ZUG })).statusCode).toBe(403);
    const zuviel = await rufe('Sela', 'POST', '/api/maps/map_1/turn-plan', { actor: 'pc_rook', steps: [...ZUG, { ...ZUG[1], id: 'd' }] });
    expect(zuviel.statusCode).toBe(422);
    const ok = await rufe('Sela', 'POST', '/api/maps/map_1/turn-plan', { actor: 'pc_rook', steps: ZUG });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().text).toBe('Move 10 ft → Handaxe → Goblin → Bonus: Rage');
    /* Tam sieht Selas Plan nicht, die Leitung schon — mit RK. */
    expect((await rufe('Tam', 'GET', '/api/maps/map_1/turn-plan')).json().plans).toEqual([]);
    const gm = (await rufe('Gwen', 'GET', '/api/maps/map_1/turn-plan')).json();
    expect(gm.plans).toHaveLength(1);
    expect(gm.targets.find((t: { id: string }) => t.id === 'cr_gob').ac).toBe(15);
  });

  it('bestätigt nur die Leitung — dann wird gewürfelt und das Token wandert', async () => {
    const { rufe, repo } = await aufbau();
    const plan = (await rufe('Sela', 'POST', '/api/maps/map_1/turn-plan', { actor: 'pc_rook', steps: ZUG })).json().plan;
    expect((await rufe('Sela', 'POST', `/api/maps/map_1/turn-plan/${plan}/decide`, { decision: 'confirm' })).statusCode).toBe(403);
    const r = await rufe('Gwen', 'POST', `/api/maps/map_1/turn-plan/${plan}/decide`, { decision: 'confirm' });
    expect(r.statusCode).toBe(200);
    const d = r.json();
    expect(d.state).toBe('confirmed');
    expect(d.results).toHaveLength(3);
    expect(d.results[1].text).toMatch(/^Handaxe → Goblin: (hit|miss)/);
    const karte = (await repo.getEntity('map_1'))!;
    expect(markersOf(karte).find((m) => m.rel.id === 'mk_rook')).toMatchObject({ x: 0.25, y: 0.1 });
    const wuerfe = await repo.listEvents({ name: 'roll' });
    expect(wuerfe.length).toBeGreaterThanOrEqual(1);
    expect((wuerfe.at(-1)!.payload as { label: string }).label).toBe('Handaxe → Goblin: attack');
    /* Zweimal entscheiden geht nicht. */
    expect((await rufe('Gwen', 'POST', `/api/maps/map_1/turn-plan/${plan}/decide`, { decision: 'reject' })).statusCode).toBe(409);
  });

  it('lehnt ab, ohne zu würfeln', async () => {
    const { rufe, repo } = await aufbau();
    const plan = (await rufe('Sela', 'POST', '/api/maps/map_1/turn-plan', { actor: 'pc_rook', steps: ZUG })).json().plan;
    const r = await rufe('Gwen', 'POST', `/api/maps/map_1/turn-plan/${plan}/decide`, { decision: 'reject', note: 'Too far' });
    expect(r.json()).toMatchObject({ state: 'rejected', note: 'Too far' });
    expect(await repo.listEvents({ name: 'roll' })).toHaveLength(0);
  });

  it('lässt die Leitung auch für einen Gegner planen', async () => {
    const { rufe } = await aufbau();
    const d = (await rufe('Gwen', 'GET', '/api/maps/map_1/turn-plan?actor=cr_gob')).json();
    expect(d.actors.map((a: { id: string }) => a.id).sort()).toEqual(['cr_gob', 'pc_rook']);
    expect(d.actor.id).toBe('cr_gob');
    expect(d.targets.map((t: { id: string }) => t.id)).toEqual(['pc_rook']);
  });
});

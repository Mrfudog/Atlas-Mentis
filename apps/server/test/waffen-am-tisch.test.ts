/**
 * **Waffen in der Hand sind Angriffe, am Tisch** (T-354): Mira hält ein
 * Langschwert im Inventar und hat am Statblock keine Aktion dafür — im
 * Zugplan steht es trotzdem als Angriff, mit STR + Übung, und ein
 * bestätigter Zug würfelt und zieht ab wie jeder Angriff. Der W20 steht
 * fest auf 11. Erfundene Artikel.
 */

import { randomUUID } from 'node:crypto';
import type * as Krypto from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

vi.mock('node:crypto', async (orig) => {
  const echt = await orig<typeof Krypto>();
  return { ...echt, getRandomValues: <T extends ArrayBufferView>(a: T): T => ((a as unknown as Uint32Array)[0] = 2 ** 31, a) };
});

import { seedRegistry } from '@nw/registry';
import type { Entity } from '@nw/model';
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
    /* Fester Schaden: „20" plus STR +3 = 23. */
    { id: 'ac_axe', name: 'Greataxe', interfaces: ['Action'],
      components: { ...ident('Greataxe', 'action-0001'), Action: { actionType: 'at_action', attack: ['melee weapon'], ability: 'str', damageDice: '20', damageType: 'slashing', reach: 5 } },
      relations: [im('ac_axe')] },
    { id: 'sp_bless', name: 'Bless', interfaces: ['Spell'], components: ident('Bless', 'spell-0001'), relations: [im('sp_bless')] },
    { id: 'pc_rook', name: 'Rook', interfaces: ['PlayerCharacter'], components: ident('Rook', 'playercharacter-0001'), relations: [im('pc_rook')] },
    { id: 'sb_rook', name: 'Rook stats', interfaces: ['Statblock'],
      components: { ...ident('Rook stats', 'statblock-0001'), Statblock: { ac: 14, hp: 20, speed: '30 ft.', prof: 2 }, Abilities: { str: 16, dex: 12, con: 14, int: 8, wis: 10, cha: 8 } },
      relations: [im('sb_rook'), { id: 'sb_rook_b', type: 'belongsTo', to: 'pc_rook', props: {} }, { id: 'sb_rook_c1', type: 'composedOf', to: 'ac_axe', props: {} }] },
    /* Die Klerikerin: konzentriert sich, KON 8. */
    { id: 'pc_mira', name: 'Mira', interfaces: ['PlayerCharacter'], components: { ...ident('Mira', 'playercharacter-0002'), Vitals: { hp: 30 } }, relations: [im('pc_mira'), { id: 'pc_mira_c', type: 'carries', to: 'inv_mira', props: {} }] },
    { id: 'sb_mira', name: 'Mira stats', interfaces: ['Statblock'],
      components: { ...ident('Mira stats', 'statblock-0003'), Statblock: { ac: 12, hp: 30, speed: '30 ft.', prof: 2 }, Abilities: { str: 16, dex: 10, con: 8, int: 10, wis: 16, cha: 10 }, Proficiencies: { proficient: ['martial'] } },
      relations: [im('sb_mira'), { id: 'sb_mira_b', type: 'belongsTo', to: 'pc_mira', props: {} }] },
    /* Fester Schaden „10": plus STR +3 = 13. */
    { id: 'it_sword', name: 'Longsword', interfaces: ['Weapon'],
      components: { ...ident('Longsword', 'weapon-0001'), Item: { itemType: 'melee weapon' }, Weapon: { category: 'martial', damage: '10', damageType: 'slashing' } }, relations: [im('it_sword')] },
    { id: 'inv_mira', name: 'Mira pack', interfaces: ['Inventory'], components: ident('Mira pack', 'inventory-0001'),
      relations: [im('inv_mira'), { id: 'h_sword', type: 'holds', to: 'it_sword', props: { slot: 'mainHand' } }] },
    { id: 'cr_gob', name: 'Goblin', interfaces: ['Creature'], components: ident('Goblin', 'creature-0001'), relations: [im('cr_gob')] },
    { id: 'sb_gob', name: 'Goblin stats', interfaces: ['Statblock'],
      components: { ...ident('Goblin stats', 'statblock-0002'), Statblock: { ac: 15, hp: 30, speed: '30 ft.', prof: 2, resistances: 'slashing' }, Abilities: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 }, Proficiencies: { proficient: ['Stealth'] } },
      relations: [im('sb_gob'), { id: 'sb_gob_b', type: 'belongsTo', to: 'cr_gob', props: {} }] },
    { id: 'map_1', name: 'Cave', interfaces: ['Map'],
      components: { ...ident('Cave', 'map-0001'), Map: { gridShape: 'square', gridSize: 70 }, Image: { image: 'https://example.org/cave.png' } },
      relations: [im('map_1'),
        { id: 'mk_rook', type: 'marker', to: 'pc_rook', props: { x: 0.25, y: 0.15, kind: 'play' } },
        { id: 'mk_mira', type: 'marker', to: 'pc_mira', props: { x: 0.25, y: 0.25, kind: 'play' } },
        { id: 'mk_gob', type: 'marker', to: 'cr_gob', props: { x: 0.35, y: 0.15, kind: 'play' } }] },
    { id: 'enc_1', name: 'Ambush', interfaces: ['Encounter'],
      components: { ...ident('Ambush', 'encounter-0001'), Encounter: { round: 1, turn: 0 } },
      relations: [im('enc_1'), { id: 'enc_1_m', type: 'onMap', to: 'map_1', props: {} },
        { id: 'p_rook', type: 'participates', to: 'pc_rook', props: { init: 20 } },
        { id: 'p_gob', type: 'participates', to: 'cr_gob', props: { init: 15, hp: 30 } },
        { id: 'p_mira', type: 'participates', to: 'pc_mira', props: { init: 10 } }] },
  ];
}

async function aufbau() {
  const registry = { ...seedRegistry, settings: { ...(seedRegistry.settings ?? {}), campaign: 'camp_a' } };
  const repo = new InMemoryRepository(registry, bestand());
  const app = buildApp({ repo, live: new LocalChangeFeed({ flushMs: 1 }) });
  await repo.putUser({ id: randomUUID(), name: 'Gwen', passwordHash: await hashPassword(PASSWORT), isAdmin: false, actorIds: [], roles: { camp_a: 'gm' } });
  const login = await app.inject({ method: 'POST', url: '/api/login', payload: { name: 'Gwen', password: PASSWORT } });
  const cookie = `nw_session=${login.cookies.find((x) => x.name === 'nw_session')?.value ?? ''}`;
  const rufe = async (method: 'GET' | 'POST', url: string, payload?: object) => app.inject({ method, url, ...(payload ? { payload } : {}), headers: { cookie } });
  /** Plant und bestätigt einen Zug der Leitung; gibt die Ergebnisse. */
  const zug = async (actor: string, steps: object[]) => {
    const p = await rufe('POST', '/api/maps/map_1/turn-plan', { actor, steps, nat: { w: 700, h: 700 } });
    expect(p.statusCode, p.body).toBe(200);
    const d = await rufe('POST', `/api/maps/map_1/turn-plan/${p.json().plan}/decide`, { decision: 'confirm' });
    expect(d.statusCode, d.body).toBe(200);
    return d.json().results as { text: string }[];
  };
  const teilnehmer = async (id: string) =>
    ((await repo.getEntity('enc_1'))!.relations ?? []).find((r) => r.to === id)!.props as { hp?: number; conditions?: { action?: string; text?: string }[] };
  return { repo, zug, teilnehmer, rufe };
}

describe('T-354: das Langschwert in der Hand ist ein Angriff', () => {
  it('der Zugplan bietet es an, mit STR + Übung, vor dem waffenlosen Schlag', async () => {
    const { rufe } = await aufbau();
    const l = await rufe('GET', '/api/maps/map_1/turn-plan?actor=pc_mira&nat=700x700');
    expect(l.statusCode, l.body).toBe(200);
    const tiles = l.json().tiles as { id: string; name: string; toHit: number; damage: string }[];
    expect(tiles.find((t) => t.id === 'held:h_sword')).toMatchObject({ name: 'Longsword', toHit: 5, damage: '10 + 3' });
    expect(tiles.findIndex((t) => t.id === 'held:h_sword')).toBeLessThan(tiles.findIndex((t) => t.id === 'std:unarmed'));
  });

  it('bestätigt: Treffer 16 gegen RK 15, 13 Hieb, resistent → 6', async () => {
    const { zug, teilnehmer } = await aufbau();
    const r = await zug('pc_mira', [{ id: 'a', kind: 'act', tile: 'held:h_sword', name: 'Longsword', cost: 'action', target: 'cr_gob', targetName: 'Goblin' }]);
    expect(r[0]!.text).toMatch(/Longsword → Goblin: hit, 13 slashing damage \(resistant \(slashing\) → 6; Goblin at 24\/30 HP\)/);
    expect((await teilnehmer('cr_gob')).hp).toBe(24);
  });
});

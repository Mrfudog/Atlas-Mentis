/**
 * **Regeln wirken am Tisch** (T-275, Punkte 2 und 3): ein bestätigter Zug
 * zieht Schaden nach der Abwehr ab, würfelt die Konzentrationsprobe, und
 * Dodge und Hide ändern Vorteil und Nachteil. Der W20 steht fest auf 11
 * (der Zufall liefert 0,5), damit jede Zahl vorhersagbar ist. Erfundene
 * Artikel.
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
    { id: 'pc_mira', name: 'Mira', interfaces: ['PlayerCharacter'], components: { ...ident('Mira', 'playercharacter-0002'), Vitals: { hp: 30, concentration: 'sp_bless' } }, relations: [im('pc_mira')] },
    { id: 'sb_mira', name: 'Mira stats', interfaces: ['Statblock'],
      components: { ...ident('Mira stats', 'statblock-0003'), Statblock: { ac: 12, hp: 30, speed: '30 ft.', prof: 2 }, Abilities: { str: 10, dex: 10, con: 8, int: 10, wis: 16, cha: 10 } },
      relations: [im('sb_mira'), { id: 'sb_mira_b', type: 'belongsTo', to: 'pc_mira', props: {} }] },
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
  return { repo, zug, teilnehmer };
}

const axt = (target: string, targetName: string) => ({ id: 'b', kind: 'act', tile: 'ac_axe', name: 'Greataxe', cost: 'action', target, targetName });

describe('Punkt 2: Schaden wird abgezogen', () => {
  it('nach der Resistenz des Ziels, an seiner Kante in der Begegnung', async () => {
    const { zug, teilnehmer } = await aufbau();
    const r = await zug('pc_rook', [axt('cr_gob', 'Goblin')]);
    /* 11 + 5 = 16 gegen RK 15: Treffer; 23 hieb, resistent → 11. */
    expect(r[0]!.text).toMatch(/Greataxe → Goblin: hit, 23 slashing damage \(resistant \(slashing\) → 11; Goblin at 19\/30 HP\)/);
    expect((await teilnehmer('cr_gob')).hp).toBe(19);
  });

  it('an einer Spielerfigur auch an Vitals, und die Konzentrationsprobe fällt', async () => {
    const { zug, teilnehmer, repo } = await aufbau();
    const r = await zug('pc_rook', [axt('pc_mira', 'Mira')]);
    /* 23 von 30 → 7; SG 11, gewürfelt 11 − 1 = 10: verloren. */
    expect(r[0]!.text).toMatch(/Mira at 7\/30 HP; concentration save 10 vs DC 11 — lost \(Bless\)/);
    const mira = (await repo.getEntity('pc_mira'))!;
    expect(mira.components?.['Vitals']).toMatchObject({ hp: 7 });
    expect(mira.components?.['Vitals']?.['concentration']).toBeUndefined();
    expect((await teilnehmer('pc_mira')).hp).toBe(7);
    const wuerfe = (await repo.listEvents({ name: 'roll' })).map((e) => (e.payload as { label: string }).label);
    expect(wuerfe).toContain('Mira: concentration save, DC 11');
  });
});

describe('Punkt 3: allgemeine Aktionen wirken', () => {
  it('Dodge: der Eintrag steht in der Initiative, und der Angriff hat Nachteil', async () => {
    const { zug, teilnehmer, repo } = await aufbau();
    const d = await zug('cr_gob', [{ id: 'd', kind: 'act', tile: 'std:dodge', name: 'Dodge', cost: 'action' }]);
    expect(d[0]!.text).toBe('Dodge: Goblin: Dodging');
    expect((await teilnehmer('cr_gob')).conditions).toEqual([expect.objectContaining({ action: 'dodge', text: 'Dodging', rounds: 1, at: 'start' })]);
    const r = await zug('pc_rook', [axt('cr_gob', 'Goblin')]);
    expect(r[0]!.text).toMatch(/with disadvantage/);
    const w = (await repo.listEvents({ name: 'roll' })).map((e) => e.payload as { label: string; expr: string });
    expect(w.find((x) => x.label === 'Greataxe → Goblin: attack (disadvantage)')?.expr).toMatch(/^2d20kl1/);
  });

  it('Hide: Probe am Server, der nächste Angriff mit Vorteil, danach ist der Eintrag weg', async () => {
    const { zug, teilnehmer } = await aufbau();
    const h = await zug('pc_rook', [{ id: 'h', kind: 'act', tile: 'std:hide', name: 'Hide', cost: 'action' }]);
    expect(h[0]!.text).toBe('Hide: Stealth 12; Rook: Hidden');
    const r = await zug('pc_rook', [axt('cr_gob', 'Goblin')]);
    expect(r[0]!.text).toMatch(/with advantage/);
    expect((await teilnehmer('pc_rook')).conditions ?? []).toEqual([]);
  });
});

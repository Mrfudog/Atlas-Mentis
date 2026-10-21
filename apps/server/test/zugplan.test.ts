/**
 * Der Zugplan auf der Karte (T-198): Kacheln aus dem Statblock, Ziele mit
 * Trefferchance, einreichen nur für die eigene Figur, bestätigen nur durch
 * die Leitung — dann wird gewürfelt und das Token wandert. Erfundene
 * Artikel.
 */

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import { exampleRuleGraphs, markersOf, type Entity, type RuleGraph } from '@nw/model';
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
  const ids: Record<string, string> = {};
  const konto = async (name: string, roles: Record<string, 'gm' | 'player'>, actorIds: string[] = []) => {
    ids[name] = randomUUID();
    await repo.putUser({ id: ids[name]!, name, passwordHash: await hashPassword(PASSWORT), isAdmin: false, actorIds, roles });
  };
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
  const rufe = async (name: string, method: 'GET' | 'POST' | 'PUT', url: string, payload?: object) =>
    app.inject({ method, url, ...(payload ? { payload } : {}), headers: { cookie: await cookie(name) } });
  return { repo, live, rufe, ids };
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

describe('Zugplaner nur für Besitzende, je Stufe der Kampagne (T-325)', () => {
  const stufe = async (repo: InMemoryRepository, turnPlanner: string) => {
    const k = (await repo.getEntity('camp_a'))!;
    await repo.putEntity({ ...k, components: { ...k.components, Campaign: { ...k.components?.['Campaign'], turnPlanner } } });
  };

  it('zeigt einer Spielerin ohne eigene Figur nichts, der Leitung jede Kreatur', async () => {
    const { rufe } = await aufbau();
    const tam = (await rufe('Tam', 'GET', '/api/maps/map_1/turn-plan')).json();
    expect(tam.actors).toEqual([]);
    expect(tam.actor).toBeNull();
    expect(tam.planner).toBe('full');
    expect((await rufe('Sela', 'GET', '/api/maps/map_1/turn-plan')).json().actors.map((a: { id: string }) => a.id)).toEqual(['pc_rook']);
  });

  it('`off`: niemand plant, auch die Leitung nicht', async () => {
    const { rufe, repo } = await aufbau();
    await stufe(repo, 'off');
    expect((await rufe('Sela', 'GET', '/api/maps/map_1/turn-plan')).json().actors).toEqual([]);
    expect((await rufe('Gwen', 'GET', '/api/maps/map_1/turn-plan')).json().actors).toEqual([]);
    expect((await rufe('Sela', 'POST', '/api/maps/map_1/turn-plan', { actor: 'pc_rook', steps: ZUG })).statusCode).toBe(403);
  });

  it('`move`: keine Kacheln, und ein Plan mit Aktion wird abgelehnt', async () => {
    const { rufe, repo } = await aufbau();
    await stufe(repo, 'move');
    const d = (await rufe('Sela', 'GET', '/api/maps/map_1/turn-plan')).json();
    expect(d.planner).toBe('move');
    expect(d.tiles).toEqual([]);
    expect((await rufe('Sela', 'POST', '/api/maps/map_1/turn-plan', { actor: 'pc_rook', steps: ZUG })).statusCode).toBe(422);
    expect((await rufe('Sela', 'POST', '/api/maps/map_1/turn-plan', { actor: 'pc_rook', steps: [ZUG[0]] })).statusCode).toBe(200);
  });

  it('`actions`: Aktionen ja, Reaktionen nein', async () => {
    const { rufe, repo } = await aufbau();
    await stufe(repo, 'actions');
    const d = (await rufe('Sela', 'GET', '/api/maps/map_1/turn-plan')).json();
    expect(d.tiles.some((t: { cost: string }) => t.cost === 'reaction')).toBe(false);
    expect(d.tiles.find((t: { id: string }) => t.id === 'ac_axe')).toBeDefined();
    expect((await rufe('Sela', 'POST', '/api/maps/map_1/turn-plan', { actor: 'pc_rook', steps: ZUG })).statusCode).toBe(200);
    const reaktion = [{ id: 'r', kind: 'act', tile: 'ac_axe', name: 'Handaxe', cost: 'reaction', target: 'cr_gob', targetName: 'Goblin' }];
    expect((await rufe('Sela', 'POST', '/api/maps/map_1/turn-plan', { actor: 'pc_rook', steps: reaktion })).statusCode).toBe(422);
  });
});

/* Runde 2: das Bild ist 700 × 700, ein Feld 70 — Feld (x, y) hat die Mitte
   bei ((x + 0.5) / 10, (y + 0.5) / 10). */
const NAT = { w: 700, h: 700 };
const mitte = (x: number, y: number) => ({ x: (x + 0.5) / 10, y: (y + 0.5) / 10 });

/** Rook neben den Goblin: Rook auf Feld (2, 1), Goblin auf (3, 1). */
async function nebeneinander(repo: InMemoryRepository) {
  const karte = (await repo.getEntity('map_1'))!;
  await repo.putEntity({
    ...karte,
    relations: (karte.relations ?? []).map((r) => (r.id === 'mk_rook' ? { ...r, props: { ...r.props, ...mitte(2, 1) } } : r.id === 'mk_gob' ? { ...r, props: { ...r.props, ...mitte(3, 1) } } : r)),
  });
}

const WEG = { id: 'w', kind: 'move', path: [{ x: 2, y: 1 }, { x: 1, y: 1 }, { x: 0, y: 1 }], feet: 10, to: mitte(0, 1) };

describe('Zugplan, Runde 2: Gelegenheitsangriff (T-198)', () => {
  it('zeigt der Spielerin, wer sie bedroht, und hält beim Ausführen für die Antwort an', async () => {
    const { rufe, repo } = await aufbau();
    await nebeneinander(repo);
    const lage = (await rufe('Sela', 'GET', '/api/maps/map_1/turn-plan')).json();
    expect(lage.threats).toEqual([{ id: 'cr_gob', name: 'Goblin', rel: 'mk_gob', reach: 5 }]);
    expect(lage.actor.reaction).toBe(true);

    const plan = (await rufe('Sela', 'POST', '/api/maps/map_1/turn-plan', { actor: 'pc_rook', steps: [WEG], nat: NAT })).json().plan;
    const r = await rufe('Gwen', 'POST', `/api/maps/map_1/turn-plan/${plan}/decide`, { decision: 'confirm' });
    expect(r.json()).toMatchObject({ state: 'reacting', pending: { reactor: 'cr_gob', index: 0, step: 'w' } });
    /* Das Token steht noch, wo es die Reichweite verlassen will. */
    expect(markersOf((await repo.getEntity('map_1'))!).find((m) => m.rel.id === 'mk_rook')).toMatchObject(mitte(2, 1));

    /* Den Goblin führt die Leitung — Sela darf nicht für ihn antworten. */
    expect((await rufe('Sela', 'POST', `/api/maps/map_1/turn-plan/${plan}/react`, { attack: true })).statusCode).toBe(403);
    const gm = (await rufe('Gwen', 'GET', '/api/maps/map_1/turn-plan')).json();
    expect(gm.plans[0]).toMatchObject({ state: 'reacting', canAnswer: true });

    const a = await rufe('Gwen', 'POST', `/api/maps/map_1/turn-plan/${plan}/react`, { attack: true });
    expect(a.statusCode).toBe(200);
    expect(a.json().state).toBe('confirmed');
    expect(a.json().results.map((x: { text: string }) => x.text)).toEqual([
      expect.stringMatching(/^Opportunity attack: Unarmed Strike → Rook: (hit|miss)/),
      'Moved 10 ft.',
    ]);
    expect(markersOf((await repo.getEntity('map_1'))!).find((m) => m.rel.id === 'mk_rook')).toMatchObject(mitte(0, 1));
    expect(await repo.listEvents({ name: 'reaction' })).toHaveLength(1);
    expect((await repo.listEvents({ name: 'roll' })).some((e) => (e.payload as { actor: { id: string } }).actor.id === 'cr_gob')).toBe(true);

    /* Die Reaktion ist verbraucht: der nächste Zug weg vom Goblin läuft durch. */
    await nebeneinander(repo);
    const zwei = (await rufe('Sela', 'POST', '/api/maps/map_1/turn-plan', { actor: 'pc_rook', steps: [WEG], nat: NAT })).json().plan;
    expect((await rufe('Gwen', 'POST', `/api/maps/map_1/turn-plan/${zwei}/decide`, { decision: 'confirm' })).json().state).toBe('confirmed');
  });

  it('ohne die volle Stufe (T-325) fragt niemand um eine Reaktion', async () => {
    const { rufe, repo } = await aufbau();
    await nebeneinander(repo);
    const k = (await repo.getEntity('camp_a'))!;
    await repo.putEntity({ ...k, components: { ...k.components, Campaign: { turnPlanner: 'actions' } } });
    const plan = (await rufe('Sela', 'POST', '/api/maps/map_1/turn-plan', { actor: 'pc_rook', steps: [WEG], nat: NAT })).json().plan;
    const r = (await rufe('Gwen', 'POST', `/api/maps/map_1/turn-plan/${plan}/decide`, { decision: 'confirm' })).json();
    expect(r.state).toBe('confirmed');
    expect(r.results.map((x: { text: string }) => x.text)).toEqual(['Moved 10 ft.']);
  });

  it('Nein lässt ziehen, ohne zu würfeln; Disengage fragt gar nicht', async () => {
    const { rufe, repo } = await aufbau();
    await nebeneinander(repo);
    const plan = (await rufe('Sela', 'POST', '/api/maps/map_1/turn-plan', { actor: 'pc_rook', steps: [WEG], nat: NAT })).json().plan;
    await rufe('Gwen', 'POST', `/api/maps/map_1/turn-plan/${plan}/decide`, { decision: 'confirm' });
    const nein = (await rufe('Gwen', 'POST', `/api/maps/map_1/turn-plan/${plan}/react`, { attack: false })).json()
    expect(nein.state).toBe('confirmed');
    expect(nein.results[0].text).toBe('Goblin lets Rook go.');
    expect(await repo.listEvents({ name: 'roll' })).toHaveLength(0);
    expect(await repo.listEvents({ name: 'reaction' })).toHaveLength(0);

    await nebeneinander(repo);
    const los = { id: 'd', kind: 'act', tile: 'std:disengage', name: 'Disengage', cost: 'action' };
    const zwei = (await rufe('Sela', 'POST', '/api/maps/map_1/turn-plan', { actor: 'pc_rook', steps: [los, WEG], nat: NAT })).json().plan;
    expect((await rufe('Gwen', 'POST', `/api/maps/map_1/turn-plan/${zwei}/decide`, { decision: 'confirm' })).json().state).toBe('confirmed');
  });

  it('fragt die Spielerin, wenn ihre Figur reagieren darf', async () => {
    const { rufe, repo } = await aufbau();
    await nebeneinander(repo);
    /* Die Leitung plant für den Goblin, weg von Rook. */
    const weg = { id: 'g', kind: 'move', path: [{ x: 3, y: 1 }, { x: 4, y: 1 }, { x: 5, y: 1 }], feet: 10, to: mitte(5, 1) };
    const plan = (await rufe('Gwen', 'POST', '/api/maps/map_1/turn-plan', { actor: 'cr_gob', steps: [weg], nat: NAT })).json().plan;
    const r = (await rufe('Gwen', 'POST', `/api/maps/map_1/turn-plan/${plan}/decide`, { decision: 'confirm' })).json();
    expect(r.pending).toMatchObject({ reactor: 'pc_rook', reactorName: 'Rook' });
    const sela = (await rufe('Sela', 'GET', '/api/maps/map_1/turn-plan')).json();
    expect(sela.plans.find((p: { plan: string }) => p.plan === plan)).toMatchObject({ state: 'reacting', canAnswer: true });
    const a = (await rufe('Sela', 'POST', `/api/maps/map_1/turn-plan/${plan}/react`, { attack: true })).json();
    expect(a.results[0].text).toMatch(/^Opportunity attack: Handaxe → Goblin/);
    /* Rooks Reaktion ist weg — die Leiste zeigt es, ein Plan mit Reaktion geht nicht. */
    expect((await rufe('Sela', 'GET', '/api/maps/map_1/turn-plan')).json().actor.reaction).toBe(false);
  });
});

describe('Zugplan, Runde 2: kein freies Ziehen im Kampf (T-198)', () => {
  async function mitKampf(repo: InMemoryRepository, runde: number) {
    await repo.putEntity({
      id: 'enc_1', name: 'Ambush', interfaces: ['Encounter'],
      components: { ...ident('Ambush', 'encounter-0001'), Encounter: { round: runde, turn: 0 } },
      relations: [im('enc_1'), { id: 'enc_1_m', type: 'onMap', to: 'map_1', props: {} },
        { id: 'enc_1_p1', type: 'participates', to: 'pc_rook', props: { init: 15 } },
        { id: 'enc_1_p2', type: 'participates', to: 'cr_gob', props: { init: 10 } }],
    });
  }
  const gezogen = async (repo: InMemoryRepository) => {
    const k = (await repo.getEntity('map_1'))!;
    return { ...k, relations: (k.relations ?? []).map((r) => (r.id === 'mk_rook' ? { ...r, props: { ...r.props, x: 0.55 } } : r)) };
  };

  it('sperrt das Ziehen für Spielende am Server, die Leitung zieht weiter', async () => {
    const { rufe, repo, ids } = await aufbau();
    await repo.grantLayer(ids['Sela']!, 'ly_a');
    await mitKampf(repo, 1);
    const r = await rufe('Sela', 'PUT', '/api/entities/map_1', await gezogen(repo));
    expect(r.statusCode).toBe(423);
    expect(r.json().error).toMatch(/turn plan/);
    expect((await rufe('Gwen', 'PUT', '/api/entities/map_1', await gezogen(repo))).statusCode).toBe(200);
  });

  it('lässt ziehen, solange kein Kampf läuft', async () => {
    const { rufe, repo, ids } = await aufbau();
    await repo.grantLayer(ids['Sela']!, 'ly_a');
    await mitKampf(repo, 0);
    expect((await rufe('Sela', 'PUT', '/api/entities/map_1', await gezogen(repo))).statusCode).toBe(200);
  });
});

/* ------------------------------------------------------------ Regeln am Tisch (REQ-357) */

/** Die Kampagne lässt die Graphen laufen; dazu Regelartikel mit Graph in ihrer Ebene. */
async function mitRegeln(repo: InMemoryRepository, graphen: { id: string; name: string; graph: RuleGraph }[]) {
  const camp = (await repo.getEntity('camp_a'))!;
  await repo.putEntity({ ...camp, components: { ...camp.components, Campaign: { ...camp.components['Campaign'], ruleGraphs: 'on' } } });
  for (const g of graphen) {
    await repo.putEntity({
      id: g.id,
      name: g.name,
      interfaces: ['Rule'],
      components: { ...ident(g.name, `rule-${g.id}`), Rule: { kind: 'rule', graph: { enabled: true, nodes: g.graph.nodes, wires: g.graph.wires } } },
      relations: [im(g.id)],
    });
  }
}

const beispiel = (id: string) => exampleRuleGraphs().find((g) => g.id === id)!;

/** Wer angegriffen wird, darf parieren — eine erfundene Regel ohne Schlag. */
const PARADE: RuleGraph = {
  id: 'parade',
  name: 'Parry',
  enabled: true,
  nodes: [
    { id: 't', kind: 'trigger', x: 0, y: 0, on: 'attacked' },
    { id: 'c', kind: 'condition', x: 0, y: 0, test: { kind: 'same', a: 'self', b: 'target' } },
    { id: 'o', kind: 'outcome', x: 0, y: 0, then: { kind: 'offerReaction', name: 'Parry', to: 'self', against: 'actor' } },
  ],
  wires: [{ from: 't', to: 'c' }, { from: 'c', to: 'o', port: 'yes' }],
};

describe('Zugplan: Regeln am Tisch (REQ-357)', () => {
  it('der Graph führt: die Gelegenheitsattacke kommt aus ihrer Regel', async () => {
    const { rufe, repo } = await aufbau();
    await mitRegeln(repo, [{ id: 'r_oa', name: 'Opportunity attack', graph: beispiel('opportunity-attack') }]);
    await nebeneinander(repo);
    const plan = (await rufe('Sela', 'POST', '/api/maps/map_1/turn-plan', { actor: 'pc_rook', steps: [WEG], nat: NAT })).json().plan;
    const r = (await rufe('Gwen', 'POST', `/api/maps/map_1/turn-plan/${plan}/decide`, { decision: 'confirm' })).json();
    expect(r).toMatchObject({ state: 'reacting', pending: { reactor: 'cr_gob', rule: 'r_oa', ruleName: 'Opportunity attack', offer: 'Opportunity attack', strike: true, against: 'pc_rook' } });
    const a = (await rufe('Gwen', 'POST', `/api/maps/map_1/turn-plan/${plan}/react`, { attack: true })).json();
    expect(a.state).toBe('confirmed');
    expect(a.results[0].text).toMatch(/^Opportunity attack: Unarmed Strike → Rook: (hit|miss)/);
    expect(await repo.listEvents({ name: 'reaction' })).toHaveLength(1);
  });

  it('ohne die Regel fragt niemand, Disengage gibt einen Hinweis statt eines Angebots', async () => {
    const { rufe, repo } = await aufbau();
    await mitRegeln(repo, []);
    await nebeneinander(repo);
    const plan = (await rufe('Sela', 'POST', '/api/maps/map_1/turn-plan', { actor: 'pc_rook', steps: [WEG], nat: NAT })).json().plan;
    expect((await rufe('Gwen', 'POST', `/api/maps/map_1/turn-plan/${plan}/decide`, { decision: 'confirm' })).json().state).toBe('confirmed');

    await mitRegeln(repo, [{ id: 'r_oa', name: 'Opportunity attack', graph: beispiel('opportunity-attack') }]);
    await nebeneinander(repo);
    const los = { id: 'd', kind: 'act', tile: 'std:disengage', name: 'Disengage', cost: 'action' };
    const zwei = (await rufe('Sela', 'POST', '/api/maps/map_1/turn-plan', { actor: 'pc_rook', steps: [los, WEG], nat: NAT })).json().plan;
    const r = (await rufe('Gwen', 'POST', `/api/maps/map_1/turn-plan/${zwei}/decide`, { decision: 'confirm' })).json();
    expect(r.state).toBe('confirmed');
    expect(r.results.map((x: { text: string }) => x.text)).toContain('Opportunity attack: Rook gets “Leaves without provoking (Disengage)”');
  });

  it('eine Reaktion mitten im Angriff: angeboten, genommen, und der Angriff läuft weiter', async () => {
    const { rufe, repo } = await aufbau();
    await mitRegeln(repo, [{ id: 'r_parry', name: 'Parry', graph: PARADE }]);
    await nebeneinander(repo);
    const hieb = { id: 'h', kind: 'act', tile: 'ac_axe', name: 'Handaxe', cost: 'action', target: 'cr_gob', targetName: 'Goblin' };
    const plan = (await rufe('Sela', 'POST', '/api/maps/map_1/turn-plan', { actor: 'pc_rook', steps: [hieb], nat: NAT })).json().plan;
    const r = (await rufe('Gwen', 'POST', `/api/maps/map_1/turn-plan/${plan}/decide`, { decision: 'confirm' })).json();
    expect(r).toMatchObject({ state: 'reacting', pending: { reactor: 'cr_gob', offer: 'Parry', step: 'h' }, cursor: { step: 'h' } });
    /* Noch nichts gewürfelt: angegriffen kommt vor dem Wurf. */
    expect(await repo.listEvents({ name: 'roll' })).toHaveLength(0);
    const a = (await rufe('Gwen', 'POST', `/api/maps/map_1/turn-plan/${plan}/react`, { attack: true })).json();
    expect(a.state).toBe('confirmed');
    expect(a.cursor).toBeUndefined();
    expect(a.results.map((x: { text: string }) => x.text)).toEqual(['Goblin uses Parry against Rook.', expect.stringMatching(/^Handaxe → Goblin: (hit|miss)/)]);
    expect(await repo.listEvents({ name: 'reaction' })).toHaveLength(1);
  });

  it('aus heisst: der eingebaute Gelegenheitsangriff, auch wenn Regelartikel da sind', async () => {
    const { rufe, repo } = await aufbau();
    await mitRegeln(repo, [{ id: 'r_parry', name: 'Parry', graph: PARADE }]);
    const camp = (await repo.getEntity('camp_a'))!;
    await repo.putEntity({ ...camp, components: { ...camp.components, Campaign: { ruleGraphs: 'off' } } });
    await nebeneinander(repo);
    const plan = (await rufe('Sela', 'POST', '/api/maps/map_1/turn-plan', { actor: 'pc_rook', steps: [WEG], nat: NAT })).json().plan;
    const r = (await rufe('Gwen', 'POST', `/api/maps/map_1/turn-plan/${plan}/decide`, { decision: 'confirm' })).json();
    expect(r.pending).toMatchObject({ reactor: 'cr_gob' });
    expect(r.pending.rule).toBeUndefined();
  });
});

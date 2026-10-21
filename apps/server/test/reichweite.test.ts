/**
 * **Reichweite am Server** (T-351): ein Angriff ausser Reichweite wird beim
 * Einreichen abgelehnt und beim Ausführen nicht gewürfelt, lange
 * Reichweite würfelt mit Nachteil, und Zustände geben über ihre Wirkungen
 * Vorteil oder Nachteil — Prone nach Abstand. Leitung und Spielerin
 * nebeneinander. Der W20 steht fest auf 11. Erfundene Artikel.
 */

import type * as Krypto from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

vi.mock('node:crypto', async (orig) => {
  const echt = await orig<typeof Krypto>();
  return { ...echt, getRandomValues: <T extends ArrayBufferView>(a: T): T => ((a as unknown as Uint32Array)[0] = 2 ** 31, a) };
});

import type { Entity } from '@nw/model';
import { tisch } from './hilfen/tisch.js';

const ident = (name: string, id: string) => ({ Identity: { name, id, aliases: [] }, Status: { status: 'ready' } });
const im = (id: string) => ({ id: `${id}_in`, type: 'inLayer', to: 'ly_a', props: {} });
/** Ein Feld ist 70 px, die Karte 28 Felder breit: x in Feldern → Anteil der Karte. */
const x = (feld: number) => (feld * 70 + 35) / 1960;
const NAT = { w: 1960, h: 700 };

function bestand(ziel: { liegt?: boolean; blind?: boolean } = {}): Entity[] {
  const zustaende = [...(ziel.liegt ? ['cd_prone'] : []), ...(ziel.blind ? ['cd_blind'] : [])];
  return [
    { id: 'ly_a', name: 'ly_a', interfaces: ['Layer'], components: { ...ident('Ebene A', 'layer-0001'), Layer: { kind: 'campaign', order: 50 } }, relations: [] },
    { id: 'camp_a', name: 'Runde A', interfaces: ['Campaign'], components: { ...ident('Runde A', 'campaign-0001'), Campaign: {} },
      relations: [{ id: 'camp_a_ac', type: 'activates', to: 'ly_a', props: {} }] },
    { id: 'at_action', name: 'Action', interfaces: ['ActionType'], components: ident('Action', 'actiontype-0001'), relations: [im('at_action')] },
    /* Ein Bogen 20/60 ft: bis 4 Felder normal, bis 12 lang. */
    { id: 'ac_bow', name: 'Shortbow', interfaces: ['Action'],
      components: { ...ident('Shortbow', 'action-0001'), Action: { actionType: 'at_action', attack: ['ranged weapon'], ability: 'dex', damageDice: '4', damageType: 'piercing', range: '20/60' } },
      relations: [im('ac_bow')] },
    { id: 'pc_rook', name: 'Rook', interfaces: ['PlayerCharacter'], components: ident('Rook', 'playercharacter-0001'), relations: [im('pc_rook')] },
    { id: 'sb_rook', name: 'Rook stats', interfaces: ['Statblock'],
      components: { ...ident('Rook stats', 'statblock-0001'), Statblock: { ac: 14, hp: 20, speed: '30 ft.', prof: 2 }, Abilities: { str: 10, dex: 16, con: 14, int: 8, wis: 10, cha: 8 } },
      relations: [im('sb_rook'), { id: 'sb_rook_b', type: 'belongsTo', to: 'pc_rook', props: {} }, { id: 'sb_rook_c1', type: 'composedOf', to: 'ac_bow', props: {} }] },
    /* Zwei Zustände mit ihren Wirkungen, wie sie auf dev nachgezogen werden. */
    { id: 'cd_prone', name: 'Prone', interfaces: ['Condition'],
      components: { ...ident('Prone', 'condition-0001'), Effects: { effects: [
        { id: 'attack', target: 'attack', op: 'grant', value: 'disadvantage' },
        { id: 'near', target: 'attacked.near', op: 'grant', value: 'advantage' },
        { id: 'far', target: 'attacked.far', op: 'grant', value: 'disadvantage' },
      ] } }, relations: [im('cd_prone')] },
    { id: 'cd_blind', name: 'Blinded', interfaces: ['Condition'],
      components: { ...ident('Blinded', 'condition-0002'), Effects: { effects: [
        { id: 'attack', target: 'attack', op: 'grant', value: 'disadvantage' },
        { id: 'attacked', target: 'attacked', op: 'grant', value: 'advantage' },
      ] } }, relations: [im('cd_blind')] },
    { id: 'cr_gob', name: 'Goblin', interfaces: ['Creature'], components: { ...ident('Goblin', 'creature-0001'), ...(zustaende.length ? { Vitals: { conditions: zustaende } } : {}) }, relations: [im('cr_gob')] },
    { id: 'sb_gob', name: 'Goblin stats', interfaces: ['Statblock'],
      components: { ...ident('Goblin stats', 'statblock-0002'), Statblock: { ac: 15, hp: 30, speed: '30 ft.', prof: 2 }, Abilities: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 } },
      relations: [im('sb_gob'), { id: 'sb_gob_b', type: 'belongsTo', to: 'cr_gob', props: {} }] },
    { id: 'map_1', name: 'Field', interfaces: ['Map'],
      components: { ...ident('Field', 'map-0001'), Map: { gridShape: 'square', gridSize: 70 }, Image: { image: 'https://example.org/field.png' } },
      relations: [im('map_1'),
        { id: 'mk_rook', type: 'marker', to: 'pc_rook', props: { x: x(0), y: 0.05, kind: 'play' } },
        /* 8 Felder = 40 ft: lange Reichweite. */
        { id: 'mk_gob', type: 'marker', to: 'cr_gob', props: { x: x(8), y: 0.05, kind: 'play' } }] },
  ];
}

const KONTEN = {
  Gwen: { roles: { camp_a: 'gm' as const } },
  Pia: { roles: { camp_a: 'player' as const }, actorIds: ['pc_rook'] },
};
const ROLLEN = ['Gwen', 'Pia'] as const;

const bogen = { id: 'b', kind: 'act', tile: 'ac_bow', name: 'Shortbow', cost: 'action', target: 'cr_gob', targetName: 'Goblin' };
/** Ein Weg nach `feld` in der ersten Reihe, 5 ft je Feld. */
const weg = (von: number, bis: number) => ({
  id: 'm',
  kind: 'move',
  path: Array.from({ length: Math.abs(bis - von) + 1 }, (_, i) => ({ x: von + Math.sign(bis - von) * i, y: 0 })),
  feet: Math.abs(bis - von) * 5,
  to: { x: x(bis), y: 0.05 },
});

async function aufbau(ziel: { liegt?: boolean; blind?: boolean } = {}, goblinFeld = 8) {
  const artikel = bestand(ziel).map((e) =>
    e.id === 'map_1' ? { ...e, relations: (e.relations ?? []).map((r) => (r.id === 'mk_gob' ? { ...r, props: { ...r.props, x: x(goblinFeld) } } : r)) } : e,
  );
  const t = await tisch({ artikel, kampagne: 'camp_a', konten: KONTEN });
  /** Einreichen als `wer`, bestätigen als Leitung; die Ergebnisse und die Würfe. */
  const zug = async (wer: string, steps: object[]) => {
    const p = await t.als(wer, 'POST', '/api/maps/map_1/turn-plan', { payload: { actor: 'pc_rook', steps, nat: NAT } });
    expect(p.statusCode, p.body).toBe(200);
    const d = await t.als('Gwen', 'POST', `/api/maps/map_1/turn-plan/${p.json().plan}/decide`, { payload: { decision: 'confirm' } });
    expect(d.statusCode, d.body).toBe(200);
    const wuerfe = (await t.repo.listEvents({ name: 'roll' })).map((e) => e.payload as { label: string; expr: string });
    return { results: d.json().results as { text: string }[], wuerfe };
  };
  return { t, zug };
}

describe('T-351: Reichweite beim Einreichen', () => {
  for (const wer of ROLLEN) {
    it(`${wer}: ausser Reichweite wird abgelehnt — mit dem, was zu tun ist`, async () => {
      const { t } = await aufbau({}, 20);
      const r = await t.als(wer, 'POST', '/api/maps/map_1/turn-plan', { payload: { actor: 'pc_rook', steps: [bogen], nat: NAT } });
      expect(r.statusCode).toBe(422);
      expect(r.json().error).toBe('Goblin is 100 ft away — out of range for Shortbow (20 ft, long 60 ft). Move closer first or pick another target.');
    });

    it(`${wer}: gemessen vom Ende des Wegs davor — erst gehen, dann schiessen, nimmt er an`, async () => {
      /* 80 ft: ausser Reichweite; nach 30 ft Weg 50 ft, lang. */
      const { t } = await aufbau({}, 16);
      const ohne = await t.als(wer, 'POST', '/api/maps/map_1/turn-plan', { payload: { actor: 'pc_rook', steps: [bogen], nat: NAT } });
      expect(ohne.statusCode).toBe(422);
      const r = await t.als(wer, 'POST', '/api/maps/map_1/turn-plan', { payload: { actor: 'pc_rook', steps: [weg(0, 6), bogen], nat: NAT } });
      expect(r.statusCode, r.body).toBe(200);
    });
  }

  it('ohne Gitter prüft niemand, statt falsch abzulehnen', async () => {
    const { t } = await aufbau({}, 20);
    const r = await t.als('Pia', 'POST', '/api/maps/map_1/turn-plan', { payload: { actor: 'pc_rook', steps: [bogen] } });
    expect(r.statusCode, r.body).toBe(200);
  });
});

describe('T-351: lange Reichweite und Ausführen', () => {
  for (const wer of ROLLEN) {
    it(`${wer}: auf langer Reichweite würfelt der Angriff mit Nachteil`, async () => {
      const { zug } = await aufbau();
      const { results, wuerfe } = await zug(wer, [bogen]);
      expect(results[0]!.text).toMatch(/with disadvantage/);
      expect(wuerfe.find((w) => w.label === 'Shortbow → Goblin: attack (disadvantage, long range)')?.expr).toMatch(/^2d20kl1/);
    });
  }

  it('auf kurzer Reichweite ohne Nachteil', async () => {
    const { zug } = await aufbau({}, 3);
    const { results, wuerfe } = await zug('Pia', [bogen]);
    expect(results[0]!.text).not.toMatch(/advantage/);
    expect(wuerfe.find((w) => w.label === 'Shortbow → Goblin: attack')?.expr).toMatch(/^1d20/);
  });

  it('ist das Ziel seither ausser Reichweite gegangen, wird nicht gewürfelt', async () => {
    const { t } = await aufbau();
    const p = await t.als('Pia', 'POST', '/api/maps/map_1/turn-plan', { payload: { actor: 'pc_rook', steps: [bogen], nat: NAT } });
    expect(p.statusCode, p.body).toBe(200);
    const karte = (await t.repo.getEntity('map_1'))!;
    await t.repo.putEntity({ ...karte, relations: (karte.relations ?? []).map((r) => (r.id === 'mk_gob' ? { ...r, props: { ...r.props, x: x(25) } } : r)) });
    const d = await t.als('Gwen', 'POST', `/api/maps/map_1/turn-plan/${p.json().plan}/decide`, { payload: { decision: 'confirm' } });
    expect(d.statusCode, d.body).toBe(200);
    expect(d.json().results[0].text).toBe('Shortbow → Goblin: out of range (125 ft), no roll.');
    expect(await t.repo.listEvents({ name: 'roll' })).toEqual([]);
  });
});

describe('T-351: Zustände geben Vorteil und Nachteil', () => {
  it('Blinded am Ziel: Vorteil — hebt sich mit der langen Reichweite auf', async () => {
    const { zug } = await aufbau({ blind: true });
    const { wuerfe } = await zug('Pia', [bogen]);
    expect(wuerfe.find((w) => w.label === 'Shortbow → Goblin: attack (long range)')?.expr).toMatch(/^1d20/);
  });

  it('Prone am Ziel: aus 5 ft Vorteil, von weiter weg Nachteil', async () => {
    const nah = await aufbau({ liegt: true }, 1);
    expect((await nah.zug('Pia', [bogen])).wuerfe.map((w) => w.label)).toContain('Shortbow → Goblin: attack (advantage)');
    const fern = await aufbau({ liegt: true }, 3);
    expect((await fern.zug('Pia', [bogen])).wuerfe.map((w) => w.label)).toContain('Shortbow → Goblin: attack (disadvantage)');
  });

  for (const wer of ROLLEN) {
    it(`${wer}: die Lage zeigt die Chance mit Nachteil, den Modus und die Chance auf langer Reichweite`, async () => {
      const { t } = await aufbau({}, 3);
      const l = await t.json<{ targets: { id: string; chances: Record<string, number>; long?: Record<string, number>; modes?: Record<string, string>; feet?: number; ac?: number }[] }>(
        wer,
        'GET',
        '/api/maps/map_1/turn-plan?actor=pc_rook&nat=1960x700',
      );
      const g = l.targets.find((z) => z.id === 'cr_gob')!;
      /* +5 gegen RK 15: 11 von 20 = 55 %; mit Nachteil 0,55² ≈ 30 %. */
      expect(g.chances['ac_bow']).toBe(55);
      expect(g.long?.['ac_bow']).toBe(30);
      expect(g.modes?.['ac_bow']).toBeUndefined();
      expect(g.feet).toBe(15);
      expect(g.ac === undefined).toBe(wer === 'Pia');
    });
  }

  it('die Lage rechnet den Zustand mit: Blinded am Ziel gibt Vorteil', async () => {
    const { t } = await aufbau({ blind: true }, 3);
    const l = await t.json<{ targets: { id: string; chances: Record<string, number>; modes?: Record<string, string> }[] }>('Pia', 'GET', '/api/maps/map_1/turn-plan?actor=pc_rook&nat=1960x700');
    const g = l.targets.find((z) => z.id === 'cr_gob')!;
    expect(g.modes?.['ac_bow']).toBe('adv');
    /* 1 − 0,45² ≈ 80 %. */
    expect(g.chances['ac_bow']).toBe(80);
  });
});

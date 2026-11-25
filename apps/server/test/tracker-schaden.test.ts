/**
 * **Schaden im Tracker mit Art und Abwehr** (T-355): „Damage" nimmt eine
 * Schadensart, und der Server rechnet wie beim Zugplan (`damageAtTable`):
 * Resistenz halbiert, Immunität nimmt alles, Verwundbarkeit verdoppelt.
 * Eine Spielerfigur verliert erst zeitweilige Trefferpunkte, ihr Stand
 * steht an `Vitals` und an der Teilnehmerkante gleich; konzentriert sie
 * sich, würfelt der Server die Probe ins Log (E-128, Variante A). Der W20
 * steht fest auf 11. Erfundene Artikel.
 */

import type * as Krypto from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

vi.mock('node:crypto', async (orig) => {
  const echt = await orig<typeof Krypto>();
  return { ...echt, getRandomValues: <T extends ArrayBufferView>(a: T): T => ((a as unknown as Uint32Array)[0] = 2 ** 31, a) };
});

import type { Entity, ParticipantProps, Relation } from '@nw/model';
import { tisch } from './hilfen/tisch.js';

const ident = (name: string, id: string) => ({ Identity: { name, id, aliases: [] }, Status: { status: 'ready' } });
const im = (id: string): Relation => ({ id: `${id}_in`, type: 'inLayer', to: 'ly_a', props: {} });

function bestand(): Entity[] {
  return [
    { id: 'ly_a', name: 'ly_a', interfaces: ['Layer'], components: { ...ident('Ebene A', 'layer-0001'), Layer: { kind: 'campaign', order: 50 } }, relations: [] },
    { id: 'camp_a', name: 'Runde A', interfaces: ['Campaign'], components: { ...ident('Runde A', 'campaign-0001'), Campaign: {} },
      relations: [{ id: 'camp_a_ac', type: 'activates', to: 'ly_a', props: {} }] },
    { id: 'sp_bless', name: 'Bless', interfaces: ['Spell'], components: ident('Bless', 'spell-0001'), relations: [im('sp_bless')] },
    { id: 'pc_rook', name: 'Rook', interfaces: ['PlayerCharacter'],
      components: { ...ident('Rook', 'playercharacter-0001'), Vitals: { hp: 20, hpTemp: 3, concentration: 'sp_bless' } }, relations: [im('pc_rook')] },
    { id: 'sb_rook', name: 'Rook stats', interfaces: ['Statblock'],
      components: { ...ident('Rook stats', 'statblock-0001'), Statblock: { ac: 14, hp: 24, speed: '30 ft.', prof: 2 }, Abilities: { str: 10, dex: 12, con: 10, int: 10, wis: 10, cha: 10 } },
      relations: [im('sb_rook'), { id: 'sb_rook_b', type: 'belongsTo', to: 'pc_rook', props: {} }] },
    { id: 'cr_ghul', name: 'Ghul', interfaces: ['Creature'], components: ident('Ghul', 'creature-0001'), relations: [im('cr_ghul')] },
    { id: 'sb_ghul', name: 'Ghul stats', interfaces: ['Statblock'],
      components: { ...ident('Ghul stats', 'statblock-0002'), Statblock: { ac: 12, hp: 22, speed: '30 ft.', resistances: 'fire', immunities: 'poison', vulnerabilities: 'radiant' } },
      relations: [im('sb_ghul'), { id: 'sb_ghul_b', type: 'belongsTo', to: 'cr_ghul', props: {} }] },
    { id: 'enc_1', name: 'Ghule', interfaces: ['Encounter'], components: { ...ident('Ghule', 'encounter-0001'), Encounter: { round: 1, turn: 0, phase: 'running' } },
      relations: [im('enc_1'),
        { id: 'p1', type: 'participates', to: 'pc_rook', props: { init: 18, hp: 20 } },
        { id: 'p2', type: 'participates', to: 'cr_ghul', props: { init: 12, revealed: true, hp: 10 } }] },
  ];
}

const KONTEN = {
  Gwen: { roles: { camp_a: 'gm' as const } },
  Pia: { roles: { camp_a: 'player' as const }, actorIds: ['pc_rook'] },
};

async function aufbau() {
  const t = await tisch({ artikel: bestand(), kampagne: 'camp_a', konten: KONTEN });
  const tue = (wer: string, op: object) => t.als(wer, 'POST', '/api/encounters/enc_1/tracker', { payload: op });
  const kante = async (edge: string) => ((await t.repo.getEntity('enc_1'))!.relations ?? []).find((r) => r.id === edge)!.props as ParticipantProps;
  return { t, tue, kante };
}

describe('T-355: Schaden im Tracker nach Art und Abwehr', () => {
  const faelle = [
    { type: 'fire', amount: 8, hp: 6, text: 'resistant (fire) → 4; Ghul at 6/22 HP' },
    { type: 'Radiant', amount: 3, hp: 4, text: 'vulnerable (radiant) → 6; Ghul at 4/22 HP' },
    { type: 'poison', amount: 9, hp: 10, text: 'immune (poison) → 0; Ghul at 10/22 HP' },
    { type: '', amount: 3, hp: 7, text: 'Ghul at 7/22 HP' },
  ];
  for (const f of faelle) {
    it(`${f.type || 'ohne Art'}: ${f.amount} → ${f.hp}`, async () => {
      const { tue, kante } = await aufbau();
      const r = await tue('Gwen', { op: 'damage', edge: 'p2', amount: f.amount, ...(f.type ? { type: f.type } : {}) });
      expect(r.statusCode, r.body).toBe(200);
      expect(r.json().text).toBe(f.text);
      expect((await kante('p2')).hp).toBe(f.hp);
    });
  }

  it('die Spielerin zieht keinen Schaden ab', async () => {
    const { tue } = await aufbau();
    expect((await tue('Pia', { op: 'damage', edge: 'p2', amount: 4, type: 'fire' })).statusCode).toBe(403);
  });

  it('ein Betrag ohne Zahl ist keiner', async () => {
    const { tue } = await aufbau();
    expect((await tue('Gwen', { op: 'damage', edge: 'p2', amount: 'viel' })).statusCode).toBe(422);
  });
});

describe('T-355: die Spielerfigur — eine Rechnung, zwei Stellen gleich', () => {
  it('zeitweilige zuerst, Vitals und Kante gleich, Konzentration gehalten (11 gegen SG 10)', async () => {
    const { t, tue, kante } = await aufbau();
    const r = await tue('Gwen', { op: 'damage', edge: 'p1', amount: 5, type: 'slashing' });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().text).toBe('Rook at 18/24 HP; concentration save 11 vs DC 10 — kept');
    const v = (await t.repo.getEntity('pc_rook'))!.components!['Vitals'] as Record<string, unknown>;
    expect(v).toMatchObject({ hp: 18, concentration: 'sp_bless' });
    expect(v['hpTemp']).toBeUndefined();
    expect((await kante('p1')).hp).toBe(18);
    const wuerfe = (await t.repo.listEvents({ name: 'roll' })).map((e) => e.payload as { label: string; expr: string; total: number });
    expect(wuerfe).toEqual([expect.objectContaining({ label: 'Rook: concentration save, DC 10', expr: '1d20+0', total: 11 })]);
  });

  it('bei 30 Schaden SG 15: verloren, Vitals.concentration ist leer', async () => {
    const { t, tue } = await aufbau();
    const r = await tue('Gwen', { op: 'damage', edge: 'p1', amount: 30 });
    expect(r.json().text).toBe('Rook at 0/24 HP; concentration save 11 vs DC 15 — lost (Bless)');
    const v = (await t.repo.getEntity('pc_rook'))!.components!['Vitals'] as Record<string, unknown>;
    expect(v['concentration']).toBeUndefined();
    expect(v['hp']).toBe(0);
  });

  it('Heilen im Tracker schreibt bei einer Spielerfigur beide Stellen', async () => {
    const { t, tue, kante } = await aufbau();
    expect((await tue('Gwen', { op: 'hp', edge: 'p1', delta: 3 })).statusCode).toBe(200);
    expect((await kante('p1')).hp).toBe(23);
    expect(((await t.repo.getEntity('pc_rook'))!.components!['Vitals'] as Record<string, unknown>)['hp']).toBe(23);
  });
});

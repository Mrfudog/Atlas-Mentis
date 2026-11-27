/**
 * **Gefolge und Minions über die Routen** (T-497): der Artikel bringt in
 * `refs.follower` Stufe und Übungsbonus des Anführers mit — am Statblock
 * wie an der Kreatur —, gesiebt wie jeder Artikel: wer den Anführer nicht
 * sieht, bekommt seinen Namen nicht. Der Tracker setzt einen Minion auf 0
 * und nennt mit der Regel Overkill den Rest. Erfundene Artikel.
 */
import { describe, expect, it } from 'vitest';
import type { Entity, ParticipantProps, Relation } from '@nw/model';
import { tisch } from './hilfen/tisch.js';

const ident = (name: string, id: string) => ({ Identity: { name, id, aliases: [] }, Status: { status: 'ready' } });
const im = (id: string): Relation => ({ id: `${id}_in`, type: 'inLayer', to: 'ly_a', props: {} });

function bestand(overkill: 'on' | 'off' = 'on'): Entity[] {
  return [
    { id: 'ly_a', name: 'ly_a', interfaces: ['Layer'], components: { ...ident('Ebene A', 'layer-0001'), Layer: { kind: 'campaign', order: 50 } }, relations: [] },
    { id: 'camp_a', name: 'Runde A', interfaces: ['Campaign'], components: { ...ident('Runde A', 'campaign-0001'), Campaign: { overkill } },
      relations: [{ id: 'camp_a_ac', type: 'activates', to: 'ly_a', props: {} }] },
    { id: 'pc_rook', name: 'Rook', interfaces: ['PlayerCharacter'], components: ident('Rook', 'playercharacter-0001'), relations: [im('pc_rook')] },
    { id: 'sb_rook', name: 'Rook stats', interfaces: ['Statblock'],
      components: { ...ident('Rook stats', 'statblock-0001'), Statblock: { ac: 14, hp: 24, prof: 3 } },
      relations: [im('sb_rook'), { id: 'sb_rook_b', type: 'belongsTo', to: 'pc_rook', props: {} }] },
    /* Ein Gefolgsmann auf Stufe 5, Übungsbonus aus der Stufe. */
    { id: 'cr_knappe', name: 'Squire', interfaces: ['Creature'], components: { ...ident('Squire', 'creature-0001'), Creature: { kind: 'retainer' } },
      relations: [im('cr_knappe'), { id: 'f1', type: 'follows', to: 'pc_rook', props: { as: 'retainer', level: 5 } }] },
    { id: 'sb_knappe', name: 'Squire stats', interfaces: ['Statblock'],
      components: { ...ident('Squire stats', 'statblock-0002'), Statblock: { ac: 13, hp: 0, hpPerLevel: 6, pbFrom: 'level' } },
      relations: [im('sb_knappe'), { id: 'sb_knappe_b', type: 'belongsTo', to: 'cr_knappe', props: {} }] },
    /* Ein Reittier, dessen Reiter die Spielerin nicht sieht. */
    { id: 'cr_boss', name: 'Hidden master', interfaces: ['Creature'],
      components: { ...ident('Hidden master', 'creature-0002'), Visibility: { audience: 'gm' } }, relations: [im('cr_boss')] },
    { id: 'sb_boss', name: 'Master stats', interfaces: ['Statblock'],
      components: { ...ident('Master stats', 'statblock-0003'), Statblock: { prof: 4 }, Visibility: { audience: 'gm' } },
      relations: [im('sb_boss'), { id: 'sb_boss_b', type: 'belongsTo', to: 'cr_boss', props: {} }] },
    { id: 'cr_ross', name: 'Steed', interfaces: ['Creature'], components: ident('Steed', 'creature-0003'),
      relations: [im('cr_ross'), { id: 'f2', type: 'follows', to: 'cr_boss', props: { as: 'mount', level: 2 } }] },
    /* Ein Minion in einer laufenden Begegnung. */
    { id: 'cr_grunt', name: 'Grunt', interfaces: ['Creature'], components: ident('Grunt', 'creature-0004'), relations: [im('cr_grunt')] },
    { id: 'sb_grunt', name: 'Grunt stats', interfaces: ['Statblock'],
      components: { ...ident('Grunt stats', 'statblock-0004'), Statblock: { ac: 12, hp: 5, minion: true } },
      relations: [im('sb_grunt'), { id: 'sb_grunt_b', type: 'belongsTo', to: 'cr_grunt', props: {} }] },
    { id: 'enc_1', name: 'Grunts', interfaces: ['Encounter'], components: { ...ident('Grunts', 'encounter-0001'), Encounter: { round: 1, turn: 0, phase: 'running' } },
      relations: [im('enc_1'), { id: 'p1', type: 'participates', to: 'cr_grunt', props: { init: 12, revealed: true, hp: 5 } }] },
  ];
}

const KONTEN = {
  Gwen: { roles: { camp_a: 'gm' as const } },
  Pia: { roles: { camp_a: 'player' as const }, actorIds: ['pc_rook'] },
};

type Antwort = { refs: { follower?: Record<string, unknown> } };

describe('T-497: refs.follower', () => {
  it('am Statblock und an der Kreatur: Stufe, Sorte und Übungsbonus des Anführers', async () => {
    const t = await tisch({ artikel: bestand(), kampagne: 'camp_a', konten: KONTEN });
    const erwartet = { level: 5, leaderProf: 3, as: 'retainer', leader: 'pc_rook', leaderName: 'Rook' };
    for (const wer of ['Gwen', 'Pia']) {
      expect((await t.json<Antwort>(wer, 'GET', '/api/entities/sb_knappe')).refs.follower, wer).toEqual(erwartet);
      expect((await t.json<Antwort>(wer, 'GET', '/api/entities/cr_knappe')).refs.follower, wer).toEqual(erwartet);
    }
  });

  it('ohne Kante keins', async () => {
    const t = await tisch({ artikel: bestand(), kampagne: 'camp_a', konten: KONTEN });
    expect((await t.json<Antwort>('Gwen', 'GET', '/api/entities/sb_rook')).refs.follower).toBeUndefined();
    expect((await t.json<Antwort>('Gwen', 'GET', '/api/entities/cr_grunt')).refs.follower).toBeUndefined();
  });

  it('einen Anführer, den die Spielerin nicht sieht, nennt es ihr nicht', async () => {
    const t = await tisch({ artikel: bestand(), kampagne: 'camp_a', konten: KONTEN });
    expect((await t.json<Antwort>('Gwen', 'GET', '/api/entities/cr_ross')).refs.follower).toEqual({
      level: 2, leaderProf: 4, as: 'mount', leader: 'cr_boss', leaderName: 'Hidden master',
    });
    expect((await t.json<Antwort>('Pia', 'GET', '/api/entities/cr_ross')).refs.follower).toEqual({ level: 2, leaderProf: 4, as: 'mount' });
  });
});

describe('T-497: Minion im Tracker', () => {
  async function aufbau(overkill: 'on' | 'off') {
    const t = await tisch({ artikel: bestand(overkill), kampagne: 'camp_a', konten: KONTEN });
    const tue = (wer: string, op: object) => t.als(wer, 'POST', '/api/encounters/enc_1/tracker', { payload: op });
    const kante = async () => ((await t.repo.getEntity('enc_1'))!.relations ?? []).find((r) => r.id === 'p1')!.props as ParticipantProps;
    return { tue, kante };
  }

  it('mit Overkill: auf 0, und der Rest steht im Text', async () => {
    const { tue, kante } = await aufbau('on');
    const r = await tue('Gwen', { op: 'damage', edge: 'p1', amount: 9 });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().text).toBe('Grunt at 0/5 HP; overkill 4: deal it to another minion within reach');
    expect((await kante()).hp).toBe(0);
  });

  it('ohne Overkill: auf 0, auch bei einem Punkt, und kein Rest', async () => {
    const { tue, kante } = await aufbau('off');
    const r = await tue('Gwen', { op: 'damage', edge: 'p1', amount: 1 });
    expect(r.json().text).toBe('Grunt at 0/5 HP');
    expect((await kante()).hp).toBe(0);
  });

  it('die Spielerin zieht keinen Schaden ab', async () => {
    const { tue } = await aufbau('on');
    expect((await tue('Pia', { op: 'damage', edge: 'p1', amount: 9 })).statusCode).toBe(403);
  });
});

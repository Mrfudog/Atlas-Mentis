/**
 * **Das Raster des Zugplans am Tisch** (T-349): durch einen Verbündeten
 * ist ein Weg planbar, enden darf er dort nicht; durch einen Gegner nicht;
 * schwieriges Gelände aus den Zonen der Karte kostet doppelt, und der
 * Server rechnet die Fuss selbst nach — ein zu langer Weg wird abgelehnt,
 * auch wenn die Maske weniger behauptet. Eine versteckte Zone zählt für
 * die Spielerin erst, wenn sie gefunden ist. Leitung und Spielerin
 * nebeneinander. Erfundene Artikel.
 */

import { describe, expect, it } from 'vitest';
import type { Entity } from '@nw/model';
import { tisch } from './hilfen/tisch.js';

const ident = (name: string, id: string) => ({ Identity: { name, id, aliases: [] }, Status: { status: 'ready' } });
const im = (id: string) => ({ id: `${id}_in`, type: 'inLayer', to: 'ly_a', props: {} });
/** Ein Feld ist 70 px, die Karte 28 × 10 Felder: Feld → Anteil der Karte. */
const x = (feld: number) => (feld * 70 + 35) / 1960;
const NAT = { w: 1960, h: 700 };

const statblock = (id: string, name: string, wem: string): Entity => ({
  id, name, interfaces: ['Statblock'],
  components: { ...ident(name, `statblock-${id}`), Statblock: { ac: 12, hp: 20, speed: '30 ft.', prof: 2 }, Abilities: { str: 10, dex: 12, con: 12, int: 10, wis: 10, cha: 10 } },
  relations: [im(id), { id: `${id}_b`, type: 'belongsTo', to: wem, props: {} }],
});

function bestand(versteckt = false): Entity[] {
  return [
    { id: 'ly_a', name: 'ly_a', interfaces: ['Layer'], components: { ...ident('Ebene A', 'layer-0001'), Layer: { kind: 'campaign', order: 50 } }, relations: [] },
    { id: 'camp_a', name: 'Runde A', interfaces: ['Campaign'], components: { ...ident('Runde A', 'campaign-0001'), Campaign: {} },
      relations: [{ id: 'camp_a_ac', type: 'activates', to: 'ly_a', props: {} }] },
    { id: 'pc_rook', name: 'Rook', interfaces: ['PlayerCharacter'], components: ident('Rook', 'playercharacter-0001'), relations: [im('pc_rook')] },
    { id: 'pc_mara', name: 'Mara', interfaces: ['PlayerCharacter'], components: ident('Mara', 'playercharacter-0002'), relations: [im('pc_mara')] },
    { id: 'cr_gob', name: 'Goblin', interfaces: ['Creature'], components: ident('Goblin', 'creature-0001'), relations: [im('cr_gob')] },
    statblock('sb_rook', 'Rook stats', 'pc_rook'),
    statblock('sb_mara', 'Mara stats', 'pc_mara'),
    statblock('sb_gob', 'Goblin stats', 'cr_gob'),
    { id: 'zk_mud', name: 'Mud', interfaces: ['ZoneKind'], components: { ...ident('Mud', 'zonekind-0001'), ZoneKind: { moveCost: 2, ...(versteckt ? { hiddenUntil: 15 } : {}) } }, relations: [im('zk_mud')] },
    { id: 'map_1', name: 'Field', interfaces: ['Map'],
      components: { ...ident('Field', 'map-0001'), Map: { gridShape: 'square', gridSize: 70 }, Image: { image: 'https://example.org/field.png' } },
      relations: [im('map_1'),
        { id: 'mk_rook', type: 'marker', to: 'pc_rook', props: { x: x(0), y: 0.05, kind: 'play' } },
        { id: 'mk_mara', type: 'marker', to: 'pc_mara', props: { x: x(1), y: 0.05, kind: 'play' } },
        { id: 'mk_gob', type: 'marker', to: 'cr_gob', props: { x: x(8), y: 0.05, kind: 'play' } },
        /* Felder 2 und 3 der ersten Reihe sind Schlamm. */
        { id: 'zn_mud', type: 'zone', to: 'zk_mud', props: { kind: 'rect', x: (2 * 70) / 1960, y: 0, w: (2 * 70) / 1960, h: 0.1 } }] },
  ];
}

const KONTEN = {
  Gwen: { roles: { camp_a: 'gm' as const } },
  Pia: { roles: { camp_a: 'player' as const }, actorIds: ['pc_rook'] },
};
const ROLLEN = ['Gwen', 'Pia'] as const;

/** Ein Weg in der ersten Reihe; `feet` ist, was die Maske behauptet. */
const weg = (von: number, bis: number, feet = Math.abs(bis - von) * 5) => ({
  id: 'm',
  kind: 'move',
  path: Array.from({ length: Math.abs(bis - von) + 1 }, (_, i) => ({ x: von + Math.sign(bis - von) * i, y: 0 })),
  feet,
  to: { x: x(bis), y: 0.05 },
});

async function aufbau(versteckt = false) {
  const t = await tisch({ artikel: bestand(versteckt), kampagne: 'camp_a', konten: KONTEN });
  const einreichen = (wer: string, steps: object[]) => t.als(wer, 'POST', '/api/maps/map_1/turn-plan', { payload: { actor: 'pc_rook', steps, nat: NAT } });
  return { t, einreichen };
}

describe('T-349: Verbündete sind passierbar', () => {
  for (const wer of ROLLEN) {
    it(`${wer}: die Lage nennt die Verbündeten und das Gelände`, async () => {
      const { t } = await aufbau();
      const l = await t.json<{ passable?: string[]; terrain?: { shape: { kind: string }; cost: number }[] }>(wer, 'GET', '/api/maps/map_1/turn-plan?actor=pc_rook&nat=1960x700');
      expect(l.passable).toEqual(['mk_mara']);
      expect(l.terrain).toEqual([{ shape: expect.objectContaining({ kind: 'rect' }), cost: 2 }]);
    });

    it(`${wer}: ein Weg durch die Verbündete nimmt er an, mit den Fuss, die er selbst zählt`, async () => {
      const { einreichen } = await aufbau();
      /* 5 durch Mara, 10 + 10 durch den Schlamm, 5 heraus. */
      const r = await einreichen(wer, [weg(0, 4, 20)]);
      expect(r.statusCode, r.body).toBe(200);
      expect(r.json().steps[0].feet).toBe(30);
      expect(r.json().text).toBe('Move 30 ft');
    });

    it(`${wer}: auf der Verbündeten enden und durch den Gegner gehen nimmt er nicht an`, async () => {
      const { einreichen } = await aufbau();
      const drauf = await einreichen(wer, [weg(0, 1)]);
      expect(drauf.statusCode).toBe(422);
      expect(drauf.json().error).toMatch(/^That path is blocked/);
      const durch = await einreichen(wer, [{ ...weg(0, 9), feet: 30 }]);
      expect(durch.statusCode).toBe(422);
    });

    it(`${wer}: zu lang durchs Gelände — abgelehnt, auch wenn die Maske weniger behauptet`, async () => {
      const { einreichen } = await aufbau();
      const r = await einreichen(wer, [weg(0, 6, 30)]);
      expect(r.statusCode).toBe(422);
      expect(r.json().error).toBe('Not enough movement for 40 ft.');
    });
  }

  it('ein Weg, der nicht beim Token anfängt, ist keiner', async () => {
    const { einreichen } = await aufbau();
    const r = await einreichen('Pia', [{ ...weg(4, 6) }]);
    expect(r.statusCode).toBe(422);
  });

  it('ohne Gitter rechnet niemand nach, statt falsch abzulehnen', async () => {
    const { t } = await aufbau();
    const r = await t.als('Pia', 'POST', '/api/maps/map_1/turn-plan', { payload: { actor: 'pc_rook', steps: [weg(0, 4, 20)] } });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().steps[0].feet).toBe(20);
  });
});

describe('T-349: versteckte Zonen', () => {
  it('zählen für die Spielerin erst, wenn sie gefunden sind — für die Leitung immer', async () => {
    const { t, einreichen } = await aufbau(true);
    const pia = await einreichen('Pia', [weg(0, 4)]);
    expect(pia.statusCode, pia.body).toBe(200);
    expect(pia.json().steps[0].feet).toBe(20);
    expect((await t.json<{ terrain?: unknown[] }>('Pia', 'GET', '/api/maps/map_1/turn-plan?actor=pc_rook&nat=1960x700')).terrain).toEqual([]);
    const gwen = await einreichen('Gwen', [weg(0, 4)]);
    expect(gwen.json().steps[0].feet).toBe(30);
  });
});

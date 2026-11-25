/**
 * **Freie Aktion mit Notiz, am Tisch** (REQ-403, T-453): die Spielerin
 * plant „Other action“ mit einer Notiz; ohne Notiz nimmt der Server sie
 * nicht an. Bestätigt die Leitung, steht die Notiz im Ergebnis, als
 * „manual“ gekennzeichnet — ohne Regelprüfung. Erfundene Artikel.
 */

import { describe, expect, it } from 'vitest';
import type { Entity } from '@nw/model';
import { tisch } from './hilfen/tisch.js';

const ident = (name: string, id: string) => ({ Identity: { name, id, aliases: [] }, Status: { status: 'ready' } });
const im = (id: string) => ({ id: `${id}_in`, type: 'inLayer', to: 'ly_a', props: {} });
const x = (feld: number) => (feld * 70 + 35) / 1960;
const NAT = { w: 1960, h: 700 };

const statblock = (id: string, name: string, wem: string, wis: number): Entity => ({
  id, name, interfaces: ['Statblock'],
  components: { ...ident(name, `statblock-${id}`), Statblock: { ac: 12, hp: 20, speed: '30 ft.', prof: 2 }, Abilities: { str: 10, dex: 12, con: 12, int: 10, wis, cha: 10 } },
  relations: [im(id), { id: `${id}_b`, type: 'belongsTo', to: wem, props: {} }],
});

function bestand(wis: number): Entity[] {
  return [
    { id: 'ly_a', name: 'ly_a', interfaces: ['Layer'], components: { ...ident('Ebene A', 'layer-0001'), Layer: { kind: 'campaign', order: 50 } }, relations: [] },
    { id: 'camp_a', name: 'Runde A', interfaces: ['Campaign'], components: { ...ident('Runde A', 'campaign-0001'), Campaign: {} },
      relations: [{ id: 'camp_a_ac', type: 'activates', to: 'ly_a', props: {} }] },
    { id: 'pc_rook', name: 'Rook', interfaces: ['PlayerCharacter'], components: ident('Rook', 'playercharacter-0001'), relations: [im('pc_rook')] },
    { id: 'cr_gob', name: 'Goblin', interfaces: ['Creature'], components: ident('Goblin', 'creature-0001'), relations: [im('cr_gob')] },
    statblock('sb_rook', 'Rook stats', 'pc_rook', wis),
    statblock('sb_gob', 'Goblin stats', 'cr_gob', 10),
    { id: 'zk_pit', name: 'Pit', interfaces: ['ZoneKind'], components: { ...ident('Pit', 'zonekind-0001'), ZoneKind: { hiddenUntil: 11, damage: '1d6', damageType: 'bludgeoning' } }, relations: [im('zk_pit')] },
    { id: 'zk_thorn', name: 'Thorns', interfaces: ['ZoneKind'], components: { ...ident('Thorns', 'zonekind-0002'), ZoneKind: { moveCost: 2 } }, relations: [im('zk_thorn')] },
    { id: 'map_1', name: 'Field', interfaces: ['Map'],
      components: { ...ident('Field', 'map-0001'), Map: { gridShape: 'square', gridSize: 70 }, Image: { image: 'https://example.org/field.png' } },
      relations: [im('map_1'),
        { id: 'mk_rook', type: 'marker', to: 'pc_rook', props: { x: x(0), y: 0.05, kind: 'play' } },
        { id: 'mk_gob', type: 'marker', to: 'cr_gob', props: { x: x(10), y: 0.05, kind: 'play', hidden: true, stealth: 12 } },
        { id: 'zn_pit', type: 'zone', to: 'zk_pit', props: { kind: 'rect', x: (12 * 70) / 1960, y: 0, w: 70 / 1960, h: 0.1 } },
        { id: 'zn_thorn', type: 'zone', to: 'zk_thorn', props: { kind: 'rect', x: (2 * 70) / 1960, y: 0, w: 70 / 1960, h: 0.1 } }] },
  ];
}

const KONTEN = {
  Gwen: { roles: { camp_a: 'gm' as const } },
  Pia: { roles: { camp_a: 'player' as const }, actorIds: ['pc_rook'] },
};

const plan = (steps: object[]) => ({ payload: { actor: 'pc_rook', steps, nat: NAT } });

describe('T-453: freie Aktion', () => {
  it('ohne Notiz: abgelehnt, mit Satz, was zu tun ist', async () => {
    const t = await tisch({ artikel: bestand(10), kampagne: 'camp_a', konten: KONTEN });
    const r = await t.als('Pia', 'POST', '/api/maps/map_1/turn-plan', plan([{ id: 'a', kind: 'act', tile: 'manual:action', name: 'Other action', cost: 'action' }]));
    expect(r.statusCode).toBe(422);
    expect(r.json().error).toBe('Say in a note what the free action does.');
  });

  it('mit Notiz: geplant, bestätigt, im Ergebnis als manual', async () => {
    const t = await tisch({ artikel: bestand(10), kampagne: 'camp_a', konten: KONTEN });
    const p = await t.als('Pia', 'POST', '/api/maps/map_1/turn-plan', plan([
      { id: 'a', kind: 'act', tile: 'manual:action', name: 'Other action', cost: 'action', note: 'Pull the lever by the gate' },
      { id: 'b', kind: 'act', tile: 'manual:bonus', name: 'x', cost: 'action', note: 'Kick the bucket over' },
    ]));
    expect(p.statusCode, p.body).toBe(200);
    expect(p.json().text).toBe('Other action (Pull the lever by the gate) → Bonus: Other bonus action (Kick the bucket over)');
    const d = await t.als('Gwen', 'POST', `/api/maps/map_1/turn-plan/${p.json().plan}/decide`, { payload: { decision: 'confirm' } });
    expect(d.statusCode, d.body).toBe(200);
    expect(d.json().results).toEqual([
      { step: 'a', text: 'Rook: Pull the lever by the gate (manual, other action)', manual: true },
      { step: 'b', text: 'Rook: Kick the bucket over (manual, other bonus action)', manual: true },
    ]);
  });

  it('verbraucht den Platz: zwei freie Aktionen sind eine zu viel', async () => {
    const t = await tisch({ artikel: bestand(10), kampagne: 'camp_a', konten: KONTEN });
    const r = await t.als('Pia', 'POST', '/api/maps/map_1/turn-plan', plan([
      { id: 'a', kind: 'act', tile: 'manual:action', note: 'One' },
      { id: 'b', kind: 'act', tile: 'manual:action', note: 'Two' },
    ]));
    expect(r.statusCode).toBe(422);
    expect(r.json().error).toBe('No action left for Other action.');
  });
});

/**
 * **Bemerken unterwegs, am Tisch** (T-350, REQ-209, REQ-208): zieht die
 * Spielerin ihre Figur an einem versteckten Goblin und an einer
 * versteckten Grube vorbei, bemerkt die Figur beide, sobald ihre passive
 * Wahrnehmung reicht — der Goblin steht danach auf der Karte, die Grube
 * ist gefunden. Wer eine Zone mit Wirkung betritt, bekommt eine Zeile.
 * Dasselbe beim freien Ziehen und im bestätigten Zugplan. Erfundene Artikel.
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

const pfad = (bis: number) => Array.from({ length: bis + 1 }, (_, i) => ({ x: i, y: 0 }));

async function karteAlsLeitung(t: Awaited<ReturnType<typeof tisch>>): Promise<Entity> {
  return t.json<Entity>('Gwen', 'GET', '/api/entities/map_1');
}

describe('T-350: frei ziehen', () => {
  it('reicht die Wahrnehmung (WIS 14 → PP 12), bemerkt Rook Goblin und Grube; Dornen sagen es beim Betreten', async () => {
    const t = await tisch({ artikel: bestand(14), kampagne: 'camp_a', konten: KONTEN });
    const r = await t.als('Pia', 'POST', '/api/maps/map_1/move', { payload: { rel: 'mk_rook', to: { x: x(4), y: 0.05 }, nat: NAT, path: pfad(4), feet: 25 } });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().seen).toEqual([
      'Rook spots Goblin (PP 12 vs 12).',
      'Rook notices Pit (PP 12 vs 11).',
      'Rook enters Thorns: difficult terrain.',
    ]);
    const k = await karteAlsLeitung(t);
    expect(k.relations!.find((r) => r.id === 'mk_gob')!.props!['hidden']).toBeUndefined();
    expect(k.relations!.find((r) => r.id === 'zn_pit')!.props!['found']).toBe(true);
  });

  it('reicht sie nicht (WIS 8 → PP 9), bleibt beides versteckt', async () => {
    const t = await tisch({ artikel: bestand(8), kampagne: 'camp_a', konten: KONTEN });
    const r = await t.als('Pia', 'POST', '/api/maps/map_1/move', { payload: { rel: 'mk_rook', to: { x: x(4), y: 0.05 }, nat: NAT, path: pfad(4), feet: 25 } });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().seen).toEqual(['Rook enters Thorns: difficult terrain.']);
    const k = await karteAlsLeitung(t);
    expect(k.relations!.find((r) => r.id === 'mk_gob')!.props!['hidden']).toBe(true);
    expect(k.relations!.find((r) => r.id === 'zn_pit')!.props!['found']).toBeUndefined();
  });
});

describe('T-350: frei ziehen ohne Felder (die Karte schickt nur das Ziel)', () => {
  it('geprüft wird vom Ziel aus', async () => {
    const t = await tisch({ artikel: bestand(14), kampagne: 'camp_a', konten: KONTEN });
    const r = await t.als('Pia', 'POST', '/api/maps/map_1/move', { payload: { rel: 'mk_rook', to: { x: x(4), y: 0.05 }, nat: NAT } });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().seen).toEqual(['Rook spots Goblin (PP 12 vs 12).', 'Rook notices Pit (PP 12 vs 11).']);
  });
});

describe('T-350: im Zugplan', () => {
  it('der bestätigte Zug sagt im Ergebnis, was Rook bemerkt', async () => {
    const t = await tisch({ artikel: bestand(14), kampagne: 'camp_a', konten: KONTEN });
    const p = await t.als('Pia', 'POST', '/api/maps/map_1/turn-plan', {
      payload: { actor: 'pc_rook', steps: [{ id: 'm', kind: 'move', path: pfad(4), feet: 25, to: { x: x(4), y: 0.05 } }], nat: NAT },
    });
    expect(p.statusCode, p.body).toBe(200);
    const d = await t.als('Gwen', 'POST', `/api/maps/map_1/turn-plan/${p.json().plan}/decide`, { payload: { decision: 'confirm' } });
    expect(d.statusCode, d.body).toBe(200);
    expect(d.json().results[0].text).toBe(
      'Moved 25 ft. Rook spots Goblin (PP 12 vs 12). Rook notices Pit (PP 12 vs 11). Rook enters Thorns: difficult terrain.',
    );
  });
});

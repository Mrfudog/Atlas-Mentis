/**
 * **Wirkungen in den Kacheln des Zugplans** (T-355): `weapon.attack` und
 * `spellAttack` an der Figur — hier von einem Zustand, wie von einem
 * Merkmal oder Ring — ändern Treffer und Schaden der Kacheln, für die
 * Leitung wie für die Spielerin. Erfundene Artikel.
 */
import { describe, expect, it } from 'vitest';
import type { Entity } from '@nw/model';
import { tisch } from './hilfen/tisch.js';

const ident = (name: string, id: string) => ({ Identity: { name, id, aliases: [] }, Status: { status: 'ready' } });
const im = (id: string) => ({ id: `${id}_in`, type: 'inLayer', to: 'ly_a', props: {} });

function bestand(mitWirkung: boolean): Entity[] {
  return [
    { id: 'ly_a', name: 'ly_a', interfaces: ['Layer'], components: { ...ident('Ebene A', 'layer-0001'), Layer: { kind: 'campaign', order: 50 } }, relations: [] },
    { id: 'camp_a', name: 'Runde A', interfaces: ['Campaign'], components: { ...ident('Runde A', 'campaign-0001'), Campaign: {} },
      relations: [{ id: 'camp_a_ac', type: 'activates', to: 'ly_a', props: {} }] },
    { id: 'at_action', name: 'Action', interfaces: ['ActionType'], components: ident('Action', 'actiontype-0001'), relations: [im('at_action')] },
    { id: 'ac_bow', name: 'Shortbow', interfaces: ['Action'],
      components: { ...ident('Shortbow', 'action-0001'), Action: { actionType: 'at_action', attack: ['ranged weapon'], ability: 'dex', damageDice: '1d6', damageType: 'piercing', range: '80/320' } },
      relations: [im('ac_bow')] },
    { id: 'ac_bolt', name: 'Fire Bolt', interfaces: ['Action'],
      components: { ...ident('Fire Bolt', 'action-0002'), Action: { actionType: 'at_action', attack: ['ranged spell'], ability: 'int', damageDice: '1d10', damageType: 'fire', range: '120' } },
      relations: [im('ac_bolt')] },
    { id: 'cd_mark', name: 'Marked', interfaces: ['Condition'],
      components: { ...ident('Marked', 'condition-0001'), Effects: { effects: [
        { id: 'wa', target: 'weapon.attack', op: 'add', value: 2 },
        { id: 'sa', target: 'spellAttack', op: 'add', value: 1 },
        { id: 'sd', target: 'spellDamage', op: 'add', value: 3 },
      ] } }, relations: [im('cd_mark')] },
    { id: 'pc_rook', name: 'Rook', interfaces: ['PlayerCharacter'],
      components: { ...ident('Rook', 'playercharacter-0001'), ...(mitWirkung ? { Vitals: { conditions: ['cd_mark'] } } : {}) }, relations: [im('pc_rook')] },
    { id: 'sb_rook', name: 'Rook stats', interfaces: ['Statblock'],
      components: { ...ident('Rook stats', 'statblock-0001'), Statblock: { ac: 14, hp: 20, speed: '30 ft.', prof: 2 }, Abilities: { str: 10, dex: 16, con: 14, int: 14, wis: 10, cha: 8 } },
      relations: [im('sb_rook'), { id: 'sb_rook_b', type: 'belongsTo', to: 'pc_rook', props: {} },
        { id: 'sb_rook_c1', type: 'composedOf', to: 'ac_bow', props: {} }, { id: 'sb_rook_c2', type: 'composedOf', to: 'ac_bolt', props: {} }] },
    { id: 'map_1', name: 'Field', interfaces: ['Map'],
      components: { ...ident('Field', 'map-0001'), Map: { gridShape: 'square', gridSize: 70 }, Image: { image: 'https://example.org/field.png' } },
      relations: [im('map_1'), { id: 'mk_rook', type: 'marker', to: 'pc_rook', props: { x: 0.02, y: 0.05, kind: 'play' } }] },
  ];
}

const KONTEN = {
  Gwen: { roles: { camp_a: 'gm' as const } },
  Pia: { roles: { camp_a: 'player' as const }, actorIds: ['pc_rook'] },
};

describe('T-355: Wirkungen an den Kacheln', () => {
  for (const wer of ['Gwen', 'Pia']) {
    it(`${wer}: Bogen +2 zum Treffen, Feuerpfeil +1 und +3 Schaden`, async () => {
      const lies = async (mit: boolean) => {
        const t = await tisch({ artikel: bestand(mit), kampagne: 'camp_a', konten: KONTEN });
        const l = await t.json<{ tiles: { id: string; toHit: number | null; damage: string }[] }>(wer, 'GET', '/api/maps/map_1/turn-plan?actor=pc_rook');
        return Object.fromEntries(l.tiles.filter((x) => x.id.startsWith('ac_')).map((x) => [x.id, [x.toHit, x.damage]]));
      };
      expect(await lies(false)).toEqual({ ac_bow: [5, '1d6 + 3'], ac_bolt: [4, '1d10 + 2'] });
      expect(await lies(true)).toEqual({ ac_bow: [7, '1d6 + 3'], ac_bolt: [5, '1d10 + 5'] });
    });
  }
});

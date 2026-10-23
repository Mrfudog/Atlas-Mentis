/**
 * **Ausrüsten in die Hände** (T-244): die Spielerin schreibt die Hände
 * ihrer Figur — Platz und Griff an der Kante `holds` —, die Leitung liest
 * denselben Stand, ein Zuschauer schreibt nichts. Was die Hände sperren,
 * rechnet dasselbe Modell aus dem, was der Server zurückgibt.
 */
import { describe, expect, it } from 'vitest';
import { applyWield, handState, heldPlaceOf, turnActions, turnRows, wieldPlan, type Entity, type HeldItem } from '@nw/model';
import { tisch } from './hilfen/tisch.js';

const ident = (name: string, id: string) => ({ Identity: { name, id, aliases: [] }, Status: { status: 'ready' } });
const inL = (id: string) => ({ id: `${id}~l`, type: 'inLayer', to: 'ly_a', props: {} });

const BESTAND: Entity[] = [
  { id: 'ly_a', name: 'A', interfaces: ['Layer'], components: { ...ident('Ebene A', 'layer-0001'), Layer: { kind: 'campaign', order: 50 } }, relations: [] },
  { id: 'camp_a', name: 'Runde A', interfaces: ['Campaign'], components: ident('Runde A', 'campaign-0001'),
    relations: [{ id: 'camp_a_ac', type: 'activates', to: 'ly_a', props: {} }] },
  { id: 'pc_rook', name: 'Rook', interfaces: ['PlayerCharacter'], components: { ...ident('Rook', 'playercharacter-0001'), PlayerCharacter: {} },
    relations: [inL('pc_rook'), { id: 'pc_rook_c', type: 'carries', to: 'inv_rook', props: {} }] },
  { id: 'inv_rook', name: 'Rook’s things', interfaces: ['Inventory'], components: ident('Rook’s things', 'inventory-0001'),
    relations: [
      inL('inv_rook'),
      { id: 'h_staff', type: 'holds', to: 'it_staff', props: { slot: 'mainHand', grip: 'two', tier: 'held' } },
      { id: 'h_shield', type: 'holds', to: 'it_shield', props: { gx: 0, gy: 0, tier: 'pack' } },
    ] },
  { id: 'it_staff', name: 'Quarterstaff', interfaces: ['Item', 'Weapon'], components: { ...ident('Quarterstaff', 'item-0001'), Item: { itemType: 'melee weapon' }, Weapon: { damage: '1d6', damage2: '1d8' } }, relations: [inL('it_staff')] },
  { id: 'it_shield', name: 'Shield', interfaces: ['Item'], components: { ...ident('Shield', 'item-0002'), Item: { itemType: 'shield' } }, relations: [inL('it_shield')] },
];

const aufbau = () =>
  tisch({
    kampagne: 'camp_a',
    artikel: BESTAND,
    konten: {
      Mira: { roles: { camp_a: 'gm' } },
      Sela: { roles: { camp_a: 'player' }, actorIds: ['pc_rook'] },
      Zaun: { roles: { camp_a: 'spectator' } },
    },
  });

const staff: HeldItem = { id: 'h_staff', name: 'Quarterstaff', slot: 'both', properties: ['versatile'], proficient: true, damage: '1d6', damage2: '1d8' };
const shield = { id: 'h_shield', name: 'Shield', properties: [], shield: true, proficient: false };

describe('equipping hands (T-244)', () => {
  it('a player puts the shield in the off hand; the staff goes to one hand; the GM reads the same', async () => {
    const t = await aufbau();
    const inv = await t.json<Entity>('Sela', 'GET', '/api/entities/inv_rook');
    const plan = wieldPlan([staff], shield, 'offHand');
    expect(plan.regrip?.id).toBe('h_staff');
    const relations = applyWield(inv.relations ?? [], { edgeId: 'h_shield', plan, newId: 'x', displacedTo: 'stow', edgeOf: (id) => id, grid: true });
    const { refs: _r, ...rein } = inv as Entity & { refs?: unknown };
    const put = await t.als('Sela', 'PUT', '/api/entities/inv_rook', { payload: { ...rein, relations } });
    expect(put.statusCode).toBe(200);

    for (const wer of ['Sela', 'Mira']) {
      const nach = await t.json<Entity>(wer, 'GET', '/api/entities/inv_rook');
      const h = (id: string) => nach.relations?.find((r) => r.id === id)?.props as Record<string, unknown>;
      expect(heldPlaceOf(h('h_shield'))).toBe('offHand');
      expect(h('h_shield')['gx']).toBeUndefined();
      expect(heldPlaceOf(h('h_staff'))).toBe('mainHand');
    }
  });

  it('what the hands then block shows in Your turn, with the reason', () => {
    const hands = handState([{ ...staff, slot: 'mainHand' }, { ...shield, slot: 'offHand' }]);
    const rows = turnRows(turnActions({ hands, spells: [{ id: 'sp', name: 'Mage Hand', level: 0, actionTypeName: 'Action', components: ['V', 'S'] }] }), hands);
    expect(rows.find((r) => r.id === 'sp')!.lock).toMatch(/shield without training/);
  });

  it('a spectator cannot change the hands', async () => {
    const t = await aufbau();
    const inv = await t.json<Entity>('Mira', 'GET', '/api/entities/inv_rook');
    const { refs: _r, ...rein } = inv as Entity & { refs?: unknown };
    const relations = (inv.relations ?? []).map((r) => (r.id === 'h_staff' ? { ...r, props: { tier: 'ground' } } : r));
    const put = await t.als('Zaun', 'PUT', '/api/entities/inv_rook', { payload: { ...rein, relations } });
    expect(put.statusCode).toBeGreaterThanOrEqual(400);
    const nach = await t.json<Entity>('Mira', 'GET', '/api/entities/inv_rook');
    expect(heldPlaceOf(nach.relations?.find((r) => r.id === 'h_staff')?.props)).toBe('both');
  });
});

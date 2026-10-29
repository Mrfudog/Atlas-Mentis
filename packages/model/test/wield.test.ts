import { describe, expect, it } from 'vitest';
import {
  applyWield,
  dropProps,
  handChecks,
  handCost,
  handSummary,
  heldDetail,
  handRule,
  handState,
  heldPlaceOf,
  stowProps,
  stowSpots,
  turnActions,
  wieldItemOf,
  wieldOptions,
  wieldPlan,
  type HeldItem,
  type Relation,
  type WieldItem,
} from '../src/index.js';

const rapier: WieldItem = { id: 'rapier', name: 'Rapier', properties: ['finesse'], proficient: true, damage: '1d8' };
const staff: WieldItem = { id: 'staff', name: 'Quarterstaff', properties: ['versatile'], proficient: true, damage: '1d6', damage2: '1d8' };
const bow: WieldItem = { id: 'bow', name: 'Shortbow', properties: ['two-handed', 'ammunition'], ranged: true, proficient: true, damage: '1d6' };
const shield: WieldItem = { id: 'shield', name: 'Shield', properties: [], shield: true, proficient: false };
const dagger: WieldItem = { id: 'dagger', name: 'Dagger', properties: ['light', 'finesse'], proficient: true, damage: '1d4' };
const mail: WieldItem = { id: 'mail', name: 'Chain mail', properties: [], worn: true, proficient: true };
const pouch: WieldItem = { id: 'pouch', name: 'Arcane focus', properties: [], focus: true, proficient: true };

const in_ = (it: WieldItem, slot: HeldItem['slot']): HeldItem => ({ ...it, slot });

describe('heldPlaceOf', () => {
  it('reads slot and grip from the edge', () => {
    expect(heldPlaceOf({ slot: 'mainHand' })).toBe('mainHand');
    expect(heldPlaceOf({ slot: 'mainHand', grip: 'two' })).toBe('both');
    expect(heldPlaceOf({ slot: 'offHand' })).toBe('offHand');
    expect(heldPlaceOf({ tier: 'held' })).toBe('mainHand');
    expect(heldPlaceOf({ slot: 'belt' })).toBeNull();
    expect(heldPlaceOf({ tier: 'pack', gx: 1 })).toBeNull();
    expect(heldPlaceOf(null)).toBeNull();
  });
});

describe('handRule', () => {
  it('lets a shield only on the off hand', () => {
    expect(handRule(shield, 'offHand')).toBe('');
    expect(handRule(shield, 'mainHand')).toMatch(/off hand/);
    expect(handRule(shield, 'both')).toMatch(/off hand/);
  });
  it('takes both hands only for two-handed or versatile', () => {
    expect(handRule(staff, 'both')).toBe('');
    expect(handRule(bow, 'both')).toBe('');
    expect(handRule(rapier, 'both')).toMatch(/two-handed or versatile/);
  });
  it('keeps a two-handed weapon out of the off hand alone', () => {
    expect(handRule(bow, 'offHand')).toMatch(/both hands/);
    expect(handRule(bow, 'mainHand')).toBe('');
  });
  it('does not hold armour', () => {
    expect(handRule(mail, 'mainHand')).toMatch(/worn/);
  });
});

describe('wieldPlan', () => {
  it('needs nothing to move into free hands', () => {
    expect(wieldPlan([], rapier, 'mainHand')).toEqual({ why: '', place: 'mainHand', displaced: [], regrip: null });
  });
  it('displaces what holds the hand', () => {
    const p = wieldPlan([in_(dagger, 'mainHand')], rapier, 'mainHand');
    expect(p.displaced.map((h) => h.id)).toEqual(['dagger']);
  });
  it('puts a two-handed weapon in both hands and moves both out', () => {
    const p = wieldPlan([in_(rapier, 'mainHand'), in_(shield, 'offHand')], bow, 'mainHand');
    expect(p.place).toBe('both');
    expect(p.displaced.map((h) => h.id)).toEqual(['rapier', 'shield']);
  });
  it('regrips a versatile weapon to one hand when the off hand is needed', () => {
    const p = wieldPlan([in_(staff, 'both')], shield, 'offHand');
    expect(p.displaced).toEqual([]);
    expect(p.regrip?.id).toBe('staff');
  });
  it('moves a two-handed weapon out when the off hand is needed', () => {
    const p = wieldPlan([in_(bow, 'mainHand')], shield, 'offHand');
    expect(p.displaced.map((h) => h.id)).toEqual(['bow']);
    expect(p.regrip).toBeNull();
  });
  it('only changes the hand of an item already held', () => {
    const p = wieldPlan([in_(staff, 'mainHand')], staff, 'both');
    expect(p).toEqual({ why: '', place: 'both', displaced: [], regrip: null });
  });
  it('gives the reason and moves nothing when the rule says no', () => {
    const p = wieldPlan([in_(rapier, 'mainHand')], shield, 'mainHand');
    expect(p.why).toMatch(/off hand/);
    expect(p.displaced).toEqual([]);
  });
});

describe('applyWield', () => {
  const rel = (id: string, to: string, props: Record<string, unknown>): Relation => ({ id, type: 'holds', to, props });
  const edgeOf = (id: string) => `e-${id}`;

  it('takes an item out of the grid into the hand', () => {
    const r = [rel('e-rapier', 'rapier', { gx: 1, gy: 0, rot: 0, tier: 'pack' })];
    const out = applyWield(r, { edgeId: 'e-rapier', plan: wieldPlan([], rapier, 'mainHand'), newId: 'n', displacedTo: 'stow', edgeOf, grid: true });
    expect(out[0]!.props).toEqual({ rot: 0, tier: 'held', slot: 'mainHand' });
  });
  it('splits one piece off a stack', () => {
    const r = [rel('e-dagger', 'dagger', { gx: 0, gy: 0, qty: 3, tier: 'pack' })];
    const out = applyWield(r, { edgeId: 'e-dagger', plan: wieldPlan([], dagger, 'offHand'), newId: 'n1', displacedTo: 'stow', edgeOf, grid: true });
    expect(out).toHaveLength(2);
    expect(out[0]!.props).toMatchObject({ qty: 2, gx: 0 });
    expect(out[1]).toMatchObject({ id: 'n1', to: 'dagger', props: { qty: 1, slot: 'offHand', tier: 'held' } });
  });
  it('stows the displaced item at its spot, or sets it aside without one', () => {
    const held = [in_(dagger, 'mainHand'), in_(shield, 'offHand')];
    const r = [
      rel('e-bow', 'bow', { gx: 0, gy: 0 }),
      rel('e-dagger', 'dagger', { slot: 'mainHand', tier: 'held' }),
      rel('e-shield', 'shield', { slot: 'offHand', tier: 'held' }),
    ];
    const out = applyWield(r, {
      edgeId: 'e-bow', plan: wieldPlan(held, bow, 'mainHand'), newId: 'n', displacedTo: 'stow', edgeOf, grid: true,
      spots: { 'e-dagger': { gx: 3, gy: 1, rot: 90 }, 'e-shield': null },
    });
    expect(out[0]!.props).toEqual({ slot: 'mainHand', tier: 'held', grip: 'two' });
    expect(out[1]!.props).toEqual({ tier: 'pack', gx: 3, gy: 1, rot: 90 });
    expect(out[2]!.props).toEqual({ tier: 'pack', unstowed: true });
  });
  it('drops the displaced item', () => {
    const r = [rel('e-rapier', 'rapier', { gx: 0, gy: 0 }), rel('e-dagger', 'dagger', { slot: 'mainHand', tier: 'held' })];
    const out = applyWield(r, { edgeId: 'e-rapier', plan: wieldPlan([in_(dagger, 'mainHand')], rapier, 'mainHand'), newId: 'n', displacedTo: 'ground', edgeOf, grid: true });
    expect(out[1]!.props).toEqual({ tier: 'ground' });
  });
  it('regrips instead of moving the versatile weapon', () => {
    const r = [rel('e-shield', 'shield', { gx: 0, gy: 0 }), rel('e-staff', 'staff', { slot: 'mainHand', grip: 'two', tier: 'held' })];
    const out = applyWield(r, { edgeId: 'e-shield', plan: wieldPlan([in_(staff, 'both')], shield, 'offHand'), newId: 'n', displacedTo: 'stow', edgeOf, grid: true });
    expect(out[1]!.props).toEqual({ slot: 'mainHand', tier: 'held' });
    expect(out[0]!.props).toEqual({ slot: 'offHand', tier: 'held' });
  });
  it('changes nothing when the plan says no', () => {
    const r = [rel('e-shield', 'shield', { gx: 0, gy: 0 })];
    expect(applyWield(r, { edgeId: 'e-shield', plan: wieldPlan([], shield, 'mainHand'), newId: 'n', displacedTo: 'stow', edgeOf, grid: true })).toEqual(r);
  });
});

describe('stowProps, dropProps, stowSpots', () => {
  it('stows without a grid by clearing the hand only', () => {
    expect(stowProps({ slot: 'mainHand', tier: 'held', grip: 'two' }, null, false)).toEqual({ tier: 'pack' });
  });
  it('drops to the ground and forgets the grid', () => {
    expect(dropProps({ slot: 'offHand', gx: 1, gy: 1, unstowed: true, qty: 2 })).toEqual({ qty: 2, tier: 'ground' });
  });
  it('finds spots one after the other and counts what leaves the grid', () => {
    const box = { w: 2, h: 1, rows: ['##'] };
    const lie = [{ key: 'a', rows: ['#'], gx: 0, gy: 0 }];
    const s1 = stowSpots(box, lie, [{ key: 'b', rows: ['#'] }, { key: 'c', rows: ['#'] }]);
    expect(s1).toEqual({ b: { gx: 1, gy: 0, rot: 0 }, c: null });
    const s2 = stowSpots(box, lie, [{ key: 'b', rows: ['#'] }, { key: 'c', rows: ['#'] }], ['a']);
    expect(s2['b']).not.toBeNull();
    expect(s2['c']).not.toBeNull();
  });
});

describe('wieldOptions', () => {
  it('marks ✓, ⚠ and ✗ for every target', () => {
    const held = [in_(rapier, 'mainHand')];
    const o = wieldOptions(held, shield, { hand: null, inGrid: true, unstowed: false, ground: false }, true);
    const by = Object.fromEntries(o.map((x) => [x.target, x]));
    expect(by['offHand']).toMatchObject({ ok: true, displaces: [] });
    expect(by['mainHand']).toMatchObject({ ok: false, why: expect.stringMatching(/off hand/) });
    expect(by['stow']).toMatchObject({ here: true, ok: false });
    expect(by['ground']).toMatchObject({ ok: true });
    const o2 = wieldOptions(held, dagger, { hand: null, inGrid: true, unstowed: false, ground: false }, true);
    expect(o2.find((x) => x.target === 'mainHand')!.displaces).toEqual(['Rapier']);
  });
  it('says there is no room in the grid', () => {
    const o = wieldOptions([in_(rapier, 'mainHand')], rapier, { hand: 'mainHand', inGrid: false, unstowed: false, ground: false }, false);
    expect(o.find((x) => x.target === 'stow')).toMatchObject({ ok: false, why: expect.stringMatching(/no room/) });
    expect(o.find((x) => x.target === 'mainHand')).toMatchObject({ here: true, ok: false });
  });
  it('without a grid, stowing is always possible', () => {
    const o = wieldOptions([], rapier, { hand: 'mainHand', inGrid: false, unstowed: false, ground: false }, null);
    expect(o.find((x) => x.target === 'stow')).toMatchObject({ ok: true, here: false });
  });
});

describe('handChecks', () => {
  it('blocks spellcasting with full hands and says why', () => {
    const c = handChecks(handState([in_(rapier, 'mainHand'), in_(shield, 'offHand')]));
    expect(c.find((x) => x.key === 'cast')).toMatchObject({ state: 'no', text: expect.stringMatching(/shield without training/) });
    expect(c.find((x) => x.key === 'shield')).toMatchObject({ state: 'no' });
    expect(c.find((x) => x.key === 'hand')).toMatchObject({ state: 'no' });
  });
  it('lets the focus in hand cover the components', () => {
    const c = handChecks(handState([in_(rapier, 'mainHand'), in_(pouch, 'offHand')]));
    expect(c.find((x) => x.key === 'cast')).toMatchObject({ state: 'ok', text: expect.stringMatching(/focus/) });
  });
  it('checks the off-hand weapon and sneak attack', () => {
    const c = handChecks(handState([in_(rapier, 'mainHand'), in_(dagger, 'offHand')]), { sneakAttack: true });
    expect(c.find((x) => x.key === 'offhand')).toMatchObject({ state: 'ok' });
    expect(c.find((x) => x.key === 'sneak')).toMatchObject({ state: 'ok', text: expect.stringMatching(/finesse/) });
    const c2 = handChecks(handState([in_(staff, 'both')]), { sneakAttack: true });
    expect(c2.find((x) => x.key === 'sneak')).toMatchObject({ state: 'no' });
    const c3 = handChecks(handState([in_(bow, 'mainHand')]), { sneakAttack: true });
    expect(c3.find((x) => x.key === 'sneak')!.text).toMatch(/ranged/);
  });
  it('shows a trained shield as fine', () => {
    const c = handChecks(handState([in_({ ...shield, proficient: true }, 'offHand')]));
    expect(c.find((x) => x.key === 'shield')).toMatchObject({ state: 'ok' });
    expect(c.find((x) => x.key === 'cast')).toMatchObject({ state: 'ok' });
  });
});

describe('wieldItemOf', () => {
  const art = (components: Record<string, unknown>) => ({ id: 'x', components }) as never;
  it('reads shield, focus, armour and ranged from the item', () => {
    const p = () => false;
    expect(wieldItemOf(art({ Item: { itemType: 'shield' } }), { id: 'x', name: 'S', mechanics: [], proficient: p })).toMatchObject({ shield: true, proficient: false });
    expect(wieldItemOf(art({ Item: { itemType: 'wand' } }), { id: 'x', name: 'W', mechanics: [], proficient: p }).focus).toBe(true);
    expect(wieldItemOf(art({ Item: { itemType: 'heavy armor' } }), { id: 'x', name: 'A', mechanics: [], proficient: p }).worn).toBe(true);
    const bogen = wieldItemOf(art({ Item: { itemType: 'ranged weapon' }, Weapon: { category: 'simple', damage: '1d6' } }), {
      id: 'x', name: 'Shortbow', mechanics: ['two-handed'], proficient: (w) => w === 'simple',
    });
    expect(bogen).toMatchObject({ ranged: true, proficient: true, damage: '1d6', properties: ['two-handed'] });
  });
  it('takes the versatile die from the edge before the weapon card (T-324)', () => {
    const p = () => true;
    const stab = art({ Weapon: { damage: '1d6', damage2: '1d8' } });
    expect(wieldItemOf(stab, { id: 'x', name: 'Q', mechanics: ['versatile'], proficient: p }).damage2).toBe('1d8');
    expect(wieldItemOf(stab, { id: 'x', name: 'Q', mechanics: ['versatile'], versatileDamage: '1d10', proficient: p }).damage2).toBe('1d10');
  });
  it('is not proficient without the group or the weapon', () => {
    const w = wieldItemOf(art({ Weapon: { category: 'martial' } }), { id: 'x', name: 'Battleaxe', mechanics: [], proficient: () => false });
    expect(w.proficient).toBe(false);
  });
});

describe('turnActions with an untrained shield', () => {
  it('says the attack has disadvantage', () => {
    const a = turnActions({ hands: handState([in_(rapier, 'mainHand'), in_(shield, 'offHand')]) });
    expect(a.find((x) => x.id === 'rule:attack')!.does).toMatch(/disadvantage/);
  });
});

describe('heldDetail, handCost, handSummary', () => {
  it('shows the damage of the grip', () => {
    expect(heldDetail(in_(staff, 'mainHand'), false)).toBe('1d6 · one hand (two: 1d8)');
    expect(heldDetail(in_(staff, 'both'), true)).toBe('1d8 · two hands');
    expect(heldDetail(in_(bow, 'both'), true)).toBe('1d6 · two-handed');
    expect(heldDetail(in_(dagger, 'offHand'), false)).toBe('1d4 · light · finesse');
  });
  it('says what an untrained shield costs and what a focus covers', () => {
    expect(heldDetail(in_(shield, 'offHand'), false)).toMatch(/no training/);
    expect(heldDetail(in_({ ...shield, proficient: true }, 'offHand'), false)).toMatch(/AC bonus/);
    expect(heldDetail(in_(pouch, 'offHand'), false)).toMatch(/focus/);
    expect(handCost(in_(shield, 'offHand'))).toMatch(/action/);
    expect(handCost(null)).toMatch(/object interaction/);
    /* T-350: die Kampagne sagt, was Verstauen und Fallenlassen kosten (`handActions`). */
    expect(handCost(null, { drop: 'free action', stow: 'bonus action' })).toBe('stow: bonus action · drop: free action');
    expect(handCost(null, { drop: null, stow: null })).toMatch(/object interaction/);
    expect(handCost(in_(shield, 'offHand'), { drop: 'free action', stow: 'bonus action' })).toMatch(/action to don/);
  });
  it('sums up the hands', () => {
    expect(handSummary(handState([]))).toBe('Both hands free');
    expect(handSummary(handState([in_(rapier, 'mainHand')]))).toBe('One hand free');
    expect(handSummary(handState([in_(rapier, 'mainHand'), in_(shield, 'offHand')]))).toBe('Both hands full');
    expect(handSummary(handState([in_(staff, 'both')]))).toBe('Both hands on the Quarterstaff');
  });
});

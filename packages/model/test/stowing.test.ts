import { describe, expect, it } from 'vitest';
import {
  arriveUnstowed,
  isUnstowed,
  leaveBehind,
  moveHeld,
  pickUp,
  reservationBreaches,
  stowingRuleOf,
  tableMovedOn,
  type Entity,
} from '../src/index.js';

/* Nicht verstaut, liegengelassen (T-140). Erfundene Artikel. */

const inv = (id: string, relations: Entity['relations'] = []): Entity => ({ id, interfaces: ['Inventory'], components: {}, relations });
let n = 0;
const neu = () => `neu-${++n}`;

describe('stowingRuleOf', () => {
  it('liest Campaign.stowing, ohne Angabe beliebig lange', () => {
    expect(stowingRuleOf(null)).toBe('anytime');
    expect(stowingRuleOf({ id: 'k', interfaces: ['Campaign'], components: { Campaign: { stowing: 'bySessionEnd' } } })).toBe('bySessionEnd');
    expect(stowingRuleOf({ id: 'k', interfaces: ['Campaign'], components: { Campaign: { stowing: 'quatsch' } } })).toBe('anytime');
  });
});

describe('arriveUnstowed', () => {
  it('macht eine neue Kante unverstaut und nimmt ihr die Lage', () => {
    const vor = inv('i');
    const nach = inv('i', [{ id: 'h', type: 'holds', to: 'seil', props: { qty: 1, tier: 'pack', gx: 0, gy: 0 } }]);
    const r = arriveUnstowed(vor, nach, neu);
    expect(r.relations![0]!.props).toEqual({ qty: 1, tier: 'pack', unstowed: true });
  });

  it('lässt einen verstauten Stapel, wie er war, und legt den Zuwachs daneben', () => {
    const vor = inv('i', [{ id: 'h', type: 'holds', to: 'pfeil', props: { qty: 10 } }]);
    const nach = inv('i', [{ id: 'h', type: 'holds', to: 'pfeil', props: { qty: 30 } }]);
    const r = arriveUnstowed(vor, nach, () => 'h2');
    expect(r.relations).toEqual([
      { id: 'h', type: 'holds', to: 'pfeil', props: { qty: 10 } },
      { id: 'h2', type: 'holds', to: 'pfeil', props: { qty: 20, tier: 'pack', unstowed: true } },
    ]);
  });

  it('legt den Zuwachs auf einen Stapel, der schon unverstaut daliegt', () => {
    const vor = inv('i', [
      { id: 'h', type: 'holds', to: 'pfeil', props: { qty: 10 } },
      { id: 'u', type: 'holds', to: 'pfeil', props: { qty: 5, unstowed: true } },
    ]);
    const nach = inv('i', [
      { id: 'h', type: 'holds', to: 'pfeil', props: { qty: 12 } },
      { id: 'u', type: 'holds', to: 'pfeil', props: { qty: 5, unstowed: true } },
    ]);
    const r = arriveUnstowed(vor, nach, neu);
    expect(r.relations!.map((k) => [k.id, k.props?.['qty']])).toEqual([['h', 10], ['u', 7]]);
  });
});

describe('moveHeld und Unverstautes', () => {
  it('bleibt unverstaut beim Wechsel des Trägers, verstaut in einen Behälter', () => {
    const a = inv('a', [{ id: 'h', type: 'holds', to: 'seil', props: { qty: 1, unstowed: true } }]);
    const b = inv('b');
    const r1 = moveHeld(a, b, 'h', { newId: 'x' });
    expect('to' in r1 && isUnstowed(r1.to.relations![0])).toBe(true);
    const r2 = moveHeld(a, b, 'h', { newId: 'x', stow: true });
    expect('to' in r2 && isUnstowed(r2.to.relations![0])).toBe(false);
  });

  it('stapelt nur auf einen Stapel im selben Zustand', () => {
    const a = inv('a', [{ id: 'h', type: 'holds', to: 'seil', props: { qty: 1, unstowed: true } }]);
    const b = inv('b', [{ id: 'v', type: 'holds', to: 'seil', props: { qty: 2 } }]);
    const r = moveHeld(a, b, 'h', { newId: 'x' });
    expect('to' in r && r.to.relations!.map((k) => k.id)).toEqual(['v', 'x']);
  });

  it('Verstauen eines reservierten Stücks ist kein Bruch der Reservierung', () => {
    const vor = inv('a', [{ id: 'h', type: 'holds', to: 'erz', props: { qty: 1, unstowed: true, reservedFor: 'auftrag' } }]);
    const nach = inv('a', [{ id: 'h', type: 'holds', to: 'erz', props: { qty: 1, reservedFor: 'auftrag', gx: 0, gy: 0 } }]);
    expect(reservationBreaches(vor, nach, () => true)).toEqual([]);
  });
});

describe('leaveBehind und pickUp', () => {
  const sitzung: Entity = { id: 's', interfaces: ['Session'], components: {}, relations: [] };

  it('nimmt Unverstautes aus den Inventaren und hängt es an die Sitzung — Reserviertes bleibt', () => {
    const a = inv('a', [
      { id: 'h1', type: 'holds', to: 'seil', props: { qty: 2, unstowed: true } },
      { id: 'h2', type: 'holds', to: 'fackel', props: { qty: 1 } },
      { id: 'h3', type: 'holds', to: 'erz', props: { qty: 1, unstowed: true, reservedFor: 'auftrag' } },
    ]);
    const b = inv('b', [{ id: 'h4', type: 'holds', to: 'fackel', props: { qty: 1 } }]);
    const r = leaveBehind(sitzung, [a, b], { at: '2026-10-14T22:00:00Z', newId: () => 'lb' });
    expect(r.left).toEqual([{ inventory: 'a', edge: 'h1', item: 'seil', qty: 2 }]);
    expect(r.inventories.map((i) => [i.id, i.relations!.map((k) => k.id)])).toEqual([['a', ['h2', 'h3']]]);
    expect(r.session.relations).toEqual([
      { id: 'lb', type: 'leftBehind', to: 'seil', props: { qty: 2, from: 'a', at: '2026-10-14T22:00:00Z' } },
    ]);
  });

  it('ändert nichts, wenn nichts unverstaut ist', () => {
    const r = leaveBehind(sitzung, [inv('a', [{ id: 'h', type: 'holds', to: 'x', props: {} }])], { at: 'x', newId: neu });
    expect(r).toMatchObject({ inventories: [], left: [] });
    expect(r.session).toBe(sitzung);
  });

  it('hebt auf: die Kante geht, der Stapel liegt wieder unverstaut da', () => {
    const s: Entity = { ...sitzung, relations: [{ id: 'lb', type: 'leftBehind', to: 'seil', props: { qty: 2, from: 'a' } }] };
    const r = pickUp(s, inv('b', [{ id: 'u', type: 'holds', to: 'seil', props: { qty: 1, unstowed: true } }]), 'lb', 'neu');
    expect('session' in r && r.session.relations).toEqual([]);
    expect('inventory' in r && r.inventory.relations).toEqual([{ id: 'u', type: 'holds', to: 'seil', props: { qty: 3, unstowed: true } }]);
    expect(pickUp(s, inv('b'), 'fehlt', 'neu')).toEqual({ refused: 'missing' });
  });
});

describe('tableMovedOn', () => {
  const s = (st: Record<string, unknown>): Entity => ({ id: 's', interfaces: ['Session'], components: { Session: st } });
  it('zählt einen Wechsel von Szene, Kampf oder Karte, auch auf leer — nicht das erste Setzen', () => {
    expect(tableMovedOn(s({ activeScene: 'a' }), s({ activeScene: 'b' }))).toBe(true);
    expect(tableMovedOn(s({ activeEncounter: 'k' }), s({}))).toBe(true);
    expect(tableMovedOn(s({}), s({ activeMap: 'm' }))).toBe(false);
    expect(tableMovedOn(s({ activeMap: 'm', nowPlaying: 'x' }), s({ activeMap: 'm', nowPlaying: 'y' }))).toBe(false);
    expect(tableMovedOn(null, s({ activeScene: 'a' }))).toBe(false);
  });
});

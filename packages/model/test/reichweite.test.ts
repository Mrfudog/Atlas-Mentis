import { describe, expect, it } from 'vitest';
import { attackRollMode, NEAR_FEET } from '../src/actions.js';
import { hitChance, rangeBand } from '../src/zugplan.js';
import { creatureStats } from '../src/stats.js';
import type { Entity } from '../src/types.js';

/*
 * **Reichweite, lange Reichweite und Zustände** (T-351): dieselbe Rechnung
 * für Maske und Server — wo ein Ziel liegt, wie gewürfelt wird, und dass
 * die Wirkungen eines Zustandsartikels dort ankommen.
 */

describe('rangeBand', () => {
  const bogen = { range: 80, longRange: 320 };
  const axt = { range: 5, longRange: null };

  it('bis zur Reichweite normal, bis zur langen lang, darüber ausser Reichweite', () => {
    expect(rangeBand(bogen, 0)).toBe('normal');
    expect(rangeBand(bogen, 80)).toBe('normal');
    expect(rangeBand(bogen, 85)).toBe('long');
    expect(rangeBand(bogen, 320)).toBe('long');
    expect(rangeBand(bogen, 325)).toBe('out');
  });

  it('ohne lange Reichweite ist dahinter gleich ausser Reichweite', () => {
    expect(rangeBand(axt, 5)).toBe('normal');
    expect(rangeBand(axt, 10)).toBe('out');
  });

  it('ohne Abstand oder ohne Reichweite: null — dann prüft niemand', () => {
    expect(rangeBand(bogen, null)).toBeNull();
    expect(rangeBand(bogen, undefined)).toBeNull();
    expect(rangeBand(bogen, Number.NaN)).toBeNull();
    expect(rangeBand({ range: null, longRange: null }, 10)).toBeNull();
  });
});

describe('attackRollMode', () => {
  it('ohne Wirkung und auf kurzer Reichweite: normal', () => {
    expect(attackRollMode({}, {})).toEqual({ mode: undefined, why: [] });
  });

  it('lange Reichweite gibt Nachteil', () => {
    expect(attackRollMode({}, {}, { long: true })).toEqual({ mode: 'dis', why: ['long range'] });
  });

  it('Vorteil und Nachteil heben sich auf, wie viele es auch sind', () => {
    const r = attackRollMode({ attack: ['advantage'] }, { attacked: ['disadvantage', 'disadvantage'] }, { long: true });
    expect(r.mode).toBeUndefined();
    expect(r.why).toEqual(['long range', 'advantage (attacker)', 'disadvantage (target)']);
  });

  it('nah und fern nach dem Abstand (Prone): bis 5 ft das eine, darüber das andere', () => {
    const liegt = { 'attacked.near': ['advantage'], 'attacked.far': ['disadvantage'] };
    expect(attackRollMode({}, liegt, { feet: NEAR_FEET }).mode).toBe('adv');
    expect(attackRollMode({}, liegt, { feet: 10 }).mode).toBe('dis');
    /* Ohne Abstand gilt keins von beiden. */
    expect(attackRollMode({}, liegt).mode).toBeUndefined();
    expect(attackRollMode({}, liegt, { feet: null }).mode).toBeUndefined();
  });

  it('die Trefferchance folgt dem Modus', () => {
    const { mode } = attackRollMode({}, {}, { long: true });
    expect(Math.round(hitChance(5, 15, mode) * 100)).toBe(30);
  });
});

describe('Zustände bringen ihre Wirkungen in die Rechnung', () => {
  const zustand = (id: string, name: string, effects: object[]): Entity => ({
    id,
    interfaces: ['Condition'],
    components: { Identity: { name }, Effects: { effects } },
  });
  const blind = zustand('blind', 'Blinded', [
    { id: 'a', target: 'attack', op: 'grant', value: 'disadvantage' },
    { id: 'b', target: 'attacked', op: 'grant', value: 'advantage' },
  ]);
  const liegt = zustand('prone', 'Prone', [
    { id: 'a', target: 'attack', op: 'grant', value: 'disadvantage' },
    { id: 'n', target: 'attacked.near', op: 'grant', value: 'advantage' },
    { id: 'f', target: 'attacked.far', op: 'grant', value: 'disadvantage' },
  ]);
  const unsichtbar = zustand('invis', 'Invisible', [
    { id: 'a', target: 'attack', op: 'grant', value: 'advantage' },
    { id: 'b', target: 'attacked', op: 'grant', value: 'disadvantage' },
  ]);
  const kreatur = (...zustaende: string[]): Entity => ({
    id: 'gob',
    interfaces: ['Creature'],
    components: { Identity: { name: 'Goblin' }, Vitals: { conditions: zustaende } },
  });
  const byId = new Map([blind, liegt, unsichtbar].map((e) => [e.id, e]));
  const grants = (...z: string[]) => creatureStats(kreatur(...z), byId).totals.grants;

  it('Blinded: der eigene Angriff mit Nachteil, Angriffe dagegen mit Vorteil', () => {
    expect(attackRollMode(grants('blind'), {}).mode).toBe('dis');
    expect(attackRollMode({}, grants('blind')).mode).toBe('adv');
  });

  it('Invisible gegen Blinded: beide Seiten heben sich auf', () => {
    expect(attackRollMode(grants('invis'), grants('blind')).mode).toBe('adv');
    expect(attackRollMode(grants('blind'), grants('invis')).mode).toBe('dis');
  });

  it('Prone: nah Vorteil, fern Nachteil — der Zustand am Ziel, nicht am Angreifer', () => {
    expect(attackRollMode({}, grants('prone'), { feet: 5 }).mode).toBe('adv');
    expect(attackRollMode({}, grants('prone'), { feet: 30, long: false }).mode).toBe('dis');
    expect(attackRollMode(grants('prone'), {}, { feet: 5 }).mode).toBe('dis');
  });
});

describe('effectText für die Ziele nach Abstand', () => {
  it('liest sich wie die übrigen Vorteile', async () => {
    const { effectText } = await import('../src/effects.js');
    expect(effectText({ id: 'n', target: 'attacked.near', op: 'grant', value: 'advantage' })).toBe('advantage on attack rolls against it from within 5 ft.');
    expect(effectText({ id: 'f', target: 'attacked.far', op: 'grant', value: 'disadvantage' })).toBe('disadvantage on attack rolls against it from farther than 5 ft.');
  });
});

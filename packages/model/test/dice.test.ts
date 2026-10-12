import { describe, expect, it } from 'vitest';
import { isDice, parseDice, rollDice, rollText } from '../src/dice.js';

describe('parseDice', () => {
  it('reads dice, flats and signs, with W as well as d', () => {
    expect(parseDice('2d6 + 3')).toEqual([{ count: 2, sides: 6, sign: 1 }, { flat: 3 }]);
    expect(parseDice('1W8-1')).toEqual([{ count: 1, sides: 8, sign: 1 }, { flat: -1 }]);
    expect(parseDice('d20')).toEqual([{ count: 1, sides: 20, sign: 1 }]);
  });

  it('takes a lone modifier for a d20 roll — the attack bonus', () => {
    expect(parseDice('+4')).toEqual([{ count: 1, sides: 20, sign: 1 }, { flat: 4 }]);
    expect(parseDice('−1')).toEqual([{ count: 1, sides: 20, sign: 1 }, { flat: -1 }]);
  });

  it('refuses nonsense instead of guessing', () => {
    for (const s of ['', 'NAME', '2d', 'd0', '0d6', '2d6+x', '1d6*2', '9999d6', 'alert(1)']) {
      expect(parseDice(s), s).toBeNull();
      expect(isDice(s), s).toBe(false);
    }
  });
});

describe('rollDice', () => {
  it('rolls each die and adds the modifier', () => {
    const r = rollDice('2d6+2', () => 0.5);
    expect(r?.total).toBe(4 + 4 + 2);
    expect(r?.rolls).toEqual([{ d: 6, v: 4, vz: 1 }, { d: 6, v: 4, vz: 1 }, { flat: 2 }]);
    expect(rollText(r)).toBe('10 (4, 4 +2)');
  });

  it('stays within the sides', () => {
    expect(rollDice('1d20', () => 0)?.total).toBe(1);
    expect(rollDice('1d20', () => 0.99999)?.total).toBe(20);
  });

  it('gives null for nonsense, and rollText says so', () => {
    expect(rollDice('zwei Würfel')).toBeNull();
    expect(rollText(null)).toBe('?');
  });
});

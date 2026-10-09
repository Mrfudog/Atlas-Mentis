import { describe, expect, it } from 'vitest';
import { abilityMod, derivedValue, evalArith, formatValue } from '../src/calc.js';

describe('abilityMod', () => {
  it('floors toward negative infinity', () => {
    expect(abilityMod(1)).toBe(-5);
    expect(abilityMod(8)).toBe(-1);
    expect(abilityMod(9)).toBe(-1);
    expect(abilityMod(10)).toBe(0);
    expect(abilityMod(11)).toBe(0);
    expect(abilityMod(16)).toBe(3);
    expect(abilityMod(20)).toBe(5);
  });
});

describe('evalArith', () => {
  it('respects precedence and parentheses', () => {
    expect(evalArith('2+3*4')).toBe(14);
    expect(evalArith('(2+3)*4')).toBe(20);
  });

  it('handles unary minus in every position', () => {
    expect(evalArith('-5')).toBe(-5);
    expect(evalArith('(-5)+2')).toBe(-3);
    expect(evalArith('2*-3')).toBe(-6);
    expect(evalArith('(-1)+(-1)')).toBe(-2);
  });

  it('never throws on malformed input', () => {
    expect(evalArith('')).toBeNull();
    expect(evalArith('+')).toBeNull();
    expect(evalArith('(1+2')).toBeNull();
    expect(evalArith('1+2)')).toBeNull();
    expect(evalArith('abc')).toBeNull();
  });

  it('does not divide by zero', () => {
    expect(evalArith('4/0')).toBe(0);
  });
});

describe('derivedValue', () => {
  const stats = { str: 16, dex: 8, con: 15, int: 1, wis: 6, cha: 1, prof: 2 };

  it('resolves mod() against sibling fields', () => {
    expect(derivedValue({ type: 'number', derived: 'mod(str)' }, stats)).toBe(3);
    expect(derivedValue({ type: 'number', derived: 'mod(dex)' }, stats)).toBe(-1);
    expect(derivedValue({ type: 'number', derived: 'mod(int)' }, stats)).toBe(-5);
  });

  it('combines modifiers with bare field names', () => {
    expect(derivedValue({ type: 'number', derived: 'mod(dex)+prof' }, stats)).toBe(1);
    expect(derivedValue({ type: 'number', derived: 'mod(str)+prof' }, stats)).toBe(5);
    expect(derivedValue({ type: 'number', derived: '10+mod(wis)' }, stats)).toBe(8);
  });

  it('treats a missing sibling as zero rather than failing', () => {
    expect(derivedValue({ type: 'number', derived: 'mod(str)+prof' }, { str: 16 })).toBe(3);
    expect(derivedValue({ type: 'number', derived: 'mod(str)' }, {})).toBe(0);
    expect(derivedValue({ type: 'number', derived: 'mod(str)' }, undefined)).toBe(0);
  });

  it('is undefined for a property that is not derived', () => {
    expect(derivedValue({ type: 'number' }, stats)).toBeUndefined();
  });

  it('cannot execute code from a registry row', () => {
    // Registry rows are data a viewer may edit, so the evaluator is not eval().
    // A non-arithmetic expression yields no value rather than a misleading 0 —
    // and, self-evidently, this test process is still alive to assert it.
    const hostile = { type: 'number', derived: 'globalThis.process.exit(1)' } as const;
    expect(derivedValue(hostile, stats)).toBeUndefined();
    expect(derivedValue({ type: 'number', derived: 'while(true){}' }, stats)).toBeUndefined();
  });
});

describe('formatValue', () => {
  it('signs a signed number', () => {
    expect(formatValue({ type: 'number', format: 'signed' }, 3)).toBe('+3');
    expect(formatValue({ type: 'number', format: 'signed' }, -1)).toBe('-1');
    expect(formatValue({ type: 'number', format: 'signed' }, 0)).toBe('+0');
  });

  it('distinguishes empty from zero', () => {
    expect(formatValue({ type: 'number' }, 0)).toBe('0');
    expect(formatValue({ type: 'number' }, undefined)).toBe('');
    expect(formatValue({ type: 'string' }, '')).toBe('');
  });

  it('joins arrays', () => {
    expect(formatValue({ type: 'array' }, ['a', 'b'])).toBe('a, b');
  });
});

/* M2: der Zauber-SG braucht `prof` aus der Statblock-Karte und den Wert aus
   `Abilities` — zwei Karten, die der Bogen ohnehin als eine liest. */
describe('derivedValue across the cards of one article', () => {
  const dc = { type: 'number', derived: '8+prof+modOf(spellAbility)' } as const;
  const atk = { type: 'number', derived: 'prof+modOf(spellAbility)' } as const;
  const statblock = { prof: 3, spellAbility: 'int' };
  const abilities = { str: 10, int: 18 };
  const cards = { Statblock: statblock, Abilities: abilities };

  it('takes the modifier of the ability a field names, from the other card', () => {
    expect(derivedValue(dc, statblock, cards)).toBe(15);
    expect(derivedValue(atk, statblock, cards)).toBe(7);
  });

  it('has no value without an ability — 8 + proficiency would look right and is not', () => {
    const nurWerte = { Abilities: abilities };
    expect(derivedValue(dc, { prof: 3 }, nurWerte)).toBeUndefined();
    expect(derivedValue(dc, { prof: 3, spellAbility: 'luck' }, nurWerte)).toBeUndefined();
    expect(derivedValue(dc, statblock, { Statblock: statblock })).toBeUndefined();
  });

  it('lets the own card win, and refuses a name two other cards disagree on', () => {
    expect(derivedValue({ type: 'number', derived: 'prof' }, { prof: 2 }, { X: { prof: 9 } })).toBe(2);
    const zwei = { A: { prof: 2 }, B: { prof: 4 } };
    expect(derivedValue({ type: 'number', derived: 'prof+1' }, {}, zwei)).toBeUndefined();
    const gleich = { A: { prof: 2 }, B: { prof: 2 } };
    expect(derivedValue({ type: 'number', derived: 'prof+1' }, {}, gleich)).toBe(3);
  });

  it('keeps every calculation that stays inside its card as it was', () => {
    expect(derivedValue({ type: 'number', derived: 'mod(dex)' }, { dex: 14 }, cards)).toBe(2);
    expect(derivedValue({ type: 'number', derived: 'mod(str)' }, {}, cards)).toBe(0);
  });
});

describe('sum über die eigenen Kanten (M3)', () => {
  const level = { type: 'number' as const, derived: 'sum(hasClass.level)' };
  const prof = { type: 'number' as const, derived: '2+(sum(hasClass.level)-1)/4' };
  const kanten = [
    { id: 'r1', type: 'hasClass', to: 'fighter', props: { level: 3 } },
    { id: 'r2', type: 'hasClass', to: 'wizard', props: { level: 2 } },
    { id: 'r3', type: 'memberOf', to: 'zirkel', props: { level: 9 } },
  ];

  it('zählt die Stufen aller Klassen und nur die', () => {
    expect(derivedValue(level, {}, {}, kanten)).toBe(5);
    expect(derivedValue(prof, {}, {}, kanten)).toBe(3);
  });

  it('ohne Klasse keine Stufe — und kein Übungsbonus, der aussieht, als stimmte er', () => {
    expect(derivedValue(level, {}, {}, [])).toBeUndefined();
    expect(derivedValue(prof, {}, {})).toBeUndefined();
  });

  it('ein Pfad ohne Punkt rechnet nichts', () => {
    expect(derivedValue({ type: 'number', derived: 'sum(hasClass)' }, {}, {}, kanten)).toBeUndefined();
  });
});

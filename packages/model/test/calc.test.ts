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

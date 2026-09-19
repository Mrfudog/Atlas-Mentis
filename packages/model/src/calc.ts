/**
 * The Calculation engine.
 *
 * Derived values are computed on read and never stored (D8). The expression
 * language is deliberately tiny: numbers, the four operators, parentheses,
 * `mod(field)`, and bare field names that resolve against the component's
 * own siblings. Evaluation is a shunting-yard pass over a token list — not
 * `eval`, because registry rows are data that viewers can edit.
 */

import type { ComponentValue, PropertySchema } from './types.js';

/** 5e ability modifier. Floors toward negative infinity: 1 → -5, 16 → +3. */
export function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

/** `u` is unary negation — it must bind tighter than any binary operator,
 *  or `2*-3` evaluates as `(2*0)-3`. */
const PRECEDENCE: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2, u: 3 };

/**
 * Evaluate an arithmetic expression over numbers only.
 * Returns null when the expression is malformed — callers treat that as "no value".
 */
export function evalArith(expr: string): number | null {
  const tokens = String(expr).match(/\d+\.?\d*|[+\-*/()]/g);
  if (!tokens) return null;

  const output: (number | string)[] = [];
  const ops: string[] = [];
  let prev: 'number' | 'operator' | 'open' | null = null;

  for (const token of tokens) {
    if (/^\d/.test(token)) {
      output.push(parseFloat(token));
      prev = 'number';
      continue;
    }
    if (token === '(') {
      ops.push(token);
      prev = 'open';
      continue;
    }
    if (token === ')') {
      while (ops.length && ops[ops.length - 1] !== '(') output.push(ops.pop() as string);
      if (!ops.length) return null; // unbalanced
      ops.pop();
      prev = 'number';
      continue;
    }
    // unary minus: -3, (-3), 2 * -3
    const isUnary = token === '-' && (prev === null || prev === 'operator' || prev === 'open');
    const op = isUnary ? 'u' : token;
    // unary negation is right-associative, so an equal precedence does not pop
    while (
      ops.length &&
      ops[ops.length - 1] !== '(' &&
      (PRECEDENCE[ops[ops.length - 1] as string] ?? 0) >= (PRECEDENCE[op] ?? 0) &&
      !(op === 'u' && ops[ops.length - 1] === 'u')
    ) {
      output.push(ops.pop() as string);
    }
    ops.push(op);
    prev = 'operator';
  }
  while (ops.length) {
    const op = ops.pop() as string;
    if (op === '(') return null; // unbalanced
    output.push(op);
  }

  const stack: number[] = [];
  for (const item of output) {
    if (typeof item === 'number') {
      stack.push(item);
      continue;
    }
    if (item === 'u') {
      const only = stack.pop();
      if (only === undefined) return null;
      stack.push(-only);
      continue;
    }
    const b = stack.pop();
    const a = stack.pop();
    if (a === undefined || b === undefined) return null;
    switch (item) {
      case '+': stack.push(a + b); break;
      case '-': stack.push(a - b); break;
      case '*': stack.push(a * b); break;
      case '/': stack.push(b === 0 ? 0 : a / b); break;
      default: return null;
    }
  }
  return stack.length === 1 ? (stack[0] as number) : null;
}

/**
 * Resolve a property's `derived` expression against its sibling fields.
 * An unknown or non-numeric name contributes 0 rather than failing the whole
 * expression — a half-filled statblock should still render.
 */
export function derivedValue(prop: PropertySchema, value: ComponentValue | undefined): number | undefined {
  if (!prop?.derived) return undefined;
  const siblings = value ?? {};

  const numeric = (key: string): string => {
    const n = Number(siblings[key]);
    return Number.isFinite(n) ? `(${n})` : '(0)';
  };

  let expr = String(prop.derived).replace(/mod\(\s*([A-Za-z0-9_]+)\s*\)/g, (_m, key: string) => {
    const n = Number(siblings[key]);
    return Number.isFinite(n) ? `(${abilityMod(n)})` : '(0)';
  });
  expr = expr.replace(/[A-Za-z_][A-Za-z0-9_]*/g, numeric);

  const result = evalArith(expr);
  return result === null ? undefined : Math.trunc(result);
}

/** Display form for a stored or derived value. Returns '' for "nothing to show". */
export function formatValue(prop: PropertySchema | undefined, raw: unknown): string {
  if (raw === undefined || raw === null || raw === '') return '';
  if (prop?.format === 'signed' && typeof raw === 'number') return `${raw >= 0 ? '+' : ''}${raw}`;
  if (Array.isArray(raw)) return raw.join(', ');
  if (typeof raw === 'object') return JSON.stringify(raw);
  return String(raw);
}

/** The value a view should print for one property: derived when derived, stored otherwise. */
export function effectiveValue(
  prop: PropertySchema,
  key: string,
  value: ComponentValue | undefined,
): unknown {
  return prop.derived ? derivedValue(prop, value) : value?.[key];
}

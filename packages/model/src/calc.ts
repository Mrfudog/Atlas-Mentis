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

/** A grid is a list of rows of glyphs; anything but these counts as occupied. */
const EMPTY_CELL = new Set(['0', '.', ' ', '_']);

function asRows(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((r) => String(r));
  if (typeof raw === 'string') return raw.split('\n');
  return [];
}

/**
 * Unary functions over a sibling field, each returning a number.
 *
 * The names deliberately avoid the property keys they are used on (`width`,
 * `height`, `cells`): `derivedValue` resolves functions before bare field
 * names, so a function sharing a field's name still works — but reading
 * `width(rows)` as "the field width" is a mistake waiting to be made, and
 * renaming a field to match one would silently rewrite the call.
 * Extending the Calculation engine is adding an entry here — no consumer
 * changes, which is the same promise the registry makes for data.
 */
const FUNCTIONS: Record<string, (raw: unknown) => number> = {
  /** 5e ability modifier from a score. */
  mod: (raw) => {
    const n = Number(raw);
    return Number.isFinite(n) ? abilityMod(n) : 0;
  },
  /** Row count of a grid. */
  rowCount: (raw) => asRows(raw).length,
  /** Widest row of a grid. */
  colCount: (raw) => asRows(raw).reduce((max, row) => Math.max(max, row.length), 0),
  /** Occupied cells of a grid. */
  cellCount: (raw) =>
    asRows(raw).reduce(
      (sum, row) => sum + [...row].filter((glyph) => !EMPTY_CELL.has(glyph)).length,
      0,
    ),
};

/**
 * Resolve a property's `derived` expression against its sibling fields.
 * An unknown or non-numeric name contributes 0 rather than failing the whole
 * expression — a half-filled statblock should still render.
 */
export function derivedValue(prop: PropertySchema, value: ComponentValue | undefined): number | undefined {
  if (!prop?.derived) return undefined;
  const siblings = value ?? {};

  let expr = String(prop.derived);

  // Functions first: their argument is a field name, not an expression.
  expr = expr.replace(
    /([A-Za-z_][A-Za-z0-9_]*)\(\s*([A-Za-z0-9_]+)\s*\)/g,
    (whole, fn: string, key: string) => {
      const apply = FUNCTIONS[fn];
      return apply ? `(${apply(siblings[key])})` : whole;
    },
  );

  // Then bare field names as numbers.
  expr = expr.replace(/[A-Za-z_][A-Za-z0-9_]*/g, (key) => {
    const n = Number(siblings[key]);
    return Number.isFinite(n) ? `(${n})` : '(0)';
  });

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

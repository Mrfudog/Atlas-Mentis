/**
 * The Calculation engine.
 *
 * Derived values are computed on read and never stored (D8). The expression
 * language is deliberately tiny: numbers, the four operators, parentheses,
 * `mod(field)`, and bare field names that resolve against the component's
 * own siblings. Evaluation is a shunting-yard pass over a token list — not
 * `eval`, because registry rows are data that viewers can edit.
 * What the own card does not carry is looked up in the article's other
 * cards (`derivedValue`), and `modOf(field)` reads the ability a field names.
 * `sum(edge.prop)` adds a number over the article's own forward edges of one
 * type — the level of a character is the sum of its `hasClass` levels (M3).
 */

import type { ComponentValue, PropertySchema, Relation } from './types.js';

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
 * Wie eine Rechnung einen Namen nachschlägt: erst in der eigenen Karte,
 * dann in den übrigen Karten desselben Artikels (siehe `derivedValue`).
 * `AMBIGUOUS` heisst: zwei andere Karten tragen den Namen verschieden —
 * dann rechnet nichts, statt still die falsche zu nehmen.
 */
const AMBIGUOUS = Symbol('ambiguous');
type Lookup = (key: string) => unknown;

/** Die sechs Attributkürzel — was `modOf` als Feldnamen annimmt. */
const ABILITY_KEYS = new Set(['str', 'dex', 'con', 'int', 'wis', 'cha']);

/**
 * Unary functions over a sibling field, each returning a number — or `null`
 * for "this calculation has no value", which voids the whole expression.
 *
 * The names deliberately avoid the property keys they are used on (`width`,
 * `height`, `cells`): `derivedValue` resolves functions before bare field
 * names, so a function sharing a field's name still works — but reading
 * `width(rows)` as "the field width" is a mistake waiting to be made, and
 * renaming a field to match one would silently rewrite the call.
 * Extending the Calculation engine is adding an entry here — no consumer
 * changes, which is the same promise the registry makes for data.
 */
/** Was eine Funktion ausser dem Wert noch sehen darf. */
interface FnContext {
  /** Das Argument, wie es dasteht — bei `sum` ein Pfad, kein Feldname. */
  key: string;
  /** Die eigenen Vorwärtskanten des Artikels. */
  relations: readonly Relation[];
}

const FUNCTIONS: Record<string, (raw: unknown, look: Lookup, ctx: FnContext) => number | null> = {
  /** 5e ability modifier from a score. */
  mod: (raw) => {
    const n = Number(raw);
    return Number.isFinite(n) ? abilityMod(n) : 0;
  },
  /**
   * **Der Modifikator des Attributs, das ein Feld nennt** (M2): an einem
   * Statblock steht `spellAbility: 'int'`, und `modOf(spellAbility)` ist
   * `mod(int)`. Anders als `mod` gibt es hier keine 0 für „fehlt": ein
   * Zauber-SG ohne Attribut wäre 8 + Übung, eine Zahl, die aussieht, als
   * stimmte sie.
   */
  modOf: (raw, look) => {
    const key = String(raw ?? '');
    if (!ABILITY_KEYS.has(key)) return null;
    const score = look(key);
    if (score === AMBIGUOUS || score === undefined || score === null || score === '') return null;
    const n = Number(score);
    return Number.isFinite(n) ? abilityMod(n) : null;
  },
  /**
   * **Eine Summe über die eigenen Kanten** (M3): `sum(hasClass.level)` ist
   * die Stufe einer Figur — Kämpfer 3 und Magier 2 sind Stufe 5, und die
   * Zahl steht an keiner dritten Stelle, an der sie veralten könnte (D8).
   * Gelesen werden die Vorwärtskanten dieses Artikels mit dem Typ vor dem
   * Punkt und darin `props` mit dem Namen danach. Keine solche Kante heisst
   * **kein Wert**: eine Figur ohne Klasse hat keine Stufe 0, sondern keine.
   */
  sum: (_raw, _look, ctx) => {
    const punkt = ctx.key.indexOf('.');
    if (punkt <= 0) return null;
    const typ = ctx.key.slice(0, punkt);
    const feld = ctx.key.slice(punkt + 1);
    let summe = 0;
    let treffer = 0;
    for (const r of ctx.relations) {
      if (r.type !== typ) continue;
      const n = Number(r.props?.[feld]);
      if (!Number.isFinite(n)) continue;
      summe += n;
      treffer++;
    }
    return treffer ? summe : null;
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
 *
 * **Die Nachbarn sind zuerst die eigene Karte, dann der Artikel** (`cards`,
 * alle Karten des Artikels). Der Statblock trägt `prof` und das
 * Zauberwirken in seiner Karte, die sechs Werte in `Abilities` — und der
 * Bogen liest beide ohnehin als eine. Ein Zauber-SG `8+prof+modOf(spellAbility)`
 * braucht beide; ohne den Rückgriff müsste `prof` in zwei Karten stehen.
 * Was die eigene Karte trägt, gewinnt immer, also rechnet jede bisherige
 * Rechnung wie vorher. Tragen zwei **andere** Karten denselben Namen
 * verschieden, gibt es keinen Wert.
 */
export function derivedValue(
  prop: PropertySchema,
  value: ComponentValue | undefined,
  cards?: Record<string, ComponentValue | undefined>,
  relations?: readonly Relation[],
): number | undefined {
  if (!prop?.derived) return undefined;
  const siblings = value ?? {};
  const look: Lookup = (key) => {
    if (key in siblings) return siblings[key];
    let found: unknown;
    let hits = 0;
    for (const card of Object.values(cards ?? {})) {
      if (!card || card === value || !(key in card)) continue;
      if (hits && card[key] !== found) return AMBIGUOUS;
      found = card[key];
      hits++;
    }
    return found;
  };

  let expr = String(prop.derived);
  let void_ = false;

  // Functions first: their argument is a field name (or an edge path), not an expression.
  expr = expr.replace(
    /([A-Za-z_][A-Za-z0-9_]*)\(\s*([A-Za-z0-9_.]+)\s*\)/g,
    (whole, fn: string, key: string) => {
      const apply = FUNCTIONS[fn];
      if (!apply) return whole;
      const raw = key.includes('.') ? undefined : look(key);
      if (raw === AMBIGUOUS) {
        void_ = true;
        return '(0)';
      }
      const n = apply(raw, look, { key, relations: relations ?? [] });
      if (n === null) void_ = true;
      return `(${n ?? 0})`;
    },
  );

  // Then bare field names as numbers.
  expr = expr.replace(/[A-Za-z_][A-Za-z0-9_]*/g, (key) => {
    const raw = look(key);
    if (raw === AMBIGUOUS) {
      void_ = true;
      return '(0)';
    }
    const n = Number(raw);
    return Number.isFinite(n) ? `(${n})` : '(0)';
  });

  if (void_) return undefined;
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
  cards?: Record<string, ComponentValue | undefined>,
  relations?: readonly Relation[],
): unknown {
  return prop.derived ? derivedValue(prop, value, cards, relations) : value?.[key];
}

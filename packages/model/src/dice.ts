/**
 * Würfelausdrücke (REQ-070, M12): `1d6+2`, `2W6 - 1`, `+4`.
 *
 * Dieselbe Regel wie beim Rechenwerk: **kein `eval`.** Ein Ausdruck steht
 * in einem Feld, das jemand bearbeiten kann, und bei Unsinn gibt es `null`
 * — nicht eine Zahl, die aus einem Tippfehler entsteht.
 *
 * Ein Ausdruck aus **nur einem Modifikator** (`+4`, `-1`) ist ein Wurf auf
 * den W20 mit diesem Bonus: so schreibt 5e.tools den Angriffsbonus
 * (`{@hit 4}` → `{{+4}}`), und am Tisch heisst „+4" genau das. Eine Zahl
 * ohne Vorzeichen (`{{5}}`) bleibt eine Zahl — ein Wurf, der immer 5
 * ergibt, ist eine merkwürdige, aber ehrliche Angabe.
 */

export type DiceTerm = { count: number; sides: number; sign: 1 | -1 } | { flat: number };

export interface DiceRoll {
  /** Der Ausdruck, wie er dastand. */
  expr: string;
  total: number;
  /** Die Einzelwürfe — „18" und „1 + 17" sind am Tisch zweierlei. */
  rolls: ({ d: number; v: number; vz: 1 | -1 } | { flat: number })[];
}

/** Obergrenzen, damit `{{9999d9999}}` keine Seite anhält. */
const MAX_COUNT = 100;
const MAX_SIDES = 1000;

/** Die Glieder eines Ausdrucks, oder `null`, wenn er keiner ist. */
export function parseDice(expr: string): DiceTerm[] | null {
  const txt = String(expr ?? '')
    .replace(/\s+/g, '')
    .replace(/−/g, '-')
    .toLowerCase();
  if (!txt) return null;
  /* Nur ein Modifikator: der Angriffsbonus, ein Wurf auf den W20. */
  if (/^[+-]\d+$/.test(txt)) {
    return [{ count: 1, sides: 20, sign: 1 }, { flat: parseInt(txt, 10) }];
  }
  const teile = txt.match(/[+-]?[^+-]+/g);
  if (!teile || teile.join('') !== txt) return null;
  const out: DiceTerm[] = [];
  for (const roh of teile) {
    let t = roh;
    let sign: 1 | -1 = 1;
    if (t.startsWith('+')) t = t.slice(1);
    else if (t.startsWith('-')) {
      sign = -1;
      t = t.slice(1);
    }
    const m = /^(\d*)[dw](\d+)$/.exec(t);
    if (m) {
      const count = parseInt(m[1] || '1', 10);
      const sides = parseInt(m[2] ?? '0', 10);
      /* Ein W0 oder null Würfel sind kein Wurf, sondern ein Tippfehler. */
      if (count < 1 || sides < 1 || count > MAX_COUNT || sides > MAX_SIDES) return null;
      out.push({ count, sides, sign });
      continue;
    }
    if (/^\d+$/.test(t)) {
      out.push({ flat: sign * parseInt(t, 10) });
      continue;
    }
    return null;
  }
  return out;
}

/** Ist das ein Würfelausdruck? Für den Text: nur dann wird `{{…}}` klickbar. */
export function isDice(expr: string): boolean {
  return parseDice(expr) !== null;
}

/**
 * Würfeln. `random` liefert wie `Math.random` eine Zahl in [0, 1) — in
 * Tests ein fester Wert, damit der Wurf vorhersagbar ist.
 */
export function rollDice(expr: string, random: () => number = Math.random): DiceRoll | null {
  const terms = parseDice(expr);
  if (!terms) return null;
  let total = 0;
  const rolls: DiceRoll['rolls'] = [];
  for (const t of terms) {
    if ('flat' in t) {
      total += t.flat;
      rolls.push({ flat: t.flat });
      continue;
    }
    for (let i = 0; i < t.count; i++) {
      const v = 1 + Math.floor(random() * t.sides);
      rolls.push({ d: t.sides, v, vz: t.sign });
      total += t.sign * v;
    }
  }
  return { expr, total, rolls };
}

/** „12 (4, 6 +2)" — das Ergebnis und woraus es besteht. */
export function rollText(r: DiceRoll | null): string {
  if (!r) return '?';
  const wuerfe = r.rolls
    .filter((x): x is { d: number; v: number; vz: 1 | -1 } => 'd' in x)
    .map((x) => (x.vz < 0 ? '−' : '') + x.v)
    .join(', ');
  const flach = r.rolls.reduce((a, x) => a + ('flat' in x ? x.flat : 0), 0);
  const mod = flach ? (flach > 0 ? ` +${flach}` : ` ${flach}`) : '';
  return wuerfe ? `${r.total} (${wuerfe}${mod})` : String(r.total);
}

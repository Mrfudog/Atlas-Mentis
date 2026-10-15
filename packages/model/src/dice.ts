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
 *
 * **Behalten** (`4d6kh3`, `2d20kl1`): von den Würfeln eines Glieds zählen
 * nur die höchsten bzw. tiefsten; die übrigen stehen im Wurf, gestrichen
 * (`drop`). So würfelt man Attribute (E-016) und mit Vorteil.
 */

export type DiceTerm =
  | { count: number; sides: number; sign: 1 | -1; keep?: { high: boolean; n: number } }
  | { flat: number };

export interface DiceRoll {
  /** Der Ausdruck, wie er dastand. */
  expr: string;
  total: number;
  /** Die Einzelwürfe — „18" und „1 + 17" sind am Tisch zweierlei. */
  rolls: ({ d: number; v: number; vz: 1 | -1; drop?: true } | { flat: number })[];
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
    const m = /^(\d*)[dw](\d+)(?:k([hl])(\d+))?$/.exec(t);
    if (m) {
      const count = parseInt(m[1] || '1', 10);
      const sides = parseInt(m[2] ?? '0', 10);
      /* Ein W0 oder null Würfel sind kein Wurf, sondern ein Tippfehler. */
      if (count < 1 || sides < 1 || count > MAX_COUNT || sides > MAX_SIDES) return null;
      if (m[3]) {
        const n = parseInt(m[4] ?? '0', 10);
        /* Mehr behalten, als gewürfelt wird, oder keinen: ein Tippfehler. */
        if (n < 1 || n > count) return null;
        out.push({ count, sides, sign, keep: { high: m[3] === 'h', n } });
      } else out.push({ count, sides, sign });
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
    const glied: { d: number; v: number; vz: 1 | -1; drop?: true }[] = [];
    for (let i = 0; i < t.count; i++) glied.push({ d: t.sides, v: 1 + Math.floor(random() * t.sides), vz: t.sign });
    if (t.keep) {
      /* Gestrichen werden die übrigen, bei Gleichstand die späteren. */
      const rang = glied
        .map((w, i) => ({ v: w.v, i }))
        .sort((a, z) => (t.keep!.high ? z.v - a.v : a.v - z.v) || a.i - z.i);
      for (const { i } of rang.slice(t.keep.n)) glied[i]!.drop = true;
    }
    for (const w of glied) {
      rolls.push(w);
      if (!w.drop) total += t.sign * w.v;
    }
  }
  return { expr, total, rolls };
}

/** „12 (4, 6 +2)" — das Ergebnis und woraus es besteht. */
export function rollText(r: DiceRoll | null): string {
  if (!r) return '?';
  const wuerfe = r.rolls
    .filter((x): x is { d: number; v: number; vz: 1 | -1; drop?: true } => 'd' in x)
    .map((x) => (x.vz < 0 ? '−' : '') + (x.drop ? `~${x.v}~` : x.v))
    .join(', ');
  const flach = r.rolls.reduce((a, x) => a + ('flat' in x ? x.flat : 0), 0);
  const mod = flach ? (flach > 0 ? ` +${flach}` : ` ${flach}`) : '';
  return wuerfe ? `${r.total} (${wuerfe}${mod})` : String(r.total);
}

/**
 * **Vorteil und Nachteil** (T-172): der erste W20 des Ausdrucks wird zwei
 * W20, von denen der höhere (`adv`) bzw. tiefere (`dis`) zählt. Ohne W20
 * oder schon mit Behalten bleibt der Ausdruck, wie er ist — ein Vorteil
 * auf Schaden ist keine Regel.
 */
export function withAdvantage(expr: string, mode: 'adv' | 'dis' | null | undefined): string {
  if (mode !== 'adv' && mode !== 'dis') return expr;
  const terms = parseDice(expr);
  if (!terms) return expr;
  const i = terms.findIndex((t) => !('flat' in t) && t.sides === 20 && t.count === 1 && !t.keep && t.sign === 1);
  if (i < 0) return expr;
  return terms
    .map((t, j) => {
      if ('flat' in t) return t.flat < 0 ? `-${-t.flat}` : `+${t.flat}`;
      const kern = j === i ? `2d20k${mode === 'adv' ? 'h' : 'l'}1` : `${t.count}d${t.sides}${t.keep ? `k${t.keep.high ? 'h' : 'l'}${t.keep.n}` : ''}`;
      return (t.sign < 0 ? '-' : '+') + kern;
    })
    .join('')
    .replace(/^\+/, '');
}

/**
 * **Die natürliche Zahl des W20** (T-172): der gezählte W20 eines Wurfs
 * mit genau einem — bei Vorteil der behaltene. Daraus folgt `crit`
 * (20) und `fumble` (1); ohne W20 oder mit mehreren gibt es keine.
 */
export function naturalD20(r: DiceRoll | null): { nat: number; crit?: 'crit' | 'fumble' } | null {
  if (!r) return null;
  const w20 = r.rolls.filter((x): x is { d: number; v: number; vz: 1 | -1; drop?: true } => 'd' in x && x.d === 20 && !x.drop && x.vz > 0);
  if (w20.length !== 1) return null;
  const nat = w20[0]!.v;
  return nat === 20 ? { nat, crit: 'crit' } : nat === 1 ? { nat, crit: 'fumble' } : { nat };
}

/** Die Summe der festen Glieder — der Modifikator eines Wurfs. */
export function diceModifier(r: DiceRoll | null): number {
  return (r?.rolls ?? []).reduce((a, x) => a + ('flat' in x ? x.flat : 0), 0);
}

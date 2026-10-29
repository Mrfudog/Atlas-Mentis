/**
 * Geld — **gespeichert als ganze Zahl in der kleinsten Sorte, gezeigt in
 * Sorten** (T-357, REQ-185; D8 wie bei den Massen).
 *
 * Heute steht Geld an mehreren Stellen als Kupfer (`Item.copperPrice`,
 * `Inventory.copper`, `price` an der Laden-Kante). Das bleibt so: Kupfer ist
 * die kleinste Sorte der Standardwährung, also ist jede dieser Zahlen schon
 * ein Betrag in der kleinsten Sorte. Was hier steht, rechnet nur: eine
 * Eingabe wie „2 gp 5 sp" in die Zahl, die Zahl zurück in Sorten, und von
 * einer Währung in eine andere.
 *
 * **Woher eine Währung kommt, entscheidet E-130** (Artikel `Currency` in
 * einer Ebene oder Registerzeile), **wie die Börse zählt, E-129** (Münzen je
 * Sorte oder Gesamtwert). Beides ist offen; `CurrencyDef` ist darum nur die
 * gelesene Form, die jede der Optionen liefern kann, und keine Speicherform.
 * `DND_COINS` ist die eine Währung, die heute schon gilt (die bisher fest
 * verdrahtete Schreibweise von `coinText`) — sie zieht um, sobald E-130
 * sagt, wohin.
 */

/** Eine Münzsorte: ihr Wert in der kleinsten Sorte derselben Währung. */
export interface CoinDef {
  code: string;
  /** Wert in der kleinsten Sorte; die kleinste selbst hat 1. */
  value: number;
  name?: string;
  aliases?: string[];
  /**
   * `false`: wird gelesen, aber beim Zerlegen nicht ausgegeben — Elektrum
   * nennt niemand als Wechselgeld, und „2 gp 1 ep" liest sich wie ein Fehler.
   */
  change?: boolean;
}

/** Eine Währung, wie sie gelesen wird (Quelle: E-130). */
export interface CurrencyDef {
  code: string;
  name?: string;
  coins: CoinDef[];
  /** Die Sorte, in der gerechnet und gezeigt wird (D&D: gp). Leer: die grösste. */
  display?: string;
  /**
   * Kurs: was **eine** kleinste Sorte dieser Währung in kleinsten Sorten der
   * Basiswährung wert ist. Die Basiswährung hat 1; ohne Kurs kein Wechsel.
   */
  rate?: number;
}

/** Die Münzen des Grundregelwerks: cp, sp, ep, gp, pp. */
export const DND_COINS: CurrencyDef = {
  code: 'dnd',
  name: 'D&D coins',
  display: 'gp',
  rate: 1,
  coins: [
    { code: 'cp', value: 1, name: 'copper' },
    { code: 'sp', value: 10, name: 'silver' },
    { code: 'ep', value: 50, name: 'electrum', change: false },
    { code: 'gp', value: 100, name: 'gold' },
    { code: 'pp', value: 1000, name: 'platinum' },
  ],
};

const klein = (s: string): string => s.trim().toLowerCase().replace(/\.$/, '');

/** Die Sorte zu einer Schreibweise: Kürzel, Name oder Alias. */
export function coinByCode(currency: CurrencyDef, word: string): CoinDef | undefined {
  const w = klein(word);
  return currency.coins.find(
    (c) => klein(c.code) === w || (c.name !== undefined && klein(c.name) === w) || (c.aliases ?? []).some((a) => klein(a) === w),
  );
}

const absteigend = (currency: CurrencyDef): CoinDef[] => [...currency.coins].sort((a, b) => b.value - a.value);

function anzeigeSorte(currency: CurrencyDef): CoinDef | undefined {
  return (currency.display !== undefined ? coinByCode(currency, currency.display) : undefined) ?? absteigend(currency)[0];
}

const ZAHL = String.raw`(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?|\.\d+)`;
const TEIL = new RegExp(String.raw`[\s,;+]*${ZAHL}\s*([A-Za-zÀ-ÿ]+\.?)?`, 'y');
const MINUS = /^[-−]\s*/;

/**
 * Ein Betrag aus Text in die kleinste Sorte: „2 gp 5 sp", „2.5 gp", „250 cp",
 * „1,500 gp". Eine Zahl ohne Sorte zählt nur allein und gilt in `bareCoin`
 * (Vorgabe: die kleinste). Unsinn, eine unbekannte Sorte oder ein Bruchteil
 * der kleinsten Sorte geben `null` — keine irreführende Zahl.
 */
export function parseMoney(text: string, currency: CurrencyDef, opts: { bareCoin?: string } = {}): number | null {
  let s = text.trim();
  let vorzeichen = 1;
  if (MINUS.test(s)) {
    vorzeichen = -1;
    s = s.replace(MINUS, '');
  }
  if (!s) return null;
  const teile: { n: number; wort?: string }[] = [];
  TEIL.lastIndex = 0;
  while (TEIL.lastIndex < s.length) {
    const start = TEIL.lastIndex;
    const m = TEIL.exec(s);
    if (!m || m.index !== start) {
      if (/^[\s,;+]*$/.test(s.slice(start))) break;
      return null;
    }
    teile.push({ n: Number((m[1] as string).replace(/,/g, '')), ...(m[2] ? { wort: m[2] } : {}) });
  }
  if (!teile.length) return null;
  let summe = 0;
  for (const t of teile) {
    let sorte: CoinDef | undefined;
    if (t.wort === undefined) {
      if (teile.length > 1) return null;
      sorte = opts.bareCoin !== undefined ? coinByCode(currency, opts.bareCoin) : [...currency.coins].sort((a, b) => a.value - b.value)[0];
    } else sorte = coinByCode(currency, t.wort);
    if (!sorte || !Number.isFinite(t.n)) return null;
    const roh = t.n * sorte.value;
    const ganz = Math.round(roh);
    if (Math.abs(roh - ganz) > 1e-9) return null;
    summe += ganz;
  }
  return vorzeichen * summe;
}

/**
 * Ein Betrag in Sorten, gierig von gross nach klein: nur Sorten, die
 * wechseln (`change`), und keine über `upTo` (Vorgabe: die Anzeigesorte —
 * „15 gp" und nicht „1 pp 5 gp"). Ohne Vorzeichen; Nullen fallen weg.
 */
export function toCoins(value: number, currency: CurrencyDef, opts: { upTo?: string } = {}): { code: string; count: number }[] {
  const grenze = (opts.upTo !== undefined ? coinByCode(currency, opts.upTo) : undefined) ?? anzeigeSorte(currency);
  let rest = Math.abs(Math.trunc(value));
  const raus: { code: string; count: number }[] = [];
  for (const c of absteigend(currency)) {
    if (c.change === false && c.value !== 1) continue;
    if (grenze && c.value > grenze.value) continue;
    const n = Math.floor(rest / c.value);
    if (n > 0) raus.push({ code: c.code, count: n });
    rest -= n * c.value;
  }
  return raus;
}

/**
 * Wie ein Betrag dasteht:
 * - `mixed` (Vorgabe): in Sorten bis zur Anzeigesorte, „2 gp 5 sp";
 * - `single`: in **einer** Sorte (`coin`, Vorgabe die Anzeigesorte), „2.5 gp";
 * - `book`: wie das Buch Preise schreibt — die grösste wechselnde Sorte bis
 *   zur Anzeigesorte, die glatt aufgeht, „25 sp" (das ist `coinText`).
 */
export function formatMoney(
  value: number,
  currency: CurrencyDef,
  opts: { mode?: 'mixed' | 'single' | 'book'; coin?: string } = {},
): string {
  const fmt = (n: number, stellen = 0) => n.toLocaleString('en-US', { maximumFractionDigits: stellen });
  const zeichen = value < 0 ? '−' : '';
  const betrag = Math.abs(Math.trunc(value));
  const anzeige = anzeigeSorte(currency);
  if (!anzeige) return `${zeichen}${fmt(betrag)}`;
  const mode = opts.mode ?? 'mixed';
  if (mode === 'single') {
    const sorte = (opts.coin !== undefined ? coinByCode(currency, opts.coin) : undefined) ?? anzeige;
    return `${zeichen}${fmt(betrag / sorte.value, 6)} ${sorte.code}`;
  }
  if (mode === 'book') {
    const passend = absteigend(currency).find(
      (c) => (c.change !== false || c.value === 1) && c.value <= anzeige.value && betrag % c.value === 0,
    );
    const sorte = passend ?? [...currency.coins].sort((a, b) => a.value - b.value)[0] ?? anzeige;
    return `${zeichen}${fmt(betrag / sorte.value)} ${sorte.code}`;
  }
  const muenzen = toCoins(betrag, currency);
  if (!muenzen.length) return `0 ${anzeige.code}`;
  return zeichen + muenzen.map((m) => `${fmt(m.count)} ${m.code}`).join(' ');
}

/**
 * Ein Bereich für Filter: „1–10 gp" (die Sorte am Ende gilt für eine nackte
 * linke Zahl), „5 sp - 2 gp", „>= 5 gp", „< 1 gp", oder ein Betrag allein.
 * Grenzen sind eingeschlossen; `<` und `>` rechnen um eine kleinste Sorte.
 */
export function parseMoneyRange(text: string, currency: CurrencyDef): { min?: number; max?: number } | null {
  const s = text.trim();
  const vergleich = /^(>=|≥|>|<=|≤|<)\s*(.+)$/.exec(s);
  if (vergleich) {
    const v = parseMoney(vergleich[2] as string, currency);
    if (v === null) return null;
    switch (vergleich[1]) {
      case '>': return { min: v + 1 };
      case '<': return { max: v - 1 };
      case '<=': case '≤': return { max: v };
      default: return { min: v };
    }
  }
  const trenner = /\s*(?:–|—|\.\.|\bto\b|-)\s*/g;
  let m: RegExpExecArray | null;
  while ((m = trenner.exec(s))) {
    if (m.index === 0) continue;
    const links = s.slice(0, m.index);
    const rechts = s.slice(m.index + m[0].length);
    const max = parseMoney(rechts, currency);
    if (max === null) continue;
    const wort = /([A-Za-zÀ-ÿ]+)\.?\s*$/.exec(rechts)?.[1];
    const min = parseMoney(links, currency, wort ? { bareCoin: wort } : {});
    if (min === null) return null;
    return { min, max };
  }
  const v = parseMoney(s, currency);
  return v === null ? null : { min: v, max: v };
}

/**
 * Ein Betrag von einer Währung in eine andere, über die Basis (`rate`), mit
 * einer Gebühr in Prozent. Abgerundet zugunsten des Wechslers: was keine
 * ganze kleinste Sorte ergibt, bleibt bei ihm. Ohne Kurs `null`.
 */
export function exchangeMoney(
  value: number,
  from: CurrencyDef,
  to: CurrencyDef,
  opts: { feePercent?: number } = {},
): number | null {
  const a = from.rate;
  const b = to.rate;
  if (!a || !b || !(a > 0) || !(b > 0)) return null;
  const gebuehr = Math.min(100, Math.max(0, opts.feePercent ?? 0));
  return Math.trunc(((value * a) / b) * (1 - gebuehr / 100) + 1e-9 * Math.sign(value));
}

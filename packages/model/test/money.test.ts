import { describe, expect, it } from 'vitest';
import {
  DND_COINS,
  coinText,
  exchangeMoney,
  formatMoney,
  parseMoney,
  parseMoneyRange,
  toCoins,
  type CurrencyDef,
} from '../src/index.js';

/* Eine Settingwährung mit Sorten, die nicht in Zehnern stehen. */
const WATERDEEP: CurrencyDef = {
  code: 'wd',
  name: 'Waterdeep',
  display: 'dragon',
  coins: [
    { code: 'nib', value: 1 },
    { code: 'shard', value: 10 },
    { code: 'taol', value: 200 },
    { code: 'dragon', value: 100, aliases: ['dr'] },
    { code: 'sun', value: 1000 },
  ],
  rate: 1,
};

describe('Geld: parsen (T-357)', () => {
  it('liest gemischte Sorten, Dezimalen und die kleinste Sorte', () => {
    expect(parseMoney('2 gp 5 sp', DND_COINS)).toBe(250);
    expect(parseMoney('2.5 gp', DND_COINS)).toBe(250);
    expect(parseMoney('250 cp', DND_COINS)).toBe(250);
    expect(parseMoney('2gp5sp', DND_COINS)).toBe(250);
    expect(parseMoney('1 pp, 3 ep', DND_COINS)).toBe(1150);
    expect(parseMoney('1,500 gp', DND_COINS)).toBe(150000);
  });

  it('nimmt Namen und Aliasse, gross oder klein', () => {
    expect(parseMoney('3 Gold', DND_COINS)).toBe(300);
    expect(parseMoney('2 GP', DND_COINS)).toBe(200);
    expect(parseMoney('1 silver 2 copper', DND_COINS)).toBe(12);
  });

  it('eine nackte Zahl ist in der kleinsten Sorte, ausser die Eingabe sagt eine andere', () => {
    expect(parseMoney('250', DND_COINS)).toBe(250);
    expect(parseMoney('3', DND_COINS, { bareCoin: 'gp' })).toBe(300);
  });

  it('gibt bei Unsinn null statt einer irreführenden Zahl', () => {
    expect(parseMoney('', DND_COINS)).toBeNull();
    expect(parseMoney('2 zorp', DND_COINS)).toBeNull();
    expect(parseMoney('gp', DND_COINS)).toBeNull();
    expect(parseMoney('0.5 cp', DND_COINS)).toBeNull();
    expect(parseMoney('2 gp abc', DND_COINS)).toBeNull();
  });

  it('kennt ein Minus vorne (Abschlag)', () => {
    expect(parseMoney('-5 sp', DND_COINS)).toBe(-50);
    expect(parseMoney('−1 gp 5 sp', DND_COINS)).toBe(-150);
  });
});

describe('Geld: in Sorten zerlegen und anzeigen (T-357)', () => {
  it('zerlegt gierig, ohne Sorten, die nicht wechseln, und nur bis zur Anzeigesorte', () => {
    expect(toCoins(1234, DND_COINS)).toEqual([
      { code: 'gp', count: 12 },
      { code: 'sp', count: 3 },
      { code: 'cp', count: 4 },
    ]);
    expect(toCoins(1234, DND_COINS, { upTo: 'pp' })).toEqual([
      { code: 'pp', count: 1 },
      { code: 'gp', count: 2 },
      { code: 'sp', count: 3 },
      { code: 'cp', count: 4 },
    ]);
  });

  it('gemischt, in einer Sorte, wie im Buch', () => {
    expect(formatMoney(250, DND_COINS)).toBe('2 gp 5 sp');
    expect(formatMoney(250, DND_COINS, { mode: 'single' })).toBe('2.5 gp');
    expect(formatMoney(255, DND_COINS, { mode: 'single', coin: 'sp' })).toBe('25.5 sp');
    expect(formatMoney(250, DND_COINS, { mode: 'book' })).toBe('25 sp');
    expect(formatMoney(150000, DND_COINS, { mode: 'book' })).toBe('1,500 gp');
    expect(formatMoney(0, DND_COINS)).toBe('0 gp');
    expect(formatMoney(-150, DND_COINS)).toBe('−1 gp 5 sp');
  });

  it('coinText bleibt, wie es war — es ist die Buchschreibweise', () => {
    for (const c of [1500, 50, 3, 150, 1, 0, 123456]) {
      expect(coinText(c)).toBe(formatMoney(c, DND_COINS, { mode: 'book' }));
    }
    expect(coinText(150)).toBe('15 sp');
  });

  it('Parsen und Anzeigen gehen hin und zurück', () => {
    for (const c of [0, 1, 9, 10, 99, 101, 250, 1234, 999999]) {
      for (const mode of ['mixed', 'single', 'book'] as const) {
        expect(parseMoney(formatMoney(c, DND_COINS, { mode }), DND_COINS)).toBe(c);
      }
    }
  });

  it('eine fremde Währung zeigt in ihren eigenen Sorten, nicht in Zehnern', () => {
    expect(formatMoney(12345, WATERDEEP)).toBe('123 dragon 4 shard 5 nib');
    expect(parseMoney('2 dr 3 shard', WATERDEEP)).toBe(230);
  });
});

describe('Geld: Bereich für Filter (T-357)', () => {
  it('liest „1–10 gp" mit der Sorte am Ende für beide Seiten', () => {
    expect(parseMoneyRange('1–10 gp', DND_COINS)).toEqual({ min: 100, max: 1000 });
    expect(parseMoneyRange('5 sp - 2 gp', DND_COINS)).toEqual({ min: 50, max: 200 });
    expect(parseMoneyRange('>= 5 gp', DND_COINS)).toEqual({ min: 500 });
    expect(parseMoneyRange('<1 gp', DND_COINS)).toEqual({ max: 99 });
    expect(parseMoneyRange('2 gp', DND_COINS)).toEqual({ min: 200, max: 200 });
    expect(parseMoneyRange('quatsch', DND_COINS)).toBeNull();
  });
});

describe('Geld: zwischen Währungen wechseln (T-357)', () => {
  const SALT: CurrencyDef = { code: 'salt', name: 'Salt', coins: [{ code: 'pinch', value: 1 }, { code: 'bag', value: 20 }], rate: 5 };
  it('rechnet über die Basis und rundet zugunsten des Wechslers ab', () => {
    // 1 pinch = 5 cp; 23 cp → 4 pinch (3 cp bleiben beim Wechsler)
    expect(exchangeMoney(23, DND_COINS, SALT)).toBe(4);
    expect(exchangeMoney(4, SALT, DND_COINS)).toBe(20);
  });
  it('zieht eine Gebühr in Prozent ab', () => {
    expect(exchangeMoney(1000, DND_COINS, SALT, { feePercent: 10 })).toBe(180);
  });
  it('ohne Kurs keine Zahl', () => {
    expect(exchangeMoney(100, DND_COINS, { ...SALT, rate: undefined })).toBeNull();
    expect(exchangeMoney(100, DND_COINS, { ...SALT, rate: 0 })).toBeNull();
  });
});

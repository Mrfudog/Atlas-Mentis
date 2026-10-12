/**
 * Eine Zuordnung: wie aus einem Eintrag einer 5e.tools-Art ein Artikel
 * unserer Art wird. Je Art eine, in der Reihenfolge aus Abgleich §4.2.
 */

import type { Entity } from '@nw/model';
import type { Knoten } from './copy.js';
import type { Werkbank } from './werkbank.js';

export interface Zuordnung {
  /** Der Schlüssel der Liste in 5e.tools (`monster`, `spell` …). */
  art: string;
  /** Unter welcher Marke der Artikel gefunden wird (`creature` für `monster`). */
  tag: string;
  /** Unsere Art, oder `undefined`: der Eintrag wird übersprungen (Grund in `notiz`). */
  typ(e: Knoten, wb: Werkbank): string | undefined;
  name(e: Knoten): string;
  /** Unter welchen Schlüsseln die Marke ihn findet; Vorgabe `[name, source]`. */
  schluessel?(e: Knoten): unknown[][];
  /**
   * Wenn zwei Einträge dieselbe Sache sind — dieselbe Klassenmerkmal auf
   * Stufe 4, 6 und 8 —, derselbe Schlüssel hier; dann gibt es einen Artikel.
   */
  vereinen?(e: Knoten): string | undefined;
  /** Die Schlüssel, die `fuellen` liest. Alle anderen stehen im Bericht. */
  genutzt: string[];
  /** Was ein Eintrag zusätzlich zur Herkunft braucht, um eindeutig zu sein. */
  herkunft?(e: Knoten): string;
  fuellen(wb: Werkbank, ent: Entity, e: Knoten): void;
}

/** Die sechs Attribute, wie 5e.tools und wir sie schreiben. */
export const ATTRIBUTE = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;

export const ATTRIBUT_NAME: Record<string, string> = {
  strength: 'str', dexterity: 'dex', constitution: 'con', intelligence: 'int', wisdom: 'wis', charisma: 'cha',
};

export const GROESSE: Record<string, string> = {
  T: 'tiny', S: 'small', M: 'medium', L: 'large', H: 'huge', G: 'gargantuan',
};

export const SCHADEN: Record<string, string> = {
  A: 'acid', B: 'bludgeoning', C: 'cold', F: 'fire', O: 'force', L: 'lightning', N: 'necrotic',
  P: 'piercing', I: 'poison', Y: 'psychic', R: 'radiant', S: 'slashing', T: 'thunder',
};

const AUSRICHTUNG: Record<string, string> = {
  L: 'lawful', N: 'neutral', NX: 'neutral', NY: 'neutral', C: 'chaotic', G: 'good', E: 'evil',
  U: 'unaligned', A: 'any alignment',
};

/** `["N","E"]` → „neutral evil", `["L","NX","C","E"]` → „any evil alignment". */
export function gesinnung(roh: unknown): string {
  if (!Array.isArray(roh)) return typeof roh === 'string' ? roh : '';
  if (roh.some((x) => typeof x === 'object')) {
    return (roh as unknown[])
      .map((x) => {
        if (typeof x !== 'object' || !x) return gesinnung([x]);
        const o = x as Knoten;
        if (o['special']) return String(o['special']);
        const teil = gesinnung(o['alignment']);
        return o['chance'] ? `${teil} (${o['chance']}%)` : teil;
      })
      .join(' or ');
  }
  const a = roh as string[];
  const s = new Set(a);
  if (a.length === 1) return a[0] === 'N' ? 'neutral' : (AUSRICHTUNG[a[0]!] ?? a[0]!);
  if (a.length === 2 && s.has('N') && !s.has('NX') && !s.has('NY')) return `neutral ${AUSRICHTUNG[a.find((x) => x !== 'N')!] ?? ''}`.trim();
  if (a.length === 2) return a.map((x) => AUSRICHTUNG[x] ?? x).join(' ');
  if (a.length === 4 && s.has('G')) return 'any good alignment';
  if (a.length === 4 && s.has('E')) return 'any evil alignment';
  if (a.length === 5 && !s.has('G')) return 'any non-good alignment';
  if (a.length === 5 && !s.has('E')) return 'any non-evil alignment';
  if (a.length === 5 && !s.has('L')) return 'any non-lawful alignment';
  if (a.length === 5 && !s.has('C')) return 'any non-chaotic alignment';
  if (a.length === 3 && s.has('C')) return 'any chaotic alignment';
  if (a.length === 3 && s.has('L')) return 'any lawful alignment';
  return a.map((x) => AUSRICHTUNG[x] ?? x).join(', ');
}

export function zahl(x: unknown): number | undefined {
  const n = typeof x === 'number' ? x : typeof x === 'string' ? Number(x.replace(/^\+/, '')) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

export function liste(x: unknown): unknown[] {
  return Array.isArray(x) ? x : x === undefined || x === null ? [] : [x];
}

/** Ein Wort mit grossem Anfang: `animal handling` → `Animal Handling`. */
export function titel(s: string): string {
  return s.replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

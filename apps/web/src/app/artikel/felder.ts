/**
 * Welche Eingabe ein Feld bekommt — aus dem Register, nicht aus einer Liste
 * von Sonderfällen je Artikelart.
 *
 * Das ist derselbe Schnitt wie im Prototyp: eine neue Artikelart ist ein
 * Einfügen und kein Codezweig, und das gilt nur, solange auch die Maske aus
 * den Zeilen liest.
 */

import type { PropertySchema } from '@nw/model';

export type Eingabe = 'text' | 'lang' | 'zahl' | 'jaNein' | 'auswahl' | 'liste';

export function eingabeArt(p: PropertySchema | undefined): Eingabe {
  if (!p) return 'text';
  if (Array.isArray(p.enum) && p.enum.length) return 'auswahl';
  if (p.type === 'boolean') return 'jaNein';
  if (p.type === 'number' || p.type === 'integer') return 'zahl';
  if (p.type === 'array') return 'liste';
  if (p.format === 'long') return 'lang';
  return 'text';
}

/** Der Wert aus dem Formular zurück in die Form, die das Register verlangt. */
export function ausEingabe(p: PropertySchema | undefined, roh: string | boolean): unknown {
  const art = eingabeArt(p);
  if (art === 'jaNein') return roh === true || roh === 'true';
  if (art === 'zahl') {
    const s = String(roh).trim();
    if (s === '') return undefined;
    const n = Number(s.replace(',', '.'));
    /* Unsinn wird nicht zu 0. Eine Zahl, die aus einem Tippfehler entsteht,
       ist schlimmer als ein leeres Feld — dasselbe Argument wie beim
       Rechenwerk. */
    return Number.isFinite(n) ? n : undefined;
  }
  if (art === 'liste') {
    const teile = String(roh)
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    return teile.length ? teile : undefined;
  }
  const s = String(roh);
  return s === '' ? undefined : s;
}

/** Und hinein: ein Feld zeigt, was drinsteht, und nicht „undefined". */
export function inEingabe(wert: unknown): string {
  if (wert === null || wert === undefined) return '';
  if (Array.isArray(wert)) return wert.join(', ');
  return String(wert);
}

/**
 * Welche Eingabe ein Feld bekommt — aus dem Register, nicht aus einer Liste
 * von Sonderfällen je Artikelart.
 *
 * Das ist derselbe Schnitt wie im Prototyp: eine neue Artikelart ist ein
 * Einfügen und kein Codezweig, und das gilt nur, solange auch die Maske aus
 * den Zeilen liest.
 */

import type { PropertySchema } from '@nw/model';

export type Eingabe = 'text' | 'lang' | 'zahl' | 'jaNein' | 'auswahl' | 'liste' | 'json' | 'verweis';

export function eingabeArt(p: PropertySchema | undefined): Eingabe {
  if (!p) return 'text';
  /* Ein Objekt oder eine Liste von Objekten (`Ancestry.abilityBonus`,
     `Table.rows`) passt in kein Textfeld: als Wort hiess es „[object
     Object]", und beim Speichern stand genau das in der Karte (W1). Bis es
     eine eigene Maske gibt, steht es als JSON da. */
  if (p.type === 'object' || (p.type === 'array' && p.items?.type === 'object')) return 'json';
  /* Auch ein Feld, das seine Werte in einer Aufzählungszeile nennt, ist
     eine Auswahl. Die Werte holt die Maske über `enumOptions()`; hier geht
     es nur um die Form der Eingabe. */
  /* Mehrere Werte passen in keine einfache Auswahl: ein `select` schrieb
     ein Wort in ein Feld, das eine Liste hält. Bis eine Mehrfachwahl da
     ist, ist es eine Liste — Übungen tragen seit M6 auch Namen, die keine
     Liste kennt (D50). */
  if (p.type === 'array') return 'liste';
  /* Ein Verweisfeld hält eine Artikel-Id; gewählt wird über die Suche der
     Liste (`nw-wahl`, W7), nicht durch Abtippen einer Id. */
  if (p.format === 'link') return 'verweis';
  if ((Array.isArray(p.enum) && p.enum.length) || p.enumRef) return 'auswahl';
  if (p.type === 'boolean') return 'jaNein';
  if (p.type === 'number' || p.type === 'integer') return 'zahl';
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
  if (art === 'json') {
    const s = String(roh).trim();
    if (s === '') return undefined;
    /* Unlesbares bleibt Text: die Prüfung sagt dann, dass das Feld ein
       Objekt verlangt — still verworfen wäre der alte Wert weg. */
    try {
      return JSON.parse(s) as unknown;
    } catch {
      return s;
    }
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
  if (typeof wert === 'object' && (!Array.isArray(wert) || wert.some((x) => x && typeof x === 'object')))
    return JSON.stringify(wert, null, 2);
  if (Array.isArray(wert)) return wert.join(', ');
  return String(wert);
}

/** Eine Kante im Entwurf — dasselbe wie eine gespeicherte, nur mit noch
 *  möglicherweise leerem Ziel. */
export interface KantenEntwurf {
  id: string;
  type: string;
  to: string;
  props: Record<string, unknown>;
}

/**
 * Der Entwurf zurück in Kanten.
 *
 * **Eine Kante ohne Ziel wird weggelassen**, nicht als leere geschrieben:
 * „zeigt auf nichts" ist im Modell kein Zustand, den eine Kante haben darf —
 * dafür gibt es das Feld. Der Server wiese sie ohnehin ab; sie gar nicht
 * erst zu schicken erspart eine Fehlermeldung, die nur sagt, was die Maske
 * schon wusste.
 */
export function kantenAusEntwurf(
  entwurf: KantenEntwurf[],
): { id: string; type: string; to: string; props: Record<string, unknown> }[] {
  return entwurf
    .filter((k) => k.to !== '' && k.type !== '')
    .map((k) => ({ id: k.id, type: k.type, to: k.to, props: { ...k.props } }));
}

/**
 * Ein gespeicherter Wert, wie er in der Feldtabelle steht. Ein Objekt ist
 * kein Text: `String()` machte daraus „[object Object]" (W1). Eine Zahl
 * darin ist ein Bonus und trägt ihr Vorzeichen („str +2, cha +1" — so
 * stehen `Ancestry.abilityBonus` und `Statblock.bonuses`), ein Text steht
 * mit seinem Schlüssel da („CREATURE: the creature").
 */
export function anzeigeWert(wert: unknown): string {
  if (wert === null || wert === undefined) return '';
  if (Array.isArray(wert)) {
    const teile = wert.map(anzeigeWert).filter((t) => t !== '');
    return teile.join(wert.some((x) => x && typeof x === 'object') ? '; ' : ', ');
  }
  if (typeof wert === 'object') {
    return Object.entries(wert as Record<string, unknown>)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([k, v]) =>
        typeof v === 'number' ? `${k} ${v >= 0 ? '+' : ''}${v}` : `${k}: ${anzeigeWert(v)}`,
      )
      .join(', ');
  }
  return String(wert);
}

/** Eine Zeile einer Tabelle, wie `Table.rows` sie hält. */
interface Tabellenzeile {
  cells: unknown[];
}

const istZeile = (x: unknown): x is Tabellenzeile =>
  !!x && typeof x === 'object' && Array.isArray((x as Tabellenzeile).cells);

/** Hält dieses Feld Tabellenzeilen (`[{cells: […]}, …]`)? */
export function sindZeilen(wert: unknown): wert is Tabellenzeile[] {
  return Array.isArray(wert) && wert.length > 0 && wert.every(istZeile);
}

/**
 * Tabellenzeilen als Markdown-Tabelle, damit sie derselbe Zeichner liest
 * wie jede Tabelle im Text — mit Verweisen und Würfeln in den Zellen (M10).
 * Ein Strich im Text wird `\|`, der Strich im Verweis bleibt
 * (`[[item-0263|Black opal]]`, `parseMarkdown` kennt ihn); eine Zeile mit
 * weniger Zellen als Spalten wird aufgefüllt.
 */
export function tabelleAlsText(spalten: unknown, zeilen: Tabellenzeile[]): string {
  const zelle = (x: unknown) =>
    anzeigeWert(x)
      .replace(/\s*\n\s*/g, ' ')
      .split(/(\[\[[^\]]*\]\])/)
      .map((teil, i) => (i % 2 ? teil : teil.replace(/(?<!\\)\|/g, '\\|')))
      .join('');
  const kopf = Array.isArray(spalten) ? spalten.map(zelle) : [];
  const breite = Math.max(kopf.length, ...zeilen.map((z) => z.cells.length));
  const auf = (z: string[]) => [...z, ...Array<string>(breite - z.length).fill('')];
  const zeile = (z: string[]) => `| ${auf(z).join(' | ')} |`;
  return [
    zeile(kopf),
    zeile(Array<string>(breite).fill('---')),
    ...zeilen.map((z) => zeile(z.cells.map(zelle))),
  ].join('\n');
}

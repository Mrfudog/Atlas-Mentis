/**
 * Welche Eingabe ein Feld bekommt — aus dem Register, nicht aus einer Liste
 * von Sonderfällen je Artikelart.
 *
 * Das ist derselbe Schnitt wie im Prototyp: eine neue Artikelart ist ein
 * Einfügen und kein Codezweig, und das gilt nur, solange auch die Maske aus
 * den Zeilen liest.
 */

import { enumGroups, enumRefKind, fieldsOf } from '@nw/model';
import type { PropertySchema, Registry } from '@nw/model';
import type { Suchgruppe } from './mehrfach';

export type Eingabe =
  | 'text'
  | 'lang'
  | 'zahl'
  | 'jaNein'
  | 'auswahl'
  | 'liste'
  | 'json'
  | 'verweis'
  | 'verweise'
  | 'mehrfach'
  | 'bild';

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
  /* Mehrere Verweise sind eine Auswahl mit Chips (T-068): „Revealed to"
     schlug hier eine freie Liste vor, in die man Ids tippen musste, und
     nahm jedes Wort. Zuerst gefragt, weil `type: 'array'` sonst gewönne. */
  if (p.type === 'array' && p.format === 'link') return 'verweise';
  /* Mehrere Werte aus Listen oder Arten (Übungen, D50): Chips mit
     Vorschlägen, aber ein freies Wort bleibt erlaubt — Übungen tragen seit
     M6 auch Namen, die keine Liste kennt. Ein `select` schrieb ein Wort in
     ein Feld, das eine Liste hält. */
  if (p.type === 'array' && (p.enumRef || (Array.isArray(p.enum) && p.enum.length))) return 'mehrfach';
  if (p.type === 'array') return 'liste';
  /* Ein Verweisfeld hält eine Artikel-Id; gewählt wird über die Suche der
     Liste (`nw-wahl`, W7), nicht durch Abtippen einer Id. */
  if (p.format === 'link') return 'verweis';
  /* Ein Bild wird hochgeladen oder gewählt, nicht als Id getippt (T-114). */
  if (p.format === 'asset') return 'bild';
  if ((Array.isArray(p.enum) && p.enum.length) || p.enumRef) return 'auswahl';
  if (p.type === 'boolean') return 'jaNein';
  if (p.type === 'number' || p.type === 'integer') return 'zahl';
  if (p.format === 'long') return 'lang';
  return 'text';
}

/** Der Wert aus dem Formular zurück in die Form, die das Register verlangt. */
export function ausEingabe(p: PropertySchema | undefined, roh: string | boolean | string[]): unknown {
  const art = eingabeArt(p);
  /* Chips halten ihre Werte als Liste: ein Name darf ein Komma tragen, und
     eine Id soll nicht erst zu Text und zurück. */
  if (Array.isArray(roh)) {
    const teile = [...new Set(roh.map((x) => x.trim()).filter(Boolean))];
    return teile.length ? teile : undefined;
  }
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

/** Die Werte eines Feldes mit Chips (`verweise`, `mehrfach`) — immer eine Liste. */
export function inListe(wert: unknown): string[] {
  if (wert === null || wert === undefined || wert === '') return [];
  return (Array.isArray(wert) ? wert : [wert]).filter((x) => x !== null && x !== undefined && x !== '').map(String);
}

/**
 * Ein Verweisfeld zum Lesen: je Id der Name und das Ziel, damit die Zelle
 * Links zeichnet statt Ids (T-068). Was der Betrachter nicht kennt, steht
 * ohne Ziel da — wie bei einer Kante, deren Ziel er nicht sehen darf.
 */
export function verweisZiele(
  wert: unknown,
  name: (id: string) => string | undefined,
): { ziel: string; text: string }[] {
  return inListe(wert).map((id) => {
    const n = name(id);
    return n === undefined ? { ziel: '', text: '(not here)' } : { ziel: id, text: n };
  });
}

/**
 * Woher eine Auswahl mit Chips ihre Vorschläge nimmt (T-068).
 *
 * - Ein Verweisfeld sucht in `target.interfaces` (die `extends`-Kette hoch,
 *   am Server über `of=`), und nur dort: die Art hält.
 * - Ein Feld mit `enumRef` nimmt die Werte seiner Listen und `Typ.feld` fest
 *   und sucht die Artikel jeder **Art**, die es nennt (D66 offen, M6) —
 *   eine Art mit `enumWhere` für sich, mit dem Filter als Feldfilter. Den
 *   kennt die Liste nur, wo das Feld eine Spalte der Art ist; sonst kommt
 *   die ganze Art, denn auch `enumWhere` ist ein Vorschlag (`enumHolds`).
 *
 * `frei` sagt, ob ein Wort ohne Vorschlag stehen darf: nur wo eine Art
 * genannt ist — ein Name ist der heutige Stand, und die Prüfung hält ihn
 * nicht fest. Eine reine Aufzählung hält, und ein Verweis braucht eine Id.
 */
export function suchgruppen(
  r: Pick<Registry, 'enums' | 'interfaces'>,
  p: PropertySchema | undefined,
): { gruppen: Suchgruppe[]; feste: string[]; frei: boolean } {
  if (!p) return { gruppen: [], feste: [], frei: true };
  if (p.format === 'link') return { gruppen: [{ of: p.target?.interfaces ?? [] }], feste: [], frei: false };
  const feste = [...(p.enum ?? [])];
  const offen: string[] = [];
  const gruppen: Suchgruppe[] = [];
  for (const g of enumGroups(r, p)) {
    if (g.from !== 'type') {
      for (const w of g.values) if (!feste.includes(w)) feste.push(w);
      continue;
    }
    const wo = p.enumWhere?.[g.name];
    if (!wo) {
      offen.push(g.name);
      continue;
    }
    const f = Object.entries(wo).flatMap(([feld, werte]) => {
      const def = fieldsOf(r, g.name).find((x) => x.key === feld);
      return def ? [`${def.type}.${feld}:${werte.join('|')}`] : [];
    });
    gruppen.push({ type: g.name, f });
  }
  if (offen.length) gruppen.unshift({ of: offen });
  const arten = [p.enumRef ?? []].flat().some((n) => enumRefKind(r, n) === 'type');
  return { gruppen, feste, frei: arten };
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

/** Steht in diesem Wert etwas? Ein leeres Wort, eine leere Liste, ein
 *  leeres Objekt und ein nicht gesetztes Häkchen zählen nicht. */
export function hatWert(wert: unknown): boolean {
  if (wert === null || wert === undefined || wert === '' || wert === false) return false;
  if (Array.isArray(wert)) return wert.length > 0;
  if (typeof wert === 'object') return Object.keys(wert).length > 0;
  return true;
}

/**
 * **Steht das Feld beim Bearbeiten gleich da** (T-195)? Pflichtfelder,
 * Felder mit Wert und die, die das Register vorn haben will (`prominent`,
 * `alwaysEdit`). Alles andere bleibt erreichbar, über „+ Add field“ — eine
 * Maske mit vierzig leeren Eingaben versteckt die fünf, um die es geht.
 *
 * **Die Vorgabe ist kein Wert**: was beim Anlegen aus `default` kam
 * (`deathFail: 0`, `audience: public`), hat niemand eingetragen. Zählte
 * es, stünden an jeder neuen Kreatur drei Nullen da.
 */
export function stehtDa(p: PropertySchema | undefined, wert: unknown, pflicht: boolean): boolean {
  if (pflicht || p?.prominent || p?.alwaysEdit) return true;
  if (p?.default !== undefined && JSON.stringify(p.default) === JSON.stringify(wert)) return false;
  return hatWert(wert);
}

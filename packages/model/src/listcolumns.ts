/**
 * **Die Spaltenwahl einer Übersicht** (T-343): welche Spalten eine Tabelle
 * in Kompendium, World, Story und Rules zeigen kann.
 *
 * Ohne Wahl zeigt eine Übersicht, was sie immer zeigte: die Felder der
 * `overview` der Art (`listColumns`), davor die Art in einer gemischten
 * Liste, dahinter die Quelle. Gewählt werden kann:
 *
 * - **ein Feld** der Art (`Typ.feld`), eigen oder geerbt, auch ein
 *   gerechnetes (`derived`) — gerechnet beim Lesen, für die Zeilen des
 *   Blatts (D8);
 * - **eine Kante** (`out.kante`, `in.kante`) mit den Namen der Artikel am
 *   anderen Ende — die Gegenrichtung ist eine Abfrage (K1);
 * - **eine Angabe jeder Zeile** (`@type`, `@source`, `@layers`, `@tags`,
 *   `@status`, `@id`, `@created`, `@updated`, `@addedBy`) — das, was jede
 *   Art hat.
 *
 * Was eine Wahl nennt, bleibt ein Name: eine Spalte, die das Register
 * nicht mehr kennt, steht leer und fällt beim nächsten Speichern weg.
 * Gesiebt wird am Server, wie jede Liste — eine gewählte Spalte zeigt nur,
 * was der Betrachter am Artikel sieht.
 */

import { fieldTitle, fieldsOf, typeChain } from './entity.js';
import type { PropertySchema, Registry } from './types.js';
import { LAYER_RELATION } from './visibility.js';

/** Die Angaben, die jede Zeile hat — unabhängig von der Art. */
export const BASE_COLUMNS = [
  { ref: '@type', label: 'Type' },
  { ref: '@source', label: 'Source' },
  { ref: '@layers', label: 'Layers' },
  { ref: '@tags', label: 'Tags' },
  { ref: '@status', label: 'Status' },
  { ref: '@id', label: 'ID' },
  /* Wann und von wem (T-382): gerechnet aus dem Server, nicht aus dem Artikel. */
  { ref: '@created', label: 'Added' },
  { ref: '@updated', label: 'Changed' },
  { ref: '@addedBy', label: 'Added by' },
] as const;

export type ColumnKind = 'number' | 'bool' | 'list' | 'text';

export interface ColumnChoice {
  /** `Typ.feld`, `out.kante`, `in.kante` oder `@angabe`. */
  ref: string;
  label: string;
  kind: ColumnKind;
  /** Wem das Feld gehört — für die Gruppen der Auswahl. */
  group: string;
  /** Gerechnet beim Lesen (D8). */
  derived?: boolean;
}

/** Steht diese Spalte jeder Zeile zu (und nicht einer Art)? */
export function isBaseColumn(ref: string): boolean {
  return ref.startsWith('@');
}

/** Welche Sorte Wert eine Spalte hält — danach richtet die Tabelle sie aus. */
export function columnKind(prop: PropertySchema): ColumnKind {
  if (prop.derived) return 'number';
  if (prop.type === 'array') return 'list';
  if (prop.type === 'boolean') return 'bool';
  if (prop.type === 'number' || prop.type === 'integer') return 'number';
  return 'text';
}

/**
 * Kann dieses Feld eine Spalte sein? Nicht Prosa (`long`, `many`) — eine
 * Zeile mit einem Kapitel darin ist keine Zeile —, keine Form (`grid`),
 * kein Bild und nichts nur zum Bearbeiten.
 */
export function columnField(prop: PropertySchema): boolean {
  if (prop.editOnly || prop.many || prop.entry) return false;
  return prop.format !== 'long' && prop.format !== 'grid' && prop.format !== 'asset' && prop.format !== 'color';
}

/**
 * Die Spalten, die eine Art anbietet: ihre Felder (eigene zuerst, die
 * geerbten danach, je Typ, der sie erklärt) und die Kanten von und nach
 * ihr mit einer genannten Art am anderen Ende.
 */
export function columnChoices(registry: Pick<Registry, 'interfaces' | 'relations'>, type: string): ColumnChoice[] {
  if (!registry.interfaces[type]) return [];
  const raus: ColumnChoice[] = [];
  for (const f of fieldsOf(registry, type)) {
    if (!columnField(f.prop)) continue;
    raus.push({
      ref: `${f.type}.${f.key}`,
      label: fieldTitle(registry, type, f),
      kind: columnKind(f.prop),
      group: registry.interfaces[f.type]?.label ?? f.type,
      ...(f.prop.derived ? { derived: true } : {}),
    });
  }
  const kette = typeChain(registry, type);
  const andere = (l: string[] | undefined) => (l ?? []).filter((t) => t !== '*' && t !== 'same');
  for (const def of Object.values(registry.relations ?? {})) {
    if (def.section || def.type === LAYER_RELATION) continue;
    if (def.from?.some((t) => kette.includes(t)) && andere(def.to).length) {
      raus.push({ ref: `out.${def.type}`, label: def.label || def.type, kind: 'list', group: 'Edges' });
    }
    if (def.to?.some((t) => kette.includes(t)) && andere(def.from).length) {
      raus.push({ ref: `in.${def.type}`, label: def.inverseLabel || def.label || def.type, kind: 'list', group: 'Edges' });
    }
  }
  return raus;
}

/**
 * **Der Schlüssel einer Wahl**: je Seite und Art — World ohne Art ist eine
 * andere Tabelle als World mit Zaubern, und die Zauber im Kompendium
 * dürfen anders aussehen als unter Rules.
 */
export function columnsKey(page: string, type?: string | null): string {
  return type ? `${page}|${type}` : page;
}

/** Was eine Wahl tragen darf: Namen in der Form einer Spalte, ohne Doppel, höchstens dreissig. */
export function cleanColumns(roh: unknown): string[] | null {
  const liste = Array.isArray(roh) ? roh : typeof roh === 'string' ? roh.split(',') : null;
  if (!liste) return null;
  const sauber = [
    ...new Set(
      liste
        .map((x) => (typeof x === 'string' ? x.trim() : ''))
        .filter((x) => /^(@[a-z][A-Za-z]*|(out|in)\.[A-Za-z][\w-]*|[A-Za-z][\w]*\.[A-Za-z][\w]*)$/.test(x)),
    ),
  ].slice(0, 30);
  return sauber;
}

/**
 * Die Namen, die eine Rechnung liest — ohne Funktionen und ohne
 * Kantenpfade (`sum(hasClass.level)` liest die Kanten). Fehlt einer davon
 * in den Karten, die der Betrachter sieht, steht die Spalte leer: eine 0
 * an Stelle eines zurückgehaltenen Werts wäre falsch, und eine Rechnung
 * darf kein verborgenes Feld verraten (E-098).
 */
export function derivedInputs(expr: string): string[] {
  const namen = new Set<string>();
  const ohneFunktionen = expr.replace(/([A-Za-z_][A-Za-z0-9_]*)\(\s*([A-Za-z0-9_.]+)\s*\)/g, (_g, _fn: string, arg: string) => {
    if (!arg.includes('.') && /^[A-Za-z_]/.test(arg)) namen.add(arg);
    return '0';
  });
  for (const m of ohneFunktionen.matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)) namen.add(m[0]);
  return [...namen];
}

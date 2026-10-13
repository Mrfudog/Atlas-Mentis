/**
 * **Was der Bestand an einer Registerzeile trägt** — gezählt, bevor jemand
 * sie ändert.
 *
 * Ein Feld zu löschen lässt seine Werte in den Artikeln stehen, wo sie
 * niemand mehr zeigt; einen Typ aus `extends` zu nehmen macht jede Karte
 * davon zu einer, die die Prüfung beim nächsten Speichern abweist
 * (`card_not_inherited`); einen Wert aus einer Aufzählung zu streichen
 * dasselbe mit `value_not_allowed`. Keins davon sieht man der Zeile an.
 * Darum zählt das Register vorher und sagt es — wie
 * `packages/registry/scripts/typ.mjs` mit einem Bestand.
 *
 * Gezählt wird der **ganze** Bestand, ungesiebt und ohne Stapel: was eine
 * Änderung bricht, bricht auch in einem Artikel, den gerade keine Ebene
 * aufschaltet. Darum gehört die Zahl nur denen, die das Register ändern.
 */

import { typeChain } from './entity.js';
import type { Entity, Registry } from './types.js';

export interface CardUsage {
  /** Artikel, die in dieser Karte überhaupt etwas tragen. */
  articles: number;
  /** Je Feld: in wie vielen Artikeln etwas darin steht. */
  fields: Record<string, number>;
}

export interface RegistryUsage {
  /** Je Art: Artikel, deren erste Art sie ist. */
  types: Record<string, number>;
  /** Je Karte (benannt nach der Art, die die Felder erklärt). */
  cards: Record<string, CardUsage>;
  /**
   * Je Feld mit einer Liste (`Typ.feld`): welcher Wert wie oft dasteht.
   * Nur für Felder, deren Liste **hält** — eine, die nur vorschlägt,
   * bricht nichts, wenn ein Wert fehlt.
   */
  values: Record<string, Record<string, number>>;
  /** Je Kantenart: wie viele Kanten es davon gibt. */
  relations: Record<string, number>;
  /**
   * Je Art: wie viele davon in der laufenden Kampagne im Stapel stehen
   * (`inPlay`, T-069) — neben `types`, das alles Gespeicherte zählt. Fehlt,
   * wenn es keine Kampagne gibt; dann ist alles da.
   */
  inPlay?: Record<string, number>;
  /** Die laufende Kampagne, gegen die `inPlay` gezählt ist. */
  campaign?: { id: string; name: string };
}

/** Leer heisst: nichts, was eine Änderung verlieren könnte. */
export function hasValue(v: unknown): boolean {
  if (v === undefined || v === null || v === '') return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v as object).length > 0;
  return true;
}

/** Die einzelnen Wörter eines Feldwerts — auch aus `many`-Einträgen `{id, value}`. */
function woerter(v: unknown): string[] {
  const liste = Array.isArray(v) ? v : [v];
  const out: string[] = [];
  for (const x of liste) {
    const w = x && typeof x === 'object' ? (x as { value?: unknown }).value : x;
    if (w !== undefined && w !== null && w !== '') out.push(String(w));
  }
  return out;
}

export function registryUsage(
  registry: Pick<Registry, 'interfaces'>,
  entities: Iterable<Entity>,
): RegistryUsage {
  const usage: RegistryUsage = { types: {}, cards: {}, values: {}, relations: {} };
  /* Welche Felder eine Liste tragen, die hält: eigene Wörter (`enum`) oder
     eine genannte Zeile. Ob die Zeile eine Aufzählung oder eine Art ist,
     entscheidet erst die Maske — gezählt wird hier jedes Wort. */
  const mitListe = new Set<string>();
  for (const [typ, def] of Object.entries(registry.interfaces)) {
    for (const [key, p] of Object.entries(def.schema?.properties ?? {})) {
      if ((p.enum && p.enum.length) || p.enumRef) mitListe.add(`${typ}.${key}`);
    }
  }
  for (const e of entities) {
    const typ = e.interfaces?.[0];
    if (typ) usage.types[typ] = (usage.types[typ] ?? 0) + 1;
    for (const [karte, werte] of Object.entries(e.components ?? {})) {
      if (!werte || typeof werte !== 'object') continue;
      let traegt = false;
      const c = (usage.cards[karte] ??= { articles: 0, fields: {} });
      for (const [feld, wert] of Object.entries(werte)) {
        if (!hasValue(wert)) continue;
        traegt = true;
        c.fields[feld] = (c.fields[feld] ?? 0) + 1;
        const ref = `${karte}.${feld}`;
        if (!mitListe.has(ref)) continue;
        const zaehler = (usage.values[ref] ??= {});
        for (const w of woerter(wert)) zaehler[w] = (zaehler[w] ?? 0) + 1;
      }
      if (traegt) c.articles += 1;
    }
    for (const r of e.relations ?? []) {
      usage.relations[r.type] = (usage.relations[r.type] ?? 0) + 1;
    }
  }
  return usage;
}

/** Artikel, deren Art diese ist **oder von ihr erbt** — wer ihre Felder trägt. */
export function articlesTaking(
  registry: Pick<Registry, 'interfaces'>,
  usage: Pick<RegistryUsage, 'types'>,
  type: string,
): number {
  let n = 0;
  for (const [t, z] of Object.entries(usage.types)) {
    if (typeChain(registry, t).includes(type)) n += z;
  }
  return n;
}

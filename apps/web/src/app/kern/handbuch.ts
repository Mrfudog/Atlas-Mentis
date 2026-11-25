/**
 * **Das Handbuch** (T-242, T-225): eine Seite mit Kapiteln, eine Quelle
 * für alle Erklärungen.
 *
 * Was erzeugt werden kann, wird erzeugt und nicht abgetippt:
 * - „Pages" sind die Hilfetexte aus `help.json` (dieselben wie hinter „?"),
 * - „Rules & options" kommt aus `RULE_SORTS`/`RULE_OPTIONS` (`does`),
 * - „Article types" und „Glossary" aus `GET /api/glossary` (die Wörter der
 *   App aus `@nw/registry`, die Glossarartikel aus dem Stapel).
 * Nur „First steps" und „Workflows" stehen als Text in `handbook.json`.
 *
 * Die Prüfung (`test/handbuch.test.ts`) verlangt jedes Kapitel und jeden
 * Abschnitt mit eigener Id; eine neue Seite oder Regeloption kommt ohne
 * Zutun hinein, ein fehlender Text fällt dort auf.
 */

import daten from '../../handbook.json';
import { RULE_OPTIONS, RULE_SORTS, type RuleOptionDef, type RuleSortDef } from '@nw/model';
import type { HilfeAbschnitt } from './hilfe';

export interface HandbuchKapitel {
  id: string;
  title: string;
  intro: string;
  /** Eigener Text; die erzeugten Kapitel haben keinen. */
  sections?: HilfeAbschnitt[];
}

export const KAPITEL: readonly HandbuchKapitel[] = (daten as { chapters: HandbuchKapitel[] }).chapters;

/** Die erzeugten Kapitel — ihr Inhalt kommt nicht aus `handbook.json`. */
export const ERZEUGT = ['pages', 'rules', 'types', 'glossary'] as const;

/** „Rules & options": je Sorte ihre Optionen. */
export function regelKapitel(): { sorte: RuleSortDef; optionen: RuleOptionDef[] }[] {
  return RULE_SORTS.map((sorte) => ({ sorte, optionen: RULE_OPTIONS.filter((o) => o.sort === sorte.key) })).filter((k) => k.optionen.length);
}

/** Der Anfangsbuchstabe für die Buchstabenleiste; Ziffern und Zeichen unter „#". */
export function buchstabe(term: string): string {
  const b = term.trim().charAt(0).toUpperCase();
  return /\p{L}/u.test(b) ? b.normalize('NFD').charAt(0) : '#';
}

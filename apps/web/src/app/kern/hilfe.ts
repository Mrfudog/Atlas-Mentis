/**
 * **Hilfe je Seite** (T-205): kurze Texte zu der Seite, auf der man steht,
 * und darunter die What's-new-Einträge, deren `link` dorthin zeigt.
 *
 * Die Texte liegen in `src/help.json`, je Eintrag mit den Routen
 * (`app.routes.ts`, Pfade wie dort geschrieben), für die er gilt. Eine
 * Route ohne Text steht unter `without` mit Grund — die Prüfung
 * (`test/hilfe.test.ts`) verlangt das eine oder das andere, sonst hätte
 * eine neue Seite ein „?“, das nichts sagt.
 *
 * Die Zuordnung rechnet aus der Adresse, nicht aus dem Router: so gilt
 * dieselbe Rechnung für den Hilfetext und für die Links der Einträge, die
 * ebenfalls nur Adressen sind. `whats-new.json` bleibt, wie es ist (E-055
 * offen).
 */

import daten from '../../help.json';
import type { NeuEintrag } from './neues';

export interface HilfeAbschnitt {
  heading?: string;
  /** Absätze, je einer ein Satz oder zwei — Text, kein Markdown. */
  text: string[];
}

export interface HilfeSeite {
  /** Routenpfade wie in `app.routes.ts` (`read/:layer`). */
  routes: string[];
  title: string;
  sections: HilfeAbschnitt[];
}

export const HILFE: readonly HilfeSeite[] = (daten as { pages: HilfeSeite[] }).pages;
/** Routen ohne Hilfetext, mit dem Grund. */
export const OHNE_HILFE: Readonly<Record<string, string>> = (daten as { without: Record<string, string> }).without;

/** Die Teile einer Adresse ohne Abfrage, Anker und Schrägstriche aussen. */
function teile(url: string): string[] {
  const pfad = url.split(/[?#]/)[0].replace(/^\/+|\/+$/g, '');
  return pfad ? pfad.split('/') : [];
}

/** Passt die Adresse auf den Routenpfad? `:x` nimmt genau einen Teil. */
export function passt(muster: string, url: string): boolean {
  const m = muster ? muster.split('/') : [];
  const u = teile(url);
  return m.length === u.length && m.every((t, i) => t.startsWith(':') || t === u[i]);
}

/** Der Routenpfad, auf den die Adresse zeigt — unter denen mit Hilfe.
 *  Ein fester Teil schlägt einen Platzhalter (`characters/new` vor
 *  `characters/:id`). */
export function routeVon(url: string, seiten: readonly HilfeSeite[] = HILFE): string | null {
  const treffer = seiten.flatMap((s) => s.routes).filter((r) => passt(r, url));
  const fest = (r: string) => r.split('/').filter((t) => !t.startsWith(':')).length;
  return treffer.sort((a, b) => fest(b) - fest(a))[0] ?? null;
}

/** Der Hilfetext der Seite, auf der man steht. */
export function hilfeFuer(url: string, seiten: readonly HilfeSeite[] = HILFE): HilfeSeite | null {
  const r = routeVon(url, seiten);
  return r === null ? null : (seiten.find((s) => s.routes.includes(r)) ?? null);
}

/** Die Einträge von What's new für diese Seite: deren Link auf dieselbe
 *  Route führt wie die Adresse. Die Reihenfolge bleibt — neueste zuerst. */
export function neuesFuer(
  url: string,
  eintraege: readonly NeuEintrag[],
  seiten: readonly HilfeSeite[] = HILFE,
): NeuEintrag[] {
  const r = routeVon(url, seiten);
  if (r === null) return [];
  return eintraege.filter((e) => !!e.link && routeVon(e.link, seiten) === r);
}

/**
 * **Der Abschnitt im Handbuch** (T-242, T-225), der den Hilfetext einer
 * Seite trägt: das Handbuch zeigt dieselben Texte im Kapitel „Pages", und
 * „?" wie What's new verlinken genau dorthin. Der Anker kommt aus der
 * ersten Route — `read/:layer` wird `page-read-layer`.
 */
export function abschnittId(seite: HilfeSeite): string {
  return `page-${(seite.routes[0] ?? 'start').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'start'}`;
}

/** Der Handbuchabschnitt zu einer Adresse, `null` ohne Hilfetext. */
export function abschnittFuer(url: string, seiten: readonly HilfeSeite[] = HILFE): string | null {
  const s = hilfeFuer(url, seiten);
  return s ? abschnittId(s) : null;
}

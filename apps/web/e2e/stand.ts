/**
 * Was der Aufbau eines Laufs anlegt und die Specs lesen (T-356).
 *
 * Drei Konten mit festen Namen: die **Verwaltung** richtet ein und räumt
 * auf, geprüft wird als **Leitung** (`gm` der Testkampagne, kein Admin —
 * die Verwaltung sieht alles und verdeckte so jeden Fehler der Siebung)
 * und als **Spielerin** (`player`). Die Kampagne ist je Lauf neu.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ORDNER = fileURLToPath(new URL('./.stand/', import.meta.url));
export const PASSWORT = 'e2e-nebel-wacht-am-tor';

export const KONTEN = {
  verwaltung: 'e2e-verwaltung',
  leitung: 'e2e-leitung',
  spielerin: 'e2e-spielerin',
} as const;
export type Rolle = keyof typeof KONTEN;

/** Angemeldete Sitzung je Konto, als Playwright-`storageState`. */
export const sitzungDatei = (rolle: Rolle): string => join(ORDNER, `${rolle}.json`);

export interface Lauf {
  /** Kennung des Laufs, steht im Namen jedes Testartikels. */
  id: string;
  campaign: { id: string; name: string; layer: string };
  /** Die Figur der Spielerin (`app_user_actor`): ihre Züge, ihr Bogen. */
  figur: { id: string; name: string };
}

export const laufDatei = join(ORDNER, 'lauf.json');
export const leseLauf = (): Lauf => JSON.parse(readFileSync(laufDatei, 'utf8')) as Lauf;

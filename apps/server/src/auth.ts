/**
 * Zugang (REQ-031, 032): ein Passwort je Nutzer.
 *
 * Die Anwendung bindet auf 127.0.0.1 und der Reverse Proxy ist das, was nach
 * aussen zeigt — aber „nur das Heimnetz" ist keine Zugangskontrolle, sondern
 * eine Annahme über das Heimnetz. Hier steht die Kontrolle selbst.
 *
 * Drei Entscheidungen, die den Rest erklären:
 *
 * **Ohne Nutzer schreibt niemand.** Ein frischer Server hat kein Konto, also
 * auch kein Standardpasswort, das jemand vergisst zu ändern. Er liest sich
 * selbst vor, wie man das erste anlegt, und weigert sich bis dahin.
 *
 * **Die Sitzung liegt beim Server.** Ein signierter Keks mit den Rechten
 * darin liesse sich nicht widerrufen. Eine Zeile in der Datenbank schon, und
 * „alle Geräte abmelden" ist dann ein DELETE.
 *
 * **Gespeichert wird der Hash des Tokens.** Wer die Datenbank liest, kann
 * sich damit trotzdem nicht anmelden — dieselbe Überlegung wie beim
 * Passwort, eine Ebene weiter.
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import type { TableRole } from '@nw/model';

/** Wie lange eine Sitzung ohne Wiedersehen gilt. Eine Woche: lange genug,
 *  dass niemand mitten in der Sitzung herausfliegt, kurz genug, dass ein
 *  vergessenes Gerät nicht ewig offen steht. */
export const SESSION_DAYS = 7;
/** Fehlversuche je Konto und Herkunft, bevor gewartet werden muss. */
export const MAX_ATTEMPTS = 8;
export const ATTEMPT_WINDOW_MINUTES = 15;

export interface User {
  id: string;
  name: string;
  isAdmin: boolean;
  /** **Mehrere Figuren je Konto.** Wer zwei spielt, ist trotzdem eine
   *  Person: was die eine erfahren hat, weiss er auch, wenn er auf die
   *  andere schaut, und die Freigabeliste zeigt einen Absender. */
  actorIds: string[];
  /** **Die Rolle je Kampagne** — Kampagnen-Id → `gm ǀ co-gm ǀ player ǀ
   *  spectator`. Sie steht am Konto und in keinem Artikel: eine Figur sagt
   *  nicht, in welcher Runde ihr Konto was ist, und eine Kontoangabe in
   *  einem Artikel wanderte beim Export mit (REQ-199). `isAdmin` ist etwas
   *  anderes — die Verwaltung der ganzen Installation. */
  roles: Record<string, TableRole>;
  disabledAt?: string | undefined;
}

/** Eine Einladung: ein Code, der eine Registrierung erlaubt, und sonst
 *  nichts. Gespeichert wird sein Hash — wer die Datenbank liest, soll sich
 *  damit nicht einladen können. */
export interface Invite {
  codeHash: string;
  label?: string | undefined;
  isAdmin: boolean;
  /** Bindet die neue Person gleich an eine Figur. Das ist der „spezifische
   *  Link": einer, der weiss, wer kommt. */
  actorId?: string | undefined;
  /** `undefined` heisst unbegrenzt — der Link, den man einmal in die Gruppe
   *  stellt. Eine Einladung je Person wäre genauer und würde bei fünf
   *  Leuten viermal vergessen. */
  usesLeft?: number | undefined;
  expiresAt?: string | undefined;
  createdBy?: string | undefined;
}

export interface Viewer {
  user: User;
  token: string;
}

/** Kleingeschrieben und ohne Randraum: „Basil" und „basil " sind dieselbe
 *  Person. Zwei Konten, die sich nur in der Schreibweise unterscheiden, sind
 *  eine Falle und kein Merkmal. */
export function foldName(name: string): string {
  return String(name ?? '').trim().toLocaleLowerCase('de');
}

/**
 * Was ein Passwort mindestens sein muss. Bewusst nur eine Länge und keine
 * Zeichenklassen: Klassenregeln erzeugen `Passwort1!` und sonst nichts, und
 * sie verbieten die Passphrase, die tatsächlich hilft.
 */
export const MIN_PASSWORD = 12;
export function passwordProblem(password: string): string | null {
  const p = String(password ?? '');
  if (p.length < MIN_PASSWORD) return `Mindestens ${MIN_PASSWORD} Zeichen.`;
  if (p.trim().length === 0) return 'Nur Leerzeichen ist kein Passwort.';
  return null;
}

/* Argon2id. Die Zahl statt `Algorithm.Argon2id`, weil der Aufzählungstyp
   des Moduls ein `const enum` ist und sich unter `isolatedModules` nicht
   lesen lässt — der Wert steht im erzeugten Hash (`$argon2id$`), und genau
   den prüft der Test. */
const ARGON2ID = 2;
export async function hashPassword(password: string): Promise<string> {
  return argonHash(password, { algorithm: ARGON2ID });
}
/** Ein kaputter Hash gilt als falsches Passwort und nicht als Ausnahme —
 *  sonst verrät die Fehlermeldung, welches Konto einen hat. */
export async function checkPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argonVerify(hash, password);
  } catch {
    return false;
  }
}

export function newSessionToken(): string {
  return randomBytes(32).toString('base64url');
}
/** Ein Einladungscode. Kürzer als ein Sitzungstoken, weil er in einen Link
 *  und notfalls in eine Sprachnachricht passen muss — 16 Byte sind immer
 *  noch mehr, als sich erraten lässt. Gespeichert wird nur sein Hash. */
export function newInviteCode(): string {
  return randomBytes(16).toString('base64url');
}
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
/** Gleich lang, gleich lange verglichen. Bei Sitzungstoken ist das die
 *  billigste Vorsichtsmassnahme, die es gibt. */
export function sameToken(a: string, b: string): boolean {
  const x = Buffer.from(a, 'utf8');
  const y = Buffer.from(b, 'utf8');
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}

export function sessionExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * Wer was darf. Die Regel ist absichtlich kurz, weil eine lange Regel
 * niemand mehr nachliest: die Spielleitung darf alles, ein Spieler darf
 * lesen und genau die Artikel schreiben, die seiner Figur gehören.
 *
 * „Gehört" heisst: die Figur selbst, und was über eine Kante an ihr hängt —
 * ihr Inventar zum Beispiel. Die Kante steht in den Daten, also wird sie
 * dort nachgesehen und nicht hier behauptet.
 */
export function mayWrite(user: User | null, ownedIds: Set<string>, id: string): boolean {
  if (!user || user.disabledAt) return false;
  if (user.isAdmin) return true;
  return ownedIds.has(id);
}

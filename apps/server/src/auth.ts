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
import { isLayer, layersOf, type Entity, type TableRole } from '@nw/model';

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
  /** **In welcher Kampagne eine Figur dem Konto gehört** (T-412,
   *  Entscheid der Leitung 23.10.: „pro Kampagne zuweisen") — Figur →
   *  Kampagne. Fehlt eine Figur hier, ist die Kampagne unbekannt (Bestand
   *  vor Migration 156, den sie nicht zuordnen konnte); dann gilt sie wie
   *  bisher überall. `actorIds` einer Anfrage nennt nur die Figuren der
   *  laufenden Kampagne (`inKampagne`). */
  actorCampaigns?: Record<string, string>;
  /** **Die Rolle je Kampagne** — Kampagnen-Id → `gm ǀ co-gm ǀ player ǀ
   *  spectator`. Sie steht am Konto und in keinem Artikel: eine Figur sagt
   *  nicht, in welcher Runde ihr Konto was ist, und eine Kontoangabe in
   *  einem Artikel wanderte beim Export mit (REQ-199). `isAdmin` ist etwas
   *  anderes — die Verwaltung der ganzen Installation. */
  roles: Record<string, TableRole>;
  /** **Was dieses Konto angelegt hat** (REQ-237, E-011): die Artikel, die
   *  es als Spielerin angelegt hat. Sie gehören ihr zum Schreiben, und sie
   *  sieht sie in jedem Stand. Steht am Server neben dem Konto
   *  (`app_user_article`), nicht im Artikel — eine Konto-Id im Artikel
   *  wanderte beim Export mit (REQ-199). Gesetzt nur von der Ablage;
   *  `putUser` schreibt es nicht. */
  authoredIds?: string[] | undefined;
  /** **Die Ebenen, die dieses Konto bearbeitet** (T-098, E-001): darin
   *  schreibt es jeden Artikel und legt neue an. Steht am Server neben dem
   *  Konto (`app_user_layer`), nicht an der Ebene — eine Konto-Id in einem
   *  Artikel wanderte beim Export mit (REQ-199). Die Ebene der Kampagne
   *  steht hier nicht: die schreiben `gm` und `co-gm` von selbst. Gesetzt
   *  nur von der Ablage; `putUser` schreibt es nicht. */
  layerIds?: string[] | undefined;
  /** Davon die, die es **besitzt** — angelegt oder übertragen. Wer eine
   *  Ebene besitzt, sagt, wer sonst darin schreibt. */
  ownedLayerIds?: string[] | undefined;
  disabledAt?: string | undefined;
  /** **Seit wann es das Konto gibt** (T-163): „What's new" zeigt nur, was
   *  danach kam — wer neu dazukommt, braucht nicht die ganze Geschichte.
   *  Aus `app_user.created_at`; `putUser` schreibt es nicht. */
  createdAt?: string | undefined;
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
  createdAt?: string | undefined;
  /** **Wohin die Einladung führt** (W3): eine Kampagne und die Rolle darin.
   *  Ohne sie musste die Leitung das neue Konto danach suchen — und eine
   *  Leitung, die nicht Verwaltung ist, sieht die Kontoliste gar nicht. Wer
   *  welche Rolle hat, steht danach trotzdem am Konto (`campaign_member`),
   *  nicht an der Einladung: die ist mit dem letzten Gebrauch weg. */
  campaignId?: string | undefined;
  role?: TableRole | undefined;
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
 * niemand mehr nachliest: die Verwaltung darf alles, jedes andere Konto
 * schreibt genau die Artikel, die seiner Figur gehören, die es selbst
 * angelegt hat (REQ-237) — und die in Ebenen liegen, die es bearbeitet
 * (T-098, E-001: eigene, zugeteilte und als `gm`/`co-gm` die Ebene der
 * Kampagne; `inWritableLayers`).
 *
 * „Gehört" heisst: die Figur selbst, und was über eine Kante an ihr hängt —
 * ihr Inventar zum Beispiel. Die Kante steht in den Daten, also wird sie
 * dort nachgesehen und nicht hier behauptet. Was er angelegt hat, steht
 * neben dem Konto (`authoredIds`); `ownedIds` bringt alles mit.
 */
export function mayWrite(user: User | null, ownedIds: Set<string>, id: string): boolean {
  if (!user || user.disabledAt) return false;
  if (user.isAdmin) return true;
  return ownedIds.has(id);
}

/**
 * **Liegt dieser Artikel ganz in Ebenen, die geschrieben werden dürfen?**
 * (T-098, E-001) Jede Ebene, die ihn bringt (`layersOf`, ohne `removes`),
 * muss darunter sein: ein Artikel, der auch in einem geteilten Regelwerk
 * liegt, änderte sonst dort mit. Ohne Ebene liegt er in keiner fremden,
 * aber auch in keiner eigenen — er bleibt bei der Verwaltung, und wer ihn
 * ändern will, legt eine Fassung an. Eine Ebene selbst schreibt, wer
 * darin schreibt.
 */
export function inWritableLayers(e: Entity, writable: ReadonlySet<string>): boolean {
  if (!writable.size) return false;
  if (isLayer(e) && writable.has(e.id)) return true;
  const ebenen = layersOf(e);
  return ebenen.length > 0 && ebenen.every((l) => writable.has(l));
}

// ------------------------------------------------------------ API-Tokens

/**
 * **Ein Token für Werkzeuge** (W9): ein Skript, eine Claude-Sitzung, ein
 * Kommandozeilenaufruf — alles, was keinen Keks hält. Es wirkt wie die
 * Sitzung seines Kontos, beschränkt auf `read` oder `write`, und sieht und
 * darf nie mehr als das Konto: gesiebt wird mit dessen Rollen und Figuren,
 * geschrieben mit dessen Rechten. Gespeichert wird nur der Hash, wie bei
 * Sitzung und Einladung; der Klartext steht genau einmal in der Antwort auf
 * das Anlegen.
 */
export type TokenScope = 'read' | 'write';
export const TOKEN_SCOPES: readonly TokenScope[] = ['read', 'write'];
/** Ein Token läuft ab — eines, das ewig gilt, vergisst man irgendwo. */
export const TOKEN_DAYS_DEFAULT = 30;
export const TOKEN_DAYS_MAX = 365;

export interface ApiToken {
  id: string;
  userId: string;
  name: string;
  tokenHash: string;
  scope: TokenScope;
  expiresAt: string;
  createdAt?: string | undefined;
  lastUsedAt?: string | undefined;
}

/** Am Präfix erkennt man, was es ist, wenn es irgendwo auftaucht (Log, Umgebung). */
export function newApiToken(): string {
  return `atm_${randomBytes(32).toString('base64url')}`;
}

export function tokenExpiry(days: unknown, from: Date = new Date()): Date {
  const n = Math.floor(Number(days ?? TOKEN_DAYS_DEFAULT));
  const tage = Number.isFinite(n) && n > 0 ? Math.min(n, TOKEN_DAYS_MAX) : TOKEN_DAYS_DEFAULT;
  return new Date(from.getTime() + tage * 24 * 60 * 60 * 1000);
}

/**
 * **Ablauf als Datum** (T-112): die Maske fragt „bis wann", nicht „wie
 * viele Tage". Ein Tag ohne Uhrzeit gilt bis zu seinem Ende (UTC). Was
 * schon vorbei ist, wird abgelehnt, nicht still auf die Vorgabe gesetzt —
 * wer ein Datum nennt, meint es; was weiter als 365 Tage reicht, wird auf
 * die Grenze gekürzt, wie bei den Tagen.
 */
export function tokenExpiryAt(value: unknown, from: Date = new Date()): Date | null {
  const roh = String(value ?? '').trim();
  const tag = /^\d{4}-\d{2}-\d{2}$/.test(roh);
  const d = new Date(tag ? `${roh}T23:59:59.999Z` : roh);
  if (!roh || Number.isNaN(d.getTime()) || d.getTime() <= from.getTime()) return null;
  const grenze = from.getTime() + TOKEN_DAYS_MAX * 24 * 60 * 60 * 1000;
  return new Date(Math.min(d.getTime(), grenze));
}

/**
 * **Leitung oder Verwaltung** — wer die Werkbank benutzen darf. Leitung
 * heisst `gm` oder `co-gm` in irgendeiner Kampagne; geschrieben wird
 * trotzdem nur, was `mayWrite` erlaubt — für die Leitung die Artikel in
 * den Ebenen, die sie bearbeitet (T-098).
 */
export function isLeitung(user: User | null): boolean {
  if (!user || user.disabledAt) return false;
  if (user.isAdmin) return true;
  return Object.values(user.roles ?? {}).some((r) => r === 'gm' || r === 'co-gm');
}

// ------------------------------------------------------------ Spielersicht

/** Der Anfragekopf, mit dem die Leitung die Sicht eines Mitglieds einnimmt
 *  (REQ-241, E-019 a). Die Oberfläche setzt ihn je Tab. */
export const VIEW_AS_HEADER = 'x-view-as';

/**
 * **Wer wessen Sicht einnehmen darf** (REQ-241, E-019 a): die Leitung
 * (`gm`, `co-gm`) der laufenden Kampagne und die Verwaltung, und nur für
 * ein Mitglied dieser Kampagne. Ohne laufende Kampagne niemand.
 *
 * Die Verwaltung sieht ohnehin alles; die Leitung nicht. Darum darf die
 * Leitung keine Verwaltung einnehmen — sie sähe sonst mehr als sich selbst.
 */
export function mayViewAs(user: User | null, target: User | null, campaignId: string | null): boolean {
  if (!user || user.disabledAt || !target || target.disabledAt || !campaignId) return false;
  if (!target.roles?.[campaignId]) return false;
  if (user.isAdmin) return true;
  if (target.isAdmin) return false;
  const rolle = user.roles?.[campaignId];
  return rolle === 'gm' || rolle === 'co-gm';
}

/**
 * **Das Zielkonto, wie die Leitung es sieht** (REQ-241): dieselben
 * Figuren, dasselbe Eigene, aber nur die Rolle in der laufenden Kampagne.
 * Leitet das Ziel anderswo, sähe die Leitung über die geteilten Ebenen
 * sonst, was dort nur dessen Leitung sieht. Die Verwaltung bekommt das
 * Konto ganz.
 */
export function viewedAs(user: User, target: User, campaignId: string): User {
  if (user.isAdmin) return target;
  const rolle = target.roles[campaignId];
  return { ...target, roles: rolle ? { [campaignId]: rolle } : {} };
}

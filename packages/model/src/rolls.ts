/**
 * **Würfe im Protokoll** (T-172, REQ-070): ein Wurf auf einem Artikel ist
 * ein Eintrag `roll` im `event_log`, `subject` der Artikel, auf dem
 * gewürfelt wurde. Kein eigenes Speicherfach — das Protokoll ist
 * append-only, und genau das soll ein Wurf sein: niemand würfelt nach, was
 * er nicht mag, und ein gelöschter Artikel nimmt seine Würfe nicht mit.
 *
 * Hier steht, was ein Eintrag trägt und **wer ihn sieht** — dieselbe
 * Rechnung für die Route und den Live-Kanal.
 */

import type { DiceRoll } from './dice.js';
import type { EntityId } from './types.js';
import { tableRole, type TableRole } from './visibility.js';

/** Ein Wurf, wie er im Protokoll steht (`payload`) — ohne Id und Zeit. */
export interface RollPayload {
  /** Der Ausdruck, wie er gewürfelt wurde (mit Vorteil schon umgeschrieben). */
  expr: string;
  /** Was da stand, bevor Vorteil oder Nachteil ihn umschrieben. */
  asked?: string;
  total: number;
  /** Die einzelnen Würfel und festen Glieder. */
  rolls: DiceRoll['rolls'];
  /** Die Summe der festen Glieder. */
  modifier: number;
  mode?: 'adv' | 'dis';
  /** Der gezählte W20, wenn es genau einen gibt. */
  nat?: number;
  crit?: 'crit' | 'fumble';
  /** Welche Aktion, welches Feld — „Bite", „Crafting check". */
  label?: string;
  by: { id: string; name: string };
  /** Die Figur, für die gewürfelt wurde. */
  actor?: { id: EntityId; name: string };
  campaign: EntityId | null;
  session: EntityId | null;
  /** Nur die Leitung (und wer gewürfelt hat) sieht Ergebnis und Eintrag. */
  hidden?: true;
  /** Am Tisch gewürfelt und eingetragen (Handwerksprobe), nicht hier. */
  entered?: true;
}

/** Ein Eintrag, wie die Route ihn ausliefert. */
export interface RollEntry extends RollPayload {
  id: string;
  at: string;
  subject: EntityId | null;
  /** Der Name des Artikels; `null`, wenn er gelöscht ist („deleted article"). */
  subjectName?: string | null;
}

/** Wer einen Eintrag sehen will — die Teile eines Kontos, die zählen. */
export interface RollViewer {
  id: string;
  isAdmin?: boolean;
  roles?: Readonly<Record<EntityId, TableRole>>;
}

/**
 * **Sieht dieses Konto den Wurf?** `subjectVisible` ist die Antwort von
 * `articleVisible` (über das Sieb) für den Artikel, auf dem gewürfelt
 * wurde: `false` heisst verborgen, `null` gelöscht oder ohne Artikel.
 *
 * Die grobe Frage zuerst: wer den Artikel nicht sieht, sieht seine Würfe
 * nicht — auch nicht die eigenen. Danach: wer gewürfelt hat, sieht ihn;
 * die Leitung der Kampagne des Wurfs sieht jeden; einen verdeckten
 * (`hidden`) sonst niemand; alle übrigen mit einem Platz am Tisch dieser
 * Kampagne. Die Verwaltung sieht alles, wie überall.
 */
export function rollVisible(entry: Pick<RollPayload, 'by' | 'campaign' | 'hidden'>, viewer: RollViewer | null, subjectVisible: boolean | null): boolean {
  if (!viewer) return false;
  if (viewer.isAdmin) return true;
  if (subjectVisible === false) return false;
  if (entry.by?.id === viewer.id) return true;
  if (!entry.campaign) return false;
  const rolle = tableRole({ roles: viewer.roles ?? {} }, entry.campaign);
  if (rolle === 'gm' || rolle === 'co-gm') return true;
  if (entry.hidden) return false;
  return rolle !== null;
}

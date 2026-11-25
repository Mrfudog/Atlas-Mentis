/**
 * Das Werkzeug des Registers: schreiben, zählen, nachfragen.
 *
 * **Geschrieben wird ein ganzer Teil** (`PUT /api/registry/:part`), und der
 * Server prüft ihn im Zusammenhang des ganzen Registers (`RegistrySchema`).
 * Geändert wird eine Kopie; erst wenn der Server sie nimmt, steht sie hier
 * (`Bestand.registerSchreiben`). Eine Zeile, die er abweist, soll auch die
 * Seite nicht zeigen.
 *
 * **Gezählt wird vorher** (`/api/registry/usage`): was ein gelöschtes Feld
 * noch trägt, welche Karten ein herausgenommener Typ verwaist, welche
 * Artikel einen gestrichenen Wert führen. Gesagt wird es in der Rückfrage,
 * bevor etwas geschieht — ein stiller Verlust sieht später aus wie ein
 * leeres Feld.
 *
 * Der Klappstand (`offen`) lebt hier und nicht im Baustein: er hält über
 * ein späteres Zeichnen und über einen Seitenwechsel (im Prototyp
 * `UI.regOpen`) — und seit T-441 am Konto (`registerGroups`, REQ-361),
 * also auch über das Neuladen.
 */

import { Injectable, computed, inject, signal } from '@angular/core';
import type { Registry, RegistryUsage } from '@nw/model';
import { Api, ApiError, type RegisterTeil } from '../kern/api';
import { Bestand } from '../kern/bestand';
import { Klappstand } from '../kern/klappstand';

/** Unter diesem Namen merkt sich das Konto die offenen Registergruppen (T-441). */
export const REGISTER_KLAPP = 'registerGroups';

export interface Rueckfrage {
  titel: string;
  text: string[];
  ja: string;
  /** Ohne `tun` ist es eine Auskunft: es gibt nur „OK". */
  tun?: () => void | Promise<void>;
}

@Injectable({ providedIn: 'root' })
export class RegisterArbeit {
  private readonly api = inject(Api);
  private readonly bestand = inject(Bestand);

  readonly fehler = signal<string | null>(null);
  readonly speichert = signal(false);
  readonly usage = signal<RegistryUsage | null>(null);
  readonly frage = signal<Rueckfrage | null>(null);
  private readonly klapp = inject(Klappstand);
  /** Aufgeklappte Gruppen, `Typ::Gruppe` — gemerkt am Konto (T-441). */
  readonly offen = computed<ReadonlySet<string>>(
    () => new Set(Object.entries(this.klapp.stand(REGISTER_KLAPP)).filter(([, auf]) => auf).map(([k]) => k)),
  );

  /** Einmal je Besuch der Seite zählen; der Bestand ändert sich nicht durchs Register. */
  async zaehlen(): Promise<void> {
    try {
      this.usage.set(await this.api.registryUsage());
    } catch {
      /* Wer nicht zählen darf, darf auch nicht ändern — dann braucht es die
         Zahl nicht. Wer darf und sie nicht bekommt, sieht „not counted". */
      this.usage.set(null);
    }
  }

  /**
   * Einen Teil ändern. `aendere` bekommt eine tiefe Kopie und darf sie
   * umbauen; gibt es einen Text zurück, ist das ein Grund, nichts zu
   * schreiben, und er steht als Fehler da.
   */
  async aendern<T extends RegisterTeil>(
    part: T,
    aendere: (kopie: NonNullable<Registry[T]>) => string | void,
  ): Promise<boolean> {
    const reg = this.bestand.registry();
    if (!reg) return false;
    const kopie = structuredClone(reg[part] ?? {}) as NonNullable<Registry[T]>;
    const grund = aendere(kopie);
    if (grund) {
      this.fehler.set(grund);
      return false;
    }
    this.speichert.set(true);
    try {
      await this.bestand.registerSchreiben(part, kopie);
      this.fehler.set(null);
      return true;
    } catch (error) {
      this.fehler.set(beschreibe(error));
      return false;
    } finally {
      this.speichert.set(false);
    }
  }

  fragen(f: Rueckfrage): void {
    this.frage.set(f);
  }

  istOffen(schluessel: string): boolean {
    return this.offen().has(schluessel);
  }
  klappen(schluessel: string): void {
    this.klapp.setze(REGISTER_KLAPP, schluessel, !this.istOffen(schluessel));
  }
}

/** Was der Server sagt, lesbar: die erste Stelle, an der das Register nicht stimmt. */
function beschreibe(error: unknown): string {
  if (error instanceof ApiError) {
    const issues = Array.isArray(error.issues) ? (error.issues as { path?: unknown[]; message?: string }[]) : [];
    const erste = issues
      .slice(0, 3)
      .map((i) => `${(i.path ?? []).join('.')}: ${i.message ?? ''}`)
      .join('; ');
    return erste ? `${error.message} — ${erste}` : error.message;
  }
  return error instanceof Error ? error.message : String(error);
}

/** „1 article carries", „3 articles carry" — das Verb zur Zahl. */
export function carry(n: number): string {
  return `${articles(n)} ${n === 1 ? 'carries' : 'carry'}`.replace(/^./, (c) => c.toUpperCase());
}

/** „3 articles", „1 article", „no article". */
export function articles(n: number): string {
  return n === 0 ? 'no article' : n === 1 ? '1 article' : `${n.toLocaleString('en')} articles`;
}

/**
 * **Gespeichert und sichtbar** (T-069): wie viele Artikel einer Art in der
 * laufenden Kampagne im Stapel stehen, und wie viele gespeichert sind. Eine
 * Zahl allein widersprach der Liste, sobald eine Ebene nicht aufgeschaltet
 * war. Ohne Kampagne ist alles da, und es bleibt bei einer Zahl.
 */
export function inPlayText(u: RegistryUsage | null, typ: string): string | null {
  if (!u) return null;
  const gespeichert = u.types[typ] ?? 0;
  if (!u.inPlay || !u.campaign) return articles(gespeichert);
  const da = u.inPlay[typ] ?? 0;
  return `${da.toLocaleString('en')} in play in ‘${u.campaign.name}’ · ${articles(gespeichert)} stored`;
}

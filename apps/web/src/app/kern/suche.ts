/**
 * **Die übergreifende Suche** (T-138), ihr Zustand: offen oder zu, was
 * zuletzt geöffnet wurde und welche Filter zuletzt dienten. Gezeichnet wird
 * sie von `nw-suche`, einmal im Gerüst; geöffnet von überall — der Knopf in
 * der Kopfleiste, Strg+K (⌘K) und `/`.
 *
 * Das Zuletzt steht **im Browser** (`localStorage`) und nur dort: es ist
 * eine Bequemlichkeit dieses Geräts und keine Auskunft, die jemand anderes
 * braucht. Fehlt der Speicher (privates Fenster), fehlt nur das Zuletzt.
 */

import { Injectable, signal } from '@angular/core';

export interface Zuletzt {
  id: string;
  name: string;
  /** Die Art — eine Klasse öffnet auf ihrer eigenen Seite. */
  type: string;
  typeLabel: string;
}

/** Ein Filter der Suche: Art, Ebene oder Herausgeber, mit dem, was am Knopf steht. */
export interface SuchFilter {
  kind: 'type' | 'layer' | 'publisher';
  value: string;
  label: string;
}

const SCHLUESSEL = 'atlas.suche.v1';
const HOECHSTENS = 8;

@Injectable({ providedIn: 'root' })
export class Suche {
  readonly offen = signal(false);
  /** Was zuletzt aus der Suche geöffnet wurde — gezeigt, solange nichts getippt ist. */
  readonly zuletzt = signal<readonly Zuletzt[]>([]);
  /** Welche Filter zuletzt dienten — sie stehen in ihrer Leiste vorn. */
  readonly filterZuletzt = signal<readonly SuchFilter[]>([]);
  /** Woher der Fokus kam: dorthin geht er beim Schliessen zurück. */
  private vorher: HTMLElement | null = null;

  constructor() {
    try {
      const roh = JSON.parse(localStorage.getItem(SCHLUESSEL) ?? '{}') as {
        zuletzt?: Zuletzt[];
        filter?: SuchFilter[];
      };
      if (Array.isArray(roh.zuletzt)) this.zuletzt.set(roh.zuletzt.slice(0, HOECHSTENS));
      if (Array.isArray(roh.filter)) this.filterZuletzt.set(roh.filter.slice(0, HOECHSTENS));
    } catch {
      /* Kein Speicher: dann eben ohne Zuletzt. */
    }
  }

  oeffnen(): void {
    if (this.offen()) return;
    const f = document.activeElement;
    this.vorher = f instanceof HTMLElement ? f : null;
    this.offen.set(true);
  }

  schliessen(fokusZurueck = true): void {
    if (!this.offen()) return;
    this.offen.set(false);
    if (fokusZurueck && this.vorher?.isConnected) this.vorher.focus();
    this.vorher = null;
  }

  /** Ein Artikel wurde aus der Suche geöffnet: vorn ins Zuletzt. */
  gewaehlt(z: Zuletzt): void {
    this.zuletzt.update((l) => [z, ...l.filter((x) => x.id !== z.id)].slice(0, HOECHSTENS));
    this.merken();
  }

  /** Ein Filter wurde gesetzt: vorn in seine Leiste. */
  gefiltert(f: SuchFilter): void {
    this.filterZuletzt.update((l) =>
      [f, ...l.filter((x) => x.kind !== f.kind || x.value !== f.value)].slice(0, HOECHSTENS),
    );
    this.merken();
  }

  private merken(): void {
    try {
      localStorage.setItem(
        SCHLUESSEL,
        JSON.stringify({ zuletzt: this.zuletzt(), filter: this.filterZuletzt() }),
      );
    } catch {
      /* Kein Speicher: das Zuletzt gilt bis zum Neuladen. */
    }
  }
}

/** Ist das Ziel einer Taste ein Eingabefeld? Dann gehört `/` dem Text. */
export function tipptGerade(ziel: EventTarget | null): boolean {
  if (!(ziel instanceof HTMLElement)) return false;
  if (ziel.isContentEditable) return true;
  const tag = ziel.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

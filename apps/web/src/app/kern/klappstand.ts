/**
 * **Der Klappstand am Konto** (T-441, REQ-361): welche Facetten im
 * Kompendium und in den Bereichen offen oder zu sind, welche Gruppen auf
 * der Typseite des Registers offen stehen — nach dem Neuladen wieder so.
 *
 * Wie `layerGroups` (Ebenen) und `kapitel.<seite>` (T-359): die
 * Einstellungen werden **einmal** geholt (`GET /api/me/prefs`), und
 * gespeichert wird je Name **einmal nach dem letzten Klappen** (300 ms) —
 * „Expand all" klappt viele auf einmal. Je Name ein Satz `Schlüssel →
 * offen?`; was niemand anfasste, fehlt darin, und dann gilt die Vorgabe
 * der Stelle.
 *
 * Der Server nimmt je Einstellung höchstens 8000 Zeichen; wer mehr
 * aufklappt, verliert die ältesten Einträge (`kuerzeKlappstand`), nicht
 * den ganzen Stand.
 */

import { Injectable, inject, signal } from '@angular/core';
import { Api } from './api';

export const KLAPP_MAX = 8000;
const WARTEN = 300;

type Stand = Record<string, boolean>;

/** Was als Stand taugt: nur Wahrheitswerte. */
export function klappStandAus(roh: unknown): Stand {
  const raus: Stand = {};
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return raus;
  for (const [k, v] of Object.entries(roh as Record<string, unknown>)) if (typeof v === 'boolean') raus[k] = v;
  return raus;
}

/** Die ältesten Einträge (Einfügereihenfolge) weg, bis der Stand passt. */
export function kuerzeKlappstand(stand: Stand, max = KLAPP_MAX): Stand {
  const eintraege = Object.entries(stand);
  /* `{"k":true,…}`: je Eintrag Schlüssel, Doppelpunkt, Wert, Komma. */
  const laenge = eintraege.map(([k, v]) => JSON.stringify(k).length + 1 + String(v).length + 1);
  let summe = 1 + laenge.reduce((a, b) => a + b, 0);
  let n = 0;
  while (n < eintraege.length && summe > max) summe -= laenge[n++]!;
  return Object.fromEntries(eintraege.slice(n));
}

@Injectable({ providedIn: 'root' })
export class Klappstand {
  private readonly api = inject(Api);
  private readonly staende = signal<ReadonlyMap<string, Stand>>(new Map());
  /** Was vor dem Laden geklappt wurde — das gilt über dem Gemerkten. */
  private readonly frueh = new Map<string, Stand>();
  private laden: Promise<void> | null = null;
  private istGeladen = false;
  private readonly uhren = new Map<string, ReturnType<typeof setTimeout>>();

  constructor() {
    /* Gleich holen und nicht erst beim ersten `stand()`: der wird in einem
       `computed` gelesen, und das Holen schreibt Signale (die Ladeanzeige
       der Api) — in einem `computed` verboten. */
    void this.geladen();
  }

  /** Wartet, bis die Einstellungen da sind (holt sie beim ersten Mal). */
  geladen(): Promise<void> {
    this.laden ??= this.api
      .prefs()
      .catch(() => ({}) as Record<string, unknown>)
      .then((alle) => {
        const m = new Map<string, Stand>();
        for (const [name, wert] of Object.entries(alle)) {
          const s = klappStandAus(wert);
          if (Object.keys(s).length) m.set(name, s);
        }
        for (const [name, s] of this.frueh) m.set(name, { ...(m.get(name) ?? {}), ...s });
        this.frueh.clear();
        this.istGeladen = true;
        this.staende.set(m);
      });
    return this.laden;
  }

  /** Der Stand unter diesem Namen (leer, solange nichts gemerkt oder noch nicht geladen). Liest ein Signal. */
  stand(name: string): Stand {
    return this.staende().get(name) ?? {};
  }

  /** Eine Stelle auf- oder zuklappen und den Stand gesammelt speichern. */
  setze(name: string, key: string, offen: boolean): void {
    const alt = this.staende().get(name) ?? {};
    if (alt[key] === offen) return;
    const { [key]: _weg, ...rest } = alt;
    /* Hinten anfügen: der jüngste Eintrag fällt beim Kürzen zuletzt weg. */
    const neu = { ...rest, [key]: offen };
    this.staende.update((m) => new Map(m).set(name, neu));
    if (!this.istGeladen) this.frueh.set(name, { ...(this.frueh.get(name) ?? {}), [key]: offen });
    const uhr = this.uhren.get(name);
    if (uhr) clearTimeout(uhr);
    this.uhren.set(
      name,
      setTimeout(() => {
        this.uhren.delete(name);
        /* Erst nach dem Laden: sonst überschriebe ein frühes Klappen das Gemerkte. */
        void this.geladen()
          .then(() => this.api.setPref(name, kuerzeKlappstand(this.staende().get(name) ?? {})))
          .catch(() => {
            /* Nicht gemerkt ist nicht schlimm: die Stelle steht trotzdem so. */
          });
      }, WARTEN),
    );
  }
}

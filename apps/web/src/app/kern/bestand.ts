/**
 * Was gerade geladen ist — das Register und die Artikel, die jemand
 * geöffnet hat, samt den Namen, die sie brauchen.
 *
 * **Keine Liste aller Artikel mehr** (W7). Bis zum 13.10. hielt der Browser
 * die Kurzfassung des ganzen Bestands (7,7 MB bei den 24 157 Artikeln aus
 * 5e.tools) und rechnete daraus Liste, Filter, Verweise und Auswahlen — und
 * weil Register und Kurzfassung in einem Zug kamen, wartete selbst die
 * Artikelseite auf die ganze Liste. Jetzt:
 * - das **Register** kommt allein und sofort (`load`);
 * - ein **Artikel** kommt beim Öffnen, mit den Namen seiner Kantenziele
 *   und den Treffern seiner `[[Verweise]]` (`refs`, vom Server gerechnet);
 * - **Listen und Auswahlen** fragen die Liste am Server (`Api.list`).
 *
 * Was einmal da ist, bleibt da: `namen` und `verweise` sammeln, was die
 * geöffneten Artikel mitbrachten. Kein Zwischenspeicher mit Verfallsdatum:
 * wer neu laden will, lädt neu — das ist ehrlicher als eine Heuristik, die
 * manchmal Altes zeigt.
 */

import { Injectable, computed, inject, signal } from '@angular/core';
import { entityName } from '@nw/model';
import type { Entity, Registry } from '@nw/model';
import { Api, ApiError, type Bezuege, type Rueckbezug } from './api';

@Injectable({ providedIn: 'root' })
export class Bestand {
  private readonly api = inject(Api);

  private readonly _registry = signal<Registry | null>(null);
  private readonly _fehler = signal<string | null>(null);
  private readonly _geladen = signal(false);
  private readonly _voll = signal<ReadonlyMap<string, Entity>>(new Map());
  private readonly _rueck = signal<ReadonlyMap<string, Rueckbezug[]>>(new Map());
  private readonly _fehlt = signal<ReadonlySet<string>>(new Set());
  private readonly _namen = signal<ReadonlyMap<string, string>>(new Map());
  private readonly _verweise = signal<ReadonlyMap<string, Bezuege['links'][string]>>(new Map());

  readonly registry = this._registry.asReadonly();
  readonly fehler = this._fehler.asReadonly();
  /** Das Register ist da (oder kam nicht) — mehr wartet niemand ab. */
  readonly geladen = this._geladen.asReadonly();
  /** Die geöffneten Artikel, ganz. */
  readonly voll = this._voll.asReadonly();
  readonly rueckbezuege = this._rueck.asReadonly();
  /** Was beim Öffnen nicht kam — es gibt ihn nicht, oder nicht für diesen Betrachter. */
  readonly fehlt = this._fehlt.asReadonly();
  /**
   * Id → Name für alles, was geöffnete Artikel nannten (Kantenziele,
   * Rückbezüge, Ebenen). Fehlt eine Id, darf der Betrachter das Ziel nicht
   * sehen — oder es gibt es nicht; beides heisst „nicht hier".
   */
  readonly namen = this._namen.asReadonly();
  /** `[[ziel]]` → die Artikel, die es treffen könnten (M11). */
  readonly verweise = this._verweise.asReadonly();

  /** Der Name zu einer Id, sofern ein geöffneter Artikel ihn mitbrachte. */
  readonly name = computed(() => {
    const m = this._namen();
    return (id: string): string | undefined => m.get(id);
  });

  private laeuft: Promise<void> | null = null;
  private readonly oeffnet = new Map<string, Promise<void>>();

  /** Das Register — klein (≈10 KB gepackt) und allein, damit nichts darauf wartet. */
  async load(neu = false): Promise<void> {
    if (this._geladen() && !neu) return;
    this.laeuft ??= this.api
      .registry()
      .then((registry) => {
        this._registry.set(registry);
        this._fehler.set(null);
      })
      .catch((error: Error) => {
        /* Was nicht geladen hat, wird nicht durch etwas Altes ersetzt: die
           Seite sagt, dass sie nichts hat, statt Halbes zu zeigen. */
        this._fehler.set(error.message);
      })
      .finally(() => {
        this._geladen.set(true);
        this.laeuft = null;
      });
    return this.laeuft;
  }

  /**
   * Den ganzen Artikel holen, samt dem, was auf ihn zeigt. Einmal je
   * Artikel; `neu` holt ihn wieder, etwa nach dem Speichern — was der Server
   * ausliefert, ist gesiebt und aufgelöst, und das ist nicht unbedingt das,
   * was geschickt wurde.
   */
  async oeffnen(id: string, neu = false): Promise<void> {
    if (!neu && (this._voll().has(id) || this._fehlt().has(id))) return;
    const schon = this.oeffnet.get(id);
    if (schon) return schon;
    const lauf = Promise.all([this.api.entity(id), this.api.backlinks(id)])
      .then(([mitBezug, rueck]) => {
        const { refs, ...e } = mitBezug;
        this.merke(refs, rueck, e);
        this._voll.update((m) => new Map(m).set(id, e as Entity));
        this._rueck.update((m) => new Map(m).set(id, rueck));
        this._fehlt.update((s) => {
          const n = new Set(s);
          n.delete(id);
          return n;
        });
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 404) {
          this._fehlt.update((s) => new Set(s).add(id));
          this._voll.update((m) => {
            const n = new Map(m);
            n.delete(id);
            return n;
          });
        } else {
          this._fehler.set(error instanceof Error ? error.message : String(error));
        }
      })
      .finally(() => this.oeffnet.delete(id));
    this.oeffnet.set(id, lauf);
    return lauf;
  }

  /** Namen und Verweise aufnehmen — auch die eines Rückbezugs und des Artikels selbst. */
  private merke(refs: Bezuege | undefined, rueck: Rueckbezug[], e: Entity): void {
    const namen = new Map(this._namen());
    for (const [id, name] of Object.entries(refs?.names ?? {})) namen.set(id, name);
    for (const b of rueck) namen.set(b.from.id, entityName(b.from));
    namen.set(e.id, entityName(e));
    this._namen.set(namen);
    if (refs && Object.keys(refs.links).length) {
      const v = new Map(this._verweise());
      for (const [ziel, treffer] of Object.entries(refs.links)) v.set(ziel, treffer);
      this._verweise.set(v);
    }
  }
}


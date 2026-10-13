/**
 * Was gerade geladen ist — das Register, die Kurzfassung des Bestands und
 * die Artikel, die jemand geöffnet hat.
 *
 * Die Liste trägt nur die **Kurzfassung** (`summaryOf`: Name, Art,
 * `Identity`, Marken, Stand und was Auswahlen filtern). Bis zum 13.10. hielt
 * sie jeden Artikel ganz, „weil der Bestand einer Kampagne klein genug
 * ist" — mit 24 157 Artikeln aus 5e.tools war er das nicht mehr. Der ganze
 * Artikel kommt beim Öffnen und bleibt dann da; wer auf ihn zeigt, sagt der
 * Server (`/backlinks`), denn die Gegenrichtung braucht jede Kante im
 * Bestand, und die hat die Kurzfassung nicht.
 *
 * Weiterhin kein Zwischenspeicher mit Verfallsdatum: wer neu laden will,
 * lädt neu — das ist ehrlicher als eine Heuristik, die manchmal Altes
 * zeigt.
 */

import { Injectable, computed, inject, signal } from '@angular/core';
import { summaryFields, summaryOf } from '@nw/model';
import type { Entity, Registry } from '@nw/model';
import { Api, ApiError, type RegisterTeil, type Rueckbezug } from './api';

@Injectable({ providedIn: 'root' })
export class Bestand {
  private readonly api = inject(Api);

  private readonly _registry = signal<Registry | null>(null);
  private readonly _entities = signal<Entity[]>([]);
  private readonly _fehler = signal<string | null>(null);
  private readonly _geladen = signal(false);
  private readonly _voll = signal<ReadonlyMap<string, Entity>>(new Map());
  private readonly _rueck = signal<ReadonlyMap<string, Rueckbezug[]>>(new Map());
  private readonly _fehlt = signal<ReadonlySet<string>>(new Set());

  readonly registry = this._registry.asReadonly();
  /** Die Kurzfassungen — genug für Liste, Verweise und Auswahlen. */
  readonly entities = this._entities.asReadonly();
  readonly fehler = this._fehler.asReadonly();
  readonly geladen = this._geladen.asReadonly();
  /** Die geöffneten Artikel, ganz. */
  readonly voll = this._voll.asReadonly();
  readonly rueckbezuege = this._rueck.asReadonly();
  /** Was beim Öffnen nicht kam — es gibt ihn nicht, oder nicht für diesen Betrachter. */
  readonly fehlt = this._fehlt.asReadonly();

  readonly byId = computed(() => new Map(this._entities().map((e) => [e.id, e])));

  private laeuft: Promise<void> | null = null;
  private readonly oeffnet = new Map<string, Promise<void>>();

  async load(neu = false): Promise<void> {
    if (this._geladen() && !neu) return;
    this.laeuft ??= Promise.all([this.api.registry(), this.api.entities()])
      .then(([registry, entities]) => {
        this._registry.set(registry);
        this._entities.set(entities);
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
      .then(([e, rueck]) => {
        this._voll.update((m) => new Map(m).set(id, e));
        this._rueck.update((m) => new Map(m).set(id, rueck));
        this._fehlt.update((s) => {
          const n = new Set(s);
          n.delete(id);
          return n;
        });
        this.kurzfassungNachziehen(e);
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

  /**
   * **Einen Registerteil schreiben** und, wenn der Server ihn nimmt, hier
   * einsetzen. Erst nach seiner Antwort: eine Zeile, die er abweist, soll
   * auch hier nicht stehen — sonst zeigte die Seite ein Register, das es
   * nirgends gibt.
   */
  async registerSchreiben<T extends RegisterTeil>(part: T, value: Registry[T]): Promise<void> {
    await this.api.putRegistry(part, value);
    this._registry.update((r) => (r ? { ...r, [part]: value } : r));
  }

  /** Nach dem Speichern: die Zeile in der Liste sagt dasselbe wie der Artikel. */
  private kurzfassungNachziehen(e: Entity): void {
    const r = this._registry();
    if (!r) return;
    const kurz = summaryOf(e, summaryFields(r));
    this._entities.update((alle) => {
      const i = alle.findIndex((x) => x.id === e.id);
      if (i < 0) return [...alle, kurz];
      const n = [...alle];
      n[i] = kurz;
      return n;
    });
  }
}

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
import { Api, ApiError, type Rueckbezug } from './api';

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
   *
   * `rueck: false` holt den Artikel ohne das, was auf ihn zeigt — eine
   * Kachel auf dem Board zeigt keine Rückbezüge, und jede Rückfrage siebt
   * am Server den ganzen Bestand. Wer ihn danach als Seite öffnet, bekommt
   * sie nachgeholt.
   */
  async oeffnen(id: string, neu = false, rueck = true): Promise<void> {
    const da = this._voll().has(id) && (!rueck || this._rueck().has(id));
    if (!neu && (da || this._fehlt().has(id))) return;
    const schluessel = rueck ? `${id} +rueck` : id;
    const schon = this.oeffnet.get(schluessel) ?? this.oeffnet.get(`${id} +rueck`);
    if (schon) return schon;
    const lauf = Promise.all([
      this.api.entity(id),
      rueck ? this.api.backlinks(id) : Promise.resolve(null),
    ])
      .then(([e, zeigt]) => {
        this._voll.update((m) => new Map(m).set(id, e));
        if (zeigt) this._rueck.update((m) => new Map(m).set(id, zeigt));
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
      .finally(() => this.oeffnet.delete(schluessel));
    this.oeffnet.set(schluessel, lauf);
    return lauf;
  }

  /**
   * **Die Teile eines geöffneten Artikels, ganz und in einer Anfrage** —
   * die Merkmale und Aktionen eines Statblocks (W2). Die Kurzfassung trägt
   * ihren Namen, aber nicht ihren Text und nicht ihre Angriffswerte; ein
   * Drache hat dreizehn Teile, und dreizehn Anfragen wären dreizehnmal das
   * Sieb über den ganzen Bestand. Geholt wird nur, was noch nicht da ist;
   * was nicht kommt, fehlt für diesen Betrachter.
   */
  async holen(ids: readonly string[]): Promise<void> {
    const offen = [...new Set(ids)].filter(
      (id) => id && !this._voll().has(id) && !this._fehlt().has(id) && !this.holt.has(id),
    );
    if (!offen.length) return;
    offen.forEach((id) => this.holt.add(id));
    try {
      const da = await this.api.entitiesById(offen);
      const gekommen = new Set(da.map((e) => e.id));
      this._voll.update((m) => {
        const n = new Map(m);
        for (const e of da) n.set(e.id, e);
        return n;
      });
      this._fehlt.update((s) => {
        const n = new Set(s);
        for (const id of offen) if (!gekommen.has(id)) n.add(id);
        return n;
      });
    } catch (error: unknown) {
      this._fehler.set(error instanceof Error ? error.message : String(error));
    } finally {
      offen.forEach((id) => this.holt.delete(id));
    }
  }
  private readonly holt = new Set<string>();

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

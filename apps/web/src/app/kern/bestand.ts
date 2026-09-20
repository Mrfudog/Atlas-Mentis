/**
 * Was gerade geladen ist — Register und Artikel, einmal geholt und als
 * Signal gehalten.
 *
 * Absichtlich kein Zwischenspeicher mit Verfallsdatum: der Bestand einer
 * Kampagne ist klein genug, um ihn ganz zu haben, und eine Seite, die für
 * jeden Verweis nachlädt, fühlt sich am Tisch langsam an. Wer neu laden
 * will, lädt neu — das ist ehrlicher als eine Heuristik, die manchmal
 * Altes zeigt.
 */

import { Injectable, computed, inject, signal } from '@angular/core';
import type { Entity, Registry } from '@nw/model';
import { Api } from './api';

@Injectable({ providedIn: 'root' })
export class Bestand {
  private readonly api = inject(Api);

  private readonly _registry = signal<Registry | null>(null);
  private readonly _entities = signal<Entity[]>([]);
  private readonly _fehler = signal<string | null>(null);
  private readonly _geladen = signal(false);

  readonly registry = this._registry.asReadonly();
  readonly entities = this._entities.asReadonly();
  readonly fehler = this._fehler.asReadonly();
  readonly geladen = this._geladen.asReadonly();

  readonly byId = computed(() => new Map(this._entities().map((e) => [e.id, e])));

  private laeuft: Promise<void> | null = null;

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
}

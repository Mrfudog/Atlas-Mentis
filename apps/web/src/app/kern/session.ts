/**
 * Wer gerade angemeldet ist — als Signal, damit jede Maske es sieht, ohne
 * dass jemand sie benachrichtigen muss.
 *
 * Der Zustand hat **drei** Werte und nicht zwei: `unbekannt` heisst, der
 * Server ist noch nicht gefragt. Eine Anwendung, die „noch nicht gefragt"
 * und „nicht angemeldet" gleich behandelt, wirft den Nutzer beim Neuladen
 * für einen Wimpernschlag auf die Anmeldemaske — und wer das einmal
 * gesehen hat, traut der Anmeldung nicht mehr.
 */

import { Injectable, computed, inject, signal } from '@angular/core';
import { Api, ApiError, type Me } from './api';

type Stand = 'unbekannt' | 'bereit';

@Injectable({ providedIn: 'root' })
export class Session {
  private readonly api = inject(Api);

  private readonly _stand = signal<Stand>('unbekannt');
  private readonly _me = signal<Me | null>(null);

  readonly stand = this._stand.asReadonly();
  readonly user = computed(() => this._me()?.user ?? null);
  readonly setupHint = computed(() => this._me()?.setup ?? null);
  readonly isGm = computed(() => this.user()?.isGm === true);
  readonly angemeldet = computed(() => this.user() !== null);

  private laeuft: Promise<void> | null = null;

  /** Einmal fragen, auch wenn mehrere gleichzeitig fragen. */
  async load(): Promise<void> {
    this.laeuft ??= this.api
      .me()
      .then((me) => {
        this._me.set(me);
      })
      .catch(() => {
        /* Kommt der Server nicht, ist niemand angemeldet — aber der
           Unterschied zu „abgemeldet" gehört in die Maske und nicht hierher. */
        this._me.set({ user: null, setup: null });
      })
      .finally(() => {
        this._stand.set('bereit');
        this.laeuft = null;
      });
    return this.laeuft;
  }

  async login(name: string, password: string): Promise<string | null> {
    try {
      const { user } = await this.api.login(name, password);
      this._me.set({ user, setup: null });
      this._stand.set('bereit');
      return null;
    } catch (error) {
      return error instanceof ApiError ? error.message : 'Could not reach the server.';
    }
  }

  /**
   * Abmelden. Gibt eine Warnung zurück, wenn der Server es nicht bestätigt
   * hat — **und meldet trotzdem lokal ab.**
   *
   * Beides zusammen ist die ehrliche Antwort: eine Maske, die weiter so
   * tut, als wäre jemand da, ist falsch; eine, die „abgemeldet" sagt, obwohl
   * die Sitzung am Server weiterlebt, ist es auch. Also wird lokal geleert
   * **und** hingeschrieben, dass es vielleicht nicht angekommen ist.
   */
  async logout(): Promise<string | null> {
    let warnung: string | null = null;
    try {
      await this.api.logout();
    } catch {
      warnung = 'Signed out here, but the server did not confirm — the session may still be open.';
    }
    this._me.set({ user: null, setup: null });
    return warnung;
  }
}

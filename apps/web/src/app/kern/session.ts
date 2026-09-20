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

  /**
   * Darf dieser Betrachter den Artikel schreiben? Die Antwort kommt vom
   * Server (`/api/me`); hier wird sie nur nachgeschlagen.
   *
   * Sie ist **Anzeige, keine Kontrolle**: der Server weist einen Schreibweg
   * auch dann ab, wenn die Maske einen Knopf zeigt. Das hier verhindert nur,
   * dass jemand einen Knopf drückt, der danach „das gehört dir nicht" sagt.
   */
  readonly darfSchreiben = computed(() => {
    const me = this._me();
    if (!me?.user) return () => false;
    const liste = me.writable;
    if (liste === null) return () => true; // die Spielleitung
    const erlaubt = new Set(liste);
    return (id: string) => erlaubt.has(id);
  });

  private laeuft: Promise<void> | null = null;

  /** Einmal fragen, auch wenn mehrere gleichzeitig fragen. */
  /**
   * Einmal fragen — auch wenn mehrere gleichzeitig fragen, und auch wenn
   * mehrere nacheinander fragen. `neu` fragt trotzdem: nach dem Anmelden
   * hat sich die Antwort geändert.
   */
  async load(neu = false): Promise<void> {
    if (this._stand() === 'bereit' && !neu) return;
    this.laeuft ??= this.api
      .me()
      .then((me) => {
        this._me.set(me);
      })
      .catch(() => {
        /* Kommt der Server nicht, ist niemand angemeldet — aber der
           Unterschied zu „abgemeldet" gehört in die Maske und nicht hierher. */
        this._me.set({ user: null, writable: null, setup: null });
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
      /* Nach dem Anmelden noch einmal fragen: erst `/api/me` weiss, was
         dieser Betrachter schreiben darf. Es aus der Anmeldung zu raten
         hiesse, es zu raten. */
      this._me.set({ user, writable: user?.isGm ? null : [], setup: null });
      this._stand.set('bereit');
      await this.load(true);
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
    this._me.set({ user: null, writable: null, setup: null });
    return warnung;
  }
}

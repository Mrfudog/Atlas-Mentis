/**
 * **Wohin dieser Betrachter gehört** (T-342): die laufende Kampagne, seine
 * Rolle darin, ihr Board und wo Spielende nach der Anmeldung landen — vom
 * Server (`GET /api/home`), der das Board beim ersten Öffnen anlegt.
 *
 * Gefragt wird neu, wenn sich das Konto oder die laufende Kampagne ändert.
 * Anzeige, keine Kontrolle: was jemand sieht, siebt der Server.
 */

import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { Api, type Heim as HeimAntwort } from './api';
import { Session } from './session';
import { Stapel } from './stapel';

@Injectable({ providedIn: 'root' })
export class Heim {
  private readonly api = inject(Api);
  private readonly session = inject(Session);
  private readonly stapel = inject(Stapel);

  private readonly _heim = signal<HeimAntwort | null>(null);
  readonly heim = this._heim.asReadonly();
  /** Wer mitspielt oder zuschaut, nicht leitet — dem gehört die Basis-Leiste. */
  readonly spielt = computed(() => {
    const h = this._heim();
    return !!h?.board && (h.role === 'player' || h.role === 'spectator');
  });

  private laeuft: Promise<HeimAntwort | null> | null = null;
  private fuer: string | null = null;

  constructor() {
    /* Neues Konto oder andere Kampagne: neu fragen. */
    effect(() => {
      const wer = this.session.user()?.id ?? null;
      const sicht = this.session.viewAs()?.id ?? null;
      this.stapel.stand();
      untracked(() => {
        if (!wer) {
          this._heim.set(null);
          this.fuer = null;
          return;
        }
        void this.laden(true, `${wer}|${sicht ?? ''}`);
      });
    });
  }

  /** Einmal fragen; `neu` fragt trotzdem. */
  laden(neu = false, fuer = this.fuer): Promise<HeimAntwort | null> {
    if (!neu && this._heim() && fuer === this.fuer) return Promise.resolve(this._heim());
    this.fuer = fuer;
    this.laeuft = this.api
      .home()
      .then((h) => {
        this._heim.set(h);
        return h;
      })
      .catch(() => null)
      .finally(() => (this.laeuft = null));
    return this.laeuft;
  }

  /** Was gerade gefragt wird oder schon da ist. */
  async jetzt(): Promise<HeimAntwort | null> {
    return this.laeuft ?? this._heim() ?? this.laden(true);
  }
}

import { Injectable, inject, signal } from '@angular/core';
import { Api } from './api';

/** Der Schalter des Regel-Builders (T-270) in den Einstellungen des Kontos. */
export const RULE_BUILDER_PREF = 'experiments.ruleBuilder';

/**
 * **Versuche** (T-270): Schalter je Konto, Vorgabe aus. Gespeichert in den
 * Einstellungen des Kontos (`/api/me/prefs`). Die Regeln des Regel-Builders
 * sind seit T-270 Regelartikel und stehen nicht mehr hier. Der Ansichtsdesigner
 * war ein Versuch (T-268) und ist seit T-276 der Ansichtseditor für alle.
 */
@Injectable({ providedIn: 'root' })
export class Experimente {
  private readonly api = inject(Api);
  private readonly _prefs = signal<Record<string, unknown> | null>(null);
  private laden: Promise<void> | null = null;

  readonly ruleBuilder = signal(false);

  /** Einmal je Sitzung; `neu` holt die Einstellungen wieder. */
  lade(neu = false): Promise<void> {
    if (!this.laden || neu) {
      this.laden = this.api
        .prefs()
        .then((p) => {
          this._prefs.set(p);
          this.ruleBuilder.set(p[RULE_BUILDER_PREF] === true);
        })
        .catch(() => {
          this._prefs.set({});
        });
    }
    return this.laden;
  }

  async setzeRuleBuilder(an: boolean): Promise<void> {
    await this.api.setPref(RULE_BUILDER_PREF, an ? true : null);
    this.ruleBuilder.set(an);
  }
}

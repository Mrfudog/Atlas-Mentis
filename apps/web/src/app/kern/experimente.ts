import { Injectable, inject, signal } from '@angular/core';
import { isRuleGraph, type RuleGraph } from '@nw/model';
import { Api } from './api';

/** Der Schalter des Regel-Builders (T-270) in den Einstellungen des Kontos. */
export const RULE_BUILDER_PREF = 'experiments.ruleBuilder';
/** Je Regelgraph ein Schlüssel: eine Einstellung hält höchstens 8000 Zeichen. */
export const LAB_RULE_PREFIX = 'labRule.';
/** Beispielregeln, die das Konto gelöscht hat — sie kommen nicht von selbst wieder. */
export const LAB_RULES_DROPPED = 'labRulesDropped';

/**
 * **Versuche** (T-270): Schalter je Konto, Vorgabe aus. Gespeichert in den
 * Einstellungen des Kontos (`/api/me/prefs`) — keine Migration, keine
 * neue Route, und wer den Versuch verwirft, verwirft nur Einstellungen.
 * Was ein Versuch anzeigt, ist Anzeige; der Server kennt ihn nicht.
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

  /** Die gespeicherten Regelgraphen; was keiner ist, bleibt liegen. */
  async regeln(): Promise<RuleGraph[]> {
    await this.lade(true);
    const p = this._prefs() ?? {};
    return Object.entries(p)
      .filter(([k, v]) => k.startsWith(LAB_RULE_PREFIX) && isRuleGraph(v))
      .map(([, v]) => v as RuleGraph)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  speichereRegel(g: RuleGraph): Promise<unknown> {
    return this.api.setPref(LAB_RULE_PREFIX + g.id, g);
  }

  async verworfeneBeispiele(): Promise<string[]> {
    await this.lade();
    const v = (this._prefs() ?? {})[LAB_RULES_DROPPED];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  }

  setzeVerworfeneBeispiele(ids: string[]): Promise<unknown> {
    this._prefs.update((p) => ({ ...(p ?? {}), [LAB_RULES_DROPPED]: ids }));
    return this.api.setPref(LAB_RULES_DROPPED, ids.length ? ids : null);
  }

  loescheRegel(id: string): Promise<unknown> {
    return this.api.setPref(LAB_RULE_PREFIX + id, null);
  }
}

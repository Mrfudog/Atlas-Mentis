import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Experimente } from '../kern/experimente';

/**
 * **Rules & options › Experiments** (T-270): die Schalter der Versuche,
 * nur für Leitung und Verwaltung gezeichnet (`Regeloptionen.leitet`). Ein
 * Schalter gilt für das eigene Konto — ein Versuch ändert nichts am Tisch.
 */
@Component({
  selector: 'nw-experimente',
  imports: [RouterLink],
  template: `
    <section class="sorte" id="regel-experiments" aria-labelledby="exp-titel">
      <h3 id="exp-titel">Experiments</h3>
      <p class="was">Trials that may be dropped again. Each switch applies to your account only and changes nothing at the table.</p>
      <article class="option">
        <label class="schalter">
          <input type="checkbox" [checked]="exp.ruleBuilder()" [disabled]="schaltet()" (change)="setze($event)" />
          <span class="name">Rule builder</span>
          <span class="marke">experiment</span>
        </label>
        <p class="was">
          Build rules from nodes — trigger, condition, outcome — and try them on a made-up event. Only shown, nothing is saved to the
          table.
        </p>
        @if (exp.ruleBuilder()) {
          <a class="knopf" routerLink="/lab/rules">Open the rule builder</a>
        }
      </article>
      @if (fehler(); as f) {
        <p class="fehler" role="alert">{{ f }}</p>
      }
    </section>
  `,
  styles: `
    .sorte {
      margin: 1.2rem 0 1.6rem;
    }
    h3 {
      margin: 0 0 0.1rem;
      border-bottom: 1px solid var(--line);
      padding-bottom: 0.2rem;
    }
    .was {
      color: var(--dim);
      margin: 0.2rem 0 0.4rem;
    }
    .schalter {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      min-height: 44px;
    }
    .name {
      font-weight: 600;
    }
    .marke {
      font-size: 0.75rem;
      padding: 0 0.4rem;
      border: 1px solid var(--line);
      border-radius: 999px;
      color: var(--dim);
    }
  `,
})
export class ExperimenteSchalter {
  protected readonly exp = inject(Experimente);
  protected readonly schaltet = signal(false);
  protected readonly fehler = signal<string | null>(null);

  constructor() {
    void this.exp.lade();
  }

  protected setze(ev: Event): Promise<void> {
    return this.schalte(ev, (an) => this.exp.setzeRuleBuilder(an));
  }

  private async schalte(ev: Event, setze: (an: boolean) => Promise<void>): Promise<void> {
    const an = (ev.target as HTMLInputElement).checked;
    this.schaltet.set(true);
    this.fehler.set(null);
    try {
      await setze(an);
    } catch {
      this.fehler.set('The switch could not be saved.');
      (ev.target as HTMLInputElement).checked = !an;
    } finally {
      this.schaltet.set(false);
    }
  }
}

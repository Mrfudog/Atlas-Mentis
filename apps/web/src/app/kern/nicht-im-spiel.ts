import { Component, inject, input, signal } from '@angular/core';
import { Api } from './api';
import { Stapel } from './stapel';

/**
 * **„not in play — enable"** (T-213): die Marke an einem Artikel aus einer
 * Vergleichsebene in Kompendium, Bereichen und Suche, und für die Leitung
 * der Knopf „Enable" — er gibt den Artikel einzeln frei
 * (`PUT /api/campaigns/:c/enabled/:id`, T-187). Danach fragen die Listen
 * neu, und der Artikel steht im Blatt des Spiels.
 */
@Component({
  selector: 'nw-nicht-im-spiel',
  template: `
    <span class="marke" title="Only a comparison layer brings this; the campaign does not put it in play.">
      not in play{{ kampagne() ? ' — enable' : '' }}
    </span>
    @if (kampagne(); as c) {
      <button
        type="button"
        class="frei"
        [disabled]="laeuft()"
        [attr.aria-label]="'Enable ' + name() + ' in the campaign'"
        (click)="freigeben(c, $event)"
      >
        Enable
      </button>
    }
    @if (fehler(); as f) {
      <span class="fehler" role="alert">{{ f }}</span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0.35rem;
      margin-left: 0.35rem;
    }
    .marke {
      padding: 0 0.35rem;
      border: 1px dashed var(--gold);
      border-radius: 4px;
      color: var(--dim);
      font-size: 0.8em;
      white-space: nowrap;
    }
    .frei {
      min-height: 0;
      padding: 0.05rem 0.5rem;
      border: 1px solid var(--accent);
      border-radius: 4px;
      background: none;
      color: var(--accent);
      font-size: 0.8em;
      cursor: pointer;
    }
    .fehler {
      color: var(--warn);
      font-size: 0.8em;
    }
  `,
})
export class NichtImSpiel {
  private readonly api = inject(Api);
  private readonly stapel = inject(Stapel);
  readonly id = input.required<string>();
  readonly name = input('');
  /** Die Kampagne, in der dieses Konto freigibt — `null`: nur die Marke. */
  readonly kampagne = input<string | null | undefined>(null);
  protected readonly laeuft = signal(false);
  protected readonly fehler = signal<string | null>(null);

  protected async freigeben(c: string, ev: Event): Promise<void> {
    /* Die Zeile darunter öffnet sonst die Vorschau. */
    ev.stopPropagation();
    this.laeuft.set(true);
    this.fehler.set(null);
    try {
      await this.api.setEnabled(c, this.id(), true);
      this.stapel.geaendert();
    } catch (error) {
      this.fehler.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.laeuft.set(false);
    }
  }
}

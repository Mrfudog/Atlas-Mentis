import { Component, computed, inject, input, model, output } from '@angular/core';
import { viewsFor } from '@nw/model';
import type { Entity, IncomingEdge } from '@nw/model';
import { Bestand } from '../kern/bestand';

/**
 * **Welche Ansichten für diesen Artikel gelten** (T-268, E-103): eine
 * Reihe Knöpfe über der Artikelseite, genaueste zuerst, mit dem Grund im
 * Titel. „Full" ist die Seite wie bisher; jede andere zeichnet ihren Baum.
 * Daneben „Design this view" für die, die das Register ändern dürfen —
 * es öffnet den Ansichtseditor in der Leiste (T-276).
 */
@Component({
  selector: 'nw-ansichtswahl',
  template: `
    <div class="wahl" role="group" aria-label="View">
      <span class="lbl">View</span>
      @for (v of ansichten(); track v.key) {
        <button type="button" class="chipb" [attr.aria-pressed]="v.key === aktiv()" [title]="v.why" (click)="waehle.emit(v.key)">
          {{ v.label }}
        </button>
      }
      @if (darfGestalten()) {
        <button type="button" class="gestalten" [attr.aria-pressed]="offen()" (click)="offen.set(!offen())">
          ✎ {{ offen() ? 'Stop designing' : 'Design this view' }}
        </button>
      }
    </div>
  `,
  styles: `
    .wahl {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.3rem;
      margin: 0 0 0.6rem;
    }
    .lbl {
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--dim);
      margin-right: 0.2rem;
    }
    .chipb {
      min-height: 2rem;
      padding: 0 0.7rem;
      border-radius: 999px;
      font-size: 0.82rem;
    }
    .chipb[aria-pressed='true'] {
      background: var(--accent);
      border-color: var(--accent);
      color: var(--accent-ink);
    }
    .gestalten {
      margin-left: auto;
      min-height: 2rem;
    }
  `,
})
export class Ansichtswahl {
  readonly artikel = input.required<Entity>();
  readonly rueck = input<readonly IncomingEdge[]>([]);
  /** Die gezeigte Ansicht. */
  readonly aktiv = input.required<string>();
  readonly darfGestalten = input(false);
  /** Die Leiste „Design this view" ist offen. */
  readonly offen = model(false);
  readonly waehle = output<string>();

  private readonly bestand = inject(Bestand);

  protected readonly ansichten = computed(() => {
    const r = this.bestand.registry();
    return r ? viewsFor(this.artikel(), r, { incoming: this.rueck() }) : [];
  });
}

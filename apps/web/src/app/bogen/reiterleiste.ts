import { Component, input, output } from '@angular/core';

/**
 * **Reiter als eine Zeile** (T-247): auf der Artikelseite die Gruppen
 * einer Kreatur — Overview, Combat, Spells, Gear, Crafting, Campaign, Ties.
 * Am Telefon scrollt die Zeile seitlich, statt umzubrechen.
 */
@Component({
  selector: 'nw-reiterleiste',
  template: `
    <nav class="reiterleiste" aria-label="Tabs" role="tablist">
      @for (t of reiter(); track t.id) {
        <button type="button" role="tab" [class.an]="t.id === aktiv()" [attr.aria-selected]="t.id === aktiv()" (click)="waehle.emit(t.id)">
          {{ t.label }}
        </button>
      }
    </nav>
  `,
  styles: `
    .reiterleiste {
      display: flex;
      gap: 0.25rem;
      overflow-x: auto;
      border-bottom: 1px solid var(--line);
      margin: 0 0 0.75rem;
      scrollbar-width: thin;
    }
    button {
      flex: none;
      min-height: 44px;
      border: 0;
      border-bottom: 3px solid transparent;
      border-radius: 0;
      background: none;
      color: var(--dim);
      font-family: var(--caps);
      font-size: 1.05rem;
    }
    button.an {
      color: var(--accent);
      border-bottom-color: var(--accent);
    }
  `,
})
export class Reiterleiste {
  readonly reiter = input.required<{ id: string; label: string }[]>();
  readonly aktiv = input<string | null>(null);
  readonly waehle = output<string>();
}

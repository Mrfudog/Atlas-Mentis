import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { Api, ApiError, type EbenenHerausgeber } from '../kern/api';
import { Bestand } from '../kern/bestand';

/**
 * **Der Herausgeber einer Ebene** (T-109, REQ-249) an ihrer Artikelseite:
 * gerechnet aus der Herausgeber-Gruppe, an der sie mit `partOf` hängt
 * (`publisherInfo`), mit dem Satz, warum. Ein Feld dafür gibt es nicht
 * (D8) — geändert wird die Kante, über eine Auswahl, für die Verwaltung
 * und wer die Ebene besitzt. Bis T-109 stand die Marke nur auf der
 * Kampagnenseite, und niemand sah, woher sie kam.
 */
@Component({
  selector: 'nw-herausgeber',
  template: `
    @if (stand(); as h) {
      @if (h.name) {
        <p class="herausgeber">
          <strong>Publisher</strong>
          <span class="verlag">{{ h.name }}</span>
          <span class="warum">{{ h.why }}</span>
          @if (h.canChange && h.options?.length) {
            <label class="wahl">
              <select [disabled]="laeuft()" (change)="setzen($any($event.target).value)"
                      aria-label="Publisher group">
                <option value="" [selected]="!h.groups.length">No publisher group</option>
                @for (o of h.options; track o.id) {
                  <option [value]="o.id" [selected]="h.groups.includes(o.id)">{{ o.name }}</option>
                }
              </select>
            </label>
          }
        </p>
        @if (fehler(); as f) {
          <p class="fehler" role="alert">{{ f }}</p>
        }
      }
    }
  `,
  styles: `
    .herausgeber { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.25rem 0.6rem; margin: 0.4rem 0 0.8rem; }
    .verlag { font-family: var(--caps); }
    .warum { color: var(--dim); font-size: 0.9em; }
    .wahl select { font: inherit; max-width: 100%; }
    .fehler { color: var(--warn); }
  `,
})
export class Herausgeber {
  readonly ebene = input.required<string>();

  private readonly api = inject(Api);
  private readonly bestand = inject(Bestand);
  protected readonly stand = signal<EbenenHerausgeber | null>(null);
  protected readonly laeuft = signal(false);
  protected readonly fehler = signal('');

  constructor() {
    effect(() => {
      const id = this.ebene();
      untracked(() => {
        this.stand.set(null);
        this.fehler.set('');
        this.api.layerPublisher(id).then(
          (h) => this.ebene() === id && this.stand.set(h),
          () => this.stand.set(null),
        );
      });
    });
  }

  protected async setzen(gruppe: string): Promise<void> {
    const vorher = this.stand();
    if (!vorher) return;
    this.laeuft.set(true);
    this.fehler.set('');
    try {
      const neu = await this.api.setLayerPublisher(this.ebene(), gruppe ? [gruppe] : []);
      this.stand.set({ ...vorher, ...neu });
      /* Die Kante steht am Artikel: Brotkrumen und „Relations" lesen sie neu. */
      await this.bestand.oeffnen(this.ebene(), true);
    } catch (e) {
      this.fehler.set(e instanceof ApiError ? e.message : 'Could not change the publisher.');
      this.stand.set({ ...vorher });
    } finally {
      this.laeuft.set(false);
    }
  }
}

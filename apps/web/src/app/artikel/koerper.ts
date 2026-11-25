import { Component, input, output } from '@angular/core';

/** Ein Körperplatz, wie das Gear ihn zeichnet (T-365, E-153 V5). */
export interface PlatzSicht<S extends { key: string; name: string; attuned: boolean }> {
  slot: string;
  label: string;
  draw: string | null;
  stueck: S | null;
  ziel: 'ok' | 'warn' | 'no' | null;
  titel: string;
}

type StueckKurz = { key: string; name: string; attuned: boolean };

/**
 * **Die Plätze am Körper** (T-365, E-153 V5) im Gear: Rüstung, Beine,
 * Ringe je Hand, Halsketten — was die Einstellung `slotDraw` nennt, als
 * Gruppen aus `bodyPlaces`. Gerechnet wird im Inventar und in
 * `packages/model` (`gear.ts`); hier wird nur gezeichnet, und ein
 * angetippter Platz geht zurück ans Inventar.
 */
@Component({
  selector: 'nw-koerper',
  template: `
    <section class="koerper" aria-label="Body">
      <h4>Body <small [class.warn]="einstimmung().voll">Attuned {{ einstimmung().zahl }} / {{ einstimmung().grenze }}</small></h4>
      @for (g of gruppen(); track g.key) {
        <div class="kgruppe" [attr.data-gruppe]="g.key">
          <span class="hlbl">{{ g.label }}</span>
          <div class="kplaetze">
            @for (pl of g.places; track pl.slot) {
              <button type="button" class="kplatz" [attr.data-slot]="pl.slot" [class.belegt]="!!pl.stueck"
                      [class.ziel]="pl.ziel === 'ok'" [class.verdraengt]="pl.ziel === 'warn'" [class.nein]="pl.ziel === 'no'"
                      [attr.aria-pressed]="!!pl.stueck && pl.stueck.key === wahl()" [title]="pl.titel" [attr.aria-label]="pl.titel"
                      (click)="platz.emit(pl.slot)">
                {{ pl.stueck ? pl.stueck.name : '—' }}
                @if (pl.stueck?.attuned) { <span class="eing" aria-hidden="true">✦</span> }
              </button>
            }
          </div>
        </div>
      }
    </section>
  `,
  styles: `
    h4 { margin: 0 0 0.3rem; font-family: var(--caps); font-weight: normal; }
    h4 small { font-family: inherit; color: var(--dim); font-size: 0.85rem; margin-left: 0.3rem; }
    h4 small.warn { color: var(--warn); }
    .hlbl { font-size: 0.8rem; color: var(--dim); }
    .kgruppe { display: flex; flex-direction: column; gap: 0.15rem; margin-bottom: 0.35rem; }
    .kplaetze { display: grid; grid-template-columns: repeat(auto-fill, minmax(4.6rem, 1fr)); gap: 0.3rem; }
    .kplatz {
      min-height: 44px; padding: 0.15rem 0.35rem; font: inherit; font-size: 0.8rem; text-align: left; overflow-wrap: anywhere;
      border: 1px dashed var(--line); border-radius: 4px; background: var(--surface); color: var(--dim); cursor: pointer;
    }
    .kplatz.belegt { border-style: solid; border-color: var(--accent); color: var(--heading); font-weight: 600; }
    .kplatz[aria-pressed='true'] { outline: 2px solid var(--accent); }
    .kplatz.ziel { border: 2px solid var(--good, #3a7d44); }
    .kplatz.verdraengt { border: 2px solid var(--warn); }
    .kplatz.nein { opacity: 0.5; }
    .eing { color: var(--accent); }
  `,
})
export class Koerper {
  readonly gruppen = input.required<{ key: string; label: string; places: PlatzSicht<StueckKurz>[] }[]>();
  readonly wahl = input<string | null>(null);
  readonly einstimmung = input.required<{ zahl: number; grenze: number; voll: boolean }>();
  /** Der angetippte Platz (`slot`). */
  readonly platz = output<string>();
}

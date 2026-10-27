import { Component, computed, effect, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { entityName, isContribution, primaryInterface, viewKeys, viewsFor } from '@nw/model';
import { Bestand } from '../kern/bestand';
import { Blatt } from './blatt';

/**
 * **Der Druck** (T-110, E-030 b): „Print" an der Artikelseite führt hierher.
 * Ein Blatt A4 mit dem Namen, der Art und dem, was die Ansicht `print`
 * zeigt — oder eine andere, gewählt oben (`?view=`). Kopfleiste, Wähler
 * und Knöpfe drucken nicht mit (`nichtdrucken`, styles.scss).
 *
 * Gewählt wird hier, weil hier gewählt wird: wer einen Handzettel für die
 * Spielenden druckt, will eine andere Ansicht als die Leitung für ihre
 * Mappe. Was die Spielenden nicht sehen dürfen, hat der Server schon
 * zurückgehalten — die Wahl ist eine der Menge, nicht der Rechte.
 */
@Component({
  selector: 'nw-druck',
  imports: [RouterLink, Blatt],
  template: `
    <div class="leiste nichtdrucken">
      <a [routerLink]="['/artikel', id()]">← Back to the article</a>
      <label>
        View
        <select [value]="ansicht()" (change)="waehlen($any($event.target).value)" aria-label="View to print">
          @for (k of ansichten(); track k) {
            <option [value]="k" [selected]="k === ansicht()">{{ label(k) }}</option>
          }
        </select>
      </label>
      <button type="button" class="pri" (click)="drucken()" [disabled]="!artikel()">Print</button>
    </div>
    @if (artikel(); as e) {
      <article class="seite" aria-label="Print preview">
        <h1>{{ name() }}</h1>
        <p class="art">{{ art() }}</p>
        <div class="linie" aria-hidden="true"></div>
        <nw-blatt [artikel]="e" [ansicht]="ansicht()" [genau]="!!view()" />
      </article>
    } @else if (bestand.fehlt().has(id())) {
      <p class="leer">This article is not here, or not for you.</p>
    } @else {
      <p class="leer">Loading…</p>
    }
  `,
  styles: `
    :host {
      display: block;
      padding: 1rem;
    }
    .leiste {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem 1.25rem;
      max-width: 210mm;
      margin: 0 auto 1rem;
    }
    .leiste label {
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }
    select,
    button {
      min-height: 40px;
      font: inherit;
    }
    button.pri {
      background: var(--accent);
      color: var(--accent-ink);
      border: 0;
      border-radius: 6px;
      padding: 0 1.1rem;
      font-weight: 700;
      cursor: pointer;
    }
    /* Am Bildschirm ein Blatt A4 auf dem Tisch, am Telefon die Breite. */
    .seite {
      background: var(--paper);
      box-shadow: 0 1px 6px rgba(43, 29, 18, 0.25);
      max-width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      padding: 16mm 15mm;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    @media (max-width: 600px) {
      :host {
        padding: 0.5rem;
      }
      .seite {
        min-height: 0;
        padding: 1rem;
      }
    }
    h1 {
      margin: 0;
      font-family: var(--caps);
      font-size: 2.2rem;
      color: var(--heading);
      line-height: 1.05;
      overflow-wrap: anywhere;
    }
    .art {
      margin: 0;
      font-style: italic;
      font-family: var(--serif);
    }
    .linie {
      height: 3px;
      background: var(--rule);
    }
    .leer {
      text-align: center;
      color: var(--dim);
    }
    @media print {
      :host {
        padding: 0;
      }
      .seite {
        box-shadow: none;
        max-width: none;
        min-height: 0;
        padding: 0;
      }
    }
  `,
})
export class Druck {
  readonly id = input.required<string>();
  /** `?view=` — ohne Angabe der Druck. */
  readonly view = input<string | undefined>(undefined);

  protected readonly bestand = inject(Bestand);
  private readonly router = inject(Router);

  constructor() {
    void this.bestand.load();
    effect(() => {
      void this.bestand.oeffnen(this.id(), false, false);
    });
  }

  protected readonly artikel = computed(() => this.bestand.voll().get(this.id()));
  protected readonly ansichten = computed(() => {
    const r = this.bestand.registry();
    const e = this.artikel();
    /* Was für diesen Artikel gilt, genaueste zuerst (T-310) — auch gestaltete. */
    return r && e ? viewsFor(e, r).map((v) => v.key) : r ? viewKeys(r).filter((k) => !isContribution(r.views[k])) : [];
  });
  protected readonly ansicht = computed(() => {
    const v = this.view();
    const r = this.bestand.registry();
    if (v && r?.views[v]) return v;
    return r?.views['print'] ? 'print' : 'full';
  });
  protected readonly name = computed(() => {
    const e = this.artikel();
    return e ? entityName(e) : '';
  });
  protected readonly art = computed(() => {
    const e = this.artikel();
    const r = this.bestand.registry();
    if (!e || !r) return '';
    const typ = primaryInterface(e);
    return r.interfaces[typ]?.label ?? typ;
  });

  protected label(k: string): string {
    return this.bestand.registry()?.views[k]?.label ?? k;
  }

  protected waehlen(k: string): void {
    void this.router.navigate([], { queryParams: { view: k === 'print' ? null : k }, replaceUrl: true });
  }

  protected drucken(): void {
    window.print();
  }
}

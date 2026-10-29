import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Begegnungsbezug } from '../kern/api';
import { KurzLink } from '../kern/kurzansicht';

/**
 * **Wer wo steht** (T-215, REQ-085): an einer Begegnung die Beteiligten
 * (`features` → Kreatur, Fraktion) mit ihrer Haltung zur Gruppe — die
 * `regards`-Kante beim Urteilenden, Marken und Grund. Gerechnet und
 * gesiebt am Server (`refs.encounter`); hier wird nur gezeichnet. Was
 * jemand von der Gruppe hält, ändert man an ihm, nicht hier.
 */
@Component({
  selector: 'nw-haltung',
  imports: [RouterLink, KurzLink],
  template: `
    <section class="block haltung" aria-labelledby="haltung-titel">
      <h2 id="haltung-titel">{{ titel() || 'Who stands where' }}</h2>
      @if (bezug().stances.length) {
        <ul>
          @for (s of bezug().stances; track s.id) {
            <li>
              <a class="wer" [routerLink]="['/artikel', s.id]" [nwQuick]="s.id">{{ s.name }}</a>
              <span class="art">{{ s.type }}</span>
              @for (t of s.toward; track t.id) {
                <span class="zur">
                  @if (s.toward.length > 1) {
                    <span class="gruppe">{{ t.name }}:</span>
                  }
                  @for (m of t.tags; track m) {
                    <span class="marke">{{ m }}</span>
                  }
                  @if (t.note) {
                    <span class="grund">— {{ t.note }}</span>
                  }
                </span>
              } @empty {
                <span class="leer">no stance towards the party yet</span>
              }
            </li>
          }
        </ul>
      } @else {
        <p class="leer">No creature or faction takes part yet — link them with “features”.</p>
      }
    </section>
  `,
  styles: `
    ul {
      list-style: none;
      margin: 0.25rem 0 0;
      padding: 0;
    }
    li {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0.25rem 0.5rem;
      padding: 0.35rem 0;
      border-bottom: 1px solid var(--line);
    }
    .wer {
      font-weight: 600;
    }
    .art,
    .leer,
    .gruppe {
      color: var(--dim);
      font-size: 0.9em;
    }
    .zur {
      display: inline-flex;
      flex-wrap: wrap;
      gap: 0.25rem;
      align-items: baseline;
    }
    .marke {
      padding: 0 0.45rem;
      background: var(--chip);
      border-radius: 0.6rem;
      font-size: 0.9em;
    }
    .grund {
      font-style: italic;
    }
  `,
})
export class Haltung {
  readonly bezug = input.required<Begegnungsbezug>();
  readonly titel = input('');
}

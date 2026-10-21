import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { entityName, extraStatRows, proficiencyVia, statPartText } from '@nw/model';
import type { Entity, StatPart, StatValue } from '@nw/model';
import { FigurDaten } from '../bogen/daten';
import { Bestand } from '../kern/bestand';
import { KurzLink } from '../kern/kurzansicht';

/**
 * **Wie die Zahlen zustande kommen** (T-272): unter dem Statblock einer
 * Figur je Wert eine aufklappbare Zeile — „DEX 16 (+3) = 15 base · +1
 * Artisan" —, jeder Teil mit dem Artikel, der ihn bringt. Gerechnet beim
 * Lesen (`characterStats`, D8); dieselbe Rechnung liest der Kopf des
 * Bogens, die Kennzahlen und „usable by".
 */
@Component({
  selector: 'nw-werte',
  imports: [RouterLink, KurzLink],
  template: `
    @if (zeilen().length) {
      <details class="werte">
        <summary>How the numbers come about</summary>
        @for (w of zeilen(); track w.key) {
          <details class="wert">
            <summary>
              <span class="l">{{ w.label }}</span>
              <strong>{{ w.text }}</strong>
            </summary>
            <p class="teile">
              @for (t of w.parts; track $index) {
                @if (!$first) {
                  <span class="trenn" aria-hidden="true"> · </span>
                }
                <span class="teil">
                  {{ teil(t) }}
                  @if (herkunft(t); as h) {
                    <small>
                      {{ h }}
                      @if (t.source && t.via !== 'statblock') {
                        <a [routerLink]="['/artikel', t.source]" [nwQuick]="t.source">{{ name(t.source) }}</a>
                      }
                    </small>
                  }
                </span>
              } @empty {
                <span class="leer">Nothing to compute yet.</span>
              }
            </p>
            @if (w.note) {
              <p class="hinweis">{{ w.note }}</p>
            }
          </details>
        }
      </details>
    }
  `,
  styles: `
    .werte {
      margin: 0.6rem 0 0;
    }
    .werte > summary {
      cursor: pointer;
      font-weight: 600;
    }
    .wert {
      border-bottom: 1px dotted var(--line, var(--dim));
      padding: 0.15rem 0;
    }
    .wert > summary {
      display: flex;
      gap: 0.6rem;
      align-items: baseline;
      cursor: pointer;
    }
    .l {
      min-width: 9rem;
      color: var(--dim);
    }
    .teile {
      margin: 0.2rem 0 0.3rem 1.2rem;
      overflow-wrap: anywhere;
    }
    small {
      opacity: 0.85;
    }
    .hinweis {
      margin: 0 0 0.3rem 1.2rem;
      font-style: italic;
      color: var(--warn, var(--dim));
    }
    .leer {
      color: var(--dim);
    }
  `,
})
export class Werte {
  /** Die Figur, nicht ihr Statblock. */
  readonly figur = input.required<Entity>();

  private readonly daten = inject(FigurDaten);
  private readonly bestand = inject(Bestand);

  protected readonly zeilen = computed<StatValue[]>(() => {
    const w = this.daten.fuer(this.figur().id).werte();
    if (!w) return [];
    /* Abwehr und kritischer Treffer, wo sie etwas sagen (T-275). */
    return [...Object.values(w.abilities), w.prof, w.ac, w.hp, w.initiative, w.speed, w.senses, ...extraStatRows(w)].filter((x) => x.parts.length || x.value !== null);
  });

  protected teil(t: StatPart): string {
    return statPartText(t);
  }

  /** Woher der Teil kommt, in Worten — wie bei den Übungen. */
  protected herkunft(t: StatPart): string {
    if (t.via === 'statblock') return 'statblock';
    if (t.kind === 'fixed') return 'statblock';
    if (t.kind === 'con' || t.kind === 'dex' || (t.kind === 'base' && !t.via)) return t.note ?? '';
    if (t.kind === 'level') return '';
    if (t.kind === 'die') return 'class';
    return t.via ? proficiencyVia({ id: t.source ?? '', via: t.via }) : '';
  }

  protected name(id: string): string {
    const e = this.bestand.voll().get(id);
    return e ? entityName(e) : (this.bestand.name()(id) ?? id);
  }
}

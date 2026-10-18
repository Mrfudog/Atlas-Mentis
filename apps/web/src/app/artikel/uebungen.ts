import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { entityName, proficiencyVia } from '@nw/model';
import type { Entity, ProficiencyEntry, ProficiencyKind } from '@nw/model';
import { FigurDaten } from '../bogen/daten';
import { Bestand } from '../kern/bestand';
import { KurzLink } from '../kern/kurzansicht';

/** Die Gruppen in der Reihenfolge, in der man sie sucht. */
const GRUPPEN: { kind: ProficiencyKind; label: string }[] = [
  { kind: 'saves', label: 'Saving throws' },
  { kind: 'proficient', label: 'Proficient' },
  { kind: 'expertise', label: 'Expertise' },
];

/**
 * **Jede Übung und woher sie kommt** (T-239): unter dem Statblock einer
 * Figur stehen Rettungswürfe, Übungen und Expertise mit ihrer Herkunft —
 * Klasse, Hintergrund, Herkunft, Talent, Wahl, Gegenstand oder von Hand am
 * Statblock —, die Herkunft als Verweis auf ihren Artikel. Gerechnet beim
 * Lesen (`proficienciesOf`, D8); dieselbe Rechnung liest das Handwerk.
 */
@Component({
  selector: 'nw-uebungen',
  imports: [RouterLink, KurzLink],
  template: `
    @if (gruppen().length) {
      <details class="uebungen" open>
        <summary>Proficiencies and where they come from</summary>
        @for (g of gruppen(); track g.kind) {
          <h4>{{ g.label }}</h4>
          <ul>
            @for (e of g.eintraege; track e.name) {
              <li>
                <strong>{{ anzeige(e) }}</strong>
                <small>
                  @for (s of e.sources; track $index) {
                    {{ $first ? '' : ' · ' }}{{ via(s) }}
                    @if (s.via !== 'statblock') {
                      <a [routerLink]="['/artikel', s.id]" [nwQuick]="s.id">{{ name(s.id) }}</a>
                    }
                  }
                </small>
              </li>
            }
          </ul>
        }
      </details>
    }
  `,
  styles: `
    .uebungen { margin: 0.75rem 0 0; }
    summary { cursor: pointer; font-weight: 600; }
    h4 { margin: 0.6rem 0 0.2rem; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.04em; }
    ul { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr)); gap: 0.15rem 1rem; }
    li { overflow-wrap: anywhere; }
    small { opacity: 0.8; margin-left: 0.35rem; }
  `,
})
export class Uebungen {
  /** Die Figur, nicht ihr Statblock. */
  readonly figur = input.required<Entity>();

  private readonly daten = inject(FigurDaten);
  private readonly bestand = inject(Bestand);

  private readonly liste = computed(() => this.daten.fuer(this.figur().id).uebungen());

  protected readonly gruppen = computed(() =>
    GRUPPEN.map((g) => ({ ...g, eintraege: this.liste().entries.filter((e) => e.kind === g.kind) })).filter((g) => g.eintraege.length),
  );

  /** Ein Kürzel eines Rettungswurfs gross (STR), alles andere wie es dasteht. */
  protected anzeige(e: ProficiencyEntry): string {
    return e.kind === 'saves' && e.name.length <= 3 ? e.name.toUpperCase() : e.name;
  }

  protected via = proficiencyVia;

  protected name(id: string): string {
    const e = this.bestand.voll().get(id);
    return e ? entityName(e) : (this.bestand.name()(id) ?? id);
  }
}

import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EDGE_SHAPES, edgeEffects } from '@nw/model';
import { Bestand } from '../kern/bestand';

/**
 * **How edges work** (T-111, REQ-257): je Kantenart, was sie bedeutet und
 * wer sie liest — die Wirkung gerechnet aus den Auswertern
 * (`edgeEffects`), nicht im Register behauptet. Steht unter „Edges", wenn
 * keine Kantenart gewählt ist; dieselbe Suche wie die Leiste.
 */
@Component({
  selector: 'nw-reg-kantentabelle',
  imports: [RouterLink],
  template: `
    <section class="kasten" aria-label="How edges work">
      <h3>How edges work</h3>
      <p class="hint">
        What each kind of edge means, and what reads it. The effects come from the code that uses the edge; an edge
        nothing reads is shown under Relations and does nothing else. Pick one on the left to change it.
      </p>
      <table>
        <thead>
          <tr><th>Edge</th><th>Means</th><th>Does</th></tr>
        </thead>
        <tbody>
          @for (k of zeilen(); track k.name) {
            <tr>
              <td><a [routerLink]="[]" [queryParams]="{ tab: 'edges', edge: k.name }">{{ k.label }}</a></td>
              <td>{{ k.means }}</td>
              <td>
                <span class="wer">
                  @for (w of k.wer; track w) {
                    <span class="pill">{{ w }}</span>
                  } @empty {
                    <span class="pill" [class.offen]="!!k.offen" [attr.title]="k.offen || null">{{
                      k.offen ? 'not evaluated yet' : 'display only'
                    }}</span>
                  }
                </span>
              </td>
            </tr>
          } @empty {
            <tr><td colspan="3" class="dim">Nothing matches.</td></tr>
          }
        </tbody>
      </table>
    </section>
  `,
  styles: `
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
    }
    th,
    td {
      padding: 0.35rem 0.5rem;
      border-bottom: 1px solid var(--line);
      text-align: left;
      vertical-align: top;
    }
    td:first-child {
      white-space: nowrap;
    }
    .wer {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem;
    }
    /* Schmal: eine Kantenart je Block statt drei Spalten. */
    @media (max-width: 760px) {
      thead {
        display: none;
      }
      tr,
      td {
        display: block;
      }
      td {
        border-bottom: 0;
        padding: 0.15rem 0;
      }
      td:first-child {
        white-space: normal;
        font-weight: 600;
      }
      tr {
        padding: 0.5rem 0;
        border-bottom: 1px solid var(--line);
      }
    }
  `,
})
export class RegKantentabelle {
  readonly suche = input('');
  private readonly bestand = inject(Bestand);

  protected readonly zeilen = computed(() => {
    const r = this.bestand.registry();
    if (!r) return [];
    const q = this.suche().trim().toLocaleLowerCase();
    return Object.entries(r.relations)
      .map(([name, d]) => ({ name, label: d.label || name }))
      .filter((z) => !q || z.name.toLocaleLowerCase().includes(q) || z.label.toLocaleLowerCase().includes(q))
      .sort((a, b) => a.label.localeCompare(b.label, 'en'))
      .map((z) => {
        const w = edgeEffects(r, z.name);
        const wer = [...new Set([...w.shape.map((x) => EDGE_SHAPES[x.kind]), ...w.readers.map((x) => x.label)])];
        return { ...z, means: w.means, wer, offen: w.intended ?? '' };
      });
  });
}

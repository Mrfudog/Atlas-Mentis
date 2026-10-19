import { Component, computed, inject, input, signal } from '@angular/core';
import { entityName, rangeText, rollTableOf, rowForRoll, rollText } from '@nw/model';
import type { Entity, VarScopes } from '@nw/model';
import { Api } from '../kern/api';
import { WurfZiel } from '../kern/wurfziel';
import { Text } from './text';

/**
 * **Das Element `table`** (T-310): die Zeilen einer Tabelle mit ihrer
 * Würfelspalte und „Roll" — gewürfelt am Server, der Wurf steht im Log
 * des Artikels (T-172), und die getroffene Zeile ist markiert. Dieselbe
 * Tabelle auf der Artikelseite, in der Kurzansicht, auf der Kachel und in
 * jeder gestalteten Ansicht (`nw-ansichtsbaum`).
 *
 * Die Würfelspalte kommt aus der ersten Zelle oder, bei einem Würfeltopf,
 * aus den Gewichten (`rollTableOf`); geschrieben wird nichts.
 */
@Component({
  selector: 'nw-tabellenzeilen',
  imports: [Text],
  template: `
    @if (tabelle(); as t) {
      <div class="tabelle">
        <div class="kopf">
          @if (titel()) {
            <span class="titel">{{ titel() }}</span>
          }
          <button type="button" class="wurf" [disabled]="wuerfelt()" (click)="wirf(t.die)" [title]="'Roll ' + t.die + ' — saved in the rolls log'">
            Roll {{ t.die }}
          </button>
          @if (ergebnis(); as w) {
            <output class="ergebnis" role="status">{{ w }}</output>
          }
        </div>
        <table>
          <thead>
            <tr>
              @for (c of t.columns; track $index) {
                <th scope="col">{{ c }}</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (z of t.rows; track $index; let i = $index) {
              <tr [class.getroffen]="i === getroffen()">
                @if (t.counted) {
                  <td class="spanne">{{ spanne(z.lo, z.hi) }}</td>
                }
                @for (c of z.cells; track $index; let j = $index) {
                  <td [class.spanne]="!t.counted && j === 0"><nw-text [text]="c" [inline]="true" [scopes]="scopes()" /></td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
  styles: `
    .tabelle {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      min-width: 0;
      overflow-x: auto;
    }
    .kopf {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
    }
    .titel {
      font-family: var(--caps);
      font-weight: 700;
      color: var(--heading);
    }
    .wurf {
      min-height: 2rem;
    }
    .ergebnis {
      font-weight: 700;
      color: var(--accent);
    }
    table {
      border-collapse: collapse;
      width: 100%;
      font-size: 0.92rem;
    }
    th,
    td {
      text-align: left;
      padding: 0.2rem 0.45rem;
      border-bottom: 1px solid var(--line);
      vertical-align: top;
    }
    th {
      color: var(--heading);
      font-family: var(--caps);
    }
    .spanne {
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
      width: 1%;
    }
    tr.getroffen td {
      background: color-mix(in srgb, var(--accent) 16%, transparent);
      font-weight: 700;
    }
  `,
})
export class Tabellenzeilen {
  readonly artikel = input.required<Entity>();
  /** Die Beschriftung des Elements, sonst keine. */
  readonly titel = input<string | undefined>(undefined);
  readonly scopes = input<VarScopes>({});

  private readonly api = inject(Api);
  private readonly ziel = inject(WurfZiel, { optional: true });

  protected readonly tabelle = computed(() => rollTableOf(this.artikel()));
  protected readonly getroffen = signal(-1);
  protected readonly ergebnis = signal('');
  protected readonly wuerfelt = signal(false);

  protected spanne(lo: number | null, hi: number | null): string {
    return rangeText(lo, hi);
  }

  protected async wirf(die: string): Promise<void> {
    const t = this.tabelle();
    if (!t) return;
    this.wuerfelt.set(true);
    try {
      const r = await this.api.roll({
        expr: die,
        subject: this.artikel().id,
        label: entityName(this.artikel()),
        session: this.ziel?.sitzung() ?? undefined,
        hidden: this.ziel?.verdeckt() || undefined,
      });
      const i = rowForRoll(t, r.total);
      this.getroffen.set(i);
      this.ergebnis.set(i < 0 ? `${rollText(r)} — no row` : rollText(r));
    } catch (e) {
      this.ergebnis.set((e as Error).message);
    } finally {
      this.wuerfelt.set(false);
    }
  }
}

import { Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatCopper } from '@nw/model';
import type { Ladenwaren, Preisschritt, Ware } from '../kern/api';
import { KurzLink } from '../kern/kurzansicht';

/**
 * **Die Waren eines Ladens** (T-129): je Ware Menge und Preis, und unter
 * dem Preis, woher jeder Abschlag kommt. Gerechnet hat der Server
 * (`refs.shop`, `shopWares`, D8) — am Tisch und für jede eigene Figur;
 * hier wird nur gewählt, für wen man schaut.
 */
@Component({
  selector: 'nw-laden',
  imports: [RouterLink, KurzLink],
  template: `
    <section class="laden" aria-label="Wares">
      <div class="kopf">
        <h3>Wares</h3>
        @if (waren().mine.length) {
          <label>
            Prices for
            <select [value]="fuer()" (change)="fuer.set($any($event.target).value)">
              <option value="">At this table</option>
              @for (m of waren().mine; track m.id) {
                <option [value]="m.id">{{ m.name }}</option>
              }
            </select>
          </label>
        }
      </div>
      @if (liste().length) {
        <ul>
          @for (w of liste(); track w.edge) {
            <li [class.weg]="!w.available">
              <span class="name">
                <a [routerLink]="['/artikel', w.item]" [nwQuick]="w.item">{{ w.name }}</a>
                <small class="menge">{{ menge(w) }}</small>
              </span>
              <span class="preis">
                @if (w.price !== undefined) {
                  @if (w.price !== w.list && w.list !== undefined) {
                    <s title="List price">{{ geld(w.list) }}</s>
                  }
                  <strong>{{ geld(w.price) }}</strong>
                } @else {
                  <span class="leer" title="Neither the item nor the shop names a price">no price</span>
                }
              </span>
              @if (w.steps.length || (w.base !== w.list && w.base !== undefined)) {
                <span class="herkunft">
                  @if (w.base !== w.list && w.base !== undefined) {
                    <span>shop price {{ geld(w.base) }}</span>
                  }
                  @for (s of w.steps; track $index) {
                    <span [class.unklar]="s.invalid" [attr.title]="s.invalid ? 'Not understood — write −10 gp or −10 %' : null">
                      {{ s.mod }} {{ woher(s) }}@if (!s.invalid && s.mod.includes('%')) { ({{ betrag(s.delta) }})}
                    </span>
                  }
                </span>
              }
            </li>
          }
        </ul>
      } @else {
        <p class="hinweis">This shop sells nothing yet. Add a “sells” edge to an item.</p>
      }
    </section>
  `,
  styles: `
    .laden { margin: 1rem 0; }
    .kopf { display: flex; flex-wrap: wrap; gap: .5rem 1rem; align-items: baseline; justify-content: space-between; }
    h3 { margin: 0; }
    label { font-size: .9em; }
    select { margin-left: .4rem; max-width: 12rem; }
    ul { list-style: none; padding: 0; margin: .5rem 0 0; }
    li { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: .1rem 1rem; padding: .4rem 0; border-bottom: 1px solid var(--rule); }
    li.weg .name a, li.weg .preis { opacity: .55; }
    .name { min-width: 0; overflow-wrap: anywhere; }
    .menge { margin-left: .4rem; color: var(--dim); }
    .preis { text-align: right; white-space: nowrap; }
    .preis s { color: var(--dim); margin-right: .35rem; }
    .herkunft { grid-column: 1 / -1; font-size: .85em; color: var(--dim); display: flex; flex-wrap: wrap; gap: .1rem .9rem; }
    .unklar { text-decoration: underline wavy; }
    .hinweis, .leer { color: var(--dim); }
  `,
})
export class Laden {
  readonly waren = input.required<Ladenwaren>();
  /** Für wen die Preise gelten: leer heisst am Tisch, sonst eine eigene Figur. */
  protected readonly fuer = signal('');

  protected readonly liste = computed<Ware[]>(() => {
    const w = this.waren();
    return w.mine.find((m) => m.id === this.fuer())?.wares ?? w.table;
  });

  protected geld(cp: number): string {
    return formatCopper(cp);
  }
  protected betrag(cp: number): string {
    return `${cp < 0 ? '−' : '+'}${formatCopper(Math.abs(cp))}`;
  }
  protected menge(w: Ware): string {
    if (!w.available) return w.qty === 0 ? 'sold out' : 'not available';
    return w.qty === undefined ? '' : `× ${w.qty}`;
  }
  protected woher(s: Preisschritt): string {
    if (s.by === 'shop') return 'shop';
    if (s.by === 'ware') return 'this item';
    const von = s.giverName ?? 'a discount';
    const ab = s.rank ? ` from ${s.rank}` : '';
    /* Eine Fraktion, die ihren eigenen Mitgliedern gibt, zeigt auf sich selbst. */
    if (s.giver && s.giver === s.target) return `${von}, members${ab}`;
    return s.targetName ? `${von} for ${s.targetName}${ab}` : `${von}${ab}`;
  }
}

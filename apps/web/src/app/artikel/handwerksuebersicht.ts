import { Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { HandwerkRezept, HandwerkUebersicht } from '../kern/api';
import { KurzLink } from '../kern/kurzansicht';

/**
 * **Die Handwerksübersicht** (T-196): an einem Beruf seine Werkzeuge,
 * Rezepte und das Material, das sie brauchen; an einem Werkzeug, was man
 * damit fertigt; an einer Figur dasselbe je Werkzeug, in dem sie geübt ist
 * — gelernt oder nicht (REQ-218). Gerechnet und gesiebt am Server
 * (`GET /api/crafting/:id`); hier wird gefiltert und gezeigt. Was nicht im
 * Stapel steht, kommt gar nicht an (T-207).
 */
@Component({
  selector: 'nw-handwerksuebersicht',
  imports: [RouterLink, KurzLink],
  template: `
    @let s = sicht();
    <section class="uebersicht" [attr.aria-label]="s.kind === 'trade' ? 'Trade overview' : 'Can craft'">
      @switch (s.kind) {
        @case ('trade') {
          <h3>Recipes</h3>
          <p class="kopf">
            @if (s.trade.tools.length) {
              Tools:
              @for (w of s.trade.tools; track w.name; let last = $last) {
                @if (w.id) { <a [routerLink]="['/artikel', w.id]" [nwQuick]="w.id">{{ w.name }}</a> } @else { {{ w.name }} }{{ last ? '' : ', ' }}
              }
            } @else {
              <span class="hinweis">No tools named yet — set “Tools” on this trade.</span>
            }
          </p>
        }
        @case ('tool') {
          <h3>Can craft</h3>
          @if (s.trades.length) {
            <p class="kopf">
              Trade{{ s.trades.length === 1 ? '' : 's' }}:
              @for (b of s.trades; track b.id; let last = $last) {
                <a [routerLink]="['/artikel', b.id]" [nwQuick]="b.id">{{ b.name }}</a>{{ last ? '' : ', ' }}
              }
            </p>
          }
        }
        @case ('actor') {
          <h3>Can craft</h3>
          @if (!s.tools.length) {
            <p class="hinweis">
              {{ s.statblock ? s.actor.name + ' is proficient in no tool that a trade or recipe here names.' : s.actor.name + ' has no statblock yet — tool proficiencies stand there.' }}
            </p>
          }
        }
      }
      @if (alleZeilen().length) {
        <div class="filter" role="group" aria-label="Filter recipes">
          <input type="search" placeholder="Search recipes or materials" [value]="suche()" (input)="suche.set($any($event.target).value)" aria-label="Search recipes" />
          @if (seltenheiten().length > 1) {
            <select [value]="seltenheit()" (change)="seltenheit.set($any($event.target).value)" aria-label="Rarity">
              <option value="">Any rarity</option>
              @for (r of seltenheiten(); track r) { <option [value]="r">{{ r }}</option> }
            </select>
          }
          @if (mitGelernt()) {
            <select [value]="gelernt()" (change)="gelernt.set($any($event.target).value)" aria-label="Learned">
              <option value="">Learned or not</option>
              <option value="yes">Learned</option>
              <option value="no">Not learned</option>
            </select>
          }
          <small>{{ zahl() }} of {{ alleZeilen().length }}</small>
        </div>
      }
      @for (g of gruppen(); track g.key) {
        @if (g.tool; as w) {
          <h4>
            @if (w.id) { <a [routerLink]="['/artikel', w.id]" [nwQuick]="w.id">{{ w.name }}</a> } @else { {{ w.name }} }
            @for (b of g.trades; track b.id) { <small> · <a [routerLink]="['/artikel', b.id]">{{ b.name }}</a></small> }
          </h4>
        }
        <ul class="rezepte">
          @for (r of gefiltert(g.recipes); track r.id) {
            <li [class.ungelernt]="r.learned === false">
              <span class="name">
                <a [routerLink]="['/artikel', r.id]" [nwQuick]="r.id">{{ r.name }}</a>
                @if (r.learned === true) { <small class="marke">learned</small> }
                @if (r.learned === false) { <small class="marke">not learned</small> }
              </span>
              @if (r.yields; as y) {
                <span class="ertrag">→ <a [routerLink]="['/artikel', y.id]" [nwQuick]="y.id">{{ y.name }}</a>@if (y.rarity) { <small> {{ y.rarity }}</small> }</span>
              }
              <span class="probe">{{ probe(r) }}</span>
              @if (s.kind !== 'trade' && r.trade) {
                <span class="beruf">@if (r.tradeId) { <a [routerLink]="['/artikel', r.tradeId]">{{ r.trade }}</a> } @else { {{ r.trade }} }</span>
              }
              @if (r.needs.length) {
                <span class="material">
                  @for (n of r.needs; track n.item; let last = $last) {
                    {{ n.qty }} × <a [routerLink]="['/artikel', n.item]" [nwQuick]="n.item">{{ n.name }}</a>{{ last ? '' : ', ' }}
                  }
                </span>
              }
            </li>
          } @empty {
            <li class="hinweis">{{ g.recipes.length ? 'No recipe matches the filter.' : leer() }}</li>
          }
        </ul>
      }
      @if (s.kind === 'trade' && s.materials.length) {
        <h3>Materials</h3>
        <ul class="stoffe">
          @for (m of s.materials; track m.item) {
            <li><a [routerLink]="['/artikel', m.item]" [nwQuick]="m.item">{{ m.name }}</a> <small>in {{ m.recipes }} recipe{{ m.recipes === 1 ? '' : 's' }}</small></li>
          }
        </ul>
      }
    </section>

  `,
  styles: `
    .uebersicht { margin: 1rem 0; }
    h3, h4 { margin: .8rem 0 .4rem; }
    h4 small { font-weight: normal; }
    .hinweis, small { color: var(--dim); }
    .kopf { margin: .2rem 0 .6rem; }
    .filter { display: flex; flex-wrap: wrap; gap: .4rem .8rem; align-items: center; margin: .4rem 0; }
    .filter input { flex: 1 1 12rem; min-width: 0; }
    .filter select { max-width: 12rem; }
    ul { list-style: none; padding: 0; margin: .3rem 0; }
    .rezepte li { display: flex; flex-wrap: wrap; gap: .2rem 1rem; align-items: baseline; padding: .35rem 0; border-bottom: 1px solid var(--rule); }
    .rezepte .name { flex: 1 1 12rem; min-width: 0; overflow-wrap: anywhere; font-weight: 600; }
    .rezepte .ertrag, .rezepte .material { min-width: 0; overflow-wrap: anywhere; }
    .rezepte .material { flex-basis: 100%; font-size: .9em; color: var(--dim); }
    .rezepte .probe, .rezepte .beruf { font-size: .9em; white-space: nowrap; }
    .rezepte .beruf { color: var(--dim); }
    .marke { margin-left: .4rem; font-weight: normal; }
    .ungelernt .name a { font-weight: normal; }
    .stoffe { columns: 16rem; }
    .stoffe li { break-inside: avoid; padding: .1rem 0; overflow-wrap: anywhere; }
    .stoffe small, .ertrag small { margin-left: .3rem; }
  `,
})
export class Handwerksuebersicht {
  readonly sicht = input.required<HandwerkUebersicht>();

  protected readonly suche = signal('');
  protected readonly seltenheit = signal('');
  protected readonly gelernt = signal('');

  /** Alle Zeilen, über die gefiltert wird — an der Figur über alle Werkzeuge. */
  protected readonly alleZeilen = computed((): HandwerkRezept[] => {
    const s = this.sicht();
    return s.kind === 'actor' ? s.tools.flatMap((w) => w.recipes) : s.recipes;
  });
  protected readonly seltenheiten = computed(() =>
    [...new Set(this.alleZeilen().map((r) => r.yields?.rarity ?? '').filter(Boolean))].sort(),
  );
  /** Die Listen: an Beruf und Werkzeug eine, an der Figur eine je Werkzeug. */
  protected readonly gruppen = computed(() => {
    const s = this.sicht();
    if (s.kind !== 'actor') return [{ key: '', tool: null, trades: [], recipes: s.recipes }];
    return s.tools.map((w) => ({ key: w.name, tool: { name: w.name, id: w.id }, trades: w.trades, recipes: w.recipes }));
  });
  protected readonly leer = computed(() => {
    return this.sicht().kind === 'trade' ? 'No recipe names this trade yet.' : 'No recipe for this tool that you can see.';
  });
  protected readonly mitGelernt = computed(() => this.alleZeilen().some((r) => r.learned !== undefined));
  protected readonly zahl = computed(() => this.gefiltert(this.alleZeilen()).length);

  protected gefiltert(zeilen: HandwerkRezept[]): HandwerkRezept[] {
    const q = this.suche().trim().toLowerCase();
    const sel = this.seltenheit();
    const gel = this.gelernt();
    return zeilen.filter(
      (r) =>
        (!q || r.name.toLowerCase().includes(q) || (r.yields?.name.toLowerCase().includes(q) ?? false) || r.needs.some((n) => n.name.toLowerCase().includes(q))) &&
        (!sel || r.yields?.rarity === sel) &&
        (!gel || (gel === 'yes' ? r.learned === true : r.learned === false)),
    );
  }

  /** „INT DC 14 · 4 checks, 8 hours" — Probe und Dauer in einer Zeile. */
  protected probe(r: HandwerkRezept): string {
    const teile: string[] = [];
    const check = [r.ability ? r.ability.toUpperCase() : '', r.dc !== null ? `DC ${r.dc}` : ''].filter(Boolean).join(' ');
    if (check) teile.push(check);
    const dauer = [r.checks ? `${r.checks} check${r.checks === 1 ? '' : 's'}` : r.days ? `${r.days} day${r.days === 1 ? '' : 's'}` : '', r.time].filter(Boolean).join(', ');
    if (dauer) teile.push(dauer);
    return teile.join(' · ');
  }
}

import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatCopper } from '@nw/model';
import { Api, ApiError, type Handel, type Ladenwaren, type Preisschritt, type Verkaeuflich, type Ware } from '../kern/api';
import { Bestand } from '../kern/bestand';
import { KurzLink } from '../kern/kurzansicht';

/** Warum der Server einen Handel ablehnt (`TradeRefusal`, T-133). */
const ABGELEHNT: Record<string, string> = {
  missing: 'That is no longer here.',
  unavailable: 'The shop is not selling that right now.',
  soldOut: 'Sold out.',
  tooFew: 'The shop does not have that many.',
  noPrice: 'Nobody trades without a price.',
  tooPoor: 'Not enough money.',
  reserved: 'That piece is reserved for crafting.',
  notEmpty: 'Empty the container first.',
  notBought: 'This shop does not buy that — it buys only what its “buys” edges name. Try another shop.',
  noInventory: 'This character carries no inventory yet.',
};

/**
 * **Die Waren eines Ladens** (T-129): je Ware Menge und Preis, und unter
 * dem Preis, woher jeder Abschlag kommt. Gerechnet hat der Server
 * (`refs.shop`, `shopWares`, D8) — am Tisch und für jede eigene Figur;
 * hier wird nur gewählt, für wen man schaut.
 *
 * **Kaufen und Verkaufen** (T-133): für die gewählte Figur je Ware „Buy"
 * und darunter, was sie dem Laden verkaufen kann. Geschickt werden Ware,
 * Menge und Figur — den Preis rechnet der Server neu, und er sagt nein,
 * wenn das Geld nicht reicht oder die Ware weg ist.
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
            <select (change)="fuer.set($any($event.target).value)">
              <option value="" [selected]="gewaehlt() === ''">At this table</option>
              @for (m of waren().mine; track m.id) {
                <option [value]="m.id" [selected]="gewaehlt() === m.id">{{ m.name }}</option>
              }
            </select>
          </label>
        }
        @if (figur(); as f) {
          @if (f.purse !== undefined) {
            <span class="geld">Purse <strong>{{ geld(f.purse) }}</strong></span>
          }
        }
      </div>
      @if (meldung()) {
        <p class="meldung" [class.nein]="meldungNein()" role="status">{{ meldung() }}</p>
      }
      @if (liste().length) {
        <ul>
          @for (w of liste(); track w.edge + '|' + w.item) {
            <li [class.weg]="!w.available">
              <span class="name">
                <a [routerLink]="['/artikel', w.item]" [nwQuick]="w.item">{{ w.name }}</a>
                <small class="menge">{{ menge(w) }}</small>
                @if (w.viaName) {
                  <small class="ueber" title="Sold as part of a collection (sells → collection)">from {{ w.viaName }}</small>
                }
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
              @if (figur()?.inventory) {
                <span class="kauf">
                  @if (w.available && w.price !== undefined) {
                    <input type="number" min="1" [attr.max]="w.qty ?? null" [value]="1" aria-label="Quantity to buy" #n />
                    <button type="button" [disabled]="laeuft() || zuTeuer(w)" (click)="kaufen(w, +n.value)">Buy</button>
                    @if (zuTeuer(w)) { <small class="knapp">can’t afford</small> }
                  }
                </span>
              }
              @if (w.steps.length || (w.base !== w.list && w.base !== undefined) || w.listNote) {
                <span class="herkunft">
                  @if (w.listNote) {
                    <span class="schaetzung" title="Where the list price comes from">{{ w.listNote }}</span>
                  }
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
        <p class="hinweis">This shop sells nothing yet. Add a “sells” edge to an item or a collection.</p>
      }
      @if (figur(); as f) {
        @if (f.inventory) {
          <h4>Sell to this shop</h4>
          @if (f.sellable?.length) {
            <ul class="verkauf">
              @for (v of f.sellable; track v.edge) {
                <li>
                  <span class="name">{{ v.name }} <small class="menge">× {{ v.qty }}</small></span>
                  <span class="preis">
                    @if (v.price !== undefined) {
                      {{ geld(v.price) }} each
                      @if (v.rate !== undefined) { <small class="satz" [attr.title]="ankaufWoher(v)">{{ v.rate }} %</small> }
                    } @else if (v.refused === 'notBought') {
                      <span class="leer" title="The shop buys only what its buys edges name">not bought here</span>
                    } @else {
                      <span class="leer">no price</span>
                    }
                  </span>
                  <span class="kauf">
                    @if (v.price !== undefined) {
                      <input type="number" min="1" [attr.max]="v.qty" [value]="1" aria-label="Quantity to sell" #m />
                      <button type="button" [disabled]="laeuft()" (click)="verkaufen(v, +m.value)">Sell</button>
                    }
                  </span>
                </li>
              }
            </ul>
            <p class="hinweis">{{ ankaufHinweis() }} Reserved pieces are not listed.</p>
          } @else {
            <p class="hinweis">{{ f.name }} carries nothing to sell.</p>
          }
        } @else {
          <p class="hinweis">{{ f.name }} carries no inventory yet — nothing to pay with.</p>
        }
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
    .ueber, .satz { margin-left: .4rem; color: var(--dim); font-style: italic; }
    .preis { text-align: right; white-space: nowrap; }
    .preis s { color: var(--dim); margin-right: .35rem; }
    .herkunft { grid-column: 1 / -1; font-size: .85em; color: var(--dim); display: flex; flex-wrap: wrap; gap: .1rem .9rem; }
    .unklar { text-decoration: underline wavy; }
    .hinweis, .leer { color: var(--dim); }
    .geld { font-size: .9em; }
    .kauf { grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: center; gap: .4rem; justify-content: flex-end; }
    .kauf input { width: 3.5rem; }
    .knapp { color: var(--dim); }
    h4 { margin: 1rem 0 0; }
    .meldung { margin: .5rem 0 0; }
    .meldung.nein { color: var(--accent, #8b2e1f); }
  `,
})
export class Laden {
  readonly waren = input.required<Ladenwaren>();
  /** Der Laden — für Kaufen und Verkaufen (T-133). */
  readonly id = input<string>('');
  private readonly api = inject(Api);
  private readonly bestand = inject(Bestand);
  /**
   * Für wen die Preise gelten: leer heisst am Tisch, sonst eine eigene
   * Figur. Ungewählt die erste eigene — wer einkaufen geht, geht als
   * jemand (T-133).
   */
  protected readonly fuer = signal<string | null>(null);
  protected readonly gewaehlt = computed(() => this.fuer() ?? this.waren().mine[0]?.id ?? '');
  protected readonly figur = computed(() => this.waren().mine.find((m) => m.id === this.gewaehlt()));

  protected readonly liste = computed<Ware[]>(() => this.figur()?.wares ?? this.waren().table);

  protected readonly laeuft = signal(false);
  protected readonly meldung = signal('');
  protected readonly meldungNein = signal(false);

  /** Reicht das Geld für ein Stück? Nur ein Hinweis — entscheiden tut der Server. */
  protected zuTeuer(w: Ware): boolean {
    const f = this.figur();
    return w.price !== undefined && f?.purse !== undefined && w.price > f.purse;
  }

  protected kaufen(w: Ware, n: number): Promise<void> {
    const f = this.figur();
    if (!f) return Promise.resolve();
    return this.handeln(() => this.api.buy(this.id(), f.id, w.edge, n, w.item), (h) => `Bought ${h.qty} × ${h.item.name} for ${this.geld(h.total)}.`);
  }

  protected verkaufen(v: Verkaeuflich, n: number): Promise<void> {
    const f = this.figur();
    if (!f) return Promise.resolve();
    return this.handeln(() => this.api.sell(this.id(), f.id, v.inventory, v.edge, n), (h) => `Sold ${h.qty} × ${h.item.name} for ${this.geld(h.total)}.`);
  }

  /** Ein Handel, danach den Laden neu holen: Menge, Geld und Verkäufliches stehen dort. */
  private async handeln(fn: () => Promise<Handel>, text: (h: Handel) => string): Promise<void> {
    this.laeuft.set(true);
    this.meldung.set('');
    try {
      const h = await fn();
      this.meldungNein.set(false);
      this.meldung.set(text(h));
      await this.bestand.oeffnen(this.id(), true);
    } catch (e) {
      const body = e instanceof ApiError ? (e.body as { error?: string; refused?: string } | undefined) : undefined;
      this.meldungNein.set(true);
      this.meldung.set((body?.refused && ABGELEHNT[body.refused]) || body?.error || String((e as Error).message ?? e));
    } finally {
      this.laeuft.set(false);
    }
  }

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
  /** Woher der Ankaufssatz eines Stücks kommt (E-175): die Kante, die Collection, der Laden. */
  protected ankaufWoher(v: Verkaeuflich): string {
    if (v.from === 'edge') return 'The shop buys this item at this rate (buys edge).';
    if (v.from === 'collection') return `The shop buys ${v.viaName ?? 'a collection'} at this rate.`;
    return 'The buy rate of the shop (empty: 50 %).';
  }

  /** Was unter der Ankaufsliste steht: die Hälfte, ein eigener Satz oder nur das Genannte. */
  protected ankaufHinweis(): string {
    const liste = this.figur()?.sellable ?? [];
    if (liste.some((v) => v.refused === 'notBought' || v.from === 'edge' || v.from === 'collection')) return 'The shop buys only what its buys edges name, at their rates.';
    const satz = liste.find((v) => v.rate !== undefined)?.rate;
    return satz === undefined || satz === 50 ? 'The shop pays half the list price.' : `The shop pays ${satz} % of the list price.`;
  }

  protected woher(s: Preisschritt): string {
    if (s.by === 'shop') return 'shop';
    if (s.by === 'ware') return 'this item';
    if (s.by === 'collection') return s.giverName ? `collection ${s.giverName}` : 'collection';
    const von = s.giverName ?? 'a discount';
    const ab = s.rank ? ` from ${s.rank}` : '';
    /* Eine Fraktion, die ihren eigenen Mitgliedern gibt, zeigt auf sich selbst. */
    if (s.giver && s.giver === s.target) return `${von}, members${ab}`;
    return s.targetName ? `${von} for ${s.targetName}${ab}` : `${von}${ab}`;
  }
}

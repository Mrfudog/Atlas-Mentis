import { Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Api, ApiError, type Handwerk, type HandwerkAuftrag, type HandwerkProbe, type HandwerkRegeln } from '../kern/api';
import { KurzLink } from '../kern/kurzansicht';
import { Live } from '../kern/live';

type RezeptSicht = Extract<Handwerk, { kind: 'recipe' }>;

/** Die Regeln in Worten — dieselben Wörter wie in der Auswahl an der Kampagne. */
const FAILURE: Record<string, string> = {
  recipe: 'as the recipe says',
  noProgress: 'no progress',
  progressLost: 'progress lost',
  materialsLost: 'materials lost',
  halfLost: 'half the materials lost',
  nothingLost: 'materials come back',
  custom: 'the GM decides',
};
const CRIT_SUCCESS: Record<string, string> = { asSuccess: 'a success', double: 'counts twice' };
const CRIT_FAILURE: Record<string, string> = { asFailure: 'a failure', progressLost: 'progress lost', materialsLost: 'materials lost' };
const RESULT: Record<string, string> = {
  critSuccess: 'critical success',
  success: 'success',
  failure: 'failure',
  critFailure: 'critical failure',
  pending: 'waiting for the GM',
  rejected: 'not accepted',
};
const OUTCOME: Record<string, string> = { open: 'in progress', succeeded: 'done', failed: 'failed', aborted: 'aborted' };

/**
 * **Die Werkbank** (T-128, REQ-184): am Rezept einen Auftrag starten — wer
 * fertigt, welches Material aus seinem Inventar und dem der Gruppe —, am
 * Auftrag Fortschritt, Proben und Abschluss. Gerechnet und geprüft wird am
 * Server (`/api/crafting`); hier wird gewählt und gezeigt. Ändert sich der
 * Auftrag, ein Inventar oder das Rezept, fragt sie über den Live-Kanal neu.
 */
@Component({
  selector: 'nw-werkstatt',
  imports: [RouterLink, KurzLink],
  template: `
    @if (sicht(); as s) {
      <section class="werkstatt" aria-label="Crafting">
        @if (s.kind === 'recipe') {
          <h3>Crafting</h3>
          <p class="regeln">{{ regelText(s.rules) }}</p>
          <p>
            {{ masz(s.recipe.unit, s.recipe.needed) }}
            @if (s.recipe.yields; as y) { · yields <a [routerLink]="['/artikel', y.id]" [nwQuick]="y.id">{{ y.name }}</a> }
          </p>
          @if (s.actors.length) {
            <div class="zeile">
              <label>Crafter
                <select [value]="wer()" (change)="waehle($any($event.target).value)" aria-label="Crafter">
                  @for (a of s.actors; track a.id) {
                    <option [value]="a.id">{{ a.name }}{{ a.learned ? '' : ' — not learned' }}</option>
                  }
                </select>
              </label>
              @if (figur(); as f) {
                <span class="probe">Check {{ probeText(f.check) }}</span>
              }
            </div>
            @if (figur(); as f) {
              @if (!f.learned) {
                <p class="hinweis">{{ f.name }} must still learn this recipe{{ s.leitet ? ' — as GM you can start it anyway' : '' }}.</p>
              }
              @if (s.needs.length) {
                <ul class="material">
                  @for (n of s.needs; track n.item) {
                    <li>
                      <span class="was">{{ n.qty }} × <a [routerLink]="['/artikel', n.item]" [nwQuick]="n.item">{{ n.name }}</a>
                        @if (!n.consumed) { <small>(not used up)</small> }
                        <small [class.fehlt]="gewaehlt(n.item) < n.qty">{{ gewaehlt(n.item) }} / {{ n.qty }} chosen</small>
                      </span>
                      @for (v of vorrat(n.item); track v.edge) {
                        <label class="quelle">
                          {{ v.owner || 'inventory' }} ({{ v.qty }})
                          <input type="number" min="0" [max]="v.qty" [value]="menge()[v.edge] ?? 0" (change)="setzeMenge(v.edge, $any($event.target).value, v.qty)" [attr.aria-label]="n.name + ' from ' + v.owner" />
                        </label>
                      } @empty {
                        <small class="fehlt">none in {{ f.name }}’s or the party’s inventory</small>
                      }
                    </li>
                  }
                </ul>
              } @else {
                <p class="hinweis">This recipe needs no materials (add a “needs” edge to an item).</p>
              }
              <button type="button" (click)="starten()" [disabled]="laeuft() || (!f.learned && !s.leitet)">Start crafting</button>
            }
          } @else {
            <p class="hinweis">No character of yours can craft here.</p>
          }
          @if (s.orders.length) {
            <h4>Orders</h4>
            <ul class="auftraege">
              @for (o of s.orders; track o.id) {
                <li><a [routerLink]="['/artikel', o.id]">{{ o.name }}</a> <small>{{ outcome(o.outcome) }}</small></li>
              }
            </ul>
          }
        } @else {
          <h3>Crafting order</h3>
          @let o = s.order;
          <p class="regeln">{{ regelText(s.rules) }}</p>
          <p>
            @if (o.actor; as a) { <a [routerLink]="['/artikel', a.id]" [nwQuick]="a.id">{{ a.name }}</a> crafts }
            @if (o.recipe; as r) { <a [routerLink]="['/artikel', r.id]" [nwQuick]="r.id">{{ r.name }}</a> }
            <span class="ausgang" [attr.data-outcome]="o.outcome">{{ outcome(o.outcome) }}</span>
          </p>
          <p class="fortschritt">
            <progress [max]="o.needed" [value]="o.progress"></progress>
            {{ o.progress }} / {{ masz(o.unit, o.needed) }}
            · check {{ probeText(o.check) }}
            @if (o.yields; as y) { · yields {{ y.count }} × <a [routerLink]="['/artikel', y.id]" [nwQuick]="y.id">{{ y.name }}</a> }
          </p>
          @if (o.reserved.length) {
            <p class="reserviert">
              Reserved:
              @for (r of o.reserved; track r.edge) {
                <span>{{ r.qty }} × <a [routerLink]="['/artikel', r.item]" [nwQuick]="r.item">{{ r.name }}</a> <small>({{ r.owner }}{{ r.consumed ? '' : ', comes back' }})</small></span>
              }
            </p>
          }
          @if (o.rolls.length) {
            <ol class="proben">
              @for (p of o.rolls; track $index) {
                <li [attr.data-result]="p.result">
                  <strong>{{ p.total }}</strong>@if (p.nat) { <small>(nat {{ p.nat }})</small> } vs DC {{ p.dc }} — {{ ergebnis(p) }}
                  @if (p.note) { <small>{{ p.note }}</small> }
                  <small class="wer">{{ p.by }}</small>
                  @if (p.result === 'pending' && o.may.confirm) {
                    <button type="button" (click)="tu('confirm', { accept: true })" [disabled]="laeuft()">Accept</button>
                    <button type="button" (click)="tu('confirm', { accept: false })" [disabled]="laeuft()">Reject</button>
                  }
                </li>
              }
            </ol>
          }
          <div class="aktionen">
            @if (o.may.roll) {
              <label>Check total <input type="number" [value]="summe()" (input)="summe.set($any($event.target).value)" aria-label="Check total" /></label>
              <label>d20
                <select [value]="nat()" (change)="nat.set($any($event.target).value)" aria-label="Natural roll">
                  <option value="">—</option>
                  <option value="20">natural 20</option>
                  <option value="1">natural 1</option>
                </select>
              </label>
              <button type="button" (click)="probe()" [disabled]="laeuft() || summe() === ''">Enter check</button>
            }
            @if (o.may.work) {
              <button type="button" (click)="tu('work', { days: 1 })" [disabled]="laeuft()">Work a day</button>
            }
            @if (o.may.abort) {
              <button type="button" (click)="tu('abort')" [disabled]="laeuft()">Abort — materials come back</button>
            }
            @if (o.may.fail) {
              <label>On failing
                <select [value]="rueck()" (change)="rueck.set($any($event.target).value)" aria-label="Materials back">
                  <option value="none">materials lost</option>
                  <option value="half">half comes back</option>
                  <option value="all">all comes back</option>
                </select>
              </label>
              <button type="button" (click)="tu('fail', { return: rueck() })" [disabled]="laeuft()">Declare failed</button>
            }
          </div>
          @if (o.unit === 'days' && o.outcome === 'open' && o.progress < o.needed) {
            <p class="hinweis">The check comes at the end, once the days are worked.</p>
          }
        }
        @if (fehler()) {
          <p class="fehler" role="alert">{{ fehler() }}</p>
        }
      </section>
    }
  `,
  styles: `
    .werkstatt { margin: 1rem 0; }
    h3, h4 { margin: 0 0 .4rem; }
    .regeln, .hinweis, small { color: var(--dim); }
    .regeln { font-size: .85em; }
    .zeile, .aktionen { display: flex; flex-wrap: wrap; gap: .5rem 1rem; align-items: center; margin: .5rem 0; }
    select { margin-left: .4rem; max-width: 14rem; }
    ul, ol { padding: 0; margin: .4rem 0; }
    ul { list-style: none; }
    ol { padding-left: 1.4rem; }
    .material li { padding: .35rem 0; border-bottom: 1px solid var(--rule); display: flex; flex-wrap: wrap; gap: .3rem 1rem; align-items: baseline; }
    .was { flex: 1 1 14rem; min-width: 0; overflow-wrap: anywhere; }
    .was small { margin-left: .4rem; }
    .quelle input { width: 4rem; margin-left: .3rem; }
    .fehlt { color: var(--warn, #a33); }
    .fortschritt progress { width: min(12rem, 100%); vertical-align: middle; }
    .reserviert span { margin-right: .8rem; }
    .reserviert small { margin-left: .2rem; }
    .ausgang { margin-left: .5rem; font-size: .85em; padding: 0 .4rem; border: 1px solid var(--rule); border-radius: .6rem; }
    .proben li { margin: .2rem 0; }
    .proben small { margin-left: .4rem; }
    .proben button { margin-left: .4rem; }
    .aktionen input { width: 5rem; margin-left: .3rem; }
    .fehler { color: var(--warn, #a33); }
  `,
})
export class Werkstatt {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  /** Das Rezept oder der Auftrag, an dem die Werkbank steht. */
  readonly id = input.required<string>();

  protected readonly sicht = signal<Handwerk | null>(null);
  protected readonly fehler = signal('');
  protected readonly laeuft = signal(false);
  /** Wer fertigt (Figur-Id). */
  protected readonly wer = signal('');
  /** Je Kante, wie viel davon reserviert werden soll. */
  protected readonly menge = signal<Record<string, number>>({});
  protected readonly summe = signal('');
  protected readonly nat = signal('');
  protected readonly rueck = signal('none');
  private lauf = 0;

  protected readonly figur = computed(() => {
    const s = this.sicht();
    return s?.kind === 'recipe' ? (s.actors.find((a) => a.id === this.wer()) ?? null) : null;
  });

  constructor() {
    effect(() => void this.holen(this.id()));
    const ab = inject(Live).onArtikel((ev) => {
      if (this.betrifft(ev.id) || ev.type === 'CraftingOrder' || ev.type === 'Inventory') void this.holen(this.id(), true);
    });
    inject(DestroyRef).onDestroy(ab);
  }

  private betrifft(id: string): boolean {
    const s = this.sicht();
    if (!s) return false;
    if (id === this.id()) return true;
    if (s.kind === 'order') return s.order.actor?.id === id || s.order.recipe?.id === id;
    return s.actors.some((a) => a.id === id);
  }

  private async holen(id: string, still = false): Promise<void> {
    const n = ++this.lauf;
    try {
      const s = await this.api.crafting(id);
      if (n !== this.lauf) return;
      this.sicht.set(s);
      if (!still) this.fehler.set('');
      if (s.kind === 'recipe') {
        const da = s.actors.find((a) => a.id === this.wer()) ?? s.actors.find((a) => a.learned) ?? s.actors[0];
        if (da && da.id !== this.wer()) this.waehle(da.id);
        else if (da) this.vorschlagen();
      }
    } catch (e) {
      if (n !== this.lauf) return;
      /* Kein Rezept und kein Auftrag (oder nicht sichtbar): nichts zeichnen. */
      this.sicht.set(null);
      if (!(e instanceof ApiError && e.status === 404)) this.fehler.set(String((e as Error).message ?? e));
    }
  }

  protected waehle(id: string): void {
    this.wer.set(id);
    this.vorschlagen();
  }

  /** Was gebraucht wird, der Reihe nach aus dem Vorrat: zuerst das eigene Inventar, dann das der Gruppe. */
  private vorschlagen(): void {
    const s = this.sicht();
    const f = this.figur();
    if (s?.kind !== 'recipe' || !f) return;
    const m: Record<string, number> = {};
    for (const n of s.needs) {
      let rest = n.qty;
      for (const v of f.stock.filter((x) => x.item === n.item)) {
        const nimm = Math.min(rest, v.qty);
        m[v.edge] = nimm;
        rest -= nimm;
      }
    }
    this.menge.set(m);
  }

  protected vorrat(item: string) {
    return (this.figur()?.stock ?? []).filter((v) => v.item === item);
  }

  protected gewaehlt(item: string): number {
    const m = this.menge();
    return this.vorrat(item).reduce((n, v) => n + (m[v.edge] ?? 0), 0);
  }

  protected setzeMenge(edge: string, wert: string, hoechstens: number): void {
    const n = Math.max(0, Math.min(hoechstens, Math.trunc(Number(wert) || 0)));
    this.menge.update((m) => ({ ...m, [edge]: n }));
  }

  protected async starten(): Promise<void> {
    const s = this.sicht() as RezeptSicht | null;
    const f = this.figur();
    if (!s || !f) return;
    const m = this.menge();
    const materials = f.stock.filter((v) => (m[v.edge] ?? 0) > 0).map((v) => ({ inventory: v.inventory, edge: v.edge, qty: m[v.edge] ?? 0 }));
    await this.schreibe(async () => {
      const { id } = await this.api.startCrafting(s.recipe.id, f.id, materials);
      await this.router.navigate(['/artikel', id]);
    });
  }

  protected async probe(): Promise<void> {
    const body: Record<string, unknown> = { total: Number(this.summe()) };
    if (this.nat()) body['nat'] = Number(this.nat());
    await this.tu('roll', body);
    this.summe.set('');
    this.nat.set('');
  }

  protected async tu(action: 'roll' | 'confirm' | 'work' | 'abort' | 'fail', body: Record<string, unknown> = {}): Promise<void> {
    await this.schreibe(async () => {
      await this.api.craftingAction(this.id(), action, body);
      await this.holen(this.id());
    });
  }

  private async schreibe(fn: () => Promise<void>): Promise<void> {
    this.laeuft.set(true);
    this.fehler.set('');
    try {
      await fn();
    } catch (e) {
      const body = e instanceof ApiError ? (e.body as { error?: string } | undefined) : undefined;
      this.fehler.set(body?.error ?? String((e as Error).message ?? e));
    } finally {
      this.laeuft.set(false);
    }
  }

  protected regelText(r: HandwerkRegeln): string {
    return `Table rules: a failed check — ${FAILURE[r.failure] ?? r.failure}; a natural 20 — ${CRIT_SUCCESS[r.critSuccess] ?? r.critSuccess}; a natural 1 — ${CRIT_FAILURE[r.critFailure] ?? r.critFailure}; player checks count ${r.confirm === 'gm' ? 'once the GM accepts them' : 'at once'}.`;
  }
  protected masz(unit: 'checks' | 'days', n: number): string {
    return unit === 'checks' ? `${n} successful check${n === 1 ? '' : 's'}` : `${n} day${n === 1 ? '' : 's'} of work, then a check`;
  }
  protected probeText(c: HandwerkAuftrag['check']): string {
    return `${c.ability.toUpperCase()}${c.tool ? ` (${c.tool})` : ''} DC ${c.dc}`;
  }
  protected ergebnis(p: HandwerkProbe): string {
    return RESULT[p.result] ?? p.result;
  }
  protected outcome(o: string): string {
    return OUTCOME[o] ?? o;
  }
}

import { Component, DestroyRef, computed, effect, forwardRef, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { nextMark, rollText, type RollEntry } from '@nw/model';
import { Api, ApiError, type Handwerk, type HandwerkAuftrag, type HandwerkKreis, type HandwerkMaterialwahl, type HandwerkUebersicht } from '../kern/api';
import { KurzLink } from '../kern/kurzansicht';
import { Live } from '../kern/live';
import { Handwerksuebersicht } from './handwerksuebersicht';
import { FigurHandwerk } from '../bogen/handwerk';

type RezeptSicht = Extract<Handwerk, { kind: 'recipe' }>;

/** Was ein Kreis zeigt — in Worten für Vorleser und Tooltip. */
const MARK: Record<string, string> = {
  success: 'success',
  failure: 'failure',
  critSuccess: 'natural 20',
  critFailure: 'natural 1',
};
/** Was beim Abschluss mit dem Material geschieht. */
const SETTLE: Record<string, string> = {
  success: 'Finish — the work is done',
  all: 'Finish — the work failed, materials come back',
  half: 'Finish — the work failed, half the materials are lost',
  none: 'Finish — the work failed, materials are lost',
};
const OUTCOME: Record<string, string> = { open: 'in progress', succeeded: 'done', failed: 'failed', aborted: 'aborted' };

/**
 * **Die Werkbank** (T-128, REQ-184): am Rezept einen Auftrag starten — wer
 * fertigt, und erst beim Start, welches Material aus seinem Inventar und
 * dem der Gruppe, auch aus einer Gruppe oder als Ersatz (T-197) —, am
 * Auftrag Fortschritt, Proben und Abschluss. Gerechnet und geprüft wird am
 * Server (`/api/crafting`); hier wird gewählt und gezeigt. Ändert sich der
 * Auftrag, ein Inventar oder das Rezept, fragt sie über den Live-Kanal neu.
 */
@Component({
  selector: 'nw-werkstatt',
  imports: [RouterLink, KurzLink, Handwerksuebersicht, forwardRef(() => FigurHandwerk)],
  template: `
    @if (werkbank(); as s) {
      <section class="werkstatt" aria-label="Crafting">
        @if (s.kind === 'recipe') {
          <h3>Crafting</h3>
          <aside class="regeln" aria-label="Campaign rules">
            <h4>Campaign rules</h4>
            <ul>
              @for (z of s.rules.sentences; track $index) { <li>{{ z }}</li> }
            </ul>
            @if (s.recipe.sourceFailure) { <p class="quelle-text">The source says: “{{ s.recipe.sourceFailure }}” — the campaign rule applies.</p> }
            @if (s.rules.campaign; as k) {
              <a [routerLink]="['/artikel', k.id]">{{ s.leitet ? 'Change on ' + k.name : 'Set on ' + k.name }}</a>
            }
          </aside>
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
                  @for (n of s.needs; track n.key) {
                    <li>
                      <span class="was">{{ n.qty }} × <a [routerLink]="['/artikel', n.item]" [nwQuick]="n.item">{{ n.name }}</a>
                        @if (n.group) { <small class="marke">any that fits</small> }
                        @if (!n.consumed) { <small>(not used up)</small> }
                      </span>
                      @if (!n.group) { <small>{{ vorhanden(n.item) }} in {{ f.name }}’s or the party’s inventory</small> }
                    </li>
                  }
                </ul>
              } @else {
                <p class="hinweis">This recipe needs no materials (add a “needs” edge to an item or a material group).</p>
              }
              @if (wahl(); as w) {
                <div class="wahl" role="group" aria-label="Choose materials">
                  <h4>Choose materials for {{ w.actor.name }}</h4>
                  @if (w.substitutions.length) {
                    <p class="hinweis">Substitutions in play:
                      @for (r of w.substitutions; track r.id) { <a [routerLink]="['/artikel', r.id]" [nwQuick]="r.id" [title]="r.does">{{ r.name }}</a>{{ $last ? '' : ', ' }} }
                    </p>
                  }
                  @for (n of w.needs; track n.key) {
                    <fieldset>
                      <legend>{{ n.qty }} × {{ n.name }}
                        <small [class.fehlt]="n.consumed && gedeckt(n.key) < n.qty">{{ zahl(gedeckt(n.key)) }} / {{ n.qty }} chosen</small>
                      </legend>
                      @for (o of n.options; track o.edge) {
                        <label class="quelle">
                          <span>{{ o.name }} <small>· {{ o.owner || 'inventory' }} ({{ o.qty }})</small>
                            @if (o.via; as v) { <small class="ersatz">substitute — {{ v.name }}{{ o.ratio > 1 ? ', ' + o.ratio + ' for one' : '' }}</small> }
                          </span>
                          <input type="number" min="0" [max]="o.qty" [value]="anteil(n.key + '|' + o.edge)"
                                 (change)="setzeMenge(n.key + '|' + o.edge, $any($event.target).value, o.qty)"
                                 [attr.aria-label]="o.name + ' from ' + o.owner + ' for ' + n.name" />
                        </label>
                      } @empty {
                        <small class="fehlt">Nothing in {{ w.actor.name }}’s or the party’s inventory fits.</small>
                      }
                      @if (n.rejected.length) {
                        <details>
                          <summary>{{ n.rejected.length }} piece{{ n.rejected.length === 1 ? '' : 's' }} that do not fit</summary>
                          <ul class="abgelehnt">
                            @for (x of n.rejected; track x.edge) {
                              <li>{{ x.name }} <small>({{ x.owner }})</small> — {{ x.reason }}</li>
                            }
                          </ul>
                        </details>
                      }
                    </fieldset>
                  }
                  <div class="zeile">
                    <button type="button" class="abschluss" (click)="starten()" [disabled]="laeuft()">Reserve and start</button>
                    <button type="button" (click)="wahl.set(null)" [disabled]="laeuft()">Cancel</button>
                  </div>
                  @if (s.leitet) { <p class="hinweis">As GM you may start with gaps.</p> }
                </div>
              } @else {
                <button type="button" (click)="oeffneWahl()" [disabled]="laeuft() || (!f.learned && !s.leitet)">Start crafting…</button>
              }
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
        } @else if (s.kind === 'order') {
          <h3>Crafting order</h3>
          @let o = s.order;
          <aside class="regeln" aria-label="Campaign rules">
            <h4>Campaign rules</h4>
            <ul>
              @for (z of s.rules.sentences; track $index) { <li>{{ z }}</li> }
            </ul>
            @if (o.sourceFailure) { <p class="quelle-text">The source says: “{{ o.sourceFailure }}” — the campaign rule applies.</p> }
            @if (s.rules.campaign; as k) {
              <a [routerLink]="['/artikel', k.id]">{{ s.leitet ? 'Change on ' + k.name : 'Set on ' + k.name }}</a>
            }
          </aside>
          <p>
            @if (o.actor; as a) { <a [routerLink]="['/artikel', a.id]" [nwQuick]="a.id">{{ a.name }}</a> crafts }
            @if (o.recipe; as r) { <a [routerLink]="['/artikel', r.id]" [nwQuick]="r.id">{{ r.name }}</a> }
            <span class="ausgang" [attr.data-outcome]="o.outcome">{{ outcome(o.outcome) }}</span>
          </p>
          <p class="fortschritt">
            @if (o.unit === 'checks') { {{ o.progress }} / {{ o.needed }} successful checks }
            @else { {{ o.progress }} / {{ o.needed }} days worked, then a check }
            · check {{ probeText(o.check) }}
            @if (o.yields; as y) { · yields {{ y.count }} × <a [routerLink]="['/artikel', y.id]" [nwQuick]="y.id">{{ y.name }}</a> }
            @if (o.outcome === 'open' && o.result !== 'open') { <span class="ausgang" [attr.data-outcome]="o.result">{{ outcome(o.result) }} — not yet settled</span> }
          </p>
          <div class="kreise" role="group" aria-label="Checks">
            @for (k of o.circles; track k.index) {
              <button
                type="button"
                class="kreis"
                [attr.data-mark]="k.mark ?? 'none'"
                [class.wartet]="k.pending"
                [class.zaehlt-nicht]="k.ignored"
                [disabled]="!o.may.mark || laeuft() || (!k.open && !k.mark)"
                [attr.aria-label]="kreisText(k)"
                [title]="kreisText(k)"
                (click)="klick(k)"
              >
                <span aria-hidden="true">{{ zeichen(k) }}</span>
              </button>
            }
            @if (o.may.mark && o.outcome === 'open') {
              <small class="kreis-hilfe">Click a circle: once ✓ success, twice ✗ failure, three times empty.</small>
            }
          </div>
          @if (o.reserved.length) {
            <p class="reserviert">
              Reserved:
              @for (r of o.reserved; track r.edge) {
                <span>{{ r.qty }} × <a [routerLink]="['/artikel', r.item]" [nwQuick]="r.item">{{ r.name }}</a>
                  <small>({{ r.owner }}{{ r.for ? ', for ' + r.for : '' }}{{ r.consumed ? '' : ', comes back' }})</small>
                  @if (r.lost !== undefined && r.consumed) {
                    <small class="verlust" [class.fehlt]="r.lost > 0">{{ r.lost > 0 ? r.lost + ' lost on finishing' : 'comes back on finishing' }}</small>
                  }
                </span>
              }
            </p>
          }
          @if (o.lines.length) {
            <ol class="verlauf" aria-label="History">
              @for (l of o.lines; track l.index) {
                <li><span class="nr">Check {{ l.index + 1 }}</span> {{ l.note }} {{ wurf(o.circles[l.index]) }}</li>
              }
            </ol>
          }
          @if (o.waiting && o.may.confirm) {
            <p class="zeile">
              {{ o.waiting }} check{{ o.waiting === 1 ? '' : 's' }} by a player wait{{ o.waiting === 1 ? 's' : '' }} for you.
              <button type="button" (click)="tu('confirm', { accept: true })" [disabled]="laeuft()">Accept</button>
              <button type="button" (click)="tu('confirm', { accept: false })" [disabled]="laeuft()">Reject</button>
            </p>
          } @else if (o.waiting) {
            <p class="hinweis">Dashed circles wait for the GM.</p>
          }
          <div class="aktionen">
            @if (o.may.finish && o.settle) {
              <button type="button" class="abschluss" (click)="tu('finish')" [disabled]="laeuft()">{{ abschluss(o.settle) }}</button>
            }
            @if (o.may.roll) {
              <!-- Am Server würfeln (T-181): W20 plus der Bonus der Figur aus ihrem Statblock. -->
              <button type="button" class="wurf" (click)="wirf()" [disabled]="laeuft()" title="Rolls a d20 plus the crafter's bonus on the server; saved in the rolls log">Roll check</button>
              @if (letzterWurf()) {
                <output class="ergebnis">{{ letzterWurf() }}</output>
              }
              <label>or enter a total <input type="number" [value]="summe()" (input)="summe.set($any($event.target).value)" aria-label="Check total" /></label>
              <label>d20
                <select [value]="nat()" (change)="nat.set($any($event.target).value)" aria-label="Natural roll">
                  <option value="">—</option>
                  <option value="20">natural 20</option>
                  <option value="1">natural 1</option>
                </select>
              </label>
              <button type="button" (click)="probe()" [disabled]="laeuft() || summe() === ''">Enter roll</button>
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
          @if (o.unit === 'days' && o.outcome === 'open' && o.daysLeft > 0) {
            <p class="hinweis">The check comes once {{ o.daysLeft }} more day{{ o.daysLeft === 1 ? ' is' : 's are' }} worked.</p>
          }
        }
        @if (fehler()) {
          <p class="fehler" role="alert">{{ fehler() }}</p>
        }
      </section>
    } @else if (uebersicht(); as u) {
      <!-- An der Figur der Reiter Crafting (T-247), sonst die Übersicht (T-196). -->
      @if (u.kind === 'actor') {
        <nw-figur-handwerk [sicht]="u" />
      } @else {
        <nw-handwerksuebersicht [sicht]="u" />
      }
    }
  `,
  styles: `
    .werkstatt { margin: 1rem 0; }
    h3, h4 { margin: 0 0 .4rem; }
    .hinweis, small { color: var(--dim); }
    .regeln { font-size: .9em; border: 1px solid var(--line); border-radius: .4rem; padding: .5rem .8rem; margin: .4rem 0 .8rem; }
    .regeln h4 { margin: 0 0 .2rem; font-size: 1em; }
    .regeln ul { list-style: disc; padding-left: 1.2rem; margin: .2rem 0; }
    .quelle-text { color: var(--dim); margin: .2rem 0; }
    .kreise { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; margin: .6rem 0; }
    /* Gross genug für einen Finger (≥ 44 px); ✓ und ✗ sind Zeichen, nicht nur Farbe. */
    .kreis {
      inline-size: 2.75rem; block-size: 2.75rem; min-inline-size: 44px; min-block-size: 44px;
      border-radius: 50%; padding: 0; display: inline-grid; place-items: center;
      border: 2px solid var(--line); background: var(--paper); color: var(--ink);
      font-size: 1.35rem; line-height: 1; font-weight: 700; cursor: pointer; touch-action: manipulation;
    }
    .kreis:hover:not(:disabled) { border-color: var(--accent); }
    .kreis[data-mark='success'], .kreis[data-mark='critSuccess'] { background: var(--gold); border-color: var(--gold); color: var(--accent-ink); }
    .kreis[data-mark='failure'], .kreis[data-mark='critFailure'] { background: var(--paper); border-color: var(--warn); color: var(--warn); border-width: 3px; }
    .kreis.wartet { border-style: dashed; opacity: .75; }
    .kreis.zaehlt-nicht { opacity: .4; }
    .kreis:disabled { cursor: default; }
    .kreis:disabled[data-mark='none'] { border-style: dotted; }
    .kreis-hilfe { flex-basis: 100%; }
    .verlauf { padding-left: 1.4rem; font-size: .9em; }
    .verlauf .nr { font-weight: 600; margin-right: .3rem; }
    .verlust { margin-left: .2rem; }
    .abschluss { font-weight: 600; }
    .zeile, .aktionen { display: flex; flex-wrap: wrap; gap: .5rem 1rem; align-items: center; margin: .5rem 0; }
    select { margin-left: .4rem; max-width: 14rem; }
    ul, ol { padding: 0; margin: .4rem 0; }
    ul { list-style: none; }
    ol { padding-left: 1.4rem; }
    .material li { padding: .35rem 0; border-bottom: 1px solid var(--rule); display: flex; flex-wrap: wrap; gap: .3rem 1rem; align-items: baseline; }
    .was { flex: 1 1 14rem; min-width: 0; overflow-wrap: anywhere; }
    .was small { margin-left: .4rem; }
    .quelle input { width: 4rem; margin-left: .3rem; }
    .wahl { border: 1px solid var(--line); border-radius: .4rem; padding: .5rem .8rem; margin: .6rem 0; }
    .wahl fieldset { border: 0; border-bottom: 1px solid var(--rule); margin: 0; padding: .4rem 0; min-width: 0; }
    .wahl legend { font-weight: 600; padding: 0; }
    .wahl legend small { font-weight: normal; margin-left: .4rem; }
    .wahl .quelle { display: flex; flex-wrap: wrap; justify-content: space-between; gap: .3rem 1rem; align-items: center; padding: .2rem 0; }
    .wahl .quelle > span { flex: 1 1 12rem; min-width: 0; overflow-wrap: anywhere; }
    .ersatz { display: block; }
    .marke { margin-left: .4rem; padding: 0 .3rem; border: 1px solid var(--rule); border-radius: .5rem; }
    .abgelehnt { font-size: .9em; color: var(--dim); }
    .abgelehnt li { padding: .1rem 0; overflow-wrap: anywhere; }
    .fehlt { color: var(--warn, #a33); }
    .fortschritt progress { width: min(12rem, 100%); vertical-align: middle; }
    .reserviert span { margin-right: .8rem; }
    .reserviert small { margin-left: .2rem; }
    .ausgang { margin-left: .5rem; font-size: .85em; padding: 0 .4rem; border: 1px solid var(--rule); border-radius: .6rem; }
    .aktionen input { width: 5rem; margin-left: .3rem; }
    .aktionen .ergebnis { font-weight: 600; font-variant-numeric: tabular-nums; }
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
  /** Die Materialwahl, offen nach „Start crafting…" (T-197). */
  protected readonly wahl = signal<HandwerkMaterialwahl | null>(null);
  /** Je Bestandteil und Kante (`need|edge`), wie viel davon reserviert werden soll. */
  protected readonly menge = signal<Record<string, number>>({});
  protected readonly summe = signal('');
  protected readonly nat = signal('');
  /** Der letzte Wurf am Server (T-181), wie er im Log steht. */
  protected readonly letzterWurf = signal('');
  protected readonly rueck = signal('none');
  private lauf = 0;

  /** Rezept oder Auftrag: die Werkbank. Beruf, Werkzeug, Figur: die Übersicht (T-196). */
  protected readonly werkbank = computed(() => {
    const s = this.sicht();
    return s?.kind === 'recipe' || s?.kind === 'order' ? s : null;
  });
  protected readonly uebersicht = computed((): HandwerkUebersicht | null => {
    const s = this.sicht();
    return s && s.kind !== 'recipe' && s.kind !== 'order' && s.kind !== 'none' ? s : null;
  });

  protected readonly figur = computed(() => {
    const s = this.sicht();
    return s?.kind === 'recipe' ? (s.actors.find((a) => a.id === this.wer()) ?? null) : null;
  });

  constructor() {
    effect(() => void this.holen(this.id()));
    const ab = inject(Live).onArtikel((ev) => {
      const uebersicht = !!this.uebersicht() && (ev.type === 'Recipe' || ev.type === 'Trade' || ev.type === 'Statblock');
      if (this.betrifft(ev.id) || uebersicht || ev.type === 'CraftingOrder' || ev.type === 'Inventory') void this.holen(this.id(), true);
    });
    inject(DestroyRef).onDestroy(ab);
  }

  private betrifft(id: string): boolean {
    const s = this.sicht();
    if (!s) return false;
    if (id === this.id()) return true;
    if (s.kind === 'order') return s.order.actor?.id === id || s.order.recipe?.id === id;
    if (s.kind === 'recipe') return s.actors.some((a) => a.id === id);
    return false;
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
    this.wahl.set(null);
  }

  /** Wie viele Stücke des genannten Gegenstands frei da sind — ohne Gruppe und Ersatz; die zeigt erst die Wahl. */
  protected vorhanden(item: string): number {
    return (this.figur()?.stock ?? []).filter((v) => v.item === item).reduce((n, v) => n + v.qty, 0);
  }

  /**
   * **„Start crafting…"** (T-197): erst jetzt fragt die Werkbank, welche
   * Stücke passen — der genannte Gegenstand, Stücke einer Gruppe, Ersatz
   * nach den Regeln der Kampagne. Vorgeschlagen wird nur das Genannte und
   * die Gruppe, der Reihe nach; einen Ersatz wählt man selbst.
   */
  protected async oeffneWahl(): Promise<void> {
    const s = this.sicht();
    const f = this.figur();
    if (s?.kind !== 'recipe' || !f) return;
    await this.schreibe(async () => {
      const w = await this.api.craftingMaterials(s.recipe.id, f.id);
      const m: Record<string, number> = {};
      const vergeben = new Map<string, number>();
      for (const n of w.needs) {
        let rest = n.qty;
        for (const o of n.options) {
          if (o.via || rest <= 0) continue;
          const frei = o.qty - (vergeben.get(o.edge) ?? 0);
          const nimm = Math.min(rest, frei);
          if (nimm <= 0) continue;
          m[`${n.key}|${o.edge}`] = nimm;
          vergeben.set(o.edge, (vergeben.get(o.edge) ?? 0) + nimm);
          rest -= nimm;
        }
      }
      this.menge.set(m);
      this.wahl.set(w);
    });
  }

  /** Gedeckt in Einheiten des Rezepts: ein Ersatz zählt nach seinem Verhältnis. */
  protected gedeckt(need: string): number {
    const n = this.wahl()?.needs.find((x) => x.key === need);
    const m = this.menge();
    return (n?.options ?? []).reduce((s, o) => s + (m[`${need}|${o.edge}`] ?? 0) / o.ratio, 0);
  }

  protected anteil(key: string): number {
    return this.menge()[key] ?? 0;
  }

  protected zahl(n: number): string {
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
  }

  protected setzeMenge(key: string, wert: string, hoechstens: number): void {
    const n = Math.max(0, Math.min(hoechstens, Math.trunc(Number(wert) || 0)));
    this.menge.update((m) => ({ ...m, [key]: n }));
  }

  protected async starten(): Promise<void> {
    const s = this.sicht() as RezeptSicht | null;
    const w = this.wahl();
    if (!s || !w) return;
    const m = this.menge();
    const materials = w.needs.flatMap((n) =>
      n.options
        .filter((o) => (m[`${n.key}|${o.edge}`] ?? 0) > 0)
        .map((o) => ({ inventory: o.inventory, edge: o.edge, qty: m[`${n.key}|${o.edge}`] ?? 0, need: n.key })),
    );
    await this.schreibe(async () => {
      const { id } = await this.api.startCrafting(s.recipe.id, w.actor.id, materials);
      this.wahl.set(null);
      await this.router.navigate(['/artikel', id]);
    });
  }

  /** **Am Server würfeln** (T-181): der Server nimmt den Bonus der Figur und setzt den Kreis. */
  protected async wirf(): Promise<void> {
    this.letzterWurf.set('');
    await this.schreibe(async () => {
      const r = (await this.api.craftingAction(this.id(), 'roll', { roll: true })) as { roll?: RollEntry };
      if (r.roll) this.letzterWurf.set(rollText(r.roll));
      await this.holen(this.id());
    });
  }

  protected async probe(): Promise<void> {
    const body: Record<string, unknown> = { total: Number(this.summe()) };
    if (this.nat()) body['nat'] = Number(this.nat());
    await this.tu('roll', body);
    this.summe.set('');
    this.nat.set('');
  }

  /**
   * **Ein Klick auf einen Kreis** (T-165): leer → ✓ → ✗ → leer. Gezeigt
   * wird sofort, geschickt der Zielstand; die Antwort (und der Live-Kanal)
   * bringt, was die Regel daraus macht.
   */
  protected async klick(k: HandwerkKreis): Promise<void> {
    const s = this.sicht();
    if (s?.kind !== 'order') return;
    const ziel = nextMark(k.mark);
    const circles = s.order.circles.map((c) => (c.index === k.index ? { ...c, mark: ziel, pending: false } : c));
    this.sicht.set({ ...s, order: { ...s.order, circles } });
    await this.schreibe(async () => {
      await this.api.craftingCheck(this.id(), k.index, ziel);
    });
    await this.holen(this.id(), true);
  }

  protected async tu(action: 'roll' | 'confirm' | 'work' | 'finish' | 'abort' | 'fail', body: Record<string, unknown> = {}): Promise<void> {
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

  protected masz(unit: 'checks' | 'days', n: number): string {
    return unit === 'checks' ? `${n} successful check${n === 1 ? '' : 's'}` : `${n} day${n === 1 ? '' : 's'} of work, then a check`;
  }
  protected probeText(c: HandwerkAuftrag['check']): string {
    return `${c.ability.toUpperCase()}${c.tool ? ` (${c.tool})` : ''} DC ${c.dc}`;
  }
  protected zeichen(k: HandwerkKreis): string {
    if (k.mark === 'success' || k.mark === 'failure') return k.mark === 'success' ? '✓' : '✗';
    if (k.mark === 'critSuccess') return '✓✓';
    if (k.mark === 'critFailure') return '✗';
    return '';
  }
  protected kreisText(k: HandwerkKreis): string {
    const was = k.mark ? MARK[k.mark] : k.open ? 'empty' : 'not yet (work the days first)';
    const zusatz = [k.pending ? 'waits for the GM' : '', k.ignored ? 'does not count' : '', k.by ? `by ${k.by}` : ''].filter(Boolean).join(', ');
    return `Check ${k.index + 1}: ${was}${zusatz ? ` (${zusatz})` : ''}`;
  }
  protected wurf(k: HandwerkKreis | undefined): string {
    if (!k || k.total === undefined) return '';
    return `(rolled ${k.total}${k.nat ? `, natural ${k.nat}` : ''}${k.dc !== undefined ? ` vs DC ${k.dc}` : ''})`;
  }
  protected abschluss(settle: string): string {
    return SETTLE[settle] ?? 'Finish';
  }
  protected outcome(o: string): string {
    return OUTCOME[o] ?? o;
  }
}

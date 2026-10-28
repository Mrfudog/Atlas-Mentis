import { Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { expectedDamage, inPoly, planBudget, planText, rangeBand, type PlanCost, type PlanStep, type PlanTile, type Size, type TurnPlan } from '@nw/model';
import { Api, type ZugLage } from '../kern/api';
import { Live } from '../kern/live';
import type { Planung, PlanTipp } from './karte';

/** Wie eine Kachel ihre Kosten zeigt — die Formen aus BG3: Kreis, Dreieck, Raute. */
const KOSTEN: Record<string, { zeichen: string; wort: string }> = {
  action: { zeichen: '●', wort: 'Action' },
  bonus: { zeichen: '▲', wort: 'Bonus action' },
  reaction: { zeichen: '◆', wort: 'Reaction' },
  free: { zeichen: '○', wort: 'Free' },
};

let zaehler = 0;
const neueId = () => `s${Date.now().toString(36)}${(zaehler++).toString(36)}`;

/**
 * **Die Aktionsleiste am Zug** (T-198) — ein Prototyp zum Testen, à la
 * Baldur's Gate 3: unten die Ressourcen (Aktion, Bonusaktion, Reaktion,
 * Bewegung) und die Kacheln aus dem Statblock; darüber die Zugfolge, die
 * man zurechtlegt, umordnet und der Leitung schickt. Auf der Karte zeigt
 * `nw-karte` dazu Reichweite, Weg und Ziele (`planung`), und ein Antippen
 * dort kommt als `tipp()` hierher zurück.
 *
 * Die Leitung sieht darunter die eingereichten Züge und bestätigt sie —
 * dann würfelt der Server (T-172) und das Token wandert. Gerechnet wird
 * nichts Neues hier: die Kacheln und Trefferchancen kommen vom Server, die
 * Ressourcen aus `planBudget` — dieselbe Rechnung, die der Server prüft.
 */
@Component({
  selector: 'nw-zugplaner',
  template: `
    @if (lage(); as l) {
      @if (l.actors.length || l.plans.length) {
        <section class="leiste" aria-label="Turn planner">
          <header class="kopf">
            <b class="auf">Plan turn</b>
            @if (l.actor; as a) {
              @if (l.actors.length > 1) {
                <select aria-label="Who plans" (change)="figur($any($event.target).value)">
                  @for (x of l.actors; track x.id) {
                    <option [value]="x.id" [selected]="x.id === a.id">{{ x.name }}{{ x.own ? '' : ' (GM)' }}</option>
                  }
                </select>
              } @else {
                <strong class="wer">{{ a.name }}</strong>
              }
              <div class="res" aria-label="Resources left">
                @for (r of ressourcen(); track r.key) {
                  @if (r.key !== 'reaction' || l.planner === 'full') {
                  <span class="pip" [class]="'r-' + r.key" [class.leer]="r.left <= 0" [title]="r.title">{{ r.zeichen }}</span>
                  }
                }
                <span class="tempo" [class.leer]="budget().left.movement <= 0" title="Movement left">
                  <span class="balken"><span [style.width.%]="tempoAnteil()"></span></span>
                  {{ budget().left.movement }}/{{ tempo() }} ft
                </span>
              </div>
            }
          </header>

          <!-- Gelegenheitsangriff (Runde 2) oder das Angebot einer Regel (REQ-357):
               wer reagieren darf, wird gefragt — auch bei zugeklappter Leiste. -->
          @for (p of fragen(); track p.plan) {
            @let q = p.pending!;
            @if (q.rule) {
              <div class="frage" role="alertdialog" [attr.aria-label]="(q.offer ?? q.ruleName) + ' by ' + q.reactorName">
                <b>{{ q.offer ?? q.ruleName }}?</b>
                {{ q.reactorName }} may react ({{ q.ruleName }}).
                <span class="knoepfe">
                  <button type="button" class="primaer" [disabled]="sendet()" (click)="reagieren(p, true)">{{ q.strike ? 'Attack' : 'Use' }}</button>
                  <button type="button" [disabled]="sendet()" (click)="reagieren(p, false)">{{ q.strike ? 'Let go' : 'Skip' }}</button>
                </span>
              </div>
            } @else {
              <div class="frage" role="alertdialog" [attr.aria-label]="'Opportunity attack by ' + q.reactorName">
                <b>Opportunity attack?</b>
                {{ p.actorName }} leaves the reach of {{ q.reactorName }}.
                <span class="knoepfe">
                  <button type="button" class="primaer" [disabled]="sendet()" (click)="reagieren(p, true)">Attack</button>
                  <button type="button" [disabled]="sendet()" (click)="reagieren(p, false)">Let go</button>
                </span>
              </div>
            }
          }

          <!-- Die Leitung sieht zuerst, was auf sie wartet. -->
          @if (l.leitet && l.plans.length) {
            <div class="leitung" aria-label="Turns sent to you">
              <h3>Turns</h3>
              <ul>
                @for (p of l.plans.slice(0, 8); track p.plan) {
                  <li [class]="'p-' + p.state">
                    <div>
                      <b>{{ p.actorName }}</b>
                      <span class="dim">{{ p.by.name }} · {{ zustand(p) }}</span>
                    </div>
                    <div class="txt">{{ text(p.steps) }}</div>
                    @for (r of p.results ?? []; track r.step) {
                      <div class="ergebnis" [class.treffer]="r.hit === true" [class.daneben]="r.hit === false">{{ r.text }}</div>
                    }
                    @if (p.note) {
                      <div class="dim">“{{ p.note }}”</div>
                    }
                    @if (p.state === 'planned') {
                      <div class="knoepfe">
                        <button type="button" class="primaer" [disabled]="sendet()" (click)="entscheiden(p, 'confirm')">Confirm &amp; roll</button>
                        <button type="button" [disabled]="sendet()" (click)="entscheiden(p, 'reject')">Reject</button>
                      </div>
                    }
                  </li>
                }
              </ul>
            </div>
          }
          @if (l.actor) {
            <!-- Die Zugfolge: ziehen zum Umordnen, ← → am Telefon. -->
            <ol class="folge" aria-label="Your turn, in order" (dragover)="$event.preventDefault()" (drop)="fallen($event, schritte().length)">
              @for (s of schritte(); track s.id; let i = $index) {
                <li
                  class="schritt"
                  [class]="'c-' + (s.kind === 'move' ? 'move' : s.cost)"
                  draggable="true"
                  (dragstart)="ziehen($event, i)"
                  (dragover)="$event.preventDefault()"
                  (drop)="fallen($event, i); $event.stopPropagation()"
                >
                  <span class="nr">{{ i + 1 }}</span>
                  <span class="txt">{{ schrittText(s) }}</span>
                  @if (vorschauVon(s); as v) {
                    <small>{{ v }}</small>
                  }
                  @for (w of warnungVon(s); track w) {
                    <small class="warnung">⚠ {{ w }}</small>
                  }
                  <span class="knoepfe">
                    <button type="button" [disabled]="i === 0" (click)="schieben(i, -1)" [attr.aria-label]="'Earlier: ' + schrittText(s)">←</button>
                    <button type="button" [disabled]="i === schritte().length - 1" (click)="schieben(i, 1)" [attr.aria-label]="'Later: ' + schrittText(s)">→</button>
                    <button type="button" (click)="weg(i)" [attr.aria-label]="'Remove: ' + schrittText(s)">×</button>
                  </span>
                </li>
              } @empty {
                <li class="hinweis">Tap <b>Move</b> and a square on the map, or an action and a target — then send the turn to the GM.</li>
              }
            </ol>

            <p class="stand" role="status">
              @if (modus() === 'move') {
                Tap a blue square to move there ({{ budget().left.movement }} ft left).
                @if (lage()?.terrain?.length) {
                  Brown squares are difficult terrain: each costs double.
                }
                @if (lage()?.passable?.length) {
                  You may pass through allies but not stop on them.
                }
                <button type="button" class="klein" (click)="modus.set('idle')">Done</button>
              } @else if (gewaehlt(); as t) {
                Pick a target for <b>{{ t.name }}</b> (range {{ t.range }} ft{{ t.longRange ? ', long ' + t.longRange : '' }}).
                <button type="button" class="klein" (click)="abwaehlen()">Cancel</button>
              } @else if (budget().problems.length) {
                <span class="fehler">{{ budget().problems.join(' ') }}</span>
              } @else if (warnungen().length) {
                <span class="warnung">⚠ {{ warnungen().length === 1 ? 'This turn provokes an opportunity attack' : 'This turn provokes ' + warnungen().length + ' opportunity attacks' }} — Disengage first to avoid it.</span>
              } @else if (fehler(); as f) {
                <span class="fehler">{{ f }}</span>
              } @else if (meinPlan(); as p) {
                {{ planStand(p) }}
              }
            </p>

            <div class="kacheln" role="toolbar" aria-label="Actions">
              <button
                type="button"
                class="kachel c-move"
                [class.an]="modus() === 'move'"
                [disabled]="budget().left.movement <= 0 || hatUebergang()"
                (click)="bewegen()"
                title="Move: tap a square on the map"
              >
                <span class="k">👣</span>
                <span class="n">Move</span>
                <small>{{ budget().left.movement }} ft</small>
              </button>
              @for (u of uebergaenge(); track u.via) {
                <!-- **Durch einen Übergang** (T-326): steht der Zug in seiner Fläche, kostet er, was der Übergang sagt. -->
                <button
                  type="button"
                  class="kachel c-move"
                  [disabled]="!!u.blocked || hatUebergang() || budget().left.movement < u.feet || (u.cost !== 'free' && budget().left[u.cost] <= 0)"
                  (click)="durch(u)"
                  [title]="u.blocked ?? 'Go through the ' + u.name"
                >
                  <span class="k">⇅</span>
                  <span class="n">Through {{ u.name }}</span>
                  <small>{{ u.feet ? u.feet + ' ft' : '' }}{{ u.feet && u.cost !== 'free' ? ' · ' : '' }}{{ u.cost !== 'free' ? kosten(u.cost).wort : (u.feet ? '' : 'free') }}</small>
                </button>
              }
              @for (t of l.tiles; track t.id) {
                <button
                  type="button"
                  class="kachel"
                  [class]="'c-' + t.cost + ' g-' + t.group"
                  [class.an]="gewaehlt()?.id === t.id"
                  [disabled]="!leistbar(t)"
                  draggable="true"
                  (dragstart)="kachelZiehen($event, t)"
                  (click)="kachel(t)"
                  [title]="kachelTitel(t)"
                >
                  <span class="k">{{ kosten(t.cost).zeichen }}</span>
                  <span class="n">{{ t.name }}</span>
                  @if (t.toHit !== null) {
                    <small>{{ t.toHit >= 0 ? '+' : '' }}{{ t.toHit }} · {{ t.damage }}</small>
                  } @else {
                    <small>{{ kosten(t.cost).wort }}</small>
                  }
                </button>
              }
            </div>

            <div class="senden">
              <button type="button" class="primaer" [disabled]="!schritte().length || !!budget().problems.length || sendet()" (click)="senden()">
                {{ meinPlan()?.state === 'planned' ? 'Update the turn' : 'Send turn to GM' }}
              </button>
              <button type="button" [disabled]="!schritte().length" (click)="leeren()">Clear</button>
            </div>
          }
        </section>
      }
    }
  `,
  styles: `
    :host {
      display: block;
    }
    /* Seit T-325 das Blatt des Werkzeugs „Plan turn“ in der Leiste der
       Karte: Rahmen, Platz und am Telefon die Lage unten gibt die Karte. */
    .leiste {
      display: block;
    }
    .kopf {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.4rem 0.8rem;
    }
    .auf {
      font-family: var(--caps);
      min-height: 36px;
    }
    .zahl {
      display: inline-block;
      min-width: 1.3rem;
      margin-left: 0.3rem;
      border-radius: 0.7rem;
      background: var(--accent);
      color: var(--surface);
      font-size: 0.75rem;
      text-align: center;
    }
    .kopf select {
      min-height: 36px;
    }
    .res {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      margin-left: auto;
    }
    .pip {
      font-size: 1.15rem;
      line-height: 1;
    }
    .r-action {
      color: rgb(46, 140, 60);
    }
    .r-bonus {
      color: rgb(214, 128, 20);
    }
    .r-reaction {
      color: rgb(130, 70, 180);
    }
    .pip.leer {
      opacity: 0.25;
    }
    .tempo {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      font-size: 0.8rem;
      color: var(--dim);
      white-space: nowrap;
    }
    .balken {
      display: inline-block;
      width: 4.5rem;
      height: 0.45rem;
      border-radius: 0.25rem;
      background: var(--line);
      overflow: hidden;
    }
    .balken span {
      display: block;
      height: 100%;
      background: rgb(40, 110, 180);
    }
    .tempo.leer {
      color: var(--accent);
    }
    .folge {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
      list-style: none;
      margin: 0.5rem 0 0.25rem;
      padding: 0;
      min-height: 2.4rem;
    }
    .schritt {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.1rem 0.4rem;
      padding: 0.2rem 0.3rem 0.2rem 0.45rem;
      border: 1px solid var(--line);
      border-left: 4px solid var(--dim);
      border-radius: 0.35rem;
      background: var(--paper, var(--surface));
      cursor: grab;
      max-width: 100%;
    }
    .schritt.c-move {
      border-left-color: rgb(40, 110, 180);
    }
    .schritt.c-action {
      border-left-color: rgb(46, 140, 60);
    }
    .schritt.c-bonus {
      border-left-color: rgb(214, 128, 20);
    }
    .schritt.c-reaction {
      border-left-color: rgb(130, 70, 180);
    }
    .schritt .nr {
      font-size: 0.7rem;
      color: var(--dim);
    }
    .schritt small {
      flex-basis: 100%;
      color: var(--dim);
      font-size: 0.75rem;
    }
    .schritt .knoepfe button {
      min-width: 28px;
      min-height: 28px;
      padding: 0 0.3rem;
    }
    .hinweis {
      color: var(--dim);
      font-size: 0.85rem;
    }
    .stand {
      margin: 0.2rem 0 0.4rem;
      font-size: 0.85rem;
      min-height: 1.2rem;
    }
    .fehler {
      color: var(--accent);
    }
    .klein {
      min-height: 28px;
      margin-left: 0.4rem;
    }
    .kacheln {
      display: flex;
      gap: 0.4rem;
      overflow-x: auto;
      padding-bottom: 0.3rem;
      scroll-snap-type: x proximity;
    }
    .kachel {
      flex: 0 0 auto;
      display: grid;
      justify-items: center;
      gap: 0.1rem;
      width: 5.6rem;
      min-height: 4.4rem;
      padding: 0.3rem;
      border: 2px solid var(--line);
      border-radius: 0.45rem;
      background: var(--paper, var(--surface));
      scroll-snap-align: start;
      touch-action: manipulation;
    }
    .kachel .k {
      font-size: 1.1rem;
      line-height: 1;
    }
    .kachel .n {
      font-weight: 600;
      font-size: 0.8rem;
      line-height: 1.15;
      text-align: center;
    }
    .kachel small {
      font-size: 0.7rem;
      color: var(--dim);
    }
    .kachel.c-move .k,
    .kachel.c-move {
      border-color: rgb(40, 110, 180);
    }
    .kachel.c-action .k {
      color: rgb(46, 140, 60);
    }
    .kachel.c-bonus .k {
      color: rgb(214, 128, 20);
    }
    .kachel.c-reaction .k {
      color: rgb(130, 70, 180);
    }
    .kachel.g-attack {
      border-color: rgb(190, 50, 40, 0.6);
    }
    .kachel.an {
      outline: 3px solid var(--gold);
      outline-offset: 1px;
    }
    .kachel:disabled {
      opacity: 0.4;
    }
    .senden {
      display: flex;
      gap: 0.5rem;
      margin-top: 0.4rem;
    }
    .senden button,
    .leitung button {
      min-height: 40px;
    }
    .primaer {
      background: var(--accent);
      color: var(--surface);
      border-color: var(--accent);
    }
    .leitung {
      margin: 0.4rem 0;
      padding-bottom: 0.4rem;
      border-bottom: 1px solid var(--line);
    }
    .leitung h3 {
      margin: 0.4rem 0;
      font-family: var(--caps);
      font-size: 1rem;
    }
    .leitung ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 0.4rem;
    }
    .leitung li {
      padding: 0.35rem 0.5rem;
      border: 1px solid var(--line);
      border-radius: 0.35rem;
    }
    .leitung li.p-planned {
      border-color: var(--accent);
    }
    .leitung li.p-rejected {
      opacity: 0.6;
    }
    .leitung li.p-reacting {
      border-color: rgb(200, 120, 20);
    }
    .warnung {
      color: rgb(170, 95, 10);
    }
    .frage {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.3rem 0.6rem;
      margin: 0.4rem 0;
      padding: 0.45rem 0.6rem;
      border: 2px solid rgb(200, 120, 20);
      border-radius: 0.4rem;
      background: rgb(200 120 20 / 0.1);
    }
    .frage .knoepfe {
      display: flex;
      gap: 0.5rem;
      margin-left: auto;
    }
    .frage button {
      min-height: 36px;
    }
    .leitung .knoepfe {
      display: flex;
      gap: 0.5rem;
      margin-top: 0.3rem;
    }
    .dim {
      color: var(--dim);
      font-size: 0.8rem;
      margin-left: 0.4rem;
    }
    .ergebnis {
      font-size: 0.85rem;
    }
    .ergebnis.treffer {
      color: rgb(46, 120, 60);
    }
    .ergebnis.daneben {
      color: var(--dim);
    }
    @media (max-width: 640px) {
      .res {
        margin-left: 0;
      }
      .kachel {
        width: 5rem;
      }
    }
  `,
})
export class Zugplaner {
  /** Die Karte, auf der geplant wird. */
  readonly karte = input.required<string>();

  private readonly api = inject(Api);
  protected readonly lage = signal<ZugLage | null>(null);
  protected readonly fehler = signal<string | null>(null);
  protected readonly sendet = signal(false);
  private readonly gewaehlteFigur = signal<string | null>(null);

  /** Der Zug, der gerade zurechtgelegt wird — nur hier, bis er eingereicht ist. */
  protected readonly schritte = signal<PlanStep[]>([]);
  protected readonly modus = signal<'idle' | 'move' | 'target'>('idle');
  protected readonly gewaehlt = signal<PlanTile | null>(null);

  constructor() {
    effect(() => {
      const k = this.karte();
      const f = this.gewaehlteFigur();
      untracked(() => void this.holen(k, f));
    });
    /* Echtzeit (T-116): ein Plan dieser Karte änderte sich — eingereicht,
       bestätigt, abgelehnt. Die Leitung sieht ihn sofort, die Spielerin
       ihr Ergebnis. Bewegt sich ein Token, kommt die Karte selbst neu. */
    const live = inject(Live);
    const ab = live.onPlan((k) => {
      if (k === this.karte()) void this.holen(k, this.gewaehlteFigur());
    });
    const ab2 = live.onArtikel((ev) => {
      if (ev.id === this.karte()) void this.holen(this.karte(), this.gewaehlteFigur());
    });
    /* Etwas verpasst (`reset`, T-399): den Plan neu fragen. */
    const ab3 = live.onNeu((was) => {
      if (was === 'reset') void this.holen(this.karte(), this.gewaehlteFigur());
    });
    inject(DestroyRef).onDestroy(() => {
      ab();
      ab2();
      ab3();
    });
  }

  private lauf = 0;
  private async holen(karte: string, figur: string | null): Promise<void> {
    const n = ++this.lauf;
    try {
      const l = await this.api.turnPlan(karte, figur, this.nat);
      if (n !== this.lauf) return;
      const vorher = this.lage()?.actor?.id;
      this.lage.set(l);
      /* Eine andere Figur fängt mit einem leeren Zug an. */
      if (vorher && vorher !== l.actor?.id) this.leeren();
      /* Ein bestätigter Zug ist geschehen: der Entwurf ist verbraucht. */
      const mein = this.meinPlan();
      if (mein?.state === 'confirmed' && this.eingereicht === mein.plan) {
        this.eingereicht = null;
        this.schritte.set([]);
      }
    } catch {
      if (n === this.lauf) this.lage.set(null);
    }
  }

  protected figur(id: string): void {
    this.gewaehlteFigur.set(id);
  }

  // ------------------------------------------------------------- Rechnung

  protected readonly tempo = computed(() => this.lage()?.actor?.speed ?? 30);
  /** Die Reaktion ist weg (ein Gelegenheitsangriff seit dem eigenen letzten Zug) — die Leiste zeigt es. */
  private readonly reaktionWeg = computed(() => this.lage()?.actor?.reaction === false);
  protected readonly budget = computed(() => planBudget(this.schritte(), this.tempo(), { reactionSpent: this.reaktionWeg() }));
  protected readonly tempoAnteil = computed(() => {
    const max = Math.max(this.tempo(), this.budget().left.movement, 1);
    return Math.max(0, Math.min(100, (this.budget().left.movement / max) * 100));
  });
  protected readonly ressourcen = computed(() => {
    const l = this.budget().left;
    return (['action', 'bonus', 'reaction'] as const).map((key) => ({
      key,
      left: l[key],
      zeichen: KOSTEN[key]!.zeichen,
      title: `${KOSTEN[key]!.wort}: ${l[key] > 0 ? 'available' : key === 'reaction' && this.reaktionWeg() ? 'used until your next turn' : 'used'}`,
    }));
  });

  /** Die Pläne dieser Figur, der jüngste zuerst. */
  protected readonly meinPlan = computed<(TurnPlan & { at: string }) | null>(() => {
    const l = this.lage();
    const a = l?.actor?.id;
    return (a && l?.plans.find((p) => p.actor === a)) || null;
  });
  /**
   * **Hat der Planer diesem Betrachter etwas?** (T-325) Dann steht „Plan
   * turn“ in der Leiste der Karte. Wer planen darf, hat der Server gesiebt
   * (nur die eigenen Figuren, `zugplan.ts`) — hier wird nur gezählt.
   */
  readonly da = computed(() => {
    const l = this.lage();
    return !!l && (l.actors.length > 0 || l.plans.length > 0);
  });
  /** Wie viele Züge auf die Leitung warten — die Zahl am Werkzeug. */
  readonly wartet = computed(() => (this.lage()?.leitet ? this.offeneZuege().length : 0));
  /** Fragt ein Zug diesen Betrachter um eine Reaktion? Dann öffnet Play das Werkzeug. */
  readonly fragt = computed(() => this.fragen().length > 0);
  protected readonly offeneZuege = computed(() => (this.lage()?.plans ?? []).filter((p) => p.state === 'planned' || (p.state === 'reacting' && p.canAnswer)));
  /** Die Züge, die auf eine Antwort dieses Betrachters warten (Gelegenheitsangriff). */
  protected readonly fragen = computed(() => (this.lage()?.plans ?? []).filter((p) => p.state === 'reacting' && p.canAnswer && p.pending));

  /**
   * **Die Gelegenheitsangriffe des Entwurfs**, wie die Karte sie rechnet
   * (`opportunityAttacks`) — sie kennt die Felder, der Planer nicht. Je
   * Schritt die Namen.
   */
  readonly warnungen = signal<readonly { step: string; reactorName: string }[]>([]);
  protected warnungVon(s: PlanStep): string[] {
    return this.warnungen()
      .filter((w) => w.step === s.id)
      .map((w) => `provokes an opportunity attack from ${w.reactorName}`);
  }
  /** Die Bildgrösse der Karte, vom letzten Antippen — der Server rechnet damit die Felder. */
  private nat: Size | null = null;
  /** Der Abstand je Angriffsschritt beim Antippen — für die Vorschau auf langer Reichweite (T-351). */
  private readonly weiten = new Map<string, number | null>();
  private eingereicht: string | null = null;

  /** Was die Karte zeigen soll (`nw-karte [planung]`). */
  readonly planung = computed<Planung | null>(() => {
    const l = this.lage();
    if (!l?.actor) return null;
    const wege = this.schritte().flatMap((s) => (s.kind === 'move' ? [s.path] : []));
    const letzter = wege.at(-1);
    const t = this.gewaehlt();
    const labels: Record<string, string> = {};
    if (t && this.modus() === 'target') {
      for (const z of l.targets) {
        const c = z.chances[t.id];
        const m = z.modes?.[t.id];
        if (c !== undefined) labels[z.id] = `${c}%${m ? (m === 'adv' ? ' adv.' : ' dis.') : ''}`;
      }
    }
    return {
      rel: l.actor.rel,
      from: letzter?.at(-1) ?? null,
      budget: this.budget().left.movement,
      mode: this.modus(),
      range: t?.longRange ?? t?.range ?? null,
      labels,
      paths: wege,
      steps: this.schritte(),
      threats: l.threats ?? [],
      passable: l.passable ?? [],
      terrain: l.terrain ?? [],
    };
  });

  /**
   * **Die Übergänge, an denen der Zug gerade steht** (T-326): wo der letzte
   * Schritt hinführt, sonst das Token — in der Fläche des Übergangs.
   */
  protected readonly uebergaenge = computed(() => {
    const l = this.lage();
    const ps = l?.passages ?? [];
    if (!ps.length) return [];
    const zug = [...this.schritte()].reverse().find((s) => s.kind === 'move');
    const wo = zug?.kind === 'move' && zug.to ? zug.to : ps[0]!.from;
    return ps.filter((u) => (u.area ? inPoly(u.area, wo) : Math.hypot(wo.x - u.at.x, wo.y - u.at.y) <= 0.002));
  });
  /** Nach einem Übergang steht die Figur woanders — der Zug endet dort. */
  protected readonly hatUebergang = computed(() => this.schritte().some((s) => s.kind === 'passage'));
  protected durch(u: { via: string; name: string; feet: number; cost: PlanCost }): void {
    this.dazu({ id: neueId(), kind: 'passage', via: u.via, name: u.name, feet: u.feet, cost: u.cost });
    this.modus.set('idle');
  }

  protected kosten(c: string) {
    return KOSTEN[c] ?? KOSTEN['action']!;
  }

  /** Reicht die Ressource noch? Freie Kacheln immer. */
  protected leistbar(t: PlanTile): boolean {
    return t.cost === 'free' || this.budget().left[t.cost] > 0;
  }

  protected kachelTitel(t: PlanTile): string {
    const teile = [t.name, this.kosten(t.cost).wort];
    if (t.toHit !== null) teile.push(`${t.toHit >= 0 ? '+' : ''}${t.toHit} to hit`, `${t.damage}${t.damageType ? ' ' + t.damageType : ''}`);
    if (t.range !== null) teile.push(`range ${t.range} ft${t.longRange ? `/${t.longRange}` : ''}`);
    if (t.hint) teile.push(t.hint);
    return teile.join(' · ');
  }

  protected schrittText(s: PlanStep): string {
    return planText([s]);
  }
  protected text(steps: PlanStep[]): string {
    return planText(steps);
  }

  /** Die Vorschau eines Angriffs: Trefferchance und erwarteter Schaden. */
  protected vorschauVon(s: PlanStep): string {
    if (s.kind !== 'act' || !s.target) return '';
    const l = this.lage();
    const t = l?.tiles.find((x) => x.id === s.tile);
    const z = l?.targets.find((x) => x.id === s.target);
    /* Lange Reichweite (T-351): die Chance mit Nachteil, die der Server dafür mitgibt. */
    const lang = t ? rangeBand(t, this.weiten.get(s.id) ?? null) === 'long' : false;
    const c = t && z ? (lang ? (z.long?.[t.id] ?? z.chances[t.id]) : z.chances[t.id]) : undefined;
    if (!t || c === undefined) return t?.damage ? `${t.damage} ${t.damageType}` : '';
    const erwartet = expectedDamage(c / 100, t.average);
    const m = z?.modes?.[t.id];
    const wie = [lang ? 'long range' : '', !lang && m ? (m === 'adv' ? 'advantage' : 'disadvantage') : ''].filter(Boolean).join(', ');
    return `${c}% to hit${wie ? ` (${wie})` : ''} · ${t.damage} ${t.damageType}${erwartet !== null ? ` · ≈${erwartet} expected` : ''}`;
  }

  protected zustand(p: TurnPlan): string {
    if (p.state === 'reacting') return `waiting: ${this.reaktionWort(p)} by ${p.pending?.reactorName ?? '?'}?`;
    return p.state === 'planned' ? 'waiting for you' : p.state === 'confirmed' ? `confirmed by ${p.decidedBy?.name ?? 'GM'}` : 'rejected';
  }

  /** Was gefragt wird: das Angebot einer Regel (REQ-357) oder der eingebaute Gelegenheitsangriff. */
  private reaktionWort(p: TurnPlan): string {
    return p.pending?.rule ? (p.pending.offer ?? p.pending.ruleName ?? 'a reaction') : 'opportunity attack';
  }

  protected planStand(p: TurnPlan): string {
    if (p.state === 'planned') return 'Sent — waiting for the GM to confirm.';
    if (p.state === 'reacting') return `Waiting — ${p.pending?.reactorName ?? 'someone'} may react: ${this.reaktionWort(p)}.`;
    if (p.state === 'rejected') return `The GM rejected your last turn${p.note ? `: “${p.note}”` : '.'}`;
    return `Last turn: ${(p.results ?? []).map((r) => r.text).join(' · ') || 'done'}`;
  }

  // ------------------------------------------------------------- Bedienung

  protected bewegen(): void {
    this.gewaehlt.set(null);
    this.modus.set(this.modus() === 'move' ? 'idle' : 'move');
  }

  protected kachel(t: PlanTile): void {
    if (!this.leistbar(t)) return;
    if (t.targeted) {
      const schon = this.gewaehlt()?.id === t.id;
      this.gewaehlt.set(schon ? null : t);
      this.modus.set(schon ? 'idle' : 'target');
      return;
    }
    this.dazu({ id: neueId(), kind: 'act', tile: t.id, name: t.name, cost: t.cost });
  }

  protected abwaehlen(): void {
    this.gewaehlt.set(null);
    this.modus.set('idle');
  }

  /** Ein Antippen auf der Karte (`nw-karte (planTipp)`). */
  tipp(e: PlanTipp): void {
    if (e.kind === 'cell' && this.modus() === 'move') {
      this.nat = e.nat;
      this.dazu({ id: neueId(), kind: 'move', path: e.path, feet: e.feet, to: e.to });
      /* Weiter bewegen, solange Tempo da ist — wie in BG3 ein Klick je Ziel. */
      if (this.budget().left.movement <= 0) this.modus.set('idle');
      return;
    }
    const t = this.gewaehlt();
    if (e.kind === 'target' && t && this.modus() === 'target') {
      if (e.nat) this.nat = e.nat;
      /* Dieselbe Rechnung wie der Server (T-351): ausser Reichweite nimmt er nicht an. */
      if (rangeBand(t, e.feet) === 'out') {
        this.fehler.set(`${e.name} is ${e.feet} ft away — out of range for ${t.name}. Move closer first or pick another target.`);
        return;
      }
      const id = neueId();
      this.weiten.set(id, e.feet);
      this.dazu({ id, kind: 'act', tile: t.id, name: t.name, cost: t.cost, target: e.id, targetName: e.name });
      this.abwaehlen();
    }
  }

  private dazu(s: PlanStep): void {
    this.fehler.set(null);
    this.schritte.update((xs) => [...xs, s]);
  }

  protected weg(i: number): void {
    this.schritte.update((xs) => {
      const neu = xs.filter((_, k) => k !== i);
      /* Fällt ein Weg weg, passen die späteren nicht mehr an sein Ende — sie gehen mit. */
      return xs[i]?.kind === 'move' ? neu.filter((s, k) => s.kind !== 'move' || k < i) : neu;
    });
  }

  /** Umordnen. Zwei Wege tauschen nicht: der zweite fängt am Ende des ersten an. */
  protected schieben(i: number, um: number): void {
    this.verschieben(i, i + um);
  }

  private verschieben(von: number, nach: number): void {
    const xs = [...this.schritte()];
    if (von === nach || von < 0 || von >= xs.length) return;
    const [s] = xs.splice(von, 1);
    xs.splice(Math.max(0, Math.min(xs.length, nach)), 0, s!);
    const wege = (l: PlanStep[]) => l.filter((x) => x.kind === 'move').map((x) => x.id).join();
    if (wege(xs) !== wege(this.schritte())) {
      this.fehler.set('Two moves keep their order — the second starts where the first ends.');
      return;
    }
    this.fehler.set(null);
    this.schritte.set(xs);
  }

  private gezogen: { art: 'schritt'; i: number } | { art: 'kachel'; t: PlanTile } | null = null;
  protected ziehen(ev: DragEvent, i: number): void {
    this.gezogen = { art: 'schritt', i };
    ev.dataTransfer?.setData('text/plain', String(i));
  }
  protected kachelZiehen(ev: DragEvent, t: PlanTile): void {
    this.gezogen = { art: 'kachel', t };
    ev.dataTransfer?.setData('text/plain', t.id);
  }
  protected fallen(ev: DragEvent, i: number): void {
    ev.preventDefault();
    const g = this.gezogen;
    this.gezogen = null;
    if (!g) return;
    if (g.art === 'schritt') this.verschieben(g.i, i);
    /* Eine Kachel in die Folge gezogen: wie ein Antippen — ein Angriff will dann sein Ziel. */ else this.kachel(g.t);
  }

  protected leeren(): void {
    this.schritte.set([]);
    this.abwaehlen();
    this.fehler.set(null);
  }

  protected async senden(): Promise<void> {
    const l = this.lage();
    if (!l?.actor || this.sendet()) return;
    this.sendet.set(true);
    try {
      const mein = this.meinPlan();
      const p = await this.api.submitTurnPlan(this.karte(), {
        actor: l.actor.id,
        steps: this.schritte(),
        ...(mein?.state === 'planned' ? { plan: mein.plan } : {}),
        ...(this.nat ? { nat: this.nat } : {}),
      });
      this.eingereicht = p.plan;
      this.abwaehlen();
      await this.holen(this.karte(), this.gewaehlteFigur());
    } catch (e) {
      this.fehler.set((e as Error).message);
    } finally {
      this.sendet.set(false);
    }
  }

  /** Die Antwort auf die Frage „Opportunity attack?" — am Server gewürfelt. */
  protected async reagieren(p: TurnPlan, angreifen: boolean): Promise<void> {
    if (this.sendet()) return;
    this.sendet.set(true);
    try {
      await this.api.reactTurnPlan(this.karte(), p.plan, angreifen);
      await this.holen(this.karte(), this.gewaehlteFigur());
    } catch (e) {
      this.fehler.set((e as Error).message);
    } finally {
      this.sendet.set(false);
    }
  }

  protected async entscheiden(p: TurnPlan, d: 'confirm' | 'reject'): Promise<void> {
    if (this.sendet()) return;
    const note = d === 'reject' ? (globalThis.prompt?.('Why? (optional)') ?? '') : '';
    this.sendet.set(true);
    try {
      await this.api.decideTurnPlan(this.karte(), p.plan, d, note || undefined);
      await this.holen(this.karte(), this.gewaehlteFigur());
    } catch (e) {
      this.fehler.set((e as Error).message);
    } finally {
      this.sendet.set(false);
    }
  }
}


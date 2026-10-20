import { Component, DestroyRef, ElementRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import type { QuickAction, TrackerOp, TrackerRow, TrackerView } from '@nw/model';
import { Api } from '../kern/api';
import { BegriffLink, Glossar } from '../kern/glossar';
import { KurzLink } from '../kern/kurzansicht';
import { Live } from '../kern/live';
import { Session } from '../kern/session';
import { Wahl } from '../artikel/wahl';

/** Was gerade an einer Zeile offen ist: eine Zahl für Schaden oder Heilung, oder der Effekt. */
type Offen = { edge: string; was: 'damage' | 'heal' | 'effect' } | null;

/**
 * **Der Initiative-Tracker** (T-022, REQ-115, REQ-128, REQ-211–213):
 * eine eigene Komponente in Play und auf der Seite der Begegnung (Element
 * `initiative`). Die Reihe kommt gerechnet und gesiebt vom Server
 * (`GET /api/encounters/:id/tracker`) — die Leitung sieht sie ganz, alle
 * anderen, was die Kampagne ihnen zeigt (Rules & options › Combat). Hier
 * wird nichts zurückgehalten und nichts gerechnet.
 *
 * Die Leitung führt die Züge, Trefferpunkte und Effekte; eine Spielerin
 * beendet ihren eigenen Zug. Jede Änderung kommt über den Live-Kanal
 * (T-116) als Ereignis der Begegnung zurück, und der Tracker fragt neu —
 * der Beamer und das Telefon zeigen dasselbe. Der Ring am Token (T-117)
 * steht auf der Karte und bleibt dort.
 */
@Component({
  selector: 'nw-initiative',
  imports: [RouterLink, KurzLink, BegriffLink, Wahl],
  template: `
    <section class="tracker" aria-label="Initiative" [class.gross]="gross()">
      <header class="kopf">
        <h2>Initiative</h2>
        @if (sicht(); as v) {
          <a class="name" [routerLink]="['/artikel', v.id]" [nwQuick]="v.id">{{ v.name }}</a>
          <span class="marke" [class.laeuft]="v.round > 0">{{ v.round > 0 ? 'Round ' + v.round : v.phase }}</span>
        }
        <span class="frei"></span>
        @if (sicht(); as v) {
          @if (!v.off) {
            @if (v.gm) {
              @if (v.round < 1) {
                <button type="button" class="haupt" (click)="starten()" [disabled]="laeuft()" title="Roll initiative for who has none and run this encounter">▶ Start</button>
              } @else {
                <button type="button" (click)="tue({ op: 'previous' })" [disabled]="laeuft()" aria-label="Previous turn" title="Previous turn — expired effects do not come back">◀</button>
                <button type="button" class="haupt" (click)="tue({ op: 'next' })" [disabled]="laeuft()" title="End this turn: effects count down, the next combatant starts">Next turn ▶</button>
                @if (v.phase !== 'done') {
                  <button type="button" (click)="beenden()" [disabled]="laeuft()" title="Mark the encounter as done">End</button>
                }
              }
            } @else if (eigenerZug()) {
              <button type="button" class="haupt" (click)="tue({ op: 'next' })" [disabled]="laeuft()">End my turn ▶</button>
            }
          }
        }
        <button type="button" class="klein" (click)="vollbild()" [attr.aria-label]="'Full screen'" title="Full screen — for the projector">⛶</button>
      </header>

      @if (fehler(); as f) {
        <p class="fehler" role="alert">{{ f }}</p>
      }
      @if (!sicht()) {
        <p class="dim">Loading…</p>
      } @else if (sicht()!.off) {
        <p class="dim">
          The initiative tracker is off in this campaign.
          @if (sicht()!.gm) {
            Turn it on under <a routerLink="/campaign">Campaign › Rules &amp; options › Combat</a>.
          }
        </p>
      } @else {
        <ol class="reihe">
          @for (r of sicht()!.rows; track r.edge) {
            <li class="zeile" [class.dran]="r.current" [class.gruppe]="r.party" [class.verbuendet]="r.ally && !r.party" [class.unten]="unten(r)" [attr.aria-current]="r.current ? 'step' : null">
              <div class="haupt-zeile">
                @if (spalte('init')) {
                  @if (sicht()!.gm && initEdit() === r.edge) {
                    <input class="init" type="number" step="1" [value]="r.init ?? ''" aria-label="Initiative" (keydown.enter)="initSetzen(r, $any($event.target).value)" (blur)="initSetzen(r, $any($event.target).value)" />
                  } @else {
                    <button type="button" class="init" [disabled]="!sicht()!.gm" (click)="initEdit.set(r.edge)" [attr.title]="sicht()!.gm ? 'Change initiative' : 'Initiative'">{{ zahl(r.init) }}</button>
                  }
                }
                <span class="wer">
                  @if (r.to) {
                    <a [routerLink]="['/artikel', r.to]" [nwQuick]="r.to">{{ r.name }}</a>
                  } @else {
                    <span>{{ r.name }}</span>
                  }
                  @if (r.current) {
                    <span class="dran-marke">{{ r.own ? 'your turn' : 'turn' }}</span>
                  }
                  @if (sicht()!.gm && !r.party) {
                    <button type="button" class="schalter" [class.an]="r.revealed" (click)="tue({ op: 'flags', edge: r.edge, revealed: !r.revealed })"
                            [attr.aria-pressed]="!!r.revealed" [attr.title]="r.revealed ? 'Shown to the players — click to hide' : 'Hidden from the players — click to show'">
                      {{ r.revealed ? '👁' : '◌' }}
                    </button>
                  }
                </span>
                @if (spalte('ac') && r.ac !== undefined) {
                  <span class="ac" title="Armour class">AC {{ r.ac }}</span>
                }
                @if (spalte('hp')) {
                  <span class="tp" [attr.title]="tpTitel(r)">
                    @if (r.hp !== undefined || r.hpMax !== undefined) {
                      <span class="balken" aria-hidden="true"><span [style.width.%]="anteil(r)" [class.tief]="anteil(r) <= 50"></span></span>
                      <span class="zahl">{{ r.hp ?? '?' }}/{{ r.hpMax ?? '?' }}</span>
                    } @else if (r.hpState) {
                      <span class="wort" [class]="'wort ' + r.hpState">{{ r.hpState }}</span>
                    }
                  </span>
                }
              </div>

              @if (spalte('effects') && r.effects.length) {
                <ul class="effekte" aria-label="Effects">
                  @for (x of r.effects; track x.index) {
                    <li [class.verborgen]="x.hidden" [attr.title]="effektTitel(x)">
                      @if (x.rule) {
                        <a [routerLink]="['/artikel', x.rule]" [nwQuick]="x.rule" [nwBegriff]="begriff(x.rule, x.name)">{{ x.name }}</a>
                      } @else {
                        <span>{{ x.name }}</span>
                      }
                      @if (x.rounds !== undefined) {
                        <span class="runden">{{ x.rounds }}</span>
                      }
                      @if (sicht()!.gm) {
                        <button type="button" class="weg" (click)="tue({ op: 'removeEffect', edge: r.edge, index: x.index })" [attr.aria-label]="'Remove ' + x.name">×</button>
                      }
                    </li>
                  }
                </ul>
              }
              @if (spalte('actions') && r.actions?.length) {
                <p class="aktionen"><span class="dim">Actions:</span> {{ r.actions!.join(' · ') }}</p>
              }
              @if (sicht()!.gm && r.note) {
                <p class="notiz dim">{{ r.note }}</p>
              }

              @if (sicht()!.gm && schnell().length) {
                <div class="knoepfe">
                  @for (q of schnell(); track q) {
                    @if (q !== 'delay' || r.current) {
                      <button type="button" class="klein" [disabled]="laeuft()" (click)="schnellTun(q, r)">{{ schnellText[q] }}</button>
                    }
                  }
                </div>
              }

              @if (offen(); as o) {
                @if (o.edge === r.edge && (o.was === 'damage' || o.was === 'heal')) {
                  <form class="eingabe" (submit)="$event.preventDefault(); tpAendern(r, o.was, betrag.value)">
                    <label>{{ o.was === 'damage' ? 'Damage' : 'Healing' }} <input #betrag type="number" min="0" step="1" inputmode="numeric" autofocus /></label>
                    <button type="submit" class="klein">Apply</button>
                    <button type="button" class="klein" (click)="offen.set(null)">Cancel</button>
                  </form>
                }
                @if (o.edge === r.edge && o.was === 'effect') {
                  <form class="eingabe effekt" (submit)="$event.preventDefault(); effektSetzen(r)">
                    <div class="zustand">
                      <nw-wahl label="Condition" [arten]="['Condition']" [anlegbar]="false" [wert]="zustand()" (wertChange)="zustand.set($event)" />
                      <span class="dim">or</span>
                      <input type="text" placeholder="Note (Bless, Hunter’s Mark …)" aria-label="Note" [value]="notiz()" (input)="notiz.set($any($event.target).value)" />
                    </div>
                    <label>Rounds <input type="number" min="1" step="1" inputmode="numeric" [value]="runden()" (input)="runden.set($any($event.target).value)" placeholder="until removed" /></label>
                    <label>
                      counts at the
                      <select (change)="zeitpunkt.set($any($event.target).value)">
                        <option value="end" [selected]="zeitpunkt() === 'end'">end</option>
                        <option value="start" [selected]="zeitpunkt() === 'start'">start</option>
                      </select>
                      of
                      <select (change)="anker.set($any($event.target).value)">
                        @for (z of sicht()!.rows; track z.edge) {
                          <option [value]="z.edge" [selected]="(anker() || r.edge) === z.edge">{{ z.edge === r.edge ? 'its own' : z.name + '’s' }} turn</option>
                        }
                      </select>
                    </label>
                    <label class="haken"><input type="checkbox" [checked]="verborgen()" (change)="verborgen.set($any($event.target).checked)" /> hidden from players</label>
                    <button type="submit" class="klein" [disabled]="!zustand() && !notiz().trim()">Add effect</button>
                    <button type="button" class="klein" (click)="offen.set(null)">Cancel</button>
                  </form>
                }
              }
            </li>
          } @empty {
            <li class="dim">{{ sicht()!.gm ? 'No combatants yet — add one below.' : 'Nobody has shown up yet.' }}</li>
          }
        </ol>

        @if (sicht()!.gm) {
          <form class="dazu" (submit)="$event.preventDefault(); dazu()">
            <nw-wahl label="Add a combatant" [arten]="['Creature', 'Statblock', 'Party']" [anlegbar]="false" [wert]="neu()" (wertChange)="neu.set($event)" />
            <input type="number" step="1" aria-label="Initiative of the new combatant" placeholder="Init (roll)" [value]="neuInit()" (input)="neuInit.set($any($event.target).value)" />
            <label class="haken"><input type="checkbox" [checked]="neuVerbuendet()" (change)="neuVerbuendet.set($any($event.target).checked)" /> ally</label>
            <button type="submit" class="klein" [disabled]="!neu() || laeuft()">Add</button>
          </form>
        }
      }
    </section>
  `,
  styles: `
    :host {
      display: block;
    }
    .tracker {
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--surface);
      padding: 0.6rem 0.75rem;
    }
    :host(:fullscreen) .tracker,
    .tracker.gross {
      font-size: 1.35rem;
      min-height: 100%;
      box-sizing: border-box;
    }
    :host(:fullscreen) {
      background: var(--bg);
      overflow: auto;
      padding: 1rem;
    }
    .kopf {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.4rem 0.6rem;
      margin-bottom: 0.4rem;
    }
    h2 {
      margin: 0;
      font-family: var(--caps);
      font-size: 1.1em;
      color: var(--accent);
    }
    .kopf .name {
      color: var(--ink);
      font-weight: 600;
      text-decoration: none;
    }
    .frei {
      flex: 1;
    }
    button {
      min-height: 36px;
      min-width: 36px;
    }
    button.klein {
      min-height: 30px;
      min-width: 30px;
      padding: 0 0.5rem;
      font-size: 0.85em;
    }
    button.haupt {
      border-color: var(--accent);
      color: var(--accent);
      font-weight: 600;
    }
    .marke {
      font-size: 0.75em;
      padding: 0 0.35rem;
      border-radius: 3px;
      background: var(--chip);
      color: var(--dim);
      white-space: nowrap;
    }
    .marke.laeuft {
      background: var(--accent);
      color: var(--surface);
    }
    .reihe {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .zeile {
      padding: 0.4rem 0.4rem;
      border-top: 1px solid var(--line);
      border-left: 4px solid transparent;
    }
    .zeile.dran {
      border-left-color: var(--accent);
      background: color-mix(in srgb, var(--accent) 8%, transparent);
    }
    .zeile.gruppe .wer a,
    .zeile.verbuendet .wer a {
      color: #3f7a4f;
    }
    .zeile.unten .wer {
      text-decoration: line-through;
      opacity: 0.7;
    }
    .haupt-zeile {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.3rem 0.6rem;
    }
    .init {
      width: 3.2em;
      min-height: 32px;
      text-align: center;
      font-variant-numeric: tabular-nums;
      font-weight: 700;
    }
    button.init:disabled {
      opacity: 1;
      color: var(--ink);
      background: var(--chip);
      border-color: transparent;
    }
    .wer {
      flex: 1 1 10rem;
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      min-width: 0;
    }
    .wer a,
    .wer > span:first-child {
      font-weight: 600;
      color: var(--ink);
      text-decoration: none;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .dran-marke {
      font-size: 0.7em;
      padding: 0 0.3rem;
      border-radius: 3px;
      background: var(--accent);
      color: var(--surface);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .schalter {
      min-height: 28px;
      min-width: 28px;
      padding: 0;
      border-color: transparent;
      background: none;
      opacity: 0.6;
    }
    .schalter.an {
      opacity: 1;
    }
    .ac {
      font-variant-numeric: tabular-nums;
      color: var(--dim);
      white-space: nowrap;
    }
    .tp {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      min-width: 7rem;
    }
    .balken {
      flex: 1;
      height: 6px;
      min-width: 3rem;
      border-radius: 3px;
      background: var(--chip);
      overflow: hidden;
    }
    .balken span {
      display: block;
      height: 100%;
      background: #3f7a4f;
    }
    .balken span.tief {
      background: var(--warn);
    }
    .zahl {
      font-variant-numeric: tabular-nums;
      color: var(--dim);
    }
    .wort {
      font-size: 0.85em;
      padding: 0 0.35rem;
      border-radius: 3px;
      background: var(--chip);
    }
    .wort.bloodied {
      color: var(--warn);
    }
    .wort.down {
      background: var(--warn);
      color: var(--surface);
    }
    .effekte {
      list-style: none;
      margin: 0.3rem 0 0;
      padding: 0;
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem;
    }
    .effekte li {
      display: inline-flex;
      align-items: center;
      gap: 0.2rem;
      padding: 0 0.15rem 0 0.35rem;
      border-radius: 3px;
      background: var(--chip);
      font-size: 0.85em;
    }
    .effekte li.verborgen {
      outline: 1px dashed var(--dim);
      opacity: 0.8;
    }
    .effekte a {
      color: var(--ink);
      text-decoration: none;
    }
    .runden {
      font-variant-numeric: tabular-nums;
      font-weight: 700;
      padding: 0 0.25rem;
      border-radius: 2px;
      background: var(--surface);
    }
    .weg {
      min-height: 24px;
      min-width: 24px;
      padding: 0;
      border: none;
      background: none;
    }
    .aktionen,
    .notiz {
      margin: 0.25rem 0 0;
      font-size: 0.85em;
    }
    .knoepfe {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem;
      margin-top: 0.3rem;
    }
    .eingabe,
    .dazu {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.4rem 0.6rem;
      margin-top: 0.4rem;
    }
    .eingabe input[type='number'],
    .dazu input[type='number'] {
      width: 6rem;
      min-height: 32px;
    }
    .zustand {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.4rem;
      flex: 1 1 100%;
    }
    .zustand input[type='text'] {
      flex: 1 1 10rem;
      min-height: 32px;
    }
    .haken {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
    }
    .dazu {
      border-top: 1px solid var(--line);
      padding-top: 0.5rem;
    }
    .dim {
      color: var(--dim);
    }
    .fehler {
      color: var(--warn);
      margin: 0.25rem 0;
    }
    @media (max-width: 640px) {
      .tracker {
        padding: 0.5rem;
      }
      .tp {
        min-width: 0;
        flex: 1 1 100%;
      }
    }
  `,
})
export class Initiative {
  /** Die Begegnung — in Play die der Sitzung (`activeEncounter`), auf ihrer Seite sie selbst. */
  readonly begegnung = input.required<string>();
  /** Gross gezeichnet, für den Beamer. */
  readonly gross = input(false);

  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly session = inject(Session);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly glossar = inject(Glossar);

  protected readonly sicht = signal<(TrackerView & { off?: boolean }) | null>(null);
  protected readonly fehler = signal<string | null>(null);
  protected readonly laeuft = signal(false);
  protected readonly offen = signal<Offen>(null);
  protected readonly initEdit = signal<string | null>(null);
  /* Der Effekt in Arbeit. */
  protected readonly zustand = signal('');
  protected readonly notiz = signal('');
  protected readonly runden = signal('1');
  protected readonly zeitpunkt = signal<'start' | 'end'>('end');
  protected readonly anker = signal('');
  protected readonly verborgen = signal(false);
  /* Ein neuer Teilnehmer. */
  protected readonly neu = signal('');
  protected readonly neuInit = signal('');
  protected readonly neuVerbuendet = signal(false);

  protected readonly schnell = computed<QuickAction[]>(() => this.sicht()?.rules.quickActions ?? []);
  protected readonly eigenerZug = computed(() => !!this.sicht()?.rows.some((r) => r.current && r.own));
  protected readonly schnellText: Record<QuickAction, string> = {
    damage: '− Damage',
    heal: '+ Heal',
    effect: '+ Effect',
    delay: 'Delay',
    reroll: 'Reroll',
    remove: 'Remove',
  };
  private lauf = 0;

  constructor() {
    effect(() => {
      const id = this.begegnung();
      untracked(() => {
        this.sicht.set(null);
        void this.holen(id);
      });
    });
    /* Live (T-116): die Begegnung ändert sich — ein Zug, ein Treffer, ein
       Effekt — oder die Kampagne stellt anders ein. Dann neu fragen. */
    const ab = inject(Live).onArtikel((ev) => {
      if (ev.id === this.begegnung() || ev.type === 'Campaign') void this.holen(this.begegnung());
    });
    inject(DestroyRef).onDestroy(() => {
      ab();
      this.lauf += 1;
    });
  }

  private async holen(id: string): Promise<void> {
    const n = ++this.lauf;
    try {
      const v = await this.api.tracker(id);
      if (n === this.lauf) {
        this.sicht.set(v);
        this.fehler.set(null);
      }
    } catch (e) {
      if (n === this.lauf) this.fehler.set(e instanceof Error ? e.message : 'The tracker did not load.');
    }
  }

  protected spalte(c: string): boolean {
    return !!this.sicht()?.rules.columns.includes(c as never);
  }

  protected async tue(op: TrackerOp): Promise<boolean> {
    if (this.laeuft()) return false;
    this.laeuft.set(true);
    this.fehler.set(null);
    try {
      await this.api.trackerOp(this.begegnung(), op);
      await this.holen(this.begegnung());
      return true;
    } catch (e) {
      this.fehler.set(e instanceof Error ? e.message : 'That did not work.');
      return false;
    } finally {
      this.laeuft.set(false);
    }
  }

  /** „Start" geht über den Kampfstart (T-203): er würfelt und nimmt eine Vorlage als Instanz ins Spiel (T-289). */
  protected async starten(): Promise<void> {
    if (this.laeuft()) return;
    this.laeuft.set(true);
    this.fehler.set(null);
    try {
      const r = await this.api.startEncounter(this.begegnung(), {});
      await this.session.load(true);
      if (r.encounter !== this.begegnung()) {
        /* Begonnen hat eine Instanz: Play folgt dem Tisch, sonst ihre Seite. */
        if (r.session) await this.router.navigate(['/play'], { queryParams: { session: r.session, map: null } });
        else await this.router.navigate(['/artikel', r.encounter]);
        return;
      }
      await this.holen(this.begegnung());
    } catch (e) {
      this.fehler.set(e instanceof Error ? e.message : 'The encounter did not start.');
    } finally {
      this.laeuft.set(false);
    }
  }

  protected beenden(): void {
    if (confirm('End this encounter? The order stays as it is.')) void this.tue({ op: 'end' });
  }

  protected schnellTun(q: QuickAction, r: TrackerRow): void {
    if (q === 'damage' || q === 'heal' || q === 'effect') {
      const jetzt = this.offen();
      if (jetzt?.edge === r.edge && jetzt.was === q) return this.offen.set(null);
      if (q === 'effect') {
        this.zustand.set('');
        this.notiz.set('');
        this.runden.set('1');
        this.zeitpunkt.set('end');
        this.anker.set('');
        this.verborgen.set(false);
      }
      this.offen.set({ edge: r.edge, was: q });
      return;
    }
    if (q === 'delay') void this.tue({ op: 'delay' });
    else if (q === 'reroll') void this.tue({ op: 'init', edge: r.edge, reroll: true });
    else if (q === 'remove' && confirm(`Remove ${r.name} from the encounter?`)) void this.tue({ op: 'remove', edge: r.edge });
  }

  protected async tpAendern(r: TrackerRow, was: 'damage' | 'heal', roh: string): Promise<void> {
    const n = Math.abs(Number(roh));
    if (!roh.trim() || !Number.isFinite(n)) return;
    if (await this.tue({ op: 'hp', edge: r.edge, delta: was === 'damage' ? -n : n })) this.offen.set(null);
  }

  protected async effektSetzen(r: TrackerRow): Promise<void> {
    const n = Number(this.runden());
    const ok = await this.tue({
      op: 'effect',
      edge: r.edge,
      entry: {
        ...(this.zustand() ? { rule: this.zustand() } : { text: this.notiz().trim() }),
        ...(this.runden().trim() && Number.isFinite(n) && n > 0 ? { rounds: n } : {}),
        ...(this.anker() && this.anker() !== r.edge ? { anchor: this.anker() } : {}),
        at: this.zeitpunkt(),
        ...(this.verborgen() ? { hidden: true } : {}),
      },
    });
    if (ok) this.offen.set(null);
  }

  protected initSetzen(r: TrackerRow, roh: string): void {
    if (this.initEdit() !== r.edge) return;
    this.initEdit.set(null);
    const n = Number(roh);
    if (roh.trim() && Number.isFinite(n) && n !== r.init) void this.tue({ op: 'init', edge: r.edge, value: n });
  }

  protected async dazu(): Promise<void> {
    const init = Number(this.neuInit());
    const ok = await this.tue({
      op: 'add',
      to: this.neu(),
      ...(this.neuInit().trim() && Number.isFinite(init) ? { init } : {}),
      ...(this.neuVerbuendet() ? { ally: true } : {}),
    });
    if (ok) {
      this.neu.set('');
      this.neuInit.set('');
      this.neuVerbuendet.set(false);
    }
  }

  protected vollbild(): void {
    const el = this.host.nativeElement as HTMLElement;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  }

  protected zahl(n: number | null): string {
    if (n === null) return '–';
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
  }

  protected anteil(r: TrackerRow): number {
    if (r.hp === undefined || !r.hpMax) return 100;
    return Math.max(0, Math.min(100, (r.hp / r.hpMax) * 100));
  }

  protected unten(r: TrackerRow): boolean {
    return r.hpState === 'down' || (r.hp !== undefined && r.hp <= 0 && !r.party);
  }

  protected tpTitel(r: TrackerRow): string {
    if (r.hp !== undefined || r.hpMax !== undefined) return `Hit points ${r.hp ?? '?'} of ${r.hpMax ?? '?'}`;
    return r.hpState ? `Health: ${r.hpState}` : '';
  }

  protected effektTitel(x: TrackerRow['effects'][number]): string {
    const teile = [x.name];
    if (x.rounds !== undefined) teile.push(`${x.rounds} round${x.rounds === 1 ? '' : 's'} left`);
    if (x.expires) teile.push(`ends at the ${x.expires.at} of ${x.expires.who}’s turn in round ${x.expires.round}`);
    if (x.source) teile.push(`from ${x.source}`);
    if (x.hidden) teile.push('hidden from players');
    return teile.join(' — ');
  }

  protected begriff(id: string | undefined, name: string): string | null {
    return this.glossar.begriffZu(id, name);
  }
}

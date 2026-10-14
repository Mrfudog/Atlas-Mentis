import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  answerChoice,
  answersOf,
  checkPurchase,
  entityName,
  fixedEquipmentLines,
  fixedGold,
  formatCopper,
  itemPrice,
  magicRarity,
  plainEquipmentText,
  startClassOf,
  startingGoldOf,
  assignScore,
  assignmentProblem,
  builderSteps,
  choiceKey,
  choiceText,
  choicesAtCharacter,
  chosenResult,
  enumOptions,
  gainedFeatures,
  pointBuyRange,
  pointBuySpent,
  pruneAnswers,
  setClassLevel,
  setPick,
  type AbilityMethod,
  type BuilderStep,
  type ChoiceAtCharacter,
  type Entity,
  type EquipmentMethod,
  type GoldRoll,
  type Purchase,
  type RolledScores,
} from '@nw/model';
import { Api, ApiError, type ListenZeile } from '../kern/api';
import { Bestand } from '../kern/bestand';
import { Session } from '../kern/session';

interface Moeglichkeit {
  /** Was in die Antwort kommt: Artikel-Id, Name oder Schlüssel. */
  wert: string;
  label: string;
  hinweis?: string;
}

interface Gruppe {
  id: string;
  name: string;
  pools: Record<string, RolledScores & { at?: string }>;
}

const LEER: Entity = { id: 'draft', interfaces: ['PlayerCharacter'], name: '', components: {}, relations: [] };
/** Die Sorten einer Wahl, deren Antwort Artikel-Ids hält. */
const ARTIKEL = new Set(['feat', 'spell', 'feature', 'subclass']);

/** Fertig heisst `ready` — ohne Stand gilt ein Artikel als fertig (D72). */
const fertig = (z: ListenZeile) => !z.status || z.status === 'ready';

/**
 * **Der Assistent für Figuren** (REQ-238, T-080). Die Schritte rechnet
 * `builderSteps` aus dem Entwurf: Abstammung, Hintergrund, Klasse, die
 * Attribute, je offene Wahl der gewählten Artikel ein Schritt, dann der
 * Name. Was hier steht, ist nur die Form je **Sorte** von Schritt — keine
 * Klasse, keine Wahl und kein Verfahren steht im Code. Wer eine Klasse
 * ändert oder anlegt, sieht das beim nächsten Öffnen.
 *
 * Zur Auswahl steht nur, was der Betrachter sehen darf und im Stapel liegt
 * (die Liste am Server siebt beides, T-075, T-081) **und** `ready` ist.
 *
 * Die Figur gehört dem Spieler (E-014 d): sie wird gleich `ready`
 * gespeichert, samt Statblock mit den sechs Grundwerten. Boni aus Abstammung
 * und Wahlen stehen nicht darin — sie werden beim Lesen gerechnet
 * (`chosenResult`, D8), damit eine Änderung an der Abstammung jede Figur
 * erreicht.
 *
 * Unter `/characters/:id/level-up` ist der Entwurf die gespeicherte Figur
 * mit einer Stufe mehr; dieselben Schritte, ohne was schon beantwortet ist.
 */
@Component({
  selector: 'nw-assistent',
  imports: [RouterLink],
  template: `
    <div class="buch">
      <nav aria-label="Breadcrumb" class="brot">
        <a routerLink="/world">World</a>
        <span aria-hidden="true">›</span>
        @if (aufstieg() && figur(); as f) {
          <a [routerLink]="['/artikel', f.id]">{{ f.name }}</a>
          <span aria-hidden="true">›</span>
          <span>Level up</span>
        } @else {
          <span>New character</span>
        }
      </nav>
      <h1>{{ aufstieg() ? 'Level up' : 'New character' }}</h1>

      @if (ladefehler(); as f) {
        <p class="fehler" role="alert">{{ f }}</p>
      } @else if (!bereit()) {
        <p class="dim">Loading…</p>
      } @else {
        <ol class="leiste" aria-label="Steps">
          @for (s of schritte(); track s.id; let i = $index) {
            <li>
              <button
                type="button"
                [class.jetzt]="i === index()"
                [class.erledigt]="erledigt(s)"
                [attr.aria-current]="i === index() ? 'step' : null"
                [disabled]="i > erreichbar()"
                (click)="index.set(i)"
              >
                {{ titel(s) }}
              </button>
            </li>
          }
        </ol>

        @if (schritt(); as s) {
          <section class="blatt" [attr.aria-label]="titel(s)">
            <h2>{{ titel(s) }}</h2>

            @switch (s.kind) {
              @case ('pick') {
                @if (kandidaten()[s.type]; as liste) {
                  @if (liste.length > 8) {
                    <input class="suche" type="search" placeholder="Filter…" [value]="filter()" (input)="filter.set($any($event.target).value)" />
                  }
                  <ul class="karten" role="radiogroup">
                    @for (m of gefiltert(liste); track m.wert) {
                      <li>
                        <label [class.an]="gewaehlt(s) === m.wert">
                          <input type="radio" [name]="s.id" [checked]="gewaehlt(s) === m.wert" (change)="waehle(s, m.wert)" />
                          <span class="name">{{ m.label }}</span>
                          @if (m.hinweis) {
                            <span class="dim">{{ m.hinweis }}</span>
                          }
                        </label>
                      </li>
                    } @empty {
                      <li class="dim">Nothing ready to choose here yet.</li>
                    }
                  </ul>
                } @else {
                  <p class="dim">Loading…</p>
                }
              }

              @case ('abilities') {
                <div class="verfahren" role="radiogroup" aria-label="Method">
                  @for (m of methoden(); track m.id) {
                    <label [class.an]="methode()?.id === m.id">
                      <input type="radio" name="methode" [checked]="methode()?.id === m.id" (change)="waehleMethode(m)" />
                      {{ m.name }}
                      <span class="dim">{{ beschreibe(m) }}</span>
                    </label>
                  }
                </div>
                @if (methode(); as m) {
                  @if (m.method === 'roll') {
                    @if (m.scope === 'party') {
                      <label class="zeile">
                        <span>Party</span>
                        <select [value]="gruppe()" (change)="gruppe.set($any($event.target).value)">
                          <option value=""></option>
                          @for (g of gruppen(); track g.id) {
                            <option [value]="g.id" [selected]="g.id === gruppe()">{{ g.name }}</option>
                          }
                        </select>
                      </label>
                    }
                    @if (vorrat(); as v) {
                      <p class="wurf">
                        Scores to assign: <strong>{{ v.values.join(', ') }}</strong>
                        @if (v.rolls.length) {
                          <span class="dim">— {{ v.rolls.join(' · ') }}</span>
                        }
                      </p>
                    } @else {
                      <button
                        type="button"
                        class="pri"
                        [disabled]="wuerfelt() || (m.scope === 'party' && !gruppe())"
                        (click)="wuerfeln(m)"
                      >
                        {{ m.scope === 'party' ? 'Roll for the party' : 'Roll' }} ({{ m.count }} × {{ m.dice }})
                      </button>
                    }
                  }
                  @if (m.method === 'pointBuy') {
                    <p class="wurf">
                      Points spent: <strong>{{ ausgegeben() ?? '—' }}</strong> of {{ m.budget ?? '—' }}
                    </p>
                  }
                  <table class="werte">
                    <thead>
                      <tr><th>Ability</th><th>Score</th><th>Bonus</th><th>Total</th></tr>
                    </thead>
                    <tbody>
                      @for (a of attribute(); track a) {
                        <tr>
                          <th scope="row">{{ a.toUpperCase() }}</th>
                          <td>
                            <select [attr.aria-label]="a" (change)="setzeWert(a, $any($event.target).value)">
                              <option value="" [selected]="werte()[a] === undefined">—</option>
                              @for (w of wahlwerte(); track $index) {
                                <option [value]="w" [selected]="werte()[a] === w">{{ w }}{{ vergeben(a, w) }}</option>
                              }
                            </select>
                          </td>
                          <td>{{ bonus()[a] ? '+' + bonus()[a] : '' }}</td>
                          <td>{{ werte()[a] !== undefined ? werte()[a]! + (bonus()[a] ?? 0) : '' }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                  @if (m.method !== 'pointBuy') {
                    <p class="dim">Each score is used once; picking one that is taken swaps the two.</p>
                  }
                  @if (attributsproblem(); as p) {
                    <p class="dim">{{ p }}</p>
                  }
                }
              }

              @case ('level') {
                <p>Which class gains a level?</p>
                <ul class="karten" role="radiogroup">
                  @for (k of klassenDerFigur(); track k.id) {
                    <li>
                      <label [class.an]="aufstiegKlasse() === k.id">
                        <input type="radio" name="aufstieg" [checked]="aufstiegKlasse() === k.id" (change)="steige(k.id)" />
                        <span class="name">{{ k.name }}</span>
                        <span class="dim">level {{ k.stufe }} → {{ k.stufe + 1 }}</span>
                      </label>
                    </li>
                  }
                </ul>
                @if (aufstiegKlasse()) {
                  <h3>New at level {{ neueStufe() }}</h3>
                  @if (neueMerkmale().length) {
                    <ul class="neu">
                      @for (f of neueMerkmale(); track f.id) {
                        <li>
                          <a [routerLink]="['/artikel', f.id]" target="_blank">{{ f.name }}</a>
                          @if (f.von) {
                            <span class="dim">— {{ f.von }}</span>
                          }
                        </li>
                      }
                    </ul>
                  } @else {
                    <p class="dim">No new features at this level.</p>
                  }
                  @if (schritte().length > 1) {
                    <p class="dim">Next: {{ schritte().length - 1 }} choice{{ schritte().length === 2 ? '' : 's' }} to make.</p>
                  }
                }
              }

              @case ('choice') {
                <p>{{ wahlsatz(s.at) }} <span class="dim">— from {{ s.at.source.entity.name }}</span></p>
                @if (moeglichkeiten()[s.id]; as liste) {
                  @if (liste.length) {
                    @if (liste.length > 8) {
                      <input class="suche" type="search" placeholder="Filter…" [value]="filter()" (input)="filter.set($any($event.target).value)" />
                    }
                    <p class="dim">{{ antwort(s).length }} of {{ s.at.choice.count ?? 1 }} chosen</p>
                    <ul class="karten">
                      @for (m of gefiltert(liste); track m.wert) {
                        <li>
                          <label [class.an]="antwort(s).includes(m.wert)">
                            <input
                              [type]="(s.at.choice.count ?? 1) > 1 ? 'checkbox' : 'radio'"
                              [name]="s.id"
                              [checked]="antwort(s).includes(m.wert)"
                              [disabled]="!antwort(s).includes(m.wert) && (s.at.choice.count ?? 1) > 1 && antwort(s).length >= (s.at.choice.count ?? 1)"
                              (change)="kreuze(s, m.wert)"
                            />
                            <span class="name">{{ m.label }}</span>
                            @if (m.hinweis) {
                              <span class="dim">{{ m.hinweis }}</span>
                            }
                          </label>
                        </li>
                      }
                    </ul>
                  } @else {
                    <!-- Eine freie Wahl: die Notiz sagt, was gemeint ist. -->
                    <label class="zeile">
                      <span>Your choice</span>
                      <input
                        type="text"
                        [value]="antwort(s).join(', ')"
                        (change)="frei(s, $any($event.target).value)"
                        placeholder="Separate several with commas"
                      />
                    </label>
                  }
                } @else {
                  <p class="dim">Loading…</p>
                }
              }

              @case ('equipment') {
                <div class="verfahren" role="radiogroup" aria-label="Equipment method">
                  @for (m of ausrMethoden(); track m.id) {
                    <label [class.an]="ausrMethode()?.id === m.id">
                      <input type="radio" name="ausr" [checked]="ausrMethode()?.id === m.id" (change)="waehleAusr(m)" />
                      {{ m.name }}
                      <span class="dim">{{ beschreibeAusr(m) }}</span>
                    </label>
                  }
                </div>
                @if (ausrMethode(); as m) {
                  @if (m.method === 'rules') {
                    @for (c of s.choices; track c.source.entity.id + '#' + c.choice.id) {
                      <p>{{ c.choice.note ?? 'Choose' }} <span class="dim">— from {{ c.source.entity.name }}</span></p>
                      <ul class="karten" role="radiogroup">
                        @for (o of c.choice.from?.options ?? []; track o.key) {
                          <li>
                            <label [class.an]="(c.picks ?? []).includes(o.key)">
                              <input
                                type="radio"
                                [name]="'eq-' + c.source.entity.id + '-' + c.choice.id"
                                [checked]="(c.picks ?? []).includes(o.key)"
                                (change)="waehleVariante(c, o.key)"
                              />
                              <span class="name">({{ o.key }})</span>
                              {{ klartext(o.label) }}
                            </label>
                          </li>
                        }
                      </ul>
                    }
                    @if (festes().length) {
                      <p>Also: {{ festes().join('; ') }}</p>
                    }
                    @if (!s.choices.length && !festes().length) {
                      <p class="dim">Class and background name no equipment.</p>
                    }
                  } @else {
                    @if (m.method === 'gold' && goldAusdruck() && goldFest() === undefined) {
                      @if (goldWurf(); as w) {
                        <p class="wurf">Rolled <strong>{{ w.gp }} gp</strong> <span class="dim">— {{ goldAusdruck() }}: {{ w.roll }}</span></p>
                      } @else {
                        <button type="button" class="pri" [disabled]="wuerfelt()" (click)="wuerfleGold(m)">Roll starting gold ({{ goldAusdruck() }})</button>
                      }
                    }
                    @if (m.method === 'gold' && !goldAusdruck()) {
                      <p class="dim">This class names no starting gold.</p>
                    }
                    @if (budget() !== null || m.method === 'free') {
                      <p class="wurf">
                        @if (budget() !== null) {
                          Budget <strong>{{ geld(budget()!) }}</strong> · spent {{ geld(pruefung().spent) }} · left
                          <strong>{{ geld(budget()! - pruefung().spent) }}</strong>
                        } @else {
                          No budget limit · spent {{ geld(pruefung().spent) }}
                        }
                      </p>
                      @if (grenzen(m); as g) {
                        <p class="dim">{{ g }}</p>
                      }
                      <input class="suche" type="search" placeholder="Search items…" [value]="ladenSuche()" (input)="sucheImLaden($any($event.target).value)" />
                      <ul class="laden" aria-label="Items">
                        @for (it of ladenTreffer(); track it.id) {
                          <li>
                            <span class="name">{{ nameVon(it) }}</span>
                            <span class="dim">{{ preis(it) }}{{ selten(it) }}</span>
                            <button type="button" (click)="kaufe(it.id, 1)" [attr.aria-label]="'Add ' + nameVon(it)">Add</button>
                          </li>
                        } @empty {
                          @if (ladenSuche().trim()) {
                            <li class="dim">Nothing ready matches.</li>
                          }
                        }
                      </ul>
                      @if (korb().length) {
                        <h3>Your equipment</h3>
                        <ul class="laden korb">
                          @for (k of korb(); track k.id) {
                            <li>
                              <span class="name">{{ nameVon(ladenArtikel().get(k.id)) }}</span>
                              <span class="dim">× {{ k.qty }}</span>
                              <button type="button" (click)="kaufe(k.id, -1)" [attr.aria-label]="'One fewer'">−</button>
                              <button type="button" (click)="kaufe(k.id, 1)" [attr.aria-label]="'One more'">+</button>
                            </li>
                          }
                        </ul>
                      }
                      @if (pruefung().problem; as p) {
                        <p class="fehler">{{ p }}</p>
                      }
                    }
                  }
                }
              }

              @case ('details') {
                <label class="zeile">
                  <span>Name <i class="pflicht" title="required">*</i></span>
                  <input type="text" [value]="name()" (input)="name.set($any($event.target).value)" />
                </label>
                @if (gruppen().length) {
                  <label class="zeile">
                    <span>Party</span>
                    <select [value]="gruppe()" (change)="gruppe.set($any($event.target).value)">
                      <option value="">— none —</option>
                      @for (g of gruppen(); track g.id) {
                        <option [value]="g.id" [selected]="g.id === gruppe()">{{ g.name }}</option>
                      }
                    </select>
                  </label>
                }
                <p class="dim">Image, backstory and the rest follow on the character's page.</p>
                @if (offenGelassen().length) {
                  <p class="dim">Left for later: {{ offenGelassen().join('; ') }}</p>
                }
              }
            }

            @if (problem(); as f) {
              <p class="fehler" role="alert">{{ f }}</p>
            }
            <div class="knoepfe">
              <button type="button" [disabled]="index() === 0" (click)="zurueck()">Back</button>
              @if (s.kind === 'choice') {
                <button type="button" (click)="spaeter(s)">Decide later</button>
              }
              @if (letzter()) {
                <button type="button" class="pri" [disabled]="!fertigSchritt(s) || speichert()" (click)="speichern()">
                  {{ speichert() ? 'Saving…' : aufstieg() ? 'Level up' : 'Create character' }}
                </button>
              } @else {
                <button type="button" class="pri" [disabled]="!fertigSchritt(s)" (click)="weiter()">Next</button>
              }
            </div>
          </section>
        }
      }
    </div>
  `,
  styles: `
    .buch {
      max-width: 960px;
      margin: 0 auto;
      padding: 1.25rem 1.5rem 3rem;
    }
    .brot {
      display: flex;
      gap: 0.5rem;
      color: var(--dim);
      font-size: 0.9rem;
      flex-wrap: wrap;
    }
    h1 {
      margin: 0.5rem 0 0.75rem;
      font-family: var(--caps);
      font-size: 2.5rem;
      color: var(--heading);
    }
    h2 {
      margin: 0 0 0.75rem;
      font-family: var(--caps);
      font-size: 1.4rem;
      color: var(--heading);
    }
    .leiste {
      list-style: none;
      margin: 0 0 1rem;
      padding: 0;
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
    }
    .leiste button {
      min-height: 36px;
      padding: 0 0.7rem;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--surface);
      color: var(--ink);
      font-size: 0.9rem;
    }
    .leiste button.erledigt {
      border-color: var(--gold);
    }
    .leiste button.jetzt {
      background: var(--accent);
      border-color: var(--accent);
      color: var(--paper);
    }
    .leiste button:disabled {
      opacity: 0.5;
    }
    .blatt {
      background: var(--paper);
      border-top: 3px solid var(--gold);
      border-radius: 0 0 8px 8px;
      box-shadow: 0 1px 4px rgba(43, 29, 18, 0.2);
      padding: 1rem 1.2rem;
    }
    .karten {
      list-style: none;
      margin: 0.5rem 0;
      padding: 0;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
      gap: 0.5rem;
    }
    .karten label,
    .verfahren label {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0.4rem;
      min-height: 44px;
      padding: 0.55rem 0.75rem;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--surface);
      cursor: pointer;
    }
    .karten label.an,
    .verfahren label.an {
      border-color: var(--accent);
      background: var(--hover);
    }
    .name {
      font-weight: 700;
      color: var(--heading);
    }
    .verfahren {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      margin-bottom: 0.75rem;
    }
    .zeile {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
      margin: 0.5rem 0;
      max-width: 28rem;
    }
    .zeile > span {
      font-weight: 700;
      color: var(--heading);
    }
    input[type='text'],
    input[type='search'],
    select {
      min-height: 40px;
      padding: 0 0.5rem;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--surface);
      color: var(--ink);
    }
    .suche {
      width: min(100%, 20rem);
    }
    .werte {
      border-collapse: collapse;
      margin: 0.5rem 0;
    }
    .werte th,
    .werte td {
      padding: 0.3rem 0.6rem;
      text-align: left;
      border-bottom: 1px solid var(--line);
    }
    .werte select {
      min-width: 5rem;
    }
    .wurf {
      margin: 0.5rem 0;
    }
    h3 {
      margin: 1rem 0 0.4rem;
      font-family: var(--caps);
      font-size: 1.1rem;
      color: var(--heading);
    }
    .laden {
      list-style: none;
      margin: 0.5rem 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
    }
    .laden li {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
      min-height: 44px;
      padding: 0.3rem 0.6rem;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--surface);
    }
    .laden li .name {
      flex: 1 1 10rem;
    }
    .laden button {
      min-height: 36px;
      min-width: 44px;
    }
    .neu {
      margin: 0.25rem 0 0.5rem;
      padding-left: 1.2rem;
    }
    .neu li {
      margin: 0.2rem 0;
    }
    .knoepfe {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 0.5rem;
      margin-top: 1rem;
    }
    .knoepfe button,
    button.pri {
      min-height: 44px;
      padding: 0 1rem;
    }
    .pflicht {
      color: var(--accent);
      font-style: normal;
    }
    .dim {
      color: var(--dim);
      font-size: 0.9rem;
    }
    .fehler {
      color: var(--warn);
    }
    @media (max-width: 560px) {
      .buch {
        padding: 1rem;
      }
      h1 {
        font-size: 2rem;
      }
      .blatt {
        padding: 0.8rem;
      }
      .karten {
        grid-template-columns: 1fr;
      }
      .werte {
        width: 100%;
      }
    }
  `,
})
export class Assistent {
  private readonly api = inject(Api);
  private readonly bestand = inject(Bestand);
  private readonly session = inject(Session);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** Die Figur beim Stufenaufstieg, so wie sie gespeichert ist. */
  protected readonly figur = signal<Entity | null>(null);
  protected readonly aufstieg = computed(() => !!this.route.snapshot.paramMap.get('id'));
  protected readonly entwurf = signal<Entity>(LEER);
  /** Die Artikel, die der Entwurf nennt, ganz — daraus kommen die Wahlen. */
  private readonly quellen = signal<ReadonlyMap<string, Entity>>(new Map());
  private readonly gefragt = new Set<string>();
  protected readonly index = signal(0);
  protected readonly filter = signal('');
  protected readonly problem = signal<string | null>(null);
  protected readonly ladefehler = signal<string | null>(null);
  protected readonly speichert = signal(false);
  protected readonly wuerfelt = signal(false);
  protected readonly name = signal('');
  /** Welche Wahlen jemand ausdrücklich auf später gelegt hat. */
  private readonly spaeterGelegt = signal<ReadonlySet<string>>(new Set());

  protected readonly kandidaten = signal<Partial<Record<string, Moeglichkeit[]>>>({});
  protected readonly moeglichkeiten = signal<Partial<Record<string, Moeglichkeit[]>>>({});

  protected readonly methoden = signal<AbilityMethod[]>([]);
  protected readonly gruppen = signal<Gruppe[]>([]);
  protected readonly methode = signal<AbilityMethod | null>(null);
  protected readonly gruppe = signal('');
  protected readonly eigenerWurf = signal<RolledScores | null>(null);
  protected readonly werte = signal<Partial<Record<string, number>>>({});
  /** Die Sprachen der Kampagne (REQ-251); leer heisst jede. */
  private readonly sprachen = signal<string[]>([]);
  private readonly geladenVerfahren = signal(false);

  /** Die Startausrüstung (T-096): Verfahren, Wurf, Einkauf. */
  protected readonly ausrMethoden = signal<EquipmentMethod[]>([]);
  protected readonly ausrMethode = signal<EquipmentMethod | null>(null);
  protected readonly goldWurf = signal<(GoldRoll & { event: string }) | null>(null);
  protected readonly korb = signal<Purchase[]>([]);
  protected readonly ladenSuche = signal('');
  protected readonly ladenTreffer = signal<Entity[]>([]);
  /** Jeder Gegenstand, der im Laden einmal gezeigt wurde — gegen ihn rechnet `checkPurchase`. */
  protected readonly ladenArtikel = signal<ReadonlyMap<string, Entity>>(new Map());
  /** Die schon angelegte Figur, falls die Ausrüstung danach scheiterte. */
  private readonly angelegt = signal<string | null>(null);
  private ladenLauf = 0;

  protected readonly startKlasse = computed(() => this.quellen().get(startClassOf(this.entwurf()) ?? ''));
  protected readonly goldAusdruck = computed(() => {
    const m = this.ausrMethode();
    return m?.method === 'gold' ? (m.gold ?? startingGoldOf(this.startKlasse())) : undefined;
  });
  protected readonly goldFest = computed(() => fixedGold(this.goldAusdruck()));
  /** Das Geld in Kupfer; `null` heisst ohne Grenze oder noch nicht gewürfelt. */
  protected readonly budget = computed<number | null>(() => {
    const m = this.ausrMethode();
    if (!m || m.method === 'rules') return null;
    if (m.method === 'free') return m.budget !== undefined ? Math.round(m.budget * 100) : null;
    const fest = this.goldFest();
    if (fest !== undefined) return Math.round(fest * 100);
    const w = this.goldWurf();
    return w ? Math.round(w.gp * 100) : null;
  });
  protected readonly pruefung = computed(() => {
    const m = this.ausrMethode();
    if (!m) return { problem: 'Choose a method.', spent: 0, magic: {} };
    return checkPurchase(this.korb(), this.ladenArtikel(), m, this.budget() ?? undefined);
  });
  protected readonly festes = computed(() => fixedEquipmentLines(this.entwurf(), this.quellen()).map((z) => z.text));

  protected readonly bereit = computed(
    () => !!this.bestand.registry() && this.geladenVerfahren() && (!this.aufstieg() || !!this.figur()),
  );

  /** Was die gespeicherte Figur schon beantwortet hat: beim Aufstieg kein Schritt mehr. */
  private readonly beantwortet = computed(() => {
    const f = this.figur();
    if (!f) return new Set<string>();
    return new Set(answersOf(f).map((a) => `${a.source}#${a.choice}`));
  });

  protected readonly schritte = computed<BuilderStep[]>(() =>
    builderSteps(this.entwurf(), this.quellen(), { levelUp: this.aufstieg(), done: this.beantwortet() }),
  );
  protected readonly schritt = computed(() => this.schritte()[Math.min(this.index(), this.schritte().length - 1)]);
  protected readonly letzter = computed(() => this.index() >= this.schritte().length - 1);
  /** Bis wohin man springen darf: bis zum ersten Schritt, der noch fehlt. */
  protected readonly erreichbar = computed(() => {
    const l = this.schritte();
    const i = l.findIndex((s) => !this.fertigSchritt(s));
    return i < 0 ? l.length - 1 : i;
  });

  protected readonly attribute = computed(
    () => enumOptions(this.bestand.registry() ?? { enums: {}, interfaces: {} }, { enumRef: 'Ability' }) ?? [],
  );
  protected readonly bonus = computed<Partial<Record<string, number>>>(() => chosenResult(this.entwurf(), this.quellen()).abilityBonus);

  /** Die Werte, die zu verteilen sind: die feste Reihe, der eigene Wurf, der Pool der Gruppe. */
  protected readonly vorrat = computed<(RolledScores & { at?: string }) | null>(() => {
    const m = this.methode();
    if (!m || m.method !== 'roll') return null;
    if (m.scope === 'party') return this.gruppen().find((g) => g.id === this.gruppe())?.pools[m.id] ?? null;
    return this.eigenerWurf();
  });
  protected readonly wahlwerte = computed<number[]>(() => {
    const m = this.methode();
    if (!m) return [];
    if (m.method === 'array') return [...new Set(m.scores ?? [])].sort((a, z) => z - a);
    if (m.method === 'pointBuy') return pointBuyRange(m);
    return [...new Set(this.vorrat()?.values ?? [])].sort((a, z) => z - a);
  });
  protected readonly ausgegeben = computed(() => {
    const m = this.methode();
    const w = this.attribute().map((a) => this.werte()[a]);
    if (!m || w.some((x) => x === undefined)) return null;
    return pointBuySpent(w as number[], m);
  });
  protected readonly attributsproblem = computed(() => {
    const m = this.methode();
    if (!m) return 'Choose a method.';
    return assignmentProblem(this.werte(), this.attribute(), m, this.vorrat()?.values);
  });

  protected readonly klassenDerFigur = computed(() => {
    const f = this.figur();
    return (f?.relations ?? [])
      .filter((r) => r.type === 'hasClass')
      .map((r) => ({ id: r.to, name: this.quellen().get(r.to)?.name ?? r.to, stufe: Number(r.props?.['level']) || 1 }));
  });
  protected readonly aufstiegKlasse = signal('');
  protected readonly neueStufe = computed(
    () => Number(this.entwurf().relations?.find((r) => r.type === 'hasClass' && r.to === this.aufstiegKlasse())?.props?.['level']) || 1,
  );
  /** Was die neue Stufe bringt (T-095): die Merkmale von Klasse und Unterklasse genau auf ihr. */
  protected readonly neueMerkmale = computed(() => {
    const q = this.quellen();
    const k = this.aufstiegKlasse();
    if (!k) return [];
    return gainedFeatures(this.entwurf(), q, k).map((f) => ({
      id: f.id,
      name: q.get(f.id)?.name ?? this.bestand.name()(f.id) ?? f.id,
      von: f.source === k ? '' : (q.get(f.source)?.name ?? ''),
    }));
  });

  /** Was beim Speichern noch offen bleibt — es bleibt an der Figur offen (`pendingChoices`). */
  protected readonly offenGelassen = computed(() =>
    this.schritte()
      .filter((s): s is Extract<BuilderStep, { kind: 'choice' }> => s.kind === 'choice' && !s.at.picks)
      .map((s) => `${s.at.source.entity.name}: ${choiceText(s.at.choice)}`),
  );

  constructor() {
    void this.bestand.load();
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.api
        .entity(id)
        .then((e) => {
          const { refs: _r, ...f } = e as Entity & { refs?: unknown };
          this.figur.set(f);
          this.entwurf.set(f);
          this.name.set(f.name ?? '');
        })
        .catch((e: Error) => this.ladefehler.set(e.message));
    }
    this.api
      .abilities()
      .then((r) => {
        this.methoden.set(r.methods);
        this.gruppen.set(r.parties);
        this.sprachen.set(r.languages ?? []);
        if (r.methods.length === 1) this.methode.set(r.methods[0]!);
        if (r.parties.length === 1) this.gruppe.set(r.parties[0]!.id);
      })
      .catch((e: Error) => this.ladefehler.set(e.message))
      .finally(() => this.geladenVerfahren.set(true));
    /* Beim Aufstieg gibt es keine Startausrüstung. */
    if (!id) {
      this.api
        .equipmentMethods()
        .then((r) => {
          this.ausrMethoden.set(r.methods);
          if (r.methods.length === 1) this.ausrMethode.set(r.methods[0]!);
        })
        .catch((e: Error) => this.ladefehler.set(e.message));
    }

    /* **Was der Entwurf nennt, kommt ganz** — und was eine Quelle gewährt
       (`grants`), denn auch ein Merkmal kann fragen (Fighting Style). */
    effect(() => {
      const e = this.entwurf();
      const q = this.quellen();
      const ids = new Set<string>();
      for (const r of e.relations ?? []) {
        if (['hasAncestry', 'hasBackground', 'hasClass', 'chose'].includes(r.type)) ids.add(r.to);
        if (r.type === 'hasClass' && typeof r.props?.['subclass'] === 'string') ids.add(r.props['subclass']);
      }
      for (const c of choicesAtCharacter(e, q)) {
        if (ARTIKEL.has(String(c.choice.kind)) || c.choice.from?.interfaces?.length) for (const p of c.picks ?? []) ids.add(p);
      }
      for (const x of q.values()) for (const r of x.relations ?? []) if (r.type === 'grants') ids.add(r.to);
      const fehlt = [...ids].filter((i) => !q.has(i) && !this.gefragt.has(i));
      if (!fehlt.length) return;
      for (const i of fehlt) this.gefragt.add(i);
      untracked(() => void this.lade(fehlt));
    });

    /* Die Möglichkeiten des Schritts, der gerade dran ist. */
    effect(() => {
      const s = this.schritt();
      if (!s) return;
      untracked(() => {
        this.filter.set('');
        this.problem.set(null);
        if (s.kind === 'pick') void this.ladeKandidaten(s.type);
        if (s.kind === 'choice') void this.ladeMoeglichkeiten(s);
      });
    });
  }

  private async lade(ids: string[]): Promise<void> {
    for (let i = 0; i < ids.length; i += 200) {
      try {
        const neu = await this.api.entitiesById(ids.slice(i, i + 200));
        this.quellen.update((q) => {
          const m = new Map(q);
          for (const e of neu) m.set(e.id, e);
          return m;
        });
      } catch {
        /* Was nicht kommt, darf dieser Betrachter nicht sehen. */
      }
    }
  }

  private async zeilen(arten: string[], rel?: string): Promise<ListenZeile[]> {
    const r = await this.api.list({ of: arten, limit: 500, sort: 'name', ...(rel ? { rel: [rel] } : {}) });
    return r.rows.filter(fertig);
  }

  private async ladeKandidaten(typ: string): Promise<void> {
    if (this.kandidaten()[typ]) return;
    try {
      const rows = await this.zeilen([typ]);
      this.kandidaten.update((k) => ({ ...k, [typ]: rows.map((z) => ({ wert: z.id, label: z.name, hinweis: z.source.split(' p. ')[0] ?? '' })) }));
    } catch (e) {
      this.problem.set((e as Error).message);
    }
  }

  /** Woraus eine Wahl wählt — eine der drei Formen von `from` (C6). */
  private async ladeMoeglichkeiten(s: Extract<BuilderStep, { kind: 'choice' }>): Promise<void> {
    if (this.moeglichkeiten()[s.id]) return;
    const f = s.at.choice.from ?? {};
    let liste: Moeglichkeit[] = [];
    try {
      if (f.options?.length) liste = f.options.map((o) => ({ wert: o.key, label: `(${o.key}) ${o.label}` }));
      else if (f.values?.length) liste = f.values.map((v) => ({ wert: v, label: v }));
      else if (f.interfaces?.length) {
        let rows = await this.zeilen(f.interfaces, f.edge?.type);
        if (f.edge) rows = rows.filter((z) => z.rels?.[f.edge!.type]?.includes(f.edge!.to));
        /* Die Marken schlagen vor (wie `LinkTarget.tags`): finden sie nichts, gilt die ganze Art. */
        const markiert = f.tags?.length ? rows.filter((z) => z.tags?.some((t) => f.tags!.includes(t))) : rows;
        liste = this.nurSprachenDerKampagne(f.interfaces, markiert.length ? markiert : rows).map((z) => ({
          wert: z.id,
          label: z.name,
          hinweis: z.source.split(' p. ')[0] ?? '',
        }));
      } else if (f.enumRef?.length) {
        const reg = this.bestand.registry();
        const arten = f.enumRef.filter((r) => !!reg?.interfaces[r]);
        const namen = arten.length ? this.nurSprachenDerKampagne(arten, await this.zeilen(arten)).map((z) => z.name) : [];
        const zeilen = reg ? (enumOptions(reg, { enumRef: f.enumRef.filter((r) => !arten.includes(r)) }) ?? []) : [];
        liste = [...new Set([...zeilen, ...namen])].sort((a, z) => a.localeCompare(z, 'en')).map((v) => ({ wert: v, label: v }));
      }
      if (s.at.choice.kind === 'ability') {
        const b = s.at.choice.bonus ?? [1];
        liste = liste.map((m) => ({ ...m, label: m.label.toUpperCase(), hinweis: `+${b.join('/+')}` }));
      }
    } catch (e) {
      this.problem.set((e as Error).message);
    }
    this.moeglichkeiten.update((m) => ({ ...m, [s.id]: liste }));
  }

  /**
   * **Die Sprachen der Kampagne** (REQ-251): zieht eine Wahl aus den
   * `Language`-Artikeln und nennt die Kampagne Sprachen, stehen nur diese
   * zur Wahl. Andere Arten derselben Wahl bleiben, wie sie sind.
   */
  private nurSprachenDerKampagne(arten: string[], rows: ListenZeile[]): ListenZeile[] {
    const erlaubt = new Set(this.sprachen().map((n) => n.toLowerCase()));
    if (!erlaubt.size || !arten.includes('Language')) return rows;
    return rows.filter((z) => z.type !== 'Language' || erlaubt.has(z.name.toLowerCase()));
  }

  protected titel(s: BuilderStep): string {
    switch (s.kind) {
      case 'pick':
        return s.type;
      case 'abilities':
        return 'Ability scores';
      case 'level':
        return 'Level';
      case 'details':
        return 'Name';
      case 'equipment':
        return 'Equipment';
      case 'choice': {
        const c = s.at.choice;
        return c.note && c.note.length < 40 ? c.note : `${s.at.source.entity.name}: ${c.kind}`;
      }
    }
  }

  protected wahlsatz(c: ChoiceAtCharacter): string {
    return choiceText(c.choice);
  }

  protected beschreibe(m: AbilityMethod): string {
    if (m.method === 'array') return (m.scores ?? []).join(', ');
    if (m.method === 'pointBuy') return `${m.budget ?? '?'} points`;
    return `${m.count} × ${m.dice ?? '?'}${m.scope === 'party' ? ', once for the party' : ''}`;
  }

  protected gefiltert(liste: Moeglichkeit[]): Moeglichkeit[] {
    const q = this.filter().trim().toLowerCase();
    return q ? liste.filter((m) => m.label.toLowerCase().includes(q)) : liste;
  }

  protected gewaehlt(s: Extract<BuilderStep, { kind: 'pick' }>): string | undefined {
    return this.entwurf().relations?.find((r) => r.type === s.edge)?.to;
  }

  protected waehle(s: Extract<BuilderStep, { kind: 'pick' }>, id: string): void {
    this.entwurf.update((e) => pruneAnswers(setPick(e, s.edge, id), this.quellen()));
  }

  protected antwort(s: Extract<BuilderStep, { kind: 'choice' }>): string[] {
    return s.at.picks ?? [];
  }

  protected kreuze(s: Extract<BuilderStep, { kind: 'choice' }>, wert: string): void {
    const n = s.at.choice.count ?? 1;
    const jetzt = this.antwort(s);
    const neu = n === 1 ? [wert] : jetzt.includes(wert) ? jetzt.filter((w) => w !== wert) : [...jetzt, wert].slice(0, n);
    this.beantworte(s, neu);
  }

  protected frei(s: Extract<BuilderStep, { kind: 'choice' }>, text: string): void {
    this.beantworte(s, text.split(',').map((t) => t.trim()).filter(Boolean));
  }

  private beantworte(s: Extract<BuilderStep, { kind: 'choice' }>, picks: string[]): void {
    this.spaeterGelegt.update((l) => {
      const m = new Set(l);
      m.delete(choiceKey(s.at));
      return m;
    });
    this.entwurf.update((e) => pruneAnswers(answerChoice(e, s.at, picks), this.quellen()));
  }

  protected spaeter(s: Extract<BuilderStep, { kind: 'choice' }>): void {
    this.beantworte(s, []);
    this.spaeterGelegt.update((l) => new Set([...l, choiceKey(s.at)]));
    this.weiter();
  }

  protected waehleMethode(m: AbilityMethod): void {
    this.methode.set(m);
    /* Der Punktekauf beginnt bei seinem kleinsten Wert, alles andere leer. */
    const tief = m.method === 'pointBuy' ? pointBuyRange(m)[0] : undefined;
    this.werte.set(Object.fromEntries(this.attribute().map((a) => [a, tief])));
  }

  /**
   * Einen Wert setzen — bei Reihe und Pool **tauschend** (T-095): jeder
   * Wert ist genau einmal zu vergeben, und wer einen vergebenen wählt,
   * gibt dem anderen Attribut seinen bisherigen.
   */
  protected setzeWert(a: string, roh: string): void {
    const m = this.methode();
    const wert = roh === '' ? undefined : Number(roh);
    if (!m) return;
    this.werte.update((w) => assignScore(w, this.attribute(), a, wert, m, this.vorrat()?.values));
  }

  /** Wer einen Wert schon hält — die Auswahl sagt es, damit der Tausch keine Überraschung ist. */
  protected vergeben(a: string, w: number): string {
    if (this.methode()?.method === 'pointBuy') return '';
    const bei = this.attribute().filter((x) => x !== a && this.werte()[x] === w);
    return bei.length ? ` (${bei.map((x) => x.toUpperCase()).join(', ')})` : '';
  }

  protected async wuerfeln(m: AbilityMethod): Promise<void> {
    this.wuerfelt.set(true);
    this.problem.set(null);
    try {
      const r = await this.api.rollAbilities(m.id, m.scope === 'party' ? this.gruppe() : undefined);
      if (m.scope === 'party') {
        this.gruppen.update((l) => l.map((g) => (g.id === this.gruppe() ? { ...g, pools: { ...g.pools, [m.id]: r } } : g)));
      } else this.eigenerWurf.set(r);
    } catch (e) {
      /* Schon gewürfelt (409): der Pool, den die Gruppe hat, gilt. */
      const pool = (e as ApiError).body as { pool?: RolledScores } | undefined;
      if (e instanceof ApiError && e.status === 409 && pool?.pool) {
        this.gruppen.update((l) => l.map((g) => (g.id === this.gruppe() ? { ...g, pools: { ...g.pools, [m.id]: pool.pool! } } : g)));
      } else this.problem.set((e as Error).message);
    } finally {
      this.wuerfelt.set(false);
    }
  }

  protected steige(klasse: string): void {
    const f = this.figur();
    if (!f) return;
    this.aufstiegKlasse.set(klasse);
    const jetzt = Number(f.relations?.find((r) => r.type === 'hasClass' && r.to === klasse)?.props?.['level']) || 1;
    this.entwurf.set(setClassLevel(f, klasse, jetzt + 1));
  }

  protected erledigt(s: BuilderStep): boolean {
    return this.fertigSchritt(s) && s.id !== this.schritt()?.id;
  }

  protected fertigSchritt(s: BuilderStep): boolean {
    switch (s.kind) {
      case 'pick':
        return !!this.entwurf().relations?.some((r) => r.type === s.edge);
      case 'abilities':
        return !this.attributsproblem();
      case 'level':
        return !!this.aufstiegKlasse();
      case 'details':
        return !!this.name().trim();
      case 'equipment': {
        const m = this.ausrMethode();
        if (!m) return false;
        if (m.method === 'rules') return s.choices.every((c) => !!c.picks?.length);
        if (m.method === 'gold' && this.budget() === null) return false;
        return !this.pruefung().problem;
      }
      case 'choice':
        return (s.at.picks?.length ?? 0) >= (s.at.choice.count ?? 1) || this.spaeterGelegt().has(choiceKey(s.at)) || (!!s.at.picks?.length && !s.at.choice.from);
    }
  }

  protected weiter(): void {
    this.index.update((i) => Math.min(i + 1, this.schritte().length - 1));
  }

  protected zurueck(): void {
    this.index.update((i) => Math.max(0, i - 1));
  }

  // ---------------------------------------------------------- Startausrüstung (T-096)

  protected beschreibeAusr(m: EquipmentMethod): string {
    if (m.method === 'rules') return 'what your class and background give';
    if (m.method === 'gold') return m.gold ? `${m.gold} gp to buy your own` : "your class's starting gold to buy your own";
    return m.budget !== undefined ? `${m.budget} gp, your own choice` : 'your own choice';
  }

  /** Was das Verfahren begrenzt, als Satz. */
  protected grenzen(m: EquipmentMethod): string {
    const teile: string[] = [];
    if (m.magic) {
      const l = Object.entries(m.magic).filter(([, n]) => n > 0);
      teile.push(l.length ? `Magic items: at most ${l.map(([r, n]) => `${n} ${r}`).join(', ')}` : 'No magic items');
    }
    if (m.itemTypes?.length) teile.push(`Only: ${m.itemTypes.join(', ')}`);
    return teile.join(' · ');
  }

  protected waehleAusr(m: EquipmentMethod): void {
    this.ausrMethode.set(m);
    this.korb.set([]);
    this.goldWurf.set(null);
  }

  protected waehleVariante(c: ChoiceAtCharacter, key: string): void {
    this.entwurf.update((e) => pruneAnswers(answerChoice(e, c, [key]), this.quellen()));
  }

  protected klartext(label: string): string {
    return plainEquipmentText(label);
  }

  protected nameVon(e: Entity | undefined): string {
    return entityName(e);
  }

  protected geld(cp: number): string {
    return formatCopper(cp);
  }

  protected preis(it: Entity): string {
    const p = itemPrice(it);
    return p === undefined ? 'no price' : formatCopper(p);
  }

  protected selten(it: Entity): string {
    const r = magicRarity(it);
    return r ? ` · ${r}` : '';
  }

  protected async wuerfleGold(m: EquipmentMethod): Promise<void> {
    this.wuerfelt.set(true);
    this.problem.set(null);
    try {
      this.goldWurf.set(await this.api.rollGold(m.id, startClassOf(this.entwurf())));
    } catch (e) {
      this.problem.set((e as Error).message);
    } finally {
      this.wuerfelt.set(false);
    }
  }

  /**
   * **Im Laden suchen**: die Liste am Server (gesiebt, im Stapel), nur
   * fertige Gegenstände, dann die Treffer ganz — Preis und Seltenheit
   * stehen nicht in der Zeile.
   */
  protected async sucheImLaden(q: string): Promise<void> {
    this.ladenSuche.set(q);
    const lauf = ++this.ladenLauf;
    if (!q.trim()) {
      this.ladenTreffer.set([]);
      return;
    }
    const typen = this.ausrMethode()?.itemTypes;
    try {
      const r = await this.api.list({ of: ['Item'], q, limit: 30, sort: 'name', ...(typen?.length ? { f: [`Item.itemType:${typen.join('|')}`] } : {}) });
      const ids = r.rows.filter(fertig).map((z) => z.id);
      const ganz = ids.length ? await this.api.entitiesById(ids) : [];
      if (lauf !== this.ladenLauf) return;
      this.ladenTreffer.set(ganz);
      this.ladenArtikel.update((m) => {
        const neu = new Map(m);
        for (const e of ganz) neu.set(e.id, e);
        return neu;
      });
    } catch (e) {
      this.problem.set((e as Error).message);
    }
  }

  protected kaufe(id: string, n: number): void {
    this.korb.update((l) => {
      const da = l.find((k) => k.id === id);
      if (!da) return n > 0 ? [...l, { id, qty: n }] : l;
      const qty = da.qty + n;
      return qty > 0 ? l.map((k) => (k.id === id ? { ...k, qty } : k)) : l.filter((k) => k.id !== id);
    });
  }

  protected async speichern(): Promise<void> {
    if (this.speichert()) return;
    this.speichert.set(true);
    this.problem.set(null);
    try {
      const e = this.entwurf();
      if (this.aufstieg()) {
        const { updatedAt: _u, ...rest } = e as Entity & { updatedAt?: unknown };
        await this.api.putEntity(rest);
        /* Neu holen: die Seite der Figur läse sonst den Stand von vor dem
           Aufstieg aus dem Bestand und zeigte die alte Stufe (T-095). */
        await this.bestand.oeffnen(e.id, true);
        await this.router.navigate(['/artikel', e.id]);
        return;
      }
      const name = this.name().trim();
      /* Scheiterte beim letzten Mal nur die Ausrüstung, steht die Figur schon. */
      let figurId = this.angelegt();
      if (!figurId) {
        const kanten = (e.relations ?? []).map((r) => ({ type: r.type, to: r.to, props: r.props ?? {} }));
        if (this.gruppe()) kanten.push({ type: 'memberOfParty', to: this.gruppe(), props: {} });
        /* Die Figur gehört dem Spieler (E-014 d): gleich fertig. */
        const figur = await this.api.createEntity('PlayerCharacter', name, { 'Status.status': 'ready' }, kanten);
        const werte = Object.fromEntries(this.attribute().map((a) => [`Abilities.${a}`, this.werte()[a]]));
        await this.api.createEntity('Statblock', name, { ...werte, 'Status.status': 'ready' }, [{ type: 'belongsTo', to: figur.id }]);
        figurId = figur.id;
        this.angelegt.set(figurId);
        /* Was sie angelegt hat, schreibt sie — das weiss erst ein neues `/api/me`. */
        await this.session.load(true);
      }
      /* Die Startausrüstung prüft und schreibt der Server (T-096). */
      const m = this.ausrMethode();
      if (m) await this.api.applyEquipment(figurId, m.id, m.method === 'rules' ? [] : this.korb(), this.goldWurf()?.event);
      await this.router.navigate(['/artikel', figurId], { queryParams: { edit: 1 } });
    } catch (error) {
      if (error instanceof ApiError) {
        const issues = Array.isArray(error.issues)
          ? (error.issues as { message?: string }[]).map((i) => i.message).filter(Boolean)
          : [];
        const vorab = this.angelegt() ? 'The character is saved, but not its equipment: ' : '';
        this.problem.set(vorab + [error.message, ...issues].join(' — '));
      } else this.problem.set('Could not reach the server.');
    } finally {
      this.speichert.set(false);
    }
  }
}

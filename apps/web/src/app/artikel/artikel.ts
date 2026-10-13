import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  areaOf,
  choicesOf,
  choiceText,
  BOOK_CARDS,
  fieldText,
  layoutFor,
  LAYER_RELATION,
  unitsFor,
  typeChain,
  entityName,
  entriesOf,
  entryRef,
  enumOptions,
  fieldTitle,
  proseFields,
  relationsFrom,
  primaryInterface,
  relationDef,
  resolveView,
} from '@nw/model';
import type { Entity, LayoutElement, PropertySchema, Registry, VarScopes, ViewDef } from '@nw/model';
import { Api, ApiError, type Fassungen } from '../kern/api';
import { Bestand } from '../kern/bestand';
import { Session } from '../kern/session';
import {
  anzeigeWert,
  ausEingabe,
  eingabeArt,
  inEingabe,
  inListe,
  kantenAusEntwurf,
  sindZeilen,
  suchgruppen,
  tabelleAlsText,
  verweisZiele,
  type Eingabe,
} from './felder';
import { Mehrfach, type Suchgruppe } from './mehrfach';
import { Text } from './text';
import { Wahl } from './wahl';
import { Statblock } from './statblock';
import { Zauber } from './zauber';
import { Gegenstand } from './gegenstand';
import { Abschnitte } from './abschnitte';
import { abweichungen, FassungsKasten, FassungsLesart, verglichene, type Abweichung } from './fassungen';
import { bereichLabel } from '../kern/bereiche';

const SCHON_ANDERSWO = ['Identity', 'Visibility', 'Source'];

interface Zelle {
  ref: string;
  comp: string;
  prop: string;
  label: string;
  wert: string;
  /** An einer Instanz: der Wert kommt von der Vorlage. */
  geerbt?: boolean;
  /** Ein langes Textfeld: gezeichnet als Markdown (M10), nicht als Zeile. */
  lang?: boolean;
  /** Ein Verweisfeld: Namen als Links statt Ids (T-068). */
  links?: { ziel: string; text: string }[];
}

interface Prosa {
  ref: string;
  type: string;
  key: string;
  label: string;
  wert: string;
}

/** Ein Stück der gezeichneten Seite — ein Layout-Element, aufgelöst. */
interface Stueck {
  id: string;
  art: 'statblock' | 'spell' | 'item' | 'beschreibung' | 'felder' | 'prosa' | 'teile' | 'ueberschrift' | 'absatz';
  text?: string;
  zellen?: Zelle[];
  prosa?: Prosa[];
}

/** Reiter gibt es auf der Artikelseite noch nicht: ihre Gruppen stehen nacheinander. */
function flach(layout: readonly LayoutElement[]): LayoutElement[] {
  return layout.flatMap((el) => (el.el === 'tabs' ? (el.tabs ?? []).flatMap((t) => flach(t.layout)) : [el]));
}

/** Nennt das Element dieses Feld — `fields`/`except` mit Typ oder `Typ.feld`? */
function passt(el: LayoutElement, typ: string, feld: string): boolean {
  if ((el.except ?? []).some((x) => x === typ || x === `${typ}.${feld}`)) return false;
  if (el.fields === undefined || el.fields === 'all') return true;
  return el.fields.some((x) => x === typ || x === `${typ}.${feld}`);
}

interface Feld {
  /** `Component.property` — eindeutig und zugleich der Name im Formular. */
  ref: string;
  comp: string;
  prop: string;
  label: string;
  art: Eingabe;
  schema: PropertySchema | undefined;
  /* Die Werte einer Auswahl, schon aufgelöst: das Feld trägt sie selbst
     oder nennt eine Aufzählungszeile, und die Vorlage soll das nicht noch
     einmal entscheiden müssen. */
  werte: string[];
  wert: string;
  jaNein: boolean;
  pflicht: boolean;
  /** Die Werte einer Auswahl mit Chips (`verweise`, `mehrfach`). */
  liste: string[];
  gruppen: Suchgruppe[];
  frei: boolean;
}

/**
 * Ein Artikel.
 *
 * **Gezeichnet wird aus dem Register**, nicht aus einer Vorlage je
 * Artikelart: die Anordnung steht am Typ (`InterfaceDef.views`), und
 * `layoutFor` aus `packages/model` sucht sie die `extends`-Kette hoch —
 * dieselbe Funktion, die der Prototyp benutzt. Ein Statblock liest sich
 * wie im Buch, weil das Register ihm das Element `statblock` gibt (W2);
 * eine Abfrage nach dem Artnamen hier wäre die zweite Stelle, an der
 * jemand etwas vergisst.
 *
 * **Zurückgehalten wird am Server** (`redactEntity`). Was hier ankommt, darf
 * angezeigt werden; die Seite prüft das nicht noch einmal. Eine zweite
 * Prüfung sähe nach Sorgfalt aus und wäre das Gegenteil: sie lüde dazu ein,
 * die erste wegzulassen.
 */
@Component({
  selector: 'nw-artikel',
  imports: [RouterLink, FormsModule, Text, Wahl, Mehrfach, Statblock, Zauber, Gegenstand, Abschnitte, FassungsKasten],
  template: `
    @if (artikel(); as e) {
      <div class="buch">
        <nav aria-label="Breadcrumb" class="brot">
          <a [routerLink]="'/' + (bereich() || 'compendium')">{{ bereichName() }}</a>
          <span aria-hidden="true">›</span>
          <a [routerLink]="'/' + (bereich() || 'compendium')" [queryParams]="{ type: art(e) }">{{
            typLabel(art(e))
          }}</a>
          <span aria-hidden="true">›</span>
          <span>{{ name(e) }}</span>
        </nav>

        <div class="spalten">
          <main class="hauptspalte">
            <div class="werkzeugzeile">
              <span class="meta">{{ meta() }}</span>
              <div class="werkzeuge">
                @if (art(e) === 'Class' && !bearbeitet()) {
                  <a class="knopf" [routerLink]="['/classes', e.id]">Class view</a>
                }
                @if (darfSchreiben() && !zeigtAlten()) {
                  <button type="button" (click)="bearbeitet() ? abbrechen() : beginnen()">
                    {{ bearbeitet() ? 'Cancel' : 'Edit' }}
                  </button>
                }
                @if (bearbeitet()) {
                  <button type="button" class="pri" [disabled]="speichert()" (click)="speichern()">
                    {{ speichert() ? 'Saving…' : 'Save' }}
                  </button>
                }
              </div>
            </div>

            <!-- Ein älterer fertiger Stand gilt für alle anderen (REQ-237,
                 E-012). Das Band sieht nur, wer den Arbeitsstand sieht. -->
            @if (fertigAm(); as am) {
              <p class="band-fertig" role="status">
                @if (zeigtAlten()) {
                  <span>You are looking at the ready version from {{ am }}.</span>
                  <button type="button" class="klein" (click)="zeigeNeuen()">Show the current version</button>
                } @else {
                  <span>Not ready yet — the version from {{ am }} applies.</span>
                  <button type="button" class="klein" [disabled]="laedtAlten()" (click)="zeigeAlten()">Show that version</button>
                  @if (session.darfReady()(e.id) && !bearbeitet()) {
                    <button type="button" class="klein" (click)="fertigNennen()">Mark ready</button>
                  }
                }
                @if (!bearbeitet() && problem(); as p) {
                  <span class="fehler" role="alert">{{ p }}</span>
                }
              </p>
            }

            <!-- Eine Fassung aus einer Vergleichsebene (T-092): sichtbar, aber nicht im Spiel. -->
            @if (bestand.vergleich().has(e.id)) {
              <p class="band-fertig band-vergleich" role="status">
                <span>This version comes from a compare layer. It is not in play in this campaign.</span>
              </p>
            }

            <article class="blatt">
              <div>
                <h1>{{ name(e) }}</h1>
                @if (untertitel(); as u) {
                  <p class="untertitel">{{ u }}</p>
                }
              </div>
              <!-- Ein Buch-Element setzt seine kursive Zeile unter den Namen
                   und zieht die Linie selbst. -->
              @if (bearbeitet() || !buchKopf()) {
                <div class="linie" aria-hidden="true"></div>
              }
            @if (bearbeitet()) {
              @if (problem(); as p) {
                <p class="fehler" role="alert">{{ p }}</p>
              }
              @if (maengel().length) {
                <ul class="maengel" role="alert">
                  @for (m of maengel(); track m) {
                    <li>{{ m }}</li>
                  }
                </ul>
              }

              <div class="maske">
                @for (f of felder(); track f.ref) {
                  <label>
                    <span>{{ f.label }}@if (f.pflicht) {<i class="pflicht" title="required">*</i>}</span>
                    @switch (f.art) {
                      @case ('jaNein') {
                        <input type="checkbox" [(ngModel)]="f.jaNein" [name]="f.ref" />
                      }
                      @case ('auswahl') {
                        <select [(ngModel)]="f.wert" [name]="f.ref">
                          <option value=""></option>
                          @for (o of f.werte; track o) {
                            <option [value]="o">{{ o }}</option>
                          }
                        </select>
                      }
                      @case ('lang') {
                        <textarea rows="4" [(ngModel)]="f.wert" [name]="f.ref"></textarea>
                      }
                      @case ('json') {
                        <textarea rows="6" spellcheck="false" style="font-family: monospace" [(ngModel)]="f.wert" [name]="f.ref"></textarea>
                      }
                      @case ('verweis') {
                        <nw-wahl
                          [wert]="f.wert"
                          (wertChange)="f.wert = $event"
                          [arten]="f.schema?.target?.interfaces ?? []"
                          [bevorzugt]="f.schema?.target?.tags ?? []"
                          [ausser]="e.id"
                          [label]="f.label"
                        />
                      }
                      @case ('verweise') {
                        <nw-mehrfach
                          [werte]="f.liste"
                          (werteChange)="f.liste = $event"
                          [verweise]="true"
                          [gruppen]="f.gruppen"
                          [bevorzugt]="f.schema?.target?.tags ?? []"
                          [ausser]="e.id"
                          [label]="f.label"
                        />
                      }
                      @case ('mehrfach') {
                        <nw-mehrfach
                          [werte]="f.liste"
                          (werteChange)="f.liste = $event"
                          [gruppen]="f.gruppen"
                          [feste]="f.werte"
                          [frei]="f.frei"
                          [label]="f.label"
                        />
                      }
                      @case ('zahl') {
                        <input type="text" inputmode="decimal" [(ngModel)]="f.wert" [name]="f.ref" />
                      }
                      @case ('liste') {
                        <input type="text" [(ngModel)]="f.wert" [name]="f.ref" placeholder="one, two, three" />
                      }
                      @default {
                        <input type="text" [(ngModel)]="f.wert" [name]="f.ref" />
                      }
                    }
                  </label>
                }
              </div>

              <h3>Passages</h3>
              @for (b of entwurfProsa(); track b.id) {
                <div class="blockmaske">
                  <div class="bkopf">
                    <span class="bl">{{ b.label }}</span>
                    <button type="button" class="weg" (click)="prosaWeg(b.id)" title="Remove">×</button>
                  </div>
                  <textarea rows="3" [(ngModel)]="b.wert" [name]="b.id"></textarea>
                </div>
              }
              <div class="werkzeuge">
                <select #neueArt>
                  @for (t of prosaArten(); track t.ref) {
                    <option [value]="t.ref">{{ t.label }}</option>
                  }
                </select>
                <button type="button" (click)="prosaDazu(neueArt.value)">+ Passage</button>
              </div>

              <h3>Relations</h3>
              @for (k of entwurfKanten(); track k.id) {
                <div class="kantenmaske">
                  <div class="bkopf">
                    <span class="rl">{{ kantenLabel(k.type) }}</span>
                    <nw-wahl
                      [wert]="k.to"
                      (wertChange)="k.to = $event"
                      [arten]="zielArten(k.type)"
                      [ausser]="e.id"
                      [label]="kantenLabel(k.type)"
                    />
                    <button type="button" class="weg" (click)="kanteWeg(k.id)" title="Remove">×</button>
                  </div>
                  @if (kantenFelder(k.type).length) {
                    <div class="maske">
                      @for (f of kantenFelder(k.type); track f.prop) {
                        <label>
                          <span>{{ f.label }}</span>
                          @switch (f.art) {
                            @case ('jaNein') {
                              <input
                                type="checkbox"
                                [checked]="k.props[f.prop] === true"
                                (change)="setzeProp(k, f.prop, $any($event.target).checked)"
                                [name]="k.id + '-' + f.prop"
                              />
                            }
                            @case ('verweis') {
                              <nw-wahl
                                [wert]="anzeige(k.props[f.prop])"
                                (wertChange)="setzeProp(k, f.prop, $event)"
                                [arten]="f.schema?.target?.interfaces ?? []"
                                [bevorzugt]="f.schema?.target?.tags ?? []"
                                [label]="f.label"
                              />
                            }
                            @case ('auswahl') {
                              <select
                                [value]="anzeige(k.props[f.prop])"
                                (change)="setzeProp(k, f.prop, $any($event.target).value)"
                                [name]="k.id + '-' + f.prop"
                              >
                                <option value=""></option>
                                @for (o of f.werte; track o) {
                                  <option [value]="o">{{ o }}</option>
                                }
                              </select>
                            }
                            @default {
                              <input
                                type="text"
                                [value]="anzeige(k.props[f.prop])"
                                (input)="setzeProp(k, f.prop, $any($event.target).value)"
                                [name]="k.id + '-' + f.prop"
                              />
                            }
                          }
                        </label>
                      }
                    </div>
                  }
                </div>
              }
              <div class="werkzeuge">
                <select #neueKante>
                  @for (t of kantenArten(); track t.type) {
                    <option [value]="t.type">{{ t.label }}</option>
                  }
                </select>
                <button type="button" (click)="kanteDazu(neueKante.value)">+ Relation</button>
              </div>
            } @else {
              @if (offeneVerweise().length) {
                <p class="hinweis" role="status">
                  Links not tied to an article (none or several match):
                  {{ offeneVerweise().join(', ') }}
                </p>
              }
              <!-- Gezeichnet wird die Anordnung der Art (layoutFor): was ein
                   Element nicht kennt, zeichnet hier noch niemand; was kein
                   Element zeichnet, steht am Ende (rest). -->
              @for (st of stuecke(); track st.id) {
                @switch (st.art) {
                  @case ('statblock') {
                    <nw-statblock [artikel]="e" />
                  }
                  @case ('spell') {
                    <nw-zauber [artikel]="e" [scopes]="scopes()" />
                  }
                  @case ('item') {
                    <nw-gegenstand [artikel]="e" />
                  }
                  @case ('beschreibung') {
                    <nw-text class="beschreibung" [text]="st.text ?? ''" [scopes]="scopes()" />
                  }
                  @case ('teile') {
                    <nw-abschnitte [besitzer]="e" />
                  }
                  @case ('ueberschrift') {
                    <h2>{{ st.text }}</h2>
                  }
                  @case ('absatz') {
                    <p class="beschreibung">{{ st.text }}</p>
                  }
                  @case ('felder') {
                    <dl class="felder">
                      @for (z of st.zellen; track z.ref) {
                        <div class="feld" [class.lang]="z.lang" [class.geerbt]="z.geerbt"
                             [attr.title]="z.geerbt ? 'From the template' : null">
                          <dt>{{ z.label }}</dt>
                          <dd>
                            @if (z.links) {
                              @for (l of z.links; track $index) {
                                @if (!$first) {<ng-container>, </ng-container>}
                                @if (l.ziel) {
                                  <a [routerLink]="['/artikel', l.ziel]">{{ l.text }}</a>
                                } @else {
                                  <span class="weg">{{ l.text }}</span>
                                }
                              }
                            } @else if (z.lang) {
                              <nw-text [text]="z.wert" [scopes]="scopes()" />
                            } @else {
                              <nw-text inline [text]="z.wert" [scopes]="scopes()" />
                            }
                            @for (a of abwAn(z.ref); track a.id) {
                              <span class="fassung" [class.lang]="a.lang">
                                <span class="kuerzel" [class.vergleich]="a.compare" [title]="a.titel">{{ a.kuerzel }}</span>
                                @if (a.lang && a.text) {
                                  <details>
                                    <summary>says otherwise</summary>
                                    <nw-text [text]="a.text" [scopes]="scopes()" />
                                  </details>
                                } @else {
                                  <span class="fwert">{{ a.text || '—' }}</span>
                                }
                              </span>
                            }
                          </dd>
                        </div>
                      }
                    </dl>
                  }
                  @case ('prosa') {
                    @for (b of st.prosa; track b.ref) {
                      <section class="block" [class]="b.key">
                        @if (b.key !== 'paragraph') {
                          <h2>{{ b.label }}</h2>
                        }
                        <nw-text [text]="b.wert" [scopes]="scopes()" />
                        @for (a of abwProsa(b.ref); track a.id) {
                          <details class="fassung lang">
                            <summary>
                              <span class="kuerzel" [class.vergleich]="a.compare" [title]="a.titel">{{ a.kuerzel }}</span>
                              {{ a.text ? 'says otherwise' : 'has nothing here' }}
                            </summary>
                            @if (a.text) {
                              <nw-text [text]="a.text" [scopes]="scopes()" />
                            }
                          </details>
                        }
                      </section>
                    }
                  }
                }
              }
              <!-- Was eine Fassung anders sagt, wo die Seite kein Feld dafür
                   zeichnet: im Zauberblock, im Statblock, oder weil das Feld
                   hier leer ist (T-092). -->
              @if (abwRest().length) {
                <section class="block fassungen-rest">
                  <h2>Where other versions differ</h2>
                  <dl class="felder">
                    @for (z of abwRest(); track z.ref) {
                      <div class="feld" [class.lang]="z.lang">
                        <dt>{{ z.label }}</dt>
                        <dd>
                          @if (z.hier) {
                            <span class="fhier">{{ z.hier }}</span>
                          }
                          @for (a of z.liste; track a.id) {
                            <span class="fassung" [class.lang]="a.lang">
                              <span class="kuerzel" [class.vergleich]="a.compare" [title]="a.titel">{{ a.kuerzel }}</span>
                              @if (a.lang && a.text) {
                                <details>
                                  <summary>says otherwise</summary>
                                  <nw-text [text]="a.text" [scopes]="scopes()" />
                                </details>
                              } @else {
                                <span class="fwert">{{ a.text || '—' }}</span>
                              }
                            </span>
                          }
                        </dd>
                      </div>
                    }
                  </dl>
                </section>
              }
            }
            </article>
          </main>

          <aside class="seitenspalte" aria-label="Connections">
            @if (kanten().length || abwKanten().length) {
              <section class="kasten">
                <h2>Relations</h2>
                <ul class="kanten">
                  @for (k of kanten(); track k.id) {
                    <li>
                      <span class="rl">{{ k.label }}</span>
                      @if (k.ziel) {
                        <a [routerLink]="['/artikel', k.ziel]">{{ k.text }}</a>
                      } @else {
                        <span class="weg">{{ k.text }}</span>
                      }
                    </li>
                  }
                  @for (k of abwKanten(); track $index) {
                    <li class="fassung-kante">
                      <span class="rl">{{ k.label }}</span>
                      <span class="kuerzel" [class.vergleich]="k.compare" [title]="k.titel">{{ k.kuerzel }}</span>
                      @if (k.dazu.length) {
                        <span>+ {{ k.dazu.join(', ') }}</span>
                      }
                      @if (k.weg.length) {
                        <span class="weg">− {{ k.weg.join(', ') }}</span>
                      }
                    </li>
                  }
                </ul>
              </section>
            }
            <nw-fassungen [artikel]="e.id" [fassungen]="fassungen()" (gewechselt)="gewechselt($event)" />
            @if (rueckbezuege().length) {
              <section class="kasten">
                <h2>Linked here</h2>
                <ul class="kanten">
                  @for (r of rueckbezuege(); track r.id) {
                    <li>
                      <span class="rl">{{ r.label }}</span>
                      <a [routerLink]="['/artikel', r.ziel]">{{ r.text }}</a>
                    </li>
                  }
                </ul>
              </section>
            }
            <section class="kasten">
              <h2>Who can see this</h2>
              <div class="zeile"><span>Audience</span><strong>{{ sicht().audience }}</strong></div>
              @for (z of sicht().listen; track z.label) {
                <div class="zeile">
                  <span>{{ z.label }}</span>
                  <span>
                    @for (l of z.links; track $index) {
                      @if (!$first) {<ng-container>, </ng-container>}
                      @if (l.ziel) {
                        <a [routerLink]="['/artikel', l.ziel]">{{ l.text }}</a>
                      } @else {
                        <span class="weg">{{ l.text }}</span>
                      }
                    }
                  </span>
                </div>
              }
            </section>
            @if (quelle(); as q) {
              <section class="kasten">
                <h2>Source</h2>
                @if (q.url) {
                  <a [href]="q.url" target="_blank" rel="noopener">{{ q.text }}</a>
                } @else {
                  <span>{{ q.text }}</span>
                }
              </section>
            }
          </aside>
        </div>
      </div>
    } @else if (bestand.fehlt().has(id())) {
      <p class="fehler buch">No such article — or not one you may see.</p>
    } @else {
      <p class="leer buch">Loading…</p>
    }
  `,
  styleUrl: './artikel.scss',
})
export class Artikel {
  readonly id = input.required<string>();
  /** `?edit=1`: gleich bearbeiten — so öffnet „New article" den frischen Artikel (W7). */
  readonly edit = input<string | undefined>(undefined);

  protected readonly bestand = inject(Bestand);
  protected readonly session = inject(Session);
  private readonly lesart = inject(FassungsLesart);
  private readonly router = inject(Router);

  constructor() {
    void this.bestand.load();
    /* Der ganze Artikel kommt erst hier, beim Öffnen — die Liste trägt nur
       seine Zeile. Wechselt die Id (ein Verweis auf der Seite), wird
       der nächste geholt. */
    effect(() => {
      void this.bestand.oeffnen(this.id());
    });
    /* **Die Fassungen** (T-092) kommen je Artikel, neben ihm: eine
       Anfrage, und der Vergleich rechnet hier. Namen der Kantenziele, die
       eine Fassung anders hat, holt die Liste nach. */
    void this.lesart.laden();
    effect(() => {
      const id = this.id();
      untracked(() => void this.fassungenLaden(id));
    });
    /* Einmal je Artikel: nach dem Speichern steht `?edit=1` noch in der
       Adresse, und die Seite soll dann lesen, nicht wieder bearbeiten. */
    let schonBearbeitet = '';
    effect(() => {
      const id = this.id();
      if (!this.edit() || schonBearbeitet === id) return;
      if (this.artikel() && this.reg() && this.darfSchreiben()) {
        schonBearbeitet = id;
        untracked(() => this.beginnen());
      }
    });
  }

  private readonly reg = computed<Registry | null>(() => this.bestand.registry());
  /** Der letzte fertige Stand, wenn er gerade angesehen wird (E-012) —
   *  nur zum Lesen, gemerkt mit der Id, zu der er gehört. */
  private readonly alterStand = signal<{ id: string; e: Entity } | null>(null);
  protected readonly laedtAlten = signal(false);
  protected readonly zeigtAlten = computed(() => this.alterStand()?.id === this.id());
  protected readonly artikel = computed<Entity | undefined>(() => {
    const alt = this.alterStand();
    if (alt && alt.id === this.id()) return alt.e;
    return this.bestand.voll().get(this.id());
  });
  /** Das Datum des fertigen Stands, der noch gilt — für das Band. */
  protected readonly fertigAm = computed(() => {
    const at = this.bestand.fertig().get(this.id());
    return at ? new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
  });

  protected async zeigeAlten(): Promise<void> {
    const id = this.id();
    this.laedtAlten.set(true);
    try {
      const { refs: _refs, ...e } = await this.api.readyVersion(id);
      if (this.id() === id) this.alterStand.set({ id, e: e as Entity });
    } catch (error) {
      this.problem.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.laedtAlten.set(false);
    }
  }

  protected zeigeNeuen(): void {
    this.alterStand.set(null);
  }

  /** „ready" ohne die Maske: der neue Stand gilt (REQ-237). */
  protected async fertigNennen(): Promise<void> {
    const id = this.id();
    try {
      await this.api.setReady(id);
      this.alterStand.set(null);
      await this.bestand.oeffnen(id, true);
    } catch (error) {
      this.problem.set(error instanceof Error ? error.message : String(error));
    }
  }
  /* **Der Ort wählt die Ansicht** (CLAUDE.md): die Artikelseite zeigt
     `full`. Hier stand ein Wähler — einen gibt es nicht, und wer weniger
     sehen darf, sieht dieselbe Ansicht mit weniger darin. */
  private readonly view = computed<ViewDef | null>(() => {
    const r = this.reg();
    return r ? resolveView(r, 'full') : null;
  });

  protected typLabel(typ: string): string {
    return this.reg()?.interfaces[typ]?.label ?? typ;
  }

  /** Der Bereich der Art (`area` am Typ) — für den Brotkrumenpfad. */
  protected readonly bereich = computed(() => {
    const e = this.artikel();
    const r = this.reg();
    return e && r ? areaOf(r, primaryInterface(e)) : '';
  });
  protected readonly bereichName = computed(() => bereichLabel(this.bereich()) ?? 'Compendium');

  /** Art · Nummer · Ebenen — die Zeile über dem Blatt. */
  protected readonly meta = computed(() => {
    const e = this.artikel();
    if (!e) return '';
    /* Die Namen kommen mit dem Artikel (`refs`, W7). */
    const name = this.bestand.name();
    const nummer = (e.components?.['Identity'] as { id?: string } | undefined)?.id;
    const ebenen = (e.relations ?? [])
      .filter((r) => r.type === LAYER_RELATION)
      .map((r) => name(r.to) ?? '');
    return [this.typLabel(primaryInterface(e)), nummer, ...ebenen].filter(Boolean).join(' · ');
  });

  /** Aliasse und Deckname, kursiv unter dem Namen. */
  protected readonly untertitel = computed(() => {
    const id = this.artikel()?.components?.['Identity'] as
      | { aliases?: string[]; cover?: string }
      | undefined;
    const teile = [...(id?.aliases ?? [])];
    if (id?.cover) teile.push(`known as ${id.cover}`);
    return teile.join(' · ');
  });

  /** Was der Artikel über seine Sichtbarkeit sagt — `public` ist die Vorgabe. */
  protected readonly sicht = computed(() => {
    const v = this.artikel()?.components?.['Visibility'] as
      | { audience?: string; revealedTo?: string[]; hiddenFrom?: string[] }
      | undefined;
    const name = this.bestand.name();
    /* Träger als Links, wie jedes Verweisfeld (T-068). */
    return {
      audience: v?.audience ?? 'public',
      listen: [
        { label: 'Revealed to', links: verweisZiele(v?.revealedTo, name) },
        { label: 'Hidden from', links: verweisZiele(v?.hiddenFrom, name) },
      ].filter((l) => l.links.length),
    };
  });

  protected readonly quelle = computed(() => {
    const q = this.artikel()?.components?.['Source'] as
      | { publication?: string; page?: string; url?: string }
      | undefined;
    if (!q?.publication && !q?.url) return null;
    const text = [q.publication, q.page ? `p. ${q.page}` : ''].filter(Boolean).join(', ');
    return { text: text || q.url || '', url: q.url };
  });
  protected name(e: Entity): string {
    return entityName(e);
  }
  protected art(e: Entity): string {
    return primaryInterface(e);
  }

  /**
   * Woraus `{VAR}` im Text aufgelöst wird: der Artikel, dann das Register
   * (REQ-174). Die Bindung an einer Kante kennt nur, wer den Text über die
   * Kante hereinzieht — die Artikelseite zeigt ihn für sich.
   */
  protected readonly scopes = computed<VarScopes>(() => {
    const e = this.artikel();
    const vars = e?.components?.['Vars'] as { bindings?: Record<string, string> } | undefined;
    return { entity: vars?.bindings, campaign: this.reg()?.vars };
  });

  protected readonly beschreibung = computed<string | null>(() => {
    const e = this.artikel();
    const v = this.view();
    if (!e || !v?.description) return null;
    const d = e.components?.['Description'] as { description?: string } | undefined;
    return d?.description ?? null;
  });

  /**
   * **Jede Feldzelle des Artikels**, in der Reihenfolge, in der die Art ihre
   * Felder erklärt. Welche davon wo stehen, sagt die Anordnung (`stuecke`).
   * Ein Mass steht mit Einheit da, umgerechnet nach `units` (D8) — „Range
   * 150" ohne Einheit gibt es nicht.
   */
  private readonly alleZellen = computed<Zelle[]>(() => {
    const e = this.artikel();
    const r = this.reg();
    if (!e || !r) return [];
    const mode = unitsFor(r, primaryInterface(e));
    const out: Zelle[] = [];
    /* Ein Prosafeld steht nicht in der Feldtabelle, es gehört dem Absatz
       darunter (`prosa`) — hier stand es als „[object Object]" (W1). */
    const prosa = new Set(proseFields(r, primaryInterface(e)).map((f) => `${f.type}.${f.key}`));
    for (const [comp, karte] of Object.entries(e.components ?? {})) {
      /* Was schon anderswo steht: der Name als Überschrift, Aliasse und
         Nummer darüber und darunter, Sichtbarkeit und Quelle in der
         Seitenspalte. Zweimal dasselbe liest sich wie ein Fehler. */
      if (SCHON_ANDERSWO.includes(comp)) continue;
      const def = r.interfaces[comp];
      const werte = (karte ?? {}) as Record<string, unknown>;
      const reihe = [
        ...Object.keys(def?.schema?.properties ?? {}).filter((k) => k in werte),
        ...Object.keys(werte).filter((k) => !(k in (def?.schema?.properties ?? {}))),
      ];
      /* Tabellenzeilen (`Table.rows`) werden eine Tabelle, ihr Kopf
         (`columns`) steht darin und nicht noch einmal als Zeile. */
      const zeilen = Object.keys(werte).find((k) => sindZeilen(werte[k]));
      for (const prop of reihe) {
        const wert = werte[prop];
        if (prosa.has(`${comp}.${prop}`)) continue;
        if (zeilen && prop === 'columns') continue;
        if (wert === null || wert === undefined || wert === '') continue;
        const schema = def?.schema?.properties?.[prop];
        /* Ein Prosafeld gehört dem Element `prose`, nicht der Tabelle. */
        if (schema?.many && schema.format === 'long') continue;
        /* Tabellenzeilen und Objekte liest `anzeigeWert` — `fieldText`
           kennt Masse und Einheiten, aber keine Karten in einer Liste (W1). */
        const tabelle = prop === zeilen && sindZeilen(wert);
        const objekt =
          typeof wert === 'object' &&
          (!Array.isArray(wert) || wert.some((x) => x !== null && typeof x === 'object'));
        /* Eine Wahl liest sich als Satz („Choose 2 from …", REQ-238),
           nicht als ihre Schlüssel. */
        const text = tabelle
          ? tabelleAlsText(werte['columns'], wert)
          : comp === 'Choices' && prop === 'choices'
            ? choicesOf(e).map((c) => `${c.level && c.level > 1 ? `Level ${c.level}: ` : ''}${choiceText(c)}`).join('; ')
            : objekt
            ? anzeigeWert(wert)
            : fieldText(r, schema, wert, mode);
        if (!text) continue;
        /* Ein Verweisfeld zeigt Namen, die auf ihren Artikel führen, und
           nicht die Id (T-068) — auch eine Liste davon. */
        const links = schema?.format === 'link' ? verweisZiele(wert, this.bestand.name()) : undefined;
        out.push({
          ...(links?.length ? { links } : {}),
          ref: `${comp}.${prop}`,
          comp,
          prop,
          lang: tabelle || (schema?.format === 'long' && typeof wert === 'string'),
          label: schema
            ? fieldTitle(r, primaryInterface(e), { type: comp, key: prop, prop: schema })
            : prop,
          wert: text,
          geerbt: e.fromTemplate?.fields.includes(`${comp}.${prop}`) ?? false,
        });
      }
    }
    return out;
  });

  /**
   * **Die Seite, wie die Anordnung der Art sie sagt** (`layoutFor`, die
   * `extends`-Kette hoch). Ein Statblock zeichnet sich wie im Buch, weil
   * das Register an `Statblock` das Element `statblock` setzt — hier steht
   * kein Artname (W2).
   *
   * Jedes Element nimmt, was es zeichnet, aus dem Rest; **was keines
   * zeichnet, steht am Ende**. Die Seite kennt noch nicht jedes Element
   * (Bogen, Inventar, Karte …), und ein Feld, das nur dort stünde, wäre
   * sonst nirgends zu lesen.
   */
  protected readonly stuecke = computed<Stueck[]>(() => {
    const e = this.artikel();
    const r = this.reg();
    if (!e || !r) return [];
    const layout = flach(layoutFor(r, 'full', primaryInterface(e)).layout);
    const zellen = this.alleZellen();
    const prosa = this.prosa();
    const felderDa = new Set<string>();
    const prosaDa = new Set<string>();
    const da = (typ: string, feld: string) => felderDa.has(typ) || felderDa.has(`${typ}.${feld}`);
    const out: Stueck[] = [];

    for (const el of layout) {
      switch (el.el) {
        case 'statblock':
        case 'spell':
        case 'item': {
          for (const karte of BOOK_CARDS[el.el] ?? []) felderDa.add(karte);
          /* Der Zauber zeichnet seinen Text selbst, weil „At Higher Levels"
             dahinter steht. */
          if (el.el === 'spell') {
            felderDa.add('Description.description');
            prosa.filter((b) => b.type === 'Prose' && b.key === 'paragraph').forEach((b) => prosaDa.add(b.ref));
          }
          out.push({ id: el.id, art: el.el });
          break;
        }
        case 'description': {
          const text = this.beschreibung();
          felderDa.add('Description.description');
          if (text) out.push({ id: el.id, art: 'beschreibung', text });
          break;
        }
        case 'fields': {
          const hier = zellen.filter((z) => !da(z.comp, z.prop) && passt(el, z.comp, z.prop));
          hier.forEach((z) => felderDa.add(z.ref));
          if (hier.length) out.push({ id: el.id, art: 'felder', zellen: hier });
          break;
        }
        case 'prose': {
          const hier = prosa.filter((b) => !prosaDa.has(b.ref) && passt(el, b.type, b.key));
          hier.forEach((b) => prosaDa.add(b.ref));
          if (hier.length) out.push({ id: el.id, art: 'prosa', prosa: hier });
          break;
        }
        case 'composed':
          out.push({ id: el.id, art: 'teile' });
          break;
        case 'heading':
          if (el.text) out.push({ id: el.id, art: 'ueberschrift', text: el.text });
          break;
        case 'text':
          if (el.text) out.push({ id: el.id, art: 'absatz', text: el.text });
          break;
        default:
          /* Bogen, Inventar, Karte, Board … zeichnet die Artikelseite noch
             nicht (W4 und später). Was sie tragen, steht unten im Rest. */
          break;
      }
    }

    const rest = zellen.filter((z) => !da(z.comp, z.prop));
    if (rest.length) out.push({ id: 'rest-f', art: 'felder', zellen: rest });
    const restProsa = prosa.filter((b) => !prosaDa.has(b.ref));
    if (restProsa.length) out.push({ id: 'rest-p', art: 'prosa', prosa: restProsa });
    return out;
  });

  /** Steht ein Buch-Element zuoberst, setzt es die Zeile unter den Namen. */
  protected readonly buchKopf = computed(() => {
    const erstes = this.stuecke()[0]?.art;
    return erstes === 'statblock' || erstes === 'spell' || erstes === 'item';
  });

  /**
   * Die Prosa dieses Artikels. Sie steht in Feldern mit `many` und langer
   * Eingabe — es gibt keine zweite Sorte Inhalt mehr neben den Karten —,
   * und jeder Eintrag trägt die Id, an der die Wissensfreigabe hängt.
   */
  protected readonly prosa = computed(() => {
    const e = this.artikel();
    const r = this.reg();
    if (!e || !r) return [];
    const out: Prosa[] = [];
    for (const f of proseFields(r, primaryInterface(e))) {
      const karte = (e.components?.[f.type] ?? {}) as Record<string, unknown>;
      for (const eintrag of entriesOf(karte[f.key])) {
        out.push({
          ref: entryRef(f.type, f.key, eintrag.id),
          type: f.type,
          key: f.key,
          label: fieldTitle(r, primaryInterface(e), f),
          wert: eintrag.value,
        });
      }
    }
    return out;
  });

  protected readonly kanten = computed(() => {
    const e = this.artikel();
    const r = this.reg();
    if (!e || !r || !this.view()?.relations) return [];
    const name = this.bestand.name();
    /* Die Ebene steht schon in der Zeile über dem Blatt. */
    return (e.relations ?? []).filter((rel) => rel.type !== LAYER_RELATION).map((rel) => {
      const ziel = name(rel.to);
      return {
        id: rel.id,
        label: relationDef(r, rel.type).label,
        ziel: ziel === undefined ? '' : rel.to,
        /* Ein Ziel, das es nicht gibt, wird gesagt und nicht verschwiegen —
           es kann auch heissen, dass der Betrachter es nicht sehen darf. */
        text: ziel ?? '(not here)',
      };
    });
  });

  // ------------------------------------------------------------ Fassungen (T-092)

  private readonly fassungsStand = signal<{ id: string; f: Fassungen } | null>(null);
  protected readonly fassungen = computed(() => {
    const s = this.fassungsStand();
    return s && s.id === this.id() ? s.f : null;
  });

  private async fassungenLaden(id: string): Promise<void> {
    try {
      const f = await this.api.versions(id);
      if (id !== this.id()) return;
      this.fassungsStand.set({ id, f });
      const ziele = new Set<string>();
      for (const v of f.versions) for (const r of v.entity.relations ?? []) if (r.to) ziele.add(r.to);
      const name = this.bestand.name();
      const fehlen = [...ziele].filter((x) => name(x) === undefined).slice(0, 200);
      if (fehlen.length) await this.bestand.liste({ ids: fehlen, limit: 200 });
    } catch {
      /* Ohne Fassungen steht der Artikel für sich — das ist kein Fehler der Seite. */
      if (id === this.id()) this.fassungsStand.set(null);
    }
  }

  /** Was die verglichenen Fassungen anders sagen — je Feld und je Kantenart. */
  private readonly abw = computed(() => {
    const e = this.artikel();
    const r = this.reg();
    if (!e || !r || this.bearbeitet()) return { felder: new Map<string, Abweichung[]>(), kanten: [] };
    return abweichungen(r, e, verglichene(this.fassungen(), this.lesart.stand()), this.bestand.name());
  });

  protected abwAn(ref: string): Abweichung[] {
    return this.abw().felder.get(ref) ?? [];
  }

  /** Ein Prosafeld bekommt den Vergleich an seinem ersten Eintrag. */
  private readonly erstePros = computed(() => {
    const m = new Map<string, string>();
    for (const b of this.prosa()) if (!m.has(`${b.type}.${b.key}`)) m.set(`${b.type}.${b.key}`, b.ref);
    return m;
  });
  protected abwProsa(entry: string): Abweichung[] {
    for (const [feld, erste] of this.erstePros()) if (erste === entry) return this.abwAn(feld);
    return [];
  }

  /** Was keine Zelle und kein Absatz der Seite zeigt — es steht am Ende. */
  protected readonly abwRest = computed(() => {
    const e = this.artikel();
    const r = this.reg();
    const felder = this.abw().felder;
    if (!e || !r || !felder.size) return [];
    const gezeigt = new Set<string>(this.erstePros().keys());
    for (const st of this.stuecke()) for (const z of st.zellen ?? []) gezeigt.add(z.ref);
    const hier = new Map(this.alleZellen().map((z) => [z.ref, z.wert]));
    const out: { ref: string; label: string; lang: boolean; hier: string; liste: Abweichung[] }[] = [];
    for (const [ref, liste] of felder) {
      if (gezeigt.has(ref)) continue;
      const [type = '', key = ''] = ref.split('.');
      const prop = r.interfaces[type]?.schema?.properties?.[key];
      out.push({
        ref,
        label: prop ? fieldTitle(r, primaryInterface(e), { type, key, prop }) : key,
        lang: liste.some((a) => a.lang),
        hier: hier.get(ref) ?? '',
        liste,
      });
    }
    return out;
  });

  protected readonly abwKanten = computed(() => {
    const r = this.reg();
    if (!r) return [];
    return this.abw().kanten.map((k) => ({ ...k, label: relationDef(r, k.type).label }));
  });

  /** Nach dem Übernehmen oder Zurücknehmen gilt ein anderer Artikel. */
  protected async gewechselt(id: string): Promise<void> {
    await this.bestand.oeffnen(id, true);
    await this.router.navigate(['/artikel', id]);
    await this.fassungenLaden(id);
  }

  // ------------------------------------------------------------ bearbeiten

  protected readonly bearbeitet = signal(false);
  protected readonly speichert = signal(false);
  protected readonly problem = signal<string | null>(null);
  protected readonly maengel = signal<string[]>([]);
  /** Verweise, die beim letzten Speichern keine Id bekamen (M11). */
  protected readonly offeneVerweise = signal<string[]>([]);
  protected readonly felder = signal<Feld[]>([]);
  protected readonly entwurfProsa = signal<
    { id: string; type: string; key: string; label: string; wert: string }[]
  >([]);

  private readonly api = inject(Api);

  protected readonly darfSchreiben = computed(() => {
    const e = this.artikel();
    return e ? this.session.darfSchreiben()(e.id) : false;
  });

  /**
   * Die Maske zeigt **jedes erlaubte Feld**, nicht nur die ausgefüllten:
   * ein Feld, das erst erscheint, wenn es einen Wert hat, kann niemand zum
   * ersten Mal ausfüllen. Die Darstellungsstufe gilt hier nicht — sie sagt,
   * was man *liest*, nicht was es gibt.
   */
  protected beginnen(): void {
    const e = this.artikel();
    const r = this.reg();
    if (!e || !r) return;
    const erlaubt = typeChain(r, primaryInterface(e));
    const pflicht = new Set(
      erlaubt.flatMap((t) => (r.interfaces[t]?.schema?.required ?? []).map((k) => `${t}.${k}`)),
    );
    const out: Feld[] = [];
    for (const comp of erlaubt) {
      const def = r.interfaces[comp];
      if (!def) continue;
      const karte = (e.components?.[comp] ?? {}) as Record<string, unknown>;
      for (const [prop, schema] of Object.entries(def.schema?.properties ?? {})) {
        /* Abgeleitete Werte bekommen keine Eingabe (D8). Sie hier
           anzubieten hiesse, jemanden etwas eintippen zu lassen, das beim
           nächsten Lesen überschrieben wird. */
        if (schema.derived) continue;
        /* Ein Prosafeld gehört der Prosamaske und nicht der Feldliste.
           Zweimal dasselbe anzubieten hiesse, dass der zweite Eingang den
           ersten überschreibt, und keiner der beiden sagte das. */
        if (schema.many && schema.format === 'long') continue;
        /* Ohne Artikel: eine Auswahl, die eine Art nennt (M6), hätte den
           ganzen Bestand gebraucht, und den hält der Browser nicht mehr
           (W7). Sie wird ein freies Wort — heute nennt das nur Felder mit
           mehreren Werten, und die sind ohnehin eine Liste. */
        let werte = enumOptions(r, schema) ?? [];
        /* **`ready` setzt die Leitung** (REQ-237, E-011): Spielenden bietet
           die Maske es nicht an — ausser es steht schon da, sonst zeigte
           die Auswahl einen fertigen Artikel als leer. Der Server prüft. */
        if (comp === 'Status' && prop === 'status' && !this.session.darfReady()(e.id) && karte[prop] !== 'ready') {
          werte = werte.filter((w) => w !== 'ready');
        }
        /* Eine Auswahl ohne Werte ist ein freies Wort: nennt das Feld eine
           Art, von der noch nichts sichtbar ist (M6), soll man trotzdem
           etwas eintragen können. */
        const art = eingabeArt(schema) === 'auswahl' && !werte.length ? 'text' : eingabeArt(schema);
        const chips = art === 'verweise' || art === 'mehrfach';
        const suche = chips ? suchgruppen(r, schema) : { gruppen: [], feste: [], frei: true };
        out.push({
          ref: `${comp}.${prop}`,
          comp,
          prop,
          /* Wie das Feld **an dieser Art** heisst: derselbe `Time.until`
             ist an einem Auftrag die Frist und an einem Ereignis das Ende. */
          label: `${def.label ?? comp} · ${fieldTitle(r, primaryInterface(e), { type: comp, key: prop, prop: schema })}`,
          art,
          schema,
          werte: chips ? suche.feste : werte,
          wert: art === 'jaNein' || chips ? '' : inEingabe(karte[prop]),
          jaNein: karte[prop] === true,
          pflicht: pflicht.has(`${comp}.${prop}`),
          liste: chips ? inListe(karte[prop]) : [],
          gruppen: suche.gruppen,
          frei: suche.frei,
        });
      }
    }
    this.felder.set(out);
    this.entwurfProsa.set(
      this.prosa().map((b) => {
        const [typ, rest] = b.ref.split('.');
        const key = (rest ?? '').split('#')[0] ?? '';
        return { id: b.ref, type: typ ?? '', key, label: b.label, wert: b.wert };
      }),
    );
    this.entwurfKanten.set(
      (e.relations ?? []).map((rel) => ({
        id: rel.id,
        type: rel.type,
        to: rel.to,
        props: { ...(rel.props ?? {}) },
      })),
    );
    this.problem.set(null);
    this.maengel.set([]);
    this.offeneVerweise.set([]);
    this.bearbeitet.set(true);
  }

  protected abbrechen(): void {
    this.bearbeitet.set(false);
    this.problem.set(null);
    this.maengel.set([]);
  }

  protected prosaArten(): { ref: string; label: string }[] {
    const e = this.artikel();
    const r = this.reg();
    if (!e || !r) return [];
    return proseFields(r, primaryInterface(e)).map((f) => ({
      ref: `${f.type}.${f.key}`,
      label: fieldTitle(r, primaryInterface(e), f),
    }));
  }

  protected prosaDazu(ref: string): void {
    if (!ref) return;
    const [typ, key] = ref.split('.');
    if (!typ || !key) return;
    const label = this.prosaArten().find((a) => a.ref === ref)?.label ?? key;
    this.entwurfProsa.update((bs) => [
      ...bs,
      { id: `${ref}#neu-${bs.length}-${Date.now()}`, type: typ, key, label, wert: '' },
    ]);
  }
  protected prosaWeg(id: string): void {
    this.entwurfProsa.update((bs) => bs.filter((b) => b.id !== id));
  }

  // ------------------------------------------------------------- Kanten

  /**
   * **Nur vorwärts.** Was hier bearbeitet wird, sind die ausgehenden Kanten
   * dieses Artikels; die Gegenrichtung ist eine Abfrage und hat kein Feld.
   * Eine Maske, die auch den Rückbezug bearbeiten liesse, müsste ihn
   * irgendwo hinschreiben — und dann verwaist eines der beiden Stücke.
   */
  protected readonly entwurfKanten = signal<
    { id: string; type: string; to: string; props: Record<string, unknown> }[]
  >([]);

  protected kantenArten(): { type: string; label: string }[] {
    const e = this.artikel();
    const r = this.reg();
    if (!e || !r) return [];
    return relationsFrom(r, primaryInterface(e))
      .map((d) => ({ type: d.type, label: d.label }))
      .sort((a2, b2) => a2.label.localeCompare(b2.label, 'de'));
  }
  protected kantenLabel(type: string): string {
    const r = this.reg();
    return r ? relationDef(r, type).label : type;
  }

  /**
   * Welche Arten diese Kantenart als Ziel annimmt — aus dem Register, nicht
   * aus einer Liste hier; gesucht wird dann am Server (`nw-wahl`). Leer
   * heisst jede. Eine Kante, die auf etwas Unpassendes zeigt, weist der
   * Server ohnehin ab; sie erst gar nicht anbieten ist die freundlichere
   * Hälfte derselben Regel.
   */
  protected zielArten(type: string): string[] {
    const e = this.artikel();
    const r = this.reg();
    if (!e || !r) return [];
    const to = relationDef(r, type).to ?? ['*'];
    if (to.includes('*')) return [];
    return to.map((t) => (t === 'same' ? primaryInterface(e) : t));
  }

  protected kantenFelder(
    type: string,
  ): {
    prop: string;
    label: string;
    art: Eingabe;
    schema: PropertySchema | undefined;
    werte: string[];
  }[] {
    const r = this.reg();
    if (!r) return [];
    const props = relationDef(r, type).props?.properties ?? {};
    return Object.entries(props).map(([prop, schema]) => ({
      prop,
      label: schema.title ?? prop,
      art: eingabeArt(schema),
      schema,
      werte: enumOptions(r, schema) ?? [],
    }));
  }

  protected anzeige(wert: unknown): string {
    return inEingabe(wert);
  }
  protected setzeProp(
    kante: { type: string; props: Record<string, unknown> },
    prop: string,
    roh: string | boolean,
  ): void {
    const r = this.reg();
    const schema = r ? relationDef(r, kante.type).props?.properties?.[prop] : undefined;
    const wert = ausEingabe(schema, roh);
    if (wert === undefined) delete kante.props[prop];
    else kante.props[prop] = wert;
  }

  protected kanteDazu(type: string): void {
    if (!type) return;
    this.entwurfKanten.update((ks) => [
      ...ks,
      { id: `r-neu-${ks.length}-${Date.now()}`, type, to: '', props: {} },
    ]);
  }
  protected kanteWeg(id: string): void {
    this.entwurfKanten.update((ks) => ks.filter((k) => k.id !== id));
  }

  /**
   * Geschrieben wird der ganze Artikel, auf einer Kopie gebaut. Erst ein
   * gelungenes Schreiben ersetzt ihn im Bestand — sonst stünde nach einem
   * Fehlschlag ein Stand da, den der Server nie gesehen hat, und beim
   * nächsten Laden wäre er lautlos weg.
   */
  protected async speichern(): Promise<void> {
    const alt = this.artikel();
    if (!alt || this.speichert()) return;
    this.speichert.set(true);
    this.problem.set(null);
    this.maengel.set([]);

    /* `[[Name]]` wird beim Speichern zur Id, wo genau ein Artikel so
       heisst (M11). Hier und nicht beim Lesen: danach überlebt der Verweis
       das Umbenennen des Ziels. Was nichts oder mehreres trifft, bleibt
       stehen und wird gesagt. */
    /* Der Server schreibt um (`/api/links`): er kennt den Bestand, und er
       weiss, was der Schreibende sehen darf. Ein Zug für alle Texte. */
    const texte: string[] = [];
    for (const f of this.felder()) {
      if (f.schema?.format === 'long' && f.art !== 'jaNein' && f.wert.includes('[[')) texte.push(f.wert);
    }
    for (const b of this.entwurfProsa()) if (b.wert.includes('[[')) texte.push(b.wert);
    const offen = new Set<string>();
    const umgeschrieben = new Map<string, string>();
    if (texte.length) {
      try {
        const r = await this.api.links(texte);
        texte.forEach((t, i) => umgeschrieben.set(t, r.texts[i] ?? t));
        r.open.forEach((o) => offen.add(o));
      } catch {
        /* Ohne Antwort bleibt `[[Name]]` stehen — ein Verweis ohne Nummer
           ist erlaubt und wird beim nächsten Speichern nachgezogen. */
      }
    }
    const mitIds = (text: string): string => umgeschrieben.get(text) ?? text;

    const components: Record<string, Record<string, unknown>> = {};
    for (const f of this.felder()) {
      let wert = ausEingabe(
        f.schema,
        f.art === 'jaNein' ? f.jaNein : f.art === 'verweise' || f.art === 'mehrfach' ? f.liste : f.wert,
      );
      if (wert === undefined) continue;
      if (f.schema?.format === 'long' && typeof wert === 'string') wert = mitIds(wert);
      (components[f.comp] ??= {})[f.prop] = wert;
    }
    /* Die Prosa wandert in die Karten, aus denen sie kommt. Die Id bleibt
       die, die sie hatte — eine Wissensfreigabe hängt daran, und sie beim
       Speichern neu zu würfeln nähme sie mit ins Leere. */
    for (const b of this.entwurfProsa()) {
      if (b.wert.trim() === '') continue;
      const id = b.id.split('#')[1] ?? b.id;
      ((components[b.type] ??= {})[b.key] ??= [] as { id: string; value: string }[]);
      (components[b.type][b.key] as { id: string; value: string }[]).push({
        id,
        value: mitIds(b.wert),
      });
    }

    const relations = kantenAusEntwurf(this.entwurfKanten());

    const neu = { ...alt, components, relations } as Entity;

    try {
      const gespeichert = await this.api.putEntity(neu);
      /* Neu geholt und nicht das Zurückgeschickte eingesetzt: was die Seite
         zeigt, ist gesiebt und aufgelöst, und das Gespeicherte ist es nicht.
         Die Zeile in der Liste zieht dabei mit. */
      await this.bestand.oeffnen(alt.id, true);
      this.bearbeitet.set(false);
      this.offeneVerweise.set([...offen]);
      /* Was der Server zurückgibt, gilt — er setzt `updatedAt` und darf
         mehr ändern, als hier geschickt wurde. */
      void gespeichert;
    } catch (error) {
      if (error instanceof ApiError) {
        this.problem.set(error.message);
        /* Die Liste wird gezeigt und nicht zusammengefasst: „ungültig" ohne
           Grund ist am Tisch keine Hilfe. */
        const issues = error.issues;
        if (Array.isArray(issues)) {
          this.maengel.set(
            issues.map((i) => {
              const o = i as { t?: string; message?: string; path?: unknown[] };
              if (o.t) return o.t;
              const pfad = Array.isArray(o.path) ? o.path.join('.') : '';
              return pfad ? `${pfad}: ${o.message ?? '?'}` : (o.message ?? JSON.stringify(i));
            }),
          );
        }
      } else {
        this.problem.set('Could not reach the server.');
      }
    } finally {
      this.speichert.set(false);
    }
  }

  protected readonly rueckbezuege = computed(() => {
    const e = this.artikel();
    const r = this.reg();
    if (!e || !r || !this.view()?.relations) return [];
    /* Die Gegenrichtung fragt der Server (K1): sie braucht jede Kante im
       Bestand, und die Seite hält keinen (W7). */
    return (this.bestand.rueckbezuege().get(e.id) ?? []).map((b) => ({
      id: `${b.from.id}:${b.relation.id}`,
      label: relationDef(r, b.relation.type).inverseLabel,
      ziel: b.from.id,
      text: entityName(b.from),
    }));
  });
}

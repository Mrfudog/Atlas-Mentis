import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  areaOf,
  choicesOf,
  effectText,
  storedEffects,
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
  mergeEntity,
  proseFields,
  relationsFrom,
  primaryInterface,
  relationDef,
  resolveView,
} from '@nw/model';
import type { Entity, LayoutElement, MergeSide, PropertySchema, Registry, VarScopes, ViewDef } from '@nw/model';
import { Api, ApiError, type Fassungen, type LeseZiel } from '../kern/api';
import { Bestand } from '../kern/bestand';
import { KurzLink } from '../kern/kurzansicht';
import { Session } from '../kern/session';
import {
  anzeigeWert,
  ausEingabe,
  eingabeArt,
  inEingabe,
  inListe,
  kantenAusEntwurf,
  type KantenEntwurf,
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
import { Quellen } from '../kern/quellen';
import { antwortenJeEintrag, antwortText, EINTRAG_KANTEN } from './klasseneintrag';

const SCHON_ANDERSWO = ['Identity', 'Visibility', 'Source'];
/** Die Kante, an der ein Artikel in einem anderen steht — Raum im Kapitel, Kapitel im Abenteuer. */
const PART_RELATION = 'partOf';
/** So viele Glieder höchstens im Brotkrumenpfad. */
const PFAD_TIEFE = 8;

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
  imports: [RouterLink, FormsModule, Text, Wahl, Mehrfach, Statblock, Zauber, Gegenstand, Abschnitte, FassungsKasten, KurzLink],
  template: `
    @if (artikel(); as e) {
      <div class="buch">
        <nav aria-label="Breadcrumb" class="brot">
          <a [routerLink]="'/' + (bereich() || 'compendium')">{{ bereichName() }}</a>
          <span aria-hidden="true">›</span>
          <a [routerLink]="'/' + (bereich() || 'compendium')" [queryParams]="{ type: art(e) }">{{
            typLabel(art(e))
          }}</a>
          <!-- Ebene und übergeordnete Artikel (T-093): wo der Artikel steht. -->
          @for (p of pfad(); track p.id) {
            <span aria-hidden="true">›</span>
            <a [routerLink]="['/artikel', p.id]">{{ p.name }}</a>
          }
          <span aria-hidden="true">›</span>
          <span aria-current="page">{{ name(e) }}</span>
        </nav>

        <div class="spalten">
          <main class="hauptspalte">
            <div class="werkzeugzeile">
              <span class="meta">{{ meta() }}</span>
              <div class="werkzeuge">
                @if (art(e) === 'Class' && !bearbeitet()) {
                  <a class="knopf" [routerLink]="['/classes', e.id]">Class view</a>
                }
                <!-- Der Stufenaufstieg ist derselbe Assistent wie das Anlegen (T-080). -->
                @if (art(e) === 'PlayerCharacter' && darfSchreiben() && !bearbeitet() && !zeigtAlten()) {
                  <a class="knopf" [routerLink]="['/characters', e.id, 'level-up']">Level up</a>
                }
                <!-- Die Leseansicht (T-091): an der Stelle im Buch, oder bei
                     einer Ebene von vorn. -->
                @if (leseZiel(); as z) {
                  @if (!bearbeitet()) {
                    <a class="knopf" [routerLink]="['/read', z.layer]" [queryParams]="leseParams(z)">
                      {{ art(e) === 'Layer' ? 'Read' : 'Read in book' }}
                    </a>
                  }
                }
                <!-- Anpassen über der Vorlage (E-018, T-082): eine Fassung in
                     der Ebene der Kampagne, das Original bleibt. -->
                @if (anpassbar() && session.isAdmin() && !bearbeitet()) {
                  <button type="button" [disabled]="passtAn()" (click)="anpassen()"
                          title="Make a version for this campaign. The original stays as it is.">
                    {{ passtAn() ? 'Adapting…' : 'Adapt for this campaign' }}
                  </button>
                }
                @if (original(); as o) {
                  @if ((session.isAdmin() || darfSchreiben()) && !bearbeitet()) {
                    <button type="button" [disabled]="passtAn()" (click)="zumOriginal(o.id)"
                            title="Delete this version; the campaign sees the original again.">
                      Back to the original
                    </button>
                  }
                }
                @if (darfSchreiben() && !zeigtAlten()) {
                  <button type="button" (click)="bearbeitet() ? abbrechen() : beginnen()">
                    {{ bearbeitet() ? 'Cancel' : 'Edit' }}
                  </button>
                } @else if (fassungsZiele().length && !zeigtAlten() && !session.isAdmin()) {
                  <!-- Fremdes ändert man als Fassung in einer eigenen Ebene (T-098, E-001). -->
                  @if (fassungsZiele().length === 1) {
                    <button type="button" [disabled]="passtAn()" (click)="alsFassung(fassungsZiele()[0]!.id)"
                            [title]="'This article is not in a layer you edit. Edit makes your version in ' + fassungsZiele()[0]!.name + '; the original stays.'">
                      {{ passtAn() ? 'Making your version…' : 'Edit' }}
                    </button>
                  } @else {
                    <span class="fassung-wahl">
                      <label>
                        Edit as a version in
                        <select #ziel [disabled]="passtAn()" aria-label="Layer for your version">
                          @for (l of fassungsZiele(); track l.id) {
                            <option [value]="l.id">{{ l.name }}</option>
                          }
                        </select>
                      </label>
                      <button type="button" [disabled]="passtAn()" (click)="alsFassung(ziel.value)">
                        {{ passtAn() ? 'Making…' : 'Edit' }}
                      </button>
                    </span>
                  }
                }
                @if (bearbeitet()) {
                  <button type="button" class="pri" [disabled]="speichert()" (click)="speichern()">
                    {{ speichert() ? 'Saving…' : 'Save' }}
                  </button>
                }
              </div>
            </div>

            @if (anpassFehler(); as f) {
              <p class="fehler" role="alert">{{ f }}</p>
            }
            @if (original(); as o) {
              <p class="hinweis" role="status">
                This campaign’s version of “{{ o.name }}”. Links to the original lead here; the
                original stays as it was.
              </p>
            }
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
              <!-- REQ-192: jemand anders hat gespeichert, seit die Maske
                   offen ist. Nichts ist geschrieben; zusammengeführt wird
                   hier, gefragt nur, wo beide dasselbe verschieden änderten. -->
              @if (zusammen(); as z) {
                <section class="zusammen" role="alert">
                  <p>
                    <strong>Changed elsewhere.</strong>
                    Someone saved this article while you were editing. Nothing of yours is lost — it is not saved yet.
                    @if (z.taken) {
                      {{ z.taken }} of their changes {{ z.taken === 1 ? 'was' : 'were' }} merged into yours.
                    }
                  </p>
                  @if (z.conflicts.length) {
                    <p>Both of you changed {{ z.conflicts.length === 1 ? 'this' : 'these' }} — choose what to keep:</p>
                    <ul class="konflikte">
                      @for (k of z.conflicts; track k.key) {
                        <li>
                          <span class="was">{{ k.label }}</span>
                          <label><input type="radio" [name]="'k-' + k.key" [checked]="k.wahl === 'mine'" (change)="waehleSeite(k.key, 'mine')" /> Yours: <em>{{ k.mine }}</em></label>
                          <label><input type="radio" [name]="'k-' + k.key" [checked]="k.wahl === 'theirs'" (change)="waehleSeite(k.key, 'theirs')" /> Theirs: <em>{{ k.theirs }}</em></label>
                        </li>
                      }
                    </ul>
                  } @else {
                    <p>None of your changes collide with theirs.</p>
                  }
                  <div class="werkzeuge">
                    <button type="button" class="pri" [disabled]="speichert()" (click)="zusammenSpeichern()">
                      {{ speichert() ? 'Saving…' : 'Save merged' }}
                    </button>
                    <button type="button" [disabled]="speichert()" (click)="verwerfen()">Discard mine, show theirs</button>
                    <button type="button" (click)="herunterladen()">Download my version</button>
                  </div>
                </section>
              }
              @if (problem(); as p) {
                <p class="fehler" role="alert">
                  {{ p }}
                  @if (entwurf()) {
                    <button type="button" class="klein" (click)="herunterladen()">Download my version</button>
                  }
                </p>
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
              @for (k of hauptKanten(); track k.id) {
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
                  <!-- Die Antworten auf die Wahlen dieses Eintrags (T-095):
                       gespeichert als Kanten chose, gezeigt bei ihrer Klasse. -->
                  @for (u of unterKanten(k); track u.id) {
                    <div class="antwortmaske">
                      <label>
                        <span>{{ antwortLabel(u) }}</span>
                        <input
                          type="text"
                          [value]="anzeige(u.props['picks'])"
                          (input)="setzeProp(u, 'picks', $any($event.target).value)"
                          [name]="u.id + '-picks'"
                        />
                      </label>
                      <button type="button" class="weg" (click)="kanteWeg(u.id)" title="Remove">×</button>
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
                                  <a [routerLink]="['/artikel', l.ziel]" [nwQuick]="l.ziel">{{ l.text }}</a>
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
                        <a [routerLink]="['/artikel', k.ziel]" [nwQuick]="k.ziel">{{ k.text }}</a>
                      } @else {
                        <span class="weg">{{ k.text }}</span>
                      }
                      @if (k.stufe) {
                        <span class="stufe">level {{ k.stufe }}</span>
                      }
                      @if (k.unter; as u) {
                        <a class="unter" [routerLink]="['/artikel', u.id]">{{ u.name }}</a>
                      }
                      @if (k.antworten.length) {
                        <dl class="antworten">
                          @for (a of k.antworten; track a.id) {
                            <dt>{{ a.label }}</dt>
                            <dd>{{ a.text || '—' }}</dd>
                          }
                        </dl>
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
                      <a [routerLink]="['/artikel', r.ziel]" [nwQuick]="r.ziel">{{ r.text }}</a>
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
                        <a [routerLink]="['/artikel', l.ziel]" [nwQuick]="l.ziel">{{ l.text }}</a>
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
                } @else if (leseZiel(); as z) {
                  <!-- „XGE p. 12" springt an die Stelle im Buch (T-091). -->
                  <a [routerLink]="['/read', z.layer]" [queryParams]="leseParams(z)">{{ q.text }}</a>
                } @else {
                  <span>{{ q.text }}</span>
                }
                <!-- Das Kürzel ausgeschrieben (T-088): „XGE" sagt nur, wer das Buch kennt. -->
                @if (q.titel) {
                  <p class="quelltitel">{{ q.titel }}</p>
                }
                @if (q.verlag) {
                  <p class="quelltitel">Publisher: {{ q.verlag }}</p>
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
  private readonly quellen = inject(Quellen);
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
    /* Die `partOf`-Kette für den Brotkrumenpfad, Glied für Glied (T-093). */
    effect(() => {
      const offen = this.kette().offen;
      if (offen) void untracked(() => this.bestand.holen([offen]));
    });
    /* **Die Fassungen** (T-092) kommen je Artikel, neben ihm: eine
       Anfrage, und der Vergleich rechnet hier. Namen der Kantenziele, die
       eine Fassung anders hat, holt die Liste nach. */
    void this.lesart.laden();
    effect(() => {
      const id = this.id();
      untracked(() => void this.fassungenLaden(id));
    });
    /* **Wer das Original öffnet, landet bei der Fassung** (E-018, T-082):
       der Server liefert, was in der laufenden Kampagne gilt. Die Adresse
       zieht nach, damit Speichern und Verweise die Fassung meinen. */
    effect(() => {
      const e = this.artikel();
      if (e && e.id !== this.id()) void untracked(() => this.router.navigate(['/artikel', e.id], { replaceUrl: true }));
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

  /**
   * Der Brotkrumenpfad zwischen Art und Artikel (T-093, REQ-248): die
   * Ebene, die ihn bringt, dann die `partOf`-Kette von oben nach unten —
   * Abenteuer › Kapitel › Raum. Was der Betrachter nicht sehen darf, kommt
   * ohne Namen und beendet die Kette dort; ein Kreis läuft nicht endlos.
   */
  private readonly kette = computed<{ glieder: { id: string; name: string }[]; offen: string | null }>(() => {
    const e = this.artikel();
    if (!e) return { glieder: [], offen: null };
    const name = this.bestand.name();
    const voll = this.bestand.voll();
    const fehlt = this.bestand.fehlt();
    const glieder: { id: string; name: string }[] = [];
    const gesehen = new Set([e.id]);
    let jetzt: Entity | undefined = e;
    let offen: string | null = null;
    while (jetzt && glieder.length < PFAD_TIEFE) {
      const hoch: string | undefined = jetzt.relations?.find((r) => r.type === PART_RELATION)?.to;
      if (!hoch || gesehen.has(hoch)) break;
      gesehen.add(hoch);
      jetzt = voll.get(hoch);
      /* Noch nicht geholt: `holen` bringt es samt Namen und `partOf`. */
      if (!jetzt && !fehlt.has(hoch)) offen = hoch;
      const n = name(hoch);
      if (!n) break;
      glieder.unshift({ id: hoch, name: n });
    }
    const ebene = e.relations?.find((r) => r.type === LAYER_RELATION)?.to;
    const ebenenName = ebene ? name(ebene) : undefined;
    if (ebene && ebenenName && !gesehen.has(ebene)) glieder.unshift({ id: ebene, name: ebenenName });
    return { glieder, offen };
  });
  protected readonly pfad = computed(() => this.kette().glieder);

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
    const k = q.publication?.trim() ?? '';
    /* Dazu der Herausgeber (T-094): offizielles D&D, Partner oder Homebrew. */
    return { text: text || q.url || '', url: q.url, titel: k ? this.quellen.titel(k) : '', verlag: k ? this.quellen.herausgeber(k) : '' };
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
            : /* Ebenso eine Wirkung („Strength becomes 19", E-025 a). */
              comp === 'Effects' && prop === 'effects'
              ? storedEffects(e).map(effectText).join('; ')
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
    const voll = this.bestand.voll();
    /* **Ein Eintrag je Klasse** (T-095): die Antworten stehen bei der
       Klasse (oder Abstammung, Hintergrund), die fragt, nicht daneben. */
    const zu = antwortenJeEintrag(e.relations ?? []);
    const antworten = (id: string) =>
      (e.relations ?? [])
        .filter((a) => zu.get(a.id) === id)
        .map((a) => {
          const picks = Array.isArray(a.props?.['picks']) ? (a.props['picks'] as unknown[]).map(String) : [];
          return { id: a.id, ...antwortText(voll.get(a.to), String(a.props?.['choice'] ?? ''), picks, name) };
        });
    /* Die Ebene steht schon in der Zeile über dem Blatt. */
    return (e.relations ?? [])
      .filter((rel) => rel.type !== LAYER_RELATION && !zu.has(rel.id))
      .map((rel) => {
        const ziel = name(rel.to);
        const sub = rel.type === 'hasClass' && typeof rel.props?.['subclass'] === 'string' ? rel.props['subclass'] : '';
        const stufe = rel.type === 'hasClass' ? Number(rel.props?.['level']) || 1 : 0;
        const antw = EINTRAG_KANTEN.includes(rel.type) ? antworten(rel.id) : [];
        const subName = sub ? (name(sub) ?? sub) : '';
        return {
          id: rel.id,
          label: relationDef(r, rel.type).label,
          ziel: ziel === undefined ? '' : rel.to,
          /* Ein Ziel, das es nicht gibt, wird gesagt und nicht verschwiegen —
             es kann auch heissen, dass der Betrachter es nicht sehen darf. */
          text: rel.type === 'chose' ? `${ziel ?? rel.to}: ${String(rel.props?.['choice'] ?? '')}` : (ziel ?? '(not here)'),
          stufe,
          /* Die Unterklasse einmal: steht sie schon als Antwort da, nicht noch als Zeile. */
          unter: sub && !antw.some((a) => a.text === subName) ? { id: sub, name: subName } : null,
          antworten: antw,
        };
      });
  });

  /**
   * Die Quellen der Antworten ganz holen — ihre Wahlen sagen, wie eine
   * Antwort heisst und ob sie Ids hält —, danach die gewählten Artikel für
   * ihre Namen (T-095).
   */
  private readonly antwortQuellen = effect(() => {
    const e = this.artikel();
    if (!e?.relations?.some((r) => r.type === 'chose')) return;
    const voll = this.bestand.voll();
    const ids = new Set<string>();
    for (const r of e.relations) {
      if (r.type === 'chose') ids.add(r.to);
      if (r.type === 'hasClass' && typeof r.props?.['subclass'] === 'string') ids.add(r.props['subclass']);
    }
    for (const r of e.relations) {
      if (r.type !== 'chose') continue;
      const c = choicesOf(voll.get(r.to)).find((x) => x.id === r.props?.['choice']);
      if (c && (['feat', 'spell', 'feature', 'subclass'].includes(String(c.kind)) || c.from?.interfaces?.length)) {
        for (const p of Array.isArray(r.props?.['picks']) ? (r.props['picks'] as unknown[]) : []) ids.add(String(p));
      }
    }
    untracked(() => void this.bestand.holen([...ids]));
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

  /** „Im Buch lesen" — der Server sagt es mit dem Artikel (`refs.reading`, T-091). */
  protected readonly leseZiel = computed(() => this.bestand.lesen().get(this.id()));
  protected leseParams(z: LeseZiel): Record<string, string> {
    return z.at ? { at: z.at } : z.page ? { page: z.page } : {};
  }

  /** „Adapt" anbieten — der Server hat es mit dem Artikel gesagt (`refs.adaptable`). */
  protected readonly anpassbar = computed(() => this.bestand.anpassbar().has(this.id()));
  /** Wohin „Edit" eine Fassung legt, wenn man den Artikel nicht schreibt (`refs.adaptTo`, T-098). */
  protected readonly fassungsZiele = computed(() => this.bestand.anpassZiele().get(this.id()) ?? []);
  protected readonly passtAn = signal(false);
  protected readonly anpassFehler = signal<string | null>(null);

  /** Ist das eine Fassung (E-018)? Dann das Original, das sie ersetzt. */
  protected readonly original = computed(() => {
    const e = this.artikel();
    const ziel = (e?.relations ?? []).find((r) => r.type === 'overrides')?.to;
    return ziel ? { id: ziel, name: this.bestand.name()(ziel) ?? 'the original' } : null;
  });

  protected async anpassen(): Promise<void> {
    const e = this.artikel();
    if (!e) return;
    this.passtAn.set(true);
    this.anpassFehler.set(null);
    try {
      const { id } = await this.api.adapt(e.id);
      /* Das Original zeigt ab jetzt auf die Fassung; was offen war, gilt nicht mehr. */
      await this.bestand.oeffnen(this.id(), true);
      await this.router.navigate(['/artikel', id]);
    } catch (x) {
      this.anpassFehler.set(x instanceof Error ? x.message : String(x));
    } finally {
      this.passtAn.set(false);
    }
  }

  /**
   * **„Edit" an einem fremden Artikel** (T-098, E-001): eine Fassung in der
   * gewählten eigenen Ebene, dann gleich bearbeiten (`?edit=1`). Gibt es sie
   * schon, öffnet der Server die bestehende.
   */
  protected async alsFassung(layer: string): Promise<void> {
    const e = this.artikel();
    if (!e || !layer) return;
    this.passtAn.set(true);
    this.anpassFehler.set(null);
    try {
      const { id } = await this.api.adapt(e.id, layer);
      /* Die Fassung ist neu: was ich schreibe, sagt der Server erst jetzt (`/api/me`). */
      await this.session.load(true);
      await this.bestand.oeffnen(this.id(), true);
      await this.router.navigate(['/artikel', id], { queryParams: { edit: 1 } });
    } catch (x) {
      this.anpassFehler.set(x instanceof Error ? x.message : String(x));
    } finally {
      this.passtAn.set(false);
    }
  }

  protected async zumOriginal(original: string): Promise<void> {
    const e = this.artikel();
    if (!e || !confirm('Delete this version? The campaign sees the original again.')) return;
    this.passtAn.set(true);
    this.anpassFehler.set(null);
    try {
      await this.api.deleteEntity(e.id);
      await this.bestand.oeffnen(original, true);
      await this.router.navigate(['/artikel', original]);
    } catch (x) {
      this.anpassFehler.set(x instanceof Error ? x.message : String(x));
    } finally {
      this.passtAn.set(false);
    }
  }

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
    /* Wovon die Maske ausgeht (REQ-192): gegen diese Revision wird
       geschrieben, und gegen diesen Stand wird zusammengeführt, falls
       inzwischen jemand anders gespeichert hat. Festgehalten und nicht
       aus dem Bestand gelesen — der lädt den Artikel womöglich neu, und
       dann wäre die eigene Ausgangslage still eine andere. */
    this.basis.set(structuredClone(e));
    this.zusammen.set(null);
    this.entwurf.set(null);
    this.bearbeitet.set(true);
  }

  protected abbrechen(): void {
    this.bearbeitet.set(false);
    this.problem.set(null);
    this.maengel.set([]);
    this.zusammen.set(null);
    this.entwurf.set(null);
  }

  /** Der Stand, von dem die Maske ausging. */
  private readonly basis = signal<Entity | null>(null);
  /** Was zuletzt geschickt und nicht gespeichert wurde — zum Herunterladen. */
  protected readonly entwurf = signal<Entity | null>(null);
  /** Abgewiesen, weil jemand anders gespeichert hat: drei Fassungen und die Wahl je Konflikt. */
  protected readonly zusammen = signal<{
    base: Entity;
    mine: Entity;
    theirs: Entity;
    taken: number;
    conflicts: { key: string; label: string; mine: string; theirs: string; wahl: MergeSide }[];
  } | null>(null);

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

  /** Die Kanten der Maske ohne die Antworten, die bei ihrem Eintrag stehen (T-095). */
  protected hauptKanten(): KantenEntwurf[] {
    const ks = this.entwurfKanten();
    const zu = antwortenJeEintrag(ks);
    return ks.filter((k) => !zu.has(k.id));
  }
  protected unterKanten(k: { id: string }): KantenEntwurf[] {
    if (!this.reg()) return [];
    const ks = this.entwurfKanten();
    const zu = antwortenJeEintrag(ks);
    return ks.filter((a) => zu.get(a.id) === k.id);
  }
  protected antwortLabel(a: { to: string; props: Record<string, unknown> }): string {
    return antwortText(this.bestand.voll().get(a.to), String(a.props['choice'] ?? ''), [], this.bestand.name()).label;
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

    const basis = this.basis() ?? alt;
    const neu = { ...basis, components, relations } as Entity;
    await this.schreibe(neu, basis, offen);
  }

  /**
   * **Schreiben gegen die gelesene Revision** (REQ-192). Gelingt es, gilt
   * der Stand des Servers; weist er ab, weil jemand anders gespeichert hat,
   * wird zusammengeführt (`mergeEntity`) und gefragt — geschrieben wird
   * erst, wenn jemand „Save merged" sagt. Was nicht gespeichert werden
   * konnte, bleibt als Entwurf und lässt sich herunterladen (REQ-191).
   */
  private async schreibe(neu: Entity, basis: Entity, offen: Set<string> = new Set()): Promise<void> {
    this.speichert.set(true);
    this.problem.set(null);
    this.maengel.set([]);
    const { refs: _refs, fromTemplate: _ft, ...ohne } = neu as Entity & { refs?: unknown };
    this.entwurf.set(ohne as Entity);
    try {
      const gespeichert = await this.api.putEntity(ohne as Entity);
      /* Neu geholt und nicht das Zurückgeschickte eingesetzt: was die Seite
         zeigt, ist gesiebt und aufgelöst, und das Gespeicherte ist es nicht.
         Die Zeile in der Liste zieht dabei mit. */
      await this.bestand.oeffnen(neu.id, true);
      this.bearbeitet.set(false);
      this.zusammen.set(null);
      this.entwurf.set(null);
      this.offeneVerweise.set([...offen]);
      /* Was der Server zurückgibt, gilt — er setzt `updatedAt` und
         `revision` und darf mehr ändern, als hier geschickt wurde. */
      void gespeichert;
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        const jetzt = (error.body as { current?: (Entity & { refs?: unknown }) | null } | null)?.current;
        if (!jetzt) {
          this.zusammen.set(null);
          this.problem.set('This article no longer exists, or you can no longer see it. Your version is not saved.');
          return;
        }
        const { refs: _r, ...theirs } = jetzt;
        this.zeigeZusammen(basis, ohne as Entity, theirs as Entity);
        return;
      }
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

  /** Drei Fassungen nebeneinander; was nur eine Seite änderte, ist schon drin. */
  private zeigeZusammen(base: Entity, mine: Entity, theirs: Entity): void {
    const r = mergeEntity(base, mine, theirs);
    this.zusammen.set({
      base,
      mine,
      theirs,
      taken: r.taken.length,
      conflicts: r.conflicts.map((k) => ({
        key: k.key,
        label: this.konfliktName(k.key),
        mine: this.konfliktWert(k.mine),
        theirs: this.konfliktWert(k.theirs),
        wahl: 'mine' as MergeSide,
      })),
    });
  }

  protected waehleSeite(key: string, wahl: MergeSide): void {
    this.zusammen.update((z) =>
      z ? { ...z, conflicts: z.conflicts.map((k) => (k.key === key ? { ...k, wahl } : k)) } : z,
    );
  }

  /** Die Wahl angewandt, gegen den Stand der anderen geschrieben. Hat
   *  inzwischen noch jemand gespeichert, wird von dort aus wieder gefragt. */
  protected async zusammenSpeichern(): Promise<void> {
    const z = this.zusammen();
    if (!z || this.speichert()) return;
    const prefer = Object.fromEntries(z.conflicts.map((k) => [k.key, k.wahl]));
    const { merged } = mergeEntity(z.base, z.mine, z.theirs, prefer);
    await this.schreibe(merged, z.theirs);
  }

  /** Den eigenen Stand aufgeben und zeigen, was gilt. */
  protected async verwerfen(): Promise<void> {
    const e = this.artikel();
    this.zusammen.set(null);
    this.entwurf.set(null);
    this.problem.set(null);
    this.bearbeitet.set(false);
    if (e) await this.bestand.oeffnen(e.id, true);
  }

  /** Der ungespeicherte Stand als Datei — er geht nicht verloren, auch wenn
   *  er hier nicht unterkommt (REQ-191). */
  protected herunterladen(): void {
    const e = this.zusammen()?.mine ?? this.entwurf();
    if (!e) return;
    const blob = new Blob([JSON.stringify(e, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(entityName(e) || e.id).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'article'}-unsaved.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private konfliktName(key: string): string {
    if (key === 'name') return 'Name';
    if (key === 'interfaces') return 'Type';
    if (key === 'adhoc') return 'Extra fields';
    const r = this.reg();
    if (key.startsWith('edge:')) {
      const id = key.slice(5);
      const kante = [...(this.zusammen()?.theirs.relations ?? []), ...(this.basis()?.relations ?? [])]
        .find((k) => k.id === id);
      return kante && r ? `Link · ${relationDef(r, kante.type).label}` : 'Link';
    }
    if (key.startsWith('card:')) {
      const t = key.slice(5);
      return r?.interfaces[t]?.label ?? t;
    }
    const f = this.felder().find((x) => x.ref === key);
    if (f) return f.label;
    const [t, k] = key.split('.');
    return `${(t && r?.interfaces[t]?.label) || t} · ${k}`;
  }

  private konfliktWert(v: unknown): string {
    if (v === undefined || v === null || v === '') return '(empty)';
    if (typeof v === 'boolean') return v ? 'yes' : 'no';
    if (v && typeof v === 'object' && 'type' in v && 'to' in v) {
      const k = v as { type: string; to: string };
      return `→ ${this.bestand.name()(k.to) ?? k.to}`;
    }
    const text = inEingabe(v);
    return text.length > 160 ? `${text.slice(0, 160)}…` : text;
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

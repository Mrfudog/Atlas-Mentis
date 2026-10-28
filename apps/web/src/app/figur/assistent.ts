import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  answerChoice,
  LAYER_RELATION,
  offeredOptions,
  choicesOf,
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
  choiceTitle,
  optionSlots,
  slotAccepts,
  slotQuery,
  type ItemSlot,
  choicesAtCharacter,
  canAddClass,
  changeClassLevel,
  classLevelRows,
  choiceDuplicates,
  duplicateText,
  heldBefore,
  heldValue,
  type HeldValue,
  chosenResult,
  enumOptions,
  gainedFeatures,
  pointBuyRange,
  pointBuySpent,
  pruneAnswers,
  setPick,
  type AbilityMethod,
  optionEffects,
  type BuilderStep,
  averageHitDie,
  hitPointLevels,
  hitPointProblem,
  maxHitPoints,
  setHitPointGain,
  type HitPointLevel,
  type HitPointRule,
  type Choice,
  type OptionEffects,
  type ChoiceAtCharacter,
  type Entity,
  type EquipmentMethod,
  type GoldRoll,
  type Purchase,
  type RolledScores,
  openDecisions,
} from '@nw/model';
import { Api, ApiError, type ListenZeile } from '../kern/api';
import { Bestand } from '../kern/bestand';
import { Session } from '../kern/session';
import { KurzLink } from '../kern/kurzansicht';
import { Text } from '../artikel/text';
import { ansichtWeg } from '../klassen/ansicht-weg';
import { EbenenMarke } from '../artikel/ebenen-marke';
import { Stapel } from '../kern/stapel';
import { mitnahmeLesen } from './mitnahme';

interface Moeglichkeit {
  /** Was in die Antwort kommt: Artikel-Id, Name oder Schlüssel. */
  wert: string;
  /** Kann `[[Verweise]]` tragen — gezeichnet mit `nw-text` (T-162). */
  label: string;
  hinweis?: string;
  /** Der Artikel dahinter, für die Kurzansicht (T-162). */
  id?: string;
  /** Die Grundart einer Spielart (`subraceOf`, T-193). */
  basis?: string;
}

/** Was eine Möglichkeit bringt, samt den Namen ihrer Merkmale (T-193). */
interface Wirkung {
  entity: Entity;
  effects: OptionEffects;
  namen: Record<string, string>;
}

type WahlSchritt = Extract<BuilderStep, { kind: 'choice' }>;

/** Der Entwurf am Server je Konto (T-193): wer einen Artikel öffnet, verliert nichts. */
const ENTWURF = 'characterDraft';
interface GespeicherterEntwurf {
  v: 1;
  at: string;
  relations: Entity['relations'];
  name: string;
  werte: Partial<Record<string, number>>;
  methode?: string;
  gruppe: string;
  eigenerWurf: RolledScores | null;
  ausrMethode?: string;
  goldWurf: (GoldRoll & { event: string }) | null;
  korb: Purchase[];
  index: number;
  spaeter: string[];
}

const ATTR = (a: string) => a.toUpperCase();

/** Eine offene Stelle einer gewählten Möglichkeit, mit ihrem Platz in `items` (T-162). */
interface Stelle {
  slot: ItemSlot;
  /** Ab welchem Eintrag von `chose.props.items` sie gilt. */
  ab: number;
  /** Schlüssel ihrer Auswahlliste. */
  liste: string;
}

/** Ein gewöhnlicher Gegenstand nach der Listenzeile — das Ganze prüft `slotAccepts`. */
const gewoehnlich = (z: ListenZeile) => {
  const r = String(z.cols?.['Item.rarity'] ?? '').toLowerCase();
  return !r || r === 'none' || r === 'mundane' || r === 'unknown';
};

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
 * Einen eigenen Stufenaufstieg gibt es nicht mehr (T-319): an einer
 * gespeicherten Figur (`/characters/:id/edit`) steigt sie im Klassen-Schritt
 * je Klasse, und was die neue Stufe fragt, sind Schritte wie jede Wahl.
 */
@Component({
  selector: 'nw-assistent',
  imports: [RouterLink, KurzLink, Text, NgTemplateOutlet, EbenenMarke],
  template: `
    <div class="buch">
      <nav aria-label="Breadcrumb" class="brot">
        <a routerLink="/world">World</a>
        <span aria-hidden="true">›</span>
        @if (gespeichert() && figur(); as f) {
          <a [routerLink]="['/artikel', f.id]">{{ name() || 'Character' }}</a>
          <span aria-hidden="true">›</span>
          <span>Edit</span>
        } @else {
          <span>New character</span>
        }
      </nav>
      <h1>{{ bearbeiten() ? 'Edit character' : 'New character' }}</h1>
      <!-- Die Ebene der Figur (T-251, T-299): an einer gespeicherten die Marke wie
           auf der Artikelseite, beim Anlegen die Ebene, in die sie kommt. -->
      @if (gespeichert() && figur(); as f) {
        <nw-ebenen-marke [artikel]="f" />
      } @else if (!gespeichert() && mitgebrachteEbene(); as l) {
        <p class="dim zielebene">Layer: <strong>{{ l }}</strong> — chosen under “New article”.</p>
      } @else if (!gespeichert() && stapel.schreib(); as w) {
        <p class="dim zielebene">Layer: <strong>{{ w.layer?.name ?? 'no layer' }}</strong> — change it under “Writes to” in the header.</p>
      }
      <!-- Creator oder Full edit (T-194): dieselbe Figur, zwei Masken. -->
      @if (bearbeiten() && figur(); as f) {
        <div class="umschalter" role="group" aria-label="Edit view">
          <span class="an" aria-current="true">Creator</span>
          <a [routerLink]="['/artikel', f.id]" [queryParams]="{ edit: 'full' }">Full edit</a>
        </div>
      }

      @if (ladefehler(); as f) {
        <p class="fehler" role="alert">{{ f }}</p>
      } @else if (!bereit()) {
        <p class="dim">Loading…</p>
      } @else {
        @if (wiederhergestellt()) {
          <p class="entwurf" role="status">
            Your draft from {{ wiederhergestellt() }} is back.
            <button type="button" class="leise" (click)="neuBeginnen()">Start over</button>
          </p>
        }
        <ol class="leiste" aria-label="Steps">
          @for (s of schritte(); track s.id; let i = $index) {
            <li>
              <button
                type="button"
                [class.jetzt]="i === index()"
                [class.erledigt]="erledigt(s)"
                [class.offen]="liegtOffen(s)"
                [attr.title]="liegtOffen(s) ? 'Left for later' : null"
                [attr.aria-current]="i === index() ? 'step' : null"
                [disabled]="i > erreichbar()"
                (click)="geheZu(i)"
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
                    <input class="suche" type="search" placeholder="Filter…" [value]="filterVon(s.id)" (input)="filtere(s.id, $any($event.target).value)" />
                  }
                  <!-- Spielarten unter ihrer Grundart (T-193), wie D&D Beyond: zugeklappt, bis man sie braucht. -->
                  <ul class="karten" role="radiogroup" [attr.aria-label]="titel(s)">
                    @for (g of gruppiert(s, liste); track g.m.wert) {
                      <li [class.gruppe]="g.varianten.length">
                        <ng-container *ngTemplateOutlet="karte; context: { $implicit: g.m, s: s }" />
                        @if (g.varianten.length) {
                          <button
                            type="button"
                            class="aufklapp"
                            [attr.aria-expanded]="gruppeOffen(s, g)"
                            (click)="schalteGruppe(g.m.wert)"
                          >
                            {{ gruppeOffen(s, g) ? '▾' : '▸' }} {{ g.varianten.length }} variant{{ g.varianten.length === 1 ? '' : 's' }}
                          </button>
                          @if (gruppeOffen(s, g)) {
                            <ul class="karten varianten-liste">
                              @for (v of g.varianten; track v.wert) {
                                <li><ng-container *ngTemplateOutlet="karte; context: { $implicit: v, s: s }" /></li>
                              }
                            </ul>
                          }
                        }
                      </li>
                    } @empty {
                      <li class="dim">Nothing ready to choose here yet.</li>
                    }
                  </ul>
                  @if (vergleichVon(s.id); as ids) {
                    <section class="vergleich" aria-label="Compare">
                      <h3>
                        Compare
                        <button type="button" class="leise" (click)="leereVergleich(s.id)">Clear</button>
                      </h3>
                      @if (ids.length < 2) {
                        <p class="dim">Tick “Compare” on up to four options to see them side by side.</p>
                      } @else {
                        <div class="vergleich-rahmen">
                          <table>
                            <thead>
                              <tr>
                                <th></th>
                                @for (id of ids; track id) {
                                  <th scope="col">{{ nameVon(wirkungen()[id]?.entity) || id }}</th>
                                }
                              </tr>
                            </thead>
                            <tbody>
                              @for (z of vergleichsZeilen(ids); track z.label) {
                                <tr>
                                  <th scope="row">{{ z.label }}</th>
                                  @for (w of z.werte; track $index) {
                                    <td>{{ w || '—' }}</td>
                                  }
                                </tr>
                              }
                            </tbody>
                          </table>
                        </div>
                      }
                    </section>
                  }
                  <!-- „Mehr dazu" (T-166): die gewählte Klasse, Herkunft oder der Hintergrund in seiner Ansicht. -->
                  @if (gewaehlt(s); as w) {
                    @if (['Class', 'Ancestry', 'Background'].includes(s.type)) {
                      <p class="mehrdazu">
                        <a [routerLink]="ansicht(s.type, w)" target="_blank">More about this {{ s.type === 'Class' ? 'class' : s.type.toLowerCase() }} ↗</a>
                      </p>
                    }
                  }
                  <!-- Stufen je Klasse (T-319): hier steigt die Figur, auch in einer
                       weiteren Klasse nach den Mehrklassen-Regeln; was eine Stufe fragt,
                       steht darunter als Wahl — kein eigener Level-up. -->
                  @if (s.type === 'Class' && gewaehlt(s)) {
                    <section class="stufen" aria-label="Class levels">
                      <h3>Levels <span class="dim">· character level {{ gesamtStufe() }}</span></h3>
                      <ul class="stufenliste">
                        @for (z of klassenStufen(); track z.id) {
                          <li>
                            <div class="stufenzeile">
                              <span class="name">{{ z.name }}</span>
                              <span class="zaehler">
                                <button type="button" [attr.aria-label]="'Lower ' + z.name" [disabled]="!z.canLower" (click)="stufe(z.id, -1)">−</button>
                                <output [attr.aria-label]="z.name + ' level'">{{ z.level }}</output>
                                <button type="button" [attr.aria-label]="'Raise ' + z.name" [disabled]="!z.canRaise" (click)="stufe(z.id, 1)">+</button>
                              </span>
                            </div>
                            @if (z.neu.length) {
                              <p class="dim">New at level {{ z.level }}: {{ z.neu.join(', ') }}</p>
                            }
                          </li>
                        }
                      </ul>
                      <details class="weitere" (toggle)="$any($event.target).open && ladeKlassenVoll()">
                        <summary>Add a class (multiclass)</summary>
                        <p class="dim">By the rules you need the minimum scores of every class you have and of the new one.</p>
                        <ul class="weitere-liste">
                          @for (k of weitereKlassen(); track k.id) {
                            <li>
                              <button type="button" class="leise" [disabled]="!!k.grund" (click)="stufe(k.id, 1)">+ {{ k.name }}</button>
                              @if (k.grund) {
                                <span class="dim">{{ k.grund }}</span>
                              }
                            </li>
                          } @empty {
                            <li class="dim">Loading…</li>
                          }
                        </ul>
                      </details>
                    </section>
                  }
                  <!-- Was die Wahl selbst fragt, steht gleich darunter (T-193): Barbar › Fertigkeiten. -->
                  @if (s.nested?.length) {
                    <div class="verschachtelt" id="wahl-verschachtelt">
                      @for (w of wahlSchritte(s.nested!); track w.id) {
                        <section class="unterwahl" [attr.data-offen]="fertigSchritt(w) ? null : ''" [attr.aria-label]="titel(w)">
                          <h3>{{ titel(w) }}</h3>
                          <ng-container *ngTemplateOutlet="wahlKoerper; context: { $implicit: w }" />
                        </section>
                      }
                    </div>
                  }
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
                } @else if (bearbeiten()) {
                  <!-- Am fertigen Charakter bleiben die Werte, bis ein Verfahren gewählt ist (T-194). -->
                  <table class="werte">
                    <thead>
                      <tr><th>Ability</th><th>Score</th><th>Bonus</th><th>Total</th></tr>
                    </thead>
                    <tbody>
                      @for (a of attribute(); track a) {
                        <tr>
                          <th scope="row">{{ a.toUpperCase() }}</th>
                          <td>{{ werte()[a] ?? '—' }}</td>
                          <td>{{ bonus()[a] ? '+' + bonus()[a] : '' }}</td>
                          <td>{{ werte()[a] !== undefined ? werte()[a]! + (bonus()[a] ?? 0) : '' }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                  <p class="dim">These are the current scores. Choose a method above to assign them anew.</p>
                }
              }

              @case ('hitpoints') {
                <p class="dim">
                  {{ tpRegelText() }} CON modifier {{ konMod() >= 0 ? '+' : '' }}{{ konMod() }} is added to every level.
                </p>
                <table class="werte tp">
                  <thead>
                    <tr><th>Level</th><th>Hit die</th><th>Gain</th><th></th></tr>
                  </thead>
                  <tbody>
                    @for (l of tpStufen(); track l.classId + ':' + l.level) {
                      <tr>
                        <th scope="row">{{ klassenName(l.classId) }} {{ l.level }}</th>
                        <td>{{ l.die ? 'd' + l.die : '—' }}</td>
                        <td>
                          @if (l.first) {
                            {{ l.die ?? '—' }} <span class="dim">(maximum)</span>
                          } @else if (tpRegel() === 'either') {
                            <input
                              type="number"
                              min="1"
                              [attr.max]="l.die ?? null"
                              [attr.aria-label]="'Hit points at ' + klassenName(l.classId) + ' level ' + l.level"
                              [value]="l.value || ''"
                              (change)="setzeTp(l, $any($event.target).value)"
                            />
                          } @else {
                            {{ l.value || '—' }}
                          }
                        </td>
                        <td>
                          @if (!l.first && l.die && tpRegel() !== 'average') {
                            @if (tpRegel() === 'either') {
                              <button type="button" class="leise" (click)="setzeTp(l, '' + durchschnitt(l.die))">Average {{ durchschnitt(l.die) }}</button>
                            }
                            @if (tpRegel() === 'either' || !l.value) {
                              <button type="button" [disabled]="wuerfelt()" (click)="wuerfleTp(l)">Roll d{{ l.die }}</button>
                            }
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
                <p class="wurf">
                  Hit point maximum: <strong>{{ tpMax() ?? '—' }}</strong>
                  @if (tpMax() !== null && altesMaxText(); as alt) {
                    <span class="dim"> — was {{ alt }}</span>
                  }
                </p>
                @if (tpProblem(); as p) {
                  <p class="dim">{{ p }}</p>
                }
              }

              @case ('choice') {
                <ng-container *ngTemplateOutlet="wahlKoerper; context: { $implicit: s }" />
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
                      <h3 class="wahlkopf">{{ wahlTitel(c) }}</h3>
                      <ul class="karten varianten" role="radiogroup" [attr.aria-label]="wahlTitel(c)">
                        @for (o of c.choice.from?.options ?? []; track o.key) {
                          <li>
                            <label [class.an]="(c.picks ?? []).includes(o.key)">
                              <input
                                type="radio"
                                [name]="'eq-' + c.source.entity.id + '-' + c.choice.id"
                                [checked]="(c.picks ?? []).includes(o.key)"
                                (change)="waehleVariante(c, o.key)"
                              />
                              <!-- Das Feste mit offener Stelle hat keinen Buchstaben (T-162). -->
                              <span class="variante">
                                @if ((c.choice.from?.options?.length ?? 0) > 1) {
                                  <span class="name">({{ o.key }})</span>{{ ' ' }}
                                }
                                <nw-text [text]="o.label" inline />
                              </span>
                            </label>
                            <!-- Die Folgewahl (T-162): „two martial weapons of your choice" -->
                            @if ((c.picks ?? []).includes(o.key)) {
                              @for (st of stellen(c, o); track st.ab) {
                                <div class="stelle">
                                  @if ((stellenListen()[st.liste]?.length ?? 0) > 12) {
                                    <input
                                      class="suche"
                                      type="search"
                                      placeholder="Filter…"
                                      [attr.aria-label]="'Filter ' + st.slot.text"
                                      [value]="stellenFilter()[st.liste] ?? ''"
                                      (input)="filtereStelle(st.liste, $any($event.target).value)"
                                    />
                                  }
                                  @for (p of reihe(st.slot.count); track p) {
                                    <div class="stellenwahl">
                                      @if (stellenListen()[st.liste]; as liste) {
                                        <select
                                          [attr.aria-label]="st.slot.text + (st.slot.count > 1 ? ' ' + (p + 1) : '')"
                                          (change)="fuelle(c, o.key, st.ab + p, $any($event.target).value)"
                                        >
                                          <option value="" [selected]="!stueck(c, st.ab + p)">— choose —</option>
                                          @for (z of gefiltertStelle(st.liste, liste, stueck(c, st.ab + p)); track z.id) {
                                            <option [value]="z.id" [selected]="z.id === stueck(c, st.ab + p)">{{ z.name }}</option>
                                          }
                                        </select>
                                        @if (stueck(c, st.ab + p); as id) {
                                          <button type="button" class="quick-info" [nwQuick]="id" [attr.aria-label]="'Quick view of ' + nameIn(liste, id)">i</button>
                                        }
                                        @if (!liste.length) {
                                          <span class="dim">Nothing ready to choose here yet.</span>
                                        }
                                      } @else {
                                        <span class="dim">Loading…</span>
                                      }
                                    </div>
                                  }
                                </div>
                              }
                            }
                          </li>
                        }
                      </ul>
                    }
                    @if (festes().length) {
                      <p>Also: @for (z of festes(); track $index) {<nw-text [text]="z" inline />@if (!$last) {<span>; </span>}}</p>
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
                <!-- Was sonst fehlte (T-194): Deckname, Gesinnung, Grösse, Aussehen. -->
                <label class="zeile">
                  <span>Cover name</span>
                  <input type="text" [value]="deckname()" (input)="deckname.set($any($event.target).value)" />
                </label>
                <label class="zeile">
                  <span>Alignment</span>
                  <input type="text" list="nw-gesinnungen" [value]="gesinnung()" (input)="gesinnung.set($any($event.target).value)" />
                  <datalist id="nw-gesinnungen">
                    @for (g of gesinnungen; track g) {
                      <option [value]="g"></option>
                    }
                  </datalist>
                </label>
                @if (groessen().length > 1) {
                  <label class="zeile">
                    <span>Size</span>
                    <select [value]="groesse()" (change)="groesse.set($any($event.target).value)">
                      <option value="">—</option>
                      @for (g of groessen(); track g) {
                        <option [value]="g" [selected]="g === groesse()">{{ g }}</option>
                      }
                    </select>
                  </label>
                } @else if (groessen().length === 1) {
                  <p class="zeile"><span>Size</span> {{ groessen()[0] }}</p>
                }
                <label class="zeile">
                  <span>Appearance</span>
                  <textarea rows="3" [value]="aussehen()" (input)="aussehen.set($any($event.target).value)"></textarea>
                </label>
                @if (gruppen().length && !gespeichert()) {
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
                <p class="dim">Image, backstory and the rest follow on the character's page — or under Full edit.</p>
                @if (offenGelassen().length) {
                  <p class="dim">Left for later: {{ offenGelassen().join('; ') }}@if (bleibtIdee()) {<span>. Until every choice is made, the character stays an idea.</span>}</p>
                }
              }
            }

            @if (problem(); as f) {
              <p class="fehler" role="alert">{{ f }}</p>
            }
            <!-- Ein Schritt, der nicht fertig ist (T-193): bleiben oder auf später legen. -->
            @if (warnung(); as w) {
              <div class="warnung" role="alertdialog" aria-label="Step not finished">
                <p>{{ w }}</p>
                <button type="button" (click)="bleiben()">Stay</button>
                <button type="button" class="pri" (click)="spaeterSchritt(s)">Decide later</button>
              </div>
            }
            <div class="knoepfe">
              <button type="button" [disabled]="index() === 0" (click)="zurueck()">Back</button>
              @if (s.kind === 'choice') {
                <button type="button" (click)="spaeter(s)">Decide later</button>
              }
              @if (letzter()) {
                <button type="button" class="pri" [disabled]="!fertigSchritt(s) || speichert()" (click)="speichern()">
                  {{ speichert() ? 'Saving…' : bearbeiten() ? 'Save' : 'Create character' }}
                </button>
              } @else {
                <button type="button" class="pri" (click)="weiterPruefen(s)">Next</button>
              }
            </div>
          </section>
        }
      }
    </div>

    <!-- Eine Karte einer Grundwahl, mit Auswirkungen und Vergleich (T-193). -->
    <ng-template #karte let-m let-s="s">
      <div class="karte" [class.an]="gewaehlt(s) === m.wert">
        <label>
          <input type="radio" [name]="s.id" [checked]="gewaehlt(s) === m.wert" (change)="waehle(s, m.wert)" />
          <span class="name">{{ m.label }}</span>
          @if (m.hinweis) {
            <span class="dim">{{ m.hinweis }}</span>
          }
        </label>
        <button type="button" class="quick-info" [nwQuick]="m.wert" [attr.aria-label]="'Quick view of ' + m.label">i</button>
        <div class="kartenfuss">
          <button type="button" class="leise" [attr.aria-expanded]="aufgeklappt().has(m.wert)" (click)="klappe(m.wert)">
            {{ aufgeklappt().has(m.wert) ? '▾' : '▸' }} Effects
          </button>
          <label class="vergleichen">
            <input
              type="checkbox"
              [checked]="(vergleichVon(s.id) ?? []).includes(m.wert)"
              [disabled]="!(vergleichVon(s.id) ?? []).includes(m.wert) && (vergleichVon(s.id)?.length ?? 0) >= 4"
              (change)="vergleiche(s.id, m.wert)"
            />
            Compare
          </label>
        </div>
        @if (aufgeklappt().has(m.wert)) {
          @if (wirkungen()[m.wert]; as w) {
            <dl class="wirkung">
              @for (z of wirkungsZeilen(w); track z.label) {
                <dt>{{ z.label }}</dt>
                <dd>{{ z.wert }}</dd>
              }
              @if (w.effects.features.length) {
                <dt>Features</dt>
                <dd>
                  @for (f of w.effects.features; track f.id) {
                    <a [routerLink]="['/artikel', f.id]" [nwQuick]="f.id">{{ w.namen[f.id] || 'feature' }}</a>@if (!$last) {<span>, </span>}
                  }
                </dd>
              }
              @if (w.effects.choices.length) {
                <dt>You choose</dt>
                <dd>
                  @for (c of w.effects.choices; track c.by + c.choice.id) {
                    <nw-text [text]="wahlText(c.choice)" inline />@if (!$last) {<span>; </span>}
                  }
                </dd>
              }
              @if (w.effects.line.length > 1) {
                <dd class="dim herkunft">Includes {{ grundarten(w) }}.</dd>
              }
            </dl>
          } @else {
            <p class="dim">Loading…</p>
          }
        }
      </div>
    </ng-template>

    <!-- Eine Wahl — als Schritt oder in der Grundwahl, die sie stellt (T-193). -->
    <ng-template #wahlKoerper let-s>
      <p><nw-text [text]="wahlsatz(s.at)" inline /><span class="dim">&nbsp;— from {{ herkunft(s.at) }}</span></p>
                @if (moeglichkeiten()[s.id]; as liste) {
                  @if (liste.length) {
                    @if (liste.length > 8) {
                      <input class="suche" type="search" placeholder="Filter…" [value]="filterVon(s.id)" (input)="filtere(s.id, $any($event.target).value)" />
                    }
                    <p class="dim">{{ antwort(s).length }} of {{ s.at.choice.count ?? 1 }} chosen</p>
                    <!-- Was ein früherer Schritt schon gibt, ist hier gesperrt; eine
                         spätere Doppelung wird gemeldet, nicht geleert (T-299). -->
                    @for (d of doppelt(s); track d) {
                      <p class="fehler" role="alert">{{ d }}</p>
                    }
                    @if (s.at.choice.repeat) {
                      <!-- Derselbe Wert mehrmals (T-107): +1 zweimal auf dasselbe ist +2. -->
                      <ul class="karten">
                        @for (m of gefiltert(liste, s.id); track m.wert) {
                          <li>
                            <div class="mehrfach" [class.an]="anzahl(s, m.wert) > 0">
                              <span class="name"><nw-text [text]="m.label" inline /></span>
                              @if (m.hinweis) {
                                <span class="dim">{{ m.hinweis }}</span>
                              }
                              <span class="zaehler">
                                <button type="button" [attr.aria-label]="'Less ' + m.label" [disabled]="!anzahl(s, m.wert)" (click)="weniger(s, m.wert)">−</button>
                                <output [attr.aria-label]="m.label + ' chosen'">{{ anzahl(s, m.wert) }}</output>
                                <button
                                  type="button"
                                  [attr.aria-label]="'More ' + m.label"
                                  [disabled]="antwort(s).length >= (s.at.choice.count ?? 1)"
                                  (click)="mehr(s, m.wert)"
                                >
                                  +
                                </button>
                              </span>
                            </div>
                          </li>
                        }
                      </ul>
                    } @else {
                    <ul class="karten">
                      @for (m of gefiltert(liste, s.id); track m.wert) {
                        <li>
                          @let da = schonDa(s, m.wert, m.label);
                          <label [class.an]="antwort(s).includes(m.wert)" [class.gesperrt]="!!da && !antwort(s).includes(m.wert)" [class.doppelt]="!!da && antwort(s).includes(m.wert)">
                            <input
                              [type]="(s.at.choice.count ?? 1) > 1 ? 'checkbox' : 'radio'"
                              [name]="s.id"
                              [checked]="antwort(s).includes(m.wert)"
                              [disabled]="!antwort(s).includes(m.wert) && (!!da || ((s.at.choice.count ?? 1) > 1 && antwort(s).length >= (s.at.choice.count ?? 1)))"
                              (change)="kreuze(s, m.wert)"
                            />
                            <span class="name"><nw-text [text]="m.label" inline /></span>
                            @if (da) {
                              <span class="dim woher">from {{ da.from }}</span>
                            } @else if (m.hinweis) {
                              <span class="dim">{{ m.hinweis }}</span>
                            }
                          </label>
                          @if (m.id) {
                            <button type="button" class="quick-info" [nwQuick]="m.id" [attr.aria-label]="'Quick view of ' + m.label">i</button>
                          }
                        </li>
                      }
                    </ul>
                    }
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
    </ng-template>
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
    /* Schon da (T-299): gesperrt mit Herkunft, gewählt und doppelt rot umrandet. */
    .karten label.gesperrt {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .karten label.doppelt {
      border-color: var(--warn);
    }
    /* Der Info-Knopf sitzt in der Karte oben rechts (T-162): der Name
       setzt das Häkchen, der Knopf zeigt den Artikel. */
    .karten > li {
      position: relative;
    }
    .karten > li > .quick-info {
      position: absolute;
      top: 0.55rem;
      right: 0.55rem;
    }
    .karten > li:has(> .quick-info) > label {
      padding-right: 2.6rem;
    }
    .varianten {
      grid-template-columns: 1fr;
    }
    /* Die Karte einer Grundwahl (T-193): Name, Info, Auswirkungen, Vergleich. */
    .karte {
      position: relative;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--surface);
    }
    .karte.an {
      border-color: var(--accent);
      background: var(--hover);
    }
    .karten .karte > label {
      border: 0;
      background: none;
      padding-right: 2.6rem;
    }
    .karte > .quick-info {
      position: absolute;
      top: 0.55rem;
      right: 0.55rem;
    }
    .kartenfuss {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 0.4rem;
      padding: 0 0.75rem 0.4rem;
      font-size: 0.85rem;
    }
    .karten .kartenfuss label.vergleichen {
      min-height: 32px;
      padding: 0;
      border: 0;
      background: none;
      gap: 0.3rem;
      align-items: center;
    }
    button.leise {
      min-height: 32px;
      padding: 0 0.4rem;
      border: 0;
      background: none;
      color: var(--accent);
      font-size: 0.85rem;
      cursor: pointer;
    }
    .wirkung {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: 0.15rem 0.6rem;
      margin: 0;
      padding: 0.2rem 0.75rem 0.6rem;
      font-size: 0.88rem;
    }
    .wirkung dt {
      color: var(--dim);
    }
    .wirkung dd {
      margin: 0;
    }
    .wirkung .herkunft {
      grid-column: 1 / -1;
    }
    /* Eine Grundart mit Spielarten nimmt die ganze Breite, damit die Spielarten darunter Platz haben. */
    .karten > li.gruppe {
      grid-column: 1 / -1;
    }
    .aufklapp {
      min-height: 32px;
      margin: 0.25rem 0 0;
      padding: 0 0.5rem;
      border: 0;
      background: none;
      color: var(--accent);
      cursor: pointer;
    }
    .varianten-liste {
      margin: 0.25rem 0 0.5rem 1.2rem;
    }
    .vergleich {
      margin: 1rem 0;
    }
    .vergleich h3 {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .vergleich-rahmen {
      overflow-x: auto;
    }
    .vergleich table {
      border-collapse: collapse;
      font-size: 0.88rem;
      min-width: 100%;
    }
    .vergleich th,
    .vergleich td {
      padding: 0.3rem 0.5rem;
      border-bottom: 1px solid var(--line);
      text-align: left;
      vertical-align: top;
    }
    .vergleich thead th {
      font-family: var(--caps);
      color: var(--heading);
    }
    .verschachtelt {
      margin-top: 1rem;
      display: grid;
      gap: 0.75rem;
    }
    .unterwahl {
      border-left: 3px solid var(--gold);
      padding-left: 0.75rem;
    }
    .unterwahl h3 {
      margin-top: 0;
    }
    .warnung {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
      margin-top: 1rem;
      padding: 0.6rem 0.8rem;
      border: 1px solid var(--warn);
      border-radius: 6px;
      background: var(--surface);
    }
    .warnung p {
      flex: 1 1 14rem;
      margin: 0;
    }
    .warnung button {
      min-height: 44px;
      padding: 0 1rem;
    }
    .leiste button.offen {
      border-style: dashed;
      border-color: var(--warn);
    }
    .entwurf {
      margin: 0 0 0.75rem;
    }
    .varianten label {
      flex-wrap: nowrap;
    }
    .wahlkopf {
      margin: 1rem 0 0.25rem;
      font-size: 1rem;
    }
    /* Die Folgewahl unter der gewählten Möglichkeit. */
    .stelle {
      display: grid;
      gap: 0.35rem;
      margin: 0.4rem 0 0 1.6rem;
    }
    .stellenwahl {
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }
    .stellenwahl select {
      flex: 1;
      min-width: 0;
      max-width: 24rem;
      min-height: 40px;
    }
    .karten .mehrfach {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.4rem;
      min-height: 44px;
      padding: 0.35rem 0.5rem 0.35rem 0.75rem;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--surface);
    }
    .karten .mehrfach.an {
      border-color: var(--accent);
      background: var(--hover);
    }
    /* Stufen je Klasse (T-319). */
    .stufen {
      margin: 1rem 0;
      padding: 0.75rem;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--surface);
    }
    .stufen h3 {
      margin-top: 0;
    }
    .stufenliste,
    .weitere-liste {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .stufenliste > li + li {
      border-top: 1px solid var(--line);
      margin-top: 0.4rem;
      padding-top: 0.4rem;
    }
    .stufenzeile {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .weitere {
      margin-top: 0.75rem;
    }
    .weitere-liste li {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0.4rem;
      min-height: 36px;
    }
    .zaehler {
      margin-left: auto;
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
    }
    .zaehler button {
      min-width: 36px;
      min-height: 36px;
    }
    .zaehler output {
      min-width: 1.2rem;
      text-align: center;
      font-weight: 700;
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
  protected readonly stapel = inject(Stapel);

  /** Die gespeicherte Figur, wie sie vor dem Bearbeiten war. */
  protected readonly figur = signal<Entity | null>(null);
  /** Am fertigen Charakter (T-194): Edit ist der Assistent, mit allen Schritten. */
  protected readonly bearbeiten = computed(() => this.route.snapshot.data['mode'] === 'edit');
  /** Eine gespeicherte Figur, im Assistenten bearbeitet. */
  protected readonly gespeichert = computed(() => !!this.route.snapshot.paramMap.get('id'));
  protected readonly entwurf = signal<Entity>(LEER);
  /** Die Artikel, die der Entwurf nennt, ganz — daraus kommen die Wahlen. */
  private readonly quellen = signal<ReadonlyMap<string, Entity>>(new Map());
  private readonly gefragt = new Set<string>();
  protected readonly index = signal(0);
  /** Der Filter je Liste — eine Wahl in der Klassenwahl hat ihren eigenen (T-193). */
  private readonly filterJe = signal<Record<string, string>>({});
  protected readonly problem = signal<string | null>(null);
  protected readonly ladefehler = signal<string | null>(null);
  protected readonly speichert = signal(false);
  protected readonly wuerfelt = signal(false);
  protected readonly name = signal('');
  /** Welche Wahlen und Schritte jemand ausdrücklich auf später gelegt hat. */
  protected readonly spaeterGelegt = signal<ReadonlySet<string>>(new Set());
  /** Die Warnung vor einem unfertigen Schritt (T-193). */
  protected readonly warnung = signal<string | null>(null);

  /** Auswirkungen je Möglichkeit, geholt beim Aufklappen oder Vergleichen (T-193). */
  protected readonly wirkungen = signal<Partial<Record<string, Wirkung>>>({});
  private readonly wirkungGefragt = new Set<string>();
  protected readonly aufgeklappt = signal<ReadonlySet<string>>(new Set());
  /** Was nebeneinandersteht — je Schritt, eine Herkunft neben einer Klasse sagt nichts. */
  protected readonly vergleich = signal<Partial<Record<string, string[]>>>({});
  private readonly offeneGruppen = signal<ReadonlySet<string>>(new Set());

  /** Wann der Entwurf zurückkam — für den Hinweis mit „Start over". */
  protected readonly wiederhergestellt = signal<string | null>(null);
  /** Erst nach dem Wiederherstellen wird gespeichert, sonst überschriebe der leere Anfang den Entwurf. */
  private readonly entwurfGeladen = signal(false);
  private entwurfFertig = false;
  private speicherUhr: ReturnType<typeof setTimeout> | undefined;

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
  /** Talente am Tisch (T-107): nein nimmt das Talent als Ausweg weg. */
  private readonly talente = signal(true);
  private readonly geladenVerfahren = signal(false);

  /**
   * **Was „New article" mitgibt** (T-095, Prüfung 20.10.): Name, Ebene und
   * Pflichtfelder aus der Adresse (`name`, `layer`, `f.<Typ.feld>`). Sie
   * stehen im Entwurf, als hätte man sie hier eingetragen — nichts wird
   * doppelt gefragt.
   */
  private readonly mitgebracht = mitnahmeLesen(this.route.snapshot.queryParamMap);
  /** Der Name der mitgebrachten Ebene, wenn sie von der Schreibebene abweicht. */
  protected readonly mitgebrachteEbene = computed(() => {
    const id = this.mitgebracht.layer;
    if (!id || id === this.stapel.schreib()?.layer?.id) return '';
    return this.stapel.schreib()?.options.find((o) => o.id === id)?.name ?? id;
  });

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
  /** Mit Verweisen — gezeichnet von `nw-text` (T-162). */
  protected readonly festes = computed(() => fixedEquipmentLines(this.entwurf(), this.quellen()).map((z) => z.raw));

  protected readonly bereit = computed(
    () => !!this.bestand.registry() && this.geladenVerfahren() && (!this.gespeichert() || (!!this.figur() && this.statblockGeladen())),
  );

  protected readonly schritte = computed<BuilderStep[]>(() =>
    builderSteps(this.entwurf(), this.quellen(), {
      edit: this.bearbeiten(),
      rules: { feats: this.talente() },
      nest: true,
    }),
  );
  protected readonly schritt = computed(() => this.schritte()[Math.min(this.index(), this.schritte().length - 1)]);
  protected readonly letzter = computed(() => this.index() >= this.schritte().length - 1);
  /** Bis wohin man springen darf: bis zum ersten Schritt, der noch fehlt. */
  protected readonly erreichbar = computed(() => {
    const l = this.schritte();
    const i = l.findIndex((s) => !this.fertigSchritt(s) && !this.spaeterGelegt().has(s.id));
    return i < 0 ? l.length - 1 : i;
  });

  protected readonly attribute = computed(
    () => enumOptions(this.bestand.registry() ?? { enums: {}, interfaces: {} }, { enumRef: 'Ability' }) ?? [],
  );
  protected readonly bonus = computed<Partial<Record<string, number>>>(() => chosenResult(this.entwurf(), this.quellen()).abilityBonus);

  // ---------------------------------------------------------- Trefferpunkte (T-194)

  /** Der Statblock einer gespeicherten Figur — dort steht das Maximum. */
  private readonly statblock = signal<Entity | null>(null);
  private readonly statblockGeladen = signal(false);
  protected readonly tpRegel = signal<HitPointRule>('either');
  /** KON mit Bonus aus Abstammung und Wahlen. */
  protected readonly kon = computed(() => {
    const w = this.werte()['con'];
    return w === undefined ? undefined : w + (this.bonus()['con'] ?? 0);
  });
  protected readonly konMod = computed(() => {
    const k = this.kon();
    return k === undefined ? 0 : Math.floor((k - 10) / 2);
  });
  /** Das Maximum, wie es am Statblock steht. */
  private readonly altesMax = computed(() => {
    const n = this.statblock()?.components?.['Statblock']?.['hp'];
    return typeof n === 'number' ? n : undefined;
  });
  /**
   * **Eine Figur von vor T-194**: keine Stufe trägt einen Wert, am
   * Statblock steht aber ein Maximum. Steigt sie (T-319), zählen nur die
   * neuen Stufen, auf das alte Maximum — sonst würfelte sie ihre ganze
   * Laufbahn neu.
   */
  private readonly ohneStufenwerte = computed(() => {
    const f = this.figur();
    return !!f && this.altesMax() !== undefined && !(f.relations ?? []).some((r) => r.type === 'hasClass' && Array.isArray(r.props?.['hp']));
  });
  protected readonly tpAlle = computed(() => hitPointLevels(this.entwurf(), this.quellen()));
  /** Die Stufen, nach denen der Schritt fragt — bei einer Figur von vor T-194 nur die neuen. */
  protected readonly tpStufen = computed<HitPointLevel[]>(() => {
    const alle = this.tpAlle();
    if (!this.ohneStufenwerte()) return alle;
    const gespeichert = new Map((this.figur()?.relations ?? []).filter((r) => r.type === 'hasClass').map((r) => [r.to, Number(r.props?.['level']) || 1] as const));
    return alle.filter((l) => l.level > (gespeichert.get(l.classId) ?? 0));
  });
  protected readonly tpProblem = computed(() => hitPointProblem(this.tpStufen(), this.tpRegel()));
  /** Das neue Maximum; `null`, solange eine Stufe offen ist. */
  protected readonly tpMax = computed<number | null>(() => {
    if (this.ohneStufenwerte()) {
      const neu = this.tpStufen();
      if (neu.some((l) => !l.value)) return null;
      return this.altesMax()! + neu.reduce((n, l) => n + Math.max(1, l.value! + this.konMod()), 0);
    }
    return maxHitPoints(this.tpAlle(), this.kon());
  });
  protected readonly durchschnitt = averageHitDie;
  protected tpRegelText(): string {
    const r = this.tpRegel();
    return r === 'average' ? 'This campaign takes the average of each hit die.' : r === 'roll' ? 'This campaign rolls each hit die.' : 'Roll each hit die or take its average.';
  }
  protected altesMaxText(): string | null {
    const a = this.altesMax();
    return a !== undefined && a !== this.tpMax() ? String(a) : null;
  }
  protected readonly gesinnungen = ['Lawful good', 'Neutral good', 'Chaotic good', 'Lawful neutral', 'Neutral', 'Chaotic neutral', 'Lawful evil', 'Neutral evil', 'Chaotic evil', 'Unaligned'];
  protected klassenName(id: string): string {
    const k = this.quellen().get(id);
    return (k ? entityName(k) : '') || this.bestand.name()(id) || id;
  }
  protected setzeTp(l: HitPointLevel, roh: string): void {
    const n = roh === '' ? null : Math.round(Number(roh));
    this.entwurf.update((d) => setHitPointGain(d, l.classId, l.level, n !== null && Number.isFinite(n) ? n : null));
  }
  /** Gewürfelt wird am Server, und der Wurf steht im Protokoll (T-172). */
  protected async wuerfleTp(l: HitPointLevel): Promise<void> {
    if (!l.die) return;
    this.wuerfelt.set(true);
    this.problem.set(null);
    try {
      const f = this.figur();
      const r = await this.api.roll({
        expr: `1d${l.die}`,
        ...(f ? { subject: f.id } : {}),
        label: `Hit points: ${this.klassenName(l.classId)} level ${l.level}`,
      });
      this.entwurf.update((d) => setHitPointGain(d, l.classId, l.level, r.total));
    } catch (e) {
      this.problem.set((e as Error).message);
    } finally {
      this.wuerfelt.set(false);
    }
  }

  // ---------------------------------------------------------- Angaben (T-194)

  protected readonly deckname = signal('');
  protected readonly gesinnung = signal('');
  protected readonly groesse = signal('');
  protected readonly aussehen = signal('');
  /** Die Grössen, die die Abstammung erlaubt (`Ancestry.size`). */
  protected readonly groessen = computed(() => {
    const a = this.entwurf().relations?.find((r) => r.type === 'hasAncestry')?.to;
    return a ? (optionEffects(a, this.quellen())?.size ?? []) : [];
  });

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
    /* Am fertigen Charakter bleiben die Werte, bis jemand ein Verfahren wählt (T-194). */
    if (!m && this.bearbeiten() && this.attribute().every((a) => this.werte()[a] !== undefined)) return null;
    if (!m) return 'Choose a method.';
    return assignmentProblem(this.werte(), this.attribute(), m, this.vorrat()?.values);
  });

  /** Ein offener Entscheid hält die neue Figur auf idea (T-436, E-176). */
  protected readonly bleibtIdee = computed(() => openDecisions(this.entwurf(), this.quellen()).length > 0);

  /** Was beim Speichern noch offen bleibt — es bleibt an der Figur offen (`pendingChoices`). */
  protected readonly offenGelassen = computed(() => [
    ...this.schritte()
      .flatMap((s): ChoiceAtCharacter[] => (s.kind === 'choice' ? [s.at] : s.kind === 'pick' ? (s.nested ?? []) : []))
      .filter((c) => !c.picks)
      .map((c) => `${choiceTitle(c)}: ${plainEquipmentText(choiceText(c.choice))}`),
    ...this.schritte()
      .filter((s) => s.kind !== 'choice' && this.liegtOffen(s))
      .map((s) => this.titel(s)),
  ]);

  /** Die Auswahllisten der offenen Stellen (T-162), je Sorte einmal geladen. */
  protected readonly stellenListen = signal<Partial<Record<string, { id: string; name: string }[]>>>({});
  protected readonly stellenFilter = signal<Partial<Record<string, string>>>({});
  private readonly stellenGefragt = new Set<string>();

  constructor() {
    void this.bestand.load();
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.api
        .entity(id)
        .then((e) => {
          const { refs, ...f } = e;
          /* Die Namen der Bezüge — darunter die Ebene für die Marke (T-299). */
          if (refs) this.bestand.bezuegeAufnehmen(refs);
          this.figur.set(f);
          this.entwurf.set(f);
          /* Der Name steht in `Identity` (`entityName`); `name` kann leer sein. */
          this.name.set(entityName(f));
          const c = f.components ?? {};
          this.deckname.set(String(c['Identity']?.['cover'] ?? ''));
          const aus = c['Creature']?.['appearance'];
          this.aussehen.set(String((Array.isArray(aus) ? aus[0] : aus) ?? ''));
        })
        .catch((e: Error) => this.ladefehler.set(e.message));
      /* Die Zahlen der Figur wohnen am Statblock (`belongsTo`): KON für die
         Trefferpunkte, die Werte beim Bearbeiten (T-194). */
      this.api
        .backlinks(id)
        .then(async (l) => {
          /* Die Rückfrage bringt den Artikel nur kurz; die Werte holt der ganze. */
          const kurz = l.find((b) => b.relation.type === 'belongsTo' && b.from.interfaces?.includes('Statblock'))?.from;
          const sb = kurz ? await this.api.entity(kurz.id) : null;
          this.statblock.set(sb);
          const ab = sb?.components?.['Abilities'] ?? {};
          this.werte.set(Object.fromEntries(Object.entries(ab).filter(([, v]) => typeof v === 'number')) as Record<string, number>);
          const st = sb?.components?.['Statblock'] ?? {};
          this.gesinnung.set(String(st['alignment'] ?? ''));
          this.groesse.set(String(st['size'] ?? ''));
        })
        .catch(() => this.statblock.set(null))
        .finally(() => this.statblockGeladen.set(true));
    }
    const verfahren = this.api
      .abilities()
      .then((r) => {
        this.methoden.set(r.methods);
        this.gruppen.set(r.parties);
        this.sprachen.set(r.languages ?? []);
        this.talente.set(r.feats !== false);
        this.tpRegel.set(r.hitPoints ?? 'either');
        if (r.methods.length === 1) this.methode.set(r.methods[0]!);
        if (r.parties.length === 1) this.gruppe.set(r.parties[0]!.id);
      })
      .catch((e: Error) => this.ladefehler.set(e.message))
      .finally(() => this.geladenVerfahren.set(true));
    /* Beim Aufstieg gibt es keine Startausrüstung. */
    if (!id) {
      const ausr = this.api
        .equipmentMethods()
        .then((r) => {
          this.ausrMethoden.set(r.methods);
          if (r.methods.length === 1) this.ausrMethode.set(r.methods[0]!);
        })
        .catch((e: Error) => this.ladefehler.set(e.message));
      /* Der Entwurf vom letzten Mal (T-193), sobald die Verfahren da sind, die er nennt. */
      void Promise.all([this.api.prefs().catch(() => ({}) as Record<string, unknown>), verfahren, ausr]).then(([p]) => {
        this.stelleWiederHer(p[ENTWURF]);
        this.uebernimm();
        this.entwurfGeladen.set(true);
      });

      /* Gemerkt wird am Server, kurz nach der letzten Änderung. */
      effect(() => {
        const d = this.entwurfZumSpeichern();
        if (!this.entwurfGeladen() || this.entwurfFertig) return;
        clearTimeout(this.speicherUhr);
        this.speicherUhr = setTimeout(() => {
          if (!this.entwurfFertig) void this.api.setPref(ENTWURF, d).catch(() => undefined);
        }, 800);
      });
    }

    /* Nimmt die Kampagne den Durchschnitt (T-194), steht er gleich da. */
    effect(() => {
      if (this.tpRegel() !== 'average') return;
      const offen = this.tpStufen().filter((l) => !l.first && l.die !== undefined && l.value !== averageHitDie(l.die));
      if (!offen.length) return;
      untracked(() => this.entwurf.update((d) => offen.reduce((x, l) => setHitPointGain(x, l.classId, l.level, averageHitDie(l.die!)), d)));
    });

    /* Ein anderer Schritt nimmt die Warnung des alten mit. */
    effect(() => {
      this.index();
      untracked(() => this.warnung.set(null));
    });

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
      /* Die Grundart einer Unterart fragt mit (T-193, `ancestryLine`). */
      for (const x of q.values()) for (const r of x.relations ?? []) if (r.type === 'grants' || r.type === 'subraceOf') ids.add(r.to);
      const fehlt = [...ids].filter((i) => !q.has(i) && !this.gefragt.has(i));
      if (!fehlt.length) return;
      for (const i of fehlt) this.gefragt.add(i);
      untracked(() => void this.lade(fehlt));
    });

    /* Die Auswahllisten der offenen Stellen, sobald eine Möglichkeit sie
       verlangt — nicht aus der Vorlage heraus, die beim Zeichnen nichts
       schreiben darf (T-162). */
    effect(() => {
      const s = this.schritt();
      if (s?.kind !== 'equipment' || this.ausrMethode()?.method !== 'rules') return;
      const offen = s.choices.flatMap((c) =>
        (c.choice.from?.options ?? []).filter((o) => c.picks?.includes(o.key)).flatMap((o) => this.stellen(c, o)),
      );
      untracked(() => {
        for (const st of offen) void this.ladeStelle(st);
      });
    });

    /* Die Möglichkeiten des Schritts, der gerade dran ist. */
    effect(() => {
      const s = this.schritt();
      if (!s) return;
      untracked(() => {
        this.problem.set(null);
        if (s.kind === 'pick') void this.ladeKandidaten(s.type);
        if (s.kind === 'choice') void this.ladeMoeglichkeiten(s);
        /* Die Wahlen in der Grundwahl laden wie ein eigener Schritt (T-193). */
        if (s.kind === 'pick') for (const w of this.wahlSchritte(s.nested ?? [])) void this.ladeMoeglichkeiten(w);
        /* Die Verweisziele in Möglichkeiten und Sätzen (`refs.links`) kommen
           mit dem Artikel — `nw-text` liest sie aus dem Bestand (T-162). */
        const quellen = s.kind === 'choice' ? [s.at] : s.kind === 'equipment' ? s.choices : s.kind === 'pick' ? (s.nested ?? []) : [];
        for (const c of quellen) void this.bestand.oeffnen(c.source.entity.id, false, false);
        if (s.kind === 'equipment') for (const z of fixedEquipmentLines(this.entwurf(), this.quellen())) void this.bestand.oeffnen(z.source, false, false);
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

  /**
   * **Mit Filter** (`ChoiceFrom.where`, T-162): eine Art allein fragt die
   * Liste mit dem Feldfilter (`f=Typ.feld:Wert`) — der Kampfstil zog sonst
   * aus jedem Merkmal, das Werkzeug aus jedem Gegenstand. Der Filter
   * **schlägt vor** wie `LinkTarget.where`: findet er nichts, gilt die
   * ganze Art. Bei Gegenständen nur gewöhnliche.
   */
  private async zeilenMitFilter(arten: string[], where: { component: string; property: string; value?: unknown } | undefined, rel?: string): Promise<ListenZeile[]> {
    const werte = where ? (Array.isArray(where.value) ? where.value : where.value !== undefined ? [where.value] : []).map(String) : [];
    if (arten.length === 1 && werte.length) {
      const r = await this.api.list({ type: arten[0], f: [`${where!.component}.${where!.property}:${werte.join('|')}`], limit: 200, sort: 'name', ...(rel ? { rel: [rel] } : {}) });
      const rows = r.rows.filter(fertig).filter(gewoehnlich);
      if (rows.length) return rows;
    }
    return this.zeilen(arten, rel);
  }

  /** Die offenen Stellen einer gewählten Möglichkeit, mit ihrem Platz in `items`. */
  protected stellen(c: ChoiceAtCharacter, o: { key: string; label: string }): Stelle[] {
    let ab = 0;
    return optionSlots(o).map((slot) => {
      const st: Stelle = { slot, ab, liste: JSON.stringify([slotQuery(slot), slot.itemTypes ?? []]) };
      ab += slot.count;
      return st;
    });
  }

  /**
   * Die Gegenstände, die eine Stelle nimmt: die Liste fragt nach Art und
   * Spalte (`slotQuery`), gewöhnlich und fertig; was die Spalte nicht sagt
   * (Nah- oder Fernkampf), prüft `slotAccepts` am ganzen Artikel — dieselbe
   * Regel, mit der der Server beim Ausrüsten prüft. Vorgeschlagen wird nur
   * Kaufbares, solange es das gibt; der Server nimmt auch anderes, das die
   * Stelle annimmt.
   */
  private async ladeStelle(st: Stelle): Promise<void> {
    if (this.stellenGefragt.has(st.liste)) return;
    this.stellenGefragt.add(st.liste);
    try {
      const q = slotQuery(st.slot);
      const r = await this.api.list({ type: q.type, f: q.f, limit: 200, sort: 'name' });
      let rows = r.rows.filter(fertig).filter(gewoehnlich);
      const ganz = new Map<string, Entity>();
      for (let i = 0; i < rows.length; i += 200) for (const e of await this.api.entitiesById(rows.slice(i, i + 200).map((z) => z.id))) ganz.set(e.id, e);
      rows = rows.filter((z) => slotAccepts(st.slot, ganz.get(z.id)));
      /* Vorgeschlagen wird, was man kaufen kann: „a martial weapon" ist
         kein Laserrevolver ohne Preis. Hat nichts einen Preis, gilt alles. */
      const kaufbar = rows.filter((z) => itemPrice(ganz.get(z.id)) !== undefined);
      if (kaufbar.length) rows = kaufbar;
      this.stellenListen.update((m) => ({ ...m, [st.liste]: rows.map((z) => ({ id: z.id, name: z.name })) }));
    } catch (e) {
      this.stellenGefragt.delete(st.liste);
      this.problem.set((e as Error).message);
    }
  }

  protected reihe(n: number): number[] {
    return Array.from({ length: n }, (_x, i) => i);
  }

  /** Was an dieser Stelle steht. */
  protected stueck(c: ChoiceAtCharacter, i: number): string {
    return c.items?.[i] ?? '';
  }

  protected nameIn(liste: { id: string; name: string }[], id: string): string {
    return liste.find((z) => z.id === id)?.name ?? this.bestand.name()(id) ?? 'item';
  }

  protected filtereStelle(liste: string, q: string): void {
    this.stellenFilter.update((m) => ({ ...m, [liste]: q }));
  }

  /** Gefiltert — was gewählt ist, bleibt stehen, sonst verlöre die Auswahl ihren Wert. */
  protected gefiltertStelle(liste: string, rows: { id: string; name: string }[], gewaehlt: string): { id: string; name: string }[] {
    const q = (this.stellenFilter()[liste] ?? '').trim().toLowerCase();
    return q ? rows.filter((z) => z.id === gewaehlt || z.name.toLowerCase().includes(q)) : rows;
  }

  /** Eine Stelle füllen: die Antwort behält die Möglichkeit und setzt das Stück. */
  protected fuelle(c: ChoiceAtCharacter, key: string, i: number, id: string): void {
    const gesamt = (c.choice.from?.options ?? []).find((o) => o.key === key);
    const n = gesamt ? optionSlots(gesamt).reduce((x, st) => x + st.count, 0) : i + 1;
    const items = Array.from({ length: Math.max(n, i + 1) }, (_x, k) => c.items?.[k] ?? '');
    items[i] = id;
    this.entwurf.update((e) => pruneAnswers(answerChoice(e, c, [key], items), this.quellen()));
  }

  /** Sind alle offenen Stellen der gewählten Möglichkeit gefüllt? */
  private gefuellt(c: ChoiceAtCharacter): boolean {
    const o = (c.choice.from?.options ?? []).find((x) => x.key === c.picks?.[0]);
    if (!o) return !!c.picks?.length;
    /* Eine Stelle, für die es nichts Fertiges gibt, hält niemanden auf. */
    return this.stellen(c, o).every((st) => {
      const liste = this.stellenListen()[st.liste];
      if (liste && !liste.length) return true;
      return Array.from({ length: st.slot.count }, (_x, k) => c.items?.[st.ab + k]).every(Boolean);
    });
  }

  private async ladeKandidaten(typ: string): Promise<void> {
    if (this.kandidaten()[typ]) return;
    try {
      /* Mit der Grundart einer Spielart, für die Gruppen (T-193). */
      const rows = await this.zeilen([typ], typ === 'Class' ? undefined : 'subraceOf');
      this.kandidaten.update((k) => ({
        ...k,
        [typ]: rows.map((z) => {
          const basis = z.rels?.['subraceOf']?.[0];
          return { wert: z.id, label: z.name, hinweis: z.source.split(' p. ')[0] ?? '', ...(basis ? { basis } : {}) };
        }),
      }));
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
      if (f.options?.length && s.at.choice.kind === 'option') {
        /* Steigerung oder Talent (T-107): ohne Talente am Tisch nur die Steigerung. */
        liste = offeredOptions(s.at.choice, choicesOf(s.at.source.entity), { feats: this.talente() }).map((o) => ({ wert: o.key, label: o.label }));
      } else if (f.options?.length) liste = f.options.map((o) => ({ wert: o.key, label: `(${o.key}) ${o.label}` }));
      else if (f.values?.length) liste = f.values.map((v) => ({ wert: v, label: v }));
      else if (f.interfaces?.length && f.listedBy) {
        /* Aus der Zauberliste der Klasse (T-309): die Gegenrichtung der Kante
           ist eine Facette der Liste (`in.spellList`), der Grad eine zweite. */
        const werte = f.where ? (Array.isArray(f.where.value) ? f.where.value : f.where.value !== undefined ? [f.where.value] : []).map(String) : [];
        const r = await this.api.list({
          type: f.interfaces[0],
          f: [`in.${f.listedBy.type}:${f.listedBy.from}`, ...(f.where && werte.length ? [`${f.where.component}.${f.where.property}:${werte.join('|')}`] : [])],
          limit: 500,
          sort: 'name',
        });
        liste = r.rows.filter(fertig).map((z) => ({ wert: z.id, label: z.name, hinweis: z.source.split(' p. ')[0] ?? '', id: z.id }));
      } else if (f.interfaces?.length) {
        let rows = await this.zeilenMitFilter(f.interfaces, f.where, f.edge?.type);
        if (f.edge) rows = rows.filter((z) => z.rels?.[f.edge!.type]?.includes(f.edge!.to));
        /* Die Marken schlagen vor (wie `LinkTarget.tags`): finden sie nichts, gilt die ganze Art. */
        const markiert = f.tags?.length ? rows.filter((z) => z.tags?.some((t) => f.tags!.includes(t))) : rows;
        liste = this.nurSprachenDerKampagne(f.interfaces, markiert.length ? markiert : rows).map((z) => ({
          wert: z.id,
          label: z.name,
          hinweis: z.source.split(' p. ')[0] ?? '',
          id: z.id,
        }));
      } else if (f.enumRef?.length) {
        const reg = this.bestand.registry();
        const arten = f.enumRef.filter((r) => !!reg?.interfaces[r]);
        const rows = arten.length ? this.nurSprachenDerKampagne(arten, await this.zeilenMitFilter(arten, f.where)) : [];
        /* Ein Name nennt den Artikel dahinter — für die Kurzansicht (T-162). */
        const ids = new Map(rows.map((z) => [z.name, z.id] as const));
        const zeilen = reg ? (enumOptions(reg, { enumRef: f.enumRef.filter((r) => !arten.includes(r)) }) ?? []) : [];
        liste = [...new Set([...zeilen, ...ids.keys()])]
          .sort((a, z) => a.localeCompare(z, 'en'))
          .map((v) => ({ wert: v, label: v, ...(ids.has(v) ? { id: ids.get(v)! } : {}) }));
      }
      if (s.at.choice.kind === 'ability') {
        const b = s.at.choice.bonus ?? [1];
        const hinweis = s.at.choice.repeat ? `+${b[0] ?? 1} each` : `+${b.join('/+')}`;
        liste = liste.map((m) => ({ ...m, label: m.label.toUpperCase(), hinweis }));
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
      case 'hitpoints':
        return 'Hit points';
      case 'equipment':
        return 'Equipment';
      /* Quelle und Wahl (T-162) — vorher „: equipment", weil der Name
         eines eingelesenen Artikels in `Identity` steht und nicht in `name`. */
      case 'choice':
        return choiceTitle(s.at);
    }
  }

  protected wahlTitel(c: ChoiceAtCharacter): string {
    return choiceTitle(c);
  }

  protected wahlsatz(c: ChoiceAtCharacter): string {
    return choiceText(c.choice);
  }

  /** Woher eine Wahl kommt — bei einem gewährten Merkmal mit Stufe und Klasse (T-107). */
  protected herkunft(c: ChoiceAtCharacter): string {
    const g = c.source.grant;
    const name = entityName(c.source.entity);
    if (!g) return name;
    const von = this.quellen().get(g.by);
    return `${name}, level ${g.level}${von ? ` (${entityName(von)})` : ''}`;
  }

  protected beschreibe(m: AbilityMethod): string {
    if (m.method === 'array') return (m.scores ?? []).join(', ');
    if (m.method === 'pointBuy') return `${m.budget ?? '?'} points`;
    return `${m.count} × ${m.dice ?? '?'}${m.scope === 'party' ? ', once for the party' : ''}`;
  }

  protected gefiltert(liste: Moeglichkeit[], id: string): Moeglichkeit[] {
    const q = this.filterVon(id).trim().toLowerCase();
    return q ? liste.filter((m) => m.label.toLowerCase().includes(q)) : liste;
  }

  protected filterVon(id: string): string {
    return this.filterJe()[id] ?? '';
  }

  protected filtere(id: string, q: string): void {
    this.filterJe.update((m) => ({ ...m, [id]: q }));
  }

  protected gewaehlt(s: Extract<BuilderStep, { kind: 'pick' }>): string | undefined {
    return this.entwurf().relations?.find((r) => r.type === s.edge)?.to;
  }

  protected waehle(s: Extract<BuilderStep, { kind: 'pick' }>, id: string): void {
    this.entwurf.update((e) => pruneAnswers(setPick(e, s.edge, id), this.quellen()));
    this.springe();
  }

  /**
   * **Was jede Wahl schon hat** (T-299): fest Gegebenes und die Antworten
   * früherer Schritte, je Wahl (`heldBefore`). Einmal je Entwurf gerechnet,
   * nicht je Möglichkeit.
   */
  private readonly gehabt = computed(() => {
    const d = this.entwurf();
    const q = this.quellen();
    return new Map(choicesAtCharacter(d, q).map((at) => [choiceKey(at), heldBefore(d, q, at)] as const));
  });
  /** Die Doppelungen im Entwurf, als Sätze je Wahl. */
  private readonly doppelungen = computed(() => {
    const q = this.quellen();
    const raus = new Map<string, string[]>();
    for (const d of choiceDuplicates(this.entwurf(), q)) raus.set(d.choice, [...(raus.get(d.choice) ?? []), duplicateText(d, q)]);
    return raus;
  });

  /** Ist dieser Wert für die Wahl schon da — und woher? */
  protected schonDa(s: WahlSchritt, wert: string, label?: string): HeldValue | undefined {
    const h = this.gehabt().get(choiceKey(s.at));
    if (!h?.size) return undefined;
    /* Ein angebotener Zauber ist nicht geladen: dann zählt sein Name (T-309). */
    return heldValue(h, wert, this.quellen()) ?? (label ? h.get(label.trim().toLowerCase()) : undefined);
  }

  protected doppelt(s: WahlSchritt): string[] {
    return this.doppelungen().get(choiceKey(s.at)) ?? [];
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

  /** Wie oft ein Wert gewählt ist — bei `repeat` mehr als einmal (T-107). */
  protected anzahl(s: Extract<BuilderStep, { kind: 'choice' }>, wert: string): number {
    return this.antwort(s).filter((w) => w === wert).length;
  }

  /** Wohin „More about this …" führt (T-166). */
  protected ansicht(typ: string, id: string): string[] {
    return ansichtWeg(typ, id);
  }
  protected mehr(s: Extract<BuilderStep, { kind: 'choice' }>, wert: string): void {
    const jetzt = this.antwort(s);
    if (jetzt.length >= (s.at.choice.count ?? 1)) return;
    this.beantworte(s, [...jetzt, wert]);
  }

  protected weniger(s: Extract<BuilderStep, { kind: 'choice' }>, wert: string): void {
    const jetzt = [...this.antwort(s)];
    const i = jetzt.lastIndexOf(wert);
    if (i < 0) return;
    jetzt.splice(i, 1);
    this.beantworte(s, jetzt);
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
    if (picks.length >= (s.at.choice.count ?? 1)) this.springe();
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

  // ---------------------------------------------------------- Stufen je Klasse (T-319)

  /** Die Attribute samt Boni — die Mehrklassen-Voraussetzung prüft die Endwerte. */
  private readonly endwerte = computed(() => {
    const raus: Record<string, number | undefined> = {};
    for (const a of this.attribute()) {
      const w = this.werte()[a];
      raus[a] = w === undefined ? undefined : w + (this.bonus()[a] ?? 0);
    }
    return raus;
  });
  protected readonly gesamtStufe = computed(() => classLevelRows(this.entwurf()).reduce((n, z) => n + z.level, 0));
  protected readonly klassenStufen = computed(() => {
    const q = this.quellen();
    const e = this.entwurf();
    return classLevelRows(e).map((z) => ({
      ...z,
      name: (q.has(z.id) ? entityName(q.get(z.id)) : '') || this.bestand.name()(z.id) || z.id,
      /* Was genau diese Stufe bringt (T-095). */
      neu: gainedFeatures(e, q, z.id).map((f) => (q.has(f.id) ? entityName(q.get(f.id)) : '') || this.bestand.name()(f.id) || f.id),
    }));
  });
  /** Die übrigen Klassen ganz — ihre Voraussetzung steht im Artikel. */
  private readonly klassenVoll = signal<ReadonlyMap<string, Entity>>(new Map());
  protected async ladeKlassenVoll(): Promise<void> {
    if (this.klassenVoll().size) return;
    const ids = (this.kandidaten()['Class'] ?? []).map((m) => m.wert);
    const voll = new Map<string, Entity>();
    for (let i = 0; i < ids.length; i += 100) for (const e of await this.api.entitiesById(ids.slice(i, i + 100))) voll.set(e.id, e);
    this.klassenVoll.set(voll);
  }
  protected readonly weitereKlassen = computed(() => {
    const voll = this.klassenVoll();
    if (!voll.size) return [];
    const alle = new Map([...this.quellen(), ...voll]);
    const e = this.entwurf();
    const dabei = new Set(classLevelRows(e).map((z) => z.id));
    return (this.kandidaten()['Class'] ?? [])
      .filter((m) => !dabei.has(m.wert))
      .map((m) => ({ id: m.wert, name: m.label, grund: canAddClass(e, m.wert, alle, this.endwerte()) }));
  });

  /** Eine Klasse um eine Stufe ändern oder dazunehmen; die neuen Wahlen folgen als Schritte. */
  protected stufe(klasse: string, delta: 1 | -1): void {
    const alle = new Map([...this.quellen(), ...this.klassenVoll()]);
    this.entwurf.set(changeClassLevel(this.entwurf(), klasse, delta, alle));
  }

  protected erledigt(s: BuilderStep): boolean {
    return this.fertigSchritt(s) && s.id !== this.schritt()?.id;
  }

  protected fertigSchritt(s: BuilderStep): boolean {
    switch (s.kind) {
      case 'pick':
        return !!this.entwurf().relations?.some((r) => r.type === s.edge) && this.wahlSchritte(s.nested ?? []).every((w) => this.fertigSchritt(w));
      case 'abilities':
        return !this.attributsproblem();
      /* Den Schritt gibt es im Assistenten nicht mehr (T-319). */
      case 'level':
        return true;
      case 'details':
        return !!this.name().trim();
      case 'hitpoints':
        return !this.tpProblem();
      case 'equipment': {
        const m = this.ausrMethode();
        if (!m) return false;
        if (m.method === 'rules') return s.choices.every((c) => this.gefuellt(c));
        if (m.method === 'gold' && this.budget() === null) return false;
        return !this.pruefung().problem;
      }
      case 'choice':
        if (this.doppelt(s).length) return false;
        return (s.at.picks?.length ?? 0) >= (s.at.choice.count ?? 1) || this.spaeterGelegt().has(choiceKey(s.at)) || (!!s.at.picks?.length && !s.at.choice.from);
    }
  }

  protected weiter(): void {
    this.index.update((i) => Math.min(i + 1, this.schritte().length - 1));
    if (typeof window !== 'undefined') window.scrollTo?.({ top: 0 });
  }

  protected geheZu(i: number): void {
    this.index.set(i);
  }

  // ---------------------------------------------------------- Unfertige Schritte (T-193)

  /**
   * **Was an diesem Schritt noch fehlt**, als Satz — `null`, wenn nichts.
   * Ein Punktekauf mit Punkten übrig ist fertig und fragt trotzdem: wer
   * weiterklickt, hat sie vielleicht nur übersehen.
   */
  protected hinweis(s: BuilderStep): string | null {
    switch (s.kind) {
      case 'pick': {
        if (!this.entwurf().relations?.some((r) => r.type === s.edge)) return `No ${s.type === 'Class' ? 'class' : s.type.toLowerCase()} chosen yet.`;
        const offen = this.wahlSchritte(s.nested ?? []).filter((w) => !this.fertigSchritt(w));
        return offen.length ? `Not every choice is made yet: ${offen.map((w) => this.titel(w)).join('; ')}.` : null;
      }
      case 'abilities': {
        const p = this.attributsproblem();
        if (p) return p;
        const m = this.methode();
        const n = this.ausgegeben();
        if (m?.method === 'pointBuy' && m.budget !== undefined && n !== null && n < m.budget) return `Not all points spent — ${n} of ${m.budget}.`;
        return null;
      }
      case 'choice': {
        if (this.fertigSchritt(s)) return null;
        const doppelt = this.doppelt(s);
        if (doppelt.length) return doppelt.join(' ');
        const fehlt = (s.at.choice.count ?? 1) - (s.at.picks?.length ?? 0);
        return `${fehlt} still to choose.`;
      }
      case 'equipment':
        return this.fertigSchritt(s) ? null : (this.ausrMethode() ? this.pruefung().problem : null) || 'Not every equipment choice is made yet.';
      case 'level':
        return null;
      case 'details':
        return this.fertigSchritt(s) ? null : 'Give the character a name.';
      case 'hitpoints':
        return this.tpProblem();
    }
  }

  /** Auf später gelegt und noch nicht nachgeholt — so steht der Schritt in der Leiste. */
  protected liegtOffen(s: BuilderStep): boolean {
    return this.spaeterGelegt().has(s.id) && !!this.hinweis(s);
  }

  protected weiterPruefen(s: BuilderStep): void {
    const h = this.spaeterGelegt().has(s.id) ? null : this.hinweis(s);
    if (h) this.warnung.set(h);
    else this.weiter();
  }

  protected bleiben(): void {
    this.warnung.set(null);
  }

  protected spaeterSchritt(s: BuilderStep): void {
    this.spaeterGelegt.update((l) => new Set([...l, s.id]));
    this.warnung.set(null);
    this.weiter();
  }

  /**
   * **Zum nächsten offenen Punkt** (T-193): nach einer Wahl die erste
   * Wahl darunter, die noch fehlt, sonst „Next". Gezeichnet wird erst
   * danach — und was die Wahl öffnet, kommt mit ihrem Artikel.
   */
  private springe(): void {
    if (typeof document === 'undefined') return;
    setTimeout(() => {
      const ziel = document.querySelector<HTMLElement>('.blatt [data-offen]') ?? document.querySelector<HTMLElement>('.blatt .knoepfe .pri');
      ziel?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    }, 350);
  }

  // ---------------------------------------------------------- Auswirkungen und Vergleich (T-193)

  /** Die Wahlen einer Grundwahl als Schritte — dieselbe Form, dieselben Listen. */
  protected wahlSchritte(nested: readonly ChoiceAtCharacter[]): WahlSchritt[] {
    return nested.map((at) => ({ id: `choice:${choiceKey(at)}`, kind: 'choice', at }));
  }

  /** Spielarten unter ihrer Grundart; ein Filter zeigt die Gruppe, in der etwas passt. */
  protected gruppiert(s: Extract<BuilderStep, { kind: 'pick' }>, liste: Moeglichkeit[]): { m: Moeglichkeit; varianten: Moeglichkeit[] }[] {
    const da = new Set(liste.map((m) => m.wert));
    const passt = new Set(this.gefiltert(liste, s.id).map((m) => m.wert));
    const kinder = new Map<string, Moeglichkeit[]>();
    for (const m of liste) if (m.basis && da.has(m.basis) && m.basis !== m.wert) kinder.set(m.basis, [...(kinder.get(m.basis) ?? []), m]);
    return liste
      .filter((m) => !m.basis || !da.has(m.basis) || m.basis === m.wert)
      .map((m) => ({ m, varianten: (kinder.get(m.wert) ?? []).filter((v) => passt.has(v.wert) || passt.has(m.wert)) }))
      .filter((g) => passt.has(g.m.wert) || g.varianten.length);
  }

  protected gruppeOffen(s: Extract<BuilderStep, { kind: 'pick' }>, g: { m: Moeglichkeit; varianten: Moeglichkeit[] }): boolean {
    const w = this.gewaehlt(s);
    return this.offeneGruppen().has(g.m.wert) || !!this.filterVon(s.id).trim() || g.varianten.some((v) => v.wert === w);
  }

  protected schalteGruppe(id: string): void {
    this.offeneGruppen.update((l) => {
      const m = new Set(l);
      if (!m.delete(id)) m.add(id);
      return m;
    });
  }

  protected klappe(id: string): void {
    this.aufgeklappt.update((l) => {
      const m = new Set(l);
      if (!m.delete(id)) m.add(id);
      return m;
    });
    void this.ladeWirkung(id);
  }

  protected vergleichVon(schritt: string): string[] | null {
    const l = this.vergleich()[schritt];
    return l?.length ? l : null;
  }

  protected vergleiche(schritt: string, id: string): void {
    this.vergleich.update((v) => {
      const l = v[schritt] ?? [];
      return { ...v, [schritt]: l.includes(id) ? l.filter((x) => x !== id) : l.length >= 4 ? l : [...l, id] };
    });
    void this.ladeWirkung(id);
  }

  protected leereVergleich(schritt: string): void {
    this.vergleich.update((v) => ({ ...v, [schritt]: [] }));
  }

  /**
   * Die Möglichkeit ganz, samt ihrer Grundarten — die Namen ihrer Merkmale
   * kommen in `refs.names` mit; gerechnet wird `optionEffects`.
   */
  private async ladeWirkung(id: string): Promise<void> {
    if (this.wirkungGefragt.has(id)) return;
    this.wirkungGefragt.add(id);
    try {
      const byId = new Map<string, Entity>();
      const namen: Record<string, string> = {};
      let jetzt: string | undefined = id;
      while (jetzt && !byId.has(jetzt) && byId.size < 4) {
        const { refs, ...e } = await this.api.entity(jetzt);
        byId.set(e.id, e);
        Object.assign(namen, refs?.names ?? {});
        jetzt = e.relations?.find((r) => r.type === 'subraceOf')?.to;
      }
      const effects = optionEffects(id, byId);
      if (effects) this.wirkungen.update((w) => ({ ...w, [id]: { entity: byId.get(id)!, effects, namen } }));
    } catch (e) {
      this.wirkungGefragt.delete(id);
      this.problem.set((e as Error).message);
    }
  }

  private bonusText(b: Record<string, number>): string {
    return Object.entries(b)
      .filter(([, n]) => n)
      .map(([a, n]) => `${ATTR(a)} ${n > 0 ? '+' : ''}${n}`)
      .join(', ');
  }

  /** Die Auswirkungen als Zeilen — leere fallen weg. */
  protected wirkungsZeilen(w: Wirkung): { label: string; wert: string }[] {
    const e = w.effects;
    return [
      { label: 'Ability scores', wert: this.bonusText(e.abilityBonus) },
      { label: 'Ability choice', wert: e.abilityNote ?? '' },
      { label: 'Size', wert: e.size.join(' or ') },
      { label: 'Speed', wert: e.speed ?? '' },
      { label: 'Darkvision', wert: e.darkvision ? `${e.darkvision} ft.` : '' },
      { label: 'Creature type', wert: e.creatureType ?? '' },
      { label: 'Resistances', wert: e.resistances.join(', ') },
      { label: 'Hit die', wert: e.hitDie ? `d${e.hitDie}` : '' },
      { label: 'Primary ability', wert: e.primaryAbility.map(ATTR).join(', ') },
      { label: 'Saving throws', wert: e.saves.map(ATTR).join(', ') },
      { label: 'Proficiencies', wert: e.proficient.join(', ') },
      { label: 'Expertise', wert: e.expertise.join(', ') },
    ].filter((z) => z.wert);
  }

  protected wahlText(c: Choice): string {
    return choiceText(c);
  }

  protected grundarten(w: Wirkung): string {
    return w.effects.line
      .slice(1)
      .map((id) => w.namen[id] || id)
      .join(', ');
  }

  /** Nebeneinander: jede Zeile, die bei einer der Möglichkeiten etwas sagt. */
  protected vergleichsZeilen(ids: string[]): { label: string; werte: string[] }[] {
    const ws = ids.map((id) => this.wirkungen()[id]);
    const zeilen = ws.map((w) =>
      w
        ? [
            ...this.wirkungsZeilen(w),
            { label: 'Features', wert: w.effects.features.map((f) => w.namen[f.id] || '').filter(Boolean).join(', ') },
            { label: 'You choose', wert: w.effects.choices.map((c) => plainEquipmentText(choiceText(c.choice))).join('; ') },
          ]
        : [],
    );
    /* In der Reihenfolge der Auswirkungen, nicht der ersten Spalte. */
    const reihe = ['Ability scores', 'Ability choice', 'Size', 'Speed', 'Darkvision', 'Creature type', 'Resistances', 'Hit die', 'Primary ability', 'Saving throws', 'Proficiencies', 'Expertise', 'Features', 'You choose'];
    const labels = [...new Set(zeilen.flatMap((z) => z.filter((x) => x.wert).map((x) => x.label)))].sort((a, z) => reihe.indexOf(a) - reihe.indexOf(z));
    return labels.map((label) => ({ label, werte: zeilen.map((z) => z.find((x) => x.label === label)?.wert ?? '') }));
  }

  // ---------------------------------------------------------- Der Entwurf am Server (T-193)

  private readonly entwurfZumSpeichern = computed((): GespeicherterEntwurf | null => {
    const e = this.entwurf();
    const leer = !(e.relations ?? []).length && !this.name().trim();
    if (leer) return null;
    return {
      v: 1,
      at: new Date().toISOString(),
      relations: e.relations ?? [],
      name: this.name(),
      werte: this.werte(),
      ...(this.methode() ? { methode: this.methode()!.id } : {}),
      gruppe: this.gruppe(),
      eigenerWurf: this.eigenerWurf(),
      ...(this.ausrMethode() ? { ausrMethode: this.ausrMethode()!.id } : {}),
      goldWurf: this.goldWurf(),
      korb: this.korb(),
      index: this.index(),
      spaeter: [...this.spaeterGelegt()],
    };
  });

  private stelleWiederHer(roh: unknown): void {
    const d = roh as GespeicherterEntwurf | null | undefined;
    if (!d || d.v !== 1 || !Array.isArray(d.relations)) return;
    this.entwurf.set({ ...LEER, relations: d.relations });
    this.name.set(d.name ?? '');
    const m = this.methoden().find((x) => x.id === d.methode);
    if (m) this.methode.set(m);
    this.werte.set(d.werte ?? {});
    if (typeof d.gruppe === 'string') this.gruppe.set(d.gruppe);
    this.eigenerWurf.set(d.eigenerWurf ?? null);
    const a = this.ausrMethoden().find((x) => x.id === d.ausrMethode);
    if (a) this.ausrMethode.set(a);
    this.goldWurf.set(d.goldWurf ?? null);
    this.korb.set(Array.isArray(d.korb) ? d.korb : []);
    this.spaeterGelegt.set(new Set(Array.isArray(d.spaeter) ? d.spaeter : []));
    this.index.set(Math.max(0, Number(d.index) || 0));
    this.wiederhergestellt.set(new Date(d.at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }));
  }

  /** Was „New article" mitgab, schlägt den gemerkten Entwurf (T-095). */
  private uebernimm(): void {
    if (this.mitgebracht.name) this.name.set(this.mitgebracht.name);
  }

  protected neuBeginnen(): void {
    this.entwurf.set(LEER);
    this.name.set(this.mitgebracht.name);
    this.werte.set({});
    this.eigenerWurf.set(null);
    this.goldWurf.set(null);
    this.korb.set([]);
    this.spaeterGelegt.set(new Set());
    this.vergleich.set({});
    this.index.set(0);
    this.wiederhergestellt.set(null);
    void this.api.setPref(ENTWURF, null).catch(() => undefined);
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

  /** Was der Schritt „Name" an die Figur schreibt (T-194); leer heisst nichts. */
  private figurFelder(): Record<string, unknown> {
    const raus: Record<string, unknown> = {};
    if (this.deckname().trim()) raus['Identity.cover'] = this.deckname().trim();
    if (this.aussehen().trim()) raus['Creature.appearance'] = [this.aussehen().trim()];
    return raus;
  }

  /** Was er an den Statblock schreibt: Gesinnung und Grösse. */
  private statblockFelder(): Record<string, unknown> {
    const raus: Record<string, unknown> = {};
    if (this.gesinnung().trim()) raus['Statblock.alignment'] = this.gesinnung().trim();
    const g = this.groesse() || (this.groessen().length === 1 ? this.groessen()[0] : '');
    if (g) raus['Statblock.size'] = g;
    return raus;
  }

  /**
   * **Eine gespeicherte Figur schreiben** (Aufstieg und Bearbeiten, T-194):
   * Wahlen und Stufenwerte an der Figur, Werte, Maximum, Gesinnung und
   * Grösse an ihrem Statblock. Der Stand der Trefferpunkte wandert um das,
   * was das Maximum wandert — wer verwundet aufsteigt, bleibt verwundet.
   * Ein offenes Maximum (auf später gelegt) lässt das alte stehen.
   */
  private async speichereFigur(e: Entity, max: number | null): Promise<void> {
    const { updatedAt: _u, refs: _r, ...rest } = e as Entity & { updatedAt?: unknown; refs?: unknown };
    const comps: Record<string, Record<string, unknown>> = { ...(rest.components ?? {}) };
    const setze = (ziel: Record<string, Record<string, unknown>>, ref: string, wert: unknown) => {
      const [k, f] = ref.split('.') as [string, string];
      ziel[k] = { ...(ziel[k] ?? {}), [f]: wert };
    };
    const alt = this.altesMax();
    const stand = comps['Vitals']?.['hp'];
    if (max !== null && alt !== undefined && typeof stand === 'number') setze(comps, 'Vitals.hp', Math.max(0, stand + max - alt));
    else if (max !== null && typeof stand !== 'number') setze(comps, 'Vitals.hp', max);
    if (this.bearbeiten()) {
      for (const [ref, w] of Object.entries(this.figurFelder())) setze(comps, ref, w);
      if (!this.deckname().trim() && comps['Identity']) delete comps['Identity']['cover'];
      if (!this.aussehen().trim() && comps['Creature']) delete comps['Creature']['appearance'];
    }
    /* Der Name steht in `Identity` (`entityName`); `name` nur, wo er schon stand. */
    const neu = this.name().trim();
    if (this.bearbeiten() && neu) setze(comps, 'Identity.name', neu);
    const name = this.bearbeiten() && neu && rest.name ? neu : rest.name;
    await this.api.putEntity({ ...rest, name, components: comps });

    const sb = this.statblock();
    /* Über „New article" angelegt, hat die Figur noch keinen Statblock
       (T-095): die Werte, die der Assistent jetzt kennt, bekommen einen —
       sonst gingen sie beim Speichern still verloren. */
    if (!sb) {
      const werte = Object.fromEntries(this.attribute().flatMap((a) => (this.werte()[a] === undefined ? [] : [[`Abilities.${a}`, this.werte()[a]]])));
      const felder = { ...werte, ...(this.bearbeiten() ? this.statblockFelder() : {}), ...(max !== null ? { 'Statblock.hp': max } : {}) };
      if (Object.keys(felder).length)
        await this.api.createEntity('Statblock', this.name().trim() || entityName(e), { ...felder, 'Status.status': 'ready' }, [{ type: 'belongsTo', to: e.id }]);
      return;
    }
    const { updatedAt: _su, refs: _sr, ...sbRest } = sb as Entity & { updatedAt?: unknown; refs?: unknown };
    const sbComps: Record<string, Record<string, unknown>> = { ...(sbRest.components ?? {}) };
    if (max !== null) setze(sbComps, 'Statblock.hp', max);
    if (this.bearbeiten()) {
      for (const a of this.attribute()) if (this.werte()[a] !== undefined) setze(sbComps, `Abilities.${a}`, this.werte()[a]);
      for (const [ref, w] of Object.entries(this.statblockFelder())) setze(sbComps, ref, w);
      if (!this.gesinnung().trim() && sbComps['Statblock']) delete sbComps['Statblock']['alignment'];
    }
    if (JSON.stringify(sbComps) !== JSON.stringify(sbRest.components ?? {})) await this.api.putEntity({ ...sbRest, components: sbComps });
  }

  protected async speichern(): Promise<void> {
    if (this.speichert()) return;
    this.speichert.set(true);
    this.problem.set(null);
    try {
      const e = this.entwurf();
      const max = this.tpMax();
      if (this.gespeichert()) {
        await this.speichereFigur(e, max);
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
        /* Die Ebene aus „New article" (T-095); sonst nimmt der Server die Schreibebene. */
        if (this.mitgebrachteEbene()) kanten.push({ type: LAYER_RELATION, to: this.mitgebracht.layer, props: {} });
        /* Die Figur gehört dem Spieler (E-014 d): gleich fertig — ausser ein
           Entscheid ist noch offen, dann eine Idee, bis er gewählt ist
           (T-436, E-176; der Server verweigerte sonst ready). */
        const stand = this.bleibtIdee() ? 'idea' : 'ready';
        /* Das Maximum steht am Statblock, der Stand gleich voll an der Figur (T-194). */
        const figur = await this.api.createEntity(
          'PlayerCharacter',
          name,
          { ...this.mitgebracht.felder, 'Status.status': stand, ...this.figurFelder(), ...(max !== null ? { 'Vitals.hp': max } : {}) },
          kanten,
        );
        /* Auf später gelegte Werte bleiben leer (T-193). */
        const werte = Object.fromEntries(this.attribute().flatMap((a) => (this.werte()[a] === undefined ? [] : [[`Abilities.${a}`, this.werte()[a]]])));
        await this.api.createEntity(
          'Statblock',
          name,
          { ...werte, ...this.statblockFelder(), ...(max !== null ? { 'Statblock.hp': max } : {}), 'Status.status': 'ready' },
          [{ type: 'belongsTo', to: figur.id }],
        );
        figurId = figur.id;
        this.angelegt.set(figurId);
        /* Was sie angelegt hat, schreibt sie — das weiss erst ein neues `/api/me`. */
        await this.session.load(true);
      }
      /* Die Startausrüstung prüft und schreibt der Server (T-096). */
      const m = this.ausrMethode();
      /* Auf später gelegt (T-193): die Ausrüstung folgt auf der Seite der Figur. */
      const ausrSpaeter = this.schritte().some((x) => x.kind === 'equipment' && this.liegtOffen(x));
      if (m && !ausrSpaeter) await this.api.applyEquipment(figurId, m.id, m.method === 'rules' ? [] : this.korb(), this.goldWurf()?.event);
      this.entwurfFertig = true;
      clearTimeout(this.speicherUhr);
      await this.api.setPref(ENTWURF, null).catch(() => undefined);
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

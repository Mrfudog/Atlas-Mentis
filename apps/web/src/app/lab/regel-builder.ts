import { Component, computed, inject, signal, viewChild, type ElementRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  articleWithGraph,
  describeRuleNode,
  entityName,
  exampleRuleGraphs,
  graphFromArticle,
  ruleArticleKey,
  ruleArticleKind,
  ruleGraphProblems,
  runRules,
  RULE_COMPARATORS,
  RULE_ENGINES,
  RULE_ROLES,
  RULE_SORTS,
  RULE_TRIGGERS,
  type RuleComparator,
  type Entity,
  type RuleCreature,
  type RuleEvent,
  type RuleGraph,
  type RuleNode,
  type RuleOutcome,
  type RuleRole,
  type RuleRunResult,
  type RuleTest,
  type RuleTriggerKey,
  type RuleWire,
} from '@nw/model';
import { Api, ApiError } from '../kern/api';
import { Experimente } from '../kern/experimente';
import { Session } from '../kern/session';

/** Werte mit eigener Spalte im Probelauf; der Rest steht unter „More values". */
const EIGENE_SPALTEN = new Set(['hp', 'reach', 'reactionFree']);

/** Masse eines Knotens auf der Leinwand. */
const B = 210;
const H = 76;

type Ziehen =
  | { art: 'knoten'; id: string; dx: number; dy: number }
  | { art: 'flaeche'; x: number; y: number; el: HTMLElement }
  | { art: 'draht'; von: string; port?: 'yes' | 'no'; x: number; y: number };

/**
 * **Lab › Rules** (T-270): der Regel-Builder als Versuch. Eine Regel ist ein
 * Graph wie in n8n oder Node-RED — Auslöser → Bedingung → Folge —, gerechnet
 * mit `runRules` aus dem Modellpaket. Der Probelauf zeigt nur an: es wird
 * nichts am Tisch gespeichert und keine Initiative geändert. Gespeichert
 * werden nur die Graphen, als Einstellungen des eigenen Kontos.
 *
 * Die Leinwand ist eigenes SVG — eine Bibliothek dafür wäre für einen
 * Versuch mehr Abhängigkeit als Nutzen.
 */
@Component({
  selector: 'nw-regel-builder',
  imports: [RouterLink],
  template: `
    <main class="lab">
      <header class="kopf">
        <h1>Rule builder <span class="marke">experiment</span></h1>
        <p class="hint">
          A rule is a chain of nodes: a trigger, conditions with a yes and a no exit, and outcomes. Try your rules on a made-up event
          below — the result is only shown, nothing changes at the table.
        </p>
      </header>

      @if (!session.leitung()) {
        <p class="hint">The rule builder is for game masters and admins.</p>
      } @else if (!bereit()) {
        <p class="hint">Loading…</p>
      } @else if (!exp.ruleBuilder()) {
        <p class="hint">This experiment is off. Turn it on in a campaign’s Rules &amp; options › Experiments.</p>
      } @else {
        @if (fehler(); as f) {
          <p class="fehler" role="alert">{{ f }}</p>
        }
        <div class="oben">
        <aside class="uebersicht" aria-label="Rules by engine">
          <div class="leiste">
            <button type="button" (click)="neueRegel()">New rule</button>
            <button type="button" (click)="beispiele()">Add examples</button>
            <button type="button" class="pri" [disabled]="!geaendert().size || speichert()" (click)="speichern()">
              {{ speichert() ? 'Saving…' : 'Save' }}
            </button>
          </div>
          <div class="filter">
            <label>Search <input type="search" [value]="suche()" (input)="suche.set($any($event.target).value)" placeholder="Name, trigger, text…" /></label>
            <label
              >System
              <select (change)="engineFilter.set($any($event.target).value)">
                <option value="" [selected]="engineFilter() === ''">All systems</option>
                @for (e of systeme(); track e.key) {
                  <option [value]="e.key" [selected]="engineFilter() === e.key">{{ e.label }}</option>
                }
              </select>
            </label>
            <label
              >Trigger
              <select (change)="triggerFilter.set($any($event.target).value)">
                <option value="" [selected]="triggerFilter() === ''">Any trigger</option>
                @for (t of triggers; track t.key) {
                  <option [value]="t.key" [selected]="triggerFilter() === t.key">{{ t.label }}</option>
                }
              </select>
            </label>
            <label class="haken"><input type="checkbox" [checked]="nurAktive()" (change)="nurAktive.set($any($event.target).checked)" /> Active only</label>
          </div>
          @for (gr of gruppen(); track gr.key) {
            <section class="engine">
              <h2>{{ gr.label }} <span class="zahl-klein">{{ gr.regeln.length }}</span></h2>
              <ul>
                @for (g of gr.regeln; track g.id) {
                  <li>
                    <button type="button" class="regel" [class.aktiv]="g.id === aktivId()" [class.aus]="!g.enabled" (click)="waehle(g.id)">
                      <span>{{ g.name }}</span>
                      <small>{{ ausloeserVon(g) }} · {{ g.nodes.length }} nodes{{ g.enabled ? '' : ' · off' }}{{ geaendert().has(g.id) ? ' · unsaved' : '' }}</small>
                    </button>
                  </li>
                }
              </ul>
            </section>
          } @empty {
            <p class="hint">No rule matches the filter.</p>
          }
        </aside>

        <div class="haupt">
        @if (aktiv(); as g) {
          <div class="regelkopf">
            <label>Name <input type="text" [value]="g.name" (change)="aendereRegel({ name: $any($event.target).value })" /></label>
            <label
              >System
              <select (change)="aendereRegel({ engine: $any($event.target).value || undefined })">
                <option value="" [selected]="!g.engine">—</option>
                @for (e of systeme(); track e.key) {
                  <option [value]="e.key" [selected]="g.engine === e.key">{{ e.label }}</option>
                }
              </select>
            </label>
            <label class="haken"
              ><input type="checkbox" [checked]="g.enabled" (change)="aendereRegel({ enabled: $any($event.target).checked })" /> Active</label
            >
            <a class="knopf" [routerLink]="['/artikel', g.id]">Open article</a>
            @if (darfLoeschen(g.id)) {
              <button type="button" class="leise" (click)="loeschen(g)">Delete rule</button>
            }
          </div>
          <label class="text"
            >Text
            <textarea rows="3" [value]="textVon(g.id)" (change)="setzeText(g.id, $any($event.target).value)"></textarea>
          </label>
          @if (optionen().length) {
            <details class="optionen" open>
              <summary>Options of this rule ({{ optionen().length }})</summary>
              <ul>
                @for (o of optionen(); track o.id) {
                  <li>
                    <a [routerLink]="['/artikel', o.id]">{{ optionsName(o) }}</a>
                    <textarea rows="2" [value]="textVon(o.id)" (change)="setzeText(o.id, $any($event.target).value)"
                              [attr.aria-label]="'Text of ' + optionsName(o)"></textarea>
                  </li>
                }
              </ul>
            </details>
          }
          <div class="leiste">
            <span class="hint">Add:</span>
            <button type="button" (click)="neuerKnoten('trigger')">Trigger</button>
            <button type="button" (click)="neuerKnoten('condition')">Condition</button>
            <button type="button" (click)="neuerKnoten('outcome')">Outcome</button>
            <span class="zoom">
              <button type="button" (click)="zoome(-1)" aria-label="Zoom out">−</button>
              <span class="hint">{{ (massstab() * 100).toFixed(0) }}%</span>
              <button type="button" (click)="zoome(1)" aria-label="Zoom in">+</button>
              <button type="button" (click)="einpassen(flaeche)">Fit</button>
            </span>
          </div>
          @for (p of probleme(); track p) {
            <p class="warn">{{ p }}</p>
          }

          <div class="arbeit">
            <div class="flaeche" #flaeche aria-label="Rule canvas">
              <svg
                #svg
                [attr.width]="groesse().w * massstab()"
                [attr.height]="groesse().h * massstab()"
                [attr.viewBox]="'0 0 ' + groesse().w + ' ' + groesse().h"
                (pointerdown)="schiebe($event, svg, flaeche)"
                (pointermove)="bewege($event, svg)"
                (pointerup)="loslassen($event, svg)"
                (pointercancel)="ziehen.set(null)"
              >
                @for (w of g.wires; track $index) {
                  <svg:path
                    class="draht"
                    [class.nein]="w.port === 'no'"
                    [class.gewaehlt]="drahtWahl() === $index"
                    [attr.d]="pfad(g, w)"
                    (click)="drahtWahl.set($index); knotenWahl.set(null)"
                  />
                }
                @if (ziehen(); as z) {
                  @if (z.art === 'draht') {
                    <svg:path class="draht zieht" [attr.d]="pfadVon(g, z.von, z.port, z.x, z.y)" />
                  }
                }
                @for (n of g.nodes; track n.id) {
                  <svg:g
                    class="knoten"
                    [class.ausloeser]="n.kind === 'trigger'"
                    [class.bedingung]="n.kind === 'condition'"
                    [class.folge]="n.kind === 'outcome'"
                    [class.gewaehlt]="knotenWahl() === n.id"
                    [class.ja]="spur().get(n.id) === true"
                    [class.nein]="spur().get(n.id) === false"
                    [class.offen]="spur().get(n.id) === null"
                    [attr.data-node]="n.id"
                    [attr.transform]="'translate(' + n.x + ',' + n.y + ')'"
                  >
                    <svg:rect [attr.width]="B" [attr.height]="H" rx="8" (pointerdown)="greife($event, n, svg)" />
                    <svg:text x="10" y="18" class="art">{{ artName(n) }}</svg:text>
                    @for (z of zeilen(n); track $index) {
                      <svg:text x="10" [attr.y]="38 + $index * 17" class="satz">{{ z }}</svg:text>
                    }
                    @if (n.kind !== 'trigger') {
                      <svg:circle class="port ein" cx="0" [attr.cy]="H / 2" r="6" />
                    }
                    @if (n.kind === 'trigger') {
                      <svg:circle class="port aus" [attr.cx]="B" [attr.cy]="H / 2" r="7" (pointerdown)="zieheDraht($event, n.id, undefined, svg)" />
                    }
                    @if (n.kind === 'condition') {
                      <svg:circle class="port aus" [attr.cx]="B" cy="24" r="7" (pointerdown)="zieheDraht($event, n.id, 'yes', svg)" />
                      <svg:text [attr.x]="B - 26" y="28" class="portname">yes</svg:text>
                      <svg:circle class="port aus nein" [attr.cx]="B" cy="54" r="7" (pointerdown)="zieheDraht($event, n.id, 'no', svg)" />
                      <svg:text [attr.x]="B - 22" y="58" class="portname">no</svg:text>
                    }
                  </svg:g>
                }
              </svg>
            </div>

            <aside class="pruefer" aria-label="Selected node">
              @if (gewaehlterKnoten(); as n) {
                <h2>{{ artName(n) }}</h2>
                @switch (n.kind) {
                  @case ('trigger') {
                    <label
                      >When a creature
                      <select (change)="setzeKnoten(n.id, { on: $any($event.target).value })">
                        @for (t of triggers; track t.key) {
                          <option [value]="t.key" [selected]="t.key === (n.on)">{{ t.label }}</option>
                        }
                      </select>
                    </label>
                  }
                  @case ('condition') {
                    <label
                      >Test
                      <select (change)="setzeTestArt(n.id, $any($event.target).value)">
                        <option value="compare" [selected]="'compare' === (n.test.kind)">Compare numbers</option>
                        <option value="knows" [selected]="'knows' === (n.test.kind)">Knows by name</option>
                        <option value="same" [selected]="'same' === (n.test.kind)">Same creature</option>
                      </select>
                    </label>
                    @switch (n.test.kind) {
                      @case ('compare') {
                        <label>Left <input type="text" [value]="$any(n.test).left" (change)="setzeTest(n.id, { left: $any($event.target).value })" /></label>
                        <label
                          >Is
                          <select (change)="setzeTest(n.id, { op: $any($event.target).value })">
                            @for (o of vergleiche; track o) {
                              <option [value]="o" [selected]="o === ($any(n.test).op)">{{ o }}</option>
                            }
                          </select>
                        </label>
                        <label>Right <input type="text" [value]="$any(n.test).right" (change)="setzeTest(n.id, { right: $any($event.target).value })" /></label>
                        <p class="hint">
                          Numbers, + − × ÷ and names: <code>distance</code>, <code>distanceToTarget</code>, <code>self.hp</code>,
                          <code>actor.reach</code>, <code>target.reactionFree</code> (1 or 0) … A missing value decides nothing.
                        </p>
                      }
                      @case ('knows') {
                        <label
                          >Who
                          <select (change)="setzeTest(n.id, { who: $any($event.target).value })">
                            @for (r of rollen; track r) {
                              <option [value]="r" [selected]="r === ($any(n.test).who)">{{ r }}</option>
                            }
                          </select>
                        </label>
                        <label>Knows <input type="text" [value]="$any(n.test).name" (change)="setzeTest(n.id, { name: $any($event.target).value })" /></label>
                      }
                      @case ('same') {
                        <label
                          ><select (change)="setzeTest(n.id, { a: $any($event.target).value })">
                            @for (r of rollen; track r) {
                              <option [value]="r" [selected]="r === ($any(n.test).a)">{{ r }}</option>
                            }
                          </select></label
                        >
                        <label class="haken"
                          ><input type="checkbox" [checked]="!!$any(n.test).not" (change)="setzeTest(n.id, { not: $any($event.target).checked })" /> is
                          not</label
                        >
                        <label
                          ><select (change)="setzeTest(n.id, { b: $any($event.target).value })">
                            @for (r of rollen; track r) {
                              <option [value]="r" [selected]="r === ($any(n.test).b)">{{ r }}</option>
                            }
                          </select></label
                        >
                      }
                    }
                  }
                  @case ('outcome') {
                    <label
                      >Then
                      <select (change)="setzeFolgeArt(n.id, $any($event.target).value)">
                        <option value="offerReaction" [selected]="'offerReaction' === (n.then.kind)">Offer a reaction</option>
                        <option value="applyEffect" [selected]="'applyEffect' === (n.then.kind)">Apply an effect</option>
                        <option value="blockAction" [selected]="'blockAction' === (n.then.kind)">Block an action</option>
                        <option value="changeValue" [selected]="'changeValue' === (n.then.kind)">Change a value</option>
                      </select>
                    </label>
                    @for (f of folgeFelder(n.then); track f.key) {
                      <label
                        >{{ f.label }}
                        @if (f.rolle) {
                          <select (change)="setzeFolge(n.id, f.key, $any($event.target).value)">
                            @for (r of rollen; track r) {
                              <option [value]="r" [selected]="r === (f.wert)">{{ r }}</option>
                            }
                          </select>
                        } @else {
                          <input type="text" [value]="f.wert" (change)="setzeFolge(n.id, f.key, $any($event.target).value)" />
                        }
                      </label>
                    }
                  }
                }
                @if (n.kind !== 'outcome') {
                  <label
                    >Connect {{ n.kind === 'condition' ? 'yes' : '' }} to
                    <select (change)="verbinde(n.id, $any($event.target).value, 'yes'); $any($event.target).value = ''">
                      <option value="">—</option>
                      @for (z of ziele(n.id); track z.id) {
                        <option [value]="z.id">{{ z.label }}</option>
                      }
                    </select>
                  </label>
                }
                @if (n.kind === 'condition') {
                  <label
                    >Connect no to
                    <select (change)="verbinde(n.id, $any($event.target).value, 'no'); $any($event.target).value = ''">
                      <option value="">—</option>
                      @for (z of ziele(n.id); track z.id) {
                        <option [value]="z.id">{{ z.label }}</option>
                      }
                    </select>
                  </label>
                }
                <button type="button" class="leise" (click)="loescheKnoten(n.id)">Delete node</button>
              } @else if (drahtWahl() !== null) {
                <h2>Connection</h2>
                <button type="button" class="leise" (click)="loescheDraht()">Delete connection</button>
              } @else {
                <p class="hint">
                  Pick a node to change it. Drag a node to move it; drag from a dot on its right edge onto another node to connect them — or
                  use “Connect to”.
                </p>
              }
            </aside>
          </div>
        } @else {
          <p class="hint">Pick a rule on the left, or start a new one.</p>
        }
        </div>
        </div>

        <section class="probe" aria-labelledby="probe-titel">
          <h2 id="probe-titel">Try it</h2>
          <p class="hint">
            Made-up creatures for a dry run. Positions are in feet; “reaction free” counts as 1 or 0. More values are read as
            <code>self.name</code>, <code>actor.name</code> or <code>target.name</code>, written <code>name=number</code> and separated by commas.
          </p>
          <div class="tabelle">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Knows (comma-separated)</th>
                  <th>x</th>
                  <th>y</th>
                  <th>HP</th>
                  <th>Reach</th>
                  <th>Reaction free</th>
                  <th>More values</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (c of kreaturen(); track c.id) {
                  <tr>
                    <td><input type="text" [value]="c.name" (change)="setzeKreatur(c.id, { name: $any($event.target).value })" /></td>
                    <td>
                      <input type="text" [value]="c.knows.join(', ')" (change)="setzeKreatur(c.id, { knows: liste($any($event.target).value) })" />
                    </td>
                    <td><input type="number" class="zahl" [value]="c.x" (change)="setzeKreatur(c.id, { x: +$any($event.target).value })" /></td>
                    <td><input type="number" class="zahl" [value]="c.y" (change)="setzeKreatur(c.id, { y: +$any($event.target).value })" /></td>
                    <td><input type="number" class="zahl" [value]="c.values['hp']" (change)="setzeWert(c.id, 'hp', $any($event.target).value)" /></td>
                    <td><input type="number" class="zahl" [value]="c.values['reach']" (change)="setzeWert(c.id, 'reach', $any($event.target).value)" /></td>
                    <td>
                      <input type="checkbox" [checked]="c.values['reactionFree'] === 1"
                             (change)="setzeWert(c.id, 'reactionFree', $any($event.target).checked ? '1' : '0')" />
                    </td>
                    <td>
                      <input type="text" class="mehr" [value]="weitere(c)" (change)="setzeWeitere(c.id, $any($event.target).value)"
                             placeholder="maxHp=20, slots1=2" />
                    </td>
                    <td><button type="button" class="leise" (click)="entferneKreatur(c.id)" [attr.aria-label]="'Remove ' + c.name">×</button></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <button type="button" (click)="neueKreatur()">Add creature</button>

          <div class="leiste ereignis">
            <label
              >Event
              <select (change)="setzeEreignis({ on: $any($event.target).value })">
                @for (t of triggers; track t.key) {
                  <option [value]="t.key" [selected]="t.key === (ereignis().on)">{{ t.label }}</option>
                }
              </select>
            </label>
            <label
              >Who acts
              <select (change)="setzeEreignis({ actor: $any($event.target).value })">
                @for (c of kreaturen(); track c.id) {
                  <option [value]="c.id" [selected]="c.id === (ereignis().actor)">{{ c.name }}</option>
                }
              </select>
            </label>
            <label
              >Against
              <select (change)="setzeEreignis({ target: $any($event.target).value || undefined })">
                <option value="" [selected]="'' === (ereignis().target ?? '')">—</option>
                @for (c of kreaturen(); track c.id) {
                  <option [value]="c.id" [selected]="c.id === (ereignis().target ?? '')">{{ c.name }}</option>
                }
              </select>
            </label>
            <label
              >Amount
              <input type="number" class="zahl" [value]="ereignis().amount ?? ''"
                     (change)="setzeEreignis({ amount: $any($event.target).value === '' ? undefined : +$any($event.target).value })"
                     title="Damage, spell level … — read as amount" />
            </label>
            <button type="button" class="pri" (click)="probe()">Run</button>
          </div>

          @if (ergebnis(); as r) {
            <h3>What fires</h3>
            <ul class="feuert">
              @for (f of r.firings; track $index) {
                <li>
                  <button type="button" class="leise feuer" (click)="zeigeFeuer(f.rule, f.self)" title="Show this rule and its path">
                    <strong>{{ f.ruleName }}:</strong> {{ f.text }}
                  </button>
                </li>
              } @empty {
                <li class="hint">No rule fires.</li>
              }
            </ul>
            @if (aktiv()) {
              <label
                >Show the path for
                <select (change)="spurFuer.set($any($event.target).value || null)">
                  <option value="" [selected]="'' === (spurFuer() ?? '')">—</option>
                  @for (c of kreaturen(); track c.id) {
                    <option [value]="c.id" [selected]="c.id === (spurFuer() ?? '')">{{ c.name }}</option>
                  }
                </select>
              </label>
              <p class="hint">On the canvas: green passed, red failed, amber undecided.</p>
            }
          }
        </section>
      }
    </main>
  `,
  styles: `
    .lab {
      padding: 1rem;
      max-width: 90rem;
      margin: 0 auto;
    }
    h1 {
      margin: 0;
    }
    .hint {
      color: var(--dim);
    }
    .hint code {
      font-size: 0.85em;
    }
    .fehler,
    .warn {
      color: var(--warn);
    }
    .marke {
      font-size: 0.8rem;
      font-weight: normal;
      vertical-align: middle;
      padding: 0 0.5rem;
      border: 1px solid var(--line);
      border-radius: 999px;
      color: var(--dim);
    }
    .leiste,
    .regelkopf {
      display: flex;
      flex-wrap: wrap;
      align-items: end;
      gap: 0.5rem 0.8rem;
      margin: 0.6rem 0;
    }
    label {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.15rem;
      font-size: 0.9rem;
    }
    label.haken {
      flex-direction: row;
      align-items: center;
      min-height: 40px;
    }
    input[type='text'],
    input[type='number'],
    select {
      min-height: 36px;
      max-width: 100%;
    }
    button.leise {
      border-color: transparent;
      background: none;
      color: var(--link);
    }
    .arbeit {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 18rem;
      gap: 1rem;
      align-items: start;
    }
    @media (max-width: 800px) {
      .arbeit {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    .flaeche {
      overflow: auto;
      max-height: 70vh;
      border: 1px solid var(--line);
      border-radius: 8px;
      background:
        radial-gradient(circle, var(--line) 1px, transparent 1px) 0 0 / 20px 20px,
        var(--surface);
    }
    /* Chrome beachtet touch-action an SVG-Kindern nicht: also nimmt die
       Leinwand jede Geste selbst — Knoten ziehen, Punkte verbinden, und auf
       freiem Grund verschiebt sie die Fläche (\`schiebe\`). */
    svg {
      display: block;
      touch-action: none;
      user-select: none;
      cursor: grab;
    }
    .knoten rect {
      fill: var(--paper);
      stroke: var(--line);
      stroke-width: 1.5;
      cursor: grab;
    }
    .knoten.ausloeser rect {
      stroke: var(--blue);
    }
    .knoten.bedingung rect {
      stroke: var(--gold);
    }
    .knoten.folge rect {
      stroke: var(--good);
    }
    .knoten.gewaehlt rect {
      stroke-width: 3;
    }
    .knoten.ja rect {
      fill: color-mix(in srgb, var(--good) 22%, var(--paper));
    }
    .knoten.nein rect {
      fill: color-mix(in srgb, var(--hp) 18%, var(--paper));
    }
    .knoten.offen rect {
      fill: color-mix(in srgb, var(--gold) 30%, var(--paper));
    }
    .knoten text {
      fill: var(--ink);
      pointer-events: none;
    }
    .art {
      font-family: var(--caps);
      font-size: 13px;
      fill: var(--dim) !important;
    }
    .satz {
      font-size: 13px;
    }
    .portname {
      font-size: 11px;
      fill: var(--dim) !important;
    }
    .port {
      fill: var(--surface);
      stroke: var(--ink);
      stroke-width: 1.5;
    }
    .port.aus {
      fill: var(--good);
      cursor: crosshair;
    }
    .port.aus.nein {
      fill: var(--hp);
    }
    .draht {
      fill: none;
      stroke: var(--good);
      stroke-width: 2.5;
      cursor: pointer;
    }
    .draht.nein {
      stroke: var(--hp);
      stroke-dasharray: 6 4;
    }
    .draht.gewaehlt {
      stroke-width: 5;
    }
    .draht.zieht {
      stroke: var(--dim);
      stroke-dasharray: 4 4;
      pointer-events: none;
    }
    .pruefer {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      padding: 0.8rem;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--surface);
    }
    .pruefer h2 {
      margin: 0;
      font-size: 1.1rem;
    }
    .probe {
      margin-top: 1.5rem;
    }
    .tabelle {
      overflow-x: auto;
    }
    table {
      border-collapse: collapse;
    }
    td,
    th {
      padding: 0.2rem 0.3rem;
      text-align: left;
      font-size: 0.85rem;
    }
    .mehr {
      width: 12rem;
    }
    .oben {
      display: grid;
      grid-template-columns: 16rem minmax(0, 1fr);
      gap: 1rem;
      align-items: start;
    }
    @media (max-width: 1000px) {
      .oben {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    .uebersicht {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--surface);
      padding: 0.6rem;
      max-height: 85vh;
      overflow: auto;
    }
    @media (max-width: 1000px) {
      .uebersicht {
        max-height: 50vh;
      }
    }
    .uebersicht .leiste {
      margin-top: 0;
    }
    .filter {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem 0.6rem;
      margin-bottom: 0.4rem;
    }
    .filter label {
      flex: 1 1 10rem;
    }
    .filter input[type='search'],
    .filter select {
      width: 100%;
    }
    .engine h2 {
      font-size: 0.95rem;
      margin: 0.7rem 0 0.2rem;
      border-bottom: 1px solid var(--line);
    }
    .zahl-klein {
      color: var(--dim);
      font-weight: normal;
      font-size: 0.8rem;
    }
    .engine ul {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    button.regel {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      width: 100%;
      min-height: 44px;
      padding: 0.3rem 0.5rem;
      margin: 0.15rem 0;
      text-align: left;
      border-color: transparent;
      background: none;
    }
    button.regel small {
      color: var(--dim);
    }
    button.regel.aktiv {
      border-color: var(--accent);
      background: var(--paper);
    }
    button.regel.aus span {
      color: var(--dim);
      text-decoration: line-through;
    }
    .zoom {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      margin-left: auto;
    }
    button.feuer {
      text-align: left;
      min-height: 36px;
      padding: 0.2rem 0;
      color: inherit;
    }
    label.text,
    label.text textarea {
      width: 100%;
    }
    .optionen ul {
      list-style: none;
      padding: 0;
      margin: 0.4rem 0;
    }
    .optionen li {
      display: grid;
      grid-template-columns: minmax(8rem, 14rem) minmax(0, 1fr);
      gap: 0.5rem;
      align-items: start;
      margin: 0.3rem 0;
    }
    @media (max-width: 700px) {
      .optionen li {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    .zahl {
      width: 4.5rem;
    }
    .feuert {
      list-style: none;
      padding: 0;
    }
    .feuert li {
      margin: 0.2rem 0;
    }
  `,
})
export class RegelBuilder {
  protected readonly exp = inject(Experimente);
  private readonly api = inject(Api);
  protected readonly session = inject(Session);

  protected readonly B = B;
  protected readonly H = H;
  protected readonly triggers = RULE_TRIGGERS;
  protected readonly rollen = RULE_ROLES;
  protected readonly vergleiche = RULE_COMPARATORS;

  protected readonly bereit = signal(false);
  /** Die Regelartikel, wie sie vom Server kommen (T-270) — System, Regel, Option. */
  protected readonly artikel = signal<Entity[]>([]);
  /** Die Regeln als Graphen, aus den Artikeln gelesen; bearbeitet wird hier, gespeichert in den Artikel. */
  protected readonly regeln = signal<RuleGraph[]>([]);
  /** Geänderte Texte je Artikel (Regel oder Option), bis „Save". */
  protected readonly texte = signal<Map<string, string>>(new Map());
  protected readonly aktivId = signal<string | null>(null);
  protected readonly geaendert = signal<Set<string>>(new Set());
  protected readonly speichert = signal(false);
  protected readonly fehler = signal<string | null>(null);
  protected readonly knotenWahl = signal<string | null>(null);
  protected readonly drahtWahl = signal<number | null>(null);
  protected readonly ziehen = signal<Ziehen | null>(null);
  protected readonly massstab = signal(1);
  private readonly flaecheRef = viewChild<ElementRef<HTMLElement>>('flaeche');

  /* Filter der Übersicht. */
  protected readonly suche = signal('');
  protected readonly engineFilter = signal('');
  protected readonly triggerFilter = signal('');
  protected readonly nurAktive = signal(false);

  /** Erfundene Kreaturen für den Probelauf — keine Artikel, nichts gespeichert. */
  protected readonly kreaturen = signal<RuleCreature[]>([
    { id: 'a', name: 'Creature A', knows: [], values: { hp: 20, maxHp: 20, reach: 5, reactionFree: 1, freeHands: 0, disengaged: 0 }, x: 30, y: 0 },
    {
      id: 'b',
      name: 'Creature B',
      knows: ['Hellish Rebuke', 'Shield'],
      values: { hp: 15, maxHp: 15, reach: 5, reactionFree: 1, slots1: 2, concentrating: 1, freeHands: 1 },
      x: 0,
      y: 0,
    },
    {
      id: 'c',
      name: 'Creature C',
      knows: ['Snatch Punisher', 'Sentinel', 'Counterspell'],
      values: { hp: 30, maxHp: 30, reach: 10, reactionFree: 1, slots3: 1 },
      x: 25,
      y: 5,
    },
    { id: 'd', name: 'Creature D', knows: ['Regeneration', 'Uncanny Dodge'], values: { hp: 40, maxHp: 60, reach: 10, reactionFree: 1, fireOrAcid: 0 }, x: 100, y: 0 },
  ]);
  protected readonly ereignis = signal<RuleEvent>({ on: 'hit', actor: 'a', target: 'b' });
  protected readonly ergebnis = signal<RuleRunResult | null>(null);
  protected readonly spurFuer = signal<string | null>(null);

  protected readonly aktiv = computed(() => this.regeln().find((g) => g.id === this.aktivId()) ?? null);
  protected readonly gewaehlterKnoten = computed(() => this.aktiv()?.nodes.find((n) => n.id === this.knotenWahl()) ?? null);
  protected readonly probleme = computed(() => {
    const g = this.aktiv();
    return g ? ruleGraphProblems(g) : [];
  });
  protected readonly groesse = computed(() => {
    const ns = this.aktiv()?.nodes ?? [];
    return {
      w: Math.max(400, ...ns.map((n) => n.x + B + 40)),
      h: Math.max(240, ...ns.map((n) => n.y + H + 40)),
    };
  });
  /** Die System-Artikel, in der Reihenfolge der bekannten Systeme, dann nach Namen. */
  protected readonly systeme = computed(() => {
    const bekannt: string[] = [...RULE_ENGINES.map((e) => e.key), ...RULE_SORTS.map((s) => s.key)];
    const rang = (k: string) => (bekannt.includes(k) ? bekannt.indexOf(k) : bekannt.length);
    return this.artikel()
      .filter((e) => ruleArticleKind(e) === 'system' && ruleArticleKey(e))
      .map((e) => ({ id: e.id, key: ruleArticleKey(e)!, label: entityName(e) }))
      .sort((a, b) => rang(a.key) - rang(b.key) || a.label.localeCompare(b.label));
  });
  /** Die Optionen der gewählten Regel — Artikel, die per `partOf` an ihr hängen. */
  protected readonly optionen = computed(() => {
    const id = this.aktivId();
    return this.artikel().filter((e) => ruleArticleKind(e) === 'option' && (e.relations ?? []).some((r) => r.type === 'partOf' && r.to === id));
  });
  protected readonly aktivArtikel = computed(() => this.artikel().find((e) => e.id === this.aktivId()) ?? null);

  /** Die Übersicht: gefiltert, nach System gruppiert. */
  protected readonly gruppen = computed(() => {
    const q = this.suche().trim().toLowerCase();
    const eng = this.engineFilter();
    const tr = this.triggerFilter();
    const passt = (g: RuleGraph) =>
      (!eng || g.engine === eng) &&
      (!tr || g.nodes.some((n) => n.kind === 'trigger' && n.on === tr)) &&
      (!this.nurAktive() || g.enabled) &&
      (!q || g.name.toLowerCase().includes(q) || g.nodes.some((n) => describeRuleNode(n).toLowerCase().includes(q)));
    const gruppen = this.systeme().map((sys) => ({
      key: sys.key,
      label: sys.label,
      regeln: this.regeln()
        .filter((g) => g.engine === sys.key && passt(g))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }));
    /* Regeln ohne System stehen am Ende — sie hängen an nichts, was die Liste kennt. */
    const bekannt = new Set(this.systeme().map((x) => x.key));
    const lose = this.regeln().filter((g) => (!g.engine || !bekannt.has(g.engine)) && passt(g));
    return [...gruppen, { key: '', label: 'Without a system', regeln: lose }].filter((gr) => gr.regeln.length);
  });

  /** Ergebnis je Knoten der aktiven Regel für die gewählte Kreatur. */
  protected readonly spur = computed(() => {
    const m = new Map<string, boolean | null>();
    const r = this.ergebnis();
    const g = this.aktiv();
    const self = this.spurFuer();
    if (!r || !g || !self) return m;
    const lauf = r.runs.find((x) => x.rule === g.id && x.self === self);
    for (const s of lauf?.steps ?? []) m.set(s.node, s.result);
    return m;
  });

  constructor() {
    void this.start();
  }

  private async start(): Promise<void> {
    try {
      await this.exp.lade(true);
      if (this.exp.ruleBuilder()) {
        await this.ladeArtikel();
        const erste = this.gruppen().find((g) => g.regeln.some((r) => r.nodes.length))?.regeln.find((r) => r.nodes.length)?.id ?? this.regeln()[0]?.id;
        if (erste) this.waehle(erste);
      }
    } catch {
      this.fehler.set('The rules could not be loaded.');
    } finally {
      this.bereit.set(true);
    }
  }

  /** Die Regelartikel holen und die Regeln daraus lesen (T-270). Ungespeichertes geht dabei verloren. */
  private async ladeArtikel(): Promise<void> {
    const alle = await this.api.ruleArticles();
    this.artikel.set(alle);
    const systemKey = new Map(alle.filter((e) => ruleArticleKind(e) === 'system').map((e) => [e.id, ruleArticleKey(e)]));
    this.regeln.set(alle.filter((e) => ruleArticleKind(e) === 'rule').map((e) => graphFromArticle(e, (id) => systemKey.get(id))));
    this.geaendert.set(new Set());
    this.texte.set(new Map());
  }

  /* ----------------------------------------------------------- Regeln */

  protected waehle(id: string): void {
    this.aktivId.set(id);
    this.knotenWahl.set(null);
    this.drahtWahl.set(null);
    /* Eine neue Regel steht ganz da: verkleinert, bis sie in die Breite passt. */
    this.massstab.set(1);
    /* Gemessen wird nach dem Zeichnen; beim ersten Laden steht die Fläche erst danach. */
    setTimeout(() => {
      const el = this.flaecheRef()?.nativeElement;
      /* Von selbst nicht kleiner als lesbar; den Rest scrollt man, „Fit" geht weiter. */
      if (el) this.einpassen(el, 0.6);
    }, 50);
  }

  private aendere(id: string, f: (g: RuleGraph) => RuleGraph): void {
    this.regeln.update((rs) => rs.map((g) => (g.id === id ? f(g) : g)));
    this.geaendert.update((s) => new Set(s).add(id));
  }

  protected aendereRegel(teil: Partial<Pick<RuleGraph, 'name' | 'enabled' | 'engine'>>): void {
    const id = this.aktivId();
    if (id) this.aendere(id, (g) => ({ ...g, ...teil }));
  }

  /** Der Text eines Artikels, wie er gerade bearbeitet wird. */
  protected textVon(id: string): string {
    const neu = this.texte().get(id);
    if (neu !== undefined) return neu;
    const d = this.artikel().find((e) => e.id === id)?.components?.['Description']?.['description'];
    return typeof d === 'string' ? d : '';
  }

  protected setzeText(id: string, text: string): void {
    this.texte.update((m) => new Map(m).set(id, text));
    this.geaendert.update((s) => new Set(s).add(id));
  }

  protected optionsName(e: Entity): string {
    return entityName(e);
  }

  /**
   * **Eine neue Regel** ist ein Regelartikel (T-270): angelegt wie jeder
   * Artikel, in der Schreibebene, an das gewählte System gehängt.
   */
  protected async neueRegel(): Promise<void> {
    const sys = this.systeme().find((x) => x.key === this.engineFilter()) ?? this.systeme().find((x) => x.key === this.aktiv()?.engine);
    const name = prompt('Name of the new rule', 'New rule')?.trim();
    if (!name) return;
    this.fehler.set(null);
    try {
      const graph = { enabled: true, nodes: [{ id: 'n1', kind: 'trigger', x: 20, y: 30, on: 'attacked' }], wires: [] };
      const e = await this.api.createEntity('Rule', name, { 'Rule.kind': 'rule', 'Rule.autolink': false, 'Rule.graph': graph }, sys ? [{ type: 'partOf', to: sys.id }] : []);
      await this.ladeArtikel();
      this.waehle(e.id);
    } catch (error) {
      this.fehler.set(error instanceof ApiError ? error.message : 'The rule could not be created.');
    }
  }

  /**
   * **Die Beispiele als Artikel:** was es noch nicht gibt (nach Namen), in
   * der Schreibebene, an das System seiner Engine — gibt es das System
   * nicht, bleibt das Beispiel weg und die Meldung sagt es.
   */
  protected async beispiele(): Promise<void> {
    const da = new Set(this.regeln().map((g) => g.name.toLowerCase()));
    const neu = exampleRuleGraphs().filter((g) => !da.has(g.name.toLowerCase()));
    if (!neu.length) return;
    if (!confirm(`Create ${neu.length} example rules as articles in your write layer?`)) return;
    this.fehler.set(null);
    const ohne: string[] = [];
    try {
      for (const g of neu) {
        const sys = this.systeme().find((x) => x.key === g.engine);
        if (!sys) {
          ohne.push(g.name);
          continue;
        }
        await this.api.createEntity(
          'Rule',
          g.name,
          { 'Rule.kind': 'rule', 'Rule.autolink': false, 'Rule.graph': { enabled: g.enabled, nodes: g.nodes, wires: g.wires } },
          [{ type: 'partOf', to: sys.id }],
        );
      }
      await this.ladeArtikel();
      if (ohne.length) this.fehler.set(`No system article for: ${ohne.join(', ')}.`);
    } catch (error) {
      this.fehler.set(error instanceof ApiError ? error.message : 'The examples could not be created.');
    }
  }

  /**
   * **Speichern heisst: in die Artikel schreiben** (T-270). Je geänderter
   * Regel der ganze Artikel, frisch geholt, mit Namen, Text, Graph und dem
   * System als `partOf`; je geänderter Option ihr Text. Schreibrecht und
   * `validateEntity` prüft der Server.
   */
  protected async speichern(): Promise<void> {
    this.speichert.set(true);
    this.fehler.set(null);
    const sysIds = new Map(this.systeme().map((x) => [x.key, x.id]));
    const alleSys = new Set(this.systeme().map((x) => x.id));
    try {
      for (const id of this.geaendert()) {
        const { refs: _r, fromTemplate: _t, ...roh } = (await this.api.entity(id)) as Entity & { refs?: unknown; fromTemplate?: unknown };
        let neu = roh as Entity;
        const g = this.regeln().find((x) => x.id === id);
        if (g) {
          neu = articleWithGraph(neu, g);
          /* Das System ist die Kante: die alte auf ein System geht, die neue kommt. */
          const ziel = g.engine ? sysIds.get(g.engine) : undefined;
          const rel = (neu.relations ?? []).filter((r) => !(r.type === 'partOf' && alleSys.has(r.to)));
          if (ziel) rel.push({ id: `rel_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`, type: 'partOf', to: ziel, props: {} });
          neu = { ...neu, relations: rel };
        }
        const text = this.texte().get(id);
        if (text !== undefined) neu = { ...neu, components: { ...neu.components, Description: { ...(neu.components['Description'] ?? {}), description: text } } };
        await this.api.putEntity(neu);
      }
      await this.ladeArtikel();
    } catch (error) {
      this.fehler.set(error instanceof ApiError ? error.message : 'Saving failed.');
    } finally {
      this.speichert.set(false);
    }
  }

  /** Löschen nur, was die Laufzeit nicht kennt — eine Regel mit Schlüssel fehlte sonst in Rules & options. */
  protected darfLoeschen(id: string): boolean {
    const e = this.artikel().find((x) => x.id === id);
    return !!e && !ruleArticleKey(e);
  }

  protected async loeschen(g: RuleGraph): Promise<void> {
    if (!this.darfLoeschen(g.id) || !confirm(`Delete the rule article “${g.name}”?`)) return;
    try {
      await this.api.deleteEntity(g.id);
      await this.ladeArtikel();
      this.waehle(this.regeln()[0]?.id ?? '');
    } catch (error) {
      this.fehler.set(error instanceof ApiError ? error.message : 'The rule could not be deleted.');
    }
  }

  /* ----------------------------------------------------------- Knoten */

  protected artName(n: RuleNode): string {
    return n.kind === 'trigger' ? 'Trigger' : n.kind === 'condition' ? 'If' : 'Then';
  }

  /** Der Satz eines Knotens in höchstens zwei Zeilen — SVG bricht nicht um. */
  protected zeilen(n: RuleNode): string[] {
    const woerter = describeRuleNode(n).split(' ');
    const out: string[] = [''];
    for (const w of woerter) {
      const z = out[out.length - 1]!;
      if ((z + ' ' + w).trim().length > 27 && z) {
        if (out.length === 2) {
          out[1] = `${z.slice(0, 25)}…`;
          return out;
        }
        out.push(w);
      } else out[out.length - 1] = (z + ' ' + w).trim();
    }
    return out;
  }

  protected neuerKnoten(kind: RuleNode['kind']): void {
    const g = this.aktiv();
    if (!g) return;
    let i = g.nodes.length + 1;
    while (g.nodes.some((n) => n.id === `n${i}`)) i++;
    const id = `n${i}`;
    const x = 20 + ((g.nodes.length * 240) % 960);
    const y = 40 + Math.floor((g.nodes.length * 240) / 960) * 140 + 280;
    const n: RuleNode =
      kind === 'trigger'
        ? { id, kind, x, y, on: 'attacked' }
        : kind === 'condition'
          ? { id, kind, x, y, test: { kind: 'compare', left: 'distance', op: '<=', right: '5' } }
          : { id, kind, x, y, then: { kind: 'offerReaction', name: 'Opportunity attack', to: 'self', against: 'actor' } };
    this.aendere(g.id, (r) => ({ ...r, nodes: [...r.nodes, n] }));
    this.knotenWahl.set(id);
  }

  private setze(id: string, f: (n: RuleNode) => RuleNode): void {
    const g = this.aktiv();
    if (g) this.aendere(g.id, (r) => ({ ...r, nodes: r.nodes.map((n) => (n.id === id ? f(n) : n)) }));
  }

  protected setzeKnoten(id: string, teil: { on: RuleTriggerKey }): void {
    this.setze(id, (n) => (n.kind === 'trigger' ? { ...n, ...teil } : n));
  }

  protected setzeTestArt(id: string, art: RuleTest['kind']): void {
    const test: RuleTest =
      art === 'compare'
        ? { kind: 'compare', left: 'distance', op: '<=', right: '5' }
        : art === 'knows'
          ? { kind: 'knows', who: 'self', name: '' }
          : { kind: 'same', a: 'self', b: 'target' };
    this.setze(id, (n) => (n.kind === 'condition' ? { ...n, test } : n));
  }

  protected setzeTest(id: string, teil: Partial<{ left: string; op: RuleComparator; right: string; who: RuleRole; name: string; a: RuleRole; b: RuleRole; not: boolean }>): void {
    this.setze(id, (n) => (n.kind === 'condition' ? { ...n, test: { ...n.test, ...teil } as RuleTest } : n));
  }

  protected setzeFolgeArt(id: string, art: RuleOutcome['kind']): void {
    const then: RuleOutcome =
      art === 'offerReaction'
        ? { kind: art, name: '', to: 'self', against: 'actor' }
        : art === 'applyEffect'
          ? { kind: art, name: '', to: 'target' }
          : art === 'blockAction'
            ? { kind: art, action: '', reason: '', to: 'self' }
            : { kind: art, field: 'hp', expr: 'self.hp', to: 'self' };
    this.setze(id, (n) => (n.kind === 'outcome' ? { ...n, then } : n));
  }

  protected folgeFelder(o: RuleOutcome): { key: string; label: string; wert: string; rolle?: boolean }[] {
    switch (o.kind) {
      case 'offerReaction':
        return [
          { key: 'name', label: 'Reaction', wert: o.name },
          { key: 'to', label: 'Offered to', wert: o.to, rolle: true },
          { key: 'against', label: 'Aimed at', wert: o.against, rolle: true },
        ];
      case 'applyEffect':
        return [
          { key: 'name', label: 'Effect', wert: o.name },
          { key: 'to', label: 'On', wert: o.to, rolle: true },
        ];
      case 'blockAction':
        return [
          { key: 'action', label: 'Action', wert: o.action },
          { key: 'reason', label: 'Reason', wert: o.reason },
          { key: 'to', label: 'For', wert: o.to, rolle: true },
        ];
      case 'changeValue':
        return [
          { key: 'field', label: 'Value', wert: o.field },
          { key: 'expr', label: 'Becomes', wert: o.expr },
          { key: 'to', label: 'Of', wert: o.to, rolle: true },
        ];
    }
  }

  protected setzeFolge(id: string, key: string, wert: string): void {
    this.setze(id, (n) => (n.kind === 'outcome' ? { ...n, then: { ...n.then, [key]: wert } as RuleOutcome } : n));
  }

  protected loescheKnoten(id: string): void {
    const g = this.aktiv();
    if (!g) return;
    this.aendere(g.id, (r) => ({ ...r, nodes: r.nodes.filter((n) => n.id !== id), wires: r.wires.filter((w) => w.from !== id && w.to !== id) }));
    this.knotenWahl.set(null);
  }

  protected ziele(von: string): { id: string; label: string }[] {
    return (this.aktiv()?.nodes ?? [])
      .filter((n) => n.id !== von && n.kind !== 'trigger')
      .map((n) => ({ id: n.id, label: `${this.artName(n)}: ${describeRuleNode(n)}` }));
  }

  protected verbinde(von: string, nach: string, port?: 'yes' | 'no'): void {
    const g = this.aktiv();
    if (!g || !nach || von === nach) return;
    const quelle = g.nodes.find((n) => n.id === von);
    const ziel = g.nodes.find((n) => n.id === nach);
    if (!quelle || !ziel || ziel.kind === 'trigger' || quelle.kind === 'outcome') return;
    const p = quelle.kind === 'condition' ? (port ?? 'yes') : undefined;
    if (g.wires.some((w) => w.from === von && w.to === nach && w.port === p)) return;
    const w: RuleWire = p ? { from: von, to: nach, port: p } : { from: von, to: nach };
    this.aendere(g.id, (r) => ({ ...r, wires: [...r.wires, w] }));
  }

  protected loescheDraht(): void {
    const g = this.aktiv();
    const i = this.drahtWahl();
    if (!g || i === null) return;
    this.aendere(g.id, (r) => ({ ...r, wires: r.wires.filter((_, j) => j !== i) }));
    this.drahtWahl.set(null);
  }

  /* ----------------------------------------------------------- Leinwand */

  private punkt(ev: PointerEvent, svg: Element): { x: number; y: number } {
    /* Die Vorlage typisiert die Referenz als HTMLElement; sie ist das <svg>. */
    const m = (svg as SVGSVGElement).getScreenCTM?.();
    if (!m) return { x: ev.offsetX, y: ev.offsetY };
    const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  }

  private ausgang(g: RuleGraph, id: string, port?: 'yes' | 'no'): { x: number; y: number } | null {
    const n = g.nodes.find((x) => x.id === id);
    if (!n) return null;
    const y = n.kind === 'condition' ? (port === 'no' ? 54 : 24) : H / 2;
    return { x: n.x + B, y: n.y + y };
  }

  protected pfadVon(g: RuleGraph, von: string, port: 'yes' | 'no' | undefined, x2: number, y2: number): string {
    const a = this.ausgang(g, von, port);
    if (!a) return '';
    const k = Math.max(40, Math.abs(x2 - a.x) / 2);
    return `M ${a.x} ${a.y} C ${a.x + k} ${a.y}, ${x2 - k} ${y2}, ${x2} ${y2}`;
  }

  protected pfad(g: RuleGraph, w: RuleWire): string {
    const z = g.nodes.find((n) => n.id === w.to);
    if (!z) return '';
    return this.pfadVon(g, w.from, w.port, z.x, z.y + H / 2);
  }

  /** Ziehen auf freiem Grund verschiebt die Fläche — mit Finger wie Maus. */
  protected schiebe(ev: PointerEvent, svg: Element, flaeche: HTMLElement): void {
    /* Eine Verbindung bleibt anklickbar: dort beginnt kein Verschieben. */
    if (this.ziehen() || (ev.target as Element | null)?.closest?.('path.draht')) return;
    this.halte(ev, svg);
    this.ziehen.set({ art: 'flaeche', x: ev.clientX, y: ev.clientY, el: flaeche });
  }

  /** Die Geste bleibt bei der Leinwand, auch wenn der Finger sie verlässt. */
  private halte(ev: PointerEvent, svg: Element): void {
    try {
      svg.setPointerCapture?.(ev.pointerId);
    } catch {
      /* Ohne Erfassung endet das Ziehen am Rand — nicht schlimm. */
    }
  }

  protected greife(ev: PointerEvent, n: RuleNode, svg: Element): void {
    ev.preventDefault();
    ev.stopPropagation();
    this.halte(ev, svg);
    const p = this.punkt(ev, svg);
    this.knotenWahl.set(n.id);
    this.drahtWahl.set(null);
    this.ziehen.set({ art: 'knoten', id: n.id, dx: p.x - n.x, dy: p.y - n.y });
  }

  protected zieheDraht(ev: PointerEvent, von: string, port: 'yes' | 'no' | undefined, svg: Element): void {
    ev.preventDefault();
    ev.stopPropagation();
    this.halte(ev, svg);
    const p = this.punkt(ev, svg);
    this.ziehen.set({ art: 'draht', von, port, x: p.x, y: p.y });
  }

  protected bewege(ev: PointerEvent, svg: Element): void {
    const z = this.ziehen();
    if (!z) return;
    if (z.art === 'flaeche') {
      const dx = ev.clientX - z.x;
      const dy = ev.clientY - z.y;
      const vorher = z.el.scrollTop;
      z.el.scrollLeft -= dx;
      z.el.scrollTop -= dy;
      /* Was die Fläche senkrecht nicht mehr nehmen kann, scrollt die Seite. */
      const rest = -dy - (z.el.scrollTop - vorher);
      if (Math.abs(rest) > 0.5) window.scrollBy(0, rest);
      this.ziehen.set({ ...z, x: ev.clientX, y: ev.clientY });
      return;
    }
    const p = this.punkt(ev, svg);
    if (z.art === 'draht') {
      this.ziehen.set({ ...z, x: p.x, y: p.y });
      return;
    }
    const x = Math.max(0, Math.round((p.x - z.dx) / 10) * 10);
    const y = Math.max(0, Math.round((p.y - z.dy) / 10) * 10);
    this.setze(z.id, (n) => ({ ...n, x, y }));
  }

  protected loslassen(ev: PointerEvent, svg: Element): void {
    const z = this.ziehen();
    this.ziehen.set(null);
    if (z?.art !== 'draht') return;
    /* Getroffen ist, über welchem Knoten der Zeiger losliess. */
    const p = this.punkt(ev, svg);
    const ziel = this.aktiv()?.nodes.find((n) => p.x >= n.x && p.x <= n.x + B && p.y >= n.y && p.y <= n.y + H);
    if (ziel) this.verbinde(z.von, ziel.id, z.port);
  }

  /* ----------------------------------------------------------- Zoom */

  protected zoome(richtung: 1 | -1): void {
    const stufen = [0.4, 0.5, 0.6, 0.75, 0.9, 1, 1.25, 1.5];
    const i = stufen.findIndex((x) => x >= this.massstab() - 0.001);
    const j = Math.min(stufen.length - 1, Math.max(0, (i < 0 ? stufen.length - 1 : i) + richtung));
    this.massstab.set(stufen[j]!);
  }

  /** So klein, dass die ganze Regel in die Breite der Fläche passt (höchstens 100 %). */
  protected einpassen(flaeche: HTMLElement, mindestens = 0.3): void {
    const breite = flaeche.clientWidth - 4;
    if (breite > 0) this.massstab.set(Math.max(mindestens, Math.min(1, breite / this.groesse().w)));
  }

  /* ----------------------------------------------------------- Probelauf */

  protected liste(s: string): string[] {
    return s
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
  }

  protected setzeKreatur(id: string, teil: Partial<RuleCreature>): void {
    this.kreaturen.update((cs) => cs.map((c) => (c.id === id ? { ...c, ...teil } : c)));
  }

  /** Die Werte ausser denen mit eigener Spalte, als `name=zahl, …`. */
  protected weitere(c: RuleCreature): string {
    return Object.entries(c.values)
      .filter(([k]) => !EIGENE_SPALTEN.has(k))
      .map(([k, v]) => `${k}=${v}`)
      .join(', ');
  }

  protected setzeWeitere(id: string, roh: string): void {
    const neu: Record<string, number> = {};
    for (const teil of roh.split(',')) {
      const m = /^\s*([A-Za-z_]\w*)\s*=\s*(-?\d+(?:\.\d+)?)\s*$/.exec(teil);
      if (m && !EIGENE_SPALTEN.has(m[1]!)) neu[m[1]!] = Number(m[2]);
    }
    this.kreaturen.update((cs) =>
      cs.map((c) => {
        if (c.id !== id) return c;
        const bleiben = Object.fromEntries(Object.entries(c.values).filter(([k]) => EIGENE_SPALTEN.has(k)));
        return { ...c, values: { ...bleiben, ...neu } };
      }),
    );
  }

  /** Ein Treffer der Liste zeigt seine Regel und den Weg der Kreatur. */
  protected zeigeFeuer(regel: string, self: string): void {
    this.waehle(regel);
    this.spurFuer.set(self);
  }

  protected ausloeserVon(g: RuleGraph): string {
    const t = g.nodes.filter((n) => n.kind === 'trigger').map((n) => (n.kind === 'trigger' ? n.on : ''));
    return t.length ? t.join(', ') : 'no trigger';
  }

  protected setzeWert(id: string, key: string, roh: string): void {
    const n = Number(roh);
    this.kreaturen.update((cs) =>
      cs.map((c) => {
        if (c.id !== id) return c;
        const values = { ...c.values };
        if (roh === '' || !Number.isFinite(n)) delete values[key];
        else values[key] = n;
        return { ...c, values };
      }),
    );
  }

  protected neueKreatur(): void {
    const cs = this.kreaturen();
    let i = cs.length;
    while (cs.some((c) => c.id === `k${i}`)) i++;
    const buchstabe = String.fromCharCode(65 + (cs.length % 26));
    this.kreaturen.set([...cs, { id: `k${i}`, name: `Creature ${buchstabe}`, knows: [], values: { hp: 10, reach: 5, reactionFree: 1 }, x: 0, y: 0 }]);
  }

  protected entferneKreatur(id: string): void {
    this.kreaturen.update((cs) => cs.filter((c) => c.id !== id));
    const e = this.ereignis();
    if (e.actor === id || e.target === id) this.ereignis.set({ ...e, actor: e.actor === id ? (this.kreaturen()[0]?.id ?? '') : e.actor, target: e.target === id ? undefined : e.target });
  }

  protected setzeEreignis(teil: Partial<RuleEvent>): void {
    this.ereignis.update((e) => ({ ...e, ...teil }));
  }

  /** Nur Anzeige: gerechnet wird im Speicher, gespeichert wird nichts. */
  protected probe(): void {
    const r = runRules(this.regeln(), this.ereignis(), this.kreaturen());
    this.ergebnis.set(r);
    this.spurFuer.set(r.firings.find((f) => f.rule === this.aktivId())?.self ?? r.firings[0]?.self ?? null);
  }
}

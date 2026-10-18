import { Component, computed, inject, signal } from '@angular/core';
import {
  describeRuleNode,
  exampleRuleGraphs,
  ruleGraphProblems,
  runRules,
  RULE_COMPARATORS,
  RULE_ROLES,
  RULE_TRIGGERS,
  type RuleComparator,
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
import { Experimente } from '../kern/experimente';
import { Session } from '../kern/session';

/** Masse eines Knotens auf der Leinwand. */
const B = 210;
const H = 76;

type Ziehen =
  | { art: 'knoten'; id: string; dx: number; dy: number }
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
        <div class="leiste">
          <label>
            Rule
            <select (change)="waehle($any($event.target).value)">
              @for (g of regeln(); track g.id) {
                <option [value]="g.id" [selected]="g.id === (aktivId() ?? '')">{{ g.name }}{{ g.enabled ? '' : ' (off)' }}{{ geaendert().has(g.id) ? ' •' : '' }}</option>
              }
            </select>
          </label>
          <button type="button" (click)="neueRegel()">New rule</button>
          <button type="button" (click)="beispiele()">Add examples</button>
          <button type="button" class="pri" [disabled]="!geaendert().size || speichert()" (click)="speichern()">
            {{ speichert() ? 'Saving…' : 'Save' }}
          </button>
        </div>

        @if (aktiv(); as g) {
          <div class="regelkopf">
            <label>Name <input type="text" [value]="g.name" (change)="aendereRegel({ name: $any($event.target).value })" /></label>
            <label class="haken"
              ><input type="checkbox" [checked]="g.enabled" (change)="aendereRegel({ enabled: $any($event.target).checked })" /> Active</label
            >
            <button type="button" class="leise" (click)="loeschen(g)">Delete rule</button>
          </div>
          <div class="leiste">
            <span class="hint">Add:</span>
            <button type="button" (click)="neuerKnoten('trigger')">Trigger</button>
            <button type="button" (click)="neuerKnoten('condition')">Condition</button>
            <button type="button" (click)="neuerKnoten('outcome')">Outcome</button>
          </div>
          @for (p of probleme(); track p) {
            <p class="warn">{{ p }}</p>
          }

          <div class="arbeit">
            <div class="flaeche" aria-label="Rule canvas">
              <svg
                #svg
                [attr.width]="groesse().w"
                [attr.height]="groesse().h"
                (pointermove)="bewege($event, svg)"
                (pointerup)="loslassen($event, svg)"
                (pointerleave)="ziehen.set(null)"
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
        }

        <section class="probe" aria-labelledby="probe-titel">
          <h2 id="probe-titel">Try it</h2>
          <p class="hint">Made-up creatures for a dry run. Positions are in feet; “reaction free” counts as 1 or 0.</p>
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
            <button type="button" class="pri" (click)="probe()">Run</button>
          </div>

          @if (ergebnis(); as r) {
            <h3>What fires</h3>
            <ul class="feuert">
              @for (f of r.firings; track $index) {
                <li><strong>{{ f.ruleName }}:</strong> {{ f.text }}</li>
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
    svg {
      display: block;
      touch-action: none;
      user-select: none;
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
    .zahl {
      width: 4.5rem;
    }
    .feuert li {
      margin: 0.2rem 0;
    }
  `,
})
export class RegelBuilder {
  protected readonly exp = inject(Experimente);
  protected readonly session = inject(Session);

  protected readonly B = B;
  protected readonly H = H;
  protected readonly triggers = RULE_TRIGGERS;
  protected readonly rollen = RULE_ROLES;
  protected readonly vergleiche = RULE_COMPARATORS;

  protected readonly bereit = signal(false);
  protected readonly regeln = signal<RuleGraph[]>([]);
  protected readonly aktivId = signal<string | null>(null);
  protected readonly geaendert = signal<Set<string>>(new Set());
  protected readonly speichert = signal(false);
  protected readonly fehler = signal<string | null>(null);
  protected readonly knotenWahl = signal<string | null>(null);
  protected readonly drahtWahl = signal<number | null>(null);
  protected readonly ziehen = signal<Ziehen | null>(null);

  /** Erfundene Kreaturen für den Probelauf — keine Artikel, nichts gespeichert. */
  protected readonly kreaturen = signal<RuleCreature[]>([
    { id: 'a', name: 'Creature A', knows: [], values: { hp: 20, reach: 5, reactionFree: 1 }, x: 30, y: 0 },
    { id: 'b', name: 'Creature B', knows: ['Hellish Rebuke'], values: { hp: 15, reach: 5, reactionFree: 1 }, x: 0, y: 0 },
    { id: 'c', name: 'Creature C', knows: ['Snatch Punisher'], values: { hp: 30, reach: 10, reactionFree: 1 }, x: 25, y: 5 },
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
      w: Math.max(640, ...ns.map((n) => n.x + B + 60)),
      h: Math.max(320, ...ns.map((n) => n.y + H + 60)),
    };
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
        const gespeichert = await this.exp.regeln();
        const regeln = gespeichert.length ? gespeichert : exampleRuleGraphs();
        this.regeln.set(regeln);
        /* Die Beispiele gelten als ungespeichert, bis jemand „Save" sagt. */
        if (!gespeichert.length) this.geaendert.set(new Set(regeln.map((g) => g.id)));
        this.aktivId.set(regeln[0]?.id ?? null);
      }
    } catch {
      this.fehler.set('The rules could not be loaded.');
    } finally {
      this.bereit.set(true);
    }
  }

  /* ----------------------------------------------------------- Regeln */

  protected waehle(id: string): void {
    this.aktivId.set(id);
    this.knotenWahl.set(null);
    this.drahtWahl.set(null);
  }

  private aendere(id: string, f: (g: RuleGraph) => RuleGraph): void {
    this.regeln.update((rs) => rs.map((g) => (g.id === id ? f(g) : g)));
    this.geaendert.update((s) => new Set(s).add(id));
  }

  protected aendereRegel(teil: Partial<Pick<RuleGraph, 'name' | 'enabled'>>): void {
    const id = this.aktivId();
    if (id) this.aendere(id, (g) => ({ ...g, ...teil }));
  }

  protected neueRegel(): void {
    const id = `rule-${Date.now().toString(36)}`;
    const g: RuleGraph = { id, name: 'New rule', enabled: true, nodes: [{ id: 'n1', kind: 'trigger', x: 20, y: 40, on: 'attacked' }], wires: [] };
    this.regeln.update((rs) => [...rs, g]);
    this.geaendert.update((s) => new Set(s).add(id));
    this.waehle(id);
  }

  protected beispiele(): void {
    const da = new Set(this.regeln().map((g) => g.id));
    const neu = exampleRuleGraphs().filter((g) => !da.has(g.id));
    if (!neu.length) return;
    this.regeln.update((rs) => [...rs, ...neu]);
    this.geaendert.update((s) => new Set([...s, ...neu.map((g) => g.id)]));
    this.waehle(neu[0]!.id);
  }

  protected async speichern(): Promise<void> {
    this.speichert.set(true);
    this.fehler.set(null);
    try {
      for (const id of this.geaendert()) {
        const g = this.regeln().find((x) => x.id === id);
        if (g) await this.exp.speichereRegel(g);
      }
      this.geaendert.set(new Set());
    } catch {
      this.fehler.set('Saving failed — a rule may be too large (8000 characters each).');
    } finally {
      this.speichert.set(false);
    }
  }

  protected async loeschen(g: RuleGraph): Promise<void> {
    if (!confirm(`Delete the rule “${g.name}”?`)) return;
    try {
      await this.exp.loescheRegel(g.id);
    } catch {
      /* Ungespeichert gab es sie am Server nicht. */
    }
    this.regeln.update((rs) => rs.filter((x) => x.id !== g.id));
    this.geaendert.update((s) => {
      const n = new Set(s);
      n.delete(g.id);
      return n;
    });
    this.waehle(this.regeln()[0]?.id ?? '');
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

  protected greife(ev: PointerEvent, n: RuleNode, svg: Element): void {
    ev.preventDefault();
    const p = this.punkt(ev, svg);
    this.knotenWahl.set(n.id);
    this.drahtWahl.set(null);
    this.ziehen.set({ art: 'knoten', id: n.id, dx: p.x - n.x, dy: p.y - n.y });
  }

  protected zieheDraht(ev: PointerEvent, von: string, port: 'yes' | 'no' | undefined, svg: Element): void {
    ev.preventDefault();
    ev.stopPropagation();
    const p = this.punkt(ev, svg);
    this.ziehen.set({ art: 'draht', von, port, x: p.x, y: p.y });
  }

  protected bewege(ev: PointerEvent, svg: Element): void {
    const z = this.ziehen();
    if (!z) return;
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

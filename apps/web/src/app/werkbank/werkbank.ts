import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { fieldsOf } from '@nw/model';
import {
  Api,
  ApiError,
  type BulkAntwort,
  type BulkLauf,
  type CheckHit,
  type CheckResult,
  type ChecksAntwort,
  type UndoAntwort,
  type Wartend,
} from '../kern/api';
import { Bestand } from '../kern/bestand';
import { Session } from '../kern/session';
import { BEDINGUNGEN, OPS, auftragAus, formularFehlt, leeresFormular, type Formular } from './auftrag';

/**
 * **Die Werkbank** (W9): Prüfungen über den ganzen Bestand und
 * Massenänderungen — für Leitung und Verwaltung.
 *
 * Die Prüfungen kommen als Zahlen und klappen zu ihren Treffern auf (mit
 * Link zum Artikel). Eine Massenänderung geht in drei Schritten: Auswahl →
 * **Vorschau** (`dryRun`, schreibt nichts) → Ausführen, und Ausführen geht
 * nur für genau den Auftrag, dessen Vorschau dasteht. Danach steht er in
 * der Liste darunter und lässt sich zurücknehmen.
 *
 * Gerechnet wird am Server: was die Seite zeigt, ist die Antwort, nicht
 * eine zweite Rechnung hier.
 */
@Component({
  selector: 'nw-werkbank',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="seite">
      <header class="kopf">
        <h1>Workbench</h1>
        <p class="hinweis">
          Checks over the whole stock, and bulk changes. Every change goes through validation and
          can be undone.
        </p>
      </header>

      @if (!session.leitung()) {
        <p class="leer">The workbench is for game masters and the administration.</p>
      } @else {
        <!-- REQ-237: was Spielende angelegt haben und nicht ready ist. Die
             eigene Figur wartet auf niemanden (E-014 d) und steht nicht da. -->
        <section class="block" aria-labelledby="h-wartet">
          <div class="titel">
            <h2 id="h-wartet">Not ready, by players</h2>
            <span class="dim">{{ wartend().length }}</span>
          </div>
          @if (wartetFehler()) {
            <p class="fehler" role="alert">{{ wartetFehler() }}</p>
          }
          @if (wartend().length) {
            <ul class="treffer wartet">
              @for (w of wartend(); track w.id) {
                <li>
                  <a [routerLink]="['/artikel', w.id]">{{ w.name || w.id }}</a>
                  <span class="art">{{ w.type }}</span>
                  <span class="grund">
                    {{ w.status || 'no status' }} · by {{ w.authors.join(', ') || '?' }}
                    @if (w.readyAt) {
                      · the version from {{ datum(w.readyAt) }} applies
                    } @else {
                      · never ready
                    }
                  </span>
                  @if (w.canReady) {
                    <button type="button" class="klein" [disabled]="setzt() === w.id" (click)="fertigNennen(w)">
                      {{ setzt() === w.id ? 'Saving…' : 'ready' }}
                    </button>
                  }
                </li>
              }
            </ul>
          } @else if (!wartetFehler()) {
            <p class="leer">Nothing waits — every article players made is ready.</p>
          }
        </section>

        <section class="block" aria-labelledby="h-checks">
          <div class="titel">
            <h2 id="h-checks">Checks</h2>
            @if (pruefung(); as p) {
              <span class="dim">{{ p.total }} articles · {{ p.ms }} ms</span>
            }
            <button type="button" (click)="pruefen()" [disabled]="prueft()">
              {{ prueft() ? 'Checking…' : 'Run again' }}
            </button>
          </div>
          @if (pruefFehler()) {
            <p class="fehler" role="alert">{{ pruefFehler() }}</p>
          }
          <ul class="checks">
            @for (c of pruefung()?.checks ?? []; track c.key) {
              <li [class.null]="!c.count">
                <button
                  type="button"
                  class="zeile"
                  (click)="aufklappen(c)"
                  [disabled]="!c.count"
                  [attr.aria-expanded]="offen() === c.key"
                >
                  <span class="zahl">{{ c.count }}</span>
                  <span class="name">{{ c.label }}</span>
                  @if (c.count) {
                    <span class="pfeil" aria-hidden="true">{{ offen() === c.key ? '▾' : '▸' }}</span>
                  }
                </button>
                <p class="beschr">{{ c.description }}</p>
                @if (offen() === c.key) {
                  @if (treffer(); as t) {
                    <ul class="treffer">
                      @for (h of t.hits; track h.id) {
                        <li>
                          <a [routerLink]="['/artikel', h.id]">{{ h.name || h.id }}</a>
                          <span class="art">{{ h.type }}</span>
                          <span class="grund">{{ h.reason }}</span>
                          @if (h.group) {
                            <span class="gruppe">
                              @for (g of h.group.slice(0, 8); track g; let i = $index) {
                                <a [routerLink]="['/artikel', g]" [title]="g">{{ i + 1 }}</a>
                              }
                              @if (h.group.length > 8) {
                                <span class="dim">+{{ h.group.length - 8 }}</span>
                              }
                              <button type="button" class="klein" (click)="gruppeZusammenfuehren(h)">
                                Merge…
                              </button>
                            </span>
                          }
                        </li>
                      }
                    </ul>
                    <div class="aktionen">
                      @if (t.hits.length < c.count) {
                        <button type="button" class="klein" (click)="alleTreffer(c)">
                          Show all {{ c.count }}
                        </button>
                      }
                      <button type="button" class="klein" (click)="alsAuswahl(c)">
                        Use as selection
                      </button>
                    </div>
                  } @else {
                    <p class="leer">Loading…</p>
                  }
                }
              </li>
            } @empty {
              @if (prueft()) {
                <li class="leer">Checking…</li>
              }
            }
          </ul>
        </section>

        <section class="block" id="massen" aria-labelledby="h-bulk">
          <h2 id="h-bulk">Bulk change</h2>
          <form (ngSubmit)="vorschauen()">
            <fieldset>
              <legend>1 · Which articles</legend>
              <div class="raster">
                <label>
                  Type
                  <select name="type" [(ngModel)]="f.type">
                    <option value="">any</option>
                    @for (t of arten(); track t) {
                      <option [value]="t">{{ t }}</option>
                    }
                  </select>
                </label>
                <label>
                  Layer
                  <select name="layer" [(ngModel)]="f.layer">
                    <option value="">any</option>
                    @for (l of ebenen(); track l.id) {
                      <option [value]="l.id">{{ l.name }}</option>
                    }
                  </select>
                </label>
                <label>
                  Tag
                  <input name="tag" [(ngModel)]="f.tag" placeholder="any" />
                </label>
              </div>
              <div class="bedingungen">
                @for (w of f.where; track $index; let i = $index) {
                  <div class="bedingung">
                    <input
                      [name]="'wf' + i"
                      [attr.name]="'wf' + i"
                      [(ngModel)]="w.field"
                      list="felder"
                      aria-label="Field"
                      placeholder="name or Card.field"
                    />
                    <select [name]="'wo' + i"
                      [attr.name]="'wo' + i" [(ngModel)]="w.op" aria-label="Condition">
                      @for (b of bedingungen; track b.op) {
                        <option [value]="b.op">{{ b.label }}</option>
                      }
                    </select>
                    @if (!ohneWert(w.op)) {
                      <input [name]="'wv' + i"
                      [attr.name]="'wv' + i" [(ngModel)]="w.value" aria-label="Value" placeholder="value" />
                    }
                    <button type="button" class="klein" (click)="f.where.splice(i, 1)" aria-label="Remove condition">
                      ×
                    </button>
                  </div>
                }
                <button type="button" class="klein" (click)="f.where.push({ field: '', op: 'eq', value: '' })">
                  + Condition
                </button>
              </div>
              <label class="breit">
                Ids or numbers (optional, one per line)
                <textarea name="ids" rows="2" [(ngModel)]="f.ids"></textarea>
              </label>
              <datalist id="felder">
                @for (x of felder(); track x) {
                  <option [value]="x"></option>
                }
              </datalist>
            </fieldset>

            <fieldset>
              <legend>2 · What to do</legend>
              <div class="raster">
                <label>
                  Operation
                  <select name="op" [(ngModel)]="f.op">
                    @for (o of ops; track o.op) {
                      <option [value]="o.op">{{ o.label }}</option>
                    }
                  </select>
                </label>
                @switch (f.op) {
                  @case ('set') {
                    <label>Field <input name="field" [(ngModel)]="f.field" list="felder" placeholder="Statblock.combatRole" /></label>
                    <label>Value <input name="value" [(ngModel)]="f.value" /></label>
                  }
                  @case ('unset') {
                    <label>Field <input name="field" [(ngModel)]="f.field" list="felder" /></label>
                  }
                  @case ('addTag') {
                    <label>Tag <input name="opTag" [(ngModel)]="f.opTag" /></label>
                  }
                  @case ('removeTag') {
                    <label>Tag <input name="opTag" [(ngModel)]="f.opTag" /></label>
                  }
                  @case ('merge') {
                    <label>
                      The others
                      <select name="mode" [(ngModel)]="f.mode">
                        <option value="delete">are deleted, links move</option>
                        <option value="variant">become variants</option>
                      </select>
                    </label>
                    <label>
                      Group by
                      <select name="by" [(ngModel)]="f.by">
                        <option value="content">same name and text</option>
                        <option value="name">same name</option>
                      </select>
                    </label>
                    <label>Keep (id, optional) <input name="keep" [(ngModel)]="f.keep" placeholder="oldest" /></label>
                  }
                  @default {
                    <label>
                      Edge
                      <select name="relType" [(ngModel)]="f.relType">
                        <option value="">—</option>
                        @for (r of kantenarten(); track r) {
                          <option [value]="r">{{ r }}</option>
                        }
                      </select>
                    </label>
                    <label>
                      To (id or number{{ f.op === 'removeRelation' ? ', empty: all' : '' }})
                      <input name="relTo" [(ngModel)]="f.relTo" />
                    </label>
                  }
                }
              </div>
            </fieldset>

            <details class="json" (toggle)="jsonOffen.set($any($event.target).open)">
              <summary>Request as JSON</summary>
              @if (jsonOffen()) {
                <textarea
                  rows="8"
                  spellcheck="false"
                  [value]="jsonText() ?? anzeigeJson()"
                  (input)="jsonText.set($any($event.target).value)"
                  aria-label="Request as JSON"
                ></textarea>
                @if (jsonText() !== null) {
                  <p class="dim">
                    The JSON is used as written.
                    <button type="button" class="klein" (click)="jsonText.set(null)">Back to the form</button>
                  </p>
                }
              }
            </details>

            @if (formFehler()) {
              <p class="fehler" role="alert">{{ formFehler() }}</p>
            }
            <div class="aktionen">
              <button type="submit" [disabled]="laeuft()">{{ laeuft() ? 'One moment…' : 'Preview' }}</button>
              <button type="button" (click)="zuruecksetzen()">Reset</button>
            </div>
          </form>

          @if (vorschau(); as v) {
            <div class="ergebnis" [class.geschrieben]="!v.dryRun" aria-live="polite">
              <h3>{{ v.dryRun ? 'Preview' : 'Done' }}</h3>
              <p class="zahlen">
                <b>{{ v.selected }}</b> selected · <b>{{ v.changed }}</b> changed · <b>{{ v.deleted }}</b> deleted ·
                <b [class.warn]="v.rejectedCount">{{ v.rejectedCount }}</b> rejected
                @if (v.skippedCount) {
                  · <b>{{ v.skippedCount }}</b> skipped
                }
                <span class="dim">· {{ v.ms }} ms</span>
              </p>
              @if (v.examples.length) {
                <ul class="beispiele">
                  @for (e of v.examples; track e.id) {
                    <li>
                      <span class="was" [class.weg]="e.change === 'delete'">{{ e.change }}</span>
                      <a [routerLink]="['/artikel', e.id]">{{ e.name }}</a>
                      <span class="art">{{ e.type }}</span>
                      <span class="grund">{{ e.summary.join(' · ') }}</span>
                    </li>
                  }
                </ul>
                @if (v.examples.length < v.changed + v.deleted) {
                  <p class="dim">… and {{ v.changed + v.deleted - v.examples.length }} more.</p>
                }
              }
              @if (v.rejected.length) {
                <h4>Rejected by validation</h4>
                <ul class="beispiele">
                  @for (r of v.rejected; track r.id) {
                    <li>
                      <a [routerLink]="['/artikel', r.id]">{{ r.name }}</a>
                      <span class="art">{{ r.type }}</span>
                      <span class="grund warn">{{ r.issues.join('; ') }}</span>
                    </li>
                  }
                </ul>
              }
              @if (v.skipped.length) {
                <h4>Skipped</h4>
                <ul class="beispiele">
                  @for (s of v.skipped; track $index) {
                    <li>
                      <span>{{ s.name }}</span> <span class="grund">{{ s.reason }}</span>
                    </li>
                  }
                </ul>
              }

              @if (v.dryRun && v.changed + v.deleted > 0) {
                @if (v.deleted > 1) {
                  <label class="bestaetigen">
                    <input type="checkbox" [ngModel]="bestaetigt()" (ngModelChange)="bestaetigt.set($event)" name="ok" />
                    Yes, delete {{ v.deleted }} articles (their links move to the one that stays).
                  </label>
                }
                @if (v.rejectedCount && !v.deleted) {
                  <label class="bestaetigen">
                    <input type="checkbox" [ngModel]="auslassen()" (ngModelChange)="auslassen.set($event)" name="skip" />
                    Write the others and leave the {{ v.rejectedCount }} rejected as they are.
                  </label>
                }
                <div class="aktionen">
                  <button
                    type="button"
                    class="pri"
                    (click)="ausfuehren()"
                    [disabled]="laeuft() || !aktuell() || (v.deleted > 1 && !bestaetigt()) || (v.rejectedCount > 0 && (v.deleted > 0 || !auslassen()))"
                  >
                    Apply to {{ v.changed + v.deleted }} articles
                  </button>
                  @if (!aktuell()) {
                    <span class="warn">The request changed since this preview — preview again.</span>
                  }
                </div>
              }
              @if (!v.dryRun && v.id) {
                <div class="aktionen">
                  <button type="button" (click)="zuruecknehmen(v.id)" [disabled]="laeuft()">Undo</button>
                </div>
              }
            </div>
          }
          @if (undoMeldung(); as u) {
            <div class="ergebnis" role="status">
              <p>{{ u.text }}</p>
              @if (u.konflikte.length) {
                <ul class="beispiele">
                  @for (k of u.konflikte; track k.id) {
                    <li>
                      <a [routerLink]="['/artikel', k.id]">{{ k.name }}</a> <span class="grund warn">{{ k.reason }}</span>
                    </li>
                  }
                </ul>
                <button type="button" (click)="zuruecknehmen(u.id, true)" [disabled]="laeuft()">
                  Undo anyway — the old versions win
                </button>
              }
            </div>
          }
        </section>

        <section class="block" aria-labelledby="h-runs">
          <h2 id="h-runs">Recent bulk changes</h2>
          <ul class="laeufe">
            @for (l of laeufe(); track l.id) {
              <li [class.zurueck]="l.undone">
                <div>
                  <b>{{ l.changed }}</b> changed, <b>{{ l.deleted }}</b> deleted
                  <span class="dim">· {{ l.at.slice(0, 16).replace('T', ' ') }} · {{ l.by?.name }}{{ l.token ? ' (' + l.token + ')' : '' }}</span>
                  @if (l.undone) {
                    <span class="dim">· undone</span>
                  }
                </div>
                @for (z of l.summary ?? []; track $index) {
                  <div class="grund">{{ z }}</div>
                }
                @if (!l.undone) {
                  <button type="button" class="klein" (click)="zuruecknehmen(l.id)" [disabled]="laeuft()">Undo</button>
                }
              </li>
            } @empty {
              <li class="leer">None yet.</li>
            }
          </ul>
        </section>
      }
    </div>
  `,
  styles: `
    .seite {
      max-width: 1100px;
      margin: 0 auto;
      padding: 1.25rem 1.5rem 3rem;
    }
    h1,
    h2,
    h3 {
      font-family: var(--caps);
      color: var(--accent);
    }
    h1 {
      margin: 0;
      font-size: 1.9rem;
    }
    h2 {
      margin: 0;
      font-size: 1.3rem;
    }
    h3 {
      margin: 0 0 0.25rem;
      font-size: 1.1rem;
    }
    h4 {
      margin: 0.75rem 0 0.25rem;
      color: var(--heading);
    }
    .hinweis,
    .leer,
    .dim {
      color: var(--dim);
    }
    .hinweis {
      margin: 0.25rem 0 0;
    }
    .block {
      margin-top: 1.5rem;
      padding: 1rem 1.25rem;
      background: var(--surface);
      border: 1px solid var(--line);
      border-top: 3px solid var(--rule);
      border-radius: 6px;
    }
    .titel {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem 1rem;
    }
    .titel button {
      margin-left: auto;
    }
    .fehler,
    .warn {
      color: var(--warn);
    }
    .checks,
    .treffer,
    .beispiele,
    .laeufe {
      margin: 0.5rem 0 0;
      padding: 0;
      list-style: none;
    }
    .checks > li {
      border-bottom: 1px solid var(--line2);
      padding: 0.35rem 0;
    }
    .checks > li.null {
      opacity: 0.7;
    }
    .zeile {
      display: flex;
      align-items: baseline;
      gap: 0.75rem;
      width: 100%;
      border: 0;
      background: none;
      padding: 0.25rem 0;
      text-align: left;
      min-height: 36px;
    }
    .zeile:hover:not([disabled]) {
      background: var(--hover);
    }
    .zeile[disabled] {
      opacity: 1;
      cursor: default;
    }
    .zahl {
      min-width: 3.5rem;
      font-variant-numeric: lining-nums tabular-nums;
      text-align: right;
      font-family: var(--serif);
      font-weight: 700;
      font-size: 1.15rem;
      color: var(--accent);
    }
    .null .zahl {
      color: var(--dim);
    }
    .name {
      font-weight: 700;
    }
    .pfeil {
      margin-left: auto;
      color: var(--dim);
    }
    .beschr {
      margin: 0 0 0 4.25rem;
      font-size: 0.85rem;
      color: var(--dim);
    }
    .treffer {
      margin: 0.5rem 0 0 4.25rem;
    }
    .treffer li,
    .beispiele li {
      padding: 0.3rem 0;
      border-top: 1px dotted var(--line2);
      overflow-wrap: anywhere;
    }
    .art {
      margin: 0 0.4rem;
      padding: 0 0.4rem;
      border-radius: 10px;
      background: var(--chip);
      font-size: 0.75rem;
    }
    .grund {
      color: var(--dim);
      font-size: 0.9rem;
    }
    .gruppe {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.3rem;
      margin-left: 0.4rem;
      font-size: 0.85rem;
    }
    button.klein {
      min-height: 30px;
      padding: 0 0.6rem;
      font-size: 0.85rem;
    }
    .aktionen {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem 0.75rem;
      margin: 0.75rem 0 0 0;
    }
    .checks .aktionen {
      margin-left: 4.25rem;
    }
    fieldset {
      margin: 0.75rem 0 0;
      padding: 0.5rem 0.75rem 0.75rem;
      border: 1px solid var(--line2);
      border-radius: 6px;
    }
    legend {
      padding: 0 0.3rem;
      font-family: var(--caps);
      color: var(--heading);
    }
    .raster {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 0.5rem 0.75rem;
    }
    label {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      font-size: 0.85rem;
      color: var(--dim);
    }
    label.breit {
      margin-top: 0.5rem;
    }
    input,
    select,
    textarea {
      min-height: 36px;
      padding: 0.25rem 0.5rem;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--paper);
      color: var(--ink);
      font-size: 0.95rem;
      min-width: 0;
    }
    textarea {
      width: 100%;
      font-family: ui-monospace, monospace;
      font-size: 0.85rem;
    }
    .bedingungen {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      margin-top: 0.6rem;
      align-items: flex-start;
    }
    .bedingung {
      display: grid;
      grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 1.2fr) auto;
      gap: 0.4rem;
      width: 100%;
    }
    .json {
      margin-top: 0.75rem;
    }
    .json summary {
      cursor: pointer;
      color: var(--dim);
    }
    .ergebnis {
      margin-top: 1rem;
      padding: 0.75rem 1rem;
      background: var(--paper);
      border: 1px solid var(--line);
      border-left: 4px solid var(--gold);
      border-radius: 6px;
    }
    .ergebnis.geschrieben {
      border-left-color: var(--accent);
    }
    .zahlen {
      margin: 0;
    }
    .was {
      display: inline-block;
      min-width: 3.5rem;
      font-size: 0.8rem;
      color: var(--dim);
    }
    .was.weg {
      color: var(--warn);
    }
    .bestaetigen {
      flex-direction: row;
      align-items: center;
      gap: 0.5rem;
      margin-top: 0.75rem;
      color: var(--ink);
    }
    .bestaetigen input {
      min-height: auto;
    }
    .laeufe li {
      padding: 0.5rem 0;
      border-bottom: 1px solid var(--line2);
    }
    .laeufe li.zurueck {
      opacity: 0.65;
    }
    @media (max-width: 640px) {
      .seite {
        padding: 0.75rem 0.75rem 2rem;
      }
      .block {
        padding: 0.75rem;
      }
      .zahl {
        min-width: 2.5rem;
      }
      .beschr,
      .treffer,
      .checks .aktionen {
        margin-left: 0;
      }
      .bedingung {
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
      }
      .bedingung > input:nth-of-type(2) {
        grid-column: 1 / 3;
      }
    }
  `,
})
export class Werkbank {
  protected readonly session = inject(Session);
  protected readonly bestand = inject(Bestand);
  private readonly api = inject(Api);

  protected readonly ops = OPS;
  protected readonly bedingungen = BEDINGUNGEN;

  /* ---------------------------------------------------------- Prüfungen */
  protected readonly pruefung = signal<ChecksAntwort | null>(null);
  protected readonly prueft = signal(false);
  protected readonly pruefFehler = signal<string | null>(null);
  protected readonly offen = signal<string | null>(null);
  protected readonly treffer = signal<CheckResult | null>(null);

  /* ------------------------------------------- Was wartet (REQ-237) */
  protected readonly wartend = signal<Wartend[]>([]);
  protected readonly wartetFehler = signal<string | null>(null);
  protected readonly setzt = signal<string | null>(null);

  async wartendLaden(): Promise<void> {
    try {
      this.wartend.set((await this.api.unready()).rows);
      this.wartetFehler.set(null);
    } catch (error) {
      this.wartetFehler.set(error instanceof Error ? error.message : String(error));
    }
  }

  /** „ready" per Knopf: der neue Stand gilt, die Zeile geht. */
  async fertigNennen(w: Wartend): Promise<void> {
    this.setzt.set(w.id);
    try {
      await this.api.setReady(w.id);
      await this.wartendLaden();
    } catch (error) {
      this.wartetFehler.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.setzt.set(null);
    }
  }

  protected datum(at: string): string {
    return new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  /* ------------------------------------------------------ Massenänderung */
  protected f: Formular = leeresFormular();
  protected readonly jsonText = signal<string | null>(null);
  protected readonly jsonOffen = signal(false);
  protected readonly formFehler = signal<string | null>(null);
  protected readonly laeuft = signal(false);
  protected readonly vorschau = signal<BulkAntwort | null>(null);
  /** Der Auftrag, zu dem die Vorschau gehört — Ausführen nur für genau ihn. */
  private vorschauFuer = '';
  protected readonly bestaetigt = signal(false);
  protected readonly auslassen = signal(false);
  protected readonly laeufe = signal<BulkLauf[]>([]);
  protected readonly undoMeldung = signal<{ id: string; text: string; konflikte: UndoAntwort['conflicts'] } | null>(null);

  /**
   * Die anlegbaren Arten aus dem Register. Der Browser hält keinen Bestand
   * (W7); eine Art ohne Artikel wählt nichts aus, und die Vorschau sagt es.
   */
  protected readonly arten = computed(() => {
    const r = this.bestand.registry();
    if (!r) return [];
    return Object.entries(r.interfaces)
      .filter(([, d]) => !d.abstract)
      .map(([n]) => n)
      .sort();
  });
  /** Die Ebenen — eine Handvoll, aus der Liste am Server. */
  protected readonly ebenen = signal<{ id: string; name: string }[]>([]);
  protected readonly kantenarten = computed(() => Object.keys(this.bestand.registry()?.relations ?? {}).sort());

  constructor() {
    void this.bestand.load();
    void this.bestand
      .liste({ type: 'Layer', limit: 200 })
      .then((l) => this.ebenen.set(l.rows.map((z) => ({ id: z.id, name: z.name }))))
      .catch(() => undefined);
    if (this.session.leitung()) {
      void this.wartendLaden();
      void this.pruefen();
      void this.laeufeLaden();
    }
  }

  /** Felder für die Vorschläge: name, id, type und die Felder der gewählten Art. */
  protected felder(): string[] {
    const reg = this.bestand.registry();
    const art = this.f.type;
    const aus = reg && art ? fieldsOf(reg, art).filter((x) => !x.prop.derived).map((x) => `${x.type}.${x.key}`) : [];
    return ['name', 'id', 'type', ...aus];
  }

  protected ohneWert(op: string): boolean {
    return BEDINGUNGEN.some((b) => b.op === op && b.ohneWert);
  }

  async pruefen(): Promise<void> {
    this.prueft.set(true);
    this.pruefFehler.set(null);
    try {
      this.pruefung.set(await this.api.checks());
      const k = this.offen();
      if (k) await this.ladeTreffer(k, 50);
    } catch (e) {
      this.pruefFehler.set(e instanceof ApiError ? e.message : 'Could not reach the server.');
    } finally {
      this.prueft.set(false);
    }
  }

  protected async aufklappen(c: CheckResult): Promise<void> {
    if (this.offen() === c.key) {
      this.offen.set(null);
      return;
    }
    this.offen.set(c.key);
    this.treffer.set(null);
    await this.ladeTreffer(c.key, 50);
  }

  private async ladeTreffer(key: string, limit: number | 'all'): Promise<CheckResult | null> {
    try {
      const r = (await this.api.checks(key, limit)).checks[0] ?? null;
      if (this.offen() === key) this.treffer.set(r);
      return r;
    } catch (e) {
      this.pruefFehler.set(e instanceof ApiError ? e.message : 'Could not reach the server.');
      return null;
    }
  }

  protected async alleTreffer(c: CheckResult): Promise<void> {
    await this.ladeTreffer(c.key, 'all');
  }

  /** Die Treffer einer Prüfung als Auswahl der Massenänderung. */
  protected async alsAuswahl(c: CheckResult): Promise<void> {
    const alle = (await this.ladeTreffer(c.key, 'all')) ?? this.treffer();
    if (!alle) return;
    this.f = { ...leeresFormular(), op: this.f.op, ids: alle.hits.map((h) => h.id).join('\n'), where: [] };
    this.neuerAuftrag();
    this.zumFormular();
  }

  /** Eine Doppelgruppe: zusammenführen, der älteste bleibt. */
  protected gruppeZusammenfuehren(h: CheckHit): void {
    this.f = {
      ...leeresFormular(),
      ids: (h.group ?? []).join('\n'),
      where: [],
      op: 'merge',
      mode: 'delete',
      by: 'name',
      keep: h.group?.[0] ?? '',
    };
    this.neuerAuftrag();
    this.zumFormular();
  }

  private zumFormular(): void {
    document.getElementById('massen')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ------------------------------------------------------ Massenänderung */

  /** Der Auftrag, wie er gerade dasteht: das JSON, wenn jemand es bearbeitet hat, sonst das Formular. */
  private auftrag(): Record<string, unknown> {
    const roh = this.jsonText();
    if (roh !== null) {
      const x: unknown = JSON.parse(roh);
      if (!x || typeof x !== 'object' || Array.isArray(x)) throw new Error('The JSON must be an object.');
      const { dryRun: _d, confirmDelete: _c, skipRejected: _s, ...rest } = x as Record<string, unknown>;
      return rest;
    }
    return auftragAus(this.f);
  }

  protected anzeigeJson(): string {
    return JSON.stringify(auftragAus(this.f), null, 2);
  }

  /** Stimmt der Auftrag noch mit dem der Vorschau überein? */
  protected aktuell(): boolean {
    try {
      return JSON.stringify(this.auftrag()) === this.vorschauFuer;
    } catch {
      return false;
    }
  }

  private neuerAuftrag(): void {
    this.jsonText.set(null);
    this.vorschau.set(null);
    this.undoMeldung.set(null);
    this.formFehler.set(null);
  }

  protected zuruecksetzen(): void {
    this.f = leeresFormular();
    this.neuerAuftrag();
  }

  protected async vorschauen(): Promise<void> {
    this.formFehler.set(null);
    this.undoMeldung.set(null);
    let auftrag: Record<string, unknown>;
    try {
      if (this.jsonText() === null) {
        const fehlt = formularFehlt(this.f);
        if (fehlt) {
          this.formFehler.set(fehlt);
          return;
        }
      }
      auftrag = this.auftrag();
    } catch (e) {
      this.formFehler.set(`JSON: ${(e as Error).message}`);
      return;
    }
    this.laeuft.set(true);
    try {
      const v = await this.api.bulk({ ...auftrag, dryRun: true });
      this.vorschauFuer = JSON.stringify(auftrag);
      this.bestaetigt.set(false);
      this.auslassen.set(false);
      this.vorschau.set(v);
    } catch (e) {
      this.vorschau.set(null);
      this.formFehler.set(e instanceof ApiError ? e.message : 'Could not reach the server.');
    } finally {
      this.laeuft.set(false);
    }
  }

  protected async ausfuehren(): Promise<void> {
    const v = this.vorschau();
    if (!v || !this.aktuell()) return;
    const auftrag = {
      ...this.auftrag(),
      ...(v.deleted > 1 && this.bestaetigt() ? { confirmDelete: v.deleted } : {}),
      ...(this.auslassen() ? { skipRejected: true } : {}),
    };
    this.laeuft.set(true);
    try {
      this.vorschau.set(await this.api.bulk(auftrag));
      this.vorschauFuer = '';
      await Promise.all([this.laeufeLaden(), this.bestand.load(true), this.pruefen()]);
    } catch (e) {
      const body = e instanceof ApiError ? (e.body as BulkAntwort | null) : null;
      if (body && 'selected' in body) this.vorschau.set({ ...body, dryRun: true });
      this.formFehler.set(e instanceof ApiError ? e.message : 'Could not reach the server.');
    } finally {
      this.laeuft.set(false);
    }
  }

  protected async zuruecknehmen(id: string, force = false): Promise<void> {
    this.laeuft.set(true);
    this.undoMeldung.set(null);
    try {
      const r = await this.api.undo(id, force);
      this.undoMeldung.set({ id, text: `Undone: ${r.restored} articles restored.`, konflikte: [] });
      this.vorschau.set(null);
      await Promise.all([this.laeufeLaden(), this.bestand.load(true), this.pruefen()]);
    } catch (e) {
      const body = e instanceof ApiError ? (e.body as UndoAntwort | null) : null;
      this.undoMeldung.set({
        id,
        text: e instanceof ApiError ? e.message : 'Could not reach the server.',
        konflikte: body?.conflicts ?? [],
      });
    } finally {
      this.laeuft.set(false);
    }
  }

  private async laeufeLaden(): Promise<void> {
    try {
      this.laeufe.set(await this.api.bulks());
    } catch {
      /* Die Liste ist eine Bequemlichkeit; die Prüfungen sagen den Fehler schon. */
    }
  }
}

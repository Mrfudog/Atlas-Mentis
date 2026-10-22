import { Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Api, ApiError, type Bezuege, type FormenUebersicht } from '../kern/api';
import { Bestand } from '../kern/bestand';
import { Wahl } from './wahl';

type Gruppe = FormenUebersicht['groups'][number];
type Ding = FormenUebersicht['items'][number];

/** Die Stapelgrössen zur Wahl, wie in der Vorlage der Leitung. */
const STAPEL = [1, 2, 4, 8, 16, 32, 64];
/** Das Malraster der Gruppe und des Gegenstands: 7 × 7. */
const MAL = 7;

/** Zeilen ohne leere Ränder; `null`, wenn nichts belegt ist. */
function beschnitten(rows: string[]): string[] | null {
  let r = rows.map((z) => z.replace(/[^#]/g, '.'));
  while (r.length && !r[0]!.includes('#')) r.shift();
  while (r.length && !r[r.length - 1]!.includes('#')) r.pop();
  if (!r.length) return null;
  const w = Math.max(...r.map((z) => z.length));
  r = r.map((z) => z.padEnd(w, '.'));
  let a = 0;
  let b = w - 1;
  while (a < w && r.every((z) => z[a] === '.')) a++;
  while (b > a && r.every((z) => z[b] === '.')) b--;
  return r.map((z) => z.slice(a, b + 1));
}

/** Das Malraster aus einer Form: 7 × 7, die Form oben links. */
function leinwand(rows: readonly string[] | null | undefined): boolean[][] {
  return Array.from({ length: MAL }, (_, y) => Array.from({ length: MAL }, (_, x) => (rows?.[y] ?? '')[x] === '#'));
}

/**
 * **Die Vorgabeformen im Überblick** (T-394, REQ-333, Rules & options ›
 * Inventory › Item shapes) — aufgebaut wie die Seite „Gegenstandsformen“
 * der Leitung: oben Kennzahlen, Suche und Art; links die Gruppen nach
 * Abschnitt mit Miniform, Kürzel, Stapel und Zahl; rechts die gewählte
 * Gruppe mit Malraster, Referenzgegenstand, Gewichten nach Preis, Stapel,
 * „tragbar“ und Notiz, darunter ihre Gegenstände mit Form, Art, Gewicht,
 * Eigenschaften, Herkunft und Stapel. Ein Klick auf eine Zeile öffnet die
 * Anpassung des Gegenstands.
 *
 * Gerechnet am Server wie beim Lesen eines Gegenstands
 * (`GET /api/inventory/shapes`); geschrieben in die Karte `ShapeDefaults`
 * der gewählten Formebene. Farben aus dem Pergament der Seite.
 */
@Component({
  selector: 'nw-formen-uebersicht',
  imports: [NgTemplateOutlet, RouterLink, Wahl],
  template: `
    <div class="wrap">
      <div class="head">
        <h1>Item shapes</h1>
        <span class="sub">Default shapes of the inventory · shapes and stack sizes by group, reference item and local overrides ·
          <a routerLink="/handbook">How it works</a></span>
      </div>

      @if (daten(); as d) {
        <div class="stats">
          <span><b>{{ d.items.length }}</b> items</span>
          <span><b>{{ zahlen().eigen }}</b> with their own shape</span>
          <span><b>{{ zahlen().ref }}</b> inherit from a reference item</span>
          <span><b>{{ d.groups.length }}</b> groups</span>
          <span><b>{{ zahlen().lokal }}</b> local overrides</span>
        </div>
        <div class="bar">
          <input type="search" placeholder="Search an item, e.g. Longsword, Bag of Holding …" aria-label="Search an item" [value]="suche()" (input)="suchen($any($event.target).value)" />
          <select aria-label="Filter by type" (change)="art.set($any($event.target).value)">
            <option value="">All types</option>
            @for (a of arten(); track a) { <option [value]="a">{{ a }}</option> }
          </select>
          @if (schreibbar().length > 1) {
            <label class="sub">Writes to
              <select [value]="ziel() ?? ''" (change)="ziel.set($any($event.target).value || null)">
                @for (l of schreibbar(); track l.id) { <option [value]="l.id">{{ l.name }}</option> }
              </select>
            </label>
          }
          <span class="status" [class.err]="!!fehler()" role="status">{{ fehler() ?? meldung() ?? (darf() ? '' : 'Read only: no default-shapes layer you write is turned on here.') }}</span>
        </div>

        @if (!d.layers.length) {
          <p class="sub">No default-shapes layer is turned on in this campaign. Turn on the rule system Inventory on the campaign page.</p>
        }

        <div class="main">
          <nav class="side" aria-label="Groups">
            @for (s of abschnitte(); track s.name) {
              <div class="sec">{{ s.name }}</div>
              @for (g of s.gruppen; track g.id) {
                <button type="button" class="gr" [attr.aria-current]="gewaehlt() === g.id" [attr.data-gruppe]="g.id" (click)="gruppeWaehlen(g.id)">
                  <span class="mini">
                    @if (g.carryable === false) { <span class="none">–</span> }
                    @else { <ng-container *ngTemplateOutlet="form; context: { rows: gruppenForm(g), zelle: miniZelle(gruppenForm(g)) }" /> }
                  </span>
                  <span class="nm">{{ g.name }}<small>{{ g.id }} · Stack {{ g.carryable === false ? '–' : (g.stackSize ?? 1) }}</small></span>
                  <span class="ct">{{ g.count }}</span>
                </button>
              }
            }
            @if (darf()) { <button type="button" class="btn neu" (click)="neueGruppe()">+ Group</button> }
          </nav>

          <div class="detail">
            @if (!suche().trim() && gruppe(); as g) {
              <section class="card" aria-label="Group">
                <div class="gtop">
                  <div class="editor" role="group" aria-label="Paint the shape">
                    @for (zeile of gruppenMal(); track $index; let y = $index) {
                      @for (an of zeile; track $index; let x = $index) {
                        <button type="button" [attr.aria-pressed]="an" [attr.aria-label]="'Row ' + (y + 1) + ', column ' + (x + 1)" [disabled]="!darf()" (click)="kippe(gruppenMal, x, y)"></button>
                      }
                    }
                  </div>
                  <div class="info">
                    <div class="row"><h2>{{ g.name }}</h2><span class="chip">{{ g.id }}</span></div>
                    @if (g.rule) { <div class="sub">Rule: {{ g.rule }}</div> }
                    <div class="row">
                      <span class="lbl">Reference item</span>
                      @if (darf()) {
                        <nw-wahl class="wahl" [wert]="g.ref ?? ''" [arten]="['Item']" [anlegbar]="false" label="Reference item" (wertChange)="gruppeSetzen(g.id, { ref: $event || null })" />
                      } @else { <span>{{ g.refName ?? 'none (shape of the group)' }}</span> }
                      <span class="sub">{{ g.refName ? 'The group takes the shape of ' + g.refName + ' if it has its own.' : 'If the reference item has its own shape, it applies to the whole group.' }}</span>
                    </div>
                    @if (g.shapes?.length) {
                      <div class="tblwrap">
                        <table aria-label="Shapes by price">
                          <thead><tr><th>Shape</th>@for (t of g.tiers ?? []; track $index) { <th class="num">from {{ t }} gp</th> }</tr></thead>
                          <tbody>
                            @for (f of g.shapes; track $index; let fi = $index) {
                              <tr>
                                <td><ng-container *ngTemplateOutlet="form; context: { rows: f.rows, zelle: 9 }" /> <code class="sub">{{ text(f.rows) }}</code></td>
                                @for (t of g.tiers ?? []; track $index; let ti = $index) {
                                  <td class="num"><input type="number" min="0" max="100" class="gewicht" [value]="f.weights[ti] || 0" [disabled]="!darf()"
                                    [attr.aria-label]="'Weight of ' + text(f.rows) + ' from ' + t + ' gp'" (change)="gewicht(g, fi, ti, $any($event.target).value)" /></td>
                                }
                              </tr>
                            }
                          </tbody>
                        </table>
                      </div>
                      <div class="sub">Per price tier the weights of the shapes; every art object draws once and keeps its shape. Own shapes win.</div>
                    }
                    <div class="row"><span class="lbl">Shape</span>
                      @if (g.carryable === false) { <span class="none">no shape of its own</span> }
                      @else { <ng-container *ngTemplateOutlet="form; context: { rows: gruppenForm(g), zelle: 18 }" /> }
                      <code class="sub">{{ text(gruppenForm(g)) }}</code>
                    </div>
                    <div class="row">
                      <label class="lbl" for="gStack">Stack</label>
                      <select id="gStack" [value]="g.stackSize ?? 1" [disabled]="!darf() || g.carryable === false" (change)="gruppeSetzen(g.id, { stackSize: +$any($event.target).value })">
                        @for (s of stapel; track s) { <option [value]="s" [selected]="s === (g.stackSize ?? 1)">{{ s }}</option> }
                      </select>
                      <label class="row"><input type="checkbox" [checked]="g.carryable !== false" [disabled]="!darf()" (change)="gruppeSetzen(g.id, { carryable: $any($event.target).checked })" /> carried (goes into the grid)</label>
                    </div>
                    <label class="lbl" for="gNote">Note</label>
                    <textarea id="gNote" [value]="g.note ?? ''" [disabled]="!darf()" placeholder="e.g. staves rather 1×6" (change)="gruppeSetzen(g.id, { note: $any($event.target).value || null })"></textarea>
                    @if (darf()) {
                      <div class="row">
                        <button type="button" class="btn pri" (click)="gruppenFormSpeichern(g)">Save shape</button>
                        <span class="sub">Paint: click the cells on the left; empty borders fall away.</span>
                      </div>
                    }
                  </div>
                </div>
              </section>
            }

            <section class="card" aria-label="Items">
              <div class="row">
                <h3>{{ suche().trim() ? 'Results for “' + suche().trim() + '”' : 'Items in this group' }}</h3>
                <span class="sub">{{ liste().length }}{{ darf() ? ' · click a row to adjust the item' : '' }}</span>
              </div>

              @if (ding(); as i) {
                <div class="pane" aria-label="Adjust item" [attr.data-pane]="i.id">
                  <div class="row"><h3><a [routerLink]="['/artikel', i.id]">{{ i.name }}</a></h3>
                    <span class="chip" [class]="'chip ' + chipArt(i)">{{ herkunft(i) }}</span>
                    <span class="sub">{{ i.type }}{{ i.itemType ? ' · ' + i.itemType : '' }} · {{ i.weight ?? '–' }} lb{{ i.properties ? ' · ' + i.properties.join(', ') : '' }}</span>
                  </div>
                  <div class="gtop">
                    <div class="editor" role="group" aria-label="Paint an own shape">
                      @for (zeile of dingMal(); track $index; let y = $index) {
                        @for (an of zeile; track $index; let x = $index) {
                          <button type="button" [attr.aria-pressed]="an" [attr.aria-label]="'Row ' + (y + 1) + ', column ' + (x + 1)" (click)="kippe(dingMal, x, y)"></button>
                        }
                      }
                    </div>
                    <div class="info">
                      <div class="row"><span class="lbl">applies now</span><ng-container *ngTemplateOutlet="form; context: { rows: i.rows, zelle: 14 }" /><span class="sub">Stack {{ i.rows ? i.stackSize : '–' }}</span></div>
                      @if (i.source === 'item') { <div class="sub">The shape is painted on the item itself and wins over everything here.</div> }
                      @if (i.source === 'reference') { <div class="sub">Inherits shape and stack from {{ i.refName }}. A change here applies to this item only.</div> }
                      <div class="row"><label class="lbl" for="iGroup">Group</label>
                        <select id="iGroup" (change)="dingSetzen(i.id, { group: $any($event.target).value || null })">
                          <option value="" [selected]="!i.set?.group">— none —</option>
                          @for (s of abschnitte(); track s.name) {
                            <optgroup [label]="s.name">
                              @for (g of s.gruppen; track g.id) { <option [value]="g.id" [selected]="i.set?.group === g.id">{{ g.id }} · {{ g.name }}</option> }
                            </optgroup>
                          }
                        </select>
                      </div>
                      <div class="row"><span class="lbl">Reference</span>
                        <nw-wahl class="wahl" [wert]="i.set?.ref ?? ''" [arten]="['Item']" [ausser]="i.id" [anlegbar]="false" label="Reference item" (wertChange)="dingSetzen(i.id, { ref: $event || null })" />
                      </div>
                      <div class="row"><label class="lbl" for="iStack">Stack</label>
                        <select id="iStack" (change)="dingSetzen(i.id, { stackSize: $any($event.target).value ? +$any($event.target).value : null })">
                          <option value="" [selected]="!i.set?.stackSize">from group</option>
                          @for (s of stapel; track s) { <option [value]="s" [selected]="s === i.set?.stackSize">{{ s }}</option> }
                        </select>
                      </div>
                      <div class="row">
                        <button type="button" class="btn pri" (click)="eigeneFormSpeichern(i)">Save own shape</button>
                        <button type="button" class="btn" (click)="dingSetzen(i.id, { rows: [] })">No shape</button>
                        <button type="button" class="btn" [disabled]="!i.set" (click)="lokalWeg(i.id)">Remove override</button>
                        <button type="button" class="btn" (click)="offen.set(null)">Close</button>
                      </div>
                    </div>
                  </div>
                </div>
              }

              <div class="tblwrap">
                <table>
                  <thead><tr><th>Shape</th><th>Name</th><th>Type</th><th class="num">lb</th><th>Properties</th><th>Origin</th><th class="num">Stack</th>@if (suche().trim()) { <th>Group</th> }</tr></thead>
                  <tbody>
                    @for (i of gezeigt(); track i.id) {
                      <tr class="item" tabindex="0" [attr.data-item]="i.id" [attr.aria-selected]="offen() === i.id"
                          (click)="zeileWaehlen(i)" (keydown.enter)="zeileWaehlen(i)" (keydown.space)="$event.preventDefault(); zeileWaehlen(i)">
                        <td><ng-container *ngTemplateOutlet="form; context: { rows: i.rows, zelle: 7 }" /></td>
                        <td>{{ i.name }}</td>
                        <td class="sub">{{ i.type }}{{ i.itemType ? ' · ' + i.itemType : '' }}</td>
                        <td class="num">{{ i.weight ?? '–' }}</td>
                        <td class="sub">{{ i.properties?.join(', ') }}</td>
                        <td><span [class]="'chip ' + chipArt(i)">{{ herkunft(i) }}</span>@if (i.set) { <span class="chip adj" title="Something is set for this item in the default shapes">local</span> }</td>
                        <td class="num">{{ i.rows ? i.stackSize : '–' }}</td>
                        @if (suche().trim()) { <td class="sub">{{ i.group ?? '' }}</td> }
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
              @if (liste().length > gezeigt().length) {
                <button type="button" class="btn more" (click)="grenze.set(grenze() + 200)">Show {{ min(200, liste().length - gezeigt().length) }} more ({{ liste().length - gezeigt().length }} left)</button>
              }
              @if (!liste().length) { <p class="sub">No items. Pick another group on the left or change the search.</p> }
            </section>
          </div>
        </div>
        <p class="sub">Precedence: a shape painted on the item · own shape here · reference item (variant or base item) · drawn by price (art objects) · shape of the group or of its reference item. Without a shape: groups marked as not carried, such as mounts, vehicles and services.</p>
      } @else {
        <p class="status" [class.err]="!!fehler()">{{ fehler() ?? 'Loading…' }}</p>
      }
    </div>

    <ng-template #form let-rows="rows" let-zelle="zelle">
      @if (rows?.length) {
        <span class="shape" role="img" [attr.aria-label]="'Shape ' + text(rows)" [style.grid-template-columns]="'repeat(' + breite(rows) + ', ' + zelle + 'px)'">
          @for (c of zellen(rows); track $index) { <i [class.on]="c" [style.width.px]="zelle" [style.height.px]="zelle"></i> }
        </span>
      } @else { <span class="none">none</span> }
    </ng-template>
  `,
  styles: `
    .wrap { max-width: 1440px; margin: 0 auto; padding: 16px 16px 32px; display: flex; flex-direction: column; gap: 14px; }
    h1, h2, h3 { font-family: var(--caps); color: var(--heading); margin: 0; }
    h1 { font-size: 28px; } h2 { font-size: 22px; } h3 { font-size: 17px; }
    .sub { color: var(--dim); font-size: 13px; }
    .head { display: flex; flex-wrap: wrap; gap: 10px 24px; align-items: baseline; }
    .stats { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 14px; font-variant-numeric: tabular-nums; }
    .stats b { color: var(--accent); }
    .bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .bar input[type='search'], .bar select, select { font: inherit; color: var(--ink); background: var(--surface); border: 1px solid var(--line); border-radius: 6px; min-height: 36px; padding: 0 10px; }
    .bar input[type='search'] { flex: 1 1 260px; min-width: 0; }
    .btn { font: inherit; color: var(--ink); cursor: pointer; min-height: 34px; padding: 0 12px; border: 1px solid var(--line); border-radius: 6px; background: var(--surface); }
    .btn:hover { border-color: var(--accent); }
    .btn.pri { background: var(--accent); border-color: var(--accent); color: var(--surface); }
    .btn:disabled { opacity: 0.5; cursor: default; }
    .status { font-size: 13px; color: var(--dim); }
    .status.err { color: var(--accent); }
    .main { display: grid; grid-template-columns: minmax(260px, 340px) minmax(0, 1fr); gap: 14px; align-items: start; }
    @media (max-width: 820px) { .main { grid-template-columns: minmax(0, 1fr); } }
    .side { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 8px; display: flex; flex-direction: column; gap: 2px;
      position: sticky; top: 0; max-height: calc(100vh - 24px); overflow: auto; }
    @media (max-width: 820px) { .side { position: static; max-height: 45vh; } }
    .sec { font-family: var(--caps); font-size: 14px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--dim); padding: 10px 8px 4px; }
    .gr { display: grid; grid-template-columns: 44px minmax(0, 1fr) auto; gap: 8px; align-items: center; width: 100%; text-align: left;
      border: 1px solid transparent; border-radius: 6px; background: transparent; padding: 6px 8px; font: inherit; color: var(--ink); cursor: pointer; }
    .gr:hover { background: var(--hover, var(--chip)); }
    .gr[aria-current='true'] { background: var(--chip); border-color: var(--accent); }
    .gr .nm { font-weight: 500; min-width: 0; }
    .gr .nm small { display: block; color: var(--dim); font-size: 12px; font-weight: 400; }
    .gr .ct { font-variant-numeric: tabular-nums; font-size: 13px; color: var(--dim); text-align: right; }
    .neu { margin-top: 8px; }
    .mini { width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; }
    .shape { display: inline-grid; gap: 1px; vertical-align: middle; }
    .shape i { display: block; background: transparent; }
    .shape i.on { background: var(--gold, var(--accent)); outline: 1px solid var(--dim); }
    .none { font-size: 11px; color: var(--dim); border: 1px dashed var(--line); border-radius: 4px; padding: 2px 4px; }
    .detail { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
    .card { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 14px; display: flex; flex-direction: column; gap: 12px; min-width: 0; }
    .gtop { display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-start; }
    .info { flex: 1 1 280px; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
    .editor { display: inline-grid; grid-template-columns: repeat(7, 30px); gap: 2px; padding: 6px; background: var(--paper, var(--bg)); border: 1px solid var(--line); border-radius: 6px; }
    .editor button { width: 30px; height: 30px; border: 1px solid var(--line); background: var(--bg); border-radius: 3px; padding: 0; cursor: pointer; }
    .editor button[aria-pressed='true'] { background: var(--gold, var(--accent)); border-color: var(--dim); }
    .editor button:disabled { cursor: default; }
    .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .lbl { font-size: 12px; color: var(--dim); letter-spacing: 0.04em; text-transform: uppercase; }
    .wahl { flex: 1 1 200px; min-width: 0; }
    .chip { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; border-radius: 999px; padding: 1px 8px; border: 1px solid var(--line); background: var(--bg); white-space: nowrap; margin-right: 4px; }
    .chip.var { border-color: var(--magic, var(--accent)); color: var(--magic, var(--accent)); }
    .chip.own { border-color: var(--good, var(--accent)); color: var(--good, var(--accent)); }
    .chip.adj { border-color: var(--warn, var(--accent)); color: var(--warn, var(--accent)); }
    .tblwrap { overflow-x: auto; }
    table { border-collapse: collapse; width: 100%; font-size: 14px; }
    th { text-align: left; font-weight: 500; color: var(--dim); font-size: 12px; letter-spacing: 0.04em; text-transform: uppercase; border-bottom: 1px solid var(--line); padding: 6px 8px; white-space: nowrap; }
    td { border-bottom: 1px solid var(--line); padding: 6px 8px; vertical-align: middle; }
    tr.item { cursor: pointer; }
    tr.item:hover td { background: var(--hover, var(--chip)); }
    tr.item[aria-selected='true'] td { background: var(--chip); }
    .num { font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; }
    .gewicht { width: 56px; font: inherit; color: var(--ink); background: var(--surface); border: 1px solid var(--line); border-radius: 4px; padding: 2px 4px; text-align: right; }
    .pane { border: 1px solid var(--accent); border-radius: 8px; padding: 12px; background: var(--bg); display: flex; flex-direction: column; gap: 10px; }
    .more { align-self: flex-start; }
    textarea { font: inherit; color: var(--ink); background: var(--surface); border: 1px solid var(--line); border-radius: 6px; padding: 6px 8px; width: 100%; min-height: 54px; }
  `,
})
export class FormenUebersichtSeite {
  private readonly api = inject(Api);
  private readonly bestand = inject(Bestand);

  protected readonly stapel = STAPEL;
  protected readonly min = Math.min;
  protected readonly daten = signal<FormenUebersicht | null>(null);
  protected readonly fehler = signal<string | null>(null);
  protected readonly meldung = signal<string | null>(null);
  protected readonly gewaehlt = signal<string | null>(null);
  protected readonly suche = signal('');
  protected readonly art = signal('');
  protected readonly offen = signal<string | null>(null);
  protected readonly grenze = signal(80);
  protected readonly ziel = signal<string | null>(null);
  protected readonly gruppenMal = signal<boolean[][]>(leinwand(null));
  protected readonly dingMal = signal<boolean[][]>(leinwand(null));

  protected readonly schreibbar = computed(() => (this.daten()?.layers ?? []).filter((l) => l.writable));
  protected readonly darf = computed(() => this.schreibbar().length > 0);
  protected readonly gruppe = computed<Gruppe | undefined>(() => this.daten()?.groups.find((g) => g.id === this.gewaehlt()));
  protected readonly ding = computed<Ding | undefined>(() => this.daten()?.items.find((i) => i.id === this.offen()));
  protected readonly arten = computed(() => [...new Set((this.daten()?.items ?? []).map((i) => i.type))].sort());
  protected readonly zahlen = computed(() => {
    const it = this.daten()?.items ?? [];
    return {
      eigen: it.filter((i) => i.source === 'own' || i.source === 'item').length,
      ref: it.filter((i) => i.source === 'reference').length,
      lokal: it.filter((i) => !!i.set).length,
    };
  });
  protected readonly abschnitte = computed(() => {
    const m = new Map<string, Gruppe[]>();
    for (const g of this.daten()?.groups ?? []) {
      const s = g.section || 'Groups';
      m.set(s, [...(m.get(s) ?? []), g]);
    }
    return [...m].map(([name, gruppen]) => ({ name, gruppen }));
  });
  protected readonly liste = computed<Ding[]>(() => {
    const q = this.suche().trim().toLowerCase();
    const l = (this.daten()?.items ?? []).filter((i) => !this.art() || i.type === this.art());
    return q ? l.filter((i) => i.name.toLowerCase().includes(q)) : l.filter((i) => i.group === this.gewaehlt());
  });
  protected readonly gezeigt = computed(() => this.liste().slice(0, this.grenze()));

  constructor() {
    void this.laden();
  }

  private async laden(): Promise<void> {
    try {
      const d = await this.api.shapeOverview();
      this.daten.set(d);
      /* Die Namen der Gegenstände für die Auswahl des Referenzgegenstands (`nw-wahl`). */
      this.bestand.bezuegeAufnehmen({ names: Object.fromEntries(d.items.map((i) => [i.id, i.name])), links: {} } as unknown as Bezuege);
      if (!this.ziel() || !d.layers.some((l) => l.id === this.ziel() && l.writable)) this.ziel.set(d.target);
      if (!this.gewaehlt() && d.groups.length) this.gruppeWaehlen(d.groups[0]!.id);
      else if (this.gruppe()) this.gruppenMal.set(leinwand(this.gruppenForm(this.gruppe()!)));
      this.fehler.set(null);
    } catch (e) {
      this.fehler.set(e instanceof ApiError ? e.message : 'The overview could not be loaded. Reload the page.');
    }
  }

  protected suchen(q: string): void {
    this.suche.set(q);
    this.offen.set(null);
    this.grenze.set(80);
  }
  protected gruppeWaehlen(id: string): void {
    this.gewaehlt.set(id);
    this.offen.set(null);
    this.suche.set('');
    this.grenze.set(80);
    const g = this.daten()?.groups.find((x) => x.id === id);
    this.gruppenMal.set(leinwand(g ? this.gruppenForm(g) : null));
  }
  protected zeileWaehlen(i: Ding): void {
    if (!this.darf()) return;
    this.offen.set(this.offen() === i.id ? null : i.id);
    this.dingMal.set(leinwand(i.rows));
  }

  /** Die Form der Gruppe: die ihres Referenzgegenstands, wenn er eine eigene hat (wie `defaultShapeOf`). */
  protected gruppenForm(g: Gruppe): string[] | null {
    const r = g.ref ? this.daten()?.items.find((i) => i.id === g.ref) : undefined;
    if (r && (r.source === 'own' || r.source === 'item') && r.rows) return r.rows;
    return g.rows ?? null;
  }

  protected herkunft(i: Ding): string {
    const g = i.group ? this.daten()?.groups.find((x) => x.id === i.group) : undefined;
    switch (i.source) {
      case 'item': return 'on the item';
      case 'own': return 'own shape';
      case 'reference': return `inherits from ${i.refName ?? 'reference'}`;
      case 'random': return 'drawn by price';
      case 'none': return 'no shape';
      case 'unset': return 'not set';
      default: return g?.refName ? `group · like ${g.refName}` : 'group';
    }
  }
  protected chipArt(i: Ding): string {
    return i.source === 'own' || i.source === 'item' ? 'own' : i.source === 'reference' || i.source === 'random' ? 'var' : '';
  }

  protected text(rows: readonly string[] | null | undefined): string {
    return (rows ?? []).join('/');
  }
  protected breite(rows: readonly string[]): number {
    return Math.max(1, ...rows.map((z) => z.length));
  }
  protected zellen(rows: readonly string[]): boolean[] {
    const w = this.breite(rows);
    return rows.flatMap((z) => z.padEnd(w, '.').split('').map((c) => c === '#'));
  }
  protected miniZelle(rows: readonly string[] | null): number {
    if (!rows?.length) return 8;
    const n = Math.max(rows.length, this.breite(rows));
    return Math.max(4, Math.floor(38 / n) - 1);
  }
  protected kippe(netz: typeof this.gruppenMal, x: number, y: number): void {
    netz.set(netz().map((z, zy) => z.map((c, zx) => (zx === x && zy === y ? !c : c))));
  }
  private ausMal(netz: boolean[][]): string[] | null {
    return beschnitten(netz.map((z) => z.map((c) => (c ? '#' : '.')).join('')));
  }

  protected async gruppenFormSpeichern(g: Gruppe): Promise<void> {
    await this.gruppeSetzen(g.id, { rows: this.ausMal(this.gruppenMal()) });
  }
  protected async eigeneFormSpeichern(i: Ding): Promise<void> {
    const rows = this.ausMal(this.dingMal());
    await this.dingSetzen(i.id, { rows: rows ?? [] });
  }
  protected async gewicht(g: Gruppe, fi: number, ti: number, wert: string): Promise<void> {
    const shapes = (g.shapes ?? []).map((f, i) => {
      if (i !== fi) return f;
      const w = [...f.weights];
      w[ti] = Math.max(0, Number(wert) || 0);
      return { ...f, weights: w };
    });
    await this.gruppeSetzen(g.id, { shapes });
  }

  protected async gruppeSetzen(id: string, patch: Record<string, unknown>): Promise<void> {
    await this.schreibe(() => this.api.setShapeGroup(id, { ...patch, ...(this.ziel() ? { layer: this.ziel() } : {}) }), id);
  }
  protected async dingSetzen(id: string, patch: Record<string, unknown>): Promise<void> {
    const name = this.daten()?.items.find((i) => i.id === id)?.name ?? id;
    await this.schreibe(() => this.api.setShapeItem(id, { ...patch, ...(this.ziel() ? { layer: this.ziel() } : {}) }), name);
  }
  protected async lokalWeg(id: string): Promise<void> {
    await this.dingSetzen(id, { group: null, ref: null, rows: null, stackSize: null });
  }
  protected async neueGruppe(): Promise<void> {
    const name = window.prompt('Name of the new group');
    if (!name?.trim()) return;
    const id = name.trim().replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'group';
    await this.gruppeSetzen(id, { name: name.trim(), rows: ['#'], stackSize: 1 });
    this.gruppeWaehlen(id);
  }

  private async schreibe(tun: () => Promise<unknown>, was: string): Promise<void> {
    try {
      await tun();
      await this.laden();
      if (this.ding()) this.dingMal.set(leinwand(this.ding()!.rows));
      this.meldung.set(`Saved: ${was}`);
    } catch (e) {
      this.fehler.set(e instanceof ApiError ? e.message : 'Not saved. Try again.');
    }
  }
}

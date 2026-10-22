import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { itemShape, type Shape } from '@nw/model';
import { Api, ApiError, type FormenUebersicht } from '../kern/api';
import { Wahl } from './wahl';

type Gruppe = FormenUebersicht['groups'][number];
type Ding = FormenUebersicht['items'][number];

/** Woher eine Form kommt, in Worten der Seite (REQ-333). */
const HERKUNFT: Record<Ding['source'], string> = {
  item: 'on the item',
  own: 'own shape',
  reference: 'from reference',
  random: 'drawn by price',
  group: 'from group',
  none: 'no shape',
  unset: 'not set',
};

/** Zeilen als Text, wie die Vorlage der Leitung sie schreibt: `##/##`. */
const alsText = (rows: readonly string[] | null | undefined): string => (rows ?? []).join('/');
const ausText = (t: string): string[] => t.split(/[/\n]/).map((z) => z.trim()).filter(Boolean);

/**
 * **Die Vorgabeformen im Überblick** (T-394, REQ-333, Rules & options ›
 * Inventory › Shapes): links die Gruppen des Untermoduls „Default shapes“
 * mit Form, Stapel, tragbar und Referenzgegenstand, rechts die Gegenstände
 * mit der Form, die gilt, und woher. Was eigens für einen Gegenstand im
 * Untermodul steht, trägt die Marke „local“; ändern lässt es sich hier wie
 * am Element Shape. Gerechnet am Server, wie beim Lesen eines Gegenstands
 * (`GET /api/inventory/shapes`) — die Übersicht sagt nie etwas anderes als
 * der Artikel.
 */
@Component({
  selector: 'nw-formen-uebersicht',
  imports: [RouterLink, Wahl],
  template: `
    <div class="seite">
      <header class="kopf">
        <h1>Item shapes</h1>
        <p class="hinweis">
          Shapes and stack sizes from groups, for every item without its own. The precedence: on the item › own shape here ›
          reference item › group (art objects draw by price).
          @if (daten()?.campaign; as c) { Campaign: <strong>{{ c.name }}</strong>. }
          <a routerLink="/handbook">How it works</a>
        </p>
        @if (daten(); as d) {
          @if (!d.layers.length) {
            <p class="leer">No default-shapes layer is turned on in this campaign. Turn on the rule system Inventory on the campaign page.</p>
          } @else {
            <label class="ziel">Writes to
              <select [value]="ziel() ?? ''" (change)="ziel.set($any($event.target).value || null)" [disabled]="!schreibbar().length">
                @for (l of schreibbar(); track l.id) {
                  <option [value]="l.id">{{ l.name }}</option>
                } @empty {
                  <option value="">— read only —</option>
                }
              </select>
            </label>
          }
        }
        @if (fehler(); as f) { <p class="fehler" role="alert">{{ f }}</p> }
      </header>

      @if (daten(); as d) {
        <div class="zwei">
          <section class="gruppen" aria-label="Groups">
            <div class="leiste">
              <h2>Groups</h2>
              @if (darf()) { <button type="button" class="klein" (click)="neueGruppe()">+ Group</button> }
            </div>
            <button type="button" class="gruppe" [class.an]="!gewaehlt()" (click)="gewaehlt.set(null)">
              <span class="name">All items</span><span class="zahl">{{ d.items.length }}</span>
            </button>
            @for (s of abschnitte(); track s.name) {
              <h3>{{ s.name }}</h3>
              @for (g of s.gruppen; track g.id) {
                <button type="button" class="gruppe" [class.an]="gewaehlt() === g.id" (click)="gewaehlt.set(g.id)" [attr.data-gruppe]="g.id">
                  <span class="mini" [style]="raster(g.rows ?? null)">
                    @for (z of zellen(g.rows ?? null); track $index) { <i [class.voll]="z"></i> }
                  </span>
                  <span class="name">{{ g.name }}</span>
                  <span class="zahl">{{ g.count }}</span>
                </button>
              }
            }
          </section>

          <section class="dinge" aria-label="Items">
            @if (gruppe(); as g) {
              <div class="gruppenkarte">
                <h2>{{ g.name }} <span class="schluessel">{{ g.id }}</span></h2>
                @if (g.rule) { <p class="hinweis">{{ g.rule }}</p> }
                @if (g.note) { <p class="hinweis">Note: {{ g.note }}</p> }
                @if (darf()) {
                  <div class="felder">
                    <label>Name <input [value]="g.name" (change)="gruppeSetzen(g.id, { name: $any($event.target).value })" /></label>
                    <label>Section <input [value]="g.section ?? ''" (change)="gruppeSetzen(g.id, { section: $any($event.target).value || null })" /></label>
                    <label>Shape <input [value]="text(g.rows)" placeholder="##/##" (change)="gruppeSetzen(g.id, { rows: form($any($event.target).value) })" /></label>
                    <label>Stack size <input type="number" min="1" [value]="g.stackSize ?? ''" (change)="gruppeSetzen(g.id, { stackSize: zahl($any($event.target).value) })" /></label>
                    <label class="haken"><input type="checkbox" [checked]="g.carryable !== false" (change)="gruppeSetzen(g.id, { carryable: $any($event.target).checked })" /> Carried in the inventory</label>
                    <label>Reference item
                      <nw-wahl [wert]="g.ref ?? ''" [arten]="['Item']" [anlegbar]="false" label="Reference item" (wertChange)="gruppeSetzen(g.id, { ref: $event || null })" />
                    </label>
                    <label class="breit">Note <input [value]="g.note ?? ''" (change)="gruppeSetzen(g.id, { note: $any($event.target).value || null })" /></label>
                  </div>
                } @else {
                  <p class="masse">Shape {{ text(g.rows) || '—' }} · stack {{ g.stackSize ?? '—' }} · {{ g.carryable === false ? 'not carried' : 'carried' }}
                    @if (g.refName) { · reference {{ g.refName }} }</p>
                }
              </div>
            }

            <div class="filter">
              <input type="search" placeholder="Filter items…" aria-label="Filter items" [value]="suche()" (input)="suche.set($any($event.target).value)" />
              <label class="haken"><input type="checkbox" [checked]="nurLokal()" (change)="nurLokal.set($any($event.target).checked)" /> Only local overrides</label>
              <span class="zahl">{{ gezeigt().length }} of {{ gefiltert().length }}</span>
            </div>

            <ul class="liste">
              @for (i of gezeigt(); track i.id) {
                <li [class.offen]="offen() === i.id" [attr.data-item]="i.id">
                  <div class="zeile">
                    <span class="mini" [style]="raster(i.rows)">
                      @for (z of zellen(i.rows); track $index) { <i [class.voll]="z"></i> }
                    </span>
                    <a class="name" [routerLink]="['/artikel', i.id]">{{ i.name }}</a>
                    <span class="quelle" [class]="'q-' + i.source">{{ herkunft(i) }}</span>
                    @if (i.set) { <span class="marke" title="Something is set for this item in the default shapes">local</span> }
                    <span class="stapel">{{ i.stackSize ?? '—' }}</span>
                    @if (darf()) { <button type="button" class="klein" (click)="offen.set(offen() === i.id ? null : i.id)">{{ offen() === i.id ? 'Close' : 'Edit' }}</button> }
                  </div>
                  @if (offen() === i.id) {
                    <div class="felder">
                      <label>Group
                        <select [value]="i.set?.group ?? ''" (change)="dingSetzen(i.id, { group: $any($event.target).value || null })">
                          <option value="">— none —</option>
                          @for (g of d.groups; track g.id) { <option [value]="g.id">{{ g.name }}</option> }
                        </select>
                      </label>
                      <label>Reference item
                        <nw-wahl [wert]="i.set?.ref ?? ''" [arten]="['Item']" [ausser]="i.id" [anlegbar]="false" label="Reference item" (wertChange)="dingSetzen(i.id, { ref: $event || null })" />
                      </label>
                      <label>Own shape <input [value]="text(i.set?.rows)" placeholder="from group" (change)="dingSetzen(i.id, { rows: form($any($event.target).value) })" /></label>
                      <label>Stack size <input type="number" min="1" [value]="i.set?.stackSize ?? ''" placeholder="from group" (change)="dingSetzen(i.id, { stackSize: zahl($any($event.target).value) })" /></label>
                      <div class="knoepfe">
                        <button type="button" class="klein" (click)="dingSetzen(i.id, { rows: [] })">No shape</button>
                        @if (i.set) { <button type="button" class="klein" (click)="lokalWeg(i.id)">Clear local</button> }
                      </div>
                    </div>
                  }
                </li>
              }
            </ul>
            @if (gefiltert().length > gezeigt().length) {
              <button type="button" class="klein mehr" (click)="grenze.set(grenze() + 200)">Show more</button>
            }
          </section>
        </div>
      } @else if (!fehler()) {
        <p class="hinweis">Loading…</p>
      }
    </div>
  `,
  styles: `
    .seite { max-width: 1200px; margin: 0 auto; padding: 1.25rem 1rem 3rem; }
    h1, h2, h3 { font-family: var(--caps); color: var(--heading); }
    h1 { margin: 0 0 0.3rem; }
    h2 { font-size: 1.05rem; margin: 0.2rem 0; }
    h3 { font-size: 0.8rem; color: var(--dim); margin: 0.8rem 0 0.2rem; text-transform: uppercase; letter-spacing: 0.04em; }
    .hinweis, .masse { color: var(--dim); margin: 0.2rem 0; }
    .fehler { color: var(--danger, #a33); }
    .leer { color: var(--dim); font-style: italic; }
    .ziel { display: inline-flex; gap: 0.4rem; align-items: center; margin-top: 0.4rem; }
    .zwei { display: grid; grid-template-columns: minmax(220px, 300px) 1fr; gap: 1rem; margin-top: 1rem; }
    @media (max-width: 720px) { .zwei { grid-template-columns: 1fr; } .gruppen { max-height: 40vh; overflow-y: auto; } }
    .leiste { display: flex; justify-content: space-between; align-items: center; }
    .gruppe {
      display: flex; gap: 0.5rem; align-items: center; width: 100%; text-align: left;
      border: 1px solid transparent; background: none; color: var(--ink); padding: 0.25rem 0.35rem; border-radius: 4px; cursor: pointer;
    }
    .gruppe.an { border-color: var(--accent); background: var(--chip); }
    .gruppe .name, .zeile .name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .zahl, .stapel { color: var(--dim); font-variant-numeric: tabular-nums; }
    .mini { display: inline-grid; grid-template-columns: repeat(var(--w), 6px); grid-auto-rows: 6px; gap: 1px; min-width: 20px; }
    .mini i { background: var(--line2); }
    .mini i.voll { background: var(--accent); }
    .gruppenkarte { border: 1px solid var(--line2); border-radius: 6px; padding: 0.6rem 0.8rem; background: var(--surface); margin-bottom: 0.8rem; }
    .schluessel { font-family: monospace; font-size: 0.8rem; color: var(--dim); }
    .felder { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 0.4rem 0.8rem; margin-top: 0.4rem; }
    .felder label { display: flex; flex-direction: column; font-size: 0.85rem; color: var(--dim); gap: 0.15rem; }
    .felder label.haken { flex-direction: row; align-items: center; }
    .felder .breit { grid-column: 1 / -1; }
    .filter { display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; margin-bottom: 0.4rem; }
    .filter input[type='search'] { flex: 1; min-width: 140px; }
    .liste { list-style: none; padding: 0; margin: 0; }
    .liste li { border-bottom: 1px solid var(--line2); padding: 0.3rem 0; }
    .liste li.offen { background: var(--surface); }
    .zeile { display: flex; gap: 0.5rem; align-items: center; }
    .quelle { font-size: 0.78rem; color: var(--dim); white-space: nowrap; }
    .q-item, .q-own { color: var(--accent); }
    .marke { font-size: 0.72rem; border: 1px solid var(--accent); color: var(--accent); border-radius: 3px; padding: 0 0.25rem; }
    .knoepfe { display: flex; gap: 0.4rem; align-items: end; }
    .mehr { margin-top: 0.6rem; }
  `,
})
export class FormenUebersichtSeite {
  private readonly api = inject(Api);

  protected readonly daten = signal<FormenUebersicht | null>(null);
  protected readonly fehler = signal<string | null>(null);
  protected readonly gewaehlt = signal<string | null>(null);
  protected readonly suche = signal('');
  protected readonly nurLokal = signal(false);
  protected readonly offen = signal<string | null>(null);
  protected readonly grenze = signal(200);
  protected readonly ziel = signal<string | null>(null);

  protected readonly schreibbar = computed(() => (this.daten()?.layers ?? []).filter((l) => l.writable));
  protected readonly darf = computed(() => this.schreibbar().length > 0);
  protected readonly gruppe = computed<Gruppe | undefined>(() => this.daten()?.groups.find((g) => g.id === this.gewaehlt()));
  protected readonly abschnitte = computed(() => {
    const m = new Map<string, Gruppe[]>();
    for (const g of this.daten()?.groups ?? []) {
      const s = g.section || 'Groups';
      m.set(s, [...(m.get(s) ?? []), g]);
    }
    return [...m].map(([name, gruppen]) => ({ name, gruppen }));
  });
  protected readonly gefiltert = computed<Ding[]>(() => {
    const q = this.suche().trim().toLowerCase();
    const g = this.gewaehlt();
    return (this.daten()?.items ?? []).filter(
      (i) => (!g || i.group === g) && (!this.nurLokal() || !!i.set) && (!q || i.name.toLowerCase().includes(q)),
    );
  });
  protected readonly gezeigt = computed(() => this.gefiltert().slice(0, this.grenze()));

  constructor() {
    void this.laden();
  }

  private async laden(): Promise<void> {
    try {
      const d = await this.api.shapeOverview();
      this.daten.set(d);
      if (!this.ziel() || !d.layers.some((l) => l.id === this.ziel() && l.writable)) this.ziel.set(d.target);
      this.fehler.set(null);
    } catch (e) {
      this.fehler.set(e instanceof ApiError ? e.message : 'The overview could not be loaded. Reload the page.');
    }
  }

  protected herkunft(i: Ding): string {
    const g = i.group ? this.daten()?.groups.find((x) => x.id === i.group)?.name : undefined;
    if (i.source === 'reference') return `from ${i.refName ?? 'reference item'}`;
    if (i.source === 'group' || i.source === 'random') return `${HERKUNFT[i.source]}${g ? ` ${g}` : ''}`;
    return HERKUNFT[i.source];
  }

  protected text(rows: readonly string[] | null | undefined): string {
    return alsText(rows);
  }
  protected form(t: string): string[] | null {
    const r = ausText(t);
    return r.length ? r : null;
  }
  protected zahl(t: string): number | null {
    const n = Number(t);
    return t.trim() && Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
  }

  private shape(rows: readonly string[] | null): Shape {
    return itemShape(rows ?? ['#']);
  }
  protected raster(rows: readonly string[] | null): Record<string, string> {
    return { '--w': String(this.shape(rows).w) };
  }
  protected zellen(rows: readonly string[] | null): boolean[] {
    if (!rows) return [false];
    const s = this.shape(rows);
    return s.rows.flatMap((z) => z.padEnd(s.w, '.').split('').map((c) => c !== '.' && c !== ' '));
  }

  protected async gruppeSetzen(id: string, patch: Record<string, unknown>): Promise<void> {
    await this.schreibe(() => this.api.setShapeGroup(id, { ...patch, ...(this.ziel() ? { layer: this.ziel() } : {}) }));
  }
  protected async dingSetzen(id: string, patch: Record<string, unknown>): Promise<void> {
    await this.schreibe(() => this.api.setShapeItem(id, { ...patch, ...(this.ziel() ? { layer: this.ziel() } : {}) }));
  }
  protected async lokalWeg(id: string): Promise<void> {
    await this.dingSetzen(id, { group: null, ref: null, rows: null, stackSize: null });
  }
  protected async neueGruppe(): Promise<void> {
    const name = window.prompt('Name of the new group');
    if (!name?.trim()) return;
    const id = name.trim().replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'group';
    await this.gruppeSetzen(id, { name: name.trim(), rows: ['#'], stackSize: 1 });
    this.gewaehlt.set(id);
  }

  private async schreibe(tun: () => Promise<unknown>): Promise<void> {
    try {
      await tun();
      await this.laden();
    } catch (e) {
      this.fehler.set(e instanceof ApiError ? e.message : 'Saving failed. Try again.');
    }
  }
}

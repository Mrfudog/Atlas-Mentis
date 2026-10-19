import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import {
  formatColumnZones, formatContainerPreset, formatPairs, parseCarrySquares, parseContainerPreset, parsePairs, zonesByColumn,
} from '@nw/model';
import { Bestand } from '../kern/bestand';

/** Eine Behältervorlage im Entwurf: Name, gemalte Form, Zone je Spalte. */
interface Vorlage {
  name: string;
  grid: string[];
  zonen: Record<number, string | undefined>;
}

/** Was der Editor bearbeitet — die Einstellungen von Basils Blatt, gelesen. */
interface Entwurf {
  groessen: { name: string; n: number }[];
  zonen: Record<number, string | undefined>;
  vorlagen: Vorlage[];
  hand: { drop: string; stow: string };
  plaetze: Record<string, string | undefined>;
  cols: number;
  rows: number;
}

const VORLAGE = 'container:';

/** Wie weit das Zusatzquadrat reicht, wenn der Statblock nichts sagt (`carryExtra.max`). */
const ZUSATZ_MAX = 5;

/**
 * **Das Tragraster einstellen** (REQ-355, T-291): Basils Blatt ohne
 * Einstellungszeilen. Je Kreaturgrösse die Seitenlänge, die Zonen je
 * Spalte gleich am gezeichneten Raster, die Behältervorlagen gemalt, und
 * was Fallenlassen, Verstauen und die Körperplätze kosten (D54, D58).
 *
 * Geschrieben werden dieselben Einstellungen wie zuvor (`carrySquares`,
 * `carryZones`, `container:*`, `handActions`, `slotDraw`,
 * `inventoryCols`/`inventoryRows`) — sie gelten weiter für die ganze
 * Installation; der Server lässt nur die Leitung der laufenden Kampagne
 * und die Verwaltung schreiben.
 */
@Component({
  selector: 'nw-tragraster',
  template: `
    @if (entwurf(); as d) {
      <div class="tragraster">
        <h5>Grid size per creature size</h5>
        <p class="hint">The side of the base square. A creature whose size is missing here gets the plain rectangle below.</p>
        <div class="groessen">
          @for (g of d.groessen; track $index) {
            <label class="groesse" [class.vorschau]="vorschau() === g.name">
              <input type="text" class="name" [value]="g.name" aria-label="Size" (change)="groesse($index, { name: $any($event.target).value })" />
              <input type="number" min="1" max="20" [value]="g.n" aria-label="Side" (change)="groesse($index, { n: +$any($event.target).value })" />
              <button type="button" class="klein" (click)="vorschau.set(g.name)" [attr.aria-pressed]="vorschau() === g.name">Show</button>
              <button type="button" class="klein" (click)="groesseWeg($index)" [attr.aria-label]="'Remove ' + g.name">×</button>
            </label>
          }
          <button type="button" class="klein" (click)="groesseNeu()">+ Size</button>
        </div>

        <h5>Zones</h5>
        <p class="hint">Pick per column how long it takes to get something from there. Solid: the base square of “{{ vorschau() }}”; hatched: the extra square from Strength (up to {{ zusatzMax() }}).</p>
        <div class="raster" [style.--spalten]="breite()">
          @for (x of spalten(); track x) {
            <select class="spalte" [attr.aria-label]="'Zone of column ' + (x + 1)" (change)="zone(x, $any($event.target).value)">
              <option value="" [selected]="!d.zonen[x]">—</option>
              @for (l of leiter(); track l) {
                <option [value]="l" [selected]="l === d.zonen[x]">{{ l }}</option>
              }
            </select>
          }
          @for (y of zeilen(); track y) {
            @for (x of spalten(); track x) {
              <span class="feld" [class.basis]="x < basis() && y < basis()" [class.zusatz]="x >= links() && y < zusatzMax()"
                    [class.aus]="!(x < basis() && y < basis()) && !(x >= links() && y < zusatzMax())"
                    [style.background-color]="farbe(d.zonen[x])" [attr.title]="(d.zonen[x] ?? 'no zone') + (x >= links() ? ' · extra square' : '')"></span>
            }
          }
        </div>
        <p class="legende">
          @for (l of leiter(); track l) {
            <span><i [style.background]="farbe(l)"></i>{{ l }}</span>
          }
        </p>

        <h5>Without a size</h5>
        <p class="hint">The rectangle for a creature without a statblock size and for any container without a shape of its own.</p>
        <div class="zeile">
          <label>Columns <input type="number" min="1" max="30" [value]="d.cols" (change)="setze({ cols: +$any($event.target).value || 10 })" /></label>
          <label>Rows <input type="number" min="1" max="30" [value]="d.rows" (change)="setze({ rows: +$any($event.target).value || 6 })" /></label>
        </div>

        <h5>Container templates</h5>
        <p class="hint">Offered when a container is set up. Click a cell to open or close it; the zone sits above its column.</p>
        @for (v of d.vorlagen; track $index; let i = $index) {
          <div class="vorlage">
            <div class="zeile">
              <input type="text" class="name" [value]="v.name" aria-label="Template name" (change)="vorlage(i, { name: $any($event.target).value })" />
              <label>Width <input type="number" min="1" max="20" [value]="breiteVon(v)" (change)="masse(i, +$any($event.target).value, v.grid.length)" /></label>
              <label>Height <input type="number" min="1" max="20" [value]="v.grid.length" (change)="masse(i, breiteVon(v), +$any($event.target).value)" /></label>
              <button type="button" class="klein" (click)="vorlageWeg(i)" [attr.aria-label]="'Remove ' + v.name">×</button>
            </div>
            <div class="raster" [style.--spalten]="breiteVon(v)">
              @for (x of reihe(breiteVon(v)); track x) {
                <select class="spalte" [attr.aria-label]="'Zone of column ' + (x + 1)" (change)="vorlageZone(i, x, $any($event.target).value)">
                  <option value="" [selected]="!v.zonen[x]">—</option>
                  @for (l of leiter(); track l) {
                    <option [value]="l" [selected]="l === v.zonen[x]">{{ l }}</option>
                  }
                </select>
              }
              @for (y of reihe(v.grid.length); track y) {
                @for (x of reihe(breiteVon(v)); track x) {
                  <button type="button" class="feld" [class.aus]="!offen(v, x, y)" [style.background-color]="offen(v, x, y) ? farbe(v.zonen[x]) : null"
                          [attr.aria-label]="'Cell ' + (x + 1) + ',' + (y + 1)" [attr.aria-pressed]="offen(v, x, y)" (click)="kippe(i, x, y)"></button>
                }
              }
            </div>
          </div>
        }
        <button type="button" class="klein" (click)="vorlageNeu()">+ Template</button>

        <h5>Hands</h5>
        <div class="zeile">
          <label>Drop
            <select (change)="setze({ hand: { drop: $any($event.target).value, stow: d.hand.stow } })">
              <option value="" [selected]="!d.hand.drop">— not offered</option>
              @for (l of leiter(); track l) {
                <option [value]="l" [selected]="l === d.hand.drop">{{ l }}</option>
              }
            </select>
          </label>
          <label>Stow
            <select (change)="setze({ hand: { drop: d.hand.drop, stow: $any($event.target).value } })">
              <option value="" [selected]="!d.hand.stow">— not offered</option>
              @for (l of leiter(); track l) {
                <option [value]="l" [selected]="l === d.hand.stow">{{ l }}</option>
              }
            </select>
          </label>
        </div>

        <details>
          <summary>Body slots ({{ platzNamen().length }})</summary>
          <p class="hint">How fast something comes from a body slot; a container there adds one step for what is inside.</p>
          <div class="plaetze">
            @for (p of platzNamen(); track p) {
              <label>{{ p }}
                <select (change)="platz(p, $any($event.target).value)">
                  <option value="" [selected]="!d.plaetze[p]">—</option>
                  @for (l of leiter(); track l) {
                    <option [value]="l" [selected]="l === d.plaetze[p]">{{ l }}</option>
                  }
                </select>
              </label>
            }
          </div>
        </details>

        @if (fehler(); as f) {
          <p class="fehler" role="alert">{{ f }}</p>
        }
        <div class="zeile knoepfe">
          <button type="button" class="pri" [disabled]="!geaendert() || laeuft()" (click)="speichern()">{{ laeuft() ? 'Saving…' : 'Save grid settings' }}</button>
          <button type="button" [disabled]="!geaendert() || laeuft()" (click)="zuruecksetzen()">Discard changes</button>
          @if (gespeichert()) {
            <span class="hint" role="status">Saved — applies to every campaign of this installation.</span>
          }
        </div>
      </div>
    }
  `,
  styles: `
    .tragraster { display: flex; flex-direction: column; align-items: flex-start; gap: 0.35rem; margin-top: 0.4rem; }
    .tragraster > .raster { align-self: stretch; }
    h5 { margin: 0.7rem 0 0; font-size: 0.95rem; }
    .hint { color: var(--dim); margin: 0; font-size: 0.9rem; }
    .groessen, .zeile, .plaetze { display: flex; flex-wrap: wrap; gap: 0.4rem 0.8rem; align-items: center; }
    .groesse { display: inline-flex; gap: 0.25rem; align-items: center; padding: 0.15rem 0.3rem; border: 1px solid var(--line); border-radius: 6px; }
    .groesse.vorschau { border-color: var(--accent); }
    input.name { width: 8rem; }
    input[type='number'] { width: 4rem; }
    .raster { display: grid; grid-template-columns: repeat(var(--spalten), minmax(1.6rem, 2.2rem)); gap: 2px; max-width: 100%; overflow-x: auto; }
    .spalte { font-size: 0.7rem; padding: 0; min-width: 0; width: 100%; }
    .feld { aspect-ratio: 1; border: 1px solid var(--line); border-radius: 2px; padding: 0; min-height: 1.4rem; background: var(--surface); }
    /* Das Zusatzquadrat schraffiert statt blasser: die Farbe sagt die Zone, und die soll gleich bleiben. */
    .feld.zusatz:not(.basis) { background-image: repeating-linear-gradient(45deg, var(--line) 0 2px, transparent 2px 6px); }
    .feld.aus { background-color: transparent !important; background-image: none; border-style: dotted; opacity: 0.6; }
    button.feld { cursor: pointer; }
    .legende { display: flex; flex-wrap: wrap; gap: 0.2rem 0.8rem; margin: 0.2rem 0 0; font-size: 0.85rem; color: var(--dim); }
    .legende i { display: inline-block; width: 0.8rem; height: 0.8rem; margin-right: 0.25rem; vertical-align: -0.1rem; border: 1px solid var(--line); }
    .vorlage { border-left: 3px solid var(--line); padding: 0.3rem 0.6rem; display: flex; flex-direction: column; gap: 0.3rem; }
    .plaetze label { display: inline-flex; gap: 0.3rem; align-items: center; }
    .knoepfe { margin-top: 0.6rem; }
    .fehler { color: var(--warn); }
  `,
})
export class Tragraster {
  private readonly bestand = inject(Bestand);

  private readonly settings = computed(() => this.bestand.registry()?.settings ?? {});
  protected readonly leiter = computed<string[]>(() => this.bestand.registry()?.enums?.['DrawTime']?.values ?? []);
  protected readonly zusatzMax = computed(() => {
    const pd = this.bestand.registry()?.interfaces['Statblock']?.schema?.properties?.['carryExtra'];
    return typeof pd?.max === 'number' ? pd.max : ZUSATZ_MAX;
  });

  protected readonly entwurf = signal<Entwurf | null>(null);
  /** Der Stand beim Laden, als Text — „geändert“ ist ein Vergleich, kein Zähler. */
  private readonly geladen = signal('');
  protected readonly vorschau = signal('medium');
  protected readonly laeuft = signal(false);
  protected readonly fehler = signal('');
  protected readonly gespeichert = signal(false);

  constructor() {
    effect(() => {
      const s = this.settings();
      untracked(() => {
        if (this.entwurf() && this.geaendert()) return;
        this.lies(s);
      });
    });
  }

  private lies(s: Record<string, string>): void {
    const d: Entwurf = {
      groessen: Object.entries(parseCarrySquares(s['carrySquares'])).map(([name, n]) => ({ name, n })),
      zonen: zonesByColumn(s['carryZones']),
      vorlagen: Object.keys(s)
        .filter((k) => k.startsWith(VORLAGE))
        .map((k) => {
          const p = parseContainerPreset(s[k]);
          const zonen = zonesByColumn(String(s[k] ?? '').split('|')[1]);
          return { name: k.slice(VORLAGE.length), grid: p?.grid ?? ['#'], zonen };
        }),
      hand: { drop: parsePairs(s['handActions'])['drop'] ?? '', stow: parsePairs(s['handActions'])['stow'] ?? '' },
      plaetze: Object.fromEntries(Object.entries(parsePairs(s['slotDraw'])).map(([k, v]) => [k, v === '-' ? '' : v])),
      cols: Number(s['inventoryCols']) || 10,
      rows: Number(s['inventoryRows']) || 6,
    };
    this.entwurf.set(d);
    this.geladen.set(JSON.stringify(d));
    if (!d.groessen.some((g) => g.name === this.vorschau()) && d.groessen.length) this.vorschau.set(d.groessen[d.groessen.length - 1]!.name);
  }

  protected readonly geaendert = computed(() => JSON.stringify(this.entwurf()) !== this.geladen());

  /** Links steht das grösste Grundquadrat, rechts davon das Zusatzquadrat — wie `carryGrid` es zeichnet. */
  protected readonly links = computed(() => Math.max(0, ...(this.entwurf()?.groessen ?? []).map((g) => g.n)));
  protected readonly breite = computed(() => this.links() + this.zusatzMax());
  protected readonly basis = computed(() => this.entwurf()?.groessen.find((g) => g.name === this.vorschau())?.n ?? 0);
  protected readonly spalten = computed(() => this.reihe(this.breite()));
  protected readonly zeilen = computed(() => this.reihe(Math.max(this.links(), this.zusatzMax())));
  protected readonly platzNamen = computed(() => Object.keys(this.entwurf()?.plaetze ?? {}));

  protected reihe(n: number): number[] {
    return Array.from({ length: Math.max(0, n) }, (_, i) => i);
  }

  /** Je Stufe eine Tönung der Akzentfarbe: schneller heller, langsamer dunkler. */
  protected farbe(stufe: string | undefined): string | null {
    const i = stufe ? this.leiter().indexOf(stufe) : -1;
    if (i < 0) return null;
    const anteil = Math.round(15 + (70 * i) / Math.max(1, this.leiter().length - 1));
    return `color-mix(in srgb, var(--accent) ${anteil}%, transparent)`;
  }

  protected setze(teil: Partial<Entwurf>): void {
    const d = this.entwurf();
    if (d) this.entwurf.set({ ...d, ...teil });
    this.gespeichert.set(false);
  }

  protected groesse(i: number, teil: Partial<{ name: string; n: number }>): void {
    const d = this.entwurf();
    if (!d) return;
    const alt = d.groessen[i]!;
    const neu = { ...alt, ...teil, name: (teil.name ?? alt.name).trim().toLowerCase(), n: Math.max(1, Math.trunc(teil.n ?? alt.n) || 1) };
    if (this.vorschau() === alt.name) this.vorschau.set(neu.name);
    this.setze({ groessen: d.groessen.map((g, j) => (j === i ? neu : g)) });
  }

  protected groesseNeu(): void {
    const d = this.entwurf();
    if (!d) return;
    let name = 'huge';
    for (let k = 2; d.groessen.some((g) => g.name === name); k++) name = `size${k}`;
    this.setze({ groessen: [...d.groessen, { name, n: this.links() + 1 }] });
  }

  protected groesseWeg(i: number): void {
    const d = this.entwurf();
    if (d) this.setze({ groessen: d.groessen.filter((_, j) => j !== i) });
  }

  protected zone(x: number, stufe: string): void {
    const d = this.entwurf();
    if (!d) return;
    const zonen = { ...d.zonen };
    if (stufe) zonen[x] = stufe;
    else delete zonen[x];
    this.setze({ zonen });
  }

  protected breiteVon(v: Vorlage): number {
    return v.grid.reduce((m, r) => Math.max(m, r.length), 1);
  }

  protected offen(v: Vorlage, x: number, y: number): boolean {
    const c = v.grid[y]?.charAt(x) ?? '';
    return c !== '' && c !== '.' && c !== ' ';
  }

  protected vorlage(i: number, teil: Partial<Vorlage>): void {
    const d = this.entwurf();
    if (!d) return;
    const v = { ...d.vorlagen[i]!, ...teil };
    if (teil.name !== undefined) v.name = teil.name.trim().replace(/[|:,]/g, '');
    this.setze({ vorlagen: d.vorlagen.map((w, j) => (j === i ? v : w)) });
  }

  protected masse(i: number, w: number, h: number): void {
    const v = this.entwurf()?.vorlagen[i];
    if (!v) return;
    const br = Math.min(20, Math.max(1, Math.trunc(w) || 1));
    const ho = Math.min(20, Math.max(1, Math.trunc(h) || 1));
    const grid = Array.from({ length: ho }, (_, y) => (v.grid[y] ?? '').padEnd(br, '#').slice(0, br));
    const zonen = Object.fromEntries(Object.entries(v.zonen).filter(([x]) => Number(x) < br));
    this.vorlage(i, { grid, zonen });
  }

  protected kippe(i: number, x: number, y: number): void {
    const v = this.entwurf()?.vorlagen[i];
    if (!v) return;
    const grid = v.grid.map((r, j) => (j === y ? r.padEnd(x + 1, '.').split('').map((c, k) => (k === x ? (this.offen(v, x, y) ? '.' : '#') : c)).join('') : r));
    this.vorlage(i, { grid });
  }

  protected vorlageZone(i: number, x: number, stufe: string): void {
    const v = this.entwurf()?.vorlagen[i];
    if (!v) return;
    const zonen = { ...v.zonen };
    if (stufe) zonen[x] = stufe;
    else delete zonen[x];
    this.vorlage(i, { zonen });
  }

  protected vorlageNeu(): void {
    const d = this.entwurf();
    if (!d) return;
    let name = 'New container';
    for (let k = 2; d.vorlagen.some((v) => v.name === name); k++) name = `New container ${k}`;
    this.setze({ vorlagen: [...d.vorlagen, { name, grid: ['####', '####', '####'], zonen: {} }] });
  }

  protected vorlageWeg(i: number): void {
    const d = this.entwurf();
    if (d) this.setze({ vorlagen: d.vorlagen.filter((_, j) => j !== i) });
  }

  protected platz(p: string, stufe: string): void {
    const d = this.entwurf();
    if (d) this.setze({ plaetze: { ...d.plaetze, [p]: stufe } });
  }

  protected zuruecksetzen(): void {
    this.fehler.set('');
    this.lies(this.settings());
  }

  protected async speichern(): Promise<void> {
    const d = this.entwurf();
    if (!d) return;
    const namen = d.vorlagen.map((v) => v.name);
    if (namen.some((n) => !n) || new Set(namen).size !== namen.length) {
      this.fehler.set('Every template needs a name of its own.');
      return;
    }
    this.laeuft.set(true);
    this.fehler.set('');
    /* Alles andere in den Einstellungen bleibt, wie es ist; nur die
       Vorlagen werden ganz ersetzt, damit eine gelöschte auch weg ist. */
    const neu: Record<string, string> = Object.fromEntries(Object.entries(this.settings()).filter(([k]) => !k.startsWith(VORLAGE)));
    neu['carrySquares'] = formatPairs(Object.fromEntries(d.groessen.map((g) => [g.name, g.n])));
    neu['carryZones'] = formatColumnZones(d.zonen);
    neu['handActions'] = formatPairs({ drop: d.hand.drop, stow: d.hand.stow });
    /* Ein Platz ohne Stufe bleibt in der Liste, sonst verschwände er aus der Auswahl. */
    neu['slotDraw'] = Object.entries(d.plaetze).map(([k, v]) => `${k}:${v || '-'}`).join(', ');
    neu['inventoryCols'] = String(d.cols);
    neu['inventoryRows'] = String(d.rows);
    for (const v of d.vorlagen) neu[`${VORLAGE}${v.name}`] = formatContainerPreset(v.grid, v.zonen);
    try {
      await this.bestand.registerSchreiben('settings', neu);
      this.lies(neu);
      this.gespeichert.set(true);
    } catch (e) {
      this.fehler.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.laeuft.set(false);
    }
  }
}

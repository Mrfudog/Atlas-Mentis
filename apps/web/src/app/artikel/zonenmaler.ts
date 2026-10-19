import { Component, computed, input, output, signal } from '@angular/core';
import { blockWidth, type CarryZone } from '@nw/model';
import { zonenFarbe } from '../kern/zonenfarbe';

/** Was der Maler zurückgibt: die Form und ihre Zonen. */
export interface Gemalt {
  rows: string[];
  zones: CarryZone[];
}

const FREI = new Set(['0', '.', ' ', '_', '']);
const MAX = 20;

/**
 * **Ein Raster mit Zonen malen** (REQ-356): Felder wählen — klicken oder
 * ziehen, auch mit dem Finger —, aus der Auswahl eine Zone anlegen, ihr
 * eine Dauer geben, Felder dazunehmen oder herausnehmen, die Zone löschen;
 * dazu Felder sperren und öffnen. Ein Feld liegt in höchstens einer Zone:
 * wer es einer anderen gibt, nimmt es der alten.
 *
 * Der Maler hält nur die Auswahl; Form und Zonen gehören dem, der ihn
 * benutzt, und kommen als neuer Wert zurück (`aendern`).
 */
@Component({
  selector: 'nw-zonenmaler',
  template: `
    <div class="werkzeug">
      <label>Width <input type="number" min="1" [max]="max" [value]="breite()" (change)="masse(+$any($event.target).value, rows().length)" /></label>
      <label>Height <input type="number" min="1" [max]="max" [value]="rows().length" (change)="masse(breite(), +$any($event.target).value)" /></label>
      <button type="button" class="klein" (click)="alle()">Select all</button>
      @if (auswahl().size) {
        <button type="button" class="klein" (click)="auswahl.set(leer())">Clear selection ({{ auswahl().size }})</button>
        <button type="button" class="klein" (click)="sperre(true)">Close cells</button>
        <button type="button" class="klein" (click)="sperre(false)">Open cells</button>
      }
    </div>

    <div class="raster" [style.--spalten]="breite()" role="grid" [attr.aria-label]="label()"
         (pointermove)="ziehe($event)" (pointerup)="modus = null" (pointerleave)="modus = null" (pointercancel)="modus = null">
      @for (y of reihe(rows().length); track y) {
        @for (x of reihe(breite()); track x) {
          <button type="button" class="feld" [attr.data-zelle]="x + ',' + y" [class.aus]="!offen(x, y)" [class.gewaehlt]="auswahl().has(x + ',' + y)"
                  [style.background-color]="offen(x, y) ? farbe(zoneAn().get(x + ',' + y)) : null"
                  [attr.aria-pressed]="auswahl().has(x + ',' + y)" [attr.aria-label]="zellText(x, y)"
                  (pointerdown)="beginne($event, x, y)" (keydown.enter)="kippe(x + ',' + y)" (keydown.space)="$event.preventDefault(); kippe(x + ',' + y)"></button>
        }
      }
    </div>

    <div class="zonen">
      @for (z of zones(); track z.id; let i = $index) {
        <div class="zeile-zone">
          <i class="muster" [style.background-color]="farbe(z.draw)"></i>
          <input type="text" class="zname" [value]="z.label ?? ''" [placeholder]="z.draw || 'Zone'" aria-label="Zone name" (change)="zoneAendern(i, { label: $any($event.target).value.trim() || undefined })" />
          <select aria-label="Duration" (change)="zoneAendern(i, { draw: $any($event.target).value })">
            @for (l of leiter(); track l) {
              <option [value]="l" [selected]="l === z.draw">{{ l }}</option>
            }
          </select>
          <small>{{ z.cells.length }} {{ z.cells.length === 1 ? 'cell' : 'cells' }}</small>
          <button type="button" class="klein" (click)="waehleZone(z)">Select</button>
          @if (auswahl().size) {
            <button type="button" class="klein" (click)="gib(i)">Add selection</button>
            <button type="button" class="klein" (click)="nimm(i)">Remove selection</button>
          }
          <button type="button" class="klein" (click)="loesche(i)" [attr.aria-label]="'Delete zone ' + (z.label || z.draw)">×</button>
        </div>
      }
      @if (auswahl().size) {
        <div class="zeile-zone neu">
          <select aria-label="Duration of the new zone" (change)="neueDauer.set($any($event.target).value)">
            @for (l of leiter(); track l) {
              <option [value]="l" [selected]="l === dauerNeu()">{{ l }}</option>
            }
          </select>
          <button type="button" class="klein" (click)="neueZone()">+ Zone from selection</button>
        </div>
      } @else if (!zones().length) {
        <p class="hint">Select cells — click or drag — to make a zone.</p>
      }
    </div>
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 0.35rem; }
    .werkzeug, .zeile-zone { display: flex; flex-wrap: wrap; gap: 0.3rem 0.6rem; align-items: center; }
    input[type='number'] { width: 3.6rem; }
    .raster { display: grid; grid-template-columns: repeat(var(--spalten), minmax(1.5rem, 2rem)); gap: 2px; max-width: 100%; overflow-x: auto; touch-action: none; user-select: none; }
    .feld { aspect-ratio: 1; min-height: 1.4rem; padding: 0; border: 1px solid var(--line); border-radius: 2px; background: var(--surface); cursor: pointer; }
    .feld.aus { background-color: transparent !important; border-style: dotted; opacity: 0.6; }
    .feld.gewaehlt { outline: 2px solid var(--fg, currentColor); outline-offset: -3px; }
    .zonen { display: flex; flex-direction: column; gap: 0.25rem; }
    .muster { display: inline-block; width: 0.9rem; height: 0.9rem; border: 1px solid var(--line); border-radius: 2px; }
    .zname { width: 8rem; }
    small, .hint { color: var(--dim); }
    .hint { margin: 0; font-size: 0.9rem; }
  `,
})
export class Zonenmaler {
  readonly rows = input.required<string[]>();
  readonly zones = input.required<CarryZone[]>();
  readonly leiter = input.required<string[]>();
  readonly label = input('Grid');
  readonly aendern = output<Gemalt>();

  protected readonly max = MAX;
  protected readonly auswahl = signal<ReadonlySet<string>>(new Set());
  protected readonly neueDauer = signal('');
  /** Beim Ziehen: Felder dazunehmen oder herausnehmen — wie das erste Feld es sagte. */
  protected modus: 'an' | 'aus' | null = null;

  protected readonly breite = computed(() => Math.max(1, blockWidth(this.rows())));
  protected readonly zoneAn = computed(() => {
    const m = new Map<string, string>();
    for (const z of this.zones()) for (const c of z.cells) m.set(c, z.draw);
    return m;
  });
  /** Vorgeschlagen für eine neue Zone: die erste Stufe, die noch keine hat. */
  protected readonly dauerNeu = computed(() => {
    const gewaehlt = this.neueDauer();
    if (gewaehlt) return gewaehlt;
    const da = new Set(this.zones().map((z) => z.draw));
    return this.leiter().find((l) => !da.has(l)) ?? this.leiter()[0] ?? '';
  });

  protected reihe(n: number): number[] {
    return Array.from({ length: Math.max(0, n) }, (_, i) => i);
  }

  protected leer(): ReadonlySet<string> {
    return new Set();
  }

  protected offen(x: number, y: number): boolean {
    return !FREI.has(this.rows()[y]?.charAt(x) ?? '');
  }

  protected farbe(stufe: string | undefined): string | null {
    return zonenFarbe(stufe, this.leiter());
  }

  protected zellText(x: number, y: number): string {
    const z = this.zoneAn().get(`${x},${y}`);
    return `Cell ${x + 1},${y + 1}${this.offen(x, y) ? '' : ', closed'}${z ? `, ${z}` : ''}`;
  }

  protected beginne(e: PointerEvent, x: number, y: number): void {
    const key = `${x},${y}`;
    this.modus = this.auswahl().has(key) ? 'aus' : 'an';
    this.setze(key);
    /* Sonst behält das Feld den Zeiger, und das Ziehen erreicht die Nachbarn nicht. */
    (e.target as Element | null)?.releasePointerCapture?.(e.pointerId);
  }

  protected ziehe(e: PointerEvent): void {
    if (!this.modus || typeof document === 'undefined') return;
    const key = document.elementFromPoint(e.clientX, e.clientY)?.getAttribute('data-zelle');
    if (key) this.setze(key);
  }

  private setze(key: string): void {
    const s = new Set(this.auswahl());
    if (this.modus === 'aus') s.delete(key);
    else s.add(key);
    this.auswahl.set(s);
  }

  protected kippe(key: string): void {
    const s = new Set(this.auswahl());
    if (s.has(key)) s.delete(key);
    else s.add(key);
    this.auswahl.set(s);
  }

  protected alle(): void {
    const s = new Set<string>();
    this.rows().forEach((r, y) => this.reihe(this.breite()).forEach((x) => s.add(`${x},${y}`)));
    this.auswahl.set(s);
  }

  protected waehleZone(z: CarryZone): void {
    this.auswahl.set(new Set(z.cells));
  }

  private gibAus(rows: string[], zones: CarryZone[]): void {
    this.aendern.emit({ rows, zones });
  }

  protected masse(w: number, h: number): void {
    const br = Math.min(MAX, Math.max(1, Math.trunc(w) || 1));
    const ho = Math.min(MAX, Math.max(1, Math.trunc(h) || 1));
    const rows = Array.from({ length: ho }, (_, y) => (this.rows()[y] ?? '').padEnd(br, '#').slice(0, br));
    const drin = (c: string) => {
      const [x, y] = c.split(',').map(Number);
      return x! < br && y! < ho;
    };
    this.auswahl.set(new Set([...this.auswahl()].filter(drin)));
    this.gibAus(rows, this.zones().map((z) => ({ ...z, cells: z.cells.filter(drin) })));
  }

  protected sperre(zu: boolean): void {
    const sel = this.auswahl();
    const rows = this.rows().map((r, y) =>
      r.padEnd(this.breite(), '.').split('').map((c, x) => (sel.has(`${x},${y}`) ? (zu ? '.' : '#') : c)).join(''),
    );
    /* Ein gesperrtes Feld liegt in keiner Zone. */
    const zones = zu ? this.zones().map((z) => ({ ...z, cells: z.cells.filter((c) => !sel.has(c)) })) : this.zones();
    this.gibAus(rows, zones);
  }

  /** Nur offene Felder kommen in eine Zone, und jedes nur in eine. */
  private auswahlOffen(): string[] {
    return [...this.auswahl()].filter((c) => {
      const [x, y] = c.split(',').map(Number);
      return this.offen(x!, y!);
    });
  }

  protected neueZone(): void {
    const zellen = this.auswahlOffen();
    if (!zellen.length) return;
    const ids = new Set(this.zones().map((z) => z.id));
    let n = this.zones().length + 1;
    while (ids.has(`z${n}`)) n++;
    const frei = this.zones().map((z) => ({ ...z, cells: z.cells.filter((c) => !zellen.includes(c)) }));
    this.gibAus(this.rows(), [...frei, { id: `z${n}`, draw: this.dauerNeu(), cells: zellen.sort() }]);
    this.auswahl.set(new Set());
    this.neueDauer.set('');
  }

  protected zoneAendern(i: number, teil: Partial<CarryZone>): void {
    this.gibAus(this.rows(), this.zones().map((z, j) => {
      if (j !== i) return z;
      const neu = { ...z, ...teil };
      if (!neu.label) delete neu.label;
      return neu;
    }));
  }

  protected gib(i: number): void {
    const zellen = this.auswahlOffen();
    this.gibAus(this.rows(), this.zones().map((z, j) =>
      j === i ? { ...z, cells: [...new Set([...z.cells, ...zellen])].sort() } : { ...z, cells: z.cells.filter((c) => !zellen.includes(c)) },
    ));
  }

  protected nimm(i: number): void {
    const sel = this.auswahl();
    this.gibAus(this.rows(), this.zones().map((z, j) => (j === i ? { ...z, cells: z.cells.filter((c) => !sel.has(c)) } : z)));
  }

  protected loesche(i: number): void {
    this.gibAus(this.rows(), this.zones().filter((_, j) => j !== i));
  }
}

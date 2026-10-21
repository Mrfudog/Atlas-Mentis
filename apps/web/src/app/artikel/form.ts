import { Component, computed, inject, input, signal } from '@angular/core';
import {
  INVENTORY_ZOOM_MAX,
  filled,
  inventoryFrame,
  inventoryImageOf,
  itemShape,
  shapeChiral,
  shapeRows,
  trimShape,
  type Entity,
  type InventoryFrame,
  type Shape,
} from '@nw/model';
import { Api, ApiError } from '../kern/api';
import { Bestand } from '../kern/bestand';
import { Session } from '../kern/session';
import { formBildStil, maskenStil } from '../kern/formbild';
import { BildWahl, bildAdresse } from './bild';

/** Das Malraster beginnt mit 5 × 5 und wächst am Rand bis hierhin. */
const START = 5;
const MAX = 20;

/** Ein Raster mit mindestens 5 × 5 Feldern, die Form oben links. */
function leinwand(rows: readonly string[]): string[][] {
  const w = Math.max(START, rows.reduce((m, r) => Math.max(m, r.length), 0));
  const h = Math.max(START, rows.length);
  return Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => (filled({ rows: [...rows], w, h }, x, y) ? '#' : '.')));
}

/** Zeilen aus der Liste: `#` oder `X` belegt, alles andere frei — wie im Vault. */
function ausListe(text: string): string[] {
  return text
    .split('\n')
    .map((z) => z.trim())
    .filter(Boolean)
    .map((z) => z.replace(/[^#.Xx0]/g, '').replace(/[Xx]/g, '#').replace(/0/g, '.'));
}

/**
 * **Die Form eines Gegenstands** (T-142, Element `shape`): die Felder, die
 * er im Kachelinventar belegt, mit seinem Bild darin, und seine
 * Stapelgrösse. Umschaltbar zwischen **Grid** (gemalt) und **List** (die
 * Zeilen, wie sie im Vault stehen); Drehen und Spiegeln nur als Vorschau
 * — wie ein Stück liegt, steht an der Kante im Inventar.
 *
 * Wer den Artikel schreibt, malt die Form („Edit shape": ein Raster von
 * 5 × 5, das am Rand wächst; gespeichert ohne leere Ränder, `trimShape`)
 * und passt das Inventarbild an („Adjust inventory image": ein eigenes Bild,
 * Ausschnitt, Zoom, Drehung, Einpassen oder Füllen), gespeichert am
 * Gegenstand — an der Fassung, wenn die Seite eine zeigt.
 */
@Component({
  selector: 'nw-form',
  imports: [BildWahl],
  template: `
    @if (karte(); as k) {
      <section class="form" aria-label="Shape">
        <div class="kopf">
          <h3>Shape</h3>
          <div class="umschalter" role="group" aria-label="Show as">
            <button type="button" class="klein" [class.an]="ansicht() === 'grid'" [attr.aria-pressed]="ansicht() === 'grid'" (click)="ansicht.set('grid')">Grid</button>
            <button type="button" class="klein" [class.an]="ansicht() === 'list'" [attr.aria-pressed]="ansicht() === 'list'" (click)="ansicht.set('list')">List</button>
          </div>
        </div>

        @if (!bearbeiten()) {
          @if (ansicht() === 'grid') {
            <div class="vorschau">
              <div class="raster" [style.--spalten]="gezeigt().w" [style.--zeilen]="gezeigt().h" role="img" [attr.aria-label]="beschreibung()">
                @for (z of zellen(gezeigt()); track z.key) {
                  <span class="feld" [class.voll]="z.voll"></span>
                }
                @if (bild(); as b) {
                  <div class="bildlage" [style]="masken(gezeigt())">
                    <div class="dreher" [style]="dreher()">
                      <img [src]="adresse(b.asset)" alt="" draggable="false" [style]="bildStil(b.frame)" />
                    </div>
                  </div>
                }
              </div>
              <div class="knoepfe">
                <button type="button" class="klein" (click)="drehen()" title="Preview only: how it lies turned">Rotate</button>
                @if (chiral()) {
                  <button type="button" class="klein" [class.an]="flip()" (click)="flip.set(!flip())" title="Preview only: how it lies mirrored">Mirror</button>
                }
              </div>
            </div>
          } @else {
            <pre class="zeilen" aria-label="Rows">{{ zeilenText() || '#' }}</pre>
          }
          <p class="masse">
            {{ form().w }} × {{ form().h }} · {{ belegt() }} {{ belegt() === 1 ? 'cell' : 'cells' }}
            @if (!eigeneForm()) { <span class="hinweis">(no shape set — one cell)</span> }
            · Stack size {{ k['stackSize'] ?? '—' }}
            @if (bild()?.own) { · own inventory image }
          </p>
          @if (darf()) {
            <div class="knoepfe">
              <button type="button" class="knopf" (click)="anfangen()">Edit shape</button>
              <button type="button" class="knopf" (click)="bildOeffnen()">Adjust inventory image</button>
            </div>
          }
        } @else {
          <!-- Malen: ein Klick kippt ein Feld, Ziehen malt weiter, was der erste Klick tat. -->
          @if (ansicht() === 'grid') {
            <div class="raster maler" [style.--spalten]="entwurf()[0]?.length ?? 0" [style.--zeilen]="entwurf().length" role="grid" aria-label="Paint the shape"
                 (pointermove)="ziehe($event)" (pointerup)="modus = null" (pointerleave)="modus = null" (pointercancel)="modus = null">
              @for (zeile of entwurf(); track $index; let y = $index) {
                @for (c of zeile; track $index; let x = $index) {
                  <button type="button" class="feld" [class.voll]="c === '#'" [attr.data-zelle]="x + ',' + y"
                          [attr.aria-pressed]="c === '#'" [attr.aria-label]="'Cell ' + (x + 1) + ', ' + (y + 1)"
                          (pointerdown)="beginne($event, x, y)" (keydown.enter)="male(x, y, c !== '#')" (keydown.space)="$event.preventDefault(); male(x, y, c !== '#')"></button>
                }
              }
              @if (bild(); as b) {
                <div class="bildlage unter" [style]="unterlage()">
                  <div class="dreher">
                    <img [src]="adresse(b.asset)" alt="" draggable="false" [style]="bildStil(b.frame, entwurfForm())" />
                  </div>
                </div>
              }
            </div>
            <p class="hinweis">Click or drag over cells. Painting the last row or column adds another; empty borders are cut off when you save.</p>
            <div class="knoepfe">
              <button type="button" class="klein" (click)="wachse(1, 0)" [disabled]="(entwurf()[0]?.length ?? 0) >= MAX">Add column</button>
              <button type="button" class="klein" (click)="wachse(0, 1)" [disabled]="entwurf().length >= MAX">Add row</button>
              <button type="button" class="klein" (click)="entwurf.set(leinwand([]))">Clear</button>
            </div>
          } @else {
            <label class="liste">Rows — # taken, . free (X and 0 work too)
              <textarea rows="6" [value]="listenText()" (input)="listeGetippt($any($event.target).value)" spellcheck="false"></textarea>
            </label>
          }
          <label class="stapel">Stack size
            <input type="number" min="1" step="1" inputmode="numeric" [value]="entwurfStapel()" (input)="entwurfStapel.set($any($event.target).value)" />
          </label>
          <div class="knoepfe">
            <button type="button" class="knopf haupt" (click)="speichern()" [disabled]="arbeitet()">Save</button>
            <button type="button" class="knopf" (click)="bearbeiten.set(false)" [disabled]="arbeitet()">Cancel</button>
          </div>
        }

        @if (bildOffen()) {
          <div class="dialog" role="group" aria-label="Adjust inventory image">
            @if (entwurfBild(); as id) {
              <div class="raster gross" [style.--spalten]="form().w" [style.--zeilen]="form().h"
                   (pointerdown)="greifen($event)" (pointermove)="schieben($event)" (pointerup)="loslassen($event)" (pointercancel)="loslassen($event)"
                   title="Drag to move the image in the shape">
                @for (z of zellen(form()); track z.key) {
                  <span class="feld" [class.voll]="z.voll"></span>
                }
                <div class="bildlage" [style]="masken(form())">
                  <div class="dreher">
                    <img [src]="adresse(id)" alt="" draggable="false" [style]="bildStil(entwurfRahmen())" />
                  </div>
                </div>
              </div>
            } @else {
              <p class="hinweis">No image yet — the item has none. Choose one below.</p>
            }
            <div class="regler">
              @if (entwurfBild()) {
                <fieldset class="zeile">
                  <legend>Fit</legend>
                  <label><input type="radio" name="fit" [checked]="entwurfRahmen().fit === 'contain'" (change)="rahmen({ fit: 'contain' })" /> Fit in the shape</label>
                  <label><input type="radio" name="fit" [checked]="entwurfRahmen().fit === 'cover'" (change)="rahmen({ fit: 'cover' })" /> Fill the shape</label>
                </fieldset>
                <label class="zeile">Zoom
                  <input type="range" min="0.25" [max]="ZOOM_MAX" step="0.05" [value]="entwurfRahmen().zoom" (input)="rahmen({ zoom: +$any($event.target).value })" />
                  <span>{{ entwurfRahmen().zoom.toFixed(2) }}×</span>
                </label>
                <div class="knoepfe">
                  <button type="button" class="klein" (click)="rahmen({ rot: entwurfRahmen().rot + 90 })">Turn image</button>
                  <button type="button" class="klein" (click)="rahmen({ x: 0, y: 0, zoom: 1 })">Centre</button>
                </div>
                <p class="hinweis">Drag the image to choose the part that shows.</p>
              }
              <details class="wechsel" [open]="!entwurfBild()">
                <summary>{{ eigenesBild() ? 'Change inventory image' : 'Choose an own inventory image' }}</summary>
                <nw-bildwahl [wert]="eigenesBild()" klasse="image" label="Inventory image" [fuer]="artikel().id" (wertChange)="eigenesBild.set($event)" />
              </details>
              @if (eigenesBild() && artikelBild()) {
                <button type="button" class="klein" (click)="eigenesBild.set('')">Use the item’s image</button>
              }
              <div class="knoepfe">
                <button type="button" class="knopf haupt" (click)="bildSpeichern()" [disabled]="arbeitet()">Save</button>
                <button type="button" class="knopf" (click)="bildOffen.set(false)" [disabled]="arbeitet()">Cancel</button>
              </div>
              <p class="hinweis">Saved on this item: every inventory shows it the same way, turned and mirrored with the piece.</p>
            </div>
          </div>
        }
        @if (fehler()) {
          <p class="fehler" role="alert">{{ fehler() }}</p>
        }
      </section>
    }
  `,
  styles: `
    :host { display: block; margin: 0.5rem 0; }
    .kopf { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
    .kopf h3 { margin: 0; font-family: var(--caps); font-weight: normal; font-size: 1rem; }
    .umschalter { display: inline-flex; gap: 0.25rem; }
    .an { background: var(--accent); color: var(--accent-ink); }
    .vorschau { display: flex; gap: 0.75rem; align-items: flex-start; flex-wrap: wrap; margin: 0.5rem 0; }
    .raster {
      --z: 2rem;
      position: relative;
      display: grid;
      grid-template-columns: repeat(var(--spalten), var(--z));
      grid-template-rows: repeat(var(--zeilen), var(--z));
      gap: 2px;
      width: max-content;
      max-width: 100%;
      touch-action: none;
    }
    .raster.gross { --z: min(3rem, calc((100vw - 4rem) / var(--spalten))); cursor: grab; }
    .raster.maler { --z: min(2.4rem, calc((100vw - 4rem) / var(--spalten))); }
    .feld { width: var(--z); height: var(--z); min-height: 0; padding: 0; border: 1px dashed var(--line); border-radius: 3px; background: transparent; }
    .feld.voll { border-style: solid; background: var(--surface); box-shadow: inset 0 0 0 1px var(--accent); }
    button.feld { cursor: pointer; }
    button.feld.voll { background: color-mix(in srgb, var(--accent) 35%, var(--surface)); }
    .bildlage { position: absolute; left: 0; top: 0; width: 100%; height: 100%; overflow: hidden; pointer-events: none; }
    .bildlage.unter { opacity: 0.55; }
    .dreher { position: absolute; inset: 0; }
    .dreher img { display: block; user-select: none; }
    .zeilen { font-family: var(--mono, monospace); letter-spacing: 0.3em; margin: 0.5rem 0; padding: 0.4rem 0.6rem; background: var(--surface); border-radius: 4px; width: max-content; max-width: 100%; overflow-x: auto; }
    .masse { margin: 0.25rem 0 0.5rem; color: var(--dim); }
    .hinweis { font-size: 0.85rem; color: var(--muted, var(--dim)); margin: 0.25rem 0 0.5rem; }
    .knoepfe { display: flex; gap: 0.5rem; flex-wrap: wrap; margin: 0.25rem 0; }
    .liste { display: flex; flex-direction: column; gap: 0.25rem; max-width: 20rem; }
    .liste textarea { font-family: var(--mono, monospace); letter-spacing: 0.3em; }
    .stapel { display: inline-flex; align-items: center; gap: 0.5rem; margin: 0.5rem 0; }
    .stapel input { width: 5rem; min-height: 32px; }
    .dialog { display: flex; gap: 1rem; flex-wrap: wrap; align-items: flex-start; margin-top: 0.75rem; padding: 0.75rem; border: 1px solid var(--line); border-radius: 6px; background: var(--surface); }
    .regler { flex: 1 1 14rem; min-width: 0; }
    .zeile { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin: 0 0 0.5rem; border: 0; padding: 0; }
    .zeile input[type='range'] { flex: 1; min-width: 0; }
    .wechsel { margin: 0.5rem 0; }
    .wechsel summary { cursor: pointer; }
    .fehler { color: var(--warn, var(--accent)); }
  `,
})
export class Form {
  readonly artikel = input.required<Entity>();
  private readonly bestand = inject(Bestand);
  private readonly api = inject(Api);
  private readonly session = inject(Session);

  protected readonly MAX = MAX;
  protected readonly ZOOM_MAX = INVENTORY_ZOOM_MAX;
  protected readonly leinwand = leinwand;

  protected readonly karte = computed(() => (this.artikel().components?.['Item'] as Record<string, unknown> | undefined) ?? null);
  protected readonly darf = computed(() => this.session.darfSchreiben()(this.artikel().id));
  protected readonly eigeneForm = computed(() => shapeRows(this.karte()?.['rows']).length > 0);
  /** Die Form, wie gespeichert; ohne Angabe ein Feld (`itemShape`). */
  protected readonly form = computed<Shape>(() => itemShape(this.karte()?.['rows']));
  protected readonly belegt = computed(() => this.zellen(this.form()).filter((z) => z.voll).length);
  protected readonly chiral = computed(() => shapeChiral(this.form().rows));
  protected readonly bild = computed(() => inventoryImageOf(this.artikel()));
  protected readonly artikelBild = computed(() => {
    const b = this.artikel().components?.['Image']?.['image'];
    return typeof b === 'string' ? b : '';
  });

  protected readonly ansicht = signal<'grid' | 'list'>('grid');
  protected readonly rot = signal(0);
  protected readonly flip = signal(false);
  /** Die Vorschau: gespiegelt, dann gedreht — wie `itemShape` im Inventar. */
  protected readonly gezeigt = computed(() => itemShape(this.form().rows, this.rot(), this.flip()));
  protected readonly zeilenText = computed(() => shapeRows(this.karte()?.['rows']).join('\n'));
  protected readonly beschreibung = computed(() => `Shape, ${this.gezeigt().w} by ${this.gezeigt().h}`);

  protected readonly bearbeiten = signal(false);
  protected readonly entwurf = signal<string[][]>(leinwand([]));
  protected readonly entwurfForm = computed<Shape>(() => {
    const rows = trimShape(this.entwurf().map((r) => r.join('')));
    return itemShape(rows);
  });
  protected readonly listenText = signal('');
  protected readonly entwurfStapel = signal<string>('');
  protected readonly arbeitet = signal(false);
  protected readonly fehler = signal<string | null>(null);
  protected modus: 'an' | 'aus' | null = null;

  protected readonly bildOffen = signal(false);
  protected readonly eigenesBild = signal('');
  protected readonly entwurfRahmen = signal<InventoryFrame>(inventoryFrame(null));
  protected readonly entwurfBild = computed(() => this.eigenesBild() || this.artikelBild());
  private griff: { x: number; y: number; frame: InventoryFrame; w: number; h: number } | null = null;

  protected zellen(f: Shape): { key: string; voll: boolean }[] {
    const out: { key: string; voll: boolean }[] = [];
    for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) out.push({ key: `${x},${y}`, voll: filled(f, x, y) });
    return out;
  }
  protected adresse(id: string): string | null {
    return bildAdresse(id, 'full');
  }
  protected masken(f: Shape): Record<string, string> {
    return maskenStil(f);
  }
  /** Das Bild unter dem Malraster: dort, wo die gemalte Form liegt, in ihrer Grösse. */
  protected unterlage(): Record<string, string> {
    const netz = this.entwurf();
    let x0 = Infinity;
    let y0 = Infinity;
    netz.forEach((r, y) => r.forEach((c, x) => {
      if (c !== '#') return;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
    }));
    if (!Number.isFinite(x0)) return { display: 'none' };
    const f = this.entwurfForm();
    const px = (n: number, z: number) => `calc(${n} * var(--z) + ${Math.max(0, z) * 2}px)`;
    return { left: px(x0, x0), top: px(y0, y0), width: px(f.w, f.w - 1), height: px(f.h, f.h - 1), ...maskenStil(f) };
  }
  /** Das Bild liegt in der ungedrehten Form; gedreht und gespiegelt wird der Kasten, wie im Inventar. */
  protected bildStil(frame: InventoryFrame, f: Shape = this.form()): Record<string, string> {
    return formBildStil(frame, f.w, f.h);
  }
  protected dreher(): Record<string, string> {
    const f = this.form();
    const quer = this.rot() === 90 || this.rot() === 270;
    const g = this.gezeigt();
    /* Der Kasten hat die Masse der ungedrehten Form, in Prozent des gedrehten. */
    const w = quer ? (f.w / g.w) * 100 : 100;
    const h = quer ? (f.h / g.h) * 100 : 100;
    return {
      left: '50%',
      top: '50%',
      width: `${w}%`,
      height: `${h}%`,
      inset: 'auto',
      transform: `translate(-50%, -50%) rotate(${this.rot()}deg) scaleX(${this.flip() ? -1 : 1})`,
    };
  }

  protected drehen(): void {
    this.rot.set((this.rot() + 90) % 360);
  }

  // ------------------------------------------------------------ Malen

  protected anfangen(): void {
    const rows = shapeRows(this.karte()?.['rows']);
    this.entwurf.set(leinwand(rows));
    this.listenText.set(rows.join('\n'));
    const s = this.karte()?.['stackSize'];
    this.entwurfStapel.set(typeof s === 'number' ? String(s) : '');
    this.fehler.set(null);
    this.bildOffen.set(false);
    this.bearbeiten.set(true);
  }

  protected beginne(ev: PointerEvent, x: number, y: number): void {
    ev.preventDefault();
    (ev.currentTarget as HTMLElement).releasePointerCapture?.(ev.pointerId);
    this.modus = this.entwurf()[y]?.[x] === '#' ? 'aus' : 'an';
    this.male(x, y, this.modus === 'an');
  }
  protected ziehe(ev: PointerEvent): void {
    if (!this.modus) return;
    const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
    const z = el?.getAttribute?.('data-zelle');
    if (!z) return;
    const [x, y] = z.split(',').map(Number) as [number, number];
    if ((this.entwurf()[y]?.[x] === '#') !== (this.modus === 'an')) this.male(x, y, this.modus === 'an');
  }
  /** Ein Feld setzen; wer den letzten Rand bemalt, bekommt eine Zeile oder Spalte dazu. */
  protected male(x: number, y: number, an: boolean): void {
    const netz = this.entwurf().map((r) => [...r]);
    if (!netz[y] || netz[y]![x] === undefined) return;
    netz[y]![x] = an ? '#' : '.';
    const w = netz[0]!.length;
    if (an && x === w - 1 && w < MAX) for (const r of netz) r.push('.');
    if (an && y === netz.length - 1 && netz.length < MAX) netz.push(Array.from({ length: netz[0]!.length }, () => '.'));
    this.entwurf.set(netz);
    this.listenText.set(trimShape(netz.map((r) => r.join(''))).join('\n'));
  }
  protected wachse(dx: number, dy: number): void {
    const netz = this.entwurf().map((r) => [...r]);
    if (dx) for (const r of netz) r.push('.');
    if (dy) netz.push(Array.from({ length: netz[0]?.length ?? START }, () => '.'));
    this.entwurf.set(netz);
  }
  protected listeGetippt(text: string): void {
    this.listenText.set(text);
    this.entwurf.set(leinwand(ausListe(text)));
  }

  protected async speichern(): Promise<void> {
    const rows = trimShape(this.entwurf().map((r) => r.join('')));
    const roh = String(this.entwurfStapel()).trim();
    const stapel = roh === '' ? undefined : Math.trunc(Number(roh));
    if (stapel !== undefined && !(stapel >= 1)) {
      this.fehler.set('Stack size is a whole number of at least 1, or empty.');
      return;
    }
    await this.schreibe((item) => {
      if (rows.length) item['rows'] = rows;
      else delete item['rows'];
      if (stapel !== undefined) item['stackSize'] = stapel;
      else delete item['stackSize'];
    });
    if (!this.fehler()) this.bearbeiten.set(false);
  }

  // ------------------------------------------------------------ Inventarbild

  protected bildOeffnen(): void {
    const k = this.karte() ?? {};
    this.eigenesBild.set(typeof k['inventoryImage'] === 'string' ? (k['inventoryImage'] as string) : '');
    this.entwurfRahmen.set(inventoryFrame(k['inventoryFrame']));
    this.fehler.set(null);
    this.bearbeiten.set(false);
    this.bildOffen.set(true);
  }
  protected rahmen(teil: Partial<InventoryFrame>): void {
    this.entwurfRahmen.set(inventoryFrame({ ...this.entwurfRahmen(), ...teil }));
  }
  /* Ziehen verschiebt das Bild: ein Pixel ist so viel Prozent, wie ein Pixel vom Bildkasten ist. */
  protected greifen(ev: PointerEvent): void {
    const el = ev.currentTarget as HTMLElement;
    el.setPointerCapture?.(ev.pointerId);
    const box = el.getBoundingClientRect();
    this.griff = { x: ev.clientX, y: ev.clientY, frame: this.entwurfRahmen(), w: box.width || 1, h: box.height || 1 };
  }
  protected schieben(ev: PointerEvent): void {
    const g = this.griff;
    if (!g) return;
    const quer = g.frame.rot === 90 || g.frame.rot === 270;
    const dx = ((ev.clientX - g.x) / (quer ? g.h : g.w)) * 100;
    const dy = ((ev.clientY - g.y) / (quer ? g.w : g.h)) * 100;
    this.entwurfRahmen.set(inventoryFrame({ ...g.frame, x: g.frame.x + dx, y: g.frame.y + dy }));
  }
  protected loslassen(ev: PointerEvent): void {
    (ev.currentTarget as HTMLElement).releasePointerCapture?.(ev.pointerId);
    this.griff = null;
  }
  protected async bildSpeichern(): Promise<void> {
    const eigen = this.eigenesBild();
    const r = this.entwurfRahmen();
    await this.schreibe((item) => {
      if (eigen) item['inventoryImage'] = eigen;
      else delete item['inventoryImage'];
      item['inventoryFrame'] = { ...r };
    });
    if (!this.fehler()) this.bildOffen.set(false);
  }

  /** Geschrieben wird die Karte `Item` des ganzen Artikels, wie er gerade ist. */
  private async schreibe(aendern: (item: Record<string, unknown>) => void): Promise<void> {
    const id = this.artikel().id;
    this.arbeitet.set(true);
    this.fehler.set(null);
    try {
      await this.bestand.oeffnen(id, true, false);
      const e = this.bestand.voll().get(id) ?? this.artikel();
      const item = { ...((e.components?.['Item'] ?? {}) as Record<string, unknown>) };
      aendern(item);
      const { refs: _r, ...rein } = e as Entity & { refs?: unknown };
      await this.api.putEntity({ ...rein, components: { ...rein.components, Item: item } });
      await this.bestand.oeffnen(id, true);
    } catch (error) {
      this.fehler.set(error instanceof ApiError ? error.message : error instanceof Error ? error.message : 'Could not save.');
    } finally {
      this.arbeitet.set(false);
    }
  }
}

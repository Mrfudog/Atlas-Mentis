import { Component, computed, input, output, signal } from '@angular/core';
import { TIME_WINDOWS } from '@nw/model';
import type { Feldfilter } from '../kern/filter';

/** Die Facetten von T-382 in `f=`: dieselbe Form wie jede andere Wahl. */
export const ZEIT_REFS = { added: '@added', changed: '@changed', by: '@by' } as const;

/** Die Sortierungen, die zu „wann" gehören. */
const SORTEN = [
  { value: '', label: 'Name' },
  { value: '-created', label: 'Newest added first' },
  { value: 'created', label: 'Oldest added first' },
  { value: '-updated', label: 'Recently changed first' },
] as const;

/** Ein Zeitraum aus zwei Daten: `von..bis`, eine Seite darf fehlen. */
export function zeitraum(von: string, bis: string): string | null {
  const v = von.trim();
  const b = bis.trim();
  return v || b ? `${v}..${b}` : null;
}

/** Zurück in die beiden Daten — `null`, wenn es kein Zeitraum ist. */
export function zeitraumTeile(wert: string | undefined): { von: string; bis: string } | null {
  const m = /^(\d{4}-\d{2}-\d{2})?\.\.(\d{4}-\d{2}-\d{2})?$/.exec(wert ?? '');
  return m ? { von: m[1] ?? '', bis: m[2] ?? '' } : null;
}

/**
 * **Wann und von wem** (T-382): „Added", „Changed" und „Added by" in der
 * Seitenleiste einer Übersicht, dazu die Sortierung danach. Die Wahl steht
 * als Facette in `f=` (`@added:7d`, `@by:<konto>`) — darum gilt sie in der
 * Adresse und in Filtergruppen wie jede andere; gerechnet wird am Server.
 */
@Component({
  selector: 'nw-zeitfilter',
  template: `
    <details class="facette" data-bereich [open]="gemerkt() ?? offen()" (toggle)="klappe($any($event.target).open)">
      <summary class="leg">
        When &amp; who
        @if (gewaehlt()) {
          <span class="gewaehlt">{{ gewaehlt() }}</span>
        }
      </summary>
      @for (z of zeilen; track z.ref) {
        <label class="zeitwahl">
          <span>{{ z.label }}</span>
          <select [attr.aria-label]="z.label" (change)="fenster(z.ref, $any($event.target).value)">
            <option value="" [selected]="!wert(z.ref)">Any time</option>
            @for (w of FENSTER; track w.value) {
              <option [value]="w.value" [selected]="wert(z.ref) === w.value">{{ w.label }}</option>
            }
            <option value="custom" [selected]="eigen(z.ref)">Between dates…</option>
          </select>
        </label>
        @if (eigen(z.ref)) {
          <div class="spanne">
            <input type="date" [attr.aria-label]="z.label + ' from'" [value]="teile(z.ref).von"
                   (change)="datum(z.ref, 'von', $any($event.target).value)" />
            <span aria-hidden="true">–</span>
            <input type="date" [attr.aria-label]="z.label + ' to'" [value]="teile(z.ref).bis"
                   (change)="datum(z.ref, 'bis', $any($event.target).value)" />
          </div>
        }
      }
      @if (autoren().length) {
        <span class="leg klein">Added by</span>
        @for (a of autoren(); track a.id) {
          <label class="haken">
            <input type="checkbox" [checked]="autorAn(a.id)" (change)="autorUmschalten(a.id)" />
            <span class="wert">{{ a.name }}</span>
            <span class="zahl">{{ a.count }}</span>
          </label>
        }
      }
      <label class="zeitwahl">
        <span>Sort</span>
        <select aria-label="Sort by" (change)="sortieren.emit($any($event.target).value)">
          @for (s of SORTEN; track s.value) {
            <option [value]="s.value" [selected]="sortierung() === s.value">{{ s.label }}</option>
          }
          @if (fremdeSortierung()) {
            <option value="" disabled selected>By column</option>
          }
        </select>
      </label>
    </details>
  `,
  styles: `
    .zeitwahl { display: grid; grid-template-columns: 5.5rem 1fr; gap: 0.4rem; align-items: center; margin: 0.25rem 0; font-size: 0.9rem; }
    .zeitwahl select { min-height: 32px; min-width: 0; }
    .spanne { display: flex; gap: 0.3rem; align-items: center; margin: 0.2rem 0 0.4rem; }
    .spanne input { min-width: 0; flex: 1; }
    .klein { display: block; margin-top: 0.5rem; }
  `,
})
export class Zeitfilter {
  readonly felder = input.required<Readonly<Record<string, Feldfilter>>>();
  readonly autoren = input<{ id: string; name: string; count: number }[]>([]);
  readonly sortierung = input('');
  /** Eine Facette setzen (`null` nimmt sie weg). */
  readonly setzen = output<{ ref: string; values: string[] | null }>();
  readonly sortieren = output<string>();

  protected readonly FENSTER = TIME_WINDOWS;
  protected readonly SORTEN = SORTEN;
  protected readonly zeilen = [
    { ref: ZEIT_REFS.added, label: 'Added' },
    { ref: ZEIT_REFS.changed, label: 'Changed' },
  ];
  /** „Between dates…" gewählt, aber noch kein Datum — dann stehen die Felder schon. */
  private readonly offeneSpanne = signal<ReadonlySet<string>>(new Set());
  protected readonly offen = signal(false);
  /** Der am Konto gemerkte Stand dieser Facette (T-441); ohne ihn gilt `offen`. */
  readonly gemerkt = input<boolean | undefined>(undefined);
  /** Jemand hat sie auf- oder zugeklappt — die Seite merkt es sich. */
  readonly geklappt = output<boolean>();

  protected readonly gewaehlt = computed(() => Object.values(ZEIT_REFS).filter((r) => this.felder()[r]?.values?.length).length);
  protected readonly fremdeSortierung = computed(() => {
    const s = this.sortierung();
    return !!s && !SORTEN.some((x) => x.value === s);
  });

  constructor() {
    /* Offen, wenn schon etwas gewählt ist — ein geteilter Link zeigt, was gilt. */
    queueMicrotask(() => {
      if (this.gewaehlt()) this.offen.set(true);
    });
  }
  protected klappe(auf: boolean): void {
    if (auf === (this.gemerkt() ?? this.offen())) return;
    this.offen.set(auf);
    this.geklappt.emit(auf);
  }


  protected wert(ref: string): string {
    return this.felder()[ref]?.values?.[0] ?? '';
  }
  protected eigen(ref: string): boolean {
    return this.offeneSpanne().has(ref) || !!zeitraumTeile(this.wert(ref));
  }
  protected teile(ref: string): { von: string; bis: string } {
    return zeitraumTeile(this.wert(ref)) ?? { von: '', bis: '' };
  }

  protected fenster(ref: string, wert: string): void {
    const offen = new Set(this.offeneSpanne());
    if (wert === 'custom') {
      offen.add(ref);
      this.offeneSpanne.set(offen);
      return;
    }
    offen.delete(ref);
    this.offeneSpanne.set(offen);
    this.setzen.emit({ ref, values: wert ? [wert] : null });
  }

  protected datum(ref: string, seite: 'von' | 'bis', wert: string): void {
    const t = { ...this.teile(ref), [seite]: wert };
    const r = zeitraum(t.von, t.bis);
    this.setzen.emit({ ref, values: r ? [r] : null });
  }

  protected autorAn(id: string): boolean {
    return (this.felder()[ZEIT_REFS.by]?.values ?? []).includes(id);
  }
  protected autorUmschalten(id: string): void {
    const jetzt = this.felder()[ZEIT_REFS.by]?.values ?? [];
    const neu = jetzt.includes(id) ? jetzt.filter((x) => x !== id) : [...jetzt, id];
    this.setzen.emit({ ref: ZEIT_REFS.by, values: neu.length ? neu : null });
  }
}

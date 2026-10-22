import { Component, computed, input, output, signal } from '@angular/core';
import { HAS_REF, hasTermText, isHasEdge, parseHasTerm, type HasTerm } from '@nw/model';
import type { Feldfilter } from '../kern/filter';

/** Eine Wahl, wie der Server sie zählt (`facets.has`). */
export interface HasWahl {
  ref: string;
  label: string;
  kind: 'edge' | 'field';
  count: number;
}

/** Was man mit einer Wahl tun kann. „Zu einem Artikel" wählt man an der gesetzten Bedingung. */
export type HasArt = 'has' | 'not' | 'min' | 'max';

/** Eine neue Bedingung aus der Leiste — `null`, wenn die Zahl fehlt. */
export function neueBedingung(ref: string, art: HasArt, n?: number): HasTerm | null {
  if (!ref) return null;
  if (art === 'has') return { ref, not: false };
  if (art === 'not') return { ref, not: true };
  if (!isHasEdge(ref) || n === undefined || !Number.isInteger(n) || n < 0) return null;
  return art === 'min' ? { ref, not: false, min: n } : { ref, not: false, max: n };
}

/** Wie eine Bedingung in der Leiste heisst. */
export function bedingungText(t: HasTerm, label: string, ziel?: string): string {
  if (t.min !== undefined) return `At least ${t.min} × ${label}`;
  if (t.max !== undefined) return `At most ${t.max} × ${label}`;
  if (t.to !== undefined) return `${t.not ? 'Not ' : ''}${label}: ${ziel ?? 'unknown'}`;
  return `${t.not ? 'Has no' : 'Has'} ${label}`;
}

/**
 * **Nach Beziehungen filtern** (T-389, REQ-395): „hat Kante X", „hat
 * keine", „zu diesem Artikel", „mindestens / höchstens n" und „hat Feld"
 * (die Rasterform eines Gegenstands). Die Wahl steht als Facette `@has`
 * in `f=` — so gilt sie in der Adresse und in Filtergruppen wie jede
 * andere; gerechnet und gesiebt wird am Server.
 */
@Component({
  selector: 'nw-beziehungsfilter',
  template: `
    <details class="facette" [open]="offen()" (toggle)="offen.set($any($event.target).open)">
      <summary class="leg">
        Relations
        @if (bedingungen().length) {
          <span class="gewaehlt">{{ bedingungen().length }}</span>
        }
      </summary>
      @for (b of bedingungen(); track b.text) {
        <div class="bedingung">
          <span class="was">{{ b.titel }}</span>
          <button type="button" class="weg" [attr.aria-label]="'Remove ' + b.titel" (click)="entfernen(b.text)">×</button>
          @if (b.zielwahl) {
            <select class="ziel" [attr.aria-label]="'Target of ' + b.label" (change)="zielSetzen(b.text, $any($event.target).value)">
              <option value="" [selected]="!b.term.to">Any article</option>
              @for (z of zieleVon(b.term.ref); track z.id) {
                <option [value]="z.id" [selected]="b.term.to === z.id">{{ z.name }} ({{ z.count }})</option>
              }
            </select>
          }
        </div>
      }
      @if (wahlen().length) {
        <div class="neu">
          <select aria-label="Relation or field" (change)="ref.set($any($event.target).value)">
            <option value="" [selected]="!ref()">Relation or field…</option>
            @if (kanten().length) {
              <optgroup label="Relations">
                @for (w of kanten(); track w.ref) {
                  <option [value]="w.ref" [selected]="ref() === w.ref">{{ w.label }} ({{ w.count }})</option>
                }
              </optgroup>
            }
            @if (felder().length) {
              <optgroup label="Fields">
                @for (w of felder(); track w.ref) {
                  <option [value]="w.ref" [selected]="ref() === w.ref">{{ w.label }} ({{ w.count }})</option>
                }
              </optgroup>
            }
          </select>
          <div class="zeile">
            <select aria-label="Condition" (change)="art.set($any($event.target).value)">
              <option value="has" [selected]="art() === 'has'">has</option>
              <option value="not" [selected]="art() === 'not'">has none</option>
              @if (istKante()) {
                <option value="min" [selected]="art() === 'min'">at least</option>
                <option value="max" [selected]="art() === 'max'">at most</option>
              }
            </select>
            @if (istKante() && (art() === 'min' || art() === 'max')) {
              <input type="number" min="0" step="1" aria-label="How many" [value]="anzahl()" (input)="anzahl.set($any($event.target).valueAsNumber)" />
            }
            <button type="button" [disabled]="!bereit()" (click)="hinzufuegen()">Add</button>
          </div>
        </div>
      } @else if (!bedingungen().length) {
        <p class="leer">Choose a type to filter by its fields; relations appear once the list has some.</p>
      }
    </details>
  `,
  styles: `
    .bedingung { display: grid; grid-template-columns: 1fr auto; gap: 0.25rem; align-items: center; margin: 0.25rem 0; font-size: 0.9rem; }
    .bedingung .ziel { grid-column: 1 / -1; min-height: 32px; min-width: 0; }
    .weg { min-width: 32px; min-height: 32px; }
    .neu { display: grid; gap: 0.3rem; margin-top: 0.4rem; }
    .neu select, .neu input, .neu button { min-height: 32px; min-width: 0; }
    .zeile { display: flex; gap: 0.3rem; }
    .zeile select { flex: 1; }
    .zeile input { width: 4.5rem; }
    .leer { font-size: 0.85rem; opacity: 0.8; margin: 0.3rem 0; }
  `,
})
export class Beziehungsfilter {
  readonly felderwahl = input.required<Readonly<Record<string, Feldfilter>>>({ alias: 'felder' });
  readonly wahlen = input<HasWahl[]>([]);
  readonly ziele = input<Record<string, { id: string; name: string; count: number }[]>>({});
  /** Die Facette setzen (`null` nimmt sie weg). */
  readonly setzen = output<{ ref: string; values: string[] | null }>();

  protected readonly offen = signal(false);
  protected readonly ref = signal('');
  protected readonly art = signal<HasArt>('has');
  protected readonly anzahl = signal(1);

  private readonly werte = computed(() => this.felderwahl()[HAS_REF]?.values ?? []);
  protected readonly kanten = computed(() => this.wahlen().filter((w) => w.kind === 'edge'));
  protected readonly felder = computed(() => this.wahlen().filter((w) => w.kind === 'field'));
  protected readonly istKante = computed(() => isHasEdge(this.ref()));
  protected readonly bereit = computed(() => !!neueBedingung(this.ref(), this.art(), this.anzahl()));

  protected readonly bedingungen = computed(() => {
    const namen = new Map(this.wahlen().map((w) => [w.ref, w.label]));
    return this.werte().flatMap((text) => {
      const term = parseHasTerm(text);
      if (!term) return [];
      const label = namen.get(term.ref) ?? term.ref;
      const ziel = term.to !== undefined ? this.ziele()[term.ref]?.find((z) => z.id === term.to)?.name : undefined;
      /* Ein Ziel wählt man an „hat" und an „zu …", nicht an einer Zahl. */
      const zielwahl = isHasEdge(term.ref) && !term.not && term.min === undefined && term.max === undefined;
      return [{ text, term, label, titel: bedingungText(term, label, ziel), zielwahl }];
    });
  });

  constructor() {
    /* Offen, wenn schon etwas gewählt ist — ein geteilter Link zeigt, was gilt. */
    queueMicrotask(() => {
      if (this.werte().length) this.offen.set(true);
    });
  }

  protected zieleVon(ref: string): { id: string; name: string; count: number }[] {
    return this.ziele()[ref] ?? [];
  }

  protected hinzufuegen(): void {
    const t = neueBedingung(this.ref(), this.art(), this.anzahl());
    if (!t) return;
    const text = hasTermText(t);
    if (!this.werte().includes(text)) this.schreiben([...this.werte(), text]);
    this.ref.set('');
    this.art.set('has');
  }

  protected entfernen(text: string): void {
    this.schreiben(this.werte().filter((w) => w !== text));
  }

  protected zielSetzen(text: string, id: string): void {
    const t = parseHasTerm(text);
    if (!t) return;
    const neu = hasTermText(id ? { ref: t.ref, not: false, to: id } : { ref: t.ref, not: false });
    this.schreiben(this.werte().map((w) => (w === text ? neu : w)));
  }

  private schreiben(werte: string[]): void {
    this.setzen.emit({ ref: HAS_REF, values: werte.length ? werte : null });
  }
}

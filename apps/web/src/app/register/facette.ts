import { Component, computed, input, output } from '@angular/core';
import type { FacetHint } from '@nw/model';

/**
 * **Was ein Feld oder eine Kante zur Facette sagt** (T-174, T-180, T-212):
 * ob es in der Seitenleiste einer Liste filtert, unter welchem Namen, an
 * welcher Stelle — und, nur an einem Feld, ob es auf eine besondere Weise
 * gelesen wird (`as`: Wirkungen, Voraussetzung). Ohne Angabe leitet
 * `facetsFor` die Facette aus der Form ab; eine leere Angabe wird darum
 * weggelassen und nicht als `{}` gespeichert.
 */
@Component({
  selector: 'nw-reg-facette',
  template: `
    <label class="f">
      <span>In list filters</span>
      <select [disabled]="!darf()" (change)="artSetzen($any($event.target).value)">
        <option value="" [selected]="hint() !== false">{{ feld() ? 'by its kind (derived)' : 'both directions' }}</option>
        <option value="off" [selected]="hint() === false">not a filter</option>
      </select>
    </label>
    @if (hint() !== false) {
      <label class="f">
        <span>Filter label</span>
        <input type="text" [value]="angabe().label ?? ''" [disabled]="!darf()" placeholder="the field’s title"
          (change)="teil({ label: wert($event) || undefined })" />
      </label>
      <label class="f">
        <span>Filter order</span>
        <input type="number" step="1" [value]="angabe().order ?? ''" [disabled]="!darf()" placeholder="after the others"
          (change)="teil({ order: zahl($event) })" />
      </label>
      @if (feld()) {
        <label class="f">
          <span>Read as</span>
          <select [disabled]="!darf()" (change)="teil({ as: $any($event.target).value || undefined })">
            <option value="" [selected]="!angabe().as">its value</option>
            <option value="effect" [selected]="angabe().as === 'effect'">effects (target and kind)</option>
            <option value="requirement" [selected]="angabe().as === 'requirement'">a prerequisite (usable by)</option>
          </select>
        </label>
      }
    }
    <p class="hint">
      @if (feld()) {
        Lists filter by fields with a shape: a list becomes checkboxes, a number a range, a link an article choice.
        <b>Not a filter</b> takes it out; a <b>label</b> renames it and an <b>order</b> moves it to the front (0 first).
        <b>Effects</b> filters by what the effects grant; <b>a prerequisite</b> reads a sentence like “level 4, STR 13”
        and lets the list keep only what a chosen character meets.
      } @else {
        The edge filters lists at both ends — “grants” at the start, the backwards label at the target. <b>Not a
        filter</b> takes it out; a <b>label</b> renames it at both ends and an <b>order</b> moves it to the front (0 first).
      }
    </p>
  `,
})
export class RegFacette {
  readonly hint = input<FacetHint | undefined>(undefined);
  readonly darf = input(false);
  /** Ein Feld (mit `as`) oder eine Kante. */
  readonly feld = input(true);
  readonly aendern = output<FacetHint | undefined>();

  protected readonly angabe = computed(() => {
    const h = this.hint();
    return h && typeof h === 'object' ? h : {};
  });

  protected wert(ev: Event): string {
    return String((ev.target as HTMLInputElement).value ?? '').trim();
  }
  protected zahl(ev: Event): number | undefined {
    const t = this.wert(ev);
    const n = Number(t);
    return t && Number.isFinite(n) ? n : undefined;
  }

  protected artSetzen(v: string): void {
    this.aendern.emit(v === 'off' ? false : undefined);
  }

  protected teil(t: { label?: string | undefined; order?: number | undefined; as?: 'effect' | 'requirement' | undefined }): void {
    this.aendern.emit(facetHintWith(this.hint(), t));
  }
}

/** Eine Angabe mit geänderten Teilen; ohne einen Teil keine Angabe. */
export function facetHintWith(
  alt: FacetHint | undefined,
  t: { label?: string | undefined; order?: number | undefined; as?: 'effect' | 'requirement' | undefined },
): FacetHint | undefined {
  const neu: Record<string, unknown> = { ...(alt && typeof alt === 'object' ? alt : {}) };
  for (const [k, v] of Object.entries(t)) {
    if (v === undefined || v === '') delete neu[k];
    else neu[k] = v;
  }
  return Object.keys(neu).length ? (neu as FacetHint) : undefined;
}

import { Component, computed, inject, input } from '@angular/core';
import { bodyOf, spellBook } from '@nw/model';
import type { Entity, SpellBook, VarScopes } from '@nw/model';
import { Bestand } from '../kern/bestand';
import { Text } from './text';

/**
 * **Der Zauber wie im Spielerhandbuch** (W2): Grad und Schule kursiv unter
 * dem Namen, „Casting Time, Range, Components, Duration" als Kopfzeilen,
 * der Text, „At Higher Levels". Die Reichweite steht als Mass in der
 * Einheit der Einstellung (`units`), nie als nackte Zahl.
 *
 * Das Element zeichnet auch den Haupttext (Beschreibung und Absätze), weil
 * „At Higher Levels" hinter ihm steht; die Anordnung am Typ `Spell` nimmt
 * ihn darum aus der Prosa heraus.
 */
@Component({
  selector: 'nw-zauber',
  imports: [Text],
  template: `
    @if (buch(); as b) {
      @if (b.byline) {
        <p class="byline">{{ b.byline }}</p>
      }
      <div class="linie" aria-hidden="true"></div>
      @if (b.lines.length) {
        <div class="zeilen">
          @for (z of b.lines; track z.label) {
            <p><strong>{{ z.label }}:</strong> <nw-text inline [text]="z.text" /></p>
          }
        </div>
      }
      @if (text(); as t) {
        <nw-text class="text" [text]="t" [scopes]="scopes()" />
      }
      @if (b.higherLevels) {
        <nw-text class="text" [text]="b.higherLevels" [scopes]="scopes()" vorspann="At Higher Levels." />
      }
      @if (b.extra.length) {
        <div class="zeilen zusatz">
          @for (z of b.extra; track z.label) {
            <p><strong>{{ z.label }}</strong> <nw-text inline [text]="z.text" /></p>
          }
        </div>
      }
    }
  `,
  styleUrl: './buch.scss',
})
export class Zauber {
  readonly artikel = input.required<Entity>();
  readonly scopes = input<VarScopes>({});

  private readonly bestand = inject(Bestand);

  protected readonly buch = computed<SpellBook | null>(() => {
    const r = this.bestand.registry();
    if (!r) return null;
    const name = this.bestand.name();
    /* Die Namen der Kantenziele bringt der Artikel mit (`refs`, W7). */
    return spellBook(r, this.artikel(), (id) => name(id));
  });

  protected readonly text = computed(() => bodyOf(this.artikel()));
}

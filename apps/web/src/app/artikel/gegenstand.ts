import { Component, computed, effect, inject, input, untracked } from '@angular/core';
import { itemBook, primaryInterface } from '@nw/model';
import type { Entity, ItemBook } from '@nw/model';
import { Bestand } from '../kern/bestand';
import { Text } from './text';

/**
 * **Der Gegenstand wie im Spielleiterhandbuch** (W2): Art, Seltenheit und
 * Einstimmung kursiv unter dem Namen; Rüstungsklasse, Schaden, Ladungen,
 * Preis und Gewicht als Kopfzeilen, das Gewicht in der Einheit der
 * Einstellung. Waffe, Rüstung und Material erben die Anordnung von `Item`.
 */
@Component({
  selector: 'nw-gegenstand',
  imports: [Text],
  template: `
    @if (buch(); as b) {
      @if (b.byline) {
        <p class="byline">{{ b.byline }}</p>
      }
      <div class="linie" aria-hidden="true"></div>
      @if (b.lines.length || b.extra.length) {
        <div class="zeilen">
          @for (z of b.lines; track z.label) {
            <p><strong>{{ z.label }}</strong> <nw-text inline [text]="z.text" /></p>
          }
          @for (z of b.extra; track z.label) {
            <p class="zusatz"><strong>{{ z.label }}</strong> <nw-text inline [text]="z.text" /></p>
          }
        </div>
      }
    }
  `,
  styleUrl: './buch.scss',
})
export class Gegenstand {
  readonly artikel = input.required<Entity>();

  private readonly bestand = inject(Bestand);

  constructor() {
    /* Die Munition ist ein Verweis (T-078); ohne Namen aus `refs` holt der
       Gegenstand sie selbst, wie der Statblock seine Zustände. */
    effect(() => {
      const w = this.artikel().components?.['Weapon'] as Record<string, unknown> | undefined;
      const id = w?.['ammoType'];
      if (typeof id === 'string' && id && !this.bestand.name()(id)) untracked(() => void this.bestand.holen([id]));
    });
  }

  protected readonly buch = computed<ItemBook | null>(() => {
    const r = this.bestand.registry();
    if (!r) return null;
    const e = this.artikel();
    const typ = primaryInterface(e);
    const name = this.bestand.name();
    /* Die Namen der Verweisziele bringt der Artikel mit (`refs`, W7). */
    return itemBook(r, e, r.interfaces[typ]?.label ?? typ, (id) => name(id));
  });
}

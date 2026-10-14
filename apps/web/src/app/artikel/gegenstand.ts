import { Component, computed, effect, inject, input, untracked } from '@angular/core';
import { itemBook, primaryInterface } from '@nw/model';
import type { Entity, ItemBook } from '@nw/model';
import { Bestand } from '../kern/bestand';
import { AbwMarken, zeilenVergleich, type Abweichung, type Vergleichsfassung } from './fassungen';
import { Text } from './text';

/**
 * **Der Gegenstand wie im Spielleiterhandbuch** (W2): Art, Seltenheit und
 * Einstimmung kursiv unter dem Namen; Rüstungsklasse, Schaden, Ladungen,
 * Preis und Gewicht als Kopfzeilen, das Gewicht in der Einheit der
 * Einstellung. Waffe, Rüstung und Material erben die Anordnung von `Item`.
 */
@Component({
  selector: 'nw-gegenstand',
  imports: [Text, AbwMarken],
  template: `
    @if (buch(); as b) {
      @if (b.byline) {
        <p class="byline">{{ b.byline }}</p>
      }
      <nw-abw [liste]="an(KOPF)" />
      <div class="linie" aria-hidden="true"></div>
      @if (b.lines.length || b.extra.length || vgl().nurDort.length) {
        <div class="zeilen">
          @for (z of b.lines; track z.label) {
            <p><strong>{{ z.label }}</strong> <nw-text inline [text]="z.text" /><nw-abw [liste]="an(z.label)" /></p>
          }
          @for (z of b.extra; track z.label) {
            <p class="zusatz"><strong>{{ z.label }}</strong> <nw-text inline [text]="z.text" /><nw-abw [liste]="an(z.label)" /></p>
          }
          <!-- Zeilen, die nur eine andere Fassung hat (T-103): „hier —". -->
          @for (z of vgl().nurDort; track z.label) {
            <p class="zusatz leer"><strong>{{ z.label }}</strong> —<nw-abw [liste]="z.abw" /></p>
          }
        </div>
      }
    }
  `,
  styleUrl: './buch.scss',
})
export class Gegenstand {
  readonly artikel = input.required<Entity>();
  /** Die verglichenen Fassungen (T-103): an jeder Zeile steht, was sie anders sagen. */
  readonly fassungen = input<readonly Vergleichsfassung[]>([]);

  private readonly bestand = inject(Bestand);
  protected readonly KOPF = 'byline';

  constructor() {
    /* Die Munition ist ein Verweis (T-078); ohne Namen aus `refs` holt der
       Gegenstand sie selbst, wie der Statblock seine Zustände. */
    effect(() => {
      const w = this.artikel().components?.['Weapon'] as Record<string, unknown> | undefined;
      const id = w?.['ammoType'];
      if (typeof id === 'string' && id && !this.bestand.name()(id)) untracked(() => void this.bestand.holen([id]));
    });
  }

  protected readonly buch = computed<ItemBook | null>(() => this.bauen(this.artikel()));

  private bauen(e: Entity): ItemBook | null {
    const r = this.bestand.registry();
    if (!r) return null;
    const typ = primaryInterface(e);
    const name = this.bestand.name();
    /* Die Namen der Verweisziele bringt der Artikel mit (`refs`, W7). */
    return itemBook(r, e, r.interfaces[typ]?.label ?? typ, (id) => name(id));
  }

  /** Die Zeilen gegen die der Fassungen, nach Beschriftung (T-103). */
  protected readonly vgl = computed(() => {
    const b = this.buch();
    const zeilen = (x: ItemBook) => [{ label: this.KOPF, text: x.byline }, ...x.lines, ...x.extra];
    const andere = this.fassungen().flatMap((f) => {
      const o = this.bauen(f.entity);
      return o ? [{ f, zeilen: zeilen(o) }] : [];
    });
    return zeilenVergleich(b ? zeilen(b) : [], andere);
  });

  protected an(label: string): Abweichung[] {
    return this.vgl().an.get(label.trim().toLowerCase()) ?? [];
  }
}

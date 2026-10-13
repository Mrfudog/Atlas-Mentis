import { Component, computed, effect, inject, input } from '@angular/core';
import { bookSections, entityName, relationDef } from '@nw/model';
import type { BookSection, Entity } from '@nw/model';
import { Bestand } from '../kern/bestand';
import { Text } from './text';

/**
 * **Die Abschnitte eines zusammengesetzten Artikels, wie im Buch** (W2):
 * die Merkmale ohne Überschrift, dann „Actions", „Bonus Actions",
 * „Reactions", „Legendary Actions" — je Aktionsart, die an den Teilen
 * steht (`bookSections`). Gezeichnet für das Element `composed` und im
 * Statblock.
 *
 * **Die Teile kommen ganz und in einer Anfrage** (`Bestand.holen`): die
 * Kurzfassung kennt ihren Namen, aber weder ihren Text noch ihre
 * Angriffswerte. Was nicht kommt, darf dieser Betrachter nicht sehen — es
 * steht mit Namen da, und dass es fehlt.
 */
@Component({
  selector: 'nw-abschnitte',
  imports: [Text],
  template: `
    @for (s of abschnitte(); track s.key) {
      @if (s.title) {
        <h2>{{ s.title }}</h2>
      }
      @if (s.intro) {
        <p class="eintrag">{{ s.intro }}</p>
      }
      @for (e of s.entries; track e.id) {
        @if (e.missing) {
          <p class="fehlt">{{ e.name || 'A part' }} — {{ laedt() ? 'loading…' : 'not here' }}</p>
        } @else {
          <nw-text
            class="eintrag"
            [text]="e.text"
            [scopes]="e.scopes"
            [vorspann]="e.name + '.'"
            [vorspannZiel]="e.target"
          />
        }
      }
    }
  `,
  styleUrl: './buch.scss',
  host: { '[style.display]': "abschnitte().length ? null : 'none'" },
})
export class Abschnitte {
  /** Der Artikel, dessen `section`-Kanten gezeichnet werden. */
  readonly besitzer = input.required<Entity>();

  private readonly bestand = inject(Bestand);

  /** Die Ziele der Abschnittskanten — und die Aktionsarten kennt die Kurzfassung. */
  private readonly ziele = computed(() => {
    const r = this.bestand.registry();
    const e = this.besitzer();
    if (!r) return [];
    return (e.relations ?? []).filter((k) => relationDef(r, k.type).section).map((k) => k.to);
  });

  constructor() {
    effect(() => {
      void this.bestand.holen(this.ziele());
    });
  }

  protected readonly laedt = computed(() => {
    const voll = this.bestand.voll();
    const fehlt = this.bestand.fehlt();
    return this.ziele().some((id) => !voll.has(id) && !fehlt.has(id));
  });

  protected readonly abschnitte = computed<BookSection[]>(() => {
    const r = this.bestand.registry();
    if (!r) return [];
    const voll = this.bestand.voll();
    const kurz = this.bestand.byId();
    return bookSections(r, this.besitzer(), {
      part: (id) => voll.get(id),
      nameOf: (id) => {
        const k = kurz.get(id);
        return k ? entityName(k) : undefined;
      },
      campaign: r.vars,
    });
  });
}

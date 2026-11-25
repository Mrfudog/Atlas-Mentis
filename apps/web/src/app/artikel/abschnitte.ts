import { Component, computed, effect, inject, input, untracked } from '@angular/core';
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

  /**
   * Die Aktionsarten der geholten Teile („Reaction", „Bonus Action" …):
   * ihr Name ist die Überschrift. Die Kurzfassung kennt sie nur, wenn
   * zufällig schon eine Liste sie brachte — sonst stand jede Gruppe unter
   * „Actions", auch die Reaktion des Marilith (T-090).
   */
  private readonly aktionsarten = computed(() => {
    const voll = this.bestand.voll();
    const ids = new Set<string>();
    for (const id of this.ziele()) {
      const art = (voll.get(id)?.components?.['Action'] as { actionType?: unknown } | undefined)?.actionType;
      if (typeof art === 'string' && art) ids.add(art);
    }
    return [...ids];
  });

  constructor() {
    effect(() => {
      void this.bestand.holen(this.ziele());
    });
    effect(() => {
      const name = this.bestand.name();
      const voll = this.bestand.voll();
      const offen = this.aktionsarten().filter((id) => !voll.has(id) && !name(id));
      if (offen.length) untracked(() => void this.bestand.holen(offen));
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
    const name = this.bestand.name();
    return bookSections(r, this.besitzer(), {
      part: (id) => voll.get(id),
      /* Der Name steht in `Identity`; `Entity.name` ist bei eingelesenen
         Artikeln leer, und „" ?? …" wäre dann die leere Überschrift. */
      nameOf: (id) => {
        const ganz = voll.get(id);
        return (ganz && entityName(ganz)) || name(id);
      },
      campaign: r.vars,
    });
  });
}

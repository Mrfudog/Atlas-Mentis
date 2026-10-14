import { Component, computed, inject, input } from '@angular/core';
import { bodyOf, spellBook } from '@nw/model';
import type { Entity, SpellBook, VarScopes } from '@nw/model';
import { Bestand } from '../kern/bestand';
import { AbwMarken, textVergleich, zeilenVergleich, type Abweichung, type Vergleichsfassung } from './fassungen';
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
  imports: [Text, AbwMarken],
  template: `
    @if (buch(); as b) {
      @if (b.byline) {
        <p class="byline">{{ b.byline }}</p>
      }
      <nw-abw [liste]="an(KOPF)" />
      <div class="linie" aria-hidden="true"></div>
      @if (b.lines.length) {
        <div class="zeilen">
          @for (z of b.lines; track z.label) {
            <p><strong>{{ z.label }}:</strong> <nw-text inline [text]="z.text" /><nw-abw [liste]="an(z.label)" /></p>
          }
        </div>
      }
      <!-- Der Text Abschnitt für Abschnitt gegen die Fassungen (T-103). -->
      @if (textVgl(); as v) {
        <div class="text">
          @for (s of v.abschnitte; track s.key) {
            <nw-text [text]="s.text" [scopes]="scopes()" />
            <nw-abw [liste]="s.abw" [scopes]="scopes()" />
          }
          @for (n of v.nurDort; track $index) {
            <nw-abw [liste]="[n.abw]" [titel]="(n.heading || 'More text') + ' — only in this version'" [scopes]="scopes()" />
          }
        </div>
      } @else if (text(); as t) {
        <nw-text class="text" [text]="t" [scopes]="scopes()" />
      }
      @if (b.higherLevels) {
        <nw-text class="text" [text]="b.higherLevels" [scopes]="scopes()" vorspann="At Higher Levels." />
      }
      <nw-abw [liste]="an(HOEHER)" [titel]="'At Higher Levels — says otherwise'" [scopes]="scopes()" />
      @if (b.extra.length) {
        <div class="zeilen zusatz">
          @for (z of b.extra; track z.label) {
            <p><strong>{{ z.label }}</strong> <nw-text inline [text]="z.text" /><nw-abw [liste]="an(z.label)" /></p>
          }
        </div>
      }
      @if (vgl().nurDort.length) {
        <div class="zeilen zusatz">
          @for (z of vgl().nurDort; track z.label) {
            <p class="leer"><strong>{{ z.label }}</strong> —<nw-abw [liste]="z.abw" /></p>
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
  /** Die verglichenen Fassungen (T-103): an jeder Zeile steht, was sie anders sagen. */
  readonly fassungen = input<readonly Vergleichsfassung[]>([]);

  private readonly bestand = inject(Bestand);
  protected readonly KOPF = 'byline';
  protected readonly HOEHER = 'At Higher Levels';

  protected readonly buch = computed<SpellBook | null>(() => this.bauen(this.artikel()));

  private bauen(artikel: Entity): SpellBook | null {
    const r = this.bestand.registry();
    if (!r) return null;
    const name = this.bestand.name();
    /* Die Namen der Kantenziele bringt der Artikel mit (`refs`, W7). */
    return spellBook(r, artikel, (id) => name(id));
  }

  protected readonly text = computed(() => bodyOf(this.artikel()));

  /** Die Zeilen gegen die der Fassungen, nach Beschriftung (T-103). */
  protected readonly vgl = computed(() => {
    const b = this.buch();
    const zeilen = (x: SpellBook) => [
      { label: this.KOPF, text: x.byline },
      ...x.lines,
      { label: this.HOEHER, text: x.higherLevels },
      ...x.extra,
    ];
    const andere = this.fassungen().flatMap((f) => {
      const o = this.bauen(f.entity);
      return o ? [{ f, zeilen: zeilen(o) }] : [];
    });
    const v = zeilenVergleich(b ? zeilen(b) : [], andere);
    /* „At Higher Levels" steht als Text da, nicht als Zeile — also aufklappbar.
       Kopf und „At Higher Levels" stehen immer in der eigenen Liste, auch
       leer, und landen darum nie unter „nur dort". */
    const da = v.an.get(this.HOEHER.toLowerCase());
    if (da) v.an.set(this.HOEHER.toLowerCase(), da.map((a) => ({ ...a, lang: true })));
    return v;
  });

  protected an(label: string): Abweichung[] {
    return this.vgl().an.get(label.trim().toLowerCase()) ?? [];
  }

  /** Der Text Abschnitt für Abschnitt — nur, wenn eine Fassung dort etwas anderes sagt. */
  protected readonly textVgl = computed(() => {
    const f = this.fassungen();
    if (!f.length) return null;
    const v = textVergleich(this.text(), f.map((x) => ({ f: x, text: bodyOf(x.entity) })));
    return v.ganz.length ? v : null;
  });
}

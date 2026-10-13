import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Bestand } from '../kern/bestand';
import { RegisterArbeit, articles } from './arbeit';
import { enumUsers } from './regeln';

/**
 * **Eine Aufzählungszeile** (`REG.enums`) — eine Liste von Wörtern, die
 * mehrere Felder teilen (`enumRef`). Wer sie ändert, ändert sie einmal.
 *
 * Eine Zeile hält: ein Wert, den die Liste nicht mehr kennt, wird beim
 * nächsten Speichern eines Artikels abgewiesen, der ihn trägt
 * (`value_not_allowed`). Darum wird vorher gezählt, welche gestrichenen
 * Werte der Bestand noch führt.
 */
@Component({
  selector: 'nw-reg-liste',
  imports: [RouterLink],
  template: `
    @if (def(); as d) {
      <div class="typkopf">
        <h2>{{ d.label ?? name() }}</h2>
        <code>{{ name() }}</code>
        <span class="dim">{{ d.values.length }} values</span>
      </div>
      <section class="kasten" aria-label="List">
        <label class="f">
          <span>Label</span>
          <input type="text" [value]="d.label ?? ''" [placeholder]="name()" [disabled]="!darf()"
            (change)="labelSetzen($any($event.target).value)" />
        </label>
        <p class="hint">How the list is called where a field picks it.</p>
        <label class="f">
          <span>Values</span>
          <textarea rows="8" [value]="d.values.join('\\n')" [disabled]="!darf()"
            (change)="werteSetzen($any($event.target))"></textarea>
        </label>
        <p class="hint">
          One per line, in the order the form offers them. A value is data, not a name — it stays in the language it is
          written in.
        </p>
        <h3>Used by</h3>
        @for (f of nutzer(); track f) {
          <div class="frow lesen">
            <a class="fk" [routerLink]="[]" [queryParams]="{ type: f.split('.')[0], tab: null, list: null }">{{ f }}</a>
            <span class="dim">{{ belegt(f) }}</span>
          </div>
        } @empty {
          <p class="hint">No field names it yet. A field picks it under its settings, “Choices from”.</p>
        }
      </section>
      @if (darf()) {
        <div class="knoepfe">
          <button type="button" class="weg" [disabled]="nutzer().length > 0" (click)="entfernen()">Remove list</button>
          @if (nutzer().length) {
            <span class="dim">Named by {{ nutzer().length }} field(s) — it stays while they do.</span>
          }
        </div>
      }
    } @else {
      <p class="leer">There is no list {{ name() }}.</p>
    }
  `,
  /* Gezeichnet im Stil der Registerseite (`register.scss`, einmal geladen). */
})
export class RegListe {
  readonly name = input.required<string>();
  readonly darf = input(false);

  private readonly bestand = inject(Bestand);
  private readonly arbeit = inject(RegisterArbeit);

  private readonly reg = computed(() => this.bestand.registry());
  protected readonly def = computed(() => this.reg()?.enums?.[this.name()]);
  protected readonly nutzer = computed(() => (this.reg() ? enumUsers(this.reg()!, this.name()) : []));

  protected belegt(ref: string): string {
    const z = this.arbeit.usage()?.values[ref];
    if (!z) return '';
    const n = Object.values(z).reduce((a, b) => a + b, 0);
    return n ? `${n.toLocaleString('en')} values in use` : '';
  }

  protected labelSetzen(roh: string): void {
    const n = this.name();
    const label = roh.trim();
    void this.arbeit.aendern('enums', (enums) => {
      const d = enums[n];
      if (!d) return `There is no list ${n}.`;
      if (label) d.label = label;
      else delete d.label;
      return undefined;
    });
  }

  protected werteSetzen(el: HTMLTextAreaElement): void {
    const n = this.name();
    const neu = [...new Set(el.value.split('\n').map((x) => x.trim()).filter(Boolean))];
    const tun = () =>
      this.arbeit.aendern('enums', (enums) => {
        const d = enums[n];
        if (!d) return `There is no list ${n}.`;
        d.values = neu;
        return undefined;
      });
    /* Was gestrichen wird und noch dasteht — je Feld, das die Liste nennt. */
    const u = this.arbeit.usage();
    const weg = new Map<string, number>();
    for (const f of this.nutzer()) {
      for (const [w, z] of Object.entries(u?.values[f] ?? {})) {
        if (!neu.includes(w) && (this.def()?.values ?? []).includes(w)) weg.set(w, (weg.get(w) ?? 0) + z);
      }
    }
    if (!weg.size) {
      void tun();
      return;
    }
    this.arbeit.fragen({
      titel: `Values still in use`,
      text: [
        `The stock still carries: ${[...weg].map(([w, z]) => `“${w}” in ${articles(z)}`).join(', ')}.`,
        'They stay stored, but each such article is refused on its next save until the value is changed.',
      ],
      ja: 'Change the list anyway',
      tun: () => void tun(),
    });
  }

  protected entfernen(): void {
    if (this.nutzer().length) return;
    const n = this.name();
    this.arbeit.fragen({
      titel: `Remove the list ${this.def()?.label ?? n}?`,
      text: ['No field names it.'],
      ja: 'Remove',
      tun: () =>
        void this.arbeit.aendern('enums', (enums) => {
          delete enums[n];
        }),
    });
  }
}

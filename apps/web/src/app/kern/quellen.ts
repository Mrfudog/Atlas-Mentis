import { Component, Injectable, computed, inject, input, signal } from '@angular/core';
import { Api } from './api';

/**
 * **Die Quellenkürzel und ihre Bücher** (T-088, REQ-245): einmal je Sitzung
 * vom Server (`GET /api/sources`, aus `Layer.abbreviation`). Die Leitung las
 * „XGE" an jedem Artikel und fand nirgends, welches Buch das ist.
 */
@Injectable({ providedIn: 'root' })
export class Quellen {
  private readonly api = inject(Api);
  private readonly karte = signal<Record<string, string>>({});
  private geladen: Promise<void> | null = null;

  constructor() {
    /* Geladen wird ausserhalb jedes Zeichnens: eine Anfrage setzt Signale
       (`Api.laufend`), und das darf ein `computed` nicht. */
    queueMicrotask(() => this.laden());
  }

  /** Der volle Titel zu einem Kürzel, oder leer, solange die Liste fehlt. */
  titel(kuerzel: string): string {
    return this.karte()[kuerzel] ?? '';
  }

  /** „XGE p. 12" → `{ kuerzel: 'XGE', rest: ' p. 12', titel }`; ohne bekanntes Kürzel nur `rest`. */
  zerlege(text: string): { kuerzel: string; rest: string; titel: string } {
    const m = /^([A-Za-z][A-Za-z0-9-]*)(.*)$/s.exec(text.trim());
    const titel = m ? this.titel(m[1]!) : '';
    return m && titel ? { kuerzel: m[1]!, rest: m[2]!, titel } : { kuerzel: '', rest: text, titel: '' };
  }

  private laden(): void {
    this.geladen ??= this.api
      .sources()
      .then((r) => this.karte.set(r.sources ?? {}))
      .catch(() => {
        /* Ohne Liste steht das Kürzel, wie es ist. */
        this.geladen = null;
      });
  }
}

/**
 * **Ein Quellenkürzel, das sich erklärt** (T-088): `XGE p. 12` mit dem
 * vollen Titel beim Darüberfahren (`title`) und — weil ein Telefon kein
 * Darüberfahren kennt — beim Antippen als Zeile darunter. Ein unbekanntes
 * Kürzel steht, wie es ist.
 */
@Component({
  selector: 'nw-quelle',
  template: `
    @if (teile(); as t) {
      @if (t.kuerzel) {
        <abbr
          [title]="t.titel"
          tabindex="0"
          role="button"
          [attr.aria-expanded]="offen()"
          [attr.aria-label]="t.kuerzel + ': ' + t.titel"
          (click)="umschalten($event)"
          (keydown.enter)="umschalten($event)"
          >{{ t.kuerzel }}</abbr
        >{{ t.rest }}
        @if (offen()) {
          <span class="titel" role="note">{{ t.titel }}</span>
        }
      } @else {
        {{ t.rest }}
      }
    }
  `,
  styles: `
    abbr {
      text-decoration: underline dotted;
      text-underline-offset: 2px;
      cursor: help;
    }
    .titel {
      display: block;
      font-style: italic;
      font-size: 0.85em;
    }
  `,
})
export class QuelleText {
  readonly text = input.required<string>();
  private readonly quellen = inject(Quellen);
  protected readonly offen = signal(false);
  protected readonly teile = computed(() => this.quellen.zerlege(this.text() ?? ''));

  protected umschalten(ev: Event): void {
    /* In einer Listenzeile wählt ein Klick sonst die Zeile. */
    ev.stopPropagation();
    ev.preventDefault();
    this.offen.update((x) => !x);
  }
}

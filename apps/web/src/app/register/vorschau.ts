import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { typeList, viewFields } from '@nw/model';
import type { Registry } from '@nw/model';
import { Api, type ListenZeile } from '../kern/api';
import { Bestand } from '../kern/bestand';
import { Blatt } from '../artikel/blatt';
import { Kachel } from '../boards/kachel';
import { eintragText } from '../ansichten/palette';

/**
 * **Die Vorschau im Register** (T-110): eine Ansicht an einem wählbaren
 * Beispielartikel, gezeichnet aus dem **Entwurf** — was man ändert, sieht
 * man, bevor man speichert.
 *
 * Darüber steht ohne Artikel, welche Felder der Art wo landen
 * (`viewFields`): die Ansicht nimmt Felder, ein Artikel zeigt davon, was
 * er hat. Die Seite und der Druck zeichnen als Blatt, die übrigen als
 * Kachel — so, wie der Ort es tut.
 */
@Component({
  selector: 'nw-reg-vorschau',
  imports: [Blatt, Kachel],
  template: `
    <div class="vorschau-reg">
      <div class="zeile">
        @if (!typ()) {
          <select aria-label="Type for the preview" (change)="typWahl.set($any($event.target).value); artikelId.set('')">
            <option value="">Type…</option>
            @for (t of typen(); track t) {
              <option [value]="t" [selected]="t === art()">{{ label(t) }}</option>
            }
          </select>
        }
        @if (art()) {
          <input type="search" placeholder="Find an example article" aria-label="Find an example article"
            [value]="suche()" (input)="suche.set($any($event.target).value)" />
        }
      </div>
      @if (art() && treffer().length && !artikelId()) {
        <ul class="treffer">
          @for (z of treffer(); track z.id) {
            <li><button type="button" class="klein" (click)="artikelId.set(z.id)">{{ z.name }}</button></li>
          }
        </ul>
      }
      @if (felder(); as f) {
        <details class="wo">
          <summary>Which fields land where for {{ label(art()) }}</summary>
          @for (e of f.elements; track e.id) {
            <p><code>{{ e.id }}</code> {{ e.fields.length ? liste(e.fields) : '—' }}</p>
          }
          <p>
            <b>Not taken:</b> {{ f.rest.length ? liste(f.rest) : 'nothing' }}
            <span class="dim">{{ registerVon()?.views?.[ansicht()]?.rest ? '— shown at the end' : '— not shown' }}</span>
          </p>
        </details>
      }
      @if (artikel(); as e) {
        <div class="probe" [class.blatt-probe]="alsBlatt()">
          <div class="probe-kopf">
            <b>{{ name() }}</b>
            <button type="button" class="klein" (click)="artikelId.set('')">Another</button>
          </div>
          @if (alsBlatt()) {
            <nw-blatt [artikel]="e" [ansicht]="ansicht()" [register]="registerVon()" [genau]="true" />
          } @else {
            <nw-kachel [artikel]="e" [ansicht]="ansicht()" [register]="registerVon()" [genau]="true" />
          }
        </div>
      } @else if (artikelId()) {
        <p class="dim">Loading…</p>
      } @else if (art()) {
        <p class="dim">Pick an article to see it in this view.</p>
      }
    </div>
  `,
  styleUrl: './vorschau.scss',
})
export class RegVorschau {
  readonly ansicht = input.required<string>();
  /** Der Entwurf; ohne Angabe das gespeicherte Register. */
  readonly register = input<Registry | null>(null);
  /** Fest auf eine Art (die Typseite); sonst wählbar. */
  readonly typ = input<string | null>(null);

  private readonly api = inject(Api);
  private readonly bestand = inject(Bestand);
  protected readonly typWahl = signal('');
  protected readonly suche = signal('');
  protected readonly artikelId = signal('');
  protected readonly treffer = signal<ListenZeile[]>([]);

  protected readonly registerVon = computed(() => this.register() ?? this.bestand.registry());
  protected readonly art = computed(() => this.typ() ?? this.typWahl());
  protected readonly typen = computed(() => {
    const r = this.bestand.registry();
    return r ? typeList(r).filter((t) => !r.interfaces[t]?.abstract) : [];
  });
  protected readonly alsBlatt = computed(() => this.ansicht() === 'full' || this.ansicht() === 'print');
  protected readonly felder = computed(() => {
    const r = this.registerVon();
    return r && this.art() ? viewFields(r, this.ansicht(), this.art()) : null;
  });
  protected readonly artikel = computed(() => (this.artikelId() ? this.bestand.voll().get(this.artikelId()) : undefined));
  protected readonly name = computed(() => this.bestand.name()(this.artikelId()) ?? this.artikelId());

  constructor() {
    /* Suchen, sobald eine Art gewählt ist — die ersten zehn, oder die zehn,
       die zum Namen passen. */
    effect((onCleanup) => {
      const type = this.art();
      const q = this.suche().trim();
      if (!type) return;
      const ab = new AbortController();
      onCleanup(() => ab.abort());
      void this.api
        .list({ type, q: q || undefined, limit: 10 }, { signal: ab.signal })
        .then((l) => this.treffer.set(l.rows))
        .catch(() => undefined);
    });
    effect(() => {
      const id = this.artikelId();
      if (id) void this.bestand.oeffnen(id, false, false);
    });
  }

  protected label(t: string): string {
    return this.bestand.registry()?.interfaces[t]?.label ?? t;
  }
  protected liste(e: string[]): string {
    return e.map((x) => eintragText(this.registerVon(), x)).join(', ');
  }
}

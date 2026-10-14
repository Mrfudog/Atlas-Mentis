import { Component, DestroyRef, ElementRef, computed, effect, inject, signal } from '@angular/core';
import { NavigationStart, Router, RouterLink } from '@angular/router';
import { Api, type Suchergebnis } from '../kern/api';
import { BEREICHE, bereichLabel } from '../kern/bereiche';
import { Kurzansicht } from '../kern/kurzansicht';
import { Suche, type SuchFilter } from '../kern/suche';
import { Vorschau } from '../artikel/vorschau';

type Treffer = Suchergebnis['rows'][number];

/** So viele Treffer beim Tippen; „Show more" holt das nächste Blatt. */
const BLATT = 12;
/** So lange wartet die Frage nach dem letzten Tastendruck. */
const WARTEN_MS = 120;
/** So viele Knöpfe je Filter, bevor „more" aufklappt. */
const KNOEPFE = 8;

/**
 * **Die übergreifende Suche** (T-138) — einmal im Gerüst, auf jeder Seite.
 *
 * Beim Tippen fragt sie den Server (`/api/search`): derselbe gesiebte
 * Index wie jede Liste, nach Nähe geordnet — was ein Spieler nicht sieht,
 * findet er nicht, und ein verborgener Name steht als Deckname da. Ein
 * Treffer zeigt wenig (Name und Art); das **„+"** klappt die Ansicht
 * `search` auf, mit Ebene, Herausgeber und Quelle darüber — eine Ansicht
 * aus dem Register, kein Sonderfall.
 *
 * Gefiltert wird nach Bereich, Art, Ebene und Herausgeber; was zuletzt als
 * Filter diente, steht in seiner Leiste vorn.
 *
 * Tastatur: ↑/↓ wählt, **Enter** öffnet den Artikel, **Shift+Enter** die
 * Kurzansicht (T-093) am Treffer, **→** am Textende klappt auf, **Esc**
 * schliesst und gibt den Fokus zurück.
 */
@Component({
  selector: 'nw-suche',
  imports: [RouterLink, Vorschau],
  template: `
    @if (suche.offen()) {
      <div class="schleier" aria-hidden="true" (click)="suche.schliessen()"></div>
      <div
        class="suche"
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        (keydown)="taste($event)"
      >
        <div class="kopf">
          <input
            type="search"
            placeholder="Search articles …"
            aria-label="Search articles"
            role="combobox"
            aria-autocomplete="list"
            aria-controls="suche-treffer"
            [attr.aria-expanded]="treffer().length > 0"
            [attr.aria-activedescendant]="treffer().length ? 'st-' + aktiv() : null"
            autocomplete="off"
            spellcheck="false"
            [value]="text()"
            (input)="tippen($event)"
          />
          <button type="button" class="zu" (click)="suche.schliessen()" aria-label="Close search">
            Esc
          </button>
        </div>

        @if (text().trim()) {
          <div class="filter" aria-label="Filter the search">
            <div class="reihe" role="group" aria-label="Area">
              <span class="leg">Area</span>
              <button
                type="button"
                class="chip"
                [class.an]="!bereich()"
                (click)="bereichWaehlen(null)"
              >
                All
              </button>
              @for (b of bereiche; track b.weg) {
                <button
                  type="button"
                  class="chip"
                  [class.an]="bereich() === b.weg"
                  (click)="bereichWaehlen(b.weg)"
                >
                  {{ b.label }}
                </button>
              }
            </div>
            @for (g of gruppen(); track g.kind) {
              @if (g.knoepfe.length) {
                <div class="reihe" role="group" [attr.aria-label]="g.label">
                  <span class="leg">{{ g.label }}</span>
                  @for (k of g.knoepfe; track k.value) {
                    <button
                      type="button"
                      class="chip"
                      [class.an]="k.an"
                      [class.zuletzt]="k.zuletzt"
                      [attr.aria-pressed]="k.an"
                      [attr.title]="k.zuletzt ? 'Recently used' : null"
                      (click)="umschalten({ kind: g.kind, value: k.value, label: k.label })"
                    >
                      {{ k.label }} <span class="zahl">{{ k.count }}</span>
                    </button>
                  }
                  @if (g.mehr) {
                    <button type="button" class="chip mehr" (click)="alle.set(g.kind)">
                      +{{ g.mehr }} more
                    </button>
                  }
                </div>
              }
            }
          </div>
        }

        @if (!text().trim()) {
          @if (suche.zuletzt().length) {
            <p class="leg abschnitt">Recently opened</p>
            <ul class="treffer" id="suche-treffer" role="listbox" aria-label="Recently opened">
              @for (z of suche.zuletzt(); track z.id; let i = $index) {
                <li
                  [id]="'st-' + i"
                  role="option"
                  [class.aktiv]="i === aktiv()"
                  [attr.aria-selected]="i === aktiv()"
                >
                  <div class="zeile">
                    <a class="name" [routerLink]="weg(z.id, z.type)" (click)="geoeffnet(z)">{{
                      z.name
                    }}</a>
                    <span class="art">{{ z.typeLabel }}</span>
                  </div>
                </li>
              }
            </ul>
          } @else {
            <p class="hinweis">
              Type a name, an alias or a number. Enter opens, Shift+Enter shows the quick view.
            </p>
          }
        } @else if (fehler()) {
          <p class="hinweis fehler" role="alert">
            The search did not answer. <button type="button" (click)="fragen()">Retry</button>
          </p>
        } @else {
          <ul class="treffer" id="suche-treffer" role="listbox" aria-label="Results">
            @for (z of treffer(); track z.id; let i = $index) {
              <li
                [id]="'st-' + i"
                role="option"
                [class.aktiv]="i === aktiv()"
                [attr.aria-selected]="i === aktiv()"
              >
                <div class="zeile">
                  <a class="name" [routerLink]="weg(z.id, z.type)" (click)="geoeffnet(z)">{{
                    z.name
                  }}</a>
                  <span class="art">{{ z.typeLabel }}</span>
                  <button
                    type="button"
                    class="plus"
                    [attr.aria-expanded]="aufgeklappt() === z.id"
                    [attr.aria-label]="
                      (aufgeklappt() === z.id ? 'Less about ' : 'More about ') + z.name
                    "
                    (click)="aufklappen(z.id)"
                  >
                    {{ aufgeklappt() === z.id ? '−' : '+' }}
                  </button>
                </div>
                @if (aufgeklappt() === z.id) {
                  <div class="mehr-info">
                    <dl class="meta">
                      <div>
                        <dt>Type</dt>
                        <dd>
                          {{ z.typeLabel }}
                          @if (bereichName(z.area); as b) {
                            · {{ b }}
                          }
                        </dd>
                      </div>
                      @if (z.layers.length) {
                        <div>
                          <dt>Layer</dt>
                          <dd>{{ z.layers.join(', ') }}</dd>
                        </div>
                      }
                      @if (z.publishers.length) {
                        <div>
                          <dt>Publisher</dt>
                          <dd>{{ z.publishers.join(', ') }}</dd>
                        </div>
                      }
                      @if (z.source) {
                        <div>
                          <dt>Source</dt>
                          <dd>{{ z.source }}</dd>
                        </div>
                      }
                    </dl>
                    <!-- Nachgeladen wie im Popup (T-093): die Vorschau bringt das Modell mit. -->
                    @defer (on immediate) {
                      <nw-vorschau
                        [id]="z.id"
                        ansicht="search"
                        [eingebettet]="true"
                        [rueck]="false"
                      />
                    } @placeholder {
                      <p class="hinweis">Loading…</p>
                    }
                  </div>
                }
              </li>
            } @empty {
              @if (!laedt()) {
                <li class="hinweis" role="presentation">
                  Nothing found{{ filterAn() ? ' with these filters' : '' }}.
                </li>
              }
            }
          </ul>
          <p class="fuss" aria-live="polite">
            @if (laedt()) {
              Searching …
            } @else if (ergebnis(); as r) {
              {{ r.total }} {{ r.total === 1 ? 'result' : 'results' }}
              @if (treffer().length < r.total) {
                <button type="button" class="weiter" (click)="mehrLaden()">Show more</button>
              }
            }
            <span class="tasten" aria-hidden="true"
              >↑↓ choose · Enter open · Shift+Enter quick view · → more</span
            >
          </p>
        }
      </div>
    }
  `,
  styles: `
    .schleier {
      position: fixed;
      inset: 0;
      z-index: 40;
      background: rgb(0 0 0 / 0.3);
    }
    .suche {
      position: fixed;
      z-index: 41;
      top: 8vh;
      left: 50%;
      transform: translateX(-50%);
      width: min(44rem, calc(100vw - 2rem));
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      background: var(--paper);
      border: 1px solid var(--line);
      border-radius: 10px;
      box-shadow: 0 10px 40px rgb(0 0 0 / 0.3);
      overflow: hidden;
    }
    .kopf {
      display: flex;
      gap: 0.5rem;
      padding: 0.75rem;
      border-bottom: 1px solid var(--line);
    }
    .kopf input {
      flex: 1;
      min-width: 0;
      font-size: 1.1rem;
      padding: 0.45rem 0.6rem;
    }
    .zu {
      font-size: 0.8rem;
    }
    .filter {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
      padding: 0.5rem 0.75rem;
      border-bottom: 1px solid var(--line);
    }
    .reihe {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.25rem;
    }
    .leg {
      min-width: 4.5rem;
      color: var(--dim);
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .abschnitt {
      margin: 0.5rem 0.75rem 0;
    }
    .chip {
      padding: 0.1rem 0.5rem;
      border: 1px solid var(--line);
      border-radius: 12px;
      background: var(--surface);
      color: var(--ink);
      font-size: 0.85rem;
    }
    .chip.an {
      background: var(--accent);
      border-color: var(--accent);
      color: var(--accent-ink, var(--surface));
    }
    .chip.zuletzt:not(.an) {
      border-style: dashed;
      border-color: var(--accent);
    }
    .chip .zahl {
      opacity: 0.7;
      font-size: 0.75rem;
    }
    .chip.mehr {
      border-style: dotted;
    }
    .treffer {
      list-style: none;
      margin: 0;
      padding: 0.25rem 0;
      overflow-y: auto;
      flex: 1;
    }
    .treffer li {
      padding: 0.2rem 0.75rem;
    }
    .treffer li.aktiv {
      background: var(--hover);
    }
    .zeile {
      display: flex;
      align-items: baseline;
      gap: 0.5rem;
    }
    .name {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--ink);
      font-weight: 600;
      text-decoration: none;
    }
    .name:hover {
      color: var(--accent);
    }
    .art {
      color: var(--dim);
      font-size: 0.85rem;
      white-space: nowrap;
    }
    .plus {
      width: 1.8rem;
      padding: 0;
      font-weight: 700;
    }
    .mehr-info {
      margin: 0.3rem 0 0.5rem 0.5rem;
      padding-left: 0.6rem;
      border-left: 2px solid var(--accent);
      font-size: 0.9rem;
    }
    .meta {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: 0.1rem 0.6rem;
      margin: 0 0 0.4rem;
    }
    .meta div {
      display: contents;
    }
    .meta dt {
      color: var(--dim);
    }
    .meta dd {
      margin: 0;
    }
    .hinweis {
      margin: 0;
      padding: 0.75rem;
      color: var(--dim);
    }
    .fehler {
      color: var(--warn);
    }
    .fuss {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
      margin: 0;
      padding: 0.4rem 0.75rem;
      border-top: 1px solid var(--line);
      color: var(--dim);
      font-size: 0.8rem;
    }
    .tasten {
      margin-left: auto;
    }
    /* Am Telefon (T-126): ganz oben, volle Breite und Höhe — die Tastatur
       nimmt die untere Hälfte. Die Tastenhilfe sagt dort nichts. */
    @media (max-width: 640px) {
      .suche {
        top: 0;
        width: 100vw;
        max-height: 100dvh;
        height: 100dvh;
        border-radius: 0;
      }
      .tasten {
        display: none;
      }
      /* Jede Filterleiste eine Zeile, seitlich zu schieben: sonst nähmen
         die Filter den Treffern die Höhe. */
      .reihe {
        flex-wrap: nowrap;
        overflow-x: auto;
      }
      .leg {
        min-width: 4rem;
        flex: none;
      }
      .chip {
        white-space: nowrap;
      }
    }
  `,
})
export class SucheComponent {
  protected readonly suche = inject(Suche);
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly kurz = inject(Kurzansicht);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  /** Das Suchfeld — über den Host statt `viewChild`: die Prüfumgebung übersetzt JIT und kennt Signal-Abfragen nicht. */
  private eingabe(): HTMLInputElement | null {
    return this.host.nativeElement.querySelector<HTMLInputElement>('.kopf input');
  }

  protected readonly bereiche = BEREICHE;
  protected readonly text = signal('');
  protected readonly bereich = signal<string | null>(null);
  protected readonly filter = signal<readonly SuchFilter[]>([]);
  protected readonly ergebnis = signal<Suchergebnis | null>(null);
  protected readonly treffer = signal<readonly Treffer[]>([]);
  protected readonly laedt = signal(false);
  protected readonly fehler = signal(false);
  protected readonly aktiv = signal(0);
  protected readonly aufgeklappt = signal<string | null>(null);
  /** Welche Filterleiste alle Knöpfe zeigt. */
  protected readonly alle = signal<SuchFilter['kind'] | null>(null);
  protected readonly filterAn = computed(() => this.filter().length > 0 || this.bereich() !== null);

  private uhr: ReturnType<typeof setTimeout> | undefined;
  private abbruch: AbortController | null = null;

  constructor() {
    /* Geöffnet: Fokus ins Feld, den Text markiert — wer sofort tippt, ersetzt ihn. */
    effect(() => {
      if (!this.suche.offen()) return;
      /* Nach dem Zeichnen: erst dann steht das Feld da. */
      setTimeout(() => {
        const feld = this.eingabe();
        feld?.focus();
        feld?.select();
      });
    });
    /* Ein Seitenwechsel schliesst die Suche, ohne den Fokus zurückzuholen. */
    const ab = this.router.events.subscribe((e) => {
      if (e instanceof NavigationStart) this.suche.schliessen(false);
    });
    inject(DestroyRef).onDestroy(() => {
      ab.unsubscribe();
      clearTimeout(this.uhr);
      this.abbruch?.abort();
    });
  }

  /** Die Filterleisten: Art, Ebene, Herausgeber — gewählte und zuletzt benutzte vorn. */
  protected readonly gruppen = computed(() => {
    const r = this.ergebnis();
    const an = this.filter();
    const zuletzt = this.suche.filterZuletzt();
    const leiste = (
      kind: SuchFilter['kind'],
      label: string,
      roh: { value: string; label: string; count: number }[],
    ) => {
      const istAn = (v: string) => an.some((f) => f.kind === kind && f.value === v);
      const warZuletzt = (v: string) => zuletzt.some((f) => f.kind === kind && f.value === v);
      const knoepfe = roh
        .map((k) => ({ ...k, an: istAn(k.value), zuletzt: warZuletzt(k.value) }))
        .sort(
          (a, b) =>
            Number(b.an) - Number(a.an) ||
            Number(b.zuletzt) - Number(a.zuletzt) ||
            b.count - a.count,
        );
      /* Gewählte stehen da, auch wenn gerade nichts sie trägt. */
      for (const f of an) {
        if (f.kind === kind && !knoepfe.some((k) => k.value === f.value)) {
          knoepfe.unshift({ value: f.value, label: f.label, count: 0, an: true, zuletzt: false });
        }
      }
      const zeigen = this.alle() === kind ? knoepfe : knoepfe.slice(0, KNOEPFE);
      return { kind, label, knoepfe: zeigen, mehr: knoepfe.length - zeigen.length };
    };
    return [
      leiste(
        'type',
        'Type',
        (r?.facets.types ?? []).map((t) => ({ value: t.type, label: t.label, count: t.count })),
      ),
      leiste(
        'layer',
        'Source',
        (r?.facets.layers ?? [])
          .filter((l) => l.id !== '∅')
          .map((l) => ({ value: l.id, label: l.name, count: l.count })),
      ),
      leiste(
        'publisher',
        'Publisher',
        (r?.facets.publishers ?? []).map((p) => ({ value: p.name, label: p.name, count: p.count })),
      ),
    ];
  });

  protected bereichName(weg: string): string | undefined {
    return bereichLabel(weg);
  }

  /** Wohin ein Treffer führt: eine Klasse auf ihre Seite, alles andere auf die Artikelseite. */
  protected weg(id: string, typ: string): string[] {
    return typ === 'Class' ? ['/classes', id] : ['/artikel', id];
  }

  protected tippen(ev: Event): void {
    this.text.set((ev.target as HTMLInputElement).value);
    this.aufgeklappt.set(null);
    clearTimeout(this.uhr);
    if (!this.text().trim()) {
      this.abbruch?.abort();
      this.ergebnis.set(null);
      this.treffer.set([]);
      this.laedt.set(false);
      this.aktiv.set(0);
      return;
    }
    this.laedt.set(true);
    this.uhr = setTimeout(() => void this.fragen(), WARTEN_MS);
  }

  protected bereichWaehlen(b: string | null): void {
    this.bereich.set(b);
    void this.fragen();
  }

  protected umschalten(f: SuchFilter): void {
    const an = this.filter().some((x) => x.kind === f.kind && x.value === f.value);
    this.filter.update((l) =>
      an ? l.filter((x) => x.kind !== f.kind || x.value !== f.value) : [...l, f],
    );
    if (!an) this.suche.gefiltert(f);
    void this.fragen();
  }

  protected aufklappen(id: string): void {
    this.aufgeklappt.update((a) => (a === id ? null : id));
  }

  /** Das erste Blatt neu fragen — die vorige Frage wird abgebrochen. */
  async fragen(): Promise<void> {
    await this.laden(0);
  }

  protected async mehrLaden(): Promise<void> {
    await this.laden(this.treffer().length);
  }

  private async laden(offset: number): Promise<void> {
    const q = this.text().trim();
    if (!q) return;
    this.abbruch?.abort();
    const abbruch = new AbortController();
    this.abbruch = abbruch;
    this.laedt.set(true);
    this.fehler.set(false);
    const nach = (k: SuchFilter['kind']) =>
      this.filter()
        .filter((f) => f.kind === k)
        .map((f) => f.value);
    try {
      const r = await this.api.search(
        {
          q,
          type: nach('type'),
          layer: nach('layer'),
          publisher: nach('publisher'),
          ...(this.bereich() ? { area: this.bereich()! } : {}),
          offset,
          limit: BLATT,
        },
        { signal: abbruch.signal },
      );
      if (abbruch.signal.aborted) return;
      this.ergebnis.set(r);
      this.treffer.update((t) => (offset ? [...t, ...r.rows] : r.rows));
      if (!offset) this.aktiv.set(0);
    } catch {
      if (abbruch.signal.aborted) return;
      this.fehler.set(true);
    } finally {
      if (this.abbruch === abbruch) this.laedt.set(false);
    }
  }

  /** Was gerade in der Liste steht: Treffer, oder ohne Text das Zuletzt. */
  private zeilen(): readonly { id: string; name: string; type: string; typeLabel: string }[] {
    return this.text().trim() ? this.treffer() : this.suche.zuletzt();
  }

  protected geoeffnet(z: { id: string; name: string; type: string; typeLabel: string }): void {
    this.suche.gewaehlt({ id: z.id, name: z.name, type: z.type, typeLabel: z.typeLabel });
  }

  protected taste(ev: KeyboardEvent): void {
    const zeilen = this.zeilen();
    if (ev.key === 'Escape') {
      ev.preventDefault();
      /* Steht die Kurzansicht offen, schliesst Esc erst sie. */
      if (this.kurz.offen()) return;
      this.suche.schliessen();
      return;
    }
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      if (!zeilen.length) return;
      ev.preventDefault();
      const n = zeilen.length;
      this.aktiv.update((i) => (ev.key === 'ArrowDown' ? (i + 1) % n : (i - 1 + n) % n));
      this.host.nativeElement
        .querySelector<HTMLElement>(`#st-${this.aktiv()}`)
        ?.scrollIntoView?.({ block: 'nearest' });
      return;
    }
    /* Aufklappen über die Tastatur: → am Ende des Textes — davor gehört → dem Text. */
    const imFeld = ev.target === this.eingabe();
    if (imFeld && this.text().trim() && ev.key === 'ArrowRight' && zeilen.length) {
      const feld = this.eingabe()!;
      if (feld.selectionStart !== feld.value.length) return;
      ev.preventDefault();
      this.aufklappen(zeilen[this.aktiv()]!.id);
      return;
    }
    if (ev.key === 'Enter' && imFeld) {
      const z = zeilen[this.aktiv()];
      if (!z) return;
      ev.preventDefault();
      if (ev.shiftKey) {
        /* Shift: die Kurzansicht am Treffer (T-093) — die Suche bleibt offen. */
        const el = this.host.nativeElement.querySelector<HTMLElement>(`#st-${this.aktiv()}`);
        this.kurz.oeffnen(z.id, el);
        return;
      }
      this.geoeffnet(z);
      this.suche.schliessen(false);
      void this.router.navigate(this.weg(z.id, z.type));
    }
  }
}

import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Audience, AudienceSource } from '@nw/model';
import {
  Api,
  ApiError,
  type SichtArtikel,
  type SichtArtikelAenderung,
  type SichtArtikelFrage,
  type SichtArtikelListe,
  type SichtSpalte,
} from '../kern/api';

/** Die Stufen, wie die Übersicht sie nennt — `campaign` heisst am Tisch „Table". */
const STUFEN: { key: Audience; label: string }[] = [
  { key: 'public', label: 'Public' },
  { key: 'campaign', label: 'Table' },
  { key: 'players', label: 'Players' },
  { key: 'gm', label: 'GM' },
];
const STUFE_NAME = Object.fromEntries(STUFEN.map((s) => [s.key, s.label])) as Record<Audience, string>;
const HERKUNFT: Record<AudienceSource, string> = {
  article: 'own setting',
  campaign: 'campaign rule',
  layer: 'layer default',
  default: 'default',
};
const SEITE = 50;

/**
 * **Jeder Artikel mit seiner Ebene** (T-387, REQ-368) — unter Layers und
 * Visibility der Kampagnenseite. Die Übersicht je Gruppe (T-252) sagt, wie
 * viele Artikel einer Gruppe wer sieht; hier steht jeder einzeln: Ebene mit
 * Herausgeber und Gruppe, die geltende Stufe und woher sie kommt, und wer
 * ihn sieht. Gefiltert, sortiert und gerechnet am Server.
 *
 * **Gesetzt wird ins eigene Feld des Artikels** — je Zeile oder für eine
 * Auswahl (wie in der Galerie): eine Stufe, ↺ zurück zur Gruppe, je
 * Spielende/r zeigen oder verbergen. Was die Leitung nicht schreibt (eine
 * geteilte Ebene), bleibt und sagt warum; wohin das gehört, ist E-162.
 * Die Ebene wechseln geht hier noch nicht (E-161) — am Artikel unter
 * Edit › Layer (T-383).
 */
@Component({
  selector: 'nw-kampagnen-artikel',
  imports: [RouterLink],
  template: `
    <section class="artikel" aria-labelledby="artikel-titel">
      <h2 id="artikel-titel">Articles and their layers</h2>
      <p class="fuss">
        Every article in play with the layer it comes from and who sees it. Set the visibility of one article, or tick
        several and set it for all of them. An article's own setting wins over the rules of its group.
      </p>
      <div class="filter" role="search" aria-label="Filter the articles">
        <input
          type="search"
          aria-label="Search by name"
          placeholder="Search by name"
          [value]="frage().q ?? ''"
          (input)="setze({ q: $any($event.target).value })"
        />
        <select aria-label="Layer" [value]="frage().layer ?? ''" (change)="setze({ layer: $any($event.target).value })">
          <option value="">All layers</option>
          @for (l of liste()?.facets?.layers ?? []; track l.id) {
            <option [value]="l.id">{{ l.name }}{{ l.publisher ? ' · ' + l.publisher : '' }} ({{ l.n }})</option>
          }
        </select>
        <select aria-label="Type" [value]="frage().type ?? ''" (change)="setze({ type: $any($event.target).value })">
          <option value="">All types</option>
          @for (t of liste()?.facets?.types ?? []; track t.key) {
            <option [value]="t.key">{{ t.label }} ({{ t.n }})</option>
          }
        </select>
        <select aria-label="Visibility" [value]="frage().level ?? ''" (change)="setze({ level: $any($event.target).value })">
          <option value="">Any visibility</option>
          @for (s of stufen; track s.key) {
            <option [value]="s.key">{{ s.label }} ({{ liste()?.facets?.levels?.[s.key] ?? 0 }})</option>
          }
        </select>
        <span class="sortieren">
          <select aria-label="Sort by" [value]="frage().sort ?? 'name'" (change)="setze({ sort: $any($event.target).value })">
            <option value="name">Sort: name</option>
            <option value="layer">Sort: layer</option>
            <option value="type">Sort: type</option>
            <option value="level">Sort: visibility</option>
          </select>
          <button
            type="button"
            class="klein"
            [attr.aria-label]="frage().dir === 'desc' ? 'Sort ascending' : 'Sort descending'"
            (click)="setze({ dir: frage().dir === 'desc' ? 'asc' : 'desc' })"
          >
            {{ frage().dir === 'desc' ? '↓' : '↑' }}
          </button>
        </span>
      </div>
      @if (fehler(); as f) {
        <p class="fehler" role="alert">{{ f }}</p>
      }
      @if (meldung(); as m) {
        <p class="meldung" role="status">{{ m }}</p>
      }
      @if (liste(); as d) {
        @if (auswahl().length && darf()) {
          <div class="massen" role="region" aria-label="Selected articles">
            <b>{{ auswahl().length }} selected</b>
            <span class="seg" role="group" aria-label="Visibility for the selection">
              @for (st of stufen; track st.key) {
                <button type="button" [disabled]="laeuft()" (click)="setzen(auswahl(), { audience: st.key })">{{ st.label }}</button>
              }
            </span>
            <button type="button" class="klein" [disabled]="laeuft()" title="Remove their own setting" (click)="setzen(auswahl(), { follow: true })">
              Follow the group
            </button>
            @for (s of spieler(); track s.key) {
              <span class="spielerknoepfe">
                <button type="button" class="klein" [disabled]="laeuft() || !s.bearers?.length" (click)="setzen(auswahl(), { player: { key: s.key, mode: 'show' } })">
                  Show to {{ s.label }}
                </button>
                <button type="button" class="klein" [disabled]="laeuft() || !s.bearers?.length" (click)="setzen(auswahl(), { player: { key: s.key, mode: 'hide' } })">
                  Hide from {{ s.label }}
                </button>
              </span>
            }
            <button type="button" class="leise" (click)="auswahl.set([])">Clear selection</button>
          </div>
        }
        <div class="kopf">
          @if (darf()) {
            <label class="haken">
              <input type="checkbox" [checked]="alleGewaehlt()" (change)="alleUmschalten()" aria-label="Select all shown" />
              all shown
            </label>
          }
          <span class="dim">{{ d.total }} of {{ d.all }} articles</span>
        </div>
        <ul class="zeilen">
          @for (a of d.rows; track a.id) {
            <li class="zeile" [class.gewaehlt]="auswahl().includes(a.id)" [attr.data-id]="a.id">
              @if (darf()) {
                <input
                  class="waehler"
                  type="checkbox"
                  [checked]="auswahl().includes(a.id)"
                  (change)="umschalten(a.id)"
                  [attr.aria-label]="'Select ' + a.name"
                />
              }
              <span class="name">
                <a [routerLink]="['/artikel', a.id]">{{ a.name }}</a>
                <small class="dim">{{ a.typeLabel }}</small>
                <!-- Mehrere Fassungen (T-403): welche Listen zeigen, und „Prefer this version". -->
                @if (a.versions; as v) {
                  <small class="fassung">
                    {{ v.n }} versions ·
                    @if (v.preferred) {
                      preferred
                      @if (darf()) {
                        <button type="button" class="leise" [disabled]="laeuft()" (click)="vorrang(a.id, false)">Stop preferring</button>
                      }
                    } @else if (v.shown) {
                      shown in lists
                    } @else if (darf()) {
                      <button type="button" class="klein" [disabled]="laeuft()" (click)="vorrang(a.id, true)">Prefer this version</button>
                    } @else {
                      not shown
                    }
                  </small>
                }
              </span>
              <span class="ebene">
                @for (l of a.layers; track l.id) {
                  <span class="ebenenmarke" [title]="ebenenTitel(l)">
                    {{ l.name }}
                    @if (l.publisher) {
                      <small class="verlag">{{ l.publisher }}</small>
                    }
                  </span>
                } @empty {
                  <span class="dim">no layer</span>
                }
              </span>
              <span class="stufe">
                <b>{{ stufeName(a.audience) }}</b>
                <small class="dim" [title]="a.rule ? 'Rule: ' + a.rule : ''">{{ herkunft(a) }}</small>
              </span>
              <span class="setzen">
                @if (darf()) {
                  <span class="seg" role="group" [attr.aria-label]="'Visibility of ' + a.name">
                    @for (st of stufen; track st.key) {
                      <button
                        type="button"
                        [attr.aria-pressed]="a.own.audience === st.key"
                        [disabled]="laeuft() || !a.writable"
                        [title]="a.writable ? 'Only this article: ' + st.label : warumNicht(a)"
                        (click)="setzen([a.id], { audience: st.key })"
                      >
                        {{ st.label }}
                      </button>
                    }
                  </span>
                  @if (a.own.audience || a.own.revealedTo || a.own.hiddenFrom) {
                    <button
                      type="button"
                      class="klein leise"
                      [disabled]="laeuft() || !a.writable"
                      title="Follow the group again"
                      [attr.aria-label]="a.name + ': follow the group'"
                      (click)="setzen([a.id], { follow: true })"
                    >
                      ↺
                    </button>
                  }
                }
              </span>
              <span class="wer" aria-label="Who sees it">
                @for (s of d.columns; track s.key) {
                  @if (s.kind === 'player' && darf()) {
                    <button
                      type="button"
                      class="zelle"
                      [class.ja]="a.seenBy.includes(s.key)"
                      [class.eigen]="!!a.players[s.key]"
                      [disabled]="laeuft() || !a.writable || !s.bearers?.length"
                      [title]="spielerTitel(a, s)"
                      [attr.aria-label]="a.name + ', ' + s.label + ': ' + (a.seenBy.includes(s.key) ? 'sees it' : 'does not see it') + '. ' + spielerTitel(a, s)"
                      (click)="spielerUmschalten(a, s)"
                    >
                      {{ s.label }} {{ a.seenBy.includes(s.key) ? '✓' : '—' }}
                    </button>
                  } @else {
                    <span class="zelle" [class.ja]="a.seenBy.includes(s.key)" [title]="s.label + (a.seenBy.includes(s.key) ? ' sees it' : ' does not see it')">
                      {{ s.label }} {{ a.seenBy.includes(s.key) ? '✓' : '—' }}
                    </span>
                  }
                }
              </span>
              @if (darf() && !a.writable) {
                <small class="dim hinweis">{{ warumNicht(a) }}</small>
              }
            </li>
          } @empty {
            <li class="dim">No article matches. Clear a filter above.</li>
          }
        </ul>
        @if (d.rows.length < d.total) {
          <button type="button" class="mehr" [disabled]="laeuft()" (click)="mehr()">Show more ({{ d.total - d.rows.length }} left)</button>
        }
        <p class="fuss">To move an article to another layer, open it and use Edit › Layer.</p>
      } @else if (!fehler()) {
        <p class="fuss">Loading the articles…</p>
      }
    </section>
  `,
  styles: `
    .artikel {
      margin-top: 1rem;
      padding: 0.9rem;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--surface);
    }
    .artikel h2 {
      margin-top: 0;
    }
    .fuss {
      font-size: 0.85rem;
      color: var(--dim);
    }
    .fehler {
      color: var(--accent);
    }
    .meldung {
      color: var(--good, #4c6b2a);
    }
    .dim {
      color: var(--dim);
      font-size: 0.8rem;
    }
    .filter {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      margin-bottom: 0.6rem;
    }
    .filter input,
    .filter select {
      min-height: 36px;
      max-width: 100%;
      flex: 1 1 10rem;
    }
    .sortieren {
      display: inline-flex;
      gap: 0.25rem;
      flex: 1 1 10rem;
    }
    .sortieren select {
      flex: 1;
    }
    .massen {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.4rem;
      padding: 0.5rem;
      margin-bottom: 0.5rem;
      border: 1px solid var(--accent);
      border-radius: 6px;
      background: color-mix(in srgb, var(--accent) 6%, transparent);
    }
    .spielerknoepfe {
      display: inline-flex;
      gap: 0.25rem;
    }
    .fassung {
      display: inline-flex;
      flex-wrap: wrap;
      gap: 0.3rem;
      align-items: center;
      font-size: 0.75rem;
      color: var(--dim);
    }
    .kopf {
      display: flex;
      align-items: center;
      gap: 0.8rem;
      margin-bottom: 0.3rem;
    }
    .haken {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      min-height: 36px;
    }
    .zeilen {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .zeile {
      display: grid;
      grid-template-columns: auto minmax(10rem, 1.4fr) minmax(8rem, 1fr) minmax(7rem, 0.8fr) auto;
      grid-template-areas:
        'wahl name ebene stufe setzen'
        'wahl wer wer wer wer'
        'wahl hinweis hinweis hinweis hinweis';
      align-items: center;
      gap: 0.25rem 0.6rem;
      padding: 0.45rem 0.2rem;
      border-bottom: 1px solid var(--line);
    }
    .zeile.gewaehlt {
      background: color-mix(in srgb, var(--accent) 6%, transparent);
    }
    .waehler {
      grid-area: wahl;
      width: 22px;
      height: 22px;
    }
    .name {
      grid-area: name;
      display: flex;
      flex-direction: column;
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .ebene {
      grid-area: ebene;
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem;
      min-width: 0;
    }
    .ebenenmarke {
      display: inline-flex;
      align-items: baseline;
      gap: 0.3rem;
      padding: 0 0.4rem;
      border: 1px solid var(--line);
      border-radius: 4px;
      font-size: 0.85rem;
      overflow-wrap: anywhere;
    }
    .verlag {
      color: var(--magic, #6b3d75);
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .stufe {
      grid-area: stufe;
      display: flex;
      flex-direction: column;
    }
    .setzen {
      grid-area: setzen;
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
    }
    .wer {
      grid-area: wer;
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem;
    }
    .hinweis {
      grid-area: hinweis;
    }
    .seg {
      display: inline-flex;
      flex-wrap: wrap;
      border: 1px solid var(--line);
      border-radius: 6px;
      overflow: hidden;
    }
    .seg button {
      min-height: 32px;
      padding: 0 0.45rem;
      border: 0;
      border-right: 1px solid var(--line);
      border-radius: 0;
      background: none;
      font-size: 0.8rem;
      font-weight: 700;
    }
    .seg button:last-child {
      border-right: 0;
    }
    .seg button[aria-pressed='true'] {
      background: var(--accent);
      color: var(--surface, #fbf6ec);
    }
    .zelle {
      display: inline-block;
      min-height: 28px;
      padding: 0 0.4rem;
      border: 1px solid transparent;
      border-radius: 4px;
      background: none;
      font: inherit;
      font-size: 0.78rem;
      line-height: 26px;
      color: var(--dim);
    }
    .zelle.ja {
      background: color-mix(in srgb, var(--good, #4c6b2a) 14%, transparent);
      color: var(--good, #4c6b2a);
      font-weight: 700;
    }
    .zelle.eigen {
      border-color: var(--magic, #6b3d75);
    }
    button.zelle:not(:disabled) {
      cursor: pointer;
    }
    .mehr {
      margin-top: 0.5rem;
      min-height: 36px;
    }
    @media (max-width: 760px) {
      .zeile {
        grid-template-columns: auto 1fr auto;
        grid-template-areas:
          'wahl name stufe'
          'wahl ebene ebene'
          'wahl setzen setzen'
          'wahl wer wer'
          'wahl hinweis hinweis';
      }
      .stufe {
        text-align: right;
      }
    }
  `,
})
export class KampagnenArtikel {
  readonly kampagne = input.required<string>();
  /** Wonach die Liste zuerst sortiert: unter Layers nach Ebene, unter Visibility nach Name. */
  readonly sortierung = input<'name' | 'layer'>('name');

  private readonly api = inject(Api);

  protected readonly stufen = STUFEN;
  protected readonly nichtSchreibbar =
    'In a layer you do not write — set it for its group above, or edit the article to make your own version.';
  protected readonly liste = signal<SichtArtikelListe | null>(null);
  protected readonly frage = signal<SichtArtikelFrage>({});
  protected readonly auswahl = signal<string[]>([]);
  protected readonly fehler = signal<string | null>(null);
  protected readonly meldung = signal<string | null>(null);
  protected readonly laeuft = signal(false);
  private zeit: ReturnType<typeof setTimeout> | null = null;
  private lauf = 0;

  constructor() {
    effect(() => {
      const c = this.kampagne();
      const sort = this.sortierung();
      untracked(() => {
        this.frage.set({ sort });
        void this.laden(c);
      });
    });
  }

  protected readonly darf = computed(() => this.liste()?.may === 'manage');
  protected readonly spieler = computed(() => (this.liste()?.columns ?? []).filter((s) => s.kind === 'player'));
  protected readonly alleGewaehlt = computed(() => {
    const rows = this.liste()?.rows ?? [];
    const a = new Set(this.auswahl());
    return rows.length > 0 && rows.every((r) => a.has(r.id));
  });

  /** Ein Filter ändert sich: die Suche wartet kurz, alles andere lädt sofort. */
  protected setze(teil: Partial<SichtArtikelFrage>): void {
    this.frage.set({ ...this.frage(), ...teil });
    if (this.zeit) clearTimeout(this.zeit);
    const c = this.kampagne();
    if ('q' in teil) this.zeit = setTimeout(() => void this.laden(c), 250);
    else void this.laden(c);
  }

  private async laden(c: string, anhaengen = false): Promise<void> {
    const nr = ++this.lauf;
    const offset = anhaengen ? (this.liste()?.rows.length ?? 0) : 0;
    try {
      const d = await this.api.campaignVisibilityArticles(c, { ...this.frage(), offset, limit: SEITE });
      if (nr !== this.lauf) return;
      if (anhaengen && this.liste()) d.rows = [...this.liste()!.rows, ...d.rows];
      this.liste.set(d);
      this.fehler.set(null);
    } catch (e) {
      if (nr !== this.lauf) return;
      this.fehler.set(e instanceof ApiError ? e.message : 'Could not load the articles.');
    }
  }

  protected mehr(): void {
    void this.laden(this.kampagne(), true);
  }

  protected umschalten(id: string): void {
    const a = this.auswahl();
    this.auswahl.set(a.includes(id) ? a.filter((x) => x !== id) : [...a, id]);
  }

  protected alleUmschalten(): void {
    const ids = (this.liste()?.rows ?? []).map((r) => r.id);
    if (this.alleGewaehlt()) this.auswahl.set(this.auswahl().filter((x) => !ids.includes(x)));
    else this.auswahl.set([...new Set([...this.auswahl(), ...ids])]);
  }

  /** Warum eine Zeile gesperrt ist: eine fremde Ebene, oder gar keine — die gehört der Verwaltung. */
  protected warumNicht(a: SichtArtikel): string {
    return a.layers.length ? this.nichtSchreibbar : 'Outside every layer — only the administration changes it, or set it for its group above.';
  }

  protected stufeName(a: Audience): string {
    return STUFE_NAME[a] ?? a;
  }

  protected herkunft(a: SichtArtikel): string {
    const teile = [HERKUNFT[a.source]];
    if (a.own.revealedTo) teile.push(`revealed to ${a.own.revealedTo}`);
    if (a.own.hiddenFrom) teile.push(`hidden from ${a.own.hiddenFrom}`);
    return teile.join(' · ');
  }

  protected ebenenTitel(l: SichtArtikel['layers'][number]): string {
    const g = l.groups.map((x) => x.name).join(', ');
    return [l.name, l.publisher && `publisher: ${l.publisher}`, g && `group: ${g}`].filter(Boolean).join(' · ');
  }

  protected spielerTitel(a: SichtArtikel, s: SichtSpalte): string {
    if (!s.bearers?.length) return `${s.label} plays no character yet`;
    if (!a.writable) return this.warumNicht(a);
    const p = a.players[s.key];
    return `click: ${p === 'hide' ? `${s.label} follows the visibility again` : p === 'show' ? `hide from ${s.label}` : `show to ${s.label}`}`;
  }

  /** Klick auf eine Spielerzelle: zeigen → verbergen → der Stufe folgen, wie in der Übersicht je Gruppe. */
  protected spielerUmschalten(a: SichtArtikel, s: SichtSpalte): void {
    const p = a.players[s.key];
    const mode = p === 'hide' ? 'follow' : p === 'show' ? 'hide' : 'show';
    void this.setzen([a.id], { player: { key: s.key, mode } });
  }

  protected async setzen(ids: string[], aenderung: SichtArtikelAenderung): Promise<void> {
    if (!ids.length) return;
    this.laeuft.set(true);
    this.fehler.set(null);
    try {
      const r = await this.api.setArticleVisibility(this.kampagne(), ids, aenderung);
      const teile = [`${r.done.length} changed`];
      if (r.unchanged.length) teile.push(`${r.unchanged.length} already so`);
      if (r.refused.length) {
        const erst = r.refused[0]!;
        teile.push(`${r.refused.length} not changed (${erst.name}: ${erst.error})`);
      }
      this.meldung.set(teile.join(', ') + '.');
      /* Die Auswahl bleibt: eine Stufe setzen und danach einer Spielerin
         zeigen sind zwei Schritte an denselben Artikeln. */
      const n = this.liste()?.rows.length ?? SEITE;
      const d = await this.api.campaignVisibilityArticles(this.kampagne(), { ...this.frage(), offset: 0, limit: Math.max(SEITE, Math.min(200, n)) });
      this.liste.set(d);
    } catch (e) {
      this.fehler.set(e instanceof ApiError ? e.message : 'That did not work.');
    } finally {
      this.laeuft.set(false);
    }
  }

  /** Vorrang (T-403): diese Fassung vor den anderen — an der Kampagne, kein Buch wird beschrieben. */
  protected async vorrang(id: string, an: boolean): Promise<void> {
    this.laeuft.set(true);
    this.fehler.set(null);
    try {
      if (an) await this.api.prefer(this.kampagne(), id);
      else await this.api.unprefer(this.kampagne(), id);
      this.meldung.set(an ? 'Preferred: lists and links now show this version.' : 'No longer preferred: the layer order decides again.');
      await this.laden(this.kampagne());
    } catch (e) {
      this.fehler.set(e instanceof ApiError ? e.message : 'That did not work.');
    } finally {
      this.laeuft.set(false);
    }
  }
}

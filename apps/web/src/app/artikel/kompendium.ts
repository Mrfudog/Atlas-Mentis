import { Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { plainText } from '@nw/model';
import { Api, type ListenFrage, type Liste, type ListenZeile } from '../kern/api';
import { QuelleText } from '../kern/quellen';
import { Bestand } from '../kern/bestand';
import { Session } from '../kern/session';
import { BEREICHE, bereichLabel } from '../kern/bereiche';
import { ListenFilter } from '../kern/filter';
import { AusgeblendetHinweis } from '../kern/ausgeblendet';
import { KurzLink } from '../kern/kurzansicht';
import { Anlegen } from './anlegen';
import { Vorschau } from './vorschau';
import { Bild } from './bild';

interface TypGruppe {
  label: string;
  typen: { typ: string; label: string; anzahl: number }[];
}

/** So viele Zeilen je Blatt. */
const BLATT = 50;
/** So viele Werte einer Aufzählung stehen offen; der Rest klappt auf. */
const OFFEN = 8;

/**
 * Das Kompendium und die Bereiche — eine Seite, wie auf dem Design-Canvas
 * (`Compendium.dc.html`, Vorschau nach `Main.dc.html`): links die Filter,
 * in der Mitte die Tabelle, rechts die Vorschau der angeklickten Zeile.
 *
 * **Fassungen derselben Sache stehen als eine Zeile** (T-092, E-021 d):
 * Kopf ist die aus der obersten Spielebene, die übrigen klappen darunter
 * auf, je mit Ebene und Quelle.
 *
 * **Gerechnet wird am Server** (`GET /api/list`, W7): Suche, Arten mit
 * Zahl, Ebenen, Feldfilter und das Blatt. Bis zum 13.10. lud diese Seite
 * die Kurzfassung aller 24 157 Artikel und rechnete hier — jetzt kommt ein
 * Blatt mit 50 Zeilen und den Facetten, rund ein bis zwei Kilobyte gepackt.
 *
 * Ein Bereich (`world`, `story`, `rules`) ist das Kompendium, eingeschränkt
 * auf die Arten, deren `area` dorthin zeigt — das sagt der Server
 * (`areaOf`). Welche Spalten eine Art zeigt und wonach sie sich filtern
 * lässt, sagt ihre `overview` (`listColumns`); im Code steht nichts davon.
 *
 * Der Server hat schon gesiebt; hier wird nichts zurückgehalten.
 */
@Component({
  selector: 'nw-kompendium',
  imports: [RouterLink, Vorschau, Anlegen, AusgeblendetHinweis, QuelleText, KurzLink, Bild],
  template: `
    <div class="seite" [class.mitvorschau]="!!filter.vorschau()">
      <aside class="filter" [class.offen]="filterOffen()" aria-label="Filters">
        <label class="suche">
          <span class="leg">Search</span>
          <input
            type="search"
            placeholder="Name, alias or ID…"
            [value]="filter.suche()"
            (input)="suchen($any($event.target).value)"
          />
        </label>

        <fieldset>
          <legend class="leg">Type</legend>
          @for (g of sichtbareGruppen(); track g.label) {
            @if (sichtbareGruppen().length > 1) {
              <span class="gruppe">{{ g.label }}</span>
            }
            @for (t of g.typen; track t.typ) {
              <a
                [routerLink]="[]"
                [queryParams]="{ type: type() === t.typ ? null : t.typ }"
                class="typ"
                [class.an]="type() === t.typ"
                [attr.aria-current]="type() === t.typ ? 'true' : null"
                >{{ t.label }} <span>{{ t.anzahl }}</span></a
              >
            }
          } @empty {
            @if (liste()) {
              <span class="leer">No types here yet.</span>
            }
          }
          @if (type() && typGruppen().length) {
            <button type="button" class="mehr" (click)="typenOffen.set(!typenOffen())">
              {{ typenOffen() ? 'Only ' + typLabel(type()!) : 'All types' }}
            </button>
          }
        </fieldset>

        @for (f of liste()?.facets?.fields ?? []; track f.ref) {
          <fieldset>
            <legend class="leg">{{ f.label }}</legend>
            @if (f.kind === 'enum') {
              @for (o of offeneWerte(f.ref, f.options); track o.value) {
                <label class="haken">
                  <input
                    type="checkbox"
                    [checked]="gewaehlt(f.ref, o.value)"
                    (change)="wertUmschalten(f.ref, o.value)"
                  />
                  {{ o.value }} <span class="zahl">{{ o.count }}</span>
                </label>
              }
              @if (f.options.length > OFFEN) {
                <button type="button" class="mehr" (click)="aufklappen(f.ref)">
                  {{ aufgeklappt().has(f.ref) ? 'Fewer' : f.options.length - OFFEN + ' more' }}
                </button>
              }
            } @else {
              <div class="spanne">
                <input
                  type="number"
                  inputmode="decimal"
                  [attr.aria-label]="f.label + ' from'"
                  [placeholder]="f.min"
                  [value]="filter.felder()[f.ref]?.min ?? ''"
                  (change)="spanne(f.ref, 'min', $any($event.target).value)"
                />
                <span aria-hidden="true">–</span>
                <input
                  type="number"
                  inputmode="decimal"
                  [attr.aria-label]="f.label + ' to'"
                  [placeholder]="f.max"
                  [value]="filter.felder()[f.ref]?.max ?? ''"
                  (change)="spanne(f.ref, 'max', $any($event.target).value)"
                />
              </div>
            }
          </fieldset>
        }

        @if (ebenen().length > 1) {
          <fieldset>
            <legend class="leg">Where from</legend>
            @for (l of ebenen(); track l.id) {
              <label class="haken">
                <input
                  type="checkbox"
                  [checked]="!filter.ohneEbenen().has(l.id)"
                  (change)="ebeneUmschalten(l.id)"
                />
                {{ l.name }} <span class="zahl">{{ l.count }}</span>
                <!-- Eine Ebene ist ein Artikel: ihre Karte, ohne das Häkchen zu setzen (T-093). -->
                <button type="button" class="quick-info" [nwQuick]="l.id" [attr.aria-label]="'Quick view of ' + l.name">i</button>
              </label>
            }
          </fieldset>
        }

        @if ((liste()?.facets?.partsHidden ?? 0) > 0 || filter.teile()) {
          <label class="haken teile">
            <input type="checkbox" [checked]="filter.teile()" (change)="teileUmschalten()" />
            Show statblock parts
            @if (!filter.teile()) {
              <span class="zahl">{{ liste()?.facets?.partsHidden }}</span>
            }
          </label>
        }
      </aside>

      <main class="haupt">
        <div class="kopf">
          <div>
            <h1>{{ titel() }}</h1>
            <span class="unter">{{ unterzeile() }}</span>
          </div>
          <div class="chips">
            @if (type(); as t) {
              <span class="chip"
                >{{ typLabel(t) }}
                <a [routerLink]="[]" [queryParams]="{ type: null }" aria-label="Remove type filter"
                  >×</a
                ></span
              >
            }
            @if (filter.suche()) {
              <span class="chip"
                >“{{ filter.suche() }}”
                <button type="button" aria-label="Clear search" (click)="suchen('')">×</button></span
              >
            }
            @for (c of feldChips(); track c.ref) {
              <span class="chip"
                >{{ c.text }}
                <button type="button" [attr.aria-label]="'Remove ' + c.text" (click)="feldWeg(c.ref)">×</button></span
              >
            }
            @if (session.darfRegister()) {
              @if (type(); as t) {
                <a class="knopf" routerLink="/registry" [queryParams]="{ type: t }">Edit type</a>
              }
              <a class="knopf" routerLink="/registry" [queryParams]="{ create: 1, from: type() ?? null }">New type</a>
            }
            @if (session.darfAnlegen()) {
              <button type="button" class="pri" (click)="anlegenOffen.set(true)">New article</button>
            }
            <button type="button" class="nurklein" (click)="filterOffen.set(!filterOffen())">
              {{ filterOffen() ? 'Hide filters' : 'Filters' }}
            </button>
          </div>
        </div>

        @if (fehler(); as f) {
          <p class="fehler" role="alert">{{ f }}</p>
        }

        <nw-ausgeblendet [info]="liste()?.unactivated" (geaendert)="neuFragen()" />

        @if (!liste()) {
          <p class="leer">Loading…</p>
        } @else {
          <div class="tabelle" [class.laedt]="laedt()">
            <table>
              <thead>
                <tr>
                  <th [attr.aria-sort]="ariaSort('name')">
                    <button type="button" class="sort" (click)="sortiere('name')">Name{{ pfeil('name') }}</button>
                  </th>
                  @if (!type()) {
                    <th [attr.aria-sort]="ariaSort('type')">
                      <button type="button" class="sort" (click)="sortiere('type')">Type{{ pfeil('type') }}</button>
                    </th>
                  }
                  @for (c of liste()!.columns; track c.ref) {
                    <th [attr.aria-sort]="ariaSort(c.ref)" [class.zahlspalte]="c.kind === 'number'">
                      <button type="button" class="sort" (click)="sortiere(c.ref)">{{ c.label }}{{ pfeil(c.ref) }}</button>
                    </th>
                  }
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                @for (z of liste()!.rows; track z.id) {
                  <tr [class.gewaehlt]="filter.vorschau() === z.id" (click)="zeile(z, $event)">
                    <td class="name">
                      <!-- Das Vorschaubild, wenn die Übersicht der Art eines zeigt (T-114). -->
                      @if (z.image) {
                        <nw-bild class="daumen" [wert]="z.image" groesse="thumb" [oeffnen]="false" alt="" />
                      }
                      <a [routerLink]="zielVon(z)" (click)="link(z, $event)">{{ z.name }}</a>
                      <!-- Am Telefon führt die Zeile gleich zum Artikel; die Karte
                           zeigt dieser Knopf (T-093). -->
                      <button type="button" class="quick-info zeilen-info" [nwQuick]="z.id" [attr.aria-label]="'Quick view of ' + z.name">i</button>
                      @if (z.status && z.status !== 'ready') {
                        <span class="stand">{{ z.status }}</span>
                      }
                      @if ((z.users ?? 0) > 1) {
                        <span class="stand" title="Statblocks using this">used by {{ z.users }}</span>
                      } @else if (z.users === 1 && filter.teile()) {
                        <span class="stand">part</span>
                      }
                      @if (z.versions?.length) {
                        <button
                          type="button"
                          class="fassungen"
                          [attr.aria-expanded]="fassungenOffen().has(z.id)"
                          [attr.aria-label]="(fassungenOffen().has(z.id) ? 'Hide' : 'Show') + ' the other versions of ' + z.name"
                          (click)="fassungenZeigen(z.id, $event)"
                        >
                          {{ fassungenOffen().has(z.id) ? '▾' : '▸' }} {{ z.versions!.length + 1 }} versions
                        </button>
                      }
                    </td>
                    @if (!type()) {
                      <td>{{ typLabel(z.type) }}</td>
                    }
                    @for (c of liste()!.columns; track c.ref) {
                      <td [class.zahlspalte]="c.kind === 'number'">{{ zelle(z.cols[c.ref], c.kind) }}</td>
                    }
                    <td class="dim quelle">
                      @if (z.source) {
                        <nw-quelle [text]="z.source" />
                      } @else {
                        {{ z.layers.join(', ') }}
                      }
                    </td>
                  </tr>
                  @if (fassungenOffen().has(z.id)) {
                    @for (v of z.versions ?? []; track v.id) {
                      <tr class="unter" [class.gewaehlt]="filter.vorschau() === v.id" (click)="zeile({ id: v.id, type: z.type }, $event)">
                        <td class="name">
                          <a [routerLink]="zielVon({ id: v.id, type: z.type })" (click)="link({ id: v.id, type: z.type }, $event)">{{ v.name }}</a>
                        </td>
                        <td [attr.colspan]="spaltenZahl() - 2" class="dim">{{ v.layers.join(', ') }}</td>
                        <td class="dim quelle">
                          @if (v.source) {
                            <nw-quelle [text]="v.source" />
                          } @else {
                            {{ v.layers.join(', ') }}
                          }
                        </td>
                      </tr>
                    }
                  }
                } @empty {
                  <tr>
                    <td [attr.colspan]="spaltenZahl()" class="leer">Nothing here.</td>
                  </tr>
                }
              </tbody>
            </table>
            @if (blaetter() > 1) {
              <div class="fuss">
                <button type="button" [disabled]="blatt() === 0" (click)="blaettern(-1)">‹ Previous</button>
                <span>Page {{ blatt() + 1 }} of {{ blaetter() }}</span>
                <button type="button" [disabled]="blatt() + 1 >= blaetter()" (click)="blaettern(1)">
                  Next ›
                </button>
              </div>
            }
          </div>
        }
      </main>

      @if (filter.vorschau(); as v) {
        <div class="rechts">
          <nw-vorschau [id]="v" (zu)="filter.vorschau.set(null)" />
        </div>
      }
    </div>

    @if (anlegenOffen()) {
      <nw-anlegen [bereich]="bereich()" [vorgabe]="type()" (zu)="anlegenOffen.set(false)" />
    }
  `,
  styleUrl: './kompendium.scss',
})
export class Kompendium {
  /** Aus den Routendaten: `world`, `story`, `rules` — oder keiner (Kompendium). */
  readonly bereich = input<string | undefined>(undefined);
  /** Aus der Adresse (`?type=`). */
  readonly type = input<string | undefined>(undefined);

  protected readonly OFFEN = OFFEN;
  protected readonly bestand = inject(Bestand);
  protected readonly session = inject(Session);
  protected readonly filter = inject(ListenFilter);
  private readonly api = inject(Api);
  private readonly router = inject(Router);

  protected readonly filterOffen = signal(false);
  protected readonly anlegenOffen = signal(false);
  protected readonly aufgeklappt = signal<ReadonlySet<string>>(new Set());
  protected readonly liste = signal<Liste | null>(null);
  protected readonly laedt = signal(false);
  protected readonly fehler = signal<string | null>(null);

  private lauf = 0;
  private uhr: ReturnType<typeof setTimeout> | null = null;
  private letzteSuche = '';

  constructor() {
    /* Das Register braucht die Seite nur für Beschriftungen und den
       Anlegen-Dialog; die Liste wartet nicht darauf. */
    void this.bestand.load();
    effect(() => {
      this.filter.betrete(this.bereich() ?? 'compendium');
      /* Auf einen Typwechsel folgt Blatt 1: auf Blatt 40 der Zauber zu
         landen, nachdem man eben noch durch Gegenstände blätterte, ist keine
         Absicht. Zurück vom Artikel bleibt das Blatt, denn die Art ist
         dieselbe. */
      this.filter.typ(this.type());
      untracked(() => this.typenOffen.set(false));
    });
    /* Jede Änderung am Filter fragt den Server. Getippt wird mit einer
       kurzen Pause, sonst ginge je Buchstabe eine Anfrage hinaus. */
    effect(() => {
      const frage = this.frage();
      untracked(() => {
        const getippt = (frage.q ?? '') !== this.letzteSuche;
        this.letzteSuche = frage.q ?? '';
        if (this.uhr) clearTimeout(this.uhr);
        if (getippt && this.liste()) this.uhr = setTimeout(() => void this.hole(frage), 220);
        else void this.hole(frage);
      });
    });
    inject(DestroyRef).onDestroy(() => {
      if (this.uhr) clearTimeout(this.uhr);
    });
  }

  /** Was gefragt wird — aus Adresse und Filterzustand. */
  private readonly frage = computed<ListenFrage>(() => {
    const felder = this.filter.felder();
    const f: string[] = [];
    for (const [ref, w] of Object.entries(felder)) {
      if (w.values?.length) f.push(`${ref}:${w.values.join('|')}`);
      else if (w.min !== undefined || w.max !== undefined) f.push(`${ref}:${w.min ?? ''}..${w.max ?? ''}`);
    }
    return {
      area: this.bereich(),
      type: this.type(),
      q: this.filter.suche().trim() || undefined,
      nolayer: [...this.filter.ohneEbenen()],
      parts: this.filter.teile(),
      /* Fassungen derselben Sache als eine Zeile (T-092, E-021 d). */
      versions: true,
      sort: this.filter.sortierung() || undefined,
      offset: this.filter.blatt() * BLATT,
      limit: BLATT,
      f,
    };
  });

  private async hole(frage: ListenFrage): Promise<void> {
    const nr = ++this.lauf;
    this.laedt.set(true);
    try {
      const r = await this.api.list(frage);
      /* Eine ältere Antwort, die nach einer neueren ankommt, gilt nicht. */
      if (nr !== this.lauf) return;
      this.liste.set(r);
      this.fehler.set(null);
    } catch (error) {
      if (nr === this.lauf) this.fehler.set(error instanceof Error ? error.message : String(error));
    } finally {
      if (nr === this.lauf) this.laedt.set(false);
    }
  }

  /** Nach dem Aufschalten einer Ebene (T-069): dieselbe Frage noch einmal. */
  protected neuFragen(): void {
    void this.hole(this.frage());
  }

  protected readonly titel = computed(() => bereichLabel(this.bereich()) ?? 'Compendium');

  protected readonly unterzeile = computed(() => {
    const l = this.liste();
    if (!l) return '';
    const t = this.type();
    const was = t ? this.typLabel(t) : 'articles';
    return `${l.total.toLocaleString('en')} ${was} · sorted by ${this.sortLabel()}`;
  });

  private sortLabel(): string {
    const s = this.filter.sortierung().replace(/^-/, '') || 'name';
    if (s === 'name') return 'name';
    if (s === 'type') return 'type';
    return this.liste()?.columns.find((c) => c.ref === s)?.label.toLowerCase() ?? s;
  }

  protected typLabel(typ: string): string {
    return (
      this.bestand.registry()?.interfaces[typ]?.label ??
      this.liste()?.facets.types.find((t) => t.type === typ)?.label ??
      typ
    );
  }

  /** Die Arten mit Zahl — nach Bereich gruppiert, wenn kein Bereich gewählt ist. */
  protected readonly typGruppen = computed<TypGruppe[]>(() => {
    const typen = this.liste()?.facets.types ?? [];
    const gruppen = new Map<string, TypGruppe['typen']>();
    for (const t of typen) {
      const g = this.bereich() ? '' : t.area;
      if (!gruppen.has(g)) gruppen.set(g, []);
      gruppen.get(g)!.push({ typ: t.type, label: t.label, anzahl: t.count });
    }
    const reihe = [...BEREICHE.map((b) => b.weg), ''];
    return [...gruppen.entries()]
      .sort(([a], [b]) => reihe.indexOf(a) - reihe.indexOf(b))
      .map(([g, ts]) => ({
        label: bereichLabel(g) ?? 'Other',
        typen: ts.sort((a, b) => a.label.localeCompare(b.label, 'en')),
      }));
  });

  /**
   * Mit einer gewählten Art steht nur sie da, bis jemand „All types" sagt:
   * sonst stünden die Filter der Art unter vierundzwanzig anderen Arten,
   * und am Telefon fände sie niemand.
   */
  protected readonly typenOffen = signal(false);
  protected readonly sichtbareGruppen = computed<TypGruppe[]>(() => {
    const t = this.type();
    if (!t || this.typenOffen()) return this.typGruppen();
    return this.typGruppen()
      .map((g) => ({ ...g, typen: g.typen.filter((x) => x.typ === t) }))
      .filter((g) => g.typen.length);
  });

  protected readonly ebenen = computed(() => this.liste()?.facets.layers ?? []);

  protected readonly blatt = computed(() => this.filter.blatt());
  protected readonly blaetter = computed(() => Math.ceil((this.liste()?.total ?? 0) / BLATT));
  protected readonly spaltenZahl = computed(
    () => 2 + (this.type() ? 0 : 1) + (this.liste()?.columns.length ?? 0),
  );

  /** Die Feldfilter als Chips über der Tabelle. */
  protected readonly feldChips = computed(() => {
    const spalten = this.liste()?.facets.fields ?? [];
    return Object.entries(this.filter.felder()).map(([ref, w]) => {
      const label = spalten.find((s) => s.ref === ref)?.label ?? ref.split('.')[1] ?? ref;
      const text = w.values?.length
        ? `${label}: ${w.values.join(', ')}`
        : `${label} ${w.min ?? '…'}–${w.max ?? '…'}`;
      return { ref, text };
    });
  });

  protected zelle(wert: unknown, art: string): string {
    if (wert === undefined || wert === null) return '';
    if (art === 'bool' || typeof wert === 'boolean') return wert ? '✓' : '';
    /* Ein Verweis im Text (`[[feat-0088|Initiate of High Sorcery]]`, M11)
       steht in der Zelle als sein Name, ein Würfel als Ausdruck — die
       Spalte ist Text und kein Markdown (T-090). */
    if (Array.isArray(wert)) return wert.map((w) => (typeof w === 'string' ? plainText(w) : String(w))).join(', ');
    if (typeof wert === 'object') return JSON.stringify(wert);
    return typeof wert === 'string' ? plainText(wert) : String(wert);
  }

  protected offeneWerte<T>(ref: string, werte: T[]): T[] {
    return this.aufgeklappt().has(ref) ? werte : werte.slice(0, OFFEN);
  }
  protected aufklappen(ref: string): void {
    this.aufgeklappt.update((s) => {
      const n = new Set(s);
      if (n.has(ref)) n.delete(ref);
      else n.add(ref);
      return n;
    });
  }
  protected gewaehlt(ref: string, wert: string): boolean {
    return this.filter.felder()[ref]?.values?.includes(wert) ?? false;
  }

  protected wertUmschalten(ref: string, wert: string): void {
    this.filter.felder.update((f) => {
      const alt = f[ref]?.values ?? [];
      const neu = alt.includes(wert) ? alt.filter((w) => w !== wert) : [...alt, wert];
      const { [ref]: _weg, ...rest } = f;
      return neu.length ? { ...rest, [ref]: { values: neu } } : rest;
    });
    this.filter.blatt.set(0);
  }

  protected spanne(ref: string, seite: 'min' | 'max', roh: string): void {
    const n = roh.trim() === '' ? undefined : Number(roh);
    this.filter.felder.update((f) => {
      const alt = { ...(f[ref] ?? {}) };
      delete alt.values;
      if (n === undefined || !Number.isFinite(n)) delete alt[seite];
      else alt[seite] = n;
      const { [ref]: _weg, ...rest } = f;
      return alt.min !== undefined || alt.max !== undefined ? { ...rest, [ref]: alt } : rest;
    });
    this.filter.blatt.set(0);
  }

  protected feldWeg(ref: string): void {
    this.filter.felder.update((f) => {
      const { [ref]: _weg, ...rest } = f;
      return rest;
    });
    this.filter.blatt.set(0);
  }

  protected suchen(q: string): void {
    this.filter.suche.set(q);
    this.filter.blatt.set(0);
  }
  protected ebeneUmschalten(id: string): void {
    this.filter.ohneEbenen.update((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
    this.filter.blatt.set(0);
  }
  protected teileUmschalten(): void {
    this.filter.teile.update((t) => !t);
    this.filter.blatt.set(0);
  }
  protected blaettern(um: number): void {
    this.filter.blatt.set(Math.max(0, this.blatt() + um));
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
  }

  /** Ein Klick auf den Kopf sortiert danach; ein zweiter kehrt um. */
  protected sortiere(nach: string): void {
    const jetzt = this.filter.sortierung() || 'name';
    this.filter.sortierung.set(jetzt === nach ? `-${nach}` : nach === 'name' ? '' : nach);
    this.filter.blatt.set(0);
  }
  protected pfeil(nach: string): string {
    const s = this.filter.sortierung() || 'name';
    return s === nach ? ' ↑' : s === `-${nach}` ? ' ↓' : '';
  }
  protected ariaSort(nach: string): string | null {
    const s = this.filter.sortierung() || 'name';
    return s === nach ? 'ascending' : s === `-${nach}` ? 'descending' : null;
  }

  /** Welche Zeilen ihre Fassungen zeigen (T-092). */
  protected readonly fassungenOffen = signal(new Set<string>());
  protected fassungenZeigen(id: string, ev: MouseEvent): void {
    ev.stopPropagation();
    const s = new Set(this.fassungenOffen());
    if (s.has(id)) s.delete(id);
    else s.add(id);
    this.fassungenOffen.set(s);
  }

  /**
   * Eine Zeile anklicken zeigt die Vorschau rechts (`quick`); „Open" darin
   * führt zum Artikel. Am Telefon ist neben der Tabelle kein Platz — dort
   * führt die Zeile gleich hin.
   */
  protected zeile(z: Pick<ListenZeile, 'id' | 'type'>, ev: MouseEvent): void {
    if ((ev.target as HTMLElement | null)?.closest('a')) return;
    if (this.schmal()) {
      void this.router.navigate(this.zielVon(z));
      return;
    }
    this.filter.vorschau.set(this.filter.vorschau() === z.id ? null : z.id);
  }
  /** Wohin eine Zeile führt: eine Klasse hat ihre eigene Ansicht (W6). */
  protected zielVon(z: Pick<ListenZeile, 'id' | 'type'>): string[] {
    return z.type === 'Class' ? ['/classes', z.id] : ['/artikel', z.id];
  }
  /** Der Name ist ein echter Link (Mittelklick, neuer Reiter); ein schlichter Klick zeigt die Vorschau. */
  protected link(z: Pick<ListenZeile, 'id' | 'type'>, ev: MouseEvent): void {
    if (ev.button !== 0 || ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.altKey || this.schmal()) return;
    ev.preventDefault();
    this.filter.vorschau.set(z.id);
  }
  private schmal(): boolean {
    return typeof window !== 'undefined' && window.matchMedia?.('(max-width: 1100px)').matches === true;
  }
}

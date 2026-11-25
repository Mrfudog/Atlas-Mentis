import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Api, type Facette, type ListenZeile } from '../kern/api';
import { Quellen } from '../kern/quellen';
import { HERKUNFT_WEG } from './ansicht-weg';

/** Die Facetten, nach denen die Liste filtert — je Art, in dieser Reihenfolge. */
const FILTER: Record<string, string[]> = {
  Ancestry: ['Source.publication', 'Ancestry.size', 'Ancestry.creatureType'],
  Background: ['Source.publication'],
};

/** Ein Regelstand: eine Gruppe von Ebenen, deren Name ihn nennt (T-166). */
interface Regelstand {
  name: string;
  ebenen: string[];
}

/**
 * **Herkünfte oder Hintergründe auf einen Blick** (T-166) — wie die
 * Klassenliste, dazu Filter. Die Häkchen sind die Facetten der Liste am
 * Server (T-174, `f=Typ.feld:Wert`), gezählt über das, was der
 * Betrachter sieht; eine eigene Liste der Grössen oder Quellen gibt es
 * hier nicht.
 *
 * **Der Regelstand ist eine Ebenengruppe** („D&D 5e (2014)", „2024
 * rules"): gefiltert wird über ihre Mitglieder (`layer=`), wie der
 * Stapel sie kennt. Ein Feld „Regelstand" am Artikel gibt es nicht — es
 * wäre die zweite Stelle neben der Ebene.
 *
 * Spielarten (`subraceOf`) stehen auf der Seite ihrer Herkunft und nicht
 * in der Liste. Die Auswahl steht in der Adresse (`?f=…&rules=…`).
 */
@Component({
  selector: 'nw-herkuenfte',
  imports: [RouterLink],
  template: `
    <div class="buch">
      <nav aria-label="Breadcrumb" class="brot">
        <a routerLink="/rules">Rules</a>
        <span aria-hidden="true">›</span>
        <span>{{ titel() }}</span>
      </nav>
      <h1>{{ titel() }}</h1>
      <div class="filter">
        <input
          type="search"
          class="suche"
          placeholder="Filter by name…"
          [attr.aria-label]="'Filter ' + titel().toLowerCase() + ' by name'"
          [value]="suche()"
          (input)="suche.set($any($event.target).value)"
        />
        @if (regelstaende().length) {
          <div class="chips" role="group" aria-label="Filter by rules version">
            <span class="dim">Rules</span>
            @for (r of regelstaende(); track r.name) {
              <button
                type="button"
                class="chip"
                [class.an]="rules() === r.name"
                [attr.aria-pressed]="rules() === r.name"
                (click)="regelstand(rules() === r.name ? null : r.name)"
              >
                {{ r.name }}
              </button>
            }
          </div>
        }
        @for (f of facetten(); track f.ref) {
          <div class="chips" role="group" [attr.aria-label]="'Filter by ' + f.label">
            <span class="dim">{{ f.label }}</span>
            @for (o of f.options; track o.value) {
              <button
                type="button"
                class="chip"
                [class.an]="an(f.ref, o.value)"
                [attr.aria-pressed]="an(f.ref, o.value)"
                [title]="f.ref === 'Source.publication' ? quellTitel(o.value) : ''"
                (click)="umschalten(f.ref, o.value)"
              >
                {{ o.label }} <span class="dim">{{ o.count }}</span>
              </button>
            }
          </div>
        }
      </div>
      @if (!geladen()) {
        <p class="dim">Loading…</p>
      } @else if (fehler(); as f) {
        <p class="fehler" role="alert">{{ f }}</p>
      } @else {
        <ul class="kacheln">
          @for (k of kacheln(); track k.id) {
            <li>
              <a [routerLink]="['/artikel', k.id]">
                <span class="name">{{ k.name }}</span>
                <span class="quelle" [title]="quellTitel(k.quelle)">{{ k.quelle }}</span>
                @if (k.spielarten) {
                  <span class="dim zahl">{{ k.spielarten }} variant{{ k.spielarten > 1 ? 's' : '' }}</span>
                }
              </a>
            </li>
          } @empty {
            <li class="dim">Nothing matches.</li>
          }
        </ul>
      }
    </div>
  `,
  styles: `
    .buch {
      max-width: 1240px;
      margin: 0 auto;
      padding: 1.25rem 1.5rem 3rem;
    }
    .brot {
      display: flex;
      gap: 0.5rem;
      color: var(--dim);
      font-size: 0.9rem;
    }
    h1 {
      margin: 0.5rem 0 0.75rem;
      font-family: var(--caps);
      font-size: 2.5rem;
      color: var(--heading);
    }
    .filter {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      margin-bottom: 1rem;
    }
    .suche {
      max-width: 20rem;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.3rem;
    }
    .chips > .dim:first-child {
      min-width: 6.5rem;
    }
    .chip {
      border: 1px solid var(--line2);
      background: var(--paper);
      color: var(--ink);
      border-radius: 999px;
      padding: 0.1rem 0.6rem;
      font-size: 0.85rem;
      cursor: pointer;
    }
    .chip.an {
      background: var(--heading);
      border-color: var(--heading);
      color: var(--paper);
    }
    .chip.an .dim {
      color: inherit;
    }
    .kacheln {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
      gap: 0.6rem;
    }
    .kacheln a {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: baseline;
      gap: 0.1rem 0.5rem;
      padding: 0.75rem 1rem;
      background: var(--paper);
      border-top: 3px solid var(--gold);
      border-radius: 0 0 6px 6px;
      box-shadow: 0 1px 4px rgba(43, 29, 18, 0.2);
      color: var(--ink);
      text-decoration: none;
    }
    .kacheln a:hover {
      background: var(--hover);
    }
    .name {
      font-family: var(--caps);
      font-size: 1.15rem;
      font-weight: 700;
      color: var(--heading);
    }
    .zahl {
      flex-basis: 100%;
    }
    .quelle,
    .dim {
      color: var(--dim);
      font-size: 0.85rem;
    }
    .fehler {
      color: var(--warn);
    }
    @media (max-width: 560px) {
      .buch {
        padding: 1rem;
      }
      .chips > .dim:first-child {
        min-width: 100%;
      }
    }
  `,
})
export class Herkuenfte {
  /** Die Art aus der Route (`data.art`): `Ancestry` oder `Background`. */
  readonly art = input<string>('Ancestry');
  /** `?f=Typ.feld:Wert` — gewählte Facetten, wie die Liste am Server sie liest. */
  readonly f = input<string | string[] | undefined>();
  /** `?rules=<Name der Gruppe>` — der Regelstand. */
  readonly rules = input<string | undefined>();

  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly quellenTitel = inject(Quellen);

  private readonly zeilen = signal<ListenZeile[]>([]);
  private readonly rohFacetten = signal<Facette[]>([]);
  protected readonly regelstaende = signal<Regelstand[]>([]);
  protected readonly geladen = signal(false);
  protected readonly fehler = signal<string | null>(null);
  protected readonly suche = signal('');

  protected readonly titel = computed(() => HERKUNFT_WEG[this.art()]?.liste ?? this.art());

  /** Die gewählten Facetten als `ref → Werte`. */
  private readonly gewaehlt = computed(() => {
    const roh = this.f();
    const l = Array.isArray(roh) ? roh : roh ? [roh] : [];
    const m = new Map<string, Set<string>>();
    for (const x of l) {
      const i = x.indexOf(':');
      if (i > 0) m.set(x.slice(0, i), new Set(x.slice(i + 1).split('|').filter(Boolean)));
    }
    return m;
  });

  constructor() {
    void this.ladeRegelstaende();
    effect(() => {
      const art = this.art();
      const f = this.gewaehlt();
      const r = this.regelstaende().find((x) => x.name === this.rules());
      untracked(() => void this.lade(art, f, r));
    });
  }

  /**
   * Die Gruppen, die einen Regelstand nennen („2014", „2024"), mit ihren
   * Mitgliedern — zwei Fragen an die Liste, keine Zeile im Code.
   */
  private async ladeRegelstaende(): Promise<void> {
    try {
      const gruppen = await this.api.list({ type: 'Layer', f: ['Layer.kind:group'], limit: 200 });
      const mit = gruppen.rows.filter((g) => /\b20\d\d\b/.test(g.name));
      const out = await Promise.all(
        mit.map(async (g) => ({
          name: g.name,
          ebenen: (await this.api.list({ type: 'Layer', f: [`out.partOf:${g.id}`], limit: 1000 })).rows.map((r) => r.id),
        })),
      );
      this.regelstaende.set(out.filter((r) => r.ebenen.length).sort((a, b) => a.name.localeCompare(b.name)));
    } catch {
      /* Ohne Regelstände bleibt die Liste ungefiltert — kein Grund, sie nicht zu zeigen. */
    }
  }

  private lauf = 0;
  private async lade(art: string, f: Map<string, Set<string>>, r: Regelstand | undefined): Promise<void> {
    const nr = ++this.lauf;
    this.fehler.set(null);
    try {
      const liste = await this.api.list({
        type: art,
        limit: 1000,
        rel: ['subraceOf'],
        f: [...f.entries()].map(([ref, w]) => `${ref}:${[...w].join('|')}`),
        layer: r?.ebenen,
      });
      if (nr !== this.lauf) return;
      this.zeilen.set(liste.rows);
      const wanted = FILTER[art] ?? [];
      this.rohFacetten.set(
        wanted
          .map((ref) => liste.facets.fields.find((x) => x.ref === ref))
          .filter((x): x is Facette => !!x && x.kind === 'enum' && x.options.length > 1),
      );
    } catch (e) {
      if (nr === this.lauf) this.fehler.set(e instanceof Error ? e.message : String(e));
    } finally {
      if (nr === this.lauf) this.geladen.set(true);
    }
  }

  protected readonly facetten = computed(() =>
    this.rohFacetten().map((f) =>
      f.kind === 'enum'
        ? { ...f, options: f.options.map((o) => ({ ...o, label: o.label ?? (f.ref === 'Ancestry.size' ? o.value[0]!.toUpperCase() + o.value.slice(1) : o.value) })) }
        : f,
    ) as Extract<Facette, { kind: 'enum' }>[],
  );

  /** Herkünfte ohne Spielarten in der Kachel; eine Spielart steht auf der Seite ihrer Herkunft. */
  protected readonly kacheln = computed(() => {
    const s = this.suche().trim().toLowerCase();
    const zeilen = this.zeilen();
    const zahl = new Map<string, number>();
    for (const z of zeilen) for (const o of z.rels?.['subraceOf'] ?? []) zahl.set(o, (zahl.get(o) ?? 0) + 1);
    const ids = new Set(zeilen.map((z) => z.id));
    return zeilen
      /* Eine Spielart, deren Herkunft nicht mit in der Auswahl steht, bleibt
         sichtbar — sonst verschwände sie mit einem Filter ganz. */
      .filter((z) => !(z.rels?.['subraceOf'] ?? []).some((o) => ids.has(o)))
      .filter((z) => !s || z.name.toLowerCase().includes(s))
      .map((z) => ({ id: z.id, name: z.name, quelle: z.source.split(' p. ')[0] ?? '', spielarten: zahl.get(z.id) ?? 0 }))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  protected an(ref: string, wert: string): boolean {
    return this.gewaehlt().get(ref)?.has(wert) ?? false;
  }
  protected quellTitel(kuerzel: string): string {
    return this.quellenTitel.titel(kuerzel);
  }

  protected umschalten(ref: string, wert: string): void {
    const m = new Map([...this.gewaehlt()].map(([k, v]) => [k, new Set(v)]));
    const w = m.get(ref) ?? new Set<string>();
    if (w.has(wert)) w.delete(wert);
    else w.add(wert);
    if (w.size) m.set(ref, w);
    else m.delete(ref);
    const f = [...m.entries()].map(([k, v]) => `${k}:${[...v].join('|')}`);
    void this.router.navigate([], { queryParams: { f: f.length ? f : null }, queryParamsHandling: 'merge', replaceUrl: true });
  }
  protected regelstand(name: string | null): void {
    void this.router.navigate([], { queryParams: { rules: name }, queryParamsHandling: 'merge', replaceUrl: true });
  }
}

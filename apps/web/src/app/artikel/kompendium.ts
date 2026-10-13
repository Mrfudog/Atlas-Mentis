import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { areaOf, entityName, isInstance, LAYER_RELATION, primaryInterface } from '@nw/model';
import type { Entity, Registry } from '@nw/model';
import { Bestand } from '../kern/bestand';
import { BEREICHE, bereichLabel } from '../kern/bereiche';
import { ListenFilter } from '../kern/filter';

interface Zeile {
  e: Entity;
  name: string;
  typ: string;
  typLabel: string;
  ebenen: string[];
  quelle: string;
  stand: string;
}

interface TypGruppe {
  label: string;
  typen: { typ: string; label: string; anzahl: number }[];
}

/** So viele Zeilen je Blatt. 24 157 auf einmal hält den Browser auf und liest niemand. */
const BLATT = 100;

/**
 * Das Kompendium und die Bereiche — eine Seite, wie auf dem Design-Canvas:
 * links die Filter, rechts die Tabelle.
 *
 * Ein Bereich (`world`, `history`, `rules`) ist das Kompendium,
 * eingeschränkt auf die Arten, deren `area` dorthin zeigt (`areaOf`). Im
 * Code steht keine Liste, welche Art wohin gehört.
 *
 * Gelesen wird aus der **Kurzfassung** (`summaryOf`): Name, Art, Ebenen,
 * Quelle, Stand. Spalten je Art (Grad und Schule bei Zaubern, HG bei
 * Statblocks) brauchen Felder, die die Kurzfassung nicht trägt — die kommen,
 * wenn eine Art sagen kann, welche Felder ihre Zeile zeigt.
 *
 * Der Server hat schon gesiebt; hier wird nichts zurückgehalten.
 */
@Component({
  selector: 'nw-kompendium',
  imports: [RouterLink],
  template: `
    <div class="seite">
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
          @for (g of typGruppen(); track g.label) {
            @if (typGruppen().length > 1) {
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
            <span class="leer">No types here yet.</span>
          }
        </fieldset>

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
                {{ l.name }} <span class="zahl">{{ l.anzahl }}</span>
              </label>
            }
          </fieldset>
        }
      </aside>

      <main class="haupt">
        <div class="kopf">
          <div>
            <h1>{{ titel() }}</h1>
            <span class="unter">{{ gefiltert().length }} of {{ imBereich().length }}</span>
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
            <button type="button" class="nurklein" (click)="filterOffen.set(!filterOffen())">
              {{ filterOffen() ? 'Hide filters' : 'Filters' }}
            </button>
          </div>
        </div>

        @if (bestand.fehler(); as f) {
          <p class="fehler" role="alert">{{ f }}</p>
        }

        @if (!bestand.geladen()) {
          <p class="leer">Loading…</p>
        } @else {
          <div class="tabelle">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Where from</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                @for (z of blattZeilen(); track z.e.id) {
                  <tr>
                    <td class="name">
                      <a [routerLink]="z.typ === 'Class' ? ['/classes', z.e.id] : ['/artikel', z.e.id]">{{ z.name }}</a>
                      @if (z.stand && z.stand !== 'ready') {
                        <span class="stand">{{ z.stand }}</span>
                      }
                    </td>
                    <td>{{ z.typLabel }}</td>
                    <td class="dim">{{ z.ebenen.join(', ') }}</td>
                    <td class="dim">{{ z.quelle }}</td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="4" class="leer">Nothing here.</td>
                  </tr>
                }
              </tbody>
            </table>
            @if (blaetter() > 1) {
              <div class="fuss">
                <button type="button" [disabled]="blatt() === 0" (click)="blaettern(-1)">‹ Previous</button>
                <span>Page {{ blatt() + 1 }} of {{ blaetter() }}</span>
                <button
                  type="button"
                  [disabled]="blatt() + 1 >= blaetter()"
                  (click)="blaettern(1)"
                >
                  Next ›
                </button>
              </div>
            }
          </div>
        }
      </main>
    </div>
  `,
  styleUrl: './kompendium.scss',
})
export class Kompendium {
  /** Aus den Routendaten: `world`, `history`, `rules` — oder keiner (Kompendium). */
  readonly bereich = input<string | undefined>(undefined);
  /** Aus der Adresse (`?type=`). */
  readonly type = input<string | undefined>(undefined);

  protected readonly bestand = inject(Bestand);
  protected readonly filter = inject(ListenFilter);
  protected readonly filterOffen = signal(false);

  constructor() {
    void this.bestand.load();
    effect(() => {
      this.filter.betrete(this.bereich() ?? 'compendium');
      /* Auf einen Typwechsel folgt Blatt 1: auf Blatt 40 der Zauber zu
         landen, nachdem man eben noch durch Gegenstände blätterte, ist keine
         Absicht. Zurück vom Artikel bleibt das Blatt, denn die Art ist
         dieselbe. */
      this.filter.typ(this.type());
    });
  }

  protected readonly titel = computed(() => bereichLabel(this.bereich()) ?? 'Compendium');

  private readonly reg = computed<Registry | null>(() => this.bestand.registry());

  /** Bereich je Art, einmal gerechnet — `areaOf` läuft die `extends`-Kette hoch. */
  private readonly bereichVon = computed(() => {
    const r = this.reg();
    const m = new Map<string, string>();
    return (typ: string): string => {
      if (!r) return '';
      let b = m.get(typ);
      if (b === undefined) {
        b = areaOf(r, typ);
        m.set(typ, b);
      }
      return b;
    };
  });

  protected typLabel(typ: string): string {
    return this.reg()?.interfaces[typ]?.label ?? typ;
  }

  /** Die Zeilen des Bereichs, ohne Instanzen (sie stehen an ihrer Kreatur, D82). */
  protected readonly imBereich = computed<Zeile[]>(() => {
    const b = this.bereich();
    const bereichVon = this.bereichVon();
    const byId = this.bestand.byId();
    const out: Zeile[] = [];
    for (const e of this.bestand.entities()) {
      if (isInstance(e)) continue;
      const typ = primaryInterface(e);
      if (b && bereichVon(typ) !== b) continue;
      const quelle = e.components?.['Source'] as { publication?: string; page?: string } | undefined;
      out.push({
        e,
        name: entityName(e),
        typ,
        typLabel: this.typLabel(typ),
        ebenen: (e.relations ?? [])
          .filter((r) => r.type === LAYER_RELATION)
          .map((r) => entityName(byId.get(r.to)) || r.to),
        quelle: [quelle?.publication, quelle?.page ? `p. ${quelle.page}` : '']
          .filter(Boolean)
          .join(' '),
        stand: String((e.components?.['Status'] as { status?: string } | undefined)?.status ?? ''),
      });
    }
    return out.sort((a, z) => a.name.localeCompare(z.name, 'en'));
  });

  /** Gesucht wird über Name, Alias und Nummer — am Tisch fällt der Deckname. */
  private readonly gesucht = computed<Zeile[]>(() => {
    const q = this.filter.suche().trim().toLocaleLowerCase();
    const ohne = this.filter.ohneEbenen();
    return this.imBereich().filter((z) => {
      if (ohne.size && ebenenSchluessel(z.e).every((l) => ohne.has(l))) return false;
      if (!q) return true;
      if (z.name.toLocaleLowerCase().includes(q)) return true;
      const id = z.e.components?.['Identity'] as { id?: string; aliases?: string[] } | undefined;
      if (id?.id?.toLocaleLowerCase().includes(q)) return true;
      return (id?.aliases ?? []).some((a) => String(a).toLocaleLowerCase().includes(q));
    });
  });

  protected readonly gefiltert = computed<Zeile[]>(() => {
    const t = this.type();
    return t ? this.gesucht().filter((z) => z.typ === t) : this.gesucht();
  });

  /** Die Arten mit Zahl — gezählt nach Suche und Ebenen, vor der Art selbst. */
  protected readonly typGruppen = computed<TypGruppe[]>(() => {
    const zaehler = new Map<string, number>();
    for (const z of this.gesucht()) zaehler.set(z.typ, (zaehler.get(z.typ) ?? 0) + 1);
    const t = this.type();
    if (t && !zaehler.has(t)) zaehler.set(t, 0);
    const bereichVon = this.bereichVon();
    const gruppen = new Map<string, TypGruppe['typen']>();
    for (const [typ, anzahl] of zaehler) {
      const g = this.bereich() ? '' : bereichVon(typ);
      if (!gruppen.has(g)) gruppen.set(g, []);
      gruppen.get(g)!.push({ typ, label: this.typLabel(typ), anzahl });
    }
    const reihe = [...BEREICHE.map((b) => b.weg), ''];
    return [...gruppen.entries()]
      .sort(([a], [b]) => reihe.indexOf(a) - reihe.indexOf(b))
      .map(([g, typen]) => ({
        label: bereichLabel(g) ?? 'Other',
        typen: typen.sort((a, b) => a.label.localeCompare(b.label, 'en')),
      }));
  });

  /** Die Ebenen, aus denen die Artikel dieses Bereichs kommen — und „keine". */
  protected readonly ebenen = computed(() => {
    const byId = this.bestand.byId();
    const zaehler = new Map<string, number>();
    for (const z of this.imBereich()) {
      for (const l of ebenenSchluessel(z.e)) zaehler.set(l, (zaehler.get(l) ?? 0) + 1);
    }
    return [...zaehler.entries()]
      .map(([id, anzahl]) => ({
        id,
        anzahl,
        name: id === KEINE ? 'No layer' : entityName(byId.get(id)) || id,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'en'));
  });

  protected readonly blatt = computed(() =>
    Math.min(this.filter.blatt(), Math.max(0, this.blaetter() - 1)),
  );
  protected readonly blaetter = computed(() => Math.ceil(this.gefiltert().length / BLATT));
  protected readonly blattZeilen = computed(() =>
    this.gefiltert().slice(this.blatt() * BLATT, (this.blatt() + 1) * BLATT),
  );

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
  protected blaettern(um: number): void {
    this.filter.blatt.set(this.blatt() + um);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
  }

}

/** Ein Artikel ohne Ebenenkante steht unter „keine". */
const KEINE = '∅';
function ebenenSchluessel(e: Entity): string[] {
  const l = (e.relations ?? []).filter((r) => r.type === LAYER_RELATION).map((r) => r.to);
  return l.length ? l : [KEINE];
}

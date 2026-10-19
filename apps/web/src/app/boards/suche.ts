import {
  Component,
  DestroyRef,
  type ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { areaOf, entityName, placementGroups, primaryInterface, typeChain, typeList } from '@nw/model';
import type { Entity } from '@nw/model';
import { Bestand, schmal } from '../kern/bestand';
import { AusgeblendetHinweis } from '../kern/ausgeblendet';
import type { Ausgeblendet } from '../kern/api';
import { Session } from '../kern/session';
import { Schnell, anlegbareArten, type Angelegt } from '../artikel/schnell';

/** So viele Treffer zeigt die Suche — 24 157 liest niemand. */
const TREFFER = 30;

/**
 * Einen Artikel aufs Board legen: suchen oder blättern und anklicken.
 * Gefragt wird die Liste am Server (`/api/list`, W7) nach Name, Alias und
 * Nummer, wahlweise auf eine Art eingeschränkt; ganz geholt wird ein Artikel
 * erst, wenn er auf dem Board liegt. Instanzen stehen in keiner Liste, also
 * auch nicht hier, und was schon daliegt, nicht noch einmal.
 *
 * **Ohne Suchwort steht schon etwas da** (die ersten Artikel der Art, oder
 * alle nach Name). Ein leeres Feld hinter „Add article" sah aus, als gäbe es
 * nichts zum Ablegen — übrig blieb die Seitenleiste mit Kampagne und Ebene.
 * Und ein Fehler am Server ist ein Fehler, kein „Nothing matches".
 */
@Component({
  selector: 'nw-board-suche',
  imports: [AusgeblendetHinweis, Schnell],
  template: `
    <div class="zeile">
      <input
        #feld
        type="search"
        placeholder="Search articles by name…"
        [value]="suche()"
        (input)="tippen($any($event.target).value)"
        aria-label="Search articles"
      />
      <select [value]="art()" (change)="artWaehlen($any($event.target).value)" aria-label="Only this type">
        <option value="">All types</option>
        @for (t of arten(); track t.name) {
          <option [value]="t.name" [selected]="t.name === art()">{{ t.label }}</option>
        }
      </select>
    </div>
    @if (fehler(); as f) {
      <p class="fehler" role="alert">The search failed: {{ f }}</p>
    } @else {
      <ul>
        @if (gruppieren()) {
          <!-- Auf der Karte (T-301): je Name eine Zeile, vorn das Relevanteste
               — Kreatur, Statblock, Bild —, die übrigen hinter „+n". -->
          @for (g of gruppen(); track g.key) {
            <li>
              <div class="gruppe">
                <button type="button" (click)="gewaehlt.emit(g.best)">
                  <b>{{ name(g.best) }}</b>
                  <span>{{ artLabel(g.best) }}</span>
                </button>
                @if (g.others.length) {
                  <button
                    type="button"
                    class="mehr"
                    (click)="umschalten(g.key)"
                    [attr.aria-expanded]="offen().has(g.key)"
                    [attr.aria-label]="(offen().has(g.key) ? 'Hide' : 'Show') + ' ' + g.others.length + ' more for ' + name(g.best)"
                  >
                    {{ offen().has(g.key) ? '−' : '+' + g.others.length }}
                  </button>
                }
              </div>
              @if (offen().has(g.key)) {
                <ul class="andere">
                  @for (o of g.others; track o.id) {
                    <li>
                      <button type="button" (click)="gewaehlt.emit(o)">
                        <b>{{ name(o) }}</b>
                        <span>{{ artLabel(o) }}</span>
                      </button>
                    </li>
                  }
                </ul>
              }
            </li>
          } @empty {
            <li class="leer">{{ laedt() ? 'Searching…' : 'Nothing matches — or it is already on the map.' }}</li>
          }
        } @else {
        @for (t of treffer(); track t.id) {
          <li>
            <button type="button" (click)="gewaehlt.emit(t)">
              <b>{{ name(t) }}</b>
              <span>{{ artLabel(t) }}</span>
            </button>
          </li>
        } @empty {
          <li class="leer">{{ laedt() ? 'Searching…' : 'Nothing matches — or it is already on the board.' }}</li>
        }
        }        <!-- Was es noch nicht gibt, gleich anlegen und hinlegen (T-131). -->
        @if (suche().trim() && !laedt() && anlegbar()) {
          <li class="neu">
            <button type="button" (click)="schnell.set(suche().trim())">
              <b>Create “{{ suche().trim() }}”</b>
              <span>as {{ art() ? artLabelVon(art()) : '…' }}</span>
            </button>
          </li>
        }
      </ul>
      @if (mehr() > 0) {
        <p class="leer">{{ mehr() }} more — narrow the search or pick a type.</p>
      }
      <nw-ausgeblendet [info]="ausgeblendet()" [knapp]="true" />
    }
    @if (schnell(); as name) {
      <nw-schnell
        [vorschlag]="name"
        [ziele]="art() ? [art()] : []"
        [vorgabe]="art() || undefined"
        (angelegt)="eingetragen($event)"
        (zu)="schnell.set(null)"
      />
    }
  `,
  styles: `
    :host {
      display: block;
      margin: 0.75rem 0 0;
      padding: 0.75rem;
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 6px;
    }
    .zeile {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    input {
      flex: 1 1 14rem;
      min-width: 0;
      min-height: 40px;
      padding: 0 0.6rem;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--paper);
    }
    ul {
      margin: 0.5rem 0 0;
      padding: 0;
      list-style: none;
      max-height: 16rem;
      overflow-y: auto;
    }
    button {
      display: flex;
      width: 100%;
      justify-content: space-between;
      gap: 1rem;
      border: 0;
      border-radius: 4px;
      background: none;
      text-align: left;
    }
    button:hover,
    button:focus-visible {
      background: var(--hover);
    }
    .gruppe {
      display: flex;
      gap: 0.25rem;
    }
    .gruppe > button:first-child {
      flex: 1;
      min-width: 0;
    }
    .gruppe .mehr {
      flex: none;
      width: auto;
      min-width: 2.75rem;
      justify-content: center;
      border: 1px solid var(--line);
    }
    .andere {
      margin: 0 0 0.25rem 1rem;
      max-height: none;
      border-left: 2px solid var(--line);
      padding-left: 0.5rem;
    }
    select {
      flex: 0 1 12rem;
      min-height: 40px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--paper);
    }
    span,
    .leer {
      color: var(--dim);
    }
    .leer {
      margin: 0.5rem 0 0;
    }
    .neu {
      border-top: 1px solid var(--line);
    }
    .neu b {
      color: var(--accent);
      font-style: italic;
    }
    .fehler {
      margin: 0.5rem 0 0;
      color: var(--accent, #8b1a1a);
    }
  `,
})
export class BoardSuche {
  /** Was nicht angeboten wird: das Board selbst und was schon daraufliegt. */
  readonly ohne = input<ReadonlySet<string>>(new Set());
  readonly gewaehlt = output<Entity>();

  private readonly bestand = inject(Bestand);
  private readonly session = inject(Session);
  /** Das offene „Create"-Popup (T-131): der getippte Name. */
  protected readonly schnell = signal<string | null>(null);
  private readonly feld = viewChild<ElementRef<HTMLInputElement>>('feld');
  protected readonly suche = signal('');
  protected readonly art = signal('');
  protected readonly fehler = signal<string | null>(null);
  protected readonly laedt = signal(false);
  private readonly gefunden = signal<Entity[]>([]);
  private readonly gesamt = signal(0);
  /** Was nur fehlt, weil seine Ebene nicht aufgeschaltet ist (T-069). */
  protected readonly ausgeblendet = signal<Ausgeblendet | null>(null);
  private lauf = 0;
  private uhr: ReturnType<typeof setTimeout> | null = null;

  /** Die Arten, die man anlegen kann und die einen Bereich haben — wie die Leiste. */
  protected readonly arten = computed(() => {
    const r = this.bestand.registry();
    if (!r) return [];
    return typeList(r)
      .filter((n) => !r.interfaces[n]?.abstract && areaOf(r, n))
      .map((n) => ({ name: n, label: r.interfaces[n]?.label ?? n }));
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.uhr) clearTimeout(this.uhr);
    });
    /* Wer „Add article" drückt, will tippen. */
    afterNextRender(() => this.feld()?.nativeElement.focus());
    this.fragen();
  }

  /** Gefragt wird nach einer kurzen Pause, nicht bei jedem Buchstaben. */
  protected tippen(q: string): void {
    this.suche.set(q);
    if (this.uhr) clearTimeout(this.uhr);
    this.uhr = setTimeout(() => this.fragen(), 200);
  }

  protected artWaehlen(t: string): void {
    this.art.set(t);
    this.fragen();
  }

  protected fragen(): void {
    const nr = ++this.lauf;
    this.laedt.set(true);
    const q = this.suche().trim();
    void this.bestand
      .liste({ q: q || undefined, type: this.art() || undefined, limit: TREFFER + 10 })
      .then((r) => {
        if (nr !== this.lauf) return;
        this.fehler.set(null);
        this.gefunden.set(r.rows.map(schmal));
        this.gesamt.set(r.total);
        this.ausgeblendet.set(r.unactivated ?? null);
      })
      .catch((e: unknown) => {
        if (nr === this.lauf) this.fehler.set(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (nr === this.lauf) this.laedt.set(false);
      });
  }

  /** Gruppieren nach Name (T-301) — die Karte will das Wesen, nicht drei Fassungen davon. */
  readonly gruppieren = input(false);
  protected readonly offen = signal<ReadonlySet<string>>(new Set());
  protected readonly gruppen = computed(() => {
    const r = this.bestand.registry();
    const ohne = this.ohne();
    const zeilen = this.gefunden()
      .filter((e) => !ohne.has(e.id))
      .map((e) => ({ id: e.id, name: entityName(e), type: primaryInterface(e), e }));
    return placementGroups(zeilen, (t) => (r ? typeChain(r, t) : [t]))
      .slice(0, TREFFER)
      .map((g) => ({ key: g.key, best: g.best.e, others: g.others.map((o) => o.e) }));
  });
  protected umschalten(key: string): void {
    const n = new Set(this.offen());
    if (n.has(key)) n.delete(key);
    else n.add(key);
    this.offen.set(n);
  }

  protected readonly treffer = computed(() => {
    const ohne = this.ohne();
    return this.gefunden()
      .filter((e) => !ohne.has(e.id))
      .slice(0, TREFFER);
  });

  /** Was die Liste noch hätte — gesagt, damit niemand meint, das sei alles. */
  protected readonly mehr = computed(() => Math.max(0, this.gesamt() - this.gefunden().length));

  /** Lässt sich hier überhaupt etwas anlegen — in der gewählten Art oder irgendeiner? */
  protected readonly anlegbar = computed(() => {
    const r = this.bestand.registry();
    return !!r && anlegbareArten(r, this.art() ? [this.art()] : [], !this.session.isAdmin()).length > 0;
  });

  /** Der neue Artikel liegt sofort da (T-131); das Popup bleibt für „Open". */
  protected eingetragen(a: Angelegt): void {
    this.gewaehlt.emit(a.entity);
    this.fragen();
  }

  protected artLabelVon(t: string): string {
    return this.bestand.registry()?.interfaces[t]?.label ?? t;
  }

  protected name(e: Entity): string {
    return entityName(e);
  }
  protected artLabel(e: Entity): string {
    const typ = primaryInterface(e);
    return this.bestand.registry()?.interfaces[typ]?.label ?? typ;
  }
}

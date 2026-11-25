import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { campaignDecisions, type CampaignDecision, type RuleSortState } from '@nw/model';
import { Api, ApiError, type KampagnenEbenen, type Mitglied } from '../kern/api';

/** Wohin „Change" führt: ein Reiter der Kampagnenseite, bei Regeln die Stelle darin. */
export type Aenderungsort = CampaignDecision['change'];

/** Wie lange auf das Ziel gewartet wird: Rules & options lädt auf dev gut zweieinhalb Sekunden. */
const SPRUNG_WARTEN_MS = 15_000;
const SPRUNG_TAKT_MS = 100;

/**
 * **An die Stelle springen** (T-141): das Ziel steht erst da, wenn der
 * Reiter geladen hat — also nachsehen, bis es da ist, und nach einer Weile
 * aufgeben, statt viel später unvermittelt zu springen.
 */
export function springeZu(id: string): void {
  let versuche = Math.ceil(SPRUNG_WARTEN_MS / SPRUNG_TAKT_MS);
  const suchen = () => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ block: 'start' });
    else if (--versuche > 0) setTimeout(suchen, SPRUNG_TAKT_MS);
  };
  setTimeout(suchen, 0);
}

/**
 * **Der Kampagnenmanager** (T-141): die Entscheidungen der Kampagne als
 * Liste — Ebenen, Vergleichsebenen, Mitglieder und jede Regel —, je Zeile
 * der Stand, „Change" an den Ort, an dem genau diese Entscheidung neu
 * getroffen wird, und was das bewirkt. Jederzeit offen, ohne das Anlegen
 * noch einmal zu durchlaufen.
 *
 * Gerechnet wird mit `campaignDecisions` aus dem, was die Reiter ohnehin
 * holen (`…/layers`, `…/rules`, die Mitglieder der Seite); geändert wird
 * dort, wo es heute schon geht — eine zweite Maske für dieselbe Wahl wäre
 * die, die auseinanderläuft.
 */
@Component({
  selector: 'nw-kampagnen-entscheidungen',
  template: `
    <section class="kasten" aria-label="Decisions">
      <h2>Decisions</h2>
      <p class="fuss">
        Everything this campaign has decided, one row each. “Change” opens the place where just that decision is made again;
        the line below says what a change does.
      </p>
      @if (fehler(); as f) {
        <p class="fehler" role="alert">{{ f }}</p>
      }
      @if (laedt() && !zeilen().length) {
        <p class="dim">Loading…</p>
      }
      @for (g of gruppen(); track g.name) {
        <h3>{{ g.name }}</h3>
        <ul class="liste">
          @for (z of g.zeilen; track z.key) {
            <li class="entscheidung" [attr.data-key]="z.key" [class.offen]="z.state === 'open'">
              <div class="zeile">
                <span class="name">{{ z.label }}</span>
                <span class="wert">
                  @if (z.value) {
                    {{ z.value }}
                  } @else if (z.state === 'default') {
                    <i>none</i>
                  } @else {
                    <i>not decided</i>
                  }
                </span>
                <span class="stand" [class]="'stand ' + z.state">{{ STAND[z.state] }}</span>
                @if (z.installation) {
                  <span class="marke" title="Changed by the administration, for every campaign">installation</span>
                }
                <button type="button" class="knopf" (click)="aendern.emit(z.change)" [attr.aria-label]="'Change ' + z.label">
                  {{ darfSchreiben() && !z.installation ? 'Change' : 'Show' }}
                </button>
              </div>
              <p class="folge">{{ z.consequence }}</p>
            </li>
          }
        </ul>
      }
    </section>
  `,
  styles: `
    /* Wie die übrigen Kästen der Kampagnenseite (geschichte.ts). */
    .kasten {
      min-width: 0;
      margin: 0 1.5rem 1rem;
      padding: 0.9rem;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--surface);
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }
    @media (max-width: 640px) {
      .kasten {
        margin: 0 1rem 1rem;
      }
    }
    h2 {
      margin: 0 0 0.25rem;
      font-family: var(--caps);
      font-size: 1.25rem;
      color: var(--accent);
    }
    h3 {
      margin: 0.6rem 0 0;
      font-family: var(--caps);
      font-size: 1.05rem;
    }
    .fuss,
    .folge {
      margin: 0;
      font-size: 0.82rem;
      color: var(--dim);
    }
    .liste {
      list-style: none;
      margin: 0.25rem 0 0;
      padding: 0;
    }
    li {
      padding: 0.4rem 0;
      border-top: 1px solid var(--line2);
      overflow-wrap: anywhere;
    }
    li:first-child {
      border-top: 0;
    }
    .zeile {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.25rem 0.6rem;
    }
    .name {
      font-weight: 600;
      min-width: 10rem;
    }
    .wert {
      flex: 1 1 12rem;
      min-width: 0;
    }
    .stand,
    .marke {
      font-size: 0.75rem;
      padding: 0 0.4rem;
      border: 1px solid var(--line);
      border-radius: 999px;
      color: var(--dim);
    }
    .stand.open {
      color: var(--accent);
      border-color: var(--accent);
    }
    .knopf {
      min-height: 32px;
      margin-left: auto;
    }
    .dim {
      color: var(--dim);
    }
    .fehler {
      color: var(--accent);
    }
  `,
})
export class KampagnenEntscheidungen {
  readonly kampagne = input.required<string>();
  /** Die Mitglieder, wie die Seite sie schon hat. */
  readonly mitglieder = input<readonly Mitglied[]>([]);
  /** Ob dieses Konto hier ändert (Leitung, Verwaltung) — sonst heisst der Knopf „Show". */
  readonly darfSchreiben = input(false);
  readonly aendern = output<Aenderungsort>();

  private readonly api = inject(Api);
  protected readonly STAND: Record<CampaignDecision['state'], string> = { set: 'decided', default: 'default', open: 'open' };
  protected readonly laedt = signal(false);
  protected readonly fehler = signal<string | null>(null);
  private readonly ebenen = signal<KampagnenEbenen | null>(null);
  private readonly regeln = signal<RuleSortState[]>([]);

  constructor() {
    effect(() => {
      const c = this.kampagne();
      untracked(() => void this.laden(c));
    });
  }

  private async laden(c: string): Promise<void> {
    this.laedt.set(true);
    this.fehler.set(null);
    /* Beide für sich: wer die Ebenen nicht sehen darf, sieht trotzdem die Regeln. */
    const [ebenen, regeln] = await Promise.allSettled([this.api.campaignLayers(c), this.api.campaignRules(c)]);
    if (this.kampagne() !== c) return;
    this.ebenen.set(ebenen.status === 'fulfilled' ? ebenen.value : null);
    this.regeln.set(regeln.status === 'fulfilled' ? regeln.value.sorts : []);
    const grund = [ebenen, regeln].find((x): x is PromiseRejectedResult => x.status === 'rejected')?.reason;
    if (grund && regeln.status === 'rejected') this.fehler.set(grund instanceof ApiError ? grund.message : 'Could not load the decisions.');
    this.laedt.set(false);
  }

  protected readonly zeilen = computed(() => {
    const e = this.ebenen();
    const m = this.mitglieder();
    return campaignDecisions({
      sorts: this.regeln(),
      layers: e ? { inPlay: e.layers.filter((l) => l.inPlay).map((l) => l.name), compare: e.layers.filter((l) => l.compare).map((l) => l.name) } : null,
      members: m.length
        ? {
            leads: m.filter((x) => x.role === 'gm' || x.role === 'co-gm').length,
            players: m.filter((x) => x.role === 'player').length,
            spectators: m.filter((x) => x.role === 'spectator').length,
          }
        : null,
    });
  });

  /** Nach Überschrift, in der Reihenfolge der Liste. */
  protected readonly gruppen = computed(() => {
    const raus: { name: string; zeilen: CampaignDecision[] }[] = [];
    for (const z of this.zeilen()) {
      const g = raus.find((x) => x.name === z.group);
      if (g) g.zeilen.push(z);
      else raus.push({ name: z.group, zeilen: [z] });
    }
    return raus;
  });
}

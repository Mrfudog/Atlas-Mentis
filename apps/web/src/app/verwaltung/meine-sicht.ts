import { Component, computed, inject, signal } from '@angular/core';
import { Api, type Ebenenauswahl, type EigeneSichtEbene } from '../kern/api';
import { Stapel } from '../kern/stapel';
import { KampagnenEbenenListe } from './ebenen';

/**
 * **Der Inhalt der Reiter im Globalfilter** (T-496, REQ-408, REQ-412),
 * nachgeladen (P6): oben die Kampagne mit Wechsel für dieses Konto und —
 * für die Verwaltung — die Vorgabe der Installation; darunter je Reiter
 * ein Teil, gezeigt der der Sicht, die gilt (`mode`).
 *
 * - `campaign` — die Ebenen der Kampagne, je ein Häkchen. Abhaken blendet
 *   eine Ebene **nur für dieses Konto** aus; die Kampagne bleibt, wie sie
 *   ist, und „Reset" stellt ihre Vorgabe her.
 * - `mine` — jede Ebene, die dieses Konto lesen darf, frei gewählt, dazu
 *   die gespeicherten Auswahlen (T-186): „Use" übernimmt eine in die
 *   eigene Sicht, „Save" speichert die eigene Sicht als Auswahl.
 *
 * Gespeichert und gerechnet wird am Server (`/api/me/view`); was eine
 * Ebene an verborgenen Artikeln hat, bleibt verborgen.
 */
@Component({
  selector: 'nw-meine-sicht',
  imports: [KampagnenEbenenListe],
  template: `
    @if (stapel.laufend(); as k) {
      @if (stapel.kampagnen().length > 1) {
        <label class="wahl">
          <span>Running campaign</span>
          <select [value]="k.id" [disabled]="laeuft()" (change)="wechseln($any($event.target).value)">
            @for (c of stapel.kampagnen(); track c.id) {
              <option [value]="c.id" [selected]="c.id === k.id">{{ c.name }}@if (c.role) { ({{ c.role }}) }</option>
            }
          </select>
        </label>
        <p class="fuss">Only for your account, on every device — the others at the table stay in theirs.</p>
      } @else {
        <p class="wer">
          <b>{{ k.name }}</b>
          @if (k.role) {
            <span class="rolle">{{ k.role }}</span>
          }
        </p>
      }
      @if (stapel.verwaltung()) {
        <p class="fuss zeile">
          @if (stapel.vorgabe() === k.id) {
            <span>Default for accounts that have not chosen.</span>
          } @else {
            <span>Accounts that have not chosen see {{ vorgabeName() }}.</span>
            <button type="button" class="klein" [disabled]="laeuft()" (click)="vorgabeSetzen(k.id)">Make this the default</button>
          }
        </p>
      }
    }
    @if (stapel.sicht(); as v) {
      @if (fehler(); as f) {
        <p class="fehler" role="alert">{{ f }}</p>
      }
      @if (teil() === 'campaign') {
        <fieldset class="liste" [disabled]="laeuft()">
          <legend>Show in my view</legend>
          @for (l of v.stack; track l.id) {
            <label class="option" [class.gruppe]="l.group">
              <input type="checkbox" [checked]="!v.hide.includes(l.id)" (change)="ausblenden(l.id, !$any($event.target).checked)" />
              <span>{{ l.name }}@if (l.group) { <small>group</small> }</span>
            </label>
          } @empty {
            <p class="fuss">This campaign turns on no layer yet.</p>
          }
        </fieldset>
        <p class="fuss zeile">
          <span>
            @if (v.hide.length) {
              {{ v.hide.length }} hidden for you — the campaign stays as it is for everyone else.
            } @else {
              Untick a layer to hide it for you only. The campaign does not change.
            }
          </span>
          <button type="button" class="klein" [disabled]="laeuft() || !v.hide.length" (click)="zuruecksetzen()">Reset</button>
        </p>
        @if (stapel.laufend(); as k) {
          @if (k.may) {
            <details class="fuer-alle" [open]="fuerAlle()" (toggle)="fuerAlle.set($any($event.target).open)">
              <summary>Turn layers on or off for the whole campaign</summary>
              <!-- Erst beim Öffnen geladen (T-188): die Liste ist gross. Das schaltet für alle am Tisch. -->
              @if (fuerAlle()) {
                @defer {
                  <nw-kampagnen-ebenen [kampagne]="k.id" [kompakt]="true" (geschaltet)="stapel.geaendert()" />
                } @placeholder {
                  <p class="fuss">Loading the layers…</p>
                }
              }
            </details>
          } @else {
            <p class="fuss">{{ k.layers }} {{ k.layers === 1 ? 'layer' : 'layers' }} in view. The GM chooses which the campaign turns on; you can hide some for yourself.</p>
          }
        }
      } @else {
        <fieldset class="liste" [disabled]="laeuft()">
          <legend>Layers in my view</legend>
          <input class="suche" type="search" placeholder="Filter layers" aria-label="Filter layers" [value]="suche()" (input)="suche.set($any($event.target).value)" />
          @for (l of gefiltert(); track l.id) {
            <label class="option">
              <input type="checkbox" [checked]="v.mine.includes(l.id)" (change)="waehlen(l.id, $any($event.target).checked)" />
              <span>
                {{ l.name }}
                <small>{{ l.inCampaign ? 'in this campaign' : 'not in this campaign' }}@if (l.group) { · group }</small>
              </span>
            </label>
          } @empty {
            <p class="fuss">No layer matches.</p>
          }
        </fieldset>
        <p class="fuss zeile">
          <span>{{ v.mine.length }} {{ v.mine.length === 1 ? 'layer' : 'layers' }} chosen. Hidden articles stay hidden.</span>
          <button type="button" class="klein" [disabled]="laeuft()" (click)="vonKampagne()">Start from the campaign</button>
        </p>
        <details class="sets" (toggle)="setsOeffnen($any($event.target).open)">
          <summary>Saved selections ({{ sets().length }})</summary>
          @if (hinweis(); as h) {
            <p class="fuss" role="status">{{ h }}</p>
          }
          <ul>
            @for (s of sets(); track s.id) {
              <li>
                <span class="name">{{ s.name }}</span>
                <small>{{ s.layers.length }} {{ s.layers.length === 1 ? 'layer' : 'layers' }}</small>
                <button type="button" class="klein" [disabled]="laeuft()" (click)="benutzen(s)">Use</button>
                <button type="button" class="klein" [disabled]="laeuft()" [attr.aria-label]="'Delete ' + s.name" (click)="loeschen(s)">×</button>
              </li>
            } @empty {
              <li class="fuss">Nothing saved yet.</li>
            }
          </ul>
          <form class="speichern" (submit)="speichern($event)">
            <input type="text" maxlength="80" placeholder="Name" aria-label="Name of the selection" [value]="name()" (input)="name.set($any($event.target).value)" />
            <button type="submit" class="klein" [disabled]="laeuft() || !name().trim()">Save my view</button>
          </form>
        </details>
      }
    } @else {
      <p class="fuss">Loading your view…</p>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }
    .wahl {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
    }
    .wahl select {
      flex: 1 1 12rem;
      min-height: 40px;
    }
    .wer {
      margin: 0;
    }
    .rolle {
      margin-left: 0.4rem;
      padding: 0 0.4rem;
      border: 1px solid var(--accent);
      border-radius: 10px;
      color: var(--accent);
      font-size: 0.75rem;
    }
    .fuer-alle summary {
      cursor: pointer;
      min-height: 32px;
      font-weight: 700;
    }
    .liste {
      margin: 0;
      padding: 0.4rem 0.6rem 0.5rem;
      border: 1px solid var(--line);
      border-radius: 6px;
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
      max-height: 18rem;
      overflow-y: auto;
    }
    legend {
      padding: 0 0.3rem;
      font-weight: 700;
      color: var(--heading);
    }
    .option {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      min-height: 40px;
      cursor: pointer;
    }
    .option input {
      margin-top: 0.25rem;
    }
    .option small {
      display: block;
      color: var(--dim);
    }
    .gruppe small {
      display: inline;
      margin-left: 0.3rem;
    }
    .suche {
      min-height: 36px;
      margin-bottom: 0.3rem;
    }
    .fuss {
      margin: 0;
      font-size: 0.82rem;
      color: var(--dim);
    }
    .zeile {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.4rem;
    }
    .klein {
      min-height: 36px;
      padding: 0 0.6rem;
    }
    .fehler {
      margin: 0;
      color: var(--warn);
    }
    .sets summary {
      cursor: pointer;
      min-height: 32px;
    }
    .sets ul {
      list-style: none;
      margin: 0.3rem 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }
    .sets li {
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }
    .sets .name {
      flex: 1 1 auto;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .sets small {
      color: var(--dim);
    }
    .speichern {
      display: flex;
      gap: 0.4rem;
    }
    .speichern input {
      flex: 1 1 8rem;
      min-width: 0;
      min-height: 36px;
    }
  `,
})
export class MeineSicht {
  protected readonly stapel = inject(Stapel);
  private readonly api = inject(Api);
  /** Welcher Teil: der Reiter ist die Sicht, die gilt — also sagt sie es. */
  protected readonly teil = computed(() => this.stapel.sicht()?.mode ?? 'campaign');

  protected readonly laeuft = signal(false);
  protected readonly fehler = signal<string | null>(null);
  protected readonly suche = signal('');
  protected readonly sets = signal<Ebenenauswahl[]>([]);
  protected readonly name = signal('');
  protected readonly hinweis = signal<string | null>(null);
  private setsGeholt = false;

  protected readonly gefiltert = computed<EigeneSichtEbene[]>(() => {
    const q = this.suche().trim().toLowerCase();
    const alle = this.stapel.sicht()?.layers ?? [];
    return q ? alle.filter((l) => l.name.toLowerCase().includes(q)) : alle;
  });

  /** Ob die Ebenen für die ganze Kampagne aufgeklappt sind — erst dann geladen. */
  protected readonly fuerAlle = signal(false);

  protected readonly vorgabeName = computed(() => {
    const v = this.stapel.vorgabe();
    return this.stapel.kampagnen().find((c) => c.id === v)?.name ?? 'another campaign';
  });

  /** Die eigene Kampagne wählen (REQ-408) — nur dieses Konto; danach ihre Sicht. */
  protected wechseln(id: string): Promise<void> {
    if (id === this.stapel.laufend()?.id) return Promise.resolve();
    return this.tun(async () => {
      await this.stapel.wechseln(id);
      this.fuerAlle.set(false);
      await this.stapel.sichtLaden();
    });
  }

  /** Die Vorgabe der Installation — nur die Verwaltung. */
  protected vorgabeSetzen(id: string): Promise<void> {
    return this.tun(() => this.stapel.vorgabeSetzen(id));
  }

  private async tun(f: () => Promise<void>): Promise<void> {
    this.laeuft.set(true);
    try {
      await f();
      this.fehler.set(null);
    } catch (error) {
      this.fehler.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.laeuft.set(false);
    }
  }

  protected ausblenden(id: string, weg: boolean): Promise<void> {
    const v = this.stapel.sicht();
    if (!v) return Promise.resolve();
    const hide = weg ? [...new Set([...v.hide, id])] : v.hide.filter((x) => x !== id);
    return this.tun(() => this.stapel.sichtSetzen({ mode: 'campaign', hide }));
  }

  protected zuruecksetzen(): Promise<void> {
    return this.tun(() => this.stapel.sichtSetzen({ mode: 'campaign', hide: [] }));
  }

  protected waehlen(id: string, an: boolean): Promise<void> {
    const v = this.stapel.sicht();
    if (!v) return Promise.resolve();
    /* Neu gewählte kommen oben dazu — spezifischer als, was schon da ist. */
    const mine = an ? [...v.mine.filter((x) => x !== id), id] : v.mine.filter((x) => x !== id);
    return this.tun(() => this.stapel.sichtSetzen({ mode: 'mine', mine }));
  }

  protected vonKampagne(): Promise<void> {
    const v = this.stapel.sicht();
    if (!v) return Promise.resolve();
    return this.tun(() => this.stapel.sichtSetzen({ mode: 'mine', mine: v.stack.map((l) => l.id) }));
  }

  protected setsOeffnen(offen: boolean): void {
    if (!offen || this.setsGeholt) return;
    this.setsGeholt = true;
    void this.api
      .layerSets()
      .then((r) => this.sets.set(r.sets))
      .catch(() => (this.setsGeholt = false));
  }

  /** Eine gespeicherte Auswahl als eigene Sicht — was dieses Konto nicht lesen kann, bleibt draussen. */
  protected benutzen(s: Ebenenauswahl): Promise<void> {
    const lesbar = new Set((this.stapel.sicht()?.layers ?? []).map((l) => l.id));
    const aus = new Set(s.off);
    const mine = s.layers.filter((id) => lesbar.has(id) && !aus.has(id));
    const fehlt = s.layers.length - mine.length;
    return this.tun(async () => {
      await this.stapel.sichtSetzen({ mode: 'mine', mine });
      this.hinweis.set(fehlt ? `Using “${s.name}” — ${fehlt} ${fehlt === 1 ? 'layer is' : 'layers are'} not readable for you and stayed out.` : `Using “${s.name}”.`);
    });
  }

  protected speichern(ev: Event): Promise<void> {
    ev.preventDefault();
    const name = this.name().trim();
    const mine = this.stapel.sicht()?.mine ?? [];
    if (!name) return Promise.resolve();
    return this.tun(async () => {
      const neu = await this.api.saveLayerSet({ name, campaign: null, layers: mine, off: [] });
      this.sets.update((l) => (l.some((x) => x.id === neu.id) ? l.map((x) => (x.id === neu.id ? neu : x)) : [...l, neu]));
      this.name.set('');
      this.hinweis.set(`Saved “${neu.name}”.`);
    });
  }

  protected loeschen(s: Ebenenauswahl): Promise<void> {
    return this.tun(async () => {
      await this.api.deleteLayerSet(s.id);
      this.sets.update((l) => l.filter((x) => x.id !== s.id));
      this.hinweis.set(`Deleted “${s.name}”.`);
    });
  }
}

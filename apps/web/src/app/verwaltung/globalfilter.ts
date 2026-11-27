import { Component, computed, inject, output, signal } from '@angular/core';
import type { Ebenenauswahl, Ebenensicht, SichtEbene } from '../kern/api';
import { Api } from '../kern/api';
import { Stapel } from '../kern/stapel';
import type { LaufendeKampagne } from '../kern/api';

/**
 * **Der Globalfilter** (REQ-412, T-496): zwei Reiter im Popup der
 * Kopfleiste, beide nur für dieses Konto und diese Kampagne, gespeichert am
 * Server (`/api/me/layer-view`).
 *
 * - **Campaign view** — der Stapel der Kampagne; ein Häkchen weg heisst,
 *   ich sehe diese Ebene nicht. Die Kampagne ändert sich nicht, „Reset“
 *   stellt ihren Stapel wieder her.
 * - **My view** — jede Ebene, die ich lesen darf, frei gewählt, deutlich
 *   ausserhalb der Kampagne. Gespeicherte Auswahlen (T-186) lassen sich
 *   hierher laden und von hier speichern.
 *
 * Die Ebene der Kampagne bleibt in beiden an: in ihr liegt die Kampagne.
 * Den Stapel der Kampagne selbst ändert die Leitung darunter (Liste
 * „Campaign stack“) oder auf der Kampagnenseite.
 */
@Component({
  selector: 'nw-globalfilter',
  template: `
    @if (stapel.laufend(); as k) {
      @if (stapel.wahl().length > 1) {
        <label class="wahl">
          <span>Campaign</span>
          <select [value]="k.id" [disabled]="wechselt()" (change)="waehlen(k, $any($event.target).value)">
            @for (c of stapel.wahl(); track c.id) {
              <option [value]="c.id" [selected]="c.id === k.id">{{ c.name }}@if (c.role) { ({{ c.role }}) }</option>
            }
          </select>
        </label>
        <p class="fuss">
          Only for you — everyone else stays in their campaign.
          @if (k.role) {
            You are <b>{{ k.role }}</b> here.
          }
        </p>
        @if (stapel.verwaltung() && stapel.vorgabe() !== k.id) {
          <p class="fuss">
            <button type="button" class="klein" [disabled]="wechselt()" (click)="vorgabeSetzen(k.id)">Make it the default</button>
            for accounts that have not chosen and have no role elsewhere.
          </p>
        }
      } @else {
        <p class="wer">
          <b>{{ k.name }}</b>
          @if (k.role) {
            <span class="rolle">{{ k.role }}</span>
          }
        </p>
        @if (!k.role && !stapel.verwaltung() && !stapel.wahl().length) {
          <p class="fuss">You have no role in any campaign yet, so you see what is public here. A GM adds you on the campaign page.</p>
        }
      }
    }
    <fieldset class="filter">
      <legend>Global filter <small>— only for you</small></legend>
      <div class="reiter" role="tablist" aria-label="Global filter">
        <button type="button" role="tab" id="gf-tab-c" aria-controls="gf-c" [attr.aria-selected]="reiter() === 'campaign'" (click)="reiter.set('campaign')">
          Campaign view
        </button>
        <button type="button" role="tab" id="gf-tab-m" aria-controls="gf-m" [attr.aria-selected]="reiter() === 'mine'" (click)="reiter.set('mine')">
          My view
        </button>
      </div>
      @if (fehler(); as f) {
        <p class="fehler" role="alert">{{ f }}</p>
      }
      @if (sicht(); as s) {
        @if (reiter() === 'campaign') {
          <div role="tabpanel" id="gf-c" aria-labelledby="gf-tab-c" class="tafel">
            <p class="fuss">
              The layers of {{ s.campaign?.name ?? 'this campaign' }}. Untick what you do not want to see — lists, search and boards follow. The campaign itself stays as it is.
            </p>
            @if (s.mode === 'mine') {
              <p class="hinweis" role="status">You are in My view. Ticking here switches back to the campaign view.</p>
            }
            <ul class="ebenen">
              @for (l of s.stack; track l.id) {
                <li [class.gruppe]="l.group">
                  <label class="option" [class.fest]="l.id === s.fixed">
                    <input
                      type="checkbox"
                      [checked]="s.mode === 'mine' || !s.off.includes(l.id)"
                      [disabled]="l.id === s.fixed || laeuft()"
                      (change)="kampagnenHaken(l, $any($event.target).checked)"
                    />
                    <span>{{ l.name }}@if (l.group) { <small>group</small> }@if (l.id === s.fixed) { <small>campaign layer — always on</small> }</span>
                  </label>
                </li>
              }
            </ul>
          </div>
        } @else {
          <div role="tabpanel" id="gf-m" aria-labelledby="gf-tab-m" class="tafel">
            <p class="hinweis ausserhalb">
              Outside the campaign: you pick the layers you read. Visibility still applies — you see what you would see there. The campaign layer stays on.
            </p>
            <ul class="ebenen">
              @for (l of s.available; track l.id) {
                <li>
                  <label class="option" [class.fest]="l.id === s.fixed">
                    <input
                      type="checkbox"
                      [checked]="l.id === s.fixed || meine().has(l.id)"
                      [disabled]="l.id === s.fixed || laeuft()"
                      (change)="meinHaken(l, $any($event.target).checked)"
                    />
                    <span>
                      {{ l.name }}@if (l.group) { <small>group</small> }@if (!l.inCampaign) { <span class="marke">not in campaign</span> }
                    </span>
                  </label>
                </li>
              }
            </ul>
            <details class="sets" (toggle)="setsLaden()">
              <summary>Saved selections</summary>
              @for (set of sets(); track set.id) {
                <p class="set">
                  <button type="button" (click)="setLaden(set)" [disabled]="laeuft()">Load “{{ set.name }}”</button>
                  <button type="button" class="weg" [attr.aria-label]="'Delete ' + set.name" (click)="setLoeschen(set)">×</button>
                </p>
              } @empty {
                <p class="fuss">None yet.</p>
              }
              <form class="speichern" (submit)="$event.preventDefault(); setSpeichern(name.value); name.value = ''">
                <input #name type="text" maxlength="80" placeholder="Name of this selection" aria-label="Name of this selection" />
                <button type="submit" [disabled]="laeuft()">Save my view</button>
              </form>
            </details>
          </div>
        }
        <p class="unten">
          <span class="stand">{{ standText() }}</span>
          <button type="button" (click)="zuruecksetzen()" [disabled]="laeuft() || istVorgabe()">Reset</button>
        </p>
      } @else {
        <p class="fuss">Loading…</p>
      }
    </fieldset>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
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
    .klein {
      min-height: 32px;
    }
    .filter {
      margin: 0;
      padding: 0.4rem 0.6rem 0.5rem;
      border: 1px solid var(--line);
      border-radius: 6px;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }
    legend {
      padding: 0 0.3rem;
      font-weight: 700;
      color: var(--heading);
    }
    legend small {
      font-weight: 400;
      color: var(--dim);
    }
    .reiter {
      display: flex;
      gap: 0.25rem;
      border-bottom: 1px solid var(--line);
    }
    .reiter button {
      min-height: 40px;
      padding: 0 0.8rem;
      border: 1px solid transparent;
      border-bottom: 0;
      border-radius: 6px 6px 0 0;
      background: none;
      color: var(--dim);
      cursor: pointer;
    }
    .reiter button[aria-selected='true'] {
      border-color: var(--line);
      background: var(--surface);
      color: var(--accent);
      font-weight: 700;
      margin-bottom: -1px;
    }
    .ebenen {
      list-style: none;
      margin: 0;
      padding: 0;
      max-height: 16rem;
      overflow-y: auto;
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
      margin-left: 0.3rem;
      color: var(--dim);
    }
    .option.fest {
      cursor: default;
    }
    .marke {
      margin-left: 0.3rem;
      padding: 0 0.3rem;
      border: 1px solid var(--warn);
      border-radius: 0.2rem;
      color: var(--warn);
      font-size: 0.75em;
      white-space: nowrap;
    }
    .hinweis {
      margin: 0;
      font-size: 0.85rem;
    }
    .ausserhalb {
      padding: 0.3rem 0.5rem;
      border-left: 3px solid var(--warn);
    }
    .fuss {
      margin: 0;
      font-size: 0.82rem;
      color: var(--dim);
    }
    .fehler {
      margin: 0;
      color: var(--warn);
    }
    .unten {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      margin: 0;
    }
    .unten button,
    .set button,
    .speichern button {
      min-height: 40px;
    }
    .stand {
      font-size: 0.85rem;
      color: var(--dim);
    }
    .set {
      display: flex;
      gap: 0.3rem;
      margin: 0.2rem 0;
    }
    .set .weg {
      min-width: 40px;
    }
    .speichern {
      display: flex;
      flex-wrap: wrap;
      gap: 0.3rem;
    }
    .speichern input {
      flex: 1 1 10rem;
      min-height: 40px;
    }
    .sets summary {
      cursor: pointer;
      min-height: 32px;
    }
  `,
})
export class Globalfilter {
  private readonly api = inject(Api);
  protected readonly stapel = inject(Stapel);
  protected readonly wechselt = signal(false);
  /** Nach jedem Speichern: die Kopfleiste zählt neu, Listen fragen neu. */
  readonly geaendert = output<void>();

  protected readonly sicht = signal<Ebenensicht | null>(null);
  protected readonly reiter = signal<'campaign' | 'mine'>('campaign');
  protected readonly laeuft = signal(false);
  protected readonly fehler = signal<string | null>(null);
  protected readonly sets = signal<Ebenenauswahl[]>([]);
  private setsDa = false;

  /** Was in My view an ist: die gewählten, oder — beim ersten Wechsel — der Stapel der Kampagne. */
  protected readonly meine = computed(() => {
    const s = this.sicht();
    if (!s) return new Set<string>();
    if (s.mode === 'mine') return new Set(s.layers);
    return new Set(s.stack.filter((l) => !s.off.includes(l.id)).map((l) => l.id));
  });

  protected readonly istVorgabe = computed(() => {
    const s = this.sicht();
    return !s || (s.mode === 'campaign' && s.off.length === 0);
  });

  protected readonly standText = computed(() => {
    const s = this.sicht();
    if (!s) return '';
    if (s.mode === 'mine') return `My view: ${this.meine().size + (s.fixed && !this.meine().has(s.fixed) ? 1 : 0)} layers`;
    if (s.off.length) return `Campaign view, ${s.off.length} hidden for you`;
    return 'Campaign view, as the campaign has it';
  });

  constructor() {
    void this.laden();
  }

  /** Meine Kampagne wählen (REQ-408) — nur für mich; danach gilt deren Stapel und meine Sicht darin. */
  protected async waehlen(k: LaufendeKampagne, id: string): Promise<void> {
    if (id === k.id) return;
    await this.laufen(() => this.stapel.waehlen(id));
  }

  /** Die Vorgabe der Installation setzen — die Verwaltung (T-143). */
  protected async vorgabeSetzen(id: string): Promise<void> {
    await this.laufen(() => this.stapel.wechseln(id));
  }

  private async laufen(f: () => Promise<void>): Promise<void> {
    this.wechselt.set(true);
    try {
      await f();
      this.fehler.set(null);
      this.sicht.set(null);
      await this.laden();
    } catch (error) {
      this.fehler.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.wechselt.set(false);
    }
  }

  private async laden(): Promise<void> {
    try {
      const s = await this.api.layerView();
      this.sicht.set(s);
      this.reiter.set(s.mode);
    } catch (error) {
      this.fehler.set(error instanceof Error ? error.message : String(error));
    }
  }

  private async schreiben(f: () => Promise<Ebenensicht>): Promise<void> {
    this.laeuft.set(true);
    try {
      this.sicht.set(await f());
      this.fehler.set(null);
      this.geaendert.emit();
    } catch (error) {
      this.fehler.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.laeuft.set(false);
    }
  }

  protected kampagnenHaken(l: SichtEbene, an: boolean): void {
    const s = this.sicht();
    if (!s) return;
    const off = new Set(s.mode === 'mine' ? [] : s.off);
    if (an) off.delete(l.id);
    else off.add(l.id);
    void this.schreiben(() => this.api.setLayerView({ mode: 'campaign', off: [...off] }));
  }

  protected meinHaken(l: SichtEbene, an: boolean): void {
    const s = this.sicht();
    if (!s) return;
    const layers = new Set([...this.meine()].filter((id) => id !== s.fixed));
    if (an) layers.add(l.id);
    else layers.delete(l.id);
    void this.schreiben(() => this.api.setLayerView({ mode: 'mine', layers: [...layers] }));
  }

  protected zuruecksetzen(): void {
    this.reiter.set('campaign');
    void this.schreiben(() => this.api.resetLayerView());
  }

  protected async setsLaden(): Promise<void> {
    if (this.setsDa) return;
    this.setsDa = true;
    const c = this.sicht()?.campaign?.id ?? null;
    try {
      this.sets.set((await this.api.layerSets()).sets.filter((x) => !x.campaign || x.campaign === c));
    } catch {
      this.setsDa = false;
    }
  }

  protected setLaden(set: Ebenenauswahl): void {
    const lesbar = new Set(this.sicht()?.available.map((l) => l.id) ?? []);
    const layers = set.layers.filter((id) => lesbar.has(id));
    void this.schreiben(() => this.api.setLayerView({ mode: 'mine', layers }));
  }

  protected async setSpeichern(name: string): Promise<void> {
    const s = this.sicht();
    if (!s || !name.trim()) return;
    try {
      const neu = await this.api.saveLayerSet({ name: name.trim(), campaign: s.campaign?.id ?? null, layers: [...this.meine()], off: [] });
      this.sets.update((l) => [...l.filter((x) => x.id !== neu.id), neu]);
      this.fehler.set(null);
    } catch (error) {
      this.fehler.set(error instanceof Error ? error.message : String(error));
    }
  }

  protected async setLoeschen(set: Ebenenauswahl): Promise<void> {
    try {
      await this.api.deleteLayerSet(set.id);
      this.sets.update((l) => l.filter((x) => x.id !== set.id));
    } catch (error) {
      this.fehler.set(error instanceof Error ? error.message : String(error));
    }
  }
}

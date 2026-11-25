import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { Api, ApiError, type EbenenWechsel, type KopierArt, type KopierErgebnis, type KopierPlan } from '../kern/api';
import { Mitlaeufer } from '../verwaltung/mitlaeufer';

/** Die drei Wege, je ein Satz (T-405). */
const WEGE: { key: KopierArt; label: string; satz: string }[] = [
  { key: 'version', label: 'Version', satz: 'Takes the place of the original in this campaign; the original stays as it is.' },
  { key: 'variant', label: 'Variant', satz: 'Stands beside the original and names where it comes from; it reads nothing from it later.' },
  { key: 'copy', label: 'Copy', satz: 'A new article of its own, with a new number; nothing ties it to the original.' },
];

/**
 * **Fassung, Variante oder Kopie in einer anderen Ebene** (T-405, REQ-400):
 * am Artikel unter „Copy…" — wählbar der Weg, die Zielebene (vorgewählt
 * die Schreibebene) und was mitgeht (Teile, Statblock, Inventar, dieselbe
 * Liste wie beim Ebenenwechsel). Gerechnet und geprüft am Server
 * (`POST /api/entities/:id/copy`).
 */
@Component({
  selector: 'nw-kopieren',
  imports: [Mitlaeufer],
  template: `
    <section class="kopieren" role="dialog" aria-labelledby="kopieren-titel">
      <h3 id="kopieren-titel">Version, variant or copy in another layer</h3>
      <div class="wege" role="radiogroup" aria-label="What to make">
        @for (w of wege; track w.key) {
          <label class="weg">
            <input type="radio" name="kopierweg" [checked]="art() === w.key" (change)="art.set(w.key)" />
            <b>{{ w.label }}</b>
            <span class="dim">{{ w.satz }}</span>
          </label>
        }
      </div>
      @if (plan(); as p) {
        @if (p.layers.length) {
          <label class="ziel">
            <span>Into layer</span>
            <select aria-label="Into layer" [value]="ziel()" (change)="ziel.set($any($event.target).value)">
              @for (l of p.layers; track l.id) {
                <option [value]="l.id">{{ l.name }}</option>
              }
            </select>
          </label>
          @if (p.followers.length) {
            <nw-mitlaeufer [plan]="alsPlan(p)" verb="Copy" [abbrechbar]="false" [laeuft]="laeuft()" (los)="los($event)" />
          } @else {
            <button type="button" class="haupt" [disabled]="laeuft()" (click)="los([])">Create {{ artName() }}</button>
          }
        } @else {
          <p class="dim" role="status">
            @if (art() === 'version') {
              No layer for a version: you write this article yourself, or no layer of yours is in play here.
            } @else {
              You have no layer to put it into.
            }
          </p>
        }
      }
      @if (fehler(); as f) {
        <p class="fehler" role="alert">{{ f }}</p>
      }
      <button type="button" class="leise" [disabled]="laeuft()" (click)="zu.emit()">Cancel</button>
    </section>
  `,
  styles: `
    .kopieren {
      padding: 0.8rem;
      margin: 0.6rem 0;
      border: 1px solid var(--accent);
      border-radius: 8px;
      background: var(--surface);
      display: grid;
      gap: 0.5rem;
    }
    h3 {
      margin: 0;
      font-size: 1rem;
    }
    .wege {
      display: grid;
      gap: 0.3rem;
    }
    .weg {
      display: flex;
      flex-wrap: wrap;
      gap: 0.2rem 0.5rem;
      align-items: baseline;
      min-height: 32px;
    }
    .dim {
      color: var(--dim);
      font-size: 0.85rem;
    }
    .ziel {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      align-items: center;
    }
    .ziel select {
      min-height: 36px;
      max-width: 100%;
    }
    button {
      min-height: 36px;
      justify-self: start;
    }
    .fehler {
      color: var(--accent);
    }
  `,
})
export class Kopieren {
  readonly artikel = input.required<string>();
  readonly fertig = output<KopierErgebnis>();
  readonly zu = output<void>();

  private readonly api = inject(Api);
  protected readonly wege = WEGE;
  protected readonly art = signal<KopierArt>('copy');
  protected readonly ziel = signal('');
  protected readonly plan = signal<KopierPlan | null>(null);
  protected readonly laeuft = signal(false);
  protected readonly fehler = signal<string | null>(null);
  protected readonly artName = computed(() => WEGE.find((w) => w.key === this.art())?.label.toLowerCase() ?? '');

  constructor() {
    /* Der Plan je Weg und Zielebene — vom Server, mit den Mitläufern. */
    effect(() => {
      const id = this.artikel();
      const art = this.art();
      const ziel = this.ziel();
      untracked(() => void this.planen(id, art, ziel));
    });
  }

  private lauf = 0;
  private async planen(id: string, art: KopierArt, ziel: string): Promise<void> {
    const nr = ++this.lauf;
    this.fehler.set(null);
    try {
      const p = await this.api.copyPlan(id, art, ziel || undefined);
      if (nr !== this.lauf) return;
      this.plan.set(p);
      if (p.layer && p.layer.id !== this.ziel()) this.ziel.set(p.layer.id);
    } catch (e) {
      if (nr === this.lauf) this.fehler.set(e instanceof ApiError ? e.message : 'Could not ask the server.');
    }
  }

  /** Die Liste der Mitläufer erwartet einen Plan wie beim Ebenenwechsel. */
  protected alsPlan(p: KopierPlan): EbenenWechsel {
    const name = p.layers.find((l) => l.id === this.ziel())?.name ?? p.layer?.name ?? '';
    return {
      dryRun: true, selected: 0, changed: 0, deleted: 0, examples: [], rejected: [], rejectedCount: 0, skipped: [], skippedCount: 0, ms: 0,
      roots: p.roots,
      followers: p.followers,
      target: { id: this.ziel(), name },
      layerNames: p.layerNames,
      moving: [],
    };
  }

  protected async los(mit: string[]): Promise<void> {
    this.laeuft.set(true);
    this.fehler.set(null);
    try {
      this.fertig.emit(await this.api.copy(this.artikel(), this.art(), this.ziel(), mit));
    } catch (e) {
      this.fehler.set(e instanceof ApiError ? e.message : 'That did not work.');
    } finally {
      this.laeuft.set(false);
    }
  }
}

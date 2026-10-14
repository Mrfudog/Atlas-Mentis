import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, ApiError, type EbenenSchreiber, type MeineEbene } from '../kern/api';
import { Session } from '../kern/session';

/**
 * **Die Ebenen, in denen ich schreibe** (T-098, E-001) — auf der Seite
 * „Account": je Ebene, warum (meine, zugeteilt, als Leitung einer
 * Kampagne) und ob sie in der laufenden Kampagne im Spiel ist. Darunter
 * „New layer": eine eigene Ebene, die mir gehört. An einer, die mir
 * gehört, sage ich, wer sonst darin schreibt.
 *
 * **Was der Server nicht annähme, bietet die Seite nicht an**: die Liste
 * der Schreibenden steht nur an Ebenen, für die der Server sie mitschickt
 * (`editors`).
 *
 * **Make default** wählt die Schreibebene (T-176), **Empty…** leert eine
 * eigene Ebene als eine Massenänderung: erst die Zahl, dann bestätigen,
 * danach steht „Undo" da (und in der Werkbank).
 */
@Component({
  selector: 'nw-meine-ebenen',
  imports: [FormsModule],
  template: `
    <section class="block" aria-labelledby="h-ebenen">
      <h2 id="h-ebenen">Layers</h2>
      <p class="dim">
        You edit everything in the layers below. An article that lies elsewhere — in a shared book, or
        in no layer — you change as your own version in one of them; the original stays. A layer of
        your own works once the GM turns it on for the campaign.
      </p>

      @if (fehler(); as f) {
        <p class="fehler" role="alert">{{ f }}</p>
      }

      @if (vorgabe(); as v) {
        <p class="dim">New articles go to <b>{{ v }}</b> unless you pick another layer.</p>
      }
      @if (bericht(); as b) {
        <p role="status">
          {{ b }}
          @if (zurueck(); as z) {
            <button type="button" class="klein" [disabled]="laeuft()" (click)="zuruecknehmen(z)">Undo</button>
          }
        </p>
      }

      <ul class="ebenen">
        @for (l of ebenen(); track l.id) {
          <li>
            <div class="kopf">
              <b>{{ l.name }}</b>
              @if (l.owner) {
                <span class="art">yours</span>
              } @else if (l.granted) {
                <span class="art">shared with you</span>
              }
              @for (k of l.campaigns; track k.id) {
                <span class="art">{{ k.role }} of {{ k.name }}</span>
              }
              @if (l.player; as p) {
                <span class="art">{{ p.mine ? 'your player layer' : 'player layer' }} in {{ p.campaign.name }}</span>
              }
              @if (l.default) {
                <span class="art vorgabe">default</span>
              }
              <span class="dim">· {{ l.inPlay ? 'in play' : 'not turned on in ' + (kampagne() ?? 'the campaign') }}</span>
              @if (l.inPlay && !l.default) {
                <button type="button" class="klein" [disabled]="laeuft()" (click)="vorgabeSetzen(l)"
                        title="New articles go here unless you pick another layer">Make default</button>
              }
              @if (l.owner || session.isAdmin()) {
                <button type="button" class="klein" [disabled]="laeuft()" (click)="leeren(l)"
                        title="Delete every article in this layer, with its parts — undoable">Empty…</button>
              }
              @if (l.player && !l.player.mine) {
                <button type="button" class="klein" [disabled]="laeuft()" (click)="uebernehmen(l)"
                        title="Move what is in it to the campaign layer and remove the empty layer">Take over</button>
              }
            </div>
            @if (l.editors; as eds) {
              <div class="schreiber">
                <span class="dim">Edited by</span>
                @for (s of eds; track s.id) {
                  <span class="chip">
                    {{ s.name }}{{ s.owner ? ' (owner)' : '' }}
                    @if (darfEntfernen(s)) {
                      <button type="button" class="x" [attr.aria-label]="'Remove ' + s.name + ' from ' + l.name"
                              [disabled]="laeuft()" (click)="entfernen(l, s)">×</button>
                    }
                  </span>
                }
                <form class="dazu" (ngSubmit)="dazunehmen(l)">
                  <input [name]="'wer-' + l.id" [(ngModel)]="wer[l.id]" placeholder="account name"
                         [attr.aria-label]="'Let someone edit ' + l.name" />
                  <button type="submit" class="klein" [disabled]="laeuft() || !(wer[l.id] ?? '').trim()">Add</button>
                </form>
              </div>
            }
          </li>
        } @empty {
          <li class="dim">{{ geladen() ? 'You edit no layer yet.' : 'Loading…' }}</li>
        }
      </ul>

      <form class="anlegen" (ngSubmit)="anlegen()">
        <label>New layer <input name="ebene" [(ngModel)]="name" placeholder="My notes" maxlength="80" /></label>
        <button type="submit" class="pri" [disabled]="laeuft() || !name.trim()">Create layer</button>
      </form>
    </section>
  `,
  styles: `
    h2 {
      font-family: var(--caps);
      color: var(--accent);
      margin: 0;
      font-size: 1.3rem;
    }
    .dim {
      color: var(--dim);
    }
    .fehler {
      color: var(--warn);
    }
    .block {
      margin-top: 1.25rem;
      padding: 1rem 1.25rem;
      background: var(--surface);
      border: 1px solid var(--line);
      border-top: 3px solid var(--rule);
      border-radius: 6px;
    }
    .ebenen {
      margin: 0.75rem 0 0;
      padding: 0;
      list-style: none;
    }
    .ebenen li {
      padding: 0.5rem 0;
      border-top: 1px solid var(--line2);
    }
    .kopf {
      display: flex;
      flex-wrap: wrap;
      gap: 0.3rem 0.5rem;
      align-items: baseline;
    }
    .art.vorgabe {
      background: var(--accent);
      color: var(--paper);
    }
    .art,
    .chip {
      padding: 0 0.4rem;
      border-radius: 10px;
      background: var(--chip);
      font-size: 0.75rem;
    }
    .schreiber {
      display: flex;
      flex-wrap: wrap;
      gap: 0.3rem 0.5rem;
      align-items: center;
      margin-top: 0.35rem;
      font-size: 0.85rem;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 0.2rem;
      font-size: 0.8rem;
    }
    button.x {
      min-height: 24px;
      padding: 0 0.3rem;
      border: 0;
      background: transparent;
      color: var(--dim);
      cursor: pointer;
    }
    .dazu {
      display: inline-flex;
      gap: 0.3rem;
    }
    .dazu input {
      width: 10rem;
      min-height: 32px;
    }
    .anlegen {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 0.5rem 0.75rem;
      align-items: end;
      margin-top: 0.75rem;
    }
    label {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      font-size: 0.85rem;
      color: var(--dim);
    }
    input {
      min-height: 40px;
      padding: 0.25rem 0.5rem;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--paper);
      color: var(--ink);
      min-width: 0;
    }
    button.klein {
      min-height: 32px;
      padding: 0 0.6rem;
      font-size: 0.85rem;
    }
    @media (max-width: 640px) {
      .block {
        padding: 0.75rem;
      }
      .dazu input {
        width: 8rem;
      }
    }
  `,
})
export class MeineEbenen {
  private readonly api = inject(Api);
  protected readonly session = inject(Session);

  protected readonly ebenen = signal<MeineEbene[]>([]);
  protected readonly kampagne = signal<string | null>(null);
  /** Wohin angelegt wird, wenn niemand eine Ebene nennt (T-164). */
  protected readonly vorgabe = signal<string | null>(null);
  protected readonly bericht = signal<string | null>(null);
  /** Die Massenänderung des letzten Leerens — für „Undo". */
  protected readonly zurueck = signal<string | null>(null);
  protected readonly geladen = signal(false);
  protected readonly fehler = signal<string | null>(null);
  protected readonly laeuft = signal(false);
  protected name = '';
  protected wer: Record<string, string | undefined> = {};

  constructor() {
    void this.laden();
  }

  /** Sich selbst nimmt nur die Verwaltung heraus — sonst gehörte die Ebene niemandem. */
  protected darfEntfernen(s: EbenenSchreiber): boolean {
    return this.session.isAdmin() || s.id !== this.session.user()?.id;
  }

  private async laden(): Promise<void> {
    try {
      const d = await this.api.myLayers();
      this.ebenen.set(d.layers);
      this.kampagne.set(d.campaign?.name ?? null);
      this.vorgabe.set(d.default?.name ?? null);
    } catch (e) {
      this.fehler.set(e instanceof ApiError ? e.message : 'Could not reach the server.');
    } finally {
      this.geladen.set(true);
    }
  }

  private async tue(was: () => Promise<unknown>): Promise<void> {
    this.laeuft.set(true);
    this.fehler.set(null);
    try {
      await was();
      await this.laden();
    } catch (e) {
      this.fehler.set(e instanceof ApiError ? e.message : 'Could not reach the server.');
    } finally {
      this.laeuft.set(false);
    }
  }

  protected anlegen(): Promise<void> {
    const name = this.name.trim();
    return this.tue(async () => {
      await this.api.createLayer(name);
      this.name = '';
    });
  }

  protected dazunehmen(l: MeineEbene): Promise<void> {
    const name = (this.wer[l.id] ?? '').trim();
    return this.tue(async () => {
      await this.api.addLayerEditor(l.id, { name });
      this.wer[l.id] = '';
    });
  }

  /** Eine Spielerebene übernehmen (T-164) — der Server sagt, wenn ihr Konto noch mitspielt. */
  protected uebernehmen(l: MeineEbene): Promise<void> {
    if (!confirm(`Move everything in “${l.name}” to the campaign layer and remove it?`)) return Promise.resolve();
    return this.tue(async () => {
      const r = await this.api.takeOverLayer(l.id);
      this.bericht.set(
        `${r.moved.length} article(s) moved to ${r.into.name}` +
          (r.kept.length ? `; ${r.kept.length} stayed: ${r.kept.map((k) => k.name).join(', ')}.` : '.'),
      );
    });
  }

  protected vorgabeSetzen(l: MeineEbene): Promise<void> {
    return this.tue(() => this.api.chooseDefaultLayer(l.id));
  }

  /** Eine Ebene leeren (T-176): die Vorschau nennt Zahl und Namen, bestätigt wird mit der Zahl. */
  protected async leeren(l: MeineEbene): Promise<void> {
    this.zurueck.set(null);
    let vorschau: Awaited<ReturnType<Api['emptyLayer']>> | undefined;
    await this.tue(async () => {
      vorschau = await this.api.emptyLayer(l.id, { dryRun: true });
    });
    const v = vorschau;
    if (!v) return;
    if (!v.deleted) {
      this.bericht.set(`“${l.name}” is empty.`);
      return;
    }
    if (v.rejectedCount) {
      this.fehler.set(`${v.rejectedCount} article(s) in “${l.name}” cannot be deleted by you: ${v.rejected.map((r) => r.name).join(', ')}.`);
      return;
    }
    const namen = v.examples.filter((x) => x.change === 'delete').slice(0, 12).map((x) => x.name);
    const rest = v.deleted - namen.length;
    const frage =
      `Delete ${v.deleted} article(s) from “${l.name}”` +
      (v.changed ? ` and remove links to them from ${v.changed} other(s)` : '') +
      `?\n\n${namen.join(', ')}${rest > 0 ? ` … and ${rest} more` : ''}\n\nYou can undo this.`;
    if (!confirm(frage)) return;
    await this.tue(async () => {
      const r = await this.api.emptyLayer(l.id, { confirmDelete: v.deleted });
      this.bericht.set(`${r.deleted} article(s) deleted from “${l.name}”.`);
      this.zurueck.set(r.id ?? null);
    });
  }

  protected zuruecknehmen(id: string): Promise<void> {
    return this.tue(async () => {
      const r = await this.api.undo(id);
      this.bericht.set(`Undone: ${r.restored} article(s) restored.`);
      this.zurueck.set(null);
    });
  }

  protected entfernen(l: MeineEbene, s: EbenenSchreiber): Promise<void> {
    if (!confirm(`${s.name} no longer edits “${l.name}”?`)) return Promise.resolve();
    return this.tue(() => this.api.dropLayerEditor(l.id, s.id));
  }
}

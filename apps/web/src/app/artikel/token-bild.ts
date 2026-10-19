import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { TOKEN_ZOOM_MAX, tokenFrame, tokenPlacement, type Entity, type TokenFrame, type TokenLook } from '@nw/model';
import { Api, ApiError } from '../kern/api';
import { Bestand } from '../kern/bestand';
import { bildAdresse } from './bild';

/**
 * **Ein Bild als Token** (T-297) — eine Rechnung für Karte, Artikel und
 * den Dialog „Adjust token", damit alle drei dasselbe zeigen.
 *
 * Ein **fertiges Rundtoken** (`Asset.round`, wie die aus 5e.tools) bringt
 * Ring und Schatten selbst mit und wird gezeigt, wie es ist. Jedes andere
 * Bild liegt in einem Kreis, so gross und so verschoben, wie sein
 * Ausschnitt (`Asset.frame`) sagt (`tokenPlacement`).
 */
export function tokenStil(look: TokenLook | undefined): Record<string, string> {
  if (!look || look.round) return {};
  const p = tokenPlacement(look);
  const pz = (n: number) => `${(n * 100).toFixed(3)}%`;
  return {
    position: 'absolute',
    left: pz(p.left),
    top: pz(p.top),
    width: pz(p.width),
    height: pz(p.height),
    'max-width': 'none',
    'object-fit': 'fill',
  };
}

/**
 * **Das Token am Artikel** (T-297, Element `token`): am Statblock sein
 * eigenes, an der Kreatur das ihres Statblocks — so, wie es auf der Karte
 * steht. Wer das Bild schreibt, stellt hier ein („Adjust token"):
 * Ausschnitt verschieben und zoomen, oder sagen, dass es ein fertiges
 * Rundtoken ist. Gespeichert wird am Bild (`Asset.frame`, `Asset.round`),
 * also gilt es überall, wo dieses Token steht.
 */
@Component({
  selector: 'nw-token',
  template: `
    @if (token(); as t) {
      <div class="token">
        <div class="kreis" [class.rund]="t.look.round" [style.width.px]="96" [style.height.px]="96">
          <img [src]="adresse(t)" alt="Token" draggable="false" [style]="stil(t.look)" />
        </div>
        @if (t.adjustable && !offen()) {
          <button type="button" class="knopf" (click)="oeffnen(t)">Adjust token</button>
        }
      </div>
      @if (offen() && entwurf(); as d) {
        <div class="dialog" role="group" aria-label="Adjust token">
          <div
            class="kreis gross"
            [class.rund]="d.round"
            [style.width.px]="GROSS"
            [style.height.px]="GROSS"
            (pointerdown)="greifen($event)"
            (pointermove)="ziehen($event)"
            (pointerup)="loslassen($event)"
            (pointercancel)="loslassen($event)"
            [attr.title]="d.round ? null : 'Drag to move the image in the circle'"
          >
            <img [src]="adresse(t)" alt="" draggable="false" [style]="stil(d)" />
          </div>
          <div class="regler">
            <label class="zeile">
              <input type="checkbox" [checked]="d.round" (change)="setzeRund($any($event.target).checked)" />
              Ready-made round token — show it as it is
            </label>
            @if (!d.round) {
              <label class="zeile">
                Zoom
                <input type="range" min="1" [max]="ZOOM_MAX" step="0.05" [value]="d.frame.zoom" (input)="setzeZoom(+$any($event.target).value)" />
                <span>{{ d.frame.zoom.toFixed(2) }}×</span>
              </label>
              <p class="hinweis">Drag the image to put the face in the middle.</p>
            }
            @if (fehler()) {
              <p class="fehler" role="alert">{{ fehler() }}</p>
            }
            <div class="knoepfe">
              <button type="button" class="knopf haupt" (click)="speichern(t)" [disabled]="arbeitet()">Save</button>
              <button type="button" class="knopf" (click)="zuruecksetzen()" [disabled]="arbeitet()">Centre</button>
              <button type="button" class="knopf" (click)="offen.set(false)" [disabled]="arbeitet()">Cancel</button>
            </div>
            <p class="hinweis">Saved on the image: every statblock with this token shows it the same way.</p>
          </div>
        </div>
      }
    }
  `,
  styles: `
    :host {
      display: block;
      margin: 0.5rem 0;
    }
    .token {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }
    .kreis {
      position: relative;
      border-radius: 50%;
      overflow: hidden;
      border: 2px solid var(--surface);
      background: var(--accent);
      box-shadow: 0 1px 4px rgb(0 0 0 / 0.45);
      flex: none;
      touch-action: none;
    }
    .kreis img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      pointer-events: none;
      user-select: none;
    }
    .kreis.rund {
      background: transparent;
      border-color: transparent;
      box-shadow: none;
      overflow: visible;
    }
    .kreis.rund img {
      object-fit: contain;
    }
    .gross {
      cursor: grab;
    }
    .gross:active {
      cursor: grabbing;
    }
    .dialog {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
      align-items: flex-start;
      margin-top: 0.75rem;
      padding: 0.75rem;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--surface);
    }
    .regler {
      flex: 1 1 14rem;
      min-width: 0;
    }
    .zeile {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0 0 0.5rem;
    }
    .zeile input[type='range'] {
      flex: 1;
      min-width: 0;
    }
    .knoepfe {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .hinweis {
      font-size: 0.85rem;
      color: var(--muted);
      margin: 0.25rem 0 0.5rem;
    }
    .fehler {
      color: var(--accent);
    }
  `,
})
export class TokenBild {
  readonly artikel = input.required<Entity>();
  private readonly bestand = inject(Bestand);
  private readonly api = inject(Api);

  protected readonly GROSS = 220;
  protected readonly ZOOM_MAX = TOKEN_ZOOM_MAX;
  protected readonly token = computed(() => this.bestand.token().get(this.artikel().id) ?? null);
  protected readonly offen = signal(false);
  protected readonly entwurf = signal<TokenLook | null>(null);
  protected readonly arbeitet = signal(false);
  protected readonly fehler = signal<string | null>(null);
  private griff: { x: number; y: number; frame: TokenFrame } | null = null;

  constructor() {
    /* Das Token kommt mit dem Artikel (`refs.token`); wo er nur als Karte
       oder Kachel steht, ist er vielleicht noch nicht ganz geholt. */
    effect(() => {
      const id = this.artikel().id;
      untracked(() => void this.bestand.oeffnen(id, false, false));
    });
  }

  protected adresse(t: { id: string; version?: string }): string | null {
    return bildAdresse(t.id, 'thumb', t.version ?? '');
  }
  protected stil(look: TokenLook): Record<string, string> {
    return tokenStil(look);
  }

  protected oeffnen(t: { look: TokenLook }): void {
    this.entwurf.set({ ...t.look, frame: { ...t.look.frame } });
    this.fehler.set(null);
    this.offen.set(true);
  }
  protected setzeRund(rund: boolean): void {
    this.entwurf.update((d) => (d ? { ...d, round: rund } : d));
  }
  protected setzeZoom(zoom: number): void {
    this.entwurf.update((d) => (d ? { ...d, frame: tokenFrame({ ...d.frame, zoom }) } : d));
  }
  protected zuruecksetzen(): void {
    this.entwurf.update((d) => (d ? { ...d, frame: tokenFrame(null) } : d));
  }

  /* Ziehen verschiebt das Bild unter dem Kreis: ein Pixel nach rechts heisst,
     die Mitte wandert um so viel nach links, wie ein Pixel vom Bild ist. */
  protected greifen(ev: PointerEvent): void {
    const d = this.entwurf();
    if (!d || d.round) return;
    (ev.currentTarget as HTMLElement).setPointerCapture?.(ev.pointerId);
    this.griff = { x: ev.clientX, y: ev.clientY, frame: d.frame };
  }
  protected ziehen(ev: PointerEvent): void {
    const d = this.entwurf();
    if (!this.griff || !d) return;
    const p = tokenPlacement({ ...d, frame: this.griff.frame });
    const dx = (ev.clientX - this.griff.x) / (p.width * this.GROSS);
    const dy = (ev.clientY - this.griff.y) / (p.height * this.GROSS);
    this.entwurf.set({ ...d, frame: tokenFrame({ ...this.griff.frame, x: this.griff.frame.x - dx * 100, y: this.griff.frame.y - dy * 100 }) });
  }
  protected loslassen(ev: PointerEvent): void {
    (ev.currentTarget as HTMLElement).releasePointerCapture?.(ev.pointerId);
    this.griff = null;
  }

  protected async speichern(t: { id: string }): Promise<void> {
    const d = this.entwurf();
    if (!d) return;
    this.arbeitet.set(true);
    this.fehler.set(null);
    try {
      await this.bestand.oeffnen(t.id, true, false);
      const asset = this.bestand.voll().get(t.id);
      if (!asset) throw new Error('The image is not available.');
      const karte = { ...((asset.components?.['Asset'] ?? {}) as Record<string, unknown>), round: d.round, frame: { ...d.frame } };
      await this.api.putEntity({ ...asset, components: { ...asset.components, Asset: karte } });
      await this.bestand.oeffnen(this.artikel().id, true);
      this.offen.set(false);
    } catch (error) {
      this.fehler.set(error instanceof ApiError ? error.message : error instanceof Error ? error.message : 'Could not save.');
    } finally {
      this.arbeitet.set(false);
    }
  }
}

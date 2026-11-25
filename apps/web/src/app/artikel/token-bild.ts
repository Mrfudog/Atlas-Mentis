import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { TOKEN_ZOOM_MAX, tokenFrame, tokenPlacement, tokenRing, tokenRings, type Entity, type TokenFrame, type TokenLook, type TokenRing } from '@nw/model';
import { Api, ApiError } from '../kern/api';
import { Bestand } from '../kern/bestand';
import { BildWahl, bildAdresse } from './bild';

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
 * **Was im Ring liegt** (T-301, T-302): Farbe oder Verlauf, bei einem
 * eigenen Rand mit Rahmenbild das Bild darüber — die Maske der Klasse
 * `beringt` schneidet aus beidem den Ring. Die Id des Bildes ist im Modell
 * geprüft (`customRing`), die Adresse baut `bildAdresse`.
 */
export function ringMuster(r: TokenRing): string {
  const bild = r.image ? bildAdresse(r.image, 'full') : null;
  return bild ? `url("${bild}") center / cover no-repeat, ${r.paint}` : r.paint;
}

/**
 * **Der Rand eines Tokens** (T-301) als CSS-Variablen für die Klasse
 * `beringt`: Breite in Pixeln aus dem Bruchteil des Durchmessers, Farbe,
 * Verlauf oder Rahmenbild aus `TOKEN_RINGS` und den eigenen Rändern
 * (`custom`, T-302). Ein fertiges Rundtoken bekommt keinen.
 */
export function ringStil(look: TokenLook | undefined, px: number, custom: readonly TokenRing[] = []): Record<string, string> | null {
  if (!look || look.round) return null;
  const r = tokenRing(look.frame.ring, custom);
  return { '--ring-w': `${Math.max(r.width ? 1 : 0, Math.round(r.width * px))}px`, '--ring-bg': ringMuster(r) };
}

/**
 * **Das Token am Artikel** (T-297, T-301, Element `token`): am Statblock
 * sein eigenes, an der Kreatur das ihres Statblocks — so, wie es auf der
 * Karte steht. „Adjust token" ändert es:
 * - **das Bild** — ein anderes wählen, hochladen oder einfügen; geschrieben
 *   wird `Statblock.token` des Statblocks, der es trägt;
 * - **den Ausschnitt** (ziehen, zoomen) und **den Rand** aus der Auswahl,
 *   oder dass es ein fertiges Rundtoken ist — gespeichert am Bild
 *   (`Asset.frame`, `Asset.round`), also überall gleich, wo es steht.
 * Was man davon darf, sagt der Server (`changeable`, `adjustable`).
 */
@Component({
  selector: 'nw-token',
  imports: [BildWahl],
  template: `
    @if (token(); as t) {
      <div class="token">
        @if (t.id && t.look) {
          <div class="kreis" [class.rund]="t.look.round" [class.beringt]="!t.look.round" [style]="kreisStil(t.look, KLEIN)">
            <img [src]="adresse(t.id, t.version)" alt="Token" draggable="false" [style]="stil(t.look)" />
          </div>
        } @else {
          <p class="leer">No token yet.</p>
        }
        @if ((t.adjustable || t.changeable) && !offen()) {
          <button type="button" class="knopf" (click)="oeffnen(t)">{{ t.id ? 'Adjust token' : 'Choose token' }}</button>
        }
      </div>
      @if (offen()) {
        <div class="dialog" role="group" aria-label="Adjust token">
          @if (t.id && entwurf(); as d) {
            <div
              class="kreis gross"
              [class.rund]="d.round"
              [class.beringt]="!d.round"
              [style]="kreisStil(d, GROSS)"
              (pointerdown)="greifen($event)"
              (pointermove)="ziehen($event)"
              (pointerup)="loslassen($event)"
              (pointercancel)="loslassen($event)"
              [attr.title]="d.round ? null : 'Drag to move the image in the circle'"
            >
              <img [src]="adresse(t.id, t.version)" alt="" draggable="false" [style]="stil(d)" />
            </div>
          }
          <div class="regler">
            @if (t.id && t.adjustable && entwurf(); as d) {
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
                <fieldset class="raender">
                  <legend>Border</legend>
                  @for (r of RINGE(); track r.id) {
                    <label class="rand" [class.an]="(d.frame.ring ?? 'plain') === r.id" [title]="r.label">
                      <input type="radio" name="rand" [value]="r.id" [checked]="(d.frame.ring ?? 'plain') === r.id" (change)="setzeRing(r.id)" />
                      <span class="huelle"><span class="muster" [style.background]="muster(r)" [class.ohne]="!r.width"></span></span>
                      <span class="name">{{ r.label }}</span>
                    </label>
                  }
                </fieldset>
              }
              <div class="knoepfe">
                <button type="button" class="knopf haupt" (click)="speichern(t.id)" [disabled]="arbeitet()">Save</button>
                <button type="button" class="knopf" (click)="zuruecksetzen()" [disabled]="arbeitet()">Centre</button>
                <button type="button" class="knopf" (click)="offen.set(false)" [disabled]="arbeitet()">Cancel</button>
              </div>
              <p class="hinweis">Frame and border are saved on the image: every statblock with this token shows it the same way.</p>
            } @else if (t.id) {
              <p class="hinweis">You may not edit this image — you can choose another one.</p>
            }
            @if (t.changeable) {
              <details class="wechsel" [open]="!t.id">
                <summary>{{ t.id ? 'Change image' : 'Choose an image' }}</summary>
                <nw-bildwahl [wert]="t.id ?? ''" klasse="token" label="Token" [fuer]="t.statblock" (wertChange)="bildSetzen(t.statblock, $event)" />
              </details>
            }
            @if (!t.id || !t.adjustable) {
              <div class="knoepfe">
                <button type="button" class="knopf" (click)="offen.set(false)" [disabled]="arbeitet()">Close</button>
              </div>
            }
            @if (fehler()) {
              <p class="fehler" role="alert">{{ fehler() }}</p>
            }
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
    /* Der Rand liegt über dem Bild (T-301): ein Ring aus Farbe oder Verlauf. */
    .beringt::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: 50%;
      padding: var(--ring-w, 0);
      background: var(--ring-bg, transparent);
      -webkit-mask:
        linear-gradient(#000 0 0) content-box,
        linear-gradient(#000 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
      pointer-events: none;
    }
    .kreis.rund {
      background: transparent;
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
    .raender {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
      border: 0;
      margin: 0 0 0.5rem;
      padding: 0;
    }
    .raender legend {
      padding: 0;
      margin-bottom: 0.25rem;
    }
    .rand {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.15rem;
      padding: 0.25rem;
      border: 1px solid transparent;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.75rem;
    }
    .rand.an {
      border-color: var(--accent);
    }
    .rand input {
      position: absolute;
      opacity: 0;
      pointer-events: none;
    }
    .rand:focus-within {
      outline: 2px solid var(--gold);
    }
    /* Der Schatten an der Hülle: an der Maske selbst schnitte sie ihn ab, und ein heller Rand verschwände auf hellem Grund. */
    .huelle {
      display: block;
      filter: drop-shadow(0 0 1px rgb(0 0 0 / 0.55));
    }
    .muster {
      display: block;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      box-shadow: inset 0 0 0 7px transparent;
      -webkit-mask: radial-gradient(circle, transparent 7px, #000 8px);
      mask: radial-gradient(circle, transparent 7px, #000 8px);
    }
    .muster.ohne {
      -webkit-mask: none;
      mask: none;
      border: 1px dashed var(--line);
    }
    .wechsel {
      margin: 0.5rem 0;
    }
    .wechsel summary {
      cursor: pointer;
    }
    .knoepfe {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .hinweis,
    .leer {
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
  /** Die eigenen Ränder zur Wahl (T-302); woher sie kommen, entscheidet E-205. */
  readonly raender = input<readonly TokenRing[]>([]);
  private readonly bestand = inject(Bestand);
  private readonly api = inject(Api);

  protected readonly KLEIN = 96;
  protected readonly GROSS = 220;
  protected readonly ZOOM_MAX = TOKEN_ZOOM_MAX;
  protected readonly RINGE = computed(() => tokenRings(this.raender()));
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

  protected adresse(id: string, version?: string): string | null {
    return bildAdresse(id, 'thumb', version ?? '');
  }
  protected stil(look: TokenLook): Record<string, string> {
    return tokenStil(look);
  }
  protected kreisStil(look: TokenLook, px: number): Record<string, string> {
    return { width: `${px}px`, height: `${px}px`, ...(ringStil(look, px, this.raender()) ?? {}) };
  }
  protected muster(r: TokenRing): string {
    return ringMuster(r);
  }

  protected oeffnen(t: { look?: TokenLook }): void {
    this.entwurf.set(t.look ? { ...t.look, frame: { ...t.look.frame } } : null);
    this.fehler.set(null);
    this.offen.set(true);
  }
  protected setzeRund(rund: boolean): void {
    this.entwurf.update((d) => (d ? { ...d, round: rund } : d));
  }
  protected setzeZoom(zoom: number): void {
    this.entwurf.update((d) => (d ? { ...d, frame: tokenFrame({ ...d.frame, zoom }) } : d));
  }
  protected setzeRing(ring: string): void {
    this.entwurf.update((d) => (d ? { ...d, frame: tokenFrame({ ...d.frame, ring }) } : d));
  }
  protected zuruecksetzen(): void {
    this.entwurf.update((d) => (d ? { ...d, frame: tokenFrame({ ring: d.frame.ring }) } : d));
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

  /** Ausschnitt, Rand und „fertig rund" — am Bild. */
  protected async speichern(assetId: string): Promise<void> {
    const d = this.entwurf();
    if (!d) return;
    await this.arbeiten(async () => {
      await this.bestand.oeffnen(assetId, true, false);
      const asset = this.bestand.voll().get(assetId);
      if (!asset) throw new Error('The image is not available.');
      const karte = { ...((asset.components?.['Asset'] ?? {}) as Record<string, unknown>), round: d.round, frame: { ...d.frame } };
      await this.api.putEntity({ ...asset, components: { ...asset.components, Asset: karte } });
      this.offen.set(false);
    });
  }

  /** Ein anderes Bild (T-301) — `Statblock.token` des Statblocks, der es trägt. */
  protected async bildSetzen(statblockId: string, assetId: string): Promise<void> {
    await this.arbeiten(async () => {
      await this.bestand.oeffnen(statblockId, true, false);
      const sb = this.bestand.voll().get(statblockId);
      if (!sb) throw new Error('The statblock is not available.');
      const karte = { ...((sb.components?.['Statblock'] ?? {}) as Record<string, unknown>) };
      if (assetId) karte['token'] = assetId;
      else delete karte['token'];
      await this.api.putEntity({ ...sb, components: { ...sb.components, Statblock: karte } });
      /* Der Dialog bleibt offen: mit dem neuen Bild lässt sich gleich der Ausschnitt setzen. */
      this.entwurf.set(null);
    });
    const neu = this.token();
    if (neu?.look) this.entwurf.set({ ...neu.look, frame: { ...neu.look.frame } });
  }

  private async arbeiten(was: () => Promise<void>): Promise<void> {
    this.arbeitet.set(true);
    this.fehler.set(null);
    try {
      await was();
      await this.bestand.oeffnen(this.artikel().id, true);
    } catch (error) {
      this.fehler.set(error instanceof ApiError ? error.message : error instanceof Error ? error.message : 'Could not save.');
    } finally {
      this.arbeitet.set(false);
    }
  }
}

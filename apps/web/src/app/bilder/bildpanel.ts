import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { imageFileProblem } from '@nw/model';
import type { Entity } from '@nw/model';
import { Api, ApiError, type BildVerwendung } from '../kern/api';
import { KurzLink } from '../kern/kurzansicht';
import { Session } from '../kern/session';
import { BildStand, bildVersion } from '../artikel/bild';

/**
 * **Alles am Bild, am Artikel** (T-119): wo es gezeigt wird, welche
 * Fassungen es hat, und „Replace image".
 *
 * Wo es gezeigt wird, ist eine Rückfrage am Server
 * (`GET /api/assets/:id/uses`) und nennt **nur, was dieser Betrachter
 * sieht** — zurückgehalten wird dort, nicht hier.
 *
 * Ersetzen fragt, was gemeint ist: eine **neue Fassung** (ein zweites
 * Asset mit `variantOf`; wer das alte zeigt, zeigt es weiter) oder die
 * **Quelle** (derselbe Artikel, eine neue Datei; jeder Verwender zeigt
 * sofort das neue Bild). Die Knöpfe stehen nur, wo der Server Ja sagen
 * wird — er prüft trotzdem.
 */
@Component({
  selector: 'nw-bildpanel',
  imports: [RouterLink, KurzLink],
  template: `
    <section class="kasten" aria-label="Where this image is used">
      <h2>Used in</h2>
      @if (verwendung(); as v) {
        @if (v.uses.length) {
          <ul class="kanten">
            @for (u of v.uses; track u.id + u.via) {
              <li>
                <span class="rl">{{ wo(u.via) }}</span>
                <a [routerLink]="['/artikel', u.id]" [nwQuick]="u.id">{{ u.name }}</a>
              </li>
            }
          </ul>
        } @else {
          <p class="leer">Nowhere you can see.</p>
        }
        @if (v.variantOf; as o) {
          <p class="fassung">New version of <a [routerLink]="['/artikel', o.id]" [nwQuick]="o.id">{{ o.name }}</a></p>
        }
        @if (v.variants.length) {
          <p class="fassung">
            Newer versions:
            @for (f of v.variants; track f.id) {
              @if (!$first) {<ng-container>, </ng-container>}
              <a [routerLink]="['/artikel', f.id]" [nwQuick]="f.id">{{ f.name }}</a>
            }
          </p>
        }
      } @else {
        <p class="leer">Loading…</p>
      }
    </section>

    @if (darfFassung() || darfQuelle()) {
      <section class="kasten" aria-label="Replace image">
        <h2>Replace image</h2>
        @if (!datei()) {
          <label class="knopf">
            <input type="file" (change)="gewaehlt($event)" [disabled]="laedt()" />
            Choose a new image…
          </label>
        } @else {
          <p>
            <b>{{ datei()!.name }}</b> — how should it replace this image?
          </p>
          <div class="wahl" role="group" aria-label="How to replace">
            @if (darfFassung()) {
              <button type="button" (click)="ersetze('fassung')" [disabled]="laedt()">
                <b>As a new version</b>
                <small>A second image that points back here. Everything showing this one keeps it until you switch it.</small>
              </button>
            }
            @if (darfQuelle()) {
              <button type="button" (click)="ersetze('quelle')" [disabled]="laedt()">
                <b>Replace the source</b>
                <small>Same article, new file. Everything showing this image shows the new one at once; the old file stays until the next backup.</small>
              </button>
            }
            <button type="button" class="leise" (click)="datei.set(null)" [disabled]="laedt()">Cancel</button>
          </div>
        }
        @if (laedt()) {
          <p role="status">Uploading…</p>
        }
        @if (problem(); as p) {
          <p class="fehler" role="alert">{{ p }}</p>
        }
      </section>
    }
  `,
  styles: `
    .leer,
    .fassung {
      color: var(--dim);
      margin: 0.3rem 0 0;
    }
    .knopf {
      display: inline-flex;
      align-items: center;
      min-height: 40px;
      padding: 0 0.8rem;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--paper);
      cursor: pointer;
    }
    .knopf input[type='file'] {
      position: absolute;
      width: 1px;
      height: 1px;
      opacity: 0;
    }
    .knopf:focus-within {
      outline: 2px solid var(--accent);
    }
    .wahl {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }
    .wahl button {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.15rem;
      padding: 0.5rem 0.7rem;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--paper);
      text-align: left;
      cursor: pointer;
      font: inherit;
    }
    .wahl button:hover,
    .wahl button:focus-visible {
      border-color: var(--accent);
    }
    .wahl small {
      color: var(--dim);
    }
    .wahl .leise {
      align-items: center;
    }
    .fehler {
      color: var(--accent);
    }
  `,
})
export class BildPanel {
  readonly artikel = input.required<Entity>();
  /** Ein anderer Artikel gilt (neue Fassung) oder derselbe neu (Quelle ersetzt). */
  readonly gewechselt = output<string>();

  private readonly api = inject(Api);
  private readonly session = inject(Session);
  private readonly bildStand = inject(BildStand);
  protected readonly verwendung = signal<BildVerwendung | null>(null);
  protected readonly datei = signal<File | null>(null);
  protected readonly laedt = signal(false);
  protected readonly problem = signal<string | null>(null);

  protected readonly darfQuelle = computed(() => this.session.darfSchreiben()(this.artikel().id));
  protected readonly darfFassung = computed(() => this.session.darfAnlegen());

  constructor() {
    effect(() => {
      const id = this.artikel().id;
      /* Die Revision gehört dazu: nach „Quelle ersetzen" ist es derselbe Artikel. */
      void this.artikel().revision;
      void this.lade(id);
    });
  }

  private geladen = '';
  private async lade(id: string): Promise<void> {
    /* Ein anderes Bild: erst leer. Dasselbe neu (nach dem Ersetzen): die Liste bleibt, bis die neue da ist. */
    if (this.geladen !== id) this.verwendung.set(null);
    this.geladen = id;
    try {
      const v = await this.api.assetUses(id);
      if (this.artikel().id === id) this.verwendung.set(v);
    } catch {
      if (this.artikel().id === id) this.verwendung.set({ uses: [], variants: [], variantOf: null });
    }
  }

  /** `Image.image` → „Image", `Map.sheets` → „Map layer", eine Kante bleibt ihr Wort. */
  protected wo(via: string): string {
    if (via === 'Map.sheets') return 'Map layer';
    const [typ, feld] = via.split('.');
    if (!feld) return via;
    return feld === 'image' ? 'Image' : feld === 'token' ? 'Token' : feld === 'background' ? 'Background' : `${typ} ${feld}`;
  }

  protected gewaehlt(ev: Event): void {
    const el = ev.target as HTMLInputElement;
    const f = el.files?.[0] ?? null;
    el.value = '';
    const nein = f && imageFileProblem(f);
    this.problem.set(nein || null);
    this.datei.set(nein ? null : f);
  }

  protected async ersetze(wie: 'fassung' | 'quelle'): Promise<void> {
    const f = this.datei();
    if (!f || this.laedt()) return;
    this.laedt.set(true);
    this.problem.set(null);
    try {
      const e = this.artikel();
      const neu =
        wie === 'fassung'
          ? await this.api.uploadAsset(f, { variantOf: e.id })
          : await this.api.replaceAssetFile(e.id, f, e.revision);
      this.datei.set(null);
      /* Dieselbe Id, eine neue Datei: jedes Bild mit dieser Id auf der Seite holt sie. */
      if (wie === 'quelle') this.bildStand.merke(neu.id, bildVersion(neu));
      this.gewechselt.emit(neu.id);
    } catch (err) {
      this.problem.set(
        err instanceof ApiError && err.status === 409
          ? 'This image changed since you opened it — reload and try again.'
          : err instanceof ApiError && err.status === 413
            ? 'This image is too large.'
            : err instanceof ApiError
              ? err.message
              : 'The upload failed — is the server reachable?',
      );
    } finally {
      this.laedt.set(false);
    }
  }
}

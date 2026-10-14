import { Component, computed, inject, input, output, signal } from '@angular/core';
import { primaryInterface, typeChain } from '@nw/model';
import type { Entity, Registry } from '@nw/model';
import { Api, ApiError } from '../kern/api';
import { Wahl } from './wahl';

/**
 * **Bilder zeigen und aufnehmen** (T-114, REQ-021).
 *
 * Ein Feld mit `format: 'asset'` (`Image.image`, `Statblock.token`,
 * `Map.background`) hält die **Id eines `Asset`-Artikels** — oder, für ein
 * Bild, das woanders liegt, eine Adresse. Wer ein Bild zeigt, fragt
 * `bildAdresse` und nie, wo die Datei liegt: so lässt sich die Ablage
 * wechseln (E-032), ohne eine Maske anzufassen.
 *
 * Zurückgehalten wird am Server: ein Bild, dessen Artikel man nicht sehen
 * darf, kommt als 404 — dann zeichnet `nw-bild` nichts, statt eines
 * zerbrochenen Bildes.
 */
export function bildAdresse(wert: unknown, groesse: 'thumb' | 'full' = 'full'): string | null {
  if (typeof wert !== 'string') return null;
  const w = wert.trim();
  if (!w) return null;
  if (/^https?:\/\//i.test(w)) return w;
  /* Eine Ablage-Id, die kein Artikel ist, gibt es nicht mehr — alles
     andere ist die Id eines Asset-Artikels. */
  if (!/^[\w~.:-]+$/.test(w)) return null;
  return `/api/assets/${encodeURIComponent(w)}${groesse === 'thumb' ? '?size=thumb' : ''}`;
}

/**
 * **Das Bild eines Artikels**, wie das Layout-Element `image` es zeigt:
 * an einem Asset die eigene Datei — sein Bild ist es selbst —, sonst
 * `Image.image`. Unterschrift und Alternativtext gehen mit.
 */
export function bildDes(e: Entity, r: Registry): { wert: string; caption: string; alt: string } | null {
  const karte = (e.components?.['Image'] ?? {}) as { image?: unknown; caption?: unknown; alt?: unknown };
  const caption = typeof karte.caption === 'string' ? karte.caption : '';
  const alt = typeof karte.alt === 'string' ? karte.alt : '';
  const asset = e.components?.['Asset'] as { ref?: unknown } | undefined;
  if (typeof asset?.ref === 'string' && asset.ref && typeChain(r, primaryInterface(e)).includes('Asset')) {
    return { wert: e.id, caption, alt };
  }
  return typeof karte.image === 'string' && karte.image.trim() ? { wert: karte.image.trim(), caption, alt } : null;
}

/** Ein Bild, aus einem Asset-Feld. `groesse: 'thumb'` holt die Vorschau (480 px). */
@Component({
  selector: 'nw-bild',
  template: `
    @if (adresse(); as a) {
      @if (!istKaputt()) {
        <figure class="bild" [class.klein]="groesse() === 'thumb'">
          @if (gross(); as g) {
            <a [href]="g" target="_blank" rel="noopener" [attr.aria-label]="'Open image ' + (alt() || '')">
              <img [src]="a" [alt]="alt() || caption() || ''" loading="lazy" decoding="async" (error)="nichtGeladen()" />
            </a>
          } @else {
            <img [src]="a" [alt]="alt() || caption() || ''" loading="lazy" decoding="async" (error)="nichtGeladen()" />
          }
          @if (caption()) {
            <figcaption>{{ caption() }}</figcaption>
          }
        </figure>
      }
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .bild {
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    img {
      display: block;
      max-width: 100%;
      max-height: 70vh;
      height: auto;
      border-radius: 6px;
      border: 1px solid var(--line);
      background: var(--paper);
      object-fit: contain;
    }
    .klein img {
      max-height: 14rem;
    }
    figcaption {
      font-style: italic;
      color: var(--dim);
      font-size: 0.9rem;
    }
  `,
})
export class Bild {
  readonly wert = input<unknown>(undefined);
  readonly groesse = input<'thumb' | 'full'>('full');
  readonly alt = input<string>('');
  readonly caption = input<string>('');
  /** Ein Klick öffnet das Bild in voller Grösse (an der Vorschau und auf der Seite). */
  readonly oeffnen = input(true);

  protected readonly adresse = computed(() => bildAdresse(this.wert(), this.groesse()));
  /* Welche Adresse nicht geladen hat — ein neues Bild darf es wieder versuchen. */
  private readonly fehlte = signal<string | null>(null);
  protected readonly istKaputt = computed(() => this.fehlte() !== null && this.fehlte() === this.adresse());
  protected nichtGeladen(): void {
    this.fehlte.set(this.adresse());
  }
  protected readonly gross = computed(() => (this.oeffnen() ? bildAdresse(this.wert(), 'full') : null));
}

/**
 * **Die Eingabe für ein Bild** (`format: 'asset'`): hochladen — als Datei,
 * durch Ziehen, durch Einfügen aus der Zwischenablage, mit der Kamera des
 * Telefons —, ein vorhandenes Asset wählen oder eine Adresse nennen.
 *
 * Hochgeladen wird sofort, nicht erst beim Speichern des Artikels: das
 * Asset ist ein eigener Artikel, und das Feld hält danach nur seine Id.
 * `fuer` ist der Artikel, an dem das Feld steht — das Bild übernimmt seine
 * Sichtbarkeit, damit das Porträt eines verborgenen NSC nicht offen liegt.
 */
@Component({
  selector: 'nw-bildwahl',
  imports: [Bild, Wahl],
  template: `
    <div
      class="bildwahl"
      [class.drueber]="drueber()"
      tabindex="0"
      [attr.aria-label]="label() + ': drop or paste an image'"
      (dragover)="ueber($event)"
      (dragleave)="drueber.set(false)"
      (drop)="fallen($event)"
      (paste)="einfuegen($event)"
    >
      @if (wert()) {
        <div class="jetzt">
          <nw-bild [wert]="wert()" groesse="thumb" [oeffnen]="false" />
          <button type="button" class="klein" (click)="setze('')">Remove image</button>
        </div>
      }
      <div class="wege">
        <label class="knopf">
          <input type="file" accept="image/*" (change)="gewaehlt($event)" [disabled]="laedt()" />
          {{ laedt() ? 'Uploading…' : 'Upload image' }}
        </label>
        <label class="knopf kamera">
          <input type="file" accept="image/*" capture="environment" (change)="gewaehlt($event)" [disabled]="laedt()" />
          Take photo
        </label>
        <button type="button" class="knopf" (click)="modus.set(modus() === 'wahl' ? null : 'wahl')" [attr.aria-expanded]="modus() === 'wahl'">
          Choose existing
        </button>
        <button type="button" class="knopf" (click)="modus.set(modus() === 'adresse' ? null : 'adresse')" [attr.aria-expanded]="modus() === 'adresse'">
          Web address
        </button>
      </div>
      <p class="hinweis">…or drop an image here, or paste one (Ctrl+V).</p>
      @if (modus() === 'wahl') {
        <nw-wahl [wert]="istAdresse() ? '' : wert()" (wertChange)="setze($event)" [arten]="['Asset']" [label]="label() + ': existing image'" />
      }
      @if (modus() === 'adresse') {
        <input
          type="url"
          placeholder="https://…"
          [value]="istAdresse() ? wert() : ''"
          [attr.aria-label]="label() + ': web address'"
          (change)="adresse($any($event.target).value)"
        />
      }
      @if (problem(); as p) {
        <p class="fehler" role="alert">{{ p }}</p>
      }
    </div>
  `,
  styles: `
    .bildwahl {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      padding: 0.5rem;
      border: 1px dashed var(--line);
      border-radius: 6px;
      flex: 1;
      min-width: 0;
    }
    .bildwahl.drueber {
      border-color: var(--accent);
      background: color-mix(in srgb, var(--accent) 8%, transparent);
    }
    .jetzt {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      align-items: flex-end;
    }
    .jetzt nw-bild {
      max-width: 12rem;
    }
    .wege {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
    }
    .knopf {
      display: inline-flex;
      align-items: center;
      min-height: 36px;
      padding: 0 0.7rem;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--paper);
      cursor: pointer;
      font: inherit;
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
    /* Die Kamera gibt es nur am Telefon; am Desktop ist es ein zweiter Dateiknopf. */
    @media (hover: hover) and (pointer: fine) {
      .kamera {
        display: none;
      }
    }
    .hinweis {
      margin: 0;
      color: var(--dim);
      font-size: 0.85rem;
    }
    .fehler {
      margin: 0;
      color: var(--accent);
    }
    .klein {
      min-height: 0;
      padding: 0.1rem 0.5rem;
    }
  `,
})
export class BildWahl {
  readonly wert = input<string>('');
  /** Der Artikel, an dem das Feld steht — das Bild übernimmt seine Sichtbarkeit. */
  readonly fuer = input<string>('');
  readonly label = input<string>('Image');
  readonly wertChange = output<string>();

  private readonly api = inject(Api);
  protected readonly laedt = signal(false);
  protected readonly problem = signal<string | null>(null);
  protected readonly drueber = signal(false);
  protected readonly modus = signal<'wahl' | 'adresse' | null>(null);
  protected readonly istAdresse = computed(() => /^https?:\/\//i.test(this.wert() ?? ''));

  protected setze(w: string): void {
    this.problem.set(null);
    this.wertChange.emit(w);
  }

  protected adresse(roh: string): void {
    const w = roh.trim();
    if (w && !/^https?:\/\//i.test(w)) {
      this.problem.set('A web address starts with https://');
      return;
    }
    this.setze(w);
  }

  protected gewaehlt(ev: Event): void {
    const el = ev.target as HTMLInputElement;
    const datei = el.files?.[0];
    el.value = '';
    if (datei) void this.hoch(datei);
  }

  protected ueber(ev: DragEvent): void {
    if (!ev.dataTransfer?.types?.includes('Files')) return;
    ev.preventDefault();
    this.drueber.set(true);
  }

  protected fallen(ev: DragEvent): void {
    this.drueber.set(false);
    const datei = [...(ev.dataTransfer?.files ?? [])].find((f) => f.type.startsWith('image/'));
    if (!datei) return;
    ev.preventDefault();
    void this.hoch(datei);
  }

  protected einfuegen(ev: ClipboardEvent): void {
    const datei = [...(ev.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'));
    if (!datei) return;
    ev.preventDefault();
    void this.hoch(datei);
  }

  /** Lädt hoch und setzt das Feld auf das neue Asset. */
  async hoch(datei: File): Promise<void> {
    if (this.laedt()) return;
    this.laedt.set(true);
    this.problem.set(null);
    try {
      const a = await this.api.uploadAsset(datei, { ...(this.fuer() ? { for: this.fuer() } : {}) });
      this.modus.set(null);
      this.wertChange.emit(a.id);
    } catch (e) {
      this.problem.set(
        e instanceof ApiError && e.status === 413
          ? 'This image is too large.'
          : e instanceof ApiError
            ? e.message
            : 'The upload failed — is the server reachable?',
      );
    } finally {
      this.laedt.set(false);
    }
  }
}

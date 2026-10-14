import { Component, Injectable, computed, effect, inject, input, output, signal } from '@angular/core';
import { primaryInterface, typeChain } from '@nw/model';
import type { Entity, Registry } from '@nw/model';
import { Api, ApiError, type ListenZeile } from '../kern/api';
import { Ladeanzeige } from '../kern/ladeanzeige';

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
export function bildAdresse(wert: unknown, groesse: 'thumb' | 'full' = 'full', version = ''): string | null {
  if (typeof wert !== 'string') return null;
  const w = wert.trim();
  if (!w) return null;
  if (/^https?:\/\//i.test(w)) return w;
  /* Eine Ablage-Id, die kein Artikel ist, gibt es nicht mehr — alles
     andere ist die Id eines Asset-Artikels. */
  if (!/^[\w~.:-]+$/.test(w)) return null;
  /* Mit Version (der Hash aus `ref`): eine neue Quelle ist eine neue
     Adresse, und der Browser zeigt nicht das alte Bild weiter (T-119). */
  const frage = [groesse === 'thumb' ? 'size=thumb' : '', /^[\w-]+$/.test(version) ? `v=${version}` : ''].filter(Boolean).join('&');
  return `/api/assets/${encodeURIComponent(w)}${frage ? `?${frage}` : ''}`;
}

/** Die Version einer Datei, wie der Server sie in `?v=` erwartet: der Hash vor der Endung. */
export function bildVersion(e: Entity): string {
  const ref = (e.components?.['Asset'] as { ref?: unknown } | undefined)?.ref;
  return typeof ref === 'string' ? (ref.split('.')[0] ?? '') : '';
}

/**
 * **Welche Quelle ein Bild in dieser Sitzung zuletzt bekam** (T-119):
 * nach „Replace the source" ist es dieselbe Id mit einer neuen Datei. Wer
 * die Id zeigt, kennt die Datei nicht — also merkt sich die Seite die
 * neue Version, und jedes `nw-bild` mit dieser Id fragt danach. Ein
 * anderes Gerät lädt beim nächsten Öffnen ohnehin neu (`no-cache`).
 */
@Injectable({ providedIn: 'root' })
export class BildStand {
  private readonly stand = signal(new Map<string, string>());
  readonly version = computed(() => {
    const m = this.stand();
    return (id: string) => m.get(id) ?? '';
  });
  merke(id: string, version: string): void {
    const m = new Map(this.stand());
    m.set(id, version);
    this.stand.set(m);
  }
}

/**
 * **Das Bild eines Artikels**, wie das Layout-Element `image` es zeigt:
 * an einem Asset die eigene Datei — sein Bild ist es selbst —, sonst
 * `Image.image`. Unterschrift und Alternativtext gehen mit.
 */
export function bildDes(e: Entity, r: Registry): { wert: string; caption: string; alt: string; version?: string } | null {
  const karte = (e.components?.['Image'] ?? {}) as { image?: unknown; caption?: unknown; alt?: unknown };
  const caption = typeof karte.caption === 'string' ? karte.caption : '';
  const alt = typeof karte.alt === 'string' ? karte.alt : '';
  const asset = e.components?.['Asset'] as { ref?: unknown } | undefined;
  if (typeof asset?.ref === 'string' && asset.ref && typeChain(r, primaryInterface(e)).includes('Asset')) {
    return { wert: e.id, caption, alt, version: bildVersion(e) };
  }
  return typeof karte.image === 'string' && karte.image.trim() ? { wert: karte.image.trim(), caption, alt } : null;
}

/** Ein Bild, aus einem Asset-Feld. `groesse: 'thumb'` holt die Vorschau (480 px). */
@Component({
  selector: 'nw-bild',
  imports: [Ladeanzeige],
  template: `
    @if (adresse(); as a) {
      @if (!istKaputt()) {
        <figure class="bild" [class.klein]="groesse() === 'thumb'" [class.laedt]="laedt()">
          <!-- Ein grosses Bild zeigt, dass es lädt (T-126); eine Vorschau
               ist zu klein, als dass man darauf wartet. -->
          @if (laedt()) {
            <nw-ladeanzeige class="anzeige" />
          }
          @if (gross(); as g) {
            <a [href]="g" target="_blank" rel="noopener" [attr.aria-label]="'Open image ' + (alt() || '')">
              <img [src]="a" [alt]="alt() || caption() || ''" loading="lazy" decoding="async" (load)="istDa(a)" (error)="nichtGeladen()" />
            </a>
          } @else {
            <img [src]="a" [alt]="alt() || caption() || ''" loading="lazy" decoding="async" (load)="istDa(a)" (error)="nichtGeladen()" />
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
      position: relative;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    /* Solange es lädt, hat das Bild keine Höhe — die Anzeige braucht eine. */
    .bild.laedt {
      min-height: 8rem;
    }
    .anzeige {
      position: absolute;
      inset: 0;
      pointer-events: none;
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
  /** Die Version der Datei, wenn bekannt (am Asset selbst); sonst, was diese Sitzung zuletzt ersetzt hat. */
  readonly version = input<string | undefined>('');

  private readonly bildStand = inject(BildStand);
  private readonly v = computed(() => this.version() || (typeof this.wert() === 'string' ? this.bildStand.version()(String(this.wert()).trim()) : ''));
  protected readonly adresse = computed(() => bildAdresse(this.wert(), this.groesse(), this.v()));
  /* Welche Adresse nicht geladen hat — ein neues Bild darf es wieder versuchen. */
  private readonly fehlte = signal<string | null>(null);
  protected readonly istKaputt = computed(() => this.fehlte() !== null && this.fehlte() === this.adresse());
  protected nichtGeladen(): void {
    this.fehlte.set(this.adresse());
  }
  /* Welche Adresse schon da ist (T-126): ein neues Bild lädt wieder. */
  private readonly da = signal<string | null>(null);
  protected istDa(a: string): void {
    this.da.set(a);
  }
  protected readonly laedt = computed(
    () => this.groesse() === 'full' && !!this.adresse() && this.da() !== this.adresse() && !this.istKaputt(),
  );
  protected readonly gross = computed(() => (this.oeffnen() ? bildAdresse(this.wert(), 'full', this.v()) : null));
}

/** Wie eine Klasse heisst (T-119) — die Werte stehen in `Asset.kind`, die Worte hier nur für die Knöpfe. */
export function klassenName(k: string): string {
  return ({ image: 'images', map: 'map images', token: 'tokens', prop: 'props' } as Record<string, string>)[k] ?? k;
}

/**
 * **Ein vorhandenes Bild wählen** (T-119): Vorschaubilder statt Namen —
 * ein Bild erkennt man am Bild. Zuerst die Klasse, die das Feld anbietet
 * (`klasse`, aus `target.where`), auf Knopfdruck alle. Gesucht wird am
 * Server (`/api/list`), gesiebt wie jede Liste.
 */
@Component({
  selector: 'nw-bildraster',
  imports: [Bild],
  template: `
    <div class="raster-kopf">
      <input type="search" placeholder="Search images…" [attr.aria-label]="label() + ': search images'" (input)="suche.set($any($event.target).value)" />
      @if (klasse()) {
        <label class="alle"><input type="checkbox" [checked]="alle()" (change)="alle.set($any($event.target).checked)" /> all classes, not only {{ klassenName(klasse()) }}</label>
      }
    </div>
    @if (treffer().length) {
      <ul class="raster" [attr.aria-label]="label() + ': existing images'">
        @for (z of treffer(); track z.id) {
          <li>
            <button type="button" (click)="gewaehlt.emit(z.id)" [attr.aria-label]="'Choose ' + z.name">
              <nw-bild [wert]="z.id" groesse="thumb" [oeffnen]="false" [alt]="z.name" />
              <span>{{ z.name }}</span>
            </button>
          </li>
        }
      </ul>
    } @else {
      <p class="leer">{{ laedt() ? 'Loading…' : 'No image of this class yet.' }}</p>
    }
  `,
  styles: `
    .raster-kopf {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      align-items: center;
    }
    .raster-kopf input[type='search'] {
      flex: 1;
      min-width: 10rem;
      min-height: 36px;
    }
    .alle {
      display: inline-flex;
      gap: 0.3rem;
      align-items: center;
      font-size: 0.9rem;
    }
    .raster {
      list-style: none;
      margin: 0.4rem 0 0;
      padding: 0;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(6.5rem, 1fr));
      gap: 0.4rem;
      max-height: 18rem;
      overflow-y: auto;
    }
    .raster button {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      width: 100%;
      padding: 0.25rem;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--paper);
      cursor: pointer;
      font: inherit;
      font-size: 0.8rem;
      text-align: left;
    }
    .raster button:hover,
    .raster button:focus-visible {
      border-color: var(--accent);
    }
    .raster nw-bild ::ng-deep img {
      height: 5rem;
      width: 100%;
      object-fit: cover;
    }
    .raster span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .leer {
      margin: 0.4rem 0 0;
      color: var(--dim);
    }
  `,
})
export class BildRaster {
  readonly klasse = input<string>('');
  readonly label = input<string>('Image');
  readonly gewaehlt = output<string>();

  private readonly api = inject(Api);
  protected readonly suche = signal('');
  protected readonly alle = signal(false);
  protected readonly treffer = signal<ListenZeile[]>([]);
  protected readonly laedt = signal(false);
  protected readonly klassenName = klassenName;
  private lauf = 0;

  constructor() {
    effect(() => {
      const k = this.klasse();
      const q = this.suche().trim();
      const alle = this.alle();
      void this.hole(k && !alle ? [`Asset.kind:${k}`] : [], q);
    });
  }

  private async hole(f: string[], q: string): Promise<void> {
    const nr = ++this.lauf;
    this.laedt.set(true);
    try {
      const r = await this.api.list({ type: 'Asset', f, q: q || undefined, limit: 48 });
      if (nr === this.lauf) this.treffer.set(r.rows);
    } catch {
      if (nr === this.lauf) this.treffer.set([]);
    } finally {
      if (nr === this.lauf) this.laedt.set(false);
    }
  }
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
  imports: [Bild, BildRaster],
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
        <nw-bildraster [klasse]="klasse()" [label]="label()" (gewaehlt)="setze($event); modus.set(null)" />
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
  /** Die Klasse, die das Feld anbietet (T-119): ein neues Bild bekommt sie, die Auswahl zeigt sie zuerst. */
  readonly klasse = input<string>('');
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
      const a = await this.api.uploadAsset(datei, {
        ...(this.fuer() ? { for: this.fuer() } : {}),
        ...(this.klasse() ? { kind: this.klasse() } : {}),
      });
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

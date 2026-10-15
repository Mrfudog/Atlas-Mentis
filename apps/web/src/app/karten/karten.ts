import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MAP_TYPE, fromImage } from '@nw/model';
import { Api, type KartenZeile } from '../kern/api';
import { Session } from '../kern/session';
import { Bild, BildWahl } from '../artikel/bild';

/**
 * **Play › Maps** (T-202, `/maps`): der feste Ort für Karten. Eine Liste
 * mit Vorschaubild, Unterkarten eingerückt unter ihrer Karte (`mapTree`),
 * gefiltert nach Ebene, Marke und Namen; dazu „New map“ — ein Kartenbild
 * hochladen oder wählen, und die Karte steht da (`fromImage` → `mapFromImage`, in der
 * Schreibebene).
 *
 * Vorher hiess „eine Karte anlegen“: im Kompendium die Art Map finden,
 * „New article“, dann das Bild — und wer ein Kartenbild hochgeladen hatte,
 * hielt das für die Karte. Gerechnet und gesiebt wird am Server
 * (`GET /api/maps`); gefiltert hier, weil Karten wenige sind und ein Filter
 * die Einrückung nicht zerreissen darf: die Karten über einem Treffer
 * bleiben stehen, blass.
 */
@Component({
  selector: 'nw-karten',
  imports: [Bild, BildWahl, RouterLink],
  template: `
    <div class="seite">
      <header class="kopf">
        <h1>Maps</h1>
        <div class="taten">
          <a routerLink="/play">Back to the table</a>
          <button type="button" class="haupt" (click)="neu.set(!neu())" [attr.aria-expanded]="neu()">New map</button>
        </div>
      </header>

      @if (neu() || leer()) {
        <section class="neu" aria-label="New map">
          <p class="hilfe">A map is an image with a grid. Pick an image or upload one.</p>
          <nw-bildwahl klasse="map" label="Map image" (wertChange)="ausBild($event)" />
          @if (legtAn()) {
            <p class="dim">Creating the map…</p>
          }
          @if (problem(); as p) {
            <p class="fehler" role="alert">{{ p }}</p>
          }
        </section>
      }

      @if (zeilen().length) {
        <div class="filter" role="search">
          <input type="search" placeholder="Search maps…" aria-label="Search maps" [value]="suche()" (input)="suche.set($any($event.target).value)" />
          @if (ebenen().length > 1) {
            <select aria-label="Layer" [value]="ebene()" (change)="ebene.set($any($event.target).value)">
              <option value="">All layers</option>
              @for (l of ebenen(); track l.id) {
                <option [value]="l.id">{{ l.name }}</option>
              }
            </select>
          }
          @for (t of marken(); track t) {
            <button type="button" class="chip" [class.an]="marke() === t" [attr.aria-pressed]="marke() === t" (click)="marke.set(marke() === t ? '' : t)">
              {{ t }}
            </button>
          }
        </div>
      }

      @if (fehler(); as f) {
        <p class="fehler" role="alert">{{ f }}</p>
      } @else if (laedt()) {
        <p class="dim">Loading…</p>
      } @else if (zeilen().length && !gezeigt().length) {
        <p class="dim">No map matches.</p>
      }

      <ul class="liste" aria-label="Maps">
        @for (z of gezeigt(); track z.zeile.id) {
          <li [style.--tiefe]="z.zeile.depth" [class.pfad]="!z.treffer">
            <a class="vorschau" [routerLink]="['/play']" [queryParams]="{ map: z.zeile.id }" [attr.aria-label]="'Open ' + z.zeile.name + ' in Play'">
              @if (z.zeile.image) {
                <nw-bild [wert]="z.zeile.image" groesse="thumb" [oeffnen]="false" [alt]="z.zeile.name" />
              } @else {
                <span class="ohne">no image</span>
              }
            </a>
            <div class="text">
              <a class="name" [routerLink]="['/artikel', z.zeile.id]">{{ z.zeile.name }}</a>
              <span class="dim">
                {{ z.zeile.kind }}
                @for (l of z.zeile.layers; track l.id) {
                  · {{ l.name }}
                }
              </span>
              @if (z.zeile.tags.length) {
                <span class="marken">{{ z.zeile.tags.join(', ') }}</span>
              }
            </div>
            <a class="spielen" [routerLink]="['/play']" [queryParams]="{ map: z.zeile.id }">Open in Play</a>
          </li>
        }
      </ul>
    </div>
  `,
  styles: `
    .seite {
      padding: 1rem 1.5rem 2rem;
      max-width: 60rem;
    }
    .kopf {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem 1.5rem;
      margin-bottom: 0.75rem;
    }
    h1 {
      margin: 0;
      font-family: var(--caps);
      font-size: 1.6rem;
      color: var(--accent);
    }
    .taten {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem 1rem;
    }
    .neu {
      margin-bottom: 1rem;
      padding: 0.75rem;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--surface);
    }
    .hilfe {
      margin: 0 0 0.5rem;
    }
    .filter {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      align-items: center;
      margin-bottom: 0.75rem;
    }
    .filter input[type='search'] {
      flex: 1;
      min-width: 10rem;
      min-height: 36px;
    }
    .filter select {
      min-height: 36px;
    }
    .chip {
      min-height: 32px;
      padding: 0.1rem 0.6rem;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--paper);
    }
    .chip.an {
      border-color: var(--accent);
      background: color-mix(in srgb, var(--accent) 14%, transparent);
    }
    .liste {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }
    .liste li {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-left: calc(var(--tiefe, 0) * 1.5rem);
      padding: 0.35rem;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--paper);
    }
    .liste li.pfad {
      opacity: 0.55;
    }
    .vorschau {
      flex: none;
      width: 6rem;
      text-decoration: none;
    }
    .vorschau nw-bild ::ng-deep img {
      width: 6rem;
      height: 4rem;
      object-fit: cover;
    }
    .ohne {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 6rem;
      height: 4rem;
      border: 1px dashed var(--line);
      border-radius: 6px;
      color: var(--dim);
      font-size: 0.8rem;
    }
    .text {
      display: flex;
      flex-direction: column;
      min-width: 0;
      flex: 1;
    }
    .name {
      font-weight: 700;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .marken {
      font-size: 0.85rem;
      color: var(--dim);
      font-style: italic;
    }
    .spielen {
      flex: none;
      white-space: nowrap;
    }
    .dim {
      color: var(--dim);
    }
    .fehler {
      color: var(--danger, #a33);
    }
    @media (max-width: 640px) {
      .seite {
        padding: 0.75rem 1rem 1.5rem;
      }
      .liste li {
        margin-left: calc(var(--tiefe, 0) * 0.75rem);
        flex-wrap: wrap;
      }
      .vorschau,
      .vorschau nw-bild ::ng-deep img,
      .ohne {
        width: 4.5rem;
        height: 3rem;
      }
    }
  `,
})
export class Karten {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly session = inject(Session);

  protected readonly zeilen = signal<KartenZeile[]>([]);
  protected readonly laedt = signal(true);
  protected readonly fehler = signal<string | null>(null);
  protected readonly neu = signal(false);
  protected readonly legtAn = signal(false);
  protected readonly problem = signal<string | null>(null);

  protected readonly suche = signal('');
  protected readonly ebene = signal('');
  protected readonly marke = signal('');

  /** Ohne Karten steht die Kurz-Hilfe mit „New map“ gleich offen. */
  protected readonly leer = computed(() => !this.laedt() && !this.fehler() && !this.zeilen().length);

  protected readonly ebenen = computed(() => {
    const m = new Map<string, string>();
    for (const z of this.zeilen()) for (const l of z.layers) m.set(l.id, l.name);
    return [...m].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'de'));
  });
  protected readonly marken = computed(() =>
    [...new Set(this.zeilen().flatMap((z) => z.tags))].sort((a, b) => a.localeCompare(b, 'de')),
  );

  /**
   * Was der Filter zeigt: die Treffer und die Karten über ihnen — sonst
   * stünde eine Unterkarte eingerückt unter nichts.
   */
  protected readonly gezeigt = computed(() => kartenGefiltert(this.zeilen(), this.suche(), this.ebene(), this.marke()));

  constructor() {
    void this.holen();
  }

  private async holen(): Promise<void> {
    this.laedt.set(true);
    try {
      this.zeilen.set((await this.api.maps()).maps);
      this.fehler.set(null);
    } catch (e) {
      this.fehler.set(e instanceof Error ? e.message : 'Could not load the maps.');
    } finally {
      this.laedt.set(false);
    }
  }

  /** Aus dem gewählten oder hochgeladenen Bild eine Karte und zu ihr hin. */
  protected async ausBild(assetId: string): Promise<void> {
    if (!assetId || this.legtAn()) return;
    this.legtAn.set(true);
    this.problem.set(null);
    try {
      const bild = await this.api.entity(assetId);
      const neu = fromImage(MAP_TYPE, bild);
      const e = await this.api.createEntity(neu.type, neu.name, neu.fields);
      /* Was eine Spielerin anlegt, darf sie schreiben (REQ-237). */
      if (!this.session.isAdmin()) await this.session.load(true);
      await this.router.navigate(['/artikel', e.id]);
    } catch (e) {
      this.problem.set(e instanceof Error ? e.message : 'Could not create the map.');
    } finally {
      this.legtAn.set(false);
    }
  }
}

/** Der Filter der Kartenliste: Treffer und die Karten über ihnen (`treffer: false`). */
export function kartenGefiltert(
  zeilen: readonly KartenZeile[],
  suche: string,
  ebene: string,
  marke: string,
): { zeile: KartenZeile; treffer: boolean }[] {
  const q = suche.trim().toLowerCase();
  const passt = (z: KartenZeile) =>
    (!q || z.name.toLowerCase().includes(q)) &&
    (!ebene || z.layers.some((l) => l.id === ebene)) &&
    (!marke || z.tags.includes(marke));
  const byId = new Map(zeilen.map((z) => [z.id, z]));
  const treffer = new Set(zeilen.filter(passt).map((z) => z.id));
  const pfad = new Set<string>();
  for (const id of treffer) {
    let oben = byId.get(id)?.parent ?? null;
    while (oben && !pfad.has(oben) && !treffer.has(oben)) {
      pfad.add(oben);
      oben = byId.get(oben)?.parent ?? null;
    }
  }
  return zeilen.filter((z) => treffer.has(z.id) || pfad.has(z.id)).map((zeile) => ({ zeile, treffer: treffer.has(zeile.id) }));
}

import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api, ApiError, type BulkAntwort, type Liste, type ListenZeile } from '../kern/api';
import { KurzLink } from '../kern/kurzansicht';
import { Session } from '../kern/session';
import { Bild, klassenName } from '../artikel/bild';

const KLASSE = 'Asset.kind';
const BLATT = 60;

/**
 * **Die Galerie** (T-119, `/images`): alle Bilder, die dieser Betrachter
 * sieht, als Raster. Gefiltert wird nach Klasse, Marken, Ebene und
 * „unused", gesucht nach Namen — gerechnet am Server über dieselbe Liste
 * wie das Kompendium (`/api/list?type=Asset`), also gesiebt wie sie.
 *
 * Ein Klick zeigt die Kurzansicht, „Open article" führt zum Bild als
 * Artikel; dort steht alles andere (Marken, Sichtbarkeit, Quelle, wo es
 * verwendet wird, ersetzen). **Marken für viele auf einmal** setzt die
 * Leitung über die Massenänderung der Werkbank (`/api/bulk`) — mit
 * Rückgängig, wie dort.
 */
@Component({
  selector: 'nw-galerie',
  imports: [Bild, KurzLink, RouterLink],
  template: `
    <div class="seite">
      <aside class="filter" aria-label="Filter images">
        <details class="faltbar" [open]="breit()">
          <summary>Filters</summary>
          <label class="suche">
            <span class="leg">Search</span>
            <input type="search" placeholder="Name…" [value]="suche()" (input)="suche.set($any($event.target).value)" />
          </label>

          <fieldset>
            <legend class="leg">Class</legend>
            @for (o of klassen(); track o.value) {
              <label class="haken">
                <input type="checkbox" [checked]="klasse().includes(o.value)" (change)="umschalten(klasse, o.value)" />
                {{ o.value }} <span class="zahl">{{ o.count }}</span>
              </label>
            }
          </fieldset>

          <label class="haken">
            <input type="checkbox" [checked]="unbenutzt()" (change)="unbenutzt.set($any($event.target).checked)" />
            Unused <span class="dim">— shown nowhere you can see</span>
          </label>

          @if (marken().length) {
            <fieldset>
              <legend class="leg">Tags</legend>
              <div class="chips">
                @for (t of marken(); track t.tag) {
                  <button type="button" class="chip" [class.an]="markeAn().includes(t.tag)" [attr.aria-pressed]="markeAn().includes(t.tag)" (click)="umschalten(markeAn, t.tag)">
                    {{ t.tag }} <span class="zahl">{{ t.count }}</span>
                  </button>
                }
              </div>
            </fieldset>
          }

          @if (ebenen().length > 1) {
            <fieldset>
              <legend class="leg">Layer</legend>
              @for (l of ebenen(); track l.id) {
                <label class="haken">
                  <input type="checkbox" [checked]="ebene().includes(l.id)" (change)="umschalten(ebene, l.id)" />
                  {{ l.name }} <span class="zahl">{{ l.count }}</span>
                </label>
              }
            </fieldset>
          }
        </details>

        @if (session.darfAnlegen()) {
          <div class="hoch">
            <span class="leg">Upload</span>
            <select [value]="neueKlasse()" (change)="neueKlasse.set($any($event.target).value)" aria-label="Class of the new image">
              @for (k of ALLE_KLASSEN; track k) {
                <option [value]="k">{{ k }}</option>
              }
            </select>
            <label class="knopf">
              <input type="file" accept="image/*" multiple (change)="hochladen($event)" [disabled]="laedt()" />
              {{ laedt() ? 'Uploading…' : 'Upload images' }}
            </label>
          </div>
        }
      </aside>

      <main class="inhalt">
        <header class="kopf">
          <h1>Images</h1>
          <span class="dim" role="status">{{ liste()?.total ?? 0 }} {{ (liste()?.total ?? 0) === 1 ? 'image' : 'images' }}</span>
        </header>

        @if (session.leitung() && auswahl().length) {
          <div class="massen" role="region" aria-label="Selected images">
            <b>{{ auswahl().length }} selected</b>
            <input type="text" placeholder="tag" [value]="neueMarke()" (input)="neueMarke.set($any($event.target).value)" aria-label="Tag for the selected images" />
            <button type="button" (click)="marke('addTag')" [disabled]="!neueMarke().trim() || arbeitet()">Add tag</button>
            <button type="button" (click)="marke('removeTag')" [disabled]="!neueMarke().trim() || arbeitet()">Remove tag</button>
            <button type="button" class="leise" (click)="auswahl.set([])">Clear selection</button>
          </div>
        }
        @if (ergebnis(); as r) {
          <p class="ergebnis" role="status">
            {{ r.text }}
            @if (r.lauf) {
              <button type="button" class="leise" (click)="zurueck(r.lauf)">Undo</button>
            }
          </p>
        }
        @if (problem(); as p) {
          <p class="fehler" role="alert">{{ p }}</p>
        }

        @if (zeilen().length) {
          <ul class="raster" aria-label="Images">
            @for (z of zeilen(); track z.id) {
              <li class="kachel" [class.gewaehlt]="auswahl().includes(z.id)">
                @if (session.leitung()) {
                  <input class="waehler" type="checkbox" [checked]="auswahl().includes(z.id)" (change)="umschalten(auswahl, z.id)" [attr.aria-label]="'Select ' + z.name" />
                }
                <a [routerLink]="['/artikel', z.id]" [nwQuick]="z.id" class="bildlink">
                  <nw-bild [wert]="z.id" groesse="thumb" [oeffnen]="false" [alt]="z.name" />
                  <span class="name">{{ z.name }}</span>
                </a>
                <span class="meta">
                  <span class="klasse">{{ klasseVon(z) }}</span>
                  @for (t of z.tags ?? []; track t) {
                    <span class="marke">{{ t }}</span>
                  }
                </span>
              </li>
            }
          </ul>
          @if ((liste()?.total ?? 0) > zeilen().length) {
            <button type="button" class="mehr" (click)="mehr()" [disabled]="holt()">Show more</button>
          }
        } @else if (!holt()) {
          <p class="leer">No images match.</p>
        }
      </main>
    </div>
  `,
  styleUrl: './galerie.scss',
})
export class Galerie {
  protected readonly session = inject(Session);
  private readonly api = inject(Api);
  protected readonly ALLE_KLASSEN = ['image', 'map', 'token', 'prop'];
  protected readonly klassenName = klassenName;

  protected readonly suche = signal('');
  protected readonly klasse = signal<string[]>([]);
  protected readonly markeAn = signal<string[]>([]);
  protected readonly ebene = signal<string[]>([]);
  protected readonly unbenutzt = signal(false);
  protected readonly auswahl = signal<string[]>([]);
  protected readonly neueMarke = signal('');
  protected readonly neueKlasse = signal('image');

  protected readonly liste = signal<Liste | null>(null);
  protected readonly zeilen = signal<ListenZeile[]>([]);
  protected readonly holt = signal(false);
  protected readonly laedt = signal(false);
  protected readonly arbeitet = signal(false);
  protected readonly problem = signal<string | null>(null);
  protected readonly ergebnis = signal<{ text: string; lauf: string | null } | null>(null);
  /* Am Telefon ist die Leiste zugeklappt; am Desktop offen. */
  protected readonly breit = signal(typeof matchMedia === 'function' ? !matchMedia('(max-width: 760px)').matches : true);

  protected readonly klassen = computed(() => {
    const f = this.liste()?.facets.fields.find((x) => x.ref === KLASSE);
    return f && f.kind === 'enum' ? f.options : [];
  });
  protected readonly marken = computed(() => this.liste()?.facets.tags ?? []);
  protected readonly ebenen = computed(() => this.liste()?.facets.layers ?? []);

  private lauf = 0;
  private uhr: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      /* Jede Filteränderung fragt neu, ab dem ersten Blatt — die Suche nach einer kurzen Pause. */
      const frage = this.frage();
      untracked(() => {
        if (this.uhr) clearTimeout(this.uhr);
        this.uhr = setTimeout(() => void this.hole(frage, 0), 150);
      });
    });
  }

  private readonly frage = computed(() => ({
    type: 'Asset',
    q: this.suche().trim() || undefined,
    f: this.klasse().length ? [`${KLASSE}:${this.klasse().join('|')}`] : [],
    tag: this.markeAn(),
    layer: this.ebene(),
    unused: this.unbenutzt(),
    limit: BLATT,
  }));

  private async hole(frage: ReturnType<Galerie['frage']>, offset: number): Promise<void> {
    const nr = ++this.lauf;
    this.holt.set(true);
    try {
      const r = await this.api.list({ ...frage, offset });
      if (nr !== this.lauf) return;
      this.liste.set(r);
      this.zeilen.set(offset ? [...this.zeilen(), ...r.rows] : r.rows);
      /* Was nicht mehr dasteht, ist nicht mehr gewählt. */
      if (!offset) this.auswahl.set(this.auswahl().filter((id) => r.rows.some((z) => z.id === id)));
    } catch (e) {
      if (nr === this.lauf) this.problem.set(e instanceof ApiError ? e.message : 'The list did not load.');
    } finally {
      if (nr === this.lauf) this.holt.set(false);
    }
  }

  protected mehr(): void {
    void this.hole(this.frage(), this.zeilen().length);
  }

  protected umschalten(s: ReturnType<typeof signal<string[]>>, wert: string): void {
    const jetzt = s();
    s.set(jetzt.includes(wert) ? jetzt.filter((x) => x !== wert) : [...jetzt, wert]);
  }

  protected klasseVon(z: ListenZeile): string {
    const k = z.cols[KLASSE];
    return typeof k === 'string' && k ? k : 'image';
  }

  /** Marke an die gewählten Bilder — über die Massenänderung, mit Rückgängig. */
  protected async marke(op: 'addTag' | 'removeTag'): Promise<void> {
    const tag = this.neueMarke().trim();
    const ids = this.auswahl();
    if (!tag || !ids.length) return;
    this.arbeitet.set(true);
    this.problem.set(null);
    try {
      const r: BulkAntwort = await this.api.bulk({ select: { ids }, ops: [{ op, tag }], note: `Images: ${op === 'addTag' ? 'add' : 'remove'} tag ${tag}` });
      const abgelehnt = r.rejectedCount ? `, ${r.rejectedCount} refused` : '';
      this.ergebnis.set({ text: `${op === 'addTag' ? 'Tagged' : 'Untagged'} ${r.changed} of ${ids.length}${abgelehnt}.`, lauf: r.id ?? null });
      await this.hole(this.frage(), 0);
    } catch (e) {
      this.problem.set(e instanceof ApiError ? e.message : 'The change failed.');
    } finally {
      this.arbeitet.set(false);
    }
  }

  protected async zurueck(lauf: string): Promise<void> {
    try {
      await this.api.undo(lauf);
      this.ergebnis.set({ text: 'Undone.', lauf: null });
      await this.hole(this.frage(), 0);
    } catch (e) {
      this.problem.set(e instanceof ApiError ? e.message : 'Undo failed.');
    }
  }

  protected async hochladen(ev: Event): Promise<void> {
    const el = ev.target as HTMLInputElement;
    const dateien = [...(el.files ?? [])];
    el.value = '';
    if (!dateien.length) return;
    this.laedt.set(true);
    this.problem.set(null);
    try {
      for (const d of dateien) await this.api.uploadAsset(d, { kind: this.neueKlasse() });
      this.ergebnis.set({ text: `Uploaded ${dateien.length} ${dateien.length === 1 ? 'image' : 'images'}.`, lauf: null });
      await this.hole(this.frage(), 0);
    } catch (e) {
      this.problem.set(e instanceof ApiError && e.status === 413 ? 'An image is too large.' : e instanceof ApiError ? e.message : 'The upload failed.');
    } finally {
      this.laedt.set(false);
    }
  }
}

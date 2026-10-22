import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { describeAsset } from '@nw/model';
import { Api, ApiError, type BulkAntwort, type Liste, type ListenZeile } from '../kern/api';
import { KurzLink } from '../kern/kurzansicht';
import { Loeschen } from '../kern/loeschen';
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
 *
 * **T-201:** jede Kachel nennt die Datei (Auflösung, Verhältnis, Grösse,
 * Format — gespeichert beim Hochladen, `describeAsset`) und ihre Herkunft
 * (Ebene, Buch); die Marken stehen als Badges da und werden dort gesetzt
 * und entfernt, Vorschläge aus den Marken der Treffer. „Use as …" macht
 * aus einem Bild eine Karte, ein Token oder eine Requisite und springt
 * hin (`POST /api/assets/:id/use`).
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

        <datalist id="galerie-marken">
          @for (t of marken(); track t.tag) {
            <option [value]="t.tag"></option>
          }
        </datalist>
        @if (auswahl().length) {
          <div class="massen" role="region" aria-label="Selected images">
            <b>{{ auswahl().length }} selected</b>
            @if (session.leitung()) {
              <input type="text" list="galerie-marken" placeholder="tag" [value]="neueMarke()" (input)="neueMarke.set($any($event.target).value)" aria-label="Tag for the selected images" />
              <button type="button" (click)="marke('addTag', neueMarke(), auswahl())" [disabled]="!neueMarke().trim() || arbeitet()">Add tag</button>
              <button type="button" (click)="marke('removeTag', neueMarke(), auswahl())" [disabled]="!neueMarke().trim() || arbeitet()">Remove tag</button>
            }
            @if (session.darfAnlegen()) {
              <span class="als">
                Use as
                <button type="button" (click)="verwenden(auswahl(), 'map')" [disabled]="arbeitet()">map</button>
                <button type="button" (click)="tokenWaehlen(auswahl())" [disabled]="arbeitet()">token</button>
                <button type="button" (click)="verwenden(auswahl(), 'prop')" [disabled]="arbeitet()">prop</button>
              </span>
            }
            @if (session.darfAnlegen() || session.leitung()) {
              <button type="button" class="gefahr" (click)="loeschen(auswahl())" [disabled]="arbeitet()" title="Delete the selected images in your write layer; the others are deselected">Delete</button>
            }
            <button type="button" class="leise" (click)="auswahl.set([])">Clear selection</button>
          </div>
        }
        @if (tokenFuer(); as ids) {
          <div class="massen token" role="dialog" aria-label="Use as token">
            <b>Token for</b>
            <input type="search" placeholder="Creature or character…" [value]="kreaturSuche()" (input)="sucheKreatur($any($event.target).value)" aria-label="Find a creature" />
            @for (k of kreaturen(); track k.id) {
              <button type="button" (click)="verwenden(ids, 'token', k.id)" [disabled]="arbeitet()">{{ k.name }}</button>
            }
            <button type="button" (click)="verwenden(ids, 'token')" [disabled]="arbeitet()">Only set the class</button>
            <button type="button" class="leise" (click)="tokenFuer.set(null)">Cancel</button>
          </div>
        }
        @if (ergebnis(); as r) {
          <p class="ergebnis" role="status">
            {{ r.text }}
            @if (r.hinweis) {
              <span class="dim">{{ r.hinweis }}</span>
            }
            @for (o of r.open ?? []; track o.id) {
              <a [routerLink]="['/artikel', o.id]">Open {{ o.name }}</a>
            }
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
                @if (session.leitung() || session.darfAnlegen()) {
                  <input class="waehler" type="checkbox" [checked]="auswahl().includes(z.id)" (change)="umschalten(auswahl, z.id)" [attr.aria-label]="'Select ' + z.name" />
                }
                <a [routerLink]="['/artikel', z.id]" [nwQuick]="z.id" class="bildlink">
                  <nw-bild [wert]="z.id" [version]="z.imageVersion" groesse="thumb" [oeffnen]="false" [alt]="z.name" />
                  <span class="name">{{ z.name }}</span>
                </a>
                @if (beschreibung(z); as d) {
                  <span class="datei">{{ d }}</span>
                }
                @if (z.layers.length) {
                  <span class="herkunft" [title]="z.layers.join(', ')">from {{ z.layers.join(', ') }}</span>
                }
                <span class="meta">
                  <span class="klasse">{{ klasseVon(z) }}</span>
                  @for (t of z.tags ?? []; track t) {
                    <span class="marke">
                      {{ t }}
                      @if (session.leitung()) {
                        <button type="button" class="weg" (click)="marke('removeTag', t, [z.id])" [disabled]="arbeitet()" [attr.aria-label]="'Remove tag ' + t + ' from ' + z.name">×</button>
                      }
                    </span>
                  }
                  @if (session.leitung()) {
                    @if (markeAnKachel() === z.id) {
                      <input class="neu" type="text" list="galerie-marken" placeholder="tag" autofocus
                        (keydown.enter)="kachelMarke(z, $any($event.target).value)" (keydown.escape)="markeAnKachel.set(null)"
                        (blur)="kachelMarke(z, $any($event.target).value)" [attr.aria-label]="'New tag for ' + z.name" />
                    } @else {
                      <button type="button" class="marke plus" (click)="markeAnKachel.set(z.id)" [attr.aria-label]="'Add a tag to ' + z.name">+ tag</button>
                    }
                  }
                </span>
                @if (session.darfAnlegen()) {
                  <select class="als-wahl" (change)="alsWahl(z.id, $event)" [attr.aria-label]="'Use ' + z.name + ' as'" [disabled]="arbeitet()">
                    <option value="">Use as…</option>
                    <option value="map">Map</option>
                    <option value="token">Token</option>
                    <option value="prop">Prop</option>
                  </select>
                  <button type="button" class="weg-bild" (click)="loeschen([z.id])" [disabled]="arbeitet()" [attr.aria-label]="'Delete ' + z.name" title="Delete (only in your write layer)">🗑</button>
                }
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
  protected readonly ergebnis = signal<{ text: string; lauf: string | null; open?: { id: string; name: string }[]; hinweis?: string } | null>(null);
  private readonly loescher = inject(Loeschen);
  /** An welcher Kachel gerade eine Marke getippt wird. */
  protected readonly markeAnKachel = signal<string | null>(null);
  /** Für welche Bilder ein Token gewählt wird — und die Kreaturen zur Wahl. */
  protected readonly tokenFuer = signal<string[] | null>(null);
  protected readonly kreaturSuche = signal('');
  protected readonly kreaturen = signal<{ id: string; name: string }[]>([]);
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

  /** Die Zeile über die Datei: `1920×1080 px · 16:9 · 640 KB · WEBP` (T-201). */
  protected beschreibung(z: ListenZeile): string {
    return z.asset ? describeAsset(z.asset) : '';
  }

  /** Marke an Bilder — über die Massenänderung, mit Rückgängig; an einer Kachel wie an der Auswahl. */
  protected async marke(op: 'addTag' | 'removeTag', roh: string, ids: string[]): Promise<void> {
    const tag = roh.trim();
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

  /** Enter und das Verlassen des Feldes schicken ab — einmal: wer schon abgeschickt hat, hat das Feld geschlossen. */
  protected kachelMarke(z: ListenZeile, wert: string): void {
    if (this.markeAnKachel() !== z.id || this.arbeitet()) return;
    this.markeAnKachel.set(null);
    const tag = wert.trim();
    if (tag && !(z.tags ?? []).includes(tag)) void this.marke('addTag', tag, [z.id]);
  }

  protected alsWahl(id: string, ev: Event): void {
    const el = ev.target as HTMLSelectElement;
    const als = el.value as 'map' | 'token' | 'prop' | '';
    el.value = '';
    if (als === 'token') this.tokenWaehlen([id]);
    else if (als) void this.verwenden([id], als);
  }

  protected tokenWaehlen(ids: string[]): void {
    this.tokenFuer.set([...ids]);
    this.kreaturen.set([]);
    this.sucheKreatur('');
  }

  private kreaturLauf = 0;
  protected async sucheKreatur(q: string): Promise<void> {
    this.kreaturSuche.set(q);
    const nr = ++this.kreaturLauf;
    try {
      const r = await this.api.list({ type: 'Creature', q: q.trim() || undefined, limit: 8 });
      if (nr === this.kreaturLauf) this.kreaturen.set(r.rows.map((z) => ({ id: z.id, name: z.name })));
    } catch {
      if (nr === this.kreaturLauf) this.kreaturen.set([]);
    }
  }

  /**
   * **Als Karte, Token, Requisite verwenden** (T-201): je Bild ein Aufruf;
   * was angelegt oder angehängt wurde, steht danach mit „Open" da.
   */
  protected async verwenden(ids: string[], als: 'map' | 'token' | 'prop', fuer?: string): Promise<void> {
    if (!ids.length) return;
    this.arbeitet.set(true);
    this.problem.set(null);
    const open: { id: string; name: string }[] = [];
    let fehler = 0;
    let letzter = '';
    for (const id of ids) {
      try {
        const r = await this.api.useAsset(id, als, fuer);
        if (r.open && !open.some((o) => o.id === r.open!.id)) open.push({ id: r.open.id, name: r.open.name });
      } catch (e) {
        fehler += 1;
        letzter = e instanceof ApiError ? e.message : 'The change failed.';
      }
    }
    this.tokenFuer.set(null);
    const getan = ids.length - fehler;
    const was = als === 'map' ? `Made ${getan} ${getan === 1 ? 'map' : 'maps'}` : als === 'token' ? (fuer ? `Set the token of ${open[0]?.name ?? 'the creature'}` : `Marked ${getan} as token`) : `Marked ${getan} as prop`;
    this.ergebnis.set({ text: `${was}${fehler ? `, ${fehler} failed` : ''}.`, lauf: null, open });
    if (fehler) this.problem.set(letzter);
    this.arbeitet.set(false);
    await this.hole(this.frage(), 0);
  }

  /**
   * **Löschen** (T-381): einzeln an der Kachel oder die ganze Auswahl.
   * Gelöscht wird, was in der Schreibebene liegt; der Rest bleibt stehen
   * und wird abgewählt — die Meldung sagt beides, mit Undo.
   */
  protected async loeschen(ids: string[]): Promise<void> {
    if (!ids.length) return;
    this.arbeitet.set(true);
    this.problem.set(null);
    try {
      const r = await this.loescher.loeschen(ids);
      if (!r) return;
      const weg = new Set([...r.geloescht, ...r.abgewaehlt]);
      this.auswahl.set(this.auswahl().filter((id) => !weg.has(id)));
      this.ergebnis.set({ text: `${r.text}.`, lauf: r.lauf, ...(r.hinweis ? { hinweis: r.hinweis } : {}) });
      if (r.geloescht.length) await this.hole(this.frage(), 0);
    } catch (e) {
      this.problem.set(e instanceof ApiError ? e.message : 'Deleting failed — reload and try again.');
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

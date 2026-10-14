import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import type { ElementRef } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  addMarker,
  drawnSheets,
  entityName,
  frameNear,
  gridGeometry,
  HEX_TILE_PATH,
  isMap,
  MAP_ZOOM_MAX,
  MAP_ZOOM_MIN,
  mapSettings,
  markersOf,
  measure,
  moveMarker,
  parentMapRelation,
  zoomStep,
} from '@nw/model';
import type { Entity, Frame, MapMarker, Pt, Size } from '@nw/model';
import { Api, type KartenKontext } from '../kern/api';
import { Bestand } from '../kern/bestand';
import { Kurzansicht } from '../kern/kurzansicht';
import { Session } from '../kern/session';
import { bildAdresse } from '../artikel/bild';
import { Brett, type Mangel } from '../boards/brett';
import { BoardSuche } from '../boards/suche';

/** Ab so vielen Bildpunkten ist ein Druck ein Ziehen und kein Antippen. */
const ZIEHEN_AB = 5;
/** Ein Rad schickt viele kleine Schritte; einer je so viele Millisekunden. */
const RAD_PAUSE = 90;
/** Ein Finger ist breiter als ein Mauszeiger: kleiner wird ein Marker nicht. */
const MARKER_MIN = 26;

type Werkzeug = 'keins' | 'messen' | 'setzen';

interface Zeiger {
  x: number;
  y: number;
}

/**
 * **Eine Karte am Tisch** (T-115, REQ-130 bis 136, docs/Karten.md) — auf
 * der Artikelseite (Element `map`) und unter Play.
 *
 * **Gezoomt wird der Kasten, nicht das Bild** (`.innen` ist genau so gross
 * wie das Bild): alles, was in Kartenanteilen liegt — Blätter, Gitter,
 * Marker, Rahmen —, steht in Prozent davon und wandert beim Zoomen nicht.
 * Bei Zoom 1 ist die Karte so breit wie das Fenster; das rechnet auch
 * `frameShare` so.
 *
 * **Der Zustand kommt aus dem Bestand**: die Karte ist ein Artikel
 * (`Bestand.oeffnen`), was neben ihr steht, fragt `/api/maps/:id/context`
 * — neu, sobald der Artikel neu kommt. Ein Ereignis „Artikel geändert"
 * aus dem Live-Kanal (T-116) muss sie also nur neu öffnen. Zurückgehalten
 * hat der Server (`redactMap`): was hier ankommt, darf gezeichnet werden.
 *
 * Gesten: Ziehen verschiebt, Rad und zwei Finger zoomen, ein Antippen auf
 * einen Marker öffnet seine Kurzansicht. Wer die Karte schreibt, zieht
 * Marker an eine neue Stelle und setzt neue mit „Add marker" — beides
 * schreibt nur die Kante (`marker`).
 */
@Component({
  selector: 'nw-karte',
  imports: [RouterLink, BoardSuche],
  template: `
    <div class="karte" [class.gross]="gross()">
      <div class="leiste">
        <nav aria-label="Map breadcrumb" class="brot">
          @for (p of kontext()?.parents ?? []; track p.id) {
            <a [routerLink]="weg(p.id).link" [queryParams]="weg(p.id).query">{{ p.name }}</a>
            <span aria-hidden="true">›</span>
          }
          <b>{{ name() }}</b>
        </nav>
        <div class="werkzeuge">
          <span class="zoom" role="group" aria-label="Zoom">
            <button type="button" (click)="stufe(-1)" aria-label="Zoom out" title="Zoom out — past the edge leads to the map above">−</button>
            <span aria-live="polite">{{ prozent() }}%</span>
            <button type="button" (click)="stufe(1)" aria-label="Zoom in" title="Zoom in — a sub-map that fills the view is entered">+</button>
            <button type="button" (click)="einpassen()" title="Fit the whole map">Fit</button>
          </span>
          @if (blaetter().length > 1) {
            <button type="button" [attr.aria-expanded]="blaetterOffen()" (click)="blaetterOffen.set(!blaetterOffen())">Layers</button>
          }
          <button type="button" [class.an]="werkzeug() === 'messen'" [attr.aria-pressed]="werkzeug() === 'messen'" (click)="waehle('messen')" title="Tap two points to measure">
            Measure
          </button>
          @if (darfSchreiben()) {
            <button type="button" [class.an]="werkzeug() === 'setzen'" [attr.aria-pressed]="werkzeug() === 'setzen'" (click)="waehle('setzen')" title="Tap the map where the marker goes">
              Add marker
            </button>
          }
        </div>
      </div>

      @if (blaetterOffen() && blaetter().length > 1) {
        <ul class="blaetter" aria-label="Layers">
          <!-- Oben, was obenauf liegt: gezeichnet wird von hinten nach vorn. -->
          @for (s of blaetterOben(); track s.id) {
            <li>
              <label>
                <input type="checkbox" [checked]="!s.hidden" (change)="blattZeigen(s.id, $any($event.target).checked)" />
                {{ s.name }}
                @if (s.gmOnly) {
                  <span class="marke">GM</span>
                }
              </label>
            </li>
          }
        </ul>
      }

      @if (werkzeug() === 'setzen' && setzenBei()) {
        <div class="setzen">
          <p>Which article does the marker stand for?</p>
          <nw-board-suche [ohne]="schonDa()" (gewaehlt)="setzen($event)" />
          <button type="button" (click)="setzenBei.set(null)">Cancel</button>
        </div>
      }

      @if (!karte()) {
        <p class="leer">{{ fehlt() ? 'This map is not here — gone, or not yours to see.' : 'Loading map…' }}</p>
      } @else if (!grundbild()) {
        <p class="leer">
          This map has no image yet{{ darfSchreiben() ? ' — set one under Image in the fields below.' : '.' }}
        </p>
      } @else {
        @if (bildFehlt()) {
          <p class="leer" role="alert">The map image did not load — it may not be shared with you yet.</p>
        }
        <div
          #buehne
          class="buehne"
          tabindex="0"
          aria-label="Map — drag to move, wheel or two fingers to zoom"
          [class.werkzeug]="werkzeug() !== 'keins'"
          (wheel)="rad($event)"
          (pointerdown)="runter($event)"
          (pointermove)="bewegen($event)"
          (pointerup)="hoch($event)"
          (pointercancel)="abbrechen($event)"
          (keydown)="taste($event)"
        >
          <div
            #innen
            class="innen"
            [class.gemessen]="hoehe() !== null"
            [style.width.px]="breite()"
            [style.height.px]="hoehe()"
          >
            @for (s of blaetter(); track s.id) {
              @if (s.base) {
                <img
                  class="blatt grund"
                  [src]="adresse(s.image)"
                  [alt]="name()"
                  [style.opacity]="s.hidden ? 0 : 1"
                  draggable="false"
                  (load)="geladen($event)"
                  (error)="bildFehlt.set(true)"
                />
              } @else {
                <img
                  class="blatt"
                  [src]="adresse(s.image)"
                  alt=""
                  [style.opacity]="s.opacity"
                  draggable="false"
                  (load)="ohneGrund() && geladen($event)"
                />
              }
            }
            @if (gitter(); as g) {
              <div class="gitter" aria-hidden="true" [style.background-image]="g.bild" [style.background-size]="g.groesse" [style.background-position]="g.lage"></div>
            }
            @for (k of rahmen(); track k.id) {
              <a
                class="rahmen"
                [class.nah]="k.nah"
                [routerLink]="weg(k.id).link"
                [queryParams]="weg(k.id).query"
                [style.left.%]="k.frame.x * 100"
                [style.top.%]="k.frame.y * 100"
                [style.width.%]="k.frame.w * 100"
                [style.height.%]="k.frame.h * 100"
                [title]="k.nah ? 'Zoom in once more to enter ' + k.name : 'Enter ' + k.name"
                (pointerdown)="$event.stopPropagation()"
              >
                <span>{{ k.nah ? k.name + ' — zoom in to enter' : k.name }}</span>
              </a>
            }
            @if (messung(); as m) {
              <svg class="mess" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
                <line [attr.x1]="m.a.x" [attr.y1]="m.a.y" [attr.x2]="m.b.x" [attr.y2]="m.b.y" vector-effect="non-scaling-stroke" />
              </svg>
              @if (m.text) {
                <span class="messwert" [style.left.%]="m.b.x * 100" [style.top.%]="m.b.y * 100">{{ m.text }}</span>
              }
            }
            @if (gruppe(); as p) {
              <button
                type="button"
                class="marker k-party abgeleitet"
                [style.left.%]="p.x * 100"
                [style.top.%]="p.y * 100"
                [style.width.px]="MARKER_MIN + 6"
                [style.height.px]="MARKER_MIN + 6"
                [title]="p.name + ' — on ' + p.mapName"
                [attr.aria-label]="p.name + ', on ' + p.mapName"
                (pointerdown)="$event.stopPropagation()"
                (click)="kurzansicht($event, p.id)"
              >
                <span>{{ kuerzel(p.name) }}</span>
              </button>
            }
            @for (m of marker(); track m.rel.id) {
              <button
                type="button"
                class="marker"
                [class]="'k-' + m.kind"
                [class.versteckt]="m.hidden"
                [class.zieht]="zug()?.id === m.rel.id"
                [style.left.%]="m.x * 100"
                [style.top.%]="m.y * 100"
                [style.width.px]="m.px"
                [style.height.px]="m.kind === 'scenery' ? m.px * m.ratio : m.px"
                [style.transform]="m.rot ? 'translate(-50%, -50%) rotate(' + m.rot + 'deg)' : null"
                [title]="m.titel"
                [attr.aria-label]="m.titel"
                (pointerdown)="greifen($event, m)"
                (click)="kurzansicht($event, m.to)"
              >
                @if (m.bild) {
                  <img [src]="m.bild" alt="" draggable="false" />
                } @else {
                  <span>{{ kuerzel(m.name) }}</span>
                }
              </button>
            }
          </div>
        </div>
      }

      <p class="stand" role="status">
        @if (speichert()) {
          Saving…
        } @else if (mangel(); as f) {
          <span class="fehler">{{ f.text }}</span>
          @for (x of f.einzeln; track x) {
            <span class="fehler"> · {{ x }}</span>
          }
        } @else if (werkzeug() === 'messen') {
          {{ messung()?.text || 'Tap a start point, then an end point.' }}
        } @else if (werkzeug() === 'setzen') {
          {{ setzenBei() ? 'Pick the article below.' : 'Tap the map where the marker goes.' }}
        } @else {
          @if (einst()?.scale; as sc) {
            1 square = {{ sc }}
          }
          @if (marker().length) {
            · {{ marker().length }} {{ marker().length === 1 ? 'marker' : 'markers' }}
          }
          @if (darfSchreiben() && marker().length) {
            · drag a marker to move it
          }
        }
      </p>
    </div>
  `,
  styleUrl: './karte.scss',
})
export class Karte {
  readonly id = input.required<string>();
  /** Wohin ein Schritt hinein oder hinaus führt: zur Artikelseite der Karte oder in Play. */
  readonly ort = input<'artikel' | 'play'>('artikel');
  /** Unter Play füllt die Karte den Schirm. */
  readonly gross = input(false);

  protected readonly MARKER_MIN = MARKER_MIN;

  private readonly bestand = inject(Bestand);
  private readonly api = inject(Api);
  private readonly session = inject(Session);
  private readonly kurz = inject(Kurzansicht);
  private readonly router = inject(Router);
  private readonly brett = inject(Brett);

  private readonly buehne = viewChild<ElementRef<HTMLElement>>('buehne');
  private readonly innen = viewChild<ElementRef<HTMLElement>>('innen');

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => {
        /* Eine andere Karte fängt von vorn an: ganz zu sehen, ohne Messung. */
        this.zoom.set(1);
        this.nat.set(null);
        this.bildFehlt.set(false);
        this.messA.set(null);
        this.messB.set(null);
        this.setzenBei.set(null);
        this.gezeigt.set({});
        this.kontext.set(null);
        void this.bestand.oeffnen(id, false, false);
      });
    });
    /* Kommt der Artikel neu (gespeichert, oder später ein Ereignis aus dem
       Live-Kanal), kommt auch, was neben ihm steht, neu. */
    effect(() => {
      const e = this.gespeichert();
      if (!e) return;
      untracked(() => void this.kontextHolen(e.id));
    });
    /* Das Fenster misst, wie gross Zoom 1 ist — es ändert sich mit dem
       Fenster und nicht mit dem Zoom. */
    effect((aufraeumen) => {
      const b = this.buehne()?.nativeElement;
      if (!b) return;
      const messen = () => this.fenster.set({ w: b.clientWidth, h: b.clientHeight });
      messen();
      if (typeof ResizeObserver === 'undefined') return;
      const ro = new ResizeObserver(messen);
      ro.observe(b);
      aufraeumen(() => ro.disconnect());
    });
    inject(DestroyRef).onDestroy(() => {
      this.kontextLauf += 1;
    });
  }

  // ---------------------------------------------------------------- Stand

  private readonly gespeichert = computed<Entity | undefined>(() => {
    const e = this.bestand.voll().get(this.id());
    return e && isMap(e) ? e : undefined;
  });
  /** Solange ein Schreiben läuft, gilt der Entwurf — ein Marker springt sonst zurück. */
  private readonly entwurf = signal<Entity | null>(null);
  protected readonly karte = computed(() => this.entwurf() ?? this.gespeichert());
  protected readonly fehlt = computed(() => this.bestand.fehlt().has(this.id()));
  protected readonly name = computed(() => {
    const e = this.karte();
    return e ? entityName(e) : '';
  });
  protected readonly einst = computed(() => {
    const e = this.karte();
    return e ? mapSettings(e) : null;
  });
  protected readonly darfSchreiben = computed(() => this.session.darfSchreiben()(this.id()));

  protected readonly kontext = signal<KartenKontext | null>(null);
  private kontextLauf = 0;
  private async kontextHolen(id: string): Promise<void> {
    const lauf = ++this.kontextLauf;
    try {
      const k = await this.api.mapContext(id);
      if (lauf === this.kontextLauf) this.kontext.set(k);
    } catch {
      /* Ohne Zusammenhang bleibt die Karte eine Karte: keine Brotkrumen,
         keine Rahmen, keine Gruppe — gezeichnet wird trotzdem. */
      if (lauf === this.kontextLauf) this.kontext.set(null);
    }
  }

  // --------------------------------------------------------------- Blätter

  /** Was der Betrachter für sich ein- oder ausgeschaltet hat — nur hier, nicht gespeichert. */
  private readonly gezeigt = signal<Record<string, boolean>>({});
  protected readonly blaetterOffen = signal(false);
  protected readonly blaetter = computed(() => {
    const e = this.karte();
    return e ? drawnSheets(e, true, this.gezeigt()) : [];
  });
  /** Für die Leiste alle Blätter mit Bild, auch die ausgeschalteten. */
  protected readonly blaetterOben = computed(() => {
    const e = this.karte();
    if (!e) return [];
    const an = this.gezeigt();
    return drawnSheets(e, true, Object.fromEntries(Object.keys(an).map((k) => [k, true])))
      .map((s) => ({ ...s, hidden: !(an[s.id] ?? s.visible) }))
      .reverse();
  });
  protected blattZeigen(id: string, an: boolean): void {
    this.gezeigt.update((g) => ({ ...g, [id]: an }));
  }
  protected readonly grundbild = computed(() => this.blaetter()[0]?.image ?? '');
  /** Das Kartenbild kam nicht (`baseGmOnly`): die Grösse gibt das erste Blatt. */
  protected readonly ohneGrund = computed(() => !this.blaetter()[0]?.base);
  protected adresse(wert: string): string {
    return bildAdresse(wert) ?? '';
  }

  // ------------------------------------------------------------ Masse, Zoom

  protected readonly nat = signal<Size | null>(null);
  protected readonly zoom = signal(1);
  protected readonly fenster = signal<Size>({ w: 0, h: 0 });
  protected readonly prozent = computed(() => Math.round(this.zoom() * 100));
  protected readonly breite = computed(() => Math.max(1, this.fenster().w) * this.zoom());
  protected readonly hoehe = computed(() => {
    const n = this.nat();
    return n ? this.breite() * (n.h / n.w) : null;
  });
  /** Bildpunkte am Schirm je Bildpunkt des Kartenbildes. */
  private readonly faktor = computed(() => {
    const n = this.nat();
    return n ? this.breite() / n.w : 1;
  });

  /** Das Kartenbild kam nicht — gesperrt (404) oder weg; gesagt statt endlos „lädt". */
  protected readonly bildFehlt = signal(false);
  protected geladen(ev: Event): void {
    this.bildFehlt.set(false);
    const img = ev.target as HTMLImageElement;
    if (img.naturalWidth > 0 && img.naturalHeight > 0) this.nat.set({ w: img.naturalWidth, h: img.naturalHeight });
  }

  /** Der Ausschnitt in Kartenanteilen. */
  private sichtbar(): Frame | undefined {
    const b = this.buehne()?.nativeElement;
    const h = this.hoehe();
    if (!b || !h) return undefined;
    const w = this.breite();
    return { x: b.scrollLeft / w, y: b.scrollTop / h, w: b.clientWidth / w, h: b.clientHeight / h };
  }

  /**
   * Zoomen um einen Punkt (Bildschirmkoordinaten in der Bühne): was unter
   * dem Zeiger lag, bleibt unter ihm. Die Grösse des Kastens wird sofort
   * gesetzt, damit der Scrollstand dazu passt; das Signal zieht nach.
   */
  private zoomenAuf(neu: number, fx?: number, fy?: number): void {
    const b = this.buehne()?.nativeElement;
    const i = this.innen()?.nativeElement;
    const alt = this.zoom();
    neu = Math.min(MAP_ZOOM_MAX, Math.max(MAP_ZOOM_MIN, neu));
    if (!b || !i || neu === alt) {
      this.zoom.set(neu);
      return;
    }
    const px = fx ?? b.clientWidth / 2;
    const py = fy ?? b.clientHeight / 2;
    const cx = b.scrollLeft + px;
    const cy = b.scrollTop + py;
    const f = neu / alt;
    const n = this.nat();
    const w = Math.max(1, this.fenster().w) * neu;
    i.style.width = `${w}px`;
    if (n) i.style.height = `${w * (n.h / n.w)}px`;
    b.scrollLeft = cx * f - px;
    b.scrollTop = cy * f - py;
    this.zoom.set(neu);
  }

  /** Ein Zoomschritt — hinein in eine Unterkarte, hinaus zur Karte darüber, oder näher. */
  protected stufe(richtung: 1 | -1, fx?: number, fy?: number): void {
    const e = this.karte();
    if (!e) return;
    const visible = this.sichtbar();
    const s = zoomStep({
      zoom: this.zoom(),
      direction: richtung,
      children: this.kontext()?.children ?? [],
      parent: this.kontext()?.parents.at(-1)?.id ?? parentMapRelation(e)?.to,
      nat: this.nat(),
      viewport: this.fenster(),
      ...(visible ? { visible } : {}),
    });
    if (s.kind === 'zoom') this.zoomenAuf(s.zoom, fx, fy);
    else this.gehe(s.id);
  }

  protected einpassen(): void {
    const n = this.nat();
    const f = this.fenster();
    if (!n || !f.w) return this.zoomenAuf(1);
    const passt = f.h ? f.h / (f.w * (n.h / n.w)) : 1;
    this.zoomenAuf(Math.min(1, passt));
  }

  private letztesRad = 0;
  protected rad(ev: WheelEvent): void {
    ev.preventDefault();
    const jetzt = Date.now();
    if (jetzt - this.letztesRad < RAD_PAUSE || !ev.deltaY) return;
    this.letztesRad = jetzt;
    const r = this.buehne()!.nativeElement.getBoundingClientRect();
    this.stufe(ev.deltaY < 0 ? 1 : -1, ev.clientX - r.left, ev.clientY - r.top);
  }

  // ------------------------------------------------------------ Wege

  /** Wohin eine andere Karte führt: auf ihre Artikelseite, oder in Play bleiben. */
  protected weg(id: string): { link: string[]; query: Record<string, string> | null } {
    return this.ort() === 'play' ? { link: ['/play'], query: { map: id } } : { link: ['/artikel', id], query: null };
  }
  private gehe(id: string): void {
    const w = this.weg(id);
    void this.router.navigate(w.link, w.query ? { queryParams: w.query, queryParamsHandling: 'merge' } : {});
  }

  // -------------------------------------------------------------- Rahmen

  protected readonly rahmen = computed(() => {
    const nat = this.nat();
    const zoom = this.zoom();
    const f = this.fenster();
    return (this.kontext()?.children ?? []).map((k) => ({ ...k, nah: frameNear(k.frame, nat, zoom, f) }));
  });

  // -------------------------------------------------------------- Gitter

  protected readonly gitter = computed(() => {
    const s = this.einst();
    const geo = s ? gridGeometry(s, this.nat()) : null;
    if (!geo) return null;
    const f = this.faktor();
    const w = geo.size * f;
    const lage = `${geo.ox * f}px ${geo.oy * f}px`;
    if (geo.shape === 'square') {
      return {
        bild: 'linear-gradient(to right, var(--gitter) 1px, transparent 1px), linear-gradient(to bottom, var(--gitter) 1px, transparent 1px)',
        groesse: `${w}px ${w}px`,
        lage,
      };
    }
    const h = geo.rowHeight * f * 1.5;
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 100 173.2" preserveAspectRatio="none">` +
      `<path d="${HEX_TILE_PATH}" fill="none" stroke="rgba(60,40,20,0.5)" stroke-width="1" vector-effect="non-scaling-stroke"/></svg>`;
    return { bild: `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`, groesse: `${w}px ${h}px`, lage };
  });

  // -------------------------------------------------------------- Marker

  protected readonly zug = signal<{ id: string; pt: Pt } | null>(null);
  protected readonly marker = computed(() => {
    const e = this.karte();
    const s = this.einst();
    if (!e || !s) return [];
    const ziele = this.kontext()?.targets ?? {};
    const f = this.faktor();
    const z = this.zug();
    const max = this.breite() * 0.3;
    return markersOf(e).map((m: MapMarker) => {
      const ziel = ziele[m.to];
      const name = ziel?.name ?? this.bestand.name()(m.to) ?? '?';
      const pt = z && z.id === m.rel.id ? z.pt : m;
      const px = Math.min(max, Math.max(MARKER_MIN, s.gridSize * m.size * f));
      return {
        ...m,
        x: pt.x,
        y: pt.y,
        name,
        px,
        bild: ziel?.image ? bildAdresse(ziel.image, 'thumb') : null,
        titel: [name, m.note, m.hidden ? 'hidden from the players' : ''].filter(Boolean).join(' — '),
      };
    });
  });

  /** Die Gruppe, wenn sie auf einer Karte darin steht (auf dieser ist sie ein Marker). */
  protected readonly gruppe = computed(() => {
    const p = this.kontext()?.party;
    return p && !p.direct ? p : null;
  });

  protected kuerzel(name: string): string {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join('');
  }

  /** Antippen öffnet die Kurzansicht (`quick`) — nicht nach einem Ziehen. */
  protected kurzansicht(ev: MouseEvent, id: string): void {
    if (this.nachZug) {
      this.nachZug = false;
      return;
    }
    if (ev.ctrlKey || ev.metaKey || ev.shiftKey) {
      void this.router.navigate(['/artikel', id]);
      return;
    }
    this.kurz.oeffnen(id, ev.currentTarget as HTMLElement);
  }

  private nachZug = false;
  private griff: { id: string; sx: number; sy: number; zieht: boolean; pointer: number } | null = null;

  protected greifen(ev: PointerEvent, m: MapMarker): void {
    ev.stopPropagation();
    this.nachZug = false;
    if (!this.darfSchreiben() || this.werkzeug() !== 'keins' || ev.button !== 0) return;
    this.griff = { id: m.rel.id, sx: ev.clientX, sy: ev.clientY, zieht: false, pointer: ev.pointerId };
    (ev.currentTarget as HTMLElement).setPointerCapture?.(ev.pointerId);
  }

  private punkt(ev: { clientX: number; clientY: number }): Pt | null {
    const i = this.innen()?.nativeElement;
    if (!i) return null;
    const r = i.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    return {
      x: Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height)),
    };
  }

  // -------------------------------------------------------------- Gesten

  private readonly zeiger = new Map<number, Zeiger>();
  private schwenk: { sx: number; sy: number; sl: number; st: number; bewegt: boolean } | null = null;
  private kneifen: { d0: number; z0: number } | null = null;

  protected runter(ev: PointerEvent): void {
    const b = this.buehne()?.nativeElement;
    if (!b || (ev.pointerType === 'mouse' && ev.button !== 0)) return;
    this.zeiger.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    b.setPointerCapture?.(ev.pointerId);
    if (this.zeiger.size === 2) {
      const [a, c] = [...this.zeiger.values()];
      this.kneifen = { d0: Math.hypot(a!.x - c!.x, a!.y - c!.y) || 1, z0: this.zoom() };
      this.kneifenZiel = this.zoom();
      this.schwenk = null;
      return;
    }
    this.schwenk = { sx: ev.clientX, sy: ev.clientY, sl: b.scrollLeft, st: b.scrollTop, bewegt: false };
  }

  protected bewegen(ev: PointerEvent): void {
    /* Ein Marker unter dem Finger: er wandert mit, geschrieben wird beim Loslassen. */
    const g = this.griff;
    if (g && g.pointer === ev.pointerId) {
      if (!g.zieht && Math.hypot(ev.clientX - g.sx, ev.clientY - g.sy) < ZIEHEN_AB) return;
      g.zieht = true;
      const pt = this.punkt(ev);
      if (pt) this.zug.set({ id: g.id, pt });
      return;
    }
    const b = this.buehne()?.nativeElement;
    if (!b) return;
    if (this.werkzeug() === 'messen' && this.messA() && !this.messFest() && ev.pointerType === 'mouse') {
      const pt = this.punkt(ev);
      if (pt) this.messB.set(pt);
    }
    if (!this.zeiger.has(ev.pointerId)) return;
    this.zeiger.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (this.kneifen && this.zeiger.size >= 2) {
      const [a, c] = [...this.zeiger.values()];
      const d = Math.hypot(a!.x - c!.x, a!.y - c!.y);
      const r = b.getBoundingClientRect();
      this.zoomenAuf(this.kneifen.z0 * (d / this.kneifen.d0), (a!.x + c!.x) / 2 - r.left, (a!.y + c!.y) / 2 - r.top);
      this.kneifenZiel = this.kneifen.z0 * (d / this.kneifen.d0);
      return;
    }
    const s = this.schwenk;
    if (!s) return;
    const dx = ev.clientX - s.sx;
    const dy = ev.clientY - s.sy;
    if (!s.bewegt && Math.hypot(dx, dy) < ZIEHEN_AB) return;
    s.bewegt = true;
    b.scrollLeft = s.sl - dx;
    b.scrollTop = s.st - dy;
  }

  private kneifenZiel = 1;

  protected hoch(ev: PointerEvent): void {
    const g = this.griff;
    if (g && g.pointer === ev.pointerId) {
      this.griff = null;
      const z = this.zug();
      if (g.zieht && z) {
        this.nachZug = true;
        void this.schreiben(moveMarker(this.karte()!, g.id, z.pt)).finally(() => this.zug.set(null));
      }
      return;
    }
    const war = this.zeiger.size;
    this.zeiger.delete(ev.pointerId);
    if (this.kneifen) {
      if (this.zeiger.size < 2) this.kneifenEnde();
      return;
    }
    const s = this.schwenk;
    this.schwenk = null;
    if (war === 1 && s && !s.bewegt) this.antippen(ev);
  }

  protected abbrechen(ev: PointerEvent): void {
    this.zeiger.delete(ev.pointerId);
    this.schwenk = null;
    if (this.griff?.pointer === ev.pointerId) {
      this.griff = null;
      this.zug.set(null);
    }
    if (this.kneifen && this.zeiger.size < 2) this.kneifenEnde();
  }

  /**
   * Zwei Finger lassen los. Füllt ein Rahmen den Blick, ist er betreten;
   * wollte das Kneifen unter den kleinsten Zoom, geht es zur Karte
   * darüber — dieselben zwei Fragen wie beim Rad, nur am Ende der Geste.
   */
  private kneifenEnde(): void {
    const k = this.kneifen;
    this.kneifen = null;
    this.zeiger.clear();
    if (!k) return;
    if (this.kneifenZiel > k.z0) {
      const visible = this.sichtbar();
      const s = zoomStep({
        zoom: this.zoom(),
        direction: 1,
        children: this.kontext()?.children ?? [],
        nat: this.nat(),
        viewport: this.fenster(),
        ...(visible ? { visible } : {}),
      });
      if (s.kind === 'enter') this.gehe(s.id);
    } else if (this.kneifenZiel < MAP_ZOOM_MIN * 0.85) {
      const oben = this.kontext()?.parents.at(-1)?.id;
      if (oben) this.gehe(oben);
    }
  }

  protected taste(ev: KeyboardEvent): void {
    if (ev.key === '+' || ev.key === '=') this.stufe(1);
    else if (ev.key === '-') this.stufe(-1);
    else if (ev.key === 'Escape') this.waehle('keins');
    else return;
    ev.preventDefault();
  }

  // ------------------------------------------------------------ Werkzeuge

  protected readonly werkzeug = signal<Werkzeug>('keins');
  protected waehle(w: Werkzeug): void {
    this.werkzeug.set(this.werkzeug() === w ? 'keins' : w);
    this.messA.set(null);
    this.messB.set(null);
    this.messFest.set(false);
    this.setzenBei.set(null);
  }

  private antippen(ev: PointerEvent): void {
    const pt = this.punkt(ev);
    if (!pt) return;
    if (this.werkzeug() === 'messen') {
      if (!this.messA() || this.messFest()) {
        this.messA.set(pt);
        this.messB.set(null);
        this.messFest.set(false);
      } else {
        this.messB.set(pt);
        this.messFest.set(true);
      }
    } else if (this.werkzeug() === 'setzen') {
      this.setzenBei.set(pt);
    }
  }

  private readonly messA = signal<Pt | null>(null);
  private readonly messB = signal<Pt | null>(null);
  private readonly messFest = signal(false);
  protected readonly messung = computed(() => {
    const a = this.messA();
    const b = this.messB();
    const s = this.einst();
    if (!a || !b || !s) return null;
    return { a, b, text: measure(s, this.nat(), a, b).text };
  });

  protected readonly setzenBei = signal<Pt | null>(null);
  protected readonly schonDa = computed(() => new Set([this.id(), ...markersOf(this.karte() ?? ({} as Entity)).map((m) => m.to)]));

  protected setzen(ziel: Entity): void {
    const e = this.karte();
    const pt = this.setzenBei();
    if (!e || !pt) return;
    this.setzenBei.set(null);
    this.werkzeug.set('keins');
    void this.schreiben(addMarker(e, ziel.id, pt, `r-${crypto.randomUUID()}`));
  }

  // ------------------------------------------------------------ Schreiben

  protected readonly speichert = signal(false);
  protected readonly mangel = signal<Mangel | null>(null);

  /**
   * Die Karte mit der geänderten Kante schreiben — durch `validateEntity`
   * und `PUT`, wie ein Board (`Brett.schreiben`). Schlägt es fehl, gilt
   * wieder, was der Server hat.
   */
  private async schreiben(e: Entity): Promise<void> {
    if (this.speichert()) return;
    this.entwurf.set(e);
    this.mangel.set(null);
    this.speichert.set(true);
    const fehler = await this.brett.schreiben(e);
    this.mangel.set(fehler);
    this.entwurf.set(null);
    this.speichert.set(false);
  }
}

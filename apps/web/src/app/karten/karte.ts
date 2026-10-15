import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  addMarker,
  clearPlayTokens,
  coverAll,
  coverArea,
  drawnSheets,
  entityName,
  fogOn,
  frameNear,
  gridGeometry,
  HEX_TILE_PATH,
  isMap,
  MAP_ZOOM_MAX,
  MAP_ZOOM_MIN,
  mapSettings,
  markersOf,
  markerByTarget,
  measure,
  moveMarker,
  parentMapRelation,
  placeTokens,
  redactMap,
  revealAll,
  revealArea,
  revealShapes,
  setFog,
  zoomStep,
  cellAt,
  cellPoint,
  cellKey,
  feetBetween,
  planGrid,
  planPath,
  planReach,
  tokenCell,
  opportunityAttacks,
} from '@nw/model';
import type { Cell, Entity, Frame, MapMarker, MapRules, PlanStep, Pt, RevealShape, Size } from '@nw/model';
import { Api, type KartenKontext } from '../kern/api';
import { Bestand } from '../kern/bestand';
import { Kurzansicht } from '../kern/kurzansicht';
import { Live } from '../kern/live';
import { Session } from '../kern/session';
import { bildAdresse } from '../artikel/bild';
import { Brett, type Mangel } from '../boards/brett';
import { BoardSuche } from '../boards/suche';
import { Ladeanzeige } from '../kern/ladeanzeige';
import { tipptGerade } from '../kern/suche';
import { nebelBreite, nebelMalen, type NebelForm } from './nebel';
import { KartenSeitenleiste, ZIEH_TYP } from './seitenleiste';

/**
 * **Was der Zugplan auf der Karte zeigt** (T-198). Die Karte rechnet
 * Raster, Reichweite und Weg selbst — sie kennt die Bildgrösse; der Planer
 * sagt nur, wessen Token, wie viel Tempo übrig ist und was er gerade wählt.
 */
export interface Planung {
  /** Die Markerkante der Figur, die plant. */
  rel: string | null;
  /** Wo der Plan das Token gerade hinstellt (Ende der letzten Bewegung); sonst das Token. */
  from: Cell | null;
  /** Übriges Tempo in Fuss. */
  budget: number;
  mode: 'move' | 'target' | 'idle';
  /** Reichweite der gewählten Kachel in Fuss (Zielwahl). */
  range: number | null;
  /** Beschriftung je Artikel-Id am Token, etwa die Trefferchance. */
  labels: Readonly<Record<string, string>>;
  /** Die schon geplanten Wege. */
  paths: readonly (readonly Cell[])[];
  /** Die Zugfolge — für die Gelegenheitsangriffe (Disengage davor hebt sie auf). */
  steps: readonly PlanStep[];
  /** Wer bedroht: das Token (`rel`) und seine Reichweite in Fuss. */
  threats: readonly { id: string; name: string; rel: string; reach: number }[];
}

/** Was ein Antippen im Plan ergibt: ein Weg (mit der Bildgrösse, für den Server) oder ein Ziel. */
export type PlanTipp =
  | { kind: 'cell'; path: Cell[]; feet: number; to: Pt; nat: Size }
  | { kind: 'target'; id: string; name: string; feet: number | null };

/** Ab so vielen Bildpunkten ist ein Druck ein Ziehen und kein Antippen. */
const ZIEHEN_AB = 5;
/** Ein Rad schickt viele kleine Schritte; einer je so viele Millisekunden. */
const RAD_PAUSE = 90;
/** Ein Finger ist breiter als ein Mauszeiger: kleiner wird ein Marker nicht. */
const MARKER_MIN = 26;

type Werkzeug = 'keins' | 'messen' | 'setzen' | 'aufdecken' | 'pinsel' | 'zudecken';
/** Die Werkzeuge, die mit dem Finger eine Form ziehen statt die Karte zu schieben. */
const ZIEHT_FORM: ReadonlySet<Werkzeug> = new Set(['aufdecken', 'pinsel', 'zudecken']);
/** Der Hinweis nach einem Zugvorschlag (T-204). */
const VORSCHLAG_GESENDET = 'Sent — waiting for the GM to confirm the move.';
/** Pinselbreiten in Feldern. */
const PINSEL = [1, 2, 4, 8] as const;

/** Die Gruppen der Werkzeugleiste (T-203). */
type Gruppe = 'auswahl' | 'tokens' | 'messen' | 'nebel' | 'waende' | 'notizen' | 'zeichnen';
interface GruppenDef {
  key: Gruppe;
  label: string;
  title: string;
  sym: string;
  /** Das Tastenkürzel, ein Buchstabe. */
  taste: string;
  /** Nur wer die Karte schreibt. */
  leitung?: boolean;
  /** Vorgesehen, aber noch ohne Werkzeug — die Aufgabe, die es bringt. Steht nicht in der Leiste. */
  spaeter?: string;
}
/**
 * **Die Werkzeugleiste** nach dem Vergleich (docs/vorschlaege/Karten-VTT-Vergleich.md):
 * Auswahl · Tokens · Messen · Nebel · Wände · Notizen · Zeichnen. Was noch
 * kein Werkzeug hat, ist hier vorgesehen und steht nicht da („Was nicht
 * gilt, steht nicht da").
 */
const GRUPPEN: readonly GruppenDef[] = [
  { key: 'auswahl', label: 'Select', title: 'Select and move markers, open their quick view', sym: '↖', taste: 'S' },
  { key: 'tokens', label: 'Tokens', title: 'Add markers, place combatants, clear play tokens', sym: '◉', taste: 'T', leitung: true },
  { key: 'messen', label: 'Measure', title: 'Tap two points to measure', sym: '↔', taste: 'M' },
  { key: 'nebel', label: 'Fog', title: 'Fog of war: reveal and hide what the players see', sym: '☁', taste: 'F', leitung: true },
  { key: 'waende', label: 'Walls', title: 'Walls and doors', sym: '▥', taste: 'W', leitung: true, spaeter: 'T-118' },
  { key: 'notizen', label: 'Notes', title: 'Notes on the map', sym: '✎', taste: 'N', leitung: true, spaeter: 'T-203' },
  { key: 'zeichnen', label: 'Draw', title: 'Draw on the map', sym: '✐', taste: 'D', leitung: true, spaeter: '—' },
];

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
  imports: [RouterLink, BoardSuche, Ladeanzeige, KartenSeitenleiste],
  template: `
    <div class="karte" [class.gross]="gross()" [class.voll]="vollbild()" [class.ersatz]="ersatzVollbild()">
      <div class="leiste">
        <nav aria-label="Map breadcrumb" class="brot">
          @for (p of kontext()?.parents ?? []; track p.id) {
            <a [routerLink]="weg(p.id).link" [queryParams]="weg(p.id).query">{{ p.name }}</a>
            <span aria-hidden="true">›</span>
          }
          <b>{{ name() }}</b>
        </nav>
        <!-- Was die Sicht einstellt, nicht was die Karte ändert: Zoom, Blätter, Spielersicht, Vollbild. -->
        <div class="ansicht">
          <span class="zoom" role="group" aria-label="Zoom">
            <button type="button" (click)="stufe(-1)" aria-label="Zoom out" title="Zoom out — past the edge leads to the map above">−</button>
            <span aria-live="polite">{{ prozent() }}%</span>
            <button type="button" (click)="stufe(1)" aria-label="Zoom in" title="Zoom in — a sub-map that fills the view is entered">+</button>
            <button type="button" (click)="einpassen()" title="Fit the whole map">Fit</button>
          </span>
          @if (blaetter().length > 1) {
            <button type="button" [attr.aria-expanded]="blaetterOffen()" (click)="blaetterOffen.set(!blaetterOffen())">Layers</button>
          }
          @if (darfSchreiben()) {
            <button type="button" [class.an]="spielersicht()" [attr.aria-pressed]="spielersicht()" (click)="spielersicht.set(!spielersicht())" title="See the map as the players do">
              Player view
            </button>
            @if (jeFigur() && figurenHier().length) {
              <!-- Nebel je Figur (T-204): für wen aufgedeckt wird und wessen Sicht „Player view“ zeigt. -->
              <label class="fuer" title="Fog is per character: what you reveal is for this character, and Player view shows what it sees">
                For
                <select (change)="nebelFuer.set($any($event.target).value || null)" aria-label="Reveal for, and see as">
                  <option value="" [selected]="!nebelFuer()">everyone</option>
                  @for (f of figurenHier(); track f.id) {
                    <option [value]="f.id" [selected]="nebelFuer() === f.id">{{ f.name }}</option>
                  }
                </select>
              </label>
            }
          }
          <button type="button" [class.an]="seiteOffen()" [attr.aria-expanded]="seiteOffen()" (click)="seiteUm()" title="Party and encounters beside the map">
            <span aria-hidden="true">☰</span> Table
          </button>
          <button type="button" class="vollbild" [class.an]="vollbild()" [attr.aria-pressed]="vollbild()" (click)="vollbildUm()" [title]="vollbild() ? 'Leave fullscreen (Esc)' : 'Fullscreen (Shift+F)'">
            <span aria-hidden="true">{{ vollbild() ? '⤡' : '⤢' }}</span>
            {{ vollbild() ? 'Exit fullscreen' : 'Fullscreen' }}
          </button>
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

      <div class="flaeche" [class.zu]="leisteZu()">
        <!-- **Die Werkzeugleiste** (T-203, docs/vorschlaege/Karten-VTT-Vergleich.md):
             Gruppen statt verstreuter Knöpfe; die aktive zeigt ihre Unterwerkzeuge. -->
        <div class="werkzeugleiste" role="toolbar" aria-label="Map tools" aria-orientation="vertical">
          @for (g of gruppen(); track g.key) {
            <button type="button" [class.an]="aktiv() === g.key" [attr.aria-pressed]="aktiv() === g.key" [attr.aria-label]="g.label" [title]="g.title + ' (' + g.taste + ')'" (click)="gruppeWaehlen(g.key)">
              <span class="sym" aria-hidden="true">{{ g.sym }}</span>
              <span class="txt">{{ g.label }}</span>
            </button>
          }
          <button type="button" class="einklappen" (click)="leisteZu.set(!leisteZu())" [attr.aria-expanded]="!leisteZu()" [attr.aria-label]="leisteZu() ? 'Show tool names' : 'Hide tool names'" [title]="leisteZu() ? 'Show tool names' : 'Hide tool names'">
            <span aria-hidden="true">{{ leisteZu() ? '»' : '«' }}</span>
          </button>
        </div>

        <div class="spalte">
          @if (aktiv() === 'tokens' && darfSchreiben()) {
            <div class="unterleiste" role="toolbar" aria-label="Tokens">
              <button type="button" [class.an]="werkzeug() === 'setzen'" [attr.aria-pressed]="werkzeug() === 'setzen'" (click)="waehle('setzen')" title="Tap the map where the marker goes">
                Add marker
              </button>
              @if (offeneTeilnehmer().length) {
                <button type="button" (click)="teilnehmerSetzen()" [title]="'Put ' + offeneTeilnehmer().length + ' combatants of ' + (kontext()?.turn?.name ?? 'the fight') + ' on the map'">
                  Place combatants ({{ offeneTeilnehmer().length }})
                </button>
              }
              @if (spielTokens()) {
                <button type="button" (click)="spielTokensWeg()" title="Remove the tokens placed for play; prepared markers and the party stay">Clear play tokens</button>
              }
            </div>
          }

          @if (aktiv() === 'nebel' && darfSchreiben()) {
            <div class="unterleiste" role="toolbar" aria-label="Fog of war">
              <label>
                <input type="checkbox" [checked]="nebelAn()" (change)="nebelSchalten($any($event.target).checked)" />
                Fog on
              </label>
              <button type="button" [class.an]="werkzeug() === 'aufdecken'" [attr.aria-pressed]="werkzeug() === 'aufdecken'" (click)="waehle('aufdecken')" title="Drag a rectangle to reveal it">Reveal</button>
              <button type="button" [class.an]="werkzeug() === 'pinsel'" [attr.aria-pressed]="werkzeug() === 'pinsel'" (click)="waehle('pinsel')" title="Paint to reveal">Brush</button>
              <label>
                Width
                <select (change)="pinsel.set(+$any($event.target).value)" aria-label="Brush width in squares">
                  @for (b of PINSEL; track b) {
                    <option [value]="b" [selected]="b === pinsel()">{{ b }} {{ b === 1 ? 'square' : 'squares' }}</option>
                  }
                </select>
              </label>
              <button type="button" [class.an]="werkzeug() === 'zudecken'" [attr.aria-pressed]="werkzeug() === 'zudecken'" (click)="waehle('zudecken')" title="Drag a rectangle: what lies in it is covered again">Hide</button>
              <label title="Moving a token on a fogged map reveals the way it went. The campaign sets the default (Rules &amp; options); this map may say otherwise.">
                Reveal along moves
                <select (change)="pfadAufdeckenSetzen($any($event.target).value)" aria-label="Reveal along moves on this map">
                  <option value="" [selected]="pfadEigen() === null">campaign ({{ kampagneDecktAuf() ? 'on' : 'off' }})</option>
                  <option value="on" [selected]="pfadEigen() === true">on</option>
                  <option value="off" [selected]="pfadEigen() === false">off</option>
                </select>
              </label>
              <button type="button" (click)="allesAuf()">Reveal all</button>
              <button type="button" (click)="allesZu()">Cover all</button>
            </div>
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
              (dragover)="ueberBuehne($event)"
              (drop)="fallen($event)"
            >
              <!-- Bis das Kartenbild da ist (T-126): ein Kreis statt einer leeren
                   Fläche. Gemessen ist es, sobald es geladen hat (nat). -->
              @if (!nat() && !bildFehlt()) {
                <nw-ladeanzeige class="laedt" label="Loading map image …" />
              }
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
                @if (nebel()) {
                  <!-- Eine Leinwand und keine SVG-Maske: \`url(#…)\` löst nicht jeder
                       Browser unter \`<base href>\` auf (T-204, nebel.ts). -->
                  <canvas #nebelLeinwand class="nebel" aria-hidden="true"></canvas>
                } @else if (nebelOhneMass()) {
                  <div class="nebel ganz" aria-hidden="true"></div>
                }
                @if (vorschau(); as v) {
                  <div class="vorschau" [class.zu]="v.zu" [style.left.%]="v.x * 100" [style.top.%]="v.y * 100" [style.width.%]="v.w * 100" [style.height.%]="v.h * 100"></div>
                }
                @if (messung(); as m) {
                  <svg class="mess" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
                    <line [attr.x1]="m.a.x" [attr.y1]="m.a.y" [attr.x2]="m.b.x" [attr.y2]="m.b.y" vector-effect="non-scaling-stroke" />
                  </svg>
                  @if (m.text) {
                    <span class="messwert" [style.left.%]="m.b.x * 100" [style.top.%]="m.b.y * 100">{{ m.text }}</span>
                  }
                }
                @if (planBild(); as pb) {
                  <svg class="plan" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
                    @for (c of pb.reach; track c.k) {
                      <rect class="reich" [attr.x]="c.x" [attr.y]="c.y" [attr.width]="c.w" [attr.height]="c.h" />
                    }
                    @if (pb.ring; as r) {
                      <ellipse class="ring" [attr.cx]="r.cx" [attr.cy]="r.cy" [attr.rx]="r.rx" [attr.ry]="r.ry" vector-effect="non-scaling-stroke" />
                    }
                    @for (w of pb.wege; track $index) {
                      <polyline class="weg" [attr.points]="w" vector-effect="non-scaling-stroke" />
                    }
                    @if (pb.vorschau; as v) {
                      <polyline class="weg vor" [attr.points]="v" vector-effect="non-scaling-stroke" />
                    }
                  </svg>
                  @if (pb.geist; as g) {
                    <span class="geist" [style.left.%]="g.x * 100" [style.top.%]="g.y * 100" [style.width.px]="g.px" [style.height.px]="g.px"></span>
                  }
                  @if (pb.vorschauText; as t) {
                    <span class="messwert" [style.left.%]="t.x * 100" [style.top.%]="t.y * 100">{{ t.text }}</span>
                  }
                  @for (g of pb.warnungen; track g.k) {
                    <span class="gelegenheit" [style.left.%]="g.x * 100" [style.top.%]="g.y * 100" [title]="g.text" role="note" [attr.aria-label]="g.text">⚠</span>
                  }
                }
                @if (vorschlaege().length) {
                  <!-- Zugvorschläge (T-204, Campaign.moves: confirm): gestrichelt vom Token zum Ziel. -->
                  <svg class="plan" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
                    @for (v of vorschlaege(); track v.plan) {
                      <line class="weg vorschlag" [attr.x1]="v.von.x" [attr.y1]="v.von.y" [attr.x2]="v.to.x" [attr.y2]="v.to.y" vector-effect="non-scaling-stroke" />
                    }
                  </svg>
                  @for (v of vorschlaege(); track v.plan) {
                    <span class="vorschlag-ziel" [style.left.%]="v.to.x * 100" [style.top.%]="v.to.y * 100" (pointerdown)="$event.stopPropagation()">
                      <span class="geist" [title]="v.actorName + ' — proposed by ' + v.by"></span>
                      @if (v.entscheiden) {
                        <button type="button" class="klein" (click)="vorschlagEntscheiden(v.plan, 'confirm')" [attr.aria-label]="'Confirm the move of ' + v.actorName" title="Confirm the move">✓</button>
                        <button type="button" class="klein" (click)="vorschlagEntscheiden(v.plan, 'reject')" [attr.aria-label]="'Reject the move of ' + v.actorName" title="Reject the move">✗</button>
                      }
                    </span>
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
                    [class.dran]="m.dran"
                    [class.naechster]="m.naechster"
                    [class.zieht]="zug()?.id === m.rel.id"
                    [class.ziel]="m.ziel === true"
                    [class.fern]="m.ziel === false"
                    [class.selbst]="m.selbst"
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
                    @if (m.etikett) {
                      <b class="etikett">{{ m.etikett }}</b>
                    }
                  </button>
                }
              </div>
            </div>
          }
        </div>
        @if (seiteOffen()) {
          <nw-kartenseite
            class="seite"
            [karte]="id()"
            [sitzung]="sitzung()"
            [aufKarte]="aufKarte()"
            [schreibt]="darfSchreiben() && !spielersicht()"
            (zentrieren)="zentrieren($event)"
            (setzen)="einenSetzen($event)"
            (alleSetzen)="blockSetzen($event)"
          />
        }
      </div>

      <p class="stand" role="status">
        @if (speichert()) {
          Saving…
        } @else if (mangel(); as f) {
          <span class="fehler">{{ f.text }}</span>
          @for (x of f.einzeln; track x) {
            <span class="fehler"> · {{ x }}</span>
          }
        } @else if (hinweis(); as h) {
          {{ h }}
          <button type="button" class="klein" (click)="hinweis.set(null)" aria-label="Dismiss">×</button>
        } @else if (werkzeug() === 'messen') {
          {{ messung()?.text || 'Tap a start point, then an end point.' }}
        } @else if (werkzeug() === 'setzen') {
          {{ setzenZiel() ? 'Tap the map where ' + setzenName() + ' goes.' : setzenBei() ? 'Pick the article below.' : 'Tap the map where the marker goes.' }}
        } @else if (werkzeug() === 'aufdecken') {
          Drag a rectangle to reveal it to the players.
        } @else if (werkzeug() === 'pinsel') {
          Paint over what the players may see.
        } @else if (werkzeug() === 'zudecken') {
          Drag a rectangle — what lies in it is covered again.
        } @else {
          @if (spielersicht()) {
            Player view ·
          }
          @if (zugText(); as z) {
            {{ z }} ·
          }
          @if (nebelAn()) {
            Fog of war ·
          }
          @if (einst()?.scale; as sc) {
            1 square = {{ sc }}
          }
          @if (marker().length) {
            · {{ marker().length }} {{ marker().length === 1 ? 'marker' : 'markers' }}
          }
          @if (darfSchreiben() && marker().length) {
            @if (imKampf() && !kampfLeitung()) {
              · during the encounter, tokens move through the turn plan
            } @else {
              · drag a marker to move it
            }
          } @else if (eigeneHier().length && !imKampf()) {
            · {{ regeln().moves === 'confirm' ? 'drag your token to propose a move to the GM' : 'drag your token to move it' }}
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
  /** Die Sitzung am Tisch (Play) — ihre Begegnungen stehen in der Seitenleiste (T-203). */
  readonly sitzung = input<string | null>(null);
  /** Unter Play füllt die Karte den Schirm. */
  readonly gross = input(false);
  /** Der Zugplan (T-198): solange er dasteht, wählt ein Antippen Weg oder Ziel. */
  readonly planung = input<Planung | null>(null);
  readonly planTipp = output<PlanTipp>();
  /** Die Gelegenheitsangriffe der geplanten Wege (ohne Vorschau) — für die Zugfolge (T-198, Runde 2). */
  readonly planWarnungen = output<{ step: string; reactorName: string }[]>();
  private warnSchluessel = '';

  protected readonly MARKER_MIN = MARKER_MIN;
  protected readonly PINSEL = PINSEL;

  private readonly bestand = inject(Bestand);
  private readonly api = inject(Api);
  private readonly session = inject(Session);
  private readonly kurz = inject(Kurzansicht);
  private readonly router = inject(Router);
  private readonly brett = inject(Brett);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly buehne = viewChild<ElementRef<HTMLElement>>('buehne');
  private readonly innen = viewChild<ElementRef<HTMLElement>>('innen');
  private readonly nebelLeinwand = viewChild<ElementRef<HTMLCanvasElement>>('nebelLeinwand');

  constructor() {
    /* Die Warnungen gehen an den Planer, sobald sie sich ändern — nicht
       bei jeder Mausbewegung (die Vorschau zählt nicht mit). */
    effect(() => {
      const w = (this.planBild()?.warnungen ?? []).filter((x) => x.step !== '__vorschau').map((x) => ({ step: x.step, reactorName: x.reactorName }));
      const k = w.map((x) => `${x.step}:${x.reactorName}`).join('|');
      if (k === this.warnSchluessel) return;
      this.warnSchluessel = k;
      untracked(() => this.planWarnungen.emit(w));
    });
    /* Geschrieben wird durch `validateEntity`, und das braucht das
       Register. Unter Play lud es bis T-117 niemand — jedes Ziehen eines
       Markers endete dort mit „The registry is not loaded". */
    void this.bestand.load();
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
    /* Der Nebel (T-204): neu gezeichnet, sobald sich eine Form, die
       Deckkraft oder das Bild ändert — nicht beim Zoomen, die Leinwand
       wächst mit dem Kasten (CSS). */
    effect(() => {
      const n = this.nebel();
      const c = this.nebelLeinwand()?.nativeElement;
      const ctx = n && c ? c.getContext('2d') : null;
      if (!n || !c || !ctx) return;
      const b = nebelBreite(this.nat()?.w ?? 0);
      const h = Math.max(1, Math.round(b * n.ar));
      if (c.width !== b) c.width = b;
      if (c.height !== h) c.height = h;
      nebelMalen(ctx, b, h, n.formen, n.deckt);
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
    /* **Live** (T-116): die Karte selbst kommt über den Bestand neu. Was
       neben ihr steht, hängt an anderen Artikeln — eine Unterkarte, die
       ihren Rahmen bekommt, ein Markerziel, das umbenannt wird, die
       Gruppe, die woanders steht —, also fragt der Kontext neu, sobald
       eine Karte oder eines dieser Ziele sich ändert. */
    const ab = inject(Live).onArtikel((ev) => {
      const k = this.kontext();
      /* Eine Begegnung: ihr Zug wandert, oder ein Kampf beginnt hier. */
      const betrifft =
        ev.type === 'Map' || ev.type === 'Encounter' || ev.id === k?.turn?.encounter || ev.id === k?.party?.id || !!k?.targets[ev.id] || !!k?.children.some((c) => c.id === ev.id);
      if (betrifft && ev.id !== this.id()) void this.kontextHolen(this.id());
    });
    /* Ein Zugvorschlag kommt, wird bestätigt oder verworfen (T-204). */
    const abPlan = inject(Live).onPlan((karte) => {
      if (karte === this.id()) void this.kontextHolen(karte);
    });
    /* Das Vollbild verlässt man auch mit Esc des Browsers — gefragt wird darum das Dokument. */
    const vollbildWechsel = () => this.echtesVollbild.set(!!document.fullscreenElement?.contains(this.host.nativeElement));
    document.addEventListener('fullscreenchange', vollbildWechsel);
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('fullscreenchange', vollbildWechsel);
      ab();
      abPlan();
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
  /**
   * **Was gezeichnet wird.** Für Spielende hat der Server schon
   * zurückgehalten (`redactMap`); die Leitung sieht mit „Player view"
   * dasselbe, gerechnet mit derselben Funktion — als Vorschau, nicht als
   * Schranke: was sie hier hat, durfte sie ohnehin.
   */
  protected readonly angezeigt = computed(() => {
    const e = this.karte();
    if (!e || !this.spielersicht()) return e;
    /* Nebel je Figur (T-204): die Sicht der gewählten Figur, ohne Wahl nur
       das für alle Aufgedeckte. */
    const fuer = this.nebelFuer();
    return redactMap(e, { gm: false, sees: () => true, fog: this.regeln().fog, own: (id) => id === fuer });
  });
  /** Die Kartenregeln der Kampagne (T-204); ohne Antwort die Vorgaben. */
  protected readonly regeln = computed<MapRules>(() => this.kontext()?.rules ?? { fog: 'party', moves: 'free', revealOnMove: false });
  /** Führt die Kampagne den Nebel je Figur? */
  protected readonly jeFigur = computed(() => this.regeln().fog === 'player');
  /** Für wen aufgedeckt wird und wessen Sicht „Player view“ zeigt (nur je Figur). */
  protected readonly nebelFuer = signal<string | null>(null);
  /** Die Figuren auf der Karte, für die man aufdecken kann: Spiel-Tokens und die Gruppe. */
  protected readonly figurenHier = computed(() => {
    const e = this.karte();
    if (!e) return [];
    const ziele = this.kontext()?.targets ?? {};
    const ids = [...new Set(markersOf(e).filter((m) => m.kind === 'play' || m.kind === 'party').map((m) => m.to))];
    return ids.map((id) => ({ id, name: ziele[id]?.name ?? this.bestand.name()(id) ?? id }));
  });
  /** Die eigenen Figuren mit Token hier (T-204) — die zieht der Betrachter selbst. */
  protected readonly eigeneHier = computed(() => this.kontext()?.own ?? []);
  /** Offene Zugvorschläge, mit dem Punkt, an dem das Token steht. */
  protected readonly vorschlaege = computed(() => {
    const e = this.angezeigt();
    if (!e) return [];
    const marker = markersOf(e);
    const entscheiden = this.session.leitung() && !this.spielersicht();
    return (this.kontext()?.proposals ?? []).flatMap((v) => {
      const m = marker.find((x) => x.to === v.actor);
      return m ? [{ ...v, von: { x: m.x, y: m.y }, entscheiden }] : [];
    });
  });
  /** Leitet der Betrachter (er schreibt die Karte) und schaut nicht gerade als Spieler? */
  private readonly alsLeitung = computed(() => this.darfSchreiben() && !this.spielersicht());
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
      if (lauf === this.kontextLauf) {
        this.kontext.set(k);
        /* Der eigene Vorschlag ist entschieden (T-204): der Hinweis darauf geht. */
        if (this.hinweis() === VORSCHLAG_GESENDET && !(k.proposals ?? []).some((v) => (k.own ?? []).includes(v.actor))) this.hinweis.set(null);
      }
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
    const e = this.angezeigt();
    return e ? drawnSheets(e, !this.spielersicht(), this.gezeigt()) : [];
  });
  /** Für die Leiste alle Blätter mit Bild, auch die ausgeschalteten. */
  protected readonly blaetterOben = computed(() => {
    const e = this.angezeigt();
    if (!e) return [];
    const an = this.gezeigt();
    return drawnSheets(e, !this.spielersicht(), Object.fromEntries(Object.keys(an).map((k) => [k, true])))
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

  // ------------------------------------------------------------ Vollbild

  private readonly echtesVollbild = signal(false);
  /** Ohne Fullscreen API (iPhone): die Karte legt sich über die Seite. */
  protected readonly ersatzVollbild = signal(false);
  protected readonly vollbild = computed(() => this.echtesVollbild() || this.ersatzVollbild());

  /**
   * **Vollbild** (T-203). Unter Play geht die ganze Seite ins Vollbild
   * (`.vollbild-ziel`), damit der Zugplan dabei bleibt; auf der
   * Artikelseite die Karte allein.
   */
  protected async vollbildUm(): Promise<void> {
    if (this.ersatzVollbild()) {
      this.ersatzVollbild.set(false);
      return;
    }
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined);
      return;
    }
    const host = this.host.nativeElement;
    const ziel = host.closest<HTMLElement>('.vollbild-ziel') ?? host;
    if (!document.fullscreenEnabled || typeof ziel.requestFullscreen !== 'function') {
      this.ersatzVollbild.set(true);
      return;
    }
    try {
      await ziel.requestFullscreen();
    } catch {
      this.ersatzVollbild.set(true);
    }
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
    const e = this.angezeigt();
    const s = this.einst();
    if (!e || !s) return [];
    const ziele = this.kontext()?.targets ?? {};
    const zug = this.kontext()?.turn;
    const f = this.faktor();
    const z = this.zug();
    const max = this.breite() * 0.3;
    const plan = this.planung();
    const pr = this.planRaster();
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
        /* Der Zeiger auf dem, der dran ist (REQ-144): dasselbe Token,
           ein Ring mehr — und gestrichelt der Nächste. */
        dran: !!zug?.current && m.to === zug.current,
        naechster: !!zug?.next && m.to === zug.next && m.to !== zug.current,
        titel: [name, m.note, m.hidden ? 'hidden from the players' : '', zug?.current === m.to ? 'their turn' : zug?.next === m.to ? 'next' : '']
          .filter(Boolean)
          .join(' — '),
        selbst: !!plan && plan.rel === m.rel.id,
        /* In der Zielwahl: in Reichweite (true), ausser Reichweite (false). */
        ziel:
          plan?.mode === 'target' && plan.rel !== m.rel.id && pr && plan.range !== null && m.kind !== 'scenery'
            ? feetBetween(pr.geo, cellPoint(pr.geo, pr.start), m) <= plan.range
            : null,
        etikett: plan && plan.rel !== m.rel.id ? (plan.labels[m.to] ?? '') : '',
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
    /* Im Zugplan ist ein Token ein Ziel und keine Kurzansicht (T-198). */
    const plan = this.planung();
    /* Beim Bewegen ist ein Token im Weg und keine Kurzansicht. */
    if (plan?.mode === 'move') return;
    if (plan?.mode === 'target') {
      const m = this.marker().find((x) => x.to === id && x.rel.id !== plan.rel);
      if (!m) return;
      const pr = this.planRaster();
      this.planTipp.emit({ kind: 'target', id, name: m.name, feet: pr ? feetBetween(pr.geo, cellPoint(pr.geo, pr.start), m) : null });
      return;
    }
    if (ev.ctrlKey || ev.metaKey || ev.shiftKey) {
      void this.router.navigate(['/artikel', id]);
      return;
    }
    this.kurz.oeffnen(id, ev.currentTarget as HTMLElement);
  }

  private nachZug = false;
  private griff: { id: string; to: string; sx: number; sy: number; zieht: boolean; pointer: number; von: Pt; selbst: boolean } | null = null;

  protected greifen(ev: PointerEvent, m: MapMarker): void {
    ev.stopPropagation();
    this.nachZug = false;
    /* **Die eigene Figur zieht, wer sie führt** (T-204) — auch ohne die
       Karte zu schreiben, über `POST /api/maps/:id/move`; wie, sagt die
       Kampagne (`moves`). Wer nicht leitet und bestätigen lassen muss,
       geht denselben Weg, auch wenn er die Karte schreibt. */
    const eigen = this.eigeneHier().includes(m.to) && !this.spielersicht();
    const selbst = eigen && (!this.darfSchreiben() || (!this.session.leitung() && this.regeln().moves === 'confirm'));
    if ((!this.darfSchreiben() && !eigen) || this.werkzeug() !== 'keins' || ev.button !== 0) return;
    /* **Im Kampf zieht der Plan** (T-198, Runde 2): Spielende bewegen ein
       Token dann nur über den Zugplan — der Server prüft dasselbe
       (`zugSperre`); die Leitung zieht weiter, mit Hinweis. */
    if (this.imKampf() && !this.kampfLeitung() && m.kind !== 'scenery') {
      this.hinweis.set('During the encounter, your token moves through the turn plan.');
      return;
    }
    this.griff = { id: m.rel.id, to: m.to, sx: ev.clientX, sy: ev.clientY, zieht: false, pointer: ev.pointerId, von: { x: m.x, y: m.y }, selbst };
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
    /* Ein Formwerkzeug zieht mit einem Finger eine Form; zwei Finger
       zoomen trotzdem. */
    if (ZIEHT_FORM.has(this.werkzeug()) && this.zeiger.size === 1) {
      const pt = this.punkt(ev);
      if (pt) this.strich.set({ pointer: ev.pointerId, pts: [pt] });
      this.schwenk = null;
      return;
    }
    if (this.zeiger.size === 2) {
      this.strich.set(null);
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
    const st = this.strich();
    if (st && st.pointer === ev.pointerId) {
      const pt = this.punkt(ev);
      if (!pt) return;
      if (this.werkzeug() !== 'pinsel') {
        this.strich.set({ ...st, pts: [st.pts[0]!, pt] });
        return;
      }
      /* Ein Punkt je halbem Halbmesser: genug für eine runde Spur, und
         ein langer Strich bleibt eine kurze Liste. */
      const letzter = st.pts.at(-1)!;
      const r = this.pinselRadius();
      if (Math.hypot(pt.x - letzter.x, (pt.y - letzter.y) * this.seitenverhaeltnis()) >= r / 2) {
        this.strich.set({ ...st, pts: [...st.pts, pt] });
      }
      return;
    }
    const b = this.buehne()?.nativeElement;
    if (!b) return;
    if (this.planung()?.mode === 'move' && ev.pointerType === 'mouse' && !this.zeiger.size) {
      const pt = this.punkt(ev);
      this.planZeiger.set(pt);
    }
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
      if (g.zieht && z && g.selbst) {
        this.nachZug = true;
        void this.selbstZiehen(g.id, z.pt).finally(() => this.zug.set(null));
        return;
      }
      if (g.zieht && z) {
        this.nachZug = true;
        let neu = moveMarker(this.karte()!, g.id, z.pt);
        /* **Entlang des Weges aufdecken** (REQ-139): wer im Nebel geht,
           sieht, wo er war — so breit wie der Pinsel. Wände rechnet die
           Seite noch nicht (docs/Karten.md, „Was noch fehlt"). */
        if (this.pfadAufdecken() && this.nebelAn()) {
          neu = revealArea(neu, this.strichForm([g.von, z.pt], g.to));
        }
        const ausserhalb = this.imKampf() && this.kampfLeitung();
        void this.schreiben(neu).finally(() => {
          this.zug.set(null);
          if (ausserhalb && !this.mangel()) this.hinweis.set('Moved outside the plan.');
        });
      }
      return;
    }
    const war = this.zeiger.size;
    this.zeiger.delete(ev.pointerId);
    const st = this.strich();
    if (st && st.pointer === ev.pointerId) {
      this.strich.set(null);
      this.formFertig(st.pts);
      return;
    }
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
    if (this.strich()?.pointer === ev.pointerId) this.strich.set(null);
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
    else if (ev.key === 'Escape') this.zurueck();
    else return;
    ev.preventDefault();
  }

  /** Esc: erst das Unterwerkzeug, dann die Gruppe, dann der Vollbild-Ersatz. */
  private zurueck(): void {
    if (this.werkzeug() !== 'keins' && this.aktiv() !== 'messen') this.waehle('keins');
    else if (this.aktiv() !== 'auswahl') this.gruppeWaehlen('auswahl');
    else if (this.ersatzVollbild()) this.ersatzVollbild.set(false);
  }

  /**
   * **Tastenkürzel** (T-203): ein Buchstabe je Gruppe, Umschalt+F für das
   * Vollbild. Nur wo die Karte gemeint ist — unter Play, im Vollbild oder
   * mit dem Fokus in ihr — und nie beim Tippen.
   */
  @HostListener('document:keydown', ['$event'])
  protected kuerzelTaste(ev: KeyboardEvent): void {
    if (ev.defaultPrevented || ev.ctrlKey || ev.metaKey || ev.altKey || tipptGerade(ev.target)) return;
    const gemeint = this.ort() === 'play' || this.vollbild() || this.host.nativeElement.contains(document.activeElement);
    if (!gemeint) return;
    if (ev.key === 'Escape' && (this.aktiv() !== 'auswahl' || this.ersatzVollbild())) {
      this.zurueck();
      ev.preventDefault();
      return;
    }
    if (ev.shiftKey && ev.key.toLowerCase() === 'f') {
      void this.vollbildUm();
      ev.preventDefault();
      return;
    }
    if (ev.shiftKey || ev.key.length !== 1) return;
    const g = this.gruppen().find((x) => x.taste.toLowerCase() === ev.key.toLowerCase());
    if (!g) return;
    this.gruppeWaehlen(g.key);
    ev.preventDefault();
  }

  // ------------------------------------------------------------ Werkzeuge

  /** Die Gruppen, die dieser Betrachter in der Leiste hat. */
  protected readonly gruppen = computed(() => GRUPPEN.filter((g) => !g.spaeter && (!g.leitung || this.darfSchreiben())));
  protected readonly aktiv = signal<Gruppe>('auswahl');
  /** Nur die Symbole: die Leiste schmal, mehr Karte. */
  protected readonly leisteZu = signal(false);

  /** Eine Gruppe wählen; dieselbe noch einmal führt zurück zur Auswahl. */
  protected gruppeWaehlen(g: Gruppe): void {
    const neu = this.aktiv() === g ? 'auswahl' : g;
    this.aktiv.set(neu);
    this.waehle('keins');
    this.werkzeug.set(neu === 'messen' ? 'messen' : 'keins');
  }

  protected readonly werkzeug = signal<Werkzeug>('keins');
  protected waehle(w: Werkzeug): void {
    this.werkzeug.set(this.werkzeug() === w ? 'keins' : w);
    this.messA.set(null);
    this.messB.set(null);
    this.messFest.set(false);
    this.setzenBei.set(null);
    this.setzenZiel.set(null);
    this.strich.set(null);
  }

  private antippen(ev: PointerEvent): void {
    const pt = this.punkt(ev);
    if (!pt) return;
    if (this.planung()?.mode === 'move') {
      const w = this.wegZu(pt);
      const nat = this.nat();
      if (w && nat) this.planTipp.emit({ kind: 'cell', ...w, nat });
      return;
    }
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
      const ziel = this.setzenZiel();
      if (ziel) this.spielTokenSetzen(ziel, pt);
      else this.setzenBei.set(pt);
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

  // ------------------------------------------------------------ Zugplan

  /** Das Raster des Plans und wo das Token gerade steht (T-198); nur auf Quadraten. */
  protected readonly planRaster = computed(() => {
    const plan = this.planung();
    const s = this.einst();
    const e = this.angezeigt();
    if (!plan || !s || !e) return null;
    const geo = gridGeometry(s, this.nat());
    if (!geo) return null;
    const ms = markersOf(e);
    const grid = planGrid(geo, ms, plan.rel ?? '');
    if (!grid) return null;
    const ich = ms.find((m) => m.rel.id === plan.rel);
    const token = ich ? tokenCell(geo, grid, ich) : null;
    const start = plan.from ?? token;
    return start ? { geo, grid, start, token } : null;
  });

  /** Wohin das Tempo reicht, als Felder — einmal je Plan, nicht je Zeichnen. */
  private readonly planReich = computed(() => {
    const plan = this.planung();
    const pr = this.planRaster();
    if (!plan || plan.mode !== 'move' || !pr || plan.budget <= 0) return {} as Record<string, number>;
    return planReach(pr.grid, pr.start, plan.budget);
  });

  private readonly planZeiger = signal<Pt | null>(null);

  /** Der Weg zu einem Punkt, wenn er ins übrige Tempo passt. */
  private wegZu(pt: Pt): { path: Cell[]; feet: number; to: Pt } | null {
    const plan = this.planung();
    const pr = this.planRaster();
    if (!plan || !pr) return null;
    const c = cellAt(pr.geo, pt);
    if (!(cellKey(c) in this.planReich()) || (c.x === pr.start.x && c.y === pr.start.y)) return null;
    const w = planPath(pr.grid, pr.start, c, plan.budget);
    return w ? { ...w, to: cellPoint(pr.geo, c) } : null;
  }

  /** Was die Überlagerung zeichnet: Reichweite, Wege, Vorschau, Ring und das Token am Ende. */
  protected readonly planBild = computed(() => {
    const plan = this.planung();
    const pr = this.planRaster();
    if (!plan || !pr) return null;
    const { geo } = pr;
    const fw = geo.size / geo.w;
    const fh = geo.size / geo.h;
    const reach = Object.keys(this.planReich()).map((k) => {
      const [x, y] = k.split(',').map(Number) as [number, number];
      return { k, x: (geo.ox + x * geo.size) / geo.w, y: (geo.oy + y * geo.size) / geo.h, w: fw, h: fh };
    });
    const linie = (cells: readonly Cell[]) =>
      cells
        .map((c) => cellPoint(geo, c))
        .map((p) => `${p.x},${p.y}`)
        .join(' ');
    const wege = plan.paths.filter((p) => p.length > 1).map(linie);
    const z = plan.mode === 'move' ? this.planZeiger() : null;
    const w = z ? this.wegZu(z) : null;
    const mitte = cellPoint(geo, pr.start);
    const ring =
      plan.mode === 'target' && plan.range !== null
        ? { cx: mitte.x, cy: mitte.y, rx: ((plan.range / 5 + 0.5) * geo.size) / geo.w, ry: ((plan.range / 5 + 0.5) * geo.size) / geo.h }
        : null;
    const verschoben = pr.token && (pr.token.x !== pr.start.x || pr.token.y !== pr.start.y);
    /* **Gelegenheitsangriffe** (T-198, Runde 2): wo ein geplanter Weg oder
       die Vorschau die Reichweite eines Gegners verlässt, steht ein ⚠ am
       Feld davor — bevor der Zug an die Leitung geht. */
    const marker = new Map(markersOf(this.angezeigt() ?? ({} as Entity)).map((m) => [m.rel.id, m]));
    const drohen = plan.threats.flatMap((t) => {
      const m = marker.get(t.rel);
      return m ? [{ id: t.id, name: t.name, reach: t.reach, cell: cellAt(geo, m) }] : [];
    });
    const folge: PlanStep[] = [...plan.steps];
    if (w) folge.push({ id: '__vorschau', kind: 'move', path: w.path, feet: w.feet });
    const warnungen = opportunityAttacks(folge, drohen).map((p) => {
      const weg = folge.find((x) => x.id === p.step);
      const c = weg?.kind === 'move' ? weg.path[p.index]! : pr.start;
      const pt = cellPoint(geo, c);
      return { k: `${p.step}-${p.reactor}`, step: p.step, reactorName: p.reactorName, x: pt.x, y: pt.y, text: `Provokes an opportunity attack from ${p.reactorName}` };
    });
    return {
      reach,
      wege,
      ring,
      warnungen,
      vorschau: w ? linie(w.path) : null,
      vorschauText: w ? { x: w.to.x, y: w.to.y, text: `${w.feet} ft` } : null,
      geist: verschoben ? { ...mitte, px: Math.max(MARKER_MIN, geo.size * this.faktor()) } : null,
    };
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

  // ------------------------------------------------------- Spiel-Tokens

  /** Teilnehmer des laufenden Kampfes ohne Token auf dieser Karte (nur die Leitung bekommt sie). */
  protected readonly offeneTeilnehmer = computed(() =>
    this.darfSchreiben() && !this.spielersicht() ? (this.kontext()?.combatants ?? []).filter((c) => !c.placed) : [],
  );
  protected readonly spielTokens = computed(() => {
    const e = this.karte();
    return this.darfSchreiben() && !this.spielersicht() && !!e && markersOf(e).some((m) => m.kind === 'play');
  });

  /** „Round 2 · Ghoul's turn · next: Rook" — aus dem Kontext, mit den Namen der Tokens. */
  protected readonly zugText = computed(() => {
    const z = this.kontext()?.turn;
    if (!z) return '';
    const name = (id: string | null): string =>
      !id ? '' : (this.kontext()?.targets[id]?.name ?? this.kontext()?.combatants.find((c) => c.id === id)?.name ?? '');
    const jetzt = name(z.current);
    const dann = name(z.next);
    return [`Round ${z.round}`, jetzt ? `${jetzt}’s turn` : '', dann ? `next: ${dann}` : ''].filter(Boolean).join(' · ');
  });

  /**
   * Die Teilnehmer auf die Karte (REQ-135): ein Block in der Mitte des
   * Ausschnitts, ein Feld auseinander. Danach zieht die Leitung sie an
   * ihren Platz.
   */
  protected teilnehmerSetzen(): void {
    this.blockSetzen(this.offeneTeilnehmer().map((c) => c.id));
  }

  /** Ein Block Spiel-Tokens in der Mitte des Ausschnitts — aus dem Kampf oder der Seitenleiste (T-203). */
  protected blockSetzen(ids: readonly string[]): void {
    const e = this.karte();
    const s = this.einst();
    const n = this.nat();
    if (!e || !s || !ids.length) return;
    const sicht = this.sichtbar();
    const mitte = sicht ? { x: sicht.x + Math.min(sicht.w, 1) / 2, y: sicht.y + Math.min(sicht.h, 1) / 2 } : { x: 0.5, y: 0.5 };
    const schritt = n ? s.gridSize / n.w : 0.05;
    void this.schreiben(placeTokens(e, ids, mitte, schritt, this.seitenverhaeltnis(), () => `r-${crypto.randomUUID()}`));
  }

  // -------------------------------------------------------- Seitenleiste

  /** Offen oder zu, für diesen Schirm; ohne Wahl unter Play offen, auf der Artikelseite zu. */
  private readonly seiteWahl = signal<boolean | null>(null);
  protected readonly seiteOffen = computed(() => this.seiteWahl() ?? this.ort() === 'play');
  protected seiteUm(): void {
    this.seiteWahl.set(!this.seiteOffen());
  }
  /** Je Ziel sein erster Marker hier — für „zentrieren“ und was schon steht. */
  private readonly markerJeZiel = computed(() => {
    const e = this.angezeigt();
    return e ? markerByTarget(e) : new Map<string, { rel: string; x: number; y: number }>();
  });
  protected readonly aufKarte = computed<ReadonlySet<string>>(() => new Set(this.markerJeZiel().keys()));

  /** Die Karte so schieben, dass das Token in der Mitte steht. */
  protected zentrieren(id: string): void {
    const m = this.markerJeZiel().get(id);
    const b = this.buehne()?.nativeElement;
    const h = this.hoehe();
    if (!m || !b || !h) return;
    b.scrollLeft = m.x * this.breite() - b.clientWidth / 2;
    b.scrollTop = m.y * h - b.clientHeight / 2;
  }

  /** Wen „Place“ gerade setzt: das nächste Antippen stellt ihn hin. */
  protected readonly setzenZiel = signal<string | null>(null);
  protected readonly setzenName = signal('');
  protected einenSetzen(z: { id: string; name: string }): void {
    this.aktiv.set('tokens');
    this.waehle('keins');
    this.werkzeug.set('setzen');
    this.setzenZiel.set(z.id);
    this.setzenName.set(z.name);
  }
  private spielTokenSetzen(id: string, pt: Pt): void {
    const e = this.karte();
    this.setzenZiel.set(null);
    this.werkzeug.set('keins');
    if (e) void this.schreiben(addMarker(e, id, pt, `r-${crypto.randomUUID()}`, 'play'));
  }

  /** Aus der Seitenleiste aufs Feld gezogen (HTML-Ziehen; am Telefon „Place“). */
  protected ueberBuehne(ev: DragEvent): void {
    if (this.darfSchreiben() && ev.dataTransfer?.types.includes(ZIEH_TYP)) {
      ev.preventDefault();
      ev.dataTransfer.dropEffect = 'copy';
    }
  }
  protected fallen(ev: DragEvent): void {
    const id = ev.dataTransfer?.getData(ZIEH_TYP);
    if (!id || !this.darfSchreiben()) return;
    ev.preventDefault();
    const pt = this.punkt(ev);
    if (pt && !this.aufKarte().has(id)) this.spielTokenSetzen(id, pt);
  }

  protected spielTokensWeg(): void {
    const e = this.karte();
    if (e && confirm('Remove all play tokens from this map? Prepared markers and the party stay.')) void this.schreiben(clearPlayTokens(e));
  }

  // ------------------------------------------------------------- Nebel

  protected readonly spielersicht = signal(false);
  protected readonly pinsel = signal<number>(2);
  /** `Map.revealOnMove` dieser Karte: an, aus, oder leer — dann gilt die Kampagne (T-204). */
  protected readonly pfadEigen = computed(() => {
    const v = (this.karte()?.components?.['Map'] as { revealOnMove?: unknown } | undefined)?.revealOnMove;
    return typeof v === 'boolean' ? v : null;
  });
  protected readonly kampagneDecktAuf = computed(() => this.regeln().revealOnMove);
  protected readonly pfadAufdecken = computed(() => this.pfadEigen() ?? this.kampagneDecktAuf());
  protected pfadAufdeckenSetzen(wert: string): void {
    const e = this.karte();
    if (!e) return;
    const { revealOnMove: _alt, ...rest } = (e.components?.['Map'] ?? {}) as Record<string, unknown>;
    const karte = wert === 'on' ? { ...rest, revealOnMove: true } : wert === 'off' ? { ...rest, revealOnMove: false } : rest;
    void this.schreiben({ ...e, components: { ...e.components, Map: karte } });
  }
  protected readonly nebelAn = computed(() => {
    const e = this.karte();
    return !!e && fogOn(e);
  });
  /** Was gerade gezogen wird: ein Rechteck (zwei Punkte) oder ein Pinselstrich. */
  private readonly strich = signal<{ pointer: number; pts: Pt[] } | null>(null);

  /** Höhe durch Breite des Kartenbildes; ohne Mass 1. */
  private readonly seitenverhaeltnis = computed(() => {
    const n = this.nat();
    return n && n.w > 0 ? n.h / n.w : 1;
  });
  /** Der Halbmesser des Pinsels in Anteilen der Breite. */
  private readonly pinselRadius = computed(() => {
    const n = this.nat();
    const s = this.einst();
    if (!n || !s) return 0.03;
    return (this.pinsel() * s.gridSize) / 2 / n.w;
  });

  private strichForm(pts: Pt[], fuer?: string | null): RevealShape {
    return {
      id: `s-${crypto.randomUUID()}`,
      kind: 'path',
      pts: pts.map((p) => [p.x, p.y] as [number, number]),
      r: this.pinselRadius(),
      ar: this.seitenverhaeltnis(),
      ...(fuer ? { for: fuer } : {}),
    };
  }
  /** Für wen die Leitung von Hand aufdeckt: nur je Figur, und nur mit Wahl (T-204). */
  private fuerWen(): string | null {
    return this.jeFigur() ? this.nebelFuer() : null;
  }

  private kasten(a: Pt, b: Pt): Frame {
    return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
  }

  /** Die Vorschau eines Rechtecks, solange es gezogen wird. */
  protected readonly vorschau = computed(() => {
    const st = this.strich();
    const w = this.werkzeug();
    if (!st || st.pts.length < 2 || w === 'pinsel') return null;
    return { ...this.kasten(st.pts[0]!, st.pts[1]!), zu: w === 'zudecken' };
  });

  private formFertig(pts: Pt[]): void {
    const e = this.karte();
    if (!e || !pts.length) return;
    const w = this.werkzeug();
    if (w === 'pinsel') {
      void this.schreiben(revealArea(e, this.strichForm(pts, this.fuerWen())));
      return;
    }
    if (pts.length < 2) return;
    const k = this.kasten(pts[0]!, pts[1]!);
    /* Ein Antippen ist kein Rechteck. */
    if (k.w < 0.005 && k.h < 0.005) return;
    const fuer = this.fuerWen();
    if (w === 'aufdecken') void this.schreiben(revealArea(e, { id: `s-${crypto.randomUUID()}`, kind: 'rect', ...k, ...(fuer ? { for: fuer } : {}) }));
    else if (w === 'zudecken') void this.schreiben(coverArea(e, k));
  }

  protected nebelSchalten(an: boolean): void {
    const e = this.karte();
    if (e) void this.schreiben(setFog(e, an));
  }
  protected allesAuf(): void {
    const e = this.karte();
    if (e) void this.schreiben(revealAll(e, `s-${crypto.randomUUID()}`));
  }
  protected allesZu(): void {
    const e = this.karte();
    if (e && confirm('Cover the whole map? Everything revealed so far is covered again.')) void this.schreiben(coverAll(e));
  }

  /**
   * **Der Nebel** (REQ-139): zugedeckt ist alles, was keine aufgedeckte Form
   * berührt. Gezeichnet in `0 0 1 ar`, damit ein Kreis rund bleibt. Die
   * Leitung sieht durch (halb), Spielende und die Spielersicht nicht.
   */
  protected readonly nebel = computed(() => {
    const e = this.angezeigt();
    const n = this.nat();
    if (!e || !fogOn(e) || !n) return null;
    const ar = this.seitenverhaeltnis();
    const auf = (pts: ReadonlyArray<readonly [number, number]>) => pts.map(([x, y]) => [x, y * ar] as const);
    const formen: NebelForm[] = revealShapes(e).map((s) => {
      const leer = { id: s.id, x: 0, y: 0, w: 0, h: 0, r: 0, pts: [] };
      if (s.kind === 'rect') return { ...leer, tag: 'rect', x: s.x, y: s.y * ar, w: s.w, h: s.h * ar };
      if (s.kind === 'circle') return { ...leer, tag: 'circle', x: s.x, y: s.y * ar, r: s.r };
      if (s.kind === 'poly') return { ...leer, tag: 'polygon', pts: auf(s.pts) };
      return { ...leer, tag: 'polyline', r: s.r, pts: auf(s.pts) };
    });
    const st = this.strich();
    if (st && this.werkzeug() === 'pinsel') {
      formen.push({ id: '__strich', tag: 'polyline', x: 0, y: 0, w: 0, h: 0, r: this.pinselRadius(), pts: auf(st.pts.map((p) => [p.x, p.y] as const)) });
    }
    return { ar, formen, deckt: this.alsLeitung() ? 0.5 : 1 };
  });
  /** Nebel, aber noch kein Mass: Spielende sehen bis dahin gar nichts. */
  protected readonly nebelOhneMass = computed(() => {
    const e = this.angezeigt();
    return !!e && fogOn(e) && !this.nat() && !this.alsLeitung();
  });

  // ------------------------------------------------------------ Schreiben

  protected readonly speichert = signal(false);
  protected readonly mangel = signal<Mangel | null>(null);
  /** Ein kurzer Hinweis unter der Leiste — etwa „Moved outside the plan." (T-198). */
  protected readonly hinweis = signal<string | null>(null);
  /** Läuft auf dieser Karte ein Kampf? (`/api/maps/:id/context`, `turn`). */
  protected readonly imKampf = computed(() => !!this.kontext()?.turn);
  /** Leitet der Betrachter den Tisch (und schaut nicht als Spieler)? Schreiben allein reicht im Kampf nicht. */
  protected readonly kampfLeitung = computed(() => this.session.leitung() && !this.spielersicht());

  /**
   * **Die eigene Figur ziehen** (T-204): frei zieht der Server sofort und
   * deckt auf, wenn die Regel es sagt; mit Bestätigung entsteht ein
   * Vorschlag, gestrichelt, bis die Leitung entscheidet.
   */
  private async selbstZiehen(rel: string, to: Pt): Promise<void> {
    const e = this.karte();
    if (!e || this.speichert()) return;
    const nat = this.nat();
    this.mangel.set(null);
    this.speichert.set(true);
    if (this.regeln().moves !== 'confirm') this.entwurf.set(moveMarker(e, rel, to));
    try {
      const r = await this.api.moveToken(this.id(), { rel, to, ...(nat ? { nat } : {}) });
      if (r.proposal) this.hinweis.set(VORSCHLAG_GESENDET);
      await this.bestand.oeffnen(this.id(), true, false);
      await this.kontextHolen(this.id());
    } catch (err) {
      this.mangel.set({ text: err instanceof Error ? err.message : 'The move did not go through.', einzeln: [] });
    } finally {
      this.entwurf.set(null);
      this.speichert.set(false);
    }
  }

  protected async vorschlagEntscheiden(plan: string, d: 'confirm' | 'reject'): Promise<void> {
    try {
      await this.api.decideTurnPlan(this.id(), plan, d);
      await this.kontextHolen(this.id());
    } catch (err) {
      this.hinweis.set(err instanceof Error ? err.message : 'That did not work.');
    }
  }

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

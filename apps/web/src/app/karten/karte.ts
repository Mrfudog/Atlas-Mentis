import { ringStil, tokenStil } from '../artikel/token-bild';
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
  noteName,
  isMarkerView,
  mapMarkerViewOf,
  markerViewOf,
  MARKER_VIEWS,
  withMapMarkerView,
  withMarkerView,
  blockingWalls,
  clearPlayTokens,
  coverAll,
  coverArea,
  drawnSheets,
  entityName,
  fogOn,
  frameNear,
  frameShare,
  areaInFrame,
  ALIGN_ISSUE_TEXT,
  convertDistance,
  feetPerScaleUnit,
  feetToScaleUnit,
  parseScale,
  type AlignIssue,
  linkCentre,
  mapExits,
  outerPlacement,
  LINK_NEAR_MIN,
  MAP_LINK_SHOWS,
  MAP_LINK_SHOW_LABELS,
  MAP_NEAR,
  type MapLink,
  type MapLinkShow,
  gridGeometry,
  HEX_TILE_H,
  HEX_TILE_PATH,
  SCALE_PRESETS,
  scaleLabel,
  isMap,
  isPlayInstance,
  isReleased,
  releaseMap,
  playedInfo,
  templateOf,
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
  feetBetweenTokens,
  planGrid,
  type PlanTerrain,
  planPath,
  planReach,
  tokenCell,
  opportunityAttacks,
  isDoor,
  mapWalls,
  nearestWall,
  removeMarker,
  removeWall,
  revealAlong,
  setWallKind,
  wallKind,
  WALL_KINDS,
  figureView,
  hasSightWalls,
  lightIsOff,
  markerHasLight,
  addLight,
  mapLights,
  setAssetProps,
  setLightOff,
  litAreas,
  LIGHTING_LEVELS,
  mapLighting,
  setLighting,
  addWallsCut,
  canJoinAround,
  DOOR_WIDTH,
  drawShape,
  gridFromCell,
  gridOrigin,
  moveWallPoint,
  nearestPoint,
  outlineWalls,
  removeJoined,
  setGrid,
  gridStroke,
  setMarkerSize,
  setMarkerSizeSource,
  snapTokenCentre,
  tokenSpan,
  tokenSizeOf,
  TOKEN_SPANS,
  shapeOutline,
  snapPoint,
  wallPoints,
  RULE_OPTIONS,
  withRuleVariant,
  INSIDE_MAP_RELATION,
  MAP_TOOL_GROUPS,
  mapKindOf,
  withMapTool,
  type MapToolGroup,
  type Relation,
  GROUND_FLOOR,
  PASSAGE_KINDS,
  addFloor,
  elevationLabel,
  floorGroups,
  floorView,
  mapFloors,
  passageEnds,
  cellPoly,
  inPassage,
  passageArea,
  passageCostText,
  passageRulesOf,
  passageUnder,
  withPassageArea,
  polyBox,
  PASSAGE_TRIGGERS,
  PASSAGE_WHENS,
  PASSAGE_MOVES,
  PASSAGE_ACTIONS,
  PASSAGE_CONFIRMS,
  removeFloor,
  setFloorReleased,
  sightInto,
  updateFloor,
  withFloorView,
  confirmPlacement,
  keepOnMap,
  type PlacementSuggestion,
  areaCells,
  areaColor,
  cellCorners,
  mapAreas,
  zoneRuleText,
} from '@nw/model';
import type { Passage, PassageKind } from '@nw/model';
import type { MarkerView } from '@nw/model';
import type { Cell, DoorState, Entity, Frame, GridGeometry, GridPatch, GridShape, LightLevel, MapMarker, MapRules, MapWall, PlanStep, Pt, RevealShape, Size, WallKind } from '@nw/model';
import { Api, type GespieltZeile, type KartenKontext, type SizeChoice } from '../kern/api';
import { Bestand } from '../kern/bestand';
import { Vorschau } from '../artikel/vorschau';
import { Kurzansicht } from '../kern/kurzansicht';
import { Live } from '../kern/live';
import { Session } from '../kern/session';
import { bildAdresse } from '../artikel/bild';
import { Brett, type Mangel } from '../boards/brett';
import { BoardSuche } from '../boards/suche';
import { BildWahl } from '../artikel/bild';
import { Ladeanzeige } from '../kern/ladeanzeige';
import { tipptGerade } from '../kern/suche';
import { DUNKEL_FARBE, grauMalen, NEBEL_FARBE, nebelBreite, nebelMalen, schichtMalen, type NebelForm, type Schnitt } from './nebel';
import { KartenSeitenleiste, ZIEH_TYP } from './seitenleiste';
import { EditorStand, FINGER_FAKTOR, STAERKE_MAX, STAERKE_MIN } from './editor';

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
  /** Durch wessen Token der Weg geht, ohne dort zu enden (Verbündete, T-349). */
  passable?: readonly string[];
  /** Was Gelände kostet (Zonen der Karte, T-349). */
  terrain?: readonly PlanTerrain[];
}

/** Was ein Antippen im Plan ergibt: ein Weg (mit der Bildgrösse, für den Server) oder ein Ziel. */
export type PlanTipp =
  | { kind: 'cell'; path: Cell[]; feet: number; to: Pt; nat: Size }
  | { kind: 'target'; id: string; name: string; feet: number | null; nat?: Size };

/** Ab so vielen Bildpunkten ist ein Druck ein Ziehen und kein Antippen. */
const ZIEHEN_AB = 5;
/** Eine Strecke zum Anzeigen: zwei Stellen, Schweizer Schreibweise wie `measure`. */
const rundText = (n: number): string => (Math.round(n * 100) / 100).toLocaleString('de-CH', { maximumFractionDigits: 2 });
/** Ein Rad schickt viele kleine Schritte; einer je so viele Millisekunden. */
const RAD_PAUSE = 90;
/** Ein Finger ist breiter als ein Mauszeiger: kleiner wird ein Marker nicht. */
const MARKER_MIN = 26;

/** Ob Zonen und Gebiete gezeigt werden (T-219) — eine Bequemlichkeit je Browser, kein Stand der Karte. */
const FLAECHEN_SCHLUESSEL = 'nw.karte.flaechen';
function lies(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function schreib(k: string, v: string): void {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* Ohne Speicher gilt es bis zum Neuladen. */
  }
}
/** Ein geschlossener Pfad durch Punkte in Anteilen. */
const punktePfad = (pts: readonly Pt[]): string => `M${pts.map((p) => `${r5(p.x)} ${r5(p.y)}`).join(' L')} Z`;
const r5 = (v: number): number => Math.round(v * 100000) / 100000;
/** Eine Form ohne Gitter als Pfad (T-219): Rechteck, Ellipse, Vieleck, Strich als Linie. */
function formPfad(s: RevealShape): string {
  if (s.kind === 'rect') return punktePfad([{ x: s.x, y: s.y }, { x: s.x + s.w, y: s.y }, { x: s.x + s.w, y: s.y + s.h }, { x: s.x, y: s.y + s.h }]);
  if (s.kind === 'circle') {
    const pts: Pt[] = [];
    for (let i = 0; i < 32; i++) {
      const w = (i / 32) * 2 * Math.PI;
      pts.push({ x: s.x + s.r * Math.cos(w), y: s.y + (s.r / s.ar) * Math.sin(w) });
    }
    return punktePfad(pts);
  }
  return punktePfad(s.pts.map(([x, y]) => ({ x, y })));
}

type Werkzeug =
  | 'keins'
  | 'messen'
  | 'setzen'
  | 'tokenWeg'
  | 'tokenGroesse'
  | 'asset'
  | 'aufdecken'
  | 'pinsel'
  | 'zudecken'
  | 'wand'
  | 'wandArt'
  | 'schloss'
  | 'wandWeg'
  | 'punkte'
  | 'licht'
  | 'lichtSchalter'
  | 'gitterUrsprung'
  | 'gitterZelle'
  | 'uebergang'
  | 'uebergangFlaeche'
  | 'rahmen'
  | 'rahmenWeg'
  | 'vieleck'
  | 'platzieren'
  | 'notiz';
/** Die Werkzeuge, die mit dem Finger eine Form ziehen statt die Karte zu schieben. */
const ZIEHT_FORM: ReadonlySet<Werkzeug> = new Set(['aufdecken', 'pinsel', 'zudecken', 'rahmen']);
/** Der Hinweis nach einem Zugvorschlag (T-204). */
const VORSCHLAG_GESENDET = 'Sent — waiting for the GM to confirm the move.';
/** So nah (Bildschirmpunkte) muss ein Antippen an einer Sperre liegen, um sie zu treffen. */
const SPERRE_TREFFER = 14;
/** Die Werkzeuge, die einen Punkt setzen — in ihnen öffnet Halten die Lupe (T-315). */
const LUPE_WERKZEUGE: ReadonlySet<Werkzeug> = new Set(['wand', 'punkte', 'gitterUrsprung', 'gitterZelle', 'setzen', 'platzieren', 'notiz', 'vieleck']);
/** So lange hält man, bis die Lupe aufgeht. */
const LUPE_MS = 280;
/** Halbmesser der Lupe am Schirm, und wie stark sie vergrössert. */
const LUPE_R = 70;
const LUPE_ZOOM = 3;
/** Auf vier Stellen, wie jede Lage an einer Kante. */
const r4 = (v: number): number => Math.round(Math.min(1, Math.max(0, v)) * 10000) / 10000;
/** Pinselbreiten in Feldern. */
const PINSEL = [1, 2, 4, 8] as const;

/** Die Gruppen der Werkzeugleiste (T-203). */
type Gruppe = 'auswahl' | 'zug' | 'tokens' | 'messen' | 'ebenen' | 'nebel' | 'licht' | 'waende' | 'gitter' | 'unterkarten' | 'notizen' | 'zeichnen';
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
  /** Die Werkzeuggruppen der Kampagne (`Campaign.mapTools`, T-320), von denen eine eingeschaltet sein muss. */
  braucht?: readonly MapToolGroup[];
}
/**
 * **Die Werkzeugleiste** nach dem Vergleich (docs/vorschlaege/Karten-VTT-Vergleich.md):
 * Auswahl · Tokens · Messen · Nebel · Wände · Notizen · Zeichnen. Was noch
 * kein Werkzeug hat, ist hier vorgesehen und steht nicht da („Was nicht
 * gilt, steht nicht da").
 */
const GRUPPEN: readonly GruppenDef[] = [
  { key: 'auswahl', label: 'Select', title: 'Select and move markers, open their quick view', sym: '↖', taste: 'S' },
  /* **Der Zugplan als Werkzeug** (T-325, die Leitung 21.10.): in derselben
     Leiste statt einer eigenen darunter; da nur, wenn der Server dem
     Betrachter eine Figur zum Planen gibt (`zugplan`). */
  { key: 'zug', label: 'Plan turn', title: 'Plan the turn of your character: move, act, send it to the GM', sym: '⚔', taste: 'P' },
  { key: 'tokens', label: 'Tokens', title: 'Add markers, place combatants, clear play tokens', sym: '◉', taste: 'T', leitung: true, braucht: ['tokens', 'markers', 'assets'] },
  { key: 'messen', label: 'Measure', title: 'Tap two points to measure', sym: '↔', taste: 'M' },
  /* **Ebenen** (T-307, E-108): Stockwerke, Keller, Turmgeschosse, und die
     Übergänge dazwischen. Spielende sehen die Gruppe, sobald es mehr als eine Ebene gibt. */
  { key: 'ebenen', label: 'Floors', title: 'Floors of this map, and the stairs, ladders and portals between them', sym: '⧉', taste: 'E' },
  { key: 'nebel', label: 'Fog', title: 'Fog of war: reveal and hide what the players see', sym: '☁', taste: 'F', leitung: true, braucht: ['fog'] },
  /* Licht ist ein eigenes Werkzeug (T-305, die Leitung 20.10.): wie hell
     die Karte ist und welche Marker leuchten, hat mit dem Nebel nichts zu tun. */
  { key: 'licht', label: 'Light', title: 'Lighting of the map, light sources, lights on and off', sym: '☀', taste: 'L', leitung: true, braucht: ['light'] },
  { key: 'waende', label: 'Walls', title: 'Walls, doors, windows and obstacles', sym: '▥', taste: 'W', leitung: true, braucht: ['walls'] },
  { key: 'gitter', label: 'Grid', title: 'Set the grid on the map: origin, square size, shape', sym: '#', taste: 'G', leitung: true, braucht: ['grid'] },
  /* **Unterkarten** (T-320): einen Rahmen ziehen, die Karte wählen, in die man dort hineinzoomt. */
  { key: 'unterkarten', label: 'Sub-maps', title: 'Link a map to a frame on this one, to zoom into it', sym: '⊡', taste: 'K', leitung: true, braucht: ['frames'] },
  /* **Notizen** (T-214, E-070 a): eine Notiz ist ein Artikel `Note`, auf der Karte ein Marker auf sie. */
  { key: 'notizen', label: 'Notes', title: 'Notes on the map: tap where one goes, for the GM or the players', sym: '✎', taste: 'N', leitung: true, braucht: ['markers'] },
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
  imports: [RouterLink, BoardSuche, BildWahl, Ladeanzeige, KartenSeitenleiste, Vorschau],
  template: `
    <div class="karte" [class.gross]="gross()" [class.voll]="vollbild()" [class.ersatz]="ersatzVollbild()" [class.mit-plan]="aktiv() === 'zug' && zugplan()" [class.mit-panel]="(initiative() && initiativeOffen()) || seiteOffen()">
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
          @if (flaechen().length) {
            <!-- Zonen und Gebiete ein- und ausblenden (T-219) — eine Sache der Sicht, gemerkt im Browser. -->
            <button type="button" class="flaechen-knopf" [class.an]="flaechenAn()" [attr.aria-pressed]="flaechenAn()" (click)="flaechenUm()" [title]="flaechenAn() ? 'Hide zones and territories: ' + flaechenText() : 'Show zones and territories: ' + flaechenText()">Areas</button>
          }
          <!-- Am Telefon stehen Sicht und Freigabe in einem Menü (T-320): die Karte braucht den Platz. -->
          <!-- Ohne Schreibrecht steht darin nichts (seit T-325 ist Party ein Panel der Leiste). -->
          @if (darfSchreiben()) {
          <button type="button" class="menue-knopf" [class.an]="menueOffen()" [attr.aria-expanded]="menueOffen()" (click)="menueOffen.set(!menueOffen())" title="View as and release">
            <span aria-hidden="true">⋯</span> View
          </button>
          <span class="mehr" [class.offen]="menueOffen()">
          @if (darfSchreiben()) {
            <!-- **Ein Wähler „View as“** (T-320, wie „View as“ im Kopf, T-269): Leitung, alle
                 Spielenden oder eine Figur. Je Figur aufgedeckt (T-204) wird für die, als die man schaut. -->
            <label class="fuer" [class.an]="spielersicht()" title="See the map as the GM, as all players, or as one character — with fog per character, what you reveal then is for that character">
              View as
              <select (change)="ansehenAls($any($event.target).value)" aria-label="View the map as">
                <option value="gm" [selected]="!spielersicht()">GM</option>
                <option value="all" [selected]="spielersicht() && !nebelFuer()">all players</option>
                @for (f of figurenHier(); track f.id) {
                  <option [value]="f.id" [selected]="spielersicht() && nebelFuer() === f.id">{{ f.name }}</option>
                }
              </select>
            </label>
          }
          @if (darfSchreiben() && istInstanz()) {
            <!-- **Freigabe** (T-289, E-041): bis dahin ist die Karte für Spielende nicht vorhanden. -->
            <button type="button" class="freigabe" [class.an]="freigegeben()" [attr.aria-pressed]="freigegeben()" (click)="freigeben(!freigegeben())" [title]="freigegeben() ? 'Players see this map. Click to take it back from them.' : 'Players do not see this map yet. Release it — the fog applies at once.'">
              {{ freigegeben() ? 'Released' : 'Release to players' }}
            </button>
            @if (deckname(); as d) {
              <!-- **Aufdecken** (REQ-178): Spielende sehen den Decknamen, bis die Leitung den Namen teilt. -->
              <button type="button" class="freigabe" [disabled]="deckt()" (click)="namenAufdecken()" [title]="'Players see “' + d + '”. Reveal the real name to the party — more knowledge is shared under Knowledge on the article.'">
                Reveal name
              </button>
            }
            @if (kontext()?.session) {
              <!-- **Zwischen Karten wechseln** (T-308): ein Schalter an der Sitzung, Vorgabe aus. -->
              <button type="button" class="freigabe" [class.an]="kontext()!.mapNavigation" [attr.aria-pressed]="kontext()!.mapNavigation" [disabled]="navigationSpeichert()" (click)="navigationSetzen(!kontext()!.mapNavigation)" [title]="kontext()!.mapNavigation ? 'Players may zoom into sub-maps and out to the map above — only maps released in this session. Click to keep them on this map.' : 'Players stay on this map; frames are only picture for them. Click to let them zoom to other released maps.'">
                {{ kontext()!.mapNavigation ? 'Players change maps' : 'Players stay here' }}
              </button>
            }
          } @else if (darfSchreiben() && ort() === 'play' && sitzung() && karte() && !istInstanz()) {
            <button type="button" class="freigabe" (click)="insSpielNehmen()" title="Put this map on the table of the session as a map in play: tokens and fog live there, the map itself stays as it is">
              Take into play
            </button>
          }
          </span>
          }
          <button type="button" class="vollbild" [class.an]="vollbild()" [attr.aria-pressed]="vollbild()" (click)="vollbildUm()" [title]="vollbild() ? 'Leave fullscreen (Esc)' : 'Fullscreen (Shift+F)'">
            <span aria-hidden="true">{{ vollbild() ? '⤡' : '⤢' }}</span>
            {{ vollbild() ? 'Exit fullscreen' : 'Fullscreen' }}
          </button>
        </div>
      </div>

      @if (gespielt(); as g) {
        <!-- **Ein gespielter Stand** (T-289): die Instanz, mit Datum, Sitzung und Vorlage. -->
        <p class="gespielt" role="note">
          <b>Map in play</b>{{ g.at ? ' · ' + g.at : '' }}
          @if (g.session) {
            · <a [routerLink]="['/artikel', g.session]">{{ g.sessionName }}</a>
          }
          @if (g.template) {
            · from <a [routerLink]="['/artikel', g.template]">{{ g.templateName }}</a>
          }
          @if (darfSchreiben() && !freigegeben()) {
            <span class="marke">Not released — players do not see this map</span>
          }
          @if (ort() === 'artikel') {
            · <a class="spielen" [routerLink]="['/play']" [queryParams]="spielQuery(id(), g.session)">Open in Play</a>
          }
        </p>
      } @else if (ort() === 'artikel' && gespieltListe().length) {
        <!-- Offen (T-316): wer die Vorlage ansieht, will meist zu einem ihrer Stände. -->
        <details class="gespielt-liste" open>
          <summary>Played ({{ gespieltListe().length }})</summary>
          <ul>
            @for (r of gespieltListe(); track r.id) {
              <li>
                <a [routerLink]="['/artikel', r.id]">{{ datum(r.at) || r.name }}</a>
                @if (r.sessionName) {
                  · {{ r.sessionName }}
                }
                @for (b of r.encounterNames; track b.id) {
                  · <a [routerLink]="['/artikel', b.id]">{{ b.name }}</a>
                }
                @if (darfSchreiben() && !r.released) {
                  <span class="marke">not released</span>
                }
                · <a class="spielen" [routerLink]="['/play']" [queryParams]="spielQuery(r.id, r.session)" [attr.aria-label]="'Open ' + (datum(r.at) || r.name) + ' in Play'">Open in Play</a>
              </li>
            }
          </ul>
        </details>
      }

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
            <button type="button" [class.an]="aktiv() === g.key" [attr.aria-pressed]="aktiv() === g.key" [attr.aria-label]="g.label" [title]="gruppenTitel(g)" (click)="gruppeWaehlen(g.key)">
              <span class="sym" aria-hidden="true">{{ g.sym }}</span>
              <span class="txt">{{ g.key === 'ebenen' && ebenen().length > 1 ? (ebeneJetzt()?.name ?? g.label) : g.label }}</span>
              @if (g.key === 'zug' && zugZahl()) {
                <span class="zahl" title="Turns waiting for you">{{ zugZahl() }}</span>
              }
            </button>
          }
          <!-- **Panels** (T-325): was neben der Karte stand, klappt aus der Leiste auf —
               es ändert nicht, was ein Antippen tut, und bleibt neben jedem Werkzeug offen. -->
          <span class="trenner" aria-hidden="true"></span>
          @if (initiative()) {
            <button type="button" class="panel-knopf" [class.an]="initiativeOffen()" [attr.aria-pressed]="initiativeOffen()" aria-label="Initiative" title="The initiative tracker of the running encounter, beside the map (I)" (click)="initiativeUm()">
              <span class="sym" aria-hidden="true">⚑</span>
              <span class="txt">Initiative</span>
            </button>
          }
          <button type="button" class="panel-knopf" [class.an]="seiteOffen()" [attr.aria-pressed]="seiteOffen()" aria-label="Party and encounters" title="The party and the encounters of this map, beside it (Y)" (click)="seiteUm()">
            <span class="sym" aria-hidden="true">☰</span>
            <span class="txt">Party</span>
          </button>
          @if (kampfLeitung() && kontext()?.campaign) {
            <!-- **Werkzeuge je Kartentyp** (T-320): der Absprung zur Einstellung der Kampagne. -->
            <button type="button" class="werkzeug-knopf" [class.an]="werkzeugBlatt()" [attr.aria-expanded]="werkzeugBlatt()" aria-label="Tools for this map kind" [title]="'Which tools ' + kartenArt() + ' maps show in this campaign'" (click)="werkzeugBlatt.set(!werkzeugBlatt())">
              <span class="sym" aria-hidden="true">⚙</span>
              <span class="txt">Tools</span>
            </button>
          }
          <button type="button" class="einklappen" (click)="leisteZu.set(!leisteZu())" [attr.aria-expanded]="!leisteZu()" [attr.aria-label]="leisteZu() ? 'Show tool names' : 'Hide tool names'" [title]="leisteZu() ? 'Show tool names' : 'Hide tool names'">
            <span aria-hidden="true">{{ leisteZu() ? '»' : '«' }}</span>
          </button>
        </div>

        <div class="spalte">
          @if (werkzeugBlatt() && kampfLeitung()) {
            <div class="bewegung-blatt" role="group" [attr.aria-label]="'Tools on ' + kartenArt() + ' maps'">
              <b>Tools on {{ kartenArt() }} maps</b>
              @for (g of WERKZEUG_GRUPPEN; track g.key) {
                <label [title]="g.does">
                  <input type="checkbox" [checked]="werkzeugEingestellt().has(g.key)" [disabled]="werkzeugSpeichert()" (change)="werkzeugSetzen(g.key, $any($event.target).checked)" />
                  {{ g.label }}
                </label>
              }
              @if (bewegungFehler(); as f) {
                <p class="fehler" role="alert">{{ f }}</p>
              }
              <p class="hint">For every {{ kartenArt() }} map of this campaign; the map's kind is set in its fields. Fog that is on and a map that is not bright keep their tools. All kinds at once under <a [routerLink]="['/artikel', kontext()!.campaign]">Rules &amp; options</a> › Map tools.</p>
            </div>
          }
          @if (aktiv() === 'unterkarten' && darfSchreiben()) {
            <!-- **Unterkarten verlinken** (T-320): Rahmen ziehen, Karte wählen — hineinzoomen führt dann dorthin. -->
            <div class="unterleiste" role="toolbar" aria-label="Sub-maps">
              <button type="button" [class.an]="werkzeug() === 'rahmen'" [attr.aria-pressed]="werkzeug() === 'rahmen'" (click)="waehle('rahmen')" title="Drag a frame over the part of this map, then pick the map you zoom into there">Link map</button>
              <button type="button" [class.an]="werkzeug() === 'vieleck' && vieleckFuer()?.art === 'neu'" [attr.aria-pressed]="werkzeug() === 'vieleck' && vieleckFuer()?.art === 'neu'" (click)="vieleckBeginnen({ art: 'neu' })" title="Tap the corners of the area, then pick the map you zoom into there">Link shape</button>
              <button type="button" [class.an]="werkzeug() === 'rahmenWeg'" [attr.aria-pressed]="werkzeug() === 'rahmenWeg'" (click)="waehle('rahmenWeg')" title="Tap a frame to unlink its map; the map itself stays">Unlink</button>
              @if (verknuepfungen().length && !rahmenNeu()) {
                <!-- **Eine Verknüpfung einstellen** (T-327): Zoomtiefe, Anzeige für Leitung und Spielende, Rand, Form. -->
                <label>
                  Link settings
                  <select (change)="linkWahl.set($any($event.target).value || null)" aria-label="Linked map to set up">
                    <option value="" [selected]="!linkWahl()">choose a linked map…</option>
                    @for (k of verknuepfungen(); track k.id) {
                      <option [value]="k.id" [selected]="linkWahl() === k.id">{{ k.name }}</option>
                    }
                  </select>
                </label>
              }
              @if (linkOffen(); as l) {
                <span class="link-einstellung">
                  <label title="How much of the view the area must fill before the next zoom step enters the sub-map — counted only when the cursor (mouse wheel) or the centre of the view lies in it">
                    Enter when it fills
                    <span class="nah-regler" [style.--jetzt]="l.jetztProzent + '%'">
                      <input type="range" min="10" max="100" step="5" [value]="l.nearProzent" (change)="linkSetzen(l, { near: +$any($event.target).value / 100 })" aria-label="Zoom depth: share of the view" />
                      <span class="jetzt" aria-hidden="true" [title]="'Now: ' + l.jetztProzent + '%'"></span>
                    </span>
                    {{ l.nearProzent }}% of the view
                  </label>
                  <!-- Wie viel die Verknüpfung den Blick gerade füllt — und das übernehmen. -->
                  <span class="dim">now {{ l.jetztProzent }}%</span>
                  <button type="button" class="klein" [disabled]="l.jetztProzent < 10" (click)="linkSetzen(l, { near: l.jetzt })" title="Enter this sub-map from the zoom you are at now">Use current</button>
                  <label>
                    GM sees
                    <select (change)="linkSetzen(l, { show: $any($event.target).value || null })" aria-label="How the GM sees this link">
                      <option value="" [selected]="!l.own.show">Campaign ({{ MAP_LINK_SHOW_LABELS[l.vorgabe.show] }})</option>
                      @for (v of MAP_LINK_SHOWS; track v) {
                        <option [value]="v" [selected]="l.own.show === v">{{ MAP_LINK_SHOW_LABELS[v] }}</option>
                      }
                    </select>
                  </label>
                  <label>
                    Players see
                    <select (change)="linkSetzen(l, { showPlayers: $any($event.target).value || null })" aria-label="How players see this link">
                      <option value="" [selected]="!l.own.showPlayers">Campaign ({{ MAP_LINK_SHOW_LABELS[l.vorgabe.showPlayers] }})</option>
                      @for (v of MAP_LINK_SHOWS; track v) {
                        <option [value]="v" [selected]="l.own.showPlayers === v">{{ MAP_LINK_SHOW_LABELS[v] }}</option>
                      }
                    </select>
                  </label>
                  <label title="Inside the sub-map, show this map faded around its image">
                    Border
                    <select (change)="linkSetzen(l, { outer: $any($event.target).value || null })" aria-label="This map as a border of the sub-map">
                      <option value="" [selected]="!l.own.outer">Campaign ({{ l.vorgabe.outer === 'faded' ? 'faded' : 'none' }})</option>
                      <option value="faded" [selected]="l.own.outer === 'faded'">Faded</option>
                      <option value="none" [selected]="l.own.outer === 'none'">None</option>
                    </select>
                  </label>
                  <!-- **Am Raster ausrichten** (T-329): Grösse aus beiden Massstäben, Lage am Raster dieser Karte. -->
                  <label [title]="l.sperre ?? 'The area’s size follows from both scales and snaps to this map’s grid'">
                    <input type="checkbox" [checked]="l.align" [disabled]="!!l.sperre && !l.align" (change)="linkSetzen(l, { align: $any($event.target).checked || null })" />
                    Align to parent grid
                  </label>
                  @if (l.sperre ?? l.issue; as h) {
                    <span class="hint">{{ h }}</span>
                  }
                  <button type="button" class="klein" (click)="vieleckBeginnen({ art: 'link', id: l.id })" title="Tap the corners of a new area for this link">{{ l.form ? 'Redraw shape' : 'Make it a shape' }}</button>
                  @if (l.form) {
                    <button type="button" class="klein" (click)="linkSetzen(l, { area: null })" title="Back to the rectangle around the shape">Rectangle</button>
                  }
                </span>
              }
              @if (rahmenNeu()) {
                <label>
                  Map
                  <select (change)="rahmenZiel.set($any($event.target).value || null)" aria-label="Map to link in this frame">
                    <option value="" [selected]="!rahmenZiel()">choose a map…</option>
                    @for (k of rahmenWahl(); track k.id) {
                      <option [value]="k.id" [selected]="rahmenZiel() === k.id">{{ k.name }}{{ k.kind ? ' · ' + k.kind : '' }}</option>
                    }
                  </select>
                </label>
                <button type="button" [disabled]="!rahmenZiel() || rahmenSpeichert()" (click)="rahmenVerlinken()">Link</button>
                <button type="button" (click)="rahmenNeu.set(null)">Cancel</button>
              }
              @if (rahmenFehler(); as f) {
                <span class="fehler" role="alert">{{ f }}</span>
              }
            </div>
          }
          @if (aktiv() === 'tokens' && darfSchreiben()) {
            <div class="unterleiste" role="toolbar" aria-label="Tokens">
              @if (werkzeuge().has('markers') || werkzeuge().has('tokens')) {
                <button type="button" [class.an]="werkzeug() === 'setzen'" [attr.aria-pressed]="werkzeug() === 'setzen'" (click)="waehle('setzen')" title="Tap the map where the marker goes">
                  Add marker
                </button>
              }
              <!-- **Assets** (T-306): Kiste, Tisch, Laterne — liegen, wie man sie hinlegt, und sind fix, bis „Movable in play“ es anders sagt. -->
              @if (bearbeitung() && werkzeuge().has('assets')) {
                <button type="button" [class.an]="werkzeug() === 'setzen' && setzenArt() === 'scenery'" [attr.aria-pressed]="werkzeug() === 'setzen' && setzenArt() === 'scenery'" (click)="assetSetzen()" title="Tap the map where the asset goes — a crate, a table, a lantern">
                  Add asset
                </button>
                <button type="button" [class.an]="werkzeug() === 'asset'" [attr.aria-pressed]="werkzeug() === 'asset'" (click)="waehle('asset')" title="Tap an asset to size, turn, fix or free it and say what it blocks">
                  Asset
                </button>
              }
              @if (offeneTeilnehmer().length && werkzeuge().has('tokens')) {
                <button type="button" (click)="teilnehmerSetzen()" [title]="'Put ' + offeneTeilnehmer().length + ' combatants of ' + (kontext()?.turn?.name ?? 'the fight') + ' on the map'">
                  Place combatants ({{ offeneTeilnehmer().length }})
                </button>
              }
              @if (werkzeuge().has('markers') || werkzeuge().has('tokens')) {
                <!-- **Markeransicht der Karte** (T-214, \`Map.markerView\`): ein Marker darf es anders sagen. -->
                <label class="markeransicht" title="How markers stand on this map. Tap a marker to set it for that one alone.">
                  Markers show as
                  <select (change)="markerAnsichtKarte($any($event.target).value)" aria-label="Markers on this map show as">
                    <option value="" [selected]="!kartenMarkerAnsicht()">{{ kartenVorgabeText() }}</option>
                    @for (v of MARKER_VIEWS; track v.key) {
                      <option [value]="v.key" [selected]="kartenMarkerAnsicht() === v.key" [title]="v.does">{{ v.label }}</option>
                    }
                  </select>
                </label>
              }
              <button type="button" [class.an]="werkzeug() === 'tokenWeg'" [attr.aria-pressed]="werkzeug() === 'tokenWeg'" (click)="waehle('tokenWeg')" title="Tap a marker to take it off the map">
                Remove
              </button>
              <!-- **Platz eines Tokens** (T-317): in Feldern, auch halbe; „by size“ folgt dem Statblock. -->
              <!-- „Token size“ (T-320): „Size“ allein sagte nicht, wessen Grösse und wovon. -->
              @if (werkzeuge().has('tokens')) {
              <button type="button" [class.an]="werkzeug() === 'tokenGroesse'" [attr.aria-pressed]="werkzeug() === 'tokenGroesse'" (click)="waehle('tokenGroesse')" title="How many squares a token covers. Choose the size, then tap the token.">
                Token size
              </button>
              @if (werkzeug() === 'tokenGroesse') {
                <label title="How many squares the token covers; “by size” follows the statblock (Medium 1×1, Large 2×2, Huge 3×3, Gargantuan 4×4)">
                  Covers
                  <select (change)="groesseWahl.set($any($event.target).value ? +$any($event.target).value : null)" aria-label="Token size in squares">
                    <option value="" [selected]="groesseWahl() === null">by size (statblock)</option>
                    @for (n of TOKEN_SPANS; track n) {
                      <option [value]="n" [selected]="groesseWahl() === n">{{ n }} × {{ n }} squares</option>
                    }
                  </select>
                </label>
                <span class="hint">How many squares the token covers; “by size” follows the statblock (Medium 1×1, Large 2×2 …). The dashed square shows it — tap a token to apply.</span>
              }
              }
              @if (spielTokens()) {
                <button type="button" (click)="spielTokensWeg()" title="Remove the tokens placed for play; prepared markers and the party stay">Clear play tokens</button>
              }
              <!-- **Wer zieht** (T-290, E-040): der Stand der Kampagne, und ein Klick öffnet ihn als Blatt. -->
              @if (kampfLeitung() && kontext()?.campaign && werkzeuge().has('tokens')) {
                <button type="button" class="bewegung-knopf" [class.an]="bewegungOffen()" [attr.aria-expanded]="bewegungOffen()" (click)="bewegungOffen.set(!bewegungOffen())" title="Who may move tokens in this campaign, and whether you confirm moves">
                  Movement: {{ bewegungText() }}
                </button>
              }
            </div>
            @if (werkzeug() === 'asset' && gewaehltesAsset(); as a) {
              <div class="asset-blatt" role="group" aria-label="Asset settings">
                <strong>{{ a.name }}</strong>
                <label>
                  Squares wide
                  <input type="number" class="zahl" min="0.25" max="40" step="0.25" [value]="a.size" (change)="assetSetzenProp(a.rel.id, { size: +$any($event.target).value || 1 })" aria-label="Width in squares" />
                </label>
                <label>
                  Height ÷ width
                  <input type="number" class="zahl" min="0.1" max="10" step="0.1" [value]="a.ratio" (change)="assetSetzenProp(a.rel.id, { ratio: +$any($event.target).value || 1 })" aria-label="Height divided by width" />
                </label>
                <label>
                  Rotation
                  <input type="number" class="zahl" min="-360" max="360" step="15" [value]="a.rot" (change)="assetSetzenProp(a.rel.id, { rot: (+$any($event.target).value || 0) % 360 })" aria-label="Rotation in degrees" />
                </label>
                <button type="button" (click)="assetSetzenProp(a.rel.id, { rot: (a.rot - 15) % 360 })" aria-label="Turn left 15°" title="Turn left 15°">⟲</button>
                <button type="button" (click)="assetSetzenProp(a.rel.id, { rot: (a.rot + 15) % 360 })" aria-label="Turn right 15°" title="Turn right 15°">⟳</button>
                <label title="Fixed assets stay where they are in play; movable ones can be pushed — by the GM always, by players if the campaign lets them move more than their own figure.">
                  <input type="checkbox" [checked]="a.movable" (change)="assetSetzenProp(a.rel.id, { movable: $any($event.target).checked })" />
                  Movable in play
                </label>
                <label title="What the asset's outline blocks, like a wall of that kind">
                  Blocks
                  <select (change)="assetSetzenProp(a.rel.id, { blocks: $any($event.target).value || null })" aria-label="What the asset blocks">
                    <option value="" [selected]="!a.blocks">nothing</option>
                    @for (k of ASSET_SPERREN; track k.key) {
                      <option [value]="k.key" [selected]="a.blocks === k.key">{{ k.label }} — {{ k.does }}</option>
                    }
                  </select>
                </label>
                <p class="hint">Light: Light › Light source. Drag the asset to move it.</p>
              </div>
            }
            @if (bewegungOffen() && kampfLeitung()) {
              <div class="bewegung-blatt" role="group" aria-label="Movement settings">
                <label>
                  Who moves tokens
                  <select (change)="bewegungSetzen('tokenMove', $any($event.target).value)" [disabled]="bewegungSpeichert()" aria-label="Who moves tokens">
                    @for (o of TOKEN_MOVE_WAHL; track o.key) {
                      <option [value]="o.key" [selected]="regeln().tokenMove === o.key">{{ o.label }}</option>
                    }
                  </select>
                </label>
                <label>
                  <input type="checkbox" [checked]="regeln().moves === 'confirm'" [disabled]="bewegungSpeichert()" (change)="bewegungSetzen('moves', $any($event.target).checked ? 'confirm' : 'free')" />
                  I confirm moves first
                </label>
                @if (bewegungFehler(); as f) {
                  <p class="fehler" role="alert">{{ f }}</p>
                }
                <p class="hint">Applies to this campaign at once. Out of an encounter; in one, the turn plan applies. More under <a [routerLink]="['/artikel', kontext()!.campaign]">Rules &amp; options</a>.</p>
              </div>
            }
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

          @if (aktiv() === 'ebenen') {
            <div class="unterleiste ebenen" role="toolbar" aria-label="Floors">
              <!-- **Ebenen** (T-307, E-108): eine flache Liste, gruppiert nach Gebäudeteil und nach Höhe sortiert. -->
              @for (g of ebenenGruppen(); track g.structure) {
                <span class="ebenengruppe" role="group" [attr.aria-label]="g.structure || name()">
                  @if (g.structure) {
                    <b>{{ g.structure }}</b>
                  }
                  @for (f of g.floors; track f.id) {
                    <button type="button" [class.an]="f.id === ebene()" [attr.aria-pressed]="f.id === ebene()" (click)="ebeneZeigen(f.id)" [title]="f.name + (f.elevation ? ', ' + elevationLabel(f.elevation) : '')">
                      {{ f.name }}
                      @if (f.elevation) {
                        <small>{{ elevationLabel(f.elevation) }}</small>
                      }
                      @if (f.gmOnly) {
                        <span class="marke">GM</span>
                      } @else if (!f.released) {
                        <span class="marke">held back</span>
                      }
                    </button>
                  }
                </span>
              }
              @if (ebenenLeitung()) {
                <button type="button" (click)="ebeneDazu()" title="Add a floor — a storey, a cellar, a tower level — with its own image, grid and walls">+ Floor</button>
                <button type="button" [class.an]="werkzeug() === 'uebergang'" [attr.aria-pressed]="werkzeug() === 'uebergang'" (click)="uebergangBeginnen()" title="Tap where the stairs, ladder, bridge or portal is, then where it leads">Add passage</button>
                @if (werkzeug() === 'uebergang') {
                  <label>
                    Kind
                    <select (change)="uebergangArt.set($any($event.target).value)" aria-label="Kind of passage">
                      @for (k of PASSAGE_KINDS; track k) {
                        <option [value]="k" [selected]="k === uebergangArt()">{{ k }}</option>
                      }
                    </select>
                  </label>
                  @if (uebergangA()) {
                    <label>
                      Leads to
                      <select (change)="uebergangZielWaehlen($any($event.target).value)" aria-label="Where the passage leads">
                        <option value="" [selected]="!uebergangZiel()">— choose —</option>
                        @for (f of ebenen(); track f.id) {
                          <option [value]="f.id" [selected]="uebergangZiel() === f.id">{{ f.name }}{{ f.structure ? ' (' + f.structure + ')' : '' }}</option>
                        }
                        <option value="__karte" [selected]="uebergangZiel() === '__karte'">another map…</option>
                      </select>
                    </label>
                  }
                }
              }
            </div>
            @if (ebenenLeitung() && werkzeug() === 'uebergang' && uebergangZiel() === '__karte') {
              <div class="ebene-einstellen">
                <nw-board-suche [ohne]="nurKarten()" (gewaehlt)="uebergangKarte($event)" />
              </div>
            }
            @if (ebenenLeitung() && werkzeug() !== 'uebergang' && ebeneJetzt(); as f) {
              <div class="ebene-einstellen" role="group" aria-label="This floor">
                <label>
                  Name
                  <input type="text" [value]="f.name" (change)="ebeneAendern({ name: $any($event.target).value || null })" />
                </label>
                <label title="The part of the building — the bar groups floors by it">
                  Building part
                  <input type="text" [value]="f.structure" placeholder="e.g. West tower" (change)="ebeneAendern({ structure: $any($event.target).value || null })" />
                </label>
                <label title="Height range in feet — shows which floors of two towers lie level with each other">
                  From ft
                  <input #von type="number" class="zahl" [value]="f.elevation?.from ?? ''" (change)="hoeheAendern(von.value, bis.value)" />
                </label>
                <label>
                  to ft
                  <input #bis type="number" class="zahl" [value]="f.elevation?.to ?? ''" (change)="hoeheAendern(von.value, bis.value)" />
                </label>
                @if (!f.ground) {
                  <label title="Never shown to players — notes, a secret level">
                    <input type="checkbox" [checked]="f.gmOnly" (change)="ebeneAendern({ gmOnly: $any($event.target).checked })" />
                    GM only
                  </label>
                  <label title="Players do not see this floor until you release it">
                    <input type="checkbox" [checked]="!f.released" (change)="ebeneFreigeben(!$any($event.target).checked)" />
                    Held back
                  </label>
                  <button type="button" (click)="ebeneWeg()">Remove floor</button>
                }
              </div>
              @if (!f.ground) {
                <div class="ebene-einstellen">
                  <!-- Das Bild der Ebene — Gitter und Massstab stellt die Gruppe „Grid“ für diese Ebene ein. -->
                  <nw-bildwahl [wert]="f.image" [fuer]="id()" label="Floor image" klasse="map" (wertChange)="ebeneAendern({ image: $event || null })" />
                </div>
              } @else {
                <p class="hinweis">The first floor is the map itself: its image, grid and walls. Each further floor has its own image, grid, scale and walls — set them with Grid and Walls while it is shown.</p>
              }
            }
          }

          @if (aktiv() === 'licht' && darfSchreiben()) {
            <div class="unterleiste" role="toolbar" aria-label="Light">
              <!-- **Licht** (T-216, REQ-140, T-305): wie hell die Karte ist, und welche Marker leuchten. -->
              <label title="How bright the map is. In the dark, the players see only lights and what their darkvision reaches.">
                Lighting
                <select (change)="helligkeitSetzen($any($event.target).value)" aria-label="Lighting of this map">
                  @for (l of LIGHTING_LEVELS; track l) {
                    <option [value]="l" [selected]="l === helligkeit()">{{ l }}</option>
                  }
                </select>
              </label>
              <button type="button" [class.an]="werkzeug() === 'licht'" [attr.aria-pressed]="werkzeug() === 'licht'" (click)="waehle('licht')" title="Tap the map to place a light there, or a token, asset or marker to give it this light; 0 and 0 takes it away">Light source</button>
              <button type="button" [class.an]="werkzeug() === 'lichtSchalter'" [attr.aria-pressed]="werkzeug() === 'lichtSchalter'" (click)="waehle('lichtSchalter')" title="Tap a light to switch it off or on again; its radius stays">Light on/off</button>
              @if (helligkeit() === 'bright') {
                <span class="hint">The map is bright: lights change nothing until Lighting is dim or dark.</span>
              }
              @if (werkzeug() === 'licht') {
                <label>
                  Bright
                  <input type="number" min="0" max="60" step="1" class="zahl" [value]="lichtHell()" (change)="lichtHell.set(+$any($event.target).value || 0)" aria-label="Bright light in squares" />
                </label>
                <label>
                  Dim
                  <input type="number" min="0" max="120" step="1" class="zahl" [value]="lichtMatt()" (change)="lichtMatt.set(+$any($event.target).value || 0)" aria-label="Dim light in squares, the whole radius" />
                </label>
              }
            </div>
          }

          @if (aktiv() === 'waende' && darfSchreiben()) {
            <!-- **Sperren** (T-118, docs/Karten.md › Sperren): Linienzug zeichnen, Art
                 wechseln, Tür verschliessen, wegnehmen. Türen öffnet man in der Auswahl. -->
            <div class="unterleiste editor" role="toolbar" aria-label="Walls">
              <label>
                Kind
                <select (change)="wandArtWaehlen($any($event.target).value)" aria-label="Kind of wall to draw or set">
                  @for (k of WALL_KINDS; track k.key) {
                    <option [value]="k.key" [selected]="k.key === wandArt()" [title]="k.does">{{ k.label }}</option>
                  }
                </select>
              </label>
              <!-- **Formen** (T-304): eine Tür ist immer eine Linie über der Öffnung, ihr Viereck kommt aus der Dicke. -->
              @if (!wandIstTuer()) {
                <label>
                  Shape
                  <select (change)="formWaehlen($any($event.target).value)" aria-label="Shape to draw">
                    @for (f of ed.FORMEN; track f.key) {
                      <option [value]="f.key" [selected]="f.key === ed.form()" [title]="f.does">{{ f.label }}</option>
                    }
                  </select>
                </label>
                @if (formDef().closed === 'toggle') {
                  <label title="Finish joins the last point to the first">
                    <input type="checkbox" [checked]="ed.geschlossen()" (change)="ed.setzen('closed', $any($event.target).checked)" />
                    Closed
                  </label>
                }
              } @else {
                <label title="How thick the door is, in a share of a square — the box you click">
                  Thickness
                  <input type="number" class="zahl" min="5" max="100" step="5" [value]="ed.tuerDicke()" (change)="ed.setzen('doorWidth', +$any($event.target).value || 25)" aria-label="Door thickness in percent of a square" />
                  %
                </label>
              }
              <button type="button" [class.an]="werkzeug() === 'wand'" [attr.aria-pressed]="werkzeug() === 'wand'" (click)="waehle('wand')" title="Tap point after point. Enter or tap the last point again to finish; Alt or a long press places a point without snapping.">Draw</button>
              <button type="button" [class.an]="werkzeug() === 'punkte'" [attr.aria-pressed]="werkzeug() === 'punkte'" (click)="waehle('punkte')" title="Drag a corner point; walls meeting there move with it">Points</button>
              <button type="button" [class.an]="werkzeug() === 'wandArt'" [attr.aria-pressed]="werkzeug() === 'wandArt'" (click)="waehle('wandArt')" title="Tap a wall to make it the kind chosen on the left">Set kind</button>
              <button type="button" [class.an]="werkzeug() === 'schloss'" [attr.aria-pressed]="werkzeug() === 'schloss'" (click)="waehle('schloss')" title="Tap a door to lock or unlock it">Lock</button>
              <button type="button" [class.an]="werkzeug() === 'wandWeg'" [attr.aria-pressed]="werkzeug() === 'wandWeg'" (click)="waehle('wandWeg')" title="Tap a wall to remove it">Erase</button>
              <button type="button" [disabled]="!wandRueckgaengig()" (click)="wandZurueck()" title="Undo the last change to the walls on this floor (Ctrl/Cmd+Z)">Undo</button>
              @if (wandPunkte().length) {
                <button type="button" (click)="wandFertig()" [disabled]="wandPunkte().length < 2">Finish ({{ wandPunkte().length }})</button>
                <button type="button" (click)="wandPunkte.set(wandPunkte().slice(0, -1))" title="Take back the last point (Backspace)">Undo point</button>
                <button type="button" (click)="wandPunkte.set([])">Cancel</button>
              }
              <span class="schalter">
                <label title="A door or window drawn over a wall splits the wall at its edges">
                  <input type="checkbox" [checked]="ed.schneiden()" (change)="ed.setzen('cut', $any($event.target).checked)" />
                  Cut walls
                </label>
                <label title="Show the corner points of all walls">
                  <input type="checkbox" [checked]="ed.punkte()" (change)="ed.setzen('points', $any($event.target).checked)" />
                  Show points
                </label>
                <label title="Snap to existing points, grid corners and lines">
                  <input type="checkbox" [checked]="ed.einrasten()" (change)="ed.setzen('snap', $any($event.target).checked)" />
                  Snap
                </label>
                @if (ed.einrasten()) {
                  <label title="How far a point is pulled, in screen pixels">
                    Strength
                    <input type="range" [min]="STAERKE_MIN" [max]="STAERKE_MAX" step="1" [value]="ed.staerke()" (input)="ed.setzen('strength', +$any($event.target).value)" aria-label="Snap strength in pixels" />
                    <span class="wert">{{ ed.staerke() }} px</span>
                  </label>
                }
              </span>
            </div>
          }

          @if (aktiv() === 'gitter' && darfSchreiben()) {
            <!-- **Das Gitter auf der Karte setzen** (T-304): die Vorschau zeigt sofort, gespeichert wird mit „Save“. -->
            <div class="unterleiste editor" role="toolbar" aria-label="Grid">
              <label>
                Shape
                <select (change)="gitterAendern({ gridShape: $any($event.target).value })" aria-label="Grid shape">
                  @for (g of GRID_SHAPES; track g) {
                    <option [value]="g" [selected]="g === einst()?.gridShape">{{ g }}</option>
                  }
                </select>
              </label>
              <!-- **Fein einstellen** (T-314): der Regler reicht ±10 % um den Wert beim Öffnen, die Pfeile
                   gehen in kleinen Schritten (Umschalt: zehnmal so gross). -->
              <span class="feld" role="group" aria-label="Square size">
                Size
                <button type="button" class="pfeil" (click)="gitterSchritt('gridSize', -0.05, $event)" aria-label="Smaller squares" title="Smaller (Shift: ×10)">−</button>
                <input type="range" [min]="groesseSpanne().min" [max]="groesseSpanne().max" step="0.01" [value]="einst()?.gridSize" (input)="gitterAendern({ gridSize: +$any($event.target).value })" aria-label="Square size, fine" />
                <button type="button" class="pfeil" (click)="gitterSchritt('gridSize', 0.05, $event)" aria-label="Larger squares" title="Larger (Shift: ×10)">+</button>
                <input type="number" class="zahl" min="4" step="0.01" [value]="einst()?.gridSize" (change)="gitterGroesseTippen(+$any($event.target).value)" aria-label="Square size in pixels" />
              </span>
              <span class="feld" role="group" aria-label="Grid offset">
                X
                <button type="button" class="pfeil" (click)="gitterSchritt('gridOffsetX', -0.5, $event)" aria-label="Grid left" title="Left (Shift: ×10)">◀</button>
                <input type="number" class="zahl" step="0.5" [value]="einst()?.gridOffsetX" (change)="gitterAendern({ gridOffsetX: +$any($event.target).value })" aria-label="Grid offset X in pixels" />
                <button type="button" class="pfeil" (click)="gitterSchritt('gridOffsetX', 0.5, $event)" aria-label="Grid right" title="Right (Shift: ×10)">▶</button>
                Y
                <button type="button" class="pfeil" (click)="gitterSchritt('gridOffsetY', -0.5, $event)" aria-label="Grid up" title="Up (Shift: ×10)">▲</button>
                <input type="number" class="zahl" step="0.5" [value]="einst()?.gridOffsetY" (change)="gitterAendern({ gridOffsetY: +$any($event.target).value })" aria-label="Grid offset Y in pixels" />
                <button type="button" class="pfeil" (click)="gitterSchritt('gridOffsetY', 0.5, $event)" aria-label="Grid down" title="Down (Shift: ×10)">▼</button>
              </span>
              <!-- **Massstab je Feld** (T-321): Liste oder frei, Zahl und Einheit; auf einer Ebene gilt er für sie. -->
              <label class="feld" title="What one square or hex is in the world — movement, reach, light and measuring use it">
                {{ einst()?.gridShape === 'hex' ? '1 hex' : '1 square' }} =
                <input type="text" class="massstab" list="nw-massstab" [value]="einst()?.scale" (change)="gitterAendern({ scale: $any($event.target).value })" aria-label="Scale per square" />
                <datalist id="nw-massstab">
                  @for (m of SCALE_PRESETS; track m) {
                    <option [value]="m"></option>
                  }
                </datalist>
              </label>
              <button type="button" [class.an]="werkzeug() === 'gitterUrsprung'" [attr.aria-pressed]="werkzeug() === 'gitterUrsprung'" (click)="waehle('gitterUrsprung')" title="Tap a point where two grid lines cross on the image">Set origin</button>
              <button type="button" [class.an]="werkzeug() === 'gitterZelle'" [attr.aria-pressed]="werkzeug() === 'gitterZelle'" (click)="waehle('gitterZelle')" title="Tap two opposite corners of one square on the image">Pick a square</button>
              <!-- **Aussehen** (T-314): Farbe (Farbton und Sättigung in der Farbwahl), Deckkraft, ausblenden. -->
              <span class="schalter">
                <label title="Draw the grid lines; measuring and snapping work either way">
                  <input type="checkbox" [checked]="!einst()?.gridHidden" (change)="gitterAendern({ gridHidden: !$any($event.target).checked })" />
                  Show grid
                </label>
                <label title="Colour of the grid lines">
                  Colour
                  <input type="color" [value]="einst()?.gridColor || '#3c2814'" (input)="gitterAendern({ gridColor: $any($event.target).value })" aria-label="Grid colour" />
                </label>
                <label title="How strongly the grid shows">
                  Opacity
                  <input type="range" min="0" max="1" step="0.05" [value]="einst()?.gridOpacity" (input)="gitterAendern({ gridOpacity: +$any($event.target).value })" aria-label="Grid opacity" />
                </label>
                <label title="A dropped token lands so that its space covers whole (or half) squares">
                  <input type="checkbox" [checked]="einst()?.snapTokens" (change)="gitterAendern({ snapTokens: $any($event.target).checked })" />
                  Tokens snap to the grid
                </label>
              </span>
              @if (gitterEntwurf()) {
                <button type="button" class="haupt" (click)="gitterSpeichern()">Save grid</button>
                <button type="button" (click)="gitterEntwurf.set(null)">Discard</button>
              }
            </div>
          }

          @if (aktiv() === 'zug' && zugplan()) {
            <!-- **Plan turn** (T-325): der Zugplaner aus Play, als Blatt seines Werkzeugs. -->
            <div class="zug-panel" role="region" aria-label="Plan turn">
              <ng-content select="[nwZug]" />
            </div>
          }

          @if (aktiv() === 'notizen' && darfSchreiben()) {
            <div class="unterleiste" role="toolbar" aria-label="Notes">
              <button type="button" [class.an]="werkzeug() === 'notiz'" [attr.aria-pressed]="werkzeug() === 'notiz'" (click)="waehle('notiz')" title="Tap the map where the note goes">
                Add note
              </button>
            </div>
          }
          @if (werkzeug() === 'notiz' && notizBei()) {
            <!-- **Eine Notiz anlegen** (T-214, E-070 a): Text und wer sie sieht; gespeichert als Artikel \`Note\`, auf der Karte ein Marker. -->
            <form class="setzen notiz-blatt" (submit)="$event.preventDefault(); notizAnlegen()">
              <label class="notiz-text">
                Note
                <textarea rows="3" [value]="notizText()" (input)="notizText.set($any($event.target).value)" placeholder="What should be remembered here?" aria-label="Text of the note"></textarea>
              </label>
              <span class="notiz-wer" role="radiogroup" aria-label="Who sees the note">
                <label><input type="radio" name="notiz-wer" [checked]="notizFuer() === 'gm'" (change)="notizFuer.set('gm')" /> GM only</label>
                <label><input type="radio" name="notiz-wer" [checked]="notizFuer() === 'players'" (change)="notizFuer.set('players')" /> Players too</label>
              </span>
              <button type="submit" class="haupt" [disabled]="!notizText().trim() || notizSpeichert()">Save note</button>
              <button type="button" (click)="notizBei.set(null)">Cancel</button>
            </form>
          }
          @if (werkzeug() === 'setzen' && setzenBei()) {
            <div class="setzen">
              <p>{{ setzenArt() === 'scenery' ? 'Which asset goes here? The same one may stand many times.' : 'Which article does the marker stand for?' }}</p>
              <nw-board-suche [ohne]="setzenArt() === 'scenery' ? nurKarte() : schonDa()" [gruppieren]="true" (gewaehlt)="setzen($event)" />
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
              (scroll)="randFolgen()"
              (keydown)="taste($event)"
              (dragover)="ueberBuehne($event)"
              (drop)="fallen($event)"
            >
              <!-- Bis das Kartenbild da ist (T-126): ein Kreis statt einer leeren
                   Fläche. Gemessen ist es, sobald es geladen hat (nat). -->
              @if (!nat() && !bildFehlt()) {
                <nw-ladeanzeige class="laedt" label="Loading map image …" />
              }
              @if (ausgaenge().length) {
                <!-- **Hinaus** (T-327): ein Pfeil zur Karte darüber — Nachbarkarten kommen mit E-121 dazu. -->
                <div class="ausgaenge">
                  @for (a of ausgaenge(); track a.id) {
                    <a
                      class="ausgang"
                      [class]="'ausgang ' + (a.side ?? 'oben')"
                      [routerLink]="weg(a.id).link"
                      [queryParams]="weg(a.id).query"
                      [title]="'Up to ' + a.name"
                      (pointerdown)="$event.stopPropagation()"
                    ><span aria-hidden="true">↑</span> {{ a.name }}</a>
                  }
                </div>
              }
              @if (rand(); as r) {
                <!-- **Die Karte darüber als Rand** (T-327): blass um die Unterkarte, gelegt über den Kasten
                     der Verknüpfung; für Spielende das beschnittene Bild (T-312). Folgt dem Scrollstand. -->
                <div #randFeld class="rand-oben" aria-hidden="true" [style.width.px]="fenster().w" [style.height.px]="fenster().h">
                  <div #randInnen class="rand-innen" [style.width.px]="breite()" [style.height.px]="hoehe()">
                    <img [src]="adresse(r.image)" alt="" draggable="false" [style.left.%]="r.lage.x * 100" [style.top.%]="r.lage.y * 100" [style.width.%]="r.lage.w * 100" [style.height.%]="r.lage.h * 100" />
                  </div>
                </div>
              }
              @if (saum().x) {
                <!-- Der Saum rechts und unten (T-327): ein Punkt, der die Scrollfläche aufspannt. -->
                <div class="saum-ende" aria-hidden="true" [style.left.px]="breite() + 2 * saum().x - 1" [style.top.px]="(hoehe() ?? 0) + 2 * saum().y - 1"></div>
              }
              <div
                #innen
                class="innen"
                [class.gemessen]="hoehe() !== null"
                [style.left.px]="saum().x || null"
                [style.top.px]="saum().y || null"
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
                @if (flaechenAn() && flaechen().length) {
                  <!-- **Zonen und Gebiete** (T-219, REQ-193): aufs Gitter gerastert, über dem Bild und unter den Markern. -->
                  <svg class="flaechen" viewBox="0 0 1 1" preserveAspectRatio="none" role="img" [attr.aria-label]="flaechenText()">
                    @for (f of flaechen(); track f.id) {
                      <path class="flaeche" [class.gebiet]="f.type === 'territory'" [class.versteckt]="f.versteckt" [attr.data-name]="f.name" [attr.d]="f.d" [style.fill]="f.farbe" [style.fill-opacity]="f.deckkraft" [style.stroke]="f.farbe" vector-effect="non-scaling-stroke" />
                    }
                  </svg>
                }
                @for (k of rahmen(); track k.id) {
                  @if (k.raster; as r) {
                    <!-- **Beide Raster** (T-329): das Gitter der ausgerichteten Unterkarte in ihrem Bereich. -->
                    <div
                      class="unterraster"
                      aria-hidden="true"
                      [style.left.%]="k.frame.x * 100"
                      [style.top.%]="k.frame.y * 100"
                      [style.width.%]="k.frame.w * 100"
                      [style.height.%]="k.frame.h * 100"
                      [style.background-image]="r.bild"
                      [style.background-size]="r.groesse"
                      [style.background-position]="r.lage"
                    ></div>
                  }
                  <!-- **Wie eine Verknüpfung steht** (T-327): Klick springt, nur Rahmen, Symbol — „hidden“ steht nicht da. -->
                  @if (k.show === 'icon') {
                    <a
                      class="rahmen-marker"
                      [class.nah]="k.nah"
                      [class.durch]="rahmenDurch()"
                      [routerLink]="absprungGesperrt() ? null : weg(k.id).link"
                      [queryParams]="weg(k.id).query"
                      [style.left.%]="k.mitte.x * 100"
                      [style.top.%]="k.mitte.y * 100"
                      [title]="k.nah ? 'Zoom in once more to enter ' + k.name : 'Enter ' + k.name"
                      [attr.aria-label]="'Enter ' + k.name"
                      (pointerdown)="$event.stopPropagation()"
                    >
                      <span aria-hidden="true">⊡</span>
                    </a>
                  } @else if (k.show === 'frame') {
                    <div
                      class="rahmen nur"
                      [class.form]="!!k.punkte"
                      [class.nah]="k.nah"
                      [style.left.%]="k.frame.x * 100"
                      [style.top.%]="k.frame.y * 100"
                      [style.width.%]="k.frame.w * 100"
                      [style.height.%]="k.frame.h * 100"
                      aria-hidden="true"
                    >
                      @if (k.punkte) {
                        <svg viewBox="0 0 1 1" preserveAspectRatio="none"><polygon [attr.points]="k.punkte" vector-effect="non-scaling-stroke" /></svg>
                      }
                      @if (k.nah) {
                        <span>{{ k.name }} — zoom in to enter</span>
                      }
                    </div>
                  } @else {
                    <a
                      class="rahmen"
                      [class.form]="!!k.punkte"
                      [class.nah]="k.nah"
                      [class.durch]="rahmenDurch()"
                      [routerLink]="absprungGesperrt() ? null : weg(k.id).link"
                      [queryParams]="weg(k.id).query"
                      [style.left.%]="k.frame.x * 100"
                      [style.top.%]="k.frame.y * 100"
                      [style.width.%]="k.frame.w * 100"
                      [style.height.%]="k.frame.h * 100"
                      [class.wegnehmen]="werkzeug() === 'rahmenWeg'"
                      [title]="werkzeug() === 'rahmenWeg' ? 'Unlink ' + k.name : k.nah ? 'Zoom in once more to enter ' + k.name : 'Enter ' + k.name"
                      (pointerdown)="$event.stopPropagation()"
                      (click)="werkzeug() === 'rahmenWeg' && rahmenLoesen($event, k.id, k.name)"
                    >
                      @if (k.punkte) {
                        <svg viewBox="0 0 1 1" preserveAspectRatio="none"><polygon [attr.points]="k.punkte" vector-effect="non-scaling-stroke" /></svg>
                      }
                      <span>{{ k.nah ? k.name + ' — zoom in to enter' : k.name }}</span>
                    </a>
                  }
                }
                @if (vieleckVorschau(); as v) {
                  <!-- Das Vieleck, solange es gezeichnet wird (T-327). -->
                  <svg class="vieleck-vorschau" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
                    <polyline [attr.points]="v" vector-effect="non-scaling-stroke" />
                  </svg>
                }
                @if (werkzeug() === 'vieleck') {
                  @if (ed.punkte()) {
                    @for (p of vieleckFang(); track $index) {
                      <span class="punkt fremd" [style.left.%]="p.x * 100" [style.top.%]="p.y * 100" aria-hidden="true"></span>
                    }
                  }
                  @for (p of vieleckEcken(); track $index) {
                    <span class="punkt" [class.erste]="p.erste" [style.left.%]="p.x * 100" [style.top.%]="p.y * 100" aria-hidden="true"></span>
                  }
                  @if (fang(); as f) {
                    <span class="fang" [class]="'fang an-' + f.to" [style.left.%]="f.pt.x * 100" [style.top.%]="f.pt.y * 100" aria-hidden="true"></span>
                  }
                }
                @if (grau()) {
                  <!-- Dunkelsicht in Graustufen (T-305): nimmt dem Bild darunter die Farbe
                       (mix-blend-mode: saturation), wo nur die Dunkelsicht hinreicht. -->
                  <canvas #grauLeinwand class="nebel grau" aria-hidden="true"></canvas>
                }
                @if (schatten()) {
                  <!-- Licht und Dunkelheit (T-216): unter dem Nebel, Lichter und Dunkelsicht
                       schneiden heraus. -->
                  <canvas #schattenLeinwand class="nebel schatten" aria-hidden="true"></canvas>
                }
                @if (laufendeSicht()) {
                  <!-- Die laufende Sicht (T-216): was die eigene Figur gerade sieht, hell;
                       das einmal Gesehene gedämpft. Der Nebel darüber deckt den Rest. -->
                  <canvas #sichtLeinwand class="nebel sicht" aria-hidden="true"></canvas>
                }
                @if (nebel()) {
                  <!-- Eine Leinwand und keine SVG-Maske: \`url(#…)\` löst nicht jeder
                       Browser unter \`<base href>\` auf (T-204, nebel.ts). -->
                  <canvas #nebelLeinwand class="nebel" aria-hidden="true"></canvas>
                } @else if (nebelOhneMass()) {
                  <div class="nebel ganz" aria-hidden="true"></div>
                }
                @if (sperrenBild(); as sb) {
                  <!-- Die Sperren (T-118): nur die Leitung sieht die Linien; für alle
                       anderen sind sie der Grund, warum es dahinter dunkel ist. -->
                  <svg class="sperren" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
                    @for (w of sb.linien; track w.id) {
                      <line [attr.class]="'sperre k-' + w.kind + (w.offen ? ' offen' : '')" [attr.x1]="w.x1" [attr.y1]="w.y1" [attr.x2]="w.x2" [attr.y2]="w.y2" vector-effect="non-scaling-stroke">
                        <title>{{ w.titel }}</title>
                      </line>
                    }
                    @if (sb.entwurf; as en) {
                      @if (en.zu) {
                        <polygon [attr.class]="'sperre entwurf k-' + wandArt()" [attr.points]="en.pts" vector-effect="non-scaling-stroke" />
                      } @else {
                        <polyline [attr.class]="'sperre entwurf k-' + wandArt()" [attr.points]="en.pts" vector-effect="non-scaling-stroke" />
                      }
                    }
                  </svg>
                  @for (p of sb.punkte; track $index) {
                    <span class="punkt" [class.greifbar]="werkzeug() === 'punkte'" [style.left.%]="p.x * 100" [style.top.%]="p.y * 100" aria-hidden="true"></span>
                  }
                  @if (fang(); as f) {
                    <span class="fang" [class]="'fang an-' + f.to" [style.left.%]="f.pt.x * 100" [style.top.%]="f.pt.y * 100" aria-hidden="true"></span>
                  }
                }
                @if (zelleA(); as z) {
                  <span class="fang an-grid" [style.left.%]="z.x * 100" [style.top.%]="z.y * 100" aria-hidden="true"></span>
                }
                @for (t of tueren(); track t.id) {
                  <button
                    type="button"
                    class="tuer"
                    [class.offen]="t.state === 'open'"
                    [class.zu]="t.state === 'locked'"
                    [class.geheim]="t.kind === 'secret'"
                    [class.still]="!t.klickbar"
                    [style.left.%]="t.x * 100"
                    [style.top.%]="t.y * 100"
                    [style.width.px]="t.lang"
                    [style.height.px]="t.dick"
                    [style.transform]="'translate(-50%, -50%) rotate(' + t.winkel + 'deg)'"
                    [title]="t.titel"
                    [attr.aria-label]="t.titel"
                    (pointerdown)="$event.stopPropagation()"
                    (click)="tuerKlick(t)"
                  ></button>
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
                      <rect class="reich" [style.fill]="c.zaeh ? ZAEH : null" [attr.x]="c.x" [attr.y]="c.y" [attr.width]="c.w" [attr.height]="c.h" />
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
                <!-- **Von der Karte darin** (T-328): gelesen, nicht gespeichert — bei vielen ein Bündel mit Zahl, das hineinführt. -->
                @for (g of gehoben(); track g.map) {
                  @if (g.bundled) {
                    <a
                      class="marker gehoben buendel"
                      [routerLink]="weg(g.map).link"
                      [queryParams]="weg(g.map).query"
                      [style.left.%]="g.centre.x * 100"
                      [style.top.%]="g.centre.y * 100"
                      [style.width.px]="MARKER_MIN + 4"
                      [style.height.px]="MARKER_MIN + 4"
                      [title]="g.items.length + ' markers on ' + g.name + ' — enter it to see them'"
                      [attr.aria-label]="g.items.length + ' markers on ' + g.name"
                      (pointerdown)="$event.stopPropagation()"
                    >
                      <span>{{ g.items.length }}</span>
                    </a>
                  } @else {
                    @for (m of g.items; track m.rel) {
                      <button
                        type="button"
                        class="marker gehoben abgeleitet"
                        [class]="'k-' + m.kind"
                        [style.left.%]="m.x * 100"
                        [style.top.%]="m.y * 100"
                        [style.width.px]="MARKER_MIN"
                        [style.height.px]="MARKER_MIN"
                        [title]="m.name + ' — on ' + g.name"
                        [attr.aria-label]="m.name + ', on ' + g.name"
                        (pointerdown)="$event.stopPropagation()"
                        (click)="kurzansicht($event, m.to)"
                      >
                        @if (m.bild) {
                          <img [src]="m.bild" alt="" draggable="false" />
                        } @else {
                          <span>{{ kuerzel(m.name) }}</span>
                        }
                      </button>
                    }
                  }
                }
                <!-- **Zum Platzieren** (T-328): die vorgeschlagene Lage, gestrichelt; nur die Leitung bekommt sie. -->
                @for (v of zuPlatzieren(); track v.rel) {
                  <span
                    class="geist platz-geist"
                    [class.gewaehlt]="platzWahl() === v.rel"
                    [style.left.%]="v.x * 100"
                    [style.top.%]="v.y * 100"
                    [style.width.px]="MARKER_MIN"
                    [style.height.px]="MARKER_MIN"
                    [title]="v.name + ' — to place (from ' + v.fromName + ')'"
                  ></span>
                }
                @if (uebergangFlaechen().length) {
                  <!-- **Die Fläche eines Übergangs** (T-326): wer darin steht, steht am Übergang. -->
                  <svg class="uebergang-flaechen" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
                    @for (f of uebergangFlaechen(); track f.key) {
                      <polygon [attr.class]="'k-' + f.kind + (f.offen ? ' offen' : '')" [attr.points]="f.pts" vector-effect="non-scaling-stroke" />
                    }
                  </svg>
                }
                @for (u of uebergaenge(); track u.key) {
                  <!-- **Übergänge** (T-307): Treppe, Leiter, Brücke, Portal — ein Antippen zeigt Ziel und „Go through“. -->
                  <button
                    type="button"
                    class="uebergang"
                    [class]="'uebergang k-' + u.kind"
                    [class.gespiegelt]="u.mirrored"
                    [class.offen]="uebergangWahl() === u.key"
                    [style.left.%]="u.at.x * 100"
                    [style.top.%]="u.at.y * 100"
                    [title]="u.titel"
                    [attr.aria-label]="u.titel"
                    (pointerdown)="$event.stopPropagation()"
                    (click)="uebergangKlick($event, u.key)"
                  >
                    <span aria-hidden="true">{{ UEBERGANG_SYM[u.kind] }}</span>
                  </button>
                }
                @if (uebergangOffen(); as u) {
                  <div class="uebergang-karte" role="dialog" [attr.aria-label]="u.titel" [style.left.%]="u.at.x * 100" [style.top.%]="u.at.y * 100" (pointerdown)="$event.stopPropagation()">
                    <b>{{ u.titel }}</b>
                    @if (u.anderswo) {
                      <a [routerLink]="weg(u.toMap).link" [queryParams]="weg(u.toMap).query">Open {{ u.ziel }}</a>
                    } @else {
                      <button type="button" class="klein" (click)="ebeneZeigen(u.toFloor)">Show {{ u.ziel }}</button>
                    }
                    @for (m of aufUebergang(); track m.rel.id) {
                      <button type="button" class="klein" [disabled]="speichert()" (click)="durchgehen(m.rel.id, u)">{{ alsLeitung() ? 'Take ' + m.name + ' through' : 'Go through with ' + m.name }}</button>
                    } @empty {
                      <small>Drop a token on it to go through.</small>
                    }
                    @if (alsLeitung() && aufUebergang().length > 1) {
                      <button type="button" class="klein" [disabled]="speichert()" (click)="alleDurch(u)">Send all {{ aufUebergang().length }} through</button>
                    }
                    <small class="kosten">{{ u.regelText }}</small>
                    @if (ebenenLeitung()) {
                      <label>
                        <select (change)="uebergangSetzen(u.relId, { passage: $any($event.target).value })" aria-label="Kind of passage">
                          @for (k of PASSAGE_KINDS; track k) {
                            <option [value]="k" [selected]="k === u.kind">{{ k }}</option>
                          }
                        </select>
                      </label>
                      <label title="See through it like stairs, or only walk through">
                        <input type="checkbox" [checked]="u.sight === 'through'" (change)="uebergangSetzen(u.relId, { sight: $any($event.target).checked ? null : 'none' })" />
                        View through
                      </label>
                      <label title="Only from where it was placed to where it leads — no way back">
                        <input type="checkbox" [checked]="u.oneWay" (change)="uebergangSetzen(u.relId, { oneWay: $any($event.target).checked })" />
                        One way
                      </label>
                      <span class="flaeche">
                        <button type="button" class="klein" (click)="flaecheBeginnen(u)" title="Tap two corners: the area of this end">{{ u.hatFlaeche ? 'Redraw area' : 'Draw area' }}</button>
                        <button type="button" class="klein" (click)="vieleckBeginnen({ art: 'uebergang', relId: u.relId, seite: u.mirrored ? 'toArea' : 'area' })" title="Tap the corners of a free shape: the area of this end">Draw shape</button>
                        @if (u.hatFlaeche) {
                          <button type="button" class="klein" (click)="flaecheWeg(u)">One square</button>
                        }
                      </span>
                      <details class="regeln">
                        <summary>Who, when, cost</summary>
                        @for (r of REGEL_FELDER; track r.key) {
                          <label>
                            {{ r.label }}
                            <select (change)="regelSetzen(u.relId, r.key, $any($event.target).value)" [attr.aria-label]="r.label">
                              <option value="" [selected]="!u.rules[r.key]">Campaign ({{ $any(kampagnenRegeln())[r.key] }})</option>
                              @for (v of r.werte; track v) {
                                <option [value]="v" [selected]="u.rules[r.key] === v">{{ v }}</option>
                              }
                            </select>
                          </label>
                        }
                      </details>
                      <button type="button" class="klein" (click)="uebergangWeg(u.relId)">Remove</button>
                    }
                    <button type="button" class="klein" (click)="uebergangWahl.set(null)" aria-label="Close">×</button>
                  </div>
                }
                @if (lichtKreise().length) {
                  <!-- Wie weit ein Licht reicht (T-320), nur für die Leitung in „Light“. -->
                  <div class="lichtkreise" aria-hidden="true">
                    @for (l of lichtKreise(); track l.id) {
                      <span class="lichtkreis matt" [style.left.%]="l.x * 100" [style.top.%]="l.y * 100" [style.width.%]="l.dw * 100" [style.height.%]="l.dh * 100"></span>
                      <span class="lichtkreis" [style.left.%]="l.x * 100" [style.top.%]="l.y * 100" [style.width.%]="l.hw * 100" [style.height.%]="l.hh * 100"></span>
                    }
                  </div>
                }
                @for (g of groessenVorschau(); track g.id) {
                  <!-- Die gewählte Grösse am Token (T-320), bevor man es antippt. -->
                  <span class="groessen-vorschau" [style.left.%]="g.x * 100" [style.top.%]="g.y * 100" [style.width.px]="g.px" [style.height.px]="g.px" aria-hidden="true"></span>
                  <!-- Woher die Grösse kommt (T-390): Statblock, Wirkung oder am Token gesetzt. -->
                  <span class="groessen-herkunft" [style.left.%]="g.x * 100" [style.top.%]="g.y * 100" [style.margin-top.px]="g.px / 2 + 2" data-testid="token-size-from">{{ g.text }}</span>
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
                    [class.rund]="m.rund"
                    [class.beringt]="!!m.ring"
                    [class.leuchtet]="m.leuchtet"
                    [class.gewaehlt]="werkzeug() === 'asset' && assetWahl() === m.rel.id"
                    [class.mit-schild]="m.ansicht === 'name'"
                    [class.mit-karte]="m.ansicht === 'card'"
                    [style.left.%]="m.x * 100"
                    [style.top.%]="m.y * 100"
                    [style.width.px]="m.px"
                    [style.height.px]="m.kind === 'scenery' ? m.px * m.ratio : m.px"
                    [style.transform]="m.rot ? 'translate(-50%, -50%) rotate(' + m.rot + 'deg)' : null"
                    [style.--ring-w]="m.ring?.['--ring-w'] ?? null"
                    [style.--ring-bg]="m.ring?.['--ring-bg'] ?? null"
                    [title]="m.groesse ? m.titel + ' — ' + m.groesse : m.titel"
                    [attr.aria-label]="m.titel"
                    (pointerdown)="greifen($event, m)"
                    (click)="werkzeug() === 'licht' ? lichtGeben(m.rel.id) : werkzeug() === 'lichtSchalter' ? lichtSchalten(m.rel.id) : werkzeug() === 'tokenWeg' ? tokenWeg(m.rel.id) : werkzeug() === 'tokenGroesse' ? groesseGeben(m.rel.id) : werkzeug() === 'asset' ? assetWaehlen(m) : kurzansicht($event, m.to, m.rel.id)"
                  >
                    @if (m.kind === 'light') {
                      <span aria-hidden="true">☀</span>
                    } @else if (m.bild) {
                      <img [src]="m.bild" alt="" draggable="false" [style]="m.bildStil" />
                    } @else {
                      <span>{{ kuerzel(m.name) }}</span>
                    }
                    @if (m.etikett) {
                      <b class="etikett">{{ m.etikett }}</b>
                    } @else if (m.ansicht === 'name') {
                      <!-- **Markeransicht „Name“** (T-214): das Symbol, darunter der Name. -->
                      <b class="schild">{{ m.name }}</b>
                    }
                    @if (m.ansicht === 'card') {
                      <!-- **Markeransicht „Quick card“** (T-214): die Kurzansicht (\`quick\`) als Karte unter dem Punkt —
                           nur zum Lesen; antippen öffnet sie wie bei jedem Marker. -->
                      <span class="mk-karte" inert>
                        @defer (on viewport) {
                          <nw-vorschau [id]="m.to" [rueck]="false" />
                        } @placeholder {
                          <span class="mk-laedt">{{ m.name }}</span>
                        }
                      </span>
                    }
                  </button>
                }
                @if (markerWahlBild(); as w) {
                  <!-- **Ein gewähltes Token** (T-320): wegnehmen hier oder mit Entf, ohne erst das Werkzeug zu suchen. -->
                  <div class="token-aktionen" role="group" [attr.aria-label]="w.name" [style.left.%]="w.x * 100" [style.top.%]="w.y * 100" (pointerdown)="$event.stopPropagation()">
                    @if (w.kind !== 'light' && w.kind !== 'scenery') {
                      <!-- **Wie dieser Marker steht** (T-214, \`props.view\`): vor Karte, Kartenart und Art. -->
                      <select class="klein" (change)="markerAnsichtSetzen(w.rel.id, $any($event.target).value)" aria-label="This marker shows as" title="How this marker stands on the map">
                        <option value="" [selected]="!w.view">as the map ({{ ansichtLabel(w.geerbt) }})</option>
                        @for (v of MARKER_VIEWS; track v.key) {
                          <option [value]="v.key" [selected]="w.view === v.key">{{ v.label }}</option>
                        }
                      </select>
                    }
                    @if (groessenWahl(w.to); as gw) {
                      <!-- **Überlappende Grössen-Zustände** (T-428, E-164): die Leitung wählt, welcher gilt. -->
                      <select class="klein" (change)="groessenQuelleSetzen(w.rel.id, $any($event.target).value)" aria-label="Size effect that applies" title="Several size effects overlap — choose which one sets the token's size">
                        <option value="" [selected]="!gw.chosen">latest ({{ gw.options[gw.options.length - 1]?.name }})</option>
                        @for (o of gw.options; track o.id) {
                          <option [value]="o.id" [selected]="gw.chosen === o.id">{{ o.name }}</option>
                        }
                      </select>
                    }
                    <button type="button" class="klein" (click)="tokenWeg(w.rel.id)" title="Take this token off the map (Delete)">Remove</button>
                    <button type="button" class="klein" (click)="markerWahl.set(null)" aria-label="Close">×</button>
                  </div>
                }
                @if (lupeBild(); as l) {
                  <!-- **Die Lupe** (T-315): über dem Finger, vergrössert, mit Fadenkreuz in der Mitte. -->
                  <div class="lupe" [class.unten]="l.unten" [style.left.%]="l.x * 100" [style.top.%]="l.y * 100" [style.width.px]="l.d" [style.height.px]="l.d" [style]="l.stil" aria-hidden="true">
                    @if (sperrenBild(); as sb) {
                      <svg [attr.viewBox]="l.viewBox" preserveAspectRatio="none">
                        @for (w of sb.linien; track w.id) {
                          <line [attr.class]="'sperre k-' + w.kind" [attr.x1]="w.x1" [attr.y1]="w.y1" [attr.x2]="w.x2" [attr.y2]="w.y2" vector-effect="non-scaling-stroke" />
                        }
                        @if (sb.entwurf; as en) {
                          <polyline [attr.class]="'sperre entwurf k-' + wandArt()" [attr.points]="en.pts" vector-effect="non-scaling-stroke" />
                        }
                        @if (l.ring; as r) {
                          <ellipse class="lupe-ring" [attr.cx]="r.cx" [attr.cy]="r.cy" [attr.rx]="r.rx" [attr.ry]="r.ry" vector-effect="non-scaling-stroke" />
                        }
                      </svg>
                    }
                  </div>
                }
              </div>
            </div>
          }
        </div>
        @if (initiative() && initiativeOffen()) {
          <!-- Der Initiative-Tracker als Panel (T-325); gezeichnet von Play, hier nur sein Platz. -->
          <div class="seitenpanel initiative-panel">
            <ng-content select="[nwInitiative]" />
          </div>
        }
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
            (vorbereiten)="blockSetzen($event.ids, $event.encounter)"
          />
        }
      </div>

      @if (zuPlatzieren().length) {
        <!-- **To place** (T-328): Marker der Karte darüber im Bereich dieser Karte — erst bestätigt stehen sie hier. -->
        <section class="zu-platzieren" aria-label="To place">
          <h4>To place <span class="zahl">{{ zuPlatzieren().length }}</span></h4>
          <ul>
            @for (v of zuPlatzieren(); track v.rel) {
              <li [class.gewaehlt]="platzWahl() === v.rel">
                <span class="name">{{ v.name }}</span>
                <span class="hint">from {{ v.fromName }}</span>
                <span class="knoepfe">
                  <button type="button" class="klein" [disabled]="speichert()" (click)="platzBestaetigen(v, v)" [title]="'Place ' + v.name + ' here at the suggested spot; it leaves ' + v.fromName + ' and shows there from this map'">Confirm</button>
                  <button type="button" class="klein" [class.an]="platzWahl() === v.rel" [attr.aria-pressed]="platzWahl() === v.rel" [disabled]="speichert()" (click)="platzWaehlen(v.rel)" title="Tap the map where it goes instead">Move…</button>
                  <button type="button" class="klein" [disabled]="speichert()" (click)="platzBehalten(v)" [title]="'It belongs on ' + v.fromName + '; no map inside suggests it again'">Keep on {{ v.fromName }}</button>
                </span>
              </li>
            }
          </ul>
          @if (platzFehler(); as f) {
            <p class="fehler" role="alert">{{ f }}</p>
          }
        </section>
      }

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
          <!-- **Weg über Karten** (T-329): Stücke sammeln, auch nach einem Sprung in eine andere Karte. -->
          @if (messung()?.m?.distance != null) {
            <button type="button" class="klein" (click)="wegStueck()" title="Add this distance to a route — it stays when you go to another map">Add to route</button>
          }
          @if (wegSumme(); as w) {
            <span class="weg"> · Route: {{ w }}</span>
            <button type="button" class="klein" (click)="weg2.set([])" aria-label="Clear the route">×</button>
          }
        } @else if (werkzeug() === 'platzieren') {
          Tap the map where {{ platzName() }} goes.
          <button type="button" class="klein" (click)="waehle('keins')">Cancel</button>
        } @else if (werkzeug() === 'notiz') {
          {{ notizBei() ? 'Write the note below.' : 'Tap the map where the note goes.' }}
        } @else if (werkzeug() === 'setzen') {
          {{ setzenZiel() ? 'Tap the map where ' + setzenName() + ' goes.' : setzenBei() ? 'Pick the article below.' : setzenArt() === 'scenery' ? 'Tap the map where the asset goes.' : 'Tap the map where the marker goes.' }}
        } @else if (werkzeug() === 'aufdecken') {
          Drag a rectangle to reveal it to the players.
        } @else if (werkzeug() === 'pinsel') {
          Paint over what the players may see.
        } @else if (werkzeug() === 'zudecken') {
          Drag a rectangle — what lies in it is covered again.
        } @else if (werkzeug() === 'wand') {
          {{ wandText() }}
        } @else if (werkzeug() === 'punkte') {
          Drag a corner point to move it; walls meeting there move with it. Alt or a long press: no snapping.
        } @else if (werkzeug() === 'gitterUrsprung') {
          Tap a point where two grid lines cross on the image.
        } @else if (werkzeug() === 'gitterZelle') {
          {{ zelleA() ? 'Now tap the opposite corner of the same square.' : 'Tap one corner of a square on the image.' }}
        } @else if (werkzeug() === 'wandArt') {
          Tap a wall to make it a {{ wandArtName() }}.
        } @else if (werkzeug() === 'uebergang') {
          {{ !uebergangA() ? 'Tap where the passage is.' : !uebergangZiel() ? 'Choose where it leads.' : uebergangZiel() === '__karte' ? 'Pick the map the portal leads to.' : 'Tap where it leads on ' + ebeneName(uebergangZiel()) + '.' }}
        } @else if (werkzeug() === 'vieleck') {
          {{ vieleckPunkte().length < 3 ? 'Tap the corners of the area, one after another. Alt sets a point without snapping.' : 'Tap more corners, or the first one again (or Enter) to finish.' }}
          @if (vieleckPunkte().length >= 3) {
            <button type="button" class="klein" (click)="vieleckFertig()">Done</button>
          }
          @if (vieleckPunkte().length) {
            <button type="button" class="klein" (click)="vieleckZurueck()" title="Take back the last corner (Backspace)">Undo point</button>
          }
          <button type="button" class="klein" (click)="waehle('keins')">Cancel</button>
          <label class="klein" title="Show the corners of the other shapes on this map">
            <input type="checkbox" [checked]="ed.punkte()" (change)="ed.setzen('points', $any($event.target).checked)" /> Show points
          </label>
          <label class="klein" title="Snap to corners of other shapes, walls and grid corners">
            <input type="checkbox" [checked]="ed.einrasten()" (change)="ed.setzen('snap', $any($event.target).checked)" /> Snap
          </label>
        } @else if (werkzeug() === 'uebergangFlaeche') {
          {{ flaecheA() ? 'Now tap the opposite corner of the area.' : 'Tap one corner of the area the passage covers.' }}
        } @else if (werkzeug() === 'schloss') {
          Tap a door to lock or unlock it.
        } @else if (werkzeug() === 'wandWeg') {
          Tap a wall to remove it.
        } @else if (werkzeug() === 'tokenGroesse') {
          Token size — tap a token: it covers {{ groesseWahl() === null ? 'the squares its statblock size needs' : groesseWahl() + ' × ' + groesseWahl() + ' squares' }}.
        } @else if (werkzeug() === 'asset') {
          {{ gewaehltesAsset() ? 'Set the asset above; tap another to switch.' : 'Tap an asset to set it up. Drag one to move it.' }}
        } @else if (werkzeug() === 'rahmen') {
          Link map — drag a frame over the part of this map, then pick the map you zoom into there.
        } @else if (werkzeug() === 'rahmenWeg') {
          Unlink — tap a frame; its map stays, it is just no longer inside this one.
        } @else if (werkzeug() === 'tokenWeg') {
          Tap a marker to take it off the map. The article stays; the party token is not a marker. Or tap a token in Select and press Delete.
        } @else if (werkzeug() === 'licht') {
          Tap the map to place a light, or a token, asset or marker to make it shine: {{ lichtHell() }} squares of bright and {{ lichtMatt() }} of dim light.
        } @else if (werkzeug() === 'lichtSchalter') {
          Tap a light to switch it off or on. A torch in a figure's hand lights its token; an item placed as a marker lights itself.
        } @else {
          @if (spielersicht()) {
            Viewing as {{ nebelFuerName() || 'all players' }} ·
          }
          @if (zugText(); as z) {
            {{ z }} ·
          }
          @if (nebelAn()) {
            Fog of war ·
          }
          @if (massstabText(); as sc) {
            {{ sc }}
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
          } @else if (ziehbarHier().length && !imKampf()) {
            · {{ regeln().moves === 'confirm' ? 'drag a token to propose a move to the GM' : 'drag a token to move it' }}
          }
        }
      </p>
    </div>
  `,
  styleUrls: ['./karte.scss', './sperren.scss', './editor.scss', './spiel.scss', './ebenen.scss', './werkzeuge.scss', './verknuepfung.scss', './markeransicht.scss', './notizen.scss', './flaechen.scss'],
})
export class Karte {
  readonly id = input.required<string>();
  /** Wohin ein Schritt hinein oder hinaus führt: zur Artikelseite der Karte oder in Play. */
  readonly ort = input<'artikel' | 'play'>('artikel');
  /** Die Sitzung am Tisch (Play) — ihre Begegnungen stehen in der Seitenleiste (T-203). */
  readonly sitzung = input<string | null>(null);
  /** Unter Play füllt die Karte den Schirm. */
  readonly gross = input(false);
  /** Der Zugplan (T-198): solange sein Werkzeug gewählt ist, wählt ein Antippen Weg oder Ziel. */
  readonly planung = input<Planung | null>(null);
  /** Hat der Zugplaner diesem Betrachter etwas (T-325)? Dann steht „Plan turn“ in der Leiste. Gesiebt hat der Server. */
  readonly zugplan = input(false);
  /** Wie viele Züge auf die Leitung warten — die Zahl am Werkzeug. */
  readonly zugZahl = input(0);
  /** Läuft eine Begegnung, deren Tracker Play als Panel hineinreicht (T-325)? */
  readonly initiative = input(false);
  readonly planTipp = output<PlanTipp>();
  /** Die Gelegenheitsangriffe der geplanten Wege (ohne Vorschau) — für die Zugfolge (T-198, Runde 2). */
  readonly planWarnungen = output<{ step: string; reactorName: string }[]>();
  /** Die Leitung hat diese Karte ins Spiel genommen (T-289): die Id der Instanz. */
  readonly insSpiel = output<string>();
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
  private readonly schattenLeinwand = viewChild<ElementRef<HTMLCanvasElement>>('schattenLeinwand');
  private readonly grauLeinwand = viewChild<ElementRef<HTMLCanvasElement>>('grauLeinwand');
  private readonly sichtLeinwand = viewChild<ElementRef<HTMLCanvasElement>>('sichtLeinwand');

  constructor() {
    /* „Played" an der Vorlage (T-289): neu, wenn die Karte wechselt oder ein Stand dazukommt. */
    effect(() => {
      const id = this.id();
      const vorlage = this.ort() === 'artikel' && !!this.karte() && !this.istInstanz();
      untracked(() => {
        if (vorlage) void this.gespieltHolen(id);
        else this.gespieltListe.set([]);
      });
    });
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
        this.ebeneWahl.set(GROUND_FLOOR);
        this.uebergangWahl.set(null);
        void this.bestand.oeffnen(id, false, false);
      });
    });
    /* **Eine andere Ebene, ein anderes Bild** (T-307): gemessen wird neu —
       aber nur, wenn sich das Bild ändert; dasselbe Bild lädt nicht noch
       einmal, und die Karte bliebe ungemessen. */
    let bildVorher: string | null = null;
    effect(() => {
      const b = this.grundbild();
      untracked(() => {
        if (bildVorher !== null && b !== bildVorher) {
          this.nat.set(null);
          this.bildFehlt.set(false);
          this.messA.set(null);
          this.messB.set(null);
        }
        bildVorher = b;
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
    /* Licht und laufende Sicht (T-216): dieselbe Leinwand-Rechnung, je eine Schicht. */
    const schicht = (c: HTMLCanvasElement | undefined, sch: { ar: number; farbe: string; deckt: number; schnitte: Schnitt[] } | null) => {
      const ctx = sch && c ? c.getContext('2d') : null;
      if (!sch || !c || !ctx) return;
      const b = nebelBreite(this.nat()?.w ?? 0);
      const h = Math.max(1, Math.round(b * sch.ar));
      if (c.width !== b) c.width = b;
      if (c.height !== h) c.height = h;
      schichtMalen(ctx, b, h, sch.farbe, sch.deckt, sch.schnitte);
    };
    effect(() => schicht(this.schattenLeinwand()?.nativeElement, this.schatten()));
    effect(() => {
      const g = this.grau();
      const c = this.grauLeinwand()?.nativeElement;
      const ctx = g && c ? c.getContext('2d') : null;
      if (!g || !c || !ctx) return;
      const b = nebelBreite(this.nat()?.w ?? 0);
      const h = Math.max(1, Math.round(b * g.ar));
      if (c.width !== b) c.width = b;
      if (c.height !== h) c.height = h;
      grauMalen(ctx, b, h, g.sicht, g.lichter);
    });
    effect(() => schicht(this.sichtLeinwand()?.nativeElement, this.laufendeSicht()));
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
        ev.type === 'Map' || ev.type === 'Encounter' || ev.type === 'Campaign' || ev.id === k?.campaign || (!!k?.session && ev.id === k.session) || ev.id === k?.turn?.encounter || ev.id === k?.party?.id || !!k?.targets[ev.id] || !!k?.children.some((c) => c.id === ev.id);
      if (betrifft && ev.id !== this.id()) void this.kontextHolen(this.id());
    });
    /* Ein Zugvorschlag kommt, wird bestätigt oder verworfen (T-204). */
    const abPlan = inject(Live).onPlan((karte) => {
      if (karte === this.id()) void this.kontextHolen(karte);
    });
    /* Etwas verpasst (`reset`, T-399): die Karte selbst holt der Bestand, den Kontext diese Seite. */
    const abNeu = inject(Live).onNeu((was) => {
      if (was === 'reset') void this.kontextHolen(this.id());
    });
    /* Das Vollbild verlässt man auch mit Esc des Browsers — gefragt wird darum das Dokument. */
    const vollbildWechsel = () => this.echtesVollbild.set(!!document.fullscreenElement?.contains(this.host.nativeElement));
    document.addEventListener('fullscreenchange', vollbildWechsel);
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('fullscreenchange', vollbildWechsel);
      ab();
      abPlan();
      abNeu();
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
  /** Die ganze Karte, mit allen Ebenen (T-307). */
  private readonly ganz = computed(() => this.entwurf() ?? this.gespeichert());
  /**
   * **Die Ebene, die gezeigt wird** (T-307, E-108). Gerechnet und
   * gezeichnet wird je Ebene: `karte` ist ihre Projektion (`floorView`) —
   * Bild, Gitter, Sperren, Nebel und Marker dieser Ebene —, und `schreiben`
   * schreibt sie in die ganze Karte zurück (`withFloorView`).
   */
  protected readonly ebeneWahl = signal<string>(GROUND_FLOOR);
  protected readonly ebene = computed(() => {
    const w = this.ebeneWahl();
    return this.ebenen().some((f) => f.id === w) ? w : GROUND_FLOOR;
  });
  protected readonly karte = computed(() => {
    const e = this.ganz();
    return e ? floorView(e, this.ebene()) : undefined;
  });
  /** Eine geänderte Ebene in die ganze Karte. */
  private voll(e: Entity): Entity {
    const g = this.ganz();
    return g ? withFloorView(g, this.ebene(), e) : e;
  }
  /**
   * **Was gezeichnet wird.** Für Spielende hat der Server schon
   * zurückgehalten (`redactMap`); die Leitung sieht mit „Player view"
   * dasselbe, gerechnet mit derselben Funktion — als Vorschau, nicht als
   * Schranke: was sie hier hat, durfte sie ohnehin.
   */
  private readonly angezeigtGanz = computed(() => {
    const e = this.ganz();
    if (!e || !this.spielersicht()) return e;
    /* Nebel je Figur (T-204): die Sicht der gewählten Figur, ohne Wahl nur
       das für alle Aufgedeckte. */
    const fuer = this.nebelFuer();
    return redactMap(e, { gm: false, sees: () => true, fog: this.regeln().fog, own: (id) => id === fuer });
  });
  protected readonly angezeigt = computed(() => {
    const e = this.angezeigtGanz();
    return e ? floorView(e, this.ebene()) : e;
  });

  // ---------------------------------------------------------------- Ebenen

  /** Die Ebenen, die dieser Betrachter hat — in der Spielersicht ohne die der Leitung. */
  protected readonly ebenen = computed(() => {
    const e = this.angezeigtGanz();
    return e ? mapFloors(e) : [];
  });
  /** Die Leiste: nach Gebäudeteil, darin nach Höhe (E-108). */
  protected readonly ebenenGruppen = computed(() => floorGroups(this.ebenen()));
  protected readonly ebeneJetzt = computed(() => this.ebenen().find((f) => f.id === this.ebene()) ?? null);
  protected readonly elevationLabel = elevationLabel;
  protected ebeneName(id: string): string {
    const f = this.ebenen().find((x) => x.id === id);
    return f ? f.name + (f.structure ? ' (' + f.structure + ')' : '') : 'a floor not shown';
  }
  /** Ebenen bearbeiten: wer die Karte schreibt, nicht in der Spielersicht. */
  protected readonly ebenenLeitung = computed(() => this.darfSchreiben() && !this.spielersicht());

  protected ebeneZeigen(id: string): void {
    this.ebeneWahl.set(id);
    this.uebergangWahl.set(null);
  }
  protected ebeneDazu(): void {
    const g = this.ganz();
    if (!g) return;
    const name = prompt('Name of the new floor', `Floor ${this.ebenen().length + 1}`);
    if (!name?.trim()) return;
    const id = `floor-${crypto.randomUUID().slice(0, 8)}`;
    const jetzt = this.ebeneJetzt();
    void this.schreibenGanz(addFloor(g, id, { name, structure: jetzt?.structure ?? '' })).then(() => this.ebeneWahl.set(id));
  }
  /** Was die Ebene über sich sagt; `null` nimmt es weg. */
  protected ebeneAendern(patch: Record<string, unknown>): void {
    const g = this.ganz();
    if (g) void this.schreibenGanz(updateFloor(g, this.ebene(), patch));
  }
  protected hoeheAendern(von: string, bis: string): void {
    const a = von.trim() === '' ? null : Number(von.replace(',', '.'));
    const b = bis.trim() === '' ? null : Number(bis.replace(',', '.'));
    const ok = (v: number | null) => v === null || Number.isFinite(v);
    if (!ok(a) || !ok(b)) return;
    this.ebeneAendern({ elevation: a === null && b === null ? null : { from: a ?? b, to: b ?? a } });
  }
  protected ebeneFreigeben(an: boolean): void {
    const g = this.ganz();
    if (g) void this.schreibenGanz(setFloorReleased(g, this.ebene(), an));
  }
  protected ebeneWeg(): void {
    const g = this.ganz();
    const f = this.ebeneJetzt();
    if (!g || !f || f.ground) return;
    if (!confirm(`Remove the floor "${f.name}" with its markers, walls and the passages leading to it?`)) return;
    void this.schreibenGanz(removeFloor(g, f.id)).then(() => this.ebeneWahl.set(GROUND_FLOOR));
  }

  // ------------------------------------------------------------- Übergänge

  protected readonly PASSAGE_KINDS = PASSAGE_KINDS;
  protected readonly UEBERGANG_SYM: Record<PassageKind, string> = { stairs: '⇅', ladder: '☷', bridge: '═', portal: '◎' };
  /** Die Enden auf dieser Ebene, auch die gespiegelten der Übergänge in beide Richtungen. */
  protected readonly uebergaenge = computed(() => {
    const e = this.angezeigtGanz();
    if (!e) return [];
    const namen = this.kontext()?.targets ?? {};
    return passageEnds(e, this.ebene()).map((p) => {
      const anderswo = p.toMap !== e.id;
      const ziel = anderswo ? (namen[p.toMap]?.name ?? this.bestand.name()(p.toMap) ?? 'another map') : this.ebeneName(p.toFloor);
      const art = p.kind.charAt(0).toUpperCase() + p.kind.slice(1);
      const vorgabe = this.kampagnenRegeln();
      const gilt = {
        trigger: (p.rules['trigger'] as string) ?? vorgabe.trigger,
        when: (p.rules['when'] as string) ?? vorgabe.when,
        move: (p.rules['move'] as string) ?? vorgabe.move,
        action: (p.rules['action'] as string) ?? vorgabe.action,
      };
      return {
        ...p,
        key: p.relId + (p.mirrored ? '~' : ''),
        anderswo,
        ziel,
        hatFlaeche: !!p.area,
        regelText: this.regelSatz(gilt),
        titel: `${art} to ${ziel}${p.oneWay ? ' — one way' : ''}${p.sight === 'none' ? ' — no view through' : ''}${p.note ? ' — ' + p.note : ''}`,
      };
    });
  });
  /** Die Vorgabe der Kampagne für Übergänge (T-326). */
  protected readonly kampagnenRegeln = computed(() => this.kontext()?.passageRules ?? passageRulesOf(null));
  /** Was ein Übergang regelt, als Satz unter seiner Karte. */
  private regelSatz(g: { trigger: string; when: string; move: string; action: string }): string {
    const wer = g.trigger === 'gm' ? 'The GM sends tokens through' : g.trigger === 'players' ? 'Players go through themselves' : 'GM and players';
    const wann = g.when === 'turn' ? ', in an encounter on their own turn' : g.when === 'roundEnd' ? ', in an encounter in the last turn of the round' : '';
    const kosten = passageCostText({ ...passageRulesOf(null), move: g.move as never, action: g.action as never }, null);
    return `${wer}${wann}. In an encounter: ${kosten}.`;
  }
  /** Die Einstellungen je Übergang (T-326): leer heisst „wie die Kampagne". */
  protected readonly REGEL_FELDER: ReadonlyArray<{ key: string; label: string; werte: readonly string[] }> = [
    { key: 'trigger', label: 'Who', werte: PASSAGE_TRIGGERS },
    { key: 'when', label: 'When in an encounter', werte: PASSAGE_WHENS },
    { key: 'move', label: 'Movement', werte: PASSAGE_MOVES },
    { key: 'action', label: 'Action', werte: PASSAGE_ACTIONS },
    { key: 'confirm', label: 'GM confirms', werte: PASSAGE_CONFIRMS },
  ];
  /** Das Gitter der gezeigten Ebene — die Fläche eines Übergangs ohne eigene ist ein Feld darin. */
  private readonly geoJetzt = computed(() => {
    const s = this.einst();
    return s ? gridGeometry(s, this.nat()) : null;
  });
  /**
   * **Zonen und Gebiete** (T-219, REQ-193) dieser Ebene, wie sie gezeichnet
   * werden: mit Gitter die Felder, deren Mitte in der Form liegt
   * (`areaCells`, dieselbe Regel wie das Gelände im Zugplan), ohne Gitter
   * die Form selbst. Was hier ankommt, hat der Server gesiebt (`redactMap`);
   * in „View as“ rechnet `angezeigt` dasselbe als Vorschau. Name und Regel
   * kommen aus dem Kontext (`areas`) — neu, wenn die Karte über den
   * Live-Kanal neu kommt (T-399).
   */
  protected readonly flaechen = computed(() => {
    const e = this.angezeigt();
    if (!e) return [];
    const geo = this.geoJetzt();
    const info = this.kontext()?.areas ?? {};
    const leitung = !this.spielersicht() && this.darfSchreiben();
    return mapAreas(e).map((a) => {
      const i = info[a.to];
      const rule = i?.rule ?? {};
      const zellen = geo ? areaCells(geo, a.shape) : null;
      const d = zellen ? zellen.map((c) => punktePfad(cellCorners(geo!, c))).join(' ') : formPfad(a.shape);
      const regel = a.type === 'zone' ? zoneRuleText(rule) : '';
      const name = i?.name ?? (a.type === 'zone' ? 'Zone' : 'Territory');
      return {
        id: a.id,
        type: a.type,
        name: regel ? `${name} (${regel})` : name,
        d,
        farbe: areaColor(a, rule),
        deckkraft: a.opacity,
        /* Eine versteckte Zone, die noch niemand fand — nur die Leitung hat sie. */
        versteckt: leitung && !!rule.hidden && !a.found,
      };
    });
  });
  protected readonly flaechenText = computed(() => this.flaechen().map((f) => f.name).join(', '));
  private readonly flaechenWahl = signal<boolean>(lies(FLAECHEN_SCHLUESSEL) !== 'off');
  protected readonly flaechenAn = computed(() => this.flaechenWahl());
  protected flaechenUm(): void {
    const an = !this.flaechenWahl();
    this.flaechenWahl.set(an);
    schreib(FLAECHEN_SCHLUESSEL, an ? 'on' : 'off');
  }

  /** Die Flächen der Übergänge auf dieser Ebene, als Punkte für das SVG. Ohne eigene Fläche nur, solange die Karte offen ist. */
  protected readonly uebergangFlaechen = computed(() => {
    const geo = this.geoJetzt();
    const offen = this.uebergangWahl();
    return this.uebergaenge().flatMap((u) => {
      const a = u.area ?? (offen === u.key ? passageArea(u, geo) : null);
      return a ? [{ key: u.key, kind: u.kind, offen: offen === u.key, pts: a.map(([x, y]) => `${x},${y}`).join(' ') }] : [];
    });
  });
  /** Das angetippte Ende. */
  protected readonly uebergangWahl = signal<string | null>(null);
  protected readonly uebergangOffen = computed(() => this.uebergaenge().find((u) => u.key === this.uebergangWahl()) ?? null);
  /** Wer auf dem angetippten Ende steht und durch darf. */
  protected readonly aufUebergang = computed(() => {
    const u = this.uebergangOffen();
    if (!u || u.anderswo) return [];
    const zieht = new Set(this.ziehbarHier());
    const geo = this.geoJetzt();
    return this.marker().filter((m) => (m.kind === 'play' || m.kind === 'party') && inPassage(u, m, geo) && (this.alsLeitung() || zieht.has(m.to)));
  });
  protected uebergangKlick(ev: Event, key: string): void {
    ev.stopPropagation();
    this.uebergangWahl.set(this.uebergangWahl() === key ? null : key);
  }
  /** Durchgehen (T-307): der Server versetzt das Token, die Seite folgt ihm auf die Zielebene. */
  protected async durchgehen(rel: string, u: Passage): Promise<void> {
    if (this.speichert()) return;
    this.speichert.set(true);
    this.mangel.set(null);
    try {
      const nat = this.nat();
      const r = await this.api.moveToken(this.id(), { rel, via: u.relId, ...(nat ? { nat } : {}) });
      if (r.proposal) {
        this.hinweis.set(VORSCHLAG_GESENDET);
        await this.kontextHolen(this.id());
        return;
      }
      await this.nachDurchgang(r.map ?? u.toMap, r.floor ?? u.toFloor);
    } catch (err) {
      this.mangel.set({ text: err instanceof Error ? err.message : 'The token did not go through.', einzeln: [] });
    } finally {
      this.speichert.set(false);
    }
  }
  /** **Alle durchschicken** (T-326): die Leitung schickt jedes Token in der Fläche. */
  protected async alleDurch(u: Passage): Promise<void> {
    if (this.speichert()) return;
    this.speichert.set(true);
    this.mangel.set(null);
    try {
      const nat = this.nat();
      const r = await this.api.sendThrough(this.id(), { via: u.relId, floor: this.ebene(), ...(nat ? { nat } : {}) });
      await this.nachDurchgang(r.map, r.floor);
    } catch (err) {
      this.mangel.set({ text: err instanceof Error ? err.message : 'Nobody went through.', einzeln: [] });
    } finally {
      this.speichert.set(false);
    }
  }
  /** Nach dem Durchgang: dieselbe Karte auf der Zielebene, sonst die Zielkarte öffnen. */
  private async nachDurchgang(map: string, floor: string): Promise<void> {
    this.uebergangWahl.set(null);
    if (map !== this.id()) {
      const w = this.weg(map);
      await this.router.navigate(w.link, w.query ? { queryParams: w.query } : {});
      return;
    }
    await this.bestand.oeffnen(this.id(), true, false);
    this.ebeneZeigen(floor);
  }
  /** Eine Einstellung je Übergang (T-326): leer nimmt sie weg, dann gilt die Kampagne. */
  protected regelSetzen(relId: string, key: string, wert: string): void {
    const g = this.ganz();
    if (!g) return;
    const relations = (g.relations ?? []).map((r) => {
      if (r.id !== relId) return r;
      const props = { ...((r.props ?? {}) as Record<string, unknown>) };
      const rules = { ...((props['rules'] ?? {}) as Record<string, unknown>) };
      if (wert) rules[key] = wert;
      else delete rules[key];
      if (Object.keys(rules).length) props['rules'] = rules;
      else delete props['rules'];
      return { ...r, props };
    });
    void this.schreibenGanz({ ...g, relations });
  }

  /** **Die Fläche eines Endes setzen** (T-326): zwei Ecken, auf die Felder gerundet. */
  protected readonly flaecheA = signal<Pt | null>(null);
  private flaecheFuer: { relId: string; seite: 'area' | 'toArea' } | null = null;
  protected flaecheBeginnen(u: Passage): void {
    this.flaecheFuer = { relId: u.relId, seite: u.mirrored ? 'toArea' : 'area' };
    this.flaecheA.set(null);
    this.waehle('uebergangFlaeche');
  }
  protected flaecheWeg(u: Passage): void {
    const g = this.ganz();
    if (!g) return;
    void this.schreibenGanz(withPassageArea(g, u.relId, u.mirrored ? 'toArea' : 'area', null));
  }
  private flaecheTippen(pt: Pt): void {
    const a = this.flaecheA();
    if (!a) {
      this.flaecheA.set(pt);
      return;
    }
    const f = this.flaecheFuer;
    const g = this.ganz();
    this.flaecheA.set(null);
    this.waehle('keins');
    if (!f || !g) return;
    /* Mit Gitter: die Felder, die die beiden Ecken treffen, ganz. */
    const geo = this.geoJetzt();
    let x0 = Math.min(a.x, pt.x);
    let y0 = Math.min(a.y, pt.y);
    let x1 = Math.max(a.x, pt.x);
    let y1 = Math.max(a.y, pt.y);
    if (geo) {
      const p = cellPoly(geo, cellAt(geo, { x: x0, y: y0 }));
      const q = cellPoly(geo, cellAt(geo, { x: x1, y: y1 }));
      x0 = Math.min(...p.map((c) => c[0]));
      y0 = Math.min(...p.map((c) => c[1]));
      x1 = Math.max(...q.map((c) => c[0]));
      y1 = Math.max(...q.map((c) => c[1]));
    }
    if (x1 - x0 < 0.002 || y1 - y0 < 0.002) {
      this.hinweis.set('The two corners are too close.');
      return;
    }
    const k = (v: number) => Math.min(1, Math.max(0, v));
    void this.schreibenGanz(withPassageArea(g, f.relId, f.seite, [[k(x0), k(y0)], [k(x1), k(y0)], [k(x1), k(y1)], [k(x0), k(y1)]]));
  }
  /** Einen Übergang einstellen — Art, Sicht, Einbahn; `null` nimmt es weg. */
  protected uebergangSetzen(relId: string, patch: Record<string, unknown>): void {
    const g = this.ganz();
    if (!g) return;
    const relations = (g.relations ?? []).map((r) => {
      if (r.id !== relId) return r;
      const props = { ...((r.props ?? {}) as Record<string, unknown>) };
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === false || v === '') delete props[k];
        else props[k] = v;
      }
      return { ...r, props };
    });
    void this.schreibenGanz({ ...g, relations });
  }
  protected uebergangWeg(relId: string): void {
    const g = this.ganz();
    if (!g || !confirm('Remove this passage? Both ends go.')) return;
    this.uebergangWahl.set(null);
    void this.schreibenGanz({ ...g, relations: (g.relations ?? []).filter((r) => r.id !== relId) });
  }

  /** Einen Übergang setzen: erst das Ende hier, dann das Ziel — eine Ebene (und ihr Punkt) oder eine andere Karte. */
  protected readonly uebergangArt = signal<PassageKind>('stairs');
  protected readonly uebergangA = signal<{ floor: string; pt: Pt } | null>(null);
  protected readonly uebergangZiel = signal<string>('');
  protected readonly nurKarten = computed(() => new Set([this.id()]));
  protected uebergangBeginnen(): void {
    this.waehle('uebergang');
    this.uebergangA.set(null);
    this.uebergangZiel.set('');
  }
  private uebergangTippen(pt: Pt): void {
    const a = this.uebergangA();
    if (!a) {
      this.uebergangA.set({ floor: this.ebene(), pt });
      return;
    }
    const ziel = this.uebergangZiel();
    if (!ziel || ziel === '__karte' || this.ebene() !== ziel) return;
    this.uebergangAnlegen(this.id(), ziel, pt);
  }
  /** Das Ziel gewählt: eine Ebene dieser Karte — dann dorthin wechseln und den Punkt tippen. */
  protected uebergangZielWaehlen(ziel: string): void {
    this.uebergangZiel.set(ziel);
    if (ziel && ziel !== '__karte') this.ebeneWahl.set(ziel);
  }
  /** Ein Portal auf eine andere Karte: es führt auf deren erste Ebene, in die Mitte. */
  protected uebergangKarte(e: Entity): void {
    if (!isMap(e)) {
      this.hinweis.set('Pick a map — a portal leads to a map.');
      return;
    }
    this.uebergangAnlegen(e.id, GROUND_FLOOR, { x: 0.5, y: 0.5 });
  }
  private uebergangAnlegen(toMap: string, toFloor: string, to: Pt): void {
    const g = this.ganz();
    const a = this.uebergangA();
    if (!g || !a) return;
    const r4 = (v: number) => Math.round(v * 10000) / 10000;
    const props: Record<string, unknown> = {
      kind: 'passage',
      passage: this.uebergangArt(),
      x: r4(a.pt.x),
      y: r4(a.pt.y),
      toX: r4(to.x),
      toY: r4(to.y),
      ...(a.floor !== GROUND_FLOOR ? { floor: a.floor } : {}),
      ...(toFloor !== GROUND_FLOOR ? { toFloor } : {}),
    };
    const rel = { id: `r-${crypto.randomUUID()}`, type: 'marker', to: toMap, props };
    this.uebergangA.set(null);
    this.uebergangZiel.set('');
    this.waehle('keins');
    void this.schreibenGanz({ ...g, relations: [...(g.relations ?? []), rel] }).then(() => this.ebeneWahl.set(a.floor));
  }
  /**
   * **Auf einen Übergang gezogen** (T-326): ein Portal nimmt das Token
   * gleich mit — so war es in der alten Karte; an einer Treppe öffnet sich
   * ihre Karte, denn wer auf der Treppe steht, will vielleicht nur sehen.
   */
  private amUebergang(rel: string, pt: Pt): void {
    if (this.mangel() || this.imKampf()) return;
    const m = this.marker().find((x) => x.rel.id === rel);
    if (!m || (m.kind !== 'play' && m.kind !== 'party')) return;
    const u = passageUnder(this.uebergaenge(), pt, this.geoJetzt());
    if (!u) return;
    const ue = this.uebergaenge().find((x) => x.relId === u.relId && x.mirrored === u.mirrored);
    if (u.kind === 'portal' && !this.alsLeitung()) {
      void this.durchgehen(rel, u);
      return;
    }
    if (ue) this.uebergangWahl.set(ue.key);
  }
  /** Ein Token, das nah an einem Ende losgelassen wird, steht genau darauf — dann geht es durch. */
  private aufEnde(pt: Pt): Pt {
    const nat = this.nat();
    const s = this.einst();
    if (!nat || !s || nat.w <= 0) return pt;
    const reich = (0.5 * s.gridSize) / nat.w;
    const ar = nat.h / nat.w;
    /* Eine Fläche (T-326) fängt selbst — dort bleibt das Token, wo es fällt. */
    const ende = this.uebergaenge().find((u) => !u.area && Math.hypot(pt.x - u.at.x, (pt.y - u.at.y) * ar) <= reich);
    return ende ? ende.at : pt;
  }
  /** Die Kartenregeln der Kampagne (T-204); ohne Antwort die Vorgaben. */
  protected readonly regeln = computed<MapRules>(() => this.kontext()?.rules ?? { fog: 'party', moves: 'free', tokenMove: 'own', revealOnMove: false, doors: 'players', tokenSizes: 'rules' });
  /** Führt die Kampagne den Nebel je Figur? */
  protected readonly jeFigur = computed(() => this.regeln().fog === 'player');
  /** Für wen aufgedeckt wird und wessen Sicht „View as“ zeigt (je Figur). */
  protected readonly nebelFuer = signal<string | null>(null);
  /** Das Menü der Ansicht am Telefon (T-320). */
  protected readonly menueOffen = signal(false);
  /**
   * **„View as“** (T-320): `gm` die eigene Sicht, `all` die Spielenden
   * zusammen, sonst eine Figur — vorher zwei Knöpfe („Player view“ und
   * „For“) für eine Frage.
   */
  protected ansehenAls(wert: string): void {
    this.spielersicht.set(wert !== 'gm');
    this.nebelFuer.set(wert === 'gm' || wert === 'all' ? null : wert);
  }
  /** Die Figuren auf der Karte, für die man aufdecken kann: Spiel-Tokens und die Gruppe. */
  protected readonly nebelFuerName = computed(() => this.figurenHier().find((f) => f.id === this.nebelFuer())?.name ?? '');
  protected readonly figurenHier = computed(() => {
    const e = this.karte();
    if (!e) return [];
    const ziele = this.kontext()?.targets ?? {};
    const ids = [...new Set(markersOf(e).filter((m) => m.kind === 'play' || m.kind === 'party').map((m) => m.to))];
    return ids.map((id) => ({ id, name: ziele[id]?.name ?? this.bestand.name()(id) ?? id }));
  });
  /** Die eigenen Figuren mit Token hier (T-204). */
  protected readonly eigeneHier = computed(() => this.kontext()?.own ?? []);
  /** Die Stufen „wer zieht" mit ihren Namen aus der Regeloption (T-290) — eine Liste, nicht zwei. */
  protected readonly TOKEN_MOVE_WAHL = (RULE_OPTIONS.find((o) => o.key === 'tokenMove')?.variants ?? []).map((v) => ({ key: v.key, label: v.label }));
  protected readonly bewegungOffen = signal(false);
  protected readonly bewegungSpeichert = signal(false);
  protected readonly bewegungFehler = signal<string | null>(null);
  /** „own · confirm" — der Stand am Knopf. */
  protected readonly bewegungText = computed(() => {
    const r = this.regeln();
    return `${r.tokenMove}${r.moves === 'confirm' ? ' · confirm' : ''}`;
  });

  /**
   * **Absprung aus der Karte** (T-290): eine Regeloption der Kampagne
   * direkt setzen — wie „Use this" unter Rules & options (`withRuleVariant`,
   * `PUT /api/entities/:id`); Schreibrecht und `validateEntity` prüft der
   * Server. Die Spielenden bekommen es live über die Kampagne.
   */
  protected async bewegungSetzen(option: 'tokenMove' | 'moves', wert: string): Promise<void> {
    const id = this.kontext()?.campaign;
    if (!id || this.bewegungSpeichert()) return;
    this.bewegungSpeichert.set(true);
    this.bewegungFehler.set(null);
    try {
      const { refs: _r, fromTemplate: _f, ...k } = (await this.api.entity(id)) as Entity & { refs?: unknown; fromTemplate?: unknown };
      const neu = withRuleVariant(k as Entity, option, wert);
      if (neu) await this.api.putEntity(neu);
      await this.kontextHolen(this.id());
    } catch (err) {
      this.bewegungFehler.set(err instanceof Error ? `The setting could not be saved: ${err.message}` : 'The setting could not be saved.');
    } finally {
      this.bewegungSpeichert.set(false);
    }
  }

  /** Was der Betrachter ziehen darf (T-290, `Campaign.tokenMove`) — der Server rechnet es. */
  protected readonly ziehbarHier = computed(() => this.kontext()?.movable ?? this.eigeneHier());
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
  protected readonly alsLeitung = computed(() => this.darfSchreiben() && !this.spielersicht());
  protected readonly fehlt = computed(() => this.bestand.fehlt().has(this.id()));
  protected readonly name = computed(() => {
    const e = this.karte();
    return e ? entityName(e) : '';
  });
  /** Die Einstellungen der Karte — mit dem Gitter-Entwurf darüber, solange einer dasteht (T-304, Vorschau). */
  protected readonly einst = computed(() => {
    const e = this.karte();
    const d = this.gitterEntwurf();
    return e ? mapSettings(d ? setGrid(e, d) : e) : null;
  });
  protected readonly darfSchreiben = computed(() => this.session.darfSchreiben()(this.id()));

  // ------------------------------------------------------------ Im Spiel

  /** Ist das eine Karte im Spiel (T-289), eine Instanz ihrer Vorlage? */
  protected readonly istInstanz = computed(() => isPlayInstance(this.karte()));
  /** Freigegeben für Spielende (`Map.released`)? Nur an einer Instanz von Belang. */
  protected readonly freigegeben = computed(() => {
    const e = this.karte();
    return !!e && isReleased(e);
  });
  /** Wann, in welcher Sitzung, aus welcher Vorlage — die Kopfzeile eines gespielten Stands. */
  protected readonly gespielt = computed(() => {
    const e = this.karte();
    if (!e || !isPlayInstance(e)) return null;
    const info = playedInfo(e);
    const vorlage = templateOf(this.bestand.voll(), e)?.id ?? (e.relations ?? []).find((r) => r.type === 'instanceOf')?.to ?? null;
    return {
      at: this.datum(info.at),
      session: info.session,
      sessionName: info.session ? (this.bestand.name()(info.session) ?? 'Session') : null,
      template: vorlage,
      templateName: vorlage ? (this.bestand.name()(vorlage) ?? 'the template') : null,
    };
  });
  /** „Played" an der Vorlage: die gespielten Stände (`GET /api/maps/:id/played`). */
  protected readonly gespieltListe = signal<GespieltZeile[]>([]);
  private gespieltLauf = 0;
  private async gespieltHolen(id: string): Promise<void> {
    const lauf = ++this.gespieltLauf;
    try {
      const r = await this.api.played(id);
      if (lauf === this.gespieltLauf) this.gespieltListe.set(r.rows.filter((z) => z.kind === 'map'));
    } catch {
      if (lauf === this.gespieltLauf) this.gespieltListe.set([]);
    }
  }
  protected datum(iso: string): string {
    const d = iso ? new Date(iso) : null;
    return d && !Number.isNaN(d.getTime()) ? d.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '';
  }
  protected freigeben(an: boolean): void {
    const e = this.karte();
    if (!e) return;
    /* Freigeben heisst teilen: auch `ready` und `campaign` (releaseMap). */
    void this.schreiben(releaseMap(e, an));
  }
  /** Der Deckname der Karte, wie ihn die Spielenden sehen (REQ-178) — nur für die Leitung von Belang. */
  protected readonly deckname = computed(() => {
    const c = (this.karte()?.components?.['Identity'] as { cover?: unknown } | undefined)?.cover;
    return typeof c === 'string' && c.trim() ? c.trim() : null;
  });
  protected readonly deckt = signal(false);
  /** Den Namen den Gruppen zuteilen; danach sehen sie ihn statt des Decknamens. */
  protected async namenAufdecken(): Promise<void> {
    const e = this.karte();
    if (!e || this.deckt()) return;
    this.deckt.set(true);
    try {
      const r = await this.api.revealKnowledge(e.id);
      this.hinweis.set(`The name is now known to ${r.parties.map((p) => p.name).join(', ')}.`);
    } catch (err) {
      this.hinweis.set(err instanceof Error ? `The name could not be revealed: ${err.message}` : 'The name could not be revealed.');
    } finally {
      this.deckt.set(false);
    }
  }
  protected readonly navigationSpeichert = signal(false);
  /** Den Schalter der Sitzung setzen (`Session.mapNavigation`, T-308); der Server siebt danach. */
  protected async navigationSetzen(an: boolean): Promise<void> {
    const id = this.kontext()?.session;
    if (!id || this.navigationSpeichert()) return;
    this.navigationSpeichert.set(true);
    try {
      const { refs: _r, fromTemplate: _f, ...s } = (await this.api.entity(id)) as Entity & { refs?: unknown; fromTemplate?: unknown };
      const c = s.components ?? {};
      /* Ältere Sitzungen tragen `SessionState` (T-202); geschrieben wird, wo es schon steht. */
      const karteName = c['Session'] || !c['SessionState'] ? 'Session' : 'SessionState';
      await this.api.putEntity({ ...s, components: { ...c, [karteName]: { ...((c[karteName] ?? {}) as Record<string, unknown>), mapNavigation: an } } } as Entity);
      await this.kontextHolen(this.id());
    } catch (err) {
      this.hinweis.set(err instanceof Error ? `The setting could not be saved: ${err.message}` : 'The setting could not be saved.');
    } finally {
      this.navigationSpeichert.set(false);
    }
  }
  protected async insSpielNehmen(): Promise<void> {
    try {
      const r = await this.api.takeIntoPlay({ session: this.sitzung(), map: this.id() });
      /* Was die Leitung schreibt, sagt `/api/me` — die neue Instanz gehört dazu. */
      await this.session.load(true);
      if (r.map) this.insSpiel.emit(r.map);
    } catch (e) {
      this.hinweis.set((e as Error).message);
    }
  }

  protected readonly kontext = signal<KartenKontext | null>(null);
  private kontextLauf = 0;
  private async kontextHolen(id: string): Promise<void> {
    const lauf = ++this.kontextLauf;
    try {
      const k = await this.api.mapContext(id);
      if (lauf === this.kontextLauf) {
        this.kontext.set(k);
        /* Der eigene Vorschlag ist entschieden (T-204): der Hinweis darauf geht. */
        if (this.hinweis() === VORSCHLAG_GESENDET && !(k.proposals ?? []).some((v) => (k.movable ?? k.own ?? []).includes(v.actor))) this.hinweis.set(null);
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

  /**
   * **Wohin gezoomt wird** (T-327), in Kartenanteilen: der Punkt in der
   * Bühne (der Zeiger beim Rad), sonst die Mitte des Blicks. Nur eine
   * Verknüpfung, in der er liegt, wird betreten (`zoomStep`).
   */
  private fokus(fx?: number, fy?: number): Pt | undefined {
    const b = this.buehne()?.nativeElement;
    const h = this.hoehe();
    if (!b || !h) return undefined;
    const m = this.saum();
    const px = fx ?? b.clientWidth / 2;
    const py = fy ?? b.clientHeight / 2;
    return { x: (b.scrollLeft - m.x + px) / this.breite(), y: (b.scrollTop - m.y + py) / h };
  }

  /** Der Ausschnitt in Kartenanteilen. */
  private sichtbar(): Frame | undefined {
    const b = this.buehne()?.nativeElement;
    const h = this.hoehe();
    if (!b || !h) return undefined;
    const w = this.breite();
    const m = this.saum();
    return { x: (b.scrollLeft - m.x) / w, y: (b.scrollTop - m.y) / h, w: b.clientWidth / w, h: b.clientHeight / h };
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
    /* Mit Saum (T-327) liegt das Bild um ihn verschoben; gerechnet wird im Bild. */
    const m = this.saum();
    const cx = b.scrollLeft - m.x + px;
    const cy = b.scrollTop - m.y + py;
    const f = neu / alt;
    const n = this.nat();
    const w = Math.max(1, this.fenster().w) * neu;
    i.style.width = `${w}px`;
    if (n) i.style.height = `${w * (n.h / n.w)}px`;
    b.scrollLeft = cx * f - px + m.x;
    b.scrollTop = cy * f - py + m.y;
    this.zoom.set(neu);
  }

  /** Ein Zoomschritt — hinein in eine Unterkarte, hinaus zur Karte darüber, oder näher. */
  protected stufe(richtung: 1 | -1, fx?: number, fy?: number): void {
    const e = this.karte();
    if (!e) return;
    const visible = this.sichtbar();
    const focus = this.fokus(fx, fy);
    const s = zoomStep({
      zoom: this.zoom(),
      direction: richtung,
      children: this.kontext()?.children ?? [],
      ...(focus ? { focus } : {}),
      /* Aus (T-308): kein Rückfall auf die Kante — der Server hat entschieden. */
      parent: this.kontext()?.parents.at(-1)?.id ?? (this.kontext()?.navigation === false ? undefined : parentMapRelation(e)?.to),
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
  /** In Play öffnen (T-316): die Karte, und die Sitzung des Standes, wenn er eine hat. */
  protected spielQuery(map: string, session: string | null | undefined): Record<string, string> {
    return session ? { map, session } : { map };
  }

  protected weg(id: string): { link: string[]; query: Record<string, string> | null } {
    return this.ort() === 'play' ? { link: ['/play'], query: { map: id } } : { link: ['/artikel', id], query: null };
  }
  private gehe(id: string): void {
    const w = this.weg(id);
    void this.router.navigate(w.link, w.query ? { queryParams: w.query, queryParamsHandling: 'merge' } : {});
  }

  // -------------------------------------------------------------- Rahmen

  /**
   * **Die Verknüpfungen, wie sie stehen** (T-327): was der Server für den
   * Betrachter sagt (`show`) — beim Bearbeiten (Sub-maps) jede als Rahmen,
   * sonst fände die Leitung eine versteckte nicht wieder. Die Form steht in
   * Anteilen des Kastens (`areaInFrame`).
   */
  protected readonly rahmen = computed(() => {
    const nat = this.nat();
    const zoom = this.zoom();
    const f = this.fenster();
    const bearbeiten = this.aktiv() === 'unterkarten' && this.darfSchreiben();
    return (this.kontext()?.children ?? []).flatMap((k) => {
      const show: MapLinkShow = bearbeiten ? 'jump' : (k.show ?? 'jump');
      if (show === 'hidden') return [];
      const form = areaInFrame({ frame: k.frame, area: k.area ?? null });
      return [
        {
          ...k,
          show,
          nah: frameNear(k.frame, nat, zoom, f, k.near ?? MAP_NEAR),
          punkte: form ? form.map(([x, y]) => `${x},${y}`).join(' ') : null,
          mitte: linkCentre({ frame: k.frame, area: k.area ?? null }),
          raster: bearbeiten ? this.unterRaster(k) : null,
        },
      ];
    });
  });

  /**
   * **Das Raster der Unterkarte im Bereich** (T-329): beim Einstellen einer
   * ausgerichteten Verknüpfung stehen beide Gitter übereinander — so sieht
   * die Leitung, dass sie ineinanderlaufen. Gerechnet am Server
   * (`childGrid`), hier nur in Schirmpunkte gesetzt.
   */
  private unterRaster(k: NonNullable<ReturnType<typeof this.kontext>>['children'][number]): { bild: string; groesse: string; lage: string } | null {
    const g = k.childGrid;
    const s = this.einst();
    if (!k.align || !g || !s) return null;
    const farbe = gridStroke({ ...s, gridColor: '#2f6f9f', gridOpacity: 0.7, gridHidden: false });
    if (!farbe) return null;
    const bw = k.frame.w * this.breite();
    const bh = k.frame.h * (this.hoehe() ?? this.breite());
    const w = g.cell * bw;
    if (!(w >= 2)) return null;
    const lage = `${g.ox * bw}px ${g.oy * bh}px`;
    if (g.shape === 'square') {
      return { bild: `linear-gradient(to right, ${farbe} 1px, transparent 1px), linear-gradient(to bottom, ${farbe} 1px, transparent 1px)`, groesse: `${w}px ${w}px`, lage };
    }
    const h = ((w * 2) / Math.sqrt(3)) * 1.5;
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 100 ${HEX_TILE_H}" preserveAspectRatio="none">` +
      `<path d="${HEX_TILE_PATH}" fill="none" stroke="${farbe}" stroke-width="1" vector-effect="non-scaling-stroke"/></svg>`;
    return { bild: `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`, groesse: `${w}px ${h}px`, lage };
  }

  // -------------------------------------------------- Hinaus und Rand (T-327)

  /** Die Pfeile am Rand: heute die Karte darüber; Nachbarkarten nach E-121. */
  protected readonly ausgaenge = computed(() => mapExits(this.kontext()?.parents ?? []));

  /** Die Karte darüber als Rand: ihr Bild und seine Lage in Anteilen dieser Karte. */
  protected readonly rand = computed(() => {
    const o = this.kontext()?.outer;
    if (!o || !this.hoehe()) return null;
    return { image: o.image, lage: outerPlacement(o.frame) };
  });
  /* Nach jedem Zeichnen mit Rand (neues Bild, Zoom, Fenster) sitzt er erst nach dem nächsten Takt. */
  private readonly randNachziehen = effect(() => {
    if (!this.rand()) return;
    this.breite();
    this.fenster();
    setTimeout(() => this.randFolgen(), 0);
  });
  private readonly randFeld = viewChild<ElementRef<HTMLElement>>('randFeld');
  private readonly randInnen = viewChild<ElementRef<HTMLElement>>('randInnen');
  /**
   * Der Rand liegt im sichtbaren Ausschnitt fest und sein Inneren läuft mit
   * der Karte: so trägt er nichts zur Scrollfläche bei, und links und oben
   * der Unterkarte (negative Lage) ist er trotzdem zu sehen. Direkt am
   * Element gesetzt, nicht über ein Signal — jeder Scrollschritt zeichnete
   * sonst die ganze Karte neu.
   */
  protected randFolgen(): void {
    const b = this.buehne()?.nativeElement;
    const feld = this.randFeld()?.nativeElement;
    const innen = this.randInnen()?.nativeElement;
    if (!b || !feld || !innen) return;
    const m = this.saum();
    feld.style.transform = `translate(${b.scrollLeft}px, ${b.scrollTop}px)`;
    innen.style.transform = `translate(${m.x - b.scrollLeft}px, ${m.y - b.scrollTop}px)`;
  }

  /**
   * **Der Saum um die Unterkarte** (T-327): mit Rand liegt das Bild um
   * 40 % des Fensters je Seite eingerückt, damit man auch links und oben
   * über die Unterkarte hinaus schwenken kann. Ohne Rand keiner — dann
   * steht die Karte wie bisher am Ursprung der Bühne.
   */
  protected readonly saum = computed(() => {
    if (!this.rand()) return { x: 0, y: 0 };
    const f = this.fenster();
    return { x: Math.round(f.w * 0.4), y: Math.round(f.h * 0.4) };
  });
  /** Beim ersten Saum steht der Blick auf der Unterkarte, nicht im Rand. */
  private saumFuer: string | null = null;
  private readonly saumAnfang = effect(() => {
    const m = this.saum();
    const id = this.id();
    if (!m.x || this.saumFuer === id) return;
    this.saumFuer = id;
    setTimeout(() => {
      const b = this.buehne()?.nativeElement;
      if (!b) return;
      b.scrollLeft += m.x;
      b.scrollTop += m.y;
    }, 0);
  });

  // -------------------------------------------------------------- Gitter

  protected readonly gitter = computed(() => this.gitterMuster(this.faktor()));

  /**
   * **Das Gitter als Hintergrund** in `f` Schirmpunkten je Bildpunkt — für die
   * Karte und, vergrössert, für die Lupe (T-315). Farbe und Deckkraft aus
   * der Karte (`gridStroke`, T-314); ausgeblendet: keines.
   */
  private gitterMuster(f: number): { bild: string; groesse: string; lage: string; w: number; h: number; ox: number; oy: number } | null {
    const s = this.einst();
    const geo = s ? gridGeometry(s, this.nat()) : null;
    const farbe = s ? gridStroke(s) : null;
    if (!geo || !farbe) return null;
    const w = geo.size * f;
    const lage = `${geo.ox * f}px ${geo.oy * f}px`;
    if (geo.shape === 'square') {
      return {
        bild: `linear-gradient(to right, ${farbe} 1px, transparent 1px), linear-gradient(to bottom, ${farbe} 1px, transparent 1px)`,
        groesse: `${w}px ${w}px`,
        lage,
        w,
        h: w,
        ox: geo.ox * f,
        oy: geo.oy * f,
      };
    }
    const h = geo.rowHeight * f * 1.5;
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 100 ${HEX_TILE_H}" preserveAspectRatio="none">` +
      `<path d="${HEX_TILE_PATH}" fill="none" stroke="${farbe}" stroke-width="1" vector-effect="non-scaling-stroke"/></svg>`;
    return { bild: `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`, groesse: `${w}px ${h}px`, lage, w, h, ox: geo.ox * f, oy: geo.oy * f };
  }

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
    const plan = this.planJetzt();
    const pr = this.planRaster();
    /* Ein freies Licht (T-320) ist für Spielende nur sein Schein, kein Marker. */
    const lt = this.alsLeitung();
    const getragen = this.getragen();
    const kartenSicht = this.kartenMarkerAnsicht();
    const artSicht = this.kontext()?.kindMarkerView ?? null;
    return markersOf(e).filter((m) => m.kind !== 'passage' && (m.kind !== 'light' || lt)).map((m: MapMarker) => {
      const ziel = m.kind === 'light' ? undefined : ziele[m.to];
      /* **Die Markeransicht** (T-214): Marker › Karte › Kartenart › Art › Bild. */
      const von = { map: kartenSicht, kind: artSicht, type: ziel?.view ?? null };
      const ansicht = markerViewOf(m, von);
      const mitBild = ansicht === 'image' || ansicht === 'card';
      const name = m.kind === 'light' ? 'Light' : (ziel?.name ?? this.bestand.name()(m.to) ?? '?');
      const pt = z && z.id === m.rel.id ? z.pt : m;
      /* Der Platz in Feldern (T-317): am Token, sonst nach Statblock; Möbel behalten ihre Breite. */
      const span = m.kind === 'scenery' ? m.size : this.tokenPlatz(m.to, m.ownSize);
      const px = Math.min(max, Math.max(MARKER_MIN, s.gridSize * span * f));
      return {
        ...m,
        x: pt.x,
        y: pt.y,
        name,
        px,
        ansicht,
        /* Was ohne eigene Angabe gälte — für „as the map (…)“ am gewählten Marker. */
        geerbt: markerViewOf({ ...m, view: '' }, von),
        bild: mitBild && ziel?.image ? bildAdresse(ziel.image, 'thumb', ziel.version ?? '') : null,
        /* Ein fertiges Rundtoken ohne eigenen Kreis, jedes andere Bild im
           Ausschnitt seines Assets (T-297). Möbel liegen, wie sie sind. */
        rund: m.kind !== 'scenery' && mitBild && !!ziel?.image && !!ziel.look?.round,
        bildStil: m.kind !== 'scenery' ? tokenStil(ziel?.look) : {},
        /* Der Rand des Bildes (T-301) — nur um ein ausgeschnittenes. */
        ring: m.kind !== 'scenery' && mitBild && ziel?.image ? ringStil(ziel.look, px) : null,
        /* Der Zeiger auf dem, der dran ist (REQ-144): dasselbe Token,
           ein Ring mehr — und gestrichelt der Nächste. */
        dran: !!zug?.current && m.to === zug.current,
        naechster: !!zug?.next && m.to === zug.next && m.to !== zug.current,
        /* Woher die Grösse kommt (T-390) — nur im Tooltip; der Name des Knopfs bleibt der Name. */
        groesse: m.kind === 'scenery' || m.kind === 'light' ? '' : this.groesseText(m.to, m.ownSize),
        titel: [name, m.note, m.prepared ? 'prepared for an encounter — hidden until it starts' : m.hidden ? 'hidden from the players' : '', zug?.current === m.to ? 'their turn' : zug?.next === m.to ? 'next' : '']
          .filter(Boolean)
          .join(' — '),
        selbst: !!plan && plan.rel === m.rel.id,
        /* In der Zielwahl: in Reichweite (true), ausser Reichweite (false). */
        ziel:
          plan?.mode === 'target' && plan.rel !== m.rel.id && pr && plan.range !== null && m.kind !== 'scenery'
            ? this.planWeite(pr, m) <= plan.range
            : null,
        etikett: plan && plan.rel !== m.rel.id ? (plan.labels[m.to] ?? '') : '',
        /* Wer leuchtet, sieht die Leitung am Marker (T-320) — auch auf einer hellen Karte. */
        leuchtet: lt && markerHasLight(m, getragen) && !lightIsOff(m.rel.props as Record<string, unknown> | undefined),
      };
    });
  });

  /**
   * **Die Marker der Karten darin** (T-328): gehoben am Server, hier nur
   * mit Namen und Bild aus `targets`. Auf einer Ebene ausser der ersten
   * nicht — gehoben wird auf die Karte, nicht in ein Stockwerk.
   */
  protected readonly gehoben = computed(() => {
    const k = this.kontext();
    if (!k?.lifted?.length || this.ebene() !== GROUND_FLOOR) return [];
    return k.lifted.map((g) => ({
      ...g,
      items: g.items.map((m) => {
        const z = k.targets[m.to];
        return { ...m, name: z?.name ?? '?', bild: z?.image ? bildAdresse(z.image, 'thumb', z.version ?? '') : null };
      }),
    }));
  });

  /** **„To place"** (T-328): nur für die Leitung, die hier schreibt. */
  protected readonly zuPlatzieren = computed(() => (this.darfSchreiben() && this.ebene() === GROUND_FLOOR ? (this.kontext()?.toPlace ?? []) : []));
  protected readonly platzWahl = signal<string | null>(null);
  protected readonly platzFehler = signal<string | null>(null);
  protected readonly platzName = computed(() => this.zuPlatzieren().find((v) => v.rel === this.platzWahl())?.name ?? 'it');

  protected platzWaehlen(rel: string): void {
    const an = this.platzWahl() === rel && this.werkzeug() === 'platzieren';
    this.waehle(an ? 'keins' : 'platzieren');
    this.platzWahl.set(an ? null : rel);
  }

  /**
   * **Bestätigen** (T-328): der Marker wandert von der Karte darüber
   * hierher (`confirmPlacement`) — zuerst hier geschrieben, dann oben
   * weggenommen, so geht er nie verloren; schlägt das Zweite fehl, steht
   * er kurz an beiden Stellen und die Liste sagt es nicht mehr an.
   */
  protected async platzBestaetigen(v: PlacementSuggestion, at: Pt): Promise<void> {
    const e = this.karte();
    if (!e || this.speichert()) return;
    this.platzFehler.set(null);
    this.platzWahl.set(null);
    if (this.werkzeug() === 'platzieren') this.werkzeug.set('keins');
    try {
      const { refs: _r, fromTemplate: _f, ...oben } = (await this.api.entity(v.from)) as Entity & { refs?: unknown; fromTemplate?: unknown };
      const p = this.tokenRasten(at, this.tokenPlatz(v.to, null));
      const neu = confirmPlacement(oben as Entity, this.voll(e), v.rel, p, `r-${crypto.randomUUID()}`);
      await this.schreibenGanz(neu.child);
      if (this.mangel()) return;
      await this.api.putEntity(neu.parent);
      await this.kontextHolen(this.id());
    } catch (err) {
      this.platzFehler.set(err instanceof Error ? `Not placed: ${err.message}` : 'Not placed.');
    }
  }

  /** **„Keep on …"** (T-328): der Marker ist oben gemeint (`stay`); keine Karte darin schlägt ihn mehr vor. */
  protected async platzBehalten(v: PlacementSuggestion): Promise<void> {
    this.platzFehler.set(null);
    try {
      const { refs: _r, fromTemplate: _f, ...oben } = (await this.api.entity(v.from)) as Entity & { refs?: unknown; fromTemplate?: unknown };
      await this.api.putEntity(keepOnMap(oben as Entity, v.rel));
      await this.kontextHolen(this.id());
    } catch (err) {
      this.platzFehler.set(err instanceof Error ? `Not saved: ${err.message}` : 'Not saved.');
    }
  }

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
  protected kurzansicht(ev: MouseEvent, id: string, relId?: string): void {
    if (this.nachZug) {
      this.nachZug = false;
      return;
    }
    /* Im Zugplan ist ein Token ein Ziel und keine Kurzansicht (T-198). */
    const plan = this.planJetzt();
    /* Beim Bewegen ist ein Token im Weg und keine Kurzansicht. */
    if (plan?.mode === 'move') return;
    if (plan?.mode === 'target') {
      const m = this.marker().find((x) => x.to === id && x.rel.id !== plan.rel);
      if (!m) return;
      const pr = this.planRaster();
      const nat = this.nat();
      this.planTipp.emit({ kind: 'target', id, name: m.name, feet: pr ? this.planWeite(pr, m) : null, ...(nat ? { nat } : {}) });
      return;
    }
    /* Ein freies Licht hat keinen Artikel (T-320): antippen wählt es nur. */
    if (relId && this.marker().some((x) => x.rel.id === relId && x.kind === 'light')) {
      if (this.darfSchreiben()) this.markerWahl.set(relId);
      return;
    }
    if (ev.ctrlKey || ev.metaKey || ev.shiftKey) {
      void this.router.navigate(['/artikel', id]);
      return;
    }
    this.kurz.oeffnen(id, ev.currentTarget as HTMLElement);
    if (relId && this.darfSchreiben() && !this.spielersicht()) this.markerWahl.set(relId);
  }

  /** Das zuletzt angetippte Token, für „Remove“ an ihm und die Entf-Taste (T-320). */
  protected readonly markerWahl = signal<string | null>(null);
  protected readonly markerWahlBild = computed(() => {
    const id = this.markerWahl();
    return id && this.werkzeug() === 'keins' ? (this.marker().find((m) => m.rel.id === id) ?? null) : null;
  });

  // ------------------------------------------------------ Markeransicht

  protected readonly MARKER_VIEWS = MARKER_VIEWS;
  /** Was die Karte für ihre Marker sagt (`Map.markerView`, T-214) — an der ganzen Karte, nicht je Ebene. */
  protected readonly kartenMarkerAnsicht = computed(() => mapMarkerViewOf(this.ganz()));
  /** „Default — …“: was ohne Angabe der Karte gilt, die Kartenart oder die Art. */
  protected readonly kartenVorgabeText = computed(() => {
    const k = this.kontext()?.kindMarkerView;
    return k ? `as ${mapKindOf(this.ganz())} maps (${this.ansichtLabel(k)})` : 'by article type';
  });
  protected ansichtLabel(v: MarkerView): string {
    return MARKER_VIEWS.find((x) => x.key === v)?.label ?? v;
  }
  protected markerAnsichtKarte(v: string): void {
    const g = this.ganz();
    if (g) void this.schreibenGanz(withMapMarkerView(g, isMarkerView(v) ? v : null));
  }
  protected markerAnsichtSetzen(relId: string, v: string): void {
    const e = this.karte();
    if (e) void this.schreiben(withMarkerView(e, relId, isMarkerView(v) ? v : null));
  }

  /**
   * **Welcher Grössen-Zustand gilt** (T-428, E-164): überlappen sich
   * mehrere, wählt die Leitung am Token (`props.sizeSource`); leer heisst
   * „der zuletzt hinzugekommene".
   */
  protected groessenWahl(to: string): SizeChoice | null {
    return this.kontext()?.targets[to]?.sizeChoice ?? null;
  }
  protected groessenQuelleSetzen(relId: string, v: string): void {
    const e = this.karte();
    if (e) void this.schreiben(setMarkerSizeSource(e, relId, v || null));
  }

  private nachZug = false;
  private griff: { id: string; to: string; sx: number; sy: number; zieht: boolean; pointer: number; von: Pt; selbst: boolean; span: number | null } | null = null;

  protected greifen(ev: PointerEvent, m: MapMarker): void {
    ev.stopPropagation();
    this.nachZug = false;
    /* **Ein Token zieht, wen die Kampagne lässt** (T-204, T-290:
       `tokenMove`, gerechnet am Server als `movable`) — auch ohne die
       Karte zu schreiben, über `POST /api/maps/:id/move`; wie, sagt die
       Kampagne (`moves`). Wer nicht leitet und bestätigen lassen muss,
       geht denselben Weg, auch wenn er die Karte schreibt. */
    /* **Assets** (T-306): in der Bearbeitung zieht, wer die Karte schreibt,
       jedes — auch mit dem Werkzeug „Asset“; unter Play nur ein
       verschiebbares, und immer über den Server (`movableAssets`), der an
       der offenen Karte schreibt (der Instanz, T-289). */
    if (m.kind === 'scenery') {
      if (ev.button !== 0 || (this.werkzeug() !== 'keins' && this.werkzeug() !== 'asset')) return;
      if (this.bearbeitung()) {
        this.griff = { id: m.rel.id, to: m.to, sx: ev.clientX, sy: ev.clientY, zieht: false, pointer: ev.pointerId, von: { x: m.x, y: m.y }, selbst: false, span: null };
      } else if (this.ort() === 'play' && m.movable && (this.kontext()?.movableAssets ?? []).includes(m.rel.id) && !this.spielersicht()) {
        this.griff = { id: m.rel.id, to: m.to, sx: ev.clientX, sy: ev.clientY, zieht: false, pointer: ev.pointerId, von: { x: m.x, y: m.y }, selbst: true, span: null };
      } else return;
      (ev.currentTarget as HTMLElement).setPointerCapture?.(ev.pointerId);
      return;
    }
    const eigen = this.ziehbarHier().includes(m.to) && !this.spielersicht();
    const selbst = eigen && (!this.darfSchreiben() || (!this.session.leitung() && this.regeln().moves === 'confirm'));
    if ((!this.darfSchreiben() && !eigen) || this.werkzeug() !== 'keins' || ev.button !== 0) return;
    /* **Im Kampf zieht der Plan** (T-198, Runde 2): Spielende bewegen ein
       Token dann nur über den Zugplan — der Server prüft dasselbe
       (`zugSperre`); die Leitung zieht weiter, mit Hinweis. */
    if (this.imKampf() && !this.kampfLeitung()) {
      this.hinweis.set('During the encounter, your token moves through the turn plan.');
      return;
    }
    const span = this.tokenPlatz(m.to, m.ownSize);
    this.griff = { id: m.rel.id, to: m.to, sx: ev.clientX, sy: ev.clientY, zieht: false, pointer: ev.pointerId, von: { x: m.x, y: m.y }, selbst, span };
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
    this.markerWahl.set(null);
    b.setPointerCapture?.(ev.pointerId);
    if (this.zeiger.size > 1) this.lupeAus();
    /* **Einen Punkt ziehen** (T-304): unter dem Finger eine Ecke, sonst schiebt es die Karte. */
    if (this.werkzeug() === 'punkte' && this.zeiger.size === 1) {
      const pt = this.punkt(ev);
      const e = this.karte();
      const ar = this.seitenverhaeltnis();
      const p = pt && e ? nearestPoint(wallPoints(mapWalls(e), ar), pt, ar, this.trefferRadius(ev.pointerType)) : null;
      if (p) {
        this.punktGriff = ev.pointerId;
        this.punktZug.set({ von: p, nach: p });
        /* Am Finger gleich mit Lupe: er deckt die Ecke zu, die er zieht. */
        if (ev.pointerType !== 'mouse') this.lupe.set(p);
        this.schwenk = null;
        return;
      }
    }
    /* **Die Lupe** (T-315): in einem Setz-Werkzeug öffnet Halten sie; Ziehen davor schiebt die Karte. */
    /* Mit der Maus keine Lupe: der Zeiger deckt nichts zu, und wer drückt und
       dann erst zieht, bekam die Lupe statt des Verschiebens — nach vielen
       Punkten liess sich die Karte so scheinbar nicht mehr ziehen. */
    if (LUPE_WERKZEUGE.has(this.werkzeug()) && this.zeiger.size === 1 && ev.pointerType !== 'mouse') {
      const start = this.punkt(ev);
      const id = ev.pointerId;
      this.lupeAus();
      this.lupeZeiger = { id, x: ev.clientX, y: ev.clientY };
      this.lupeUhr = setTimeout(() => {
        if (this.lupeZeiger?.id !== id || !start) return;
        this.schwenk = null;
        this.lupeZeigen(start, ev.altKey, ev.pointerType !== 'mouse');
      }, LUPE_MS);
    }
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
      if (pt) this.zug.set({ id: g.id, pt: g.span === null ? pt : this.aufEnde(this.tokenRasten(pt, g.span)) });
      return;
    }
    const pz = this.punktZug();
    if (pz && this.punktGriff === ev.pointerId) {
      const pt = this.punkt(ev);
      if (!pt) return;
      const f = this.einrasten(pt, ev.altKey, ev.pointerType !== 'mouse', pz.von);
      this.fang.set(f.to ? f : null);
      this.punktZug.set({ von: pz.von, nach: f.pt });
      if (this.lupe()) this.lupe.set(pt);
      return;
    }
    const lz = this.lupeZeiger;
    if (lz && lz.id === ev.pointerId) {
      if (this.lupe()) {
        const pt = this.punkt(ev);
        if (pt) this.lupeZeigen(pt, ev.altKey, ev.pointerType !== 'mouse');
        return;
      }
      /* Vor der Lupe gezogen: das ist Schieben, keine Lupe mehr. */
      if (Math.hypot(ev.clientX - lz.x, ev.clientY - lz.y) >= ZIEHEN_AB) this.lupeAus();
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
    if (this.planJetzt()?.mode === 'move' && ev.pointerType === 'mouse' && !this.zeiger.size) {
      const pt = this.punkt(ev);
      this.planZeiger.set(pt);
    }
    if (this.werkzeug() === 'messen' && this.messA() && !this.messFest() && ev.pointerType === 'mouse') {
      const pt = this.punkt(ev);
      if (pt) this.messB.set(pt);
    }
    if ((this.werkzeug() === 'wand' || this.werkzeug() === 'vieleck') && ev.pointerType === 'mouse') {
      const pt = this.punkt(ev);
      if (pt) {
        const f = this.einrasten(pt, ev.altKey, false, undefined, this.vieleckFang());
        this.fang.set(f.to ? f : null);
        if (this.werkzeug() === 'wand' && this.wandPunkte().length) this.wandZeiger.set(f.pt);
      }
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
        void this.selbstZiehen(g.id, z.pt).finally(() => {
          this.zug.set(null);
          this.amUebergang(g.id, z.pt);
        });
        return;
      }
      if (g.zieht && z) {
        this.nachZug = true;
        let neu = moveMarker(this.karte()!, g.id, z.pt);
        /* **Entlang des Weges aufdecken** (REQ-139, T-118): wer im Nebel
           geht, sieht, wo er war — mit Sperren auf der Karte, was er von
           dort sieht (`revealAlong`), sonst so breit wie der Pinsel. */
        const nat = this.nat();
        /* Ein Asset deckt nichts auf (T-306): es sieht nicht. */
        const istAsset = markersOf(this.karte()!).some((m) => m.rel.id === g.id && m.kind === 'scenery');
        if (!istAsset && this.pfadAufdecken() && this.nebelAn()) {
          neu = nat ? revealAlong(neu, [g.von, z.pt], nat, () => `s-${crypto.randomUUID()}`, g.to) : revealArea(neu, this.strichForm([g.von, z.pt], g.to));
        }
        const ausserhalb = this.imKampf() && this.kampfLeitung();
        void this.schreiben(neu).finally(() => {
          this.zug.set(null);
          if (ausserhalb && !this.mangel()) this.hinweis.set('Moved outside the plan.');
          this.amUebergang(g.id, z.pt);
        });
      }
      return;
    }
    const war = this.zeiger.size;
    this.zeiger.delete(ev.pointerId);
    const lz = this.lupeZeiger;
    if (lz && lz.id === ev.pointerId) {
      const l = this.lupe();
      this.lupeAus();
      if (l && !this.punktZug()) {
        /* Gesetzt wird, wo das Fadenkreuz steht — wie ein Antippen dort. */
        this.schwenk = null;
        this.setzenAn(l, ev);
        return;
      }
    }
    const pz = this.punktZug();
    if (pz && this.punktGriff === ev.pointerId) {
      this.lupe.set(null);
      this.punktGriff = null;
      this.punktZug.set(null);
      this.fang.set(null);
      const e = this.karte();
      if (e && (pz.von.x !== pz.nach.x || pz.von.y !== pz.nach.y)) void this.schreiben(moveWallPoint(e, pz.von, pz.nach, this.seitenverhaeltnis()));
      return;
    }
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
    if (this.lupeZeiger?.id === ev.pointerId) this.lupeAus();
    if (this.punktGriff === ev.pointerId) {
      this.punktGriff = null;
      this.punktZug.set(null);
    }
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
      const focus = this.fokus();
      const s = zoomStep({
        zoom: this.zoom(),
        direction: 1,
        children: this.kontext()?.children ?? [],
        ...(focus ? { focus } : {}),
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
    if (this.wandPunkte().length) this.wandPunkte.set([]);
    else if (this.werkzeug() !== 'keins' && this.aktiv() !== 'messen') this.waehle('keins');
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
    /* Ctrl/Cmd+Z nimmt die letzte Änderung an den Wänden zurück — nur in der Gruppe Walls. */
    if ((ev.ctrlKey || ev.metaKey) && !ev.shiftKey && ev.key.toLowerCase() === 'z' && this.aktiv() === 'waende' && this.wandRueckgaengig() && !tipptGerade(ev.target)) {
      this.wandZurueck();
      ev.preventDefault();
      return;
    }
    if (ev.defaultPrevented || ev.ctrlKey || ev.metaKey || ev.altKey || tipptGerade(ev.target)) return;
    const gemeint = this.ort() === 'play' || this.vollbild() || this.host.nativeElement.contains(document.activeElement);
    if (!gemeint) return;
    if (ev.key === 'Escape' && (this.aktiv() !== 'auswahl' || this.ersatzVollbild())) {
      this.zurueck();
      ev.preventDefault();
      return;
    }
    if (this.werkzeug() === 'wand' && ev.key === 'Backspace' && this.wandPunkte().length) {
      this.wandPunkte.set(this.wandPunkte().slice(0, -1));
      ev.preventDefault();
      return;
    }
    if (this.werkzeug() === 'vieleck' && (ev.key === 'Backspace' || (ev.key === 'Enter' && this.vieleckPunkte().length >= 3))) {
      if (ev.key === 'Enter') this.vieleckFertig();
      else this.vieleckZurueck();
      ev.preventDefault();
      return;
    }
    if (ev.key === 'Enter' && this.wandPunkte().length > 1) {
      this.wandFertig();
      ev.preventDefault();
      return;
    }
    /* Entf nimmt das gewählte Token weg (T-320). */
    if ((ev.key === 'Delete' || ev.key === 'Backspace') && this.markerWahlBild() && this.darfSchreiben()) {
      this.tokenWeg(this.markerWahl()!);
      ev.preventDefault();
      return;
    }
    if (ev.shiftKey && ev.key.toLowerCase() === 'f') {
      void this.vollbildUm();
      ev.preventDefault();
      return;
    }
    if (ev.shiftKey || ev.key.length !== 1) return;
    if (ev.key.toLowerCase() === 'i' && this.initiative()) {
      this.initiativeUm();
      ev.preventDefault();
      return;
    }
    if (ev.key.toLowerCase() === 'y') {
      this.seiteUm();
      ev.preventDefault();
      return;
    }
    const g = this.gruppen().find((x) => x.taste.toLowerCase() === ev.key.toLowerCase());
    if (!g) return;
    this.gruppeWaehlen(g.key);
    ev.preventDefault();
  }

  // ------------------------------------------------------------ Werkzeuge

  /** Die Gruppen, die dieser Betrachter in der Leiste hat. */
  protected readonly gruppen = computed(() =>
    GRUPPEN.filter(
      (g) =>
        !g.spaeter &&
        (g.key !== 'zug' || this.zugplan()) &&
        (!g.leitung || this.darfSchreiben()) &&
        (g.key !== 'ebenen' || this.darfSchreiben() || this.ebenen().length > 1) &&
        (!g.braucht || g.braucht.some((t) => this.werkzeuge().has(t))),
    ),
  );
  /**
   * **Die Werkzeuge dieser Kartenart** (T-320, `Campaign.mapTools`): die
   * Leitung stellt sie an der Kampagne ein. Was schon auf der Karte gilt,
   * bleibt bearbeitbar — Nebel, der an ist, und eine Karte, die nicht hell
   * ist —, sonst liesse er sich nicht mehr aufdecken.
   */
  protected readonly werkzeuge = computed<ReadonlySet<MapToolGroup>>(() => {
    const t = new Set<MapToolGroup>(this.kontext()?.tools ?? MAP_TOOL_GROUPS.map((g) => g.key));
    if (this.nebelAn()) t.add('fog');
    if (this.helligkeit() !== 'bright') t.add('light');
    /* Eine Karte im Spiel verlinkt keine Unterkarten — das tut ihre Vorlage. */
    if (this.istInstanz()) t.delete('frames');
    return t;
  });
  protected readonly kartenArt = computed(() => mapKindOf(this.karte()));
  protected readonly WERKZEUG_GRUPPEN = MAP_TOOL_GROUPS;
  /** Das Blatt „Tools for … maps“ (T-320) an der Leiste. */
  protected readonly werkzeugBlatt = signal(false);
  protected readonly werkzeugSpeichert = signal(false);
  /** Was die Kampagne für diese Art eingestellt hat — ohne die Ausnahmen oben. */
  protected readonly werkzeugEingestellt = computed(() => new Set(this.kontext()?.tools ?? []));
  /** Eine Gruppe für diese Kartenart ein- oder ausschalten — an der Kampagne, wie „Movement“ (T-290). */
  protected async werkzeugSetzen(g: MapToolGroup, an: boolean): Promise<void> {
    const id = this.kontext()?.campaign;
    if (!id || this.werkzeugSpeichert()) return;
    this.werkzeugSpeichert.set(true);
    this.bewegungFehler.set(null);
    try {
      const { refs: _r, fromTemplate: _f, ...k } = (await this.api.entity(id)) as Entity & { refs?: unknown; fromTemplate?: unknown };
      await this.api.putEntity(withMapTool(k as Entity, this.kartenArt(), g, an));
      await this.kontextHolen(this.id());
    } catch (err) {
      this.bewegungFehler.set(err instanceof Error ? `The setting could not be saved: ${err.message}` : 'The setting could not be saved.');
    } finally {
      this.werkzeugSpeichert.set(false);
    }
  }
  protected readonly aktiv = signal<Gruppe>('auswahl');
  /** Der Plan zählt nur, solange sein Werkzeug gewählt ist (T-325) — sonst tut ein Antippen, was das Werkzeug sagt. */
  protected readonly planJetzt = computed(() => (this.aktiv() === 'zug' && this.zugplan() ? this.planung() : null));
  /** Titel eines Werkzeugs mit seinem Kürzel; die Ebenen nennen, welche gerade gezeigt wird. */
  protected gruppenTitel(g: GruppenDef): string {
    const t = g.key === 'ebenen' && this.ebenen().length > 1 ? `Floor: ${this.ebeneName(this.ebene())} — ${g.title}` : g.title;
    return `${t} (${g.taste})`;
  }
  /** Ein Werkzeug von aussen öffnen — Play, wenn der Zugplaner eine Frage hat. */
  werkzeugOeffnen(g: 'zug'): void {
    if (this.aktiv() !== g) this.gruppeWaehlen(g);
  }
  /**
   * **Der Tracker als Panel** (T-325): am Desktop offen, am Telefon zu —
   * dort deckte er die halbe Karte. Gewählt wird je Schirm.
   */
  private readonly initiativeWahl = signal<boolean | null>(null);
  protected readonly initiativeOffen = computed(() => this.initiativeWahl() ?? !this.schmal());
  protected initiativeUm(): void {
    this.initiativeWahl.set(!this.initiativeOffen());
  }
  private readonly schmal = signal(typeof matchMedia === 'function' && matchMedia('(max-width: 640px)').matches);
  /** Nur die Symbole: die Leiste schmal, mehr Karte. */
  protected readonly leisteZu = signal(false);

  /** Eine Gruppe wählen; dieselbe noch einmal führt zurück zur Auswahl. */
  protected gruppeWaehlen(g: Gruppe): void {
    const neu = this.aktiv() === g ? 'auswahl' : g;
    if (this.aktiv() === 'gitter' && neu !== 'gitter' && this.gitterEntwurf()) {
      if (confirm('Save the grid you set? Cancel discards it.')) this.gitterSpeichern();
      else this.gitterEntwurf.set(null);
    }
    this.aktiv.set(neu);
    this.waehle('keins');
    this.werkzeug.set(neu === 'messen' ? 'messen' : neu === 'notizen' ? 'notiz' : 'keins');
  }

  protected readonly werkzeug = signal<Werkzeug>('keins');
  protected waehle(w: Werkzeug): void {
    this.werkzeug.set(this.werkzeug() === w ? 'keins' : w);
    this.messA.set(null);
    this.messB.set(null);
    this.messFest.set(false);
    this.setzenBei.set(null);
    this.notizBei.set(null);
    this.setzenZiel.set(null);
    this.setzenArt.set('static');
    this.assetWahl.set(null);
    this.strich.set(null);
    this.wandPunkte.set([]);
    this.wandZeiger.set(null);
    this.zelleA.set(null);
    this.punktZug.set(null);
    this.fang.set(null);
    this.vieleckPunkte.set([]);
  }

  private antippen(ev: PointerEvent): void {
    const pt = this.punkt(ev);
    if (pt) this.setzenAn(pt, ev);
  }

  /** Was ein Antippen an `pt` tut — auch das Loslassen in der Lupe (T-315). */
  private setzenAn(pt: Pt, ev: { altKey: boolean; pointerType: string }): void {
    if (this.planJetzt()?.mode === 'move') {
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
    } else if (this.werkzeug() === 'platzieren') {
      const v = this.zuPlatzieren().find((x) => x.rel === this.platzWahl());
      if (v) void this.platzBestaetigen(v, pt);
    } else if (this.werkzeug() === 'notiz') {
      this.notizBei.set(pt);
      /* Das Blatt steht unter der Karte — am Telefon hinter der Leiste.
         Also in den Blick holen und gleich schreiben lassen. */
      setTimeout(() => {
        const feld = this.host.nativeElement.querySelector<HTMLTextAreaElement>('.notiz-blatt textarea');
        feld?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        feld?.focus({ preventScroll: true });
      });
    } else if (this.werkzeug() === 'setzen') {
      const ziel = this.setzenZiel();
      if (ziel) this.spielTokenSetzen(ziel, pt);
      else this.setzenBei.set(pt);
    } else if (this.werkzeug() === 'wand') {
      this.wandPunkt(this.einrasten(pt, ev.altKey, ev.pointerType !== 'mouse').pt);
    } else if (this.werkzeug() === 'wandArt') {
      const e = this.karte();
      const w = this.sperreBei(pt);
      if (e && w) void this.schreiben(setWallKind(e, w.id, this.wandArt()));
    } else if (this.werkzeug() === 'wandWeg') {
      const e = this.karte();
      const w = this.sperreBei(pt);
      if (!e || !w) return;
      /* Zusammenfügen ist ein Angebot (T-304): vielleicht war die Öffnung gewollt. */
      const ar = this.seitenverhaeltnis();
      const tol = this.schnittToleranz();
      const fuegen = canJoinAround(e, w.id, ar, tol) && confirm('Join the wall again across the opening?');
      void this.schreiben(fuegen ? removeJoined(e, w.id, ar, tol) : removeWall(e, w.id));
    } else if (this.werkzeug() === 'gitterUrsprung') {
      const nat = this.nat();
      const s = this.einst();
      if (nat && s) this.gitterAendern({ ...gridOrigin(pt, nat, s.gridSize), ...(s.gridShape === 'none' ? { gridShape: 'square' as const } : {}) });
    } else if (this.werkzeug() === 'gitterZelle') {
      const a = this.zelleA();
      const nat = this.nat();
      if (!a || !nat) {
        this.zelleA.set(pt);
        return;
      }
      this.zelleA.set(null);
      const g = gridFromCell(a, pt, nat);
      if (!g) {
        this.hinweis.set('The two corners are too close — tap opposite corners of one square.');
        return;
      }
      if (g.gridSize) this.groesseBasis.set(g.gridSize);
      this.gitterAendern({ ...g, ...(this.einst()?.gridShape === 'none' ? { gridShape: 'square' as const } : {}) });
    } else if (this.werkzeug() === 'licht') {
      this.lichtSetzen(pt);
    } else if (this.werkzeug() === 'uebergang') {
      this.uebergangTippen(pt);
    } else if (this.werkzeug() === 'uebergangFlaeche') {
      this.flaecheTippen(pt);
    } else if (this.werkzeug() === 'vieleck') {
      /* Einrasten wie an den Wänden, dazu an die Ecken der übrigen Formen. */
      this.vieleckTippen(this.einrasten(pt, ev.altKey, ev.pointerType !== 'mouse', undefined, this.vieleckFang()).pt);
    } else if (this.werkzeug() === 'schloss') {
      const t = this.tueren().find((x) => x.id === this.sperreBei(pt, isDoor)?.id);
      if (t) void this.tuerKlick(t);
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
    const m = measure(s, this.nat(), a, b);
    return { a, b, text: [m.text, ...this.messAnderswo(s.scale, m.distance, a, b)].filter(Boolean).join(' · '), m };
  });

  /**
   * **Dieselbe Strecke in der Einheit einer anderen Karte** (T-329): in
   * einer Unterkarte die der Karte darüber („≈ 0,2 mi on Region“), in der
   * Karte darüber die einer Unterkarte, wenn beide Enden in ihrem Bereich
   * liegen. Umgerechnet über die Massstäbe (`convertDistance`); passt eine
   * Einheit nicht („1 day“), steht nichts da.
   */
  private messAnderswo(scale: string, distance: number | null, a: Pt, b: Pt): string[] {
    if (distance === null) return [];
    const k = this.kontext();
    const eigen = parseScale(scale)?.unit ?? '';
    const out: string[] = [];
    const sag = (ziel: string, name: string) => {
      const u = parseScale(ziel)?.unit ?? '';
      if (!u || u === eigen) return;
      const d = convertDistance(distance, scale, ziel);
      if (d !== null) out.push(`≈ ${rundText(d)} ${u} on ${name}`);
    };
    if (k?.up) sag(k.up.scale, k.up.name);
    const drin = (k?.children ?? []).find((c) => [a, b].every((p) => p.x >= c.frame.x && p.x <= c.frame.x + c.frame.w && p.y >= c.frame.y && p.y <= c.frame.y + c.frame.h));
    if (drin?.scale) sag(drin.scale, drin.name);
    return out;
  }

  // ---------------------------------------------- Weg über Karten (T-329)

  /**
   * **Ein Weg über mehrere Karten** (T-329, Grundlage für Reisen, T-177):
   * gemessene Stücke sammeln, auch nach einem Sprung in eine andere Karte —
   * die Gesamtstrecke steht in der Einheit der Karte, auf der man gerade
   * ist. Gezählt wird in Fuss; ein Stück ohne Länge im Massstab („1 day“)
   * zählt nicht und wird genannt. Nur auf dieser Seite, nicht gespeichert.
   */
  protected readonly weg2 = signal<{ name: string; feet: number | null; text: string }[]>([]);
  protected wegStueck(): void {
    const m = this.messung();
    const s = this.einst();
    if (!m || !s || m.m.distance === null) return;
    const f = feetPerScaleUnit(s.scale);
    const name = this.name() || 'this map';
    this.weg2.update((w) => [...w, { name, feet: f ? m.m.distance! * f : null, text: m.m.text }]);
  }
  protected readonly wegSumme = computed(() => {
    const w = this.weg2();
    if (!w.length) return null;
    const s = this.einst();
    const feet = w.reduce((n, x) => n + (x.feet ?? 0), 0);
    const ohne = w.filter((x) => x.feet === null).length;
    const scale = s?.scale ?? '5 ft';
    const u = parseScale(scale)?.unit ?? 'ft';
    const d = feetToScaleUnit(feet, scale);
    const summe = d !== null ? `${rundText(d)} ${u}` : `${rundText(feet)} ft`;
    return `${w.length} ${w.length === 1 ? 'leg' : 'legs'} · ${summe}${ohne ? ` (${ohne} without a length scale not counted)` : ''}`;
  });

  // ------------------------------------------------------------ Zugplan

  /** Das Raster des Plans und wo das Token gerade steht (T-198); nur auf Quadraten. */
  protected readonly planRaster = computed(() => {
    const plan = this.planJetzt();
    const s = this.einst();
    const e = this.angezeigt();
    if (!plan || !s || !e) return null;
    const geo = gridGeometry(s, this.nat());
    if (!geo) return null;
    const ms = markersOf(e);
    const grid = planGrid(geo, ms, plan.rel ?? '', blockingWalls(e, this.nat()), { passable: plan.passable ?? [], terrain: plan.terrain ?? [] });
    if (!grid) return null;
    const ich = ms.find((m) => m.rel.id === plan.rel);
    const token = ich ? tokenCell(geo, grid, ich) : null;
    const start = plan.from ?? token;
    return start ? { geo, grid, start, token } : null;
  });

  /**
   * **Wie weit ein Ziel steht** (T-391): vom Ende der geplanten Bewegung
   * (`pr.start`) bis zum nächsten Feld, das sein Token belegt — ein 3 × 3-
   * Drache, den die Figur berührt, steht 5 ft weit, nicht 10 ft bis zur
   * Mitte. Steht die Figur noch, zählt auch ihr eigener Platz. Dieselbe
   * Rechnung wie der Server (`abstandImPlan`).
   */
  private planWeite(pr: { geo: GridGeometry; start: Cell; token: Cell | null }, m: MapMarker): number {
    const plan = this.planJetzt();
    /* Roh aus der Karte, nicht `marker()`: das ruft diese Rechnung selbst auf. */
    const ich = plan ? markersOf(this.angezeigt() ?? ({} as Entity)).find((x) => x.rel.id === plan.rel) : undefined;
    const steht = !!ich && !!pr.token && pr.token.x === pr.start.x && pr.token.y === pr.start.y;
    const von = steht ? ich! : cellPoint(pr.geo, pr.start);
    return feetBetweenTokens(pr.geo, von, steht ? this.tokenPlatz(ich!.to, ich!.ownSize) : 1, m, this.tokenPlatz(m.to, m.ownSize));
  }

  /** Wohin das Tempo reicht, als Felder — einmal je Plan, nicht je Zeichnen. */
  private readonly planReich = computed(() => {
    const plan = this.planJetzt();
    const pr = this.planRaster();
    if (!plan || plan.mode !== 'move' || !pr || plan.budget <= 0) return {} as Record<string, number>;
    return planReach(pr.grid, pr.start, plan.budget);
  });

  /** Die Farbe schwierigen Geländes im Bereich (T-349); am Element, weil das Stylesheet der Karte am Budget steht. */
  protected readonly ZAEH = 'rgba(150, 110, 60, 0.32)';

  private readonly planZeiger = signal<Pt | null>(null);

  /** Der Weg zu einem Punkt, wenn er ins übrige Tempo passt. */
  private wegZu(pt: Pt): { path: Cell[]; feet: number; to: Pt } | null {
    const plan = this.planJetzt();
    const pr = this.planRaster();
    if (!plan || !pr) return null;
    const c = cellAt(pr.geo, pt);
    if (!(cellKey(c) in this.planReich()) || (c.x === pr.start.x && c.y === pr.start.y)) return null;
    const w = planPath(pr.grid, pr.start, c, plan.budget);
    return w ? { ...w, to: cellPoint(pr.geo, c) } : null;
  }

  /** Was die Überlagerung zeichnet: Reichweite, Wege, Vorschau, Ring und das Token am Ende. */
  protected readonly planBild = computed(() => {
    const plan = this.planJetzt();
    const pr = this.planRaster();
    if (!plan || !pr) return null;
    const { geo } = pr;
    const fw = geo.size / geo.w;
    const fh = geo.size / geo.h;
    /* Schwieriges Gelände ist im Bereich erdfarben gezeichnet (T-349). */
    const zaeh = pr.grid.cost ?? {};
    const reach = Object.keys(this.planReich()).map((k) => {
      const [x, y] = k.split(',').map(Number) as [number, number];
      return { k, x: (geo.ox + x * geo.size) / geo.w, y: (geo.oy + y * geo.size) / geo.h, w: fw, h: fh, zaeh: (zaeh[k] ?? 1) > 1 };
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
    const warnungen = opportunityAttacks(folge, drohen, geo.cellFeet).map((p) => {
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

  // ------------------------------------------------------ Notizen (T-214)

  /** Wo die neue Notiz hinkommt; `null`: noch nicht getippt. */
  protected readonly notizBei = signal<Pt | null>(null);
  protected readonly notizText = signal('');
  /** Wer sie sieht — die Leitung oder auch die Spielenden (`Visibility.audience`). */
  protected readonly notizFuer = signal<'gm' | 'players'>('gm');
  protected readonly notizSpeichert = signal(false);

  /**
   * **Eine Notiz anlegen** (E-070 a): ein Artikel `Note` mit dem Text als
   * Beschreibung und der Stufe der Sichtbarkeit, fertig (`ready`), damit
   * die Spielenden eine für sie sehen; dann ein Marker auf ihn. Der Name
   * ist der Anfang des Textes. Zurückgehalten wird am Server: eine Notiz
   * nur für die Leitung kommt mit ihrem Marker bei Spielenden nicht an.
   */
  protected async notizAnlegen(): Promise<void> {
    const pt = this.notizBei();
    const text = this.notizText().trim();
    if (!pt || !text || this.notizSpeichert()) return;
    this.notizSpeichert.set(true);
    try {
      const notiz = await this.api.createEntity('Note', noteName(text), {
        'Description.description': text,
        'Visibility.audience': this.notizFuer(),
        'Status.status': 'ready',
      });
      const e = this.karte();
      if (e) await this.schreiben(addMarker(e, notiz.id, pt, `r-${crypto.randomUUID()}`));
      this.notizBei.set(null);
      this.notizText.set('');
      /* Zurück auf die Leitung: eine Notiz, die versehentlich an alle geht,
         verrät mehr, als eine zu wenig gezeigte verschweigt. */
      this.notizFuer.set('gm');
    } catch (err) {
      this.hinweis.set(err instanceof Error ? err.message : 'The note could not be saved.');
    } finally {
      this.notizSpeichert.set(false);
    }
  }
  protected readonly schonDa = computed(() => new Set([this.id(), ...markersOf(this.karte() ?? ({} as Entity)).map((m) => m.to)]));

  protected setzen(ziel: Entity): void {
    const e = this.karte();
    const pt = this.setzenBei();
    if (!e || !pt) return;
    this.setzenBei.set(null);
    this.werkzeug.set('keins');
    /* Ein Asset rastet nicht (es liegt, wie man es hinlegt) und ist fix (T-306). */
    if (this.setzenArt() === 'scenery') {
      const id = `r-${crypto.randomUUID()}`;
      void this.schreiben(addMarker(e, ziel.id, pt, id, 'scenery'));
      this.setzenArt.set('static');
      this.werkzeug.set('asset');
      this.assetWahl.set(id);
      return;
    }
    void this.schreiben(addMarker(e, ziel.id, this.tokenRasten(pt, this.tokenPlatz(ziel.id, null)), `r-${crypto.randomUUID()}`));
  }

  // ------------------------------------------------------ Assets (T-306)

  /** Was „Add marker“ setzt: einen Marker oder ein Asset (`scenery`). */
  protected readonly setzenArt = signal<'static' | 'scenery'>('static');
  /** Nur die Karte selbst ist ausgeschlossen: dieselbe Kiste darf zehnmal dastehen. */
  protected readonly nurKarte = computed<ReadonlySet<string>>(() => new Set([this.id()]));
  /** Die Sperrarten, die ein Asset halten kann — alle ausser Türen. */
  protected readonly ASSET_SPERREN = WALL_KINDS.filter((k) => !k.door);
  /**
   * **Bearbeitung oder Spiel** (T-306): auf der Seite der Karte wird sie
   * vorbereitet — jedes Asset zieh-, dreh- und skalierbar; unter Play
   * bewegt sich nur, was `movable` ist.
   */
  protected readonly bearbeitung = computed(() => this.ort() === 'artikel' && this.darfSchreiben() && !this.spielersicht());
  protected readonly assetWahl = signal<string | null>(null);
  protected readonly gewaehltesAsset = computed(() => {
    const id = this.assetWahl();
    return id ? (this.marker().find((m) => m.rel.id === id && m.kind === 'scenery') ?? null) : null;
  });
  protected assetSetzen(): void {
    const an = this.werkzeug() === 'setzen' && this.setzenArt() === 'scenery';
    this.waehle(an ? 'setzen' : 'keins');
    if (an) return this.setzenArt.set('static');
    this.werkzeug.set('setzen');
    this.setzenArt.set('scenery');
  }
  protected assetWaehlen(m: MapMarker): void {
    if (m.kind === 'scenery') this.assetWahl.set(m.rel.id);
  }
  protected assetSetzenProp(relId: string, patch: Record<string, unknown>): void {
    const e = this.karte();
    if (e) void this.schreiben(setAssetProps(e, relId, patch));
  }

  // ------------------------------------------------- Tokens am Gitter (T-317)

  /** Wie viele Felder ein Token einnimmt: am Token, sonst nach Statblock und Kampagne. */
  private tokenPlatz(to: string, own: number | null): number {
    return tokenSpan(own, this.kontext()?.targets[to]?.size, this.regeln().tokenSizes);
  }

  /**
   * **Woher die Grösse eines Tokens kommt** (T-390, REQ-396): Statblock →
   * Wirkungen → am Token gesetzt. „Huge · statblock“, „Large · Enlarged
   * (Medium)“, „2 × 2 · set on token“ — im Tooltip und unter „Token size“.
   */
  protected groesseText(to: string, own: number | null): string {
    const z = this.kontext()?.targets[to];
    const g = tokenSizeOf(own, z?.size, null, this.regeln().tokenSizes);
    const gross = (w: string | null | undefined) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : '');
    const felder = `${g.span} × ${g.span}`;
    if (g.from === 'token') return `${felder} · set on token`;
    /* Überlappen sich Grössen-Zustände (T-428): welche übergangen sind, und ohne Wahl der Hinweis. */
    const wahl = z?.sizeChoice;
    const dazu = [
      z?.sizePassed?.length ? `over ${z.sizePassed.join(', ')}` : '',
      wahl && !wahl.chosen ? `${wahl.options.length} size effects — choose` : '',
    ].filter(Boolean).map((t) => ` · ${t}`).join('');
    if (z?.sizeFrom === 'effects') {
      const via = z.sizeVia?.length ? z.sizeVia.join(', ') : 'an effect';
      return `${gross(z.size)} ${felder} · ${via}${z.baseSize ? ` (statblock ${gross(z.baseSize)})` : ''}${dazu}`;
    }
    if (g.from === 'statblock') return `${gross(g.size)} ${felder} · statblock${dazu}`;
    return `${felder} · no size on the statblock`;
  }

  /** Ein Token einrasten, wenn die Karte es sagt (`Map.snapTokens`) und ein Gitter hat. */
  private tokenRasten(pt: Pt, span: number): Pt {
    const s = this.einst();
    if (!s?.snapTokens) return pt;
    return snapTokenCentre(pt, gridGeometry(s, this.nat()), span);
  }

  protected readonly TOKEN_SPANS = TOKEN_SPANS;
  /** Die Grösse, die „Size“ an ein angetipptes Token gibt; `null`: wieder nach Statblock. */
  protected readonly groesseWahl = signal<number | null>(null);
  /** Was „Token size“ an jedem Token ergäbe (T-320): ein gestricheltes Quadrat. */
  protected readonly groessenVorschau = computed(() => {
    const s = this.einst();
    if (this.werkzeug() !== 'tokenGroesse' || !s) return [];
    const f = this.faktor();
    const wahl = this.groesseWahl();
    return this.marker()
      .filter((m) => m.kind !== 'scenery' && m.kind !== 'light')
      .map((m) => ({ id: m.rel.id, x: m.x, y: m.y, px: s.gridSize * (wahl ?? this.tokenPlatz(m.to, null)) * f, text: this.groesseText(m.to, m.ownSize) }));
  });
  protected groesseGeben(relId: string): void {
    const e = this.karte();
    if (e) void this.schreiben(setMarkerSize(e, relId, this.groesseWahl()));
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
  protected blockSetzen(ids: readonly string[], vorbereiten?: string): void {
    const e = this.karte();
    const s = this.einst();
    const n = this.nat();
    if (!e || !s || !ids.length) return;
    const sicht = this.sichtbar();
    const mitte = sicht ? { x: sicht.x + Math.min(sicht.w, 1) / 2, y: sicht.y + Math.min(sicht.h, 1) / 2 } : { x: 0.5, y: 0.5 };
    const schritt = n ? s.gridSize / n.w : 0.05;
    void this.schreiben(placeTokens(e, ids, mitte, schritt, this.seitenverhaeltnis(), () => `r-${crypto.randomUUID()}`, vorbereiten));
  }

  // -------------------------------------------------------- Seitenleiste

  /**
   * Offen oder zu, für diesen Schirm; ohne Wahl zu — auch unter Play
   * (T-325, „die Seite hat zu viel, das sie auf einmal anzeigt“): das
   * Panel klappt aus der Leiste auf.
   */
  private readonly seiteWahl = signal<boolean | null>(null);
  protected readonly seiteOffen = computed(() => this.seiteWahl() ?? false);
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
    const saum = this.saum();
    b.scrollLeft = m.x * this.breite() - b.clientWidth / 2 + saum.x;
    b.scrollTop = m.y * h - b.clientHeight / 2 + saum.y;
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
    if (e) void this.schreiben(addMarker(e, id, this.tokenRasten(pt, this.tokenPlatz(id, null)), `r-${crypto.randomUUID()}`, 'play'));
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

  // ------------------------------------------------------------ Sperren

  protected readonly WALL_KINDS = WALL_KINDS;
  /** Welche Art „Draw“ zeichnet und „Set kind“ setzt (T-118). */
  protected readonly wandArt = signal<WallKind>('wall');
  protected readonly wandArtName = computed(() => wallKind(this.wandArt()).label.toLowerCase());
  /** Der Linienzug, der gerade gezeichnet wird — gespeichert erst mit „Finish“. */
  protected readonly wandPunkte = signal<Pt[]>([]);
  private readonly wandZeiger = signal<Pt | null>(null);

  protected wandArtWaehlen(k: string): void {
    this.wandArt.set(wallKind(k).key);
  }

  // ---------------------------------------------- Karteneditor (T-304)

  /** Form, Schalter und Stärke des Editors, gemerkt je Browser. */
  protected readonly ed = new EditorStand();
  protected readonly STAERKE_MIN = STAERKE_MIN;
  protected readonly STAERKE_MAX = STAERKE_MAX;
  protected readonly GRID_SHAPES: readonly GridShape[] = ['none', 'square', 'hex'];
  protected readonly SCALE_PRESETS = SCALE_PRESETS;
  /** „1 hex = 6 mi" — der Massstab der gezeigten Ebene (T-321). */
  protected readonly massstabText = computed(() => {
    const s = this.einst();
    return s ? scaleLabel(s) : '';
  });
  protected readonly wandIstTuer = computed(() => wallKind(this.wandArt()).door);
  protected readonly formDef = computed(() => drawShape(this.ed.formFuer(this.wandArt())));
  /** Woran der Zeiger gerade einrastet — ein Ring an der Stelle. */
  protected readonly fang = signal<{ pt: Pt; to: string | null } | null>(null);
  /** Der Punkt, der gerade gezogen wird, und wohin. */
  protected readonly punktZug = signal<{ von: Pt; nach: Pt } | null>(null);
  private punktGriff: number | null = null;
  // ---------------------------------------------------------- Lupe (T-315)

  /** Wo das Fadenkreuz der Lupe steht; `null`: keine Lupe. */
  protected readonly lupe = signal<Pt | null>(null);
  private lupeUhr: ReturnType<typeof setTimeout> | null = null;
  private lupeZeiger: { id: number; x: number; y: number } | null = null;

  private lupeZeigen(pt: Pt, roh: boolean, finger: boolean): void {
    this.lupe.set(pt);
    if (this.werkzeug() === 'wand') {
      const f = this.einrasten(pt, roh, finger, undefined, this.vieleckFang());
      this.fang.set(f.to ? f : null);
      if (this.wandPunkte().length) this.wandZeiger.set(f.pt);
    }
  }

  private lupeAus(): void {
    if (this.lupeUhr) clearTimeout(this.lupeUhr);
    this.lupeUhr = null;
    this.lupeZeiger = null;
    if (this.lupe()) {
      this.lupe.set(null);
      this.fang.set(null);
    }
  }

  /**
   * **Was die Lupe zeigt:** das Kartenbild und das Gitter, `LUPE_ZOOM` mal
   * grösser, um das Fadenkreuz — dazu Sperren, Entwurf und Einrastring als
   * SVG im Ausschnitt. Über dem Finger, am oberen Rand darunter.
   */
  protected readonly lupeBild = computed(() => {
    const p = this.lupe();
    const b = this.breite();
    const h = this.hoehe();
    const bild = this.grundbild();
    if (!p || !h || !bild) return null;
    const W = b * LUPE_ZOOM;
    const H = h * LUPE_ZOOM;
    const cx = p.x * W - LUPE_R;
    const cy = p.y * H - LUPE_R;
    const g = this.gitterMuster(this.faktor() * LUPE_ZOOM);
    const ebenen = [...(g ? [g.bild] : []), `url("${this.adresse(bild)}")`];
    /* Ein Quadratgitter sind zwei Verläufe in einer Angabe: Grösse und Lage brauchen je zwei. */
    const groessen = [...(g ? g.bild.startsWith('linear') ? [g.groesse, g.groesse] : [g.groesse] : []), `${W}px ${H}px`];
    const lagen = [...(g ? (g.bild.startsWith('linear') ? [0, 1] : [0]).map(() => `${g.ox - cx}px ${g.oy - cy}px`) : []), `${-cx}px ${-cy}px`];
    const wx = (2 * LUPE_R) / W;
    const wy = (2 * LUPE_R) / H;
    const f = this.fang();
    return {
      stil: {
        'background-image': ebenen.join(', '),
        'background-size': groessen.join(', '),
        'background-position': lagen.join(', '),
        'background-repeat': [...ebenen.slice(0, -1).flatMap((e) => (e.startsWith('linear') ? ['repeat', 'repeat'] : ['repeat'])), 'no-repeat'].slice(-groessen.length).join(', '),
      },
      viewBox: `${p.x - wx / 2} ${p.y - wy / 2} ${wx} ${wy}`,
      unten: p.y * h < 2 * LUPE_R + 60,
      x: p.x,
      y: p.y,
      ring: f ? { cx: f.pt.x, cy: f.pt.y, rx: 7 / W, ry: 7 / H } : null,
      d: 2 * LUPE_R,
    };
  });

  /** Die erste Ecke beim Abgreifen eines Feldes. */
  protected readonly zelleA = signal<Pt | null>(null);
  /** Das Gitter, wie es gerade eingestellt wird — Vorschau, bis „Save grid“. */
  protected readonly gitterEntwurf = signal<GridPatch | null>(null);

  protected formWaehlen(k: string): void {
    this.ed.setzen('form', drawShape(k).key);
    this.wandPunkte.set([]);
  }

  /** So weit trifft ein Antippen einen Punkt; ein Finger weiter als die Maus. */
  private trefferRadius(pointerType: string): number {
    return (SPERRE_TREFFER * (pointerType === 'mouse' ? 1 : FINGER_FAKTOR)) / this.breite();
  }

  /** Wie nah eine Öffnung an der Geraden einer Wand liegen muss, um sie zu schneiden: ein paar Bildschirmpunkte. */
  private schnittToleranz(): number {
    return Math.max(0.0005, 4 / this.breite());
  }

  /**
   * **Einrasten mit Stärke** (T-304, `snapPoint`): an vorhandene Punkte,
   * Gitterecken und Linien, so weit, wie der Regler sagt — in Bildschirm-
   * punkten, also beim Zoomen gleich. `roh` (Alt, langes Drücken) setzt
   * den Punkt, wo er ist; `ohne` ist der Punkt, der gerade gezogen wird.
   */
  private einrasten(pt: Pt, roh: boolean, finger: boolean, ohne?: Pt, dazu: readonly Pt[] = []): { pt: Pt; to: 'point' | 'grid' | 'line' | null } {
    if (roh || !this.ed.einrasten()) return { pt, to: null };
    const s = this.einst();
    const geo = s ? gridGeometry(s, this.nat()) : null;
    const e = this.karte();
    const ar = this.seitenverhaeltnis();
    const gleich = (q: Pt): boolean => !!ohne && q.x === ohne.x && q.y === ohne.y;
    const walls = (e ? mapWalls(e) : []).filter((w) => !gleich({ x: w.x1, y: w.y1 }) && !gleich({ x: w.x2, y: w.y2 }));
    const punkte = [...wallPoints(e ? mapWalls(e) : [], ar), ...this.wandPunkte(), ...dazu].filter((q) => !gleich(q));
    const px = this.ed.staerke() * (finger ? FINGER_FAKTOR : 1);
    return snapPoint(pt, { grid: geo, points: punkte, walls }, px / this.breite(), ar);
  }

  protected readonly wandText = computed(() => {
    const n = this.wandPunkte().length;
    const f = this.formDef();
    if (!n) return this.wandIstTuer() ? 'Tap one edge of the opening, then the other — the door spans it.' : `Tap where the ${this.wandArtName()} starts.`;
    if (f.points === 2) return f.key === 'line' ? 'Tap the end point.' : 'Tap the opposite corner.';
    return 'Tap the next point — Enter, or the last point again, finishes; Esc cancels.';
  });

  /** Die Grösse, um die der feine Regler schwingt (±10 %): fest, solange man an ihm zieht (T-314). */
  private readonly groesseBasis = signal<number | null>(null);
  protected readonly groesseSpanne = computed(() => {
    const b = this.groesseBasis() ?? this.karteGroesse();
    return { min: Math.max(4, Math.round(b * 0.9 * 100) / 100), max: Math.round(b * 1.1 * 100) / 100 };
  });
  private readonly karteGroesse = computed(() => {
    const e = this.karte();
    return e ? mapSettings(e).gridSize : 70;
  });

  /** Ein Schritt mit den Pfeilen; Umschalt macht ihn zehnmal so gross. */
  protected gitterSchritt(feld: 'gridSize' | 'gridOffsetX' | 'gridOffsetY', d: number, ev: MouseEvent): void {
    const s = this.einst();
    if (!s) return;
    const neu = Math.round((s[feld] + d * (ev.shiftKey ? 10 : 1)) * 100) / 100;
    this.gitterAendern({ [feld]: feld === 'gridSize' ? Math.max(4, neu) : neu });
    /* Läuft die Grösse aus dem Regler, wandert er mit. */
    const sp = this.groesseSpanne();
    if (feld === 'gridSize' && (neu < sp.min || neu > sp.max)) this.groesseBasis.set(neu);
  }

  /** Eine getippte oder abgegriffene Grösse setzt auch die Mitte des feinen Reglers. */
  protected gitterGroesseTippen(v: number): void {
    if (!(v >= 4)) return;
    this.groesseBasis.set(v);
    this.gitterAendern({ gridSize: v });
  }

  /** Das Gitter einstellen — erst als Vorschau. */
  protected gitterAendern(patch: GridPatch): void {
    const sauber = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined && !(typeof v === 'number' && !Number.isFinite(v))));
    this.gitterEntwurf.set({ ...(this.gitterEntwurf() ?? {}), ...sauber });
  }

  protected gitterSpeichern(): void {
    const e = this.karte();
    const d = this.gitterEntwurf();
    if (!e || !d) return;
    void this.schreiben(setGrid(e, d)).then(() => {
      if (!this.mangel()) {
        this.gitterEntwurf.set(null);
        this.groesseBasis.set(null);
      }
    });
  }

  /** Die Sperre unter dem Finger, wenn eine nah genug liegt. */
  private sperreBei(pt: Pt, nur?: (w: MapWall) => boolean): MapWall | null {
    const e = this.karte();
    if (!e) return null;
    return nearestWall(mapWalls(e), pt, this.seitenverhaeltnis(), SPERRE_TREFFER / this.breite(), nur);
  }

  /** Ein Punkt mehr in der Form; derselbe noch einmal beendet sie. Linie, Rechteck und Ellipse sind nach zwei fertig. */
  private wandPunkt(p: Pt): void {
    const ps = this.wandPunkte();
    const letzter = ps.at(-1);
    if (letzter && Math.hypot(letzter.x - p.x, (letzter.y - p.y) * this.seitenverhaeltnis()) < SPERRE_TREFFER / this.breite()) {
      this.wandFertig();
      return;
    }
    this.wandPunkte.set([...ps, p]);
    if (this.formDef().points === 2 && ps.length + 1 >= 2) this.wandFertig();
  }

  /** Den Linienzug speichern: je Strecke eine Sperre der gewählten Art. */
  protected wandFertig(): void {
    const e = this.karte();
    const ps = this.wandPunkte();
    this.wandPunkte.set([]);
    this.wandZeiger.set(null);
    if (!e || ps.length < 2) return;
    const kind = this.wandArt();
    const nat = this.nat();
    const s = this.einst();
    /* Die Dicke einer Tür in Anteilen der Breite: ein Teil eines Feldes, ohne Gitter die Vorgabe. */
    const dicke = wallKind(kind).door ? (nat && s && s.gridShape !== 'none' ? (s.gridSize * this.ed.tuerDicke()) / 100 / nat.w : DOOR_WIDTH) : undefined;
    const neueId = (): string => `w-${crypto.randomUUID().slice(0, 12)}`;
    const neu = outlineWalls(shapeOutline(this.ed.formFuer(kind), ps, this.ed.geschlossen()), kind, neueId, dicke);
    if (!neu.length) return;
    const r = addWallsCut(e, neu, { cut: this.ed.schneiden(), ar: this.seitenverhaeltnis(), tol: this.schnittToleranz(), newId: neueId });
    void this.schreiben(r.entity).then(() => {
      if (r.cut && !this.mangel()) this.hinweis.set(r.cut === 1 ? 'The wall underneath was cut at the opening.' : `${r.cut} walls underneath were cut at the opening.`);
    });
  }

  /** Was die Leitung von den Sperren sieht: jede Linie, nach Art gefärbt, dazu der Entwurf. */
  protected readonly sperrenBild = computed(() => {
    const e = this.karte();
    if (!e || !this.nat() || !this.alsLeitung()) return null;
    const ar = this.seitenverhaeltnis();
    /* Ein Punkt, der gerade gezogen wird, nimmt seine Wände mit (Vorschau, T-304). */
    const pz = this.punktZug();
    const walls = pz ? mapWalls(moveWallPoint(e, pz.von, pz.nach, ar)) : mapWalls(e);
    const linien = walls.map((w) => {
      const offen = isDoor(w) && w.state === 'open';
      return { ...w, offen, titel: `${wallKind(w.kind).label}${isDoor(w) ? ` (${w.state ?? 'closed'})` : ''} — ${wallKind(w.kind).does}` };
    });
    const ps = this.wandPunkte();
    const z = this.wandZeiger();
    let entwurf: { pts: string; zu: boolean } | null = null;
    if (ps.length) {
      const roh = [...ps, ...(z ? [z] : [])];
      const form = this.ed.formFuer(this.wandArt());
      const fest = drawShape(form).points === 2;
      const u = fest && roh.length >= 2 ? shapeOutline(form, roh, false) : { pts: roh, closed: shapeOutline(form, roh, this.ed.geschlossen()).closed };
      if (u.pts.length) entwurf = { pts: u.pts.map((p) => `${p.x},${p.y}`).join(' '), zu: u.closed };
    }
    const zeigen = this.ed.punkte() || this.werkzeug() === 'punkte';
    const punkte = zeigen ? wallPoints(walls, ar) : [];
    return linien.length || entwurf || punkte.length ? { linien, entwurf, punkte } : null;
  });

  /**
   * **Die Türen** (T-118): ein Knopf an ihrer Mitte, quer zur Tür. Für
   * Spielende kommen nur die, die der Server schickt (`redactWalls`) — sie
   * öffnen eine in der Auswahl, wenn die Kampagne es erlaubt
   * (`Campaign.doors`); ob ihre Figur daneben steht, prüft der Server.
   */
  protected readonly tueren = computed(() => {
    const e = this.angezeigt();
    const nat = this.nat();
    if (!e || !nat) return [];
    const ar = nat.h / nat.w;
    const w = this.werkzeug();
    const lt = this.alsLeitung();
    const darf = lt || (this.regeln().doors === 'players' && this.eigeneHier().length > 0 && !this.spielersicht());
    const planWaehlt = (this.planJetzt()?.mode ?? 'idle') !== 'idle';
    return mapWalls(e)
      .filter(isDoor)
      .map((t) => {
        const state: DoorState = t.state ?? 'closed';
        /* Im Zugplan wählt ein Antippen Weg oder Ziel; sonst ist eine Tür ein Knopf. */
        const klickbar = (w === 'keins' && darf && !planWaehlt) || (lt && w === 'schloss');
        const tun = !klickbar ? '' : w === 'schloss' ? (state === 'locked' ? ' — tap to unlock' : ' — tap to lock') : state === 'open' ? ' — tap to close' : ' — tap to open';
        /* **Die Tür als Viereck** (T-304): so lang wie die Öffnung, so dick wie ihre Breite — gross genug für einen Finger. */
        const b = this.breite();
        return {
          id: t.id,
          kind: t.kind,
          state,
          x: (t.x1 + t.x2) / 2,
          y: (t.y1 + t.y2) / 2,
          lang: Math.max(14, Math.hypot(t.x2 - t.x1, (t.y2 - t.y1) * ar) * b),
          dick: Math.max(10, (t.width ?? DOOR_WIDTH) * b),
          winkel: (Math.atan2((t.y2 - t.y1) * ar, t.x2 - t.x1) * 180) / Math.PI,
          klickbar,
          titel: `${wallKind(t.kind).label}, ${state}${tun}`,
        };
      });
  });

  /** Eine Tür schalten — über den Server, der auch aufdeckt, was dahinter liegt. */
  protected async tuerKlick(t: { id: string; state: DoorState; klickbar: boolean }): Promise<void> {
    if (!t.klickbar || this.speichert()) return;
    const state: DoorState = this.werkzeug() === 'schloss' ? (t.state === 'locked' ? 'closed' : 'locked') : t.state === 'open' ? 'closed' : 'open';
    const nat = this.nat();
    this.mangel.set(null);
    this.hinweis.set(null);
    this.speichert.set(true);
    try {
      await this.api.door(this.id(), { wall: t.id, state, ...(nat ? { nat } : {}) });
      await this.bestand.oeffnen(this.id(), true, false);
      await this.kontextHolen(this.id());
    } catch (err) {
      this.hinweis.set(err instanceof Error ? err.message : 'The door did not move.');
    } finally {
      this.speichert.set(false);
    }
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
    if (w === 'rahmen') {
      this.rahmenNeu.set(k);
      this.rahmenZiel.set(null);
      void this.kartenLaden();
      return;
    }
    if (w === 'aufdecken') void this.schreiben(revealArea(e, { id: `s-${crypto.randomUUID()}`, kind: 'rect', ...k, ...(fuer ? { for: fuer } : {}) }));
    else if (w === 'zudecken') void this.schreiben(coverArea(e, k));
  }

  // ------------------------------------------------------- Unterkarten (T-320)

  /** Der gezogene Rahmen, bis eine Karte gewählt ist. */
  protected readonly rahmenNeu = signal<{ x: number; y: number; w: number; h: number; area?: Array<[number, number]> } | null>(null);
  protected readonly rahmenZiel = signal<string | null>(null);
  protected readonly rahmenSpeichert = signal(false);
  protected readonly rahmenFehler = signal<string | null>(null);
  private readonly karten = signal<{ id: string; name: string; kind?: string }[]>([]);
  /** Was in den Rahmen darf: jede Karte ausser dieser und denen darüber — sonst ein Kreis. */
  protected readonly rahmenWahl = computed(() => {
    const raus = new Set([this.id(), ...(this.kontext()?.parents ?? []).map((p) => p.id)]);
    return this.karten()
      .filter((k) => !raus.has(k.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  });
  private async kartenLaden(): Promise<void> {
    if (this.karten().length) return;
    try {
      this.karten.set((await this.api.maps()).maps.map((k) => ({ id: k.id, name: k.name, ...(k.kind ? { kind: k.kind } : {}) })));
    } catch {
      this.rahmenFehler.set('The maps could not be loaded.');
    }
  }
  /**
   * **Eine Karte in den Rahmen** — geschrieben wird an der Unterkarte: ihre
   * Kante `insideMap` mit dem Rahmen (Kanten nur vorwärts). Eine Karte
   * liegt in genau einer; eine alte Kante wird ersetzt.
   */
  protected async rahmenVerlinken(): Promise<void> {
    const f = this.rahmenNeu();
    const ziel = this.rahmenZiel();
    if (!f || !ziel || this.rahmenSpeichert()) return;
    await this.unterkarteSchreiben(ziel, (rel) => [
      ...rel.filter((r) => r.type !== INSIDE_MAP_RELATION),
      {
        id: `${ziel}~insideMap-${Date.now().toString(36)}`,
        type: INSIDE_MAP_RELATION,
        to: this.id(),
        props: { x: r4(f.x), y: r4(f.y), w: r4(f.w), h: r4(f.h), ...(f.area ? { area: f.area } : {}) },
      },
    ]);
    this.rahmenNeu.set(null);
  }
  /**
   * **Kein Absprung, solange ein Werkzeug läuft** (T-327): ein Rahmen ist ein
   * Link. Mit *Unlink* angetippt, sprang die Seite in die Unterkarte, bevor
   * die Verknüpfung gelöst war; mit *Link shape* oder beim Messen landete der
   * Punkt im Rahmen statt auf der Karte. Hinein geht es nur in der Auswahl.
   */
  protected readonly absprungGesperrt = computed(() => this.werkzeug() !== 'keins');
  /** Rahmen lassen Antippen zur Karte durch — ausser *Unlink*, das sie antippt. */
  protected readonly rahmenDurch = computed(() => this.absprungGesperrt() && this.werkzeug() !== 'rahmenWeg');
  protected async rahmenLoesen(ev: Event, id: string, name: string): Promise<void> {
    ev.preventDefault();
    if (!confirm(`Unlink ${name}? The map stays; it is just no longer inside this one.`)) return;
    await this.unterkarteSchreiben(id, (rel) => rel.filter((r) => !(r.type === INSIDE_MAP_RELATION && r.to === this.id())));
  }
  // ------------------------------------------- Verknüpfung einstellen (T-327)

  protected readonly MAP_LINK_SHOWS = MAP_LINK_SHOWS;
  protected readonly MAP_LINK_SHOW_LABELS = MAP_LINK_SHOW_LABELS;
  /** Die Verknüpfungen, die die Leitung einstellen darf — der Server schickt `own` nur ihr. */
  protected readonly verknuepfungen = computed(() => (this.kontext()?.children ?? []).filter((k) => !!k.own));
  protected readonly linkWahl = signal<string | null>(null);
  protected readonly linkOffen = computed(() => {
    const k = this.verknuepfungen().find((x) => x.id === this.linkWahl());
    if (!k) return null;
    const own: MapLink['own'] = k.own ?? {};
    return {
      id: k.id,
      vorlage: k.template ?? k.id,
      name: k.name,
      own,
      form: !!k.area,
      align: !!k.align,
      /* Ohne Länge in einem der Massstäbe („1 day“) lässt sich nicht ausrichten — gesperrt mit Grund. */
      sperre: feetPerScaleUnit(this.einst()?.scale ?? '') && feetPerScaleUnit(k.scale ?? '') ? null : ALIGN_ISSUE_TEXT.units,
      issue: k.alignIssue ? ALIGN_ISSUE_TEXT[k.alignIssue as AlignIssue] : null,
      nearProzent: Math.round((k.near ?? MAP_NEAR) * 100),
      /* Wie viel sie den Blick jetzt füllt (T-327) — dieselbe Rechnung wie der Zoomschritt. */
      jetzt: Math.min(1, Math.round(frameShare(k.frame, this.nat(), this.zoom(), this.fenster()) * 100) / 100),
      jetztProzent: Math.min(100, Math.round(frameShare(k.frame, this.nat(), this.zoom(), this.fenster()) * 100)),
      vorgabe: this.kontext()?.linkDefaults ?? { show: 'jump' as MapLinkShow, showPlayers: 'jump' as MapLinkShow, outer: 'none' as const },
    };
  });
  /**
   * **Eine Verknüpfung einstellen**: geschrieben an der Kante `insideMap`
   * der Unterkarte. `null` nimmt eine Angabe weg — dann gilt die Kampagne
   * bzw. das Rechteck. Eine Zoomtiefe gleich der Vorgabe ist keine Angabe.
   */
  protected async linkSetzen(l: { vorlage: string }, patch: Record<string, unknown>): Promise<void> {
    await this.unterkarteSchreiben(l.vorlage, (rel) =>
      rel.map((r) => {
        if (r.type !== INSIDE_MAP_RELATION) return r;
        const props = { ...((r.props ?? {}) as Record<string, unknown>) };
        for (const [k, v] of Object.entries(patch)) {
          if (v === null || v === '' || (k === 'near' && Math.abs(Number(v) - MAP_NEAR) < 0.001)) delete props[k];
          else if (k === 'near') props[k] = Math.max(LINK_NEAR_MIN, Math.min(1, Number(v)));
          else if (k === 'area' && Array.isArray(v)) {
            const b = polyBox(v as Array<[number, number]>);
            Object.assign(props, { area: v, x: r4(b.x), y: r4(b.y), w: r4(b.w), h: r4(b.h) });
          } else props[k] = v;
        }
        return { ...r, props };
      }),
    );
  }

  // ------------------------------------------ Freies Vieleck (T-327, T-326)

  /**
   * **Ein Vieleck antippen**: Ecke um Ecke, die erste noch einmal (oder
   * „Done") schliesst es. Dieselbe Form für den Bereich einer Verknüpfung
   * und die Fläche eines Übergangs — beides `[[x, y], …]` in Anteilen.
   */
  protected readonly vieleckPunkte = signal<Pt[]>([]);
  protected readonly vieleckFuer = signal<
    { art: 'neu' } | { art: 'link'; id: string } | { art: 'uebergang'; relId: string; seite: 'area' | 'toArea' } | null
  >(null);
  protected vieleckBeginnen(f: NonNullable<ReturnType<typeof this.vieleckFuer>>): void {
    if (this.werkzeug() === 'vieleck') this.werkzeug.set('keins');
    this.waehle('vieleck');
    this.vieleckFuer.set(f);
    this.rahmenNeu.set(null);
  }
  protected readonly vieleckVorschau = computed(() => {
    if (this.werkzeug() !== 'vieleck') return null;
    const p = this.vieleckPunkte();
    return p.length ? p.map((q) => `${q.x},${q.y}`).join(' ') : null;
  });
  /**
   * **Woran ein Vieleck einrastet** (T-327): die Ecken der Formen, die an
   * dieser Karte schon hängen, und die eigenen — zwei Bezirke teilen so
   * ihre Grenze, statt dass eine Lücke oder ein Streifen doppelt bleibt.
   */
  protected readonly vieleckFang = computed<Pt[]>(() => {
    if (this.werkzeug() !== 'vieleck') return [];
    const fremde = (this.kontext()?.children ?? []).flatMap((k) => (k.area ?? []).map(([x, y]) => ({ x, y })));
    return [...fremde, ...this.vieleckPunkte()];
  });
  /** Die Ecken, die gerade entstehen: die erste schliesst, darum hervorgehoben. */
  protected readonly vieleckEcken = computed(() =>
    this.werkzeug() === 'vieleck' ? this.vieleckPunkte().map((p, i) => ({ ...p, erste: i === 0 && this.vieleckPunkte().length >= 3 })) : [],
  );
  /** Die letzte Ecke zurücknehmen. */
  protected vieleckZurueck(): void {
    this.vieleckPunkte.set(this.vieleckPunkte().slice(0, -1));
  }
  private vieleckTippen(pt: Pt): void {
    const p = this.vieleckPunkte();
    const erste = p[0];
    const h = this.hoehe() ?? this.breite();
    if (erste && p.length >= 3 && Math.hypot((pt.x - erste.x) * this.breite(), (pt.y - erste.y) * h) < SPERRE_TREFFER) {
      this.vieleckFertig();
      return;
    }
    this.vieleckPunkte.set([...p, pt]);
  }
  protected vieleckFertig(): void {
    const p = this.vieleckPunkte();
    const f = this.vieleckFuer();
    this.waehle('keins');
    this.vieleckFuer.set(null);
    if (p.length < 3 || !f) return;
    const poly = p.map((q) => [r4(q.x), r4(q.y)] as [number, number]);
    const b = polyBox(poly);
    if (b.w < 0.002 || b.h < 0.002) {
      this.hinweis.set('The shape is too small.');
      return;
    }
    if (f.art === 'neu') {
      this.aktiv.set('unterkarten');
      this.rahmenNeu.set({ ...b, area: poly });
      this.rahmenZiel.set(null);
      void this.kartenLaden();
    } else if (f.art === 'link') {
      const l = this.verknuepfungen().find((k) => k.id === f.id);
      if (l) void this.linkSetzen({ vorlage: l.template ?? l.id }, { area: poly });
    } else {
      const g = this.ganz();
      if (g) void this.schreibenGanz(withPassageArea(g, f.relId, f.seite, poly));
    }
  }

  private async unterkarteSchreiben(id: string, neu: (rel: Relation[]) => Relation[]): Promise<void> {
    this.rahmenSpeichert.set(true);
    this.rahmenFehler.set(null);
    try {
      const { refs: _r, fromTemplate: _f, ...k } = (await this.api.entity(id)) as Entity & { refs?: unknown; fromTemplate?: unknown };
      await this.api.putEntity({ ...(k as Entity), relations: neu(k.relations ?? []) });
      await this.kontextHolen(this.id());
    } catch (err) {
      this.rahmenFehler.set(err instanceof Error ? `Not saved: ${err.message}` : 'Not saved.');
    } finally {
      this.rahmenSpeichert.set(false);
    }
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
      if (s.kind === 'poly') return { ...leer, tag: 'polygon', pts: auf(s.pts), ...(s.within ? { clip: auf(s.within) } : {}) };
      return { ...leer, tag: 'polyline', r: s.r, pts: auf(s.pts) };
    });
    const st = this.strich();
    if (st && this.werkzeug() === 'pinsel') {
      formen.push({ id: '__strich', tag: 'polyline', x: 0, y: 0, w: 0, h: 0, r: this.pinselRadius(), pts: auf(st.pts.map((p) => [p.x, p.y] as const)) });
    }
    return { ar, formen, deckt: this.alsLeitung() ? 0.5 : 1 };
  });
  // ------------------------------------------------------------- Licht

  protected readonly LIGHTING_LEVELS = LIGHTING_LEVELS;
  /** Wie hell die Karte ist (`Map.lighting`, T-216). */
  protected readonly helligkeit = computed<LightLevel>(() => {
    const e = this.karte();
    return e ? mapLighting(e) : 'bright';
  });
  protected helligkeitSetzen(wert: string): void {
    const e = this.karte();
    if (e && (LIGHTING_LEVELS as readonly string[]).includes(wert)) void this.schreiben(setLighting(e, wert as LightLevel));
  }
  /** Was das Werkzeug „Light source“ setzt, in Feldern. */
  protected readonly lichtHell = signal(4);
  protected readonly lichtMatt = signal(8);
  /** Einem Marker Licht geben (`marker.props.light`/`dim`); 0 und 0 nimmt es weg. */
  /** Getragene Lichter in Fuss je Markerziel (T-305): Fackel in der Hand, Laterne als Marker. */
  protected readonly getragen = computed(() => this.kontext()?.lights ?? {});
  /** Ein Licht aus- oder wieder anmachen (T-305, `lightOff`); ohne Licht tut es nichts. */
  protected lichtSchalten(relId: string): void {
    const e = this.karte();
    const m = e ? markersOf(e).find((x) => x.rel.id === relId) : undefined;
    if (!e || !m) return;
    if (!markerHasLight(m, this.getragen())) {
      this.hinweis.set('This marker sheds no light. Give it one with Light source, or an item with Bright light.');
      return;
    }
    void this.schreiben(setLightOff(e, relId, !lightIsOff(m.rel.props as Record<string, unknown> | undefined)));
  }
  /** Einen Marker wegnehmen (T-301) — die Kante, nicht den Artikel. */
  protected tokenWeg(relId: string): void {
    const e = this.karte();
    if (this.markerWahl() === relId) this.markerWahl.set(null);
    if (e) void this.schreiben(removeMarker(e, relId));
  }

  protected lichtGeben(relId: string): void {
    const e = this.karte();
    if (!e) return;
    const hell = Math.max(0, this.lichtHell());
    const matt = Math.max(0, this.lichtMatt());
    /* Ein freies Licht ohne Radius ist nichts mehr (T-320). */
    if (!hell && !matt && markersOf(e).some((m) => m.rel.id === relId && m.kind === 'light')) {
      void this.schreiben(removeMarker(e, relId));
      return;
    }
    const relations = (e.relations ?? []).map((r) => {
      if (r.id !== relId) return r;
      const { light: _l, dim: _d, ...rest } = (r.props ?? {}) as Record<string, unknown>;
      return { ...r, props: { ...rest, ...(hell ? { light: hell } : {}), ...(matt ? { dim: matt } : {}) } };
    });
    void this.schreiben({ ...e, relations });
  }

  /**
   * **Ein Licht frei setzen** (T-320): wer mit „Light source“ neben jedes
   * Token tippt, setzt eine Lichtquelle ohne Artikel (`addLight`) — vorher
   * tat das nichts, und ein Licht gab es nur an einem Marker.
   */
  private lichtSetzen(pt: Pt): void {
    const e = this.karte();
    const hell = Math.max(0, this.lichtHell());
    const matt = Math.max(0, this.lichtMatt());
    if (!e) return;
    if (!hell && !matt) {
      this.hinweis.set('Set Bright or Dim above 0 to place a light.');
      return;
    }
    void this.schreiben(addLight(e, pt, `r-${crypto.randomUUID()}`, hell, matt));
  }
  /**
   * **Wie weit die Lichter reichen** (T-320) — für die Leitung, solange die
   * Gruppe „Light“ offen ist: ein Kreis je Licht, innen hell, aussen
   * dämmrig, ohne Sperren. Auf einer hellen Karte sähe man sonst nichts.
   */
  protected readonly lichtKreise = computed(() => {
    const e = this.angezeigt();
    const n = this.nat();
    if (!e || !n || this.aktiv() !== 'licht' || !this.alsLeitung()) return [];
    const ar = this.seitenverhaeltnis() || 1;
    return mapLights(e, n, this.getragen()).map((l) => ({ id: l.id, x: l.x, y: l.y, hw: l.bright * 2, hh: (l.bright * 2) / ar, dw: l.dim * 2, dh: (l.dim * 2) / ar }));
  });

  /**
   * **Wessen Sicht gezeichnet wird** (T-216, T-305): für Spielende die
   * eigenen Figuren; in der Spielersicht der Leitung die gewählte Figur,
   * sonst die Spielercharaktere. Das Gruppen-Token nur, wenn keine Figur
   * dasteht. Die Leitung selbst sieht alles.
   */
  private readonly betrachter = computed<Set<string>>(() => {
    if (this.alsLeitung()) return new Set();
    /* Alle Ebenen (T-307): wer oben auf der Treppe steht, sieht auch hier. */
    const e = this.angezeigtGanz();
    const marker = e ? markersOf(e) : [];
    const gruppe = marker.filter((m) => m.kind === 'party').map((m) => m.to);
    /* **Die Sicht gilt den Spielertokens** (T-305, die Leitung 20.10.):
       gerechnet wird aus den Figuren der Spielenden; das Gruppen-Token
       zählt nur, solange keine davon auf der Karte steht — sonst sähe die
       Gruppe von einem Punkt aus, an dem niemand steht. */
    const oderGruppe = (figuren: string[]): Set<string> => new Set(figuren.length ? figuren : gruppe);
    if (this.spielersicht() && this.darfSchreiben()) {
      const fuer = this.nebelFuer();
      if (fuer) return new Set([fuer]);
      const ziele = this.kontext()?.targets ?? {};
      return oderGruppe(marker.filter((m) => m.kind === 'play' && ziele[m.to]?.type === 'PlayerCharacter').map((m) => m.to));
    }
    return oderGruppe(this.eigeneHier());
  });
  /** Was jede dieser Figuren gerade sieht — am Token, wie es eben gezogen wird. */
  private readonly sichten = computed(() => {
    const e = this.angezeigt();
    const n = this.nat();
    const wer = this.betrachter();
    if (!e || !n || !wer.size) return [];
    const dv = this.kontext()?.darkvision ?? {};
    const hier = this.marker()
      .filter((m) => wer.has(m.to) && (m.kind === 'play' || m.kind === 'party'))
      .map((m) => figureView(e, m, n, dv[m.to] ?? 0, this.getragen()));
    /* **Sicht über Übergänge** (T-307): wer auf einer anderen Ebene auf
       einer Treppe steht, durch die man sieht, sieht hier ab ihrem
       Gegenstück — mit den Sperren und im Massstab dieser Ebene. */
    const ganz = this.angezeigtGanz();
    const drueben = ganz ? sightInto(ganz, this.ebene()).filter((x) => wer.has(x.to)) : [];
    return [...hier, ...drueben.map((x) => figureView(e, x.from, n, dv[x.to] ?? 0, this.getragen()))];
  });
  /**
   * **Die Dunkelheit** (T-216, REQ-140): auf einer dämmrigen oder dunklen
   * Karte eine Schicht unter dem Nebel; helles Licht schneidet sie ganz
   * heraus, Dämmerlicht und die Dunkelsicht der eigenen Figur zur Hälfte.
   * Die Leitung sieht durch.
   */
  protected readonly schatten = computed(() => {
    const e = this.angezeigt();
    const n = this.nat();
    if (!e || !n) return null;
    const stufe = mapLighting(e);
    if (stufe === 'bright') return null;
    const ar = this.seitenverhaeltnis();
    const lt = this.alsLeitung();
    const auf = (p: ReadonlyArray<readonly [number, number]>) => p.map(([x, y]) => [x, y * ar] as const);
    const licht = litAreas(e, n, this.getragen());
    const dunkelsicht = this.sichten().flatMap((v) => (v.darkvision ? [v.darkvision] : []));
    return {
      ar,
      farbe: DUNKEL_FARBE,
      deckt: stufe === 'dark' ? (lt ? 0.42 : 0.94) : lt ? 0.2 : 0.5,
      schnitte: [
        { formen: [...licht.map((l) => auf(l.dim)), ...dunkelsicht.map(auf)], staerke: 0.5 },
        { formen: licht.map((l) => auf(l.bright)), staerke: 1 },
      ],
    };
  });
  /**
   * **Dunkelsicht in Graustufen** (T-305, REQ-140): auf einer dunklen Karte
   * ist, was nur die Dunkelsicht der eigenen Figur erreicht, ohne Farbe;
   * was ein Licht erhellt, bleibt farbig. Die Leitung sieht die Karte, wie
   * sie ist — in der Spielersicht (und „View as") sieht sie es wie die
   * Spielenden.
   */
  protected readonly grau = computed(() => {
    const e = this.angezeigt();
    const n = this.nat();
    if (!e || !n || mapLighting(e) !== 'dark') return null;
    const sicht = this.sichten().flatMap((v) => (v.darkvision ? [v.darkvision] : []));
    if (!sicht.length) return null;
    const ar = this.seitenverhaeltnis();
    const auf = (p: ReadonlyArray<readonly [number, number]>) => p.map(([x, y]) => [x, y * ar] as const);
    return { ar, sicht: sicht.map(auf), lichter: litAreas(e, n, this.getragen()).map((l) => auf(l.dim)) };
  });
  /**
   * **Die laufende Sicht** (T-216, wie Owlbears „Dynamic Fog“): auf einer
   * Karte mit Nebel hell, was die eigene Figur gerade sieht; das einmal
   * Aufgedeckte gedämpft. Ohne Figur auf der Karte nichts — dann bleibt das
   * Aufgedeckte hell wie bisher.
   *
   * **Auch ohne Nebel endet die Sicht an der Wand** (T-305): hält auf der
   * Karte etwas den Blick, oder ist sie dunkel, deckt die Schicht für
   * Spielende alles ausserhalb dessen, was ihre Figuren gerade sehen —
   * dann gibt es kein Gedächtnis, also fast ganz zu. Ein Licht hinter einer
   * geschlossenen Tür bleibt so dunkel.
   */
  protected readonly laufendeSicht = computed(() => {
    const e = this.angezeigt();
    const v = this.sichten();
    if (!e || !v.length) return null;
    const nebelAn = fogOn(e);
    if (!nebelAn && !hasSightWalls(e) && mapLighting(e) !== 'dark') return null;
    const ar = this.seitenverhaeltnis();
    const auf = (p: ReadonlyArray<readonly [number, number]>) => p.map(([x, y]) => [x, y * ar] as const);
    return {
      ar,
      farbe: nebelAn ? NEBEL_FARBE : DUNKEL_FARBE,
      deckt: nebelAn ? 0.55 : 0.94,
      schnitte: [
        {
          formen: v.flatMap((x) => x.seen.filter((a) => !a.within).map((a) => auf(a.pts))),
          geklammert: v.flatMap((x) => x.seen.flatMap((a) => (a.within ? [{ pts: auf(a.pts), clip: auf(a.within) }] : []))),
          staerke: 1,
        },
      ],
    };
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
    const asset = markersOf(e).some((m) => m.rel.id === rel && m.kind === 'scenery');
    if (asset || this.regeln().moves !== 'confirm') this.entwurf.set(this.voll(moveMarker(e, rel, to)));
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
  private async schreiben(e: Entity, merken = true): Promise<void> {
    /* **Die Wände vorher merken** (Rückgängig): nur, wenn sich an ihnen etwas
       ändert, und nur die Wände — ein Rückgängig der ganzen Karte nähme
       Tokens zurück, die inzwischen jemand anderes gezogen hat. */
    const vorher = this.karte();
    if (merken && vorher) {
      const alt = JSON.stringify(mapWalls(vorher));
      if (alt !== JSON.stringify(mapWalls(e))) {
        this.wandVerlauf.set([...this.wandVerlauf(), { ebene: this.ebene(), walls: JSON.parse(alt) as unknown[] }].slice(-30));
      }
    }
    return this.schreibenGanz(this.voll(e));
  }
  /** Die letzten Stände der Wände, je Ebene — für *Undo* (Ctrl/Cmd+Z). Nur in dieser Seite. */
  protected readonly wandVerlauf = signal<{ ebene: string; walls: unknown[] }[]>([]);
  protected readonly wandRueckgaengig = computed(() => this.wandVerlauf().some((v) => v.ebene === this.ebene()));
  /** Die letzte Änderung an den Wänden dieser Ebene zurücknehmen. */
  protected wandZurueck(): void {
    const k = this.karte();
    const liste = this.wandVerlauf();
    const i = liste.map((v) => v.ebene).lastIndexOf(this.ebene());
    if (!k || i < 0) return;
    const alt = liste[i]!;
    this.wandVerlauf.set([...liste.slice(0, i), ...liste.slice(i + 1)]);
    const map = { ...((k.components?.['Map'] ?? {}) as Record<string, unknown>), walls: alt.walls };
    void this.schreiben({ ...k, components: { ...k.components, Map: map } }, false);
  }
  /** Die ganze Karte schreiben — Ebenen und Übergänge (T-307). */
  private async schreibenGanz(e: Entity): Promise<void> {
    /* **Nichts geht verloren, während gespeichert wird** (T-320): zwei
       Tokens schnell hintereinander wegnehmen nahm nur das erste — das
       zweite Schreiben fiel still weg. Jetzt wartet der letzte Stand (er
       baut auf dem Entwurf auf, enthält also beide Änderungen) und geht
       danach mit der Revision, die das erste Schreiben hinterliess. */
    this.entwurf.set(e);
    if (this.speichert()) {
      this.wartet = e;
      return;
    }
    this.mangel.set(null);
    this.speichert.set(true);
    let naechstes: Entity | null = e;
    let basis = untracked(() => this.gespeichert());
    while (naechstes) {
      /* Wovon die Änderung ausging (T-399): weist der Server ab, führt
         `Brett.schreiben` zusammen, statt sie wegzuwerfen. */
      const fehler = await this.brett.schreiben(naechstes, basis);
      this.mangel.set(fehler);
      naechstes = this.wartet;
      this.wartet = null;
      if (naechstes && fehler) naechstes = null;
      const rev = this.gespeichert()?.revision;
      if (naechstes && rev !== undefined) naechstes = { ...naechstes, revision: rev };
      basis = untracked(() => this.gespeichert());
    }
    this.entwurf.set(null);
    this.speichert.set(false);
  }
  /** Der Stand, der nach dem laufenden Schreiben geht (T-320). */
  private wartet: Entity | null = null;
}

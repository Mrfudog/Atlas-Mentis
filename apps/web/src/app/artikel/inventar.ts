import { Component, ElementRef, Injectable, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  grabAnchor,
  defaultAnchor,
  placeByAnchor,
  type GrabAnchor,
  assembleCarry,
  carryFieldValue,
  carrySheetOf,
  coins,
  containerShape,
  entityName,
  filled,
  firstFreeSpot,
  fitsAt,
  insideOf,
  inventoryImageOf,
  isUnstowed,
  itemShape,
  loadStage,
  moveHeld,
  parseContainerTemplate,
  pieceInShape,
  pieceZone,
  reserve,
  reservedFor,
  shapeChiral,
  sizeFactor,
  slotsUsed,
  type GridPiece,
  type InventoryFrame,
  type Shape,
  zoneMap,
  applyWield,
  dropProps,
  handChecks,
  handCost,
  handSummary,
  heldDetail,
  heldPlaceOf,
  primaryInterface,
  stowProps,
  stowSpots,
  typeChain,
  wieldOptions,
  wieldPlan,
  wieldTargetLabel,
  type DisplaceTo,
  type HandPlace,
  type HeldItem,
  type WieldOption,
  type WieldPlan,
  DND_COINS,
  formatMoney,
} from '@nw/model';
import type { Entity, Relation } from '@nw/model';
import { FigurDaten } from '../bogen/daten';
import { Api, ApiError, type InventarLage, type VerkaufsAngebote } from '../kern/api';
import { zonenFarbe as farbeDerZone } from '../kern/zonenfarbe';
import { Bestand } from '../kern/bestand';
import { KurzLink } from '../kern/kurzansicht';
import { Session } from '../kern/session';
import { Wahl } from './wahl';
import { bildAdresse } from './bild';
import { formBildStil, maskenStil } from '../kern/formbild';

/** Warum der Server Wegwerfen, Verkaufen oder Zurücklegen ablehnt (T-407) — englisch, der Code steht in der Antwort. */
const ABGELEHNT: Record<string, string> = {
  missing: 'That piece is no longer here — reloaded.',
  reserved: 'That piece is reserved for a crafting order — release it first.',
  notEmpty: 'Something is still inside — empty the container first.',
  tooFew: 'There aren’t that many.',
  noPrice: 'Nobody trades without a price.',
  notBought: 'This shop doesn’t buy that — try another shop.',
  changed: 'The inventory changed since — put it back by hand.',
  undone: 'Already put back.',
};

/** Die Griffweiten an `holds.props.tier`, in der Reihenfolge des Registers. */
const TIERS = ['held', 'worn', 'belt', 'pack', 'ground', 'stored'];
const REGELN: Record<InventarLage['rules'], string> = { grid: 'Grid', weight: 'Weight', slots: 'Slots' };
/** Was die Kampagne mit Unverstautem tut (T-140) — als Satz über dem Bereich. */
const VERSTAUEN: Record<NonNullable<InventarLage['stowing']>, string> = {
  anytime: 'Lying in front of them — stow it whenever you like.',
  bySessionEnd: 'Stow it before the session ends, or it is left behind.',
  immediately: 'Stow it now — when the table moves on, it is left behind.',
};

/**
 * **Regelset und Gruppen der laufenden Kampagne** (T-127), einmal geholt
 * und von jedem Inventar der Seite geteilt — auch den verschachtelten.
 */
@Injectable({ providedIn: 'root' })
export class InventarLageDienst {
  private readonly api = inject(Api);
  private readonly _lage = signal<InventarLage | null>(null);
  readonly lage = this._lage.asReadonly();
  private lauf: Promise<void> | null = null;

  laden(neu = false): Promise<void> {
    if (neu) this.lauf = null;
    this.lauf ??= this.api
      .inventory()
      .then((l) => this._lage.set(l))
      .catch(() => this._lage.set({ campaign: null, rules: 'grid', parties: [] }));
    return this.lauf;
  }
}

/** Ein Stapel im Inventar: die Kante `holds` und was der Gegenstand dazu sagt. */
interface Stueck extends GridPiece {
  kante: Relation;
  item: string;
  name: string;
  qty: number;
  tier: string;
  slot: string;
  weight: number | null;
  stackSize: number | null;
  /** Für wen reserviert (T-128) — dann wandert es nicht. */
  reserviert: string | null;
  /** Trägt der Gegenstand selbst ein Inventar, ist er ein Behälter. */
  behaelter: string | null;
  /** Noch nicht verstaut (T-140, `holds.props.unstowed`). */
  offen: boolean;
  farbe: string;
  /** Das Bild in der Form (T-142): das Inventarbild des Gegenstands, sonst sein Bild. */
  bild: { asset: string; frame: InventoryFrame } | null;
  /** Lohnt Spiegeln? Nur bei einer Form, die gespiegelt keine Drehung ihrer selbst ist. */
  chiral: boolean;
}

interface Ziel {
  id: string;
  label: string;
}

/**
 * **Das Inventar** (T-127, REQ-064, 065, 183) — an der Figur, an der Gruppe
 * und auf seiner eigenen Seite. Was darin liegt, sind die `holds`-Kanten
 * des Inventars; **die Lage steht an der Kante** (`gx`, `gy`, `rot`,
 * `slot`), nicht am Gegenstand, denn derselbe Bogen liegt hier quer und
 * dort längs (CLAUDE.md „Die Drehung eines Stücks steht an der Kante").
 *
 * Wie gezählt wird, sagt die Kampagne (`Campaign.inventory`,
 * `inventoryRulesOf`): im **Raster** nach Basils Blatt, nach **Gewicht**
 * mit Tragestufen, oder nach **Slots**. Das Raster ist die Form des
 * Behälters (`Inventory.grid`), sonst das Tragraster aus Grösse und
 * Statblock, sonst das Rechteck der Einstellungen; die Zonen sagen je
 * Feld, was es kostet, etwas von dort zu holen (CLAUDE.md „Ein Behälter
 * hat seine eigene Form und seine eigenen Zonen").
 *
 * Gerechnet wird in `packages/model` (`fitsAt`, `moveHeld`, `loadStage`);
 * hier wird gezeichnet und geschrieben. Ein Behälter darin öffnet sich an
 * Ort und Stelle — dasselbe Element eine Stufe tiefer.
 */
@Component({
  selector: 'nw-inventar',
  imports: [RouterLink, KurzLink, Wahl, NgTemplateOutlet],
  template: `
    <div class="inv" [class.tief]="tiefe() > 0">
      <div class="leiste">
        <span class="regel" title="Set on the campaign">{{ regelLabel() }}</span>
        @if (regel() === 'weight') {
          <span class="mass" [class.warn]="last()?.stage === 'heavy' || last()?.stage === 'over'">
            {{ gewicht() }} lb
            @if (last(); as l) {
              / {{ l.max }} lb · <b>{{ l.stage }}</b>
            }
          </span>
        }
        @if (regel() === 'slots') {
          <span class="mass" [class.warn]="kapazitaet() !== null && slots() > kapazitaet()!">
            {{ slots() }}{{ kapazitaet() !== null ? ' / ' + kapazitaet() : '' }} slots
          </span>
        }
        <!-- Der Beutel: oben immer, in einem Behälter nur, wenn darin Geld liegt. -->
        @if (tiefe() === 0 || karte()['copper']) {
        <span class="beutel" aria-label="Purse">
          @if (darf()) {
            @for (m of muenzarten; track m) {
              <label>
                <input type="number" min="0" inputmode="numeric" [value]="muenzen()[m]"
                       (change)="muenze(m, $any($event.target).value)" [attr.aria-label]="m" />{{ m }}
              </label>
            }
          } @else {
            @for (m of muenzarten; track m) {
              @if (muenzen()[m]) { <span>{{ muenzen()[m] }} {{ m }}</span> }
            }
          }
        </span>
        }
      </div>

      <!-- Die Hände (T-244): nur am eigenen Inventar einer Figur. Ein Stück
           antippen (Raster, Liste, Hand), dann einen Platz — oder es ziehen. -->
      @if (lage(); as l) {
        <div class="ausruesten">
          <section class="haende" aria-label="Hands">
            <h4>Hands <small>{{ summary() }}</small></h4>
            <div class="hplaetze">
              @for (h of handPlaetze(); track h.place) {
                <div class="hplatz" [attr.data-hand]="h.place" [class.belegt]="!!h.held"
                     [class.ziel]="h.ziel === 'ok'" [class.verdraengt]="h.ziel === 'warn'" [class.nein]="h.ziel === 'no'"
                     [attr.title]="h.warum || null">
                  <span class="hlbl">{{ h.label }} <small>· {{ h.kosten }}</small></span>
                  <button type="button" class="hstueck" [attr.aria-pressed]="!!h.stueck && h.stueck.key === wahl()"
                          [attr.aria-label]="h.label + ': ' + (h.held?.name ?? 'free') + (wahlStueck() && h.ziel !== 'no' ? ' — put ' + wahlStueck()!.name + ' here' : '')"
                          (pointerdown)="h.stueck && ziehAn($event, h.stueck)" (click)="hand(h.place)">
                    {{ h.held ? h.held.name : h.griff ? '— grip on the ' + h.griff : '— free' }}
                  </button>
                  @if (h.held) { <small class="hdetail">{{ h.detail }}</small> }
                  @if (h.vielseitig && darf()) {
                    <div class="griff" role="group" aria-label="Grip">
                      <button type="button" [attr.aria-pressed]="!l.haende().both" (click)="griff(false)">One hand</button>
                      <button type="button" [attr.aria-pressed]="l.haende().both" (click)="griff(true)">Two hands</button>
                    </div>
                  }
                  @if (h.stueck && darf()) {
                    <button type="button" class="klein" (click)="wegstecken(h.stueck)">Stow</button>
                  }
                </div>
              }
            </div>
            <ul class="pruefungen">
              @for (c of pruefungen(); track c.key) {
                <li [class]="c.state">{{ c.state === 'ok' ? '✓' : c.state === 'warn' ? '⚠' : '✗' }} {{ c.text }}</li>
              }
            </ul>
          </section>

          <section class="detail" aria-label="Item">
            @if (ausstehend(); as a) {
              <div class="warnung" role="alertdialog" aria-label="Something has to move">
                <b>⚠ {{ a.titel }}</b>
                <p>{{ a.text }}</p>
                <div class="knoepfe">
                  <button type="button" class="pri" (click)="bestaetigen('stow')">{{ a.verstauen }}</button>
                  @if (a.fallen) { <button type="button" (click)="bestaetigen('ground')">{{ a.fallen }}</button> }
                  <button type="button" (click)="ausstehend.set(null)">Cancel</button>
                </div>
              </div>
            }
            @if (wahlStueck(); as p) {
              <h4>{{ p.name }} @if (p.qty !== 1) { <small>×{{ p.qty }}</small> }
                <a class="auf" [routerLink]="['/artikel', p.item]" [nwQuick]="p.item" aria-label="Open article">↗</a>
              </h4>
              <p class="wo">Now: {{ jetzt(p) }}</p>
              <p class="wo"><b>Where it can go</b> · {{ zieleOk() }} places</p>
              <ul class="ziele">
                @for (o of ziele2(); track o.target) {
                  <li [class.ok]="o.ok" [class.hier]="o.here">
                    <span class="icon" [class]="o.here ? 'hier' : !o.ok ? 'no' : o.displaces.length || o.regrips ? 'warn' : 'ok'">{{ o.here ? '●' : !o.ok ? '✗' : o.displaces.length || o.regrips ? '⚠' : '✓' }}</span>
                    <span class="zname"><b>{{ zielLabel(o.target) }}</b>
                      <small>{{ o.here ? 'here now' : !o.ok ? o.why : o.displaces.length ? 'moves ' + o.displaces.join(', ') + ' out' : o.regrips ? o.regrips + ' goes to one hand' : '' }}</small>
                    </span>
                    @if (darf()) {
                      <button type="button" class="klein" [disabled]="!o.ok" (click)="zuZiel(p, o)">{{ o.here ? 'Here' : o.target === 'ground' ? 'Drop' : o.target === 'aside' ? 'Set aside' : o.target === 'stow' ? 'Stow' : 'Put here' }}</button>
                    }
                  </li>
                }
              </ul>
            } @else {
              <p class="leer">Pick an item — in the grid, in a hand or under “Not stowed” — then tap a hand, or see every place it can go here.</p>
            }
          </section>
        </div>
      }

      @if (unverstaut().length) {
        <section class="vor" aria-label="Not stowed">
          <h4>Not stowed <small>{{ verstauText() }}</small></h4>
          <ul>
            @for (p of unverstaut(); track p.key) {
              <li [class.gewaehlt]="p.key === wahl()">
                <button type="button" class="stueck" [class.zieht]="zug()?.key === p.key"
                        [attr.aria-pressed]="p.key === wahl()"
                        [title]="darf() && regel() === 'grid' ? 'Drag it into the grid, or pick it and tap a cell' : p.name"
                        (pointerdown)="ziehAn($event, p)" (click)="klickVor(p)">
                  <span class="punkt" [style.background]="p.farbe"></span>{{ p.name }}
                  @if (p.qty !== 1) { <span class="qty">×{{ p.qty }}</span> }
                </button>
                <a class="auf" [routerLink]="['/artikel', p.item]" [nwQuick]="p.item" aria-label="Open article">↗</a>
                @if (darf()) {
                  <button type="button" class="klein" (click)="verstauen(p)">Stow</button>
                  @if (ziele(p).length && !p.reserviert) {
                    <label>Move to
                      <select (change)="verschieben(p, $any($event.target).value); $any($event.target).value = ''">
                        <option value=""></option>
                        @for (z of ziele(p); track z.id) { <option [value]="z.id">{{ z.label }}</option> }
                      </select>
                    </label>
                  }
                  <button type="button" class="klein" (click)="wegAuf(p, 'discard')">Discard</button>
                  <button type="button" class="klein" (click)="wegAuf(p, 'sell')">Sell</button>
                }
              </li>
              @if (weg()?.p?.key === p.key) {
                <li class="wegzeile"><ng-container *ngTemplateOutlet="wegbox" /></li>
              }
            }
          </ul>
        </section>
      }
      @if (zug(); as z) {
        @if (z.zieht) {
          <div class="geist" aria-hidden="true" [style.left.px]="z.x" [style.top.px]="z.y">{{ z.name }}</div>
        }
      }

      @if (regel() === 'grid') {
        <div class="raster" role="grid" [attr.aria-label]="'Grid of ' + name()" [attr.data-inv]="inventar().id"
             [style.grid-template-columns]="'repeat(' + kiste().w + ', var(--zelle))'"
             [style.--zelle]="'min(2.1rem, calc((100vw - 5rem) / ' + kiste().w + '))'">
          @for (z of zellen(); track z.key) {
            <button type="button" class="zelle" [attr.data-x]="z.x" [attr.data-y]="z.y"
                    [class.zu]="!z.offen && !formModus()" [class.aus]="!z.offen && formModus()"
                    [class.belegt]="!!z.stueck" [class.gewaehlt]="!!z.stueck && z.stueck.key === wahl()" [class.halt]="z.halt" [attr.data-halt]="z.halt ? '' : null"
                    [style.background]="z.stueck ? z.stueck.farbe : z.zone ? zonenFarbe(z.zone) : null"
                    [attr.aria-label]="zellLabel(z)" [title]="zellLabel(z)"
                    [disabled]="!darf() && !z.stueck"
                    (pointerdown)="z.stueck && ziehAn($event, z.stueck)"
                    (click)="zelle(z.x, z.y)">
              @if (z.anker && z.stueck && !z.stueck.bild) { <span class="kurz">{{ z.stueck.name.slice(0, 3) }}</span> }
            </button>
          }
          <!-- Das Bild jedes liegenden Stücks (T-142), nur in seinen Feldern, gedreht und gespiegelt wie das Stück. -->
          @for (b of bilder(); track b.key) {
            <div class="stueckbild" aria-hidden="true" [style]="b.lage">
              <div class="dreher" [style]="b.dreher">
                <img [src]="b.src" alt="" draggable="false" [style]="b.img" />
              </div>
            </div>
          }
        </div>
        @if (darf()) {
          <div class="werkzeug">
            <button type="button" class="klein" [class.an]="formModus()" (click)="formModus.set(!formModus())">
              {{ formModus() ? 'Done shaping' : 'Shape & zones' }}
            </button>
            @if (formModus()) {
              <label>Brush
                <select (change)="pinsel.set($any($event.target).value)">
                  <option value="#">cell on</option>
                  <option value=".">cell off</option>
                  @for (s of leiter(); track s) { <option [value]="'zone:' + s">zone: {{ s }}</option> }
                  <option value="zone:">no zone</option>
                </select>
              </label>
              @if (vorlagen().length) {
                <label>Preset
                  <select (change)="vorlage($any($event.target).value)">
                    <option value=""></option>
                    @for (v of vorlagen(); track v) { <option [value]="v">{{ v }}</option> }
                  </select>
                </label>
              }
              <button type="button" class="klein" (click)="formZurueck()">Default shape</button>
            }
          </div>
        }
        @if (leiter().length && zonenDa()) {
          <p class="zonen">
            @for (s of leiter(); track s) { <span><i [style.background]="zonenFarbe(s)"></i>{{ s }}</span> }
          </p>
        }
      }

      @if (verstaut().length) {
        <ul class="posten">
          @for (p of verstaut(); track p.key) {
            <li [class.gewaehlt]="p.key === wahl()">
              <span class="punkt" [style.background]="p.farbe"></span>
              <button type="button" class="nennen" (click)="waehle(p.key)" [attr.aria-pressed]="p.key === wahl()">{{ p.name }}</button>
              @if (p.qty !== 1) { <span class="qty">×{{ p.qty }}</span> }
              <span class="tier">{{ p.slot || p.tier }}</span>
              @if (regel() === 'grid') {
                @if (zoneVon(p); as zo) { <span class="tier">· {{ zo }}</span> }
                @else if (!liegtIm(p)) { <span class="tier">· not in the grid</span> }
              }
              @if (regel() === 'weight' && p.weight) { <span class="tier">· {{ p.weight * p.qty }} lb</span> }
              @if (p.reserviert) {
                <span class="res">reserved for
                  <a [routerLink]="['/artikel', p.reserviert]" [nwQuick]="p.reserviert">{{ bestand.name()(p.reserviert) ?? 'an article' }}</a></span>
              }
              <a class="auf" [routerLink]="['/artikel', p.item]" [nwQuick]="p.item" aria-label="Open article">↗</a>
              @if (p.behaelter) {
                <button type="button" class="klein" (click)="umschalten(p.behaelter)">{{ offen().has(p.behaelter) ? 'Close' : 'Open' }}</button>
              }
            </li>
            @if (p.key === wahl() && darf()) {
              <li class="aktionen">
                <label>Qty <input type="number" min="1" [value]="p.qty" (change)="menge(p, $any($event.target).value)" [disabled]="!!p.reserviert" /></label>
                <label>Reach
                  <select (change)="setze(p, { tier: $any($event.target).value })">
                    @for (t of tiers; track t) { <option [value]="t" [selected]="t === p.tier">{{ t }}</option> }
                  </select>
                </label>
                @if (regel() === 'grid') {
                  <button type="button" class="klein" (click)="drehen(p)">Rotate</button>
                  @if (p.chiral) {
                    <button type="button" class="klein" [attr.aria-pressed]="!!p.flip" (click)="spiegeln(p)">Mirror</button>
                  }
                  @if (liegtIm(p)) {
                    <button type="button" class="klein" (click)="herausnehmen(p)">Off the grid</button>
                  } @else {
                    <button type="button" class="klein" (click)="hinlegen(p)">Into the grid</button>
                  }
                }
                @if (ziele(p).length && !p.reserviert) {
                  <label>Move to
                    <select (change)="verschieben(p, $any($event.target).value); $any($event.target).value = ''">
                      <option value=""></option>
                      @for (z of ziele(p); track z.id) { <option [value]="z.id">{{ z.label }}</option> }
                    </select>
                  </label>
                }
                <button type="button" class="klein" (click)="wegAuf(p, 'discard')">Discard</button>
                <button type="button" class="klein" (click)="wegAuf(p, 'sell')">Sell</button>
                @if (p.reserviert && session.leitung()) {
                  <button type="button" class="klein" (click)="freigeben(p)" title="The order no longer counts on it">Release</button>
                }
              </li>
              @if (weg()?.p?.key === p.key) {
                <li class="wegzeile"><ng-container *ngTemplateOutlet="wegbox" /></li>
              }
            }
            @if (p.behaelter && offen().has(p.behaelter)) {
              <li class="innen">
                @if (bestand.voll().get(p.behaelter); as inner) {
                  <nw-inventar [inventar]="inner" [oben]="inventar()" [tiefe]="tiefe() + 1" />
                } @else {
                  <p class="leer">Loading…</p>
                }
              </li>
            }
          }
        </ul>
      } @else if (!unverstaut().length) {
        <p class="leer">Nothing in it yet.</p>
      }

      @if (darf()) {
        <div class="hinzu">
          <nw-wahl [wert]="''" (wertChange)="hinzu($event)" [arten]="['Item']" [label]="'Add an item'" [anlegbar]="false" />
        </div>
      }
      @if (zuletzt(); as z) {
        <p class="zuletzt" role="status">{{ z.text }}
          @if (z.undo) { <button type="button" class="klein" (click)="zuruecklegen()">Undo</button> }
        </p>
      }
      @if (hinweis(); as h) { <p class="fehler" role="alert">{{ h }}</p> }
    </div>

    <!-- Wegwerfen und Verkaufen am Stück (T-407, REQ-404): Rückfrage, Anzahl, beim Verkauf der Laden. -->
    <ng-template #wegbox>
      @if (weg(); as w) {
        <div class="wegbox" role="dialog" [attr.aria-label]="(w.art === 'discard' ? 'Discard ' : 'Sell ') + w.p.name">
          @if (w.art === 'discard') {
            <b>Discard {{ w.p.name }}?</b>
            <p>It leaves the game — the piece is deleted with it. You can undo it right after.</p>
          } @else {
            <b>Sell {{ w.p.name }}</b>
            @if (!w.angebote) {
              <p class="leer">Asking the shops…</p>
            } @else if (!w.angebote.offers.length) {
              <p class="leer">No shop you can see is open to you.</p>
            } @else {
              <ul class="laeden" aria-label="Shops">
                @for (o of w.angebote.offers; track o.shop; let i = $index) {
                  @if (i === 0 && o.here) { <li class="gruppe">Here</li> }
                  @if (!o.here && (i === 0 || w.angebote.offers[i - 1]!.here)) { <li class="gruppe">{{ i === 0 ? 'Shops' : 'Elsewhere' }}</li> }
                  <li>
                    <label [class.nein]="o.unit === undefined">
                      <input type="radio" name="laden" [value]="o.shop" [checked]="w.laden === o.shop"
                             [disabled]="o.unit === undefined" (change)="ladenWahl(o.shop)" />
                      {{ o.name }}
                      <small>{{ o.unit !== undefined ? geld(o.unit) + ' each' + (o.rate !== 50 ? ' (' + o.rate + ' %)' : '') : o.refused === 'notBought' ? 'doesn’t buy this' : 'no price' }}</small>
                    </label>
                  </li>
                }
              </ul>
            }
          }
          <div class="knoepfe">
            @if (w.p.qty > 1) {
              <label>Qty <input type="number" min="1" [max]="w.p.qty" [value]="w.qty" (change)="wegMenge($any($event.target).value)" /> of {{ w.p.qty }}</label>
            }
            @if (w.art === 'discard') {
              <button type="button" class="pri" (click)="wegwerfen()">Discard{{ w.qty > 1 ? ' ' + w.qty : '' }}</button>
            } @else {
              <button type="button" class="pri" [disabled]="!verkaufsPreis()" (click)="verkaufen()">
                {{ verkaufsPreis() ? 'Sell for ' + verkaufsPreis() : 'Sell' }}
              </button>
            }
            <button type="button" (click)="weg.set(null)">Cancel</button>
          </div>
        </div>
      }
    </ng-template>
  `,
  styles: `
    .inv { display: flex; flex-direction: column; gap: 0.5rem; }
    .inv.tief { padding-left: 0.6rem; border-left: 2px solid var(--line2); }
    .leiste { display: flex; flex-wrap: wrap; gap: 0.4rem 1rem; align-items: center; }
    .regel { font-family: var(--caps); color: var(--accent); }
    .mass.warn { color: var(--warn); }
    .beutel { display: flex; flex-wrap: wrap; gap: 0.3rem 0.6rem; margin-left: auto; }
    .beutel input { width: 3.6rem; min-height: 32px; margin-right: 0.15rem; }
    .raster { position: relative; display: grid; gap: 2px; width: max-content; max-width: 100%; }
    .stueckbild { position: absolute; overflow: hidden; pointer-events: none; }
    .stueckbild .dreher { position: absolute; left: 50%; top: 50%; }
    .stueckbild img { display: block; user-select: none; }
    .zelle {
      width: var(--zelle); height: var(--zelle); min-height: 0; padding: 0;
      border: 1px solid var(--line); border-radius: 3px; background: var(--surface);
      font-size: 0.65rem; overflow: hidden; cursor: pointer;
    }
    .zelle.zu { visibility: hidden; }
    .zelle.aus { opacity: 0.25; border-style: dashed; }
    .zelle.gewaehlt { outline: 2px solid var(--accent); outline-offset: -2px; }
    /* Die Ankerzelle (REQ-402): hier angefasst, landet sie auf dem Zielfeld. */
    .zelle.halt { box-shadow: inset 0 0 0 3px var(--heading); }
    .kurz { pointer-events: none; }
    .werkzeug { display: flex; flex-wrap: wrap; gap: 0.4rem 0.8rem; align-items: center; }
    .werkzeug .an { background: var(--accent); color: var(--accent-ink); }
    .zonen { display: flex; flex-wrap: wrap; gap: 0.2rem 0.8rem; margin: 0; color: var(--dim); font-size: 0.85rem; }
    .zonen i { display: inline-block; width: 0.8rem; height: 0.8rem; margin-right: 0.25rem; border-radius: 2px; vertical-align: -0.1rem; }
    .posten { list-style: none; margin: 0; padding: 0; }
    .posten > li { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.2rem 0.4rem; padding: 0.2rem 0; }
    .posten > li.gewaehlt { background: var(--surface); }
    .punkt { display: inline-block; width: 0.7rem; height: 0.7rem; border-radius: 50%; border: 1px solid var(--line); }
    .nennen { border: none; background: none; padding: 0; min-height: 0; font: inherit; color: var(--heading); cursor: pointer; text-align: left; }
    .qty, .tier, .leer { color: var(--dim); }
    .res { font-style: italic; color: var(--warn); }
    .auf { text-decoration: none; }
    .aktionen { gap: 0.4rem 0.8rem !important; padding: 0.3rem 0 0.5rem 1.1rem !important; }
    .aktionen input { width: 4rem; min-height: 32px; }
    .aktionen select { min-height: 32px; }
    .innen { display: block !important; padding-left: 1.1rem !important; }
    .fehler { color: var(--warn); }
    .hinzu { max-width: 28rem; }
    .vor { border: 1px dashed var(--accent); border-radius: 6px; padding: 0.4rem 0.6rem; background: var(--surface); }
    .vor h4 { margin: 0 0 0.3rem; font-family: var(--caps); font-weight: normal; }
    .vor h4 small { display: block; font-family: inherit; color: var(--dim); font-size: 0.85rem; }
    .vor ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.3rem; }
    .vor li { display: flex; flex-wrap: wrap; align-items: center; gap: 0.3rem 0.6rem; }
    .vor li.gewaehlt .stueck { outline: 2px solid var(--accent); }
    .vor select { min-height: 32px; }
    .stueck {
      display: inline-flex; align-items: center; gap: 0.35rem; min-height: 40px; padding: 0.2rem 0.6rem;
      border: 1px solid var(--line); border-radius: 999px; background: var(--paper, var(--surface)); color: var(--heading);
      font: inherit; cursor: grab; touch-action: none; user-select: none;
    }
    .stueck.zieht { opacity: 0.5; }
    .ausruesten { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 19rem), 1fr)); gap: 0.6rem 1rem; align-items: start; }
    .haende h4, .detail h4 { margin: 0 0 0.3rem; font-family: var(--caps); font-weight: normal; }
    .haende h4 small, .detail h4 small { font-family: inherit; color: var(--dim); font-size: 0.85rem; margin-left: 0.3rem; }
    .hplaetze { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.5rem; }
    .hplatz { display: flex; flex-direction: column; gap: 0.25rem; min-width: 0; padding: 0.4rem 0.5rem; border: 1px dashed var(--line); border-radius: 6px; background: var(--surface); }
    .hplatz.belegt { border-style: solid; border-color: var(--accent); }
    .hplatz.ziel { border: 2px solid var(--good, #3a7d44); }
    .hplatz.verdraengt { border: 2px solid var(--warn); }
    .hplatz.nein { opacity: 0.6; }
    .hlbl { font-size: 0.8rem; color: var(--dim); }
    .hstueck { min-height: 44px; text-align: left; font: inherit; color: var(--heading); background: var(--paper, var(--surface)); border: 1px solid var(--line); border-radius: 4px; padding: 0.2rem 0.5rem; cursor: pointer; overflow-wrap: anywhere; user-select: none; }
    .hdetail { color: var(--dim); }
    .griff { display: inline-flex; border: 1px solid var(--accent); border-radius: 6px; overflow: hidden; width: max-content; max-width: 100%; }
    .griff button { min-height: 36px; border: 0; border-radius: 0; padding: 0 0.6rem; background: none; font: inherit; font-size: 0.85rem; }
    .griff button[aria-pressed='true'] { background: var(--accent); color: var(--accent-ink); }
    .pruefungen { list-style: none; margin: 0.5rem 0 0; padding: 0; font-size: 0.9rem; }
    .pruefungen .ok { color: var(--good, #3a7d44); }
    .pruefungen .warn { color: var(--warn); }
    .pruefungen .no { color: var(--hp, var(--warn)); }
    .detail { min-width: 0; }
    .detail .wo { margin: 0.1rem 0; color: var(--dim); font-size: 0.9rem; }
    .ziele { list-style: none; margin: 0.3rem 0 0; padding: 0; display: flex; flex-direction: column; gap: 0.25rem; }
    .ziele li { display: flex; align-items: center; gap: 0.5rem; }
    .ziele .zname { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .ziele .zname small { color: var(--dim); }
    .ziele li:not(.ok) .zname b { color: var(--dim); }
    .ziele .icon { flex: none; width: 1rem; text-align: center; }
    .ziele .icon.ok { color: var(--good, #3a7d44); }
    .ziele .icon.warn { color: var(--warn); }
    .ziele .icon.hier { color: var(--accent); }
    .ziele .icon.no { color: var(--dim); }
    .ziele button { min-height: 36px; }
    .warnung { border: 1px solid var(--warn); border-radius: 6px; padding: 0.5rem 0.6rem; margin-bottom: 0.5rem; background: var(--paper, var(--surface)); }
    .warnung p { margin: 0.3rem 0; }
    .warnung .knoepfe { display: flex; flex-wrap: wrap; gap: 0.4rem; }
    .warnung button { min-height: 40px; }
    .wegzeile { display: block !important; list-style: none; }
    .wegbox { border: 1px solid var(--warn); border-radius: 6px; padding: 0.5rem 0.6rem; margin: 0.2rem 0 0.4rem; background: var(--paper, var(--surface)); max-width: 32rem; }
    .wegbox p { margin: 0.3rem 0; }
    .wegbox .knoepfe { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem 0.6rem; }
    .wegbox button { min-height: 40px; }
    .wegbox input[type='number'] { width: 4rem; min-height: 36px; }
    .laeden { list-style: none; margin: 0.3rem 0; padding: 0; display: flex; flex-direction: column; gap: 0.15rem; }
    .laeden .gruppe { font-family: var(--caps); color: var(--dim); font-size: 0.85rem; margin-top: 0.2rem; }
    .laeden label { display: flex; flex-wrap: wrap; align-items: center; gap: 0.2rem 0.5rem; min-height: 36px; cursor: pointer; }
    .laeden label.nein { color: var(--dim); cursor: default; }
    .laeden small { color: var(--dim); }
    .zuletzt { margin: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; color: var(--heading); }
    .geist {
      position: fixed; z-index: 50; pointer-events: none; transform: translate(-50%, -120%);
      padding: 0.2rem 0.6rem; border-radius: 999px; background: var(--accent); color: var(--accent-ink);
      box-shadow: 0 2px 8px rgb(0 0 0 / 0.25); white-space: nowrap;
    }
  `,
})
export class Inventar {
  /** Das Inventar selbst (ein Artikel der Art `Inventory`). */
  readonly inventar = input.required<Entity>();
  /** Wer es trägt — die Kreatur, die Gruppe, der Behälter; fehlt er, ist es die eigene Seite. */
  readonly traeger = input<Entity | null>(null);
  /** Der Statblock des Trägers: Grösse und Stärke (Tragraster, Tragestufe). */
  readonly statblock = input<Entity | null>(null);
  /** Das Inventar eine Stufe höher, wenn dieses in einem Behälter liegt. */
  readonly oben = input<Entity | null>(null);
  readonly tiefe = input(0);

  protected readonly bestand = inject(Bestand);
  protected readonly session = inject(Session);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly api = inject(Api);
  private readonly lageDienst = inject(InventarLageDienst);
  private readonly figurDaten = inject(FigurDaten);

  protected readonly tiers = TIERS;
  protected readonly muenzarten = ['pp', 'gp', 'sp', 'cp'] as const;
  protected readonly wahl = signal<string | null>(null);
  /**
   * **Die Ankerzelle des gewählten Stücks** (REQ-402, T-406): die Zelle, an
   * der es angefasst wurde, in seiner Form, wie sie liegt. Abgelegt wird so,
   * dass sie auf dem Zielfeld landet; ohne Wahl gilt `defaultAnchor`.
   */
  protected readonly halt = signal<GrabAnchor | null>(null);
  protected readonly offen = signal<ReadonlySet<string>>(new Set());
  protected readonly formModus = signal(false);
  protected readonly pinsel = signal('#');
  protected readonly hinweis = signal<string | null>(null);
  /** Die offene Rückfrage zum Wegwerfen oder Verkaufen (T-407). */
  protected readonly weg = signal<{ art: 'discard' | 'sell'; p: Stueck; qty: number; laden: string | null; angebote: VerkaufsAngebote | null } | null>(null);
  /** Was eben geschah, mit der Id zum Zurücklegen (nur beim Wegwerfen). */
  protected readonly zuletzt = signal<{ text: string; undo: string | null; inv: string } | null>(null);
  private schreibt = false;

  protected readonly darf = computed(() => this.session.darfSchreiben()(this.inventar().id));
  protected readonly name = computed(() => entityName(this.inventar()));
  protected readonly regel = computed(() => this.lageDienst.lage()?.rules ?? 'grid');
  protected readonly regelLabel = computed(() => `${REGELN[this.regel()]} inventory`);
  protected readonly karte = computed(() => (this.inventar().components?.['Inventory'] ?? {}) as Record<string, unknown>);
  private readonly settings = computed(() => this.bestand.registry()?.settings ?? {});

  protected readonly leiter = computed<string[]>(() => this.bestand.registry()?.enums?.['DrawTime']?.values ?? []);

  /**
   * Das Tragraster nach dem Blatt, nur unter einer Kreatur mit Statblock
   * (D54): die Bausteine, die für sie gelten, aneinandergefügt (REQ-356).
   */
  private readonly tragraster = computed(() => {
    const sb = this.statblock();
    const r = this.bestand.registry();
    if (!sb || !r) return null;
    const pd = r.interfaces['Statblock']?.schema?.properties?.['carryExtra'];
    const blatt = carrySheetOf(this.settings(), typeof pd?.max === 'number' ? pd.max : 5);
    return assembleCarry(blatt, carryFieldValue(r, sb.components ?? {}, sb.relations ?? []));
  });

  protected readonly kiste = computed<Shape>(() =>
    containerShape(
      this.karte()['grid'],
      this.tragraster()?.rows ?? null,
      Number(this.settings()['inventoryCols']) || 10,
      Number(this.settings()['inventoryRows']) || 6,
    ),
  );

  /** Die Zonen: die eigenen, sonst die der Bausteine des Tragrasters. */
  private readonly zonen = computed<Record<string, string>>(() => {
    const z = this.karte()['zones'];
    if (z && typeof z === 'object' && Object.keys(z).length) return z as Record<string, string>;
    const eigen = this.karte()['grid'];
    if (Array.isArray(eigen) && eigen.length) return {};
    const tg = this.tragraster();
    return tg?.zones ?? {};
  });
  protected readonly zonenDa = computed(() => Object.keys(this.zonen()).length > 0);

  protected readonly vorlagen = computed(() =>
    Object.keys(this.settings()).filter((k) => k.startsWith('container:')).map((k) => k.slice('container:'.length)),
  );

  protected readonly stuecke = computed<Stueck[]>(() => {
    const voll = this.bestand.voll();
    const name = this.bestand.name();
    return (this.inventar().relations ?? [])
      .filter((k) => k.type === 'holds')
      .map((k, i) => {
        const it = voll.get(k.to);
        const item = (it?.components?.['Item'] ?? {}) as Record<string, unknown>;
        const pr = (k.props ?? {}) as Record<string, unknown>;
        const zahl = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
        return {
          key: k.id,
          kante: k,
          item: k.to,
          name: (it ? entityName(it) : name(k.to)) || k.to,
          qty: zahl(pr['qty']) ?? 1,
          tier: typeof pr['tier'] === 'string' ? pr['tier'] : 'pack',
          slot: typeof pr['slot'] === 'string' ? pr['slot'] : '',
          gx: zahl(pr['gx']),
          gy: zahl(pr['gy']),
          rot: zahl(pr['rot']) ?? 0,
          flip: pr['flip'] === true,
          rows: item['rows'],
          weight: zahl(item['weight']),
          stackSize: zahl(item['stackSize']),
          reserviert: reservedFor(k),
          behaelter: (it?.relations ?? []).find((r) => r.type === 'carries')?.to ?? null,
          offen: isUnstowed(k),
          farbe: `hsl(${(i * 67 + 200) % 360} 55% 62%)`,
          bild: inventoryImageOf(it),
          chiral: shapeChiral(item['rows']),
        };
      });
  });

  /** Was schon verstaut ist — die Liste unter dem Raster. */
  protected readonly verstaut = computed(() => this.stuecke().filter((p) => !p.offen));
  /** Was noch vor der Figur liegt (T-140) — der Bereich über dem Raster. */
  protected readonly unverstaut = computed(() => this.stuecke().filter((p) => p.offen));
  protected readonly verstauText = computed(() => VERSTAUEN[this.lageDienst.lage()?.stowing ?? 'anytime']);

  /** Ein Stück, das gerade mit Maus oder Finger gezogen wird. */
  protected readonly zug = signal<{ key: string; name: string; x: number; y: number; x0: number; y0: number; zieht: boolean } | null>(null);
  /** Nach einem Zug kommt noch ein Klick — der zählt nicht als Wahl. */
  private gezogen = false;

  protected readonly zellen = computed(() => {
    const box = this.kiste();
    const zonen = this.zonen();
    const belegt = new Map<string, { stueck: Stueck; anker: boolean }>();
    for (const p of this.stuecke()) {
      if (!pieceInShape(box, p)) continue;
      const f = itemShape(p.rows, p.rot ?? 0, !!p.flip);
      let erstes = true;
      for (let y = 0; y < f.h; y++)
        for (let x = 0; x < f.w; x++) {
          if (!filled(f, x, y)) continue;
          belegt.set(`${p.gx! + x},${p.gy! + y}`, { stueck: p, anker: erstes });
          erstes = false;
        }
    }
    const gewaehlt = this.stuecke().find((p) => p.key === this.wahl() && pieceInShape(box, p));
    const halt = gewaehlt ? (this.halt() ?? defaultAnchor(gewaehlt.rows, gewaehlt.rot ?? 0, !!gewaehlt.flip)) : null;
    const haltZelle = gewaehlt && halt ? `${gewaehlt.gx! + halt.x},${gewaehlt.gy! + halt.y}` : '';
    const out: { key: string; x: number; y: number; offen: boolean; zone: string; stueck: Stueck | null; anker: boolean; halt: boolean }[] = [];
    for (let y = 0; y < box.h; y++)
      for (let x = 0; x < box.w; x++) {
        const key = `${x},${y}`;
        const b = belegt.get(key);
        out.push({ key, x, y, offen: filled(box, x, y), zone: zonen[key] ?? '', stueck: b?.stueck ?? null, anker: !!b?.anker, halt: key === haltZelle });
      }
    return out;
  });

  /**
   * **Die Bilder der liegenden Stücke** (T-142): je Stück ein Kasten über
   * seinen Feldern, maskiert auf die belegten; darin die ungedrehte Form,
   * gedreht und gespiegelt wie das Stück, und darin das Bild nach seinem
   * Ausschnitt. Feldgrösse und Abstand wie im Raster (`--zelle`, 2px).
   */
  protected readonly bilder = computed(() => {
    const box = this.kiste();
    const px = (n: number, luecken: number) => `calc(${n} * var(--zelle) + ${Math.max(0, luecken) * 2}px)`;
    const out: { key: string; src: string; lage: Record<string, string>; dreher: Record<string, string>; img: Record<string, string> }[] = [];
    for (const p of this.stuecke()) {
      if (!p.bild || !pieceInShape(box, p)) continue;
      const src = bildAdresse(p.bild.asset, 'thumb');
      if (!src) continue;
      const ur = itemShape(p.rows);
      const lage = itemShape(p.rows, p.rot ?? 0, !!p.flip);
      out.push({
        key: p.key,
        src,
        lage: { left: px(p.gx!, p.gx!), top: px(p.gy!, p.gy!), width: px(lage.w, lage.w - 1), height: px(lage.h, lage.h - 1), ...maskenStil(lage) },
        dreher: {
          width: px(ur.w, ur.w - 1),
          height: px(ur.h, ur.h - 1),
          transform: `translate(-50%, -50%) rotate(${p.rot ?? 0}deg) scaleX(${p.flip ? -1 : 1})`,
        },
        img: formBildStil(p.bild.frame, ur.w, ur.h),
      });
    }
    return out;
  });

  /**
   * **Was in Behältern liegt, wiegt mit** — der Rucksack trägt sich nicht
   * selbst. Rekursiv über die Inventare der Behälter, soweit geladen; was
   * fehlt, holt der Effekt unten nach (`fehlendeLast`).
   */
  protected readonly gewicht = computed(() => {
    const voll = this.bestand.voll();
    const gesehen = new Set<string>([this.inventar().id]);
    const last = (inv: Entity | undefined): number => {
      let summe = 0;
      for (const k of inv?.relations ?? []) {
        if (k.type !== 'holds') continue;
        const it = voll.get(k.to);
        const w = Number((it?.components?.['Item'] as Record<string, unknown> | undefined)?.['weight']);
        summe += (Number.isFinite(w) ? w : 0) * (Number(k.props?.['qty']) || 1);
        const innen = (it?.relations ?? []).find((r) => r.type === 'carries')?.to;
        if (innen && !gesehen.has(innen)) {
          gesehen.add(innen);
          summe += last(voll.get(innen));
        }
      }
      return summe;
    };
    return Math.round(last(this.inventar()) * 100) / 100;
  });

  /** Was für das Gewicht noch fehlt: Inventare von Behältern und was darin liegt. */
  private readonly fehlendeLast = computed(() => {
    if (this.regel() !== 'weight') return [];
    const voll = this.bestand.voll();
    const fehlt: string[] = [];
    const offen = [this.inventar().id];
    const gesehen = new Set(offen);
    while (offen.length) {
      for (const k of voll.get(offen.pop()!)?.relations ?? []) {
        if (k.type !== 'holds') continue;
        const it = voll.get(k.to);
        if (!it) {
          fehlt.push(k.to);
          continue;
        }
        const innen = (it.relations ?? []).find((r) => r.type === 'carries')?.to;
        if (!innen || gesehen.has(innen)) continue;
        gesehen.add(innen);
        if (voll.has(innen)) offen.push(innen);
        else fehlt.push(innen);
      }
    }
    return fehlt;
  });
  protected readonly slots = computed(() => slotsUsed(this.stuecke()));
  protected readonly kapazitaet = computed(() => {
    const c = Number(this.karte()['capacity']);
    return Number.isFinite(c) && c > 0 ? c : null;
  });
  protected readonly last = computed(() => {
    const sb = this.statblock();
    if (!sb) return null;
    const str = (sb.components?.['Abilities'] as Record<string, unknown> | undefined)?.['str'];
    const size = (sb.components?.['Statblock'] as Record<string, unknown> | undefined)?.['size'];
    return loadStage(this.gewicht(), typeof str === 'number' ? str : null, sizeFactor(String(size ?? '')));
  });
  protected readonly muenzen = computed(() => coins(this.karte()['copper']));

  // ------------------------------------------------------------ Hände (T-244)

  /**
   * **Die Figur, wenn dies ihr eigenes Inventar ist** — dann stehen die
   * Hände darüber. Nicht an der Gruppe, nicht in einem Behälter: wer dort
   * etwas in die Hand nimmt, nimmt es zuerst heraus.
   */
  private readonly figur = computed(() => {
    const t = this.traeger();
    const r = this.bestand.registry();
    if (!t || !r || this.tiefe() > 0) return null;
    if (!(t.relations ?? []).some((k) => k.type === 'carries' && k.to === this.inventar().id)) return null;
    return typeChain(r, primaryInterface(t)).includes('Creature') ? t : null;
  });
  /** Was die Spielerseite über die Figur weiss (Hände, Übungen) — dieselbe Rechnung wie Kopf und „Your turn". */
  protected readonly lage = computed(() => {
    const f = this.figur();
    return f ? this.figurDaten.fuer(f.id) : null;
  });
  private readonly gehalten = computed<HeldItem[]>(() => this.lage()?.gehalten() ?? []);
  protected readonly wahlStueck = computed(() => this.stuecke().find((s) => s.key === this.wahl()) ?? null);
  protected readonly summary = computed(() => {
    const l = this.lage();
    return l ? handSummary(l.haende()) : '';
  });
  protected readonly pruefungen = computed(() => {
    const l = this.lage();
    return l ? handChecks(l.haende(), { sneakAttack: l.hinterhaeltig() }) : [];
  });

  /** Ist im Raster Platz für dieses Stück? `null`: dieses Inventar zählt nicht im Raster. */
  private platzFuer(p: Stueck): boolean | null {
    if (this.regel() !== 'grid') return null;
    return this.liegtIm(p) || !!firstFreeSpot(this.kiste(), this.stuecke().filter((s) => s.key !== p.key), p);
  }

  /** Alle Ziele des gewählten Stücks mit ✓ ⚠ ✗ (`wieldOptions`). */
  protected readonly ziele2 = computed<WieldOption[]>(() => {
    const p = this.wahlStueck();
    const w = p ? this.lage()?.ausruestbar().get(p.key) : undefined;
    if (!p || !w) return [];
    return wieldOptions(this.gehalten(), w, {
      hand: heldPlaceOf(p.kante.props),
      inGrid: this.regel() === 'grid' && this.liegtIm(p),
      unstowed: p.offen,
      ground: p.tier === 'ground',
    }, this.platzFuer(p));
  });
  protected readonly zieleOk = computed(() => this.ziele2().filter((o) => o.ok).length);

  /** Die zwei Hände, mit dem, was sie halten, und ob das gewählte Stück hinein darf. */
  protected readonly handPlaetze = computed(() => {
    const l = this.lage();
    if (!l) return [];
    const h = l.haende();
    const opts = this.ziele2();
    const stueckVon = (x: HeldItem | null) => (x ? this.stuecke().find((s) => s.key === x.id) ?? null : null);
    const zielVon = (place: HandPlace): { ziel: 'ok' | 'warn' | 'no' | null; warum: string } => {
      if (!this.wahlStueck()) return { ziel: null, warum: '' };
      /* Die Haupthand nimmt eine zweihändige Waffe in beide (`wieldPlan`). */
      const o = opts.find((x) => x.target === place);
      if (!o || o.here) return { ziel: null, warum: '' };
      if (!o.ok) return { ziel: 'no', warum: o.why };
      return { ziel: o.displaces.length || o.regrips ? 'warn' : 'ok', warum: '' };
    };
    const main = h.main;
    const off = h.both ? null : h.off;
    return [
      { place: 'mainHand' as HandPlace, label: 'Main hand', held: main, stueck: stueckVon(main), griff: null as string | null,
        kosten: handCost(main), detail: main ? heldDetail(main, h.both) : '', vielseitig: !!main && main.properties.includes('versatile') && !main.shield, ...zielVon('mainHand') },
      { place: 'offHand' as HandPlace, label: 'Off hand', held: off, stueck: stueckVon(off), griff: h.both ? h.main?.name ?? null : null,
        kosten: handCost(off), detail: off ? heldDetail(off, false) : '', vielseitig: false, ...zielVon('offHand') },
    ];
  });

  /** Wartet auf „verstauen / fallen lassen / abbrechen" (Runde 8). */
  protected readonly ausstehend = signal<{ key: string; place: HandPlace; plan: WieldPlan; titel: string; text: string; verstauen: string; fallen: string | null } | null>(null);

  protected zielLabel(t: WieldOption['target']): string {
    return wieldTargetLabel(t);
  }

  protected jetzt(p: Stueck): string {
    const hand = heldPlaceOf(p.kante.props);
    if (hand) return wieldTargetLabel(hand).toLowerCase();
    if (p.offen) return 'not stowed';
    if (p.tier === 'ground') return 'on the ground';
    if (this.regel() === 'grid') return this.liegtIm(p) ? `in the grid${this.zoneVon(p) ? ` · ${this.zoneVon(p)} to draw` : ''}` : 'not in the grid';
    return p.slot || p.tier;
  }

  /** Eine Hand angetippt: ein gewähltes Stück kommt hinein, sonst wird gewählt, was sie hält. */
  protected hand(place: HandPlace): void {
    if (this.gezogen) {
      this.gezogen = false;
      return;
    }
    const p = this.wahlStueck();
    const hier = this.handPlaetze().find((h) => h.place === place)?.stueck ?? null;
    if (p && this.darf() && p.key !== hier?.key) return void this.ausruesten(p, place);
    if (hier) this.waehle(hier.key);
  }

  /** Ein Ziel aus der Liste „Where it can go". */
  protected zuZiel(p: Stueck, o: WieldOption): void {
    if (!o.ok) return;
    if (o.target === 'stow') return this.wegstecken(p);
    if (o.target === 'aside') return void this.propsSetzen(p, { ...stowProps(p.kante.props ?? {}, null, true) });
    if (o.target === 'ground') return void this.propsSetzen(p, dropProps(p.kante.props ?? {}));
    this.ausruesten(p, o.target);
  }

  /** Der Griff der vielseitigen Waffe in der Haupthand: eine oder zwei Hände. */
  protected griff(zwei: boolean): void {
    const main = this.gehalten().find((h) => h.slot === 'mainHand' || h.slot === 'both');
    const p = main ? this.stuecke().find((s) => s.key === main.id) : undefined;
    if (p) this.ausruesten(p, zwei ? 'both' : 'mainHand');
  }

  /**
   * **In die Hand** (T-244): `wieldPlan` sagt, ob es geht und wer weichen
   * muss. Muss jemand weichen, fragt die Warnung zuerst (verstauen, fallen
   * lassen, abbrechen); sonst wird gleich geschrieben.
   */
  protected ausruesten(p: Stueck, place: HandPlace, wohin?: DisplaceTo): void {
    const w = this.lage()?.ausruestbar().get(p.key);
    if (!w) return;
    const plan = wieldPlan(this.gehalten(), w, place);
    if (plan.why) return void this.hinweis.set(`${p.name}: ${plan.why}.`);
    if (!wohin && (plan.displaced.length || plan.regrip)) {
      const namen = plan.displaced.map((h) => h.name).join(' and ');
      if (!plan.displaced.length && plan.regrip) {
        this.ausstehend.set({
          key: p.key, place, plan, titel: 'Grip changes',
          text: `The ${p.name} takes the off hand — the ${plan.regrip.name} goes to one hand${plan.regrip.damage ? ` (${plan.regrip.damage})` : ''}.`,
          verstauen: 'Switch to one hand', fallen: null,
        });
        return;
      }
      const spots = this.spotsFuer(p, plan);
      const wo = this.regel() !== 'grid' ? 'into your things' : Object.values(spots).every(Boolean) ? 'into the grid' : 'no room — set aside';
      this.ausstehend.set({
        key: p.key, place, plan, titel: 'Something has to move',
        text: `${p.name} needs ${plan.place === 'both' ? 'both hands' : plan.place === 'offHand' ? 'the off hand' : 'the main hand'}: ${namen} ${plan.displaced.length > 1 ? 'have' : 'has'} to go.`
          + (plan.regrip ? ` The ${plan.regrip.name} goes to one hand.` : ''),
        verstauen: `Stow ${namen} (${wo})`,
        fallen: `Drop ${namen} (free)`,
      });
      return;
    }
    this.ausstehend.set(null);
    void this.wieldSchreiben(p, plan, wohin ?? 'stow');
  }

  protected bestaetigen(wohin: DisplaceTo): void {
    const a = this.ausstehend();
    const p = a ? this.stuecke().find((s) => s.key === a.key) : undefined;
    this.ausstehend.set(null);
    if (p && a) this.ausruesten(p, a.place, wohin);
  }

  /** Freie Plätze für das, was verdrängt wird; das Stück selbst macht seinen Platz frei. */
  private spotsFuer(p: Stueck, plan: WieldPlan): Record<string, { gx: number; gy: number; rot: number } | null> {
    if (this.regel() !== 'grid') return {};
    const weg = this.stuecke().filter((s) => plan.displaced.some((h) => h.id === s.key));
    const liegen = this.stuecke().filter((s) => this.liegtIm(s));
    return stowSpots(this.kiste(), liegen, weg, p.qty > 1 ? [] : [p.key]);
  }

  private async wieldSchreiben(p: Stueck, plan: WieldPlan, wohin: DisplaceTo): Promise<void> {
    const inv = this.inventar();
    const relations = applyWield(inv.relations ?? [], {
      edgeId: p.key,
      plan,
      newId: `${inv.id}~holds-${Date.now().toString(36)}`,
      displacedTo: wohin,
      edgeOf: (id) => id,
      spots: this.spotsFuer(p, plan),
      grid: this.regel() === 'grid',
    });
    await this.schreiben([{ ...inv, relations }]);
  }

  /** **Verstauen** aus der Hand: an den ersten freien Platz im Raster, sonst unter „Not stowed". */
  protected wegstecken(p: Stueck): void {
    const grid = this.regel() === 'grid';
    const spot = grid ? firstFreeSpot(this.kiste(), this.stuecke().filter((s) => s.key !== p.key && this.liegtIm(s)), { ...p, gx: null, gy: null }) : null;
    if (grid && !spot) this.hinweis.set(`No room for ${p.name} in the grid — it is set aside under “Not stowed”.`);
    void this.propsSetzen(p, stowProps(p.kante.props ?? {}, spot, grid));
  }

  /** Die Angaben an der Kante ersetzen. */
  private async propsSetzen(p: Stueck, props: Record<string, unknown>): Promise<void> {
    const inv = this.inventar();
    await this.schreiben([{ ...inv, relations: (inv.relations ?? []).map((r) => (r.id === p.key ? { ...r, props } : r)) }]);
  }

  constructor() {
    void this.lageDienst.laden();
    /* Die Gegenstände ganz holen (Form, Gewicht, ob Behälter) — in einer Anfrage. */
    effect(() => {
      const holds = (this.inventar().relations ?? []).filter((k) => k.type === 'holds');
      /* Dazu, wofür etwas reserviert ist — sonst stünde dort „an article". */
      const ids = [...holds.map((k) => k.to), ...holds.map((k) => reservedFor(k)).filter((x): x is string => !!x)];
      untracked(() => void this.bestand.holen(ids));
    });
    effect(() => {
      const ids = this.fehlendeLast();
      if (ids.length) untracked(() => void this.bestand.holen(ids));
    });
    /* Ein geöffneter Behälter: sein Inventar. */
    effect(() => {
      const ids = [...this.offen()];
      untracked(() => ids.forEach((id) => void this.bestand.oeffnen(id, false, false)));
    });
  }

  // ------------------------------------------------------------ zeigen

  protected zonenFarbe(zone: string): string {
    return farbeDerZone(zone, this.leiter()) ?? 'transparent';
  }

  protected zellLabel(z: { x: number; y: number; zone: string; stueck: Stueck | null; offen: boolean }): string {
    const teile = [`${z.x + 1},${z.y + 1}`];
    if (z.stueck) teile.push(z.stueck.name);
    else if (!z.offen) teile.push('no cell');
    if (z.zone) teile.push(z.zone);
    return teile.join(' · ');
  }

  protected liegtIm(p: Stueck): boolean {
    return pieceInShape(this.kiste(), p);
  }

  protected zoneVon(p: Stueck): string | null {
    return this.liegtIm(p) ? pieceZone(this.zonen(), p, this.leiter()) : null;
  }

  protected waehle(key: string): void {
    this.hinweis.set(null);
    this.halt.set(null);
    this.wahl.set(this.wahl() === key ? null : key);
  }

  /** Ein liegendes Stück an einer seiner Zellen wählen: diese Zelle wird sein Anker (REQ-402). */
  private anfassen(p: Stueck, x: number, y: number): void {
    this.waehle(p.key);
    if (this.wahl() === p.key && this.liegtIm(p)) this.halt.set(grabAnchor(p.rows, p.rot ?? 0, !!p.flip, p.gx!, p.gy!, x, y));
  }

  protected umschalten(id: string): void {
    const n = new Set(this.offen());
    if (n.has(id)) n.delete(id);
    else n.add(id);
    this.offen.set(n);
  }

  /** Wohin dieser Stapel wandern kann: Gruppe, ihre Figuren, Behälter hier, eine Stufe hinauf. */
  protected ziele(p: Stueck): Ziel[] {
    const hier = this.inventar().id;
    const raus: Ziel[] = [];
    const dazu = (id: string | null, label: string) => {
      if (id && id !== hier && !raus.some((z) => z.id === id)) raus.push({ id, label });
    };
    const oben = this.oben();
    if (oben) dazu(oben.id, `Out to ${entityName(oben)}`);
    for (const s of this.stuecke()) if (s.behaelter && s.key !== p.key) dazu(s.behaelter, `Into ${s.name}`);
    for (const g of this.lageDienst.lage()?.parties ?? []) {
      dazu(g.inventory, `Party: ${g.name}`);
      for (const m of g.members) dazu(m.inventory, m.name);
    }
    const drin = insideOf(p.item, this.bestand.voll());
    return raus.filter((z) => !drin.has(z.id));
  }

  // ------------------------------------------------------------ schreiben

  protected zelle(x: number, y: number): void {
    if (this.gezogen) {
      this.gezogen = false;
      return;
    }
    if (this.formModus()) return void this.malen(x, y);
    const z = this.zellen().find((c) => c.x === x && c.y === y);
    const gewaehlt = this.stuecke().find((s) => s.key === this.wahl());
    if (z?.stueck && (!gewaehlt || !this.darf())) return this.anfassen(z.stueck, x, y);
    /* Eine andere Zelle desselben Stücks: das ist ein neuer Anker, kein Abwählen (REQ-402). */
    if (z?.stueck && gewaehlt && z.stueck.key === gewaehlt.key) {
      const neu = grabAnchor(gewaehlt.rows, gewaehlt.rot ?? 0, !!gewaehlt.flip, gewaehlt.gx!, gewaehlt.gy!, x, y);
      const alt = this.halt() ?? defaultAnchor(gewaehlt.rows, gewaehlt.rot ?? 0, !!gewaehlt.flip);
      if (neu && (neu.x !== alt.x || neu.y !== alt.y)) return void this.halt.set(neu);
      return this.waehle(gewaehlt.key);
    }
    if (!gewaehlt || !this.darf()) return;
    const { gx, gy } = placeByAnchor(x, y, this.halt() ?? defaultAnchor(gewaehlt.rows, gewaehlt.rot ?? 0, !!gewaehlt.flip));
    if (!fitsAt(this.kiste(), this.stuecke(), gewaehlt, gx, gy)) {
      if (z?.stueck) return this.anfassen(z.stueck, x, y);
      this.hinweis.set(`${gewaehlt.name} doesn’t fit there.`);
      return;
    }
    void this.setze(gewaehlt, { gx, gy, rot: gewaehlt.rot ?? 0, slot: undefined, grip: undefined, tier: 'pack', unstowed: undefined });
  }

  protected drehen(p: Stueck): void {
    this.halt.set(null);
    const rot = ((p.rot ?? 0) + 90) % 360;
    if (this.liegtIm(p) && !fitsAt(this.kiste(), this.stuecke(), p, p.gx!, p.gy!, rot)) {
      this.hinweis.set(`Turned, ${p.name} doesn’t fit here — take it off the grid first.`);
      return;
    }
    void this.setze(p, { rot });
  }

  /** **Spiegeln** (T-142): wie Drehen, an der Kante (`holds.props.flip`), nur wo die Form es ändert. */
  protected spiegeln(p: Stueck): void {
    this.halt.set(null);
    const flip = !p.flip;
    if (this.liegtIm(p) && !fitsAt(this.kiste(), this.stuecke(), p, p.gx!, p.gy!, p.rot ?? 0, flip)) {
      this.hinweis.set(`Mirrored, ${p.name} doesn’t fit here — take it off the grid first.`);
      return;
    }
    void this.setze(p, { flip: flip || undefined });
  }

  protected hinlegen(p: Stueck): void {
    const spot = firstFreeSpot(this.kiste(), this.stuecke(), p);
    if (!spot) return void this.hinweis.set(`No room for ${p.name} in the grid.`);
    void this.setze(p, { ...spot, slot: undefined, grip: undefined, tier: 'pack', unstowed: undefined });
  }

  /**
   * **Verstauen** (T-140): im Raster an den ersten freien Platz — wer es
   * woanders will, zieht es oder tippt eine Zelle —, ohne Raster einfach
   * in die Sachen.
   */
  protected verstauen(p: Stueck): void {
    if (this.regel() === 'grid') return this.hinlegen(p);
    void this.setze(p, { unstowed: undefined });
  }

  protected klickVor(p: Stueck): void {
    if (this.gezogen) {
      this.gezogen = false;
      return;
    }
    this.waehle(p.key);
  }

  /**
   * **Ins Raster ziehen** — mit Maus, Stift oder Finger (Pointer-Ereignisse,
   * `touch-action: none` am Stück). Erst ab ein paar Pixeln ist es ein Zug;
   * davor ein Tippen, das wählt. Losgelassen über einer Zelle dieses
   * Rasters liegt es dort, wenn es passt — dieselbe Prüfung wie beim Tippen.
   */
  protected ziehAn(ev: PointerEvent, p: Stueck): void {
    if (!this.darf() || (this.regel() !== 'grid' && !this.lage()) || ev.button > 0) return;
    const el = ev.currentTarget as HTMLElement;
    el.setPointerCapture?.(ev.pointerId);
    this.gezogen = false;
    this.zug.set({ key: p.key, name: p.name, x: ev.clientX, y: ev.clientY, x0: ev.clientX, y0: ev.clientY, zieht: false });
    const bewegt = (e: PointerEvent) => {
      const z = this.zug();
      if (!z || e.pointerId !== ev.pointerId) return;
      const zieht = z.zieht || Math.hypot(e.clientX - z.x0, e.clientY - z.y0) > 6;
      this.zug.set({ ...z, x: e.clientX, y: e.clientY, zieht });
      if (zieht) e.preventDefault();
    };
    const ende = (e: PointerEvent) => {
      if (e.pointerId !== ev.pointerId) return;
      el.removeEventListener('pointermove', bewegt);
      el.removeEventListener('pointerup', ende);
      el.removeEventListener('pointercancel', ende);
      const z = this.zug();
      this.zug.set(null);
      if (!z?.zieht || e.type === 'pointercancel') return;
      this.gezogen = true;
      this.fallen(p, e.clientX, e.clientY);
    };
    el.addEventListener('pointermove', bewegt);
    el.addEventListener('pointerup', ende);
    el.addEventListener('pointercancel', ende);
  }

  /** Wo das gezogene Stück losgelassen wurde: eine Hand (T-244), eine Zelle dieses Rasters, sonst nichts. */
  private fallen(p: Stueck, x: number, y: number): void {
    const unter = document.elementFromPoint(x, y) as HTMLElement | null;
    const hand = unter?.closest<HTMLElement>('[data-hand]');
    if (hand && this.host.nativeElement.contains(hand)) {
      if (heldPlaceOf(p.kante.props) !== hand.dataset['hand']) this.ausruesten(p, hand.dataset['hand'] as HandPlace);
      return;
    }
    const zelle = unter?.closest<HTMLElement>('[data-x]');
    const raster = zelle?.closest<HTMLElement>('.raster');
    if (!zelle || !raster || raster.dataset['inv'] !== this.inventar().id || !this.host.nativeElement.contains(raster)) return;
    /* Abgelegt mit der Ankerzelle auf der Zelle unter dem Finger (REQ-402). */
    const { gx, gy } = placeByAnchor(Number(zelle.dataset['x']), Number(zelle.dataset['y']), defaultAnchor(p.rows, p.rot ?? 0, !!p.flip));
    if (!fitsAt(this.kiste(), this.stuecke(), p, gx, gy)) return void this.hinweis.set(`${p.name} doesn’t fit there.`);
    void this.setze(p, { gx, gy, rot: p.rot ?? 0, slot: undefined, grip: undefined, tier: 'pack', unstowed: undefined });
  }

  protected herausnehmen(p: Stueck): void {
    void this.setze(p, { gx: undefined, gy: undefined });
  }

  protected menge(p: Stueck, roh: string): void {
    const n = Math.trunc(Number(roh));
    if (!Number.isFinite(n) || n < 1) return;
    void this.setze(p, { qty: n });
  }

  /** Eine Angabe an der Kante ändern; `undefined` nimmt sie weg. */
  protected async setze(p: Stueck, patch: Record<string, unknown>): Promise<void> {
    const inv = this.inventar();
    const relations = (inv.relations ?? []).map((r) => {
      if (r.id !== p.key) return r;
      const props: Record<string, unknown> = { ...(r.props ?? {}) };
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined) delete props[k];
        else props[k] = v;
      }
      return { ...r, props };
    });
    await this.schreiben([{ ...inv, relations }]);
  }

  // ------------------------------------------------- Wegwerfen und Verkaufen

  /**
   * **Wegwerfen oder verkaufen** (T-407, REQ-404) — ersetzt „Remove", das
   * nur die Kante nahm und die Instanz liegen liess. Erst die Rückfrage mit
   * Anzahl; geschrieben wird am Server, der Instanz, Sperre und Protokoll
   * kennt. Reserviertes sagt gleich, warum nicht.
   */
  protected wegAuf(p: Stueck, art: 'discard' | 'sell'): void {
    this.hinweis.set(null);
    this.zuletzt.set(null);
    if (p.reserviert) {
      return void this.hinweis.set(`${p.name} is reserved for a crafting order — release it first, then ${art === 'discard' ? 'discard' : 'sell'} it.`);
    }
    this.weg.set({ art, p, qty: 1, laden: null, angebote: null });
    if (art === 'sell') {
      const inv = this.inventar().id;
      this.api.sellOffers(inv, p.key).then(
        (a) => this.weg.update((w) => (w && w.p.key === p.key ? { ...w, angebote: a, laden: a.offers.find((o) => o.unit !== undefined)?.shop ?? null } : w)),
        (error) => {
          this.weg.set(null);
          this.hinweis.set(error instanceof Error ? error.message : String(error));
        },
      );
    }
  }

  protected wegMenge(roh: string): void {
    this.weg.update((w) => (w ? { ...w, qty: Math.min(w.p.qty, Math.max(1, Math.trunc(Number(roh)) || 1)) } : w));
  }

  protected ladenWahl(shop: string): void {
    this.weg.update((w) => (w ? { ...w, laden: shop } : w));
  }

  protected geld(kupfer: number): string {
    /* Grundwährung (E-129/E-130 offen): Kupfer, gezeigt in den Münzen von 5e. */
    return formatMoney(kupfer, DND_COINS);
  }

  protected readonly verkaufsPreis = computed(() => {
    const w = this.weg();
    const o = w?.angebote?.offers.find((x) => x.shop === w.laden);
    return w && o?.unit !== undefined ? this.geld(o.unit * w.qty) : null;
  });

  protected async wegwerfen(): Promise<void> {
    const w = this.weg();
    if (!w || this.schreibt) return;
    const inv = this.inventar().id;
    await this.amServer(async () => {
      const r = await this.api.discard(inv, w.p.key, w.qty);
      this.zuletzt.set({ text: `Discarded ${r.qty} × ${r.item.name}.`, undo: r.undo, inv });
    });
  }

  protected async verkaufen(): Promise<void> {
    const w = this.weg();
    if (!w?.laden || !w.angebote || this.schreibt) return;
    const inv = this.inventar().id;
    const laden = w.angebote.offers.find((o) => o.shop === w.laden);
    await this.amServer(async () => {
      const r = await this.api.sell(w.laden!, w.angebote!.actor, inv, w.p.key, w.qty);
      this.zuletzt.set({ text: `Sold ${r.qty} × ${r.item.name} to ${laden?.name ?? 'the shop'} for ${this.geld(r.total)}.`, undo: null, inv });
    });
  }

  /** Das eben Weggeworfene zurück — der Server sagt nein, wenn sich das Inventar seither geändert hat. */
  protected async zuruecklegen(): Promise<void> {
    const z = this.zuletzt();
    if (!z?.undo || this.schreibt) return;
    await this.amServer(async () => {
      await this.api.undoDiscard(z.inv, z.undo!);
      this.zuletzt.set(null);
    });
  }

  private async amServer(tun: () => Promise<void>): Promise<void> {
    this.schreibt = true;
    this.hinweis.set(null);
    try {
      await tun();
      this.weg.set(null);
      this.wahl.set(null);
    } catch (error) {
      const body = error instanceof ApiError ? (error.body as { refused?: string } | undefined) : undefined;
      this.hinweis.set((body?.refused && ABGELEHNT[body.refused]) || (error instanceof Error ? error.message : String(error)));
    } finally {
      this.schreibt = false;
      await this.bestand.oeffnen(this.inventar().id, true, false);
    }
  }

  /** **Die Leitung gibt frei** (T-134): das Stück verliert die Reservierung; der Server prüft, ob sie darf. */
  protected async freigeben(p: Stueck): Promise<void> {
    const inv = this.inventar();
    await this.schreiben([{ ...inv, relations: (inv.relations ?? []).map((r) => (r.id === p.key ? reserve(r, null) : r)) }]);
  }

  /** Ein Stück dazu: der Server legt es als Instanz des Gegenstands an (T-150) oder legt es auf einen losen Stapel. */
  protected async hinzu(item: string): Promise<void> {
    if (!item || this.schreibt) return;
    const inv = this.inventar();
    this.schreibt = true;
    this.hinweis.set(null);
    try {
      await this.api.give(inv.id, item, 1);
      await this.bestand.oeffnen(inv.id, true, false);
    } catch (error) {
      this.hinweis.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.schreibt = false;
    }
  }

  /** Zur Gruppe, zu einer Figur, in einen Behälter: erst das Ziel schreiben, dann die Quelle. */
  protected async verschieben(p: Stueck, ziel: string): Promise<void> {
    if (!ziel) return;
    this.hinweis.set(null);
    await this.bestand.oeffnen(ziel, true, false);
    const nach = this.bestand.voll().get(ziel);
    if (!nach) return void this.hinweis.set('That inventory isn’t visible to you.');
    if (!this.session.darfSchreiben()(ziel)) return void this.hinweis.set(`You can’t write ${entityName(nach)}.`);
    /* In einen Behälter gelegt ist es verstaut; der Gruppe gegeben noch nicht (T-140). */
    const behaelter = this.stuecke().some((s) => s.behaelter === ziel);
    const r = moveHeld(this.inventar(), nach, p.key, {
      newId: `${nach.id}~holds-${Date.now().toString(36)}`,
      inside: insideOf(p.item, this.bestand.voll()),
      stow: behaelter,
    });
    if ('refused' in r) {
      const warum = { reserved: 'It is reserved.', cycle: 'A container can’t go into itself.', same: 'It is already there.', missing: 'It is gone — reload.' };
      return void this.hinweis.set(warum[r.refused]);
    }
    this.wahl.set(null);
    await this.schreiben([r.to, r.from]);
  }

  protected async muenze(art: 'pp' | 'gp' | 'sp' | 'cp', roh: string): Promise<void> {
    const n = Math.max(0, Math.trunc(Number(roh) || 0));
    const m = { ...this.muenzen(), [art]: n };
    const kupfer = m.pp * 1000 + m.gp * 100 + m.sp * 10 + m.cp;
    await this.karteSetzen({ copper: kupfer });
  }

  // ------------------------------------------------------------ Form und Zonen

  /** Ein Feld malen: an, aus, oder eine Zone. Die Form wird dabei die eigene des Behälters. */
  private malen(x: number, y: number): void {
    const box = this.kiste();
    const rows = box.rows.map((r) => r.padEnd(box.w, '.').split(''));
    const zonen = { ...(this.zonenDa() ? this.zonen() : {}) };
    const p = this.pinsel();
    const key = `${x},${y}`;
    if (p.startsWith('zone:')) {
      if (!filled(box, x, y)) return;
      const z = p.slice(5);
      if (z) zonen[key] = z;
      else delete zonen[key];
    } else {
      rows[y]![x] = p;
      if (p === '.') delete zonen[key];
    }
    void this.karteSetzen({ grid: rows.map((r) => r.join('')), zones: zonen });
  }

  protected vorlage(name: string): void {
    const v = parseContainerTemplate(this.settings()[`container:${name}`]);
    if (v) void this.karteSetzen({ grid: v.rows, zones: zoneMap(v.rows, v.zones) });
  }

  /** Die eigene Form weg: es gilt wieder das Tragraster oder das Rechteck. */
  protected formZurueck(): void {
    void this.karteSetzen({ grid: undefined, zones: undefined });
  }

  private async karteSetzen(patch: Record<string, unknown>): Promise<void> {
    const inv = this.inventar();
    const karte: Record<string, unknown> = { ...this.karte() };
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) delete karte[k];
      else karte[k] = v;
    }
    await this.schreiben([{ ...inv, components: { ...(inv.components ?? {}), Inventory: karte } }]);
  }

  private async schreiben(liste: Entity[]): Promise<void> {
    if (this.schreibt) return;
    this.schreibt = true;
    this.hinweis.set(null);
    try {
      for (const e of liste) {
        const { refs: _r, fromTemplate: _ft, ...rein } = e as Entity & { refs?: unknown };
        await this.api.putEntity(rein as Entity);
      }
      await Promise.all(liste.map((e) => this.bestand.oeffnen(e.id, true, false)));
    } catch (error) {
      this.hinweis.set(
        error instanceof ApiError && error.status === 409
          ? 'Someone changed it in the meantime — reloaded, try again.'
          : error instanceof Error ? error.message : String(error),
      );
      await Promise.all(liste.map((e) => this.bestand.oeffnen(e.id, true, false)));
    } finally {
      this.schreibt = false;
    }
  }
}

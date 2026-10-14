import { Component, ElementRef, Injectable, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  carryGrid,
  coins,
  columnZones,
  containerShape,
  derivedValue,
  entityName,
  filled,
  firstFreeSpot,
  fitsAt,
  insideOf,
  isUnstowed,
  itemShape,
  loadStage,
  moveHeld,
  parseCarrySquares,
  parseContainerPreset,
  pieceInShape,
  pieceZone,
  reserve,
  reservedFor,
  sizeFactor,
  slotsUsed,
  type GridPiece,
  type Shape,
} from '@nw/model';
import type { Entity, Relation } from '@nw/model';
import { Api, ApiError, type InventarLage } from '../kern/api';
import { Bestand } from '../kern/bestand';
import { KurzLink } from '../kern/kurzansicht';
import { Session } from '../kern/session';
import { Wahl } from './wahl';

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
  imports: [RouterLink, KurzLink, Wahl],
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
                  @if (!p.reserviert) { <button type="button" class="klein" (click)="entfernen(p)">Remove</button> }
                }
              </li>
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
                    [class.belegt]="!!z.stueck" [class.gewaehlt]="!!z.stueck && z.stueck.key === wahl()"
                    [style.background]="z.stueck ? z.stueck.farbe : z.zone ? zonenFarbe(z.zone) : null"
                    [attr.aria-label]="zellLabel(z)" [title]="zellLabel(z)"
                    [disabled]="!darf() && !z.stueck"
                    (click)="zelle(z.x, z.y)">
              @if (z.anker && z.stueck) { <span class="kurz">{{ z.stueck.name.slice(0, 3) }}</span> }
            </button>
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
                @if (!p.reserviert) {
                  <button type="button" class="klein" (click)="entfernen(p)">Remove</button>
                } @else if (session.leitung()) {
                  <button type="button" class="klein" (click)="freigeben(p)" title="The order no longer counts on it">Release</button>
                }
              </li>
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
      @if (hinweis(); as h) { <p class="fehler" role="alert">{{ h }}</p> }
    </div>
  `,
  styles: `
    .inv { display: flex; flex-direction: column; gap: 0.5rem; }
    .inv.tief { padding-left: 0.6rem; border-left: 2px solid var(--line2); }
    .leiste { display: flex; flex-wrap: wrap; gap: 0.4rem 1rem; align-items: center; }
    .regel { font-family: var(--caps); color: var(--accent); }
    .mass.warn { color: var(--warn); }
    .beutel { display: flex; flex-wrap: wrap; gap: 0.3rem 0.6rem; margin-left: auto; }
    .beutel input { width: 3.6rem; min-height: 32px; margin-right: 0.15rem; }
    .raster { display: grid; gap: 2px; width: max-content; max-width: 100%; }
    .zelle {
      width: var(--zelle); height: var(--zelle); min-height: 0; padding: 0;
      border: 1px solid var(--line); border-radius: 3px; background: var(--surface);
      font-size: 0.65rem; overflow: hidden; cursor: pointer;
    }
    .zelle.zu { visibility: hidden; }
    .zelle.aus { opacity: 0.25; border-style: dashed; }
    .zelle.gewaehlt { outline: 2px solid var(--accent); outline-offset: -2px; }
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

  protected readonly tiers = TIERS;
  protected readonly muenzarten = ['pp', 'gp', 'sp', 'cp'] as const;
  protected readonly wahl = signal<string | null>(null);
  protected readonly offen = signal<ReadonlySet<string>>(new Set());
  protected readonly formModus = signal(false);
  protected readonly pinsel = signal('#');
  protected readonly hinweis = signal<string | null>(null);
  private schreibt = false;

  protected readonly darf = computed(() => this.session.darfSchreiben()(this.inventar().id));
  protected readonly name = computed(() => entityName(this.inventar()));
  protected readonly regel = computed(() => this.lageDienst.lage()?.rules ?? 'grid');
  protected readonly regelLabel = computed(() => `${REGELN[this.regel()]} inventory`);
  protected readonly karte = computed(() => (this.inventar().components?.['Inventory'] ?? {}) as Record<string, unknown>);
  private readonly settings = computed(() => this.bestand.registry()?.settings ?? {});

  protected readonly leiter = computed<string[]>(() => this.bestand.registry()?.enums?.['DrawTime']?.values ?? []);

  /** Das Tragraster nach dem Blatt, nur unter einer Kreatur mit Statblock (D54). */
  private readonly tragraster = computed(() => {
    const sb = this.statblock();
    const r = this.bestand.registry();
    if (!sb || !r) return null;
    const core = (sb.components?.['Statblock'] ?? {}) as Record<string, unknown>;
    const pd = r.interfaces['Statblock']?.schema?.properties?.['carryExtra'];
    const extra = pd ? derivedValue(pd, core, sb.components, sb.relations ?? []) : 0;
    const max = typeof pd?.max === 'number' ? pd.max : 5;
    return carryGrid(String(core['size'] ?? ''), extra, parseCarrySquares(this.settings()['carrySquares']), max);
  });

  protected readonly kiste = computed<Shape>(() =>
    containerShape(
      this.karte()['grid'],
      this.tragraster()?.rows ?? null,
      Number(this.settings()['inventoryCols']) || 10,
      Number(this.settings()['inventoryRows']) || 6,
    ),
  );

  /** Die Zonen: die eigenen, sonst beim Tragraster die Spalten aus dem Blatt. */
  private readonly zonen = computed<Record<string, string>>(() => {
    const z = this.karte()['zones'];
    if (z && typeof z === 'object' && Object.keys(z).length) return z as Record<string, string>;
    const eigen = this.karte()['grid'];
    if (Array.isArray(eigen) && eigen.length) return {};
    const tg = this.tragraster();
    return tg ? columnZones(this.settings()['carryZones'], tg.rows) : {};
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
          rows: item['rows'],
          weight: zahl(item['weight']),
          stackSize: zahl(item['stackSize']),
          reserviert: reservedFor(k),
          behaelter: (it?.relations ?? []).find((r) => r.type === 'carries')?.to ?? null,
          offen: isUnstowed(k),
          farbe: `hsl(${(i * 67 + 200) % 360} 55% 62%)`,
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
      const f = itemShape(p.rows, p.rot ?? 0);
      let erstes = true;
      for (let y = 0; y < f.h; y++)
        for (let x = 0; x < f.w; x++) {
          if (!filled(f, x, y)) continue;
          belegt.set(`${p.gx! + x},${p.gy! + y}`, { stueck: p, anker: erstes });
          erstes = false;
        }
    }
    const out: { key: string; x: number; y: number; offen: boolean; zone: string; stueck: Stueck | null; anker: boolean }[] = [];
    for (let y = 0; y < box.h; y++)
      for (let x = 0; x < box.w; x++) {
        const key = `${x},${y}`;
        const b = belegt.get(key);
        out.push({ key, x, y, offen: filled(box, x, y), zone: zonen[key] ?? '', stueck: b?.stueck ?? null, anker: !!b?.anker });
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
    const i = this.leiter().indexOf(zone);
    return i < 0 ? 'transparent' : `hsl(${110 - i * 27} 40% ${88 - i * 4}% / 0.9)`;
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
    this.wahl.set(this.wahl() === key ? null : key);
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
    if (this.formModus()) return void this.malen(x, y);
    const z = this.zellen().find((c) => c.x === x && c.y === y);
    const gewaehlt = this.stuecke().find((s) => s.key === this.wahl());
    if (z?.stueck && (!gewaehlt || z.stueck.key === gewaehlt.key || !this.darf())) return this.waehle(z.stueck.key);
    if (!gewaehlt || !this.darf()) return;
    if (!fitsAt(this.kiste(), this.stuecke(), gewaehlt, x, y)) {
      if (z?.stueck) return this.waehle(z.stueck.key);
      this.hinweis.set(`${gewaehlt.name} doesn’t fit there.`);
      return;
    }
    void this.setze(gewaehlt, { gx: x, gy: y, rot: gewaehlt.rot ?? 0, slot: undefined, tier: 'pack', unstowed: undefined });
  }

  protected drehen(p: Stueck): void {
    const rot = ((p.rot ?? 0) + 90) % 360;
    if (this.liegtIm(p) && !fitsAt(this.kiste(), this.stuecke(), p, p.gx!, p.gy!, rot)) {
      this.hinweis.set(`Turned, ${p.name} doesn’t fit here — take it off the grid first.`);
      return;
    }
    void this.setze(p, { rot });
  }

  protected hinlegen(p: Stueck): void {
    const spot = firstFreeSpot(this.kiste(), this.stuecke(), p);
    if (!spot) return void this.hinweis.set(`No room for ${p.name} in the grid.`);
    void this.setze(p, { ...spot, slot: undefined, tier: 'pack', unstowed: undefined });
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
    if (!this.darf() || this.regel() !== 'grid' || ev.button > 0) return;
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

  /** Wo das gezogene Stück losgelassen wurde: eine Zelle dieses Rasters, sonst nichts. */
  private fallen(p: Stueck, x: number, y: number): void {
    const unter = document.elementFromPoint(x, y) as HTMLElement | null;
    const zelle = unter?.closest<HTMLElement>('[data-x]');
    const raster = zelle?.closest<HTMLElement>('.raster');
    if (!zelle || !raster || raster.dataset['inv'] !== this.inventar().id || !this.host.nativeElement.contains(raster)) return;
    const gx = Number(zelle.dataset['x']);
    const gy = Number(zelle.dataset['y']);
    if (!fitsAt(this.kiste(), this.stuecke(), p, gx, gy)) return void this.hinweis.set(`${p.name} doesn’t fit there.`);
    void this.setze(p, { gx, gy, rot: p.rot ?? 0, slot: undefined, tier: 'pack', unstowed: undefined });
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

  protected async entfernen(p: Stueck): Promise<void> {
    const inv = this.inventar();
    this.wahl.set(null);
    await this.schreiben([{ ...inv, relations: (inv.relations ?? []).filter((r) => r.id !== p.key) }]);
  }

  /** **Die Leitung gibt frei** (T-134): das Stück verliert die Reservierung; der Server prüft, ob sie darf. */
  protected async freigeben(p: Stueck): Promise<void> {
    const inv = this.inventar();
    await this.schreiben([{ ...inv, relations: (inv.relations ?? []).map((r) => (r.id === p.key ? reserve(r, null) : r)) }]);
  }

  protected async hinzu(item: string): Promise<void> {
    if (!item) return;
    const inv = this.inventar();
    /* Was hinzukommt — Beute, ein Geschenk —, liegt erst vor der Figur (T-140). */
    const kante = { id: `${inv.id}~holds-${Date.now().toString(36)}`, type: 'holds', to: item, props: { qty: 1, tier: 'pack', unstowed: true } };
    await this.schreiben([{ ...inv, relations: [...(inv.relations ?? []), kante] }]);
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
    const v = parseContainerPreset(this.settings()[`container:${name}`]);
    if (v) void this.karteSetzen({ grid: v.grid, zones: v.zones });
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

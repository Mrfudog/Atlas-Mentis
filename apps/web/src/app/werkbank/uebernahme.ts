import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  Api,
  ApiError,
  type KlonAntwort,
  type TransferEintrag,
  type TransferErgebnis,
  type TransferFeld,
  type TransferStand,
  type TransferVorschau,
} from '../kern/api';
import {
  STATUS_TEXT,
  feldName,
  gruppieren,
  leeresUebernahmeFormular,
  offeneKonflikte,
  uebernahmeAuftrag,
  uebernahmeFehlt,
  uebernahmeLauf,
  vorgewaehlt,
  zeigeWert,
  type UebernahmeFormular,
  type Wahl,
} from './uebernahme-logik';

/**
 * **Übernahme dev ↔ prod** (T-130, REQ-155) in der Werkbank — nur für die
 * Verwaltung. Auswahl → Vorschau (gruppiert nach Ebene, Art und Artikel;
 * je Artikel die Felder und Kanten nebeneinander: Basis, Quelle, Ziel) →
 * Konflikte lösen → Übernehmen. Darunter die Läufe mit Rückgängig, und das
 * Überklonen von dev aus prod.
 *
 * Die Gegenstelle und ihr Token kennt nur der Server; hier steht nur ihr
 * Name. Gerechnet wird dort, und der Lauf schreibt nur, was die Vorschau
 * zeigte (sonst 409).
 */
@Component({
  selector: 'nw-uebernahme',
  imports: [FormsModule, RouterLink],
  template: `
    <section aria-labelledby="h-transfer">
      <div class="titel">
        <h2 id="h-transfer">Transfer between installations</h2>
        @if (stand(); as s) {
          @if (s.peer) {
            <span class="dim">
              here: <b>{{ s.env ?? '?' }}</b> · other side: <b>{{ s.peer.name }}</b>
              @if (s.peerState?.error) {
                · <span class="warn">{{ s.peerState?.error }}</span>
              } @else if (s.peerState) {
                ({{ s.peerState.env ?? '?' }}, {{ s.peerState.articles ?? '?' }} articles,
                {{ s.peerState.accept ? 'accepts transfers' : 'does not accept transfers' }})
              }
            </span>
          }
        }
      </div>
      @if (fehlerStand()) {
        <p class="fehler" role="alert">{{ fehlerStand() }}</p>
      }
      @if (stand(); as s) {
        @if (!s.canTrigger) {
          <p class="leer">This is prod — transfers are started on dev. {{ s.accept ? 'This installation accepts them.' : 'This installation does not accept them (ATLAS_TRANSFER_ACCEPT).' }}</p>
        } @else if (!s.peer) {
          <p class="leer">
            No other installation is set up. The administration sets <code>ATLAS_PEER_URL</code> and
            <code>ATLAS_PEER_TOKEN</code> on the server (docs/Betrieb.md › Übernahme).
          </p>
        } @else {
          <form (ngSubmit)="vorschauen()">
            <fieldset>
              <legend>1 · Direction and articles</legend>
              <div class="richtung" role="radiogroup" aria-label="Direction">
                <label class="wahl">
                  <input type="radio" name="direction" value="push" [(ngModel)]="f.direction" />
                  {{ s.env ?? 'here' }} → {{ s.peer.name }}
                </label>
                <label class="wahl">
                  <input type="radio" name="direction" value="pull" [(ngModel)]="f.direction" />
                  {{ s.peer.name }} → {{ s.env ?? 'here' }}
                </label>
              </div>
              <div class="raster">
                <label>
                  Type
                  <select name="ttype" [(ngModel)]="f.type">
                    <option value="">any</option>
                    @for (t of arten(); track t) {
                      <option [value]="t">{{ t }}</option>
                    }
                  </select>
                </label>
                <label>
                  Layer (with its content)
                  <select name="tlayer" [(ngModel)]="f.layer">
                    <option value="">any</option>
                    @for (l of ebenen(); track l.id) {
                      <option [value]="l.id">{{ l.name }}</option>
                    }
                  </select>
                </label>
                <label>
                  Tag
                  <input name="ttag" [(ngModel)]="f.tag" placeholder="any" />
                </label>
              </div>
              <div class="raster">
                <label>
                  Ids or numbers (one per line)
                  <textarea name="tids" rows="2" [(ngModel)]="f.ids"></textarea>
                </label>
                <label>
                  Registry rows (e.g. interfaces:Spell, views:quick, views:*)
                  <textarea name="treg" rows="2" [(ngModel)]="f.registry"></textarea>
                </label>
              </div>
              <label class="wahl">
                <input type="checkbox" name="tdeps" [(ngModel)]="f.dependencies" />
                with dependencies (statblock, inventory, parts, template whole; edge targets and images one step)
              </label>
            </fieldset>
            @if (fehler()) {
              <p class="fehler" role="alert">{{ fehler() }}</p>
            }
            <div class="aktionen">
              <button type="submit" [disabled]="laeuft()">{{ laeuft() ? 'One moment…' : 'Preview' }}</button>
            </div>
          </form>

          @if (vorschau(); as v) {
            <div class="ergebnis" aria-live="polite">
              <h3>Preview: {{ name(v.source) }} → {{ name(v.target) }}</h3>
              <p class="zahlen">
                <b>{{ v.counts['new'] }}</b> new · <b>{{ v.counts['changed'] }}</b> changed ·
                <b [class.warn]="v.counts['conflict']">{{ v.counts['conflict'] }}</b> conflicts ·
                <b>{{ v.counts['unchanged'] }}</b> unchanged · <b>{{ v.counts['targetAhead'] }}</b> only changed on
                {{ name(v.target) }}
              </p>
              @if (!v.items.length) {
                <p class="leer">Nothing matches.</p>
              }
              @for (g of gruppen(); track g.ebene) {
                <details class="ebene" open>
                  <summary>
                    <span class="name">{{ g.ebene }}</span><span class="dim abstand">{{ g.zahl }}</span>
                  </summary>
                  @for (a of g.arten; track a.art) {
                    <div class="art-gruppe">
                      <h4>{{ a.art }}<span class="dim abstand">{{ a.eintraege.length }}</span></h4>
                      <ul class="eintraege">
                        @for (e of a.eintraege; track e.id) {
                          <li [class]="'st-' + e.status">
                            <div class="kopf-zeile">
                              <label class="wahl">
                                <input
                                  type="checkbox"
                                  [checked]="gewaehlt().has(e.id)"
                                  (change)="umschalten(e.id)"
                                  [attr.aria-label]="'Transfer ' + e.name"
                                  [disabled]="e.status === 'unchanged'"
                                />
                              </label>
                              <span class="status">{{ statusText[e.status] }}</span>
                              @if (e.kind === 'entity') {
                                <a [routerLink]="['/artikel', e.id]">{{ e.name }}</a>
                              } @else {
                                <b>{{ e.name }}</b>
                              }
                              @if (e.number) {
                                <span class="dim">{{ e.number }}</span>
                              }
                              @if (e.fields.length) {
                                <button type="button" class="klein" (click)="aufklappen(e.id)" [attr.aria-expanded]="offen().has(e.id)">
                                  {{ offen().has(e.id) ? 'Hide' : 'Compare' }} ({{ e.fields.length }})
                                </button>
                              }
                              @if (konflikte(e) && gewaehlt().has(e.id)) {
                                <span class="knopfreihe">
                                  <button type="button" class="klein" (click)="alleWaehlen(e, 'source')">all {{ name(v.source) }}</button>
                                  <button type="button" class="klein" (click)="alleWaehlen(e, 'target')">all {{ name(v.target) }}</button>
                                </span>
                              }
                            </div>
                            @if (offen().has(e.id)) {
                              <div class="vergleich" role="table" [attr.aria-label]="'Compare ' + e.name">
                                <div class="vz kopf" role="row">
                                  <span role="columnheader">Field</span>
                                  <span role="columnheader">Last transfer</span>
                                  <span role="columnheader">{{ name(v.source) }}</span>
                                  <span role="columnheader">{{ name(v.target) }}</span>
                                </div>
                                @for (fd of e.fields; track fd.key) {
                                  <div class="vz" role="row" [class.konflikt]="fd.state === 'conflict'">
                                    <span role="cell" class="fname">
                                      {{ feldName(fd) }}
                                      <small class="dim">{{ zustand(fd) }}</small>
                                    </span>
                                    <pre role="cell" class="alt">{{ wert(fd, fd.base) }}</pre>
                                    <pre role="cell" [class.gewinnt]="gewinnt(e, fd) === 'source'">{{ wert(fd, fd.source) }}</pre>
                                    <pre role="cell" [class.gewinnt]="gewinnt(e, fd) === 'target'">{{ wert(fd, fd.target) }}</pre>
                                    @if (fd.state === 'conflict') {
                                      <div class="loesen" role="cell">
                                        <label class="wahl">
                                          <input type="radio" [name]="'w' + e.id + fd.key" [checked]="wahlArt(e, fd) === 'source'" (change)="waehle(e, fd, { art: 'source' })" />
                                          take {{ name(v.source) }}
                                        </label>
                                        <label class="wahl">
                                          <input type="radio" [name]="'w' + e.id + fd.key" [checked]="wahlArt(e, fd) === 'target'" (change)="waehle(e, fd, { art: 'target' })" />
                                          keep {{ name(v.target) }}
                                        </label>
                                        <label class="wahl">
                                          <input type="radio" [name]="'w' + e.id + fd.key" [checked]="wahlArt(e, fd) === 'hand'" (change)="waehle(e, fd, { art: 'hand', text: startText(fd) })" />
                                          by hand
                                        </label>
                                        @if (wahlArt(e, fd) === 'hand') {
                                          <textarea rows="3" [value]="handText(e, fd)" (input)="waehle(e, fd, { art: 'hand', text: $any($event.target).value })" aria-label="Value by hand"></textarea>
                                        }
                                      </div>
                                    }
                                  </div>
                                }
                              </div>
                            }
                          </li>
                        }
                      </ul>
                    </div>
                  }
                </details>
              }
              @if (v.items.length) {
                <div class="aktionen">
                  <button type="button" class="haupt" (click)="uebernehmen()" [disabled]="laeuft() || !gewaehlt().size || offenZahl() > 0">
                    Transfer {{ gewaehlt().size }} to {{ name(v.target) }}
                  </button>
                  @if (offenZahl()) {
                    <span class="warn">{{ offenZahl() }} conflict(s) still need a choice.</span>
                  }
                </div>
              }
            </div>
          }
          @if (ergebnis(); as r) {
            <p class="ok" role="status">
              Done: {{ r.written }} written
              @if (nummernText(r)) {
                · new numbers: {{ nummernText(r) }}
              }
              @if (r.notAligned?.length) {
                · <span class="warn">{{ r.notAligned?.length }} not aligned here</span>
              }
            </p>
          }

          <h3>Runs</h3>
          <ul class="laeufe">
            @for (l of s.runs; track l.id) {
              <li>
                <span class="dim">{{ datum(l.at) }}</span>&nbsp;
                <b>{{ l.direction === 'push' ? 'to ' + s.peer.name : l.direction === 'pull' ? 'from ' + s.peer.name : 'overwrite from ' + s.peer.name }}</b>
                · {{ l.count ?? l.items?.length ?? 0 }} · by {{ l.by?.name ?? '?' }}
                @if (l.backup) {
                  <span class="dim" [title]="l.backup">&nbsp;· backup</span>
                }
                @if (l.undone) {
                  <span class="dim">&nbsp;· undone</span>
                } @else if (l.kind === 'transfer') {
                  <button type="button" class="klein" (click)="zuruecknehmen(l.id)" [disabled]="laeuft()">Undo</button>
                }
              </li>
            } @empty {
              <li class="leer">No transfer yet.</li>
            }
          </ul>
          @if (undoFehler()) {
            <p class="fehler" role="alert">{{ undoFehler() }}</p>
          }

          <details class="klon">
            <summary>Overwrite {{ s.env ?? 'here' }} from {{ s.peer.name }}</summary>
            <p>
              Replaces <b>everything</b> here — registry, articles, images — with {{ s.peer.name }}. Nothing that only
              exists here survives; accounts and roles stay. A full backup is written first{{ s.backup ? '.' : ' — but no backup directory is set, so the server will refuse.' }}
            </p>
            <div class="aktionen">
              <button type="button" (click)="klonProbe()" [disabled]="laeuft()">Dry run</button>
              @if (klon(); as k) {
                @if (k.dryRun) {
                  <span>{{ k.here }} here → {{ k.incoming }} from {{ s.peer.name }}</span>
                }
              }
            </div>
            @if (klon()?.dryRun) {
              <label class="bestaetigen">
                Type OVERWRITE to confirm
                <input name="klonOk" [ngModel]="klonText()" (ngModelChange)="klonText.set($event)" autocomplete="off" />
              </label>
              <div class="aktionen">
                <button type="button" class="gefahr" (click)="klonen()" [disabled]="laeuft() || klonText() !== 'OVERWRITE'">
                  Overwrite {{ s.env ?? 'here' }}
                </button>
              </div>
            }
            @if (klon(); as k) {
              @if (!k.dryRun) {
                <p class="ok" role="status">Overwritten: {{ k.written }} written, {{ k.removed }} removed, {{ k.files }} images. Backup: {{ k.backup }}</p>
              }
            }
            @if (klonFehler()) {
              <p class="fehler" role="alert">{{ klonFehler() }}</p>
            }
          </details>
        }
      } @else if (!fehlerStand()) {
        <p class="leer">Loading…</p>
      }
    </section>
  `,
  styles: `
    :host {
      display: block;
    }
    .titel {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0.5rem 1rem;
    }
    .dim {
      color: var(--dim);
    }
    .abstand {
      margin-left: 0.4rem;
    }
    .warn {
      color: var(--danger, #9b2c2c);
    }
    .fehler {
      color: var(--danger, #9b2c2c);
    }
    .ok {
      color: var(--accent);
    }
    .leer {
      color: var(--dim);
    }
    fieldset {
      margin: 0.75rem 0 0;
      padding: 0.5rem 0.75rem 0.75rem;
      border: 1px solid var(--line2);
      border-radius: 6px;
      min-width: 0;
    }
    legend {
      padding: 0 0.3rem;
      font-family: var(--caps);
      color: var(--heading);
    }
    .raster {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 0.5rem 0.75rem;
      margin-top: 0.5rem;
    }
    label {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      font-size: 0.85rem;
      color: var(--dim);
    }
    label.wahl {
      flex-direction: row;
      align-items: center;
      gap: 0.4rem;
      color: inherit;
      min-height: 32px;
    }
    .richtung {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem 1.25rem;
    }
    input,
    select,
    textarea {
      font: inherit;
      color: inherit;
      background: var(--paper, transparent);
      border: 1px solid var(--line2);
      border-radius: 4px;
      padding: 0.3rem 0.4rem;
      min-width: 0;
    }
    .aktionen {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem 0.75rem;
      margin: 0.75rem 0 0;
    }
    button.klein {
      min-height: 30px;
      padding: 0 0.6rem;
      font-size: 0.85rem;
    }
    button.gefahr {
      border-color: var(--danger, #9b2c2c);
      color: var(--danger, #9b2c2c);
    }
    .ergebnis {
      margin-top: 1rem;
    }
    .zahlen b {
      font-family: var(--serif);
    }
    details.ebene {
      margin: 0.5rem 0;
      border-top: 1px solid var(--line2);
    }
    details.ebene > summary {
      cursor: pointer;
      padding: 0.4rem 0;
      font-family: var(--caps);
      color: var(--heading);
    }
    .art-gruppe h4 {
      margin: 0.4rem 0 0.2rem;
      font-size: 0.9rem;
    }
    .eintraege {
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .eintraege > li {
      border-top: 1px dotted var(--line2);
      padding: 0.25rem 0;
    }
    .kopf-zeile {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.3rem 0.6rem;
      overflow-wrap: anywhere;
    }
    .knopfreihe {
      display: inline-flex;
      gap: 0.3rem;
    }
    .status {
      padding: 0 0.45rem;
      border-radius: 10px;
      background: var(--chip);
      font-size: 0.75rem;
      white-space: nowrap;
    }
    .st-conflict .status {
      background: var(--danger, #9b2c2c);
      color: #fff;
    }
    .st-new .status,
    .st-changed .status {
      background: var(--accent);
      color: #fff;
    }
    .vergleich {
      margin: 0.4rem 0 0.6rem;
      border: 1px solid var(--line2);
      border-radius: 6px;
      overflow: hidden;
    }
    .vz {
      display: grid;
      grid-template-columns: minmax(8rem, 1fr) repeat(3, minmax(0, 2fr));
      gap: 0 0.5rem;
      padding: 0.3rem 0.5rem;
      border-top: 1px solid var(--line2);
    }
    .vz.kopf {
      border-top: 0;
      font-size: 0.8rem;
      color: var(--dim);
      font-family: var(--caps);
    }
    .vz.konflikt {
      background: var(--hover);
    }
    .vz pre {
      margin: 0;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      font-size: 0.8rem;
      font-family: inherit;
    }
    .vz pre.alt {
      color: var(--dim);
    }
    .vz pre.gewinnt {
      font-weight: 700;
      outline: 2px solid var(--accent);
      outline-offset: 1px;
      border-radius: 2px;
    }
    .fname {
      overflow-wrap: anywhere;
      font-size: 0.85rem;
    }
    .fname small {
      display: block;
    }
    .loesen {
      grid-column: 1 / -1;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.25rem 1rem;
      padding-top: 0.3rem;
    }
    .loesen textarea {
      flex: 1 1 100%;
    }
    .laeufe {
      list-style: none;
      padding: 0;
    }
    .laeufe li {
      padding: 0.3rem 0;
      border-top: 1px dotted var(--line2);
    }
    details.klon {
      margin-top: 1rem;
      border: 1px solid var(--danger, #9b2c2c);
      border-radius: 6px;
      padding: 0.4rem 0.75rem;
    }
    details.klon summary {
      cursor: pointer;
      color: var(--danger, #9b2c2c);
      font-weight: 700;
    }
    .bestaetigen {
      margin-top: 0.75rem;
      max-width: 20rem;
    }
    @media (max-width: 640px) {
      .vz {
        grid-template-columns: 1fr;
      }
      .vz.kopf {
        display: none;
      }
      .vz pre::before {
        display: block;
        font-size: 0.7rem;
        color: var(--dim);
        font-weight: 400;
      }
      .vz pre:nth-of-type(1)::before {
        content: 'Last transfer';
      }
      .vz pre:nth-of-type(2)::before {
        content: var(--quelle-label, 'Source');
      }
      .vz pre:nth-of-type(3)::before {
        content: var(--ziel-label, 'Target');
      }
    }
  `,
  host: {
    '[style.--quelle-label]': 'quelleLabel()',
    '[style.--ziel-label]': 'zielLabel()',
  },
})
export class Uebernahme {
  private readonly api = inject(Api);

  readonly arten = input<string[]>([]);
  readonly ebenen = input<{ id: string; name: string }[]>([]);

  protected readonly statusText = STATUS_TEXT;
  protected readonly feldName = feldName;

  protected readonly stand = signal<TransferStand | null>(null);
  protected readonly fehlerStand = signal('');
  protected f: UebernahmeFormular = leeresUebernahmeFormular();
  protected readonly vorschau = signal<TransferVorschau | null>(null);
  private auftrag: ReturnType<typeof uebernahmeAuftrag> | null = null;
  /** Die Namen der letzten Vorschau — das Ergebnis nennt Artikel bei ihrer Id. */
  private namen = new Map<string, string>();
  protected readonly gewaehlt = signal<Set<string>>(new Set());
  protected readonly wahl = signal<Map<string, Wahl>>(new Map());
  protected readonly offen = signal<Set<string>>(new Set());
  protected readonly laeuft = signal(false);
  protected readonly fehler = signal('');
  protected readonly ergebnis = signal<TransferErgebnis | null>(null);
  protected readonly undoFehler = signal('');
  protected readonly klon = signal<KlonAntwort | null>(null);
  protected readonly klonText = signal('');
  protected readonly klonFehler = signal('');

  protected readonly gruppen = computed(() => gruppieren(this.vorschau()?.items ?? []));
  protected readonly offenZahl = computed(() => offeneKonflikte(this.vorschau()?.items ?? [], this.gewaehlt(), this.wahl()));
  protected readonly quelleLabel = computed(() => `'${this.name(this.vorschau()?.source ?? 'Source')}'`);
  protected readonly zielLabel = computed(() => `'${this.name(this.vorschau()?.target ?? 'Target')}'`);

  constructor() {
    void this.laden();
  }

  private async laden(): Promise<void> {
    try {
      this.stand.set(await this.api.transferStand());
      this.fehlerStand.set('');
    } catch (e) {
      this.fehlerStand.set(e instanceof Error ? e.message : String(e));
    }
  }

  /** `here` heisst diese Installation. */
  protected name(seite: string): string {
    return seite === 'here' ? (this.stand()?.env ?? 'here') : seite;
  }

  protected async vorschauen(): Promise<void> {
    const fehlt = uebernahmeFehlt(this.f);
    if (fehlt) {
      this.fehler.set(fehlt);
      return;
    }
    this.fehler.set('');
    this.ergebnis.set(null);
    this.laeuft.set(true);
    try {
      this.auftrag = uebernahmeAuftrag(this.f);
      const v = await this.api.transferVorschau(this.auftrag);
      this.vorschau.set(v);
      this.gewaehlt.set(new Set(v.items.filter(vorgewaehlt).map((e) => e.id)));
      this.wahl.set(new Map());
      /* Konflikte stehen gleich offen — sie sind das, was man ansehen muss. */
      this.offen.set(new Set(v.items.filter((e) => e.status === 'conflict').map((e) => e.id)));
    } catch (e) {
      this.vorschau.set(null);
      this.fehler.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.laeuft.set(false);
    }
  }

  protected umschalten(id: string): void {
    const s = new Set(this.gewaehlt());
    if (s.has(id)) s.delete(id);
    else s.add(id);
    this.gewaehlt.set(s);
  }

  protected aufklappen(id: string): void {
    const s = new Set(this.offen());
    if (s.has(id)) s.delete(id);
    else s.add(id);
    this.offen.set(s);
  }

  protected konflikte(e: TransferEintrag): number {
    return e.fields.filter((f) => f.state === 'conflict').length;
  }

  private schluessel(e: TransferEintrag, fd: TransferFeld): string {
    return `${e.id}\u0000${fd.key}`;
  }

  protected wahlArt(e: TransferEintrag, fd: TransferFeld): string | null {
    return this.wahl().get(this.schluessel(e, fd))?.art ?? null;
  }

  protected handText(e: TransferEintrag, fd: TransferFeld): string {
    const w = this.wahl().get(this.schluessel(e, fd));
    return w?.art === 'hand' ? w.text : '';
  }

  protected startText(fd: TransferFeld): string {
    const v = fd.source ?? fd.target;
    return typeof v === 'string' ? v : v === undefined ? '' : JSON.stringify(v, null, 1);
  }

  protected waehle(e: TransferEintrag, fd: TransferFeld, w: Wahl): void {
    const m = new Map(this.wahl());
    m.set(this.schluessel(e, fd), w);
    this.wahl.set(m);
  }

  protected alleWaehlen(e: TransferEintrag, art: 'source' | 'target'): void {
    const m = new Map(this.wahl());
    for (const fd of e.fields) if (fd.state === 'conflict') m.set(this.schluessel(e, fd), { art });
    this.wahl.set(m);
  }

  /** Welche Seite nach der Übernahme gilt — für die Markierung. */
  protected gewinnt(e: TransferEintrag, fd: TransferFeld): 'source' | 'target' | null {
    if (fd.state === 'source' || fd.state === 'target') return fd.state;
    const w = this.wahl().get(this.schluessel(e, fd));
    return w && w.art !== 'hand' ? w.art : null;
  }

  protected zustand(fd: TransferFeld): string {
    const v = this.vorschau();
    if (!v) return '';
    if (fd.state === 'conflict') return 'both changed';
    if (fd.state === 'source') return `changed on ${this.name(v.source)}`;
    if (fd.state === 'target') return `changed on ${this.name(v.target)}`;
    return '';
  }

  protected wert(fd: TransferFeld, v: unknown): string {
    return zeigeWert(fd, v);
  }

  protected nummernText(r: TransferErgebnis): string {
    return Object.entries(r.numbers ?? {})
      .map(([id, n]) => `${this.namen.get(id) ?? id} → ${n}`)
      .join(', ');
  }

  protected async uebernehmen(): Promise<void> {
    const v = this.vorschau();
    if (!v || !this.auftrag) return;
    const ziel = this.name(v.target);
    if (!confirm(`Transfer ${this.gewaehlt().size} item(s) to ${ziel}? A backup is written first; you can undo it below.`)) return;
    this.laeuft.set(true);
    this.fehler.set('');
    try {
      this.namen = new Map(v.items.map((e) => [e.id, e.name]));
      const r = await this.api.transferLauf(uebernahmeLauf(this.auftrag, v.items, this.gewaehlt(), this.wahl()));
      this.ergebnis.set(r);
      this.vorschau.set(null);
      await this.laden();
    } catch (e) {
      const body = e instanceof ApiError ? (e.body as { rejected?: { name: string; issues: string[] }[] } | undefined) : undefined;
      const abgelehnt = body?.rejected?.slice(0, 3).map((x) => `${x.name}: ${x.issues.join('; ')}`).join(' · ');
      this.fehler.set(`${e instanceof Error ? e.message : String(e)}${abgelehnt ? ` — ${abgelehnt}` : ''}`);
    } finally {
      this.laeuft.set(false);
    }
  }

  protected async zuruecknehmen(id: string): Promise<void> {
    if (!confirm('Undo this transfer on both sides?')) return;
    this.laeuft.set(true);
    this.undoFehler.set('');
    try {
      await this.api.transferUndo(id);
      await this.laden();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && confirm(`${e.message}\n\nUndo anyway? The old versions win.`)) {
        try {
          await this.api.transferUndo(id, { force: true });
          await this.laden();
        } catch (e2) {
          this.undoFehler.set(e2 instanceof Error ? e2.message : String(e2));
        }
      } else {
        this.undoFehler.set(e instanceof Error ? e.message : String(e));
      }
    } finally {
      this.laeuft.set(false);
    }
  }

  protected async klonProbe(): Promise<void> {
    this.laeuft.set(true);
    this.klonFehler.set('');
    try {
      this.klon.set(await this.api.transferKlon({ dryRun: true }));
    } catch (e) {
      this.klonFehler.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.laeuft.set(false);
    }
  }

  protected async klonen(): Promise<void> {
    if (this.klonText() !== 'OVERWRITE') return;
    this.laeuft.set(true);
    this.klonFehler.set('');
    try {
      this.klon.set(await this.api.transferKlon({ confirm: 'OVERWRITE' }));
      this.klonText.set('');
      await this.laden();
    } catch (e) {
      this.klonFehler.set(e instanceof Error ? e.message : String(e));
    } finally {
      this.laeuft.set(false);
    }
  }

  protected datum(at: string): string {
    return new Date(at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  }
}

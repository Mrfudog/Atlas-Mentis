import { Component, DestroyRef, computed, effect, inject, input, output, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { KurzLink } from '../kern/kurzansicht';
import { Stapelfolge } from './stapelfolge';
import { Klappleiste } from '../muster/klappleiste';
import { areaOf } from '@nw/model';
import { Api, ApiError, type Ebenenauswahl, type KampagnenEbene, type KampagnenEbenen } from '../kern/api';
import { Bestand } from '../kern/bestand';
import { Session } from '../kern/session';
import { Live } from '../kern/live';

/** Ebenen, die Bücher sind — ohne Gruppe stehen sie unter „Other books". */
const BUCHARTEN = new Set(['book', 'adventure']);
/** Der Schlüssel am Konto, unter dem die aufgeklappten Gruppen stehen (T-088). */
const OFFEN_PREF = 'layerGroups';
/** … und wonach die Bücher gruppiert stehen (T-094). */
const ANSICHT_PREF = 'layerGroupBy';
type Ansicht = 'category' | 'publisher';

/**
 * **Der letzte Stand, über die Seite hinaus** (T-185): wer aus der Liste
 * einen Artikel öffnet und zurückgeht, bekommt eine neue Liste — die stand
 * bisher leer da („Loading…"), mit allen Gruppen zu, bis Server und
 * Einstellungen geantwortet hatten, und der Rückweg (`Rueckweg`) fand die
 * Stelle nicht mehr. Jetzt zeichnet sie sofort den letzten Stand und fragt
 * trotzdem neu. Je Konto und Sicht, damit nach einem Wechsel nichts vom
 * vorigen stehen bleibt.
 */
const ZULETZT = new Map<string, { daten: KampagnenEbenen; offen: Set<string> | null; ansicht: Ansicht | null }>();

/** Die Bereiche in der Reihenfolge der Kopfleiste; andere danach, ohne Bereich zuletzt (T-105). */
const BEREICHE = ['world', 'story', 'rules', 'play'];
type Auswahl = { areas?: string[]; types?: string[] };
/** Was eine Auswahl schreibt (T-187): was die Ebene bringt, oder die Typ-Regel einer Gruppe. */
type Ziel = 'only' | 'rule';
/** Ein Bereich in der Auswahl einer Ebene (T-105), mit seinen Arten und Zählern. */
interface AuswahlBereich {
  area: string;
  label: string;
  n: number;
  an: boolean;
  /** Nicht ganz an, aber einzelne Arten darin. */
  teils: boolean;
  arten: { type: string; label: string; n: number; an: boolean }[];
}

/** Eine Gruppe mit ihren Mitgliedern (T-088), verschachtelt. */
interface Gruppe {
  ebene: KampagnenEbene;
  untergruppen: Gruppe[];
  ebenen: KampagnenEbene[];
  /** Bücher darin (verschachtelt, ohne Gruppen), davon im Spiel. */
  gesamt: number;
  an: number;
  /**
   * Das Häkchen der Gruppe (T-185), aus dem Stand ihrer Bücher gerechnet:
   * alle im Spiel `an`, keines `aus`, sonst `teils`. Nicht aus der Kante
   * der Gruppe — „Core rules" mit drei einzeln aufgeschalteten Büchern ist
   * ganz an, auch wenn die Gruppe selbst nicht im Stapel steht.
   */
  stand: 'an' | 'aus' | 'teils';
}

/**
 * **Das Häkchen einer Gruppe** (T-185): aus dem Stand ihrer Bücher
 * (verschachtelt, ohne Gruppen) — alle im Spiel `an`, keines `aus`, sonst
 * `teils`. Eine leere Gruppe sagt, ob sie selbst im Spiel ist. Gezählt wird
 * jedes Mitglied, das die Liste unter der Gruppe zeigt, auch eine Ebene, die
 * kein Buch ist („— no book given"); Vergleichsebenen sind nicht im Spiel
 * und zählen als aus.
 */
export function gruppenHaken(g: Pick<KampagnenEbene, 'inPlay'>, buecher: readonly Pick<KampagnenEbene, 'inPlay'>[]): 'an' | 'aus' | 'teils' {
  if (!buecher.length) return g.inPlay ? 'an' : 'aus';
  const an = buecher.filter((x) => x.inPlay).length;
  return an === buecher.length ? 'an' : an === 0 ? 'aus' : 'teils';
}

/** Der Stand, den eine gespeicherte Auswahl festhält (T-186): der Stapel von unten nach oben und was trotz Gruppe aus ist. */
export function auswahlAusStand(layers: readonly KampagnenEbene[]): { layers: string[]; off: string[] } {
  return { layers: layers.filter((x) => x.active).map((x) => x.id), off: layers.filter((x) => x.off).map((x) => x.id) };
}

/**
 * **Eine gespeicherte Auswahl laden** (T-186): was davon noch da ist und
 * sich hier aufschalten lässt, in ihrer Reihenfolge. Was fehlt — gelöscht,
 * oder eine Ebene einer anderen Kampagne —, wird gezählt und nicht still
 * übergangen.
 */
export function auswahlAnwenden(
  set: Pick<Ebenenauswahl, 'layers' | 'off'>,
  layers: readonly Pick<KampagnenEbene, 'id' | 'name' | 'active' | 'canActivate'>[],
): { layers: string[]; off: string[]; fehlt: number } {
  const m = new Map(layers.map((x) => [x.id, x]));
  const an = set.layers.filter((id) => {
    const l = m.get(id);
    return !!l && (l.active || l.canActivate);
  });
  const off = set.off.filter((id) => m.has(id));
  return { layers: an, off, fehlt: set.layers.length - an.length + (set.off.length - off.length) };
}

/** Steht der Stapel gerade so, wie die Auswahl sagt? Die Reihenfolge zählt, die der Abschaltungen nicht. */
export function auswahlGilt(set: Pick<Ebenenauswahl, 'layers' | 'off'>, layers: readonly KampagnenEbene[]): boolean {
  const jetzt = auswahlAusStand(layers);
  const off = new Set(jetzt.off);
  return (
    jetzt.layers.length === set.layers.length &&
    jetzt.layers.every((id, i) => id === set.layers[i]) &&
    off.size === new Set(set.off).size &&
    set.off.every((id) => off.has(id))
  );
}

/**
 * **Die Ebenen einer Kampagne** (T-069, E-008) — auf der Kampagnenseite,
 * unter den Mitgliedern: je Ebene ein Häkchen (aufgeschaltet ja/nein) und
 * für die aufgeschalteten die Reihenfolge. Geschrieben werden die Kanten
 * `activates` an der Kampagne, der ganze Stapel auf einmal
 * (`PUT /api/campaigns/:c/layers`).
 *
 * Was eine Kampagne zeigt, ist ihre wichtigste Einstellung. Die Kante hiess
 * in der Maske „runs on", und die Leitung fand sie nicht, als nach dem
 * Anlegen einer Kampagne alle Artikel aus 5e.tools fehlten.
 *
 * Oben steht die spezifischste Ebene — sie gewinnt, wenn zwei dasselbe
 * sagen. **Die Reihenfolge steht für sich** (T-188, `nw-stapelfolge`):
 * alles, was ausdrücklich aufgeschaltet ist — Ebenen, Bücher, Gruppen —,
 * mit Platz, Richtung und dem, was es bewirkt, zum Ziehen; die Pfeile an
 * den Ebenen darunter sind weg. Was der Server nicht annähme, bietet die Seite nicht an
 * (`may`, `canActivate`).
 *
 * **Vergleichsebenen** (T-092, E-021 d): an jeder Ebene, die nicht im
 * Spiel ist, ein Häkchen „compare" — ihre Fassungen stehen dann auf Wunsch
 * an den Feldern. Darunter, ob die Spielenden sie auch sehen. **Auch an
 * einer Gruppe** (T-143): „2024 rules" als Ganzes zum Vergleich; ihre
 * Bücher sagen dann „compared with its group".
 *
 * **Auch im Popup der Kopfleiste** (T-143, `nw-stapel`): dieselbe Liste,
 * `kompakt` ohne eigenen Kasten. Nach jedem Häkchen schickt der Server den
 * neuen Stand mit (`state`); gefragt wird nur, wenn er fehlt.
 *
 * **Bücher stehen für sich** (T-081, E-017): je Buch aus 5e.tools eine
 * Ebene, mit Häkchen und ohne Pfeile — siebzig Zeilen mit Pfeilen
 * verdeckten den Stapel, um den es geht. Geordnet wird, was aufgeschaltet
 * ist, in der Reihenfolge oben (T-188).
 *
 * **Gruppen sind Ebenen** (T-088, E-022 b): je Gruppe ein aufklappbarer
 * Abschnitt mit „3 of 12 on", einem Häkchen für die ganze Gruppe und einem
 * je Buch darin. Ist die Gruppe an, nimmt das Häkchen am Buch es aus der
 * Gruppe heraus (`off` — aus schlägt an); ist sie aus, schaltet es das Buch
 * für sich auf. Welche Abschnitte offen sind, merkt sich das Konto.
 *
 * **Nach Kategorie oder nach Herausgeber** (T-094, REQ-249): ein
 * Umschalter zeigt die Gruppen der einen oder der anderen Art
 * (`groupBy`), gemerkt am Konto. Jede Ebene trägt ihren Herausgeber als
 * Marke — Official, Partnered, Homebrew … —, gerechnet am Server.
 *
 * **Teilweise aufschalten** (T-105, REQ-255): an jeder Ebene und Gruppe
 * mit eigener Kante „Brings: everything" zum Aufklappen — je Bereich ein
 * Häkchen mit Zähler, darunter die Arten einzeln. Aus einem Abenteuer so
 * nur Regeln und Gegenstände, nicht seine Orte. Geschrieben wird an der
 * Kante (`PUT …/layers/:layer/only`); was „alles" ist, schickt die Seite als
 * keine Auswahl, damit eine Art, die später dazukommt, mitkommt.
 */
@Component({
  selector: 'nw-kampagnen-ebenen',
  imports: [RouterLink, NgTemplateOutlet, KurzLink, Stapelfolge, Klappleiste],
  template: `
    <section class="kasten" [class.kompakt]="kompakt()" aria-label="Layers in play">
      @if (!kompakt()) {
        <h2>Layers in play</h2>
      }
      <p class="fuss">
        The lists of this campaign show what its layers bring, and articles without a layer. A layer
        higher up wins where two say the same. Turning a layer off deletes nothing.
      </p>
      @if (fehler(); as f) {
        <p class="fehler" role="alert">{{ f }}</p>
      }
      @if (daten(); as d) {
        <!-- Eine Leiste für die Bereiche (T-220): alles auf/zu, vor und zurück, Alt+↑/↓. -->
        <!-- Nachgeladen: diese Liste steht auch im Popup der Kopfleiste, und das Startpaket bleibt (T-348). -->
        @defer (on immediate) {
          <nw-klappleiste beschriftung="Layer sections" [fest]="!kompakt()" />
        }
        <!-- Die Reihenfolge (T-188): oben gewinnt, ziehen, Gruppen als Block, Bücher herauslösen. -->
        <details class="sets reihenfolge" data-bereich [open]="!offen().has('order-zu')" (toggle)="zuklappen('order-zu', $event)">
          <summary>
            <span class="gname">Order in play</span>
            <span class="dim">{{ stapel().length }} in play · top wins</span>
          </summary>
          <!-- Erst bei Bedarf geladen: das Popup steht in jeder Seite, und das Grundpaket hat ein Budget. -->
          @defer (on viewport) {
            <nw-stapelfolge
              [layers]="d.layers"
              [darf]="d.may === 'manage'"
              [busy]="laeuft()"
              (order)="ordnen($event)"
            />
          } @placeholder {
            <p class="dim">Loading the order…</p>
          }
          <!-- Vorrang je Art und je Artikel (T-403, E-111 a): an der Kampagne, kein Buch wird beschrieben. -->
          <div class="vorrang" aria-label="First for some types">
            <h4>First for some types</h4>
            <p class="fuss">
              Where two layers bring a version of the same thing, the higher one shows in lists and links. Pull one layer
              to the front for some types only — the rest keeps the order above.
            </p>
            <ul class="extra">
              @for (p of artVorrang(); track p.to + p.type) {
                <li>
                  <b>{{ artName(p.type) }}:</b> {{ p.name }} first
                  @if (d.may === 'manage') {
                    <button type="button" class="klein" [disabled]="laeuft()" [attr.aria-label]="'Remove ' + p.name + ' first for ' + artName(p.type)" (click)="vorrangWeg(p.to, p.type)">×</button>
                  }
                </li>
              }
              @for (p of artikelVorrang(); track p.to) {
                <li>
                  <a [routerLink]="['/artikel', p.to]">{{ p.name }}</a>
                  <span class="dim">· this version preferred</span>
                  @if (d.may === 'manage') {
                    <button type="button" class="klein" [disabled]="laeuft()" [attr.aria-label]="'Stop preferring ' + p.name" (click)="vorrangWeg(p.to)">×</button>
                  }
                </li>
              }
            </ul>
            @if (d.may === 'manage' && stapel().length > 1) {
              <span class="vorrangwahl">
                <select aria-label="Type" [value]="vorrangArt()" (change)="vorrangArt.set($any($event.target).value)">
                  <option value="">Type…</option>
                  @for (t of vorrangArten(); track t) {
                    <option [value]="t">{{ artName(t) }}</option>
                  }
                </select>
                <select aria-label="Layer first for that type" [value]="vorrangEbene()" (change)="vorrangEbene.set($any($event.target).value)">
                  <option value="">Layer…</option>
                  @for (id of stapel(); track id) {
                    <option [value]="id">{{ nachId().get(id)?.name ?? id }}</option>
                  }
                </select>
                <button type="button" class="klein" [disabled]="laeuft() || !vorrangArt() || !vorrangEbene()" (click)="vorrangSetzen()">Put first</button>
              </span>
            }
          </div>
        </details>
        <!-- Gespeicherte Auswahlen (T-186): der Stapel unter einem Namen, je Konto. -->
        <details class="sets" data-bereich [open]="offen().has('sets')" (toggle)="merke('sets', $event)">
          <summary>
            <span class="gname">Saved selections</span>
            <span class="dim">{{ sets().length }} saved</span>
          </summary>
          @if (setHinweis(); as h) {
            <p class="fuss" role="status">{{ h }}</p>
          }
          <ul class="setliste">
            @for (s of sets(); track s.id) {
              <li [class.gilt]="gilt(s)">
                <details class="setinhalt">
                  <summary>
                    <span class="name">{{ s.name }}</span>
                    <span class="dim">
                      {{ s.layers.length }} {{ s.layers.length === 1 ? 'layer' : 'layers' }}
                      @if (s.off.length) {
                        · {{ s.off.length }} off
                      }
                      · {{ s.campaign ? 'this campaign' : 'any campaign' }}
                      @if (gilt(s)) {
                        · <b>in play now</b>
                      }
                    </span>
                  </summary>
                  <ul class="setnamen">
                    @for (id of s.layers; track id) {
                      <li>{{ nameVon(id) }}</li>
                    }
                    @for (id of s.off; track id) {
                      <li class="dim">without {{ nameVon(id) }}</li>
                    }
                  </ul>
                </details>
                <span class="knoepfe">
                  <button
                    type="button"
                    class="klein"
                    [disabled]="d.may !== 'manage' || laeuft() || gilt(s)"
                    [title]="d.may === 'manage' ? 'Put exactly these layers in play' : 'The GM loads selections'"
                    (click)="auswahlLaden(s)"
                  >
                    Load
                  </button>
                  <button type="button" class="klein" [attr.aria-label]="'Delete ' + s.name" [disabled]="laeuft()" (click)="auswahlLoeschen(s)">×</button>
                </span>
              </li>
            } @empty {
              <li class="dim">Nothing saved yet. Save what is in play now to come back to it with one click.</li>
            }
          </ul>
          <form class="setneu" (submit)="auswahlSpeichern($event)">
            <input
              type="text"
              aria-label="Name of the selection"
              placeholder="Name, e.g. Only 2014 rules"
              maxlength="80"
              [value]="setName()"
              (input)="setName.set($any($event.target).value)"
            />
            <label class="haken">
              <input type="checkbox" [checked]="setNurHier()" (change)="setNurHier.set(!setNurHier())" />
              only this campaign
            </label>
            <button type="submit" class="klein" [disabled]="!setName().trim() || laeuft()">Save current</button>
          </form>
          <p class="fuss">Saved for your account. Loading one sets the layers in play for everyone in the campaign.</p>
        </details>
        <ul class="ebenen">
          @for (l of oben(); track l.id) {
            <li [class.aus]="!l.active">
              <label class="haken">
                <input
                  type="checkbox"
                  [checked]="l.active"
                  [disabled]="!aenderbar(l) || laeuft()"
                  (change)="umschalten(l)"
                />
                <span class="name">{{ l.name }}</span>
                <!-- Die Karte der Ebene (T-093) — der Name setzt das Häkchen, der Knopf nicht. -->
                <button type="button" class="quick-info" [nwQuick]="l.id" [attr.aria-label]="'Quick view of ' + l.name">i</button>
              </label>
              @if (l.publisher) {
                <span class="verlag" [title]="'Publisher: ' + l.publisher + (l.publisherWhy ? ' — ' + l.publisherWhy : '') + ' Change it on the layer.'">{{ l.publisher }}</span>
              }
              @if (l.readable && l.active) {
                <a class="lesen" [routerLink]="['/artikel', l.id]" [queryParams]="{ tab: 'read' }">Read</a>
              }
              <span class="dim">
                @if (l.kind) {
                  {{ l.kind }} ·
                }
                {{ zahl(l.articles) }} {{ l.articles === 1 ? 'article' : 'articles' }}
                @if (l.alsoIn.length) {
                  · also in {{ l.alsoIn.join(', ') }}
                }
                @if (!l.active && !l.canActivate && d.may === 'manage') {
                  · belongs to another campaign; the admin can turn it on
                }
              </span>
              <ng-container [ngTemplateOutlet]="auswahlTpl" [ngTemplateOutletContext]="{ $implicit: l }" />
              @if (!l.active) {
                <label class="vergleich" [title]="'Show versions from ' + l.name + ' on demand, without putting it in play'">
                  <input
                    type="checkbox"
                    [checked]="!!l.compare"
                    [disabled]="!aenderbar(l) || laeuft()"
                    (change)="vergleichen(l, $event)"
                  />
                  compare
                </label>
              }
            </li>
          } @empty {
            @if (!gruppen().length && !lose().length) {
              <li class="dim">There is no layer yet. Everything is in play.</li>
            }
          }
        </ul>
        @if (gruppen().length || lose().length) {
          <h3 data-bereich tabindex="-1">Books</h3>
          <p class="fuss">
            Each book from 5e.tools is a layer of its own, and the books sit in groups. Turn on a whole group, or
            single books; with the group on, unticking a book takes just that one out.
          </p>
          <div class="ansicht" role="group" aria-label="Group the books by">
            <span class="dim">Group by</span>
            <button type="button" [attr.aria-pressed]="ansicht() === 'category'" (click)="ansichtWaehlen('category')">category</button>
            <button type="button" [attr.aria-pressed]="ansicht() === 'publisher'" (click)="ansichtWaehlen('publisher')">publisher</button>
          </div>
          @for (g of gruppen(); track g.ebene.id) {
            <ng-container [ngTemplateOutlet]="gruppeTpl" [ngTemplateOutletContext]="{ $implicit: g }" />
          }
          @if (lose().length) {
            <details class="gruppe" data-bereich [open]="offen().has('-')" (toggle)="merke('-', $event)">
              <summary>
                <span class="gname">{{ ansicht() === 'publisher' ? 'No publisher group (Homebrew, Unknown)' : 'Other books' }}</span>
                <span class="dim">{{ anZahl(lose()) }} of {{ lose().length }} on</span>
              </summary>
              <ul class="ebenen buecher">
                @for (l of lose(); track l.id) {
                  <ng-container [ngTemplateOutlet]="buchTpl" [ngTemplateOutletContext]="{ $implicit: l }" />
                }
              </ul>
            </details>
          }
        }
        <ng-template #gruppeTpl let-g>
          <details class="gruppe" data-bereich [open]="offen().has(g.ebene.id)" (toggle)="merke(g.ebene.id, $event)">
            <summary>
              <input
                type="checkbox"
                class="ganz"
                [checked]="g.stand === 'an'"
                [indeterminate]="g.stand === 'teils'"
                [disabled]="!aenderbar(g.ebene) || laeuft()"
                [attr.aria-label]="'Turn the whole group ' + g.ebene.name + (g.stand === 'an' ? ' off' : ' on')"
                (click)="$event.stopPropagation()"
                (change)="gruppeSchalten(g)"
              />
              <span class="gname">{{ g.ebene.name }}</span>
              <button type="button" class="quick-info" [nwQuick]="g.ebene.id" [attr.aria-label]="'Quick view of ' + g.ebene.name">i</button>
              <span class="dim">{{ g.an }} of {{ g.gesamt }} on</span>
              <!-- Eine ganze Gruppe zum Vergleich (T-143), etwa „2024 rules": ihre Bücher vergleichen sich, soweit sie nicht im Spiel sind. -->
              @if (!g.ebene.inPlay) {
                <label
                  class="vergleich"
                  [title]="'Show versions from every book in ' + g.ebene.name + ' on demand, without putting them in play'"
                  (click)="$event.stopPropagation()"
                >
                  <input
                    type="checkbox"
                    [checked]="!!g.ebene.compare"
                    [disabled]="!aenderbar(g.ebene) || laeuft()"
                    [attr.aria-label]="'Compare the whole group ' + g.ebene.name"
                    (change)="vergleichen(g.ebene, $event)"
                  />
                  compare
                </label>
              }
              @if (g.ebene.about.description) {
                <span class="beschreibung">{{ g.ebene.about.description }}</span>
              }
            </summary>
            <div class="innen">
              <ng-container [ngTemplateOutlet]="auswahlTpl" [ngTemplateOutletContext]="{ $implicit: g.ebene }" />
              @for (u of g.untergruppen; track u.ebene.id) {
                <ng-container [ngTemplateOutlet]="gruppeTpl" [ngTemplateOutletContext]="{ $implicit: u }" />
              }
              <ul class="ebenen buecher">
                @for (l of g.ebenen; track l.id) {
                  <ng-container [ngTemplateOutlet]="buchTpl" [ngTemplateOutletContext]="{ $implicit: l }" />
                }
              </ul>
            </div>
          </details>
        </ng-template>
        <ng-template #buchTpl let-l>
          <li [class.aus]="!l.inPlay">
            <label class="haken">
              <input
                type="checkbox"
                [checked]="l.inPlay"
                [disabled]="!aenderbar(l) || laeuft()"
                (change)="buchSchalten(l)"
              />
              <span class="name">{{ l.name }}</span>
              <button type="button" class="quick-info" [nwQuick]="l.id" [attr.aria-label]="'Quick view of ' + l.name">i</button>
            </label>
            @if (l.publisher) {
              <span class="verlag" [title]="'Publisher: ' + l.publisher + (l.publisherWhy ? ' — ' + l.publisherWhy : '') + ' Change it on the layer.'">{{ l.publisher }}</span>
            }
            @if (l.readable && l.inPlay) {
              <a class="lesen" [routerLink]="['/artikel', l.id]" [queryParams]="{ tab: 'read' }">Read</a>
            }
            @if (!l.inPlay) {
              @if (ueberVergleich().has(l.id) && !l.compare) {
                <span class="vergleich dim" [title]="'Compared because its group is'">compared with its group</span>
              } @else {
                <label class="vergleich" [title]="'Show versions from ' + l.name + ' on demand, without putting it in play'">
                  <input
                    type="checkbox"
                    [checked]="!!l.compare"
                    [disabled]="!aenderbar(l) || laeuft()"
                    (change)="vergleichen(l, $event)"
                  />
                  compare
                </label>
              }
            }
            <span class="dim fakten">
              @if (l.about.abbreviation) {
                <abbr [title]="l.name">{{ l.about.abbreviation }}</abbr> ·
              }
              {{ fakten(l) }}
              @if (l.off) {
                · off in its group
              }
              @if (l.alsoIn.length) {
                · also in {{ l.alsoIn.join(', ') }}
              }
            </span>
            <ng-container [ngTemplateOutlet]="auswahlTpl" [ngTemplateOutletContext]="{ $implicit: l }" />
          </li>
        </ng-template>
        <ng-template #auswahlTpl let-l>
          @if ((l.active || l.compare) && hatInhalt(l)) {
            <details class="auswahl" [open]="offen().has('only:' + l.id)" (toggle)="merke('only:' + l.id, $event)">
              <summary>
                <span class="dim">Brings:</span> <span class="was">{{ auswahlText(l) }}</span>
                <!-- Woher die Auswahl kommt (T-187): die Typ-Regel einer Gruppe, oder ausgenommen. -->
                @if (!l.only && l.ruleFrom) {
                  <span class="dim regelher">· rule of {{ l.ruleFrom.name }}</span>
                } @else if (l.exempt) {
                  <span class="dim regelher">· exempt from type rules</span>
                }
              </summary>
              @if (d.may === 'manage' && !l.only && (l.ruleFrom || l.exempt)) {
                <p class="regelknopf">
                  @if (l.exempt) {
                    <button type="button" class="klein" [disabled]="laeuft()" (click)="ausnehmen(l, false)">Follow the type rule</button>
                  } @else {
                    <button type="button" class="klein" [disabled]="laeuft()" (click)="ausnehmen(l, true)">Bring everything anyway</button>
                    <span class="dim">A tick below sets this layer’s own choice; it wins over the rule.</span>
                  }
                </p>
              }
              <ng-container [ngTemplateOutlet]="bereicheTpl" [ngTemplateOutletContext]="{ $implicit: l, ziel: 'only' }" />
            </details>
          }
          <!-- Die Typ-Regel einer Gruppe (T-187): gilt für jede Ebene darin, die selbst nichts sagt. -->
          @if (l.kind === 'group' && hatInhalt(l) && (d.may === 'manage' || l.rule)) {
            <details class="auswahl regel" [open]="offen().has('rule:' + l.id)" (toggle)="merke('rule:' + l.id, $event)">
              <summary>
                <span class="dim">Type rule for its layers:</span> <span class="was">{{ auswahlText(l, 'rule') }}</span>
              </summary>
              <p class="fuss">
                Every layer in {{ l.name }} that is in play and says nothing itself brings only what you tick
                here — say, the rules, items and spells of every adventure, not their story.
              </p>
              <ng-container [ngTemplateOutlet]="bereicheTpl" [ngTemplateOutletContext]="{ $implicit: l, ziel: 'rule' }" />
            </details>
          }
        </ng-template>
        <ng-template #bereicheTpl let-l let-ziel="ziel">
          <div class="bereiche" role="group" [attr.aria-label]="(ziel === 'rule' ? 'Type rule of ' : 'What ') + l.name + (ziel === 'rule' ? '' : ' brings')">
            @for (b of auswahl(l, ziel); track b.area) {
              <div class="bereich">
                <label class="haken">
                  <input
                    type="checkbox"
                    [checked]="b.an"
                    [indeterminate]="b.teils"
                    [disabled]="d.may !== 'manage' || laeuft()"
                    (change)="bereichSchalten(l, b.area, ziel)"
                  />
                  <span>{{ b.label }}</span>
                  <span class="dim">{{ zahl(b.n) }}</span>
                </label>
                <details class="arten">
                  <summary class="dim">by type</summary>
                  <ul>
                    @for (a of b.arten; track a.type) {
                      <li>
                        <label class="haken">
                          <input
                            type="checkbox"
                            [checked]="a.an"
                            [disabled]="d.may !== 'manage' || laeuft()"
                            (change)="artSchalten(l, a.type, ziel)"
                          />
                          <span>{{ a.label }}</span>
                          <span class="dim">{{ zahl(a.n) }}</span>
                        </label>
                      </li>
                    }
                  </ul>
                </details>
              </div>
            }
          </div>
        </ng-template>
        <details class="sets" data-bereich [open]="!offen().has('compare-zu')" (toggle)="zuklappen('compare-zu', $event)">
          <summary>
            <span class="gname">Compare layers</span>
            <span class="dim">{{ vergleich().length }} marked</span>
          </summary>
        <p class="fuss">
          A layer marked <em>compare</em> is not in play and in no list. Its versions of an article show
          on demand next to the fields that differ, and the GM can take one over into this campaign.
          @if (vergleich().length) {
            Now: {{ vergleich().join(', ') }}.
          } @else {
            None yet.
          }
        </p>
        <label class="haken spieler">
          <input
            type="checkbox"
            [checked]="d.compareFor === 'players'"
            [disabled]="d.may !== 'manage' || laeuft()"
            (change)="spielerSehen($event)"
          />
          <span>Players see the compare layers too</span>
        </label>
        </details>
        <!-- Einzeln freigegeben (T-187): Extra-Inhalt aus Ebenen, die nicht im Spiel sind. -->
        <details class="sets" data-bereich [open]="!offen().has('extra-zu')" (toggle)="zuklappen('extra-zu', $event)">
          <summary>
            <span class="gname">Extra content</span>
            <span class="dim">{{ d.extra?.length ?? 0 }} enabled</span>
          </summary>
        <p class="fuss">
          Single articles in play although their layer is not — enable one on its page when it comes from a
          compare layer.
        </p>
        @if (d.extra?.length) {
          <ul class="extra">
            @for (x of d.extra; track x.id) {
              <li>
                <a [routerLink]="['/artikel', x.id]" [nwQuick]="x.id">{{ x.name }}</a>
                <span class="dim">{{ artName(x.type) }} · {{ x.layers.join(', ') }}</span>
                @if (!x.inPlay) {
                  <span class="dim">· removed by a layer in play</span>
                }
                @if (d.may === 'manage') {
                  <button type="button" class="klein" [disabled]="laeuft()" [attr.aria-label]="'Disable ' + x.name" (click)="zuruecknehmen(x.id)">Disable</button>
                }
              </li>
            }
          </ul>
        } @else {
          <p class="dim">None yet.</p>
        }
        </details>
        @if (d.may === 'see') {
          <p class="fuss">A co-GM sees the layers; the GM turns them on.</p>
        }
      } @else if (!fehler()) {
        <p class="dim">Loading…</p>
      }
    </section>
  `,
  styles: `
    /* Wie die übrigen Kästen der Kampagnenseite (verwaltung.scss). */
    .kasten {
      min-width: 0;
      margin: 0 1.5rem 1rem;
      padding: 0.9rem;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--surface);
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }
    @media (max-width: 640px) {
      .kasten {
        margin: 0 1rem 1rem;
      }
    }
    /* Gespeicherte Auswahlen (T-186): aufklappbar wie die Gruppen, je Auswahl ihr Inhalt. */
    .sets {
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 0.3rem 0.6rem;
    }
    .sets > summary {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      align-items: baseline;
      min-height: 32px;
      cursor: pointer;
    }
    .setliste {
      list-style: none;
      margin: 0.3rem 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .setliste > li {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      justify-content: space-between;
      gap: 0.4rem;
      padding: 0.2rem 0;
      border-bottom: 1px solid var(--line2, var(--line));
    }
    .setliste > li.gilt .name {
      color: var(--accent);
    }
    .setinhalt {
      flex: 1 1 14rem;
      min-width: 0;
    }
    .setinhalt summary {
      cursor: pointer;
    }
    .setinhalt .dim {
      margin-left: 0.3rem;
    }
    .setnamen {
      margin: 0.2rem 0 0.2rem 1.2rem;
      padding: 0;
      font-size: 0.85rem;
    }
    .setneu {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.4rem;
      margin: 0.3rem 0;
    }
    .setneu input[type='text'] {
      flex: 1 1 12rem;
      min-width: 0;
      min-height: 36px;
    }
    .kasten.kompakt {
      margin: 0;
      padding: 0;
      border: 0;
      background: none;
    }
    h2 {
      margin: 0 0 0.25rem;
      font-family: var(--caps);
      font-size: 1.25rem;
      color: var(--accent);
    }
    .fuss {
      margin: 0;
      font-size: 0.82rem;
      color: var(--dim);
    }
    .ebenen {
      margin: 0.5rem 0 0;
      padding: 0;
      list-style: none;
      display: flex;
      flex-direction: column;
    }
    li {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.25rem 0.75rem;
      padding: 0.45rem 0;
      border-top: 1px solid var(--line2);
    }
    li:first-child {
      border-top: 0;
    }
    li.aus .name {
      color: var(--dim);
    }
    /* „Read" (T-091): die Leseansicht des Buchs. */
    .lesen {
      display: inline-flex;
      align-items: center;
      min-height: 40px;
      font-weight: 600;
    }
    .haken {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      min-height: 40px;
      flex: 1 1 14rem;
      min-width: 0;
    }
    .haken input {
      width: 1.1rem;
      height: 1.1rem;
    }
    .name {
      font-weight: 700;
      overflow-wrap: anywhere;
    }
    .dim {
      color: var(--dim);
    }
    .knoepfe {
      display: inline-flex;
      gap: 0.25rem;
      margin-left: auto;
    }
    .klein {
      min-width: 40px;
      min-height: 36px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--surface);
      cursor: pointer;
    }
    .klein[disabled] {
      opacity: 0.4;
      cursor: default;
    }
    .fehler {
      color: var(--warn);
    }
    h3 {
      margin: 0.75rem 0 0;
      font-family: var(--caps);
      font-size: 1.05rem;
      color: var(--accent);
    }
    .gruppe {
      border-top: 1px solid var(--line2);
    }
    .gruppe > summary {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.25rem 0.75rem;
      min-height: 40px;
      cursor: pointer;
    }
    .gruppe > summary::-webkit-details-marker {
      display: none;
    }
    .gruppe > summary::before {
      content: '▸';
      color: var(--dim);
    }
    .gruppe[open] > summary::before {
      content: '▾';
    }
    .gname {
      font-weight: 700;
    }
    .buecher {
      margin: 0 0 0.25rem 1.1rem;
    }
    .vergleich {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      min-height: 36px;
      margin-left: auto;
      font-size: 0.85rem;
      color: var(--dim);
    }
    .vergleich input {
      width: 1rem;
      height: 1rem;
    }
    .spieler {
      flex: 0 0 auto;
    }
    .ganz {
      width: 1.1rem;
      height: 1.1rem;
      margin: 0;
    }
    .beschreibung {
      flex: 1 1 100%;
      font-size: 0.82rem;
      color: var(--dim);
    }
    .innen {
      margin-left: 1.1rem;
    }
    .fakten {
      flex: 1 1 100%;
      font-size: 0.85rem;
      overflow-wrap: anywhere;
    }
    /* Der Herausgeber als Marke (T-094), wie hinter einem Quellenkürzel. */
    .verlag {
      padding: 0 0.45em;
      border: 1px solid var(--line);
      border-radius: 999px;
      font-size: 0.78rem;
      line-height: 1.6;
      color: var(--dim);
      white-space: nowrap;
    }
    .ansicht {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.4rem;
      margin: 0.25rem 0;
      font-size: 0.85rem;
    }
    .ansicht button {
      min-height: 36px;
      padding: 0 0.8rem;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--surface);
      color: inherit;
      cursor: pointer;
    }
    .ansicht button[aria-pressed='true'] {
      border-color: var(--accent);
      color: var(--accent);
      font-weight: 700;
    }
    /* Was eine Ebene bringt (T-105): aufklappbar, Bereiche nebeneinander. */
    .auswahl {
      flex: 1 1 100%;
      font-size: 0.88rem;
    }
    .auswahl > summary {
      min-height: 36px;
      display: flex;
      align-items: center;
      gap: 0.35rem;
      cursor: pointer;
    }
    .auswahl > summary::-webkit-details-marker,
    .arten > summary::-webkit-details-marker {
      display: none;
    }
    .auswahl > summary::before,
    .arten > summary::before {
      content: '▸';
      color: var(--dim);
    }
    .auswahl[open] > summary::before,
    .arten[open] > summary::before {
      content: '▾';
    }
    .auswahl .regelher {
      font-size: 0.85em;
    }
    .regelknopf {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0.5rem;
      margin: 0.3rem 0;
    }
    .vorrang h4 {
      margin: 0.8rem 0 0.2rem;
      font-size: 0.9rem;
    }
    .vorrangwahl {
      display: flex;
      flex-wrap: wrap;
      gap: 0.3rem;
      margin-top: 0.3rem;
    }
    .vorrangwahl select {
      min-height: 32px;
      max-width: 100%;
    }
    .extra {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .extra li {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0.4rem;
    }
    .auswahl .was {
      font-weight: 600;
      overflow-wrap: anywhere;
    }
    .bereiche {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem 1.25rem;
      padding: 0 0 0.25rem 1.1rem;
    }
    .bereich {
      flex: 0 1 12rem;
      min-width: 0;
    }
    .bereich .haken {
      flex: 0 1 auto;
      min-height: 36px;
    }
    .arten summary {
      min-height: 32px;
      display: flex;
      align-items: center;
      gap: 0.35rem;
      cursor: pointer;
      font-size: 0.82rem;
    }
    .arten ul {
      margin: 0 0 0 0.75rem;
      padding: 0;
      list-style: none;
    }
    .arten li {
      padding: 0;
      border: 0;
    }
    .fakten abbr {
      text-decoration: underline dotted;
      cursor: help;
    }
  `,
})
export class KampagnenEbenenListe {
  readonly kampagne = input.required<string>();
  /** Im Popup der Kopfleiste (T-143): ohne eigenen Kasten und Überschrift. */
  readonly kompakt = input(false);
  /** Nach jedem Schalten — die Geschichte der Kampagne liest dann neu (T-082). */
  readonly geschaltet = output<void>();

  private readonly api = inject(Api);
  private readonly bestand = inject(Bestand);
  private readonly session = inject(Session);
  protected readonly daten = signal<KampagnenEbenen | null>(null);
  protected readonly fehler = signal<string | null>(null);
  protected readonly laeuft = signal(false);

  constructor() {
    /* Das Register sagt den Bereich jeder Art (T-105) und die Namen im Inhalt. */
    void this.bestand.load();
    effect(() => {
      const c = this.kampagne();
      void this.laden(c);
    });
    void this.setsLaden();
    /* Schreibt jemand anders die Kampagne (ein zweites Gerät, ein anderer
       Reiter), kommt der Stand neu — die Revision, gegen die der Stapel
       geschickt wird (`If-Match`, T-449), bleibt so die frische. */
    const ab = inject(Live).onArtikel((ev) => {
      const c = this.kampagne();
      if (ev.id !== c || this.laeuft()) return;
      if (ev.kind === 'changed' && ev.revision != null && ev.revision === this.daten()?.campaign.revision) return;
      void this.laden(c);
    });
    inject(DestroyRef).onDestroy(ab);
  }

  /**
   * Nach dem Schreiben den Stand übernehmen, den der Server mitschickt
   * (T-143) — sonst noch einmal fragen. Ein Hin und Her weniger je Häkchen.
   */
  private async uebernehmen(c: string, r: { state?: KampagnenEbenen | null } | null): Promise<void> {
    if (r?.state && c === this.kampagne()) {
      this.daten.set(r.state);
      this.merkeStand();
      this.fehler.set(null);
    } else {
      await this.laden(c);
    }
  }

  /** Unter welchem Schlüssel der letzte Stand steht: Konto, Sicht, Kampagne. */
  private schluessel(c = this.kampagne()): string {
    return `${this.session.user()?.id ?? ''}|${this.session.viewAs()?.id ?? ''}|${c}`;
  }

  private merkeStand(): void {
    const d = this.daten();
    if (!d) return;
    const alt = ZULETZT.get(this.schluessel());
    ZULETZT.set(this.schluessel(), {
      daten: d,
      offen: this.offenGeladen ? this.offen() : (alt?.offen ?? null),
      ansicht: this.offenGeladen ? this.ansicht() : (alt?.ansicht ?? null),
    });
  }

  private async laden(c: string): Promise<void> {
    const z = ZULETZT.get(this.schluessel(c));
    if (z && !this.daten()) {
      this.daten.set(z.daten);
      if (z.ansicht) this.ansicht.set(z.ansicht);
      if (z.offen) this.offen.set(new Set(z.offen));
    }
    try {
      const d = await this.api.campaignLayers(c);
      if (c !== this.kampagne()) return;
      this.daten.set(d);
      this.fehler.set(null);
      await this.offenLaden();
      this.merkeStand();
    } catch (error) {
      this.daten.set(null);
      this.fehler.set(error instanceof Error ? error.message : String(error));
    }
  }

  /** Die Ebenen, die weder Gruppe noch Mitglied einer Gruppe noch ein Buch sind — der Stapel mit Pfeilen. */
  protected readonly oben = computed(() => {
    const l = (this.daten()?.layers ?? []).filter((x) => x.kind !== 'group' && !x.groups.length && !BUCHARTEN.has(x.kind));
    return [...l.filter((x) => x.active).reverse(), ...l.filter((x) => !x.active)];
  });

  protected readonly nachId = computed(() => new Map((this.daten()?.layers ?? []).map((x) => [x.id, x])));

  /**
   * **Die Gruppen als Baum** (T-088): oben die Gruppen, die in keiner
   * anderen hängen; darin Untergruppen und Bücher (nach Erscheinen, wie der
   * Server sie schickt). Ein Kreis bricht ab.
   */
  protected readonly gruppen = computed<Gruppe[]>(() => {
    const m = this.nachId();
    const knoten = (g: KampagnenEbene, gesehen: Set<string>): Gruppe => {
      const innen = (g.members ?? []).map((id) => m.get(id)).filter((x): x is KampagnenEbene => !!x && !gesehen.has(x.id));
      const weiter = new Set([...gesehen, ...innen.map((x) => x.id)]);
      const untergruppen = innen.filter((x) => x.kind === 'group').map((x) => knoten(x, weiter));
      const ebenen = innen.filter((x) => x.kind !== 'group');
      const blaetter = new Map<string, KampagnenEbene>(ebenen.map((x) => [x.id, x]));
      const sammle = (u: Gruppe) => {
        for (const x of u.ebenen) blaetter.set(x.id, x);
        u.untergruppen.forEach(sammle);
      };
      untergruppen.forEach(sammle);
      const alle = [...blaetter.values()];
      const an = this.anZahl(alle);
      return { ebene: g, untergruppen, ebenen, gesamt: alle.length, an, stand: gruppenHaken(g, alle) };
    };
    const ansicht = this.ansicht();
    const gruppen = (this.daten()?.layers ?? []).filter((x) => x.kind === 'group' && (x.groupBy ?? 'category') === ansicht);
    return gruppen
      .filter((g) => !g.groups.some((p) => m.get(p)?.kind === 'group'))
      .map((g) => knoten(g, new Set([g.id])));
  });

  /** Bücher ohne Gruppe dieser Ansicht — etwa bevor die Migration sie einhängte (T-094: je Ansicht). */
  protected readonly lose = computed(() =>
    (this.daten()?.layers ?? [])
      .filter((x) => BUCHARTEN.has(x.kind) && !x.groups.some((g) => (this.nachId().get(g)?.groupBy ?? 'category') === this.ansicht()))
      .sort((a, b) => a.name.localeCompare(b.name, 'en')),
  );

  protected anZahl(l: KampagnenEbene[]): number {
    return l.filter((x) => x.inPlay).length;
  }

  /** „2017-11-21 · Wizards RPG Team · 2014 rules · levels 1–5 · Spell 312, Feat 40" (REQ-245). */
  protected fakten(l: KampagnenEbene): string {
    const a = l.about;
    const reg = this.bestand.registry();
    const inhalt = Object.entries(l.content ?? {})
      .sort((x, y) => y[1] - x[1])
      .slice(0, 4)
      .map(([t, n]) => `${reg?.interfaces[t]?.label ?? t} ${this.zahl(n)}`);
    const mehr = Object.keys(l.content ?? {}).length > 4 ? ` … ${this.zahl(l.articles)} in all` : '';
    return [
      a.published,
      a.author,
      a.version ? `${a.version} rules` : '',
      a.levels ? `levels ${a.levels}` : '',
      a.storyline,
      inhalt.length ? inhalt.join(', ') + mehr : `${this.zahl(l.articles)} ${l.articles === 1 ? 'article' : 'articles'}`,
    ]
      .filter(Boolean)
      .join(' · ');
  }

  /** Welche Gruppen aufgeklappt sind — gemerkt am Konto (T-088), über ein Neuladen hinweg. */
  protected readonly offen = signal(new Set<string>());
  private offenGeladen = false;

  /** Nach Kategorie oder nach Herausgeber (T-094) — gemerkt am Konto. */
  protected readonly ansicht = signal<Ansicht>('category');

  protected ansichtWaehlen(a: Ansicht): void {
    if (this.ansicht() === a) return;
    this.ansicht.set(a);
    this.merkeStand();
    void this.api.setPref(ANSICHT_PREF, a).catch(() => {
      /* Nicht gemerkt ist nicht schlimm: die Ansicht gilt trotzdem. */
    });
  }

  protected merke(key: string, ev: Event): void {
    const auf = (ev.target as HTMLDetailsElement).open;
    const s = new Set(this.offen());
    if (auf === s.has(key)) return;
    if (auf) s.add(key);
    else s.delete(key);
    this.offen.set(s);
    this.merkeStand();
    this.offenSpeichern();
  }

  /** Ein Abschnitt, der offen anfängt (T-188): gemerkt wird, dass er zu ist. */
  protected zuklappen(key: string, ev: Event): void {
    const zu = !(ev.target as HTMLDetailsElement).open;
    const s = new Set(this.offen());
    if (zu === s.has(key)) return;
    if (zu) s.add(key);
    else s.delete(key);
    this.offen.set(s);
    this.merkeStand();
    this.offenSpeichern();
  }

  /**
   * Gespeichert wird einmal nach dem letzten Klappen: „Expand all" (T-220)
   * klappt vierzig Gruppen, und vierzig Schreibzugriffe mit je einem
   * halben Stand wären vierzig Gelegenheiten, in falscher Reihenfolge
   * anzukommen.
   */
  private offenTimer: ReturnType<typeof setTimeout> | null = null;
  private offenSpeichern(): void {
    if (this.offenTimer) clearTimeout(this.offenTimer);
    this.offenTimer = setTimeout(() => {
      this.offenTimer = null;
      void this.api.setPref(OFFEN_PREF, [...this.offen()]).catch(() => {
        /* Nicht gemerkt ist nicht schlimm: der Abschnitt steht trotzdem so. */
      });
    }, 300);
  }

  private async offenLaden(): Promise<void> {
    if (this.offenGeladen) return;
    this.offenGeladen = true;
    try {
      const alle = await this.api.prefs();
      if (alle[ANSICHT_PREF] === 'publisher' || alle[ANSICHT_PREF] === 'category') this.ansicht.set(alle[ANSICHT_PREF]);
      const p = alle[OFFEN_PREF];
      if (Array.isArray(p)) {
        this.offen.set(new Set(p.filter((x): x is string => typeof x === 'string')));
        return;
      }
    } catch {
      /* ohne gemerkten Stand: siehe unten */
    }
    /* Noch nichts gemerkt: offen ist, worin etwas läuft. */
    this.offen.set(new Set(this.gruppen().filter((g) => g.an > 0).map((g) => g.ebene.id)));
  }

  /** Was eine Ebene enthält, je Art — bei einer Gruppe die Summe ihrer Mitglieder, verschachtelt (T-105). */
  private inhalt(l: KampagnenEbene): Record<string, number> {
    if (l.kind !== 'group') return l.content ?? {};
    const m = this.nachId();
    const summe: Record<string, number> = {};
    const gesehen = new Set<string>([l.id]);
    const lauf = (g: KampagnenEbene) => {
      for (const id of g.members ?? []) {
        const x = m.get(id);
        if (!x || gesehen.has(id)) continue;
        gesehen.add(id);
        for (const [t, n] of Object.entries(x.content ?? {})) summe[t] = (summe[t] ?? 0) + n;
        lauf(x);
      }
    };
    lauf(l);
    return summe;
  }

  /** Nur wo etwas drin ist, gibt es etwas zu wählen. */
  protected hatInhalt(l: KampagnenEbene): boolean {
    return Object.keys(this.inhalt(l)).length > 0;
  }

  private bereichVon(t: string): string {
    const reg = this.bestand.registry();
    return reg ? areaOf(reg, t) : '';
  }

  private bereichName(a: string): string {
    return a ? a[0]!.toUpperCase() + a.slice(1) : 'Other';
  }

  protected artName(t: string): string {
    return this.bestand.registry()?.interfaces[t]?.label ?? t;
  }

  /**
   * Die Auswahl, die gerade gilt (T-105, T-187): an einer Ebene die eigene,
   * sonst die Typ-Regel ihrer Gruppe; an einer Gruppe als Regel ihre Regel.
   */
  private wirksam(l: KampagnenEbene, ziel: Ziel): Auswahl | null {
    if (ziel === 'rule') return l.rule ?? null;
    return l.only ?? (l.exempt ? null : (l.ruleFrom?.only ?? null));
  }

  /** Die Bereiche und Arten einer Ebene mit Zählern und Häkchen (T-105). */
  protected auswahl(l: KampagnenEbene, ziel: Ziel = 'only'): AuswahlBereich[] {
    const f = this.wirksam(l, ziel);
    const je = new Map<string, AuswahlBereich>();
    for (const [t, n] of Object.entries(this.inhalt(l))) {
      const a = this.bereichVon(t);
      const b = je.get(a) ?? { area: a, label: this.bereichName(a), n: 0, an: false, teils: false, arten: [] };
      b.n += n;
      const bereichAn = !f || (!!a && !!f.areas?.includes(a));
      b.arten.push({ type: t, label: this.artName(t), n, an: bereichAn || !!f?.types?.includes(t) });
      je.set(a, b);
    }
    const rang = (a: string) => (a === '' ? 99 : BEREICHE.includes(a) ? BEREICHE.indexOf(a) : 50);
    return [...je.values()]
      .map((b) => {
        b.arten.sort((x, y) => x.label.localeCompare(y.label, 'en'));
        const alle = b.arten.every((x) => x.an);
        return { ...b, an: alle, teils: !alle && b.arten.some((x) => x.an) };
      })
      .sort((x, y) => rang(x.area) - rang(y.area) || x.label.localeCompare(y.label, 'en'));
  }

  /** „everything", „Rules, Item" oder „nothing" (T-105). */
  protected auswahlText(l: KampagnenEbene, ziel: Ziel = 'only'): string {
    const f = this.wirksam(l, ziel);
    if (!f) return ziel === 'rule' ? 'none — each layer brings everything' : 'everything';
    const teile = [...(f.areas ?? []).map((a) => this.bereichName(a)), ...(f.types ?? []).map((t) => this.artName(t))];
    return teile.length ? teile.join(', ') : 'nothing';
  }

  /** Die Auswahl als Häkchen je Art — der Ausgangspunkt jeder Änderung. */
  private haken(l: KampagnenEbene, ziel: Ziel): Map<string, { area: string; an: boolean }> {
    const out = new Map<string, { area: string; an: boolean }>();
    for (const b of this.auswahl(l, ziel)) for (const a of b.arten) out.set(a.type, { area: b.area, an: a.an });
    return out;
  }

  /**
   * Aus den Häkchen je Art die Auswahl, die an die Kante geht: ein Bereich,
   * dessen Arten alle an sind, steht als Bereich da (dann kommt eine neue
   * Art darin mit); sind alle an, keine Auswahl — alles.
   */
  private auswahlAus(h: Map<string, { area: string; an: boolean }>): Auswahl | null {
    if ([...h.values()].every((x) => x.an)) return null;
    const bereiche = new Map<string, boolean>();
    for (const x of h.values()) if (x.area) bereiche.set(x.area, (bereiche.get(x.area) ?? true) && x.an);
    const areas = [...bereiche].filter(([, an]) => an).map(([a]) => a);
    const types = [...h].filter(([, x]) => x.an && !(x.area && areas.includes(x.area))).map(([t]) => t);
    return { areas, ...(types.length ? { types } : {}) };
  }

  protected bereichSchalten(l: KampagnenEbene, area: string, ziel: Ziel = 'only'): void {
    const h = this.haken(l, ziel);
    const imBereich = [...h.values()].filter((x) => x.area === area);
    const an = !imBereich.every((x) => x.an);
    for (const x of imBereich) x.an = an;
    void this.auswahlSchreiben(l, this.auswahlAus(h), ziel);
  }

  protected artSchalten(l: KampagnenEbene, type: string, ziel: Ziel = 'only'): void {
    const h = this.haken(l, ziel);
    const x = h.get(type);
    if (!x) return;
    x.an = !x.an;
    void this.auswahlSchreiben(l, this.auswahlAus(h), ziel);
  }

  /** Von der Typ-Regel ausnehmen oder ihr wieder folgen (T-187). */
  protected ausnehmen(l: KampagnenEbene, exempt: boolean): void {
    void this.aendern(() => this.api.setLayerExempt(this.kampagne(), l.id, exempt));
  }

  /** Einen freigegebenen Artikel zurücknehmen (T-187). */
  /** Vorrang je Art (T-403): eine Zeile je Ebene und Art. */
  protected readonly artVorrang = computed(() =>
    (this.daten()?.preferences ?? []).filter((p) => p.kind === 'layer').flatMap((p) => p.types.map((type) => ({ ...p, type }))),
  );
  protected readonly artikelVorrang = computed(() => (this.daten()?.preferences ?? []).filter((p) => p.kind === 'article'));
  /** Die Arten, die die Ebenen im Spiel bringen. */
  protected readonly vorrangArten = computed(() => {
    const arten = new Set<string>();
    for (const l of this.daten()?.layers ?? []) if (l.active) for (const t of Object.keys(l.content ?? {})) arten.add(t);
    return [...arten].sort((a, b) => this.artName(a).localeCompare(this.artName(b), 'en'));
  });
  protected readonly vorrangArt = signal('');
  protected readonly vorrangEbene = signal('');
  protected vorrangSetzen(): void {
    const t = this.vorrangArt();
    const l = this.vorrangEbene();
    if (!t || !l) return;
    void this.aendern(async () => {
      const r = await this.api.prefer(this.kampagne(), l, { types: [t] });
      this.vorrangArt.set('');
      this.vorrangEbene.set('');
      return r;
    });
  }
  protected vorrangWeg(to: string, type?: string): void {
    void this.aendern(async () => {
      return this.api.unprefer(this.kampagne(), to, type);
    });
  }

  protected zuruecknehmen(id: string): void {
    void this.aendern(() => this.api.setEnabled(this.kampagne(), id, false));
  }

  private async aendern(tu: () => Promise<{ state?: KampagnenEbenen | null }>): Promise<void> {
    this.laeuft.set(true);
    try {
      await this.uebernehmen(this.kampagne(), await tu());
      this.geschaltet.emit();
    } catch (error) {
      this.fehler.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.laeuft.set(false);
    }
  }

  private async auswahlSchreiben(l: KampagnenEbene, only: Auswahl | null, ziel: Ziel = 'only'): Promise<void> {
    const c = this.kampagne();
    this.laeuft.set(true);
    try {
      await this.uebernehmen(c, await (ziel === 'rule' ? this.api.setLayerRule(c, l.id, only) : this.api.setLayerOnly(c, l.id, only)));
      this.geschaltet.emit();
    } catch (error) {
      this.fehler.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.laeuft.set(false);
    }
  }

  /** Bringt eine aufgeschaltete Gruppe diese Ebene? */
  private ueberGruppe(l: KampagnenEbene): boolean {
    const m = this.nachId();
    return l.groups.some((g) => m.get(g)?.inPlay === true);
  }

  /**
   * Die ganze Gruppe an oder aus (T-088): ganz an heisst aus, sonst an —
   * mit allem darin, ohne die alte Teilwahl (T-185, `groupSwitched` am
   * Server).
   */
  protected async gruppeSchalten(g: Gruppe): Promise<void> {
    const c = this.kampagne();
    this.laeuft.set(true);
    try {
      await this.uebernehmen(c, await this.api.switchGroup(c, g.ebene.id, g.stand !== 'an'));
      this.geschaltet.emit();
    } catch (error) {
      this.fehler.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.laeuft.set(false);
    }
  }

  /**
   * Ein Buch an oder aus. Ist es über seine Gruppe im Spiel, nimmt „aus"
   * es nur aus der Gruppe (`off`); ist die Gruppe aus, schaltet „an" das
   * Buch für sich auf.
   */
  protected buchSchalten(l: KampagnenEbene): void {
    const stapel = this.stapel();
    const aus = this.abgeschaltet();
    if (l.inPlay) {
      const ohne = stapel.filter((id) => id !== l.id);
      if (this.ueberGruppe(l)) void this.schreiben(ohne, undefined, [...aus, l.id]);
      else void this.schreiben(ohne);
    } else if (this.ueberGruppe(l) || l.off) {
      const ohne = aus.filter((id) => id !== l.id);
      /* Bringt nach dem Zurücknehmen keine Gruppe es, kommt es für sich dazu. */
      if (l.groups.some((g) => this.nachId().get(g)?.inPlay)) void this.schreiben(stapel, undefined, ohne);
      else void this.schreiben(null, l.id);
    } else {
      void this.schreiben(null, l.id);
    }
  }

  private abgeschaltet(): string[] {
    return (this.daten()?.layers ?? []).filter((x) => x.off).map((x) => x.id);
  }

  /** Die Namen der Vergleichsebenen (T-092). */
  protected readonly vergleich = computed(() =>
    (this.daten()?.layers ?? []).filter((x) => x.compare).map((x) => x.name),
  );

  /** Was über eine Gruppe zum Vergleich kommt (T-143), verschachtelt — wie `playStack` es rechnet. */
  protected readonly ueberVergleich = computed(() => {
    const m = this.nachId();
    const out = new Set<string>();
    const lauf = (g: KampagnenEbene) => {
      for (const id of g.members ?? []) {
        const x = m.get(id);
        if (!x || out.has(id)) continue;
        out.add(id);
        if (x.kind === 'group') lauf(x);
      }
    };
    for (const g of this.daten()?.layers ?? []) if (g.kind === 'group' && g.compare) lauf(g);
    return out;
  });

  /** Eine Ebene zum Vergleich dazu oder weg (T-092) — nur eine, die nicht im Spiel ist; auch eine ganze Gruppe (T-143). */
  protected vergleichen(l: KampagnenEbene, ev?: Event): void {
    const jetzt = (this.daten()?.layers ?? []).filter((x) => x.compare).map((x) => x.id);
    const neu = l.compare ? jetzt.filter((id) => id !== l.id) : [...jetzt, l.id];
    /* Geht es nicht durch (409, T-449), zeigt das Häkchen den Stand, der
       gilt — die Bindung allein setzt es nicht zurück, ihr Wert blieb gleich. */
    const haken = ev?.target as HTMLInputElement | undefined;
    void this.vergleichSchreiben({ layers: neu }, () => {
      if (haken) haken.checked = !!this.daten()?.layers.find((x) => x.id === l.id)?.compare;
    });
  }

  protected spielerSehen(ev: Event): void {
    void this.vergleichSchreiben({ players: (ev.target as HTMLInputElement).checked });
  }

  private async vergleichSchreiben(neu: { layers?: string[]; players?: boolean }, zurueck?: () => void): Promise<void> {
    const c = this.kampagne();
    this.laeuft.set(true);
    try {
      await this.uebernehmen(c, await this.api.setCampaignCompare(c, neu, this.daten()?.campaign.revision));
      this.geschaltet.emit();
    } catch (error) {
      await this.gescheitert(c, error);
      zurueck?.();
    } finally {
      this.laeuft.set(false);
    }
  }

  /** Die gespeicherten Auswahlen (T-186): die dieses Kontos ohne Kampagne und die für diese. */
  private readonly alleSets = signal<Ebenenauswahl[]>([]);
  protected readonly sets = computed(() => this.alleSets().filter((s) => !s.campaign || s.campaign === this.kampagne()));
  protected readonly setName = signal('');
  protected readonly setNurHier = signal(true);
  protected readonly setHinweis = signal<string | null>(null);

  private async setsLaden(): Promise<void> {
    try {
      this.alleSets.set((await this.api.layerSets()).sets);
    } catch {
      /* Ohne Antwort bleibt die Liste leer — Häkchen gehen trotzdem. */
    }
  }

  protected gilt(s: Ebenenauswahl): boolean {
    return auswahlGilt(s, this.daten()?.layers ?? []);
  }

  protected nameVon(id: string): string {
    return this.nachId().get(id)?.name ?? 'a layer that is gone';
  }

  protected async auswahlSpeichern(ev: Event): Promise<void> {
    ev.preventDefault();
    const name = this.setName().trim();
    if (!name) return;
    const stand = auswahlAusStand(this.daten()?.layers ?? []);
    try {
      const neu = await this.api.saveLayerSet({ name, campaign: this.setNurHier() ? this.kampagne() : null, ...stand });
      this.alleSets.update((l) => (l.some((x) => x.id === neu.id) ? l.map((x) => (x.id === neu.id ? neu : x)) : [...l, neu]));
      this.setName.set('');
      this.setHinweis.set(`Saved “${neu.name}”.`);
    } catch (error) {
      this.fehler.set(error instanceof Error ? error.message : String(error));
    }
  }

  protected async auswahlLaden(s: Ebenenauswahl): Promise<void> {
    const r = auswahlAnwenden(s, this.daten()?.layers ?? []);
    this.fehler.set(null);
    await this.schreiben(r.layers, undefined, r.off);
    if (this.fehler()) return;
    this.setHinweis.set(
      r.fehlt
        ? `Loaded “${s.name}” — ${r.fehlt} ${r.fehlt === 1 ? 'layer is' : 'layers are'} gone or belong to another campaign and stayed out.`
        : `Loaded “${s.name}”.`,
    );
  }

  protected async auswahlLoeschen(s: Ebenenauswahl): Promise<void> {
    try {
      await this.api.deleteLayerSet(s.id);
      this.alleSets.update((l) => l.filter((x) => x.id !== s.id));
      this.setHinweis.set(`Deleted “${s.name}”.`);
    } catch (error) {
      this.fehler.set(error instanceof Error ? error.message : String(error));
    }
  }

  /** Der Stapel von unten nach oben, wie der Server ihn will. */
  protected stapel(): string[] {
    return (this.daten()?.layers ?? []).filter((x) => x.active).map((x) => x.id);
  }

  protected aenderbar(l: KampagnenEbene): boolean {
    if (this.daten()?.may !== 'manage') return false;
    return l.active || l.canActivate;
  }

  protected zahl(n: number): string {
    return n.toLocaleString('en');
  }

  protected umschalten(l: KampagnenEbene): void {
    if (l.active) {
      void this.schreiben(this.stapel().filter((id) => id !== l.id));
    } else {
      /* Der Server setzt eine neue Ebene dorthin, wo ihre Spezifität sie
         hinstellt (ein Regelwerk unten); verschieben geht danach. */
      void this.schreiben(null, l.id);
    }
  }

  /** Der neue Stapel aus der Reihenfolge (T-188), von unten nach oben; die Abschaltungen bleiben. */
  protected ordnen(stapel: string[]): void {
    void this.schreiben(stapel);
  }

  private async schreiben(stapel: string[] | null, dazu?: string, off?: string[]): Promise<void> {
    const c = this.kampagne();
    this.laeuft.set(true);
    try {
      const r = stapel ? await this.api.setCampaignLayers(c, stapel, off, this.daten()?.campaign.revision) : dazu ? await this.api.activateLayer(c, dazu) : null;
      await this.uebernehmen(c, r);
      this.geschaltet.emit();
    } catch (error) {
      await this.gescheitert(c, error);
    } finally {
      this.laeuft.set(false);
    }
  }

  /** Hat inzwischen jemand anders geschaltet (409, T-449), steht danach der
   *  frische Stand da — sonst wäre der nächste Klick wieder gegen den alten. */
  private async gescheitert(c: string, error: unknown): Promise<void> {
    if (error instanceof ApiError && error.status === 409 && (error.body as { conflict?: unknown } | undefined)?.conflict) {
      await this.laden(c);
      this.fehler.set('Someone else changed this campaign at the same moment. This is the latest state — do it again if you still want to.');
      return;
    }
    this.fehler.set(error instanceof Error ? error.message : String(error));
  }
}

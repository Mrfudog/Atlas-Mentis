import { Component, computed, effect, forwardRef, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  areaOf,
  choicesOf,
  BOOK_CARDS,
  edgeEffects,
  edgeEffectText,
  forArticle,
  layoutFor,
  LAYER_RELATION,
  typeChain,
  entityName,
  entriesOf,
  entryRef,
  enumOptions,
  fieldTarget,
  isAsset,
  fieldTitle,
  offeredAssetKind,
  mergeEntity,
  proseFields,
  relationsFrom,
  primaryInterface,
  relationDef,
  resolveView,
  isBookPart,
  isMap,
} from '@nw/model';
import type { Entity, IncomingEdge, LayoutElement, MergeSide, PropertySchema, Registry, VarScopes, ViewDef } from '@nw/model';
import { isDesignedView, layoutFor as anordnungFuer, viewFor, viewsFor } from '@nw/model';
import { Api, ApiError, type Fassungen, type Fertigungswert, type LeseZiel } from '../kern/api';
import { Bestand } from '../kern/bestand';
import { KurzLink } from '../kern/kurzansicht';
import { BegriffLink, Glossar } from '../kern/glossar';
import { Session } from '../kern/session';
import { Stapel } from '../kern/stapel';
import {
  ausEingabe,
  eingabeArt,
  inEingabe,
  inListe,
  kantenAusEntwurf,
  type KantenEntwurf,
  stehtDa,
  suchgruppen,
  verweisZiele,
  type Eingabe,
} from './felder';
import { holds } from '../register/regeln';
import { Mehrfach, type Suchgruppe } from './mehrfach';
import { Text } from './text';
import { Wahl } from './wahl';
import { SCHNELL_KONTEXT, type SchnellKontext } from './schnell';
import { Karte } from '../karten/karte';
import { Bild, BildWahl, bildDes } from './bild';
import { BildPanel } from '../bilder/bildpanel';
import { KartenPanel } from '../karten/kartenpanel';
import { Statblock } from './statblock';
import { Kennzahlen } from './kennzahlen';
import { Zauber } from './zauber';
import { Gegenstand } from './gegenstand';
import { Laden } from './laden';
import { Liegengelassen } from './liegen';
import { Werkstatt } from './werkstatt';
import { Abschnitte } from './abschnitte';
import { Fluss } from './fluss';
import { anordnen, feldZellen, mitLeeren, prosaVon, reiterVon, SCHON_ANDERSWO, type Prosa, type Stueck, type Zelle } from './anordnung';
import { Bogen } from '../bogen/kopf';
import { Reiterleiste } from '../bogen/reiterleiste';
import { Zug } from '../bogen/zug';
import { Zauberliste } from '../bogen/zauberliste';
import { FigurKampagne } from '../bogen/kampagne';
import { Herausgeber } from './herausgeber';
import {
  abweichungen,
  AbwMarken,
  FassungsAbzeichen,
  FassungsKasten,
  FassungsLesart,
  prosaVergleich,
  textVergleich,
  verglichene,
  vergleichsfassungen,
  type Abweichung,
  type ProsaVergleich,
} from './fassungen';
import { bereichLabel } from '../kern/bereiche';
import { Quellen } from '../kern/quellen';
import { Verlinkt } from './verlinkt';
import { Lesen } from '../lesen/lesen';
import { Quelleninhalt } from './quelleninhalt';
import { KampagnenReiter } from './ebenen-reiter';
import { EbenenMarke } from './ebenen-marke';
import { Wissenskasten } from './wissenskasten';
import { Wissensseite } from './wissensseite';
import { Klasse } from '../klassen/klasse';
import { Herkunft } from '../klassen/herkunft';
import { Regeloptionen } from './regeloptionen';
import { antwortenJeEintrag, antwortText, EINTRAG_KANTEN } from './klasseneintrag';
import { Wuerfe } from './wuerfe';
import { WurfZiel } from '../kern/wurfziel';
import { Ansichtsbaum } from '../ansichten/baum';
import { Ansichtswahl } from '../ansichten/wahl';
import { Ansichtsdesigner, type AnsichtsEntwurf } from '../ansichten/designer';

/** Die Kante, an der ein Artikel in einem anderen steht — Raum im Kapitel, Kapitel im Abenteuer. */
const PART_RELATION = 'partOf';
/** So viele Glieder höchstens im Brotkrumenpfad. */
const PFAD_TIEFE = 8;

interface Feld {
  /** `Component.property` — eindeutig und zugleich der Name im Formular. */
  ref: string;
  comp: string;
  prop: string;
  label: string;
  /** Für „+ Add field“ (T-195): der Bestandteil, das Feld an dieser Art
   *  und was es meint — aus dem Register, sonst was es hält. */
  gruppe: string;
  titel: string;
  beschreibung: string;
  art: Eingabe;
  schema: PropertySchema | undefined;
  /* Die Werte einer Auswahl, schon aufgelöst: das Feld trägt sie selbst
     oder nennt eine Aufzählungszeile, und die Vorlage soll das nicht noch
     einmal entscheiden müssen. */
  werte: string[];
  wert: string;
  jaNein: boolean;
  pflicht: boolean;
  /** Die Werte einer Auswahl mit Chips (`verweise`, `mehrfach`). */
  liste: string[];
  gruppen: Suchgruppe[];
  frei: boolean;
}

/**
 * Ein Artikel.
 *
 * **Gezeichnet wird aus dem Register**, nicht aus einer Vorlage je
 * Artikelart: die Anordnung steht am Typ (`InterfaceDef.views`), und
 * `layoutFor` aus `packages/model` sucht sie die `extends`-Kette hoch —
 * dieselbe Funktion, die der Prototyp benutzt. Ein Statblock liest sich
 * wie im Buch, weil das Register ihm das Element `statblock` gibt (W2);
 * eine Abfrage nach dem Artnamen hier wäre die zweite Stelle, an der
 * jemand etwas vergisst.
 *
 * **Zurückgehalten wird am Server** (`redactEntity`). Was hier ankommt, darf
 * angezeigt werden; die Seite prüft das nicht noch einmal. Eine zweite
 * Prüfung sähe nach Sorgfalt aus und wäre das Gegenteil: sie lüde dazu ein,
 * die erste wegzulassen.
 */
/** Stücke, die noch keine Komponente zeichnet — ihr Reiter erscheint erst mit ihr. */
const NOCH_NICHT = new Set<Stueck['art']>([]);

@Component({
  selector: 'nw-artikel',
  /* Schnell anlegen aus einer Auswahl (T-131): der Artikel schlägt Ebene
     und Sichtbarkeit vor und sichert vor „Open" seinen Entwurf. */
  providers: [{ provide: SCHNELL_KONTEXT, useExisting: forwardRef(() => Artikel) }, WurfZiel],
  imports: [
    RouterLink,
    FormsModule,
    Bogen,
    Reiterleiste,
    Zug,
    Zauberliste,
    FigurKampagne,
    Text,
    Wahl,
    Mehrfach,
    Statblock,
    Kennzahlen,
    Zauber,
    Gegenstand,
    Laden, Liegengelassen, Werkstatt,
    Abschnitte,
    Fluss,
    FassungsKasten,
    FassungsAbzeichen,
    AbwMarken,
    KurzLink,
    BegriffLink,
    Herausgeber,
    Bild,
    BildWahl,
    BildPanel,
    KartenPanel,
    Karte,
    Verlinkt,
    Lesen,
    Quelleninhalt,
    Klasse,
    Herkunft,
    KampagnenReiter,
    EbenenMarke,
    Wissenskasten,
    Wissensseite,
    Regeloptionen,
    Wuerfe,
    Ansichtsbaum,
    Ansichtswahl,
    Ansichtsdesigner,
  ],
  template: `
    @if (artikel(); as e) {
      <div class="buch">
        <nav aria-label="Breadcrumb" class="brot">
          <!-- Hierher über „Open" aus einer Auswahl (T-131): zuerst der Weg zurück. -->
          @if (zurueck(); as z) {
            <a class="zurueck" [routerLink]="['/artikel', z.id]">‹ {{ z.name }}</a>
            <span aria-hidden="true">·</span>
          }
          <a [routerLink]="'/' + (bereich() || 'compendium')">{{ bereichName() }}</a>
          <span aria-hidden="true">›</span>
          <a [routerLink]="'/' + (bereich() || 'compendium')" [queryParams]="{ type: art(e) }">{{
            typLabel(art(e))
          }}</a>
          <!-- Ebene und übergeordnete Artikel (T-093): wo der Artikel steht. -->
          @for (p of pfad(); track p.id) {
            <span aria-hidden="true">›</span>
            <a [routerLink]="['/artikel', p.id]">{{ p.name }}</a>
          }
          <span aria-hidden="true">›</span>
          <span aria-current="page">{{ name(e) }}</span>
        </nav>

        <!-- Die Regeloptionen einer Kampagne (T-190): ein eigener Reiter,
             nach Sorte gruppiert, mit dem Regelartikel je Variante. -->
        @if (art(e) === 'Campaign' && !bearbeitet()) {
          <nw-kampagnen-reiter [kampagne]="e.id" [regeln]="regelReiter()" />
        }
        @if (regelReiter()) {
          <nw-regeloptionen [kampagne]="e.id" [darfSchreiben]="session.isAdmin() || darfSchreiben()" />
        } @else {
        <div class="spalten">
          <main class="hauptspalte">
            <div class="werkzeugzeile">
              <span class="meta">{{ meta() }}</span>
              <div class="werkzeuge">
                <!-- Der Stufenaufstieg ist derselbe Assistent wie das Anlegen (T-080). -->
                @if (art(e) === 'PlayerCharacter' && darfSchreiben() && !bearbeitet() && !zeigtAlten()) {
                  <a class="knopf" [routerLink]="['/characters', e.id, 'level-up']">Level up</a>
                }
                <!-- Der Druck (T-110): die Ansicht print auf einem Blatt A4. -->
                @if (!bearbeitet()) {
                  <a class="knopf" [routerLink]="['/artikel', e.id, 'print']">Print</a>
                }
                <!-- Die Leseansicht (T-091): an der Stelle im Buch — auf der
                     Seite der Ebene, wo das Buch als Element steht (T-191). -->
                @if (leseZiel(); as z) {
                  @if (!bearbeitet() && art(e) !== 'Layer') {
                    <a class="knopf" [routerLink]="['/artikel', z.layer]" [queryParams]="leseParams(z)">Read in book</a>
                  }
                }
                <!-- Anpassen über der Vorlage (E-018, T-082): eine Fassung in
                     der Ebene der Kampagne, das Original bleibt. -->
                @if (anpassbar() && session.isAdmin() && !bearbeitet()) {
                  <button type="button" [disabled]="passtAn()" (click)="anpassen()"
                          title="Make a version for this campaign. The original stays as it is.">
                    {{ passtAn() ? 'Adapting…' : 'Adapt for this campaign' }}
                  </button>
                }
                <!-- In die Geschichte holen (E-026): ein Kapitel oder eine Szene samt allem
                     darunter in die eigene Kampagne, an sie oder einen ihrer Arcs. -->
                @if (uebernahmeZiele().length && !bearbeitet()) {
                  <span class="fassung-wahl">
                    <label>
                      Take into
                      <select #wohin [disabled]="passtAn()" aria-label="Where to take it">
                        @for (z of uebernahmeZiele(); track z.id) {
                          <option [value]="z.id">{{ z.name }}{{ z.type === 'Campaign' ? '' : ' (' + z.type + ')' }}</option>
                        }
                      </select>
                    </label>
                    <button type="button" [disabled]="passtAn()" (click)="uebernehmen(wohin.value)"
                            title="Make this campaign's version of it, with everything below it. The original stays.">
                      {{ passtAn() ? 'Taking…' : 'Take' }}
                    </button>
                    <!-- Einen Teil eines Buchs verwenden statt kopieren (E-028, T-108):
                         ein Verweis aufs Original, der Korrekturen am Original mitnimmt. -->
                    @if (istBuchteil()) {
                      <button type="button" [disabled]="passtAn()" (click)="uebernehmen(wohin.value, true)"
                              title="Show the original there, as it is. Take it instead when you want to change it.">
                        Use as is
                      </button>
                    }
                  </span>
                }
                @if (original(); as o) {
                  @if ((session.isAdmin() || darfSchreiben()) && !bearbeitet()) {
                    <button type="button" [disabled]="passtAn()" (click)="zumOriginal(o.id)"
                            title="Delete this version; the campaign sees the original again.">
                      Back to the original
                    </button>
                  }
                }
                <!-- Edit an einer Figur ist der Assistent (T-194); die Feldmaske heisst „Full edit". -->
                @if (darfSchreiben() && !zeigtAlten() && art(e) === 'PlayerCharacter') {
                  @if (bearbeitet()) {
                    <span class="umschalter" role="group" aria-label="Edit view">
                      <a [routerLink]="['/characters', e.id, 'edit']">Creator</a>
                      <span class="an" aria-current="true">Full edit</span>
                    </span>
                    <button type="button" (click)="abbrechen()">Cancel</button>
                  } @else {
                    <a class="knopf" [routerLink]="['/characters', e.id, 'edit']">Edit</a>
                    <button type="button" (click)="beginnen()" title="Every field of the character, without the creator">Full edit</button>
                  }
                } @else if (darfSchreiben() && !zeigtAlten()) {
                  <button type="button" (click)="bearbeitet() ? abbrechen() : beginnen()">
                    {{ bearbeitet() ? 'Cancel' : 'Edit' }}
                  </button>
                } @else if (fassungsZiele().length && !zeigtAlten() && !session.isAdmin()) {
                  <!-- Fremdes ändert man als Fassung in einer eigenen Ebene (T-098, E-001). -->
                  @if (fassungsZiele().length === 1) {
                    <button type="button" [disabled]="passtAn()" (click)="alsFassung(fassungsZiele()[0]!.id)"
                            [title]="'This article is not in a layer you edit. Edit makes your version in ' + fassungsZiele()[0]!.name + '; the original stays.'">
                      {{ passtAn() ? 'Making your version…' : 'Edit' }}
                    </button>
                  } @else {
                    <span class="fassung-wahl">
                      <label>
                        Edit as a version in
                        <select #ziel [disabled]="passtAn()" aria-label="Layer for your version">
                          @for (l of fassungsZiele(); track l.id) {
                            <option [value]="l.id">{{ l.name }}</option>
                          }
                        </select>
                      </label>
                      <button type="button" [disabled]="passtAn()" (click)="alsFassung(ziel.value)">
                        {{ passtAn() ? 'Making…' : 'Edit' }}
                      </button>
                    </span>
                  }
                }
                @if (bearbeitet()) {
                  <button type="button" class="pri" [disabled]="speichert()" (click)="speichern()">
                    {{ speichert() ? 'Saving…' : 'Save' }}
                  </button>
                }
              </div>
            </div>

            @if (anpassFehler(); as f) {
              <p class="fehler" role="alert">{{ f }}</p>
            }
            <!-- Wohin die Änderung geht (T-161): in diesen Artikel und damit
                 in seine Ebene — damit niemand aus Versehen ein geteiltes
                 Regelwerk ändert. -->
            @if (bearbeitet() && schreibZiel(); as z) {
              <p class="hinweis" [class.fehler]="z.fremd" role="status">
                @if (z.ebenen.length) {
                  Changes go into this article in <b>{{ z.ebenen.join(', ') }}</b>
                } @else {
                  Changes go into this article, which is in no layer
                }
                @if (z.fremd) {
                  — not your write layer{{ z.schreib ? ' (' + z.schreib + ')' : '' }}. Everyone who uses that layer sees the change.
                } @else {
                  — your write layer.
                }
              </p>
            }
            <!-- Die Zahlen und Übungen wohnen am Statblock (T-272): im Full edit
                 der Figur stehen sie nicht, also sagt es die Maske und führt hin. -->
            @if (bearbeitet() && statblockDerFigur(); as sb) {
              <p class="hinweis" role="note">
                Ability scores, hand-added proficiencies and the other numbers stand on its statblock
                <a [routerLink]="['/artikel', sb.id]" [queryParams]="{ edit: 1 }">{{ sb.name }}</a>.
                What class, background, origin and choices add is computed and shown on the overview.
              </p>
            }
            <!-- Wer die Ebene herausgibt und warum (T-109) — gerechnet, geändert wird die Kante. -->
            @if (art(e) === 'Layer' && !zeigtAlten()) {
              <nw-herausgeber [ebene]="e.id" />
            }
            @if (original(); as o) {
              <p class="hinweis" role="status">
                This campaign’s version of “{{ o.name }}”. Links to the original lead here; the
                original stays as it was.
              </p>
            }
            <!-- Ein älterer fertiger Stand gilt für alle anderen (REQ-237,
                 E-012). Das Band sieht nur, wer den Arbeitsstand sieht. -->
            @if (fertigAm(); as am) {
              <p class="band-fertig" role="status">
                @if (zeigtAlten()) {
                  <span>You are looking at the ready version from {{ am }}.</span>
                  <button type="button" class="klein" (click)="zeigeNeuen()">Show the current version</button>
                } @else {
                  <span>Not ready yet — the version from {{ am }} applies.</span>
                  <button type="button" class="klein" [disabled]="laedtAlten()" (click)="zeigeAlten()">Show that version</button>
                  @if (session.darfReady()(e.id) && !bearbeitet()) {
                    <button type="button" class="klein" (click)="fertigNennen()">Mark ready</button>
                  }
                }
                @if (!bearbeitet() && problem(); as p) {
                  <span class="fehler" role="alert">{{ p }}</span>
                }
              </p>
            }

            <!-- Eine Fassung aus einer Vergleichsebene (T-092): sichtbar, aber nicht im Spiel. -->
            @if (bestand.vergleich().has(e.id)) {
              <p class="band-fertig band-vergleich" role="status">
                <span>This version comes from a compare layer. It is not in play in this campaign.</span>
                <!-- Einzeln freigeben (T-187): Extra-Inhalt, ohne das Buch aufzuschalten. -->
                @if (bestand.freigabe().get(e.id); as f) {
                  <button type="button" class="klein" [disabled]="freigabeLaeuft()" (click)="freigeben(f.campaign, true)">Enable in campaign</button>
                }
              </p>
            } @else if (bestand.freigabe().get(e.id)?.enabled) {
              <p class="band-fertig band-vergleich" role="status">
                <span>Enabled as extra content: in play in this campaign, its layer is not.</span>
                <button type="button" class="klein" [disabled]="freigabeLaeuft()" (click)="freigeben(bestand.freigabe().get(e.id)!.campaign, false)">Disable</button>
              </p>
            }

            <!-- Die Leiste „Views" (T-268, T-276, E-103): die Ansichten, die für diesen Artikel gelten.
                 Im Full edit für alle, die das Register ändern; beim Lesen, sobald eine gestaltete
                 gilt — sonst steht der Artikel da wie immer. -->
            @if (ansichtsLeiste()) {
              <nw-ansichtswahl [artikel]="e" [rueck]="rueckKanten()" [aktiv]="geltendeAnsicht()"
                               [darfGestalten]="session.darfRegister()" [offen]="gestaltet()" (offenChange)="gestalten($event)"
                               (waehle)="ansichtGewaehlt.set($event)" />
            }
            <article class="blatt">
              <div>
                <h1>{{ name(e) }}</h1>
                @if (untertitel(); as u) {
                  <p class="untertitel">{{ u }}</p>
                }
                <!-- Worin der Artikel steht und wodurch er zu sehen ist (T-251, REQ-348). -->
                <nw-ebenen-marke [artikel]="e" [fassungen]="fassungen()" />
                <!-- Fassungen auf einen Blick (T-173): oben, auch am Telefon. -->
                @if (!bearbeitet()) {
                  <nw-fassungs-abzeichen [basis]="e" [fassungen]="fassungen()" />
                }
              </div>
              <!-- Ein Buch-Element setzt seine kursive Zeile unter den Namen
                   und zieht die Linie selbst. -->
              @if (bearbeitet() || !buchKopf()) {
                <div class="linie" aria-hidden="true"></div>
              }
            @if (bearbeitet()) {
              <!-- REQ-192: jemand anders hat gespeichert, seit die Maske
                   offen ist. Nichts ist geschrieben; zusammengeführt wird
                   hier, gefragt nur, wo beide dasselbe verschieden änderten. -->
              @if (zusammen(); as z) {
                <section class="zusammen" role="alert">
                  <p>
                    <strong>Changed elsewhere.</strong>
                    Someone saved this article while you were editing. Nothing of yours is lost — it is not saved yet.
                    @if (z.taken) {
                      {{ z.taken }} of their changes {{ z.taken === 1 ? 'was' : 'were' }} merged into yours.
                    }
                  </p>
                  @if (z.conflicts.length) {
                    <p>Both of you changed {{ z.conflicts.length === 1 ? 'this' : 'these' }} — choose what to keep:</p>
                    <ul class="konflikte">
                      @for (k of z.conflicts; track k.key) {
                        <li>
                          <span class="was">{{ k.label }}</span>
                          <label><input type="radio" [name]="'k-' + k.key" [checked]="k.wahl === 'mine'" (change)="waehleSeite(k.key, 'mine')" /> Yours: <em>{{ k.mine }}</em></label>
                          <label><input type="radio" [name]="'k-' + k.key" [checked]="k.wahl === 'theirs'" (change)="waehleSeite(k.key, 'theirs')" /> Theirs: <em>{{ k.theirs }}</em></label>
                        </li>
                      }
                    </ul>
                  } @else {
                    <p>None of your changes collide with theirs.</p>
                  }
                  <div class="werkzeuge">
                    <button type="button" class="pri" [disabled]="speichert()" (click)="zusammenSpeichern()">
                      {{ speichert() ? 'Saving…' : 'Save merged' }}
                    </button>
                    <button type="button" [disabled]="speichert()" (click)="verwerfen()">Discard mine, show theirs</button>
                    <button type="button" (click)="herunterladen()">Download my version</button>
                  </div>
                </section>
              }
              @if (problem(); as p) {
                <p class="fehler" role="alert">
                  {{ p }}
                  @if (entwurf()) {
                    <button type="button" class="klein" (click)="herunterladen()">Download my version</button>
                  }
                </p>
              }
              @if (maengel().length) {
                <ul class="maengel" role="alert">
                  @for (m of maengel(); track m) {
                    <li>{{ m }}</li>
                  }
                </ul>
              }

              <div class="maske">
                @for (f of sichtbareFelder(); track f.ref) {
                  <label [attr.data-ref]="f.ref">
                    <span>{{ f.label }}@if (f.pflicht) {<i class="pflicht" title="required">*</i>}</span>
                    @switch (f.art) {
                      @case ('jaNein') {
                        <input type="checkbox" [(ngModel)]="f.jaNein" [name]="f.ref" />
                      }
                      @case ('auswahl') {
                        <select [(ngModel)]="f.wert" [name]="f.ref">
                          <option value=""></option>
                          @for (o of f.werte; track o) {
                            <option [value]="o">{{ o }}</option>
                          }
                        </select>
                      }
                      @case ('lang') {
                        <textarea rows="4" [(ngModel)]="f.wert" [name]="f.ref"></textarea>
                      }
                      @case ('json') {
                        <textarea rows="6" spellcheck="false" style="font-family: monospace" [(ngModel)]="f.wert" [name]="f.ref"></textarea>
                      }
                      @case ('verweis') {
                        <nw-wahl
                          [wert]="f.wert"
                          (wertChange)="f.wert = $event"
                          [arten]="f.schema?.target?.interfaces ?? []"
                          [bevorzugt]="f.schema?.target?.tags ?? []"
                          [ausser]="e.id"
                          [label]="f.label"
                        />
                      }
                      @case ('bild') {
                        <nw-bildwahl [wert]="f.wert" (wertChange)="f.wert = $event" [fuer]="e.id" [label]="f.label" [klasse]="klasseVon(f)" />
                      }
                      @case ('verweise') {
                        <nw-mehrfach
                          [werte]="f.liste"
                          (werteChange)="f.liste = $event"
                          [verweise]="true"
                          [gruppen]="f.gruppen"
                          [bevorzugt]="f.schema?.target?.tags ?? []"
                          [ausser]="e.id"
                          [label]="f.label"
                          [spieler]="f.comp === 'Visibility'"
                        />
                      }
                      @case ('mehrfach') {
                        <nw-mehrfach
                          [werte]="f.liste"
                          (werteChange)="f.liste = $event"
                          [gruppen]="f.gruppen"
                          [feste]="f.werte"
                          [frei]="f.frei"
                          [label]="f.label"
                        />
                      }
                      @case ('zahl') {
                        <input type="text" inputmode="decimal" [(ngModel)]="f.wert" [name]="f.ref" />
                      }
                      @case ('liste') {
                        <input type="text" [(ngModel)]="f.wert" [name]="f.ref" placeholder="one, two, three" />
                      }
                      @default {
                        <!-- Ein ausgegebenes Feld (\`readOnly\`, der Bezeichner) bleibt, wie es
                             ist: es wird beim Anlegen vergeben und danach nicht geändert. -->
                        <input type="text" [(ngModel)]="f.wert" [name]="f.ref" [readOnly]="!!f.schema?.readOnly"
                               [attr.title]="f.schema?.readOnly ? 'Issued when the article was created; it does not change.' : null" />
                      }
                    }
                    <!-- Was die anderen Fassungen hier sagen (T-103), auch beim Bearbeiten. -->
                    <nw-abw [liste]="abwAn(f.ref)" [scopes]="scopes()" />
                  </label>
                }
              </div>
              <!-- T-195: die übrigen Felder sind erreichbar, nicht ausgebreitet. -->
              @if (weitereZahl()) {
                <div class="feldwahl-anker">
                  <button type="button" class="klein" [attr.aria-expanded]="feldwahlOffen()" (click)="feldwahl(!feldwahlOffen())">
                    + Add field <span class="zahl">{{ weitereZahl() }}</span>
                  </button>
                  @if (feldwahlOffen()) {
                    <div class="feldwahl" role="dialog" aria-label="Add a field" (keydown.escape)="feldwahl(false)">
                      <div class="fwkopf">
                        <input type="search" placeholder="Search fields" aria-label="Search fields"
                               [value]="feldSuche()" (input)="feldSuche.set($any($event.target).value)" />
                        <button type="button" class="weg" title="Close" (click)="feldwahl(false)">×</button>
                      </div>
                      <div class="fwliste">
                        @for (g of weitereFelder(); track g.name) {
                          <h4>{{ g.name }}</h4>
                          @for (f of g.felder; track f.ref) {
                            <button type="button" class="fweintrag" (click)="feldDazu(f.ref)">
                              <span class="fwtitel">{{ f.titel }}</span>
                              <span class="fwtext">{{ f.beschreibung }}</span>
                            </button>
                          }
                        } @empty {
                          <p class="leer">No field matches.</p>
                        }
                      </div>
                    </div>
                  }
                </div>
              }

              <h3>Passages</h3>
              @for (b of entwurfProsa(); track b.id) {
                <div class="blockmaske">
                  <div class="bkopf">
                    <span class="bl">{{ b.label }}</span>
                    <button type="button" class="weg" (click)="prosaWeg(b.id)" title="Remove">×</button>
                  </div>
                  <textarea rows="3" [(ngModel)]="b.wert" [name]="b.id"></textarea>
                  <nw-abw [liste]="vglProsa(b.id)?.ganz ?? []" [scopes]="scopes()" />
                </div>
              }
              <div class="werkzeuge">
                <select #neueArt>
                  @for (t of prosaArten(); track t.ref) {
                    <option [value]="t.ref">{{ t.label }}</option>
                  }
                </select>
                <button type="button" (click)="prosaDazu(neueArt.value)">+ Passage</button>
              </div>

              <h3>Relations</h3>
              @for (k of hauptKanten(); track k.id) {
                <div class="kantenmaske">
                  <div class="bkopf">
                    <span class="rl" [attr.title]="kantenWirkung(k.type)">{{ kantenLabel(k.type) }}</span>
                    <nw-wahl
                      [wert]="k.to"
                      (wertChange)="k.to = $event"
                      [arten]="zielArten(k.type)"
                      [ausser]="e.id"
                      [label]="kantenLabel(k.type)"
                    />
                    <button type="button" class="weg" (click)="kanteWeg(k.id)" title="Remove">×</button>
                  </div>
                  @if (kantenFelder(k.type).length) {
                    <div class="maske">
                      @for (f of kantenFelder(k.type); track f.prop) {
                        <label>
                          <span>{{ f.label }}</span>
                          @switch (f.art) {
                            @case ('jaNein') {
                              <input
                                type="checkbox"
                                [checked]="k.props[f.prop] === true"
                                (change)="setzeProp(k, f.prop, $any($event.target).checked)"
                                [name]="k.id + '-' + f.prop"
                              />
                            }
                            @case ('verweis') {
                              <nw-wahl
                                [wert]="anzeige(k.props[f.prop])"
                                (wertChange)="setzeProp(k, f.prop, $event)"
                                [arten]="f.schema?.target?.interfaces ?? []"
                                [bevorzugt]="f.schema?.target?.tags ?? []"
                                [label]="f.label"
                              />
                            }
                            @case ('auswahl') {
                              <select
                                [value]="anzeige(k.props[f.prop])"
                                (change)="setzeProp(k, f.prop, $any($event.target).value)"
                                [name]="k.id + '-' + f.prop"
                              >
                                <option value=""></option>
                                @for (o of f.werte; track o) {
                                  <option [value]="o">{{ o }}</option>
                                }
                              </select>
                            }
                            @default {
                              <input
                                type="text"
                                [value]="anzeige(k.props[f.prop])"
                                (input)="setzeProp(k, f.prop, $any($event.target).value)"
                                [name]="k.id + '-' + f.prop"
                              />
                            }
                          }
                        </label>
                      }
                    </div>
                  }
                  <!-- Die Antworten auf die Wahlen dieses Eintrags (T-095):
                       gespeichert als Kanten chose, gezeigt bei ihrer Klasse. -->
                  @for (u of unterKanten(k); track u.id) {
                    <div class="antwortmaske">
                      <label>
                        <span>{{ antwortLabel(u) }}</span>
                        <input
                          type="text"
                          [value]="anzeige(u.props['picks'])"
                          (input)="setzeProp(u, 'picks', $any($event.target).value)"
                          [name]="u.id + '-picks'"
                        />
                      </label>
                      <button type="button" class="weg" (click)="kanteWeg(u.id)" title="Remove">×</button>
                    </div>
                  }
                </div>
              }
              <div class="werkzeuge">
                <select #neueKante aria-label="Kind of relation" (change)="gewaehlteKante.set(neueKante.value)">
                  @for (t of kantenArten(); track t.type) {
                    <option [value]="t.type" [selected]="t.type === vorschauKante()">{{ t.label }}</option>
                  }
                </select>
                <button type="button" (click)="kanteDazu(neueKante.value)">+ Relation</button>
              </div>
              <!-- Vor dem Anlegen: was die Kante bedeutet und bewirkt (T-111). -->
              @if (vorschauKante(); as v) {
                <p class="kantenvorschau" role="status">
                  <b>{{ kantenLabel(v) }}:</b> {{ kantenWirkung(v) }}
                </p>
              }
            } @else if (andereAnsicht(); as av) {
              <!-- Eine andere Ansicht als die Seite (T-268): ihr Baum, oder der Entwurf der Leiste. -->
              <nw-ansichtsbaum [artikel]="e" [layout]="av" [rueck]="rueckKanten()" />
            } @else {
              @if (offeneVerweise().length) {
                <p class="hinweis" role="status">
                  Links not tied to an article (none or several match):
                  {{ offeneVerweise().join(', ') }}
                </p>
              }
              <!-- Gezeichnet wird die Anordnung der Art (layoutFor): was ein
                   Element nicht kennt, zeichnet hier noch niemand; was kein
                   Element zeichnet, steht am Ende (rest). -->
              <!-- Reiter (T-247): die Gruppen einer Kreatur stehen nicht
                   untereinander, sondern einer auf einmal; was über den
                   Reitern steht (der Kopf), steht immer da. -->
              @for (st of sichtbareStuecke(); track st.id) {
                @if (st.id === ersterImReiter() && reiter().length > 1) {
                  <nw-reiterleiste [reiter]="reiter()" [aktiv]="aktiverReiter()" (waehle)="zeigeReiter($event)" />
                }
                @switch (st.art) {
                  @case ('bogen') {
                    <nw-bogen [artikel]="e" />
                  }
                  @case ('zug') {
                    <nw-zug [artikel]="e" />
                  }
                  @case ('zauberliste') {
                    <nw-zauberliste [artikel]="e" />
                  }
                  @case ('kampagne') {
                    <nw-figur-kampagne [artikel]="e" />
                  }
                  @case ('statblock') {
                    <nw-statblock [artikel]="e" [fassungen]="vergleich()" />
                  }
                  @case ('stats') {
                    <nw-kennzahlen [artikel]="e" />
                  }
                  @case ('spell') {
                    <nw-zauber [artikel]="e" [scopes]="scopes()" [fassungen]="vergleich()" />
                  }
                  @case ('item') {
                    <nw-gegenstand [artikel]="e" [fassungen]="vergleich()" />
                  }
                  @case ('beschreibung') {
                    @if (vglBeschreibung(); as v) {
                      <div class="beschreibung">
                        @if (!st.text) {
                          <p class="leer" title="Empty here">—</p>
                        }
                        @for (s of v.abschnitte; track s.key) {
                          <nw-text [text]="s.text" [scopes]="scopes()" />
                          <nw-abw [liste]="s.abw" [scopes]="scopes()" />
                        }
                        @for (n of v.nurDort; track $index) {
                          <nw-abw [liste]="[n.abw]" [titel]="nurDortTitel(n.heading)" [scopes]="scopes()" />
                        }
                      </div>
                    } @else {
                      <nw-text class="beschreibung" [text]="st.text ?? ''" [scopes]="scopes()" />
                    }
                  }
                  @case ('teile') {
                    <nw-abschnitte [besitzer]="e" />
                  }
                  @case ('regeln') {
                    <!-- T-190: die Regeloptionen stehen nach Sorte und erklärt unter dem Reiter. -->
                    <p class="regelhinweis">
                      How this campaign plays — ability scores, equipment, inventory, crafting and more — stands under
                      <a [routerLink]="['/artikel', e.id]" [queryParams]="{ tab: 'rules' }">Rules &amp; options</a>.
                    </p>
                  }
                  @case ('handwerk') {
                    @if (fertigung(); as fw) {
                      <section class="fertigung" aria-label="Crafting check">
                        <h3>Crafting check</h3>
                        <p>
                          <span class="wer">At this table</span> {{ fertigungText(fw.table) }}
                          @if (fertigungHerkunft(fw.table); as h) { <small>— {{ h }}</small> }
                        </p>
                        @for (m of fw.mine; track m.id) {
                          <p>
                            <span class="wer">{{ m.name }}</span> {{ fertigungText(m.check) }}
                            @if (fertigungHerkunft(m.check); as h) { <small>— {{ h }}</small> }
                          </p>
                        }
                        <p class="hinweis">A campaign, party or character changes this with a “crafts with” edge to the recipe or its tool.</p>
                      </section>
                    }
                    <nw-werkstatt [id]="e.id" />
                  }
                  @case ('laden') {
                    @if (ladenwaren(); as lw) {
                      <nw-laden [waren]="lw" [id]="e.id" />
                    }
                  }
                  @case ('wissen') {
                    <nw-wissensseite [id]="e.id" />
                  }
                  @case ('liegen') {
                    <nw-liegengelassen [sitzung]="e" />
                  }
                  @case ('fluss') {
                    <nw-fluss [besitzer]="e" />
                  }
                  <!-- Was die Quelle bringt, als Baum mit der Wahl der Kampagne (T-189). -->
                  @case ('inhalt') {
                    <nw-quelleninhalt [layer]="e.id" />
                  }
                  <!-- Die Übersichten (T-191): früher /classes/:id und /ancestries/:id. -->
                  @case ('klasse') {
                    <nw-klasse [id]="e.id" [eingebettet]="true" [sub]="sub()" [opt]="opt()" />
                  }
                  @case ('herkunft') {
                    <nw-herkunft [id]="e.id" [eingebettet]="true" [sub]="sub()" />
                  }
                  @case ('ueberschrift') {
                    <h2>{{ st.text }}</h2>
                  }
                  @case ('karte') {
                    <nw-karte class="karte" [id]="e.id" />
                  }
                  @case ('verlinkt') {
                    <nw-verlinkt [artikel]="e" [nur]="st.nur ?? []" [ausser]="st.ausser ?? []" />
                  }
                  @case ('bild') {
                    <nw-bild class="hauptbild" [wert]="st.bild!.wert" [version]="st.bild!.version" [caption]="st.bild!.caption" [alt]="st.bild!.alt || e.name || ''" />
                  }
                  @case ('absatz') {
                    <p class="beschreibung">{{ st.text }}</p>
                  }
                  @case ('felder') {
                    <dl class="felder">
                      @for (z of st.zellen; track z.ref) {
                        <div class="feld" [class.lang]="z.lang" [class.geerbt]="z.geerbt" [class.leer]="z.leer || z.fehlt"
                             [attr.title]="z.geerbt ? 'From the template' : z.leer ? 'Empty here; another version fills it' : null">
                          <dt>{{ z.label }}</dt>
                          <dd>
                            @if (z.links) {
                              @for (l of z.links; track $index) {
                                @if (!$first) {<ng-container>, </ng-container>}
                                @if (l.ziel) {
                                  <a [routerLink]="['/artikel', l.ziel]" [nwQuick]="l.ziel">{{ l.text }}</a>
                                } @else {
                                  <span class="weg">{{ l.text }}</span>
                                }
                              }
                            } @else if (z.bild) {
                              <nw-bild class="feldbild" [wert]="z.bild" groesse="thumb" [alt]="z.label" />
                            } @else if (z.lang) {
                              <nw-text [text]="z.wert" [scopes]="scopes()" />
                            } @else {
                              <nw-text inline [text]="z.wert" [scopes]="scopes()" />
                            }
                            <nw-abw [liste]="abwAn(z.ref)" [scopes]="scopes()" />
                          </dd>
                        </div>
                      }
                    </dl>
                  }
                  @case ('prosa') {
                    @for (b of st.prosa; track b.ref; let i = $index) {
                      <section class="block" [class]="b.key">
                        <!-- Einträge desselben Feldes stehen unter einer Überschrift (T-184: drei Hinweise sind ein Abschnitt). -->
                        @if (b.key !== 'paragraph' && neuesFeld(st.prosa, i)) {
                          <h2>{{ b.label }}</h2>
                        }
                        <!-- Je Abschnitt unter seiner Überschrift, was eine andere
                             Fassung dort sagt (T-103) — nicht am Ende des Textes. -->
                        @if (vglProsa(b.ref); as v) {
                          @if (b.leer) {
                            <p class="leer" title="Empty here">—</p>
                          }
                          @for (s of v.abschnitte; track s.key) {
                            <nw-text [text]="s.text" [scopes]="scopes()" />
                            <nw-abw [liste]="s.abw" [scopes]="scopes()" />
                          }
                          @for (n of v.nurDort; track $index) {
                            <nw-abw [liste]="[n.abw]" [titel]="nurDortTitel(n.heading)" [scopes]="scopes()" />
                          }
                        } @else {
                          <nw-text [text]="b.wert" [scopes]="scopes()" />
                        }
                      </section>
                    }
                  }
                }
              }
              <!-- Was eine Fassung anders sagt, wo die Seite kein Feld dafür
                   zeichnet — ein Feld, das kein Element der Anordnung nimmt
                   (T-092). Leere Felder und Buchzeilen tragen es selbst (T-103). -->
              @if (abwRest().length) {
                <section class="block fassungen-rest">
                  <h2>Where other versions differ</h2>
                  <dl class="felder">
                    @for (z of abwRest(); track z.ref) {
                      <div class="feld" [class.lang]="z.lang">
                        <dt>{{ z.label }}</dt>
                        <dd>
                          @if (z.hier) {
                            <span class="fhier">{{ z.hier }}</span>
                          }
                          <nw-abw [liste]="z.liste" [scopes]="scopes()" />
                        </dd>
                      </div>
                    }
                  </dl>
                </section>
              }
            }
            </article>
          </main>

          <aside class="seitenspalte" aria-label="Connections">
            <!-- Die Leiste „Design this view" (T-268): gestaltet an diesem Artikel. -->
            @if (gestaltet() && !bearbeitet()) {
              <section class="kasten gestalten" aria-label="Design this view">
                <h2>View · {{ bestand.registry()?.views?.[geltendeAnsicht()]?.label ?? geltendeAnsicht() }}</h2>
                <nw-ansichtsdesigner [schluessel]="geltendeAnsicht()" [beispiel]="e" [typ]="art(e)" [kompakt]="true"
                                     (entwurf)="ansichtsEntwurf.set($event)" (fertig)="ansichtGestaltet($event)" (wechsel)="ansichtGewaehlt.set($event)" />
              </section>
            }
            @if (kanten().length || abwKanten().length) {
              <section class="kasten">
                <h2>Relations</h2>
                <ul class="kanten">
                  @for (k of kanten(); track k.id) {
                    <li>
                      <span class="rl" [attr.title]="kantenWirkung(k.typ)">{{ k.label }}</span>
                      @if (k.ziel) {
                        <a [routerLink]="['/artikel', k.ziel]" [nwQuick]="k.ziel" [nwBegriff]="begriff(k.ziel, k.text)">{{ k.text }}</a>
                      } @else {
                        <span class="weg">{{ k.text }}</span>
                      }
                      @if (k.stufe) {
                        <span class="stufe">level {{ k.stufe }}</span>
                      }
                      @if (k.unter; as u) {
                        <a class="unter" [routerLink]="['/artikel', u.id]">{{ u.name }}</a>
                      }
                      @if (k.antworten.length) {
                        <dl class="antworten">
                          @for (a of k.antworten; track a.id) {
                            <dt>{{ a.label }}</dt>
                            <dd>{{ a.text || '—' }}</dd>
                          }
                        </dl>
                      }
                    </li>
                  }
                  @for (k of abwKanten(); track $index) {
                    <li class="fassung-kante">
                      <span class="rl">{{ k.label }}</span>
                      <span class="kuerzel" [class.vergleich]="k.compare" [title]="k.titel">{{ k.kuerzel }}</span>
                      @if (k.dazu.length) {
                        <span>+ {{ k.dazu.join(', ') }}</span>
                      }
                      @if (k.weg.length) {
                        <span class="weg">− {{ k.weg.join(', ') }}</span>
                      }
                    </li>
                  }
                </ul>
              </section>
            }
            <nw-fassungen [artikel]="e.id" [basis]="e" [fassungen]="fassungen()" (gewechselt)="gewechselt($event)" />
            <!-- Wer was über diesen Artikel weiss (T-286) — nur die Leitung, der Server sagt es. -->
            @if (session.leitung() && !bearbeitet() && art(e) !== 'Information' && art(e) !== 'Knowledge') {
              <nw-wissenskasten [artikel]="e" />
            }
            <!-- Ein Bild (T-119): wo es gezeigt wird, seine Fassungen, „Replace image". -->
            @if (istBild(e)) {
              <nw-bildpanel [artikel]="e" (gewechselt)="gewechselt($event)" />
            }
            <!-- Eine Karte (T-202): in welchen Sitzungen und Szenen sie vorkommt. -->
            @if (istKarte(e)) {
              <nw-kartenpanel [karte]="e.id" />
            }
            @if (rueckbezuege().length) {
              <section class="kasten">
                <h2>Linked here</h2>
                <ul class="kanten">
                  @for (r of rueckbezuege(); track r.id) {
                    <li>
                      <span class="rl" [attr.title]="kantenWirkung(r.typ)">{{ r.label }}</span>
                      <a [routerLink]="['/artikel', r.ziel]" [nwQuick]="r.ziel">{{ r.text }}</a>
                    </li>
                  }
                </ul>
              </section>
            }
            <!-- Die Würfe auf diesem Artikel (T-172). -->
            <nw-wuerfe class="kasten" [artikel]="e.id" />
            <section class="kasten">
              <h2>Who can see this</h2>
              <div class="zeile"><span>Audience</span><strong>{{ sicht().audience }}</strong></div>
              @for (z of sicht().listen; track z.label) {
                <div class="zeile">
                  <span>{{ z.label }}</span>
                  <span>
                    @for (l of z.links; track $index) {
                      @if (!$first) {<ng-container>, </ng-container>}
                      @if (l.ziel) {
                        <a [routerLink]="['/artikel', l.ziel]" [nwQuick]="l.ziel">{{ l.text }}</a>
                      } @else {
                        <span class="weg">{{ l.text }}</span>
                      }
                    }
                  </span>
                </div>
              }
            </section>
            @if (quelle(); as q) {
              <section class="kasten">
                <h2>Source</h2>
                @if (q.url) {
                  <a [href]="q.url" target="_blank" rel="noopener">{{ q.text }}</a>
                } @else if (leseZiel(); as z) {
                  <!-- „XGE p. 12" springt an die Stelle im Buch (T-091). -->
                  <a [routerLink]="['/artikel', z.layer]" [queryParams]="leseParams(z)">{{ q.text }}</a>
                } @else {
                  <span>{{ q.text }}</span>
                }
                <!-- Das Kürzel ausgeschrieben (T-088): „XGE" sagt nur, wer das Buch kennt. -->
                @if (q.titel) {
                  <p class="quelltitel">{{ q.titel }}</p>
                }
                @if (q.verlag) {
                  <p class="quelltitel">Publisher: {{ q.verlag }}</p>
                }
              </section>
            }
          </aside>
        </div>
        <!-- Die Leseansicht (T-091, T-191): das Element „reader" braucht die
             ganze Breite — Inhaltsverzeichnis links, Kapitel rechts — und
             steht darum unter Haupt- und Seitenspalte. -->
        @if (leser()) {
          <section id="lesen" class="lesen" aria-label="Read">
            <nw-lesen [layer]="e.id" [eingebettet]="true" [at]="at()" [page]="page()" [springen]="tab() === 'read'" />
          </section>
        }
        }
      </div>
    } @else if (bestand.fehlt().has(id())) {
      <p class="fehler buch">No such article — or not one you may see.</p>
    } @else {
      <p class="leer buch">Loading…</p>
    }
  `,
  /* Die Feldauswahl (T-195) in einer eigenen Datei: das Budget je Datei. */
  styleUrls: ['./artikel.scss', './feldwahl.scss'],
})
export class Artikel implements SchnellKontext {
  /** Eine Kante auf eine Eigenschaft, einen Zustand, eine Aktionsart mit
   *  Glossareintrag (T-242): Strg/⌘+Klick öffnet den Eintrag. */
  private readonly glossar = inject(Glossar);
  protected begriff(id: string | null | undefined, name: string): string | null {
    return this.glossar.begriffZu(id, name);
  }

  readonly id = input.required<string>();
  /** `?edit=1`: gleich bearbeiten — so öffnet „New article" den frischen Artikel (W7). */
  readonly edit = input<string | undefined>(undefined);
  /** `?from=<id>`: hierher kam man über „Open" aus einer Auswahl (T-131) — der Weg zurück. */
  readonly from = input<string | undefined>(undefined);
  /** `?tab=read`: zur Leseansicht springen (T-167; seit T-191 ein Element), `?tab=rules` an der Kampagne. */
  readonly tab = input<string | undefined>(undefined);
  /** `?at=`, `?page=`: die Stelle im Buch (T-091) — an einer Ebene mit Element `reader`. */
  readonly at = input<string | undefined>(undefined);
  readonly page = input<string | undefined>(undefined);
  /** `?sub=`, `?opt=`: die gewählten Unterklassen oder Spielarten der Übersicht (T-191). */
  readonly sub = input<string | undefined>(undefined);
  readonly opt = input<string | undefined>(undefined);

  protected readonly bestand = inject(Bestand);
  private readonly stapel = inject(Stapel);
  private readonly quellen = inject(Quellen);
  protected readonly session = inject(Session);
  private readonly lesart = inject(FassungsLesart);
  private readonly router = inject(Router);
  private readonly wurfZiel = inject(WurfZiel);

  // ------------------------------------------------- Ansichten (T-268)

  /** Die am Artikel gewählte Ansicht; `null` heisst: die genaueste der Gruppe `full`. */
  protected readonly ansichtGewaehlt = signal<string | null>(null);
  /** Die Leiste „Design this view" ist offen. */
  protected readonly gestaltet = signal(false);
  /** Ihr Entwurf — die Seite zeichnet ihn, solange sie offen ist. */
  protected readonly ansichtsEntwurf = signal<AnsichtsEntwurf | null>(null);
  /** Das Register mit dem Entwurf einer Ansicht ohne Geltung — die Seite zeichnet daraus (T-276). */
  private readonly entwurfsRegister = computed<Registry | null>(() => {
    const a = this.ansichtsEntwurf();
    return this.gestaltet() && a && !a.gestaltet ? a.register : null;
  });
  /** Gilt an diesem Artikel eine gestaltete Ansicht? Dann steht die Leiste auch beim Lesen. */
  private readonly gestalteteGilt = computed(() => {
    const e = this.artikel();
    const r = this.bestand.registry();
    return !!e && !!r && viewsFor(e, r, { incoming: this.rueckKanten() }).some((v) => isDesignedView(r.views[v.key]));
  });
  protected readonly ansichtsLeiste = computed(
    () => (this.bearbeitet() && this.session.darfRegister()) || (!this.bearbeitet() && (this.gestaltet() || this.gestalteteGilt())),
  );
  /** „Design this view": aus dem Full edit heraus erst die Maske schliessen — sie zeichnet die Vorschau nicht. */
  protected gestalten(an: boolean): void {
    if (an && this.bearbeitet()) {
      if (!confirm('Leave the edit mask to design the view? Changes you have not saved are lost.')) return;
      this.abbrechen();
    }
    this.gestaltet.set(an);
    if (!an) this.ansichtsEntwurf.set(null);
  }
  protected readonly rueckKanten = computed<IncomingEdge[]>(() =>
    (this.bestand.rueckbezuege().get(this.id()) ?? []).map((b) => ({ type: b.relation.type, from: b.from.id, props: b.relation.props })),
  );
  protected readonly geltendeAnsicht = computed(() => {
    const e = this.artikel();
    const r = this.bestand.registry();
    if (!e || !r) return 'full';
    const k = this.ansichtGewaehlt();
    return k && r.views[k] ? k : viewFor(e, r, 'full', { incoming: this.rueckKanten() });
  });
  /** Was statt der Seite steht: eine andere Ansicht als `full`, oder der Entwurf der Leiste. */
  protected readonly andereAnsicht = computed<LayoutElement[] | null>(() => {
    const e = this.artikel();
    const r = this.bestand.registry();
    if (!e || !r || this.bearbeitet()) return null;
    const a = this.gestaltet() ? this.ansichtsEntwurf() : null;
    if (a?.gestaltet) return a.baum;
    const k = this.geltendeAnsicht();
    /* Ohne Geltung zeichnet `full` die Seite selbst (mit dem Entwurf, `anordnung`). */
    return k === 'full' ? null : anordnungFuer(a?.register ?? r, k, e.interfaces?.[0] ?? '').layout;
  });
  protected ansichtGestaltet(key: string | null): void {
    this.gestaltet.set(false);
    this.ansichtsEntwurf.set(null);
    if (key) this.ansichtGewaehlt.set(key);
  }

  constructor() {
    void this.bestand.load();
    /* Ein anderer Artikel: seine Ansicht fängt wieder bei der geltenden an (T-268). */
    effect(() => {
      this.id();
      untracked(() => {
        this.ansichtGewaehlt.set(null);
        this.gestaltet.set(false);
        this.ansichtsEntwurf.set(null);
      });
    });
    /* Der ganze Artikel kommt erst hier, beim Öffnen — die Liste trägt nur
       seine Zeile. Wechselt die Id (ein Verweis auf der Seite), wird
       der nächste geholt. */
    effect(() => {
      void this.bestand.oeffnen(this.id());
    });
    /* Würfelknöpfe auf dieser Seite würfeln auf diesen Artikel (T-172). */
    effect(() => this.wurfZiel.id.set(this.id()));
    /* Die `partOf`-Kette für den Brotkrumenpfad, Glied für Glied (T-093). */
    effect(() => {
      const offen = this.kette().offen;
      if (offen) void untracked(() => this.bestand.holen([offen]));
    });
    /* **Die Fassungen** (T-092) kommen je Artikel, neben ihm: eine
       Anfrage, und der Vergleich rechnet hier. Namen der Kantenziele, die
       eine Fassung anders hat, holt die Liste nach. */
    void this.lesart.laden();
    effect(() => {
      const id = this.id();
      untracked(() => void this.fassungenLaden(id));
    });
    /* **Wer das Original öffnet, landet bei der Fassung** (E-018, T-082):
       der Server liefert, was in der laufenden Kampagne gilt. Die Adresse
       zieht nach, damit Speichern und Verweise die Fassung meinen. */
    effect(() => {
      const e = this.artikel();
      if (e && e.id !== this.id()) void untracked(() => this.router.navigate(['/artikel', e.id], { replaceUrl: true }));
    });
    /* Einmal je Artikel: nach dem Speichern steht `?edit=1` noch in der
       Adresse, und die Seite soll dann lesen, nicht wieder bearbeiten. */
    let schonBearbeitet = '';
    effect(() => {
      const id = this.id();
      if (!this.edit() || schonBearbeitet === id) return;
      if (this.artikel() && this.reg() && this.darfSchreiben()) {
        schonBearbeitet = id;
        untracked(() => this.beginnen());
      }
    });
  }

  private readonly reg = computed<Registry | null>(() => this.bestand.registry());
  /** Der letzte fertige Stand, wenn er gerade angesehen wird (E-012) —
   *  nur zum Lesen, gemerkt mit der Id, zu der er gehört. */
  private readonly alterStand = signal<{ id: string; e: Entity } | null>(null);
  protected readonly laedtAlten = signal(false);
  protected readonly zeigtAlten = computed(() => this.alterStand()?.id === this.id());
  protected readonly artikel = computed<Entity | undefined>(() => {
    const alt = this.alterStand();
    if (alt && alt.id === this.id()) return alt.e;
    return this.bestand.voll().get(this.id());
  });
  /** Das Datum des fertigen Stands, der noch gilt — für das Band. */
  protected readonly fertigAm = computed(() => {
    const at = this.bestand.fertig().get(this.id());
    return at ? new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
  });

  protected async zeigeAlten(): Promise<void> {
    const id = this.id();
    this.laedtAlten.set(true);
    try {
      const { refs: _refs, ...e } = await this.api.readyVersion(id);
      if (this.id() === id) this.alterStand.set({ id, e: e as Entity });
    } catch (error) {
      this.problem.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.laedtAlten.set(false);
    }
  }

  protected zeigeNeuen(): void {
    this.alterStand.set(null);
  }

  /** „ready" ohne die Maske: der neue Stand gilt (REQ-237). */
  protected readonly freigabeLaeuft = signal(false);
  /** Einzeln freigeben oder zurücknehmen (T-187), danach neu holen: Band und Fassungen ändern sich. */
  protected async freigeben(campaign: string, on: boolean): Promise<void> {
    const id = this.id();
    this.freigabeLaeuft.set(true);
    try {
      await this.api.setEnabled(campaign, id, on);
      await this.bestand.oeffnen(id, true);
    } catch (error) {
      this.problem.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.freigabeLaeuft.set(false);
    }
  }

  protected async fertigNennen(): Promise<void> {
    const id = this.id();
    try {
      await this.api.setReady(id);
      this.alterStand.set(null);
      await this.bestand.oeffnen(id, true);
    } catch (error) {
      this.problem.set(error instanceof Error ? error.message : String(error));
    }
  }
  /* **Der Ort wählt die Ansicht** (CLAUDE.md): die Artikelseite zeigt
     `full`. Hier stand ein Wähler — einen gibt es nicht, und wer weniger
     sehen darf, sieht dieselbe Ansicht mit weniger darin. */
  private readonly view = computed<ViewDef | null>(() => {
    const r = this.entwurfsRegister() ?? this.reg();
    return r ? resolveView(r, 'full') : null;
  });

  protected typLabel(typ: string): string {
    return this.reg()?.interfaces[typ]?.label ?? typ;
  }

  /** Der Bereich der Art (`area` am Typ) — für den Brotkrumenpfad. */
  protected readonly bereich = computed(() => {
    const e = this.artikel();
    const r = this.reg();
    return e && r ? areaOf(r, primaryInterface(e)) : '';
  });
  protected readonly bereichName = computed(() => bereichLabel(this.bereich()) ?? 'Compendium');

  /**
   * Der Brotkrumenpfad zwischen Art und Artikel (T-093, REQ-248): die
   * Ebene, die ihn bringt, dann die `partOf`-Kette von oben nach unten —
   * Abenteuer › Kapitel › Raum. Was der Betrachter nicht sehen darf, kommt
   * ohne Namen und beendet die Kette dort; ein Kreis läuft nicht endlos.
   */
  private readonly kette = computed<{ glieder: { id: string; name: string }[]; offen: string | null }>(() => {
    const e = this.artikel();
    if (!e) return { glieder: [], offen: null };
    const name = this.bestand.name();
    const voll = this.bestand.voll();
    const fehlt = this.bestand.fehlt();
    const glieder: { id: string; name: string }[] = [];
    const gesehen = new Set([e.id]);
    let jetzt: Entity | undefined = e;
    let offen: string | null = null;
    while (jetzt && glieder.length < PFAD_TIEFE) {
      const hoch: string | undefined = jetzt.relations?.find((r) => r.type === PART_RELATION)?.to;
      if (!hoch || gesehen.has(hoch)) break;
      gesehen.add(hoch);
      jetzt = voll.get(hoch);
      /* Noch nicht geholt: `holen` bringt es samt Namen und `partOf`. */
      if (!jetzt && !fehlt.has(hoch)) offen = hoch;
      const n = name(hoch);
      if (!n) break;
      glieder.unshift({ id: hoch, name: n });
    }
    const ebene = e.relations?.find((r) => r.type === LAYER_RELATION)?.to;
    const ebenenName = ebene ? name(ebene) : undefined;
    if (ebene && ebenenName && !gesehen.has(ebene)) glieder.unshift({ id: ebene, name: ebenenName });
    return { glieder, offen };
  });
  protected readonly pfad = computed(() => this.kette().glieder);

  /** Der Statblock, der an dieser Figur hängt (`belongsTo` drüben), mit Namen — für den Hinweis im Full edit (T-272). */
  protected readonly statblockDerFigur = computed<{ id: string; name: string } | null>(() => {
    const e = this.artikel();
    if (!e) return null;
    const b = (this.bestand.rueckbezuege().get(e.id) ?? []).find((x) => x.relation.type === 'belongsTo' && x.relation.to === e.id);
    return b ? { id: b.from.id, name: entityName(b.from) } : null;
  });

  /** Art · Nummer — die Zeile über dem Blatt. Die Ebene steht in der Marke unter dem Namen (T-251). */
  protected readonly meta = computed(() => {
    const e = this.artikel();
    if (!e) return '';
    const nummer = (e.components?.['Identity'] as { id?: string } | undefined)?.id;
    return [this.typLabel(primaryInterface(e)), nummer].filter(Boolean).join(' · ');
  });

  /** Aliasse und Deckname, kursiv unter dem Namen. */
  protected readonly untertitel = computed(() => {
    const id = this.artikel()?.components?.['Identity'] as
      | { aliases?: string[]; cover?: string }
      | undefined;
    const teile = [...(id?.aliases ?? [])];
    if (id?.cover) teile.push(`known as ${id.cover}`);
    return teile.join(' · ');
  });

  /** Was der Artikel über seine Sichtbarkeit sagt — `public` ist die Vorgabe. */
  protected readonly sicht = computed(() => {
    const v = this.artikel()?.components?.['Visibility'] as
      | { audience?: string; revealedTo?: string[]; hiddenFrom?: string[] }
      | undefined;
    const name = this.bestand.name();
    /* Träger als Links, wie jedes Verweisfeld (T-068). */
    return {
      audience: v?.audience ?? 'public',
      listen: [
        { label: 'Revealed to', links: verweisZiele(v?.revealedTo, name) },
        { label: 'Hidden from', links: verweisZiele(v?.hiddenFrom, name) },
      ].filter((l) => l.links.length),
    };
  });

  protected readonly quelle = computed(() => {
    const q = this.artikel()?.components?.['Source'] as
      | { publication?: string; page?: string; url?: string }
      | undefined;
    if (!q?.publication && !q?.url) return null;
    const text = [q.publication, q.page ? `p. ${q.page}` : ''].filter(Boolean).join(', ');
    const k = q.publication?.trim() ?? '';
    /* Dazu der Herausgeber (T-094): offizielles D&D, Partner oder Homebrew. */
    return { text: text || q.url || '', url: q.url, titel: k ? this.quellen.titel(k) : '', verlag: k ? this.quellen.herausgeber(k) : '' };
  });
  protected name(e: Entity): string {
    return entityName(e);
  }
  protected art(e: Entity): string {
    return primaryInterface(e);
  }

  /**
   * Woraus `{VAR}` im Text aufgelöst wird: der Artikel, dann das Register
   * (REQ-174). Die Bindung an einer Kante kennt nur, wer den Text über die
   * Kante hereinzieht — die Artikelseite zeigt ihn für sich.
   */
  protected readonly scopes = computed<VarScopes>(() => {
    const e = this.artikel();
    const vars = e?.components?.['Vars'] as { bindings?: Record<string, string> } | undefined;
    return { entity: vars?.bindings, campaign: this.reg()?.vars };
  });

  protected readonly beschreibung = computed<string | null>(() => {
    const e = this.artikel();
    const v = this.view();
    if (!e || !v?.description) return null;
    const d = e.components?.['Description'] as { description?: string } | undefined;
    return d?.description ?? null;
  });

  /** Jede Feldzelle des Artikels (`feldZellen`); wo welche steht, sagt `stuecke`. */
  private readonly alleZellen = computed<Zelle[]>(() => {
    const e = this.artikel();
    const r = this.reg();
    return e && r ? feldZellen(r, e, this.bestand.name()) : [];
  });

  /**
   * **Die Seite, wie die Anordnung der Art sie sagt** (`layoutFor`, die
   * `extends`-Kette hoch; zugeteilt in `anordnen`). Was kein Element
   * zeichnet, steht am Ende, weil `full` es sagt (`rest`, T-110).
   */
  private readonly anordnung = computed(() => {
    const e = this.artikel();
    const r = this.reg();
    if (!e || !r) return [];
    /* Was `when` an diesem Artikel ausschliesst, fällt weg (T-184). */
    return forArticle(layoutFor(this.entwurfsRegister() ?? r, 'full', primaryInterface(e)).layout, e);
  });

  protected readonly stuecke = computed<Stueck[]>(() => {
    const e = this.artikel();
    const r = this.reg();
    if (!e || !r) return [];
    const v = this.view();
    const layout = this.anordnung();
    /* Leere Felder, wenn die Ansicht es sagt (T-110) — beim Lesen; die
       Maske zeigt ohnehin jedes Feld. */
    const zellen = v?.empty === 'show' ? mitLeeren(r, e, this.zellenMitFassungen()) : this.zellenMitFassungen();
    return anordnen(layout, zellen, this.prosaMitFassungen(), {
      beschreibung: this.beschreibung(),
      beschreibungZeigen: !!this.vglBeschreibung(),
      rest: !!v?.rest,
      bild: bildDes(e, r),
    });
  });

  /**
   * **Die Reiter, die etwas zeigen** (T-247): ein Reiter ohne Stück ist ein
   * Knopf, der nichts tut. Welcher offen ist, sagt `?tab=` (ein Link wie
   * „Gold → Gear" setzt ihn), sonst der erste.
   */
  protected readonly reiter = computed(() => {
    const st = this.stuecke().filter((x) => !NOCH_NICHT.has(x.art));
    return reiterVon(this.anordnung()).filter((t) => st.some((x) => x.reiter === t.id));
  });
  protected readonly aktiverReiter = computed(() => {
    const ids = this.reiter().map((t) => t.id);
    const w = this.tab();
    return w && ids.includes(w) ? w : ids[0] ?? null;
  });
  protected readonly sichtbareStuecke = computed(() => {
    const a = this.aktiverReiter();
    return this.stuecke().filter((x) => !NOCH_NICHT.has(x.art) && (!x.reiter || !a || x.reiter === a));
  });
  /** Die Reiterzeile steht vor dem ersten Stück in einem Reiter — unter dem Kopf. */
  protected readonly ersterImReiter = computed(() => this.sichtbareStuecke().find((x) => x.reiter)?.id ?? null);
  protected zeigeReiter(id: string): void {
    void this.router.navigate([], { queryParams: { tab: id }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  /** Steht ein Buch-Element zuoberst, setzt es die Zeile unter den Namen. */
  protected readonly buchKopf = computed(() => {
    const erstes = this.stuecke()[0]?.art;
    return erstes === 'statblock' || erstes === 'spell' || erstes === 'item';
  });

  /** Die Prosa dieses Artikels (`prosaVon`). */
  protected readonly prosa = computed(() => {
    const e = this.artikel();
    const r = this.reg();
    return e && r ? prosaVon(r, e) : [];
  });

  protected readonly kanten = computed(() => {
    const e = this.artikel();
    const r = this.reg();
    if (!e || !r || !this.view()?.relations) return [];
    const name = this.bestand.name();
    const voll = this.bestand.voll();
    /* **Ein Eintrag je Klasse** (T-095): die Antworten stehen bei der
       Klasse (oder Abstammung, Hintergrund), die fragt, nicht daneben. */
    const zu = antwortenJeEintrag(e.relations ?? []);
    const antworten = (id: string) =>
      (e.relations ?? [])
        .filter((a) => zu.get(a.id) === id)
        .map((a) => {
          const picks = Array.isArray(a.props?.['picks']) ? (a.props['picks'] as unknown[]).map(String) : [];
          return { id: a.id, ...antwortText(voll.get(a.to), String(a.props?.['choice'] ?? ''), picks, name) };
        });
    /* Die Ebene steht schon in der Zeile über dem Blatt. */
    return (e.relations ?? [])
      .filter((rel) => rel.type !== LAYER_RELATION && !zu.has(rel.id))
      .map((rel) => {
        const ziel = name(rel.to);
        const sub = rel.type === 'hasClass' && typeof rel.props?.['subclass'] === 'string' ? rel.props['subclass'] : '';
        const stufe = rel.type === 'hasClass' ? Number(rel.props?.['level']) || 1 : 0;
        const antw = EINTRAG_KANTEN.includes(rel.type) ? antworten(rel.id) : [];
        const subName = sub ? (name(sub) ?? sub) : '';
        return {
          id: rel.id,
          typ: rel.type,
          label: relationDef(r, rel.type).label,
          ziel: ziel === undefined ? '' : rel.to,
          /* Ein Ziel, das es nicht gibt, wird gesagt und nicht verschwiegen —
             es kann auch heissen, dass der Betrachter es nicht sehen darf. */
          text: rel.type === 'chose' ? `${ziel ?? rel.to}: ${String(rel.props?.['choice'] ?? '')}` : (ziel ?? '(not here)'),
          stufe,
          /* Die Unterklasse einmal: steht sie schon als Antwort da, nicht noch als Zeile. */
          unter: sub && !antw.some((a) => a.text === subName) ? { id: sub, name: subName } : null,
          antworten: antw,
        };
      });
  });

  /**
   * Die Quellen der Antworten ganz holen — ihre Wahlen sagen, wie eine
   * Antwort heisst und ob sie Ids hält —, danach die gewählten Artikel für
   * ihre Namen (T-095).
   */
  private readonly antwortQuellen = effect(() => {
    const e = this.artikel();
    if (!e?.relations?.some((r) => r.type === 'chose')) return;
    const voll = this.bestand.voll();
    const ids = new Set<string>();
    for (const r of e.relations) {
      if (r.type === 'chose') ids.add(r.to);
      if (r.type === 'hasClass' && typeof r.props?.['subclass'] === 'string') ids.add(r.props['subclass']);
    }
    for (const r of e.relations) {
      if (r.type !== 'chose') continue;
      const c = choicesOf(voll.get(r.to)).find((x) => x.id === r.props?.['choice']);
      if (c && (['feat', 'spell', 'feature', 'subclass'].includes(String(c.kind)) || c.from?.interfaces?.length)) {
        for (const p of Array.isArray(r.props?.['picks']) ? (r.props['picks'] as unknown[]) : []) ids.add(String(p));
      }
    }
    untracked(() => void this.bestand.holen([...ids]));
  });

  // ------------------------------------------------------------ Fassungen (T-092)

  private readonly fassungsStand = signal<{ id: string; f: Fassungen } | null>(null);
  protected readonly fassungen = computed(() => {
    const s = this.fassungsStand();
    return s && s.id === this.id() ? s.f : null;
  });

  private async fassungenLaden(id: string): Promise<void> {
    try {
      const f = await this.api.versions(id);
      if (id !== this.id()) return;
      this.fassungsStand.set({ id, f });
      const ziele = new Set<string>();
      for (const v of f.versions) for (const r of v.entity.relations ?? []) if (r.to) ziele.add(r.to);
      const name = this.bestand.name();
      const fehlen = [...ziele].filter((x) => name(x) === undefined).slice(0, 200);
      if (fehlen.length) await this.bestand.liste({ ids: fehlen, limit: 200 });
    } catch {
      /* Ohne Fassungen steht der Artikel für sich — das ist kein Fehler der Seite. */
      if (id === this.id()) this.fassungsStand.set(null);
    }
  }

  /** Die Fassungen, die nach der Lesart verglichen werden — mit Kürzel und Tooltip. */
  protected readonly vergleich = computed(() =>
    vergleichsfassungen(verglichene(this.fassungen(), this.lesart.stand())),
  );

  /**
   * Was die verglichenen Fassungen anders sagen — je Feld und je Kantenart.
   * Gegen den gespeicherten Artikel, auch während der Maske offen ist
   * (T-103): wer bearbeitet, will sehen, was die andere Fassung dort sagt.
   */
  private readonly abw = computed(() => {
    const e = this.artikel();
    const r = this.reg();
    const v = this.vergleich();
    if (!e || !r || !v.length) return { felder: new Map<string, Abweichung[]>(), kanten: [] };
    return abweichungen(r, e, v, this.bestand.name());
  });

  protected abwAn(ref: string): Abweichung[] {
    return this.abw().felder.get(ref) ?? [];
  }

  /**
   * **Jeder Prosaeintrag, Abschnitt für Abschnitt verglichen** (T-103):
   * Eintrags-Ref → Vergleich. Nur für Prosafelder, an denen eine Fassung
   * etwas anderes sagt; die übrigen zeichnen sich wie bisher am Stück.
   */
  private readonly prosaVgl = computed(() => {
    const e = this.artikel();
    const r = this.reg();
    const v = this.vergleich();
    const out = new Map<string, ProsaVergleich>();
    if (!e || !r || !v.length) return out;
    const felder = this.abw().felder;
    for (const f of proseFields(r, primaryInterface(e))) {
      if (!felder.has(`${f.type}.${f.key}`)) continue;
      const basis = entriesOf((e.components?.[f.type] as Record<string, unknown> | undefined)?.[f.key]);
      for (const [id, vgl] of prosaVergleich(f.type, f.key, basis, v)) out.set(entryRef(f.type, f.key, id), vgl);
    }
    return out;
  });
  protected vglProsa(ref: string): ProsaVergleich | null {
    return this.prosaVgl().get(ref) ?? null;
  }

  /** Die Beschreibung ebenso, Abschnitt für Abschnitt (T-103). */
  protected readonly vglBeschreibung = computed<ProsaVergleich | null>(() => {
    const e = this.artikel();
    const v = this.vergleich();
    if (!e || !v.length || !this.abw().felder.has('Description.description')) return null;
    const text = (c: Entity) => String((c.components?.['Description'] as { description?: unknown } | undefined)?.description ?? '');
    return textVergleich(text(e), v.map((f) => ({ f, text: text(f.entity) })));
  });

  protected istKarte(e: Entity): boolean {
    return isMap(e);
  }

  protected istBild(e: Entity): boolean {
    const r = this.reg();
    return !!r && isAsset(r, e);
  }

  /** Welche Bildklasse ein Bildfeld zuerst anbietet (T-119) — aus `target.where`. */
  protected klasseVon(f: Feld): string {
    return offeredAssetKind(f.schema?.target) ?? '';
  }

  protected nurDortTitel(heading: string): string {
    return `${heading || 'More text'} — only in this version`;
  }

  /**
   * **Die Zellen samt denen, die nur eine andere Fassung füllt** (T-103):
   * „hier —, VGM: Medium" steht an dem Feld, wo es hingehört, und nicht in
   * einer Liste am Ende. Eingefügt hinter die letzte Zelle derselben Karte,
   * sonst am Ende; wohin sie gehört, sagt danach die Anordnung wie für jede.
   */
  private readonly zellenMitFassungen = computed<Zelle[]>(() => {
    const zellen = this.alleZellen();
    const e = this.artikel();
    const r = this.reg();
    const felder = this.abw().felder;
    if (!e || !r || !felder.size) return zellen;
    const da = new Set(zellen.map((z) => z.ref));
    const prosa = new Set(proseFields(r, primaryInterface(e)).map((f) => `${f.type}.${f.key}`));
    const out = [...zellen];
    for (const [ref, liste] of felder) {
      if (da.has(ref) || prosa.has(ref)) continue;
      const [comp = '', prop = ''] = ref.split('.');
      if (SCHON_ANDERSWO.includes(comp)) continue;
      const schema = r.interfaces[comp]?.schema?.properties?.[prop];
      if (schema?.many && schema.format === 'long') continue;
      const zelle: Zelle = {
        ref,
        comp,
        prop,
        leer: true,
        lang: liste.some((a) => a.lang),
        label: schema ? fieldTitle(r, primaryInterface(e), { type: comp, key: prop, prop: schema }) : prop,
        wert: '—',
      };
      let hinter = -1;
      out.forEach((z, i) => {
        if (z.comp === comp) hinter = i;
      });
      if (hinter < 0) out.push(zelle);
      else out.splice(hinter + 1, 0, zelle);
    }
    return out;
  });

  /** Beginnt hier ein anderes Feld als im Eintrag davor? Dann steht seine Überschrift (T-184). */
  protected neuesFeld(prosa: readonly Prosa[] | undefined, i: number): boolean {
    const feld = (p: Prosa | undefined) => (p ? `${p.type}.${p.key}` : '');
    return i === 0 || feld(prosa?.[i - 1]) !== feld(prosa?.[i]);
  }

  /** Die Prosa samt leeren Einträgen, wo nur eine andere Fassung Text hat (T-103). */
  private readonly prosaMitFassungen = computed<Prosa[]>(() => {
    const prosa = this.prosa();
    const e = this.artikel();
    const r = this.reg();
    const felder = this.abw().felder;
    if (!e || !r || !felder.size) return prosa;
    const out = [...prosa];
    for (const f of proseFields(r, primaryInterface(e))) {
      if (!felder.has(`${f.type}.${f.key}`) || prosa.some((b) => b.type === f.type && b.key === f.key)) continue;
      out.push({
        ref: entryRef(f.type, f.key, ''),
        type: f.type,
        key: f.key,
        label: fieldTitle(r, primaryInterface(e), f),
        wert: '',
        leer: true,
      });
    }
    return out;
  });

  /**
   * Was kein Element der Seite zeigt — es steht am Ende. Seit T-103 nur
   * noch, was keine Anordnung nimmt: leere Felder stehen an ihrem Platz,
   * Buch-Elemente zeigen ihre Zeilen selbst.
   */
  protected readonly abwRest = computed(() => {
    const e = this.artikel();
    const r = this.reg();
    const felder = this.abw().felder;
    if (!e || !r || !felder.size) return [];
    const gezeigt = new Set<string>();
    const karten = new Set<string>();
    for (const st of this.stuecke()) {
      for (const z of st.zellen ?? []) gezeigt.add(z.ref);
      for (const b of st.prosa ?? []) gezeigt.add(`${b.type}.${b.key}`);
      if (st.art === 'beschreibung') gezeigt.add('Description.description');
      if (st.art === 'klasse' || st.art === 'herkunft') {
        for (const k of BOOK_CARDS[st.art === 'klasse' ? 'classOverview' : 'originOverview'] ?? []) karten.add(k);
      }
      if (st.art === 'statblock' || st.art === 'spell' || st.art === 'item') {
        for (const k of BOOK_CARDS[st.art] ?? []) karten.add(k);
        if (st.art === 'spell') ['Description.description', 'Prose.paragraph'].forEach((x) => gezeigt.add(x));
      }
    }
    const hier = new Map(this.alleZellen().map((z) => [z.ref, z.wert]));
    const out: { ref: string; label: string; lang: boolean; hier: string; liste: Abweichung[] }[] = [];
    for (const [ref, liste] of felder) {
      const [type = '', key = ''] = ref.split('.');
      if (gezeigt.has(ref) || karten.has(type)) continue;
      const prop = r.interfaces[type]?.schema?.properties?.[key];
      out.push({
        ref,
        label: prop ? fieldTitle(r, primaryInterface(e), { type, key, prop }) : key,
        lang: liste.some((a) => a.lang),
        hier: hier.get(ref) ?? '',
        liste,
      });
    }
    return out;
  });

  protected readonly abwKanten = computed(() => {
    const r = this.reg();
    if (!r) return [];
    return this.abw().kanten.map((k) => ({ ...k, label: relationDef(r, k.type).label }));
  });

  /** Nach dem Übernehmen oder Zurücknehmen gilt ein anderer Artikel. */
  protected async gewechselt(id: string): Promise<void> {
    await this.bestand.oeffnen(id, true);
    await this.router.navigate(['/artikel', id]);
    await this.fassungenLaden(id);
  }

  // ------------------------------------------------------------ bearbeiten

  /** Woraus „Create … as …" anlegt (T-131): dieser Artikel. */
  herkunft(): Entity | null {
    return this.artikel() ?? null;
  }

  /**
   * Vor „Open" im Schnell-Anlegen (T-131): der neue Artikel steht schon im
   * Entwurf, und ein Wechsel ohne Speichern nähme ihn mit. Also erst
   * speichern; schlägt das fehl, bleibt man hier.
   */
  async vorOeffnen(): Promise<boolean> {
    if (!this.bearbeitet()) return true;
    await this.speichern();
    return !this.bearbeitet();
  }

  /** Der Weg zurück nach „Open" (T-131), solange der Artikel ihn kennt. */
  protected readonly zurueck = computed(() => {
    const von = this.from();
    if (!von || von === this.id()) return null;
    const name = this.bestand.name()(von);
    return name ? { id: von, name } : null;
  });

  protected readonly bearbeitet = signal(false);
  protected readonly speichert = signal(false);
  protected readonly problem = signal<string | null>(null);
  protected readonly maengel = signal<string[]>([]);
  /** Verweise, die beim letzten Speichern keine Id bekamen (M11). */
  protected readonly offeneVerweise = signal<string[]>([]);
  protected readonly felder = signal<Feld[]>([]);
  /**
   * **Welche Felder die Maske zeigt** (T-195): Pflicht, befüllt,
   * `prominent`, `alwaysEdit` — festgehalten beim Öffnen und um das
   * erweitert, was „+ Add field“ dazuholt. Ein Feld, das man leert, bleibt
   * stehen: es verschwände sonst unter dem Cursor.
   */
  protected readonly gezeigt = signal<ReadonlySet<string>>(new Set());
  protected readonly sichtbareFelder = computed(() => {
    const da = this.gezeigt();
    return this.felder().filter((f) => da.has(f.ref));
  });
  /** Die übrigen, nach Bestandteil gruppiert, für die Auswahl. */
  protected readonly feldwahlOffen = signal(false);
  protected readonly feldSuche = signal('');
  protected readonly weitereFelder = computed(() => {
    const da = this.gezeigt();
    const q = this.feldSuche().trim().toLowerCase();
    const gruppen = new Map<string, Feld[]>();
    for (const f of this.felder()) {
      if (da.has(f.ref) || f.schema?.readOnly) continue;
      if (q && !`${f.gruppe} ${f.titel} ${f.beschreibung}`.toLowerCase().includes(q)) continue;
      const g = gruppen.get(f.gruppe) ?? [];
      g.push(f);
      gruppen.set(f.gruppe, g);
    }
    return [...gruppen].map(([name, felder]) => ({ name, felder }));
  });
  protected readonly weitereZahl = computed(
    () => this.felder().filter((f) => !this.gezeigt().has(f.ref) && !f.schema?.readOnly).length,
  );

  protected feldwahl(offen: boolean): void {
    this.feldSuche.set('');
    this.feldwahlOffen.set(offen);
    if (offen) setTimeout(() => document.querySelector<HTMLInputElement>('.feldwahl input')?.focus());
  }

  /** Ein Feld aus der Auswahl dazu — und gleich hinein. */
  protected feldDazu(ref: string): void {
    this.gezeigt.update((s) => new Set([...s, ref]));
    this.feldwahl(false);
    setTimeout(() => {
      const ziel = document.querySelector<HTMLElement>(`.maske [data-ref="${CSS.escape(ref)}"]`);
      ziel?.querySelector<HTMLElement>('input, select, textarea, button')?.focus();
    });
  }
  protected readonly entwurfProsa = signal<
    { id: string; type: string; key: string; label: string; wert: string }[]
  >([]);

  private readonly api = inject(Api);

  /** „Im Buch lesen" — der Server sagt es mit dem Artikel (`refs.reading`, T-091). */
  protected readonly leseZiel = computed(() => this.bestand.lesen().get(this.id()));
  /** Nennt die Anordnung das Element `reader` (T-191)? Beim Bearbeiten nie. */
  protected readonly leser = computed(() => !this.bearbeitet() && this.stuecke().some((st) => st.art === 'leser'));
  /** Steht an dieser Kampagne der Reiter „Rules & options" offen (T-190)? Beim Bearbeiten nie. */
  protected readonly regelReiter = computed(
    () => this.tab() === 'rules' && !this.bearbeitet() && !!this.artikel() && this.art(this.artikel()!) === 'Campaign',
  );
  protected leseParams(z: LeseZiel): Record<string, string> {
    return z.at ? { at: z.at } : z.page ? { page: z.page } : {};
  }

  /** Was dieser Laden führt (`refs.shop`, T-129). */
  protected readonly ladenwaren = computed(() => this.bestand.laden().get(this.id()));
  /** Womit an diesem Rezept gefertigt wird (`refs.craft`, T-122). */
  protected readonly fertigung = computed(() => this.bestand.fertigung().get(this.id()));
  protected fertigungText(c: Fertigungswert): string {
    return [c.tool || 'no tool', c.ability.toUpperCase(), `DC ${c.dc}`].join(' · ');
  }
  /** Was nicht aus dem Rezept kommt, und von wem — die Vorgabe der Quelle sagt nichts. */
  protected fertigungHerkunft(c: Fertigungswert): string {
    const teile: string[] = [];
    for (const [was, q] of [['tool', c.source.tool], ['ability', c.source.ability], ['DC', c.source.dc]] as const) {
      if (q.by === 'recipe') continue;
      const wer = q.by === 'actor' ? (q.name ?? 'character') : `${q.by} ${q.name ?? ''}`.trim();
      teile.push(`${was} from ${wer}${q.on === 'tool' ? ' (for the tool)' : ''}`);
    }
    return teile.join(', ');
  }

  /** „Adapt" anbieten — der Server hat es mit dem Artikel gesagt (`refs.adaptable`). */
  protected readonly anpassbar = computed(() => this.bestand.anpassbar().has(this.id()));
  /**
   * **Wohin eine Änderung geht** (T-161): die Ebenen des Artikels, und ob
   * das die Schreibebene ist. Eine Fassung liegt schon in der eigenen.
   */
  protected readonly schreibZiel = computed(() => {
    const e = this.artikel();
    if (!e) return null;
    const ebenen = (e.relations ?? []).filter((r) => r.type === LAYER_RELATION).map((r) => r.to);
    const name = this.bestand.name();
    const w = this.stapel.schreib()?.layer;
    return {
      /* Ebenen ausserhalb des Stapels nennt der Server nicht (T-207). */
      ebenen: ebenen.map((id) => name(id)).filter((n): n is string => !!n),
      schreib: w?.name ?? null,
      fremd: !w || !ebenen.includes(w.id),
    };
  });

  /** Wohin „Edit" eine Fassung legt, wenn man den Artikel nicht schreibt (`refs.adaptTo`, T-098). */
  protected readonly fassungsZiele = computed(() => this.bestand.anpassZiele().get(this.id()) ?? []);
  protected readonly passtAn = signal(false);
  protected readonly anpassFehler = signal<string | null>(null);

  /** Ist das eine Fassung (E-018)? Dann das Original, das sie ersetzt. */
  protected readonly original = computed(() => {
    const e = this.artikel();
    const ziel = (e?.relations ?? []).find((r) => r.type === 'overrides')?.to;
    return ziel ? { id: ziel, name: this.bestand.name()(ziel) ?? 'the original' } : null;
  });

  protected async anpassen(): Promise<void> {
    const e = this.artikel();
    if (!e) return;
    this.passtAn.set(true);
    this.anpassFehler.set(null);
    try {
      const { id } = await this.api.adapt(e.id);
      /* Das Original zeigt ab jetzt auf die Fassung; was offen war, gilt nicht mehr. */
      await this.bestand.oeffnen(this.id(), true);
      await this.router.navigate(['/artikel', id]);
    } catch (x) {
      this.anpassFehler.set(x instanceof Error ? x.message : String(x));
    } finally {
      this.passtAn.set(false);
    }
  }

  /**
   * **„Edit" an einem fremden Artikel** (T-098, E-001): eine Fassung in der
   * gewählten eigenen Ebene, dann gleich bearbeiten (`?edit=1`). Gibt es sie
   * schon, öffnet der Server die bestehende.
   */
  protected async alsFassung(layer: string): Promise<void> {
    const e = this.artikel();
    if (!e || !layer) return;
    this.passtAn.set(true);
    this.anpassFehler.set(null);
    try {
      const { id } = await this.api.adapt(e.id, layer);
      /* Die Fassung ist neu: was ich schreibe, sagt der Server erst jetzt (`/api/me`). */
      await this.session.load(true);
      await this.bestand.oeffnen(this.id(), true);
      await this.router.navigate(['/artikel', id], { queryParams: { edit: 1 } });
    } catch (x) {
      this.anpassFehler.set(x instanceof Error ? x.message : String(x));
    } finally {
      this.passtAn.set(false);
    }
  }

  /** Ein Teil eines Buchs (T-108)? Dann lässt er sich auch verwenden statt holen (E-028). */
  protected readonly istBuchteil = computed(() => {
    const e = this.artikel();
    return !!e && isBookPart(e);
  });

  /** Wohin „Take" den Artikel hängen kann (`refs.takeInto`, E-026). */
  protected readonly uebernahmeZiele = computed(() => this.bestand.uebernahmeZiele().get(this.id()) ?? []);

  /**
   * **In die Geschichte holen** (E-026): Fassungen in der Ebene der Kampagne für den
   * Artikel und alles darunter, gehängt an das gewählte Ziel. Danach die
   * Fassung öffnen — das Original zeigt ab jetzt auf sie.
   */
  protected async uebernehmen(into: string, verwenden = false): Promise<void> {
    const e = this.artikel();
    if (!e || !into) return;
    this.passtAn.set(true);
    this.anpassFehler.set(null);
    try {
      const { id } = await this.api.take(e.id, into, verwenden);
      await this.bestand.oeffnen(this.id(), true);
      await this.router.navigate(['/artikel', id]);
    } catch (x) {
      this.anpassFehler.set(x instanceof Error ? x.message : String(x));
    } finally {
      this.passtAn.set(false);
    }
  }

  protected async zumOriginal(original: string): Promise<void> {
    const e = this.artikel();
    if (!e || !confirm('Delete this version? The campaign sees the original again.')) return;
    this.passtAn.set(true);
    this.anpassFehler.set(null);
    try {
      await this.api.deleteEntity(e.id);
      await this.bestand.oeffnen(original, true);
      await this.router.navigate(['/artikel', original]);
    } catch (x) {
      this.anpassFehler.set(x instanceof Error ? x.message : String(x));
    } finally {
      this.passtAn.set(false);
    }
  }

  protected readonly darfSchreiben = computed(() => {
    const e = this.artikel();
    return e ? this.session.darfSchreiben()(e.id) : false;
  });

  /**
   * Die Maske kennt **jedes erlaubte Feld**, nicht nur die ausgefüllten:
   * ein Feld, das erst erscheint, wenn es einen Wert hat, kann niemand zum
   * ersten Mal ausfüllen. **Gezeigt** werden Pflicht- und befüllte Felder
   * (T-195, `stehtDa`); die übrigen holt „+ Add field“ mit ihrer
   * Beschreibung. Die Darstellungsstufe gilt hier nicht — sie sagt, was man
   * *liest*, nicht was es gibt.
   */
  protected beginnen(): void {
    const e = this.artikel();
    const r = this.reg();
    if (!e || !r) return;
    const erlaubt = typeChain(r, primaryInterface(e));
    const pflicht = new Set(
      erlaubt.flatMap((t) => (r.interfaces[t]?.schema?.required ?? []).map((k) => `${t}.${k}`)),
    );
    const out: Feld[] = [];
    const da = new Set<string>();
    for (const comp of erlaubt) {
      const def = r.interfaces[comp];
      if (!def) continue;
      const karte = (e.components?.[comp] ?? {}) as Record<string, unknown>;
      for (const [prop, schema] of Object.entries(def.schema?.properties ?? {})) {
        /* Abgeleitete Werte bekommen keine Eingabe (D8). Sie hier
           anzubieten hiesse, jemanden etwas eintippen zu lassen, das beim
           nächsten Lesen überschrieben wird. */
        if (schema.derived) continue;
        /* Ein Prosafeld gehört der Prosamaske und nicht der Feldliste.
           Zweimal dasselbe anzubieten hiesse, dass der zweite Eingang den
           ersten überschreibt, und keiner der beiden sagte das. */
        if (schema.many && schema.format === 'long') continue;
        /* Ohne Artikel: eine Auswahl, die eine Art nennt (M6), hätte den
           ganzen Bestand gebraucht, und den hält der Browser nicht mehr
           (W7). Sie wird ein freies Wort — heute nennt das nur Felder mit
           mehreren Werten, und die sind ohnehin eine Liste. */
        let werte = enumOptions(r, schema) ?? [];
        /* **`ready` setzt die Leitung** (REQ-237, E-011): Spielenden bietet
           die Maske es nicht an — ausser es steht schon da, sonst zeigte
           die Auswahl einen fertigen Artikel als leer. Der Server prüft. */
        if (comp === 'Status' && prop === 'status' && !this.session.darfReady()(e.id) && karte[prop] !== 'ready') {
          werte = werte.filter((w) => w !== 'ready');
        }
        /* Eine Auswahl ohne Werte ist ein freies Wort: nennt das Feld eine
           Art, von der noch nichts sichtbar ist (M6), soll man trotzdem
           etwas eintragen können. */
        const art = eingabeArt(schema) === 'auswahl' && !werte.length ? 'text' : eingabeArt(schema);
        const chips = art === 'verweise' || art === 'mehrfach';
        const suche = chips ? suchgruppen(r, schema) : { gruppen: [], feste: [], frei: true };
        /* Wohin das Feld **an dieser Art** zeigt (T-119): die Karte bietet
           bei `Image.image` Kartenbilder an (`targets`), sonst gilt das Feld. */
        const ziel = fieldTarget(r, primaryInterface(e), { type: comp, key: prop, prop: schema });
        const titel = fieldTitle(r, primaryInterface(e), { type: comp, key: prop, prop: schema });
        const istPflicht = pflicht.has(`${comp}.${prop}`);
        if (stehtDa(schema, karte[prop], istPflicht)) da.add(`${comp}.${prop}`);
        out.push({
          ref: `${comp}.${prop}`,
          comp,
          prop,
          /* Wie das Feld **an dieser Art** heisst: derselbe `Time.until`
             ist an einem Auftrag die Frist und an einem Ereignis das Ende. */
          label: `${def.label ?? comp} · ${titel}`,
          gruppe: def.label ?? comp,
          titel,
          beschreibung: schema.description ?? holds(r, schema),
          art,
          schema: ziel === schema.target ? schema : { ...schema, ...(ziel ? { target: ziel } : {}) },
          werte: chips ? suche.feste : werte,
          wert: art === 'jaNein' || chips ? '' : inEingabe(karte[prop]),
          jaNein: karte[prop] === true,
          pflicht: istPflicht,
          liste: chips ? inListe(karte[prop]) : [],
          gruppen: suche.gruppen,
          frei: suche.frei,
        });
      }
    }
    this.felder.set(out);
    this.gezeigt.set(da);
    this.feldwahlOffen.set(false);
    this.entwurfProsa.set(
      this.prosa().map((b) => {
        const [typ, rest] = b.ref.split('.');
        const key = (rest ?? '').split('#')[0] ?? '';
        return { id: b.ref, type: typ ?? '', key, label: b.label, wert: b.wert };
      }),
    );
    this.entwurfKanten.set(
      (e.relations ?? []).map((rel) => ({
        id: rel.id,
        type: rel.type,
        to: rel.to,
        props: { ...(rel.props ?? {}) },
      })),
    );
    this.problem.set(null);
    this.maengel.set([]);
    this.offeneVerweise.set([]);
    /* Wovon die Maske ausgeht (REQ-192): gegen diese Revision wird
       geschrieben, und gegen diesen Stand wird zusammengeführt, falls
       inzwischen jemand anders gespeichert hat. Festgehalten und nicht
       aus dem Bestand gelesen — der lädt den Artikel womöglich neu, und
       dann wäre die eigene Ausgangslage still eine andere. */
    this.basis.set(structuredClone(e));
    this.zusammen.set(null);
    this.entwurf.set(null);
    this.bearbeitet.set(true);
  }

  protected abbrechen(): void {
    this.bearbeitet.set(false);
    this.problem.set(null);
    this.maengel.set([]);
    this.zusammen.set(null);
    this.entwurf.set(null);
  }

  /** Der Stand, von dem die Maske ausging. */
  private readonly basis = signal<Entity | null>(null);
  /** Was zuletzt geschickt und nicht gespeichert wurde — zum Herunterladen. */
  protected readonly entwurf = signal<Entity | null>(null);
  /** Abgewiesen, weil jemand anders gespeichert hat: drei Fassungen und die Wahl je Konflikt. */
  protected readonly zusammen = signal<{
    base: Entity;
    mine: Entity;
    theirs: Entity;
    taken: number;
    conflicts: { key: string; label: string; mine: string; theirs: string; wahl: MergeSide }[];
  } | null>(null);

  protected prosaArten(): { ref: string; label: string }[] {
    const e = this.artikel();
    const r = this.reg();
    if (!e || !r) return [];
    return proseFields(r, primaryInterface(e)).map((f) => ({
      ref: `${f.type}.${f.key}`,
      label: fieldTitle(r, primaryInterface(e), f),
    }));
  }

  protected prosaDazu(ref: string): void {
    if (!ref) return;
    const [typ, key] = ref.split('.');
    if (!typ || !key) return;
    const label = this.prosaArten().find((a) => a.ref === ref)?.label ?? key;
    this.entwurfProsa.update((bs) => [
      ...bs,
      { id: `${ref}#neu-${bs.length}-${Date.now()}`, type: typ, key, label, wert: '' },
    ]);
  }
  protected prosaWeg(id: string): void {
    this.entwurfProsa.update((bs) => bs.filter((b) => b.id !== id));
  }

  // ------------------------------------------------------------- Kanten

  /**
   * **Nur vorwärts.** Was hier bearbeitet wird, sind die ausgehenden Kanten
   * dieses Artikels; die Gegenrichtung ist eine Abfrage und hat kein Feld.
   * Eine Maske, die auch den Rückbezug bearbeiten liesse, müsste ihn
   * irgendwo hinschreiben — und dann verwaist eines der beiden Stücke.
   */
  protected readonly entwurfKanten = signal<
    { id: string; type: string; to: string; props: Record<string, unknown> }[]
  >([]);

  protected kantenArten(): { type: string; label: string }[] {
    const e = this.artikel();
    const r = this.reg();
    if (!e || !r) return [];
    return relationsFrom(r, primaryInterface(e))
      .map((d) => ({ type: d.type, label: d.label }))
      .sort((a2, b2) => a2.label.localeCompare(b2.label, 'de'));
  }
  /** Die Kantenart, die die Auswahl gerade zeigt — sonst die erste. */
  protected readonly gewaehlteKante = signal('');
  protected vorschauKante(): string {
    const arten = this.kantenArten();
    const g = this.gewaehlteKante();
    return arten.some((a) => a.type === g) ? g : (arten[0]?.type ?? '');
  }
  /**
   * Was eine Kante bedeutet und bewirkt (T-111, REQ-257) — die Bedeutung
   * aus dem Register, die Wirkung aus den Auswertern (`edgeEffects`).
   */
  protected kantenWirkung(type: string): string {
    const r = this.reg();
    if (!r) return '';
    const w = edgeEffects(r, type);
    return `${w.means} ${edgeEffectText(w)}`;
  }
  protected kantenLabel(type: string): string {
    const r = this.reg();
    return r ? relationDef(r, type).label : type;
  }

  /**
   * Welche Arten diese Kantenart als Ziel annimmt — aus dem Register, nicht
   * aus einer Liste hier; gesucht wird dann am Server (`nw-wahl`). Leer
   * heisst jede. Eine Kante, die auf etwas Unpassendes zeigt, weist der
   * Server ohnehin ab; sie erst gar nicht anbieten ist die freundlichere
   * Hälfte derselben Regel.
   */
  protected zielArten(type: string): string[] {
    const e = this.artikel();
    const r = this.reg();
    if (!e || !r) return [];
    const to = relationDef(r, type).to ?? ['*'];
    if (to.includes('*')) return [];
    return to.map((t) => (t === 'same' ? primaryInterface(e) : t));
  }

  protected kantenFelder(
    type: string,
  ): {
    prop: string;
    label: string;
    art: Eingabe;
    schema: PropertySchema | undefined;
    werte: string[];
  }[] {
    const r = this.reg();
    if (!r) return [];
    const props = relationDef(r, type).props?.properties ?? {};
    return Object.entries(props).map(([prop, schema]) => ({
      prop,
      label: schema.title ?? prop,
      art: eingabeArt(schema),
      schema,
      werte: enumOptions(r, schema) ?? [],
    }));
  }

  protected anzeige(wert: unknown): string {
    return inEingabe(wert);
  }
  protected setzeProp(
    kante: { type: string; props: Record<string, unknown> },
    prop: string,
    roh: string | boolean,
  ): void {
    const r = this.reg();
    const schema = r ? relationDef(r, kante.type).props?.properties?.[prop] : undefined;
    const wert = ausEingabe(schema, roh);
    if (wert === undefined) delete kante.props[prop];
    else kante.props[prop] = wert;
  }

  /** Die Kanten der Maske ohne die Antworten, die bei ihrem Eintrag stehen (T-095). */
  protected hauptKanten(): KantenEntwurf[] {
    const ks = this.entwurfKanten();
    const zu = antwortenJeEintrag(ks);
    return ks.filter((k) => !zu.has(k.id));
  }
  protected unterKanten(k: { id: string }): KantenEntwurf[] {
    if (!this.reg()) return [];
    const ks = this.entwurfKanten();
    const zu = antwortenJeEintrag(ks);
    return ks.filter((a) => zu.get(a.id) === k.id);
  }
  protected antwortLabel(a: { to: string; props: Record<string, unknown> }): string {
    return antwortText(this.bestand.voll().get(a.to), String(a.props['choice'] ?? ''), [], this.bestand.name()).label;
  }

  protected kanteDazu(type: string): void {
    if (!type) return;
    this.entwurfKanten.update((ks) => [
      ...ks,
      { id: `r-neu-${ks.length}-${Date.now()}`, type, to: '', props: {} },
    ]);
  }
  protected kanteWeg(id: string): void {
    this.entwurfKanten.update((ks) => ks.filter((k) => k.id !== id));
  }

  /**
   * Geschrieben wird der ganze Artikel, auf einer Kopie gebaut. Erst ein
   * gelungenes Schreiben ersetzt ihn im Bestand — sonst stünde nach einem
   * Fehlschlag ein Stand da, den der Server nie gesehen hat, und beim
   * nächsten Laden wäre er lautlos weg.
   */
  protected async speichern(): Promise<void> {
    const alt = this.artikel();
    if (!alt || this.speichert()) return;
    this.speichert.set(true);
    this.problem.set(null);
    this.maengel.set([]);

    /* `[[Name]]` wird beim Speichern zur Id, wo genau ein Artikel so
       heisst (M11). Hier und nicht beim Lesen: danach überlebt der Verweis
       das Umbenennen des Ziels. Was nichts oder mehreres trifft, bleibt
       stehen und wird gesagt. */
    /* Der Server schreibt um (`/api/links`): er kennt den Bestand, und er
       weiss, was der Schreibende sehen darf. Ein Zug für alle Texte. */
    const texte: string[] = [];
    for (const f of this.felder()) {
      if (f.schema?.format === 'long' && f.art !== 'jaNein' && f.wert.includes('[[')) texte.push(f.wert);
    }
    for (const b of this.entwurfProsa()) if (b.wert.includes('[[')) texte.push(b.wert);
    const offen = new Set<string>();
    const umgeschrieben = new Map<string, string>();
    if (texte.length) {
      try {
        const r = await this.api.links(texte);
        texte.forEach((t, i) => umgeschrieben.set(t, r.texts[i] ?? t));
        r.open.forEach((o) => offen.add(o));
      } catch {
        /* Ohne Antwort bleibt `[[Name]]` stehen — ein Verweis ohne Nummer
           ist erlaubt und wird beim nächsten Speichern nachgezogen. */
      }
    }
    const mitIds = (text: string): string => umgeschrieben.get(text) ?? text;

    const components: Record<string, Record<string, unknown>> = {};
    for (const f of this.felder()) {
      let wert = ausEingabe(
        f.schema,
        f.art === 'jaNein' ? f.jaNein : f.art === 'verweise' || f.art === 'mehrfach' ? f.liste : f.wert,
      );
      if (wert === undefined) continue;
      if (f.schema?.format === 'long' && typeof wert === 'string') wert = mitIds(wert);
      (components[f.comp] ??= {})[f.prop] = wert;
    }
    /* Die Prosa wandert in die Karten, aus denen sie kommt. Die Id bleibt
       die, die sie hatte — eine Wissensfreigabe hängt daran, und sie beim
       Speichern neu zu würfeln nähme sie mit ins Leere. */
    for (const b of this.entwurfProsa()) {
      if (b.wert.trim() === '') continue;
      const id = b.id.split('#')[1] ?? b.id;
      ((components[b.type] ??= {})[b.key] ??= [] as { id: string; value: string }[]);
      (components[b.type][b.key] as { id: string; value: string }[]).push({
        id,
        value: mitIds(b.wert),
      });
    }

    const relations = kantenAusEntwurf(this.entwurfKanten());

    const basis = this.basis() ?? alt;
    const neu = { ...basis, components, relations } as Entity;
    await this.schreibe(neu, basis, offen);
  }

  /**
   * **Schreiben gegen die gelesene Revision** (REQ-192). Gelingt es, gilt
   * der Stand des Servers; weist er ab, weil jemand anders gespeichert hat,
   * wird zusammengeführt (`mergeEntity`) und gefragt — geschrieben wird
   * erst, wenn jemand „Save merged" sagt. Was nicht gespeichert werden
   * konnte, bleibt als Entwurf und lässt sich herunterladen (REQ-191).
   */
  private async schreibe(neu: Entity, basis: Entity, offen: Set<string> = new Set()): Promise<void> {
    this.speichert.set(true);
    this.problem.set(null);
    this.maengel.set([]);
    const { refs: _refs, fromTemplate: _ft, ...ohne } = neu as Entity & { refs?: unknown };
    this.entwurf.set(ohne as Entity);
    try {
      const gespeichert = await this.api.putEntity(ohne as Entity);
      /* Neu geholt und nicht das Zurückgeschickte eingesetzt: was die Seite
         zeigt, ist gesiebt und aufgelöst, und das Gespeicherte ist es nicht.
         Die Zeile in der Liste zieht dabei mit. */
      await this.bestand.oeffnen(neu.id, true);
      this.bearbeitet.set(false);
      this.zusammen.set(null);
      this.entwurf.set(null);
      this.offeneVerweise.set([...offen]);
      /* Was der Server zurückgibt, gilt — er setzt `updatedAt` und
         `revision` und darf mehr ändern, als hier geschickt wurde. */
      void gespeichert;
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        const jetzt = (error.body as { current?: (Entity & { refs?: unknown }) | null } | null)?.current;
        if (!jetzt) {
          this.zusammen.set(null);
          this.problem.set('This article no longer exists, or you can no longer see it. Your version is not saved.');
          return;
        }
        const { refs: _r, ...theirs } = jetzt;
        this.zeigeZusammen(basis, ohne as Entity, theirs as Entity);
        return;
      }
      if (error instanceof ApiError) {
        this.problem.set(error.message);
        /* Die Liste wird gezeigt und nicht zusammengefasst: „ungültig" ohne
           Grund ist am Tisch keine Hilfe. */
        const issues = error.issues;
        if (Array.isArray(issues)) {
          this.maengel.set(
            issues.map((i) => {
              const o = i as { t?: string; message?: string; path?: unknown[] };
              if (o.t) return o.t;
              const pfad = Array.isArray(o.path) ? o.path.join('.') : '';
              return pfad ? `${pfad}: ${o.message ?? '?'}` : (o.message ?? JSON.stringify(i));
            }),
          );
        }
      } else {
        this.problem.set('Could not reach the server.');
      }
    } finally {
      this.speichert.set(false);
    }
  }

  /** Drei Fassungen nebeneinander; was nur eine Seite änderte, ist schon drin. */
  private zeigeZusammen(base: Entity, mine: Entity, theirs: Entity): void {
    const r = mergeEntity(base, mine, theirs);
    this.zusammen.set({
      base,
      mine,
      theirs,
      taken: r.taken.length,
      conflicts: r.conflicts.map((k) => ({
        key: k.key,
        label: this.konfliktName(k.key),
        mine: this.konfliktWert(k.mine),
        theirs: this.konfliktWert(k.theirs),
        wahl: 'mine' as MergeSide,
      })),
    });
  }

  protected waehleSeite(key: string, wahl: MergeSide): void {
    this.zusammen.update((z) =>
      z ? { ...z, conflicts: z.conflicts.map((k) => (k.key === key ? { ...k, wahl } : k)) } : z,
    );
  }

  /** Die Wahl angewandt, gegen den Stand der anderen geschrieben. Hat
   *  inzwischen noch jemand gespeichert, wird von dort aus wieder gefragt. */
  protected async zusammenSpeichern(): Promise<void> {
    const z = this.zusammen();
    if (!z || this.speichert()) return;
    const prefer = Object.fromEntries(z.conflicts.map((k) => [k.key, k.wahl]));
    const { merged } = mergeEntity(z.base, z.mine, z.theirs, prefer);
    await this.schreibe(merged, z.theirs);
  }

  /** Den eigenen Stand aufgeben und zeigen, was gilt. */
  protected async verwerfen(): Promise<void> {
    const e = this.artikel();
    this.zusammen.set(null);
    this.entwurf.set(null);
    this.problem.set(null);
    this.bearbeitet.set(false);
    if (e) await this.bestand.oeffnen(e.id, true);
  }

  /** Der ungespeicherte Stand als Datei — er geht nicht verloren, auch wenn
   *  er hier nicht unterkommt (REQ-191). */
  protected herunterladen(): void {
    const e = this.zusammen()?.mine ?? this.entwurf();
    if (!e) return;
    const blob = new Blob([JSON.stringify(e, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(entityName(e) || e.id).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'article'}-unsaved.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private konfliktName(key: string): string {
    if (key === 'name') return 'Name';
    if (key === 'interfaces') return 'Type';
    if (key === 'adhoc') return 'Extra fields';
    const r = this.reg();
    if (key.startsWith('edge:')) {
      const id = key.slice(5);
      const kante = [...(this.zusammen()?.theirs.relations ?? []), ...(this.basis()?.relations ?? [])]
        .find((k) => k.id === id);
      return kante && r ? `Link · ${relationDef(r, kante.type).label}` : 'Link';
    }
    if (key.startsWith('card:')) {
      const t = key.slice(5);
      return r?.interfaces[t]?.label ?? t;
    }
    const f = this.felder().find((x) => x.ref === key);
    if (f) return f.label;
    const [t, k] = key.split('.');
    return `${(t && r?.interfaces[t]?.label) || t} · ${k}`;
  }

  private konfliktWert(v: unknown): string {
    if (v === undefined || v === null || v === '') return '(empty)';
    if (typeof v === 'boolean') return v ? 'yes' : 'no';
    if (v && typeof v === 'object' && 'type' in v && 'to' in v) {
      const k = v as { type: string; to: string };
      return `→ ${this.bestand.name()(k.to) ?? k.to}`;
    }
    const text = inEingabe(v);
    return text.length > 160 ? `${text.slice(0, 160)}…` : text;
  }

  protected readonly rueckbezuege = computed(() => {
    const e = this.artikel();
    const r = this.reg();
    if (!e || !r || !this.view()?.relations) return [];
    /* Die Gegenrichtung fragt der Server (K1): sie braucht jede Kante im
       Bestand, und die Seite hält keinen (W7). */
    return (this.bestand.rueckbezuege().get(e.id) ?? []).map((b) => ({
      id: `${b.from.id}:${b.relation.id}`,
      label: relationDef(r, b.relation.type).inverseLabel,
      typ: b.relation.type,
      ziel: b.from.id,
      text: entityName(b.from),
    }));
  });
}

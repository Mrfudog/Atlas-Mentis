import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Api, type KampagnenEbene, type KampagnenEbenen } from '../kern/api';
import { Bestand } from '../kern/bestand';

/** Ebenen, die Bücher sind — ohne Gruppe stehen sie unter „Other books". */
const BUCHARTEN = new Set(['book', 'adventure']);
/** Der Schlüssel am Konto, unter dem die aufgeklappten Gruppen stehen (T-088). */
const OFFEN_PREF = 'layerGroups';
/** … und wonach die Bücher gruppiert stehen (T-094). */
const ANSICHT_PREF = 'layerGroupBy';
type Ansicht = 'category' | 'publisher';

/** Eine Gruppe mit ihren Mitgliedern (T-088), verschachtelt. */
interface Gruppe {
  ebene: KampagnenEbene;
  untergruppen: Gruppe[];
  ebenen: KampagnenEbene[];
  /** Bücher darin (verschachtelt, ohne Gruppen), davon im Spiel. */
  gesamt: number;
  an: number;
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
 * sagen. Was der Server nicht annähme, bietet die Seite nicht an
 * (`may`, `canActivate`).
 *
 * **Vergleichsebenen** (T-092, E-021 d): an jeder Ebene, die nicht im
 * Spiel ist, ein Häkchen „compare" — ihre Fassungen stehen dann auf Wunsch
 * an den Feldern. Darunter, ob die Spielenden sie auch sehen.
 *
 * **Bücher stehen für sich** (T-081, E-017): je Buch aus 5e.tools eine
 * Ebene, mit Häkchen und ohne Pfeile — zwischen Büchern gibt es nichts zu
 * ordnen, und siebzig Zeilen mit Pfeilen verdeckten den Stapel, um den es
 * geht.
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
 */
@Component({
  selector: 'nw-kampagnen-ebenen',
  imports: [RouterLink, NgTemplateOutlet],
  template: `
    <section class="kasten" aria-label="Layers in play">
      <h2>Layers in play</h2>
      <p class="fuss">
        The lists of this campaign show what its layers bring, and articles without a layer. A layer
        higher up wins where two say the same. Turning a layer off deletes nothing.
      </p>
      @if (fehler(); as f) {
        <p class="fehler" role="alert">{{ f }}</p>
      }
      @if (daten(); as d) {
        <ul class="ebenen">
          @for (l of oben(); track l.id; let i = $index, last = $last) {
            <li [class.aus]="!l.active">
              <label class="haken">
                <input
                  type="checkbox"
                  [checked]="l.active"
                  [disabled]="!aenderbar(l) || laeuft()"
                  (change)="umschalten(l)"
                />
                <span class="name">{{ l.name }}</span>
              </label>
              @if (l.publisher) {
                <span class="verlag" [title]="'Publisher: ' + l.publisher">{{ l.publisher }}</span>
              }
              @if (l.readable && l.active) {
                <a class="lesen" [routerLink]="['/read', l.id]">Read</a>
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
              @if (!l.active) {
                <label class="vergleich" [title]="'Show versions from ' + l.name + ' on demand, without putting it in play'">
                  <input
                    type="checkbox"
                    [checked]="!!l.compare"
                    [disabled]="!aenderbar(l) || laeuft()"
                    (change)="vergleichen(l)"
                  />
                  compare
                </label>
              }
              @if (l.active && d.may === 'manage') {
                <span class="knoepfe">
                  <button
                    type="button"
                    class="klein"
                    [disabled]="i === 0 || laeuft()"
                    [attr.aria-label]="'Move ' + l.name + ' up'"
                    (click)="schieben(l, 1)"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    class="klein"
                    [disabled]="last || !naechsteAktiv(i) || laeuft()"
                    [attr.aria-label]="'Move ' + l.name + ' down'"
                    (click)="schieben(l, -1)"
                  >
                    ↓
                  </button>
                </span>
              }
            </li>
          } @empty {
            @if (!gruppen().length && !lose().length) {
              <li class="dim">There is no layer yet. Everything is in play.</li>
            }
          }
        </ul>
        @if (gruppen().length || lose().length) {
          <h3>Books</h3>
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
            <details class="gruppe" [open]="offen().has('-')" (toggle)="merke('-', $event)">
              <summary>
                <span class="gname">{{ ansicht() === 'publisher' ? 'No publisher (Homebrew)' : 'Other books' }}</span>
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
          <details class="gruppe" [open]="offen().has(g.ebene.id)" (toggle)="merke(g.ebene.id, $event)">
            <summary>
              <input
                type="checkbox"
                class="ganz"
                [checked]="g.ebene.inPlay"
                [indeterminate]="!g.ebene.inPlay && g.an > 0"
                [disabled]="!aenderbar(g.ebene) || laeuft()"
                [attr.aria-label]="'Turn the whole group ' + g.ebene.name + (g.ebene.inPlay ? ' off' : ' on')"
                (click)="$event.stopPropagation()"
                (change)="gruppeSchalten(g.ebene)"
              />
              <span class="gname">{{ g.ebene.name }}</span>
              <span class="dim">{{ g.an }} of {{ g.gesamt }} on</span>
              @if (g.ebene.about.description) {
                <span class="beschreibung">{{ g.ebene.about.description }}</span>
              }
            </summary>
            <div class="innen">
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
            </label>
            @if (l.publisher) {
              <span class="verlag" [title]="'Publisher: ' + l.publisher">{{ l.publisher }}</span>
            }
            @if (l.readable && l.inPlay) {
              <a class="lesen" [routerLink]="['/read', l.id]">Read</a>
            }
            @if (!l.inPlay) {
              <label class="vergleich" [title]="'Show versions from ' + l.name + ' on demand, without putting it in play'">
                <input
                  type="checkbox"
                  [checked]="!!l.compare"
                  [disabled]="!aenderbar(l) || laeuft()"
                  (change)="vergleichen(l)"
                />
                compare
              </label>
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
          </li>
        </ng-template>
        <h3>Compare layers</h3>
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
    .gruppe summary {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.25rem 0.75rem;
      min-height: 40px;
      cursor: pointer;
    }
    .gruppe summary::-webkit-details-marker {
      display: none;
    }
    .gruppe summary::before {
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
    .fakten abbr {
      text-decoration: underline dotted;
      cursor: help;
    }
  `,
})
export class KampagnenEbenenListe {
  readonly kampagne = input.required<string>();
  /** Nach jedem Schalten — die Geschichte der Kampagne liest dann neu (T-082). */
  readonly geschaltet = output<void>();

  private readonly api = inject(Api);
  private readonly bestand = inject(Bestand);
  protected readonly daten = signal<KampagnenEbenen | null>(null);
  protected readonly fehler = signal<string | null>(null);
  protected readonly laeuft = signal(false);

  constructor() {
    effect(() => {
      const c = this.kampagne();
      void this.laden(c);
    });
  }

  private async laden(c: string): Promise<void> {
    try {
      const d = await this.api.campaignLayers(c);
      if (c !== this.kampagne()) return;
      this.daten.set(d);
      this.fehler.set(null);
      void this.offenLaden();
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

  private readonly nachId = computed(() => new Map((this.daten()?.layers ?? []).map((x) => [x.id, x])));

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
      return { ebene: g, untergruppen, ebenen, gesamt: alle.length, an: this.anZahl(alle) };
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
    void this.api.setPref(OFFEN_PREF, [...s]).catch(() => {
      /* Nicht gemerkt ist nicht schlimm: der Abschnitt ist trotzdem offen. */
    });
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

  /** Bringt eine aufgeschaltete Gruppe diese Ebene? */
  private ueberGruppe(l: KampagnenEbene): boolean {
    const m = this.nachId();
    return l.groups.some((g) => m.get(g)?.inPlay === true);
  }

  /** Die ganze Gruppe an oder aus (T-088). */
  protected gruppeSchalten(g: KampagnenEbene): void {
    if (g.active) void this.schreiben(this.stapel().filter((id) => id !== g.id));
    else if (g.off) void this.schreiben(this.stapel(), undefined, this.abgeschaltet().filter((id) => id !== g.id));
    else void this.schreiben(null, g.id);
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

  /** Eine Ebene zum Vergleich dazu oder weg (T-092) — nur eine, die nicht im Spiel ist. */
  protected vergleichen(l: KampagnenEbene): void {
    const jetzt = (this.daten()?.layers ?? []).filter((x) => x.compare).map((x) => x.id);
    const neu = l.compare ? jetzt.filter((id) => id !== l.id) : [...jetzt, l.id];
    void this.vergleichSchreiben({ layers: neu });
  }

  protected spielerSehen(ev: Event): void {
    void this.vergleichSchreiben({ players: (ev.target as HTMLInputElement).checked });
  }

  private async vergleichSchreiben(neu: { layers?: string[]; players?: boolean }): Promise<void> {
    const c = this.kampagne();
    this.laeuft.set(true);
    try {
      await this.api.setCampaignCompare(c, neu);
      await this.laden(c);
    } catch (error) {
      this.fehler.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.laeuft.set(false);
    }
  }

  /** Der Stapel von unten nach oben, wie der Server ihn will. */
  private stapel(): string[] {
    return (this.daten()?.layers ?? []).filter((x) => x.active).map((x) => x.id);
  }

  protected aenderbar(l: KampagnenEbene): boolean {
    if (this.daten()?.may !== 'manage') return false;
    return l.active || l.canActivate;
  }

  protected naechsteAktiv(i: number): boolean {
    return this.oben()[i + 1]?.active === true;
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

  /** `um` 1 heisst nach oben (spezifischer), −1 nach unten. Getauscht wird
   *  mit der nächsten Ebene, die im Stapel steht; die Bücher dazwischen
   *  bleiben, wo sie sind. */
  protected schieben(l: KampagnenEbene, um: 1 | -1): void {
    const s = this.stapel();
    const oben = new Set(this.oben().map((x) => x.id));
    const buch = new Set(s.filter((id) => !oben.has(id)));
    const i = s.indexOf(l.id);
    let j = i + um;
    while (j >= 0 && j < s.length && buch.has(s[j]!)) j += um;
    if (i < 0 || j < 0 || j >= s.length) return;
    [s[i], s[j]] = [s[j]!, s[i]!];
    void this.schreiben(s);
  }

  private async schreiben(stapel: string[] | null, dazu?: string, off?: string[]): Promise<void> {
    const c = this.kampagne();
    this.laeuft.set(true);
    try {
      if (stapel) await this.api.setCampaignLayers(c, stapel, off);
      else if (dazu) await this.api.activateLayer(c, dazu);
      await this.laden(c);
      this.geschaltet.emit();
    } catch (error) {
      this.fehler.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.laeuft.set(false);
    }
  }
}

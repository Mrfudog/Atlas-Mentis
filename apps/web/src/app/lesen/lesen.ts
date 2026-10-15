import { Component, DestroyRef, ElementRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { entityName, nodeAtPage, primaryInterface } from '@nw/model';
import type { VarScopes } from '@nw/model';
import { Api, type LeseBuch, type LeseStueck, type LeseTreffer, type LeseZeile } from '../kern/api';
import { Bestand } from '../kern/bestand';
import { Text } from '../artikel/text';
import { KurzLink } from '../kern/kurzansicht';
import { Ladeanzeige } from '../kern/ladeanzeige';
import { bloeckeVon, type Block } from '../kern/buchtext';
import { bildAdresse } from '../artikel/bild';
import { LeseInhalt } from './inhalt';

interface Abschnitt {
  id: string;
  /**
   * Ein Teil eines Kapitels (T-108) steht ohne eigene Kopfzeile im Fluss:
   * ein Absatz, ein Vorlesetext, ein Verweis. Kapitel, Szenen und
   * Überschriften sind Abschnitte mit Kopf (`undefined`).
   */
  teil?: 'text' | 'verweis';
  /** Am Verweis-Teil: worauf er zeigt. */
  ziel?: { id: string; name: string; art: string };
  /** Die Fassung, die gilt (E-018) — dorthin führt „open". */
  artikel: string;
  name: string;
  stufe: number;
  seite?: string;
  bloecke: Block[];
  karten: { id: string; name: string; bild?: string; text?: string }[];
  kaempfe: { id: string; name: string; wer: string[] }[];
  /** Die Orte, die dieser Abschnitt beschreibt (`describedIn`, T-175). */
  orte: { id: string; name: string }[];
}

/**
 * **Die Leseansicht** (T-091, REQ-247): eine Ebene als Buch — heute ein
 * Abenteuer (T-082), die Bücher, sobald ihr Text hereinkommt (E-024).
 *
 * Links das Inhaltsverzeichnis (am Telefon ausklappbar) mit der Suche im
 * Buch, rechts ein Kapitel am Stück: Vorlesetext und Leitungstext als
 * Kasten, Tabellen wie im Text, Karten als Bild, Begegnungen mit ihren
 * Teilnehmern. **Ein Verweis im Text öffnet die Kurzansicht** (`quick`)
 * als Popup am Verweis, statt die Seite zu verlassen — dieselbe wie
 * überall (`nw-kurzpopup`, T-093); mit gedrückter Taste geht er wie
 * überall auf die Artikelseite.
 *
 * **Der Lesestand gehört dem Konto**, nicht dem Browser: gemerkt wird der
 * Abschnitt oben am Bildschirm, und wer wiederkommt, liest dort weiter
 * (`?at=` oder `?page=` gehen vor — „XGE p. 12" springt an die Stelle).
 *
 * Gesiebt hat der Server: was hier ankommt, darf gezeigt werden.
 */
@Component({
  selector: 'nw-lesen',
  imports: [RouterLink, FormsModule, Text, KurzLink, Ladeanzeige, LeseInhalt],
  host: { '(document:keydown.escape)': 'tocOffen.set(false)' },
  template: `
    <div class="leser" [class.eingebettet]="eingebettet()">
      <div class="kopf">
        @if (eingebettet()) {
          <!-- Am Ebenen-Artikel (T-167): der Artikel steht schon darüber; hier nur, wo man liest. -->
          <nav aria-label="Reading position" class="brot">
            @for (z of pfad(); track z.id; let letzte = $last) {
              @if (!$first) {
                <span aria-hidden="true">›</span>
              }
              @if (letzte) {
                <span aria-current="location">{{ z.name }}</span>
              } @else {
                <a [href]="'#s-' + z.id" (click)="$event.preventDefault(); gehe(z.id)">{{ z.name }}</a>
              }
            }
          </nav>
        } @else {
        <nav aria-label="Breadcrumb" class="brot">
          <a routerLink="/campaign">Campaign</a>
          <span aria-hidden="true">›</span>
          @if (buch(); as b) {
            <a [routerLink]="['/artikel', b.layer.id]" [nwQuick]="b.layer.id">{{ b.layer.name }}</a>
            <!-- Kapitel › Abschnitt (T-093): wo man gerade liest. -->
            @for (z of pfad(); track z.id; let letzte = $last) {
              <span aria-hidden="true">›</span>
              @if (letzte) {
                <span aria-current="location">{{ z.name }}</span>
              } @else {
                <a [href]="'#s-' + z.id" (click)="$event.preventDefault(); gehe(z.id)">{{ z.name }}</a>
              }
            }
          } @else {
            <span>Book</span>
          }
        </nav>
        }
        @if (buch()?.toc?.length) {
        <button type="button" class="inhalt-knopf" [attr.aria-expanded]="tocOffen()" aria-controls="inhalt"
                (click)="tocOffen.set(!tocOffen())">
          {{ tocOffen() ? 'Close contents' : 'Contents' }}
        </button>
        }
      </div>

      @if (fehler(); as f) {
        <p class="fehler" role="alert">{{ f }}</p>
      }

      @if (buch(); as b) {
        <!-- Vor dem Aufschalten (T-167): eine Vorschau, und die Seite sagt es. -->
        @if (b.preview && b.toc.length) {
          <p class="vorschau" role="status">
            Preview — this layer is not turned on in the running campaign. What you read here is not in play yet.
          </p>
        }
        @if (b.shelf; as regal) {
          <!-- Eine Gruppe liest sich als Regal ihrer Bücher (T-167). -->
          <section class="regal" aria-label="Books in this group">
            <h2 class="titel">{{ b.layer.name }}</h2>
            @if (!regal.length) {
              <p class="leer">No books in this group yet.</p>
            }
            <ul>
              @for (r of regal; track r.id) {
                <li [class.ohne-text]="!r.hasText && !r.group">
                  <a [routerLink]="regalLink(r.id)" [queryParams]="{ tab: 'read' }">{{ r.name }}</a>
                  <span class="dim">
                    {{ r.group ? 'Group' : r.kind || 'Layer' }}{{ r.active ? '' : ' · not turned on' }}
                  </span>
                  @if (!r.hasText && !r.group) {
                    <span class="hinweis-leer">No text imported yet</span>
                  }
                </li>
              }
            </ul>
          </section>
        } @else {
        @if (tocOffen()) {
          <button type="button" class="vorhang" aria-label="Close contents" (click)="tocOffen.set(false)"></button>
        }
        <div class="spalten" [class.ohne-inhalt]="!b.toc.length">
          @if (b.toc.length) {
          <nav id="inhalt" class="inhalt" [class.offen]="tocOffen()" aria-label="Contents">
            <form class="suche" role="search" (submit)="suchen($event)">
              <input type="search" name="q" [(ngModel)]="frage" placeholder="Search this book"
                     aria-label="Search this book" minlength="2" />
              <button type="submit" [disabled]="frage.trim().length < 2">Search</button>
            </form>
            @if (treffer(); as t) {
              <div class="treffer" aria-live="polite">
                <p class="dim">
                  {{ t.length ? t.length + (t.length === 1 ? ' hit' : ' hits') : 'Nothing found' }}
                  <button type="button" class="leise" (click)="treffer.set(null)">clear</button>
                </p>
                <ul>
                  @for (h of t; track h.id) {
                    <li>
                      <button type="button" class="eintrag" (click)="gehe(h.id)">
                        <strong>{{ h.name }}</strong>
                        <span class="schnipsel">{{ h.snippet }}</span>
                      </button>
                    </li>
                  }
                </ul>
              </div>
            }
            <h2 class="titel">{{ b.layer.name }}</h2>
            <!-- Aufklappbar (T-167): Buch › Kapitel › Abschnitte, folgt dem Lesestand. -->
            <nw-lese-inhalt [layer]="b.layer.id" [toc]="b.toc" [aktuell]="aktuell()" [stueck]="stueck()?.unit"
                            (springe)="gehe($event)" />
          </nav>
          }

          <main class="lesetext">
            @if (!b.toc.length) {
              <!-- Der Grund, wo der Server ihn kennt (T-126): ohne eingelesenen
                   Buchtext ist das der einzige, auch für die Verwaltung. -->
              @if (b.empty === 'noText') {
                <div class="ohne-text">
                  <p class="leer-kopf">No text imported yet</p>
                  <p class="leer">
                    Only the articles of this book are here (spells, creatures, items …). Once its chapters are
                    read in, they appear here.
                  </p>
                </div>
              } @else if (b.inactive && !b.preview) {
                <p class="leer">
                  Nothing to read here. This layer is not turned on in the running campaign.
                </p>
              } @else {
                <p class="leer">
                  Nothing to read here. The text of this book may be for the GM only, or the book is not
                  turned on for the running campaign.
                </p>
              }
            }
            @for (a of abschnitte(); track a.id) {
              @if (a.teil) {
                <!-- Ein Teil des Kapitels (T-108): im Fluss, ohne Kopf; „open" am Rand. -->
                <div class="teil" [id]="'s-' + a.id" [attr.data-id]="a.id">
                  @if (a.ziel; as z) {
                    <div class="verweis">
                      <span class="leg">{{ z.art }}</span>
                      <a [routerLink]="['/artikel', z.id]" [nwQuick]="z.id">{{ z.name }}</a>
                    </div>
                  }
                  @for (bl of a.bloecke; track bl.key) {
                    <div [class]="'block ' + bl.art">
                      @if (bl.art !== 'text') {
                        <span class="leg">{{ bl.label }}</span>
                      }
                      <nw-text [text]="bl.text" [scopes]="scopes" />
                    </div>
                  }
                  <a class="direkt oeffnen teil-oeffnen" [routerLink]="['/artikel', a.artikel]" title="Open as article"
                     [attr.aria-label]="'Open ' + a.name">open</a>
                </div>
              } @else {
              <section class="abschnitt" [id]="'s-' + a.id" [attr.data-id]="a.id" [class]="'stufe' + a.stufe">
                <div class="ueber" [attr.role]="'heading'" [attr.aria-level]="a.stufe + 1">
                  <span>{{ a.name }}</span>
                  @if (a.seite) {
                    <span class="seite" title="Page">p. {{ a.seite }}</span>
                  }
                  <a class="direkt oeffnen" [routerLink]="['/artikel', a.artikel]" title="Open as article">open</a>
                </div>
                @for (o of a.orte; track o.id) {
                  <div class="verweis ort">
                    <span class="leg">Place</span>
                    <a [routerLink]="['/artikel', o.id]" [nwQuick]="o.id">{{ o.name }}</a>
                  </div>
                }
                @for (bl of a.bloecke; track bl.key) {
                  <div class="block" [class]="'block ' + bl.art">
                    @if (bl.art !== 'text') {
                      <span class="leg">{{ bl.label }}</span>
                    }
                    <nw-text [text]="bl.text" [scopes]="scopes" />
                  </div>
                }
                @for (k of a.karten; track k.id) {
                  <figure class="karte">
                    @if (k.bild) {
                      <!-- Eine Karte ist gross; bis sie da ist, ein Kreis (T-126). -->
                      <div class="kartenbild" [class.laedt]="!kartenDa().has(k.bild)">
                        @if (!kartenDa().has(k.bild)) {
                          <nw-ladeanzeige class="anzeige" label="Loading map …" />
                        }
                        <img [src]="k.bild" [alt]="k.name" loading="lazy" (load)="karteDa(k.bild)" (error)="karteDa(k.bild)" />
                      </div>
                    }
                    <figcaption>
                      <a [routerLink]="['/artikel', k.id]" [nwQuick]="k.id">{{ k.name }}</a>
                      @if (k.text) {
                        <span class="dim"> · {{ k.text }}</span>
                      }
                    </figcaption>
                  </figure>
                }
                @for (k of a.kaempfe; track k.id) {
                  <div class="kampf">
                    <span class="leg">Encounter</span>
                    <a [routerLink]="['/artikel', k.id]" [nwQuick]="k.id">{{ k.name }}</a>
                    @if (k.wer.length) {
                      <span class="dim"> — {{ k.wer.join(', ') }}</span>
                    }
                  </div>
                }
              </section>
              }
            }
            @if (stueck() && !abschnitte().length) {
              <p class="leer">Nothing in this chapter you may see.</p>
            }
            @if (laedt()) {
              <p class="dim">Loading…</p>
            }
            @if (stueck()) {
              <nav class="blaettern" aria-label="Chapters">
                @if (nachbar(-1); as v) {
                  <button type="button" (click)="gehe(v.id)">‹ {{ v.name }}</button>
                } @else {
                  <span></span>
                }
                @if (nachbar(1); as n) {
                  <button type="button" (click)="gehe(n.id)">{{ n.name }} ›</button>
                }
              </nav>
            }
          </main>

        </div>
        }
      } @else if (!fehler()) {
        <p class="dim leer">Loading…</p>
      }
    </div>
  `,
  styleUrl: './lesen.scss',
})
export class Lesen {
  /** Die Ebene (`/read/:layer`). */
  readonly layer = input.required<string>();
  /** Ein Abschnitt, an den gesprungen wird (`?at=`). */
  readonly at = input<string>();
  /** Eine Seite („XGE p. 12", `?page=`). */
  readonly page = input<string>();
  /** Als Element `reader` auf der Seite der Ebene (T-167, T-191): ohne eigenen Brotkrumenpfad und Seitentitel. */
  readonly eingebettet = input(false);
  /** Eingebettet trotzdem zum Lesestand springen (`?tab=read`, alte Links auf `/read/:layer`). */
  readonly springen = input(false);

  private readonly api = inject(Api);
  private readonly bestand = inject(Bestand);
  private readonly title = inject(Title);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly buch = signal<LeseBuch | null>(null);
  protected readonly stueck = signal<LeseStueck | null>(null);
  protected readonly fehler = signal<string | null>(null);
  protected readonly laedt = signal(false);
  /** Welche Kartenbilder da sind (T-126) — bis dahin dreht sich die Ladeanzeige. */
  protected readonly kartenDa = signal<ReadonlySet<string>>(new Set());
  protected karteDa(bild: string): void {
    this.kartenDa.update((s) => new Set([...s, bild]));
  }
  protected readonly aktuell = signal<string | null>(null);
  protected readonly tocOffen = signal(false);
  protected readonly treffer = signal<LeseTreffer[] | null>(null);
  protected frage = '';
  protected readonly scopes: VarScopes = {};

  /** Der zuletzt gemerkte Abschnitt — nicht zweimal derselbe. */
  private gemerkt: string | null = null;
  private merkUhr: ReturnType<typeof setTimeout> | undefined;
  /** Bis wann der Scroll nach einem Sprung nicht zählt: am Ende eines kurzen
   *  Kapitels kommt das Ziel nicht bis oben, und sonst gälte der Abschnitt davor. */
  private ruhigBis = 0;

  constructor() {
    void this.bestand.load();
    effect(() => {
      const l = this.layer();
      const at = this.at();
      const page = this.page();
      untracked(() => void this.oeffnen(l, at, page));
    });
    const scroll = () => this.nachScroll();
    window.addEventListener('scroll', scroll, { passive: true });
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('scroll', scroll);
      clearTimeout(this.merkUhr);
    });
  }

  /** Die Abschnitte des Stücks, wie sie gezeichnet werden. */
  protected readonly abschnitte = computed<Abschnitt[]>(() => {
    const s = this.stueck();
    const r = this.bestand.registry();
    if (!s || !r) return [];
    const kopf = Math.min(...s.sections.map((x) => x.depth));
    const toc = new Map((this.buch()?.toc ?? []).map((z) => [z.id, z]));
    return s.sections.map((x) => {
      const e = x.entity;
      const bloecke = bloeckeVon(r, e);
      const name = (id: string) => s.refs.names[id] ?? id;
      const teil = x.toc === false ? (x.target ? ('verweis' as const) : ('text' as const)) : undefined;
      return {
        id: x.id,
        ...(teil ? { teil } : {}),
        ...(x.target
          ? { ziel: { id: x.target.id, name: entityName(x.target), art: r.interfaces[primaryInterface(x.target)]?.label ?? primaryInterface(x.target) } }
          : {}),
        artikel: e.id,
        name: entityName(e),
        stufe: Math.min(5, x.depth - kopf + 1),
        ...(toc.get(x.id)?.page ? { seite: toc.get(x.id)!.page } : {}),
        bloecke,
        karten: x.embeds
          .filter((k) => primaryInterface(k) === 'Map' || (primaryInterface(k) !== 'Place' && !!k.components?.['Image']))
          .map((k) => {
            const bild = k.components?.['Image'] as { image?: unknown; caption?: unknown } | undefined;
            return {
              id: k.id,
              name: entityName(k),
              /* Eine Adresse oder ein hochgeladenes Asset (T-114) — `bildAdresse` weiss, welches. */
              ...(bildAdresse(bild?.image) ? { bild: bildAdresse(bild?.image)! } : {}),
              ...(typeof bild?.caption === 'string' && bild.caption !== entityName(k) ? { text: bild.caption } : {}),
            };
          }),
        orte: x.embeds.filter((k) => primaryInterface(k) === 'Place').map((k) => ({ id: k.id, name: entityName(k) })),
        kaempfe: x.embeds
          .filter((k) => primaryInterface(k) !== 'Map' && primaryInterface(k) !== 'Place' && !k.components?.['Image'])
          .map((k) => ({
            id: k.id,
            name: entityName(k),
            wer: (k.relations ?? [])
              .filter((rel) => rel.type === 'participates')
              .map((rel) => String((rel.props as { label?: unknown } | undefined)?.label ?? name(rel.to))),
          })),
      };
    });
  });

  /**
   * Der Brotkrumenpfad hinter dem Buch (T-093, REQ-248): die Einträge des
   * Verzeichnisses über dem Abschnitt, der oben steht — Kapitel ›
   * Abschnitt. Die Titelseite (Tiefe 0) ist das Buch selbst und steht
   * schon davor.
   */
  protected readonly pfad = computed<LeseZeile[]>(() => {
    const toc = this.buch()?.toc ?? [];
    const i = toc.findIndex((z) => z.id === this.aktuell());
    if (i < 0) return [];
    const raus: LeseZeile[] = [toc[i]!];
    for (let j = i - 1; j >= 0 && raus[0]!.depth > 1; j--) {
      if (toc[j]!.depth < raus[0]!.depth) raus.unshift(toc[j]!);
    }
    return raus.filter((z) => z.depth > 0);
  });

  /** Wohin ein Buch im Regal führt: auf die Seite seiner Ebene, wo es sich liest (T-191). */
  protected regalLink(id: string): string[] {
    return ['/artikel', id];
  }

  /** Die Stücke in Lesereihenfolge, je mit dem ersten Eintrag, der es nennt. */
  private readonly stuecke = computed<LeseZeile[]>(() => {
    const raus = new Map<string, LeseZeile>();
    for (const z of this.buch()?.toc ?? []) if (!raus.has(z.unit)) raus.set(z.unit, z);
    return [...raus.values()];
  });

  protected nachbar(schritt: -1 | 1): LeseZeile | undefined {
    const l = this.stuecke();
    const i = l.findIndex((z) => z.unit === this.stueck()?.unit);
    return i < 0 ? undefined : l[i + schritt];
  }

  private async oeffnen(layer: string, at?: string, page?: string): Promise<void> {
    this.fehler.set(null);
    /* Ein anderes Buch (aus dem Regal, T-167): nichts vom vorigen bleibt stehen. */
    if (this.buch()?.layer.id !== layer) {
      this.buch.set(null);
      this.stueck.set(null);
      this.aktuell.set(null);
      this.treffer.set(null);
    }
    try {
      const b = await this.api.readBook(layer);
      if (layer !== this.layer()) return;
      this.buch.set(b);
      if (!this.eingebettet()) this.title.setTitle(`${b.layer.name} · Atlas Mentis`);
      this.gemerkt = b.position;
      const seite = Number(page);
      /* `?at=` darf auch ein Absatz sein (T-108): er steht in keinem
         Verzeichnis, aber sein Stück findet der Server. */
      const ziel =
        at ??
        (page && Number.isFinite(seite) ? nodeAtPage(b.toc, seite) : undefined) ??
        b.position ??
        b.toc[0]?.id;
      /* Auf der Artikelseite (T-191) steht das Buch unter dem Kopf der
         Ebene: wer sie öffnet, will zuerst den Kopf sehen — gesprungen wird
         nur auf ausdrücklichen Wunsch (`?at=`, `?page=`, `?tab=read`). */
      const springen = !this.eingebettet() || !!at || !!page || this.springen();
      if (ziel) await this.gehe(ziel, false, springen);
    } catch (x) {
      this.fehler.set(x instanceof Error ? x.message : String(x));
    }
  }

  /** Zu einem Abschnitt: sein Stück laden, wenn es nicht das offene ist, und hinscrollen. */
  protected async gehe(id: string, merken = true, scrollen = true): Promise<void> {
    const b = this.buch();
    if (!b) return;
    const z = b.toc.find((x) => x.id === id);
    /* Ein Teil (T-108) steht nicht im Verzeichnis: steht er schon im
       offenen Stück, genügt das Scrollen, sonst fragt man den Server nach
       seinem Stück (er nimmt jede Id darin). */
    const imOffenen = !z && this.stueck()?.sections.some((x) => x.id === id);
    this.tocOffen.set(false);
    if (z ? this.stueck()?.unit !== z.unit : !imOffenen) {
      this.laedt.set(true);
      try {
        const s = await this.api.readUnit(b.layer.id, z?.unit ?? id);
        this.bestand.bezuegeAufnehmen(s.refs);
        this.stueck.set(s);
      } catch (x) {
        this.fehler.set(x instanceof Error ? x.message : String(x));
        return;
      } finally {
        this.laedt.set(false);
      }
    }
    this.aktuell.set(id);
    this.ruhigBis = Date.now() + 2000;
    /* Nach dem Zeichnen: der Abschnitt steht erst dann im Dokument. */
    setTimeout(() => {
      if (!scrollen) return;
      this.hinScrollen(id);
      if (merken) this.merke(id);
      /* Eine Karte darüber, die erst jetzt ihr Bild bekommt, schiebt den
         Abschnitt nach unten — also noch einmal, wenn die Bilder darüber da
         sind, und nur, wenn niemand inzwischen selbst gescrollt hat. */
      const stand = window.scrollY;
      const bilder = Array.from(this.host.nativeElement.querySelectorAll<HTMLImageElement>('.lesetext img'));
      void Promise.race([
        Promise.all(bilder.map((b) => b.decode().catch(() => undefined))),
        new Promise((r) => setTimeout(r, 1500)),
      ]).then(() => {
        if (Math.abs(window.scrollY - stand) < 4 && this.aktuell() === id) this.hinScrollen(id);
      });
    });
  }

  private hinScrollen(id: string): void {
    const el = this.host.nativeElement.querySelector<HTMLElement>(`#s-${CSS.escape(id)}`);
    const z = this.buch()?.toc.find((x) => x.id === id);
    /* Die Titelseite ganz oben: nichts zu tun. */
    if (el && !(z?.depth === 0 && window.scrollY === 0)) el.scrollIntoView({ block: 'start' });
  }

  /** Welcher Abschnitt steht oben? Der, dessen Anfang zuletzt über die Linie kam. */
  private nachScroll(): void {
    if (Date.now() < this.ruhigBis) return;
    const teile = this.host.nativeElement.querySelectorAll<HTMLElement>('section.abschnitt');
    let oben: string | null = null;
    for (const t of Array.from(teile)) {
      if (t.getBoundingClientRect().top > 96) break;
      oben = t.dataset['id'] ?? null;
    }
    /* Auf der Artikelseite steht das Buch unten: solange es nicht oben
       angekommen ist, liest niemand darin, und der Lesestand bleibt. */
    if (!oben && this.eingebettet()) return;
    oben ??= teile[0]?.dataset['id'] ?? null;
    if (oben && oben !== this.aktuell()) {
      this.aktuell.set(oben);
      this.merke(oben);
    }
  }

  /** Den Lesestand merken, wenn er eine Weile steht — nicht bei jedem Rad. */
  private merke(id: string): void {
    clearTimeout(this.merkUhr);
    this.merkUhr = setTimeout(() => {
      const b = this.buch();
      if (!b || id === this.gemerkt) return;
      this.gemerkt = id;
      this.api.keepPosition(b.layer.id, id).catch(() => {
        /* Ein verlorenes Lesezeichen ist keine Meldung wert. */
        this.gemerkt = null;
      });
    }, 1500);
  }

  protected async suchen(ev: Event): Promise<void> {
    ev.preventDefault();
    const b = this.buch();
    const q = this.frage.trim();
    if (!b || q.length < 2) return;
    try {
      this.treffer.set((await this.api.searchBook(b.layer.id, q)).hits);
    } catch (x) {
      this.fehler.set(x instanceof Error ? x.message : String(x));
    }
  }
}

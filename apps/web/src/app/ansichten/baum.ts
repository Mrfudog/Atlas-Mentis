import { Component, Directive, InjectionToken, computed, effect, forwardRef, inject, input, signal, untracked } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  collectionGroups,
  collectionHits,
  collectionQuery,
  collectionRuleQuery,
  collectionView,
  elementTakes,
  entityName,
  entriesOf,
  fieldTitle,
  followPath,
  forArticle,
  isContainer,
  pathIds,
  primaryInterface,
  typeChain,
  isLayer,
} from '@nw/model';
import type { CollectionGroup, CollectionQuery, Entity, IncomingEdge, LayoutElement, PathHit, Registry, VarScopes } from '@nw/model';
import { Bestand } from '../kern/bestand';
import { Stil } from '../muster/stil';
import { Text } from '../artikel/text';
import { Statblock } from '../artikel/statblock';
import { Zauber } from '../artikel/zauber';
import { Gegenstand } from '../artikel/gegenstand';
import { Kennzahlen } from '../artikel/kennzahlen';
import { TokenBild } from '../artikel/token-bild';
import { Form } from '../artikel/form';
import { Lesen } from '../lesen/lesen';
import { Tabellenzeilen } from '../artikel/tabellenzeilen';
import { Bild, bildDes } from '../artikel/bild';
import { Struktur } from '../struktur/struktur';
import { Vorschau } from '../artikel/vorschau';

/**
 * **Wie tief eine Sammlung steckt** (T-425): jede Kachel einer Collection
 * zählt eine Stufe weiter. Steht in der Kurzansicht einer Szene wieder eine
 * Collection, zeichnet sie dort nichts — sonst zeigte die Session ihre
 * Szenen, die Szenen ihre Begegnungen, die Begegnungen ihre Kreaturen, und
 * am Ende stünde der halbe Bestand auf einer Seite.
 */
export const SAMMLUNGSTIEFE = new InjectionToken<number>('Sammlungstiefe', { providedIn: 'root', factory: () => 0 });

/** Ein Fach einer Sammlung: was darin steht, ist eine Stufe tiefer. */
@Directive({
  selector: '[nwSammelfach]',
  providers: [{ provide: SAMMLUNGSTIEFE, useFactory: () => inject(SAMMLUNGSTIEFE, { skipSelf: true }) + 1 }],
})
export class Sammelfach {}

/** Eine Collection, wie der Zeichner sie braucht. */
interface Sammlung {
  anzahl: number;
  gruppen: CollectionGroup[];
}

/** Ein Wert, wie ihn ein Element zeigt. */
interface Wert {
  ref: string;
  label: string;
  wert: string;
}

/** Die Werte eines Artikels am Ende eines Pfads. */
interface Treffer {
  id: string;
  name: string;
  /** Der Artikel selbst — dann steht kein Name darüber. */
  selbst: boolean;
  werte: Wert[];
  props: Record<string, unknown>;
}

/* Was keine gestaltete Ansicht als Wert zeigt: der Name steht im Kopf. */
const NICHT_ALS_WERT = ['Identity', 'Visibility', 'Source'];

/**
 * **Eine gestaltete Ansicht zeichnen** (T-268, E-103): der Baum aus
 * Elementen — Behälter (Section, Columns, Carousel, Collapsible) und
 * Werte (Tile group, Quote, Badges, Table from edges, Table, Felder, Bild),
 * auch über Kanten (`path`). Gebraucht von der Artikelseite (gewählte
 * Ansicht), der Kachel auf dem Board, der Kurzansicht (Popup, Kompendium,
 * Kartenmarker), dem Druck und der Vorschau des Designers — ganz für eine
 * gestaltete Ansicht, sonst für die Elemente, die nur er kennt
 * (`drawnByTree`, T-310).
 *
 * Zurückgehalten hat der Server (`redactEntity`); auch verknüpfte Artikel
 * kommen über ihn (`Bestand.holen`), also steht da, was gesehen werden darf.
 */
@Component({
  selector: 'nw-ansichtsbaum',
  /* Die Kurzansicht kennt den Baum und der Baum die Kurzansicht (Collection, T-425): `forwardRef` löst den Kreis. */
  imports: [NgTemplateOutlet, RouterLink, Stil, Text, Statblock, Zauber, Gegenstand, Kennzahlen, TokenBild, Form, Lesen, Tabellenzeilen, Bild, Struktur, Sammelfach, forwardRef(() => Vorschau)],
  template: `
    <ng-template #knoten let-el>
      <!-- Das Design des Elements (T-425, E-170): Tokens an Kopf, Fläche, Rahmen, Text. -->
      <div [nwStil]="el.style">
      @switch (el.el) {
        @case ('section') {
          <section class="abschnitt" [attr.data-el]="el.id">
            @if (el.text) {
              <h3>{{ el.text }}</h3>
            }
            @for (k of el.children ?? []; track k.id) {
              <ng-container *ngTemplateOutlet="knoten; context: { $implicit: k }" />
            }
          </section>
        }
        @case ('columns') {
          <div class="spalten" [style.--n]="el.columns || (el.children?.length ?? 1)">
            @for (k of el.children ?? []; track k.id) {
              <div class="spalte"><ng-container *ngTemplateOutlet="knoten; context: { $implicit: k }" /></div>
            }
          </div>
        }
        @case ('collapsible') {
          <details class="klapp" [open]="!!el.open">
            <summary>{{ el.text || 'More' }}</summary>
            @for (k of el.children ?? []; track k.id) {
              <ng-container *ngTemplateOutlet="knoten; context: { $implicit: k }" />
            }
          </details>
        }
        @case ('carousel') {
          @if (el.children?.length) {
            <div class="karussell" role="group" [attr.aria-label]="el.text || 'Carousel'">
              <button type="button" class="pfeil" aria-label="Previous" (click)="blaettern(el, -1)">‹</button>
              <div class="folie">
                <ng-container *ngTemplateOutlet="knoten; context: { $implicit: el.children[folie(el)] }" />
                <p class="punkte" aria-hidden="true">
                  @for (k of el.children; track k.id; let i = $index) {
                    <span [class.an]="i === folie(el)">•</span>
                  }
                </p>
              </div>
              <button type="button" class="pfeil" aria-label="Next" (click)="blaettern(el, 1)">›</button>
            </div>
          }
        }
        @case ('heading') {
          <h2 class="ueber">{{ el.text || titel() }}</h2>
        }
        @case ('text') {
          @if (el.text) {
            <nw-text class="satz" [text]="el.text" [scopes]="scopes()" />
          }
        }
        @case ('description') {
          @if (beschreibung(); as d) {
            <nw-text class="satz" [text]="d" [scopes]="scopes()" />
          }
        }
        @case ('image') {
          @if (bild(); as b) {
            <nw-bild [wert]="b.wert" [version]="b.version" groesse="thumb" [caption]="b.caption" [alt]="b.alt || titel()" />
          }
        }
        @case ('statblock') {
          <nw-statblock [artikel]="artikel()" />
        }
        @case ('stats') {
          <nw-kennzahlen [artikel]="artikel()" />
        }
        @case ('token') {
          <nw-token [artikel]="artikel()" />
        }
        @case ('shape') {
          <nw-form [artikel]="artikel()" />
        }
        @case ('spell') {
          <nw-zauber [artikel]="artikel()" [scopes]="scopes()" />
        }
        @case ('item') {
          <nw-gegenstand [artikel]="artikel()" />
        }
        @case ('reader') {
          <div class="leser" [class.unten]="el.side === 'bottom'" [class.rechts]="(el.side ?? 'right') === 'right' && werteVon(el).length">
            @if (istEbene()) {
              <nw-lesen [layer]="artikel().id" [eingebettet]="true" [toc]="el.toc ?? 'left'" />
            } @else {
              <p class="hinweis">The book reader shows a layer as a book.</p>
            }
            @if (el.side !== 'none' && werteVon(el).length) {
              <aside class="rand">
                @for (t of werteVon(el); track t.id) {
                  @for (w of t.werte; track w.ref) {
                    <div><b>{{ w.label }}</b> <span>{{ w.wert }}</span></div>
                  }
                }
              </aside>
            }
          </div>
        }
        @case ('edgeTable') {
          @if (el.path?.length ? treffer(el) : []; as tr) {
            @if (tr.length) {
              <table class="kantentabelle">
                @if (el.text) {
                  <caption>{{ el.text }}</caption>
                }
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    @for (p of el.props ?? []; track p) {
                      <th scope="col">{{ propTitel(el, p) }}</th>
                    }
                    @for (w of tr[0]!.werte; track w.ref) {
                      <th scope="col">{{ w.label }}</th>
                    }
                  </tr>
                </thead>
                <tbody>
                  @for (t of tr; track t.id) {
                    <tr>
                      <td><a [routerLink]="['/artikel', t.id]">{{ t.name }}</a></td>
                      @for (p of el.props ?? []; track p) {
                        <td>{{ alsText(t.props[p]) || '—' }}</td>
                      }
                      @for (w of spaltenVon(tr[0]!, t); track w.ref) {
                        <td>{{ w.wert || '—' }}</td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
            }
          }
        }
        @case ('collection') {
          <!-- Eine Sammlung (T-425, REQ-430): jeder Treffer in der Ansicht seiner eigenen Art — die Views werden wiederverwendet. -->
          @if (sammlung(el); as s) {
            @if (s.anzahl) {
              <section class="sammlung" [attr.data-el]="el.id" [attr.aria-label]="el.text || 'Collection'">
                @if (el.text) {
                  <h3>{{ el.text }} <span class="zahl">{{ s.anzahl }}</span></h3>
                }
                @for (g of s.gruppen; track g.key) {
                  @if (g.label) {
                    <h4 class="gruppe">{{ g.label }} <span class="zahl">{{ g.hits.length }}</span></h4>
                  }
                  @if ((el.show ?? 'tiles') === 'tiles') {
                    <div class="sammelkacheln">
                      @for (h of g.hits; track h.entity.id) {
                        <article class="sammelkachel" nwSammelfach>
                          <a class="kname" [routerLink]="['/artikel', h.entity.id]">{{ name(h.entity) }}</a>
                          <nw-vorschau [id]="h.entity.id" [ansicht]="ansichtFuer(el, h.entity)" [eingebettet]="true" [rueck]="false" />
                        </article>
                      }
                    </div>
                  } @else if (el.show === 'table') {
                    <!-- Als Tabelle (T-425): Name, Art, die Werte der Kante und die genannten Felder. -->
                    @if (tabelle(el, g.hits); as tb) {
                      <table class="kantentabelle sammeltabelle">
                        <thead>
                          <tr>
                            <th scope="col">Name</th>
                            @if (!g.label) {
                              <th scope="col">Type</th>
                            }
                            @for (p of el.props ?? []; track p) {
                              <th scope="col">{{ propTitel(el, p) }}</th>
                            }
                            @for (k of tb.kopf; track k.ref) {
                              <th scope="col">{{ k.label }}</th>
                            }
                          </tr>
                        </thead>
                        <tbody>
                          @for (z of tb.zeilen; track z.id) {
                            <tr>
                              <td><a class="kname" [routerLink]="['/artikel', z.id]">{{ z.name }}</a></td>
                              @if (!g.label) {
                                <td class="art">{{ z.art }}</td>
                              }
                              @for (p of el.props ?? []; track p) {
                                <td>{{ alsText(z.props[p]) || '—' }}</td>
                              }
                              @for (w of z.werte; track w.ref) {
                                <td>{{ w.wert || '—' }}</td>
                              }
                            </tr>
                          }
                        </tbody>
                      </table>
                    }
                  } @else {
                    <ul class="sammelliste">
                      @for (h of g.hits; track h.entity.id) {
                        <li nwSammelfach>
                          <a class="kname" [routerLink]="['/artikel', h.entity.id]">{{ name(h.entity) }}</a>
                          @if (!g.label) {
                            <span class="art">{{ artName(h.entity) }}</span>
                          }
                          <nw-vorschau [id]="h.entity.id" [ansicht]="ansichtFuer(el, h.entity)" [eingebettet]="true" [rueck]="false" />
                        </li>
                      }
                    </ul>
                  }
                }
              </section>
            }
          }
        }
        @case ('linked') {
          <!-- Ein verknüpfter Artikel (T-425, E-172): das erste Ziel der Kante, in der Ansicht, die das Element wählt. -->
          @if (verknuepft(el); as v) {
            <section class="verknuepft" [attr.data-el]="el.id" [attr.aria-label]="el.text || name(v)">
              @if (el.text) {
                <h3>{{ el.text }}</h3>
              }
              <article class="sammelkachel" nwSammelfach>
                <a class="kname" [routerLink]="['/artikel', v.id]">{{ name(v) }}</a>
                <nw-vorschau [id]="v.id" [ansicht]="el.view || 'quick'" [eingebettet]="true" [rueck]="false" />
              </article>
            </section>
          }
        }
        @case ('structure') {
          <!-- Die Struktur (T-341): vom Artikel aus, gesiebt am Server; erst geladen, wenn sie zu sehen ist (T-348). -->
          @defer (on viewport) {
            <nw-struktur [wurzel]="artikel().id" [kanten]="el.edges ?? []" [tiefe]="el.depth" [form]="el.layout ?? 'tree'" />
          } @placeholder {
            <p class="laedt">Structure…</p>
          }
        }
        @case ('table') {
          <!-- Die Zeilen einer Tabelle (T-310) — des Artikels, oder über einen Pfad die am Ende. -->
          @for (t of tabellenVon(el); track t.id) {
            <nw-tabellenzeilen [artikel]="t" [titel]="el.text || (t.id === artikel().id ? undefined : name(t))" [scopes]="scopes()" />
          }
        }
        @case ('tileGroup') {
          @for (t of werteVon(el); track t.id) {
            @if (!t.selbst) {
              <p class="von"><a [routerLink]="['/artikel', t.id]">{{ t.name }}</a></p>
            }
            <div class="kacheln">
              @for (w of t.werte; track w.ref) {
                <div class="kachel"><span class="lbl">{{ w.label }}</span><b>{{ w.wert }}</b></div>
              }
            </div>
          }
        }
        @case ('quote') {
          @for (t of werteVon(el); track t.id) {
            @for (w of t.werte; track w.ref) {
              <blockquote class="zitat">{{ w.wert }}</blockquote>
            }
          }
        }
        @case ('badges') {
          <p class="marken">
            @for (t of werteVon(el); track t.id) {
              @for (w of t.werte; track w.ref) {
                @for (m of w.wert.split(', '); track $index) {
                  <span class="marke" [title]="w.label">{{ m }}</span>
                }
              }
            }
          </p>
        }
        @case ('fields') {
          @for (t of werteVon(el); track t.id) {
            @if (!t.selbst) {
              <p class="von"><a [routerLink]="['/artikel', t.id]">{{ t.name }}</a></p>
            }
            @if (t.werte.length) {
              <dl class="werte">
                @for (w of t.werte; track w.ref) {
                  <div><dt>{{ w.label }}</dt><dd>{{ w.wert }}</dd></div>
                }
              </dl>
            }
          }
        }
        @case ('prose') {
          @for (a of prosa(el); track a.ref) {
            <nw-text class="satz" [text]="a.wert" [scopes]="scopes()" />
          }
        }
        @default {
          @if (nurAufDerSeite(el.el)) {
            <p class="hinweis">{{ el.el }} — shown on the full article page.</p>
          }
        }
      }
      </div>
    </ng-template>

    @for (el of baum(); track el.id) {
      <ng-container *ngTemplateOutlet="knoten; context: { $implicit: el }" />
    } @empty {
      <p class="hinweis">This view shows nothing yet.</p>
    }
  `,
  styleUrl: './baum.scss',
})
export class Ansichtsbaum {
  readonly artikel = input.required<Entity>();
  readonly layout = input.required<readonly LayoutElement[]>();
  /** Ein Entwurf des Registers (Vorschau im Designer). */
  readonly register = input<Registry | null>(null);
  /** Die Kanten, die auf den Artikel zeigen — aus den Rückbezügen. */
  readonly rueck = input<readonly IncomingEdge[]>([]);

  private readonly bestand = inject(Bestand);
  /** In einer Kachel einer Collection: dort zeichnet eine weitere Collection nichts (eine Stufe, T-425). */
  private readonly tiefe = inject(SAMMLUNGSTIEFE);
  private readonly reg = computed(() => this.register() ?? this.bestand.registry());
  private readonly folien = signal<Record<string, number>>({});

  protected readonly primaerTyp = computed(() => primaryInterface(this.artikel()));
  /** Eine Ebene, auch ein Regelsystem oder eine Regelmechanik (E-166). */
  protected readonly istEbene = computed(() => isLayer(this.artikel()));
  protected readonly titel = computed(() => entityName(this.artikel()));
  protected readonly baum = computed(() => forArticle(this.layout(), this.artikel(), this.rueck()));
  protected readonly scopes = computed<VarScopes>(() => {
    const vars = this.artikel().components?.['Vars'] as { bindings?: Record<string, string> } | undefined;
    return { entity: vars?.bindings, campaign: this.reg()?.vars };
  });
  /** Das Bild des Artikels (T-310) — wie in der Kurzansicht. */
  protected readonly bild = computed(() => {
    const r = this.reg();
    return r ? bildDes(this.artikel(), r, this.bestand.bild().get(this.artikel().id)) : null;
  });
  protected readonly beschreibung = computed(
    () => (this.artikel().components?.['Description'] as { description?: string } | undefined)?.description ?? '',
  );

  /** Wer am ersten Schritt eines Pfads steht, wird geholt, sobald ein Element ihn braucht. */
  private readonly brauche = computed(() => {
    const ids = new Set<string>();
    const sammle = (els: readonly LayoutElement[]): void => {
      for (const el of els) {
        if (el.path?.length) {
          for (const id of this.erreichbar(el)) ids.add(id);
        }
        /* Mitglieder von Hand (E-174): wer über `inCollection` hineinzeigt. */
        if (el.el === 'collection' && el.source === 'members') {
          for (const k of this.eingehend(this.artikel().id)) if (k.type === 'inCollection') ids.add(k.from);
        }
        if (el.children) sammle(el.children);
      }
    };
    sammle(this.baum());
    return [...ids];
  });

  constructor() {
    effect(() => {
      const ids = this.brauche();
      if (ids.length) untracked(() => void this.bestand.holen(ids));
    });
    /* Filter-Sammlungen fragen den Server, wie das Kompendium — gesiebt dort (T-425). */
    effect(() => {
      const f = this.fragen();
      untracked(() => f.forEach((x) => void this.frage(x)));
    });
  }

  /** Ids aller Artikel entlang eines Pfads, soweit schon bekannt — Schritt für Schritt nachgeladen. */
  private erreichbar(el: LayoutElement): string[] {
    const r = this.reg();
    if (!r || !el.path) return [];
    const raus: string[] = [];
    let stand: Entity[] = [this.artikel()];
    el.path.forEach((schritt) => {
      const weiter: Entity[] = [];
      for (const e of stand) {
        for (const id of pathIds(e, [schritt], (x) => this.eingehend(x))) {
          raus.push(id);
          const da = this.bestand.voll().get(id);
          if (da) weiter.push(da);
        }
      }
      stand = weiter;
    });
    return raus;
  }

  private eingehend(id: string): readonly IncomingEdge[] {
    if (id === this.artikel().id) return this.rueck();
    return (this.bestand.rueckbezuege().get(id) ?? []).map((b) => ({ type: b.relation.type, from: b.from.id, props: b.relation.props }));
  }

  /** Die Artikel am Ende des Pfads, mit den Werten, die das Element nennt. */
  protected treffer(el: LayoutElement): Treffer[] {
    const r = this.reg();
    if (!r) return [];
    const hits: PathHit[] = followPath(r, this.artikel(), el.path, {
      get: (id) => (id === this.artikel().id ? this.artikel() : this.bestand.voll().get(id)),
      incoming: (id) => this.eingehend(id),
    });
    return hits.map((h) => ({
      id: h.entity.id,
      name: entityName(h.entity),
      selbst: h.entity.id === this.artikel().id,
      werte: el.fields === undefined && el.el === 'edgeTable' ? [] : this.werte(r, h.entity, el),
      props: h.props,
    }));
  }

  /**
   * **Die Treffer einer Collection** (T-425): dem Pfad gefolgt, auf die
   * Arten eingeengt, geordnet und gruppiert (`collectionHits`). Was der
   * Server zurückhielt, ist nicht in `voll` und fehlt.
   */
  protected sammlung(el: LayoutElement): Sammlung | null {
    const r = this.reg();
    if (!r || this.tiefe > 0) return null;
    const frage = this.frageVon(el);
    const voll = this.bestand.voll();
    const found = frage
      ? (this.gefunden().get(JSON.stringify(frage)) ?? []).map((id) => voll.get(id)).filter((e): e is Entity => !!e)
      : undefined;
    const hits = collectionHits(r, this.artikel(), el, {
      get: (id) => (id === this.artikel().id ? this.artikel() : voll.get(id)),
      incoming: (id) => this.eingehend(id),
      ...(found ? { found } : {}),
    });
    return { anzahl: hits.length, gruppen: collectionGroups(r, hits, el) };
  }

  /** Eine Gruppe als Tabelle: die Spalten sind die Felder, die irgendein Treffer füllt — in der Reihenfolge des ersten. */
  protected tabelle(el: LayoutElement, hits: readonly PathHit[]): { kopf: Wert[]; zeilen: { id: string; name: string; art: string; props: Record<string, unknown>; werte: Wert[] }[] } | null {
    const r = this.reg();
    if (!r || !hits.length) return null;
    const mitFeldern = el.fields !== undefined;
    const roh = hits.map((h) => ({ h, werte: mitFeldern ? this.werte(r, h.entity, el) : [] }));
    const kopf: Wert[] = [];
    for (const z of roh) for (const w of z.werte) if (!kopf.some((k) => k.ref === w.ref)) kopf.push({ ...w, wert: '' });
    return {
      kopf,
      zeilen: roh.map(({ h, werte }) => ({
        id: h.entity.id,
        name: entityName(h.entity),
        art: this.artName(h.entity),
        props: h.props,
        werte: kopf.map((k) => werte.find((w) => w.ref === k.ref) ?? { ...k, wert: '' }),
      })),
    };
  }

  /** Die Frage einer Sammlung: ihr Filter, oder bei `members` die Regel der Collection, an der sie steht (E-174). */
  private frageVon(el: LayoutElement): CollectionQuery | null {
    return el.source === 'members' ? collectionRuleQuery(this.artikel()) : collectionQuery(el);
  }

  /** Was die Filter-Sammlungen gefunden haben, je Frage (T-425): die Ids, die der Server schickte. */
  private readonly gefunden = signal<ReadonlyMap<string, string[]>>(new Map());
  private readonly gefragt = new Set<string>();

  /** Die Fragen der Filter-Sammlungen in diesem Baum. */
  private readonly fragen = computed(() => {
    const raus: CollectionQuery[] = [];
    const sammle = (els: readonly LayoutElement[]): void => {
      for (const el of els) {
        const f = el.el === 'collection' ? this.frageVon(el) : null;
        if (f) raus.push(f);
        if (el.children) sammle(el.children);
      }
    };
    if (this.tiefe === 0) sammle(this.baum());
    return raus;
  });

  private async frage(f: CollectionQuery): Promise<void> {
    const key = JSON.stringify(f);
    if (this.gefragt.has(key)) return;
    this.gefragt.add(key);
    try {
      const l = await this.bestand.liste(f);
      const ids = l.rows.map((z) => z.id);
      await this.bestand.holen(ids);
      this.gefunden.update((m) => new Map(m).set(key, ids));
    } catch {
      this.gefragt.delete(key);
    }
  }

  /** Das Ziel eines „Linked article" mit Pfad: das erste, das der Betrachter bekommt (eine Stufe wie die Collection). */
  protected verknuepft(el: LayoutElement): Entity | null {
    const r = this.reg();
    if (!r || this.tiefe > 0 || !el.path?.length) return null;
    const hits = collectionHits(r, this.artikel(), { ...el, sort: el.sort ?? { by: 'name' } }, {
      get: (id) => (id === this.artikel().id ? this.artikel() : this.bestand.voll().get(id)),
      incoming: (id) => this.eingehend(id),
    });
    return hits[0]?.entity ?? null;
  }

  /** In welcher Ansicht ein Treffer steht: das Element wählt, je Zielart (E-172). */
  protected ansichtFuer(el: LayoutElement, e: Entity): string {
    const r = this.reg();
    return r ? collectionView(r, el, primaryInterface(e)) : 'quick';
  }

  protected artName(e: Entity): string {
    const typ = primaryInterface(e);
    return this.reg()?.interfaces[typ]?.label ?? typ;
  }

  /** Die Tabellen eines Elements `table`: der Artikel selbst, oder die am Ende seines Pfads. */
  protected tabellenVon(el: LayoutElement): Entity[] {
    const r = this.reg();
    if (!r) return [];
    return followPath(r, this.artikel(), el.path, {
      get: (id) => (id === this.artikel().id ? this.artikel() : this.bestand.voll().get(id)),
      incoming: (id) => this.eingehend(id),
    }).map((h) => h.entity);
  }

  protected name(e: Entity): string {
    return entityName(e);
  }

  /** Wie `treffer`, ohne Artikel, die nichts zu zeigen haben. */
  protected werteVon(el: LayoutElement): Treffer[] {
    return this.treffer(el).filter((t) => t.werte.length);
  }

  /** Die Zellen einer Zeile in der Reihenfolge der Kopfzeile. */
  protected spaltenVon(kopf: Treffer, t: Treffer): Wert[] {
    return kopf.werte.map((k) => t.werte.find((w) => w.ref === k.ref) ?? { ...k, wert: '' });
  }

  protected prosa(el: LayoutElement): Wert[] {
    const r = this.reg();
    if (!r) return [];
    const e = this.artikel();
    const typ = primaryInterface(e);
    const raus: Wert[] = [];
    for (const comp of typeChain(r, typ)) {
      for (const [key, prop] of Object.entries(r.interfaces[comp]?.schema?.properties ?? {})) {
        if (!(prop.many && prop.format === 'long') || !elementTakes(el, comp, key)) continue;
        for (const x of entriesOf((e.components?.[comp] as Record<string, unknown> | undefined)?.[key])) {
          raus.push({ ref: `${comp}.${key}#${x.id}`, label: fieldTitle(r, typ, { type: comp, key, prop }), wert: x.value });
        }
      }
    }
    return raus;
  }

  private werte(r: Registry, e: Entity, el: LayoutElement): Wert[] {
    const typ = primaryInterface(e);
    const raus: Wert[] = [];
    const name = this.bestand.name();
    for (const comp of typeChain(r, typ)) {
      if (NICHT_ALS_WERT.includes(comp)) continue;
      const karte = e.components?.[comp] as Record<string, unknown> | undefined;
      if (!karte) continue;
      for (const [key, prop] of Object.entries(r.interfaces[comp]?.schema?.properties ?? {})) {
        if (!elementTakes(el, comp, key) || (prop.many && prop.format === 'long')) continue;
        /* Ein Verweis zeigt den Namen seines Ziels, nicht die Nummer. */
        const roh = prop.format === 'link' && typeof karte[key] === 'string' ? (name(karte[key] as string) ?? '') : alsText(karte[key]);
        if (!roh) continue;
        raus.push({ ref: `${comp}.${key}`, label: fieldTitle(r, typ, { type: comp, key, prop }), wert: roh });
      }
    }
    return raus;
  }

  /** Die Beschriftung einer Eigenschaft der letzten Kante des Pfads, sonst ihr Schlüssel. */
  protected propTitel(el: LayoutElement, p: string): string {
    const letzte = el.path?.[el.path.length - 1];
    const titel = letzte ? this.reg()?.relations[letzte.relation]?.props?.properties?.[p]?.title : undefined;
    return titel ?? p;
  }

  protected folie(el: LayoutElement): number {
    const n = el.children?.length ?? 0;
    return n ? (((this.folien()[el.id] ?? 0) % n) + n) % n : 0;
  }

  protected blaettern(el: LayoutElement, um: number): void {
    this.folien.update((m) => ({ ...m, [el.id]: this.folie(el) + um }));
  }

  /** Was dieser Zeichner nicht kennt, zeichnet die Artikelseite — hier ein Hinweis statt einer leeren Stelle. */
  protected nurAufDerSeite(art: string): boolean {
    return !isContainer({ el: art as LayoutElement['el'] });
  }

  protected alsText(wert: unknown): string {
    return alsText(wert);
  }
}

function alsText(wert: unknown): string {
  if (wert === null || wert === undefined || wert === '') return '';
  if (Array.isArray(wert)) return wert.map(alsText).filter(Boolean).join(', ');
  if (typeof wert === 'object') {
    /* Ein Eintrag mit Id (Textblock, `entriesOf`) zeigt seinen Wert. */
    const v = (wert as { value?: unknown }).value;
    return typeof v === 'string' ? v : '';
  }
  if (typeof wert === 'boolean') return wert ? 'yes' : '';
  return String(wert);
}

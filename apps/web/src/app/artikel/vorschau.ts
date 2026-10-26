import { Component, computed, effect, forwardRef, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { KurzLink } from '../kern/kurzansicht';
import {
  LAYER_RELATION,
  boardSketch,
  elementTakes,
  entityName,
  entriesOf,
  fieldText,
  fieldTitle,
  drawnByTree,
  forArticle,
  pickView,
  primaryInterface,
  proseFields,
  typeChain,
  unitsFor,
  isLayer,
} from '@nw/model';
import type { BoardSketch, Entity, IncomingEdge, LayoutElement, Registry, VarScopes } from '@nw/model';
import { Bestand } from '../kern/bestand';
import { QuelleText } from '../kern/quellen';
import { Text } from './text';
import { Bild, bildDes } from './bild';
import { ansichtWeg } from '../klassen/ansicht-weg';
import { Kennzahlen } from './kennzahlen';
import { TokenBild } from './token-bild';
import { Ansichtsbaum } from '../ansichten/baum';

/** Was die Seitenspalte und die Überschrift schon sagen. */
const SCHON_ANDERSWO = ['Identity', 'Visibility', 'Source', 'Status', 'Tags'];

interface Stueck {
  kind: 'text' | 'felder' | 'prosa' | 'teile' | 'bild' | 'kennzahlen' | 'token' | 'baum' | 'skizze';
  skizze?: BoardSketch;
  /** Ein Element, das nur der Baum zeichnet (T-310): Collapsible, Columns, Table … */
  baum?: LayoutElement[];
  key: string;
  bild?: { wert: string; caption: string; alt: string; version?: string };
  text?: string;
  felder?: { ref: string; label: string; wert: string; lang: boolean }[];
  prosa?: { ref: string; key: string; label: string; wert: string }[];
  teile?: { abschnitt: string; ziele: { id: string; name: string | undefined }[] }[];
}

/**
 * Die Vorschau einer Zeile im Kompendium — die Ansicht **`quick`** (W7,
 * `Main.dc.html`).
 *
 * **Der Ort wählt die Ansicht** (CLAUDE.md): eine Karte neben der Liste ist
 * `quick`, wie eine Karte auf dem Board. Gezeichnet wird die Anordnung, die
 * für den Artikel gilt (`pickView`, T-310: auch eine im Designer gestaltete
 * der Gruppe `quick`) — der Statblock seine Felder und
 * seine Teile, ein Ort Bild, Beschreibung und Passagen. Kein Sonderfall je
 * Art. Was nur der Baum kennt (ein Collapsible, eine Tabelle), zeichnet
 * `nw-ansichtsbaum` an seiner Stelle. „Open article" führt zur Artikelseite (`full`).
 *
 * Dieselbe Karte steht im Popup der Kurzansicht (`nw-kurzpopup`, T-093) —
 * überall, wo ein Artikel genannt wird.
 */
@Component({
  selector: 'nw-vorschau',
  /* Der Baum zeichnet Kurzansichten (Collection, T-425), die Kurzansicht den Baum: `forwardRef` in beiden Richtungen. */
  imports: [RouterLink, Text, QuelleText, KurzLink, Bild, Kennzahlen, TokenBild, forwardRef(() => Ansichtsbaum)],
  template: `
    <aside class="vorschau" [class.eingebettet]="eingebettet()" aria-label="Preview">
      @if (!eingebettet()) {
        <div class="vkopf">
          <span class="leg">Quick view</span>
          <button type="button" class="zu" (click)="zu.emit()" aria-label="Close preview">×</button>
        </div>
      }
      @if (artikel(); as e) {
        @if (!eingebettet()) {
          <h2>{{ name(e) }}</h2>
        }
        @if (eingebettet() ? null : meta(); as m) {
          <p class="meta">
            {{ m.art }}
            @if (m.quelle) {
              · <nw-quelle [text]="m.quelle" />
            }
            @if (m.ebenen) {
              · <span class="ebene" [title]="m.vergleich ? 'Compare layer — not in play' : 'Layer'">{{ m.ebenen }}{{ m.vergleich ? ' (not in play)' : '' }}</span>
            }
          </p>
        }
        @if (!eingebettet()) {
          <div class="linie" aria-hidden="true"></div>
        }
        @for (s of stuecke(); track s.key) {
          @switch (s.kind) {
            @case ('text') {
              <nw-text [text]="s.text!" [scopes]="scopes()" />
            }
            @case ('token') {
              <nw-token [artikel]="e" />
            }
            @case ('baum') {
              <nw-ansichtsbaum [artikel]="e" [layout]="s.baum!" [rueck]="rueckKanten()" />
            }
            @case ('kennzahlen') {
              <nw-kennzahlen [artikel]="e" />
            }
            @case ('skizze') {
              <!-- Ein Board, klein (T-425): wo die Kacheln liegen und wie sie heissen. -->
              @if (s.skizze; as sk) {
                <div class="bildfach">
                  <svg class="skizze" [attr.viewBox]="'0 0 ' + sk.width + ' ' + sk.height" role="img" [attr.aria-label]="'Board with ' + sk.cards.length + ' cards'">
                    <rect x="0" y="0" [attr.width]="sk.width" [attr.height]="sk.height" class="flaeche" [attr.fill]="sk.background || null" />
                    @for (k of sk.cards; track k.id + $index) {
                      <g>
                        <rect class="karte" [attr.x]="k.x" [attr.y]="k.y" [attr.width]="k.w" [attr.height]="k.h" rx="8" />
                        @if (k.name) {
                          <text [attr.x]="k.x + 12" [attr.y]="k.y + 40" class="kname">{{ k.name }}</text>
                        }
                      </g>
                    }
                  </svg>
                </div>
              }
            }
            @case ('bild') {
              <!-- Im Rahmen (Popup, Marker) schneidet das Fach unten ab statt zu scrollen (T-346). -->
              <div class="bildfach">
                <nw-bild [wert]="s.bild!.wert" [version]="s.bild!.version" groesse="thumb" [caption]="s.bild!.caption" [alt]="s.bild!.alt || name(e)" />
              </div>
            }
            @case ('felder') {
              <dl>
                @for (f of s.felder; track f.ref) {
                  <div class="feld">
                    <dt>{{ f.label }}</dt>
                    <dd>
                      @if (f.lang) {
                        <nw-text [text]="f.wert" [scopes]="scopes()" />
                      } @else {
                        {{ f.wert }}
                      }
                    </dd>
                  </div>
                }
              </dl>
            }
            @case ('prosa') {
              @for (p of s.prosa; track p.ref) {
                <section>
                  @if (p.key !== 'paragraph') {
                    <h3>{{ p.label }}</h3>
                  }
                  <nw-text [text]="p.wert" [scopes]="scopes()" />
                </section>
              }
            }
            @case ('teile') {
              @for (g of s.teile; track g.abschnitt) {
                <section>
                  <h3>{{ g.abschnitt }}</h3>
                  <p class="teile">
                    @for (z of g.ziele; track z.id; let letzte = $last) {
                      @if (z.name) {
                        <a [routerLink]="['/artikel', z.id]" [nwQuick]="z.id">{{ z.name }}</a>
                      } @else {
                        <span class="dim">(not here)</span>
                      }
                      @if (!letzte) {
                        <span aria-hidden="true"> · </span>
                      }
                    }
                  </p>
                </section>
              }
            }
          }
        }
        @if (!eingebettet()) {
          <div class="knoepfe">
            <a class="knopf pri" [routerLink]="weg(e)">Open article</a>
            <!-- Eine Ebene liest man auch von hier (T-167): der Reiter „Read" am Artikel. -->
            @if (istEbene(e)) {
              <a class="knopf" [routerLink]="['/artikel', e.id]" [queryParams]="{ tab: 'read' }">Read</a>
            }
          </div>
        }
      } @else if (bestand.fehlt().has(id())) {
        <p class="dim">No such article — or not one you may see.</p>
      } @else {
        <p class="dim">Loading…</p>
      }
    </aside>
  `,
  styles: `
    /* **Das Bild gibt nach** (T-346): die Karte ist eine Spalte, in der nur
       das Bildfach schrumpfen darf. Steht sie in einem Rahmen mit fester
       Höhe (das Popup, der Marker), wird das Bild unten abgeschnitten —
       nicht verkleinert —, und die Werte darüber bleiben ganz. Ohne Rahmen
       (Kompendium, Suche) steht es ganz da. */
    :host {
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    .vorschau {
      flex: 0 1 auto;
      min-height: 0;
    }
    .vorschau > * {
      flex: none;
    }
    .vorschau > .bildfach {
      flex: 0 1 auto;
      min-height: 0;
      overflow: hidden;
    }
    /* Die Skizze eines Boards (T-425): Fläche und Kacheln, die Namen gross genug für klein. */
    .skizze {
      display: block;
      width: 100%;
      height: auto;
      max-height: 14rem;
    }
    .skizze .flaeche {
      fill: var(--paper-2, #f3ead7);
      stroke: var(--line);
      stroke-width: 4;
    }
    .skizze .karte {
      fill: var(--paper);
      stroke: var(--ink, #3b2f22);
      stroke-width: 4;
    }
    .skizze .kname {
      font: 600 32px var(--sans, sans-serif);
      fill: var(--ink, #3b2f22);
    }
    .vorschau.eingebettet {
      border: 0;
      padding: 0;
      background: none;
    }
    .vorschau {
      background: var(--paper);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 0.9rem 1rem 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .vkopf {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .leg {
      font-family: var(--caps);
      font-weight: 700;
      color: var(--dim);
      font-size: 0.85rem;
    }
    .zu {
      min-height: 0;
      padding: 0 0.4rem;
      border: 0;
      background: none;
      color: var(--accent);
      font-size: 1.2rem;
      font-weight: 700;
    }
    h2 {
      margin: 0;
      font-family: var(--caps);
      color: var(--accent);
      font-size: 1.45rem;
      line-height: 1.15;
    }
    .meta {
      margin: 0;
      font-style: italic;
      color: var(--dim);
    }
    .linie {
      height: 2px;
      background: var(--rule);
      opacity: 0.8;
    }
    dl {
      margin: 0;
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem 1rem;
    }
    .feld {
      display: flex;
      gap: 0.35rem;
      min-width: 0;
    }
    dt {
      font-weight: 700;
      color: var(--heading);
    }
    dd {
      margin: 0;
      overflow-wrap: anywhere;
    }
    h3 {
      margin: 0.4rem 0 0.15rem;
      font-family: var(--caps);
      color: var(--heading);
      font-size: 1rem;
      border-bottom: 1px solid var(--gold);
    }
    .teile {
      margin: 0;
    }
    .dim {
      color: var(--dim);
    }
    .knoepfe {
      display: flex;
      gap: 0.5rem;
      margin-top: 0.4rem;
    }
    .knopf {
      display: inline-flex;
      align-items: center;
      min-height: 40px;
      padding: 0 1rem;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 700;
    }
    .knopf.pri {
      background: var(--accent);
      color: var(--accent-ink);
    }
  `,
})
export class Vorschau {
  readonly id = input.required<string>();
  /** Wohin „Open article" führt — Klasse, Herkunft, Hintergrund in ihre Ansicht. */
  protected weg(e: { id: string; interfaces: string[] }): string[] {
    return ansichtWeg(e.interfaces[0], e.id);
  }
  /** Auch holen, was auf ihn zeigt? Das Popup (T-093) zeigt es nicht und spart die Anfrage. */
  readonly rueck = input(true);
  /** Welche Ansicht (T-138): `quick`, wo nichts anderes gesagt wird; das „+"
   *  der Suche fragt nach `search`. Fehlt sie im Register, gilt `quick`. */
  readonly ansicht = input('quick');
  /** In einer fremden Zeile: ohne Kopf, Namen, Quelle und „Open article" — das sagt die Zeile. */
  readonly eingebettet = input(false);
  readonly zu = output<void>();

  protected readonly bestand = inject(Bestand);

  constructor() {
    /* Als Popup steht sie auf jeder Seite (T-093), auch auf einer, die das
       Register sonst nicht braucht — gezeichnet wird aber aus ihm. */
    void this.bestand.load();
    effect(() => {
      void this.bestand.oeffnen(this.id(), false, this.rueck());
    });
  }

  private readonly reg = computed<Registry | null>(() => this.bestand.registry());
  protected readonly artikel = computed<Entity | undefined>(() => this.bestand.voll().get(this.id()));

  /** Was auf den Artikel zeigt — für Bedingungen und Pfade über eingehende Kanten. */
  protected readonly rueckKanten = computed<IncomingEdge[]>(() =>
    (this.bestand.rueckbezuege().get(this.id()) ?? []).map((b) => ({ type: b.relation.type, from: b.from.id, props: b.relation.props })),
  );

  /** Eine Ebene, auch ein Regelsystem oder eine Regelmechanik (E-166). */
  protected istEbene(e: Entity): boolean {
    return isLayer(e);
  }

  protected name(e: Entity): string {
    return entityName(e);
  }

  protected readonly meta = computed(() => {
    const e = this.artikel();
    const r = this.reg();
    if (!e || !r) return null;
    const typ = primaryInterface(e);
    const q = e.components?.['Source'] as { publication?: string; page?: string } | undefined;
    const quelle = [q?.publication, q?.page ? `p. ${q.page}` : ''].filter(Boolean).join(' ');
    /* Die Ebene auch hier (T-251): worin der Artikel steht. Eine, deren
       Namen der Server nicht schickt, steht nicht da (T-207). */
    const name = this.bestand.name();
    const ebenen = (e.relations ?? []).filter((x) => x.type === LAYER_RELATION).map((x) => name(x.to)).filter((n): n is string => !!n);
    const vergleich = this.bestand.vergleich().has(e.id);
    /* Das Kürzel erklärt sich selbst (T-088). */
    return { art: r.interfaces[typ]?.label ?? typ, quelle, ebenen: ebenen.join(', '), vergleich };
  });

  protected readonly scopes = computed<VarScopes>(() => {
    const vars = this.artikel()?.components?.['Vars'] as { bindings?: Record<string, string> } | undefined;
    return { entity: vars?.bindings, campaign: this.reg()?.vars };
  });

  /** Die Anordnung von `quick` für diese Art, Element für Element. */
  protected readonly stuecke = computed<Stueck[]>(() => {
    const e = this.artikel();
    const r = this.reg();
    if (!e || !r) return [];
    const typ = primaryInterface(e);
    const raus: Stueck[] = [];
    const flach = (layout: LayoutElement[]): LayoutElement[] =>
      layout.flatMap((el) => (el.el === 'tabs' ? flach(el.tabs?.[0]?.layout ?? []) : [el]));
    /* Welche Ansicht gilt (T-310): die genaueste der Gruppe, sonst `quick`. */
    const wahl = pickView(e, r, this.ansicht(), { incoming: this.rueckKanten(), fallback: 'quick' });
    /* Was die Ansicht sagt (T-110): leere Felder zeigen, Ungenanntes am Ende. */
    const view = r.views[wahl.key];
    const leer = view?.empty === 'show';
    const genommen = new Set<string>();
    /* Eine gestaltete zeichnet ihr Baum ganz — Felder über Kanten kennt nur er. */
    if (wahl.designed) return [{ kind: 'baum', key: wahl.key, baum: wahl.layout }];
    for (const el of flach(forArticle(wahl.layout, e, this.rueckKanten()))) {
      if (drawnByTree(el)) {
        raus.push({ kind: 'baum', key: el.id, baum: [el] });
      } else if (el.el === 'image') {
        /* Die Karte zeigt die Vorschau (480 px); ein Klick öffnet das ganze Bild (T-114). */
        const bild = bildDes(e, r, this.bestand.bild().get(e.id));
        if (bild) raus.push({ kind: 'bild', key: el.id, bild });
      } else if (el.el === 'board') {
        const n = this.bestand.name();
        raus.push({ kind: 'skizze', key: el.id, skizze: boardSketch(e, (x) => n(x)) });
      } else if (el.el === 'stats') {
        /* Die Kennzahlen (T-206) — sie holen ihren Statblock selbst. */
        raus.push({ kind: 'kennzahlen', key: el.id });
      } else if (el.el === 'token') {
        raus.push({ kind: 'token', key: el.id });
      } else if (el.el === 'description') {
        const d = (e.components?.['Description'] as { description?: string } | undefined)?.description;
        if (d) raus.push({ kind: 'text', key: el.id, text: d });
      } else if (el.el === 'fields') {
        const felder = this.felder(e, r, typ, el, leer, genommen);
        if (felder.length) raus.push({ kind: 'felder', key: el.id, felder });
      } else if (el.el === 'prose') {
        const prosa = this.prosa(e, r, typ, el);
        if (prosa.length) raus.push({ kind: 'prosa', key: el.id, prosa });
      } else if (el.el === 'composed') {
        const teile = this.teile(e, r);
        if (teile.length) raus.push({ kind: 'teile', key: el.id, teile });
      }
    }
    if (view?.rest) {
      const felder = this.felder(e, r, typ, { id: 'rest-f', el: 'fields', fields: 'all' }, leer, genommen);
      if (felder.length) raus.push({ kind: 'felder', key: 'rest-f', felder });
    }
    return raus;
  });

  private felder(
    e: Entity,
    r: Registry,
    typ: string,
    el: LayoutElement,
    leer = false,
    genommen = new Set<string>(),
  ): NonNullable<Stueck['felder']> {
    /* `fields` fehlt: dann nimmt die Karte nichts (anders als `elementTakes`). */
    const nimmt = (comp: string, key: string): boolean =>
      el.fields !== undefined && elementTakes(el, comp, key) && !genommen.has(`${comp}.${key}`);
    const name = this.bestand.name();
    const raus: NonNullable<Stueck['felder']> = [];
    for (const comp of typeChain(r, typ)) {
      if (SCHON_ANDERSWO.includes(comp)) continue;
      const karte = (e.components?.[comp] ?? {}) as Record<string, unknown>;
      for (const [key, prop] of Object.entries(r.interfaces[comp]?.schema?.properties ?? {})) {
        const wert = karte[key];
        const fehlt = wert === undefined || wert === null || wert === '';
        if ((fehlt && !leer) || prop.derived) continue;
        if (comp === 'Description' && key === 'description') continue;
        /* Das Bild zeichnet das Element `image`, nicht die Feldliste. */
        if (prop.format === 'asset' || comp === 'Image') continue;
        if (prop.many && prop.format === 'long') continue;
        if (!nimmt(comp, key)) continue;
        genommen.add(`${comp}.${key}`);
        if (fehlt) {
          raus.push({ ref: `${comp}.${key}`, label: fieldTitle(r, typ, { type: comp, key, prop }), wert: '—', lang: false });
          continue;
        }
        const text = Array.isArray(wert)
          ? wert.map((w) => (prop.format === 'link' ? (name(String(w)) ?? String(w)) : String(w))).join(', ')
          : typeof wert === 'boolean'
            ? wert
              ? 'yes'
              : 'no'
            : prop.format === 'link'
              ? (name(String(wert)) ?? String(wert))
              : typeof wert === 'object'
                ? JSON.stringify(wert)
                : /* Ein Mass in Einheiten wie auf der Seite (T-346): „60 ft", nicht „60". */
                  fieldText(r, prop, wert, unitsFor(r, typ)) || String(wert);
        raus.push({
          ref: `${comp}.${key}`,
          label: fieldTitle(r, typ, { type: comp, key, prop }),
          wert: text,
          lang: prop.format === 'long' && typeof wert === 'string',
        });
      }
    }
    return raus;
  }

  private prosa(e: Entity, r: Registry, typ: string, el: LayoutElement): NonNullable<Stueck['prosa']> {
    const raus: NonNullable<Stueck['prosa']> = [];
    for (const f of proseFields(r, typ)) {
      const ref = `${f.type}.${f.key}`;
      if (el.fields !== 'all' && !el.fields?.includes(ref) && !el.fields?.includes(f.type)) continue;
      if (el.except?.includes(ref)) continue;
      const karte = (e.components?.[f.type] ?? {}) as Record<string, unknown>;
      for (const eintrag of entriesOf(karte[f.key])) {
        raus.push({ ref: `${ref}#${eintrag.id}`, key: f.key, label: fieldTitle(r, typ, f), wert: eintrag.value });
      }
    }
    return raus;
  }

  /** Die Teile aus den Abschnittskanten (`RelationDef.section`), mit Namen aus `refs`. */
  private teile(e: Entity, r: Registry): NonNullable<Stueck['teile']> {
    const name = this.bestand.name();
    const je = new Map<string, { id: string; name: string | undefined }[]>();
    for (const rel of e.relations ?? []) {
      const abschnitt = r.relations[rel.type]?.section;
      if (!abschnitt) continue;
      (je.get(abschnitt) ?? je.set(abschnitt, []).get(abschnitt)!).push({ id: rel.to, name: name(rel.to) });
    }
    return [...je.entries()].map(([abschnitt, ziele]) => ({ abschnitt, ziele }));
  }
}

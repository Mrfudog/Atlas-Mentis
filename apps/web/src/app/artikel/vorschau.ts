import { Component, computed, effect, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { KurzLink } from '../kern/kurzansicht';
import {
  entityName,
  entriesOf,
  fieldTitle,
  layoutFor,
  primaryInterface,
  proseFields,
  typeChain,
} from '@nw/model';
import type { Entity, LayoutElement, Registry, VarScopes } from '@nw/model';
import { Bestand } from '../kern/bestand';
import { QuelleText } from '../kern/quellen';
import { Text } from './text';
import { Bild, bildDes } from './bild';

/** Was die Seitenspalte und die Überschrift schon sagen. */
const SCHON_ANDERSWO = ['Identity', 'Visibility', 'Source', 'Status', 'Tags'];

interface Stueck {
  kind: 'text' | 'felder' | 'prosa' | 'teile' | 'bild';
  key: string;
  bild?: { wert: string; caption: string; alt: string };
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
 * die Art für `quick` sagt (`layoutFor`) — der Statblock seine Felder und
 * seine Teile, ein Ort Bild, Beschreibung und Passagen. Kein Sonderfall je
 * Art. „Open article" führt zur Artikelseite (`full`).
 *
 * Dieselbe Karte steht im Popup der Kurzansicht (`nw-kurzpopup`, T-093) —
 * überall, wo ein Artikel genannt wird.
 */
@Component({
  selector: 'nw-vorschau',
  imports: [RouterLink, Text, QuelleText, KurzLink, Bild],
  template: `
    <aside class="vorschau" aria-label="Preview">
      <div class="vkopf">
        <span class="leg">Quick view</span>
        <button type="button" class="zu" (click)="zu.emit()" aria-label="Close preview">×</button>
      </div>
      @if (artikel(); as e) {
        <h2>{{ name(e) }}</h2>
        @if (meta(); as m) {
          <p class="meta">
            {{ m.art }}
            @if (m.quelle) {
              · <nw-quelle [text]="m.quelle" />
            }
          </p>
        }
        <div class="linie" aria-hidden="true"></div>
        @for (s of stuecke(); track s.key) {
          @switch (s.kind) {
            @case ('text') {
              <nw-text [text]="s.text!" [scopes]="scopes()" />
            }
            @case ('bild') {
              <nw-bild [wert]="s.bild!.wert" groesse="thumb" [caption]="s.bild!.caption" [alt]="s.bild!.alt || name(e)" />
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
        <div class="knoepfe">
          <a class="knopf pri" [routerLink]="e.interfaces[0] === 'Class' ? ['/classes', e.id] : ['/artikel', e.id]">Open article</a>
        </div>
      } @else if (bestand.fehlt().has(id())) {
        <p class="dim">No such article — or not one you may see.</p>
      } @else {
        <p class="dim">Loading…</p>
      }
    </aside>
  `,
  styles: `
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
  /** Auch holen, was auf ihn zeigt? Das Popup (T-093) zeigt es nicht und spart die Anfrage. */
  readonly rueck = input(true);
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
    /* Das Kürzel erklärt sich selbst (T-088). */
    return { art: r.interfaces[typ]?.label ?? typ, quelle };
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
    for (const el of flach(layoutFor(r, 'quick', typ).layout)) {
      if (el.el === 'image') {
        /* Die Karte zeigt die Vorschau (480 px); ein Klick öffnet das ganze Bild (T-114). */
        const bild = bildDes(e, r);
        if (bild) raus.push({ kind: 'bild', key: el.id, bild });
      } else if (el.el === 'description') {
        const d = (e.components?.['Description'] as { description?: string } | undefined)?.description;
        if (d) raus.push({ kind: 'text', key: el.id, text: d });
      } else if (el.el === 'fields') {
        const felder = this.felder(e, r, typ, el);
        if (felder.length) raus.push({ kind: 'felder', key: el.id, felder });
      } else if (el.el === 'prose') {
        const prosa = this.prosa(e, r, typ, el);
        if (prosa.length) raus.push({ kind: 'prosa', key: el.id, prosa });
      } else if (el.el === 'composed') {
        const teile = this.teile(e, r);
        if (teile.length) raus.push({ kind: 'teile', key: el.id, teile });
      }
    }
    return raus;
  });

  private felder(e: Entity, r: Registry, typ: string, el: LayoutElement): NonNullable<Stueck['felder']> {
    const nimmt = (comp: string, key: string): boolean => {
      if (el.except?.includes(comp) || el.except?.includes(`${comp}.${key}`)) return false;
      if (el.fields === 'all') return true;
      return !!el.fields?.includes(comp) || !!el.fields?.includes(`${comp}.${key}`);
    };
    const name = this.bestand.name();
    const raus: NonNullable<Stueck['felder']> = [];
    for (const comp of typeChain(r, typ)) {
      if (SCHON_ANDERSWO.includes(comp)) continue;
      const karte = (e.components?.[comp] ?? {}) as Record<string, unknown>;
      for (const [key, prop] of Object.entries(r.interfaces[comp]?.schema?.properties ?? {})) {
        const wert = karte[key];
        if (wert === undefined || wert === null || wert === '' || prop.derived) continue;
        if (comp === 'Description' && key === 'description') continue;
        /* Das Bild zeichnet das Element `image`, nicht die Feldliste. */
        if (prop.format === 'asset' || comp === 'Image') continue;
        if (prop.many && prop.format === 'long') continue;
        if (!nimmt(comp, key)) continue;
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
                : String(wert);
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

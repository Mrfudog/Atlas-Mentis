import { Component, computed, inject, input } from '@angular/core';
import {
  elementTakes,
  entriesOf,
  fieldTitle,
  layoutFor,
  primaryInterface,
  proseFields,
  typeChain,
} from '@nw/model';
import type { Entity, LayoutElement, Registry, VarScopes } from '@nw/model';
import { Bestand } from '../kern/bestand';
import { Text } from '../artikel/text';
import { Statblock } from '../artikel/statblock';
import { Zauber } from '../artikel/zauber';
import { Gegenstand } from '../artikel/gegenstand';
import { Kennzahlen } from '../artikel/kennzahlen';

/** Was die Kachel aus einem Element des Layouts macht. */
type Stueck =
  | { art: 'text'; id: string; text: string }
  | { art: 'felder'; id: string; zellen: { ref: string; label: string; wert: string }[] }
  | { art: 'prosa'; id: string; absaetze: { ref: string; label: string; text: string }[] }
  | { art: 'teile'; id: string; gruppen: { label: string; namen: string[] }[] }
  /* Wie im Buch (W2): der Baustein der Artikelseite, derselbe Satz. */
  | { art: 'statblock' | 'spell' | 'item'; id: string }
  /* Die Kennzahlen (T-206): AC, HP, Bewegung … als Kacheln. */
  | { art: 'stats'; id: string };

/* Was die Kachel nicht noch einmal zeigt: der Name steht im Kopf, Nummer,
   Sichtbarkeit und Quelle gehören auf die Artikelseite. */
const NICHT_AUF_DER_KACHEL = ['Identity', 'Visibility', 'Source'];

/**
 * Ein Artikel auf einer Kachel des Boards — in der Ansicht, die die Kachel
 * gewählt hat (`overview` oder `quick`, REQ-161).
 *
 * **Gezeichnet wird die Anordnung der Art** (`layoutFor`, die
 * `extends`-Kette hoch), nicht eine Vorlage je Artikelart: ein Statblock
 * zeigt auf der Karte seine Zahlen, weil er es an sich sagt, und eine Szene
 * ihren Absatz, weil die Grundanordnung von `quick` es sagt. Was ein
 * Element verlangt, das hier noch keine Form hat (der Bogen, die Karte),
 * bleibt weg — auf der Kachel liest man, bearbeitet wird auf der
 * Artikelseite.
 *
 * Zurückgehalten hat der Server (`redactEntity`); was ankommt, steht da.
 */
@Component({
  selector: 'nw-kachel',
  imports: [Text, Statblock, Zauber, Gegenstand, Kennzahlen],
  template: `
    @for (s of stuecke(); track s.id) {
      @switch (s.art) {
        @case ('text') {
          <nw-text class="satz" [text]="s.text" [scopes]="scopes()" />
        }
        @case ('felder') {
          <dl class="werte">
            @for (z of s.zellen; track z.ref) {
              <div>
                <dt>{{ z.label }}</dt>
                <dd>{{ z.wert }}</dd>
              </div>
            }
          </dl>
        }
        @case ('prosa') {
          @for (a of s.absaetze; track a.ref) {
            <nw-text class="prosa" [text]="a.text" [scopes]="scopes()" />
          }
        }
        @case ('statblock') {
          <nw-statblock [artikel]="artikel()" />
        }
        @case ('stats') {
          <nw-kennzahlen [artikel]="artikel()" />
        }
        @case ('spell') {
          <nw-zauber [artikel]="artikel()" [scopes]="scopes()" />
        }
        @case ('item') {
          <nw-gegenstand [artikel]="artikel()" />
        }
        @case ('teile') {
          @for (g of s.gruppen; track g.label) {
            <p class="teile"><b>{{ g.label }}.</b> {{ g.namen.join(', ') }}</p>
          }
        }
      }
    } @empty {
      <p class="leer">Nothing to show in this view.</p>
    }
  `,
  styles: `
    :host {
      display: block;
      font-size: 0.9rem;
      line-height: 1.35;
    }
    .satz,
    .prosa {
      display: block;
      margin: 0 0 0.35rem;
    }
    :host ::ng-deep .satz p,
    :host ::ng-deep .prosa p {
      margin: 0 0 0.35rem;
    }
    .werte {
      display: flex;
      flex-wrap: wrap;
      gap: 0.1rem 0.75rem;
      margin: 0 0 0.35rem;
    }
    .werte div {
      display: flex;
      gap: 0.3rem;
    }
    dt {
      color: var(--dim);
    }
    dd {
      margin: 0;
      font-weight: 600;
    }
    .teile {
      margin: 0 0 0.25rem;
    }
    .leer {
      margin: 0;
      color: var(--dim);
      font-style: italic;
    }
  `,
})
export class Kachel {
  readonly artikel = input.required<Entity>();
  readonly ansicht = input.required<string>();
  /** Ein anderes Register als das geladene — der Entwurf in der Vorschau des Registers (T-110). */
  readonly register = input<Registry | null>(null);

  private readonly bestand = inject(Bestand);
  private readonly reg = computed(() => this.register() ?? this.bestand.registry());

  protected readonly scopes = computed<VarScopes>(() => {
    const vars = this.artikel().components?.['Vars'] as
      | { bindings?: Record<string, string> }
      | undefined;
    return { entity: vars?.bindings, campaign: this.reg()?.vars };
  });

  protected readonly stuecke = computed<Stueck[]>(() => {
    const r = this.reg();
    const e = this.artikel();
    if (!r) return [];
    const typ = primaryInterface(e);
    const view = r.views[this.ansicht()];
    /* Was die Ansicht sagt (T-110): leere Felder zeigen, Ungenanntes am Ende. */
    const opt = { leer: view?.empty === 'show', genommen: new Set<string>() };
    const out: Stueck[] = [];
    for (const el of layoutFor(r, this.ansicht(), typ).layout) {
      const s = this.stueck(r, e, typ, el, opt);
      if (s) out.push(s);
    }
    if (view?.rest) {
      const s = this.stueck(r, e, typ, { id: 'rest-f', el: 'fields', fields: 'all' }, opt);
      if (s) out.push(s);
    }
    return out;
  });

  private stueck(
    r: Registry,
    e: Entity,
    typ: string,
    el: LayoutElement,
    opt: { leer: boolean; genommen: Set<string> },
  ): Stueck | null {
    switch (el.el) {
      case 'description': {
        const d = (e.components?.['Description'] as { description?: string } | undefined)
          ?.description;
        return d ? { art: 'text', id: el.id, text: d } : null;
      }
      case 'fields': {
        const zellen = this.zellen(r, e, typ, el, opt);
        return zellen.length ? { art: 'felder', id: el.id, zellen } : null;
      }
      case 'prose': {
        const absaetze = proseFields(r, typ)
          .filter((f) => el.fields !== undefined && elementTakes(el, f.type, f.key))
          .flatMap((f) =>
            entriesOf((e.components?.[f.type] as Record<string, unknown> | undefined)?.[f.key]).map(
              (x) => ({
                ref: `${f.type}.${f.key}#${x.id}`,
                label: fieldTitle(r, typ, f),
                text: x.value,
              }),
            ),
          );
        return absaetze.length ? { art: 'prosa', id: el.id, absaetze } : null;
      }
      case 'composed': {
        /* Woraus der Artikel besteht (Merkmale, Aktionen) — als Namen, je
           Abschnitt der Kante. Die Zahlen darin stehen auf der Seite. */
        /* Die Namen brachte der Artikel mit (`refs`, W7). */
        const nameVon = this.bestand.name();
        const gruppen = new Map<string, string[]>();
        for (const rel of e.relations ?? []) {
          const abschnitt = r.relations[rel.type]?.section;
          if (!abschnitt) continue;
          const name = nameVon(rel.to);
          if (name) gruppen.set(abschnitt, [...(gruppen.get(abschnitt) ?? []), name]);
        }
        return gruppen.size
          ? { art: 'teile', id: el.id, gruppen: [...gruppen].map(([label, namen]) => ({ label, namen })) }
          : null;
      }
      case 'statblock':
      case 'spell':
      case 'item':
      case 'stats':
        return { art: el.el, id: el.id };
      default:
        return null;
    }
  }

  /** Die Werte, die dieses Element zeigt — in der Reihenfolge der Art. */
  private zellen(
    r: Registry,
    e: Entity,
    typ: string,
    el: LayoutElement,
    opt: { leer: boolean; genommen: Set<string> },
  ): { ref: string; label: string; wert: string }[] {
    const out: { ref: string; label: string; wert: string }[] = [];
    for (const comp of typeChain(r, typ)) {
      if (NICHT_AUF_DER_KACHEL.includes(comp)) continue;
      const karte = (e.components?.[comp] as Record<string, unknown> | undefined) ?? (opt.leer ? {} : undefined);
      if (!karte) continue;
      for (const [prop, schema] of Object.entries(r.interfaces[comp]?.schema?.properties ?? {})) {
        if (el.fields === undefined || !elementTakes(el, comp, prop) || opt.genommen.has(`${comp}.${prop}`)) continue;
        /* Die Beschreibung steht als Satz, ein Prosafeld als Absatz — nicht
           noch einmal als Wert. */
        if (comp === 'Description' || (schema.many && schema.format === 'long')) continue;
        const roh = alsText(karte[prop]);
        if (!roh && (!opt.leer || schema.derived)) continue;
        const wert = roh || '—';
        opt.genommen.add(`${comp}.${prop}`);
        out.push({
          ref: `${comp}.${prop}`,
          label: fieldTitle(r, typ, { type: comp, key: prop, prop: schema }),
          wert,
        });
      }
    }
    return out;
  }
}

function alsText(wert: unknown): string {
  if (wert === null || wert === undefined || wert === '') return '';
  if (Array.isArray(wert)) return wert.map(alsText).filter(Boolean).join(', ');
  if (typeof wert === 'object') return '';
  if (typeof wert === 'boolean') return wert ? 'yes' : '';
  return String(wert);
}

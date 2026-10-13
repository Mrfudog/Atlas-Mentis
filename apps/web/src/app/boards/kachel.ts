import { Component, computed, inject, input } from '@angular/core';
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
import { Text } from '../artikel/text';

/** Was die Kachel aus einem Element des Layouts macht. */
type Stueck =
  | { art: 'text'; id: string; text: string }
  | { art: 'felder'; id: string; zellen: { ref: string; label: string; wert: string }[] }
  | { art: 'prosa'; id: string; absaetze: { ref: string; label: string; text: string }[] }
  | { art: 'teile'; id: string; gruppen: { label: string; namen: string[] }[] };

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
  imports: [Text],
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

  private readonly bestand = inject(Bestand);

  protected readonly scopes = computed<VarScopes>(() => {
    const vars = this.artikel().components?.['Vars'] as
      | { bindings?: Record<string, string> }
      | undefined;
    return { entity: vars?.bindings, campaign: this.bestand.registry()?.vars };
  });

  protected readonly stuecke = computed<Stueck[]>(() => {
    const r = this.bestand.registry();
    const e = this.artikel();
    if (!r) return [];
    const typ = primaryInterface(e);
    const out: Stueck[] = [];
    for (const el of layoutFor(r, this.ansicht(), typ).layout) {
      const s = this.stueck(r, e, typ, el);
      if (s) out.push(s);
    }
    return out;
  });

  private stueck(r: Registry, e: Entity, typ: string, el: LayoutElement): Stueck | null {
    switch (el.el) {
      case 'description': {
        const d = (e.components?.['Description'] as { description?: string } | undefined)
          ?.description;
        return d ? { art: 'text', id: el.id, text: d } : null;
      }
      case 'fields': {
        const zellen = this.zellen(r, e, typ, el);
        return zellen.length ? { art: 'felder', id: el.id, zellen } : null;
      }
      case 'prose': {
        const absaetze = proseFields(r, typ)
          .filter((f) => waehlt(el, f.type, f.key))
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
        const byId = this.bestand.byId();
        const gruppen = new Map<string, string[]>();
        for (const rel of e.relations ?? []) {
          const abschnitt = r.relations[rel.type]?.section;
          if (!abschnitt) continue;
          const name = entityName(byId.get(rel.to));
          if (name) gruppen.set(abschnitt, [...(gruppen.get(abschnitt) ?? []), name]);
        }
        return gruppen.size
          ? { art: 'teile', id: el.id, gruppen: [...gruppen].map(([label, namen]) => ({ label, namen })) }
          : null;
      }
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
  ): { ref: string; label: string; wert: string }[] {
    const out: { ref: string; label: string; wert: string }[] = [];
    for (const comp of typeChain(r, typ)) {
      if (NICHT_AUF_DER_KACHEL.includes(comp)) continue;
      const karte = e.components?.[comp] as Record<string, unknown> | undefined;
      if (!karte) continue;
      for (const [prop, schema] of Object.entries(r.interfaces[comp]?.schema?.properties ?? {})) {
        if (!waehlt(el, comp, prop)) continue;
        /* Die Beschreibung steht als Satz, ein Prosafeld als Absatz — nicht
           noch einmal als Wert. */
        if (comp === 'Description' || (schema.many && schema.format === 'long')) continue;
        const wert = alsText(karte[prop]);
        if (!wert) continue;
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

/** Nimmt dieses Element (`fields`/`prose`) das Feld `typ.feld`? */
function waehlt(el: LayoutElement, typ: string, feld: string): boolean {
  const weg = el.except ?? [];
  if (weg.includes(typ) || weg.includes(`${typ}.${feld}`)) return false;
  if (el.fields === 'all') return true;
  if (!Array.isArray(el.fields)) return false;
  return el.fields.includes(typ) || el.fields.includes(`${typ}.${feld}`);
}

function alsText(wert: unknown): string {
  if (wert === null || wert === undefined || wert === '') return '';
  if (Array.isArray(wert)) return wert.map(alsText).filter(Boolean).join(', ');
  if (typeof wert === 'object') return '';
  if (typeof wert === 'boolean') return wert ? 'yes' : '';
  return String(wert);
}

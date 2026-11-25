/**
 * **Zwei Artikel nebeneinander** (T-173, Punkt 3).
 *
 * Links der Artikel im Spiel, rechts die Fassung — alle Felder und Kanten,
 * auch gleiche, denn „gleich" ist eine Auskunft. Unterschiede sind
 * markiert (Farbe und Zeichen), lange Texte stehen Zeile für Zeile wie in
 * einem Git-Vergleich (`lineDiff`). Die Komponente `nw-vergleich` nimmt
 * zwei beliebige Artikel und ihre Überschriften und weiss nichts von
 * Fassungen: die Übertragung dev → prod (T-130) stellt mit ihr zwei Stände
 * desselben Artikels gegeneinander. Gerechnet wird im Modell
 * (`compareRows`); hier steht nur, wie es aussieht.
 */

import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LAYER_RELATION, OVERRIDES_RELATION, VARIANT_RELATION, compareRows, entityName, layersOf, lineDiff } from '@nw/model';
import type { CompareState, DiffLine, Entity } from '@nw/model';
import { Api, type Fassungen } from '../kern/api';
import { Bestand } from '../kern/bestand';
import { geltendeFassung, wertText } from './fassungen';

/** Eine Zeile im Zeilenvergleich nebeneinander: links und rechts, eines davon darf fehlen. */
export interface ZeilenPaar {
  l?: DiffLine;
  r?: DiffLine;
}

/**
 * **Ein Zeilenvergleich in zwei Spalten** — gleiche Zeilen stehen auf
 * beiden Seiten, ein Block aus Weg und Dazu steht Zeile neben Zeile. So
 * liest es sich wie die geteilte Ansicht eines Git-Vergleichs.
 */
export function nebeneinander(zeilen: readonly DiffLine[]): ZeilenPaar[] {
  const out: ZeilenPaar[] = [];
  let weg: DiffLine[] = [];
  let dazu: DiffLine[] = [];
  const leeren = () => {
    for (let i = 0; i < Math.max(weg.length, dazu.length); i++) out.push({ l: weg[i], r: dazu[i] });
    weg = [];
    dazu = [];
  };
  for (const z of zeilen) {
    if (z.op === 'same') {
      leeren();
      out.push({ l: z, r: z });
    } else if (z.op === 'del') weg.push(z);
    else dazu.push(z);
  }
  leeren();
  return out;
}

const ZEICHEN: Record<CompareState, string> = { same: '=', changed: '≠', onlyLeft: '−', onlyRight: '+' };
const WORT: Record<CompareState, string> = {
  same: 'same',
  changed: 'differs',
  onlyLeft: 'only left',
  onlyRight: 'only right',
};

interface Zeile {
  ref: string;
  gruppe: string;
  label: string;
  state: CompareState;
  meta: boolean;
  links: string;
  rechts: string;
  /** Ein langer Text, der abweicht: Zeile für Zeile. */
  paare: ZeilenPaar[] | null;
}

@Component({
  selector: 'nw-vergleich',
  template: `
    <div class="kopf">
      <label class="nur">
        <input type="checkbox" [checked]="nurUnterschiede()" (change)="nurUnterschiede.set($any($event.target).checked)" />
        <span>Only differences</span>
      </label>
      <span class="zahl" role="status">{{ zusammenfassung() }}</span>
    </div>
    <div class="tabelle" role="table" [attr.aria-label]="'Compare ' + linksTitel() + ' with ' + rechtsTitel()">
      <div class="zeile titel" role="row">
        <span role="columnheader" class="feld">Field</span>
        <span role="columnheader" class="seite">{{ linksTitel() }}</span>
        <span role="columnheader" class="seite">{{ rechtsTitel() }}</span>
      </div>
      @for (z of sichtbar(); track z.ref) {
        <div class="zeile" role="row" [class]="'zeile ' + z.state" [class.meta]="z.meta">
          <span role="rowheader" class="feld">
            <span class="zeichen" [attr.aria-label]="wort(z.state)" [title]="wort(z.state)">{{ zeichen(z.state) }}</span>
            <span>{{ z.label }}</span>
            <span class="gruppe">{{ z.gruppe }}</span>
          </span>
          @if (z.paare; as paare) {
            <div class="diff" role="cell">
              @for (p of paare; track $index) {
                <span class="dz" [class]="'dz ' + (p.l?.op ?? 'leer')">{{ p.l?.text ?? '' }}</span>
                <span class="dz" [class]="'dz ' + (p.r?.op ?? 'leer')">{{ p.r?.text ?? '' }}</span>
              }
            </div>
          } @else {
            <span role="cell" class="seite links" [attr.data-seite]="linksKurz()">
              @if (z.links) {
                {{ z.links }}
              } @else {
                <span class="dim">— not set</span>
              }
            </span>
            <span role="cell" class="seite rechts" [attr.data-seite]="rechtsKurz()">
              @if (z.rechts) {
                {{ z.rechts }}
              } @else {
                <span class="dim">— not set</span>
              }
            </span>
          }
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      font-family: var(--sans);
    }
    .kopf {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem 1.25rem;
      align-items: center;
      margin-bottom: 0.5rem;
    }
    .nur {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      min-height: 40px;
    }
    .zahl {
      color: var(--dim);
    }
    .tabelle {
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--surface);
    }
    .zeile {
      display: grid;
      grid-template-columns: minmax(8rem, 0.8fr) 1fr 1fr;
      gap: 0.25rem 0.75rem;
      padding: 0.4rem 0.6rem;
      border-top: 1px solid var(--line2);
      overflow-wrap: anywhere;
    }
    .zeile.titel {
      border-top: 0;
      font-weight: 700;
      background: var(--bar);
      border-radius: 6px 6px 0 0;
    }
    /* Abweichendes: Balken in Gold, gleich gedämpft (Farbe und Zeichen). */
    .zeile.changed,
    .zeile.onlyLeft,
    .zeile.onlyRight {
      border-left: 4px solid var(--gold);
      background: var(--hover);
    }
    .zeile.same {
      color: var(--dim);
    }
    .zeile.meta.changed,
    .zeile.meta.onlyLeft,
    .zeile.meta.onlyRight {
      border-left: 4px dashed var(--line);
      background: transparent;
    }
    .feld {
      display: flex;
      flex-wrap: wrap;
      gap: 0.15rem 0.4rem;
      align-items: baseline;
      font-weight: 600;
    }
    .gruppe {
      font-weight: 400;
      font-size: 0.75rem;
      color: var(--dim);
    }
    .zeichen {
      display: inline-block;
      min-width: 1.2rem;
      text-align: center;
      font-weight: 700;
      color: var(--gold);
    }
    .same .zeichen {
      color: var(--dim);
    }
    .dim {
      color: var(--dim);
    }
    .diff {
      grid-column: 2 / 4;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0 0.75rem;
      font-family: var(--serif);
      font-size: 0.92rem;
    }
    .dz {
      white-space: pre-wrap;
      padding: 0 0.3rem;
      min-height: 1.2em;
    }
    .dz.del {
      background: color-mix(in srgb, var(--warn) 18%, transparent);
      text-decoration: line-through;
      text-decoration-color: var(--warn);
    }
    .dz.del::before {
      content: '− ';
      color: var(--warn);
    }
    .dz.add {
      background: color-mix(in srgb, var(--sub-4) 20%, transparent);
    }
    .dz.add::before {
      content: '+ ';
      color: var(--sub-4);
    }
    .dz.same {
      color: var(--dim);
    }
    /* Am Telefon untereinander: der Name des Feldes, dann beide Seiten mit ihrem Kürzel. */
    @media (max-width: 600px) {
      .zeile {
        grid-template-columns: 1fr;
      }
      .zeile.titel {
        display: none;
      }
      .seite::before {
        content: attr(data-seite) ': ';
        font-weight: 700;
        color: var(--dim);
      }
      .diff {
        grid-column: 1;
      }
    }
  `,
})
export class Vergleich {
  readonly links = input.required<Entity>();
  readonly rechts = input.required<Entity>();
  readonly linksTitel = input<string>('Left');
  readonly rechtsTitel = input<string>('Right');
  /** Kurz vor jedem Wert am Telefon, wo die Spalten untereinander stehen. */
  readonly linksKurz = input<string>('Left');
  readonly rechtsKurz = input<string>('Right');

  private readonly bestand = inject(Bestand);
  protected readonly nurUnterschiede = signal(false);

  protected readonly zeilen = computed<Zeile[]>(() => {
    const r = this.bestand.registry();
    if (!r) return [];
    const name = this.bestand.name();
    const z = compareRows(r, this.links(), this.rechts());
    const typLabel = (t: string) => r.interfaces[t]?.label ?? t;
    const felder: Zeile[] = z.fields.map((f) => {
      const links = wertText(r, f.type, f.key, f.left, name);
      const rechts = wertText(r, f.type, f.key, f.right, name);
      return {
        ref: f.ref,
        gruppe: typLabel(f.type),
        label: f.label,
        state: f.state,
        meta: f.meta,
        links,
        rechts,
        paare: f.long && f.state === 'changed' ? nebeneinander(lineDiff(links, rechts)) : null,
      };
    });
    const kanten: Zeile[] = z.relations.map((k) => ({
      ref: `→${k.type}`,
      gruppe: 'Edge',
      label: k.label,
      state: k.state,
      /* Wo und was ein Artikel ist, nicht was er sagt — wie `versionDiff`. */
      meta: k.type === LAYER_RELATION || k.type === VARIANT_RELATION || k.type === OVERRIDES_RELATION,
      links: k.left.map((id) => name(id) ?? id).join(', '),
      rechts: k.right.map((id) => name(id) ?? id).join(', '),
      paare: null,
    }));
    /* Erst was der Artikel sagt, dann Name, Quelle und Ebene — die stehen an jeder Fassung anders. */
    const alle = [...felder, ...kanten];
    return [...alle.filter((z) => !z.meta), ...alle.filter((z) => z.meta)];
  });

  protected readonly sichtbar = computed(() =>
    this.nurUnterschiede() ? this.zeilen().filter((z) => z.state !== 'same') : this.zeilen(),
  );

  protected readonly zusammenfassung = computed(() => {
    const alle = this.zeilen();
    const sache = alle.filter((z) => !z.meta && z.state !== 'same').length;
    const meta = alle.filter((z) => z.meta && z.state !== 'same').length;
    if (!sache) return meta ? 'Same text and values — only name, source or layer differ.' : 'Same text and values.';
    return `${sache} ${sache === 1 ? 'difference' : 'differences'} in text, values or edges${meta ? `, plus ${meta} in name, source or layer` : ''}.`;
  });

  protected zeichen(s: CompareState): string {
    return ZEICHEN[s];
  }
  protected wort(s: CompareState): string {
    return WORT[s];
  }
}

/**
 * **Die Seite „Compare"** (T-173): `/artikel/:id/compare/:other`. Links
 * der Artikel, von dem man kam, rechts die gewählte Fassung; oben die
 * Wahl, wenn es mehr als eine gibt, und welche am Tisch gilt.
 */
@Component({
  selector: 'nw-fassungs-vergleich',
  imports: [RouterLink, Vergleich],
  template: `
    <div class="seite">
      <a [routerLink]="['/artikel', id()]">← Back to the article</a>
      @if (links(); as l) {
        <h1>Compare versions of {{ name(l) }}</h1>
        @if (geltend(); as g) {
          <p class="geltend">{{ g.satz }}</p>
        }
        @if ((fassungen()?.versions?.length ?? 0) > 1) {
          <nav class="wahl" aria-label="Versions">
            @for (v of fassungen()!.versions; track v.entity.id) {
              <a [routerLink]="['/artikel', id(), 'compare', v.entity.id]" [class.aktiv]="v.entity.id === other()">
                {{ kurzVon(v.entity) }} · {{ name(v.entity) }}
              </a>
            }
          </nav>
        }
        @if (rechts(); as r) {
          <nw-vergleich
            [links]="l"
            [rechts]="r"
            [linksTitel]="kurzVon(l) + ' — ' + name(l)"
            [rechtsTitel]="kurzVon(r) + ' — ' + name(r)"
            [linksKurz]="kurzVon(l)"
            [rechtsKurz]="kurzVon(r)"
          />
        } @else if (bestand.fehlt().has(other())) {
          <p class="leer">That version is not here, or not for you.</p>
        } @else {
          <p class="leer">Loading…</p>
        }
      } @else if (bestand.fehlt().has(id())) {
        <p class="leer">This article is not here, or not for you.</p>
      } @else {
        <p class="leer">Loading…</p>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      padding: 1rem;
    }
    .seite {
      max-width: 72rem;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    h1 {
      margin: 0;
      font-family: var(--caps);
      color: var(--heading);
      overflow-wrap: anywhere;
    }
    .geltend {
      margin: 0;
      padding: 0.4rem 0.6rem;
      background: var(--hover);
      border-left: 4px solid var(--gold);
      border-radius: 4px;
    }
    .wahl {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
    }
    .wahl a {
      padding: 0.2rem 0.6rem;
      border: 1px solid var(--line);
      border-radius: 4px;
      min-height: 32px;
      display: inline-flex;
      align-items: center;
    }
    .wahl a.aktiv {
      border-color: var(--gold);
      background: var(--hover);
      font-weight: 700;
    }
    .leer {
      color: var(--dim);
    }
    @media (max-width: 600px) {
      :host {
        padding: 0.5rem;
      }
    }
  `,
})
export class FassungsVergleich {
  readonly id = input.required<string>();
  readonly other = input.required<string>();

  protected readonly bestand = inject(Bestand);
  private readonly api = inject(Api);
  protected readonly fassungen = signal<Fassungen | null>(null);

  constructor() {
    void this.bestand.load();
    effect(() => {
      const id = this.id();
      void this.bestand.oeffnen(id, false, false);
      this.api
        .versions(id)
        .then((f) => this.fassungen.set(f))
        .catch(() => this.fassungen.set(null));
    });
    effect(() => {
      void this.bestand.oeffnen(this.other(), false, false);
    });
  }

  protected readonly links = computed(() => this.bestand.voll().get(this.id()));
  protected readonly rechts = computed(() => this.bestand.voll().get(this.other()));
  protected readonly geltend = computed(() => geltendeFassung(this.links() ?? null, this.fassungen()));

  protected name(e: Entity): string {
    return entityName(e);
  }

  /** Das Kürzel der ersten Ebene eines Artikels — wie an den Feldern. */
  protected kurzVon(e: Entity): string {
    const f = this.fassungen();
    const l = layersOf(e)[0];
    return (l && f?.layers.find((x) => x.id === l)?.short) || '—';
  }
}

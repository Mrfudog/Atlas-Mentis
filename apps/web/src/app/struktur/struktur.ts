import { Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { mergeStructure, netLayout } from '@nw/model';
import type { StructureLayout, StructureLink, StructureNode } from '@nw/model';
import { Api, ApiError, type StrukturAntwort } from '../kern/api';
import { Bestand } from '../kern/bestand';
import { Live } from '../kern/live';
import { KurzLink } from '../kern/kurzansicht';

/** Ein Knoten im Baum, mit dem, was darunter hängt. */
interface Ast {
  node: StructureNode;
  /** Die Linie von oben: Beschriftung und ob sie hinauf zeigt. */
  von: StructureLink | null;
  kinder: Ast[];
  /** Was quer läuft: Beziehungen zu Knoten, die anderswo im Baum stehen. */
  quer: { link: StructureLink; andere: StructureNode; zurueck: boolean }[];
}

/** Das Netz, gerechnet: Lage der Knoten, Linien mit Mitte für die Beschriftung. */
interface Netz {
  box: string;
  knoten: { node: StructureNode; x: number; y: number }[];
  linien: { link: StructureLink; x1: number; y1: number; x2: number; y2: number; mx: number; my: number }[];
}

const RING = 150;

/**
 * **Die Struktur** (T-341): eine Fraktion, ein Ort, eine Familie als
 * Organigramm (Baum) oder Beziehungsnetz — dieselbe Komponente auf der
 * Kachel „Structure" des Boards und im Element `structure` einer Ansicht.
 *
 * Gerechnet am Server (`GET /api/structure/:id`, gesiebt je Betrachter):
 * was hier ankommt, darf angezeigt werden, und was fehlt, fehlt für
 * diesen Betrachter. Ein Knoten zeigt seine Kurzansicht beim Klick
 * (`nwQuick`), klappt im Baum auf und zu, und **„+" holt, was hinter der
 * Tiefe liegt** — ein Schritt von diesem Knoten aus, dazugelegt. Die
 * Linien tragen die Marken der Beziehung (`regards.tags`) oder den Rang
 * (`memberOf.rank`); die Gegenrichtung ist eine eigene Linie
 * (docs/Beziehungen.md).
 *
 * Geladen wird sie erst, wenn sie zu sehen ist (`@defer` an Board und
 * Ansichtsbaum, T-348): das Startpaket bleibt, wie es ist.
 */
@Component({
  selector: 'nw-struktur',
  imports: [NgTemplateOutlet, RouterLink, KurzLink],
  template: `
    <ng-template #astT let-a>
      <li [attr.data-knoten]="a.node.id">
        <div class="zeile">
          @if (a.kinder.length) {
            <button
              type="button"
              class="klapp"
              [attr.aria-expanded]="!zu().has(a.node.id)"
              [attr.aria-label]="(zu().has(a.node.id) ? 'Expand ' : 'Collapse ') + a.node.name"
              (click)="umklappen(a.node.id)"
            >{{ zu().has(a.node.id) ? '▸' : '▾' }}</button>
          } @else {
            <span class="klapp leer" aria-hidden="true"></span>
          }
          @if (a.von; as l) {
            <span class="marke" [class.hoch]="l.up" [title]="l.note || l.type">{{ l.up ? '↑ ' : '' }}{{ l.labels.join(', ') }}</span>
          }
          <a class="name" [routerLink]="['/artikel', a.node.id]" [nwQuick]="a.node.id">{{ a.node.name }}</a>
          <span class="art">{{ typLabel(a.node.type) }}</span>
          @if (a.node.more) {
            <button type="button" class="mehr" [disabled]="holt() === a.node.id" [attr.aria-label]="'Show more around ' + a.node.name" title="Show what lies beyond" (click)="mehr(a.node.id)">+</button>
          }
        </div>
        @if (a.quer.length && !zu().has(a.node.id)) {
          <ul class="quer">
            @for (q of a.quer; track q.link.id) {
              <li>
                <span class="pfeil" aria-hidden="true">{{ q.zurueck ? '↩' : '→' }}</span>
                <a [routerLink]="['/artikel', q.andere.id]" [nwQuick]="q.andere.id">{{ q.andere.name }}</a>
                <span class="marke" [title]="q.link.note || q.link.type">{{ q.link.labels.join(', ') }}</span>
              </li>
            }
          </ul>
        }
        @if (a.kinder.length && !zu().has(a.node.id)) {
          <ul class="kinder">
            @for (k of a.kinder; track k.node.id) {
              <ng-container *ngTemplateOutlet="astT; context: { $implicit: k }" />
            }
          </ul>
        }
      </li>
    </ng-template>

    @if (fehler(); as f) {
      <p class="fehler" role="alert">{{ f }}</p>
    } @else if (graph(); as g) {
      <div class="kopf">
        <div class="form" role="group" aria-label="Show as">
          <button type="button" [class.an]="form() === 'tree'" [attr.aria-pressed]="form() === 'tree'" (click)="formWahl.set('tree')">Tree</button>
          <button type="button" [class.an]="form() === 'net'" [attr.aria-pressed]="form() === 'net'" (click)="formWahl.set('net')">Web</button>
        </div>
        <span class="dim">{{ g.nodes.length }} shown{{ g.truncated ? ' — there is more' : '' }}</span>
        <button type="button" class="neu" aria-label="Reload the structure" title="Reload" (click)="laden()">↻</button>
      </div>
      @if (g.nodes.length < 2) {
        <p class="leer">Nothing linked yet — or nothing you may see. Members, parts, what it controls and who regards whom show here.</p>
      }
      @if (form() === 'tree') {
        @if (baum(); as b) {
          <ul class="baum" role="tree" [attr.aria-label]="'Structure of ' + b.node.name">
            <ng-container *ngTemplateOutlet="astT; context: { $implicit: b }" />
          </ul>
        }
      } @else {
        @if (netz(); as n) {
          <div class="netz">
            <svg [attr.viewBox]="n.box" role="img" [attr.aria-label]="'Relationship web of ' + (baum()?.node?.name ?? '')">
              <defs>
                <marker id="nw-pfeil" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" class="spitze" />
                </marker>
              </defs>
              @for (l of n.linien; track l.link.id) {
                <line [attr.x1]="l.x1" [attr.y1]="l.y1" [attr.x2]="l.x2" [attr.y2]="l.y2" [class.quer]="!l.link.tree" marker-end="url(#nw-pfeil)" />
                <text class="lbl" [attr.x]="l.mx" [attr.y]="l.my" text-anchor="middle">{{ l.link.labels.join(', ') }}</text>
              }
              @for (k of n.knoten; track k.node.id) {
                <g class="kn" [class.wurzel]="k.node.depth === 0" [attr.transform]="'translate(' + k.x + ',' + k.y + ')'">
                  <circle r="9" [nwQuick]="k.node.id" tabindex="0" [attr.aria-label]="k.node.name" />
                  <text y="24" text-anchor="middle">{{ k.node.name }}</text>
                  @if (k.node.more) {
                    <text class="plus" x="14" y="-8" (click)="mehr(k.node.id)" (keydown.enter)="mehr(k.node.id)" tabindex="0" role="button" [attr.aria-label]="'Show more around ' + k.node.name">+</text>
                  }
                </g>
              }
            </svg>
          </div>
        }
      }
    } @else {
      <p class="laedt">Loading…</p>
    }
  `,
  styles: `
    :host { display: block; font-size: 0.9rem; }
    .kopf { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; margin-bottom: 0.4rem; }
    .form { display: inline-flex; border: 1px solid var(--line2, #c9b98f); border-radius: 4px; overflow: hidden; }
    .form button { border: 0; background: none; padding: 0.15rem 0.6rem; font: inherit; cursor: pointer; }
    .form button.an { background: var(--accent-soft, #e7dcc0); font-weight: 600; }
    .neu { border: 0; background: none; cursor: pointer; font: inherit; margin-left: auto; }
    .dim, .art { opacity: 0.7; }
    .art { font-size: 0.8em; }
    .leer, .laedt { opacity: 0.75; }
    .fehler { color: var(--danger, #8b2e1f); }
    ul { list-style: none; margin: 0; padding: 0; }
    .kinder { margin-left: 0.7rem; padding-left: 0.8rem; border-left: 1px solid var(--line2, #c9b98f); }
    .kinder > li { position: relative; }
    .kinder > li::before { content: ''; position: absolute; left: -0.8rem; top: 0.95em; width: 0.7rem; border-top: 1px solid var(--line2, #c9b98f); }
    .zeile { display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: baseline; padding: 0.1rem 0; }
    .klapp { width: 1.2rem; border: 0; background: none; cursor: pointer; padding: 0; font: inherit; }
    .klapp.leer { display: inline-block; }
    .name { font-weight: 600; }
    .marke { font-size: 0.8em; border: 1px solid var(--line2, #c9b98f); border-radius: 999px; padding: 0 0.4rem; }
    .marke.hoch { font-style: italic; }
    .mehr { border: 1px solid var(--line2, #c9b98f); border-radius: 4px; background: none; cursor: pointer; padding: 0 0.35rem; font: inherit; line-height: 1.2; }
    .quer { margin: 0 0 0.2rem 1.6rem; font-size: 0.85em; }
    .quer li { display: flex; flex-wrap: wrap; gap: 0.3rem; align-items: baseline; }
    .netz { overflow: auto; }
    svg { width: 100%; height: auto; min-height: 16rem; display: block; }
    line { stroke: var(--ink, #3b2f1e); stroke-width: 1.2; opacity: 0.55; }
    line.quer { stroke-dasharray: 4 3; }
    .spitze { fill: var(--ink, #3b2f1e); opacity: 0.55; }
    .lbl { font-size: 10px; fill: var(--ink, #3b2f1e); paint-order: stroke; stroke: var(--paper, #f4ecd8); stroke-width: 3px; }
    .kn circle { fill: var(--paper, #f4ecd8); stroke: var(--ink, #3b2f1e); stroke-width: 1.5; cursor: pointer; }
    .kn.wurzel circle { fill: var(--accent-soft, #e7dcc0); stroke-width: 2.5; }
    .kn text { font-size: 11px; fill: var(--ink, #3b2f1e); paint-order: stroke; stroke: var(--paper, #f4ecd8); stroke-width: 3px; }
    .kn .plus { font-weight: 700; cursor: pointer; font-size: 14px; }
  `,
})
export class Struktur {
  /** Der Startartikel. */
  readonly wurzel = input.required<string>();
  /** Welche Kanten; leer: die Vorgabe des Servers. */
  readonly kanten = input<readonly string[]>([]);
  readonly tiefe = input<number | undefined>(undefined);
  /** Baum oder Netz, wie gespeichert — umschalten geht hier, ohne zu speichern. */
  readonly form0 = input<StructureLayout>('tree', { alias: 'form' });

  private readonly api = inject(Api);
  private readonly bestand = inject(Bestand);

  protected readonly graph = signal<StrukturAntwort | null>(null);
  protected readonly fehler = signal<string | null>(null);
  protected readonly zu = signal<ReadonlySet<string>>(new Set());
  protected readonly holt = signal<string | null>(null);
  protected readonly formWahl = signal<StructureLayout | null>(null);
  protected readonly form = computed(() => this.formWahl() ?? this.form0());

  private readonly schluessel = computed(() => `${this.wurzel()}|${this.kanten().join(',')}|${this.tiefe() ?? ''}`);
  private fragt = 0;

  constructor() {
    effect(() => {
      this.schluessel();
      untracked(() => void this.laden());
    });
    /* Die gespeicherte Form gilt wieder, wenn die Leitung sie umstellt. */
    effect(() => {
      this.form0();
      untracked(() => this.formWahl.set(null));
    });
    /* Ändert sich ein Artikel, der hier steht, kommt die Struktur neu — gesiebt. */
    const ab = inject(Live).onArtikel((ev) => {
      if (this.graph()?.nodes.some((n) => n.id === ev.id)) void this.laden();
    });
    inject(DestroyRef).onDestroy(ab);
  }

  async laden(): Promise<void> {
    const nr = ++this.fragt;
    try {
      const g = await this.api.structure(this.wurzel(), { edges: this.kanten(), depth: this.tiefe() });
      if (nr !== this.fragt) return;
      this.graph.set(g);
      this.fehler.set(null);
    } catch (e) {
      if (nr !== this.fragt) return;
      this.graph.set(null);
      this.fehler.set(
        e instanceof ApiError && e.status === 404
          ? 'The start article is not there — or not visible to you. Choose another one in ⚙.'
          : 'Could not load the structure. Reload (↻) or check the connection.',
      );
    }
  }

  /** „+": einen Schritt weiter von diesem Knoten aus, dazugelegt. */
  protected async mehr(id: string): Promise<void> {
    const g = this.graph();
    if (!g) return;
    this.holt.set(id);
    try {
      const dazu = await this.api.structure(id, { edges: g.edges, depth: 1 });
      const jetzt = this.graph();
      if (jetzt) this.graph.set({ ...jetzt, ...mergeStructure(jetzt, dazu) });
      this.zu.update((s) => new Set([...s].filter((x) => x !== id)));
    } catch {
      this.fehler.set('Could not load more. Reload (↻) and try again.');
    } finally {
      this.holt.set(null);
    }
  }

  protected umklappen(id: string): void {
    this.zu.update((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  protected typLabel(t: string): string {
    return this.bestand.registry()?.interfaces[t]?.label ?? t;
  }

  /** Der Baum: je Knoten, was über eine Baumlinie darunter hängt, und was quer läuft. */
  protected readonly baum = computed<Ast | null>(() => {
    const g = this.graph();
    if (!g) return null;
    const nodes = new Map(g.nodes.map((n) => [n.id, n]));
    const unter = new Map<string, StructureNode[]>();
    for (const n of g.nodes) if (n.parent) (unter.get(n.parent) ?? unter.set(n.parent, []).get(n.parent)!).push(n);
    const linieZu = (n: StructureNode): StructureLink | null =>
      g.links.find((l) => l.tree && ((l.from === n.id && l.to === n.parent) || (l.to === n.id && l.from === n.parent))) ?? null;
    const gesehen = new Set<string>();
    const bau = (n: StructureNode): Ast => {
      gesehen.add(n.id);
      const von = n.parent ? linieZu(n) : null;
      const quer = g.links
        .filter((l) => l.id !== von?.id && (l.from === n.id || l.to === n.id))
        /* Was ein Kind an seinen Platz hängt, steht dort und nicht noch einmal quer. */
        .filter((l) => !(l.tree && nodes.get(l.from === n.id ? l.to : l.from)?.parent === n.id))
        .map((l) => ({ link: l, andere: nodes.get(l.from === n.id ? l.to : l.from)!, zurueck: l.to === n.id }))
        .filter((q) => !!q.andere);
      const kinder = (unter.get(n.id) ?? []).filter((k) => !gesehen.has(k.id)).map(bau);
      return { node: n, von, kinder, quer };
    };
    const w = nodes.get(g.root);
    return w ? bau(w) : null;
  });

  /** Das Netz: Ringe je Tiefe (`netLayout`), Linien bis an den Kreis. */
  protected readonly netz = computed<Netz | null>(() => {
    const g = this.graph();
    if (!g) return null;
    const pos = netLayout(g, RING);
    const knoten = g.nodes.map((node) => ({ node, ...(pos.get(node.id) ?? { x: 0, y: 0 }) }));
    const linien = g.links
      .map((link) => {
        const a = pos.get(link.from);
        const b = pos.get(link.to);
        if (!a || !b) return null;
        const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        /* Bis an den Rand des Kreises, damit die Spitze sichtbar bleibt; die
           Gegenrichtung leicht versetzt, damit zwei Linien zwei bleiben. */
        const r = 11;
        const ux = (b.x - a.x) / d;
        const uy = (b.y - a.y) / d;
        const zwei = g.links.some((l) => l.from === link.to && l.to === link.from) ? 4 : 0;
        const ox = -uy * zwei;
        const oy = ux * zwei;
        const x1 = a.x + ux * r + ox;
        const y1 = a.y + uy * r + oy;
        const x2 = b.x - ux * r + ox;
        const y2 = b.y - uy * r + oy;
        return { link, x1, y1, x2, y2, mx: (x1 + x2) / 2 + ox * 2, my: (y1 + y2) / 2 + oy * 2 - 3 };
      })
      .filter((l): l is NonNullable<typeof l> => !!l);
    const xs = knoten.map((k) => k.x);
    const ys = knoten.map((k) => k.y);
    const rand = 70;
    const x0 = Math.min(...xs) - rand;
    const y0 = Math.min(...ys) - rand;
    const w = Math.max(...xs) - x0 + rand;
    const h = Math.max(...ys) - y0 + rand;
    return { box: `${x0} ${y0} ${w} ${h}`, knoten, linien };
  });
}

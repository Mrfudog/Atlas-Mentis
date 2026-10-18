import { Component, computed, forwardRef, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { blueprintState, filterBlueprints } from '@nw/model';
import type { HandwerkUebersicht } from '../kern/api';
import { KurzLink } from '../kern/kurzansicht';
import { Werkstatt } from '../artikel/werkstatt';

type FigurSicht = Extract<HandwerkUebersicht, { kind: 'actor' }>;

const ZUSTAND: Record<string, string> = { busy: 'in progress', unlearned: 'not learned', ready: 'ready', missing: 'missing' };

/**
 * **Der Reiter Crafting an der Figur** (T-247, REQ-347, auf T-128/T-196/T-197):
 * Blaupausen (gelernt oder alle), Filter (bereit, fast — ein, zwei fehlen —,
 * Werkzeug), die gewählte Blaupause mit der **bestehenden Werkbank**
 * (`nw-werkstatt` am Rezept: Material aus dem eigenen Inventar und dem der
 * Gruppe, Ersatz nach den Regeln der Kampagne, Start) und darunter die
 * eigenen Aufträge — gewählt mit ihren Proben als Kreise. Das Ergebnis
 * landet, wie die Werkbank es sagt, bei der Figur. Neu erfunden wird hier
 * nichts: gezählt wird am Server, gerechnet im Modell (`blueprintState`).
 */
@Component({
  selector: 'nw-figur-handwerk',
  imports: [RouterLink, KurzLink, forwardRef(() => Werkstatt)],
  template: `
    @let s = sicht();
    <section class="handwerk" aria-label="Crafting">
      <aside class="filter" aria-label="Filter blueprints">
        <span class="lbl">Blueprints</span>
        <button type="button" [class.an]="scope() === 'known'" (click)="bereich.set('known')">{{ s.actor.name }} knows · {{ gelernt() }}</button>
        <button type="button" [class.an]="scope() === 'all'" (click)="bereich.set('all')">All blueprints</button>
        <span class="lbl">Can make</span>
        <button type="button" [class.an]="kann() === 'all'" (click)="kann.set('all')">Everything</button>
        <button type="button" [class.an]="kann() === 'ready'" (click)="umschalten('ready')">Ready now</button>
        <button type="button" [class.an]="kann() === 'almost'" (click)="umschalten('almost')">Almost (1–2 missing)</button>
        <span class="lbl">Tool</span>
        <select [value]="werkzeug()" (change)="werkzeug.set($any($event.target).value)" aria-label="Tool">
          <option value="">Any tool</option>
          @for (w of werkzeuge(); track w.name) {
            <option [value]="w.name">{{ w.name }}{{ w.geuebt ? '' : ' · no proficiency' }}</option>
          }
        </select>
      </aside>
      <div class="liste">
        <h3>{{ scope() === 'known' ? 'Known' : 'All blueprints' }} · {{ zeilen().length }}</h3>
        @if (scope() === 'all' && bereich() === null && alle().length && !gelernt()) {
          <!-- Kennt die Figur noch nichts, beginnt der Reiter mit allen (sonst stünde er leer da). -->
          <p class="hinweis">{{ s.actor.name }} has not learned a blueprint yet — showing all. A recipe counts as learned when an information on it is known by the character.</p>
        }
        @for (r of zeilen(); track r.id) {
          <button type="button" class="rezept" [class.gewaehlt]="gewaehlt() === r.id" [class.ungelernt]="r.learned === false" (click)="waehle(r.id)">
            <span class="name">
              <b>{{ r.name }}</b>
              <small>{{ r.trade || r.tools.join(', ') }}{{ r.toolOk ? '' : ' · no proficiency' }}</small>
            </span>
            <span class="zustand" [attr.data-zustand]="r.zustand">{{ r.zustand === 'missing' ? r.fehlt + ' missing' : zustandText[r.zustand] }}</span>
          </button>
        } @empty {
          <p class="leer">{{ alle().length ? 'No blueprint matches the filter.' : 'No blueprints here yet.' }}</p>
        }
        <p class="fuss">Dashed: not learned yet. Missing counts what you and your party carry; the workbench also offers substitutes the campaign allows.</p>
      </div>
      <div class="werkbank">
        @if (gewaehlt(); as id) {
          <nw-werkstatt [id]="id" />
        } @else {
          <p class="leer">Choose a blueprint for its workbench: materials from your inventory and the party's, then Start crafting.</p>
        }
        <h3>On the workbench</h3>
        @for (o of s.orders ?? []; track o.id) {
          <button type="button" class="auftrag" [class.gewaehlt]="auftrag() === o.id" (click)="auftrag.set(auftrag() === o.id ? null : o.id)">
            <b>{{ o.recipe?.name ?? o.name }}</b>
            <span class="kreise" aria-hidden="true">
              @for (i of reihe(o.needed); track i) {
                <i [class.voll]="i < o.progress"></i>
              }
            </span>
            <small>{{ o.progress }} of {{ o.needed }} · {{ o.outcome }}</small>
          </button>
          @if (auftrag() === o.id) {
            <nw-werkstatt [id]="o.id" />
          }
        } @empty {
          <p class="leer">Nothing on the workbench.</p>
        }
      </div>
    </section>
  `,
  styles: `
    .handwerk { display: grid; grid-template-columns: 13rem minmax(0, 1fr) minmax(0, 1.4fr); gap: .75rem; margin: 1rem 0; }
    .filter { display: flex; flex-direction: column; gap: .3rem; }
    .lbl { margin-top: .4rem; font-size: .75rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--dim); }
    .filter button { min-height: 32px; text-align: left; font-size: .9rem; }
    .filter button.an { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
    .filter select { font: inherit; min-height: 32px; }
    h3 { margin: 0 0 .4rem; font-family: var(--caps); color: var(--heading); }
    .rezept, .auftrag { display: flex; align-items: center; justify-content: space-between; gap: .5rem; width: 100%; min-height: 44px; margin-bottom: .3rem; padding: .3rem .6rem; text-align: left; background: var(--surface); }
    .rezept.gewaehlt, .auftrag.gewaehlt { border: 2px solid var(--accent); background: var(--hover); }
    .rezept.ungelernt { border-style: dashed; opacity: .75; }
    .name { display: flex; flex-direction: column; min-width: 0; }
    small, .leer, .fuss, .hinweis { color: var(--dim); font-size: .85rem; }
    .zustand { white-space: nowrap; font-size: .85rem; color: var(--dim); }
    .zustand[data-zustand='ready'] { color: var(--good); font-weight: 700; }
    .zustand[data-zustand='busy'] { color: var(--gold); font-weight: 700; }
    .zustand[data-zustand='missing'] { color: var(--warn); }
    .werkbank { min-width: 0; padding: .6rem .8rem; background: var(--paper); border-top: 6px solid var(--gold); border-bottom: 6px solid var(--gold); border-radius: 6px; }
    .werkbank h3 { margin-top: 1rem; }
    .auftrag { flex-wrap: wrap; }
    .kreise { display: inline-flex; gap: .2rem; }
    .kreise i { width: 14px; height: 14px; border: 2px solid var(--gold); border-radius: 50%; }
    .kreise i.voll { background: var(--gold); }
    @media (max-width: 760px) {
      .handwerk { grid-template-columns: 1fr; }
      .filter { flex-direction: row; flex-wrap: wrap; align-items: center; }
      .lbl { flex-basis: 100%; }
    }
  `,
})
export class FigurHandwerk {
  readonly sicht = input.required<FigurSicht>();

  protected readonly zustandText = ZUSTAND;
  /** Was gewählt wurde; ohne Wahl gelernt, wenn es Gelerntes gibt, sonst alle. */
  protected readonly bereich = signal<'known' | 'all' | null>(null);
  protected readonly gelernt = computed(() => this.alle().filter((r) => r.learned === true).length);
  protected readonly scope = computed<'known' | 'all'>(() => this.bereich() ?? (this.gelernt() ? 'known' : 'all'));
  protected readonly kann = signal<'all' | 'ready' | 'almost'>('all');
  protected readonly werkzeug = signal('');
  protected readonly gewaehlt = signal<string | null>(null);
  protected readonly auftrag = signal<string | null>(null);

  protected reihe(n: number): number[] {
    return Array.from({ length: Math.max(0, Math.min(20, n)) }, (_, i) => i);
  }

  /* Alle Blaupausen; ältere Server ohne `recipes` geben die je Werkzeug. */
  protected readonly alle = computed(() => {
    const s = this.sicht();
    return s.recipes ?? s.tools.flatMap((w) => w.recipes.map((r) => ({ ...r, toolOk: true })));
  });

  protected readonly werkzeuge = computed(() => {
    const m = new Map<string, boolean>();
    for (const r of this.alle()) for (const w of r.tools) m.set(w, (m.get(w) ?? false) || r.toolOk);
    return [...m].map(([name, geuebt]) => ({ name, geuebt })).sort((a, b) => a.name.localeCompare(b.name));
  });

  protected readonly zeilen = computed(() => {
    const s = this.sicht();
    const stock = s.stock ?? {};
    const busy = new Set((s.orders ?? []).filter((o) => o.outcome === 'open' && o.recipe).map((o) => o.recipe!.id));
    return filterBlueprints(this.alle(), stock, { scope: this.scope(), can: this.kann(), tool: this.werkzeug() }).map((r) => {
      const z = blueprintState(r, stock, busy);
      return { ...r, zustand: z.state, fehlt: z.missing };
    });
  });

  protected umschalten(k: 'ready' | 'almost'): void {
    this.kann.set(this.kann() === k ? 'all' : k);
  }

  protected waehle(id: string): void {
    this.gewaehlt.set(this.gewaehlt() === id ? null : id);
  }
}

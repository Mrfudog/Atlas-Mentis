import { Component, computed, inject, input, output, signal } from '@angular/core';
import { STRUCTURE_DEPTH, STRUCTURE_EDGES, structureTileOf } from '@nw/model';
import type { Entity, Relation, StructureLayout } from '@nw/model';
import { Bestand } from '../kern/bestand';
import { Struktur } from '../struktur/struktur';
import { BoardSuche } from './suche';

/** Wie die Kanten im Panel heissen und was sie zeichnen. */
const KANTEN: Record<string, { label: string; does: string }> = {
  memberOf: { label: 'Members and ranks', does: 'Who belongs to a faction, with their rank on the line.' },
  partOf: { label: 'Parts and sub-factions', does: 'What is part of what — a circle of a faction, a room of a house.' },
  controls: { label: 'Controls (territory)', does: 'The places a faction controls.' },
  livesIn: { label: 'Residents', does: 'Who lives in a place.' },
  regards: { label: 'Relationships', does: 'Who thinks what of whom — the tags on the line; each direction is its own line.' },
};

/**
 * **Die Kachel „Structure"** (T-341): Einstellungen (⚙) und die Struktur
 * selbst. Wie die Abfrage-Kachel eine Kante des Boards auf sich selbst
 * (`placed.props.structure`); was sich hier ändert, geht als Änderung der
 * Kante hinaus (`aendern`), wie Lage und Ansicht.
 */
@Component({
  selector: 'nw-struktur-kachel',
  imports: [Struktur, BoardSuche],
  template: `
    @if (einstellen()) {
      <form class="einst" (submit)="$event.preventDefault()" aria-label="Structure settings">
        <label>Title <input [value]="tile()?.title ?? ''" (change)="setze({ title: $any($event.target).value.trim() || undefined })" /></label>
        <div class="start">
          <span class="dim">Start</span>
          @if (tile()?.root) {
            <b>{{ startName() }}</b>
          } @else {
            <span class="dim">none yet</span>
          }
          <button type="button" class="klein" [attr.aria-expanded]="sucht()" (click)="sucht.set(!sucht())">{{ sucht() ? 'Done' : 'Choose…' }}</button>
          @if (sucht()) {
            <nw-board-suche class="suche" (gewaehlt)="startWahl($event)" />
          }
        </div>
        <fieldset class="zeile">
          <legend>Shows as</legend>
          <label><input type="radio" name="form" [checked]="tile()?.layout === 'tree'" (change)="frage({ layout: 'tree' })" /> Tree (organisation chart)</label>
          <label><input type="radio" name="form" [checked]="tile()?.layout === 'net'" (change)="frage({ layout: 'net' })" /> Web</label>
        </fieldset>
        <fieldset class="kanten">
          <legend>Edges</legend>
          @for (k of KANTEN_LISTE; track k.type) {
            <label [title]="k.does"><input type="checkbox" [checked]="tile()?.edges?.includes(k.type)" (change)="kante(k.type, $any($event.target).checked)" /> {{ k.label }}</label>
          }
        </fieldset>
        <label>Depth
          <input class="zahl" type="number" [min]="D.min" [max]="D.max" [value]="tile()?.depth" (change)="frage({ depth: +$any($event.target).value || undefined })" />
        </label>
      </form>
    }
    @if (tile()?.root; as wurzel) {
      <nw-struktur [wurzel]="wurzel" [kanten]="tile()!.edges" [tiefe]="tile()!.depth" [form]="tile()!.layout" [einpassen]="true" />
    } @else {
      <p class="leer">{{ spielend() ? 'Nothing to show yet.' : 'No start yet — open ⚙ and choose a faction, place or family.' }}</p>
    }
  `,
  styles: `
    /* So hoch wie das Fach der Kachel, damit die Struktur den Rest nimmt (T-368). */
    :host { display: flex; flex-direction: column; height: 100%; font-size: 0.9rem; }
    :host > * { flex: none; }
    :host > nw-struktur { flex: 1 1 auto; min-height: 10rem; }
    .einst { display: grid; gap: 0.4rem; padding: 0.4rem 0 0.6rem; border-bottom: 1px dashed var(--rule, #c9b98f); margin-bottom: 0.5rem; }
    .einst label { display: grid; gap: 0.15rem; }
    .einst fieldset { display: flex; flex-wrap: wrap; gap: 0.2rem 0.8rem; border: 1px solid var(--line2, #c9b98f); border-radius: 4px; padding: 0.3rem 0.5rem; margin: 0; }
    .einst fieldset legend { font-size: 0.85rem; color: var(--dim); padding: 0 0.2rem; }
    .einst fieldset label { display: flex; gap: 0.3rem; align-items: center; }
    .einst input { font: inherit; min-width: 0; }
    .start { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; }
    .suche { flex-basis: 100%; max-height: 14rem; overflow: auto; }
    .zahl { width: 5rem; }
    .dim, .leer { opacity: 0.75; }
  `,
})
export class StrukturKachel {
  readonly rel = input.required<Relation>();
  readonly einstellen = input(false);
  readonly spielend = input(false);
  readonly aendern = output<Record<string, unknown>>();

  private readonly bestand = inject(Bestand);
  protected readonly D = STRUCTURE_DEPTH;
  protected readonly KANTEN_LISTE = STRUCTURE_EDGES.filter((e) => KANTEN[e.type]).map((e) => ({ type: e.type, ...KANTEN[e.type]! }));
  protected readonly sucht = signal(false);
  private readonly gewaehlterName = signal<string | null>(null);

  protected readonly tile = computed(() => structureTileOf(this.rel()));
  protected readonly startName = computed(() => {
    const id = this.tile()?.root ?? '';
    return this.gewaehlterName() ?? this.bestand.kurz().get(id)?.name ?? 'the chosen article';
  });

  protected setze(props: Record<string, unknown>): void {
    this.aendern.emit(props);
  }
  /** Die Frage, wie sie gespeichert wird: nur, was gesagt ist. */
  protected frage(teil: { root?: string; edges?: string[]; layout?: StructureLayout; depth?: number }, dazu: Record<string, unknown> = {}): void {
    const roh = (this.rel().props?.['structure'] ?? {}) as Record<string, unknown>;
    const neu: Record<string, unknown> = { ...roh, ...teil };
    for (const k of Object.keys(neu)) if (neu[k] === undefined) delete neu[k];
    this.aendern.emit({ ...dazu, structure: neu });
  }
  protected kante(type: string, an: boolean): void {
    const ist = (this.tile()?.edges ?? []).filter((t) => t !== type);
    this.frage({ edges: an ? [...ist, type] : ist });
  }
  protected startWahl(e: Entity): void {
    this.gewaehlterName.set(e.name);
    this.sucht.set(false);
    /* Eine Kachel ohne eigenen Titel heisst nach ihrem Start — in einem Schreiben. */
    const titel = this.tile()?.title;
    this.frage({ root: e.id }, !titel || titel === 'Structure' ? { title: e.name } : {});
  }
}

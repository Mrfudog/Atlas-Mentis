import { Component, ViewEncapsulation, computed, inject, input, output, signal } from '@angular/core';
import { typeList } from '@nw/model';
import type { LayoutElement, LayoutElementKind, LayoutWhen, Registry } from '@nw/model';
import { Bestand } from '../kern/bestand';

/**
 * **Die Elemente, die eine Anordnung kennt** — mit dem Satz, was jedes
 * zeichnet. Wer nicht weiss, was eine Angabe tut, lässt sie leer (CLAUDE.md:
 * „Was eine Einstellung auslöst, steht dabei"). `drawn: false` heisst: das
 * Element darf stehen, aber noch kein Ort zeichnet es — was es tragen soll,
 * steht im Rest, wo die Ansicht ihn will.
 */
export const ELEMENTE: { el: LayoutElementKind; label: string; was: string; drawn: boolean }[] = [
  { el: 'description', label: 'Description', was: 'The description, as text.', drawn: true },
  { el: 'fields', label: 'Fields', was: 'A table of fields — whole types or single fields.', drawn: true },
  { el: 'prose', label: 'Prose', was: 'Long texts (paragraphs, secrets, read-aloud), each under its title.', drawn: true },
  { el: 'heading', label: 'Heading', was: 'A heading with your words.', drawn: true },
  { el: 'text', label: 'Text', was: 'A line with your words.', drawn: true },
  { el: 'statblock', label: 'Statblock (as in the book)', was: 'Draws the statblock’s fields like the rulebook.', drawn: true },
  { el: 'spell', label: 'Spell (as in the book)', was: 'Draws the spell’s fields and text like the rulebook.', drawn: true },
  { el: 'stats', label: 'Key numbers', was: 'AC, HP, speed, initiative, passive Perception and CR as one row of tiles; on a creature from its statblock, with its current HP and conditions.', drawn: true },
  { el: 'item', label: 'Item (as in the book)', was: 'Draws the item’s fields like the rulebook.', drawn: true },
  { el: 'composed', label: 'Sections', was: 'What it is composed of (traits, actions …), per section.', drawn: true },
  { el: 'parts', label: 'Parts', was: 'The parts of a chapter or scene, in their order.', drawn: true },
  { el: 'reader', label: 'Reader', was: 'The layer as a book: contents, search, chapters in one go, reading position per account; a group as a shelf. Drawn across the full width below the article.', drawn: true },
  { el: 'contents', label: 'Contents', was: 'On a layer its articles by type, each linked, with ticks that show and change what the current campaign has in play — the layer, its types, single articles; on a group its layers.', drawn: true },
  { el: 'classOverview', label: 'Class overview', was: 'Key data, the level table, subclasses to pick and compare, features by level. Takes proficiencies and choices out of the field table.', drawn: true },
  { el: 'originOverview', label: 'Ancestry/background overview', was: 'Key data, variants to switch and compare, traits. Takes proficiencies and choices out of the field table.', drawn: true },
  { el: 'crafting', label: 'Crafting', was: 'On a recipe the workbench to start an order, on an order its checks; on a trade its tools, recipes and materials; on a tool what it makes; on a character what it can craft with the tools it is proficient in — learned or not. Draws nothing elsewhere.', drawn: true },
  { el: 'relations', label: 'Relations', was: 'Its edges with their targets. The article page has them in its side column.', drawn: true },
  { el: 'linked', label: 'Linked', was: 'The fields of what hangs on an asField edge (the statblock of a creature), editable in place; without one, Create and From a template.', drawn: true },
  { el: 'usedBy', label: 'Used by', was: 'Who composes this article, by creature type.', drawn: false },
  { el: 'standing', label: 'Standing', was: 'Who thinks what of whom.', drawn: false },
  { el: 'image', label: 'Image', was: 'The image of the article.', drawn: false },
  { el: 'sheet', label: 'Character sheet', was: 'The sheet of a creature.', drawn: false },
  { el: 'inventory', label: 'Inventory', was: 'The inventory it carries and what that holds, as a list (the grid comes later).', drawn: true },
  { el: 'rules', label: 'Rules & options', was: 'Takes the fields it names out of the field table and points to the Rules & options tab, where they stand grouped and explained (campaign).', drawn: true },
  { el: 'tabs', label: 'Tabs', was: 'Named groups; a page shows them one after the other.', drawn: true },
];

/** Eine Id, die in dieser Anordnung noch frei ist. */
export function freieId(layout: readonly LayoutElement[], el: string, auch: readonly string[] = []): string {
  const alle = new Set<string>(auch);
  const sammle = (els: readonly LayoutElement[]): void => {
    for (const x of els) {
      alle.add(x.id);
      for (const t of x.tabs ?? []) sammle(t.layout);
    }
  };
  sammle(layout);
  for (let i = 1; ; i++) {
    const id = `${el}-${i}`;
    if (!alle.has(id)) return id;
  }
}

/** Ein Eintrag lesbar: `Spell.level` → „Spell › Level", `Spell` → „Spell (all fields)". */
export function eintragText(r: Registry | null, eintrag: string): string {
  const [typ = '', feld] = eintrag.split('.');
  const tl = r?.interfaces[typ]?.label ?? typ;
  if (!feld) return `${tl} (all fields)`;
  const fl = r?.interfaces[typ]?.schema?.properties[feld]?.title ?? feld;
  return `${tl} › ${fl}`;
}

/**
 * **Felder wählen** (T-110): einen Typ, dann den ganzen Typ — neue Felder
 * erscheinen von selbst — oder einzelne Felder, die bleiben, wie sie sind.
 * Gibt die Einträge als `Typ` bzw. `Typ.feld` heraus.
 */
@Component({
  selector: 'nw-reg-feldwahl',
  template: `
    <div class="feldwahl">
      <select [attr.aria-label]="titel()" (change)="typ.set($any($event.target).value); haken.set([])">
        <option value="">{{ titel() }}…</option>
        @for (t of typen(); track t) {
          <option [value]="t" [selected]="t === typ()">{{ label(t) }}</option>
        }
      </select>
      @if (typ()) {
        <div class="haken-liste">
          <label class="haken">
            <input type="checkbox" [checked]="haken().includes(typ())" (change)="kreuzen(typ())" />
            <b>All of {{ label(typ()) }}</b> <span class="dim">— new fields appear by themselves</span>
          </label>
          @for (f of felder(); track f.key) {
            <label class="haken">
              <input type="checkbox" [checked]="haken().includes(typ() + '.' + f.key)"
                [disabled]="haken().includes(typ())" (change)="kreuzen(typ() + '.' + f.key)" />
              {{ f.label }} <code>{{ f.key }}</code>
            </label>
          } @empty {
            <span class="dim">This type declares no fields of its own.</span>
          }
        </div>
        <button type="button" class="klein" [disabled]="!haken().length" (click)="nehmen()">{{ knopf() }}</button>
      }
    </div>
  `,
})
export class RegFeldwahl {
  /** Welche Typen zur Wahl stehen; ohne Angabe alle. */
  readonly nur = input<readonly string[] | null>(null);
  readonly titel = input('Add field');
  readonly knopf = input('Add');
  readonly gewaehlt = output<string[]>();

  private readonly bestand = inject(Bestand);
  protected readonly typ = signal('');
  protected readonly haken = signal<string[]>([]);

  protected readonly typen = computed(() => {
    const r = this.bestand.registry();
    if (!r) return [];
    const nur = this.nur();
    return typeList(r).filter((t) => (!nur || nur.includes(t)) && Object.keys(r.interfaces[t]?.schema?.properties ?? {}).length);
  });
  protected readonly felder = computed(() => {
    const p = this.bestand.registry()?.interfaces[this.typ()]?.schema?.properties ?? {};
    return Object.entries(p).map(([key, s]) => ({ key, label: s.title ?? key }));
  });

  protected label(t: string): string {
    return this.bestand.registry()?.interfaces[t]?.label ?? t;
  }
  protected kreuzen(e: string): void {
    this.haken.update((h) => (h.includes(e) ? h.filter((x) => x !== e) : [...h, e]));
  }
  protected nehmen(): void {
    const h = this.haken();
    /* Der ganze Typ schliesst seine Felder ein. */
    this.gewaehlt.emit(h.includes(this.typ()) ? [this.typ()] : h);
    this.haken.set([]);
    this.typ.set('');
  }
}

/**
 * **Eine Anordnung bearbeiten** (T-110): die Elemente in ihrer Reihenfolge,
 * je Element, was es nimmt. Gibt bei jeder Änderung die ganze neue Liste
 * heraus; gespeichert wird draussen, mit „Save" — bis dahin ist es ein
 * Entwurf, den die Vorschau schon zeichnet.
 */
@Component({
  selector: 'nw-reg-anordnung',
  imports: [RegFeldwahl],
  template: `
    <ol class="anordnung">
      @for (el of layout(); track el.id; let i = $index; let erstes = $first; let letztes = $last) {
        <li class="element">
          <div class="fhead">
            <b>{{ elLabel(el.el) }}</b>
            <code class="dim">{{ el.id }}</code>
            @if (!gezeichnet(el.el)) {
              <span class="pill" title="Allowed, but no place draws it yet; what it would carry shows in the rest.">not drawn yet</span>
            }
            @if (darf()) {
              <span class="rechts">
                <button type="button" class="klein" [disabled]="erstes" (click)="schieben(i, -1)" aria-label="Move up">↑</button>
                <button type="button" class="klein" [disabled]="letztes" (click)="schieben(i, 1)" aria-label="Move down">↓</button>
                <button type="button" class="klein weg" (click)="weg(i)" [attr.aria-label]="'Remove ' + elLabel(el.el)">×</button>
              </span>
            }
          </div>
          @if (el.el === 'heading' || el.el === 'text') {
            <input type="text" [value]="el.text ?? ''" [disabled]="!darf()" aria-label="Text"
              (change)="setzen(i, { text: $any($event.target).value })" />
          }
          @if (el.el === 'fields' || el.el === 'prose') {
            <label class="haken">
              <input type="checkbox" [checked]="el.fields === 'all' || (el.el === 'prose' && el.fields === undefined)"
                [disabled]="!darf()" (change)="alles(i, $any($event.target).checked)" />
              Every {{ el.el === 'prose' ? 'long text' : 'field' }} the type has
              <span class="dim">— what an earlier element already shows stays there</span>
            </label>
            @if (el.fields !== 'all' && !(el.el === 'prose' && el.fields === undefined)) {
              <div class="chips">
                @for (f of liste(el.fields); track f; let j = $index) {
                  <span class="chip">
                    {{ eintrag(f) }}
                    @if (darf()) {
                      <button type="button" class="klein" [disabled]="j === 0" (click)="eintragSchieben(i, j, -1)" aria-label="Earlier">←</button>
                      <button type="button" class="klein" (click)="eintragWeg(i, 'fields', f)" [attr.aria-label]="'Remove ' + f">×</button>
                    }
                  </span>
                } @empty {
                  <span class="dim">Nothing yet — this element shows nothing.</span>
                }
              </div>
              @if (darf()) {
                <nw-reg-feldwahl [nur]="typen()" (gewaehlt)="dazu(i, 'fields', $event)" />
              }
            }
            @if (el.except?.length || darf()) {
              <div class="chips">
                <span class="dim">Leave out:</span>
                @for (f of el.except ?? []; track f) {
                  <span class="chip">
                    {{ eintrag(f) }}
                    @if (darf()) {
                      <button type="button" class="klein" (click)="eintragWeg(i, 'except', f)" [attr.aria-label]="'Show ' + f + ' again'">×</button>
                    }
                  </span>
                } @empty {
                  <span class="dim">nothing</span>
                }
              </div>
              @if (darf()) {
                <nw-reg-feldwahl [nur]="typen()" titel="Leave out" knopf="Leave out" (gewaehlt)="dazu(i, 'except', $event)" />
              }
            }
            @if (el.el === 'fields') {
              <label class="f klein-f">
                <span>Columns</span>
                <input type="number" min="0" max="6" [value]="el.columns ?? 0" [disabled]="!darf()"
                  (change)="setzen(i, { columns: +$any($event.target).value || undefined })" />
              </label>
            }
          }
          @if (el.el === 'tabs') {
            @for (t of el.tabs ?? []; track t.id; let k = $index) {
              <div class="reiter-ed">
                <input type="text" [value]="t.label" [disabled]="!darf()" aria-label="Tab label"
                  (change)="reiterSetzen(i, k, { label: $any($event.target).value })" />
                @if (darf()) {
                  <button type="button" class="klein weg" (click)="reiterWeg(i, k)" aria-label="Remove tab">×</button>
                }
                <nw-reg-anordnung [layout]="t.layout" [darf]="darf()" [typen]="typen()"
                  (geaendert)="reiterSetzen(i, k, { layout: $event })" />
              </div>
            }
            @if (darf()) {
              <button type="button" class="klein" (click)="reiterDazu(i)">+ tab</button>
            }
          }
          <!-- Nur, wenn der Artikel es sagt (T-184): sonst fällt das Element an ihm weg. -->
          @if (el.when || darf()) {
            <details class="wenn" [open]="!!el.when">
              <summary>
                Only when …
                @if (el.when) {
                  <span class="dim">{{ wennText(el.when) }}</span>
                } @else {
                  <span class="dim">always</span>
                }
              </summary>
              <div class="wenn-felder">
                <label class="f klein-f"><span>Field</span>
                  <input type="text" [value]="el.when?.field ?? ''" [disabled]="!darf()" placeholder="Encounter.kind"
                    (change)="wennSetzen(i, { field: $any($event.target).value.trim() || undefined })" /></label>
                <label class="f klein-f"><span>holds one of</span>
                  <input type="text" [value]="(el.when?.has ?? []).join(', ')" [disabled]="!darf()" placeholder="combat, social"
                    (change)="wennSetzen(i, { has: liste2($any($event.target).value) })" /></label>
                <label class="haken"><input type="checkbox" [checked]="!!el.when?.empty" [disabled]="!darf()"
                  (change)="wennSetzen(i, { empty: $any($event.target).checked || undefined })" /> or is empty</label>
                <label class="f klein-f"><span>or has an edge</span>
                  <input type="text" [value]="el.when?.relation ?? ''" [disabled]="!darf()" placeholder="edge kind"
                    (change)="wennSetzen(i, { relation: $any($event.target).value.trim() || undefined })" /></label>
              </div>
              <p class="hint">The element shows only on articles that match; what it would have shown falls to a later element that takes all fields. Empty: always.</p>
            </details>
          }
          <p class="hint">{{ was(el.el) }}</p>
        </li>
      } @empty {
        <li class="dim">No element — this view draws nothing here.</li>
      }
    </ol>
    @if (darf()) {
      <div class="neu-el">
        <select #neuEl aria-label="Element to add">
          @for (e of elemente; track e.el) {
            <option [value]="e.el">{{ e.label }}{{ e.drawn ? '' : ' (not drawn yet)' }}</option>
          }
        </select>
        <button type="button" class="klein" (click)="elementDazu($any(neuEl.value))">+ element</button>
      </div>
    }
  `,
  /* Gilt für alle Ansichts-Bausteine im Register (Anordnung, Anpassung, Vorschau). */
  styleUrl: './ansichten.scss',
  encapsulation: ViewEncapsulation.None,
})
export class RegAnordnung {
  readonly layout = input.required<LayoutElement[]>();
  readonly darf = input(false);
  /** Welche Typen „Add field" anbietet; ohne Angabe alle. */
  readonly typen = input<readonly string[] | null>(null);
  /** Ids, die schon anderswo vergeben sind (die geerbte Anordnung neben den Elementen einer Anpassung). */
  readonly vergeben = input<readonly string[]>([]);
  readonly geaendert = output<LayoutElement[]>();

  private readonly bestand = inject(Bestand);
  protected readonly elemente = ELEMENTE;

  protected elLabel(el: string): string {
    return ELEMENTE.find((e) => e.el === el)?.label ?? el;
  }
  protected was(el: string): string {
    return ELEMENTE.find((e) => e.el === el)?.was ?? '';
  }
  protected gezeichnet(el: string): boolean {
    return ELEMENTE.find((e) => e.el === el)?.drawn ?? false;
  }
  protected liste(f: LayoutElement['fields']): string[] {
    return Array.isArray(f) ? f : [];
  }
  protected eintrag(e: string): string {
    return eintragText(this.bestand.registry(), e);
  }

  private neu(f: (l: LayoutElement[]) => void): void {
    const l = structuredClone(this.layout());
    f(l);
    this.geaendert.emit(l);
  }
  protected schieben(i: number, um: number): void {
    this.neu((l) => {
      const [x] = l.splice(i, 1);
      l.splice(i + um, 0, x!);
    });
  }
  protected weg(i: number): void {
    this.neu((l) => l.splice(i, 1));
  }
  /** Die Bedingung in einem Satz (T-184). */
  protected wennText(w: LayoutWhen): string {
    const teile: string[] = [];
    if (w.field && w.has?.length) teile.push(`${w.field} is ${w.has.join(' or ')}`);
    if (w.field && w.empty) teile.push(`${w.field} is empty`);
    if (w.relation) teile.push(`it has ${w.relation}`);
    return teile.join(', or ') || 'always';
  }
  protected liste2(text: string): string[] | undefined {
    const l = text.split(',').map((x) => x.trim()).filter(Boolean);
    return l.length ? l : undefined;
  }
  /** Ändert die Bedingung; leer heisst: keine Bedingung. */
  protected wennSetzen(i: number, teil: Partial<LayoutWhen>): void {
    const w: LayoutWhen = { ...(this.layout()[i]?.when ?? {}), ...teil };
    for (const k of Object.keys(w) as (keyof LayoutWhen)[]) if (w[k] === undefined) delete w[k];
    this.setzen(i, { when: Object.keys(w).length ? w : undefined });
  }
  protected setzen(i: number, teil: Partial<LayoutElement>): void {
    this.neu((l) => {
      const el = { ...l[i]!, ...teil };
      for (const k of Object.keys(teil) as (keyof LayoutElement)[]) if (teil[k] === undefined || teil[k] === '') delete el[k];
      l[i] = el;
    });
  }
  protected alles(i: number, an: boolean): void {
    this.neu((l) => {
      l[i]!.fields = an ? 'all' : [];
    });
  }
  protected dazu(i: number, wo: 'fields' | 'except', eintraege: string[]): void {
    this.neu((l) => {
      const el = l[i]!;
      const alt = wo === 'fields' ? this.liste(el.fields) : (el.except ?? []);
      const neu = [...new Set([...alt, ...eintraege])];
      if (wo === 'fields') el.fields = neu;
      else el.except = neu;
    });
  }
  protected eintragWeg(i: number, wo: 'fields' | 'except', e: string): void {
    this.neu((l) => {
      const el = l[i]!;
      if (wo === 'fields') el.fields = this.liste(el.fields).filter((x) => x !== e);
      else {
        el.except = (el.except ?? []).filter((x) => x !== e);
        if (!el.except.length) delete el.except;
      }
    });
  }
  protected eintragSchieben(i: number, j: number, um: number): void {
    this.neu((l) => {
      const f = this.liste(l[i]!.fields);
      const [x] = f.splice(j, 1);
      f.splice(j + um, 0, x!);
      l[i]!.fields = f;
    });
  }
  protected elementDazu(el: LayoutElementKind): void {
    this.neu((l) => {
      const neu: LayoutElement = { id: freieId(l, el, this.vergeben()), el };
      if (el === 'fields') neu.fields = [];
      if (el === 'prose') neu.fields = 'all';
      if (el === 'heading' || el === 'text') neu.text = '';
      if (el === 'tabs') neu.tabs = [{ id: freieId(l, 'tab', this.vergeben()), label: 'Tab', layout: [] }];
      l.push(neu);
    });
  }
  protected reiterSetzen(i: number, k: number, teil: { label?: string; layout?: LayoutElement[] }): void {
    this.neu((l) => {
      const tabs = l[i]!.tabs ?? [];
      tabs[k] = { ...tabs[k]!, ...teil };
      l[i]!.tabs = tabs;
    });
  }
  protected reiterDazu(i: number): void {
    this.neu((l) => {
      l[i]!.tabs = [...(l[i]!.tabs ?? []), { id: freieId(l, 'tab', this.vergeben()), label: 'Tab', layout: [] }];
    });
  }
  protected reiterWeg(i: number, k: number): void {
    this.neu((l) => {
      l[i]!.tabs = (l[i]!.tabs ?? []).filter((_, n) => n !== k);
    });
  }
}

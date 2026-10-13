import { Component, computed, inject, input } from '@angular/core';
import { typeList } from '@nw/model';
import type { RelationDef } from '@nw/model';
import { Bestand } from '../kern/bestand';
import { RegisterArbeit } from './arbeit';

/**
 * **Eine Kantenart** — gespeichert in einer Richtung; die Gegenrichtung ist
 * eine Abfrage, und `inverseLabel` ist, wie sie sich vom anderen Ende
 * liest (REQ-182). Jede Einstellung sagt darunter, was sie auslöst.
 *
 * Gelöscht wird nur eine Art, von der keine Kante im Bestand steht: eine
 * Kante ohne Erklärung weist die Prüfung beim nächsten Speichern ab
 * (`unknown_relation`).
 */
@Component({
  selector: 'nw-reg-kante',
  template: `
    @if (def(); as d) {
      <div class="typkopf">
        <h2>{{ d.label }}</h2>
        <code>{{ name() }}</code>
        <span class="dim">{{ zahlText() }}</span>
      </div>
      <section class="kasten" aria-label="Edge">
        <p class="hint">
          One edge, stored in one direction. The reverse is never stored — it is a query, and the label backwards is how it
          reads from the other end.
        </p>
        <label class="f">
          <span>Label forwards</span>
          <input type="text" [value]="d.label" [disabled]="!darf()" (change)="setzen({ label: wert($event) || name() })" />
        </label>
        <p class="hint">How it reads from where it is stored: “lives in”.</p>
        <label class="f">
          <span>Label backwards</span>
          <input type="text" [value]="d.inverseLabel" [disabled]="!darf()"
            (change)="setzen({ inverseLabel: wert($event) || '← ' + d.label })" />
        </label>
        <p class="hint">How the same edge reads from its target: “residents”.</p>
        @for (seite of seiten; track seite.k) {
          <label class="f">
            <span>{{ seite.label }}</span>
            <select multiple size="6" [disabled]="!darf()" (change)="endeSetzen(seite.k, $any($event.target))">
              <option value="*" [selected]="!(d[seite.k] ?? []).length || (d[seite.k] ?? []).includes('*')">any type (*)</option>
              @if (seite.k === 'to') {
                <option value="same" [selected]="(d.to ?? []).includes('same')">its own type (same)</option>
              }
              @for (t of typen(); track t) {
                <option [value]="t" [selected]="(d[seite.k] ?? []).includes(t)">{{ label(t) }}</option>
              }
            </select>
          </label>
          <p class="hint">{{ seite.hint }}</p>
        }
        <label class="f">
          <span>How many</span>
          <select [disabled]="!darf()" (change)="setzen({ cardinality: $any($event.target).value || undefined })">
            <option value="" [selected]="d.cardinality !== 'one'">many</option>
            <option value="one" [selected]="d.cardinality === 'one'">at most one</option>
          </select>
        </label>
        <p class="hint">At most one: the form replaces the edge instead of adding a second.</p>
        <label class="f haken">
          <input type="checkbox" [checked]="!!d.owned" [disabled]="!darf()"
            (change)="setzen({ owned: $any($event.target).checked || undefined })" />
          <span>Owned</span>
        </label>
        <p class="hint">The target is deleted with the source — a statblock’s parts, an inventory’s holdings.</p>
        <label class="f">
          <span>Section heading</span>
          <input type="text" placeholder="Actions" [value]="d.section ?? ''" [disabled]="!darf()"
            (change)="setzen({ section: wert($event) || undefined })" />
        </label>
        <p class="hint">Set it and the targets are composed into the article under this heading instead of listed as links.</p>
        <label class="f">
          <span>Reads as a field at</span>
          <select [disabled]="!darf()" (change)="setzen({ asField: $any($event.target).value || undefined })">
            <option value="" [selected]="!d.asField">neither end</option>
            <option value="from" [selected]="d.asField === 'from'">the start</option>
            <option value="to" [selected]="d.asField === 'to'">the target</option>
          </select>
        </label>
        <p class="hint">
          The other end’s fields are drawn and edited there as if they were its own — a creature’s statblock. Only for an
          edge to exactly one type, and only where the article would be incomplete without it.
        </p>
        @if (props().length) {
          <p class="hint">Properties on the edge: {{ props().join(', ') }}.</p>
        }
      </section>
      @if (darf()) {
        <div class="knoepfe">
          <button type="button" class="weg" [disabled]="!!grund()" (click)="entfernen()">Remove edge kind</button>
          @if (grund(); as g) {
            <span class="dim">{{ g }}</span>
          }
        </div>
      }
    } @else {
      <p class="leer">There is no edge kind {{ name() }}.</p>
    }
  `,
  /* Gezeichnet im Stil der Registerseite (`register.scss`, einmal geladen). */
})
export class RegKante {
  readonly name = input.required<string>();
  readonly darf = input(false);

  private readonly bestand = inject(Bestand);
  private readonly arbeit = inject(RegisterArbeit);
  protected readonly seiten = [
    { k: 'from' as const, label: 'May start at', hint: 'The types it may be stored on. Picking a type includes its subtypes.' },
    { k: 'to' as const, label: 'May point at', hint: 'The types it may point at, subtypes included; “same” means the type it starts at.' },
  ];

  private readonly reg = computed(() => this.bestand.registry());
  protected readonly def = computed(() => this.reg()?.relations[this.name()]);
  protected readonly typen = computed(() => (this.reg() ? typeList(this.reg()!) : []));
  protected readonly props = computed(() => Object.keys(this.def()?.props?.properties ?? {}));
  private readonly anzahl = computed(() => this.arbeit.usage()?.relations[this.name()] ?? null);
  protected readonly zahlText = computed(() => {
    const n = this.anzahl();
    return n === null ? '' : n === 1 ? '1 edge' : `${n.toLocaleString('en')} edges`;
  });
  protected readonly grund = computed(() => {
    const n = this.anzahl();
    if (n === null) return 'The stock could not be counted, so it stays.';
    return n ? `${this.zahlText()} of this kind stand in the stock — it stays while they do.` : '';
  });

  protected label(t: string): string {
    return this.reg()?.interfaces[t]?.label ?? t;
  }
  protected wert(ev: Event): string {
    return String((ev.target as HTMLInputElement).value ?? '').trim();
  }

  protected setzen(teil: Partial<RelationDef>): void {
    const n = this.name();
    void this.arbeit.aendern('relations', (rels) => {
      const d = rels[n];
      if (!d) return `There is no edge kind ${n}.`;
      for (const [k, v] of Object.entries(teil)) {
        if (v === undefined) delete (d as unknown as Record<string, unknown>)[k];
        else (d as unknown as Record<string, unknown>)[k] = v;
      }
      return undefined;
    });
  }

  protected endeSetzen(k: 'from' | 'to', el: HTMLSelectElement): void {
    let gewaehlt = Array.from(el.selectedOptions).map((o) => o.value);
    /* „Jede" neben einer Art wäre beides zugleich; die Art gewinnt. */
    if (gewaehlt.length > 1) gewaehlt = gewaehlt.filter((x) => x !== '*');
    this.setzen({ [k]: gewaehlt.length ? gewaehlt : ['*'] });
  }

  protected entfernen(): void {
    if (this.grund()) return;
    const n = this.name();
    this.arbeit.fragen({
      titel: `Remove the edge kind ${this.def()?.label ?? n}?`,
      text: ['No edge of this kind stands in the stock.'],
      ja: 'Remove',
      tun: () =>
        void this.arbeit.aendern('relations', (rels) => {
          delete rels[n];
        }),
    });
  }
}

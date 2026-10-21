import { Component, computed, input, output, signal } from '@angular/core';
import type { ColumnChoice } from '@nw/model';
import type { SpaltenQuelle } from '../kern/spalten';

/** Eine Gruppe der Auswahl: die Angaben jeder Zeile, dann je Typ, der die Felder erklärt, zuletzt die Kanten. */
interface Gruppe {
  label: string;
  wahl: ColumnChoice[];
}

/**
 * **„Columns"** (T-343): welche Spalten diese Tabelle zeigt, in welcher
 * Reihenfolge. Oben die gewählten — ziehen oder ↑↓, × nimmt heraus —,
 * darunter alles, was die Art (oder die Arten der Liste) anbietet, nach
 * Herkunft gruppiert und durchsuchbar. Erst „Apply" speichert; „Reset to
 * default" nimmt die eigene Wahl weg und zeigt wieder die Vorgabe.
 * Am Telefon ein Blatt von unten.
 */
@Component({
  selector: 'nw-spaltenwahl',
  template: `
    <div class="schleier" (click)="zu.emit()"></div>
    <section class="blatt" role="dialog" aria-modal="true" aria-labelledby="spaltenwahl-titel">
      <header>
        <h2 id="spaltenwahl-titel">Columns</h2>
        <span class="dim">{{ herkunft() }}</span>
        <button type="button" class="x" aria-label="Close" (click)="zu.emit()">×</button>
      </header>

      <ol class="gewaehlt" aria-label="Shown columns">
        <li class="fest"><span class="name">Name</span><span class="dim">always</span></li>
        @for (r of entwurf(); track r; let i = $index) {
          <li
            draggable="true"
            [class.ziel]="ziehZiel() === i"
            (dragstart)="ziehen(i, $event)"
            (dragover)="ueber(i, $event)"
            (drop)="ablegen(i, $event)"
            (dragend)="ziehZiel.set(null)"
          >
            <span class="griff" aria-hidden="true">⠿</span>
            <span class="name">{{ label(r) }}</span>
            <span class="dim">{{ gruppeVon(r) }}</span>
            <button type="button" [disabled]="i === 0" [attr.aria-label]="'Move ' + label(r) + ' up'" (click)="schieben(i, -1)">↑</button>
            <button type="button" [disabled]="i === entwurf().length - 1" [attr.aria-label]="'Move ' + label(r) + ' down'" (click)="schieben(i, 1)">↓</button>
            <button type="button" [attr.aria-label]="'Remove ' + label(r)" (click)="umschalten(r)">×</button>
          </li>
        } @empty {
          <li class="dim">Only the name.</li>
        }
      </ol>

      <label class="suche">
        <span class="sr">Find a field</span>
        <input type="search" placeholder="Find a field…" [value]="suche()" (input)="suche.set($any($event.target).value)" />
      </label>
      <div class="angebot">
        @for (g of gruppen(); track g.label) {
          <details [open]="!!suche() || g.label === erste()">
            <summary>{{ g.label }} <span class="dim">{{ g.wahl.length }}</span></summary>
            @for (c of g.wahl; track c.ref) {
              <label class="haken">
                <input type="checkbox" [checked]="entwurf().includes(c.ref)" (change)="umschalten(c.ref)" />
                {{ c.label }}
                @if (c.derived) {
                  <span class="dim" title="Calculated when read">calc.</span>
                }
              </label>
            }
          </details>
        } @empty {
          <p class="dim">No field matches.</p>
        }
      </div>

      <footer>
        <button type="button" class="pri" (click)="anwenden.emit(entwurf())">Apply</button>
        <button type="button" (click)="zuruecksetzen.emit()">Reset to default</button>
        @if (darfVorgabe()) {
          <button type="button" (click)="vorgabe.emit(entwurf())" title="Every account without its own choice sees these columns">
            Make campaign default
          </button>
          @if (hatVorgabe()) {
            <button type="button" (click)="vorgabe.emit(null)">Remove campaign default</button>
          }
        }
      </footer>
    </section>
  `,
  styles: `
    .schleier {
      position: fixed;
      inset: 0;
      background: rgb(0 0 0 / 0.25);
      z-index: 40;
    }
    .blatt {
      position: fixed;
      top: 70px;
      right: 1.2rem;
      width: min(420px, calc(100vw - 2rem));
      max-height: calc(100vh - 90px);
      overflow-y: auto;
      z-index: 41;
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 8px;
      box-shadow: 0 8px 28px rgb(0 0 0 / 0.25);
      padding: 0.9rem 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    header {
      display: flex;
      align-items: baseline;
      gap: 0.6rem;
    }
    h2 {
      margin: 0;
      font-family: var(--caps);
      font-size: 1.1rem;
      color: var(--heading);
    }
    .x {
      margin-left: auto;
      min-width: 36px;
      min-height: 36px;
    }
    .dim {
      color: var(--dim);
      font-size: 0.8rem;
    }
    .gewaehlt {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .gewaehlt li {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.25rem 0.4rem;
      border: 1px solid var(--line2);
      border-radius: 4px;
      background: var(--bar);
    }
    .gewaehlt li.ziel {
      border-color: var(--accent);
    }
    .gewaehlt li.fest {
      opacity: 0.7;
    }
    .gewaehlt .name {
      flex: 1;
      font-weight: 700;
    }
    .gewaehlt button {
      min-width: 32px;
      min-height: 32px;
    }
    .griff {
      cursor: grab;
      color: var(--dim);
    }
    .suche input {
      width: 100%;
      min-height: 38px;
      padding: 0 0.5rem;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--surface);
      color: inherit;
    }
    .sr {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
    }
    summary {
      cursor: pointer;
      font-weight: 700;
      padding: 0.3rem 0;
    }
    .haken {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      min-height: 32px;
      padding-left: 0.6rem;
    }
    footer {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      position: sticky;
      bottom: -0.9rem;
      background: var(--surface);
      padding: 0.5rem 0;
    }
    footer button {
      min-height: 38px;
    }
    @media (max-width: 760px) {
      .blatt {
        top: auto;
        bottom: 0;
        right: 0;
        left: 0;
        width: auto;
        max-height: 85vh;
        border-radius: 12px 12px 0 0;
      }
    }
  `,
})
export class Spaltenwahl {
  /** Die Spalten, die gerade stehen — der Anfang des Entwurfs. */
  readonly gewaehlt = input.required<string[]>();
  /** Was gewählt werden kann. */
  readonly angebot = input.required<ColumnChoice[]>();
  readonly quelle = input<SpaltenQuelle>(null);
  readonly darfVorgabe = input(false);
  readonly hatVorgabe = input(false);

  readonly anwenden = output<string[]>();
  readonly zuruecksetzen = output<void>();
  readonly vorgabe = output<string[] | null>();
  readonly zu = output<void>();

  protected readonly suche = signal('');
  protected readonly ziehZiel = signal<number | null>(null);
  private readonly _entwurf = signal<string[] | null>(null);
  protected readonly entwurf = computed(() => this._entwurf() ?? this.gewaehlt());
  private gezogen: number | null = null;

  protected readonly herkunft = computed(() => {
    switch (this.quelle()) {
      case 'address':
        return 'from the link';
      case 'own':
        return 'your choice';
      case 'campaign':
        return 'default of the campaign';
      default:
        return 'default of the type';
    }
  });

  protected readonly gruppen = computed<Gruppe[]>(() => {
    const q = this.suche().trim().toLowerCase();
    const je = new Map<string, ColumnChoice[]>();
    for (const c of this.angebot()) {
      if (q && !c.label.toLowerCase().includes(q) && !c.ref.toLowerCase().includes(q)) continue;
      (je.get(c.group) ?? je.set(c.group, []).get(c.group)!).push(c);
    }
    return [...je.entries()].map(([label, wahl]) => ({ label, wahl }));
  });
  protected readonly erste = computed(() => this.gruppen()[1]?.label ?? this.gruppen()[0]?.label);

  protected label(ref: string): string {
    return this.angebot().find((c) => c.ref === ref)?.label ?? ref;
  }
  protected gruppeVon(ref: string): string {
    return this.angebot().find((c) => c.ref === ref)?.group ?? '';
  }

  protected umschalten(ref: string): void {
    const e = this.entwurf();
    this._entwurf.set(e.includes(ref) ? e.filter((r) => r !== ref) : [...e, ref]);
  }
  protected schieben(i: number, um: number): void {
    const e = [...this.entwurf()];
    const j = i + um;
    if (j < 0 || j >= e.length) return;
    [e[i], e[j]] = [e[j]!, e[i]!];
    this._entwurf.set(e);
  }
  protected ziehen(i: number, ev: DragEvent): void {
    this.gezogen = i;
    ev.dataTransfer?.setData('text/plain', String(i));
  }
  protected ueber(i: number, ev: DragEvent): void {
    if (this.gezogen === null) return;
    ev.preventDefault();
    this.ziehZiel.set(i);
  }
  protected ablegen(i: number, ev: DragEvent): void {
    ev.preventDefault();
    const von = this.gezogen;
    this.gezogen = null;
    this.ziehZiel.set(null);
    if (von === null || von === i) return;
    const e = [...this.entwurf()];
    const [r] = e.splice(von, 1);
    e.splice(i, 0, r!);
    this._entwurf.set(e);
  }
}

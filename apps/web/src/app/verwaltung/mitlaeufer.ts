import { Component, computed, effect, input, model, output, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { EbenenMitlaeufer, EbenenWechsel } from '../kern/api';

/** Wie die Zeile sagt, woran ein Mitläufer hängt. */
const VIA: Record<string, string> = {
  partOf: 'part of',
  belongsTo: 'statblock of',
  carries: 'inventory of',
  holds: 'held in',
};

/**
 * **Was mitgeht, wenn ein Artikel die Ebene wechselt** (T-402, E-161 a+c):
 * Teile, eigener Statblock, Inventar und Stücke — mit Häkchen,
 * vorgewählt, was in derselben alten Ebene liegt und das Konto schreibt,
 * und je Zeile, wo der Mitläufer sonst noch verknüpft ist. Gerechnet am
 * Server (`POST /api/entities/move-layer` mit `dryRun`); hier wird nur
 * gewählt. Dieselbe Liste im Bearbeiten (Edit › Layer) und in der Liste
 * der Kampagne.
 */
@Component({
  selector: 'nw-mitlaeufer',
  imports: [RouterLink],
  template: `
    <section class="mitlaeufer" role="dialog" aria-labelledby="mitlaeufer-titel">
      <h3 id="mitlaeufer-titel">
        {{ verb() }} to {{ plan().target?.name ?? 'no layer' }}: what goes along?
      </h3>
      @if (verb() === 'Move') {
        <p class="dim">
          Ticked articles move with {{ wurzeln() }}. Unticked ones stay where they are. Versions and links stay.
          You can undo the whole move right after.
        </p>
      } @else {
        <p class="dim">Ticked articles are copied with {{ wurzeln() }} and hang on the copy. The originals stay as they are.</p>
      }
      <ul class="liste">
        @for (f of plan().followers; track f.id) {
          <li [class.aus]="!waehlbar(f)" [attr.data-id]="f.id">
            <label>
              <input
                type="checkbox"
                [checked]="gewaehlt().includes(f.id)"
                [disabled]="!waehlbar(f)"
                (change)="kipp(f.id)"
                [attr.aria-label]="'Move ' + f.name + ' too'"
              />
              <a [routerLink]="['/artikel', f.id]" target="_blank">{{ f.name }}</a>
            </label>
            <span class="dim">{{ f.type }} · {{ via(f) }} {{ name(f.of) }}</span>
            @if (f.already) {
              <span class="marke">already there</span>
            } @else if (!f.writable) {
              <span class="marke">you do not write it</span>
            } @else if (!f.sameLayer) {
              <span class="marke">in {{ ebenen(f.layers) }}</span>
            }
            @if (f.linkedFrom.length) {
              <span class="auch">
                also linked from
                @for (l of f.linkedFrom.slice(0, 3); track l.id; let last = $last) {
                  <a [routerLink]="['/artikel', l.id]" target="_blank">{{ l.name }}</a>{{ l.via === 'text' ? ' (text)' : '' }}{{ last ? '' : ', ' }}
                }
                @if (f.linkedFrom.length > 3) {
                  and {{ f.linkedFrom.length - 3 }} more
                }
              </span>
            }
          </li>
        }
      </ul>
      <div class="knoepfe">
        <button type="button" class="haupt" [disabled]="laeuft()" (click)="los.emit(gewaehlt())">
          {{ knopf() }}
        </button>
        @if (abbrechbar()) {
          <button type="button" class="leise" [disabled]="laeuft()" (click)="abbrechen.emit()">Cancel</button>
        }
      </div>
    </section>
  `,
  styles: `
    .mitlaeufer {
      padding: 0.8rem;
      margin: 0.6rem 0;
      border: 1px solid var(--accent);
      border-radius: 8px;
      background: var(--surface);
    }
    h3 {
      margin: 0 0 0.3rem;
      font-size: 1rem;
    }
    .dim {
      color: var(--dim);
      font-size: 0.85rem;
    }
    .liste {
      list-style: none;
      padding: 0;
      margin: 0.5rem 0;
      display: grid;
      gap: 0.35rem;
    }
    li {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0.2rem 0.6rem;
      padding: 0.3rem 0.4rem;
      border-bottom: 1px dotted var(--line);
      overflow-wrap: anywhere;
    }
    li.aus {
      opacity: 0.7;
    }
    label {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      min-height: 32px;
    }
    .marke {
      font-size: 0.75rem;
      padding: 0 0.35rem;
      border: 1px solid var(--line);
      border-radius: 4px;
    }
    .auch {
      flex-basis: 100%;
      font-size: 0.8rem;
      color: var(--dim);
      padding-left: 1.6rem;
    }
    .knoepfe {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .knoepfe button {
      min-height: 36px;
    }
  `,
})
export class Mitlaeufer {
  readonly plan = input.required<EbenenWechsel>();
  readonly laeuft = input(false);
  /** Verschieben (T-402) oder Kopieren (T-405) — dieselbe Liste. */
  readonly verb = input<'Move' | 'Copy'>('Move');
  readonly abbrechbar = input(true);
  /** Was mitgeht; beim neuen Plan die vorgewählten. */
  readonly gewaehlt = model<string[]>([]);
  readonly los = output<string[]>();
  readonly abbrechen = output<void>();

  constructor() {
    effect(() => {
      const p = this.plan();
      untracked(() => this.gewaehlt.set(p.followers.filter((f) => f.preselected).map((f) => f.id)));
    });
  }

  protected readonly wurzeln = computed(() => {
    const r = this.plan().roots;
    return r.length === 1 ? r[0]!.name : `the ${r.length} selected articles`;
  });
  protected readonly knopf = computed(() => {
    const n = this.gewaehlt().length;
    return n ? `${this.verb()} with ${n} more` : `${this.verb()} only the article`;
  });

  protected waehlbar(f: EbenenMitlaeufer): boolean {
    return f.writable && !f.already;
  }
  protected via(f: EbenenMitlaeufer): string {
    return VIA[f.via] ?? f.via;
  }
  protected name(id: string): string {
    const p = this.plan();
    return p.roots.find((r) => r.id === id)?.name ?? p.followers.find((f) => f.id === id)?.name ?? id;
  }
  protected ebenen(ids: string[]): string {
    return ids.length ? ids.map((id) => this.plan().layerNames[id] ?? id).join(', ') : 'no layer';
  }
  protected kipp(id: string): void {
    const g = this.gewaehlt();
    this.gewaehlt.set(g.includes(id) ? g.filter((x) => x !== id) : [...g, id]);
  }
}

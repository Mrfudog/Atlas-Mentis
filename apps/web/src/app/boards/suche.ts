import { Component, computed, inject, input, output, signal } from '@angular/core';
import { entityName, isInstance, primaryInterface } from '@nw/model';
import type { Entity } from '@nw/model';
import { Bestand } from '../kern/bestand';

/** So viele Treffer zeigt die Suche — 24 157 liest niemand. */
const TREFFER = 30;

/**
 * Einen Artikel aufs Board legen: suchen und anklicken. Gesucht wird in
 * der Kurzfassung (`Bestand.entities()`); ganz geholt wird er erst, wenn er
 * auf dem Board liegt. Instanzen stehen in keiner Liste, also auch nicht
 * hier, und was schon daliegt, nicht noch einmal.
 */
@Component({
  selector: 'nw-board-suche',
  template: `
    <input
      type="search"
      placeholder="Search articles by name…"
      [value]="suche()"
      (input)="suche.set($any($event.target).value)"
      aria-label="Search articles"
    />
    @if (suche().trim()) {
      <ul>
        @for (t of treffer(); track t.id) {
          <li>
            <button type="button" (click)="gewaehlt.emit(t)">
              <b>{{ name(t) }}</b>
              <span>{{ art(t) }}</span>
            </button>
          </li>
        } @empty {
          <li class="leer">Nothing matches — or it is already on the board.</li>
        }
      </ul>
    }
  `,
  styles: `
    :host {
      display: block;
      margin: 0.75rem 0 0;
      padding: 0.75rem;
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 6px;
    }
    input {
      width: 100%;
      min-height: 40px;
      padding: 0 0.6rem;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--paper);
    }
    ul {
      margin: 0.5rem 0 0;
      padding: 0;
      list-style: none;
      max-height: 16rem;
      overflow-y: auto;
    }
    button {
      display: flex;
      width: 100%;
      justify-content: space-between;
      gap: 1rem;
      border: 0;
      border-radius: 4px;
      background: none;
      text-align: left;
    }
    button:hover,
    button:focus-visible {
      background: var(--hover);
    }
    span,
    .leer {
      color: var(--dim);
    }
  `,
})
export class BoardSuche {
  /** Was nicht angeboten wird: das Board selbst und was schon daraufliegt. */
  readonly ohne = input<ReadonlySet<string>>(new Set());
  readonly gewaehlt = output<Entity>();

  private readonly bestand = inject(Bestand);
  protected readonly suche = signal('');

  protected readonly treffer = computed(() => {
    const q = this.suche().trim().toLowerCase();
    if (!q) return [];
    const ohne = this.ohne();
    const out: Entity[] = [];
    for (const e of this.bestand.entities()) {
      if (ohne.has(e.id) || isInstance(e)) continue;
      if (!entityName(e).toLowerCase().includes(q)) continue;
      out.push(e);
      if (out.length >= TREFFER) break;
    }
    return out;
  });

  protected name(e: Entity): string {
    return entityName(e);
  }
  protected art(e: Entity): string {
    const typ = primaryInterface(e);
    return this.bestand.registry()?.interfaces[typ]?.label ?? typ;
  }
}

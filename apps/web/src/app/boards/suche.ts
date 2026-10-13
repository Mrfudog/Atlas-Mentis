import { Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { entityName, primaryInterface } from '@nw/model';
import type { Entity } from '@nw/model';
import { Bestand, schmal } from '../kern/bestand';

/** So viele Treffer zeigt die Suche — 24 157 liest niemand. */
const TREFFER = 30;

/**
 * Einen Artikel aufs Board legen: suchen und anklicken. Gesucht wird am
 * Server (`/api/list?q=…`, W7) nach Name, Alias und Nummer; ganz geholt wird
 * er erst, wenn er auf dem Board liegt. Instanzen stehen in keiner Liste,
 * also auch nicht hier, und was schon daliegt, nicht noch einmal.
 */
@Component({
  selector: 'nw-board-suche',
  template: `
    <input
      type="search"
      placeholder="Search articles by name…"
      [value]="suche()"
      (input)="tippen($any($event.target).value)"
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
  private readonly gefunden = signal<Entity[]>([]);
  private lauf = 0;
  private uhr: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.uhr) clearTimeout(this.uhr);
    });
  }

  /** Gefragt wird nach einer kurzen Pause, nicht bei jedem Buchstaben. */
  protected tippen(q: string): void {
    this.suche.set(q);
    if (this.uhr) clearTimeout(this.uhr);
    if (!q.trim()) return;
    this.uhr = setTimeout(() => {
      const nr = ++this.lauf;
      void this.bestand
        .liste({ q, limit: TREFFER + 10 })
        .then((r) => {
          if (nr === this.lauf) this.gefunden.set(r.rows.map(schmal));
        })
        .catch(() => undefined);
    }, 200);
  }

  protected readonly treffer = computed(() => {
    if (!this.suche().trim()) return [];
    const ohne = this.ohne();
    return this.gefunden()
      .filter((e) => !ohne.has(e.id))
      .slice(0, TREFFER);
  });

  protected name(e: Entity): string {
    return entityName(e);
  }
  protected art(e: Entity): string {
    const typ = primaryInterface(e);
    return this.bestand.registry()?.interfaces[typ]?.label ?? typ;
  }
}

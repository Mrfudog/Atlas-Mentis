import { Component, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api, type KampagnenGeschichte } from '../kern/api';

/**
 * **Die Geschichte der Kampagne** (T-082, REQ-240) — auf der
 * Kampagnenseite, unter den Ebenen: was an der Kampagne selbst hängt
 * (`partOf`), und je aufgeschaltetes Abenteuer seine Kapitel. Ein Kapitel,
 * das die Kampagne angepasst hat (E-018), steht als ihre Fassung da, an der
 * Stelle des Originals, mit der Marke „adapted".
 *
 * Gelesen wird `GET /api/campaigns/:c/story`; nach dem Schalten einer Ebene
 * liest die Seite neu (`laden`), denn ein Abenteuer aufzuschalten heisst,
 * seine Kapitel in die Geschichte zu holen.
 */
@Component({
  selector: 'nw-kampagnen-geschichte',
  imports: [RouterLink],
  template: `
    <section class="kasten" aria-label="Story">
      <h2>Story</h2>
      <p class="fuss">
        What hangs on this campaign, and the chapters of every adventure it has turned on. Open a chapter
        to adapt it: the campaign gets its own version, the original stays.
      </p>
      @if (fehler(); as f) {
        <p class="fehler" role="alert">{{ f }}</p>
      }
      @if (daten(); as d) {
        @if (d.own.length) {
          <ul class="liste">
            @for (z of d.own; track z.id) {
              <li>
                <a [routerLink]="['/artikel', z.id]">{{ z.name }}</a>
                <span class="dim">{{ z.kind || z.type }}</span>
                @if (z.adapted) {
                  <span class="marke">adapted</span>
                }
              </li>
            }
          </ul>
        }
        @for (a of d.adventures; track a.id) {
          <h3>
            <a [routerLink]="['/artikel', a.id]">{{ a.name }}</a>
          </h3>
          <ol class="liste">
            @for (k of a.chapters; track k.id) {
              <li>
                <a [routerLink]="['/artikel', k.id]">{{ k.name }}</a>
                @if (k.adapted) {
                  <span class="marke">adapted</span>
                }
              </li>
            } @empty {
              <li class="dim">No chapters.</li>
            }
          </ol>
        }
        @if (!d.own.length && !d.adventures.length) {
          <p class="dim">
            Nothing yet. Turn on an adventure under “Books › Adventures” to bring its chapters in.
          </p>
        }
      } @else if (!fehler()) {
        <p class="dim">Loading…</p>
      }
    </section>
  `,
  styles: `
    /* Wie die übrigen Kästen der Kampagnenseite (ebenen.ts). */
    .kasten {
      min-width: 0;
      margin: 0 1.5rem 1rem;
      padding: 0.9rem;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--surface);
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }
    @media (max-width: 640px) {
      .kasten {
        margin: 0 1rem 1rem;
      }
    }
    h2 {
      margin: 0 0 0.25rem;
      font-family: var(--caps);
      font-size: 1.25rem;
      color: var(--accent);
    }
    h3 {
      margin: 0.75rem 0 0;
      font-family: var(--caps);
      font-size: 1.05rem;
    }
    h3 a {
      color: var(--accent);
    }
    .fuss {
      margin: 0;
      font-size: 0.82rem;
      color: var(--dim);
    }
    .liste {
      margin: 0.25rem 0 0;
      padding-left: 1.4rem;
      display: flex;
      flex-direction: column;
    }
    ul.liste {
      list-style: none;
      padding-left: 0;
    }
    li {
      padding: 0.35rem 0;
      border-top: 1px solid var(--line2);
      overflow-wrap: anywhere;
    }
    li:first-child {
      border-top: 0;
    }
    li a {
      display: inline-block;
      min-height: 28px;
      margin-right: 0.5rem;
    }
    .dim {
      color: var(--dim);
    }
    .marke {
      font-size: 0.75rem;
      padding: 0.05rem 0.4rem;
      border: 1px solid var(--accent);
      border-radius: 999px;
      color: var(--accent);
    }
    .fehler {
      color: var(--warn);
    }
  `,
})
export class KampagnenGeschichteListe {
  readonly kampagne = input.required<string>();

  private readonly api = inject(Api);
  protected readonly daten = signal<KampagnenGeschichte | null>(null);
  protected readonly fehler = signal<string | null>(null);

  constructor() {
    effect(() => {
      void this.laden(this.kampagne());
    });
  }

  /** Neu lesen — auch von aussen, nach dem Schalten einer Ebene. */
  async laden(c = this.kampagne()): Promise<void> {
    try {
      const d = await this.api.campaignStory(c);
      if (c !== this.kampagne()) return;
      this.daten.set(d);
      this.fehler.set(null);
    } catch (error) {
      this.daten.set(null);
      this.fehler.set(error instanceof Error ? error.message : String(error));
    }
  }
}

import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api, type ListenZeile } from '../kern/api';

/**
 * Die Klassen auf einen Blick (W6) — der Weg in die Klassenansicht.
 *
 * Gelesen wird aus der Liste am Server (`/api/list?type=Class`, W7): Name,
 * Quelle und Marken reichen für eine Kachel. Was eine Klasse ist, sagt ihre Art und keine Liste hier;
 * eine selbst angelegte Klasse steht genauso da wie eine aus dem Buch.
 */
@Component({
  selector: 'nw-klassen',
  imports: [RouterLink],
  template: `
    <div class="buch">
      <nav aria-label="Breadcrumb" class="brot">
        <a routerLink="/rules">Rules</a>
        <span aria-hidden="true">›</span>
        <span>Classes</span>
      </nav>
      <h1>Classes</h1>
      @if (!geladen()) {
        <p class="dim">Loading…</p>
      } @else if (fehler(); as f) {
        <p class="fehler" role="alert">{{ f }}</p>
      }
      @for (g of gruppen(); track g.titel) {
        @if (g.klassen.length) {
          <section>
            @if (g.titel) {
              <h2>{{ g.titel }}</h2>
            }
            <ul class="kacheln">
              @for (k of g.klassen; track k.id) {
                <li>
                  <a [routerLink]="['/classes', k.id]">
                    <span class="name">{{ k.name }}</span>
                    <span class="quelle">{{ k.quelle }}</span>
                  </a>
                </li>
              }
            </ul>
          </section>
        }
      }
      @if (
        geladen() &&
        !fehler() &&
        !gruppen()[0]!.klassen.length &&
        !gruppen()[1]!.klassen.length
      ) {
        <p class="dim">No classes here yet.</p>
      }
    </div>
  `,
  styles: `
    .buch {
      max-width: 1240px;
      margin: 0 auto;
      padding: 1.25rem 1.5rem 3rem;
    }
    .brot {
      display: flex;
      gap: 0.5rem;
      color: var(--dim);
      font-size: 0.9rem;
    }
    h1 {
      margin: 0.5rem 0 0.75rem;
      font-family: var(--caps);
      font-size: 2.5rem;
      color: var(--heading);
    }
    h2 {
      margin: 1.25rem 0 0.5rem;
      font-family: var(--caps);
      font-size: 1.3rem;
      font-weight: 500;
      color: var(--heading);
      border-bottom: 1px solid var(--heading);
    }
    .kacheln {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
      gap: 0.6rem;
    }
    .kacheln a {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      background: var(--paper);
      border-top: 3px solid var(--gold);
      border-radius: 0 0 6px 6px;
      box-shadow: 0 1px 4px rgba(43, 29, 18, 0.2);
      color: var(--ink);
      text-decoration: none;
    }
    .kacheln a:hover {
      background: var(--hover);
    }
    .name {
      font-family: var(--caps);
      font-size: 1.2rem;
      font-weight: 700;
      color: var(--heading);
    }
    .quelle,
    .dim {
      color: var(--dim);
      font-size: 0.85rem;
    }
    .fehler {
      color: var(--warn);
    }
    @media (max-width: 560px) {
      .buch {
        padding: 1rem;
      }
    }
  `,
})
export class Klassen {
  private readonly api = inject(Api);
  private readonly zeilen = signal<ListenZeile[]>([]);
  protected readonly geladen = signal(false);
  protected readonly fehler = signal<string | null>(null);

  constructor() {
    /* Klassen gibt es eine Handvoll (16 aus 5e.tools); ein Blatt reicht. */
    this.api
      .list({ type: 'Class', limit: 200 })
      .then((r) => this.zeilen.set(r.rows))
      .catch((e: Error) => this.fehler.set(e.message))
      .finally(() => this.geladen.set(true));
  }

  /** Die Klassen, die Gefährten (`sidekick`) für sich — wie im Buch. */
  protected readonly gruppen = computed(() => {
    const alle = this.zeilen()
      .map((z) => ({
        id: z.id,
        name: z.name,
        quelle: z.source.split(' p. ')[0] ?? '',
        gefaehrte: (z.tags ?? []).includes('sidekick'),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return [
      { titel: '', klassen: alle.filter((k) => !k.gefaehrte) },
      { titel: 'Sidekicks', klassen: alle.filter((k) => k.gefaehrte) },
    ];
  });
}

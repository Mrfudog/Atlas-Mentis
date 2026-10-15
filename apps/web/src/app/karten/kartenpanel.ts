import { Component, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api, type KartenVerwendung } from '../kern/api';
import { Bestand } from '../kern/bestand';
import { KurzLink } from '../kern/kurzansicht';

/**
 * **Wo eine Karte vorkommt** (T-202), auf ihrer Artikelseite: Sitzungen,
 * an denen sie auf dem Tisch liegt (`SessionState.activeMap`), Szenen und
 * Kämpfe mit `onMap` und was sie darstellt (`mapOf`). Gesiebt am Server
 * (`GET /api/maps/:id/uses`) — ein Feldverweis steht in keinem Rückbezug,
 * darum reicht „Linked here“ nicht. Dazu der Weg in Play und zur Liste.
 */
@Component({
  selector: 'nw-kartenpanel',
  imports: [RouterLink, KurzLink],
  template: `
    <section class="kasten">
      <h2>Used in</h2>
      @if (uses().length) {
        <ul class="kanten">
          @for (u of uses(); track u.id + u.via) {
            <li>
              <span class="rl">{{ wie(u) }}</span>
              <a [routerLink]="['/artikel', u.id]" [nwQuick]="u.id">{{ u.name }}</a>
            </li>
          }
        </ul>
      } @else if (geladen()) {
        <p class="dim">No session or scene uses this map yet. Set <i>Map on the table</i> on a session.</p>
      }
      <p class="wege">
        <a [routerLink]="['/play']" [queryParams]="{ map: karte() }">Open in Play</a>
        · <a routerLink="/maps">All maps</a>
      </p>
    </section>
  `,
  styles: `
    .dim {
      color: var(--dim);
    }
    .wege {
      margin: 0.5rem 0 0;
    }
  `,
})
export class KartenPanel {
  readonly karte = input.required<string>();

  private readonly api = inject(Api);
  private readonly bestand = inject(Bestand);
  protected readonly uses = signal<KartenVerwendung[]>([]);
  protected readonly geladen = signal(false);
  private lauf = 0;

  constructor() {
    effect(() => {
      const id = this.karte();
      const nr = ++this.lauf;
      this.geladen.set(false);
      this.api
        .mapUses(id)
        .then((r) => {
          if (nr === this.lauf) this.uses.set(r.uses);
        })
        .catch(() => {
          if (nr === this.lauf) this.uses.set([]);
        })
        .finally(() => {
          if (nr === this.lauf) this.geladen.set(true);
        });
    });
  }

  /** Wie die Karte vorkommt — die Art des Artikels und, wo es mehr sagt, das Wie. */
  protected wie(u: KartenVerwendung): string {
    const art = this.bestand.registry()?.interfaces[u.type]?.label ?? u.type;
    if (u.via === 'SessionState.activeMap') return `${art} · on the table`;
    if (u.via === 'mapOf') return `Map of · ${art}`;
    if (u.via === 'onMap') return `${art} · played here`;
    return art;
  }
}

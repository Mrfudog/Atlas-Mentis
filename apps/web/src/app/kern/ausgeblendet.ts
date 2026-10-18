import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Ausgeblendet } from './api';

/**
 * **Was fehlt, weil seine Ebene nicht aufgeschaltet ist** (T-069) — ein
 * Hinweis über Kompendium, Bereichen und der Board-Suche.
 *
 * Auf dev verschwanden nach dem Anlegen einer Kampagne alle Artikel aus
 * 5e.tools: sobald es eine Kampagne gibt, steht in den Listen nur, was ihre
 * aufgeschalteten Ebenen bringen (E2). Nichts war gelöscht, aber die Seite
 * sagte es nicht. Die Zahl rechnet der Server mit denselben Filtern wie das
 * Blatt (`unactivated` in `/api/list`).
 *
 * **Eine Zeile, kein Verzeichnis** (T-207): welche Ebenen das sind und das
 * Aufschalten selbst stehen an der Kampagne — hier steht nur, dass etwas
 * fehlt, und der Weg dorthin.
 */
@Component({
  selector: 'nw-ausgeblendet',
  imports: [RouterLink],
  template: `
    @if (info(); as i) {
      <p class="hinweis" role="note" [class.knapp]="knapp()">
        {{ zahl(i.total) }} {{ i.total === 1 ? 'article is' : 'articles are' }} in layers
        ‘{{ i.campaign.name }}’ does not put in play.
        @if (i.canManage) {
          <a routerLink="/campaign" [queryParams]="{ c: i.campaign.id, tab: 'layers' }">Change layers</a>
        } @else {
          The GM of the campaign turns layers on.
        }
      </p>
    }
  `,
  styles: `
    .hinweis {
      margin: 0.75rem 0 0;
      padding: 0.45rem 0.85rem;
      border: 1px dashed var(--line);
      border-left: 3px solid var(--gold);
      border-radius: 6px;
      background: var(--surface);
      color: var(--dim);
      font-size: 0.92em;
    }
    a {
      color: var(--link);
      white-space: nowrap;
    }
    .knapp {
      margin: 0.5rem 0 0;
      padding: 0.35rem 0.6rem;
    }
  `,
})
export class AusgeblendetHinweis {
  readonly info = input<Ausgeblendet | null | undefined>(null);
  /** Kleiner, für die Board-Suche. */
  readonly knapp = input(false);

  protected zahl(n: number): string {
    return n.toLocaleString('en');
  }
}

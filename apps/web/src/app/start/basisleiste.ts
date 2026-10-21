import { ChangeDetectionStrategy, Component, DOCUMENT, DestroyRef, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Heim } from '../kern/heim';
import { Suche } from '../kern/suche';

/**
 * **Die Basis-Leiste für Spielende** (T-342, REQ-358): feste Wege zurück zum
 * Kampagnenboard, zur eigenen Figur, zu den Karten, zur Suche und zum
 * Wissen. Wer mitspielt, soll zwischen Board und Figur wechseln, ohne im
 * Kompendium zu suchen — die Kopfleiste bleibt, das hier ist der kurze Weg.
 *
 * Am Telefon unten (dort liegt der Daumen), am Desktop unter der
 * Kopfleiste. Was die Ziele zeigen, siebt der Server: freigegebene Karten,
 * gewusstes Wissen. Geladen wird sie erst, wenn jemand mitspielt
 * (`@defer` im Gerüst) — das Startpaket trägt sie nicht.
 */
@Component({
  selector: 'nw-basisleiste',
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (heim.heim(); as h) {
      <nav class="basis" aria-label="Table">
        @if (h.board) {
          <a [routerLink]="['/boards', h.board.id]" routerLinkActive="an" ariaCurrentWhenActive="page" [title]="h.board.name">
            <span class="zeichen" aria-hidden="true">▦</span><span class="wort">Board</span>
          </a>
        }
        @if (h.character) {
          <a [routerLink]="['/artikel', h.character.id]" routerLinkActive="an" ariaCurrentWhenActive="page" [title]="h.character.name">
            <span class="zeichen" aria-hidden="true">☺</span><span class="wort">My character</span>
          </a>
        }
        <a routerLink="/maps" routerLinkActive="an" ariaCurrentWhenActive="page">
          <span class="zeichen" aria-hidden="true">⌖</span><span class="wort">Maps</span>
        </a>
        <button type="button" (click)="suche.oeffnen()">
          <span class="zeichen" aria-hidden="true">⌕</span><span class="wort">Search</span>
        </button>
        <a routerLink="/compendium" [queryParams]="{ type: 'Knowledge' }" title="Handouts and what your party knows">
          <span class="zeichen" aria-hidden="true">✉</span><span class="wort">Knowledge</span>
        </a>
      </nav>
    }
  `,
  styles: `
    .basis {
      position: sticky;
      top: 0;
      z-index: 25;
      display: flex;
      justify-content: center;
      gap: 0.25rem 1rem;
      padding: 0.25rem 1rem;
      background: var(--surface);
      border-bottom: 1px solid var(--line);
    }
    .basis a,
    .basis button {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.3rem 0.6rem;
      border: 0;
      border-radius: 4px;
      background: none;
      color: var(--ink);
      font: inherit;
      font-size: 0.95rem;
      text-decoration: none;
      cursor: pointer;
    }
    .basis a:hover,
    .basis button:hover {
      background: var(--hover);
    }
    .basis a.an {
      color: var(--accent);
      font-weight: 700;
    }
    .zeichen {
      font-size: 1.1rem;
      line-height: 1;
    }
    /* Am Telefon unten, gleich breit verteilt, Zeichen über Wort. */
    @media (max-width: 640px) {
      .basis {
        position: fixed;
        top: auto;
        bottom: 0;
        left: 0;
        right: 0;
        justify-content: space-around;
        gap: 0;
        padding: 0.2rem 0 calc(0.2rem + env(safe-area-inset-bottom));
        border-top: 1px solid var(--line);
        border-bottom: 0;
      }
      .basis a,
      .basis button {
        flex: 1 1 0;
        flex-direction: column;
        gap: 0.1rem;
        padding: 0.25rem 0.1rem;
        font-size: 0.7rem;
      }
    }
  `,
})
export class Basisleiste {
  protected readonly heim = inject(Heim);
  protected readonly suche = inject(Suche);

  constructor() {
    /* Am Telefon liegt die Leiste über dem unteren Rand: die Seite rückt
       ab, und feste Leisten anderer Seiten stellen sich darüber
       (`--basis-unten`, styles.scss). */
    const body = inject(DOCUMENT).body;
    body.classList.add('mit-basis');
    inject(DestroyRef).onDestroy(() => body.classList.remove('mit-basis'));
  }
}

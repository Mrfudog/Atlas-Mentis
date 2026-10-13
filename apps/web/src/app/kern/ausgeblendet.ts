import { Component, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api, type Ausgeblendet } from './api';

/**
 * **Was fehlt, weil seine Ebene nicht aufgeschaltet ist** (T-069) — ein
 * Hinweis über Kompendium, Bereichen und der Board-Suche.
 *
 * Auf dev verschwanden nach dem Anlegen einer Kampagne alle Artikel aus
 * 5e.tools: sobald es eine Kampagne gibt, steht in den Listen nur, was ihre
 * aufgeschalteten Ebenen bringen (E2). Nichts war gelöscht, aber die Seite
 * sagte es nicht. Die Zahl je Ebene rechnet der Server mit denselben
 * Filtern wie das Blatt (`unactivated` in `/api/list`); ob der Knopf da
 * ist, sagt er auch (`canActivate`).
 */
@Component({
  selector: 'nw-ausgeblendet',
  imports: [RouterLink],
  template: `
    @if (info(); as i) {
      <aside class="hinweis" role="note" [class.knapp]="knapp()">
        <p>
          <b>{{ zahl(i.total) }} {{ i.total === 1 ? 'article' : 'articles' }}</b>
          {{ i.total === 1 ? 'is' : 'are' }} hidden in layers that
          ‘{{ i.campaign.name }}’ does not put in play:
        </p>
        <ul>
          @for (l of i.layers; track l.id) {
            <li>
              <span>{{ l.name }}</span> <span class="zahl">{{ zahl(l.count) }}</span>
              @if (l.canActivate) {
                <button type="button" [disabled]="laeuft()" (click)="aufschalten(i.campaign.id, l.id)">
                  Turn on
                </button>
              }
            </li>
          }
        </ul>
        @if (fehler(); as f) {
          <p class="fehler" role="alert">{{ f }}</p>
        }
        <p class="fuss">
          Nothing is deleted — a campaign shows only what its layers bring.
          @if (darf()) {
            <a routerLink="/campaign" [queryParams]="{ c: i.campaign.id }">Layers in play</a>
          } @else {
            The GM of the campaign turns layers on.
          }
        </p>
      </aside>
    }
  `,
  styles: `
    .hinweis {
      margin: 0.75rem 0 0;
      padding: 0.6rem 0.85rem;
      border: 1px dashed var(--line);
      border-left: 3px solid var(--gold);
      border-radius: 6px;
      background: var(--surface);
      color: var(--ink);
    }
    p {
      margin: 0;
    }
    ul {
      margin: 0.35rem 0;
      padding: 0;
      list-style: none;
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem 1rem;
    }
    li {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
    }
    .zahl,
    .fuss {
      color: var(--dim);
    }
    .fuss {
      font-size: 0.92em;
    }
    .fuss a {
      color: var(--link);
    }
    button {
      min-height: 32px;
      padding: 0 0.7rem;
      border: 1px solid var(--accent);
      border-radius: 6px;
      background: var(--accent);
      color: var(--accent-ink);
      cursor: pointer;
    }
    button[disabled] {
      opacity: 0.6;
    }
    .fehler {
      color: var(--warn);
    }
    .knapp {
      margin: 0.5rem 0 0;
      padding: 0.45rem 0.6rem;
    }
  `,
})
export class AusgeblendetHinweis {
  readonly info = input<Ausgeblendet | null | undefined>(null);
  /** Kleiner, für die Board-Suche. */
  readonly knapp = input(false);
  /** Nach dem Aufschalten: die Liste neu fragen. */
  readonly geaendert = output<void>();

  private readonly api = inject(Api);
  protected readonly laeuft = signal(false);
  protected readonly fehler = signal<string | null>(null);
  protected readonly darf = computed(() => (this.info()?.layers ?? []).some((l) => l.canActivate));

  protected zahl(n: number): string {
    return n.toLocaleString('en');
  }

  protected async aufschalten(kampagne: string, ebene: string): Promise<void> {
    this.laeuft.set(true);
    this.fehler.set(null);
    try {
      await this.api.activateLayer(kampagne, ebene);
      this.geaendert.emit();
    } catch (error) {
      this.fehler.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.laeuft.set(false);
    }
  }
}

import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api, ApiError, type KorbArtikel, type KorbLauf } from '../kern/api';

/**
 * **Deleted — der Papierkorb** (T-400, E-160 a, REQ-394).
 *
 * Jedes Löschen aus der eigenen Ebene (T-381) steht hier dreissig Tage:
 * je Lauf eine Gruppe mit ihren Artikeln, „Restore" je Artikel und je
 * Lauf. Eine Spielerin sieht, was sie selbst gelöscht hat, die Leitung
 * alles, was sie sehen darf — gesiebt wird am Server. „Empty trash" ist
 * endgültig: erst dann gehen die Bilddateien, und auch die Werkbank holt
 * nichts mehr zurück.
 */
@Component({
  selector: 'nw-papierkorb',
  imports: [RouterLink],
  template: `
    <div class="seite">
      <header class="kopf">
        <h1>Deleted</h1>
        <p class="dim">
          What you deleted stays here for {{ tage() }} days — restore it, or empty the trash to delete it for good.
          @if (laeufe().length && !alleEigen()) {
            As game master you also see what others deleted.
          }
        </p>
        <button type="button" class="gefahr" [disabled]="!offen() || arbeitet()" (click)="leeren()">Empty trash</button>
      </header>

      @if (meldung(); as m) {
        <p class="ergebnis" role="status">{{ m }}</p>
      }
      @if (problem(); as p) {
        <p class="problem" role="alert">{{ p }}</p>
      }

      @if (geladen() && !laeufe().length) {
        <p class="leer">Nothing deleted in the last {{ tage() }} days.</p>
      }

      @for (l of laeufe(); track l.id) {
        <section class="lauf" [attr.aria-label]="'Deleted ' + datum(l.at)">
          <div class="laufkopf">
            <h2>
              {{ datum(l.at) }}
              @if (!l.own) {
                <span class="wer">by {{ l.by.name }}</span>
              }
            </h2>
            <span class="frist" [attr.title]="'Deleted for good on ' + datum(l.expires)">until {{ tag(l.expires) }}</span>
            @if (offeneIn(l) > 1) {
              <button type="button" [disabled]="arbeitet()" (click)="zurueck(l)">Restore all</button>
            }
          </div>
          <ul>
            @for (a of l.items; track a.id) {
              <li [class.zurueck]="a.restored">
                <span class="name">
                  @if (a.restored) {
                    <a [routerLink]="['/artikel', a.id]">{{ a.name }}</a>
                  } @else {
                    {{ a.name }}
                  }
                </span>
                <span class="art">
                  {{ a.type }}
                  @for (e of a.layers; track e.id) {
                    · {{ e.name }}
                  }
                  @if (a.parts) {
                    · +{{ a.parts }} {{ a.parts === 1 ? 'part' : 'parts' }}
                  }
                </span>
                @if (a.restored) {
                  <span class="marke">Restored</span>
                } @else {
                  <button type="button" [disabled]="arbeitet()" (click)="zurueck(l, a)" [attr.aria-label]="'Restore ' + a.name">
                    Restore
                  </button>
                }
              </li>
            }
          </ul>
        </section>
      }
    </div>
  `,
  styles: `
    .seite {
      max-width: 860px;
      margin: 0 auto;
      padding: 1.25rem 1.5rem 3rem;
    }
    .kopf {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0.5rem 1rem;
    }
    .kopf p {
      flex: 1 1 22rem;
      margin: 0;
    }
    h1 {
      font-family: var(--caps);
      color: var(--accent);
      margin: 0;
      font-size: 1.9rem;
      flex-basis: 100%;
    }
    .dim,
    .art,
    .frist,
    .wer {
      color: var(--dim);
    }
    .lauf {
      margin-top: 1.25rem;
      border-top: 1px solid var(--line, #c9b98f);
      padding-top: 0.5rem;
    }
    .laufkopf {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0.25rem 0.75rem;
    }
    h2 {
      font-size: 1.05rem;
      margin: 0;
      flex: 1 1 auto;
    }
    .wer {
      font-weight: normal;
      font-size: 0.9rem;
    }
    ul {
      list-style: none;
      margin: 0.4rem 0 0;
      padding: 0;
    }
    li {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0.15rem 0.75rem;
      padding: 0.35rem 0;
    }
    li + li {
      border-top: 1px dotted var(--line, #c9b98f);
    }
    .name {
      font-weight: 600;
      flex: 1 1 12rem;
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .art {
      font-size: 0.9rem;
      flex: 1 1 12rem;
    }
    li.zurueck .name {
      font-weight: normal;
    }
    .marke {
      font-size: 0.85rem;
      color: var(--dim);
    }
    .gefahr {
      color: var(--danger, #8b1e1e);
    }
    .problem {
      color: var(--danger, #8b1e1e);
    }
    .leer {
      color: var(--dim);
      margin-top: 2rem;
    }
    @media (max-width: 640px) {
      .seite {
        padding: 0.75rem 0.75rem 2rem;
      }
    }
  `,
})
export class Papierkorb {
  private readonly api = inject(Api);

  protected readonly laeufe = signal<KorbLauf[]>([]);
  protected readonly tage = signal(30);
  protected readonly geladen = signal(false);
  protected readonly arbeitet = signal(false);
  protected readonly meldung = signal<string | null>(null);
  protected readonly problem = signal<string | null>(null);
  protected readonly offen = computed(() => this.laeufe().some((l) => this.offeneIn(l) > 0));
  protected readonly alleEigen = computed(() => this.laeufe().every((l) => l.own));

  constructor() {
    void this.laden();
  }

  protected offeneIn(l: KorbLauf): number {
    return l.items.filter((a) => !a.restored).length;
  }

  private async laden(): Promise<void> {
    try {
      const r = await this.api.trash();
      this.tage.set(r.days);
      this.laeufe.set(r.runs);
    } catch (e) {
      this.problem.set(e instanceof ApiError ? e.message : 'The deleted articles did not load.');
    } finally {
      this.geladen.set(true);
    }
  }

  /** Einen Artikel oder alles Übrige eines Laufs zurück. */
  protected async zurueck(l: KorbLauf, a?: KorbArtikel): Promise<void> {
    this.arbeitet.set(true);
    this.problem.set(null);
    try {
      const r = await this.api.restoreTrash(l.id, a ? [a.id] : undefined);
      const n = r.restored.length;
      this.meldung.set(a ? `Restored “${a.name}”.` : `Restored ${n} ${n === 1 ? 'article' : 'articles'}.`);
      await this.laden();
    } catch (e) {
      this.problem.set(e instanceof ApiError ? e.message : 'Restoring failed.');
    } finally {
      this.arbeitet.set(false);
    }
  }

  protected async leeren(): Promise<void> {
    const n = this.laeufe().reduce((s, l) => s + this.offeneIn(l), 0);
    if (typeof confirm === 'function' && !confirm(`Delete ${n} ${n === 1 ? 'article' : 'articles'} for good? This cannot be undone.`)) return;
    this.arbeitet.set(true);
    this.problem.set(null);
    try {
      await this.api.emptyTrash();
      this.meldung.set('Trash emptied.');
      await this.laden();
    } catch (e) {
      this.problem.set(e instanceof ApiError ? e.message : 'Emptying failed.');
    } finally {
      this.arbeitet.set(false);
    }
  }

  protected datum(iso: string): string {
    return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  protected tag(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }
}

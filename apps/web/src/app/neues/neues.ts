import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Neues, type NeuEintrag } from '../kern/neues';

/**
 * **What's new** (T-157): was auf der Seite neu ist, nach Tag, mit Sprung
 * an die Stelle.
 *
 * Was beim Öffnen neu war, trägt die Marke „new" — gemerkt beim Öffnen,
 * denn im selben Zug wird der Stand am Konto weitergeschoben und der Punkt
 * in der Kopfleiste geht aus. Die Marke bleibt, bis man die Seite verlässt:
 * wer nachliest, soll sehen, was er gerade zum ersten Mal liest.
 *
 * Nach Bereich einengen lässt sich die Liste über die Marken oben; sie
 * kommen aus den Einträgen selbst, nicht aus einer Liste im Code.
 */
@Component({
  selector: 'nw-neues',
  imports: [RouterLink],
  template: `
    <div class="seite">
      <header class="kopf">
        <h1>What's new</h1>
        <p class="hinweis">
          What changed on this site, newest first.
          @if (neu().size) {
            <strong>{{ neu().size }} new</strong> since your last visit.
          }
        </p>
      </header>

      <nav class="bereiche" aria-label="Filter by area">
        <button
          type="button"
          [class.an]="!bereich()"
          [attr.aria-pressed]="!bereich()"
          (click)="bereich.set(null)"
        >
          All
        </button>
        @for (b of bereiche(); track b) {
          <button
            type="button"
            [class.an]="bereich() === b"
            [attr.aria-pressed]="bereich() === b"
            (click)="bereich.set(b)"
          >
            {{ b }}
          </button>
        }
      </nav>

      @for (tag of tage(); track tag.datum) {
        <section class="tag" [attr.aria-labelledby]="'t-' + tag.datum">
          <h2 [id]="'t-' + tag.datum">{{ datum(tag.datum) }}</h2>
          <ul>
            @for (e of tag.eintraege; track e.id) {
              <li class="eintrag" [class.ist-neu]="neu().has(e.id)">
                @if (e.image) {
                  <img [src]="e.image" alt="" loading="lazy" />
                }
                <div class="koerper">
                  <h3>
                    {{ e.title }}
                    @if (neu().has(e.id)) {
                      <span class="marke-neu">new</span>
                    }
                  </h3>
                  <p>{{ e.text }}</p>
                  <p class="fuss">
                    <span class="bereich">{{ e.area }}</span>
                    @if (e.link) {
                      <a [routerLink]="e.link" [queryParams]="e.query ?? null">Go there →</a>
                    }
                  </p>
                </div>
              </li>
            }
          </ul>
        </section>
      } @empty {
        <p class="leer">Nothing here.</p>
      }
    </div>
  `,
  styles: `
    .seite {
      max-width: 820px;
      margin: 0 auto;
      padding: 1.25rem 1.5rem 3rem;
    }
    h1,
    h2,
    h3 {
      font-family: var(--caps);
      color: var(--heading);
    }
    h1 {
      margin: 0 0 0.25rem;
    }
    .hinweis {
      margin: 0 0 1rem;
      color: var(--dim);
    }
    .hinweis strong {
      color: var(--accent);
    }
    .bereiche {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
      margin-bottom: 1rem;
    }
    .bereiche button {
      padding: 0.25rem 0.65rem;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--surface);
      color: var(--ink);
      font-size: 0.9rem;
    }
    .bereiche button.an {
      border-color: var(--accent);
      background: var(--chip);
      font-weight: 700;
    }
    .tag h2 {
      margin: 1.25rem 0 0.5rem;
      font-size: 1.1rem;
      border-bottom: 1px solid var(--line2);
    }
    ul {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .eintrag {
      display: flex;
      gap: 0.75rem;
      margin-bottom: 0.5rem;
      padding: 0.6rem 0.8rem;
      border: 1px solid var(--line2);
      border-left: 3px solid transparent;
      border-radius: 6px;
      background: var(--surface);
    }
    .eintrag.ist-neu {
      border-left-color: var(--accent);
    }
    .eintrag img {
      width: 120px;
      max-height: 90px;
      flex: none;
      object-fit: cover;
      border-radius: 4px;
    }
    .koerper {
      min-width: 0;
    }
    h3 {
      margin: 0 0 0.2rem;
      font-size: 1.05rem;
    }
    .koerper p {
      margin: 0 0 0.3rem;
    }
    .marke-neu {
      margin-left: 0.35rem;
      padding: 0 0.4rem;
      border-radius: 10px;
      background: var(--accent);
      color: var(--accent-ink);
      font-family: var(--sans);
      font-size: 0.7rem;
      vertical-align: middle;
    }
    .fuss {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      font-size: 0.9rem;
    }
    .bereich {
      color: var(--dim);
    }
    .fuss a {
      color: var(--link);
    }
    .leer {
      color: var(--dim);
    }
    @media (max-width: 640px) {
      .seite {
        padding: 0.75rem 0.75rem 2rem;
      }
      .eintrag {
        flex-direction: column;
      }
      .eintrag img {
        width: 100%;
        max-height: 160px;
      }
    }
  `,
})
export class NeuesSeite {
  private readonly neues = inject(Neues);
  /** Was beim Öffnen neu war — gemerkt, bevor der Stand weiterrückt. */
  protected readonly neu = signal<Set<string>>(new Set());
  protected readonly bereich = signal<string | null>(null);
  protected readonly bereiche = computed(() =>
    [...new Set(this.neues.eintraege.map((e) => e.area))].sort(),
  );

  protected readonly tage = computed(() => {
    const b = this.bereich();
    const je = new Map<string, NeuEintrag[]>();
    for (const e of this.neues.eintraege) {
      if (b && e.area !== b) continue;
      (je.get(e.date) ?? je.set(e.date, []).get(e.date)!).push(e);
    }
    return [...je]
      .sort(([a], [z]) => z.localeCompare(a))
      .map(([datum, eintraege]) => ({ datum, eintraege }));
  });

  constructor() {
    void this.oeffnen();
  }

  private async oeffnen(): Promise<void> {
    await this.neues.laden();
    this.neu.set(this.neues.neuJetzt());
    await this.neues.gesehen();
  }

  protected datum(iso: string): string {
    const d = new Date(`${iso}T12:00:00Z`);
    return Number.isNaN(d.getTime())
      ? iso
      : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  }
}

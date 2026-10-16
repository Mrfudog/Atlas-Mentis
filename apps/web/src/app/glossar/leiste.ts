import { Component, HostListener, computed, effect, inject, signal, untracked, viewChild, type ElementRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { glossarySortLabel } from '@nw/model';
import { Api } from '../kern/api';
import { Glossar } from '../kern/glossar';
import { KurzLink } from '../kern/kurzansicht';

/**
 * **Die Glossarleiste** (T-242): der offene Eintrag rechts neben der
 * Seite, wie im Design-Canvas — Begriff, Aliasse, Definition, „How it
 * affects play", Beispiele, wo er genannt wird, Übersetzungen.
 *
 * Die Nennungen fragt sie beim Öffnen am Server (`/api/glossary/:id/uses`,
 * gesiebt); die Wörter der App zählt der Server nicht. Escape und ×
 * schliessen.
 */
@Component({
  selector: 'nw-glossar-leiste',
  imports: [RouterLink, KurzLink],
  template: `
    <aside class="panel" role="dialog" aria-labelledby="glossar-titel" tabindex="-1" #panel>
      <header>
        <span class="kopf">Glossary</span>
        <button type="button" class="zu" (click)="glossar.schliessen()" aria-label="Close glossary">×</button>
      </header>
      @if (eintrag(); as e) {
        <h2 id="glossar-titel">{{ e.term }}</h2>
        <p class="sorte">{{ sorte(e.sort) }}</p>
        @if (e.aliases.length) {
          <p class="dim">Also: {{ e.aliases.join(', ') }}</p>
        }
        @if (e.definition) {
          <p class="def">{{ e.definition }}</p>
        }
        @if (e.effect) {
          <section>
            <h3>How it affects play</h3>
            <p>{{ e.effect }}</p>
          </section>
        }
        @if (e.examples.length) {
          <section>
            <h3>{{ e.examples.length === 1 ? 'Example' : 'Examples' }}</h3>
            @for (b of e.examples; track $index) {
              <p class="beispiel">{{ b }}</p>
            }
          </section>
        }
        @if (e.explains.length) {
          <section>
            <h3>Explains</h3>
            <ul>
              @for (x of e.explains; track x.id) {
                <li><a [routerLink]="['/artikel', x.id]" [nwQuick]="x.id">{{ x.name }}</a></li>
              }
            </ul>
          </section>
        }
        @if (nennungen(); as n) {
          @if (n.counted) {
            <section>
              <h3>Used in {{ n.total }} {{ n.total === 1 ? 'place' : 'places' }}</h3>
              <ul>
                @for (r of n.rows; track r.id) {
                  <li><a [routerLink]="['/artikel', r.id]" [nwQuick]="r.id">{{ r.name }}</a></li>
                }
              </ul>
              @if (n.total > n.rows.length) {
                <p class="dim">and {{ n.total - n.rows.length }} more</p>
              }
            </section>
          }
        }
        @if (e.translations.length) {
          <section>
            <h3>Translations</h3>
            <dl>
              @for (t of e.translations; track t.lang) {
                <dt>{{ t.lang }}</dt>
                <dd>
                  {{ t.term }}
                  @if (t.definition) {
                    <span class="dim">— {{ t.definition }}</span>
                  }
                </dd>
              }
            </dl>
          </section>
        }
        <p class="fuss">
          @if (e.article) {
            <a [routerLink]="['/artikel', e.id]" (click)="glossar.schliessen()">Open article</a>
          }
          @if (e.see) {
            <a [routerLink]="pfad(e.see)" [fragment]="anker(e.see)" (click)="glossar.schliessen()">Read more</a>
          }
          <a routerLink="/handbook" fragment="glossary" (click)="glossar.schliessen()">All terms</a>
        </p>
      } @else if (glossar.eintraege() === null) {
        <p class="dim">Loading …</p>
      } @else {
        <p class="dim">This term is not in the glossary of this campaign.</p>
      }
    </aside>
  `,
  styles: `
    .panel {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      z-index: 31;
      width: min(24rem, 100vw);
      box-sizing: border-box;
      overflow-y: auto;
      padding: 1rem 1.25rem 2rem;
      background: var(--surface);
      border-left: 3px solid var(--accent);
      box-shadow: -2px 0 12px rgb(0 0 0 / 0.15);
      color: var(--ink);
      outline: none;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .kopf {
      font-family: var(--caps);
      color: var(--accent);
      letter-spacing: 0.04em;
    }
    h2 {
      margin: 0.5rem 0 0;
      font-size: 1.35rem;
    }
    h3 {
      margin: 1rem 0 0.25rem;
      font-size: 0.95rem;
      color: var(--accent);
    }
    p {
      margin: 0.3rem 0;
      line-height: 1.45;
    }
    .sorte {
      margin: 0;
      font-size: 0.85rem;
      color: var(--dim);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .def {
      font-size: 1.02rem;
    }
    .beispiel {
      font-style: italic;
      padding-left: 0.6rem;
      border-left: 2px solid var(--line);
    }
    ul {
      margin: 0;
      padding-left: 1.2rem;
    }
    dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 0.2rem 0.75rem;
      margin: 0;
    }
    dt {
      font-weight: 600;
      text-transform: uppercase;
      font-size: 0.85rem;
    }
    dd {
      margin: 0;
    }
    .dim {
      color: var(--dim);
    }
    .zu {
      min-height: 0;
      padding: 0.1rem 0.5rem;
      font-size: 1.2rem;
    }
    .fuss {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      margin-top: 1.25rem;
      padding-top: 0.5rem;
      border-top: 1px solid var(--line);
      font-size: 0.9rem;
    }
  `,
})
export class GlossarLeiste {
  protected readonly glossar = inject(Glossar);
  private readonly api = inject(Api);
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  protected readonly eintrag = computed(() => {
    const id = this.glossar.offen();
    return id ? (this.glossar.nachId().get(id) ?? null) : null;
  });
  protected readonly nennungen = signal<{ counted: boolean; total: number; rows: { id: string; name: string }[] } | null>(null);

  constructor() {
    void this.glossar.laden();
    effect(() => {
      const id = this.glossar.offen();
      untracked(() => {
        this.nennungen.set(null);
        this.panel()?.nativeElement.focus();
      });
      if (!id) return;
      this.api
        .glossaryUses(id)
        .then((n) => {
          if (this.glossar.offen() === id) this.nennungen.set(n);
        })
        .catch(() => undefined);
    });
  }

  protected sorte(key: string): string {
    return glossarySortLabel(key);
  }

  /** `/handbook#rules` → Pfad und Anker getrennt, wie `routerLink` sie will. */
  protected pfad(see: string): string {
    return see.split('#')[0] || '/handbook';
  }
  protected anker(see: string): string | undefined {
    return see.split('#')[1] || undefined;
  }

  @HostListener('document:keydown.escape')
  protected escape(): void {
    this.glossar.schliessen();
  }
}

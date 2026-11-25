import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api, type Wisseninhalt } from '../kern/api';
import { KurzLink } from '../kern/kurzansicht';
import { Text } from './text';

/**
 * **Was ein Wissen vereint** (T-287, REQ-353): das Element
 * `knowledgeContents` an der Art Knowledge. Je Information die Artikel mit genau den Feldern, die
 * sie abdeckt, ausgeschrieben — die Stelle, an der Spielende ihr Wissen an
 * einem Ort lesen. Gesiebt am Server (`GET /api/knowledge/:id/contents`):
 * wer das Wissen nicht hat, liest nur, dass es es gibt.
 */
@Component({
  selector: 'nw-wissensseite',
  imports: [RouterLink, KurzLink, Text],
  template: `
    @if (inhalt(); as w) {
      <section class="wissen" aria-label="What this knowledge brings together">
        @if (!w.known) {
          <p class="dim">You do not know this yet.</p>
        } @else {
          @for (i of w.infos; track i.id) {
            <section class="info">
              <h3>{{ i.name }}</h3>
              @if (i.applies) {
                <p class="dim">For {{ i.applies }}</p>
              }
              @for (a of i.articles; track a.id) {
                <div class="artikel">
                  <a [routerLink]="['/artikel', a.id]" [nwQuick]="a.id"><b>{{ a.name }}</b></a>
                  @if (a.cells.length) {
                    <dl>
                      @for (c of a.cells; track c.ref) {
                        <div>
                          <dt>{{ c.label }}</dt>
                          <dd>
                            @if (c.long) {
                              <nw-text [text]="c.text" />
                            } @else {
                              <nw-text inline [text]="c.text" />
                            }
                          </dd>
                        </div>
                      }
                    </dl>
                  } @else {
                    <p class="dim">Nothing to read here.</p>
                  }
                </div>
              } @empty {
                <p class="dim">No article this information is about is visible to you.</p>
              }
              @if (i.more) {
                <p class="dim">… and {{ i.more }} more.</p>
              }
            </section>
          } @empty {
            <p class="dim">This knowledge brings no information together yet.</p>
          }
        }
      </section>
    }
  `,
  styles: `
    .wissen { display: flex; flex-direction: column; gap: 0.8rem; margin: 1rem 0; }
    .info h3 { margin: 0 0 0.2rem; }
    .artikel { padding: 0.3rem 0 0.4rem; border-top: 1px dotted var(--line); }
    dl { margin: 0.2rem 0 0; display: grid; gap: 0.15rem; }
    dl div { display: grid; grid-template-columns: minmax(6rem, 12rem) 1fr; gap: 0.6rem; }
    dt { color: var(--dim); }
    dd { margin: 0; overflow-wrap: anywhere; }
    .dim { color: var(--dim); margin: 0.2rem 0; }
    @media (max-width: 640px) { dl div { grid-template-columns: 1fr; gap: 0; } }
  `,
})
export class Wissensseite {
  readonly id = input.required<string>();
  private readonly api = inject(Api);
  protected readonly inhalt = signal<Wisseninhalt | null>(null);

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() =>
        void this.api
          .knowledgeContents(id)
          .then((w) => this.inhalt.set(w))
          .catch(() => this.inhalt.set(null)),
      );
    });
  }
}

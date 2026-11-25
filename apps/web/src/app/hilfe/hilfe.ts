import { Component, HostListener, computed, effect, inject, input, output, viewChild, type ElementRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { abschnittId, hilfeFuer, neuesFuer } from '../kern/hilfe';
import { Neues } from '../kern/neues';

/**
 * **Help for this page** (T-205): das Seitenpanel hinter dem „?“ der
 * Kopfleiste. Oben der Hilfetext der Seite, darunter, was What's new über
 * genau diese Seite sagt — neueste zuerst, seit der Anlage des Kontos
 * (T-163), wie auf der Seite What's new selbst.
 *
 * **Es ist ein Abschnitt des Handbuchs** (T-242, T-225): dieselben Texte
 * stehen dort im Kapitel „Pages", und „Open in the handbook" führt hin.
 *
 * Das Panel folgt der Adresse: wer bei offenem Panel weitergeht, liest die
 * Hilfe der neuen Seite. Escape und × schliessen es.
 */
@Component({
  selector: 'nw-hilfe',
  imports: [RouterLink],
  template: `
    <aside class="panel" role="dialog" aria-labelledby="hilfe-titel" tabindex="-1" #panel>
      <header>
        <h2 id="hilfe-titel">Help for this page</h2>
        <button type="button" class="zu" (click)="zu.emit()" aria-label="Close help">×</button>
      </header>
      @if (seite(); as s) {
        <h3>{{ s.title }}</h3>
        @for (a of s.sections; track $index) {
          <section>
            @if (a.heading) {
              <h4>{{ a.heading }}</h4>
            }
            @for (t of a.text; track $index) {
              <p>{{ t }}</p>
            }
          </section>
        }
      } @else {
        <p class="dim">There is no help for this page yet.</p>
      }
      @if (neu().length) {
        <section class="neues">
          <h3>What's new here</h3>
          <ul>
            @for (e of neu(); track e.id) {
              <li>
                <strong>{{ e.title }}</strong>
                <span class="datum">{{ e.date }}</span>
                <p>{{ e.text }}</p>
              </li>
            }
          </ul>
        </section>
      }
      <p class="fuss">
        @if (seite(); as s) {
          <a routerLink="/handbook" [fragment]="abschnitt(s)" (click)="zu.emit()">Open in the handbook</a>
        } @else {
          <a routerLink="/handbook" (click)="zu.emit()">Handbook</a>
        }
        <a routerLink="/whats-new" (click)="zu.emit()">All of What's new</a>
      </p>
    </aside>
  `,
  styles: `
    .panel {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      z-index: 30;
      width: min(26rem, 100vw);
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
      gap: 1rem;
    }
    h2 {
      margin: 0;
      font-family: var(--caps);
      font-size: 1.2rem;
      color: var(--accent);
    }
    h3 {
      margin: 1rem 0 0.25rem;
      font-size: 1.05rem;
    }
    h4 {
      margin: 0.75rem 0 0.15rem;
      font-size: 0.95rem;
      color: var(--accent);
    }
    p {
      margin: 0.3rem 0;
      line-height: 1.45;
    }
    .zu {
      min-height: 0;
      padding: 0.1rem 0.5rem;
      font-size: 1.2rem;
    }
    .dim,
    .datum {
      color: var(--dim);
    }
    .neues {
      margin-top: 1.25rem;
      border-top: 1px solid var(--line);
    }
    .neues ul {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .neues li {
      margin: 0.6rem 0;
    }
    .datum {
      margin-left: 0.4rem;
      font-size: 0.8rem;
    }
    .fuss {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      margin-top: 1rem;
      font-size: 0.9rem;
    }
  `,
})
export class Hilfe {
  /** Die Adresse der Seite, deren Hilfe gezeigt wird. */
  readonly url = input.required<string>();
  readonly zu = output<void>();
  private readonly neues = inject(Neues);
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  protected readonly seite = computed(() => hilfeFuer(this.url()));
  /** Derselbe Text steht im Handbuch, Kapitel „Pages" (T-242, T-225). */
  protected readonly abschnitt = abschnittId;
  protected readonly neu = computed(() => neuesFuer(this.url(), this.neues.eintraege()));

  constructor() {
    /* Der Fokus geht ins Panel, damit Escape und Lesen mit der Tastatur
       gleich dort ansetzen. */
    effect(() => this.panel()?.nativeElement.focus());
  }

  @HostListener('document:keydown.escape')
  protected escape(): void {
    this.zu.emit();
  }
}

import { Component, HostListener, effect, inject, input, signal, untracked } from '@angular/core';
import type { Mitglied } from '../kern/api';
import { Session } from '../kern/session';
import { Sicht } from '../kern/sicht';

/**
 * **„View as" im Kopf** (T-269, REQ-241): für Leitung, Mitleitung und
 * Verwaltung neben Kampagne und Ebenen ein Knopf „View as ▾" mit den
 * Mitgliedern der laufenden Kampagne — Spielende mit ihrer Figur,
 * Zuschauer, Mitleitung —, ein Klick nimmt ihre Sicht ein. Das Band oben
 * (`app.ts`) sagt, wessen Sicht gilt, und führt zurück; hier steht dann
 * „As Rook ▾" mit „Back to my view" obenan.
 *
 * Tastenkürzel **Alt+Shift+V**: in einer fremden Sicht zurück, sonst die
 * Liste auf. Am Telefon steht der Knopf nicht in der Leiste, sondern als
 * Liste im Popup von Kampagne und Ebenen (`liste`).
 *
 * Gesiebt wird am Server (`X-View-As`, `mayViewAs`) — die Seite bleibt,
 * ihre Daten kommen neu.
 */
@Component({
  selector: 'nw-sicht',
  template: `
    @if (sicht.angeboten()) {
      @if (liste()) {
        <section class="liste" aria-label="View as">
          <h3>View as</h3>
          @if (session.viewAs(); as v) {
            <p class="jetzt">Viewing as <b>{{ v.name }}</b></p>
            <button type="button" class="zurueck" (click)="zurueck()">Back to my view</button>
          }
          @for (g of sicht.gruppen(); track g.role) {
            <p class="gruppe">{{ g.label }}</p>
            @for (p of g.leute; track p.id) {
              <button type="button" class="person" [class.an]="session.viewAs()?.id === p.id" (click)="nehmen(p)">
                {{ p.name }}
                @if (sicht.figuren(p); as f) {
                  <small>{{ f }}</small>
                }
              </button>
            }
          } @empty {
            @if (!session.viewAs()) {
              <p class="leer">{{ sicht.laedt() ? 'Loading…' : 'No member to view as yet.' }}</p>
            }
          }
        </section>
      } @else {
        <button
          type="button"
          class="knopf"
          [class.aktiv]="!!session.viewAs()"
          aria-haspopup="menu"
          [attr.aria-expanded]="offen()"
          title="See the site as a member of this campaign (Alt+Shift+V)"
          (click)="umschalten()"
        >
          <span aria-hidden="true">👁</span>
          @if (session.viewAs(); as v) {
            As {{ v.name }}
          } @else {
            View as
          }
          <span aria-hidden="true">▾</span>
        </button>
        @if (offen()) {
          <div class="schleier" (click)="offen.set(false)" aria-hidden="true"></div>
          <div class="menue" role="menu" aria-label="View as">
            @if (session.viewAs(); as v) {
              <button type="button" role="menuitem" class="zurueck" (click)="zurueck()">← Back to my view</button>
            }
            @for (g of sicht.gruppen(); track g.role) {
              <p class="gruppe">{{ g.label }}</p>
              @for (p of g.leute; track p.id) {
                <button type="button" role="menuitem" class="person" [class.an]="session.viewAs()?.id === p.id" (click)="nehmen(p)">
                  {{ p.name }}
                  @if (sicht.figuren(p); as f) {
                    <small>{{ f }}</small>
                  }
                </button>
              }
            } @empty {
              @if (!session.viewAs()) {
                <p class="leer">{{ sicht.laedt() ? 'Loading…' : 'No member to view as yet.' }}</p>
              }
            }
            <p class="fuss">Read only. Every page shows what they would see. Alt+Shift+V goes back.</p>
          </div>
        }
      }
    }
  `,
  styles: `
    :host {
      display: contents;
    }
    .knopf {
      display: inline-flex;
      align-items: baseline;
      gap: 0.3rem;
      min-height: 0;
      margin: 0 0 0 -0.35rem;
      padding: 0.05rem 0.35rem;
      border: 1px solid transparent;
      border-radius: 6px;
      background: none;
      color: var(--dim);
      font-size: 0.8rem;
      line-height: 1.3;
      white-space: nowrap;
      cursor: pointer;
    }
    .knopf:hover,
    .knopf[aria-expanded='true'] {
      border-color: var(--accent);
      color: var(--accent);
    }
    .knopf.aktiv {
      color: var(--accent);
      font-weight: 700;
    }
    .schleier {
      position: fixed;
      inset: 0;
      z-index: 40;
    }
    .menue {
      position: fixed;
      z-index: 41;
      top: 4rem;
      left: 1rem;
      width: min(20rem, calc(100vw - 2rem));
      max-height: calc(100dvh - 5rem);
      overflow-y: auto;
      padding: 0.5rem;
      border: 1px solid var(--line);
      border-top: 3px solid var(--accent);
      border-radius: 8px;
      background: var(--surface);
      box-shadow: 0 6px 24px rgb(0 0 0 / 0.2);
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }
    .gruppe {
      margin: 0.4rem 0 0.1rem;
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--dim);
    }
    .person,
    .zurueck {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      min-height: 40px;
      padding: 0.3rem 0.5rem;
      border: 1px solid transparent;
      border-radius: 6px;
      background: none;
      color: var(--ink);
      text-align: left;
      cursor: pointer;
    }
    .person:hover,
    .person:focus-visible,
    .zurueck:hover,
    .zurueck:focus-visible {
      border-color: var(--accent);
    }
    .person.an {
      background: var(--hover);
      font-weight: 700;
    }
    .zurueck {
      font-weight: 700;
      color: var(--accent);
    }
    small {
      color: var(--dim);
      font-weight: 400;
    }
    .leer,
    .fuss {
      margin: 0.3rem 0.5rem;
      font-size: 0.8rem;
      color: var(--dim);
    }
    .liste {
      display: none;
      flex-direction: column;
      gap: 0.15rem;
      padding-top: 0.4rem;
      border-top: 1px solid var(--line);
    }
    .liste h3 {
      margin: 0;
      font-size: 1rem;
      color: var(--heading);
    }
    .jetzt {
      margin: 0.2rem 0;
    }
    /* Am Telefon kein Knopf in der Leiste, dafür die Liste im Popup (T-269, Punkt 4). */
    @media (max-width: 640px) {
      .knopf {
        display: none;
      }
      .liste {
        display: flex;
      }
    }
  `,
})
export class SichtKnopf {
  /** Als Liste im Popup von Kampagne und Ebenen statt als Knopf in der Leiste. */
  readonly liste = input(false);

  protected readonly session = inject(Session);
  protected readonly sicht = inject(Sicht);
  protected readonly offen = signal(false);

  constructor() {
    /* Die Liste im Popup braucht die Mitglieder sofort. */
    effect(() => {
      if (this.liste() && this.sicht.angeboten()) untracked(() => void this.sicht.laden());
    });
  }

  protected umschalten(): void {
    const auf = !this.offen();
    this.offen.set(auf);
    if (auf) void this.sicht.laden();
  }

  protected async nehmen(p: Mitglied): Promise<void> {
    this.offen.set(false);
    await this.sicht.einnehmen(p);
  }

  protected async zurueck(): Promise<void> {
    this.offen.set(false);
    await this.sicht.verlassen();
  }

  @HostListener('document:keydown', ['$event'])
  protected taste(ev: KeyboardEvent): void {
    if (this.liste() || ev.defaultPrevented || !this.sicht.angeboten()) return;
    if (ev.key === 'Escape' && this.offen()) {
      this.offen.set(false);
      return;
    }
    if (!(ev.altKey && ev.shiftKey && !ev.ctrlKey && !ev.metaKey && ev.code === 'KeyV')) return;
    ev.preventDefault();
    if (this.session.viewAs()) void this.zurueck();
    else this.umschalten();
  }
}

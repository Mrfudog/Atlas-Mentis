import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Session } from './kern/session';
import { BEREICHE } from './kern/bereiche';

/**
 * Das Gerüst: die Kopfleiste wie auf dem Design-Canvas (Kompendium, Artikel
 * im Buchstil) — Marke, die Bereiche und das Kompendium, rechts wer man ist.
 *
 * Die Kopfleiste trägt die Navigation für alles; das Kompendium und die
 * Bereiche engen **in ihrer Seitenleiste** ein (Wunsch der Leitung,
 * 12.10.). Boards, Karten und Spiel stehen noch nicht hier, weil es sie in
 * dieser Oberfläche noch nicht gibt — ein Eintrag, der ins Leere führt,
 * ist schlechter als keiner. Sie kommen mit ihren Seiten.
 *
 * Die Kopfleiste bleibt weg, solange die Sitzung noch nicht gefragt ist.
 * Ein Balken, der erst „nicht angemeldet" zeigt und einen Wimpernschlag
 * später den Namen, sieht nach einem Fehler aus, auch wenn keiner vorliegt.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    @if (session.stand() === 'bereit' && session.angemeldet()) {
      <header class="leiste">
        <a routerLink="/" class="marke">Atlas Mentis</a>
        <nav aria-label="Areas" class="bereiche">
          @for (b of bereiche; track b.weg) {
            <a [routerLink]="'/' + b.weg" routerLinkActive="an" ariaCurrentWhenActive="page">{{
              b.label
            }}</a>
          }
          <a routerLink="/compendium" routerLinkActive="an" ariaCurrentWhenActive="page"
            >Compendium</a
          >
        </nav>
        <span class="wer">
          {{ session.user()?.name }}
          @if (session.isAdmin()) {
            <span class="rolle">admin</span>
          }
        </span>
        <button type="button" (click)="abmelden()">Sign out</button>
      </header>
    }
    @if (warnung()) {
      <p class="warnung" role="alert">{{ warnung() }}</p>
    }
    <router-outlet />
  `,
  styles: `
    .leiste {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem 1.25rem;
      padding: 0.5rem 1.5rem;
      background: var(--bar);
      border-bottom: 3px solid var(--accent);
    }
    .marke {
      font-family: var(--caps);
      font-size: 1.4rem;
      font-weight: 700;
      color: var(--accent);
      text-decoration: none;
    }
    .bereiche {
      display: flex;
      flex-wrap: wrap;
      gap: 2px;
    }
    .bereiche a {
      padding: 0.5rem 0.75rem;
      border-radius: 6px;
      color: var(--ink);
      text-decoration: none;
    }
    .bereiche a:hover {
      background: var(--hover);
    }
    .bereiche a.an {
      background: var(--chip);
      font-weight: 700;
    }
    .wer {
      margin-left: auto;
      color: var(--dim);
    }
    .rolle {
      margin-left: 0.35rem;
      padding: 0 0.4rem;
      border: 1px solid var(--accent);
      border-radius: 10px;
      color: var(--accent);
      font-size: 0.75rem;
    }
    .warnung {
      margin: 0;
      padding: 0.5rem 1.5rem;
      background: var(--surface);
      border-bottom: 1px solid var(--warn);
      color: var(--warn);
    }
    /* Am Telefon: Marke und Abmelden in einer Zeile, die Bereiche darunter
       in einer Zeile, die sich schieben lässt, statt in drei umzubrechen. */
    @media (max-width: 640px) {
      .leiste {
        padding: 0.4rem 1rem 0;
        gap: 0.25rem 0.75rem;
      }
      .bereiche {
        order: 3;
        flex: 1 0 100%;
        flex-wrap: nowrap;
        overflow-x: auto;
        margin: 0 -1rem;
        padding: 0 0.5rem 0.25rem;
      }
      .bereiche a {
        white-space: nowrap;
      }
    }
  `,
})
export class App {
  protected readonly session = inject(Session);
  private readonly router = inject(Router);
  protected readonly bereiche = BEREICHE.filter((b) => b.weg !== 'play');

  constructor() {
    void this.session.load();
  }

  protected readonly warnung = signal<string | null>(null);

  protected async abmelden(): Promise<void> {
    this.warnung.set(await this.session.logout());
    await this.router.navigateByUrl('/login');
  }
}

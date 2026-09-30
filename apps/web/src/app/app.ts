import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { Session } from './kern/session';

/**
 * Das Gerüst: eine Kopfzeile, die sagt, wer man ist, und sonst nichts.
 *
 * Die Kopfzeile bleibt weg, solange die Sitzung noch nicht gefragt ist.
 * Ein Balken, der erst „nicht angemeldet" zeigt und einen Wimpernschlag
 * später den Namen, sieht nach einem Fehler aus, auch wenn keiner vorliegt.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink],
  template: `
    @if (session.stand() === 'bereit' && session.angemeldet()) {
      <header class="leiste">
        <a routerLink="/" class="marke">Atlas Mentis</a>
        <span class="wer">
          {{ session.user()?.name }}
          @if (session.isAdmin()) {
            <span class="rolle">GM</span>
          }
        </span>
        <button type="button" (click)="abmelden()">Sign out</button>
      </header>
    }
    @if (warnung()) {
      <p class="warnung" role="alert">{{ warnung() }}</p>
    }
    <main class="inhalt">
      <router-outlet />
    </main>
  `,
  styleUrl: './app.scss',
})
export class App {
  protected readonly session = inject(Session);
  private readonly router = inject(Router);

  constructor() {
    void this.session.load();
  }

  protected readonly warnung = signal<string | null>(null);

  protected async abmelden(): Promise<void> {
    this.warnung.set(await this.session.logout());
    await this.router.navigateByUrl('/login');
  }
}

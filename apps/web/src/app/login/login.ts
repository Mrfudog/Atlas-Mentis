import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Session } from '../kern/session';

/**
 * Die Anmeldemaske.
 *
 * Sie sagt, was der Server sagt, und erfindet nichts dazu: dieselbe Auskunft
 * für „Name gibt es nicht" und „Passwort falsch" ist Absicht, und eine
 * hilfsbereite Maske, die daraus „Benutzer unbekannt" macht, nimmt sie
 * zurück.
 *
 * Auf einem frischen Server steht stattdessen, wie man das erste Konto
 * anlegt. Ein Anmeldefeld ohne Konto ist eine Sackgasse mit Aufforderung.
 */
@Component({
  selector: 'nw-login',
  imports: [FormsModule],
  template: `
    <main class="anmeldung">
      <h1>Nebelwacht</h1>

      @if (session.setupHint(); as hinweis) {
        <div class="karte hinweis">
          <p><b>No account yet.</b></p>
          <p>Make the first one on the machine itself:</p>
          <pre>{{ hinweis }}</pre>
        </div>
      } @else {
        <form class="karte" (ngSubmit)="anmelden()">
          <label>
            <span>Name</span>
            <input name="name" autocomplete="username" [(ngModel)]="name" />
          </label>
          <label>
            <span>Password</span>
            <input
              name="password"
              type="password"
              autocomplete="current-password"
              [(ngModel)]="password"
            />
          </label>
          @if (fehler()) {
            <p class="fehler" role="alert">{{ fehler() }}</p>
          }
          <button type="submit" [disabled]="laeuft()">
            {{ laeuft() ? 'One moment…' : 'Sign in' }}
          </button>
        </form>
      }
    </main>
  `,
  styleUrl: './login.scss',
})
export class Login {
  protected readonly session = inject(Session);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected name = '';
  protected password = '';
  protected readonly fehler = signal<string | null>(null);
  protected readonly laeuft = signal(false);

  constructor() {
    void this.session.load();
  }

  protected async anmelden(): Promise<void> {
    if (this.laeuft()) return;
    this.laeuft.set(true);
    this.fehler.set(null);
    const problem = await this.session.login(this.name, this.password);
    this.laeuft.set(false);
    if (problem) {
      this.fehler.set(problem);
      return;
    }
    /* Dorthin zurück, wo jemand hinwollte, bevor die Wache dazwischenkam. */
    const weiter = this.route.snapshot.queryParamMap.get('weiter');
    await this.router.navigateByUrl(weiter && weiter !== '/login' ? weiter : '/');
  }
}

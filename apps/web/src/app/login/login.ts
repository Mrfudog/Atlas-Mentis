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
 *
 * **Mit einer Einladung** (`/login?invite=…`, der Link aus der Verwaltung)
 * steht die Registrierung da: Name und Passwort, die sich jemand selbst
 * ausdenkt. Der Code steht im Link und wird nicht abgetippt. Ohne Link gibt
 * es „I have an invitation" nur, wenn der Server sagt, dass eine offen ist.
 */
@Component({
  selector: 'nw-login',
  imports: [FormsModule],
  template: `
    <main class="anmeldung">
      <h1>Atlas Mentis</h1>

      @if (session.setupHint(); as hinweis) {
        <div class="karte hinweis">
          <p><b>No account yet.</b></p>
          <p>Make the first one on the machine itself:</p>
          <pre>{{ hinweis }}</pre>
        </div>
      } @else if (modus() === 'register') {
        <form class="karte" (ngSubmit)="registrieren()">
          <p class="titel"><b>Create your account</b></p>
          <label>
            <span>Name</span>
            <input name="name" autocomplete="username" [(ngModel)]="name" />
          </label>
          <label>
            <span>Password (at least 12 characters)</span>
            <input
              name="password"
              type="password"
              autocomplete="new-password"
              [(ngModel)]="password"
            />
          </label>
          @if (!codeAusLink) {
            <label>
              <span>Invitation code</span>
              <input name="invite" autocomplete="off" [(ngModel)]="invite" />
            </label>
          }
          @if (fehler()) {
            <p class="fehler" role="alert">{{ fehler() }}</p>
          }
          <button type="submit" [disabled]="laeuft()">
            {{ laeuft() ? 'One moment…' : 'Create account' }}
          </button>
          <a class="wechsel" href="" (click)="$event.preventDefault(); modus.set('login')"
            >I already have an account</a
          >
        </form>
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
          @if (session.hatEinladungen()) {
            <a class="wechsel" href="" (click)="$event.preventDefault(); modus.set('register')"
              >I have an invitation</a
            >
          }
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
  protected invite = '';
  /** Steht der Code im Link, wird er nicht noch einmal gefragt. */
  protected readonly codeAusLink: boolean;
  protected readonly modus = signal<'login' | 'register'>('login');

  constructor() {
    void this.session.load();
    this.invite = this.route.snapshot.queryParamMap.get('invite') ?? '';
    this.codeAusLink = this.invite !== '';
    if (this.codeAusLink) this.modus.set('register');
  }

  protected async registrieren(): Promise<void> {
    if (this.laeuft()) return;
    this.laeuft.set(true);
    this.fehler.set(null);
    const problem = await this.session.register(this.name, this.password, this.invite.trim());
    this.laeuft.set(false);
    if (problem) {
      this.fehler.set(problem);
      return;
    }
    await this.router.navigateByUrl('/');
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

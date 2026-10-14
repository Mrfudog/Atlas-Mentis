import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, ApiError, type TokenZeile } from '../kern/api';
import { Session } from '../kern/session';
import { MeineEbenen } from './ebenen';

/**
 * **Das eigene Konto**: wer man ist, die Ebenen, in denen man schreibt
 * (T-098), und die eigenen API-Tokens (W9).
 *
 * Ein Token ist der Zugang eines Werkzeugs — eines Skripts, einer
 * Claude-Sitzung —, das keinen Keks hält. Es wirkt wie die Sitzung dieses
 * Kontos, beschränkt auf `read` oder `write`, und **der Klartext steht genau
 * einmal da**: gespeichert ist nur sein Hash. Wer ihn verpasst, widerruft
 * und legt ein neues an.
 */
@Component({
  selector: 'nw-konto',
  imports: [FormsModule, MeineEbenen],
  template: `
    <div class="seite">
      <h1>Account</h1>
      <p class="dim">
        Signed in as <b>{{ session.user()?.name }}</b>
        @if (session.isAdmin()) {
          · administration
        }
        @for (r of rollen(); track r) {
          · {{ r }}
        }
      </p>

      <!-- In welchen Ebenen ich schreibe, und eigene anlegen (T-098). -->
      <nw-meine-ebenen />

      <section class="block" aria-labelledby="h-tokens">
        <h2 id="h-tokens">API tokens</h2>
        <p class="dim">
          For tools that cannot sign in — a script, a Claude session. A token acts as this account,
          limited to reading or to reading and writing, and never does more than the account may. It
          always expires.
        </p>

        @if (neu(); as n) {
          <div class="neu" role="status">
            <p><b>{{ n.name }}</b> ({{ n.scope }}, until {{ n.expiresAt.slice(0, 10) }}) — copy it now, it is shown only once:</p>
            <div class="klartext">
              <code>{{ n.token }}</code>
              <button type="button" (click)="kopieren(n.token ?? '')">{{ kopiert() ? 'Copied' : 'Copy' }}</button>
            </div>
            <button type="button" class="klein" (click)="neu.set(null)">Done</button>
          </div>
        }

        <form class="anlegen" (ngSubmit)="anlegen()">
          <label>Name <input name="name" [(ngModel)]="name" placeholder="claude-dev" required /></label>
          <label>
            Rights
            <select name="scope" [(ngModel)]="scope">
              <option value="read">read</option>
              <option value="write">read and write</option>
            </select>
          </label>
          <label>Days <input name="days" type="number" min="1" max="365" [(ngModel)]="days" /></label>
          <button type="submit" class="pri" [disabled]="laeuft() || !name.trim()">Create token</button>
        </form>
        @if (fehler()) {
          <p class="fehler" role="alert">{{ fehler() }}</p>
        }

        <ul class="tokens">
          @for (t of tokens(); track t.id) {
            <li [class.abgelaufen]="abgelaufen(t)">
              <div>
                <b>{{ t.name }}</b> <span class="art">{{ t.scope }}</span>
                <div class="dim">
                  {{ abgelaufen(t) ? 'expired' : 'until' }} {{ t.expiresAt.slice(0, 10) }}
                  · {{ t.lastUsedAt ? 'last used ' + t.lastUsedAt.slice(0, 16).replace('T', ' ') : 'never used' }}
                </div>
              </div>
              <button type="button" class="klein" (click)="widerrufen(t)" [disabled]="laeuft()">Revoke</button>
            </li>
          } @empty {
            <li class="dim">No token.</li>
          }
        </ul>
      </section>
    </div>
  `,
  styles: `
    .seite {
      max-width: 760px;
      margin: 0 auto;
      padding: 1.25rem 1.5rem 3rem;
    }
    h1,
    h2 {
      font-family: var(--caps);
      color: var(--accent);
      margin: 0;
    }
    h1 {
      font-size: 1.9rem;
    }
    h2 {
      font-size: 1.3rem;
    }
    .dim {
      color: var(--dim);
    }
    .fehler {
      color: var(--warn);
    }
    .block {
      margin-top: 1.25rem;
      padding: 1rem 1.25rem;
      background: var(--surface);
      border: 1px solid var(--line);
      border-top: 3px solid var(--rule);
      border-radius: 6px;
    }
    .anlegen {
      display: grid;
      grid-template-columns: minmax(0, 2fr) minmax(0, 1.3fr) minmax(0, 0.8fr) auto;
      gap: 0.5rem 0.75rem;
      align-items: end;
    }
    label {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      font-size: 0.85rem;
      color: var(--dim);
    }
    input,
    select {
      min-height: 40px;
      padding: 0.25rem 0.5rem;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--paper);
      color: var(--ink);
      min-width: 0;
    }
    .tokens {
      margin: 1rem 0 0;
      padding: 0;
      list-style: none;
    }
    .tokens li {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.5rem 0;
      border-top: 1px solid var(--line2);
    }
    .tokens li.abgelaufen {
      opacity: 0.6;
    }
    .art {
      margin-left: 0.4rem;
      padding: 0 0.4rem;
      border-radius: 10px;
      background: var(--chip);
      font-size: 0.75rem;
    }
    button.klein {
      min-height: 32px;
      padding: 0 0.6rem;
      font-size: 0.85rem;
    }
    .neu {
      margin: 0.75rem 0;
      padding: 0.75rem 1rem;
      background: var(--paper);
      border: 1px solid var(--gold);
      border-left: 4px solid var(--gold);
      border-radius: 6px;
    }
    .neu p {
      margin: 0 0 0.5rem;
    }
    .klartext {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      margin-bottom: 0.5rem;
    }
    .klartext code {
      flex: 1;
      min-width: 0;
      padding: 0.4rem 0.5rem;
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 4px;
      overflow-wrap: anywhere;
      font-size: 0.85rem;
    }
    @media (max-width: 640px) {
      .seite {
        padding: 0.75rem 0.75rem 2rem;
      }
      .block {
        padding: 0.75rem;
      }
      .anlegen {
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      }
      .anlegen label:first-child,
      .anlegen button {
        grid-column: 1 / -1;
      }
    }
  `,
})
export class Konto {
  protected readonly session = inject(Session);
  private readonly api = inject(Api);

  protected readonly tokens = signal<TokenZeile[]>([]);
  protected readonly neu = signal<TokenZeile | null>(null);
  protected readonly fehler = signal<string | null>(null);
  protected readonly laeuft = signal(false);
  protected readonly kopiert = signal(false);
  protected name = '';
  protected scope: 'read' | 'write' = 'read';
  protected days = 30;

  constructor() {
    void this.laden();
  }

  protected rollen(): string[] {
    return Object.entries(this.session.user()?.roles ?? {}).map(([k, r]) => `${r} in ${k}`);
  }

  protected abgelaufen(t: TokenZeile): boolean {
    return new Date(t.expiresAt).getTime() <= Date.now();
  }

  private async laden(): Promise<void> {
    try {
      this.tokens.set(await this.api.tokens());
    } catch (e) {
      this.fehler.set(e instanceof ApiError ? e.message : 'Could not reach the server.');
    }
  }

  protected async anlegen(): Promise<void> {
    this.laeuft.set(true);
    this.fehler.set(null);
    this.kopiert.set(false);
    try {
      this.neu.set(await this.api.createToken(this.name.trim(), this.scope, Number(this.days) || 30));
      this.name = '';
      await this.laden();
    } catch (e) {
      this.fehler.set(e instanceof ApiError ? e.message : 'Could not reach the server.');
    } finally {
      this.laeuft.set(false);
    }
  }

  protected async widerrufen(t: TokenZeile): Promise<void> {
    if (!confirm(`Revoke “${t.name}”? Every tool using it loses access at once.`)) return;
    this.laeuft.set(true);
    try {
      await this.api.dropToken(t.id);
      if (this.neu()?.id === t.id) this.neu.set(null);
      await this.laden();
    } catch (e) {
      this.fehler.set(e instanceof ApiError ? e.message : 'Could not reach the server.');
    } finally {
      this.laeuft.set(false);
    }
  }

  protected async kopieren(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.kopiert.set(true);
    } catch {
      /* Ohne Zwischenablage (http, alter Browser) bleibt das Markieren von Hand. */
    }
  }
}

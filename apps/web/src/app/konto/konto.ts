import { Component, inject } from '@angular/core';
import { Session } from '../kern/session';
import { ApiTokens } from './api-tokens';
import { MeineEbenen } from './ebenen';

/**
 * **Das eigene Konto**: wer man ist, die Ebenen, in denen man schreibt
 * (T-098), und die eigenen API-Tokens (W9, Baustein `nw-api-tokens`).
 */
@Component({
  selector: 'nw-konto',
  imports: [ApiTokens, MeineEbenen],
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

      <!-- Die eigenen API-Tokens (W9); dieselben stehen in der Werkbank (T-112). -->
      <nw-api-tokens kennung="konto-tokens" />
    </div>
  `,
  styles: `
    .seite {
      max-width: 760px;
      margin: 0 auto;
      padding: 1.25rem 1.5rem 3rem;
    }
    h1 {
      font-family: var(--caps);
      color: var(--accent);
      margin: 0;
      font-size: 1.9rem;
    }
    .dim {
      color: var(--dim);
    }
    @media (max-width: 640px) {
      .seite {
        padding: 0.75rem 0.75rem 2rem;
      }
    }
  `,
})
export class Konto {
  protected readonly session = inject(Session);

  protected rollen(): string[] {
    return Object.entries(this.session.user()?.roles ?? {}).map(([k, r]) => `${r} in ${k}`);
  }
}

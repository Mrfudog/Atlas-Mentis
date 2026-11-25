import { Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, ApiError, type TokenZeile } from '../kern/api';
import { ablaufSpanne, netzwerkSecret } from './tokens';

/**
 * **Die eigenen API-Tokens** (W9, T-112) — auf der Kontoseite und in der
 * Werkbank, derselbe Baustein: ein Token gehört immer dem Konto, das es
 * anlegt, auch dort, wo die Leitung es für eine Claude-Sitzung braucht.
 *
 * Ein Token ist der Zugang eines Werkzeugs — eines Skripts, einer
 * Claude-Sitzung —, das keinen Keks hält. Es wirkt wie die Sitzung dieses
 * Kontos, beschränkt auf `read` oder `write`, und **der Klartext steht genau
 * einmal da**: gespeichert ist nur sein Hash. Er lebt nur in diesem
 * Baustein und geht mit „Done" oder dem Verlassen der Seite; wer ihn
 * verpasst, widerruft und legt ein neues an.
 */
@Component({
  selector: 'nw-api-tokens',
  imports: [FormsModule],
  template: `
    <section class="block" [attr.aria-labelledby]="kennung() + '-h'">
      <h2 [id]="kennung() + '-h'">API tokens</h2>
      <p class="dim">
        For tools that cannot sign in — a script, a Claude session. A token acts as your account,
        limited to reading or to reading and writing, and never does more than the account may. It
        always expires.
      </p>

      @if (neu(); as n) {
        <div class="neu" role="status">
          <p>
            <b>{{ n.name }}</b> ({{ n.scope === 'write' ? 'read and write' : 'read' }}, until
            {{ n.expiresAt.slice(0, 10) }}) — copy it now, it is shown only once:
          </p>
          <div class="klartext">
            <code data-testid="token-klartext">{{ n.token }}</code>
            <button type="button" (click)="kopieren('token', n.token ?? '')">
              {{ kopiert() === 'token' ? 'Copied' : 'Copy' }}
            </button>
          </div>

          <h3>As a network secret of a Claude cloud environment</h3>
          <p class="dim">
            Environment settings → Network access. The proxy adds the header to every request to
            this host, and the session never sees the token. Never paste it into a chat, a file in
            the repository or an issue.
          </p>
          <dl class="secret">
            <dt>Host</dt>
            <dd>
              <code>{{ secret.host }}</code>
            </dd>
            <dt>Header</dt>
            <dd>
              <code>{{ secret.header }}</code>
            </dd>
            <dt>Prefix</dt>
            <dd>
              <code>{{ secret.prefix }}</code>
            </dd>
            <dt>Value</dt>
            <dd>
              the token above — if the form has no prefix field, the whole value:
              <button
                type="button"
                class="klein"
                (click)="kopieren('wert', secret.prefix + ' ' + (n.token ?? ''))"
              >
                {{ kopiert() === 'wert' ? 'Copied' : 'Copy “' + secret.prefix + ' …”' }}
              </button>
            </dd>
          </dl>
          <button type="button" class="klein" (click)="fertig()">Done</button>
        </div>
      }

      <form class="anlegen" (ngSubmit)="anlegen()">
        <label
          >Name <input name="name" [(ngModel)]="name" placeholder="claude-dev" required
        /></label>
        <label>
          Rights
          <select name="scope" [(ngModel)]="scope">
            <option value="read">read</option>
            <option value="write">read and write</option>
          </select>
        </label>
        <label>
          Expires
          <input
            name="expires"
            type="date"
            [min]="spanne.min"
            [max]="spanne.max"
            [(ngModel)]="bis"
            required
          />
        </label>
        <button type="submit" class="pri" [disabled]="laeuft() || !name.trim() || !bis">
          Create token
        </button>
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
                {{ abgelaufen(t) ? 'expired' : 'until' }} {{ t.expiresAt.slice(0, 10) }} ·
                {{
                  t.lastUsedAt
                    ? 'last used ' + t.lastUsedAt.slice(0, 16).replace('T', ' ')
                    : 'never used'
                }}
              </div>
            </div>
            <button type="button" class="klein" (click)="widerrufen(t)" [disabled]="laeuft()">
              Revoke
            </button>
          </li>
        } @empty {
          <li class="dim">No token.</li>
        }
      </ul>
    </section>
  `,
  styles: `
    :host {
      display: block;
    }
    h2,
    h3 {
      font-family: var(--caps);
      color: var(--accent);
      margin: 0;
    }
    h2 {
      font-size: 1.3rem;
    }
    h3 {
      font-size: 1.05rem;
      margin-top: 0.75rem;
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
      grid-template-columns: minmax(0, 2fr) minmax(0, 1.3fr) minmax(0, 1.2fr) auto;
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
    code {
      overflow-wrap: anywhere;
      font-size: 0.85rem;
    }
    .klartext code {
      flex: 1;
      min-width: 0;
      padding: 0.4rem 0.5rem;
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 4px;
    }
    .secret {
      display: grid;
      grid-template-columns: max-content minmax(0, 1fr);
      gap: 0.3rem 0.75rem;
      margin: 0.5rem 0 0.75rem;
      align-items: baseline;
    }
    .secret dt {
      color: var(--dim);
      font-size: 0.85rem;
    }
    .secret dd {
      margin: 0;
    }
    @media (max-width: 640px) {
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
      .tokens li {
        align-items: flex-start;
      }
    }
  `,
})
export class ApiTokens {
  private readonly api = inject(Api);

  /** Damit Konto und Werkbank nicht dieselbe Id für die Überschrift setzen. */
  readonly kennung = input('tokens');

  protected readonly tokens = signal<TokenZeile[]>([]);
  protected readonly neu = signal<TokenZeile | null>(null);
  protected readonly fehler = signal<string | null>(null);
  protected readonly laeuft = signal(false);
  protected readonly kopiert = signal<'token' | 'wert' | null>(null);
  protected readonly spanne = ablaufSpanne();
  protected readonly secret = netzwerkSecret(
    typeof location === 'undefined' ? '' : location.hostname,
  );
  protected name = '';
  protected scope: 'read' | 'write' = 'read';
  protected bis = this.spanne.vorgabe;

  constructor() {
    void this.laden();
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
    this.kopiert.set(null);
    try {
      this.neu.set(await this.api.createToken(this.name.trim(), this.scope, this.bis));
      this.name = '';
      await this.laden();
    } catch (e) {
      this.fehler.set(e instanceof ApiError ? e.message : 'Could not reach the server.');
    } finally {
      this.laeuft.set(false);
    }
  }

  /** Der Klartext geht — danach steht er nirgends mehr. */
  protected fertig(): void {
    this.neu.set(null);
    this.kopiert.set(null);
  }

  protected async widerrufen(t: TokenZeile): Promise<void> {
    if (!confirm(`Revoke “${t.name}”? Every tool using it loses access at once.`)) return;
    this.laeuft.set(true);
    try {
      await this.api.dropToken(t.id);
      if (this.neu()?.id === t.id) this.fertig();
      await this.laden();
    } catch (e) {
      this.fehler.set(e instanceof ApiError ? e.message : 'Could not reach the server.');
    } finally {
      this.laeuft.set(false);
    }
  }

  protected async kopieren(was: 'token' | 'wert', text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.kopiert.set(was);
    } catch {
      /* Ohne Zwischenablage (http, alter Browser) bleibt das Markieren von Hand. */
    }
  }
}

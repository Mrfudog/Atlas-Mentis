import { Component, computed, effect, inject, signal } from '@angular/core';
import { Api } from './kern/api';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Session } from './kern/session';
import { BEREICHE } from './kern/bereiche';
import { KurzPopup } from './artikel/kurzpopup';
import { Live } from './kern/live';

/**
 * Das Gerüst: die Kopfleiste wie auf dem Design-Canvas (Kompendium, Artikel
 * im Buchstil) — Marke, die Bereiche und das Kompendium, rechts wer man ist.
 *
 * Die Kopfleiste trägt die Navigation für alles; das Kompendium und die
 * Bereiche engen **in ihrer Seitenleiste** ein (Wunsch der Leitung,
 * 12.10.). Boards stehen vorne, wie auf `Board.dc.html` — sie sind, was
 * man vor und während der Sitzung offen hat. Karten und Spiel stehen noch
 * nicht hier, weil es sie in dieser Oberfläche noch nicht gibt — ein
 * Eintrag, der ins Leere führt, ist schlechter als keiner. Sie kommen mit
 * ihren Seiten.
 *
 * Die **Werkbank** (W9) steht nur für Leitung und Verwaltung da — für
 * alle anderen wäre sie ein Eintrag, der „nicht für dich" sagt. Der eigene
 * Name führt zum Konto (API-Tokens).
 *
 * Das Register steht nur für wen es ändern darf (Verwaltung, Leitung der
 * laufenden Kampagne) — lesen kann es jeder über die Adresse, aber ein
 * Eintrag für etwas, das man nur ansehen kann, lenkt am Tisch ab.
 *
 * Auf **dev** steht über allem ein schmales Band (T-070): dort ersetzen
 * Ausrollen und Einlesen den Bestand, und wer das nicht weiss, pflegt auf
 * der Spielwiese, was am Tisch fehlen wird. Es steht auch vor der
 * Anmeldung — gerade dann, wenn man noch nicht weiss, wo man ist. Auf prod
 * und ohne `ATLAS_ENV` kein Band.
 *
 * Die Kopfleiste bleibt weg, solange die Sitzung noch nicht gefragt ist.
 * Ein Balken, der erst „nicht angemeldet" zeigt und einen Wimpernschlag
 * später den Namen, sieht nach einem Fehler aus, auch wenn keiner vorliegt.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, KurzPopup],
  template: `
    @if (session.dev()) {
      <p class="umgebung" role="note">
        <strong>DEV</strong> — Test environment. Data may be replaced when deploying or importing.
        <a [href]="betrieb" target="_blank" rel="noopener">What can delete data</a>
      </p>
    }
    @if (session.viewAs(); as v) {
      <p class="sicht" role="status">
        Viewing as <strong>{{ v.name }}</strong>
        @if (v.role) {
          <span class="sicht-rolle">{{ v.role }}</span>
        }
        <span class="sicht-nur">— read only</span>
        <button type="button" (click)="sichtVerlassen()">Exit</button>
      </p>
    }
    @if (session.stand() === 'bereit' && session.angemeldet()) {
      <header class="leiste">
        <a routerLink="/" class="marke">Atlas Mentis</a>
        <nav aria-label="Areas" class="bereiche">
          <a routerLink="/play" routerLinkActive="an" ariaCurrentWhenActive="page">Play</a>
          <a routerLink="/boards" routerLinkActive="an" ariaCurrentWhenActive="page">Boards</a>
          @for (b of bereiche; track b.weg) {
            <a [routerLink]="'/' + b.weg" routerLinkActive="an" ariaCurrentWhenActive="page">{{
              b.label
            }}</a>
          }
          <a routerLink="/classes" routerLinkActive="an" ariaCurrentWhenActive="page">Classes</a>
          <a routerLink="/compendium" routerLinkActive="an" ariaCurrentWhenActive="page"
            >Compendium</a
          >
          @if (session.leitung()) {
            <a routerLink="/werkbank" routerLinkActive="an" ariaCurrentWhenActive="page">Workbench</a>
          }
          @if (session.darfRegister()) {
            <a routerLink="/registry" routerLinkActive="an" ariaCurrentWhenActive="page">Registry</a>
          }
          <!-- Nur für wen die Seite etwas zeigt: Verwaltung, Leitung, Mitleitung (W3). -->
          @if (session.verwaltet()) {
            <a routerLink="/campaign" routerLinkActive="an" ariaCurrentWhenActive="page"
              >Campaign</a
            >
          }
        </nav>
        <!-- Ob dieses Gerät mithört (T-116): ein Punkt, kein Text — am Tisch
             fällt auf, wenn er hohl wird. -->
        <span
          class="live"
          [class.offen]="live.stand() === 'offen'"
          [attr.title]="live.stand() === 'offen' ? 'Live: changes arrive without reloading' : 'Live: reconnecting …'"
          [attr.aria-label]="live.stand() === 'offen' ? 'Live' : 'Live reconnecting'"
          role="img"
        ></span>
        <a class="wer" routerLink="/account" title="Account and API tokens">
          <!-- In der Sicht eines Mitglieds bleibt hier, wer angemeldet ist (REQ-241). -->
          {{ session.viewAs()?.by?.name ?? session.user()?.name }}
          @if (session.isAdmin()) {
            <span class="rolle">admin</span>
          }
        </a>
        <button type="button" (click)="abmelden()">Sign out</button>
      </header>
    }
    @if (warnung()) {
      <p class="warnung" role="alert">{{ warnung() }}</p>
    }
    @if (api.neueVersion()) {
      <p class="neu" role="status">
        New version available.
        <button type="button" (click)="neuLaden()">Reload</button>
      </p>
    }
    <!-- Das Ladebanner, eine Stelle für die ganze Seite (T-086, REQ-246). -->
    <div class="banner-ort" role="status" aria-live="polite">
      @if (api.fehler(); as f) {
        <p class="banner fehler">
          Could not load {{ f.was }}.
          <button type="button" (click)="f.nochmal()">Retry</button>
        </p>
      } @else if (api.anlauf() !== null) {
        <p class="banner">Server is starting, reading {{ api.anlauf() }} articles …</p>
      } @else if (wartet()) {
        <p class="banner">Loading … ({{ geladen() }})</p>
      }
    </div>
    <router-outlet />
    <!-- Die Kurzansicht eines genannten Artikels, eine für alle Seiten (T-093). -->
    <nw-kurzpopup />
  `,
  styles: `
    .umgebung {
      margin: 0;
      padding: 0.2rem 1.5rem;
      background: var(--warn);
      color: var(--surface);
      font-size: 0.85rem;
      text-align: center;
    }
    .umgebung a {
      margin-left: 0.5rem;
      color: inherit;
    }
    /* Die Sicht eines Mitglieds (REQ-241): fest oben, damit niemand
       vergisst, durch wessen Augen er gerade schaut. */
    .sicht {
      position: sticky;
      top: 0;
      z-index: 20;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 0.25rem 0.5rem;
      margin: 0;
      padding: 0.35rem 1rem;
      background: var(--accent);
      color: var(--surface);
      font-size: 0.9rem;
    }
    .sicht-rolle {
      padding: 0 0.4rem;
      border: 1px solid currentColor;
      border-radius: 10px;
      font-size: 0.75rem;
    }
    .sicht button {
      margin-left: 0.5rem;
      background: var(--surface);
      color: var(--accent);
      font-weight: 700;
    }
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
    .live {
      margin-left: auto;
      width: 0.55rem;
      height: 0.55rem;
      flex: none;
      border: 1.5px solid var(--dim);
      border-radius: 50%;
    }
    .live.offen {
      border-color: var(--accent);
      background: var(--accent);
    }
    .wer {
      color: var(--dim);
      text-decoration: none;
    }
    .wer:hover {
      color: var(--accent);
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
    .neu {
      margin: 0;
      padding: 0.4rem 1.5rem;
      background: var(--chip);
      border-bottom: 1px solid var(--accent);
      text-align: center;
    }
    .neu button {
      margin-left: 0.5rem;
    }
    /* Das Banner liegt über der Seite und verschiebt nichts — sonst
       spränge der Inhalt bei jeder langsamen Antwort. */
    .banner-ort {
      position: sticky;
      top: 0;
      z-index: 10;
      height: 0;
    }
    .banner {
      margin: 0;
      padding: 0.35rem 1.5rem;
      background: var(--chip);
      border-bottom: 1px solid var(--accent);
      color: var(--ink);
      font-size: 0.9rem;
      text-align: center;
      box-shadow: 0 1px 4px rgb(0 0 0 / 0.12);
    }
    .banner.fehler {
      background: var(--surface);
      border-bottom-color: var(--warn);
      color: var(--warn);
    }
    .banner button {
      margin-left: 0.5rem;
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
  /** Wo steht, was Daten löschen kann und wie man es rückgängig macht. */
  protected readonly betrieb =
    'https://github.com/Mrfudog/Atlas-Mentis/blob/preprod/docs/Betrieb.md#was-daten-löschen-kann';
  protected readonly bereiche = BEREICHE.filter((b) => b.weg !== 'play');

  protected readonly api = inject(Api);
  /** Der Live-Kanal (T-116) — hier geholt, damit er mit der Anmeldung steht. */
  protected readonly live = inject(Live);
  /** Ob gerade sichtbar gewartet wird: erst wenn eine Anfrage länger als
   *  300 ms läuft (REQ-246). Darunter wäre der Hinweis nur ein Flackern. */
  protected readonly wartet = signal(false);
  /** Was geladen wird, jedes Wort einmal: „registry, list". */
  protected readonly geladen = computed(() => [...new Set(this.api.laufend())].join(', '));
  private uhr: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    void this.session.load();
    effect(() => {
      const laeuft = this.api.laufend().length > 0;
      clearTimeout(this.uhr);
      if (!laeuft) this.wartet.set(false);
      else if (!this.wartet()) this.uhr = setTimeout(() => this.wartet.set(true), 300);
    });
  }

  protected neuLaden(): void {
    location.reload();
  }

  protected readonly warnung = signal<string | null>(null);

  /** Die Sicht verlassen und zurück auf die Kampagnenseite, von der man kam. */
  protected async sichtVerlassen(): Promise<void> {
    await this.session.viewAsUser(null);
    await this.router.navigateByUrl('/campaign');
  }

  protected async abmelden(): Promise<void> {
    this.warnung.set(await this.session.logout());
    await this.router.navigateByUrl('/login');
  }
}

import { Component, DestroyRef, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Api, type Tisch } from '../kern/api';
import { Live } from '../kern/live';
import { WurfZiel } from '../kern/wurfziel';
import { Karte } from './karte';
import { Zugplaner } from './zugplaner';

/**
 * **Play › Map** (T-115, CLAUDE.md „Play ist ein Schirm"): die Karte, die
 * an der laufenden Sitzung liegt (`SessionState.activeMap`). Was gerade
 * läuft, steht an der Sitzung und nicht am Schirm — sonst zeigte der Beamer
 * etwas anderes als der Laptop.
 *
 * `?map=` zeigt eine andere Karte, ohne die Sitzung zu ändern: wer in eine
 * Unterkarte hineinzoomt, schaut hinein, und der Tisch bleibt, wo er ist.
 * `?session=` wählt eine andere Sitzung. Ändert die Leitung `activeMap`,
 * kommt das über den Live-Kanal (T-116), und die Seite fragt neu.
 */
@Component({
  selector: 'nw-play',
  imports: [RouterLink, Karte, Zugplaner],
  /* Würfe auf diesem Schirm gehören zur Sitzung am Tisch (T-172). */
  providers: [WurfZiel],
  template: `
    <div class="seite" [class.mit-plan]="!!zp()?.planung()">
      <header class="kopf">
        <h1>Play</h1>
        @if (tisch(); as t) {
          <div class="wahl">
            @if (t.sessions.length) {
              <label>
                Session
                <select (change)="sitzung($any($event.target).value)">
                  @for (s of t.sessions; track s.id) {
                    <option [value]="s.id" [selected]="s.id === t.session">
                      {{ s.name }}{{ s.mapName ? ' · ' + s.mapName : '' }}
                    </option>
                  }
                </select>
              </label>
              @if (t.session) {
                <a [routerLink]="['/artikel', t.session]">Session article</a>
              }
            }
            @if (karteId() && karteId() !== t.map && t.map) {
              <a [routerLink]="['/play']" [queryParams]="{ map: null }" queryParamsHandling="merge">Back to the table map</a>
            }
          </div>
        }
      </header>

      @if (fehler(); as f) {
        <p class="leer" role="alert">{{ f }}</p>
      } @else if (!tisch()) {
        <p class="leer">Loading…</p>
      } @else if (karteId(); as id) {
        <!-- Der Zugplan (T-198): die Leiste sagt der Karte, was sie zeigt,
             und die Karte meldet zurück, was angetippt wurde. -->
        <nw-karte [id]="id" ort="play" [gross]="true" [planung]="zp.planung()" (planTipp)="zp.tipp($event)" (planWarnungen)="zp.warnungen.set($event)" />
        <nw-zugplaner #zp [karte]="id" />
      } @else {
        <section class="ohne">
          <p>
            No map is on the table.
            @if (tisch()?.session) {
              Set <i>Map on the table</i> on the
              <a [routerLink]="['/artikel', tisch()!.session]">session</a> — or open one here:
            } @else {
              There is no session with a map yet. Open one here:
            }
          </p>
          <ul>
            @for (m of tisch()?.maps ?? []; track m.id) {
              <li><a [routerLink]="['/play']" [queryParams]="{ map: m.id }">{{ m.name }}</a></li>
            } @empty {
              <li class="leer">No maps yet.</li>
            }
          </ul>
        </section>
      }
    </div>
  `,
  styles: `
    .seite {
      padding: 1rem 1.5rem 2rem;
    }
    .kopf {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem 1.5rem;
      margin-bottom: 0.5rem;
    }
    h1 {
      margin: 0;
      font-family: var(--caps);
      font-size: 1.6rem;
      color: var(--accent);
    }
    .wahl {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem 1rem;
    }
    .wahl label {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
    }
    .wahl select {
      max-width: 60vw;
      min-height: 36px;
    }
    .leer {
      color: var(--dim);
    }
    @media (max-width: 640px) {
      .seite {
        padding: 0.75rem 1rem 1.5rem;
      }
      /* Die Leiste liegt am Telefon fest unten (T-198): darunter Platz, damit nichts verdeckt bleibt. */
      .seite.mit-plan {
        padding-bottom: 50vh;
      }
    }
  `,
})
export class Play {
  /** Aus der Adresse (`withComponentInputBinding`). */
  readonly map = input<string | undefined>(undefined);
  readonly session = input<string | undefined>(undefined);

  private readonly api = inject(Api);
  private readonly router = inject(Router);
  /** Die Aktionsleiste (T-198), wenn eine Karte daliegt. */
  protected readonly zp = viewChild<Zugplaner>('zp');
  protected readonly tisch = signal<Tisch | null>(null);
  protected readonly fehler = signal<string | null>(null);
  protected readonly karteId = computed(() => this.map() || this.tisch()?.map || null);

  constructor() {
    const ziel = inject(WurfZiel);
    effect(() => ziel.sitzung.set(this.tisch()?.session ?? null));
    effect(() => {
      const s = this.session();
      untracked(() => this.holen(s));
    });
    /* **Play folgt der Sitzung** (T-116): legt die Leitung eine andere
       Karte auf den Tisch, wechselt jeder Schirm, der dieser Sitzung folgt —
       der Beamer wie das Telefon. Wer gerade in eine Unterkarte schaut
       (`?map=`), bleibt dort; „Back to the table map" bringt ihn zurück. */
    const ab = inject(Live).onSitzung((z) => {
      const t = this.tisch();
      if (!t || z.id === t.session || !t.session) this.holen(this.session());
    });
    inject(DestroyRef).onDestroy(ab);
  }

  private lauf = 0;
  private holen(session: string | undefined): void {
    const n = ++this.lauf;
    this.api
      .play(session)
      .then((t) => {
        if (n !== this.lauf) return;
        this.tisch.set(t);
        this.fehler.set(null);
      })
      .catch((e: Error) => {
        if (n === this.lauf) this.fehler.set(e.message);
      });
  }

  protected sitzung(id: string): void {
    void this.router.navigate(['/play'], { queryParams: { session: id, map: null } });
  }
}

import { Component, DestroyRef, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Api, type Tisch } from '../kern/api';
import { Live } from '../kern/live';
import { WurfZiel } from '../kern/wurfziel';
import { Initiative } from './initiative';
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
 *
 * **Auf dem Tisch liegt eine Instanz** (T-289): „Take into play" macht aus
 * der Vorlage die Karte dieser Sitzung. Spielende sehen sie erst nach der
 * Freigabe — bis dahin steht hier „No map is on the table", und die
 * Freigabe kommt als Artikel-Ereignis über den Live-Kanal.
 */
@Component({
  selector: 'nw-play',
  imports: [RouterLink, Initiative, Karte, Zugplaner],
  /* Würfe auf diesem Schirm gehören zur Sitzung am Tisch (T-172). */
  providers: [WurfZiel],
  template: `
    <div class="seite vollbild-ziel">
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
            <a routerLink="/maps">All maps</a>
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
        <!-- **Eine Leiste** (T-325): Zugplan und Tracker stehen in der Werkzeugleiste
             der Karte — der Zugplan als Werkzeug „Plan turn“, der Tracker als Panel.
             Gezeichnet werden sie hier; die Karte gibt ihnen den Platz. Der Zugplan
             sagt der Karte, was sie zeigt, und die Karte meldet zurück, was angetippt wurde. -->
        <nw-karte
          #karte
          [id]="id"
          ort="play"
          [sitzung]="tisch()?.session ?? null"
          [gross]="true"
          [planung]="zp.planung()"
          [zugplan]="zp.da()"
          [zugZahl]="zp.wartet()"
          [initiative]="!!tisch()?.encounter"
          (planTipp)="zp.tipp($event)"
          (planWarnungen)="zp.warnungen.set($event)"
          (insSpiel)="genommen()"
        >
          <nw-zugplaner nwZug #zp [karte]="id" />
          @if (tisch()?.encounter; as enc) {
            <nw-initiative nwInitiative [begegnung]="enc" />
          }
        </nw-karte>
      } @else if (tisch()?.encounter; as enc) {
        <!-- Der Initiative-Tracker (T-022) ohne Karte: die Begegnung, die die Sitzung führt. -->
        <nw-initiative class="tracker" [begegnung]="enc" />
      }
      @if (tisch() && !fehler() && !karteId()) {
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
              <li class="leer">No maps yet. A map is an image with a grid — <a routerLink="/maps">create one under Maps</a>.</li>
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
    .tracker {
      margin-top: 0.75rem;
    }
    /* Vollbild der Karte (T-203): die ganze Seite, damit der Zugplan dabei bleibt — ohne Kopf. */
    .seite:fullscreen {
      background: var(--bg);
      overflow: auto;
      padding: 0.5rem 0.75rem;
    }
    .seite:fullscreen .kopf {
      display: none;
    }
    @media (max-width: 640px) {
      .seite {
        padding: 0.75rem 1rem 1.5rem;
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
  /** Der Zugplaner (T-198), wenn eine Karte daliegt — als Werkzeug in ihrer Leiste (T-325). */
  protected readonly zp = viewChild<Zugplaner>('zp');
  private readonly karte = viewChild<Karte>('karte');
  protected readonly tisch = signal<Tisch | null>(null);
  protected readonly fehler = signal<string | null>(null);
  protected readonly karteId = computed(() => this.map() || this.tisch()?.map || null);

  constructor() {
    const ziel = inject(WurfZiel);
    effect(() => ziel.sitzung.set(this.tisch()?.session ?? null));
    /* Fragt ein Zug um eine Reaktion (Gelegenheitsangriff), geht „Plan turn“ auf — die Frage steht dort. */
    effect(() => {
      if (this.zp()?.fragt()) untracked(() => this.karte()?.werkzeugOeffnen('zug'));
    });
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
    /* Eine Karte, die erst jetzt sichtbar wird (Freigabe, T-289) oder
       verschwindet: neu fragen, was auf dem Tisch liegt. */
    const abKarte = inject(Live).onArtikel((e) => {
      const t = this.tisch();
      if (!t) return;
      if ((e.type === 'Map' && !t.map) || e.id === t.map) this.holen(this.session());
    });
    /* Etwas verpasst (`reset`, T-399): neu fragen, was auf dem Tisch liegt. */
    const abNeu = inject(Live).onNeu((was) => {
      if (was === 'reset') this.holen(this.session());
    });
    inject(DestroyRef).onDestroy(() => {
      ab();
      abKarte();
      abNeu();
    });
  }

  /** Die Leitung hat die Karte ins Spiel genommen: die Sitzung zeigt jetzt auf die Instanz. */
  protected genommen(): void {
    void this.router.navigate(['/play'], { queryParams: { session: this.tisch()?.session ?? null, map: null } });
    this.holen(this.session());
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

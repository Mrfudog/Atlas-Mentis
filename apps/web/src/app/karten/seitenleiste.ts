import { Component, DestroyRef, effect, inject, input, output, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Api, type KartenSeite } from '../kern/api';
import { KurzLink } from '../kern/kurzansicht';
import { BegriffLink, Glossar } from '../kern/glossar';
import { Live } from '../kern/live';
import { Session } from '../kern/session';

/** Der Datentyp beim Ziehen aus der Seitenleiste auf die Bühne. */
export const ZIEH_TYP = 'text/x-nw-artikel';

/**
 * **Die Seitenleiste der Karte** (T-203, docs/vorschlaege/Karten-VTT-Vergleich.md):
 * die Figuren der Gruppe mit Trefferpunkten und Zuständen — zentrieren,
 * wer auf der Karte steht, setzen oder aufs Feld ziehen, wer nicht — und
 * für die Leitung die Begegnungen der Sitzung mit ihren Teilnehmern.
 * Gerechnet und gesiebt am Server (`GET /api/maps/:id/side`); was auf der
 * Karte steht, weiss die Karte selbst.
 */
@Component({
  selector: 'nw-kartenseite',
  imports: [RouterLink, KurzLink, BegriffLink],
  template: `
    <section aria-label="Party">
      <h2>{{ seite()?.party?.name ?? 'Party' }}</h2>
      @for (f of seite()?.figures ?? []; track f.id) {
        <div
          class="figur"
          [class.zieht]="schreibt() && !aufKarte().has(f.id)"
          [attr.draggable]="schreibt() && !aufKarte().has(f.id) ? 'true' : null"
          (dragstart)="ziehen($event, f.id)"
        >
          <div class="kopf">
            <a [routerLink]="['/artikel', f.id]" [nwQuick]="f.id">{{ f.name }}</a>
            @if (aufKarte().has(f.id)) {
              <button type="button" class="klein" (click)="zentrieren.emit(f.id)" [attr.aria-label]="'Center the map on ' + f.name" title="Center the map on this token">◎</button>
            } @else if (schreibt()) {
              <button type="button" class="klein" (click)="setzen.emit({ id: f.id, name: f.name })" [attr.aria-label]="'Place ' + f.name + ' on the map'" title="Place on the map — or drag the row onto it">Place</button>
            }
          </div>
          @if (f.hp !== null || f.hpMax !== null) {
            <div class="tp" [title]="'Hit points ' + (f.hp ?? '?') + ' of ' + (f.hpMax ?? '?') + (f.hpTemp ? ', ' + f.hpTemp + ' temporary' : '')">
              <span class="balken" aria-hidden="true"><span [style.width.%]="anteil(f.hp, f.hpMax)" [class.tief]="anteil(f.hp, f.hpMax) <= 50"></span></span>
              <span class="zahl">{{ f.hp ?? '?' }}/{{ f.hpMax ?? '?' }}@if (f.hpTemp) { +{{ f.hpTemp }} }</span>
            </div>
          }
          @if (f.conditions.length) {
            <ul class="zustaende" aria-label="Conditions">
              @for (c of f.conditions; track c.id) {
                <li><a [routerLink]="['/artikel', c.id]" [nwQuick]="c.id" [nwBegriff]="begriff(c.id, c.name)">{{ c.name }}</a></li>
              }
            </ul>
          }
        </div>
      } @empty {
        <p class="dim">{{ geladen() ? 'No party in this campaign yet.' : 'Loading…' }}</p>
      }
    </section>

    @if (seite()?.session || seite()?.encounters?.length) {
      <section aria-label="Encounters">
        <h2>Encounters</h2>
        @if (seite()?.session; as s) {
          <p class="dim">of <a [routerLink]="['/artikel', s.id]">{{ s.name }}</a></p>
        }
        @for (e of seite()?.encounters ?? []; track e.id) {
          <div class="begegnung" [class.laeuft]="e.round > 0">
            <div class="kopf">
              <a [routerLink]="['/artikel', e.id]" [nwQuick]="e.id">{{ e.name }}</a>
              <span class="marke">{{ e.round > 0 ? 'Round ' + e.round : e.phase }}</span>
            </div>
            <p class="dim">
              <!-- Die Art (T-184): ein Rätsel oder Gespräch hat keine Kämpfer, die man setzen müsste. -->
              @if (e.kind.length) {
                <span class="art">{{ e.kind.join(', ') }}</span> ·
              }
              {{ gesetzt(e) }} of {{ e.participants.length }} on this map
              @if (!e.here) {
                · fought elsewhere
              }
            </p>
            @if (schreibt()) {
              <div class="knoepfe">
                @if (offen(e).length && e.round > 0) {
                  <button type="button" class="klein" (click)="alleSetzen.emit(offen(e))" [title]="'Put ' + offen(e).length + ' combatants on the map, in the middle of the view'">
                    Place {{ offen(e).length }}
                  </button>
                } @else if (offen(e).length) {
                  <!-- Vorplatzieren (T-203): versteckt, blass, nur für die Leitung — bis die Begegnung beginnt. -->
                  <button type="button" class="klein" (click)="vorbereiten.emit({ encounter: e.id, ids: offen(e) })" [title]="'Set ' + offen(e).length + ' combatants on the map, hidden from the players until the encounter starts'">
                    Prepare {{ offen(e).length }}
                  </button>
                }
                @if (e.round === 0) {
                  <button type="button" class="klein start" (click)="starten(e)" [disabled]="startet() === e.id" title="Roll initiative for who has none, reveal the prepared tokens and run this encounter in the session">
                    {{ startet() === e.id ? 'Starting…' : '▶ Start' }}
                  </button>
                }
              </div>
            }
          </div>
        } @empty {
          <p class="dim">No encounter in this session yet.</p>
        }
        @if (fehler(); as f) {
          <p class="fehler" role="alert">{{ f }}</p>
        }
      </section>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding: 0.6rem;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--surface);
      font-size: 0.9rem;
      overflow: auto;
      /* Neben der Bühne (T-203): schmal, nicht höher als sie; am Telefon darunter, volle Breite. */
      flex: none;
      width: 15rem;
      max-height: min(70vh, 720px);
      box-sizing: border-box;
    }
    @media (max-width: 640px) {
      :host {
        width: auto;
        max-height: none;
      }
    }
    h2 {
      margin: 0 0 0.3rem;
      font-family: var(--caps);
      font-size: 1rem;
      color: var(--accent);
    }
    .figur,
    .begegnung {
      padding: 0.35rem 0;
      border-top: 1px solid var(--line);
    }
    .figur.zieht {
      cursor: grab;
    }
    .kopf {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.4rem;
    }
    .kopf a {
      font-weight: 600;
      color: var(--ink);
      text-decoration: none;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    button.klein {
      min-height: 30px;
      min-width: 30px;
      padding: 0 0.5rem;
      font-size: 0.85rem;
    }
    .tp {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      margin-top: 0.2rem;
    }
    .balken {
      flex: 1;
      height: 6px;
      border-radius: 3px;
      background: var(--chip);
      overflow: hidden;
    }
    .balken span {
      display: block;
      height: 100%;
      background: #3f7a4f;
    }
    .balken span.tief {
      background: var(--warn);
    }
    .zahl {
      font-variant-numeric: tabular-nums;
      color: var(--dim);
    }
    .zustaende {
      list-style: none;
      margin: 0.25rem 0 0;
      padding: 0;
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem;
    }
    .zustaende a {
      display: inline-block;
      padding: 0 0.35rem;
      border-radius: 3px;
      background: var(--chip);
      color: var(--ink);
      font-size: 0.8rem;
      text-decoration: none;
    }
    .marke {
      font-size: 0.75rem;
      padding: 0 0.3rem;
      border-radius: 3px;
      background: var(--chip);
      color: var(--dim);
      white-space: nowrap;
    }
    .laeuft .marke {
      background: var(--accent);
      color: var(--surface);
    }
    .dim {
      margin: 0.15rem 0;
      color: var(--dim);
    }
    .knoepfe {
      display: flex;
      flex-wrap: wrap;
      gap: 0.3rem;
    }
    button.start {
      border-color: var(--accent);
      color: var(--accent);
      font-weight: 600;
    }
    .fehler {
      margin: 0.25rem 0 0;
      color: var(--warn);
    }
  `,
})
export class KartenSeitenleiste {
  /** Ein Zustand mit Glossareintrag (T-242): Strg/⌘+Klick öffnet ihn. */
  protected readonly glossar = inject(Glossar);
  protected begriff(id: string | null | undefined, name: string): string | null {
    return this.glossar.begriffZu(id, name);
  }

  readonly karte = input.required<string>();
  readonly sitzung = input<string | null>(null);
  /** Welche Ziele schon einen Marker auf der Karte haben. */
  readonly aufKarte = input<ReadonlySet<string>>(new Set());
  /** Schreibt der Betrachter die Karte? Dann setzt und zieht er. */
  readonly schreibt = input(false);

  readonly zentrieren = output<string>();
  readonly setzen = output<{ id: string; name: string }>();
  readonly alleSetzen = output<string[]>();
  readonly vorbereiten = output<{ encounter: string; ids: string[] }>();

  private readonly api = inject(Api);
  private readonly session = inject(Session);
  private readonly router = inject(Router);
  protected readonly seite = signal<KartenSeite | null>(null);
  protected readonly geladen = signal(false);
  private lauf = 0;

  constructor() {
    effect(() => {
      const k = this.karte();
      const s = this.sitzung();
      untracked(() => void this.holen(k, s));
    });
    /* **Live** (T-116): Trefferpunkte und Zustände ändern sich am Tisch,
       eine Begegnung beginnt — dann fragt die Leiste neu. */
    const ab = inject(Live).onArtikel((ev) => {
      const s = this.seite();
      const betrifft =
        ev.type === 'Encounter' || ev.type === 'Party' || !!s?.figures.some((f) => f.id === ev.id) || ev.id === s?.session?.id;
      if (betrifft) void this.holen(this.karte(), this.sitzung());
    });
    inject(DestroyRef).onDestroy(() => {
      ab();
      this.lauf += 1;
    });
  }

  private async holen(karte: string, sitzung: string | null): Promise<void> {
    const n = ++this.lauf;
    try {
      const s = await this.api.mapSide(karte, sitzung);
      if (n === this.lauf) this.seite.set(s);
    } catch {
      if (n === this.lauf) this.seite.set(null);
    } finally {
      if (n === this.lauf) this.geladen.set(true);
    }
  }

  protected readonly startet = signal<string | null>(null);
  protected readonly fehler = signal<string | null>(null);

  /** „Start“ (T-203): der Server würfelt, deckt auf und lässt die Sitzung führen; Live bringt den Rest. */
  protected async starten(e: KartenSeite['encounters'][number]): Promise<void> {
    if (this.startet()) return;
    this.startet.set(e.id);
    this.fehler.set(null);
    try {
      const r = await this.api.startEncounter(e.id, { map: this.karte(), session: this.seite()?.session?.id ?? this.sitzung() });
      /* Begonnen wird eine Instanz (T-289), oft auf einer neuen Instanz der
         Karte: die schreibt die Leitung (`/api/me`), und Play folgt dem Tisch. */
      await this.session.load(true);
      if (r.map && r.map !== this.karte() && this.router.url.startsWith('/play')) {
        await this.router.navigate(['/play'], { queryParams: { session: r.session, map: null } });
        return;
      }
      await this.holen(this.karte(), this.sitzung());
    } catch (err) {
      this.fehler.set(err instanceof Error ? err.message : 'The encounter did not start.');
    } finally {
      this.startet.set(null);
    }
  }

  protected anteil(hp: number | null, max: number | null): number {
    if (hp === null || !max) return 100;
    return Math.max(0, Math.min(100, (hp / max) * 100));
  }

  protected gesetzt(e: KartenSeite['encounters'][number]): number {
    const da = this.aufKarte();
    return e.participants.filter((p) => da.has(p.id)).length;
  }
  protected offen(e: KartenSeite['encounters'][number]): string[] {
    const da = this.aufKarte();
    return e.participants.filter((p) => !da.has(p.id)).map((p) => p.id);
  }

  protected ziehen(ev: DragEvent, id: string): void {
    if (!this.schreibt() || this.aufKarte().has(id)) return;
    ev.dataTransfer?.setData(ZIEH_TYP, id);
    if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'copy';
  }
}


import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Entity } from '@nw/model';
import { Api, type ListenFrage, type ListenZeile } from '../kern/api';
import { KurzLink } from '../kern/kurzansicht';
import { Session } from '../kern/session';
import { bildAdresse } from '../artikel/bild';

/** Ein Abschnitt des Reiters: was er fragt und wie er heisst. */
interface Abschnitt {
  id: string;
  label: string;
  /** Eine oder mehrere Listenfragen; ihre Zeilen stehen zusammen. */
  fragen: ListenFrage[];
  /** Nur Zeilen, die die Figur kennt (`knownBy` an ihr oder ihrer Gruppe). */
  gewusst?: boolean;
}

const ABSCHNITTE: readonly Abschnitt[] = [
  /* Handouts (Die Leitung): Bilder, Karten, Briefe — Assets —, dazu Wissen
     und Artikel, die zugeteilt wurden. */
  { id: 'handouts', label: 'Handouts', fragen: [{ type: 'Asset' }, { type: 'Information', rel: ['knownBy'] }, { type: 'Knowledge', rel: ['knownBy'] }], gewusst: true },
  { id: 'sessions', label: 'Sessions', fragen: [{ type: 'Session' }] },
  { id: 'quests', label: 'Quests', fragen: [{ type: 'Quest' }] },
  { id: 'people', label: 'People you met', fragen: [{ type: 'Creature', f: ['Creature.kind:npc'] }] },
  { id: 'encounters', label: 'Encounters', fragen: [{ type: 'Encounter' }] },
  { id: 'maps', label: 'Maps', fragen: [{ type: 'Map' }] },
  { id: 'places', label: 'Places', fragen: [{ type: 'Place' }] },
];

/**
 * **Der Reiter Campaign für Spielende** (T-247, REQ-346, Element `campaign`):
 * Handouts (Assets wie Karten, Briefe, Bilder; Wissen, das die Figur
 * kennt), Sitzungen mit ihrem Rückblick in der Kurzansicht, Quests,
 * Personen, Begegnungen, Karten, Orte. **Gesiebt am Server**: jede
 * Abfrage geht über `GET /api/list`, die Sichtbarkeit, Stand und Stapel
 * rechnet — was hier ankommt, darf gezeigt werden (`redactEntity`), und
 * eine zweite Prüfung in der Maske gibt es nicht. Wissen zählt nur, wenn
 * es an der Figur oder ihrer Gruppe hängt (`knownBy`, ein Schritt).
 */
@Component({
  selector: 'nw-figur-kampagne',
  imports: [RouterLink, KurzLink],
  template: `
    <section class="kampagne" aria-label="Campaign">
      <nav class="abschnitte" aria-label="Campaign sections">
        @for (a of abschnitte; track a.id) {
          <button type="button" [class.an]="a.id === aktiv()" (click)="aktiv.set(a.id)">
            {{ a.label }} <small>{{ zeilen()[a.id]?.length ?? '…' }}</small>
          </button>
        }
        <small class="fuss">{{ leitung() ? 'As GM you see everything; players see only what visibility and knowledge give them.' : 'Only what your character has seen or been given.' }}</small>
      </nav>
      <div class="inhalt">
        @let liste = zeilen()[aktiv()];
        @if (liste === undefined) {
          <p class="leer">Loading…</p>
        } @else if (aktiv() === 'handouts') {
          <div class="kacheln">
            @for (z of liste; track z.id) {
              <a class="kachel" [routerLink]="['/artikel', z.id]" [nwQuick]="z.id">
                @if (bild(z.image); as src) {
                  <img [src]="src" alt="" loading="lazy" />
                } @else {
                  <span class="platzhalter" aria-hidden="true">{{ marke(z) }}</span>
                }
                <span class="marke">{{ marke(z) }}</span>
                <b>{{ z.name }}</b>
              </a>
            } @empty {
              <p class="leer">No handouts yet.</p>
            }
          </div>
        } @else {
          <ul class="zeilen">
            @for (z of liste; track z.id) {
              <li><a [routerLink]="['/artikel', z.id]" [nwQuick]="z.id">{{ z.name }}</a> <small>{{ z.type }}</small></li>
            } @empty {
              <li class="leer">Nothing here yet.</li>
            }
          </ul>
        }
      </div>
    </section>
  `,
  styles: `
    .kampagne { display: grid; grid-template-columns: 14rem minmax(0, 1fr); gap: .75rem; margin: 1rem 0; }
    .abschnitte { display: flex; flex-direction: column; gap: .3rem; }
    .abschnitte button { display: flex; justify-content: space-between; min-height: 40px; text-align: left; }
    .abschnitte button.an { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); font-weight: 700; }
    small, .leer, .fuss { color: var(--dim); font-size: .85rem; }
    .kacheln { display: grid; grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr)); gap: .6rem; }
    .kachel { display: flex; flex-direction: column; gap: .2rem; padding: .5rem; border: 1px solid var(--line); border-radius: 6px; background: var(--surface); text-decoration: none; color: var(--ink); min-width: 0; }
    .kachel img, .platzhalter { width: 100%; height: 96px; object-fit: cover; border-radius: 4px; background: var(--chip); }
    .platzhalter { display: flex; align-items: center; justify-content: center; font-family: var(--caps); color: var(--dim); }
    .marke { font-size: .75rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--accent); }
    .kachel b { font-family: var(--caps); color: var(--heading); overflow-wrap: anywhere; }
    .zeilen { list-style: none; margin: 0; padding: 0; }
    .zeilen li { padding: .45rem 0; border-bottom: 1px solid var(--line2); }
    @media (max-width: 760px) {
      .kampagne { grid-template-columns: 1fr; }
      .abschnitte { flex-direction: row; flex-wrap: wrap; }
      .abschnitte button { flex: 1 1 9rem; }
      .kacheln { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
  `,
})
export class FigurKampagne {
  readonly artikel = input.required<Entity>();

  private readonly api = inject(Api);
  private readonly session = inject(Session);

  protected readonly abschnitte = ABSCHNITTE;
  protected readonly aktiv = signal('handouts');
  protected readonly zeilen = signal<Record<string, ListenZeile[]>>({});
  /** Die Leitung sieht mehr — der Hinweis sagt es, damit sie nicht meint, die Spielerin sähe dasselbe. */
  protected readonly leitung = this.session.leitung;

  /** Wer als „die Figur" zählt: sie selbst und ihre Gruppen. */
  private readonly traeger = computed(() => {
    const e = this.artikel();
    return new Set([e.id, ...(e.relations ?? []).filter((r) => r.type === 'memberOfParty').map((r) => r.to)]);
  });

  constructor() {
    effect(() => {
      const traeger = this.traeger();
      untracked(() => void this.laden(traeger));
    });
  }

  private async laden(traeger: ReadonlySet<string>): Promise<void> {
    const raus: Record<string, ListenZeile[]> = {};
    await Promise.all(
      ABSCHNITTE.map(async (a) => {
        try {
          const listen = await Promise.all(a.fragen.map((f) => this.api.list({ limit: 60, ...f })));
          raus[a.id] = listen.flatMap((l, i) =>
            a.gewusst && a.fragen[i]!.rel?.includes('knownBy')
              ? l.rows.filter((z) => (z.rels?.['knownBy'] ?? []).some((t) => traeger.has(t)))
              : l.rows,
          );
        } catch {
          raus[a.id] = [];
        }
      }),
    );
    this.zeilen.set(raus);
  }

  protected marke(z: ListenZeile): string {
    if (z.type === 'Asset') return 'Image';
    return z.type === 'Information' || z.type === 'Knowledge' ? 'Knowledge' : z.type;
  }

  protected bild(wert: string | undefined): string | null {
    return wert ? bildAdresse(wert, 'thumb') : null;
  }
}

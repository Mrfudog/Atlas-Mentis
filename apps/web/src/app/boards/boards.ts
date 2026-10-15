import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { BOARD_TYPE, entityName, isInstance, PART_OF_RELATION, primaryInterface } from '@nw/model';
import type { Entity } from '@nw/model';
import { Bestand, schmal } from '../kern/bestand';
import { Session } from '../kern/session';
import { Brett, isBoard, isStoryRung, storyOf, type Mangel } from './brett';

interface Sprosse {
  e: Entity;
  name: string;
  art: string;
  tiefe: number;
  boards: Entity[];
}

/**
 * Die Boards (REQ-205): **eines je Geschichtsartikel** — Kampagne, Kapitel,
 * Sitzung — in der Reihenfolge ihrer `partOf`-Kette, und darunter die
 * Regel-Boards, die zu keiner Geschichte gehören.
 *
 * Gelesen wird aus der Liste am Server (`Bestand.liste`, W7): die Boards
 * und die Geschichte, je Zeile Art, Name und die Kante `partOf` (`rel=`),
 * und mehr braucht eine Liste nicht. Ein Board selbst kommt erst, wenn man
 * es öffnet.
 */
@Component({
  selector: 'nw-boards',
  imports: [RouterLink],
  template: `
    <div class="seite">
      <header class="kopf">
        <h1>Boards</h1>
        @if (darfAnlegen()) {
          <button type="button" (click)="neu()" [disabled]="legtAn()">+ Rule board</button>
        }
      </header>
      @if (fehler(); as f) {
        <div class="fehler" role="alert">
          <p>{{ f.text }}</p>
          @if (f.einzeln.length) {
            <ul>
              @for (m of f.einzeln; track m) {
                <li>{{ m }}</li>
              }
            </ul>
          }
        </div>
      }

      @if (!bestand.geladen() || !geholt()) {
        <p class="leer">Loading…</p>
      } @else {
        <section>
          <h2>Story</h2>
          <p class="hinweis">One board per campaign, chapter and session — scenes are cards on them.</p>
          @if (sprossen().length) {
            <ul class="liste">
              @for (s of sprossen(); track s.e.id) {
                <li [style.padding-left.rem]="s.tiefe * 1.25 + 0.75">
                  <span class="art">{{ s.art }}</span>
                  <a class="story" [routerLink]="['/artikel', s.e.id]">{{ s.name }}</a>
                  <span class="boards">
                    @for (b of s.boards; track b.id) {
                      <a class="board" [routerLink]="['/boards', b.id]" [title]="'Open the board ' + name(b)"><span aria-hidden="true">▦</span> {{ boardName(b, s.e) }}</a>
                    } @empty {
                      @if (darfAnlegen()) {
                        <button type="button" class="klein" (click)="neu(s.e)" [disabled]="legtAn()">
                          + Board
                        </button>
                      } @else {
                        <span class="ohne">no board</span>
                      }
                    }
                  </span>
                </li>
              }
            </ul>
          } @else {
            <p class="leer">No campaign, chapter or session yet.</p>
          }
        </section>

        <section>
          <h2>Rules and everything else</h2>
          @if (andere().length) {
            <ul class="liste">
              @for (b of andere(); track b.id) {
                <li>
                  <span class="art">Board</span>
                  <a class="board" [routerLink]="['/boards', b.id]"><span aria-hidden="true">▦</span> {{ name(b) }}</a>
                </li>
              }
            </ul>
          } @else {
            <p class="leer">No board outside the story yet.</p>
          }
        </section>
      }
    </div>
  `,
  styles: `
    .seite {
      max-width: 960px;
      margin: 0 auto;
      padding: 1.25rem 1.5rem 3rem;
    }
    .kopf {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }
    h1,
    h2 {
      font-family: var(--caps);
      color: var(--accent);
    }
    h1 {
      margin: 0;
      font-size: 1.9rem;
    }
    h2 {
      margin: 1.75rem 0 0.25rem;
      font-size: 1.25rem;
    }
    .hinweis,
    .leer,
    .ohne {
      color: var(--dim);
    }
    .hinweis {
      margin: 0 0 0.5rem;
    }
    .liste {
      margin: 0;
      padding: 0;
      list-style: none;
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 6px;
    }
    .liste li {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0.25rem 0.75rem;
      padding: 0.45rem 0.75rem;
      border-top: 1px solid var(--line2);
    }
    .liste li:first-child {
      border-top: 0;
    }
    .art {
      min-width: 5.5rem;
      color: var(--dim);
      font-size: 0.85rem;
    }
    .story {
      font-family: var(--serif);
      font-weight: 700;
      color: var(--ink);
      text-decoration: none;
    }
    .story:hover {
      color: var(--accent);
    }
    .boards {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-left: auto;
    }
    /* Ein Board ist ein Knopf mit Symbol (T-203), kein loser fetter Link am Zeilenende. */
    .board {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      min-height: 32px;
      padding: 0 0.7rem;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--surface);
      color: var(--ink);
      font-weight: 600;
      font-size: 0.9rem;
      text-decoration: none;
    }
    .board:hover,
    .board:focus-visible {
      background: var(--hover);
      border-color: var(--accent);
    }
    .board span {
      color: var(--accent);
    }
    button.klein {
      min-height: 32px;
      padding: 0 0.6rem;
      font-size: 0.9rem;
    }
    .fehler {
      margin: 1rem 0;
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--warn);
      color: var(--warn);
      background: var(--surface);
    }
    .fehler p {
      margin: 0;
    }
    @media (max-width: 640px) {
      .seite {
        padding: 1rem;
      }
      .boards {
        margin-left: 0;
        flex-basis: 100%;
      }
    }
  `,
})
export class Boards {
  protected readonly bestand = inject(Bestand);
  private readonly session = inject(Session);
  private readonly brett = inject(Brett);
  private readonly router = inject(Router);

  constructor() {
    void this.bestand.load();
    void this.holen();
  }

  protected readonly fehler = signal<Mangel | null>(null);
  protected readonly legtAn = signal(false);

  /** Anlegen darf, wer alles schreiben darf — ein neuer Artikel steht in keiner Liste. */
  protected readonly darfAnlegen = computed(() => this.session.darfSchreiben()(''));

  /* Die Boards und die Sprossen der Geschichte — Kampagneninhalt, eine
     Handvoll; ein Blatt von 200 reicht für beide. */
  private readonly zeilen = signal<Entity[]>([]);
  protected readonly geholt = signal(false);
  private async holen(): Promise<void> {
    try {
      const [b, g] = await Promise.all([
        this.bestand.liste({ type: BOARD_TYPE, rel: [PART_OF_RELATION], limit: 200 }),
        this.bestand.liste({ of: ['Story'], rel: [PART_OF_RELATION], limit: 200 }),
      ]);
      this.zeilen.set([...b.rows, ...g.rows].map(schmal));
    } catch (e) {
      this.fehler.set({ text: e instanceof Error ? e.message : String(e), einzeln: [] });
    } finally {
      this.geholt.set(true);
    }
  }

  private readonly boards = computed(() => this.zeilen().filter(isBoard));

  /**
   * Die Geschichte als Baum aus `partOf`, die Wurzeln zuerst, darunter ihre
   * Teile, jede Ebene nach Namen. Eine Szene steht nicht da (REQ-205); was
   * unter ihr hängt, auch nicht.
   */
  protected readonly sprossen = computed<Sprosse[]>(() => {
    const r = this.bestand.registry();
    if (!r) return [];
    const stories = this.zeilen().filter((e) => !isInstance(e) && isStoryRung(r, e));
    const ids = new Set(stories.map((e) => e.id));
    const kinder = new Map<string | null, Entity[]>();
    for (const e of stories) {
      const hoch = (e.relations ?? []).find((x) => x.type === PART_OF_RELATION)?.to;
      const vater = hoch && ids.has(hoch) ? hoch : null;
      kinder.set(vater, [...(kinder.get(vater) ?? []), e]);
    }
    const boardsJe = new Map<string, Entity[]>();
    for (const b of this.boards()) {
      const s = storyOf(b);
      if (s) boardsJe.set(s, [...(boardsJe.get(s) ?? []), b]);
    }
    const out: Sprosse[] = [];
    const gesehen = new Set<string>();
    const legen = (vater: string | null, tiefe: number) => {
      const liste = [...(kinder.get(vater) ?? [])].sort((a, b) =>
        entityName(a).localeCompare(entityName(b), 'de', { numeric: true }),
      );
      for (const e of liste) {
        if (gesehen.has(e.id)) continue;
        gesehen.add(e.id);
        out.push({
          e,
          name: entityName(e),
          art: this.artLabel(e),
          tiefe,
          boards: boardsJe.get(e.id) ?? [],
        });
        legen(e.id, tiefe + 1);
      }
    };
    legen(null, 0);
    return out;
  });

  /** Boards, die zu keiner Sprosse der Geschichte gehören: Regel-Boards und der Rest. */
  protected readonly andere = computed(() => {
    const anStory = new Set(this.sprossen().map((s) => s.e.id));
    return this.boards()
      .filter((b) => {
        const s = storyOf(b);
        return !s || !anStory.has(s);
      })
      .sort((a, b) => entityName(a).localeCompare(entityName(b), 'de', { numeric: true }));
  });

  protected name(e: Entity): string {
    return entityName(e);
  }

  /** Heisst das Board wie sein Artikel, steht „Open board" — der Name stünde zweimal da. */
  protected boardName(b: Entity, story: Entity): string {
    const n = entityName(b);
    return n === entityName(story) ? 'Open board' : n;
  }

  private artLabel(e: Entity): string {
    const typ = primaryInterface(e);
    return this.bestand.registry()?.interfaces[typ]?.label ?? typ;
  }

  protected async neu(story?: Entity): Promise<void> {
    if (this.legtAn()) return;
    this.legtAn.set(true);
    this.fehler.set(null);
    const r = await this.brett.anlegen(story);
    this.legtAn.set(false);
    if ('id' in r) await this.router.navigate(['/boards', r.id]);
    else this.fehler.set(r);
  }
}

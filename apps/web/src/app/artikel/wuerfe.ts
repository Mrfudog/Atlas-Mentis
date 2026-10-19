import { Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { rollText, type RollEntry } from '@nw/model';
import { Api, type WurfLog } from '../kern/api';
import { Live } from '../kern/live';
import { WurfZiel } from '../kern/wurfziel';

/**
 * **Das Log der Würfe an einem Artikel** (T-172, REQ-070): aufklappbar,
 * neueste zuerst, nach Person und Sitzung filterbar, seitenweise. An einer
 * Kreatur stehen die Würfe auf ihrem Statblock mit darin, an einer Sitzung
 * alle Würfe dieser Sitzung — das rechnet der Server (`GET /api/rolls`),
 * und er siebt: was hier ankommt, darf gezeigt werden.
 *
 * Neue Würfe kommen über den Live-Kanal (T-116) dazu. Darunter ein freier
 * Wurf auf diesen Artikel; die Leitung darf ihn — und jeden Würfelknopf
 * dieser Seite — verdeckt würfeln (`WurfZiel.verdeckt`).
 */
@Component({
  selector: 'nw-wuerfe',
  imports: [RouterLink],
  template: `
    <details class="log" (toggle)="offen.set($any($event.target).open)">
      <summary>
        <h2>Log</h2>
        @if (log(); as l) {
          <span class="zahl">{{ l.total }}</span>
        }
      </summary>
      <form class="frei" (submit)="$event.preventDefault(); frei()">
        <input type="text" [value]="ausdruck()" (input)="ausdruck.set($any($event.target).value)" placeholder="1d20+3" aria-label="Dice expression" />
        <button type="submit" [disabled]="!ausdruck().trim()">Roll</button>
        @if (log()?.leitet) {
          <label class="verdeckt" title="Only the GM sees the result and the entry — also for the dice buttons on this page">
            <input type="checkbox" [checked]="ziel.verdeckt()" (change)="ziel.verdeckt.set($any($event.target).checked)" /> Hidden
          </label>
        }
      </form>
      @if (fehler(); as f) {
        <p class="leer" role="alert">{{ f }}</p>
      }
      @if (log(); as l) {
        @if (l.people.length > 1 || l.sessions.length > 1) {
          <div class="filter">
            @if (l.people.length > 1) {
              <select aria-label="Who rolled" (change)="wer.set($any($event.target).value)">
                <option value="">Everyone</option>
                @for (p of l.people; track p.id) {
                  <option [value]="p.id" [selected]="p.id === wer()">{{ p.name }}</option>
                }
              </select>
            }
            @if (l.sessions.length > 1) {
              <select aria-label="Session" (change)="sitzung.set($any($event.target).value)">
                <option value="">All sessions</option>
                @for (s of l.sessions; track s.id) {
                  <option [value]="s.id" [selected]="s.id === sitzung()">{{ s.name }}</option>
                }
              </select>
            }
          </div>
        }
        @if (eintraege().length) {
          <ol class="liste">
            @for (w of eintraege(); track w.id) {
              <li [class.verdeckt]="w.hidden">
                <div class="kopf">
                  <strong class="summe" [class.krit]="w.crit === 'crit'" [class.patzer]="w.crit === 'fumble'">{{ w.total }}</strong>
                  <span class="was">{{ w.label || w.expr }}</span>
                  <time [attr.datetime]="w.at" [title]="w.at">{{ zeit(w.at) }}</time>
                </div>
                <div class="detail">
                  {{ w.entered ? 'entered' : rollText(w) }}
                  @if (w.mode) {<span class="marke">{{ w.mode === 'adv' ? 'adv.' : 'dis.' }}</span>}
                  @if (w.crit) {<span class="marke">{{ w.crit === 'crit' ? 'natural 20' : 'natural 1' }}</span>}
                  @if (w.hidden) {<span class="marke">hidden</span>}
                </div>
                <div class="wer">
                  {{ w.by.name }}@if (w.actor) {<ng-container> as {{ w.actor.name }}</ng-container>}
                  @if (w.subject && w.subject !== artikel()) {
                    · @if (w.subjectName === null) {<span class="weg">deleted article</span>} @else {<a [routerLink]="['/artikel', w.subject]">{{ w.subjectName }}</a>}
                  }
                </div>
              </li>
            }
          </ol>
          @if (l.next !== null) {
            <button type="button" class="mehr" (click)="mehr()" [disabled]="laedt()">Older rolls</button>
          }
        } @else {
          <p class="leer">No rolls yet.</p>
        }
      } @else if (offen() && !fehler()) {
        <p class="leer">Loading…</p>
      }
    </details>
  `,
  styles: `
    :host {
      display: block;
    }
    summary {
      display: flex;
      align-items: baseline;
      gap: 0.5rem;
      cursor: pointer;
      list-style-position: outside;
    }
    h2 {
      display: inline;
      margin: 0;
      font-family: var(--caps);
      font-size: 1.1rem;
      color: var(--accent);
    }
    .zahl,
    time,
    .wer,
    .leer {
      color: var(--dim);
      font-size: 0.85rem;
    }
    .frei,
    .filter {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      align-items: center;
      margin-top: 0.5rem;
    }
    .frei input[type='text'] {
      flex: 1 1 6rem;
      min-width: 0;
    }
    .filter select {
      flex: 1 1 8rem;
      min-width: 0;
    }
    .verdeckt {
      font-size: 0.9rem;
    }
    .liste {
      list-style: none;
      padding: 0;
      margin: 0.5rem 0 0;
    }
    .liste li {
      padding: 0.35rem 0;
      border-bottom: 1px solid var(--line2);
    }
    .liste li:last-child {
      border-bottom: 0;
    }
    .liste li.verdeckt {
      opacity: 0.8;
      border-left: 2px dashed var(--line);
      padding-left: 0.4rem;
    }
    .kopf {
      display: flex;
      gap: 0.5rem;
      align-items: baseline;
    }
    .summe {
      font-size: 1.15rem;
      min-width: 2ch;
    }
    .summe.krit {
      color: var(--ok, #2e7d32);
    }
    .summe.patzer {
      color: var(--warn);
    }
    .was {
      flex: 1;
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .detail {
      font-size: 0.9rem;
      overflow-wrap: anywhere;
    }
    .marke {
      margin-left: 0.35rem;
      font-size: 0.8rem;
      padding: 0 0.3rem;
      border: 1px solid var(--line);
      border-radius: 4px;
    }
    .weg {
      font-style: italic;
    }
    .mehr {
      margin-top: 0.4rem;
    }
  `,
})
export class Wuerfe {
  /** Der Artikel, dessen Log hier steht. */
  readonly artikel = input.required<string>();

  private readonly api = inject(Api);
  protected readonly ziel = inject(WurfZiel);
  protected readonly rollText = rollText;

  protected readonly offen = signal(false);
  protected readonly log = signal<WurfLog | null>(null);
  protected readonly fehler = signal<string | null>(null);
  protected readonly laedt = signal(false);
  protected readonly wer = signal('');
  protected readonly sitzung = signal('');
  protected readonly ausdruck = signal('');
  protected readonly eintraege = computed<RollEntry[]>(() => this.log()?.entries ?? []);

  constructor() {
    /* Geholt wird erst beim Aufklappen, und neu, wenn Artikel oder Filter wechseln. */
    effect(() => {
      const an = this.offen();
      const id = this.artikel();
      const by = this.wer();
      const session = this.sitzung();
      if (an) untracked(() => void this.holen(id, by, session));
    });
    effect(() => {
      this.artikel();
      untracked(() => {
        this.log.set(null);
        this.wer.set('');
        this.sitzung.set('');
      });
    });
    /* Ein neuer Wurf am Tisch: oben dazu, wenn er hierher gehört. */
    const ab = inject(Live).onWurf((w) => this.dazu(w));
    inject(DestroyRef).onDestroy(ab);
  }

  private lauf = 0;
  private async holen(id: string, by: string, session: string, offset = 0): Promise<void> {
    const n = ++this.lauf;
    this.laedt.set(true);
    try {
      const l = await this.api.rolls(id, { by, session, offset, limit: 25 });
      if (n !== this.lauf) return;
      const vorher = offset ? (this.log()?.entries ?? []) : [];
      this.log.set({ ...l, entries: [...vorher, ...l.entries.filter((e) => !vorher.some((v) => v.id === e.id))] });
      this.fehler.set(null);
    } catch (e) {
      if (n === this.lauf) this.fehler.set((e as Error).message);
    } finally {
      if (n === this.lauf) this.laedt.set(false);
    }
  }

  protected mehr(): void {
    const l = this.log();
    if (l?.next != null) void this.holen(this.artikel(), this.wer(), this.sitzung(), l.next);
  }

  /** Gehört der Wurf in dieses Log (und durch die Filter)? */
  private dazu(w: RollEntry): void {
    const l = this.log();
    if (!l || l.entries.some((e) => e.id === w.id)) return;
    const hier = (w.subject && l.subjects.includes(w.subject)) || w.session === this.artikel();
    if (!hier) return;
    if ((this.wer() && w.by?.id !== this.wer()) || (this.sitzung() && w.session !== this.sitzung())) return;
    const people = l.people.some((p) => p.id === w.by.id) ? l.people : [...l.people, { id: w.by.id, name: w.by.name }];
    this.log.set({ ...l, entries: [w, ...l.entries], total: l.total + 1, people, next: l.next === null ? null : l.next + 1 });
  }

  /** Ein freier Wurf auf diesen Artikel. */
  protected async frei(): Promise<void> {
    const expr = this.ausdruck().trim();
    if (!expr) return;
    try {
      const w = await this.api.roll({ expr, subject: this.artikel(), hidden: this.ziel.verdeckt() || undefined, session: this.ziel.sitzung() ?? undefined });
      this.dazu(w);
      this.fehler.set(null);
    } catch (e) {
      this.fehler.set((e as Error).message);
    }
  }

  protected zeit(at: string): string {
    const d = new Date(at);
    const heute = new Date().toDateString() === d.toDateString();
    return heute
      ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
}

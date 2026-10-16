import { Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { filterTurn, groupTurn, toggleUsed, TRACKED_TURN_TYPES, turnCounts, turnSources, TURN_TYPES } from '@nw/model';
import type { Entity, TurnRow, TurnType } from '@nw/model';
import { Session } from '../kern/session';
import { Unterblatt, Werkzeugleiste, type LeistenAktion } from '../muster/werkzeugleiste';
import { FigurDaten, fehlerText } from './daten';

/** Je Aktionsart Wort, Budget und Farbe (Marken aus styles.scss). */
const ARTEN: Record<TurnType, { label: string; budget: string; farbe: string }> = {
  action: { label: 'Action', budget: '1 per turn', farbe: 'var(--accent)' },
  bonus: { label: 'Bonus', budget: '1 per turn', farbe: 'var(--magic)' },
  reaction: { label: 'Reaction', budget: '1 per round', farbe: 'var(--blue)' },
  free: { label: 'Free', budget: '1 object · move', farbe: 'var(--good)' },
  trigger: { label: 'Trigger', budget: 'when it happens', farbe: 'var(--gold)' },
};

/**
 * **„Your turn"** (T-247, Element `turn`; REQ-066): alle Aktionen der
 * Figur als **eine Liste**, gegliedert nach Aktionsart — nicht in Spalten
 * (Rückmeldung der Leitung). Schnellfilter nach Aktionsart mit Anzahl,
 * Quellen aufklappbar und einzeln wählbar, „Used" je Action/Bonus/Reaction
 * (gespeichert an der Figur, `Vitals.turnUsed`), „New turn".
 *
 * **Gesperrte Aktionen bleiben sichtbar**, mit 🔒 und dem Grund — was die
 * Hände gerade nicht erlauben (`lockOf` im Modell). Eine gewählte Zeile
 * bekommt die schwebende Werkzeugleiste: benutzen, zum Artikel, Details
 * (am Telefon als Blatt von unten), rückgängig, fertig.
 */
@Component({
  selector: 'nw-zug',
  imports: [RouterLink, Werkzeugleiste, Unterblatt],
  template: `
    <section class="zug" aria-label="Your turn">
      <div class="kopf">
        <h2>Your turn</h2>
        <span class="used">
          <span class="lbl">Used</span>
          @for (t of verfolgt; track t) {
            <button
              type="button"
              class="chip"
              [class.weg]="used().includes(t)"
              [style.--farbe]="arten[t].farbe"
              [disabled]="!darf()"
              [attr.aria-pressed]="used().includes(t)"
              (click)="umschalten(t)"
            >{{ arten[t].label }}</button>
          }
          @if (darf()) {
            <button type="button" (click)="neuerZug()">↺ New turn</button>
          }
        </span>
      </div>
      <div class="filter" role="group" aria-label="Filter by action type">
        <button type="button" class="chip" [class.an]="typ() === 'all'" (click)="typ.set('all')">All <small>{{ zahlen().all }}</small></button>
        @for (t of typen; track t) {
          <button type="button" class="chip" [class.an]="typ() === t" [style.--farbe]="arten[t].farbe" (click)="typ.set(t)">
            <i class="punkt" aria-hidden="true"></i>{{ arten[t].label }} <small>{{ zahlen()[t] }}</small>
          </button>
        }
        <button type="button" class="quellen-knopf" [attr.aria-expanded]="quellenOffen()" (click)="quellenOffen.set(!quellenOffen())">
          Sources · {{ aus().size ? quellen().length - aus().size + ' of ' + quellen().length : 'all ' + quellen().length }} {{ quellenOffen() ? '▴' : '▾' }}
        </button>
      </div>
      @if (quellenOffen()) {
        <div class="quellen">
          @for (q of quellen(); track q.id) {
            <button type="button" class="chip" [attr.aria-pressed]="!aus().has(q.id)" (click)="quelle(q.id)">
              {{ aus().has(q.id) ? '☐' : '☑' }} {{ q.label }} <small>{{ q.count }}</small>
            </button>
          }
          <button type="button" class="link" (click)="aus.set(keineQuelle())">All</button>
          <button type="button" class="link" (click)="aus.set(alleQuellen())">None</button>
          <small class="dim">Each class, feature, item and spell list brings its own source.</small>
        </div>
      }
      @for (g of gruppen(); track g.type) {
        <div class="gruppe" [class.verbraucht]="used().includes(g.type)">
          <h3><i class="quadrat" [style.background]="arten[g.type].farbe"></i>{{ arten[g.type].label }} <small>{{ arten[g.type].budget }}</small></h3>
          @for (a of g.rows; track a.id) {
            <button
              type="button"
              class="zeile"
              [class.gesperrt]="!!a.lock"
              [class.gewaehlt]="gewaehlt()?.id === a.id"
              [style.--farbe]="a.lock ? 'var(--dim)' : arten[a.type].farbe"
              [attr.title]="a.does || a.name"
              (click)="waehle(a)"
            >
              <span class="name">
                <b>{{ a.name }}</b>
                @if (a.does) {
                  <span class="does"> — {{ a.does }}</span>
                }
                @if (a.lock) {
                  <span class="sperre">🔒 {{ a.lock }}</span>
                }
              </span>
              <span class="meta">{{ a.meta }}</span>
              <span class="quelle">{{ a.sourceLabel }}</span>
            </button>
          } @empty {
            <p class="leer">Nothing from the chosen sources.</p>
          }
        </div>
      }
      @if (gewaehlt(); as a) {
        <nw-unterblatt [titel]="a.name" [offen]="detailsOffen()" (schliessen)="detailsOffen.set(false)">
          <dl class="details">
            <div><dt>Type</dt><dd>{{ arten[a.type].label }} · {{ arten[a.type].budget }}</dd></div>
            <div><dt>Source</dt><dd>{{ a.sourceLabel }}</dd></div>
            @if (a.meta) {
              <div><dt>Uses</dt><dd>{{ a.meta }}</dd></div>
            }
            @if (a.does) {
              <div><dt>Does</dt><dd>{{ a.does }}</dd></div>
            }
            @if (a.lock) {
              <div class="sperre"><dt>Blocked</dt><dd>🔒 {{ a.lock }}</dd></div>
            }
            @if (a.article) {
              <div><dt>Article</dt><dd><a [routerLink]="['/artikel', a.article]">Open</a></dd></div>
            }
          </dl>
        </nw-unterblatt>
        <nw-werkzeugleiste
          [titel]="a.name"
          beschriftung="Selected action"
          [hinweis]="a.lock ? 'blocked: ' + a.lock : ''"
          [aktionen]="leistenAktionen()"
          [rueckgaengigMoeglich]="verlauf().length > 0"
          [mitDetails]="true"
          [detailsOffen]="detailsOffen()"
          (aktion)="leiste($event)"
          (rueckgaengig)="rueckgaengig()"
          (details)="detailsOffen.set(!detailsOffen())"
          (fertig)="gewaehlt.set(null); detailsOffen.set(false)"
        />
      }
      @if (fehler()) {
        <p class="fehler" role="alert">{{ fehler() }}</p>
      }
    </section>
  `,
  styleUrl: './zug.scss',
  host: { '[class.mit-leiste]': '!!gewaehlt()' },
})
export class Zug {
  readonly artikel = input.required<Entity>();

  private readonly daten = inject(FigurDaten);
  private readonly session = inject(Session);
  private readonly router = inject(Router);

  protected readonly arten = ARTEN;
  protected readonly typen = TURN_TYPES;
  protected readonly verfolgt = TRACKED_TURN_TYPES;

  private readonly lage = computed(() => this.daten.fuer(this.artikel().id));
  protected readonly darf = computed(() => this.session.darfSchreiben()(this.artikel().id));
  protected readonly typ = signal<TurnType | 'all'>('all');
  protected readonly aus = signal<Set<string>>(new Set());
  protected readonly quellenOffen = signal(false);
  protected readonly gewaehlt = signal<TurnRow | null>(null);
  protected readonly detailsOffen = signal(false);
  protected readonly fehler = signal<string | null>(null);
  /** Die früheren Stände von `turnUsed`, für Rückgängig (höchstens 20). */
  protected readonly verlauf = signal<string[][]>([]);

  protected readonly used = computed<string[]>(() => {
    const u = (this.artikel().components?.['Vitals'] as { turnUsed?: unknown } | undefined)?.turnUsed;
    return Array.isArray(u) ? u.filter((x): x is string => typeof x === 'string') : [];
  });
  private readonly alle = computed(() => this.lage().zug());
  protected readonly quellen = computed(() => turnSources(this.alle()));
  protected readonly zahlen = computed(() => turnCounts(this.alle(), this.aus()));
  protected readonly gruppen = computed(() => {
    const t = this.typ();
    return groupTurn(filterTurn(this.alle(), this.aus(), t)).filter((g) => t === 'all' || g.type === t);
  });

  protected keineQuelle(): Set<string> {
    return new Set();
  }

  protected alleQuellen(): Set<string> {
    return new Set(this.quellen().map((q) => q.id));
  }

  protected quelle(id: string): void {
    const n = new Set(this.aus());
    if (n.has(id)) n.delete(id);
    else n.add(id);
    this.aus.set(n);
  }

  protected waehle(a: TurnRow): void {
    this.gewaehlt.set(this.gewaehlt()?.id === a.id ? null : a);
  }

  protected readonly leistenAktionen = computed<LeistenAktion[]>(() => {
    const a = this.gewaehlt();
    if (!a) return [];
    const out: LeistenAktion[] = [];
    if (this.darf() && TRACKED_TURN_TYPES.includes(a.type)) {
      const schon = this.used().includes(a.type);
      out.push({
        id: 'use',
        icon: '✓',
        label: schon ? `${ARTEN[a.type].label} used` : `Use ${ARTEN[a.type].label.toLowerCase()}`,
        gesperrt: !!a.lock || schon,
        ...(a.lock ? { grund: a.lock } : {}),
      });
    }
    if (a.article) out.push({ id: 'open', icon: '↗', label: 'Open' });
    return out;
  });

  protected leiste(id: string): void {
    const a = this.gewaehlt();
    if (!a) return;
    if (id === 'use' && !a.lock) void this.schreib(toggleUsed(this.used(), a.type));
    if (id === 'open' && a.article) void this.router.navigate(['/artikel', a.article]);
  }

  protected umschalten(t: TurnType): Promise<void> {
    return this.schreib(toggleUsed(this.used(), t));
  }

  protected neuerZug(): Promise<void> {
    return this.schreib([]);
  }

  protected rueckgaengig(): void {
    const v = this.verlauf();
    const letzter = v.at(-1);
    if (!letzter) return;
    this.verlauf.set(v.slice(0, -1));
    void this.schreib(letzter, false);
  }

  private async schreib(neu: string[], merken = true): Promise<void> {
    if (merken) this.verlauf.set([...this.verlauf(), this.used()].slice(-20));
    this.fehler.set(null);
    try {
      await this.daten.vitals(this.artikel().id, () => ({ turnUsed: neu.length ? neu : undefined }));
    } catch (error) {
      this.fehler.set(fehlerText(error));
    }
  }
}

import { Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { Api, type ListenZeile } from '../kern/api';
import { Bestand } from '../kern/bestand';
import { Session } from '../kern/session';
import { Schnell, anlegbareArten, type Angelegt } from './schnell';

/**
 * Einen Artikel wählen — über die Suche der Liste (`/api/list?of=…&q=…&limit=20`, W7).
 *
 * Hier stand ein `select` mit **jedem** Artikel, den die Kante annimmt; bei
 * 24 157 Artikeln eine Auswahl, in der niemand etwas findet, und eine, die
 * den ganzen Bestand im Browser verlangte. Gesucht wird am Server über das,
 * was der Betrachter sehen darf, nach Name, Alias und Nummer.
 *
 * `arten` sind die Arten, die das Ziel sein darf (die `extends`-Kette hoch,
 * wie `relationAccepts`); leer heisst jede.
 *
 * **Was es nicht gibt, legt man hier an** (T-131): unter den Treffern
 * steht „Create “…” as …" je anlegbarer Art; das Popup (`nw-schnell`)
 * legt an, und der neue Artikel steht sofort im Feld.
 */
@Component({
  selector: 'nw-wahl',
  imports: [Schnell],
  template: `
    <div class="wahl">
      <input
        type="search"
        [attr.aria-label]="label()"
        [placeholder]="wert() ? (gewaehlt() ?? wert()) : 'Search an article…'"
        [value]="suche()"
        (input)="tippen($any($event.target).value)"
        (focus)="offen.set(true)"
        (keydown.escape)="offen.set(false)"
      />
      @if (wert()) {
        <span class="jetzt" [attr.title]="wert()">{{ gewaehlt() ?? wert() }}</span>
        <button type="button" class="weg" (click)="waehle(null)" aria-label="Clear">×</button>
      }
      @if (offen() && suche().trim()) {
        <ul class="treffer" role="listbox">
          @for (z of treffer(); track z.id) {
            <li role="option" [attr.aria-selected]="z.id === wert()">
              <button type="button" (click)="waehle(z)">
                {{ z.name }} <span>{{ typLabel(z.type) }}</span>
              </button>
            </li>
          } @empty {
            <li class="leer">{{ sucht() ? 'Searching…' : 'Nothing found.' }}</li>
          }
          <!-- Neu anlegen, ohne die Auswahl zu verlassen (T-131). -->
          @if (!sucht()) {
            @for (a of anlegen(); track a.name) {
              <li role="option" class="neu" [attr.aria-selected]="false">
                <button type="button" (click)="schnell.set({ name: suche().trim(), typ: a.name })">
                  Create “{{ suche().trim() }}” as {{ a.label }}
                </button>
              </li>
            }
          }
        </ul>
      }
      @if (schnell(); as s) {
        <nw-schnell
          [vorschlag]="s.name"
          [ziele]="arten()"
          [vorgabe]="s.typ"
          (angelegt)="eingetragen($event)"
          (zu)="schnell.set(null)"
        />
      }
    </div>
  `,
  styles: `
    .wahl {
      position: relative;
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
      align-items: center;
      flex: 1;
      min-width: 12rem;
    }
    input {
      flex: 1;
      min-width: 10rem;
    }
    .jetzt {
      font-weight: 700;
    }
    .weg {
      min-height: 0;
      padding: 0 0.4rem;
      border: 0;
      background: none;
      color: var(--accent);
      font-weight: 700;
    }
    .treffer {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      z-index: 20;
      margin: 2px 0 0;
      padding: 0.25rem 0;
      list-style: none;
      max-height: 16rem;
      overflow-y: auto;
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 6px;
      box-shadow: 0 6px 18px rgb(0 0 0 / 0.15);
    }
    .treffer button {
      display: flex;
      justify-content: space-between;
      gap: 0.5rem;
      width: 100%;
      min-height: 36px;
      padding: 0.25rem 0.6rem;
      border: 0;
      border-radius: 0;
      background: none;
      text-align: left;
      color: var(--ink);
    }
    .treffer button:hover {
      background: var(--hover);
    }
    .treffer span,
    .leer {
      color: var(--dim);
    }
    .leer {
      padding: 0.35rem 0.6rem;
    }
    .neu {
      border-top: 1px solid var(--line);
    }
    .neu button {
      color: var(--accent);
      font-style: italic;
    }
  `,
})
export class Wahl {
  /** Die gewählte Artikel-Id. */
  readonly wert = input<string>('');
  readonly arten = input<string[]>([]);
  readonly label = input<string>('Article');
  /**
   * Marken aus `target.tags`: was eine davon trägt, steht zuoberst. Nur ein
   * Vorschlag — die Marke ist der heutige Stand des Ziels (T-068).
   */
  readonly bevorzugt = input<string[]>([]);
  /** Diese Id wird nicht angeboten — eine Kante auf sich selbst. */
  readonly ausser = input<string>('');
  /** „Create … as …" anbieten (T-131) — im Popup selbst nicht, sonst stapeln sich Popups. */
  readonly anlegbar = input<boolean>(true);
  readonly wertChange = output<string>();

  private readonly api = inject(Api);
  private readonly bestand = inject(Bestand);
  private readonly session = inject(Session);

  /** Das offene „Create"-Popup: was getippt war und welche Art gemeint ist. */
  protected readonly schnell = signal<{ name: string; typ?: string } | null>(null);

  /**
   * Was sich hier anlegen lässt: bis drei Arten je eine Zeile, mehr unter
   * einer — die Art wählt dann das Popup.
   */
  protected readonly anlegen = computed<{ name: string; label: string }[]>(() => {
    const r = this.bestand.registry();
    if (!r || !this.anlegbar()) return [];
    const arten = anlegbareArten(r, this.arten(), !this.session.isAdmin());
    if (arten.length <= 3) return arten;
    return [{ name: '', label: '…' }];
  });

  protected readonly suche = signal('');
  protected readonly offen = signal(false);
  protected readonly sucht = signal(false);
  protected readonly treffer = signal<ListenZeile[]>([]);
  /** Was zuletzt gewählt wurde — sein Name, bis der Artikel ihn selbst mitbringt. */
  private readonly zuletzt = signal<{ id: string; name: string } | null>(null);

  protected readonly gewaehlt = computed(() => {
    const id = this.wert();
    if (!id) return undefined;
    const z = this.zuletzt();
    return z?.id === id ? z.name : this.bestand.name()(id);
  });

  private lauf = 0;
  private uhr: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.uhr) clearTimeout(this.uhr);
    });
  }

  protected typLabel(t: string): string {
    return this.bestand.registry()?.interfaces[t]?.label ?? t;
  }

  /** Gesucht wird nach einer kurzen Pause, nicht bei jedem Buchstaben. */
  protected tippen(q: string): void {
    this.suche.set(q);
    this.offen.set(true);
    if (this.uhr) clearTimeout(this.uhr);
    if (!q.trim()) {
      this.treffer.set([]);
      return;
    }
    this.sucht.set(true);
    this.uhr = setTimeout(() => void this.hole(q), 200);
  }

  private async hole(q: string): Promise<void> {
    const nr = ++this.lauf;
    try {
      const r = await this.api.list({ of: this.arten(), q, limit: 20 });
      /* Eine ältere Antwort, die nach einer neueren kommt, gilt nicht. */
      if (nr !== this.lauf) return;
      const marken = new Set(this.bevorzugt());
      const passt = (z: ListenZeile) => Number((z.tags ?? []).some((t) => marken.has(t)));
      this.treffer.set(r.rows.filter((z) => z.id !== this.ausser()).sort((a, b) => passt(b) - passt(a)));
    } catch {
      if (nr === this.lauf) this.treffer.set([]);
    } finally {
      if (nr === this.lauf) this.sucht.set(false);
    }
  }

  /** Der neue Artikel steht sofort im Feld (T-131). */
  protected eingetragen(a: Angelegt): void {
    this.waehle({ id: a.id, name: a.name, type: a.type } as ListenZeile);
  }

  protected waehle(z: ListenZeile | null): void {
    this.zuletzt.set(z ? { id: z.id, name: z.name } : null);
    this.wertChange.emit(z?.id ?? '');
    this.suche.set('');
    this.treffer.set([]);
    this.offen.set(false);
  }
}

import { Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { Api, type ListenFrage, type ListenZeile } from '../kern/api';
import { Bestand } from '../kern/bestand';
import { Session } from '../kern/session';
import { SpielerListe } from '../kern/spieler';
import { Schnell, anlegbareArten, type Angelegt } from './schnell';

/** Wo die Vorschläge herkommen: eine Suche am Server je Gruppe. */
export interface Suchgruppe {
  /** Die Arten, die `of=` sucht (die `extends`-Kette hoch). Leer heisst jede. */
  of?: string[];
  /** Genau eine Art mit Feldfilter (`enumWhere`, nur als Vorschlag). */
  type?: string;
  f?: string[];
}

interface Vorschlag {
  wert: string;
  text: string;
  art: string;
  /** Trägt eine der bevorzugten Marken (`target.tags`). */
  passt: boolean;
  /** Was daneben steht — der Name des Spielers an seiner Figur (T-100, E-007). */
  zusatz?: string;
  /**
   * **Ein Spieler steht für seine Figuren** (T-100, E-007): gewählt werden
   * diese Ids, nicht das Konto — im Artikel steht ein Träger (REQ-199).
   */
  ids?: string[];
}

/**
 * Mehrere Werte wählen, als Chips (T-068).
 *
 * Zwei Sorten, ein Bauteil:
 * - **Verweise** (`type: 'array'` + `format: 'link'`): der Wert ist eine
 *   Artikel-Id, angezeigt mit Namen; gesucht wird über `/api/list` (W7) und
 *   nur in den Arten, die das Feld nennt (`target.interfaces`). Ein freies
 *   Wort gibt es nicht — „Revealed to" nahm vorher jedes.
 * - **Namen aus Listen und Arten** (`enumRef`, D50/M6): der Wert ist das
 *   Wort selbst; vorgeschlagen werden die Werte der Listen und die Namen
 *   der Artikel jeder genannten Art. Ein freies Wort bleibt erlaubt
 *   (`frei`) — die Liste schlägt vor, sie hält nicht (D66).
 *
 * `bevorzugt` sind Marken aus `target.tags`: was eine davon trägt, steht
 * zuoberst. Ausgeschlossen wird damit nichts — die Marke ist der heutige
 * Stand des Ziels, die Art die Regel.
 */
@Component({
  selector: 'nw-mehrfach',
  imports: [Schnell],
  template: `
    <div class="mehrfach">
      <ul class="chips" [attr.aria-label]="label()">
        @for (w of werte(); track w) {
          <li class="chip">
            @if (verweise()) {
              <span [attr.title]="w">{{ text(w) }}</span>
            } @else {
              <span>{{ w }}</span>
            }
            <button type="button" (click)="weg(w)" [attr.aria-label]="'Remove ' + text(w)">×</button>
          </li>
        }
      </ul>
      <div class="suche">
        <input
          type="search"
          [attr.aria-label]="label()"
          [placeholder]="frei() ? 'Search or type…' : spieler() ? 'Character, party, faction or player…' : 'Search an article…'"
          [value]="suche()"
          (input)="tippen($any($event.target).value)"
          (focus)="offen.set(true)"
          (keydown.escape)="offen.set(false)"
          (keydown.enter)="eingabe($event)"
        />
        @if (offen() && suche().trim()) {
          <ul class="treffer" role="listbox">
            @for (v of angebot(); track v.wert) {
              <li role="option" [attr.aria-selected]="false">
                <button type="button" (click)="dazu(v)">
                  {{ v.text }}
                  <span>@if (v.zusatz) {<ng-container>{{ v.zusatz }} · </ng-container>}{{ v.art }}</span>
                </button>
              </li>
            } @empty {
              <li class="leer">
                @if (sucht()) {
                  Searching…
                } @else if (frei()) {
                  Nothing found — Enter adds “{{ suche().trim() }}”.
                } @else {
                  Nothing found.
                }
              </li>
            }
            <!-- Neu anlegen und gleich dazunehmen (T-131). -->
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
      </div>
      @if (schnell(); as s) {
        <nw-schnell
          [vorschlag]="s.name"
          [ziele]="zielArten()"
          [vorgabe]="s.typ"
          (angelegt)="eingetragen($event)"
          (zu)="schnell.set(null)"
        />
      }
    </div>
  `,
  styles: `
    .mehrfach {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
      flex: 1;
      min-width: 0;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.3rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .chips:empty {
      display: none;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 0.15rem;
      max-width: 100%;
      padding: 0.05rem 0.1rem 0.05rem 0.55rem;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--hover);
    }
    .chip span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .chip button {
      min-height: 0;
      padding: 0 0.4rem;
      border: 0;
      background: none;
      color: var(--accent);
      font-weight: 700;
    }
    .suche {
      position: relative;
    }
    input {
      width: 100%;
      box-sizing: border-box;
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
  `,
})
export class Mehrfach {
  /** Die gewählten Werte: Ids bei Verweisen, sonst die Wörter. */
  readonly werte = input<string[]>([]);
  /** Ids statt Wörter — angezeigt wird der Name. */
  readonly verweise = input<boolean>(false);
  /** Wo am Server gesucht wird. Ohne Gruppe keine Suche am Server. */
  readonly gruppen = input<Suchgruppe[]>([]);
  /** Feste Werte (Aufzählungszeilen, `Typ.feld`), am Ort gefiltert. */
  readonly feste = input<string[]>([]);
  /** Darf ein Wort stehen, das nichts vorschlägt? Bei Verweisen nie. */
  readonly frei = input<boolean>(false);
  readonly bevorzugt = input<string[]>([]);
  readonly label = input<string>('Values');
  /** Diese Id wird nicht angeboten — ein Verweis auf sich selbst. */
  readonly ausser = input<string>('');
  /** Auch Spieler anbieten (Sichtbarkeit, T-100): ein Spieler wählt seine Figuren. */
  readonly spieler = input<boolean>(false);
  readonly werteChange = output<string[]>();

  private readonly api = inject(Api);
  private readonly bestand = inject(Bestand);
  private readonly spielerListe = inject(SpielerListe);
  private readonly session = inject(Session);

  /** Das offene „Create"-Popup (T-131). */
  protected readonly schnell = signal<{ name: string; typ?: string } | null>(null);
  /** Die Arten, die die Suche fragt — dieselben darf ein neuer Artikel sein. */
  protected readonly zielArten = computed(() => [
    ...new Set(this.gruppen().flatMap((g) => g.of ?? (g.type ? [g.type] : []))),
  ]);
  /** Nur bei Verweisen: ein neues Wort braucht keinen Artikel. Bis drei Arten je eine Zeile. */
  protected readonly anlegen = computed<{ name: string; label: string }[]>(() => {
    const r = this.bestand.registry();
    if (!r || !this.verweise() || !this.gruppen().length) return [];
    const arten = anlegbareArten(r, this.zielArten(), !this.session.isAdmin());
    return arten.length <= 3 ? arten : [{ name: '', label: '…' }];
  });

  protected readonly suche = signal('');
  protected readonly offen = signal(false);
  protected readonly sucht = signal(false);
  private readonly treffer = signal<Vorschlag[]>([]);
  /** Die Namen, die beim Wählen schon dastanden — bis der Artikel sie mitbringt. */
  private readonly namen = signal<Map<string, string>>(new Map());

  /** Feste Werte und Treffer, ohne die schon gewählten; Bevorzugtes zuerst. */
  protected readonly angebot = computed<Vorschlag[]>(() => {
    const q = this.suche().trim().toLowerCase();
    const schon = new Set(this.werte());
    const fest: Vorschlag[] = q
      ? this.feste()
          .filter((w) => w.toLowerCase().includes(q))
          .map((w) => ({ wert: w, text: w, art: 'List', passt: false }))
      : [];
    /* Ein Spieler, dessen Name passt, mit allen Figuren, die noch fehlen. */
    const spieler: Vorschlag[] =
      q && this.spieler()
        ? this.spielerListe
            .liste()
            .filter((p) => p.name.toLowerCase().includes(q))
            .flatMap((p) => {
              const fehlen = p.actors.filter((a) => !schon.has(a.id));
              return fehlen.length
                ? [{ wert: `player:${p.name}`, text: p.name, art: 'Player', passt: true,
                     ids: fehlen.map((a) => a.id), zusatz: fehlen.map((a) => a.name).join(', ') }]
                : [];
            })
        : [];
    const wem = this.spieler() ? this.spielerListe.vonFigur() : new Map<string, string>();
    const raus = new Map<string, Vorschlag>();
    for (const v of [...spieler, ...fest, ...this.treffer()]) {
      if (schon.has(v.wert) || raus.has(v.wert)) continue;
      const zusatz = v.zusatz ?? wem.get(v.wert);
      raus.set(v.wert, zusatz ? { ...v, zusatz } : v);
    }
    return [...raus.values()].sort((a, b) => Number(b.passt) - Number(a.passt));
  });

  private lauf = 0;
  private uhr: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.uhr) clearTimeout(this.uhr);
    });
    /* Ausserhalb des Zeichnens: eine Anfrage setzt Signale (`Api.laufend`). */
    queueMicrotask(() => {
      if (this.spieler()) this.spielerListe.laden();
    });
  }

  protected text(w: string): string {
    if (!this.verweise()) return w;
    const name = this.namen().get(w) ?? this.bestand.name()(w) ?? this.spielerListe.figurName().get(w) ?? w;
    /* Die Figur mit ihrem Spieler: „Rook (Sela)". */
    const wer = this.spieler() ? this.spielerListe.vonFigur().get(w) : undefined;
    return wer ? `${name} (${wer})` : name;
  }

  private typLabel(t: string): string {
    return this.bestand.registry()?.interfaces[t]?.label ?? t;
  }

  /** Gesucht wird nach einer kurzen Pause, nicht bei jedem Buchstaben. */
  protected tippen(q: string): void {
    this.suche.set(q);
    this.offen.set(true);
    if (this.uhr) clearTimeout(this.uhr);
    if (!q.trim() || !this.gruppen().length) {
      this.treffer.set([]);
      this.sucht.set(false);
      return;
    }
    this.sucht.set(true);
    this.uhr = setTimeout(() => void this.hole(q), 200);
  }

  private async hole(q: string): Promise<void> {
    const nr = ++this.lauf;
    try {
      const antworten = await Promise.all(
        this.gruppen().map((g) => {
          const frage: ListenFrage = { q, limit: 20, of: g.of, type: g.type, f: g.f };
          return this.api.list(frage).then((r) => r.rows);
        }),
      );
      /* Eine ältere Antwort, die nach einer neueren kommt, gilt nicht. */
      if (nr !== this.lauf) return;
      const marken = new Set(this.bevorzugt());
      const zeilen = antworten.flat().filter((z) => z.id !== this.ausser());
      this.treffer.set(zeilen.map((z) => this.alsVorschlag(z, marken)));
    } catch {
      if (nr === this.lauf) this.treffer.set([]);
    } finally {
      if (nr === this.lauf) this.sucht.set(false);
    }
  }

  private alsVorschlag(z: ListenZeile, marken: Set<string>): Vorschlag {
    return {
      /* Ein Verweis hält die Id, ein Name aus einer Art das Wort (D50). */
      wert: this.verweise() ? z.id : z.name,
      text: z.name,
      art: this.typLabel(z.type),
      passt: (z.tags ?? []).some((t) => marken.has(t)),
    };
  }

  protected dazu(v: Vorschlag): void {
    if (v.ids) {
      this.setze([...this.werte(), ...v.ids]);
      return;
    }
    if (this.verweise()) this.namen.update((m) => new Map(m).set(v.wert, v.text));
    this.setze([...this.werte(), v.wert]);
  }

  /** Enter nimmt den ersten Vorschlag — oder, wo erlaubt, das Wort selbst. */
  protected eingabe(ev: Event): void {
    ev.preventDefault();
    const q = this.suche().trim();
    if (!q) return;
    const erster = this.angebot()[0];
    const genau = this.angebot().find((v) => v.text.toLowerCase() === q.toLowerCase());
    if (genau) this.dazu(genau);
    else if (this.frei()) this.setze([...this.werte(), q]);
    else if (erster) this.dazu(erster);
  }

  /** Der neue Artikel kommt sofort dazu (T-131). */
  protected eingetragen(a: Angelegt): void {
    this.namen.update((m) => new Map(m).set(a.id, a.name));
    this.setze([...this.werte(), a.id]);
  }

  protected weg(w: string): void {
    this.werteChange.emit(this.werte().filter((x) => x !== w));
  }

  private setze(neu: string[]): void {
    this.werteChange.emit([...new Set(neu)]);
    this.suche.set('');
    this.treffer.set([]);
    this.offen.set(false);
  }
}

import { Component, DestroyRef, computed, contentChildren, effect, inject, input, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { Reiterleiste } from '../bogen/reiterleiste';
import { Api } from '../kern/api';

/** Unter dieser Breite steht ein Kapitel auf einmal da (T-277). */
export const SCHMAL = '(max-width: 719.98px)';

/** Wo ein Kapitel am Desktop steht: breit links, schmal rechts, oder darunter über die volle Breite. */
export type KapitelLage = 'haupt' | 'seite' | 'voll';

/** Ein Kapitel, wie Reiter und Sprungleiste es brauchen. */
export interface KapitelKopf {
  key: string;
  titel: string;
  zahl: number | null;
  zeigen: boolean;
}

/** Die Reiter: nur was dasteht, mit Zahl („Edges · 7“). */
export function kapitelReiter(k: readonly KapitelKopf[]): { id: string; label: string }[] {
  return k.filter((x) => x.zeigen).map((x) => ({ id: x.key, label: x.zahl !== null ? `${x.titel} · ${x.zahl}` : x.titel }));
}

/** Das gewählte Kapitel: das erste Genannte, das dasteht — sonst das erste überhaupt. */
export function kapitelWahl(ids: readonly string[], wuensche: readonly (string | null | undefined)[]): string | null {
  for (const w of wuensche) if (w && ids.includes(w)) return w;
  return ids[0] ?? null;
}

/**
 * **Ein Kapitel einer Seite** (T-277, REQ-069): Titel, Zahl, Aktionen
 * rechts (`[aktionen]` projiziert) und der Inhalt. Am Desktop ein
 * gerahmter Bereich, auf Wunsch zugeklappt (`zu`); am Telefon zeigt
 * `nw-kapitel` nur das gewählte, und der Reiter sagt den Titel.
 *
 * **Was nicht gilt, steht nicht da:** `zeigen = false` nimmt es heraus,
 * auch als Reiter. Zugeklappt wird mit CSS — der Inhalt steht im Baum und
 * wird nicht neu gezeichnet.
 */
@Component({
  selector: 'nw-kapitelteil',
  host: {
    '[attr.id]': "'kapitel-' + key()",
    '[class.aktiv]': 'aktiv()',
    '[class.weg]': '!zeigen()',
    '[class.zu]': '!offen()',
    '[attr.role]': "rahmen.schmal() ? 'tabpanel' : 'region'",
    '[attr.aria-label]': 'titel()',
    /* Ein Bereich der Klappleiste (T-359) — klappbar, wo es am Desktop
       zugeklappt anfängt (Admin, Log); „Expand all" öffnet es dann mit. */
    'data-bereich': '',
    '[attr.hidden]': "zeigen() ? null : ''",
    '[attr.data-klappbar]': "klappbar() ? '' : null",
    '[attr.data-offen]': 'klappbar() ? offen() : null',
    '(klappen)': 'klappen($event)',
  },
  template: `
    <header class="kkopf">
      <h2>
        @if (klappbar()) {
          <button type="button" class="klapp" [attr.aria-expanded]="offen()" (click)="setze(!offen())">
            <span class="pfeil" aria-hidden="true">▸</span>{{ titel() }}
          </button>
        } @else {
          {{ titel() }}
        }
        @if (zahl() !== null) {
          <span class="zahl">{{ zahl() }}</span>
        }
      </h2>
      @if (hinweis()) {
        <span class="khinweis">{{ hinweis() }}</span>
      }
      <span class="kaktionen"><ng-content select="[aktionen]" /></span>
    </header>
    <div class="kinhalt"><ng-content /></div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
      min-width: 0;
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 0.9rem 1rem;
    }
    :host(.weg) {
      display: none !important;
    }
    /* Ein Kapitel, das selbst ein Blatt ist (die Felder), braucht keinen zweiten Rahmen. */
    :host(.kahl) {
      background: none;
      border: 0;
      padding: 0;
    }
    :host(.kahl) .kkopf {
      display: none;
    }
    .kkopf {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0.25rem 0.75rem;
    }
    h2 {
      margin: 0;
      font-family: var(--caps);
      font-size: 1.15rem;
      color: var(--accent);
      display: flex;
      align-items: baseline;
      gap: 0.5rem;
    }
    .klapp {
      all: unset;
      cursor: pointer;
      display: inline-flex;
      align-items: baseline;
      gap: 0.35rem;
    }
    .klapp:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
    .pfeil {
      display: inline-block;
      font-size: 0.8em;
      transition: transform 0.15s;
      transform: rotate(90deg);
    }
    :host(.zu) .pfeil {
      transform: none;
    }
    .zahl,
    .khinweis {
      color: var(--dim);
      font-family: var(--body, inherit);
      font-size: 0.85rem;
    }
    .kaktionen {
      margin-left: auto;
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
    }
    .kaktionen:empty {
      display: none;
    }
    .kinhalt {
      display: flex;
      flex-direction: column;
      gap: 0.9rem;
      min-width: 0;
    }
    :host(.zu) .kinhalt {
      display: none;
    }
    /* Am Telefon: ein Kapitel auf einmal, ohne Rahmen — der Reiter ist die Kopfzeile. */
    @media (max-width: 719.98px) {
      :host {
        background: none;
        border: 0;
        padding: 0;
      }
      :host(:not(.aktiv)) {
        display: none;
      }
      .kkopf h2,
      .khinweis {
        display: none;
      }
      .kkopf:has(.kaktionen:empty) {
        display: none;
      }
      :host(.zu) .kinhalt {
        display: flex;
      }
    }
  `,
})
export class Kapitelteil {
  /** Der Schlüssel in der URL (`?k=edges`) und im Anker. */
  readonly key = input.required<string>();
  readonly titel = input.required<string>();
  /** „Edges · 7“ — ohne Zahl `null`. */
  readonly zahl = input<number | null>(null);
  /** Eine kurze Angabe neben dem Titel, z. B. die geltende Sichtbarkeit. */
  readonly hinweis = input<string>('');
  /** Leere Kapitel erscheinen nicht, auch nicht als Reiter. */
  readonly zeigen = input(true);
  readonly lage = input<KapitelLage>('haupt');
  /** Am Desktop zugeklappt anfangen (Admin, Log). */
  readonly zu = input(false);

  protected readonly rahmen = inject(Kapitel);
  protected readonly klappbar = computed(() => this.zu() && !this.rahmen.schmal());
  readonly offen = signal(true);
  /** Steht der Inhalt gerade da — am Telefon gewählt, am Desktop aufgeklappt? */
  readonly sichtbar = computed(() => (this.rahmen.schmal() ? this.aktiv() : this.offen()));
  readonly aktiv = computed(() => this.rahmen.aktiv() === this.key());

  constructor() {
    let erst = true;
    effect(() => {
      const z = this.zu();
      if (erst) {
        erst = false;
        this.offen.set(!z);
      }
    });
    /* Wie das Konto es verlassen hat (T-359) — sobald die Seite es weiss. */
    effect(() => {
      const g = this.rahmen.gemerkt()?.[this.key()];
      if (typeof g === 'boolean' && untracked(() => this.zu())) this.offen.set(g);
    });
  }

  /** Auf- oder zuklappen wie ein Klick — die Seite merkt es sich. */
  setze(auf: boolean): void {
    if (this.offen() === auf) return;
    this.offen.set(auf);
    if (this.zu()) this.rahmen.merken(this.key(), auf);
  }

  /** Die Klappleiste bittet darum (T-359). */
  protected klappen(e: Event): void {
    const auf = (e as CustomEvent<unknown>).detail;
    if (typeof auf === 'boolean' && this.klappbar()) this.setze(auf);
  }

  /** Aufklappen, wenn die Sprungleiste hierher führt. */
  oeffnen(): void {
    this.setze(true);
  }
}

/**
 * **Die Kapitel einer Seite** (T-277, REQ-069) — ein Muster für Artikel-,
 * Charakter- und Typseite. Jede Seite nennt ihre Kapitel als
 * `nw-kapitelteil` mit Titel und Zahl; was sie zeigen, bleibt ihre Sache.
 *
 * - **Telefon** (< 720 px): die Kapitel als Reiter oben, eins auf einmal;
 *   der gewählte steht in der URL (`?k=…`), damit Zurück und Teilen ihn
 *   behalten. Ein Scroll je Seite.
 * - **Desktop:** jedes Kapitel ein gerahmter Bereich; `lage="haupt"` links
 *   breit, `lage="seite"` rechts schmal daneben, `lage="voll"` darunter
 *   über die volle Breite. Oben eine Sprungleiste statt Reitern.
 *
 * Die Reihenfolge der Reiter ist die, in der die Seite ihre Kapitel nennt.
 */
@Component({
  selector: 'nw-kapitel',
  imports: [Reiterleiste],
  template: `
    @if (reiter().length > 1) {
      <div class="reiter">
        <nw-reiterleiste [reiter]="reiter()" [aktiv]="aktiv()" (waehle)="waehle($event)" />
      </div>
      <nav class="sprung" aria-label="Chapters">
        @for (r of reiter(); track r.id) {
          <button type="button" (click)="springe(r.id)">{{ r.label }}</button>
        }
      </nav>
    }
    <div class="oben" [class.ohneSeite]="!hatSeite()">
      <div class="haupt"><ng-content select="[lage=haupt]" /></div>
      <div class="seite" [hidden]="!hatSeite()"><ng-content select="[lage=seite]" /></div>
    </div>
    <div class="voll"><ng-content select="[lage=voll]" /></div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      min-width: 0;
      /* Nebeneinander nach der eigenen Breite, nicht der des Fensters:
         im Register steht links noch die Typenliste. */
      container-type: inline-size;
    }
    .reiter {
      display: none;
    }
    .sprung {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem 1rem;
      font-size: 0.9rem;
    }
    .sprung button {
      all: unset;
      cursor: pointer;
      color: var(--accent);
      font-family: var(--caps);
    }
    .sprung button:hover,
    .sprung button:focus-visible {
      text-decoration: underline;
    }
    /* Breit links, schmal rechts — die schmale Spalte bricht unter die breite,
       wenn beide nicht mehr nebeneinander passen. */
    .oben {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(16rem, 21rem);
      gap: 1.25rem;
      align-items: start;
    }
    .oben.ohneSeite {
      grid-template-columns: minmax(0, 1fr);
    }
    .haupt,
    .seite,
    .voll {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      min-width: 0;
    }
    .voll:empty,
    .seite[hidden] {
      display: none;
    }
    @container (max-width: 820px) {
      .oben {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    @media (max-width: 719.98px) {
      .reiter {
        display: block;
        position: sticky;
        top: 0;
        z-index: 2;
        background: var(--bg, var(--paper));
      }
      .sprung {
        display: none;
      }
      .oben,
      .haupt,
      .seite,
      .voll {
        gap: 0;
      }
    }
  `,
})
export class Kapitel {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly teile = contentChildren(Kapitelteil, { descendants: true });

  /** Welches Kapitel ohne `?k=` gewählt ist — sonst das erste. */
  readonly vorgabe = input<string | null>(null);
  /**
   * Unter welchem Namen das Konto sich merkt, welche zugeklappten Kapitel
   * offen stehen (T-359, Einstellung `kapitel.<merke>`, z. B. Admin und
   * Log der Artikelseite). Ohne Namen merkt sich die Seite nichts.
   */
  readonly merke = input<string | null>(null);
  /** Was das Konto gemerkt hat, `null`, solange es nicht geladen ist. */
  readonly gemerkt = signal<Record<string, boolean> | null>(null);

  private readonly api = inject(Api, { optional: true });
  private merkTimer: ReturnType<typeof setTimeout> | null = null;

  /** Am Telefon? — ein Signal, weil die Reiter auch in TS zählen (was geladen wird). */
  readonly schmal = signal(false);
  private readonly k = toSignal(this.route.queryParamMap.pipe(map((q) => q.get('k'))), { initialValue: null });
  /** Ein gewählter Reiter, bevor die URL ihn hat (und in Tests ohne Router-Navigation). */
  private readonly gewaehlt = signal<string | null>(null);

  protected readonly sichtbare = computed(() => this.teile().filter((t) => t.zeigen()));
  protected readonly reiter = computed(() =>
    kapitelReiter(this.teile().map((t) => ({ key: t.key(), titel: t.titel(), zahl: t.zahl(), zeigen: t.zeigen() }))),
  );
  protected readonly hatSeite = computed(() => this.sichtbare().some((t) => t.lage() === 'seite'));
  /** Das gewählte Kapitel — aus der URL, sonst das erste, das dasteht. */
  readonly aktiv = computed(() => {
    return kapitelWahl(
      this.sichtbare().map((t) => t.key()),
      [this.gewaehlt(), this.k(), this.vorgabe()],
    );
  });

  constructor() {
    const mq = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(SCHMAL) : null;
    if (mq) {
      this.schmal.set(mq.matches);
      const hoer = (e: MediaQueryListEvent) => this.schmal.set(e.matches);
      mq.addEventListener?.('change', hoer);
      inject(DestroyRef).onDestroy(() => mq.removeEventListener?.('change', hoer));
    }
    /* Den gemerkten Klappstand einmal holen, sobald die Seite ihn nennt. */
    let geholt = false;
    effect(() => {
      const m = this.merke();
      if (!m || geholt || !this.api) return;
      geholt = true;
      void this.api
        .prefs()
        .then((alle) => {
          const p = alle[`kapitel.${m}`];
          const stand: Record<string, boolean> = {};
          if (p && typeof p === 'object') {
            for (const [k, v] of Object.entries(p as Record<string, unknown>)) if (typeof v === 'boolean') stand[k] = v;
          }
          this.gemerkt.set({ ...stand, ...(untracked(() => this.gemerkt()) ?? {}) });
        })
        .catch(() => this.gemerkt.set(untracked(() => this.gemerkt()) ?? {}));
    });
    inject(DestroyRef).onDestroy(() => {
      if (this.merkTimer) clearTimeout(this.merkTimer);
    });
    /* Die URL gilt wieder, sobald sie den gewählten Reiter trägt. */
    effect(() => {
      if (this.k() === this.gewaehlt()) this.gewaehlt.set(null);
    });
  }

  /**
   * Ein zugeklapptes Kapitel wurde auf- oder zugeklappt (T-359). Gespeichert
   * wird einmal nach dem letzten Klappen — „Expand all" klappt mehrere auf
   * einmal, wie bei den Ebenengruppen.
   */
  merken(key: string, auf: boolean): void {
    const m = this.merke();
    if (!m || !this.api) return;
    const stand = { ...(this.gemerkt() ?? {}), [key]: auf };
    this.gemerkt.set(stand);
    if (this.merkTimer) clearTimeout(this.merkTimer);
    this.merkTimer = setTimeout(() => {
      this.merkTimer = null;
      void this.api?.setPref(`kapitel.${m}`, stand).catch(() => {
        /* Nicht gemerkt ist nicht schlimm: das Kapitel steht trotzdem so. */
      });
    }, 300);
  }

  /** Einen Reiter wählen (auch von aussen, z. B. „?tab=read“ an der Ebene). */
  waehle(key: string): void {
    this.gewaehlt.set(key);
    void this.router.navigate([], { queryParams: { k: key }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected springe(key: string): void {
    const t = this.teile().find((x) => x.key() === key);
    t?.oeffnen();
    if (typeof document === 'undefined') return;
    document.getElementById('kapitel-' + key)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }
}

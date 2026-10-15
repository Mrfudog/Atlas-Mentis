import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { Kurzansicht } from '../kern/kurzansicht';
import { Vorschau } from './vorschau';
import { WurfZiel } from '../kern/wurfziel';

/** Breite des Popups am Desktop; darunter wird es ein Blatt von unten. */
const BREITE = 380;
const RAND = 8;
const SCHMAL = '(max-width: 640px)';

/**
 * Das Popup der Kurzansicht (T-093, REQ-248) — einmal im Gerüst, für jeden
 * Auslöser mit `nwQuick`. Gezeichnet wird `nw-vorschau`, also `quick`
 * (CLAUDE.md, „der Ort wählt die Ansicht").
 *
 * Am Desktop steht es am Auslöser, unter ihm oder, wenn unten der Platz
 * fehlt, über ihm. **Am Telefon ist es ein Blatt von unten** mit einem
 * Schleier dahinter: ein schwebender Kasten neben dem Finger wäre zu klein
 * zum Lesen und verdeckte, worauf man gerade getippt hat.
 *
 * Tastatur: Enter auf dem Auslöser öffnet (ein Link oder Knopf klickt
 * dabei), der Fokus geht ins Popup; Esc schliesst und gibt ihn zurück.
 * Ein Klick daneben, Scrollen am Desktop und jeder Seitenwechsel
 * schliessen es auch.
 */
@Component({
  selector: 'nw-kurzpopup',
  imports: [Vorschau],
  /* Ein Würfel in der Kurzansicht würfelt auf ihren Artikel (T-172). */
  providers: [WurfZiel],
  template: `
    @if (kurz.offen(); as o) {
      @if (schmal()) {
        <div class="schleier" aria-hidden="true" (click)="kurz.schliessen(true)"></div>
      }
      <div
        #kasten
        class="kurz"
        [class.blatt]="schmal()"
        role="dialog"
        aria-label="Quick view"
        tabindex="-1"
        [style.top.px]="lage().top"
        [style.bottom.px]="lage().bottom"
        [style.left.px]="lage().left"
        [style.width.px]="lage().width"
        [style.max-height.px]="lage().maxHeight"
        (mouseenter)="kurz.bleiben()"
        (mouseleave)="kurz.verlassen()"
      >
        <!-- Nachgeladen beim ersten Öffnen: die Vorschau bringt das Modell
             mit, und das gehört nicht in den ersten Abruf jeder Seite. -->
        @defer (on immediate) {
          <nw-vorschau [id]="o.id" [rueck]="false" (zu)="kurz.schliessen(true)" />
        } @placeholder {
          <p class="laedt">Loading…</p>
        }
      </div>
    }
  `,
  styles: `
    .kurz {
      position: fixed;
      z-index: 50;
      overflow-y: auto;
      border-radius: 8px;
      box-shadow: 0 6px 24px rgb(0 0 0 / 0.25);
      outline: none;
    }
    .kurz:focus-visible {
      outline: 2px solid var(--gold);
    }
    .blatt {
      right: 0;
      border-radius: 12px 12px 0 0;
    }
    .blatt ::ng-deep .vorschau {
      border-radius: 12px 12px 0 0;
      padding-bottom: calc(1rem + env(safe-area-inset-bottom));
    }
    .laedt {
      margin: 0;
      padding: 1rem;
      background: var(--paper);
      color: var(--dim);
    }
    .schleier {
      position: fixed;
      inset: 0;
      z-index: 49;
      background: rgb(0 0 0 / 0.3);
    }
  `,
})
export class KurzPopup {
  protected readonly kurz = inject(Kurzansicht);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly kasten = viewChild<ElementRef<HTMLElement>>('kasten');

  protected readonly schmal = signal(istSchmal());
  private readonly fenster = signal(fensterMass());

  /** Wo das Popup steht — am Auslöser, oder unten als Blatt. */
  protected readonly lage = computed(() => {
    const o = this.kurz.offen();
    const { w, h } = this.fenster();
    if (this.schmal())
      return { top: null, bottom: 0, left: 0, width: null, maxHeight: Math.round(h * 0.8) };
    const width = Math.min(BREITE, w - 2 * RAND);
    const a = o?.anker ?? { top: h / 2, bottom: h / 2, left: (w - width) / 2 };
    const left = Math.max(RAND, Math.min(a.left, w - width - RAND));
    /* Unten, solange dort mehr als die Hälfte Platz ist; sonst darüber. */
    if (h - a.bottom >= Math.min(320, h / 2)) {
      return { top: a.bottom + 4, bottom: null, left, width, maxHeight: h - a.bottom - 4 - RAND };
    }
    return { top: null, bottom: h - a.top + 4, left, width, maxHeight: a.top - 4 - RAND };
  });

  constructor() {
    const ziel = inject(WurfZiel);
    effect(() => ziel.id.set(this.kurz.offen()?.id ?? null));
    const ab = inject(DestroyRef);
    const router = inject(Router);
    const sub = router.events.subscribe((ev) => {
      if (ev instanceof NavigationStart) this.kurz.schliessen();
    });
    ab.onDestroy(() => sub.unsubscribe());

    if (typeof document !== 'undefined') {
      const klick = (ev: MouseEvent) => this.klick(ev);
      const runter = (ev: PointerEvent) => this.daneben(ev);
      const taste = (ev: KeyboardEvent) => this.taste(ev);
      const scroll = () => {
        if (!this.schmal() && this.kurz.offen()) this.kurz.schliessen();
      };
      const groesse = () => {
        this.schmal.set(istSchmal());
        this.fenster.set(fensterMass());
      };
      /* Im Einfangen: vor dem `routerLink` des Auslösers und vor jedem
         `(click)` der Seite, die ihn zeigt. */
      document.addEventListener('click', klick, true);
      document.addEventListener('pointerdown', runter, true);
      document.addEventListener('keydown', taste);
      window.addEventListener('scroll', scroll, { passive: true });
      window.addEventListener('resize', groesse);
      ab.onDestroy(() => {
        document.removeEventListener('click', klick, true);
        document.removeEventListener('pointerdown', runter, true);
        document.removeEventListener('keydown', taste);
        window.removeEventListener('scroll', scroll);
        window.removeEventListener('resize', groesse);
      });
    }

    /* Mit Klick oder Enter geöffnet: der Fokus geht hinein, damit Tab zu
       „Open article" kommt. Vom Zeiger geöffnet: er bleibt, wo er ist. */
    effect(() => {
      const o = this.kurz.offen();
      const k = this.kasten();
      if (o && !o.hover && k) untracked(() => k.nativeElement.focus({ preventScroll: true }));
    });
  }

  private klick(ev: MouseEvent): void {
    if (
      ev.defaultPrevented ||
      ev.button !== 0 ||
      ev.ctrlKey ||
      ev.metaKey ||
      ev.shiftKey ||
      ev.altKey
    )
      return;
    const el = (ev.target as Element | null)?.closest?.<HTMLElement>('[data-quick]');
    const id = el?.dataset['quick'];
    if (!el || !id) return;
    ev.preventDefault();
    ev.stopPropagation();
    if (this.kasten()?.nativeElement.contains(el)) this.kurz.ersetzen(id);
    else this.kurz.oeffnen(id, el);
  }

  /** Ein Druck daneben schliesst — ausser auf einen anderen Auslöser, der ersetzt. */
  private daneben(ev: PointerEvent): void {
    if (!this.kurz.offen()) return;
    const ziel = ev.target as Element | null;
    if (this.host.nativeElement.contains(ziel) || ziel?.closest?.('[data-quick]')) return;
    this.kurz.schliessen();
  }

  private taste(ev: KeyboardEvent): void {
    if (ev.key === 'Escape' && this.kurz.offen()) {
      ev.preventDefault();
      this.kurz.schliessen(true);
    }
  }
}

function istSchmal(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.(SCHMAL).matches === true;
}
function fensterMass(): { w: number; h: number } {
  return typeof window === 'undefined'
    ? { w: 1024, h: 768 }
    : { w: window.innerWidth, h: window.innerHeight };
}

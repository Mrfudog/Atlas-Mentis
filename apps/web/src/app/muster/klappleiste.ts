import { Component, ElementRef, inject, input, output } from '@angular/core';

/** Wonach eine Seite ihre Bereiche nennt, wenn sie nichts anderes sagt. */
export const BEREICH = '[data-bereich]';

/** Sprungrichtung: zurück oder vor. */
export type Richtung = -1 | 1;

/**
 * Wohin „‹ Previous" und „Next ›" springen (T-220), aus den Oberkanten der
 * Bereiche relativ zum Fensteranfang (in Dokumentreihenfolge). Vor: der
 * erste Bereich, der unter der Linie anfängt. Zurück: der letzte, der
 * darüber anfängt — steht man mitten in einem, ist das sein Anfang. Die
 * Toleranz fängt ab, dass ein eben angesprungener Bereich ein, zwei Pixel
 * neben der Linie landet und sonst noch einmal getroffen würde.
 */
export function sprungZiel(oben: readonly number[], richtung: Richtung, toleranz = 4): number | null {
  if (richtung === 1) {
    const i = oben.findIndex((y) => y > toleranz);
    return i < 0 ? null : i;
  }
  for (let i = oben.length - 1; i >= 0; i--) if (oben[i] < -toleranz) return i;
  return null;
}

/**
 * Der Nachbar des Bereichs, in dem der Fokus steht — die erste Frage beim
 * Springen. Nach der Lage allein liesse sich auf einer kurzen Seite ein
 * Bereich weiter unten nie erreichen: er kommt nicht bis an den oberen
 * Rand, und „Next" träfe ihn immer wieder. `hier` ist der innerste
 * Bereich mit dem Fokus, -1 ohne.
 */
export function nachbarIndex(hier: number, laenge: number, richtung: Richtung): number | null {
  if (hier < 0) return null;
  const j = hier + richtung;
  return j >= 0 && j < laenge ? j : null;
}

/**
 * Was eine Taste an der Leiste tut: Alt+↓/↑ springt, mit Umschalt klappt
 * alles auf bzw. zu. In einem Eingabefeld nichts — dort springt Alt+Pfeil
 * am Mac wortweise, und eine Auswahl öffnet sich damit.
 */
export function tasteAktion(
  e: Pick<KeyboardEvent, 'altKey' | 'shiftKey' | 'ctrlKey' | 'metaKey' | 'key' | 'target'>,
): 'vor' | 'zurueck' | 'auf' | 'zu' | null {
  if (!e.altKey || e.ctrlKey || e.metaKey) return null;
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return null;
  const t = e.target as HTMLElement | null;
  if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName ?? ''))) return null;
  const runter = e.key === 'ArrowDown';
  if (e.shiftKey) return runter ? 'auf' : 'zu';
  return runter ? 'vor' : 'zurueck';
}

/**
 * Die Bereiche unter einer Wurzel, die gerade dastehen: was in einem
 * zugeklappten Bereich liegt, ist nicht erreichbar und wird übersprungen.
 */
export function bereicheIn(wurzel: ParentNode, auswahl = BEREICH): HTMLElement[] {
  return Array.from(wurzel.querySelectorAll<HTMLElement>(auswahl)).filter((el) => {
    for (let p = el.parentElement; p && p !== wurzel; p = p.parentElement) {
      if (p instanceof HTMLDetailsElement && !p.open) return false;
    }
    return !el.hidden;
  });
}

/**
 * Alle klappbaren Bereiche auf- oder zuklappen; gibt zurück, wie viele sich
 * geändert haben. Klappbar ist ein `<details>`: sein `toggle` geht an die
 * Seite wie bei einem Klick, also merkt sie sich den Stand wie sonst auch.
 */
export function alleKlappen(wurzel: ParentNode, auf: boolean, auswahl = BEREICH): number {
  let n = 0;
  for (const el of Array.from(wurzel.querySelectorAll<HTMLElement>(auswahl))) {
    if (el instanceof HTMLDetailsElement && el.open !== auf) {
      el.open = auf;
      n++;
    }
  }
  return n;
}

/**
 * **Die Klappleiste** (T-220, REQ-361): ein Bedienelement für lange Seiten
 * und Auswahlen — „Expand all", „Collapse all", „‹ Previous" und „Next ›"
 * über die Bereiche, Alt+↑/↓ (mit Umschalt: alles zu/auf). Am Telefon
 * steht sie unten fest, wo der Daumen ist.
 *
 * Bereiche nennt die Seite (`data-bereich`, oder eine eigene `auswahl`);
 * die Leiste sucht sie unter ihrem Elternelement, oder unter `wurzel`.
 * **Den Stand merkt sich die Seite:** klappt die Leiste ein `<details>`,
 * geht dasselbe `toggle` wie bei einem Klick, und die Seite speichert, was
 * sie ohnehin speichert (am Konto, wie die Ebenengruppen, T-088). Eine
 * zweite Ablage hier wäre die Stelle, die nach dem ersten Klick von Hand
 * etwas anderes sagt.
 *
 * Was kein `<details>` ist (die Abschnitte der Leseansicht), wird nur
 * angesprungen; `klappbar = false` lässt dann die beiden Klappknöpfe weg,
 * und `(ende)` sagt der Seite, dass vorn oder hinten nichts mehr kommt —
 * die Leseansicht blättert dann ins nächste Kapitel.
 */
@Component({
  selector: 'nw-klappleiste',
  host: {
    role: 'toolbar',
    '[class.fest]': 'fest()',
    '[attr.aria-label]': 'beschriftung()',
    '(document:keydown)': 'taste($event)',
  },
  template: `
    @if (klappbar()) {
      <button type="button" title="Open every section on this page (Alt+Shift+↓)" (click)="alle(true)">Expand all</button>
      <button type="button" title="Close every section on this page (Alt+Shift+↑)" (click)="alle(false)">Collapse all</button>
    }
    <span class="weg">
      <button type="button" title="Go to the previous section (Alt+↑)" aria-label="Previous section" (click)="springe(-1)">
        ‹ <span class="lang">Previous</span>
      </button>
      <button type="button" title="Go to the next section (Alt+↓)" aria-label="Next section" (click)="springe(1)">
        <span class="lang">Next</span> ›
      </button>
    </span>
  `,
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.85rem;
    }
    button {
      min-height: 32px;
    }
    .weg {
      margin-left: auto;
      display: flex;
      gap: 0.4rem;
    }
    /* Am Telefon unten fest, über die volle Breite — die Seite darüber
       lässt mit .mit-klappleiste Platz, damit nichts darunter verschwindet. */
    @media (max-width: 719.98px) {
      :host(.fest) {
        position: fixed;
        left: 0;
        right: 0;
        /* Über der Leiste der Spielenden (\`nw-basisleiste\`), wo es sie gibt. */
        bottom: var(--basis-unten, 0px);
        z-index: 15;
        flex-wrap: nowrap;
        padding: 0.4rem 0.75rem calc(0.4rem + env(safe-area-inset-bottom, 0px));
        background: var(--surface, var(--paper));
        border-top: 1px solid var(--line);
        box-shadow: 0 -2px 6px rgb(0 0 0 / 0.08);
      }
      button {
        min-height: 44px;
        flex: 1 1 auto;
      }
      .weg {
        flex: 1 1 auto;
      }
      .lang {
        display: none;
      }
    }
  `,
})
export class Klappleiste {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Wo die Bereiche stehen — sonst unter dem Elternelement der Leiste. */
  readonly wurzel = input<HTMLElement | null>(null);
  /** Welche Elemente Bereiche sind. */
  readonly auswahl = input(BEREICH);
  /** Ohne `<details>` darunter gibt es nichts zu klappen, nur zu springen. */
  readonly klappbar = input(true);
  readonly beschriftung = input('Sections');
  /** Am Telefon unten fest — nicht in einem Popup, das selbst schon schwebt. */
  readonly fest = input(true);
  /** Vorn (-1) oder hinten (1) kommt kein Bereich mehr. */
  readonly ende = output<Richtung>();

  /** Der zuletzt angesprungene Bereich — dort steht man, wenn der Fokus auf der Leiste ist. */
  private zuletzt: Element | null = null;

  private wurzelEl(): HTMLElement | null {
    return this.wurzel() ?? this.host.nativeElement.parentElement;
  }

  alle(auf: boolean): void {
    const w = this.wurzelEl();
    if (w) alleKlappen(w, auf, this.auswahl());
  }

  springe(richtung: Richtung): void {
    const w = this.wurzelEl();
    if (!w) return;
    const b = bereicheIn(w, this.auswahl()).filter((el) => !this.host.nativeElement.contains(el));
    /* Wo man steht: im Bereich mit dem Fokus — oder, steht der Fokus auf
       der Leiste selbst (ein Klick auf „Next"), im zuletzt angesprungenen. */
    const fokus = document.activeElement;
    const ort = fokus && this.host.nativeElement.contains(fokus) ? this.zuletzt : fokus;
    let hier = -1;
    b.forEach((el, n) => {
      if (ort && el.contains(ort)) hier = n;
    });
    /* Ohne Fokus in einem Bereich zählt die Lage — gemessen bis dorthin, wo
       ein Bereich nach dem Sprung steht, mit seinem Abstand oben
       (`scroll-margin-top`), sonst träfe „Next" den, auf dem man steht. */
    const i =
      hier >= 0
        ? nachbarIndex(hier, b.length, richtung)
        : sprungZiel(
            b.map((el) => el.getBoundingClientRect().top - (parseFloat(getComputedStyle(el).scrollMarginTop) || 0)),
            richtung,
          );
    if (i === null) {
      this.ende.emit(richtung);
      return;
    }
    const ziel = b[i];
    /* Angesprungen heisst aufgeklappt — wie die Sprungleiste der Kapitel. */
    if (ziel instanceof HTMLDetailsElement && this.klappbar()) ziel.open = true;
    /* Ohne Gleiten: ein zweiter Tastendruck misst sonst mitten im Flug. */
    ziel.scrollIntoView?.({ block: 'start' });
    /* Der Fokus geht mit, damit Tab im angesprungenen Bereich weitermacht. */
    const summary = ziel instanceof HTMLDetailsElement ? ziel.querySelector<HTMLElement>(':scope > summary') : null;
    const hin = summary ?? ziel;
    if (!summary && !hin.hasAttribute('tabindex')) hin.setAttribute('tabindex', '-1');
    hin.focus?.({ preventScroll: true });
    this.zuletzt = ziel;
  }

  protected taste(e: KeyboardEvent): void {
    /* Nur die Leiste, die gerade dasteht — ein verborgener Reiter hat seine eigene. */
    if (!this.host.nativeElement.getClientRects?.().length) return;
    const a = tasteAktion(e);
    if (!a) return;
    e.preventDefault();
    if (a === 'auf' || a === 'zu') {
      if (this.klappbar()) this.alle(a === 'auf');
    } else this.springe(a === 'vor' ? 1 : -1);
  }
}

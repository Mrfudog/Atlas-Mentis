/**
 * **Die Kurzansicht als Popup** (T-093, REQ-248): wo ein Artikel genannt
 * wird — ein Verweis im Text, eine Kante, eine Ebene im Filter oder in der
 * Kampagnenliste, der Info-Knopf einer Listenzeile —, öffnet ein Klick die
 * Ansicht `quick` dieses Artikels mit einem Link zur Artikelseite.
 *
 * **Der Ort wählt die Ansicht** (CLAUDE.md): ein Popup ist eine Karte, also
 * `quick` — dieselbe Anordnung wie die Vorschau im Kompendium und die Karte
 * auf dem Board. Einen Wähler gibt es nicht, und gesiebt hat der Server.
 *
 * Hier stehen der Zustand (welcher Artikel, woran) und die Direktive, die
 * einen Auslöser markiert; gezeichnet wird von `nw-kurzpopup`, einmal im
 * Gerüst. Gefangen wird der Klick dort am Dokument, **vor** dem
 * `routerLink` des Auslösers — so bleibt ein Verweis ein echter Link
 * (Strg, ⌘, Shift, mittlere Taste: neuer Reiter wie überall), und ein
 * schlichter Klick verlässt die Seite nicht.
 */

import { Directive, ElementRef, Injectable, Input, inject, signal } from '@angular/core';

/** So lange ruht der Zeiger auf einem Auslöser, bevor die Kurzansicht aufgeht. */
export const HOVER_AUF_MS = 450;
/** So lange darf der Zeiger zwischen Auslöser und Popup unterwegs sein. */
export const HOVER_ZU_MS = 250;

export interface OffeneKurzansicht {
  id: string;
  /** Woran das Popup steht; `null` heisst: wo es schon stand. */
  anker: { top: number; bottom: number; left: number } | null;
  /** Vom Zeiger geöffnet — geht wieder zu, wenn er geht. */
  hover: boolean;
  /** Wohin der Fokus nach Esc zurückkehrt. */
  ausloeser: HTMLElement | null;
}

@Injectable({ providedIn: 'root' })
export class Kurzansicht {
  private readonly _offen = signal<OffeneKurzansicht | null>(null);
  readonly offen = this._offen.asReadonly();

  private aufUhr: ReturnType<typeof setTimeout> | undefined;
  private zuUhr: ReturnType<typeof setTimeout> | undefined;

  /**
   * Die Kurzansicht eines Artikels zeigen. Ein zweiter Klick auf denselben
   * Auslöser schliesst sie; einer auf einen anderen ersetzt sie.
   */
  oeffnen(id: string, ausloeser: HTMLElement | null, hover = false): void {
    clearTimeout(this.aufUhr);
    clearTimeout(this.zuUhr);
    const jetzt = this._offen();
    if (!hover && jetzt && !jetzt.hover && jetzt.id === id && jetzt.ausloeser === ausloeser) {
      this.schliessen(true);
      return;
    }
    if (hover && jetzt && !jetzt.hover) return;
    this._offen.set({ id, anker: ausloeser ? ankerVon(ausloeser) : null, hover, ausloeser });
  }

  /**
   * Ein Verweis **in** der Kurzansicht: sie zeigt den neuen Artikel an
   * derselben Stelle — sie wanderte sonst an den Link in ihr selbst.
   */
  ersetzen(id: string): void {
    const jetzt = this._offen();
    if (!jetzt) return;
    this._offen.set({ ...jetzt, id, anker: jetzt.anker, hover: false });
  }

  /** Geht zu; `fokusZurueck` stellt den Fokus wieder auf den Auslöser (Esc, ×). */
  schliessen(fokusZurueck = false): void {
    clearTimeout(this.aufUhr);
    clearTimeout(this.zuUhr);
    const jetzt = this._offen();
    this._offen.set(null);
    if (fokusZurueck && jetzt?.ausloeser?.isConnected) jetzt.ausloeser.focus();
  }

  /** Der Zeiger ruht auf einem Auslöser: nach einer kurzen Weile aufgehen. */
  vormerken(id: string, ausloeser: HTMLElement): void {
    clearTimeout(this.aufUhr);
    clearTimeout(this.zuUhr);
    this.aufUhr = setTimeout(() => this.oeffnen(id, ausloeser, true), HOVER_AUF_MS);
  }

  /** Der Zeiger geht: was er geöffnet hat, geht nach einer Weile zu. */
  verlassen(): void {
    clearTimeout(this.aufUhr);
    if (!this._offen()?.hover) return;
    clearTimeout(this.zuUhr);
    this.zuUhr = setTimeout(() => {
      if (this._offen()?.hover) this._offen.set(null);
    }, HOVER_ZU_MS);
  }

  /** Der Zeiger ist im Popup angekommen: offen bleiben. */
  bleiben(): void {
    clearTimeout(this.zuUhr);
  }
}

function ankerVon(el: HTMLElement): OffeneKurzansicht['anker'] {
  const r = el.getBoundingClientRect();
  return { top: r.top, bottom: r.bottom, left: r.left };
}

/** Am Desktop mit Maus; am Telefon gibt es kein Darüberfahren. */
function kannHover(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(hover: hover) and (pointer: fine)').matches === true
  );
}

/**
 * Markiert einen Auslöser: `<a [routerLink]="…" [nwQuick]="id">` oder
 * `<button [nwQuick]="id">`. Den Klick fängt `nw-kurzpopup` am Dokument
 * (über `data-quick`); hier steht nur das Darüberfahren.
 *
 * `@Input` statt `input()`: die Prüfumgebung übersetzt JIT und kennt
 * Signal-Eingaben nicht (siehe `text.test.ts`), und diese Direktive steht
 * in fremden Vorlagen, die dort mitgeprüft werden.
 */
@Directive({
  selector: '[nwQuick]',
  host: {
    '[attr.data-quick]': 'id || null',
    '[attr.aria-haspopup]': 'id ? "dialog" : null',
    '(mouseenter)': 'rein()',
    '(mouseleave)': 'raus()',
  },
})
export class KurzLink {
  @Input({ alias: 'nwQuick' }) id: string | null | undefined = '';

  private readonly kurz = inject(Kurzansicht);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  protected rein(): void {
    if (this.id && kannHover()) this.kurz.vormerken(this.id, this.el.nativeElement);
  }
  protected raus(): void {
    this.kurz.verlassen();
  }
}

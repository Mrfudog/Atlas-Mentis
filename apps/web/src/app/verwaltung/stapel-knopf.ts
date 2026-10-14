import type { ElementRef } from '@angular/core';
import { Component, HostListener, computed, effect, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Stapel } from '../kern/stapel';
import { KampagnenEbenenListe } from './ebenen';

/**
 * **Kampagne und Ebenen in der Kopfleiste** (T-143, Wunsch der Leitung
 * 14.10.): die laufende Kampagne steht immer da, mit der Zahl der Ebenen
 * im Spiel, unter der Marke — am Telefon gekürzt. Ein Klick öffnet das Popup:
 *
 * - die Kampagne, für die Verwaltung mit Wechsel (sie gilt für alle,
 *   darum nur dort; `PUT /api/campaigns/current`);
 * - die Ebenen wie auf der Kampagnenseite (`nw-kampagnen-ebenen`, kompakt):
 *   auf- und abschalten, Gruppen, Teilaufschaltung nach Bereich und Art,
 *   und **Vergleich** — auch einer ganzen Gruppe wie „2024 rules";
 * - der Weg zur Kampagnenseite (der Kampagnenmanager, T-141, folgt).
 *
 * Wer nicht leitet, sieht den Namen und dass die Leitung die Ebenen wählt;
 * welche es sind, sagt die Ebenenliste nur der Leitung (`rechtAn`).
 *
 * **Nicht im Vollbild:** zeigt eine Karte oder ein Board sich über den
 * ganzen Schirm (`fullscreenElement`), bleibt der Knopf weg.
 */
@Component({
  selector: 'nw-stapel',
  imports: [RouterLink, KampagnenEbenenListe],
  template: `
    @if (stapel.laufend(); as k) {
      @if (!vollbild()) {
        <button
          type="button"
          class="knopf"
          aria-haspopup="dialog"
          [attr.aria-expanded]="offen()"
          [title]="'Campaign ' + k.name + ' — ' + zahlText() + '. Click to change.'"
          (click)="umschalten()"
        >
          <span class="zeichen" aria-hidden="true">◫</span>
          <span class="kname">{{ k.name }}</span>
          <span class="kzahl">{{ zahlText() }}</span>
        </button>
      }
      @if (offen()) {
        <div class="schleier" (click)="zu()" aria-hidden="true"></div>
        <section class="popup" role="dialog" aria-modal="true" aria-labelledby="stapel-titel" tabindex="-1" #popup>
          <header class="kopf">
            <h2 id="stapel-titel">Campaign &amp; layers</h2>
            <button type="button" class="zu" aria-label="Close" (click)="zu()">×</button>
          </header>
          @if (stapel.verwaltung() && stapel.kampagnen().length > 1) {
            <label class="wahl">
              <span>Running campaign</span>
              <select [value]="k.id" [disabled]="wechselt()" (change)="wechseln($any($event.target).value)">
                @for (c of stapel.kampagnen(); track c.id) {
                  <option [value]="c.id" [selected]="c.id === k.id">{{ c.name }}</option>
                }
              </select>
            </label>
            <p class="fuss">The running campaign is the same for everyone on this installation.</p>
          } @else {
            <p class="wer">
              <b>{{ k.name }}</b>
              @if (k.role) {
                <span class="rolle">{{ k.role }}</span>
              }
            </p>
          }
          @if (fehler(); as f) {
            <p class="fehler" role="alert">{{ f }}</p>
          }
          @if (k.may) {
            <nw-kampagnen-ebenen [kampagne]="k.id" [kompakt]="true" (geschaltet)="stapel.geaendert()" />
          } @else {
            <p class="fuss">{{ zahlText() }} in play. The GM chooses which.</p>
          }
          @if (k.may) {
            <p class="weiter"><a routerLink="/campaign" (click)="zu()">Members and more on the campaign page</a></p>
          }
        </section>
      }
    }
  `,
  styles: `
    :host {
      display: contents;
    }
    .knopf {
      display: inline-flex;
      align-items: baseline;
      gap: 0.35rem;
      max-width: calc(100% + 0.35rem);
      min-width: 0;
      min-height: 0;
      margin: 0 0 0 -0.35rem;
      padding: 0.05rem 0.35rem;
      border: 1px solid transparent;
      border-radius: 6px;
      background: none;
      color: var(--ink);
      font-size: 0.8rem;
      line-height: 1.3;
      cursor: pointer;
    }
    .knopf:hover,
    .knopf[aria-expanded='true'] {
      border-color: var(--accent);
      color: var(--accent);
    }
    .zeichen {
      color: var(--accent);
    }
    .kname {
      min-width: 0;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      font-weight: 700;
    }
    .kzahl {
      flex: none;
      color: var(--dim);
      font-size: 0.85em;
    }
    .schleier {
      position: fixed;
      inset: 0;
      z-index: 40;
      background: rgb(0 0 0 / 0.15);
    }
    .popup {
      position: fixed;
      z-index: 41;
      top: 4rem;
      right: 1.5rem;
      width: min(38rem, calc(100vw - 2rem));
      max-height: calc(100dvh - 5rem);
      overflow-y: auto;
      overscroll-behavior: contain;
      padding: 0.9rem 1rem 1rem;
      border: 1px solid var(--line);
      border-top: 3px solid var(--accent);
      border-radius: 8px;
      background: var(--surface);
      box-shadow: 0 6px 24px rgb(0 0 0 / 0.2);
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .popup:focus {
      outline: none;
    }
    .kopf {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    h2 {
      margin: 0;
      font-family: var(--caps);
      font-size: 1.2rem;
      color: var(--accent);
    }
    .zu {
      min-width: 40px;
      min-height: 40px;
      border: 0;
      background: none;
      font-size: 1.4rem;
      color: var(--dim);
      cursor: pointer;
    }
    .wahl {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
    }
    .wahl select {
      flex: 1 1 12rem;
      min-height: 40px;
    }
    .wer {
      margin: 0;
    }
    .rolle {
      margin-left: 0.4rem;
      padding: 0 0.4rem;
      border: 1px solid var(--accent);
      border-radius: 10px;
      color: var(--accent);
      font-size: 0.75rem;
    }
    .fuss {
      margin: 0;
      font-size: 0.82rem;
      color: var(--dim);
    }
    .fehler {
      margin: 0;
      color: var(--warn);
    }
    .weiter {
      margin: 0.25rem 0 0;
    }
    /* Am Telefon: kürzer; das Popup als Blatt über die Breite. */
    @media (max-width: 640px) {
      .zeichen {
        display: none;
      }
      .popup {
        top: 0.5rem;
        right: 0.5rem;
        left: 0.5rem;
        width: auto;
        max-height: calc(100dvh - 1rem);
      }
    }
  `,
})
export class StapelKnopf {
  protected readonly stapel = inject(Stapel);
  protected readonly offen = signal(false);
  protected readonly wechselt = signal(false);
  protected readonly fehler = signal<string | null>(null);
  protected readonly vollbild = signal(typeof document !== 'undefined' && !!document.fullscreenElement);
  private readonly popup = viewChild<ElementRef<HTMLElement>>('popup');
  private vorher: HTMLElement | null = null;

  protected readonly zahlText = computed(() => {
    const n = this.stapel.laufend()?.layers ?? 0;
    return `${n} ${n === 1 ? 'layer' : 'layers'}`;
  });

  constructor() {
    /* Der Fokus geht ins Popup und beim Schliessen zurück zum Knopf. */
    effect(() => this.popup()?.nativeElement.focus());
  }

  @HostListener('document:fullscreenchange')
  protected vollbildGeaendert(): void {
    this.vollbild.set(!!document.fullscreenElement);
    if (this.vollbild()) this.zu();
  }

  @HostListener('document:keydown.escape')
  protected escape(): void {
    if (this.offen()) this.zu();
  }

  protected umschalten(): void {
    if (this.offen()) {
      this.zu();
      return;
    }
    this.vorher = document.activeElement as HTMLElement | null;
    this.fehler.set(null);
    this.offen.set(true);
  }

  protected zu(): void {
    if (!this.offen()) return;
    this.offen.set(false);
    this.vorher?.focus();
    this.vorher = null;
  }

  protected async wechseln(id: string): Promise<void> {
    if (id === this.stapel.laufend()?.id) return;
    this.wechselt.set(true);
    try {
      await this.stapel.wechseln(id);
      this.fehler.set(null);
    } catch (error) {
      this.fehler.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.wechselt.set(false);
    }
  }
}

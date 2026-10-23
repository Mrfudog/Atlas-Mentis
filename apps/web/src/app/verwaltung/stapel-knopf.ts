import type { ElementRef } from '@angular/core';
import { Component, HostListener, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import type { SchreibOption, Schreibstand } from '../kern/api';
import { Stapel } from '../kern/stapel';
import { KampagnenEbenenListe } from './ebenen';
import { SichtKnopf } from './sicht-knopf';

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
 * **Die Schreibebene** (T-161) steht daneben („Writes to", am Telefon ✎)
 * und wird im Popup gewählt: unter den Ebenen, in denen dieses Konto
 * schreibt und die hier im Spiel sind, je mit Grund; die übrigen stehen
 * ausgegraut mit dem Grund, warum nicht. Gespeichert am Server je Konto
 * und Kampagne, geprüft dort (`PUT /api/layers/write`).
 *
 * Wer nicht leitet, sieht den Namen und dass die Leitung die Ebenen wählt;
 * welche es sind, sagt die Ebenenliste nur der Leitung (`rechtAn`).
 *
 * **Nicht im Vollbild:** zeigt eine Karte oder ein Board sich über den
 * ganzen Schirm (`fullscreenElement`), bleibt der Knopf weg.
 */
@Component({
  selector: 'nw-stapel',
  imports: [RouterLink, NgTemplateOutlet, KampagnenEbenenListe, SichtKnopf],
  template: `
    @if (stapel.laufend(); as k) {
      @if (!vollbild()) {
        <button
          type="button"
          class="knopf"
          aria-haspopup="dialog"
          [attr.aria-expanded]="offen()"
          [title]="'Campaign ' + k.name + ' — ' + zahlText() + (stapel.schreib() ? ' — writes to ' + schreibName() : '') + '. Click to change.'"
          (click)="umschalten()"
        >
          <span class="zeichen" aria-hidden="true">◫</span>
          <span class="kname">{{ k.name }}</span>
          <span class="kzahl">{{ zahlText() }}</span>
          @if (stapel.schreib(); as w) {
            <span class="schreib" [class.weg]="!!w.dropped" [class.ausserhalb]="schreibAusserhalb()">
              <span class="lang">Writes to</span><span class="kurz" aria-hidden="true">✎</span>
              <span class="sname">{{ schreibName() }}</span>
              @if (schreibAusserhalb()) {
                <span class="marke" title="This layer is not turned on in this campaign: what you create there does not show here.">not in play</span>
              }
            </span>
          }
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
          <!-- „View as" am Telefon: hier statt in der Leiste (T-269). -->
          <nw-sicht [liste]="true" />
          @if (fehler(); as f) {
            <p class="fehler" role="alert">{{ f }}</p>
          }
          @if (stapel.schreib(); as w) {
            <fieldset class="schreibwahl">
              <legend>Writes to</legend>
              @if (w.dropped; as d) {
                <p class="fehler" role="status">
                  “{{ d.name }}” is not available in this campaign right now — new articles go to the default.
                </p>
              }
              <label class="option">
                <input type="radio" name="schreib" [checked]="!w.chosen" [disabled]="waehlt()" (change)="schreibWaehlen(null)" />
                <span>
                  Default: <b>{{ w.default?.name ?? (w.none ? 'no layer' : '—') }}</b>
                  <small>{{ w.none ? 'The administration creates outside any layer unless it picks one.' : vorgabeText() }}</small>
                </span>
              </label>
              <!-- Die Vorgabe steht oben schon als eigene Zeile. -->
              @for (o of imSpiel(); track o.id) {
                @if (o.id !== w.default?.id) {
                  <ng-container *ngTemplateOutlet="schreibOption; context: { $implicit: o, w: w }" />
                }
              }
              <!-- Ausserhalb des Stapels (T-418): wählbar, zugeklappt — was dort entsteht, steht hier erst, wenn die Kampagne die Ebene aufschaltet. -->
              @if (draussen().length) {
                <details class="draussen" [open]="draussenOffen(w)">
                  <summary>Layers not in this campaign ({{ draussen().length }})</summary>
                  <p class="fuss">You write in these, but this campaign does not turn them on: what you create there does not show here until it does.</p>
                  @for (o of draussen(); track o.id) {
                    <ng-container *ngTemplateOutlet="schreibOption; context: { $implicit: o, w: w }" />
                  }
                </details>
              }
              <ng-template #schreibOption let-o let-w="w">
                <label class="option" [class.aus]="!o.selectable" [class.ausserhalb]="o.selectable && o.inPlay === false" [title]="o.why ?? ''">
                  <input
                    type="radio"
                    name="schreib"
                    [checked]="w.chosen && w.layer?.id === o.id"
                    [disabled]="!o.selectable || waehlt()"
                    (change)="schreibWaehlen(o.id)"
                  />
                  <span>
                    {{ o.name }}@if (o.selectable && o.inPlay === false) { <span class="marke">not in play</span> }
                    <small>{{ grund(o) }}@if (o.why && !(o.selectable && o.inPlay === false)) { — {{ o.why }} }</small>
                  </span>
                </label>
              </ng-template>
              <p class="fuss">Saved for your account in this campaign, on every device. Create dialogs can still pick another layer.</p>
            </fieldset>
          }
          @if ((k.compare ?? 0) > 0) {
            <!-- Vergleich in Listen (T-213): nur, wer Vergleichsebenen sieht. -->
            <label class="option vergleich">
              <input type="checkbox" [checked]="stapel.vergleich()" (change)="stapel.vergleichSetzen($any($event.target).checked)" />
              <span>
                Show comparison articles in lists
                <small>Compendium, areas and search also list what only a comparison layer brings, marked “not in play”.</small>
              </span>
            </label>
          }
          @if (k.may) {
            <!-- Erst beim Öffnen geladen (T-188): die Liste ist gross, und die Kopfleiste steht im Grundpaket mit seinem Budget. -->
            @defer {
              <nw-kampagnen-ebenen [kampagne]="k.id" [kompakt]="true" (geschaltet)="stapel.geaendert()" />
            } @placeholder {
              <p class="fuss">Loading the layers…</p>
            }
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
      flex-wrap: wrap;
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
    /* Eine eigene Zeile unter der Kampagne — sonst teilen sich beide Namen die schmale Spalte. */
    .schreib {
      display: flex;
      flex: 1 0 100%;
      gap: 0.3rem;
      min-width: 0;
      color: var(--dim);
      font-size: 0.85em;
      white-space: nowrap;
    }
    .schreib.weg .sname {
      color: var(--warn);
    }
    .sname {
      min-width: 0;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      color: var(--ink);
    }
    .kurz {
      display: none;
    }
    .schreibwahl {
      margin: 0;
      padding: 0.4rem 0.6rem 0.5rem;
      border: 1px solid var(--line);
      border-radius: 6px;
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
    }
    .schreibwahl legend {
      padding: 0 0.3rem;
      font-weight: 700;
      color: var(--heading);
    }
    .option {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      min-height: 40px;
      cursor: pointer;
    }
    .option input {
      margin-top: 0.25rem;
    }
    .vergleich {
      margin: 0.6rem 0;
    }
    .option small {
      display: block;
      color: var(--dim);
    }
    .option.aus {
      opacity: 0.6;
      cursor: not-allowed;
    }
    /* Ausserhalb des Stapels (T-418): wählbar, aber gekennzeichnet. */
    .marke {
      margin-left: 0.3rem;
      padding: 0 0.3rem;
      border: 1px solid var(--warn);
      border-radius: 0.2rem;
      color: var(--warn);
      font-size: 0.75em;
      white-space: nowrap;
    }
    .draussen summary {
      cursor: pointer;
      margin: 0.4rem 0;
    }
    .schreib.ausserhalb .sname {
      color: var(--warn);
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
      .zeichen,
      .lang {
        display: none;
      }
      .kurz {
        display: inline;
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

  protected readonly waehlt = signal(false);

  /** Die Ebenen zur Wahl, die die Kampagne aufschaltet — und die übrigen, in denen ich schreibe (T-418). */
  protected readonly imSpiel = computed(() => (this.stapel.schreib()?.options ?? []).filter((o) => o.inPlay !== false || !o.selectable));
  protected readonly draussen = computed(() => (this.stapel.schreib()?.options ?? []).filter((o) => o.inPlay === false && o.selectable));
  /** Offen, wenn die gewählte Ebene dort liegt — sonst sähe man nicht, was gilt. */
  protected draussenOffen(w: Schreibstand): boolean {
    return !!w.chosen && this.draussen().some((o) => o.id === w.layer?.id);
  }

  /** Was in der Kopfleiste hinter „Writes to" steht. */
  protected readonly schreibName = computed(() => {
    const w = this.stapel.schreib();
    return w?.layer?.name ?? (w?.none ? 'no layer' : '—');
  });

  /** Die Schreibebene liegt ausserhalb des Stapels (T-418) — die Kopfleiste sagt es. */
  protected readonly schreibAusserhalb = computed(() => {
    const w = this.stapel.schreib();
    return !!w?.layer && w.options.some((o) => o.id === w.layer?.id && o.inPlay === false);
  });

  protected readonly vorgabeText = computed(() => {
    const d = this.stapel.schreib()?.default?.id;
    const o = this.stapel.schreib()?.options.find((x) => x.id === d);
    return o ? this.grund(o) : 'The campaign layer — you create as a player of this campaign.';
  });

  protected grund(o: SchreibOption): string {
    switch (o.reason) {
      case 'player':
        return 'Your player layer';
      case 'playerOf':
        return `Player layer of ${o.player ?? 'someone at the table'}`;
      case 'owner':
        return 'Your own layer';
      case 'granted':
        return 'Shared with you';
      case 'gm':
      case 'co-gm':
        return `Campaign layer — you are ${o.reason === 'gm' ? 'GM' : 'co-GM'}`;
      case 'admin':
        return 'Campaign layer — as administration';
    }
  }

  protected async schreibWaehlen(id: string | null): Promise<void> {
    this.waehlt.set(true);
    try {
      await this.stapel.schreibWaehlen(id);
      this.fehler.set(null);
    } catch (error) {
      this.fehler.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.waehlt.set(false);
    }
  }

  constructor() {
    /* Der Fokus geht ins Popup und beim Schliessen zurück zum Knopf. */
    effect(() => this.popup()?.nativeElement.focus());
    /* „Change layers" an einer Liste (T-186) öffnet dasselbe Popup. */
    let gesehen = this.stapel.gerufen();
    effect(() => {
      const n = this.stapel.gerufen();
      if (n === gesehen) return;
      gesehen = n;
      untracked(() => {
        if (!this.offen()) this.umschalten();
      });
    });
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

import { Component, computed, inject, input, signal } from '@angular/core';
import { travelCounters, travelLine, travelRulesOf, travelStep, type Entity } from '@nw/model';
import { Api, ApiError } from '../kern/api';
import { Bestand } from '../kern/bestand';
import { Session } from '../kern/session';

/**
 * **Die Reise einer Gruppe** (T-350, REQ-170; aus dem Prototyp, Punktreise):
 * die Zeile, nach der am Tisch gefragt wird — Tag, Wache, wann Rationen
 * und Licht fällig sind —, und die zwei Schritte „eine Wache vergeht" und
 * „ein Knoten weiter". Gerechnet in `travelStep` (Modell), geschrieben in
 * die Karte `Party` derselben Gruppe. Was fällig wird, sagt die Zeile
 * darunter; vom Inventar nimmt sie nichts — das entscheidet der Tisch.
 */
@Component({
  selector: 'nw-reise',
  template: `
    <section class="reise" aria-label="Travel">
      <h3>Travel</h3>
      <p class="zeile">{{ zeile() }}</p>
      @if (darf()) {
        <div class="knoepfe">
          <button type="button" (click)="schritt('watch')" [disabled]="laeuft()" title="A watch passes without moving">Wait a watch</button>
          <button type="button" (click)="schritt('node')" [disabled]="laeuft()" title="The party moves on one node: a watch passes, rations and light count">Next node</button>
        </div>
      }
      @if (meldung(); as m) { <p class="meldung" role="status">{{ m }}</p> }
      @if (fehler(); as f) { <p class="fehler" role="alert">{{ f }}</p> }
    </section>
  `,
  styles: `
    .reise { margin: 0.6rem 0; }
    .reise h3 { margin: 0 0 0.2rem; }
    .zeile { margin: 0 0 0.4rem; }
    .knoepfe { display: flex; flex-wrap: wrap; gap: 0.4rem; }
    .knoepfe button { min-height: 40px; }
    .meldung { margin: 0.4rem 0 0; color: var(--accent); }
    .fehler { margin: 0.4rem 0 0; color: var(--danger, #a33); }
  `,
})
export class Reise {
  readonly gruppe = input.required<Entity>();

  private readonly bestand = inject(Bestand);
  private readonly session = inject(Session);
  private readonly api = inject(Api);

  protected readonly laeuft = signal(false);
  protected readonly meldung = signal<string | null>(null);
  protected readonly fehler = signal<string | null>(null);

  protected readonly darf = computed(() => this.session.darfSchreiben()(this.gruppe().id));
  private readonly regeln = computed(() => travelRulesOf(this.bestand.registry()?.settings ?? {}));
  private readonly karte = computed(() => (this.gruppe().components?.['Party'] ?? {}) as Record<string, unknown>);
  protected readonly zeile = computed(() => travelLine(travelCounters(this.karte()), this.regeln()));

  protected async schritt(art: 'watch' | 'node'): Promise<void> {
    this.laeuft.set(true);
    this.fehler.set(null);
    this.meldung.set(null);
    try {
      for (let versuch = 0; versuch < 2; versuch++) {
        const e = this.bestand.voll().get(this.gruppe().id) ?? this.gruppe();
        const alt = (e.components?.['Party'] ?? {}) as Record<string, unknown>;
        const s = travelStep(travelCounters(alt), this.regeln(), art);
        const neu: Record<string, unknown> = { ...alt, ...s.patch };
        for (const [k, w] of Object.entries(neu)) if (w === undefined || w === null) delete neu[k];
        const { refs: _r, ...basis } = e as Entity & { refs?: unknown };
        try {
          await this.api.putEntity({ ...(basis as Entity), components: { ...(basis.components ?? {}), Party: neu } });
          await this.bestand.oeffnen(e.id, true, false);
          const teile = [s.newDay ? `Day ${s.after.day} begins.` : '', s.used.ration ? 'A ration is used up.' : '', s.used.light ? 'A light burns out.' : ''];
          this.meldung.set(teile.filter(Boolean).join(' ') || null);
          return;
        } catch (error) {
          if (error instanceof ApiError && error.status === 409 && versuch === 0) {
            await this.bestand.oeffnen(e.id, true, false);
            continue;
          }
          throw error;
        }
      }
    } catch (error) {
      this.fehler.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.laeuft.set(false);
    }
  }
}

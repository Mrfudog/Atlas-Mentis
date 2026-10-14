import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LEFT_BEHIND, type Entity } from '@nw/model';
import { Api, ApiError } from '../kern/api';
import { Bestand } from '../kern/bestand';
import { KurzLink } from '../kern/kurzansicht';
import { Session } from '../kern/session';
import { InventarLageDienst } from './inventar';

const REGEL: Record<string, string> = {
  anytime: 'This campaign lets unstowed items lie as long as they like.',
  bySessionEnd: 'Ending the session leaves behind whatever is not stowed.',
  immediately: 'Whatever is not stowed is left behind when the scene, fight or map changes — and when the session ends.',
};

/**
 * **Liegengelassen** (T-140) — an der Sitzung, im Element `live`: was nicht
 * rechtzeitig verstaut war (`leftBehind`), mit „Pick up into …" für jedes
 * Inventar, das man schreibt, und für die Leitung „End session". Gerechnet
 * und geschrieben wird am Server (`POST /api/sessions/:id/end`, `…/pick-up`);
 * hier wird gezeigt. Der Live-Kanal (T-116) holt die Sitzung neu, wenn
 * sich daran etwas ändert.
 */
@Component({
  selector: 'nw-liegengelassen',
  imports: [RouterLink, KurzLink],
  template: `
    <section class="liegen" aria-label="Left behind">
      <h3>Left behind</h3>
      @if (stapel().length) {
        <ul>
          @for (s of stapel(); track s.edge) {
            <li>
              <a [routerLink]="['/artikel', s.item]" [nwQuick]="s.item">{{ s.name }}</a>
              @if (s.qty !== 1) { <span class="dim">×{{ s.qty }}</span> }
              @if (s.vonName) { <span class="dim">· from {{ s.vonName }}</span> }
              @if (ziele().length) {
                <label>Pick up into
                  <select [disabled]="laeuft()" (change)="aufheben(s.edge, $any($event.target).value); $any($event.target).value = ''">
                    <option value=""></option>
                    @for (z of ziele(); track z.id) { <option [value]="z.id">{{ z.label }}</option> }
                  </select>
                </label>
              }
            </li>
          }
        </ul>
      } @else {
        <p class="dim">Nothing was left behind here.</p>
      }
      @if (session.leitung()) {
        <p class="regel dim">{{ regelText() }}</p>
        <button type="button" class="klein" [disabled]="laeuft()" (click)="beenden()">End session</button>
      }
      @if (meldung(); as m) { <p [class.fehler]="nein()" role="status">{{ m }}</p> }
    </section>
  `,
  styles: `
    .liegen { display: flex; flex-direction: column; gap: 0.4rem; }
    .liegen h3 { margin: 0; }
    ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.3rem; }
    li { display: flex; flex-wrap: wrap; align-items: center; gap: 0.2rem 0.6rem; }
    select { min-height: 32px; }
    .dim { color: var(--dim); }
    .regel { margin: 0; font-size: 0.9rem; }
    .fehler { color: var(--warn); }
    button { align-self: flex-start; }
  `,
})
export class Liegengelassen {
  readonly sitzung = input.required<Entity>();

  protected readonly session = inject(Session);
  private readonly api = inject(Api);
  private readonly bestand = inject(Bestand);
  private readonly lageDienst = inject(InventarLageDienst);

  protected readonly laeuft = signal(false);
  protected readonly meldung = signal('');
  protected readonly nein = signal(false);

  private readonly kanten = computed(() => (this.sitzung().relations ?? []).filter((r) => r.type === LEFT_BEHIND));

  protected readonly stapel = computed(() => {
    const name = this.bestand.name();
    return this.kanten().map((k) => {
      const von = typeof k.props?.['from'] === 'string' ? (k.props['from'] as string) : '';
      return {
        edge: k.id,
        item: k.to,
        name: name(k.to) ?? k.to,
        qty: Math.max(1, Math.trunc(Number(k.props?.['qty']) || 1)),
        vonName: von ? (name(von) ?? '') : '',
      };
    });
  });

  /** Wohin man aufheben kann: Gruppe und Figuren der Kampagne, soweit man sie schreibt. */
  protected readonly ziele = computed(() => {
    const darf = this.session.darfSchreiben();
    const raus: { id: string; label: string }[] = [];
    for (const g of this.lageDienst.lage()?.parties ?? []) {
      if (g.inventory && darf(g.inventory)) raus.push({ id: g.inventory, label: `Party: ${g.name}` });
      for (const m of g.members) if (m.inventory && darf(m.inventory)) raus.push({ id: m.inventory, label: m.name });
    }
    return raus;
  });

  protected readonly regelText = computed(() => REGEL[this.lageDienst.lage()?.stowing ?? 'anytime'] ?? '');

  constructor() {
    void this.lageDienst.laden();
    /* Namen der Gegenstände und der Inventare, aus denen sie kamen. */
    effect(() => {
      const ids = this.kanten().flatMap((k) => [k.to, ...(typeof k.props?.['from'] === 'string' ? [k.props['from'] as string] : [])]);
      if (ids.length) untracked(() => void this.bestand.holen(ids));
    });
  }

  protected async beenden(): Promise<void> {
    if (!confirm('End the session? By this campaign’s rule, whatever is not stowed is left behind here.')) return;
    await this.handeln(async () => {
      const r = await this.api.endSession(this.sitzung().id);
      const n = r.left.reduce((a, l) => a + l.qty, 0);
      return r.rule === 'anytime' ? 'Session ended — this campaign leaves nothing behind.' : n ? `Session ended — ${n} left behind.` : 'Session ended — everything was stowed.';
    });
  }

  protected async aufheben(edge: string, ziel: string): Promise<void> {
    if (!ziel) return;
    await this.handeln(async () => {
      const r = await this.api.pickUp(this.sitzung().id, edge, ziel);
      await this.bestand.oeffnen(ziel, true, false);
      return `Picked up ${r.qty} — it lies unstowed in front of ${this.bestand.name()(ziel) ?? 'them'}.`;
    });
  }

  private async handeln(fn: () => Promise<string>): Promise<void> {
    this.laeuft.set(true);
    this.meldung.set('');
    try {
      const text = await fn();
      this.nein.set(false);
      this.meldung.set(text);
      await this.bestand.oeffnen(this.sitzung().id, true);
    } catch (e) {
      const body = e instanceof ApiError ? (e.body as { error?: string } | undefined) : undefined;
      this.nein.set(true);
      this.meldung.set(body?.error ?? String((e as Error).message ?? e));
    } finally {
      this.laeuft.set(false);
    }
  }
}

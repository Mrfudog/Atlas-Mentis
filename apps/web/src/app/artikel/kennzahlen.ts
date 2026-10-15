import { Component, computed, effect, inject, input, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { keyStats, layoutFor, linkedTypes, primaryInterface } from '@nw/model';
import type { Entity, KeyStats, Registry } from '@nw/model';
import { Bestand } from '../kern/bestand';
import { KurzLink } from '../kern/kurzansicht';
import { flach } from './anordnung';

/**
 * **Die Kennzahlen** (T-206, Element `stats`): Rüstungsklasse,
 * Trefferpunkte, Bewegung, Initiative, passive Wahrnehmung und
 * Herausforderung als eine Reihe Kacheln — die Kurzansicht eines Statblocks
 * auf der Karte, im Popup und am Token. Was dasteht, rechnet `keyStats` im
 * Modell; gerechnet wird beim Lesen (D8).
 *
 * An einem Statblock aus ihm selbst. An einem anderen Artikel aus dem, was
 * über eine `asField`-Kante an ihm hängt und selbst Kennzahlen zeigt (der
 * Statblock einer Kreatur) — gefragt wird dessen Anordnung, kein Artname —,
 * und mit dem Stand dieses Artikels: Trefferpunkte jetzt/Maximum, Zustände.
 */
@Component({
  selector: 'nw-kennzahlen',
  imports: [RouterLink, KurzLink],
  template: `
    @if (zahlen(); as z) {
      @if (z.tiles.length) {
        <dl class="kacheln" aria-label="Key numbers">
          @for (k of z.tiles; track k.key) {
            <div class="kachel" [class.breit]="k.key === 'speed'" [attr.title]="k.note ?? null">
              <dt>{{ k.label }}</dt>
              <dd>{{ k.value }}</dd>
            </div>
          }
        </dl>
      } @else if (ohneStatblock()) {
        <p class="leer">No statblock yet.</p>
      }
      @if (z.conditions.length) {
        <p class="zustaende" aria-label="Conditions">
          @for (c of z.conditions; track c.id) {
            <a class="zustand" [routerLink]="['/artikel', c.id]" [nwQuick]="c.id">{{ c.name }}</a>
          }
        </p>
      }
    }
  `,
  styles: `
    :host {
      display: block;
    }
    /* Eine Reihe, die umbricht und die Zeile füllt — keine Lücke am Ende. */
    .kacheln {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
      margin: 0;
    }
    .kachel {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 0.3rem 0.25rem;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--surface);
      text-align: center;
      min-width: 0;
      flex: 1 1 3.8rem;
    }
    .kachel.breit {
      flex: 2 1 7rem;
    }
    dt {
      font-family: var(--caps);
      font-size: 0.72rem;
      color: var(--dim);
      line-height: 1.1;
    }
    dd {
      margin: 0;
      font-weight: 700;
      font-size: 1.05rem;
      color: var(--heading);
      overflow-wrap: anywhere;
    }
    .zustaende {
      display: flex;
      flex-wrap: wrap;
      gap: 0.3rem;
      margin: 0.4rem 0 0;
    }
    .zustand {
      padding: 0.05rem 0.5rem;
      border-radius: 999px;
      border: 1px solid var(--accent);
      color: var(--accent);
      font-size: 0.85rem;
      text-decoration: none;
    }
    .leer {
      margin: 0;
      color: var(--dim);
    }
  `,
})
export class Kennzahlen {
  readonly artikel = input.required<Entity>();

  private readonly bestand = inject(Bestand);

  /** Trägt dieser Artikel die Zahlen selbst? Dann zeigt seine `quick` sie aus ihm. */
  private readonly selbst = computed(() => !!this.artikel().components?.['Statblock']);

  /**
   * Die `asField`-Kanten, deren anderes Ende Kennzahlen zeigt (seine
   * Anordnung für `quick` nennt `stats`). Für die Kreatur: `belongsTo`.
   */
  private readonly glieder = computed(() => {
    const r = this.bestand.registry();
    if (!r || this.selbst()) return [];
    return linkedTypes(r, primaryInterface(this.artikel())).filter((l) =>
      flach(layoutFor(r, 'quick', l.type).layout).some((x) => x.el === 'stats'),
    );
  });

  /** Die Id des Statblocks am anderen Ende — `undefined`, solange die Rückfrage aussteht. */
  private readonly statblockId = computed<string | null | undefined>(() => {
    const e = this.artikel();
    const gl = this.glieder();
    if (!gl.length) return null;
    const rueck = this.bestand.rueckbezuege().get(e.id);
    for (const l of gl) {
      if (l.direction === 'out') {
        const id = (e.relations ?? []).find((k) => k.type === l.relation)?.to;
        if (id) return id;
      } else {
        if (!rueck) return undefined;
        const id = rueck.find((b) => b.relation.type === l.relation && b.relation.to === e.id)?.from.id;
        if (id) return id;
      }
    }
    return null;
  });

  protected readonly ohneStatblock = computed(() => !this.selbst() && this.statblockId() === null && this.glieder().length > 0);

  private readonly statblock = computed<Entity | undefined>(() => {
    if (this.selbst()) return this.artikel();
    const id = this.statblockId();
    return id ? this.bestand.voll().get(id) : undefined;
  });

  private readonly vitalIds = computed<string[]>(() => {
    const v = this.artikel().components?.['Vitals'] as { conditions?: unknown } | undefined;
    return Array.isArray(v?.conditions) ? v.conditions.filter((x): x is string => typeof x === 'string') : [];
  });

  constructor() {
    /* Liegt die Kante drüben (`belongsTo` am Statblock), fragt die
       Rückfrage; das Popup holt sie sonst nicht (T-093). */
    effect(() => {
      const e = this.artikel();
      if (this.glieder().some((l) => l.direction === 'in')) untracked(() => void this.bestand.oeffnen(e.id, false, true));
    });
    effect(() => {
      const id = this.statblockId();
      if (id) untracked(() => void this.bestand.oeffnen(id, false, false));
    });
    /* Die Zustände sind Verweise; ihre Namen holt, wer sie zeigt. */
    effect(() => {
      const name = this.bestand.name();
      const offen = this.vitalIds().filter((id) => !name(id));
      if (offen.length) untracked(() => void this.bestand.holen(offen));
    });
  }

  protected readonly zahlen = computed<KeyStats | null>(() => {
    const r: Registry | null = this.bestand.registry();
    if (!r) return null;
    const name = this.bestand.name();
    return keyStats(r, this.statblock(), this.artikel(), { nameOf: (id) => name(id) });
  });
}

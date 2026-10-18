import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LAYER_RELATION } from '@nw/model';
import type { Entity } from '@nw/model';
import type { Fassungen } from '../kern/api';
import { Bestand } from '../kern/bestand';
import { Stapel } from '../kern/stapel';

/** Eine Ebene in der Marke: die des gezeigten Artikels oder einer anderen Fassung. */
interface Chip {
  key: string;
  name: string;
  /** Wohin der Klick führt: die Ebene selbst oder die andere Fassung. */
  ziel: string;
  aktuell: boolean;
  vergleich: boolean;
  titel: string;
}

/**
 * **Die Ebene am Artikel, immer** (T-251, REQ-348): im Kopf jeder
 * Artikelseite steht, in welcher Ebene der Artikel liegt — gibt es
 * Fassungen, auch deren Ebenen, die gezeigte hervorgehoben, die übrigen
 * ein Klick auf ihre Fassung —, und daneben, **wodurch** er gerade zu
 * sehen ist: aufgeschaltet in der laufenden Kampagne, aus einer
 * Vergleichsebene, als Einzelartikel freigegeben (T-213) oder in keiner
 * Ebene.
 *
 * Gerechnet wird hier nichts, was der Server nicht schon gesiebt hat:
 * eine Ebene ausserhalb des Stapels kommt ohne Namen (T-207) und steht
 * darum nicht da, und die Fassungen sind die, die dieser Betrachter sieht
 * (`GET /api/entities/:id/versions`). Am Telefon einzeilig, die Namen
 * gekürzt; der ganze Name steht im Tooltip.
 */
@Component({
  selector: 'nw-ebenen-marke',
  imports: [RouterLink],
  template: `
    <p class="marke" aria-label="Layer">
      <span class="leg">{{ chips().length > 1 ? 'Layers' : 'Layer' }}</span>
      @for (c of chips(); track c.key) {
        <a
          class="chip"
          [class.aktuell]="c.aktuell"
          [class.vergleich]="c.vergleich"
          [routerLink]="['/artikel', c.ziel]"
          [attr.aria-current]="c.aktuell ? 'true' : null"
          [title]="c.titel"
          >{{ c.name }}</a
        >
      }
      @if (!chips().length && ohneEbene()) {
        <span class="chip leer">no layer</span>
      }
      @if (grund(); as g) {
        <span class="grund" [title]="g">{{ g }}</span>
      }
    </p>
  `,
  styles: `
    :host {
      display: block;
      margin-top: 0.35rem;
    }
    .marke {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.3rem 0.4rem;
      margin: 0;
      font-family: var(--sans);
      font-size: 0.82rem;
      color: var(--dim);
    }
    .leg {
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-size: 0.72rem;
    }
    .chip {
      display: inline-block;
      max-width: 16rem;
      padding: 0.05rem 0.5rem;
      border: 1px solid var(--line, var(--dim));
      border-radius: 999px;
      color: var(--ink);
      text-decoration: none;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      vertical-align: middle;
    }
    .chip.aktuell {
      border-color: var(--gold);
      background: var(--hover);
      font-weight: 600;
    }
    .chip.vergleich {
      border-style: dashed;
    }
    .chip.leer {
      font-style: italic;
    }
    a.chip:hover,
    a.chip:focus-visible {
      border-color: var(--accent);
    }
    .grund {
      font-style: italic;
    }
    /* Am Telefon eine Zeile: Namen gekürzt, der Grund als letztes, was Platz hat. */
    @media (max-width: 640px) {
      .marke {
        flex-wrap: nowrap;
        overflow: hidden;
      }
      .chip {
        max-width: 8.5rem;
        flex-shrink: 1;
        min-width: 3rem;
      }
      .leg,
      .chip.aktuell {
        flex-shrink: 0;
      }
      .grund {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        min-width: 0;
      }
    }
  `,
})
export class EbenenMarke {
  readonly artikel = input.required<Entity>();
  readonly fassungen = input<Fassungen | null>(null);

  private readonly bestand = inject(Bestand);
  private readonly stapel = inject(Stapel);

  protected readonly chips = computed<Chip[]>(() => {
    const e = this.artikel();
    const name = this.bestand.name();
    const f = this.fassungen();
    const vergleich = this.bestand.vergleich().has(e.id);
    const ebenenName = (id: string) => f?.layers.find((l) => l.id === id)?.name ?? name(id);
    const raus: Chip[] = [];
    /* Ebenen, deren Namen der Server nicht schickt, stehen nicht da (T-207). */
    for (const r of e.relations ?? []) {
      if (r.type !== LAYER_RELATION) continue;
      const n = ebenenName(r.to);
      if (!n || raus.some((c) => c.key === r.to)) continue;
      raus.push({ key: r.to, name: n, ziel: r.to, aktuell: true, vergleich, titel: `${n} — this version. Open the layer.` });
    }
    for (const v of f?.versions ?? []) {
      for (const l of v.layers) {
        const n = ebenenName(l);
        if (!n || raus.some((c) => c.key === l)) continue;
        raus.push({
          key: l,
          name: n,
          ziel: v.entity.id,
          aktuell: false,
          vergleich: v.compare,
          titel: `${n} — another version${v.play ? ', in play' : v.compare ? ', compare layer' : ''}. Open it.`,
        });
      }
    }
    return raus;
  });

  /** Liegt er in keiner Ebene — nicht bloss in einer, deren Namen er nicht sehen darf? */
  protected readonly ohneEbene = computed(() => !(this.artikel().relations ?? []).some((r) => r.type === LAYER_RELATION));

  /** Wodurch der Artikel gerade zu sehen ist. */
  protected readonly grund = computed(() => {
    const e = this.artikel();
    const kampagne = this.stapel.laufend()?.name ?? this.fassungen()?.campaign?.name;
    const bei = kampagne ? ` in ${kampagne}` : '';
    if (this.bestand.vergleich().has(e.id)) return `compare layer — not in play${bei}`;
    if (this.bestand.freigabe().get(e.id)?.enabled) return `enabled as extra content${bei}`;
    if (this.ohneEbene()) return 'in no layer — shown in every campaign';
    return kampagne ? `in play${bei}` : '';
  });
}

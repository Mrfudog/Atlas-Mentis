import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { appliesText, countElements, isDesignedView, viewGroup, viewKeys } from '@nw/model';
import { ansichtsTeile } from './uebersicht';
import { Bestand } from '../kern/bestand';
import { RegisterArbeit } from '../register/arbeit';

/**
 * **Registry › Views als Liste** (T-268, T-276): jede Ansicht mit Gruppe,
 * Geltung, wie viele Artikel sie bekommen und wie viele Elemente sie hat.
 * Gezählt hat der Server (`/api/registry/usage`, nur gestaltete Ansichten
 * mit Geltung); die übrigen gelten für jeden Artikel ihres Orts.
 */
@Component({
  selector: 'nw-ansichtsliste',
  imports: [RouterLink],
  template: `
    <section class="kasten" aria-label="All views">
      <div class="kopf">
        <h2>Views</h2>
        <span class="dim">every view, what it applies to and how many articles get it</span>
        <a class="knopf pri" [routerLink]="[]" [queryParams]="{ tab: 'views', view: null, design: 'new' }">+ Design a new view</a>
      </div>
      <div class="tabelle" role="table" aria-label="Views">
        <div role="row" class="zeile k">
          <span role="columnheader">View</span><span role="columnheader">Group</span><span role="columnheader">Applies to</span>
          <span role="columnheader">Articles</span><span role="columnheader">Elements</span><span role="columnheader"></span>
        </div>
        @for (z of zeilen(); track z.key) {
          <div role="row" class="zeile">
            <span role="cell"><b>{{ z.label }}</b> <code class="dim">{{ z.key }}</code></span>
            <span role="cell">{{ z.group }}</span>
            <span role="cell">{{ z.applies }}</span>
            <span role="cell">{{ z.count }}</span>
            <span role="cell">{{ z.els }}</span>
            <span role="cell" class="knoepfe">
              <a class="knopf" [routerLink]="[]" [queryParams]="{ tab: 'views', view: z.key, type: null, design: null }">Design</a>
            </span>
          </div>
          <!-- Was darin je Typ und gestaltet gilt (T-318) — dort findet man eine Typanordnung wieder;
               zugeklappt, denn an „overview" sagen vierzig Typen Eigenes. -->
          @if (z.teile.length) {
            <div role="row" class="zeile unter">
              <span role="cell" class="breit">
                <button type="button" class="klapp" [attr.aria-expanded]="offen().has(z.key)" (click)="umschalten(z.key)">
                  {{ offen().has(z.key) ? '▾' : '▸' }} {{ z.zusammen }}
                </button>
              </span>
            </div>
          }
          @for (t of offen().has(z.key) ? z.teile : []; track t.view + (t.type ?? '')) {
            <div role="row" class="zeile unter">
              <span role="cell">↳ {{ t.label }}</span>
              <span role="cell">{{ t.art === 'type' ? 'type' : 'designed' }}</span>
              <span role="cell">{{ t.wie }}</span>
              <span role="cell"></span>
              <span role="cell"></span>
              <span role="cell" class="knoepfe">
                <a class="knopf" [routerLink]="[]" [queryParams]="{ tab: 'views', view: t.view, type: t.type, design: null }">Design</a>
              </span>
            </div>
          }
        }
      </div>
      <p class="dim">
        Overview, Quick, Full, Print and Search are the views places ask for: they can be rebuilt, not deleted. Under each
        view stand the types that say their own for it (adjusted or their own arrangement) and the designed views of its group.
      </p>
    </section>
  `,
  styles: `
    .kopf {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem 0.8rem;
      align-items: baseline;
    }
    .kopf .pri {
      margin-left: auto;
    }
    .zeile {
      display: grid;
      grid-template-columns: minmax(10rem, 1.4fr) 6rem minmax(10rem, 2fr) 5rem 5rem auto;
      gap: 0.5rem;
      align-items: center;
      padding: 0.35rem 0;
      border-bottom: 1px solid var(--line2);
    }
    .breit {
      grid-column: 1 / -1;
    }
    .klapp {
      all: unset;
      cursor: pointer;
      color: var(--accent);
    }
    .klapp:focus-visible {
      outline: 2px solid var(--accent);
    }
    .zeile.unter {
      font-size: 0.9rem;
      padding-left: 1rem;
      color: var(--dim);
    }
    .zeile.k {
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--dim);
    }
    .knoepfe {
      display: flex;
      gap: 0.3rem;
      flex-wrap: wrap;
    }
    @media (max-width: 760px) {
      .zeile {
        grid-template-columns: 1fr 1fr;
      }
      .zeile.k {
        display: none;
      }
    }
  `,
})
export class Ansichtsliste {
  private readonly bestand = inject(Bestand);
  private readonly arbeit = inject(RegisterArbeit);

  /** Aufgeklappte Ansichten (T-318). */
  protected readonly offen = signal<ReadonlySet<string>>(new Set());
  protected umschalten(k: string): void {
    const n = new Set(this.offen());
    if (n.has(k)) n.delete(k);
    else n.add(k);
    this.offen.set(n);
  }

  protected readonly zeilen = computed(() => {
    const r = this.bestand.registry();
    if (!r) return [];
    const gezaehlt = this.arbeit.usage()?.views ?? {};
    const name = this.bestand.name();
    /* Gestaltete Ansichten einer anderen Ansicht stehen unter ihr, nicht noch einmal oben. */
    const unter = (key: string) => {
      const d = r.views[key];
      const g = viewGroup(key, d);
      return isDesignedView(d) && g !== key && !!r.views[g] && !isDesignedView(r.views[g]);
    };
    return viewKeys(r).filter((k) => !unter(k)).map((key) => {
      const def = r.views[key]!;
      return {
        teile: ansichtsTeile(r, key, (id) => name(id)).filter((t) => t.art !== 'general'),
        zusammen: zaehlText(ansichtsTeile(r, key, (id) => name(id))),
        key,
        label: def.label,
        group: viewGroup(key, def),
        applies: appliesText(def.applies, (id) => name(id)),
        count: def.applies ? (gezaehlt[key]?.toLocaleString('en') ?? '…') : 'all',
        els: countElements(def.layout),
      };
    });
  });
}

/** „12 types say their own · 1 designed view" — die zugeklappte Zeile (T-318). */
function zaehlText(teile: { art: string }[]): string {
  const typen = teile.filter((t) => t.art === 'type').length;
  const gestaltet = teile.filter((t) => t.art === 'designed').length;
  return [
    typen ? `${typen} ${typen === 1 ? 'type says' : 'types say'} their own` : '',
    gestaltet ? `${gestaltet} designed ${gestaltet === 1 ? 'view' : 'views'}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { appliesText, countElements, isDesignedView, viewGroup, viewKeys } from '@nw/model';
import { Bestand } from '../kern/bestand';
import { RegisterArbeit } from '../register/arbeit';

/**
 * **Registry › Views als Liste** (T-268): jede Ansicht mit Gruppe,
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
              <a class="knopf" [routerLink]="[]" [queryParams]="{ tab: 'views', view: z.key, design: 1 }">Design</a>
              @if (!z.designed) {
                <a class="knopf" [routerLink]="[]" [queryParams]="{ tab: 'views', view: z.key, design: null }">Edit as before</a>
              }
            </span>
          </div>
        }
      </div>
      <p class="dim">
        Overview, Quick, Full, Print and Search are the views places ask for; designing one of them makes a new view next to it.
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

  protected readonly zeilen = computed(() => {
    const r = this.bestand.registry();
    if (!r) return [];
    const gezaehlt = this.arbeit.usage()?.views ?? {};
    const name = this.bestand.name();
    return viewKeys(r).map((key) => {
      const def = r.views[key]!;
      return {
        key,
        label: def.label,
        group: viewGroup(key, def),
        applies: appliesText(def.applies, (id) => name(id)),
        count: def.applies ? (gezaehlt[key]?.toLocaleString('en') ?? '…') : 'all',
        els: countElements(def.layout),
        designed: isDesignedView(def),
      };
    });
  });
}

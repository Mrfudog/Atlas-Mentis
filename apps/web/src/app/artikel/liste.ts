import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { entityName, isInstance, primaryInterface } from '@nw/model';
import { Bestand } from '../kern/bestand';

/**
 * Die Liste — aus der Kurzfassung des Bestands (`summaryOf`). Sie sucht über Name **und** Alias, weil am Tisch der Deckname
 * fällt und nicht der Eintrag im Register — und weil der Server einem
 * Spieler ohnehin nur zeigt, was er wissen darf, ist hier keine zweite
 * Sichtprüfung nötig. Eine zweite wäre auch die falsche: sie stünde an der
 * Stelle, an der man sie vergisst.
 */
@Component({
  selector: 'nw-liste',
  imports: [RouterLink],
  template: `
    <header class="kopf">
      <input
        type="search"
        placeholder="Search…"
        [value]="suche()"
        (input)="suche.set($any($event.target).value); bis.set(SCHRITT)"
      />
      <span class="zahl">{{ gefiltert().length }} of {{ gelistet().length }}</span>
    </header>

    @if (bestand.fehler(); as f) {
      <p class="fehler">{{ f }}</p>
    }

    <ul class="liste">
      @for (e of gezeigt(); track e.id) {
        <li>
          <a [routerLink]="['/artikel', e.id]">{{ name(e) }}</a>
          <span class="art">{{ art(e) }}</span>
        </li>
      } @empty {
        <li class="leer">Nothing here.</li>
      }
    </ul>
    @if (gefiltert().length > gezeigt().length) {
      <p class="leer">
        {{ gefiltert().length - gezeigt().length }} more —
        <button type="button" (click)="mehr()">show {{ SCHRITT }} more</button>
        or narrow the search.
      </p>
    }
  `,
  styleUrl: './artikel.scss',
})
export class Liste {
  protected readonly bestand = inject(Bestand);
  protected readonly suche = signal('');

  /* Gezeichnet wird ein Stück, nicht alles: 24 157 Zeilen auf einmal
     halten den Browser auf, und niemand liest sie. Wer sucht, findet trotzdem
     in allen — gezählt wird oben immer der ganze Treffer. */
  protected readonly SCHRITT = 200;
  protected readonly bis = signal(this.SCHRITT);
  protected readonly gezeigt = computed(() => this.gefiltert().slice(0, this.bis()));
  protected mehr(): void {
    this.bis.update((n) => n + this.SCHRITT);
  }

  constructor() {
    void this.bestand.load();
  }

  /* Instanzen stehen an ihrer Kreatur und nicht in der Liste: dreissig
     Wachen wären sonst dreissig „Wache"-Statblocks. */
  protected readonly gelistet = computed(() =>
    this.bestand.entities().filter((e) => !isInstance(e)),
  );

  protected readonly gefiltert = computed(() => {
    const q = this.suche().trim().toLocaleLowerCase('de');
    const alle = [...this.gelistet()].sort((a, b) =>
      entityName(a).localeCompare(entityName(b), 'de'),
    );
    if (!q) return alle;
    return alle.filter((e) => {
      if (entityName(e).toLocaleLowerCase('de').includes(q)) return true;
      const identity = e.components?.['Identity'] as { aliases?: string[] } | undefined;
      return (identity?.aliases ?? []).some((a) => a.toLocaleLowerCase('de').includes(q));
    });
  });

  protected name(e: Parameters<typeof entityName>[0]) {
    return entityName(e);
  }
  protected art(e: Parameters<typeof primaryInterface>[0]) {
    return primaryInterface(e);
  }
}

import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { entityName, primaryInterface } from '@nw/model';
import { Bestand } from '../kern/bestand';

/**
 * Die Liste. Sie sucht über Name **und** Alias, weil am Tisch der Deckname
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
        (input)="suche.set($any($event.target).value)"
      />
      <span class="zahl">{{ gefiltert().length }} of {{ bestand.entities().length }}</span>
    </header>

    @if (bestand.fehler(); as f) {
      <p class="fehler">{{ f }}</p>
    }

    <ul class="liste">
      @for (e of gefiltert(); track e.id) {
        <li>
          <a [routerLink]="['/artikel', e.id]">{{ name(e) }}</a>
          <span class="art">{{ art(e) }}</span>
        </li>
      } @empty {
        <li class="leer">Nothing here.</li>
      }
    </ul>
  `,
  styleUrl: './artikel.scss',
})
export class Liste {
  protected readonly bestand = inject(Bestand);
  protected readonly suche = signal('');

  constructor() {
    void this.bestand.load();
  }

  protected readonly gefiltert = computed(() => {
    const q = this.suche().trim().toLocaleLowerCase('de');
    const alle = [...this.bestand.entities()].sort((a, b) =>
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

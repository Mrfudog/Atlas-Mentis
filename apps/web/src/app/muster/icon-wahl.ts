import { Component, computed, input, output, signal } from '@angular/core';
import { ICONS, iconDef, searchIcons } from '@nw/model';
import { Icon } from './icon';

/**
 * **Der Icon-Wähler** (T-461, REQ-460): ein Knopf zeigt, was gilt — das
 * gewählte Icon, sonst das geerbte („inherited“), sonst „none“ —, und
 * öffnet darunter den Katalog: ein Suchfeld (Name, Beschriftung, Tags)
 * und je Icon ein Knopf mit Bild und Namen. „None“ nimmt die eigene Wahl
 * zurück, dann gilt wieder, was darüber gilt.
 *
 * Dieselbe Komponente an drei Stellen: an der Art und am Feld im
 * Register, am Artikel im Bearbeiten (`format: 'icon'`). Gespeichert wird
 * der Name; wer ihn tippen will, tippt ihn ins Suchfeld und wählt.
 */
@Component({
  selector: 'nw-icon-wahl',
  imports: [Icon],
  template: `
    <div class="iwahl">
      <button type="button" class="jetzt" [disabled]="disabled()" [attr.aria-expanded]="offen()" [attr.aria-label]="label()"
        (click)="offen.set(!offen())">
        <nw-icon [name]="gezeigt()" />
        <span class="wort">{{ wortJetzt() }}</span>
        <span class="pfeil" aria-hidden="true">{{ offen() ? '▴' : '▾' }}</span>
      </button>
      @if (offen()) {
        <div class="katalog" role="group" [attr.aria-label]="label() + ' — icon set'">
          <input type="search" [value]="suche()" (input)="suche.set($any($event.target).value)" placeholder="Search icons…"
            [attr.aria-label]="'Search icons for ' + label()" autocomplete="off" />
          <div class="raster">
            @if (wert()) {
              <button type="button" class="icon keins" (click)="waehlen('')" [attr.aria-pressed]="false">
                <span class="bild" aria-hidden="true">—</span><span class="iname">None</span>
              </button>
            }
            @for (i of treffer(); track i.id) {
              <button type="button" class="icon" [class.gewaehlt]="i.id === wert()" [attr.aria-pressed]="i.id === wert()"
                [title]="i.label + ' (' + i.id + ')'" (click)="waehlen(i.id)">
                <nw-icon [name]="i.id" /><span class="iname">{{ i.id }}</span>
              </button>
            } @empty {
              <p class="leer">No icon matches “{{ suche() }}”.</p>
            }
          </div>
          <p class="hinweis">{{ zahl() }} icons · Lucide (ISC) — see the handbook for the licence.</p>
        </div>
      }
    </div>
  `,
  styles: `
    .iwahl { display: inline-block; max-width: 100%; }
    .jetzt { display: inline-flex; align-items: center; gap: 0.4rem; font: inherit; padding: 0.25rem 0.5rem; }
    .jetzt .wort { font-family: ui-monospace, monospace; font-size: 0.85em; }
    .katalog { margin-top: 0.4rem; padding: 0.5rem; border: 1px solid var(--rahmen, currentColor); border-radius: 0.4rem; max-width: 36rem; }
    .katalog input { width: 100%; box-sizing: border-box; margin-bottom: 0.4rem; font: inherit; }
    .raster { display: grid; grid-template-columns: repeat(auto-fill, minmax(5.5rem, 1fr)); gap: 0.25rem; max-height: 14rem; overflow-y: auto; }
    .icon { display: flex; flex-direction: column; align-items: center; gap: 0.2rem; padding: 0.35rem 0.2rem; font: inherit; font-size: 0.75em; cursor: pointer; border: 1px solid transparent; border-radius: 0.3rem; background: none; color: inherit; }
    .icon nw-icon, .icon .bild { font-size: 1.6rem; line-height: 1; }
    .icon .iname { font-family: ui-monospace, monospace; overflow: hidden; text-overflow: ellipsis; max-width: 100%; white-space: nowrap; }
    .icon:hover, .icon:focus-visible { border-color: currentColor; }
    .icon.gewaehlt { border-color: currentColor; background: rgba(127, 127, 127, 0.15); }
    .leer, .hinweis { grid-column: 1 / -1; font-size: 0.8em; opacity: 0.75; margin: 0.3rem 0 0; }
  `,
})
export class IconWahl {
  /** Die eigene Wahl; leer heisst keine. */
  readonly wert = input<string>('');
  /** Was ohne eigene Wahl gilt (das der Art, des Obertyps); leer: nichts. */
  readonly geerbt = input<string>('');
  /** Wofür gewählt wird — die Beschriftung für Hilfstechnik. */
  readonly label = input<string>('Icon');
  readonly disabled = input(false);
  readonly wertChange = output<string>();

  protected readonly offen = signal(false);
  protected readonly suche = signal('');
  protected readonly zahl = computed(() => ICONS.length);
  protected readonly treffer = computed(() => searchIcons(this.suche()));
  protected readonly gezeigt = computed(() => this.wert() || this.geerbt());
  protected readonly wortJetzt = computed(() => {
    const w = this.wert();
    if (w) return iconDef(w) ? w : `${w} (unknown)`;
    return this.geerbt() ? `inherited — ${this.geerbt()}` : 'none';
  });

  protected waehlen(id: string): void {
    this.wertChange.emit(id);
    this.offen.set(false);
  }
}

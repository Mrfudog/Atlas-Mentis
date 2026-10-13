/**
 * Der Filter einer Listenseite — Suche, Ebenen, Seite.
 *
 * **Der Filter gehört der Seite** (CLAUDE.md): von einem Artikel auf seine
 * Liste zurückzugehen behält ihn; erst wer eine **andere** Listenseite
 * betritt, fängt dort leer an. Die Art steht nicht hier, sondern in der
 * Adresse (`?type=`), weil der Brotkrumenpfad eines Artikels auf sie zeigt
 * und ein Link sagen können muss, wohin er führt.
 */

import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ListenFilter {
  private seite: string | null = null;
  private letzterTyp: string | undefined | null = null;

  readonly suche = signal('');
  /** Ausgeschlossene Ebenen — leer heisst: alle. Ein Häkchen weg nimmt eine heraus. */
  readonly ohneEbenen = signal<ReadonlySet<string>>(new Set());
  readonly blatt = signal(0);

  /** Beim Betreten einer Listenseite: eine andere als zuletzt fängt leer an. */
  betrete(seite: string): void {
    if (this.seite === seite) return;
    this.seite = seite;
    this.suche.set('');
    this.ohneEbenen.set(new Set());
    this.blatt.set(0);
    this.letzterTyp = null;
  }

  /** Die Art aus der Adresse. Wechselt sie, beginnt die Liste auf Blatt 1. */
  typ(t: string | undefined): void {
    if (this.letzterTyp !== null && this.letzterTyp !== t) this.blatt.set(0);
    this.letzterTyp = t;
  }
}

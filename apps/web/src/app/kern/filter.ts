/**
 * Der Filter einer Listenseite — Suche, Ebenen, Feldfilter, Teile,
 * Sortierung, Blatt und die Vorschau.
 *
 * **Der Filter gehört der Seite** (CLAUDE.md): von einem Artikel auf seine
 * Liste zurückzugehen behält ihn; erst wer eine **andere** Listenseite
 * betritt, fängt dort leer an. Die Art steht nicht hier, sondern in der
 * Adresse (`?type=`), weil der Brotkrumenpfad eines Artikels auf sie zeigt
 * und ein Link sagen können muss, wohin er führt.
 *
 * Seit W7 rechnet der Server die Liste (`/api/list`); hier steht nur, was
 * gefragt wird. Die Seitenzahl bleibt im Filterzustand und nicht in der
 * Adresse: zurück vom Artikel landet man auf demselben Blatt, und ein
 * geteilter Link zeigt die Art, nicht Blatt 37 einer Suche, die der andere
 * nicht getippt hat.
 */

import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ListenFilter {
  private seite: string | null = null;
  private letzterTyp: string | undefined | null = null;

  readonly suche = signal('');
  /** Ausgeschlossene Ebenen — leer heisst: alle. Ein Häkchen weg nimmt eine heraus. */
  readonly ohneEbenen = signal<ReadonlySet<string>>(new Set());
  /** Feldfilter der gewählten Art: `Typ.feld` → gewählte Werte bzw. Spanne. */
  readonly felder = signal<Readonly<Record<string, { values?: string[]; min?: number; max?: number }>>>({});
  /** Teile von Statblöcken einblenden (W7). */
  readonly teile = signal(false);
  /** `name`, `type` oder `Typ.feld`; ein `-` davor kehrt um. Leer: nach Namen. */
  readonly sortierung = signal('');
  readonly blatt = signal(0);
  /** Die Zeile, deren Vorschau rechts steht. */
  readonly vorschau = signal<string | null>(null);

  /** Beim Betreten einer Listenseite: eine andere als zuletzt fängt leer an. */
  betrete(seite: string): void {
    if (this.seite === seite) return;
    this.seite = seite;
    this.suche.set('');
    this.ohneEbenen.set(new Set());
    this.teile.set(false);
    this.felder.set({});
    this.sortierung.set('');
    this.blatt.set(0);
    this.vorschau.set(null);
    this.letzterTyp = null;
  }

  /**
   * Die Art aus der Adresse. Wechselt sie, beginnt die Liste auf Blatt 1,
   * und die Feldfilter und die Sortierung der alten Art gehen — Grad und
   * Schule sagen einem Gegenstand nichts.
   */
  typ(t: string | undefined): void {
    if (this.letzterTyp !== null && this.letzterTyp !== t) {
      this.blatt.set(0);
      this.felder.set({});
      this.sortierung.set('');
    }
    this.letzterTyp = t;
  }
}

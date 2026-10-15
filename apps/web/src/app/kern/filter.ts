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

/** Ein Feldfilter: gewählte Werte (ODER) oder eine Spanne. */
export type Feldfilter = { values?: string[]; min?: number; max?: number };

/**
 * Die Facetten als Adresse (T-174) — dieselbe Form, die der Server liest:
 * `Typ.feld:a|b`, `Typ.feld:1..3`, `in.grants:<id>`. Sortiert, damit
 * dieselbe Wahl dieselbe Adresse ist.
 */
export function feldfilterAlsF(felder: Readonly<Record<string, Feldfilter>>): string[] {
  const f: string[] = [];
  for (const [ref, w] of Object.entries(felder)) {
    if (w.values?.length) f.push(`${ref}:${w.values.join('|')}`);
    else if (w.min !== undefined || w.max !== undefined) f.push(`${ref}:${w.min ?? ''}..${w.max ?? ''}`);
  }
  return f.sort();
}

/** Zurück aus der Adresse; was keine Form hat, fällt weg. */
export function feldfilterAusF(f: readonly string[] | string | undefined | null): Record<string, Feldfilter> {
  const raus: Record<string, Feldfilter> = {};
  for (const s of typeof f === 'string' ? [f] : (f ?? [])) {
    const punkt = s.indexOf(':');
    if (punkt <= 0) continue;
    const ref = s.slice(0, punkt);
    const rest = s.slice(punkt + 1);
    const spanne = /^(-?[\d.]*)\.\.(-?[\d.]*)$/.exec(rest);
    if (spanne) {
      const w: Feldfilter = {};
      if (spanne[1] && Number.isFinite(Number(spanne[1]))) w.min = Number(spanne[1]);
      if (spanne[2] && Number.isFinite(Number(spanne[2]))) w.max = Number(spanne[2]);
      if (w.min !== undefined || w.max !== undefined) raus[ref] = w;
    } else {
      const values = rest.split('|').filter(Boolean);
      if (values.length) raus[ref] = { values };
    }
  }
  return raus;
}

@Injectable({ providedIn: 'root' })
export class ListenFilter {
  private seite: string | null = null;
  private letzterTyp: string | undefined | null = null;
  /** Mit welcher Filtergruppe die Seitenleiste zuletzt gesetzt wurde (T-137). */
  private gesaet: string | null = null;

  readonly suche = signal('');
  /** Ausgeschlossene Ebenen — leer heisst: alle. Ein Häkchen weg nimmt eine heraus. */
  readonly ohneEbenen = signal<ReadonlySet<string>>(new Set());
  /** Feldfilter der gewählten Art: `Typ.feld` → gewählte Werte bzw. Spanne. */
  readonly felder = signal<Readonly<Record<string, Feldfilter>>>({});
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
    this.gesaet = null;
  }

  /**
   * **Womit eine Filtergruppe anfängt** (T-137): Suche, abgewählte
   * Ebenen und Facetten, einmal je Gruppe. Danach gehört der Filter wieder der Seite —
   * zurück vom Artikel bleibt, was jemand seither geändert hat.
   */
  saeen(
    schluessel: string,
    start: { q?: string | undefined; nolayer?: readonly string[] | undefined; f?: readonly string[] | undefined },
  ): void {
    if (this.gesaet === schluessel) return;
    this.gesaet = schluessel;
    this.suche.set(start.q ?? '');
    this.ohneEbenen.set(new Set(start.nolayer ?? []));
    /* Die Facetten einer Gruppe (T-174): „Wizard-Zauber bis Grad 3". */
    this.felder.set(feldfilterAusF(start.f));
    this.blatt.set(0);
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

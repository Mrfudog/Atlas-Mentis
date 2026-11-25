import { Injectable, inject, signal } from '@angular/core';
import { cleanColumns, columnsKey } from '@nw/model';
import { Api } from './api';

/** Woher eine Spaltenwahl kommt. */
export type SpaltenQuelle = 'address' | 'own' | 'campaign' | null;

/** Der Schlüssel in den Einstellungen des Kontos: `listColumns.world`, `listColumns.compendium.Spell`. */
export function spaltenPref(seite: string, typ?: string | null): string {
  return typ ? `listColumns.${seite}.${typ}` : `listColumns.${seite}`;
}

/**
 * **Die Spaltenwahl der Übersichten** (T-343): je Tabelle — Seite und,
 * wenn gewählt, Art — welche Spalten sie zeigt.
 *
 * Es gilt, in dieser Reihenfolge: die Adresse (`?cols=`, ein geteilter
 * Link), die Wahl des Kontos (seine Einstellungen, auf jedem Gerät
 * dieselbe), die Vorgabe der Kampagne (die Leitung, `/api/list-columns`)
 * — und ohne alles die Felder der `overview` der Art, wie immer.
 */
@Injectable({ providedIn: 'root' })
export class Spalten {
  private readonly api = inject(Api);
  /** Die eigenen Wahlen: Einstellungsschlüssel → Spalten. */
  readonly eigene = signal<Record<string, string[]>>({});
  readonly vorgaben = signal<Record<string, string[]>>({});
  readonly darfVorgabe = signal(false);
  readonly geladen = signal(false);
  private laden: Promise<void> | null = null;

  lade(): Promise<void> {
    this.laden ??= Promise.all([
      this.api.prefs().catch(() => ({}) as Record<string, unknown>),
      this.api.listColumnDefaults().catch(() => null),
    ]).then(([p, v]) => {
      const eigene: Record<string, string[]> = {};
      for (const [k, w] of Object.entries(p)) {
        if (!k.startsWith('listColumns.')) continue;
        const c = cleanColumns(w);
        if (c) eigene[k] = c;
      }
      this.eigene.set(eigene);
      this.vorgaben.set(v?.defaults ?? {});
      this.darfVorgabe.set(!!v?.canManage);
      this.geladen.set(true);
    });
    return this.laden;
  }

  /** Was für diese Tabelle gilt — `null`: die Vorgabe der Art. */
  wahl(seite: string, typ: string | undefined, adresse: string | undefined): { cols: string[]; quelle: SpaltenQuelle } | null {
    if (adresse !== undefined) return { cols: cleanColumns(adresse) ?? [], quelle: 'address' };
    const eigen = this.eigene()[spaltenPref(seite, typ)];
    if (eigen) return { cols: eigen, quelle: 'own' };
    const vorgabe = this.vorgaben()[columnsKey(seite, typ)];
    if (vorgabe) return { cols: vorgabe, quelle: 'campaign' };
    return null;
  }

  /** Die eigene Wahl speichern; `null` nimmt sie weg (zurück zur Vorgabe). */
  async setzen(seite: string, typ: string | undefined, cols: string[] | null): Promise<void> {
    const key = spaltenPref(seite, typ);
    this.eigene.update((e) => {
      const { [key]: _alt, ...rest } = e;
      return cols ? { ...rest, [key]: cols } : rest;
    });
    await this.api.setPref(key, cols);
  }

  /** Die Leitung: diese Wahl als Vorgabe der Kampagne, `null` nimmt sie weg. */
  async alsVorgabe(seite: string, typ: string | undefined, cols: string[] | null): Promise<void> {
    const key = columnsKey(seite, typ);
    await this.api.setListColumnDefault(key, cols);
    this.vorgaben.update((v) => {
      const { [key]: _alt, ...rest } = v;
      return cols ? { ...rest, [key]: cols } : rest;
    });
  }
}

/**
 * **Filtergruppen je Seite** (T-137): was `/api/filters` liefert, einmal
 * je Anmeldung geholt und nach jeder Änderung neu — die Kopfleiste und die
 * Unterreiter lesen dieselbe Stelle, sonst stünde in der Leiste eine
 * Gruppe, die der Reiter schon gelöscht hat.
 *
 * Welche Gruppe auf einer Seite gilt (`aktiv`): mit `?view=<id>` diese,
 * mit `?view=all` keine, ohne `view` die Vorgabe der Seite, wenn die
 * Kampagne eine hat. Die Vorgabe ist eine Gruppe wie jede andere, nur mit
 * der Marke `default` — „World ohne Items" ist ein Eintrag, kein Code.
 */

import { Injectable, computed, inject, signal } from '@angular/core';
import { Api, type Filtergruppe, type FiltergruppenStand, type GespeicherterFilter } from './api';

/** `?view=all`: die Seite ohne ihre Vorgabe. */
export const ALLE = 'all';

@Injectable({ providedIn: 'root' })
export class Filtergruppen {
  private readonly api = inject(Api);
  private readonly _stand = signal<FiltergruppenStand | null>(null);
  private laeuft: Promise<void> | null = null;

  readonly stand = this._stand.asReadonly();
  /** Ob „für die Kampagne" angeboten wird — Anzeige, der Server prüft. */
  readonly darfKampagne = computed(() => this._stand()?.canManage ?? false);

  /** Die Gruppen einer Seite: die der Kampagne zuerst, dann die eigenen. */
  jeSeite(seite: string): Filtergruppe[] {
    return (this._stand()?.groups ?? []).filter((g) => g.page === seite);
  }

  vorgabe(seite: string): Filtergruppe | undefined {
    return this.jeSeite(seite).find((g) => g.default);
  }

  /** Die Gruppe, die auf dieser Seite gilt. */
  aktiv(seite: string, view: string | undefined): Filtergruppe | null {
    if (view === ALLE) return null;
    if (view) return this.jeSeite(seite).find((g) => g.id === view) ?? null;
    return this.vorgabe(seite) ?? null;
  }

  /** Einmal je Anmeldung; `neu` fragt trotzdem. Ein Fehler lässt die Seite ohne Gruppen. */
  laden(neu = false): Promise<void> {
    if (this.laeuft && !neu) return this.laeuft;
    this.laeuft = this.api
      .filters()
      .then((s) => this._stand.set(s))
      .catch(() => this._stand.set({ campaign: null, canManage: false, groups: [] }));
    return this.laeuft;
  }

  /** Nach dem Abmelden oder beim Wechsel der Sicht. */
  vergessen(): void {
    this.laeuft = null;
    this._stand.set(null);
  }

  async anlegen(g: {
    page: string;
    name: string;
    scope: 'campaign' | 'own';
    filter: GespeicherterFilter;
    default?: boolean;
  }): Promise<Filtergruppe> {
    const neu = await this.api.createFilter(g);
    await this.laden(true);
    return neu;
  }

  async aendern(
    id: string,
    g: { name?: string; filter?: GespeicherterFilter; default?: boolean },
  ): Promise<void> {
    await this.api.updateFilter(id, g);
    await this.laden(true);
  }

  async loeschen(id: string): Promise<void> {
    await this.api.deleteFilter(id);
    await this.laden(true);
  }
}

import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Api, type Mitglied, type TableRole } from './api';
import { Session } from './session';
import { Stapel } from './stapel';

/** Die Gruppen im Umschalter, in der Reihenfolge, in der man sucht. */
const ROLLEN: { role: TableRole; label: string }[] = [
  { role: 'player', label: 'Players' },
  { role: 'spectator', label: 'Spectators' },
  { role: 'co-gm', label: 'Co-GMs' },
  { role: 'gm', label: 'GMs' },
];

/**
 * **„View as" von überall** (T-269, REQ-241): wen die Leitung der
 * laufenden Kampagne einnehmen kann, und das Einnehmen selbst. Gesiebt
 * wird am Server mit dem Kopf `X-View-As` (`mayViewAs`, `viewedAs`) —
 * hier wird nichts nachgebaut, nur die Liste gehalten und gewechselt.
 *
 * Die Liste kommt von `GET /api/campaigns/:c/members` und nur, solange
 * man als man selbst schaut: in der Sicht einer Spielerin dürfte man sie
 * nicht lesen. Darum bleibt sie stehen, während man schaut — so wechselt
 * man direkt von einer Person zur nächsten.
 */
@Injectable({ providedIn: 'root' })
export class Sicht {
  private readonly api = inject(Api);
  private readonly session = inject(Session);
  private readonly stapel = inject(Stapel);
  private readonly router = inject(Router);

  private readonly _mitglieder = signal<{ kampagne: string; liste: Mitglied[] } | null>(null);
  private readonly _laedt = signal(false);
  readonly laedt = this._laedt.asReadonly();

  /** Ob der Umschalter da ist: in der Sicht immer (zurück), sonst für Leitung und Verwaltung. */
  readonly angeboten = computed(() => {
    if (this.session.viewAs()) return true;
    const k = this.stapel.laufend();
    if (!k) return false;
    return this.session.isAdmin() || k.role === 'gm' || k.role === 'co-gm';
  });

  /** Wen man einnehmen kann, nach Rolle; der Server sagt es je Mitglied (`viewAs`). */
  readonly gruppen = computed(() => {
    const m = this._mitglieder();
    const liste = (m?.liste ?? []).filter((p) => p.viewAs && !p.self && !p.disabled);
    return ROLLEN.map((r) => ({ ...r, leute: liste.filter((p) => p.role === r.role) })).filter((g) => g.leute.length);
  });

  /** Die Liste holen, wenn sie fehlt oder zu einer anderen Kampagne gehört. */
  async laden(): Promise<void> {
    const k = this.stapel.laufend();
    if (!k || this.session.viewAs() || this._laedt()) return;
    if (this._mitglieder()?.kampagne === k.id) return;
    this._laedt.set(true);
    try {
      const r = await this.api.members(k.id);
      this._mitglieder.set({ kampagne: k.id, liste: r.members });
    } catch {
      /* Ohne Recht keine Liste — der Umschalter zeigt dann nur „zurück". */
      this._mitglieder.set({ kampagne: k.id, liste: [] });
    } finally {
      this._laedt.set(false);
    }
  }

  /** Eine Person einnehmen; die Seite bleibt, ihre Daten kommen neu und gesiebt. */
  async einnehmen(p: Mitglied): Promise<void> {
    await this.session.viewAsUser(p.id);
  }

  /** Zurück zur eigenen Sicht — auf derselben Seite. */
  async verlassen(): Promise<void> {
    if (!this.session.viewAs()) return;
    await this.session.viewAsUser(null);
    /* Was die Seite eben noch in der fremden Sicht zeigte, kommt neu. */
    void this.router.navigateByUrl(this.router.url);
  }

  /** Die Figuren eines Mitglieds als Text: „Rook, Ash" — eine, die es als Artikel nicht mehr gibt, fällt weg. */
  figuren(p: Mitglied): string {
    return p.actors
      .map((a) => a.name)
      .filter((n): n is string => !!n)
      .join(', ');
  }
}

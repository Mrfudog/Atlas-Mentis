import { Injectable, computed, inject, signal } from '@angular/core';
import { Api, type Spieler } from './api';

/**
 * **Die Spieler der laufenden Kampagne** (T-100, E-007): für „Revealed
 * to" und „Hidden from". Wer einen Spieler wählt, wählt seine Figuren —
 * im Artikel steht ein Träger, nie ein Konto (REQ-199). Der Name des
 * Spielers steht nur daneben, damit man „Mia" findet, ohne zu wissen,
 * wie ihre Figur heisst.
 *
 * Geholt wird beim ersten Bedarf und nach einer Minute neu: wer gerade
 * eine Figur zugeteilt hat, soll sie in der nächsten Maske finden.
 */
@Injectable({ providedIn: 'root' })
export class SpielerListe {
  private readonly api = inject(Api);
  readonly liste = signal<Spieler[]>([]);
  private geholt = 0;
  private laeuft: Promise<void> | null = null;

  /** Figur-Id → Name ihres Spielers. */
  readonly vonFigur = computed(() => {
    const m = new Map<string, string>();
    for (const s of this.liste()) for (const a of s.actors) m.set(a.id, s.name);
    return m;
  });
  /** Figur-Id → Name der Figur — für einen Chip, dessen Artikel ihn nicht mitbrachte. */
  readonly figurName = computed(() => {
    const m = new Map<string, string>();
    for (const s of this.liste()) for (const a of s.actors) m.set(a.id, a.name);
    return m;
  });

  laden(): void {
    if (this.laeuft || Date.now() - this.geholt < 60_000) return;
    this.laeuft = this.api
      .players()
      .then((r) => {
        this.liste.set(r.players ?? []);
        this.geholt = Date.now();
      })
      .catch(() => {
        /* Ohne Liste bleibt die Auswahl, wie sie war: Figuren, Gruppen, Fraktionen. */
      })
      .finally(() => {
        this.laeuft = null;
      });
  }
}

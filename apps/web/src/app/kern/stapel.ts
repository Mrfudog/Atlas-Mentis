/**
 * **Die laufende Kampagne und ihr Stapel** (T-143) — was die Kopfleiste
 * zeigt: den Namen der Kampagne und wie viele Ebenen im Spiel sind. Einmal
 * je Anmeldung geholt (`GET /api/campaigns`, `current`) und neu, wenn sich
 * etwas daran ändert.
 *
 * `stand` zählt jede Änderung am Stapel. Listen, die gerechnet vom Server
 * kommen (das Kompendium), fragen dann neu — ein Häkchen im Popup, das die
 * Seite darunter nicht ändert, sähe aus, als hätte es nichts getan. Eine
 * Änderung an einem anderen Gerät kommt über den Live-Kanal (T-116): der
 * Artikel der Kampagne hat sich geändert, oder das Register (die
 * Einstellung `campaign`).
 *
 * **Vergleich in Listen** (T-213, `vergleich`): ein Schalter im Popup,
 * mit dem Kompendium, Bereiche und Suche auch die Artikel der
 * Vergleichsebenen zeigen — markiert „not in play", unter dem Blatt des
 * Spiels. Vorgabe aus; gemerkt je Browser (eine Ansichtsfrage, kein
 * Stand), und nur, wenn dieses Konto Vergleichsebenen sieht
 * (`laufend().compare`).
 *
 * Dazu die **Schreibebene** (T-161, `schreib`): wohin dieses Konto in der
 * laufenden Kampagne anlegt. Sie hängt am Stapel — fällt die gewählte
 * heraus, gilt die Vorgabe —, also wird sie mit ihm neu geholt.
 */

import { Injectable, computed, inject, signal } from '@angular/core';
import { Api, type KampagneKurz, type LaufendeKampagne, type Schreibstand } from './api';
import { Live } from './live';

const VERGLEICH_KEY = 'nw.compareInLists';
function gemerkt(): boolean {
  try {
    return localStorage.getItem(VERGLEICH_KEY) === '1';
  } catch {
    return false;
  }
}

@Injectable({ providedIn: 'root' })
export class Stapel {
  private readonly api = inject(Api);
  private readonly _laufend = signal<LaufendeKampagne | null>(null);
  private readonly _kampagnen = signal<KampagneKurz[]>([]);
  private readonly _verwaltung = signal(false);
  private readonly _stand = signal(0);
  private readonly _schreib = signal<Schreibstand | null>(null);
  private readonly _gerufen = signal(0);
  private readonly _vergleich = signal(gemerkt());
  private lauf = 0;
  /** Wann zuletzt hier selbst geschaltet wurde — das Echo im Live-Kanal zählt nicht doppelt. */
  private selbst = 0;

  readonly laufend = this._laufend.asReadonly();
  /** Die Kampagnen, die dieses Konto verwaltet oder leitet. */
  readonly kampagnen = this._kampagnen.asReadonly();
  /** Die Verwaltung wechselt die laufende Kampagne; sie gilt für alle. */
  readonly verwaltung = this._verwaltung.asReadonly();
  readonly stand = this._stand.asReadonly();
  /** Ob Listen die Artikel der Vergleichsebenen mitzeigen (T-213) — nur, wo es welche gibt. */
  readonly vergleich = computed(() => this._vergleich() && (this._laufend()?.compare ?? 0) > 0);
  /** Wohin ich anlege (T-161). */
  readonly schreib = this._schreib.asReadonly();
  /** Zählt, wie oft eine Seite das Popup verlangt hat (T-186, „Change layers"); der Knopf hört darauf. */
  readonly gerufen = this._gerufen.asReadonly();

  constructor() {
    const live = inject(Live);
    live.onArtikel((e) => {
      if (e.id !== this._laufend()?.id || Date.now() - this.selbst < 3000) return;
      void this.laden();
      this._stand.update((n) => n + 1);
    });
    live.onNeu((was) => {
      if (was !== 'registry' || !this._laufend()) return;
      const vorher = this._laufend()?.id;
      void this.laden().then(() => {
        if (this._laufend()?.id !== vorher) this._stand.update((n) => n + 1);
      });
    });
  }

  async laden(): Promise<void> {
    const nr = ++this.lauf;
    try {
      const [k, w] = await Promise.all([this.api.campaigns(), this.api.writeLayer().catch(() => null)]);
      if (nr !== this.lauf) return;
      this._laufend.set(k.current ?? null);
      this._kampagnen.set(k.campaigns.filter((c) => c.exists));
      this._verwaltung.set(k.isAdmin);
      this._schreib.set(w);
    } catch {
      /* Ohne Antwort bleibt die Anzeige weg — sie ist eine Auskunft, kein Zugang. */
      if (nr === this.lauf) {
        this._laufend.set(null);
        this._schreib.set(null);
      }
    }
  }

  /** Die Schreibebene wählen (`null`: die Vorgabe). Der Server prüft gegen die Zielebenen. */
  async schreibWaehlen(layer: string | null): Promise<void> {
    this._schreib.set(await this.api.setWriteLayer(layer));
  }

  /** Den Schalter „Show comparison articles in lists" setzen (T-213); Listen fragen neu. */
  vergleichSetzen(an: boolean): void {
    this._vergleich.set(an);
    try {
      if (an) localStorage.setItem(VERGLEICH_KEY, '1');
      else localStorage.removeItem(VERGLEICH_KEY);
    } catch {
      /* Ohne Speicher gilt der Schalter bis zum Neuladen. */
    }
    this._stand.update((n) => n + 1);
  }

  /** Das Popup der Kopfleiste öffnen — von einer Liste aus, die keinen eigenen Ebenenfilter mehr hat. */
  oeffnen(): void {
    this._gerufen.update((n) => n + 1);
  }

  /** Nach einem Häkchen hier: Zahl neu, Listen neu. */
  geaendert(): void {
    this.selbst = Date.now();
    this._stand.update((n) => n + 1);
    void this.laden();
  }

  async wechseln(id: string): Promise<void> {
    await this.api.setCurrentCampaign(id);
    this.geaendert();
  }

  vergessen(): void {
    this.lauf += 1;
    this._laufend.set(null);
    this._kampagnen.set([]);
    this._schreib.set(null);
  }
}

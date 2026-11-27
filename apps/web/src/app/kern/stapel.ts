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
 *
 * **Die Kampagne je Konto** (T-496, REQ-395): `wechseln` wählt sie für
 * dieses Konto, auf jedem Gerät, unter `kampagnen` (mit Rolle, für die
 * Verwaltung jede). Die Vorgabe der Installation (`vorgabe`) setzt nur die
 * Verwaltung (`vorgabeSetzen`); sie gilt für Konten ohne Wahl.
 *
 * **Die eigene Sicht** (REQ-396, `sicht`): enger filtern (Campaign view)
 * oder eigene Ebenen (My view), am Server gespeichert und gerechnet —
 * erst beim Öffnen des Popups geholt, denn die Liste der lesbaren Ebenen
 * ist gross und die Kopfleiste braucht nur die Zahl.
 */

import { Injectable, computed, inject, signal } from '@angular/core';
import { Api, type KampagneZurWahl, type LaufendeKampagne, type Schreibstand, type Sichtstand } from './api';
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
  private readonly _kampagnen = signal<KampagneZurWahl[]>([]);
  private readonly _vorgabe = signal<string | null>(null);
  private readonly _sicht = signal<Sichtstand | null>(null);
  private readonly _verwaltung = signal(false);
  private readonly _stand = signal(0);
  private readonly _schreib = signal<Schreibstand | null>(null);
  private readonly _gerufen = signal(0);
  private readonly _vergleich = signal(gemerkt());
  private lauf = 0;
  /** Wann zuletzt hier selbst geschaltet wurde — das Echo im Live-Kanal zählt nicht doppelt. */
  private selbst = 0;

  readonly laufend = this._laufend.asReadonly();
  /** Die Kampagnen, unter denen dieses Konto wählt (T-496): mit Rolle, für die Verwaltung jede. */
  readonly kampagnen = this._kampagnen.asReadonly();
  /** Die Vorgabe der Installation — für Konten ohne eigene Wahl. */
  readonly vorgabe = this._vorgabe.asReadonly();
  /** Die Verwaltung setzt die Vorgabe der Installation. */
  readonly verwaltung = this._verwaltung.asReadonly();
  /** Die eigene Sicht auf den Stapel (REQ-396), sobald das Popup sie geholt hat. */
  readonly sicht = this._sicht.asReadonly();
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
      this._kampagnen.set(k.choices ?? k.campaigns.filter((c) => c.exists).map(({ id, name, role }) => ({ id, name, role })));
      this._vorgabe.set(k.default ?? null);
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

  /** Die eigene Kampagne wählen (T-496); `null` folgt der Vorgabe. Nur dieses Konto wechselt. */
  async wechseln(id: string | null): Promise<void> {
    await this.api.setMyCampaign(id);
    this._sicht.set(null);
    this.geaendert();
  }

  /** Die Vorgabe der Installation setzen — nur die Verwaltung. */
  async vorgabeSetzen(id: string): Promise<void> {
    await this.api.setCurrentCampaign(id);
    this.geaendert();
  }

  /** Die eigene Sicht holen (beim Öffnen des Popups). */
  async sichtLaden(): Promise<Sichtstand> {
    const v = await this.api.myView();
    this._sicht.set(v);
    return v;
  }

  /** Die eigene Sicht setzen (REQ-396): Listen und Zahl folgen. */
  async sichtSetzen(view: { mode: 'campaign' | 'mine'; hide?: string[]; mine?: string[] }): Promise<void> {
    this._sicht.set(await this.api.setMyView(view));
    this.geaendert();
  }

  /** „Reset": die Vorgabe der Kampagne, ohne Ausgeblendetes. Die eigene Auswahl geht mit. */
  async sichtZuruecksetzen(): Promise<void> {
    await this.api.resetMyView();
    await this.sichtLaden();
    this.geaendert();
  }

  vergessen(): void {
    this.lauf += 1;
    this._laufend.set(null);
    this._kampagnen.set([]);
    this._schreib.set(null);
    this._sicht.set(null);
  }
}

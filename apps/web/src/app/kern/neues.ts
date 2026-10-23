/**
 * **Was neu ist** (T-157): die Einträge aus `src/whats-new.json` und der
 * Stand je Konto, was davon schon gesehen ist.
 *
 * Die Einträge liegen im Repo und kommen mit dem Bau in die Seite — dev
 * zeigt so, was auf `preprod` steht, die Produktion, was auf `main` steht,
 * ohne dass jemand es je Umgebung pflegt. Jeder Pull Request mit einer
 * sichtbaren Änderung ergänzt die Datei (CONTRIBUTING.md).
 *
 * **Gesehen wird am Konto gemerkt** (`/api/me/prefs`, Schlüssel
 * `whatsNew`), nicht im Browser: wer am Laptop nachgelesen hat, soll am
 * Tablet nicht wieder einen Punkt sehen. Gemerkt werden die Ids und nicht
 * ein Datum — ein Pull Request, der drei Tage offen lag, trägt das Datum
 * seines Eintrags und käme nach einem Datumsstand nie als neu an. Damit die
 * Liste nicht ohne Ende wächst, steht dazu eine Grenze (`until`): was davor
 * datiert ist, gilt als gesehen, und nur die Ids danach stehen in der Liste.
 *
 * **Gezeigt wird nur, was seit der Anlage des Kontos kam** (T-163): wer neu
 * dazukommt, braucht nicht die ganze Geschichte der Seite, sondern das, was
 * sich ab jetzt ändert. Das Datum kommt vom Server (`app_user.created_at`,
 * in `/api/me`); fehlt es, gilt alles. Die Verwaltung darf auf der Seite
 * trotzdem alles aufklappen.
 */

import { Injectable, computed, inject, signal } from '@angular/core';
import { Api } from './api';
import { Session } from './session';

/** Ein Eintrag, wie er in `whats-new.json` steht. */
export interface NeuEintrag {
  /** Fest, einmal vergeben: `YYYY-MM-DD-kurzname`. */
  id: string;
  /** Wann es auf `preprod` kam (`YYYY-MM-DD`). */
  date: string;
  title: string;
  /** Ein, zwei Sätze — was man jetzt tun kann, nicht wie es gebaut ist. */
  text: string;
  /** Der Bereich der Seite, frei: „Play", „Registry", „Navigation" … */
  area: string;
  /** Die Stelle in der App (ein Pfad der Routen), wenn es eine gibt. */
  link?: string;
  query?: Record<string, string>;
  /** Ein Bild unter `public/` (Pfad ab der Wurzel). */
  image?: string;
  /** Ein Schritt der Starttour (T-158), wenn der Eintrag einen hat. */
  tour?: string;
}

/** Der gemerkte Stand am Konto. */
export interface NeuStand {
  /** Was vor diesem Datum steht, gilt als gesehen. */
  until: string;
  /** Gesehene Einträge ab `until`. */
  seen: string[];
}

/** So weit zurück stehen Ids in der Liste; was älter ist, deckt `until`. */
const FENSTER_TAGE = 120;

/** Die Einträge, nachgeladen: die Datei wächst mit jedem Pull Request und
 *  gehört nicht ins Startpaket (Grenze in `angular.json`) — der Punkt in der
 *  Kopfleiste darf einen Augenblick später kommen. */
export async function eintraegeLaden(): Promise<readonly NeuEintrag[]> {
  const m = await import('../../whats-new.json');
  return ((m.default ?? m) as { entries: NeuEintrag[] }).entries;
}

/** Ist dieser Eintrag neu für diesen Stand? Ohne Stand ist alles neu. */
export function istNeu(e: NeuEintrag, stand: NeuStand | null): boolean {
  if (!stand) return true;
  return e.date >= stand.until && !stand.seen.includes(e.id);
}

/** Ab welchem Tag ein Konto Einträge sieht: der Tag seiner Anlage (T-163).
 *  Ohne gültiges Datum `null` — dann gilt alles. */
export function abKonto(createdAt: string | null | undefined): string | null {
  if (!createdAt) return null;
  const d = new Date(createdAt);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/** Die Einträge, die ein Konto angehen: ab dem Tag seiner Anlage. */
export function seitKonto(eintraege: readonly NeuEintrag[], ab: string | null): NeuEintrag[] {
  return ab ? eintraege.filter((e) => e.date >= ab) : [...eintraege];
}

/** Der Stand, nachdem alle diese Einträge gesehen sind. */
export function standNach(eintraege: readonly NeuEintrag[], heute = new Date()): NeuStand {
  const neuester = eintraege.reduce(
    (m, e) => (e.date > m ? e.date : m),
    heute.toISOString().slice(0, 10),
  );
  const grenze = new Date(`${neuester}T00:00:00Z`);
  grenze.setUTCDate(grenze.getUTCDate() - FENSTER_TAGE);
  const until = grenze.toISOString().slice(0, 10);
  return { until, seen: eintraege.filter((e) => e.date >= until).map((e) => e.id) };
}

/** Was am Konto steht, geprüft — ein kaputter Wert ist kein Stand. */
export function standAus(wert: unknown): NeuStand | null {
  if (!wert || typeof wert !== 'object') return null;
  const w = wert as Partial<NeuStand>;
  if (typeof w.until !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(w.until)) return null;
  return {
    until: w.until,
    seen: Array.isArray(w.seen) ? w.seen.filter((x): x is string => typeof x === 'string') : [],
  };
}

@Injectable({ providedIn: 'root' })
export class Neues {
  private readonly api = inject(Api);
  private readonly session = inject(Session);
  private readonly _stand = signal<NeuStand | null | undefined>(undefined);
  private fuer: string | null = null;
  private readonly _alle = signal<readonly NeuEintrag[]>([]);
  private geladen?: Promise<void>;

  /** Alle Einträge — die Verwaltung darf sie aufklappen. Leer, bis
   *  `eintraegeHolen()` sie gebracht hat. */
  readonly alle = this._alle.asReadonly();
  /** Seit wann dieses Konto Einträge sieht (T-163). */
  readonly ab = computed(() => abKonto(this.session.user()?.createdAt));
  /** Was dieses Konto angeht: seit seiner Anlage. */
  readonly eintraege = computed(() => seitKonto(this._alle(), this.ab()));
  /** Wie viele Einträge neu sind; 0, solange der Stand nicht da ist — ein
   *  Punkt, der beim Laden aufblitzt, ist ein falscher Alarm. */
  readonly anzahl = computed(() => {
    const s = this._stand();
    return s === undefined ? 0 : this.eintraege().filter((e) => istNeu(e, s)).length;
  });

  /** Die Einträge holen — einmal; wer sie braucht, wartet darauf. */
  eintraegeHolen(): Promise<void> {
    return (this.geladen ??= eintraegeLaden().then(
      (e) => this._alle.set(e),
      () => {
        /* Ohne Datei keine Einträge — beim nächsten Mal wieder versuchen. */
        this.geladen = undefined;
      },
    ));
  }

  /** Den Stand dieses Kontos holen — einmal je Konto. */
  async laden(): Promise<void> {
    void this.eintraegeHolen();
    const wer = this.session.user()?.id ?? null;
    if (!wer || this.fuer === wer) return;
    this.fuer = wer;
    try {
      this._stand.set(standAus((await this.api.prefs())['whatsNew']));
    } catch {
      /* Ohne Antwort kein Punkt: lieber nichts melden als alles. */
      this.fuer = null;
    }
  }

  vergessen(): void {
    this.fuer = null;
    this._stand.set(undefined);
  }

  /** Was beim Öffnen der Seite neu war — die Seite merkt es sich, bevor
   *  `gesehen()` den Stand weiterschiebt. */
  neuJetzt(): Set<string> {
    const s = this._stand();
    return new Set(
      s === undefined ? [] : this.eintraege().filter((e) => istNeu(e, s)).map((e) => e.id),
    );
  }

  /** Alles gesehen. In der Sicht eines Mitglieds (REQ-241) nicht — dort
   *  liest man mit fremden Augen und schreibt nichts. */
  async gesehen(): Promise<void> {
    if (this.session.viewAs() || !this.session.user()) return;
    /* Über alle Einträge: was vor der Anlage lag, gilt damit auch als
       gesehen, falls die Verwaltung es später aufklappt. */
    await this.eintraegeHolen();
    const stand = standNach(this._alle());
    this._stand.set(stand);
    try {
      await this.api.setPref('whatsNew', stand);
    } catch {
      /* Dann kommt der Punkt beim nächsten Laden wieder — kein Verlust. */
    }
  }
}

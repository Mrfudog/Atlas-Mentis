/**
 * **Zeitfenster für die Übersichten** (T-382): „kürzlich hinzugefügt",
 * „kürzlich geändert". In der Adresse steht ein Wort, damit ein geteilter
 * Link morgen dasselbe meint wie heute: `today`, `7d`, `30d` (jede Zahl
 * mit `d`) oder ein Zeitraum `2026-10-01..2026-10-22` (eine Seite darf
 * fehlen). Gerechnet wird beim Lesen gegen die Uhr des Servers und die
 * Zeitzone des Browsers (`tz`, Minuten wie `Date.getTimezoneOffset`) —
 * „heute" beginnt in Zürich um Mitternacht, nicht um zwei Uhr.
 *
 * Gespeichert wird nichts davon (D8): die Zeiten stehen am Artikel
 * (`createdAt`, `updatedAt`), das Fenster ist eine Frage an sie.
 */

/** Ein Fenster: ab `from` (eingeschlossen), bis vor `to` (ausgeschlossen), als ISO-Zeit. */
export interface TimeWindow {
  from?: string;
  to?: string;
}

/** Die vorgeschlagenen Fenster der Seitenleiste. */
export const TIME_WINDOWS = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
] as const;

const TAG = 24 * 60 * 60 * 1000;
const DATUM = /^\d{4}-\d{2}-\d{2}$/;

/** Mitternacht dieses Tages in der Zeitzone des Browsers, als Zeitpunkt. */
function mitternacht(datum: string, tz: number): number | null {
  if (!DATUM.test(datum)) return null;
  const t = Date.parse(`${datum}T00:00:00Z`);
  return Number.isNaN(t) ? null : t + tz * 60 * 1000;
}

/**
 * Das Wort aus der Adresse als Fenster; `null` bei Unsinn — dann filtert
 * die Liste nicht, statt still nichts zu zeigen.
 */
export function parseTimeWindow(wort: string | undefined | null, now: Date = new Date(), tz = 0): TimeWindow | null {
  const w = (wort ?? '').trim();
  if (!w) return null;
  const versatz = Number.isFinite(tz) ? Math.max(-14 * 60, Math.min(14 * 60, tz)) : 0;
  /* Der heutige Tag in der Zeitzone des Browsers. */
  const lokal = new Date(now.getTime() - versatz * 60 * 1000).toISOString().slice(0, 10);
  const heute = mitternacht(lokal, versatz)!;
  if (w === 'today') return { from: new Date(heute).toISOString() };
  const tage = /^(\d{1,4})d$/.exec(w);
  if (tage) {
    const n = Number(tage[1]);
    if (n < 1) return null;
    /* „Letzte 7 Tage" heisst heute und die sechs davor. */
    return { from: new Date(heute - (n - 1) * TAG).toISOString() };
  }
  const spanne = /^(\d{4}-\d{2}-\d{2})?\.\.(\d{4}-\d{2}-\d{2})?$/.exec(w);
  if (spanne && (spanne[1] || spanne[2])) {
    const von = spanne[1] ? mitternacht(spanne[1], versatz) : null;
    /* Das Ende nennt den letzten Tag, der noch zählt. */
    const bis = spanne[2] ? mitternacht(spanne[2], versatz) : null;
    if ((spanne[1] && von === null) || (spanne[2] && bis === null)) return null;
    if (von !== null && bis !== null && bis < von) return null;
    return {
      ...(von !== null ? { from: new Date(von).toISOString() } : {}),
      ...(bis !== null ? { to: new Date(bis + TAG).toISOString() } : {}),
    };
  }
  return null;
}

/** Liegt dieser Zeitpunkt im Fenster? Ohne Zeitpunkt nie — ein Artikel ohne Datum ist nicht „kürzlich". */
export function inTimeWindow(zeit: string | undefined | null, fenster: TimeWindow): boolean {
  if (!zeit) return false;
  const t = Date.parse(zeit);
  if (Number.isNaN(t)) return false;
  if (fenster.from && t < Date.parse(fenster.from)) return false;
  if (fenster.to && t >= Date.parse(fenster.to)) return false;
  return true;
}

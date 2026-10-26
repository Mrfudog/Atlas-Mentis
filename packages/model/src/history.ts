/**
 * **Ein Verlauf zum Rückgängigmachen** (T-425, REQ-436, E-171): ein Muster
 * für jede Leiste — der Designer hält darin Stände seines Baums, eine
 * Karte könnte Zeichenschritte halten. Er weiss nichts von dem, was er
 * hält, und rechnet nur: was vorher war (`past`), was nach einem
 * Rückgängig wiederholt werden kann (`future`).
 *
 * Gespeichert wird nichts: der Verlauf lebt im Entwurf, bis „Save" ihn
 * schreibt oder die Seite geht.
 */

/** Wie viele Schritte zurück gehen — danach fällt der älteste weg. */
export const HISTORY_LIMIT = 100;

export interface History<T> {
  past: readonly T[];
  future: readonly T[];
}

export function emptyHistory<T>(): History<T> {
  return { past: [], future: [] };
}

/** Den Stand **vor** einer Änderung merken; was wiederholbar war, gilt dann nicht mehr. */
export function historyPush<T>(h: History<T>, before: T): History<T> {
  const past = [...h.past, before];
  return { past: past.length > HISTORY_LIMIT ? past.slice(past.length - HISTORY_LIMIT) : past, future: [] };
}

/** Einen Schritt zurück: der vorige Stand, und der jetzige wird wiederholbar. `null`, wenn es keinen gibt. */
export function historyUndo<T>(h: History<T>, current: T): { history: History<T>; state: T } | null {
  if (!h.past.length) return null;
  const state = h.past[h.past.length - 1]!;
  return { history: { past: h.past.slice(0, -1), future: [current, ...h.future] }, state };
}

/** Einen Schritt wieder vor. `null`, wenn nichts rückgängig gemacht wurde. */
export function historyRedo<T>(h: History<T>, current: T): { history: History<T>; state: T } | null {
  if (!h.future.length) return null;
  const [state, ...rest] = h.future as [T, ...T[]];
  return { history: { past: [...h.past, current], future: rest }, state };
}

/**
 * **Wo die Zeit einer Anfrage bleibt** (T-398, P8 in docs/Performance.md).
 *
 * `Server-Timing: app;dur=9128` sagte auf dev nur, dass ein Artikel neun
 * Sekunden brauchte, nicht wofür. Je Anfrage sammelt ein
 * `AsyncLocalStorage` die Abschnitte (`messe`) und die Aufrufe des
 * Repositorys (`mitZeitmessung`), und der Kopf nennt sie mit Zeit und Zahl:
 * `app;dur=…, db;dur=…;desc="12×", sieb;dur=…`. Keine Inhalte, keine Ids —
 * nur Namen der Abschnitte, die im Code stehen.
 *
 * Gemessen wird Wandzeit: wartet eine Anfrage, weil eine andere den Thread
 * hat, zählt das Warten mit. Das ist gewollt — es ist die Zeit, die der
 * Betrachter sieht —, und `db` gegen `app` zeigt, ob es die Datenbank war.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import type { Repository } from './repo.js';

type Zeiten = Map<string, { ms: number; n: number }>;

const speicher = new AsyncLocalStorage<Zeiten>();

/** Eine Anfrage in ihrem eigenen Speicher laufen lassen (aus dem `onRequest`-Haken, mit `done`). */
export function mitZeiten(weiter: () => void): void {
  speicher.run(new Map(), weiter);
}

function buche(name: string, ms: number): void {
  const z = speicher.getStore();
  if (!z) return;
  const da = z.get(name);
  if (da) {
    da.ms += ms;
    da.n += 1;
  } else z.set(name, { ms, n: 1 });
}

/** Einen Abschnitt messen. Ausserhalb einer Anfrage (Live-Kanal, Start) zählt nichts. */
export async function messe<T>(name: string, fn: () => Promise<T>): Promise<T> {
  if (!speicher.getStore()) return fn();
  const t0 = performance.now();
  try {
    return await fn();
  } finally {
    buche(name, performance.now() - t0);
  }
}

/** Dasselbe für einen Abschnitt, der nicht wartet (Rechnen über den Bestand). */
export function messeSync<T>(name: string, fn: () => T): T {
  if (!speicher.getStore()) return fn();
  const t0 = performance.now();
  try {
    return fn();
  } finally {
    buche(name, performance.now() - t0);
  }
}

/**
 * Das Repository mit Stoppuhr: jede asynchrone Methode zählt unter `db`.
 * Ein Proxy, damit eine neue Methode ohne Zutun mitgemessen wird.
 */
export function mitZeitmessung(repo: Repository): Repository {
  const gebunden = new Map<PropertyKey, unknown>();
  return new Proxy(repo, {
    get(target, prop) {
      const v: unknown = Reflect.get(target, prop, target);
      if (typeof v !== 'function') return v;
      let f = gebunden.get(prop);
      if (!f) {
        const roh = (v as (...a: unknown[]) => unknown).bind(target);
        f = (...a: unknown[]) => {
          const r = roh(...a);
          if (!(r instanceof Promise) || !speicher.getStore()) return r;
          const t0 = performance.now();
          return r.finally(() => buche('db', performance.now() - t0));
        };
        gebunden.set(prop, f);
      }
      return f;
    },
  });
}

/** Die Abschnitte als `Server-Timing`-Einträge, nach `app`. */
export function zeitenKopf(appMs: number): string {
  const teile = [`app;dur=${appMs.toFixed(1)}`];
  for (const [name, { ms, n }] of speicher.getStore() ?? []) teile.push(`${name};dur=${ms.toFixed(1)};desc="${n}x"`);
  return teile.join(', ');
}

/** `Server-Timing` lesen — für Tests und das Messscript. */
export function zeitenAus(kopf: string): Record<string, { dur: number; n: number }> {
  const aus: Record<string, { dur: number; n: number }> = {};
  for (const teil of kopf.split(',')) {
    const [name, ...rest] = teil.trim().split(';');
    if (!name) continue;
    const dur = Number(/dur=([\d.]+)/.exec(rest.join(';'))?.[1] ?? NaN);
    const n = Number(/desc="(\d+)x"/.exec(rest.join(';'))?.[1] ?? 1);
    aus[name] = { dur, n };
  }
  return aus;
}

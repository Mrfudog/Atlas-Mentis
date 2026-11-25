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

/** Je Anfrage: die Zeiten und, was `mitAnfrageSpeicher` sich gemerkt hat. */
const speicher = new AsyncLocalStorage<{ zeiten: Zeiten; merk: Map<PropertyKey, Promise<unknown>> }>();

/** Eine Anfrage in ihrem eigenen Speicher laufen lassen (aus dem `onRequest`-Haken, mit `done`). */
export function mitZeiten(weiter: () => void): void {
  speicher.run({ zeiten: new Map(), merk: new Map() }, weiter);
}

function buche(name: string, ms: number): void {
  const z = speicher.getStore()?.zeiten;
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

/** Was je Anfrage gemerkt wird: lesend, ohne Argumente, und von vielen Stellen gefragt. */
const MERKBAR = new Set<PropertyKey>(['getRegistry', 'version', 'layerGrants', 'listUsers']);
/** Was das Gemerkte stehen lässt: nur Lesendes. Alles andere könnte schreiben. */
const LESEND = /^(get|list|count|find|version|entityMap|mitEbenen|usersOf|authorsOf|authoredArticles|creators|layerGrants|readyStands|readingPosition)/;

/**
 * **Je Anfrage einmal fragen** (T-398, P2 am Server): eine Artikelanfrage
 * fragte das Register elfmal, den Stempel und die Ebenenzuteilungen
 * achtmal — am Postgres sind das für das Register je acht Abfragen. Was in
 * `MERKBAR` steht, gilt darum für die Dauer einer Anfrage einmal. Jeder
 * Aufruf, der nicht lesend heisst, leert das Gemerkte: wer schreibt und
 * danach liest, liest den neuen Stand. Ausserhalb einer Anfrage (Live-Kanal,
 * Start) wird nichts gemerkt.
 */
export function mitAnfrageSpeicher(repo: Repository): Repository {
  const gebunden = new Map<PropertyKey, unknown>();
  return new Proxy(repo, {
    get(target, prop) {
      const v: unknown = Reflect.get(target, prop, target);
      if (typeof v !== 'function') return v;
      let f = gebunden.get(prop);
      if (!f) {
        const roh = (v as (...a: unknown[]) => unknown).bind(target);
        const merkbar = MERKBAR.has(prop);
        const lesend = typeof prop === 'string' && LESEND.test(prop);
        f = (...a: unknown[]) => {
          const merk = speicher.getStore()?.merk;
          if (!merk) return roh(...a);
          if (!lesend) {
            /* Vorher und nachher: was neben dem Schreiben gelesen wurde, kann
               den alten Stand halten. */
            merk.clear();
            const w = roh(...a);
            if (w instanceof Promise) void w.then(() => merk.clear(), () => merk.clear());
            return w;
          }
          if (!merkbar || a.length) return roh(...a);
          const da = merk.get(prop);
          if (da) return da;
          const r = roh();
          if (!(r instanceof Promise)) return r;
          /* Ein Fehler wird nicht gemerkt: der nächste fragt neu. */
          merk.set(prop, r);
          r.catch(() => merk.get(prop) === r && merk.delete(prop));
          return r;
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
  for (const [name, { ms, n }] of speicher.getStore()?.zeiten ?? []) teile.push(`${name};dur=${ms.toFixed(1)};desc="${n}x"`);
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

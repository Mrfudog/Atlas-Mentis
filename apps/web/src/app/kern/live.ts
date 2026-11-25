/**
 * **Der Live-Kanal im Browser** (T-116, REQ-116): was sich am Server
 * ändert, kommt hier an, ohne dass jemand neu lädt — auf dem Beamer, dem
 * Laptop und den Telefonen derselben Runde.
 *
 * Eine Komponente meldet sich an, worauf sie hört — **ein Artikel oder eine
 * Kante hat sich geändert** (`onArtikel`), **eine Sitzung zeigt etwas
 * anderes** (`onSitzung`), **alles neu** (`onNeu`) — und weiss nicht, wie
 * es herkommt. Heute sind es Server-Sent Events (`GET /api/live`); der
 * Transport steht hinter `LIVE_TRANSPORT` und ist in Tests ein Stück
 * Speicher.
 *
 * Was ankommt, ist schon gesiebt: der Server schickt jedem nur, was er
 * sieht (`articleVisible`), und nur die Id — den Artikel holt man wie
 * immer, gesiebt (`redactEntity`). Eine zweite Prüfung hier lüde nur dazu
 * ein, die erste wegzulassen.
 */

import { DestroyRef, Injectable, InjectionToken, effect, inject, signal } from '@angular/core';
import { Session } from './session';
import type { RollEntry } from '@nw/model';

/** Ein Artikel hat sich geändert (`changed`) oder ist für diesen Betrachter
 *  nicht mehr da (`gone` — verborgen oder gelöscht). Eine Kante gehört zu
 *  dem Artikel, an dem sie steht: ein Token auf der Karte ist eine Kante
 *  der Karte. */
export interface ArtikelEreignis {
  kind: 'changed' | 'gone';
  id: string;
  type?: string;
  revision?: number | null;
}

/** Was in einer Sitzung gerade läuft (`Session.activeMap` …). */
export interface SitzungsZustand {
  id: string;
  activeMap: string | null;
  activeEncounter: string | null;
  activeScene: string | null;
  nowPlaying: string | null;
}

/** Wie es um die Verbindung steht. */
export type LiveStand = 'aus' | 'verbindet' | 'offen';

/** Was ein Transport meldet. */
export interface LiveEmpfang {
  ereignis(name: string, data: unknown): void;
  stand(s: LiveStand): void;
}

/** Ein Transport öffnet eine Verbindung und gibt das Schliessen zurück. */
export type LiveTransport = (empfang: LiveEmpfang) => () => void;

/** Wann der Transport eine Verbindung für tot hält (T-399). */
export interface SseWache {
  /** So lange ohne jedes Ereignis — auch ohne `ping` —, und es wird neu verbunden (ms). */
  stillMs?: number;
  /** Kommt die Seite zurück (sichtbar, wieder online) und war so lange still, sofort neu (ms). */
  zurueckMs?: number;
  /** Wie oft nachgesehen wird (ms). */
  pruefMs?: number;
}

/**
 * **Server-Sent Events** (`EventSource`). Der Browser verbindet selbst
 * wieder und schickt dabei `Last-Event-ID`; gibt er auf (der Server sagte
 * 401 oder 503 beim Start), wird hier nach einer Pause neu verbunden —
 * mit `?since=`, weil ein neues `EventSource` den Kopf nicht setzen kann.
 *
 * **Eine still tote Verbindung** (T-399, REQ-398 Akzeptanz 2): ein Telefon,
 * das schlief oder das Netz wechselte, hält oft eine Verbindung, die nichts
 * mehr bringt und keinen Fehler meldet. Der Server schickt darum alle 25 s
 * ein `ping`; bleibt `stillMs` lang alles aus, oder kommt die Seite nach
 * `zurueckMs` Stille wieder in den Blick oder ins Netz, verbindet der
 * Transport selbst neu — mit `?since=`, also kommt nach, was dazwischen
 * geschah.
 */
export function sseTransport(url = '/api/live', wache: SseWache = {}): LiveTransport {
  const stillMs = wache.stillMs ?? 60_000;
  const zurueckMs = wache.zurueckMs ?? 30_000;
  const pruefMs = wache.pruefMs ?? 5_000;
  return (empfang) => {
    if (typeof EventSource === 'undefined') return () => undefined;
    let quelle: EventSource | null = null;
    let letzte = '';
    let pause = 1000;
    let uhr: ReturnType<typeof setTimeout> | null = null;
    let zu = false;
    let zuletzt = Date.now();
    const NAMEN = ['hello', 'entity', 'gone', 'session', 'registry', 'reset', 'roll', 'plan'];

    const oeffne = (): void => {
      if (zu) return;
      empfang.stand('verbindet');
      zuletzt = Date.now();
      quelle = new EventSource(letzte ? `${url}?since=${encodeURIComponent(letzte)}` : url, { withCredentials: true });
      quelle.onopen = () => {
        pause = 1000;
        zuletzt = Date.now();
        empfang.stand('offen');
      };
      quelle.onerror = () => {
        if (zu || !quelle) return;
        if (quelle.readyState === EventSource.CLOSED) {
          /* Aufgegeben — neu, mit wachsender Pause bis eine halbe Minute. */
          quelle = null;
          empfang.stand('verbindet');
          uhr = setTimeout(oeffne, pause);
          pause = Math.min(pause * 2, 30_000);
        } else {
          empfang.stand('verbindet');
        }
      };
      quelle.addEventListener('ping', () => {
        zuletzt = Date.now();
      });
      for (const name of NAMEN) {
        quelle.addEventListener(name, (ev) => {
          const m = ev as MessageEvent<string>;
          zuletzt = Date.now();
          if (m.lastEventId) letzte = m.lastEventId;
          try {
            empfang.ereignis(name, JSON.parse(m.data));
          } catch {
            /* Unlesbares überspringen. */
          }
        });
      }
    };
    /** Die alte Verbindung zu, eine neue auf — ab dem, was zuletzt kam. */
    const neu = (): void => {
      if (zu || !quelle) return;
      quelle.close();
      quelle = null;
      oeffne();
    };
    const wach = setInterval(() => {
      if (Date.now() - zuletzt > stillMs) neu();
    }, pruefMs);
    const zurueck = (): void => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (Date.now() - zuletzt > zurueckMs) neu();
    };
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', zurueck);
    if (typeof window !== 'undefined') window.addEventListener('online', zurueck);
    oeffne();
    return () => {
      zu = true;
      if (uhr) clearTimeout(uhr);
      clearInterval(wach);
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', zurueck);
      if (typeof window !== 'undefined') window.removeEventListener('online', zurueck);
      quelle?.close();
      quelle = null;
      empfang.stand('aus');
    };
  };
}

/** Welcher Transport gilt — in Tests ein anderer. */
export const LIVE_TRANSPORT = new InjectionToken<LiveTransport>('LIVE_TRANSPORT', {
  providedIn: 'root',
  factory: () => sseTransport(),
});

type Hoerer<T> = Set<(x: T) => void>;

@Injectable({ providedIn: 'root' })
export class Live {
  private readonly session = inject(Session);
  private readonly transport = inject(LIVE_TRANSPORT);

  private readonly _stand = signal<LiveStand>('aus');
  /** Wie es um die Verbindung steht. */
  readonly stand = this._stand.asReadonly();

  private readonly _sitzungen = signal<ReadonlyMap<string, SitzungsZustand>>(new Map());
  /** Was in jeder Sitzung läuft, von der ein Ereignis kam — Play folgt
   *  daraus `activeMap` und `activeEncounter`. Wer beim Öffnen schon den
   *  Stand braucht, liest ihn aus dem Artikel; hier steht, was sich seither
   *  änderte. */
  readonly sitzungen = this._sitzungen.asReadonly();

  private readonly artikelHoerer: Hoerer<ArtikelEreignis> = new Set();
  private readonly sitzungsHoerer: Hoerer<SitzungsZustand> = new Set();
  private readonly neuHoerer: Hoerer<'reset' | 'registry'> = new Set();
  private readonly wurfHoerer: Hoerer<RollEntry> = new Set();
  private readonly planHoerer: Hoerer<string> = new Set();
  private schliessen: (() => void) | null = null;

  constructor() {
    /* Verbunden ist, wer angemeldet ist — und nur so lange. */
    effect(() => {
      const an = this.session.stand() === 'bereit' && this.session.angemeldet();
      if (an) this.start();
      else this.stop();
    });
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  /** Auf geänderte Artikel und Kanten hören. Gibt das Abmelden zurück. */
  onArtikel(fn: (e: ArtikelEreignis) => void): () => void {
    return anmelden(this.artikelHoerer, fn);
  }
  /** Auf den Sitzungszustand hören (`activeMap`, `activeEncounter` …). */
  onSitzung(fn: (z: SitzungsZustand) => void): () => void {
    return anmelden(this.sitzungsHoerer, fn);
  }
  /** Auf Würfe hören (T-172) — nur die, die dieser Betrachter sieht. */
  onWurf(fn: (w: RollEntry) => void): () => void {
    return anmelden(this.wurfHoerer, fn);
  }
  /** Auf Zugpläne hören (T-198): die Id der Karte, auf der sich einer änderte. */
  onPlan(fn: (karte: string) => void): () => void {
    return anmelden(this.planHoerer, fn);
  }
  /** Alles neu (`reset`: zu viel auf einmal, oder etwas verpasst) oder das Register. */
  onNeu(fn: (was: 'reset' | 'registry') => void): () => void {
    return anmelden(this.neuHoerer, fn);
  }

  private start(): void {
    if (this.schliessen) return;
    this.schliessen = this.transport({
      stand: (s) => this._stand.set(s),
      ereignis: (name, data) => this.verteile(name, data),
    });
  }

  private stop(): void {
    this.schliessen?.();
    this.schliessen = null;
    this._stand.set('aus');
    this._sitzungen.set(new Map());
  }

  /** Ein Ereignis an die verteilen, die darauf hören. Öffentlich für Tests. */
  verteile(name: string, data: unknown): void {
    const d = (data ?? {}) as Record<string, unknown>;
    const id = typeof d['id'] === 'string' ? d['id'] : '';
    switch (name) {
      case 'entity':
        if (id) rufe(this.artikelHoerer, { kind: 'changed', id, type: String(d['type'] ?? ''), revision: (d['revision'] as number | null) ?? null });
        break;
      case 'gone':
        if (id) rufe(this.artikelHoerer, { kind: 'gone', id });
        break;
      case 'session': {
        if (!id) break;
        const s = (k: string): string | null => (typeof d[k] === 'string' ? (d[k] as string) : null);
        const z: SitzungsZustand = {
          id,
          activeMap: s('activeMap'),
          activeEncounter: s('activeEncounter'),
          activeScene: s('activeScene'),
          nowPlaying: s('nowPlaying'),
        };
        this._sitzungen.update((m) => new Map(m).set(id, z));
        rufe(this.sitzungsHoerer, z);
        break;
      }
      case 'roll':
        if (id) rufe(this.wurfHoerer, d as unknown as RollEntry);
        break;
      case 'plan':
        if (id) rufe(this.planHoerer, id);
        break;
      case 'reset':
      case 'registry':
        rufe(this.neuHoerer, name);
        break;
    }
  }
}

function anmelden<T>(menge: Hoerer<T>, fn: (x: T) => void): () => void {
  menge.add(fn);
  return () => menge.delete(fn);
}

function rufe<T>(menge: Hoerer<T>, x: T): void {
  for (const fn of [...menge]) {
    try {
      fn(x);
    } catch (error) {
      console.error('live:', error);
    }
  }
}

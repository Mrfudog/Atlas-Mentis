/**
 * **Der Live-Kanal** (T-116, REQ-116): was sich am Bestand ändert, geht an
 * jedes offene Gerät — Beamer, Laptop, Telefone —, ohne dass jemand neu
 * lädt.
 *
 * Hier steht nur die **Quelle**: wer schreibt, meldet es (`mitKanal` legt
 * sich dafür um das `Repository`, so sieht jede Route und jedes Modul es,
 * ohne dass eines daran denken muss), und wer zuhört, bekommt die Meldungen
 * gebündelt. Was davon an wen geht, entscheidet die Route (`app.ts`,
 * `GET /api/live`) je Empfänger mit derselben Rechnung wie jede andere
 * Route — **der Kanal ist kein Umweg an der Sichtbarkeit vorbei**. Eine
 * Meldung trägt darum nur die Id: was im Artikel steht, holt das Gerät
 * über `GET /api/entities/:id`, gesiebt wie immer.
 *
 * Heute läuft ein Serverprozess, und die Quelle ist sein Speicher. Laufen
 * einmal mehrere, kommt eine zweite Umsetzung derselben Schnittstelle
 * (`ChangeFeed`) dazu, die über Postgres `LISTEN/NOTIFY` verteilt — die
 * Route merkt davon nichts.
 */

import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { primaryInterface } from '@nw/model';
import type { Entity, Registry } from '@nw/model';
import type { PutOptions, Repository } from './repo.js';
import type { User } from './auth.js';

/** Eine Meldung im Kanal. `seq` zählt je Serverprozess hoch. */
export type LiveEintrag =
  | {
      seq: number;
      kind: 'entity';
      id: string;
      /** Gelöscht. */
      deleted?: boolean;
      /** Wie er vorher war — damit ein Gerät erfährt, dass ein Artikel,
       *  den es sah, jetzt verborgen oder weg ist. Nur, wenn jemand
       *  zuhört; sonst wäre es ein Lesen je Schreiben für niemanden. */
      before?: Entity | undefined;
    }
  | { seq: number; kind: 'registry'; id: string }
  /** Zu viel auf einmal (eine Einfuhr, eine Massenänderung): alles neu. */
  | { seq: number; kind: 'reset'; id: '' };

type OhneSeq<T> = T extends unknown ? Omit<T, 'seq'> : never;
export type LiveMeldung = OhneSeq<LiveEintrag>;

/**
 * Die Schnittstelle der Quelle. `boot` unterscheidet die Zählung eines
 * Prozesses von der des nächsten: wer nach einem Neustart mit einer alten
 * Nummer kommt, bekommt `reset` statt einer Lücke.
 */
export interface ChangeFeed {
  readonly boot: string;
  publish(meldung: LiveMeldung): void;
  /** Gebündelte Meldungen, in Reihenfolge. Gibt das Abmelden zurück. */
  subscribe(fn: (buendel: LiveEintrag[]) => void): () => void;
  /** Alles nach `seq` — oder `null`, wenn das nicht mehr vorliegt. */
  since(seq: number): LiveEintrag[] | null;
  /** Die letzte vergebene Nummer. */
  last(): number;
  /** Hört jemand zu? */
  listening(): boolean;
}

export interface LocalFeedOptions {
  /** Wie lange gesammelt wird, bevor ein Bündel hinausgeht (ms). */
  flushMs?: number;
  /** Wie viele Meldungen zum Nachholen vorgehalten werden. */
  keep?: number;
  /** Ab so vielen Artikeln in einem Bündel geht `reset` statt Einzelner. */
  flood?: number;
}

/**
 * Die Quelle im Speicher eines Prozesses. Meldungen werden kurz gesammelt
 * (`flushMs`) und je Artikel zusammengelegt: eine Route, die einen Artikel
 * und seinen Statblock schreibt, gibt ein Bündel und nicht zwei Runden
 * Sieben. Wer mit `Last-Event-ID` wiederkommt, bekommt nach, was er
 * verpasst hat, solange es im Ring liegt.
 */
export class LocalChangeFeed implements ChangeFeed {
  readonly boot = randomUUID().slice(0, 8);
  private seq = 0;
  private readonly ring: LiveEintrag[] = [];
  private offen: LiveEintrag[] = [];
  private uhr: ReturnType<typeof setTimeout> | null = null;
  private readonly hoerer = new Set<(b: LiveEintrag[]) => void>();
  private readonly flushMs: number;
  private readonly keep: number;
  private readonly flood: number;

  constructor(options: LocalFeedOptions = {}) {
    this.flushMs = options.flushMs ?? 50;
    this.keep = options.keep ?? 1000;
    this.flood = options.flood ?? 200;
  }

  publish(meldung: LiveMeldung): void {
    /* Ohne Zuhörer wird trotzdem gezählt und vorgehalten: ein Telefon,
       das gerade die Verbindung verloren hat, hört in dem Augenblick
       nicht zu und will es nachher wissen. */
    this.offen.push({ ...meldung, seq: 0 } as LiveEintrag);
    this.uhr ??= setTimeout(() => this.flush(), this.flushMs);
  }

  /** Sofort hinaus, was gesammelt ist — für Tests und beim Schliessen. */
  flush(): void {
    if (this.uhr) clearTimeout(this.uhr);
    this.uhr = null;
    if (!this.offen.length) return;
    const roh = this.offen;
    this.offen = [];
    /* Je Artikel die letzte Meldung, mit dem ersten Vorher: wer ihn vor
       dem Bündel sah, soll erfahren, wenn er danach verborgen ist. */
    const je = new Map<string, LiveMeldung>();
    for (const m of roh) {
      const key = `${m.kind}:${m.id}`;
      const vorher = je.get(key);
      if (vorher?.kind === 'entity' && m.kind === 'entity') {
        je.delete(key);
        je.set(key, { ...m, before: vorher.before ?? m.before });
      } else {
        je.delete(key);
        je.set(key, m);
      }
    }
    const artikel = [...je.values()].filter((m) => m.kind === 'entity').length;
    const meldungen: LiveMeldung[] = artikel > this.flood
      ? [{ kind: 'reset', id: '' }, ...[...je.values()].filter((m) => m.kind === 'registry')]
      : [...je.values()];
    const buendel = meldungen.map((m) => ({ ...m, seq: ++this.seq }) as LiveEintrag);
    this.ring.push(...buendel);
    if (this.ring.length > this.keep) this.ring.splice(0, this.ring.length - this.keep);
    for (const h of [...this.hoerer]) {
      try {
        h(buendel);
      } catch {
        /* Ein Zuhörer, der wirft, hält die anderen nicht auf. */
      }
    }
  }

  subscribe(fn: (buendel: LiveEintrag[]) => void): () => void {
    this.hoerer.add(fn);
    return () => this.hoerer.delete(fn);
  }

  since(seq: number): LiveEintrag[] | null {
    if (seq > this.seq) return null;
    if (seq === this.seq) return [];
    const erste = this.ring[0]?.seq ?? this.seq + 1;
    /* Fehlt etwas zwischen `seq` und dem Ältesten im Ring, ist es
       verloren — dann lieber alles neu als eine stille Lücke. */
    if (seq + 1 < erste) return null;
    return this.ring.filter((e) => e.seq > seq);
  }

  last(): number {
    return this.seq;
  }

  listening(): boolean {
    return this.hoerer.size > 0;
  }
}

/**
 * Legt sich um ein `Repository` und meldet jedes Schreiben und Löschen
 * eines Artikels und jede Registerzeile. Alles andere geht unverändert
 * durch. Eine Hülle statt einer Zeile in jeder Route: es gibt über zwanzig
 * Stellen, die `putEntity` rufen, und die einundzwanzigste vergässe es.
 */
export function mitKanal(repo: Repository, feed: ChangeFeed): Repository {
  const putEntity = async (entity: Entity, options?: PutOptions): Promise<Entity> => {
    const before = feed.listening() ? await repo.getEntity(entity.id) : undefined;
    const stored = await repo.putEntity(entity, options);
    feed.publish({ kind: 'entity', id: stored.id, before });
    return stored;
  };
  const deleteEntity = async (id: string): Promise<boolean> => {
    const before = feed.listening() ? await repo.getEntity(id) : undefined;
    const removed = await repo.deleteEntity(id);
    if (removed) feed.publish({ kind: 'entity', id, deleted: true, before });
    return removed;
  };
  const putRegistryPart = async <K extends keyof Registry>(part: K, value: Registry[K]): Promise<void> => {
    await repo.putRegistryPart(part, value);
    feed.publish({ kind: 'registry', id: String(part) });
  };
  const eigen: Partial<Repository> = { putEntity, deleteEntity, putRegistryPart };
  const gebunden = new Map<PropertyKey, unknown>();
  return new Proxy(repo, {
    get(target, prop) {
      if (prop in eigen) return eigen[prop as keyof Repository];
      const v: unknown = Reflect.get(target, prop, target);
      if (typeof v !== 'function') return v;
      let f = gebunden.get(prop);
      if (!f) {
        f = (v as (...a: unknown[]) => unknown).bind(target);
        gebunden.set(prop, f);
      }
      return f;
    },
  });
}

/** Eine Nachricht im Format von Server-Sent Events. */
export function sseNachricht(event: string, data: unknown, id?: string): string {
  return `${id ? `id: ${id}\n` : ''}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** `Last-Event-ID` ist `<boot>.<seq>`; alles andere gilt als unbekannt. */
export function leseEventId(roh: string | undefined): { boot: string; seq: number } | null {
  const m = /^([0-9a-f]{8})\.(\d+)$/.exec((roh ?? '').trim());
  return m ? { boot: m[1]!, seq: Number(m[2]) } : null;
}

// ------------------------------------------------------------------ Route

/** Was die Route aus `app.ts` braucht — dieselben Fragen wie jede Route. */
export interface LiveDeps {
  repo: Repository;
  feed: ChangeFeed;
  viewerOf: (request: FastifyRequest) => Promise<User | null>;
  sieveFuer: (user: User | null, entities: Entity[], bestand: Map<string, Entity>) => Promise<Entity[]>;
  roh: () => Promise<{ map: Map<string, Entity> }>;
  /** Wie oft ein Lebenszeichen geht (ms). */
  heartbeatMs?: number;
  /** Wie lange eine Verbindung höchstens offen bleibt (ms). */
  maxAgeMs?: number;
}

/** Die Felder des Sitzungszustands, denen ein Gerät folgt (REQ-116). */
const SITZUNG_FELDER = ['activeMap', 'activeEncounter', 'activeScene', 'nowPlaying'] as const;

interface Strom {
  userId: string | null;
  ende: () => void;
}

/**
 * `GET /api/live` — Server-Sent Events (T-116). Gewählt statt WebSocket,
 * weil der Weg nur vom Server zum Gerät geht (geschrieben wird weiter über
 * die gewöhnlichen Routen, mit ihrer Wache), weil es gewöhnliches HTTP
 * hinter Caddy ist und weil der Browser das Wiederverbinden samt
 * `Last-Event-ID` selbst kann.
 *
 * Ereignisse, je Empfänger gesiebt (`sieveFuer`, dieselbe Rechnung wie
 * `GET /api/entities/:id`):
 * - `hello` `{boot, seq}` beim Verbinden;
 * - `entity` `{id, type, revision}` — ein Artikel, den dieser Empfänger
 *   sieht, hat sich geändert (Kanten gehören dazu: ein Token auf der
 *   Karte ist eine `marker`-Kante der Karte);
 * - `session` `{id, activeMap, activeEncounter, activeScene, nowPlaying}` —
 *   eine Sitzung, aus dem gesiebten Artikel;
 * - `gone` `{id}` — er war für ihn da und ist jetzt verborgen oder gelöscht;
 * - `registry` `{part}` — eine Registerzeile; `reset` — alles neu laden.
 *
 * Was ein Empfänger nicht sieht, bekommt er nicht — auch nicht als Id.
 */
export function registerLive(
  app: FastifyInstance,
  deps: LiveDeps,
): { close: () => void; closeUser: (userId: string) => void } {
  const { repo, feed } = deps;
  const heartbeatMs = deps.heartbeatMs ?? 25_000;
  const maxAgeMs = deps.maxAgeMs ?? 15 * 60_000;
  const stroeme = new Set<Strom>();

  /** Das Konto frisch gelesen: Rollen, Figuren und Sperre gelten ab jetzt,
   *  nicht ab dem Verbinden. */
  async function frisch(userId: string): Promise<User | null> {
    const u = await repo.getUser(userId);
    if (!u || u.disabledAt) return null;
    const { passwordHash: _hash, ...rest } = u;
    return rest;
  }

  app.get('/api/live', async (request, reply) => {
    const viewer = await deps.viewerOf(request);
    const userId = viewer?.id ?? null;
    const q = request.query as { since?: string } | undefined;
    const kopf = request.headers['last-event-id'];
    const letzte = leseEventId(String(Array.isArray(kopf) ? kopf[0] : (kopf ?? q?.since ?? '')));

    reply.hijack();
    const raw = reply.raw;
    raw.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      /* `no-transform`: kein Proxy soll den Strom packen oder puffern;
         `X-Accel-Buffering` sagt dasselbe einem nginx, falls einer davorsteht. */
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    raw.write('retry: 3000\n\n');

    let zu = false;
    let kette: Promise<void> = Promise.resolve();
    const schreib = (s: string): void => {
      if (!zu) raw.write(s);
    };

    const sende = async (buendel: LiveEintrag[]): Promise<void> => {
      if (zu || !buendel.length) return;
      const user = userId ? await frisch(userId) : null;
      if (userId && !user) return ende();
      const { map } = await deps.roh();
      const artikel = buendel.filter((e): e is Extract<LiveEintrag, { kind: 'entity' }> => e.kind === 'entity');
      const jetzt = artikel.filter((e) => !e.deleted).flatMap((e) => map.get(e.id) ?? []);
      const sichtbar = new Map((jetzt.length ? await deps.sieveFuer(user, jetzt, map) : []).map((e) => [e.id, e]));
      /* War er vorher für ihn da? Gesiebt gegen den Bestand mit dem alten
         Stand darin — die Frage ist, was er gesehen hat. */
      const vorher = artikel.flatMap((e) => (e.before && !sichtbar.has(e.id) ? [e.before] : []));
      let sah = new Set<string>();
      if (vorher.length) {
        const alt = new Map(map);
        for (const b of vorher) alt.set(b.id, b);
        sah = new Set((await deps.sieveFuer(user, vorher, alt)).map((e) => e.id));
      }
      for (const e of buendel) {
        const id = `${feed.boot}.${e.seq}`;
        if (e.kind === 'reset') schreib(sseNachricht('reset', {}, id));
        else if (e.kind === 'registry') schreib(sseNachricht('registry', { part: e.id }, id));
        else if (sichtbar.has(e.id)) {
          const s = sichtbar.get(e.id)!;
          schreib(sseNachricht('entity', { id: e.id, type: primaryInterface(s), revision: map.get(e.id)?.revision ?? null }, id));
          const karte = s.components?.['Session'] as Record<string, unknown> | undefined;
          if (primaryInterface(s) === 'Session' || karte) {
            const zustand: Record<string, unknown> = { id: e.id };
            for (const f of SITZUNG_FELDER) zustand[f] = karte?.[f] ?? null;
            schreib(sseNachricht('session', zustand, id));
          }
        } else if (sah.has(e.id)) schreib(sseNachricht('gone', { id: e.id }, id));
      }
    };
    const weiter = (buendel: LiveEintrag[]): void => {
      kette = kette.then(() => sende(buendel)).catch((error: unknown) => {
        request.log.warn({ err: error }, 'live: senden fehlgeschlagen');
      });
    };

    /* Erst anmelden, dann nachholen: was dazwischen kommt, steht sonst
       in keinem von beiden. Doppelt ist harmlos, verloren nicht. */
    const ab = feed.subscribe(weiter);
    schreib(sseNachricht('hello', { boot: feed.boot, seq: feed.last() }, `${feed.boot}.${feed.last()}`));
    if (letzte) {
      const nach = letzte.boot === feed.boot ? feed.since(letzte.seq) : null;
      if (nach === null) schreib(sseNachricht('reset', {}, `${feed.boot}.${feed.last()}`));
      else if (nach.length) weiter(nach);
    }

    /* Ein Lebenszeichen hält Proxy und Mobilfunk-NAT offen; nach
       `maxAgeMs` endet die Verbindung, und der Browser kommt mit
       `Last-Event-ID` wieder — dabei wird die Anmeldung neu geprüft. */
    const puls = setInterval(() => schreib(': ping\n\n'), heartbeatMs);
    const alter = setTimeout(() => ende(), maxAgeMs);
    const strom: Strom = { userId, ende: () => ende() };
    stroeme.add(strom);
    function ende(): void {
      if (zu) return;
      zu = true;
      ab();
      clearInterval(puls);
      clearTimeout(alter);
      stroeme.delete(strom);
      raw.end();
    }
    request.raw.on('close', ende);
  });

  return {
    /** Alle Ströme schliessen — beim Herunterfahren. */
    close: () => {
      for (const s of [...stroeme]) s.ende();
    },
    /** Die Ströme eines Kontos schliessen — abgemeldet überall, gesperrt.
     *  Kommt das Gerät wieder, prüft die Wache neu. */
    closeUser: (userId: string) => {
      for (const s of [...stroeme]) if (s.userId === userId) s.ende();
    },
  };
}

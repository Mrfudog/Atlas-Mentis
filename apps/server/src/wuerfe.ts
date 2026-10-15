/**
 * **Würfe auf einem Artikel** (T-172, REQ-070): gewürfelt wird am Server,
 * und jeder Wurf steht im Protokoll (`event_log`, `name: 'roll'`,
 * `subject` der Artikel, auf dem gewürfelt wurde). Wer würfelt, bekommt
 * das Ergebnis aus der Antwort; der Tisch bekommt es über den Live-Kanal
 * (T-116). So stimmt das Log, und niemand würfelt nach, was er nicht mag.
 *
 * - `POST /api/rolls` `{expr, subject?, label?, mode?, hidden?, actor?, session?}`
 * - `GET /api/rolls?subject=&by=&session=&offset=&limit=` — das Log eines
 *   Artikels, neueste zuerst. An einer Kreatur auch die Würfe auf ihrem
 *   Statblock (`belongsTo` hoch), an einer Sitzung alle Würfe dieser
 *   Sitzung.
 *
 * **Sichtbarkeit** (`rollVisible`): wer den Artikel nicht sieht, sieht
 * seine Würfe nicht; die Leitung würfelt auf Wunsch verdeckt, und
 * `Campaign.playerRolls: 'gm'` macht jeden Wurf der Spielenden verdeckt.
 * Würfe sind Spielgeschehen und kein Inhalt: sie stehen in keiner Ausfuhr
 * und keiner Übertragung, und ein gelöschter Artikel lässt sie stehen.
 */

import { getRandomValues } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  currentCampaign,
  diceModifier,
  entityName,
  naturalD20,
  primaryInterface,
  rollDice,
  rollVisible,
  tableRole,
  withAdvantage,
  type Entity,
  type RollEntry,
  type RollPayload,
} from '@nw/model';
import type { User } from './auth.js';
import type { ChangeFeed } from './live.js';
import type { Repository, StoredEvent } from './repo.js';

const SESSION_TYPE = 'Session';
/** So viele Einträge liest ein Log höchstens auf einmal — gesiebt wird danach. */
const FENSTER = 1000;

interface Stand {
  alle: Entity[];
  map: Map<string, Entity>;
}

export interface WuerfeDeps {
  repo: Repository;
  feed: ChangeFeed;
  viewerOf: (request: FastifyRequest) => Promise<User | null>;
  roh: () => Promise<Stand>;
  sieve: (request: FastifyRequest, entities: Entity[], bestand?: Map<string, Entity>) => Promise<Entity[]>;
}

/** Zufall aus `crypto`, wie `Math.random` in [0, 1). */
function zufall(): number {
  return getRandomValues(new Uint32Array(1))[0]! / 2 ** 32;
}

/**
 * **Die Sitzung am Tisch**, wenn keine genannt ist: die jüngste, an der
 * etwas läuft (Karte, Kampf oder Szene) — nach Weltzeit (`Time.sort`),
 * dann nach Nummer. Dieselbe Regel wie `GET /api/play`.
 */
export function tischSitzung(alle: Entity[]): Entity | null {
  const laeuft = (e: Entity): boolean => {
    /* Die Karte heisst nach der Art, die die Felder erklärt: `Session`
       (merge aus `SessionState`); ältere Bestände tragen `SessionState`. */
    const st = (e.components?.['Session'] ?? e.components?.['SessionState'] ?? {}) as Record<string, unknown>;
    return ['activeMap', 'activeEncounter', 'activeScene'].some((k) => typeof st[k] === 'string' && st[k]);
  };
  const sort = (e: Entity): number => {
    const t = (e.components?.['Time'] as { sort?: unknown } | undefined)?.sort;
    return typeof t === 'number' ? t : Number.NEGATIVE_INFINITY;
  };
  const nummer = (e: Entity): string => String((e.components?.['Identity'] as { id?: unknown } | undefined)?.id ?? '');
  return (
    alle
      .filter((e) => primaryInterface(e) === SESSION_TYPE && laeuft(e))
      .sort((a, b) => sort(b) - sort(a) || nummer(b).localeCompare(nummer(a)) || a.id.localeCompare(b.id))[0] ?? null
  );
}

/** Ein Protokolleintrag als Wurf. */
export function alsWurf(ev: StoredEvent, map: Map<string, Entity>): RollEntry {
  const p = (ev.payload ?? {}) as RollPayload;
  const ziel = ev.subject ? map.get(ev.subject) : undefined;
  return {
    ...p,
    id: ev.id,
    at: ev.at,
    subject: ev.subject ?? null,
    subjectName: ev.subject ? (ziel ? entityName(ziel) : null) : undefined,
  } as RollEntry;
}

/**
 * Einen Wurf eintragen und an den Tisch melden — für `POST /api/rolls` und
 * für Proben, die am Tisch gewürfelt und eingetragen werden (Handwerk,
 * T-165). Gibt den Eintrag zurück.
 */
export async function wurfEintragen(
  deps: Pick<WuerfeDeps, 'repo' | 'feed'>,
  subject: Entity | null,
  payload: RollPayload,
): Promise<RollEntry> {
  const id = await deps.repo.appendEvent('roll', subject?.id, payload);
  const entry: RollEntry = {
    ...payload,
    id,
    at: new Date().toISOString(),
    subject: subject?.id ?? null,
    ...(subject ? { subjectName: entityName(subject) } : {}),
  };
  deps.feed.publish({ kind: 'roll', id, entry });
  return entry;
}

/** Wer am Tisch dieser Kampagne leitet. */
export function leitetTisch(user: User, kampagne: string | null): boolean {
  if (user.isAdmin) return true;
  const rolle = kampagne ? tableRole({ roles: user.roles ?? {} }, kampagne) : null;
  return rolle === 'gm' || rolle === 'co-gm';
}

/** Die Figur, für die gewürfelt wird: genannt und eigene, sonst der Artikel
 *  selbst oder die Figur seines Statblocks, sonst die einzige des Kontos. */
export function wurfFigur(user: User, map: Map<string, Entity>, subject: Entity | null, genannt?: unknown): Entity | null {
  const eigene = new Set(user.actorIds ?? []);
  const kandidaten = [
    typeof genannt === 'string' ? genannt : null,
    subject?.id ?? null,
    ...(subject?.relations ?? []).filter((r) => r.type === 'belongsTo').map((r) => r.to),
  ];
  for (const k of kandidaten) if (k && eigene.has(k) && map.has(k)) return map.get(k)!;
  return eigene.size === 1 ? (map.get([...eigene][0]!) ?? null) : null;
}

export function registerWuerfe(app: FastifyInstance, deps: WuerfeDeps): void {
  const { repo, viewerOf, roh, sieve } = deps;

  app.post<{
    Body: { expr?: unknown; subject?: unknown; label?: unknown; mode?: unknown; hidden?: unknown; actor?: unknown; session?: unknown } | null;
  }>('/api/rolls', async (request, reply) => {
    const user = await viewerOf(request);
    if (!user) return reply.code(401).send({ error: 'Nicht angemeldet' });
    const b = request.body ?? {};
    const stand = await roh();
    const kampagne = currentCampaign(stand.map, (await repo.getRegistry()).settings ?? null);
    const kid = kampagne?.id ?? null;
    const rolle = kid ? tableRole({ roles: user.roles ?? {} }, kid) : null;
    const leitet = leitetTisch(user, kid);
    if (!leitet && rolle !== 'player') return reply.code(403).send({ error: 'Würfeln dürfen, wer in dieser Kampagne spielt oder leitet.' });

    let subject: Entity | null = null;
    if (typeof b.subject === 'string' && b.subject) {
      const roh_ = stand.map.get(b.subject);
      const [sichtbar] = roh_ ? await sieve(request, [roh_], stand.map) : [];
      if (!sichtbar) return reply.code(404).send({ error: 'Nicht gefunden' });
      subject = roh_!;
    }
    const mode = b.mode === 'adv' || b.mode === 'dis' ? b.mode : undefined;
    const gefragt = String(b.expr ?? '').slice(0, 200);
    const expr = withAdvantage(gefragt, mode);
    const wurf = rollDice(expr, zufall);
    if (!wurf) return reply.code(422).send({ error: `Kein Würfelausdruck: ${gefragt || '—'}` });
    if (b.hidden === true && !leitet) return reply.code(403).send({ error: 'Verdeckt würfelt die Leitung.' });
    /* Kampagneneinstellung: Würfe der Spielenden sieht nur die Leitung. */
    const nurLeitung = !leitet && (kampagne?.components?.['Campaign'] as { playerRolls?: unknown } | undefined)?.playerRolls === 'gm';
    const hidden = b.hidden === true || nurLeitung;

    let sitzung: Entity | null = null;
    if (typeof b.session === 'string' && b.session) {
      const s = stand.map.get(b.session);
      const [sichtbar] = s && primaryInterface(s) === SESSION_TYPE ? await sieve(request, [s], stand.map) : [];
      sitzung = sichtbar ? s! : null;
    } else if (subject && primaryInterface(subject) === SESSION_TYPE) sitzung = subject;
    else sitzung = tischSitzung(stand.alle);

    const figur = wurfFigur(user, stand.map, subject, b.actor);
    const nat = naturalD20(wurf);
    const label = typeof b.label === 'string' ? b.label.trim().slice(0, 120) : '';
    const payload: RollPayload = {
      expr: wurf.expr,
      ...(expr !== gefragt ? { asked: gefragt } : {}),
      total: wurf.total,
      rolls: wurf.rolls,
      modifier: diceModifier(wurf),
      ...(mode ? { mode } : {}),
      ...(nat ? { nat: nat.nat } : {}),
      ...(nat?.crit ? { crit: nat.crit } : {}),
      ...(label ? { label } : {}),
      by: { id: user.id, name: user.name },
      ...(figur ? { actor: { id: figur.id, name: entityName(figur) } } : {}),
      campaign: kid,
      session: sitzung?.id ?? null,
      ...(hidden ? { hidden: true as const } : {}),
    };
    return wurfEintragen(deps, subject, payload);
  });

  app.get<{ Querystring: { subject?: string; by?: string; session?: string; offset?: string; limit?: string } }>(
    '/api/rolls',
    async (request, reply) => {
      const user = await viewerOf(request);
      if (!user) return reply.code(401).send({ error: 'Nicht angemeldet' });
      const q = request.query;
      const stand = await roh();
      const id = String(q.subject ?? '');
      const artikel = stand.map.get(id);
      const [sichtbar] = artikel ? await sieve(request, [artikel], stand.map) : [];
      if (!sichtbar) return reply.code(404).send({ error: 'Nicht gefunden' });
      /* An einer Kreatur auch ihr Statblock: was am Statblock gewürfelt
         wird, ist ein Wurf dieser Kreatur. */
      const statbloecke = stand.alle.filter((e) => (e.relations ?? []).some((r) => r.type === 'belongsTo' && r.to === id));
      const subjects = [id, ...statbloecke.map((e) => e.id)];
      const istSitzung = primaryInterface(artikel!) === SESSION_TYPE;
      const roheEintraege = await repo.listEvents({
        name: 'roll',
        subjects,
        ...(istSitzung ? { orPayload: { key: 'session', value: id } } : {}),
        limit: FENSTER,
      });
      /* Je Artikel einmal gesiebt: wer ihn nicht sieht, sieht seine Würfe nicht. */
      const ziele = [...new Set(roheEintraege.map((e) => e.subject).filter((s): s is string => !!s))];
      const da = ziele.flatMap((s) => stand.map.get(s) ?? []);
      const sicht = new Set((da.length ? await sieve(request, da, stand.map) : []).map((e) => e.id));
      const alle = roheEintraege
        .map((ev) => alsWurf(ev, stand.map))
        .filter((w) => rollVisible(w, user, w.subject && stand.map.has(w.subject) ? sicht.has(w.subject) : null));
      /* Die Filter: wer gewürfelt hat, in welcher Sitzung. */
      const people = new Map<string, string>();
      const sessions = new Map<string, string>();
      for (const w of alle) {
        if (w.by?.id) people.set(w.by.id, w.by.name);
        if (w.session) sessions.set(w.session, entityName(stand.map.get(w.session)) || 'Deleted session');
      }
      const gefiltert = alle.filter((w) => (!q.by || w.by?.id === q.by) && (!q.session || w.session === q.session));
      const offset = Math.max(0, Number(q.offset) || 0);
      const limit = Math.min(200, Math.max(1, Number(q.limit) || 25));
      return {
        entries: gefiltert.slice(offset, offset + limit),
        total: gefiltert.length,
        next: offset + limit < gefiltert.length ? offset + limit : null,
        people: [...people].map(([pid, name]) => ({ id: pid, name })).sort((a, z) => a.name.localeCompare(z.name, 'de')),
        sessions: [...sessions].map(([sid, name]) => ({ id: sid, name })),
        subjects,
        leitet: leitetTisch(user, currentCampaign(stand.map, (await repo.getRegistry()).settings ?? null)?.id ?? null),
      };
    },
  );
}

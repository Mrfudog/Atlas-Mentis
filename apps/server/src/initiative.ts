/**
 * **Der Initiative-Tracker** (T-022): `GET /api/encounters/:id/tracker`
 * gibt die Reihe, wie der Betrachter sie sieht, `POST` ändert sie.
 *
 * Gesiebt wird wie jede Route: die Leitung des Tisches (`leitetTisch`)
 * bekommt die rohe Begegnung, alle anderen die gesiebte (`sieve` →
 * `redactEntity` mit den Regeln der Kampagne, `redactParticipants`) — was
 * hier gezeichnet wird, ist schon zurückgehalten. Live geht die Änderung
 * als Artikel-Ereignis der Begegnung; der Tracker fragt dann neu.
 *
 * Ändern darf die Leitung. Spielende dürfen nur ihren eigenen Zug beenden
 * (`next`, wenn die Figur dran ist, die ihr Konto führt). Ist der Tracker
 * an der Kampagne aus (`Campaign.combat`), ändert niemand etwas, und die
 * Reihe kommt leer.
 */

import { randomUUID, getRandomValues } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  applyTrackerOp,
  currentCampaign,
  fightOf,
  initiativeOrder,
  initiativeRulesOf,
  participantActions,
  primaryInterface,
  trackerView,
  type Entity,
  type InitiativeRules,
  type TrackerOp,
  type TrackerView,
  type validateEntity,
} from '@nw/model';
import type { User } from './auth.js';
import type { Repository } from './repo.js';
import { leitetTisch } from './wuerfe.js';

interface Stand {
  alle: Entity[];
  map: Map<string, Entity>;
}

export interface TrackerDeps {
  repo: Repository;
  viewerOf: (request: FastifyRequest) => Promise<User | null>;
  roh: () => Promise<Stand>;
  geltend: (e: Entity, map: Map<string, Entity>) => Promise<Entity>;
  sieve: (request: FastifyRequest, entities: Entity[], bestand?: Map<string, Entity>) => Promise<Entity[]>;
  schreibeGeprueft: (entity: Entity) => Promise<{ stored: Entity } | { issues: ReturnType<typeof validateEntity> }>;
}

const OPS = new Set(['next', 'previous', 'delay', 'end', 'init', 'hp', 'effect', 'removeEffect', 'flags', 'add', 'remove']);

function w20(): number {
  return 1 + Math.floor((getRandomValues(new Uint32Array(1))[0]! / 2 ** 32) * 20);
}

export function registerTracker(app: FastifyInstance, deps: TrackerDeps): void {
  const { repo, viewerOf, roh, geltend, sieve, schreibeGeprueft } = deps;

  /** Die Begegnung, die Kampagne, die Regeln, und ob der Betrachter leitet. */
  type Lage =
    | { fehlt: true; code: number; error: string }
    | { fehlt: false; user: User; stand: Stand; gefunden: Entity; gesiebt: Entity; rules: InitiativeRules; gm: boolean };
  async function lage(request: FastifyRequest, id: string): Promise<Lage> {
    const nicht = (code: number, error: string): Lage => ({ fehlt: true, code, error });
    const user = await viewerOf(request);
    if (!user) return nicht(401, 'Nicht angemeldet');
    const stand = await roh();
    const gefunden = stand.map.get(id);
    if (!gefunden || primaryInterface(gefunden) !== 'Encounter') return nicht(404, 'Nicht gefunden');
    /* Sieht er sie überhaupt? Dieselbe Frage wie jede Route. */
    const [gesiebt] = await sieve(request, [gefunden], stand.map);
    if (!gesiebt) return nicht(404, 'Nicht gefunden');
    const kampagne = currentCampaign(stand.map, (await repo.getRegistry()).settings ?? null);
    const rules = initiativeRulesOf(kampagne);
    const gm = leitetTisch(user, kampagne?.id ?? null);
    return { fehlt: false, user, stand, gefunden, gesiebt, rules, gm };
  }

  app.get<{ Params: { id: string } }>('/api/encounters/:id/tracker', async (request, reply) => {
    const l = await lage(request, request.params.id);
    if (l.fehlt) return reply.code(l.code).send({ error: l.error });
    const { stand, gefunden, gesiebt, rules, gm } = l;
    if (rules.combat === 'off') return { ...trackerView(stand.map, { ...gesiebt, relations: [] }, rules, gm), off: true };
    const eigene = new Set(l.user.actorIds ?? []);
    const markiert = (v: TrackerView): TrackerView => ({ ...v, rows: v.rows.map((r) => (r.to && eigene.has(r.to) ? { ...r, own: true } : r)) });
    if (gm) return markiert(trackerView(stand.map, await geltend(gefunden, stand.map), rules, true));

    /* Spielende: die gesiebte Reihe. Die Aktionen eines Gegners kommen
       vom rohen Statblock — der Artikel eines Unerkannten ist ihnen nicht
       genannt —, aber nur die Regeln, die sie sehen dürfen. */
    const roh_ = await geltend(gefunden, stand.map);
    const rohKanten = new Map((roh_.relations ?? []).map((r) => [r.id, r]));
    let actionsOf: ((edge: string) => string[]) | undefined;
    if (rules.columns.includes('actions') && rules.enemyActions === 'shown') {
      const regeln = stand.alle.filter((e) => primaryInterface(e) === 'Rule');
      const sichtbar = new Set((await sieve(request, regeln, stand.map)).map((e) => e.id));
      const gefiltert = new Map([...stand.map].filter(([id, e]) => primaryInterface(e) !== 'Rule' || sichtbar.has(id)));
      actionsOf = (edge) => {
        const to = rohKanten.get(edge)?.to;
        return to ? participantActions(gefiltert, to) : [];
      };
    }
    return markiert(trackerView(stand.map, gesiebt, rules, false, actionsOf));
  });

  app.post<{ Params: { id: string }; Body: TrackerOp | undefined }>('/api/encounters/:id/tracker', async (request, reply) => {
    const op = request.body;
    if (!op || typeof op !== 'object' || !OPS.has(String((op as { op?: unknown }).op))) {
      return reply.code(400).send({ error: 'Unknown tracker operation.' });
    }
    const l = await lage(request, request.params.id);
    if (l.fehlt) return reply.code(l.code).send({ error: l.error });
    const { user, stand, gefunden, rules, gm } = l;
    if (rules.combat === 'off') return reply.code(409).send({ error: 'The initiative tracker is off in this campaign.' });
    const begegnung = await geltend(gefunden, stand.map);
    /* Begonnen wird über „Start" (`kampfstart.ts`): der würfelt und nimmt eine Vorlage als Instanz ins Spiel (T-289). */
    if (fightOf(begegnung).round < 1 && ['next', 'previous', 'delay'].includes(op.op)) {
      return reply.code(409).send({ error: 'Start the encounter first.' });
    }
    if (!gm) {
      /* Den eigenen Zug beenden darf, wer die Figur führt, die dran ist. */
      const { round, turn } = fightOf(begegnung);
      const dran = round > 0 ? initiativeOrder(stand.map, begegnung.relations ?? [])[turn] : undefined;
      const eigen = !!dran && (user.actorIds ?? []).includes(dran.to);
      if (!(op.op === 'next' && eigen)) return reply.code(403).send({ error: 'The tracker is run by the GM; a player ends only their own turn.' });
    }
    const r = applyTrackerOp(stand.map, begegnung, op, { d20: w20, newId: randomUUID });
    if ('error' in r) return reply.code(422).send({ error: r.error });
    const w = await schreibeGeprueft(r.encounter);
    if ('issues' in w) return reply.code(422).send({ error: 'The encounter could not be saved.', issues: w.issues });
    return { ok: true };
  });
}

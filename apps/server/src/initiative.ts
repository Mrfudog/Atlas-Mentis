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
 * **Aufgeklappt** (T-334) zeigt eine Zeile, was der Teilnehmer kann
 * (`participantOptions`): für die Leitung aus dem ganzen Bestand, für
 * Spielende nur aus Teilen, die sie sehen (`sieve`), und nur, wo die
 * Kampagne die Aktionen der Gegner zeigt (`initActions`).
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
  diceModifier,
  entityName,
  naturalD20,
  PARTICIPATES,
  rollDice,
  trackerDamage,
  damageLines,
  type ParticipantProps,
  type RollPayload,
  fightOf,
  initiativeOrder,
  initiativeRulesOf,
  participantActions,
  participantOptions,
  primaryInterface,
  relationDef,
  statblockFor,
  templateChain,
  trackerView,
  type Entity,
  type InitiativeRules,
  type TrackerOp,
  type TrackerView,
  type validateEntity,
} from '@nw/model';
import type { User } from './auth.js';
import type { Repository } from './repo.js';
import type { ChangeFeed } from './live.js';
import { leitetTisch, tischSitzung, wurfEintragen } from './wuerfe.js';

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
  /** Für das Würfellog (T-172): die Konzentrationsprobe nach Schaden (T-355). */
  feed?: ChangeFeed;
}

const OPS = new Set(['next', 'previous', 'skip', 'top', 'turn', 'delay', 'end', 'init', 'hp', 'damage', 'effect', 'removeEffect', 'flags', 'add', 'remove']);

function zufall(): number {
  return getRandomValues(new Uint32Array(1))[0]! / 2 ** 32;
}

function w20(): number {
  return 1 + Math.floor((getRandomValues(new Uint32Array(1))[0]! / 2 ** 32) * 20);
}

export function registerTracker(app: FastifyInstance, deps: TrackerDeps): void {
  const { repo, viewerOf, roh, geltend, sieve, schreibeGeprueft, feed } = deps;

  /**
   * **Schaden mit Art** (T-355): `trackerDamage` rechnet wie der Zugplan;
   * hier wird geschrieben (Begegnung, bei einer Spielerfigur `Vitals`) und
   * die Konzentrationsprobe gewürfelt — 1d20 + KON-Rettungswurf ins Log,
   * bei Misserfolg endet sie (E-128, Variante A). Der Text sagt der
   * Leitung, was geschah: Abwehr, Stand, Probe.
   */
  async function schadenImTracker(
    stand: Stand,
    begegnung: Entity,
    op: { edge: string; amount: unknown; type?: unknown },
    user: User,
    kampagne: string | null,
  ): Promise<{ text: string; schreiben: Entity[] } | { error: string }> {
    const r = trackerDamage(stand.map, begegnung, op);
    if ('error' in r) return r;
    const teile = damageLines(r.name, r.damage);
    let figur = r.creature;
    const probe = r.damage.concentration;
    if (probe) {
      const ziel = stand.map.get(((begegnung.relations ?? []).find((x) => x.id === op.edge)?.to) ?? '')!;
      const w = rollDice(`1d20${probe.bonus === null ? '' : probe.bonus < 0 ? probe.bonus : `+${probe.bonus}`}`, zufall);
      if (w) {
        const nat = naturalD20(w);
        const payload: RollPayload = {
          expr: w.expr, total: w.total, rolls: w.rolls, modifier: diceModifier(w),
          ...(nat ? { nat: nat.nat } : {}), ...(nat?.crit ? { crit: nat.crit } : {}),
          label: `${r.name}: concentration save, DC ${probe.dc}`.slice(0, 120),
          by: { id: user.id, name: user.name },
          actor: { id: ziel.id, name: entityName(ziel) },
          campaign: kampagne,
          session: tischSitzung(stand.alle)?.id ?? null,
        };
        if (feed) await wurfEintragen({ repo, feed }, ziel, payload);
        else await repo.appendEvent('roll', ziel.id, payload);
        const haelt = w.total >= probe.dc;
        const zauber = stand.map.get(probe.spell);
        teile.push(`concentration save ${w.total} vs DC ${probe.dc} — ${haelt ? 'kept' : `lost${zauber ? ` (${entityName(zauber)})` : ''}`}`);
        if (!haelt) {
          const basis = figur ?? ziel;
          const vv = { ...((basis.components?.['Vitals'] ?? {}) as Record<string, unknown>) };
          delete vv['concentration'];
          figur = { ...basis, components: { ...basis.components, Vitals: vv } };
        }
      }
    }
    return { text: teile.join('; '), schreiben: [r.encounter, ...(figur ? [figur] : [])] };
  }

  /** Die Begegnung, die Kampagne, die Regeln, und ob der Betrachter leitet. */
  type Lage =
    | { fehlt: true; code: number; error: string }
    | { fehlt: false; user: User; stand: Stand; gefunden: Entity; gesiebt: Entity; rules: InitiativeRules; gm: boolean; kampagne: string | null };
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
    return { fehlt: false, user, stand, gefunden, gesiebt, rules, gm, kampagne: kampagne?.id ?? null };
  }

  app.get<{ Params: { id: string } }>('/api/encounters/:id/tracker', async (request, reply) => {
    const l = await lage(request, request.params.id);
    if (l.fehlt) return reply.code(l.code).send({ error: l.error });
    const { stand, gefunden, gesiebt, rules, gm } = l;
    if (rules.combat === 'off') return { ...trackerView(stand.map, { ...gesiebt, relations: [] }, rules, gm), off: true };
    const eigene = new Set(l.user.actorIds ?? []);
    const markiert = (v: TrackerView): TrackerView => ({ ...v, rows: v.rows.map((r) => (r.to && eigene.has(r.to) ? { ...r, own: true } : r)) });
    const registry = await repo.getRegistry();
    if (gm) {
      const voll = await geltend(gefunden, stand.map);
      const kanten = new Map((voll.relations ?? []).map((r) => [r.id, r]));
      const optionsOf = (edge: string) => {
        const to = kanten.get(edge)?.to;
        return to ? participantOptions(registry, stand.map, to) : null;
      };
      return markiert(trackerView(stand.map, voll, rules, true, undefined, optionsOf));
    }

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
    /* Die Optionen (T-334): Statblock und Figur roh — die Kante nennt sie,
       auch wenn der Artikel eines Unerkannten den Spielenden nicht genannt
       ist —, ihre Teile und Zauber nur, wie sie sie sehen. */
    const teilIds = new Set<string>();
    const mitTeilen = (e: Entity | undefined) => {
      for (const r of e?.relations ?? []) {
        if (r.type === 'casts' || relationDef(registry, r.type).section) teilIds.add(r.to);
      }
    };
    for (const r of gesiebt.relations ?? []) {
      const t = stand.map.get(rohKanten.get(r.id)?.to ?? '');
      if (!t) continue;
      mitTeilen(t);
      const sb = statblockFor(stand.map, t);
      /* Die Instanz liest ihre Teile von der Vorlage (`resolveInstance`), also deren auch. */
      for (const e of sb ? [sb, ...templateChain(stand.map, sb)] : []) mitTeilen(e);
    }
    const teile = await sieve(request, [...teilIds].flatMap((id) => stand.map.get(id) ?? []), stand.map);
    const sichtbareTeile = new Map(teile.map((e) => [e.id, e]));
    /* Statblock und Figur bleiben, ihre Teile und Zauber nur gesiebt; Aktionsarten (Namen der Abschnitte) sind Wörter. */
    const fuerOptionen = new Map([...stand.map].filter(([id]) => !teilIds.has(id) || sichtbareTeile.has(id)));
    for (const [id, e] of sichtbareTeile) fuerOptionen.set(id, e);
    const optionsOf = (edge: string) => {
      const to = rohKanten.get(edge)?.to;
      return to ? participantOptions(registry, fuerOptionen, to) : null;
    };
    return markiert(trackerView(stand.map, gesiebt, rules, false, actionsOf, optionsOf));
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
    if (fightOf(begegnung).round < 1 && ['next', 'previous', 'skip', 'top', 'turn', 'delay'].includes(op.op)) {
      return reply.code(409).send({ error: 'Start the encounter first.' });
    }
    /* Verzögern kennt das System „D&D 5e (standard)" nicht (T-334); `delayTurn` bleibt für eine Hausregel (T-336). */
    if (op.op === 'delay' && !rules.quickActions.includes('delay')) {
      return reply.code(409).send({ error: 'This initiative system has no delaying.' });
    }
    if (!gm) {
      /* Den eigenen Zug beenden darf, wer die Figur führt, die dran ist. */
      const { round, turn } = fightOf(begegnung);
      const dran = round > 0 ? initiativeOrder(stand.map, begegnung.relations ?? [])[turn] : undefined;
      const eigen = !!dran && (user.actorIds ?? []).includes(dran.to);
      if (!(op.op === 'next' && eigen)) return reply.code(403).send({ error: 'The tracker is run by the GM; a player ends only their own turn.' });
    }
    if (op.op === 'damage') {
      const d = await schadenImTracker(stand, begegnung, op, user, l.kampagne);
      if ('error' in d) return reply.code(422).send({ error: d.error });
      for (const e of d.schreiben) {
        const w = await schreibeGeprueft(e);
        if ('issues' in w) return reply.code(422).send({ error: `${entityName(e)} could not be saved.`, issues: w.issues });
      }
      return { ok: true, text: d.text };
    }
    const r = applyTrackerOp(stand.map, begegnung, op, { d20: w20, newId: randomUUID });
    if ('error' in r) return reply.code(422).send({ error: r.error });
    const w = await schreibeGeprueft(r.encounter);
    if ('issues' in w) return reply.code(422).send({ error: 'The encounter could not be saved.', issues: w.issues });
    /* **Eine Spielerfigur führt ihren Stand an `Vitals`** (T-355, E-128):
       der Tracker spiegelt, was er an der Kante setzt, wie der Zugplan —
       sonst zeigte der Bogen etwas anderes als die Initiative. */
    if (op.op === 'hp') {
      const k = (r.encounter.relations ?? []).find((x) => x.id === op.edge && x.type === PARTICIPATES);
      const figur = k ? stand.map.get(k.to) : undefined;
      const hp = Number(((k?.props ?? {}) as ParticipantProps).hp);
      if (figur && primaryInterface(figur) === 'PlayerCharacter' && Number.isFinite(hp)) {
        const v = (figur.components?.['Vitals'] ?? {}) as Record<string, unknown>;
        if (v['hp'] !== hp) {
          const f = await schreibeGeprueft({ ...figur, components: { ...figur.components, Vitals: { ...v, hp } } });
          if ('issues' in f) return reply.code(422).send({ error: `${entityName(figur)} could not be saved.`, issues: f.issues });
        }
      }
    }
    return { ok: true };
  });
}

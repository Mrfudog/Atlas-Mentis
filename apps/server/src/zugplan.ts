/**
 * **Der Zugplan am Tisch** (T-198): eine Spielerin legt auf der Karte
 * ihren Zug zurecht — Bewegung, Aktion, Bonusaktion, Reaktion —, reicht
 * ihn ein, und die Leitung bestätigt ihn. Erst beim Bestätigen wird
 * gewürfelt, am Server und ins Log (T-172), und das Token wandert.
 *
 * - `GET  /api/maps/:id/turn-plan?actor=` — was die Leiste braucht: die
 *   Figuren, für die der Betrachter planen darf, die Kacheln der gewählten
 *   (aus ihrem Statblock gerechnet, D51), die Ziele auf der Karte mit
 *   Trefferchance je Angriff und die Pläne dieser Karte.
 * - `POST /api/maps/:id/turn-plan` `{actor, steps, plan?}` — einreichen
 *   (oder einen eingereichten ersetzen).
 * - `POST /api/maps/:id/turn-plan/:plan/decide` `{decision, note?}` —
 *   die Leitung bestätigt (`confirm`) oder lehnt ab (`reject`).
 *
 * **Ein Plan ist Spielgeschehen und kein Inhalt** (wie ein Wurf): er steht
 * im Protokoll (`event_log`, `name: 'turnplan'`, `subject` die Karte), je
 * Änderung ein Eintrag mit derselben Plan-Id; es gilt der jüngste. Keine
 * Migration, kein Artikel, keine Ausfuhr.
 *
 * **Gesiebt wird wie überall:** die Karte gesiebt (`redactMap`), die Ziele
 * nur, die auf der gesiebten Karte stehen, die Kacheln aus Artikeln, die
 * der Betrachter sieht. Die Rüstungsklasse eines Gegners geht nur an die
 * Leitung; Spielende bekommen die Trefferchance — wie in BG3. Planen darf,
 * wer die Figur führt (`app_user_actor`) oder am Tisch leitet; die Leitung
 * plant so auch für einen Gegner.
 */

import { randomUUID, getRandomValues } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  cleanStep,
  currentCampaign,
  diceModifier,
  entityName,
  hitChance,
  isMap,
  markersOf,
  moveMarker,
  naturalD20,
  planBudget,
  planText,
  primaryInterface,
  resolveInstance,
  rollDice,
  speedModes,
  tilesFor,
  TURNPLAN_EVENT,
  type Entity,
  type PlanResult,
  type PlanStep,
  type PlanTile,
  type RollPayload,
  type TurnPlan,
  type validateEntity,
} from '@nw/model';
import type { User } from './auth.js';
import type { ChangeFeed } from './live.js';
import type { Repository } from './repo.js';
import { leitetTisch, tischSitzung, wurfEintragen } from './wuerfe.js';

interface Stand {
  alle: Entity[];
  map: Map<string, Entity>;
}

export interface ZugplanDeps {
  repo: Repository;
  feed: ChangeFeed;
  viewerOf: (request: FastifyRequest) => Promise<User | null>;
  roh: () => Promise<Stand>;
  sieve: (request: FastifyRequest, entities: Entity[], bestand?: Map<string, Entity>) => Promise<Entity[]>;
  geltend: (e: Entity, map: Map<string, Entity>) => Promise<Entity>;
  schreibeGeprueft: (entity: Entity) => Promise<{ stored: Entity } | { issues: ReturnType<typeof validateEntity> }>;
}

/** So viele Plan-Einträge einer Karte liest die Leiste höchstens. */
const FENSTER = 200;

function zufall(): number {
  return getRandomValues(new Uint32Array(1))[0]! / 2 ** 32;
}

type Card = Record<string, unknown>;

/** Der Statblock einer Kreatur (`belongsTo`), oder sie selbst. */
export function statblockVon(alle: readonly Entity[], e: Entity): Entity | null {
  if (primaryInterface(e) === 'Statblock') return e;
  return alle.find((o) => primaryInterface(o) === 'Statblock' && (o.relations ?? []).some((r) => r.type === 'belongsTo' && r.to === e.id)) ?? null;
}

/** Die Karten des Statblocks als eine (`Statblock` und `Abilities`), wie der Bogen sie liest. */
function werte(map: Map<string, Entity>, sb: Entity | null): Card {
  if (!sb) return {};
  const c = resolveInstance(map, sb).components ?? {};
  return { ...((c['Abilities'] ?? {}) as Card), ...((c['Statblock'] ?? {}) as Card) };
}

/** Das Gehtempo in Fuss; ohne Angabe 30. */
export function tempoVon(stats: Card): number {
  return speedModes(stats['speed']).walk ?? 30;
}

/**
 * **Die Kacheln einer Figur** — die Aktionen ihres Statblocks
 * (`composedOf` auf Artikel mit `Action`-Karte; die Kante darf Zahlen
 * ändern), dazu waffenloser Schlag und die allgemeinen Aktionen. Nur
 * Aktionen, die `sichtbar` sagt.
 */
export function kachelnVon(map: Map<string, Entity>, sb: Entity | null, sichtbar: (id: string) => boolean): PlanTile[] {
  const stats = werte(map, sb);
  const aktionen = sb
    ? (resolveInstance(map, sb).relations ?? [])
        .filter((r) => r.type === 'composedOf' && sichtbar(r.to))
        .flatMap((r) => {
          const a = map.get(r.to);
          const action = a?.components?.['Action'] as Card | undefined;
          if (!a || !action) return [];
          const art = typeof action['actionType'] === 'string' ? map.get(action['actionType']) : undefined;
          return [{ id: a.id, name: entityName(a), actionTypeName: art ? entityName(art) : null, action, edge: (r.props ?? {}) as Card }];
        })
    : [];
  return tilesFor(stats, aktionen);
}

/** Die Rüstungsklasse eines Ziels, vom Statblock. */
function rkVon(stand: Stand, e: Entity): number | null {
  const ac = Number(werte(stand.map, statblockVon(stand.alle, e))['ac']);
  return Number.isFinite(ac) && ac > 0 ? ac : null;
}

/** Je Plan-Id der jüngste Eintrag, neueste zuerst. */
async function plaeneDerKarte(repo: Repository, karte: string): Promise<(TurnPlan & { at: string })[]> {
  const roh = await repo.listEvents({ name: TURNPLAN_EVENT, subject: karte, limit: FENSTER });
  const je = new Map<string, TurnPlan & { at: string }>();
  for (const ev of roh) {
    const p = ev.payload as TurnPlan;
    if (p?.plan && !je.has(p.plan)) je.set(p.plan, { ...p, at: ev.at });
  }
  return [...je.values()];
}

export function registerZugplan(app: FastifyInstance, deps: ZugplanDeps): void {
  const { repo, feed, viewerOf, roh, sieve, geltend, schreibeGeprueft } = deps;

  /** Die gesiebte Karte, die rohe dazu, Kampagne und Rolle — oder ein Fehler. */
  async function lage(request: FastifyRequest, id: string) {
    const user = await viewerOf(request);
    if (!user) return { fehler: 401 as const };
    const stand = await roh();
    const gefunden = stand.map.get(id);
    if (!gefunden || !isMap(gefunden)) return { fehler: 404 as const };
    const roheKarte = await geltend(gefunden, stand.map);
    const [karte] = await sieve(request, [roheKarte], stand.map);
    if (!karte) return { fehler: 404 as const };
    const kampagne = currentCampaign(stand.map, (await repo.getRegistry()).settings ?? null);
    const leitet = leitetTisch(user, kampagne?.id ?? null);
    return { user, stand, roheKarte, karte, kampagne, leitet };
  }

  /** Für wen der Betrachter planen darf: eigene Figuren mit Token hier; die Leitung für jede Kreatur mit Statblock. */
  function figuren(stand: Stand, karte: Entity, user: User, leitet: boolean): Entity[] {
    const eigene = new Set(user.actorIds ?? []);
    const ids = [...new Set(markersOf(karte).map((m) => m.to))];
    return ids
      .map((i) => stand.map.get(i))
      .filter((e): e is Entity => !!e)
      .filter((e) => eigene.has(e.id) || (leitet && !!statblockVon(stand.alle, e)));
  }

  app.get<{ Params: { id: string }; Querystring: { actor?: string } }>('/api/maps/:id/turn-plan', async (request, reply) => {
    const l = await lage(request, request.params.id);
    if ('fehler' in l) return reply.code(l.fehler).send({ error: l.fehler === 401 ? 'Nicht angemeldet' : 'Nicht gefunden' });
    const { user, stand, karte, leitet } = l;
    const moegliche = figuren(stand, karte, user, leitet);
    const figur = moegliche.find((e) => e.id === request.query.actor) ?? moegliche.find((e) => (user.actorIds ?? []).includes(e.id)) ?? moegliche[0] ?? null;

    let tiles: PlanTile[] = [];
    let speed = 30;
    if (figur) {
      const sb = statblockVon(stand.alle, figur);
      const aktionsIds = sb ? (resolveInstance(stand.map, sb).relations ?? []).filter((r) => r.type === 'composedOf').map((r) => r.to) : [];
      const da = aktionsIds.flatMap((i) => stand.map.get(i) ?? []);
      const sicht = new Set((da.length ? await sieve(request, da, stand.map) : []).map((e) => e.id));
      tiles = kachelnVon(stand.map, sb, (i) => sicht.has(i));
      speed = tempoVon(werte(stand.map, sb));
    }

    /* Die Ziele: was auf der gesiebten Karte steht, ausser der Figur selbst. */
    const marker = markersOf(karte).filter((m) => m.kind !== 'scenery');
    const zielIds = [...new Set(marker.map((m) => m.to))].filter((i) => i !== figur?.id);
    const zielRoh = zielIds.flatMap((i) => stand.map.get(i) ?? []);
    const ziele = zielRoh.length ? await sieve(request, zielRoh, stand.map) : [];
    const angriffe = tiles.filter((t) => t.toHit !== null);
    const targets = ziele.map((z) => {
      const ac = rkVon(stand, stand.map.get(z.id)!);
      const chances: Record<string, number> = {};
      if (ac !== null) for (const t of angriffe) chances[t.id] = Math.round(hitChance(t.toHit!, ac) * 100);
      return { id: z.id, name: entityName(z), type: primaryInterface(z), chances, ...(leitet && ac !== null ? { ac } : {}) };
    });

    /* Die Pläne: die Leitung sieht alle dieser Karte, Spielende ihre eigenen. */
    const eigene = new Set(user.actorIds ?? []);
    const plans = (await plaeneDerKarte(repo, karte.id))
      .filter((p) => leitet || p.by?.id === user.id || eigene.has(p.actor))
      .slice(0, 20);

    return {
      leitet,
      actors: moegliche.map((e) => ({ id: e.id, name: entityName(e), own: eigene.has(e.id), rel: markersOf(karte).find((m) => m.to === e.id)?.rel.id ?? null })),
      actor: figur ? { id: figur.id, name: entityName(figur), speed, rel: markersOf(karte).find((m) => m.to === figur.id)?.rel.id ?? null } : null,
      tiles,
      targets,
      plans,
    };
  });

  app.post<{ Params: { id: string }; Body: { actor?: unknown; steps?: unknown; plan?: unknown } | null }>(
    '/api/maps/:id/turn-plan',
    async (request, reply) => {
      const l = await lage(request, request.params.id);
      if ('fehler' in l) return reply.code(l.fehler).send({ error: l.fehler === 401 ? 'Nicht angemeldet' : 'Nicht gefunden' });
      const { user, stand, karte, kampagne, leitet } = l;
      const b = request.body ?? {};
      const figur = figuren(stand, karte, user, leitet).find((e) => e.id === b.actor);
      if (!figur) return reply.code(403).send({ error: 'Planen darf, wer die Figur führt oder am Tisch leitet — und sie braucht ein Token auf dieser Karte.' });
      const steps = (Array.isArray(b.steps) ? b.steps : []).slice(0, 30).map(cleanStep).filter((s): s is PlanStep => !!s);
      if (!steps.length) return reply.code(422).send({ error: 'Ein Plan braucht mindestens einen Schritt.' });
      const tempo = tempoVon(werte(stand.map, statblockVon(stand.alle, figur)));
      const { problems } = planBudget(steps, tempo);
      if (problems.length) return reply.code(422).send({ error: problems.join(' ') });

      let planId = typeof b.plan === 'string' && b.plan ? b.plan : '';
      if (planId) {
        const alt = (await plaeneDerKarte(repo, karte.id)).find((p) => p.plan === planId);
        if (!alt || alt.actor !== figur.id || alt.state !== 'planned') planId = '';
      }
      const plan: TurnPlan = {
        plan: planId || `tp-${randomUUID().slice(0, 12)}`,
        map: karte.id,
        actor: figur.id,
        actorName: entityName(figur),
        by: { id: user.id, name: user.name },
        steps,
        state: 'planned',
        campaign: kampagne?.id ?? null,
        session: tischSitzung(stand.alle)?.id ?? null,
      };
      await repo.appendEvent(TURNPLAN_EVENT, karte.id, plan);
      feed.publish({ kind: 'plan', id: karte.id });
      return { ...plan, text: planText(steps) };
    },
  );

  app.post<{ Params: { id: string; plan: string }; Body: { decision?: unknown; note?: unknown } | null }>(
    '/api/maps/:id/turn-plan/:plan/decide',
    async (request, reply) => {
      const l = await lage(request, request.params.id);
      if ('fehler' in l) return reply.code(l.fehler).send({ error: l.fehler === 401 ? 'Nicht angemeldet' : 'Nicht gefunden' });
      const { user, stand, roheKarte, kampagne, leitet } = l;
      if (!leitet) return reply.code(403).send({ error: 'Bestätigen darf die Leitung.' });
      const plan = (await plaeneDerKarte(repo, roheKarte.id)).find((p) => p.plan === request.params.plan);
      if (!plan) return reply.code(404).send({ error: 'Nicht gefunden' });
      if (plan.state !== 'planned') return reply.code(409).send({ error: 'Dieser Plan ist schon entschieden.' });
      const b = request.body ?? {};
      const note = typeof b.note === 'string' ? b.note.trim().slice(0, 300) : '';
      const { at: _at, ...ohneZeit } = plan;
      const entschieden = { id: user.id, name: user.name };

      if (b.decision === 'reject') {
        const neu: TurnPlan = { ...ohneZeit, state: 'rejected', decidedBy: entschieden, ...(note ? { note } : {}) };
        await repo.appendEvent(TURNPLAN_EVENT, roheKarte.id, neu);
        feed.publish({ kind: 'plan', id: roheKarte.id });
        return neu;
      }
      if (b.decision !== 'confirm') return reply.code(422).send({ error: 'decision: confirm oder reject' });

      const figur = stand.map.get(plan.actor);
      if (!figur) return reply.code(409).send({ error: 'Die Figur gibt es nicht mehr.' });
      /* Die Kacheln **jetzt** gerechnet, nicht aus dem Plan: der Plan hält,
         was gewählt wurde, die Zahlen gehören dem Statblock (D8, D51). */
      const kacheln = new Map(kachelnVon(stand.map, statblockVon(stand.alle, figur), () => true).map((t) => [t.id, t]));
      const session = tischSitzung(stand.alle)?.id ?? null;
      const hidden =
        (kampagne?.components?.['Campaign'] as { playerRolls?: unknown } | undefined)?.playerRolls === 'gm' && plan.by.id !== user.id;
      const wurf = async (expr: string, label: string) => {
        const w = rollDice(expr, zufall);
        if (!w) return null;
        const nat = naturalD20(w);
        const payload: RollPayload = {
          expr: w.expr,
          total: w.total,
          rolls: w.rolls,
          modifier: diceModifier(w),
          ...(nat ? { nat: nat.nat } : {}),
          ...(nat?.crit ? { crit: nat.crit } : {}),
          label: label.slice(0, 120),
          by: plan.by,
          actor: { id: figur.id, name: entityName(figur) },
          campaign: kampagne?.id ?? null,
          session,
          ...(hidden ? { hidden: true as const } : {}),
        };
        await wurfEintragen({ repo, feed }, figur, payload);
        return { total: w.total, crit: nat?.crit };
      };

      const results: PlanResult[] = [];
      let karte = roheKarte;
      const rel = markersOf(karte).find((m) => m.to === figur.id)?.rel.id;
      for (const s of plan.steps) {
        if (s.kind === 'move') {
          if (rel && s.to) karte = moveMarker(karte, rel, s.to);
          results.push({ step: s.id, text: `Moved ${s.feet} ft.` });
          continue;
        }
        const t = kacheln.get(s.tile);
        const ziel = s.target ? stand.map.get(s.target) : undefined;
        if (!t || t.toHit === null || !ziel) {
          results.push({ step: s.id, text: `${s.name}${s.targetName ? ` → ${s.targetName}` : ''}` });
          continue;
        }
        const zielName = entityName(ziel);
        const angriff = await wurf(`1d20${t.toHit < 0 ? t.toHit : `+${t.toHit}`}`, `${t.name} → ${zielName}: attack`);
        const ac = rkVon(stand, ziel);
        const treffer = !!angriff && angriff.crit !== 'fumble' && (angriff.crit === 'crit' || (ac !== null && angriff.total >= ac));
        let schaden: number | undefined;
        if (treffer && t.damage) {
          /* Kritisch: die Würfel zweimal (PHB), der feste Teil einmal. */
          const ausdruck = angriff!.crit === 'crit' && /d/.test(t.damage) ? `${t.damage.replace(/\s*[+-]\s*\d+\s*$/, '')}+${t.damage}` : t.damage;
          const dmg = await wurf(ausdruck, `${t.name} → ${zielName}: damage${t.damageType ? ` (${t.damageType})` : ''}`);
          schaden = dmg?.total;
        }
        const wie = ac === null ? `rolled ${angriff?.total ?? '—'} (no AC known)` : treffer ? 'hit' : 'miss';
        results.push({
          step: s.id,
          text: `${t.name} → ${zielName}: ${wie}${schaden !== undefined ? `, ${schaden}${t.damageType ? ` ${t.damageType}` : ''} damage` : ''}`,
          ...(ac !== null ? { hit: treffer } : {}),
          ...(schaden !== undefined ? { damage: schaden } : {}),
        });
      }
      if (karte !== roheKarte) {
        const r = await schreibeGeprueft(karte);
        if ('issues' in r) return reply.code(422).send({ error: 'Die Karte liess sich nicht schreiben.', issues: r.issues });
      }
      const neu: TurnPlan = { ...ohneZeit, state: 'confirmed', decidedBy: entschieden, results, ...(note ? { note } : {}) };
      await repo.appendEvent(TURNPLAN_EVENT, roheKarte.id, neu);
      feed.publish({ kind: 'plan', id: roheKarte.id });
      return neu;
    },
  );
}

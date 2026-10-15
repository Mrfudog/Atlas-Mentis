/**
 * **Eine Begegnung beginnen** (T-203): `POST /api/encounters/:id/start`.
 *
 * Runde 1, `phase: running`, die Initiative gewürfelt für jeden, der noch
 * keine hat (W20 plus Geschicklichkeit des Statblocks, `startEncounter`),
 * jeder Wurf ins Log (T-172; die der Gegner verdeckt). Die vorplatzierten
 * Tokens auf der Karte (`marker.props.encounter`) werden Spiel-Tokens
 * (`startPrepared`), und die Sitzung führt die Begegnung
 * (`activeEncounter`) — damit Karte, Zeiger und Zugplan sie finden.
 *
 * Nur die Leitung des Tisches (`leitetTisch`), wie das Bestätigen eines
 * Zugs; geschrieben wird durch `validateEntity`.
 */

import { getRandomValues } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  currentCampaign,
  entityName,
  inParty,
  isMap,
  primaryInterface,
  rollDice,
  sessionState,
  startEncounter,
  startPrepared,
  type Entity,
  type RollPayload,
  type validateEntity,
} from '@nw/model';
import type { User } from './auth.js';
import type { ChangeFeed } from './live.js';
import type { Repository } from './repo.js';
import { leitetTisch, wurfEintragen } from './wuerfe.js';

interface Stand {
  alle: Entity[];
  map: Map<string, Entity>;
}

export interface KampfstartDeps {
  repo: Repository;
  feed: ChangeFeed;
  viewerOf: (request: FastifyRequest) => Promise<User | null>;
  roh: () => Promise<Stand>;
  geltend: (e: Entity, map: Map<string, Entity>) => Promise<Entity>;
  schreibeGeprueft: (entity: Entity) => Promise<{ stored: Entity } | { issues: ReturnType<typeof validateEntity> }>;
}

function zufall(): number {
  return getRandomValues(new Uint32Array(1))[0]! / 2 ** 32;
}

export function registerKampfstart(app: FastifyInstance, deps: KampfstartDeps): void {
  const { repo, feed, viewerOf, roh, geltend, schreibeGeprueft } = deps;

  app.post<{ Params: { id: string }; Body: { map?: unknown; session?: unknown } | undefined }>(
    '/api/encounters/:id/start',
    async (request, reply) => {
      const user = await viewerOf(request);
      if (!user) return reply.code(401).send({ error: 'Nicht angemeldet' });
      const stand = await roh();
      const gefunden = stand.map.get(request.params.id);
      if (!gefunden || primaryInterface(gefunden) !== 'Encounter') return reply.code(404).send({ error: 'Nicht gefunden' });
      const kampagne = currentCampaign(stand.map, (await repo.getRegistry()).settings ?? null);
      if (!leitetTisch(user, kampagne?.id ?? null)) return reply.code(403).send({ error: 'Eine Begegnung beginnt die Leitung.' });
      const begegnung = await geltend(gefunden, stand.map);
      const runde = Number((begegnung.components?.['Encounter'] as { round?: unknown } | undefined)?.round);
      if (runde >= 1) return reply.code(409).send({ error: 'Die Begegnung läuft schon.' });

      /* Je Teilnehmer ein W20 — gemerkt, damit der Eintrag im Log die Würfel nennt. */
      const wuerfe: NonNullable<ReturnType<typeof rollDice>>[] = [];
      const { encounter, rolled } = startEncounter(stand.map, begegnung, () => {
        const w = rollDice('1d20', zufall)!;
        wuerfe.push(w);
        return w.total;
      });
      const r = await schreibeGeprueft(encounter);
      if ('issues' in r) return reply.code(422).send({ error: 'Die Begegnung liess sich nicht schreiben.', issues: r.issues });

      /* Die Karte: genannt, sonst die, auf der sie gefochten wird. */
      const kartenId =
        typeof request.body?.map === 'string' ? request.body.map : (begegnung.relations ?? []).find((x) => x.type === 'onMap')?.to;
      const karteRoh = kartenId ? stand.map.get(kartenId) : undefined;
      let aufgedeckt = 0;
      if (karteRoh && isMap(karteRoh)) {
        const karte = await geltend(karteRoh, stand.map);
        const neu = startPrepared(karte, begegnung.id);
        aufgedeckt = (neu.relations ?? []).filter((x, i) => x !== (karte.relations ?? [])[i]).length;
        if (aufgedeckt) {
          const k = await schreibeGeprueft(neu);
          if ('issues' in k) return reply.code(422).send({ error: 'Die Karte liess sich nicht schreiben.', issues: k.issues });
        }
      }

      /* Die Sitzung führt sie: genannt, sonst die, die diese Karte auf dem Tisch hat. */
      const sitzung =
        (typeof request.body?.session === 'string' ? stand.map.get(request.body.session) : undefined) ??
        stand.alle.find((e) => primaryInterface(e) === 'Session' && !!kartenId && (sessionState(e) as { activeMap?: unknown }).activeMap === kartenId);
      if (sitzung && primaryInterface(sitzung) === 'Session') {
        const s = await geltend(sitzung, stand.map);
        const karteName = s.components?.['Session'] ? 'Session' : s.components?.['SessionState'] ? 'SessionState' : 'Session';
        const neu = { ...s, components: { ...s.components, [karteName]: { ...(s.components?.[karteName] ?? {}), activeEncounter: begegnung.id } } };
        const w = await schreibeGeprueft(neu);
        if ('issues' in w) return reply.code(422).send({ error: 'Die Sitzung liess sich nicht schreiben.', issues: w.issues });
      }

      /* Ins Log: die der Gruppe offen, die der übrigen verdeckt. */
      for (const [i, x] of rolled.entries()) {
        const w = wuerfe[i]!;
        const wer = stand.map.get(x.to) ?? null;
        const payload: RollPayload = {
          expr: `1d20${x.mod >= 0 ? '+' : ''}${x.mod}`,
          total: x.init,
          rolls: w.rolls,
          modifier: x.mod,
          nat: x.roll,
          ...(x.roll === 20 ? { crit: 'crit' as const } : x.roll === 1 ? { crit: 'fumble' as const } : {}),
          label: `Initiative — ${entityName(begegnung)}`,
          by: { id: user.id, name: user.name },
          ...(wer ? { actor: { id: wer.id, name: entityName(wer) } } : {}),
          campaign: kampagne?.id ?? null,
          session: sitzung?.id ?? null,
          ...(inParty(stand.map, x.to) ? {} : { hidden: true as const }),
        };
        await wurfEintragen({ repo, feed }, wer, payload);
      }
      return { encounter: begegnung.id, rolled: rolled.map(({ to, init }) => ({ to, init })), revealed: aufgedeckt, session: sitzung?.id ?? null };
    },
  );
}

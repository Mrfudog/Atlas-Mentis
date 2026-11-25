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
 *
 * **Eine Vorlage beginnt als Instanz** (T-289): ist die Begegnung keine
 * Instanz, nimmt der Start sie ins Spiel (`insSpiel`) — auf die Karte der
 * Sitzung, wenn die eine Instanz ihrer Karte ist, sonst auf eine neue
 * Instanz ihrer Karte. Begonnen wird die Instanz; die Vorlage bleibt
 * unberührt.
 */

import { getRandomValues } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  currentCampaign,
  entityName,
  inParty,
  isMap,
  isPlayInstance,
  primaryInterface,
  resolvePlay,
  templateOf,
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
import { mitZustand, type InsSpiel } from './spielinstanz.js';
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
  insSpiel: InsSpiel;
}

function zufall(): number {
  return getRandomValues(new Uint32Array(1))[0]! / 2 ** 32;
}

export function registerKampfstart(app: FastifyInstance, deps: KampfstartDeps): void {
  const { repo, feed, viewerOf, roh, geltend, schreibeGeprueft, insSpiel } = deps;

  app.post<{ Params: { id: string }; Body: { map?: unknown; session?: unknown } | undefined }>(
    '/api/encounters/:id/start',
    async (request, reply) => {
      const user = await viewerOf(request);
      if (!user) return reply.code(401).send({ error: 'Nicht angemeldet' });
      const roherStand = await roh();
      const stand = { alle: roherStand.alle, map: new Map(roherStand.map) };
      const gefunden = stand.map.get(request.params.id);
      if (!gefunden || primaryInterface(gefunden) !== 'Encounter') return reply.code(404).send({ error: 'Nicht gefunden' });
      const kampagne = currentCampaign(stand.map, (await repo.getRegistry()).settings ?? null);
      if (!leitetTisch(user, kampagne?.id ?? null)) return reply.code(403).send({ error: 'Eine Begegnung beginnt die Leitung.' });
      let begegnung = await geltend(gefunden, stand.map);
      const runde = Number((begegnung.components?.['Encounter'] as { round?: unknown } | undefined)?.round);
      if (runde >= 1) return reply.code(409).send({ error: 'Die Begegnung läuft schon.' });

      /* Die Karte: genannt, sonst die, auf der sie gefochten wird; die
         Sitzung: genannt, sonst die, die diese Karte (oder eine Instanz
         davon) auf dem Tisch hat. */
      let kartenId =
        typeof request.body?.map === 'string' ? request.body.map : (begegnung.relations ?? []).find((x) => x.type === 'onMap')?.to;
      const aufTisch = (e: Entity) => {
        const a = (sessionState(e) as { activeMap?: unknown }).activeMap;
        if (typeof a !== 'string' || !kartenId) return false;
        const k = stand.map.get(a);
        return a === kartenId || (!!k && templateOf(stand.map, k)?.id === kartenId);
      };
      const sitzung =
        (typeof request.body?.session === 'string' ? stand.map.get(request.body.session) : undefined) ??
        stand.alle.find((e) => primaryInterface(e) === 'Session' && aufTisch(e));
      const istSitzung = !!sitzung && primaryInterface(sitzung) === 'Session';

      /* **Eine Vorlage beginnt als Instanz** (T-289). */
      if (!isPlayInstance(gefunden)) {
        let karteImSpiel: string | null = null;
        const kRoh = kartenId ? stand.map.get(kartenId) : undefined;
        if (kRoh && isMap(kRoh)) {
          const aktiv = istSitzung ? (sessionState(sitzung!) as { activeMap?: unknown }).activeMap : undefined;
          const aktivK = typeof aktiv === 'string' ? stand.map.get(aktiv) : undefined;
          if (aktivK && isPlayInstance(aktivK) && templateOf(stand.map, aktivK)?.id === kRoh.id) karteImSpiel = aktivK.id;
          else {
            const k = await insSpiel({ stand, kampagne, template: kRoh, session: istSitzung ? sitzung! : null });
            if ('issues' in k) return reply.code(422).send({ error: 'Die Karte liess sich nicht ins Spiel nehmen.', issues: k.issues });
            karteImSpiel = k.instance.id;
          }
        }
        const b = await insSpiel({ stand, kampagne, template: gefunden, session: istSitzung ? sitzung! : null, map: karteImSpiel });
        if ('issues' in b) return reply.code(422).send({ error: 'Die Begegnung liess sich nicht ins Spiel nehmen.', issues: b.issues });
        begegnung = resolvePlay(stand.map, b.instance);
        if (Number((begegnung.components?.['Encounter'] as { round?: unknown } | undefined)?.round) >= 1) {
          return reply.code(409).send({ error: 'Die Begegnung läuft schon.' });
        }
        kartenId = karteImSpiel ?? kartenId;
      }

      /* Je Teilnehmer ein W20 — gemerkt, damit der Eintrag im Log die Würfel nennt. */
      const wuerfe: NonNullable<ReturnType<typeof rollDice>>[] = [];
      const { encounter, rolled } = startEncounter(stand.map, begegnung, () => {
        const w = rollDice('1d20', zufall)!;
        wuerfe.push(w);
        return w.total;
      });
      const r = await schreibeGeprueft(encounter);
      if ('issues' in r) return reply.code(422).send({ error: 'Die Begegnung liess sich nicht schreiben.', issues: r.issues });

      const karteRoh = kartenId ? stand.map.get(kartenId) : undefined;
      let aufgedeckt = 0;
      if (karteRoh && isMap(karteRoh)) {
        const karte = await geltend(karteRoh, stand.map);
        /* Vorplatziert wurde für die Vorlage (T-203) oder schon für die Instanz. */
        const vorlage = templateOf(stand.map, begegnung)?.id;
        const neu = vorlage ? startPrepared(startPrepared(karte, begegnung.id), vorlage) : startPrepared(karte, begegnung.id);
        aufgedeckt = (neu.relations ?? []).filter((x, i) => x !== (karte.relations ?? [])[i]).length;
        if (aufgedeckt) {
          const k = await schreibeGeprueft(neu);
          if ('issues' in k) return reply.code(422).send({ error: 'Die Karte liess sich nicht schreiben.', issues: k.issues });
        }
      }

      /* Die Sitzung führt sie — und zeigt auf die Karte, auf der sie liegt. */
      if (sitzung && istSitzung) {
        const s = await geltend(sitzung, stand.map);
        /* Lag nichts oder die Vorlage auf dem Tisch, liegt jetzt die Instanz da. */
        const aktuell = (sessionState(s) as { activeMap?: unknown }).activeMap;
        const k = kartenId ? stand.map.get(kartenId) : undefined;
        const ersetzt = !!k && isPlayInstance(k) && (typeof aktuell !== 'string' || !aktuell || templateOf(stand.map, k)?.id === aktuell);
        const neu = mitZustand(s, { activeEncounter: begegnung.id, ...(ersetzt ? { activeMap: k!.id } : {}) });
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
      return { encounter: begegnung.id, map: kartenId ?? null, rolled: rolled.map(({ to, init }) => ({ to, init })), revealed: aufgedeckt, session: sitzung?.id ?? null };
    },
  );
}

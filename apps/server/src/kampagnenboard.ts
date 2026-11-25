/**
 * **Das Kampagnenboard, von selbst** (T-342, REQ-358).
 *
 * Je Kampagne ein Board, auf dem Spielende nach der Anmeldung landen. Neue
 * Kampagnen bekommen es beim Anlegen (`POST /api/campaigns`), bestehende
 * **beim ersten Öffnen** (`sorgeKampagnenboard`, über `GET /api/home`) —
 * nicht über eine Datenmigration: die Vorlage steht einmal im Modell
 * (`newCampaignBoard`), und eine Migration müsste sie in SQL ein zweites
 * Mal hinschreiben, samt Nummernvergabe und Abfrage-Kacheln. Beim ersten
 * Öffnen nimmt sie den Stand der Vorlage von dann, und eine Kampagne, die
 * niemand mehr öffnet, bekommt nichts.
 *
 * **Einmal und nicht wieder:** angelegt wird nur, wenn noch nie eines
 * angelegt wurde (Ereignis `campaign.board`). Löscht die Leitung das
 * Board, hat sie es so gewollt — wie bei der Gruppe (T-100).
 *
 *   GET /api/home — wohin dieser Betrachter gehört: die laufende Kampagne,
 *                   seine Rolle, ihr Board (gesiebt), wo Spielende landen
 *                   und seine Figur dort. Spielende landen auf dem Board,
 *                   wenn die Kampagne es sagt; die Leitung behält ihren Start.
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  CAMPAIGN_TYPE,
  campaignBoardOf,
  currentCampaign,
  entityName,
  newCampaignBoard,
  PARTY_RELATION,
  partiesOf,
  playerStartOf,
  primaryInterface,
  validateEntity,
  type Entity,
  type TableRole,
} from '@nw/model';
import type { User } from './auth.js';
import type { Repository } from './repo.js';

/** Das Ereignis, das sagt: diese Kampagne hat ihr Board schon einmal bekommen. */
export const BOARD_EVENT = 'campaign.board';

/**
 * **Hat die Kampagne ihr Board? Sonst einmal anlegen.** Gibt das Board
 * zurück, oder `null`, wenn es keine Kampagne ist oder die Leitung es
 * gelöscht hat. Geschrieben über `validateEntity` wie überall; was nicht
 * durchgeht, wird nicht geschrieben und nicht als angelegt vermerkt.
 */
export async function sorgeKampagnenboard(repo: Repository, campaignId: string): Promise<Entity | null> {
  /* Aus der Tafel je Stand (T-398, P4); die Liste erst, wenn wirklich angelegt wird. */
  const map = await repo.entityMap();
  const kampagne = map.get(campaignId);
  if (!kampagne || primaryInterface(kampagne) !== CAMPAIGN_TYPE) return null;
  const da = campaignBoardOf(map, campaignId);
  if (da) return da;
  if ((await repo.listEvents({ name: BOARD_EVENT, subject: campaignId, limit: 1, light: true })).length) return null;
  const ebene = map.get(`ly_${campaignId}`) ? `ly_${campaignId}` : null;
  const alle = [...map.values()];
  const board = newCampaignBoard(alle, kampagne, ebene);
  const registry = await repo.getRegistry();
  const known = new Map(alle.map((e) => [e.id, e.interfaces?.[0] ?? ''] as const));
  known.set(board.id, board.interfaces[0]!);
  if (validateEntity(registry, board, { knownTypes: known }).length) return null;
  await repo.putEntity(board);
  await repo.appendEvent(BOARD_EVENT, campaignId, { board: board.id, on: 'open' });
  return board;
}

export interface KampagnenboardDeps {
  repo: Repository;
  viewerOf: (request: FastifyRequest) => Promise<User | null>;
  sieve: (request: FastifyRequest, entities: Entity[], bestand?: ReadonlyMap<string, Entity>) => Promise<Entity[]>;
}

/** Was `GET /api/home` sagt. */
export interface Heim {
  campaign: { id: string; name: string } | null;
  role: TableRole | null;
  board: { id: string; name: string } | null;
  playerStart: 'board' | 'compendium';
  /** Wohin dieser Betrachter nach der Anmeldung gehört; `null`: der gewohnte Start. */
  land: string | null;
  /** Die eigene Figur in dieser Kampagne, sonst die erste. */
  character: { id: string; name: string } | null;
}

export function registerKampagnenboard(app: FastifyInstance, deps: KampagnenboardDeps): void {
  const { repo, viewerOf, sieve } = deps;

  app.get('/api/home', async (request, reply): Promise<Heim | undefined> => {
    const user = await viewerOf(request);
    if (!user) {
      void reply.code(401).send({ error: 'Nicht angemeldet.' });
      return undefined;
    }
    const map = await repo.entityMap();
    const kampagne = currentCampaign(map, (await repo.getRegistry()).settings ?? null);
    const leer: Heim = { campaign: null, role: null, board: null, playerStart: 'board', land: null, character: null };
    if (!kampagne) return leer;
    const role = (user.roles?.[kampagne.id] ?? null) as TableRole | null;
    /* Angelegt wird nur für einen Tisch, den es gibt: wer eine Rolle hat oder verwaltet. */
    const roh = role || user.isAdmin ? await sorgeKampagnenboard(repo, kampagne.id) : campaignBoardOf(map, kampagne.id);
    const bestand = roh && !map.has(roh.id) ? new Map(map).set(roh.id, roh) : map;
    const [board] = roh ? await sieve(request, [roh], bestand) : [];
    const playerStart = playerStartOf(kampagne);
    /* Spielende und Zuschauende landen auf dem Board; die Leitung und die
       Verwaltung behalten ihren Start (T-342). */
    const spielt = role === 'player' || role === 'spectator';
    const figuren = (user.actorIds ?? []).map((id) => map.get(id)).filter((e): e is Entity => !!e);
    const gruppen = new Set(partiesOf(map, kampagne.id).map((g) => g.id));
    const figur =
      figuren.find((f) => (f.relations ?? []).some((r) => r.type === PARTY_RELATION && gruppen.has(r.to))) ?? figuren[0] ?? null;
    return {
      campaign: { id: kampagne.id, name: entityName(kampagne) },
      role,
      board: board ? { id: board.id, name: entityName(board) } : null,
      playerStart,
      land: spielt && board && playerStart === 'board' ? `/boards/${board.id}` : null,
      character: figur ? { id: figur.id, name: entityName(figur) } : null,
    };
  });
}

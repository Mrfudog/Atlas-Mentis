/**
 * **Das Kampagnenboard** (T-342): je Kampagne ein gewöhnliches Board, der
 * Ort, an dem Spielende nach der Anmeldung landen — der Titel der Runde,
 * die offenen Aufträge, die Gruppe, wo die Geschichte gerade steht, die
 * nächste Sitzung, die Gerüchte.
 *
 * **Ein Board wie jedes andere:** es hängt über `partOf` an der Kampagne
 * (wie das Board einer Sitzung an der Sitzung, REQ-205 — keine eigene
 * Kante `boardOf`), liegt in der Ebene der Kampagne und wird frei
 * bearbeitet. Was es zum Kampagnenboard macht, ist nur, dass es an der
 * Kampagne hängt; hängen mehrere, gilt `bd_<kampagne>`, sonst das älteste.
 *
 * **Gelesen, nicht kopiert** (D8): die Vorlage legt die Kampagne als Karte
 * und Abfrage-Kacheln (T-340) mit laufenden Quellen (`LIVE_SOURCES`) hin —
 * welche Szene läuft, wer in der Gruppe steht, welche Aufträge offen sind,
 * rechnet `liveArticles` beim Lesen, am Server und je Betrachter gesiebt.
 */

import { BOARD_TYPE, PLACED_RELATION } from './board.js';
import { LIVE_SOURCES, type LiveSource } from './boardquery.js';
import { nextId, primaryInterface, typeChain } from './entity.js';
import { PARTY_RELATION, partiesOf } from './knowledge.js';
import { sessionState } from './maplist.js';
import { PART_OF_RELATION } from './timeline.js';
import type { Entity, EntityId, Registry, Relation } from './types.js';
import { CAMPAIGN_TYPE, LAYER_RELATION } from './visibility.js';

const PART_OF = PART_OF_RELATION;
const SESSION_TYPE = 'Session';
const ARC_TYPE = 'Arc';
const QUEST_TYPE = 'Quest';

/** Wo Spielende nach der Anmeldung landen (`Campaign.playerStart`). */
export const PLAYER_STARTS = ['board', 'compendium'] as const;
export type PlayerStart = (typeof PLAYER_STARTS)[number];

/** Aufträge, die am Tisch noch offen sind (`Quest.progress`). */
export const OPEN_QUEST_PROGRESS = ['offered', 'accepted'] as const;

/** Die Id des Boards, das eine Kampagne von selbst bekommt — wie `pt_` und `ly_`. */
export function campaignBoardId(campaignId: EntityId): string {
  return `bd_${campaignId}`;
}

const nummer = (e: Entity) => String((e.components?.['Identity'] as { id?: unknown } | undefined)?.id ?? '');

/**
 * **Das Board einer Kampagne**: ein Board mit `partOf` auf sie —
 * `bd_<kampagne>`, wenn es das gibt, sonst das älteste (nach Nummer).
 * `null`, wenn keines an ihr hängt.
 */
export function campaignBoardOf(entities: Map<EntityId, Entity>, campaignId: EntityId): Entity | null {
  const eigenes = entities.get(campaignBoardId(campaignId));
  const haengt = (e: Entity) => (e.relations ?? []).some((r) => r.type === PART_OF && r.to === campaignId);
  if (eigenes && primaryInterface(eigenes) === BOARD_TYPE && haengt(eigenes)) return eigenes;
  return (
    [...entities.values()]
      .filter((e) => primaryInterface(e) === BOARD_TYPE && haengt(e))
      .sort((a, b) => nummer(a).localeCompare(nummer(b)) || a.id.localeCompare(b.id))[0] ?? null
  );
}

/** Die Kampagne, an der ein Board über `partOf` hängt (ein Schritt), sonst `null`. */
export function campaignOfBoard(entities: Map<EntityId, Entity>, board: Entity): EntityId | null {
  for (const r of board.relations ?? []) {
    if (r.type !== PART_OF) continue;
    const ziel = entities.get(r.to);
    if (ziel && primaryInterface(ziel) === CAMPAIGN_TYPE) return ziel.id;
  }
  return null;
}

/** Wo Spielende dieser Kampagne landen; ohne Angabe auf dem Board. */
export function playerStartOf(campaign: Entity | null | undefined): PlayerStart {
  const v = (campaign?.components?.[CAMPAIGN_TYPE] as { playerStart?: unknown } | undefined)?.playerStart;
  return (PLAYER_STARTS as readonly string[]).includes(v as string) ? (v as PlayerStart) : 'board';
}

/**
 * Die Kampagnen über einem Artikel, die `partOf`-Kette hoch (höchstens
 * zehn Schritte — eine Schleife im Bestand hält sonst die Rechnung an).
 */
function kampagnenUeber(entities: Map<EntityId, Entity>, e: Entity): EntityId[] {
  const out: EntityId[] = [];
  const gesehen = new Set<EntityId>([e.id]);
  let rand = [e];
  for (let i = 0; i < 10 && rand.length; i++) {
    const weiter: Entity[] = [];
    for (const x of rand) {
      for (const r of x.relations ?? []) {
        if (r.type !== PART_OF || gesehen.has(r.to)) continue;
        gesehen.add(r.to);
        const z = entities.get(r.to);
        if (!z) continue;
        if (primaryInterface(z) === CAMPAIGN_TYPE) out.push(z.id);
        else weiter.push(z);
      }
    }
    rand = weiter;
  }
  return out;
}

/**
 * Gehört ein Artikel zu dieser Kampagne? Über die `partOf`-Kette — und
 * ein Artikel, dessen Kette keine Kampagne erreicht, gehört niemandem
 * besonders und zählt für jede (wie ein Artikel ohne Ebene, CLAUDE.md).
 */
function gehoertZu(entities: Map<EntityId, Entity>, e: Entity, campaignId: EntityId): boolean {
  const k = kampagnenUeber(entities, e);
  return !k.length || k.includes(campaignId);
}

const zeitVon = (e: Entity): number => {
  const t = Number((e.components?.['Time'] as { sort?: unknown } | undefined)?.sort);
  return Number.isFinite(t) ? t : Number.NEGATIVE_INFINITY;
};

function laeuft(e: Entity): boolean {
  const st = sessionState(e) as { activeScene?: unknown; activeMap?: unknown; activeEncounter?: unknown };
  return [st.activeScene, st.activeMap, st.activeEncounter].some((v) => typeof v === 'string' && v !== '');
}

/**
 * **Die Sitzungen einer Kampagne, in Spielfolge** (nach `Time.sort`, dann
 * Nummer) — und welche davon die laufende ist: die späteste, an der etwas
 * im Spiel steht (Szene, Karte, Kampf), sonst die späteste überhaupt. Die
 * nächste ist die danach. Es gibt kein Feld „läuft“: was an der Sitzung
 * steht, sagt es schon (CLAUDE.md, „Was gerade läuft, steht an der Sitzung").
 */
export function sessionsOf(
  entities: Map<EntityId, Entity>,
  campaignId: EntityId,
): { all: Entity[]; current: Entity | null; next: Entity | null } {
  const all = [...entities.values()]
    .filter((e) => primaryInterface(e) === SESSION_TYPE && gehoertZu(entities, e, campaignId))
    .sort((a, b) => zeitVon(a) - zeitVon(b) || nummer(a).localeCompare(nummer(b)) || a.id.localeCompare(b.id));
  const mitSpiel = all.filter(laeuft);
  const current = mitSpiel[mitSpiel.length - 1] ?? all[all.length - 1] ?? null;
  const i = current ? all.indexOf(current) : -1;
  return { all, current, next: i >= 0 ? (all[i + 1] ?? null) : null };
}

/** Der nächste Arc über einem Artikel, die `partOf`-Kette hoch. */
function arcUeber(registry: Pick<Registry, 'interfaces'>, entities: Map<EntityId, Entity>, e: Entity): Entity | null {
  const gesehen = new Set<EntityId>([e.id]);
  let x: Entity | undefined = e;
  for (let i = 0; i < 10 && x; i++) {
    const r: Relation | undefined = (x.relations ?? []).find((r) => r.type === PART_OF && !gesehen.has(r.to));
    if (!r) return null;
    gesehen.add(r.to);
    x = entities.get(r.to);
    if (x && typeChain(registry, primaryInterface(x)).includes(ARC_TYPE)) return x;
  }
  return null;
}

/**
 * **Was eine laufende Quelle gerade bringt** — Ids, roh aus dem Bestand;
 * gesiebt wird danach wie jede Abfrage, am Server und je Betrachter.
 *
 *  - `session`: die laufende Sitzung (`sessionsOf`), `nextSession` die danach.
 *  - `scene`: die Szene im Spiel an der laufenden Sitzung (`activeScene`).
 *  - `arc`: der Arc über dieser Szene; ohne Szene der über der Sitzung.
 *  - `party`: die Figuren in der Gruppe der Kampagne (`memberOfParty`).
 *  - `quests`: Aufträge, die am Tisch offen sind (`offered`, `accepted`).
 */
export function liveArticles(
  registry: Pick<Registry, 'interfaces'>,
  entities: Map<EntityId, Entity>,
  campaignId: EntityId | null,
  sources: readonly string[],
): EntityId[] {
  if (!campaignId || !sources.length) return [];
  const out = new Set<EntityId>();
  const s = sessionsOf(entities, campaignId);
  const st = s.current ? (sessionState(s.current) as { activeScene?: unknown }) : {};
  const szene = typeof st.activeScene === 'string' ? entities.get(st.activeScene) : undefined;
  for (const q of sources as readonly LiveSource[]) {
    if (!(LIVE_SOURCES as readonly string[]).includes(q)) continue;
    if (q === 'session' && s.current) out.add(s.current.id);
    if (q === 'nextSession' && s.next) out.add(s.next.id);
    if (q === 'scene' && szene) out.add(szene.id);
    if (q === 'arc') {
      const arc = (szene && arcUeber(registry, entities, szene)) || (s.current && arcUeber(registry, entities, s.current));
      if (arc) out.add(arc.id);
    }
    if (q === 'party') {
      const gruppen = new Set(partiesOf(entities, campaignId).map((g) => g.id));
      for (const e of entities.values()) {
        if ((e.relations ?? []).some((r) => r.type === PARTY_RELATION && gruppen.has(r.to))) out.add(e.id);
      }
    }
    if (q === 'quests') {
      for (const e of entities.values()) {
        if (!typeChain(registry, primaryInterface(e)).includes(QUEST_TYPE)) continue;
        const p = (e.components?.['Quest'] as { progress?: unknown } | undefined)?.progress;
        if ((OPEN_QUEST_PROGRESS as readonly string[]).includes(p as string) && gehoertZu(entities, e, campaignId)) out.add(e.id);
      }
    }
  }
  return [...out];
}

/**
 * **Die Vorlage des Kampagnenboards**: die Kampagne als Karte (Titel und
 * Bild, gelesen), daneben Abfrage-Kacheln — wo die Geschichte steht (Arc,
 * Szene), die nächste Sitzung, die Gruppe, die offenen Aufträge und die
 * Gerüchte (Marke `rumour`, zum Ziehen). Alles danach ist ein gewöhnliches
 * Board: verschieben, löschen, dazulegen.
 *
 * In der Ebene der Kampagne (`ebeneId`), damit es ihr gehört, und fertig,
 * damit die Spielenden es sehen.
 */
export function newCampaignBoard(
  alle: Iterable<Pick<Entity, 'components'>>,
  campaign: Entity,
  ebeneId: string | null,
): Entity {
  const id = campaignBoardId(campaign.id);
  const name = `${campaign.name || 'Campaign'} board`;
  const abfrage = (
    key: string,
    title: string,
    query: Record<string, unknown>,
    lage: { x: number; y: number; w: number; h: number },
    extra: Record<string, unknown> = {},
  ): Relation => ({ id: `${id}~placed-${key}`, type: PLACED_RELATION, to: id, props: { ...lage, z: 1, title, query, display: 'list', ...extra } });
  return {
    id,
    interfaces: [BOARD_TYPE],
    name,
    components: {
      Identity: { name, id: nextId(alle, BOARD_TYPE), aliases: [] },
      Status: { status: 'ready' },
      Description: { description: 'Where the table starts: the campaign, what is going on, the party and the open quests.' },
    },
    relations: [
      { id: `${id}~partOf`, type: PART_OF, to: campaign.id, props: {} },
      ...(ebeneId ? [{ id: `${id}~inLayer-1`, type: LAYER_RELATION, to: ebeneId, props: {} }] : []),
      { id: `${id}~placed-campaign`, type: PLACED_RELATION, to: campaign.id, props: { x: 40, y: 40, w: 420, h: 300, z: 1 } },
      abfrage('now', 'Now playing', { current: ['arc', 'scene'] }, { x: 500, y: 40, w: 340, h: 300 }),
      abfrage('next', 'Next session', { current: ['nextSession'] }, { x: 880, y: 40, w: 300, h: 300 }),
      abfrage('party', 'The party', { current: ['party'] }, { x: 40, y: 380, w: 420, h: 300 }),
      abfrage('quests', 'Open quests', { current: ['quests'] }, { x: 500, y: 380, w: 340, h: 300 }),
      abfrage('rumours', 'Rumours', { tags: ['rumour'] }, { x: 880, y: 380, w: 300, h: 300 }, { display: 'draw' }),
    ],
  };
}

/**
 * **Die Seitenleiste der Karte** (T-203): wer zur Gruppe gehört, mit
 * Trefferpunkten und Zuständen, und welche Begegnungen zur Sitzung gehören.
 * Gerechnet wird über einen Bestand, den der Aufrufer schon gesiebt hat —
 * was hier fehlt, sieht der Betrachter nicht (`redactEntity` am Server).
 */

import { entityName, primaryInterface } from './entity.js';
import { statblockFor, PARTICIPATES } from './initiative.js';
import { INSTANCE_RELATION, resolveInstance, templateOf } from './instance.js';
import { isPlayInstance, playedInfo, resolvePlay } from './playinstance.js';
import { PARTY_RELATION } from './knowledge.js';
import { markersOf, participantLabel } from './map.js';
import type { Entity, EntityId } from './types.js';

type Lookup = ReadonlyMap<EntityId, Entity>;

/** Eine Figur der Gruppe in der Seitenleiste. */
export interface SideFigure {
  id: EntityId;
  name: string;
  /** Stand (`Vitals.hp`), Maximum (Statblock), temporäre TP — `null`, wo nichts dasteht oder es zurückgehalten ist. */
  hp: number | null;
  hpMax: number | null;
  hpTemp: number | null;
  conditions: { id: EntityId; name: string }[];
}

/** Eine Begegnung der Sitzung: wo sie steht und wer mitmacht. */
export interface SideEncounter {
  id: EntityId;
  name: string;
  phase: string;
  round: number;
  /** Was für eine Begegnung (`Encounter.kind`, T-178/T-184); leer: nicht gesagt. */
  kind: string[];
  /** Sie wird auf dieser Karte gefochten (`onMap`). */
  here: boolean;
  /** Die Sitzung führt sie gerade (`activeEncounter`). */
  active: boolean;
  participants: { id: EntityId; name: string }[];
}

const zahl = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Die Figuren einer Gruppe (`memberOfParty`), nach Namen. */
export function partyMembers(entities: Lookup, partyId: EntityId): Entity[] {
  return [...entities.values()]
    .filter((e) => (e.relations ?? []).some((r) => r.type === PARTY_RELATION && r.to === partyId))
    .sort((a, b) => entityName(a).localeCompare(entityName(b), 'de') || a.id.localeCompare(b.id));
}

/** Trefferpunkte und Zustände einer Figur; das Maximum steht am Statblock (D53), aufgelöst gegen seine Vorlage. */
export function sideFigure(entities: Lookup, e: Entity): SideFigure {
  const v = (e.components?.['Vitals'] ?? {}) as { hp?: unknown; hpTemp?: unknown; conditions?: unknown };
  const sb = statblockFor(entities, e);
  const karte = sb ? ((resolveInstance(entities, sb).components ?? {})['Statblock'] ?? {}) : {};
  const ids = Array.isArray(v.conditions) ? v.conditions.filter((x): x is string => typeof x === 'string') : [];
  return {
    id: e.id,
    name: entityName(e),
    hp: zahl(v.hp),
    hpMax: zahl((karte as { hp?: unknown }).hp),
    hpTemp: zahl(v.hpTemp),
    conditions: ids.flatMap((id) => {
      const c = entities.get(id);
      return c ? [{ id, name: entityName(c) }] : [];
    }),
  };
}

/** Wie tief eine Begegnung unter der Sitzung hängen darf (Sitzung › Szene › Begegnung, mit Luft). */
const TIEFE = 4;

/**
 * **Die Begegnungen einer Sitzung**: was über `partOf` unter ihr hängt
 * (auch über Szenen), die, die sie führt (`activeEncounter`), und was auf
 * dieser Karte gefochten wird (`onMap`). Laufende zuerst, dann nach Namen.
 *
 * **Im Spiel** (T-289): liegt eine Karteninstanz auf dem Tisch, zählen die
 * Begegnungen der Vorlage mit, und hat diese Sitzung eine davon schon als
 * Instanz genommen, steht die Instanz an ihrer Stelle — mit ihren
 * Teilnehmern, aufgelöst. Instanzen anderer Runden stehen nicht da.
 */
export function sessionEncounters(entities: Lookup, session: Entity | null, mapId: EntityId | null): SideEncounter[] {
  const st = (session?.components?.['SessionState'] ?? session?.components?.['Session'] ?? {}) as { activeEncounter?: unknown };
  const aktiv = typeof st.activeEncounter === 'string' ? st.activeEncounter : null;
  const unter = new Set<EntityId>(session ? [session.id] : []);
  const alle = [...entities.values()];
  for (let i = 0; i < TIEFE && session; i += 1) {
    for (const e of alle) {
      if ((e.relations ?? []).some((r) => r.type === 'partOf' && unter.has(r.to))) unter.add(e.id);
    }
  }
  const karte = mapId ? entities.get(mapId) : undefined;
  const vorlage = karte ? templateOf(entities, karte)?.id : undefined;
  const hier = (e: Entity, ids: (EntityId | undefined)[]) =>
    (e.relations ?? []).some((r) => r.type === 'onMap' && ids.includes(r.to));
  /* Welche Vorlagen diese Sitzung schon als Instanz spielt. */
  const gespielt = new Set<EntityId>();
  for (const e of alle) {
    if (primaryInterface(e) !== 'Encounter' || !isPlayInstance(e) || !session || playedInfo(e).session !== session.id) continue;
    const t = (e.relations ?? []).find((r) => r.type === INSTANCE_RELATION)?.to;
    if (t) gespielt.add(t);
  }
  return alle
    .filter((e) => primaryInterface(e) === 'Encounter')
    .filter((e) => {
      if (isPlayInstance(e)) return e.id === aktiv || (!!session && playedInfo(e).session === session.id) || (!!mapId && hier(e, [mapId]));
      if (gespielt.has(e.id)) return false;
      return e.id === aktiv || (session && unter.has(e.id)) || (mapId && hier(e, [mapId, vorlage]));
    })
    .map((roh) => {
      const e = resolvePlay(entities, roh);
      const c = (e.components?.['Encounter'] ?? {}) as { phase?: unknown; round?: unknown; kind?: unknown };
      return {
        id: e.id,
        name: entityName(e),
        phase: typeof c.phase === 'string' ? c.phase : 'planned',
        round: zahl(c.round) ?? 0,
        kind: Array.isArray(c.kind) ? c.kind.filter((k): k is string => typeof k === 'string') : [],
        here: !!mapId && hier(e, [mapId, vorlage]),
        active: e.id === aktiv,
        participants: (e.relations ?? [])
          .filter((r) => r.type === PARTICIPATES && r.to)
          .map((r) => ({ id: r.to, name: participantLabel(entities, r) })),
      };
    })
    .sort((a, b) => Number(b.active) - Number(a.active) || Number(b.round > 0) - Number(a.round > 0) || a.name.localeCompare(b.name, 'de'));
}

/** Je Ziel der Marker auf der Karte (für „zentrieren"); das erste, wenn eines mehrere hat. */
export function markerByTarget(map: Entity): Map<EntityId, { rel: string; x: number; y: number }> {
  const out = new Map<EntityId, { rel: string; x: number; y: number }>();
  for (const m of markersOf(map)) if (!out.has(m.to)) out.set(m.to, { rel: m.rel.id, x: m.x, y: m.y });
  return out;
}

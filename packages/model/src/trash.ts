/**
 * **Der Papierkorb** (T-400, E-160 a).
 *
 * Ein Papierkorb ist keine zweite Ablage: jedes Löschen aus der eigenen
 * Ebene (T-381) ist ein Lauf `bulk` mit `kind: 'delete-own'`, und der
 * trägt jede alte Fassung im Protokoll. Der Papierkorb ist eine Seite auf
 * diesen Läufen — hier steht, was sie zeigt und wie ein **einzelner**
 * Artikel daraus zurückkommt, ohne den ganzen Lauf zurückzunehmen.
 *
 * Rein: wer welchen Lauf sieht und ob er endgültig ist, sagt der Server.
 */

import { entityName, primaryInterface } from './entity.js';
import type { Entity, EntityId, Registry, Relation } from './types.js';
import { layersOf } from './versions.js';

/**
 * **Dreissig Tage**, fest (E-160 a). Keine Einstellung: eine Frist, die
 * jemand still anhebt, hält Bilddateien und alte Fassungen länger, als
 * die Leitung beim Entscheid annahm. Ändern heisst neu entscheiden.
 */
export const TRASH_DAYS = 30;

const TAG = 24 * 60 * 60 * 1000;

/** Wann ein Lauf, gelöscht um `at`, endgültig wird. */
export function trashExpires(at: string, days = TRASH_DAYS): string {
  return new Date(Date.parse(at) + days * TAG).toISOString();
}

export function trashExpired(at: string, now: number = Date.now(), days = TRASH_DAYS): boolean {
  return now >= Date.parse(at) + days * TAG;
}

/** Eine Änderung eines Laufs, wie sie im Protokoll steht. */
export interface TrashChange {
  id: EntityId;
  before: Entity | null;
  after: Entity | null;
}

/** Ein gelöschter Artikel, wie die Seite „Deleted" ihn zeigt. */
export interface TrashItem {
  id: EntityId;
  name: string;
  type: string;
  layers: EntityId[];
  /** Wie viele Teile mit ihm gingen (ein Inventar, eine Instanz). */
  parts: number;
  /** Steht er wieder da? */
  restored: boolean;
}

/**
 * Welcher ausgewählte Artikel ein mitgegangenes Teil mitnahm — die
 * Rückrichtung von `teileDazu`, gelesen aus den alten Fassungen: ein
 * Halter trägt das Teil (`asField: 'from'`, `holds`), oder das Teil
 * gehört an seinen Halter (`asField: 'to'`). Was sich nicht zuordnen
 * lässt, geht mit dem ersten — besser einmal zu viel zurück als ein Teil,
 * das nie wiederkommt.
 */
export function trashParts(
  registry: Pick<Registry, 'relations'>,
  changes: readonly TrashChange[],
  mainIds: readonly EntityId[],
): Map<EntityId, EntityId> {
  const traegt = new Set<string>(['holds']);
  const gehoertAn = new Set<string>();
  for (const r of Object.values(registry.relations)) {
    if (r.asField === 'from') traegt.add(r.type);
    if (r.asField === 'to') gehoertAn.add(r.type);
  }
  const haupt = new Set(mainIds);
  const weg = new Map(changes.filter((c) => c.before && !c.after).map((c) => [c.id, c.before!]));
  const von = new Map<EntityId, EntityId>();
  for (const [id, e] of weg) {
    if (haupt.has(id)) continue;
    const eigen = (e.relations ?? []).find((r) => gehoertAn.has(r.type) && weg.has(r.to))?.to;
    const halter = [...weg.values()].find((h) => h.id !== id && (h.relations ?? []).some((r) => r.to === id && traegt.has(r.type)))?.id;
    const v = eigen ?? halter;
    if (v) von.set(id, v);
  }
  const wurzel = new Map<EntityId, EntityId>();
  for (const id of weg.keys()) {
    if (haupt.has(id)) continue;
    let w: EntityId | undefined = id;
    const gesehen = new Set<EntityId>();
    while (w && !haupt.has(w) && !gesehen.has(w)) {
      gesehen.add(w);
      w = von.get(w);
    }
    const ziel = w && haupt.has(w) ? w : mainIds[0];
    if (ziel) wurzel.set(id, ziel);
  }
  return wurzel;
}

/** Die gelöschten Artikel eines Laufs, in der Reihenfolge der Auswahl. */
export function trashItems(
  registry: Pick<Registry, 'relations'>,
  changes: readonly TrashChange[],
  mainIds: readonly EntityId[],
  /** Kam er schon zurück? Am Server: aus dem Protokoll, nicht aus dem
   *  Bestand — ein später wieder gelöschter Artikel steht sonst in zwei Läufen. */
  restored: (id: EntityId) => boolean,
): TrashItem[] {
  const teile = trashParts(registry, changes, mainIds);
  const vorher = new Map(changes.map((c) => [c.id, c.before]));
  const out: TrashItem[] = [];
  for (const id of mainIds) {
    const e = vorher.get(id);
    if (!e) continue;
    out.push({
      id,
      name: entityName(e) || id,
      type: primaryInterface(e),
      layers: layersOf(e),
      parts: [...teile.values()].filter((w) => w === id).length,
      restored: restored(id),
    });
  }
  return out;
}

export interface RestorePlan {
  /** Was zu schreiben ist; `before` ist der heutige Stand. */
  changes: { id: EntityId; before: Entity | null; after: Entity }[];
  /** Die ausgewählten Artikel, die zurückkommen. */
  restored: EntityId[];
}

/**
 * **Einzelne Artikel aus einem Löschlauf zurück** (T-400). Zurück kommen
 * die gewählten (ohne Wahl: alle), die heute fehlen, samt ihren Teilen —
 * und **nur ihre** Kanten: ein Artikel, der im Lauf seine Kanten auf
 * Markt und Hafen verlor, bekommt beim Hafen nur die auf den Hafen
 * zurück. Eine Kante auf etwas, das noch im Papierkorb liegt, bleibt weg,
 * bis es kommt; dann holt dieser Plan sie nach. Das Zurücknehmen des
 * ganzen Laufs (`/api/bulk/:id/undo`) bleibt, wie es ist.
 */
export function planRestore(
  registry: Pick<Registry, 'relations'>,
  changes: readonly TrashChange[],
  mainIds: readonly EntityId[],
  pick: readonly EntityId[] | undefined,
  current: ReadonlyMap<EntityId, Entity>,
): RestorePlan {
  const gewaehlt = new Set(pick ?? mainIds);
  const restored = mainIds.filter((id) => gewaehlt.has(id) && !current.has(id));
  const teile = trashParts(registry, changes, mainIds);
  const zurueck = new Set<EntityId>(restored);
  for (const [teil, w] of teile) if (zurueck.has(w) && !current.has(teil)) zurueck.add(teil);
  const da = (id: EntityId) => current.has(id) || zurueck.has(id);

  const out: RestorePlan['changes'] = [];
  for (const c of changes) {
    if (!c.before) continue;
    if (zurueck.has(c.id)) {
      const e = structuredClone(c.before);
      e.relations = (e.relations ?? []).filter((r) => da(r.to));
      out.push({ id: c.id, before: null, after: e });
      continue;
    }
    const jetzt = current.get(c.id);
    if (!jetzt) continue;
    const hat = new Set((jetzt.relations ?? []).map((r) => r.id));
    const fehlt: Relation[] = (c.before.relations ?? []).filter((r) => zurueck.has(r.to) && !hat.has(r.id));
    if (!fehlt.length) continue;
    out.push({ id: c.id, before: jetzt, after: { ...structuredClone(jetzt), relations: [...(jetzt.relations ?? []), ...structuredClone(fehlt)] } });
  }
  return { changes: out, restored };
}

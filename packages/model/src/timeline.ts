/**
 * **Zeitleisten der Weltgeschichte** (REQ-220, D57). Eine **Spur** ist ein
 * Ereignis mit Spanne (`Time.sort` … `Time.untilSort`): ein Krieg, eine
 * Dynastie, ein Zeitalter. Was in einer Spur liegt, sagt die Kante
 * `partOf` — **nicht** der Zeitraum. Läge darin, was in die Spanne fällt,
 * stünde jede Hochzeit im Norden im Krieg im Süden; eine Spur ist eine
 * Geschichte und kein Zeitfenster. Die Spanne prüft nur mit: was über die
 * Kante drinliegt und ausserhalb fällt, wird genannt (`outside`), nicht
 * verschoben und nicht abgelehnt.
 *
 * Die Regeln:
 *
 *  - Ein Artikel liegt in der **nächsten Spur** über seine `partOf`-Kette.
 *    Ein Glied dazwischen, das keine Spur ist oder nicht gesehen wird, wird
 *    übersprungen — ein verborgener Krieg verrät sich nicht dadurch, dass
 *    seine Schlachten fehlen, und sie fallen auch nicht heraus.
 *  - Eine Spur in einer Spur ist **beides**: ein Balken in der äusseren und
 *    eine eigene Spur darunter. Ihr Inhalt steht nur in ihr, nicht noch
 *    einmal in der äusseren.
 *  - **Die Kampagne ist eine Spur.** Was keine Spur enthält, gehört ihr:
 *    Sitzungen, Aufträge, Ereignisse am Tisch. Liegt sie selbst über
 *    `partOf` in einer Spur (einem Zeitalter), hängt sie darunter. Ihre Spanne ist ihre eigene
 *    (`Time` an der Kampagne), sonst die ihres Inhalts — beim Lesen
 *    gerechnet (D8), nie gespeichert.
 *  - Sortiert wird nach `sort`, dem Wert im **Weltkalender** (`World.calendar`):
 *    alle Kampagnen einer Welt lesen ihre Daten so, also liegen alle Spuren
 *    auf einer Achse.
 *
 * Wer was sieht, sagt der Aufrufer (`visible`, `dated`): die Sichtbarkeit
 * (`articleVisible`) und ob das Datum zum Wissen gehört, das der
 * Betrachter hat. Ein Artikel, dessen Zeit man nicht kennt, steht nicht
 * auf der Leiste — man wüsste nicht, wo.
 */

import type { Entity, EntityId } from './types.js';

export const TIME_COMPONENT = 'Time';
export const EVENT_TYPE = 'Event';
export const PART_OF_RELATION = 'partOf';

/** Wann ein Artikel steht: ein Punkt (`until` fehlt) oder eine Spanne. */
export interface TimeSpan {
  sort: number;
  until?: number;
  display?: string;
  untilDisplay?: string;
}

/** Ein Eintrag in einer Spur. */
export interface TimelineItem {
  id: EntityId;
  span: TimeSpan;
  /** Selbst eine Spur (nur bei Ereignissen mit Spanne). */
  track: boolean;
}

export interface TimelineLane {
  id: EntityId;
  kind: 'track' | 'campaign';
  /** Die Spur, in der diese liegt; `null` zuoberst. */
  parent: EntityId | null;
  depth: number;
  /** Von–bis auf der Achse; an der Kampagne ohne eigene Zeit gerechnet. */
  from: number;
  to: number;
  /** Ob die Spanne aus dem Inhalt gerechnet ist (nur Kampagne). */
  derived: boolean;
  items: TimelineItem[];
  /** Was über die Kante drinliegt, aber ausserhalb der Spanne fällt. */
  outside: EntityId[];
}

export interface TimelineOptions {
  /** Die Kampagne, deren Spur gezeichnet wird; ohne sie keine Kampagnenspur. */
  campaign?: Entity | null;
  /** Wird der Artikel überhaupt gesehen? (`articleVisible`) */
  visible?: (e: Entity) => boolean;
  /** Kennt der Betrachter sein Datum? (Wissen um `Time.*`) */
  dated?: (e: Entity) => boolean;
  /** Gehört ein Artikel ohne Spur dieser Kampagne? (z. B. nicht einer anderen) */
  inCampaign?: (e: Entity) => boolean;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Die Zeit eines Artikels, oder `null`, wenn er keinen sortierbaren Wert trägt. */
export function timeSpan(e: Entity): TimeSpan | null {
  const t = e.components?.[TIME_COMPONENT] as Record<string, unknown> | undefined;
  if (!t) return null;
  const sort = num(t.sort);
  if (sort === null) return null;
  const until = num(t.untilSort);
  const out: TimeSpan = { sort };
  /* Ein Ende vor dem Anfang ist ein Tippfehler und keine Spanne. */
  if (until !== null && until >= sort) out.until = until;
  if (typeof t.display === 'string' && t.display) out.display = t.display;
  if (typeof t.until === 'string' && t.until) out.untilDisplay = t.until;
  return out;
}

/** Ein Ereignis mit Spanne — das, was eine Spur ist. */
export function isTrack(e: Entity): boolean {
  if ((e.interfaces ?? [])[0] !== EVENT_TYPE) return false;
  const s = timeSpan(e);
  return !!s && s.until !== undefined;
}

/** Die Weltgeschichte: alle Spuren samt der Kampagne, in Baumreihenfolge. */
export function worldHistory(entities: Map<EntityId, Entity>, opts: TimelineOptions = {}): TimelineLane[] {
  const visible = opts.visible ?? (() => true);
  const dated = opts.dated ?? (() => true);
  const inCampaign = opts.inCampaign ?? (() => true);
  const camp = opts.campaign ?? null;

  const spanOf = (e: Entity): TimeSpan | null => (visible(e) && dated(e) ? timeSpan(e) : null);
  const trackIds = new Set<EntityId>();
  for (const e of entities.values()) if (visible(e) && dated(e) && isTrack(e)) trackIds.add(e.id);

  /** Die nächsten Spuren über die `partOf`-Kette; leer heisst: keine. */
  const parentsOf = (e: Entity): EntityId[] => {
    const out = new Set<EntityId>();
    const seen = new Set<EntityId>([e.id]);
    const walk = (x: Entity) => {
      for (const r of x.relations ?? []) {
        if (r.type !== PART_OF_RELATION || seen.has(r.to)) continue;
        seen.add(r.to);
        if (trackIds.has(r.to)) { out.add(r.to); continue; }
        /* Die Kampagne ist eine Spur: was in ihr liegt, bleibt in ihr. */
        if (camp && r.to === camp.id) continue;
        const next = entities.get(r.to);
        if (next) walk(next);
      }
    };
    walk(e);
    return [...out];
  };

  const lanes = new Map<EntityId, TimelineLane>();
  for (const id of trackIds) {
    const s = timeSpan(entities.get(id)!)!;
    lanes.set(id, { id, kind: 'track', parent: null, depth: 0, from: s.sort, to: s.until!, derived: false, items: [], outside: [] });
  }
  const campItems: TimelineItem[] = [];

  for (const e of entities.values()) {
    if (camp && e.id === camp.id) continue;
    const s = spanOf(e);
    if (!s) continue;
    const parents = parentsOf(e);
    const item: TimelineItem = { id: e.id, span: s, track: trackIds.has(e.id) };
    if (parents.length) {
      for (const p of parents) lanes.get(p)!.items.push(item);
      /* Eine Spur hängt unter der ersten Spur, in der sie liegt; ein
         zweiter Elternteil zeigt sie als Balken, nicht als zweite Spur. */
      if (item.track) lanes.get(e.id)!.parent = parents[0]!;
    } else if (!item.track && camp && inCampaign(e)) {
      campItems.push(item);
    }
  }

  if (camp) {
    const own = spanOf(camp);
    let from: number | null = own ? own.sort : null;
    let to: number | null = own ? (own.until ?? own.sort) : null;
    let derived = false;
    if (!own || own.until === undefined) {
      /* Ohne eigene Spanne: die des Inhalts (D8, beim Lesen gerechnet). */
      for (const it of campItems) {
        const end = it.span.until ?? it.span.sort;
        if (!own && (from === null || it.span.sort < from)) from = it.span.sort;
        if (to === null || end > to) to = end;
      }
      derived = campItems.length > 0;
    }
    if (from !== null && to !== null) {
      /* Liegt die Kampagne selbst in einer Spur (`partOf` auf ein
         Zeitalter), hängt sie darunter und steht dort als Balken. */
      const parents = visible(camp) ? parentsOf(camp) : [];
      const span: TimeSpan = { sort: from, until: to };
      for (const p of parents) lanes.get(p)!.items.push({ id: camp.id, span, track: true });
      lanes.set(camp.id, {
        id: camp.id, kind: 'campaign', parent: parents[0] ?? null, depth: 0, from, to, derived, items: campItems, outside: [],
      });
    }
  }

  const bySort = (a: { from: number; id: string }, b: { from: number; id: string }) =>
    a.from - b.from || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  for (const l of lanes.values()) {
    l.items.sort((a, b) => a.span.sort - b.span.sort || (a.id < b.id ? -1 : 1));
    if (l.kind === 'track' || !l.derived) {
      l.outside = l.items
        .filter((it) => it.span.sort < l.from || (it.span.until ?? it.span.sort) > l.to)
        .map((it) => it.id);
    }
  }

  /* Baumreihenfolge: zuoberst nach Anfang, darunter die Kinder. Ein Kreis
     aus `partOf` hat keine Wurzel — seine Spuren kommen zuoberst dazu. */
  const out: TimelineLane[] = [];
  const placed = new Set<EntityId>();
  const kids = (id: EntityId | null) => [...lanes.values()].filter((l) => l.parent === id).sort(bySort);
  const place = (l: TimelineLane, depth: number) => {
    if (placed.has(l.id)) return;
    placed.add(l.id);
    l.depth = depth;
    out.push(l);
    for (const k of kids(l.id)) place(k, depth + 1);
  };
  for (const l of kids(null)) place(l, 0);
  for (const l of [...lanes.values()].sort(bySort)) if (!placed.has(l.id)) { l.parent = null; place(l, 0); }
  return out;
}

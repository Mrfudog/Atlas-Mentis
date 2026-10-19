/**
 * **Karten und Begegnungen im Spiel** (T-289, E-039, E-041): wer eine Karte
 * oder Begegnung auf den Tisch nimmt, nimmt eine **Instanz** davon — wie
 * eine Wache aus einem Statblock (`instance.ts`). Tokens, Nebel, Freigabe
 * und Kampfstand stehen an der Instanz; die Vorlage bleibt unberührt.
 * Dieselbe Karte in zwei Runden hat zwei Instanzen, und die zweite Runde
 * sieht die Tokens der ersten nicht.
 *
 * - **Freigabe** (`Map.released`): eine Karteninstanz ist für Spielende
 *   **nicht vorhanden**, bis die Leitung sie freigibt — nicht in Listen,
 *   nicht über die Id, nicht im Live-Kanal (`heldBackMap`, gefragt in
 *   `articleVisible`). Mit der Freigabe gilt sofort der Nebel: die Instanz
 *   entsteht mit Nebel an und nichts aufgedeckt.
 * - **Stand später ansehen**: die Instanzen bleiben stehen. Die Vorlage
 *   listet sie unter „Played" (`playedOf`) — Datum, Sitzung, Begegnung. Das
 *   ist die bewusste Ausnahme von „Instanzen stehen in keiner Liste": eine
 *   gespielte Karte ist ein Stand, den man wiederfinden will, und zwar
 *   genau dort, wo man nach ihr sucht — an ihrer Vorlage, sonst nirgends.
 *
 * **Stockwerke** (T-307, E-108) kommen als Ebenen derselben Karte dazu:
 * eine Instanz je Gebäude, und Formen und Marker tragen dann ihre Ebene
 * (`floor`) — die Instanz bleibt eine.
 */

import {
  INSTANCE_RELATION,
  isInstance,
  newInstance,
  resolveInstance,
  templateOf,
} from "./instance.js";
import { entityName, primaryInterface } from "./entity.js";
import type { Entity, EntityId } from "./types.js";

/** Was als Instanz auf den Tisch kommt. */
export const PLAY_INSTANCE_TYPES: readonly string[] = ["Map", "Encounter"];
/** Die Karte, die sagt, wann und wo gespielt wurde. */
export const PLAYED_COMPONENT = "Played";

type Lookup = ReadonlyMap<EntityId, Entity>;

/** Ist das eine Karte oder Begegnung im Spiel? */
export function isPlayInstance(e: Entity | undefined): boolean {
  return (
    !!e && PLAY_INSTANCE_TYPES.includes(primaryInterface(e)) && isInstance(e)
  );
}

/** Hat die Leitung diese Karte freigegeben? */
export function isReleased(e: Entity): boolean {
  return (
    (e.components?.["Map"] as { released?: unknown } | undefined)?.released ===
    true
  );
}

/**
 * **Ist diese Karte für Spielende nicht vorhanden?** Eine Karteninstanz,
 * die die Leitung noch nicht freigegeben hat. Eine Vorlage nie — für sie
 * gilt die Sichtbarkeit wie für jeden Artikel.
 */
export function heldBackMap(e: Entity): boolean {
  return primaryInterface(e) === "Map" && isInstance(e) && !isReleased(e);
}

/** Wann und in welcher Sitzung, wie es an der Instanz steht. */
export function playedInfo(e: Entity): {
  at: string;
  session: EntityId | null;
} {
  const p = (e.components?.[PLAYED_COMPONENT] ?? {}) as {
    playedAt?: unknown;
    playedIn?: unknown;
  };
  return {
    at: typeof p.playedAt === "string" ? p.playedAt : "",
    session: typeof p.playedIn === "string" && p.playedIn ? p.playedIn : null,
  };
}

/**
 * **Eine Instanz für den Tisch.** Wie jedes Stück (`newInstance`): Name und
 * Nummer eigen, alles Übrige von der Vorlage. Dazu: wann und in welcher
 * Sitzung (`Played`), die Sichtbarkeit der Vorlage (sie wird sonst nicht
 * vererbt, und eine Begegnung nur für die Leitung soll nicht als Instanz
 * offen dastehen), und
 *
 * - an einer **Karte**: Nebel an, nichts aufgedeckt, nicht freigegeben —
 *   der Nebel der Vorlage gilt der Instanz nicht (E-041);
 * - an einer **Begegnung**: `onMap` auf die Karteninstanz, wenn eine
 *   genannt ist.
 */
export function newPlayInstance(
  template: Entity,
  opts: {
    id: EntityId;
    number: string;
    layer?: EntityId | null;
    session?: EntityId | null;
    at: string;
    map?: EntityId | null;
  },
): Entity {
  const e = newInstance(template, opts);
  const components: Entity["components"] = {
    ...e.components,
    [PLAYED_COMPONENT]: {
      playedAt: opts.at,
      ...(opts.session ? { playedIn: opts.session } : {}),
    },
  };
  const sicht = template.components?.["Visibility"];
  if (sicht && Object.keys(sicht).length)
    components["Visibility"] = JSON.parse(JSON.stringify(sicht)) as Record<
      string,
      unknown
    >;
  const relations = [...(e.relations ?? [])];
  if (primaryInterface(template) === "Map")
    components["Map"] = { fog: true, reveal: [], released: false };
  if (primaryInterface(template) === "Encounter" && opts.map) {
    relations.push({
      id: `${opts.id}~onMap`,
      type: "onMap",
      to: opts.map,
      props: {},
    });
  }
  return { ...e, components, relations };
}

/**
 * Die Instanz dieser Vorlage, die eine Sitzung schon gespielt hat — dieselbe
 * Karte zweimal in einer Sitzung auf den Tisch zu legen, setzt den Stand
 * fort und fängt nicht neu an. Ohne Sitzung keine.
 */
export function sessionInstance(
  entities: Lookup,
  templateId: EntityId,
  session: EntityId | null,
): Entity | null {
  if (!session) return null;
  for (const e of entities.values()) {
    if (
      !(e.relations ?? []).some(
        (r) => r.type === INSTANCE_RELATION && r.to === templateId,
      )
    )
      continue;
    if (playedInfo(e).session === session) return e;
  }
  return null;
}

/** Die Vorlage einer Instanz im Spiel, sonst der Artikel selbst. */
export function playTemplateId(entities: Lookup, e: Entity): EntityId {
  return isPlayInstance(e) ? (templateOf(entities, e)?.id ?? e.id) : e.id;
}

/** Eine Zeile unter „Played". */
export interface PlayedRow {
  id: EntityId;
  name: string;
  kind: "map" | "encounter";
  at: string;
  session: EntityId | null;
  /** An einer Karteninstanz: die Begegnungen, die auf ihr gefochten wurden. */
  encounters: EntityId[];
  /** An einer Begegnungsinstanz: die Karteninstanz, auf der sie lag. */
  map: EntityId | null;
  released: boolean;
}

/**
 * **„Played" an der Vorlage**: ihre Instanzen, die jüngste zuerst. Eine
 * Karte nennt dazu je Instanz die Begegnungen, die darauf lagen
 * (`onMap` auf die Instanz) — die Gegenrichtung ist eine Abfrage.
 */
export function playedOf(entities: Lookup, template: Entity): PlayedRow[] {
  const alle = [...entities.values()];
  const rows: PlayedRow[] = [];
  for (const e of alle) {
    if (
      !(e.relations ?? []).some(
        (r) => r.type === INSTANCE_RELATION && r.to === template.id,
      )
    )
      continue;
    if (!isPlayInstance(e)) continue;
    const info = playedInfo(e);
    const istKarte = primaryInterface(e) === "Map";
    rows.push({
      id: e.id,
      name: entityName(e),
      kind: istKarte ? "map" : "encounter",
      at: info.at,
      session: info.session,
      encounters: istKarte
        ? alle
            .filter(
              (x) =>
                primaryInterface(x) === "Encounter" &&
                (x.relations ?? []).some(
                  (r) => r.type === "onMap" && r.to === e.id,
                ),
            )
            .map((x) => x.id)
        : [],
      map: istKarte
        ? null
        : ((e.relations ?? []).find((r) => r.type === "onMap")?.to ?? null),
      released: istKarte ? isReleased(e) : true,
    });
  }
  return rows.sort(
    (a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id),
  );
}

/**
 * Der Bestand, wie die Tischrouten ihn lesen: Karten- und
 * Begegnungsinstanzen aufgelöst (Vorlage darunter), alles andere roh. Eine
 * Begegnungsinstanz, die noch keine eigene Teilnehmerliste hat, nennt sonst
 * niemanden.
 */
export function resolvePlay(entities: Lookup, e: Entity): Entity {
  return isPlayInstance(e) ? resolveInstance(entities, e) : e;
}

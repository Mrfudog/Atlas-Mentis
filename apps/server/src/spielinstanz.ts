/**
 * **Karten und Begegnungen im Spiel** (T-289, E-039, E-041): eine Instanz
 * je Runde, angelegt beim Nutzen.
 *
 * - `POST /api/play/take` `{session?, map?, encounter?}` — die Leitung nimmt
 *   eine Karte (oder eine Begegnung samt ihrer Karte) in die Sitzung. Gibt
 *   es in dieser Sitzung schon eine Instanz der Vorlage, geht es dort
 *   weiter; sonst entsteht eine (`newPlayInstance`): in der Ebene der
 *   Kampagne, Nebel an, nicht freigegeben. Die Sitzung zeigt danach auf die
 *   Instanzen (`activeMap`, `activeEncounter`).
 * - `GET /api/maps/:id/played` (auch für Begegnungen) — „Played" an der
 *   Vorlage: die gespielten Stände, gesiebt wie jeder Artikel. Spielende
 *   sehen nur freigegebene Karten (`heldBackMap` in `articleVisible`).
 *
 * Freigegeben wird über das Feld `Map.released` am gewöhnlichen Schreibweg:
 * die Instanz liegt in der Ebene der Kampagne, und deren Leitung schreibt
 * sie.
 */

import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  currentCampaign,
  entityName,
  isMap,
  isPlayInstance,
  newPlayInstance,
  nextId,
  playedOf,
  primaryInterface,
  sessionInstance,
  sessionState,
  templateOf,
  type Entity,
  type PlayedRow,
  type validateEntity,
} from "@nw/model";
import type { User } from "./auth.js";
import type { Repository } from "./repo.js";
import { leitetTisch } from "./wuerfe.js";

interface Stand {
  alle: Entity[];
  map: Map<string, Entity>;
}

export interface SpielinstanzDeps {
  repo: Repository;
  viewerOf: (request: FastifyRequest) => Promise<User | null>;
  roh: () => Promise<Stand>;
  sieve: (
    request: FastifyRequest,
    entities: Entity[],
    bestand?: Map<string, Entity>,
  ) => Promise<Entity[]>;
  kampagnenEbene: (
    map: Map<string, Entity>,
    kampagne: Entity | null,
  ) => Promise<Entity | null>;
  schreibeGeprueft: (
    entity: Entity,
  ) => Promise<
    { stored: Entity } | { issues: ReturnType<typeof validateEntity> }
  >;
}

/** Was „In Play nehmen" tut — auch der Kampfstart einer Vorlage braucht es. */
export interface InsSpiel {
  (opts: {
    stand: Stand;
    kampagne: Entity | null;
    template: Entity;
    session: Entity | null;
    map?: string | null;
  }): Promise<
    | { instance: Entity; created: boolean }
    | { issues: ReturnType<typeof validateEntity> }
  >;
}

/**
 * Eine Instanz für den Tisch: die der Sitzung, wenn es sie gibt, sonst eine
 * neue. Eine Instanz bleibt eine Instanz — sie noch einmal zu nehmen gibt
 * sie zurück.
 */
export function insSpiel(
  deps: Pick<SpielinstanzDeps, "kampagnenEbene" | "schreibeGeprueft">,
): InsSpiel {
  return async ({ stand, kampagne, template, session, map }) => {
    if (isPlayInstance(template)) return { instance: template, created: false };
    const da = sessionInstance(stand.map, template.id, session?.id ?? null);
    if (da) return { instance: da, created: false };
    const id = `e_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
    /* In die Ebene der Kampagne — die schreibt ihre Leitung; hat die
       Kampagne keine, in die erste Ebene der Vorlage, damit die Instanz im
       Stapel steht wie ihre Vorlage. */
    const ebene =
      (await deps.kampagnenEbene(stand.map, kampagne))?.id ??
      (template.relations ?? []).find((r) => r.type === "inLayer")?.to ??
      null;
    const neu = newPlayInstance(template, {
      id,
      number: nextId(stand.map.values(), primaryInterface(template)),
      layer: ebene,
      session: session?.id ?? null,
      at: new Date().toISOString(),
      map: map ?? null,
    });
    const r = await deps.schreibeGeprueft(neu);
    if ("issues" in r) return r;
    stand.map.set(neu.id, neu);
    return { instance: neu, created: true };
  };
}

/** Den Sitzungszustand setzen — in die Karte, die die Sitzung trägt (T-202). */
export function mitZustand(s: Entity, felder: Record<string, unknown>): Entity {
  const name = s.components?.["Session"]
    ? "Session"
    : s.components?.["SessionState"]
      ? "SessionState"
      : "Session";
  return {
    ...s,
    components: {
      ...s.components,
      [name]: { ...(s.components?.[name] ?? {}), ...felder },
    },
  };
}

/** Eine Zeile unter „Played", mit Namen, die der Betrachter sehen darf. */
export interface PlayedZeile extends PlayedRow {
  sessionName: string | null;
  encounterNames: { id: string; name: string }[];
  mapName: string | null;
}

export function registerSpielinstanz(
  app: FastifyInstance,
  deps: SpielinstanzDeps,
): void {
  const { repo, viewerOf, roh, sieve, schreibeGeprueft } = deps;
  const nimm = insSpiel(deps);

  app.post<{
    Body: { session?: unknown; map?: unknown; encounter?: unknown } | undefined;
  }>("/api/play/take", async (request, reply) => {
    const user = await viewerOf(request);
    if (!user) return reply.code(401).send({ error: "Nicht angemeldet" });
    const roherStand = await roh();
    /* Eine Kopie: was hier entsteht, liest der nächste Schritt mit. */
    const stand = { alle: roherStand.alle, map: new Map(roherStand.map) };
    const kampagne = currentCampaign(
      stand.map,
      (await repo.getRegistry()).settings ?? null,
    );
    if (!leitetTisch(user, kampagne?.id ?? null))
      return reply
        .code(403)
        .send({ error: "Eine Karte nimmt die Leitung ins Spiel." });
    const body = request.body ?? {};
    const sitzung =
      typeof body.session === "string"
        ? stand.map.get(body.session)
        : undefined;
    if (
      body.session !== undefined &&
      (!sitzung || primaryInterface(sitzung) !== "Session")
    ) {
      return reply.code(404).send({ error: "Diese Sitzung gibt es nicht." });
    }
    const kartenId = typeof body.map === "string" ? body.map : null;
    const begegnungId =
      typeof body.encounter === "string" ? body.encounter : null;
    const begegnung = begegnungId ? stand.map.get(begegnungId) : undefined;
    if (
      begegnungId &&
      (!begegnung || primaryInterface(begegnung) !== "Encounter")
    ) {
      return reply.code(404).send({ error: "Diese Begegnung gibt es nicht." });
    }
    /* Die Karte: genannt, sonst die der Begegnung — und liegt deren Vorlage
       schon als Instanz auf dem Tisch dieser Sitzung, diese. */
    const kartenVorlage =
      kartenId ??
      (begegnung?.relations ?? []).find((r) => r.type === "onMap")?.to ??
      null;
    const karteRoh = kartenVorlage ? stand.map.get(kartenVorlage) : undefined;
    if (kartenVorlage && (!karteRoh || !isMap(karteRoh)))
      return reply.code(404).send({ error: "Diese Karte gibt es nicht." });
    if (!karteRoh && !begegnung)
      return reply
        .code(400)
        .send({ error: "Eine Karte oder eine Begegnung nennen." });
    const sichtbar = await sieve(
      request,
      [karteRoh, begegnung].filter((e): e is Entity => !!e),
      stand.map,
    );
    if (sichtbar.length !== [karteRoh, begegnung].filter(Boolean).length)
      return reply.code(404).send({ error: "Nicht gefunden" });

    let karte: Entity | null = null;
    if (karteRoh) {
      const r = await nimm({
        stand,
        kampagne,
        template: karteRoh,
        session: sitzung ?? null,
      });
      if ("issues" in r)
        return reply
          .code(422)
          .send({
            error: "Die Karte liess sich nicht ins Spiel nehmen.",
            issues: r.issues,
          });
      karte = r.instance;
    }
    let kampf: Entity | null = null;
    if (begegnung) {
      const r = await nimm({
        stand,
        kampagne,
        template: begegnung,
        session: sitzung ?? null,
        map: karte?.id ?? null,
      });
      if ("issues" in r)
        return reply
          .code(422)
          .send({
            error: "Die Begegnung liess sich nicht ins Spiel nehmen.",
            issues: r.issues,
          });
      kampf = r.instance;
    }
    if (sitzung) {
      const felder: Record<string, unknown> = {};
      if (karte) felder["activeMap"] = karte.id;
      if (kampf) felder["activeEncounter"] = kampf.id;
      const w = await schreibeGeprueft(mitZustand(sitzung, felder));
      if ("issues" in w)
        return reply
          .code(422)
          .send({
            error: "Die Sitzung liess sich nicht schreiben.",
            issues: w.issues,
          });
    }
    return {
      map: karte?.id ?? null,
      encounter: kampf?.id ?? null,
      session: sitzung?.id ?? null,
    };
  });

  app.get<{ Params: { id: string } }>(
    "/api/maps/:id/played",
    async (request, reply) => {
      const stand = await roh();
      const gefunden = stand.map.get(request.params.id);
      if (
        !gefunden ||
        !["Map", "Encounter"].includes(primaryInterface(gefunden))
      )
        return reply.code(404).send({ error: "Nicht gefunden" });
      const [vorlage] = await sieve(request, [gefunden], stand.map);
      if (!vorlage) return reply.code(404).send({ error: "Nicht gefunden" });
      /* An einer Instanz: die Liste ihrer Vorlage — „die anderen Runden". */
      const t = isPlayInstance(gefunden)
        ? (templateOf(stand.map, gefunden) ?? gefunden)
        : gefunden;
      const zeilen = playedOf(stand.map, t);
      const ids = new Set(
        zeilen
          .flatMap((z) => [z.id, z.session ?? "", z.map ?? "", ...z.encounters])
          .filter(Boolean),
      );
      const sieht = new Map(
        (
          await sieve(
            request,
            [...ids].flatMap((i) => stand.map.get(i) ?? []),
            stand.map,
          )
        ).map((e) => [e.id, e]),
      );
      const name = (id: string | null) =>
        id && sieht.has(id) ? entityName(sieht.get(id)) : null;
      const rows: PlayedZeile[] = zeilen
        .filter((z) => sieht.has(z.id))
        .map((z) => ({
          ...z,
          session: z.session && sieht.has(z.session) ? z.session : null,
          sessionName: name(z.session),
          encounters: z.encounters.filter((e) => sieht.has(e)),
          encounterNames: z.encounters
            .filter((e) => sieht.has(e))
            .map((e) => ({ id: e, name: name(e)! })),
          map: z.map && sieht.has(z.map) ? z.map : null,
          mapName: name(z.map),
        }));
      return { template: t.id, rows };
    },
  );
}

/** Die Sitzung, die diese Karte auf dem Tisch hat — für den Kampfstart. */
export function sitzungMitKarte(
  stand: Stand,
  kartenId: string | null,
): Entity | undefined {
  if (!kartenId) return undefined;
  return stand.alle.find(
    (e) =>
      primaryInterface(e) === "Session" &&
      (sessionState(e) as { activeMap?: unknown }).activeMap === kartenId,
  );
}

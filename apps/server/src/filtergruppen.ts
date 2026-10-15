/**
 * **Filtergruppen je Seite** (T-137): benannte, gespeicherte Filter einer
 * Listenseite — Kompendium, World, Story, Rules —, als Unterreiter über der
 * Liste und in der Kopfleiste direkt aufrufbar (`/world?view=<id>`).
 *
 * Eine Gruppe gehört **der Kampagne** (die Leitung legt sie an, jedes
 * Mitglied sieht sie) oder **einem Konto** (nur seine, in jeder Runde). Die
 * **Vorgabe einer Seite** ist eine Gruppe der Kampagne mit `default`: sie
 * gilt, solange niemand einen anderen Reiter wählt, und „All" zeigt die
 * Seite ohne sie. So ist „World ohne Items" ein Eintrag und keine Liste im
 * Code (CLAUDE.md, „Sechs Seiten, vier davon Bereiche").
 *
 * Was eine Gruppe festhält, ist zweierlei (`SavedFilter`):
 *
 * - **was den Reiter ausmacht** — Arten (`of`, mit Untertypen), ohne Arten
 *   (`notype`), Marken, Stand. Das geht als Grenze an `/api/list` und
 *   lässt sich in der Seitenleiste nicht abwählen;
 * - **womit er anfängt** — Suche und Facetten. Das setzt die Seitenleiste
 *   beim Betreten, danach gehört der Filter der Seite (CLAUDE.md, „Der
 *   Filter gehört der Seite").
 *
 * **Ebenen trägt eine Gruppe nicht mehr** (T-186): welche gelten, sagt der
 * globale Stand in der Kopfleiste, und Auswahlen davon speichert man dort
 * (`ebenensets.ts`). Was alte Gruppen an `layer`/`nolayer` trugen, hat
 * Migration 079 nach `list_filter_ebenen_alt` gelegt; hier fällt es weg.
 *
 * Gesiebt wird hier nichts: eine Gruppe nennt Arten und Marken, keine
 * Artikel, und die Liste dahinter siebt wie jede andere.
 */

import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  currentCampaign,
  tableRole,
  type Entity,
  type Registry,
} from "@nw/model";
import type { User } from "./auth.js";
import type { ListFilterRow, Repository } from "./repo.js";

/** Was eine Gruppe festhält. Jede Liste leer oder weg heisst: keine Grenze. */
export interface SavedFilter {
  of?: string[];
  notype?: string[];
  tag?: string[];
  status?: string[];
  q?: string;
  /** Die Facetten (T-174): `Typ.feld:a|b`, `Typ.feld:1..3`, `in.grants:<id>`. */
  f?: string[];
}

/* `f`: die Facetten (T-174), in der Form der Adresse. */
const LISTEN = ["of", "notype", "tag", "status", "f"] as const;
/** Eine Seite heisst wie ihr Weg (`world`, `compendium`); welche es gibt, sagt die Oberfläche. */
const SEITE = /^[a-z][a-z0-9-]{0,31}$/;

/** Nimmt nur, was eine Gruppe tragen kann — der Rest fällt still weg. */
export function savedFilter(roh: unknown): SavedFilter {
  const raus: SavedFilter = {};
  if (!roh || typeof roh !== "object") return raus;
  const r = roh as Record<string, unknown>;
  for (const k of LISTEN) {
    const v = r[k];
    if (!Array.isArray(v)) continue;
    const werte = [
      ...new Set(
        v.filter(
          (x): x is string =>
            typeof x === "string" && x.length > 0 && x.length <= 200,
        ),
      ),
    ].slice(0, 100);
    if (werte.length) raus[k] = werte;
  }
  if (typeof r["q"] === "string" && r["q"].trim())
    raus.q = r["q"].trim().slice(0, 200);
  return raus;
}

/** Wie eine Gruppe hinausgeht. */
export interface FilterGroup {
  id: string;
  page: string;
  name: string;
  /** `campaign`: die Leitung pflegt sie; `own`: dieses Konto. */
  scope: "campaign" | "own";
  filter: SavedFilter;
  default: boolean;
  rank: number;
  /** Ob dieser Betrachter sie ändern darf — Anzeige, der Server prüft. */
  canEdit: boolean;
}

export interface FilterDeps {
  repo: Repository;
  viewerOf: (request: FastifyRequest) => Promise<User | null>;
  roh: () => Promise<{ map: Map<string, Entity> }>;
}

export function registerFiltergruppen(
  app: FastifyInstance,
  deps: FilterDeps,
): void {
  const { repo, viewerOf, roh } = deps;

  async function kampagne(): Promise<Entity | null> {
    const registry: Registry = await repo.getRegistry();
    return currentCampaign((await roh()).map, registry.settings ?? null);
  }

  /** Die Gruppen einer Kampagne pflegt ihre Leitung (`gm`, `co-gm`) und die Verwaltung. */
  function leitet(user: User, campaignId: string | null): boolean {
    if (user.isAdmin) return true;
    if (!campaignId) return false;
    const rolle = tableRole({ roles: user.roles ?? {} }, campaignId);
    return rolle === "gm" || rolle === "co-gm";
  }

  function darf(user: User, row: ListFilterRow): boolean {
    return row.userId ? row.userId === user.id : leitet(user, row.campaignId);
  }

  function hinaus(user: User, row: ListFilterRow): FilterGroup {
    return {
      id: row.id,
      page: row.page,
      name: row.name,
      scope: row.userId ? "own" : "campaign",
      filter: savedFilter(row.filter),
      default: row.isDefault,
      rank: row.rank,
      canEdit: darf(user, row),
    };
  }

  /** Alle Gruppen für dieses Konto: die der laufenden Kampagne und die eigenen. */
  app.get("/api/filters", async (request, reply) => {
    const user = await viewerOf(request);
    if (!user) return reply.code(401).send({ error: "Nicht angemeldet." });
    const k = await kampagne();
    const rows = await repo.listFilters(k?.id ?? null, user.id);
    return {
      campaign: k?.id ?? null,
      /* Ob „für die Kampagne" angeboten wird. */
      canManage: !!k && leitet(user, k.id),
      groups: rows.map((r) => hinaus(user, r)),
    };
  });

  app.post<{
    Body: {
      page?: unknown;
      name?: unknown;
      scope?: unknown;
      filter?: unknown;
      default?: unknown;
    } | null;
  }>("/api/filters", async (request, reply) => {
    const user = await viewerOf(request);
    if (!user) return reply.code(401).send({ error: "Nicht angemeldet." });
    const b = request.body ?? {};
    const page = String(b.page ?? "");
    const name = String(b.name ?? "").trim();
    if (!SEITE.test(page))
      return reply.code(400).send({ error: "Unbekannte Seite." });
    if (!name || name.length > 80)
      return reply
        .code(400)
        .send({
          error: "Eine Gruppe braucht einen Namen (höchstens 80 Zeichen).",
        });
    const fuerKampagne = b.scope === "campaign";
    const k = fuerKampagne ? await kampagne() : null;
    if (fuerKampagne && !k)
      return reply.code(409).send({ error: "Es läuft keine Kampagne." });
    if (fuerKampagne && !leitet(user, k!.id)) {
      return reply
        .code(403)
        .send({ error: "Gruppen der Kampagne legt die Leitung an." });
    }
    const alle = await repo.listFilters(k?.id ?? null, user.id);
    const geschwister = alle.filter(
      (r) =>
        r.page === page &&
        (fuerKampagne ? r.campaignId === k!.id : r.userId === user.id),
    );
    const row: ListFilterRow = {
      id: randomUUID(),
      page,
      name,
      campaignId: fuerKampagne ? k!.id : null,
      userId: fuerKampagne ? null : user.id,
      filter: { ...savedFilter(b.filter) },
      /* Die Vorgabe einer Seite gehört der Kampagne — ein Konto hat Reiter, keine Vorgabe. */
      isDefault: fuerKampagne && b.default === true,
      rank: Math.max(-1, ...geschwister.map((r) => r.rank)) + 1,
    };
    await repo.putListFilter(row);
    return reply.code(201).send(hinaus(user, row));
  });

  app.put<{
    Params: { id: string };
    Body: {
      name?: unknown;
      filter?: unknown;
      default?: unknown;
      rank?: unknown;
    } | null;
  }>("/api/filters/:id", async (request, reply) => {
    const user = await viewerOf(request);
    if (!user) return reply.code(401).send({ error: "Nicht angemeldet." });
    const row = await repo.getListFilter(request.params.id);
    if (!row || !(row.userId === user.id || row.campaignId))
      return reply.code(404).send({ error: "Nicht gefunden." });
    if (!darf(user, row))
      return reply
        .code(403)
        .send({ error: "Diese Gruppe ändert die Leitung." });
    const b = request.body ?? {};
    if (b.name !== undefined) {
      const name = String(b.name).trim();
      if (!name || name.length > 80)
        return reply
          .code(400)
          .send({
            error: "Eine Gruppe braucht einen Namen (höchstens 80 Zeichen).",
          });
      row.name = name;
    }
    if (b.filter !== undefined) row.filter = { ...savedFilter(b.filter) };
    if (b.default !== undefined)
      row.isDefault = !!row.campaignId && b.default === true;
    if (typeof b.rank === "number" && Number.isFinite(b.rank))
      row.rank = Math.trunc(b.rank);
    await repo.putListFilter(row);
    return hinaus(user, row);
  });

  app.delete<{ Params: { id: string } }>(
    "/api/filters/:id",
    async (request, reply) => {
      const user = await viewerOf(request);
      if (!user) return reply.code(401).send({ error: "Nicht angemeldet." });
      const row = await repo.getListFilter(request.params.id);
      if (!row || !(row.userId === user.id || row.campaignId))
        return reply.code(404).send({ error: "Nicht gefunden." });
      if (!darf(user, row))
        return reply
          .code(403)
          .send({ error: "Diese Gruppe ändert die Leitung." });
      await repo.dropListFilter(row.id);
      return { ok: true };
    },
  );
}

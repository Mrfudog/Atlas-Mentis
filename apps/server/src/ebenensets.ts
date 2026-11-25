/**
 * **Gespeicherte Ebenenauswahlen** (T-186): seit die Seiten World, Story,
 * Rules und Compendium keinen eigenen Ebenenfilter mehr haben, gilt dort
 * der globale Stand der laufenden Kampagne (Kopfleiste, T-143). Wer
 * zwischen Ständen wechselt — „nur 2014", „2014 und 2024" —, speichert sie
 * hier unter einem Namen und lädt sie im Popup wieder.
 *
 * Eine Auswahl gehört **einem Konto** (Einstellung `layerSets`, neben dem
 * Konto und nicht in einem Artikel — REQ-199) und darf **an eine Kampagne
 * gebunden** sein; ohne Kampagne steht sie in jeder Runde zur Wahl. Sie
 * hält den Stapel von unten nach oben (`layers`, ausdrücklich aufgeschaltet,
 * Gruppen inbegriffen) und was trotz Gruppe aus ist (`off`). Was eine
 * Ebene bringt (`only`, T-105), bleibt an ihrer Kante und gehört nicht zur
 * Auswahl.
 *
 * Laden heisst schreiben: die Oberfläche schickt den Stapel an
 * `PUT /api/campaigns/:c/layers` — dort prüft der Server die Rolle wie bei
 * jedem Häkchen. Hier wird nur gespeichert.
 */

import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { User } from "./auth.js";
import type { Repository } from "./repo.js";

/** Der Schlüssel in den Einstellungen des Kontos; `PUT /api/me/prefs/layerSets` nimmt er nicht. */
export const LAYER_SETS_PREF = "layerSets";

export interface LayerSet {
  id: string;
  name: string;
  /** Die Kampagne, für die sie gilt — `null`: jede. */
  campaign: string | null;
  /** Ausdrücklich aufgeschaltet, von unten nach oben. */
  layers: string[];
  /** Aus, obwohl eine aufgeschaltete Gruppe sie brächte. */
  off: string[];
  savedAt: string;
}

const HOECHSTENS = 50;
const IDS = 300;

function ids(x: unknown): string[] | null {
  if (x === undefined || x === null) return [];
  if (!Array.isArray(x) || !x.every((y) => typeof y === "string" && y.length > 0 && y.length <= 200)) return null;
  return [...new Set(x as string[])].slice(0, IDS);
}

/** Was gespeichert steht — Unlesbares fällt still weg, damit eine kaputte Zeile die übrigen nicht mitnimmt. */
export function layerSets(roh: unknown): LayerSet[] {
  if (!Array.isArray(roh)) return [];
  const raus: LayerSet[] = [];
  for (const r of roh) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const layers = ids(o["layers"]);
    const off = ids(o["off"]);
    if (typeof o["id"] !== "string" || typeof o["name"] !== "string" || !o["name"].trim() || !layers || !off) continue;
    raus.push({
      id: o["id"],
      name: o["name"].trim().slice(0, 80),
      campaign: typeof o["campaign"] === "string" && o["campaign"] ? o["campaign"] : null,
      layers,
      off,
      savedAt: typeof o["savedAt"] === "string" ? o["savedAt"] : "",
    });
  }
  return raus.slice(0, HOECHSTENS);
}

export interface LayerSetDeps {
  repo: Repository;
  viewerOf: (request: FastifyRequest) => Promise<User | null>;
}

export function registerEbenensets(app: FastifyInstance, deps: LayerSetDeps): void {
  const { repo, viewerOf } = deps;

  async function lesen(user: User): Promise<LayerSet[]> {
    return layerSets((await repo.getPrefs(user.id))[LAYER_SETS_PREF]);
  }

  app.get("/api/me/layer-sets", async (request, reply) => {
    const user = await viewerOf(request);
    if (!user) return reply.code(401).send({ error: "Nicht angemeldet." });
    return { sets: await lesen(user) };
  });

  /**
   * `{ name, campaign?, layers, off? }`. Derselbe Name für dieselbe
   * Kampagne ersetzt die alte Auswahl — „speichern" unter einem Namen, den
   * es schon gibt, heisst sie neu fassen, nicht eine zweite gleichnamige.
   */
  app.post<{ Body: { name?: unknown; campaign?: unknown; layers?: unknown; off?: unknown } }>(
    "/api/me/layer-sets",
    async (request, reply) => {
      const user = await viewerOf(request);
      if (!user) return reply.code(401).send({ error: "Nicht angemeldet." });
      const b = request.body ?? {};
      const name = typeof b.name === "string" ? b.name.trim() : "";
      if (!name || name.length > 80) return reply.code(400).send({ error: "name: 1 bis 80 Zeichen." });
      const campaign = b.campaign === undefined || b.campaign === null ? null : b.campaign;
      if (campaign !== null && (typeof campaign !== "string" || !campaign || campaign.length > 200)) {
        return reply.code(400).send({ error: "campaign: eine Kampagnen-Id oder null." });
      }
      const layers = ids(b.layers);
      const off = ids(b.off);
      if (!layers) return reply.code(400).send({ error: "layers: eine Liste von Ebenen-Ids." });
      if (!off) return reply.code(400).send({ error: "off: eine Liste von Ebenen-Ids." });
      const alle = await lesen(user);
      const alt = alle.find((s) => s.name.toLowerCase() === name.toLowerCase() && s.campaign === campaign);
      if (!alt && alle.length >= HOECHSTENS) {
        return reply.code(400).send({ error: `Höchstens ${HOECHSTENS} gespeicherte Auswahlen.` });
      }
      const neu: LayerSet = {
        id: alt?.id ?? randomUUID(),
        name,
        campaign: campaign as string | null,
        layers,
        off,
        savedAt: new Date().toISOString(),
      };
      await repo.putPref(user.id, LAYER_SETS_PREF, alt ? alle.map((s) => (s.id === alt.id ? neu : s)) : [...alle, neu]);
      return reply.code(alt ? 200 : 201).send(neu);
    },
  );

  app.delete<{ Params: { id: string } }>("/api/me/layer-sets/:id", async (request, reply) => {
    const user = await viewerOf(request);
    if (!user) return reply.code(401).send({ error: "Nicht angemeldet." });
    const alle = await lesen(user);
    if (!alle.some((s) => s.id === request.params.id)) return reply.code(404).send({ error: "Diese Auswahl gibt es nicht." });
    await repo.putPref(user.id, LAYER_SETS_PREF, alle.filter((s) => s.id !== request.params.id));
    return { ok: true };
  });
}

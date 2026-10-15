/**
 * Gespeicherte Ebenenauswahlen (T-186): je Konto, wahlweise an eine
 * Kampagne gebunden; derselbe Name ersetzt, fremde sieht niemand, und der
 * allgemeine Einstellungsweg nimmt den Schlüssel nicht.
 */

import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { seedRegistry } from "@nw/registry";
import { buildApp } from "../src/app.js";
import { InMemoryRepository } from "../src/repo.js";
import { hashPassword } from "../src/auth.js";
import { layerSets } from "../src/ebenensets.js";

const PASSWORT = "nebel-wacht-am-tor";

async function aufbau() {
  const repo = new InMemoryRepository(seedRegistry, []);
  const app = buildApp({ repo });
  for (const name of ["Basil", "Sela"]) {
    await repo.putUser({
      id: randomUUID(),
      name,
      passwordHash: await hashPassword(PASSWORT),
      isAdmin: false,
      actorIds: [],
      roles: { camp_a: name === "Basil" ? "gm" : "player" },
    });
  }
  const kekse = new Map<string, string>();
  const rufe = async (name: string, method: "GET" | "POST" | "PUT" | "DELETE", url: string, payload?: unknown) => {
    if (!kekse.has(name)) {
      const res = await app.inject({ method: "POST", url: "/api/login", payload: { name, password: PASSWORT } });
      kekse.set(name, `nw_session=${res.cookies.find((x) => x.name === "nw_session")?.value ?? ""}`);
    }
    return app.inject({
      method,
      url,
      headers: { cookie: kekse.get(name)! },
      ...(payload !== undefined ? { payload: payload as object } : {}),
    });
  };
  return { rufe };
}

describe("saved layer selections (T-186)", () => {
  it("saves, replaces by name and deletes per account", async () => {
    const { rufe } = await aufbau();
    const a = await rufe("Basil", "POST", "/api/me/layer-sets", {
      name: "Only 2014",
      campaign: "camp_a",
      layers: ["ly_phb", "ly_camp", "ly_phb"],
      off: ["ly_dmg"],
    });
    expect(a.statusCode).toBe(201);
    expect(a.json()).toMatchObject({ name: "Only 2014", campaign: "camp_a", layers: ["ly_phb", "ly_camp"], off: ["ly_dmg"] });

    /* Derselbe Name für dieselbe Kampagne fasst die Auswahl neu. */
    const b = await rufe("Basil", "POST", "/api/me/layer-sets", { name: "only 2014", campaign: "camp_a", layers: ["ly_camp"] });
    expect(b.statusCode).toBe(200);
    expect(b.json().id).toBe(a.json().id);
    /* … für jede Kampagne ist es eine eigene. */
    expect((await rufe("Basil", "POST", "/api/me/layer-sets", { name: "Only 2014", layers: [] })).statusCode).toBe(201);

    const liste = (await rufe("Basil", "GET", "/api/me/layer-sets")).json();
    expect(liste.sets).toHaveLength(2);
    expect(liste.sets[0]).toMatchObject({ layers: ["ly_camp"], off: [] });

    /* Fremde Auswahlen sieht und löscht niemand. */
    expect((await rufe("Sela", "GET", "/api/me/layer-sets")).json().sets).toEqual([]);
    expect((await rufe("Sela", "DELETE", `/api/me/layer-sets/${a.json().id}`)).statusCode).toBe(404);

    expect((await rufe("Basil", "DELETE", `/api/me/layer-sets/${a.json().id}`)).statusCode).toBe(200);
    expect((await rufe("Basil", "GET", "/api/me/layer-sets")).json().sets).toHaveLength(1);
  });

  it("rejects bad input and the generic preference route", async () => {
    const { rufe } = await aufbau();
    expect((await rufe("Sela", "POST", "/api/me/layer-sets", { name: " ", layers: [] })).statusCode).toBe(400);
    expect((await rufe("Sela", "POST", "/api/me/layer-sets", { name: "X", layers: "ly" })).statusCode).toBe(400);
    expect((await rufe("Sela", "PUT", "/api/me/prefs/layerSets", { value: [] })).statusCode).toBe(400);
  });

  it("reads stored rows defensively", () => {
    expect(
      layerSets([
        { id: "s1", name: " A ", campaign: "", layers: ["x"], off: [] },
        { id: "s2", name: "", layers: [] },
        "kaputt",
        { id: "s3", name: "B", layers: [1] },
      ]),
    ).toEqual([{ id: "s1", name: "A", campaign: null, layers: ["x"], off: [], savedAt: "" }]);
    expect(layerSets(null)).toEqual([]);
  });
});

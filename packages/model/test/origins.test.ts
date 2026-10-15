import { describe, expect, it } from "vitest";
import { grantedFeatures, linkIndex, originParts } from "../src/classes.js";
import type { Entity } from "../src/types.js";

/* Eine erfundene Herkunft mit einer Spielart und ein Hintergrund (T-166). */
const art = (id: string, typ: string, name: string, rel: Entity["relations"] = []): Entity => ({
  id,
  interfaces: [typ],
  name,
  components: { Identity: { name, id } },
  relations: rel,
});
const zug = art("f-1", "Feature", "Mossy Skin");
const zug2 = art("f-2", "Feature", "Root Step");
const fremd = art("f-3", "Feature", "Elsewhere");
const herkunft = art("a-1", "Ancestry", "Mossling", [{ id: "r1", type: "grants", to: "f-1" }]);
const spielart = art("a-2", "Ancestry", "Mossling (Deep)", [
  { id: "r2", type: "subraceOf", to: "a-1" },
  { id: "r3", type: "grants", to: "f-2" },
]);
const tabelle = art("t-1", "Table", "Mossling Quirks");
const hintergrund = art("b-1", "Background", "Lamplighter", [
  { id: "r4", type: "grants", to: "f-3" },
  { id: "r5", type: "tableFor", to: "t-1" },
]);
const alle = [zug, zug2, fremd, herkunft, spielart, tabelle, hintergrund];

describe("originParts", () => {
  it("sammelt Spielarten und ihre Merkmale", () => {
    expect(originParts(alle, "a-1")).toEqual({
      origin: "a-1",
      variants: ["a-2"],
      tables: [],
      features: ["f-1", "f-2"],
    });
  });
  it("sammelt die Tabellen eines Hintergrunds", () => {
    expect(originParts(alle, "b-1")).toMatchObject({ variants: [], tables: ["t-1"], features: ["f-3"] });
  });
  it("kennt nur Herkünfte und Hintergründe", () => {
    expect(originParts(alle, "f-1")).toBeNull();
    expect(originParts(alle, "fehlt")).toBeNull();
  });
  it("gibt die Merkmale in der Reihenfolge der Kanten", () => {
    expect(grantedFeatures(spielart, linkIndex(alle)).map((e) => e.id)).toEqual(["f-2"]);
  });
});

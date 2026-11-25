/**
 * Karten und Begegnungen im Spiel (T-289): die Instanz, ihre Freigabe und
 * „Played" an der Vorlage.
 */

import { describe, expect, it } from "vitest";
import {
  articleVisible,
  heldBackMap,
  isPlayInstance,
  newPlayInstance,
  playedOf,
  redactMap,
  releaseMap,
  resolveInstance,
  sessionEncounters,
  sessionInstance,
  type Entity,
  type Viewer,
} from "../src/index.js";

const ebene: Entity = {
  id: "ly_k",
  interfaces: ["Layer"],
  name: "K",
  components: {},
  relations: [],
};
const kampagne: Entity = {
  id: "camp",
  interfaces: ["Campaign"],
  name: "Nebelwacht",
  components: {},
  relations: [{ id: "a", type: "activates", to: "ly_k", props: {} }],
};
const vorlage: Entity = {
  id: "gruft",
  interfaces: ["Map"],
  name: "Gruft",
  components: {
    Identity: { name: "Gruft", id: "map-0001" },
    Image: { image: "as_gruft" },
    Map: {
      fog: true,
      reveal: [{ id: "r", kind: "rect", x: 0, y: 0, w: 1, h: 1 }],
    },
  },
  relations: [
    { id: "g1", type: "marker", to: "npc", props: { x: 0.2, y: 0.2 } },
  ],
};
const begegnung: Entity = {
  id: "enc",
  interfaces: ["Encounter"],
  name: "Ghule",
  components: {
    Identity: { name: "Ghule", id: "encounter-0001" },
    Visibility: { audience: "gm" },
  },
  relations: [
    { id: "p1", type: "participates", to: "npc", props: {} },
    { id: "o", type: "onMap", to: "gruft", props: {} },
  ],
};

const leitung: Viewer = { actors: [], roles: { camp: "gm" } };
const spielerin: Viewer = { actors: ["pc"], roles: { camp: "player" } };

function karteImSpiel(session = "s1", id = "inst1"): Entity {
  return newPlayInstance(vorlage, {
    id,
    number: "map-0002",
    layer: "ly_k",
    session,
    at: "2026-10-19T19:00:00Z",
  });
}

describe("a map in play", () => {
  it("is an instance of its template, with fog on, nothing revealed and not released", () => {
    const k = karteImSpiel();
    expect(isPlayInstance(k)).toBe(true);
    expect(isPlayInstance(vorlage)).toBe(false);
    expect(k.components["Map"]).toEqual({
      fog: true,
      reveal: [],
      released: false,
    });
    expect(k.components["Played"]).toEqual({
      playedAt: "2026-10-19T19:00:00Z",
      playedIn: "s1",
    });
    const gelesen = resolveInstance(new Map([[vorlage.id, vorlage]]), k);
    expect(gelesen.components["Image"]).toEqual({ image: "as_gruft" });
    expect(
      (gelesen.relations ?? [])
        .filter((r) => r.type === "marker")
        .map((r) => r.id),
    ).toEqual(["g1"]);
    /* Der Nebel der Vorlage gilt der Instanz nicht: unter dem leeren Aufgedeckten kein Marker. */
    const fuerSie = redactMap(gelesen, { gm: false, sees: () => true });
    expect(
      (fuerSie.relations ?? []).filter((r) => r.type === "marker"),
    ).toEqual([]);
  });

  it("release shares the map with the campaign, also when the template was for the GM only", () => {
    /* Eine Vorlage in Vorbereitung und nur für die Leitung: die Instanz
       erbt die Sichtbarkeit, und „Release" allein hätte nichts gezeigt. */
    const geheim: Entity = {
      ...vorlage,
      components: {
        ...vorlage.components,
        Identity: { ...vorlage.components["Identity"], cover: "Old vault" },
        Visibility: { audience: "gm", hiddenFrom: ["verraeter"] },
        Status: { status: "prepared" },
      },
    };
    const k = newPlayInstance(geheim, {
      id: "inst-g",
      number: "map-0003",
      layer: "ly_k",
      session: "s1",
      at: "2026-10-22T19:00:00Z",
    });
    const k2: Entity = {
      ...k,
      components: { ...k.components, Status: { status: "prepared" } },
    };
    const bestand = new Map(
      [ebene, kampagne, geheim, k2].map((e) => [e.id, e]),
    );
    expect(articleVisible(bestand, k2, spielerin)).toBe(false);
    const frei = releaseMap(k2, true);
    bestand.set(frei.id, frei);
    expect(frei.components["Map"]).toMatchObject({ released: true, fog: true });
    expect(frei.components["Status"]).toEqual({ status: "ready" });
    expect(frei.components["Identity"]).toMatchObject({ cover: "Old vault" });
    /* Die Stufe wird geöffnet, ein ausdrückliches Verbot bleibt stehen. */
    expect(frei.components["Visibility"]).toEqual({
      audience: "campaign",
      hiddenFrom: ["verraeter"],
    });
    expect(articleVisible(bestand, frei, spielerin)).toBe(true);
    /* Zurücknehmen nimmt nur die Freigabe: die Karte ist wieder nicht da. */
    const zurueck = releaseMap(frei, false);
    bestand.set(zurueck.id, zurueck);
    expect(zurueck.components["Map"]).toMatchObject({ released: false });
    expect(articleVisible(bestand, zurueck, spielerin)).toBe(false);
  });

  it("is not there for players until released — the GM always sees it", () => {
    const k = karteImSpiel();
    const bestand = new Map(
      [ebene, kampagne, vorlage, k].map((e) => [e.id, e]),
    );
    expect(heldBackMap(k)).toBe(true);
    expect(heldBackMap(vorlage)).toBe(false);
    expect(articleVisible(bestand, k, leitung)).toBe(true);
    expect(articleVisible(bestand, k, spielerin)).toBe(false);
    const frei: Entity = {
      ...k,
      components: {
        ...k.components,
        Map: { ...k.components["Map"], released: true },
      },
    };
    bestand.set(frei.id, frei);
    expect(articleVisible(bestand, frei, spielerin)).toBe(true);
  });

  it("carries the visibility of its template, and an encounter sits on the map in play", () => {
    const b = newPlayInstance(begegnung, {
      id: "einst",
      number: "encounter-0002",
      session: "s1",
      at: "2026-10-19T19:05:00Z",
      map: "inst1",
    });
    expect(b.components["Visibility"]).toEqual({ audience: "gm" });
    expect(
      (b.relations ?? []).filter((r) => r.type === "onMap").map((r) => r.to),
    ).toEqual(["inst1"]);
  });
});

describe("Played on the template", () => {
  it("lists the instances, newest first, with the encounters fought on them", () => {
    const eins = karteImSpiel("s1", "inst1");
    const zwei = {
      ...karteImSpiel("s2", "inst2"),
      components: {
        ...karteImSpiel("s2", "inst2").components,
        Played: { playedAt: "2026-10-26T19:00:00Z", playedIn: "s2" },
      },
    };
    const b = newPlayInstance(begegnung, {
      id: "einst",
      number: "encounter-0002",
      session: "s1",
      at: "2026-10-19T19:05:00Z",
      map: "inst1",
    });
    const bestand = new Map(
      [vorlage, begegnung, eins, zwei, b].map((e) => [e.id, e]),
    );
    expect(
      playedOf(bestand, vorlage).map((r) => [r.id, r.session, r.encounters]),
    ).toEqual([
      ["inst2", "s2", []],
      ["inst1", "s1", ["einst"]],
    ]);
    expect(playedOf(bestand, begegnung).map((r) => [r.id, r.map])).toEqual([
      ["einst", "inst1"],
    ]);
    expect(sessionInstance(bestand, "gruft", "s2")?.id).toBe("inst2");
    expect(sessionInstance(bestand, "gruft", "s3")).toBeNull();
  });

  it("puts the encounter instance of this session in place of its template beside the map in play", () => {
    const k = karteImSpiel("s1", "inst1");
    const sitzung: Entity = {
      id: "s1",
      interfaces: ["Session"],
      name: "Abend",
      components: {},
      relations: [],
    };
    const fremd = newPlayInstance(begegnung, {
      id: "fremd",
      number: "encounter-0003",
      session: "s2",
      at: "x",
      map: "inst9",
    });
    const bestand = new Map(
      [vorlage, begegnung, k, sitzung, fremd].map((e) => [e.id, e]),
    );
    expect(
      sessionEncounters(bestand, sitzung, "inst1").map((e) => e.id),
    ).toEqual(["enc"]);
    const b = newPlayInstance(begegnung, {
      id: "einst",
      number: "encounter-0002",
      session: "s1",
      at: "y",
      map: "inst1",
    });
    bestand.set(b.id, b);
    const liste = sessionEncounters(bestand, sitzung, "inst1");
    expect(liste.map((e) => e.id)).toEqual(["einst"]);
    expect(liste[0]!.participants.map((p) => p.id)).toEqual(["npc"]);
  });
});

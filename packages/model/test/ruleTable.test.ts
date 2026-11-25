import { describe, expect, it } from "vitest";
import {
  exampleRuleGraphs,
  knownNames,
  offersFrom,
  reachExits,
  ruleGraphsOn,
  runRules,
  tableCreature,
  tableDistance,
  tableRuleGraphs,
  type Entity,
  type PlanStep,
} from "../src/index.js";

/* Regeln am Tisch (REQ-357). Erfundene Artikel. */

const art = (
  id: string,
  name: string,
  interfaces: string[],
  components: Record<string, Record<string, unknown>> = {},
  relations: Entity["relations"] = [],
): Entity => ({
  id,
  name,
  interfaces,
  components: { Identity: { name }, ...components },
  relations,
});

describe("ruleGraphsOn und tableRuleGraphs", () => {
  it("ist ohne Angabe aus", () => {
    expect(ruleGraphsOn(null)).toBe(false);
    expect(ruleGraphsOn(art("c", "C", ["Campaign"], { Campaign: {} }))).toBe(
      false,
    );
    expect(
      ruleGraphsOn(
        art("c", "C", ["Campaign"], { Campaign: { ruleGraphs: "on" } }),
      ),
    ).toBe(true);
  });
  it("nimmt nur Artikel mit einem Graphen, der an ist", () => {
    const g = exampleRuleGraphs()[0]!;
    const an = art("r1", "Hellish Rebuke", ["Rule"], {
      Rule: { kind: "rule", graph: { nodes: g.nodes, wires: g.wires } },
    });
    const aus = art("r2", "Off", ["Rule"], {
      Rule: {
        kind: "rule",
        graph: { enabled: false, nodes: g.nodes, wires: g.wires },
      },
    });
    const leer = art("r3", "Text only", ["Rule"], { Rule: { kind: "rule" } });
    expect(tableRuleGraphs([an, aus, leer]).map((x) => x.id)).toEqual(["r1"]);
  });
});

describe("knownNames", () => {
  it("kennt Zauber, Aktionen und einen Schritt weiter, was gewährt wird", () => {
    const merkmal = art("f1", "Guardian", ["Feature"]);
    const talent = art("t1", "Sentinel", ["Feat"], {}, [
      { id: "g", type: "grants", to: "f1", props: {} },
    ]);
    const zauber = art("s1", "Shield", ["Spell"]);
    const hieb = art("a1", "Longsword", ["Action"]);
    const figur = art("pc", "Ilse", ["PlayerCharacter"], {}, [
      { id: "c", type: "chose", to: "t1", props: {} },
      { id: "x", type: "casts", to: "s1", props: {} },
    ]);
    const sb = art("sb", "Ilse stats", ["Statblock"], {}, [
      { id: "k", type: "composedOf", to: "a1", props: {} },
    ]);
    const byId = new Map(
      [merkmal, talent, zauber, hieb, figur, sb].map((e) => [e.id, e]),
    );
    expect(knownNames(figur, sb, byId).sort()).toEqual([
      "Guardian",
      "Longsword",
      "Sentinel",
      "Shield",
    ]);
  });
});

describe("tableCreature", () => {
  it("liest Stand, Statblock und Plätze; was fehlt, bleibt weg", () => {
    const e = art("pc", "Ilse", ["PlayerCharacter"], {
      Vitals: {
        hp: 12,
        conditions: ["Prone"],
        slotsUsed: [1],
        concentration: "Bless",
      },
    });
    const c = tableCreature({
      entity: e,
      stats: { hp: 20, ac: 16, spellSlots: [3, 2] },
      cell: { x: 2, y: 3 },
      reach: 5,
      reactionFree: true,
      side: "party",
      knows: ["Shield"],
    });
    expect(c).toMatchObject({
      id: "pc",
      name: "Ilse",
      x: 2,
      y: 3,
      side: "party",
      knows: ["Shield"],
    });
    expect(c.values).toMatchObject({
      hp: 12,
      maxHp: 20,
      ac: 16,
      reach: 5,
      reactionFree: 1,
      prone: 1,
      concentrating: 1,
      slots1: 2,
      slots2: 2,
      disengaged: 0,
    });
    expect(c.values["slots3"]).toBeUndefined();
  });
  it("misst im Raster: eine Diagonale ist 5 ft", () => {
    const e = art("a", "A", ["Creature"]);
    const a = tableCreature({
      entity: e,
      stats: {},
      cell: { x: 0, y: 0 },
      reach: 5,
      reactionFree: true,
      side: "foe",
      knows: [],
    });
    expect(tableDistance(a, { ...a, x: 1, y: 1 })).toBe(5);
    expect(tableDistance(a, { ...a, x: 2, y: 2 })).toBe(15);
  });
});

describe("reachExits", () => {
  const weg: PlanStep = {
    id: "w",
    kind: "move",
    path: [
      { x: 2, y: 1 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ],
    feet: 10,
  };
  it("nennt jede Reichweite einmal und lässt Disengage der Regel", () => {
    const halter = [
      { id: "g", cell: { x: 3, y: 1 }, reach: 5 },
      { id: "h", cell: { x: 3, y: 1 }, reach: 10 },
    ];
    expect(reachExits([weg], halter)).toEqual([
      {
        step: "w",
        index: 0,
        holder: "g",
        from: { x: 2, y: 1 },
        disengaged: false,
      },
      {
        step: "w",
        index: 1,
        holder: "h",
        from: { x: 1, y: 1 },
        disengaged: false,
      },
    ]);
    const los: PlanStep = {
      id: "d",
      kind: "act",
      tile: "std:disengage",
      name: "Disengage",
      cost: "action",
    };
    expect(reachExits([los, weg], halter.slice(0, 1))[0]!.disengaged).toBe(
      true,
    );
  });
});

describe("offersFrom", () => {
  it("macht aus Reaktionen Angebote und aus anderen Folgen Hinweise", () => {
    const [, , oa] = exampleRuleGraphs();
    const wache = {
      id: "g",
      name: "Goblin",
      knows: [],
      values: { reactionFree: 1, reach: 5 },
      x: 3,
      y: 1,
      side: "foe",
    };
    const rook = (dis: number) => ({
      id: "r",
      name: "Rook",
      knows: [],
      values: { disengaged: dis, reach: 5 },
      x: 2,
      y: 1,
      side: "party",
    });
    const namen = new Map([
      ["g", "Goblin"],
      ["r", "Rook"],
    ]);
    const ja = offersFrom(
      runRules([oa!], { on: "leavesReach", actor: "r" }, [rook(0), wache], {
        distance: tableDistance,
        selves: ["g"],
      }),
      { key: "w", actor: "r" },
      namen,
    );
    expect(ja.offers).toEqual([
      {
        key: "w:g:opportunity-attack",
        rule: "opportunity-attack",
        ruleName: "Opportunity attack",
        reactor: "g",
        reactorName: "Goblin",
        offer: "Opportunity attack",
        against: "r",
        strike: true,
      },
    ]);
    const nein = offersFrom(
      runRules([oa!], { on: "leavesReach", actor: "r" }, [rook(1), wache], {
        distance: tableDistance,
        selves: ["g"],
      }),
      { key: "w", actor: "r" },
      namen,
    );
    expect(nein).toEqual({
      offers: [],
      notes: [
        "Opportunity attack: Rook gets “Leaves without provoking (Disengage)”",
      ],
    });
  });
});

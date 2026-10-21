import { describe, expect, it } from "vitest";
import {
  classParts,
  classTable,
  embeddedFeatures,
  isEmbedParagraph,
  levelFeatures,
  linkIndex,
  soleLinks,
} from "../src/classes.js";
import { proficiencyBonus } from "../src/calc.js";
import type { Entity } from "../src/types.js";

/* Ein Zauberer im Kleinen, wie ihn der Importer schreibt (W6). */
const merkmal = (
  id: string,
  nr: string,
  name: string,
  text: string,
  sorte = "class",
  marken?: string[],
): Entity => ({
  id,
  interfaces: ["Feature"],
  name,
  components: {
    Identity: { name, id: nr },
    Feature: { featureType: sorte },
    Prose: { paragraph: [{ id: "text", value: text }] },
    ...(marken ? { Tags: { tags: marken } } : {}),
  },
});

const asi = merkmal(
  "f-asi",
  "feature-0001",
  "Ability Score Improvement",
  "Increase one score.",
);
const formeln = merkmal(
  "f-cf",
  "feature-0002",
  "Cantrip Formulas",
  "Swap a cantrip.",
  "class",
  ["optional"],
);
const savant = merkmal(
  "f-sav",
  "feature-0003",
  "Abjuration Savant",
  "Half the gold.",
  "subclass",
);
const ward = merkmal(
  "f-ward",
  "feature-0004",
  "Arcane Ward",
  "A ward.",
  "subclass",
);
const kopf = merkmal(
  "f-kopf",
  "feature-0005",
  "School of Abjuration",
  "Abjurers protect.\n\n[[feature-0003|Abjuration Savant]]\n\n[[feature-0004|Arcane Ward]]\n\nSee [[feature-0001|this]] too.",
  "subclass",
);
const stil = merkmal(
  "f-arch",
  "feature-0006",
  "Archery",
  "+2 to hit.",
  "Fighting Style, Fighter",
);
const wahl = merkmal(
  "f-fs",
  "feature-0007",
  "Fighting Style",
  "Choose one.\n\n[[feature-0006|Archery]]",
);
const fremd = merkmal(
  "f-x",
  "feature-0008",
  "Unrelated",
  "Nobody grants this.",
);

const wizard: Entity = {
  id: "c-wiz",
  interfaces: ["Class"],
  name: "Wizard",
  components: { Identity: { name: "Wizard", id: "class-0012" } },
  relations: [
    { id: "r1", type: "grants", to: "f-asi", props: { level: 8 } },
    { id: "r2", type: "grants", to: "f-fs", props: { level: 1 } },
    { id: "r3", type: "grants", to: "f-asi", props: { level: 4 } },
    { id: "r4", type: "grants", to: "f-cf", props: { level: 3 } },
    { id: "r5", type: "tableFor", to: "t-wiz" },
  ],
};
const tabelle: Entity = {
  id: "t-wiz",
  interfaces: ["Table"],
  name: "Wizard Table",
  components: {
    Table: {
      columns: ["Level", "Cantrips Known", "1st"],
      rows: Array.from({ length: 20 }, (_, i) => ({
        cells: [String(i + 1), String(i < 3 ? 3 : 4), "2"],
      })),
    },
  },
};
const schule: Entity = {
  id: "s-abj",
  interfaces: ["Subclass"],
  name: "School of Abjuration",
  components: {},
  relations: [
    { id: "r6", type: "subclassOf", to: "c-wiz" },
    { id: "r7", type: "grants", to: "f-kopf", props: { level: 2 } },
  ],
};
const alle = [
  wizard,
  tabelle,
  schule,
  asi,
  formeln,
  savant,
  ward,
  kopf,
  stil,
  wahl,
  fremd,
];
const index = linkIndex(alle);

describe("Klassenansicht (W6)", () => {
  it("rechnet den Übungsbonus aus der Stufe", () => {
    expect([1, 4, 5, 9, 13, 17, 20].map(proficiencyBonus)).toEqual([
      2, 2, 3, 4, 5, 6, 6,
    ]);
  });

  it("liest nur Verweise, die allein in einem Absatz stehen", () => {
    expect(soleLinks("A\n\n[[x-1|X]]\n\nB [[y-2]] C\n\n  [[z-3]]  ")).toEqual([
      "x-1",
      "z-3",
    ]);
    expect(embeddedFeatures(kopf, index).map((e) => e.name)).toEqual([
      "Abjuration Savant",
      "Arcane Ward",
    ]);
    expect(isEmbedParagraph("[[feature-0004|Arcane Ward]]", index)).toBe(true);
    expect(isEmbedParagraph("[[class-0012|Wizard]]", index)).toBe(false);
  });

  it("sammelt genau die Artikel, die die Ansicht braucht", () => {
    const teile = classParts(alle, "c-wiz")!;
    expect(teile.subclasses).toEqual(["s-abj"]);
    expect(teile.tables).toEqual(["t-wiz"]);
    expect(new Set(teile.features)).toEqual(
      new Set(["f-asi", "f-fs", "f-arch", "f-cf", "f-kopf", "f-sav", "f-ward"]),
    );
    expect(teile.features).not.toContain("f-x");
    expect(classParts(alle, "s-abj")).toBeNull();
  });

  it("ordnet nach Stufe und nennt einen Kopf nach seinen Teilen", () => {
    const k = levelFeatures(wizard, index);
    expect(k.map((f) => [f.level, f.feature.name, f.optional])).toEqual([
      [1, "Fighting Style", false],
      [3, "Cantrip Formulas", true],
      [4, "Ability Score Improvement", false],
      [8, "Ability Score Improvement", false],
    ]);
    /* Optionen einer Wahl sind eingebettet, die Zeile heisst nach der Wahl. */
    expect(k[0]!.embeds.map((e) => e.name)).toEqual(["Archery"]);
    expect(k[0]!.names.map((n) => n.name)).toEqual(["Fighting Style"]);
    const s = levelFeatures(schule, index);
    expect(s[0]!.names.map((n) => n.name)).toEqual([
      "Abjuration Savant",
      "Arcane Ward",
    ]);
  });

  it("baut die Stufentabelle mit Zusatzspalten ohne zweite Stufenspalte", () => {
    const t = classTable(levelFeatures(wizard, index), [tabelle]);
    expect(t.columns).toEqual(["Cantrips Known", "1st"]);
    expect(t.rows).toHaveLength(20);
    expect(t.rows[3]).toMatchObject({
      level: 4,
      proficiencyBonus: 2,
      extra: ["4", "2"],
    });
    expect(t.rows[3]!.features.map((f) => f.name)).toEqual([
      "Ability Score Improvement",
    ]);
    expect(t.rows[2]!.features).toEqual([
      { id: "f-cf", name: "Cantrip Formulas", optional: true },
    ]);
  });
});

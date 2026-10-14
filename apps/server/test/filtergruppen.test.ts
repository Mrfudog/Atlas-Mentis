/**
 * Filtergruppen je Seite (T-137): die Leitung legt Gruppen der Kampagne an
 * und die Vorgabe einer Seite, jedes Konto eigene; fremde eigene sieht
 * niemand. Die Liste kennt dafür „ohne diese Arten" (mit Untertypen) und
 * den Stand.
 */

import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { seedRegistry } from "@nw/registry";
import type { Entity } from "@nw/model";
import { buildApp } from "../src/app.js";
import { InMemoryRepository } from "../src/repo.js";
import { hashPassword } from "../src/auth.js";
import { parseListQuery } from "../src/liste.js";
import { savedFilter } from "../src/filtergruppen.js";

const PASSWORT = "nebel-wacht-am-tor";

const artikel = (
  id: string,
  typ: string,
  name: string,
  nr: string,
  status?: string,
): Entity => ({
  id,
  name,
  interfaces: [typ],
  components: {
    Identity: { name, id: nr, aliases: [] },
    Visibility: { audience: "public" },
    ...(status ? { Status: { status } } : {}),
  },
  relations: [{ id: `${id}~inLayer`, type: "inLayer", to: "ly_a", props: {} }],
});

const BESTAND: Entity[] = [
  {
    id: "ly_a",
    name: "Runde A",
    interfaces: ["Layer"],
    components: {
      Identity: { name: "Runde A", id: "layer-0001", aliases: [] },
      Layer: { kind: "campaign", order: 50 },
    },
    relations: [],
  },
  {
    ...artikel(
      "camp_a",
      "Campaign",
      "Aus Nebel wacht",
      "campaign-0001",
      "ready",
    ),
    relations: [
      { id: "camp_a~ac", type: "activates", to: "ly_a", props: { order: 10 } },
    ],
  },
  artikel("it_seil", "Item", "Rope", "item-0001", "ready"),
  artikel("wp_axt", "Weapon", "Handaxe", "weapon-0001", "ready"),
  artikel("pl_tor", "Place", "Fog Gate", "location-0001"),
  artikel("pl_turm", "Place", "Watchtower", "location-0002", "idea"),
];

async function aufbau() {
  const repo = new InMemoryRepository(
    seedRegistry,
    BESTAND.map((e) => structuredClone(e)),
  );
  const app = buildApp({ repo });
  for (const [name, admin, roles] of [
    ["Admin", true, {}],
    ["Basil", false, { camp_a: "gm" }],
    ["Sela", false, { camp_a: "player" }],
    ["Tamm", false, { camp_a: "player" }],
  ] as const) {
    await repo.putUser({
      id: randomUUID(),
      name,
      passwordHash: await hashPassword(PASSWORT),
      isAdmin: admin,
      actorIds: [],
      roles: { ...roles },
    });
  }
  const kekse = new Map<string, string>();
  const rufe = async (
    name: string,
    method: "GET" | "POST" | "PUT" | "DELETE",
    url: string,
    payload?: unknown,
  ) => {
    if (!kekse.has(name)) {
      const res = await app.inject({
        method: "POST",
        url: "/api/login",
        payload: { name, password: PASSWORT },
      });
      kekse.set(
        name,
        `nw_session=${res.cookies.find((x) => x.name === "nw_session")?.value ?? ""}`,
      );
    }
    return app.inject({
      method,
      url,
      headers: { cookie: kekse.get(name)! },
      ...(payload !== undefined ? { payload: payload as object } : {}),
    });
  };
  return { repo, rufe };
}

describe("filter groups per page (T-137)", () => {
  it("lets the GM set a page default and players keep their own groups", async () => {
    const { rufe } = await aufbau();
    const vorgabe = await rufe("Basil", "POST", "/api/filters", {
      page: "world",
      name: "Without items",
      scope: "campaign",
      default: true,
      filter: { notype: ["Item"], bogus: 1 },
    });
    expect(vorgabe.statusCode).toBe(201);
    expect(vorgabe.json()).toMatchObject({
      scope: "campaign",
      default: true,
      filter: { notype: ["Item"] },
    });

    /* Spielende legen keine Gruppe der Kampagne an, wohl aber eigene — ohne Vorgabe. */
    expect(
      (
        await rufe("Sela", "POST", "/api/filters", {
          page: "world",
          name: "X",
          scope: "campaign",
        })
      ).statusCode,
    ).toBe(403);
    const eigen = await rufe("Sela", "POST", "/api/filters", {
      page: "world",
      name: "Places",
      default: true,
      filter: { of: ["Place"] },
    });
    expect(eigen.json()).toMatchObject({
      scope: "own",
      default: false,
      canEdit: true,
    });

    const sela = (await rufe("Sela", "GET", "/api/filters")).json();
    expect(sela.canManage).toBe(false);
    expect(
      sela.groups.map((g: { name: string; canEdit: boolean }) => [
        g.name,
        g.canEdit,
      ]),
    ).toEqual([
      ["Without items", false],
      ["Places", true],
    ]);
    /* Die eigene Gruppe eines anderen Kontos gibt es für Tamm nicht. */
    const tamm = (await rufe("Tamm", "GET", "/api/filters")).json();
    expect(tamm.groups.map((g: { name: string }) => g.name)).toEqual([
      "Without items",
    ]);
    expect(
      (await rufe("Tamm", "DELETE", `/api/filters/${eigen.json().id}`))
        .statusCode,
    ).toBe(404);
    expect(
      (
        await rufe("Sela", "PUT", `/api/filters/${vorgabe.json().id}`, {
          name: "Mine now",
        })
      ).statusCode,
    ).toBe(403);
    expect((await rufe("Basil", "GET", "/api/filters")).json().canManage).toBe(
      true,
    );
  });

  it("keeps one default per page", async () => {
    const { rufe } = await aufbau();
    const a = (
      await rufe("Basil", "POST", "/api/filters", {
        page: "world",
        name: "A",
        scope: "campaign",
        default: true,
      })
    ).json();
    const b = (
      await rufe("Admin", "POST", "/api/filters", {
        page: "world",
        name: "B",
        scope: "campaign",
        default: true,
      })
    ).json();
    await rufe("Basil", "POST", "/api/filters", {
      page: "rules",
      name: "C",
      scope: "campaign",
      default: true,
    });
    const alle = (await rufe("Basil", "GET", "/api/filters")).json().groups as {
      id: string;
      page: string;
      default: boolean;
    }[];
    expect(
      alle
        .filter((g) => g.default)
        .map((g) => g.page)
        .sort(),
    ).toEqual(["rules", "world"]);
    expect(alle.find((g) => g.id === a.id)?.default).toBe(false);
    expect(alle.find((g) => g.id === b.id)?.default).toBe(true);
    /* Umbenennen und löschen. */
    expect(
      (
        await rufe("Basil", "PUT", `/api/filters/${b.id}`, {
          name: "Places only",
          default: false,
        })
      ).json(),
    ).toMatchObject({ name: "Places only", default: false });
    expect(
      (await rufe("Basil", "DELETE", `/api/filters/${a.id}`)).statusCode,
    ).toBe(200);
    expect(
      (await rufe("Basil", "GET", "/api/filters")).json().groups,
    ).toHaveLength(2);
  });

  it("lists without a type and its subtypes, and by status", async () => {
    const { rufe } = await aufbau();
    const ohne = (
      await rufe("Admin", "GET", "/api/list?area=world&notype=Item")
    ).json();
    const namen = ohne.rows.map((r: { name: string }) => r.name);
    expect(namen).toEqual(expect.arrayContaining(["Fog Gate", "Watchtower"]));
    expect(namen).not.toContain("Rope");
    expect(namen).not.toContain("Handaxe");
    /* Ohne Status-Karte zählt ein Artikel als fertig (D72). */
    const fertig = (
      await rufe("Admin", "GET", "/api/list?type=Place&status=ready")
    ).json();
    expect(fertig.rows.map((r: { name: string }) => r.name)).toEqual([
      "Fog Gate",
    ]);
    expect(
      parseListQuery({ notype: "Item,Spell", status: "idea" }),
    ).toMatchObject({ notype: ["Item", "Spell"], status: ["idea"] });
  });

  it("keeps only what a group can carry", () => {
    expect(
      savedFilter({
        of: ["Location", 3, ""],
        q: "  fog ",
        nolayer: "x",
        extra: true,
      }),
    ).toEqual({ of: ["Location"], q: "fog" });
    expect(savedFilter(null)).toEqual({});
  });
});

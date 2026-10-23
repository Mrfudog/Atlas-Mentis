/**
 * Eine Ebene leeren und die Schreibebene wählen (T-176): Tests landen in
 * einer eigenen Ebene, und „Empty this layer" nimmt sie als eine
 * umkehrbare Massenänderung wieder heraus — samt Teilen und den Kanten,
 * die von aussen darauf zeigten.
 */

import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { seedRegistry } from "@nw/registry";
import type { Entity } from "@nw/model";
import { buildApp } from "../src/app.js";
import { InMemoryRepository } from "../src/repo.js";
import { hashPassword } from "../src/auth.js";

const PASSWORT = "nebel-wacht-am-tor";

const ebene = (id: string): Entity => ({
  id,
  interfaces: ["Layer"],
  name: id,
  components: {
    Identity: { name: id, id: `layer-${id}`, aliases: [] },
    Layer: { order: 10 },
  },
  relations: [],
});

async function aufbau() {
  const repo = new InMemoryRepository(
    {
      ...seedRegistry,
      settings: { ...(seedRegistry.settings ?? {}), campaign: "camp_nebel" },
    },
    [
      ebene("ly_regeln"),
      ebene("ly_nebel"),
      {
        id: "camp_nebel",
        interfaces: ["Campaign"],
        name: "Nebelwacht",
        components: {
          Identity: { name: "Nebelwacht", id: "campaign-0001", aliases: [] },
        },
        relations: [
          {
            id: "a1",
            type: "activates",
            to: "ly_regeln",
            props: { order: 10 },
          },
          { id: "a2", type: "activates", to: "ly_nebel", props: { order: 20 } },
        ],
      },
      {
        id: "sb_wache",
        interfaces: ["Statblock"],
        name: "Wache",
        components: {
          Identity: { name: "Wache", id: "statblock-0001", aliases: [] },
          Statblock: { ac: 16, hp: 11 },
        },
        relations: [
          { id: "sb_wache~l", type: "inLayer", to: "ly_regeln", props: {} },
        ],
      },
    ],
  );
  const app = buildApp({ repo });
  const ids = new Map<string, string>();
  const konto = async (
    name: string,
    roles: Record<string, "gm" | "player">,
    isAdmin = false,
  ) => {
    const id = `u_${name.toLowerCase()}_${randomUUID().slice(0, 4)}`;
    ids.set(name, id);
    await repo.putUser({
      id,
      name,
      passwordHash: await hashPassword(PASSWORT),
      isAdmin,
      actorIds: [],
      roles,
    });
  };
  await konto("Mira", { camp_nebel: "gm" });
  await konto("Tom", { camp_nebel: "player" });
  await konto("Basil", { camp_nebel: "gm" }, true);
  const kekse = new Map<string, string>();
  const als = async (
    name: string,
    method: "GET" | "POST" | "PUT" | "DELETE",
    url: string,
    payload?: unknown,
  ) => {
    let k = kekse.get(name);
    if (!k) {
      const res = await app.inject({
        method: "POST",
        url: "/api/login",
        payload: { name, password: PASSWORT },
      });
      k = `nw_session=${res.cookies.find((x) => x.name === "nw_session")!.value}`;
      kekse.set(name, k);
    }
    return app.inject({
      method,
      url,
      headers: { cookie: k },
      ...(payload !== undefined ? { payload: payload as object } : {}),
    });
  };
  /** Eine eigene Ebene anlegen und in der Kampagne aufschalten. */
  const testebene = async (name: string) => {
    const ly = (
      await als(name, "POST", "/api/layers", { name: `${name} · Tests` })
    ).json().id as string;
    const c = (await repo.getEntity("camp_nebel"))!;
    await repo.putEntity({
      ...c,
      relations: [
        ...(c.relations ?? []),
        { id: `a_${ly}`, type: "activates", to: ly, props: { order: 30 } },
      ],
    });
    return ly;
  };
  return { repo, als, ids, testebene };
}

const inLayer = (e: Entity) =>
  (e.relations ?? []).filter((r) => r.type === "inLayer").map((r) => r.to);

describe("chosen write layer (T-176)", () => {
  it("a GM picks a layer of her own; new articles land there until the choice is taken back", async () => {
    const { als, testebene } = await aufbau();
    const ly = await testebene("Mira");
    expect(
      (await als("Mira", "GET", "/api/layers/default")).json().layer.id,
    ).toBe("ly_nebel");
    expect(
      (await als("Mira", "PUT", `/api/layers/${ly}/default`, {})).statusCode,
    ).toBe(200);
    expect(
      (await als("Mira", "GET", "/api/layers/default")).json().layer.id,
    ).toBe(ly);
    const mine = (await als("Mira", "GET", "/api/layers/mine")).json();
    expect(mine.default.id).toBe(ly);
    const e = (
      await als("Mira", "POST", "/api/entities", {
        type: "Place",
        name: "Probe",
      })
    ).json() as Entity;
    expect(inLayer(e)).toEqual([ly]);
    expect(
      (await als("Mira", "DELETE", "/api/layers/default")).statusCode,
    ).toBe(200);
    expect(
      (await als("Mira", "GET", "/api/layers/default")).json().layer.id,
    ).toBe("ly_nebel");
  });

  it("only a layer one writes, also one not in play (T-418); for another account only the administration", async () => {
    const { als, ids, testebene, repo } = await aufbau();
    /* Nicht aufgeschaltet: wählbar seit T-418 — was dort entsteht, steht in
       dieser Kampagne erst, wenn sie die Ebene aufschaltet. */
    const lose = (
      await als("Mira", "POST", "/api/layers", { name: "Lose" })
    ).json().id as string;
    expect(
      (await als("Mira", "PUT", `/api/layers/${lose}/default`, {})).statusCode,
    ).toBe(200);
    /* In einem Regelwerk schreibt sie nicht. */
    expect(
      (await als("Mira", "PUT", "/api/layers/ly_regeln/default", {}))
        .statusCode,
    ).toBe(409);
    const ly = await testebene("Mira");
    expect(
      (
        await als("Tom", "PUT", `/api/layers/${ly}/default`, {
          user: ids.get("Mira"),
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await als("Basil", "PUT", `/api/layers/${ly}/default`, {
          user: ids.get("Mira"),
        })
      ).statusCode,
    ).toBe(200);
    expect((await repo.getPrefs(ids.get("Mira")!))["writeLayer"]).toEqual({
      camp_nebel: ly,
    });
  });

  it("the administration creates without a layer as before, and in its chosen one once it has picked", async () => {
    const { als, testebene } = await aufbau();
    const vorher = (
      await als("Basil", "POST", "/api/entities", {
        type: "Place",
        name: "Ohne",
      })
    ).json() as Entity;
    expect(inLayer(vorher)).toEqual([]);
    const ly = await testebene("Basil");
    expect(
      (await als("Basil", "PUT", `/api/layers/${ly}/default`, {})).statusCode,
    ).toBe(200);
    const danach = (
      await als("Basil", "POST", "/api/entities", {
        type: "Place",
        name: "Mit",
      })
    ).json() as Entity;
    expect(inLayer(danach)).toEqual([ly]);
    /* Eine Ebene selbst kommt in keine Ebene. */
    const l = (
      await als("Basil", "POST", "/api/entities", {
        type: "Layer",
        name: "Noch eine",
      })
    ).json() as Entity;
    expect(inLayer(l)).toEqual([]);
  });
});

describe("empty this layer (T-176)", () => {
  async function gefuellt() {
    const k = await aufbau();
    const { repo, als, testebene } = k;
    const ly = await testebene("Mira");
    expect(
      (await als("Mira", "PUT", `/api/layers/${ly}/default`, {})).statusCode,
    ).toBe(200);
    const figur = (
      await als("Mira", "POST", "/api/entities", {
        type: "Creature",
        name: "Testfigur",
      })
    ).json() as Entity;
    /* Ihr Statblock ist eine Instanz der Wache, in derselben Ebene (so legt die Seite ihn an). */
    await repo.putEntity({
      id: "sb_inst",
      interfaces: ["Statblock"],
      name: "Testfigur",
      components: {
        Identity: { name: "Testfigur", id: "statblock-0002", aliases: [] },
        Statblock: { hp: 20 },
      },
      relations: [
        { id: "sb_inst~i", type: "instanceOf", to: "sb_wache", props: {} },
        { id: "sb_inst~b", type: "belongsTo", to: figur.id, props: {} },
        { id: "sb_inst~l", type: "inLayer", to: ly, props: {} },
      ],
    });
    /* Von aussen zeigt ein Board darauf: die Kante geht, das Board bleibt. */
    await repo.putEntity({
      id: "board_aussen",
      interfaces: ["Board"],
      name: "Rules",
      components: {
        Identity: { name: "Rules", id: "board-0001", aliases: [] },
      },
      relations: [
        { id: "board_aussen~l", type: "inLayer", to: "ly_nebel", props: {} },
        {
          id: "board_aussen~p1",
          type: "placed",
          to: figur.id,
          props: { x: 0, y: 0, w: 2, h: 2, z: 1 },
        },
        {
          id: "board_aussen~p2",
          type: "placed",
          to: "sb_wache",
          props: { x: 2, y: 0, w: 2, h: 2, z: 2 },
        },
      ],
    });
    return { ...k, ly, figur };
  }

  it("shows the count first, wants it confirmed, then deletes contents, parts and edges into them", async () => {
    const { repo, als, ly, figur } = await gefuellt();
    const vorschau = (
      await als("Mira", "POST", `/api/layers/${ly}/empty`, { dryRun: true })
    ).json();
    expect(vorschau).toMatchObject({
      dryRun: true,
      selected: 2,
      deleted: 2,
      changed: 1,
      rejectedCount: 0,
      layer: { id: ly },
    });
    expect(await repo.getEntity(figur.id)).toBeTruthy();
    expect(
      (await als("Mira", "POST", `/api/layers/${ly}/empty`, {})).statusCode,
    ).toBe(409);
    const r = await als("Mira", "POST", `/api/layers/${ly}/empty`, {
      confirmDelete: 2,
    });
    expect(r.statusCode).toBe(200);
    const id = r.json().id as string;
    expect(await repo.getEntity(figur.id)).toBeUndefined();
    expect(await repo.getEntity("sb_inst")).toBeUndefined();
    /* Die Ebene, die Vorlage und das Board bleiben; das Board zeigt nicht ins Leere. */
    expect(await repo.getEntity(ly)).toBeTruthy();
    expect(await repo.getEntity("sb_wache")).toBeTruthy();
    expect(
      (await repo.getEntity("board_aussen"))!.relations!.map((x) => x.to),
    ).toEqual(["ly_nebel", "sb_wache"]);

    /* Zurück, wie jede Massenänderung — wer geleert hat, darf das selbst. */
    expect(
      (await als("Mira", "POST", `/api/bulk/${id}/undo`, {})).statusCode,
    ).toBe(200);
    expect(await repo.getEntity(figur.id)).toBeTruthy();
    expect(await repo.getEntity("sb_inst")).toBeTruthy();
    expect(
      (await repo.getEntity("board_aussen"))!.relations!.map((x) => x.to),
    ).toEqual(["ly_nebel", figur.id, "sb_wache"]);
  });

  it("is for the owner and the administration only", async () => {
    const { als, ly } = await gefuellt();
    expect(
      (await als("Tom", "POST", `/api/layers/${ly}/empty`, { dryRun: true }))
        .statusCode,
    ).toBe(403);
    expect(
      (await als("Basil", "POST", `/api/layers/${ly}/empty`, { dryRun: true }))
        .statusCode,
    ).toBe(200);
    expect(
      (
        await als("Mira", "POST", "/api/layers/gibts-nicht/empty", {
          dryRun: true,
        })
      ).statusCode,
    ).toBe(404);
  });

  it("a delete stands alone in a bulk change, and takes the parts along", async () => {
    const { als, figur, repo, ly } = await gefuellt();
    /* Ohne Ebenenkante geht die Instanz trotzdem mit: sie gehört der Figur. */
    const sb = (await repo.getEntity("sb_inst"))!;
    await repo.putEntity({
      ...sb,
      relations: sb.relations!.filter((r) => r.to !== ly),
    });
    const r = await als("Basil", "POST", "/api/bulk", {
      select: { ids: [figur.id] },
      ops: [{ op: "delete" }, { op: "addTag", tag: "x" }],
    });
    expect(r.statusCode).toBe(400);
    const v = await als("Basil", "POST", "/api/bulk", {
      select: { ids: [figur.id] },
      ops: [{ op: "delete" }],
      dryRun: true,
    });
    expect(v.json()).toMatchObject({ deleted: 2, changed: 1 });
  });
});

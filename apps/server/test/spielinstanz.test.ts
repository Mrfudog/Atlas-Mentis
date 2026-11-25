/**
 * Karten und Begegnungen im Spiel als Instanz (T-289, E-039, E-041):
 * „Take into play" legt eine Instanz an, Spielende sehen sie erst nach der
 * Freigabe, der Nebel gilt je Instanz, und die Vorlage listet die
 * gespielten Stände.
 */

import { describe, expect, it } from "vitest";
import { seedRegistry } from "@nw/registry";
import { releaseMap, type Entity, type Relation } from "@nw/model";
import { buildApp } from "../src/app.js";
import { InMemoryRepository } from "../src/repo.js";
import { hashPassword } from "../src/auth.js";

const PASSWORT = "nebel-wacht-am-tor";
const imLayer = (id: string): Relation => ({
  id: `${id}~l`,
  type: "inLayer",
  to: "ly_nebel",
  props: {},
});

const art = (
  id: string,
  type: string,
  name: string,
  extra: Record<string, unknown> = {},
  relations: Relation[] = [],
): Entity => ({
  id,
  interfaces: [type],
  name,
  components: {
    Identity: { name, id: `${type.toLowerCase()}-${id}`, aliases: [] },
    ...extra,
  },
  relations: [imLayer(id), ...relations],
});

const bestand: Entity[] = [
  {
    id: "ly_nebel",
    interfaces: ["Layer"],
    name: "Nebel",
    components: { Identity: { name: "Nebel", id: "layer-1", aliases: [] } },
    relations: [],
  },
  {
    id: "camp_nebel",
    interfaces: ["Campaign"],
    name: "Nebelwacht",
    components: {
      Identity: { name: "Nebelwacht", id: "campaign-0001", aliases: [] },
    },
    relations: [
      { id: "a1", type: "activates", to: "ly_nebel", props: { order: 5 } },
    ],
  },
  art("pt_1", "Party", "Die Wache", {}, [
    { id: "po", type: "partyOf", to: "camp_nebel", props: {} },
  ]),
  art("pc_1", "PlayerCharacter", "Rook", {}, [
    { id: "mp", type: "memberOfParty", to: "pt_1", props: {} },
  ]),
  art("npc_offen", "Creature", "Volo"),
  art("npc_wache", "Creature", "Wache"),
  art(
    "gruft",
    "Map",
    "Gruft",
    {
      Image: { image: "as_gruft" },
      Map: {
        fog: true,
        reveal: [{ id: "r1", kind: "rect", x: 0, y: 0, w: 0.5, h: 0.5 }],
      },
    },
    [
      { id: "g1", type: "marker", to: "npc_offen", props: { x: 0.2, y: 0.2 } },
      {
        id: "v1",
        type: "marker",
        to: "npc_wache",
        props: {
          x: 0.6,
          y: 0.6,
          kind: "play",
          hidden: true,
          encounter: "enc_neu",
        },
      },
    ],
  ),
  art(
    "enc_neu",
    "Encounter",
    "Wachwechsel",
    {
      Encounter: { phase: "planned", round: 0 },
      Visibility: { audience: "gm" },
    },
    [
      { id: "n1", type: "participates", to: "npc_wache", props: {} },
      { id: "n2", type: "participates", to: "pc_1", props: { init: 15 } },
      { id: "n3", type: "onMap", to: "gruft", props: {} },
    ],
  ),
  art("s_1", "Session", "Abend 1", { Time: { sort: 1 } }),
  art("s_2", "Session", "Abend 2", { Time: { sort: 2 } }),
];

async function aufbau() {
  const repo = new InMemoryRepository(
    {
      ...seedRegistry,
      settings: { ...(seedRegistry.settings ?? {}), campaign: "camp_nebel" },
    },
    bestand,
  );
  const app = buildApp({ repo });
  for (const [name, role, actors] of [
    ["Mira", "gm", []],
    ["Sela", "player", ["pc_1"]],
  ] as const) {
    await repo.putUser({
      id: `u_${name.toLowerCase()}`,
      name,
      passwordHash: await hashPassword(PASSWORT),
      isAdmin: false,
      actorIds: [...actors],
      roles: { camp_nebel: role },
    });
  }
  const kekse = new Map<string, string>();
  const keks = async (name: string) => {
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
    return k;
  };
  const hole = async (name: string, url: string) =>
    app.inject({ method: "GET", url, headers: { cookie: await keks(name) } });
  const sende = async (
    name: string,
    method: "POST" | "PUT",
    url: string,
    payload: unknown,
  ) =>
    app.inject({
      method,
      url,
      headers: { cookie: await keks(name) },
      payload: payload as Record<string, unknown>,
    });
  const nimm = async (session: string, map: string) => {
    const res = await sende("Mira", "POST", "/api/play/take", { session, map });
    expect(res.statusCode, res.body).toBe(200);
    return res.json().map as string;
  };
  return { repo, hole, sende, nimm };
}

const marker = (e: Entity) =>
  (e.relations ?? []).filter((r) => r.type === "marker").map((r) => r.id);

describe("taking a map into play (T-289)", () => {
  it("creates an instance for the session, fog on and nothing revealed; the template stays as it is", async () => {
    const { repo, hole, nimm, sende } = await aufbau();
    expect(
      (
        await sende("Sela", "POST", "/api/play/take", {
          session: "s_1",
          map: "gruft",
        })
      ).statusCode,
    ).toBe(403);
    const id = await nimm("s_1", "gruft");
    expect(id).not.toBe("gruft");
    const roh = (await repo.getEntity(id))!;
    expect((roh.relations ?? []).find((r) => r.type === "instanceOf")?.to).toBe(
      "gruft",
    );
    expect(roh.components["Map"]).toMatchObject({
      released: false,
      reveal: [],
    });
    expect(roh.components["Played"]).toMatchObject({ playedIn: "s_1" });
    const s = (await repo.getEntity("s_1"))!;
    expect(
      s.components["Session"] ?? s.components["SessionState"],
    ).toMatchObject({ activeMap: id });
    /* Gelesen mit der Vorlage darunter: ihre Marker, ihr Bild. */
    const gm = (await hole("Mira", `/api/entities/${id}`)).json() as Entity;
    expect(marker(gm)).toEqual(["g1", "v1"]);
    expect(gm.components["Image"]).toMatchObject({ image: "as_gruft" });
    /* Noch einmal in derselben Sitzung: dieselbe Instanz. */
    expect(await nimm("s_1", "gruft")).toBe(id);
    expect(
      (
        (await repo.getEntity("gruft"))!.components["Map"] as {
          reveal: unknown[];
        }
      ).reveal,
    ).toHaveLength(1);
  });

  it("is not there for players until released — not by id, not on the table, not under Played", async () => {
    const { hole, nimm, sende } = await aufbau();
    const id = await nimm("s_1", "gruft");
    expect((await hole("Sela", `/api/entities/${id}`)).statusCode).toBe(404);
    expect((await hole("Sela", "/api/play?session=s_1")).json()).toMatchObject({
      map: null,
    });
    expect((await hole("Sela", "/api/maps/gruft/played")).json().rows).toEqual(
      [],
    );
    expect((await hole("Mira", "/api/play?session=s_1")).json()).toMatchObject({
      map: id,
      inPlay: true,
    });
    const gm = (await hole("Mira", "/api/maps/gruft/played")).json();
    expect(
      gm.rows.map((r: { id: string; released: boolean }) => [r.id, r.released]),
    ).toEqual([[id, false]]);

    /* Freigeben: mit dem Nebel der Instanz — nichts aufgedeckt, also kein Marker. */
    const voll = (await hole("Mira", `/api/entities/${id}`)).json() as Entity;
    const res = await sende("Mira", "PUT", `/api/entities/${id}`, {
      ...voll,
      components: {
        ...voll.components,
        Map: { ...(voll.components["Map"] as object), released: true },
      },
    });
    expect(res.statusCode, res.body).toBe(200);
    const sela = await hole("Sela", `/api/entities/${id}`);
    expect(sela.statusCode).toBe(200);
    expect(marker(sela.json() as Entity)).toEqual([]);
    expect((await hole("Sela", "/api/play?session=s_1")).json()).toMatchObject({
      map: id,
    });
    expect(
      (await hole("Sela", "/api/maps/gruft/played"))
        .json()
        .rows.map((r: { id: string }) => r.id),
    ).toEqual([id]);
  });

  it("release shares a map whose template was prepared for the GM only", async () => {
    const { repo, hole, nimm, sende } = await aufbau();
    /* Die Vorlage in Vorbereitung und nur für die Leitung — so liegt eine
       Karte da, bevor der Abend beginnt. */
    const v = (await repo.getEntity("gruft"))!;
    await repo.putEntity({
      ...v,
      components: {
        ...v.components,
        Visibility: { audience: "gm" },
        Status: { status: "prepared" },
      },
    });
    const id = await nimm("s_1", "gruft");
    const voll = (await hole("Mira", `/api/entities/${id}`)).json() as Entity;
    const res = await sende("Mira", "PUT", `/api/entities/${id}`, releaseMap(voll, true));
    expect(res.statusCode, res.body).toBe(200);
    expect((await hole("Sela", `/api/entities/${id}`)).statusCode).toBe(200);
    expect((await hole("Sela", "/api/play?session=s_1")).json()).toMatchObject({ map: id });
    /* Die Vorlage bleibt, wie sie war: geteilt ist der Stand am Tisch. */
    expect((await hole("Sela", "/api/entities/gruft")).statusCode).toBe(404);
  });

  it("keeps two rounds on the same map apart", async () => {
    const { repo, hole, nimm, sende } = await aufbau();
    const eins = await nimm("s_1", "gruft");
    const zwei = await nimm("s_2", "gruft");
    expect(zwei).not.toBe(eins);
    const voll = (await hole("Mira", `/api/entities/${eins}`)).json() as Entity;
    const token: Relation = {
      id: "tk1",
      type: "marker",
      to: "pc_1",
      props: { x: 0.3, y: 0.3, kind: "play" },
    };
    const res = await sende("Mira", "PUT", `/api/entities/${eins}`, {
      ...voll,
      relations: [...(voll.relations ?? []), token],
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(
      marker((await hole("Mira", `/api/entities/${eins}`)).json()),
    ).toContain("tk1");
    expect(
      marker((await hole("Mira", `/api/entities/${zwei}`)).json()),
    ).not.toContain("tk1");
    expect(marker((await repo.getEntity("gruft"))!)).toEqual(["g1", "v1"]);
  });
});

describe("starting an encounter from its template (T-289)", () => {
  it("starts an instance on the map in play; the template stays planned", async () => {
    const { repo, sende, nimm } = await aufbau();
    const karte = await nimm("s_1", "gruft");
    const res = await sende("Mira", "POST", "/api/encounters/enc_neu/start", {
      session: "s_1",
    });
    expect(res.statusCode, res.body).toBe(200);
    const id = res.json().encounter as string;
    expect(id).not.toBe("enc_neu");
    const inst = (await repo.getEntity(id))!;
    expect(inst.components["Encounter"]).toMatchObject({
      phase: "running",
      round: 1,
    });
    expect((inst.relations ?? []).find((r) => r.type === "onMap")?.to).toBe(
      karte,
    );
    /* Die Sichtbarkeit der Vorlage geht mit: eine Begegnung nur für die Leitung bleibt es. */
    expect(inst.components["Visibility"]).toEqual({ audience: "gm" });
    expect(
      (await repo.getEntity("enc_neu"))!.components["Encounter"],
    ).toMatchObject({ phase: "planned", round: 0 });
    /* Die vorplatzierten Tokens der Vorlage stehen jetzt auf der Instanz der Karte. */
    const k = (await repo.getEntity(karte))!;
    expect(
      (k.relations ?? []).find((r) => r.id.startsWith("v1"))?.props,
    ).toEqual({ x: 0.6, y: 0.6, kind: "play" });
    expect(
      (await repo.getEntity("gruft"))!.relations!.find((r) => r.id === "v1")!
        .props,
    ).toMatchObject({ hidden: true });
    const s = (await repo.getEntity("s_1"))!;
    expect(
      s.components["Session"] ?? s.components["SessionState"],
    ).toMatchObject({ activeMap: karte, activeEncounter: id });
    expect(
      (
        await sende("Mira", "POST", `/api/encounters/${id}/start`, {
          session: "s_1",
        })
      ).statusCode,
    ).toBe(409);
  });
});

describe("maps in play elsewhere (T-289)", () => {
  it("are not in the map list and draw no second frame on the map above", async () => {
    const { hole, nimm, repo } = await aufbau();
    await repo.putEntity(art("welt", "Map", "Welt"));
    const g = (await repo.getEntity("gruft"))!;
    await repo.putEntity({
      ...g,
      relations: [
        ...(g.relations ?? []),
        {
          id: "in1",
          type: "insideMap",
          to: "welt",
          props: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 },
        },
      ],
    });
    const id = await nimm("s_1", "gruft");
    const liste = (await hole("Mira", "/api/maps")).json() as {
      maps: { id: string; children?: { id: string }[] }[];
    };
    expect(JSON.stringify(liste)).not.toContain(id);
    const welt = (await hole("Mira", "/api/maps/welt/context")).json() as {
      children: { id: string }[];
    };
    expect(welt.children.map((c) => c.id)).toEqual(["gruft"]);
    const inst = (await hole("Mira", `/api/maps/${id}/context`)).json() as {
      parents: { id: string }[];
    };
    expect(inst.parents.map((p) => p.id)).toEqual(["welt"]);
  });
});

describe("changing maps in play (T-308)", () => {
  /** Welt › Gruft (auf dem Tisch) › Nische, die Gruft ohne Nebel freigegeben. */
  async function mitUnterkarten() {
    const a = await aufbau();
    const { repo, nimm } = a;
    await repo.putEntity(art("welt", "Map", "Welt"));
    await repo.putEntity(
      art("nische", "Map", "Nische", {}, [
        { id: "in2", type: "insideMap", to: "gruft", props: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 } },
      ]),
    );
    const g = (await repo.getEntity("gruft"))!;
    await repo.putEntity({
      ...g,
      relations: [
        ...(g.relations ?? []),
        { id: "in1", type: "insideMap", to: "welt", props: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 } },
      ],
    });
    const freigeben = async (id: string) => {
      const e = (await repo.getEntity(id))!;
      await repo.putEntity({
        ...e,
        components: { ...e.components, Map: { ...(e.components["Map"] as object), fog: false, released: true } },
      });
    };
    const schalten = async (an: boolean) => {
      const s = (await repo.getEntity("s_1"))!;
      await repo.putEntity({
        ...s,
        components: { ...s.components, Session: { ...(s.components["Session"] as object), mapNavigation: an } },
      });
    };
    const gruft = await nimm("s_1", "gruft");
    await freigeben(gruft);
    return { ...a, gruft, freigeben, schalten };
  }
  type Kontext = {
    navigation: boolean;
    mapNavigation: boolean;
    session: string | null;
    parents: { id: string }[];
    children: { id: string }[];
  };

  it("is off by default: players stay on the map on the table, frames are only picture", async () => {
    const { hole, gruft } = await mitUnterkarten();
    const sp = (await hole("Sela", `/api/maps/${gruft}/context`)).json() as Kontext;
    expect(sp).toMatchObject({ navigation: false, mapNavigation: false, session: "s_1", parents: [], children: [] });
    /* Die Leitung navigiert immer — in die Vorlage, solange es keine Instanz gibt. */
    const gm = (await hole("Mira", `/api/maps/${gruft}/context`)).json() as Kontext;
    expect(gm.navigation).toBe(true);
    expect(gm.parents.map((p) => p.id)).toEqual(["welt"]);
    expect(gm.children.map((c) => c.id)).toEqual(["nische"]);
  });

  it("when switched on, leads players only into maps released in this session", async () => {
    const { hole, nimm, gruft, freigeben, schalten } = await mitUnterkarten();
    await schalten(true);
    let sp = (await hole("Sela", `/api/maps/${gruft}/context`)).json() as Kontext;
    expect(sp).toMatchObject({ navigation: true, mapNavigation: true, parents: [], children: [] });

    const nische = await nimm("s_1", "nische");
    sp = (await hole("Sela", `/api/maps/${gruft}/context`)).json() as Kontext;
    expect(sp.children).toEqual([]);
    await freigeben(nische);
    const welt = await nimm("s_1", "welt");
    await freigeben(welt);
    sp = (await hole("Sela", `/api/maps/${gruft}/context`)).json() as Kontext;
    expect(sp.children.map((c) => c.id)).toEqual([nische]);
    expect(sp.parents.map((p) => p.id)).toEqual([welt]);
    /* Die Leitung landet jetzt ebenso in der Instanz und nicht in der Vorlage. */
    const gm = (await hole("Mira", `/api/maps/${gruft}/context`)).json() as Kontext;
    expect(gm.children.map((c) => c.id)).toEqual([nische]);

    /* Wieder aus: zurück auf die Karte auf dem Tisch. */
    await schalten(false);
    sp = (await hole("Sela", `/api/maps/${gruft}/context`)).json() as Kontext;
    expect(sp).toMatchObject({ navigation: false, parents: [], children: [] });
  });

  it("leaves maps outside play as they were", async () => {
    const { hole } = await mitUnterkarten();
    const gm = (await hole("Mira", "/api/maps/gruft/context")).json() as Kontext;
    expect(gm).toMatchObject({ navigation: true, session: null });
    expect(gm.children.map((c) => c.id)).toEqual(["nische"]);
  });
});

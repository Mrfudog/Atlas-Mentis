#!/usr/bin/env node
/**
 * **Was eine Seite lädt** (T-398, REQ-397; Bezug T-322): öffnet die
 * wichtigsten Seiten in einem frischen Browser, je Breite (Telefon 390 px,
 * Desktop 1360 px), und hält jeden Abruf fest — Weg, Status, übertragene
 * Bytes, Dauer, `Server-Timing`. **Keine Inhalte**: kein Antwortkörper,
 * keine Namen, nur Wege, Zahlen und Zeiten. Ids in den Wegen werden zu `:id`,
 * damit der Bericht zwischen zwei Beständen vergleichbar bleibt.
 *
 *   node scripts/laden-messen.mjs --base https://dev.example \
 *     --artikel <id> --karte <id> --board <id> [--als <konto-id>] \
 *     [--json messung.json] [--runden 2] [--nur Artikel,Board] [--breiten 390,1360]
 *
 * Angemeldet wird nicht hier: auf dev setzt der Proxy die Anmeldung, lokal
 * gibt `--cookie name=wert` sie mit. Ohne Seite für eine Id fällt sie weg.
 *
 * Gemessen wird bis „Netz ruhig" (500 ms ohne Abruf, höchstens `--warte`
 * Sekunden) — das ist die Zeit, bis die Seite steht, nicht die bis zum
 * ersten Bild.
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { URL } from "node:url";

const { values: opt } = parseArgs({
  options: {
    base: { type: "string", default: "http://localhost:4200" },
    artikel: { type: "string" },
    karte: { type: "string" },
    board: { type: "string" },
    als: { type: "string" },
    cookie: { type: "string" },
    json: { type: "string" },
    runden: { type: "string", default: "1" },
    warte: { type: "string", default: "60" },
    breiten: { type: "string", default: "390,1360" },
    nur: { type: "string" },
    proxy: { type: "string", default: process.env.HTTPS_PROXY ?? "" },
  },
});

const base = opt.base.replace(/\/$/, "");
const seiten = [
  ["Start", "/"],
  ["Kompendium", "/compendium"],
  ["Bereich world", "/world"],
  opt.artikel && ["Artikel", `/artikel/${opt.artikel}`],
  /* Die Kurzansicht ist ein Popup: im Kompendium über der ersten Zeile verweilen. */
  ["Kurzansicht", "/compendium", "schweben"],
  ["Kartenliste", "/maps"],
  opt.karte && ["Karte", `/play?map=${opt.karte}`],
  opt.board && ["Board", `/boards/${opt.board}`],
]
  .filter(Boolean)
  .filter(([n]) => !opt.nur || opt.nur.split(",").includes(n));

/** Ids und Abfragewerte weg: der Weg sagt, *was* gefragt wurde, nicht *wonach*. */
function weg(url) {
  const u = new URL(url);
  const p = u.pathname
    .split("/")
    .map((s) =>
      /^(e5?_|bd_|ly_|pt_|u_)|^[0-9a-f-]{20,}$|^[a-z]+-\d{3,}$/i.test(s)
        ? ":id"
        : s,
    )
    .join("/");
  const keys = [...u.searchParams.keys()];
  return keys.length ? `${p}?${[...new Set(keys)].sort().join("&")}` : p;
}

/** `Server-Timing` ohne `app`: `{ db: { ms, n }, sieb: … }`. */
function abschnitteAus(kopf) {
  const aus = {};
  for (const teil of kopf.split(",")) {
    const [name, ...rest] = teil.trim().split(";");
    if (!name || name === "app") continue;
    const r = rest.join(";");
    aus[name] = { ms: Number(/dur=([\d.]+)/.exec(r)?.[1] ?? NaN), n: Number(/desc="(\d+)x"/.exec(r)?.[1] ?? 1) };
  }
  return aus;
}

async function miss(browser, breite, name, pfad, tun) {
  const context = await browser.newContext({
    viewport: { width: breite, height: breite < 600 ? 844 : 900 },
    extraHTTPHeaders: opt.als ? { "x-view-as": opt.als } : {},
  });
  if (opt.cookie) {
    const [k, ...v] = opt.cookie.split("=");
    await context.addCookies([{ name: k, value: v.join("="), url: base }]);
  }
  const page = await context.newPage();
  const abrufe = [];
  const offen = new Map();
  let zuletzt = Date.now();
  page.on("request", (r) => {
    /* Der Live-Kanal (T-116) bleibt offen, solange die Seite steht. */
    if (r.url().includes("/api/live")) return;
    offen.set(r, Date.now());
    zuletzt = Date.now();
  });
  const fertig = async (r, fehler) => {
    if (!offen.has(r)) return;
    const start = offen.get(r) ?? Date.now();
    offen.delete(r);
    zuletzt = Date.now();
    const res = fehler ? null : await r.response().catch(() => null);
    const sizes = await r.sizes().catch(() => null);
    const kopf = res ? await res.allHeaders().catch(() => ({})) : {};
    abrufe.push({
      art: r.resourceType(),
      methode: r.method(),
      weg: r.url().startsWith(base) ? weg(r.url()) : new URL(r.url()).host,
      status: res?.status() ?? (fehler ? "abbruch" : null),
      bytes: (sizes?.responseBodySize ?? 0) + (sizes?.responseHeadersSize ?? 0),
      ms: Date.now() - start,
      server:
        Number(/dur=([\d.]+)/.exec(kopf["server-timing"] ?? "")?.[1] ?? NaN) ||
        null,
      /* Die Abschnitte am Server (T-398, `zeitmessung.ts`): db, stand, sieb, index. */
      abschnitte: abschnitteAus(kopf["server-timing"] ?? ""),
      cache: kopf["cache-control"] ?? null,
      etag: !!kopf["etag"],
    });
  };
  page.on("requestfinished", (r) => void fertig(r, false));
  page.on("requestfailed", (r) => void fertig(r, true));

  const t0 = Date.now();
  let t1 = t0;
  let fehler = null;
  try {
    await page.goto(base + pfad, {
      waitUntil: "domcontentloaded",
      timeout: Number(opt.warte) * 1000,
    });
    const bis = t0 + Number(opt.warte) * 1000;
    const ruhig = async () => {
      while (Date.now() < bis && (offen.size || Date.now() - zuletzt < 500))
        await page.waitForTimeout(100);
    };
    await ruhig();
    if (tun === "schweben") {
      /* Nur was das Popup holt, zählt — das Kompendium davor ist gemessen. */
      abrufe.length = 0;
      const ziel = page.locator('[nwquick], main a[href*="/artikel/"]').first();
      await ziel.waitFor({ timeout: 20000 });
      t1 = Date.now();
      await ziel.hover();
      zuletzt = Date.now();
      await page.waitForTimeout(1200);
      await ruhig();
    }
  } catch (e) {
    fehler = String(e.message ?? e).split("\n")[0];
  }
  const ms = Date.now() - t1 - (offen.size ? 0 : 500);
  await new Promise((r) => setTimeout(r, 50));
  await context.close();
  return {
    name,
    pfad: weg(base + pfad),
    breite,
    ms,
    fehler,
    offen: offen.size,
    abrufe,
  };
}

const browser = await chromium.launch(
  opt.proxy ? { proxy: { server: opt.proxy } } : {},
);
const ergebnis = [];
for (let runde = 1; runde <= Number(opt.runden); runde++)
  for (const breite of opt.breiten.split(",").map(Number))
    for (const [name, pfad, tun] of seiten) {
      const m = await miss(browser, breite, name, pfad, tun);
      ergebnis.push({ runde, ...m });
      const api = m.abrufe.filter((a) => a.weg.startsWith("/api/"));
      const kb = (n) => (n / 1024).toFixed(0);
      const doppelt = Object.entries(
        api.reduce((z, a) => ((z[a.weg] = (z[a.weg] ?? 0) + 1), z), {}),
      ).filter(([, n]) => n > 1);
      console.log(
        `${runde} ${String(breite).padStart(4)} ${name.padEnd(14)} ${String(m.ms).padStart(6)} ms ` +
          `${String(m.abrufe.length).padStart(3)} Abrufe (${api.length} API) ` +
          `${kb(m.abrufe.reduce((s, a) => s + a.bytes, 0)).padStart(6)} kB ` +
          `(JS ${kb(m.abrufe.filter((a) => a.art === "script").reduce((s, a) => s + a.bytes, 0))} kB, ` +
          `API ${kb(api.reduce((s, a) => s + a.bytes, 0))} kB)` +
          (doppelt.length
            ? ` doppelt: ${doppelt.map(([w, n]) => `${w}×${n}`).join(", ")}`
            : "") +
          (m.fehler ? ` FEHLER ${m.fehler}` : "") +
          (m.offen ? ` (${m.offen} offen)` : ""),
      );
      for (const a of api.sort((x, y) => y.ms - x.ms).slice(0, 6))
        console.log(
          `      ${String(a.ms).padStart(6)} ms ${String(a.server ?? "-").padStart(8)} srv ${kb(a.bytes).padStart(5)} kB ${a.status} ${a.methode} ${a.weg}` +
            Object.entries(a.abschnitte)
              .map(([k, v]) => ` ${k} ${Math.round(v.ms)}${v.n > 1 ? `/${v.n}` : ""}`)
              .join(""),
        );
    }
await browser.close();
if (opt.json)
  writeFileSync(
    opt.json,
    JSON.stringify(
      { at: new Date().toISOString(), base: new URL(base).host, ergebnis },
      null,
      1,
    ),
  );

#!/usr/bin/env node
/**
 * **Bilder aus 5e.tools hochladen und verknüpfen** (T-144).
 *
 *   node scripts/bilder-5etools.mjs <bildplan.json> --img <5etools-img> [Auswahl]          Vorschau
 *   node scripts/bilder-5etools.mjs <bildplan.json> --img <5etools-img> [Auswahl] --write  hochladen
 *
 *   Auswahl: --only MM,PHB (Quellen)  --kind token,image,map  --limit 50
 *   Ablage:  --out <verzeichnis>  (Vorgabe ./bilder-lauf: Journal und Massenänderungen)
 *   --targets  zählt schon in der Vorschau, welche Artikel es auf dev gibt
 *   --reserve <GB>  so viel bleibt auf dem Datenträger der Ablage frei (Vorgabe 2)
 *   --all-layers  auch Artikel in Ebenen, die die laufende Kampagne nicht
 *                 aufschaltet (nur Verwaltung, T-284): Zielprüfung, Hochladen
 *                 und Massenänderung mit `allLayers` — sonst gelten sie als
 *                 „nicht auf dev“, obwohl sie dastehen
 *
 * Der Plan kommt vom Einleser (`node packages/import-5etools/dist/cli.js
 * <data> --images bildplan.json`, `bilder.ts`): je Bild der Pfad unter
 * `5etools-img`, die Klasse und der Artikel, der es zeigt. Die Bilder selbst
 * kommen **nie ins Repository** — nur über die API in die Ablage auf dev.
 *
 * 1. **Vorschau** (ohne `--write`): wie viele Bilder, wie viele Dateien da
 *    sind und wie gross sie zusammen sind — die Zahl fürs Protokoll, bevor
 *    etwas hochgeht.
 * 2. **Hochladen** (`--write`): je Datei einmal `POST /api/assets` mit
 *    `for` = dem zeigenden Artikel — das Bild kommt in seine Ebene und
 *    übernimmt seine Sichtbarkeit und seinen Stand (wie in der Maske), mit
 *    Klasse (`kind`) und Herkunft (`publication`, `anchor:
 *    5etools-img:<pfad>`). Was hochging, steht im **Journal**
 *    (`<out>/journal.jsonl`, Pfad → Asset-Id); ein zweiter Lauf lädt es
 *    nicht noch einmal hoch, darum lässt sich jederzeit abbrechen.
 * 3. **Verknüpfen** schreibt das Skript nicht selbst, sondern als
 *    Massenänderungen (`<out>/verknuepfen-<n>.json`, je 1000 Artikel):
 *    `Statblock.token` und `Image.image` je Artikel (`values`), nur wo noch
 *    nichts steht (`ifEmpty`) — eine Karte, die heute ihre Adresse zeigt,
 *    bekommt das Bild auch so. Dann wie jede Massenänderung:
 *    `node scripts/atlas.mjs bulk --dry-run …`, danach ohne, und die Id
 *    fürs Zurücknehmen ins Protokoll.
 *
 * Liest `ATLAS_URL` und `ATLAS_DEV_TOKEN` wie `scripts/atlas.mjs`. Ohne
 * Abhängigkeiten.
 */

/* global FormData, Blob */
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

if ((process.env.HTTPS_PROXY || process.env.https_proxy) && !process.env.NODE_USE_ENV_PROXY) {
  const r = spawnSync(process.execPath, process.argv.slice(1), {
    stdio: 'inherit',
    env: { ...process.env, NODE_USE_ENV_PROXY: '1', NODE_NO_WARNINGS: '1' },
  });
  process.exit(r.status ?? 1);
}

const args = process.argv.slice(2);
const wert = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : undefined;
};
const liste = (flag) => (wert(flag) ?? '').split(',').map((s) => s.trim()).filter(Boolean);

const planPfad = args[0] && !args[0].startsWith('--') ? args[0] : undefined;
const img = wert('--img');
if (!planPfad || !img) {
  console.error('node scripts/bilder-5etools.mjs <bildplan.json> --img <5etools-img> [--only MM,PHB] [--kind token,image,map] [--limit N] [--out verzeichnis] [--write]');
  process.exit(2);
}

const BASE = (process.env.ATLAS_URL || 'https://dev.ttrpg.fuchsbau.io').replace(/\/+$/, '');
const TOKEN = process.env.ATLAS_DEV_TOKEN || '';
const SCHREIBEN = args.includes('--write');
const ALLE_EBENEN = args.includes('--all-layers');
const OUT = resolve(wert('--out') ?? 'bilder-lauf');
const kopf = () => (TOKEN ? { authorization: `Bearer ${TOKEN}` } : {});

const MIME = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', avif: 'image/avif' };

/* ---- Plan und Auswahl */
const plan = JSON.parse(readFileSync(resolve(planPfad), 'utf8'));
if (plan.format !== 'atlas-bilder/1') {
  console.error(`${planPfad}: kein Bildplan (format ${plan.format}).`);
  process.exit(2);
}
const nurQuellen = new Set(liste('--only').map((q) => q.toLowerCase()));
const nurKlassen = new Set(liste('--kind'));
let eintraege = plan.eintraege.filter((b) => (!nurQuellen.size || nurQuellen.has(String(b.quelle).toLowerCase())) && (!nurKlassen.size || nurKlassen.has(b.klasse)));
const limit = Number(wert('--limit') ?? 0);
if (limit > 0) eintraege = eintraege.slice(0, limit);

/** Die Datei eines Pfads im Checkout — mit oder ohne `img/` davor. */
function datei(pfad) {
  for (const p of [join(img, pfad), join(img, 'img', pfad)]) if (existsSync(p)) return p;
  return null;
}

/* ---- 1. Was da ist */
const dateien = new Map(); // Pfad → { datei, bytes }
const fehlt = new Set();
for (const b of eintraege) {
  if (dateien.has(b.pfad) || fehlt.has(b.pfad)) continue;
  const d = datei(b.pfad);
  if (d) dateien.set(b.pfad, { datei: d, bytes: statSync(d).size });
  else fehlt.add(b.pfad);
}
const summe = [...dateien.values()].reduce((s, d) => s + d.bytes, 0);
const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;
const jeKlasse = {};
for (const b of eintraege) {
  const k = (jeKlasse[b.klasse] ??= { bilder: 0, bytes: 0, pfade: new Set() });
  k.bilder += 1;
  if (!k.pfade.has(b.pfad)) {
    k.pfade.add(b.pfad);
    k.bytes += dateien.get(b.pfad)?.bytes ?? 0;
  }
}

console.log(`${SCHREIBEN ? 'Hochladen' : 'Vorschau'} gegen ${BASE}`);
console.log(`Bilder im Plan: ${plan.eintraege.length}; ausgewählt: ${eintraege.length} (${new Set(eintraege.map((b) => b.pfad)).size} Dateien)`);
for (const [k, v] of Object.entries(jeKlasse)) console.log(`  ${k}: ${v.bilder} Bilder, ${v.pfade.size} Dateien, ${mb(v.bytes)}`);
console.log(`Im Checkout gefunden: ${dateien.size} Dateien, zusammen ${mb(summe)}; fehlen: ${fehlt.size}`);
for (const p of [...fehlt].slice(0, 15)) console.log(`  fehlt: ${p}`);

/* ---- Gibt es den Artikel auf dev? (je Ziel einmal; mit `--targets` schon in der Vorschau) */
const daSind = new Map();
async function gibtEs(id) {
  if (!daSind.has(id)) {
    /* Tausende Abfragen hintereinander: ein 502 dazwischen (Neustart,
       Proxy) ist kein Grund, den Lauf zu verlieren. */
    let res;
    for (let versuch = 0; ; versuch++) {
      try {
        res = await fetch(`${BASE}/api/entities/${encodeURIComponent(id)}${ALLE_EBENEN ? '?allLayers=1' : ''}`, { headers: kopf() });
        await res.arrayBuffer();
        if (res.status >= 500 && versuch < 4) throw new Error(`HTTP ${res.status}`);
        break;
      } catch (error) {
        if (versuch >= 4) throw error;
        await new Promise((r) => setTimeout(r, 2000 * 2 ** versuch));
      }
    }
    if (res.status !== 200 && res.status !== 404) throw new Error(`GET /api/entities/${id}: ${res.status}`);
    daSind.set(id, res.status === 200);
  }
  return daSind.get(id);
}
if (args.includes('--targets')) {
  const ziele = [...new Set(eintraege.map((b) => b.ziel))];
  let da = 0;
  for (const id of ziele) if (await gibtEs(id)) da += 1;
  const mitDatei = eintraege.filter((b) => daSind.get(b.ziel) && dateien.has(b.pfad));
  const bytes = [...new Set(mitDatei.map((b) => b.pfad))].reduce((s, p) => s + dateien.get(p).bytes, 0);
  console.log(`Artikel auf dev: ${da} von ${ziele.length}; hochzuladen wären ${new Set(mitDatei.map((b) => b.pfad)).size} Dateien, ${mb(bytes)}`);
}

/* ---- Journal: Pfad → Asset-Id */
mkdirSync(OUT, { recursive: true });
const journalPfad = join(OUT, 'journal.jsonl');
const journal = new Map();
if (existsSync(journalPfad)) {
  for (const z of readFileSync(journalPfad, 'utf8').split('\n')) {
    if (!z.trim()) continue;
    const j = JSON.parse(z);
    if (j.asset) journal.set(j.pfad, j.asset);
  }
}
console.log(`Schon hochgeladen (Journal): ${eintraege.filter((b) => journal.has(b.pfad)).length}`);

/* ---- Platz (T-211): was die Ablage hat und was der Lauf noch braucht.
   Je Datei das Original und seine Vorschau (480 px WebP, geschätzt 40 KB,
   nie grösser als das Original). Mit `--write` bricht der Lauf ab, bevor
   er den Datenträger unter die Reserve füllt — ein voller Datenträger
   nimmt auch der Datenbank daneben den Platz. */
const offen = [...dateien.entries()].filter(([p]) => !journal.has(p));
const braucht = offen.reduce((s, [, d]) => s + d.bytes + Math.min(d.bytes, 40 * 1024), 0);
const reserve = Number(wert('--reserve') ?? 2) * 1024 ** 3;
const platzRes = await fetch(`${BASE}/api/assets/storage`, { headers: kopf() });
const platz = platzRes.ok ? await platzRes.json() : (await platzRes.arrayBuffer(), null);
if (platz) {
  console.log(`Ablage: ${platz.files} Dateien, ${mb(platz.bytes)}; frei ${platz.free == null ? '?' : mb(platz.free)} von ${platz.total == null ? '?' : mb(platz.total)}`);
} else {
  console.log(`Ablage: Platz unbekannt (GET /api/assets/storage: ${platzRes.status})`);
}
console.log(`Braucht noch: ${offen.length} Dateien, ${mb(braucht)} mit Vorschauen; Reserve ${mb(reserve)}`);
if (SCHREIBEN && offen.length && (!platz || platz.free == null || platz.free - braucht < reserve)) {
  console.error(platz?.free == null ? 'Abgebrochen: der freie Platz der Ablage ist nicht bekannt.' : `Abgebrochen: danach blieben ${mb(platz.free - braucht)} frei, weniger als die Reserve.`);
  process.exit(3);
}

/* ---- 2. Hochladen */
const abgelehnt = [];
if (SCHREIBEN) {
  let n = 0;
  for (const b of eintraege) {
    if (journal.has(b.pfad) || !dateien.has(b.pfad)) continue;
    if (!(await gibtEs(b.ziel))) {
      abgelehnt.push({ pfad: b.pfad, ziel: b.ziel, code: 404, grund: 'Artikel nicht auf dev' });
      continue;
    }
    const { datei: d } = dateien.get(b.pfad);
    const endung = d.split('.').pop().toLowerCase();
    const form = new FormData();
    form.set('name', b.name);
    form.set('for', b.ziel);
    form.set('kind', b.klasse);
    if (b.alt) form.set('alt', b.alt);
    form.set('publication', b.quelle);
    form.set('anchor', `5etools-img:${b.pfad}`);
    if (ALLE_EBENEN) form.set('allLayers', '1');
    form.set('file', new Blob([readFileSync(d)], { type: MIME[endung] ?? 'application/octet-stream' }), basename(d));
    let res;
    for (let versuch = 0; ; versuch++) {
      try {
        res = await fetch(`${BASE}/api/assets`, { method: 'POST', headers: kopf(), body: form });
        if (res.status >= 500 && versuch < 3) throw new Error(`HTTP ${res.status}`);
        break;
      } catch (error) {
        if (versuch >= 3) throw error;
        await new Promise((r) => setTimeout(r, 2000 * 2 ** versuch));
      }
    }
    const text = await res.text();
    if (res.status !== 201) {
      abgelehnt.push({ pfad: b.pfad, ziel: b.ziel, code: res.status, grund: text.slice(0, 200) });
      appendFileSync(journalPfad, `${JSON.stringify({ pfad: b.pfad, ziel: b.ziel, code: res.status })}\n`);
      continue;
    }
    const a = JSON.parse(text);
    journal.set(b.pfad, a.id);
    appendFileSync(journalPfad, `${JSON.stringify({ pfad: b.pfad, ziel: b.ziel, asset: a.id, nummer: a.components?.Identity?.id, klasse: b.klasse, at: new Date().toISOString() })}\n`);
    if (++n % 100 === 0) console.log(`  … ${n} hochgeladen`);
  }
  console.log(`Hochgeladen: ${n}; abgelehnt: ${abgelehnt.length}`);
  for (const a of abgelehnt.slice(0, 20)) console.log(`  ${a.code} ${a.pfad} → ${a.ziel}: ${a.grund}`);
}

/* ---- 3. Massenänderungen zum Verknüpfen */
const werte = { 'Statblock.token': new Map(), 'Image.image': new Map() };
for (const b of eintraege) {
  if (!b.feld) continue;
  const asset = journal.get(b.pfad);
  if (!asset) continue;
  if (!werte[b.feld].has(b.ziel)) werte[b.feld].set(b.ziel, asset);
}
const ziele = [...new Set([...werte['Statblock.token'].keys(), ...werte['Image.image'].keys()])];
const STUECK = 1000;
let datein = 0;
for (let i = 0; i < ziele.length; i += STUECK) {
  const ids = ziele.slice(i, i + STUECK);
  const ops = [];
  for (const [feld, m] of Object.entries(werte)) {
    const values = Object.fromEntries(ids.filter((id) => m.has(id)).map((id) => [id, m.get(id)]));
    if (Object.keys(values).length) ops.push({ op: 'set', field: feld, values, ifEmpty: true });
  }
  /* Eine Karte zeigt heute ihre Adresse: die ersetzt das Bild. Ein eigenes
     `set` ohne `ifEmpty`, nur für genau diese Artikel. */
  const karten = Object.fromEntries(
    eintraege.filter((b) => b.ersetzt && ids.includes(b.ziel) && journal.has(b.pfad)).map((b) => [b.ziel, journal.get(b.pfad)]),
  );
  if (Object.keys(karten).length) {
    const bild = ops.find((o) => o.field === 'Image.image');
    if (bild) for (const id of Object.keys(karten)) delete bild.values[id];
    ops.push({ op: 'set', field: 'Image.image', values: karten });
  }
  datein += 1;
  writeFileSync(join(OUT, `verknuepfen-${datein}.json`), `${JSON.stringify({ select: { ids }, ops, ...(ALLE_EBENEN ? { allLayers: true } : {}) }, null, 1)}\n`);
}
console.log(`Verknüpfen: ${werte['Statblock.token'].size} Tokens, ${werte['Image.image'].size} Bilder an ${ziele.length} Artikeln → ${datein} Massenänderung(en) in ${OUT}`);
if (datein) console.log(`Weiter: node scripts/atlas.mjs bulk --dry-run ${join(OUT, 'verknuepfen-1.json')}`);

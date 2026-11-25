#!/usr/bin/env node
/**
 * Ebenen von dev nach prod übernehmen, Ebene für Ebene (T-477), über die
 * Übernahme der Werkbank (T-130, `POST /api/transfer/preview|run`).
 *
 *   node scripts/uebernahme-ebenen.mjs                      # Probelauf: zählt, schreibt nichts
 *   node scripts/uebernahme-ebenen.mjs --run                # übernimmt, Ebene für Ebene
 *   node scripts/uebernahme-ebenen.mjs --layers e5_book_wdh,e5_book_phb [--run]
 *   node scripts/uebernahme-ebenen.mjs --out bericht.json   # Zählung als Datei
 *
 * Gesprochen wird nur mit **dev** (`ATLAS_URL`, Vorgabe
 * https://dev.ttrpg.fuchsbau.io). dev fragt prod selbst, über die
 * Server-Einstellung `ATLAS_PEER_URL`/`ATLAS_PEER_TOKEN`; prod nimmt nur an,
 * solange dort `ATLAS_TRANSFER_ACCEPT=1` steht (docs/Betrieb.md ›
 * Übernahme dev ↔ prod). Auslösen darf nur die **Verwaltung** von dev: das
 * Token (`ATLAS_DEV_TOKEN` oder Network secret) muss einem Konto mit
 * `is_admin` gehören.
 *
 * Was es tut:
 *  1. Gerüst: die gewählten Ebenen samt ihren Gruppen und Herausgebern
 *     (`partOf`, eine Stufe), damit jede Ebene auf prod an ihrer Stelle hängt.
 *  2. Je Ebene: Vorschau mit Abhängigkeiten (Statblock, Kreatur, Bilder,
 *     Kantenziele einen Schritt). Gezählt werden neu, geändert,
 *     unverändert, Konflikt und „nur auf prod geändert".
 *  3. **Verlustliste:** alles, was auf prod einen anderen Stand
 *     überschreiben würde (geändert, Konflikt, nur auf prod geändert).
 *     Ist sie für eine Ebene nicht leer, wird diese Ebene **nicht**
 *     übernommen. Dann entscheidet die Leitung in der Werkbank, Artikel
 *     für Artikel. Mit `--run` wird also nur angelegt, was es auf prod noch
 *     nicht gibt, und was gleich steht, bleibt, wie es ist.
 *
 * Nicht dabei: Kampagnenebenen, Spielerebenen, Konten, Rollen (REQ-199).
 * Die Vorgabeliste unten enthält nur Ebenen aus 5e.tools.
 * Zurück: Werkbank › Transfer › Lauf › Undo, oder die Sicherung, die prod
 * vor jedem Lauf schreibt (`backups/uebernahme/…-vor-uebernahme-von-dev.json`).
 */

/* global AbortSignal */
import { writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

/* Wie scripts/atlas.mjs: hinter einem Proxy braucht Nodes fetch NODE_USE_ENV_PROXY. */
if ((process.env.HTTPS_PROXY || process.env.https_proxy) && !process.env.NODE_USE_ENV_PROXY) {
  const r = spawnSync(process.execPath, process.argv.slice(1), {
    stdio: 'inherit',
    env: { ...process.env, NODE_USE_ENV_PROXY: '1', NODE_NO_WARNINGS: '1' },
  });
  process.exit(r.status ?? 1);
}

const BASE = (process.env.ATLAS_URL || 'https://dev.ttrpg.fuchsbau.io').replace(/\/+$/, '');
const TOKEN = process.env.ATLAS_DEV_TOKEN || '';
const args = process.argv.slice(2);
const option = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};
const RUN = args.includes('--run');

/** T-477: Dragon Heist und die 2014er Quellen, die auf dev liegen. */
const VORGABE = [
  'e5_book_wdh', 'e5_book_phb', 'e5_book_mm', 'e5_book_dmg', 'e5_book_xge', 'e5_book_tce',
  'e5_book_vgm', 'e5_book_mtf', 'e5_book_mpmm', 'e5_book_ftd', 'e5_book_scag', 'e5_book_erlw',
  'e5_book_gos', 'e5_book_wdmm', 'e5_book_aag', 'e5_book_bmt', 'e5_book_scc', 'e5_book_screen',
  'e5_book_screendungeonkit',
];
const EBENEN = (option('--layers') ?? VORGABE.join(',')).split(',').map((s) => s.trim()).filter(Boolean);

async function api(pfad, body) {
  const res = await fetch(`${BASE}${pfad}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(20 * 60 * 1000),
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { error: text.slice(0, 300) };
  }
  return { status: res.status, json };
}

function stirb(text) {
  console.error(text);
  process.exit(1);
}

const VERLUST = new Set(['changed', 'conflict', 'target-ahead']);

/** Vorschau und, mit --run und leerer Verlustliste, der Lauf. */
async function uebernimm(name, auftrag) {
  const v = await api('/api/transfer/preview', auftrag);
  if (v.status !== 200) return { name, error: `${v.status}: ${v.json?.error ?? '?'}` };
  const items = v.json.items ?? [];
  const nachArt = {};
  for (const i of items) {
    const z = (nachArt[i.type] ??= { new: 0, changed: 0, unchanged: 0, conflict: 0, 'target-ahead': 0 });
    z[i.status] = (z[i.status] ?? 0) + 1;
  }
  const verlust = items.filter((i) => VERLUST.has(i.status)).map((i) => ({ id: i.id, number: i.number, name: i.name, type: i.type, status: i.status, fields: (i.fields ?? []).map((f) => f.key ?? f.field ?? '?') }));
  const neu = items.filter((i) => i.status === 'new');
  const ergebnis = { name, counts: v.json.counts, byType: nachArt, loss: verlust, written: 0 };
  if (!RUN) return ergebnis;
  if (verlust.length) return { ...ergebnis, skipped: 'Verlustliste nicht leer — in der Werkbank entscheiden' };
  if (!neu.length) return ergebnis;
  const lauf = await api('/api/transfer/run', {
    ...auftrag,
    apply: neu.map((i) => i.id),
    expect: Object.fromEntries(neu.map((i) => [i.id, [i.sourceKey, i.targetKey]])),
  });
  if (lauf.status !== 200) return { ...ergebnis, error: `Lauf ${lauf.status}: ${lauf.json?.error ?? '?'}` };
  return { ...ergebnis, written: neu.length, run: lauf.json?.id ?? lauf.json?.run ?? null };
}

const stand = await api('/api/transfer');
if (stand.status !== 200) stirb(`/api/transfer: ${stand.status} ${stand.json?.error ?? ''} — das Token muss der Verwaltung von dev gehören.`);
if (!stand.json?.peer) stirb('Auf dev ist keine Gegenstelle eingerichtet (ATLAS_PEER_URL, ATLAS_PEER_TOKEN in /srv/atlas/dev/.env).');
console.log(`${RUN ? 'Lauf' : 'Probelauf'}: ${BASE} → ${stand.json.peer.name}, ${EBENEN.length} Ebenen\n`);

/* 1. Gerüst: Ebenen, Gruppen, Herausgeber. */
const geruest = new Set(EBENEN);
for (const id of EBENEN) {
  const e = await api(`/api/entities/${encodeURIComponent(id)}`);
  if (e.status !== 200) {
    console.log(`  ${id}: auf dev nicht gefunden (${e.status}) — übersprungen`);
    geruest.delete(id);
    continue;
  }
  for (const r of e.json.relations ?? []) if (r.type === 'partOf') geruest.add(r.to);
}
const ergebnisse = [await uebernimm('Gerüst (Ebenen, Gruppen, Herausgeber)', { direction: 'push', select: { ids: [...geruest] } })];

/* 2. Je Ebene mit Abhängigkeiten. */
for (const id of EBENEN.filter((x) => geruest.has(x))) {
  ergebnisse.push(await uebernimm(id, { direction: 'push', select: { layer: id }, dependencies: true }));
}

for (const r of ergebnisse) {
  if (r.error) {
    console.log(`✗ ${r.name}: ${r.error}`);
    continue;
  }
  const c = r.counts ?? {};
  console.log(`${r.skipped ? '!' : '✓'} ${r.name}: neu ${c.new} · geändert ${c.changed} · unverändert ${c.unchanged} · Konflikt ${c.conflict} · nur prod ${c.targetAhead}${RUN ? ` · geschrieben ${r.written}` : ''}${r.skipped ? ` — ${r.skipped}` : ''}`);
  for (const l of r.loss.slice(0, 10)) console.log(`    Verlust? ${l.status} ${l.number || l.id} ${l.name} (${l.type}) ${l.fields.join(', ')}`);
  if (r.loss.length > 10) console.log(`    … und ${r.loss.length - 10} weitere`);
}
const verlustGesamt = ergebnisse.reduce((s, r) => s + (r.loss?.length ?? 0), 0);
console.log(`\nVerlustliste gesamt: ${verlustGesamt}${verlustGesamt ? ' — diese Artikel wurden nicht geschrieben' : ' (leer)'}`);
const out = option('--out');
if (out) await writeFile(out, JSON.stringify({ at: new Date().toISOString(), base: BASE, run: RUN, results: ergebnisse }, null, 2));
if (ergebnisse.some((r) => r.error)) process.exit(1);

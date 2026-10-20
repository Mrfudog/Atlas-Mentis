#!/usr/bin/env node
/**
 * **Zauberwahlen an Klassen und Unterklassen nachziehen** (T-309).
 *
 *   node scripts/zauberwahl-nachziehen.mjs <5etools-src/data/class> <ausgabe.json>
 *   node scripts/atlas.mjs bulk --dry-run <ausgabe.json>
 *   node scripts/atlas.mjs bulk <ausgabe.json>
 *
 * Der Importer schreibt seit T-309 die Zauberwahlen einer Klasse
 * (Zaubertricks, Zauberbuch, bekannte oder vorbereitete Zauber) in ihre
 * Wahlen. Eingelesen wird einmal (D71); was schon dasteht, bekommt sie mit
 * diesem Lauf: er liest die Klassen-JSON eines Checkouts von
 * `5etools-src` (ausserhalb des Repos), sucht die Artikel derselben Klasse
 * und Quelle in der Installation und schreibt eine Massenänderung, die nur
 * die neuen Wahlen anhängt — die alten bleiben, mit ihren Ids, und eine
 * Klasse, die schon eine Zauberwahl aus ihrer Liste trägt, bleibt ganz
 * unberührt. Gerechnet wird mit `zauberwahlen` aus dem Importer, nicht mit
 * einer zweiten Fassung davon.
 *
 * Liest `ATLAS_URL` (Vorgabe dev) und `ATLAS_DEV_TOKEN` wie `atlas.mjs`;
 * schreibt selbst nichts in die Installation. Braucht den Bau von
 * `@nw/model` und `@nw/import-5etools`.
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

if ((process.env.HTTPS_PROXY || process.env.https_proxy) && !process.env.NODE_USE_ENV_PROXY) {
  const r = spawnSync(process.execPath, process.argv.slice(1), { stdio: 'inherit', env: { ...process.env, NODE_USE_ENV_PROXY: '1', NODE_NO_WARNINGS: '1' } });
  process.exit(r.status ?? 1);
}

const { zauberwahlen } = await import('../packages/import-5etools/dist/arten/charakterbau.js');

const BASE = (process.env.ATLAS_URL || 'https://dev.ttrpg.fuchsbau.io').replace(/\/+$/, '');
const TOKEN = process.env.ATLAS_DEV_TOKEN || '';
const [ordner, ausgabe] = process.argv.slice(2);
if (!ordner || !ausgabe) {
  console.error('node scripts/zauberwahl-nachziehen.mjs <5etools-src/data/class> <ausgabe.json>');
  process.exit(2);
}

async function api(pfad) {
  const r = await fetch(`${BASE}${pfad}`, { headers: TOKEN ? { authorization: `Bearer ${TOKEN}` } : {} });
  if (!r.ok) throw new Error(`${pfad}: ${r.status} ${await r.text()}`);
  return r.json();
}

/* Die Artikel der Installation: Name ohne „(XPHB)" und Kürzel der Quelle. */
const schluessel = (name, quelle) => `${String(name).replace(/\s*\([A-Z0-9]+\)\s*$/, '').toLowerCase()}|${String(quelle).split(' ')[0]}`;
const artikel = new Map();
const namen = new Map();
for (const typ of ['Class', 'Subclass']) {
  /* Die Liste gibt höchstens 200 je Blatt: blättern. */
  for (let offset = 0; ; offset += 200) {
    const l = await api(`/api/list?type=${typ}&limit=200&offset=${offset}&allLayers=1`);
    for (const z of l.rows) {
      artikel.set(`${typ}:${schluessel(z.name, z.source ?? '')}`, z.id);
      namen.set(z.id, z.name);
    }
    if (!l.rows.length || offset + l.rows.length >= l.total) break;
  }
}

const roh = [];
for (const f of (await readdir(ordner)).filter((x) => /^class-.*\.json$/.test(x))) {
  const d = JSON.parse(await readFile(join(ordner, f), 'utf8'));
  for (const k of d.class ?? []) roh.push({ typ: 'Class', e: k, s: schluessel(k.name, k.source) });
  for (const u of d.subclass ?? []) {
    roh.push({ typ: 'Subclass', e: u, s: schluessel(u.name, u.source) });
    if (u.shortName) roh.push({ typ: 'Subclass', e: u, s: schluessel(u.shortName, u.source) });
  }
}

const werte = {};
const bericht = [];
const gesehen = new Set();
for (const { typ, e, s } of roh) {
  const id = artikel.get(`${typ}:${s}`);
  if (!id || gesehen.has(id)) continue;
  /* Eine Unterklasse ohne eigenes Zauberwirken zaubert über ihre Klasse. */
  if (typ === 'Subclass' && !e.casterProgression) continue;
  gesehen.add(id);
  const ganz = await api(`/api/entities/${encodeURIComponent(id)}`);
  const alt = ganz.components?.Choices?.choices ?? [];
  if (alt.some((c) => c.kind === 'spell' && c.from?.listedBy)) {
    bericht.push(`${namen.get(id)}: hat schon Zauberwahlen — unberührt`);
    continue;
  }
  const neu = zauberwahlen(e, id, alt.map((c) => c.id));
  if (!neu.length) continue;
  werte[id] = [...alt, ...neu];
  bericht.push(`${namen.get(id)} (${id}): ${neu.map((c) => `${c.id} ×${c.count}${c.level ? ` ab ${c.level}` : ''}`).join(', ')}`);
}

const ids = Object.keys(werte);
await writeFile(
  ausgabe,
  JSON.stringify(
    {
      select: { ids },
      ops: [{ op: 'set', field: 'Choices.choices', values: werte }],
      note: 'T-309: Zauberwahlen (Zaubertricks, Zauberbuch, bekannte/vorbereitete Zauber) an Klassen und Unterklassen',
    },
    null,
    2,
  ),
);
console.log(bericht.join('\n'));
console.log(`\n${ids.length} Artikel → ${ausgabe}`);

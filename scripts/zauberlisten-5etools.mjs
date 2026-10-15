#!/usr/bin/env node
/**
 * **Zauberlisten aus 5e.tools nachtragen** (T-212).
 *
 *   node scripts/zauberlisten-5etools.mjs <plan.json> [--only class-0012,…] [--except …] [--check] [--out auftrag.json]
 *
 * Der Plan kommt vom Einleser (`node packages/import-5etools/dist/cli.js
 * <data> --spell-lists plan.json`, `arten/zauberlisten.ts`): je Klasse und
 * Unterklasse ihre Zauber, mit den Peg-Ids desselben Laufs. Auf einem
 * Server, der die Klassen schon hat, bringt `import --only-new` keine neue
 * Kante an einen bestehenden Artikel — dieses Skript schreibt sie darum
 * als **eine Massenänderung** (`addRelation` mit `targets`, je Klasse ihre
 * Ziele). Geschrieben wird sie wie jede:
 *
 *   node scripts/atlas.mjs bulk --dry-run auftrag.json
 *   node scripts/atlas.mjs bulk auftrag.json
 *
 * `--only` / `--except` wählen Klassen nach Nummer, Peg-Id oder Name (die
 * Probe: eine Klasse, dann der Rest mit `--except`). `--check` fragt dev
 * je Ziel, ob es den Artikel gibt (`GET /api/entities/:id`), und lässt
 * fehlende weg — sonst nennt die Vorschau jedes als übersprungen („no such
 * article"), und der Rest geht trotzdem. Eine Kante, die schon steht, legt
 * die Massenänderung nicht noch einmal an.
 *
 * Liest `ATLAS_URL` und `ATLAS_DEV_TOKEN` wie `scripts/atlas.mjs`. Ohne
 * Abhängigkeiten. Die Daten von 5e.tools kommen nie ins Repository: der
 * Plan und der Auftrag gehören ausserhalb.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
const liste = (flag) => (wert(flag) ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

const planPfad = args[0] && !args[0].startsWith('--') ? args[0] : undefined;
if (!planPfad) {
  console.error('node scripts/zauberlisten-5etools.mjs <plan.json> [--only …] [--except …] [--check] [--out auftrag.json]');
  process.exit(2);
}
const BASE = (process.env.ATLAS_URL || 'https://dev.ttrpg.fuchsbau.io').replace(/\/+$/, '');
const TOKEN = process.env.ATLAS_DEV_TOKEN || '';
const kopf = () => (TOKEN ? { authorization: `Bearer ${TOKEN}` } : {});

const plan = JSON.parse(readFileSync(resolve(planPfad), 'utf8'));
if (plan.format !== 'atlas-zauberlisten/1') {
  console.error(`${planPfad}: kein Zauberlistenplan (format ${plan.format})`);
  process.exit(2);
}
const nur = liste('--only');
const ohne = liste('--except');
const trifft = (l, w) => w.includes(l.nummer.toLowerCase()) || w.includes(l.von.toLowerCase()) || w.includes(l.name.toLowerCase());
const gewaehlt = plan.listen.filter((l) => (!nur.length || trifft(l, nur)) && !trifft(l, ohne));
/* Ein Name, der nichts trifft, wird gesagt — ein stiller Tippfehler sähe aus wie eine kleine Liste. */
for (const w of [...nur, ...ohne]) {
  if (!plan.listen.some((l) => trifft(l, [w]))) {
    console.error(`„${w}" trifft keine Klasse im Plan`);
    process.exitCode = 1;
  }
}

/** Gibt es diese Artikel auf dev? Acht Anfragen gleichzeitig. */
async function vorhanden(ids) {
  const da = new Set();
  const offen = [...ids];
  const arbeiter = async () => {
    for (let id = offen.pop(); id; id = offen.pop()) {
      const res = await fetch(`${BASE}/api/entities/${encodeURIComponent(id)}`, { headers: kopf() });
      if (res.status === 200) da.add(id);
      else if (res.status !== 404) throw new Error(`GET /api/entities/${id}: ${res.status}`);
      await res.arrayBuffer();
    }
  };
  await Promise.all(Array.from({ length: 8 }, arbeiter));
  return da;
}

let da;
if (args.includes('--check')) {
  const ids = new Set(gewaehlt.flatMap((l) => [l.von, ...l.zauber.map((z) => z.to)]));
  da = await vorhanden(ids);
  console.log(`Auf dev: ${da.size} von ${ids.size} Artikeln`);
}

const targets = {};
const zeilen = [];
let fehlt = 0;
for (const l of gewaehlt) {
  if (da && !da.has(l.von)) {
    zeilen.push(`${l.nummer}\t${l.name}\t— Klasse fehlt auf dev`);
    continue;
  }
  const ziele = l.zauber.filter((z) => !da || da.has(z.to));
  fehlt += l.zauber.length - ziele.length;
  if (!ziele.length) continue;
  targets[l.von] = ziele.map((z) => (z.optional ? { to: z.to, props: { optional: true } } : z.to));
  zeilen.push(`${l.nummer}\t${l.name}\t${ziele.length}${ziele.length < l.zauber.length ? ` (${l.zauber.length - ziele.length} fehlen auf dev)` : ''}`);
}
const ids = Object.keys(targets);
console.log(zeilen.join('\n'));
console.log(`${ids.length} Klassen und Unterklassen, ${Object.values(targets).reduce((n, t) => n + t.length, 0)} Kanten${fehlt ? `, ${fehlt} Ziele fehlen auf dev` : ''}`);
const out = wert('--out');
if (out && ids.length) {
  writeFileSync(
    resolve(out),
    `${JSON.stringify({ select: { ids }, ops: [{ op: 'addRelation', type: 'spellList', targets }] }, null, 1)}\n`,
  );
  console.log(`Auftrag: ${resolve(out)}`);
}

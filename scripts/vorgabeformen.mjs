#!/usr/bin/env node
/**
 * **Die Gruppen der Seite „Gegenstandsformen“ ins Untermodul laden**
 * (T-394 Schritt 5, E-127, E-165).
 *
 * Liest die Vorlage der Leitung — `items.json` und `gruppen-seed.json` der
 * Seite (Artifact-Dateien) und ihre Anpassungen (Sammlungen `gruppen` und
 * `artikel`, als JSON-Dateien je Dokument ausgelesen) — und schreibt Gruppen
 * und Werte je Gegenstand in die Karte `ShapeDefaults` einer Formebene auf
 * dev: `PUT /api/inventory/shapes` legt sie Feld für Feld über das, was
 * dort steht. Gerechnet wird wie auf der Seite (gleiche Regeln:
 * Anpassung › eigene Form › Referenz › Zufall nach Preis › Gruppe); keine
 * Gegenstandsartikel entstehen.
 *
 *   node scripts/vorgabeformen.mjs plan --vorlage <dir> --db <dir> [--out plan.json]
 *   node scripts/vorgabeformen.mjs apply --vorlage <dir> --db <dir> [--layer <id>] [--dry-run]
 *
 * Kein Inhalt der Vorlage kommt ins Repository: das Werkzeug liest nur,
 * was man ihm gibt. `ATLAS_URL` und `ATLAS_DEV_TOKEN` wie `scripts/atlas.mjs`.
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/* Nur, wenn es aufgerufen und nicht importiert wird (Tests importieren `ausVorlage`). */
const direkt = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (direkt && (process.env.HTTPS_PROXY || process.env.https_proxy) && !process.env.NODE_USE_ENV_PROXY) {
  const r = spawnSync(process.execPath, process.argv.slice(1), { stdio: 'inherit', env: { ...process.env, NODE_USE_ENV_PROXY: '1', NODE_NO_WARNINGS: '1' } });
  process.exit(r.status ?? 1);
}

const BASE = (process.env.ATLAS_URL || 'https://dev.ttrpg.fuchsbau.io').replace(/\/+$/, '');
const TOKEN = process.env.ATLAS_DEV_TOKEN || '';
const args = process.argv.slice(2);
const option = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
const cmd = args[0];

function stirb(t) {
  console.error(t);
  process.exit(1);
}

/** Die Dokumente einer ausgelesenen Sammlung: je Datei `<id>.json`, der Inhalt unter `data` oder direkt. */
function sammlung(dir) {
  if (!existsSync(dir)) return {};
  return Object.fromEntries(
    readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        const x = JSON.parse(readFileSync(join(dir, f), 'utf8'));
        return [f.replace(/\.json$/, ''), x.data ?? x];
      }),
  );
}

const zeilen = (s) => (s ? String(s).split('/').map((z) => z.trim()).filter(Boolean) : null);

/**
 * **Die Vorlage als ShapeDefaults** — Gruppen mit den Anpassungen der
 * Leitung, je Gegenstand Gruppe, Referenz, eigene Form und Stapel, genau
 * wie die Seite sie rechnet (`eff` in der Vorlage; geprüft: 2010 von 2010
 * gleich mit `effektiv.json`).
 */
export function ausVorlage(vorlage, db) {
  const items = JSON.parse(readFileSync(join(vorlage, 'items.json'), 'utf8'));
  const seed = JSON.parse(readFileSync(join(vorlage, 'gruppen-seed.json'), 'utf8'));
  const gAdj = sammlung(join(db, 'gruppen'));
  const adj = sammlung(join(db, 'artikel'));
  const shapeGroups = seed.map((g0) => {
    const g = { ...g0, ...(gAdj[g0.id] ?? {}) };
    return {
      id: g.id,
      name: g.name,
      section: g.bereich,
      rows: zeilen(g.form),
      ...(g.stapel != null ? { stackSize: g.stapel } : {}),
      carryable: g.tragbar !== false,
      ...(g.ref ? { ref: g.ref } : {}),
      ...(g.regel ? { rule: g.regel } : {}),
      ...(g.notiz ? { note: g.notiz } : {}),
      rank: g.rank,
      ...(g.formen ? { shapes: g.formen.map((f) => ({ rows: zeilen(f.form), weights: f.w ?? [] })), tiers: g.stufen ?? [] } : {}),
    };
  });
  const shapeItems = items.map((it) => {
    const a = adj[it.id] ?? {};
    const e = { id: it.id, group: a.gruppe || it.g };
    const ref = a.basis !== undefined ? a.basis : a.gruppe ? null : it.b;
    if (ref) e.ref = ref;
    if (a.form !== undefined) e.rows = a.form ? zeilen(a.form) : null;
    else if (it.o) e.rows = zeilen(it.o);
    const st = a.stapel ?? it.s;
    if (st != null) e.stackSize = st;
    return e;
  });
  return { shapeGroups, shapeItems };
}

async function api(pfad, body, method) {
  let res;
  try {
    res = await fetch(`${BASE}${pfad}`, {
      method: method ?? (body === undefined ? 'GET' : 'POST'),
      headers: { ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}), ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch (e) {
    stirb(`${BASE} nicht erreichbar (${e?.cause?.code || e?.message}).`);
  }
  const text = await res.text();
  if (!res.ok) stirb(`${method ?? 'GET'} ${pfad} → ${res.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

async function main() {
  if (!['plan', 'apply'].includes(cmd)) stirb('Aufruf: node scripts/vorgabeformen.mjs plan|apply --vorlage <dir> --db <dir> [--out plan.json] [--layer <id>] [--dry-run]');
  const vorlage = option('--vorlage');
  const db = option('--db');
  if (!vorlage || !db) stirb('--vorlage (items.json, gruppen-seed.json) und --db (Ordner mit gruppen/ und artikel/) fehlen.');
  const plan = ausVorlage(vorlage, db);
  const ohne = plan.shapeGroups.filter((g) => g.carryable === false).map((g) => g.id);
  console.log(`${plan.shapeGroups.length} Gruppen (${ohne.length} ohne Form: ${ohne.join(', ')}), ${plan.shapeItems.length} Gegenstände, davon ${plan.shapeItems.filter((e) => e.ref).length} mit Referenz und ${plan.shapeItems.filter((e) => e.rows).length} mit eigener Form.`);
  if (cmd === 'plan') {
    const out = option('--out');
    if (out) writeFileSync(out, JSON.stringify(plan, null, 1));
    return;
  }
  const layer = option('--layer');
  const dry = args.includes('--dry-run');
  const r = await api('/api/inventory/shapes', { ...plan, ...(layer ? { layer } : {}), dryRun: dry }, 'PUT');
  console.log(`${dry ? 'Probelauf' : 'Geschrieben'} in ${r.layer}: Gruppen +${r.groups.added} neu, ${r.groups.changed} geändert; Gegenstände +${r.items.added} neu, ${r.items.changed} geändert.`);
}

if (direkt) await main();

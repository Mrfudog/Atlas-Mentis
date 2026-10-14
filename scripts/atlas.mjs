#!/usr/bin/env node
/**
 * Die Werkbank von der Kommandozeile (W9) — für die Leitung und für
 * Claude-Sitzungen, die dev prüfen und in grossen Zügen ändern sollen.
 *
 *   node scripts/atlas.mjs me
 *   node scripts/atlas.mjs checks [schlüssel,…] [--limit 20|all] [--json]
 *   node scripts/atlas.mjs find <name> [--type Statblock]
 *   node scripts/atlas.mjs get <id|nummer|name>
 *   node scripts/atlas.mjs bulk --dry-run <datei.json>
 *   node scripts/atlas.mjs bulk <datei.json> [--confirm-delete N] [--skip-rejected]
 *   node scripts/atlas.mjs bulks
 *   node scripts/atlas.mjs undo <id> [--dry-run] [--force]
 *
 * Liest `ATLAS_URL` (Vorgabe https://dev.ttrpg.fuchsbau.io) und
 * `ATLAS_DEV_TOKEN` (ein API-Token, `atm_…` — Zugang.md › API-Tokens).
 * Fehlt das Token, geht die Anfrage ohne eigenen Authorization-Kopf hinaus:
 * in einer Cloud-Sitzung mit Network secret setzt ihn der Proxy (T-106),
 * und die Sitzung sieht das Token nie. Ohne
 * Abhängigkeiten: Node 22 und sonst nichts, damit es in jeder Sitzung
 * läuft, die das Repository hat.
 *
 * Eine Massenänderung steht in einer Datei, nicht in Argumenten: so ist,
 * was geprüft wurde (`--dry-run`), Zeichen für Zeichen das, was danach
 * geschrieben wird. Aufbau: docs/Betrieb.md › Werkzeugzugang.
 */

import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { URL, URLSearchParams } from 'node:url';

/* Hinter einem Proxy (Cloud-Sitzung) nimmt Nodes fetch `HTTPS_PROXY` nur
   mit `NODE_USE_ENV_PROXY=1`, und das muss beim Start gesetzt sein — also
   startet das Skript sich in dem Fall einmal neu. */
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
const flag = (name) => args.includes(name);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const positional = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && ['--limit', '--type', '--confirm-delete'].includes(args[i - 1])));
const [cmd, ...rest] = positional;

function stirb(text, code = 1) {
  console.error(text);
  process.exit(code);
}

async function api(pfad, body, method) {
  let res;
  try {
    res = await fetch(`${BASE}${pfad}`, {
      method: method ?? (body === undefined ? 'GET' : 'POST'),
      headers: {
        /* Ohne Token keinen Kopf: den setzt dann der Proxy (Network secret, T-106). */
        ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}),
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch (error) {
    const grund = error?.cause?.code || error?.cause?.message || error?.message;
    stirb(`${BASE} nicht erreichbar (${grund}). In einer Cloud-Sitzung: ist die Domain unter Netzwerk freigegeben?`);
  }
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { error: text.slice(0, 300) };
  }
  return { status: res.status, ok: res.ok, json };
}

const zeige = (x) => console.log(JSON.stringify(x, null, 2));
const pruefeAntwort = (r) => {
  if (r.ok) return r.json;
  if (flag('--json')) zeige(r.json);
  stirb(`${r.status}: ${r.json?.error ?? 'Fehler'}${r.status === 401 ? ` — ${grund401()}` : ''}`);
};

/** Wer bei 401 was prüfen soll — hängt daran, woher das Token kam. */
function grund401() {
  if (TOKEN) return 'ATLAS_DEV_TOKEN ungültig, abgelaufen oder widerrufen.';
  const host = new URL(BASE).host;
  return `kein ATLAS_DEV_TOKEN gesetzt, und das Network secret für ${host} fehlt oder ist abgelaufen (docs/Betrieb.md › Werkzeugzugang).`;
}

/** Eine Massenänderung lesbar: Zahl, Beispiele, Ablehnungen. */
function bericht(r) {
  console.log(
    `${r.dryRun ? 'Vorschau' : 'Geschrieben'}: ${r.selected} ausgewählt · ${r.changed} geändert · ${r.deleted} gelöscht` +
      ` · ${r.rejectedCount} abgelehnt · ${r.skippedCount} ausgelassen${r.ms ? ` · ${r.ms} ms` : ''}`,
  );
  for (const e of r.examples ?? []) console.log(`  ${e.change.padEnd(6)} ${e.name} (${e.type}, ${e.id}): ${e.summary.join('; ')}`);
  if ((r.examples?.length ?? 0) < r.changed + r.deleted) console.log(`  … und ${r.changed + r.deleted - r.examples.length} weitere`);
  for (const a of r.rejected ?? []) console.log(`  ABGELEHNT ${a.name} (${a.type}, ${a.id}): ${a.issues.join('; ')}`);
  for (const s of r.skipped ?? []) console.log(`  ausgelassen ${s.name} (${s.id}): ${s.reason}`);
  if (r.id) console.log(`\nId ${r.id} — zurück mit: node scripts/atlas.mjs undo ${r.id}`);
}

switch (cmd) {
  case 'me': {
    zeige(pruefeAntwort(await api('/api/me')));
    break;
  }
  case 'checks': {
    const q = new URLSearchParams();
    if (rest[0]) q.set('check', rest[0]);
    q.set('limit', option('--limit') ?? (rest[0] ? '50' : '0'));
    const r = pruefeAntwort(await api(`/api/checks?${q}`));
    if (flag('--json')) {
      zeige(r);
      break;
    }
    console.log(`${r.total} Artikel geprüft in ${r.ms} ms\n`);
    for (const c of r.checks) {
      console.log(`${String(c.count).padStart(6)}  ${c.label}  [${c.key}]`);
      for (const h of c.hits) {
        console.log(`        ${h.name} (${h.type}, ${h.id}) — ${h.reason}${h.group ? `\n          Gruppe: ${h.group.slice(0, 12).join(' ')}${h.group.length > 12 ? ` … (+${h.group.length - 12})` : ''}` : ''}`);
      }
    }
    if (!rest[0]) console.log('\nTreffer einer Prüfung: node scripts/atlas.mjs checks <schlüssel> --limit 20');
    break;
  }
  case 'find': {
    const nadel = rest.join(' ').toLowerCase();
    if (!nadel) stirb('find <name> [--type Art]', 2);
    const typ = option('--type');
    const alle = pruefeAntwort(await api('/api/entities?as=summary'));
    const treffer = alle.filter(
      (e) =>
        (!typ || e.interfaces?.[0] === typ) &&
        String(e.components?.Identity?.name ?? e.name ?? '').toLowerCase().includes(nadel),
    );
    for (const e of treffer.slice(0, Number(option('--limit') ?? 50))) {
      console.log(`${e.id}  ${e.components?.Identity?.id ?? ''}  ${e.interfaces?.[0]}  ${e.components?.Identity?.name ?? e.name}`);
    }
    console.log(`${treffer.length} Treffer`);
    break;
  }
  case 'get': {
    const was = rest.join(' ');
    if (!was) stirb('get <id|nummer|name>', 2);
    let r = await api(`/api/entities/${encodeURIComponent(was)}`);
    if (r.status === 404) {
      /* Eine Nummer (`statblock-0042`) oder ein Name: über die Kurzfassung. */
      const alle = pruefeAntwort(await api('/api/entities?as=summary'));
      const k = was.toLowerCase();
      const passt = alle.filter(
        (e) => String(e.components?.Identity?.id ?? '').toLowerCase() === k || String(e.components?.Identity?.name ?? '').toLowerCase() === k,
      );
      if (passt.length > 1) stirb(`Mehrdeutig: ${passt.map((e) => `${e.id} (${e.interfaces?.[0]})`).join(', ')}`);
      if (passt.length === 1) r = await api(`/api/entities/${encodeURIComponent(passt[0].id)}`);
    }
    zeige(pruefeAntwort(r));
    break;
  }
  case 'bulk': {
    const datei = rest[0];
    if (!datei) stirb('bulk [--dry-run] <datei.json>', 2);
    let auftrag;
    try {
      auftrag = JSON.parse(await readFile(datei, 'utf8'));
    } catch (error) {
      stirb(`${datei}: ${error.message}`, 2);
    }
    if (flag('--dry-run')) auftrag.dryRun = true;
    else delete auftrag.dryRun;
    if (option('--confirm-delete')) auftrag.confirmDelete = Number(option('--confirm-delete'));
    if (flag('--skip-rejected')) auftrag.skipRejected = true;
    if (option('--limit')) auftrag.limit = Number(option('--limit'));
    const r = await api('/api/bulk', auftrag);
    if (flag('--json')) zeige(r.json);
    else if (r.json && 'selected' in r.json) bericht(r.json);
    if (!r.ok) stirb(`${r.status}: ${r.json?.error ?? 'Fehler'}`);
    break;
  }
  case 'bulks': {
    const liste = pruefeAntwort(await api(`/api/bulk?limit=${option('--limit') ?? 20}`));
    for (const b of liste) {
      console.log(`${b.id}  ${b.at.slice(0, 16)}  ${b.by?.name ?? '?'}${b.token ? ` (${b.token})` : ''}  ${b.changed} geändert, ${b.deleted} gelöscht${b.undone ? '  [zurückgenommen]' : ''}`);
      for (const z of b.summary ?? []) console.log(`    ${z}`);
    }
    break;
  }
  case 'undo': {
    const id = rest[0];
    if (!id) stirb('undo <id> [--dry-run] [--force]', 2);
    const r = await api(`/api/bulk/${encodeURIComponent(id)}/undo`, { dryRun: flag('--dry-run'), force: flag('--force') });
    if (!r.ok) {
      for (const k of r.json?.conflicts ?? []) console.log(`  Konflikt ${k.name} (${k.id}): ${k.reason}`);
      for (const a of r.json?.rejected ?? []) console.log(`  ABGELEHNT ${a.name} (${a.id}): ${a.issues.join('; ')}`);
      stirb(`${r.status}: ${r.json?.error ?? 'Fehler'}`);
    }
    console.log(`${r.json.dryRun ? 'Vorschau: ' : ''}${r.json.restored} Artikel zurückgesetzt${r.json.conflicts.length ? `, ${r.json.conflicts.length} Konflikt(e) überschrieben` : ''}.`);
    break;
  }
  default:
    console.log(`Atlas Mentis Werkbank — ${BASE}

  me                                   wer bin ich, welches Token
  checks [schlüssel,…] [--limit N|all] Prüfungen; ohne Schlüssel nur die Zahlen
  find <name> [--type Art]             Artikel nach Namen suchen
  get <id|nummer|name>                 einen Artikel ganz
  bulk --dry-run <datei.json>          Massenänderung ansehen
  bulk <datei.json> [--confirm-delete N] [--skip-rejected]
  bulks                                die letzten Massenänderungen
  undo <id> [--dry-run] [--force]      eine zurücknehmen

ATLAS_URL und ATLAS_DEV_TOKEN (oder ein Network secret am Proxy) — docs/Betrieb.md › Werkzeugzugang.`);
    if (cmd && cmd !== 'help') process.exit(2);
}

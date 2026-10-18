#!/usr/bin/env node
/**
 * **Glossarbegriffe zu den Regeln anlegen** (T-270): je Spielbegriff, auf
 * dem eine Regel aufbaut (Reach, Spell slot, Hit points …), ein Artikel
 * `GlossaryTerm` — **in der Ebene seiner Quelle**: der Ebene des Artikels,
 * den er erklärt (`explains`), also im Buch oder in den Hausregeln.
 *
 *   node scripts/glossar-anlegen.mjs <plan.json> [--dry-run] [--state <datei>]
 *
 * **Der Plan liegt ausserhalb des Repositorys** — die Texte sind eigene
 * kurze Sätze, stehen aber nur auf der Installation (wie T-242). Aufbau:
 *
 *   {
 *     "terms": [
 *       { "name": "Reach", "sort": "rule", "aliases": ["…"],
 *         "definition": "…", "effect": "…", "example": "…", "de": "Reichweite",
 *         "autolink": true, "explains": ["<artikel-id>", …], "layer": "<optional>" }
 *     ],
 *     "move": ["<begriff-id>", { "id": "<begriff-id>", "layer": "<ebene>" }, …]
 *   }
 *
 * - Die Ebene ist die des ersten `explains`-Ziels, ausser der Plan nennt
 *   eine; eine Gruppe ist keine Quelle, dort bricht der Lauf ab.
 *   `Source.publication` ist der Name dieser Ebene.
 * - `move`: bestehende Begriffe ziehen in die Ebene ihres ersten Ziels um
 *   (sonst bleibt alles an ihnen).
 * - Einen Begriff, den es unter dem Namen schon gibt, legt der Lauf nicht
 *   noch einmal an.
 * - Eigenes in einer Buchebene übersteht ein Neuladen der Ebene
 *   (`--replace-layer` löscht nur Ids mit dem Präfix der Datei).
 *
 * Ausgegeben werden Namen, Ids und Zahlen. Wie `scripts/atlas.mjs`:
 * `ATLAS_URL`, `ATLAS_DEV_TOKEN` oder das Network secret der Sitzung.
 */

import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

if ((process.env.HTTPS_PROXY || process.env.https_proxy) && !process.env.NODE_USE_ENV_PROXY) {
  const r = spawnSync(process.execPath, process.argv.slice(1), {
    stdio: 'inherit',
    env: { ...process.env, NODE_USE_ENV_PROXY: '1', NODE_NO_WARNINGS: '1' },
  });
  process.exit(r.status ?? 1);
}

const REPO = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const BASE = (process.env.ATLAS_URL || 'https://dev.ttrpg.fuchsbau.io').replace(/\/+$/, '');
const TOKEN = process.env.ATLAS_DEV_TOKEN || '';
const args = process.argv.slice(2);
const option = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};
const datei = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1] === '--state'));
const trocken = args.includes('--dry-run');

function stirb(text, code = 1) {
  console.error(text);
  process.exit(code);
}
if (!datei) stirb('node scripts/glossar-anlegen.mjs <plan.json> [--dry-run] [--state <datei>]', 2);
if (/prod/i.test(new URL(BASE).hostname) && !/dev/i.test(new URL(BASE).hostname)) stirb(`Nur dev: ${BASE}`);
const pfad = realpathSync(resolve(datei));
if (pfad.startsWith(REPO + sep)) stirb('Der Plan liegt im Repository. Er gehört ausserhalb — die Texte stehen nur auf der Installation.');
const zustandPfad = resolve(option('--state') ?? `${pfad}.state.json`);
if (zustandPfad.startsWith(REPO + sep)) stirb('Die Zustandsdatei gehört ebenfalls ausserhalb des Repositorys.');

const warte = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(p, body, method) {
  let res;
  for (let versuch = 0; ; versuch += 1) {
    try {
      res = await fetch(`${BASE}${p}`, {
        method: method ?? (body === undefined ? 'GET' : 'POST'),
        headers: {
          ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}),
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch (error) {
      if (versuch >= 6) throw error;
      await warte(Math.min(30_000, 2_000 * 2 ** versuch));
      continue;
    }
    if ((res.status === 502 || res.status === 503) && versuch < 6) {
      await warte(Math.min(30_000, 2_000 * 2 ** versuch));
      continue;
    }
    break;
  }
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { error: text.slice(0, 200) };
  }
  return { status: res.status, json };
}
function ok(r, was) {
  if (r.status >= 200 && r.status < 300) return r.json;
  const issues = Array.isArray(r.json?.issues) ? ` ${JSON.stringify(r.json.issues).slice(0, 600)}` : '';
  stirb(`${was}: HTTP ${r.status} ${r.json?.error ?? ''}${issues}`);
}

const plan = JSON.parse(readFileSync(pfad, 'utf8'));
const zustand = existsSync(zustandPfad) ? JSON.parse(readFileSync(zustandPfad, 'utf8')) : { ids: {}, moved: [] };
const sichere = () => {
  if (!trocken) writeFileSync(zustandPfad, JSON.stringify(zustand, null, 2));
};

const artikel = new Map();
async function hole(id) {
  if (!artikel.has(id)) artikel.set(id, ok(await api(`/api/entities/${encodeURIComponent(id)}`), `Artikel ${id}`));
  return artikel.get(id);
}
const ebeneVon = (e) => (e.relations ?? []).find((r) => r.type === 'inLayer')?.to;

/** Die Quelle eines Begriffs: die Ebene seines ersten Ziels — nie eine Gruppe. */
async function quelle(ziele, genannt) {
  const id = genannt ?? (ziele.length ? ebeneVon(await hole(ziele[0])) : undefined);
  if (!id) return null;
  const l = await hole(id);
  return { id, name: l.components?.Identity?.name ?? id, gruppe: l.components?.Layer?.kind === 'group' };
}

const relId = () => `rel_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
const glossar = ok(await api('/api/glossary'), 'Glossar').terms ?? [];
const schon = new Map(glossar.filter((t) => !String(t.id).startsWith('app:')).map((t) => [t.term.toLowerCase(), t.id]));

const zahl = { angelegt: 0, schon: 0, umgezogen: 0 };
for (const t of plan.terms ?? []) {
  const k = t.name.toLowerCase();
  if (zustand.ids[k] || schon.has(k)) {
    zahl.schon += 1;
    continue;
  }
  const ziele = t.explains ?? [];
  const q = await quelle(ziele, t.layer);
  if (!q) stirb(`${t.name}: keine Quelle — weder explains noch layer.`);
  if (q.gruppe) stirb(`${t.name}: ${q.name} ist eine Gruppe — ein Begriff gehört in die Ebene seiner Quelle.`);
  const fields = {
    'Description.description': t.definition,
    'GlossaryTerm.sort': t.sort ?? 'rule',
    ...(t.effect ? { 'GlossaryTerm.effect': t.effect } : {}),
    ...(t.example ? { 'GlossaryTerm.example': [{ id: 'e1', value: t.example }] } : {}),
    ...(t.de ? { 'GlossaryTerm.translations': [{ id: 'de', lang: 'de', term: t.de }] } : {}),
    ...(t.aliases?.length ? { 'Identity.aliases': t.aliases } : {}),
    'Rule.autolink': t.autolink !== false,
    'Source.publication': q.name,
    'Status.status': 'ready',
  };
  const relations = [{ type: 'inLayer', to: q.id }, ...ziele.map((to) => ({ type: 'explains', to }))];
  console.log(`anlegen „${t.name}" in ${q.name} (${q.id}), erklärt ${ziele.length}`);
  if (!trocken) {
    const neu = ok(await api('/api/entities', { type: 'GlossaryTerm', name: t.name, fields, relations }), `Anlegen ${t.name}`);
    zustand.ids[k] = neu.id;
    sichere();
  }
  zahl.angelegt += 1;
}

for (const eintrag of plan.move ?? []) {
  /* Ein Eintrag ist eine Id oder `{ id, layer }`, wenn das erste Ziel nicht die Quelle ist. */
  const id = typeof eintrag === 'string' ? eintrag : eintrag.id;
  if (zustand.moved.includes(id)) continue;
  const { refs: _r, fromTemplate: _t, ...e } = await hole(id);
  const ziele = (e.relations ?? []).filter((r) => r.type === 'explains').map((r) => r.to);
  const q = await quelle(ziele, typeof eintrag === 'string' ? undefined : eintrag.layer);
  if (!q || ebeneVon(e) === q.id) continue;
  if (q.gruppe) {
    console.log(`bleibt ${id}: das Ziel liegt in einer Gruppe (${q.name})`);
    continue;
  }
  const relations = [...(e.relations ?? []).filter((r) => r.type !== 'inLayer'), { id: relId(), type: 'inLayer', to: q.id, props: {} }];
  const components = { ...e.components, Source: { ...(e.components?.Source ?? {}), publication: q.name } };
  console.log(`umziehen ${id} (${e.components?.Identity?.name}) → ${q.name} (${q.id})`);
  if (!trocken) {
    ok(await api(`/api/entities/${encodeURIComponent(id)}`, { ...e, components, relations }, 'PUT'), `Umziehen ${id}`);
    zustand.moved.push(id);
    sichere();
  }
  zahl.umgezogen += 1;
}
console.log(`${trocken ? 'Probe: ' : ''}${zahl.angelegt} angelegt, ${zahl.umgezogen} umgezogen, ${zahl.schon} schon da.`);

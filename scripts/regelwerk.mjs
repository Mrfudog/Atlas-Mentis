#!/usr/bin/env node
/**
 * **Ein Regelwerk einlesen** (T-122): eine Paketdatei (Aufbau in
 * `scripts/regelwerk/plan.mjs`) als eigene Ebene mit ihren Artikeln über
 * die API nach dev — nie nach prod.
 *
 *   node scripts/regelwerk.mjs <paket.json> --dry-run
 *   node scripts/regelwerk.mjs <paket.json> [--state <datei>]
 *
 * Die Paketdatei liegt **ausserhalb des Repositorys**: ein Buch eines
 * fremden Verlags gehört nicht in ein öffentliches Repo, und der Lauf
 * weigert sich, eine Datei darin zu lesen. Daneben schreibt er seinen
 * Zustand (`<paket>.state.json`): welche Server-Id zu welchem Schlüssel
 * gehört, mit Revision. Er ist das Gedächtnis des Laufs — eine Ebene, die
 * keine Kampagne aufschaltet, ist auch für die Verwaltung nicht zu lesen
 * (`inPlay`), also kann ein zweiter Lauf seine Artikel nicht am Server
 * suchen. Mit Zustand legt er nichts doppelt an und schreibt nur, was
 * sich geändert hat.
 *
 * Ebene: angelegt über `POST /api/layers` (das Konto besitzt sie), Art und
 * Angaben aus `layer`, Herausgeber-Gruppe nach Namen (fehlt sie, legt er
 * sie an). **Aufgeschaltet wird nichts** — das tut die Leitung. Artikel:
 * `POST /api/entities` in die Ebene, danach die Kanten in einem zweiten
 * Gang, wenn alle Ids feststehen. Ausgegeben werden Schlüssel, Arten und
 * Zahlen, nie Text aus dem Paket — die Ausgabe darf ins Protokoll.
 *
 * Wie `scripts/atlas.mjs`: `ATLAS_URL`, `ATLAS_DEV_TOKEN` oder das
 * Network secret der Cloud-Sitzung (Betrieb.md › Werkzeugzugang).
 */

import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath, URL, URLSearchParams } from 'node:url';
import { check, components, externalTargets, relations, typeChain } from './regelwerk/plan.mjs';

if ((process.env.HTTPS_PROXY || process.env.https_proxy) && !process.env.NODE_USE_ENV_PROXY) {
  const r = spawnSync(process.execPath, process.argv.slice(1), {
    stdio: 'inherit',
    env: { ...process.env, NODE_USE_ENV_PROXY: '1', NODE_NO_WARNINGS: '1' },
  });
  process.exit(r.status ?? 1);
}

const BASE = (process.env.ATLAS_URL || 'https://dev.ttrpg.fuchsbau.io').replace(/\/+$/, '');
const TOKEN = process.env.ATLAS_DEV_TOKEN || '';
const REPO = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '..'));

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const option = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};
const datei = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1] === '--state'));

function stirb(text, code = 1) {
  console.error(text);
  process.exit(code);
}

if (!datei) stirb('node scripts/regelwerk.mjs <paket.json> [--dry-run] [--state <datei>]', 2);
if (/prod/i.test(new URL(BASE).hostname) && !/dev/i.test(new URL(BASE).hostname)) stirb(`Nur dev: ${BASE}`);
const pfad = realpathSync(resolve(datei));
if (pfad === REPO || pfad.startsWith(REPO + sep)) {
  stirb('Die Paketdatei liegt im Repository. Sie gehört ausserhalb — der Inhalt eines Buchs kommt nicht ins Repo.');
}
const zustandPfad = resolve(option('--state') ?? `${pfad}.state.json`);
if (zustandPfad.startsWith(REPO + sep)) stirb('Die Zustandsdatei gehört ebenfalls ausserhalb des Repositorys.');

async function api(p, body, method) {
  const res = await fetch(`${BASE}${p}`, {
    method: method ?? (body === undefined ? 'GET' : 'POST'),
    headers: {
      ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
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

const paket = JSON.parse(readFileSync(pfad, 'utf8'));
const registry = ok(await api('/api/registry'), 'Register');
const { fehler, hinweise, zaehlung, artikel } = check(paket, registry);
console.log(`Paket: ${artikel.length} Artikel — ${Object.entries(zaehlung).map(([t, n]) => `${t} ${n}`).join(', ')}`);
for (const h of hinweise) console.log(`Hinweis: ${h}`);
if (fehler.length) stirb(`${fehler.length} Fehler:\n  ${fehler.slice(0, 50).join('\n  ')}`);

/* Ziele beim Namen: was der Server unter diesem Namen und dieser Art
   kennt, im Stapel — ein Werkzeug aus dem Grundregelwerk. Mehrdeutig oder
   fehlend wird gesagt, nicht geraten (M11). */
const fremd = new Map();
const unklar = [];
for (const z of externalTargets(artikel)) {
  const q = new URLSearchParams({ q: z.name, limit: '50', ...(z.type ? { of: z.type } : {}) });
  const liste = ok(await api(`/api/list?${q}`), `Suche ${z.type ?? ''}`);
  const treffer = (liste.rows ?? []).filter((r) => String(r.name ?? '').toLowerCase() === z.name.toLowerCase());
  if (treffer.length === 1) fremd.set(`${z.name}|${z.type ?? ''}`.toLowerCase(), treffer[0].id);
  else unklar.push(`${z.type ?? '*'} „${z.name}": ${treffer.length} Treffer`);
}
if (unklar.length) console.log(`Nicht aufgelöst (die Kante bleibt weg):\n  ${unklar.join('\n  ')}`);

const zustand = existsSync(zustandPfad) ? JSON.parse(readFileSync(zustandPfad, 'utf8')) : { layer: null, articles: {} };
const neu = artikel.filter((a) => !zustand.articles[a.key]).length;
console.log(`Zustand: ${Object.keys(zustand.articles).length} bekannt, ${neu} neu anzulegen.`);
if (flag('--dry-run')) {
  console.log('Probelauf: nichts geschrieben.');
  process.exit(0);
}
const sichere = () => writeFileSync(zustandPfad, JSON.stringify(zustand, null, 2));

/* ---- die Ebene und ihre Herausgeber-Gruppe ---- */
async function ebene(name, karte, vorhandeneId) {
  let id = vorhandeneId;
  if (!id) id = ok(await api('/api/layers', { name }), `Ebene „${name}" anlegen`).id;
  const e = ok(await api(`/api/entities/${id}`), 'Ebene lesen');
  const layerKarte = { ...(e.components?.Layer ?? {}), ...karte };
  if (JSON.stringify(layerKarte) !== JSON.stringify(e.components?.Layer ?? {})) {
    const { refs: _refs, ...roh } = e;
    ok(await api(`/api/entities/${id}`, { ...roh, components: { ...roh.components, Layer: layerKarte } }, 'PUT'), 'Ebene schreiben');
  }
  return id;
}
const L = paket.layer;
const angaben = Object.fromEntries(
  ['kind', 'order', 'abbreviation', 'published', 'author', 'version'].filter((k) => L[k] !== undefined).map((k) => [k, L[k]]),
);
const layerId = await ebene(L.name, { kind: 'book', order: 20, ...angaben }, zustand.layer);
zustand.layer = layerId;
sichere();
console.log(`Ebene: ${layerId}`);

if (L.publisher) {
  const info = ok(await api(`/api/layers/${layerId}/publisher`), 'Herausgeber lesen');
  let gruppe = (info.options ?? []).find((o) => o.name.toLowerCase() === String(L.publisher).toLowerCase())?.id;
  if (!gruppe) {
    gruppe = await ebene(L.publisher, { kind: 'group', groupBy: 'publisher' });
    console.log(`Herausgeber-Gruppe angelegt: ${gruppe}`);
  }
  if (!(info.groups ?? []).includes(gruppe)) ok(await api(`/api/layers/${layerId}/publisher`, { groups: [gruppe] }, 'PUT'), 'Herausgeber setzen');
}

/* ---- erster Gang: anlegen, was fehlt ---- */
const ids = new Map(Object.entries(zustand.articles).map(([k, v]) => [k, v.id]));
const mitStand = (a) =>
  typeChain(registry, a.type).includes('Status') && a.fields?.['Status.status'] === undefined
    ? { ...a, fields: { ...a.fields, 'Status.status': L.status ?? 'ready' } }
    : a;
let angelegt = 0;
for (const a0 of artikel) {
  if (ids.has(a0.key)) continue;
  const a = mitStand(a0);
  const r = ok(
    await api('/api/entities', { type: a.type, name: a.name, fields: a.fields, relations: [{ type: 'inLayer', to: layerId }] }),
    `${a.key} (${a.type}) anlegen`,
  );
  ids.set(a.key, r.id);
  zustand.articles[a.key] = { id: r.id, revision: r.revision ?? null, entity: r };
  angelegt += 1;
  if (angelegt % 25 === 0) {
    sichere();
    console.log(`  … ${angelegt} angelegt`);
  }
}
sichere();
console.log(`Angelegt: ${angelegt}`);

/* ---- zweiter Gang: Felder und Kanten, wo sie vom Gespeicherten abweichen ---- */
let geschrieben = 0;
let offen = 0;
for (const a0 of artikel) {
  const a = mitStand(a0);
  const s = zustand.articles[a.key];
  const vorher = s.entity;
  const { relations: kanten, offen: fehlt } = relations(a, { ids, fremd, layerId, vorher: vorher.relations ?? [] });
  offen += fehlt.length;
  const zaehler = {};
  const mitIds = kanten.map((k) => {
    if (k.id) return k;
    zaehler[k.type] = (zaehler[k.type] ?? 0) + 1;
    let id = `${s.id}~${k.type}-${zaehler[k.type]}`;
    while (kanten.some((x) => x.id === id) || (vorher.relations ?? []).some((x) => x.id === id)) {
      zaehler[k.type] += 1;
      id = `${s.id}~${k.type}-${zaehler[k.type]}`;
    }
    return { ...k, id };
  });
  const entity = {
    id: s.id,
    interfaces: [a.type],
    name: a.name,
    components: components(registry, a, vorher.components),
    relations: mitIds,
    revision: s.revision,
  };
  const gleich =
    JSON.stringify(entity.components) === JSON.stringify(vorher.components) &&
    JSON.stringify(entity.relations) === JSON.stringify((vorher.relations ?? []).map((r) => ({ type: r.type, to: r.to, props: r.props ?? {}, id: r.id })));
  if (gleich) continue;
  const r = await api(`/api/entities/${s.id}`, entity, 'PUT');
  if (r.status === 409) {
    console.log(`  ${a.key}: am Server geändert (Revision) — übersprungen`);
    continue;
  }
  const gespeichert = ok(r, `${a.key} (${a.type}) schreiben`);
  zustand.articles[a.key] = { id: s.id, revision: gespeichert.revision ?? null, entity: gespeichert };
  geschrieben += 1;
}
sichere();
console.log(`Geschrieben: ${geschrieben}; Kanten ohne Ziel: ${offen}. Aufgeschaltet: keine — das tut die Leitung.`);

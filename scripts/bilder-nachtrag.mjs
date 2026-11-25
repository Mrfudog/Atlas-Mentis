#!/usr/bin/env node
/**
 * **Bilder nachtragen** (T-201) — für den Bestand, was neue Bilder beim
 * Hochladen ohnehin bekommen:
 *
 *   node scripts/bilder-nachtrag.mjs            Vorschau: was fehlt, was angelegt würde
 *   node scripts/bilder-nachtrag.mjs --write    schreibt es
 *
 * 1. **Masse**: ein Asset ohne Breite, Höhe, Medientyp oder Grösse bekommt
 *    sie aus dem Kopf seiner Datei (`imageHeader`, PNG/JPEG/WebP/GIF). Ein
 *    Bild der Ablage wird ganz geholt (dann stimmt auch die Grösse), eine
 *    Adresse (`backend: 'external'`) nur ihre ersten 64 KB — die Grösse
 *    nennt dann der Server, oder sie bleibt leer.
 * 2. **Adressen**: ein Bildfeld, in dem statt einer Asset-Id eine Adresse
 *    steht (Prüfung `imageAddress`, heute die Karten der Abenteuer aus
 *    5e.tools), bekommt ein Asset `backend: 'external'` **in der Ebene des
 *    Artikels**, der es zeigt; das Feld nennt danach das Asset. Dieselbe
 *    Adresse zweimal wird ein Asset. Die Datei bleibt, wo sie ist — das
 *    Einlesen selbst ist T-144.
 *
 * Geschrieben wird über die API, mit den Regeln jedes Schreibens
 * (`PUT /api/entities/:id` gegen die gelesene Revision, `POST
 * /api/entities`). Liest `ATLAS_URL` und `ATLAS_DEV_TOKEN` wie
 * `scripts/atlas.mjs`; braucht das gebaute Modellpaket
 * (`pnpm --filter @nw/model build`). Protokoll eines Laufs:
 * docs/Nachtarbeit/2026-10-15-T-201.md.
 */

import { spawnSync } from 'node:child_process';

if ((process.env.HTTPS_PROXY || process.env.https_proxy) && !process.env.NODE_USE_ENV_PROXY) {
  const r = spawnSync(process.execPath, process.argv.slice(1), {
    stdio: 'inherit',
    env: { ...process.env, NODE_USE_ENV_PROXY: '1', NODE_NO_WARNINGS: '1' },
  });
  process.exit(r.status ?? 1);
}

const { imageHeader } = await import('../packages/model/dist/index.js');

const BASE = (process.env.ATLAS_URL || 'https://dev.ttrpg.fuchsbau.io').replace(/\/+$/, '');
const TOKEN = process.env.ATLAS_DEV_TOKEN || '';
const SCHREIBEN = process.argv.includes('--write');
const kopf = (extra = {}) => ({ ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}), ...extra });

async function api(pfad, body, method) {
  const res = await fetch(`${BASE}${pfad}`, {
    method: method ?? (body === undefined ? 'GET' : 'POST'),
    headers: kopf(body === undefined ? {} : { 'content-type': 'application/json' }),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { error: text.slice(0, 300) };
  }
  if (!res.ok) throw new Error(`${method ?? (body === undefined ? 'GET' : 'POST')} ${pfad}: ${res.status} ${json?.error ?? ''}`);
  return json;
}

/** Die ersten Bytes einer Datei — der Ablage (ganz) oder einer Adresse (64 KB). */
async function hole(url, ganz) {
  const res = await fetch(url, { headers: kopf(ganz ? {} : { range: 'bytes=0-65535' }), redirect: 'follow' });
  if (!res.ok && res.status !== 206) throw new Error(`${url}: ${res.status}`);
  const daten = new Uint8Array(await res.arrayBuffer());
  const gesamt = Number((res.headers.get('content-range') ?? '').split('/')[1]) || (res.status === 200 ? daten.length : 0);
  return { daten, bytes: gesamt || undefined };
}

const ohneRefs = (e) => {
  const { refs: _r, ...rest } = e;
  return rest;
};

const bericht = { masse: [], adressen: [], fehler: [], ganz: [] };

/* ---- 2. Adressen zuerst: was hier entsteht, bekommt in 1. seine Masse. */
const pruefung = await api('/api/checks?check=imageAddress&limit=all');
const treffer = pruefung.checks?.[0]?.hits ?? [];
const angelegt = new Map(); // Adresse → Asset-Id
for (const h of treffer) {
  const e = await api(`/api/entities/${encodeURIComponent(h.id)}`);
  const ebenen = (e.relations ?? []).filter((r) => r.type === 'inLayer').map((r) => ({ type: 'inLayer', to: r.to }));
  const neu = JSON.parse(JSON.stringify(e.components ?? {}));
  let geaendert = false;
  for (const teil of h.reason.split(/, (?=[A-Za-z]+\.[A-Za-z]+: )/)) {
    const m = /^([A-Za-z]+)\.([A-Za-z]+): (.+)$/.exec(teil);
    if (!m) continue;
    const [, karte, feld, url] = m;
    if (neu?.[karte]?.[feld] !== url) continue;
    let asset = angelegt.get(url);
    const name = (e.components?.Image?.caption || e.name || h.name || 'Image').split(' · ')[0];
    if (!asset) {
      const fields = {
        'Asset.backend': 'external',
        'Asset.ref': url,
        'Asset.kind': h.type === 'Map' ? 'map' : karte === 'Statblock' && feld === 'token' ? 'token' : 'image',
        ...(e.components?.Image?.alt ? { 'Image.alt': e.components.Image.alt } : {}),
      };
      if (SCHREIBEN) {
        const a = await api('/api/entities', { type: 'Asset', name, fields, relations: ebenen });
        asset = a.id;
      } else asset = `(neu: ${name})`;
      angelegt.set(url, asset);
    }
    neu[karte][feld] = asset;
    geaendert = true;
    bericht.adressen.push({ id: e.id, name: h.name, feld: `${karte}.${feld}`, url, asset });
  }
  if (geaendert && SCHREIBEN) await api(`/api/entities/${encodeURIComponent(e.id)}`, { ...ohneRefs(e), components: neu }, 'PUT');
}

/* ---- 1. Masse der Assets. */
const assets = [];
for (let offset = 0; ; offset += 500) {
  const r = await api(`/api/list?type=Asset&allLayers=1&limit=500&offset=${offset}`);
  assets.push(...r.rows);
  if (assets.length >= r.total || !r.rows.length) break;
}
for (const z of assets) {
  const m = z.asset ?? {};
  if (m.width && m.height && m.mime && (m.bytes || m.backend === 'external')) continue;
  try {
    const e = await api(`/api/entities/${encodeURIComponent(z.id)}`);
    const info = e.components?.Asset ?? {};
    const extern = info.backend === 'external';
    const { daten, bytes } = await hole(extern ? info.ref : `${BASE}/api/assets/${encodeURIComponent(z.id)}`, !extern);
    const k = imageHeader(daten);
    const setzen = {
      ...(k && !info.width ? { width: k.width } : {}),
      ...(k && !info.height ? { height: k.height } : {}),
      ...(k && !info.mime ? { mime: k.mime } : {}),
      ...(bytes && !info.bytes ? { bytes } : {}),
    };
    if (!Object.keys(setzen).length) {
      /* Der Kopf bestätigt, was dasteht — oder sagt nichts. */
      if (k) bericht.ganz.push({ id: z.id, name: z.name, kopf: `${k.width}×${k.height} ${k.mime}`, steht: `${info.width}×${info.height} ${info.mime}` });
      else bericht.fehler.push({ id: z.id, name: z.name, grund: 'Kopf nicht lesbar' });
      continue;
    }
    bericht.masse.push({ id: z.id, name: z.name, ...setzen });
    if (SCHREIBEN) {
      await api(`/api/entities/${encodeURIComponent(z.id)}`, { ...ohneRefs(e), components: { ...e.components, Asset: { ...info, ...setzen } } }, 'PUT');
    }
  } catch (error) {
    bericht.fehler.push({ id: z.id, name: z.name, grund: String(error.message ?? error) });
  }
}

console.log(`${SCHREIBEN ? 'Geschrieben' : 'Vorschau'} gegen ${BASE}`);
console.log(`Assets geprüft: ${assets.length}`);
console.log(`Schon vollständig: ${bericht.ganz.length}`);
for (const g of bericht.ganz) console.log(`  ${g.name} (${g.id}): Kopf ${g.kopf}, steht ${g.steht}`);
console.log(`Bildfelder mit Adresse: ${bericht.adressen.length} (Assets ${SCHREIBEN ? 'angelegt' : 'anzulegen'}: ${angelegt.size})`);
for (const a of bericht.adressen) console.log(`  ${a.name} (${a.id}) ${a.feld}: ${a.url} → ${a.asset}`);
console.log(`Masse ${SCHREIBEN ? 'nachgetragen' : 'nachzutragen'}: ${bericht.masse.length}`);
for (const m of bericht.masse) console.log(`  ${m.name} (${m.id}): ${JSON.stringify({ ...m, id: undefined, name: undefined })}`);
if (bericht.fehler.length) {
  console.log(`Nicht nachgetragen: ${bericht.fehler.length}`);
  for (const f of bericht.fehler) console.log(`  ${f.name} (${f.id}): ${f.grund}`);
}

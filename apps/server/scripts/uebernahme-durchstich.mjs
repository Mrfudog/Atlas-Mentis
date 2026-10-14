/**
 * **Übernahme mit zwei echten Datenbanken** (T-130): zwei Server, jeder
 * gegen seine eigene Postgres-Datenbank — einer als prod (nimmt an), einer
 * als dev (löst aus, kennt prod als Gegenstelle). Geprüft wird, was die
 * Tests im Speicher nicht sehen: die Basis in `transfer_base`, Revisionen
 * aus Postgres, Sicherungsdateien auf der Platte, das Überklonen über den
 * Einleser.
 *
 *   pnpm --filter @nw/model build && pnpm --filter @nw/registry build
 *   pnpm --filter @nw/server build
 *   DATABASE_URL=postgres://… node apps/server/scripts/uebernahme-durchstich.mjs
 *
 * `DATABASE_URL` nennt einen Zugang, der Datenbanken anlegen darf; die
 * beiden Datenbanken `uebernahme_dev` und `uebernahme_prod` werden dabei
 * neu angelegt (was dort stand, geht).
 */

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { URL, fileURLToPath } from 'node:url';
import pg from 'pg';

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const PASSWORT = 'uebernahme-am-nebeltor';
const ADMIN_URL = process.env['DATABASE_URL'];
if (!ADMIN_URL) {
  console.error('DATABASE_URL fehlt — gegen welche Postgres?');
  process.exit(2);
}
const dbUrl = (name) => {
  const u = new URL(ADMIN_URL);
  u.pathname = `/${name}`;
  return u.toString();
};

let fehler = 0;
function pruefe(was, ok, detail = '') {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${was}${!ok && detail ? ` — ${detail}` : ''}`);
  if (!ok) fehler += 1;
}

async function frischeDatenbanken() {
  const c = new pg.Client({ connectionString: ADMIN_URL });
  await c.connect();
  for (const n of ['uebernahme_dev', 'uebernahme_prod']) {
    await c.query(`drop database if exists ${n}`);
    await c.query(`create database ${n}`);
  }
  await c.end();
}

const TMP = mkdtempSync(join(tmpdir(), 'uebernahme-'));
const server = [];

function starte(name, port, env) {
  const p = spawn(process.execPath, [join(DIST, 'index.js')], {
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', ASSET_DIR: join(TMP, name, 'bilder'), ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const s = { name, base: `http://127.0.0.1:${port}`, proc: p, log: '' };
  p.stdout.on('data', (d) => (s.log += d));
  p.stderr.on('data', (d) => (s.log += d));
  server.push(s);
  return s;
}

async function bereit(s) {
  for (let i = 0; i < 80; i += 1) {
    if (s.proc.exitCode !== null) return false;
    try {
      const r = await fetch(`${s.base}/api/me`);
      if (r.status !== 503 && (await fetch(`${s.base}/api/health`)).ok) return true;
    } catch {
      /* noch nicht oben */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function konto(url, name) {
  const r = spawnSync(process.execPath, [join(DIST, 'user.js'), 'add', name, '--admin'], {
    env: { ...process.env, DATABASE_URL: url, NW_PASSWORD: PASSWORT },
    encoding: 'utf8',
  });
  return r.status === 0 ? '' : `${r.stdout}${r.stderr}`;
}

async function anmelden(s, name) {
  const r = await fetch(`${s.base}/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, password: PASSWORT }),
  });
  return (r.headers.get('set-cookie') ?? '').split(';')[0];
}

async function api(s, keks, method, pfad, body) {
  const r = await fetch(`${s.base}${pfad}`, {
    method,
    headers: { cookie: keks, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await r.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { text };
  }
  return { status: r.status, json };
}

const regel = (id, nr, name, text) => ({
  id,
  name,
  interfaces: ['Rule'],
  components: { Identity: { name, id: nr, aliases: [] }, Status: { status: 'ready' }, Description: { description: text } },
  relations: [],
});

async function schreibe(s, keks, e) {
  const alt = await api(s, keks, 'GET', `/api/entities/${e.id}`);
  const r = await api(s, keks, 'PUT', `/api/entities/${e.id}`, alt.status === 200 ? { ...e, revision: alt.json.revision } : e);
  pruefe(`${s.name}: ${e.id} geschrieben`, r.status === 200 || r.status === 201, `${r.status} ${JSON.stringify(r.json).slice(0, 300)}`);
}

const text = async (s, keks, id) => (await api(s, keks, 'GET', `/api/entities/${id}`)).json?.components?.Description?.description;
const nummer = async (s, keks, id) => (await api(s, keks, 'GET', `/api/entities/${id}`)).json?.components?.Identity?.id;

async function lauf(dev, keks, auftrag, extra = {}) {
  const v = await api(dev, keks, 'POST', '/api/transfer/preview', auftrag);
  if (v.status !== 200) return { vorschau: v, lauf: v };
  const r = await api(dev, keks, 'POST', '/api/transfer/run', {
    ...auftrag,
    apply: v.json.items.map((i) => i.id),
    expect: Object.fromEntries(v.json.items.map((i) => [i.id, [i.sourceKey, i.targetKey]])),
    ...extra,
  });
  return { vorschau: v, lauf: r };
}

try {
  await frischeDatenbanken();
  const prodUrl = dbUrl('uebernahme_prod');
  const devUrl = dbUrl('uebernahme_dev');

  const prod = starte('prod', 18091, { DATABASE_URL: prodUrl, ATLAS_ENV: 'prod', ATLAS_TRANSFER_ACCEPT: '1', ATLAS_BACKUP_DIR: join(TMP, 'prod', 'backups') });
  pruefe('prod startet', await bereit(prod), prod.log.slice(-2000));
  pruefe('prod: Konto', konto(prodUrl, 'basil') === '');
  const prodKeks = await anmelden(prod, 'basil');
  const t = await api(prod, prodKeks, 'POST', '/api/tokens', { name: 'dev', scope: 'write', days: 1 });
  pruefe('prod: Schreibtoken für dev', t.status === 201, JSON.stringify(t.json));

  const dev = starte('dev', 18092, {
    DATABASE_URL: devUrl,
    ATLAS_ENV: 'dev',
    ATLAS_PEER_URL: prod.base,
    ATLAS_PEER_TOKEN: t.json.token,
    ATLAS_BACKUP_DIR: join(TMP, 'dev', 'backups'),
  });
  pruefe('dev startet', await bereit(dev), dev.log.slice(-2000));
  pruefe('dev: Konto', konto(devUrl, 'basil') === '');
  const keks = await anmelden(dev, 'basil');

  const stand = await api(dev, keks, 'GET', '/api/transfer');
  pruefe('dev kennt prod, prod nimmt an', stand.json?.peer?.url === prod.base && stand.json?.peerState?.accept === true, JSON.stringify(stand.json));
  pruefe('das Token steht in keiner Antwort', !JSON.stringify(stand.json).includes(t.json.token));

  // ---------------------------------------------------- Schieben, Nummern
  await schreibe(prod, prodKeks, regel('r_ice', 'rule-0901', 'Ice', 'Slippery.'));
  await schreibe(dev, keks, regel('r_wind', 'rule-0901', 'Wind', 'Blows.'));
  await schreibe(dev, keks, regel('r_storm', 'rule-0902', 'Storm', 'See [[rule-0901|Wind]].'));
  const push = { direction: 'push', select: { ids: ['r_wind', 'r_storm'] } };
  const p1 = await lauf(dev, keks, push);
  pruefe('Vorschau: zwei neue', p1.vorschau.json?.items?.every((i) => i.status === 'new'), JSON.stringify(p1.vorschau.json));
  pruefe('Schieben', p1.lauf.status === 200, JSON.stringify(p1.lauf.json));
  pruefe('prod vergibt die Nummer', (await nummer(prod, prodKeks, 'r_wind')) === 'rule-0903', JSON.stringify([await nummer(prod, prodKeks, 'r_wind'), await nummer(prod, prodKeks, 'r_storm'), await nummer(dev, keks, 'r_storm'), p1.lauf.json, p1.vorschau.json.items.map((i) => i.number)]));
  pruefe('dev zieht nach', (await nummer(dev, keks, 'r_wind')) === 'rule-0903');
  pruefe('Verweis auf beiden Seiten umgehängt', (await text(dev, keks, 'r_storm')) === 'See [[rule-0903|Wind]].' && (await text(prod, prodKeks, 'r_storm')) === 'See [[rule-0903|Wind]].');
  const backups = existsSync(join(TMP, 'prod', 'backups')) ? readdirSync(join(TMP, 'prod', 'backups')) : [];
  pruefe('prod: Sicherung vor dem Schreiben', backups.some((f) => f.includes('vor-uebernahme')), backups.join(', '));

  const c = new pg.Client({ connectionString: devUrl });
  await c.connect();
  const basis = await c.query('select key from transfer_base order by key');
  pruefe('dev: Basis in transfer_base', basis.rows.map((r) => r.key).join(',') === 'r_storm,r_wind', JSON.stringify(basis.rows));
  await c.end();

  // ----------------------------------------------------------- Konflikt
  await schreibe(dev, keks, { ...regel('r_storm', 'rule-0902', 'Storm', 'Dev says.') });
  await schreibe(prod, prodKeks, { ...regel('r_storm', 'rule-0902', 'Storm', 'Prod says.') });
  const k = { direction: 'push', select: { ids: ['r_storm'] } };
  const k1 = await lauf(dev, keks, k);
  pruefe('Konflikt erkannt', k1.vorschau.json?.items?.[0]?.status === 'conflict', JSON.stringify(k1.vorschau.json));
  pruefe('ungelöst: nichts geschrieben', k1.lauf.status === 422 && (await text(prod, prodKeks, 'r_storm')) === 'Prod says.');
  const k2 = await lauf(dev, keks, k, { choices: { r_storm: { 'Description.description': { value: 'Both agree.' } } } });
  pruefe('von Hand gelöst', k2.lauf.status === 200, JSON.stringify(k2.lauf.json));
  pruefe('beide Seiten gleich', (await text(prod, prodKeks, 'r_storm')) === 'Both agree.' && (await text(dev, keks, 'r_storm')) === 'Both agree.');

  // --------------------------------------------------------- Rückgängig
  const u = await api(dev, keks, 'POST', `/api/transfer/${k2.lauf.json.id}/undo`, {});
  pruefe('Rückgängig', u.status === 200, JSON.stringify(u.json));
  pruefe('prod wieder wie vorher', (await text(prod, prodKeks, 'r_storm')) === 'Prod says.');
  pruefe('dev wieder wie vorher', (await text(dev, keks, 'r_storm')) === 'Dev says.');

  // -------------------------------------------------------------- Holen
  const h = await lauf(dev, keks, { direction: 'pull', select: { ids: ['r_ice'] } });
  pruefe('Holen', h.lauf.status === 200, JSON.stringify(h.lauf.json));
  pruefe('dev hat den Artikel von prod mit dessen Nummer', (await nummer(dev, keks, 'r_ice')) === 'rule-0901');

  // ---------------------------------------------------------- Überklonen
  await schreibe(dev, keks, regel('r_only_dev', 'rule-0950', 'Only dev', 'Goes.'));
  const probe = await api(dev, keks, 'POST', '/api/transfer/clone', { dryRun: true });
  pruefe('Überklonen: Probelauf', probe.status === 200, JSON.stringify(probe.json));
  const ohne = await api(dev, keks, 'POST', '/api/transfer/clone', {});
  pruefe('Überklonen ohne Bestätigung: nichts', ohne.status === 409);
  const klon = await api(dev, keks, 'POST', '/api/transfer/clone', { confirm: 'OVERWRITE' });
  pruefe('Überklonen', klon.status === 200, JSON.stringify(klon.json));
  pruefe('was nur auf dev stand, ist weg', (await api(dev, keks, 'GET', '/api/entities/r_only_dev')).status === 404);
  pruefe('dev hat, was prod hat', (await text(dev, keks, 'r_storm')) === 'Prod says.');
  const sicherung = readdirSync(join(TMP, 'dev', 'backups')).find((f) => f.includes('vor-ueberklonen'));
  const gesichert = sicherung ? JSON.parse(readFileSync(join(TMP, 'dev', 'backups', sicherung), 'utf8')) : null;
  pruefe('dev: ganze Sicherung davor', gesichert?.entities?.some((e) => e.id === 'r_only_dev'), sicherung);
  pruefe('dev: Konto bleibt', (await anmelden(dev, 'basil')) !== '');
  const danach = await lauf(dev, keks, { direction: 'pull', select: { types: ['Rule'] } });
  pruefe('danach alles unverändert', danach.vorschau.json?.items?.every((i) => i.status === 'unchanged'), JSON.stringify(danach.vorschau.json?.items?.map((i) => [i.id, i.status])));
} catch (error) {
  pruefe('Durchstich der Übernahme', false, String(error?.stack ?? error));
} finally {
  for (const s of server) s.proc.kill('SIGTERM');
  rmSync(TMP, { recursive: true, force: true });
}

if (fehler) {
  console.error(`\n${fehler} Prüfung(en) fehlgeschlagen.`);
  for (const s of server) console.error(`--- ${s.name}\n${s.log.slice(-3000)}`);
  process.exit(1);
}
console.log('\nÜbernahme mit zwei Datenbanken in Ordnung.');

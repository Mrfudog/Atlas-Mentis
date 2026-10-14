/**
 * Ein Durchstich gegen eine echte Postgres.
 *
 * Die Prüfungen in `test/` laufen gegen `InMemoryRepository` — das ist
 * richtig für die Routen und hat zwei Monate lang verdeckt, dass die
 * Migrationskette auf einer leeren Datenbank gar nicht durchlief (007 las
 * Spalten, die es nie gab; 013 schrieb Text in uuid-Spalten). Gemerkt hätte
 * man es beim ersten Aufsetzen auf Hetzner. Dieser Lauf macht genau das,
 * nur früher: Server bauen, gegen eine frische Datenbank starten, Konten
 * über die Kommandozeile anlegen, schreiben, lesen, das Register speichern,
 * die Sichtbarkeit prüfen, löschen.
 *
 *   pnpm --filter @nw/model build && pnpm --filter @nw/registry build
 *   pnpm --filter @nw/server build
 *   DATABASE_URL=postgres://… node apps/server/scripts/durchstich.mjs
 *
 * Die Datenbank muss leer sein oder von einem früheren Durchstich stammen;
 * die Konten werden nur angelegt, wenn es sie noch nicht gibt.
 */

/* global Buffer, FormData, Blob */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const PORT = Number(process.env['DURCHSTICH_PORT'] ?? 18089);
const BASE = `http://127.0.0.1:${PORT}`;
const PASSWORT = process.env['NW_PASSWORD'] ?? 'durchstich-am-nebeltor';

if (!process.env['DATABASE_URL']) {
  console.error('DATABASE_URL fehlt — gegen welche Datenbank?');
  process.exit(2);
}

let fehler = 0;
function pruefe(was, ok, detail = '') {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${was}${!ok && detail ? ` — ${detail}` : ''}`);
  if (!ok) fehler += 1;
}

/* Konten nur über die Kommandozeile, wie auf dem Server auch: eine Route
   dafür gibt es absichtlich nicht. */
function user(...args) {
  const r = spawnSync(process.execPath, [join(DIST, 'user.js'), ...args], {
    env: { ...process.env, NW_PASSWORD: PASSWORT },
    encoding: 'utf8',
  });
  return { ok: r.status === 0, out: `${r.stdout}${r.stderr}`.trim() };
}

/* Die Bilder (T-114) in ein eigenes Verzeichnis, das danach geht. */
const BILDER = mkdtempSync(join(tmpdir(), 'durchstich-bilder-'));
const server = spawn(process.execPath, [join(DIST, 'index.js')], {
  env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', ASSET_DIR: BILDER },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let log = '';
server.stdout.on('data', (d) => (log += d));
server.stderr.on('data', (d) => (log += d));

async function bereit() {
  for (let i = 0; i < 60; i += 1) {
    if (server.exitCode !== null) return false;
    try {
      if ((await fetch(`${BASE}/api/health`)).ok) return true;
    } catch {
      /* noch nicht oben */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function anmelden(name) {
  const r = await fetch(`${BASE}/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, password: PASSWORT }),
  });
  return r.ok ? (r.headers.get('set-cookie') ?? '').split(';')[0] : null;
}

const json = { 'content-type': 'application/json' };
const put = (keks, e) =>
  fetch(`${BASE}/api/entities/${encodeURIComponent(e.id)}`, {
    method: 'PUT',
    headers: { ...json, cookie: keks },
    body: JSON.stringify(e),
  });
const get = (keks, pfad) => fetch(`${BASE}${pfad}`, { headers: { cookie: keks } });

/* Zwei Kampagnen auf je einer eigenen Ebene: ein `gm`-Artikel in der einen
   geht an deren Leitung und nicht an die der anderen. Das ist die Regel,
   die am meisten Zeilen über Postgres braucht (Rollen aus campaign_member,
   Kanten aus relation), also die, die eine Abbildung am ehesten verliert. */
const ident = (name, id) => ({ Identity: { name, id, aliases: [] }, Status: { status: 'ready' } });
const ebene = (id, name, n) => ({
  id, name, interfaces: ['Layer'],
  components: { ...ident(name, `layer-09${n}`), Layer: { kind: 'campaign', order: 50 } },
  relations: [],
});
const kampagne = (id, name, n, ly) => ({
  id, name, interfaces: ['Campaign'],
  components: ident(name, `campaign-09${n}`),
  relations: [{ id: `${id}_ac`, type: 'activates', to: ly, props: { order: 50 } }],
});
const ARTIKEL = [
  ebene('ly_probe_a', 'Probe A', 1),
  ebene('ly_probe_b', 'Probe B', 2),
  kampagne('camp_probe_a', 'Runde A', 1, 'ly_probe_a'),
  kampagne('camp_probe_b', 'Runde B', 2, 'ly_probe_b'),
  {
    id: 'pc_probe', name: 'Probefigur', interfaces: ['PlayerCharacter'],
    components: { ...ident('Probefigur', 'playercharacter-0901'), PlayerCharacter: { level: 3 } },
    relations: [{ id: 'pc_probe_in', type: 'inLayer', to: 'ly_probe_a', props: {} }],
  },
  /* Vorlage und Instanz: Postgres speichert je Karte, und eine
     ausgedünnte Instanz hat Karten, die ganz fehlen. */
  {
    id: 'sb_probe_vorlage', name: 'Probewache', interfaces: ['Statblock'],
    components: { ...ident('Probewache', 'statblock-0901'), Statblock: { ac: 16, hp: 11 } },
    relations: [],
  },
  {
    id: 'sb_probe_instanz', name: 'Probefigur', interfaces: ['Statblock'],
    components: ident('Probefigur', 'statblock-0902'),
    relations: [
      { id: 'sb_probe_i', type: 'instanceOf', to: 'sb_probe_vorlage', props: {} },
      { id: 'sb_probe_b', type: 'belongsTo', to: 'pc_probe', props: {} },
    ],
  },
  /* Werkbank (W9): zwei gleiche Merkmale und ein Statblock, der das
     zweite nutzt — Zusammenführen hängt die Kante um, und in Postgres ist
     eine Kanten-Id Schlüssel der ganzen Tabelle. */
  {
    id: 'ft_probe_1', name: 'Probemerkmal', interfaces: ['Feature'],
    components: { ...ident('Probemerkmal', 'feature-0901'), Description: { description: 'Gleich.' } },
    relations: [],
  },
  {
    id: 'ft_probe_2', name: 'Probemerkmal', interfaces: ['Feature'],
    components: { ...ident('Probemerkmal', 'feature-0902'), Description: { description: 'Gleich.' } },
    relations: [],
  },
  {
    id: 'sb_probe_nutzer', name: 'Probeoger', interfaces: ['Statblock'],
    components: { ...ident('Probeoger', 'statblock-0903'), Statblock: { ac: 11, hp: 59 } },
    relations: [{ id: 'sb_probe_nutzer~c', type: 'composedOf', to: 'ft_probe_2', props: {} }],
  },
  {
    id: 'npc_probe_geheim', name: 'Geheim', interfaces: ['Creature'],
    components: { ...ident('Geheim', 'creature-0901'), Visibility: { audience: 'gm' } },
    relations: [{ id: 'npc_probe_in', type: 'inLayer', to: 'ly_probe_a', props: {} }],
  },
];

try {
  pruefe('Server startet, Migrationen laufen durch', await bereit(), log.slice(-2000));
  if (fehler) throw new Error('abgebrochen');

  for (const [name, ...rest] of [
    ['probe-admin', '--admin'],
    ['probe-leitung'],
    ['probe-fremd'],
    ['probe-spiel', '--actor', 'pc_probe'],
    ['probe-mit'],
  ]) {
    const r = user('add', name, ...rest);
    pruefe(`Konto ${name}`, r.ok || /gibt es schon/.test(r.out), r.out);
  }
  pruefe('Rolle gm in Runde A', user('role', 'probe-leitung', 'camp_probe_a', 'gm').ok);
  pruefe('Rolle gm in Runde B', user('role', 'probe-fremd', 'camp_probe_b', 'gm').ok);
  pruefe('Rolle player in Runde A', user('role', 'probe-spiel', 'camp_probe_a', 'player').ok);
  pruefe('Rolle player in Runde A (ohne Figur)', user('role', 'probe-mit', 'camp_probe_a', 'player').ok);

  const admin = await anmelden('probe-admin');
  pruefe('Anmelden', !!admin);

  for (const e of ARTIKEL) {
    const r = await put(admin, e);
    pruefe(`PUT ${e.id}`, r.ok, `${r.status} ${(await r.text()).slice(0, 300)}`);
  }

  const zurueck = await (await get(admin, '/api/entities/pc_probe')).json();
  pruefe(
    'GET liefert Karten und Kanten zurück',
    zurueck.components?.PlayerCharacter?.level === 3 &&
      zurueck.relations?.some((r) => r.type === 'inLayer' && r.to === 'ly_probe_a'),
    JSON.stringify(zurueck).slice(0, 300),
  );

  const inst = await (await get(admin, '/api/entities/sb_probe_instanz')).json();
  pruefe(
    'eine Instanz kommt aufgelöst an',
    inst.components?.Statblock?.ac === 16 && inst.fromTemplate?.template === 'sb_probe_vorlage',
    JSON.stringify(inst).slice(0, 300),
  );
  inst.components.Statblock.hp = 18;
  const r3 = await put(admin, inst);
  const wieder = await (await get(admin, '/api/entities/sb_probe_instanz')).json();
  pruefe(
    'zurückgeschickt speichert sie nur, was abweicht',
    r3.ok && wieder.components?.Statblock?.hp === 18 && wieder.components?.Statblock?.ac === 16
      && !wieder.fromTemplate?.fields?.includes('Statblock.hp'),
    `${r3.status} ${JSON.stringify(wieder).slice(0, 300)}`,
  );

  /* REQ-192: zwei Geräte schreiben gleichzeitig gegen dieselbe Revision.
     Genau eines kommt durch; das andere bekommt 409 und den neuen Stand.
     Die Sperre (`for update`) gibt es nur in Postgres. */
  {
    const pc = await (await get(admin, '/api/entities/pc_probe')).json();
    delete pc.refs;
    const zwei = await Promise.all(
      ['Probefigur A', 'Probefigur B'].map((n) =>
        put(admin, { ...pc, components: { ...pc.components, Identity: { ...pc.components.Identity, aliases: [n] } } }),
      ),
    );
    const codes = zwei.map((r) => r.status).sort();
    const abgewiesen = zwei.find((r) => r.status === 409);
    const body = abgewiesen ? await abgewiesen.json() : null;
    pruefe(
      'gleichzeitig gegen dieselbe Revision: eines schreibt, eines bekommt 409',
      codes.join() === '200,409' && body?.revision === pc.revision + 1 && body?.current?.id === 'pc_probe',
      `${codes.join()} ${JSON.stringify(body).slice(0, 200)}`,
    );
    const blind = await put(admin, { ...pc, revision: undefined });
    pruefe('ohne Revision wird nichts überschrieben', blind.status === 409, String(blind.status));
  }

  /* Das Register speichern, während Artikel darauf zeigen — scheiterte
     einmal an einem Fremdschlüssel, den nur Postgres kennt. */
  const reg = await (await get(admin, '/api/registry')).json();
  const r2 = await fetch(`${BASE}/api/registry/interfaces`, {
    method: 'PUT',
    headers: { ...json, cookie: admin },
    body: JSON.stringify(reg.interfaces),
  });
  pruefe('PUT registry/interfaces', r2.ok, `${r2.status} ${(await r2.text()).slice(0, 300)}`);

  const status = async (name) =>
    (await get(await anmelden(name), '/api/entities/npc_probe_geheim')).status;
  pruefe('gm-Artikel: die Leitung der Runde sieht ihn', (await status('probe-leitung')) === 200);
  pruefe('gm-Artikel: die Leitung der anderen Runde nicht', (await status('probe-fremd')) === 404);
  pruefe('gm-Artikel: wer mitspielt, nicht', (await status('probe-spiel')) === 404);

  {
    /* Spielende legen an, „ready" setzt die Leitung (REQ-237). Wer etwas
       angelegt hat, steht in `app_user_article` — die Tabelle gibt es nur
       in Postgres. Die laufende Kampagne wird ausdrücklich gesetzt: ohne
       Einstellung wäre es die erste im Bestand, und welche das ist, sagt
       Postgres nicht verlässlich. */
    const einst = { ...(reg.settings ?? {}), campaign: 'camp_probe_a' };
    const rE = await fetch(`${BASE}/api/registry/settings`, {
      method: 'PUT',
      headers: { ...json, cookie: admin },
      body: JSON.stringify(einst),
    });
    pruefe('laufende Kampagne gesetzt', rE.ok, String(rE.status));
    const spielerin = await anmelden('probe-spiel');
    const rA = await fetch(`${BASE}/api/entities`, {
      method: 'POST',
      headers: { ...json, cookie: spielerin },
      body: JSON.stringify({ type: 'Place', name: 'Probeentwurf' }),
    });
    const entwurf = await rA.json();
    pruefe(
      'eine Spielerin legt an, unfertig, in der Ebene ihrer Runde',
      rA.status === 201 && entwurf.components?.Status?.status === 'idea' &&
        entwurf.relations?.some((r) => r.type === 'inLayer' && r.to === 'ly_probe_a'),
      `${rA.status} ${JSON.stringify(entwurf).slice(0, 300)}`,
    );
    const meS = await (await get(spielerin, '/api/me')).json();
    pruefe('was sie angelegt hat, darf sie schreiben', meS.writable?.includes(entwurf.id), JSON.stringify(meS).slice(0, 300));
    const sieht = async (keks) => (await get(keks, `/api/entities/${entwurf.id}`)).status;
    pruefe('den Entwurf sieht die Verfasserin', (await sieht(spielerin)) === 200);
    pruefe('den Entwurf sieht die Leitung der Runde', (await sieht(await anmelden('probe-leitung'))) === 200);
    pruefe('den Entwurf sieht die Leitung der anderen Runde nicht', (await sieht(await anmelden('probe-fremd'))) === 404);
    const fertig = { ...entwurf, components: { ...entwurf.components, Status: { status: 'ready' } } };
    delete fertig.refs;
    pruefe('„ready" setzt sie nicht selbst', (await put(spielerin, fertig)).status === 403);
    const rL = await put(await anmelden('probe-leitung'), fertig);
    pruefe('„ready" setzt die Leitung', rL.ok, `${rL.status} ${(await rL.text()).slice(0, 200)}`);

    /* Teil 2 (E-012): ändert sie den fertigen Artikel, fällt er zurück,
       und für alle anderen gilt der fertige Stand aus `entity_ready` — die
       Tabelle gibt es nur in Postgres. */
    const mit = await anmelden('probe-mit');
    const leitung = await anmelden('probe-leitung');
    const jetzt = await (await get(spielerin, `/api/entities/${entwurf.id}`)).json();
    delete jetzt.refs;
    const geaendert = { ...jetzt, name: 'Probeentwurf, neu', components: { ...jetzt.components, Identity: { ...jetzt.components.Identity, name: 'Probeentwurf, neu' } } };
    const rG = await put(spielerin, geaendert);
    const nachG = rG.ok ? await rG.json() : null;
    pruefe('eine Änderung der Spielerin lässt ihn zurückfallen', nachG?.components?.Status?.status === 'prepared', `${rG.status} ${JSON.stringify(nachG).slice(0, 200)}`);
    const beiMit = await (await get(mit, `/api/entities/${entwurf.id}`)).json();
    pruefe('ein Mitspieler sieht den fertigen Stand', beiMit.name === 'Probeentwurf' && beiMit.components?.Status?.status === 'ready', JSON.stringify(beiMit).slice(0, 200));
    const beiL = await (await get(leitung, `/api/entities/${entwurf.id}`)).json();
    pruefe('die Leitung sieht den neuen, mit Datum des alten', beiL.name === 'Probeentwurf, neu' && !!beiL.refs?.ready?.at, JSON.stringify(beiL.refs ?? {}).slice(0, 200));
    const wartet = await (await get(leitung, '/api/unready')).json();
    pruefe('die Leitung sieht, was wartet', wartet.rows?.some((r) => r.id === entwurf.id && r.authors?.includes('probe-spiel')), JSON.stringify(wartet).slice(0, 300));
    const rR = await fetch(`${BASE}/api/entities/${entwurf.id}/ready`, { method: 'POST', headers: { cookie: leitung } });
    pruefe('„ready" per Knopf', rR.ok, `${rR.status} ${(await rR.text()).slice(0, 200)}`);
    const nachR = await (await get(mit, `/api/entities/${entwurf.id}`)).json();
    pruefe('danach gilt der neue Stand für alle', nachR.name === 'Probeentwurf, neu', JSON.stringify(nachR).slice(0, 200));

    /* Die eigene Figur (E-014 d): die Spielerin setzt sie selbst fertig,
       auch ihren Statblock. */
    const figur = await (await get(spielerin, '/api/entities/pc_probe')).json();
    delete figur.refs;
    const rF = await put(spielerin, { ...figur, components: { ...figur.components, Status: { status: 'ready' } } });
    pruefe('die eigene Figur nennt die Spielerin selbst fertig', rF.ok, `${rF.status} ${(await rF.text()).slice(0, 200)}`);
    const sb = await (await get(spielerin, '/api/entities/sb_probe_instanz')).json();
    delete sb.refs;
    const rS = await put(spielerin, { ...sb, components: { ...sb.components, Statblock: { ...(sb.components?.Statblock ?? {}), ac: 17 } } });
    pruefe('ihren Statblock (eine Instanz) schreibt sie selbst', rS.ok, `${rS.status} ${(await rS.text()).slice(0, 200)}`);
    const rW = await fetch(`${BASE}/api/entities/${entwurf.id}`, { method: 'DELETE', headers: { cookie: admin } });
    pruefe('DELETE des Entwurfs', rW.ok, String(rW.status));
  }

  {
    /* Die Liste am Server (W7): gerechnet über den Zwischenspeicher je
       Stempel — ein Schreiben muss ihn ungültig machen, auch in Postgres,
       wo der Stempel aus `count`/`max(updated_at)` kommt. */
    const liste = async (keks, frage) => (await get(keks, `/api/list?${frage}`)).json();
    const l1 = await liste(admin, 'q=probe&limit=50');
    pruefe(
      'GET /api/list findet die Probeartikel, mit Arten und Ebenen',
      l1.total >= 5 && l1.facets?.types?.some((t) => t.type === 'Statblock') &&
        l1.facets?.layers?.some((l) => l.id === 'ly_probe_a'),
      JSON.stringify(l1).slice(0, 300),
    );
    pruefe(
      'die Instanz steht in keiner Liste',
      !l1.rows.some((z) => z.id === 'sb_probe_instanz'),
    );
    const angelegt = await fetch(`${BASE}/api/entities`, {
      method: 'POST',
      headers: { ...json, cookie: admin },
      body: JSON.stringify({ type: 'Creature', name: 'Probeneuling' }),
    });
    const neu = await angelegt.json();
    pruefe(
      'POST /api/entities vergibt Id und Nummer',
      angelegt.status === 201 && /^e_/.test(neu.id) && /^creature-\d{4}$/.test(neu.components?.Identity?.id ?? ''),
      `${angelegt.status} ${JSON.stringify(neu).slice(0, 300)}`,
    );
    const l2 = await liste(admin, 'q=probeneuling');
    pruefe('die Liste sieht den neuen Artikel sofort', l2.total === 1 && l2.rows[0]?.id === neu.id, JSON.stringify(l2).slice(0, 200));
    const offenSpiel = await liste(await anmelden('probe-spiel'), 'q=geheim');
    pruefe('die Liste siebt je Betrachter', !offenSpiel.rows.some((z) => z.id === 'npc_probe_geheim'), JSON.stringify(offenSpiel).slice(0, 200));
    const mitNamen = await (await get(admin, '/api/entities/pc_probe')).json();
    pruefe('ein Artikel bringt die Namen seiner Kantenziele mit', mitNamen.refs?.names?.ly_probe_a === 'Probe A', JSON.stringify(mitNamen.refs));
    const weg = await fetch(`${BASE}/api/entities/${neu.id}`, { method: 'DELETE', headers: { cookie: admin } });
    pruefe('DELETE des neuen Artikels', weg.ok, String(weg.status));

    /* ---------------------------------------------- Bilder (T-114) */
    /* Ein PNG mit einem Bildpunkt, von Hand — der Durchstich lädt kein sharp. */
    const PNG = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );
    const form = new FormData();
    form.append('for', 'npc_probe_geheim');
    form.append('file', new Blob([PNG], { type: 'image/png' }), 'geheim.png');
    const hoch = await fetch(`${BASE}/api/assets`, { method: 'POST', headers: { cookie: admin }, body: form });
    const bild = await hoch.json();
    const ref = bild.components?.Asset?.ref ?? '';
    pruefe(
      'POST /api/assets legt ein Asset an und die Datei in ASSET_DIR',
      hoch.status === 201 && /^[a-f0-9]{64}\.png$/.test(ref) && existsSync(join(BILDER, ref.slice(0, 2), ref)),
      `${hoch.status} ${JSON.stringify(bild).slice(0, 300)}`,
    );
    const ganz = await get(admin, bild.url ?? '/api/assets/-');
    pruefe('GET /api/assets liefert das Bild', ganz.status === 200 && ganz.headers.get('content-type') === 'image/png', String(ganz.status));
    const fremd = await get(await anmelden('probe-spiel'), bild.url ?? '/api/assets/-');
    pruefe('… und nicht an Spielende, wenn der NSC verborgen ist', fremd.status === 404, String(fremd.status));
    const bildWeg = await fetch(`${BASE}/api/entities/${bild.id}`, { method: 'DELETE', headers: { cookie: admin } });
    pruefe('ein gelöschtes Asset nimmt seine Datei mit', bildWeg.ok && !existsSync(join(BILDER, ref.slice(0, 2), ref)), String(bildWeg.status));
  }

  /* ---------------------------------------------------- Werkbank (W9) */
  const tokenAus = (out) => /atm_[\w-]+/.exec(out)?.[0] ?? '';
  const lesen = tokenAus(user('token', 'probe-admin', 'new', 'durchstich-lesen', '--days', '1').out);
  const schreiben = tokenAus(user('token', 'probe-admin', 'new', 'durchstich-schreiben', '--days', '1', '--write').out);
  pruefe('Tokens über die Kommandozeile', !!lesen && !!schreiben);
  const mit = (tok, pfad, body) =>
    fetch(`${BASE}${pfad}`, {
      method: body ? 'POST' : 'GET',
      headers: { ...json, authorization: `Bearer ${tok}` },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  const me = await (await mit(lesen, '/api/me')).json();
  pruefe('Bearer wirkt wie das Konto', me.user?.name === 'probe-admin' && me.token?.scope === 'read', JSON.stringify(me).slice(0, 200));

  const pr = await mit(lesen, '/api/checks?limit=5');
  const prJ = await pr.json();
  pruefe('GET /api/checks mit Lesetoken', pr.ok && prJ.checks?.some((c) => c.key === 'duplicates' && c.count >= 1), JSON.stringify(prJ).slice(0, 300));

  const brute = {
    select: { types: ['Statblock'], where: [{ field: 'name', op: 'endsWith', value: 'oger' }] },
    ops: [{ op: 'set', field: 'Statblock.combatRole', value: 'Brute' }],
  };
  const vorschau = await (await mit(lesen, '/api/bulk', { ...brute, dryRun: true })).json();
  pruefe('Massenänderung: Vorschau mit Lesetoken', vorschau.selected === 1 && vorschau.changed === 1, JSON.stringify(vorschau).slice(0, 300));
  pruefe('Massenänderung: Lesetoken schreibt nicht', (await mit(lesen, '/api/bulk', brute)).status === 403);
  const lauf = await mit(schreiben, '/api/bulk', brute);
  const laufJ = await lauf.json();
  const oger = async () => (await (await get(admin, '/api/entities/sb_probe_nutzer')).json()).components?.Statblock?.combatRole;
  pruefe('Massenänderung schreibt', lauf.ok && (await oger()) === 'Brute', JSON.stringify(laufJ).slice(0, 300));
  const undo = await mit(schreiben, `/api/bulk/${laufJ.id}/undo`, {});
  pruefe('Massenänderung rückgängig', undo.ok && (await oger()) === undefined, `${undo.status} ${(await undo.text()).slice(0, 300)}`);

  const merge = {
    select: { types: ['Feature'], where: [{ field: 'name', op: 'eq', value: 'Probemerkmal' }] },
    ops: [{ op: 'merge', mode: 'delete', by: 'content' }],
  };
  const zf = await mit(schreiben, '/api/bulk', merge);
  const zfJ = await zf.json();
  const kante = async () => (await (await get(admin, '/api/entities/sb_probe_nutzer')).json()).relations?.find((r) => r.type === 'composedOf')?.to;
  pruefe(
    'Zusammenführen hängt die Kante um und löscht das Doppel',
    zf.ok && zfJ.deleted === 1 && (await kante()) === 'ft_probe_1' && (await get(admin, '/api/entities/ft_probe_2')).status === 404,
    JSON.stringify(zfJ).slice(0, 300),
  );
  const zfUndo = await mit(schreiben, `/api/bulk/${zfJ.id}/undo`, {});
  pruefe(
    'Zusammenführen rückgängig: das Doppel ist wieder da',
    zfUndo.ok && (await kante()) === 'ft_probe_2' && (await get(admin, '/api/entities/ft_probe_2')).ok,
    `${zfUndo.status} ${(await zfUndo.text()).slice(0, 300)}`,
  );

  const neu = await fetch(`${BASE}/api/tokens`, {
    method: 'POST',
    headers: { ...json, cookie: admin },
    body: JSON.stringify({ name: 'durchstich-seite', scope: 'read', days: 1 }),
  });
  const neuJ = await neu.json();
  pruefe('Token in der Sitzung angelegt', neu.status === 201 && /^atm_/.test(neuJ.token ?? ''));
  const weg = await fetch(`${BASE}/api/tokens/${neuJ.id}`, { method: 'DELETE', headers: { cookie: admin } });
  pruefe('widerrufenes Token gilt nicht mehr', weg.ok && (await mit(neuJ.token, '/api/me').then((r) => r.json())).user === null);
  /* Verwaltung (W3): Rollen und Figuren über die Routen statt die
     Kommandozeile, und eine Einladung, die in eine Kampagne führt — die
     Spalten `campaign_id` und `role` an `app_invite` gibt es nur in
     Postgres. */
  const leitung = await anmelden('probe-leitung');
  const mitglieder = async () =>
    (await (await get(leitung, '/api/campaigns/camp_probe_a/members')).json()).members ?? [];
  const spiel = (await mitglieder()).find((m) => m.name === 'probe-spiel');
  pruefe('Mitglieder: die Leitung sieht, wer mitspielt', spiel?.role === 'player');
  const setze = (pfad, body) =>
    fetch(`${BASE}${pfad}`, {
      method: 'PUT',
      headers: { ...json, cookie: leitung },
      body: JSON.stringify(body),
    });
  const r4 = await setze(`/api/campaigns/camp_probe_a/members/${spiel?.id}`, { role: 'spectator' });
  pruefe(
    'Rolle über die Route gesetzt',
    r4.ok && (await mitglieder()).find((m) => m.name === 'probe-spiel')?.role === 'spectator',
    String(r4.status),
  );
  await setze(`/api/campaigns/camp_probe_a/members/${spiel?.id}`, { role: 'player' });

  /* Filtergruppen (T-137): eine eigene der Spielerin, zwei Vorgaben derselben
     Seite — die zweite nimmt der ersten die Marke, in einer Abfrage auf
     `list_filter`, die der Index `list_filter_default` hält. */
  {
    const spielerin = await anmelden('probe-spiel');
    const lege = (keks, body) =>
      fetch(`${BASE}/api/filters`, { method: 'POST', headers: { ...json, cookie: keks }, body: JSON.stringify(body) });
    const eigen = await lege(spielerin, { page: 'world', name: 'Probe: places', filter: { of: ['Place'] } });
    pruefe('Filtergruppe: eigene der Spielerin', eigen.status === 201, `${eigen.status} ${await eigen.clone().text()}`);
    const a = await (await lege(admin, { page: 'world', name: 'Probe: A', scope: 'campaign', default: true, filter: { notype: ['Item'] } })).json();
    const b = await (await lege(admin, { page: 'world', name: 'Probe: B', scope: 'campaign', default: true })).json();
    const alle = (await (await get(admin, '/api/filters')).json()).groups ?? [];
    const vorgaben = alle.filter((g) => g.page === 'world' && g.default).map((g) => g.id);
    pruefe('Filtergruppe: eine Vorgabe je Seite', !!a.id && vorgaben.length === 1 && vorgaben[0] === b.id, JSON.stringify({ a, b, vorgaben }));
    const fremd = (await (await get(admin, '/api/filters')).json()).groups.some((g) => g.name === 'Probe: places');
    pruefe('Filtergruppe: die eigene einer anderen sieht niemand', !fremd);
    for (const id of [a.id, b.id]) if (id) await fetch(`${BASE}/api/filters/${id}`, { method: 'DELETE', headers: { cookie: admin } });
    const ej = await eigen.json();
    const weg = await fetch(`${BASE}/api/filters/${ej.id}`, { method: 'DELETE', headers: { cookie: spielerin } });
    pruefe('Filtergruppe: gelöscht', weg.ok, String(weg.status));
  }
  const r5 = await setze(`/api/campaigns/camp_probe_a/members/${spiel?.id}/actors`, {
    actorIds: ['pc_probe'],
  });
  pruefe('Figuren über die Route gesetzt', r5.ok, `${r5.status} ${(await r5.text()).slice(0, 200)}`);
  const einladung = await (
    await fetch(`${BASE}/api/invites`, {
      method: 'POST',
      headers: { ...json, cookie: leitung },
      body: JSON.stringify({ campaignId: 'camp_probe_a', role: 'spectator', uses: 1, days: 3 }),
    })
  ).json();
  const offen = await (await get(leitung, '/api/invites')).json();
  pruefe(
    'Einladung der Leitung, mit Kampagne und Rolle',
    !!einladung.code && offen.some((i) => i.campaignId === 'camp_probe_a' && i.role === 'spectator'),
    JSON.stringify(offen).slice(0, 300),
  );
  const gastName = `probe-gast-${Date.now()}`;
  const r6 = await fetch(`${BASE}/api/register`, {
    method: 'POST',
    headers: json,
    body: JSON.stringify({ name: gastName, password: PASSWORT, invite: einladung.code }),
  });
  const gast = r6.ok ? (await r6.json()).user : null;
  pruefe(
    'eingelöst kommt die Rolle mit',
    gast?.roles?.camp_probe_a === 'spectator' &&
      (await mitglieder()).some((m) => m.name === gastName && m.role === 'spectator'),
    `${r6.status} ${JSON.stringify(gast)}`,
  );
  pruefe(
    'die Kontoliste sieht nur die Verwaltung',
    (await get(leitung, '/api/users')).status === 403 && (await get(admin, '/api/users')).ok,
  );

  /* Eine Migration, die entfernt, löscht nie still (T-076): eine
     Probemigration nimmt der Probefigur ein Feld; ohne Freigabe bricht sie
     ab und ändert nichts, mit Freigabe läuft sie und zählt den Verlust. */
  {
    const { migrate } = await import(join(DIST, 'migrate.js'));
    const { default: pg } = await import('pg');
    const pool = new pg.Pool({ connectionString: process.env['DATABASE_URL'] });
    const ordner = mkdtempSync(join(tmpdir(), 'durchstich-verlust-'));
    const name = 'zzz_durchstich_verlust.sql';
    const wo = "entity_id = 'pc_probe' and type = 'PlayerCharacter'";
    writeFileSync(
      join(ordner, name),
      `-- verlust: select count(*) from component where ${wo} and payload ? 'level'\n` +
        `update component set payload = payload - 'level' where ${wo};\n`,
    );
    const traegt = async () =>
      (await pool.query(`select count(*)::int n from component where ${wo} and payload ? 'level'`)).rows[0].n;
    try {
      let abbruch = '';
      await migrate(pool, { env: {}, log: () => {} }, ordner).catch((e) => (abbruch = e.name));
      pruefe('Migration, die entfernt, bricht ohne Freigabe ab', abbruch === 'DatenverlustError' && (await traegt()) === 1);
      const gemeldet = [];
      const lauf = await migrate(pool, { env: { ATLAS_ALLOW_DATA_LOSS: name }, log: (m) => gemeldet.push(m) }, ordner);
      pruefe(
        'mit Freigabe läuft sie und zählt den Verlust',
        lauf.includes(name) && (await traegt()) === 0 && /1 Werte/.test(gemeldet.join()),
        gemeldet.join(' | '),
      );
    } finally {
      await pool.query('delete from schema_migrations where name = $1', [name]);
      await pool.end();
      rmSync(ordner, { recursive: true, force: true });
    }
  }


  /* Eine Ebene je Buch (T-081): die Migration hängt den Bestand der alten
     Ebene „D&D 5e (2014)" nach seiner Quelle um und schaltet die Bücher für
     jede Kampagne auf, die die alte Ebene aufschaltete. Gelaufen ist sie
     beim Start schon (auf leerem Bestand); hier läuft sie ein zweites Mal
     unter einem Probenamen gegen Probeartikel. Die Prüfung: **keine
     Kampagne verliert einen Artikel** (`inPlay` vorher und nachher). */
  {
    const { migrate } = await import(join(DIST, 'migrate.js'));
    const { PgRepository } = await import(join(DIST, 'repo.pg.js'));
    const { inPlay } = await import('@nw/model');
    const { default: pg } = await import('pg');
    const pool = new pg.Pool({ connectionString: process.env['DATABASE_URL'] });
    const repo = new PgRepository(pool);
    const ALT = 'e5_367c46d7f4ff';
    const in_ = (to) => [{ id: `~in-${to}`, type: 'inLayer', to, props: {} }];
    const quelle = (publication) => ({ Source: { publication, srd: false } });
    const probe = [
      { id: ALT, name: 'D&D 5e (2014)', interfaces: ['Layer'], components: { ...ident('D&D 5e (2014)', 'layer-0001'), Layer: { kind: 'system', order: 0, version: '2014' } }, relations: [] },
      { id: 'e5_probe_r1', name: 'Probe Darkvision', interfaces: ['Rule'], components: { ...ident('Probe Darkvision', 'rule-0901'), ...quelle('PHB') }, relations: in_(ALT) },
      { id: 'e5_probe_r2', name: 'Probe Tool Rule', interfaces: ['Rule'], components: { ...ident('Probe Tool Rule', 'rule-0902'), ...quelle('XGE') }, relations: in_(ALT) },
      { id: 'e5_probe_c1', name: 'Probe Blinded', interfaces: ['Condition'], components: { ...ident('Probe Blinded', 'condition-0901'), ...quelle('PHB') }, relations: in_(ALT) },
      { id: 'e5_probe_f1', name: 'Probe Harpers', interfaces: ['Faction'], components: { ...ident('Probe Harpers', 'faction-0901'), Notes: { note: [{ id: 'source', value: 'Source: SCAG, p. 3' }] } }, relations: in_(ALT) },
      { id: 'e5_probe_a1', name: 'Probe Action', interfaces: ['ActionType'], components: ident('Probe Action', 'actiontype-0901'), relations: in_(ALT) },
      { id: 'camp_probe_c', name: 'Runde C', interfaces: ['Campaign'], components: ident('Runde C', 'campaign-0903'), relations: [{ id: 'camp_probe_c_ac', type: 'activates', to: ALT, props: { order: 0 } }, { id: 'camp_probe_c_ac2', type: 'activates', to: 'ly_probe_a', props: { order: 50 } }] },
    ].map((e) => ({ ...e, relations: e.relations.map((r) => ({ ...r, id: r.id.startsWith('~') ? `${e.id}${r.id}` : r.id })) }));
    const ordner = mkdtempSync(join(tmpdir(), 'durchstich-buch-'));
    const name = 'zzz_durchstich_ebene_je_buch.sql';
    const name088 = 'zzz_durchstich_ebenen_gruppen.sql';
    const name094 = 'zzz_durchstich_ebenen_herausgeber.sql';
    const name109 = 'zzz_durchstich_ebene_2014_als_gruppe.sql';
    const BUECHER = ['e5_book_phb', 'e5_book_xge', 'e5_book_scag'];
    const sicht = async () => {
      const alle = new Map((await repo.listEntities()).map((e) => [e.id, e]));
      const je = new Map();
      for (const k of [...alle.values()].filter((e) => e.interfaces[0] === 'Campaign')) {
        je.set(k.id, new Set([...alle.values()].filter((e) => inPlay(alle, e, k)).map((e) => e.id)));
      }
      return { alle, je };
    };
    try {
      for (const e of probe) {
        const r = await put(admin, e);
        pruefe(`Probeartikel ${e.id}`, r.ok, `${r.status} ${await r.text()}`);
      }
      const vorher = await sicht();
      const { readFileSync } = await import('node:fs');
      writeFileSync(join(ordner, name), readFileSync(join(DIST, '..', 'migrations', '026_ebene_je_buch.sql'), 'utf8'));
      const gemeldet = [];
      const logAlt = console.log;
      console.log = (...a) => gemeldet.push(a.join(' '));
      try {
        await migrate(pool, { env: {} }, ordner);
      } finally {
        console.log = logAlt;
      }
      const nachher = await sicht();
      const verloren = [...vorher.je].flatMap(([k, ids]) => [...ids].filter((id) => !nachher.je.get(k)?.has(id)).map((id) => `${k}: ${id}`));
      pruefe('Eine Ebene je Buch: keine Kampagne verliert einen Artikel', verloren.length === 0 && vorher.je.get('camp_probe_c')?.has('e5_probe_r1'), verloren.join(', '));
      const ziel = (id) => (nachher.alle.get(id)?.relations ?? []).find((r) => r.type === 'inLayer')?.to;
      pruefe(
        'Eine Ebene je Buch: nach Source.publication und Fundstelle umgehängt, ohne Quelle geblieben',
        ziel('e5_probe_r1') === 'e5_book_phb' && ziel('e5_probe_c1') === 'e5_book_phb' && ziel('e5_probe_r2') === 'e5_book_xge'
          && ziel('e5_probe_f1') === 'e5_book_scag' && ziel('e5_probe_a1') === ALT,
        ['e5_probe_r1', 'e5_probe_c1', 'e5_probe_r2', 'e5_probe_f1', 'e5_probe_a1'].map((id) => `${id}→${ziel(id)}`).join(', '),
      );
      const phb = nachher.alle.get('e5_book_phb');
      pruefe(
        'Eine Ebene je Buch: die Buchebene heisst wie das Buch',
        phb?.components['Identity']?.name === "Player's Handbook" && phb.components['Layer']?.kind === 'book' && phb.components['Tags']?.tags?.[0] === 'core'
          && nachher.alle.get('e5_book_scag')?.components['Identity']?.name === "Sword Coast Adventurer's Guide",
        JSON.stringify(phb),
      );
      const auf = (k) => new Set((nachher.alle.get(k)?.relations ?? []).filter((r) => r.type === 'activates').map((r) => r.to));
      pruefe(
        'Eine Ebene je Buch: wer die alte Ebene aufschaltete, hat die Bücher; die anderen nicht',
        BUECHER.every((b) => auf('camp_probe_c').has(b)) && auf('camp_probe_c').has(ALT) && !BUECHER.some((b) => auf('camp_probe_a').has(b)),
        [...auf('camp_probe_c')].join(', '),
      );
      pruefe('Eine Ebene je Buch: was ohne Quelle blieb, wird aufgezählt', gemeldet.some((m) => /Ohne Quelle.*\(1\): Probe Action/.test(m)), gemeldet.join(' | '));
      const gelesen = await get(admin, '/api/campaigns/camp_probe_c/layers');
      pruefe('Eine Ebene je Buch: die Kampagnenseite liest die Bücher', gelesen.ok && (await gelesen.json()).layers.some((l) => l.id === 'e5_book_phb' && l.kind === 'book' && l.active), String(gelesen.status));

      /* Gruppen von Ebenen (T-088): dieselben Buchebenen bekommen ihre
         Gruppe, ihr Kürzel und ihre Beschreibung; keine Kampagne sieht
         danach etwas anderes. */
      writeFileSync(join(ordner, name088), readFileSync(join(DIST, '..', 'migrations', '034_ebenen_gruppen.sql'), 'utf8'));
      const vor088 = await sicht();
      await migrate(pool, { env: {} }, ordner);
      const nach088 = await sicht();
      const gruppeVon = (id) => (nach088.alle.get(id)?.relations ?? []).filter((r) => r.type === 'partOf').map((r) => r.to).join(',');
      pruefe(
        'Gruppen von Ebenen: jedes Buch hängt an seiner Gruppe',
        gruppeVon('e5_book_phb') === 'e5_group_core' && gruppeVon('e5_book_xge') === 'e5_group_supplement' && gruppeVon('e5_book_scag') === 'e5_group_setting'
          && nach088.alle.get('e5_group_core')?.components['Layer']?.kind === 'group',
        BUECHER.map((b) => `${b}→${gruppeVon(b)}`).join(', '),
      );
      const phb088 = nach088.alle.get('e5_book_phb');
      pruefe(
        'Gruppen von Ebenen: Kürzel und Beschreibung nachgetragen',
        phb088?.components['Layer']?.abbreviation === 'PHB' && phb088.components['Description']?.description === "PHB — Player's Handbook"
          && nach088.alle.get('e5_book_scag')?.components['Layer']?.abbreviation === 'SCAG',
        JSON.stringify(phb088?.components),
      );
      const verloren088 = [...vor088.je].flatMap(([k, ids]) => [...ids].filter((id) => !nach088.je.get(k)?.has(id)).map((id) => `${k}: ${id}`));
      pruefe('Gruppen von Ebenen: keine Kampagne verliert einen Artikel', verloren088.length === 0, verloren088.join(', '));
      /* Die Gruppe aufschalten und ein Buch darin abschalten — über die Seite. */
      const aufG = await fetch(`${BASE}/api/campaigns/camp_probe_c/layers`, {
        method: 'PUT', headers: { cookie: admin, 'content-type': 'application/json' },
        body: JSON.stringify({ layers: [ALT, 'e5_group_core', 'e5_book_xge', 'e5_book_scag', 'ly_probe_a'], off: [] }),
      });
      pruefe('Gruppen von Ebenen: Gruppe aufgeschaltet (Registerzeilen nachgezogen)', aufG.ok, `${aufG.status} ${await aufG.text()}`);
      const zeilen = (await (await get(admin, '/api/campaigns/camp_probe_c/layers')).json()).layers;
      pruefe('Gruppen von Ebenen: das Buch ist über die Gruppe im Spiel',
        zeilen.some((l) => l.id === 'e5_book_phb' && !l.active && l.inPlay), JSON.stringify(zeilen.map((l) => [l.id, l.active, l.inPlay])));
      const ausG = await fetch(`${BASE}/api/campaigns/camp_probe_c/layers`, {
        method: 'PUT', headers: { cookie: admin, 'content-type': 'application/json' },
        body: JSON.stringify({ layers: [ALT, 'e5_group_core', 'e5_book_xge', 'e5_book_scag', 'ly_probe_a'], off: ['e5_book_phb'] }),
      });
      pruefe('Gruppen von Ebenen: ein Buch in der Gruppe abgeschaltet', ausG.ok, `${ausG.status} ${await ausG.text()}`);
      const ohne = await sicht();
      pruefe('Gruppen von Ebenen: aus schlägt an', !ohne.je.get('camp_probe_c')?.has('e5_probe_r1') && ohne.je.get('camp_probe_c')?.has('e5_probe_r2'), '');
      const quellen = await (await get(admin, '/api/sources')).json();
      pruefe('Gruppen von Ebenen: Quellenkürzel erklärt', quellen.sources?.PHB === "Player's Handbook", JSON.stringify(quellen));

      /* Herausgeber (T-094): jedes Buch hängt danach an „Official", keines
         der drei an einer Blocklist-Kategorie; niemand verliert etwas. */
      writeFileSync(join(ordner, name094), readFileSync(join(DIST, '..', 'migrations', '037_ebenen_herausgeber.sql'), 'utf8'));
      const vor094 = await sicht();
      await migrate(pool, { env: {} }, ordner);
      const nach094 = await sicht();
      const teil = (id) => (nach094.alle.get(id)?.relations ?? []).filter((r) => r.type === 'partOf').map((r) => r.to);
      pruefe(
        'Herausgeber: jedes Buch hängt an Official, die Kategorie bleibt',
        BUECHER.every((b) => teil(b).includes('e5_publisher_official')) && teil('e5_book_phb').includes('e5_group_core')
          && nach094.alle.get('e5_publisher_official')?.components['Layer']?.groupBy === 'publisher'
          && !nach094.alle.has('e5_publisher_partnered') && !nach094.alle.has('e5_group_comedy'),
        BUECHER.map((b) => `${b}→${teil(b).join('+')}`).join(', '),
      );
      const verloren094 = [...vor094.je].flatMap(([k, ids]) => [...ids].filter((id) => !nach094.je.get(k)?.has(id)).map((id) => `${k}: ${id}`));
      pruefe('Herausgeber: keine Kampagne verliert einen Artikel', verloren094.length === 0, verloren094.join(', '));
      const z094 = (await (await get(admin, '/api/campaigns/camp_probe_c/layers')).json()).layers;
      pruefe(
        'Herausgeber: die Kampagnenseite nennt ihn, und eigene Ebenen sind Homebrew',
        z094.some((l) => l.id === 'e5_book_phb' && l.publisher === 'Official') && z094.some((l) => l.id === 'e5_publisher_official' && l.groupBy === 'publisher')
          && z094.some((l) => l.id === 'ly_probe_a' && l.publisher === 'Homebrew'),
        JSON.stringify(z094.map((l) => [l.id, l.publisher, l.groupBy])),
      );
      const q094 = await (await get(admin, '/api/sources')).json();
      pruefe('Herausgeber: je Kürzel genannt', q094.publishers?.PHB === 'Official', JSON.stringify(q094.publishers));
      /* Ein zweiter Lauf hängt nichts doppelt. */
      await pool.query('delete from schema_migrations where name = $1', [name094]);
      await migrate(pool, { env: {} }, ordner);
      pruefe('Herausgeber: ein zweiter Lauf hängt nichts doppelt', (await sicht()).alle.get('e5_book_phb')?.relations?.filter((r) => r.to === 'e5_publisher_official').length === 1, '');

      /* „D&D 5e (2014)" als Gruppe (T-109): Runde C schaltet nur noch die
         alte Ebene und die geteilte ly_probe_a auf — also ist die alte ihre
         Ebene, und dort liegt eine eigene Sitzung. Danach: eine eigene
         Kampagnenebene mit der Sitzung, die Aktionsart in „no book given",
         die alte Ebene eine Gruppe der Bücher, und die Bücher, die vorher
         nicht im Spiel waren, abgeschaltet. Niemand verliert etwas. */
      const nurAlt = await fetch(`${BASE}/api/campaigns/camp_probe_c/layers`, {
        method: 'PUT', headers: { cookie: admin, 'content-type': 'application/json' },
        body: JSON.stringify({ layers: ['ly_probe_a', ALT], off: [] }),
      });
      pruefe('2014 als Gruppe: Runde C schaltet nur die alte Ebene auf', nurAlt.ok, `${nurAlt.status} ${await nurAlt.text()}`);
      const sitzung = { id: 'st_probe_t109', name: 'Probe Session 0', interfaces: ['Session'], components: ident('Probe Session 0', 'session-0909'), relations: [{ id: 'st_probe_t109~in', type: 'inLayer', to: ALT, props: {} }] };
      const rs = await put(admin, sitzung);
      pruefe('2014 als Gruppe: eigene Sitzung in der alten Ebene', rs.ok, `${rs.status} ${await rs.text()}`);
      writeFileSync(join(ordner, name109), readFileSync(join(DIST, '..', 'migrations', '044_ebene_2014_als_gruppe.sql'), 'utf8'));
      const vor109 = await sicht();
      const gemeldet109 = [];
      const logAlt109 = console.log;
      console.log = (...a) => gemeldet109.push(a.join(' '));
      try {
        await migrate(pool, { env: {} }, ordner);
      } finally {
        console.log = logAlt109;
      }
      const nach109 = await sicht();
      const verloren109 = [...vor109.je].flatMap(([k, ids]) => [...ids].filter((id) => !nach109.je.get(k)?.has(id)).map((id) => `${k}: ${id}`));
      const dazu109 = [...nach109.je].flatMap(([k, ids]) => [...ids].filter((id) => !vor109.je.get(k)?.has(id) && !/^(ly_camp_probe_c|e5_unsourced_2014)$/.test(id)).map((id) => `${k}: ${id}`));
      pruefe('2014 als Gruppe: keine Kampagne verliert oder gewinnt einen Artikel', verloren109.length === 0 && dazu109.length === 0 && vor109.je.get('camp_probe_c')?.has('st_probe_t109'), [...verloren109, ...dazu109].join(', '));
      const ziel109 = (id) => (nach109.alle.get(id)?.relations ?? []).find((r) => r.type === 'inLayer')?.to;
      pruefe(
        '2014 als Gruppe: die Sitzung in der neuen Kampagnenebene, die Aktionsart ohne Buch',
        ziel109('st_probe_t109') === 'ly_camp_probe_c' && ziel109('e5_probe_a1') === 'e5_unsourced_2014',
        `${ziel109('st_probe_t109')} ${ziel109('e5_probe_a1')}`,
      );
      const teil109 = (id) => (nach109.alle.get(id)?.relations ?? []).filter((r) => r.type === 'partOf').map((r) => r.to);
      pruefe(
        '2014 als Gruppe: die alte Ebene ist eine Gruppe der Bücher und der Ebene ohne Buch',
        nach109.alle.get(ALT)?.components['Layer']?.kind === 'group' && BUECHER.every((b) => teil109(b).includes(ALT))
          && teil109('e5_unsourced_2014').includes(ALT) && teil109('e5_unsourced_2014').includes('e5_publisher_official'),
        JSON.stringify(BUECHER.map((b) => teil109(b))),
      );
      const aus109 = (nach109.alle.get('camp_probe_c')?.relations ?? []).filter((r) => r.type === 'activates' && r.props?.mode === 'off').map((r) => r.to).sort();
      pruefe('2014 als Gruppe: was vorher nicht im Spiel war, ist abgeschaltet', JSON.stringify(aus109) === JSON.stringify([...BUECHER].sort()), aus109.join(', '));
      pruefe('2014 als Gruppe: gemeldet', gemeldet109.some((m) => /D&D 5e \(2014\) ist eine Gruppe/.test(m)), gemeldet109.join(' | '));
      const z109 = (await (await get(admin, '/api/campaigns/camp_probe_c/layers')).json()).layers;
      pruefe(
        '2014 als Gruppe: Herausgeber — ohne Buch offiziell, die Kampagnenebene Homebrew, die Gruppe keiner',
        z109.some((l) => l.id === 'e5_unsourced_2014' && l.publisher === 'Official') && z109.some((l) => l.id === 'ly_camp_probe_c' && l.publisher === 'Homebrew')
          && z109.some((l) => l.id === ALT && l.publisher === '' && l.groupBy === 'category'),
        JSON.stringify(z109.map((l) => [l.id, l.publisher])),
      );
      await pool.query('delete from schema_migrations where name = $1', [name109]);
      await migrate(pool, { env: {} }, ordner);
      const noch109 = await sicht();
      pruefe('2014 als Gruppe: ein zweiter Lauf tut nichts',
        !noch109.alle.has('ly_camp_probe_c_2') && ziel109('st_probe_t109') === (noch109.alle.get('st_probe_t109')?.relations ?? []).find((r) => r.type === 'inLayer')?.to
          && (noch109.alle.get('camp_probe_c')?.relations ?? []).filter((r) => r.props?.mode === 'off').length === aus109.length, '');
    } finally {
      await pool.query('delete from entity where id = any($1)', [[...probe.map((e) => e.id), ...BUECHER, 'st_probe_t109', 'ly_camp_probe_c', 'e5_unsourced_2014']]);
      await pool.query("delete from entity where id like 'e5_group_%' or id like 'e5_publisher_%'");
      await pool.query('delete from schema_migrations where name = any($1)', [[name, name088, name094, name109]]);
      await pool.end();
      rmSync(ordner, { recursive: true, force: true });
    }
  }

  /* Abenteuer als Ebene (T-082): die Migration macht aus einer Buchebene mit
     der Marke `adventure` eine Ebene `kind: adventure` und lässt die übrigen
     Bücher, wie sie sind. Danach, gegen die echte Datenbank: „Adapt" legt
     eine Fassung in die Ebene der Kampagne, und das Original öffnen heisst,
     die Fassung zu bekommen. */
  {
    const { migrate } = await import(join(DIST, 'migrate.js'));
    const { PgRepository } = await import(join(DIST, 'repo.pg.js'));
    const { default: pg } = await import('pg');
    const pool = new pg.Pool({ connectionString: process.env['DATABASE_URL'] });
    const repo = new PgRepository(pool);
    const ebene = (id, name, tag, n) => ({
      id, name, interfaces: ['Layer'],
      components: { ...ident(name, `layer-09${n}`), Layer: { kind: 'book', order: 0, version: '2014' }, Tags: { tags: [tag] } },
      relations: [],
    });
    const probe = [
      ebene('e5_book_t082a', 'Probe Adventure', 'adventure', 81),
      ebene('e5_book_t082b', 'Probe Sourcebook', 'sourcebook', 82),
      { id: 'st_probe_t082', name: 'Probe Chapter', interfaces: ['Story'], components: { ...ident('Probe Chapter', 'story-0981'), Story: { kind: 'chapter' } }, relations: [{ id: 'st_probe_t082~in', type: 'inLayer', to: 'e5_book_t082a', props: {} }] },
      /* Eine Karte am Kapitel selbst: Migration 041 gibt ihr eine Szene (E-026). */
      {
        id: 'e5_probe_t097_karte', name: 'Probe Map', interfaces: ['Map'], components: ident('Probe Map', 'map-0981'),
        relations: [{ id: 'e5_probe_t097_karte~in', type: 'inLayer', to: 'e5_book_t082a', props: {} }, { id: 'e5_probe_t097_karte~of', type: 'mapOf', to: 'st_probe_t082', props: {} }],
      },
    ];
    const name097 = 'zzz_durchstich_kapitel_als_arc.sql';
    const ordner = mkdtempSync(join(tmpdir(), 'durchstich-abenteuer-'));
    const name = 'zzz_durchstich_abenteuer_ebene.sql';
    let fassung = '';
    try {
      for (const e of probe) {
        const r = await put(admin, e);
        pruefe(`Probeartikel ${e.id}`, r.ok, `${r.status} ${await r.text()}`);
      }
      const { readFileSync } = await import('node:fs');
      writeFileSync(join(ordner, name), readFileSync(join(DIST, '..', 'migrations', '029_abenteuer_ebene.sql'), 'utf8'));
      await migrate(pool, { env: {} }, ordner);
      const art = async (id) => (await repo.getEntity(id))?.components['Layer']?.kind;
      pruefe('Abenteuer als Ebene: die Migration setzt kind adventure, ein Quellenbuch bleibt book',
        (await art('e5_book_t082a')) === 'adventure' && (await art('e5_book_t082b')) === 'book',
        `${await art('e5_book_t082a')} / ${await art('e5_book_t082b')}`);
      /* Kapitel als Arc (T-097, E-026): Migration 041 an denselben Proben. */
      rmSync(join(ordner, name));
      writeFileSync(join(ordner, name097), readFileSync(join(DIST, '..', 'migrations', '041_kapitel_als_arc.sql'), 'utf8'));
      await migrate(pool, { env: {} }, ordner);
      const kap = await repo.getEntity('st_probe_t082');
      /* Das Probekapitel ist selbst angelegt (keine e5_-Id): das Wort bleibt. */
      pruefe('Kapitel als Arc: die Migration macht aus der Story mit kind chapter einen Arc',
        JSON.stringify(kap?.interfaces) === '["Arc"]' && kap?.components['Story']?.kind === 'chapter', JSON.stringify(kap?.components));
      const kartenSzene = await repo.getEntity('e5_probe_t097_karte_scene');
      const karte = await repo.getEntity('e5_probe_t097_karte');
      pruefe('Kapitel als Arc: die Karte am Kapitel bekommt ihre Szene',
        kartenSzene?.interfaces?.[0] === 'Scene' && kartenSzene.relations?.some((r) => r.type === 'partOf' && r.to === 'st_probe_t082')
          && karte?.relations?.some((r) => r.type === 'mapOf' && r.to === 'e5_probe_t097_karte_scene'),
        JSON.stringify(kartenSzene?.relations));
      /* Die laufende Kampagne schaltet das Abenteuer auf; ihre eigene Ebene hat sie schon. */
      const k = await (await get(admin, '/api/campaigns/camp_probe_a/layers')).json();
      const stapel = [...k.layers.filter((l) => l.active).map((l) => l.id), 'e5_book_t082a'];
      stapel.sort((a, b) => (a === 'e5_book_t082a' ? -1 : b === 'e5_book_t082a' ? 1 : 0));
      const gesetzt = await fetch(`${BASE}/api/campaigns/camp_probe_a/layers`, {
        method: 'PUT', headers: { cookie: admin, 'content-type': 'application/json' }, body: JSON.stringify({ layers: stapel }),
      });
      pruefe('Abenteuer als Ebene: aufgeschaltet', gesetzt.ok, `${gesetzt.status} ${await gesetzt.text()}`);
      const g = await (await get(admin, '/api/campaigns/camp_probe_a/layers')).json();
      pruefe('Abenteuer als Ebene: steht unter den Abenteuern',
        g.layers.some((l) => l.id === 'e5_book_t082a' && l.kind === 'adventure' && l.active), JSON.stringify(g.layers.map((l) => [l.id, l.kind, l.active])));
      const a = await fetch(`${BASE}/api/entities/st_probe_t082/adapt`, { method: 'POST', headers: { cookie: admin } });
      const aj = await a.json();
      fassung = aj.id ?? '';
      pruefe('Anpassen: eine Fassung in der Ebene der Kampagne', a.status === 201 && !!fassung, `${a.status} ${JSON.stringify(aj)}`);
      const offen = await (await get(admin, '/api/entities/st_probe_t082')).json();
      pruefe('Anpassen: das Original öffnen heisst, die Fassung zu bekommen', offen.id === fassung, offen.id);
      const original = await repo.getEntity('st_probe_t082');
      pruefe('Anpassen: das Original bleibt unberührt', (original?.relations ?? []).length === 1, JSON.stringify(original?.relations));
      /* Die Leseansicht (T-091): das Kapitel steht im Inhaltsverzeichnis, als
         Fassung der Kampagne, und der Lesestand liegt in `reading_position`. */
      const buch = await (await get(admin, '/api/read/e5_book_t082a')).json();
      pruefe('Leseansicht: das Kapitel als Fassung im Inhaltsverzeichnis',
        buch.toc?.some((z) => z.id === 'st_probe_t082' && z.article === fassung), JSON.stringify(buch));
      const merk = await fetch(`${BASE}/api/read/e5_book_t082a/position`, {
        method: 'PUT', headers: { cookie: admin, 'content-type': 'application/json' }, body: JSON.stringify({ id: 'st_probe_t082' }),
      });
      pruefe('Leseansicht: Lesestand gemerkt', merk.status === 204, `${merk.status} ${await merk.text()}`);
      const wieder = await (await get(admin, '/api/read/e5_book_t082a')).json();
      pruefe('Leseansicht: Lesestand gelesen', wieder.position === 'st_probe_t082', String(wieder.position));
      /* In die Geschichte holen (E-026): das Kapitel mit Szene und Karte in die Kampagne —
         die Fassung des Kapitels gibt es schon und wird nur umgehängt. */
      const t = await fetch(`${BASE}/api/entities/st_probe_t082/take`, {
        method: 'POST', headers: { cookie: admin, 'content-type': 'application/json' }, body: JSON.stringify({ into: 'camp_probe_a' }),
      });
      const tj = await t.json();
      pruefe('Holen: Kapitel samt Szene und Karte', t.status === 201 && tj.id === fassung && tj.taken === 3 && tj.created === 2, `${t.status} ${JSON.stringify(tj)}`);
      const genommen = await repo.getEntity(fassung);
      pruefe('Holen: das Kapitel hängt an der Kampagne',
        JSON.stringify(genommen?.relations?.filter((r) => r.type === 'partOf').map((r) => r.to)) === '["camp_probe_a"]', JSON.stringify(genommen?.relations));
      /* Zurück zum alten Stapel — die übrigen Prüfungen rechnen mit ihm. */
      await fetch(`${BASE}/api/campaigns/camp_probe_a/layers`, {
        method: 'PUT', headers: { cookie: admin, 'content-type': 'application/json' }, body: JSON.stringify({ layers: stapel.filter((x) => x !== 'e5_book_t082a') }),
      });
    } finally {
      const ids = [...probe.map((e) => e.id), 'e5_probe_t097_karte_scene'];
      await pool.query(`delete from entity where id in (select from_id from relation where type = 'overrides' and to_id = any($1))`, [ids]);
      await pool.query('delete from entity where id = any($1)', [[...ids, ...(fassung ? [fassung] : [])]]);
      await pool.query('delete from schema_migrations where name = $1', [name097]);
      await pool.query('delete from reading_position where layer_id = $1', ['e5_book_t082a']);
      await pool.query('delete from schema_migrations where name = $1', [name]);
      await pool.end();
      rmSync(ordner, { recursive: true, force: true });
    }
  }

  /* ------------------------------------ Stücke als Instanz (T-150) */
  {
    /* Migration 067 macht aus jeder Kante `holds` auf einen Gegenstand ein
       eigenes Stück (Instanz): Menge und Reservierung bleiben an der Kante,
       die Sichtbarkeit kommt mit, ein Behälter mit eigenem Inhalt bleibt. */
    const { migrate } = await import(join(DIST, 'migrate.js'));
    const { PgRepository } = await import(join(DIST, 'repo.pg.js'));
    const { default: pg } = await import('pg');
    const { readFileSync } = await import('node:fs');
    const pool = new pg.Pool({ connectionString: process.env['DATABASE_URL'] });
    const repo = new PgRepository(pool);
    const probe = [
      { id: 'it_probe_t150', name: 'Probe Torch', interfaces: ['Item'], components: ident('Probe Torch', 'item-0981'), relations: [] },
      { id: 'it_probe_t150_geheim', name: 'Probe Idol', interfaces: ['Item'], components: { ...ident('Probe Idol', 'item-0982'), Visibility: { audience: 'gm' } }, relations: [] },
      { id: 'inv_probe_t150_sack', name: 'Probe Sack inventory', interfaces: ['Inventory'], components: ident('Probe Sack inventory', 'inventory-0981'), relations: [] },
      { id: 'it_probe_t150_sack', name: 'Probe Sack', interfaces: ['Item'], components: ident('Probe Sack', 'item-0983'), relations: [{ id: 'it_probe_t150_sack~c', type: 'carries', to: 'inv_probe_t150_sack', props: {} }] },
      {
        id: 'inv_probe_t150', name: 'Probe pack', interfaces: ['Inventory'], components: ident('Probe pack', 'inventory-0982'),
        relations: [
          { id: 'inv_probe_t150~h1', type: 'holds', to: 'it_probe_t150', props: { qty: 3, tier: 'pack', reservedFor: 'order_probe_t150' } },
          { id: 'inv_probe_t150~h2', type: 'holds', to: 'it_probe_t150_geheim', props: { qty: 1, tier: 'pack' } },
          { id: 'inv_probe_t150~h3', type: 'holds', to: 'it_probe_t150_sack', props: { qty: 1, tier: 'pack' } },
        ],
      },
    ];
    const ordner = mkdtempSync(join(tmpdir(), 'durchstich-stuecke-'));
    const name = 'zzz_durchstich_stuecke_als_instanz.sql';
    let stuecke = [];
    try {
      for (const e of probe) {
        const r = await put(admin, e);
        pruefe(`Probeartikel ${e.id}`, r.ok, `${r.status} ${await r.text()}`);
      }
      writeFileSync(join(ordner, name), readFileSync(join(DIST, '..', 'migrations', '067_stuecke_als_instanz.sql'), 'utf8'));
      await migrate(pool, { env: {} }, ordner);
      const inv = await repo.getEntity('inv_probe_t150');
      const h = (k) => inv?.relations?.find((r) => r.id === `inv_probe_t150~${k}`);
      stuecke = ['h1', 'h2'].map((k) => h(k)?.to).filter((x) => x && !x.startsWith('it_probe'));
      const fackel = h('h1') ? await repo.getEntity(h('h1').to) : null;
      const idol = h('h2') ? await repo.getEntity(h('h2').to) : null;
      pruefe('Stücke als Instanz: die Kante zeigt auf ein Stück der Vorlage, Menge und Reservierung bleiben',
        stuecke.length === 2 && fackel?.relations?.some((r) => r.type === 'instanceOf' && r.to === 'it_probe_t150')
          && h('h1')?.props?.qty === 3 && h('h1')?.props?.reservedFor === 'order_probe_t150'
          && fackel?.components?.['Status']?.status === 'ready' && /^item-\d{4}$/.test(fackel?.components?.['Identity']?.id ?? ''),
        JSON.stringify({ rel: inv?.relations, fackel }));
      pruefe('Stücke als Instanz: die Sichtbarkeit kommt mit',
        idol?.components?.['Visibility']?.audience === 'gm', JSON.stringify(idol?.components));
      pruefe('Stücke als Instanz: ein Behälter mit eigenem Inhalt bleibt', h('h3')?.to === 'it_probe_t150_sack', JSON.stringify(h('h3')));
    } finally {
      await pool.query('delete from entity where id = any($1)', [[...stuecke, ...probe.map((e) => e.id)]]);
      await pool.query('delete from schema_migrations where name = $1', [name]);
      await pool.end();
      rmSync(ordner, { recursive: true, force: true });
    }
  }

  /* ------------------------------------ Bücher aus Teilen (T-108) */
  {
    /* Migration 043 bringt die Arten und die Kanteneigenschaft in ein
       bestehendes Register: hier zuerst wieder heraus, dann die Migration
       unter einem Probenamen. Danach ein Kapitel mit zwei Teilen über die
       Routen, und die Leseansicht liest es in der Reihenfolge der Ränge. */
    const { migrate } = await import(join(DIST, 'migrate.js'));
    const { default: pg } = await import('pg');
    const { readFileSync } = await import('node:fs');
    const pool = new pg.Pool({ connectionString: process.env['DATABASE_URL'] });
    const ordner = mkdtempSync(join(tmpdir(), 'durchstich-teile-'));
    const name = 'zzz_durchstich_buecher_aus_teilen.sql';
    let nr = 0;
    const id = (n) => ({ Identity: { name: n, id: `t108-${String((nr += 1)).padStart(4, '0')}`, aliases: [] } });
    const ids = ['ly_probe_t108', 'ch_probe_t108', 'pa_probe_t108', 'hd_probe_t108'];
    let stapel = null;
    try {
      await pool.query(`delete from interface_def where name in ('Chapter','Heading','Paragraph','ReadAloudText','Embed')`);
      await pool.query(`delete from interface_def where name = 'BookPart'`);
      await pool.query(`delete from relation_def where type = 'chapterOf'`);
      await pool.query(`update relation_def set props = '{}'::jsonb, from_ifaces = array_remove(array_remove(from_ifaces, 'Chapter'), 'BookPart'), to_ifaces = array_remove(to_ifaces, 'Chapter') where type = 'partOf'`);
      writeFileSync(join(ordner, name), readFileSync(join(DIST, '..', 'migrations', '043_buecher_aus_teilen.sql'), 'utf8'));
      await migrate(pool, { env: {} }, ordner);
      const { rows: arten } = await pool.query(`select name from interface_def where name in ('Chapter','BookPart','Heading','Paragraph','ReadAloudText','Embed') order by name`);
      const { rows: kante } = await pool.query(`select props, from_ifaces, to_ifaces from relation_def where type = 'partOf'`);
      pruefe('Bücher aus Teilen: die Migration bringt die sechs Arten',
        arten.map((r) => r.name).join() === 'BookPart,Chapter,Embed,Heading,Paragraph,ReadAloudText', JSON.stringify(arten));
      pruefe('Bücher aus Teilen: partOf trägt den Rang und nimmt Kapitel und Teile',
        kante[0]?.props?.properties?.rank?.type === 'number' && kante[0].from_ifaces.includes('BookPart') && kante[0].to_ifaces.includes('Chapter'),
        JSON.stringify(kante[0]));
      /* Die Seite liest das Register zwischengespeichert: neu starten ist
         hier nicht nötig, die Routen fragen das Repository je Anfrage. */
      const probe = [
        { id: 'ly_probe_t108', name: 'Probe Book', interfaces: ['Layer'], components: { ...id('Probe Book'), Layer: { kind: 'book', order: 0 } }, relations: [] },
        { id: 'ch_probe_t108', name: 'Chapter 1: Probe', interfaces: ['Chapter'], components: { ...id('Chapter 1: Probe'), Chapter: { ordinal: 'Chapter 1' } }, relations: [{ id: 'ch_probe_t108~in', type: 'inLayer', to: 'ly_probe_t108', props: {} }] },
        { id: 'pa_probe_t108', name: 'Second', interfaces: ['Paragraph'], components: { ...id('Second'), Prose: { paragraph: [{ id: 'text', value: 'Second.' }] } }, relations: [{ id: 'pa_probe_t108~in', type: 'inLayer', to: 'ly_probe_t108', props: {} }, { id: 'pa_probe_t108~p', type: 'partOf', to: 'ch_probe_t108', props: { rank: 2 } }] },
        { id: 'hd_probe_t108', name: 'First', interfaces: ['Heading'], components: { ...id('First'), Heading: { level: 2 } }, relations: [{ id: 'hd_probe_t108~in', type: 'inLayer', to: 'ly_probe_t108', props: {} }, { id: 'hd_probe_t108~p', type: 'partOf', to: 'ch_probe_t108', props: { rank: 1 } }] },
      ];
      for (const e of probe) {
        const r = await put(admin, e);
        pruefe(`Bücher aus Teilen: ${e.interfaces[0]} geschrieben`, r.ok, `${r.status} ${await r.text()}`);
      }
      /* Nur was die laufende Kampagne aufschaltet, ist da (E2). */
      const k = await (await get(admin, '/api/campaigns/camp_probe_a/layers')).json();
      stapel = k.layers.filter((l) => l.active).map((l) => l.id);
      const an = await fetch(`${BASE}/api/campaigns/camp_probe_a/layers`, {
        method: 'PUT', headers: { cookie: admin, 'content-type': 'application/json' }, body: JSON.stringify({ layers: ['ly_probe_t108', ...stapel] }),
      });
      pruefe('Bücher aus Teilen: das Buch aufgeschaltet', an.ok, `${an.status} ${await an.text()}`);
      const buch = await (await get(admin, '/api/read/ly_probe_t108')).json();
      pruefe('Bücher aus Teilen: die Leseansicht liest das Kapitel nach Rang, den Absatz nicht im Inhaltsverzeichnis',
        JSON.stringify((buch.toc ?? []).map((z) => z.id)) === '["ch_probe_t108","hd_probe_t108"]', JSON.stringify(buch.toc));
      const stueck = await (await get(admin, '/api/read/ly_probe_t108/unit/ch_probe_t108')).json();
      pruefe('Bücher aus Teilen: das Stück hat Überschrift und Absatz in Rangfolge',
        JSON.stringify((stueck.sections ?? []).map((x) => x.id)) === '["ch_probe_t108","hd_probe_t108","pa_probe_t108"]', JSON.stringify(stueck.sections?.map((x) => x.id)));
    } finally {
      if (stapel) {
        await fetch(`${BASE}/api/campaigns/camp_probe_a/layers`, {
          method: 'PUT', headers: { cookie: admin, 'content-type': 'application/json' }, body: JSON.stringify({ layers: stapel }),
        });
      }
      await pool.query('delete from entity where id = any($1)', [ids]);
      await pool.query('delete from schema_migrations where name = $1', [name]);
      await pool.end();
      rmSync(ordner, { recursive: true, force: true });
    }
  }

  /* ------------------------------------ Abenteuerkapitel als Teile (T-108) */
  {
    /* Migration 046 an einem geladenen Abenteuer im Stand von T-097: ein
       Arc mit Text, eine Szene mit Vorlesetext und Raum. Danach gibt es
       das Chapter, der Text steht in Teilen, und die Leseansicht liest das
       Kapitel mit Szene und Raum in Reihenfolge. */
    const { migrate } = await import(join(DIST, 'migrate.js'));
    const { PgRepository } = await import(join(DIST, 'repo.pg.js'));
    const { default: pg } = await import('pg');
    const { readFileSync } = await import('node:fs');
    const pool = new pg.Pool({ connectionString: process.env['DATABASE_URL'] });
    const repo = new PgRepository(pool);
    const ordner = mkdtempSync(join(tmpdir(), 'durchstich-abenteuer-teile-'));
    const name = 'zzz_durchstich_abenteuer_kapitel.sql';
    const L = 'e5_book_t108adv';
    const inL = (id) => ({ id: `${id}~in`, type: 'inLayer', to: L, props: {} });
    const gm = { Visibility: { audience: 'gm' } };
    const probe = [
      { id: L, name: 'Probe Adventure T108', interfaces: ['Layer'], components: { ...ident('Probe Adventure T108', 'layer-0981'), Layer: { kind: 'adventure', order: 0 } }, relations: [] },
      { id: 'e5_probe_t108_arc', name: 'Chapter 1: Probe', interfaces: ['Arc'], components: { ...ident('Chapter 1: Probe', 'arc-0981'), ...gm, Prose: { paragraph: [{ id: 'text', value: 'The chapter begins.' }] } }, relations: [inL('e5_probe_t108_arc')] },
      { id: 'e5_probe_t108_sz', name: 'Probe Cave', interfaces: ['Scene'], components: { ...ident('Probe Cave', 'scene-0981'), ...gm, Prose: { paragraph: [{ id: 'text', value: 'A [[scene-0982|room]] lies ahead.' }] }, ReadAloud: { readaloud: [{ id: 'read', value: 'Water drips.' }] } }, relations: [inL('e5_probe_t108_sz'), { id: 'e5_probe_t108_sz~p', type: 'partOf', to: 'e5_probe_t108_arc', props: {} }] },
      { id: 'e5_probe_t108_raum', name: '1. Probe Room', interfaces: ['Scene'], components: { ...ident('1. Probe Room', 'scene-0982'), ...gm }, relations: [inL('e5_probe_t108_raum'), { id: 'e5_probe_t108_raum~p', type: 'partOf', to: 'e5_probe_t108_sz', props: {} }] },
    ];
    const neu = ['e5_probe_t108_arc_chapter', 'e5_probe_t108_arc_text', 'e5_probe_t108_sz_text', 'e5_probe_t108_sz_read1'];
    let stapel = null;
    try {
      for (const e of probe) {
        const r = await put(admin, e);
        pruefe(`Abenteuer als Teile: ${e.id}`, r.ok, `${r.status} ${await r.text()}`);
      }
      writeFileSync(join(ordner, name), readFileSync(join(DIST, '..', 'migrations', '046_abenteuer_kapitel.sql'), 'utf8'));
      await migrate(pool, { env: {} }, ordner);
      const kap = await repo.getEntity('e5_probe_t108_arc_chapter');
      pruefe('Abenteuer als Teile: das Chapter steht neben dem Arc',
        kap?.interfaces?.[0] === 'Chapter' && kap.components['Identity']?.name === 'Chapter 1: Probe' && kap.components['Chapter']?.ordinal === 'Chapter 1'
          && kap.relations?.some((r) => r.type === 'chapterOf' && r.to === 'e5_probe_t108_arc') && kap.components['Visibility']?.audience === 'gm',
        JSON.stringify(kap));
      const arc = await repo.getEntity('e5_probe_t108_arc');
      const sz = await repo.getEntity('e5_probe_t108_sz');
      const raum = await repo.getEntity('e5_probe_t108_raum');
      const text = await repo.getEntity('e5_probe_t108_sz_text');
      const vor = await repo.getEntity('e5_probe_t108_sz_read1');
      pruefe('Abenteuer als Teile: der Text zieht um und geht nicht',
        !arc?.components['Prose'] && !sz?.components['Prose'] && !sz?.components['ReadAloud']
          && text?.components['Prose']?.paragraph?.[0]?.value === 'A [[scene-0982|room]] lies ahead.'
          && vor?.components['ReadAloud']?.readaloud?.[0]?.value === 'Water drips.',
        JSON.stringify({ arc: arc?.components, sz: sz?.components, text: text?.components, vor: vor?.components }));
      const rang = (e, an) => e?.relations?.find((r) => r.type === 'partOf' && r.to === an)?.props?.rank;
      pruefe('Abenteuer als Teile: Vorlesetext vor dem Text, Raum danach; die Szene im Chapter',
        rang(vor, 'e5_probe_t108_sz') === 1 && rang(text, 'e5_probe_t108_sz') === 2 && rang(raum, 'e5_probe_t108_sz') === 1001
          && rang(sz, 'e5_probe_t108_arc_chapter') === 1001 && rang(await repo.getEntity('e5_probe_t108_arc_text'), 'e5_probe_t108_arc_chapter') === 1
          && sz?.relations?.some((r) => r.type === 'partOf' && r.to === 'e5_probe_t108_arc'),
        JSON.stringify({ sz: sz?.relations, raum: raum?.relations }));
      /* Ein zweiter Lauf legt nichts doppelt an. */
      await pool.query('delete from schema_migrations where name = $1', [name]);
      await migrate(pool, { env: {} }, ordner);
      const { rows } = await pool.query(`select count(*)::int as n from entity where id like 'e5\\_probe\\_t108\\_%'`);
      pruefe('Abenteuer als Teile: ein zweiter Lauf ändert nichts', rows[0].n === probe.length - 1 + neu.length, String(rows[0].n));
      const k = await (await get(admin, '/api/campaigns/camp_probe_a/layers')).json();
      stapel = k.layers.filter((l) => l.active).map((l) => l.id);
      await fetch(`${BASE}/api/campaigns/camp_probe_a/layers`, {
        method: 'PUT', headers: { cookie: admin, 'content-type': 'application/json' }, body: JSON.stringify({ layers: [L, ...stapel] }),
      });
      const buch = await (await get(admin, `/api/read/${L}`)).json();
      pruefe('Abenteuer als Teile: die Leseansicht liest Chapter, Szene und Raum',
        JSON.stringify((buch.toc ?? []).map((z) => z.id)) === '["e5_probe_t108_arc_chapter","e5_probe_t108_sz","e5_probe_t108_raum"]', JSON.stringify(buch.toc));
    } finally {
      if (stapel) {
        await fetch(`${BASE}/api/campaigns/camp_probe_a/layers`, {
          method: 'PUT', headers: { cookie: admin, 'content-type': 'application/json' }, body: JSON.stringify({ layers: stapel }),
        });
      }
      await pool.query('delete from entity where id = any($1)', [[...probe.map((e) => e.id), ...neu]]);
      await pool.query('delete from schema_migrations where name = $1', [name]);
      await pool.end();
      rmSync(ordner, { recursive: true, force: true });
    }
  }

  /* ------------------------------------ Teile auf der Artikelseite (T-108) */
  {
    /* Migration 047 setzt das Element `parts` in die Grundanordnung — nur
       einmal und nur hinter der Prosa. */
    const { migrate } = await import(join(DIST, 'migrate.js'));
    const { default: pg } = await import('pg');
    const { readFileSync } = await import('node:fs');
    const pool = new pg.Pool({ connectionString: process.env['DATABASE_URL'] });
    const ordner = mkdtempSync(join(tmpdir(), 'durchstich-teile-seite-'));
    const name = 'zzz_durchstich_teile_auf_der_artikelseite.sql';
    try {
      await pool.query(`update view_def set config = jsonb_set(config, '{layout}', (select coalesce(jsonb_agg(x), '[]'::jsonb) from jsonb_array_elements(config->'layout') x where x->>'el' <> 'parts')) where key = 'full'`);
      writeFileSync(join(ordner, name), readFileSync(join(DIST, '..', 'migrations', '047_teile_auf_der_artikelseite.sql'), 'utf8'));
      await migrate(pool, { env: {} }, ordner);
      await pool.query('delete from schema_migrations where name = $1', [name]);
      await migrate(pool, { env: {} }, ordner);
      const { rows } = await pool.query(`select jsonb_path_query_array(config, '$.layout[*].id') as ids from view_def where key = 'full'`);
      const ids = rows[0]?.ids ?? [];
      pruefe('Teile auf der Artikelseite: parts steht einmal hinter der Prosa',
        ids.filter((x) => x === 'l-parts').length === 1 && ids.indexOf('l-parts') === ids.indexOf('l-b') + 1, JSON.stringify(ids));
    } finally {
      await pool.query('delete from schema_migrations where name = $1', [name]);
      await pool.end();
      rmSync(ordner, { recursive: true, force: true });
    }
  }

  /* ------------------------------------ Vorschaubild in der Übersicht (T-114) */
  {
    /* Migration 053 setzt `image` vorne in die Übersicht — in die
       Grundanordnung und in die der Kreatur —, einmal, auch wenn sie
       zweimal läuft; eine Art ohne eigene Übersicht bleibt, wie sie ist. */
    const { migrate } = await import(join(DIST, 'migrate.js'));
    const { default: pg } = await import('pg');
    const { readFileSync } = await import('node:fs');
    const pool = new pg.Pool({ connectionString: process.env['DATABASE_URL'] });
    const ordner = mkdtempSync(join(tmpdir(), 'durchstich-vorschaubild-'));
    const name = 'zzz_durchstich_vorschaubild.sql';
    const ohneBild = (pfad) => `(select coalesce(jsonb_agg(x), '[]'::jsonb) from jsonb_array_elements(${pfad}) x where x->>'el' <> 'image')`;
    try {
      await pool.query(`update view_def set config = jsonb_set(config, '{layout}', ${ohneBild("config->'layout'")}) where key = 'overview'`);
      await pool.query(`update interface_def set views = jsonb_set(views, '{overview}', ${ohneBild("views->'overview'")}) where name = 'Creature'`);
      writeFileSync(join(ordner, name), readFileSync(join(DIST, '..', 'migrations', '053_vorschaubild_in_der_uebersicht.sql'), 'utf8'));
      await migrate(pool, { env: {} }, ordner);
      await pool.query('delete from schema_migrations where name = $1', [name]);
      await migrate(pool, { env: {} }, ordner);
      const v = (await pool.query(`select jsonb_path_query_array(config, '$.layout[*].el') as els from view_def where key = 'overview'`)).rows[0]?.els ?? [];
      const c = (await pool.query(`select jsonb_path_query_array(views, '$.overview[*].el') as els from interface_def where name = 'Creature'`)).rows[0]?.els ?? [];
      pruefe('Vorschaubild: image steht einmal vorne in der Übersicht und in der der Kreatur',
        v[0] === 'image' && v.filter((x) => x === 'image').length === 1 && c[0] === 'image' && c.filter((x) => x === 'image').length === 1,
        JSON.stringify({ v, c }));
    } finally {
      await pool.query('delete from schema_migrations where name = $1', [name]);
      await pool.end();
      rmSync(ordner, { recursive: true, force: true });
    }
  }

  /* ------------------------------------ Talente wirken Zauber (T-089) */
  {
    /* Migration 049 nimmt `Feat` an `casts` dazu — einmal, auch wenn sie
       zweimal läuft —, und danach nimmt die Prüfung eine Kante vom Talent. */
    const { migrate } = await import(join(DIST, 'migrate.js'));
    const { default: pg } = await import('pg');
    const { readFileSync } = await import('node:fs');
    const pool = new pg.Pool({ connectionString: process.env['DATABASE_URL'] });
    const ordner = mkdtempSync(join(tmpdir(), 'durchstich-talentzauber-'));
    const name = 'zzz_durchstich_talente_wirken_zauber.sql';
    try {
      await pool.query(`update relation_def set from_ifaces = array_remove(from_ifaces, 'Feat') where type = 'casts'`);
      writeFileSync(join(ordner, name), readFileSync(join(DIST, '..', 'migrations', '049_talente_wirken_zauber.sql'), 'utf8'));
      await migrate(pool, { env: {} }, ordner);
      await pool.query('delete from schema_migrations where name = $1', [name]);
      await migrate(pool, { env: {} }, ordner);
      const { rows } = await pool.query(`select from_ifaces from relation_def where type = 'casts'`);
      const von = rows[0]?.from_ifaces ?? [];
      pruefe('Talentzauber: casts nimmt Feat genau einmal', von.filter((x) => x === 'Feat').length === 1 && von.includes('Ancestry'), JSON.stringify(von));
    } finally {
      await pool.query('delete from schema_migrations where name = $1', [name]);
      await pool.end();
      rmSync(ordner, { recursive: true, force: true });
    }
  }

  /* ------------------------------------ Schreibrechte je Ebene (T-098) */
  {
    /* `app_user_layer` gibt es nur in Postgres: eine eigene Ebene anlegen,
       aufschalten, darin anlegen, jemanden dazunehmen — und die Leitung
       schreibt die Ebene ihrer Runde, nicht die eigene einer Spielerin. */
    const spielerin = await anmelden('probe-spiel');
    const mit = await anmelden('probe-mit');
    const leit = await anmelden('probe-leitung');
    const post = (keks, pfad, body) =>
      fetch(`${BASE}${pfad}`, { method: 'POST', headers: { ...json, cookie: keks }, body: JSON.stringify(body ?? {}) });
    const umbenannt = (e, n) => ({ ...e, name: n, components: { ...e.components, Identity: { ...e.components.Identity, name: n } } });
    const rN = await post(spielerin, '/api/layers', { name: 'Probe eigene Ebene' });
    const eigen = rN.ok ? (await rN.json()).id : '';
    pruefe('Ebenen: eine eigene anlegen', rN.status === 201 && !!eigen, String(rN.status));
    let ort = null;
    try {
      const mine = await (await get(spielerin, '/api/layers/mine')).json();
      pruefe('Ebenen: sie besitzt sie, noch nicht im Spiel', mine.layers?.some((l) => l.id === eigen && l.owner && !l.inPlay), JSON.stringify(mine).slice(0, 300));
      const rA = await post(leit, `/api/campaigns/camp_probe_a/layers/${eigen}`);
      pruefe('Ebenen: die Leitung schaltet sie auf', rA.ok, String(rA.status));
      const leitMine = await (await get(leit, '/api/layers/mine')).json();
      pruefe('Ebenen: die Leitung schreibt die Ebene ihrer Runde, nicht die eigene', JSON.stringify(leitMine.layers?.map((l) => l.id)) === '["ly_probe_a"]', JSON.stringify(leitMine).slice(0, 300));
      const rO = await post(spielerin, '/api/entities', { type: 'Place', name: 'Probe in eigener Ebene', relations: [{ type: 'inLayer', to: eigen }] });
      ort = rO.ok ? await rO.json() : null;
      pruefe('Ebenen: angelegt in der eigenen Ebene', rO.status === 201 && ort?.relations?.some((r) => r.type === 'inLayer' && r.to === eigen), `${rO.status} ${JSON.stringify(ort).slice(0, 200)}`);
      if (ort) {
        delete ort.refs;
        pruefe('Ebenen: ein Mitspieler schreibt darin nicht', (await put(mit, umbenannt(ort, 'Probe X'))).status === 403);
        const rE = await post(spielerin, `/api/layers/${eigen}/editors`, { name: 'probe-mit' });
        pruefe('Ebenen: sie nimmt ihn dazu', rE.status === 201, `${rE.status} ${(await rE.text()).slice(0, 200)}`);
        const rM = await put(mit, umbenannt(ort, 'Probe, von ihm'));
        pruefe('Ebenen: jetzt schreibt er darin', rM.ok, `${rM.status} ${(await rM.text()).slice(0, 200)}`);
      }
    } finally {
      const stapel = await (await get(admin, '/api/campaigns/camp_probe_a/layers')).json();
      await fetch(`${BASE}/api/campaigns/camp_probe_a/layers`, {
        method: 'PUT', headers: { ...json, cookie: admin },
        body: JSON.stringify({ layers: (stapel.layers ?? []).filter((l) => l.active && l.id !== eigen).map((l) => l.id) }),
      });
      if (ort) await fetch(`${BASE}/api/entities/${ort.id}`, { method: 'DELETE', headers: { cookie: admin } });
      if (eigen) {
        const rW = await fetch(`${BASE}/api/entities/${eigen}`, { method: 'DELETE', headers: { cookie: admin } });
        pruefe('Ebenen: die eigene wieder weg', rW.ok, String(rW.status));
      }
    }
  }

  /* ------------------------------------ Gruppe je Kampagne (T-100) */
  {
    /* Eine neue Kampagne bringt ihre Gruppe mit, in ihrer Ebene; und
       Migration 041 noch einmal unter einem Probenamen: Runde A und B
       bekommen je eine, die Figur der Spielerin kommt in die von Runde A. */
    const { migrate } = await import(join(DIST, 'migrate.js'));
    const { PgRepository } = await import(join(DIST, 'repo.pg.js'));
    const { default: pg } = await import('pg');
    const { readFileSync } = await import('node:fs');
    const pool = new pg.Pool({ connectionString: process.env['DATABASE_URL'] });
    const repo = new PgRepository(pool);
    const ordner = mkdtempSync(join(tmpdir(), 'durchstich-gruppe-'));
    const name = 'zzz_durchstich_gruppe_je_kampagne.sql';
    const weg = [];
    try {
      const rK = await fetch(`${BASE}/api/campaigns`, {
        method: 'POST', headers: { ...json, cookie: admin }, body: JSON.stringify({ name: 'Probe C' }),
      });
      const k = rK.ok ? await rK.json() : {};
      if (k.id) weg.push(`pt_${k.id}`, k.id, `ly_${k.id}`);
      const pt = k.id ? await repo.getEntity(`pt_${k.id}`) : null;
      pruefe(
        'Gruppe je Kampagne: eine neue Kampagne hat ihre Gruppe, in ihrer Ebene',
        !!pt?.relations?.some((r) => r.type === 'partyOf' && r.to === k.id) &&
          !!pt?.relations?.some((r) => r.type === 'inLayer' && r.to === `ly_${k.id}`),
        `${rK.status} ${JSON.stringify(pt ?? k).slice(0, 300)}`,
      );
      writeFileSync(join(ordner, name), readFileSync(join(DIST, '..', 'migrations', '039_gruppe_je_kampagne.sql'), 'utf8'));
      weg.push('pt_camp_probe_a', 'pt_camp_probe_b');
      await migrate(pool, { env: {} }, ordner);
      const a = await repo.getEntity('pt_camp_probe_a');
      const b = await repo.getEntity('pt_camp_probe_b');
      pruefe(
        'Gruppe je Kampagne: Migration legt sie für Runde A und B an',
        !!a?.relations?.some((r) => r.type === 'partyOf' && r.to === 'camp_probe_a') && !!b && !(await repo.getEntity(`pt_pt_${k.id}`)),
        JSON.stringify(a).slice(0, 300),
      );
      const figur = await repo.getEntity('pc_probe');
      pruefe(
        'Gruppe je Kampagne: die Figur der Spielerin steht in der Gruppe ihrer Runde',
        (figur?.relations ?? []).filter((r) => r.type === 'memberOfParty').map((r) => r.to).join(',') === 'pt_camp_probe_a',
        JSON.stringify(figur?.relations),
      );
      const leute = await (await get(await anmelden('probe-mit'), '/api/players')).json();
      const ids = (await (await get(admin, '/api/users')).json()).map((u) => u.id);
      pruefe(
        'Gruppe je Kampagne: /api/players nennt die Spielerin mit ihrer Figur, ohne Konto-Id',
        leute.players?.some((p) => p.name === 'probe-spiel' && p.actors.some((x) => x.id === 'pc_probe')) &&
          ids.length > 0 && ids.every((id) => !JSON.stringify(leute).includes(id)),
        JSON.stringify(leute).slice(0, 300),
      );
    } finally {
      /* Die Kante an der Figur geht mit: sonst zeigte die Ausfuhr danach auf
         eine Gruppe, die es nicht mehr gibt. */
      await pool.query('delete from relation where from_id = any($1) or to_id = any($1)', [weg]);
      await pool.query('delete from entity where id = any($1)', [weg]);
      await pool.query('delete from schema_migrations where name = $1', [name]);
      await pool.end();
      rmSync(ordner, { recursive: true, force: true });
    }
  }

  /* ------------------------------------------- Eigene Ausfuhr (T-077) */
  const ausfuhr = async (keks) => {
    const r = await get(keks, '/api/export?campaign=camp_probe_a');
    return { r, datei: r.ok ? await r.json() : null };
  };
  const { r: ra, datei } = await ausfuhr(leitung);
  const drin = new Set((datei?.entities ?? []).map((e) => e.id));
  pruefe(
    'Ausfuhr der Leitung: ihre Kampagne, nicht die andere',
    ra.ok && /attachment; filename="runde-a-\d{4}-\d{2}-\d{2}\.json"/.test(ra.headers.get('content-disposition') ?? '')
      && ['camp_probe_a', 'ly_probe_a', 'pc_probe', 'npc_probe_geheim', 'sb_probe_instanz'].every((id) => drin.has(id))
      && !drin.has('camp_probe_b') && !drin.has('ly_probe_b'),
    `${ra.status} ${[...drin].join(', ')}`,
  );
  const konten = await (await get(admin, '/api/users')).json();
  const text = JSON.stringify(datei);
  pruefe(
    'Ausfuhr ohne Konto-Ids',
    konten.length > 0 && konten.every((k) => !text.includes(k.id)),
    `${konten.length} Konten`,
  );
  pruefe('Ausfuhr: wer mitspielt, bekommt sie nicht', (await ausfuhr(await anmelden('probe-spiel'))).r.status === 403);
  pruefe('Ausfuhr: `layers=all` nur die Verwaltung', (await get(leitung, '/api/export?campaign=camp_probe_a&layers=all')).status === 403);

  const loeschen = async (wann, nur = null) => {
    for (const e of [...ARTIKEL].reverse().filter((x) => !nur || nur.has(x.id))) {
      const r = await fetch(`${BASE}/api/entities/${e.id}`, {
        method: 'DELETE',
        headers: { cookie: admin },
      });
      pruefe(`DELETE ${e.id}${wann}`, r.ok, String(r.status));
    }
  };
  await loeschen('');

  /* Zurück auf demselben Weg: der Ladebefehl gegen Postgres, dann noch
     einmal ausgeführt — derselbe Bestand. `createdAt`, `updatedAt` und
     `revision` setzt die Ablage beim Schreiben. */
  const datei1 = join(tmpdir(), `durchstich-ausfuhr-${process.pid}.json`);
  writeFileSync(datei1, text);
  const imp = spawnSync(process.execPath, [join(DIST, 'import.js'), datei1], { env: process.env, encoding: 'utf8' });
  pruefe('Einfuhr der Ausfuhr', imp.status === 0, `${imp.stdout}${imp.stderr}`.trim().slice(0, 600));
  const gleich = (l) =>
    JSON.stringify(
      (l ?? [])
        .map(({ updatedAt: _t, createdAt: _c, revision: _r, ...e }) => ({ ...e, relations: [...(e.relations ?? [])].sort((a, b) => a.id.localeCompare(b.id)) }))
        .sort((a, b) => a.id.localeCompare(b.id)),
      (_k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v),
    );
  const { datei: wieder2 } = await ausfuhr(leitung);
  pruefe(
    'Ausfuhr → Einfuhr → Ausfuhr: derselbe Bestand',
    gleich(wieder2?.entities) === gleich(datei?.entities),
    `${gleich(datei?.entities).slice(0, 1500)}\n→\n${gleich(wieder2?.entities).slice(0, 1500)}`,
  );
  rmSync(datei1, { force: true });
  await loeschen(' (nach der Einfuhr)', drin);
} catch (error) {
  if (String(error?.message) !== 'abgebrochen') pruefe('Durchstich', false, String(error));
} finally {
  server.kill('SIGTERM');
  rmSync(BILDER, { recursive: true, force: true });
}

if (fehler) {
  console.error(`\n${fehler} Prüfung(en) fehlgeschlagen.`);
  if (log) console.error(log.slice(-4000));
  process.exit(1);
}
console.log('\nDurchstich in Ordnung.');

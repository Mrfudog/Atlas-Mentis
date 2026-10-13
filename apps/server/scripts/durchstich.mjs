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

import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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

const server = spawn(process.execPath, [join(DIST, 'index.js')], {
  env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1' },
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
  ]) {
    const r = user('add', name, ...rest);
    pruefe(`Konto ${name}`, r.ok || /gibt es schon/.test(r.out), r.out);
  }
  pruefe('Rolle gm in Runde A', user('role', 'probe-leitung', 'camp_probe_a', 'gm').ok);
  pruefe('Rolle gm in Runde B', user('role', 'probe-fremd', 'camp_probe_b', 'gm').ok);
  pruefe('Rolle player in Runde A', user('role', 'probe-spiel', 'camp_probe_a', 'player').ok);

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

  for (const e of [...ARTIKEL].reverse()) {
    const r = await fetch(`${BASE}/api/entities/${e.id}`, {
      method: 'DELETE',
      headers: { cookie: admin },
    });
    pruefe(`DELETE ${e.id}`, r.ok, String(r.status));
  }
} catch (error) {
  if (String(error?.message) !== 'abgebrochen') pruefe('Durchstich', false, String(error));
} finally {
  server.kill('SIGTERM');
}

if (fehler) {
  console.error(`\n${fehler} Prüfung(en) fehlgeschlagen.`);
  if (log) console.error(log.slice(-4000));
  process.exit(1);
}
console.log('\nDurchstich in Ordnung.');

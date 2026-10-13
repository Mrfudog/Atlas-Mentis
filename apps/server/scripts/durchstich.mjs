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

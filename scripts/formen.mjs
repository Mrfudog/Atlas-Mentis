#!/usr/bin/env node
/**
 * **Gegenstandsformen aus Basils System** (T-142, E-125).
 *
 *   node scripts/formen.mjs plan --vault <Ordner> [--out formen-plan.json]
 *   node scripts/formen.mjs apply <plan.json> [--limit 20] [--bulk formen-bulk.json] [--log formen-log.jsonl]
 *   node scripts/formen.mjs offen [--vault <Ordner>] [--out formen-offen.json]
 *
 * `plan` liest die Notizen eines Vault-Ordners (`Homebrew System/Gegenstände`
 * im privaten Vault der Leitung, **ausserhalb** dieses Repos) und daraus
 * nur drei Schlüssel: `Formfaktor` (Zeilen, `X` belegt, `0` frei) wird
 * `Item.rows` (`#`/`.`, ohne leere Ränder), `Stapelgrösse` wird
 * `Item.stackSize`, und `aliases` (die englischen Namen) ordnen die Notiz
 * einem Gegenstand auf dev zu — nur eindeutig: trifft ein Name keinen oder
 * mehrere Gegenstände im Spiel, wird er gezählt und nicht geraten. Kein
 * Text aus dem Vault landet im Plan ausser diesen Werten; der Plan liegt
 * neben dem Vault und nicht im Repo.
 *
 * `apply` schreibt **nie in den Grundartikel**: je Gegenstand eine
 * **Ergänzung** (T-142) — ein Artikel in der Ebene „Item shapes (Basil
 * Homebrew)" mit `overrides` und `props.fields` = Form und Stapelgrösse,
 * sonst leer. Ebene und Gruppe „Basil Homebrew" legt es an, wenn sie
 * fehlen, und schaltet die Gruppe in der laufenden Kampagne auf. Die Werte
 * selbst setzt danach eine Massenänderung (`--bulk` schreibt die Datei:
 * `node scripts/atlas.mjs bulk --dry-run <datei>`, dann ohne), damit sie
 * sich wie jede rückgängig machen lässt. `--limit` für eine Probe.
 *
 * `offen` zählt Gegenstände im Spiel ohne Form, je Art und Gegenstandstyp
 * (Schritt 4: Grundlage für einen Regelvorschlag, nichts wird geschrieben).
 *
 * Wie `preise.mjs`: `ATLAS_URL`, `ATLAS_DEV_TOKEN` (in einer Cloud-Sitzung
 * setzt der Proxy das Token), Node 22, keine Abhängigkeiten.
 */

import { appendFileSync, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

if ((process.env.HTTPS_PROXY || process.env.https_proxy) && !process.env.NODE_USE_ENV_PROXY) {
  const r = spawnSync(process.execPath, process.argv.slice(1), {
    stdio: 'inherit',
    env: { ...process.env, NODE_USE_ENV_PROXY: '1', NODE_NO_WARNINGS: '1' },
  });
  process.exit(r.status ?? 1);
}

const BASE = (process.env.ATLAS_URL || 'https://dev.ttrpg.fuchsbau.io').replace(/\/+$/, '');
const TOKEN = process.env.ATLAS_DEV_TOKEN || '';
const LAYER_NAME = 'Item shapes (Basil Homebrew)';
const GROUP_NAME = 'Basil Homebrew';
/** Die Systemebene der Leitung: kommt mit in die Gruppe (Protokoll T-142). */
const SYSTEM_NAME = 'Basil Homebrew System';
const FIELDS = ['Item.rows', 'Item.stackSize'];

const args = process.argv.slice(2);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

async function api(pfad, body, method) {
  const r = await fetch(BASE + pfad, {
    method: method ?? (body === undefined ? 'GET' : 'POST'),
    headers: {
      ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method ?? (body === undefined ? 'GET' : 'POST')} ${pfad} → ${r.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

const nrOf = (e) => e?.components?.Identity?.id ?? e?.id;

// ------------------------------------------------------------ Vault lesen

/** Das Frontmatter einer Notiz: `schlüssel: wert` und Listen aus `  - eintrag`. Mehr braucht es hier nicht. */
export function frontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!m) return null;
  const out = {};
  let liste = null;
  for (const zeile of m[1].split(/\r?\n/)) {
    const eintrag = /^\s+-\s*(.*)$/.exec(zeile);
    if (eintrag && liste) {
      out[liste].push(unquote(eintrag[1]));
      continue;
    }
    const kv = /^([^\s:#][^:]*):\s*(.*)$/.exec(zeile);
    if (!kv) continue;
    const key = kv[1].trim();
    if (kv[2] === '') {
      out[key] = [];
      liste = key;
    } else {
      out[key] = unquote(kv[2]);
      liste = null;
    }
  }
  return out;
}
const unquote = (s) => String(s).trim().replace(/^(["'])(.*)\1$/, '$2');

/** Wie `shapeFromVault` in packages/model: X belegt, 0 frei, ohne leere Ränder. */
export function formAusVault(raw) {
  const zeilen = (Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(/[,\n]/) : []).map((z) => String(z).trim()).filter(Boolean);
  const netz = zeilen.map((z) => z.split('').map((c) => (c === '' || '0. _'.includes(c) ? '.' : '#')).join(''));
  const w = Math.max(0, ...netz.map((z) => z.length));
  const voll = netz.map((z) => z.padEnd(w, '.'));
  const mit = voll.map((z, i) => (z.includes('#') ? i : -1)).filter((i) => i >= 0);
  if (!mit.length) return [];
  const links = Math.min(...voll.filter((z) => z.includes('#')).map((z) => z.indexOf('#')));
  const rechts = Math.max(...voll.map((z) => z.lastIndexOf('#')));
  return voll.slice(mit[0], mit[mit.length - 1] + 1).map((z) => z.slice(links, rechts + 1));
}

function notizen(dir) {
  const out = [];
  for (const f of readdirSync(dir)) {
    if (f.startsWith('.') || f === 'Meta') continue;
    const p = join(dir, f);
    if (statSync(p).isDirectory()) out.push(...notizen(p));
    else if (f.endsWith('.md')) out.push(p);
  }
  return out;
}

function definitionen(vault) {
  const out = [];
  for (const p of notizen(vault)) {
    const fm = frontmatter(readFileSync(p, 'utf8'));
    if (!fm) continue;
    const rows = formAusVault(fm['Formfaktor']);
    const n = Math.trunc(Number(fm['Stapelgrösse']));
    const stackSize = Number.isFinite(n) && n >= 1 ? n : undefined;
    if (!rows.length && stackSize === undefined) continue;
    const aliases = (Array.isArray(fm['aliases']) ? fm['aliases'] : fm['aliases'] ? [fm['aliases']] : []).map(String).filter(Boolean);
    out.push({ datei: p, aliases, rows, stackSize });
  }
  return out;
}

// ------------------------------------------------------------ dev lesen

/** Die Arten, die Gegenstände sind: `Item` und was davon erbt. */
async function gegenstandsArten() {
  const reg = await api('/api/registry');
  const kette = (t, s = new Set()) => {
    if (s.has(t)) return s;
    s.add(t);
    for (const x of reg.interfaces[t]?.extends ?? []) kette(x, s);
    return s;
  };
  return Object.keys(reg.interfaces).filter((t) => kette(t).has('Item') && !reg.interfaces[t]?.abstract);
}

/** Die Zeilen der Liste je Art — was im Spiel steht. */
async function zeilen(types) {
  const out = [];
  for (const type of types) {
    for (let offset = 0; ; ) {
      const l = await api(`/api/list?type=${encodeURIComponent(type)}&limit=200&offset=${offset}`);
      out.push(...l.rows.filter((r) => r.type === type));
      offset += l.rows.length;
      if (!l.rows.length || offset >= l.total) break;
    }
  }
  return out;
}

async function ganze(ids) {
  const out = [];
  for (let i = 0; i < ids.length; i += 100) {
    const teil = await api(`/api/entities?ids=${ids.slice(i, i + 100).join(',')}`);
    out.push(...(Array.isArray(teil) ? teil : teil.entities ?? []));
  }
  return out;
}

const gleich = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

async function plan() {
  const vault = option('--vault');
  if (!vault || !existsSync(vault)) throw new Error('--vault <Ordner der Gegenstände im Vault>');
  const defs = definitionen(vault);
  const liste = await zeilen(await gegenstandsArten());
  const nachName = new Map();
  for (const r of liste) {
    const k = String(r.name ?? '').trim().toLowerCase();
    if (k) (nachName.get(k) ?? nachName.set(k, []).get(k)).push(r);
  }
  const zahl = { definitionen: defs.length, ohneAlias: 0, keinTreffer: 0, mehrdeutig: 0, doppelt: 0 };
  const mehrdeutig = [];
  const je = new Map();
  for (const d of defs) {
    if (!d.aliases.length) {
      zahl.ohneAlias += 1;
      continue;
    }
    const treffer = new Map();
    for (const a of d.aliases) for (const r of nachName.get(a.trim().toLowerCase()) ?? []) treffer.set(r.id, r);
    if (!treffer.size) {
      zahl.keinTreffer += 1;
      continue;
    }
    if (treffer.size > 1) {
      zahl.mehrdeutig += 1;
      mehrdeutig.push([...treffer.values()].map((r) => ({ id: r.id, name: r.name, layers: r.layers })));
      continue;
    }
    const [r] = treffer.values();
    const da = je.get(r.id);
    if (da && (!gleich(da.rows, d.rows) || da.stackSize !== d.stackSize)) {
      zahl.doppelt += 1;
      da.widerspruch = true;
      continue;
    }
    je.set(r.id, { id: r.id, name: r.name, type: r.type, rows: d.rows.length ? d.rows : undefined, stackSize: d.stackSize });
  }
  const eintraege = [...je.values()].filter((p) => !p.widerspruch);
  zahl.doppelt += [...je.values()].filter((p) => p.widerspruch).length;
  /* Was schon so dasteht (auch aus einer Ergänzung), bleibt draussen. */
  const jetzt = new Map((await ganze(eintraege.map((p) => p.id))).map((e) => [e.id, e]));
  const out = [];
  let gleichDa = 0;
  for (const p of eintraege) {
    const e = jetzt.get(p.id);
    const item = e?.components?.Item ?? {};
    p.nr = nrOf(e);
    p.before = { rows: item.rows ?? null, stackSize: item.stackSize ?? null };
    if ((p.rows === undefined || gleich(item.rows, p.rows)) && (p.stackSize === undefined || item.stackSize === p.stackSize)) {
      gleichDa += 1;
      continue;
    }
    out.push(p);
  }
  const datei = option('--out') ?? 'formen-plan.json';
  writeFileSync(datei, JSON.stringify({ zahl: { ...zahl, gleichDa, geplant: out.length }, mehrdeutig, plan: out }, null, 1));
  console.log(`${out.length} Gegenstände nach ${datei}:`, { ...zahl, gleichDa });
}

// ------------------------------------------------------------ schreiben

async function ebenen() {
  const l = await api('/api/list?type=Layer&limit=500&allLayers=1');
  return l.rows;
}

/** Gruppe und Ebene, wenn sie fehlen; die Gruppe in der laufenden Kampagne. Was geschah, kommt ins Protokoll. */
async function ebeneSicherstellen(log) {
  const alle = await ebenen();
  const finde = (n) => alle.find((r) => r.name === n);
  let gruppe = finde(GROUP_NAME);
  if (!gruppe) {
    const g = await api('/api/layers', { name: GROUP_NAME });
    const { refs: _r, ...e } = await api(`/api/entities/${g.id}`);
    e.components.Layer = { ...e.components.Layer, kind: 'group', groupBy: 'publisher' };
    await api(`/api/entities/${g.id}`, e, 'PUT');
    gruppe = { id: g.id, name: GROUP_NAME };
    log({ ebene: g.id, nr: nrOf(e), name: GROUP_NAME, was: 'neu: Gruppe (kind group, groupBy publisher)' });
  }
  const inGruppe = async (id, name) => {
    const { refs: _r, ...e } = await api(`/api/entities/${id}`);
    if ((e.relations ?? []).some((r) => r.type === 'partOf' && r.to === gruppe.id)) return;
    e.relations = [...(e.relations ?? []), { id: `${id}~partOf~${gruppe.id}`, type: 'partOf', to: gruppe.id, props: {} }];
    await api(`/api/entities/${id}`, e, 'PUT');
    log({ ebene: id, nr: nrOf(e), name, was: `partOf → ${GROUP_NAME}` });
  };
  let ebene = finde(LAYER_NAME);
  if (!ebene) {
    const l = await api('/api/layers', { name: LAYER_NAME });
    const { refs: _r, ...e } = await api(`/api/entities/${l.id}`);
    e.components.Layer = { ...e.components.Layer, kind: 'pack', order: 50, abbreviation: 'BHS-S' };
    await api(`/api/entities/${l.id}`, e, 'PUT');
    ebene = { id: l.id, name: LAYER_NAME };
    log({ ebene: l.id, nr: nrOf(e), name: LAYER_NAME, was: 'neu: Ebene (kind pack, Spezifität 50, Kürzel BHS-S)' });
  }
  await inGruppe(ebene.id, LAYER_NAME);
  const system = finde(SYSTEM_NAME);
  if (system) await inGruppe(system.id, SYSTEM_NAME);
  /* Die laufende Kampagne: die Einstellung, sonst die erste (`currentCampaign`). */
  const reg = await api('/api/registry');
  const kampagne = reg?.settings?.campaign || (await api('/api/list?type=Campaign&limit=1')).rows?.[0]?.id || null;
  if (kampagne) {
    const stapel = await api(`/api/campaigns/${kampagne}/layers`);
    const an = (stapel.layers ?? []).some((x) => x.id === gruppe.id && x.active);
    if (!an) {
      await api(`/api/campaigns/${kampagne}/layers/${gruppe.id}`, {});
      log({ kampagne, was: `activates → ${GROUP_NAME}` });
    }
  } else log({ was: 'keine laufende Kampagne gefunden — Gruppe nicht aufgeschaltet' });
  return ebene.id;
}

async function apply() {
  const datei = args[1];
  const logDatei = option('--log') ?? 'formen-log.jsonl';
  const bulkDatei = option('--bulk') ?? 'formen-bulk.json';
  const limit = Number(option('--limit')) || Infinity;
  const { plan: liste } = JSON.parse(readFileSync(datei, 'utf8'));
  const log = (x) => appendFileSync(logDatei, JSON.stringify({ at: new Date().toISOString(), ...x }) + '\n');
  const ebene = await ebeneSicherstellen(log);
  const fertig = new Map(
    existsSync(logDatei)
      ? readFileSync(logDatei, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((l) => l.ok && l.supplement).map((l) => [l.id, l.supplement])
      : [],
  );
  const rows = {};
  const stackSize = {};
  let neu = 0;
  let fehler = 0;
  for (const p of liste.slice(0, limit)) {
    try {
      let s = fertig.get(p.id);
      if (!s) {
        const a = await api('/api/entities', { type: p.type, name: p.name });
        const id = a.id ?? a.entity?.id;
        const { refs: _r, createdAt: _c, updatedAt: _u, ...e } = await api(`/api/entities/${id}`);
        /* Nur Name und Nummer: was die Ergänzung trägt, setzt die Massenänderung. */
        e.components = { Identity: e.components.Identity };
        e.relations = [
          { id: `${id}~inLayer`, type: 'inLayer', to: ebene, props: {} },
          { id: `${id}~overrides`, type: 'overrides', to: p.id, props: { fields: FIELDS, note: 'Basil Homebrew item shapes (T-142)' } },
        ];
        await api(`/api/entities/${id}`, e, 'PUT');
        s = id;
        neu += 1;
        log({ id: p.id, ok: true, nr: p.nr, name: p.name, supplement: id, supplementNr: e.components.Identity?.id });
      }
      if (p.rows) rows[s] = p.rows;
      if (p.stackSize !== undefined) stackSize[s] = p.stackSize;
    } catch (e) {
      fehler += 1;
      log({ id: p.id, ok: false, error: String(e.message).slice(0, 300) });
    }
  }
  const ops = [
    ...(Object.keys(rows).length ? [{ op: 'set', field: 'Item.rows', values: rows }] : []),
    ...(Object.keys(stackSize).length ? [{ op: 'set', field: 'Item.stackSize', values: stackSize }] : []),
  ];
  writeFileSync(bulkDatei, JSON.stringify({ select: { layer: ebene }, ops, note: 'T-142: Formen und Stapelgrössen aus Basils System' }, null, 1));
  console.log(`Ergänzungen neu ${neu}, Fehler ${fehler}; Massenänderung für ${Object.keys({ ...rows, ...stackSize }).length} in ${bulkDatei}, Protokoll ${logDatei}`);
}

// ------------------------------------------------------------ ohne Definition

async function offen() {
  const arten = await gegenstandsArten();
  const liste = await zeilen(arten);
  const alle = await ganze(liste.map((r) => r.id));
  const je = {};
  let mit = 0;
  for (const e of alle) {
    const item = e.components?.Item ?? {};
    if (Array.isArray(item.rows) && item.rows.length) {
      mit += 1;
      continue;
    }
    /* Eine Grösse tragen Gegenstände nicht; gezählt wird je Art und Gegenstandstyp. */
    const art = String(item.itemType ?? e.interfaces?.[0] ?? '?').toLowerCase() || '?';
    const k = `${e.interfaces?.[0] ?? '?'} · ${art}`;
    je[k] = (je[k] ?? 0) + 1;
  }
  const sortiert = Object.fromEntries(Object.entries(je).sort((a, b) => b[1] - a[1]));
  writeFileSync(option('--out') ?? 'formen-offen.json', JSON.stringify({ gegenstaende: alle.length, mitForm: mit, ohneForm: alle.length - mit, je: sortiert }, null, 1));
  console.log(`${alle.length} Gegenstände im Spiel, ${mit} mit Form, ${alle.length - mit} ohne.`);
}

const cmd = args[0];
(cmd === 'plan' ? plan() : cmd === 'apply' ? apply() : cmd === 'offen' ? offen() : Promise.reject(new Error('plan | apply | offen'))).catch((e) => {
  console.error(e.message);
  process.exit(1);
});

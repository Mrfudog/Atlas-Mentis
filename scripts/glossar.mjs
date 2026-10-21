#!/usr/bin/env node
/**
 * **Spielbegriffe ins Glossar** (T-347): Zustände, Waffeneigenschaften,
 * Aktionen, Schadensarten … als Artikel `GlossaryTerm` in der Ebene ihres
 * Regelwerks — in zwei Schritten, damit das, was geprüft wurde, das ist,
 * was geschrieben wird.
 *
 *   node scripts/glossar.mjs plan <texte.json> [--out plan.json]
 *   node scripts/glossar.mjs apply <plan.json> [--dry-run] [--limit N] [--fassungen]
 *
 * **Texte und Plan liegen ausserhalb des Repositorys** — eigene kurze
 * Sätze, die nur auf der Installation stehen (wie T-242, T-270). Aufbau
 * der Texte:
 *
 *   { "layer": "<ebene>",                       // Vorgabe für alle
 *     "terms": [ { "name": "Blinded", "sort": "condition", "aliases": […],
 *       "definition": "…", "effect": "…", "example": "…", "de": "Blind",
 *       "autolink": true, "explains": ["<artikel-id>", …],
 *       "layer": "<optional>", "fassung": "<begriff-id>" }, … ] }
 *
 * `plan` liest dev und schreibt nichts dorthin: es prüft jedes Ziel von
 * `explains` (es muss es geben), die Ebene (keine Gruppe), ob es den
 * Begriff unter dem Namen schon gibt — dann wird **nicht überschrieben**,
 * sondern nur ergänzt, wo das Feld leer ist (`<plan>.ergaenzen.bulk.json`,
 * eine Massenänderung mit `ifEmpty`) — und ob `fassung` ein Glossarbegriff
 * desselben Namens ist. `{ "name": …, "keep": true }` heisst: bleibt, wie
 * es ist.
 *
 * `apply` legt die neuen Begriffe an (Felder und `inLayer`, je einzeln
 * über `POST /api/entities`, also durch `validateEntity`), merkt sich die
 * Ids in `<plan>.state.json` (ein zweiter Lauf überspringt sie) und
 * schreibt die Kanten `explains` als Massenänderung in
 * `<plan>.kanten.bulk.json` — erst `node scripts/atlas.mjs bulk --dry-run`,
 * dann `bulk`, rückgängig mit `undo`. `--fassungen` hängt danach an jeden
 * genannten Begriff einer anderen Ebene (2024) die Kante `overrides` auf
 * den neuen: er ist dann dessen **Fassung** und ersetzt ihn, wo beide
 * Ebenen aufgeschaltet sind — sonst trügen zwei Begriffe denselben Namen,
 * und keiner würde mehr erkannt (`termIndex`). Diese Begriffe liegen
 * meist ausserhalb des Stapels, wo die Massenänderung nicht hinreicht;
 * darum je einzeln (`PUT`), und das Protokoll nennt den Rückweg.
 *
 * Ausgegeben werden Namen, Ids und Zahlen, nie Texte. Wie
 * `scripts/atlas.mjs`: `ATLAS_URL`, `ATLAS_DEV_TOKEN` oder das Network
 * secret der Sitzung; nur dev.
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
const [cmd, datei] = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && ['--out', '--limit'].includes(args[i - 1])));
const trocken = args.includes('--dry-run');

function stirb(text, code = 1) {
  console.error(text);
  process.exit(code);
}
if (!['plan', 'apply'].includes(cmd) || !datei) {
  stirb('node scripts/glossar.mjs plan <texte.json> [--out plan.json] | apply <plan.json> [--dry-run] [--limit N] [--fassungen]', 2);
}
if (/prod/i.test(new URL(BASE).hostname) && !/dev/i.test(new URL(BASE).hostname)) stirb(`Nur dev: ${BASE}`);
const ausserhalb = (p, was) => {
  if (resolve(p).startsWith(REPO + sep)) stirb(`${was} liegt im Repository. Er gehört ausserhalb — die Texte stehen nur auf der Installation.`);
  return resolve(p);
};
const pfad = ausserhalb(realpathSync(resolve(datei)), cmd === 'plan' ? 'Die Textdatei' : 'Der Plan');

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
const artikel = new Map();
async function hole(id) {
  if (!artikel.has(id)) {
    const r = await api(`/api/entities/${encodeURIComponent(id)}`);
    artikel.set(id, r.status === 200 ? r.json : null);
  }
  return artikel.get(id);
}
const nameVon = (e) => e?.components?.Identity?.name ?? '';
const ebeneVon = (e) => (e?.relations ?? []).find((r) => r.type === 'inLayer')?.to;
const leer = (v) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

/** Die Felder eines Begriffs, wie sie in die Karten gehen. */
function felder(t, quelle) {
  return {
    'Description.description': t.definition,
    'GlossaryTerm.sort': t.sort ?? 'rule',
    ...(t.effect ? { 'GlossaryTerm.effect': t.effect } : {}),
    ...(t.example ? { 'GlossaryTerm.example': [{ id: 'e1', value: t.example }] } : {}),
    ...(t.de ? { 'GlossaryTerm.translations': [{ id: 'de', lang: 'de', term: t.de }] } : {}),
    ...(t.aliases?.length ? { 'Identity.aliases': t.aliases } : {}),
    'Rule.autolink': t.autolink !== false,
    'Source.publication': quelle,
    'Status.status': 'ready',
  };
}

if (cmd === 'plan') {
  const texte = JSON.parse(readFileSync(pfad, 'utf8'));
  const out = ausserhalb(option('--out') ?? pfad.replace(/\.json$/, '') + '.plan.json', 'Der Plan');
  const glossar = ok(await api('/api/glossary'), 'Glossar').terms ?? [];
  const schon = new Map(glossar.filter((g) => g.article).map((g) => [g.term.toLowerCase(), g.id]));
  const neu = [];
  const fassungen = [];
  const ergaenzen = new Map();
  const kantenDazu = {};
  const fehler = [];
  const zahl = { neu: 0, schon: 0, ergaenzen: 0, bleibt: 0, fassungen: 0 };
  const namen = new Set();
  for (const t of texte.terms ?? []) {
    const k = t.name.toLowerCase();
    if (namen.has(k)) fehler.push(`${t.name}: steht zweimal in den Texten`);
    namen.add(k);
    const ziele = t.explains ?? [];
    for (const z of ziele) if (!(await hole(z))) fehler.push(`${t.name}: Ziel ${z} gibt es nicht (oder nicht sichtbar)`);
    const da = schon.get(k);
    if (da) {
      zahl.schon += 1;
      if (t.keep) {
        zahl.bleibt += 1;
        continue;
      }
      /* Nicht überschreiben: nur, was leer ist (T-347). */
      const e = await hole(da);
      const c = e?.components ?? {};
      const soll = felder(t, '');
      const ist = {
        'Description.description': c.Description?.description,
        'GlossaryTerm.effect': c.GlossaryTerm?.effect,
        'GlossaryTerm.example': c.GlossaryTerm?.example,
        'GlossaryTerm.translations': c.GlossaryTerm?.translations,
        'Identity.aliases': c.Identity?.aliases,
      };
      let dazu = false;
      for (const [f, wert] of Object.entries(ist)) {
        if (!leer(wert) || soll[f] === undefined) continue;
        (ergaenzen.get(f) ?? ergaenzen.set(f, {}).get(f))[da] = soll[f];
        dazu = true;
      }
      const hat = new Set((e?.relations ?? []).filter((r) => r.type === 'explains').map((r) => r.to));
      const fehlt = ziele.filter((z) => !hat.has(z));
      if (fehlt.length) {
        kantenDazu[da] = fehlt;
        dazu = true;
      }
      if (dazu) zahl.ergaenzen += 1;
      continue;
    }
    if (t.keep) {
      fehler.push(`${t.name}: soll bleiben, gibt es aber nicht`);
      continue;
    }
    const layer = t.layer ?? texte.layer;
    const l = layer ? await hole(layer) : null;
    if (!l) fehler.push(`${t.name}: Ebene ${layer} gibt es nicht`);
    else if (l.components?.Layer?.kind === 'group') fehler.push(`${t.name}: ${nameVon(l)} ist eine Gruppe — ein Begriff gehört in die Ebene seiner Quelle`);
    if (!t.definition) fehler.push(`${t.name}: keine Definition`);
    if (t.fassung) {
      const f = await hole(t.fassung);
      if (!f || !(f.interfaces ?? [f.type]).includes('GlossaryTerm')) fehler.push(`${t.name}: Fassung ${t.fassung} ist kein Glossarbegriff`);
      else if (ebeneVon(f) === layer) fehler.push(`${t.name}: Fassung ${t.fassung} liegt in derselben Ebene`);
      else {
        fassungen.push({ name: t.name, id: t.fassung, layer: ebeneVon(f) });
        zahl.fassungen += 1;
      }
    }
    neu.push({ name: t.name, layer, layerName: nameVon(l), explains: ziele, fields: felder(t, nameVon(l)) });
    zahl.neu += 1;
  }
  if (fehler.length) stirb(`Plan nicht geschrieben:\n- ${fehler.join('\n- ')}`);
  writeFileSync(out, JSON.stringify({ base: BASE, terms: neu, fassungen }, null, 2));
  const ops = [
    ...[...ergaenzen].map(([field, values]) => ({ op: 'set', field, values, ifEmpty: true })),
    ...(Object.keys(kantenDazu).length ? [{ op: 'addRelation', type: 'explains', targets: kantenDazu }] : []),
  ];
  if (ops.length) {
    const ids = [...new Set([...[...ergaenzen.values()].flatMap((v) => Object.keys(v)), ...Object.keys(kantenDazu)])];
    writeFileSync(
      out.replace(/\.json$/, '') + '.ergaenzen.bulk.json',
      JSON.stringify({ select: { ids, types: ['GlossaryTerm'] }, ops, note: 'T-347: Glossarbegriffe ergänzen, wo leer' }, null, 2),
    );
  }
  console.log(`Plan ${out}: ${zahl.neu} neu, ${zahl.schon} schon da (${zahl.ergaenzen} zu ergänzen, ${zahl.bleibt} bleiben), ${zahl.fassungen} Fassungen.`);
  for (const t of neu) console.log(`  neu „${t.name}" in ${t.layerName} (${t.layer}), erklärt ${t.explains.length}`);
  if (ops.length) console.log(`  Ergänzungen: ${out.replace(/\.json$/, '')}.ergaenzen.bulk.json (${ops.length} Operationen)`);
}

if (cmd === 'apply') {
  const plan = JSON.parse(readFileSync(pfad, 'utf8'));
  if (plan.base && plan.base !== BASE) stirb(`Der Plan ist für ${plan.base}, nicht ${BASE}.`);
  const zustandPfad = pfad.replace(/\.json$/, '') + '.state.json';
  const zustand = existsSync(zustandPfad) ? JSON.parse(readFileSync(zustandPfad, 'utf8')) : { ids: {}, fassungen: {} };
  const sichere = () => {
    if (!trocken) writeFileSync(zustandPfad, JSON.stringify(zustand, null, 2));
  };
  const grenze = Number(option('--limit') ?? Infinity);
  const zahl = { angelegt: 0, schon: 0, fassungen: 0 };
  for (const t of plan.terms) {
    const k = t.name.toLowerCase();
    if (zustand.ids[k]) {
      zahl.schon += 1;
      continue;
    }
    if (zahl.angelegt >= grenze) break;
    console.log(`anlegen „${t.name}" in ${t.layerName} (${t.layer})`);
    if (!trocken) {
      const e = ok(
        await api('/api/entities', { type: 'GlossaryTerm', name: t.name, fields: t.fields, relations: [{ type: 'inLayer', to: t.layer }] }),
        `Anlegen ${t.name}`,
      );
      zustand.ids[k] = e.id;
      sichere();
      console.log(`  → ${e.id} ${e.components?.Identity?.id ?? ''}`);
    }
    zahl.angelegt += 1;
  }
  /* Die Kanten als Massenänderung: Vorschau, Schreiben und Rückweg wie jede. */
  const targets = {};
  for (const t of plan.terms) {
    const id = zustand.ids[t.name.toLowerCase()];
    if (id && t.explains.length) targets[id] = t.explains;
  }
  if (Object.keys(targets).length && !trocken) {
    const bulk = pfad.replace(/\.json$/, '') + '.kanten.bulk.json';
    writeFileSync(
      bulk,
      JSON.stringify(
        { select: { ids: Object.keys(targets), types: ['GlossaryTerm'] }, ops: [{ op: 'addRelation', type: 'explains', targets }], note: 'T-347: explains an den neuen Glossarbegriffen' },
        null,
        2,
      ),
    );
    console.log(`Kanten: ${bulk} (${Object.keys(targets).length} Begriffe) — atlas.mjs bulk --dry-run, dann bulk.`);
  }
  if (args.includes('--fassungen')) {
    for (const f of plan.fassungen ?? []) {
      const ziel = zustand.ids[f.name.toLowerCase()];
      if (!ziel || zustand.fassungen[f.id]) continue;
      const { refs: _r, fromTemplate: _t, enhanced: _x, ...e } = await hole(f.id);
      if ((e.relations ?? []).some((r) => r.type === 'overrides')) {
        console.log(`bleibt ${f.id} (${nameVon(e)}): ist schon eine Fassung`);
        continue;
      }
      const relations = [...(e.relations ?? []), { id: `rel_${randomUUID().replace(/-/g, '').slice(0, 16)}`, type: 'overrides', to: ziel, props: {} }];
      console.log(`Fassung ${f.id} (${nameVon(e)}, ${f.layer}) → ${ziel}`);
      if (!trocken) {
        ok(await api(`/api/entities/${encodeURIComponent(f.id)}`, { ...e, relations }, 'PUT'), `Fassung ${f.id}`);
        zustand.fassungen[f.id] = ziel;
        sichere();
      }
      zahl.fassungen += 1;
    }
  }
  console.log(`${trocken ? 'Probe: ' : ''}${zahl.angelegt} angelegt, ${zahl.schon} schon da, ${zahl.fassungen} Fassungen.`);
}

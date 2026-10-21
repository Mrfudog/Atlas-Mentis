#!/usr/bin/env node
/**
 * **Regeln als Artikel anlegen** (T-270): je System, Regel und Option der
 * Laufzeit ein Regelartikel (`Rule.kind`, `Rule.key`, `partOf`), damit
 * Rules & options und der Regel-Builder ihre Auswahl aus Artikeln nehmen.
 *
 *   pnpm --filter @nw/model build
 *   node scripts/regeln-anlegen.mjs <plan.json> [--dry-run] [--state <datei>]
 *
 * **Der Plan liegt ausserhalb des Repositorys** — er nennt Ids und Namen
 * einer Installation. Aufbau:
 *
 *   {
 *     "campaign": "<kampagnen-id>",             // diese Kampagne schaltet die Ebene auf
 *     "layer": { "name": "Table rules" },        // Vorgabe für neue Artikel; mit "id" eine bestehende
 *     "entries": {
 *       "system:inventory":        { "layer": "<ebene>" },
 *       "rule:stowing":            { "use": "<artikel-id>" },
 *       "option:inventory:grid":   { "use": "<artikel-id>" },
 *       "option:inventory:weight": { "basedOn": ["<buchartikel-id>"] },
 *       "graph:snatch-punisher":   { "layer": "<hausregel-ebene>" }
 *     }
 *   }
 *
 * - `use`: ein bestehender Artikel wird diese Regel — der Lauf setzt
 *   `Rule.kind`, `Rule.key` und `partOf` auf den Elternartikel, sonst nichts.
 * - sonst wird angelegt: in `layer` des Eintrags, sonst in der Ebene des
 *   Elternartikels, sonst in der Vorgabe-Ebene. Name und Satz aus dem
 *   Katalog im Code; `basedOn` (Ids, sonst die Buchnamen des Katalogs,
 *   gesucht als `Rule`) wird ein Verweis im Text und gibt `Source`.
 * - Dazu die Systeme des Regel-Builders (Reactions, Spellcasting …) und
 *   seine Beispielregeln mit Graph (`graph:<id>`, `--ohne-beispiele` lässt
 *   sie weg).
 * - **Buchebenen werden nie beschrieben** — ein Neuladen ersetzt sie. Der
 *   Lauf bricht ab, wenn ein Ziel eine eingelesene Ebene ist (`kind: book`).
 *
 * `--update-texts` schreibt angelegten (nicht übernommenen) Artikeln Text
 * und Grundlage neu — etwa wenn der Plan einer Regel `basedOn` oder `text`
 * nachträgt. Sonst ändert es nichts an ihnen; einen selbst geschriebenen
 * Text ersetzt es nur mit `--force-texts`.
 *
 * `--only <schlüssel,…>` nimmt nur diese Optionen des Katalogs mit ihren
 * Varianten (`--only ruleGraphs` → `rule:ruleGraphs`, `option:ruleGraphs:*`)
 * oder diese Systeme (`system:<key>`). Ihr System muss es schon geben. So
 * legt ein Lauf an, was zu seiner Änderung gehört, und nicht nebenbei, was
 * eine andere Sitzung gerade anlegt.
 *
 * Ein zweiter Lauf legt nichts doppelt an: was angelegt wurde, steht in der
 * Zustandsdatei (Vorgabe `<plan>.state.json`, ebenfalls ausserhalb).
 * Ausgegeben werden Schlüssel, Ids und Zahlen — die Ausgabe darf ins
 * Protokoll. Wie `scripts/atlas.mjs`: `ATLAS_URL`, `ATLAS_DEV_TOKEN` oder
 * das Network secret der Cloud-Sitzung.
 */

import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath, URL, URLSearchParams } from 'node:url';

if ((process.env.HTTPS_PROXY || process.env.https_proxy) && !process.env.NODE_USE_ENV_PROXY) {
  const r = spawnSync(process.execPath, process.argv.slice(1), {
    stdio: 'inherit',
    env: { ...process.env, NODE_USE_ENV_PROXY: '1', NODE_NO_WARNINGS: '1' },
  });
  process.exit(r.status ?? 1);
}

const REPO = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const { RULE_ENGINES, RULE_OPTIONS, RULE_SORTS, describeRuleGraph, exampleRuleGraphs } = await import(resolve(REPO, 'packages/model/dist/index.js'));

const BASE = (process.env.ATLAS_URL || 'https://dev.ttrpg.fuchsbau.io').replace(/\/+$/, '');
const TOKEN = process.env.ATLAS_DEV_TOKEN || '';
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const option = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};
const datei = args.find((a, i) => !a.startsWith('--') && !(i > 0 && ['--state', '--only'].includes(args[i - 1])));
const trocken = flag('--dry-run');

function stirb(text, code = 1) {
  console.error(text);
  process.exit(code);
}

if (!datei) stirb('node scripts/regeln-anlegen.mjs <plan.json> [--dry-run] [--state <datei>]', 2);
if (/prod/i.test(new URL(BASE).hostname) && !/dev/i.test(new URL(BASE).hostname)) stirb(`Nur dev: ${BASE}`);
const pfad = realpathSync(resolve(datei));
if (pfad.startsWith(REPO + sep)) stirb('Der Plan liegt im Repository. Er nennt Ids einer Installation und gehört ausserhalb.');
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
      console.log(`  dev antwortet ${res.status} — neuer Versuch`);
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
const eintraege = plan.entries ?? {};
const zustand = existsSync(zustandPfad) ? JSON.parse(readFileSync(zustandPfad, 'utf8')) : { layer: null, ids: {}, layers: {} };
zustand.layers ??= {};
const sichere = () => {
  if (!trocken) writeFileSync(zustandPfad, JSON.stringify(zustand, null, 2));
};

/* Das Register muss die Felder kennen (Migration 099). */
const registry = ok(await api('/api/registry'), 'Register');
if (!registry.interfaces?.Rule?.schema?.properties?.key) stirb('Das Register kennt Rule.key nicht — Migration 099 fehlt auf dieser Installation.');

/* ------------------------------------------------------------ Ebenen */

const ebenen = new Map();
async function ebene(id) {
  if (!ebenen.has(id)) ebenen.set(id, ok(await api(`/api/entities/${encodeURIComponent(id)}`), `Ebene ${id}`));
  return ebenen.get(id);
}
async function pruefeZiel(id) {
  const l = await ebene(id);
  const kind = l.components?.Layer?.kind;
  if (kind === 'book' || kind === 'adventure' || kind === 'group') stirb(`Ebene ${id} ist ${kind} — Tischregeln kommen nicht in eine eingelesene Ebene.`);
}

let vorgabe = plan.layer?.id ?? zustand.layer;
if (!vorgabe) {
  const name = plan.layer?.name ?? 'Table rules';
  if (trocken) {
    console.log(`Ebene „${name}" würde angelegt.`);
    vorgabe = '(neu)';
  } else {
    vorgabe = ok(await api('/api/layers', { name }), 'Ebene anlegen').id;
    zustand.layer = vorgabe;
    sichere();
    console.log(`Ebene angelegt: ${vorgabe}`);
  }
}
if (vorgabe !== '(neu)') await pruefeZiel(vorgabe);

/* Aufschalten in der Kampagne, wenn sie noch nicht im Stapel steht. */
if (plan.campaign && vorgabe !== '(neu)') {
  const stapel = ok(await api(`/api/campaigns/${encodeURIComponent(plan.campaign)}/layers`), 'Stapel');
  /* Die Liste nennt jede Ebene mit `active`; drin ist, was aufgeschaltet ist. */
  const drin = (stapel.layers ?? []).some((l) => l.id === vorgabe && l.active);
  if (!drin) {
    if (trocken) console.log(`Ebene ${vorgabe} würde in ${plan.campaign} aufgeschaltet.`);
    else {
      ok(await api(`/api/campaigns/${encodeURIComponent(plan.campaign)}/layers/${encodeURIComponent(vorgabe)}`, {}), 'Aufschalten');
      console.log(`Ebene ${vorgabe} in ${plan.campaign} aufgeschaltet.`);
    }
  }
}

/* ------------------------------------------------------------ Buchartikel */

const buch = new Map();
async function buchartikel(name) {
  if (buch.has(name)) return buch.get(name);
  const q = new URLSearchParams({ q: name, of: 'Rule', limit: '50' });
  const rows = ok(await api(`/api/list?${q}`), `Suche ${name}`).rows ?? [];
  const treffer = rows.filter((r) => String(r.name ?? '').toLowerCase() === name.toLowerCase());
  const id = treffer.length ? treffer.map((r) => r.id).sort()[0] : null;
  buch.set(name, id);
  return id;
}

/* ------------------------------------------------------------ Der Lauf */

/** Alles, was die Laufzeit kennt, in der Reihenfolge: Systeme, Regeln, Optionen. */
const soll = [
  ...RULE_SORTS.map((s) => ({ schluessel: `system:${s.key}`, kind: 'system', key: s.key, eltern: null, label: s.label, does: s.does, namen: [] })),
  ...RULE_OPTIONS.map((o) => ({ schluessel: `rule:${o.key}`, kind: 'rule', key: o.key, eltern: `system:${o.sort}`, label: o.label, does: o.does, namen: o.rules ?? [] })),
  ...RULE_OPTIONS.flatMap((o) =>
    (o.variants ?? []).map((v) => ({ schluessel: `option:${o.key}:${v.key}`, kind: 'option', key: v.key, eltern: `rule:${o.key}`, label: v.label, does: v.does, namen: v.rules ?? [] })),
  ),
  /* Die Systeme des Regel-Builders, die keine Sorte von Rules & options sind, und die Beispielregeln mit Graph. */
  ...RULE_ENGINES.filter((e) => e.key !== 'other' && !RULE_SORTS.some((s) => s.key === e.key)).map((e) => ({
    schluessel: `system:${e.key}`,
    kind: 'system',
    key: e.key,
    eltern: null,
    label: e.label,
    does: `Rules of the rule builder about ${e.label.toLowerCase()}.`,
    namen: [],
  })),
  ...(flag('--ohne-beispiele') ? [] : exampleRuleGraphs()).map((g) => ({
    schluessel: `graph:${g.id}`,
    kind: 'rule',
    key: null,
    eltern: `system:${g.engine}`,
    label: g.name,
    /* Die Regel in eigenen Worten aus dem Graphen; den Buchtext zeigt der Artikel, auf den sie verweist. */
    does: describeRuleGraph(g),
    namen: [],
    graph: { enabled: g.enabled, nodes: g.nodes, wires: g.wires },
  })),
];
for (const k of Object.keys(eintraege)) if (!soll.some((s) => s.schluessel === k)) stirb(`Unbekannter Eintrag im Plan: ${k}`);
const nur = option('--only')?.split(',').map((x) => x.trim()).filter(Boolean);
if (nur) {
  const trifft = (s) => nur.some((k) => s.schluessel === `system:${k}` || s.schluessel === `rule:${k}` || s.schluessel.startsWith(`option:${k}:`));
  const ohne = nur.filter((k) => !soll.some((s) => trifft(s) && s.schluessel.split(':')[1] === k));
  if (ohne.length) stirb(`--only trifft nichts: ${ohne.join(', ')}`);
  soll.splice(0, soll.length, ...soll.filter(trifft));
}

/** Der Text eines Artikels: der Satz aus dem Katalog oder Graphen, dazu der Verweis auf seine Grundlage. */
async function textFuer(s, e) {
  const basis = [...(e.basedOn ?? [])];
  if (!e.basedOn) for (const n of s.namen) {
    const id = await buchartikel(n);
    if (id) {
      basis.push(id);
      break;
    }
  }
  const verweise = [];
  let publikation = e.publication;
  for (const id of basis) {
    const b = ok(await api(`/api/entities/${encodeURIComponent(id)}`), `Grundlage ${id}`);
    /* Ein Verweis nennt die Nummer (M11), nicht die interne Id. */
    verweise.push(`[[${b.components?.Identity?.id ?? id}|${b.components?.Identity?.name ?? b.name ?? id}]]`);
    publikation ??= b.components?.Source?.publication;
  }
  const satz = e.text ?? s.does;
  return { basis, publikation, text: verweise.length ? `${satz}\n\nBased on ${verweise.join(', ')}.` : satz };
}

const zahl = { angelegt: 0, uebernommen: 0, schon: 0, texte: 0 };
for (const s of soll) {
  const e = eintraege[s.schluessel] ?? {};
  if (zustand.ids[s.schluessel]) {
    zahl.schon += 1;
    /* `--update-texts`: angelegte Artikel bekommen Text und Grundlage neu — nur die Beschreibung, sonst nichts. */
    const id = zustand.ids[s.schluessel];
    if (flag('--update-texts') && !(e.use) && !id.startsWith('(neu')) {
      const { refs: _r, fromTemplate: _t, ...art } = ok(await api(`/api/entities/${encodeURIComponent(id)}`), `Artikel ${id}`);
      const { text, publikation } = await textFuer(s, e);
      const alt = art.components?.Description?.description;
      /* Was jemand selbst geschrieben hat, bleibt: ersetzt wird nur ein leerer Text oder der alte Platzhalter. */
      const eigen = typeof alt === 'string' && alt.trim() && !/^An example rule of the rule builder:/.test(alt) && !flag('--force-texts');
      if (alt !== text && eigen) console.log(`bleibt ${s.schluessel} (${id}): eigener Text`);
      else if (alt !== text) {
        console.log(`Text ${s.schluessel} (${id})`);
        const components = {
          ...art.components,
          Description: { ...(art.components?.Description ?? {}), description: text },
          ...(publikation ? { Source: { ...(art.components?.Source ?? {}), publication: publikation } } : {}),
        };
        if (!trocken) ok(await api(`/api/entities/${encodeURIComponent(id)}`, { ...art, components }, 'PUT'), `Text ${s.schluessel}`);
        zahl.texte += 1;
      }
    }
    continue;
  }
  const elternId = s.eltern ? zustand.ids[s.eltern] : null;
  if (s.eltern && !elternId && !trocken) stirb(`${s.schluessel}: Elternartikel ${s.eltern} fehlt.`);

  if (e.use) {
    const roh = ok(await api(`/api/entities/${encodeURIComponent(e.use)}`), `Artikel ${e.use}`);
    const { refs: _r, fromTemplate: _t, ...art } = roh;
    const rule = { ...(art.components?.Rule ?? {}), kind: s.kind, ...(s.key ? { key: s.key } : {}), ...(s.graph ? { graph: s.graph } : {}) };
    const relations = [...(art.relations ?? [])];
    if (elternId && !relations.some((r) => r.type === 'partOf' && r.to === elternId)) relations.push({ id: `rel_${randomUUID().replace(/-/g, '').slice(0, 16)}`, type: 'partOf', to: elternId, props: {} });
    console.log(`übernehmen ${s.schluessel} ← ${e.use}`);
    if (!trocken) ok(await api(`/api/entities/${encodeURIComponent(e.use)}`, { ...art, components: { ...art.components, Rule: rule }, relations }, 'PUT'), `Übernehmen ${s.schluessel}`);
    zustand.ids[s.schluessel] = e.use;
    zustand.layers[s.schluessel] = (art.relations ?? []).find((r) => r.type === 'inLayer')?.to;
    zahl.uebernommen += 1;
    sichere();
    continue;
  }

  /* Wohin: die Ebene des Eintrags, sonst die des Elternartikels, sonst die Vorgabe. */
  let ziel = e.layer ?? (s.eltern ? zustand.layers[s.eltern] : undefined);
  if (!ziel && elternId && !elternId.startsWith('(neu')) {
    const eltern = ok(await api(`/api/entities/${encodeURIComponent(elternId)}`), `Eltern ${elternId}`);
    ziel = (eltern.relations ?? []).find((r) => r.type === 'inLayer')?.to;
  }
  ziel ??= vorgabe;
  if (ziel !== '(neu)') await pruefeZiel(ziel);

  const { basis, text, publikation } = await textFuer(s, e);
  const fields = {
    'Rule.kind': s.kind,
    ...(s.key ? { 'Rule.key': s.key } : {}),
    ...(s.graph ? { 'Rule.graph': s.graph } : {}),
    /* „Weight" ist ein Name, kein Begriff im Fliesstext (REQ-175). */
    'Rule.autolink': false,
    'Description.description': text,
    'Status.status': 'ready',
    ...(publikation ? { 'Source.publication': publikation } : {}),
  };
  const relations = [{ type: 'inLayer', to: ziel }, ...(elternId ? [{ type: 'partOf', to: elternId }] : [])];
  console.log(`anlegen ${s.schluessel} in ${ziel}${basis.length ? ` (beruht auf ${basis.join(', ')})` : ''}`);
  if (trocken) {
    zustand.ids[s.schluessel] = `(neu:${s.schluessel})`;
  } else {
    const neu = ok(await api('/api/entities', { type: 'Rule', name: e.name ?? s.label, fields, relations }), `Anlegen ${s.schluessel}`);
    zustand.ids[s.schluessel] = neu.id;
    sichere();
  }
  zustand.layers[s.schluessel] = ziel;
  zahl.angelegt += 1;
}
sichere();
console.log(`${trocken ? 'Probe: ' : ''}${zahl.angelegt} angelegt, ${zahl.uebernommen} übernommen, ${zahl.schon} schon da${zahl.texte ? `, ${zahl.texte} Texte neu` : ''}.`);

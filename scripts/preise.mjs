#!/usr/bin/env node
/**
 * **Geschätzte Preise für Gegenstände ohne Listenpreis** (T-139, E-046).
 *
 *   node scripts/preise.mjs plan --rule b [--out plan.json]
 *   node scripts/preise.mjs apply <plan.json> [--log log.jsonl] [--dry-run]
 *
 * `plan` liest von dev alle Gegenstände im Spiel (`Item` und Untertypen)
 * ohne `Item.copperPrice` und schätzt je Seltenheit nach der Regel, die
 * die Leitung in E-046 wählt (`RULES`); eine Variante an einer Waffe oder
 * Rüstung (`variantOf` auf einen Sammelartikel wie „+1 Weapon") bekommt
 * den Listenpreis ihres Grundgegenstands dazu. Artefakte, `unknown` und
 * `varies` bleiben leer — die schätzt niemand nach einer Tabelle.
 *
 * `apply` schreibt **nie in den Grundartikel** (Vorgabe der Leitung,
 * 14.10.): je Gegenstand eine Fassung (`POST /api/entities/:id/adapt`) in
 * der Ebene „AI generated prices" mit Preis und Herkunft (`priceNote`).
 * Abschalten heisst, die Gruppe „AI content" in der Kampagne abzuschalten.
 * Das Protokoll schreibt `--log` mit (je Zeile ein Gegenstand, vorher →
 * nachher); ein zweiter Lauf überspringt, was dort schon steht.
 *
 * Wie `atlas.mjs`: `ATLAS_URL`, `ATLAS_DEV_TOKEN` (in einer Cloud-Sitzung
 * setzt der Proxy das Token), Node 22, keine Abhängigkeiten. Kein Text aus
 * einer Quelle: gelesen werden Seltenheit, Art, Name und Preis.
 */

import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
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
/** Die Ebene „AI generated prices" auf dev (Protokoll 2026-10-14-T-139). */
const AI_LAYER = process.env.ATLAS_AI_LAYER || 'ly_b7c3dd63b370';

const args = process.argv.slice(2);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

/**
 * Preis je Seltenheit in Gold (E-046). Verbrauchsgüter kosten die Hälfte.
 * b: DMG 2024, fester Preis je Stufe; c: Xanathar's Herstellungskosten.
 */
const RULES = {
  b: { label: 'DMG 2024', gp: { common: 100, uncommon: 400, rare: 4000, 'very rare': 40000, legendary: 200000 } },
  c: { label: "XGE crafting cost", gp: { common: 50, uncommon: 200, rare: 2000, 'very rare': 20000, legendary: 100000 } },
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
  if (!r.ok) throw new Error(`${method ?? 'GET'} ${pfad} → ${r.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

const item = (e) => e?.components?.Item ?? {};
const nameOf = (e) => e?.components?.Identity?.name || e?.name || '';
const priceOf = (e) => (typeof item(e).copperPrice === 'number' ? item(e).copperPrice : undefined);

/** Verbrauchsgut: Trank, Schriftrolle, Munition, Öl, Staub … — die Hälfte. */
function consumable(e) {
  const t = String(item(e).itemType ?? '').toLowerCase();
  if (/potion|scroll|ammunition/.test(t)) return true;
  return /^(oil|dust|elixir|philter|potion|scroll) of\b/i.test(nameOf(e)) || /\b(ammunition|arrows?|bolts?|bullets?|needles?)\b/i.test(nameOf(e));
}

async function alleGegenstaende() {
  /* Die Liste nennt je Art nur sich selbst und gibt höchstens 200 Zeilen auf einmal. */
  const ids = [];
  for (const type of ['Item', 'Weapon', 'Armor']) {
    for (let offset = 0; ; ) {
      const l = await api(`/api/list?type=${type}&limit=200&offset=${offset}`);
      ids.push(...l.rows.map((r) => r.id));
      offset += l.rows.length;
      if (!l.rows.length || offset >= l.total) break;
    }
  }
  const out = [];
  for (let i = 0; i < ids.length; i += 100) {
    const teil = await api(`/api/entities?ids=${ids.slice(i, i + 100).join(',')}`);
    out.push(...(Array.isArray(teil) ? teil : teil.entities ?? []));
  }
  return out;
}

async function plan() {
  const ruleKey = option('--rule');
  const rule = RULES[ruleKey];
  if (!rule) throw new Error(`--rule ${Object.keys(RULES).join('|')} (E-046)`);
  const alle = await alleGegenstaende();
  const byId = new Map(alle.map((e) => [e.id, e]));
  const out = [];
  const offen = {};
  for (const e of alle) {
    if (priceOf(e) !== undefined) continue;
    const rarity = String(item(e).rarity ?? 'none').toLowerCase();
    const gp = rule.gp[rarity];
    if (gp === undefined) {
      offen[rarity] = (offen[rarity] ?? 0) + 1;
      continue;
    }
    const halb = consumable(e);
    let cp = Math.round((halb ? gp / 2 : gp) * 100);
    let note = `estimated: ${rule.label} ${rarity}${halb ? ', consumable (half)' : ''}`;
    /* Der Grundgegenstand steht an `variantOf` (der Importer hängt „+1
       Longsword" an „Longsword"); zählt nur, wenn er nicht magisch ist
       und einen Listenpreis hat. Kein Abgleich nach Namen — „Manual of
       Iron Golems" ist keine Variante von „Iron". */
    for (const r of (e.relations ?? []).filter((x) => x.type === 'variantOf')) {
      const b = byId.get(r.to) ?? (await api(`/api/entities/${r.to}`).catch(() => null));
      const br = String(item(b).rarity ?? 'none').toLowerCase();
      if (b && priceOf(b) !== undefined && (br === 'none' || br === '')) {
        cp += priceOf(b);
        note += ` + base price (${nameOf(b)})`;
        break;
      }
    }
    out.push({ id: e.id, nr: e.components?.Identity?.id, name: nameOf(e), rarity, copperPrice: cp, priceNote: note });
  }
  const datei = option('--out') ?? 'preise-plan.json';
  writeFileSync(datei, JSON.stringify(out, null, 1));
  const je = {};
  for (const p of out) je[p.rarity] = (je[p.rarity] ?? 0) + 1;
  console.log(`${out.length} Schätzungen nach ${datei}:`, je, '— leer bleiben:', offen);
  console.log(`davon mit Grundpreis: ${out.filter((p) => p.priceNote.includes('base price')).length}`);
}

async function apply() {
  const datei = args[1];
  const log = option('--log') ?? 'preise-log.jsonl';
  const dry = args.includes('--dry-run');
  const liste = JSON.parse(readFileSync(datei, 'utf8'));
  const fertig = new Set(
    existsSync(log) ? readFileSync(log, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((l) => l.ok).map((l) => l.id) : [],
  );
  let n = 0;
  let fehler = 0;
  const eins = async (p) => {
    if (fertig.has(p.id)) return;
    try {
      const orig = await api(`/api/entities/${p.id}`);
      if (priceOf(orig) !== undefined) {
        appendFileSync(log, JSON.stringify({ id: p.id, ok: false, skip: 'has a list price' }) + '\n');
        return;
      }
      if (dry) return void console.log(p.nr, p.name, '→', p.copperPrice / 100, 'gp', p.priceNote);
      const a = await api(`/api/entities/${p.id}/adapt`, { layer: AI_LAYER });
      const { refs: _r, createdAt: _c, updatedAt: _u, ...f } = await api(`/api/entities/${a.id}`);
      const vorher = priceOf(f) ?? null;
      f.components.Item = { ...item(f), copperPrice: p.copperPrice, priceNote: p.priceNote };
      await api(`/api/entities/${a.id}`, f, 'PUT');
      n += 1;
      appendFileSync(log, JSON.stringify({ id: p.id, ok: true, nr: p.nr, name: p.name, version: a.id, versionNr: f.components.Identity?.id, created: a.created, before: vorher, copperPrice: p.copperPrice, priceNote: p.priceNote }) + '\n');
    } catch (e) {
      fehler += 1;
      appendFileSync(log, JSON.stringify({ id: p.id, ok: false, error: String(e.message).slice(0, 300) }) + '\n');
    }
  };
  for (let i = 0; i < liste.length; i += 6) await Promise.all(liste.slice(i, i + 6).map(eins));
  console.log(`${dry ? 'geprüft' : 'geschrieben'} ${n}, Fehler ${fehler}, Protokoll ${log}`);
}

const cmd = args[0];
(cmd === 'plan' ? plan() : cmd === 'apply' ? apply() : Promise.reject(new Error('plan | apply'))).catch((e) => {
  console.error(e.message);
  process.exit(1);
});

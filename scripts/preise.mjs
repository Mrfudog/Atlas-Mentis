#!/usr/bin/env node
/**
 * **Geschätzte Preise für Gegenstände ohne Listenpreis** (T-139, E-046).
 *
 *   node scripts/preise.mjs plan --rule b|c|kombi [--table preise.json --table-label …] [--out plan.json]
 *   node scripts/preise.mjs apply <plan.json> [--log log.jsonl] [--dry-run]
 *
 * `plan` liest von dev alle Gegenstände im Spiel (`Item` und Untertypen)
 * ohne `Item.copperPrice` und schätzt je Seltenheit nach der Regel, die
 * die Leitung in E-046 wählt (`RULES`); eine Variante an einer Waffe oder
 * Rüstung (`variantOf` auf einen Sammelartikel wie „+1 Weapon") bekommt
 * den Listenpreis ihres Grundgegenstands dazu. Artefakte, `unknown` und
 * `varies` bleiben leer — die schätzt niemand nach einer Tabelle.
 *
 * `--rule kombi` ist die Entscheidung E-046 d der Leitung (14.10.): eine
 * Preistabelle von aussen (`--table`, Sane Magical Prices) vor einem
 * Kibbles-Rezept vor der Seltenheit nach b. Die Annahmen dazu stehen im
 * Protokoll docs/Nachtarbeit/2026-10-14-T-139.md.
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

/** Alle Artikel der Arten im Spiel, je Art höchstens 200 Zeilen auf einmal. */
async function alleVon(types) {
  const ids = [];
  for (const type of types) {
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

const kanten = (e, type) => (e?.relations ?? []).filter((r) => r.type === type);
const rarityOf = (e) => String(item(e).rarity ?? 'none').toLowerCase() || 'none';
const MAGISCH_NICHT = new Set(['none', '']);

/** „worth at least 20 gp" an einer Kante `needs` — der Mindestwert eines Bauteils. */
function mindestwert(props) {
  const m = /(\d[\d,]*(?:\.\d+)?)\s*gp/i.exec(String(props?.note ?? ''));
  return m ? Math.round(Number(m[1].replace(/,/g, '')) * 100) : undefined;
}

async function plan() {
  const ruleKey = option('--rule');
  const rule = RULES[ruleKey === 'kombi' ? 'b' : ruleKey];
  if (!rule) throw new Error(`--rule ${[...Object.keys(RULES), 'kombi'].join('|')} (E-046)`);
  const kombi = ruleKey === 'kombi';
  const alle = await alleVon(['Item', 'Weapon', 'Armor']);
  const byId = new Map(alle.map((e) => [e.id, e]));
  const holen = async (id) => byId.get(id) ?? (await api(`/api/entities/${id}`).catch(() => null));

  /* Eine Preistabelle von aussen (`--table`, etwa Sane Magical Prices,
     E-046 d): [{ name, gp }] — liegt ausserhalb des Repos, ins Protokoll
     kommen nur Id, Name, Zahl. Gilt vor jeder Rechnung. */
  const tabelle = new Map();
  const tabLabel = option('--table-label') ?? 'price table';
  if (option('--table')) {
    for (const z of JSON.parse(readFileSync(option('--table'), 'utf8'))) tabelle.set(String(z.name).toLowerCase(), Math.round(Number(z.gp) * 100));
  }

  /* Kibbles-Rezepte (E-046 d, Begründung der Leitung): was ein Rezept
     liefert, kostet, was seine Teile kosten. Annahme A2: Rohmaterial mit
     eigenem Preis zählt doppelt (Herstellen kostet die Hälfte, wie XGE zu
     DMG), ein Bauteil, das selbst ein Gegenstand ist, zählt einmal zu
     seinem Preis. */
  const rezepte = new Map();
  const material = new Map();
  if (kombi) {
    for (const r of await alleVon(['Recipe'])) {
      for (const y of kanten(r, 'yields')) (rezepte.get(y.to) ?? rezepte.set(y.to, []).get(y.to)).push(r);
    }
    for (const m of await alleVon(['Material'])) material.set(m.id, m);
  }
  /* Annahme A3: eine Unterart kostet wie ihre Stufe — „Uncommon Arcane
     Essence" wie „Uncommon Essence", „Rare Curative Reagent" wie „Rare
     Reagent"; das Buch nennt den Preis nur für die Stufe. Eine Zutat
     „(optional)" kostet nichts. */
  const materialNachName = new Map();
  for (const m of material.values()) if (priceOf(m) !== undefined) materialNachName.set(nameOf(m).toLowerCase(), priceOf(m));
  const materialPreis = (m) => {
    if (priceOf(m) !== undefined) return { cp: priceOf(m) };
    const n = nameOf(m);
    if (/\(optional\)\s*$/i.test(n)) return { cp: 0, how: 'optional' };
    const s = /^(common|uncommon|rare|very rare|legendary)\s+.+?\s+(essence|reagent|supplies)\b/i.exec(n);
    const p = s ? materialNachName.get(`${s[1]} ${s[2]}`.toLowerCase()) : undefined;
    return p !== undefined ? { cp: p, how: 'tier' } : undefined;
  };
  /* Annahme A4: eine Zauberschriftrolle als Zutat (Kibbles nennt den
     Zauber an der Kante) kostet nach ihrem Grad wie im DMG 2024 — Grad
     0–1 common, 2–3 uncommon, 4–5 rare, 6–8 very rare, 9 legendary — zum
     Preis der Regel als Verbrauchsgut (halb). */
  const zauberGrad = new Map();
  if (kombi) for (const z of await alleVon(['Spell'])) zauberGrad.set(nameOf(z).toLowerCase(), Number(z.components?.Spell?.level));
  const rolleStufe = (g) => (g <= 1 ? 'common' : g <= 3 ? 'uncommon' : g <= 5 ? 'rare' : g <= 8 ? 'very rare' : 'legendary');
  const schriftrolle = (props) => {
    const g = zauberGrad.get(String(props?.note ?? '').trim().toLowerCase());
    if (!Number.isFinite(g)) return undefined;
    return Math.round((rule.gp[rolleStufe(g)] / 2) * 100);
  };
  const nachName = new Map();
  for (const e of alle) if (!nachName.has(nameOf(e).toLowerCase())) nachName.set(nameOf(e).toLowerCase(), e);

  const merk = new Map();
  /** Der Preis eines Gegenstands: Liste, Tabelle, Rezept, Seltenheit — in dieser Reihenfolge. */
  async function schaetze(e, tiefe = 0) {
    if (!e) return null;
    if (priceOf(e) !== undefined) return { cp: priceOf(e), note: 'list', list: true };
    if (merk.has(e.id)) return merk.get(e.id);
    merk.set(e.id, null); /* gegen Kreise */
    let out = null;
    const t = tabelle.get(nameOf(e).toLowerCase());
    if (t !== undefined) out = { cp: t, note: `estimated: ${tabLabel}`, src: 'table' };
    if (!out && kombi && tiefe < 6) {
      for (const r of rezepte.get(e.id) ?? []) {
        const n = Math.max(1, Number(r.components?.Recipe?.yieldCount) || 1);
        let roh = 0;
        let teile = 0;
        let ok = true;
        for (const k of kanten(r, 'needs')) {
          const qty = Math.max(1, Number(k.props?.qty) || 1);
          const m = material.get(k.to);
          const mp = m ? materialPreis(m) : undefined;
          if (mp) { roh += qty * mp.cp; continue; }
          /* Ein Bauteil, das ein Gegenstand ist: das Material „+1 Shortsword" ist der Gegenstand gleichen Namens. */
          const g = m ? nachName.get(nameOf(m).toLowerCase()) : await holen(k.to);
          const rolle = g && /^spell scroll$/i.test(nameOf(g)) ? schriftrolle(k.props) : undefined;
          if (rolle !== undefined) { teile += qty * rolle; continue; }
          const p = g ? await schaetze(g, tiefe + 1) : null;
          const min = mindestwert(k.props);
          if (p) teile += qty * Math.max(p.cp, min ?? 0);
          else if (min !== undefined) teile += qty * min;
          else {
            if (process.env.PREISE_WARUM) console.error('fehlt', nameOf(e), '←', m ? `Material ${nameOf(m)}` : `${k.to} ${g ? nameOf(g) + ' ' + rarityOf(g) : '(nicht gefunden)'}`);
            ok = false;
            break;
          }
        }
        if (ok && roh + teile > 0) {
          const cp = Math.round((2 * roh + teile) / n);
          const nr = r.components?.Identity?.id ?? r.id;
          if (!out || cp < out.cp) out = { cp, note: `estimated: Kibbles recipe ${nr} (materials ×2, components at price)`, src: 'recipe' };
        }
      }
    }
    if (!out) {
      const rarity = rarityOf(e);
      const gp = rule.gp[rarity];
      if (gp !== undefined) {
        const halb = consumable(e);
        let cp = Math.round((halb ? gp / 2 : gp) * 100);
        let note = `estimated: ${rule.label} ${rarity}${halb ? ', consumable (half)' : ''}`;
        /* Der Grundgegenstand steht an `variantOf` („+1 Longsword" →
           „Longsword"); zählt nur, wenn er nicht magisch ist und einen
           Listenpreis hat. Kein Abgleich nach Namen. */
        for (const v of kanten(e, 'variantOf')) {
          const b = await holen(v.to);
          if (b && priceOf(b) !== undefined && MAGISCH_NICHT.has(rarityOf(b))) {
            cp += priceOf(b);
            note += ` + base price (${nameOf(b)})`;
            break;
          }
        }
        out = { cp, note, src: 'rarity' };
      }
    }
    merk.set(e.id, out);
    return out;
  }

  const out = [];
  const offen = {};
  const quellen = {};
  for (const e of alle) {
    if (priceOf(e) !== undefined) continue;
    const s = await schaetze(e);
    if (!s) {
      offen[rarityOf(e)] = (offen[rarityOf(e)] ?? 0) + 1;
      continue;
    }
    quellen[s.src] = (quellen[s.src] ?? 0) + 1;
    out.push({ id: e.id, nr: e.components?.Identity?.id, name: nameOf(e), rarity: rarityOf(e), copperPrice: s.cp, priceNote: s.note, src: s.src });
  }
  const datei = option('--out') ?? 'preise-plan.json';
  writeFileSync(datei, JSON.stringify(out, null, 1));
  const je = {};
  for (const p of out) je[p.rarity] = (je[p.rarity] ?? 0) + 1;
  console.log(`${out.length} Schätzungen nach ${datei}:`, je, '— leer bleiben:', offen);
  console.log('nach Herkunft:', quellen, `— davon mit Grundpreis: ${out.filter((p) => p.priceNote.includes('base price')).length}`);
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

#!/usr/bin/env node
/**
 * **Attribut, Grad und Zauberliste an bestehenden Zauberquellen nachziehen** (T-309).
 *
 *   node scripts/zauberquellen-nachziehen.mjs <5etools-src/data> <ausgabe.json>
 *   node scripts/atlas.mjs bulk --dry-run <ausgabe.json>
 *   node scripts/atlas.mjs bulk <ausgabe.json>
 *
 * Seit T-309 liest der Importer `additionalSpells.ability` (mit welchem
 * Attribut eine Herkunft, ein Talent, ein Merkmal oder eine Unterklasse
 * ihre Zauber wirkt) und macht aus einem Filter wie `level=0|class=Wizard`
 * Grad und Zauberliste der Wahl statt einer Notiz. Eingelesen wird einmal
 * (D71); ein neuer Lauf mit `add` oder `replace-layer` überschriebe, was
 * seither an diesen Artikeln geändert wurde (Bilder, Korrekturen). Dieser
 * Lauf ändert nur das:
 *
 * - `casts`-Kanten ohne `ability` bekommen das Attribut des Blocks — die
 *   Kanten werden mit denselben Zielen und Angaben neu geschrieben;
 * - Wahlen `kind: 'spell'` bekommen `ability` und, aus ihrer Notiz
 *   („level 0, class Wizard"), `from.where` auf `Spell.level` und
 *   `from.listedBy` auf die Zauberliste der Klasse derselben Ausgabe.
 *
 * Ein Attribut zur Wahl (`{choose: [...]}`) bleibt offen; dann gilt das der
 * Quelle bzw. der Figur. Liest `ATLAS_URL`/`ATLAS_DEV_TOKEN` wie
 * `atlas.mjs`, schreibt selbst nichts in die Installation.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

if ((process.env.HTTPS_PROXY || process.env.https_proxy) && !process.env.NODE_USE_ENV_PROXY) {
  const r = spawnSync(process.execPath, process.argv.slice(1), { stdio: 'inherit', env: { ...process.env, NODE_USE_ENV_PROXY: '1', NODE_NO_WARNINGS: '1' } });
  process.exit(r.status ?? 1);
}

const BASE = (process.env.ATLAS_URL || 'https://dev.ttrpg.fuchsbau.io').replace(/\/+$/, '');
const TOKEN = process.env.ATLAS_DEV_TOKEN || '';
const [ordner, ausgabe] = process.argv.slice(2);
if (!ordner || !ausgabe) {
  console.error('node scripts/zauberquellen-nachziehen.mjs <5etools-src/data> <ausgabe.json>');
  process.exit(2);
}
const ATTR = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

async function api(pfad) {
  const r = await fetch(`${BASE}${pfad}`, { headers: TOKEN ? { authorization: `Bearer ${TOKEN}` } : {} });
  if (!r.ok) throw new Error(`${pfad}: ${r.status} ${await r.text()}`);
  return r.json();
}

/* Name ohne „(XPHB)" und Kürzel der Quelle, wie die Liste beides zeigt. */
const schluessel = (name, quelle) => `${String(name).replace(/\s*\([A-Z0-9]{2,}\)\s*$/, '').toLowerCase()}|${String(quelle).split(' ')[0]}`;

/* ---- 5e.tools: je Artikel das eine feste Attribut seiner Zauberblöcke. */
const attribut = new Map();
const merke = (namen, quelle, bloecke) => {
  const a = [...new Set((bloecke ?? []).map((b) => b?.ability).filter((x) => typeof x === 'string' && ATTR.includes(x)))];
  const offen = (bloecke ?? []).some((b) => b?.ability && typeof b.ability !== 'string');
  if (a.length !== 1 || offen) return;
  for (const n of namen) if (n) attribut.set(schluessel(n, quelle), a[0]);
};
const lies = async (datei) => JSON.parse(await readFile(join(ordner, datei), 'utf8'));
const rassen = await lies('races.json');
for (const r of rassen.race ?? []) merke([r.name], r.source, r.additionalSpells);
for (const s of rassen.subrace ?? []) if (s.name) merke([`${s.raceName} (${s.name})`, `${s.name} ${s.raceName}`], s.source, s.additionalSpells);
for (const f of (await lies('feats.json')).feat ?? []) merke([f.name], f.source, f.additionalSpells);
for (const b of (await lies('backgrounds.json')).background ?? []) merke([b.name], b.source, b.additionalSpells);
for (const o of (await lies('optionalfeatures.json')).optionalfeature ?? []) merke([o.name], o.source, o.additionalSpells);
for (const k of ['artificer', 'barbarian', 'bard', 'cleric', 'druid', 'fighter', 'monk', 'paladin', 'ranger', 'rogue', 'sorcerer', 'warlock', 'wizard']) {
  for (const u of (await lies(`class/class-${k}.json`).catch(() => ({}))).subclass ?? []) merke([u.name, u.shortName], u.source, u.additionalSpells);
}

/* ---- Die Installation: Quellen mit Zaubern, und die Klassen für die Listen. */
const klassen = new Map();
for (const z of (await api('/api/list?type=Class&limit=200&allLayers=1')).rows) klassen.set(schluessel(z.name, z.source ?? ''), z.id);
/* Eine Klasse derselben Ausgabe: 2024er Quelle → die XPHB-Klasse, sonst die aus dem PHB. */
const klasseFuer = (name, quelle) => klassen.get(`${name.toLowerCase()}|${/^X|2024/.test(quelle) ? 'XPHB' : 'PHB'}`) ?? klassen.get(`${name.toLowerCase()}|PHB`);

const kandidaten = [];
for (const typ of ['Ancestry', 'Feat', 'Background', 'Feature', 'Subclass']) {
  /* Die Liste gibt höchstens 200 je Blatt: blättern. */
  for (let offset = 0; ; offset += 200) {
    const l = await api(`/api/list?type=${typ}&limit=200&offset=${offset}&allLayers=1`).catch(() => ({ rows: [], total: 0 }));
    for (const z of l.rows) kandidaten.push({ id: z.id, name: z.name, quelle: String(z.source ?? '').split(' ')[0], typ });
    if (!l.rows.length || offset + l.rows.length >= l.total) break;
  }
}

const choices = {};
const casts = {};
const bericht = [];
for (let i = 0; i < kandidaten.length; i += 100) {
  const stueck = kandidaten.slice(i, i + 100);
  const ganz = await api(`/api/entities?ids=${stueck.map((k) => encodeURIComponent(k.id)).join(',')}`);
  for (const e of ganz) {
    const k = stueck.find((x) => x.id === e.id);
    const a = attribut.get(schluessel(k.name, k.quelle));
    const was = [];

    const kanten = (e.relations ?? []).filter((r) => r.type === 'casts');
    if (a && kanten.some((r) => !r.props?.ability)) {
      casts[e.id] = kanten.map((r) => ({ to: r.to, props: { ...(r.props ?? {}), ...(r.props?.ability ? {} : { ability: a }) } }));
      was.push(`${kanten.length} casts → ${a.toUpperCase()}`);
    }

    const alt = e.components?.Choices?.choices ?? [];
    let geaendert = false;
    const neu = alt.map((c) => {
      if (c.kind !== 'spell') return c;
      const n = { ...c, from: { ...(c.from ?? {}) } };
      if (a && !n.ability) {
        n.ability = a;
        geaendert = true;
      }
      const notiz = String(c.note ?? '');
      const grad = /(?:^|, )level ([0-9]+(?: or [0-9]+)*)/.exec(notiz);
      if (grad && !n.from.where) {
        n.from.where = { component: 'Spell', property: 'level', value: grad[1].split(' or ').map(Number) };
        geaendert = true;
      }
      const kl = /(?:^|, )class ([A-Za-z' ]+?)(?:,| ·|$)/.exec(notiz);
      const ziel = kl && !kl[1].includes(' or ') ? klasseFuer(kl[1].trim(), k.quelle) : undefined;
      if (ziel && !n.from.listedBy) {
        n.from.listedBy = { type: 'spellList', from: ziel };
        geaendert = true;
      }
      return n;
    });
    if (geaendert) {
      choices[e.id] = neu;
      was.push('Zauberwahl');
    }
    if (was.length) bericht.push(`${k.typ} ${k.name} (${e.id}): ${was.join(', ')}`);
  }
}

const ids = [...new Set([...Object.keys(choices), ...Object.keys(casts)])];
const ops = [];
if (Object.keys(choices).length) ops.push({ op: 'set', field: 'Choices.choices', values: choices });
if (Object.keys(casts).length) {
  /* Nur, wo Kanten neu geschrieben werden: dieselben Ziele, dazu das Attribut. */
  ops.push({ op: 'removeRelation', type: 'casts' });
  ops.push({ op: 'addRelation', type: 'casts', targets: casts });
}
/* Wer nur eine Wahl bekommt, darf seine Kanten nicht verlieren: zwei Läufe. */
const nurWahl = ids.filter((id) => !casts[id]);
const mitKanten = ids.filter((id) => casts[id]);
const laeufe = [
  ...(nurWahl.length ? [{ select: { ids: nurWahl }, ops: [{ op: 'set', field: 'Choices.choices', values: Object.fromEntries(nurWahl.map((id) => [id, choices[id]])) }], note: 'T-309: Zauberwahlen der Quellen — Attribut, Grad, Zauberliste' }] : []),
  ...(mitKanten.length ? [{ select: { ids: mitKanten }, ops: ops.filter((o) => o.op !== 'set' || mitKanten.some((id) => choices[id])).map((o) => (o.op === 'set' ? { ...o, values: Object.fromEntries(mitKanten.filter((id) => choices[id]).map((id) => [id, choices[id]])) } : o)), note: 'T-309: Attribut an casts der Quellen (und ihre Zauberwahlen)' }] : []),
];
for (const [i, l] of laeufe.entries()) await writeFile(ausgabe.replace(/\.json$/, `-${i + 1}.json`), JSON.stringify(l, null, 2));
console.log(bericht.join('\n'));
console.log(`\n${ids.length} Artikel (${nurWahl.length} nur Wahl, ${mitKanten.length} mit Kanten) → ${laeufe.map((_, i) => ausgabe.replace(/\.json$/, `-${i + 1}.json`)).join(', ')}`);

/**
 * **Zustände und Reisehandlungen sind Regelartikel** (Abgleich A3, 7.10.).
 *
 * Die Einstellungen `conditions` und `travelActions` waren Wortlisten, die
 * der Bogen, die Initiative und die Punktreise lasen. Ein Wort hat keine
 * Beschreibung, keine Probe und keine Quelle — eine Regel hat all das.
 * Also je Wort ein Artikel der Art `Rule` (`kind: condition` bzw.
 * `kind: travel`, Stand `idea`, weil die Beschreibung noch fehlt), und wo
 * das Wort stand, steht jetzt die Id:
 *
 *   Vitals.conditions           [wort]                  → [rule-id]
 *   participates.props.conditions [{name, rounds, source}] → [{rule, rounds, source}]
 *   Party.actions               {figur: wort}           → {figur: rule-id}
 *
 * Ein Wort, zu dem es schon einen Regelartikel gleichen Namens und gleicher
 * Sorte gibt, bekommt keinen zweiten. Die beiden Einstellungen fallen weg.
 * Was keine Regel findet (ein Wort, das in keiner Liste stand), wird
 * **aufgezählt** und bleibt stehen.
 *
 *   node zustaende-als-regeln.mjs <verzeichnis-mit-entities>   (liest ../registry/settings.json daneben)
 *   node zustaende-als-regeln.mjs <export.json> [ziel.json]
 */

import { readFileSync, readdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
const REGISTRY_DIR = resolve(HIER, '..', 'test', 'dbdump', 'registry');

const FALLBACK = {
  conditions:
    'blinded,charmed,deafened,frightened,grappled,incapacitated,invisible,' +
    'paralysed,petrified,poisoned,prone,restrained,stunned,unconscious',
  travelActions: 'scout,forage,craft,rest,guard,tend the fire',
};

const woerter = (s) => String(s ?? '').split(',').map((x) => x.trim()).filter(Boolean);
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

/** Die Regelartikel je Sorte, Name (kleingeschrieben) → Id. */
function regelnVon(entities, kind) {
  const m = new Map();
  for (const e of entities) {
    if (!(e.interfaces ?? []).includes('Rule')) continue;
    if (e.components?.Rule?.kind !== kind) continue;
    m.set(String(e.name ?? '').trim().toLowerCase(), e.id);
    for (const a of e.components?.Identity?.aliases ?? []) m.set(String(a).trim().toLowerCase(), e.id);
  }
  return m;
}

function hoechsteNummer(entities) {
  let hoch = 0;
  for (const e of entities) {
    const m = /^rule-(\d+)$/.exec(e.components?.Identity?.id ?? '');
    if (m) hoch = Math.max(hoch, Number(m[1]));
  }
  return hoch;
}

/** Legt je Wort einen Regelartikel an, wo noch keiner ist. */
export function regelnAnlegen(entities, settings, z) {
  const neu = [];
  let nummer = hoechsteNummer(entities);
  const jetzt = new Date().toISOString();
  for (const [key, kind] of [['conditions', 'condition'], ['travelActions', 'travel']]) {
    const liste = woerter(settings?.[key] ?? FALLBACK[key]);
    const bekannt = regelnVon(entities.concat(neu), kind);
    for (const wort of liste) {
      if (bekannt.has(wort.toLowerCase())) continue;
      nummer += 1;
      const e = {
        id: `r_${slug(wort)}`,
        name: wort,
        interfaces: ['Rule'],
        components: {
          Identity: { name: wort, id: `rule-${String(nummer).padStart(4, '0')}`, aliases: [] },
          Rule: { kind },
          Status: { status: 'idea' },
          Tags: { tags: [] },
          Vars: { bindings: {} },
        },
        relations: [],
        adhoc: [],
        createdAt: jetzt,
        updatedAt: jetzt,
      };
      if (entities.concat(neu).some((x) => x.id === e.id)) e.id = `r_${slug(wort)}_${kind}`;
      neu.push(e);
      bekannt.set(wort.toLowerCase(), e.id);
      z.angelegt.push(`${e.id} (${wort}, ${kind})`);
    }
  }
  return neu;
}

export function wandereArtikel(e, karte, z) {
  let getan = false;
  const vit = e.components?.Vitals;
  if (vit && Array.isArray(vit.conditions)) {
    const neu = [];
    for (const w of vit.conditions) {
      const id = karte.condition.get(String(w).toLowerCase());
      if (id) neu.push(id);
      else if (karte.ids.has(w)) neu.push(w);
      else { neu.push(w); z.offen.push(`${e.id} (${e.name}): Vitals.conditions „${w}" ohne Regel`); }
    }
    if (JSON.stringify(neu) !== JSON.stringify(vit.conditions)) { vit.conditions = neu; getan = true; }
  }
  for (const r of e.relations ?? []) {
    if (r.type !== 'participates' || !Array.isArray(r.props?.conditions)) continue;
    for (const c of r.props.conditions) {
      if (!c || typeof c !== 'object' || c.rule || !c.name) continue;
      const id = karte.condition.get(String(c.name).toLowerCase());
      if (id) { c.rule = id; delete c.name; getan = true; }
      else z.offen.push(`${e.id} (${e.name}): participates → ${r.to}, Zustand „${c.name}" ohne Regel`);
    }
  }
  const party = e.components?.Party;
  if (party && party.actions && typeof party.actions === 'object') {
    for (const [figur, wort] of Object.entries(party.actions)) {
      if (karte.ids.has(wort)) continue;
      const id = karte.travel.get(String(wort).toLowerCase());
      if (id) { party.actions[figur] = id; getan = true; }
      else z.offen.push(`${e.id} (${e.name}): Party.actions[${figur}] „${wort}" ohne Regel`);
    }
  }
  if (getan) z.artikel += 1;
  return getan;
}

function karteVon(entities) {
  return {
    condition: regelnVon(entities, 'condition'),
    travel: regelnVon(entities, 'travel'),
    ids: new Set(entities.map((e) => e.id)),
  };
}

function settingsBereinigen(settings) {
  if (!settings) return false;
  let getan = false;
  for (const k of ['conditions', 'travelActions']) if (k in settings) { delete settings[k]; getan = true; }
  return getan;
}

function bericht(z) {
  console.log(`${z.gelesen} Artikel gelesen, ${z.angelegt.length} Regelartikel angelegt, ${z.artikel} Artikel geändert.`);
  for (const a of z.angelegt) console.log(`  + ${a}`);
  for (const o of z.offen) console.log(`  ! ${o}`);
}

const ziel = process.argv[2];
if (!ziel) {
  console.error('Verzeichnis oder Ausfuhrdatei angeben.');
  process.exit(2);
}
const pfad = resolve(ziel);
if (!existsSync(pfad)) {
  console.error(`${pfad} gibt es nicht.`);
  process.exit(2);
}
const z = { gelesen: 0, artikel: 0, angelegt: [], offen: [] };

if (statSync(pfad).isDirectory()) {
  const dateien = readdirSync(pfad).filter((f) => f.endsWith('.json'));
  const entities = dateien.map((f) => JSON.parse(readFileSync(join(pfad, f), 'utf8')));
  z.gelesen = entities.length;
  const settingsPfad = join(pfad, '..', 'registry', 'settings.json');
  const settings = existsSync(settingsPfad) ? JSON.parse(readFileSync(settingsPfad, 'utf8')) : {};
  const neu = regelnAnlegen(entities, settings, z);
  for (const e of neu) writeFileSync(join(pfad, `${e.id}.json`), `${JSON.stringify(e, null, 2)}\n`);
  const karte = karteVon(entities.concat(neu));
  entities.forEach((e, i) => {
    if (wandereArtikel(e, karte, z)) writeFileSync(join(pfad, dateien[i]), `${JSON.stringify(e, null, 2)}\n`);
  });
  if (settingsBereinigen(settings) && existsSync(settingsPfad)) {
    writeFileSync(settingsPfad, `${JSON.stringify(settings, null, 2)}\n`);
  }
} else {
  const daten = JSON.parse(readFileSync(pfad, 'utf8'));
  const entities = daten.entities ?? [];
  z.gelesen = entities.length;
  const settings = daten.registry?.settings ?? {};
  const neu = regelnAnlegen(entities, settings, z);
  daten.entities = entities.concat(neu);
  const karte = karteVon(daten.entities);
  for (const e of entities) wandereArtikel(e, karte, z);
  if (daten.registry) {
    /* Das Register kommt frisch; die Einstellungen der Ausfuhr bleiben,
       nur die beiden Wortlisten nicht. */
    const frisch = {};
    for (const f of readdirSync(REGISTRY_DIR)) {
      if (f.endsWith('.json')) frisch[f.replace(/\.json$/, '')] = JSON.parse(readFileSync(join(REGISTRY_DIR, f), 'utf8'));
    }
    settingsBereinigen(settings);
    frisch.settings = { ...frisch.settings, ...settings };
    daten.registry = frisch;
  }
  const raus = resolve(process.argv[3] ?? pfad);
  writeFileSync(raus, `${JSON.stringify(daten, null, 2)}\n`);
  console.log(`geschrieben: ${raus}`);
}
bericht(z);

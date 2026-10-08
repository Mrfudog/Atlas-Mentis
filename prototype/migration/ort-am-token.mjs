/**
 * **Das Token sagt, wo die Gruppe ist** (Abgleich A6, 7.10.).
 *
 * `Party.at` war ein Verweis auf einen Ort, den die Punktreise schrieb —
 * neben dem Gruppen-Token auf der Karte eine zweite Wahrheit, und im
 * Prüfbestand sagten beide etwas anderes. Es bleibt eine Stelle: das Token
 * auf der feinsten Karte. Die Wanderung setzt es dorthin, wo `at` zeigte:
 *
 *   1. hat der Ort eine eigene Karte (`mapOf`) → Token in deren Mitte;
 *   2. sonst auf seine Marke (`marker`, static) auf der nächsten Karte eines
 *      Orts darüber (`partOf`); fehlt die Marke, wird sie gesetzt;
 *   3. hat kein Ort darüber eine Karte → eine **leere Karte** für den
 *      nächsten Ort darüber (die Punktreise), mit einer Marke je Knoten
 *      darunter. Sie ist ein Artikel mit Stand `idea`: ein Bild kann man
 *      später hineinlegen, die Marken zieht man zurecht.
 *
 * Ein Gruppen-Token, das anderswo lag, wird entfernt und **aufgezählt** —
 * zwei Tokens wären wieder zwei Wahrheiten. `at` fällt weg.
 *
 *   node ort-am-token.mjs <verzeichnis-mit-entities>
 *   node ort-am-token.mjs <export.json> [ziel.json]
 */

import { readFileSync, readdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
const REGISTRY_DIR = resolve(HIER, '..', 'test', 'dbdump', 'registry');

const uid = (p) => `${p}_${Math.random().toString(36).slice(2, 9)}`;
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
const istArt = (e, art) => (e.interfaces ?? [])[0] === art;
const kanten = (e, t) => (e.relations ?? []).filter((r) => r.type === t);

function mapOfPlace(E, ort) {
  return E.find((k) => istArt(k, 'Map') && kanten(k, 'mapOf').some((r) => r.to === ort.id)) ?? null;
}
function parentPlace(E, ort) {
  const r = kanten(ort, 'partOf')[0];
  return r ? E.find((e) => e.id === r.to) ?? null : null;
}
function hoechsteNummer(E, prefix) {
  let hoch = 0;
  for (const e of E) {
    const m = new RegExp(`^${prefix}-(\\d+)$`).exec(e.components?.Identity?.id ?? '');
    if (m) hoch = Math.max(hoch, Number(m[1]));
  }
  return hoch;
}

/** Wandert eine Gruppe; `neu` sammelt angelegte Artikel, `geaendert` die berührten. */
export function wandereGruppe(E, p, z, neu, geaendert) {
  const karte = p.components?.Party;
  if (!karte || !('at' in karte)) return;
  const zielId = karte.at;
  delete karte.at;
  geaendert.add(p);
  const ziel = zielId ? E.find((e) => e.id === zielId) : null;
  if (!ziel) {
    if (zielId) z.verloren.push(`${p.id} (${p.name}): at → ${zielId}, den es nicht gibt`);
    return;
  }
  const mitglieder = new Set([p.id, ...E.filter((o) => kanten(o, 'memberOfParty').some((r) => r.to === p.id)).map((o) => o.id)]);
  /* Alte Gruppen-Tokens weg, aufgezählt. */
  for (const k of E) {
    if (!istArt(k, 'Map')) continue;
    const alte = kanten(k, 'marker').filter((r) => r.props?.kind === 'party' && mitglieder.has(r.to));
    if (!alte.length) continue;
    for (const r of alte) z.entfernt.push(`${k.id} (${k.name}): Gruppen-Token auf ${r.to} bei ${r.props.x},${r.props.y}`);
    k.relations = k.relations.filter((r) => !alte.includes(r));
    geaendert.add(k);
  }
  let map = mapOfPlace(E, ziel), x = 0.5, y = 0.5;
  if (!map) {
    let oben = parentPlace(E, ziel), tiefe = 0;
    while (oben && tiefe < 12 && !map) {
      const m = mapOfPlace(E, oben);
      if (m) {
        let marke = kanten(m, 'marker').find((r) => (r.props?.kind ?? 'static') === 'static' && r.to === ziel.id);
        if (!marke) {
          const n = kanten(m, 'marker').length;
          marke = { id: uid('r'), type: 'marker', to: ziel.id, props: { x: 0.15 + 0.7 * ((n % 4) / 3), y: 0.2 + 0.6 * ((Math.floor(n / 4) % 4) / 3), kind: 'static', size: 1 } };
          m.relations = (m.relations ?? []).concat([marke]);
          z.marken.push(`${m.id} (${m.name}): Marke für ${ziel.id} (${ziel.name})`);
        }
        map = m; x = marke.props.x; y = marke.props.y;
        geaendert.add(m);
      }
      oben = parentPlace(E, oben); tiefe += 1;
    }
  }
  if (!map) {
    /* Keine Karte weit und breit: eine leere für die Punktreise. */
    const eltern = parentPlace(E, ziel) ?? ziel;
    const knoten = eltern === ziel ? [ziel] : E.filter((o) => kanten(o, 'partOf').some((r) => r.to === eltern.id));
    const nummer = hoechsteNummer(E.concat(neu), 'map') + 1;
    const jetzt = new Date().toISOString();
    map = {
      id: `mp_${slug(eltern.name)}`,
      name: `Karte: ${eltern.name}`,
      interfaces: ['Map'],
      components: {
        Identity: { name: `Karte: ${eltern.name}`, id: `map-${String(nummer).padStart(4, '0')}`, aliases: [] },
        Map: { kind: 'region', gridShape: 'none' },
        Status: { status: 'idea' },
        Description: { description: 'Angelegt von der Wanderung ort-am-token: die Punktreise als Karte, damit das Gruppen-Token eine Stelle hat. Ein Bild kann man hineinlegen, die Marken zieht man zurecht.' },
        Tags: { tags: [] },
      },
      relations: [{ id: uid('r'), type: 'mapOf', to: eltern.id, props: {} }],
      adhoc: [],
      createdAt: jetzt,
      updatedAt: jetzt,
    };
    if (E.concat(neu).some((e) => e.id === map.id)) map.id = `${map.id}_${nummer}`;
    knoten.forEach((k, i) => {
      const marke = { id: uid('r'), type: 'marker', to: k.id, props: { x: 0.15 + 0.7 * ((i % 4) / 3), y: 0.2 + 0.6 * ((Math.floor(i / 4) % 4) / 3), kind: 'static', size: 1 } };
      map.relations.push(marke);
      if (k.id === ziel.id) { x = marke.props.x; y = marke.props.y; }
    });
    neu.push(map);
    z.angelegt.push(`${map.id} (${map.name}) mit ${knoten.length} Marke(n)`);
  }
  map.relations = (map.relations ?? []).concat([{ id: uid('r'), type: 'marker', to: p.id, props: { x, y, kind: 'party', size: 1 } }]);
  geaendert.add(map);
  z.gesetzt.push(`${p.id} (${p.name}) steht auf ${map.id} (${map.name}) bei ${x.toFixed(2)},${y.toFixed(2)} — ${ziel.name}`);
}

function bericht(z) {
  console.log(`${z.gelesen} Artikel gelesen.`);
  for (const g of z.gesetzt) console.log(`  → ${g}`);
  for (const m of z.marken) console.log(`  + ${m}`);
  for (const a of z.angelegt) console.log(`  + ${a}`);
  for (const e of z.entfernt) console.log(`  − ${e}`);
  for (const v of z.verloren) console.log(`  ! ${v}`);
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
const z = { gelesen: 0, gesetzt: [], marken: [], angelegt: [], entfernt: [], verloren: [] };

if (statSync(pfad).isDirectory()) {
  const dateien = readdirSync(pfad).filter((f) => f.endsWith('.json'));
  const E = dateien.map((f) => JSON.parse(readFileSync(join(pfad, f), 'utf8')));
  z.gelesen = E.length;
  const neu = [], geaendert = new Set();
  for (const p of E) if (istArt(p, 'Party')) wandereGruppe(E, p, z, neu, geaendert);
  for (const e of neu) writeFileSync(join(pfad, `${e.id}.json`), `${JSON.stringify(e, null, 2)}\n`);
  E.forEach((e, i) => { if (geaendert.has(e)) writeFileSync(join(pfad, dateien[i]), `${JSON.stringify(e, null, 2)}\n`); });
} else {
  const daten = JSON.parse(readFileSync(pfad, 'utf8'));
  const E = daten.entities ?? [];
  z.gelesen = E.length;
  const neu = [], geaendert = new Set();
  for (const p of E) if (istArt(p, 'Party')) wandereGruppe(E, p, z, neu, geaendert);
  daten.entities = E.concat(neu);
  if (daten.registry) {
    const frisch = {};
    for (const f of readdirSync(REGISTRY_DIR)) {
      if (f.endsWith('.json')) frisch[f.replace(/\.json$/, '')] = JSON.parse(readFileSync(join(REGISTRY_DIR, f), 'utf8'));
    }
    frisch.settings = { ...frisch.settings, ...(daten.registry.settings ?? {}) };
    daten.registry = frisch;
  }
  const raus = resolve(process.argv[3] ?? pfad);
  writeFileSync(raus, `${JSON.stringify(daten, null, 2)}\n`);
  console.log(`geschrieben: ${raus}`);
}
bericht(z);

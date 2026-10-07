/**
 * **`Group` ist weg, die Gruppe ist `Party` und hängt an der Kampagne**
 * (Abgleich A8, 7.10.).
 *
 * `Group` war ein Träger von Konten ohne Mitgliedskante — sie zu nennen
 * erreichte niemanden. Jeder Artikel der Art `Group` wird eine `Party`
 * (die Karte `Group` fällt weg, ihr `kind` wird aufgezählt). Jede Party
 * ohne `partyOf` bekommt die Kante auf die Kampagne, wenn es genau eine
 * gibt; bei mehreren wird gesagt, welche nicht zuzuordnen sind.
 *
 *   node gruppe-ist-party.mjs <verzeichnis-mit-entities>
 *   node gruppe-ist-party.mjs <export.json> [ziel.json]
 */

import { readFileSync, readdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
const REGISTRY_DIR = resolve(HIER, '..', 'test', 'dbdump', 'registry');
const uid = (p) => `${p}_${Math.random().toString(36).slice(2, 9)}`;

export function wandereArtikel(e, kampagnen, z) {
  let getan = false;
  const arten = e.interfaces ?? [];
  if (arten.includes('Group')) {
    const karte = e.components?.Group;
    if (karte?.kind) z.notiert.push(`${e.id} (${e.name}): war Group.kind „${karte.kind}", jetzt Party`);
    e.interfaces = arten.map((a) => (a === 'Group' ? 'Party' : a)).filter((a, i, l) => l.indexOf(a) === i);
    if (e.components) delete e.components.Group;
    getan = true;
  }
  if ((e.interfaces ?? []).includes('Party') && !(e.relations ?? []).some((r) => r.type === 'partyOf')) {
    if (kampagnen.length === 1) {
      e.relations = (e.relations ?? []).concat([{ id: uid('r'), type: 'partyOf', to: kampagnen[0].id, props: {} }]);
      z.notiert.push(`${e.id} (${e.name}): partyOf → ${kampagnen[0].id} (${kampagnen[0].name})`);
      getan = true;
    } else {
      z.offen.push(`${e.id} (${e.name}): partyOf fehlt, ${kampagnen.length} Kampagnen — von Hand zuordnen`);
    }
  }
  if (getan) z.artikel += 1;
  return getan;
}

function bericht(z) {
  console.log(`${z.gelesen} Artikel gelesen, ${z.artikel} geändert.`);
  for (const n of z.notiert) console.log(`  · ${n}`);
  for (const o of z.offen) console.log(`  ! ${o}`);
}

const ziel = process.argv[2];
if (!ziel) { console.error('Verzeichnis oder Ausfuhrdatei angeben.'); process.exit(2); }
const pfad = resolve(ziel);
if (!existsSync(pfad)) { console.error(`${pfad} gibt es nicht.`); process.exit(2); }
const z = { gelesen: 0, artikel: 0, notiert: [], offen: [] };

if (statSync(pfad).isDirectory()) {
  const dateien = readdirSync(pfad).filter((f) => f.endsWith('.json'));
  const E = dateien.map((f) => JSON.parse(readFileSync(join(pfad, f), 'utf8')));
  z.gelesen = E.length;
  const kampagnen = E.filter((e) => (e.interfaces ?? [])[0] === 'Campaign');
  E.forEach((e, i) => { if (wandereArtikel(e, kampagnen, z)) writeFileSync(join(pfad, dateien[i]), `${JSON.stringify(e, null, 2)}\n`); });
} else {
  const daten = JSON.parse(readFileSync(pfad, 'utf8'));
  const E = daten.entities ?? [];
  z.gelesen = E.length;
  const kampagnen = E.filter((e) => (e.interfaces ?? [])[0] === 'Campaign');
  for (const e of E) wandereArtikel(e, kampagnen, z);
  if (daten.registry) {
    const frisch = {};
    for (const f of readdirSync(REGISTRY_DIR)) if (f.endsWith('.json')) frisch[f.replace(/\.json$/, '')] = JSON.parse(readFileSync(join(REGISTRY_DIR, f), 'utf8'));
    frisch.settings = { ...frisch.settings, ...(daten.registry.settings ?? {}) };
    daten.registry = frisch;
  }
  const raus = resolve(process.argv[3] ?? pfad);
  writeFileSync(raus, `${JSON.stringify(daten, null, 2)}\n`);
  console.log(`geschrieben: ${raus}`);
}
bericht(z);

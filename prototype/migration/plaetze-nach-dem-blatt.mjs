/**
 * **Die Plätze nach Basils Blatt** (REQ-214, D54) — die Wanderung von
 * `holds.props.slot`.
 *
 * Das Blatt kennt Schultern, zwei Holster, vier Ringe je Hand und vier
 * Halsketten. Vier alte Wörter meinen dasselbe wie ein neues und werden
 * umbenannt:
 *
 *   cloak → shoulders   (der Umhang liegt auf den Schultern)
 *   neck  → neck1       (die erste der vier Halsketten)
 *   ring1 → ringR1      (der erste Ring, rechte Hand)
 *   ring2 → ringL1      (der zweite Ring, linke Hand)
 *
 * `head`, `torso`, `hands`, `mainHand`, `offHand`, `belt`, `legs`, `feet`
 * bleiben, wie sie sind. Ein Platz, den die neue Liste nicht kennt, wird
 * **aufgezählt** und bleibt stehen — ein stiller Verlust sähe später aus
 * wie ein Stück, das niemand trägt.
 *
 *   node plaetze-nach-dem-blatt.mjs <verzeichnis-mit-entities>
 *   node plaetze-nach-dem-blatt.mjs <export.json> [ziel.json]
 *
 * Die Ausfuhr trägt auch das Register; es wird durch das aktuelle ersetzt
 * (aus `prototype/test/dbdump/registry`, geschrieben von `emit-seed`).
 */

import { readFileSync, readdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
const REGISTRY_DIR = resolve(HIER, '..', 'test', 'dbdump', 'registry');

export const UMBENANNT = { cloak: 'shoulders', neck: 'neck1', ring1: 'ringR1', ring2: 'ringL1' };
export const PLAETZE = ['head', 'shoulders', 'torso', 'hands', 'mainHand', 'offHand',
  'legs', 'feet', 'belt', 'holster1', 'holster2',
  'ringR1', 'ringR2', 'ringR3', 'ringR4', 'ringL1', 'ringL2', 'ringL3', 'ringL4',
  'neck1', 'neck2', 'neck3', 'neck4'];

export function wandereArtikel(e, z) {
  let beruehrt = false;
  for (const r of e.relations ?? []) {
    if (r.type !== 'holds' || !r.props || r.props.slot === undefined || r.props.slot === '') continue;
    const alt = r.props.slot;
    if (alt in UMBENANNT) {
      r.props.slot = UMBENANNT[alt];
      z.umbenannt += 1;
      beruehrt = true;
    } else if (!PLAETZE.includes(alt)) {
      z.unbekannt.push(`${e.id}: holds → ${r.to} slot = ${alt} (bleibt stehen)`);
    }
  }
  if (beruehrt) z.artikel += 1;
  return beruehrt;
}

function aktuellesRegister() {
  const teile = ['interfaces', 'relations', 'views', 'units', 'enums', 'vars', 'settings'];
  const reg = {};
  for (const teil of teile) {
    const datei = join(REGISTRY_DIR, `${teil}.json`);
    if (existsSync(datei)) reg[teil] = JSON.parse(readFileSync(datei, 'utf8'));
  }
  if (reg.interfaces) reg.components = reg.interfaces;
  return reg;
}

function bericht(z) {
  console.log(`${z.artikel} Inventare gewandert · ${z.umbenannt} Plätze umbenannt`);
  for (const v of z.unbekannt) console.log(`  ! ${v}`);
}

const [, , ziel, ausgabe] = process.argv;
if (ziel) {
  const z = { artikel: 0, umbenannt: 0, unbekannt: [] };
  if (statSync(ziel).isDirectory()) {
    const dateien = readdirSync(ziel).filter((f) => f.endsWith('.json'));
    for (const datei of dateien) {
      const pfad = join(ziel, datei);
      const e = JSON.parse(readFileSync(pfad, 'utf8'));
      if (wandereArtikel(e, z)) writeFileSync(pfad, `${JSON.stringify(e, null, 2)}\n`);
    }
    console.log(`${dateien.length} Dateien gelesen.`);
    bericht(z);
  } else {
    const daten = JSON.parse(readFileSync(ziel, 'utf8'));
    for (const e of daten.entities ?? []) wandereArtikel(e, z);
    if (existsSync(REGISTRY_DIR)) daten.registry = aktuellesRegister();
    else console.log('Kein Prüfaufbau (emit-seed) — das Register der Datei bleibt.');
    const raus = ausgabe ?? ziel.replace(/\.json$/, '') + '-gewandert.json';
    writeFileSync(raus, `${JSON.stringify(daten, null, 1)}\n`);
    console.log(`${(daten.entities ?? []).length} Artikel gelesen, geschrieben nach ${raus}.`);
    bericht(z);
  }
} else if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  console.log('node plaetze-nach-dem-blatt.mjs <verzeichnis-mit-entities | export.json> [ziel.json]');
}

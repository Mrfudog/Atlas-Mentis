/**
 * **Der Bereich `history` heisst `story`; `Event` steht unter `world`**
 * (Leitung, 13.10.).
 *
 * Kein Artikel ändert sich — `area` ist eine Registerzeile. Eine Ausfuhr
 * trägt aber ihr Register mit, und darin stünde noch `history`: diese Arten
 * fänden sich in keinem Bereich mehr. Also wird das Register der Ausfuhr
 * durch das aktuelle ersetzt, und was jemand dort selbst angelegt hat und
 * noch `history` sagt, wird umgeschrieben und aufgezählt.
 *
 *   node bereich-story.mjs <export.json> [ziel.json]
 *
 * Der Prüfbestand (prototype/test/dbdump) braucht nichts: sein Register
 * schreibt `emit-seed`.
 */

import { readFileSync, readdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
const REGISTRY_DIR = resolve(HIER, '..', 'test', 'dbdump', 'registry');

function aktuellesRegister() {
  const reg = {};
  for (const f of readdirSync(REGISTRY_DIR)) {
    if (f.endsWith('.json')) reg[f.replace(/\.json$/, '')] = JSON.parse(readFileSync(join(REGISTRY_DIR, f), 'utf8'));
  }
  return reg;
}

const ziel = process.argv[2];
if (!ziel || !existsSync(resolve(ziel)) || statSync(resolve(ziel)).isDirectory()) {
  console.error('Eine Ausfuhrdatei angeben.');
  process.exit(2);
}
const pfad = resolve(ziel);
const daten = JSON.parse(readFileSync(pfad, 'utf8'));
const aktuell = aktuellesRegister();
const umgeschrieben = [];
/* Eigene Arten, die das aktuelle Register nicht kennt, bleiben — mit
   neuem Bereich. */
for (const [name, def] of Object.entries(daten.registry?.interfaces ?? {})) {
  if (aktuell.interfaces?.[name]) continue;
  if (def.area === 'history') {
    def.area = 'story';
    umgeschrieben.push(name);
  }
  (aktuell.interfaces ??= {})[name] = def;
}
if (daten.registry) daten.registry = aktuell;
const raus = resolve(process.argv[3] ?? pfad);
writeFileSync(raus, `${JSON.stringify(daten, null, 2)}\n`);
console.log(`geschrieben: ${raus}`);
for (const n of umgeschrieben) console.log(`  ! eigene Art ${n}: history → story`);

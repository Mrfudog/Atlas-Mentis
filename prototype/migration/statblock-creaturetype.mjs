/**
 * **`Statblock.kind` heisst `creatureType`** (Abgleich A10, 7.10.).
 *
 * `kind` stand an zehn Arten mit zehn Bedeutungen, und zwei davon standen
 * auf derselben Seite nebeneinander: `Creature.kind` sagt die Sorte (npc,
 * companion …), `Statblock.kind` sagte den Kreaturentyp (Schleim, Untoter
 * …) — in der verlinkten Gruppe zwei Felder „Kind", die nichts miteinander
 * zu tun haben. Das Feld am Statblock heisst jetzt, was es ist.
 *
 *   node statblock-creaturetype.mjs <verzeichnis-mit-entities>
 *   node statblock-creaturetype.mjs <export.json> [ziel.json]
 *
 * Die Ausfuhr trägt auch das Register; es wird durch das aktuelle ersetzt.
 */

import { readFileSync, readdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
const REGISTRY_DIR = resolve(HIER, '..', 'test', 'dbdump', 'registry');

export function wandereArtikel(e, z) {
  const karte = (e.components ?? {}).Statblock;
  if (!karte || !('kind' in karte)) return false;
  if ('creatureType' in karte && karte.creatureType !== karte.kind) {
    z.behalten.push(`${e.id} (${e.name}): creatureType „${karte.creatureType}" steht schon, kind „${karte.kind}" fällt weg`);
  } else {
    karte.creatureType = karte.kind;
  }
  delete karte.kind;
  z.artikel += 1;
  return true;
}

function aktuellesRegister() {
  const reg = {};
  for (const f of readdirSync(REGISTRY_DIR)) {
    if (f.endsWith('.json')) reg[f.replace(/\.json$/, '')] = JSON.parse(readFileSync(join(REGISTRY_DIR, f), 'utf8'));
  }
  return reg;
}

function bericht(z) {
  console.log(`${z.gelesen} Datei(en) gelesen, ${z.artikel} Statblock(s) umbenannt.`);
  for (const b of z.behalten) console.log(`  ! ${b}`);
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
const z = { gelesen: 0, artikel: 0, behalten: [] };

if (statSync(pfad).isDirectory()) {
  for (const f of readdirSync(pfad)) {
    if (!f.endsWith('.json')) continue;
    const datei = join(pfad, f);
    const e = JSON.parse(readFileSync(datei, 'utf8'));
    z.gelesen += 1;
    if (wandereArtikel(e, z)) writeFileSync(datei, `${JSON.stringify(e, null, 2)}\n`);
  }
} else {
  const daten = JSON.parse(readFileSync(pfad, 'utf8'));
  for (const e of daten.entities ?? []) {
    z.gelesen += 1;
    wandereArtikel(e, z);
  }
  if (daten.registry) daten.registry = aktuellesRegister();
  const raus = resolve(process.argv[3] ?? pfad);
  writeFileSync(raus, `${JSON.stringify(daten, null, 2)}\n`);
  console.log(`geschrieben: ${raus}`);
}
bericht(z);

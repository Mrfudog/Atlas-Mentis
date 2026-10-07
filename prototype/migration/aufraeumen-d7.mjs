/**
 * Was mit den Importern und dem Wissensstand wegfällt.
 *
 * - **`Imported`** trug den Wortlaut, wie er aus dem Vault kam. Die
 *   Importer sind weg; das Feld ist damit eine Karte, die nie wieder
 *   jemand füllt.
 * - **`Image.url`** war die Adresse des Bildes aus der Zeit vor den
 *   Assets. Woher ein Bild stammt, gehört ans Asset — das ist ein Artikel
 *   und erbt `Source`.
 * - **`KnowledgeLevel`** war ein Wissensstand, dem Figuren über `atLevel`
 *   angehörten: ein zweiter Weg zu „wer weiss das", den in zwei Jahren
 *   niemand benutzt hat. An seine Stelle tritt `Knowledge`, ein Bündel von
 *   Informationen, das über dieselbe `knownBy`-Kante zugeteilt wird.
 *
 *   node aufraeumen-d7.mjs <verzeichnis-mit-entities>
 */

import { readFileSync, readdirSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const [, , ziel] = process.argv;
if (!ziel) {
  console.log('Imported und Image.url weg · KnowledgeLevel -> Knowledge, atLevel weg');
  process.exit(0);
}
if (!existsSync(ziel)) {
  console.error(`${ziel} gibt es nicht`);
  process.exit(2);
}

let artikel = 0;
let karten = 0;
let kanten = 0;
let umgetauft = 0;
const geloescht = [];

for (const datei of readdirSync(ziel).filter((f) => f.endsWith('.json'))) {
  const pfad = join(ziel, datei);
  const e = JSON.parse(readFileSync(pfad, 'utf8'));
  artikel += 1;
  const c = (e.components ??= {});

  if (c.Imported) { delete c.Imported; karten += 1; }
  if (c.Image && c.Image.url !== undefined) { delete c.Image.url; karten += 1; }
  /* Der Wissensstand hatte genau ein Feld, und das Bündel hat keines:
     was drin ist, sagen seine Kanten. */
  if (c.KnowledgeLevel) { delete c.KnowledgeLevel; karten += 1; }

  if ((e.interfaces ?? []).includes('KnowledgeLevel')) {
    e.interfaces = e.interfaces.map((x) => (x === 'KnowledgeLevel' ? 'Knowledge' : x));
    umgetauft += 1;
  }

  const vorher = (e.relations ?? []).length;
  e.relations = (e.relations ?? []).filter((r) => r.type !== 'atLevel');
  kanten += vorher - e.relations.length;

  for (const [k, v] of Object.entries(c))
    if (v && typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length) delete c[k];

  writeFileSync(pfad, `${JSON.stringify(e, null, 2)}\n`);
}
void geloescht;
void unlinkSync;
console.log(`${artikel} Artikel, ${karten} Karten weg, ${kanten} atLevel-Kanten weg, ${umgetauft} umgetauft`);

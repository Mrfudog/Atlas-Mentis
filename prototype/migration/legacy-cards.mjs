/**
 * Die Restkarten aus der Zeit vor den Arten.
 *
 * `cards-to-types.mjs` liest seine Zuordnung aus `interfaces.ts` und bewegt
 * damit alles, was dort als Feldgruppe steht. Drei Karten stehen dort nicht,
 * weil sie keine Feldgruppe *waren*:
 *
 * - **`Name`** trug den Namen als `text`, bevor `Identity` ihn führte. Ein
 *   Artikel mit beidem hat zwei Namen, und die zweite Stelle ist die, die
 *   veraltet.
 * - **`WorldDate`** hiess, was jetzt `Time` heisst — dieselben Felder,
 *   derselbe Zweck.
 * - **`RawContent`** war die unveränderte Notiz; sie wohnt jetzt in
 *   `Imported.text`. Leer heisst weg.
 *
 * Dazu zwei Feldnamen aus derselben Zeit: `Description.raw` und
 * `Status.value` hiessen so, weil sie an `Base` hingen und der Kartenname
 * den Rest sagte. Ohne `Base` heissen sie `description` und `status` —
 * `split-base.mjs` benennt sie nur um, wenn es eine `Base`-Karte findet,
 * und die gibt es hier nicht mehr.
 *
 *   node legacy-cards.mjs <verzeichnis-mit-entities>
 *
 * Die Karte, die schon dasteht, gewinnt: wo `Identity.name` gesetzt ist,
 * wird `Name.text` nur weggeworfen. Anders herum überschriebe eine
 * Migration einen Namen, den jemand nach dem Umzug getippt hat.
 */

import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/** alter Feldverweis → neuer. Die Reihenfolge ist egal, die Namen sind eindeutig. */
export const VERWEISE = {
  'Name.text': 'Identity.name',
  Name: 'Identity',
  'Description.raw': 'Description.description',
  'Status.value': 'Status.status',
  WorldDate: 'Time',
  'RawContent.raw': 'Imported.text',
  RawContent: 'Imported',
};

/**
 * Einen Feldverweis nachziehen, wie ihn Ansichten und Wissensfreigaben
 * schreiben. Ohne das zeigte jede Freigabe auf `Name.text` danach ins
 * Leere — der Deckname bliebe stehen, und niemand fände den Grund.
 */
export function neuerVerweis(ref) {
  const roh = String(ref);
  const [ohne, eintrag] = roh.split('#');
  if (VERWEISE[ohne]) return eintrag ? `${VERWEISE[ohne]}#${eintrag}` : VERWEISE[ohne];
  const karte = ohne.split('.')[0];
  if (!VERWEISE[karte]) return roh;
  const rest = ohne.slice(karte.length);
  return `${VERWEISE[karte]}${rest}${eintrag ? `#${eintrag}` : ''}`;
}

export function raeumeAuf(e) {
  const c = e.components;
  if (!c || typeof c !== 'object') return 0;
  let n = 0;

  if (c.Name) {
    const text = typeof c.Name.text === 'string' ? c.Name.text.trim() : '';
    const id = (c.Identity = c.Identity || {});
    if (text && !id.name) id.name = text;
    delete c.Name;
    n += 1;
  }

  if (c.WorldDate) {
    c.Time = { ...(c.WorldDate || {}), ...(c.Time || {}) };
    delete c.WorldDate;
    n += 1;
  }

  if (c.RawContent) {
    const text = typeof c.RawContent.text === 'string' ? c.RawContent.text : '';
    if (text.trim()) c.Imported = { ...(c.Imported || {}), text };
    delete c.RawContent;
    n += 1;
  }

  /* Ein Feldname aus der Zeit, als der Kartenname den Rest sagte. Steht
     der neue schon da, gewinnt er: sonst überschriebe die Migration, was
     jemand nach dem Umzug getippt hat. */
  for (const [karte, alt, neu] of [['Description', 'raw', 'description'], ['Status', 'value', 'status']]) {
    const k = c[karte];
    if (!k || !Object.prototype.hasOwnProperty.call(k, alt)) continue;
    if (k[neu] === undefined) k[neu] = k[alt];
    delete k[alt];
    n += 1;
  }

  /* Und die Freigaben, die auf die alten Namen zeigen. */
  const info = c.Information;
  if (info && Array.isArray(info.fields)) {
    const neu = info.fields.map((r) => neuerVerweis(r));
    if (neu.join('\u0000') !== info.fields.join('\u0000')) { info.fields = neu; n += 1; }
  }

  /* Eine Karte, von der nichts übrig bleibt, wird weggelassen und nicht
     leer mitgeschleppt: „da ist eine Karte, aber sie ist leer" ist eine
     dritte Antwort auf eine Frage mit zwei. */
  for (const [k, v] of Object.entries(c)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length) delete c[k];
  }
  return n;
}

const [, , ziel] = process.argv;
if (!ziel) {
  console.log('Name -> Identity.name, WorldDate -> Time, RawContent -> Imported.text, Description.raw -> description, Status.value -> status');
  process.exit(0);
}
if (!existsSync(ziel)) {
  console.error(`${ziel} gibt es nicht`);
  process.exit(2);
}

let artikel = 0;
let karten = 0;
for (const datei of readdirSync(ziel).filter((f) => f.endsWith('.json'))) {
  const pfad = join(ziel, datei);
  const e = JSON.parse(readFileSync(pfad, 'utf8'));
  karten += raeumeAuf(e);
  writeFileSync(pfad, `${JSON.stringify(e, null, 2)}\n`);
  artikel += 1;
}
console.log(`${artikel} Artikel, ${karten} Restkarten aufgelöst`);

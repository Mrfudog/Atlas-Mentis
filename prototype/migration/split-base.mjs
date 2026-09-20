/**
 * Etappe D3 — `Base` zerfällt in kleine Basistypen.
 *
 * Ein Sammeltyp, den jede Art erbt, trug 28 Felder; 17 davon waren in keinem
 * einzigen Artikel belegt. Ein Ereignis schleppte Bildunterschrift, Alt-Text
 * und Seitenzahl mit. Statt dessen: `Identity` erbt jeder, alles andere nimmt
 * eine Art dazu — oder eben nicht.
 *
 *   node split-base.mjs <verzeichnis-mit-entities>
 *
 * Die Feldnamen werden dabei das, was sie sind: `text` hiess der Name, weil
 * die Karte `Name` hiess. Ohne die Karte heisst er `name`.
 */

import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/** altes Feld an `Base` → [neue Art, neuer Feldname] */
export const KARTE = {
  text: ['Identity', 'name'],
  key: ['Identity', 'key'],
  aliases: ['Identity', 'aliases'],
  cover: ['Identity', 'cover'],

  value: ['Status', 'status'],
  raw: ['Description', 'description'],

  audience: ['Visibility', 'audience'],
  scope: ['Visibility', 'scope'],
  revealedTo: ['Visibility', 'revealedTo'],
  hiddenFrom: ['Visibility', 'hiddenFrom'],
  sharedUsers: ['Visibility', 'sharedUsers'],
  inherit: ['Visibility', 'inherit'],

  ref: ['Image', 'image'],
  url: ['Image', 'url'],
  caption: ['Image', 'caption'],
  alt: ['Image', 'alt'],

  imported: ['Imported', 'text'],
  format: ['Imported', 'format'],
  importedAt: ['Imported', 'at'],

  items: ['Todos', 'items'],

  publication: ['Source', 'publication'],
  page: ['Source', 'page'],
  anchor: ['Source', 'anchor'],
  sourceUrl: ['Source', 'url'],

  sort: ['Time', 'sort'],
  display: ['Time', 'display'],
  calendar: ['Time', 'calendar'],
  duration: ['Time', 'duration'],
};

/** Ein Feldverweis, wie ihn Ansichten und Wissensfreigaben schreiben. */
export function neuerVerweis(ref) {
  const [art, feld] = String(ref).split('.');
  if (art !== 'Base') return ref;
  if (feld === undefined) return 'Identity';
  const ziel = KARTE[feld];
  return ziel ? `${ziel[0]}.${ziel[1]}` : ref;
}

function teile(e) {
  const basis = (e.components || {}).Base;
  if (!basis) return 0;
  let n = 0;
  for (const [feld, wert] of Object.entries(basis)) {
    const ziel = KARTE[feld];
    if (!ziel) continue; /* Unbekanntes bleibt stehen, statt verloren zu gehen */
    const [art, name] = ziel;
    e.components[art] = { ...(e.components[art] || {}), [name]: wert };
    n += 1;
  }
  const rest = Object.keys(basis).filter((f) => !KARTE[f]);
  if (rest.length) e.components.Base = Object.fromEntries(rest.map((f) => [f, basis[f]]));
  else delete e.components.Base;
  return n;
}

const [, , ziel] = process.argv;
if (!ziel) {
  for (const [a, [t, f]] of Object.entries(KARTE)) console.log(`Base.${a} -> ${t}.${f}`);
  process.exit(0);
}
if (!existsSync(ziel)) {
  console.error(`${ziel} gibt es nicht`);
  process.exit(2);
}

let artikel = 0;
let felder = 0;
let verweise = 0;
for (const datei of readdirSync(ziel).filter((f) => f.endsWith('.json'))) {
  const pfad = join(ziel, datei);
  const e = JSON.parse(readFileSync(pfad, 'utf8'));
  felder += teile(e);
  const info = e.components?.['Information'];
  if (Array.isArray(info?.fields)) {
    const vorher = JSON.stringify(info.fields);
    info.fields = info.fields.map(neuerVerweis);
    if (JSON.stringify(info.fields) !== vorher) verweise += 1;
  }
  writeFileSync(pfad, `${JSON.stringify(e, null, 2)}\n`);
  artikel += 1;
}
console.log(`${artikel} Artikel, ${felder} Felder verteilt, ${verweise} Freigaben nachgezogen`);

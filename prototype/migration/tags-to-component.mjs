/**
 * Etappe D4 — Marken werden ein Bestandteil.
 *
 * `tags` war die einzige Eigenschaft, die keiner Artikelart gehörte: sie
 * stand an der Entität selbst, neben `id` und `interfaces`. Damit war sie
 * auch die einzige, die man an keiner Art weglassen konnte — und eine
 * Ausnahme im Rückgrat, das sonst nur Zeilen kennt.
 *
 * Jetzt ist es der Bestandteil `Tags` mit dem Feld `tags`, den jede
 * Artikelart erbt und den eine neue Art weglassen darf.
 *
 *   node tags-to-component.mjs <verzeichnis-mit-entities>
 *
 * Leer heisst weg: ein Artikel ohne Marken bekommt keine leere Karte.
 * Abwesend ist „trägt keine Marken"; eine leere Karte wäre eine dritte
 * Antwort auf eine Frage mit zwei.
 */

import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const KARTE = 'Tags';

/** Verschiebt die Marken. Gibt zurück, ob sich etwas geändert hat. */
export function verschiebe(e) {
  if (!Object.prototype.hasOwnProperty.call(e, 'tags')) return false;
  const marken = (Array.isArray(e.tags) ? e.tags : [])
    .map((t) => String(t).trim())
    .filter(Boolean);
  delete e.tags;
  if (!marken.length) return true;
  e.components = { ...(e.components || {}), [KARTE]: { tags: marken } };
  return true;
}

const [, , ziel] = process.argv;
if (!ziel) {
  console.log('tags -> Tags.tags');
  process.exit(0);
}
if (!existsSync(ziel)) {
  console.error(`${ziel} gibt es nicht`);
  process.exit(2);
}

let artikel = 0;
let mitMarken = 0;
for (const datei of readdirSync(ziel).filter((f) => f.endsWith('.json'))) {
  const pfad = join(ziel, datei);
  const e = JSON.parse(readFileSync(pfad, 'utf8'));
  if (verschiebe(e)) {
    if (e.components?.[KARTE]) mitMarken += 1;
    writeFileSync(pfad, `${JSON.stringify(e, null, 2)}\n`);
  }
  artikel += 1;
}
console.log(`${artikel} Artikel, ${mitMarken} mit Marken`);

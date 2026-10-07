/**
 * Etappe D5 — die Anordnung zieht an den Typ.
 *
 * Sie stand an der Ansicht (`views[k].byInterface[T]`), und das hiess: wer
 * wissen wollte, wie eine Artikelart gezeichnet wird, musste drei Ansichten
 * aufmachen und in jeder nach ihr suchen. Eine Kreatur ordnet ihre `full`
 * anders als ein Rezept — und das gehört zur Kreatur.
 *
 * Dabei fällt `player` weg. Sie war die zweite Stelle, an der stand, was
 * ein Spieler nicht sehen darf; zurückgehalten wird am Server
 * (`redactEntity`), und wer weniger sehen darf, sieht dieselbe Ansicht mit
 * weniger darin. Und `overview` kommt dazu: der Verweis im Text, der zeigt,
 * worauf er zeigt.
 *
 *   node views-to-types.mjs <registry-verzeichnis>
 *
 * Erwartet `interfaces.json` und `views.json` darin und schreibt beide neu.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const OVERVIEW = {
  label: 'Overview',
  order: 1,
  fields: 'none',
  blocks: [],
  description: true,
  composed: false,
  relations: false,
  bindings: false,
  image: false,
  layout: [{ id: 'ov-desc', el: 'description' }],
};

/** Verschiebt die Anordnungen. Gibt zurück, wie viele umgezogen sind. */
export function verschiebe(interfaces, views) {
  let n = 0;
  for (const [key, vd] of Object.entries(views)) {
    for (const [iface, layout] of Object.entries(vd.byInterface || {})) {
      /* Was nur die Spielerstufe hatte, fällt mit ihr weg — eine Anordnung
         für eine Ansicht, die es nicht mehr gibt, wäre eine Zeile, die
         niemand je liest. */
      if (key === 'player') continue;
      const d = interfaces[iface];
      if (!d) continue;
      d.views = d.views || {};
      d.views[key] = layout;
      n += 1;
    }
    delete vd.byInterface;
  }
  delete views['player'];
  if (!views['overview']) views['overview'] = OVERVIEW;
  /* Die Reihenfolge sagt, wie viel: Übersicht, Karte, ganze Seite. */
  if (views['quick']) views['quick'].order = 2;
  if (views['full']) views['full'].order = 3;
  return n;
}

const [, , ziel] = process.argv;
if (!ziel) {
  console.log('views[k].byInterface[T] -> interfaces[T].views[k]');
  process.exit(0);
}
if (!existsSync(join(ziel, 'views.json'))) {
  console.error(`${ziel} hat keine views.json`);
  process.exit(2);
}
const ip = join(ziel, 'interfaces.json');
const vp = join(ziel, 'views.json');
const interfaces = JSON.parse(readFileSync(ip, 'utf8'));
const views = JSON.parse(readFileSync(vp, 'utf8'));
const n = verschiebe(interfaces, views);
writeFileSync(ip, `${JSON.stringify(interfaces, null, 2)}\n`);
writeFileSync(vp, `${JSON.stringify(views, null, 2)}\n`);
console.log(`${n} Anordnungen umgezogen · Ansichten: ${Object.keys(views).join(', ')}`);

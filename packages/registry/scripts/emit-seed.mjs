/* Die Startzeilen als JSON, für den Prototyp und für jeden, der eine frische
   Datenbank befüllt.

   Der Grund: das Register lag zweimal — einmal als TypeScript hier, einmal
   als JSON im Prüfaufbau des Prototyps —, und beide wurden von Hand
   nachgezogen. Das hält genau so lange, wie jemand daran denkt. Nachgezogen
   wurde diesmal richtig, und trotzdem standen am Ende deutsche Variablen im
   Paket und englische im Prototyp; gemerkt hat es niemand, weil beide für
   sich stimmten.

   **Zusätzliche Zeilen bleiben stehen.** Wer im Prototyp eine Artikelart
   anlegt, legt eine Zeile an — genau das ist der Sinn der Sache, und ein
   Erzeuger, der sie beim nächsten Lauf wegräumt, nimmt der Idee ihren Kern.
   Sie werden aufgezählt, nicht gelöscht: so sieht man, was auseinanderläuft,
   statt es zuzudecken.

   Aufruf: node scripts/emit-seed.mjs [zielverzeichnis]
*/
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedRegistry } from '../dist/index.js';

const HIER = dirname(fileURLToPath(import.meta.url));
const ZIEL = resolve(process.argv[2] ?? join(HIER, '..', '..', '..', 'prototype', 'test', 'dbdump', 'registry'));
const TEILE = ['components', 'interfaces', 'relations', 'views', 'vars', 'settings'];

mkdirSync(ZIEL, { recursive: true });
let fremd = 0;
for (const teil of TEILE) {
  const aus = seedRegistry[teil] ?? {};
  const datei = join(ZIEL, `${teil}.json`);
  const alt = existsSync(datei) ? JSON.parse(readFileSync(datei, 'utf8')) : {};
  const eigen = Object.keys(alt).filter((k) => !(k in aus));
  const raus = { ...aus };
  for (const k of eigen) raus[k] = alt[k];
  writeFileSync(datei, `${JSON.stringify(raus, null, 1)}\n`, 'utf8');
  fremd += eigen.length;
  console.log(
    `${teil}: ${Object.keys(aus).length} from the seed` +
      (eigen.length ? `, ${eigen.length} kept that only exist there — ${eigen.join(', ')}` : ''),
  );
}
console.log(`written to ${ZIEL}${fremd ? ` · ${fremd} row(s) kept that the seed does not know` : ''}`);

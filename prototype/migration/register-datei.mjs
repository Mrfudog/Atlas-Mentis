/**
 * **Das Register als Einfuhrdatei** — die Zeilen ohne den Bestand.
 *
 * Das Register wandert häufiger als die Artikel: eine neue Aufzählung, ein
 * geteilter Typ, ein Feld mit Spanne. Dafür den ganzen Bestand aus- und
 * wieder einzulesen ist ein Umweg, auf dem man einen Artikel verlieren
 * kann — und im laufenden Prototyp liegt das Register in der Datenbank des
 * Artefakts, nicht im Paket. Also: diese Datei erzeugen, in
 * **Registry › Backup** einlesen, fertig. Die Artikel bleiben, wo sie sind.
 *
 *   node register-datei.mjs [ziel.json]
 *
 * Gelesen wird `prototype/test/dbdump/registry` — dasselbe, was `emit-seed`
 * schreibt. Damit steht das Register genau einmal, und diese Datei ist ein
 * Abzug davon und keine zweite Wahrheit.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
const QUELLE = resolve(HIER, '..', 'test', 'dbdump', 'registry');
const TEILE = ['interfaces', 'relations', 'views', 'units', 'enums', 'vars', 'settings'];

const registry = {};
const fehlt = [];
for (const teil of TEILE) {
  const datei = join(QUELLE, `${teil}.json`);
  if (!existsSync(datei)) { fehlt.push(teil); continue; }
  registry[teil] = JSON.parse(readFileSync(datei, 'utf8'));
}
/* Die Ausfuhr trägt `components` als zweiten Namen für `interfaces` — ein
   Erbe aus der Zeit, als es beides gab. Die Einfuhr liest ihn noch. */
if (registry.interfaces) registry.components = registry.interfaces;

const ziel = resolve(process.argv[2] ?? join(HIER, '..', 'nebelwacht-registry.json'));
mkdirSync(dirname(ziel), { recursive: true });
/* **Kein `entities`.** Genau daran erkennt die Einfuhr, dass der Bestand
   nicht gemeint ist; eine leere Liste hiesse „alle Artikel weg". */
writeFileSync(ziel, `${JSON.stringify({ format: 'nebelwacht/1', registry }, null, 1)}\n`, 'utf8');
console.log(
  `${ziel}\n`
  + TEILE.filter((t) => registry[t]).map((t) => `${t}: ${Object.keys(registry[t]).length}`).join(', ')
  + (fehlt.length ? `\nnicht gefunden: ${fehlt.join(', ')}` : ''),
);

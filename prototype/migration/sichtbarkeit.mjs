/**
 * **Sichtbarkeit: sechs Felder werden drei.**
 *
 * `Visibility` trug `audience`, `scope`, `revealedTo`, `hiddenFrom`,
 * `sharedUsers` und `inherit`. Drei davon fallen weg:
 *
 *  - `scope` — nirgends erklärt und nirgends gelesen. Ein Feld, dessen
 *    Bedeutung niemand aufgeschrieben hat, füllt beim nächsten Mal jemand
 *    anders als beim letzten.
 *  - `sharedUsers` — dasselbe wie `revealedTo`, nur in Konto-Ids statt in
 *    Artikel-Ids. Was darin steht, wandert deshalb **nicht** automatisch
 *    nach `revealedTo`: eine Konto-Id ist keine Träger-Id, und sie
 *    umzudeuten hiesse, eine Freigabe zu erfinden. Sie wird aufgezählt.
 *  - `inherit` — eine Vererbung an die „Kinder" eines Artikels, Vorgabe
 *    `true`, nie ausgewertet. Sie stimmt nicht: ein Haus zu kennen heisst
 *    nicht, jedes Zimmer darin zu kennen. Bewusst weggelassen, bis jemand
 *    sie mit einer Tiefe braucht.
 *
 * Und `audience` bekommt eine Vorgabe: **`public` heisst, jeder darf es
 * sehen.** Ein `audience`, das dasteht, bleibt stehen; eines, das fehlt,
 * wird nicht gesetzt — `default` heisst „falls der Wert fehlt, gilt
 * dieser", und einen Wert hineinzuschreiben, den niemand eingetragen hat,
 * wäre eine Behauptung über fünfundsiebzig Artikel.
 *
 * Zwei Betriebsarten, weil die Daten an zwei Orten liegen:
 *
 *   node sichtbarkeit.mjs <verzeichnis-mit-entities>
 *   node sichtbarkeit.mjs <export.json> [ziel.json]
 *
 * Die Ausfuhr trägt **auch das Register**. Darum wird es beim Wandern einer
 * Ausfuhr durch das aktuelle ersetzt (aus `prototype/test/dbdump/registry`):
 * das Register steht einmal, und eine gewanderte Datei mit den alten Zeilen
 * wäre ein Bestand, den seine eigenen Typen nicht erklären.
 */

import { readFileSync, readdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
const REGISTRY_DIR = resolve(HIER, '..', 'test', 'dbdump', 'registry');

const WEG = ['scope', 'sharedUsers', 'inherit'];

function neueZaehlung() {
  return {
    artikel: 0,
    entfernt: 0,
    /* Werte, die niemand mehr trägt. Sie werden ausgegeben: ein stiller
       Verlust sieht später aus wie ein leeres Feld. */
    verloren: [],
  };
}

/** Steht in diesem Feld etwas? Leer ist leer — auch die leere Liste. */
const gefuellt = (v) =>
  !(v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length));

export function wandereArtikel(e, z) {
  const karte = (e.components ?? {}).Visibility;
  if (!karte) return false;
  let beruehrt = false;
  for (const feld of WEG) {
    if (!(feld in karte)) continue;
    /* `inherit: true` ist die alte Vorgabe und kein Wille — sie
       aufzuzählen hiesse, bei jedem Artikel einen Verlust zu melden, den
       niemand entschieden hat. Alles andere steht da, weil jemand es
       hingeschrieben hat. */
    const wert = karte[feld];
    const vorgabe = feld === 'inherit' && wert === true;
    if (gefuellt(wert) && !vorgabe) {
      z.verloren.push(`${e.id}: Visibility.${feld} = ${JSON.stringify(wert)}`);
    }
    delete karte[feld];
    z.entfernt += 1;
    beruehrt = true;
  }
  /* Eine Karte ohne Feld ist keine. Sie leer stehen zu lassen hiesse: „da
     ist eine Sichtbarkeit, und sie sagt nichts". */
  if (beruehrt && !Object.keys(karte).length) delete e.components.Visibility;
  if (beruehrt) z.artikel += 1;
  return beruehrt;
}

/** Das Register, wie es jetzt im Paket steht. */
function aktuellesRegister() {
  const teile = ['interfaces', 'relations', 'views', 'units', 'enums', 'vars', 'settings'];
  const reg = {};
  for (const teil of teile) {
    const datei = join(REGISTRY_DIR, `${teil}.json`);
    if (existsSync(datei)) reg[teil] = JSON.parse(readFileSync(datei, 'utf8'));
  }
  /* Die Ausfuhr trägt `components` als zweiten Namen für `interfaces` —
     ein Erbe aus der Zeit, als es beides gab. Die Einfuhr liest ihn noch. */
  if (reg.interfaces) reg.components = reg.interfaces;
  return reg;
}

function bericht(z) {
  console.log(`${z.artikel} Artikel gewandert · ${z.entfernt} Felder entfernt`);
  for (const v of z.verloren) console.log(`  ! ${v}`);
}

const [, , ziel, ausgabe] = process.argv;
if (!ziel) {
  console.log('node sichtbarkeit.mjs <verzeichnis-mit-entities | export.json> [ziel.json]');
  process.exit(0);
}

const z = neueZaehlung();
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
  daten.registry = aktuellesRegister();
  const raus = ausgabe ?? `${ziel.replace(/\.json$/, '')}-gewandert.json`;
  writeFileSync(raus, `${JSON.stringify(daten, null, 1)}\n`);
  console.log(
    `${(daten.entities ?? []).length} Artikel gelesen, Register ersetzt, geschrieben nach ${raus}.`,
  );
  bericht(z);
}

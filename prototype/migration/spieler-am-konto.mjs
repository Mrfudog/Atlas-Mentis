/**
 * **Wer eine Figur spielt, steht am Konto** (Abgleich A1, REQ-199).
 *
 * `PlayerCharacter.player` war ein freier Text an der Figur und `playedBy`
 * eine Kante von ihr auf irgendetwas — beides Kontoangaben in einem Artikel,
 * die mit jeder Ausfuhr wanderten. Am Server steht das in `app_user_actor`,
 * im Prototyp in der Sammlung `members`, und beides bleibt dort.
 *
 * Das Feld und die Kante werden entfernt, und was darin stand, wird
 * **aufgezählt** — nicht umgeschrieben. Ein stiller Verlust sähe später aus
 * wie ein leeres Feld.
 *
 *   node spieler-am-konto.mjs <verzeichnis-mit-entities>
 *   node spieler-am-konto.mjs <export.json> [ziel.json]
 *
 * Die Ausfuhr trägt auch das Register; es wird durch das aktuelle ersetzt
 * (aus `prototype/test/dbdump/registry`), denn eine gewanderte Datei mit der
 * alten Kante `playedBy` wäre ein Bestand, den sein eigenes Register nicht
 * erklärt.
 */

import { readFileSync, readdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
const REGISTRY_DIR = resolve(HIER, '..', 'test', 'dbdump', 'registry');

export function wandereArtikel(e, z) {
  let getan = false;
  const karte = (e.components ?? {}).PlayerCharacter;
  if (karte && 'player' in karte) {
    const wert = karte.player;
    if (wert !== undefined && wert !== null && String(wert).trim() !== '' && String(wert).trim() !== '—') {
      z.verloren.push(`${e.id} (${e.name}): player „${wert}"`);
    }
    delete karte.player;
    getan = true;
  }
  const kanten = e.relations ?? [];
  const weg = kanten.filter((r) => r.type === 'playedBy');
  if (weg.length) {
    for (const r of weg) z.verloren.push(`${e.id} (${e.name}): playedBy → ${r.to}`);
    e.relations = kanten.filter((r) => r.type !== 'playedBy');
    getan = true;
  }
  if (getan) z.artikel += 1;
  return getan;
}

function aktuellesRegister() {
  const reg = {};
  for (const f of readdirSync(REGISTRY_DIR)) {
    if (f.endsWith('.json')) reg[f.replace(/\.json$/, '')] = JSON.parse(readFileSync(join(REGISTRY_DIR, f), 'utf8'));
  }
  return reg;
}

function bericht(z) {
  console.log(`${z.gelesen} Datei(en) gelesen, ${z.artikel} Artikel geändert.`);
  if (z.verloren.length) {
    console.log('Was darin stand — am Konto neu einzutragen, wo es noch gilt:');
    for (const v of z.verloren) console.log(`  ! ${v}`);
  } else {
    console.log('Nichts davon trug einen Wert.');
  }
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
const z = { gelesen: 0, artikel: 0, verloren: [] };

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

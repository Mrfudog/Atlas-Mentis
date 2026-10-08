/**
 * **Sechs Arten werden Wörter** (Abgleich A5, Regel T2, 7.10.).
 *
 * `Arc`, `Chapter`, `Era`, `Cataclysm`, `Milestone` und `Consumable` waren
 * Registerzeilen ohne ein einziges eigenes Feld und ohne Kante — ein
 * Untertyp, der nichts Eigenes erklärt, ist ein Wort und keine Zeile:
 *
 *   Arc, Chapter              → Story    mit Story.kind  = arc | chapter
 *   Era, Cataclysm, Milestone → Event    mit Event.kind  = era | cataclysm | milestone
 *   Consumable                → Item     mit Item.itemType = Verbrauch, wo es leer war
 *
 * Dazu räumt die Wanderung `Story.kind` an den Arten auf, die es selbst
 * sagen: `campaign`, `session`, `scene` an `Campaign`, `Session`, `Scene`
 * fallen weg (dieselbe Einordnung zweimal). Ein anderes Wort dort bleibt
 * stehen und wird aufgezählt.
 *
 *   node arten-werden-woerter.mjs <verzeichnis-mit-entities>
 *   node arten-werden-woerter.mjs <export.json> [ziel.json]
 *
 * Die Ausfuhr trägt auch das Register; es wird durch das aktuelle ersetzt
 * (aus `prototype/test/dbdump/registry`), denn ein Bestand mit `Arc`-Artikeln
 * und ein Register ohne `Arc` erklären einander nicht.
 */

import { readFileSync, readdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
const REGISTRY_DIR = resolve(HIER, '..', 'test', 'dbdump', 'registry');

/* Art → [neue Art, Karte, Feld, Wert] */
const WORT = {
  Arc: ['Story', 'Story', 'kind', 'arc'],
  Chapter: ['Story', 'Story', 'kind', 'chapter'],
  Era: ['Event', 'Event', 'kind', 'era'],
  Cataclysm: ['Event', 'Event', 'kind', 'cataclysm'],
  Milestone: ['Event', 'Event', 'kind', 'milestone'],
  Consumable: ['Item', 'Item', 'itemType', 'Verbrauch'],
};
/* Arten, an denen `Story.kind` nur die Art wiederholte. */
const SAGT_ES_SELBST = { Campaign: 'campaign', Session: 'session', Scene: 'scene' };

export function wandereArtikel(e, z) {
  let getan = false;
  const arten = e.interfaces ?? [];
  const neu = [];
  for (const art of arten) {
    const w = WORT[art];
    if (!w) {
      neu.push(art);
      continue;
    }
    const [ziel, karte, feld, wert] = w;
    if (!neu.includes(ziel)) neu.push(ziel);
    e.components ??= {};
    e.components[karte] ??= {};
    const vorher = e.components[karte][feld];
    if (vorher === undefined || vorher === null || String(vorher).trim() === '') {
      e.components[karte][feld] = wert;
    } else if (vorher !== wert) {
      /* Ein Konsumgut, das schon „Trank" sagt, bleibt ein Trank — Verbrauch
         wäre die gröbere Angabe. Gesagt wird es trotzdem. */
      z.behalten.push(`${e.id} (${e.name}): ${art} → ${ziel}, ${karte}.${feld} bleibt „${vorher}"`);
    }
    getan = true;
  }
  if (getan) e.interfaces = neu;

  const story = e.components?.Story;
  for (const art of e.interfaces ?? []) {
    const wort = SAGT_ES_SELBST[art];
    if (!wort || !story || !('kind' in story)) continue;
    if (story.kind === wort || story.kind === '' || story.kind == null) {
      delete story.kind;
      getan = true;
    } else {
      z.behalten.push(`${e.id} (${e.name}): ${art} trägt Story.kind „${story.kind}" — bleibt stehen`);
    }
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
  for (const b of z.behalten) console.log(`  · ${b}`);
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

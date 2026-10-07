/**
 * **Rollen ans Konto: die `Access`-Karte fällt weg.**
 *
 * `Access` trug `userIds` und `role` an einer Figur (und für einen Tag an
 * der Kampagne). Das sind Angaben über ein **Konto**, und sie stehen jetzt
 * am Konto: am Server in `app_user_actor` (welche Figuren) und
 * `campaign_member` (welche Rolle in welcher Kampagne), im Prototyp in der
 * Sammlung `members`.
 *
 * Die Karte wird aus jedem Artikel entfernt, und was in ihr stand, wird
 * **aufgezählt** — nicht umgeschrieben. Eine Rolle an einer Figur sagt
 * nicht, in welcher Kampagne sie gilt, und eine Konto-Id gehört in keine
 * Datei, die mit der Kampagne wandert (REQ-199). Wer sie braucht, trägt sie
 * auf der Kampagnenseite unter „Members" ein; die Liste hier sagt, was dort
 * stand.
 *
 *   node rollen-ans-konto.mjs <verzeichnis-mit-entities>
 *   node rollen-ans-konto.mjs <export.json> [ziel.json]
 *
 * Die Ausfuhr trägt auch das Register; es wird durch das aktuelle ersetzt
 * (aus `prototype/test/dbdump/registry`), denn eine gewanderte Datei mit der
 * alten Zeile `Access` wäre ein Bestand, den seine eigenen Typen nicht
 * erklären.
 */

import { readFileSync, readdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
const REGISTRY_DIR = resolve(HIER, '..', 'test', 'dbdump', 'registry');

function neueZaehlung() {
  return { artikel: 0, verloren: [] };
}

export function wandereArtikel(e, z) {
  const karte = (e.components ?? {}).Access;
  if (!karte) return false;
  const was = [];
  if (karte.role) was.push(`role ${karte.role}`);
  const ids = Array.isArray(karte.userIds) ? karte.userIds.filter(Boolean) : [];
  if (ids.length) was.push(`Konten ${ids.join(', ')}`);
  /* Eine Notiz zum Zugang zog schon früher nach `Notes.note`; steht hier
     trotzdem etwas anderes, geht es ebenfalls in die Liste. */
  for (const [k, v] of Object.entries(karte)) {
    if (k === 'role' || k === 'userIds') continue;
    if (v !== undefined && v !== null && v !== '') was.push(`${k} ${JSON.stringify(v)}`);
  }
  if (was.length) z.verloren.push(`${e.id} (${e.name ?? ''}): ${was.join(' · ')}`);
  delete e.components.Access;
  z.artikel += 1;
  return true;
}

function aktuellesRegister() {
  const teile = ['interfaces', 'relations', 'views', 'units', 'enums', 'vars', 'settings'];
  const reg = {};
  for (const teil of teile) {
    const datei = join(REGISTRY_DIR, `${teil}.json`);
    if (existsSync(datei)) reg[teil] = JSON.parse(readFileSync(datei, 'utf8'));
  }
  if (reg.interfaces) reg.components = reg.interfaces;
  return reg;
}

function bericht(z) {
  console.log(`${z.artikel} Access-Karten entfernt.`);
  if (z.verloren.length) {
    console.log('Was darin stand — als Rolle am Konto neu einzutragen, wo es noch gilt:');
    for (const v of z.verloren) console.log(`  ! ${v}`);
  }
}

const [, , ziel, ausgabe] = process.argv;
if (!ziel) {
  console.log('node rollen-ans-konto.mjs <verzeichnis-mit-entities | export.json> [ziel.json]');
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
  console.log(`${(daten.entities ?? []).length} Artikel gelesen, Register ersetzt, geschrieben nach ${raus}.`);
  bericht(z);
}

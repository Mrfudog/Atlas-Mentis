#!/usr/bin/env node
/**
 * **Kanten an Orten nachtragen** (T-182).
 *
 *   node scripts/orte-kanten.mjs <ausfuhr.json> <verzeichnis> [--layer e5_book_lmop]
 *
 * `--only-new` legt neue Orte an, aber die Kanten, die an schon geladenen
 * Artikeln stehen, kommen nicht mit: `happensAt` an der Szene, das zweite
 * `mapOf` an der Karte, `partOf` eines Orts in seiner Gegend, `livesIn` an
 * der benannten Kreatur. Dieses Skript liest die Ausfuhrdatei eines
 * Importlaufs (`node packages/import-5etools/dist/cli.js <data> --out
 * ausfuhr.json`) und schreibt daraus vier Massenänderungen nach
 * `<verzeichnis>`:
 *
 *  - `1-happensAt.json` — die Szenen der Datei, Ziel aus Kante
 *    (`<-describedIn`, nur Orte, nur wo noch keine steht): der Ort, den der
 *    Server selbst an der Szene findet, nicht der der Datei;
 *  - `2-mapOf.json` — die Karten: der Ort ihrer Szene (`->mapOf->happensAt`)
 *    und die Orte, die die Datei ihnen gibt (Bereichskarten);
 *  - `3-partOf.json` — Orte in Orten, aus der Datei, nur wo noch keiner steht;
 *  - `4-livesIn.json` — Wohnorte benannter Kreaturen, aus der Datei, ebenso.
 *
 * Geschrieben wird jede wie sonst:
 *
 *   node scripts/atlas.mjs bulk --dry-run 1-happensAt.json
 *   node scripts/atlas.mjs bulk 1-happensAt.json
 *
 * Jeder Auftrag trägt `allLayers`: die meisten Bücher schaltet keine
 * Runde auf, und ohne den Schalter träfe die Auswahl nur, was im Spiel ist
 * — darum schreibt ihn nur die Verwaltung.
 *
 * Was es auf dem Server nicht gibt, nennt die Vorschau („no such article")
 * und lässt es aus; mehrdeutige Wege ebenso („ambiguous"). `--layer`
 * nimmt nur die Artikel einer Ebene (die Probe). Ohne Abhängigkeiten; die
 * Ausfuhrdatei und die Aufträge gehören ausserhalb des Repositorys, denn
 * sie tragen Namen aus 5e.tools.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const [dateiPfad, ziel] = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--layer');
if (!dateiPfad || !ziel) {
  console.error('node scripts/orte-kanten.mjs <ausfuhr.json> <verzeichnis> [--layer <ebene>]');
  process.exit(2);
}
const ebene = args.includes('--layer') ? args[args.indexOf('--layer') + 1] : undefined;

const { entities } = JSON.parse(readFileSync(resolve(dateiPfad), 'utf8'));
const art = (e) => e.interfaces?.[0];
const kanten = (e, typ) => (e.relations ?? []).filter((r) => r.type === typ).map((r) => r.to);
const nachId = new Map(entities.map((e) => [e.id, e]));
const drin = (e) => !ebene || kanten(e, 'inLayer').includes(ebene);
const alle = entities.filter(drin);

/** Je Artikel seine Ziele einer Kantenart, nur Ziele der Art `zielArt`. */
function ziele(typen, kante, zielArt) {
  const targets = {};
  for (const e of alle) {
    if (!typen.includes(art(e))) continue;
    const z = kanten(e, kante).filter((to) => art(nachId.get(to)) === zielArt);
    if (z.length) targets[e.id] = z;
  }
  return targets;
}

const auftraege = {
  '1-happensAt.json': {
    select: { ids: alle.filter((e) => art(e) === 'Scene').map((e) => e.id) },
    ops: [{ op: 'addRelation', type: 'happensAt', to: '<-describedIn', toTypes: ['Place'], ifNone: true }],
    note: 'T-182: Szene spielt am Ort, den sie beschreibt',
    allLayers: true,
  },
  '2-mapOf.json': {
    select: { ids: alle.filter((e) => art(e) === 'Map').map((e) => e.id) },
    ops: [
      { op: 'addRelation', type: 'mapOf', to: '->mapOf->happensAt', toTypes: ['Place'] },
      { op: 'addRelation', type: 'mapOf', targets: ziele(['Map'], 'mapOf', 'Place') },
    ],
    note: 'T-182: Karte zeigt auch den Ort ihrer Szene und ihres Bereichs',
    allLayers: true,
  },
  '3-partOf.json': (() => {
    const targets = ziele(['Place'], 'partOf', 'Place');
    return {
      select: { ids: Object.keys(targets) },
      ops: [{ op: 'addRelation', type: 'partOf', targets, ifNone: true }],
      note: 'T-182: Ort in Ort, aus dem Importlauf',
      allLayers: true,
    };
  })(),
  '4-livesIn.json': (() => {
    const targets = ziele(['Creature'], 'livesIn', 'Place');
    return {
      select: { ids: Object.keys(targets) },
      ops: [{ op: 'addRelation', type: 'livesIn', targets, ifNone: true }],
      note: 'T-182: Wohnort einer benannten Kreatur, aus dem Importlauf',
      allLayers: true,
    };
  })(),
};

mkdirSync(resolve(ziel), { recursive: true });
for (const [name, auftrag] of Object.entries(auftraege)) {
  writeFileSync(join(resolve(ziel), name), JSON.stringify(auftrag));
  const n = auftrag.ops.reduce((s, o) => s + Object.keys(o.targets ?? {}).length, 0);
  console.log(`${name}: ${auftrag.select.ids.length} ausgewählt${n ? `, ${n} mit Zielen aus der Datei` : ''}`);
}

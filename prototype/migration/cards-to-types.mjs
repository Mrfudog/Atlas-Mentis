/**
 * Etappe D2 — Karten heissen nach der Art, die ihre Felder erklärt.
 *
 * Komponenten gibt es im Register nicht mehr. Eine Karte `CreatureInfo` am
 * Artikel muss deshalb `Creature` heissen, `Vitals` bleibt `Vitals` (die Art
 * gibt es weiter), und wo zwei Karten in dieselbe Art wandern, werden sie zu
 * einer zusammengelegt.
 *
 *   node cards-to-types.mjs <verzeichnis-mit-entities>   # ändert an Ort
 *   node cards-to-types.mjs --map                        # nur die Karte zeigen
 *
 * Die Zuordnung wird **nicht hier gepflegt**, sondern aus
 * `packages/registry/src/interfaces.ts` gelesen: dort steht, welche
 * Feldgruppen eine Art zusammenlegt. Eine zweite Liste hielte genau so
 * lange, wie jemand an sie denkt.
 */

import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
const QUELLE = join(HIER, '..', '..', 'packages', 'registry', 'src', 'interfaces.ts');

export function karte() {
  const src = readFileSync(QUELLE, 'utf8');
  const out = {};
  /* `  Name: {` … bis zur nächsten `schema:`-Zeile desselben Eintrags. */
  const eintrag = /^ {2}([A-Za-z]+): \{$/gm;
  let m;
  while ((m = eintrag.exec(src))) {
    const art = m[1];
    const rest = src.slice(m.index, src.indexOf('\n  },', m.index));
    const viele = /schema: merge\(([^)]*)\)/s.exec(rest);
    const eine = /schema: g\.([A-Za-z]+)\.schema/.exec(rest);
    const gruppen = viele
      ? viele[1].split(',').map((x) => x.trim().replace(/^g\./, '')).filter(Boolean)
      : eine
        ? [eine[1]]
        : [];
    /* Eine Art, die ihre Gruppe unter eigenem Namen führt, wandert nicht. */
    for (const g of gruppen) if (g !== art) out[g] = art;
  }
  return out;
}

function wandere(e, map) {
  if (!e.components || typeof e.components !== 'object') return { e, n: 0 };
  const neu = {};
  let n = 0;
  for (const [alt, wert] of Object.entries(e.components)) {
    const ziel = map[alt] ?? alt;
    if (ziel !== alt) n += 1;
    /* Zwei Karten in einer Art werden eine. Kollidieren kann dabei nichts:
       das prüft `registry.test.ts`, bevor überhaupt jemand wandert. */
    neu[ziel] = { ...(neu[ziel] ?? {}), ...(wert ?? {}) };
  }
  e.components = neu;
  return { e, n };
}

/** Feldverweise in Wissensfreigaben: `Comp` oder `Comp.field`. */
function wandereVerweis(ref, map) {
  const [comp, key] = String(ref).split('.');
  const ziel = map[comp] ?? comp;
  return key === undefined ? ziel : `${ziel}.${key}`;
}

const [, , ziel] = process.argv;
const map = karte();

if (ziel === '--map' || !ziel) {
  for (const [a, b] of Object.entries(map).sort()) console.log(`${a} -> ${b}`);
  console.log(`${Object.keys(map).length} Karten wandern`);
  process.exit(0);
}

if (!existsSync(ziel)) {
  console.error(`${ziel} gibt es nicht`);
  process.exit(2);
}

let artikel = 0;
let karten = 0;
let verweise = 0;
for (const datei of readdirSync(ziel).filter((f) => f.endsWith('.json'))) {
  const pfad = join(ziel, datei);
  const e = JSON.parse(readFileSync(pfad, 'utf8'));
  const { n } = wandere(e, map);
  const info = e.components?.['Information'];
  for (const feld of ['fields']) {
    if (Array.isArray(info?.[feld])) {
      const vorher = JSON.stringify(info[feld]);
      info[feld] = info[feld].map((r) => wandereVerweis(r, map));
      if (JSON.stringify(info[feld]) !== vorher) verweise += 1;
    }
  }
  writeFileSync(pfad, `${JSON.stringify(e, null, 2)}\n`);
  artikel += 1;
  karten += n;
}
console.log(`${artikel} Artikel, ${karten} Karten umbenannt, ${verweise} Freigaben nachgezogen`);

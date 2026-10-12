/**
 * Der Importer von der Kommandozeile.
 *
 *   node dist/cli.js <5etools-src/data> [--out datei.json] [--bericht bericht.md]
 *                    [--srd] [--sources PHB,MM] [--sample [verzeichnis]]
 *
 * Ohne `--out` schreibt er nur den Bericht. `--sample` schreibt einen
 * kleinen Ausschnitt als `<verzeichnis>/<id>.json` — Vorgabe ist der
 * Prüfbestand `prototype/test/dbdump/entities` (M14). Das Register dazu
 * schreibt `pnpm --filter @nw/registry emit-seed`.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { berichtMarkdown } from './bericht.js';
import { ausschnitt, lauf, PROBE, Prueffehler } from './lauf.js';
import { lies } from './lesen.js';

const HIER = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const wert = (flag: string): string | undefined => {
  const i = args.indexOf(flag);
  if (i < 0) return undefined;
  const v = args[i + 1];
  return v && !v.startsWith('--') ? v : '';
};
const pfad = args[0] && !args[0].startsWith('--') ? args[0] : undefined;
if (!pfad) {
  console.error('node dist/cli.js <5etools-src/data> [--out datei.json] [--bericht bericht.md] [--srd] [--sources PHB,MM] [--sample [verzeichnis]]');
  process.exit(2);
}

/** Der Commit des Datenstands, wenn es ein Checkout ist. */
function stand(daten: string): string | undefined {
  try {
    const commit = execFileSync('git', ['-C', daten, 'log', '-1', '--format=%h %cs'], { encoding: 'utf8' }).trim();
    return commit ? `5etools-src ${commit}` : undefined;
  } catch {
    return undefined;
  }
}

const daten = resolve(pfad);
console.log(`Lese ${daten} …`);
const datenstand = lies(daten);
const quellen = wert('--sources');
try {
  const { datei, bericht } = lauf(datenstand, {
    nurSrd: args.includes('--srd'),
    quellen: quellen ? quellen.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
  });
  console.log(`${datei.entities.length} Artikel, alle geprüft.`);

  const out = wert('--out');
  if (out) {
    mkdirSync(dirname(resolve(out)), { recursive: true });
    writeFileSync(resolve(out), JSON.stringify(datei));
    console.log(`Ausfuhrdatei: ${resolve(out)}`);
  }
  const berichtPfad = wert('--bericht');
  if (berichtPfad !== undefined) {
    const ziel = resolve(berichtPfad || 'bericht-5etools.md');
    /* Die Pfade gehören dem, der den Lauf macht; im Bericht stehen Platzhalter. */
    const aufruf = ['node packages/import-5etools/dist/cli.js', '<data>', ...args.slice(1).map((a, i, alle) => (i > 0 && ['--out', '--bericht', '--sample'].includes(alle[i - 1]!) && !a.startsWith('--') ? '<datei>' : a))].join(' ');
    writeFileSync(ziel, berichtMarkdown(bericht, { stand: stand(daten), aufruf, artikel: datei.entities.length }));
    console.log(`Bericht: ${ziel}`);
  }
  const sample = wert('--sample');
  if (sample !== undefined) {
    const ziel = resolve(sample || join(HIER, '..', '..', '..', 'prototype', 'test', 'dbdump', 'entities'));
    const teil = ausschnitt(datei.entities, PROBE);
    mkdirSync(ziel, { recursive: true });
    for (const e of teil) writeFileSync(join(ziel, `${e.id}.json`), `${JSON.stringify(e, null, 1)}\n`);
    console.log(`Ausschnitt: ${teil.length} Artikel nach ${ziel}`);
  }
} catch (x) {
  if (x instanceof Prueffehler) {
    console.error(x.message);
    process.exit(1);
  }
  throw x;
}

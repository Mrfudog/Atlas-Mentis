/**
 * `Identity.key` wird `Identity.id`.
 *
 * Der Schlüssel hiess `npc/volo-geddarm`: ein Name, der ein zweites Mal
 * derselbe Name war. Beim Umbenennen musste er entweder mitwandern — dann
 * war er kein fester Bezeichner — oder nicht, und dann log er. Eine Nummer
 * sagt nichts und bleibt deshalb richtig; wie der Artikel heisst, steht
 * daneben.
 *
 *   node key-to-id.mjs <verzeichnis-mit-entities>
 *
 * Vergeben wird `art-nnnn`, je Artikelart durchgezählt. Die Reihenfolge ist
 * **nicht** die des Verzeichnisses, sondern `createdAt` und bei Gleichstand
 * der alte Schlüssel: ein zweiter Lauf auf denselben Daten muss dieselben
 * Nummern ergeben, sonst wäre die Wanderung selbst die Stelle, an der ein
 * Bezeichner wandert.
 *
 * Und die Freigaben ziehen mit: eine Information, die `Identity.key` nennt,
 * nennt danach `Identity.id`. Ohne das zeigte sie ins Leere — der Name
 * stünde offen da, und niemand fände den Grund.
 */

import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export function idPrefix(typ) {
  return (
    String(typ || 'article')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'article'
  );
}

/** Den Verweis nachziehen, wie ihn Ansichten und Freigaben schreiben. */
export function neuerVerweis(ref) {
  const roh = String(ref);
  if (roh === 'Identity.key') return 'Identity.id';
  return roh;
}

const [, , ziel] = process.argv;
if (!ziel) {
  console.log('Identity.key -> Identity.id (art-nnnn)');
  process.exit(0);
}
if (!existsSync(ziel)) {
  console.error(`${ziel} gibt es nicht`);
  process.exit(2);
}

const dateien = readdirSync(ziel).filter((f) => f.endsWith('.json'));
const alle = dateien.map((datei) => ({ datei, e: JSON.parse(readFileSync(join(ziel, datei), 'utf8')) }));

/* Erst ordnen, dann nummerieren — siehe oben. */
alle.sort((a, b) => {
  const za = String(a.e.createdAt ?? '');
  const zb = String(b.e.createdAt ?? '');
  if (za !== zb) return za < zb ? -1 : 1;
  const ka = String(a.e.components?.Identity?.key ?? a.e.id ?? '');
  const kb = String(b.e.components?.Identity?.key ?? b.e.id ?? '');
  return ka < kb ? -1 : ka > kb ? 1 : 0;
});

const zaehler = new Map();
let vergeben = 0;
for (const { e } of alle) {
  const id = e.components?.Identity;
  if (!id) continue;
  const prefix = idPrefix(e.interfaces?.[0] ?? 'Article');
  const n = (zaehler.get(prefix) ?? 0) + 1;
  zaehler.set(prefix, n);
  /* Die Reihenfolge der Felder bleibt: `id` steht, wo `key` stand. */
  const neu = {};
  for (const [k, v] of Object.entries(id)) {
    if (k === 'key') neu.id = `${prefix}-${String(n).padStart(4, '0')}`;
    else if (k !== 'id') neu[k] = v;
  }
  if (!neu.id) neu.id = `${prefix}-${String(n).padStart(4, '0')}`;
  e.components.Identity = neu;
  vergeben += 1;
}

/* Die Freigaben und alles andere, was den Verweis schreibt. */
let nachgezogen = 0;
for (const { e } of alle) {
  const info = e.components?.Information;
  if (!info || !Array.isArray(info.fields)) continue;
  const felder = info.fields.map((r) => neuerVerweis(r));
  if (felder.join('\u0000') !== info.fields.join('\u0000')) {
    info.fields = felder;
    nachgezogen += 1;
  }
}

for (const { datei, e } of alle) {
  writeFileSync(join(ziel, datei), `${JSON.stringify(e, null, 2)}\n`);
}
console.log(`${alle.size ?? alle.length} Artikel, ${vergeben} Nummern vergeben, ${nachgezogen} Freigaben nachgezogen`);

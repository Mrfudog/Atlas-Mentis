/**
 * Die Zahlen wohnen am Statblock — auch die eines Spielercharakters.
 *
 * Eine Kreatur trug ihre `StatblockInfo` bisher entweder selbst oder
 * geliehen über `belongsTo`, und der Bogen las „erst die eigene, dann die
 * geliehene". Zwei Formen für dieselbe Sache: wer eine Kreatur änderte,
 * musste wissen, in welcher der beiden ihre Zahlen gerade standen — und die
 * Kante `belongsTo` reichte gar nicht bis zum Spielercharakter.
 *
 * Ab hier: die Zahlen stehen am Statblock, `belongsTo` zeigt von ihm auf die
 * Kreatur, und `Vitals` bleibt bei der Figur — das ist, was sich während der
 * Sitzung ändert, und es gehört ihr und nicht ihrem Bogen.
 *
 *   node zahlen-an-den-statblock.mjs <verzeichnis-mit-entities>
 *
 * Für jede Kreatur mit eigener Karte entsteht ein Statblock-Artikel „Werte
 * von <Name>". Hat sie schon einen geliehenen, gewinnt der: dann wird die
 * eigene Karte nur weggeworfen, weil sonst zwei Sätze Zahlen dastünden und
 * der Bogen ab jetzt den geliehenen liest.
 */

import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const KARTE = 'StatblockInfo';

const idPrefix = (typ) =>
  String(typ || 'article').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'article';

const [, , ziel] = process.argv;
if (!ziel) {
  console.log('Creature.StatblockInfo -> eigener Statblock mit belongsTo');
  process.exit(0);
}
if (!existsSync(ziel)) {
  console.error(`${ziel} gibt es nicht`);
  process.exit(2);
}

const dateien = readdirSync(ziel).filter((f) => f.endsWith('.json'));
const alle = dateien.map((datei) => ({ datei, e: JSON.parse(readFileSync(join(ziel, datei), 'utf8')) }));
const KREATUR = new Set(['NPC', 'PlayerCharacter', 'Companion', 'Retainer']);

/* Wer schon einen Statblock hat, braucht keinen zweiten. */
const hatSchon = new Set();
for (const { e } of alle)
  for (const r of e.relations ?? [])
    if (r.type === 'belongsTo') hatSchon.add(r.to);

/* Die höchste vergebene Statblock-Nummer, damit die neuen weiterzählen. */
let hoechste = 0;
const muster = new RegExp(`^${idPrefix('Statblock')}-(\\d+)$`);
for (const { e } of alle) {
  const m = muster.exec(String(e.components?.Identity?.id ?? ''));
  if (m) hoechste = Math.max(hoechste, Number(m[1]));
}

let angelegt = 0;
let weggeworfen = 0;
const neue = [];
for (const { e } of alle) {
  const art = (e.interfaces ?? [])[0];
  if (!KREATUR.has(art)) continue;
  const zahlen = e.components?.[KARTE];
  if (!zahlen || !Object.keys(zahlen).length) continue;

  delete e.components[KARTE];

  if (hatSchon.has(e.id)) {
    /* Die geliehene gewinnt — zwei Sätze Zahlen wären genau das Problem. */
    weggeworfen += 1;
    continue;
  }

  hoechste += 1;
  const name = `Werte von ${e.components?.Identity?.name ?? e.name ?? e.id}`;
  const sbId = `sb_${e.id}`;
  neue.push({
    datei: `${sbId}.json`,
    e: {
      id: sbId,
      interfaces: ['Statblock'],
      name,
      components: {
        Identity: { name, id: `${idPrefix('Statblock')}-${String(hoechste).padStart(4, '0')}`, aliases: [] },
        Status: { status: 'used' },
        [KARTE]: zahlen,
      },
      adhoc: [],
      /* Die Kante steht am Statblock und zeigt auf die Kreatur: nur
         vorwärts gespeichert, und „welchen Statblock hat Rook" ist der
         Rückbezug. */
      relations: [{ id: `rel_${sbId}`, type: 'belongsTo', to: e.id, props: {} }],
      createdAt: e.createdAt ?? new Date().toISOString(),
    },
  });
  angelegt += 1;
}

for (const { datei, e } of [...alle, ...neue]) {
  writeFileSync(join(ziel, datei), `${JSON.stringify(e, null, 2)}\n`);
}
console.log(`${alle.length} Artikel, ${angelegt} Statblöcke angelegt, ${weggeworfen} eigene Karten verworfen`);

/**
 * Waffeneigenschaften werden Kanten.
 *
 * `Weapon.Properties` hielt sie als Text: „finesse, leicht". Das kopiert,
 * was geteilt gehört — eine Eigenschaft ist eine Regel, und dieselbe Regel
 * steht an dreissig Waffen. Genau darum ging es beim Import: `[[Versatil]]`
 * war ein Verweis und keine Zeichenkette. Als Text findet der Merkzettel am
 * Tisch sie nicht, und wer die Regel ändert, ändert sie an einer Waffe.
 *
 * Ab hier zeigt `hasProperty` auf gepoolte Regelartikel.
 *
 *   node waffeneigenschaften.mjs <verzeichnis-mit-entities>
 *
 * Für eine Eigenschaft, die es noch nicht als Regel gibt, wird eine
 * angelegt — **leer bis auf den Namen**. Sie zu erfinden hiesse,
 * Regeltexte zu schreiben, die niemand geprüft hat; ein Artikel mit Namen
 * und ohne Text sagt dagegen, dass hier etwas nachzutragen ist, und steht
 * unter „Unfinished".
 */

import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const FELD = 'Properties';

const slug = (name) =>
  String(name ?? '')
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'ohne-namen';

/* Wie der Vault sie schreibt → wie die Regel heisst. Nur die, die im
   Bestand vorkommen; der Rest kommt, wenn er kommt. */
export const NAMEN = {
  finesse: 'Finesse',
  leicht: 'Leicht',
  laden: 'Laden',
  schwer: 'Schwer',
  versatil: 'Versatil',
  reichweite: 'Reichweite',
  wurf: 'Wurf',
  zweihändig: 'Zweihändig',
  zweihaendig: 'Zweihändig',
  munition: 'Munition',
  speziell: 'Speziell',
};

const [, , ziel] = process.argv;
if (!ziel) {
  console.log('Weapon.Properties (Text) -> hasProperty-Kanten auf Regelartikel');
  process.exit(0);
}
if (!existsSync(ziel)) {
  console.error(`${ziel} gibt es nicht`);
  process.exit(2);
}

const dateien = readdirSync(ziel).filter((f) => f.endsWith('.json'));
const alle = dateien.map((datei) => ({ datei, e: JSON.parse(readFileSync(join(ziel, datei), 'utf8')) }));

/* Die Regeln, die es schon gibt — nach Name und Alias, klein geschrieben. */
const regelNach = new Map();
for (const { e } of alle) {
  if ((e.interfaces ?? [])[0] !== 'Rule') continue;
  const id = e.components?.Identity ?? {};
  if (id.name) regelNach.set(String(id.name).toLowerCase(), e.id);
  for (const a of id.aliases ?? []) regelNach.set(String(a).toLowerCase(), e.id);
}

/* Die höchste vergebene Regelnummer, damit die neuen weiterzählen. */
let hoechste = 0;
for (const { e } of alle) {
  const m = /^rule-(\d+)$/.exec(String(e.components?.Identity?.id ?? ''));
  if (m) hoechste = Math.max(hoechste, Number(m[1]));
}

const neue = [];
let kanten = 0;
let angelegt = 0;

for (const { e } of alle) {
  const w = e.components?.Weapon;
  if (!w || w[FELD] === undefined) continue;
  const roh = String(w[FELD] ?? '');
  delete w[FELD];

  for (const stueck of roh.split(',').map((x) => x.trim()).filter(Boolean)) {
    const name = NAMEN[stueck.toLowerCase()] ?? stueck.charAt(0).toUpperCase() + stueck.slice(1);
    let id = regelNach.get(name.toLowerCase()) ?? regelNach.get(stueck.toLowerCase());
    if (!id) {
      hoechste += 1;
      id = `r_${slug(name)}`;
      neue.push({
        datei: `${id}.json`,
        e: {
          id,
          interfaces: ['Rule'],
          name,
          components: {
            Identity: { name, id: `rule-${String(hoechste).padStart(4, '0')}`, aliases: [] },
            /* `idea` und nicht `used`: der Text fehlt, und das soll man
               sehen — die Vorbereitungsseite listet Unfertiges. */
            Status: { status: 'idea' },
            Rule: { kind: 'trait' },
            Tags: { tags: ['waffeneigenschaft'] },
          },
          adhoc: [],
          relations: [],
          createdAt: new Date().toISOString(),
        },
      });
      regelNach.set(name.toLowerCase(), id);
      angelegt += 1;
    }
    e.relations = e.relations ?? [];
    if (!e.relations.some((r) => r.type === 'hasProperty' && r.to === id)) {
      e.relations.push({ id: `rel_${e.id}_${slug(name)}`, type: 'hasProperty', to: id, props: {} });
      kanten += 1;
    }
  }

  for (const [k, v] of Object.entries(e.components))
    if (v && typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length) delete e.components[k];
}

for (const { datei, e } of [...alle, ...neue]) {
  writeFileSync(join(ziel, datei), `${JSON.stringify(e, null, 2)}\n`);
}
console.log(`${alle.length} Artikel, ${kanten} Kanten, ${angelegt} Regeln angelegt`);

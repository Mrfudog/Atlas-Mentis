/**
 * **Felder, die niemand füllte, und eine Kante, die niemand zog** (Abgleich
 * A14/A15, 7.10.).
 *
 *   Session.recap      → Story.summary   (an der Sitzung heisst es ohnehin „Recap")
 *   Article.poem, song → Lore.lore       (Prosa ist Prosa; die Überschrift kommt in den Text)
 *   followsFrom        → weg             (Time.sort sagt die Reihenfolge, partOf die Hierarchie)
 *
 * Was dabei wandert, wird aufgezählt; verloren geht nichts.
 *
 *   node felder-ohne-fueller.mjs <verzeichnis-mit-entities>
 *   node felder-ohne-fueller.mjs <export.json> [ziel.json]
 */

import { readFileSync, readdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
const REGISTRY_DIR = resolve(HIER, '..', 'test', 'dbdump', 'registry');

const werte = (v) => (Array.isArray(v) ? v : v == null || v === '' ? [] : [v])
  .map((x) => (x && typeof x === 'object' && 'value' in x ? String(x.value) : String(x))).filter((x) => x.trim());
const eintraege = (texte, prefix) => texte.map((t, i) => ({ id: `${prefix}-${i + 1}-${Math.random().toString(36).slice(2, 6)}`, value: t }));

export function wandereArtikel(e, z) {
  let getan = false;
  const c = e.components ?? {};
  if (c.Session && 'recap' in c.Session) {
    const texte = werte(c.Session.recap);
    if (texte.length) {
      c.Story ??= {};
      c.Story.summary = [c.Story.summary, ...texte].filter((x) => x && String(x).trim()).join('\n\n');
      z.notiert.push(`${e.id} (${e.name}): ${texte.length} Recap-Eintrag/-Einträge → Story.summary`);
    }
    delete c.Session.recap; getan = true;
  }
  if (c.Article && ('poem' in c.Article || 'song' in c.Article)) {
    const neu = [];
    for (const [feld, kopf] of [['poem', 'Gedicht'], ['song', 'Lied']]) {
      for (const t of werte(c.Article[feld])) neu.push(`**${kopf}**\n\n${t}`);
      delete c.Article[feld];
    }
    if (neu.length) {
      c.Lore ??= {};
      c.Lore.lore = (Array.isArray(c.Lore.lore) ? c.Lore.lore : werte(c.Lore.lore).map((v) => ({ id: `lore-${Math.random().toString(36).slice(2, 7)}`, value: v })))
        .concat(eintraege(neu, 'lore'));
      z.notiert.push(`${e.id} (${e.name}): ${neu.length} Gedicht(e)/Lied(er) → Lore.lore`);
    }
    if (!Object.keys(c.Article).length) delete c.Article;
    getan = true;
  }
  const weg = (e.relations ?? []).filter((r) => r.type === 'followsFrom');
  if (weg.length) {
    for (const r of weg) z.notiert.push(`${e.id} (${e.name}): followsFrom → ${r.to} fällt weg (Time.sort trägt die Reihenfolge)`);
    e.relations = e.relations.filter((r) => r.type !== 'followsFrom'); getan = true;
  }
  if (getan) z.artikel += 1;
  return getan;
}

function bericht(z) {
  console.log(`${z.gelesen} Artikel gelesen, ${z.artikel} geändert.`);
  for (const n of z.notiert) console.log(`  · ${n}`);
}

const ziel = process.argv[2];
if (!ziel) { console.error('Verzeichnis oder Ausfuhrdatei angeben.'); process.exit(2); }
const pfad = resolve(ziel);
if (!existsSync(pfad)) { console.error(`${pfad} gibt es nicht.`); process.exit(2); }
const z = { gelesen: 0, artikel: 0, notiert: [] };

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
  for (const e of daten.entities ?? []) { z.gelesen += 1; wandereArtikel(e, z); }
  if (daten.registry) {
    const frisch = {};
    for (const f of readdirSync(REGISTRY_DIR)) if (f.endsWith('.json')) frisch[f.replace(/\.json$/, '')] = JSON.parse(readFileSync(join(REGISTRY_DIR, f), 'utf8'));
    frisch.settings = { ...frisch.settings, ...(daten.registry.settings ?? {}) };
    daten.registry = frisch;
  }
  const raus = resolve(process.argv[3] ?? pfad);
  writeFileSync(raus, `${JSON.stringify(daten, null, 2)}\n`);
  console.log(`geschrieben: ${raus}`);
}
bericht(z);

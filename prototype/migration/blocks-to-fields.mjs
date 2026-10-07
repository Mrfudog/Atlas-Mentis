/**
 * Etappe D6 — ein Block ist ein Feld.
 *
 * Ein Artikel trug bis hierher `blocks: [{blockType, body, anchor}]` neben
 * seinen Karten: Fliesstext, der keinem Feld gehörte, mit einer eigenen
 * Liste erlaubter Arten je Artikelart. Das war ein zweites Ding für
 * dieselbe Arbeit — eine Art musste zweimal sagen, was sie festhält, und
 * eine Ansicht zweimal, was sie zeigt.
 *
 * Jetzt ist die Blockart das Feld: `secret` ist ein Feld mit `many` und
 * langer Eingabe, und seine Einträge tragen die Id, an der die
 * Wissensfreigabe hängt. Das war der Anker.
 *
 *   node blocks-to-fields.mjs <verzeichnis-mit-entities>
 *
 * Zwei Dinge wandern mit, und das zweite ist das, worauf es ankommt:
 *
 * - **Die Reihenfolge.** `order` bestimmte sie; die Einträge stehen danach
 *   in derselben Folge in ihrem Feld.
 * - **Die Freigaben.** Eine Information nannte ihre Blöcke in
 *   `Information.blocks`; die Verweise ziehen nach `Information.fields` um
 *   und heissen dort `Typ.feld#anker`. Ohne diesen Schritt zeigte danach
 *   jede Freigabe ins Leere: der Text wäre da, und die Information hätte
 *   nichts mehr zu verbergen. Genau die Sorte Verlust, die man erst Wochen
 *   später bemerkt.
 */

import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/** Blockart → der Bestandteil und das Feld, die sie jetzt ist. */
export const NACH = {
  paragraph: ['Prose', 'paragraph'],
  note: ['Notes', 'note'],
  lore: ['Lore', 'lore'],
  secret: ['Secrets', 'secret'],
  readaloud: ['ReadAloud', 'readaloud'],
  fact: ['Facts', 'fact'],
  tactics: ['Tactics', 'tactics'],
  /* Die Karte heisst nach der **Art**, die das Feld erklärt, nicht nach der
     Feldgruppe, aus der es zusammengesetzt wurde: `CreatureInfo` ist keine
     Registerzeile, `Creature` ist eine. */
  appearance: ['Creature', 'appearance'],
  personality: ['Creature', 'personality'],
  backstory: ['PlayerCharacter', 'backstory'],
  recap: ['Session', 'recap'],
};

const stub = (text) =>
  String(text || '')
    .replace(/[[\]{}*_#>`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 5)
    .join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9äöüß]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'passage';

/**
 * Die Blöcke eines Artikels in seine Karten schieben.
 *
 * Gibt die Ankertabelle zurück: alter Blockanker → neuer Verweis
 * `Typ.feld#id`. Die brauchen die Informationen im zweiten Durchgang.
 * `null` heisst, dass es nichts zu tun gab.
 */
export function verschiebe(e) {
  if (!Object.prototype.hasOwnProperty.call(e, 'blocks')) return null;
  const bloecke = (Array.isArray(e.blocks) ? e.blocks : [])
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  delete e.blocks;

  const karte = {};
  const belegt = {};
  for (const b of bloecke) {
    const text = String(b.body ?? '').trim();
    if (!text) continue;
    const [typ, feld] = NACH[b.blockType] ?? NACH.paragraph;
    /* Der Anker hielt schon; nur wo er fehlt oder bloss die Id war, wird
       er aus dem Text gebildet — derselbe Text ergibt denselben Anker. */
    let id = b.anchor && b.anchor !== b.id ? String(b.anchor) : `${feld}-${stub(text)}`;
    while (belegt[`${typ}.${feld}#${id}`]) id = `${id}-2`;
    belegt[`${typ}.${feld}#${id}`] = true;
    e.components = e.components || {};
    const c = (e.components[typ] = e.components[typ] || {});
    const liste = Array.isArray(c[feld]) ? c[feld] : [];
    liste.push({ id, value: text });
    c[feld] = liste;
    if (b.anchor) karte[String(b.anchor)] = `${typ}.${feld}#${id}`;
    if (b.id) karte[String(b.id)] = `${typ}.${feld}#${id}`;
  }
  return karte;
}

/**
 * Die Freigaben einer Information nachziehen: `blocks` fällt weg, seine
 * Verweise stehen danach in `fields`.
 */
export function ziehNach(info, karte) {
  const c = info.components?.Information;
  if (!c) return false;
  const alt = Array.isArray(c.blocks) ? c.blocks.map(String) : [];
  const hatte = Object.prototype.hasOwnProperty.call(c, 'blocks');
  if (!hatte) return false;
  delete c.blocks;
  if (!alt.length) return true;
  const felder = Array.isArray(c.fields) ? c.fields.map(String) : [];
  for (const a of alt) {
    const neu = karte[a];
    /* Ein Anker, zu dem es keinen Block mehr gibt, wird **nicht**
       übernommen: ein Verweis ins Leere sähe aus wie eine Freigabe. */
    if (neu && !felder.includes(neu)) felder.push(neu);
  }
  c.fields = felder;
  return true;
}

const [, , ziel] = process.argv;
if (!ziel) {
  console.log('blocks[] -> Typ.feld (many), Information.blocks -> Information.fields');
  process.exit(0);
}
if (!existsSync(ziel)) {
  console.error(`${ziel} gibt es nicht`);
  process.exit(2);
}

const dateien = readdirSync(ziel).filter((f) => f.endsWith('.json'));
const alle = new Map();
for (const datei of dateien) {
  alle.set(datei, JSON.parse(readFileSync(join(ziel, datei), 'utf8')));
}

/* Erster Durchgang: die Blöcke wandern, und je Artikel entsteht eine
   Ankertabelle. Sie bleibt **je Artikel** — Blockids waren nur dort
   eindeutig, und eine gemeinsame Tabelle zöge die Freigabe des einen auf
   den Eintrag des anderen. Das wäre schlimmer als gar keine Wanderung. */
const proArtikel = new Map();
let stellen = 0;
for (const [datei, e] of alle) {
  const karte = verschiebe(e);
  if (!karte) continue;
  proArtikel.set(e.id, karte);
  stellen += Object.keys(karte).length;
  void datei;
}

/* Zweiter Durchgang: die Informationen. Welche Ankertabelle gilt, sagt die
   `knowledge`-Kante des Artikels, an dem die Information hängt. */
let nachgezogen = 0;
for (const [, e] of alle) {
  for (const r of e.relations || []) {
    if (r.type !== 'knowledge') continue;
    const info = [...alle.values()].find((x) => x.id === r.to);
    if (!info) continue;
    if (ziehNach(info, proArtikel.get(e.id) || {})) nachgezogen += 1;
  }
}
/* Und die Informationen, die an keinem Artikel hängen: ihre `blocks`-Liste
   fällt weg, denn es gibt nichts mehr, worauf sie zeigen könnte. */
for (const [, e] of alle) {
  if (e.components?.Information && Object.prototype.hasOwnProperty.call(e.components.Information, 'blocks')) {
    if (ziehNach(e, {})) nachgezogen += 1;
  }
}

for (const [datei, e] of alle) {
  writeFileSync(join(ziel, datei), `${JSON.stringify(e, null, 2)}\n`);
}
console.log(`${alle.size} Artikel, ${stellen} Textstellen, ${nachgezogen} Informationen nachgezogen`);

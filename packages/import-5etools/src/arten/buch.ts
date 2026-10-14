/**
 * **Bücher als Kapitel aus Teilen** (T-108, E-028, E-029, REQ-247).
 *
 * Jedes Buch aus 5e.tools — auch ein Regelbuch, „Chapter 9: Combat" im
 * PHB — wird in seiner Ebene (E-017) ein Satz `Chapter`, je Kapitel der
 * obersten Stufe eines, in der Reihenfolge des Buchs (die Nummer zählt
 * hoch, und die Leseansicht ordnet Kapitel nach ihr). Was im Kapitel
 * steht, wird zu Teilen (`teile.ts`): Überschriften, Absätze, Kästen,
 * Tabellen, und für alles, was schon ein Artikel ist — die Zauber im
 * Kapitel 11, die Zustände im Anhang, die Monster im Monster Manual —
 * ein `Embed`, der darauf zeigt. Nichts wird verdoppelt.
 *
 * Ein Regelbuch bekommt nur Kapitel; ein Abenteuer bekommt dazu seine
 * Geschichte (`abenteuer.ts`). Läuft nach den übrigen Arten, damit jeder
 * Verweis und jeder `Embed` sein Ziel findet.
 */

import type { Entity } from '@nw/model';
import type { Knoten } from '../copy.js';
import type { Abenteuer } from '../lesen.js';
import { legeTeileAn } from '../teile.js';
import type { Werkbank } from '../werkbank.js';
import { zaehle } from '../werkbank.js';

/** Kapitel, die kein Buchtext sind. */
const OHNE_KAPITEL = /^credits$/i;

const name = (e: Knoten): string => (typeof e['name'] === 'string' ? e['name'].trim() : '');

/**
 * „Chapter 9: Combat" wie bei 5e.tools — ausser der Name sagt es schon
 * („Appendix A: Conditions"). Gibt Titel und Ordnungswort zurück.
 */
export function kapitelTitel(n: string, ordinal: Knoten | undefined): { titel: string; ordinal?: string } {
  const art = String(ordinal?.['type'] ?? '').replace(/^./, (c) => c.toUpperCase());
  if (!ordinal || !art) return { titel: n };
  const wort = `${art} ${String(ordinal['identifier'] ?? '')}`.trim();
  return n.toLowerCase().startsWith(art.toLowerCase()) ? { titel: n, ordinal: wort } : { titel: `${wort}: ${n}`, ordinal: wort };
}

/**
 * Die Kapitel eines Buchs anlegen. `herkunft` ist der Präfix der Peg-Ids
 * (`book|phb`); `angelegt` bekommt jeden neuen Artikel (das Abenteuer
 * setzt dort `audience: 'gm'`). Gibt die Kapitel in Reihenfolge zurück.
 */
export function buch(wb: Werkbank, b: Abenteuer, art = 'bookData'): Entity[] {
  const bericht = wb.artBericht(art);
  bericht.gelesen += 1;
  const quelle = String(b.kopf['source'] ?? b.id);
  const ordnung = Array.isArray(b.kopf['contents']) ? (b.kopf['contents'] as Knoten[]) : [];
  const kapitel: Entity[] = [];
  wb.aktuelleArt = art;
  b.daten.forEach((kap, i) => {
    const n = name(kap);
    if (!n || OHNE_KAPITEL.test(n)) {
      if (n) wb.notiz(`Kapitel weggelassen: ${n}`, art);
      return;
    }
    const { titel, ordinal } = kapitelTitel(n, ordnung[i]?.['ordinal'] as Knoten | undefined);
    const k = wb.anlegen('Chapter', titel, `chapter|${quelle.toLowerCase()}|${n.toLowerCase()}|${i}`, { source: quelle, ...(kap['page'] ? { page: kap['page'] } : {}) });
    wb.feld(k, 'Chapter', 'ordinal', ordinal);
    zaehle(bericht.artikel, 'Chapter');
    legeTeileAn(wb, k, Array.isArray(kap['entries']) ? (kap['entries'] as unknown[]) : [], 1, { quelle, ctx: wb.ctx, art }, kap['page']);
    kapitel.push(k);
  });
  return kapitel;
}

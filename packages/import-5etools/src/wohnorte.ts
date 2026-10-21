/**
 * **Wohnorte benannter Kreaturen** (T-182): eine Kreatur, deren Statblock
 * im Text genau eines Ortsabschnitts genannt wird, wohnt dort — `livesIn`.
 *
 * Gelesen wird, was das Buch selbst verknüpft: ein Verweis `[[nummer|…]]`
 * oder ein `Embed` auf den Statblock (oder die Kreatur) in einem Teil
 * (Absatz, Vorlesetext, Überschrift), dessen Szene an genau einem Ort
 * spielt (`happensAt`). Nennen die Texte zweier Orte dieselbe Kreatur,
 * wohnt sie nirgends — „Gefangene in Raum 6 und Raum 12" sagt nicht, wo
 * jemand zu Hause ist, und geraten wird nicht. Auch nicht, wenn die zwei
 * Orte ineinander liegen: ob die Burg oder ihr Turmzimmer gemeint ist,
 * sagt der Text nicht. Ein Wohnort, den schon jemand gesetzt hat, bleibt.
 */

import type { Entity } from '@nw/model';
import type { Werkbank } from './werkbank.js';

/** Die Arten, deren Text zählt. */
const TEXT = new Set(['Paragraph', 'ReadAloudText', 'Heading', 'Embed']);

/** Alle Zeichenketten in den Karten eines Artikels. */
function texte(x: unknown, out: string[] = []): string[] {
  if (typeof x === 'string') out.push(x);
  else if (Array.isArray(x)) for (const y of x) texte(y, out);
  else if (x && typeof x === 'object') for (const y of Object.values(x)) texte(y, out);
  return out;
}

export interface WohnortZahlen {
  /** Benannte Kreaturen, die genau ein Ortsabschnitt nennt — sie bekommen `livesIn`. */
  eindeutig: number;
  /** In mehreren Orten genannt (auch ineinander liegenden): nicht gesetzt. */
  mehrdeutig: number;
  /** In keinem Ortsabschnitt genannt. */
  nirgends: number;
}

/** `livesIn` für die benannten Kreaturen im Bestand der Werkbank. */
export function wohnorte(wb: Werkbank): WohnortZahlen {
  const es = wb.entities;
  const nachNummer = new Map<string, string>();
  const art = new Map<string, string>();
  for (const e of es) {
    art.set(e.id, e.interfaces[0] ?? '');
    const n = (e.components['Identity'] as { id?: unknown } | undefined)?.id;
    if (typeof n === 'string') nachNummer.set(n, e.id);
  }
  const kreaturVon = new Map<string, string>();
  const ortVon = new Map<string, string>();
  for (const e of es) {
    const t = e.interfaces[0];
    if (t === 'Statblock') for (const r of e.relations ?? []) if (r.type === 'belongsTo') kreaturVon.set(e.id, r.to);
    if (t === 'Creature') kreaturVon.set(e.id, e.id);
    if (t === 'Scene') {
      const h = (e.relations ?? []).filter((r) => r.type === 'happensAt');
      if (h.length === 1) ortVon.set(e.id, h[0]!.to);
    }
  }
  const orte = new Map<string, Set<string>>();
  for (const e of es) {
    if (!TEXT.has(e.interfaces[0] ?? '')) continue;
    const ganzes = (e.relations ?? []).find((r) => r.type === 'partOf')?.to;
    const ort = ganzes ? ortVon.get(ganzes) : undefined;
    if (!ort) continue;
    const ziele = new Set<string>();
    const embed = (e.components['Embed'] as { target?: unknown } | undefined)?.target;
    if (typeof embed === 'string') ziele.add(embed);
    for (const s of texte(e.components)) {
      for (const m of s.matchAll(/\[\[([^|\]]+)/g)) {
        const id = nachNummer.get(m[1]!) ?? (art.has(m[1]!) ? m[1]! : undefined);
        if (id) ziele.add(id);
      }
    }
    for (const z of ziele) {
      const k = kreaturVon.get(z);
      if (k) (orte.get(k) ?? orte.set(k, new Set()).get(k)!).add(ort);
    }
  }
  const zahlen: WohnortZahlen = { eindeutig: 0, mehrdeutig: 0, nirgends: 0 };
  for (const e of es) {
    if (e.interfaces[0] !== 'Creature') continue;
    const o = orte.get(e.id);
    if (!o?.size) zahlen.nirgends += 1;
    else if (o.size > 1) {
      zahlen.mehrdeutig += 1;
      wb.notiz('Wohnort: in mehreren Orten genannt, nicht gesetzt (T-182)', 'adventureData');
    } else {
      zahlen.eindeutig += 1;
      if (!(e.relations ?? []).some((r) => r.type === 'livesIn')) wb.kante(e as Entity, 'livesIn', [...o][0]!);
    }
  }
  return zahlen;
}

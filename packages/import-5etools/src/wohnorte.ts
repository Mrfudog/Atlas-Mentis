/**
 * **Wohnorte benannter Kreaturen** (T-182): eine Kreatur, deren Statblock
 * im Text genau eines Ortsabschnitts genannt wird, wohnt dort — `livesIn`.
 *
 * Gelesen wird, was das Buch selbst verknüpft: ein Verweis `[[nummer|…]]`
 * oder ein `Embed` auf den Statblock (oder die Kreatur) in einem Teil
 * (Absatz, Vorlesetext, Überschrift), dessen Szene an genau einem Ort
 * spielt (`happensAt`). **Eine Überschrift wechselt den Ort:** steht in
 * einer Szene „Locations in …" eine Überschrift, die selbst einen Ort
 * beschreibt, gehört der Text danach zu ihm; eine Überschrift ohne Ort
 * beendet die Zuordnung, bis die nächste kommt. **Eine Sammelstelle ist
 * kein Zuhause:** fallen einem Ort mehr als drei benannte Kreaturen zu
 * (eine Übersichtskarte, eine Stadt mit ihren Ansprechpartnern), bekommt
 * keine davon ihn als Wohnort. Nennen die Texte zweier Orte dieselbe Kreatur,
 * wohnt sie nirgends — „Gefangene in Raum 6 und Raum 12" sagt nicht, wo
 * jemand zu Hause ist, und geraten wird nicht. Auch nicht, wenn die zwei
 * Orte ineinander liegen: ob die Burg oder ihr Turmzimmer gemeint ist,
 * sagt der Text nicht. Ein Wohnort, den schon jemand gesetzt hat, bleibt.
 */

import type { Entity } from '@nw/model';
import type { Werkbank } from './werkbank.js';

/** Mehr eindeutig genannte Kreaturen an einem Ort, und er ist eine Sammelstelle. */
const HOECHSTENS = 3;

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
  /** Nur in einem Ort genannt, der mehr als `HOECHSTENS` benannte Kreaturen nennt. */
  sammelstelle: number;
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
  /** Welche Überschrift welchen Ort beschreibt. */
  const ortDerUeberschrift = new Map<string, string>();
  for (const e of es) {
    if (e.interfaces[0] !== 'Place') continue;
    for (const r of e.relations ?? []) if (r.type === 'describedIn' && art.get(r.to) === 'Heading') ortDerUeberschrift.set(r.to, e.id);
  }
  /* Die Teile je Szene in ihrer Reihenfolge, und je Teil der Ort, der dort gilt. */
  const teile = new Map<string, { e: Entity; rang: number }[]>();
  for (const e of es) {
    if (!TEXT.has(e.interfaces[0] ?? '')) continue;
    const r = (e.relations ?? []).find((x) => x.type === 'partOf');
    if (!r || !ortVon.has(r.to)) continue;
    const rang = Number((r.props as { rank?: unknown } | undefined)?.rank ?? 0);
    (teile.get(r.to) ?? teile.set(r.to, []).get(r.to)!).push({ e, rang });
  }
  const orte = new Map<string, Set<string>>();
  const bewohner = new Map<string, Set<string>>();
  for (const [szene, liste] of teile) {
    liste.sort((a, b) => a.rang - b.rang);
    let ort: string | undefined = ortVon.get(szene);
    for (const { e } of liste) {
      if (e.interfaces[0] === 'Heading') ort = ortDerUeberschrift.get(e.id);
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
        if (!k) continue;
        (orte.get(k) ?? orte.set(k, new Set()).get(k)!).add(ort);
      }
    }
  }
  for (const [k, o] of orte) if (o.size === 1) {
    const ort = [...o][0]!;
    (bewohner.get(ort) ?? bewohner.set(ort, new Set()).get(ort)!).add(k);
  }
  const zahlen: WohnortZahlen = { eindeutig: 0, mehrdeutig: 0, sammelstelle: 0, nirgends: 0 };
  for (const e of es) {
    if (e.interfaces[0] !== 'Creature') continue;
    const o = orte.get(e.id);
    if (!o?.size) zahlen.nirgends += 1;
    else if (o.size > 1) {
      zahlen.mehrdeutig += 1;
      wb.notiz('Wohnort: in mehreren Orten genannt, nicht gesetzt (T-182)', 'adventureData');
    } else if ((bewohner.get([...o][0]!)?.size ?? 0) > HOECHSTENS) {
      zahlen.sammelstelle += 1;
      wb.notiz(`Wohnort: Ort nennt mehr als ${HOECHSTENS} benannte Kreaturen, nicht gesetzt (T-182)`, 'adventureData');
    } else {
      zahlen.eindeutig += 1;
      if (!(e.relations ?? []).some((r) => r.type === 'livesIn')) wb.kante(e as Entity, 'livesIn', [...o][0]!);
    }
  }
  return zahlen;
}

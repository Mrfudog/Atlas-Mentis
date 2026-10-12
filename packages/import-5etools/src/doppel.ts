/**
 * **Doppel nach dem Füllen** (Entscheidung 12.10.2026, Abgleich §4.2).
 *
 * Zwei Sorten Doppel bleiben nach dem ersten Lauf stehen, und beide sind
 * erst zu erkennen, wenn die Artikel gefüllt sind:
 *
 *  1. **Gleiche Merkmale an verschiedenen Trägern.** „Ability Score
 *     Improvement" stand je Klasse einmal da, obwohl der Text nach dem
 *     Ersetzen der Stufen derselbe ist — die Stufe steht an der Kante
 *     (`grants.props.level`, D50). Gleiche Art, gleicher Name, gleiche
 *     Karten (ausser Nummer und Fundstelle) heisst: ein Artikel, und die
 *     Kanten zeigen auf ihn.
 *  2. **Fassungen desselben Dings aus mehreren Büchern.** MPMM druckt die
 *     Monster aus Volo und Mordenkainen neu, die Settingbücher bringen
 *     ihre eigene Fassung von Common oder Auril. Eine Fassung gilt, die
 *     anderen werden **Varianten** (`variantOf`) mit dem Buch im Namen —
 *     wählbar, wo jemand die alte will, und `[[Mind Flayer]]` bleibt
 *     eindeutig. Eine Variante ist eine Kopie mit Herkunft und keine
 *     Instanz: beide Fassungen sind Buchtext und ändern sich nicht, und
 *     eine Hausregel an der neuen soll die alte nicht still mitändern.
 */

import type { Entity } from '@nw/model';
import type { Datenstand } from './lesen.js';
import type { Bericht } from './werkbank.js';
import { zaehle } from './werkbank.js';

type Karten = Record<string, Record<string, unknown>>;

const nummerVon = (e: Entity) => String((e.components['Identity'] as { id?: string } | undefined)?.id ?? '');
const quelleVon = (e: Entity) => String((e.components['Source'] as { publication?: string } | undefined)?.publication ?? '');

/** Verweise in allen Artikeln umhängen: Kanten, Verweisfelder, `[[nummer|…]]` im Text. */
function umhaengen(entities: Entity[], pegs: Map<string, string>, nummern: Map<string, string>): void {
  if (!pegs.size) return;
  const muster = nummern.size
    ? new RegExp(`\\[\\[(${[...nummern.keys()].map((n) => n.replace(/[-]/g, '\\-')).join('|')})(?=[|\\]])`, 'g')
    : null;
  const wert = (v: unknown): unknown => {
    if (typeof v === 'string') {
      if (pegs.has(v)) return pegs.get(v);
      return muster && v.includes('[[') ? v.replace(muster, (_m, n: string) => `[[${nummern.get(n)}`) : v;
    }
    if (Array.isArray(v)) return v.map(wert);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, wert(x)]));
    return v;
  };
  for (const e of entities) {
    e.components = wert(e.components) as Karten;
    if (!e.relations) continue;
    const gesehen = new Set<string>();
    e.relations = e.relations
      .map((r) => (pegs.has(r.to) ? { ...r, to: pegs.get(r.to)! } : r))
      .filter((r) => {
        /* Zwei Kanten, die nach dem Umhängen gleich sind, sind eine. */
        const k = JSON.stringify([r.type, r.to, r.props ?? {}]);
        if (gesehen.has(k)) return false;
        gesehen.add(k);
        return true;
      });
  }
}

/** Die Arten, deren gleiche Artikel zu einem werden (1). */
const VEREINBAR = ['Feature', 'Action'];

/**
 * (1) Gleiche Merkmale vereinen. Es bleibt der zuerst angelegte — die
 * Kernbücher kommen zuerst, also trägt er die kleinere Nummer und die
 * Fundstelle, an der der Text zuerst stand. Steht er irgendwo im SRD, ist
 * der Text SRD-Text.
 */
export function vereineGleiche(entities: Entity[], bericht: Bericht): Entity[] {
  const erster = new Map<string, Entity>();
  const pegs = new Map<string, string>();
  const nummern = new Map<string, string>();
  for (const e of entities) {
    const typ = e.interfaces[0] ?? '';
    if (!VEREINBAR.includes(typ)) continue;
    const { Identity: _i, Source: _s, ...rest } = e.components;
    const schluessel = `${typ}\u0000${e.name}\u0000${JSON.stringify(rest)}`;
    const da = erster.get(schluessel);
    if (!da) {
      erster.set(schluessel, e);
      continue;
    }
    pegs.set(e.id, da.id);
    nummern.set(nummerVon(e), nummerVon(da));
    if ((e.components['Source'] as { srd?: boolean } | undefined)?.srd) {
      (da.components['Source'] as Record<string, unknown>)['srd'] = true;
    }
    zaehle(bericht.vereint, typ);
  }
  const raus = entities.filter((e) => !pegs.has(e.id));
  umhaengen(raus, pegs, nummern);
  return raus;
}

/** Was eine Art ist, die Fassungen hat (2). Merkmale und Aktionen nicht — die vereint (1). */
const MIT_FASSUNGEN = new Set([
  'Statblock', 'Spell', 'Item', 'Weapon', 'Armor', 'Ancestry', 'Background', 'Feat', 'Language',
  'Rule', 'Deity', 'Hazard', 'Disease', 'Class', 'Subclass', 'Table', 'Condition',
]);

/** Die Kernbücher: ihre Fassung gilt vor einer aus einem Settingbuch. */
const KERN = ['PHB', 'DMG', 'MM'];

/**
 * Welche Fassung gilt. Drei Regeln, und die Reihenfolge ist die Regel:
 * ein **Nachdruck** vor dem, was er nachdruckt — das sagt 5e.tools selbst
 * (`reprintedAs`, MPMM für Volo und Mordenkainen, PaBTSO für LMoP); sonst
 * ein **Kernbuch** vor allem anderen; sonst die **neuste**.
 *
 * `nachdruck` nennt je Artikel die Bücher, in die sein Eintrag neu
 * gedruckt wurde. Gilt der, der in der Gruppe nachgedruckt wurde und selbst
 * nicht weiter — das Ende der Kette.
 */
export function geltendeFassung(
  gruppe: Entity[],
  stand: Pick<Datenstand, 'quellen'>,
  nachdruck: (e: Entity) => string[] = () => [],
): Entity {
  const kl = (q: string) => q.toLowerCase();
  const quellen = new Set(gruppe.map((e) => kl(quelleVon(e))));
  const weiter = (e: Entity) => nachdruck(e).map(kl).filter((q) => quellen.has(q));
  const ziele = new Set(gruppe.flatMap(weiter));
  const ende = gruppe.find((e) => ziele.has(kl(quelleVon(e))) && !weiter(e).length);
  if (ende) return ende;
  for (const k of KERN) {
    const kern = gruppe.find((e) => quelleVon(e) === k);
    if (kern) return kern;
  }
  const erschienen = (e: Entity) => stand.quellen.get(quelleVon(e).toLowerCase())?.published ?? '';
  return [...gruppe].sort((a, b) => (erschienen(b) < erschienen(a) ? -1 : erschienen(b) > erschienen(a) ? 1 : 0))[0]!;
}

/**
 * (2) Fassungen: gleiche Art, gleicher Name, mehr als ein Buch. Die
 * geltende behält den Namen; jede andere heisst „Name (Buch)" und zeigt
 * mit `variantOf` auf sie. Zwei gleichnamige aus **demselben** Buch sind
 * zwei Dinge (der DMG hat fünfzehn solcher Tabellen) und bleiben.
 */
export function fassungen(
  entities: Entity[],
  stand: Pick<Datenstand, 'quellen'>,
  bericht: Bericht,
  nachdruck: (e: Entity) => string[] = () => [],
): void {
  const gruppen = new Map<string, Entity[]>();
  for (const e of entities) {
    const typ = e.interfaces[0] ?? '';
    if (!MIT_FASSUNGEN.has(typ) || !quelleVon(e)) continue;
    const k = `${typ}\u0000${e.name.toLowerCase()}`;
    const g = gruppen.get(k) ?? [];
    g.push(e);
    gruppen.set(k, g);
  }
  for (const gruppe of gruppen.values()) {
    if (new Set(gruppe.map(quelleVon)).size < 2) continue;
    const gilt = geltendeFassung(gruppe, stand, nachdruck);
    for (const e of gruppe) {
      if (e === gilt || quelleVon(e) === quelleVon(gilt)) continue;
      const name = `${e.name} (${quelleVon(e)})`;
      e.name = name;
      (e.components['Identity'] as Record<string, unknown>)['name'] = name;
      /* Eine aufgelöste Kopie zeigt schon auf ihr Original — eine Kante
         `variantOf` je Artikel (one). */
      if (!(e.relations ?? []).some((r) => r.type === 'variantOf')) {
        const liste = (e.relations ??= []);
        liste.push({ id: `variantOf-${liste.length + 1}`, type: 'variantOf', to: gilt.id });
      }
      zaehle(bericht.fassungen, e.interfaces[0] ?? '');
    }
  }
}

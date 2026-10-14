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

/**
 * Was die Doppel über einen Artikel wissen müssen. `teilung` trennt den
 * Grundstand vom Rest (T-087, `Werkbank.teilung`): leer heisst Grundstand.
 * `kennung` ist das Buch, nach dem eine Fassung heisst — ihre Quelle, oder
 * „PHB, XPHB", wenn sie in einer anderen Ebene liegt.
 */
export interface DoppelWissen {
  nachdruck?: (e: Entity) => string[];
  teilung?: (e: Entity) => string;
  kennung?: (e: Entity) => string;
}

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
export function vereineGleiche(entities: Entity[], bericht: Bericht, teilung: (e: Entity) => string = () => ''): Entity[] {
  const erster = new Map<string, Entity>();
  const pegs = new Map<string, string>();
  const nummern = new Map<string, string>();
  for (const e of entities) {
    const typ = e.interfaces[0] ?? '';
    if (!VEREINBAR.includes(typ)) continue;
    const { Identity: _i, Source: _s, ...rest } = e.components;
    /* Nur innerhalb einer Teilung (T-087): ein 2024-Merkmal mit dem Text
       des 2014-Merkmals gehört trotzdem in seine Ebene. */
    const t = teilung(e);
    const schluessel = `${t ? `${t}\u0000` : ''}${typ}\u0000${e.name}\u0000${JSON.stringify(rest)}`;
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

/** Die Kernbücher: ihre Fassung gilt vor einer aus einem Settingbuch —
 *  die von 2024 erst, wo keine von 2014 mitspielt (T-087). */
const KERN = ['PHB', 'DMG', 'MM', 'XPHB', 'XDMG', 'XMM'];

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
  wissen: DoppelWissen = {},
): void {
  const nachdruck = wissen.nachdruck ?? (() => []);
  const kennung = wissen.kennung ?? quelleVon;
  const teilung = wissen.teilung ?? (() => '');
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
    if (new Set(gruppe.map(kennung)).size < 2) continue;
    /* **Die Grundfassung ist die des Grundstands** (T-087, E-021 d): der
       2014-Fireball behält seinen Namen, auch wenn 5e.tools ihn ins
       2024-PHB nachgedruckt nennt. Sonst hiesse ein Artikel, den
       Kampagnen schon nennen, auf einmal anders, und `[[Fireball]]` träfe
       den, den niemand gemeint hat. */
    const imGrund = gruppe.filter((e) => !teilung(e));
    const gilt = geltendeFassung(imGrund.length ? imGrund : gruppe, stand, nachdruck);
    for (const e of gruppe) {
      if (e === gilt || kennung(e) === kennung(gilt)) continue;
      const name = `${e.name} (${kennung(e)})`;
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

/**
 * **Woher ein Monstermerkmal kommt** (Entscheidung 12.10.2026). Der Ork im
 * Monster Manual ist „Aggressive", weil Orks es sind — das Volksmerkmal
 * steht an der Abstammung. Das Merkmal des Statblocks zeigt darum mit
 * `variantOf` auf das gleichnamige Volksmerkmal, aber nur, wenn ein
 * Statblock, der es trägt, zu diesem Volk gehört (`humanoid (orc)` und
 * Orc, Half-Orc). Ohne die Bedingung hätte jedes amphibische Krokodil
 * seine Herkunft bei den Tritonen.
 *
 * Gezeigt wird die Herkunft auch in der anderen Richtung, ohne dass etwas
 * gespeichert wird: wer ein gemeinsames Merkmal aufschlägt, sieht seine
 * Träger nach Kreaturentyp (Prototyp, `usedByType`).
 */
export function herkunft(
  entities: Entity[],
  stand: Pick<Datenstand, 'quellen'>,
  bericht: Bericht,
  wissen: DoppelWissen = {},
): void {
  const nachdruck = wissen.nachdruck ?? (() => []);
  const teilung = wissen.teilung ?? (() => '');
  const nachId = new Map(entities.map((e) => [e.id, e]));
  const volk = (name: string) => name.toLowerCase().replace(/\s*\(.*\)\s*$/, '').replace(/^half-/, '').split(/[\s-]+/).pop() ?? '';
  /* Volksmerkmale nach Name, mit den Völkern, die sie gewähren. */
  const voelkerVon = new Map<string, string[]>();
  const nutzer = new Map<string, Entity[]>();
  for (const e of entities) {
    for (const r of e.relations ?? []) {
      if (r.type === 'grants' && e.interfaces[0] === 'Ancestry') voelkerVon.set(r.to, [...(voelkerVon.get(r.to) ?? []), volk(e.name)]);
      if (r.type === 'composedOf' && e.interfaces[0] === 'Statblock') nutzer.set(r.to, [...(nutzer.get(r.to) ?? []), e]);
    }
  }
  const volksmerkmale = new Map<string, Entity[]>();
  for (const id of voelkerVon.keys()) {
    const f = nachId.get(id);
    if (!f || f.interfaces[0] !== 'Feature') continue;
    const k = f.name.toLowerCase();
    volksmerkmale.set(k, [...(volksmerkmale.get(k) ?? []), f]);
  }
  for (const [id, traeger] of nutzer) {
    const m = nachId.get(id);
    if (!m || (m.relations ?? []).some((r) => r.type === 'variantOf')) continue;
    /* Ein Angriff kommt nicht von einem Volk — der Biss des Wolfs ist nicht
       der der Echsenmenschen. */
    if (Array.isArray((m.components['Action'] as Record<string, unknown> | undefined)?.['attack'])) continue;
    const kandidaten = volksmerkmale.get(m.name.toLowerCase());
    if (!kandidaten) continue;
    const typen = traeger.map((s) => String((s.components['Statblock'] as Record<string, unknown> | undefined)?.['creatureType'] ?? '').toLowerCase());
    /* Nur aus derselben Teilung (T-087): der 2014-Ork hat seine Herkunft bei der 2014-Abstammung. */
    const passend = kandidaten.filter((f) => teilung(f) === teilung(m) && (voelkerVon.get(f.id) ?? []).some((v) => v && typen.some((t) => new RegExp(`\\b${v}\\b`).test(t))));
    if (!passend.length) continue;
    const gilt = geltendeFassung(passend, stand, nachdruck);
    const liste = (m.relations ??= []);
    liste.push({ id: `variantOf-${liste.length + 1}`, type: 'variantOf', to: gilt.id });
    bericht.herkunft += 1;
  }
}

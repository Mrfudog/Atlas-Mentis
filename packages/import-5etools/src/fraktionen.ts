/**
 * **Fraktionen benannter Kreaturen** (T-183, Folge von T-169): eine
 * Kreatur ist Mitglied einer Fraktion (`memberOf`), wenn der Text genau
 * eine Fraktion mit ihr verbindet.
 *
 * Gelesen wird nur, was das Buch selbst verknüpft, also ein Verweis
 * `[[nummer|…]]`, und zwar an zwei Stellen: im eigenen Text der Kreatur
 * (ihre Karten und die ihres Statblocks) ein Verweis auf die Fraktion,
 * oder im Text der Fraktion ein Verweis auf die Kreatur bzw. ihren
 * Statblock. Dass beide im selben Abenteuerabsatz stehen, zählt nicht:
 * „die Zhentarim jagen Mira" macht Mira nicht zur Zhentarim.
 *
 * **Ein Schutzherr ist kein Mitglied.** Trägt eine Fraktion den Namen der
 * Kreatur („Cult of X" für X), betet sie die Kreatur an und hat sie nicht
 * als Mitglied. Eine solche Kreatur bekommt gar keine Fraktion aus dem
 * Text, denn ihr Text spricht auch über die Kulte ihrer Rivalen. Wie der
 * Schutzherr stattdessen an seinem Kult steht, ist offen (Entscheid zu
 * T-183). **Nennen zwei Fraktionen dieselbe Kreatur, gehört sie keiner**:
 * geraten wird nicht. Eine Mitgliedschaft, die schon jemand gesetzt hat,
 * bleibt stehen.
 */

import type { Entity } from '@nw/model';
import type { Werkbank } from './werkbank.js';

/** Alle Zeichenketten in den Karten eines Artikels. */
function texte(x: unknown, out: string[] = []): string[] {
  if (typeof x === 'string') out.push(x);
  else if (Array.isArray(x)) for (const y of x) texte(y, out);
  else if (x && typeof x === 'object') for (const y of Object.values(x)) texte(y, out);
  return out;
}

/** Die Verweisziele (`[[nummer|…]]` oder `[[id|…]]`) in den Karten eines Artikels. */
function verweise(e: Entity, nachNummer: Map<string, string>, ids: Set<string>): Set<string> {
  const ziele = new Set<string>();
  for (const s of texte(e.components)) {
    for (const m of s.matchAll(/\[\[([^|\]]+)/g)) {
      const id = nachNummer.get(m[1]!) ?? (ids.has(m[1]!) ? m[1]! : undefined);
      if (id) ziele.add(id);
    }
  }
  return ziele;
}

/** Der Name ohne die Klammer am Ende („Mira (LMoP)" → „Mira"), klein. */
const kern = (name: string): string => name.replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase();

/** Trägt die Fraktion den Namen der Kreatur als ganzes Wort? */
function schutzherrVon(kreatur: string, fraktion: string): boolean {
  const k = kern(kreatur);
  if (k.length < 3) return false;
  const muster = new RegExp(`(^|[^\\p{L}])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}])`, 'iu');
  return muster.test(fraktion);
}

export type FraktionsUrteil =
  | { art: 'eindeutig'; fraktion: string }
  | { art: 'schutzherr'; fraktionen: string[] }
  | { art: 'mehrdeutig'; fraktionen: string[] }
  | { art: 'keine' };

/**
 * Je benannter Kreatur das Urteil: welche Fraktion, oder warum keine.
 * Rein über die Artikel, damit der Importer und ein Lauf gegen eine
 * Ausfuhrdatei dasselbe rechnen.
 */
export function fraktionsUrteile(es: readonly Entity[]): Map<string, FraktionsUrteil> {
  const nachNummer = new Map<string, string>();
  const ids = new Set<string>();
  const nachId = new Map<string, Entity>();
  for (const e of es) {
    ids.add(e.id);
    nachId.set(e.id, e);
    const n = (e.components['Identity'] as { id?: unknown } | undefined)?.id;
    if (typeof n === 'string') nachNummer.set(n, e.id);
  }
  const art = (id: string) => nachId.get(id)?.interfaces[0];
  /* Die Kreatur zu jedem Statblock, der ihr gehört, und zu sich selbst. */
  const kreaturVon = new Map<string, string>();
  const statbloecke = new Map<string, Entity[]>();
  for (const e of es) {
    if (e.interfaces[0] === 'Creature') kreaturVon.set(e.id, e.id);
    if (e.interfaces[0] !== 'Statblock') continue;
    for (const r of e.relations ?? []) {
      if (r.type !== 'belongsTo') continue;
      kreaturVon.set(e.id, r.to);
      (statbloecke.get(r.to) ?? statbloecke.set(r.to, []).get(r.to)!).push(e);
    }
  }
  const genannt = new Map<string, Set<string>>();
  const nenne = (kreatur: string, fraktion: string) => (genannt.get(kreatur) ?? genannt.set(kreatur, new Set()).get(kreatur)!).add(fraktion);
  for (const e of es) {
    const t = e.interfaces[0];
    if (t === 'Creature') {
      for (const quelle of [e, ...(statbloecke.get(e.id) ?? [])]) {
        for (const z of verweise(quelle, nachNummer, ids)) if (art(z) === 'Faction') nenne(e.id, z);
      }
    } else if (t === 'Faction') {
      for (const z of verweise(e, nachNummer, ids)) {
        const k = kreaturVon.get(z);
        if (k) nenne(k, e.id);
      }
    }
  }
  const urteile = new Map<string, FraktionsUrteil>();
  for (const e of es) {
    if (e.interfaces[0] !== 'Creature') continue;
    const f = [...(genannt.get(e.id) ?? [])];
    const name = String((e.components['Identity'] as { name?: unknown } | undefined)?.name ?? e.name ?? '');
    if (!f.length) urteile.set(e.id, { art: 'keine' });
    else if (f.some((x) => schutzherrVon(name, nachId.get(x)?.name ?? ''))) urteile.set(e.id, { art: 'schutzherr', fraktionen: f });
    else if (f.length > 1) urteile.set(e.id, { art: 'mehrdeutig', fraktionen: f });
    else urteile.set(e.id, { art: 'eindeutig', fraktion: f[0]! });
  }
  return urteile;
}

export interface FraktionsZahlen {
  /** Genau eine Fraktion verbunden — `memberOf`. */
  eindeutig: number;
  /** Eine Fraktion trägt den Namen der Kreatur: nicht gesetzt. */
  schutzherr: number;
  /** Mehrere Fraktionen verbunden: nicht gesetzt. */
  mehrdeutig: number;
  /** Keine Fraktion verbunden. */
  keine: number;
}

/** `memberOf` für die benannten Kreaturen im Bestand der Werkbank. */
export function fraktionen(wb: Werkbank): FraktionsZahlen {
  const zahlen: FraktionsZahlen = { eindeutig: 0, schutzherr: 0, mehrdeutig: 0, keine: 0 };
  const nachId = new Map(wb.entities.map((e) => [e.id, e]));
  for (const [id, u] of fraktionsUrteile(wb.entities)) {
    zahlen[u.art] += 1;
    if (u.art === 'schutzherr') wb.notiz('Fraktion: Kreatur ist Schutzherr eines Kults, nicht gesetzt (T-183)', 'monster');
    if (u.art === 'mehrdeutig') wb.notiz('Fraktion: mehrere Fraktionen genannt, nicht gesetzt (T-183)', 'monster');
    if (u.art !== 'eindeutig') continue;
    const k = nachId.get(id)!;
    if (!(k.relations ?? []).some((r) => r.type === 'memberOf')) wb.kante(k, 'memberOf', u.fraktion);
  }
  return zahlen;
}

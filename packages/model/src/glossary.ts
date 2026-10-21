/**
 * **Das Glossar** (T-242): Begriffe mit Definition, Wirkung, Beispielen und
 * Übersetzungen, im Text erkannt und nachschlagbar.
 *
 * Zwei Quellen, eine Form: die Wörter der App stehen im Repo
 * (`@nw/registry`, `APP_TERMS`), Spielbegriffe und eigene als Artikel der
 * Art `GlossaryTerm` in ihrer Ebene. Der Server legt beide zu
 * `GlossaryEntry` zusammen (`GET /api/glossary`); hier steht, wie ein
 * Artikel zu einem Eintrag wird und wie ein Text nach Begriffen abgesucht
 * wird — für Server (Nennungen) und Oberfläche (Erkennung) dieselbe Rechnung.
 *
 * **Erkannt wird nur, was es sagt** (`Rule.autolink`, REQ-175) und nur ein
 * Glossarartikel: die Wörter der App („Field", „Type") stünden sonst in
 * jedem Regeltext unterstrichen, und ein falscher Treffer kostet mehr
 * Vertrauen, als zehn richtige einbringen.
 */

import { articleId, entityName } from './entity.js';
import type { Entity, Registry } from './types.js';

/** Die Sorten eines Glossareintrags, in der Reihenfolge des Filters im
 *  Handbuch. `type` tragen nur die Wörter der App (eine Artikelart); die
 *  übrigen sind die Werte von `GlossaryTerm.sort`. */
export const GLOSSARY_SORTS = [
  { key: 'app', label: 'App term' },
  { key: 'type', label: 'Article type' },
  { key: 'rule', label: 'Rule term' },
  { key: 'condition', label: 'Condition' },
  { key: 'property', label: 'Property' },
  { key: 'action', label: 'Action type' },
  { key: 'other', label: 'Other' },
] as const;

export type GlossarySort = (typeof GLOSSARY_SORTS)[number]['key'];

/** Die Beschriftung einer Sorte; eine unbekannte steht, wie sie heisst. */
export function glossarySortLabel(key: string): string {
  return GLOSSARY_SORTS.find((s) => s.key === key)?.label ?? key;
}

export interface GlossaryTranslation {
  lang: string;
  term: string;
  definition?: string;
}

export interface GlossaryEntry {
  /** Die Artikel-Id — oder `app:<slug>` für ein Wort der App. */
  id: string;
  /** Der Bezeichner (`Identity.id`, `gls-0003`), den ein Verweis nennt. */
  number?: string;
  term: string;
  aliases: string[];
  sort: string;
  definition: string;
  effect?: string;
  examples: string[];
  translations: GlossaryTranslation[];
  /** Worauf der Begriff zeigt (`explains`), soweit sichtbar. */
  explains: { id: string; name: string }[];
  /** Die Artikelarten, die ein App-Eintrag erklärt. */
  types?: string[];
  /** Weiter im Handbuch oder auf einer Seite. */
  see?: string;
  /** Im Fliesstext erkennen (`Rule.autolink`); Wörter der App nie. */
  autolink: boolean;
  /** Ein Artikel (mit eigener Seite) oder ein Wort der App. */
  article: boolean;
}

/** Die Id eines App-Eintrags aus seinem Begriff. */
export function appTermId(term: string): string {
  return `app:${term
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '')}`;
}

const texte = (v: unknown): string[] => {
  if (typeof v === 'string') return v.trim() ? [v] : [];
  if (Array.isArray(v)) return v.flatMap((x) => (x && typeof x === 'object' && 'value' in x ? texte((x as { value: unknown }).value) : texte(x)));
  return [];
};

/**
 * Ein Glossarartikel als Eintrag. `names` gibt die Namen der Ziele von
 * `explains` — nur, was dieser Betrachter sieht; ein Ziel ohne Namen
 * fällt weg.
 */
export function glossaryEntryOf(e: Entity, names: (id: string) => string | undefined): GlossaryEntry {
  const c = e.components ?? {};
  const info = (c['GlossaryTerm'] ?? {}) as Record<string, unknown>;
  const aliases = c['Identity']?.['aliases'];
  const uebersetzt = Array.isArray(info['translations']) ? (info['translations'] as Record<string, unknown>[]) : [];
  const effect = texte(info['effect'])[0];
  return {
    id: e.id,
    ...(articleId(e) && articleId(e) !== e.id ? { number: articleId(e) } : {}),
    term: entityName(e),
    aliases: Array.isArray(aliases) ? aliases.map(String).filter((a) => a.trim()) : [],
    sort: typeof info['sort'] === 'string' ? info['sort'] : 'rule',
    definition: texte(c['Description']?.['description'])[0] ?? '',
    ...(effect ? { effect } : {}),
    examples: texte(info['example']),
    translations: uebersetzt
      .filter((t) => typeof t?.['lang'] === 'string' && typeof t?.['term'] === 'string')
      .map((t) => ({
        lang: String(t['lang']),
        term: String(t['term']),
        ...(typeof t['definition'] === 'string' && t['definition'].trim() ? { definition: t['definition'] } : {}),
      })),
    explains: (e.relations ?? [])
      .filter((r) => r.type === 'explains')
      .map((r) => ({ id: r.to, name: names(r.to) }))
      .filter((x): x is { id: string; name: string } => !!x.name),
    autolink: c['Rule']?.['autolink'] !== false,
    article: true,
  };
}

/** Ein Stück Text: gewöhnlich oder ein erkannter Begriff. */
export type TermPiece = { kind: 'text'; text: string } | { kind: 'term'; text: string; id: string };

export interface TermIndex {
  /** Ein regulärer Ausdruck über alle Namen, längste zuerst; `null` ohne Begriffe. */
  muster: RegExp | null;
  /** Kleingeschriebener Name → Id; mehrdeutige Namen fehlen. */
  ids: Map<string, string>;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Der Suchindex über Name und Aliasse der Einträge, die erkannt werden
 * dürfen. **Ein Name, den zwei Einträge tragen, wird nicht erkannt** —
 * dieselbe Regel wie beim Verweis (M11): der erste Treffer wäre bei zwei
 * gleichnamigen der falsche.
 */
export function termIndex(entries: readonly GlossaryEntry[], alle = false): TermIndex {
  const zaehl = new Map<string, Set<string>>();
  for (const e of entries) {
    if (!alle && (!e.autolink || !e.article)) continue;
    for (const n of [e.term, ...e.aliases]) {
      const k = n.trim().toLowerCase();
      if (k.length < 3) continue;
      (zaehl.get(k) ?? zaehl.set(k, new Set()).get(k)!).add(e.id);
    }
  }
  const ids = new Map<string, string>();
  for (const [k, s] of zaehl) if (s.size === 1) ids.set(k, [...s][0]!);
  const namen = [...ids.keys()].sort((a, b) => b.length - a.length);
  return {
    ids,
    muster: namen.length ? new RegExp(`(?<![\\p{L}\\p{N}])(?:${namen.map(escape).join('|')})(?![\\p{L}\\p{N}])`, 'giu') : null,
  };
}

/** Einen Text in gewöhnliche Stücke und erkannte Begriffe zerlegen. */
export function spotTerms(text: string, index: TermIndex): TermPiece[] {
  if (!index.muster || !text) return [{ kind: 'text', text }];
  const out: TermPiece[] = [];
  let pos = 0;
  for (const m of text.matchAll(index.muster)) {
    const id = index.ids.get(m[0].toLowerCase());
    if (!id || m.index === undefined) continue;
    if (m.index > pos) out.push({ kind: 'text', text: text.slice(pos, m.index) });
    out.push({ kind: 'term', text: m[0], id });
    pos = m.index + m[0].length;
  }
  if (pos < text.length) out.push({ kind: 'text', text: text.slice(pos) });
  return out.length ? out : [{ kind: 'text', text }];
}

/** Alle Texte eines Artikels ausser seinem Namen — worin ein Begriff genannt sein kann. */
export function textsOf(e: Entity): string[] {
  const out: string[] = [];
  const lauf = (v: unknown): void => {
    if (typeof v === 'string') out.push(v);
    else if (Array.isArray(v)) v.forEach(lauf);
    else if (v && typeof v === 'object') Object.values(v).forEach(lauf);
  };
  for (const [karte, felder] of Object.entries(e.components ?? {})) {
    if (karte === 'Identity' || karte.startsWith('__')) continue;
    lauf(felder);
  }
  return out;
}

/**
 * **Nennt dieser Artikel den Begriff?** Ein Verweis auf seine Id
 * (`[[gls-0003|…]]`) oder sein Name, ein Alias als ganzes Wort. Der
 * Begriff selbst nennt sich nicht.
 */
export function mentionsTerm(e: Entity, entry: GlossaryEntry): boolean {
  if (e.id === entry.id) return false;
  const namen = [entry.term, ...entry.aliases].map((n) => n.trim()).filter((n) => n.length >= 3);
  const wort = namen.length
    ? new RegExp(`(?<![\\p{L}\\p{N}])(?:${namen.map(escape).join('|')})(?![\\p{L}\\p{N}])`, 'iu')
    : null;
  const verweise = [entry.id, entry.number].filter((x): x is string => !!x).map((x) => `[[${x}`);
  return textsOf(e).some((t) => verweise.some((v) => t.includes(v)) || (!!wort && wort.test(t)));
}

/**
 * **Der Eintrag zu einem Namen, den ein Feld oder eine Regeloption nennt**
 * (`glossary`, T-347): erst ein Glossarartikel dieses Namens, dann ein Wort
 * der App, dann ein Alias — und nur, wenn auf der Stufe genau einer passt.
 * „Action" ist eine Artikelart (Wort der App) und eine Aktionsart (Begriff);
 * gemeint ist im Feld der Begriff.
 */
export function glossaryEntryNamed(entries: readonly GlossaryEntry[], name: string | null | undefined): GlossaryEntry | null {
  const k = String(name ?? '').trim().toLowerCase();
  if (!k) return null;
  const stufen = [
    entries.filter((e) => e.article && e.term.toLowerCase() === k),
    entries.filter((e) => !e.article && e.term.toLowerCase() === k),
    entries.filter((e) => e.aliases.some((a) => a.toLowerCase() === k)),
  ];
  for (const s of stufen) if (s.length) return s.length === 1 ? s[0]! : null;
  return null;
}

/** Je Feld mit `glossary` der Name, nach `Typ.feld` — wo ein Feld seinen Begriff nennt. */
export function glossaryFieldRefs(registry: Pick<Registry, 'interfaces'>): { ref: string; name: string }[] {
  const raus: { ref: string; name: string }[] = [];
  for (const [typ, def] of Object.entries(registry.interfaces)) {
    for (const [feld, p] of Object.entries(def.schema?.properties ?? {})) {
      if (p.glossary) raus.push({ ref: `${typ}.${feld}`, name: p.glossary });
    }
  }
  return raus;
}

/**
 * **Nach Beziehungen filtern** (T-389, REQ-395): „hat eine Kante X", „hat
 * keine", „Kante X zu diesem Artikel", „mindestens / höchstens n" — in
 * beide Richtungen, denn die Gegenrichtung ist eine Abfrage und keine
 * gespeicherte Kante. Dazu „hat ein Feld" für das, was keine Facette ist
 * (die Rasterform eines Gegenstands, `Item.rows`, ist `format: 'grid'`).
 *
 * In der Adresse steht es als Facette `@has` in `f=`, wie Zeit und Autor
 * (T-382), damit Adresse und Filtergruppen es ohne eigenes Feld tragen:
 * `f=@has:out.memberOf|!in.livesIn|Item.rows|out.memberOf=<id>|out.carries>=3`.
 * Die Bedingungen gelten zusammen. Gerechnet wird am Server über das
 * Gesiebte: eine Kante zählt nur, wenn ihr anderes Ende sichtbar ist.
 */

import { fieldTitle, fieldsOf, typeChain } from './entity.js';
import type { PropertySchema, Registry } from './types.js';
import { LAYER_RELATION } from './visibility.js';

/** Die Facette in `f=`. */
export const HAS_REF = '@has';

/** Eine Bedingung. `ref` ist `out.kante`, `in.kante` oder `Typ.feld`. */
export interface HasTerm {
  ref: string;
  not: boolean;
  /** Nur mit einer Kante: genau zu diesem Artikel (bzw. von ihm). */
  to?: string;
  /** Nur mit einer Kante: so viele mindestens / höchstens. */
  min?: number;
  max?: number;
}

/** Was eine Zeile zur Prüfung beiträgt — vom Aufrufer gesiebt. */
export interface HasFacts {
  /** Die sichtbaren anderen Enden der Kanten dieser Art und Richtung. */
  edges(dir: 'out' | 'in', type: string): readonly string[];
  /** Steht in diesem Feld etwas? */
  field(type: string, key: string): boolean;
}

/** Eine Wahl für die Seitenleiste. */
export interface HasChoice {
  ref: string;
  label: string;
  kind: 'edge' | 'field';
}

const KANTE = /^(out|in)\.([A-Za-z_][\w-]*)$/;
const FELD = /^([A-Za-z_][\w-]*)\.([A-Za-z_][\w-]*)$/;

/** Ist `ref` eine Kante (`out.x`, `in.x`)? Sonst ein Feld. */
export function isHasEdge(ref: string): boolean {
  return KANTE.test(ref);
}

/**
 * Eine Bedingung aus der Adresse; `null` bei Unsinn — dann gilt sie nicht,
 * statt still nichts zu zeigen. Zahl und Ziel nur an einer Kante.
 */
export function parseHasTerm(text: string): HasTerm | null {
  const s = text.trim();
  const m = /^(!?)([^=<>!]+?)(?:(=|>=|<=)(.+))?$/.exec(s);
  if (!m) return null;
  const not = m[1] === '!';
  const ref = m[2]!.trim();
  const kante = KANTE.test(ref);
  if (!kante && !FELD.test(ref)) return null;
  if (!m[3]) return { ref, not };
  if (!kante) return null;
  const wert = m[4]!.trim();
  if (!wert) return null;
  if (m[3] === '=') return { ref, not, to: wert };
  if (!/^\d{1,4}$/.test(wert)) return null;
  return m[3] === '>=' ? { ref, not, min: Number(wert) } : { ref, not, max: Number(wert) };
}

/** Zurück in die Adresse. */
export function hasTermText(t: HasTerm): string {
  const zusatz = t.to !== undefined ? `=${t.to}` : t.min !== undefined ? `>=${t.min}` : t.max !== undefined ? `<=${t.max}` : '';
  return `${t.not ? '!' : ''}${t.ref}${zusatz}`;
}

/** Gilt die Bedingung für diese Zeile? */
export function matchesHas(t: HasTerm, facts: HasFacts): boolean {
  let ja: boolean;
  const k = KANTE.exec(t.ref);
  if (k) {
    const enden = facts.edges(k[1] as 'out' | 'in', k[2]!);
    const n = t.to !== undefined ? enden.filter((x) => x === t.to).length : enden.length;
    ja = t.min !== undefined ? n >= t.min : t.max !== undefined ? n <= t.max : n >= 1;
  } else {
    const f = FELD.exec(t.ref);
    ja = !!f && facts.field(f[1]!, f[2]!);
  }
  return t.not ? !ja : ja;
}

/**
 * Die Kanten, die für **alle** diese Arten gelten, in beide Richtungen
 * (`from`/`to` die `extends`-Kette hoch, `*` für jede Art). Ohne Art alle —
 * der Aufrufer zeigt dann nur, was in den Treffern vorkommt. Die
 * Ebenenkante nicht: dafür gibt es „Where from".
 */
export function hasEdgeChoices(registry: Pick<Registry, 'interfaces' | 'relations'>, types: readonly string[]): HasChoice[] {
  const ketten = types.map((t) => typeChain(registry, t));
  const passt = (liste: string[] | undefined) =>
    ketten.every((kette) => !!liste?.some((x) => x === '*' || kette.includes(x)));
  const raus: HasChoice[] = [];
  for (const def of Object.values(registry.relations ?? {})) {
    if (def.type === LAYER_RELATION) continue;
    if (passt(def.from)) raus.push({ ref: `out.${def.type}`, label: def.label, kind: 'edge' });
    if (passt(def.to)) raus.push({ ref: `in.${def.type}`, label: def.inverseLabel, kind: 'edge' });
  }
  return raus;
}

/**
 * Felder, nach deren Vorhandensein sich fragen lässt: die, die **alle**
 * diese Arten tragen, ohne gerechnete (sie stehen nirgends, D8) und ohne
 * die mit `many` — deren Einträge hält der Server einzeln zurück, und
 * „hat eines" verriete, dass es einen verborgenen gibt.
 */
export function hasFieldChoices(registry: Pick<Registry, 'interfaces'>, types: readonly string[]): HasChoice[] {
  const [erste, ...rest] = types;
  if (!erste) return [];
  const taugt = (p: PropertySchema) => !p.derived && !p.many;
  const andere = rest.map((t) => new Set(fieldsOf(registry, t).map((f) => `${f.type}.${f.key}`)));
  return fieldsOf(registry, erste)
    .filter((f) => taugt(f.prop) && !(f.type === 'Identity' && (f.key === 'name' || f.key === 'id')))
    .map((f) => ({ ref: `${f.type}.${f.key}`, label: fieldTitle(registry, erste, f), kind: 'field' as const }))
    .filter((c) => andere.every((s) => s.has(c.ref)));
}

/** Darf nach diesem Feld gefragt werden? Dieselbe Regel wie `hasFieldChoices`, für den Server. */
export function hasFieldAllowed(registry: Pick<Registry, 'interfaces'>, type: string, key: string): boolean {
  const p = registry.interfaces[type]?.schema?.properties?.[key];
  return !!p && !p.derived && !p.many;
}

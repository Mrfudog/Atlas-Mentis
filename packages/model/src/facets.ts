/**
 * **Facetten aus dem Register** (T-174): wonach sich eine Liste einer Art
 * filtern lässt.
 *
 * Im Code steht keine Liste je Art (CLAUDE.md). Was eine Facette wird,
 * sagt die Form des Felds: eine Aufzählung (`enum`, `enumRef`, auch
 * mehrere Zeilen) wird zu Häkchen, ein Schalter zu ja/nein, eine Zahl zu
 * einer Spanne, ein Verweis mit Zielart zu einer Artikelwahl, ein freies
 * Wort mit `suggest` (eine Sorte) zu Häkchen über das, was dasteht. Dazu
 * die **Kanten** mit einer genannten Art am anderen Ende, in beide
 * Richtungen — der Zauber „granted by" Klasse, die Klasse „grants". Wo die
 * Ableitung danebenliegt, sagt es eine Angabe am Feld oder an der Kante
 * (`facet: false | {label, order}`).
 *
 * Nicht zur Facette werden: gerechnete, ausgegebene und nur bearbeitbare
 * Felder, Prosa (`long`, `many`), Formen (`grid`), Verweise ohne Zielart,
 * Kanten mit `*` am anderen Ende (sie sagen über die Art nichts), Kanten,
 * die sich wie ein Feld lesen (`asField`) oder Abschnitte sind
 * (`section`), die Ebenenkante (dafür gibt es „Where from") und Kanten auf
 * die eigene Art (`same`: Vorlage, Fassung).
 */

import { EFFECT_TARGETS, effectsOf } from './effects.js';
import { fieldTitle, fieldsOf, typeChain, type TypedField } from './entity.js';
import type { Entity, PropertySchema, RelationDef, Registry } from './types.js';
import { LAYER_RELATION } from './visibility.js';

/**
 * `effect` und `requirement` (T-180) sind Häkchen über abgeleitete Wörter:
 * die Wirkungen eines Artikels (`effectKeys`) und die Bedingungen einer
 * Voraussetzung (`requirementKeys`) — gesagt mit `facet: {as}` am Feld.
 */
export type FacetKind = 'enum' | 'bool' | 'range' | 'link' | 'auto' | 'effect' | 'requirement';

export interface FacetDef {
  /** `Typ.feld` für ein Feld, `out.kante` / `in.kante` für eine Kante. */
  ref: string;
  label: string;
  /**
   * `auto`: ein freier Text, den die Übersicht der Art als Spalte zeigt —
   * eine Spanne, wenn fast alles darin eine Zahl ist („1/4" beim
   * Herausforderungsgrad), sonst nichts. Das entscheidet erst der Bestand.
   */
  kind: FacetKind;
  order?: number;
  field?: TypedField;
  relation?: { type: string; dir: 'out' | 'in'; other: string[] };
}

/** Steht diese Facette einer Kante (und nicht einem Feld)? */
export function isEdgeFacet(ref: string): boolean {
  return ref.startsWith('out.') || ref.startsWith('in.');
}

function feldArt(prop: PropertySchema, spalte: boolean): FacetKind | null {
  if (prop.derived || prop.readOnly || prop.editOnly) return null;
  if (prop.many || prop.entry) return null;
  if (prop.format === 'long' || prop.format === 'grid' || prop.format === 'asset' || prop.format === 'color') return null;
  if (prop.enum?.length || prop.enumRef) return 'enum';
  if (prop.format === 'link') return prop.target?.interfaces?.length ? 'link' : null;
  if (prop.type === 'boolean') return 'bool';
  if (prop.type === 'number' || prop.type === 'integer') return 'range';
  if (prop.type === 'string' && prop.suggest) return 'enum';
  if (prop.type === 'string' && spalte && prop.format !== 'date') return 'auto';
  return null;
}

/** Die andere Seite einer Kante, ohne `*` und `same` — leer heisst: sagt nichts. */
function andereSeite(liste: string[] | undefined): string[] {
  return (liste ?? []).filter((t) => t !== '*' && t !== 'same');
}

function nennt(liste: string[] | undefined, kette: string[]): boolean {
  return !!liste?.some((t) => kette.includes(t));
}

/**
 * Die Facetten einer Art: ihre Felder (eigene zuerst, dann die geerbten),
 * danach die Kanten von hier und nach hier. `columns` sind die Felder der
 * Übersicht (`listColumns`) — ein freier Text darunter darf eine Spanne
 * werden, weil die Art ihn ohnehin als Zahl zeigt.
 */
export function facetsFor(
  registry: Pick<Registry, 'interfaces' | 'relations'>,
  type: string,
  columns: readonly string[] = [],
): FacetDef[] {
  if (!registry.interfaces[type]) return [];
  const raus: FacetDef[] = [];
  const spalten = new Set(columns);
  for (const f of fieldsOf(registry, type)) {
    const hint = f.prop.facet;
    if (hint === false) continue;
    const ref = `${f.type}.${f.key}`;
    const kind = (hint && hint.as) || feldArt(f.prop, spalten.has(ref));
    if (!kind) continue;
    raus.push({
      ref,
      label: (hint && hint.label) || fieldTitle(registry, type, f),
      kind,
      ...(hint && hint.order !== undefined ? { order: hint.order } : {}),
      field: f,
    });
  }
  const kette = typeChain(registry, type);
  for (const def of Object.values(registry.relations ?? {})) {
    if (def.facet === false || def.asField || def.section || def.type === LAYER_RELATION) continue;
    const hint = def.facet || undefined;
    const ziel = andereSeite(def.to);
    const quelle = andereSeite(def.from);
    if (nennt(def.from, kette) && ziel.length) raus.push(kantenFacette(def, 'out', ziel, hint));
    if (nennt(def.to, kette) && quelle.length) raus.push(kantenFacette(def, 'in', quelle, hint));
  }
  /* Eine Angabe `order` stellt nach vorn; sonst bleibt die Reihenfolge. */
  return raus
    .map((f, i) => ({ f, i }))
    .sort((a, b) => (a.f.order ?? 1e6 + a.i) - (b.f.order ?? 1e6 + b.i))
    .map((x) => x.f);
}

function kantenFacette(
  def: RelationDef,
  dir: 'out' | 'in',
  other: string[],
  hint: { label?: string; order?: number } | undefined,
): FacetDef {
  return {
    ref: `${dir}.${def.type}`,
    label: hint?.label ? hint.label : dir === 'out' ? def.label : def.inverseLabel,
    kind: 'link',
    ...(hint?.order !== undefined ? { order: hint.order } : {}),
    relation: { type: def.type, dir, other },
  };
}

/**
 * Die Facetten, die **alle** diese Arten haben — eine Liste aus Waffen und
 * Rüstungen filtert nach der Seltenheit des Gegenstands, nicht nach der
 * Waffengattung. Die Reihenfolge ist die der ersten Art.
 */
export function commonFacets(
  registry: Pick<Registry, 'interfaces' | 'relations'>,
  types: readonly string[],
  columns: (type: string) => readonly string[] = () => [],
): FacetDef[] {
  if (!types.length) return [];
  const je = types.map((t) => facetsFor(registry, t, columns(t)));
  const [erste, ...rest] = je;
  return (erste ?? []).filter((f) => rest.every((l) => l.some((g) => g.ref === f.ref)));
}

/** Eine Zahl, auch aus „1/4" — so steht der Herausforderungsgrad da. */
export function facetNumber(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return NaN;
  const bruch = /^\s*(\d+)\s*\/\s*(\d+)\s*$/.exec(v);
  if (bruch) return Number(bruch[1]) / Number(bruch[2]);
  return /^\s*-?\d+(\.\d+)?\s*$/.test(v) ? Number(v) : NaN;
}

/**
 * **Die Wirkungen als Wörter** (T-180): ein gewährtes Wort mit seinem Ziel
 * (`resist:fire`, `conditionImmune:poisoned`), eine Zahl nur das Ziel und
 * die Art (`add:ac`, `set:ability.str`) — „gibt einen Bonus auf die RK"
 * ist die Frage, nicht „+1 oder +2".
 */
export function effectKeys(e: Entity): string[] {
  const raus = new Set<string>();
  for (const x of effectsOf(e)) {
    if (x.op === 'grant') {
      const w = String(x.value ?? '').trim().toLowerCase();
      if (w) raus.add(`${x.target}:${w}`);
    } else raus.add(`${x.op}:${x.target}`);
  }
  return [...raus];
}

const WIRKUNG: Record<string, string> = {
  resist: 'Resistance',
  immune: 'Immunity',
  vulnerable: 'Vulnerability',
  conditionImmune: 'Condition immunity',
  prof: 'Proficiency',
};

/** Die Beschriftung eines Werts aus `effectKeys`. */
export function effectLabel(key: string): string {
  const [a, ...rest] = key.split(':');
  const b = rest.join(':');
  if (a === 'add') return `Bonus: ${EFFECT_TARGETS[b] ?? b}`;
  if (a === 'set') return `Sets ${EFFECT_TARGETS[b] ?? b}`;
  return `${WIRKUNG[a!] ?? EFFECT_TARGETS[a!] ?? a}: ${b}`;
}

/**
 * Die Werte eines Artikels für eine **Feld**-Facette, als Wörter. Ein
 * Schalter ohne Wert zählt als „nein": ein Zauber ohne Häkchen bei
 * Konzentration braucht keine. Kanten rechnet der Aufrufer, denn die
 * Gegenrichtung ist eine Abfrage über den Bestand.
 */
export function facetFieldValues(def: FacetDef, e: Pick<Entity, 'components'>): string[] {
  if (!def.field) return [];
  if (def.kind === 'effect') return effectKeys(e as Entity);
  const v = (e.components?.[def.field.type] as Record<string, unknown> | undefined)?.[def.field.key];
  if (def.kind === 'bool') return [v === true ? 'true' : 'false'];
  if (v === undefined || v === null || v === '') return [];
  const liste = Array.isArray(v) ? v : [v];
  return liste.filter((x) => x !== null && x !== undefined && x !== '' && typeof x !== 'object').map(String);
}

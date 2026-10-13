/**
 * **Fassungen derselben Sache** (E-021 d, T-092, REQ-243).
 *
 * Es gibt keinen Umschalter zwischen „PHB 2014" und „PHB 2024". Beide
 * Fassungen bleiben eigene Artikel; an jedem Feld, an dem eine andere
 * Fassung etwas anderes sagt, steht ihr Wert dabei — ein- und ausschaltbar
 * und je Ebene einstellbar. Dafür braucht es drei Fragen, und alle drei
 * stehen hier, einmal, für Server und Oberfläche:
 *
 *  1. **Was ist eine Fassung?** Zwei Artikel derselben Art, die über
 *     `variantOf` (in beide Richtungen) oder `overrides` verbunden sind und
 *     **dieselbe Sache** heissen. `variantOf` trägt heute auch anderes —
 *     den Grundgegenstand eines magischen Gegenstands (Oathbow → Longbow),
 *     das Mitglied einer Gegenstandsgruppe, die aufgelöste Kopie mit
 *     eigenem Namen (Goblin Boss → Goblin). Das sind keine Fassungen.
 *     „Dieselbe Sache" heisst: gleicher Name, nachdem ein angehängtes
 *     „ (Buch)" weggelassen ist, wenn das Buch die eigene Quelle ist — so
 *     nennt der Importer die Fassungen aus mehreren Büchern
 *     („Mind Flayer (VGM)", `doppel.ts`). Eine Überschreibung ist immer
 *     eine Fassung: sie sagt es selbst.
 *  2. **Welche gehören zusammen?** Alle, die über solche Kanten
 *     erreichbar sind (`versionGroups`, `versionsOf`) — einmal über den
 *     Bestand, nie je Artikel gegen jeden.
 *  3. **Was sagt die andere Fassung anders?** `versionDiff`: je Feld der
 *     abweichende Wert, je Kantenart die Ziele, die nur eine hat.
 */

import type { Entity, EntityId, Registry } from './types.js';
import { LAYER_RELATION } from './visibility.js';
import { OVERRIDES_RELATION } from './stack.js';
import { entityName } from './entity.js';

export const VARIANT_RELATION = 'variantOf';

const art = (e: Entity): string => (e.interfaces ?? [])[0] ?? '';

/** Der Name ohne angehängtes „ (Buch)", wenn das Buch die eigene Quelle ist. */
export function versionName(e: Entity): string {
  const name = entityName(e).trim();
  const buch = String((e.components?.['Source'] as { publication?: unknown } | undefined)?.publication ?? '').trim();
  if (buch && name.toLowerCase().endsWith(` (${buch.toLowerCase()})`)) {
    return name.slice(0, -(buch.length + 3)).trim().toLowerCase();
  }
  return name.toLowerCase();
}

/** Sind diese beiden über eine Kante verbundenen Artikel Fassungen derselben Sache? */
export function sameThing(a: Entity, b: Entity): boolean {
  return art(a) === art(b) && versionName(a) === versionName(b);
}

/** Die Kanten, über die `e` eine Fassung von etwas ist (Ziel-Ids). */
function fassungsKanten(e: Entity, get: (id: EntityId) => Entity | undefined): EntityId[] {
  const out: EntityId[] = [];
  for (const r of e.relations ?? []) {
    if (!r.to || r.to === e.id) continue;
    if (r.type === OVERRIDES_RELATION) out.push(r.to);
    else if (r.type === VARIANT_RELATION) {
      const ziel = get(r.to);
      if (ziel && sameThing(e, ziel)) out.push(r.to);
    }
  }
  return out;
}

/**
 * **Die Gruppen** (T-092): Artikel-Id → Id der Gruppe, für jeden Artikel,
 * der mindestens eine Fassung hat. Gerechnet über die gegebenen Artikel
 * allein — eine Fassung, die der Betrachter nicht sieht, verbindet nichts.
 * Einmal über alle Kanten (Union-Find), nicht jeder gegen jeden.
 */
export function versionGroups(entities: Iterable<Entity>): Map<EntityId, EntityId> {
  const map = new Map<EntityId, Entity>();
  for (const e of entities) map.set(e.id, e);
  const eltern = new Map<EntityId, EntityId>();
  const wurzel = (id: EntityId): EntityId => {
    let w = id;
    while (eltern.has(w) && eltern.get(w) !== w) w = eltern.get(w)!;
    /* Pfad verkürzen, damit eine lange Kette nicht jedes Mal abgelaufen wird. */
    let x = id;
    while (x !== w) {
      const n = eltern.get(x)!;
      eltern.set(x, w);
      x = n;
    }
    return w;
  };
  for (const e of map.values()) {
    for (const to of fassungsKanten(e, (id) => map.get(id))) {
      if (!map.has(to)) continue;
      if (!eltern.has(e.id)) eltern.set(e.id, e.id);
      if (!eltern.has(to)) eltern.set(to, to);
      const a = wurzel(e.id);
      const b = wurzel(to);
      /* Die kleinere Id wird Wurzel — dieselbe Gruppe heisst immer gleich. */
      if (a !== b) {
        if (a < b) eltern.set(b, a);
        else eltern.set(a, b);
      }
    }
  }
  const out = new Map<EntityId, EntityId>();
  for (const id of eltern.keys()) out.set(id, wurzel(id));
  return out;
}

/**
 * **Die übrigen Fassungen dieses Artikels** (T-092) — ein Gang über den
 * Bestand für die Kanten in beide Richtungen, dann die Gruppe von hier aus.
 * Ohne den Artikel selbst; die Reihenfolge ist die des Bestands.
 */
export function versionsOf(entities: Map<EntityId, Entity>, id: EntityId): Entity[] {
  if (!entities.has(id)) return [];
  const nachbarn = new Map<EntityId, Set<EntityId>>();
  const verbinde = (a: EntityId, b: EntityId) => {
    (nachbarn.get(a) ?? nachbarn.set(a, new Set()).get(a)!).add(b);
    (nachbarn.get(b) ?? nachbarn.set(b, new Set()).get(b)!).add(a);
  };
  for (const e of entities.values()) {
    for (const to of fassungsKanten(e, (x) => entities.get(x))) if (entities.has(to)) verbinde(e.id, to);
  }
  const gesehen = new Set<EntityId>([id]);
  const offen = [id];
  while (offen.length) {
    const x = offen.pop()!;
    for (const n of nachbarn.get(x) ?? []) {
      if (gesehen.has(n)) continue;
      gesehen.add(n);
      offen.push(n);
    }
  }
  gesehen.delete(id);
  return [...entities.values()].filter((e) => gesehen.has(e.id));
}

/** Die Ebenen, die diesen Artikel bringen (ohne `removes`). */
export function layersOf(e: Entity): EntityId[] {
  return [
    ...new Set(
      (e.relations ?? [])
        .filter((r) => r.type === LAYER_RELATION && (r.props as { mode?: unknown } | undefined)?.mode !== 'removes')
        .map((r) => r.to),
    ),
  ];
}

/**
 * **Das Kürzel einer Ebene** (T-092) — es steht an jedem abweichenden
 * Wert, der volle Name im Tooltip. Ein Buch aus 5e.tools heisst wie sein
 * Kürzel dort (`e5_book_xphb` → XPHB); sonst die Anfangsbuchstaben des
 * Namens, höchstens vier, und die Jahreszahl der Fassung, wenn eine dasteht.
 */
export function layerShort(layer: Entity): string {
  const buch = /^e5_book_(.+)$/.exec(layer.id);
  if (buch) return buch[1]!.replace(/-/g, '').toUpperCase();
  const name = entityName(layer);
  const jahr = /\b(19|20)\d\d\b/.exec(name)?.[0] ?? '';
  const woerter = name
    .replace(/\(.*?\)/g, ' ')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w && !/^\d+$/.test(w));
  const kurz =
    woerter.length > 1
      ? woerter
          .map((w) => w[0]!)
          .join('')
          .slice(0, 4)
          .toUpperCase()
      : (woerter[0] ?? name).slice(0, 4).toUpperCase();
  return jahr ? `${kurz} ${jahr.slice(2)}` : kurz || '?';
}

// ------------------------------------------------------------ Vergleich

/** Karten, die an jeder Fassung anders sind und nichts über die Sache sagen. */
const NICHT_VERGLEICHEN = new Set(['Identity', 'Source', 'Status', 'Visibility', '__meta']);
/** Kanten, die sagen, wo und was ein Artikel ist — nicht, was er sagt. */
const KANTEN_NICHT = new Set([LAYER_RELATION, VARIANT_RELATION, OVERRIDES_RELATION, 'instanceOf']);

export interface FieldVersion {
  /** `Typ.feld` — wie `Zelle.ref` in der Artikelansicht. */
  ref: string;
  type: string;
  key: string;
  /** Der Wert der anderen Fassung; `undefined` heisst: dort leer. */
  value: unknown;
  /** Ein langer Text: als aufklappbarer Vergleich, nicht in der Zeile. */
  long: boolean;
}

export interface RelationVersion {
  type: string;
  /** Ziele, die nur die andere Fassung hat. */
  only: EntityId[];
  /** Ziele, die nur dieser Artikel hat. */
  missing: EntityId[];
}

export interface VersionDiff {
  fields: FieldVersion[];
  relations: RelationVersion[];
}

const leer = (v: unknown): boolean =>
  v === undefined ||
  v === null ||
  v === '' ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 0);

/** Schlüssel sortiert, damit gleiche Werte gleich aussehen. */
function stabil(v: unknown): string {
  const ordne = (x: unknown): unknown => {
    if (Array.isArray(x)) return x.map(ordne);
    if (x && typeof x === 'object') {
      const o: Record<string, unknown> = {};
      for (const k of Object.keys(x as object).sort()) o[k] = ordne((x as Record<string, unknown>)[k]);
      return o;
    }
    return x;
  };
  return JSON.stringify(ordne(v));
}

/**
 * **Was die andere Fassung anders sagt** (T-092): je Feld, das abweicht,
 * ihr Wert; je Kantenart die Ziele, die nur eine von beiden hat. Gleiches
 * fällt weg — an einem Feld steht nur dann etwas dabei, wenn es etwas zu
 * sagen gibt. Name, Nummer, Quelle, Stand und Sichtbarkeit sind an jeder
 * Fassung anders und werden nicht verglichen; die Ebenen- und
 * Fassungskanten auch nicht.
 */
export function versionDiff(registry: Pick<Registry, 'interfaces'>, base: Entity, other: Entity): VersionDiff {
  const fields: FieldVersion[] = [];
  const typen = new Set([...Object.keys(base.components ?? {}), ...Object.keys(other.components ?? {})]);
  for (const type of typen) {
    if (NICHT_VERGLEICHEN.has(type)) continue;
    const a = (base.components?.[type] ?? {}) as Record<string, unknown>;
    const b = (other.components?.[type] ?? {}) as Record<string, unknown>;
    const props = registry.interfaces[type]?.schema?.properties ?? {};
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const va = a[key];
      const vb = b[key];
      if (leer(va) && leer(vb)) continue;
      if (stabil(va) === stabil(vb)) continue;
      const p = props[key];
      const long =
        p?.format === 'long' ||
        (typeof vb === 'string' && (vb.length > 160 || vb.includes('\n'))) ||
        (typeof va === 'string' && (va.length > 160 || va.includes('\n')));
      fields.push({ ref: `${type}.${key}`, type, key, value: leer(vb) ? undefined : vb, long });
    }
  }
  const relations: RelationVersion[] = [];
  const ziele = (e: Entity) => {
    const m = new Map<string, Set<EntityId>>();
    for (const r of e.relations ?? []) {
      if (KANTEN_NICHT.has(r.type) || !r.to) continue;
      (m.get(r.type) ?? m.set(r.type, new Set()).get(r.type)!).add(r.to);
    }
    return m;
  };
  const za = ziele(base);
  const zb = ziele(other);
  for (const type of new Set([...za.keys(), ...zb.keys()])) {
    const a = za.get(type) ?? new Set<EntityId>();
    const b = zb.get(type) ?? new Set<EntityId>();
    const only = [...b].filter((x) => !a.has(x));
    const missing = [...a].filter((x) => !b.has(x));
    if (only.length || missing.length) relations.push({ type, only, missing });
  }
  return { fields, relations };
}

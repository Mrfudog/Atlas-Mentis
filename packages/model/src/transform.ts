/**
 * **Transformationen** (T-253): Gruppieren, Filtern und Sortieren als eine
 * Kette von Schritten — so, wie Jira Structure es macht. Die Kette ist
 * Daten (`[{group: 'layer'}, {group: 'type'}, {filter: 'status', values:
 * ['ready']}, {sort: 'name'}]`), und aus ihr wird ein Baum mit Zählern.
 *
 * Was eine **Dimension** ist („Ebene", „Art", „Marke" …), sagt der
 * Aufrufer: eine Dimension nennt je Zeile ihre Werte. Mehrere Werte sind
 * erlaubt — ein Artikel mit zwei Marken steht unter beiden; keiner heisst
 * „(none)". So bleibt die Rechnung dieselbe für Artikel, Ebenen und
 * Prüfungen, und `articleDimensions` liefert die üblichen für Artikel.
 *
 * Der **Schlüssel** eines Knotens ist sein Weg, `layer:dnd|type:Spell`.
 * Er ist zugleich die Angabe, gegen die eine Regel prüft (`keyMatches`):
 * die Sichtbarkeit je Gruppe (T-252, E-098) hängt an genau so einem
 * Schlüssel, und der genauere — mehr Glieder — gewinnt (`mostSpecific`).
 *
 * Reine Funktionen, kein Framework (CLAUDE.md › packages/model).
 */

import { areaOf, primaryInterface } from './entity.js';
import type { Entity, Registry } from './types.js';
import { layersOf } from './versions.js';

/** Ein Schritt der Kette. */
export type TransformStep =
  | { group: string }
  /** Behält, was in `dim` einen der Werte hat (mit `not`: keinen davon). */
  | { filter: string; values: string[]; not?: boolean }
  /** Sortiert die Zeilen in jedem Knoten nach dem ersten Wert von `dim`. */
  | { sort: string; desc?: boolean };

/** Wonach gruppiert, gefiltert oder sortiert werden kann. */
export interface Dimension<T> {
  /** Ohne `:`, `|` und `,` — sie trennen Glieder und Schritte. */
  key: string;
  label: string;
  /** Die Werte einer Zeile; leer heisst: keiner (`NONE`). */
  values: (row: T) => readonly string[];
  /** Wie ein Wert heisst — sonst der Wert selbst. */
  valueLabel?: (value: string) => string;
}

/** Der Wert für Zeilen ohne Wert in einer Dimension. */
export const NONE = '';

export interface TransformNode<T> {
  /** Der Weg: `dim:wert|dim:wert`. */
  key: string;
  dim: string;
  value: string;
  label: string;
  depth: number;
  /** Wie viele Zeilen unter diesem Knoten stehen (jede einmal). */
  count: number;
  rows: T[];
  children: TransformNode<T>[];
}

export interface TransformResult<T> {
  /** Die Zeilen nach allen Filtern, sortiert. */
  rows: T[];
  /** Die oberste Ebene des Baums; ohne Gruppierung leer. */
  nodes: TransformNode<T>[];
  /** Schritte, deren Dimension niemand kennt — sie wirken nicht, und das wird gesagt. */
  unknown: string[];
}

function dimOf(step: TransformStep): string {
  return 'group' in step ? step.group : 'filter' in step ? step.filter : step.sort;
}

function werte<T>(d: Dimension<T>, row: T): readonly string[] {
  const v = d.values(row);
  return v.length ? v : [NONE];
}

const vergleich = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

/**
 * **Die Kette anwenden.** Filter wirken auf alle Zeilen, wo sie auch
 * stehen; Gruppen schachteln in ihrer Reihenfolge; Sortieren ordnet die
 * Zeilen in jedem Knoten, und bei mehreren Sortierschritten entscheidet
 * der erste, die übrigen nur bei Gleichstand. Knoten
 * stehen nach Beschriftung, „(none)" zuletzt. Ein Knoten ohne Zeilen
 * entsteht nicht.
 */
export function applyTransform<T>(
  rows: readonly T[],
  steps: readonly TransformStep[],
  dims: readonly Dimension<T>[],
): TransformResult<T> {
  const nachKey = new Map(dims.map((d) => [d.key, d]));
  const unknown = [...new Set(steps.map(dimOf).filter((k) => !nachKey.has(k)))];

  let liste = [...rows];
  for (const s of steps) {
    if (!('filter' in s)) continue;
    const d = nachKey.get(s.filter);
    if (!d) continue;
    const gesucht = new Set(s.values);
    liste = liste.filter((r) => werte(d, r).some((v) => gesucht.has(v)) !== !!s.not);
  }

  const sortierer = steps.flatMap((s) => {
    if (!('sort' in s)) return [];
    const d = nachKey.get(s.sort);
    return d ? [{ d, desc: !!s.desc }] : [];
  });
  if (sortierer.length) {
    liste = liste
      .map((r, i) => ({ r, i }))
      .sort((a, b) => {
        for (const { d, desc } of sortierer) {
          const c = vergleich.compare(werte(d, a.r)[0] ?? '', werte(d, b.r)[0] ?? '');
          if (c) return desc ? -c : c;
        }
        return a.i - b.i;
      })
      .map((x) => x.r);
  }

  const gruppen = steps.flatMap((s) => {
    if (!('group' in s)) return [];
    const d = nachKey.get(s.group);
    return d ? [d] : [];
  });

  const baue = (zeilen: T[], tiefe: number, weg: string): TransformNode<T>[] => {
    const d = gruppen[tiefe];
    if (!d) return [];
    const je = new Map<string, T[]>();
    for (const r of zeilen) {
      for (const v of new Set(werte(d, r))) {
        const l = je.get(v);
        if (l) l.push(r);
        else je.set(v, [r]);
      }
    }
    const knoten = [...je].map(([value, rs]) => {
      const key = (weg ? weg + '|' : '') + glied(d.key, value);
      return {
        key,
        dim: d.key,
        value,
        label: value === NONE ? '(none)' : (d.valueLabel?.(value) ?? value),
        depth: tiefe,
        count: rs.length,
        rows: rs,
        children: baue(rs, tiefe + 1, key),
      };
    });
    return knoten.sort((a, b) =>
      a.value === NONE ? 1 : b.value === NONE ? -1 : vergleich.compare(a.label, b.label),
    );
  };

  return { rows: liste, nodes: baue(liste, 0, ''), unknown };
}

/* Ein Glied `dim:wert`. Der Wert ist geschützt (`encodeURIComponent`):
   eine Marke oder ein Feldwert darf `:` und `|` enthalten, eine
   Dimension nicht. */
function glied(dim: string, value: string): string {
  return dim + ':' + encodeURIComponent(value);
}

/** Die Glieder eines Schlüssels: `layer:dnd|type:Spell` → `[['layer','dnd'],['type','Spell']]`. */
export function keyParts(key: string): [string, string][] {
  if (!key) return [];
  return key.split('|').map((p) => {
    const i = p.indexOf(':');
    return [p.slice(0, i), decodeURIComponent(p.slice(i + 1))];
  });
}

/** Ein Schlüssel aus Gliedern — die Umkehrung von `keyParts`. */
export function keyOf(parts: readonly (readonly [string, string])[]): string {
  return parts.map(([d, v]) => glied(d, v)).join('|');
}

/**
 * **Trifft der Schlüssel diese Zeile?** Jedes Glied muss passen; eine
 * Dimension mit mehreren Werten passt, wenn einer davon passt. Ein Glied
 * einer unbekannten Dimension passt nie — eine Regel, die nach etwas fragt,
 * das es nicht mehr gibt, soll nicht plötzlich für alles gelten.
 */
export function keyMatches<T>(key: string, row: T, dims: readonly Dimension<T>[]): boolean {
  const nachKey = new Map(dims.map((d) => [d.key, d]));
  return keyParts(key).every(([dim, v]) => {
    const d = nachKey.get(dim);
    return !!d && werte(d, row).includes(v);
  });
}

/**
 * **Der genaueste Schlüssel, der passt** — der mit den meisten Gliedern;
 * bei gleich vielen der erste in `keys`. `null`, wenn keiner passt.
 * So liest die Sichtbarkeit ihre Regeln je Gruppe (E-098: „genaueste
 * zuerst").
 */
export function mostSpecific<T>(keys: Iterable<string>, row: T, dims: readonly Dimension<T>[]): string | null {
  let best: string | null = null;
  let tiefe = -1;
  for (const k of keys) {
    const n = keyParts(k).length;
    if (n > tiefe && keyMatches(k, row, dims)) {
      best = k;
      tiefe = n;
    }
  }
  return best;
}

/**
 * **Die Kette als Wort für die Adresse** (teilen, speichern):
 * `group:layer,group:type,filter:status=ready+prepared,sort:-name`.
 * Werte werden mit `encodeURIComponent` geschützt.
 */
export function stepsToString(steps: readonly TransformStep[]): string {
  return steps
    .map((s) => {
      if ('group' in s) return 'group:' + s.group;
      if ('filter' in s) return (s.not ? 'not:' : 'filter:') + s.filter + '=' + s.values.map(encodeURIComponent).join('+');
      return 'sort:' + (s.desc ? '-' : '') + s.sort;
    })
    .join(',');
}

/** Die Umkehrung von `stepsToString`; was sich nicht lesen lässt, fällt weg. */
export function stepsFromString(text: string | null | undefined): TransformStep[] {
  if (!text) return [];
  return text.split(',').flatMap((teil): TransformStep[] => {
    const i = teil.indexOf(':');
    if (i < 0) return [];
    const art = teil.slice(0, i);
    const rest = teil.slice(i + 1);
    if (!rest) return [];
    if (art === 'group') return [{ group: rest }];
    if (art === 'sort') return rest.startsWith('-') ? [{ sort: rest.slice(1), desc: true }] : [{ sort: rest }];
    if (art === 'filter' || art === 'not') {
      const j = rest.indexOf('=');
      if (j <= 0) return [];
      const values = rest.slice(j + 1).split('+').filter(Boolean).map(decodeURIComponent);
      return [{ filter: rest.slice(0, j), values, ...(art === 'not' ? { not: true } : {}) }];
    }
    return [];
  });
}

/** Was die üblichen Artikeldimensionen von aussen brauchen — alles optional. */
export interface ArticleDimensionContext {
  /** Name einer Ebene. */
  layerName?: (id: string) => string | undefined;
  /** Die Gruppen, in denen eine Ebene steht (`partOf`, E-022 b). */
  layerGroups?: (layerId: string) => readonly string[];
  /** Name einer Gruppe; sonst `layerName`. */
  groupName?: (id: string) => string | undefined;
  /** Das Regelmodul, zu dem ein Artikel gehört (T-222) — wer es weiss, sagt es. */
  ruleModules?: (e: Entity) => readonly string[];
  /** Die Träger, die einen Artikel kennen oder sehen dürfen (Figur, Gruppe). */
  bearers?: (e: Entity) => readonly string[];
  bearerName?: (id: string) => string | undefined;
  /** Felder (`Typ.feld`), nach deren Wert gruppiert werden darf. */
  fields?: readonly string[];
}

function feldWert(e: Entity, typ: string, feld: string): string[] {
  const v = (e.components[typ] as Record<string, unknown> | undefined)?.[feld];
  if (v === undefined || v === null || v === '') return [];
  return (Array.isArray(v) ? v : [v]).filter((x) => typeof x === 'string' || typeof x === 'number' || typeof x === 'boolean').map(String);
}

/**
 * **Die üblichen Dimensionen für Artikel** (T-253): Ebene, Ebenengruppe,
 * Art, Bereich, Marke, Status, Sichtbarkeit, dazu Regelmodul und Träger,
 * wenn der Aufrufer sie kennt, und je genanntes Feld eines (`field.Typ.feld`).
 * Die Vorgaben stehen, wie das Modell sie liest: ohne Status-Karte zählt
 * ein Artikel als fertig (D72), ohne `audience` ist er `public`.
 */
export function articleDimensions(
  registry: Pick<Registry, 'interfaces'>,
  ctx: ArticleDimensionContext = {},
): Dimension<Entity>[] {
  const typLabel = (t: string): string => registry.interfaces[t]?.label ?? t;
  const dims: Dimension<Entity>[] = [
    { key: 'layer', label: 'Layer', values: (e) => layersOf(e), valueLabel: (v) => ctx.layerName?.(v) ?? v },
    { key: 'type', label: 'Type', values: (e) => [primaryInterface(e)], valueLabel: typLabel },
    { key: 'area', label: 'Area', values: (e) => [areaOf(registry, primaryInterface(e))].filter(Boolean) },
    { key: 'tag', label: 'Tag', values: (e) => feldWert(e, 'Tags', 'tags') },
    { key: 'status', label: 'Status', values: (e) => feldWert(e, 'Status', 'status').slice(0, 1).concat(['ready']).slice(0, 1) },
    { key: 'audience', label: 'Visibility', values: (e) => feldWert(e, 'Visibility', 'audience').slice(0, 1).concat(['public']).slice(0, 1) },
    { key: 'name', label: 'Name', values: (e) => [e.name] },
  ];
  if (ctx.layerGroups) {
    const lg = ctx.layerGroups;
    dims.splice(1, 0, {
      key: 'layerGroup',
      label: 'Layer group',
      values: (e) => [...new Set(layersOf(e).flatMap((l) => lg(l)))],
      valueLabel: (v) => ctx.groupName?.(v) ?? ctx.layerName?.(v) ?? v,
    });
  }
  if (ctx.ruleModules) dims.push({ key: 'module', label: 'Rule module', values: ctx.ruleModules });
  if (ctx.bearers) {
    dims.push({ key: 'bearer', label: 'Bearer', values: ctx.bearers, valueLabel: (v) => ctx.bearerName?.(v) ?? v });
  }
  for (const f of ctx.fields ?? []) {
    const [typ = '', feld = ''] = f.split('.');
    if (!typ || !feld) continue;
    const titel = registry.interfaces[typ]?.schema?.properties[feld]?.title ?? feld;
    dims.push({ key: 'field.' + f, label: `${typLabel(typ)} › ${titel}`, values: (e) => feldWert(e, typ, feld) });
  }
  return dims;
}

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

import { areaOf, entityName, primaryInterface } from './entity.js';
import { dimensionValues, glied, NONE, type Dimension } from './transformkeys.js';
import type { Entity, Registry } from './types.js';
import { layersOf } from './versions.js';

export * from './transformkeys.js';

/** Ein Schritt der Kette. */
export type TransformStep =
  | { group: string }
  /** Behält, was in `dim` einen der Werte hat (mit `not`: keinen davon). */
  | { filter: string; values: string[]; not?: boolean }
  /** Sortiert die Zeilen in jedem Knoten nach dem ersten Wert von `dim`. */
  | { sort: string; desc?: boolean };

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
    liste = liste.filter((r) => dimensionValues(d, r).some((v) => gesucht.has(v)) !== !!s.not);
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
          const c = vergleich.compare(dimensionValues(d, a.r)[0] ?? '', dimensionValues(d, b.r)[0] ?? '');
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
      for (const v of new Set(dimensionValues(d, r))) {
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
  /**
   * Der Standort als Weg, der nächste Ort zuerst (`locationPath`, T-330) —
   * wer den Bestand kennt, sagt es; dann gibt es „Location“ und „Region“.
   */
  location?: (e: Entity) => readonly string[];
  /** Name eines Orts. */
  locationName?: (id: string) => string | undefined;
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
 * Art, Bereich, Marke, Status, Sichtbarkeit, Kartenart, dazu Standort
 * (T-330), Regelmodul und Träger, wenn der Aufrufer sie kennt, und je genanntes Feld eines (`field.Typ.feld`).
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
    /* Der Name, wie er dasteht (`Identity.name`): `e.name` ist an eingelesenen Artikeln leer. */
    { key: 'name', label: 'Name', values: (e) => [entityName(e)] },
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
  /* Die Kartenart (T-330): ein freies Wort an `Map.kind`; andere Artikel stehen unter „(none)". */
  if (registry.interfaces['Map']) dims.push({ key: 'mapKind', label: 'Map kind', values: (e) => feldWert(e, 'Map', 'kind') });
  if (ctx.location) {
    const weg = ctx.location;
    const name = (v: string) => ctx.locationName?.(v) ?? v;
    /* Der nächste Ort und der äusserste: „Group by Region, then Location“
       schachtelt Stadt unter Küste, ohne dass eine Dimension mehrere
       Ebenen zugleich tragen muss. */
    dims.push(
      { key: 'location', label: 'Location', values: (e) => weg(e).slice(0, 1), valueLabel: name },
      { key: 'region', label: 'Region', values: (e) => weg(e).slice(-1), valueLabel: name },
    );
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

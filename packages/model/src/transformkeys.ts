/**
 * **Schlüssel der Transformationen** (T-253): ein Knoten heisst nach
 * seinem Weg, `layer:dnd|type:Spell`, und eine Regel je Gruppe hängt an
 * genau so einem Schlüssel (T-252, E-098). Eigenes Modul ohne
 * Abhängigkeiten, weil die Sichtbarkeit es liest und `transform.ts` von
 * Modulen abhängt, die die Sichtbarkeit lesen.
 */

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

/** Die Werte einer Zeile in einer Dimension; keiner heisst `NONE`. */
export function dimensionValues<T>(d: Dimension<T>, row: T): readonly string[] {
  const v = d.values(row);
  return v.length ? v : [NONE];
}

/* Ein Glied `dim:wert`. Der Wert ist geschützt (`encodeURIComponent`):
   eine Marke oder ein Feldwert darf `:` und `|` enthalten, eine
   Dimension nicht. */
export function glied(dim: string, value: string): string {
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
    return !!d && dimensionValues(d, row).includes(v);
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


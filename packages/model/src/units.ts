/**
 * Einheiten — **umgerechnet beim Lesen, nie gespeichert** (D8).
 *
 * Der Vault ist imperial, weil die Regeln es sind: vierzig Fuss Bewegung,
 * dreissig Pfund Gepäck, hundertzwanzig Fuss Reichweite. Am Tisch sitzen
 * Leute, für die das nichts bedeutet. Beides zu pflegen hiesse, zwei Zahlen
 * zu haben, die sich widersprechen können — also steht eine da, und die
 * andere wird gerechnet.
 *
 * Wie gerechnet wird, steht im Register und nicht hier: `ft` ist eine Zeile
 * mit `quantity: 'length'`, `system: 'imperial'` und `base: 0.3048`. Eine
 * Einheit dazuzunehmen ist ein Einfügen. Im Code steht keine Liste davon —
 * sonst bräuchte „Stein" eine Codeänderung.
 */

import type { Registry, UnitDef } from './types.js';

/** Was gezeigt wird: das eine System, das andere, oder beide. */
export type UnitMode = 'imperial' | 'metric' | 'both';

type UnitRegistry = Pick<Registry, 'units'>;

const kleiner = (s: string): string => s.trim().toLowerCase().replace(/\.$/, '');

/** Die Zeile zu einer Schreibweise: `ft`, `feet`, `Fuss` — alles dieselbe. */
export function unitByCode(registry: UnitRegistry, code: string): UnitDef | undefined {
  const gesucht = kleiner(code);
  for (const u of Object.values(registry.units ?? {})) {
    if (kleiner(u.code) === gesucht) return u;
    if ((u.aliases ?? []).some((a) => kleiner(a) === gesucht)) return u;
  }
  return undefined;
}

/**
 * Die Einheit, in der ein Wert im Zielsystem dasteht.
 *
 * Gewählt wird nach Grössenordnung und nicht nach einer festen Zuordnung:
 * drei Meilen sind knapp fünf Kilometer und nicht 4828 Meter, vierzig Fuss
 * sind zwölf Meter und nicht 0,012 Kilometer. Ohne das bräuchte jede
 * Entfernung ein Feld dafür, in welcher Einheit sie gemeint ist.
 */
export function targetUnit(
  registry: UnitRegistry,
  from: UnitDef,
  system: 'imperial' | 'metric',
  basiswert: number,
): UnitDef | undefined {
  const kandidaten = Object.values(registry.units ?? {})
    .filter((u) => u.quantity === from.quantity && u.system === system)
    .sort((a, b) => a.base - b.base);
  if (!kandidaten.length) return undefined;
  const betrag = Math.abs(basiswert);
  /* Die grösste, bei der noch mindestens eine ganze herauskommt — und wenn
     der Wert für alle zu klein ist, die kleinste. */
  let gewaehlt = kandidaten[0] as UnitDef;
  for (const u of kandidaten) if (betrag / u.base >= 1) gewaehlt = u;
  return gewaehlt;
}

/** Rechnet um. `null`, wenn die Einheit unbekannt ist oder es im Zielsystem
 *  keine gibt — eine irreführende Zahl ist schlimmer als keine. */
export function convert(
  registry: UnitRegistry,
  value: number,
  fromCode: string,
  system: 'imperial' | 'metric',
): { value: number; unit: UnitDef } | null {
  const from = unitByCode(registry, fromCode);
  if (!from || !Number.isFinite(value)) return null;
  if (from.system === system) return { value, unit: from };
  const basis = value * from.base;
  const to = targetUnit(registry, from, system, basis);
  if (!to) return null;
  return { value: basis / to.base, unit: to };
}

/** Eine Zahl mit ihrer Einheit, gerundet wie die Zeile es sagt. */
export function formatUnit(value: number, unit: UnitDef): string {
  const stellen = unit.decimals ?? 1;
  const gerundet = Number(value.toFixed(stellen));
  /* Nachkommanullen weg: „12 m" und nicht „12.0 m". */
  return `${gerundet}\u202f${unit.code}`;
}

/**
 * Ein Mass, so wie es dastehen soll.
 *
 * `both` schreibt das Gespeicherte zuerst und das Gerechnete in Klammern —
 * in dieser Reihenfolge, weil das Gespeicherte das ist, was in den Regeln
 * steht, und die Klammer das, was man sich darunter vorstellt.
 */
export function formatMeasure(
  registry: UnitRegistry,
  value: number,
  unitCode: string,
  mode: UnitMode,
): string {
  const from = unitByCode(registry, unitCode);
  if (!from) return `${value}\u202f${unitCode}`;
  const eigen = formatUnit(value, from);
  if (mode === from.system) return eigen;
  const andere = from.system === 'imperial' ? 'metric' : 'imperial';
  const um = convert(registry, value, from.code, mode === 'both' ? andere : mode);
  if (!um) return eigen;
  const umgerechnet = formatUnit(um.value, um.unit);
  return mode === 'both' ? `${eigen} (${umgerechnet})` : umgerechnet;
}

/* Eine Zahl mit einer Einheit dahinter: `40ft`, `1,5 m`, `30 / 120 ft`.
   Das Komma ist Absicht — der Vault schreibt deutsch. */
const MASS = /(-?\d+(?:[.,]\d+)?)\s*([A-Za-zäöü']{1,6})\b/g;

/**
 * Masse **im Fliesstext** umrechnen.
 *
 * Das braucht es, weil die Geschwindigkeit einer Kreatur im Vault
 * „40 ft, climb 20 ft" heisst und keine Zahl ist. Angefasst wird nur, was
 * wie eine Zahl mit bekannter Einheit aussieht; alles andere bleibt Wort
 * für Wort stehen. Ein Umschreiben, das auch nur manchmal danebengreift,
 * wäre schlimmer als gar keines — man sähe es dem Ergebnis nicht an.
 */
export function convertText(registry: UnitRegistry, text: string, mode: UnitMode): string {
  if (!text) return text;
  return text.replace(MASS, (ganz, zahl: string, code: string) => {
    const u = unitByCode(registry, code);
    if (!u) return ganz;
    const wert = Number(String(zahl).replace(',', '.'));
    if (!Number.isFinite(wert)) return ganz;
    return formatMeasure(registry, wert, u.code, mode);
  });
}

/**
 * Welches System für diese Artikelart gilt.
 *
 * Gesucht wird die `extends`-Kette hoch, wie bei `area`: eine Kreatur darf
 * imperial bleiben, weil ihre Zahlen aus dem Regelwerk kommen, während der
 * Rest der Kampagne metrisch dasteht. Sagt keine Art etwas, gilt die
 * Einstellung der Kampagne, und ohne die: beides.
 */
export function unitsFor(
  registry: Pick<Registry, 'interfaces' | 'settings'>,
  type: string | undefined,
): UnitMode {
  const erlaubt = (v: unknown): v is UnitMode =>
    v === 'imperial' || v === 'metric' || v === 'both';
  const seen = new Set<string>();
  const offen = type ? [type] : [];
  while (offen.length) {
    const at = offen.shift() as string;
    if (seen.has(at)) continue;
    seen.add(at);
    const def = registry.interfaces[at];
    if (!def) continue;
    if (erlaubt(def.units)) return def.units;
    for (const p of def.extends ?? []) offen.push(p);
  }
  const ausSettings = registry.settings?.['units'];
  return erlaubt(ausSettings) ? ausSettings : 'both';
}

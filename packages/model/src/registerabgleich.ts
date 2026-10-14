/**
 * **Register-Abgleich** (T-123): das Register einer Datenbank gegen die
 * Startzeilen (`seedRegistry`).
 *
 * Der Seed schreibt Arten nur in eine leere Datenbank (`seedRegistryInto`);
 * was danach in `packages/registry` geändert wird, erreicht eine laufende
 * Installation nur über eine Migration. Fehlt sie, merkt es niemand — bis
 * ein Verweisfeld eine rohe Id zeigt (055–057). Diese Rechnung sagt je Art,
 * Feld, Kante und Ansicht, was fehlt oder anders steht. Was jemand im
 * Register bewusst geändert hat, darf stehen bleiben; sie sagt es nur.
 *
 * Verglichen wird **normalisiert**: die Ablage füllt Vorgaben ein
 * (`abstract: false`, `owned: false`, `from: ['*']`, `aliases: []`,
 * `order: 99`), schreibt Einstellungen als Text und vergisst die
 * Reihenfolge der Schlüssel; Listenwerte und Kantenenden sind Mengen
 * (`MENGEN`) — nichts davon ist eine Abweichung.
 */

import { stableJson } from './checks.js';
import type { Registry } from './types.js';
import { TRANSFER_REGISTRY_PARTS, type TransferRegistryPart } from './uebernahme.js';

export interface RegisterAbweichung {
  part: TransferRegistryPart;
  /** Name der Zeile: Art, Kantenart, Ansicht, Liste … */
  name: string;
  /** Wo in der Zeile: ein Feld der Art (`hp`) oder ein Schlüssel (`views`). Ohne: die ganze Zeile. */
  path?: string;
  /** `missing`: steht in den Startzeilen, nicht in der Datenbank. `extra`: nur in der Datenbank. */
  kind: 'missing' | 'extra' | 'different';
  db?: unknown;
  seed?: unknown;
}

/** Vorgaben, die die Ablage einsetzt, je Teil und Schlüssel. */
const VORGABEN: Partial<Record<TransferRegistryPart, Record<string, unknown>>> = {
  interfaces: { abstract: false },
  relations: { owned: false, cardinality: 'many', from: ['*'], to: ['*'] },
  views: { order: 99 },
};

/**
 * Listen, die eine Menge sind: eine Migration hängt einen Wert an, die
 * Startzeile ordnet ihn ein — das ist keine Abweichung, für die jemand
 * eine zweite Migration schreiben sollte.
 */
const MENGEN = new Set(['enum', 'from', 'to', 'required', 'values', 'aliases']);

/** Ohne `undefined`, `null`, leere Listen und leere Objekte — die Ablage unterscheidet sie nicht. */
function ohneLeeres(v: unknown, schluessel = ''): unknown {
  if (Array.isArray(v)) {
    const liste = v.map((x) => ohneLeeres(x));
    return MENGEN.has(schluessel) && liste.every((x) => typeof x === 'string') ? [...(liste as string[])].sort() : liste;
  }
  if (!v || typeof v !== 'object') return v;
  const raus: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v)) {
    const y = ohneLeeres(x, k);
    if (y === undefined || y === null) continue;
    if (Array.isArray(y) && !y.length) continue;
    if (y && typeof y === 'object' && !Array.isArray(y) && !Object.keys(y).length) continue;
    raus[k] = y;
  }
  return raus;
}

/** Eine Zeile, wie die Ablage sie zurückgäbe. */
export function normalRegisterZeile(part: TransferRegistryPart, row: unknown): unknown {
  if (part === 'settings' || part === 'vars') return row == null ? row : String(row);
  const z = ohneLeeres(row);
  if (!z || typeof z !== 'object' || Array.isArray(z)) return z;
  const vorgaben = VORGABEN[part] ?? {};
  return Object.fromEntries(
    Object.entries(z).filter(([k, v]) => !(k in vorgaben) || stableJson(v) !== stableJson(vorgaben[k])),
  );
}

const kurz = (v: unknown) => {
  const s = typeof v === 'string' ? JSON.stringify(v) : stableJson(v);
  return s.length > 80 ? `${s.slice(0, 77)}…` : s;
};

/** Ein Satz je Abweichung, für die Werkbank und den Durchstich. */
export function beschreibeAbweichung(a: RegisterAbweichung): string {
  const wo = `${a.part}:${a.name}${a.path ? ` › ${a.path}` : ''}`;
  if (a.kind === 'missing') return `${wo}: missing in the database`;
  if (a.kind === 'extra') return `${wo}: only in the database`;
  return `${wo}: database ${kurz(a.db)} ≠ seed ${kurz(a.seed)}`;
}

/** Schlüssel einer Zeile vergleichen; `pfad` stellt ihnen etwas voran. */
function vergleicheSchluessel(
  raus: RegisterAbweichung[],
  part: TransferRegistryPart,
  name: string,
  db: Record<string, unknown>,
  seed: Record<string, unknown>,
  pfad = '',
): void {
  for (const k of new Set([...Object.keys(seed), ...Object.keys(db)])) {
    const d = db[k];
    const s = seed[k];
    const path = `${pfad}${k}`;
    if (d === undefined && s === undefined) continue;
    if (d === undefined) raus.push({ part, name, path, kind: 'missing', seed: s });
    else if (s === undefined) raus.push({ part, name, path, kind: 'extra', db: d });
    else if (stableJson(d) !== stableJson(s)) raus.push({ part, name, path, kind: 'different', db: d, seed: s });
  }
}

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/**
 * Was am Register der Datenbank anders steht als in den Startzeilen.
 * Eine Art wird je Feld verglichen (`path` ist der Feldname), alles andere
 * je Schlüssel der Zeile.
 */
export function registerAbweichung(db: Partial<Registry>, seed: Partial<Registry>): RegisterAbweichung[] {
  const raus: RegisterAbweichung[] = [];
  for (const part of TRANSFER_REGISTRY_PARTS) {
    const dTeil = obj((db as Record<string, unknown>)[part]);
    const sTeil = obj((seed as Record<string, unknown>)[part]);
    for (const name of new Set([...Object.keys(sTeil), ...Object.keys(dTeil)])) {
      const d = normalRegisterZeile(part, dTeil[name]);
      const s = normalRegisterZeile(part, sTeil[name]);
      if (d === undefined || d === null) {
        if (s !== undefined && s !== null) raus.push({ part, name, kind: 'missing', seed: s });
        continue;
      }
      if (s === undefined || s === null) {
        raus.push({ part, name, kind: 'extra', db: d });
        continue;
      }
      if (stableJson(d) === stableJson(s)) continue;
      if (typeof d !== 'object' || typeof s !== 'object') {
        raus.push({ part, name, kind: 'different', db: d, seed: s });
        continue;
      }
      const { schema: dSchema, ...dRest } = obj(d);
      const { schema: sSchema, ...sRest } = obj(s);
      vergleicheSchluessel(raus, part, name, dRest, sRest);
      if (part === 'interfaces') {
        /* Eine Art je Feld: „hp fehlt" sagt mehr als „schema ist anders". */
        const { properties: dProps, ...dSRest } = obj(dSchema);
        const { properties: sProps, ...sSRest } = obj(sSchema);
        vergleicheSchluessel(raus, part, name, obj(dProps), obj(sProps));
        vergleicheSchluessel(raus, part, name, dSRest, sSRest, 'schema.');
      } else if (dSchema !== undefined || sSchema !== undefined) {
        vergleicheSchluessel(raus, part, name, { schema: dSchema }, { schema: sSchema });
      }
    }
  }
  return raus;
}

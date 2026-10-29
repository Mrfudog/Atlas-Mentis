/**
 * **Modulrahmen** (E-100, T-132 Schritt 2): ein Regelsystem (`RuleSystem`)
 * ist das **Modul** — Inventory, Crafting, Travel … —, eine Regelmechanik
 * (`RuleMechanic`) ist ein **System** darin — Weight, Grid, Kibbles. Beide
 * sind Ebenen (E-166); gewählt wird durch Aufschalten.
 *
 * Wie Systeme zueinander stehen, sagen Kanten zwischen Mechaniken:
 *
 *  - `compatibleWith` — gelten zusammen (Grid mit Weight); einmal
 *    gespeichert, in beide Richtungen gelesen.
 *  - `extendsMechanic` — erweitert ein anderes und gilt **nur mit ihm**
 *    (Default shapes auf Grid oder Slots; eine von mehreren Grundlagen
 *    genügt). `props.mode: 'overrides'` sagt dazu, dass es bei Gleichstand
 *    gewinnt — welche Werte das sind, liest Schritt 3 (Teilsysteme).
 *    Eine Erweiterung verträgt sich mit allem, womit ihre Grundlage sich
 *    verträgt.
 *  - `excludesMechanic` — schliesst aus, in beide Richtungen (Kibbles und
 *    D&D-Handwerk), auch über Modulgrenzen.
 *
 * Was ohne Verbindung im selben Modul steht, schliesst sich aus: **je
 * Modul gilt eines, samt seinen Erweiterungen** (E-100, REQ-319). Von zwei
 * Systemen, die nicht zusammen gehen, gilt das höhere im Stapel (E-091);
 * das tiefere ist verdrängt und wird nicht angezeigt (E-094).
 *
 * Hier wird nur **gerechnet**, beim Lesen (D8): was am Tisch zählt, liest
 * vorerst weiter `Campaign.inventory` und die übrigen Kampagnenfelder
 * (`inventoryRulesOf`, `craftRulesOf`). Dass die Teilsysteme daraus lesen,
 * ist Schritt 3; die Wahl an der Kampagnenseite Schritt 4.
 */

import { resolvedStack } from './stack.js';
import type { Entity, EntityId } from './types.js';

export const RULE_SYSTEM_TYPE = 'RuleSystem';
export const RULE_MECHANIC_TYPE = 'RuleMechanic';
export const EXTENDS_MECHANIC_RELATION = 'extendsMechanic';
export const EXCLUDES_MECHANIC_RELATION = 'excludesMechanic';
/** `extendsMechanic.props.mode`: erweitert, oder ersetzt bei Gleichstand. */
export const MECHANIC_MODES = ['extends', 'overrides'] as const;
export type MechanicMode = (typeof MECHANIC_MODES)[number];

/** Wie es um eine aufgeschaltete Mechanik steht. */
export interface MechanicState {
  mechanic: Entity;
  /** Ihr Modul (`partOf` → `RuleSystem`); ohne eines `null`. */
  system: EntityId | null;
  /** Ihr Platz im aufgelösten Stapel, von unten gezählt. */
  rank: number;
  /** `applies` gilt; `displaced` verdrängt (E-094); `missingBase` eine Erweiterung ohne Grundlage. */
  status: 'applies' | 'displaced' | 'missingBase';
  /** Warum verdrängt: ausdrücklich ausgeschlossen, oder im selben Modul ohne Verbindung. */
  reason?: 'excluded' | 'incompatible';
  /** Wer verdrängt — oder bei `missingBase`: welche Grundlage fehlt. */
  by?: EntityId[];
  /** Die Grundlagen, die diese Mechanik bei Gleichstand ersetzt (`mode: 'overrides'`), wenn sie gilt. */
  overrides?: EntityId[];
}

export interface SystemSelection {
  system: Entity;
  /** Was im Modul gilt, von oben nach unten. */
  applies: Entity[];
  /** Was verdrängt ist oder ohne Grundlage steht. */
  held: MechanicState[];
}

export interface MechanicSelection {
  /** Je Modul, das eine aufgeschaltete Mechanik nennt, in der Reihenfolge des ersten Auftretens von oben. */
  systems: SystemSelection[];
  /** Jede aufgeschaltete Mechanik, von oben nach unten. */
  mechanics: MechanicState[];
}

type Rel = NonNullable<Entity['relations']>[number];
const kanten = (e: Entity | undefined, type: string): Rel[] => (e?.relations ?? []).filter((r) => r.type === type);
const art = (e: Entity | undefined): string => (e?.interfaces ?? [])[0] ?? '';

/** Die Grundlagen einer Mechanik (`extendsMechanic`), ohne sich selbst. */
export function mechanicBases(m: Entity | undefined): EntityId[] {
  return [...new Set(kanten(m, EXTENDS_MECHANIC_RELATION).map((r) => r.to))].filter((id) => id !== m?.id);
}

/** Ihr Modul: das erste `partOf` auf ein Regelsystem. */
export function systemOf(entities: Map<EntityId, Entity>, m: Entity | undefined): EntityId | null {
  for (const r of kanten(m, 'partOf')) if (art(entities.get(r.to)) === RULE_SYSTEM_TYPE) return r.to;
  return null;
}

/** Schliessen sich zwei Mechaniken ausdrücklich aus? In beide Richtungen. */
function schliesstAus(a: Entity, b: Entity): boolean {
  return kanten(a, EXCLUDES_MECHANIC_RELATION).some((r) => r.to === b.id) || kanten(b, EXCLUDES_MECHANIC_RELATION).some((r) => r.to === a.id);
}

/**
 * Gehen zwei Mechaniken zusammen? Ja, wenn `compatibleWith` sie verbindet
 * (eine Richtung genügt), eine die andere erweitert, oder eine Grundlage
 * der einen mit der anderen geht — die Kette hoch, nicht im Kreis.
 */
function vertraeglich(entities: Map<EntityId, Entity>, a: Entity, b: Entity, gesehen = new Set<string>()): boolean {
  const schluessel = `${a.id}|${b.id}`;
  if (gesehen.has(schluessel)) return false;
  gesehen.add(schluessel);
  const direkt = (x: Entity, y: Entity) =>
    kanten(x, 'compatibleWith').some((r) => r.to === y.id) || mechanicBases(x).includes(y.id);
  if (direkt(a, b) || direkt(b, a)) return true;
  for (const id of mechanicBases(a)) {
    const g = entities.get(id);
    if (g && vertraeglich(entities, g, b, gesehen)) return true;
  }
  for (const id of mechanicBases(b)) {
    const g = entities.get(id);
    if (g && vertraeglich(entities, a, g, gesehen)) return true;
  }
  return false;
}

/**
 * **Was in einer Kampagne gilt** (E-100): je Modul die Mechaniken, die
 * gelten, und die, die verdrängt sind oder ohne Grundlage stehen.
 *
 * Gelesen wird der aufgelöste Stapel von oben (E-091): eine Mechanik gilt,
 * wenn keine schon geltende sie ausschliesst und im selben Modul jede
 * geltende mit ihr verträglich ist. Danach fällt jede Erweiterung, deren
 * Grundlagen alle nicht gelten — und weil sie dann auch nichts mehr
 * verdrängt, wird neu gerechnet, bis nichts mehr fällt.
 */
export function mechanicSelection(entities: Map<EntityId, Entity>, campaign: Entity | null): MechanicSelection {
  const stapel = resolvedStack(entities, campaign);
  const rang = new Map<EntityId, number>();
  stapel.forEach((l, i) => rang.set(l.id, i));
  const oben = stapel.filter((l) => art(l) === RULE_MECHANIC_TYPE).reverse();
  if (!oben.length) return { systems: [], mechanics: [] };
  const modul = new Map(oben.map((m) => [m.id, systemOf(entities, m)]));

  const ohneGrundlage = new Set<EntityId>();
  let zustaende: MechanicState[] = [];
  for (let runde = 0; runde <= oben.length; runde++) {
    const gilt: Entity[] = [];
    zustaende = oben.map((m) => {
      const basis: MechanicState = { mechanic: m, system: modul.get(m.id) ?? null, rank: rang.get(m.id) ?? 0, status: 'applies' };
      if (ohneGrundlage.has(m.id)) return { ...basis, status: 'missingBase', by: mechanicBases(m) };
      const aus = gilt.filter((x) => schliesstAus(m, x));
      if (aus.length) return { ...basis, status: 'displaced', reason: 'excluded', by: aus.map((x) => x.id) };
      const quer = basis.system
        ? gilt.filter((x) => modul.get(x.id) === basis.system && !vertraeglich(entities, m, x))
        : [];
      if (quer.length) return { ...basis, status: 'displaced', reason: 'incompatible', by: quer.map((x) => x.id) };
      gilt.push(m);
      return basis;
    });
    const geltend = new Set(gilt.map((m) => m.id));
    const fallen = gilt.filter((m) => {
      const g = mechanicBases(m);
      return g.length > 0 && !g.some((id) => geltend.has(id));
    });
    if (!fallen.length) break;
    for (const m of fallen) ohneGrundlage.add(m.id);
  }

  const geltend = new Set(zustaende.filter((z) => z.status === 'applies').map((z) => z.mechanic.id));
  for (const z of zustaende) {
    if (z.status !== 'applies') continue;
    const ersetzt = kanten(z.mechanic, EXTENDS_MECHANIC_RELATION)
      .filter((r) => (r.props as { mode?: unknown } | undefined)?.mode === 'overrides' && geltend.has(r.to))
      .map((r) => r.to);
    if (ersetzt.length) z.overrides = ersetzt;
  }

  const systems: SystemSelection[] = [];
  for (const z of zustaende) {
    if (!z.system) continue;
    let s = systems.find((x) => x.system.id === z.system);
    if (!s) {
      const e = entities.get(z.system);
      if (!e) continue;
      s = { system: e, applies: [], held: [] };
      systems.push(s);
    }
    if (z.status === 'applies') s.applies.push(z.mechanic);
    else s.held.push(z);
  }
  return { systems, mechanics: zustaende };
}

/** Die Mechaniken, die in der Kampagne nicht gelten — verdrängt oder ohne Grundlage (E-094: nicht anzeigen). */
export function heldMechanics(entities: Map<EntityId, Entity>, campaign: Entity | null): Set<EntityId> {
  return new Set(mechanicSelection(entities, campaign).mechanics.filter((z) => z.status !== 'applies').map((z) => z.mechanic.id));
}

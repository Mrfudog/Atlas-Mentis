/**
 * **Schaden am Tisch** (T-275, Punkt 2): was ein Treffer an Trefferpunkten
 * kostet — nach Immunität, Resistenz und Verwundbarkeit des Ziels
 * (`characterStats.defenses`, Punkt 1) —, und die Konzentrationsprobe, die
 * er auslöst. Keine Darstellung, kein Schreiben: der Server rechnet hier,
 * zieht ab und protokolliert (T-172).
 *
 * Wie bei den Wirkungen gilt: keine eigene Engine (E-102). Die Rechnung hat
 * die Eingaben einer späteren Automation „Schaden nehmen" (Betrag, Art,
 * Abwehr des Ziels) und zieht dann um.
 */

import { abilityMod } from './calc.js';
import { concentrationDc } from './sheet.js';
import type { CharacterStats, DefenseWord } from './stats.js';

/** Was die Abwehr aus einem Betrag macht. */
export interface DamageAfterDefenses {
  /** Was abgezogen wird. */
  amount: number;
  /** Was gewürfelt wurde. */
  rolled: number;
  /** `immune` (0), `resistant` (halb, abgerundet), `vulnerable` (doppelt); leer: voll. */
  why?: 'immune' | 'resistant' | 'vulnerable';
  /** Das Wort der Abwehr, das griff („bludgeoning, piercing … from nonmagical attacks"). */
  word?: string;
}

/** Nennt ein Wort der Abwehr diese Schadensart — als ganzes Wort, gross/klein egal. */
export function defenseFor(words: readonly DefenseWord[], damageType: string): DefenseWord | undefined {
  const t = damageType.trim().toLowerCase();
  if (!t) return undefined;
  const muster = new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  return words.find((w) => muster.test(w.word));
}

/**
 * **Der Schaden nach der Abwehr** (PHB „Damage Resistance and
 * Vulnerability"): immun heisst 0, resistent die Hälfte (abgerundet),
 * verwundbar das Doppelte; resistent und verwundbar zugleich heben sich
 * auf. Ein Satz mit Einschränkung („from nonmagical attacks") greift — ob
 * ein Angriff magisch ist, weiss die Kachel nicht; das Wort steht im Log,
 * und die Leitung korrigiert mit dem Tracker.
 */
export function damageAfterDefenses(rolled: number, damageType: string, defenses: CharacterStats['defenses'] | undefined): DamageAfterDefenses {
  const n = Math.max(0, Math.trunc(Number(rolled) || 0));
  if (!defenses || !damageType) return { amount: n, rolled: n };
  const immun = defenseFor(defenses.immune, damageType);
  if (immun) return { amount: 0, rolled: n, why: 'immune', word: immun.word };
  const res = defenseFor(defenses.resist, damageType);
  const verw = defenseFor(defenses.vulnerable, damageType);
  if (res && !verw) return { amount: Math.floor(n / 2), rolled: n, why: 'resistant', word: res.word };
  if (verw && !res) return { amount: n * 2, rolled: n, why: 'vulnerable', word: verw.word };
  return { amount: n, rolled: n };
}

/**
 * **Der Bonus auf einen Rettungswurf** aus dem gelesenen Statblock: eine
 * feste Zahl (`bonuses.con`), sonst der Modifikator plus Übung, wo der
 * Statblock darin geübt ist (`Proficiencies.saves`), dazu die Wirkungen
 * `save`, `save.<attr>` und weitere Ziele (`save.concentration`).
 */
export function saveBonus(stats: CharacterStats, ability: string, extraTargets: readonly string[] = []): number | null {
  const sb = (stats.statblock?.components?.['Statblock'] ?? {}) as Record<string, unknown>;
  const pr = (stats.statblock?.components?.['Proficiencies'] ?? {}) as Record<string, unknown>;
  const bonuses = (sb['bonuses'] && typeof sb['bonuses'] === 'object' ? sb['bonuses'] : {}) as Record<string, unknown>;
  const dazu = ['save', `save.${ability}`, ...extraTargets].reduce((s, k) => s + (stats.totals.add[k] ?? 0), 0);
  const fest = Number(bonuses[ability]);
  if (bonuses[ability] !== undefined && bonuses[ability] !== null && bonuses[ability] !== '' && Number.isFinite(fest)) return fest + dazu;
  const wert = stats.abilities[ability as keyof CharacterStats['abilities']]?.value ?? null;
  if (wert === null) return null;
  const geuebt = Array.isArray(pr['saves']) && pr['saves'].some((s) => String(s).toLowerCase() === ability);
  return abilityMod(wert) + (geuebt ? (stats.prof.value ?? 0) : 0) + dazu;
}

/** Die Konzentrationsprobe nach Schaden: SG und Bonus (KON-Rettungswurf, `save.concentration`). */
export function concentrationCheck(stats: CharacterStats, damageTaken: number): { dc: number; bonus: number | null } {
  return { dc: concentrationDc(damageTaken), bonus: saveBonus(stats, 'con', ['save.concentration']) };
}

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
import { applyDamage, concentrationDc } from './sheet.js';
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

/**
 * **Schaden am Tisch, als eine Rechnung** (T-355): was der Zugplan beim
 * Bestätigen und der Tracker bei „Damage" mit einem Betrag tun — dieselbe
 * Rechnung, nicht zwei. Nach der Abwehr (`damageAfterDefenses`) zieht sie
 * ab: an `Vitals` (zeitweilige zuerst, `applyDamage`), wenn das Ziel keine
 * Teilnehmerkante hat oder eine Spielerfigur ist, und an der
 * Teilnehmerkante, wenn es eine gibt. **Eine Spielerfigur führt ihren Stand
 * an `Vitals`**; die Kante spiegelt ihn, damit der Tracker dasselbe zeigt
 * wie der Bogen (E-128, zweite Frage: so schreiben beide, Zugplan und
 * Tracker, bis sie entschieden ist). Ohne bekanntes Maximum und ohne Stand
 * bleibt der Stand leer. Konzentriert sich das Ziel und nimmt es Schaden,
 * sagt `concentration`, welche Probe fällig ist — gewürfelt wird beim
 * Aufrufer, der das Log führt (E-128: der Server würfelt).
 */
export interface TableDamage {
  defense: DamageAfterDefenses;
  /** Die neue `Vitals`-Karte; `null`: sie ändert sich nicht. */
  vitals: Record<string, unknown> | null;
  /** Der neue Stand an der Teilnehmerkante; `null`: keine Kante oder kein Stand. */
  edgeHp: number | null;
  /** Der Stand danach und das Maximum, für die Zeile im Ergebnis. */
  hp: number | null;
  max: number | null;
  /** Die fällige Konzentrationsprobe: SG, Bonus und der Zauber, der endet, wenn sie misslingt. */
  concentration: { dc: number; bonus: number | null; spell: string } | null;
}

/** Die Rechnung zu `TableDamage`: Abwehr, Abzug an `Vitals` und Kante, fällige Konzentrationsprobe. */
export function damageAtTable(input: {
  stats: CharacterStats;
  vitals: Readonly<Record<string, unknown>>;
  /** Die Teilnehmerkante, wenn das Ziel in einer Begegnung steht. */
  edge?: { hp?: unknown } | null;
  pc: boolean;
  rolled: number;
  type: string;
}): TableDamage {
  const { stats, vitals: v, edge, pc } = input;
  const defense = damageAfterDefenses(input.rolled, input.type, stats.defenses);
  const max = stats.hp.value;
  let vitals: Record<string, unknown> | null = null;
  let hp: number | null = null;
  if (!edge || pc) {
    const da = v['hp'] !== undefined && v['hp'] !== null && v['hp'] !== '' && Number.isFinite(Number(v['hp'])) ? Number(v['hp']) : max;
    if (da !== null) {
      const r = applyDamage({ hp: da, temp: Number(v['hpTemp']) || 0 }, defense.amount);
      hp = r.hp;
      vitals = { ...v, hp: r.hp };
      if (r.temp) vitals['hpTemp'] = r.temp;
      else delete vitals['hpTemp'];
    }
  }
  let edgeHp: number | null = null;
  if (edge) {
    const basis = edge.hp != null && Number.isFinite(Number(edge.hp)) ? Number(edge.hp) : max;
    edgeHp = hp ?? (basis === null ? null : Math.max(0, basis - defense.amount));
    if (edgeHp !== null) hp = edgeHp;
  }
  const auf = typeof v['concentration'] === 'string' && v['concentration'] ? (v['concentration'] as string) : null;
  const concentration = auf && defense.amount > 0 ? { ...concentrationCheck(stats, defense.amount), spell: auf } : null;
  return { defense, vitals, edgeHp, hp, max, concentration };
}

/** Die Zeilen, die ein Schaden im Ergebnis und im Tracker hinterlässt: Abwehr und Stand. */
export function damageLines(name: string, d: TableDamage): string[] {
  const teile: string[] = [];
  const { why, word, amount } = d.defense;
  if (why) teile.push(`${why} (${word}) → ${amount}`);
  if (d.hp !== null) teile.push(`${name} at ${d.hp}${d.max !== null ? `/${d.max}` : ''} HP`);
  return teile;
}

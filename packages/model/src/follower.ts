/**
 * **Gefolge, Begleiter und Reittiere** (T-497).
 *
 * Ein Gefolgsmann (Strongholds & Followers, Flee, Mortals!), ein Begleiter
 * oder ein Reittier folgt einer Figur über die Kante `follows`: an ihr
 * stehen seine **Stufe** und die Sorte. Sein Statblock sagt, was davon
 * abhängt:
 *
 *   - `pbFrom: 'leader'` — der Übungsbonus ist der des Anführers (Reittier,
 *     Begleiter), `'level'` — der seiner eigenen Stufe (Gefolgsmann);
 *   - `addPb` — wo das Buch „+ PB" schreibt: Rüstungsklasse, Schaden, SG,
 *     Trefferpunkte;
 *   - `hpPerLevel`, `tempHpPerLevel` — Trefferpunkte nach Stufe;
 *   - `composedOf.props.level` — ab welcher Stufe eine Aktion gilt.
 *
 * Gerechnet wird beim Lesen (D8): nichts davon steht gespeichert, und ohne
 * Anführer oder Stufe zeigt der Bogen die Formel des Buchs („13 + PB").
 */

import type { Entity, EntityId, Relation } from './types.js';

type Card = Record<string, unknown>;

export const FOLLOWS_RELATION = 'follows';

/** Was der Bogen über den Anführer wissen muss. Kommt vom Server (`refs.follower`). */
export interface FollowerContext {
  /** Die Stufe an der Kante `follows`, oder `null`. */
  level: number | null;
  /** Der Übungsbonus des Anführers, oder `null`, wenn er unbekannt ist. */
  leaderProf: number | null;
  /** Die Sorte an der Kante: retainer, companion, mount … */
  as?: string;
  /** Wem er folgt. */
  leader?: EntityId;
  leaderName?: string;
}

/** Ein gerechneter Wert mit seinem Text: die Zahl, wo sie feststeht, sonst die Formel. */
export interface FollowerValue {
  value: number | null;
  text: string;
}

export interface FollowerNumbers {
  /** Der geltende Übungsbonus — aus dem Statblock, vom Anführer oder aus der Stufe. */
  prof: number | null;
  /** Woher er kommt; `null`: aus dem Statblock. */
  profFrom: 'leader' | 'level' | null;
  level: number | null;
  ac: FollowerValue | null;
  hp: FollowerValue | null;
  tempHp: FollowerValue | null;
  /** Was zu Schaden und SG kommt (`addPb`); `null`, wo der Übungsbonus fehlt. */
  damageAdd: number | null;
  dcAdd: number | null;
  /** Der Übungsbonus für Rettungswürfe (`saveProf`, sonst `prof`). */
  saveProf: number | null;
}

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** Der Übungsbonus einer Stufe nach den Grundregeln: +2 auf 1–4, +3 auf 5–8 … +6 auf 17–20. */
export function profForLevel(level: number | null | undefined): number | null {
  if (level === null || level === undefined || !Number.isFinite(level) || level < 1) return null;
  return 2 + Math.floor((Math.min(20, Math.floor(level)) - 1) / 4);
}

/** Die Kante, mit der eine Kreatur folgt (eine je Kreatur). */
export function followsEdge(creature: Entity | undefined): Relation | undefined {
  return (creature?.relations ?? []).find((r) => r.type === FOLLOWS_RELATION && !!r.to);
}

/**
 * **Die Zahlen eines Statblocks, der folgt.** `sb` ist die Karte
 * `Statblock` (aufgelöst, mit der Vorlage darunter), `f` der Kontext des
 * Anführers. Ohne `f` stehen die Formeln des Buchs.
 */
export function followerNumbers(sb: Card, f?: FollowerContext | null): FollowerNumbers {
  const from = sb['pbFrom'] === 'leader' || sb['pbFrom'] === 'level' ? (sb['pbFrom'] as 'leader' | 'level') : null;
  const level = num(f?.level) !== null && num(f?.level)! >= 1 ? Math.floor(num(f?.level)!) : null;
  const prof = from === 'leader' ? num(f?.leaderProf) : from === 'level' ? profForLevel(level) : num(sb['prof']);
  const adds = new Set(Array.isArray(sb['addPb']) ? (sb['addPb'] as unknown[]).map(String) : []);
  const pb = (key: string): number | null => (adds.has(key) ? prof : 0);

  const ac = ((): FollowerValue | null => {
    const base = num(sb['ac']);
    if (base === null) return null;
    if (!adds.has('ac')) return { value: base, text: String(base) };
    return prof === null ? { value: null, text: `${base} + PB` } : { value: base + prof, text: String(base + prof) };
  })();

  const hp = ((): FollowerValue | null => {
    const base = num(sb['hp']);
    const proLevel = num(sb['hpPerLevel']);
    if (base === null && proLevel === null && !adds.has('hp')) return null;
    const teile: string[] = [];
    let wert: number | null = base ?? 0;
    if (base !== null) teile.push(String(base));
    if (proLevel !== null) {
      if (level === null) {
        wert = null;
        teile.push(`${proLevel} per level`);
      } else if (wert !== null) wert += proLevel * level;
    }
    if (adds.has('hp')) {
      if (prof === null) {
        wert = null;
        teile.push('PB');
      } else if (wert !== null) wert += prof;
    }
    return wert === null ? { value: null, text: teile.join(' + ') } : { value: wert, text: String(wert) };
  })();

  const tempHp = ((): FollowerValue | null => {
    const proLevel = num(sb['tempHpPerLevel']);
    if (proLevel === null) return null;
    return level === null ? { value: null, text: `${proLevel} per level` } : { value: proLevel * level, text: String(proLevel * level) };
  })();

  return {
    prof,
    profFrom: from,
    level,
    ac,
    hp,
    tempHp,
    damageAdd: pb('damage'),
    dcAdd: pb('dc'),
    saveProf: num(sb['saveProf']) ?? prof,
  };
}

/**
 * **Wem eine Kreatur folgt, gerechnet** — für den Server (`refs.follower`).
 * `profOf` liefert den Übungsbonus des Anführers (am Server
 * `creatureStats(…).prof`, eine Figur rechnet ihn aus ihrer Stufe).
 */
export function followerContextOf(
  creature: Entity | undefined,
  byId: ReadonlyMap<EntityId, Entity>,
  profOf: (leader: Entity) => number | null,
  nameOf: (e: Entity) => string = (e) => e.name ?? '',
): FollowerContext | null {
  const kante = followsEdge(creature);
  if (!kante) return null;
  const props = (kante.props ?? {}) as Card;
  const leader = byId.get(kante.to);
  const as = typeof props['as'] === 'string' && props['as'] ? (props['as'] as string) : undefined;
  return {
    level: num(props['level']),
    leaderProf: leader ? profOf(leader) : null,
    ...(as ? { as } : {}),
    leader: kante.to,
    ...(leader ? { leaderName: nameOf(leader) } : {}),
  };
}

/** Gilt eine Aktion schon? `from` ist `composedOf.props.level`; ohne bekannte Stufe gilt sie (der Bogen nennt die Stufe). */
export function unlockedAt(from: unknown, level: number | null): boolean {
  const ab = num(from);
  return ab === null || level === null || level >= ab;
}

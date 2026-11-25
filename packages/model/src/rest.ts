/**
 * **Rasten** (T-352, aus T-275 Punkt 9): was eine kurze und eine lange Rast
 * am Stand einer Figur (`Vitals`) zurücksetzen. Bis hierher stand „back on a
 * long rest" als Text am Bogen, und die Leitung setzte Plätze, Trefferwürfel
 * und Erschöpfung von Hand zurück.
 *
 * Gerechnet wird hier, geschrieben wird wie jeder Stand am Bogen (`Vitals`
 * durch `validateEntity`). So gebaut, dass es eine Automation „Rast" wird,
 * wenn die Regel-Engine kommt (E-102): Eingabe ist der Stand und was die
 * Regeln dazu sagen, Ausgabe der neue Stand mit seinen Gründen.
 */

import type { Entity, EntityId } from './types.js';

/** Was eine Rast geändert hat: der neue Stand und je Änderung ein Satz. */
export interface RestResult {
  vitals: Record<string, unknown>;
  changes: string[];
}

const zahl = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

/**
 * **Eine Stufe Erschöpfung weniger**: der Zustand der Figur, der eine Stufe
 * eines Grundzustands ist (`stageOf`, `Condition.stage`), wird durch die
 * nächstniedrigere Stufe ersetzt — Stufe 1 fällt weg. Gesucht wird in
 * `byId`; fehlt die niedrigere Stufe dort, bleibt alles (`null`).
 */
export function stageDown(conditionIds: readonly EntityId[], byId: ReadonlyMap<EntityId, Entity>, base = 'exhaustion'): { from: EntityId; to: EntityId | null } | null {
  const grundVon = (e: Entity | undefined) => (e?.relations ?? []).find((r) => r.type === 'stageOf')?.to;
  const stufe = (e: Entity | undefined) => zahl(e?.components?.['Condition']?.['stage']);
  for (const id of conditionIds) {
    const e = byId.get(id);
    const grund = grundVon(e);
    const n = stufe(e);
    if (!e || !grund || n === null) continue;
    const name = String(byId.get(grund)?.components?.['Identity']?.['name'] ?? grund).toLowerCase();
    if (!name.includes(base)) continue;
    if (n <= 1) return { from: id, to: null };
    for (const o of byId.values()) if (grundVon(o) === grund && stufe(o) === n - 1) return { from: id, to: o.id };
    return null;
  }
  return null;
}

/**
 * **Die lange Rast** (PHB „Long Rest"): alle Trefferpunkte zurück, die
 * zeitweiligen enden, verbrauchte Trefferwürfel bis zur Hälfte der Stufen
 * zurück (mindestens einer), alle Zauberplätze, die Todesrettungswürfe auf
 * null, eine Stufe Erschöpfung weniger (`stageDown`, wenn gegeben).
 */
export function longRest(
  vitals: Record<string, unknown>,
  o: { hpMax: number | null; hitDiceMax: number; exhaustion?: { from: EntityId; to: EntityId | null } | null },
): RestResult {
  const v = { ...vitals };
  const changes: string[] = [];
  if (o.hpMax !== null && zahl(v['hp']) !== o.hpMax) {
    v['hp'] = o.hpMax;
    changes.push(`hit points back to ${o.hpMax}`);
  }
  if (zahl(v['hpTemp'])) {
    delete v['hpTemp'];
    changes.push('temporary hit points end');
  }
  if (o.hitDiceMax > 0) {
    const links = Math.max(0, Math.min(o.hitDiceMax, zahl(v['hitDiceLeft']) ?? o.hitDiceMax));
    const neu = Math.min(o.hitDiceMax, links + Math.max(1, Math.floor(o.hitDiceMax / 2)));
    if (neu !== links) changes.push(`${neu - links} hit ${neu - links === 1 ? 'die' : 'dice'} back`);
    v['hitDiceLeft'] = neu;
  }
  if (Array.isArray(v['slotsUsed']) && v['slotsUsed'].some((n) => (zahl(n) ?? 0) > 0)) {
    delete v['slotsUsed'];
    changes.push('all spell slots back');
  }
  if (zahl(v['deathSuccess']) || zahl(v['deathFail'])) {
    delete v['deathSuccess'];
    delete v['deathFail'];
    changes.push('death saves reset');
  }
  if (o.exhaustion) {
    const liste = (Array.isArray(v['conditions']) ? (v['conditions'] as string[]) : []).filter((x) => x !== o.exhaustion!.from);
    if (o.exhaustion.to) liste.push(o.exhaustion.to);
    if (liste.length) v['conditions'] = liste;
    else delete v['conditions'];
    changes.push('one level of exhaustion less');
  }
  return { vitals: v, changes };
}

/**
 * **Einen Trefferwürfel ausgeben** (PHB „Short Rest"): der gewürfelte Wert
 * plus KON-Modifikator heilt (nie weniger als 0), höchstens bis zum
 * Maximum; ein Würfel weniger übrig. Ohne übrigen Würfel `null`.
 */
export function spendHitDie(
  vitals: Record<string, unknown>,
  o: { roll: number; conMod: number; hpMax: number | null; hitDiceMax: number },
): (RestResult & { healed: number }) | null {
  const links = Math.max(0, Math.min(o.hitDiceMax, zahl(vitals['hitDiceLeft']) ?? o.hitDiceMax));
  if (links < 1) return null;
  const hp = zahl(vitals['hp']) ?? o.hpMax ?? 0;
  const heil = Math.max(0, Math.trunc(o.roll) + o.conMod);
  const neu = o.hpMax !== null ? Math.min(o.hpMax, hp + heil) : hp + heil;
  return {
    vitals: { ...vitals, hp: neu, hitDiceLeft: links - 1 },
    healed: neu - hp,
    changes: [`hit die ${o.roll} ${o.conMod >= 0 ? '+' : '−'} ${Math.abs(o.conMod)}: +${neu - hp} hit points${o.hpMax !== null && neu >= o.hpMax ? ' (at maximum)' : ''}`],
  };
}

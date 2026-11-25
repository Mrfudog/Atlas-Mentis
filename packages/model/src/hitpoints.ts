/**
 * **Trefferpunkte einer Figur** (T-194). Jede Klassenstufe bringt einen
 * Trefferwürfel; was er bringt, steht **an der Kante zur Klasse**
 * (`hasClass.props.hp`, je Stufe ein Wert, der erste die erste Stufe) —
 * dort, wo die Stufe selbst steht. Gewürfelt oder der Durchschnitt, sagt
 * die Kampagne (`Campaign.hitPoints`, bis zum Regelmodul T-132).
 *
 * Die erste Stufe der ersten Klasse ist immer das Maximum des Würfels; ein
 * Wert pro Stufe heisst: wer KON später ändert, rechnet neu und würfelt
 * nicht noch einmal. Das Maximum steht am Statblock (`Statblock.hp`), wie
 * an jedem anderen — der Assistent schreibt es beim Speichern aus diesen
 * Werten neu.
 */

import { abilityMod } from './calc.js';
import type { Entity, EntityId } from './types.js';

/** Würfeln, Durchschnitt, oder jede Stufe selbst wählen (5e: beides erlaubt). */
export type HitPointRule = 'average' | 'roll' | 'either';

/** Die Regel der Kampagne; ohne Angabe darf man wählen. */
export function hitPointRuleOf(campaign: Entity | undefined): HitPointRule {
  const r = campaign?.components?.['Campaign']?.['hitPoints'];
  return r === 'average' || r === 'roll' ? r : 'either';
}

/** Der Durchschnitt eines Trefferwürfels, aufgerundet (W8 → 5). */
export const averageHitDie = (die: number): number => Math.floor(die / 2) + 1;

/** Der Trefferwürfel einer Klasse (`Class.hitDie`); ohne Angabe keiner. */
export function hitDieOf(cls: Entity | undefined): number | undefined {
  const d = Number(cls?.components?.['Class']?.['hitDie']);
  return Number.isFinite(d) && d > 0 ? d : undefined;
}

/** Eine Klassenstufe der Figur und was ihr Würfel brachte. */
export interface HitPointLevel {
  classId: EntityId;
  level: number;
  die?: number;
  /** Was der Würfel brachte, ohne KON; fehlt es, ist die Stufe offen. */
  value?: number;
  /** Die erste Stufe der ersten Klasse: das Maximum, nicht gewürfelt. */
  first: boolean;
}

/** Die Werte an einer Kante, als Zahlen; Lücken bleiben `undefined`. */
function werteAn(props: Record<string, unknown> | undefined): (number | undefined)[] {
  const roh = props?.['hp'];
  if (!Array.isArray(roh)) return [];
  return roh.map((x) => (typeof x === 'number' && Number.isFinite(x) ? x : undefined));
}

/**
 * **Jede Klassenstufe der Figur**, in der Reihenfolge ihrer Kanten. Die
 * erste Stufe der ersten Klasse trägt immer das Maximum des Würfels — was
 * an der Kante steht, gilt dort nicht.
 */
export function hitPointLevels(character: Entity, byId: ReadonlyMap<EntityId, Entity>): HitPointLevel[] {
  const raus: HitPointLevel[] = [];
  const klassen = (character.relations ?? []).filter((r) => r.type === 'hasClass');
  klassen.forEach((k, i) => {
    const die = hitDieOf(byId.get(k.to));
    const stufe = Math.max(1, Number(k.props?.['level']) || 1);
    const werte = werteAn(k.props);
    for (let l = 1; l <= stufe; l++) {
      const first = i === 0 && l === 1;
      const value = first ? die : werte[l - 1];
      raus.push({ classId: k.to, level: l, ...(die !== undefined ? { die } : {}), ...(value !== undefined ? { value } : {}), first });
    }
  });
  return raus;
}

/** Den Wert einer Stufe setzen (`null` nimmt ihn weg); die Kante kürzt nichts. */
export function setHitPointGain(character: Entity, classId: EntityId, level: number, value: number | null): Entity {
  const relations = (character.relations ?? []).map((r) => {
    if (r.type !== 'hasClass' || r.to !== classId) return r;
    const werte = werteAn(r.props);
    while (werte.length < level) werte.push(undefined);
    werte[level - 1] = value ?? undefined;
    while (werte.length && werte[werte.length - 1] === undefined) werte.pop();
    const props = { ...(r.props ?? {}) };
    /* JSON kennt kein Loch: eine offene Stufe vor einer gesetzten ist 0 und zählt als offen. */
    if (werte.length) props['hp'] = werte.map((w) => w ?? 0);
    else delete props['hp'];
    return { ...r, props };
  });
  return { ...character, relations };
}

/** Jede offene Stufe auf den Durchschnitt (bei der Regel `average` gibt es nichts anderes). */
export function fillAverageHitPoints(character: Entity, byId: ReadonlyMap<EntityId, Entity>): Entity {
  let raus = character;
  for (const l of hitPointLevels(character, byId)) {
    if (l.first || l.die === undefined) continue;
    if (!l.value || l.value !== averageHitDie(l.die)) raus = setHitPointGain(raus, l.classId, l.level, averageHitDie(l.die));
  }
  return raus;
}

/** Offen ist eine Stufe ohne Wert, oder mit 0 (das Loch aus `setHitPointGain`). */
const offen = (l: HitPointLevel) => !l.value;

/**
 * **Was an den Trefferpunkten noch fehlt**, als Satz — `null`, wenn nichts.
 * Ein Wert ausserhalb des Würfels oder, bei `average`, ein anderer als der
 * Durchschnitt ist kein Wert dieser Kampagne.
 */
export function hitPointProblem(levels: readonly HitPointLevel[], rule: HitPointRule): string | null {
  if (!levels.length) return 'Choose a class first.';
  if (levels.some((l) => l.die === undefined)) return 'A class names no hit die.';
  const fehlt = levels.filter(offen).length;
  if (fehlt) return `${fehlt} level${fehlt === 1 ? '' : 's'} without hit points yet.`;
  for (const l of levels) {
    if (l.first) continue;
    if (l.value! < 1 || l.value! > l.die!) return `Level ${l.level}: ${l.value} is not on a d${l.die}.`;
    if (rule === 'average' && l.value !== averageHitDie(l.die!)) return `This campaign takes the average: ${averageHitDie(l.die!)} at level ${l.level}.`;
  }
  return null;
}

/**
 * **Das Maximum**: je Stufe ihr Wert plus der KON-Modifikator, mindestens 1
 * (5e). `null`, solange eine Stufe offen ist.
 */
export function maxHitPoints(levels: readonly HitPointLevel[], con: number | undefined): number | null {
  if (!levels.length || levels.some((l) => offen(l) || l.die === undefined)) return null;
  const mod = con === undefined ? 0 : abilityMod(con);
  return levels.reduce((s, l) => s + Math.max(1, l.value! + mod), 0);
}

import { describe, expect, it } from 'vitest';
import {
  averageHitDie,
  fillAverageHitPoints,
  hitPointLevels,
  hitPointProblem,
  hitPointRuleOf,
  maxHitPoints,
  setClassLevel,
  setHitPointGain,
  setPick,
  type Entity,
} from '../src/index.js';

const klasse = (id: string, hitDie: number): Entity => ({ id, interfaces: ['Class'], name: id, components: { Class: { hitDie } }, relations: [] });
const bestand = new Map([
  ['fighter', klasse('fighter', 10)],
  ['wizard', klasse('wizard', 6)],
]);
const leer: Entity = { id: 'pc', interfaces: ['PlayerCharacter'], name: 'Pc', components: {}, relations: [] };

describe('hit points per class level (T-194)', () => {
  it('takes the maximum at the first level of the first class and asks for the rest', () => {
    let pc = setClassLevel(setPick(leer, 'hasClass', 'fighter'), 'fighter', 3);
    const l = hitPointLevels(pc, bestand);
    expect(l.map((x) => [x.level, x.value, x.first])).toEqual([[1, 10, true], [2, undefined, false], [3, undefined, false]]);
    expect(hitPointProblem(l, 'either')).toBe('2 levels without hit points yet.');
    expect(maxHitPoints(l, 14)).toBeNull();
    pc = setHitPointGain(pc, 'fighter', 3, 7);
    /* Eine offene Stufe vor einer gesetzten bleibt offen. */
    expect(pc.relations?.[0]?.props?.['hp']).toEqual([0, 0, 7]);
    expect(hitPointProblem(hitPointLevels(pc, bestand), 'either')).toBe('1 level without hit points yet.');
    pc = setHitPointGain(pc, 'fighter', 2, 4);
    const fertig = hitPointLevels(pc, bestand);
    expect(hitPointProblem(fertig, 'either')).toBeNull();
    /* KON 14: +2 je Stufe. */
    expect(maxHitPoints(fertig, 14)).toBe(10 + 2 + 4 + 2 + 7 + 2);
  });

  it('keeps the rule of the campaign: average only, and never below 1 a level', () => {
    expect(hitPointRuleOf(undefined)).toBe('either');
    expect(hitPointRuleOf({ id: 'c', interfaces: ['Campaign'], components: { Campaign: { hitPoints: 'average' } } } as Entity)).toBe('average');
    let pc = setClassLevel(setPick(leer, 'hasClass', 'fighter'), 'fighter', 2);
    pc = setClassLevel(pc, 'wizard', 1);
    pc = setHitPointGain(setHitPointGain(pc, 'fighter', 2, 9), 'wizard', 1, 4);
    expect(hitPointProblem(hitPointLevels(pc, bestand), 'average')).toMatch(/^This campaign takes the average: 6/);
    pc = fillAverageHitPoints(pc, bestand);
    const l = hitPointLevels(pc, bestand);
    expect(l.map((x) => x.value)).toEqual([10, averageHitDie(10), averageHitDie(6)]);
    expect(hitPointProblem(l, 'average')).toBeNull();
    /* KON 3 (−4): mindestens 1 je Stufe. */
    expect(maxHitPoints(l, 3)).toBe(6 + 2 + 1);
  });

  it('rejects a value the die cannot show', () => {
    const pc = setHitPointGain(setClassLevel(setPick(leer, 'hasClass', 'wizard'), 'wizard', 2), 'wizard', 2, 8);
    expect(hitPointProblem(hitPointLevels(pc, bestand), 'roll')).toBe('Level 2: 8 is not on a d6.');
  });
});

import { describe, expect, it } from 'vitest';
import { longRest, spendHitDie, stageDown } from '../src/rest.js';
import type { Entity } from '../src/types.js';

/* Rasten wirken am Tisch (T-352, T-275 Punkt 9): der Stand danach. */

const stufe = (id: string, n: number): Entity => ({
  id,
  interfaces: ['Condition'],
  components: { Identity: { name: `Exhaustion ${n}` }, Condition: { stage: n } },
  relations: [{ id: `${id}-s`, type: 'stageOf', to: 'exh' }],
});
const alle = new Map<string, Entity>([
  ['exh', { id: 'exh', interfaces: ['Condition'], components: { Identity: { name: 'Exhaustion' } } }],
  ['exh1', stufe('exh1', 1)],
  ['exh2', stufe('exh2', 2)],
  ['prone', { id: 'prone', interfaces: ['Condition'], components: { Identity: { name: 'Prone' } } }],
]);

describe('lange Rast', () => {
  it('setzt TP, Plätze, Todesrettungen zurück, gibt die Hälfte der Trefferwürfel und nimmt eine Stufe Erschöpfung', () => {
    const v = { hp: 3, hpTemp: 5, hitDiceLeft: 1, slotsUsed: [2, 1], deathFail: 1, conditions: ['prone', 'exh2'] };
    const r = longRest(v, { hpMax: 31, hitDiceMax: 5, exhaustion: stageDown(v.conditions, alle) });
    expect(r.vitals).toEqual({ hp: 31, hitDiceLeft: 3, conditions: ['prone', 'exh1'] });
    expect(r.changes).toEqual([
      'hit points back to 31',
      'temporary hit points end',
      '2 hit dice back',
      'all spell slots back',
      'death saves reset',
      'one level of exhaustion less',
    ]);
  });
  it('Stufe 1 fällt weg, mindestens ein Trefferwürfel kommt zurück', () => {
    expect(stageDown(['exh1'], alle)).toEqual({ from: 'exh1', to: null });
    const r = longRest({ hp: 8, hitDiceLeft: 0, conditions: ['exh1'] }, { hpMax: 8, hitDiceMax: 1, exhaustion: stageDown(['exh1'], alle) });
    expect(r.vitals).toEqual({ hp: 8, hitDiceLeft: 1 });
  });
});

describe('kurze Rast', () => {
  it('ein Trefferwürfel heilt Wurf plus KON bis zum Maximum', () => {
    expect(spendHitDie({ hp: 10, hitDiceLeft: 2 }, { roll: 6, conMod: 2, hpMax: 30, hitDiceMax: 3 })).toMatchObject({ vitals: { hp: 18, hitDiceLeft: 1 }, healed: 8 });
    expect(spendHitDie({ hp: 28, hitDiceLeft: 2 }, { roll: 6, conMod: 2, hpMax: 30, hitDiceMax: 3 })?.healed).toBe(2);
    expect(spendHitDie({ hp: 10, hitDiceLeft: 0 }, { roll: 6, conMod: 2, hpMax: 30, hitDiceMax: 3 })).toBeNull();
    expect(spendHitDie({ hp: 10 }, { roll: 1, conMod: -2, hpMax: 30, hitDiceMax: 3 })).toMatchObject({ vitals: { hp: 10, hitDiceLeft: 2 }, healed: 0 });
  });
});

/**
 * **Reise am Tisch** (T-350, REQ-170): Wachen werden Tage, ein Knoten
 * zählt Rationen und Licht, und die Einstellungen der Kampagne sagen, wann
 * etwas fällig ist. Null schaltet die Zählung aus.
 */
import { describe, expect, it } from 'vitest';
import { travelCounters, travelDue, travelLine, travelRulesOf, travelStep } from '../src/index.js';

const regeln = travelRulesOf({ travelRationEvery: '3', travelLightEvery: '4', travelWatchesPerDay: '3' });

describe('T-350: Reiseregeln und Zähler', () => {
  it('liest die Einstellungen, mit den Vorgaben des Registers', () => {
    expect(regeln).toEqual({ rationEvery: 3, lightEvery: 4, watchesPerDay: 3 });
    expect(travelRulesOf({})).toEqual({ rationEvery: 3, lightEvery: 4, watchesPerDay: 3 });
    expect(travelRulesOf({ travelRationEvery: '0', travelWatchesPerDay: '0' })).toMatchObject({ rationEvery: 0, watchesPerDay: 1 });
  });

  it('eine neue Gruppe steht an Tag 1, Wache 1', () => {
    expect(travelCounters({})).toEqual({ day: 1, watch: 1, sinceRation: 0, sinceLight: 0 });
  });
});

describe('T-350: eine Wache, ein Knoten', () => {
  it('eine Wache vergeht: die Zeit läuft, die Zehrung nicht', () => {
    const s = travelStep(travelCounters({ day: 1, watch: 1 }), regeln, 'watch');
    expect(s.patch).toEqual({ day: 1, watch: 2 });
    expect(s.used).toEqual({ ration: false, light: false });
  });

  it('nach der letzten Wache beginnt ein neuer Tag', () => {
    const s = travelStep(travelCounters({ day: 2, watch: 3 }), regeln, 'watch');
    expect(s.after).toMatchObject({ day: 3, watch: 1 });
    expect(s.newDay).toBe(true);
  });

  it('ein Knoten weiter zählt Rationen und Licht und leert die Handlungen des Knotens', () => {
    const s = travelStep(travelCounters({ day: 1, watch: 1, sinceRation: 2, sinceLight: 1 }), regeln, 'node');
    expect(s.patch).toEqual({ day: 1, watch: 2, sinceRation: 3, sinceLight: 2, actions: undefined });
    expect(s.used).toEqual({ ration: true, light: false });
  });

  it('fällig in …, und aus ist aus', () => {
    expect(travelDue(travelCounters({ sinceRation: 2, sinceLight: 4 }), regeln)).toEqual({ rationsIn: 1, lightIn: 4 });
    const aus = travelRulesOf({ travelRationEvery: '0', travelLightEvery: '0' });
    expect(travelDue(travelCounters({}), aus)).toEqual({ rationsIn: null, lightIn: null });
    expect(travelStep(travelCounters({ sinceRation: 2 }), aus, 'node').used).toEqual({ ration: false, light: false });
  });

  it('die Zeile über der Reise', () => {
    expect(travelLine(travelCounters({ day: 2, watch: 3, sinceRation: 2, sinceLight: 1 }), regeln)).toBe('Day 2, watch 3 of 3 · rations in 1 · light in 3');
  });
});

import { describe, expect, it } from 'vitest';
import { assembleCarry, legacyCarrySheet } from '../src/carrySheet.js';
import { drawStage } from '../src/inventory.js';
import {
  attunedCount, attunementCheck, attunementLimit, bodyPlaceCheck, bodyPlaces, drawReason, explainCarry, wearProps,
} from '../src/gear.js';

const ALT = { carrySquares: 'tiny:3, small:4, medium:5, large:6', carryZones: '0-1:bonus action, 2-4:action, 5-8:turn, 9-10:round' };
const LEITER = ['free action', 'bonus action', 'action', 'turn', 'round'];
const werte = (v: Record<string, unknown>) => (f: string) => v[f];

describe('Das Tragraster erklärt (T-365, E-153 V1)', () => {
  it('nennt Grundquadrat und Zusatzquadrat mit der Stärke, aus der es kommt', () => {
    const blatt = legacyCarrySheet(ALT)!;
    const wert = werte({ 'Statblock.size': 'small', 'Statblock.carryExtra': 2 });
    const t = assembleCarry(blatt, wert)!;
    const e = explainCarry(blatt, t, wert, (f) => (f === 'Statblock.carryExtra' ? 'STR 14 → +2' : null));
    expect(e.parts.map((p) => [p.name, p.w, p.h, p.x])).toEqual([['Small', 4, 4, 0], ['extra', 2, 2, 4]]);
    expect(e.text).toBe('Small 4×4 + extra 2×2 (STR 14 → +2)');
  });

  it('ohne Zusatzquadrat steht nur die Grösse da', () => {
    const blatt = legacyCarrySheet(ALT)!;
    const wert = werte({ 'Statblock.size': 'Medium', 'Statblock.carryExtra': 0 });
    expect(explainCarry(blatt, assembleCarry(blatt, wert)!, wert).text).toBe('Medium 5×5');
  });

  it('ein eigener Baustein ohne Bedingung heisst wie sein Label', () => {
    const blatt = { blocks: [{ id: 'b', label: 'Harness', when: [], rows: ['##', '##'], zones: [] }] };
    expect(explainCarry(blatt, assembleCarry(blatt, werte({}))!, werte({})).text).toBe('Harness 2×2');
  });
});

describe('Die Ziehzeit mit Begründung (T-365, E-153 V2)', () => {
  it('die Zone allein', () => {
    const r = drawStage([{ via: 'Carried', zone: 'action' }], LEITER, {});
    expect(drawReason(r)).toEqual({ stage: 'action', why: 'zone action', text: 'action (zone action)' });
  });

  it('ein Behälter im Raster gibt eine Stufe dazu — Bag of Holding im Rucksack', () => {
    const r = drawStage([{ via: 'Carried', zone: 'action' }, { via: 'Bag of Holding', zone: null }], LEITER, {});
    expect(drawReason(r).text).toBe('turn (zone action, Bag of Holding +1)');
  });

  it('eine langsamere Zone im Behälter schlägt die Stufe +1', () => {
    const r = drawStage([{ via: 'Carried', zone: 'bonus action' }, { via: 'Backpack', zone: 'round' }], LEITER, {});
    expect(drawReason(r).text).toBe('round (zone bonus action, Backpack zone round)');
  });

  it('ein Platz am Körper nennt den Platz', () => {
    const r = drawStage([{ via: 'Carried', slot: 'ringR1' }], LEITER, { ringR1: 'action' });
    expect(drawReason(r, (s) => (s === 'ringR1' ? 'Ring (right 1)' : s)).text).toBe('action (Ring (right 1))');
  });

  it('ohne Stufe keine Begründung — eine geschätzte sähe aus wie eine, die stimmt', () => {
    const r = drawStage([{ via: 'Carried', zone: null }], LEITER, {});
    expect(drawReason(r)).toEqual({ stage: null, why: '', text: '' });
  });
});

describe('Die Körperplätze aus dem Modul (T-365, E-153 V5)', () => {
  const SLOTDRAW = {
    mainHand: 'free action', offHand: 'free action', holster1: 'free action', belt: 'free action',
    armor: 'action', legs: 'action', ringR1: 'action', ringR2: 'action', ringL1: 'action', neck1: 'action', neck2: 'action',
  };

  it('gruppiert, was die Einstellung nennt — ohne Hände und Gurt', () => {
    const g = bodyPlaces(SLOTDRAW);
    expect(g.map((x) => [x.key, x.places.map((p) => p.slot)])).toEqual([
      ['armor', ['armor']], ['legs', ['legs']], ['ringR', ['ringR1', 'ringR2']], ['ringL', ['ringL1']], ['neck', ['neck1', 'neck2']],
    ]);
    expect(g.find((x) => x.key === 'ringR')!.label).toBe('Rings · right hand');
    expect(g[0]!.places[0]!.draw).toBe('action');
  });

  it('ein neuer Platz in der Einstellung ist ein neuer Platz, ohne Code', () => {
    expect(bodyPlaces({ tail: 'bonus action' }).map((g) => g.label)).toEqual(['Tail']);
  });

  it('Ringe nur an Ringplätze, Rüstung nur an den Rüstungsplatz, kein Schild am Körper', () => {
    expect(bodyPlaceCheck('ringR1', { itemType: 'ring' }).ok).toBe(true);
    expect(bodyPlaceCheck('ringR1', { itemType: 'wondrous item' })).toEqual({ ok: false, why: 'only a ring' });
    expect(bodyPlaceCheck('armor', { itemType: 'medium armor' }).ok).toBe(true);
    expect(bodyPlaceCheck('armor', { itemType: 'ring' })).toEqual({ ok: false, why: 'only armor' });
    expect(bodyPlaceCheck('neck1', { itemType: 'shield' })).toEqual({ ok: false, why: 'a shield goes in the off hand' });
    expect(bodyPlaceCheck('neck1', { itemType: 'wondrous item' }).ok).toBe(true);
  });

  it('am Körper heisst: Platz, worn, aus dem Raster', () => {
    expect(wearProps({ qty: 1, gx: 2, gy: 1, rot: 90, grip: 'two', unstowed: true, attuned: true }, 'neck1'))
      .toEqual({ qty: 1, slot: 'neck1', tier: 'worn', attuned: true });
  });
});

describe('Einstimmung zählen (T-365, E-153 V5)', () => {
  const holds = (p: Record<string, unknown>[]) => p.map((props, i) => ({ id: `h${i}`, type: 'holds', from: 'inv', to: `i${i}`, props }));

  it('zählt eingestimmte Stücke, die Grenze aus der Einstellung (Vorgabe 3)', () => {
    expect(attunedCount(holds([{ attuned: true }, {}, { attuned: true }]))).toBe(2);
    expect(attunementLimit({})).toBe(3);
    expect(attunementLimit({ attunementLimit: '5' })).toBe(5);
    expect(attunementLimit({ attunementLimit: 'viele' })).toBe(3);
  });

  it('einstimmen nur, was es verlangt, und nur bis zur Grenze', () => {
    expect(attunementCheck({ attunement: true }, false, 2, 3)).toEqual({ ok: true, why: '' });
    expect(attunementCheck({ attunement: true }, false, 3, 3)).toEqual({ ok: false, why: 'already attuned to 3 of 3' });
    expect(attunementCheck({}, false, 0, 3)).toEqual({ ok: false, why: 'needs no attunement' });
    /* Beenden geht immer. */
    expect(attunementCheck({ attunement: true }, true, 3, 3)).toEqual({ ok: true, why: '' });
  });
});

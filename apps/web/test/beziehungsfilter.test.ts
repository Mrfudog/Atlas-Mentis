/**
 * Nach Beziehungen (T-389): eine Bedingung aus der Leiste, ihr Text, die
 * Form in `f=`, und dass beim Wechsel der Art die Kanten bleiben und die
 * Felder der alten Art gehen.
 */
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { parseHasTerm } from '@nw/model';
import { ListenFilter, feldfilterAlsF, feldfilterAusF } from '../src/app/kern/filter';
import { bedingungText, neueBedingung } from '../src/app/artikel/beziehungsfilter';

describe('Beziehungsfilter (T-389)', () => {
  it('baut eine Bedingung; eine Zahl nur an einer Kante und nie negativ', () => {
    expect(neueBedingung('out.memberOf', 'has')).toEqual({ ref: 'out.memberOf', not: false });
    expect(neueBedingung('Item.rows', 'not')).toEqual({ ref: 'Item.rows', not: true });
    expect(neueBedingung('out.carries', 'min', 3)).toEqual({ ref: 'out.carries', not: false, min: 3 });
    expect(neueBedingung('out.carries', 'max', 0)).toEqual({ ref: 'out.carries', not: false, max: 0 });
    expect(neueBedingung('out.carries', 'min', -1)).toBeNull();
    expect(neueBedingung('out.carries', 'min', Number.NaN)).toBeNull();
    expect(neueBedingung('Item.rows', 'min', 1)).toBeNull();
    expect(neueBedingung('', 'has')).toBeNull();
  });

  it('sagt, was gilt', () => {
    expect(bedingungText(parseHasTerm('out.memberOf')!, 'member of')).toBe('Has member of');
    expect(bedingungText(parseHasTerm('!Item.rows')!, 'Shape')).toBe('Has no Shape');
    expect(bedingungText(parseHasTerm('out.memberOf=f1')!, 'member of', 'Guild')).toBe('member of: Guild');
    expect(bedingungText(parseHasTerm('out.carries>=2')!, 'carries')).toBe('At least 2 × carries');
  });

  it('reist in f= wie jede Facette', () => {
    const f = feldfilterAlsF({ '@has': { values: ['out.memberOf=f1', '!Item.rows'] } });
    expect(f).toEqual(['@has:out.memberOf=f1|!Item.rows']);
    expect(feldfilterAusF(f)).toEqual({ '@has': { values: ['out.memberOf=f1', '!Item.rows'] } });
  });

  it('beim Wechsel der Art bleiben die Kanten, die Felder der alten Art gehen', () => {
    TestBed.resetTestingModule();
    const filter = TestBed.inject(ListenFilter);
    filter.betrete('compendium');
    filter.typ('Item');
    filter.felder.set({ '@has': { values: ['Item.rows', 'in.carries'] }, 'Item.rarity': { values: ['rare'] } });
    filter.typ('Weapon');
    expect(filter.felder()).toEqual({ '@has': { values: ['in.carries'] } });
    filter.felder.set({ '@has': { values: ['Item.rows'] } });
    filter.typ('Spell');
    expect(filter.felder()).toEqual({});
  });
});

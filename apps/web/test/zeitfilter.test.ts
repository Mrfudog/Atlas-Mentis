/**
 * Wann und von wem (T-382): der Zeitraum aus zwei Daten und zurück, und
 * dass „Added", „Changed" und „Added by" einen Wechsel der Art überstehen.
 */
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ListenFilter, feldfilterAlsF, feldfilterAusF } from '../src/app/kern/filter';
import { zeitraum, zeitraumTeile } from '../src/app/artikel/zeitfilter';

describe('Zeitfilter (T-382)', () => {
  it('builds a range from two dates, one side may be empty', () => {
    expect(zeitraum('2026-10-01', '2026-10-22')).toBe('2026-10-01..2026-10-22');
    expect(zeitraum('', '2026-10-22')).toBe('..2026-10-22');
    expect(zeitraum(' ', '')).toBeNull();
    expect(zeitraumTeile('2026-10-01..')).toEqual({ von: '2026-10-01', bis: '' });
    expect(zeitraumTeile('7d')).toBeNull();
  });

  it('travels in f= like any facet', () => {
    const f = feldfilterAlsF({ '@added': { values: ['7d'] }, '@by': { values: ['u1', 'u2'] }, '@changed': { values: ['2026-10-01..2026-10-03'] } });
    expect(f).toEqual(['@added:7d', '@by:u1|u2', '@changed:2026-10-01..2026-10-03']);
    expect(feldfilterAusF(f)).toEqual({ '@added': { values: ['7d'] }, '@by': { values: ['u1', 'u2'] }, '@changed': { values: ['2026-10-01..2026-10-03'] } });
  });

  it('keeps when-and-who when the type changes, drops the type’s own facets', () => {
    TestBed.resetTestingModule();
    const filter = TestBed.inject(ListenFilter);
    filter.betrete('compendium');
    filter.typ('Spell');
    filter.felder.set({ 'Spell.level': { values: ['1'] }, '@added': { values: ['today'] } });
    filter.typ('Item');
    expect(filter.felder()).toEqual({ '@added': { values: ['today'] } });
  });
});

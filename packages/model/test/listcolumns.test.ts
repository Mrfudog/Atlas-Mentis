import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import { cleanColumns, columnChoices, columnsKey, derivedInputs } from '../src/listcolumns.js';

/** Spalten wählbar (T-343): was eine Art anbietet und was eine Wahl tragen darf. */
describe('column choices (T-343)', () => {
  it('offers own and inherited fields, calculated ones and edges — no prose or grids', () => {
    const c = columnChoices(seedRegistry, 'Item');
    const refs = c.map((x) => x.ref);
    expect(refs).toContain('Item.weight');
    expect(refs).toContain('Identity.aliases');
    expect(c.find((x) => x.ref === 'Item.width')).toMatchObject({ derived: true, kind: 'number' });
    expect(refs).not.toContain('Item.rows');
    expect(refs.some((r) => r.startsWith('out.') || r.startsWith('in.'))).toBe(true);
    expect(refs).not.toContain('out.inLayer');
    expect(columnChoices(seedRegistry, 'NoSuchType')).toEqual([]);
  });

  it('cleans a choice and keys it per page and type', () => {
    expect(cleanColumns('Spell.level, @source,,x y,Spell.level,in.grants')).toEqual(['Spell.level', '@source', 'in.grants']);
    expect(cleanColumns(42)).toBeNull();
    expect(columnsKey('world')).toBe('world');
    expect(columnsKey('rules', 'Spell')).toBe('rules|Spell');
  });

  it('names what a calculation reads, not its functions or edge paths', () => {
    expect(derivedInputs('8+prof+modOf(spellAbility)').sort()).toEqual(['prof', 'spellAbility']);
    expect(derivedInputs('sum(hasClass.level)')).toEqual([]);
    expect(derivedInputs('colCount(rows)')).toEqual(['rows']);
  });
});

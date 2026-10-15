/**
 * Facetten aus dem Register (T-174): was eine Liste einer Art filtert,
 * folgt aus der Form der Felder und den Kanten — keine Liste je Art.
 */
import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import { commonFacets, facetFieldValues, facetsFor, isEdgeFacet } from '../src/facets.js';
import type { Registry } from '../src/types.js';

const refs = (typ: string, spalten: string[] = []) => facetsFor(seedRegistry, typ, spalten).map((f) => f.ref);

describe('facetsFor', () => {
  it('turns the fields of a spell into facets by their shape', () => {
    const f = facetsFor(seedRegistry, 'Spell');
    const art = (ref: string) => f.find((x) => x.ref === ref)?.kind;
    expect(art('Spell.level')).toBe('range');
    expect(art('Spell.school')).toBe('enum');
    expect(art('Spell.components')).toBe('enum');
    expect(art('Spell.concentration')).toBe('bool');
    expect(art('Spell.ritual')).toBe('bool');
    expect(art('Spell.save')).toBe('enum');
    expect(art('Spell.damageTypes')).toBe('enum');
    expect(art('Spell.castingAction')).toBe('link');
    /* Prosa, Text ohne Liste und Gerechnetes nicht. */
    expect(art('Spell.higherLevels')).toBeUndefined();
    expect(art('Spell.material')).toBeUndefined();
    expect(art('Identity.id')).toBeUndefined();
  });

  it('takes the edges both ways, named from this end — not those that hit every type', () => {
    const f = facetsFor(seedRegistry, 'Spell');
    const klasse = f.find((x) => x.ref === 'in.grants');
    expect(klasse).toMatchObject({ label: 'granted by', kind: 'link', relation: { type: 'grants', dir: 'in' } });
    expect(klasse?.relation?.other).toContain('Class');
    expect(f.find((x) => x.ref === 'in.casts')?.label).toBe('cast by');
    expect(f.some((x) => x.ref.endsWith('.inLayer'))).toBe(false);
    /* Ein Abschnitt (der Statblock, der ihn nutzt) ist kein Filter. */
    expect(f.some((x) => x.ref === 'in.composedOf')).toBe(false);
    expect(refs('Class')).toContain('out.grants');
    expect(f.every((x) => isEdgeFacet(x.ref) === !!x.relation)).toBe(true);
  });

  it('leaves out what the field says is no filter', () => {
    expect(refs('Spell')).not.toContain('Visibility.revealedTo');
    expect(refs('Spell')).not.toContain('Rule.autolink');
  });

  it('lets a free text column become a range only when it is a column', () => {
    expect(refs('Statblock')).not.toContain('Statblock.cr');
    expect(facetsFor(seedRegistry, 'Statblock', ['Statblock.cr']).find((f) => f.ref === 'Statblock.cr')?.kind).toBe('auto');
  });

  it('names and orders by a hint on the field or the edge', () => {
    const reg = structuredClone(seedRegistry) as Registry;
    reg.interfaces['Spell']!.schema!.properties['ritual']!.facet = { label: 'Ritual casting', order: 0 };
    reg.relations['grants']!.facet = { label: 'Class' };
    reg.relations['casts']!.facet = false;
    const f = facetsFor(reg, 'Spell');
    expect(f[0]).toMatchObject({ ref: 'Spell.ritual', label: 'Ritual casting' });
    expect(f.find((x) => x.ref === 'in.grants')?.label).toBe('Class');
    expect(f.some((x) => x.ref.endsWith('.casts'))).toBe(false);
  });

  it('keeps for several types what they all have', () => {
    const f = commonFacets(seedRegistry, ['Weapon', 'Armor']).map((x) => x.ref);
    expect(f).toContain('Item.rarity');
    expect(f).not.toContain('Weapon.category');
  });
});

describe('facetFieldValues', () => {
  it('reads words, lists, and a missing switch as no', () => {
    const f = facetsFor(seedRegistry, 'Spell');
    const def = (ref: string) => f.find((x) => x.ref === ref)!;
    const e = { components: { Spell: { components: ['v', 's'], level: 3 } } };
    expect(facetFieldValues(def('Spell.components'), e)).toEqual(['v', 's']);
    expect(facetFieldValues(def('Spell.level'), e)).toEqual(['3']);
    expect(facetFieldValues(def('Spell.ritual'), e)).toEqual(['false']);
  });
});

import { describe, expect, it } from 'vitest';
import { castRelations, characterStats, spellcastingOf, withCastRelations, type Entity } from '../src/index.js';

const art = (id: string, typ: string, components: Entity['components'] = {}, relations: Entity['relations'] = []): Entity => ({
  id, interfaces: [typ], name: id, components, relations,
});

const wizard = art('class-wiz', 'Class', {
  Class: { hitDie: 6, spellAbility: 'int', casterProgression: 'full' },
  Choices: { choices: [{ id: 'cantrips', kind: 'spell', count: 3, from: { interfaces: ['Spell'] } }] },
});
const paladin = art('class-pal', 'Class', { Class: { spellAbility: 'cha', casterProgression: 'half' } });
const sorcerer = art('class-sor', 'Class', { Class: { spellAbility: 'cha', casterProgression: 'full' } });
const warlock = art('class-war', 'Class', { Class: { spellAbility: 'cha', casterProgression: 'pact' } });
const fighter = art('class-fig', 'Class', { Class: { hitDie: 10 } });
const ek = art('sub-ek', 'Subclass', { Subclass: { spellAbility: 'int', casterProgression: 'third' } });
/* Die Herkunft wählt einen Zaubertrick (Hochelf) und wirkt ab Stufe 3 einen festen (Tiefling-artig). */
const elf = art(
  'anc-elf',
  'Ancestry',
  { Choices: { choices: [{ id: 'cantrip', kind: 'spell', count: 1, ability: 'int', from: { interfaces: ['Spell'] } }] } },
  [
    { id: 'c1', type: 'casts', to: 'sp-thaum', props: { mode: 'innate', ability: 'cha' } },
    { id: 'c2', type: 'casts', to: 'sp-darkness', props: { mode: 'innate', ability: 'cha', fromLevel: 3, uses: '1/day' } },
  ],
);
const wand = art('item-wand', 'Item', { Item: { attunement: false } }, [{ id: 'w1', type: 'casts', to: 'sp-missile', props: { mode: 'item' } }]);
const tasche = art('inv-1', 'Inventory', {}, [{ id: 'h1', type: 'holds', to: 'item-wand', props: { tier: 'held' } }]);
const spells = ['sp-thaum', 'sp-darkness', 'sp-missile', 'sp-light', 'sp-hand', 'sp-bolt', 'sp-prest'].map((id) => art(id, 'Spell', { Spell: { level: 0 } }));
const bestand = new Map([wizard, paladin, sorcerer, warlock, fighter, ek, elf, wand, tasche, ...spells].map((e) => [e.id, e]));

const figur = (rel: Entity['relations']) => art('pc-1', 'PlayerCharacter', {}, rel);
const klasse = (to: string, level: number, subclass?: string): Entity['relations'][number] => ({
  id: `k-${to}`, type: 'hasClass', to, props: { level, ...(subclass ? { subclass } : {}) },
});

describe('spellcastingOf (T-309)', () => {
  it('gives a wizard from the assistant ability and slots from the class', () => {
    const sc = spellcastingOf(figur([klasse('class-wiz', 1)]), undefined, bestand);
    expect(sc.ability).toBe('int');
    expect(sc.slots).toEqual([2]);
    expect(sc.casterLevel).toBe(1);
  });

  it('adds the multiclass caster levels — half rounds down with others, up alone', () => {
    expect(spellcastingOf(figur([klasse('class-pal', 3)]), undefined, bestand).slots).toEqual([3]);
    const multi = spellcastingOf(figur([klasse('class-pal', 3), klasse('class-sor', 2)]), undefined, bestand);
    expect(multi.casterLevel).toBe(3);
    expect(multi.slots).toEqual([4, 2]);
    expect(spellcastingOf(figur([klasse('class-pal', 1)]), undefined, bestand).slots).toEqual([]);
  });

  it('casts through the subclass when the class does not (Eldritch Knight)', () => {
    const sc = spellcastingOf(figur([klasse('class-fig', 4, 'sub-ek')]), undefined, bestand);
    expect(sc.ability).toBe('int');
    expect(sc.slots).toEqual([3]);
  });

  it('adds pact slots at their level', () => {
    const sc = spellcastingOf(figur([klasse('class-war', 3)]), undefined, bestand);
    expect(sc.pact).toEqual({ level: 2, count: 2 });
    expect(sc.slots).toEqual([0, 2]);
  });

  it('takes spells from sources with the ability the rules name, gated by level', () => {
    const c = figur([
      klasse('class-wiz', 1),
      { id: 'a', type: 'hasAncestry', to: 'anc-elf' },
      { id: 'w1', type: 'chose', to: 'anc-elf', props: { choice: 'cantrip', picks: ['sp-light'] } },
      { id: 'w2', type: 'chose', to: 'class-wiz', props: { choice: 'cantrips', picks: ['sp-hand', 'sp-bolt', 'sp-prest'] } },
    ]);
    const sc = spellcastingOf(c, undefined, bestand);
    const nach = Object.fromEntries(sc.spells.map((z) => [z.spell, z]));
    expect(nach['sp-thaum']).toMatchObject({ source: 'anc-elf', mode: 'innate', ability: 'cha' });
    /* Darkness erst ab Stufe 3. */
    expect(nach['sp-darkness']).toBeUndefined();
    expect(nach['sp-light']).toMatchObject({ source: 'anc-elf', ability: 'int', choice: 'anc-elf#cantrip' });
    expect(nach['sp-hand']).toMatchObject({ source: 'class-wiz', ability: 'int', mode: 'known' });
    const hoeher = spellcastingOf(figur([klasse('class-wiz', 3), { id: 'a', type: 'hasAncestry', to: 'anc-elf' }]), undefined, bestand);
    expect(hoeher.spells.find((z) => z.spell === 'sp-darkness')).toMatchObject({ uses: '1/day' });
  });

  it('casts from an item held, without an ability of its own', () => {
    const sc = spellcastingOf(figur([{ id: 'i', type: 'carries', to: 'inv-1' }]), undefined, bestand);
    expect(sc.spells).toEqual([expect.objectContaining({ spell: 'sp-missile', via: 'holds', mode: 'item' })]);
    expect(sc.spells[0]!.ability).toBeUndefined();
  });

  it('lets the statblock decide where it says something', () => {
    const sb = art('sb', 'Statblock', { Statblock: { spellAbility: 'wis', spellSlots: [1, 1] } });
    const sc = spellcastingOf(figur([klasse('class-wiz', 5)]), sb, bestand);
    expect(sc.ability).toBe('wis');
    expect(sc.slots).toEqual([1, 1]);
  });

  it('reads as edges, and shows the Spells tab for a caster without spells yet', () => {
    const c = figur([klasse('class-wiz', 1), { id: 'a', type: 'hasAncestry', to: 'anc-elf' }]);
    const sc = spellcastingOf(c, undefined, bestand);
    expect(castRelations(sc)[0]).toMatchObject({ id: '~cast:anc-elf:sp-thaum', type: 'casts', props: { source: 'anc-elf', ability: 'cha' } });
    expect(withCastRelations(figur([klasse('class-wiz', 1)]), spellcastingOf(figur([klasse('class-wiz', 1)]), undefined, bestand)).relations?.some((r) => r.type === 'casts')).toBe(true);
    expect(withCastRelations(figur([klasse('class-fig', 1)]), spellcastingOf(figur([klasse('class-fig', 1)]), undefined, bestand)).relations?.some((r) => r.type === 'casts')).toBe(false);
  });

  it('gives the read statblock ability and slots for the header', () => {
    const sb = art('sb', 'Statblock', { Statblock: {}, Abilities: { int: 16 } });
    const w = characterStats(figur([klasse('class-wiz', 3)]), sb, bestand);
    expect(w.statblock?.components?.['Statblock']).toMatchObject({ spellAbility: 'int', spellSlots: [4, 2], casterLevel: 3 });
  });
});

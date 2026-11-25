import { describe, expect, it } from 'vitest';
import { hasProficiency, proficienciesOf, proficiencyEntry, proficiencyNames, type Entity } from '../src/index.js';

const art = (id: string, typ: string, components: Entity['components'] = {}, relations: Entity['relations'] = []): Entity => ({
  id, interfaces: [typ], name: id, components, relations,
});

/* Der Fall der Leitung (15.10.): Barbar, Hintergrund Artisan mit
   Werkzeugwahl, dazu das Talent Crafter, das der Hintergrund gewährt. */
const barbar = art('class-barb', 'Class', {
  Class: { multiclassProficient: ['shield', 'simple', 'martial'] },
  Proficiencies: { saves: ['str', 'con'], proficient: ['light', 'medium', 'shield', 'simple', 'martial'] },
  Choices: { choices: [{ id: 'skills', kind: 'proficiency', when: 'start', count: 2, from: { values: ['Athletics', 'Nature', 'Survival'] } }] },
});
const schurke = art('class-rogue', 'Class', {
  Class: { multiclassProficient: ['light', "Thieves' Tools"] },
  Proficiencies: { saves: ['dex', 'int'], proficient: ['light', 'simple'] },
});
const crafter = art('feat-crafter', 'Feat', {
  Choices: { choices: [{ id: 'tools', kind: 'proficiency', count: 3, from: { values: ["Smith's Tools", "Tinker's Tools", "Leatherworker's Tools", "Mason's Tools"] } }] },
});
const artisan = art(
  'bg-artisan',
  'Background',
  {
    Proficiencies: { proficient: ['Investigation', 'Persuasion'] },
    Choices: { choices: [{ id: 'tools', kind: 'proficiency', count: 1, from: { enumRef: ['Item'] } }] },
  },
  [{ id: 'g1', type: 'grants', to: 'feat-crafter', props: { level: 1 } }],
);
const smith = art('item-smith', 'Item', { Item: { itemType: "artisan's tools" } });
const ring = art('item-ring', 'Item', { Effects: { effects: [{ id: 'p', target: 'proficiency', op: 'grant', value: 'Stealth', when: 'worn' }] } });
const tasche = art('inv-1', 'Inventory', {}, [{ id: 'h1', type: 'holds', to: 'item-ring', props: { tier: 'worn' } }]);

const figur = (rel: Entity['relations'] = []) =>
  art('pc-1', 'PlayerCharacter', {}, [
    { id: 'c1', type: 'hasClass', to: 'class-barb', props: { level: 3 } },
    { id: 'b1', type: 'hasBackground', to: 'bg-artisan' },
    { id: 'a1', type: 'chose', to: 'class-barb', props: { choice: 'skills', picks: ['Athletics', 'Nature'] } },
    { id: 'a2', type: 'chose', to: 'bg-artisan', props: { choice: 'tools', picks: ["Smith's Tools"] } },
    { id: 'a3', type: 'chose', to: 'feat-crafter', props: { choice: 'tools', by: 'bg-artisan', level: 1, picks: ["Tinker's Tools", "Leatherworker's Tools", "Mason's Tools"] } },
    ...(rel ?? []),
  ]);
const statblock = art('sb-1', 'Statblock', { Proficiencies: { proficient: ['Herbalism Kit'], expertise: ['Athletics'] } }, [
  { id: 'o', type: 'belongsTo', to: 'pc-1' },
]);
const bestand = new Map([barbar, schurke, crafter, artisan, smith, ring, tasche].map((e) => [e.id, e]));

describe('proficienciesOf (T-239)', () => {
  it('counts a tool chosen at the background, not only what the statblock lists', () => {
    const p = proficienciesOf(figur(), undefined, bestand);
    expect(hasProficiency(p, "Smith's tools")).toBe(true);
    expect(proficiencyEntry(p, "smith's tools")?.sources).toEqual([{ id: 'bg-artisan', via: 'choice', choice: 'tools' }]);
    /* Das Talent, das der Hintergrund gewährt, fragt selbst. */
    expect(hasProficiency(p, "Mason's Tools")).toBe(true);
    expect(p.missing).toEqual([]);
  });

  it('reads the fixed card of class and background with their origin', () => {
    const p = proficienciesOf(figur(), undefined, bestand);
    expect(proficiencyEntry(p, 'martial')?.sources).toEqual([{ id: 'class-barb', via: 'hasClass' }]);
    expect(proficiencyEntry(p, 'Persuasion')?.sources[0]?.via).toBe('hasBackground');
    expect(proficiencyNames(p, 'saves')).toEqual(['str', 'con']);
    expect(hasProficiency(p, 'shields')).toBe(true);
  });

  it('keeps what the statblock holds by hand, expertise counting as proficiency', () => {
    const p = proficienciesOf(figur(), statblock, bestand);
    expect(proficiencyEntry(p, 'Herbalism Kit')?.sources).toEqual([{ id: 'sb-1', via: 'statblock' }]);
    expect(proficiencyEntry(p, 'Athletics')?.kind).toBe('expertise');
    expect(proficiencyNames(p)).toContain('Athletics');
  });

  it('gives a second class only its multiclass list and no saves', () => {
    const p = proficienciesOf(figur([{ id: 'c2', type: 'hasClass', to: 'class-rogue', props: { level: 1 } }]), undefined, bestand);
    expect(proficiencyEntry(p, "Thieves' Tools")?.sources).toEqual([{ id: 'class-rogue', via: 'multiclass' }]);
    expect(hasProficiency(p, 'dex', 'saves')).toBe(false);
  });

  it('reads a worn item that grants proficiency, and names articles it does not hold', () => {
    const p = proficienciesOf(figur([{ id: 'k', type: 'carries', to: 'inv-1' }]), undefined, bestand);
    expect(proficiencyEntry(p, 'Stealth')?.sources).toEqual([{ id: 'item-ring', via: 'effect' }]);
    const ohne = new Map(bestand);
    ohne.delete('bg-artisan');
    expect(proficienciesOf(figur(), undefined, ohne).missing).toEqual(['bg-artisan']);
  });
});

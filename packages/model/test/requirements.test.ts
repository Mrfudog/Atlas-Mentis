/**
 * Voraussetzungen als prüfbare Form (T-180): der Satz bleibt, gelesen wird
 * er beim Rechnen; was die Form nicht kennt, ist unbekannt und nicht „nein".
 */
import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import { effectKeys, effectLabel, facetsFor } from '../src/facets.js';
import { meetsRequirement, parseRequirement, requirementKeys, requirementLabel, type CharacterProfile } from '../src/requirements.js';
import type { Entity } from '../src/types.js';

const ctx = { classes: new Set(['wizard', 'cleric', 'paladin', 'fighter']), ancestries: new Set(['elf', 'half-elf', 'dwarf']) };

const profil = (p: Partial<CharacterProfile> = {}): CharacterProfile => ({
  id: 'c',
  name: 'Mira',
  level: 4,
  classes: [{ name: 'wizard', level: 4 }],
  ancestries: ['elf'],
  abilities: { str: 8, int: 16 },
  proficient: ['light'],
  spellcasting: true,
  has: [],
  ...p,
});

describe('parseRequirement', () => {
  it('splits options, parts and alternatives', () => {
    expect(parseRequirement('level 4, STR 13; or level 4, DEX 13', ctx)).toEqual([
      [{ kind: 'level', min: 4 }, { kind: 'ability', ability: 'str', min: 13 }],
      [{ kind: 'level', min: 4 }, { kind: 'ability', ability: 'dex', min: 13 }],
    ]);
    expect(parseRequirement('Elf or Half-Elf', ctx)).toEqual([
      [{ kind: 'any', of: [{ kind: 'ancestry', name: 'elf' }, { kind: 'ancestry', name: 'half-elf' }] }],
    ]);
    /* Zwei Attribute nebeneinander sind eine Wahl (so schreibt 5e.tools „INT or WIS 13"). */
    expect(parseRequirement('INT 13, WIS 13', ctx)[0]).toEqual([
      { kind: 'any', of: [{ kind: 'ability', ability: 'int', min: 13 }, { kind: 'ability', ability: 'wis', min: 13 }] },
    ]);
    expect(parseRequirement('Fighter level 3', ctx)).toEqual([[{ kind: 'level', min: 3, class: 'fighter' }]]);
    expect(parseRequirement('[[feat-0088|initiate of high sorcery]]', ctx)).toEqual([
      [{ kind: 'has', id: 'feat-0088', name: 'initiate of high sorcery' }],
    ]);
    expect(parseRequirement('by a cleric, druid, or paladin', ctx)[0]![0]).toMatchObject({
      kind: 'any',
      of: [{ kind: 'class', name: 'cleric' }, { kind: 'unknown' }, { kind: 'class', name: 'paladin' }],
    });
    expect(parseRequirement('Elf (drow)', ctx)).toEqual([[{ kind: 'ancestry', name: 'elf (drow)' }]]);
    expect(parseRequirement('', ctx)).toEqual([]);
  });

  it('names its values for the facet', () => {
    expect(requirementKeys(parseRequirement('level 4, proficiency with heavy armor', ctx))).toEqual(['level:4', 'prof:heavy']);
    expect(requirementKeys([])).toEqual(['none']);
    expect(requirementLabel('ability:str:13')).toBe('STR 13+');
    expect(requirementLabel('level:fighter:3')).toBe('Fighter level 3+');
    expect(requirementLabel('has:x', () => 'Squire')).toBe('Has: Squire');
  });
});

describe('meetsRequirement', () => {
  const pruefe = (text: string, p = profil()) => meetsRequirement(parseRequirement(text, ctx), p);
  it('says yes, no or unknown', () => {
    expect(pruefe('level 4, INT 13')).toBe('yes');
    expect(pruefe('STR 13; or INT 13')).toBe('yes');
    expect(pruefe('STR 13')).toBe('no');
    expect(pruefe('DEX 13')).toBe('unknown');
    expect(pruefe('Dragonlance campaign')).toBe('unknown');
    expect(pruefe('proficiency with heavy armor')).toBe('no');
    expect(pruefe('proficiency with heavy armor', profil({ proficient: [] }))).toBe('unknown');
    expect(pruefe('by a cleric or paladin')).toBe('no');
    expect(pruefe('Fighter level 1')).toBe('no');
    expect(pruefe('Elf (drow)', profil({ ancestries: ['elf (drow)', 'elf'] }))).toBe('yes');
    expect(pruefe('the ability to cast at least one spell', profil({ spellcasting: false }))).toBe('no');
    /* „unbekannt" schlägt „nein" in einer Oder-Liste, „nein" schlägt es in einer Und-Liste. */
    expect(pruefe('level 4, Dragonlance campaign')).toBe('unknown');
    expect(pruefe('level 19, Dragonlance campaign')).toBe('no');
  });
});

describe('effects and requirements in facetsFor', () => {
  it('reads Effects and prerequisite fields the way the registry says', () => {
    const item = facetsFor(seedRegistry, 'Item');
    expect(item.find((f) => f.ref === 'Effects.effects')?.kind).toBe('effect');
    expect(item.find((f) => f.ref === 'Item.attunementNote')?.kind).toBe('requirement');
    expect(facetsFor(seedRegistry, 'Feat').find((f) => f.ref === 'Feat.prerequisite')?.kind).toBe('requirement');
    expect(facetsFor(seedRegistry, 'Feature').some((f) => f.ref === 'Effects.effects')).toBe(true);
  });

  it('turns effects into words', () => {
    const e = {
      id: 'x',
      interfaces: ['Item'],
      components: {
        Effects: { effects: [{ id: 'a', target: 'resist', op: 'grant', value: 'Fire' }, { id: 'b', target: 'ability.str', op: 'set', value: 19 }] },
        Item: { bonusAc: 1 },
      },
    } as unknown as Entity;
    expect(effectKeys(e)).toEqual(['resist:fire', 'set:ability.str', 'add:ac']);
    expect(effectLabel('set:ability.str')).toBe('Sets Strength');
    expect(effectLabel('conditionImmune:poisoned')).toBe('Condition immunity: poisoned');
  });
});

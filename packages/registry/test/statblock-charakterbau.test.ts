import { describe, expect, it } from 'vitest';
import {
  derivedValue,
  enumGroups,
  enumOptions,
  fieldTitle,
  fieldsOf,
  relationAccepts,
  typeChain,
  validateEntity,
} from '@nw/model';
import type { Entity } from '@nw/model';
import { seedRegistry } from '../src/index.js';

/**
 * P4 (M5, M3, M6): der Statblock wächst, eine Aktion trägt ihren Angriff,
 * Klasse, Unterklasse, Abstammung und Hintergrund sind Arten, und die
 * Übungen kommen aus Artikeln.
 *
 * Die Artikel unten sind Goblin und Mage (MM), Fighter und Champion (PHB),
 * Dwarf und Hill Dwarf (PHB) und Acolyte (PHB) aus 5e.tools, in unsere Form
 * gebracht — so, wie der Importer (P5) sie schreiben soll. Lehnt die
 * Prüfung etwas ab, kann der Importer es auch nicht schreiben.
 */

const r = seedRegistry;
const art = (
  id: string,
  typ: string,
  name: string,
  karten: Record<string, Record<string, unknown>> = {},
  relations: Entity['relations'] = [],
): Entity => ({
  id,
  interfaces: [typ],
  name,
  components: { Identity: { name, id }, ...karten },
  relations,
});

const aktion = art('actiontype-0001', 'ActionType', 'Action');
const bonus = art('actiontype-0002', 'ActionType', 'Bonus Action');

const stealth = art('skill-0001', 'Skill', 'Stealth', { Skill: { ability: 'dex' } });
const athletics = art('skill-0002', 'Skill', 'Athletics', { Skill: { ability: 'str' } });
const arcana = art('skill-0003', 'Skill', 'Arcana', { Skill: { ability: 'int' } });
const common = art('language-0001', 'Language', 'Common', { Language: { languageType: 'standard', script: 'Common' } });
const goblinisch = art('language-0002', 'Language', 'Goblin', { Language: { languageType: 'standard', script: 'Dwarvish' } });
const zwergisch = art('language-0003', 'Language', 'Dwarvish', { Language: { languageType: 'standard', script: 'Dwarvish' } });
const schmied = art('item-0001', 'Item', "Smith's tools", { Item: { itemType: 'artisan tools' } });
const krummsaebel = art('weapon-0001', 'Weapon', 'Scimitar', {
  Item: { itemType: 'melee weapon' },
  Weapon: { category: 'martial', damage: '1d6', damageType: 'slashing' },
});
const vergiftet = art('condition-0001', 'Condition', 'Poisoned');

/* Der Goblin: Heimlichkeit +6, wo DEX und Übung +4 ergäben — Expertise
   steht nicht im Buch, also ein fester Bonus. */
const nimbleEscape = art('feature-0001', 'Feature', 'Nimble Escape', {
  Prose: { paragraph: ['The goblin can take the Disengage or Hide action as a bonus action on each of its turns.'] },
});
const scimitarHieb = art('action-0001', 'Action', 'Scimitar', {
  Action: {
    actionType: 'actiontype-0001',
    attack: ['melee weapon'],
    toHit: 4,
    reach: 5,
    damage: '1d6+2',
    damageType: 'slashing',
  },
  Prose: { paragraph: ['{{+4}} to hit, reach 5 ft., one target. Hit: 5 ({{1d6+2}}) slashing damage.'] },
});
const kurzbogen = art('action-0002', 'Action', 'Shortbow', {
  Action: { actionType: 'actiontype-0001', attack: ['ranged weapon'], toHit: 4, range: '80/320', damage: '1d6+2', damageType: 'piercing' },
});
const dolch = art('action-0003', 'Action', 'Dagger', {
  Action: {
    actionType: 'actiontype-0001',
    attack: ['melee weapon', 'ranged weapon'],
    toHit: 5,
    reach: 5,
    range: '20/60',
    damage: '1d4+2',
    damageType: 'piercing',
  },
});

const goblin = art(
  'statblock-0001',
  'Statblock',
  'Goblin',
  {
    Statblock: {
      size: 'small',
      creatureType: 'humanoid (goblinoid)',
      alignment: 'neutral evil',
      ac: 15,
      acNote: 'leather armor, shield',
      hp: 7,
      hpFormula: '2d6',
      speed: '30',
      cr: '1/4',
      prof: 2,
      senses: 'darkvision 60 ft.',
      bonuses: { Stealth: 6 },
    },
    Abilities: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
    Proficiencies: { proficient: ['Stealth', 'Common', 'Goblin'] },
    Tags: { tags: ['goblinoid', 'underdark', 'forest', 'hill'] },
    Source: { publication: 'MM', page: '166', srd: true },
  },
  [
    { id: 'r1', type: 'composedOf', to: 'feature-0001' },
    { id: 'r2', type: 'composedOf', to: 'action-0001' },
    { id: 'r3', type: 'composedOf', to: 'action-0002' },
    { id: 'r4', type: 'equips', to: 'weapon-0001' },
  ],
);

const mage = art(
  'statblock-0002',
  'Statblock',
  'Mage',
  {
    Statblock: {
      size: 'medium',
      creatureType: 'humanoid (any race)',
      alignment: 'any alignment',
      ac: 12,
      acNote: '15 with mage armor',
      hp: 40,
      hpFormula: '9d8',
      speed: '30',
      cr: '6',
      prof: 3,
      languageNote: 'any four languages',
      spellAbility: 'int',
      casterLevel: 9,
      spellSlots: [4, 3, 3, 3, 1],
    },
    Abilities: { str: 9, dex: 14, con: 11, int: 17, wis: 12, cha: 11 },
    Proficiencies: { proficient: ['Arcana', 'History'], saves: ['int', 'wis'] },
    Source: { publication: 'MM', page: '347', srd: true },
  },
  [{ id: 'r1', type: 'composedOf', to: 'action-0003' }],
);

const fighter = art(
  'class-0001',
  'Class',
  'Fighter',
  {
    Class: {
      hitDie: 10,
      startingEquipment: '- (a) chain mail or (b) leather armor, longbow, and 20 arrows\n- (a) a martial weapon and a shield or (b) two martial weapons',
      multiclassRequirement: 'STR 13 or DEX 13',
      multiclassProficient: ['light', 'medium', 'shield', 'simple', 'martial'],
      subclassTitle: 'Martial Archetype',
    },
    Proficiencies: { proficient: ['light', 'medium', 'heavy', 'shield', 'simple', 'martial'], saves: ['str', 'con'] },
    ProficiencyChoice: {
      chooseFrom: ['Acrobatics', 'Animal Handling', 'Athletics', 'History', 'Insight', 'Intimidation', 'Perception', 'Survival'],
      chooseCount: 2,
    },
    Source: { publication: 'PHB', page: '70', srd: true },
  },
  [
    { id: 'r1', type: 'grants', to: 'feature-0002', props: { level: 1 } },
    { id: 'r2', type: 'grants', to: 'feature-0003', props: { level: 4 } },
    { id: 'r3', type: 'grants', to: 'feature-0003', props: { level: 6 } },
  ],
);
const secondWind = art('feature-0002', 'Feature', 'Second Wind', {
  Prose: { paragraph: ['On your turn, you can use a bonus action to regain hit points equal to {{1d10}} + your fighter level.'] },
});
const asi = art('feature-0003', 'Feature', 'Ability Score Improvement');

const champion = art(
  'subclass-0001',
  'Subclass',
  'Champion',
  { Subclass: { shortName: 'Champion' }, Source: { publication: 'PHB', page: '72', srd: true } },
  [
    { id: 'r1', type: 'subclassOf', to: 'class-0001' },
    { id: 'r2', type: 'grants', to: 'feature-0004', props: { level: 3 } },
  ],
);
const improvedCritical = art('feature-0004', 'Feature', 'Improved Critical');

const dwarf = art(
  'ancestry-0001',
  'Ancestry',
  'Dwarf',
  {
    Ancestry: {
      size: ['medium'],
      speed: '25',
      abilityBonus: { con: 2 },
      age: 'mature at 20, live about 350 years',
      darkvision: 60,
      resistances: ['poison'],
    },
    Proficiencies: { proficient: ['Common', 'Dwarvish', 'Battleaxe', 'Handaxe', 'Light Hammer', 'Warhammer'] },
    ProficiencyChoice: { chooseFrom: ["Smith's tools", "Brewer's supplies", "Mason's tools"], chooseCount: 1 },
    Source: { publication: 'PHB', page: '18', srd: true },
  },
  [{ id: 'r1', type: 'grants', to: 'feature-0005' }],
);
const resilience = art('feature-0005', 'Feature', 'Dwarven Resilience');
const hillDwarf = art(
  'ancestry-0002',
  'Ancestry',
  'Hill Dwarf',
  { Ancestry: { abilityBonus: { wis: 1 } } },
  [{ id: 'r1', type: 'subraceOf', to: 'ancestry-0001' }],
);

const acolyte = art(
  'background-0001',
  'Background',
  'Acolyte',
  {
    Background: { startingEquipment: 'A holy symbol, a prayer book or prayer wheel, 5 sticks of incense, vestments, common clothes, and 15 gp' },
    Proficiencies: { proficient: ['Insight', 'Religion'] },
    ProficiencyChoice: { chooseCount: 2, chooseNote: 'two standard languages of your choice' },
    Source: { publication: 'PHB', page: '127', srd: true },
  },
);

const bestand = [
  aktion, bonus, stealth, athletics, arcana, common, goblinisch, zwergisch, schmied, krummsaebel,
  vergiftet, nimbleEscape, scimitarHieb, kurzbogen, dolch, goblin, mage, fighter, secondWind, asi,
  champion, improvedCritical, dwarf, resilience, hillDwarf, acolyte,
];
const knownTypes = new Map(bestand.map((e) => [e.id, e.interfaces[0] as string]));

describe('the 5e.tools samples in our form (P4)', () => {
  it.each(bestand.map((e) => [e.name, e] as const))('%s passes validation', (_n, e) => {
    expect(validateEntity(r, e, { knownTypes })).toEqual([]);
  });
});

describe('the statblock grows (M5)', () => {
  const sb = r.interfaces['Statblock']!;
  it('takes proficiencies, lore and an image, and declares the new fields itself', () => {
    expect(sb.extends).toEqual(expect.arrayContaining(['Abilities', 'Proficiencies', 'Lore', 'Image']));
    const eigen = Object.keys(sb.schema?.properties ?? {});
    expect(eigen).toEqual(
      expect.arrayContaining(['languageNote', 'conditionImmunities', 'legendaryActions', 'bonuses', 'token']),
    );
    expect(sb.schema?.properties['size']?.enumRef).toBe('Size');
    expect(r.enums?.['Size']?.values).toEqual(['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan']);
  });

  /* Die Übungen gehören zu den Zahlen, und die wohnen am Statblock — an der
     Kreatur wären sie die zweite Antwort. */
  it('moves proficiencies off the creature', () => {
    expect(typeChain(r, 'Creature')).not.toContain('Proficiencies');
    expect(typeChain(r, 'PlayerCharacter')).not.toContain('Proficiencies');
  });

  it('names conditions it is immune to from the condition articles', () => {
    const p = sb.schema?.properties['conditionImmunities'];
    expect(enumOptions(r, p, bestand)).toEqual(['Poisoned']);
  });

  it('equips items from the book', () => {
    const equips = r.relations['equips']!;
    expect(relationAccepts(equips, 'Statblock', 'Weapon', r)).toBe(true);
    expect(equips.from).toEqual(['Statblock']);
    expect(relationAccepts(equips, 'Statblock', 'Spell', r)).toBe(false);
  });
});

describe('an action carries its attack', () => {
  it('reads the damage type from the shared row', () => {
    const a = r.interfaces['Action']!.schema!.properties;
    expect(enumOptions(r, a['damageType'])).toContain('slashing');
    expect(a['attack']?.enum).toEqual(['melee weapon', 'ranged weapon', 'melee spell', 'ranged spell']);
  });

  it('rejects a damage type that is not one', () => {
    const falsch = art('action-0009', 'Action', 'Stumpf', { Action: { actionType: 'actiontype-0001', damageType: 'stumpf' } });
    expect(validateEntity(r, falsch).map((i) => i.code)).toEqual(['value_not_allowed']);
  });
});

describe('character building (M3)', () => {
  it('has four kinds under Rule, in the rules area', () => {
    for (const t of ['Class', 'Subclass', 'Ancestry', 'Background']) {
      expect(r.interfaces[t]?.extends?.[0]).toBe('Rule');
      expect(r.interfaces[t]?.area).toBe('rules');
      expect(typeChain(r, t)).toEqual(expect.arrayContaining(['Proficiencies', 'ProficiencyChoice']));
    }
  });

  /* An der Klasse gewährt die Übungsgruppe, an der Figur hätte sie
     „Proficient in" geheissen — dieselbe Gruppe, ein anderer Name. */
  it('renames the proficiency field where it is granted', () => {
    const f = fieldsOf(r, 'Class').find((x) => x.key === 'proficient')!;
    expect(fieldTitle(r, 'Class', f)).toBe('Grants proficiency in');
  });

  it('keeps the edges forward, from the one who has or gives', () => {
    const rel = r.relations;
    expect(rel['subclassOf']).toMatchObject({ from: ['Subclass'], to: ['Class'], cardinality: 'one' });
    expect(rel['subraceOf']).toMatchObject({ from: ['Ancestry'], to: ['Ancestry'], cardinality: 'one' });
    expect(rel['hasClass']).toMatchObject({ from: ['PlayerCharacter'], to: ['Class'] });
    expect(rel['hasClass']?.cardinality ?? 'many').toBe('many');
    expect(rel['hasClass']?.props?.required).toEqual(['level']);
    expect(rel['hasClass']?.props?.properties['subclass']?.target?.interfaces).toEqual(['Subclass']);
    expect(rel['hasAncestry']).toMatchObject({ to: ['Ancestry'], cardinality: 'one' });
    expect(rel['hasBackground']).toMatchObject({ to: ['Background'], cardinality: 'one' });
    expect(rel['grants']?.from).toEqual(['Class', 'Subclass', 'Ancestry', 'Background', 'Feat']);
    expect(relationAccepts(rel['grants']!, 'Class', 'Feature', r)).toBe(true);
    expect(rel['featureOf']).toBeUndefined();
  });

  /* Die Stufe steht an der Kante, also nicht am Merkmal. */
  it('puts the level of a feature on the edge', () => {
    expect(r.interfaces['Feature']?.schema?.properties['level']).toBeUndefined();
  });

  it('drops class and ancestry as words and works the level out from the edges', () => {
    const pc = r.interfaces['PlayerCharacter']!.schema!.properties;
    expect(pc['class']).toBeUndefined();
    expect(pc['ancestry']).toBeUndefined();
    const kanten = [
      { id: 'k1', type: 'hasClass', to: 'class-0001', props: { level: 3, subclass: 'subclass-0001' } },
      { id: 'k2', type: 'hasClass', to: 'class-0002', props: { level: 2 } },
      { id: 'k3', type: 'hasAncestry', to: 'ancestry-0002' },
    ];
    expect(derivedValue(pc['level']!, {}, {}, kanten)).toBe(5);
    expect(derivedValue(pc['proficiency']!, {}, {}, kanten)).toBe(3);
    expect(derivedValue(pc['level']!, {}, {}, [])).toBeUndefined();
  });

  it('lets a character carry no level card at all', () => {
    const figur = art('playercharacter-0001', 'PlayerCharacter', 'Brana', {}, [
      { id: 'k1', type: 'hasClass', to: 'class-0001', props: { level: 3 } },
    ]);
    expect(validateEntity(r, figur, { knownTypes: new Map([...knownTypes, ['class-0001', 'Class']]) })).toEqual([]);
  });
});

describe('proficiencies from articles (M6)', () => {
  const p = r.interfaces['Proficiencies']!.schema!.properties['proficient'];

  it('offers skills, languages, tools and weapons by name, and the groups as words', () => {
    const gruppen = Object.fromEntries(enumGroups(r, p, bestand).map((g) => [g.name, g.values]));
    expect(gruppen['Skill']).toEqual(['Arcana', 'Athletics', 'Stealth']);
    expect(gruppen['Language']).toEqual(['Common', 'Dwarvish', 'Goblin']);
    expect(gruppen['Item']).toEqual(["Smith's tools"]);
    expect(gruppen['Weapon']).toEqual(['Scimitar']);
    expect(gruppen['Weapon.category']).toEqual(['simple', 'martial']);
    expect(gruppen['Armor.armorType']).toEqual(['light', 'medium', 'heavy', 'shield']);
  });

  /* Was die Liste nicht kennt, nimmt die Prüfung trotzdem: ein Name ist
     der heutige Stand (D50). Die Hausregel „Nebelkunde" ist eine Fertigkeit,
     die vielleicht erst morgen einen Artikel bekommt. */
  it('holds no stored name against today’s articles', () => {
    const sb = art('statblock-0009', 'Statblock', 'Nebelwächter', { Proficiencies: { proficient: ['Nebelkunde'] } });
    expect(validateEntity(r, sb)).toEqual([]);
  });
});

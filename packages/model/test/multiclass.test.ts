import { describe, expect, it } from 'vitest';
import { canAddClass, changeClassLevel, classLevelRows, multiclassUnmet, parseMulticlassRequirement, type Entity } from '../src/index.js';

const art = (id: string, typ: string, components: Entity['components'] = {}, relations: Entity['relations'] = []): Entity => ({
  id, interfaces: [typ], name: id, components, relations,
});
const wizard = art('class-wiz', 'Class', {
  Class: { multiclassRequirement: 'INT 13' },
  Choices: { choices: [{ id: 'cantrips', kind: 'spell', count: 3 }, { id: 'tradition', kind: 'subclass', level: 2 }] },
});
const fighter = art('class-fig', 'Class', { Class: { multiclassRequirement: 'STR 13 or DEX 13' } });
const paladin = art('class-pal', 'Class', { Class: { multiclassRequirement: 'STR 13, CHA 13' } });
const bestand = new Map([wizard, fighter, paladin].map((e) => [e.id, e]));
const figur = (rel: Entity['relations']) => art('pc', 'PlayerCharacter', {}, rel);

describe('multiclassing by the rules (T-319)', () => {
  it('reads “or” and “,” in a requirement', () => {
    expect(parseMulticlassRequirement('STR 13, CHA 13')).toEqual([[{ ability: 'str', min: 13 }], [{ ability: 'cha', min: 13 }]]);
    expect(parseMulticlassRequirement('Strength 13 or Dexterity 13')).toEqual([[{ ability: 'str', min: 13 }, { ability: 'dex', min: 13 }]]);
    expect(multiclassUnmet('STR 13 or DEX 13', { str: 8, dex: 14 })).toBeNull();
    expect(multiclassUnmet('STR 13, CHA 13', { str: 14, cha: 10 })).toBe('CHA 13');
  });

  it('needs the minimum of every current class and of the new one', () => {
    const c = figur([{ id: 'k', type: 'hasClass', to: 'class-wiz', props: { level: 3 } }]);
    expect(canAddClass(c, 'class-fig', bestand, { int: 15, str: 8, dex: 14 })).toBeNull();
    expect(canAddClass(c, 'class-pal', bestand, { int: 15, str: 14, cha: 10 })).toBe('needs CHA 13');
    expect(canAddClass(c, 'class-fig', bestand, { int: 11, dex: 14 })).toBe('class-wiz needs INT 13');
    expect(canAddClass(figur([]), 'class-pal', bestand, {})).toBeNull();
  });

  it('raises and lowers a class, drops a second class at 0, keeps the first', () => {
    let c = figur([{ id: 'k', type: 'hasClass', to: 'class-wiz', props: { level: 1 } }]);
    c = changeClassLevel(c, 'class-wiz', 1, bestand);
    c = changeClassLevel(c, 'class-fig', 1, bestand);
    expect(classLevelRows(c)).toEqual([
      { id: 'class-wiz', level: 2, first: true, canRaise: true, canLower: true },
      { id: 'class-fig', level: 1, first: false, canRaise: true, canLower: true },
    ]);
    c = changeClassLevel(c, 'class-fig', -1, bestand);
    expect(classLevelRows(c).map((z) => z.id)).toEqual(['class-wiz']);
    c = changeClassLevel(changeClassLevel(c, 'class-wiz', -1, bestand), 'class-wiz', -1, bestand);
    expect(classLevelRows(c)[0]).toMatchObject({ level: 1, canLower: false });
  });

  it('drops the answer a lowered level asked for', () => {
    const c = figur([
      { id: 'k', type: 'hasClass', to: 'class-wiz', props: { level: 2 } },
      { id: 'a', type: 'chose', to: 'class-wiz', props: { choice: 'tradition', picks: ['sub-x'] } },
      { id: 'b', type: 'chose', to: 'class-wiz', props: { choice: 'cantrips', picks: ['s1', 's2', 's3'] } },
    ]);
    const tiefer = changeClassLevel(c, 'class-wiz', -1, bestand);
    expect(tiefer.relations?.filter((r) => r.type === 'chose').map((r) => r.id)).toEqual(['b']);
  });
});

import { describe, expect, it } from 'vitest';
import {
  bookSections,
  coinText,
  creatureRef,
  fieldText,
  itemBook,
  keyStats,
  ordinal,
  passivePerception,
  spellBook,
  statblockBook,
  xpForCr,
} from '../src/book.js';
import type { Entity, Registry } from '../src/types.js';
import { seedRegistry } from '../../registry/src/index.js';

/* Imperial, damit die Zahlen aussehen wie im Buch; die Umrechnung prüft
   ein eigener Fall. */
const imperial: Registry = { ...seedRegistry, settings: { ...seedRegistry.settings, units: 'imperial' } };

/* Der Goblin, wie der Importer ihn schreibt (MM 166). */
const goblin: Entity = {
  id: 'sb-goblin',
  interfaces: ['Statblock'],
  name: 'Goblin',
  components: {
    Statblock: {
      size: 'small',
      creatureType: 'humanoid (goblinoid)',
      alignment: 'neutral evil',
      ac: 15,
      acNote: 'leather armor, shield',
      hp: 7,
      hpFormula: '2d6',
      speed: '30 ft.',
      cr: '1/4',
      prof: 2,
      senses: 'darkvision 60 ft.',
      combatRole: 'skirmisher',
    },
    Abilities: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
    Proficiencies: { proficient: ['Common', 'Goblin'], expertise: ['Stealth'] },
  },
  relations: [
    { id: 'k1', type: 'composedOf', to: 'nimble', props: { vars: { CREATURE: 'goblin' } } },
    { id: 'k2', type: 'composedOf', to: 'scimitar' },
    { id: 'k3', type: 'composedOf', to: 'shortbow' },
    { id: 'k4', type: 'composedOf', to: 'weg' },
  ],
};

const teile: Record<string, Entity> = {
  nimble: {
    id: 'nimble',
    interfaces: ['Feature'],
    name: 'Nimble Escape',
    components: {
      Feature: { featureType: 'monster' },
      Prose: { paragraph: [{ id: 'text', value: 'The {CREATURE} can take the Disengage or Hide action as a bonus action.' }] },
      Vars: { bindings: { CREATURE: 'creature' } },
    },
  },
  scimitar: {
    id: 'scimitar',
    interfaces: ['Action'],
    name: 'Scimitar',
    components: {
      Action: { actionType: 'at-action', attack: ['melee weapon'], damageType: 'slashing', ability: 'dex', damageDice: '1d6', reach: 5, target: 'one target' },
    },
  },
  shortbow: {
    id: 'shortbow',
    interfaces: ['Action'],
    name: 'Shortbow',
    components: {
      Action: { actionType: 'at-action', attack: ['ranged weapon'], damageType: 'piercing', damageDice: '1d6', range: '80/320', target: 'one target' },
    },
  },
};
const namen: Record<string, string> = {
  'at-action': 'Action',
  'at-legendary': 'Legendary Action',
  'at-reaction': 'Reaction',
  weg: 'Hidden thing',
};
const ctx = { part: (id: string) => teile[id], nameOf: (id: string) => namen[id] };

describe('Der Statblock wie im Buch (W2)', () => {
  const book = statblockBook(imperial, goblin, {
    kindOf: (n) => (n === 'Stealth' ? 'Skill' : 'Language'),
    skillAbility: (n) => (n === 'Stealth' ? 'dex' : undefined),
  });

  it('setzt Grösse, Typ und Gesinnung kursiv unter den Namen', () => {
    expect(book.byline).toBe('Small humanoid (goblinoid), neutral evil');
  });

  it('schreibt Rüstungsklasse, Trefferpunkte mit Würfel und Bewegung', () => {
    expect(book.top).toEqual([
      { label: 'Armor Class', text: '15 (leather armor, shield)', ref: 'Statblock.ac' },
      { label: 'Hit Points', text: '7 ({{2d6}})', ref: 'Statblock.hp' },
      { label: 'Speed', text: '30 ft', ref: 'Statblock.speed' },
    ]);
  });

  it('rechnet die sechs Modifikatoren beim Lesen (D8)', () => {
    expect(book.abilities.map((a) => `${a.label} ${a.score} ${a.mod}`)).toEqual([
      'STR 8 (−1)', 'DEX 14 (+2)', 'CON 10 (+0)', 'INT 10 (+0)', 'WIS 8 (−1)', 'CHA 8 (−1)',
    ]);
  });

  it('rechnet Fertigkeiten mit Expertise, die passive Wahrnehmung und die Erfahrung', () => {
    const zeile = (l: string) => book.details.find((d) => d.label === l)?.text;
    expect(zeile('Skills')).toBe('Stealth +6');
    expect(zeile('Senses')).toBe('darkvision 60 ft, passive Perception 9');
    expect(zeile('Languages')).toBe('Common, Goblin');
    expect(zeile('Challenge')).toBe('1/4 (50 XP)');
    expect(zeile('Proficiency Bonus')).toBe('+2');
  });

  it('sagt je Fertigkeit, Rettungswurf und Attribut, was gewürfelt wird (T-181)', () => {
    expect(book.details.find((d) => d.label === 'Skills')?.rolls).toEqual([{ name: 'Stealth', expr: '+6', label: 'Stealth check' }]);
    const dex = book.abilities.find((a) => a.key === 'dex');
    expect(dex?.check).toEqual({ name: 'DEX', expr: '+2', label: 'DEX check' });
    const mitSaves = statblockBook(imperial, {
      ...goblin,
      components: { ...goblin.components, Proficiencies: { ...goblin.components!['Proficiencies'], saves: ['dex', 'str'] } },
    }, { kindOf: () => 'Skill', skillAbility: () => 'dex' });
    expect(mitSaves.details.find((d) => d.label === 'Saving Throws')?.rolls).toEqual([
      { name: 'Dex', expr: '+4', label: 'DEX save' },
      { name: 'Str', expr: '+1', label: 'STR save' },
    ]);
  });

  it('nimmt eine feste Buchzahl vor der Rechnung', () => {
    const fest = statblockBook(imperial, {
      ...goblin,
      components: { ...goblin.components, Statblock: { ...goblin.components!['Statblock'], bonuses: { Stealth: 5 } } },
    }, { kindOf: () => 'Skill', skillAbility: () => 'dex' });
    expect(fest.details.find((d) => d.label === 'Skills')?.text).toContain('Stealth +5');
  });

  it('lässt kein Feld fallen: was keine Stelle hat, steht als Zusatzzeile da', () => {
    expect(book.extra).toEqual([{ label: 'Combat role', text: 'skirmisher', ref: 'Statblock.combatRole' }]);
  });

  it('rechnet Masse nach der Einstellung um', () => {
    const metrisch: Registry = { ...seedRegistry, settings: { ...seedRegistry.settings, units: 'metric' } };
    expect(statblockBook(metrisch, goblin).top.find((l) => l.label === 'Speed')?.text).toBe('9.1 m');
  });
});

describe('Die Abschnitte aus composedOf', () => {
  const abschnitte = bookSections(imperial, goblin, ctx);

  it('stellt die Merkmale ohne Überschrift voran und benennt den Rest nach der Aktionsart', () => {
    expect(abschnitte.map((s) => s.title)).toEqual(['', 'Actions']);
    expect(abschnitte[0]!.entries.map((e) => e.name)).toEqual(['Nimble Escape', 'Hidden thing']);
    expect(abschnitte[0]!.entries[1]!.missing).toBe(true);
  });

  it('bindet {CREATURE} an der Kante und nicht im Text', () => {
    const nimble = abschnitte[0]!.entries[0]!;
    expect(nimble.text).toContain('The {CREATURE} can take');
    expect(nimble.scopes.reference).toEqual({ CREATURE: 'goblin' });
    expect(nimble.scopes.entity).toEqual({ CREATURE: 'creature' });
  });

  it('rechnet die Angriffe am Statblock (D51)', () => {
    const [scimitar, shortbow] = abschnitte[1]!.entries;
    expect(scimitar!.text).toBe('*Melee Weapon Attack:* {{+4}} to hit, reach 5 ft, one target. *Hit:* 5 ({{1d6 + 2}}) slashing damage.');
    expect(shortbow!.text).toContain('range 80/320 ft, one target');
  });

  it('setzt die Aufladung an den Namen und den Satz vor die Legendären Aktionen', () => {
    const drache: Entity = {
      id: 'drache',
      interfaces: ['Statblock'],
      name: 'Adult Red Dragon',
      components: { Statblock: { legendaryActions: 3, prof: 6 }, Abilities: { str: 27 } },
      relations: [
        { id: 'd1', type: 'composedOf', to: 'atem', props: { vars: { CREATURE: 'dragon' } } },
        { id: 'd2', type: 'composedOf', to: 'schwanz' },
      ],
    };
    const t: Record<string, Entity> = {
      atem: { id: 'atem', interfaces: ['Action'], name: 'Fire Breath', components: { Action: { actionType: 'at-action', recharge: '5–6' } } },
      schwanz: { id: 'schwanz', interfaces: ['Action'], name: 'Tail Attack', components: { Action: { actionType: 'at-legendary' } } },
    };
    const s = bookSections(imperial, drache, { part: (id) => t[id], nameOf: (id) => namen[id] });
    expect(s.map((x) => x.title)).toEqual(['Actions', 'Legendary Actions']);
    expect(s[0]!.entries[0]!.name).toBe('Fire Breath (Recharge 5–6)');
    expect(s[1]!.intro).toMatch(/^The dragon can take 3 legendary actions/);
  });

  it('kennt beide Fassungen der Bindung (W1: „the dragon" mit Artikel)', () => {
    expect(creatureRef('dragon', 'Adult Red Dragon')).toBe('the dragon');
    expect(creatureRef('the dragon', 'Adult Red Dragon')).toBe('the dragon');
    expect(creatureRef('Venomfang', 'Venomfang')).toBe('Venomfang');
    expect(creatureRef(undefined, 'Goblin')).toBe('the goblin');
  });
});

describe('Der Zauber wie im Buch', () => {
  const fireball: Entity = {
    id: 'fb',
    interfaces: ['Spell'],
    name: 'Fireball',
    components: {
      Spell: {
        level: 3, school: 'evocation', castingTime: 1, castingAction: 'at-action', rangeKind: 'point', range: 150,
        components: ['v', 's', 'm'], material: 'a tiny ball of bat guano and sulfur', duration: 'instant',
        higherLevels: 'The damage increases by {{1d6}}.', save: ['dex'],
      },
    },
  };

  it('schreibt Grad und Schule und die vier Kopfzeilen', () => {
    const b = spellBook(imperial, fireball, (id) => namen[id]);
    expect(b.byline).toBe('3rd-level evocation');
    expect(b.lines.map((l) => `${l.label}: ${l.text}`)).toEqual([
      'Casting Time: 1 action',
      'Range: 150 ft',
      'Components: V, S, M (a tiny ball of bat guano and sulfur)',
      'Duration: Instantaneous',
    ]);
    expect(b.higherLevels).toContain('{{1d6}}');
    expect(b.extra.map((l) => l.ref)).toEqual(['Spell.save']);
  });

  it('nennt die Reichweite nie ohne Einheit', () => {
    const b = spellBook(seedRegistry, fireball, (id) => namen[id]);
    expect(b.lines.find((l) => l.label === 'Range')?.text).toBe('150 ft (45.7 m)');
  });

  it('kennt Zaubertricks, Rituale, Konzentration und Flächen um sich', () => {
    const b = spellBook(imperial, {
      id: 'x', interfaces: ['Spell'], name: 'X',
      components: { Spell: { level: 0, school: 'divination', ritual: true, rangeKind: 'cone', range: 15, castingAction: 'at-reaction', castingCondition: 'which you take when hit', duration: 'timed', durationAmount: 10, durationUnit: 'minute', concentration: true } },
    }, (id) => namen[id]);
    expect(b.byline).toBe('Divination cantrip (ritual)');
    const zeile = (l: string) => b.lines.find((x) => x.label === l)?.text;
    expect(zeile('Casting Time')).toBe('1 reaction, which you take when hit');
    expect(zeile('Range')).toBe('Self (15 ft cone)');
    expect(zeile('Duration')).toBe('Concentration, up to 10 minutes');
  });
});

describe('Der Gegenstand wie im Buch', () => {
  it('setzt Art, Seltenheit und Einstimmung kursiv unter den Namen', () => {
    const b = itemBook(imperial, {
      id: 'ft', interfaces: ['Item'], name: 'Flame Tongue',
      components: { Item: { rarity: 'rare', attunement: true, appliesTo: ['sword'] } },
    }, 'Item');
    expect(b.byline).toBe('Item (any sword), rare (requires attunement)');
  });

  it('schreibt Rüstung, Preis und Gewicht als Zeilen', () => {
    const b = itemBook(imperial, {
      id: 'pl', interfaces: ['Armor'], name: 'Plate Armor',
      components: {
        Item: { itemType: 'heavy armor', rarity: 'none', copperPrice: 150000, weight: 65 },
        Armor: { ac: 18, strength: 15, stealthDisadvantage: true, armorType: 'heavy' },
      },
    });
    expect(b.byline).toBe('Heavy armor');
    expect(b.lines.map((l) => `${l.label}: ${l.text}`)).toEqual([
      'Armor Class: 18', 'Strength: Str 15', 'Stealth: Disadvantage', 'Cost: 1,500 gp', 'Weight: 65 lb',
    ]);
  });
});

describe('Verweisfelder im Buch (T-078)', () => {
  const namen: Record<string, string> = { c1: 'Poisoned', c2: 'Charmed', ar: 'Arrow' };
  const nameOf = (id: string) => namen[id];

  it('nennt die Zustände eines Statblocks beim Namen', () => {
    const b = statblockBook(imperial, {
      id: 'sk', interfaces: ['Statblock'], name: 'Skeleton',
      components: { Statblock: { conditionImmunities: ['c1', 'c2', 'Exhaustion'] } },
    }, { nameOf });
    /* Was keinen Namen bekommt, steht, wie es dasteht. */
    expect(b.details.find((l) => l.label === 'Condition Immunities')?.text).toBe('Poisoned, Charmed, Exhaustion');
  });

  it('nennt die Munition einer Waffe beim Namen', () => {
    const b = itemBook(imperial, {
      id: 'lb', interfaces: ['Weapon'], name: 'Longbow',
      components: { Item: { itemType: 'ranged weapon' }, Weapon: { ammoType: 'ar' } },
    }, 'Weapon', nameOf);
    expect(b.lines.find((l) => l.label === 'Ammunition')?.text).toBe('Arrow');
  });
});

describe('Kleinzeug', () => {
  it('zählt, zahlt und misst', () => {
    expect([1, 2, 3, 4, 11, 12, 21].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '21st']);
    expect(coinText(1500)).toBe('15 gp');
    expect(coinText(50)).toBe('5 sp');
    expect(coinText(3)).toBe('3 cp');
    expect(xpForCr('17')).toBe(18000);
    expect(fieldText(imperial, { type: 'number', unit: 'ft' }, 150, 'imperial')).toBe('150 ft');
  });
});

describe('Kennzahlen (T-206)', () => {
  it('ein Statblock: AC, HP, Bewegung, Initiative, passive Wahrnehmung, CR', () => {
    const k = keyStats(imperial, goblin);
    expect(k.tiles.map((t) => [t.label, t.value])).toEqual([
      ['AC', '15'],
      ['HP', '7'],
      ['Speed', '30 ft'],
      ['Initiative', '+2'],
      ['Passive Perception', '9'],
      ['CR', '1/4'],
    ]);
    expect(k.tiles.find((t) => t.key === 'ac')?.note).toBe('leather armor, shield');
    expect(k.conditions).toEqual([]);
  });

  it('an einer Figur: Trefferpunkte jetzt/Maximum, zeitweilige, Zustände mit Namen', () => {
    const figur: Entity = {
      id: 'pc-1',
      interfaces: ['Creature'],
      name: 'Rin',
      components: { Vitals: { hp: 4, hpTemp: 3, conditions: ['cond-prone', 'cond-x'] } },
    };
    const k = keyStats(imperial, goblin, figur, { nameOf: (id) => (id === 'cond-prone' ? 'Prone' : undefined) });
    expect(k.tiles.find((t) => t.key === 'hp')).toMatchObject({ value: '4/7 +3', ref: 'Vitals.hp' });
    expect(k.conditions).toEqual([
      { id: 'cond-prone', name: 'Prone' },
      { id: 'cond-x', name: 'cond-x' },
    ]);
  });

  it('ohne Statblock nur der Stand, ohne Werte keine leeren Kacheln', () => {
    expect(keyStats(imperial, undefined, { id: 'x', interfaces: ['Creature'], components: { Vitals: { hp: 3 } } }).tiles).toEqual([
      { key: 'hp', label: 'HP', value: '3', ref: 'Vitals.hp' },
    ]);
    expect(keyStats(imperial, { id: 'leer', interfaces: ['Statblock'], components: {} }).tiles).toEqual([]);
  });

  it('feste Zahlen gehen vor: Initiative und Perception aus `bonuses`', () => {
    const sb: Entity = {
      ...goblin,
      components: {
        ...goblin.components,
        Statblock: { ...(goblin.components!['Statblock'] as object), bonuses: { initiative: 5, Perception: 4 } },
        Proficiencies: { proficient: ['Perception'] },
      },
    };
    const k = keyStats(imperial, sb);
    expect(k.tiles.find((t) => t.key === 'initiative')?.value).toBe('+5');
    expect(passivePerception(sb)).toBe(14);
    /* Geübt ohne feste Zahl: WIS (−1) plus Übung (2). */
    const geuebt: Entity = { ...goblin, components: { ...goblin.components, Proficiencies: { proficient: ['Perception'] } } };
    expect(passivePerception(geuebt)).toBe(11);
  });
});

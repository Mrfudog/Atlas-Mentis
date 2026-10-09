import { describe, expect, it } from 'vitest';
import type { Entity } from '@nw/model';
import { stageBases, validateEntity } from '@nw/model';
import { seedRegistry } from '@nw/registry';
import type { Knoten } from '../src/copy.js';
import type { Datenstand } from '../src/lesen.js';
import { ausschnitt, lauf } from '../src/lauf.js';
import { berichtMarkdown } from '../src/bericht.js';

/** Ein kleiner Datenstand in der Form von 5e.tools — genug, um jede Stufe zu berühren. */
function datenstand(): Datenstand {
  const arten = new Map<string, Knoten[]>();
  const add = (art: string, ...e: Knoten[]) => arten.set(art, [...(arten.get(art) ?? []), ...e]);
  add('condition',
    { name: 'Blinded', source: 'PHB', page: 290, srd: true, entries: [{ type: 'list', items: ["A blinded creature can't see."] }] },
    {
      name: 'Exhaustion', source: 'PHB', page: 291, srd: true,
      entries: ['Measured in levels.', { type: 'table', colLabels: ['Level', 'Effect'], rows: [['1', 'Disadvantage on ability checks'], ['2', 'Speed halved']] }],
    },
    { name: 'Blinded', source: 'XPHB', entries: ['2024.'] },
  );
  add('skill', { name: 'Stealth', source: 'PHB', ability: 'dex', entries: ['Hide.'] });
  add('language', { name: 'Common', source: 'PHB', type: 'standard', entries: ['Common.'] }, { name: 'Goblin', source: 'PHB', type: 'standard', script: 'Dwarvish', entries: [] });
  add('action', { name: 'Disengage', source: 'PHB', time: [{ number: 1, unit: 'action' }], entries: ['Move away.'] });
  add('itemProperty', { abbreviation: 'L', source: 'PHB', entries: [{ type: 'entries', name: 'Light', entries: ['Small and easy.'] }] });
  add('baseitem', { name: 'Scimitar', source: 'PHB', type: 'M', weaponCategory: 'martial', dmg1: '1d6', dmgType: 'S', property: ['F', 'L'], weapon: true, value: 2500, weight: 3 });
  add('spell', {
    name: 'Fireball', source: 'PHB', page: 241, srd: true, level: 3, school: 'V', time: [{ number: 1, unit: 'action' }],
    range: { type: 'point', distance: { type: 'feet', amount: 150 } }, components: { v: true, s: true, m: 'bat guano' },
    duration: [{ type: 'instant' }], savingThrow: ['dexterity'], damageInflict: ['fire'],
    entries: ['Takes {@damage 8d6} fire damage. See {@creature goblin}.'],
    entriesHigherLevel: [{ type: 'entries', name: 'At Higher Levels', entries: ['+{@scaledamage 8d6|3-9|1d6} per level.'] }],
  });
  const goblin: Knoten = {
    name: 'Goblin', source: 'MM', page: 166, srd: true, size: ['S'], type: { type: 'humanoid', tags: ['goblinoid'] },
    alignment: ['N', 'E'], ac: [{ ac: 15, from: ['{@item scimitar|phb}'] }], hp: { average: 7, formula: '2d6' },
    speed: { walk: 30 }, str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8, skill: { stealth: '+6' },
    senses: ['darkvision 60 ft.'], passive: 9, languages: ['Common', 'Goblin'], cr: '1/4',
    trait: [{ name: 'Nimble Escape', entries: ['The goblin can take the {@action Disengage} action as a bonus action.'] }],
    action: [{ name: 'Scimitar', entries: ['{@atk mw} {@hit 4} to hit, reach 5 ft., one target. {@h}5 ({@damage 1d6 + 2}) slashing damage.'] }],
    environment: ['forest'], attachedItems: ['scimitar|phb'], hasToken: true, sizeNote: 'small',
  };
  add('monster',
    goblin,
    { name: 'Goblin Boss', source: 'MM', page: 166, _copy: { name: 'Goblin', source: 'MM', _mod: { '*': { mode: 'replaceTxt', replace: 'the goblin', with: 'the goblin boss', flags: 'i' } } }, cr: '1' },
    { name: 'Wolf', source: 'MM', cr: '1/4', dex: 15, trait: [{ name: 'Pack Tactics', entries: ['The wolf has advantage on an attack roll.'] }] },
    { name: 'Jackal', source: 'MM', cr: '0', dex: 15, trait: [{ name: 'Pack Tactics', entries: ['The jackal has advantage on an attack roll.'] }] },
    { name: 'Mage', source: 'MM', cr: '6', int: 17, spellcasting: [{ name: 'Spellcasting', type: 'spellcasting', ability: 'int', headerEntries: ['The mage is a 9th-level spellcaster.'], spells: { 3: { slots: 3, spells: ['{@spell fireball}'] } } }] },
    { name: 'Goblin Warrior', source: 'XMM', cr: '1/4' },
  );
  const asi = (level: number): Knoten => ({
    name: 'Ability Score Improvement', source: 'PHB', className: 'Fighter', classSource: 'PHB', level,
    entries: [`When you reach ${level}th level, you can increase one ability score.`],
  });
  add('classFeature', asi(4), asi(6), { name: 'Second Wind', source: 'PHB', className: 'Fighter', classSource: 'PHB', level: 1, entries: ['Regain {@dice 1d10} hit points.'] });
  add('subclassFeature', { name: 'Improved Critical', source: 'PHB', className: 'Fighter', classSource: 'PHB', subclassShortName: 'Champion', subclassSource: 'PHB', level: 3, entries: ['Crit on 19.'] });
  add('class', {
    name: 'Fighter', source: 'PHB', hd: { number: 1, faces: 10 }, proficiency: ['str', 'con'],
    startingProficiencies: { armor: ['light', 'shield'], weapons: ['simple', 'martial'], skills: [{ choose: { from: ['stealth'], count: 1 } }] },
    multiclassing: { requirements: { or: [{ str: 13, dex: 13 }] } },
    classFeatures: ['Second Wind|Fighter||1', 'Ability Score Improvement|Fighter||4', 'Ability Score Improvement|Fighter||6'],
    subclassTitle: 'Martial Archetype',
  });
  add('subclass', { name: 'Champion', shortName: 'Champion', source: 'PHB', className: 'Fighter', classSource: 'PHB', subclassFeatures: ['Improved Critical|Fighter||Champion||3'] });
  add('table', { name: 'Trinkets', source: 'PHB', colLabels: ['d6', 'Trinket'], rows: [['1-3', 'A {@item scimitar|phb}'], ['4-6', 'A button']] });
  add('vehicle', { name: 'Galley', source: 'GoS' });
  return {
    arten,
    quellen: new Map([
      ['phb', { id: 'PHB', name: "Player's Handbook", published: '2014-08-19', art: 'book' }],
      ['mm', { id: 'MM', name: 'Monster Manual', published: '2014-09-30', art: 'book' }],
      ['xphb', { id: 'XPHB', name: "Player's Handbook (2024)", published: '2024-09-17', art: 'book' }],
      ['xmm', { id: 'XMM', name: 'Monster Manual (2025)', published: '2025-02-18', art: 'book' }],
    ]),
  };
}

const finde = (es: Entity[], typ: string, name: string) => es.find((e) => e.interfaces[0] === typ && e.name === name)!;
const prosa = (e: Entity) => ((e.components['Prose']?.['paragraph'] as { value: string }[] | undefined) ?? [])[0]?.value ?? '';

describe('Ein Lauf (Abgleich §4.2)', () => {
  const { datei, bericht } = lauf(datenstand());
  const es = datei.entities;

  it('legt alles in eine Systemebene und schreibt das Format der Einfuhr', () => {
    expect(datei.format).toBe('nebelwacht/1');
    expect(datei.registry.interfaces['Spell']).toBeDefined();
    const ebene = finde(es, 'Layer', 'D&D 5e (2014)');
    expect(ebene.components['Layer']).toMatchObject({ kind: 'system' });
    for (const e of es.filter((x) => x !== ebene)) expect(e.relations?.some((r) => r.type === 'inLayer' && r.to === ebene.id)).toBe(true);
  });

  it('lässt 2024 und Vehikel weg und zählt es', () => {
    expect(es.some((e) => e.name === 'Goblin Warrior')).toBe(false);
    expect(es.filter((e) => e.name === 'Blinded')).toHaveLength(1);
    expect(bericht.arten.get('monster')?.ausgeschlossen.get('2024-Kernbuch')?.get('XMM')).toBe(1);
    expect(bericht.arten.get('vehicle')?.notizen.get('weggelassen: später (E4)')).toBe(1);
  });

  it('besteht die Prüfung, auch als Ausschnitt für sich', () => {
    const teil = ausschnitt(es, [{ typ: 'Statblock', namen: ['Goblin'] }]);
    const arten = new Map(teil.map((e) => [e.id, e.interfaces[0]!] as const));
    for (const e of teil) expect(validateEntity(seedRegistry, e, { knownTypes: arten, stageOf: stageBases(teil) })).toEqual([]);
    expect(teil.some((e) => e.name === 'Scimitar' && e.interfaces[0] === 'Weapon')).toBe(true);
  });

  it('zerlegt den Statblock in Merkmal und Aktion mit Angriffsfeldern (§2.5)', () => {
    const goblin = finde(es, 'Statblock', 'Goblin');
    expect(goblin.components['Statblock']).toMatchObject({ size: 'small', ac: 15, hp: 7, cr: '1/4', prof: 2, creatureType: 'humanoid (goblinoid)', alignment: 'neutral evil' });
    expect(goblin.components['Proficiencies']).toMatchObject({ proficient: ['Common', 'Goblin'], expertise: ['Stealth'] });
    const teile = (goblin.relations ?? []).filter((r) => r.type === 'composedOf').map((r) => es.find((e) => e.id === r.to)!);
    expect(teile.map((t) => `${t.interfaces[0]} ${t.name}`)).toEqual(['Feature Nimble Escape', 'Action Scimitar']);
    expect(teile[1]!.components['Action']).toMatchObject({ attack: ['melee weapon'], toHit: 4, reach: 5, damage: '1d6 + 2', damageType: 'slashing' });
    expect(prosa(teile[0]!)).toBe('The {CREATURE} can take the [[action-0001|Disengage]] action as a bonus action.');
    expect(goblin.relations?.some((r) => r.type === 'equips')).toBe(true);
  });

  it('legt gleichlautende Merkmale einmal an, mit dem Namen an der Kante', () => {
    const pack = es.filter((e) => e.name === 'Pack Tactics');
    expect(pack).toHaveLength(1);
    const kanten = es.flatMap((e) => (e.relations ?? []).filter((r) => r.to === pack[0]!.id).map((r) => r.props?.vars?.['CREATURE']));
    expect(kanten.sort()).toEqual(['jackal', 'wolf']);
    /* Der Goblin Boss ist eine Kopie des Goblins: „the goblin boss" wird
       ebenso `{CREATURE}`, also teilen beide Nimble Escape und Scimitar. */
    expect(bericht.geteilt).toMatchObject({ merkmale: 3, verwendungen: 3 });
    expect(es.filter((e) => e.name === 'Nimble Escape')).toHaveLength(1);
  });

  it('löst _copy auf und hält die Herkunft in variantOf', () => {
    const boss = finde(es, 'Statblock', 'Goblin Boss');
    expect(boss.components['Statblock']).toMatchObject({ cr: '1', prof: 2, ac: 15 });
    expect(boss.relations?.find((r) => r.type === 'variantOf')?.to).toBe(finde(es, 'Statblock', 'Goblin').id);
    expect(boss.components['Source']).toMatchObject({ publication: 'MM', page: '166' });
  });

  it('macht Zauberwirken zu Feldern und casts-Kanten', () => {
    const mage = finde(es, 'Statblock', 'Mage');
    expect(mage.components['Statblock']).toMatchObject({ spellAbility: 'int', casterLevel: 9, spellSlots: [0, 0, 3] });
    expect(mage.relations?.find((r) => r.type === 'casts')).toMatchObject({ to: finde(es, 'Spell', 'Fireball').id, props: { mode: 'prepared', level: 3 } });
  });

  it('schreibt den Zauber mit Feldern, Würfeln und Verweisen', () => {
    const fb = finde(es, 'Spell', 'Fireball');
    expect(fb.components['Spell']).toMatchObject({ level: 3, school: 'evocation', castingTime: 1, rangeKind: 'point', range: 150, components: ['v', 's', 'm'], duration: 'instant', save: ['dex'], damageTypes: ['fire'], higherLevels: '+{{1d6}} per level.' });
    expect(prosa(fb)).toBe(`Takes {{8d6}} fire damage. See [[${(finde(es, 'Statblock', 'Goblin').components['Identity'] as { id: string }).id}|goblin]].`);
  });

  it('macht aus Erschöpfung einen Grundzustand mit Stufen (§2.3)', () => {
    const grund = finde(es, 'Condition', 'Exhaustion');
    const stufe2 = finde(es, 'Condition', 'Exhaustion 2');
    expect(stufe2.components['Condition']).toMatchObject({ stage: 2, recovery: 'longRestStep' });
    expect(stufe2.relations?.find((r) => r.type === 'stageOf')?.to).toBe(grund.id);
  });

  it('vereint dasselbe Klassenmerkmal auf mehreren Stufen zu einem Artikel (D50)', () => {
    const fighter = finde(es, 'Class', 'Fighter');
    const asi = es.filter((e) => e.name === 'Ability Score Improvement');
    expect(asi).toHaveLength(1);
    expect(prosa(asi[0]!)).toBe('When you reach a level that grants this feature, you can increase one ability score.');
    const stufen = (fighter.relations ?? []).filter((r) => r.type === 'grants' && r.to === asi[0]!.id).map((r) => r.props?.['level']);
    expect(stufen).toEqual([4, 6]);
    expect(fighter.components['Class']).toMatchObject({ hitDie: 10, multiclassRequirement: 'STR 13 or DEX 13', subclassTitle: 'Martial Archetype' });
    expect(fighter.components['ProficiencyChoice']).toMatchObject({ chooseFrom: ['Stealth'], chooseCount: 1 });
    const champion = finde(es, 'Subclass', 'Champion');
    expect(champion.relations?.find((r) => r.type === 'subclassOf')?.to).toBe(fighter.id);
  });

  it('gibt einer Würfeltabelle Spalten, Gewichte und den Würfel', () => {
    const t = finde(es, 'Table', 'Trinkets');
    expect(t.components['Table']).toMatchObject({ die: '1d6', columns: ['d6', 'Trinket'] });
    expect((t.components['Table']!['rows'] as { weight: number }[]).map((r) => r.weight)).toEqual([3, 3]);
  });

  it('schreibt einen Bericht mit Zahlen und Auslassungen', () => {
    const md = berichtMarkdown(bericht, { artikel: es.length });
    expect(md).toContain('| `monster` | 6 |');
    expect(md).toContain('XMM 1');
    expect(md).toContain('**monster:** `sizeNote` 2');
    expect(md).not.toContain('| `race` |');
  });
});

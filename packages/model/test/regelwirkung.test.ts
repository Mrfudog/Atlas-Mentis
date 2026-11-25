import { describe, expect, it } from 'vitest';
import { derivedValue, proficiencyBonus } from '../src/calc.js';
import { participantStats, tickEntries } from '../src/initiative.js';
import { characterStats, creatureStats } from '../src/stats.js';
import { COMMON_ACTION_CATALOGUE, commonAction, rollMode, turnTypeOf } from '../src/actions.js';
import { concentrationCheck, damageAfterDefenses } from '../src/damage.js';
import { RULE_ACTIONS } from '../src/sheet.js';
import { COMMON_ACTIONS, costOf } from '../src/zugplan.js';
import type { Entity, PropertySchema } from '../src/types.js';
import { fieldGroups } from '../../registry/src/fieldgroups.js';

const { Abilities, CharacterInfo } = fieldGroups;

/*
 * **Regeln wirken am Tisch** (T-275, Teil 1): je Punkt eine Figur, wie sie
 * am Tisch steht, und die Zahl, die sich ändern muss — nicht die Rechnung
 * für sich, sondern was der Bogen, die Initiative und der Zugplan lesen.
 */

const map = (...es: Entity[]) => new Map(es.map((e) => [e.id, e]));

const sb = (id: string, to: string, cards: Record<string, Record<string, unknown>>, relations: Entity['relations'] = []): Entity => ({
  id,
  interfaces: ['Statblock'],
  components: { Identity: { name: `${id}` }, ...cards },
  relations: [{ id: `${id}-b`, type: 'belongsTo', to }, ...(relations ?? [])],
});

const item = (id: string, cards: Record<string, Record<string, unknown>>): Entity => ({
  id,
  interfaces: ['Item'],
  components: { Identity: { name: id }, Item: {}, ...cards },
});

/** Eine Figur mit Inventar: je Stück der Zustand an der Kante. */
function figur(stuecke: [string, Record<string, unknown>][], extra: Partial<Entity> = {}): Entity[] {
  const inv: Entity = {
    id: 'inv',
    interfaces: ['Inventory'],
    components: { Identity: { name: 'Pack' } },
    relations: stuecke.map(([to, props], i) => ({ id: `h${i}`, type: 'holds', to, props })),
  };
  const pc: Entity = {
    id: 'pc',
    interfaces: ['PlayerCharacter'],
    components: { Identity: { name: 'Basil' }, ...(extra.components ?? {}) },
    relations: [{ id: 'c', type: 'carries', to: 'inv' }, ...(extra.relations ?? [])],
  };
  return [pc, inv];
}

const kettenhemd = item('chain', { Armor: { ac: 16, armorType: 'heavy' } });
const leder = item('leather', { Armor: { ac: 11, armorType: 'light' } });
const schild = item('shield', { Armor: { ac: 2, armorType: 'shield' } });
const schutzring = item('ring', { Item: { attunement: true, bonusAc: 1 } });
const feuerring = item('fire', { Effects: { effects: [{ id: 'resist-fire', target: 'resist', op: 'grant', value: 'fire' }] } });
const stiefel = item('boots', { Effects: { effects: [{ id: 'speed', target: 'speed.walk', op: 'add', value: 10 }] } });
const gepackt: Entity = {
  id: 'grappled',
  interfaces: ['Condition'],
  components: { Identity: { name: 'Grappled' }, Effects: { effects: [{ id: 'speed', target: 'speed.*', op: 'limit', value: 0 }] } },
};

describe('Punkt 1: Wirkungen wirken', () => {
  const werte = { Abilities: { str: 14, dex: 16, con: 12, int: 10, wis: 12, cha: 8 }, Statblock: { ac: 12, speed: '30 ft., climb 30 ft.' } };

  it('die RK rechnet aus Rüstung, Schild und eingestimmtem Ring — mit Quelle', () => {
    const [pc, inv] = figur([
      ['chain', { tier: 'worn' }],
      ['shield', { tier: 'held', slot: 'offHand' }],
      ['ring', { tier: 'worn', attuned: true }],
    ]);
    const s = sb('sb', 'pc', werte);
    const st = characterStats(pc!, s, map(pc!, inv!, s, kettenhemd, schild, schutzring));
    expect(st.ac.value).toBe(19);
    expect(st.ac.parts.map((p) => p.source ?? p.kind)).toEqual(['chain', 'shield', 'ring']);
    expect(st.ac.note).toMatch(/statblock says 12/);
    expect(st.statblock?.components?.['Statblock']?.['ac']).toBe(19);
  });

  it('leichte Rüstung nimmt die ganze GE, ein abgelegter Ring nichts', () => {
    const [pc, inv] = figur([
      ['leather', { tier: 'worn' }],
      ['ring', { tier: 'pack', attuned: true }],
    ]);
    const s = sb('sb', 'pc', werte);
    expect(characterStats(pc!, s, map(pc!, inv!, s, leder, schutzring)).ac.value).toBe(14);
  });

  it('ohne Rüstung gilt die Zahl am Statblock', () => {
    const [pc, inv] = figur([]);
    const s = sb('sb', 'pc', werte);
    expect(characterStats(pc!, s, map(pc!, inv!, s)).ac.value).toBe(12);
  });

  it('Resistenz aus einem Ring steht im gelesenen Statblock und in der Abwehr', () => {
    const [pc, inv] = figur([['fire', { tier: 'worn' }]]);
    const s = sb('sb', 'pc', { ...werte, Statblock: { ...werte.Statblock, resistances: 'poison' } });
    const st = characterStats(pc!, s, map(pc!, inv!, s, feuerring));
    expect(st.defenses.resist.map((d) => [d.word, d.via])).toEqual([
      ['poison', 'statblock'],
      ['fire', 'effect'],
    ]);
    expect(st.statblock?.components?.['Statblock']?.['resistances']).toBe('poison, fire');
  });

  it('Stiefel heben das Gehtempo, gepackt deckelt jedes auf 0', () => {
    const [pc, inv] = figur([['boots', { tier: 'worn' }]]);
    const s = sb('sb', 'pc', werte);
    expect(characterStats(pc!, s, map(pc!, inv!, s, stiefel)).speed.text).toBe('40 ft., climb 30 ft.');
    const [pc2, inv2] = figur([['boots', { tier: 'worn' }]], { components: { Vitals: { conditions: ['grappled'] } } });
    const st = characterStats(pc2!, s, map(pc2!, inv2!, s, stiefel, gepackt));
    expect(st.speed.value).toBe(0);
    expect(st.speed.text).toBe('0 ft., climb 0 ft.');
    expect(st.speed.parts.some((p) => p.source === 'grappled' && p.kind === 'limit')).toBe(true);
  });

  it('ein gewährtes Merkmal senkt die Schwelle des kritischen Treffers', () => {
    const merkmal: Entity = {
      id: 'improved-critical',
      interfaces: ['Feature'],
      components: { Identity: { name: 'Improved Critical' }, Effects: { effects: [{ id: 'crit', target: 'critThreshold', op: 'set', value: 19 }] } },
    };
    const klasse: Entity = {
      id: 'fighter',
      interfaces: ['Class'],
      components: { Identity: { name: 'Fighter' } },
      relations: [{ id: 'g', type: 'grants', to: 'improved-critical', props: { level: 3 } }],
    };
    const [pc, inv] = figur([], { relations: [{ id: 'k', type: 'hasClass', to: 'fighter', props: { level: 3 } }] });
    const s = sb('sb', 'pc', werte);
    const st = characterStats(pc!, s, map(pc!, inv!, s, klasse, merkmal));
    expect(st.critThreshold.value).toBe(19);
    expect(st.critThreshold.text).toBe('19–20');
    const [pc2, inv2] = figur([], { relations: [{ id: 'k', type: 'hasClass', to: 'fighter', props: { level: 2 } }] });
    expect(characterStats(pc2!, s, map(pc2!, inv2!, s, klasse, merkmal)).critThreshold.value).toBe(20);
  });

  it('ein Statblock zählt, was er über equips führt, zu seiner Buch-RK', () => {
    const goblin: Entity = { id: 'gob', interfaces: ['Creature'], components: { Identity: { name: 'Goblin' } } };
    const plus1 = item('shield1', { Armor: { ac: 2, armorType: 'shield' }, Item: { bonusAc: 1 } });
    const s = sb('sbg', 'gob', { Abilities: { dex: 14 }, Statblock: { ac: 15 } }, [{ id: 'e', type: 'equips', to: 'shield1' }]);
    expect(creatureStats(goblin, map(goblin, s, plus1)).ac.value).toBe(16);
  });

  it('die Initiative liest dieselbe RK, mit Zuständen aus ihren Einträgen', () => {
    const fluch: Entity = {
      id: 'cursed',
      interfaces: ['Condition'],
      components: { Identity: { name: 'Cursed' }, Effects: { effects: [{ id: 'ac', target: 'ac', op: 'add', value: -2 }] } },
    };
    const [pc, inv] = figur([['chain', { tier: 'worn' }]]);
    const s = sb('sb', 'pc', werte);
    const alle = map(pc!, inv!, s, kettenhemd, fluch);
    expect(participantStats(alle, { id: 'p', type: 'participates', to: 'pc', props: {} }).ac).toBe(16);
    expect(participantStats(alle, { id: 'p', type: 'participates', to: 'pc', props: { conditions: [{ rule: 'cursed', rounds: 1 }] } }).ac).toBe(14);
  });

  it('ein Stück im Inventar ist eine Instanz und wirkt mit den Wirkungen seiner Vorlage', () => {
    const stueck: Entity = { id: 'boots-1', interfaces: ['Item'], components: { Identity: { name: 'Boots' } }, relations: [{ id: 'i', type: 'instanceOf', to: 'boots' }] };
    const [pc, inv] = figur([['boots-1', { tier: 'worn' }]]);
    const s = sb('sb', 'pc', werte);
    expect(creatureStats(pc!, map(pc!, inv!, s, stiefel, stueck)).speed.value).toBe(40);
  });
});

describe('Punkt 4: ein Übungsbonus', () => {
  it('Register und Modell rechnen dieselbe Regel', () => {
    const prop = (CharacterInfo.schema.properties as Record<string, PropertySchema>)['proficiency']!;
    for (const stufe of [1, 4, 5, 9, 13, 17, 20]) {
      const rel = [{ id: 'k', type: 'hasClass', to: 'x', props: { level: stufe } }];
      expect(derivedValue(prop, {}, {}, rel)).toBe(proficiencyBonus(stufe));
    }
    expect(derivedValue(prop, {}, {}, [])).toBeUndefined();
  });
});

describe('Punkt 5: passive Wahrnehmung mit Übung und Expertise', () => {
  const prop = (Abilities.schema.properties as Record<string, PropertySchema>)['passivePerception']!;
  const lies = (pr: Record<string, unknown>) => {
    const ab = { wis: 14 };
    return derivedValue(prop, ab, { Abilities: ab, Statblock: { prof: 3 }, Proficiencies: pr });
  };
  it('ohne Übung 10 + WIS, mit Übung + Bonus, mit Expertise doppelt', () => {
    expect(lies({})).toBe(12);
    expect(lies({ proficient: ['Perception'] })).toBe(15);
    expect(lies({ proficient: ['Perception'], expertise: ['Perception'] })).toBe(18);
  });
  it('am Bogen dieselbe Zahl: der gelesene Statblock trägt Übung aus allen Quellen', () => {
    const [pc, inv] = figur([], { relations: [{ id: 'k', type: 'hasClass', to: 'rogue', props: { level: 5 } }] });
    const klasse: Entity = { id: 'rogue', interfaces: ['Class'], components: { Identity: { name: 'Rogue' } } };
    const s = sb('sb', 'pc', { Abilities: { wis: 14 }, Statblock: {}, Proficiencies: { expertise: ['Perception'] } });
    const g = characterStats(pc!, s, map(pc!, inv!, s, klasse)).statblock!;
    expect(derivedValue(prop, g.components!['Abilities'], g.components)).toBe(18);
  });
});

describe('Punkt 2: Schaden nach der Abwehr', () => {
  const abwehr = (resist: string[] = [], immune: string[] = [], vulnerable: string[] = []) => ({
    resist: resist.map((word) => ({ word, via: 'statblock' })),
    immune: immune.map((word) => ({ word, via: 'statblock' })),
    vulnerable: vulnerable.map((word) => ({ word, via: 'statblock' })),
    conditionImmune: [],
  });
  it('immun 0, resistent halb (abgerundet), verwundbar doppelt, beides hebt sich auf', () => {
    expect(damageAfterDefenses(9, 'fire', abwehr([], ['fire']))).toMatchObject({ amount: 0, why: 'immune' });
    expect(damageAfterDefenses(9, 'fire', abwehr(['fire']))).toMatchObject({ amount: 4, why: 'resistant' });
    expect(damageAfterDefenses(9, 'fire', abwehr([], [], ['fire']))).toMatchObject({ amount: 18, why: 'vulnerable' });
    expect(damageAfterDefenses(9, 'fire', abwehr(['fire'], [], ['fire']))).toEqual({ amount: 9, rolled: 9 });
    expect(damageAfterDefenses(9, 'cold', abwehr(['fire']))).toEqual({ amount: 9, rolled: 9 });
  });
  it('ein Satz vom Statblock greift mit seinem Wort', () => {
    const d = damageAfterDefenses(10, 'Slashing', abwehr(['bludgeoning, piercing, and slashing from nonmagical attacks']));
    expect(d).toMatchObject({ amount: 5, why: 'resistant', word: 'bludgeoning, piercing, and slashing from nonmagical attacks' });
  });
  it('die Konzentrationsprobe: SG aus dem Schaden, Bonus aus KON, Übung und Wirkungen', () => {
    const [pc, inv] = figur([['fire', { tier: 'worn' }]]);
    const s = sb('sb', 'pc', { Abilities: { con: 14 }, Statblock: { prof: 3 }, Proficiencies: { saves: ['con'] } });
    const st = characterStats(pc!, s, map(pc!, inv!, s, feuerring));
    expect(concentrationCheck(st, 25)).toEqual({ dc: 12, bonus: 5 });
    expect(concentrationCheck(st, 4)).toEqual({ dc: 10, bonus: 5 });
  });
});

describe('Punkt 3: ein Aktionskatalog', () => {
  it('Bogen und Zugplan lesen dieselbe Liste und denselben Kostenleser', () => {
    expect(RULE_ACTIONS.map((a) => a.id.replace('rule:', ''))).toEqual(COMMON_ACTION_CATALOGUE.map((a) => a.key));
    for (const t of COMMON_ACTIONS) expect(commonAction(t.id)?.planned).toBe(true);
    expect(COMMON_ACTIONS.map((t) => t.id)).toEqual(expect.arrayContaining(['std:dash', 'std:dodge', 'std:help', 'std:hide', 'std:ready']));
    for (const n of ['Action', 'Bonus Action', 'Reaction', 'Free Action', 'Legendary Action', 'Object Interaction']) {
      const t = turnTypeOf(n);
      expect(costOf(n)).toBe(t === 'bonus' || t === 'reaction' || t === 'free' ? t : 'action');
    }
    expect(costOf('Object Interaction')).toBe('free');
    expect(turnTypeOf('1 minute')).toBeNull();
  });
  it('Dodge wirkt als Nachteil gegen, Help als Vorteil für — über die Einträge der Initiative', () => {
    const [pc, inv] = figur([]);
    const s = sb('sb', 'pc', { Abilities: { dex: 12 } });
    const alle = map(pc!, inv!, s);
    expect(creatureStats(pc!, alle, { actions: ['dodge'] }).totals.grants['attacked']).toEqual(['disadvantage']);
    expect(creatureStats(pc!, alle, { actions: ['help'] }).totals.grants['attack']).toEqual(['advantage']);
    expect(creatureStats(pc!, alle, { actions: ['dash'] }).totals.grants).toEqual({});
    expect(rollMode(true, true)).toBeUndefined();
    expect(rollMode(true, false)).toBe('adv');
  });
});

describe('Punkt 7 (T-350): Dodge, Help und Ready laufen mit tickEntries ab', () => {
  /* Der Eintrag, wie der Server ihn anlegt (`aktionWirkt`): auf sich selbst
     ohne Anker, auf ein anderes Ziel mit dem Anker des Handelnden. */
  const eintrag = (key: string, anker?: string) => {
    const r = commonAction(key)!.rule!;
    return { text: r.label, action: key, rounds: r.rounds, at: r.at, ...(anker ? { anchor: anker } : {}), source: 'Rook' };
  };
  const kanten = (rook: object[], gob: object[]) => [
    { id: 'p_rook', type: 'participates', to: 'pc_rook', props: { conditions: rook } },
    { id: 'p_gob', type: 'participates', to: 'cr_gob', props: { conditions: gob } },
  ];
  const von = (rels: ReturnType<typeof tickEntries>, id: string) => ((rels.find((r) => r.id === id)!.props ?? {}) as { conditions: unknown[] }).conditions;

  it('Dodge und Ready enden zu Beginn des nächsten eigenen Zuges, nicht vorher', () => {
    const rels = kanten([eintrag('dodge'), eintrag('ready')], []);
    expect(von(tickEntries(rels, 'p_gob', 'start'), 'p_rook')).toHaveLength(2);
    expect(von(tickEntries(rels, 'p_rook', 'end'), 'p_rook')).toHaveLength(2);
    expect(von(tickEntries(rels, 'p_rook', 'start'), 'p_rook')).toEqual([]);
  });

  it('Help am Ziel endet zu Beginn des Zuges des Helfenden', () => {
    const rels = kanten([], [eintrag('help', 'p_rook')]);
    expect(von(tickEntries(rels, 'p_gob', 'start'), 'p_gob')).toHaveLength(1);
    expect(von(tickEntries(rels, 'p_rook', 'start'), 'p_gob')).toEqual([]);
  });
});

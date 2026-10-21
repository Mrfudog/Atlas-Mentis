import { describe, expect, it } from 'vitest';
import { derivedValue, proficiencyBonus } from '../src/calc.js';
import { participantStats } from '../src/initiative.js';
import { characterStats, creatureStats } from '../src/stats.js';
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

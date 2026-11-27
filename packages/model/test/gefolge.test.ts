/**
 * **MCDM-Formate** (T-497): Gefolge und Begleiter, deren Werte mit Stufe
 * oder dem Übungsbonus des Anführers wachsen, Stufenaktionen, Villain
 * Actions, Minions mit Overkill und ein eigener Übungsbonus für
 * Rettungswürfe. Erfundene Artikel, kein Buchtext.
 */
import { describe, expect, it } from 'vitest';
import { attackAbility } from '../src/attack.js';
import { bookSections, statblockBook } from '../src/book.js';
import { damageAtTable, damageLines, minionDamage } from '../src/damage.js';
import { followerContextOf, followerNumbers, followsEdge, profForLevel, unlockedAt } from '../src/follower.js';
import { minionGroup, startEncounter } from '../src/initiative.js';
import { RULE_OPTIONS, withRuleVariant } from '../src/ruleOptions.js';
import { creatureStats } from '../src/stats.js';
import { initiativeRulesOf, trackerDamage } from '../src/tracker.js';
import type { Entity, Registry } from '../src/types.js';
import { seedRegistry } from '../../registry/src/index.js';

const imperial: Registry = { ...seedRegistry, settings: { ...seedRegistry.settings, units: 'imperial' } };

describe('profForLevel', () => {
  it('folgt der Tabelle der Grundregeln', () => {
    expect([1, 4, 5, 8, 9, 13, 17, 20].map(profForLevel)).toEqual([2, 2, 3, 3, 4, 5, 6, 6]);
  });
  it('gibt null ohne Stufe oder bei Unsinn, klemmt über 20', () => {
    expect(profForLevel(null)).toBeNull();
    expect(profForLevel(undefined)).toBeNull();
    expect(profForLevel(0)).toBeNull();
    expect(profForLevel(Number.NaN)).toBeNull();
    expect(profForLevel(30)).toBe(6);
  });
});

describe('followerNumbers', () => {
  const reittier = { ac: 12, hp: 5, hpPerLevel: 5, pbFrom: 'leader', addPb: ['ac', 'damage', 'dc'], tempHpPerLevel: 2 };

  it('ohne Anführer und Stufe: die Formel des Buchs', () => {
    const n = followerNumbers(reittier);
    expect(n.prof).toBeNull();
    expect(n.profFrom).toBe('leader');
    expect(n.ac).toEqual({ value: null, text: '12 + PB' });
    expect(n.hp).toEqual({ value: null, text: '5 + 5 per level' });
    expect(n.tempHp).toEqual({ value: null, text: '2 per level' });
    expect(n.damageAdd).toBeNull();
    expect(n.dcAdd).toBeNull();
  });

  it('mit Anführer und Stufe: die Zahlen', () => {
    const n = followerNumbers(reittier, { level: 3, leaderProf: 3 });
    expect(n.prof).toBe(3);
    expect(n.ac).toEqual({ value: 15, text: '15' });
    expect(n.hp).toEqual({ value: 20, text: '20' });
    expect(n.tempHp).toEqual({ value: 6, text: '6' });
    expect(n.damageAdd).toBe(3);
    expect(n.dcAdd).toBe(3);
    expect(n.saveProf).toBe(3);
  });

  it('ein Gefolgsmann rechnet aus seiner eigenen Stufe', () => {
    const n = followerNumbers({ pbFrom: 'level', hp: 0, hpPerLevel: 4, addPb: ['hp'] }, { level: 5, leaderProf: 6 });
    expect(n.prof).toBe(3);
    expect(n.hp).toEqual({ value: 23, text: '23' });
  });

  it('ohne pbFrom gilt der Übungsbonus des Statblocks; saveProf weicht ab', () => {
    const n = followerNumbers({ prof: 2, saveProf: 4, ac: 13, hp: 9 });
    expect(n.prof).toBe(2);
    expect(n.saveProf).toBe(4);
    expect(n.ac).toEqual({ value: 13, text: '13' });
    expect(n.damageAdd).toBe(0);
  });

  it('ohne AC und HP stehen keine', () => {
    const n = followerNumbers({});
    expect(n.ac).toBeNull();
    expect(n.hp).toBeNull();
    expect(n.tempHp).toBeNull();
  });

  it('HP + PB ohne bekannten Übungsbonus bleibt Formel', () => {
    expect(followerNumbers({ hp: 10, addPb: ['hp'], pbFrom: 'leader' }).hp).toEqual({ value: null, text: '10 + PB' });
  });
});

describe('unlockedAt', () => {
  it('ohne Stufe am Eintrag oder ohne bekannte Stufe gilt die Aktion', () => {
    expect(unlockedAt(undefined, 1)).toBe(true);
    expect(unlockedAt(3, null)).toBe(true);
  });
  it('vergleicht Stufe und Freischaltung', () => {
    expect(unlockedAt(3, 2)).toBe(false);
    expect(unlockedAt(3, 3)).toBe(true);
    expect(unlockedAt('5', 7)).toBe(true);
  });
});

describe('followerContextOf', () => {
  const anfuehrer: Entity = { id: 'pc', interfaces: ['PlayerCharacter'], name: 'Rook', components: {}, relations: [] };
  const knappe: Entity = {
    id: 'cr-knappe', interfaces: ['Creature'], name: 'Squire', components: {},
    relations: [{ id: 'f1', type: 'follows', to: 'pc', props: { as: 'retainer', level: 4 } }],
  };
  const alle = new Map([anfuehrer, knappe].map((e) => [e.id, e]));

  it('liest Stufe, Sorte und den Übungsbonus des Anführers', () => {
    expect(followsEdge(knappe)?.id).toBe('f1');
    expect(followerContextOf(knappe, alle, () => 3, (e) => e.name ?? '')).toEqual({
      level: 4, leaderProf: 3, as: 'retainer', leader: 'pc', leaderName: 'Rook',
    });
  });

  it('ohne Kante null; ein fehlender Anführer hat keinen Übungsbonus', () => {
    expect(followerContextOf(anfuehrer, alle, () => 3)).toBeNull();
    expect(followerContextOf(knappe, new Map(), () => 3)).toEqual({ level: 4, leaderProf: null, as: 'retainer', leader: 'pc' });
  });
});

describe('attackAbility primary', () => {
  it('nimmt das Primärattribut des Statblocks, sonst nichts', () => {
    expect(attackAbility('primary', ['melee weapon'], { primaryAbility: 'dex' })).toBe('dex');
    expect(attackAbility('primary', ['melee weapon'], {})).toBeNull();
    expect(attackAbility('primary', ['melee weapon'], { primaryAbility: 'luck' })).toBeNull();
  });
});

/* Ein Gefolgsmann mit Signaturangriff und zwei Stufenaktionen, ein Schurke mit drei Villain Actions. */
const teile: Record<string, Entity> = {
  stich: {
    id: 'stich', interfaces: ['Action'], name: 'Signature Strike',
    components: { Action: { actionType: 'at-action', attack: ['melee weapon'], ability: 'primary', damageDice: '1d8', reach: 5 } },
  },
  ruf: { id: 'ruf', interfaces: ['Action'], name: 'Rally', components: { Action: { actionType: 'at-action', saveDc: 10, saveAbility: 'wis' } } },
  sturm: { id: 'sturm', interfaces: ['Action'], name: 'Storm', components: { Action: { actionType: 'at-action' } } },
  v1: { id: 'v1', interfaces: ['Action'], name: 'Opening', components: { Action: { actionType: 'at-villain', round: 1 } } },
  v2: { id: 'v2', interfaces: ['Action'], name: 'Turn', components: { Action: { actionType: 'at-villain', round: 2 } } },
  v3: { id: 'v3', interfaces: ['Action'], name: 'Finale', components: { Action: { actionType: 'at-villain', round: 3 } } },
};
const namen: Record<string, string> = { 'at-action': 'Action', 'at-villain': 'Villain Action' };
const ctx = { part: (id: string) => teile[id], nameOf: (id: string) => namen[id] ?? teile[id]?.name };

const knappenBogen: Entity = {
  id: 'sb-knappe', interfaces: ['Statblock'], name: 'Squire',
  components: {
    Statblock: { ac: 13, hp: 0, hpPerLevel: 6, pbFrom: 'level', addPb: ['dc'], primaryAbility: 'dex', saveProf: 1 },
    Abilities: { str: 10, dex: 16, con: 12, int: 10, wis: 10, cha: 10 },
    Proficiencies: { saves: ['dex'] },
  },
  relations: [
    { id: 'k-sturm', type: 'composedOf', to: 'sturm', props: { level: 7 } },
    { id: 'k-ruf', type: 'composedOf', to: 'ruf', props: { level: 3 } },
    { id: 'k-stich', type: 'composedOf', to: 'stich' },
  ],
};

describe('bookSections: Stufenaktionen (T-497)', () => {
  it('ordnet nach Stufe, nennt sie und sperrt, was die Stufe noch nicht hat', () => {
    const [aktionen] = bookSections(imperial, knappenBogen, { ...ctx, follower: { level: 5, leaderProf: null } });
    expect(aktionen!.entries.map((e) => [e.name, e.locked ?? false])).toEqual([
      ['Signature Strike', false],
      ['Rally (level 3)', false],
      ['Storm (level 7)', true],
    ]);
  });

  it('rechnet den Signaturangriff mit Primärattribut und dem Übungsbonus der Stufe', () => {
    const [aktionen] = bookSections(imperial, knappenBogen, { ...ctx, follower: { level: 5, leaderProf: null } });
    /* DEX 16 → +3, Stufe 5 → +3: Treffer +6, Schaden 1d8 + 3. */
    expect(aktionen!.entries[0]!.text).toContain('{{+6}}');
    expect(aktionen!.entries[0]!.text).toContain('1d8 + 3');
  });

  it('legt „+ PB" auf den SG, ohne Stufe als Formel', () => {
    const mit = bookSections(imperial, knappenBogen, { ...ctx, follower: { level: 5, leaderProf: null } });
    expect(mit[0]!.entries[1]!.text).toBe('DC 13 Wisdom saving throw.');
    const ohne = bookSections(imperial, knappenBogen, ctx);
    expect(ohne[0]!.entries[1]!.text).toBe('DC 10 + PB Wisdom saving throw.');
    expect(ohne[0]!.entries.every((e) => !e.locked)).toBe(true);
  });
});

describe('bookSections: Villain Actions (T-497)', () => {
  it('steht in einem Abschnitt der Aktionsart, nach Runde geordnet', () => {
    const schurke: Entity = {
      id: 'sb-schurke', interfaces: ['Statblock'], name: 'Villain', components: { Statblock: { prof: 3 } },
      relations: [
        { id: 'a', type: 'composedOf', to: 'v3' },
        { id: 'b', type: 'composedOf', to: 'v1' },
        { id: 'c', type: 'composedOf', to: 'v2' },
      ],
    };
    const [s] = bookSections(imperial, schurke, ctx);
    expect(s!.title).toBe('Villain Actions');
    expect(s!.entries.map((e) => [e.name, e.round])).toEqual([
      ['Round 1: Opening', 1],
      ['Round 2: Turn', 2],
      ['Round 3: Finale', 3],
    ]);
  });
});

describe('statblockBook: Gefolge, Minion, eigener Rettungswurfbonus (T-497)', () => {
  it('zeigt Stufe, HP nach Stufe und den Rettungswurf mit saveProf', () => {
    const b = statblockBook(imperial, knappenBogen, { follower: { level: 5, leaderProf: null } });
    expect(b.top.find((l) => l.label === 'Hit Points')?.text).toBe('30');
    expect(b.top.find((l) => l.label === 'Armor Class')?.text).toBe('13');
    /* DEX +3, saveProf 1 statt Übungsbonus 3. */
    expect(b.details.find((l) => l.label === 'Saving Throws')?.text).toBe('Dex +4');
    expect(b.details.find((l) => l.label === 'Level')?.text).toBe('5');
    expect(b.details.find((l) => l.label === 'Proficiency Bonus')?.text).toBe('+3');
    expect(b.extra.some((l) => /per level|Minion|Proficiency bonus from/.test(l.label))).toBe(false);
  });

  it('ohne Stufe: Formel und Herkunft des Übungsbonus', () => {
    const b = statblockBook(imperial, knappenBogen);
    expect(b.top.find((l) => l.label === 'Hit Points')?.text).toBe('0 + 6 per level');
    expect(b.details.find((l) => l.label === 'Proficiency Bonus')?.text).toBe('by its level');
  });

  it('nennt einen Minion in der Kopfzeile', () => {
    const m: Entity = { id: 'm', interfaces: ['Statblock'], name: 'Grunt', components: { Statblock: { size: 'medium', creatureType: 'humanoid', minion: true } }, relations: [] };
    expect(statblockBook(imperial, m).byline).toBe('Medium humanoid (minion)');
  });
});

describe('Minions im Kampf (T-497)', () => {
  it('minionDamage: jeder Schaden setzt auf 0, der Rest ist Overkill', () => {
    expect(minionDamage(5, 12, true)).toEqual({ hp: 0, overkill: 7 });
    expect(minionDamage(5, 12, false)).toEqual({ hp: 0, overkill: null });
    expect(minionDamage(5, 3, true)).toEqual({ hp: 0, overkill: null });
    expect(minionDamage(5, 0, true)).toEqual({ hp: 5, overkill: null });
    expect(minionDamage(null, 4, true)).toEqual({ hp: 0, overkill: null });
  });

  const grunt: Entity = { id: 'grunt', interfaces: ['Creature'], name: 'Grunt', components: { Identity: { name: 'Grunt' } }, relations: [] };
  const vorlage: Entity = { id: 'sb-v', interfaces: ['Statblock'], name: 'Grunt', components: { Statblock: { hp: 6, minion: true }, Abilities: { dex: 14 } }, relations: [] };
  const sb1: Entity = { id: 'sb-1', interfaces: ['Statblock'], name: 'Grunt 1', components: {}, relations: [{ id: 'i1', type: 'instanceOf', to: 'sb-v' }, { id: 'b1', type: 'belongsTo', to: 'grunt' }] };
  const grunt2: Entity = { ...grunt, id: 'grunt2' };
  const sb2: Entity = { id: 'sb-2', interfaces: ['Statblock'], name: 'Grunt 2', components: {}, relations: [{ id: 'i2', type: 'instanceOf', to: 'sb-v' }, { id: 'b2', type: 'belongsTo', to: 'grunt2' }] };
  const alle = new Map([grunt, grunt2, vorlage, sb1, sb2].map((e) => [e.id, e]));

  it('damageAtTable: auf 0, mit zeitweiligen Punkten; Overkill nennt die Zeile', () => {
    const stats = creatureStats(grunt, alle);
    const d = damageAtTable({ stats, vitals: {}, edge: { hp: 6 }, pc: false, rolled: 10, type: '', minion: { overkill: true } });
    expect(d.edgeHp).toBe(0);
    expect(d.overkill).toBe(4);
    expect(d.defense.amount).toBe(10);
    expect(damageLines('Grunt', d)).toEqual(['Grunt at 0/6 HP', 'overkill 4: deal it to another minion within reach']);
    const ohneKante = damageAtTable({ stats, vitals: { hp: 2, hpTemp: 3 }, pc: false, rolled: 1, type: '', minion: { overkill: true } });
    expect(ohneKante.vitals).toEqual({ hp: 0 });
    expect(ohneKante.overkill).toBeNull();
  });

  it('trackerDamage liest den Minion am Statblock und Overkill aus den Optionen', () => {
    const kampf: Entity = { id: 'enc', interfaces: ['Encounter'], name: 'Fight', components: { Encounter: { round: 1 } }, relations: [{ id: 'p', type: 'participates', to: 'grunt', props: { hp: 6 } }] };
    const mit = trackerDamage(alle, kampf, { edge: 'p', amount: 9 }, { overkill: true });
    if ('error' in mit) throw new Error(mit.error);
    expect(mit.damage.overkill).toBe(3);
    expect(mit.encounter.relations![0]!.props).toMatchObject({ hp: 0 });
    const ohne = trackerDamage(alle, kampf, { edge: 'p', amount: 1 });
    if ('error' in ohne) throw new Error(ohne.error);
    expect(ohne.encounter.relations![0]!.props).toMatchObject({ hp: 0 });
    expect(ohne.damage.overkill).toBeNull();
  });

  it('startEncounter: Minions derselben Vorlage würfeln einmal', () => {
    expect(minionGroup(sb1)).toBe('sb-v');
    expect(minionGroup(vorlage)).toBe('sb-v');
    const kampf: Entity = {
      id: 'enc', interfaces: ['Encounter'], name: 'Fight', components: { Encounter: {} },
      relations: [
        { id: 'p1', type: 'participates', to: 'grunt', props: {} },
        { id: 'p2', type: 'participates', to: 'grunt2', props: {} },
      ],
    };
    let n = 0;
    const { encounter, rolled } = startEncounter(alle, kampf, () => ++n * 5);
    expect(n).toBe(1);
    expect(rolled).toEqual([{ edge: 'p1', to: 'grunt', roll: 5, mod: 2, init: 7 }]);
    expect(encounter.relations!.map((r) => (r.props as { init?: number }).init)).toEqual([7, 7]);
  });
});

describe('Regeloption Overkill (T-497)', () => {
  it('steht im Katalog, gilt nur mit Tracker und ist aus, bis man sie setzt', () => {
    const o = RULE_OPTIONS.find((x) => x.key === 'overkill');
    expect(o?.variants?.map((v) => v.key)).toEqual(['off', 'on']);
    expect(o?.when).toEqual({ field: 'combat', is: ['on'] });
    expect(seedRegistry.interfaces['Campaign']?.schema?.properties?.['overkill']?.enum).toEqual(['off', 'on']);
    const kampagne: Entity = { id: 'c', interfaces: ['Campaign'], components: { Campaign: {} }, relations: [] };
    expect(initiativeRulesOf(kampagne).overkill).toBe('off');
    expect(initiativeRulesOf(withRuleVariant(kampagne, 'overkill', 'on')).overkill).toBe('on');
    expect(initiativeRulesOf(null).overkill).toBe('off');
  });
});

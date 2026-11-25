import { describe, expect, it } from 'vitest';
import { characterStats, statPartText, type Entity } from '../src/index.js';

const art = (id: string, typ: string, components: Entity['components'] = {}, relations: Entity['relations'] = []): Entity => ({
  id, interfaces: [typ], name: id, components, relations,
});

/* Der Test-Barbar der Leitung (T-272): Grundwerte am Statblock, die Boni
   aus Herkunft und Hintergrund kamen im Bogen nie an. */
const barbar = art('class-barb', 'Class', { Class: { hitDie: 12 }, Proficiencies: { saves: ['str', 'con'] } });
const aasimar = art('anc-aasimar', 'Ancestry', { Ancestry: { abilityBonus: { con: 1 }, speed: '30', darkvision: 60 } });
const artisan = art('bg-artisan', 'Background', {
  Choices: { choices: [{ id: 'ability-scores', kind: 'ability', count: 2, bonus: [2, 1], from: { values: ['str', 'dex', 'int'] } }] },
});
const handschuhe = art('item-gauntlets', 'Item', { Effects: { effects: [{ id: 'str', target: 'ability.str', op: 'set', value: 19, when: 'worn' }] } });
const ring = art('item-ring', 'Item', { Effects: { effects: [{ id: 'ac', target: 'ac', op: 'add', value: 1, when: 'worn' }] } });
const tasche = (welche: string[]) =>
  art('inv-1', 'Inventory', {}, welche.map((to, i) => ({ id: `h${i}`, type: 'holds', to, props: { tier: 'worn' } })));

const figur = (extra: Entity['relations'] = []) =>
  art('pc-1', 'PlayerCharacter', {}, [
    { id: 'c1', type: 'hasClass', to: 'class-barb', props: { level: 3, hp: [0, 6, 7] } },
    { id: 'a1', type: 'hasAncestry', to: 'anc-aasimar' },
    { id: 'b1', type: 'hasBackground', to: 'bg-artisan' },
    { id: 'w1', type: 'chose', to: 'bg-artisan', props: { choice: 'ability-scores', picks: ['int', 'str'] } },
    ...(extra ?? []),
  ]);
const statblock = art('sb-1', 'Statblock', {
  Statblock: { hp: 34 },
  Abilities: { str: 15, dex: 15, con: 15, int: 8, wis: 8, cha: 8 },
}, [{ id: 'o', type: 'belongsTo', to: 'pc-1' }]);
const bestand = (inv: string[] = []) => new Map([barbar, aasimar, artisan, handschuhe, ring, tasche(inv)].map((e) => [e.id, e]));

describe('characterStats (T-272)', () => {
  it('adds the bonuses of origin and background to the base scores, each with its source', () => {
    const s = characterStats(figur(), statblock, bestand());
    expect(s.abilities.str.value).toBe(16);
    expect(s.abilities.int.value).toBe(10);
    expect(s.abilities.con.value).toBe(16);
    expect(s.abilities.str.parts.map((p) => [p.kind, p.value, p.source, p.via])).toEqual([
      ['base', 15, 'sb-1', 'statblock'],
      ['bonus', 1, 'bg-artisan', 'choice'],
    ]);
    expect(s.abilities.con.text).toBe('16 (+3)');
  });

  it('computes proficiency, hit points from the class levels and CON, initiative, speed and darkvision', () => {
    const s = characterStats(figur(), statblock, bestand());
    expect(s.prof.value).toBe(2);
    expect(s.hp.value).toBe(12 + 6 + 7 + 3 * 3);
    expect(s.hp.note).toBeUndefined();
    expect(s.hp.parts.map(statPartText)).toEqual(['25 (3 × d12)', '+9']);
    expect(s.initiative.value).toBe(2);
    expect(s.ac.parts.map(statPartText)).toEqual(['10', '+2']);
    expect(s.speed.text).toBe('30');
    expect(s.senses.text).toBe('darkvision 60');
  });

  it('lets a worn item raise a score and the AC, and hands out a statblock with the final numbers', () => {
    const s = characterStats(figur([{ id: 'k', type: 'carries', to: 'inv-1' }]), statblock, bestand(['item-gauntlets', 'item-ring']));
    expect(s.abilities.str.value).toBe(19);
    expect(s.ac.value).toBe(13);
    const sb = s.statblock!;
    expect(sb.components?.['Abilities']).toMatchObject({ str: 19, con: 16, int: 10 });
    expect(sb.components?.['Statblock']).toMatchObject({ prof: 2, hp: 34, ac: 13, senses: 'darkvision 60' });
    expect(sb.components?.['Proficiencies']).toMatchObject({ saves: ['str', 'con'] });
    /* Die gespeicherte Karte bleibt, wie sie ist. */
    expect(statblock.components?.['Abilities']).toMatchObject({ str: 15 });
  });

  it('says when the statblock names other hit points than the levels give', () => {
    const s = characterStats(figur(), { ...statblock, components: { ...statblock.components, Statblock: { hp: 30 } } }, bestand());
    expect(s.hp.note).toContain('30');
  });
});

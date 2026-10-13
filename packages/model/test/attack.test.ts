import { describe, expect, it } from 'vitest';
import { attackAbility, attackLine, attackNumbers, averageOf, isAttack } from '../src/attack.js';

/* Ein Wolf: Übung 2, STR 12, DEX 15 — der Biss rechnet im Buch auf DEX. */
const wolf = { prof: 2, str: 12, dex: 15, spellAbility: undefined };
const biss = { attack: ['melee weapon'], ability: 'finesse', damageDice: '2d4', damageType: 'piercing', reach: 5, target: 'one target' };

describe('Ein Angriff wird am Statblock gerechnet (D51)', () => {
  it('rechnet Treffer und Schaden aus Übung und Attribut', () => {
    const n = attackNumbers(biss, wolf)!;
    expect(n).toMatchObject({ ability: 'dex', toHit: 4, toHitFixed: false, damage: '2d4 + 2', average: 7, damageType: 'piercing' });
    expect(attackLine(n)).toBe('*Melee Weapon Attack:* {{+4}} to hit, reach 5 ft., one target. *Hit:* 7 ({{2d4 + 2}}) piercing damage.');
  });

  it('nimmt, was die Kante anders macht, Feld für Feld', () => {
    const n = attackNumbers(biss, wolf, { damageDice: '1d6', reach: 10, extraDamageDice: '2d6', extraDamageType: 'poison', note: 'The target is knocked prone.' })!;
    expect(n).toMatchObject({ damage: '1d6 + 2', average: 5, reach: 10, extra: { dice: '2d6', type: 'poison', average: 7 }, note: 'The target is knocked prone.' });
    expect(attackLine(n)).toContain('plus 7 ({{2d6}}) poison damage.');
  });

  it('zeigt die Buchzahl, wo sie nicht aus der Rechnung folgt, und sagt es', () => {
    const n = attackNumbers(biss, wolf, { toHit: 5, damageFlat: 3 })!;
    expect(n).toMatchObject({ toHit: 5, toHitFixed: true, toHitComputed: 4, damage: '2d4 + 3', damageFixed: true });
  });

  it('rechnet ohne Angabe Nahkampf auf STR, Fernkampf auf DEX, Zauber auf das Zauberattribut', () => {
    expect(attackAbility(undefined, ['melee weapon'], wolf)).toBe('str');
    expect(attackAbility(undefined, ['ranged weapon'], wolf)).toBe('dex');
    expect(attackAbility(undefined, ['melee weapon', 'ranged weapon'], wolf)).toBe('str');
    expect(attackAbility(undefined, ['ranged spell'], { spellAbility: 'int' })).toBe('int');
  });

  it('gibt ohne Übung keinen Trefferbonus statt einer falschen Zahl', () => {
    expect(attackNumbers(biss, { dex: 15 })!.toHit).toBeNull();
  });

  it('ist kein Angriff ohne Sorte', () => {
    expect(isAttack({ damageDice: '1d6' })).toBe(false);
    expect(attackNumbers({ damageDice: '1d6' }, wolf)).toBeNull();
  });

  it('rundet den Durchschnitt ab wie das Buch', () => {
    expect(averageOf('1d6', 2)).toBe(5);
    expect(averageOf('2d10')).toBe(11);
    expect(averageOf('Unsinn')).toBeNull();
  });
});

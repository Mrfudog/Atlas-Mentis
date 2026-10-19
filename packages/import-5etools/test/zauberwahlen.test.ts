/**
 * Zauberwahlen einer Klasse (T-309): aus den Fortschritten je Stufe eine
 * Wahl mit dem Zuwachs, aus der Zauberliste, bis zum erreichbaren Grad.
 * Die Zahlen sind erfunden — nur ihre Form folgt 5e.tools.
 */
import { describe, expect, it } from 'vitest';
import { zauberwahlen } from '../src/arten/charakterbau.js';

describe('zauberwahlen (T-309)', () => {
  it('turns cantrips and a spellbook into choices from the class spell list', () => {
    const w = zauberwahlen(
      {
        casterProgression: 'full',
        spellcastingAbility: 'int',
        cantripProgression: [2, 2, 2, 3],
        spellsKnownProgressionFixed: [4, 1, 1, 1],
        preparedSpellsProgression: [3, 4, 5, 6],
      },
      'class-x',
      ['skills'],
    );
    expect(w.map((c) => [c.id, c.level ?? 1, c.count, c.from?.where?.value])).toEqual([
      ['cantrips', 1, 2, [0]],
      ['cantrips-2', 4, 1, [0]],
      ['spellbook', 1, 4, [1]],
      ['spellbook-2', 2, 1, [1]],
      ['spellbook-3', 3, 1, [1, 2]],
      ['spellbook-4', 4, 1, [1, 2]],
    ]);
    expect(w[0]).toMatchObject({ kind: 'spell', mode: 'known', ability: 'int', from: { interfaces: ['Spell'], listedBy: { type: 'spellList', from: 'class-x' } } });
  });

  it('takes spells known, else prepared spells, and nothing before a half caster casts', () => {
    const bekannt = zauberwahlen({ casterProgression: 'full', spellsKnownProgression: [2, 3] }, 'c');
    expect(bekannt.map((c) => [c.id, c.count, c.mode])).toEqual([['spells', 2, 'known'], ['spells-2', 1, 'known']]);
    const vorbereitet = zauberwahlen({ casterProgression: '1/2', preparedSpellsProgression: [2, 3] }, 'c');
    /* Stufe 1 wirkt ein Halbzauberer noch nichts: die Wahl kommt auf Stufe 2, mit allem bis dahin. */
    expect(vorbereitet.map((c) => [c.id, c.level, c.count, c.mode])).toEqual([['prepared', 2, 3, 'prepared']]);
  });
});

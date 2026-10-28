import { describe, expect, it } from 'vitest';
import type { Effect, Entity } from '@nw/model';
import type { Knoten } from '../src/copy.js';
import type { Datenstand } from '../src/lesen.js';
import { lauf } from '../src/lauf.js';

/* Erfundene Gegenstände in der Form von 5e.tools (T-089, T-124): eine
   Textschablone, eine Gruppe ohne eigenen Text, Boni ohne eigenes Feld.
   Keine Texte aus den Büchern. */
function datenstand(): Datenstand {
  const itemEntry: Knoten[] = [
    { name: 'Ward Band', source: 'DMG', entriesTemplate: ['You resist {{getFullImmRes item.resist}} damage while wearing this {{item.detail1}} band.'] },
  ];
  const item: Knoten[] = [
    { name: 'Ward Band of Frost', source: 'DMG', type: 'RG', resist: ['cold'], detail1: 'blue', entries: ['{#itemEntry Ward Band}', 'It hums.'] },
    { name: 'Ward Band of Ash', source: 'DMG', type: 'RG', resist: ['fire', 'acid'], detail1: 'grey', entries: ['{#itemEntry Ward Band|DMG}'] },
    { name: 'Odd Band', source: 'DMG', type: 'RG', entries: ['{#itemEntry Missing Band}'] },
    { name: 'Lucky Pin', source: 'DMG', type: 'OTH', wondrous: true, bonusAbilityCheck: '+1', bonusProficiencyBonus: '+1', bonusSavingThrowConcentration: '+2', entries: [] },
    { name: 'Archer Cuffs', source: 'DMG', type: 'OTH', wondrous: true, bonusWeaponDamage: '+2', entries: [] },
  ];
  const itemGroup: Knoten[] = [
    { name: 'Ward Band', source: 'DMG', type: 'RG', items: ['Ward Band of Frost', 'Ward Band of Ash'] },
  ];
  const magicvariant: Knoten[] = [
    { name: '+1 Aim Weapon', source: 'DMG', type: 'GV', requires: [{ weapon: true }], inherits: { bonusWeaponAttack: '+1', entries: [] } },
    { name: 'Keen Wood', source: 'DMG', type: 'GV', requires: [{ type: 'SCF' }], inherits: { bonusSpellDamage: '+1', bonusWeaponDamage: '+2', entries: [] } },
    /* Erfundene Varianten mit Namensteil und Aufpreis (T-300). */
    { name: 'Glinting Weapon', source: 'DMG', type: 'GV', requires: [{ weapon: true }], inherits: { namePrefix: 'Glinting ', valueExpression: '[[baseItem.value]] + 5000', entries: [] } },
    { name: 'Heavy Plate Trim', source: 'DMG', type: 'GV', requires: [{ armor: true }], inherits: { nameSuffix: ' with Trim', valueMult: 3, entries: [] } },
  ];
  return {
    arten: new Map([['itemEntry', itemEntry], ['item', item], ['itemGroup', itemGroup], ['magicvariant', magicvariant]]),
    quellen: new Map([['dmg', { id: 'DMG', name: "Dungeon Master's Guide", published: '2014-12-09', art: 'book' }]]),
  };
}

describe('Gegenstände beim Einlesen (T-089)', () => {
  const { datei, bericht } = lauf(datenstand());
  const es = datei.entities;
  const finde = (name: string, typ = 'Item') => es.find((e) => e.name === name && e.interfaces[0] === typ)!;
  const prosa = (e: Entity) => JSON.stringify(e.components['Prose'] ?? {});
  const wirkungen = (e: Entity) => (e.components['Effects']?.['effects'] as Effect[] | undefined) ?? [];

  it('setzt die Textschablone mit den Werten des Gegenstands ein', () => {
    const frost = prosa(finde('Ward Band of Frost'));
    expect(frost).toContain('You resist cold damage while wearing this blue band.');
    expect(frost).toContain('It hums.');
    expect(frost).not.toContain('itemEntry');
    expect(prosa(finde('Ward Band of Ash'))).toContain('You resist fire and acid damage while wearing this grey band.');
  });

  it('lässt eine unbekannte Schablone stehen und sagt es', () => {
    expect(prosa(finde('Odd Band'))).toContain('itemEntry Missing Band');
    expect([...(bericht.arten.get('item')?.notizen.keys() ?? [])]).toContain('Textschablone nicht gefunden');
  });

  it('gibt einer Gruppe ohne Text die Liste ihrer Sorten', () => {
    const gruppe = es.find((e) => e.name === 'Ward Band' && e.interfaces[0] === 'Item' && e.components['Prose'] && prosa(e).includes('kinds'));
    expect(gruppe).toBeDefined();
    const p = prosa(gruppe!);
    const frost = finde('Ward Band of Frost');
    expect(p).toContain((frost.components['Identity'] as { id: string }).id);
  });

  it('liest Boni ohne eigenes Feld als Wirkung', () => {
    expect(wirkungen(finde('+1 Aim Weapon', 'Enhancement'))).toEqual([{ id: 'weapon-attack', target: 'weapon.attack', op: 'add', value: 1, when: 'self' }]);
    expect(wirkungen(finde('Keen Wood', 'Enhancement')).map((w) => [w.target, w.value])).toEqual([
      ['weapon.damage', 2],
      ['spellDamage', 1],
    ]);
    expect(wirkungen(finde('Keen Wood', 'Enhancement'))[0]!.when).toBe('self');
    expect(wirkungen(finde('Lucky Pin')).map((w) => [w.target, w.value])).toEqual([
      ['check', 1],
      ['prof', 1],
      ['save.concentration', 2],
    ]);
    /* An Armschienen gilt der Bonus der Figur, nicht dem Gegenstand. */
    expect(wirkungen(finde('Archer Cuffs'))).toEqual([{ id: 'weapon-damage', target: 'weapon.damage', op: 'add', value: 2 }]);
  });

  it('schreibt Varianten als Enhancement: Namensteile und Aufpreis (T-300, T-324)', () => {
    const v = finde('Glinting Weapon', 'Enhancement');
    expect(v.components['Item']).toBeUndefined();
    const glanz = v.components['ItemFeature'] as Record<string, unknown>;
    expect(glanz['namePrefix']).toBe('Glinting ');
    expect(glanz['priceAdd']).toBe(5000);
    expect(glanz['priceMult']).toBeUndefined();
    expect(glanz['appliesTo']).toEqual(['weapon']);
    const trim = finde('Heavy Plate Trim', 'Enhancement').components['ItemFeature'] as Record<string, unknown>;
    expect(trim['nameSuffix']).toBe(' with Trim');
    expect(trim['priceMult']).toBe(3);
  });
});

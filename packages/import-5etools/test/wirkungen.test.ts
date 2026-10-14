import { describe, expect, it } from 'vitest';
import type { Effect, Entity } from '@nw/model';
import { validateEntity } from '@nw/model';
import { seedRegistry } from '@nw/registry';
import type { Knoten } from '../src/copy.js';
import type { Datenstand } from '../src/lesen.js';
import { lauf } from '../src/lauf.js';

/* Erfundene Gegenstände in der Form von 5e.tools, je eine Art Wirkung
   (E-025 a). Keine Texte aus den Büchern. */
function datenstand(): Datenstand {
  const item: Knoten[] = [
    { name: 'Grip Gloves', source: 'DMG', type: 'OTH', wondrous: true, reqAttune: true, ability: { static: { str: 19 } }, entries: [] },
    { name: 'Wise Stone', source: 'DMG', type: 'OTH', wondrous: true, ability: { wis: 2, choose: [{ from: ['int'] }] }, entries: [] },
    { name: 'Ember Ring', source: 'DMG', type: 'RG', reqAttune: true, resist: ['fire'], conditionImmune: ['frightened'], entries: [] },
    { name: 'Swift Boots', source: 'DMG', type: 'OTH', wondrous: true, modifySpeed: { bonus: { '*': 5 }, equal: { climb: 'walk' }, multiply: { walk: 2 } }, entries: [] },
    { name: 'Sage Rod', source: 'DMG', type: 'RD', bonusSpellSaveDc: '+1', bonusSpellAttack: '+1', critThreshold: 19, entries: [] },
    { name: 'Deep Sack', source: 'DMG', type: 'OTH', wondrous: true, containerCapacity: { weight: [500], weightless: true }, entries: [] },
  ];
  const magicvariant: Knoten[] = [
    { name: 'Armor of Frost', source: 'DMG', type: 'GV', requires: [{ armor: true }], inherits: { reqAttune: true, resist: ['cold'], bonusAc: '+1', entries: [] } },
  ];
  return {
    arten: new Map([['item', item], ['magicvariant', magicvariant]]),
    quellen: new Map([['dmg', { id: 'DMG', name: "Dungeon Master's Guide", published: '2014-12-09', art: 'book' }]]),
  };
}

describe('Wirkungen beim Einlesen (REQ-238, E-025 a)', () => {
  const { datei, bericht } = lauf(datenstand());
  const es = datei.entities;
  const finde = (name: string) => es.find((e) => e.name === name)!;
  const wirkungen = (e: Entity) => (e.components['Effects']?.['effects'] as Effect[] | undefined) ?? [];

  it('besteht die Prüfung', () => {
    const arten = new Map(es.map((e) => [e.id, e.interfaces[0]!] as const));
    for (const e of es.filter((x) => x.components['Effects'])) expect(validateEntity(seedRegistry, e, { knownTypes: arten })).toEqual([]);
  });

  it('setzt ein Attribut oder zählt dazu', () => {
    expect(wirkungen(finde('Grip Gloves'))).toEqual([{ id: 'ability-str', target: 'ability.str', op: 'set', value: 19 }]);
    expect(wirkungen(finde('Wise Stone'))).toEqual([{ id: 'ability-wis', target: 'ability.wis', op: 'add', value: 2 }]);
  });

  it('gewährt Resistenz und Zustandsimmunität', () => {
    expect(wirkungen(finde('Ember Ring'))).toEqual([
      { id: 'resist-fire', target: 'resist', op: 'grant', value: 'fire' },
      { id: 'conditionimmune-frightened', target: 'conditionImmune', op: 'grant', value: 'frightened' },
    ]);
  });

  it('liest Geschwindigkeit, Zauber-SG, kritische Treffer und Fassungsvermögen', () => {
    expect(wirkungen(finde('Swift Boots'))).toEqual([
      { id: 'speed-all', target: 'speed.*', op: 'add', value: 5 },
      { id: 'speed-climb-walk', target: 'speed.climb', op: 'set', value: 'walk' },
    ]);
    expect(finde('Swift Boots').components['Notes']?.['note']).toEqual([{ id: 'speed-multiply-walk', value: 'Speed: multiply walk 2' }]);
    expect(wirkungen(finde('Sage Rod'))).toEqual([
      { id: 'spellsavedc', target: 'spellSaveDc', op: 'add', value: 1 },
      { id: 'critthreshold', target: 'critThreshold', op: 'set', value: 19 },
    ]);
    expect(finde('Sage Rod').components['Item']).toMatchObject({ bonusSpellAttack: 1 });
    expect(wirkungen(finde('Deep Sack'))).toEqual([{ id: 'capacity', target: 'capacity', op: 'set', value: 500, when: 'self', note: 'contents weigh nothing' }]);
  });

  it('liest die Wirkung einer Variante aus inherits', () => {
    const v = finde('Armor of Frost');
    expect(wirkungen(v)).toEqual([{ id: 'resist-cold', target: 'resist', op: 'grant', value: 'cold' }]);
    expect(v.components['Item']).toMatchObject({ attunement: true, bonusAc: 1 });
  });

  it('nennt, was nicht übernommen wurde', () => {
    const notizen = [...(bericht.arten.get('item')?.notizen.keys() ?? [])];
    expect(notizen).toContain('Wirkung ability.choose nicht übernommen');
    expect(notizen).toContain('Wirkung modifySpeed.multiply nicht übernommen');
  });
});

/**
 * **Schaden am Tisch, eine Rechnung** (T-355): `damageAtTable` für Zugplan
 * und Tracker, `trackerDamage` für die Teilnehmerkante. Erfundene Artikel.
 */
import { describe, expect, it } from 'vitest';
import { damageAtTable, damageLines } from '../src/damage.js';
import { creatureStats } from '../src/stats.js';
import { trackerDamage } from '../src/tracker.js';
import type { Entity } from '../src/types.js';

const pc: Entity = { id: 'pc', name: 'Rook', interfaces: ['PlayerCharacter'], components: { Identity: { name: 'Rook' }, Vitals: { hp: 10, hpTemp: 4, concentration: 'sp' } }, relations: [] };
const sb: Entity = {
  id: 'sb', name: 'Rook stats', interfaces: ['Statblock'],
  components: { Statblock: { hp: 12, resistances: 'cold' }, Abilities: { con: 14 } },
  relations: [{ id: 'b', type: 'belongsTo', to: 'pc', props: {} }],
};
const alle = new Map([pc, sb].map((e) => [e.id, e]));

describe('damageAtTable (T-355)', () => {
  const stats = creatureStats(pc, alle);

  it('ohne Kante: Vitals, zeitweilige zuerst; Konzentration fällig', () => {
    const d = damageAtTable({ stats, vitals: pc.components!['Vitals']!, pc: true, rolled: 7, type: '' });
    expect(d.vitals).toEqual({ hp: 7, concentration: 'sp' });
    expect(d.edgeHp).toBeNull();
    expect(d.concentration).toEqual({ dc: 10, bonus: 2, spell: 'sp' });
    expect(damageLines('Rook', d)).toEqual(['Rook at 7/12 HP']);
  });

  it('Spielerfigur in der Begegnung: Kante spiegelt Vitals; Resistenz halbiert', () => {
    const d = damageAtTable({ stats, vitals: pc.components!['Vitals']!, edge: { hp: 3 }, pc: true, rolled: 9, type: 'cold' });
    expect(d.defense).toMatchObject({ amount: 4, why: 'resistant' });
    expect(d.vitals?.['hp']).toBe(10);
    expect(d.edgeHp).toBe(10);
  });

  it('eine Kreatur mit Kante: nur die Kante, nie unter 0; ohne Schaden keine Probe', () => {
    const d = damageAtTable({ stats, vitals: {}, edge: { hp: 3 }, pc: false, rolled: 9, type: '' });
    expect(d.vitals).toBeNull();
    expect(d.edgeHp).toBe(0);
    expect(damageAtTable({ stats, vitals: { concentration: 'sp' }, edge: {}, pc: false, rolled: 0, type: '' }).concentration).toBeNull();
  });
});

describe('trackerDamage (T-355)', () => {
  const kampf: Entity = { id: 'enc', name: 'Fight', interfaces: ['Encounter'], components: { Encounter: { round: 1 } }, relations: [{ id: 'p', type: 'participates', to: 'pc', props: { hp: 10 } }] };

  it('setzt die Kante und gibt die Figur mit neuen Vitals', () => {
    const r = trackerDamage(alle, kampf, { edge: 'p', amount: 6, type: 'cold' });
    if ('error' in r) throw new Error(r.error);
    expect(r.encounter.relations![0]!.props).toMatchObject({ hp: 10 });
    expect(r.creature?.components?.['Vitals']).toMatchObject({ hp: 10, hpTemp: 1 });
    expect(r.name).toBe('Rook');
  });

  it('nennt, was nicht geht', () => {
    expect(trackerDamage(alle, kampf, { edge: 'x', amount: 1 })).toEqual({ error: 'No such combatant in this encounter.' });
    expect(trackerDamage(alle, kampf, { edge: 'p', amount: -2 })).toEqual({ error: 'Damage must be a number.' });
  });
});

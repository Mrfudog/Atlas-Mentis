import { describe, expect, it } from 'vitest';
import { clearPlayTokens, markersOf, placeTokens, prepareMarker, redactMap, startPrepared } from '../src/map.js';
import { startEncounter } from '../src/initiative.js';
import type { Entity } from '../src/types.js';

const karte: Entity = { id: 'map', interfaces: ['Map'], components: { Identity: { name: 'Map' } }, relations: [] } as Entity;

describe('Vorplatzieren (T-203)', () => {
  it('setzt versteckt mit Begegnung, hält es vor Spielenden zurück und deckt es beim Start auf', () => {
    let e = prepareMarker(karte, 'ghoul', { x: 0.3, y: 0.4 }, 'k1', 'enc');
    e = placeTokens(e, ['wolf', 'ghoul'], { x: 0.5, y: 0.5 }, 0.05, 1, (t) => `p-${t}`, 'enc');
    expect(markersOf(e).map((m) => [m.to, m.kind, m.hidden, m.prepared])).toEqual([
      ['ghoul', 'play', true, 'enc'],
      ['wolf', 'play', true, 'enc'],
    ]);
    const spieler = redactMap(e, { gm: false, sees: () => true });
    expect(markersOf(spieler)).toEqual([]);
    /* Aufräumen nach dem letzten Kampf lässt das Vorbereitete stehen. */
    expect(markersOf(clearPlayTokens(e))).toHaveLength(2);
    const los = startPrepared(e, 'enc');
    expect(markersOf(los).map((m) => [m.hidden, m.prepared])).toEqual([
      [false, ''],
      [false, ''],
    ]);
    expect(startPrepared(e, 'andere')).toEqual(e);
    expect(markersOf(clearPlayTokens(los))).toEqual([]);
  });

  it('würfelt Initiative nur, wo keine steht, mit der Geschicklichkeit des Statblocks', () => {
    const vorlage = { id: 'sb-v', interfaces: ['Statblock'], components: { Abilities: { dex: 14 } }, relations: [] } as Entity;
    const sb = {
      id: 'sb',
      interfaces: ['Statblock'],
      components: {},
      relations: [
        { id: 'i', type: 'instanceOf', to: 'sb-v' },
        { id: 'b', type: 'belongsTo', to: 'ghoul' },
      ],
    } as Entity;
    const ghoul = { id: 'ghoul', interfaces: ['Creature'], components: {}, relations: [] } as Entity;
    const enc = {
      id: 'enc',
      interfaces: ['Encounter'],
      components: { Encounter: { phase: 'planned', round: 0 } },
      relations: [
        { id: 'p1', type: 'participates', to: 'ghoul', props: {} },
        { id: 'p2', type: 'participates', to: 'pc', props: { init: 17 } },
        { id: 'p3', type: 'participates', to: 'ohne', props: {} },
      ],
    } as Entity;
    const bestand = new Map([vorlage, sb, ghoul, enc].map((x) => [x.id, x]));
    const { encounter, rolled } = startEncounter(bestand, enc, () => 11);
    expect(rolled).toEqual([
      { edge: 'p1', to: 'ghoul', roll: 11, mod: 2, init: 13 },
      { edge: 'p3', to: 'ohne', roll: 11, mod: 0, init: 11 },
    ]);
    expect((encounter.relations ?? []).map((r) => (r.props as { init?: number }).init)).toEqual([13, 17, 11]);
    expect(encounter.components['Encounter']).toEqual({ phase: 'running', round: 1, turn: 0 });
  });
});

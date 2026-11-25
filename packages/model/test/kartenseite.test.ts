import { describe, expect, it } from 'vitest';
import { markerByTarget, partyMembers, sessionEncounters, sideFigure } from '../src/kartenseite.js';
import type { Entity } from '../src/types.js';

const e = (id: string, typ: string, name: string, extra: Partial<Entity> = {}): Entity =>
  ({ id, interfaces: [typ], components: { Identity: { name }, ...(extra.components ?? {}) }, relations: extra.relations ?? [] }) as Entity;

describe('Seitenleiste der Karte (T-203)', () => {
  const vorlage = e('sb-v', 'Statblock', 'Vorlage', { components: { Statblock: { hp: 30, ac: 14 } } });
  const instanz = e('sb-i', 'Statblock', 'Instanz', {
    components: { Statblock: {} },
    relations: [
      { id: 'r1', type: 'instanceOf', to: 'sb-v' },
      { id: 'r2', type: 'belongsTo', to: 'pc-1' },
    ],
  });
  const lahm = e('c-1', 'Condition', 'Prone');
  const pc = e('pc-1', 'Creature', 'Rook', {
    components: { Vitals: { hp: 12, hpTemp: 3, conditions: ['c-1', 'c-weg'] } },
    relations: [{ id: 'm1', type: 'memberOfParty', to: 'party' }],
  });
  const pc2 = e('pc-2', 'Creature', 'Ash', { relations: [{ id: 'm2', type: 'memberOfParty', to: 'party' }] });
  const bestand = new Map([vorlage, instanz, lahm, pc, pc2].map((x) => [x.id, x]));

  it('liest Stand, Maximum (aus der Vorlage der Instanz) und Zustände; was fehlt, ist null', () => {
    expect(partyMembers(bestand, 'party').map((x) => x.id)).toEqual(['pc-2', 'pc-1']);
    expect(sideFigure(bestand, pc)).toEqual({ id: 'pc-1', name: 'Rook', hp: 12, hpMax: 30, hpTemp: 3, conditions: [{ id: 'c-1', name: 'Prone' }] });
    expect(sideFigure(bestand, pc2)).toMatchObject({ hp: null, hpMax: null, conditions: [] });
  });

  it('sammelt die Begegnungen unter der Sitzung, die geführte und die auf dieser Karte', () => {
    const sitzung = e('s', 'Session', 'Session 4', { components: { SessionState: { activeEncounter: 'enc-a' } } });
    const szene = e('sz', 'Scene', 'Ambush', { relations: [{ id: 'p1', type: 'partOf', to: 's' }] });
    const unten = e('enc-u', 'Encounter', 'Under the scene', {
      components: { Encounter: { phase: 'planned' } },
      relations: [
        { id: 'p2', type: 'partOf', to: 'sz' },
        { id: 't1', type: 'participates', to: 'pc-1', props: {} },
      ],
    });
    const aktiv = e('enc-a', 'Encounter', 'Active', { components: { Encounter: { phase: 'running', round: 2, kind: ['social', 'combat'] } } });
    const hier = e('enc-h', 'Encounter', 'Here', { relations: [{ id: 'o1', type: 'onMap', to: 'map' }] });
    const fremd = e('enc-f', 'Encounter', 'Elsewhere');
    const b = new Map([...bestand.values(), sitzung, szene, unten, aktiv, hier, fremd].map((x) => [x.id, x]));
    const liste = sessionEncounters(b, sitzung, 'map');
    expect(liste.map((x) => x.id)).toEqual(['enc-a', 'enc-h', 'enc-u']);
    expect(liste[0]).toMatchObject({ active: true, round: 2, phase: 'running', kind: ['social', 'combat'] });
    expect(liste[1]).toMatchObject({ here: true, phase: 'planned', kind: [] });
    expect(liste[2]!.participants).toEqual([{ id: 'pc-1', name: 'Rook' }]);
    expect(sessionEncounters(b, null, null)).toEqual([]);
  });

  it('findet je Ziel seinen Marker', () => {
    const karte = e('map', 'Map', 'Map', {
      relations: [
        { id: 'k1', type: 'marker', to: 'pc-1', props: { x: 0.2, y: 0.3, kind: 'play' } },
        { id: 'k2', type: 'marker', to: 'pc-1', props: { x: 0.5, y: 0.5, kind: 'play' } },
      ],
    });
    expect(markerByTarget(karte).get('pc-1')).toEqual({ rel: 'k1', x: 0.2, y: 0.3 });
  });
});

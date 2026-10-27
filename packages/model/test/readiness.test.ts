import { describe, expect, it } from 'vitest';
import { reachableState, requiredForOf, stateGapMessage, stateGaps, stateOrder, stateRefusal } from '../src/readiness.js';
import type { Entity, Registry } from '../src/types.js';

/* T-425, REQ-441, E-177, E-178, E-180: Pflicht erst für einen Stand. */
const registry = {
  enums: { State: { name: 'State', values: ['idea', 'prepared', 'ready'] } },
  interfaces: {
    Status: { name: 'Status', schema: { type: 'object', properties: { status: { type: 'string', enumRef: 'State' } } } },
    Description: {
      name: 'Description',
      schema: { type: 'object', properties: { description: { type: 'string', requiredFor: 'ready' }, note: { type: 'string' } } },
    },
    Story: { name: 'Story', extends: ['Status', 'Description'], schema: { type: 'object', properties: { hook: { type: 'string', requiredFor: 'prepared' } } } },
    Scene: { name: 'Scene', extends: ['Story'], titles: { 'Description.description': 'Read-aloud summary' } },
    Rule: { name: 'Rule', extends: ['Status', 'Description'], requiredFor: { 'Description.description': 'none' } },
    Arc: { name: 'Arc', extends: ['Story'], requiredFor: { 'Story.hook': 'ready', 'edge:partOf': 'prepared' } },
  },
  relations: {
    partOf: { type: 'partOf', label: 'part of', inverseLabel: 'contains', from: ['*'], to: ['*'] },
    playedIn: { type: 'playedIn', label: 'played in', inverseLabel: 'plays', from: ['Scene'], to: ['*'], requiredFor: 'ready' },
  },
} as unknown as Pick<Registry, 'interfaces' | 'relations' | 'enums'>;

const art = (typ: string, components: Entity['components'] = {}, relations: Entity['relations'] = []): Entity => ({
  id: 'x', interfaces: [typ], name: 'X', components, relations,
});

describe('requiredForOf: was je Art für welchen Stand Pflicht ist', () => {
  it('liest Felder die Kette hoch und Kanten, die von der Art ausgehen', () => {
    expect(Object.fromEntries(requiredForOf(registry, 'Scene'))).toEqual({
      'Story.hook': 'prepared',
      'Description.description': 'ready',
      'edge:playedIn': 'ready',
    });
  });
  it('eine Art überschreibt: anderer Stand, neue Kante, none hebt auf', () => {
    expect(Object.fromEntries(requiredForOf(registry, 'Arc'))).toEqual({
      'Description.description': 'ready',
      'Story.hook': 'ready',
      'edge:partOf': 'prepared',
    });
    expect(Object.fromEntries(requiredForOf(registry, 'Rule'))).toEqual({});
  });
});

describe('stateGaps: was für einen Stand fehlt', () => {
  it('für idea fehlt nie etwas', () => {
    expect(stateGaps(registry, art('Scene'), 'idea')).toEqual([]);
    expect(stateGaps(registry, art('Scene'), 'unknown')).toEqual([]);
  });
  it('für prepared nur, was ab prepared Pflicht ist; für ready alles darunter auch', () => {
    expect(stateGaps(registry, art('Scene'), 'prepared').map((g) => g.ref)).toEqual(['Story.hook']);
    /* Die eigene Art zuerst, dann die Kette hoch. */
    expect(stateGaps(registry, art('Scene'), 'ready').map((g) => [g.ref, g.label])).toEqual([
      ['Story.hook', 'hook'],
      ['Description.description', 'Read-aloud summary'],
      ['edge:playedIn', 'played in'],
    ]);
  });
  it('leer heisst: fehlt, leerer Text, nur Leerzeichen, leere Liste, null', () => {
    for (const v of [undefined, '', '  ', [], null]) {
      expect(stateGaps(registry, art('Scene', { Story: { hook: v } }), 'prepared')).toHaveLength(1);
    }
    expect(stateGaps(registry, art('Scene', { Story: { hook: 'A stranger' } }), 'prepared')).toEqual([]);
  });
  it('eine Kante zählt, sobald eine da ist', () => {
    const voll = art('Scene', { Story: { hook: 'h' }, Description: { description: 'd' } }, [{ id: 'r', type: 'playedIn', to: 's' }]);
    expect(stateGaps(registry, voll, 'ready')).toEqual([]);
  });
});

describe('reachableState und stateRefusal (E-178)', () => {
  it('der höchste Stand ohne Lücke', () => {
    expect(reachableState(registry, art('Scene'), 'ready')).toBe('idea');
    expect(reachableState(registry, art('Scene', { Story: { hook: 'h' } }), 'ready')).toBe('prepared');
    expect(reachableState(registry, art('Rule'), 'ready')).toBe('ready');
  });
  it('verwehrt den Aufstieg mit Lücken, nicht das Bleiben oder Sinken', () => {
    const idee = art('Scene', { Status: { status: 'idea' } });
    const fertig = art('Scene', { Status: { status: 'ready' } });
    expect(stateRefusal(registry, idee, fertig)?.map((g) => g.ref)).toEqual(['Story.hook', 'Description.description', 'edge:playedIn']);
    expect(stateRefusal(registry, fertig, fertig)).toBeNull();
    expect(stateRefusal(registry, fertig, art('Scene', { Status: { status: 'prepared' } }))).toBeNull();
    /* Neu mit einem Stand über idea: geprüft wie ein Aufstieg. */
    expect(stateRefusal(registry, undefined, fertig)).not.toBeNull();
    expect(stateRefusal(registry, undefined, idee)).toBeNull();
  });
  it('ohne Status-Karte zählte der alte als fertig: kein Aufstieg', () => {
    expect(stateRefusal(registry, art('Scene'), art('Scene', { Status: { status: 'ready' } }))).toBeNull();
    expect(stateRefusal(registry, undefined, art('Scene'))).toBeNull();
  });
  it('die Meldung sagt, was zu tun ist', () => {
    const g = stateGaps(registry, art('Scene'), 'ready');
    expect(stateGapMessage('ready', g)).toBe('To set ready, fill in: hook, Read-aloud summary, a “played in” edge. Keep a lower state until then.');
  });
  it('die Reihenfolge kommt aus der Zeile State, sonst die drei bekannten', () => {
    expect(stateOrder(registry)).toEqual(['idea', 'prepared', 'ready']);
    expect(stateOrder({ interfaces: {}, enums: {} } as never)).toEqual(['idea', 'prepared', 'ready']);
  });
});

describe('Werkbank: Ready with gaps (E-178)', () => {
  it('listet Artikel mit Stand, dessen Pflicht fehlt; Ideen und Artikel ohne Stand nicht', async () => {
    const { CHECKS } = await import('../src/checks.js');
    const c = CHECKS.find((x) => x.key === 'readyWithGaps')!;
    const fertig = { ...art('Scene', { Status: { status: 'ready' }, Story: { hook: 'h' } }), id: 'a', name: 'Bridge' };
    const idee = { ...art('Scene', { Status: { status: 'idea' } }), id: 'b' };
    const ohne = { ...art('Scene'), id: 'c' };
    const treffer = c.run({ registry: registry as Registry, entities: [fertig, idee, ohne], exists: new Map() } as never);
    expect(treffer.map((t) => [t.id, t.reason])).toEqual([['a', 'ready, missing: Read-aloud summary, played in']]);
  });
});

import { describe, expect, it } from 'vitest';
import { nodeAtPage, readingOrder } from '../src/reading.js';
import type { Entity } from '../src/types.js';

/* Ein kleines Abenteuer (T-091): Titel, zwei Kapitel (in verkehrter
   Ablage), Abschnitte mit einem Raum darunter, eine Begegnung, die kein
   Text ist, und ein Abschnitt einer anderen Ebene. */
const knoten = (id: string, typ: string, nr: string, ebene: string, teil?: string): Entity => ({
  id,
  interfaces: [typ],
  components: { Identity: { name: id, id: nr } },
  relations: [
    { id: `${id}~l`, type: 'inLayer', to: ebene },
    ...(teil ? [{ id: `${id}~p`, type: 'partOf', to: teil }] : []),
  ],
});

const ABENTEUER: Entity[] = [
  knoten('kap2', 'Story', 'story-0012', 'ly_a', 'titel'),
  knoten('titel', 'Story', 'story-0010', 'ly_a'),
  knoten('kap1', 'Story', 'story-0011', 'ly_a', 'titel'),
  knoten('s10', 'Scene', 'scene-0010', 'ly_a', 'kap1'),
  knoten('s9', 'Scene', 'scene-0009', 'ly_a', 'kap1'),
  knoten('raum', 'Scene', 'scene-0011', 'ly_a', 's9'),
  knoten('s20', 'Scene', 'scene-0020', 'ly_a', 'kap2'),
  knoten('kampf', 'Encounter', 'encounter-0001', 'ly_a', 's9'),
  knoten('fremd', 'Scene', 'scene-0001', 'ly_b', 'kap1'),
];

describe('readingOrder (T-091)', () => {
  it('liest Tiefe zuerst, Geschwister nach Nummer, ohne Begegnungen und fremde Ebenen', () => {
    const o = readingOrder(ABENTEUER, 'ly_a');
    expect(o.map((n) => `${n.id}:${n.depth}`)).toEqual(['titel:0', 'kap1:1', 's9:2', 'raum:3', 's10:2', 'kap2:1', 's20:2']);
  });

  it('macht unter der Titelseite jedes Kapitel zu einem Stück', () => {
    const o = new Map(readingOrder(ABENTEUER, 'ly_a').map((n) => [n.id, n]));
    expect(o.get('titel')?.unit).toBe('titel');
    expect(o.get('kap1')?.unit).toBe('kap1');
    expect(o.get('raum')?.unit).toBe('kap1');
    expect(o.get('s20')?.unit).toBe('kap2');
    expect(o.get('raum')?.parent).toBe('s9');
  });

  it('nimmt ohne Titelseite jede Wurzel als Stück', () => {
    const buch = [knoten('a', 'Story', 'story-0001', 'ly_c'), knoten('a1', 'Scene', 'scene-0001', 'ly_c', 'a'), knoten('b', 'Story', 'story-0002', 'ly_c')];
    expect(readingOrder(buch, 'ly_c').map((n) => `${n.id}@${n.unit}`)).toEqual(['a@a', 'a1@a', 'b@b']);
  });

  it('läuft in einem Kreis nicht endlos und verliert nichts', () => {
    const kreis = [knoten('x', 'Scene', 'scene-0001', 'ly_d', 'y'), knoten('y', 'Scene', 'scene-0002', 'ly_d', 'x')];
    expect(readingOrder(kreis, 'ly_d').map((n) => `${n.id}:${n.depth}`)).toEqual(['x:0', 'y:1']);
  });
});

describe('nodeAtPage (T-091)', () => {
  const o = [{ id: 'a', page: '5' }, { id: 'b' }, { id: 'c', page: 12 }, { id: 'd', page: '20' }];
  it('nimmt den letzten Abschnitt, der nicht hinter der Seite beginnt', () => {
    expect(nodeAtPage(o, 12)).toBe('c');
    expect(nodeAtPage(o, 15)).toBe('c');
    expect(nodeAtPage(o, 99)).toBe('d');
  });
  it('fällt vor der ersten Seite auf den ersten Abschnitt mit Seite', () => {
    expect(nodeAtPage(o, 1)).toBe('a');
    expect(nodeAtPage([{ id: 'x' }], 3)).toBeUndefined();
  });
});

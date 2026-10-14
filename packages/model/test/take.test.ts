import { describe, expect, it } from 'vitest';
import { rehang, takenWith } from '../src/stack.js';
import type { Entity, EntityId } from '../src/types.js';

/* Ein Abenteuer (Ebene `ly_buch`) mit einem Kapitel, zwei Szenen, einem
   Raum, einer Begegnung und einer Karte; die Kampagne schaltet es und ihre
   eigene Ebene auf. Eine Szene hat sie schon angepasst (E-018 a). */
const rel = (id: string, type: string, to: string) => ({ id, type, to });
const welt: Entity[] = [
  { id: 'ly_buch', name: 'Buch', interfaces: ['Layer'], components: { Layer: { order: 1 } } },
  { id: 'ly_runde', name: 'Runde', interfaces: ['Layer'], components: { Layer: { order: 50 } } },
  { id: 'ly_fremd', name: 'Fremd', interfaces: ['Layer'], components: { Layer: { order: 2 } } },
  { id: 'camp', name: 'Runde', interfaces: ['Campaign'], relations: [rel('a1', 'activates', 'ly_buch'), rel('a2', 'activates', 'ly_runde')] },
  { id: 'adv', name: 'Abenteuer', interfaces: ['Story'], relations: [rel('x1', 'inLayer', 'ly_buch')] },
  { id: 'kap', name: 'Kapitel 1', interfaces: ['Arc'], relations: [rel('k1', 'inLayer', 'ly_buch'), rel('k2', 'partOf', 'adv')] },
  { id: 'sz1', name: 'Höhle', interfaces: ['Scene'], relations: [rel('s1', 'inLayer', 'ly_buch'), rel('s2', 'partOf', 'kap')] },
  { id: 'raum', name: '1. Mund', interfaces: ['Scene'], relations: [rel('r1', 'inLayer', 'ly_buch'), rel('r2', 'partOf', 'sz1')] },
  { id: 'kampf', name: '1. Mund', interfaces: ['Encounter'], relations: [rel('b1', 'inLayer', 'ly_buch'), rel('b2', 'partOf', 'raum')] },
  { id: 'karte', name: 'Höhle', interfaces: ['Map'], relations: [rel('m1', 'inLayer', 'ly_buch'), rel('m2', 'mapOf', 'sz1')] },
  { id: 'sz2', name: 'Sumpf', interfaces: ['Scene'], relations: [rel('t1', 'inLayer', 'ly_buch'), rel('t2', 'partOf', 'kap')] },
  { id: 'sz2f', name: 'Sumpf (unsere)', interfaces: ['Scene'], relations: [rel('f1', 'inLayer', 'ly_runde'), rel('f2', 'partOf', 'kap'), rel('f3', 'overrides', 'sz2')] },
  { id: 'eigen', name: 'Eigene Szene', interfaces: ['Scene'], relations: [rel('e1', 'inLayer', 'ly_runde'), rel('e2', 'partOf', 'kap')] },
  { id: 'aus', name: 'Nicht im Stapel', interfaces: ['Scene'], relations: [rel('n1', 'inLayer', 'ly_fremd'), rel('n2', 'partOf', 'kap')] },
];
const entities = new Map<EntityId, Entity>(welt.map((e) => [e.id, e]));
const camp = entities.get('camp')!;

describe('In die Geschichte holen (E-026, REQ-252)', () => {
  it('nimmt ein Kapitel mit allem, was darunter hängt — Szenen, Räume, Begegnungen, Karten', () => {
    const ids = takenWith(entities, entities.get('kap')!, camp, 'ly_runde').map((e) => e.id);
    expect(ids[0]).toBe('kap');
    expect(new Set(ids)).toEqual(new Set(['kap', 'sz1', 'sz2', 'raum', 'karte', 'kampf']));
  });

  it('nimmt keine Fassung, nichts aus der Zielebene und nichts ausserhalb des Stapels', () => {
    const ids = takenWith(entities, entities.get('kap')!, camp, 'ly_runde').map((e) => e.id);
    expect(ids).not.toContain('sz2f');
    expect(ids).not.toContain('eigen');
    expect(ids).not.toContain('aus');
  });

  it('nimmt eine Szene allein mit ihren Teilen, nicht ihr Kapitel', () => {
    const ids = takenWith(entities, entities.get('sz1')!, camp, 'ly_runde').map((e) => e.id);
    expect(new Set(ids)).toEqual(new Set(['sz1', 'raum', 'karte', 'kampf']));
  });

  it('hängt die Fassungen an die Fassungen und den Artikel selbst in den eigenen Arc', () => {
    const mapping = new Map([['kap', 'kap_f'], ['sz1', 'sz1_f']]);
    const szene = rehang({ ...entities.get('sz1')!, id: 'sz1_f' }, mapping);
    expect(szene.relations!.find((r) => r.type === 'partOf')!.to).toBe('kap_f');
    const karte = rehang({ ...entities.get('karte')!, id: 'karte_f' }, mapping);
    expect(karte.relations!.find((r) => r.type === 'mapOf')!.to).toBe('sz1_f');
    const kapitel = rehang({ ...entities.get('kap')!, id: 'kap_f' }, mapping, 'mein_arc');
    expect(kapitel.relations!.filter((r) => r.type === 'partOf').map((r) => r.to)).toEqual(['mein_arc']);
    expect(kapitel.relations!.some((r) => r.type === 'inLayer')).toBe(true);
  });
});

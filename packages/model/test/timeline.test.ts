import { describe, expect, it } from 'vitest';
import { isTrack, timeSpan, worldHistory } from '../src/timeline.js';
import type { Entity, EntityId } from '../src/types.js';

/* Eine kleine Weltgeschichte (D57): ein Zeitalter, darin ein Krieg, darin
   eine Schlacht; eine Hochzeit, die in die Spanne des Kriegs fällt, aber
   nicht zu ihm gehört; die Kampagne mit einer Sitzung. */
const zeit = (sort: number, untilSort?: number) => ({ Time: { sort, untilSort, display: `Y${sort}` } });
const teil = (to: string) => [{ id: `p_${to}`, type: 'partOf', to }];
const liste: Entity[] = [
  { id: 'age', name: 'Third Age', interfaces: ['Event'], components: zeit(1000, 1500) },
  { id: 'war', name: 'Dragon War', interfaces: ['Event'], components: zeit(1480, 1490), relations: teil('age') },
  { id: 'battle', name: 'Battle of Ash', interfaces: ['Event'], components: zeit(1485), relations: teil('war') },
  { id: 'late', name: 'Late skirmish', interfaces: ['Event'], components: zeit(1495), relations: teil('war') },
  { id: 'wedding', name: 'Wedding', interfaces: ['Event'], components: zeit(1486) },
  { id: 'camp', name: 'Nebelwacht', interfaces: ['Campaign'], components: {} },
  { id: 's1', name: 'Session 1', interfaces: ['Session'], components: zeit(1492), relations: teil('camp') },
  { id: 'undated', name: 'No date', interfaces: ['Event'], components: { Time: { display: 'once' } } },
];
const welt = new Map<EntityId, Entity>(liste.map((e) => [e.id, e]));

describe('timeSpan / isTrack', () => {
  it('liest Punkt und Spanne, ein Ende vor dem Anfang zählt nicht', () => {
    expect(timeSpan(welt.get('battle')!)).toEqual({ sort: 1485, display: 'Y1485' });
    expect(timeSpan({ id: 'x', name: 'x', interfaces: ['Event'], components: zeit(10, 5) })?.until).toBeUndefined();
    expect(timeSpan(welt.get('undated')!)).toBeNull();
  });
  it('eine Spur ist ein Ereignis mit Spanne, keine Sitzung', () => {
    expect(isTrack(welt.get('war')!)).toBe(true);
    expect(isTrack(welt.get('battle')!)).toBe(false);
    expect(isTrack({ id: 's', name: 's', interfaces: ['Session'], components: zeit(1, 2) })).toBe(false);
  });
});

describe('worldHistory', () => {
  const lanes = worldHistory(welt, { campaign: welt.get('camp') });
  const lane = (id: string) => lanes.find((l) => l.id === id)!;

  it('ordnet die Spuren als Baum, die Kampagne nach ihrem Anfang', () => {
    expect(lanes.map((l) => [l.id, l.depth])).toEqual([['age', 0], ['war', 1], ['camp', 0]]);
  });
  it('über die Kante, nicht über den Zeitraum: die Hochzeit liegt nicht im Krieg', () => {
    expect(lane('war').items.map((i) => i.id)).toEqual(['battle', 'late']);
    expect(lane('camp').items.map((i) => i.id)).toEqual(['wedding', 's1']);
  });
  it('eine Spur in einer Spur ist ein Balken aussen und ihr Inhalt nur innen', () => {
    expect(lane('age').items.map((i) => [i.id, i.track])).toEqual([['war', true]]);
  });
  it('nennt, was über die Kante drinliegt und ausserhalb der Spanne fällt', () => {
    expect(lane('war').outside).toEqual(['late']);
  });
  it('rechnet die Spanne der Kampagne aus ihrem Inhalt', () => {
    expect([lane('camp').from, lane('camp').to, lane('camp').derived]).toEqual([1486, 1492, true]);
  });
  it('überspringt eine verborgene Spur: ihr Inhalt rückt in die nächste', () => {
    const l = worldHistory(welt, { campaign: welt.get('camp'), visible: (e) => e.id !== 'war' });
    expect(l.map((x) => x.id)).toEqual(['age', 'camp']);
    expect(l[0].items.map((i) => i.id)).toEqual(['battle', 'late']);
  });
  it('ohne bekanntes Datum keine Spur und kein Eintrag', () => {
    const l = worldHistory(welt, { campaign: welt.get('camp'), dated: (e) => e.id !== 'age' && e.id !== 'battle' });
    expect(l.map((x) => x.id)).toEqual(['war', 'camp']);
    expect(l[0].items.map((i) => i.id)).toEqual(['late']);
  });
  it('eine Kampagne in einem Zeitalter hängt darunter', () => {
    const c = { ...welt.get('camp')!, relations: teil('age') };
    const w = new Map(welt); w.set('camp', c);
    const l = worldHistory(w, { campaign: c });
    expect(l.map((x) => [x.id, x.depth])).toEqual([['age', 0], ['war', 1], ['camp', 1]]);
    expect(l[0].items.map((i) => i.id)).toEqual(['war', 'camp']);
  });
  it('übersteht einen Kreis aus partOf', () => {
    const a: Entity = { id: 'a', name: 'a', interfaces: ['Event'], components: zeit(1, 5), relations: teil('b') };
    const b: Entity = { id: 'b', name: 'b', interfaces: ['Event'], components: zeit(2, 6), relations: teil('a') };
    const l = worldHistory(new Map([['a', a], ['b', b]]));
    expect(l.map((x) => x.id).sort()).toEqual(['a', 'b']);
  });
});

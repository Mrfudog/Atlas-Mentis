import { describe, expect, it } from 'vitest';
import type { Entity, Relation } from '../src/types.js';
import { LIFT_SINGLES, confirmPlacement, keepLifted, keepOnMap, liftMarkers, markersOf, placementSuggestions, stays } from '../src/index.js';

const marke = (id: string, to: string, x: number, y: number, props: Record<string, unknown> = {}): Relation => ({
  id,
  type: 'marker',
  to,
  props: { x, y, kind: 'static', ...props },
});
const karte = (id: string, relations: Relation[] = []): Entity => ({ id, interfaces: ['Map'], name: id, components: { Map: {} }, relations });
const kasten = { frame: { x: 0.2, y: 0.4, w: 0.2, h: 0.4 }, area: null };

describe('Marker zwischen Kartenstufen (T-328)', () => {
  it('hebt Orte und Tokens mit dem Kasten, nicht Assets, Übergänge, Lichter und das Gruppen-Token', () => {
    const stadt = karte('stadt', [
      marke('a', 'volo', 0.5, 0.5),
      marke('b', 'held', 0, 1, { kind: 'play' }),
      marke('c', 'auftrag', 1, 0, { kind: 'quest' }),
      marke('d', 'kiste', 0.5, 0.5, { kind: 'scenery' }),
      marke('e', 'stadt', 0.5, 0.5, { kind: 'passage' }),
      marke('f', 'stadt', 0.5, 0.5, { kind: 'light' }),
      marke('g', 'gruppe', 0.5, 0.5, { kind: 'party' }),
    ]);
    const g = liftMarkers(stadt, kasten)!;
    expect(g.items.map((m) => m.to)).toEqual(['volo', 'held', 'auftrag']);
    expect(g.items[0]).toMatchObject({ x: 0.3, y: 0.6 });
    expect(g.items[1]).toMatchObject({ x: 0.2, y: 0.8 });
    expect(g.bundled).toBe(false);
    expect(g.centre).toEqual({ x: 0.3, y: 0.6 });
  });

  it('lässt aus, was oben schon steht, und hebt nichts aus einer leeren Karte', () => {
    const stadt = karte('stadt', [marke('a', 'volo', 0.5, 0.5)]);
    expect(liftMarkers(stadt, kasten, { skip: new Set(['volo']) })).toBeNull();
    expect(liftMarkers(karte('leer'), kasten)).toBeNull();
  });

  it('bündelt viele zu einem Punkt mit Zahl — auch nach dem Nachsieben', () => {
    const viele = karte(
      'markt',
      Array.from({ length: LIFT_SINGLES + 2 }, (_, i) => marke(`m${i}`, `h${i}`, i / 10, 0.5)),
    );
    const g = liftMarkers(viele, kasten)!;
    expect(g.bundled).toBe(true);
    expect(g.items).toHaveLength(LIFT_SINGLES + 2);
    const wenige = keepLifted(g, (m) => m.to !== 'h0' && m.to !== 'h1' && m.to !== 'h2')!;
    expect(wenige.items).toHaveLength(LIFT_SINGLES - 1);
    expect(wenige.bundled).toBe(false);
    expect(keepLifted(g, () => false)).toBeNull();
  });

  it('hebt nur die erste Ebene einer Karte mit Stockwerken', () => {
    const haus = karte('haus', [marke('a', 'oben', 0.5, 0.5), marke('b', 'keller', 0.5, 0.5, { floor: 'f2' })]);
    haus.components = { Map: { floors: [{ id: 'f2', name: 'Keller' }] } };
    expect(liftMarkers(haus, kasten)!.items.map((m) => m.to)).toEqual(['oben']);
  });

  it('schlägt vor, was oben im Bereich steht — ohne „Keep here“ und ohne was unten schon steht', () => {
    const region = karte('region', [
      marke('w', 'wirt', 0.3, 0.6),
      marke('t', 'turm', 0.3, 0.6, { stay: true }),
      marke('v', 'volo', 0.25, 0.5),
      marke('x', 'bauer', 0.9, 0.1),
      marke('k', 'kiste', 0.3, 0.6, { kind: 'scenery' }),
    ]);
    const stadt = karte('stadt', [marke('a', 'volo', 0.1, 0.1)]);
    const v = placementSuggestions(region, kasten, stadt);
    expect(v).toEqual([{ rel: 'w', from: 'region', to: 'wirt', kind: 'static', x: 0.5, y: 0.5 }]);
    /* Eine Form engt ein: ausserhalb des Vielecks kein Vorschlag. */
    const form = { ...kasten, area: [[0.2, 0.4], [0.25, 0.4], [0.2, 0.45]] as [number, number][] };
    expect(placementSuggestions(region, form, karte('leer'))).toEqual([]);
  });

  it('lässt beim Bestätigen den Marker wandern — oben weg, unten neu, mit seinen Angaben', () => {
    const region = karte('region', [marke('w', 'wirt', 0.3, 0.6, { note: 'am Tor', hidden: true, stay: true, floor: '' })]);
    const stadt = karte('stadt');
    const neu = confirmPlacement(region, stadt, 'w', { x: 0.4, y: 0.7 }, 'r-1');
    expect(markersOf(neu.parent)).toEqual([]);
    const [m] = markersOf(neu.child);
    expect(m).toMatchObject({ to: 'wirt', x: 0.4, y: 0.7, note: 'am Tor', hidden: true });
    expect(stays(m!.rel)).toBe(false);
    expect(confirmPlacement(region, stadt, 'fehlt', { x: 0, y: 0 }, 'r-2')).toEqual({ parent: region, child: stadt });
  });

  it('„Keep here" setzt und nimmt `stay`', () => {
    const region = karte('region', [marke('w', 'wirt', 0.3, 0.6)]);
    const fest = keepOnMap(region, 'w');
    expect(stays(fest.relations![0]!)).toBe(true);
    expect(stays(keepOnMap(fest, 'w', false).relations![0]!)).toBe(false);
  });
});

/**
 * Wo ein Artikel steht (T-330): der Ort über `mapOf`, darüber `partOf`,
 * eine Unterkarte ohne eigenen Ort bei ihrer Karte — und die Dimensionen
 * „Location", „Region" und „Map kind" für die Transformationen.
 */
import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import { applyTransform, articleDimensions, isPlace, LOCATION_RELATIONS, locationPath, type Entity } from '../src/index.js';

const e = (id: string, interfaces: string[], relations: [string, string][] = [], components: Entity['components'] = {}): Entity => ({
  id,
  interfaces,
  name: id,
  components,
  relations: relations.map(([type, to]) => ({ type, from: id, to })),
});

const kueste = e('kueste', ['Place']);
const stadt = e('stadt', ['Place'], [['partOf', 'kueste']]);
const laden = e('laden', ['Shop'], [['partOf', 'stadt']]);
const arc = e('arc', ['Arc']);
const karte = e('k1', ['Map'], [['mapOf', 'stadt']], { Map: { kind: 'city' } });
const unter = e('k2', ['Map'], [['insideMap', 'k1']], { Map: { kind: 'building' } });
const ladenKarte = e('k3', ['Map'], [['mapOf', 'laden'], ['insideMap', 'k1']]);
const geschichte = e('k4', ['Map'], [['mapOf', 'arc']]);
const alle = [kueste, stadt, laden, arc, karte, unter, ladenKarte, geschichte];
const byId = new Map(alle.map((x) => [x.id, x]));

describe('locationPath', () => {
  it('geht vom Ort der Karte über partOf nach oben, der nächste zuerst', () => {
    expect(locationPath(seedRegistry, karte, byId)).toEqual(['stadt', 'kueste']);
    expect(locationPath(seedRegistry, ladenKarte, byId)).toEqual(['laden', 'stadt', 'kueste']);
  });

  it('eine Unterkarte ohne eigenen Ort liegt, wo ihre Karte liegt', () => {
    expect(locationPath(seedRegistry, unter, byId)).toEqual(['stadt', 'kueste']);
  });

  it('eine Geschichte ist kein Standort, ein Laden schon (extends Place)', () => {
    expect(locationPath(seedRegistry, geschichte, byId)).toEqual([]);
    expect(isPlace(seedRegistry, laden)).toBe(true);
    expect(isPlace(seedRegistry, arc)).toBe(false);
  });

  it('ein unsichtbarer Ort oder ein Kreis beendet den Weg', () => {
    const ohneKueste = new Map(byId);
    ohneKueste.delete('kueste');
    expect(locationPath(seedRegistry, karte, ohneKueste)).toEqual(['stadt']);
    const a = e('a', ['Place'], [['partOf', 'b']]);
    const b = e('b', ['Place'], [['partOf', 'a']]);
    const m = e('m', ['Map'], [['mapOf', 'a']]);
    expect(locationPath(seedRegistry, m, new Map([a, b, m].map((x) => [x.id, x])))).toEqual(['a', 'b']);
  });

  it('die Standortkanten sind eine Liste — locatedIn (T-331) wird ein Eintrag', () => {
    expect(LOCATION_RELATIONS).toContain('mapOf');
  });
});

describe('articleDimensions: Standort und Kartenart', () => {
  const dims = articleDimensions(seedRegistry, {
    location: (x) => locationPath(seedRegistry, x, byId),
    locationName: (id) => byId.get(id)?.name.toUpperCase(),
  });
  const karten = [karte, unter, ladenKarte, geschichte];

  it('gruppiert nach Region und darin nach Location, mit Namen', () => {
    const t = applyTransform(karten, [{ group: 'region' }, { group: 'location' }], dims);
    expect(t.nodes.map((n) => [n.label, n.count])).toEqual([['KUESTE', 3], ['(none)', 1]]);
    expect(t.nodes[0]!.children.map((n) => [n.label, n.count])).toEqual([['LADEN', 1], ['STADT', 2]]);
  });

  it('gruppiert nach Kartenart', () => {
    const t = applyTransform(karten, [{ group: 'mapKind' }], dims);
    expect(t.nodes.map((n) => [n.value, n.count])).toEqual([['building', 1], ['city', 1], ['', 2]]);
  });

  it('ohne Standortangabe gibt es keine Standortdimension', () => {
    expect(articleDimensions(seedRegistry).map((d) => d.key)).not.toContain('location');
  });
});

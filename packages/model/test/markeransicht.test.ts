import { describe, expect, it } from 'vitest';
import {
  addMarker,
  kindMarkerViewOf,
  mapMarkerViewOf,
  markerOf,
  markersOf,
  markerViewForType,
  markerViewOf,
  withKindMarkerView,
  withMapMarkerView,
  withMarkerView,
} from '../src/map.js';
import { InterfaceDefSchema } from '../src/validate.js';
import type { Entity, Registry } from '../src/types.js';

/* Markeransicht (T-214): Marker › Karte › Kartenart › Art › Bild. */

const reg: Pick<Registry, 'interfaces'> = {
  interfaces: {
    Identity: { name: 'Identity', abstract: true },
    Creature: { name: 'Creature', extends: ['Identity'] },
    Note: { name: 'Note', extends: ['Identity'], markerView: 'card' },
    Memo: { name: 'Memo', extends: ['Note'] },
    Shopkeeper: { name: 'Shopkeeper', extends: ['Note'], markerView: 'name' },
  },
};

const karte = (): Entity => ({ id: 'map-1', interfaces: ['Map'], components: { Map: { kind: 'world' } }, relations: [] });
const kampagne = (): Entity => ({ id: 'c-1', interfaces: ['Campaign'], components: { Campaign: { name: 'X' } }, relations: [] });

describe('markerViewForType', () => {
  it('liest die Art und erbt die extends-Kette hoch', () => {
    expect(markerViewForType(reg, 'Note')).toBe('card');
    expect(markerViewForType(reg, 'Memo')).toBe('card');
    expect(markerViewForType(reg, 'Shopkeeper')).toBe('name');
    expect(markerViewForType(reg, 'Creature')).toBeNull();
    expect(markerViewForType(reg, undefined)).toBeNull();
  });
});

describe('markerViewOf', () => {
  const m = markerOf({ id: 'r', type: 'marker', to: 'x', props: { x: 0.5, y: 0.5 } });
  it('ohne jede Angabe bleibt es beim Bild — bestehende Karten ändern sich nicht', () => {
    expect(m.view).toBe('');
    expect(markerViewOf(m, {})).toBe('image');
  });
  it('die genaueste Angabe gewinnt', () => {
    expect(markerViewOf(m, { type: 'card' })).toBe('card');
    expect(markerViewOf(m, { type: 'card', kind: 'symbol' })).toBe('symbol');
    expect(markerViewOf(m, { type: 'card', kind: 'symbol', map: 'name' })).toBe('name');
    expect(markerViewOf({ ...m, view: 'image' }, { type: 'card', kind: 'symbol', map: 'name' })).toBe('image');
  });
  it('Asset und freies Licht fragen nicht', () => {
    expect(markerViewOf({ ...m, kind: 'scenery' }, { map: 'card' })).toBe('image');
    expect(markerViewOf({ ...m, kind: 'light' }, { map: 'card' })).toBe('symbol');
  });
});

describe('setzen und zurückstellen', () => {
  it('am Marker (`props.view`)', () => {
    let k = addMarker(karte(), 'npc-1', { x: 0.2, y: 0.3 }, 'r1');
    k = withMarkerView(k, 'r1', 'name');
    expect(markersOf(k)[0]!.view).toBe('name');
    k = withMarkerView(k, 'r1', null);
    expect(markersOf(k)[0]!.view).toBe('');
    expect(markersOf(k)[0]!.rel.props).not.toHaveProperty('view');
  });
  it('an der Karte (`Map.markerView`)', () => {
    let k = withMapMarkerView(karte(), 'symbol');
    expect(mapMarkerViewOf(k)).toBe('symbol');
    k = withMapMarkerView(k, null);
    expect(mapMarkerViewOf(k)).toBeNull();
    expect(k.components['Map']).toEqual({ kind: 'world' });
  });
  it('je Kartenart an der Kampagne (`Campaign.markerViews`)', () => {
    let c = withKindMarkerView(kampagne(), 'world', 'symbol');
    c = withKindMarkerView(c, 'battle', 'image');
    expect(kindMarkerViewOf(c, 'world')).toBe('symbol');
    expect(kindMarkerViewOf(c, 'region')).toBeNull();
    c = withKindMarkerView(withKindMarkerView(c, 'world', null), 'battle', null);
    expect(c.components['Campaign']).toEqual({ name: 'X' });
  });
  it('Unsinn zählt nicht', () => {
    const k = { ...karte(), components: { Map: { markerView: 'gross' } } };
    expect(mapMarkerViewOf(k)).toBeNull();
    expect(markerOf({ id: 'r', type: 'marker', to: 'x', props: { view: 7 } }).view).toBe('');
  });
});

describe('Registerzeile', () => {
  it('nimmt markerView an und lehnt Unbekanntes ab', () => {
    expect(InterfaceDefSchema.safeParse({ name: 'Note', markerView: 'card' }).success).toBe(true);
    expect(InterfaceDefSchema.safeParse({ name: 'Note', markerView: 'poster' }).success).toBe(false);
  });
});

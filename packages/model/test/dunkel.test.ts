import { describe, expect, it } from 'vitest';
import { redactDark } from '../src/lighting.js';
import { addFloor, floorView } from '../src/floors.js';
import { markersOf } from '../src/map.js';
import type { Entity, Relation } from '../src/types.js';

/**
 * Tokens im Dunkeln (T-219): auf einer dunklen Karte geht an Spielende nur,
 * was eine eigene Figur sieht — mit Dunkelsicht oder im Licht.
 * Bild 100 × 100, Felder zu 10 px, 5 ft je Feld: 30 ft sind 0,6 der Breite.
 */
function karte(rel: Relation[], map: Record<string, unknown> = {}): Entity {
  return {
    id: 'map-1',
    interfaces: ['Map'],
    components: { Map: { gridShape: 'square', gridSize: 10, scale: '5 ft', lighting: 'dark', ...map }, Image: { image: 'a' } },
    relations: rel,
  };
}
const NAT = { w: 100, h: 100 };
const tok = (id: string, to: string, x: number, y: number, props: Record<string, unknown> = {}): Relation => ({ id, type: 'marker', to, props: { kind: 'play', x, y, ...props } });
const ich = tok('m-ich', 'pc-1', 0.1, 0.1);
const nah = tok('m-nah', 'ghul-1', 0.4, 0.1);
const fern = tok('m-fern', 'ghul-2', 0.9, 0.9);
const opts = (dv: number) => ({ nat: () => NAT, eyes: (id: string) => id === 'pc-1', darkvision: () => dv, carried: () => ({}) });
const ids = (e: Entity) => markersOf(e).map((m) => m.rel.id);

describe('Tokens im Dunkeln (T-219)', () => {
  it('hält zurück, was keine eigene Figur sieht', () => {
    expect(ids(redactDark(karte([ich, nah, fern]), opts(30)))).toEqual(['m-ich', 'm-nah']);
    /* Ohne Dunkelsicht und ohne Licht sieht sie im Dunkeln niemanden. */
    expect(ids(redactDark(karte([ich, nah, fern]), opts(0)))).toEqual(['m-ich']);
  });

  it('ein Licht in der Sichtlinie zeigt, wer darin steht', () => {
    const laterne: Relation = { id: 'm-licht', type: 'marker', to: 'map-1', props: { kind: 'light', x: 0.9, y: 0.85, light: 2, dim: 3 } };
    expect(ids(redactDark(karte([ich, fern, laterne]), opts(0)))).toEqual(['m-ich', 'm-fern', 'm-licht']);
  });

  it('gilt nur im Dunkeln, nur mit eigener Figur auf der Karte, und lässt Lichter, Assets und die Gruppe stehen', () => {
    expect(ids(redactDark(karte([ich, nah, fern], { lighting: 'dim' }), opts(0)))).toEqual(['m-ich', 'm-nah', 'm-fern']);
    expect(ids(redactDark(karte([nah, fern]), opts(0)))).toEqual(['m-nah', 'm-fern']);
    const kiste = tok('m-kiste', 'kiste', 0.9, 0.1, { kind: 'scenery' });
    expect(ids(redactDark(karte([ich, kiste]), opts(0)))).toEqual(['m-ich', 'm-kiste']);
    expect(ids(redactDark(karte([ich, nah]), opts(0)))).toEqual(['m-ich']);
    expect(ids(redactDark(karte([ich, nah]), { ...opts(0), keep: (id: string) => id === 'ghul-1' }))).toEqual(['m-ich', 'm-nah']);
  });

  it('rechnet je Ebene mit den Figuren auf dieser Ebene', () => {
    let e = addFloor(karte([ich, nah]), 'up', { name: 'Upper' });
    e = { ...e, relations: [...(e.relations ?? []), tok('m-oben', 'ghul-3', 0.2, 0.1, { floor: 'up' })] };
    const r = redactDark(e, opts(30));
    /* Oben steht keine eigene Figur: dort bleibt, was da ist. */
    expect(ids(floorView(r, 'up'))).toEqual(['m-oben']);
    expect(ids(floorView(r, null))).toEqual(['m-ich', 'm-nah']);
  });
});

describe('Licht der Zonen (T-219)', () => {
  const finster = (x: number, y: number, w: number, h: number) => [{ shape: { id: 'z', kind: 'rect' as const, x, y, w, h }, light: 'dark' as const }];
  it('in magischer Dunkelheit auf einer hellen Karte sieht man nur mit Dunkelsicht', () => {
    const e = karte([ich, nah, fern], { lighting: 'bright' });
    /* Der ferne Ghul steht in einer finsteren Zone, der nahe im Hellen. */
    const zonen = () => finster(0.8, 0.8, 0.2, 0.2);
    expect(ids(redactDark(e, { ...opts(0), zones: zonen }))).toEqual(['m-ich', 'm-nah']);
    expect(ids(redactDark(e, { ...opts(200), zones: zonen }))).toEqual(['m-ich', 'm-nah', 'm-fern']);
  });
  it('ein erleuchteter Saal auf einer dunklen Karte zeigt, wer darin in Sichtlinie steht', () => {
    const e = karte([ich, nah, fern]);
    const saal = () => [{ shape: { id: 'z', kind: 'rect' as const, x: 0.7, y: 0.7, w: 0.3, h: 0.3 }, light: 'bright' as const }];
    expect(ids(redactDark(e, { ...opts(0), zones: saal }))).toEqual(['m-ich', 'm-fern']);
  });
});

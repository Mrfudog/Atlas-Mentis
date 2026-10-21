import { describe, expect, it } from 'vitest';
import { MAP_NEAR, frameNear, liftPoint, zoomStep } from '../src/map.js';
import {
  areaInFrame,
  inMapLink,
  linkCentre,
  linkNearOf,
  linkOuterOn,
  linkShowFor,
  mapExits,
  mapLinkDefaultsOf,
  mapLinkOf,
  outerPlacement,
} from '../src/maplinks.js';
import type { Entity, Relation } from '../src/types.js';

const kante = (props: Record<string, unknown>): Relation => ({ id: 'r', type: 'insideMap', to: 'oben', props }) as Relation;
const kampagne = (c: Record<string, unknown>): Entity => ({ id: 'c', interfaces: ['Campaign'], components: { Campaign: c } }) as unknown as Entity;

describe('Kartenverknüpfung (T-327)', () => {
  it('liest ein Rechteck wie bisher: Schwelle 0,55, Klick springt, kein Rand', () => {
    const l = mapLinkOf(kante({ x: 0.2, y: 0.3, w: 0.4, h: 0.2 }))!;
    expect(l.frame).toEqual({ x: 0.2, y: 0.3, w: 0.4, h: 0.2 });
    expect(l.area).toBeNull();
    expect(l.near).toBe(MAP_NEAR);
    const d = mapLinkDefaultsOf(null);
    expect(linkShowFor(l, d, true)).toBe('jump');
    expect(linkShowFor(l, d, false)).toBe('jump');
    expect(linkOuterOn(l, d)).toBe(false);
  });

  it('eine Form: der Kasten ist der des Vielecks, getroffen wird nur die Form', () => {
    const l = mapLinkOf(kante({ x: 0, y: 0, w: 1, h: 1, area: [[0.2, 0.2], [0.6, 0.2], [0.2, 0.6]] }))!;
    expect(l.frame.x).toBeCloseTo(0.2);
    expect(l.frame.w).toBeCloseTo(0.4);
    expect(inMapLink(l, { x: 0.25, y: 0.25 })).toBe(true);
    expect(inMapLink(l, { x: 0.55, y: 0.55 })).toBe(false);
    const ecke = areaInFrame(l)![1]!;
    expect(ecke[0]).toBeCloseTo(1);
    expect(ecke[1]).toBeCloseTo(0);
    const m = linkCentre(l);
    expect(inMapLink(l, m)).toBe(true);
  });

  it('ohne Rahmen und ohne Form keine Verknüpfung', () => {
    expect(mapLinkOf(kante({}))).toBeNull();
    expect(mapLinkOf(undefined)).toBeNull();
  });

  it('Zoomtiefe je Verknüpfung, in Grenzen; Unsinn ist keine Angabe', () => {
    expect(mapLinkOf(kante({ x: 0, y: 0, near: 0.3 }))!.near).toBe(0.3);
    expect(linkNearOf(5)).toBe(1);
    expect(linkNearOf(0.01)).toBe(0.1);
    expect(linkNearOf('x')).toBeUndefined();
    expect(linkNearOf(0)).toBeUndefined();
  });

  it('zoomStep nimmt die Zoomtiefe der Verknüpfung', () => {
    const frame = { x: 0.4, y: 0.4, w: 0.2, h: 0.2 };
    const nat = { w: 1000, h: 1000 };
    const viewport = { w: 1000, h: 1000 };
    /* Bei Zoom 2 füllt der Rahmen 40 % des Blicks: unter 0,55, über 0,3. */
    expect(frameNear(frame, nat, 2, viewport)).toBe(false);
    expect(frameNear(frame, nat, 2, viewport, 0.3)).toBe(true);
    const flach = zoomStep({ zoom: 2, direction: 1, children: [{ id: 'k', frame }], nat, viewport });
    expect(flach.kind).toBe('zoom');
    const tief = zoomStep({ zoom: 2, direction: 1, children: [{ id: 'k', frame, near: 0.3 }], nat, viewport });
    expect(tief).toEqual({ kind: 'enter', id: 'k' });
  });

  it('Anzeige: eigene Angabe, sonst Kampagne — für Leitung und Spielende getrennt', () => {
    const d = mapLinkDefaultsOf(kampagne({ mapLinkShow: 'frame', mapLinkShowPlayers: 'hidden', mapLinkOuter: 'faded' }));
    const l = mapLinkOf(kante({ x: 0, y: 0, showPlayers: 'icon' }))!;
    expect(linkShowFor(l, d, true)).toBe('frame');
    expect(linkShowFor(l, d, false)).toBe('icon');
    expect(linkOuterOn(l, d)).toBe(true);
    expect(linkOuterOn(mapLinkOf(kante({ x: 0, y: 0, outer: 'none' }))!, d)).toBe(false);
    expect(mapLinkDefaultsOf(kampagne({ mapLinkShow: 'quatsch' })).show).toBe('jump');
  });

  it('die Karte darüber liegt in der Unterkarte über den Kasten gerechnet', () => {
    const frame = { x: 0.25, y: 0.5, w: 0.5, h: 0.25 };
    const o = outerPlacement(frame);
    expect(o).toEqual({ x: -0.5, y: -2, w: 2, h: 4 });
    /* Eine Ecke der Unterkarte, gehoben, liegt dort, wo die Karte darüber sie zeichnet. */
    const p = liftPoint({ x: 1, y: 1 }, frame);
    expect(o.x + p.x * o.w).toBeCloseTo(1);
    expect(o.y + p.y * o.h).toBeCloseTo(1);
  });

  it('Ausgänge: nur die Karte darüber, und nur, wenn es sie gibt', () => {
    expect(mapExits([])).toEqual([]);
    expect(mapExits([{ id: 'a', name: 'Welt' }, { id: 'b', name: 'Region' }])).toEqual([{ kind: 'parent', id: 'b', name: 'Region' }]);
  });
});

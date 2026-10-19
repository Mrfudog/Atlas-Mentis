import { describe, expect, it } from 'vitest';
import {
  addWalls,
  carriedLight,
  carriedLights,
  figureView,
  inShape,
  itemLight,
  lightIsOff,
  mapLights,
  markersOf,
  setDoorState,
  setLightOff,
  type MapWall,
} from '../src/index.js';
import type { Entity, Relation } from '../src/types.js';

/* Sicht und Licht (T-305, REQ-140): Lichter an Gegenständen, in der Hand,
   an/aus; die Sicht bis zur Wand oder geschlossenen Tür; die Rechnung
   gemessen mit 200 Sperren. */

const nat = { w: 1000, h: 1000 };
const marker = (id: string, to: string, x: number, y: number, props: Record<string, unknown> = {}): Relation => ({
  id,
  type: 'marker',
  from: 'k1',
  to,
  props: { x, y, ...props },
});
const karte = (map: Record<string, unknown> = {}, relations: Relation[] = []): Entity => ({
  id: 'k1',
  interfaces: ['Map'],
  components: { Map: { gridShape: 'square', gridSize: 100, scale: '1,5 m', ...map } },
  relations,
});
const fackel: Entity = { id: 'fackel', interfaces: ['Item'], components: { Identity: { name: 'Torch' }, Item: { lightBright: '20', lightDim: '20 ft' } } };
const stueck: Entity = { id: 'stueck', interfaces: ['Item'], components: {}, relations: [{ id: 'i1', type: 'instanceOf', from: 'stueck', to: 'fackel' }] };
const beutel = (slot: string): Entity => ({
  id: 'inv',
  interfaces: ['Inventory'],
  components: {},
  relations: [{ id: 'h1', type: 'holds', from: 'inv', to: 'stueck', props: { slot } }],
});
const figur: Entity = { id: 'pc', interfaces: ['PlayerCharacter'], components: {}, relations: [{ id: 'c1', type: 'carries', from: 'pc', to: 'inv' }] };
const lookup = (...es: Entity[]) => new Map(es.map((e) => [e.id, e]));

describe('Lichter an Gegenständen (T-305)', () => {
  it('liest hell und dämmrig darüber hinaus, auch durch die Vorlage', () => {
    expect(itemLight(lookup(fackel), 'fackel')).toEqual({ bright: 20, dim: 40 });
    expect(itemLight(lookup(fackel, stueck), 'stueck')).toEqual({ bright: 20, dim: 40 });
    expect(itemLight(lookup({ ...fackel, components: { Item: { lightBright: '6 m' } } }), 'fackel')).toEqual({ bright: 20, dim: 20 });
    expect(itemLight(lookup({ ...fackel, components: { Item: {} } }), 'fackel')).toBeNull();
  });

  it('leuchtet in der Hand, nicht verstaut', () => {
    expect(carriedLight(lookup(fackel, stueck, beutel('mainHand'), figur), 'pc')).toEqual({ bright: 20, dim: 40 });
    expect(carriedLight(lookup(fackel, stueck, beutel('backpack'), figur), 'pc')).toBeNull();
  });

  it('eine Gruppe leuchtet wie ihr hellstes Mitglied', () => {
    const gruppe: Entity = { id: 'grp', interfaces: ['Party'], components: {} };
    const mitglied = { ...figur, relations: [...figur.relations!, { id: 'p1', type: 'memberOfParty', from: 'pc', to: 'grp' }] };
    expect(carriedLight(lookup(fackel, stueck, beutel('offHand'), mitglied, gruppe), 'grp')).toEqual({ bright: 20, dim: 40 });
  });

  it('ein Gegenstand als Marker leuchtet selbst; die Figur mit dem, was sie hält', () => {
    const k = karte({}, [marker('m1', 'fackel', 0.2, 0.2, { kind: 'scenery' }), marker('m2', 'pc', 0.7, 0.7, { kind: 'play' })]);
    const getragen = carriedLights(lookup(fackel, stueck, beutel('mainHand'), figur), k);
    expect(Object.keys(getragen).sort()).toEqual(['fackel', 'pc']);
    /* 20 ft sind vier Felder zu 5 ft (1,5 m), ein Feld ist 0,1 der Breite. */
    const l = mapLights(k, nat, getragen);
    expect(l.map((x) => x.id)).toEqual(['m1', 'm2']);
    expect(l[0]!.bright).toBeCloseTo(0.4);
    expect(l[0]!.dim).toBeCloseTo(0.8);
  });

  it('ein Radius an der Kante schlägt den des Gegenstands', () => {
    const k = karte({}, [marker('m1', 'fackel', 0.2, 0.2, { light: 1, dim: 2 })]);
    const l = mapLights(k, nat, { fackel: { bright: 20, dim: 40 } });
    expect(l[0]!.dim).toBeCloseTo(0.2);
  });

  it('`lightOff` macht das Licht aus, die Radien bleiben', () => {
    const k = karte({}, [marker('m1', 'x', 0.2, 0.2, { light: 2, dim: 4 })]);
    const aus = setLightOff(k, 'm1', true);
    expect(mapLights(aus, nat)).toEqual([]);
    expect(lightIsOff(markersOf(aus)[0]!.rel.props as Record<string, unknown>)).toBe(true);
    expect(markersOf(aus)[0]!.rel.props).toMatchObject({ light: 2, dim: 4 });
    const an = setLightOff(aus, 'm1', false);
    expect(mapLights(an, nat)).toHaveLength(1);
    expect(markersOf(an)[0]!.rel.props).not.toHaveProperty('lightOff');
    /* Auch das getragene Licht geht aus. */
    expect(mapLights(setLightOff(karte({}, [marker('m1', 'fackel', 0.2, 0.2)]), 'm1', true), nat, { fackel: { bright: 20, dim: 40 } })).toEqual([]);
  });
});

describe('Sicht bis zur Wand oder geschlossenen Tür (T-305)', () => {
  const tuer = (state: string): MapWall => ({ id: 't', kind: 'door', x1: 0.5, y1: 0, x2: 0.5, y2: 1, state: state as 'open' });
  const fenster: MapWall = { id: 'f', kind: 'window', x1: 0.5, y1: 0, x2: 0.5, y2: 1 };
  const sieht = (k: Entity, p: { x: number; y: number }) => figureView(k, { x: 0.2, y: 0.5 }, nat).seen.some((a) => inShape({ id: '', kind: 'poly', pts: a.pts }, p));

  it('die geschlossene Tür hält den Blick, die offene nicht, das Fenster nie', () => {
    const zu = addWalls(karte(), [tuer('closed')]);
    expect(sieht(zu, { x: 0.8, y: 0.5 })).toBe(false);
    expect(sieht(setDoorState(zu, 't', 'open'), { x: 0.8, y: 0.5 })).toBe(true);
    expect(sieht(addWalls(karte(), [fenster]), { x: 0.8, y: 0.5 })).toBe(true);
  });

  it('im Dunkeln: die eigene Fackel erhellt, was die Figur sieht — auch ohne Dunkelsicht', () => {
    const k = karte({ lighting: 'dark' }, [marker('m2', 'pc', 0.2, 0.5, { kind: 'play' })]);
    const v = figureView(k, { x: 0.2, y: 0.5 }, nat, 0, { pc: { bright: 20, dim: 40 } });
    expect(v.darkvision).toBeNull();
    expect(v.lights).toEqual(['m2']);
    expect(figureView(k, { x: 0.2, y: 0.5 }, nat, 0).seen).toEqual([]);
  });

  it('rechnet mit 200 Sperren schnell genug fürs Telefon', () => {
    /* 200 kurze Wände verstreut, dazu vier Lichter; gemessen wird eine
       ganze Sicht samt Lichtern. Am Rechner ein paar Millisekunden — am
       Telefon das Vier- bis Fünffache, und es läuft nur beim Ziehen. */
    const walls: MapWall[] = [];
    for (let i = 0; i < 200; i++) {
      const x = ((i * 37) % 97) / 100;
      const y = ((i * 53) % 89) / 100;
      walls.push({ id: `w${i}`, kind: 'wall', x1: x, y1: y, x2: x + 0.03, y2: y + 0.01 });
    }
    const k = addWalls(
      karte({ lighting: 'dark' }, [0.1, 0.3, 0.6, 0.9].map((x, i) => marker(`l${i}`, `l${i}`, x, 0.5, { light: 3, dim: 6 }))),
      walls,
    );
    figureView(k, { x: 0.5, y: 0.5 }, nat, 60);
    const t0 = performance.now();
    for (let i = 0; i < 5; i++) figureView(k, { x: 0.5, y: 0.5 }, nat, 60);
    const ms = (performance.now() - t0) / 5;
    expect(ms).toBeLessThan(60);
  });
});

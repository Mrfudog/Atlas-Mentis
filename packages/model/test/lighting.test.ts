import { describe, expect, it } from 'vitest';
import {
  addWalls,
  darkvisionFor,
  feetPerSquare,
  feetToFraction,
  figureView,
  inShape,
  litAreas,
  mapLighting,
  mapLights,
  mapSettings,
  revealSeenAlong,
  revealShapes,
  setLighting,
  type MapWall,
} from '../src/index.js';
import type { Entity, Relation } from '../src/types.js';

/** 1000 × 1000 Bildpunkte, ein Feld 100 px = 1,5 m: zehn Felder breit. */
const nat = { w: 1000, h: 1000 };

const marker = (
  id: string,
  to: string,
  x: number,
  y: number,
  props: Record<string, unknown> = {},
): Relation => ({
  id,
  type: 'marker',
  from: 'k1',
  to,
  props: { x, y, ...props },
});

const karte = (
  map: Record<string, unknown> = {},
  relations: Relation[] = [],
): Entity => ({
  id: 'k1',
  interfaces: ['Map'],
  components: {
    Map: { gridShape: 'square', gridSize: 100, scale: '1,5 m', ...map },
  },
  relations,
});

/** Eine Wand senkrecht bei x = 0,5 über die ganze Höhe. */
const trenn: MapWall = {
  id: 'w1',
  kind: 'wall',
  x1: 0.5,
  y1: 0,
  x2: 0.5,
  y2: 1,
};

describe('Helligkeit und Lichter (T-216, REQ-140)', () => {
  it('liest `Map.lighting`, ohne Angabe hell', () => {
    expect(mapLighting(karte())).toBe('bright');
    expect(mapLighting(karte({ lighting: 'dark' }))).toBe('dark');
    expect(mapLighting(karte({ lighting: 'quatsch' }))).toBe('bright');
    expect(mapLighting(setLighting(karte(), 'dim'))).toBe('dim');
  });

  it('ein Licht ist ein Marker mit Radius in Feldern; `dim` ist der ganze Radius', () => {
    const e = karte({}, [
      marker('m1', 'laterne', 0.2, 0.2, { light: 2, dim: 4 }),
      marker('m2', 'fass', 0.3, 0.3),
      marker('m3', 'kerze', 0.4, 0.4, { light: 1 }),
    ]);
    const l = mapLights(e, nat);
    expect(l.map((x) => x.id)).toEqual(['m1', 'm3']);
    expect(l[0]).toMatchObject({ bright: 0.2, dim: 0.4 });
    expect(l[1]).toMatchObject({ bright: 0.1, dim: 0.1 });
  });

  it('Licht hält an einer Wand, nicht an einem Fenster', () => {
    const mitWand = addWalls(
      karte({}, [marker('m1', 'l', 0.4, 0.5, { light: 3 })]),
      [trenn],
    );
    const [a] = litAreas(mitWand, nat);
    expect(a!.bright.every(([x]) => x <= 0.5 + 1e-6)).toBe(true);
    const mitFenster = addWalls(
      karte({}, [marker('m1', 'l', 0.4, 0.5, { light: 3 })]),
      [{ ...trenn, kind: 'window' }],
    );
    const [b] = litAreas(mitFenster, nat);
    expect(b!.bright.some(([x]) => x > 0.6)).toBe(true);
  });
});

describe('Massstab', () => {
  it('rechnet Felder in Fuss: 1,5 m sind 5 ft', () => {
    expect(feetPerSquare(mapSettings(karte()))).toBe(5);
    expect(feetPerSquare(mapSettings(karte({ scale: '10 ft' })))).toBe(10);
    expect(feetPerSquare(mapSettings(karte({ scale: 'irgendwas' })))).toBe(5);
    /* 60 ft sind zwölf Felder, ein Feld ist ein Zehntel der Breite. */
    expect(feetToFraction(karte(), nat, 60)).toBeCloseTo(1.2);
  });
});

describe('Was eine Figur sieht', () => {
  it('hell: bis zur Wand, ohne Radius', () => {
    const e = addWalls(karte(), [trenn]);
    const v = figureView(e, { x: 0.2, y: 0.5 }, nat);
    expect(v.seen).toHaveLength(1);
    expect(v.darkvision).toBeNull();
    const poly = { id: 'p', kind: 'poly' as const, pts: v.seen[0]!.pts };
    expect(inShape(poly, { x: 0.45, y: 0.9 })).toBe(true);
    expect(inShape(poly, { x: 0.7, y: 0.5 })).toBe(false);
  });

  it('dunkel: so weit die Dunkelsicht reicht, ohne sie nichts', () => {
    const e = karte({ lighting: 'dark' });
    expect(figureView(e, { x: 0.5, y: 0.5 }, nat).seen).toEqual([]);
    /* 30 ft = 6 Felder = 0,6 der Breite. */
    const v = figureView(e, { x: 0.5, y: 0.5 }, nat, 30);
    expect(v.darkvision).not.toBeNull();
    const poly = { id: 'p', kind: 'poly' as const, pts: v.darkvision! };
    expect(inShape(poly, { x: 0.5, y: 0.2 })).toBe(true);
    expect(inShape(poly, { x: 0.05, y: 0.05 })).toBe(false);
  });

  it('dunkel: ein Licht zählt, soweit man hineinsieht — durch eine Tür auch ohne die Laterne zu sehen', () => {
    const licht = marker('m1', 'laterne', 0.8, 0.2, { light: 1, dim: 6 });
    const offen = karte({ lighting: 'dark' }, [licht]);
    expect(figureView(offen, { x: 0.2, y: 0.5 }, nat).lights).toEqual(['m1']);
    /* Eine Wand mit Türöffnung bei y 0,6–0,8: die Laterne oben rechts sieht man
       nicht, ihren Schein auf dem Boden bei (0,6 / 0,7) durch die Tür schon. */
    const wand: MapWall[] = [
      { id: 'w1', kind: 'wall', x1: 0.5, y1: 0, x2: 0.5, y2: 0.6 },
      { id: 'w2', kind: 'wall', x1: 0.5, y1: 0.8, x2: 0.5, y2: 1 },
    ];
    const tuer = addWalls(offen, wand);
    const v = figureView(tuer, { x: 0.2, y: 0.7 }, nat);
    expect(v.lights).toEqual(['m1']);
    const flaeche = v.seen.find((a) => a.within)!;
    const form = { id: 'p', kind: 'poly' as const, pts: flaeche.pts, within: flaeche.within };
    expect(inShape(form, { x: 0.6, y: 0.7 })).toBe(true);
    /* Hinter der Wand, beleuchtet, aber nicht gesehen. */
    expect(inShape(form, { x: 0.8, y: 0.3 })).toBe(false);
    /* Ganz zu: nichts. */
    const zu = addWalls(offen, [trenn]);
    expect(figureView(zu, { x: 0.2, y: 0.5 }, nat).lights).toEqual([]);
  });

  it('ein Zug im Dunkeln deckt die Dunkelsicht auf, nicht die ganze Karte; doppelt nicht', () => {
    let n = 0;
    const id = () => `s-${++n}`;
    const e = karte({ lighting: 'dark', fog: true });
    const nach = revealSeenAlong(e, [{ x: 0.5, y: 0.5 }], nat, id, 'pc-1', 15);
    const formen = revealShapes(nach);
    expect(formen).toHaveLength(1);
    expect(formen[0]!.for).toBe('pc-1');
    expect(inShape(formen[0]!, { x: 0.5, y: 0.55 })).toBe(true);
    expect(inShape(formen[0]!, { x: 0.1, y: 0.1 })).toBe(false);
    expect(
      revealShapes(
        revealSeenAlong(nach, [{ x: 0.5, y: 0.5 }], nat, id, 'pc-1', 15),
      ),
    ).toHaveLength(1);
    /* Ohne Dunkelsicht und Licht bleibt es dunkel. */
    expect(
      revealShapes(
        revealSeenAlong(e, [{ x: 0.5, y: 0.5 }], nat, id, 'pc-1', 0),
      ),
    ).toHaveLength(0);
  });
});

describe('Dunkelsicht aus dem Statblock (D8)', () => {
  const alle = new Map<string, Entity>([
    [
      'pc-1',
      {
        id: 'pc-1',
        interfaces: ['PlayerCharacter'],
        components: {},
        relations: [
          { id: 'p1', type: 'memberOfParty', from: 'pc-1', to: 'g1' },
        ],
      },
    ],
    [
      'pc-2',
      {
        id: 'pc-2',
        interfaces: ['PlayerCharacter'],
        components: {},
        relations: [
          { id: 'p2', type: 'memberOfParty', from: 'pc-2', to: 'g1' },
        ],
      },
    ],
    ['g1', { id: 'g1', interfaces: ['Party'], components: {}, relations: [] }],
    [
      'sb-1',
      {
        id: 'sb-1',
        interfaces: ['Statblock'],
        components: {
          Statblock: { senses: 'darkvision 60 ft., passive Perception 12' },
        },
        relations: [{ id: 'b1', type: 'belongsTo', from: 'sb-1', to: 'pc-1' }],
      },
    ],
    [
      'vorlage',
      {
        id: 'vorlage',
        interfaces: ['Statblock'],
        components: { Statblock: { senses: 'Darkvision 120 ft.' } },
        relations: [],
      },
    ],
    [
      'sb-2',
      {
        id: 'sb-2',
        interfaces: ['Statblock'],
        components: { Statblock: {} },
        relations: [
          { id: 'b2', type: 'belongsTo', from: 'sb-2', to: 'pc-2' },
          { id: 'i2', type: 'instanceOf', from: 'sb-2', to: 'vorlage' },
        ],
      },
    ],
  ]);

  it('liest `senses`, auch durch eine Instanz hindurch', () => {
    expect(darkvisionFor(alle, 'pc-1')).toBe(60);
    expect(darkvisionFor(alle, 'pc-2')).toBe(120);
    expect(darkvisionFor(alle, 'niemand')).toBe(0);
  });

  it('eine Gruppe sieht so weit wie ihre Figur, die am weitesten sieht', () => {
    expect(darkvisionFor(alle, 'g1')).toBe(120);
  });
});

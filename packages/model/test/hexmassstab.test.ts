import { describe, expect, it } from 'vitest';
import {
  cellCentre,
  feetBetween,
  feetPerSquare,
  gridGeometry,
  HEX_TILE_H,
  hexTileSegments,
  mapSettings,
  measure,
  planGrid,
  scaleFeet,
  scaleLabel,
  setGrid,
  type Entity,
  type GridGeometry,
} from '../src/index.js';
import { units } from '../../registry/src/units.js';

/* Bildpunkte gleich Einheiten der Kachel: Feldbreite 100, Ursprung 0. */
const geo = gridGeometry({ ...mapSettings({ id: 'k', interfaces: ['Map'], components: {} } as Entity), gridShape: 'hex', gridSize: 100 }, { w: 1000, h: 1000 }) as GridGeometry;

const r3 = (v: number): number => Math.round(v * 1000) / 1000;
/* Auf ein Hundertstel: die Kachel steht auf drei Stellen gerundet im Pfad. */
const r2 = (v: number): number => Math.round(v * 100) / 100 + 0;
const punkt = (x: number, y: number): string => `${r2(x)},${r2(y)}`;
const kante = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** Ecken und Kanten der Hexe in Zeilen `rows` und Spalten `cols` (versetzte Zeilen, axial q = Spalte − ⌊Zeile/2⌋). */
function feld(cols: [number, number], rows: [number, number]) {
  const ecken = new Set<string>();
  const kanten = new Set<string>();
  const k = geo.rowHeight / 2;
  for (let r = rows[0]; r <= rows[1]; r++) {
    for (let c = cols[0]; c <= cols[1]; c++) {
      const m = cellCentre(geo, { x: c - Math.floor(r / 2), y: r });
      const cx = m.x * geo.w;
      const cy = m.y * geo.h;
      const es = [0, 1, 2, 3, 4, 5].map((i) => {
        const w = ((60 * i - 90) * Math.PI) / 180;
        return punkt(cx + k * Math.cos(w), cy + k * Math.sin(w));
      });
      es.forEach((e, i) => {
        ecken.add(e);
        kanten.add(kante(e, es[(i + 1) % 6]!));
      });
    }
  }
  return { ecken, kanten };
}

describe('Hexgitter: die Kachel zeichnet nur Kanten (T-321)', () => {
  const kachel = hexTileSegments();
  /* Die Kachel über das Feld gelegt, wie der Hintergrund sie wiederholt. */
  const roh: string[] = [];
  for (let i = -1; i <= 4; i++) {
    for (let j = -1; j <= 3; j++) {
      for (const s of kachel) roh.push(kante(punkt(s.x1 + 100 * i, s.y1 + HEX_TILE_H * j), punkt(s.x2 + 100 * i, s.y2 + HEX_TILE_H * j)));
    }
  }
  const gross = feld([-3, 7], [-3, 8]);

  it('ein Hex und die Senkrechte der versetzten Reihe — sieben Strecken', () => {
    expect(kachel).toHaveLength(7);
    expect(new Set(kachel.map((s) => kante(punkt(s.x1, s.y1), punkt(s.x2, s.y2)))).size).toBe(7);
  });

  it('jede Strecke endet an zwei Ecken und ist eine Kante — keine reicht ins Innere', () => {
    for (const k of roh) {
      const [a, b] = k.split('|') as [string, string];
      expect(gross.ecken.has(a), `${k}: ${a} ist keine Ecke`).toBe(true);
      expect(gross.ecken.has(b), `${k}: ${b} ist keine Ecke`).toBe(true);
      expect(gross.kanten.has(k), `${k} ist keine Hexkante`).toBe(true);
    }
  });

  it('ein 3×3-Feld: 38 Kanten (54 − 16 geteilte), jede gezeichnet, doppelt nur am Kachelrand (dort je eine Hälfte des Strichs)', () => {
    const { kanten } = feld([0, 2], [0, 2]);
    expect(kanten.size).toBe(38);
    const gezeichnet = new Set(roh);
    for (const k of kanten) expect(gezeichnet.has(k), `${k} fehlt`).toBe(true);
    const gesehen = new Set<string>();
    for (const k of roh) {
      if (gesehen.has(k)) {
        const [a, b] = k.split('|').map((p) => Number(p.split(',')[0]));
        expect(a, `${k} doppelt, aber nicht am Kachelrand`).toBe(b);
        expect(r3(a! % 100), `${k} doppelt, aber nicht am Kachelrand`).toBe(0);
      }
      gesehen.add(k);
    }
  });
});

describe('Massstab je Feld (T-321)', () => {
  it('Fuss je Feld aus Zahl und Einheit — mit und ohne Register', () => {
    for (const u of [undefined, units]) {
      expect(scaleFeet('5 ft', u)).toBe(5);
      expect(scaleFeet('10 feet', u)).toBe(10);
      expect(scaleFeet('1,5 m', u)).toBe(5);
      expect(scaleFeet('1 mile', u)).toBeCloseTo(5280);
      expect(scaleFeet('6 miles', u)).toBeCloseTo(31680);
      expect(scaleFeet('1 day', u)).toBeNull();
      expect(scaleFeet('', u)).toBeNull();
    }
    /* Was nur das Register kennt: Zoll, Meilen auf Deutsch. */
    expect(scaleFeet('60 in', units)).toBeCloseTo(5);
    expect(scaleFeet('2 Meilen', units)).toBeCloseTo(10560);
  });

  it('bestehende Karten rechnen wie vorher: „1,5 m" ist ein Feld von 5 ft', () => {
    const alt = mapSettings({ id: 'k', interfaces: ['Map'], components: { Map: { gridShape: 'square' } } } as Entity);
    expect(alt.scale).toBe('1,5 m');
    expect(feetPerSquare(alt)).toBe(5);
    expect(gridGeometry(alt, { w: 700, h: 700 })?.cellFeet).toBe(5);
    expect(feetPerSquare({ ...alt, scale: '7 zorp' })).toBe(5);
  });

  it('die Leiste sagt, was ein Feld ist', () => {
    expect(scaleLabel({ gridShape: 'hex', scale: '6 mi' })).toBe('1 hex = 6 mi');
    expect(scaleLabel({ gridShape: 'square', scale: '5 ft' })).toBe('1 square = 5 ft');
  });

  it('gesetzt im Gitter-Werkzeug, leer zurück auf die Vorgabe', () => {
    const e = { id: 'k', interfaces: ['Map'], components: { Map: { gridShape: 'hex' } } } as Entity;
    const mit = setGrid(e, { scale: ' 6 mi ' });
    expect(mapSettings(mit).scale).toBe('6 mi');
    expect(mapSettings(setGrid(mit, { scale: '' })).scale).toBe('1,5 m');
  });

  it('Bewegung, Reichweite und Messen rechnen im Massstab', () => {
    const s = { ...mapSettings({ id: 'k', interfaces: ['Map'], components: {} } as Entity), gridShape: 'square' as const, gridSize: 100, scale: '10 ft' };
    const g = gridGeometry(s, { w: 1000, h: 1000 })!;
    expect(g.cellFeet).toBe(10);
    expect(feetBetween(g, { x: 0.05, y: 0.05 }, { x: 0.35, y: 0.05 })).toBe(30);
    expect(planGrid(g, [], 'x')?.square).toBe(10);
    expect(measure({ ...s, gridShape: 'hex', scale: '6 mi' }, { w: 1000, h: 1000 }, { x: 0.05, y: 0.06 }, { x: 0.25, y: 0.06 }).text).toBe('2 hexes · 12 mi');
  });
});

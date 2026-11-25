/**
 * Der Nebel (REQ-139, T-204). Die Leitung meldete: in der Spielersicht ist
 * bei „Fog on" nichts zu sehen, auch das Aufgedeckte nicht. Der Nebel war
 * ein SVG-Rechteck mit `mask="url(#nebel-…)"`; unter `<base href="/">`
 * löst nicht jeder Browser den Verweis gegen das eigene Dokument auf, und
 * ohne Maske deckt das Rechteck alles zu. Jetzt zeichnet eine Leinwand:
 * erst alles zu, dann die Formen heraus.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DUNKEL_FARBE, grauMalen, NEBEL_FARBE, nebelBreite, nebelMalen, schichtMalen, type NebelForm, type NebelKontext } from '../src/app/karten/nebel';

/** Ein Kontext, der mitschreibt, was gezeichnet wird, mit welchem Modus. */
function aufnahme(): NebelKontext & { log: string[] } {
  const log: string[] = [];
  const k = {
    log,
    fillStyle: '' as unknown,
    strokeStyle: '' as unknown,
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    clearRect: (x: number, y: number, w: number, h: number) => log.push(`clear ${x} ${y} ${w} ${h}`),
    fillRect: (x: number, y: number, w: number, h: number) =>
      log.push(`fillRect ${k.globalCompositeOperation} a=${k.globalAlpha} ${x} ${y} ${w} ${h}`),
    beginPath: () => log.push('begin'),
    arc: (x: number, y: number, r: number) => log.push(`arc ${x} ${y} ${r}`),
    moveTo: (x: number, y: number) => log.push(`move ${x} ${y}`),
    lineTo: (x: number, y: number) => log.push(`line ${x} ${y}`),
    closePath: () => log.push('close'),
    fill: () => log.push(`fill ${k.globalCompositeOperation}`),
    stroke: () => log.push(`stroke ${k.globalCompositeOperation} w=${k.lineWidth}`),
    save: () => log.push('save'),
    restore: () => log.push('restore'),
    clip: () => log.push('clip'),
  };
  return k;
}

const leer = { x: 0, y: 0, w: 0, h: 0, r: 0, pts: [] as Array<readonly [number, number]> };

describe('Nebel als Leinwand (T-204)', () => {
  it('deckt erst alles zu und schneidet dann jede Form heraus', () => {
    const k = aufnahme();
    const formen: NebelForm[] = [
      { ...leer, id: 'a', tag: 'rect', x: 0.1, y: 0.1, w: 0.25, h: 0.2 },
      { ...leer, id: 'b', tag: 'circle', x: 0.5, y: 0.3, r: 0.05 },
      { ...leer, id: 'c', tag: 'polyline', r: 0.05, pts: [[0.5, 0.25], [0.75, 0.5]] },
    ];
    nebelMalen(k, 1000, 600, formen, 1);
    expect(k.log[0]).toBe('clear 0 0 1000 600');
    expect(k.log[1]).toBe('fillRect source-over a=1 0 0 1000 600');
    expect(k.log).toContain('fillRect destination-out a=1 100 100 250 200');
    expect(k.log).toContain('arc 500 300 50');
    expect(k.log).toContain('stroke destination-out w=100');
    expect(k.globalCompositeOperation).toBe('source-over');
  });

  it('die Leitung sieht halb hindurch, ausgeschnitten wird trotzdem ganz', () => {
    const k = aufnahme();
    nebelMalen(k, 512, 512, [{ ...leer, id: 'a', tag: 'rect', w: 0.5, h: 0.5 }], 0.5);
    expect(k.log[1]).toBe('fillRect source-over a=0.5 0 0 512 512');
    expect(k.log[2]).toBe('fillRect destination-out a=1 0 0 256 256');
    expect(NEBEL_FARBE).toMatch(/^#/);
  });

  it('ein Tupfer (ein Punkt) wird ein Kreis — eine Linie der Länge null zeichnet nichts', () => {
    const k = aufnahme();
    nebelMalen(k, 1000, 1000, [{ ...leer, id: 't', tag: 'polyline', r: 0.02, pts: [[0.4, 0.4]] }], 1);
    expect(k.log).toContain('arc 400 400 20');
    expect(k.log.some((l) => l.startsWith('stroke'))).toBe(false);
  });

  it('die Leinwand ist so breit wie das Bild, in Grenzen', () => {
    expect(nebelBreite(1400)).toBe(1400);
    expect(nebelBreite(100)).toBe(512);
    expect(nebelBreite(9000)).toBe(2048);
    expect(nebelBreite(0)).toBe(512);
  });

  it('die Karte zeichnet den Nebel ohne SVG-Maske mit url(#…)', () => {
    const quelle = readFileSync(resolve(__dirname, '../src/app/karten/karte.ts'), 'utf8');
    expect(quelle).not.toMatch(/mask\]?="'?url\(#/);
    expect(quelle).toContain('#nebelLeinwand');
  });
});

describe('Dunkelheit und laufende Sicht als Schicht (T-216)', () => {
  it('deckt mit der Stärke zu und schneidet je Schnitt einen Pfad heraus', () => {
    const k = aufnahme();
    const a: Array<readonly [number, number]> = [[0, 0], [0.5, 0], [0.5, 0.5]];
    const b: Array<readonly [number, number]> = [[0.2, 0.2], [0.6, 0.2], [0.6, 0.6]];
    schichtMalen(k, 100, 100, DUNKEL_FARBE, 0.9, [
      { formen: [a, b], staerke: 0.5 },
      { formen: [[[0, 0], [0.1, 0]]], staerke: 1 },
    ]);
    expect(k.log[1]).toBe('fillRect source-over a=0.9 0 0 100 100');
    /* Zwei Dämmerlichter, ein Pfad, eine Füllung — überlappend bleibt es Dämmerung. */
    expect(k.log.filter((x) => x === 'begin')).toHaveLength(1);
    expect(k.log.filter((x) => x.startsWith('fill destination-out'))).toHaveLength(1);
    expect(k.log.filter((x) => x === 'close')).toHaveLength(2);
    expect(k.globalCompositeOperation).toBe('source-over');
    expect(k.globalAlpha).toBe(1);
  });
});

describe('Licht hinter einer Klammer (T-216)', () => {
  it('füllt ein Polygon mit `clip` nur innerhalb der Klammer', () => {
    const k = aufnahme();
    const pts: Array<readonly [number, number]> = [[0, 0], [1, 0], [1, 1]];
    nebelMalen(k, 100, 100, [{ ...leer, id: 'l', tag: 'polygon', pts, clip: [[0, 0], [0.5, 0], [0.5, 0.5]] }], 1);
    const i = k.log.indexOf('save');
    expect(k.log.slice(i).filter((x) => ['save', 'clip', 'restore'].includes(x))).toEqual(['save', 'clip', 'restore']);
    expect(k.log.indexOf('clip')).toBeLessThan(k.log.indexOf('fill destination-out'));
  });
});

describe('Dunkelsicht in Graustufen (T-305)', () => {
  it('füllt die Dunkelsicht grau und schneidet die Lichter wieder heraus', () => {
    const k = aufnahme();
    const dv: Array<readonly [number, number]> = [[0, 0], [0.5, 0], [0.5, 0.5]];
    const licht: Array<readonly [number, number]> = [[0.1, 0.1], [0.2, 0.1], [0.2, 0.2]];
    grauMalen(k, 100, 100, [dv], [licht]);
    expect(k.log[0]).toBe('clear 0 0 100 100');
    expect(k.log).toContain('fill source-over');
    expect(k.log.indexOf('fill source-over')).toBeLessThan(k.log.indexOf('fill destination-out'));
    expect(k.globalCompositeOperation).toBe('source-over');
  });

  it('ohne Dunkelsicht bleibt die Leinwand leer', () => {
    const k = aufnahme();
    grauMalen(k, 100, 100, [], [[[0, 0], [1, 0], [1, 1]]]);
    expect(k.log).toEqual(['clear 0 0 100 100']);
  });
});

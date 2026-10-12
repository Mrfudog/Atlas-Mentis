import { describe, expect, it } from 'vitest';
import {
  anchorAt, cellKey, cheapestPath, currentMove, footprint, footprintCentre, footprintRing, pathVia, putMove,
  reachable, sharesSquare, sizeSpan, speedModes, speedPresets, statblockSize, stepFeet,
  type MoveGrid,
} from '../src/movement.js';
import { bestNotice, darkvisionOf, lightAt, lineOfSight, notices, pairsOf, spaceLineOfSight } from '../src/sight.js';

const offen = (cols = 10, rows = 10): MoveGrid => ({ cols, rows, walls: [] });

describe('Diagonalen 5-10-5 (D52)', () => {
  it('zählt die zweite Diagonale doppelt und die dritte wieder einfach', () => {
    let par: 0 | 1 = 0, ft = 0;
    for (let i = 0; i < 3; i++) { const s = stepFeet(true, par); ft += s.feet; par = s.parity; }
    expect(ft).toBe(20);
    expect(par).toBe(1);
  });

  it('rechnet drei Felder schräg zu 15 Fuss und vier zu 20', () => {
    expect(cheapestPath(offen(), { x: 0, y: 0 }, { x: 3, y: 3 })!.feet).toBe(20);
    expect(cheapestPath(offen(), { x: 0, y: 0 }, { x: 2, y: 2 })!.feet).toBe(15);
    expect(cheapestPath(offen(), { x: 0, y: 0 }, { x: 4, y: 4 })!.feet).toBe(30);
  });

  it('beginnt mit ungerader Parität teurer — die Zählung gehört zum Zug', () => {
    expect(cheapestPath(offen(), { x: 0, y: 0 }, { x: 1, y: 1 }, 0)!.feet).toBe(5);
    expect(cheapestPath(offen(), { x: 0, y: 0 }, { x: 1, y: 1 }, 1)!.feet).toBe(10);
  });

  it('führt die Parität über Wegpunkte weiter', () => {
    const r = pathVia(offen(), { x: 0, y: 0 }, [{ x: 1, y: 1 }, { x: 2, y: 2 }]);
    expect('feet' in r && r.feet).toBe(15);
    expect('legs' in r && r.legs).toEqual([5, 10]);
  });
});

describe('Wände, Kreaturen und Gelände', () => {
  it('geht um eine Wand herum', () => {
    /* Eine senkrechte Wand zwischen Spalte 0 und 1, Zeilen 0 bis 3. */
    const g: MoveGrid = { cols: 5, rows: 5, walls: [{ x1: 1, y1: 0, x2: 1, y2: 3 }] };
    const r = cheapestPath(g, { x: 0, y: 0 }, { x: 1, y: 0 })!;
    expect(r.cells.every((c) => c.y <= 3)).toBe(true);
    expect(r.feet).toBeGreaterThan(5);
    expect(r.cells.some((c) => c.y === 3)).toBe(true);
  });

  it('schneidet keine Ecke zwischen zwei Wänden', () => {
    const g: MoveGrid = { cols: 3, rows: 3, walls: [{ x1: 1, y1: 0, x2: 1, y2: 1 }, { x1: 1, y1: 1, x2: 2, y2: 1 }] };
    const r = cheapestPath(g, { x: 0, y: 0 }, { x: 1, y: 1 })!;
    expect(r.cells.length).toBeGreaterThan(2);
  });

  it('kommt durch Gegner nicht und bleibt auf Verbündeten nicht stehen', () => {
    const g: MoveGrid = { ...offen(3, 1), blocked: ['1,0'] };
    expect(cheapestPath(g, { x: 0, y: 0 }, { x: 2, y: 0 })).toBeNull();
    const h: MoveGrid = { ...offen(3, 1), noStop: ['1,0'] };
    expect(cheapestPath(h, { x: 0, y: 0 }, { x: 2, y: 0 })!.feet).toBe(10);
    expect(cheapestPath(h, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeNull();
  });

  it('zahlt schwieriges Gelände doppelt, auch schräg', () => {
    const g: MoveGrid = { ...offen(3, 3), cost: { '1,1': 2, '1,0': 2, '0,1': 2 } };
    expect(cheapestPath(g, { x: 0, y: 0 }, { x: 1, y: 1 })!.feet).toBe(10);
    /* Mit teurer Diagonale: zwei gerade Schritte (5 + 10) schlagen 20. */
    expect(cheapestPath({ ...offen(3, 3), cost: { '1,1': 2 } }, { x: 0, y: 0 }, { x: 1, y: 1 }, 1)!.feet).toBe(15);
  });

  it('meidet Gefahren auf einem längeren Weg und zählt ehrlich', () => {
    const g: MoveGrid = { ...offen(3, 3), avoid: ['1,0'] };
    const kurz = cheapestPath(g, { x: 0, y: 0 }, { x: 2, y: 0 })!;
    const gemieden = cheapestPath(g, { x: 0, y: 0 }, { x: 2, y: 0 }, 0, { avoid: true })!;
    expect(kurz.feet).toBe(10);
    expect(gemieden.avoided).toBe(0);
    expect(gemieden.feet).toBe(15);
  });
});

describe('Grösste Reichweite', () => {
  it('reicht mit 30 Fuss sechs Felder geradeaus und vier schräg', () => {
    const r = reachable(offen(12, 12), { x: 0, y: 0 }, 30);
    expect(r['6,0']).toBe(30);
    expect(r['7,0']).toBeUndefined();
    expect(r['4,4']).toBe(30);
    expect(r['5,5']).toBeUndefined();
  });
});

describe('Der Zug im Sitzungszustand', () => {
  it('fängt mit jedem Zug neu an', () => {
    const alt = [{ token: 't1', turn: 'enc:1:0', speed: 60, used: 25, parity: 1 as const }];
    expect(currentMove(alt, 't1', 'enc:1:0', 30)).toMatchObject({ speed: 60, used: 25, parity: 1 });
    expect(currentMove(alt, 't1', 'enc:2:0', 30)).toMatchObject({ speed: 30, used: 0, parity: 0 });
    expect(putMove(alt, { token: 't2', turn: 'x', speed: 30, used: 5, parity: 0 })).toHaveLength(2);
  });

  it('liest das Tempo aus dem Statblock', () => {
    expect(speedModes('30 ft., climb 20 ft., fly 60 ft. (hover)')).toEqual({ walk: 30, climb: 20, fly: 60 });
    expect(speedModes('40')).toEqual({ walk: 40 });
    expect(speedModes('9 m')).toEqual({ walk: 30 });
    const p = speedPresets({ walk: 30 });
    expect(p.map((x) => [x.key, x.feet])).toEqual([['walk', 30], ['dash', 60], ['climb', 15], ['swim', 15]]);
  });
});

describe('Sicht (REQ-209)', () => {
  const wand = [{ x1: 1, y1: -1, x2: 1, y2: 1 }];
  it('prüft die Sichtlinie gegen Wände', () => {
    expect(lineOfSight({ x: 0, y: 0 }, { x: 2, y: 0 }, wand)).toBe(false);
    expect(lineOfSight({ x: 0, y: 2 }, { x: 2, y: 2 }, wand)).toBe(true);
  });

  it('nimmt das Licht einer Zone vor dem der Lampe', () => {
    const lampe = [{ x: 0, y: 0, bright: 2, dim: 4 }];
    expect(lightAt({ x: 1, y: 0 }, 'dark', lampe, [])).toBe('bright');
    expect(lightAt({ x: 3, y: 0 }, 'dark', lampe, [])).toBe('dim');
    expect(lightAt({ x: 3, y: 0 }, 'dark', lampe, [{ x1: 2, y1: -1, x2: 2, y2: 1 }])).toBe('dark');
    expect(lightAt({ x: 1, y: 0 }, 'bright', lampe, [], 'dark')).toBe('dark');
  });

  it('zieht im Dämmerlicht 5 ab und sieht im Dunkeln nur mit Dunkelsicht', () => {
    const wache = { pp: 14, darkvision: 60 };
    expect(notices(wache, { los: true, light: 'bright', distanceFeet: 20, dc: 14 }).seen).toBe(true);
    expect(notices(wache, { los: true, light: 'dim', distanceFeet: 20, dc: 14 })).toMatchObject({ seen: false, pp: 9, why: 'stealth' });
    expect(notices(wache, { los: true, light: 'dark', distanceFeet: 20 })).toMatchObject({ seen: true, light: 'dim' });
    expect(notices({ pp: 14 }, { los: true, light: 'dark', distanceFeet: 20 })).toMatchObject({ seen: false, why: 'dark' });
    expect(notices(wache, { los: false, light: 'bright', distanceFeet: 5 }).why).toBe('wall');
    expect(darkvisionOf('darkvision 60 ft., passive Perception 10')).toBe(60);
  });
});

/* ---------- Kreaturgrössen (REQ-224, D58) ---------- */

describe('Der Platz nach Grösse (REQ-224)', () => {
  it('nimmt Felder nach den Regeln 2014', () => {
    expect(['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'].map(sizeSpan)).toEqual([1, 1, 1, 2, 3, 4]);
    expect(sizeSpan(undefined)).toBe(1);
    expect(sizeSpan('Large')).toBe(2);
    expect(sharesSquare('tiny')).toBe(true);
    expect(sharesSquare('small')).toBe(false);
  });

  it('speichert die Mitte und rechnet über die Ecke', () => {
    expect(footprintCentre({ x: 3, y: 4 }, 2)).toEqual({ x: 4, y: 5 });
    expect(anchorAt({ x: 4, y: 5 }, 2)).toEqual({ x: 3, y: 4 });
    expect(anchorAt({ x: 3.5, y: 4.5 }, 1)).toEqual({ x: 3, y: 4 });
    expect(anchorAt({ x: 4.5, y: 4.5 }, 3)).toEqual({ x: 3, y: 3 });
    expect(anchorAt({ x: 3.9999, y: 5.0001 }, 2)).toEqual({ x: 3, y: 4 });
    /* Am Rand geklemmt: der Platz liegt im Raster. */
    expect(anchorAt({ x: 0.5, y: 9.5 }, 4, 10, 10)).toEqual({ x: 0, y: 6 });
    expect(footprint({ x: 1, y: 1 }, 2).map(cellKey)).toEqual(['1,1', '2,1', '1,2', '2,2']);
    expect(footprintRing({ x: 1, y: 1 }, 2)).toHaveLength(12);
  });

  it('liest die Grösse vom Statblock, eine Instanz über ihre Vorlage', () => {
    const vorlage = { id: 'sb-oger', interfaces: ['Statblock'], components: { Statblock: { size: 'large' } } };
    const instanz = {
      id: 'sb-oger-1', interfaces: ['Statblock'], components: { Statblock: { hp: 50 } },
      relations: [{ id: 'r1', type: 'instanceOf', to: 'sb-oger' }],
    };
    const alle = new Map([[vorlage.id, vorlage], [instanz.id, instanz]]) as never;
    expect(statblockSize(alle, instanz as never)).toBe('large');
    expect(statblockSize(alle, null)).toBeNull();
  });
});

describe('Grosse Kreaturen im Bewegungsrechner (REQ-224)', () => {
  it('kommt als Large nicht durch eine Engstelle von einem Feld', () => {
    /* Eine Mauer von Zeile 0 bis 9 in Spalte 5, nur Feld (5,4) frei. */
    const blocked = Array.from({ length: 10 }, (_, y) => `5,${y}`).filter((k) => k !== '5,4');
    const g: MoveGrid = { ...offen(10, 10), blocked };
    expect(cheapestPath(g, { x: 3, y: 4 }, { x: 7, y: 4 })).not.toBeNull();
    expect(cheapestPath({ ...g, span: 2 }, { x: 2, y: 4 }, { x: 7, y: 4 })).toBeNull();
    /* Zwei Felder offen: jetzt passt der Oger. */
    const breit = blocked.filter((k) => k !== '5,5');
    expect(cheapestPath({ ...g, blocked: breit, span: 2 }, { x: 2, y: 4 }, { x: 7, y: 4 })!.feet).toBe(25);
  });

  it('hält eine Wand, die nur ein Feld des Platzes kreuzt', () => {
    /* Kurze Wand zwischen Spalte 2 und 3, nur in Zeile 1. */
    const g: MoveGrid = { cols: 6, rows: 4, walls: [{ x1: 3, y1: 1, x2: 3, y2: 2 }] };
    /* Ein Feld in Zeile 0 kommt geradeaus, ein 2 × 2 über Zeile 0–1 nicht. */
    expect(cheapestPath(g, { x: 1, y: 0 }, { x: 4, y: 0 })!.feet).toBe(15);
    const gross = cheapestPath({ ...g, span: 2 }, { x: 1, y: 0 }, { x: 3, y: 0 })!;
    expect(gross.feet).toBeGreaterThan(10);
    expect(gross.cells.some((c) => c.y === 2)).toBe(true);
  });

  it('steht nicht mit einer Wand im Bauch', () => {
    const g: MoveGrid = { cols: 4, rows: 4, walls: [{ x1: 2, y1: 0, x2: 2, y2: 1 }] };
    expect(cheapestPath({ ...g, span: 2 }, { x: 0, y: 2 }, { x: 1, y: 0 })).toBeNull();
    expect(cheapestPath({ ...g, span: 2 }, { x: 0, y: 2 }, { x: 2, y: 0 })).not.toBeNull();
  });

  it('zählt 5-10-5 auch für Huge und Gargantuan schräg', () => {
    expect(cheapestPath({ ...offen(12, 12), span: 3 }, { x: 0, y: 0 }, { x: 3, y: 3 })!.feet).toBe(20);
    expect(cheapestPath({ ...offen(12, 12), span: 4 }, { x: 0, y: 0 }, { x: 2, y: 2 })!.feet).toBe(15);
    /* Am Rand: ein Gargantuan-Anker bei (9,9) liegt nicht mehr im Raster. */
    expect(cheapestPath({ ...offen(12, 12), span: 4 }, { x: 0, y: 0 }, { x: 9, y: 9 })).toBeNull();
  });

  it('schneidet keine Ecke mit dem ganzen Platz', () => {
    /* Eine Ecke aus zwei Wänden bei (3,2): ein 2 × 2 bei (1,0) kommt nicht
       schräg nach (2,1), weil sein Feld (2,1) die Ecke streift. */
    const g: MoveGrid = { cols: 6, rows: 6, span: 2, walls: [{ x1: 3, y1: 0, x2: 3, y2: 2 }, { x1: 3, y1: 2, x2: 4, y2: 2 }] };
    expect(cheapestPath(g, { x: 1, y: 0 }, { x: 2, y: 1 })).toBeNull();
    const um = cheapestPath(g, { x: 0, y: 0 }, { x: 2, y: 2 })!;
    expect(um.feet).toBe(15);
  });

  it('zahlt nach dem teuersten neu betretenen Feld, nicht nach der Summe (D58)', () => {
    /* Schlamm (×2) nur auf (2,1): der Oger bei (0,0) betritt ihn mit dem Schritt nach (1,0). */
    const g: MoveGrid = { ...offen(6, 4), span: 2, cost: { '2,1': 2 } };
    expect(cheapestPath(g, { x: 0, y: 0 }, { x: 1, y: 0 })!.feet).toBe(10);
    /* Der nächste Schritt verlässt ihn nur — die Felder (3,0), (3,1) sind trocken. */
    expect(cheapestPath(g, { x: 1, y: 0 }, { x: 2, y: 0 })!.feet).toBe(5);
    /* Ein ganzer Streifen Schlamm kostet ×2 je Schritt, nicht ×4. */
    const streifen: MoveGrid = { ...offen(6, 4), span: 2, cost: { '2,0': 2, '2,1': 2 } };
    expect(cheapestPath(streifen, { x: 0, y: 0 }, { x: 1, y: 0 })!.feet).toBe(10);
  });

  it('wird vom ganzen Platz eines Gegners gesperrt und meidet seine Reichweite', () => {
    /* Ein Large-Gegner auf (2,0)–(3,1) in einem Gang von zwei Zeilen. */
    const feind = footprint({ x: 2, y: 0 }, 2).map(cellKey);
    const g: MoveGrid = { ...offen(6, 3), blocked: feind };
    expect(cheapestPath(g, { x: 0, y: 1 }, { x: 5, y: 1 })!.cells.every((c) => c.y === 2 || c.x < 2 || c.x > 3)).toBe(true);
    const ring = footprintRing({ x: 2, y: 0 }, 2).map(cellKey);
    expect(ring).toContain('4,2');
    expect(ring).toContain('1,2');
    const r = cheapestPath({ ...g, avoid: ring }, { x: 0, y: 1 }, { x: 5, y: 1 }, 0, { avoid: true })!;
    expect(r.avoided).toBeGreaterThan(0);
  });

  it('lässt durch Verbündete, aber nicht darauf stehen — ausser tiny', () => {
    const g: MoveGrid = { ...offen(4, 1), noStop: ['1,0'] };
    expect(cheapestPath(g, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeNull();
    expect(cheapestPath({ ...g, share: true }, { x: 0, y: 0 }, { x: 1, y: 0 })!.feet).toBe(5);
    /* Ein Large bleibt nicht so stehen, dass ein Verbündeter unter ihm steht. */
    const h: MoveGrid = { ...offen(6, 4), span: 2, noStop: ['3,1'] };
    expect(cheapestPath(h, { x: 0, y: 0 }, { x: 2, y: 0 })).toBeNull();
    expect(cheapestPath(h, { x: 0, y: 0 }, { x: 4, y: 0 })!.feet).toBe(20);
    expect(reachable(h, { x: 0, y: 0 }, 30)['2,0']).toBeUndefined();
    expect(reachable(h, { x: 0, y: 0 }, 30)['4,0']).toBe(20);
  });
});

describe('Sicht vom ganzen Platz (REQ-224)', () => {
  /* Eine Wand von (2,0) nach (2,2): ein Feld in Zeile 0–1 links sieht nicht
     nach rechts, ein Large über Zeile 1–2 schon — mit seiner unteren Hälfte. */
  const wand = [{ x1: 2, y1: 0, x2: 2, y2: 2 }];
  const ziel = [{ x: 4, y: 0 }];
  it('sieht um eine Ecke, wenn ein Feld des Platzes freie Sicht hat', () => {
    expect(spaceLineOfSight([{ x: 0, y: 1 }], ziel, wand)).toBe(false);
    expect(spaceLineOfSight(footprint({ x: 0, y: 1 }, 2), ziel, wand)).toBe(true);
    /* Und umgekehrt: das Ziel sieht den Oger. */
    expect(spaceLineOfSight(ziel, footprint({ x: 0, y: 1 }, 2), wand)).toBe(true);
  });

  it('nimmt das beste Paar und sagt sonst, woran es am knappsten scheiterte', () => {
    const pp = { pp: 12 };
    const res = pairsOf(footprint({ x: 0, y: 1 }, 2), ziel).map(([a, b]) =>
      notices(pp, { los: lineOfSight(a, b, wand), light: 'bright', distanceFeet: 20, dc: 14 }));
    expect(bestNotice(res)).toMatchObject({ seen: false, why: 'stealth' });
    const hell = pairsOf(footprint({ x: 0, y: 1 }, 2), ziel).map(([a, b]) =>
      notices(pp, { los: lineOfSight(a, b, wand), light: 'bright', distanceFeet: 20 }));
    expect(bestNotice(hell).seen).toBe(true);
    expect(bestNotice([])).toMatchObject({ seen: false, why: 'wall' });
  });
});

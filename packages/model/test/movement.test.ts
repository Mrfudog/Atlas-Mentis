import { describe, expect, it } from 'vitest';
import {
  cheapestPath, currentMove, pathVia, putMove, reachable, speedModes, speedPresets, stepFeet,
  type MoveGrid,
} from '../src/movement.js';
import { darkvisionOf, lightAt, lineOfSight, notices } from '../src/sight.js';

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

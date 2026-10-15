import { describe, expect, it } from 'vitest';
import {
  costOf,
  gridGeometry,
  hitChance,
  markerOf,
  planBudget,
  planGrid,
  planPath,
  planText,
  rangePair,
  tileFromAction,
  tilesFor,
  cleanStep,
  type PlanStep,
} from '../src/index.js';

describe('Zugplan (T-198)', () => {
  it('liest die Kosten aus der Art der Aktion', () => {
    expect(costOf('Bonus Action')).toBe('bonus');
    expect(costOf('Reaction')).toBe('reaction');
    expect(costOf('Action')).toBe('action');
    expect(costOf(undefined)).toBe('action');
  });

  it('rechnet die Trefferchance mit 1 und 20', () => {
    expect(hitChance(5, 15)).toBeCloseTo(0.55);
    expect(hitChance(0, 30)).toBeCloseTo(0.05);
    expect(hitChance(20, 5)).toBeCloseTo(0.95);
    expect(hitChance(5, 15, 'adv')).toBeCloseTo(1 - 0.45 ** 2);
    expect(hitChance(5, 15, 'dis')).toBeCloseTo(0.55 ** 2);
  });

  it('verbraucht Ressourcen und meldet, was nicht reicht', () => {
    const steps: PlanStep[] = [
      { id: 'a', kind: 'move', path: [{ x: 0, y: 0 }, { x: 1, y: 0 }], feet: 20 },
      { id: 'b', kind: 'act', tile: 'x', name: 'Scimitar', cost: 'action', target: 'g', targetName: 'Goblin' },
      { id: 'c', kind: 'act', tile: 'y', name: 'Second Wind', cost: 'bonus' },
    ];
    const { left, problems } = planBudget(steps, 30);
    expect(left).toEqual({ action: 0, bonus: 0, reaction: 1, movement: 10 });
    expect(problems).toEqual([]);
    expect(planText(steps)).toBe('Move 20 ft → Scimitar → Goblin → Bonus: Second Wind');
    const zuviel = planBudget([...steps, { id: 'd', kind: 'act', tile: 'x', name: 'Scimitar', cost: 'action' }], 30);
    expect(zuviel.problems).toHaveLength(1);
  });

  it('gibt mit Dash das Tempo noch einmal', () => {
    const { left } = planBudget([{ id: 'd', kind: 'act', tile: 'std:dash', name: 'Dash', cost: 'action' }], 30);
    expect(left.movement).toBe(60);
  });

  it('macht aus einem Angriff eine Kachel mit Reichweite', () => {
    const t = tileFromAction('a', 'Shortbow', 'Action', {
      kinds: ['ranged weapon'], ability: 'dex', toHit: 4, toHitFixed: false, toHitComputed: 4, damageDice: '1d6', damageBonus: 2,
      damageFixed: false, damage: '1d6 + 2', average: 5, damageType: 'piercing', extra: null, reach: null, range: '80/320', target: '', note: '',
    });
    expect(t).toMatchObject({ targeted: true, range: 80, longRange: 320, toHit: 4, group: 'attack' });
    expect(rangePair('30')).toEqual([30, null]);
  });

  it('hat immer den waffenlosen Schlag und die allgemeinen Aktionen', () => {
    const tiles = tilesFor({ str: 16, prof: 2 }, []);
    const faust = tiles.find((t) => t.id === 'std:unarmed')!;
    expect(faust.toHit).toBe(5);
    expect(faust.damage).toBe('4');
    expect(tiles.some((t) => t.id === 'std:dash')).toBe(true);
  });

  it('findet einen Weg um besetzte Felder, im Tempo', () => {
    const geo = gridGeometry({ gridShape: 'square', gridSize: 10, gridOffsetX: 0, gridOffsetY: 0, scale: '5 ft', baseHidden: false, baseGmOnly: false }, { w: 100, h: 100 })!;
    const ich = markerOf({ id: 'm1', type: 'marker', to: 'pc', props: { x: 0.05, y: 0.05 } });
    const er = markerOf({ id: 'm2', type: 'marker', to: 'gob', props: { x: 0.15, y: 0.05 } });
    const grid = planGrid(geo, [ich, er], 'm1')!;
    expect(grid.cols).toBe(10);
    const weg = planPath(grid, { x: 0, y: 0 }, { x: 2, y: 0 }, 30)!;
    expect(weg.path.some((c) => c.x === 1 && c.y === 0)).toBe(false);
    expect(weg.feet).toBe(15); // zwei Diagonalen: 5 + 10
    expect(planPath(grid, { x: 0, y: 0 }, { x: 9, y: 0 }, 30)).toBeNull();
  });

  it('nimmt aus dem Netz nur, was ein Schritt tragen darf', () => {
    expect(cleanStep({ kind: 'move', path: [{ x: 1, y: 1 }], feet: 5 }, 0)).toBeNull();
    expect(cleanStep({ kind: 'act', tile: 'std:dash', cost: 'nonsense', name: 'Dash', evil: 1 }, 0)).toEqual({
      id: 's1', kind: 'act', tile: 'std:dash', name: 'Dash', cost: 'action',
    });
  });
});

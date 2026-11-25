import { describe, expect, it } from 'vitest';
import { GROUND_FLOOR, addFloor, goThrough, passageEnds, passageOf, sightInto } from '../src/floors.js';
import { gridGeometry, mapSettings, markersOf } from '../src/map.js';
import {
  inPassage,
  landingSpots,
  mayUsePassage,
  passageArea,
  passageCostText,
  passageFeet,
  passageNeedsConfirm,
  passageRulesOf,
  passageUnder,
  tokensInPassage,
  withPassageArea,
} from '../src/passages.js';
import type { Entity, Relation } from '../src/types.js';


/** 1000 × 1000 Bildpunkte, Felder zu 100: Feld (x, y) hat seine Mitte bei 0.x5. */
const NAT = { w: 1000, h: 1000 };

function karte(rel: Relation[] = []): Entity {
  let e: Entity = {
    id: 'map-1',
    interfaces: ['Map'],
    components: { Map: { gridShape: 'square', gridSize: 100 }, Image: { image: 'a' } },
    relations: rel,
  };
  e = addFloor(e, 'up', { name: 'Upper' });
  return e;
}
const geo = (e: Entity) => gridGeometry(mapSettings(e), NAT)!;
const token = (id: string, x: number, y: number, floor?: string): Relation => ({
  id,
  type: 'marker',
  to: `npc-${id}`,
  props: { kind: 'play', x, y, ...(floor ? { floor } : {}) },
});
/** Eine Treppe über die Felder (1,1)–(2,2), oben über (6,6)–(7,7). */
const treppe: Relation = {
  id: 'p1',
  type: 'marker',
  to: 'map-1',
  props: {
    kind: 'passage',
    passage: 'stairs',
    x: 0.2,
    y: 0.2,
    toFloor: 'up',
    toX: 0.7,
    toY: 0.7,
    area: [[0.1, 0.1], [0.3, 0.1], [0.3, 0.3], [0.1, 0.3]],
    toArea: [[0.6, 0.6], [0.8, 0.6], [0.8, 0.8], [0.6, 0.8]],
  },
};

describe('Übergänge als Fläche (T-326)', () => {
  it('ein Punkt-Übergang liest sich als das eine Feld um seinen Punkt', () => {
    const e = karte([{ ...treppe, props: { kind: 'passage', x: 0.25, y: 0.25, toFloor: 'up', toX: 0.75, toY: 0.75 } }]);
    const ende = passageEnds(e, GROUND_FLOOR)[0]!;
    expect(ende.area).toBeNull();
    expect(passageArea(ende, geo(e))).toEqual([[0.2, 0.2], [0.3, 0.2], [0.3, 0.3], [0.2, 0.3]]);
    expect(inPassage(ende, { x: 0.25, y: 0.25 }, geo(e))).toBe(true);
    expect(inPassage(ende, { x: 0.35, y: 0.25 }, geo(e))).toBe(false);
    /* Ohne Gitter zählt nur der Punkt selbst, wie vor T-326. */
    expect(inPassage(ende, { x: 0.26, y: 0.25 }, null)).toBe(false);
    expect(inPassage(ende, { x: 0.25, y: 0.25 }, null)).toBe(true);
  });

  it('die Fläche enthält jedes Token darin, auch auf mehreren Feldern', () => {
    const e = karte([treppe, token('a', 0.15, 0.15), token('b', 0.25, 0.25), token('c', 0.45, 0.25), token('d', 0.15, 0.15, 'up')]);
    const ende = passageEnds(e, GROUND_FLOOR)[0]!;
    expect(tokensInPassage(e, ende, geo(e)).map((m) => m.rel.id)).toEqual(['a', 'b']);
    expect(passageUnder(passageEnds(e, GROUND_FLOOR), { x: 0.25, y: 0.15 }, geo(e))?.relId).toBe('p1');
  });

  it('das gespiegelte Ende oben hat die Zielfläche als Fläche', () => {
    const e = karte([treppe]);
    const oben = passageEnds(e, 'up')[0]!;
    expect(oben.mirrored).toBe(true);
    expect(oben.area).toEqual(treppe.props!['toArea']);
    expect(oben.toArea).toEqual(treppe.props!['area']);
  });

  it('Zielfelder: freie zuerst, das nächste am Zielpunkt zuerst; reicht es nicht, auch belegte', () => {
    const e = karte([treppe]);
    const ende = passageEnds(e, GROUND_FLOOR)[0]!;
    const spots = landingSpots(ende, geo(e), [{ x: 0.65, y: 0.65 }], 5);
    expect(spots).toHaveLength(5);
    /* Vier Felder in der Zielfläche, eines davon belegt. */
    expect(spots.slice(0, 3)).not.toContainEqual({ x: 0.65, y: 0.65 });
    expect(spots[3]).toEqual({ x: 0.65, y: 0.65 });
    expect(new Set(spots.slice(0, 4).map((p) => `${p.x},${p.y}`)).size).toBe(4);
    /* Ohne Gitter landet jeder auf dem Zielpunkt. */
    expect(landingSpots(ende, null, [], 2)).toEqual([{ x: 0.7, y: 0.7 }, { x: 0.7, y: 0.7 }]);
  });

  it('durchgehen setzt auf das genannte Feld der Zielfläche', () => {
    const e = karte([treppe, token('a', 0.15, 0.15)]);
    const ende = passageEnds(e, GROUND_FLOOR)[0]!;
    const neu = goThrough(e, 'a', ende, { x: 0.75, y: 0.65 })!;
    expect(markersOf(neu).find((m) => m.rel.id === 'a')).toMatchObject({ x: 0.75, y: 0.65 });
    expect(neu.relations!.find((r) => r.id === 'a')!.props!['floor']).toBe('up');
  });

  it('Sicht von innen: wer irgendwo in der Treppenfläche steht, sieht oben von der entsprechenden Stelle', () => {
    const e = karte([treppe, token('a', 0.15, 0.25)]);
    const s = sightInto(e, 'up');
    expect(s).toHaveLength(1);
    expect(s[0]!.from.x).toBeCloseTo(0.65);
    expect(s[0]!.from.y).toBeCloseTo(0.75);
    /* Neben der Fläche sieht niemand hinauf. */
    expect(sightInto(karte([treppe, token('a', 0.45, 0.25)]), 'up')).toEqual([]);
  });

  it('eine Fläche setzen und wegnehmen', () => {
    let e = karte([{ ...treppe, props: { kind: 'passage', x: 0.25, y: 0.25, toFloor: 'up' } }]);
    e = withPassageArea(e, 'p1', 'area', [[0.1, 0.1], [0.3, 0.1], [0.3, 0.3]]);
    expect(passageOf(e, e.relations!.find((r) => r.id === 'p1')!)!.area).toHaveLength(3);
    e = withPassageArea(e, 'p1', 'area', null);
    expect(passageOf(e, e.relations!.find((r) => r.id === 'p1')!)!.area).toBeNull();
  });
});

describe('Regeln eines Übergangs (T-326)', () => {
  const kampagne = (k: Record<string, unknown>): Entity => ({ id: 'c', interfaces: ['Campaign'], components: { Campaign: k } });

  it('ohne Angabe gilt, was vor T-326 galt: beide, jederzeit, kostenlos, wie ein Zug', () => {
    expect(passageRulesOf(null)).toEqual({ trigger: 'both', when: 'any', move: 'none', feet: null, action: 'none', confirm: 'moves' });
  });

  it('der Übergang schlägt die Kampagne', () => {
    const r = passageRulesOf(kampagne({ passageTrigger: 'gm', passageMove: 'half' }), { rules: { trigger: 'players', feet: 10 } });
    expect(r.trigger).toBe('players');
    expect(r.move).toBe('half');
    expect(passageFeet(r, 30)).toBe(10);
    expect(passageFeet({ move: 'half', feet: null }, 30)).toBe(15);
    expect(passageFeet({ move: 'square', feet: null }, 30, 10)).toBe(10);
  });

  it('wer, wann: die Leitung immer, ausser „nur Spielende"; Spielende nach Zug und Runde', () => {
    const r = passageRulesOf(kampagne({ passageWhen: 'turn' }));
    const aussen = { gm: false, combat: false, ownTurn: false, lastTurn: false };
    expect(mayUsePassage(r, { ...aussen, gm: true })).toBeNull();
    expect(mayUsePassage(r, aussen)).toBeNull();
    expect(mayUsePassage(r, { ...aussen, combat: true })).toBe('Only on your own turn.');
    expect(mayUsePassage(r, { ...aussen, combat: true, ownTurn: true })).toBeNull();
    expect(mayUsePassage({ ...r, when: 'roundEnd' }, { ...aussen, combat: true, ownTurn: true })).toMatch(/last turn/);
    expect(mayUsePassage({ ...r, trigger: 'gm' }, aussen)).toMatch(/Only the GM/);
    expect(mayUsePassage({ ...r, trigger: 'players' }, { ...aussen, gm: true })).toMatch(/Only players/);
  });

  it('Bestätigung und Kostensatz', () => {
    expect(passageNeedsConfirm({ confirm: 'moves' }, 'confirm')).toBe(true);
    expect(passageNeedsConfirm({ confirm: 'moves' }, 'free')).toBe(false);
    expect(passageNeedsConfirm({ confirm: 'always' }, 'free')).toBe(true);
    expect(passageNeedsConfirm({ confirm: 'never' }, 'confirm')).toBe(false);
    expect(passageCostText(passageRulesOf(null), 30)).toBe('free');
    expect(passageCostText({ ...passageRulesOf(null), move: 'half', action: 'bonus' }, 30)).toBe('15 ft and a bonus action');
  });
});

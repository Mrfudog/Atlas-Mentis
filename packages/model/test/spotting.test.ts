/**
 * **Bemerken unterwegs** (T-350, REQ-209): eine Figur geht einen Weg und
 * bemerkt Versteckte und versteckte Zonen, sobald Sicht, Licht und passive
 * Wahrnehmung reichen; beim Betreten einer Zone mit Wirkung steht eine
 * Zeile da. Erfundene Artikel.
 */
import { describe, expect, it } from 'vitest';
import { gridGeometry, hiddenOnMap, spotsAlong, zonesEntered, zoneLine, cellCentre, type Entity } from '../src/index.js';

const settings = { gridShape: 'square' as const, gridSize: 10, gridOffsetX: 0, gridOffsetY: 0, scale: '5 ft', baseHidden: false, baseGmOnly: false };
const nat = { w: 100, h: 100 };
const geo = gridGeometry(settings, nat)!;
const feld = (x: number, y: number) => cellCentre(geo, { x, y });
const weg = (...xs: number[]) => xs.map((x) => feld(x, 0));

const falle: Entity = { id: 'zk_pit', name: 'Pit', interfaces: ['ZoneKind'], components: { ZoneKind: { hiddenUntil: 13, damage: '2d6', damageType: 'bludgeoning', save: 'dex', saveDC: 12 } }, relations: [] };
const dornen: Entity = { id: 'zk_thorn', name: 'Thorns', interfaces: ['ZoneKind'], components: { ZoneKind: { moveCost: 2 } }, relations: [] };
const arten = new Map([falle, dornen].map((e) => [e.id, e]));

function karte(extra: Partial<Entity> = {}, rels: Entity['relations'] = []): Entity {
  return {
    id: 'map', name: 'Map', interfaces: ['Map'],
    components: { Map: { gridShape: 'square', gridSize: 10, scale: '5 ft' } },
    relations: [
      { id: 'me', type: 'marker', to: 'pc', props: { ...feld(0, 0) } },
      { id: 'gob', type: 'marker', to: 'goblin', props: { ...feld(6, 0), hidden: true, stealth: 14 } },
      { id: 'pit', type: 'zone', to: 'zk_pit', props: { kind: 'rect', x: 0.8, y: 0, w: 0.1, h: 0.1 } },
      { id: 'thorn', type: 'zone', to: 'zk_thorn', props: { kind: 'rect', x: 0.2, y: 0, w: 0.1, h: 0.1 } },
      ...(rels ?? []),
    ],
    ...extra,
  };
}

describe('T-350: was versteckt ist', () => {
  it('versteckte Marker mit Heimlichkeit und ungefundene versteckte Zonen', () => {
    const c = hiddenOnMap(karte(), arten, geo, 'me', () => null);
    expect(c.map((x) => [x.rel, x.kind, x.dc])).toEqual([
      ['gob', 'marker', 14],
      ['pit', 'zone', 13],
    ]);
  });

  it('ohne eigene Heimlichkeit zählt die der Kreatur; ohne beides bemerkt ihn niemand', () => {
    const k = karte({}, [{ id: 'cat', type: 'marker', to: 'cat', props: { ...feld(4, 4), hidden: true } }]);
    expect(hiddenOnMap(k, arten, geo, 'me', (to) => (to === 'cat' ? 16 : null)).find((x) => x.rel === 'cat')?.dc).toBe(16);
    expect(hiddenOnMap(k, arten, geo, 'me', () => null).some((x) => x.rel === 'cat')).toBe(false);
  });

  it('eine gefundene Zone ist nicht mehr versteckt', () => {
    const k = karte();
    k.relations = k.relations!.map((r) => (r.id === 'pit' ? { ...r, props: { ...r.props, found: true } } : r));
    expect(hiddenOnMap(k, arten, geo, 'me', () => null).some((x) => x.rel === 'pit')).toBe(false);
  });
});

describe('T-350: bemerken auf dem Weg', () => {
  const c = hiddenOnMap(karte(), arten, geo, 'me', () => null);

  it('reicht die passive Wahrnehmung, wird beides bemerkt — am ersten Feld des Wegs', () => {
    const s = spotsAlong(karte(), nat, arten, weg(0, 1, 2), { pp: 15 }, c);
    expect(s.map((x) => [x.rel, x.at, x.pp])).toEqual([
      ['gob', 1, 15],
      ['pit', 1, 15],
    ]);
  });

  it('zu niedrig: der Goblin (14) nicht, die Grube (13) schon', () => {
    const s = spotsAlong(karte(), nat, arten, weg(0, 1), { pp: 13 }, c);
    expect(s.map((x) => x.rel)).toEqual(['pit']);
  });

  it('eine Wand hält den Blick', () => {
    const k = karte({ components: { Map: { gridShape: 'square', gridSize: 10, scale: '5 ft', walls: [{ id: 'w', x1: 0.45, y1: 0, x2: 0.45, y2: 1, kind: 'wall' }] } } });
    expect(spotsAlong(k, nat, arten, weg(0, 1, 2), { pp: 20 }, c)).toEqual([]);
  });

  it('im Dämmerlicht −5; im Dunkeln nur mit Dunkelsicht', () => {
    const dim = karte({ components: { Map: { gridShape: 'square', gridSize: 10, scale: '5 ft', lighting: 'dim' } } });
    expect(spotsAlong(dim, nat, arten, weg(0, 1), { pp: 18 }, c).map((x) => [x.rel, x.pp])).toEqual([['pit', 13]]);
    expect(spotsAlong(dim, nat, arten, weg(0, 1), { pp: 19 }, c).map((x) => [x.rel, x.pp])).toEqual([
      ['gob', 14],
      ['pit', 14],
    ]);
    const dunkel = karte({ components: { Map: { gridShape: 'square', gridSize: 10, scale: '5 ft', lighting: 'dark' } } });
    expect(spotsAlong(dunkel, nat, arten, weg(0, 1), { pp: 20 }, c)).toEqual([]);
    expect(spotsAlong(dunkel, nat, arten, weg(0, 1), { pp: 20, darkvision: 60 }, c).map((x) => x.rel)).toEqual(['gob', 'pit']);
  });

  it('vom Start aus wird nichts geprüft: wer stehen bleibt, bemerkt nichts Neues', () => {
    expect(spotsAlong(karte(), nat, arten, weg(0), { pp: 30 }, c)).toEqual([]);
  });
});

describe('T-350: Zonen betreten (REQ-208)', () => {
  it('eine Zeile je Zone mit Wirkung, beim Hineingehen', () => {
    const z = zonesEntered(karte(), arten, weg(0, 1, 2, 3, 4, 5, 6, 7, 8, 9));
    expect(z.map((x) => [x.rel, x.at])).toEqual([['thorn', 2]]);
    expect(z[0]!.line).toBe('difficult terrain');
  });

  it('eine versteckte Zone nennt nur die Leitung', () => {
    const z = zonesEntered(karte(), arten, weg(7, 8), { gm: true });
    expect(z.map((x) => x.rel)).toEqual(['pit']);
    expect(z[0]!.line).toBe('2d6 bludgeoning, DEX save DC 12');
  });

  it('zoneLine sagt nichts, wenn die Art nichts tut', () => {
    expect(zoneLine({ light: 'dark' })).toBe('');
    expect(zoneLine({ moveCost: 3 })).toBe('movement ×3');
  });
});

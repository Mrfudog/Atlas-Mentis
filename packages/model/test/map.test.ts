import { describe, expect, it } from 'vitest';
import {
  mayMoveToken,
  cellAt,
  movedTokens,
  clearPlayTokens,
  placeTokens,
  turnOf,
  coverAll,
  coverArea,
  fogOn,
  frameRevealed,
  isRevealed,
  revealAll,
  revealArea,
  revealShapes,
  setFog,
  cellCentre,
  cellDistance,
  drawnSheets,
  frameShare,
  gridGeometry,
  liftPoint,
  lowerPoint,
  mapAncestors,
  mapSettings,
  mapSheets,
  markersOf,
  measure,
  moveMarker,
  parseScale,
  partyPosition,
  redactMap,
  mapRulesOf,
  revealFor,
  zoomStep,
  MAP_ZOOM_STEP,
  MAP_NEAR,
} from '../src/map.js';
import type { Entity, Relation } from '../src/types.js';

const karte = (id: string, map: Record<string, unknown> = {}, relations: Relation[] = [], image = 'as-1'): Entity => ({
  id,
  interfaces: ['Map'],
  name: id,
  components: { Identity: { name: id }, Map: map, Image: { image } },
  relations,
});
const marker = (id: string, to: string, props: Record<string, unknown>): Relation => ({ id, type: 'marker', to, props });
const drin = (to: string, props: Record<string, unknown>): Relation => ({ id: `in-${to}`, type: 'insideMap', to, props });

describe('sheets (REQ-130)', () => {
  it('keeps the base image first and hides it without dropping it', () => {
    const e = karte('m', { baseHidden: true, sheets: [{ id: 's1', name: 'Snow', image: 'as-2', opacity: 0.5 }] });
    expect(mapSheets(e).map((s) => s.id)).toEqual(['__base', 's1']);
    const gezeichnet = drawnSheets(e, true);
    expect(gezeichnet[0]).toMatchObject({ base: true, hidden: true });
    expect(gezeichnet[1]).toMatchObject({ id: 's1', opacity: 0.5, hidden: false });
  });
  it('leaves GM sheets out for players and lets a viewer switch a sheet off', () => {
    const e = karte('m', { sheets: [{ id: 'gm', image: 'as-2', gmOnly: true }, { id: 'p', image: 'as-3' }] });
    expect(drawnSheets(e, false).map((s) => s.id)).toEqual(['__base', 'p']);
    expect(drawnSheets(e, true, { p: false }).map((s) => s.id)).toEqual(['__base', 'gm']);
  });
});

describe('grid and measuring', () => {
  const nat = { w: 700, h: 700 };
  it('counts squares with every second diagonal double', () => {
    const s = mapSettings(karte('m', { gridShape: 'square', gridSize: 70, scale: '1,5 m' }));
    const geo = gridGeometry(s, nat)!;
    expect(cellAt(geo, { x: 0.05, y: 0.05 })).toEqual({ x: 0, y: 0 });
    expect(cellDistance(geo, { x: 0, y: 0 }, { x: 3, y: 3 })).toBe(4);
    const m = measure(s, nat, { x: 0.05, y: 0.05 }, { x: 0.45, y: 0.05 });
    expect(m).toMatchObject({ cells: 4, distance: 6, unit: 'm' });
    expect(m.text).toBe('4 squares · 6 m');
  });
  it('respects the offset', () => {
    const s = mapSettings(karte('m', { gridShape: 'square', gridSize: 70, gridOffsetX: 35 }));
    const geo = gridGeometry(s, nat)!;
    expect(cellAt(geo, { x: 0.06, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(cellAt(geo, { x: 0.04, y: 0 })).toEqual({ x: -1, y: 0 });
    expect(cellAt(geo, { x: 0.16, y: 0 })).toEqual({ x: 1, y: 0 });
  });
  it('finds hexes and their centres', () => {
    const s = mapSettings(karte('m', { gridShape: 'hex', gridSize: 70 }));
    const geo = gridGeometry(s, { w: 1000, h: 1000 })!;
    for (const c of [{ x: 0, y: 0 }, { x: 2, y: 1 }, { x: 1, y: 3 }, { x: -1, y: 4 }]) {
      expect(cellAt(geo, cellCentre(geo, c))).toEqual(c);
    }
    expect(cellDistance(geo, { x: 0, y: 0 }, { x: 2, y: 1 })).toBe(3);
  });
  it('measures straight without a grid, and nothing without a size', () => {
    const s = mapSettings(karte('m', { gridSize: 100, scale: '5 ft' }));
    expect(measure(s, { w: 1000, h: 500 }, { x: 0, y: 0 }, { x: 0.3, y: 0 })).toMatchObject({ cells: null, distance: 15, unit: 'ft' });
    expect(measure(s, null, { x: 0, y: 0 }, { x: 1, y: 1 }).text).toBe('');
  });
  it('reads a scale with a comma', () => {
    expect(parseScale('1,5 m')).toEqual({ value: 1.5, unit: 'm' });
    expect(parseScale('one league')).toBeNull();
  });
});

describe('sub-maps (REQ-131)', () => {
  const frame = { x: 0.5, y: 0.25, w: 0.2, h: 0.4 };
  it('lifts and lowers points through a frame', () => {
    const p = liftPoint({ x: 0.5, y: 0.5 }, frame);
    expect(p.x).toBeCloseTo(0.6);
    expect(p.y).toBeCloseTo(0.45);
    const q = lowerPoint(p, frame);
    expect(q.x).toBeCloseTo(0.5);
    expect(q.y).toBeCloseTo(0.5);
  });
  it('counts a missing viewport height as no measurement, not as zero', () => {
    const nat = { w: 1000, h: 1000 };
    expect(frameShare(frame, nat, 4, { w: 800, h: 0 })).toBeCloseTo(0.8);
    expect(frameShare(frame, nat, 4, { w: 800, h: 800 })).toBeCloseTo(0.8);
    expect(frameShare(frame, nat, 4, { w: 800, h: 2000 })).toBeCloseTo(0.64);
  });
  it('announces first and enters on the step after', () => {
    const nat = { w: 1000, h: 1000 };
    const viewport = { w: 800, h: 800 };
    const kinder = [{ id: 'k', frame: { x: 0.4, y: 0.4, w: 0.2, h: 0.2 } }];
    let zoom = 1;
    const schritte: string[] = [];
    for (let i = 0; i < 12; i += 1) {
      const s = zoomStep({ zoom, direction: 1, children: kinder, nat, viewport });
      if (s.kind === 'enter') {
        schritte.push('enter');
        break;
      }
      if (s.kind === 'zoom') zoom = s.zoom;
      schritte.push(frameShare(kinder[0]!.frame, nat, zoom, viewport) >= MAP_NEAR ? 'near' : 'zoom');
    }
    expect(schritte.at(-1)).toBe('enter');
    expect(schritte.at(-2)).toBe('near');
  });
  it('enters only where the focus is: cursor or centre of the view, inside the frame or its shape', () => {
    const nat = { w: 1000, h: 1000 };
    const viewport = { w: 800, h: 800 };
    /* Zwei Rahmen, beide füllen den Blick genug; der eine als Dreieck. */
    const kinder = [
      { id: 'links', frame: { x: 0.1, y: 0.1, w: 0.3, h: 0.3 } },
      { id: 'rechts', frame: { x: 0.6, y: 0.1, w: 0.3, h: 0.3 }, area: [[0.6, 0.1], [0.9, 0.1], [0.6, 0.4]] as Array<[number, number]> },
    ];
    const schritt = (focus: { x: number; y: number }) => zoomStep({ zoom: 4, direction: 1, children: kinder, nat, viewport, focus });
    expect(schritt({ x: 0.2, y: 0.2 })).toEqual({ kind: 'enter', id: 'links' });
    /* Neben jedem Rahmen: näher, nicht hinein — auch wenn beide den Blick füllen. */
    expect(schritt({ x: 0.5, y: 0.5 }).kind).toBe('zoom');
    /* Im Kasten des Dreiecks, aber ausserhalb der Form: nicht hinein. */
    expect(schritt({ x: 0.85, y: 0.35 }).kind).toBe('zoom');
    expect(schritt({ x: 0.65, y: 0.15 })).toEqual({ kind: 'enter', id: 'rechts' });
  });
  it('leaves for the map above when fully out', () => {
    expect(zoomStep({ zoom: 0.25, direction: -1, children: [], parent: 'p', nat: null, viewport: { w: 1, h: 1 } })).toEqual({ kind: 'leave', id: 'p' });
    expect(zoomStep({ zoom: 0.25, direction: -1, children: [], nat: null, viewport: { w: 1, h: 1 } })).toEqual({ kind: 'zoom', zoom: 0.25 });
  });
  it('stays on this map while the level is locked (REQ-132)', () => {
    const nat = { w: 1000, h: 1000 };
    const viewport = { w: 800, h: 800 };
    const kinder = [{ id: 'k', frame: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 } }];
    expect(zoomStep({ zoom: 2, direction: 1, children: kinder, nat, viewport }).kind).toBe('enter');
    expect(zoomStep({ zoom: 2, direction: 1, children: kinder, nat, viewport, locked: true })).toEqual({ kind: 'zoom', zoom: 2 * MAP_ZOOM_STEP });
    expect(zoomStep({ zoom: 0.25, direction: -1, children: [], parent: 'p', nat: null, viewport: { w: 1, h: 1 }, locked: true })).toEqual({ kind: 'zoom', zoom: 0.25 });
  });
  it('walks up to the outermost map and stops at a circle', () => {
    const welt = karte('welt');
    const land = karte('land', {}, [drin('welt', { x: 0, y: 0 })]);
    const stadt = karte('stadt', {}, [drin('land', { x: 0, y: 0 })]);
    const byId = new Map([welt, land, stadt].map((e) => [e.id, e]));
    expect(mapAncestors(byId, stadt).map((e) => e.id)).toEqual(['welt', 'land']);
    const a = karte('a', {}, [drin('b', { x: 0, y: 0 })]);
    const b = karte('b', {}, [drin('a', { x: 0, y: 0 })]);
    expect(mapAncestors(new Map([[a.id, a], [b.id, b]]), a).map((e) => e.id)).toEqual(['b']);
  });
});

describe('party token (REQ-136)', () => {
  it('shows the finest token, lifted through the frames', () => {
    const welt = karte('welt');
    const stadt = karte('stadt', {}, [drin('welt', { x: 0.5, y: 0.5, w: 0.1, h: 0.1 }), marker('t', 'pc-1', { x: 0.5, y: 0.5, kind: 'party' })]);
    const alt = karte('alt', {}, [marker('t2', 'pt-1', { x: 0.1, y: 0.1, kind: 'party' })]);
    const maps = new Map([welt, stadt, alt].map((e) => [e.id, e]));
    const p = partyPosition(maps, welt, new Set(['pt-1', 'pc-1']))!;
    expect(p.mapId).toBe('stadt');
    expect(p.direct).toBe(false);
    expect(p.x).toBeCloseTo(0.55);
    expect(partyPosition(maps, stadt, new Set(['pc-1']))).toMatchObject({ direct: true, x: 0.5 });
    expect(partyPosition(maps, welt, new Set(['niemand']))).toBeNull();
  });
});

describe('redactMap', () => {
  const e = karte(
    'm',
    { baseGmOnly: true, sheets: [{ id: 'gm', image: 'a', gmOnly: true }, { id: 'p', image: 'b' }] },
    [
      marker('offen', 'npc-1', { x: 0.1, y: 0.1 }),
      marker('versteckt', 'npc-1', { x: 0.2, y: 0.2, hidden: true }),
      marker('geheim', 'npc-2', { x: 0.3, y: 0.3 }),
      drin('oben', { x: 0, y: 0 }),
    ],
  );
  it('keeps everything for the GM', () => {
    expect(redactMap(e, { gm: true, sees: () => false })).toBe(e);
  });
  it('drops hidden markers, markers on unseen articles, GM sheets and the GM base image', () => {
    const r = redactMap(e, { gm: false, sees: (id) => id === 'npc-1' });
    expect(markersOf(r).map((m) => m.rel.id)).toEqual(['offen']);
    expect(r.relations!.some((x) => x.type === 'insideMap')).toBe(false);
    expect(mapSheets(r).map((s) => s.id)).toEqual(['__base', 'p']);
    expect(r.components['Image']).toBeUndefined();
  });
  it('moves a marker without touching its other props', () => {
    const m = moveMarker(e, 'offen', { x: 0.123456, y: 2 });
    expect(markersOf(m)[0]!.rel.props).toMatchObject({ x: 0.1235, y: 1 });
  });
});

describe('fog of war (REQ-139)', () => {
  const nebel = (reveal: unknown[], fog = true) =>
    karte('n', { fog, reveal }, [
      marker('licht', 'npc-1', { x: 0.1, y: 0.1 }),
      marker('dunkel', 'npc-2', { x: 0.8, y: 0.8 }),
      marker('gruppe', 'party-1', { x: 0.9, y: 0.9, kind: 'party' }),
      marker('figur', 'pc-1', { x: 0.7, y: 0.9 }),
    ]);
  it('reads every shape kind and tests points against it', () => {
    const e = nebel([
      { id: 'r', kind: 'rect', x: 0.2, y: 0.2, w: -0.1, h: -0.1 },
      { id: 'c', kind: 'circle', x: 0.5, y: 0.5, r: 0.1, ar: 0.5 },
      { id: 'p', kind: 'path', pts: [[0, 1], [1, 1]], r: 0.02, ar: 1 },
      { id: 'q', kind: 'poly', pts: [[0.6, 0], [0.7, 0], [0.7, 0.1]] },
      { id: 'kaputt', kind: 'poly', pts: [[0, 0]] },
    ]);
    const formen = revealShapes(e);
    expect(formen.map((s) => s.kind)).toEqual(['rect', 'circle', 'path', 'poly']);
    expect(formen[0]).toMatchObject({ x: 0.1, y: 0.1, w: 0.1, h: 0.1 });
    expect(isRevealed(e, { x: 0.15, y: 0.15 })).toBe(true);
    /* ar 0.5: die Karte ist halb so hoch wie breit, also reicht der Kreis
       in y doppelt so weit (in Anteilen). */
    expect(isRevealed(e, { x: 0.5, y: 0.68 })).toBe(true);
    expect(isRevealed(e, { x: 0.68, y: 0.5 })).toBe(false);
    expect(isRevealed(e, { x: 0.5, y: 0.99 })).toBe(true);
    expect(isRevealed(e, { x: 0.69, y: 0.05 })).toBe(true);
    expect(isRevealed(e, { x: 0.3, y: 0.3 })).toBe(false);
    expect(isRevealed(nebel([], false), { x: 0.3, y: 0.3 })).toBe(true);
  });
  it('withholds markers under the fog from players, but not their own', () => {
    const e = nebel([{ id: 'r', kind: 'rect', x: 0, y: 0, w: 0.5, h: 0.5 }]);
    const r = redactMap(e, { gm: false, sees: () => true, keep: (id) => id === 'pc-1' });
    expect(markersOf(r).map((m) => m.rel.id)).toEqual(['licht', 'gruppe', 'figur']);
    expect(markersOf(redactMap(e, { gm: true, sees: () => true }))).toHaveLength(4);
    expect(markersOf(redactMap(nebel([], false), { gm: false, sees: () => true }))).toHaveLength(4);
  });
  it('reveals, covers by centre, and keeps shapes when the fog is switched off', () => {
    let e = karte('n');
    e = revealArea(e, { id: 'a', kind: 'rect', x: 0.123456, y: 0, w: 0.2, h: 0.2 });
    e = revealArea(e, { id: 'b', kind: 'path', pts: [[0.7, 0.7], [0.9, 0.9]], r: 0.05, ar: 0.75 });
    expect(fogOn(e)).toBe(true);
    expect((e.components['Map'] as { reveal: unknown[] }).reveal[0]).toMatchObject({ x: 0.1235 });
    e = coverArea(e, { x: 0.6, y: 0.6, w: 0.4, h: 0.4 });
    expect(revealShapes(e).map((s) => s.id)).toEqual(['a']);
    e = setFog(e, false);
    expect(fogOn(e)).toBe(false);
    expect(revealShapes(e)).toHaveLength(1);
    expect(revealShapes(revealAll(e, 'all'))).toEqual([{ id: 'all', kind: 'rect', x: 0, y: 0, w: 1, h: 1 }]);
    expect(revealShapes(coverAll(e))).toEqual([]);
  });
  it('a frame counts as revealed when its centre or a corner is', () => {
    const e = nebel([{ id: 'r', kind: 'rect', x: 0, y: 0, w: 0.5, h: 0.5 }]);
    expect(frameRevealed(e, { x: 0.4, y: 0.4, w: 0.3, h: 0.3 })).toBe(true);
    expect(frameRevealed(e, { x: 0.6, y: 0.6, w: 0.3, h: 0.3 })).toBe(false);
  });
});

describe('play tokens and the turn (REQ-135, REQ-144)', () => {
  it('places only who has no token yet, in a block around the centre, and clears play tokens', () => {
    const e = karte('k', {}, [marker('da', 'a', { x: 0.1, y: 0.1 }), marker('fest', 'm', { x: 0.2, y: 0.2, kind: 'static' })]);
    const p = placeTokens(e, ['a', 'b', 'c', 'c'], { x: 0.5, y: 0.5 }, 0.1, 0.5, (to) => `t-${to}`);
    const neu = markersOf(p).filter((m) => m.kind === 'play');
    expect(neu.map((m) => m.to)).toEqual(['b', 'c']);
    expect(neu[0]).toMatchObject({ x: 0.45, y: 0.5 });
    expect(neu[1]).toMatchObject({ x: 0.55, y: 0.5 });
    expect(markersOf(clearPlayTokens(p)).map((m) => m.rel.id)).toEqual(['da', 'fest']);
  });
  it('names the current and the next participant, none before round 1', () => {
    const teil = (id: string, to: string, init: number): Relation => ({ id, type: 'participates', to, props: { init } });
    const enc: Entity = {
      id: 'e',
      interfaces: ['Encounter'],
      name: 'e',
      components: { Encounter: { round: 2, turn: 2 } },
      relations: [teil('p1', 'a', 5), teil('p2', 'b', 15), teil('p3', 'c', 10)],
    };
    const t = turnOf(new Map(), enc);
    expect([t.current?.to, t.next?.to]).toEqual(['a', 'b']);
    expect(turnOf(new Map(), { ...enc, components: { Encounter: { round: 0 } } })).toEqual({});
  });
});

describe('movedTokens (T-198, Runde 2)', () => {
  const karte = (x: number): Entity => ({
    id: 'm', name: 'm', interfaces: ['Map'], components: {},
    relations: [
      { id: 'r1', type: 'marker', to: 'pc', props: { x, y: 0.5, kind: 'static' } },
      { id: 'r2', type: 'marker', to: 'tree', props: { x, y: 0.5, kind: 'scenery' } },
      { id: 'r3', type: 'marker', to: 'gob', props: { x: 0.2, y: 0.2, kind: 'play' } },
    ],
  });
  it('zählt Teilnehmer und Spiel-Tokens, sonst nichts', () => {
    expect(movedTokens(karte(0.1), karte(0.3), new Set(['pc']))).toEqual(['pc']);
    expect(movedTokens(karte(0.1), karte(0.3), new Set())).toEqual([]);
    const ohneGob = { ...karte(0.1), relations: karte(0.1).relations!.filter((r) => r.id !== 'r3') };
    expect(movedTokens(karte(0.1), ohneGob, new Set())).toEqual(['gob']);
  });
});

describe('Nebel je Figur und Kartenregeln (T-204)', () => {
  const k = (felder: Record<string, unknown>): Entity => ({ id: 'k', interfaces: ['Campaign'], components: { Campaign: felder } });
  const karte = (map: Record<string, unknown> = {}): Entity => ({
    id: 'm',
    interfaces: ['Map'],
    components: {
      Map: {
        fog: true,
        reveal: [
          { id: 'a', kind: 'rect', x: 0, y: 0, w: 0.5, h: 0.5 },
          { id: 'b', kind: 'rect', x: 0.5, y: 0.5, w: 0.5, h: 0.5, for: 'pc_1' },
        ],
        ...map,
      },
    },
    relations: [{ id: 'mk', type: 'marker', to: 'cr_x', props: { x: 0.75, y: 0.75 } }],
  });

  it('liest die Regeln der Kampagne mit Vorgaben; die Karte schlägt beim Aufdecken die Kampagne', () => {
    expect(mapRulesOf(null)).toEqual({ fog: 'party', moves: 'free', tokenMove: 'own', revealOnMove: false, doors: 'players', tokenSizes: 'rules' });
    expect(mapRulesOf(k({ fog: 'player', moves: 'confirm', revealOnMove: true }))).toEqual({ fog: 'player', moves: 'confirm', tokenMove: 'own', revealOnMove: true, doors: 'players', tokenSizes: 'rules' });
    expect(mapRulesOf(k({ doors: 'gm' })).doors).toBe('gm');
    expect(mapRulesOf(k({ tokenSizes: 'tinyHalf' })).tokenSizes).toBe('tinyHalf');
    expect(mapRulesOf(k({ fog: 'quatsch' })).fog).toBe('party');
    expect(mapRulesOf(k({ revealOnMove: true }), karte({ revealOnMove: false })).revealOnMove).toBe(false);
    expect(mapRulesOf(k({}), karte({ revealOnMove: true })).revealOnMove).toBe(true);
  });

  it('wer zieht (T-290): jede Stufe nimmt die engere mit, `none` nichts', () => {
    expect(mapRulesOf(k({ tokenMove: 'allies' })).tokenMove).toBe('allies');
    expect(mapRulesOf(k({ tokenMove: 'quatsch' })).tokenMove).toBe('own');
    const wer = { own: new Set(['pc']), party: new Set(['pc', 'esel']), allies: new Set(['hund']) };
    const darf = (mode: Parameters<typeof mayMoveToken>[0]) => ['pc', 'esel', 'hund', 'gob'].filter((t) => mayMoveToken(mode, t, wer));
    expect(darf('none')).toEqual([]);
    expect(darf('own')).toEqual(['pc']);
    expect(darf('party')).toEqual(['pc', 'esel']);
    expect(darf('allies')).toEqual(['pc', 'esel', 'hund']);
    expect(darf('all')).toEqual(['pc', 'esel', 'hund', 'gob']);
  });

  it('hält `for` beim Lesen und Schreiben einer Form', () => {
    expect(revealShapes(karte()).map((s) => s.for)).toEqual([undefined, 'pc_1']);
    const neu = revealArea(karte(), { id: 'c', kind: 'circle', x: 0.2, y: 0.8, r: 0.1, ar: 1, for: 'pc_2' });
    expect(revealShapes(neu).at(-1)).toMatchObject({ id: 'c', for: 'pc_2' });
  });

  it('je Figur zählt nur das eigene und das für alle — je Gruppe alles', () => {
    expect(revealShapes(revealFor(karte(), 'player', () => false)).map((s) => s.id)).toEqual(['a']);
    expect(revealShapes(revealFor(karte(), 'player', (id) => id === 'pc_1')).map((s) => s.id)).toEqual(['a', 'b']);
    expect(revealShapes(revealFor(karte(), 'party', () => false)).map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('redactMap nimmt je Figur die fremden Formen und die Marker darunter heraus', () => {
    const fremd = redactMap(karte(), { gm: false, sees: () => true, fog: 'player', own: () => false });
    expect(revealShapes(fremd).map((s) => s.id)).toEqual(['a']);
    expect(markersOf(fremd)).toHaveLength(0);
    const eigen = redactMap(karte(), { gm: false, sees: () => true, fog: 'player', own: (id) => id === 'pc_1' });
    expect(markersOf(eigen)).toHaveLength(1);
    expect(revealShapes(redactMap(karte(), { gm: true, sees: () => true, fog: 'player' }))).toHaveLength(2);
  });
});

describe('placing on the map (T-301)', () => {
  it('groups by name and puts the creature first, then the statblock, then the image', async () => {
    const { placementGroups } = await import('../src/index.js');
    const chain = (t: string) => (t === 'PlayerCharacter' ? ['PlayerCharacter', 'Creature'] : [t]);
    const g = placementGroups(
      [
        { id: 'a1', name: '"The Demogorgon" (token)', type: 'Asset' },
        { id: 's1', name: 'The Demogorgon', type: 'Statblock' },
        { id: 'c1', name: '"The Demogorgon"', type: 'Creature' },
        { id: 'i1', name: 'Goblin', type: 'Item' },
        { id: 's2', name: 'The Demogorgon (MTF)', type: 'Statblock' },
        { id: 'r1', name: 'Goblin (legendary group)', type: 'Rule' },
      ],
      chain,
    );
    expect(g.map((x) => x.best.id)).toEqual(['c1', 'i1', 'r1']);
    expect(g[0]!.others.map((x) => x.id)).toEqual(['s1', 's2', 'a1']);
  });
  it('removes one marker and nothing else', async () => {
    const { removeMarker, MARKER_RELATION } = await import('../src/index.js');
    const karte = {
      id: 'm',
      interfaces: ['Map'],
      name: 'm',
      components: {},
      relations: [
        { id: 'r1', type: MARKER_RELATION, to: 'a', props: { x: 0.1, y: 0.1 } },
        { id: 'r2', type: MARKER_RELATION, to: 'b', props: { x: 0.2, y: 0.2 } },
        { id: 'r3', type: 'inLayer', to: 'ly', props: {} },
      ],
    };
    expect(removeMarker(karte, 'r1').relations.map((r) => r.id)).toEqual(['r2', 'r3']);
  });
});

import { describe, expect, it } from 'vitest';
import {
  isStructurePlacement,
  mergeStructure,
  netLayout,
  STRUCTURE_DEFAULT_EDGES,
  STRUCTURE_DEPTH,
  structureGraph,
  structureLabels,
  structureSpecOf,
  structureTileOf,
} from '../src/structure.js';
import { isQueryPlacement } from '../src/boardquery.js';
import type { Entity, Relation } from '../src/types.js';

/* Erfundene Artikel: eine Fraktion mit Zweig, Mitgliedern, einem Ort und einer Beziehung. */
const artikel = (id: string, typ: string, rel: Relation[] = []): Entity => ({
  id,
  name: id,
  interfaces: [typ],
  components: { Identity: { name: id } },
  relations: rel,
});
const k = (id: string, type: string, to: string, props: Record<string, unknown> = {}): Relation => ({ id, type, to, props });

const bestand: Entity[] = [
  artikel('Wacht', 'Faction', [k('w-c', 'controls', 'Turm'), k('w-r', 'regards', 'Gilde', { tags: ['distrust', 'owes us'] })]),
  artikel('Zirkel', 'Faction', [k('z-p', 'partOf', 'Wacht')]),
  artikel('Gilde', 'Faction', [k('g-r', 'regards', 'Wacht', { tags: ['useful'] })]),
  artikel('Ada', 'Creature', [k('a-m', 'memberOf', 'Wacht', { rank: 'Captain' })]),
  artikel('Bo', 'Creature', [k('b-m', 'memberOf', 'Zirkel', { rank: 'Novice' })]),
  artikel('Turm', 'Place'),
  artikel('Keller', 'Place', [k('k-p', 'partOf', 'Turm')]),
  /* Ein Stück und eine Kante ins Leere zählen nicht. */
  artikel('Kopie', 'Creature', [k('c-i', 'instanceOf', 'Ada'), k('c-m', 'memberOf', 'Wacht')]),
  artikel('Geist', 'Creature', [k('g-m', 'memberOf', 'Fehlt')]),
];
const spec = (extra: Partial<ReturnType<typeof structureSpecOf>> = {}) => ({ ...structureSpecOf({ root: 'Wacht' }), ...extra });

describe('Struktur (T-341)', () => {
  it('liest die Frage mit Vorgaben und Grenzen', () => {
    expect(structureSpecOf(undefined)).toEqual({ root: '', edges: [...STRUCTURE_DEFAULT_EDGES], layout: 'tree', depth: STRUCTURE_DEPTH.default });
    expect(structureSpecOf({ root: ' x ', edges: ['memberOf', 'nope', 'memberOf'], layout: 'net', depth: 99 })).toEqual({
      root: 'x',
      edges: ['memberOf'],
      layout: 'net',
      depth: STRUCTURE_DEPTH.max,
    });
    expect(structureSpecOf({ depth: 0, layout: 'kreis', edges: [] }).depth).toBe(STRUCTURE_DEPTH.min);
    expect(structureSpecOf({ layout: 'kreis' }).layout).toBe('tree');
  });

  it('erkennt die Kachel an ihrer Frage und hält sie von der Abfrage-Kachel getrennt', () => {
    const rel = k('s1', 'placed', 'b1', { title: 'Watch', structure: { root: 'Wacht' } });
    expect(isStructurePlacement(rel)).toBe(true);
    expect(isQueryPlacement(rel)).toBe(false);
    expect(structureTileOf(rel)?.title).toBe('Watch');
    expect(isStructurePlacement(k('s2', 'placed', 'x', { structure: [] }))).toBe(false);
    expect(isStructurePlacement(k('s3', 'partOf', 'x', { structure: {} }))).toBe(false);
    expect(structureTileOf(k('s4', 'placed', 'x'))).toBeNull();
  });

  it('beschriftet mit Marken, sonst Rang, sonst der Kantenart', () => {
    expect(structureLabels(k('1', 'regards', 'x', { tags: ['a', 'b'] }))).toEqual(['a', 'b']);
    expect(structureLabels(k('2', 'memberOf', 'x', { rank: 'Captain' }))).toEqual(['Captain']);
    expect(structureLabels(k('3', 'memberOf', 'x', { rank: 2 }))).toEqual(['rank 2']);
    expect(structureLabels(k('4', 'partOf', 'x', { rank: 2 }))).toEqual(['part of']);
    expect(structureLabels(k('5', 'controls', 'x'))).toEqual(['controls']);
  });

  it('baut den Baum vom Startartikel, in beide Richtungen, bis zur Tiefe', () => {
    const g = structureGraph(bestand, spec())!;
    const tief = Object.fromEntries(g.nodes.map((n) => [n.id, n.depth]));
    expect(tief).toEqual({ Wacht: 0, Ada: 1, Gilde: 1, Turm: 1, Zirkel: 1, Bo: 2, Keller: 2 });
    expect(g.nodes.find((n) => n.id === 'Bo')?.parent).toBe('Zirkel');
    /* Stück und Kante ins Leere fehlen. */
    expect(g.nodes.some((n) => n.id === 'Kopie' || n.id === 'Geist')).toBe(false);
    /* Beide Richtungen von regards sind eigene Linien mit eigenen Marken. */
    const gegen = g.links.filter((l) => l.type === 'regards');
    expect(gegen.map((l) => [l.from, l.to, l.labels])).toEqual(
      expect.arrayContaining([
        ['Wacht', 'Gilde', ['distrust', 'owes us']],
        ['Gilde', 'Wacht', ['useful']],
      ]),
    );
    /* Eine davon hängt Gilde in den Baum, die andere läuft quer. */
    expect(gegen.filter((l) => l.tree)).toHaveLength(1);
    expect(g.truncated).toBe(false);
  });

  it('sagt an der Grenze, dass es weitergeht, und wie herum die Linie zeigt', () => {
    const g = structureGraph(bestand, spec({ depth: 1 }))!;
    expect(g.nodes.find((n) => n.id === 'Zirkel')?.more).toBe(true);
    expect(g.nodes.find((n) => n.id === 'Ada')?.more).toBe(false);
    /* Vom Zirkel aus ist die Wacht übergeordnet: die Linie zeigt hinauf. */
    const vomZirkel = structureGraph(bestand, { ...spec(), root: 'Zirkel', depth: 1 })!;
    expect(vomZirkel.links.find((l) => l.id === 'z-p')).toMatchObject({ tree: true, up: true });
    expect(g.links.find((l) => l.id === 'z-p')).toMatchObject({ tree: true, up: false });
  });

  it('folgt nur den gewählten Kanten', () => {
    const g = structureGraph(bestand, spec({ edges: ['memberOf'] }))!;
    expect(g.nodes.map((n) => n.id).sort()).toEqual(['Ada', 'Wacht']);
  });

  it('sieht nur, was es bekommt: ein verborgener Knoten nimmt mit, was nur über ihn erreichbar war', () => {
    const gesiebt = bestand.filter((e) => e.id !== 'Zirkel');
    const g = structureGraph(gesiebt, spec())!;
    expect(g.nodes.some((n) => n.id === 'Zirkel' || n.id === 'Bo')).toBe(false);
    expect(g.links.some((l) => l.from === 'Zirkel' || l.to === 'Zirkel')).toBe(false);
    /* Ohne Startartikel keine Struktur. */
    expect(structureGraph(gesiebt, { ...spec(), root: 'Zirkel' })).toBeNull();
    expect(structureGraph(bestand, { ...spec(), root: 'Kopie' })).toBeNull();
  });

  it('hört bei der Grenze auf und sagt es', () => {
    const g = structureGraph(bestand, spec(), { limit: 3 })!;
    expect(g.nodes).toHaveLength(3);
    expect(g.truncated).toBe(true);
  });

  it('ordnet das Netz in Ringen und legt Aufgeklapptes dazu', () => {
    const g = structureGraph(bestand, spec({ depth: 1 }))!;
    const pos = netLayout(g, 100);
    expect(pos.get('Wacht')).toEqual({ x: 0, y: 0 });
    for (const n of g.nodes.filter((x) => x.depth === 1)) {
      const p = pos.get(n.id)!;
      expect(Math.round(Math.hypot(p.x, p.y))).toBeGreaterThanOrEqual(99);
    }
    const mehr = structureGraph(bestand, { ...spec(), root: 'Zirkel', depth: 1 })!;
    const zusammen = mergeStructure(g, mehr);
    expect(zusammen.nodes.find((n) => n.id === 'Bo')).toMatchObject({ depth: 2, parent: 'Zirkel' });
    expect(zusammen.nodes.find((n) => n.id === 'Zirkel')?.more).toBe(false);
    expect(zusammen.links.some((l) => l.id === 'b-m')).toBe(true);
    expect(zusammen.root).toBe('Wacht');
  });
});

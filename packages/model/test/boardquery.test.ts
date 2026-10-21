import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import {
  boardQueryOf,
  drawNext,
  isQueryPlacement,
  keepDrawState,
  queryIsEmpty,
  queryPool,
  queryTileOf,
  redactQueryTiles,
  storedQuery,
} from '../src/boardquery.js';
import { articleDimensions } from '../src/transform.js';
import type { Entity, Relation } from '../src/types.js';

/* Erfundene Artikel: zwei Gerüchte, eine Information, ein Ort. */
const artikel = (id: string, typ: string, name: string, extra: Record<string, unknown> = {}, rel: Relation[] = []): Entity => ({
  id,
  name,
  interfaces: [typ],
  components: { Identity: { name, id: `${typ.toLowerCase()}-${id}` }, ...extra },
  relations: rel,
});
const ebene = (id: string): Relation => ({ id: `${id}-in`, type: 'inLayer', to: 'ly_k', props: {} });

const bestand: Entity[] = [
  artikel('n1', 'Quest', 'The miller lies', { Tags: { tags: ['rumour'] }, Status: { status: 'ready' } }, [ebene('n1')]),
  artikel('n2', 'Quest', 'A ghost at the well', { Tags: { tags: ['rumour'] }, Status: { status: 'idea' } }),
  artikel('i1', 'Information', 'The true name', {}, [ebene('i1')]),
  artikel('o1', 'Location', 'Mill', { Tags: { tags: ['rumour'] } }),
  { ...artikel('n3', 'Quest', 'Copy'), relations: [{ id: 'x', type: 'instanceOf', to: 'n1', props: {} }] },
  artikel('b1', 'Board', 'Board'),
];
const dims = articleDimensions(seedRegistry);
const kachel = (props: Record<string, unknown>): Relation => ({ id: 'q1', type: 'placed', to: 'b1', props });

describe('Abfrage-Kachel (T-340)', () => {
  it('erkennt die Kachel an ihrer Quelle und liest die Vorgaben', () => {
    expect(isQueryPlacement(kachel({ query: {} }))).toBe(true);
    expect(isQueryPlacement({ id: 'a', type: 'placed', to: 'n1', props: { x: 1 } })).toBe(false);
    const t = queryTileOf(kachel({ query: { types: ['Quest', 'Quest', ''] }, interval: 1, display: 'blob' }))!;
    expect(t.query.types).toEqual(['Quest']);
    expect(t.display).toBe('list');
    expect(t.interval).toBe(2);
    expect(t.drawn).toEqual([]);
  });

  it('bringt nichts aus einer leeren Quelle — nicht das ganze Kompendium', () => {
    expect(queryIsEmpty(boardQueryOf({}))).toBe(true);
    expect(queryPool(seedRegistry, boardQueryOf({}), bestand, dims).rows).toEqual([]);
    /* Eine Kette mit nur einer Sortierung sagt auch nichts. */
    expect(queryIsEmpty(boardQueryOf({ steps: 'sort:name' }))).toBe(true);
  });

  it('verknüpft Art und Marke mit „und“, nimmt einzelne Artikel dazu, ohne Instanzen und Board', () => {
    const q = boardQueryOf({ types: ['Quest'], tags: ['rumour'], articles: ['i1', 'b1'] });
    const ids = queryPool(seedRegistry, q, bestand, dims, { exclude: 'b1' }).rows.map((e) => e.id);
    expect(ids.sort()).toEqual(['i1', 'n1', 'n2']);
  });

  it('filtert mit der Kette, aber nie die einzeln genannten', () => {
    const q = boardQueryOf({ tags: ['rumour'], articles: ['n2'], steps: 'filter:status=ready,sort:-name' });
    const r = queryPool(seedRegistry, q, bestand, dims);
    /* n1 ist fertig, o1 ohne Status-Karte zählt als fertig (D72), n2 ist genannt. */
    expect(r.rows.map((e) => e.id)).toEqual(['n1', 'n2', 'o1'].sort((a, b) => {
      const n = (id: string) => bestand.find((e) => e.id === id)!.name;
      return n(b).localeCompare(n(a));
    }));
    expect(r.unknown).toEqual([]);
  });

  it('nimmt eine Ebene als Quelle und nennt unbekannte Dimensionen', () => {
    const r = queryPool(seedRegistry, boardQueryOf({ layers: ['ly_k'], steps: 'filter:nope=x' }), bestand, dims);
    expect(r.rows.map((e) => e.id).sort()).toEqual(['i1', 'n1']);
    expect(r.unknown).toEqual(['nope']);
  });

  it('zieht ohne Zurücklegen, bis nichts mehr da ist', () => {
    const pool = ['a', 'b', 'c'];
    const gezogen: string[] = [];
    for (let i = 0; i < 3; i++) {
      const x = drawNext(pool, gezogen, () => 0.99);
      expect(x).not.toBeNull();
      expect(gezogen).not.toContain(x);
      gezogen.push(x!);
    }
    expect(gezogen.sort()).toEqual(pool);
    expect(drawNext(pool, gezogen)).toBeNull();
    expect(drawNext(pool, ['b'], () => 0)).toBe('a');
  });

  it('behält beim Schreiben des Boards den Stand des Ziehens, den der Server hat', () => {
    const alt: Entity = { ...bestand[5]!, relations: [kachel({ query: { types: ['Quest'] }, drawn: ['n1', 'n2'] })] };
    const neu: Entity = { ...alt, relations: [kachel({ query: { types: ['Quest'] }, drawn: ['n1'], x: 40 }), kachel({ query: {} , drawn: ['zz']})].map((r, i) => ({ ...r, id: `q${i + 1}` })) };
    const behalten = keepDrawState(alt, neu);
    expect(behalten.relations![0]!.props).toEqual({ query: { types: ['Quest'] }, drawn: ['n1', 'n2'], x: 40 });
    /* Eine neue Kachel fängt leer an. */
    expect(behalten.relations![1]!.props?.['drawn']).toBeUndefined();
  });

  it('gibt Spielenden nur, was sie sehen — an Quelle und Gezogenem', () => {
    const b: Entity = { ...bestand[5]!, relations: [kachel({ query: { articles: ['n1', 'n2'], tags: ['rumour'] }, drawn: ['n2', 'n1'] })] };
    const r = redactQueryTiles(b, (id) => id === 'n1');
    expect(r.relations![0]!.props).toEqual({ query: { articles: ['n1'], tags: ['rumour'] }, drawn: ['n1'] });
    expect(storedQuery({ types: [], steps: '' })).toEqual({});
  });
});

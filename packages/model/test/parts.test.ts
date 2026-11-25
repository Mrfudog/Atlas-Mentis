import { describe, expect, it } from 'vitest';
import { isBookPart, looseParts, nextRank, partName, partsIndex } from '../src/parts.js';
import { linkFinder } from '../src/entity.js';
import { readingOrder } from '../src/reading.js';
import type { Entity } from '../src/types.js';

/* Ein Kapitel eines Abenteuers (T-108): Überschrift, Absatz, eine Szene
   mit Vorlesetext und Raum, ein Verweis — und derselbe Text als Arc, der
   auf dieselbe Szene zeigt. */
const art = (id: string, typ: string, nr: string, rels: [string, string, number?][] = [], extra: Record<string, unknown> = {}): Entity => ({
  id,
  name: id,
  interfaces: [typ],
  components: { Identity: { name: id, id: nr }, ...extra },
  relations: [
    { id: `${id}~l`, type: 'inLayer', to: 'ly_a', props: {} },
    ...rels.map(([type, to, rank], i) => ({ id: `${id}~${i}`, type, to, props: rank === undefined ? {} : { rank } })),
  ],
});

const KAPITEL: Entity[] = [
  art('kap', 'Chapter', 'chapter-0001'),
  art('arc', 'Arc', 'arc-0001'),
  art('h1', 'Heading', 'heading-0001', [['partOf', 'kap', 1]], { Heading: { level: 2 } }),
  art('p1', 'Paragraph', 'paragraph-0001', [['partOf', 'kap', 2]]),
  art('sz', 'Scene', 'scene-0001', [['partOf', 'kap', 3], ['partOf', 'arc']]),
  art('ra', 'ReadAloudText', 'readaloudtext-0001', [['partOf', 'sz', 1]]),
  art('h2', 'Heading', 'heading-0002', [['partOf', 'sz', 2]], { Heading: { level: 3 } }),
  art('raum', 'Scene', 'scene-0002', [['partOf', 'sz', 3], ['partOf', 'arc']]),
  art('em', 'Embed', 'embed-0001', [['partOf', 'kap', 4]], { Embed: { target: 'goblin' } }),
  /* Angehängt, nicht im Fluss: eine Begegnung ohne Rang. */
  art('kampf', 'Encounter', 'encounter-0001', [['partOf', 'sz']]),
  art('kap2', 'Chapter', 'chapter-0002'),
  art('p2', 'Paragraph', 'paragraph-0002', [['partOf', 'kap2', 1]]),
];

describe('partsIndex (T-108)', () => {
  it('ordnet nach Rang und lässt Kanten ohne Rang weg', () => {
    const idx = partsIndex(KAPITEL);
    expect(idx.get('kap')?.map((t) => t.entity.id)).toEqual(['h1', 'p1', 'sz', 'em']);
    expect(idx.get('sz')?.map((t) => t.entity.id)).toEqual(['ra', 'h2', 'raum']);
    expect(idx.has('arc')).toBe(false);
    expect(nextRank(idx, 'kap')).toBe(5);
    expect(nextRank(idx, 'arc')).toBe(1);
  });
});

describe('readingOrder aus Kapiteln (T-108)', () => {
  it('liest Kapitel als Stücke, Teile in Rangfolge, Szenen mit ihren Teilen', () => {
    const o = readingOrder(KAPITEL, 'ly_a');
    expect(o.map((n) => n.id)).toEqual(['kap', 'h1', 'p1', 'sz', 'ra', 'h2', 'raum', 'em', 'kap2', 'p2']);
    const n = new Map(o.map((x) => [x.id, x]));
    expect(n.get('raum')?.unit).toBe('kap');
    expect(n.get('p2')?.unit).toBe('kap2');
    /* Der Arc und die Begegnung sind nicht Text des Buchs. */
    expect(n.has('arc')).toBe(false);
    expect(n.has('kampf')).toBe(false);
  });

  it('stellt Kapitel, Szenen und Überschriften ins Inhaltsverzeichnis, Absätze nicht', () => {
    const o = new Map(readingOrder(KAPITEL, 'ly_a').map((x) => [x.id, x]));
    expect(['kap', 'h1', 'sz', 'h2', 'raum'].every((id) => o.get(id)?.toc !== false)).toBe(true);
    expect(['p1', 'ra', 'em'].every((id) => o.get(id)?.toc === false)).toBe(true);
    /* „###" in der Szene steht eine Stufe unter ihr, „##" im Kapitel eine darunter. */
    expect(o.get('h1')?.depth).toBe(1);
    expect(o.get('sz')?.depth).toBe(1);
    expect(o.get('h2')?.depth).toBe(3);
  });

  it('liest eine Ebene ohne Kapitel weiter aus Story, Arc und Szene', () => {
    const ohne = KAPITEL.filter((e) => e.interfaces[0] !== 'Chapter');
    const o = readingOrder(ohne, 'ly_a').map((n) => n.id);
    expect(o[0]).toBe('arc');
    expect(o).toContain('sz');
  });
});

describe('Teile als Verweisziel (T-108)', () => {
  it('sind kein Ziel nach Namen, wohl aber nach Nummer', () => {
    const regel: Entity = { id: 'r', name: 'Surprise', interfaces: ['Rule'], components: { Identity: { name: 'Surprise', id: 'rule-0001' } } };
    const kopf: Entity = { id: 'h', name: 'Surprise', interfaces: ['Heading'], components: { Identity: { name: 'Surprise', id: 'heading-0009' } } };
    const finde = linkFinder([regel, kopf]);
    expect(finde('Surprise').map((e) => e.id)).toEqual(['r']);
    expect(finde('heading-0009').map((e) => e.id)).toEqual(['h']);
    expect(isBookPart(kopf)).toBe(true);
    expect(isBookPart(regel)).toBe(false);
  });

  it('heissen nach ihren ersten Worten, ohne Markdown', () => {
    expect(partName('**Surprise.** The [[rule-0001|DM]] determines who might be surprised.', 40)).toBe('Surprise. The DM determines who might…');
    expect(partName('Kurz.')).toBe('Kurz.');
  });
});

/**
 * **Was ohne Rang an einem Ganzen hängt** (T-422, REQ-427): die Szenen
 * eines Arcs, die Begegnungen einer Szene, was zu einer Session gehört.
 * Nicht im Lesefluss (`partsIndex`), aber an seinem Ganzen aufgezählt.
 */
describe('looseParts (T-422)', () => {
  const e = (id: string, nr: string, rels: Entity['relations'] = [], sort?: number): Entity => ({
    id,
    name: id,
    interfaces: ['Scene'],
    components: { Identity: { name: id, id: nr, aliases: [] }, ...(sort === undefined ? {} : { Time: { sort } }) },
    relations: rels,
  });
  const auf = (x: string, to: string, rank?: number) => ({ id: `${x}~p-${to}`, type: 'partOf', to, props: rank === undefined ? {} : { rank } });

  it('nimmt nur Kanten ohne Rang, geordnet nach Zeit, dann Nummer', () => {
    const alle = [
      e('b', 'scene-0010', [auf('b', 'arc')]),
      e('a', 'scene-0002', [auf('a', 'arc')]),
      e('frueh', 'scene-0099', [auf('frueh', 'arc')], 1),
      e('im_fluss', 'scene-0001', [auf('im_fluss', 'arc', 1)]),
      e('anderswo', 'scene-0003', [auf('anderswo', 'arc2')]),
      e('arc', 'arc-0001', [auf('arc', 'arc')]),
    ];
    expect(looseParts(alle, 'arc').map((x) => x.id)).toEqual(['frueh', 'a', 'b']);
  });

  it('leer, wenn nichts hängt; ein Artikel hängt nicht an sich selbst', () => {
    expect(looseParts([e('x', 'scene-0001', [auf('x', 'x')])], 'x')).toEqual([]);
    expect(looseParts([], 'arc')).toEqual([]);
  });
});

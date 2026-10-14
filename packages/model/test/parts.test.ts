import { describe, expect, it } from 'vitest';
import { isBookPart, nextRank, partName, partsIndex } from '../src/parts.js';
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

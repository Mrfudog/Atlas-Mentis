/** Fassung, Variante oder Kopie in einer anderen Ebene (T-405, REQ-400, E-162). */
import { describe, expect, it } from 'vitest';
import type { Entity } from '../src/types.js';
import { copyArticles } from '../src/kopie.js';
import { homeLayers } from '../src/layermove.js';

function art(id: string, type: string, layer: string, rel: [string, string][] = []): Entity {
  return {
    id,
    interfaces: [type],
    name: id.toUpperCase(),
    components: { Identity: { name: id.toUpperCase(), id: `${type.toLowerCase()}-${id}` }, Description: { description: `about ${id}` } },
    relations: [
      { id: `${id}~inLayer`, type: 'inLayer', to: layer, props: {} },
      ...rel.map(([t, to], i) => ({ id: `${id}~${t}-${i}`, type: t, to, props: { rank: i } })),
    ],
  } as Entity;
}

const raw = new Map(
  [
    art('haus', 'Place', 'ly_buch', [['locatedIn', 'stadt'], ['variantOf', 'alt']]),
    art('zimmer', 'Place', 'ly_buch', [['partOf', 'haus']]),
    art('sb', 'Statblock', 'ly_buch', [['belongsTo', 'haus'], ['instanceOf', 'vorlage']]),
    art('stadt', 'Place', 'ly_buch'),
  ].map((e) => [e.id, e]),
);
let n = 0;
const ids = () => `neu${++n}`;
const nummer = (type: string) => `${type.toLowerCase()}-9${n}`;

describe('copyArticles', () => {
  it('a version overrides the original and lies in the target layer; parts hang on the new whole', () => {
    const out = copyArticles(raw, ['haus', 'zimmer', 'sb'], { mode: 'version', layer: 'ly_kampagne', newId: ids, number: nummer });
    expect(out).toHaveLength(3);
    const [haus, zimmer, sb] = out.map((x) => x.entity);
    expect(out[0]!.from).toBe('haus');
    expect(homeLayers(haus!.relations)).toEqual(['ly_kampagne']);
    expect(haus!.relations).toContainEqual(expect.objectContaining({ type: 'overrides', to: 'haus' }));
    /* Verweise nach draussen bleiben, die alte Herkunft (variantOf) nicht. */
    expect(haus!.relations).toContainEqual(expect.objectContaining({ type: 'locatedIn', to: 'stadt' }));
    expect(haus!.relations?.some((r) => r.type === 'variantOf')).toBe(false);
    expect(zimmer!.relations).toContainEqual(expect.objectContaining({ type: 'partOf', to: haus!.id, props: { rank: 0 } }));
    expect(zimmer!.relations).toContainEqual(expect.objectContaining({ type: 'overrides', to: 'zimmer' }));
    /* Eine Instanz bleibt Instanz ihrer Vorlage. */
    expect(sb!.relations).toContainEqual(expect.objectContaining({ type: 'instanceOf', to: 'vorlage' }));
    expect(sb!.relations).toContainEqual(expect.objectContaining({ type: 'belongsTo', to: haus!.id }));
    expect(haus!.components?.['Identity']?.['id']).not.toBe('place-haus');
    expect(haus!.components?.['Description']).toEqual({ description: 'about haus' });
    /* Nichts am Original geändert. */
    expect(raw.get('haus')!.relations).toHaveLength(3);
  });

  it('a variant stands beside the original with variantOf, a copy without any edge back and with “(copy)”', () => {
    const [v] = copyArticles(raw, ['haus'], { mode: 'variant', layer: 'ly_k', newId: ids, number: nummer });
    expect(v!.entity.relations).toContainEqual(expect.objectContaining({ type: 'variantOf', to: 'haus' }));
    expect(v!.entity.relations?.some((r) => r.type === 'overrides')).toBe(false);
    expect(v!.entity.components?.['Identity']?.['name']).toBe('HAUS');
    const [k] = copyArticles(raw, ['haus'], { mode: 'copy', layer: 'ly_k', newId: ids, number: nummer });
    expect(k!.entity.relations?.some((r) => ['overrides', 'variantOf'].includes(r.type))).toBe(false);
    expect(k!.entity.components?.['Identity']?.['name']).toBe('HAUS (copy)');
    expect(k!.entity.name).toBe('HAUS (copy)');
  });

  it('gives every relation of a copy its own id', () => {
    const out = copyArticles(raw, ['haus', 'zimmer'], { mode: 'copy', layer: 'ly_k', newId: ids, number: nummer });
    const alle = out.flatMap((x) => x.entity.relations ?? []).map((r) => r.id);
    expect(new Set(alle).size).toBe(alle.length);
    for (const id of alle) expect(id.startsWith('neu')).toBe(true);
  });
});

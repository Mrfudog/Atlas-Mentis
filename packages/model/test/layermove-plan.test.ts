/** Ebene wechseln mit Mitläufern (T-402, E-161). */
import { describe, expect, it } from 'vitest';
import type { Entity } from '../src/types.js';
import { homeLayers, layerMoveChanges, layerMovePlan } from '../src/layermove.js';

const reg = {
  relations: {
    belongsTo: { type: 'belongsTo', from: ['Statblock'], to: ['Creature'], asField: 'to' as const },
    carries: { type: 'carries', from: ['Creature', 'Party', 'Item'], to: ['Inventory'], asField: 'from' as const },
    holds: { type: 'holds', from: ['Inventory'], to: ['Item'] },
    partOf: { type: 'partOf', from: ['Chapter'], to: ['Chapter'] },
  },
} as never;

let n = 0;
function art(id: string, type: string, layer: string | null, rel: [string, string][] = [], text?: string): Entity {
  const relations = rel.map(([t, to]) => ({ id: `${id}~${t}-${++n}`, type: t, to, props: {} }));
  if (layer) relations.push({ id: `${id}~inLayer`, type: 'inLayer', to: layer, props: {} });
  return {
    id,
    interfaces: [type],
    components: { Identity: { name: id.toUpperCase(), ...(text ? { summary: text } : {}) } },
    relations,
  } as Entity;
}

function bestand(...es: Entity[]): Map<string, Entity> {
  return new Map(es.map((e) => [e.id, e]));
}

describe('layerMovePlan', () => {
  it('finds parts, the own statblock and the inventory with its pieces, preselected when in the same old layer', () => {
    const raw = bestand(
      art('kap', 'Chapter', 'ly_a'),
      art('teil1', 'Chapter', 'ly_a', [['partOf', 'kap']]),
      art('teil2', 'Chapter', 'ly_a', [['partOf', 'teil1']]),
      art('fremd', 'Chapter', 'ly_b', [['partOf', 'kap']]),
      art('volo', 'Creature', 'ly_a', [['carries', 'inv']]),
      art('sb', 'Statblock', 'ly_a', [['belongsTo', 'volo']]),
      art('inv', 'Inventory', 'ly_a', [['holds', 'stueck'], ['holds', 'schwert']]),
      art('stueck', 'Item', 'ly_a', [['instanceOf', 'schwert']]),
      art('schwert', 'Item', 'ly_phb'),
      art('ly_a', 'Layer', null, [['partOf', 'kap']]),
    );
    const plan = layerMovePlan(reg, raw, ['kap', 'volo'], { layer: 'ly_z' });
    const f = Object.fromEntries(plan.followers.map((x) => [x.id, x]));
    expect(Object.keys(f).sort()).toEqual(['fremd', 'inv', 'sb', 'stueck', 'teil1', 'teil2']);
    expect(f['teil2']).toMatchObject({ via: 'partOf', of: 'teil1', root: 'kap', sameLayer: true, preselected: true });
    expect(f['fremd']).toMatchObject({ sameLayer: false, preselected: false, layers: ['ly_b'] });
    expect(f['sb']).toMatchObject({ via: 'belongsTo', of: 'volo', preselected: true });
    expect(f['inv']).toMatchObject({ via: 'carries', of: 'volo' });
    expect(f['stueck']).toMatchObject({ via: 'holds', of: 'inv', preselected: true });
    /* Ein Grundartikel im Inventar steht für sich, eine Ebene ist nie ein Mitläufer. */
    expect(f['schwert']).toBeUndefined();
    expect(f['ly_a']).toBeUndefined();
    expect(plan.roots.map((r) => r.id)).toEqual(['kap', 'volo']);
  });

  it('shows where a follower is linked from outside the move', () => {
    const raw = bestand(
      art('kap', 'Chapter', 'ly_a'),
      art('teil', 'Chapter', 'ly_a', [['partOf', 'kap']]),
      art('anderes', 'Chapter', 'ly_a', [['mentions', 'teil']]),
      art('text', 'Chapter', 'ly_a', [], 'See [[teil|the part]] and [[kap]].'),
    );
    const plan = layerMovePlan(reg, raw, ['kap'], { layer: 'ly_z' });
    const teil = plan.followers.find((x) => x.id === 'teil')!;
    expect(teil.linkedFrom).toEqual([
      { id: 'anderes', name: 'ANDERES', via: 'mentions' },
      { id: 'text', name: 'TEXT', via: 'text' },
    ]);
  });

  it('does not preselect what the account may not write, nor what already lies in the target', () => {
    const raw = bestand(
      art('kap', 'Chapter', 'ly_a'),
      art('t1', 'Chapter', 'ly_a', [['partOf', 'kap']]),
      art('t2', 'Chapter', 'ly_z', [['partOf', 'kap']]),
    );
    const plan = layerMovePlan(reg, raw, ['kap'], { layer: 'ly_z', mayWrite: (id) => id !== 't1' });
    const f = Object.fromEntries(plan.followers.map((x) => [x.id, x]));
    expect(f['t1']).toMatchObject({ writable: false, preselected: false });
    expect(f['t2']).toMatchObject({ already: true, preselected: false });
  });

  it('reads the old layer from `from` when the article has already moved', () => {
    const raw = bestand(art('kap', 'Chapter', 'ly_z'), art('t1', 'Chapter', 'ly_a', [['partOf', 'kap']]));
    expect(layerMovePlan(reg, raw, ['kap'], { layer: 'ly_z' }).followers[0]!.preselected).toBe(false);
    expect(layerMovePlan(reg, raw, ['kap'], { layer: 'ly_z', from: ['ly_a'] }).followers[0]!.preselected).toBe(true);
  });

  it('stops on a circle of parts', () => {
    const raw = bestand(art('a', 'Chapter', 'ly_a', [['partOf', 'b']]), art('b', 'Chapter', 'ly_a', [['partOf', 'a']]));
    expect(layerMovePlan(reg, raw, ['a'], { layer: 'ly_z' }).followers.map((x) => x.id)).toEqual(['b']);
  });
});

describe('layerMoveChanges', () => {
  it('puts each chosen article into the target layer and leaves those already there', () => {
    const raw = bestand(art('a', 'Chapter', 'ly_a'), art('b', 'Chapter', 'ly_z'));
    const ch = layerMoveChanges(raw, ['a', 'b', 'nix'], 'ly_z');
    expect(ch.map((c) => c.id)).toEqual(['a']);
    expect(homeLayers(ch[0]!.after.relations)).toEqual(['ly_z']);
    expect(ch[0]!.before).toBe(raw.get('a'));
  });
});

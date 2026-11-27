import { describe, expect, it } from 'vitest';
import {
  chosenCampaign,
  cleanLayerView,
  isDefaultView,
  layerViewKey,
  layerViewsOf,
  mayChooseCampaign,
  viewedCampaign,
} from '../src/kontosicht.js';
import { activeStack, resolvedStack } from '../src/stack.js';
import type { Entity, EntityId } from '../src/types.js';

/* REQ-408, REQ-412 (T-496): zwei Kampagnen, ein Regelwerk als Gruppe mit
   zwei Büchern, je Kampagne ihre Ebene, dazu eine fremde Ebene. */
const L = (id: string, layer: Record<string, unknown>, partOf: string[] = []): Entity => ({
  id,
  name: id,
  interfaces: ['Layer'],
  components: { Layer: layer },
  relations: partOf.map((to, i) => ({ id: `${id}~${i}`, type: 'partOf', to })),
});
const welt = (): Map<EntityId, Entity> =>
  new Map(
    [
      L('g_regeln', { kind: 'group', order: 1 }),
      L('ly_phb', { kind: 'book', order: 2 }, ['g_regeln']),
      L('ly_xge', { kind: 'book', order: 3 }, ['g_regeln']),
      L('ly_karten', { kind: 'book', order: 5 }),
      L('ly_nebel', { kind: 'campaign', order: 100 }),
      L('ly_salz', { kind: 'campaign', order: 100 }),
      L('ly_fremd', { kind: 'book', order: 4 }),
      {
        id: 'camp_nebel',
        name: 'Aus Nebel wacht',
        interfaces: ['Campaign'],
        relations: [
          { id: 'a1', type: 'activates', to: 'g_regeln', props: { order: 10 } },
          { id: 'a2', type: 'activates', to: 'ly_karten', props: { order: 20, areas: ['world'] } },
          { id: 'a3', type: 'activates', to: 'ly_nebel', props: { order: 100 } },
          { id: 'a4', type: 'activates', to: 'ly_salz', props: { mode: 'compare' } },
        ],
      },
      {
        id: 'camp_salz',
        name: 'Der Salzpfad',
        interfaces: ['Campaign'],
        relations: [{ id: 'b1', type: 'activates', to: 'ly_salz', props: { order: 100 } }],
      },
    ].map((e) => [e.id, e as Entity]),
  );

describe('choosing the campaign per account (REQ-408)', () => {
  const w = welt();
  const settings = { campaign: 'camp_nebel' };

  it('takes the own choice when the account has a role there', () => {
    expect(chosenCampaign(w, settings, { roles: { camp_salz: 'player', camp_nebel: 'gm' } }, 'camp_salz')?.id).toBe('camp_salz');
  });

  it('ignores a choice without a role, and a choice that is no campaign', () => {
    expect(chosenCampaign(w, settings, { roles: { camp_nebel: 'player' } }, 'camp_salz')?.id).toBe('camp_nebel');
    expect(chosenCampaign(w, settings, { roles: { ly_nebel: 'gm', camp_nebel: 'gm' } }, 'ly_nebel')?.id).toBe('camp_nebel');
  });

  it('lets the administration choose any campaign', () => {
    expect(chosenCampaign(w, settings, { isAdmin: true, roles: {} }, 'camp_salz')?.id).toBe('camp_salz');
    expect(mayChooseCampaign({ isAdmin: true }, 'irgendwas')).toBe(true);
    expect(mayChooseCampaign(null, 'camp_salz')).toBe(false);
  });

  it('puts an account with exactly one campaign there without a choice', () => {
    expect(chosenCampaign(w, settings, { roles: { camp_salz: 'player' } })?.id).toBe('camp_salz');
  });

  it('prefers the strongest role when the default is none of its campaigns', () => {
    const drei = new Map(w);
    drei.set('camp_drei', { id: 'camp_drei', name: 'Aaa', interfaces: ['Campaign'] });
    expect(chosenCampaign(drei, settings, { roles: { camp_drei: 'player', camp_salz: 'co-gm' } })?.id).toBe('camp_salz');
    expect(chosenCampaign(drei, settings, { roles: { camp_drei: 'player', camp_salz: 'player' } })?.id).toBe('camp_drei');
  });

  it('falls back to the installation default without a role, or without a viewer', () => {
    expect(chosenCampaign(w, settings, { roles: {} })?.id).toBe('camp_nebel');
    expect(chosenCampaign(w, settings, null)?.id).toBe('camp_nebel');
    expect(chosenCampaign(new Map(), settings, { roles: {} })).toBeNull();
  });
});

describe('reading a layer view (REQ-412)', () => {
  it('cleans what it cannot read', () => {
    expect(cleanLayerView(null)).toBeNull();
    expect(cleanLayerView({ mode: 'other' })).toBeNull();
    expect(cleanLayerView({ mode: 'mine', layers: [1] })).toBeNull();
    expect(cleanLayerView({ mode: 'mine', layers: ['a', 'a', 'b'] })).toEqual({ mode: 'mine', off: [], layers: ['a', 'b'] });
  });

  it('treats a campaign view without exclusions as the default', () => {
    expect(isDefaultView({ mode: 'campaign', off: [], layers: ['x'] })).toBe(true);
    expect(isDefaultView({ mode: 'mine', off: [], layers: [] })).toBe(false);
    expect(isDefaultView(undefined)).toBe(true);
  });

  it('keeps only real views per campaign', () => {
    expect(
      layerViewsOf({ c1: { mode: 'campaign', off: [] }, c2: { mode: 'campaign', off: ['x'] }, c3: 'kaputt' }),
    ).toEqual({ c2: { mode: 'campaign', off: ['x'], layers: [] } });
    expect(layerViewsOf([1, 2])).toEqual({});
  });

  it('gives a stable key, empty for the default', () => {
    expect(layerViewKey(null)).toBe('');
    expect(layerViewKey({ mode: 'campaign', off: ['b', 'a'], layers: [] })).toBe('c:a,b');
    expect(layerViewKey({ mode: 'mine', off: [], layers: ['b', 'a'] })).toBe('m:a,b');
  });
});

describe('the campaign as one viewer reads it (REQ-412)', () => {
  const w = welt();
  const nebel = w.get('camp_nebel')!;
  const ids = (c: Entity) => resolvedStack(w, c).map((l) => l.id);

  it('is the same campaign without a view', () => {
    expect(viewedCampaign(w, nebel, null)).toBe(nebel);
    expect(viewedCampaign(w, nebel, { mode: 'campaign', off: [], layers: [] })).toBe(nebel);
  });

  it('narrows the campaign view: a direct layer loses its edge, a group member is switched off', () => {
    const eng = viewedCampaign(w, nebel, { mode: 'campaign', off: ['ly_karten', 'ly_xge'], layers: [] });
    expect(ids(eng)).toEqual(['g_regeln', 'ly_phb', 'ly_nebel']);
    /* Die Kampagne selbst bleibt, wie sie ist. */
    expect(ids(nebel)).toEqual(['g_regeln', 'ly_phb', 'ly_xge', 'ly_karten', 'ly_nebel']);
    expect(w.get('camp_nebel')).toBe(nebel);
  });

  it('never narrows the campaign layer away', () => {
    const eng = viewedCampaign(w, nebel, { mode: 'campaign', off: ['ly_nebel'], layers: [] });
    expect(eng).toBe(nebel);
  });

  it('keeps the selection (only) and the comparison of what stays', () => {
    const eng = viewedCampaign(w, nebel, { mode: 'campaign', off: ['ly_xge'], layers: [] });
    expect(activeStack(w, eng).find((x) => x.layer.id === 'ly_karten')?.filter).toEqual({ areas: ['world'] });
    expect(eng.relations?.some((r) => r.to === 'ly_salz' && (r.props as { mode?: string }).mode === 'compare')).toBe(true);
  });

  it('builds my view from the chosen layers plus the campaign layer, by specificity', () => {
    const meine = viewedCampaign(w, nebel, { mode: 'mine', off: [], layers: ['ly_fremd', 'ly_phb', 'gibt-es-nicht'] });
    expect(activeStack(w, meine).map((x) => x.layer.id)).toEqual(['ly_phb', 'ly_fremd', 'ly_nebel']);
    expect(ids(meine)).not.toContain('ly_karten');
  });

  it('keeps edge and place of a layer the campaign already turns on, in my view', () => {
    const meine = viewedCampaign(w, nebel, { mode: 'mine', off: [], layers: ['ly_karten'] });
    const karten = activeStack(w, meine).find((x) => x.layer.id === 'ly_karten');
    expect(karten?.order).toBe(20);
    expect(karten?.filter).toEqual({ areas: ['world'] });
    expect(meine.relations?.find((r) => r.to === 'ly_karten')?.id).toBe('a2');
  });

  it('turns on a whole group in my view, without the campaign’s exclusions', () => {
    const aus: Entity = {
      ...nebel,
      relations: [...(nebel.relations ?? []), { id: 'off1', type: 'activates', to: 'ly_xge', props: { mode: 'off' } }],
    };
    expect(ids(aus)).not.toContain('ly_xge');
    const meine = viewedCampaign(w, aus, { mode: 'mine', off: [], layers: ['g_regeln'] });
    expect(ids(meine)).toEqual(['g_regeln', 'ly_phb', 'ly_xge', 'ly_nebel']);
  });
});

import { describe, expect, it } from 'vitest';
import {
  activeStack,
  campaignLayer,
  campaignsActivating,
  currentCampaign,
  inPlay,
  inStack,
  isOverridden,
  playStack,
  resolveArticle,
  unactivatedLayers,
  withStack,
} from '../src/stack.js';
import type { Entity, EntityId } from '../src/types.js';

/* Zwei Kampagnen in einem Speicher: Nebelwacht schaltet das Regelwerk und
   ihre eigene Ebene auf, der Salzpfad das Regelwerk und seine. Ein Artikel
   aus der Salzpfad-Ebene ist in Nebelwacht nicht da; eine Hausregel in der
   Nebelwacht-Ebene überschreibt die aus dem Regelwerk. */
const welt: [EntityId, Entity][] = [
  { id: 'ly_system', name: 'Regelwerk', interfaces: ['Layer'], components: { Layer: { order: 1 } } },
  { id: 'ly_nebel', name: 'Ebene: Nebelwacht', interfaces: ['Layer'], components: { Layer: { order: 20 } } },
  { id: 'ly_salz', name: 'Ebene: Salzpfad', interfaces: ['Layer'], components: { Layer: { order: 20 } } },
  { id: 'ly_aus', name: 'Ebene: abgeschaltet', interfaces: ['Layer'], components: { Layer: { order: 30 } } },
  {
    id: 'camp_nebel', name: 'Aus Nebel wacht', interfaces: ['Campaign'],
    relations: [{ id: 'a1', type: 'activates', to: 'ly_system' }, { id: 'a2', type: 'activates', to: 'ly_nebel' }],
  },
  {
    id: 'camp_salz', name: 'Der Salzpfad', interfaces: ['Campaign'],
    relations: [{ id: 'b1', type: 'activates', to: 'ly_system' }, { id: 'b2', type: 'activates', to: 'ly_salz', props: { order: 5 } }],
  },
  { id: 'r_frei', name: 'ohne Ebene', interfaces: ['Rule'] },
  { id: 'r_grund', name: 'Grundregel', interfaces: ['Rule'], relations: [{ id: 'l1', type: 'inLayer', to: 'ly_system' }] },
  { id: 'r_salz', name: 'nur im Salzpfad', interfaces: ['Rule'], relations: [{ id: 'l2', type: 'inLayer', to: 'ly_salz' }] },
  {
    id: 'r_haus', name: 'Hausregel', interfaces: ['Rule'],
    relations: [{ id: 'l3', type: 'inLayer', to: 'ly_nebel' }, { id: 'o1', type: 'overrides', to: 'r_grund' }],
  },
  {
    id: 'r_weg', name: 'herausgenommen', interfaces: ['Rule'],
    relations: [{ id: 'l4', type: 'inLayer', to: 'ly_system' }, { id: 'l5', type: 'inLayer', to: 'ly_nebel', props: { mode: 'removes' } }],
  },
  {
    id: 'r_tot', name: 'Überschreibung aus abgeschalteter Ebene', interfaces: ['Rule'],
    relations: [{ id: 'l6', type: 'inLayer', to: 'ly_aus' }, { id: 'o2', type: 'overrides', to: 'r_frei' }],
  },
].map((e) => [e.id, e as Entity]);
const entities = new Map<EntityId, Entity>(welt);
const E = (id: string): Entity => entities.get(id) as Entity;

describe('the running campaign', () => {
  it('is the setting, else the first campaign, else none', () => {
    expect(currentCampaign(entities, { campaign: 'camp_salz' })?.id).toBe('camp_salz');
    expect(currentCampaign(entities, { campaign: 'gibt-es-nicht' })?.id).toBe('camp_nebel');
    expect(currentCampaign(entities)?.id).toBe('camp_nebel');
    expect(currentCampaign(new Map())).toBeNull();
  });

  it('stacks its layers bottom-up, the edge order before the layer order', () => {
    expect(activeStack(entities, E('camp_nebel')).map((x) => x.layer.id)).toEqual(['ly_system', 'ly_nebel']);
    expect(activeStack(entities, E('camp_salz')).map((x) => x.layer.id)).toEqual(['ly_system', 'ly_salz']);
  });
});

describe('what is in play', () => {
  const nebel = E('camp_nebel');
  it('keeps articles without a layer and those an active layer brings', () => {
    expect(inStack(entities, E('r_frei'), nebel)).toBe(true);
    expect(inStack(entities, E('r_grund'), nebel)).toBe(true);
  });
  it('drops what only an inactive layer brings', () => {
    expect(inStack(entities, E('r_salz'), nebel)).toBe(false);
    expect(inStack(entities, E('r_salz'), E('camp_salz'))).toBe(true);
  });
  it('lets a more specific layer take an article out', () => {
    expect(inStack(entities, E('r_weg'), nebel)).toBe(false);
    expect(inStack(entities, E('r_weg'), E('camp_salz'))).toBe(true);
  });
  it('follows an override from an active layer, not from a switched-off one', () => {
    expect(isOverridden(entities, E('r_grund'), nebel)).toBe(true);
    expect(resolveArticle(entities, E('r_grund'), nebel).id).toBe('r_haus');
    expect(isOverridden(entities, E('r_grund'), E('camp_salz'))).toBe(false);
    expect(isOverridden(entities, E('r_frei'), nebel)).toBe(false);
  });
  it('sieves: in the stack and not overridden', () => {
    const da = [...entities.values()].filter((e) => inPlay(entities, e, nebel)).map((e) => e.id);
    expect(da).toContain('r_frei');
    expect(da).toContain('r_haus');
    expect(da).not.toContain('r_grund');
    expect(da).not.toContain('r_salz');
    expect(da).not.toContain('r_weg');
  });
  it('without any campaign, everything is in play', () => {
    expect(inStack(entities, E('r_salz'), null)).toBe(true);
    expect(isOverridden(entities, E('r_grund'), null)).toBe(false);
  });
});

/* REQ-237: wohin der Server legt, was Spielende anlegen — die
   spezifischste Ebene, die nur diese Kampagne aufschaltet. */
describe('campaignLayer', () => {
  it('nimmt die eigene Ebene der Kampagne, nicht das geteilte Regelwerk', () => {
    expect(campaignLayer(entities, entities.get('camp_nebel')!)?.id).toBe('ly_nebel');
    expect(campaignLayer(entities, entities.get('camp_salz')!)?.id).toBe('ly_salz');
  });
  it('gibt null ohne Kampagne', () => {
    expect(campaignLayer(entities, null)).toBeNull();
  });
});

describe('what is missing only because its layer is off (T-069)', () => {
  const nebel = E('camp_nebel');
  it('names the layers that would bring it', () => {
    expect(unactivatedLayers(entities, E('r_salz'), nebel)).toEqual(['ly_salz']);
  });
  it('says nothing for what is there, taken out on purpose, or has no layer', () => {
    expect(unactivatedLayers(entities, E('r_grund'), nebel)).toEqual([]);
    expect(unactivatedLayers(entities, E('r_weg'), nebel)).toEqual([]);
    expect(unactivatedLayers(entities, E('r_frei'), nebel)).toEqual([]);
    expect(unactivatedLayers(entities, E('r_salz'), null)).toEqual([]);
  });
  it('knows which campaigns run a layer', () => {
    expect(campaignsActivating(entities, 'ly_system').sort()).toEqual(['camp_nebel', 'camp_salz']);
    expect(campaignsActivating(entities, 'ly_salz')).toEqual(['camp_salz']);
    expect(campaignsActivating(entities, 'ly_aus')).toEqual([]);
  });
  it('rewrites the stack in the given order and keeps the other edges', () => {
    const c: Entity = {
      ...nebel,
      relations: [...(nebel.relations ?? []), { id: 'x', type: 'partOf', to: 'irgendwo' }],
    };
    const neu = withStack(c, ['ly_nebel', 'ly_salz', 'ly_system']);
    const m = new Map(entities);
    m.set(neu.id, neu);
    expect(activeStack(m, neu).map((x) => x.layer.id)).toEqual(['ly_nebel', 'ly_salz', 'ly_system']);
    expect(neu.relations?.find((r) => r.to === 'ly_system')?.id).toBe('a1');
    expect(neu.relations?.some((r) => r.type === 'partOf')).toBe(true);
    expect(withStack(c, []).relations?.filter((r) => r.type === 'activates')).toEqual([]);
  });
});

describe('the stack computed once for many articles (T-086)', () => {
  it('answers like inPlay and unactivatedLayers, for every article and campaign', () => {
    for (const c of [E('camp_nebel'), E('camp_salz'), null]) {
      const s = playStack(entities, c);
      for (const e of entities.values()) {
        expect([e.id, s.inPlay(e)]).toEqual([e.id, inPlay(entities, e, c)]);
        expect([e.id, s.unactivated(e)]).toEqual([e.id, unactivatedLayers(entities, e, c)]);
      }
    }
  });
});

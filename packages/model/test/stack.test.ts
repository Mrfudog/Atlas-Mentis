import { describe, expect, it } from 'vitest';
import {
  activeStack,
  adaptedVersion,
  replacedIds,
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
  groupMembers,
  layersInGroup,
  offLayers,
  resolvedStack,
  withOff,
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

describe('a version over the template (E-018, T-082)', () => {
  const szene: Entity = {
    id: 'sc_mund', name: '1. Mouth', interfaces: ['Scene'],
    components: { Identity: { name: '1. Mouth', id: 'scene-0007' }, ReadAloud: { readaloud: [{ id: 'read', value: 'Drip.' }] } },
    relations: [
      { id: 'sc_mund~inLayer-1', type: 'inLayer', to: 'ly_system' },
      { id: 'sc_mund~partOf-2', type: 'partOf', to: 'ch_eins' },
    ],
  };
  const fassung = adaptedVersion(szene, { id: 'sc_neu', number: 'scene-0099', layer: 'ly_nebel' });

  it('copies cards and edges, lies in the campaign layer and replaces the original', () => {
    expect(fassung.components['ReadAloud']).toEqual(szene.components['ReadAloud']);
    expect(fassung.components['Identity']).toEqual({ name: '1. Mouth', id: 'scene-0099' });
    expect(fassung.relations?.map((r) => [r.type, r.to])).toEqual([
      ['partOf', 'ch_eins'],
      ['inLayer', 'ly_nebel'],
      ['overrides', 'sc_mund'],
    ]);
    expect(new Set(fassung.relations?.map((r) => r.id)).size).toBe(3);
    /* Das Original bleibt, wie es war. */
    expect(szene.components['Identity']).toEqual({ name: '1. Mouth', id: 'scene-0007' });
  });

  it('wins in the campaign that runs its layer, not in another', () => {
    const m = new Map(entities);
    m.set(szene.id, szene).set(fassung.id, fassung);
    const nebel = m.get('camp_nebel')!;
    expect(resolveArticle(m, szene, nebel).id).toBe('sc_neu');
    expect(inPlay(m, szene, nebel)).toBe(false);
    expect(resolveArticle(m, szene, m.get('camp_salz')!).id).toBe('sc_mund');
    expect(replacedIds(m, fassung)).toEqual(['sc_mund']);
    expect(replacedIds(m, szene)).toEqual([]);
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

/* Gruppen sind Ebenen, die Ebenen enthalten (E-022 b, T-088): „Core rules"
   bringt das Spielerhandbuch und das Monsterbuch, „Supplements" Xanathar
   und — verschachtelt — die Gruppe „Settings" mit Eberron. Ein Kreis
   (Settings → Supplements) läuft nicht endlos. */
describe('groups of layers (T-088)', () => {
  const L = (id: string, kind: string, published: string, partOf: string[] = []): Entity => ({
    id, name: id, interfaces: ['Layer'], components: { Layer: { kind, published } },
    relations: partOf.map((to, i) => ({ id: `${id}~p${i}`, type: 'partOf', to })),
  });
  const R = (id: string, layer: string): Entity => ({
    id, name: id, interfaces: ['Rule'], relations: [{ id: `${id}~l`, type: 'inLayer', to: layer }],
  });
  const K = (relations: Entity['relations']): Entity => ({ id: 'camp', name: 'Kampagne', interfaces: ['Campaign'], relations });
  const basis: Entity[] = [
    L('g_core', 'group', ''),
    L('g_supp', 'group', '', ['g_sett']),
    L('g_sett', 'group', '', ['g_supp']),
    L('mm', 'book', '2014-09-30', ['g_core']),
    L('phb', 'book', '2014-08-19', ['g_core']),
    L('xge', 'book', '2017-11-21', ['g_supp']),
    L('erlw', 'book', '2019-11-19', ['g_sett']),
    L('lose', 'book', '2015-01-01'),
    R('r_phb', 'phb'), R('r_mm', 'mm'), R('r_xge', 'xge'), R('r_erlw', 'erlw'), R('r_lose', 'lose'),
  ];
  const welt = (k: Entity) => new Map<EntityId, Entity>([...basis, k].map((e) => [e.id, e]));
  const an = (...ids: string[]) => ids.map((to, i) => ({ id: `a_${to}`, type: 'activates', to, props: { order: (i + 1) * 10 } }));

  it('finds the members, by publication date, and the nested ones without looping', () => {
    const k = K([]);
    const w = welt(k);
    expect(groupMembers(w).get('g_core')).toEqual(['phb', 'mm']);
    expect(layersInGroup(w, 'g_supp')).toEqual(['xge', 'g_sett', 'erlw']);
    expect(layersInGroup(w, 'g_sett')).toEqual(['erlw', 'g_supp', 'xge']);
  });

  it('brings every member, recursively, at the rank of the group', () => {
    const k = K(an('lose', 'g_core', 'g_supp'));
    const w = welt(k);
    expect(resolvedStack(w, k).map((l) => l.id)).toEqual(['lose', 'g_core', 'phb', 'mm', 'g_supp', 'xge', 'g_sett', 'erlw']);
    const s = playStack(w, k);
    for (const id of ['r_phb', 'r_mm', 'r_xge', 'r_erlw', 'r_lose']) expect(s.inPlay(w.get(id)!)).toBe(true);
    /* Rang: die Gruppe gibt ihn, innen nach Erscheinen. */
    expect(s.rank(w.get('r_mm')!)).toBeGreaterThan(s.rank(w.get('r_phb')!));
    expect(s.rank(w.get('r_phb')!)).toBeGreaterThan(s.rank(w.get('r_lose')!));
    expect(inPlay(w, w.get('r_erlw')!, k)).toBe(true);
  });

  it('takes one book out of a group that is on: off beats on', () => {
    const k = K([...an('g_core', 'g_supp'), { id: 'off_mm', type: 'activates', to: 'mm', props: { mode: 'off' } }, { id: 'off_s', type: 'activates', to: 'g_sett', props: { mode: 'off' } }]);
    const w = welt(k);
    const s = playStack(w, k);
    expect(s.inPlay(w.get('r_mm')!)).toBe(false);
    expect(s.inPlay(w.get('r_phb')!)).toBe(true);
    /* Was nur über die abgeschaltete Untergruppe käme, ist auch aus. */
    expect(s.inPlay(w.get('r_erlw')!)).toBe(false);
    expect(s.unactivated(w.get('r_mm')!)).toEqual(['mm']);
    expect(offLayers(k)).toEqual(new Set(['mm', 'g_sett']));
    /* Ohne aufgeschaltete Gruppe tut eine Abschaltung nichts. */
    expect(activeStack(w, k).map((x) => x.layer.id)).toEqual(['g_core', 'g_supp']);
  });

  it('lets an explicit edge place a member itself', () => {
    /* XGE ausdrücklich ganz unten, die Gruppe darüber: XGE bleibt unten. */
    const k = K(an('xge', 'g_supp'));
    const w = welt(k);
    expect(resolvedStack(w, k).map((l) => l.id)).toEqual(['xge', 'g_supp', 'g_sett', 'erlw']);
  });

  it('keeps the off edges when the stack is rewritten, unless the layer is turned on itself', () => {
    const k = withOff(K(an('g_core')), ['mm']);
    expect(k.relations?.filter((r) => r.props?.['mode'] === 'off').map((r) => r.to)).toEqual(['mm']);
    const weiter = withStack(k, ['g_core', 'g_supp']);
    expect(offLayers(weiter)).toEqual(new Set(['mm']));
    const selbst = withStack(k, ['g_core', 'mm']);
    expect(offLayers(selbst).size).toBe(0);
    expect(withOff(selbst, ['mm']).relations?.filter((r) => r.props?.['mode'] === 'off')).toEqual([]);
  });

  it('never makes a group the place for new articles', () => {
    const k = K(an('g_core'));
    expect(campaignLayer(welt(k), k)).toBeNull();
  });
});

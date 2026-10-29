/**
 * Das Sichtbarkeits-Regelwerk einer Kampagne mit einem Eintrag je Artikel
 * (T-401, E-162 a, REQ-401): gesonderte Artikel > Merkmal (Art, Beziehung;
 * genaueste zuerst) > Vorgabe der Ebene > public. Das eigene Feld am
 * Artikel schlägt auch den Eintrag.
 */
import { describe, expect, it } from 'vitest';
import { visibilityDimensions } from '../src/groupvisibility.js';
import {
  articleRuleKey,
  articleVisible,
  effectiveAudience,
  relationValue,
  withArticleRule,
  type CampaignVisibility,
  type Viewer,
  type VisibilityRule,
} from '../src/visibility.js';
import type { Entity, EntityId } from '../src/types.js';

const reg = { interfaces: { Creature: { name: 'Creature', label: 'Creature', area: 'world' } } } as never;
const welt = new Map<EntityId, Entity>(
  [
    { id: 'ly_system', name: 'Grundregelwerk', interfaces: ['Layer'], components: { Layer: { defaultAudience: 'campaign' } } },
    { id: 'camp', name: 'Runde', interfaces: ['Campaign'], relations: [{ id: 'a', type: 'activates', to: 'ly_system' }] },
    { id: 'f_kult', name: 'Der Kult', interfaces: ['Faction'] },
    {
      id: 'npc_baron',
      name: 'Baron',
      interfaces: ['Creature'],
      relations: [
        { id: 'l', type: 'inLayer', to: 'ly_system' },
        { id: 'm', type: 'memberOf', to: 'f_kult' },
      ],
    },
    { id: 'npc_magd', name: 'Magd', interfaces: ['Creature'], relations: [{ id: 'l2', type: 'inLayer', to: 'ly_system' }] },
  ].map((e) => [e.id, e as Entity]),
);
const dims = visibilityDimensions(welt, reg);
const ctx = (rules: VisibilityRule[]): CampaignVisibility => ({ campaign: 'camp', rules, dims });
const spielerin = (rules: VisibilityRule[]): Viewer => ({ actors: ['pc_sela'], roles: { camp: 'player' }, campaignRules: ctx(rules) });
const baron = welt.get('npc_baron')!;
const magd = welt.get('npc_magd')!;

describe('a rule for one article (T-401)', () => {
  it('wins over every group, however specific', () => {
    const rules: VisibilityRule[] = [
      { id: 'layer:ly_system|type:Creature', audience: 'players' },
      { id: articleRuleKey('npc_baron'), audience: 'gm' },
    ];
    expect(effectiveAudience(welt, baron, ctx(rules))).toEqual({ audience: 'gm', source: 'campaign', rule: 'article:npc_baron' });
    expect(effectiveAudience(welt, magd, ctx(rules))).toMatchObject({ audience: 'players', rule: 'layer:ly_system|type:Creature' });
    expect(articleVisible(welt, baron, spielerin(rules))).toBe(false);
    expect(articleVisible(welt, magd, spielerin(rules))).toBe(true);
  });

  it('loses to the article’s own field', () => {
    const own = { ...baron, components: { Visibility: { audience: 'public' } } } as Entity;
    const rules: VisibilityRule[] = [{ id: articleRuleKey('npc_baron'), audience: 'gm' }];
    expect(effectiveAudience(welt, own, ctx(rules)).source).toBe('article');
    expect(articleVisible(welt, own, spielerin(rules))).toBe(true);
  });

  it('shows or hides it for a bearer', () => {
    const rules: VisibilityRule[] = [
      { id: 'layer:ly_system', audience: 'gm' },
      { id: articleRuleKey('npc_baron'), show: ['pc_sela'] },
    ];
    expect(articleVisible(welt, baron, spielerin(rules))).toBe(true);
    expect(articleVisible(welt, magd, spielerin(rules))).toBe(false);
  });
});

describe('the relation as a feature (T-401)', () => {
  it('groups by an edge and its target, between article and layer', () => {
    const rules: VisibilityRule[] = [{ id: 'relation:' + encodeURIComponent(relationValue('memberOf', 'f_kult')), audience: 'gm' }];
    expect(effectiveAudience(welt, baron, ctx(rules)).audience).toBe('gm');
    /* Die Magd ist in keinem Kult: für sie gilt die Vorgabe der Ebene. */
    expect(effectiveAudience(welt, magd, ctx(rules))).toEqual({ audience: 'campaign', source: 'layer' });
    expect(dims.find((d) => d.key === 'relation')?.valueLabel?.(relationValue('memberOf', 'f_kult'))).toBe('memberOf → Der Kult');
  });
});

describe('withArticleRule', () => {
  it('sets, changes and removes the entry for one article', () => {
    let r = withArticleRule([{ id: 'layer:x', audience: 'gm' }], 'npc_baron', { audience: 'players' });
    expect(r).toContainEqual({ id: 'article:npc_baron', audience: 'players' });
    r = withArticleRule(r, 'npc_baron', { player: { bearers: ['pc_sela'], mode: 'hide' } });
    expect(r.find((x) => x.id === 'article:npc_baron')).toEqual({ id: 'article:npc_baron', audience: 'players', hide: ['pc_sela'] });
    r = withArticleRule(r, 'npc_baron', { follow: true });
    expect(r).toEqual([{ id: 'layer:x', audience: 'gm' }]);
  });
});

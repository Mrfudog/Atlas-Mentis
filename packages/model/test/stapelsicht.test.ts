/* T-496, REQ-395 und REQ-396: die Kampagne je Konto und die eigene Sicht
   auf ihren Stapel. Die Rechnung des Stapels bleibt eine — die Sicht ist
   nur eine Kopie der Kampagne mit anderen Aufschaltkanten. */
import { describe, expect, it } from 'vitest';
import {
  cleanStackView,
  currentCampaign,
  isDefaultView,
  playStack,
  resolvedStack,
  shownLayers,
  stackViewKey,
  viewedCampaign,
  type StackView,
} from '../src/stack.js';
import type { Entity, EntityId } from '../src/types.js';

const L = (id: string, kind = 'book', partOf: string[] = []): Entity => ({
  id, name: id, interfaces: ['Layer'], components: { Layer: { kind } },
  relations: partOf.map((to, i) => ({ id: `${id}~p${i}`, type: 'partOf', to })),
});
const R = (id: string, layer: string): Entity => ({ id, name: id, interfaces: ['Rule'], relations: [{ id: `${id}~l`, type: 'inLayer', to: layer }] });
const kampagne: Entity = {
  id: 'camp', name: 'Aus Nebel wacht', interfaces: ['Campaign'],
  relations: [
    { id: 'a1', type: 'activates', to: 'g_core', props: { order: 10 } },
    { id: 'a2', type: 'activates', to: 'ly_camp', props: { order: 100 } },
    { id: 'c1', type: 'activates', to: 'xge', props: { mode: 'compare' } },
    { id: 'e1', type: 'enables', to: 'r_lose' },
  ],
};
const zweite: Entity = { id: 'camp2', name: 'Der Salzpfad', interfaces: ['Campaign'], relations: [{ id: 'b1', type: 'activates', to: 'lose' }] };
const welt = new Map<EntityId, Entity>(
  [
    L('g_core', 'group'), L('phb', 'book', ['g_core']), L('mm', 'book', ['g_core']), L('xge'), L('lose'), L('ly_camp', 'campaign'),
    R('r_phb', 'phb'), R('r_mm', 'mm'), R('r_xge', 'xge'), R('r_lose', 'lose'), R('r_camp', 'ly_camp'),
    kampagne, zweite,
  ].map((e) => [e.id, e]),
);
const v = (x: Partial<StackView>): StackView => ({ mode: 'campaign', hide: [], mine: [], ...x });
const imSpiel = (k: Entity | null) => {
  const s = playStack(welt, k);
  return [...welt.values()].filter((e) => e.interfaces?.[0] === 'Rule' && s.inPlay(e)).map((e) => e.id).sort();
};

describe('the campaign of an account (REQ-395)', () => {
  it('takes the chosen campaign first, then the setting, then the first', () => {
    expect(currentCampaign(welt, { campaign: 'camp' }, 'camp2')?.id).toBe('camp2');
    expect(currentCampaign(welt, { campaign: 'camp2' }, null)?.id).toBe('camp2');
    expect(currentCampaign(welt, { campaign: 'camp2' }, undefined)?.id).toBe('camp2');
  });
  it('falls back when the chosen one is gone or is no campaign', () => {
    expect(currentCampaign(welt, { campaign: 'camp2' }, 'weg')?.id).toBe('camp2');
    expect(currentCampaign(welt, { campaign: 'camp2' }, 'phb')?.id).toBe('camp2');
    expect(currentCampaign(welt, null, 'weg')?.id).toBe('camp');
  });
});

describe('the own view on the stack (REQ-396)', () => {
  it('reads nothing unusable as the default of the campaign', () => {
    expect(cleanStackView(null)).toBeNull();
    expect(cleanStackView('mine')).toBeNull();
    expect(cleanStackView([])).toBeNull();
    expect(cleanStackView({ mode: 'campaign', hide: [] })).toBeNull();
    expect(cleanStackView({ mode: 'campaign', hide: ['mm', 'mm', 3, ''] })).toEqual(v({ hide: ['mm'] }));
    expect(cleanStackView({ mode: 'mine' })).toEqual(v({ mode: 'mine' }));
    expect(cleanStackView({ mode: 'whatever', hide: ['x'] })).toEqual(v({ hide: ['x'] }));
    /* Eine eigene Auswahl bleibt gemerkt, auch wenn die Kampagnensicht gilt — die wirkt dann wie die Vorgabe. */
    expect(cleanStackView({ mode: 'campaign', mine: ['x'] })).toEqual(v({ mine: ['x'] }));
    expect(isDefaultView(cleanStackView({ mode: 'campaign', mine: ['x'] }))).toBe(true);
  });

  it('is the campaign unchanged without a view or with the default', () => {
    expect(viewedCampaign(kampagne, null)).toBe(kampagne);
    expect(viewedCampaign(kampagne, v({}))).toBe(kampagne);
    expect(viewedCampaign(null, v({ mode: 'mine', mine: ['xge'] }))).toBeNull();
    expect(isDefaultView(v({ mode: 'mine' }))).toBe(false);
  });

  it('narrows: a layer turned on by the campaign loses its edge, a group member is turned off', () => {
    expect(imSpiel(kampagne)).toEqual(['r_camp', 'r_lose', 'r_mm', 'r_phb']);
    const eng = viewedCampaign(kampagne, v({ hide: ['ly_camp', 'mm'] }))!;
    expect(imSpiel(eng)).toEqual(['r_lose', 'r_phb']);
    expect(resolvedStack(welt, eng).map((l) => l.id)).toEqual(['g_core', 'phb']);
    /* Die Kampagne selbst bleibt, wie sie ist — die Sicht ist eine Kopie. */
    expect(kampagne.relations).toHaveLength(4);
    expect(eng.id).toBe('camp');
  });

  it('hides a whole group with everything it brings', () => {
    expect(imSpiel(viewedCampaign(kampagne, v({ hide: ['g_core'] })))).toEqual(['r_camp', 'r_lose']);
  });

  it('keeps the comparison layers and the single enabled articles when narrowing', () => {
    const eng = viewedCampaign(kampagne, v({ hide: ['mm'] }))!;
    expect([...shownLayers(welt, eng, true)!].sort()).toEqual(['g_core', 'ly_camp', 'phb', 'xge']);
  });

  it('own layers replace what the campaign turns on, in their order', () => {
    const meins = viewedCampaign(kampagne, v({ mode: 'mine', mine: ['xge', 'lose'] }))!;
    expect(resolvedStack(welt, meins).map((l) => l.id)).toEqual(['xge', 'lose']);
    expect(imSpiel(meins)).toEqual(['r_lose', 'r_xge']);
    /* Ein Vergleich auf eine gewählte Ebene fällt weg — sie ist im Spiel. */
    expect([...shownLayers(welt, meins, true)!].sort()).toEqual(['lose', 'xge']);
  });

  it('an empty own selection shows nothing from any layer', () => {
    expect(imSpiel(viewedCampaign(kampagne, v({ mode: 'mine', mine: [] })))).toEqual(['r_lose']);
  });

  it('stamps the view for caches, the hidden layers in any order alike', () => {
    expect(stackViewKey(null)).toBe('');
    expect(stackViewKey(v({}))).toBe('');
    expect(stackViewKey(v({ hide: ['b', 'a'] }))).toBe(stackViewKey(v({ hide: ['a', 'b'] })));
    expect(stackViewKey(v({ mode: 'mine', mine: ['a', 'b'] }))).not.toBe(stackViewKey(v({ mode: 'mine', mine: ['b', 'a'] })));
  });
});

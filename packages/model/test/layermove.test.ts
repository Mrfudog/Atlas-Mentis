/** Die Ebene eines Artikels wechseln (T-383). */
import { describe, expect, it } from 'vitest';
import { bringsIntoLayer, homeLayers, layerChange, withHomeLayer } from '../src/layermove.js';

const k = (id: string, to: string, mode?: string) => ({ id, type: 'inLayer', to, props: mode ? { mode } : {} });
const sonst = { id: 'x1', type: 'locatedIn', to: 'ort', props: {} };

describe('homeLayers', () => {
  it('reads the layers an article comes from, without "removes" and doubles', () => {
    expect(homeLayers(undefined)).toEqual([]);
    expect(homeLayers([])).toEqual([]);
    expect(homeLayers([k('a', 'ly1'), sonst, k('b', 'ly2', 'removes'), k('c', 'ly1'), k('d', 'ly3', 'adds')])).toEqual(['ly1', 'ly3']);
    expect(bringsIntoLayer(k('b', 'ly2', 'removes'))).toBe(false);
    expect(bringsIntoLayer(sonst)).toBe(false);
  });
});

describe('withHomeLayer', () => {
  it('moves into one layer, keeps the other edges and the id of the first layer edge', () => {
    const vorher = [k('a', 'ly1'), sonst, k('b', 'ly2', 'removes'), k('c', 'ly3')];
    expect(withHomeLayer(vorher, 'ly9', 'art')).toEqual([sonst, k('b', 'ly2', 'removes'), { id: 'a', type: 'inLayer', to: 'ly9', props: {} }]);
  });
  it('gives a new edge an id from the article when it had no layer', () => {
    expect(withHomeLayer([sonst], 'ly1', 'art')).toEqual([sonst, { id: 'art~inLayer-1', type: 'inLayer', to: 'ly1', props: {} }]);
  });
  it('leaves the list alone when the article is already there', () => {
    const vorher = [k('a', 'ly1'), sonst];
    expect(withHomeLayer(vorher, 'ly1', 'art')).toEqual(vorher);
    expect(withHomeLayer([sonst], null, 'art')).toEqual([sonst]);
  });
  it('takes it out of every layer with null', () => {
    expect(withHomeLayer([k('a', 'ly1'), k('b', 'ly2', 'removes')], null, 'art')).toEqual([k('b', 'ly2', 'removes')]);
  });
  it('collapses two layers into the chosen one, even if it was one of them', () => {
    expect(homeLayers(withHomeLayer([k('a', 'ly1'), k('c', 'ly2')], 'ly2', 'art'))).toEqual(['ly2']);
  });
});

describe('layerChange', () => {
  it('names added and removed layers, "removes" edges included', () => {
    expect(layerChange({ relations: [k('a', 'ly1')] }, { relations: [k('a', 'ly2'), k('b', 'ly3', 'removes')] })).toEqual({
      added: ['ly2', 'ly3'],
      removed: ['ly1'],
      homeless: false,
    });
  });
  it('sees nothing when nothing changes, and treats a new article as coming from nowhere', () => {
    expect(layerChange({ relations: [k('a', 'ly1'), sonst] }, { relations: [k('z', 'ly1')] })).toEqual({ added: [], removed: [], homeless: false });
    expect(layerChange(null, { relations: [k('a', 'ly1')] })).toEqual({ added: ['ly1'], removed: [], homeless: false });
  });
  it('says when an article leaves its last layer', () => {
    expect(layerChange({ relations: [k('a', 'ly1')] }, { relations: [] }).homeless).toBe(true);
    expect(layerChange({ relations: [] }, { relations: [] }).homeless).toBe(false);
    /* Bleibt nur eine Kante, die herausnimmt, liegt er in keiner Ebene. */
    expect(layerChange({ relations: [k('a', 'ly1')] }, { relations: [k('a', 'ly1', 'removes')] }).homeless).toBe(true);
  });
});

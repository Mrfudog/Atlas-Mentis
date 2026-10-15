/**
 * Die Facetten-Angabe im Register (T-212): eine Angabe ohne Teil wird
 * weggelassen — ohne sie leitet `facetsFor` die Facette aus der Form ab,
 * und ein gespeichertes `{}` sähe aus wie eine Einstellung.
 */

import { describe, expect, it } from 'vitest';
import { facetHintWith } from '../src/app/register/facette';

describe('facetHintWith', () => {
  it('sets, changes and drops parts', () => {
    expect(facetHintWith(undefined, { label: 'Class list' })).toEqual({ label: 'Class list' });
    expect(facetHintWith({ label: 'Class list' }, { order: 0 })).toEqual({ label: 'Class list', order: 0 });
    expect(facetHintWith({ label: 'Class list', order: 0 }, { label: undefined })).toEqual({ order: 0 });
    expect(facetHintWith({ order: 0 }, { order: undefined })).toBeUndefined();
    /* Aus „kein Filter" wird mit einem Teil wieder eine Facette. */
    expect(facetHintWith(false, { as: 'requirement' })).toEqual({ as: 'requirement' });
  });
});

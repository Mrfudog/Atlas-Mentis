/**
 * Fassungen derselben Sache und Vergleichsebenen (T-092, E-021 d).
 */

import { describe, expect, it } from 'vitest';
import type { Entity, Registry } from '../src/types.js';
import {
  activeStack,
  campaignsActivating,
  compareLayers,
  inPlay,
  playStack,
  withCompare,
  withStack,
} from '../src/stack.js';
import { layerShort, sameThing, versionDiff, versionGroups, versionName, versionsOf } from '../src/versions.js';
import { campaignsOf } from '../src/visibility.js';

const ebene = (id: string, name: string): Entity => ({
  id,
  name,
  interfaces: ['Layer'],
  components: { Identity: { name, id: `layer-${id}`, aliases: [] }, Layer: { kind: 'book', order: 0 } },
  relations: [],
});
const zauber = (id: string, name: string, buch: string, ly: string, felder: Record<string, unknown> = {}, rel: Entity['relations'] = []): Entity => ({
  id,
  name,
  interfaces: ['Spell'],
  components: {
    Identity: { name, id: `spell-${id}`, aliases: [] },
    Source: { publication: buch },
    Spell: { level: 3, ...felder },
  },
  relations: [{ id: `${id}_in`, type: 'inLayer', to: ly, props: {} }, ...(rel ?? [])],
});

const PHB = ebene('e5_book_phb', "Player's Handbook");
const XPHB = ebene('e5_book_xphb', "Player's Handbook (2024)");
const XGE = ebene('e5_book_xge', "Xanathar's Guide");
const kampagne: Entity = {
  id: 'camp',
  name: 'Aus Nebel wacht',
  interfaces: ['Campaign'],
  components: { Identity: { name: 'Aus Nebel wacht', id: 'campaign-0001', aliases: [] } },
  relations: [
    { id: 'a1', type: 'activates', to: PHB.id, props: { order: 10 } },
    { id: 'a2', type: 'activates', to: XGE.id, props: { order: 20 } },
    { id: 'c1', type: 'activates', to: XPHB.id, props: { mode: 'compare', order: 10 } },
  ],
};
const f14 = zauber('f14', 'Fireball', 'PHB', PHB.id, { range: 150 });
const f24 = zauber('f24', 'Fireball', 'XPHB', XPHB.id, { range: 150, higherLevels: 'Each slot above 3 adds 1d6.' }, [
  { id: 'v1', type: 'variantOf', to: 'f14', props: {} },
]);
const fXge = zauber('fx', 'Fireball (XGE)', 'XGE', XGE.id, { range: 120 }, [{ id: 'v2', type: 'variantOf', to: 'f14', props: {} }]);
/* Kein Fassung: ein anderer Name über `variantOf` (Grundgegenstand, Kopie). */
const anders = zauber('fb', 'Delayed Blast Fireball', 'PHB', PHB.id, {}, [{ id: 'v3', type: 'variantOf', to: 'f14', props: {} }]);

const alle = new Map([PHB, XPHB, XGE, kampagne, f14, f24, fXge, anders].map((e) => [e.id, e]));

describe('compare layers (T-092)', () => {
  it('are not in play; inPlay stays as it was', () => {
    expect(activeStack(alle, kampagne).map((x) => x.layer.id)).toEqual([PHB.id, XGE.id]);
    expect(compareLayers(alle, kampagne).map((x) => x.id)).toEqual([XPHB.id]);
    const s = playStack(alle, kampagne);
    expect(s.inPlay(f24)).toBe(false);
    expect(inPlay(alle, f24, kampagne)).toBe(false);
    expect(s.inCompare(f24)).toBe(true);
    expect(s.inCompare(f14)).toBe(false);
    expect(s.inPlay(f14)).toBe(true);
    expect(s.rank(fXge)).toBe(2);
    expect(s.rank(f24)).toBe(0);
  });

  it('do not make a layer shared or owned', () => {
    expect(campaignsActivating(alle, XPHB.id)).toEqual([]);
    expect(campaignsOf(alle, f24)?.size).toBe(0);
  });

  it('survive writing the stack, and drop out when the layer comes into play', () => {
    const neu = withStack(kampagne, [PHB.id]);
    expect(compareLayers(alle, neu).map((x) => x.id)).toEqual([XPHB.id]);
    const imSpiel = withStack(kampagne, [PHB.id, XPHB.id]);
    expect(compareLayers(alle, imSpiel)).toEqual([]);
    expect((imSpiel.relations ?? []).filter((r) => r.to === XPHB.id)).toHaveLength(1);
  });

  it('are written apart from the stack', () => {
    const neu = withCompare(kampagne, [XGE.id, XPHB.id]);
    /* XGE ist im Spiel und wird nicht noch einmal Vergleich. */
    expect(compareLayers(alle, neu).map((x) => x.id)).toEqual([XPHB.id]);
    expect(activeStack(alle, neu).map((x) => x.layer.id)).toEqual([PHB.id, XGE.id]);
    expect(compareLayers(alle, withCompare(kampagne, []))).toEqual([]);
  });
});

describe('versions of one thing (T-092)', () => {
  it('are the same type and name, with the own book cut off', () => {
    expect(versionName(fXge)).toBe('fireball');
    expect(sameThing(f14, fXge)).toBe(true);
    expect(sameThing(f14, anders)).toBe(false);
  });

  it('group over variantOf in both directions, without the base item kind', () => {
    expect(versionsOf(alle, 'f14').map((e) => e.id).sort()).toEqual(['f24', 'fx']);
    expect(versionsOf(alle, 'f24').map((e) => e.id).sort()).toEqual(['f14', 'fx']);
    expect(versionsOf(alle, 'fb')).toEqual([]);
    const g = versionGroups(alle.values());
    expect(g.get('f14')).toBe(g.get('f24'));
    expect(g.get('fx')).toBe(g.get('f14'));
    expect(g.has('fb')).toBe(false);
  });

  it('count an override as a version', () => {
    const kopie: Entity = { ...f24, id: 'k', name: 'Fireball', relations: [{ id: 'o', type: 'overrides', to: 'f14', props: {} }] };
    expect(versionsOf(new Map([...alle, ['k', kopie]]), 'k').map((e) => e.id).sort()).toEqual(['f14', 'f24', 'fx']);
  });

  it('say what differs, field by field, and nothing that is the same', () => {
    const reg = { interfaces: { Spell: { name: 'Spell', schema: { type: 'object', properties: { higherLevels: { type: 'string', format: 'long' } } } } } } as unknown as Registry;
    const d = versionDiff(reg, f14, f24);
    expect(d.fields).toEqual([{ ref: 'Spell.higherLevels', type: 'Spell', key: 'higherLevels', value: 'Each slot above 3 adds 1d6.', long: true }]);
    expect(versionDiff(reg, f14, fXge).fields.map((f) => [f.ref, f.value])).toEqual([['Spell.range', 120]]);
    /* Ebenen- und Fassungskanten zählen nicht; andere schon. */
    const mit = { ...fXge, relations: [...(fXge.relations ?? []), { id: 'x', type: 'availableTo', to: 'wiz', props: {} }] };
    expect(versionDiff(reg, f14, mit).relations).toEqual([{ type: 'availableTo', only: ['wiz'], missing: [] }]);
  });

  it('abbreviate layers', () => {
    expect(layerShort(XPHB)).toBe('XPHB');
    expect(layerShort(ebene('ly', 'Homebrew Rules'))).toBe('HR');
    expect(layerShort(ebene('ly', 'Unearthed Arcana 2023'))).toBe('UA 23');
  });
});

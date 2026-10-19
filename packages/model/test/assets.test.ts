/**
 * Bilder verwalten (T-119): wo ein Bild verwendet wird, welche Klasse ein
 * Feld anbietet.
 */
import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import { articleImage, assetKind, assetUses, assetVersion, fieldTarget, offeredAssetKind, fieldsOf, statblocksOf } from '../src/index.js';
import type { Entity } from '../src/index.js';

const e = (id: string, interfaces: string[], components: Entity['components'] = {}, relations: Entity['relations'] = []): Entity => ({
  id,
  interfaces,
  name: id,
  components,
  relations,
});

describe('assetUses', () => {
  const asset = e('a1', ['Asset'], { Asset: { ref: 'x.png' } });
  it('finds a field, a sheet deep in a list and an edge — not a sentence, not a variant', () => {
    const uses = assetUses(
      [
        asset,
        e('npc', ['Creature'], { Image: { image: 'a1' }, Description: { text: 'see a1 here' } }),
        e('map', ['Map'], { Map: { sheets: [{ id: 's', image: 'a1' }] } }),
        e('b', ['Board'], {}, [{ id: 'r', type: 'placed', to: 'a1', props: {} }]),
        e('a2', ['Asset'], { Asset: { ref: 'y.png' } }, [{ id: 'v', type: 'variantOf', to: 'a1', props: {} }]),
      ],
      new Set(['a1', 'a2']),
    );
    expect(uses.get('a1')).toEqual([
      { id: 'npc', via: 'Image.image' },
      { id: 'map', via: 'Map.sheets' },
      { id: 'b', via: 'placed' },
    ]);
    expect(uses.has('a2')).toBe(false);
  });

  it('reads the class, image when none is set', () => {
    expect(assetKind(asset)).toBe('image');
    expect(assetKind(e('t', ['Asset'], { Asset: { ref: 'z', kind: 'token' } }))).toBe('token');
  });
});

describe('the class a field offers', () => {
  const feld = (typ: string, ref: string) => {
    const f = fieldsOf(seedRegistry, typ).find((p) => `${p.type}.${p.key}` === ref);
    if (!f) throw new Error(`${typ} hat ${ref} nicht`);
    return offeredAssetKind(fieldTarget(seedRegistry, typ, f));
  };
  it('offers map images for a map, tokens for a statblock, plain images elsewhere', () => {
    expect(feld('Map', 'Image.image')).toBe('map');
    expect(feld('Creature', 'Image.image')).toBe('image');
    expect(feld('Statblock', 'Statblock.token')).toBe('token');
  });
});

describe('articleImage (T-211)', () => {
  const rel = (id: string, type: string, to: string) => ({ id, type, to, props: {} });
  const vorlage = e('sb_tpl', ['Statblock'], { Statblock: { token: 'tok_tpl' }, Image: { image: 'img_tpl' } });
  const instanz = e('sb_inst', ['Statblock'], {}, [rel('i', 'instanceOf', 'sb_tpl'), rel('b', 'belongsTo', 'npc')]);
  const npc = e('npc', ['Creature'], {});
  const eigen = e('npc2', ['Creature'], { Image: { image: 'own' } });
  const nurToken = e('sb3', ['Statblock'], { Statblock: { token: 'tok3' } }, [rel('b3', 'belongsTo', 'npc3')]);
  const npc3 = e('npc3', ['Creature'], {});
  const alle = new Map([vorlage, instanz, npc, eigen, nurToken, npc3].map((x) => [x.id, x]));
  const sb = (id: string) => statblocksOf(alle.values(), id);

  it('a creature without an image shows the image of its statblock, read through the template', () => {
    expect(articleImage(seedRegistry, npc, alle, sb)).toEqual({ id: 'img_tpl', from: 'sb_inst' });
  });
  it('falls back to the token of the statblock', () => {
    expect(articleImage(seedRegistry, npc3, alle, sb)).toEqual({ id: 'tok3', from: 'sb3' });
  });
  it('an own image beats the inherited one', () => {
    expect(articleImage(seedRegistry, eigen, alle, sb)).toEqual({ id: 'own' });
  });
  it('only a creature inherits; an asset is its own image', () => {
    expect(articleImage(seedRegistry, nurToken, alle, sb)).toBeNull();
    expect(articleImage(seedRegistry, e('a', ['Asset'], { Asset: { ref: 'abc.webp' } }), alle, sb)).toEqual({ id: 'a' });
  });
  it('the version is the hash of the stored file', () => {
    expect(assetVersion(e('a', ['Asset'], { Asset: { ref: 'abc123.webp' } }))).toBe('abc123');
    expect(assetVersion(e('a', ['Asset'], { Asset: { ref: 'https://x/y.png', backend: 'external' } }))).toBe('');
    expect(assetVersion(undefined)).toBe('');
  });
});

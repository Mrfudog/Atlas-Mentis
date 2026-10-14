/**
 * Bilder verwalten (T-119): wo ein Bild verwendet wird, welche Klasse ein
 * Feld anbietet.
 */
import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import { assetKind, assetUses, fieldTarget, offeredAssetKind, fieldsOf } from '../src/index.js';
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

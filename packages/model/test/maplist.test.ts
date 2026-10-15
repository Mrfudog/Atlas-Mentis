/**
 * Karten finden und anlegen (T-202): welche Bildklasse zu welcher Art wird,
 * eine Karte aus einem Bild, die Kartenliste als Baum und wo eine Karte
 * vorkommt.
 */
import { describe, expect, it } from 'vitest';
import { seedRegistry } from '@nw/registry';
import { imageBecomes, imageTitle, mapFromImage, mapTree, mapUses, fieldsOf } from '../src/index.js';
import type { Entity } from '../src/index.js';

const e = (id: string, interfaces: string[], components: Entity['components'] = {}, relations: Entity['relations'] = []): Entity => ({
  id,
  interfaces,
  name: id,
  components,
  relations,
});
const named = (x: Entity, name: string): Entity => ({ ...x, name });

describe('imageBecomes', () => {
  it('„Map on the table" offers map images — the session field aims at Map, and Map takes images of class map', () => {
    const feld = fieldsOf(seedRegistry, 'Session').find((f) => f.key === 'activeMap');
    expect(feld?.prop.target?.interfaces).toEqual(['Map']);
    expect(imageBecomes(seedRegistry, feld?.prop.target?.interfaces ?? [])).toEqual([{ type: 'Map', kind: 'map' }]);
  });

  it('says nothing for types whose image has no class, or unknown ones', () => {
    expect(imageBecomes(seedRegistry, ['Scene', 'Encounter', 'Nope'])).toEqual([]);
  });
});

describe('mapFromImage', () => {
  it('takes the name of the image without its file ending and sets the image', () => {
    const bild = named(e('as-1', ['Asset'], { Asset: { kind: 'map', ref: 'x' } }), 'Harbour.webp');
    expect(imageTitle(bild)).toBe('Harbour');
    expect(mapFromImage(bild)).toEqual({ type: 'Map', name: 'Harbour', fields: { 'Image.image': 'as-1' } });
  });

  it('keeps a name without ending, and falls back to the id', () => {
    expect(imageTitle(named(e('as-2', ['Asset']), 'Old Mill'))).toBe('Old Mill');
    expect(imageTitle({ id: 'as-3', interfaces: ['Asset'], components: {}, relations: [] })).toBe('as-3');
  });
});

describe('mapTree', () => {
  const inside = (to: string) => [{ id: `in-${to}`, type: 'insideMap', to, props: { x: 0.1, y: 0.1 } }];
  it('puts sub-maps under their map, by name, and a map whose parent is missing on top', () => {
    const rows = mapTree([
      named(e('w', ['Map']), 'World'),
      named(e('c', ['Map'], {}, inside('r')), 'City'),
      named(e('r', ['Map'], {}, inside('w')), 'Region'),
      named(e('a', ['Map'], {}, inside('w')), 'Abbey'),
      named(e('lost', ['Map'], {}, inside('unseen')), 'Lost'),
      named(e('npc', ['Creature']), 'Not a map'),
    ]);
    expect(rows.map((r) => [r.map.id, r.depth, r.parent])).toEqual([
      ['lost', 0, null],
      ['w', 0, null],
      ['a', 1, 'w'],
      ['r', 1, 'w'],
      ['c', 2, 'r'],
    ]);
  });

  it('survives a cycle', () => {
    const rows = mapTree([e('x', ['Map'], {}, inside('y')), e('y', ['Map'], {}, inside('x'))]);
    expect(rows.map((r) => r.map.id).sort()).toEqual(['x', 'y']);
  });
});

describe('mapUses', () => {
  it('finds sessions, fights on it and what it depicts — not markers or sub-maps', () => {
    const karte = e('m', ['Map'], {}, [{ id: 'o', type: 'mapOf', to: 'place', props: {} }]);
    const uses = mapUses(
      [
        karte,
        e('s1', ['Session'], { SessionState: { activeMap: 'm' } }),
        e('enc', ['Encounter'], {}, [{ id: 'on', type: 'onMap', to: 'm', props: {} }]),
        e('big', ['Map'], {}, [{ id: 'mk', type: 'marker', to: 'm', props: {} }]),
        e('sub', ['Map'], {}, [{ id: 'in', type: 'insideMap', to: 'm', props: {} }]),
        e('txt', ['Scene'], { Description: { description: 'see m' } }),
      ],
      karte,
    );
    expect(uses).toEqual([
      { id: 's1', via: 'SessionState.activeMap' },
      { id: 'enc', via: 'onMap' },
      { id: 'place', via: 'mapOf' },
    ]);
  });
});

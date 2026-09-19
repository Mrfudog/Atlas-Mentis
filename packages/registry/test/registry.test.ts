import { describe, expect, it } from 'vitest';
import {
  RegistrySchema,
  allowedComponents,
  blockTypesFor,
  relationsFrom,
  showField,
  viewKeys,
} from '@nw/model';
import { seedRegistry } from '../src/index.js';

/**
 * The registry is data, so nothing but a test stops a typo in it from
 * silently producing an article type with no fields. These checks are the
 * reason the "add a kind of thing without touching code" claim is safe.
 */
describe('seed registry', () => {
  it('matches the registry schema', () => {
    expect(() => RegistrySchema.parse(seedRegistry)).not.toThrow();
  });

  it('every component an interface names exists', () => {
    const missing: string[] = [];
    for (const [name, def] of Object.entries(seedRegistry.interfaces)) {
      for (const component of [...(def.requires ?? []), ...(def.allows ?? [])]) {
        if (!seedRegistry.components[component]) missing.push(`${name} → ${component}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('every interface an interface extends exists', () => {
    const missing: string[] = [];
    for (const [name, def] of Object.entries(seedRegistry.interfaces)) {
      for (const parent of def.extends ?? []) {
        if (!seedRegistry.interfaces[parent]) missing.push(`${name} → ${parent}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('every relation endpoint names a real interface', () => {
    const bad: string[] = [];
    for (const [type, def] of Object.entries(seedRegistry.relations)) {
      for (const end of [...(def.from ?? []), ...(def.to ?? [])]) {
        if (end === '*' || end === 'same') continue;
        if (!seedRegistry.interfaces[end]) bad.push(`${type} → ${end}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('every relation carries both labels, so backlinks read correctly', () => {
    for (const [type, def] of Object.entries(seedRegistry.relations)) {
      expect(def.label, `${type}.label`).toBeTruthy();
      expect(def.inverseLabel, `${type}.inverseLabel`).toBeTruthy();
      expect(def.inverseLabel, `${type} labels must differ`).not.toBe(def.label);
    }
  });

  it('every field a view names exists on its component', () => {
    const bad: string[] = [];
    for (const [key, view] of Object.entries(seedRegistry.views)) {
      if (!Array.isArray(view.felder)) continue;
      for (const entry of view.felder) {
        const [component, property] = entry.split('.');
        const def = component ? seedRegistry.components[component] : undefined;
        if (!def) {
          bad.push(`${key}: unbekannte Komponente ${component}`);
          continue;
        }
        if (property && !def.schema.properties[property]) {
          bad.push(`${key}: ${component} hat kein Feld ${property}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('every block type a view names is accepted by some interface', () => {
    const accepted = new Set(
      Object.keys(seedRegistry.interfaces).flatMap((name) => blockTypesFor(seedRegistry, name)),
    );
    const bad: string[] = [];
    for (const [key, view] of Object.entries(seedRegistry.views)) {
      if (!Array.isArray(view.bloecke)) continue;
      for (const type of view.bloecke) {
        if (!accepted.has(type)) bad.push(`${key}: ${type}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('the player view withholds secrets', () => {
    const spieler = seedRegistry.views['spieler'];
    expect(spieler).toBeDefined();
    expect(Array.isArray(spieler!.bloecke) && spieler!.bloecke.includes('secret')).toBe(false);
    expect(showField(spieler!, 'StatblockInfo', 'ac')).toBe(false);
  });

  it('exposes the facets the table actually uses', () => {
    expect(viewKeys(seedRegistry)).toEqual(['schnell', 'voll', 'kampf', 'bild', 'spieler', 'werte']);
  });
});

describe('interface inheritance', () => {
  it('unions components up the extends chain', () => {
    const forNpc = allowedComponents(seedRegistry, 'NPC');
    expect(forNpc).toContain('Name'); // from Base.requires
    expect(forNpc).toContain('Status'); // from Base.allows
    expect(forNpc).toContain('CreatureInfo'); // its own
    expect(forNpc).not.toContain('StatblockInfo');
  });

  it('adds `+x` block types to the inherited set', () => {
    const forNpc = blockTypesFor(seedRegistry, 'NPC');
    expect(forNpc).toContain('paragraph'); // inherited from Base
    expect(forNpc).toContain('secret'); // added with +secret
    expect(blockTypesFor(seedRegistry, 'Regel')).toEqual(['paragraph', 'note']);
  });

  it('offers only the relations whose source matches', () => {
    const fromStatblock = relationsFrom(seedRegistry, 'Statblock').map((r) => r.type);
    expect(fromStatblock).toContain('composedOf');
    expect(fromStatblock).toContain('beschriebenIn'); // from: ['*']
    expect(fromStatblock).not.toContain('wohntIn');
  });
});

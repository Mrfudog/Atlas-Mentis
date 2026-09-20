import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { derivedValue, validateEntity } from '@nw/model';
import { seedRegistry } from '@nw/registry';
import { importItems } from '../src/gegenstand.js';
import { importStatblocks } from '../src/statblock.js';

/**
 * The chain end to end: real vault files → articles → Validation.
 *
 * Each half is tested on its own, but only this says the importer produces
 * articles the registry actually accepts. Without it, the parser could be
 * perfect and still emit an interface nobody declared.
 */

const items = join(import.meta.dirname, 'fixtures');
const statblocks = join(items, 'statblock');
const load = (dir: string) =>
  readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => ({ name: f, text: readFileSync(join(dir, f), 'utf8') }));

describe('imported items pass Validation', () => {
  const report = importItems(load(items));
  const known = new Set(report.entities.map((e) => e.id));

  for (const entity of report.entities) {
    it(`${entity.name} (${entity.interfaces[0]})`, () => {
      expect(validateEntity(seedRegistry, entity, { knownIds: known })).toEqual([]);
    });
  }
});

describe('imported statblocks pass Validation', () => {
  const report = importStatblocks(load(statblocks));
  const known = new Set([...report.entities, ...report.rules].map((e) => e.id));

  for (const entity of [...report.entities, ...report.rules]) {
    it(`${entity.name} (${entity.interfaces[0]})`, () => {
      expect(validateEntity(seedRegistry, entity, { knownIds: known })).toEqual([]);
    });
  }
});

describe('derived values over imported data', () => {
  it('computes grid dimensions without storing them', () => {
    const report = importItems(load(items));
    const balken = report.entities.find((e) => e.name === 'Holzbalken');
    const grid = balken?.components['Item'] as Record<string, unknown>;
    const schema = seedRegistry.interfaces['Item']!.schema!.properties;

    // Holzbalken is 16 wide, 4 tall, fully filled.
    expect(derivedValue(schema['width']!, grid)).toBe(16);
    expect(derivedValue(schema['height']!, grid)).toBe(4);
    expect(derivedValue(schema['cells']!, grid)).toBe(64);

    // Bastardschwert's cross shape: 3 wide, 5 tall, 7 occupied cells.
    const schwert = report.entities.find((e) => e.name === 'Bastardschwert');
    const kreuz = schwert?.components['Item'] as Record<string, unknown>;
    expect(derivedValue(schema['width']!, kreuz)).toBe(3);
    expect(derivedValue(schema['height']!, kreuz)).toBe(5);
    expect(derivedValue(schema['cells']!, kreuz)).toBe(7);

    /* Keiner davon wird gespeichert (D8). Seit die Felder der Art gehören,
       liegt `rows` neben den übrigen Gegenstandsfeldern in derselben Karte —
       geprüft wird deshalb, dass die gerechneten *nicht* dort stehen, statt
       den ganzen Schlüsselsatz aufzuzählen. */
    for (const k of ['width', 'height', 'cells']) expect(Object.keys(kreuz!)).not.toContain(k);
    expect(Object.keys(kreuz!)).toContain('rows');
  });

  it('computes ability modifiers on an imported statblock', () => {
    const report = importStatblocks(load(statblocks));
    const grimm = report.entities.find((e) => e.name === 'Grimmhauer');
    const info = grimm?.components['StatblockInfo'] as Record<string, unknown>;
    const schema = seedRegistry.interfaces['StatblockInfo']!.schema!.properties;

    expect(derivedValue(schema['strMod']!, info)).toBe(4); // STR 18
    expect(derivedValue(schema['intMod']!, info)).toBe(-4); // INT 3, Unicode minus
    expect(derivedValue(schema['passivePerception']!, info)).toBe(11); // 10 + mod(WIS 12)
  });
});

describe('the pool is shared, not copied', () => {
  it('references rule articles instead of inlining their text', () => {
    const report = importStatblocks(load(statblocks));
    for (const statblock of report.entities) {
      const composed = (statblock.relations ?? []).filter((r) => r.type === 'composedOf');
      expect(composed.length, `${statblock.name} has no composed rules`).toBeGreaterThan(0);
      // The statblock carries no copy of the rule text.
      expect(JSON.stringify(statblock.components)).not.toContain('composedOf');
    }
    // Every rule exists exactly once per distinct name+text.
    const keys = report.rules.map(
      (r) =>
        `${r.name}\u0000${(r.components['Description'] as Record<string, unknown>)['description'] as string}`,
    );
    expect(new Set(keys).size).toBe(keys.length);
  });
});

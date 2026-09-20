import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { importItems, parseItem, stripDataview } from '../src/gegenstand.js';
import { list, num, parseFrontmatter, str } from '../src/frontmatter.js';

/**
 * These fixtures are real notes out of the campaign vault. They are the
 * import contract — `Data Definitions §9` item 7 lists it as undefined, and
 * this file is where it stops being undefined. Replacing a fixture with a
 * tidied-up version would defeat the point.
 */
const DIR = join(import.meta.dirname, 'fixtures');
const read = (file: string) => ({ name: file, text: readFileSync(join(DIR, file), 'utf8') });

const files = readdirSync(DIR).filter((f) => f.endsWith('.md'));

describe('frontmatter', () => {
  it('finds keys regardless of case', () => {
    // The vault writes `Rarität` but `rüstungsklasse`, because Dataview
    // lowercases property names. Exact-case lookup loses armour class.
    const fm = parseFrontmatter(read('Kettenrüstung.md').text);
    expect(str(fm, 'Rüstungsklasse')).toBe('16');
    expect(str(fm, 'rüstungsklasse')).toBe('16');
    expect(str(fm, 'RÜSTUNGSKLASSE')).toBe('16');
  });

  it('reads lists, quoted scalars and empty keys', () => {
    const fm = parseFrontmatter(read('Bastardschwert.md').text);
    expect(list(fm, 'aliases')).toEqual(['longsword']);
    expect(list(fm, 'Formfaktor')).toEqual(['0X0', 'XXX', '0X0', '0X0', '0X0']);
    expect(str(fm, 'Stapelgrösse')).toBe('1'); // was quoted
    expect(str(fm, 'Kupferpreis')).toBe(''); // present but empty
  });

  it('returns undefined for an absent number, not NaN or zero', () => {
    const fm = parseFrontmatter(read('Bastardschwert.md').text);
    expect(num(fm, 'Kupferpreis')).toBeUndefined();
    expect(num(fm, 'Stapelgrösse')).toBe(1);
  });
});

describe('stripDataview', () => {
  it('removes the rendering block, which is identical in every file', () => {
    for (const file of files) {
      const { body } = parseFrontmatter(read(file).text);
      expect(stripDataview(body)).not.toContain('dataviewjs');
      expect(stripDataview(body)).not.toContain('# Inventar');
    }
  });

  it('keeps the prose around it', () => {
    const { body } = parseFrontmatter(read('Bastardschwert.md').text);
    expect(stripDataview(body)).toContain('Anderthalbhänder');
  });
});

describe('parseItem', () => {
  it('routes Gegenstandstyp to an interface', () => {
    expect(parseItem(read('Bastardschwert.md').text, 'Bastardschwert.md').entity.interfaces)
      .toEqual(['Weapon']);
    expect(parseItem(read('Kettenrüstung.md').text, 'Kettenrüstung.md').entity.interfaces)
      .toEqual(['Armor']);
    expect(parseItem(read('Holzbalken.md').text, 'Holzbalken.md').entity.interfaces)
      .toEqual(['Material']);
  });

  it('keeps Rarität and Kaufrarität apart — they are different scales', () => {
    const schwert = parseItem(read('Bastardschwert.md').text, 'Bastardschwert.md');
    const info = schwert.entity.components['Item'] as Record<string, unknown>;
    // `-` means "not a magic item", which is not a rarity value.
    expect(info['rarity']).toBeUndefined();
    expect(info['availability']).toBe('Ungewöhnlich');

    const essenz = parseItem(read('Arkane Essenz (gewöhnlich).md').text, 'Arkane Essenz (gewöhnlich).md');
    const essenzInfo = essenz.entity.components['Item'] as Record<string, unknown>;
    expect(essenzInfo['rarity']).toBe('gewöhnlich');
    expect(essenzInfo['availability']).toBeUndefined();
  });

  it('reads the armour class that only lowercase lookup finds', () => {
    const kette = parseItem(read('Kettenrüstung.md').text, 'Kettenrüstung.md');
    expect(kette.entity.components['Armor']).toEqual({
      ac: 16,
      armorType: 'Schwere Rüstung',
    });
  });

  it('keeps the grid as rows', () => {
    const balken = parseItem(read('Holzbalken.md').text, 'Holzbalken.md');
    const grid = balken.entity.components['Item'] as { rows: string[] };
    expect(grid.rows).toHaveLength(4);
    expect(grid.rows[0]).toHaveLength(16);
  });

  it('turns Eigenschaften into references, not text', () => {
    // A weapon property is a pooled rule. Copying its text into every weapon
    // is exactly the reuse the backbone exists to avoid.
    const schwert = parseItem(read('Bastardschwert.md').text, 'Bastardschwert.md');
    expect(schwert.pending).toEqual([{ relation: 'hasProperty', target: 'Versatil' }]);
  });

  it('takes the image embed as the Image component', () => {
    const kette = parseItem(read('Kettenrüstung.md').text, 'Kettenrüstung.md');
    const bild = kette.entity.components['Image'] as Record<string, unknown>;
    expect(bild['url']).toBe('Kettenrüstung.png');
    expect(bild['caption']).toBe('');
    expect(kette.images).toEqual(['Kettenrüstung.png']);
  });

  it('drops the `gegenstand` tag every file carries and keeps the rest', () => {
    const schwert = parseItem(read('Bastardschwert.md').text, 'Bastardschwert.md');
    expect(schwert.entity.tags).toEqual(['waffe']);
    // Kettenrüstung carries only `gegenstand` — the vault is inconsistent here.
    const kette = parseItem(read('Kettenrüstung.md').text, 'Kettenrüstung.md');
    expect(kette.entity.tags).toEqual([]);
  });

  it('keeps the original file verbatim (REQ-019)', () => {
    for (const file of files) {
      const parsed = parseItem(read(file).text, file);
      const raw = parsed.entity.components['Imported'] as Record<string, unknown>;
      expect(raw['text']).toBe(read(file).text);
      expect(raw['format']).toBe('obsidian');
    }
  });

  it('loses nothing silently — every carried key is placed or reported', () => {
    for (const file of files) {
      const parsed = parseItem(read(file).text, file);
      expect(parsed.unplaced, `${file}: unplaced keys`).toEqual([]);
    }
  });

  it('names the article after the file, not the frontmatter', () => {
    // These notes carry no `name:` key; the filename is the name.
    const essenz = parseItem(read('Arkane Essenz (gewöhnlich).md').text, 'Arkane Essenz (gewöhnlich).md');
    expect(essenz.entity.name).toBe('Arkane Essenz (gewöhnlich)');
  });
});

describe('importItems', () => {
  it('imports the whole batch and reports what did not resolve', () => {
    const report = importItems(files.map(read));
    expect(report.entities).toHaveLength(files.length);
    // `Versatil` is not among these five files, so it is a to-do, not a loss.
    expect(report.unresolved).toEqual([
      { from: 'Bastardschwert', relation: 'hasProperty', target: 'Versatil' },
    ]);
  });

  it('resolves a reference when the target is already there', () => {
    const versatil = {
      id: 'r_versatil',
      interfaces: ['Rule'],
      name: 'Versatil',
      tags: [],
      components: { Name: { text: 'Versatil' } },
    };
    const report = importItems(files.map(read), [versatil]);
    expect(report.unresolved).toEqual([]);
    const schwert = report.entities.find((e) => e.name === 'Bastardschwert');
    expect(schwert?.relations).toEqual([
      expect.objectContaining({ type: 'hasProperty', to: 'r_versatil' }),
    ]);
  });

  it('matches on aliases as well as names', () => {
    const byAlias = {
      id: 'r_versatile',
      interfaces: ['Rule'],
      name: 'Vielseitig',
      tags: [],
      components: { Name: { text: 'Vielseitig' }, Identity: { aliases: ['Versatil'] } },
    };
    const report = importItems(files.map(read), [byAlias]);
    expect(report.unresolved).toEqual([]);
  });
});

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { importStatblocks, normaliseMinus, parseStatblock } from '../src/statblock.js';

const DIR = join(import.meta.dirname, 'fixtures', 'statblock');
const read = (file: string) => ({ name: file, text: readFileSync(join(DIR, file), 'utf8') });
const files = readdirSync(DIR).filter((f) => f.endsWith('.md'));

const info = (file: string) =>
  parseStatblock(read(file).text, file).entity.components['StatblockInfo'] as Record<string, unknown>;

describe('normaliseMinus', () => {
  it('converts U+2212 to a hyphen', () => {
    // Grimmhauer's table reads `3 (−4)` with a real minus sign. Without this,
    // a `(-?\d+)` match skips the sign and reads −4 as 4.
    expect(normaliseMinus('3 (−4)')).toBe('3 (-4)');
  });
});

describe('parseStatblock', () => {
  it('splits grösse into size and creature type', () => {
    expect(info('Ankheg Drone.md')['size']).toBe('Klein');
    expect(info('Ankheg Drone.md')['kind']).toBe('Ankheg');
    expect(info('Grimmhauer.md')['size']).toBe('Gross');
    expect(info('Grimmhauer.md')['kind']).toBe('Monstrosität');
  });

  it('splits the armour class from its parenthetical source', () => {
    expect(info('Ankheg Drone.md')['ac']).toBe(12);
    expect(info('Ankheg Drone.md')['acNote']).toBe('Natürlicher Panzer');
    expect(info('Grimmhauer.md')['ac']).toBe(13);
    expect(info('Grimmhauer.md')['acNote']).toBeUndefined();
  });

  it('keeps a fractional challenge rating as a string', () => {
    expect(info('Ankheg Drone.md')['cr']).toBe('1/8');
    expect(info('Grimmhauer.md')['cr']).toBe('2');
  });

  it('reads ability scores, negative ones included', () => {
    const drone = info('Ankheg Drone.md');
    expect(drone['str']).toBe(8);
    expect(drone['dex']).toBe(15);
    expect(drone['cha']).toBe(5);

    // Grimmhauer's INT and CHA use the Unicode minus.
    const grimm = info('Grimmhauer.md');
    expect(grimm['str']).toBe(18);
    expect(grimm['int']).toBe(3);
    expect(grimm['cha']).toBe(6);
  });

  it('reads the label lines, tolerating the colon inside the bold', () => {
    // `**Geschwindigkeit:**` carries a colon where no other label does.
    const grimm = info('Grimmhauer.md');
    expect(grimm['prof']).toBe(2);
    expect(grimm['saves']).toBe('STR +6');
    expect(grimm['skills']).toBe('Wahrnehmung +3');
    expect(grimm['senses']).toContain('Dunkelsicht');
  });

  it('treats an em dash as absent rather than as a value', () => {
    const grimm = info('Grimmhauer.md');
    expect(grimm['resistances']).toBeUndefined();
    expect(grimm['languages']).toBeUndefined();

    const drone = info('Ankheg Drone.md');
    expect(drone['resistances']).toBe('Bludgeoning, Fire');
    expect(drone['immunities']).toBe('Acid');
  });

  it('keeps entry text that wraps across lines', () => {
    // Grimmhauer's traits wrap over four or five `>` lines each. Reading one
    // line per entry would keep the first and drop the rest.
    const parsed = parseStatblock(read('Grimmhauer.md').text, 'Grimmhauer.md');
    const traits = parsed.sections.find((s) => s.section === 'Traits');
    const angekettet = traits?.entries.find((e) => e.name === 'Angekettet');
    expect(angekettet?.text).toContain('30ft vom Pflock');
    expect(angekettet?.text).toContain('Wahrnehmung DC 8');
    expect(angekettet?.text).not.toContain('\n');
  });

  it('finds every section in file order', () => {
    const parsed = parseStatblock(read('Grimmhauer.md').text, 'Grimmhauer.md');
    expect(parsed.sections.map((s) => s.section)).toEqual(['Traits', 'Actions', 'Reactions']);
    expect(parsed.sections[0]?.entries.map((e) => e.name)).toEqual([
      'Angekettet', 'Kette lösen', 'Witterung statt Augen', 'Dressiert',
    ]);
  });

  it('follows the kreatur link when the statblock names one', () => {
    expect(parseStatblock(read('Grimmhauer.md').text, 'Grimmhauer.md').creature).toBe('Grimmhauer');
    expect(parseStatblock(read('Ankheg Drone.md').text, 'Ankheg Drone.md').creature).toBeNull();
  });

  it('keeps the original file verbatim and places every carried key', () => {
    for (const file of files) {
      const parsed = parseStatblock(read(file).text, file);
      const raw = parsed.entity.components['Base'] as Record<string, unknown>;
      expect(raw['imported']).toBe(read(file).text);
      expect(parsed.unplaced, `${file}: unplaced keys`).toEqual([]);
      expect(parsed.entity.name, `${file}: name`).toBeTruthy();
      expect(parsed.sections.length, `${file}: sections`).toBeGreaterThan(0);
    }
  });
});

describe('importStatblocks', () => {
  it('pools every entry as its own rule and references it', () => {
    const report = importStatblocks(files.map(read));
    expect(report.entities).toHaveLength(files.length);
    expect(report.rules.length).toBeGreaterThan(0);

    for (const statblock of report.entities) {
      for (const relation of statblock.relations ?? []) {
        if (relation.type !== 'composedOf') continue;
        expect(report.rules.some((r) => r.id === relation.to)).toBe(true);
      }
    }
  });

  it('shares one rule between statblocks that carry the same entry', () => {
    const twice = [read(files[0] as string), { name: 'Kopie.md', text: read(files[0] as string).text }];
    const report = importStatblocks(twice);
    const ids = report.entities.flatMap((e) =>
      (e.relations ?? []).filter((r) => r.type === 'composedOf').map((r) => r.to),
    );
    // Both statblocks point at the same rule articles, not at copies.
    expect(new Set(ids).size).toBe(ids.length / 2);
  });

  it('classifies the section as the rule kind', () => {
    const report = importStatblocks([read('Ankheg Drone.md')]);
    const kinds = report.rules.map((r) => (r.components['Rule'] as Record<string, unknown>)['kind']);
    expect(kinds).toContain('trait');
    expect(kinds).toContain('action');
    expect(kinds).toContain('bonus');
  });

  it('reports an unresolved creature link instead of dropping it', () => {
    const report = importStatblocks([read('Grimmhauer.md')]);
    expect(report.unresolved).toEqual([{ from: 'Grimmhauer', target: 'Grimmhauer' }]);
  });

  it('never resolves a statblock to itself', () => {
    // The vault names creature and statblock alike — `Grimmhauer` is both,
    // which is the D4 split working as intended. Matching by name across
    // everything would make the statblock its own creature.
    const report = importStatblocks([read('Grimmhauer.md')]);
    const statblock = report.entities[0];
    expect(statblock?.relations?.some((r) => r.type === 'belongsTo' && r.to === statblock.id))
      .toBe(false);
  });

  it('links to the creature once that article exists', () => {
    const creature = {
      id: 'npc_grimmhauer',
      interfaces: ['NPC'],
      name: 'Grimmhauer',
      tags: [],
      components: { Name: { text: 'Grimmhauer' } },
    };
    const report = importStatblocks([read('Grimmhauer.md')], [creature]);
    expect(report.unresolved).toEqual([]);
    expect(report.entities[0]?.relations).toContainEqual(
      expect.objectContaining({ type: 'belongsTo', to: 'npc_grimmhauer' }),
    );
  });
});
